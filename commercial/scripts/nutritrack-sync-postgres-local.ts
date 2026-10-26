/** Isolated PostgreSQL proof only: no network, ports, host mounts or cloud URLs. */
import {spawn} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {migrationBundle} from './migration-bundle';
import {syncCandidateFile} from './nutritrack-sync-permissions-artifacts';
const image='postgres:17.11-alpine',label='nutritrack-sync-permissions';
const id=(n:number)=>`00000000-0000-0000-0000-${String(n).padStart(12,'0')}`;
function docker(args:string[],input=''){return new Promise<string>((resolve,reject)=>{
 const child=spawn('docker',['--host=unix:///var/run/docker.sock',...args],{stdio:['pipe','pipe','pipe']});let out='',err='';
 child.stdout.on('data',c=>out+=c);child.stderr.on('data',c=>err+=c);child.on('error',reject);
 child.on('close',code=>code===0?resolve(out.trim()):reject(Error(err.trim()||`Docker exit ${code}`)));child.stdin.on('error',()=>{});child.stdin.end(input);
});}
async function main(){
 if(process.env.AURA_SYNC_LOCAL_POSTGRES!=='1')throw Error('Explicit local-only opt-in required');
 for(const key of ['DOCKER_HOST','DOCKER_CONTEXT','DOCKER_TLS','DOCKER_TLS_VERIFY','DOCKER_CERT_PATH'])if(process.env[key])throw Error('Docker endpoint/TLS selectors forbidden for this local harness');
 await docker(['info','--format','{{.ServerVersion}}']);
 const imageId=await docker(['image','inspect',image,'--format','{{.Id}}']); // Never pull inside this runner.
 const container=await docker(['run','--pull=never','--detach','--rm','--network','none','--read-only','--label','aura.local-test='+label,'--name','aura-sync-local-'+randomUUID(),'--user','postgres','--tmpfs','/tmp:rw,nosuid,mode=1777,size=256m','--entrypoint','/bin/sh',imageId,'-c','exec sleep 900']);
 const sql=(text:string)=>docker(['exec','-i',container,'psql','-h','/tmp','-U','postgres','-d','postgres','-X','-q','-A','-t','-v','ON_ERROR_STOP=1','-v','VERBOSITY=verbose'],text);
 const actor=(n:number)=>`set "request.jwt.claim.sub"='${id(n)}';set "request.jwt.claims"='${JSON.stringify({sub:id(n),session_id:id(900+n),aal:'aal1'})}';set role authenticated;`;
 const consent=(expected:number,revoke=false)=>`select aura_nutritrack_sync_consent('${id(10)}','${id(100)}',${expected},${revoke?"array[]::text[]":"array['nutrition-plan','nutrition-entry']"},${revoke?'null':"statement_timestamp()+interval '30 days'"},${revoke});`;
 const allowed=(link:string)=>sql(actor(2)+`select app_private.nutritrack_sync_allowed('${link}','plan-publish');`);
 const marker=async(n:number)=>{for(let i=0;i<50;i++){if(await sql(`select exists(select 1 from pg_locks where locktype='advisory' and objid=${n} and granted);`)==='t')return;await new Promise(r=>setTimeout(r,20));}throw Error('Local lock marker not observed');};
 try{
  const d=JSON.parse(await docker(['inspect',container,'--format','{{json .}}']));
  assert.equal(d.HostConfig.NetworkMode,'none');assert.equal(d.HostConfig.ReadonlyRootfs,true);assert.deepEqual(d.HostConfig.PortBindings,{});assert.ok(!d.Mounts.some((m:{Type:string})=>m.Type==='bind'));
  await docker(['exec',container,'initdb','-D','/tmp/aura-pg','--auth=trust','--no-locale','--encoding=UTF8']);
  await docker(['exec','--detach',container,'postgres','-D','/tmp/aura-pg','-k','/tmp','-c','listen_addresses=','-c','shared_buffers=16MB']);
  let ready=false;for(let i=0;i<40;i++){try{await sql('select 1;');ready=true;break;}catch{await new Promise(r=>setTimeout(r,100));}}assert.ok(ready);
  await sql(`create role anon;create role authenticated;create schema auth;
   create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,is_anonymous boolean default false,deleted_at timestamptz,banned_until timestamptz);
   create table auth.sessions(id uuid primary key,user_id uuid,not_after timestamptz);create table auth.mfa_factors(user_id uuid,status text,factor_type text);
   create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
   grant usage on schema public,auth to anon,authenticated;grant execute on function auth.uid() to anon,authenticated;`);
  await sql(await migrationBundle());
  await sql('begin;'+await readFile(new URL('../supabase/local-validation/nutritrack-sync/'+syncCandidateFile,import.meta.url),'utf8')+'commit;');
  await sql(`insert into auth.users(id,email,email_confirmed_at) values('${id(1)}','owner@example.invalid',now()),('${id(2)}','professional@example.invalid',now()),('${id(4)}','pupil@example.invalid',now());
   insert into auth.sessions values('${id(901)}','${id(1)}',null),('${id(902)}','${id(2)}',null),('${id(904)}','${id(4)}',null);
   insert into organizations(id,name) values('${id(10)}','Synthetic establishment');
   insert into organization_members(organization_id,user_id,role) values('${id(10)}','${id(1)}','owner'),('${id(10)}','${id(2)}','coach');
   insert into clients(id,organization_id,full_name) values('${id(100)}','${id(10)}','Synthetic pupil');
   insert into client_users(organization_id,client_id,user_id) values('${id(10)}','${id(100)}','${id(4)}');`);
  await sql(actor(1)+`select aura_capability_save('${id(10)}','${id(2)}','profile',true,true);select aura_assignment_save('${id(10)}','${id(100)}','${id(2)}',true);select aura_nutrition_capability_save('${id(10)}','${id(2)}',true,true);`);
  const first=await sql(actor(2)+`select aura_nutritrack_sync_propose('${id(10)}','${id(100)}');`);await sql(actor(4)+consent(0));assert.equal(await allowed(first),'t');
  const race=await Promise.allSettled([sql(actor(4)+consent(1)),sql(actor(1)+consent(1,true))]);
  assert.equal(race.filter(r=>r.status==='fulfilled').length,1);assert.equal(race.filter(r=>r.status==='rejected'&&/PT409/.test(String(r.reason))).length,1);
  assert.equal(await sql('select count(*) from app_private.nutritrack_sync_consents;'),'2');
  await sql(`create function app_private.synthetic_sync_failure() returns trigger language plpgsql as $$begin if new.action='sync_consent_accepted' then raise exception using errcode='23514',message='Synthetic late failure';end if;return new;end;$$;create trigger synthetic_sync_failure before insert on app_private.foundation_events for each row execute function app_private.synthetic_sync_failure();`);
  await assert.rejects(sql(actor(4)+consent(2)),/23514/);assert.equal(await sql('select count(*) from app_private.nutritrack_sync_consents;'),'2');await sql('drop trigger synthetic_sync_failure on app_private.foundation_events;');
  const revoke=sql('begin;'+actor(1)+`select aura_student_revoke('${id(10)}','${id(100)}');select pg_advisory_xact_lock(640020);select pg_sleep(2);commit;`);
  void revoke.catch(()=>{});await marker(640020);await assert.rejects(sql(actor(4)+consent(2)),/42501/);await revoke;
  assert.equal(await allowed(first),'f');assert.equal(await sql('select count(*) from app_private.nutritrack_sync_consents;'),'2');
  await sql(`update client_users set revoked_at=null where client_id='${id(100)}';`);
  const second=await sql(actor(2)+`select aura_nutritrack_sync_propose('${id(10)}','${id(100)}');`);assert.notEqual(second,first);assert.equal(await allowed(second),'f');await sql(actor(4)+consent(0));
  const logout=sql(`begin;select 1 from organizations where id='${id(10)}' for update;delete from auth.sessions where id='${id(904)}';select pg_advisory_xact_lock(640021);select pg_sleep(2);commit;`);
  void logout.catch(()=>{});await marker(640021);await assert.rejects(sql(actor(4)+consent(1)),/42501/);await logout;
  assert.equal(await sql('select count(*) from app_private.nutritrack_sync_consents;'),'3');
  await sql(`insert into auth.sessions values('${id(904)}','${id(4)}',null);delete from client_users where client_id='${id(100)}';insert into client_users(organization_id,client_id,user_id) values('${id(10)}','${id(100)}','${id(4)}');`);
  assert.equal(await allowed(first),'f');assert.equal(await allowed(second),'f');
  const third=await sql(actor(2)+`select aura_nutritrack_sync_propose('${id(10)}','${id(100)}');`);assert.notEqual(third,second);assert.equal(await allowed(third),'f');await sql(actor(4)+consent(0));assert.equal(await allowed(third),'t');
  await sql(`delete from auth.users where id='${id(4)}';`);assert.equal(await allowed(third),'f');
  console.log(JSON.stringify({postgres:await sql('show server_version;'),imageId,network:'none',hostMounts:false,ports:false,readOnlyRoot:true,
   concurrentConsentCAS:'one commit, one PT409',auditRollback:'passed',bindingRevocationBeforeWaitingConsent:'denied',sessionRevocationBeforeWaitingConsent:'denied',sameAccountRelink:'new link and consent required',authDeletion:'not blocked; access denied',auth:'simulated rows/claims; not GoTrue/PostgREST',remoteSQL:false}));
 }finally{
  const actual=await docker(['inspect',container,'--format','{{index .Config.Labels "aura.local-test"}}']);if(actual!==label)throw Error('Refusing to stop unrecognized container');
  await docker(['stop',container]);
 }
}
void main().catch(e=>{console.error(e);process.exitCode=1;});
