import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {foundationFixture,id} from './foundation-fixture';
import {nutritionAccess,deny} from './nutrition-db-fixture';

const candidate=new URL('../supabase/local-validation/nutritrack-sync/20261025234116_nutritrack_sync_permissions.sql',import.meta.url);
const org=id(10),client=id(100);
async function fixture(){
 const f=await foundationFixture();
 await f.db.exec(`alter table auth.users add column is_anonymous boolean default false;
 alter table auth.users add column deleted_at timestamptz;alter table auth.users add column banned_until timestamptz;
 create table auth.sessions(id uuid primary key,user_id uuid not null,not_after timestamptz);
 create table auth.mfa_factors(user_id uuid,status text,factor_type text);
 insert into auth.sessions select ('00000000-0000-0000-0000-'||lpad((900+right(id::text,3)::int)::text,12,'0'))::uuid,id,null from auth.users;
 insert into client_users(organization_id,client_id,user_id) values
 ('${org}','${client}','${id(4)}'),('${org}','${id(101)}','${id(8)}'),('${id(20)}','${id(200)}','${id(5)}');`);
 // Auth is simulated only in this ephemeral fixture; no real accounts or API.
 await f.db.exec('begin;'+await readFile(candidate,'utf8')+'commit;');
 const actor=async(n:number)=>{await f.asUser(n);await f.db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({sub:id(n),session_id:id(900+n),aal:'aal1'})]);};
 const context=async(c=client,o=org)=>(await f.db.query<{x:any}>('select aura_nutritrack_sync_context($1,$2) x',[o,c])).rows[0].x;
 const propose=async(c=client,o=org)=>(await f.db.query<{x:string}>('select aura_nutritrack_sync_propose($1,$2) x',[o,c])).rows[0].x;
 const consent=async(expected:number,scopes:string[]=['nutrition-plan','nutrition-entry'],revoke=false,c=client,o=org)=>(await f.db.query<{x:any}>(`select aura_nutritrack_sync_consent($1,$2,$3,$4::text[],case when $5 then null else statement_timestamp()+interval '30 days' end,$5) x`,[o,c,expected,scopes,revoke])).rows[0].x;
 const allowed=async(link:string,operation:string)=>(await f.db.query<{x:boolean}>('select app_private.nutritrack_sync_allowed($1,$2) x',[link,operation])).rows[0].x;
 const professional=async(write=true)=>{await nutritionAccess(f,write);await actor(2);};
 return {...f,actor,context,propose,consent,allowed,professional};
}

test('sync proposal grants nothing implicitly; only linked pupil can accept and SQL derives the account',async()=>{
 const f=await fixture();try{
  for(const n of [1,3,4,5,7]){await f.actor(n);await deny(f.propose());}
  await f.professional();const link=await f.propose();assert.equal(await f.propose(),link);
  let c=await f.context();assert.equal(c.state,'awaiting-consent');assert.equal(c.canPublishPlan,false);
  await deny(f.consent(0));await f.actor(4);c=await f.context();assert.equal(c.revision,0);assert.equal(c.canReadPlan,false);
  await f.consent(0);c=await f.context();assert.equal(c.canReadPlan,true);assert.equal(c.canSubmitEntry,true);assert.equal(c.canPublishPlan,false);
  await f.professional();c=await f.context();assert.equal(c.canPublishPlan,true);assert.equal(c.canSubmitEntry,false);assert.equal(c.canReviewEntry,true);
  await f.db.exec('reset role');const rows=(await f.db.query<{account_id:string;proposed_by:string}>('select * from app_private.nutritrack_sync_links')).rows;
  assert.equal(rows.length,1);assert.equal(rows[0].account_id,id(4));assert.equal(rows[0].proposed_by,id(2));
  assert.equal((await f.db.query("select * from app_private.foundation_events where action='sync_link_proposed'")).rows.length,1);
 }finally{await f.db.close();}
});

