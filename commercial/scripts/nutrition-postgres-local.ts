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
  // Two independent sessions: a page issued while the edit transaction is open
  // sees its committed predecessor, never half of a new meal revision.
  const seed=(values:number[])=>sql('begin;'+values.map(n=>`insert into nutrition_meals(id,organization_id,client_id,current_revision,created_by) values('${id(n)}','${id(10)}','${id(100)}',1,'${id(2)}');
   insert into nutrition_meal_versions(meal_id,organization_id,client_id,revision,consumed_on,meal_kind,recorded_by) values('${id(n)}','${id(10)}','${id(100)}',1,app_private.business_today(),'breakfast','${id(2)}');
   insert into nutrition_meal_items values('${id(n)}',1,'${id(10)}','${id(100)}',1,'Synthetic pagination food',100,'${JSON.stringify(composition)}'::jsonb,'manual');`).join('')+'commit;');
  await seed(Array.from({length:22},(_,i)=>10000+i));
  const diary=(cursor:string|null)=>`select aura_nutrition_diary('${id(10)}','${id(100)}',app_private.business_today(),${cursor?`'${cursor}'`:'null'});`;
  type Page={meals:{mealId:string;revision:number;items:{quantity:{amount:number}}[]}[];nextCursor:string|null};
  const firstPage=await json<Page>(actor(2)+diary(null));assert.equal(firstPage.nextCursor,id(10019));
  const editSeen={...command(850,id(10001),1),consumedOn:'2000-01-01'},editUnseen={...command(851,id(10020),1),consumedOn:'2000-01-01'};
  const writeOutcome=sql('begin;'+actor(2)+call(editSeen)+call(editUnseen)+'select pg_advisory_xact_lock(180020);select pg_sleep(1.5);commit;').then(()=>null,error=>error);
  let writing=false;for(let i=0;i<60;i++){if(await sql("select exists(select 1 from pg_locks where locktype='advisory' and objid=180020 and granted);")==='t'){writing=true;break;}await new Promise(resolve=>setTimeout(resolve,20));}assert.ok(writing,'Writer transaction must be pending');
  const during=await json<Page>(actor(2)+diary(firstPage.nextCursor));assert.equal(during.meals.find(m=>m.mealId===id(10020))?.revision,1);assert.equal(during.meals.find(m=>m.mealId===id(10020))?.items[0].quantity.amount,100);
  assert.equal(await writeOutcome,null);await seed([9999,10022]);
  const after=await json<Page>(actor(2)+diary(firstPage.nextCursor));assert.ok(!after.meals.some(m=>m.mealId===id(10020)));assert.ok(after.meals.some(m=>m.mealId===id(10022)));assert.ok(!after.meals.some(m=>m.mealId===id(9999)));
  const refreshed=await json<Page>(actor(2)+diary(null));assert.ok(refreshed.meals.some(m=>m.mealId===id(9999)));assert.ok(!refreshed.meals.some(m=>m.mealId===id(10001)));
  assert.equal(await sql("select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'aura_nutrition_%' and (p.prosecdef or has_function_privilege('anon',p.oid,'EXECUTE'));"),'0');
  assert.equal(await sql("select has_table_privilege('authenticated','public.nutrition_meal_items','INSERT');"),'f');
  // Hold the same organization lock used by the RPC. An old identity must wait
  // and see the committed assignment revocation, not a pre-lock snapshot.
  // Local proof for a future producer, not an installed export endpoint. Pin
  // one snapshot while another connection inserts and moves a meal's date.
  const snapshotQuery=`select jsonb_build_object('count',count(*),'grams',coalesce(sum(i.grams),0)) from nutrition_meal_versions v join nutrition_meal_items i using(meal_id,revision,organization_id,client_id) where v.organization_id='${id(10)}' and v.client_id='${id(100)}' and v.consumed_on=app_private.business_today();`;
  const snapshotRead=sql('begin isolation level repeatable read read only;'+actor(2)+snapshotQuery+'select pg_advisory_xact_lock(180021);select pg_sleep(1.5);'+snapshotQuery+'commit;');
  let capturing=false;for(let i=0;i<60;i++){if(await sql("select exists(select 1 from pg_locks where locktype='advisory' and objid=180021 and granted);")==='t'){capturing=true;break;}await new Promise(resolve=>setTimeout(resolve,20));}assert.ok(capturing,'Reader snapshot must be pinned');
  await sql(actor(2)+call(command(860))+call({...command(861,id(10002),1),consumedOn:'2000-01-01'}));
  const captured=(await snapshotRead).split('\n').filter(line=>line.startsWith('{')).map(line=>JSON.parse(line));assert.equal(captured.length,2);assert.deepEqual(captured[0],captured[1]);
  const fresh=await json(actor(2)+snapshotQuery);assert.notDeepEqual(fresh,captured[0],'Fresh transaction must observe the changed source set');
  const revocation=sql(`begin;${actor(1)}select aura_assignment_save('${id(10)}','${id(100)}','${id(2)}',false);select pg_advisory_xact_lock(180019);select pg_sleep(1.5);commit;`);
  let marker=false;for(let i=0;i<60;i++){if(await sql("select exists(select 1 from pg_locks where locktype='advisory' and objid=180019 and granted);")==='t'){marker=true;break;}await new Promise(resolve=>setTimeout(resolve,20));}assert.ok(marker,'Revocation must hold lock before writer starts');
  const pending=sql(actor(2)+call(command(804)));await assert.rejects(pending,/42501/);await revocation;
  assert.equal(await sql(actor(2)+'select count(*) from nutrition_meals;'),'0');
  await assert.rejects(sql(actor(2)+`select aura_nutrition_request_status('${id(10)}','${id(100)}','${id(800)}');`),/42501/);
  await assert.rejects(sql(actor(2)+diary(firstPage.nextCursor)),/42501/);
  await assert.rejects(sql('set role anon;'+call(command(805))),/42501/);
  console.log(JSON.stringify({postgres:await sql('show server_version;'),imageId,baselineMigrations:17,candidateMigrations:Number(await sql('select count(*) from app_private.aura_migrations;')),upgradeAndReplay:'passed',independentSessionCAS:'passed',concurrentIdempotency:'passed',consistentExportSnapshot:'passed-local-repeatable-read; no remote producer',concurrentPagination:'statement-consistent; no cross-request snapshot',publicInvokersAndGrants:'passed',revocationWhileWriterWaits:'passed',revokedReceipt:'denied',revokedCursor:'denied',anonymousRPC:'denied',auth:'simulated claims; not GoTrue/PostgREST',network:'none',hostMounts:false}));
 }finally{
  const label=await docker(['inspect',container,'--format','{{index .Config.Labels "aura.local-test"}}']);
  if(label!=='nutrition-p4')throw Error('Refusing to stop an unrecognized container');
  await docker(['stop','--time','1',container]);
 }
}
main().catch(error=>{console.error(error instanceof Error?error.message:'Local PostgreSQL test failed');process.exitCode=1;});
