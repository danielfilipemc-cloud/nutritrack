/** Disposable local Docker PostgreSQL only. No URLs, mounted files, ports or cloud credentials. */
import {spawn} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
import {migrationBundle} from './migration-bundle';
import {id} from '../tests/foundation-fixture';
import {composition,baseline17} from '../tests/nutrition-db-fixture';
import {businessToday} from '../lib/care';

const image='public.ecr.aws/supabase/postgres:17.11.0.002';
let verifiedContext:string|undefined;
function docker(args:string[],stdin=''){
 return new Promise<string>((resolve,reject)=>{
  const child=spawn('docker',verifiedContext?['--context',verifiedContext,...args]:args,{stdio:['pipe','pipe','pipe'],windowsHide:true});let stdout='',stderr='';
  child.stdout.on('data',chunk=>stdout+=chunk);child.stderr.on('data',chunk=>stderr+=chunk);child.on('error',reject);
  child.on('close',code=>code===0?resolve(stdout.trim()):reject(new Error(stderr.trim()||`Docker exit ${code}`)));child.stdin.on('error',()=>{});child.stdin.end(stdin);
 });
}
async function main(){
 if(process.env.AURA_NUTRITION_LOCAL_POSTGRES!=='1')throw Error('Explicit local-only opt-in AURA_NUTRITION_LOCAL_POSTGRES=1 required');
 if(process.env.DOCKER_HOST)throw Error('DOCKER_HOST overrides forbidden; use a verified local Docker context');
 const context=await docker(['context','show']);
 const endpoint=JSON.parse(await docker(['context','inspect',context,'--format','{{json .Endpoints.docker.Host}}'])) as string;
 if(!endpoint.startsWith('npipe:')&&!endpoint.startsWith('unix:'))throw Error('Remote Docker endpoints forbidden');
 verifiedContext=context; // Pin every subsequent operation; do not follow later global context changes.
 const imageId=await docker(['image','inspect',image,'--format','{{.Id}}']); // Existing image only: never pull.
 const container=await docker(['run','--pull=never','--detach','--rm','--network','none','--label','aura.local-test=nutrition-p4','--name','aura-nutrition-local-'+randomUUID(),'--user','postgres','--tmpfs','/tmp:rw,nosuid,size=256m','--entrypoint','/bin/sh',image,'-c','exec sleep 900']);
 const sql=(text:string)=>docker(['exec','-i',container,'psql','-h','/tmp','-U','postgres','-d','postgres','-X','-q','-A','-t','-v','ON_ERROR_STOP=1','-v','VERBOSITY=verbose'],text);
 const actor=(n:number)=>`set "request.jwt.claim.sub"='${id(n)}';set role authenticated;`;
 const json=async<T>(text:string)=>JSON.parse(await sql(text)) as T;
 const command=(request:number,mealId:string|null=null,revision=0)=>({contractVersion:1,requestId:id(request),mealId,expectedRevision:revision,consumedOn:businessToday(),mealKind:'breakfast',operation:'save',items:[{label:'Synthetic local food',quantity:{amount:100,unit:'g'},composition,source:'manual'}]});
 const call=(value:unknown)=>`select aura_nutrition_meal_save('${id(10)}','${id(100)}','${JSON.stringify(value)}'::jsonb);`;
 try{
  const details=JSON.parse(await docker(['inspect',container,'--format','{{json .}}']));
  assert.equal(details.HostConfig.NetworkMode,'none');assert.deepEqual(details.HostConfig.PortBindings,{});assert.ok(!details.Mounts.some((mount:{Type:string})=>mount.Type==='bind'));
  await docker(['exec',container,'initdb','-D','/tmp/aura-pg','--auth=trust','--no-locale','--encoding=UTF8']);
  await docker(['exec','--detach',container,'postgres','-D','/tmp/aura-pg','-k','/tmp','-c','listen_addresses=','-c','shared_buffers=16MB']);
  let ready=false;for(let i=0;i<40;i++){try{await sql('select 1;');ready=true;break;}catch{await new Promise(resolve=>setTimeout(resolve,100));}}assert.ok(ready,'Local PostgreSQL must start');
  await sql(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);
   create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
   grant usage on schema public,auth to anon,authenticated;grant execute on function auth.uid() to anon,authenticated;`);
  await sql(await migrationBundle({through:baseline17}));
  await sql(`insert into auth.users values('${id(1)}','owner@example.invalid',now()),('${id(2)}','coach@example.invalid',now());
   insert into organizations(id,name) values('${id(10)}','Synthetic local A');
   insert into organization_members(organization_id,user_id,role) values('${id(10)}','${id(1)}','owner'),('${id(10)}','${id(2)}','coach');
   insert into clients(id,organization_id,full_name) values('${id(100)}','${id(10)}','Synthetic local pupil');`);
  const baseline=await json<{name:string}[]>('select jsonb_agg(to_jsonb(m) order by name) from app_private.aura_migrations m;');assert.equal(baseline.length,17);
  const before=await sql('select jsonb_agg(to_jsonb(c)) from clients c;');await sql(await migrationBundle());await sql(await migrationBundle());
  for(const entry of baseline)assert.deepEqual(await json(`select to_jsonb(m) from app_private.aura_migrations m where name='${entry.name}';`),entry);
  assert.equal(await sql('select jsonb_agg(to_jsonb(c)) from clients c;'),before);assert.equal(await sql('select count(*) from nutrition_capabilities;'),'0');
  await sql(actor(1)+`select aura_capability_save('${id(10)}','${id(2)}','profile',true,false);select aura_assignment_save('${id(10)}','${id(100)}','${id(2)}',true);select aura_nutrition_capability_save('${id(10)}','${id(2)}',true,true);`);
  const first=await json<{mealId:string}>(actor(2)+call(command(800)));
  const race=await Promise.allSettled([sql(actor(2)+call(command(801,first.mealId,1))),sql(actor(2)+call(command(802,first.mealId,1)))]);
  assert.equal(race.filter(result=>result.status==='fulfilled').length,1);assert.equal(race.filter(result=>result.status==='rejected'&&/PT409/.test(String(result.reason))).length,1);
  const duplicate=await Promise.all([json<{mealId:string;replayed:boolean}>(actor(2)+call(command(803))),json<{mealId:string;replayed:boolean}>(actor(2)+call(command(803)))]);
  assert.equal(duplicate[0].mealId,duplicate[1].mealId);assert.equal(duplicate.filter(result=>result.replayed).length,1);
  assert.equal(await sql(`select count(*) from app_private.nutrition_events where request_id='${id(803)}';`),'1');
  // Hold the same organization lock used by the RPC. An old identity must wait
  // and see the committed assignment revocation, not a pre-lock snapshot.
  const revocation=sql(`begin;${actor(1)}select aura_assignment_save('${id(10)}','${id(100)}','${id(2)}',false);select pg_advisory_xact_lock(180019);select pg_sleep(1.5);commit;`);
  let marker=false;for(let i=0;i<60;i++){if(await sql("select exists(select 1 from pg_locks where locktype='advisory' and objid=180019 and granted);")==='t'){marker=true;break;}await new Promise(resolve=>setTimeout(resolve,20));}assert.ok(marker,'Revocation must hold lock before writer starts');
  const pending=sql(actor(2)+call(command(804)));await assert.rejects(pending,/42501/);await revocation;
  assert.equal(await sql(actor(2)+'select count(*) from nutrition_meals;'),'0');
  await assert.rejects(sql(actor(2)+`select aura_nutrition_request_status('${id(10)}','${id(100)}','${id(800)}');`),/42501/);
  await assert.rejects(sql('set role anon;'+call(command(805))),/42501/);
  console.log(JSON.stringify({postgres:await sql('show server_version;'),imageId,baselineMigrations:17,candidateMigrations:Number(await sql('select count(*) from app_private.aura_migrations;')),upgradeAndReplay:'passed',independentSessionCAS:'passed',concurrentIdempotency:'passed',revocationWhileWriterWaits:'passed',revokedReceipt:'denied',anonymousRPC:'denied',auth:'simulated claims; not GoTrue/PostgREST',network:'none',hostMounts:false}));
 }finally{
  const label=await docker(['inspect',container,'--format','{{index .Config.Labels "aura.local-test"}}']);
  if(label!=='nutrition-p4')throw Error('Refusing to stop an unrecognized container');
  await docker(['stop','--time','1',container]);
 }
}
main().catch(error=>{console.error(error instanceof Error?error.message:'Local PostgreSQL test failed');process.exitCode=1;});