test('consent scopes and directions are separate, CAS rejects stale replay without duplicating consent and rejects malformed scope/TTL',async()=>{
 const f=await fixture();try{
  await f.professional();const link=await f.propose();await f.actor(4);await f.consent(0,['measurement']);
  assert.equal(await f.allowed(link,'measurement-submit'),true);for(const op of ['plan-read','entry-submit','plan-publish','measurement-review','unknown'])assert.equal(await f.allowed(link,op),false);
  await deny(f.consent(0,['nutrition-plan']),'PT409');assert.equal((await f.context()).revision,1);
  for(const scopes of [[],['nutrition-plan','nutrition-plan'],['profile'],['MEASUREMENT'],[null as unknown as string]])await deny(f.consent(1,scopes),'22023');
  for(const interval of ["'-1 day'","'91 days'"])await deny(f.db.query(`select aura_nutritrack_sync_consent($1,$2,1,array['nutrition-plan'],statement_timestamp()+interval ${interval},false)`,[org,client]),'22023');
  await f.professional();assert.equal(await f.allowed(link,'measurement-read'),false);assert.equal(await f.allowed(link,'measurement-review'),false);
  await f.grant(2,100,['assessments']);await f.actor(2);assert.equal(await f.allowed(link,'measurement-read'),true);assert.equal(await f.allowed(link,'measurement-submit'),false);assert.equal(await f.allowed(link,'measurement-review'),true);
  await f.professional(false);assert.equal(await f.allowed(link,'measurement-read'),true);assert.equal(await f.allowed(link,'measurement-review'),false);
  await f.actor(4);assert.equal((await f.context()).revision,1);
 }finally{await f.db.close();}
});

test('tenant, other pupil, assignment and replacement identity never inherit an existing consent',async()=>{
 const f=await fixture();try{
  await f.professional();const link=await f.propose();await f.actor(4);await f.consent(0);
  for(const n of [1,3,5,7,8]){await f.actor(n);assert.equal(await f.allowed(link,'plan-read'),false);await deny(f.context());if(![1,3].includes(n))await deny(f.consent(1,[],true));assert.equal((await f.db.query('select * from app_private.nutritrack_sync_links')).rows.length,0);}
  await f.actor(4);await deny(f.context(id(200),id(20)));await deny(f.context(id(101)));assert.equal(await f.allowed(id(9999),'plan-read'),false);
  await f.db.exec(`reset role;update client_users set revoked_at=now() where client_id='${client}'`);await f.actor(4);await deny(f.context());assert.equal(await f.allowed(link,'entry-submit'),false);
  await f.db.exec(`reset role;delete from client_users where client_id in ('${client}','${id(101)}');insert into client_users(organization_id,client_id,user_id) values('${org}','${client}','${id(8)}')`);
  await f.professional();assert.equal(await f.allowed(link,'plan-read'),false);const replacement=await f.propose();assert.notEqual(replacement,link);
  await f.actor(8);assert.equal((await f.context()).revision,0);assert.equal(await f.allowed(replacement,'plan-read'),false);
  await f.actor(4);await deny(f.context());
 }finally{await f.db.close();}
});

test('deleted, expired, wrong-account or missing live session denies context and mutation even with valid-looking claims',async()=>{
 const f=await fixture();try{
  await f.professional();await f.propose();await f.actor(4);await f.consent(0);
  for(const changes of [{session_id:id(902)},{session_id:id(9999)},{session_id:'bad'},{session_id:null}]){
   await f.db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({sub:id(4),aal:'aal2',...changes})]);await deny(f.context());await deny(f.consent(1));
  }
  await f.actor(4);await f.db.exec(`reset role;update auth.sessions set not_after=now()-interval '1 second' where id='${id(904)}'`);await f.actor(4);await deny(f.context());
  await f.db.exec(`reset role;update auth.sessions set not_after=null where id='${id(904)}';delete from auth.sessions where id='${id(904)}'`);await f.actor(4);await deny(f.context());
 }finally{await f.db.close();}
});

