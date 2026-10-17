import {test} from 'node:test';
import assert from 'node:assert/strict';
import {foundationFixture,id} from './foundation-fixture';
const org=id(10),pupil=id(100),denied=(p:Promise<unknown>,code='42501')=>assert.rejects(p,(e:unknown)=>(e as {code:string}).code===code);
async function link(f:Awaited<ReturnType<typeof foundationFixture>>){await f.asUser(1);const t=(await f.db.query<{t:string}>(`select aura_student_invite_create('${org}','${pupil}','student@example.invalid') t`)).rows[0].t;await f.asUser(4);await f.db.query('select aura_student_invite_accept($1)',[t]);}

test('reproduces historical privacy disclosure; incremental projection limits pupil to own requests and consents',async()=>{
 const f=await foundationFixture('20261016221754_nutritrack_measurement_bridge.sql');try{
  await link(f);await f.db.query(`select aura_privacy_request_create('${org}','${pupil}','erasure')`);
  await f.asUser(1);await f.db.query(`select aura_privacy_request_create('${org}','${pupil}','export')`);
  await f.asUser(4);const read=async()=>(await f.db.query<{x:any}>(`select aura_privacy_context('${org}','${pupil}') x`)).rows[0].x;
  assert.equal((await read()).requests.length,2,'confirmed pre-fix disclosure');
  await f.db.exec('reset role');const {migrationBundle}=await import('../scripts/migration-bundle');await f.db.exec((await migrationBundle()).replace('create extension if not exists pgcrypto;',''));
  await f.db.query(`insert into app_private.consent_records(organization_id,client_id,actor_id,purpose,document_version,accepted) values('${org}','${pupil}','${id(8)}','progress_photos','old-other-identity',true)`);
  await f.asUser(4);const own=await read();assert.equal(own.requests.length,1);assert.equal(own.requests[0].kind,'erasure');assert.deepEqual(own.consents,[]);assert.equal(own.can_review,false);
  assert.deepEqual(Object.keys(own.requests[0]).sort(),['created_at','id','kind','revision','status']);
  for(const actor of [2,5,7,8]){await f.asUser(actor);await denied(read());}
  for(const actor of [1,3]){await f.asUser(actor);assert.equal((await read()).requests.length,2);assert.equal((await read()).can_review,true);}
  await f.asUser(1);await f.db.query(`select aura_student_revoke('${org}','${pupil}')`);await f.asUser(4);await denied(read());
 }finally{await f.db.close();}
});

test('privacy reviews are versioned append-only, tenant scoped and never visible to pupil or coach',async()=>{
 const f=await foundationFixture();try{
  await link(f);const request=(await f.db.query<{id:string}>(`select aura_privacy_request_create('${org}','${pupil}','erasure') id`)).rows[0].id;
  const review=(rev:number,status:string,reference:string)=>f.db.query(`select aura_privacy_review('${org}',$1,$2,$3,$4)`,[request,status,reference,rev]);
  await denied(review(1,'blocked','Student bypass'));await f.asUser(3);await review(1,'in_review','Synthetic reference one');await denied(review(1,'blocked','Stale reference'),'PT409');await review(2,'blocked','Synthetic reference two');
  const history=()=>f.db.query<{x:any}>(`select aura_privacy_review_history('${org}','${pupil}',$1) x`,[request]);assert.equal((await history()).rows[0].x.length,2);
  await denied(f.db.query(`select aura_privacy_review_history('${org}','${id(101)}',$1)`,[request]));
  for(const actor of [2,4,5,7]){await f.asUser(actor);await denied(history());await denied(review(3,'in_review','Unauthorized reference'));}
  await f.asUser(4);const ctx=(await f.db.query<{x:any}>(`select aura_privacy_context('${org}','${pupil}') x`)).rows[0].x;assert.ok(!JSON.stringify(ctx).includes('Synthetic reference'));assert.equal(ctx.requests[0].status,'blocked');
  await f.db.exec('reset role');assert.equal((await f.db.query('select * from clients')).rows.length,3);assert.equal((await f.db.query('select * from app_private.privacy_reviews')).rows.length,2);
 }finally{await f.db.close();}
});

