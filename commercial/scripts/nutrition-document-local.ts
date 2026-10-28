/** Real PostgreSQL lock rehearsal in a disposable, network-less LOCAL container.
 * Does not test GoTrue, PostgREST or remote recovery. Refuses another container. */
import {spawn,execFileSync} from 'node:child_process';
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {migrationBundle} from './migration-bundle';
import {documentCommand,recipeBody} from '../tests/native-document-fixture';
import {id} from '../tests/foundation-fixture';
const container='aura-native-document-local',database='aura_native_document_rehearsal';
const taskEnv={...process.env};for(const key of ['DOCKER_HOST','DOCKER_CONTEXT','DOCKER_TLS','DOCKER_TLS_VERIFY','DOCKER_CERT_PATH'])delete taskEnv[key];
const docker=['--host=unix:///var/run/docker.sock'];
assert.equal(execFileSync('docker',[...docker,'inspect','--format','{{.HostConfig.NetworkMode}} {{index .Config.Labels "aura.scope"}}',container],{env:taskEnv,encoding:'utf8'}).trim(),'none native-document-local');
function sql(text:string,db=database){
 return new Promise<string>((resolve,reject)=>{
  const p=spawn('docker',[...docker,'exec','-i',container,'psql','-h','/var/run/postgresql','-U','postgres','-X','-v','ON_ERROR_STOP=1','-v','VERBOSITY=verbose','-At','-d',db],{env:taskEnv});
  let out='',err='';p.stdout.on('data',b=>{out+=b;});p.stderr.on('data',b=>{err+=b;});p.on('error',reject);p.on('close',code=>code===0?resolve(out):reject(new Error(err)));p.stdin.end(text);
 });
}
const literal=(value:unknown)=>"'"+JSON.stringify(value).replaceAll("'","''")+"'::jsonb";
const org=id(10),pupil=id(100);
const call=(value:unknown,name='')=>"set application_name='"+name+"';set role authenticated;select set_config('request.jwt.claim.sub','"+id(2)+"',false);select aura_nutrition_document_save('"+org+"','"+pupil+"',"+literal(value)+");";
const json=(out:string)=>JSON.parse(out.trim().split('\n').filter(line=>line.startsWith('{')).at(-1)!);
async function waitQuery(query:string){for(let n=0;n<40;n++){if((await sql(query)).trim()==='1')return;await new Promise(r=>setTimeout(r,50));}throw Error('Local synchronization timeout');}
async function main(){
 assert.match((await sql('show server_version;','postgres')).trim(),/^17\.11/);
 await sql('create database '+database+';','postgres');
 await sql("create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema public,auth to anon,authenticated;grant execute on function auth.uid() to anon,authenticated;");
 await sql(await migrationBundle());
 await sql("insert into auth.users values('"+id(1)+"','owner@example.invalid',now()),('"+id(2)+"','coach@example.invalid',now());insert into organizations(id,name) values('"+org+"','Synthetic document workspace');insert into organization_members(organization_id,user_id,role) values('"+org+"','"+id(1)+"','owner'),('"+org+"','"+id(2)+"','coach');insert into clients(id,organization_id,full_name) values('"+pupil+"','"+org+"','Synthetic pupil');set role authenticated;select set_config('request.jwt.claim.sub','"+id(1)+"',false);select aura_capability_save('"+org+"','"+id(2)+"','profile',true,true);select aura_assignment_save('"+org+"','"+pupil+"','"+id(2)+"',true);select aura_nutrition_capability_save('"+org+"','"+id(2)+"',true,true);");
 await sql('begin;'+await readFile(new URL('../supabase/prepared/20261028160819_nutrition_documents_native.sql',import.meta.url),'utf8')+'commit;');
 await sql("create function app_private.synthetic_document_pause() returns trigger language plpgsql as $$begin perform pg_sleep(0.5);return new;end;$$;create trigger synthetic_document_pause before insert on nutrition_document_versions for each row execute function app_private.synthetic_document_pause();");
 const command=documentCommand(4000),created=await Promise.all([sql(call(command)),sql(call(command))]),receipts=created.map(json),target=receipts[0].documentId;
 assert.equal(receipts[1].documentId,target);assert.deepEqual(receipts.map(r=>r.replayed).sort(),[false,true]);assert.equal((await sql('select count(*) from nutrition_documents;')).trim(),'1');
 const edit={...documentCommand(4001),documentId:target,expectedRevision:1,reason:'Corrigir exemplo'};
 const raced=await Promise.allSettled([sql(call(edit)),sql(call({...edit,requestId:id(4002),body:{...recipeBody(),title:'Outra correção'}}))]);
 assert.equal(raced.filter(r=>r.status==='fulfilled').length,1);assert.equal(raced.filter(r=>r.status==='rejected'&&r.reason.message.includes('PT409')).length,1);assert.equal((await sql('select current_revision from nutrition_documents;')).trim(),'2');
 const holder=sql("set application_name='aura-document-holder';begin;select id from nutrition_documents where id='"+target+"' for update;select pg_sleep(5);commit;");
 await waitQuery("select count(*) from pg_stat_activity where application_name='aura-document-holder' and wait_event='PgSleep';");
 const waiting=sql(call({...documentCommand(4003),documentId:target,expectedRevision:2,reason:'Revogação durante espera'},'aura-document-revoked')).then(()=>({denied:false}),error=>({denied:error.message.includes('42501')}));
 await waitQuery("select count(*) from pg_stat_activity where application_name='aura-document-revoked' and wait_event_type='Lock';");
 await sql("update nutrition_capabilities set can_write=false where organization_id='"+org+"' and user_id='"+id(2)+"';");
 await holder;assert.equal((await waiting).denied,true);assert.equal((await sql('select current_revision from nutrition_documents;')).trim(),'2');assert.equal((await sql('select count(*) from app_private.nutrition_document_events;')).trim(),'2');
 console.log(JSON.stringify({postgres:'17.11',network:'none',concurrentDuplicateRequests:'PASS: one event and replay',competingCorrections:'PASS: one revision and one conflict',revocationWhileWaitingForHead:'PASS: denied, no new version',auth:'mock uid only; no GoTrue/PostgREST',remoteAccess:false}));
}
main().catch(error=>{console.error(error);process.exitCode=1;});