test('anonymous, unconfirmed, banned and deleted identities cannot consent or read; opt-in MFA remains enforced',async()=>{
 const f=await fixture();try{
  await f.professional();await f.propose();await f.actor(4);await f.consent(0);
  for(const [column,value,reset] of [['is_anonymous','true','false'],['email_confirmed_at','null','now()'],['banned_until',"now()+interval '1 day'",'null'],['deleted_at','now()','null']]){
   await f.db.exec(`reset role;update auth.users set ${column}=${value} where id='${id(4)}'`);await f.actor(4);await deny(f.context());await deny(f.consent(1));await f.actor(2);await deny(f.context());await deny(f.propose());await f.db.exec(`reset role;update auth.users set ${column}=${reset} where id='${id(4)}'`);
  }
  await f.db.exec(`insert into app_private.organization_security values('${org}',true,1,'${id(1)}',now());insert into auth.mfa_factors values('${id(4)}','verified','totp')`);
  await f.actor(4);await deny(f.context());
  const claims=(age:number)=>JSON.stringify({sub:id(4),session_id:id(904),aal:'aal2',amr:[{method:'totp',timestamp:Math.floor(Date.now()/1000)-age}]});
  await f.db.query("select set_config('request.jwt.claims',$1,false)",[claims(0)]);assert.equal((await f.context()).canReadPlan,true);
  await f.db.query("select set_config('request.jwt.claims',$1,false)",[claims(700)]);await deny(f.context());
 }finally{await f.db.close();}
});

test('revocation and expiration block delivery permissions without erasing history or permitting an admin to grant',async()=>{
 const f=await fixture();try{
  await f.professional();const link=await f.propose();await f.actor(4);await f.consent(0);
  await f.actor(1);await deny(f.consent(1,['measurement']));await f.consent(1,[],true);
  await f.actor(4);assert.equal((await f.context()).state,'revoked');assert.equal(await f.allowed(link,'entry-submit'),false);await deny(f.consent(1),'PT409');
  await f.consent(2,['nutrition-plan']);assert.equal((await f.context()).revision,3);
  await f.db.exec(`reset role;insert into app_private.nutritrack_sync_consents values('${link}',4,'active',array['nutrition-plan'],now()-interval '1 second','${id(4)}',now()-interval '1 day')`);
  await f.actor(4);assert.equal((await f.context()).state,'expired');assert.equal(await f.allowed(link,'plan-read'),false);assert.equal((await f.db.query('select * from app_private.nutritrack_sync_consents')).rows.length,4);
  await f.professional();assert.equal(await f.allowed(link,'plan-publish'),false);
 }finally{await f.db.close();}
});

test('private table DML and anonymous RPCs stay denied; public wrappers cannot bypass the live checks',async()=>{
 const f=await fixture();try{
  await f.professional();const link=await f.propose();await f.actor(4);await f.consent(0);
  for(const sql of ["delete from app_private.nutritrack_sync_consents","update app_private.nutritrack_sync_links set account_id='"+id(8)+"'","insert into app_private.nutritrack_sync_consents select * from app_private.nutritrack_sync_consents"])await deny(f.db.exec(sql));
  await f.db.exec('reset role');await deny(f.db.exec('delete from app_private.nutritrack_sync_consents'),'55000');await deny(f.db.exec("update app_private.nutritrack_sync_links set account_id='"+id(8)+"'"),'55000');
  const functions=(await f.db.query<{schema:string;definer:boolean;anon:boolean}>(`select n.nspname schema,p.prosecdef definer,has_function_privilege('anon',p.oid,'execute') anon from pg_proc p join pg_namespace n on n.oid=p.pronamespace where p.proname like '%nutritrack_sync_%'`)).rows;
  assert.equal(functions.filter(x=>x.schema==='public').length,3);assert.ok(functions.every(x=>!x.anon));assert.ok(functions.filter(x=>x.schema==='public').every(x=>!x.definer));
  await f.db.exec("set role anon;select set_config('request.jwt.claim.sub','',false)");await deny(f.context());await deny(f.propose());await deny(f.db.query('select app_private.nutritrack_sync_allowed($1,\'plan-read\')',[link]));await deny(f.db.exec('select * from app_private.nutritrack_sync_consents'));
 }finally{await f.db.close();}
});