test('opt-in sensitive MFA requires live AAL2, verified factor, recent TOTP and owner; old JWT loses authority on removal',async()=>{
 const f=await foundationFixture();try{
  // Only these test tables emulate Auth; separate real GoTrue tests are required.
  await f.db.exec(`create table auth.sessions(id uuid,user_id uuid,not_after timestamptz);create table auth.mfa_factors(user_id uuid,status text,factor_type text);
  insert into auth.sessions values('${id(999)}','${id(1)}',null);insert into auth.mfa_factors values('${id(1)}','verified','totp');`);
  const claims=async(aal='aal2',seconds=0,session=id(999))=>f.db.query(`select set_config('request.jwt.claims',$1,false)`,[JSON.stringify({aal,session_id:session,amr:[{method:'totp',timestamp:Math.floor(Date.now()/1000)-seconds}]})]);
  await f.asUser(1);const save=(required:boolean,revision:number)=>f.db.query(`select aura_security_policy_save('${org}',$1,$2)`,[required,revision]);
  await denied(save(true,0),'PT403');await claims();await save(true,0);await denied(save(true,0),'PT409');
  await claims('aal1');await denied(f.db.query(`select aura_capability_save('${org}','${id(2)}','profile',true,true)`),'PT403');
  await claims('aal2',601);await denied(save(false,1),'PT403');await claims('aal2',0,id(998));await denied(save(false,1),'PT403');
  await claims();await f.db.query(`select aura_capability_save('${org}','${id(2)}','profile',true,true)`);
  await denied(f.db.query(`select app_private.capability_save_sensitive_base('${org}','${id(2)}','profile',true,true)`));
  await f.asUser(3);await denied(save(false,1));await f.asUser(1);await claims();
  await f.db.exec('reset role');await f.db.query(`update auth.sessions set not_after=now()-interval '1 second'`);await f.asUser(1);await denied(save(false,1),'PT403');
  await f.db.exec(`reset role;update auth.sessions set not_after=null;delete from auth.mfa_factors`);await f.asUser(1);await denied(save(false,1),'PT403');
  await f.db.exec(`reset role;insert into auth.mfa_factors values('${id(1)}','verified','totp');delete from organization_members where organization_id='${org}' and user_id='${id(1)}'`);await f.asUser(1);await denied(save(false,1));
 }finally{await f.db.close();}
});

test('opt-in MFA protects raw pupil data reads, student projections and privacy; logout still denies a signed AAL2 session',async()=>{
 const f=await foundationFixture();try{
  await f.grant(2,100);await link(f);await f.asUser(2);
  const assessment=(await f.db.query<{id:string}>(`select aura_assessment_create('${org}','${pupil}',app_private.business_today(),80,null,null) id`)).rows[0].id;
  await f.db.query(`select aura_assessment_share('${org}',$1,true,1)`,[assessment]);
  await f.db.exec(`reset role;create table auth.sessions(id uuid,user_id uuid,not_after timestamptz);create table auth.mfa_factors(user_id uuid,status text,factor_type text);
  insert into auth.sessions values('${id(999)}','${id(1)}',null),('${id(998)}','${id(2)}',null);insert into auth.mfa_factors values('${id(1)}','verified','totp'),('${id(2)}','verified','totp');`);
  const claims=(sid:string)=>f.db.query(`select set_config('request.jwt.claims',$1,false)`,[JSON.stringify({aal:'aal2',session_id:sid,amr:[{method:'totp',timestamp:Math.floor(Date.now()/1000)}]})]);
  await f.asUser(1);await claims(id(999));await f.db.query(`select aura_security_policy_save('${org}',true,0)`);
  await f.asUser(2);assert.equal((await f.db.query('select * from assessments')).rows.length,0);assert.equal((await f.db.query('select * from clients')).rows.length,0);
  await claims(id(998));assert.equal((await f.db.query('select * from assessments')).rows.length,1);
  await f.asUser(4);await denied(f.db.query(`select * from aura_student_assessments('${org}','${pupil}',0)`));await denied(f.db.query(`select aura_privacy_context('${org}','${pupil}')`),'PT403');
  await f.asUser(2);await claims(id(998));await f.db.exec(`reset role;delete from auth.sessions where id='${id(998)}'`);await f.asUser(2);assert.equal((await f.db.query('select * from assessments')).rows.length,0);
  await denied(f.db.query(`select app_private.privacy_context_session_base('${org}','${pupil}')`));
 }finally{await f.db.close();}
});
