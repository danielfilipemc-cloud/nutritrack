import {test} from 'node:test';
import assert from 'node:assert/strict';
import {foundationFixture,id} from './foundation-fixture';
import {migrationBundle} from '../scripts/migration-bundle';
import {snapshotLocalDevelopment,restoreLocalDevelopment} from '../scripts/local-recovery';
const denied=(promise:Promise<unknown>,code='42501')=>assert.rejects(promise,(e:any)=>e.code===code);
const measurement=(_user=2,client=100)=>`select aura_assessment_create('${id(10)}','${id(client)}',app_private.business_today(),80,null,null) id,1 as revision`;
async function link(f:Awaited<ReturnType<typeof foundationFixture>>,client=100,user=4,email='student@example.invalid'){
 await f.asUser(1);const token=(await f.db.query<{t:string}>(`select aura_student_invite_create('${id(10)}','${id(client)}','${email}') t`)).rows[0].t;
 await f.asUser(user);await f.db.query(`select aura_student_invite_accept('${token}')`);return token;
}
test('full upgraded RLS requires competency AND assignment; management does not grant measurements',async()=>{
 const f=await foundationFixture();try{
 for(const u of [1,2,3,7]){await f.asUser(u);assert.equal((await f.db.query('select * from assessments')).rows.length,0);await denied(f.db.query(measurement(u)));}
 await f.asUser(3);await denied(f.db.query(`select aura_capability_save('${id(10)}','${id(3)}','assessments',true,true)`));
 await f.asUser(1);await f.db.query(`select aura_capability_save('${id(10)}','${id(2)}','assessments',true,false)`);
 await f.asUser(2);await denied(f.db.query(measurement()));
 await f.asUser(1);await f.db.query(`select aura_assignment_save('${id(10)}','${id(100)}','${id(2)}',true)`);
 await f.asUser(2);await denied(f.db.query(measurement())); // read capability cannot write
 await f.grant(2,100);await f.asUser(2);await f.db.query(measurement());
 assert.equal((await f.db.query('select * from assessments')).rows.length,1);
 assert.equal((await f.db.query('select * from clients')).rows.length,1);
 await denied(f.db.query(measurement(2,200)));
 await denied(f.db.query(`select aura_assignment_save('${id(10)}','${id(101)}','${id(2)}',true)`));
 await denied(f.db.query(`insert into staff_capabilities values('${id(10)}','${id(2)}','schedule',true)`));
 await f.asUser(5);assert.equal((await f.db.query('select * from assessments')).rows.length,0);
 }finally{await f.db.close();}
});
test('revocation gates existing definer commands and inaccessible historical implementations',async()=>{
 const f=await foundationFixture();try{
 await f.grant(2,100);await f.asUser(2);
 await f.db.query(`select aura_followup_save('${id(10)}','${id(100)}','Synthetic goal','active',null,null,0)`);
 await denied(f.db.query(`select app_private.followup_save_foundation_base('${id(10)}','${id(101)}','Bypass','active',null,null,0)`));
 await f.asUser(1);await f.db.query(`select aura_assignment_save('${id(10)}','${id(100)}','${id(2)}',false)`);
 await f.asUser(2);assert.equal((await f.db.query('select * from client_followups')).rows.length,0);
 await denied(f.db.query(`select aura_followup_save('${id(10)}','${id(100)}','Bypass','active',null,null,1)`));
 await denied(f.db.query(`select aura_client_change('${id(10)}','${id(100)}','Bypass',false,1)`));
 await denied(f.db.query(`select * from aura_client_history('${id(10)}','${id(100)}',0)`));
 await f.grant(2,100);await f.asUser(1);await f.db.query(`select aura_capability_save('${id(10)}','${id(2)}','followup',false,false)`);
 await f.asUser(2);await denied(f.db.query(`select aura_followup_save('${id(10)}','${id(100)}','Bypass','active',null,null,1)`));
 await f.db.exec('reset role;set role anon');await denied(f.db.query(`select aura_client_permissions('${id(10)}','${id(100)}')`));
 }finally{await f.db.close();}
});
test('student links require verified matching email, single use, tenant validity and no membership elevation',async()=>{
 const f=await foundationFixture();try{
 await f.asUser(1);const token=(await f.db.query<{t:string}>(`select aura_student_invite_create('${id(10)}','${id(100)}','student@example.invalid') t`)).rows[0].t;
 await f.asUser(8);await denied(f.db.query(`select aura_student_invite_accept('${token}')`));
 await f.asUser(4);await f.db.query(`select aura_student_invite_accept('${token}')`);await denied(f.db.query(`select aura_student_invite_accept('${token}')`));
 assert.equal((await f.db.query('select * from organization_members')).rows.length,0);
 assert.equal((await f.db.query('select * from clients')).rows.length,1);
 assert.equal((await f.db.query('select * from assessments')).rows.length,0);
 await denied(f.db.query(`select aura_student_invite_create('${id(10)}','${id(101)}','secondstudent@example.invalid')`));
 await f.asUser(1);await denied(f.db.query(`select aura_student_invite_create('${id(10)}','${id(200)}','student@example.invalid')`),'22023');
 const bad=(await f.db.query<{t:string}>(`select aura_student_invite_create('${id(10)}','${id(101)}','unconfirmed@example.invalid') t`)).rows[0].t;
 await f.asUser(6);await denied(f.db.query(`select aura_student_invite_accept('${bad}')`));
 await f.asUser(1);await f.db.query(`select aura_student_revoke('${id(10)}','${id(100)}')`);
 await f.asUser(4);assert.equal((await f.db.query('select * from clients')).rows.length,0);await denied(f.db.query(`select * from aura_student_assessments('${id(10)}','${id(100)}',0)`));
 }finally{await f.db.close();}
});
test('student sees only published metrics; private notes never leak, export is scoped and not truncated',async()=>{
 const f=await foundationFixture();try{
 await f.grant(2,100);await link(f);await f.asUser(2);
 const a=(await f.db.query<{id:string;revision:number}>(measurement())).rows[0];
 await f.asUser(4);assert.equal((await f.db.query(`select * from aura_student_assessments('${id(10)}','${id(100)}',0)`)).rows.length,0);
 await f.asUser(2);await f.db.query(`select aura_assessment_share('${id(10)}','${a.id}',true,1)`);
 await denied(f.db.query(`select aura_assessment_share('${id(10)}','${a.id}',true,1)`),'PT409');
 await f.db.exec(`reset role;update assessments set note='Synthetic private note' where id='${a.id}'`);await f.asUser(4);const visible=(await f.db.query(`select * from aura_student_assessments('${id(10)}','${id(100)}',0)`)).rows;
 assert.equal(visible.length,1);assert.ok(!JSON.stringify(visible).includes('note'));
 assert.equal((await f.db.query('select note from assessments')).rows.length,0);
 await denied(f.db.query(`select * from aura_student_assessments('${id(10)}','${id(101)}',0)`));
 await denied(f.db.query(`select aura_assessment_share('${id(10)}','${a.id}',true,2)`));
 await f.asUser(2);
 for(let i=0;i<26;i++){const r=(await f.db.query<{id:string}>(measurement())).rows[0];await f.db.query(`select aura_assessment_share('${id(10)}','${r.id}',true,1)`);}
 await f.asUser(4);const exported=(await f.db.query<{x:{assessments:unknown[];scope:string}}>(`select aura_visible_export('${id(10)}','${id(100)}') x`)).rows[0].x;
 assert.equal(exported.assessments.length,27);assert.equal(exported.scope,'visible_records_only');assert.ok(!JSON.stringify(exported).includes('Synthetic private note'));
 assert.equal((await f.db.query(`select * from aura_student_assessments('${id(10)}','${id(100)}',25)`)).rows.length,2);
 await f.asUser(3);const admin=(await f.db.query<{x:{assessments:unknown[]}}>(`select aura_visible_export('${id(10)}','${id(100)}') x`)).rows[0].x;assert.equal(admin.assessments.length,0);
 }finally{await f.db.close();}
});
test('assessment corrections preserve original, prevent stale writes and require republication',async()=>{
 const f=await foundationFixture();try{
 await f.grant(2,100);await link(f);await f.asUser(2);const a=(await f.db.query<{id:string}>(measurement())).rows[0];
 await f.db.query(`select aura_assessment_share('${id(10)}','${a.id}',true,1)`);
 const sql=`select aura_assessment_correct('${id(10)}','${a.id}',2,app_private.business_today(),79,null,null,'Synthetic correction') id`;
 const pair=await Promise.allSettled([f.db.query<{id:string}>(sql),f.db.query(sql)]);
 assert.equal(pair.filter(x=>x.status==='fulfilled').length,1);assert.equal(pair.filter(x=>x.status==='rejected').length,1);
 const changed=(pair.find(x=>x.status==='fulfilled') as PromiseFulfilledResult<{rows:{id:string}[]}>).value.rows[0].id;
 const original=(await f.db.query<{weight_kg:number;superseded_at:string;student_visible:boolean}>(`select weight_kg,superseded_at,student_visible from assessments where id='${a.id}'`)).rows[0];
 assert.equal(Number(original.weight_kg),80);assert.ok(original.superseded_at);assert.equal(original.student_visible,false);
 await denied(f.db.query(`update assessments set weight_kg=60 where id='${a.id}'`));
 await f.asUser(4);assert.equal((await f.db.query(`select * from aura_student_assessments('${id(10)}','${id(100)}',0)`)).rows.length,0);
 await f.asUser(2);await f.db.query(`select aura_assessment_share('${id(10)}','${changed}',true,1)`);
 await f.asUser(4);assert.equal(Number((await f.db.query<{weight_kg:number}>(`select * from aura_student_assessments('${id(10)}','${id(100)}',0)`)).rows[0].weight_kg),79);
 await denied(f.db.query('select * from app_private.assessment_corrections'));
 }finally{await f.db.close();}
});
test('dates, authorship and column grants resist crafted Data API inserts',async()=>{
 const f=await foundationFixture();try{
 await f.grant(2,100);await f.asUser(2);
 await denied(f.db.query(`select aura_assessment_create('${id(10)}','${id(100)}',app_private.business_today()+1,80,null,null)`),'22023');
 await denied(f.db.query(`select aura_assessment_create('${id(10)}','${id(100)}',app_private.business_today(),80.001,null,null)`),'22023');
 await denied(f.db.query(`insert into assessments(organization_id,client_id,recorded_by,weight_kg,student_visible) values('${id(10)}','${id(100)}','${id(2)}',80,true)`));
 await denied(f.db.query(`insert into assessments(organization_id,client_id,recorded_by,weight_kg,created_at) values('${id(10)}','${id(100)}','${id(2)}',80,'2000-01-01')`));
 await f.db.query(measurement(5));assert.equal((await f.db.query<{recorded_by:string}>('select recorded_by from assessments')).rows[0].recorded_by,id(2));
 const day=(await f.db.query<{d:string}>(`select app_private.business_today()::text d`)).rows[0].d;
 const dash=(await f.db.query<{x:{as_of:string;care_date:string}}>(`select aura_care_dashboard('${id(10)}') x`)).rows[0].x;
 assert.equal(dash.as_of,day);assert.equal(dash.care_date,day);
 }finally{await f.db.close();}
});
test('privacy preferences are append-only, subject-only and requests are reviewable without deletion',async()=>{
 const f=await foundationFixture();try{
 await link(f);await f.asUser(1);await denied(f.db.query(`select aura_consent_set('${id(10)}','${id(100)}','progress_photos','synthetic-v1',true)`));
 await f.asUser(4);await f.db.query(`select aura_consent_set('${id(10)}','${id(100)}','progress_photos','synthetic-v1',true)`);
 await f.db.query(`select aura_consent_set('${id(10)}','${id(100)}','progress_photos','synthetic-v1',false)`);
 const req=(await f.db.query<{id:string}>(`select aura_privacy_request_create('${id(10)}','${id(100)}','erasure') id`)).rows[0].id;
 await denied(f.db.query(`select aura_privacy_request_create('${id(10)}','${id(100)}','erasure')`),'PT409');
 await denied(f.db.query(`select aura_privacy_review('${id(10)}','${req}','in_review','Synthetic reference',1)`));
 await f.asUser(1);await f.db.query(`select aura_privacy_review('${id(10)}','${req}','blocked','Legal review required',1)`);
 await denied(f.db.query(`select aura_privacy_review('${id(10)}','${req}','in_review','Synthetic reference',1)`),'PT409');
 assert.equal((await f.db.query('select * from clients')).rows.length,2);
 await f.asUser(4);const ctx=(await f.db.query<{x:{consents:{accepted:boolean}[];requests:{status:string}[]}}>(`select aura_privacy_context('${id(10)}','${id(100)}') x`)).rows[0].x;
 assert.equal(ctx.consents[0].accepted,false);assert.equal(ctx.requests[0].status,'blocked');
 await f.db.exec(`reset role`);assert.equal((await f.db.query('select * from app_private.consent_records')).rows.length,2);
 }finally{await f.db.close();}
});
test('retention is unconfigured by default, owner-reviewed and dry-run only',async()=>{
 const f=await foundationFixture();try{
 await f.asUser(1);let preview=(await f.db.query<{x:{configured:boolean;automatic_deletion:boolean;candidate_count:number}}>(`select aura_retention_preview('${id(10)}') x`)).rows[0].x;
 assert.equal(preview.configured,false);assert.equal(preview.automatic_deletion,false);
 await f.asUser(3);await denied(f.db.query(`select aura_retention_save('${id(10)}',30,'Synthetic review')`));
 await f.asUser(1);await f.db.query(`select aura_retention_save('${id(10)}',3,'Synthetic review')`);
 await f.db.exec(`reset role;update clients set archived_at=now()-interval '5 days' where id='${id(100)}'`);
 await f.asUser(1);preview=(await f.db.query<{x:typeof preview}>(`select aura_retention_preview('${id(10)}') x`)).rows[0].x;assert.equal(preview.candidate_count,1);
 assert.equal((await f.db.query('select * from clients')).rows.length,2);
 }finally{await f.db.close();}
});
test('full migrations replay safely and historical hashes remain intact',async()=>{
 const f=await foundationFixture();try{
 await f.db.exec((await migrationBundle()).replace('create extension if not exists pgcrypto;',''));
 assert.equal((await f.db.query<{n:number}>('select count(*)::int n from app_private.aura_migrations')).rows[0].n,10);
 const anon=(await f.db.query<{allowed:boolean}>("select has_table_privilege('authenticated','app_private.aura_migrations','SELECT') allowed")).rows[0].allowed;assert.equal(anon,false);
 const exposed=(await f.db.query<{n:number}>("select count(*)::int n from pg_proc p join pg_namespace n on p.pronamespace=n.oid where n.nspname='public' and p.proname like 'aura_%' and p.prosecdef")).rows[0].n;assert.equal(exposed,0);
 }finally{await f.db.close();}
});
test('synthetic backup/restore verifies checksum, migration registry and restored authorization',async()=>{
 const f=await foundationFixture();try{
 await f.grant(2,100);await link(f);await f.asUser(2);await f.db.query(measurement());await f.db.exec('reset role');
 const snapshot=await snapshotLocalDevelopment(f.db);
 const bad=new Uint8Array(snapshot.bytes);bad[0]^=1;await assert.rejects(restoreLocalDevelopment(bad,snapshot.manifest),/integrity/);
 const restored=await restoreLocalDevelopment(snapshot.bytes,snapshot.manifest);try{
 assert.equal((await restored.query('select * from assessments')).rows.length,1);
 await restored.exec(`set role authenticated;select set_config('request.jwt.claim.sub','${id(3)}',false)`);
 assert.equal((await restored.query('select * from assessments')).rows.length,0);
 await restored.exec(`select set_config('request.jwt.claim.sub','${id(2)}',false)`);assert.equal((await restored.query('select * from assessments')).rows.length,1);
 }finally{await restored.close();}
 }finally{await f.db.close();}
});
test('student invitations expire, replacement revokes old links and lost creator authority blocks acceptance',async()=>{
 const f=await foundationFixture();try{
 await f.asUser(1);const invite=async()=> (await f.db.query<{t:string}>(`select aura_student_invite_create('${id(10)}','${id(100)}','student@example.invalid') t`)).rows[0].t;
 const old=await invite(),current=await invite();await f.asUser(4);await denied(f.db.query(`select aura_student_invite_accept('${old}')`));
 await f.db.exec(`reset role;update app_private.student_invitations set expires_at=now()-interval '1 second' where token_hash=encode(sha256(convert_to('${current}','UTF8')),'hex')`);
 await f.asUser(4);await denied(f.db.query(`select aura_student_invite_accept('${current}')`));
 await f.asUser(3);const fromAdmin=await invite();await f.asUser(1);await f.db.query(`select aura_team_change('${id(10)}','${id(3)}','coach')`);
 await f.asUser(4);await denied(f.db.query(`select aura_student_invite_accept('${fromAdmin}')`));
 }finally{await f.db.close();}
});
test('agenda commands enforce assignment revocation and care history filters each competency',async()=>{
 const f=await foundationFixture();try{
 await f.grant(2,100);await f.asUser(2);
 await f.db.query(`select aura_followup_save('${id(10)}','${id(100)}','Synthetic goal','active',null,null,0)`);
 const appt=(await f.db.query<{id:string}>(`select aura_appointment_save('${id(10)}',null,'${id(100)}','${id(2)}','session','scheduled',now()+interval '1 day',now()+interval '1 day 1 hour',0) id`)).rows[0].id;
 await f.asUser(1);await f.db.query(`select aura_capability_save('${id(10)}','${id(2)}','schedule',false,false)`);
 await f.asUser(2);const events=(await f.db.query<{action:string}>(`select * from aura_care_history('${id(10)}','${id(100)}',0)`)).rows;
 assert.equal(events.length,1);assert.equal(events[0].action,'followup_created');
 await denied(f.db.query(`select aura_appointment_save('${id(10)}','${appt}','${id(100)}','${id(2)}','session','cancelled',now()+interval '1 day',now()+interval '1 day 1 hour',1)`));
 await f.asUser(1);await f.db.query(`select aura_assignment_save('${id(10)}','${id(100)}','${id(2)}',false)`);
 await f.asUser(2);await denied(f.db.query(`select * from aura_care_history('${id(10)}','${id(100)}',0)`));
 }finally{await f.db.close();}
});