test('late audit failure rolls back consent; archive, removed assignment and member revocation fail closed',async()=>{
 const f=await fixture();try{
  await f.professional();const link=await f.propose();
  await f.db.exec(`reset role;create function app_private.synthetic_sync_audit_failure() returns trigger language plpgsql as $$begin if new.action='sync_consent_accepted' then raise exception using errcode='23514',message='Synthetic late failure';end if;return new;end;$$;create trigger synthetic_sync_failure before insert on app_private.foundation_events for each row execute function app_private.synthetic_sync_audit_failure();`);
  await f.actor(4);await deny(f.consent(0),'23514');assert.equal((await f.context()).revision,0);
  await f.db.exec('reset role;drop trigger synthetic_sync_failure on app_private.foundation_events');await f.actor(4);await f.consent(0);
  await f.db.exec(`reset role;delete from client_assignments where user_id='${id(2)}'`);await f.actor(2);assert.equal(await f.allowed(link,'plan-publish'),false);await deny(f.context());
  await f.professional();await f.db.exec(`reset role;delete from organization_members where user_id='${id(2)}'`);await f.actor(2);assert.equal(await f.allowed(link,'plan-publish'),false);
  await f.db.exec(`reset role;update clients set archived_at=now() where id='${client}'`);await f.actor(4);await deny(f.context());await deny(f.consent(1));assert.equal(await f.allowed(link,'entry-submit'),false);
 }finally{await f.db.close();}
});

test('offline candidate is not picked up by the existing installer or its reviewed 19-entry activation plan',async()=>{
 const f=await foundationFixture();try{
  assert.equal((await f.db.query('select * from app_private.aura_migrations')).rows.length,19);
  assert.equal((await f.db.query<{x:string|null}>("select to_regclass('app_private.nutritrack_sync_links') x")).rows[0].x,null);
 }finally{await f.db.close();}
});

test('deleting an Auth identity is not blocked by historical links and immediately removes both sides access',async()=>{
 const f=await fixture();try{
  await f.professional();const link=await f.propose();await f.actor(4);await f.consent(0);
  await f.db.exec(`reset role;delete from auth.users where id='${id(4)}'`);
  assert.equal((await f.db.query('select * from app_private.nutritrack_sync_consents')).rows.length,1);
  await f.actor(4);await deny(f.context());assert.equal(await f.allowed(link,'entry-submit'),false);
  await f.actor(2);await deny(f.context());assert.equal(await f.allowed(link,'plan-publish'),false);
 }finally{await f.db.close();}
});

test('relinking the SAME account after revocation or delete cannot revive an old consent, even with the same linked_at',async()=>{
 const f=await fixture();try{
  await f.professional();const first=await f.propose();await f.actor(4);await f.consent(0);
  await f.db.exec(`reset role;update client_users set revoked_at=now() where client_id='${client}';update client_users set revoked_at=null where client_id='${client}'`);
  await f.actor(2);assert.equal(await f.allowed(first,'plan-publish'),false);const second=await f.propose();assert.notEqual(first,second);
  await f.actor(4);assert.equal((await f.context()).revision,0);assert.equal(await f.allowed(second,'plan-read'),false);await f.consent(0);
  await f.db.exec(`reset role;delete from client_users where client_id='${client}';insert into client_users(organization_id,client_id,user_id) values('${org}','${client}','${id(4)}')`);
  await f.actor(2);assert.equal(await f.allowed(first,'plan-publish'),false);assert.equal(await f.allowed(second,'plan-publish'),false);const third=await f.propose();assert.notEqual(third,second);
  await f.actor(4);assert.equal((await f.context()).revision,0);assert.equal(await f.allowed(third,'entry-submit'),false);await f.consent(0);assert.equal(await f.allowed(third,'entry-submit'),true);
  await f.db.exec('reset role');await deny(f.db.query('update app_private.nutritrack_sync_links set invalidated_at=null where id=$1',[first]),'55000');
  assert.equal((await f.db.query('select * from app_private.nutritrack_sync_consents')).rows.length,3);
 }finally{await f.db.close();}
});
