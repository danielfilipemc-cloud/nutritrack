/** Dedicated synthetic GoTrue/PostgREST sandbox. Never accepts a URL, database DSN,
 * dotenv, cloud approval or arbitrary SQL file from the caller. No reset/cleanup. */
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {randomUUID,randomBytes,createHash,createHmac} from 'node:crypto';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {createClient,type SupabaseClient} from '@supabase/supabase-js';
import {migrationBundle,migrationSource} from './migration-bundle';
import {assertNutritionAuthRuntime,nutritionAuthTarget,nutritionAuthContainer} from './nutrition-auth-local-safety';
import {createNutritionPersistence,NutritionPersistenceError} from '../lib/nutrition-persistence';
import {createNutritionWaterPersistence} from '../lib/nutrition-water-persistence';
import {createNutritionDocumentPersistence} from '../lib/nutrition-document-persistence';
import {businessToday} from '../lib/care';

const root=new URL('../.aura-integration/local-runtime/nutrition/',import.meta.url);
const hash=(text:string)=>createHash('sha256').update(text.replace(/\r\n/g,'\n')).digest('hex');
const read=async(name:string)=>JSON.parse((await readFile(new URL(name,root),'utf8')).replace(/^\uFEFF/,''));
const write=(name:string,value:unknown)=>writeFile(new URL(name,root),JSON.stringify(value,null,2),{mode:0o600});
const uuid=(v:string)=>{assert.match(v,/^[a-f0-9-]{36}$/);return `'${v}'`;};
function wsl(args:string[],input=''){
 const windows=process.platform==='win32';
 return execFileSync(windows?'wsl.exe':args[0],windows?['-d','AURA-Dev','--',...args]:args.slice(1),{input,encoding:'utf8',stdio:['pipe','pipe','pipe'],timeout:120000,windowsHide:true}).trim();
}
function sql(text:string){return wsl(['docker','exec','-i',nutritionAuthContainer,'psql','-U','postgres','-d','postgres','-X','-q','-A','-t','-v','ON_ERROR_STOP=1'],text);}
function totp(secret:string,millis:number){
 const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';let bits='';
 for(const ch of secret.replace(/=+$/,''))bits+=alphabet.indexOf(ch).toString(2).padStart(5,'0');
 const bytes=[];for(let i=0;i+8<=bits.length;i+=8)bytes.push(parseInt(bits.slice(i,i+8),2));
 const counter=Buffer.alloc(8);counter.writeBigUInt64BE(BigInt(Math.floor(millis/30000)));
 const digest=createHmac('sha1',Buffer.from(bytes)).update(counter).digest(),offset=digest[digest.length-1]&15;
 return String((digest.readUInt32BE(offset)&0x7fffffff)%1000000).padStart(6,'0');
}
function value<R extends {data:unknown;error:{code?:string;status?:number}|null}>(result:R):NonNullable<R['data']>{
 if(result.error)throw Object.assign(new Error('Synthetic local request rejected'),{code:result.error.code??result.error.status??'transport'});return result.data as NonNullable<R['data']>;
}
async function denied(fn:()=>Promise<unknown>){await assert.rejects(fn,(e:unknown)=>e instanceof NutritionPersistenceError&&e.kind==='denied');}

async function main(){
 assert.ok(process.argv.length===3&&['--prepare','--run'].includes(process.argv[2]),'Use --prepare or --run');
 const status=await read('status.private.json');assertNutritionAuthRuntime(status,process.env);
 assert.equal(wsl(['cat','/etc/aura-development-runtime']),'AURA-Dev');
 assert.equal(wsl(['docker','context','inspect','--format','{{.Endpoints.docker.Host}}']),'unix:///var/run/docker.sock');
 assert.equal(wsl(['docker','inspect',nutritionAuthContainer,'--format','{{ index .Config.Labels "com.supabase.cli.project" }}']),'aura-nutrition-local');
 const baseline=await migrationBundle({through:'20261016233912_sensitive_reads_aal2.sql'}),upgrade=await migrationBundle();
 const preparedNames=['20261028140720_nutrition_water_native.sql','20261028160819_nutrition_documents_native.sql'];
 const candidates=await Promise.all(preparedNames.map(name=>readFile(new URL('../supabase/prepared/'+name,import.meta.url),'utf8')));
 const sources={baseline:hash(baseline),upgrade:hash(upgrade),candidates:candidates.map(hash)};
 if(process.argv[2]==='--prepare'){
  assert.equal(sql('select count(*) from auth.users;'),'0','Preparation refuses any existing Auth identities');
  let manifest;try{manifest=await read('prepared.json');}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}
  if(manifest){assert.equal(manifest.scope,'synthetic-local-nutrition-schema');assert.deepEqual(manifest.sources,sources,'Prepared sources changed: independent review required');}
  else{
   assert.equal(sql("select count(*) from information_schema.tables where table_schema='public';"),'0','Only a fresh empty dedicated database is accepted');
   manifest={scope:'synthetic-local-nutrition-schema',state:'PREPARING',sources,apiUrl:nutritionAuthTarget,startedAt:new Date().toISOString()};await write('prepared.json',manifest);
  }
  sql(baseline);
  const before=JSON.parse(sql("select jsonb_agg(to_jsonb(m) order by name) from app_private.aura_migrations m where name not like '%nutrition%';"));assert.equal(before.length,17);
  sql(upgrade);
  const after=JSON.parse(sql("select jsonb_agg(to_jsonb(m) order by name) from app_private.aura_migrations m where name not like '%nutrition%';"));assert.deepEqual(after,before,'Baseline records must remain unchanged');
  assert.equal(sql('select count(*) from app_private.aura_migrations;'),'19');
  if(sql("select to_regclass('public.nutrition_water') is not null;")==='f')sql('begin;'+candidates.join('\n')+'commit;');
  assert.equal(sql("select count(*) from information_schema.tables where table_schema='public' and table_name in ('nutrition_documents','nutrition_water');"),'2');
  sql("notify pgrst,'reload schema';");
  await write('prepared.json',{...manifest,state:'PREPARED',completedAt:new Date().toISOString(),baselineCount:17,migrationCount:19,baselineUnchanged:true});
  console.log('PASS: dedicated local schema prepared; 17 historical records unchanged, 19 registered migrations and two isolated prepared candidates. No remote operation.');return;
 }
 const manifest=await read('prepared.json');assert.equal(manifest.scope,'synthetic-local-nutrition-schema');assert.equal(manifest.state,'PREPARED');assert.equal(manifest.apiUrl,nutritionAuthTarget);assert.deepEqual(manifest.sources,sources,'Prepared source drift');
 assert.equal(sql('select count(*) from app_private.aura_migrations;'),'19');
 const installed=JSON.parse(sql('select jsonb_agg(jsonb_build_object(\'name\',name,\'checksum\',checksum) order by name) from app_private.aura_migrations;')) as {name:string;checksum:string}[];
 for(const entry of installed){assert.match(entry.name,/^(schema\.sql|002_assessments\.sql|003_branding\.sql|migrations\/\d{14}_[a-z0-9_]+\.sql)$/);const source=migrationSource(entry.name,await readFile(new URL('../supabase/'+entry.name,import.meta.url),'utf8'));assert.equal(entry.checksum,createHash('sha256').update(source).digest('hex'),'Installed checksum mismatch');}
 const key=status.PUBLISHABLE_KEY||status.ANON_KEY,secret=status.SECRET_KEY||status.SERVICE_ROLE_KEY;
 const safeFetch:typeof fetch=(input,init)=>{
  const url=new URL(input instanceof Request?input.url:input.toString());assert.equal(url.origin,nutritionAuthTarget,'Local-only HTTP transport');assert.ok(url.pathname.startsWith('/auth/v1/')||url.pathname.startsWith('/rest/v1/'),'Only Auth/Data API allowed');
  return fetch(input,{...init,redirect:'error'});
 };
 const options={auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{fetch:safeFetch}};
 const make=(token?:string)=>createClient(nutritionAuthTarget,key,{...options,...(token?{accessToken:async()=>token}:{})}),admin=createClient(nutritionAuthTarget,secret,options);
 for(let page=1;;page++){const users=value(await admin.auth.admin.listUsers({page,perPage:100})).users;assert.ok(users.every(u=>u.app_metadata.synthetic===true&&u.app_metadata.scope==='aura-nutrition-local'&&u.email?.endsWith('@example.invalid')),'Non-synthetic Auth identity: stop');if(users.length<100)break;}
 const run=randomUUID(),folder='runs/'+run;await mkdir(new URL(folder+'/',root),{recursive:true,mode:0o700});
 const report={scope:'synthetic-local-nutrition-auth',run,apiUrl:nutritionAuthTarget,result:'RUNNING',sources,runnerSha256:hash(await readFile(new URL('./nutrition-auth-local.ts',import.meta.url),'utf8')),startedAt:new Date().toISOString(),completedAt:'',checks:[] as {name:string;result:string;code?:string}[]};
 const reportName=folder+'/report.json';
 async function check(name:string,fn:()=>Promise<void>){try{await fn();report.checks.push({name,result:'PASS'});console.log('PASS: '+name);}catch(error){report.result='FAIL';report.checks.push({name,result:'FAIL',code:String((error as {code?:unknown}).code||'assertion')});throw Object.assign(new Error('Local nutrition check failed: '+name),{code:(error as {code?:unknown}).code||'assertion'});}finally{await write(reportName,report);}}
 const accounts:Record<string,{id:string;db:SupabaseClient;token:string}>={};
 const oa=randomUUID(),ob=randomUUID(),ca=randomUUID(),cb=randomUUID(),unassignedClient=randomUUID();
 await check('provision confirmed synthetic actors and two isolated organizations',async()=>{
  for(const role of ['owner','admin','coach','student','unassigned','foreign','reader']){
   const email=`nutrition-${role}-${run}@example.invalid`,password=randomBytes(32).toString('base64url')+'Aa9!';
   const u=value(await admin.auth.admin.createUser({email,password,email_confirm:true,app_metadata:{synthetic:true,scope:'aura-nutrition-local',run}})).user;assert.ok(u);
   const db=make(),session=value(await db.auth.signInWithPassword({email,password})).session;assert.ok(session);accounts[role]={id:u.id,db,token:session.access_token};
  }
  sql(`begin;insert into organizations(id,name) values(${uuid(oa)},'Synthetic nutrition A'),(${uuid(ob)},'Synthetic nutrition B');
   insert into clients(id,organization_id,full_name) values(${uuid(ca)},${uuid(oa)},'Synthetic nutrition pupil A'),(${uuid(cb)},${uuid(ob)},'Synthetic nutrition pupil B'),(${uuid(unassignedClient)},${uuid(oa)},'Synthetic unassigned pupil');
   insert into organization_members(organization_id,user_id,role) values ${['owner','admin','coach','unassigned','reader'].map(role=>`(${uuid(oa)},${uuid(accounts[role].id)},'${role==='owner'?'owner':role==='admin'?'admin':'coach'}')`).join(',')},(${uuid(ob)},${uuid(accounts.foreign.id)},'owner');
   insert into client_users(organization_id,client_id,user_id) values(${uuid(oa)},${uuid(ca)},${uuid(accounts.student.id)});commit;`);
  await write(folder+'/fixture.json',{scope:'synthetic-local-nutrition-fixture',run,oa,ob,ca,cb,unassignedClient,actors:Object.fromEntries(Object.entries(accounts).map(([role,a])=>[role,a.id]))});
 });
 const today=businessToday(),context={organizationId:oa,clientId:ca};
 const meals=(db:SupabaseClient,scope=context)=>createNutritionPersistence(db,scope,businessToday),water=(db:SupabaseClient,scope=context)=>createNutritionWaterPersistence(db,scope,businessToday),documents=(db:SupabaseClient,scope=context)=>createNutritionDocumentPersistence(db,scope);
 const item={label:'Synthetic manual food',source:'manual',quantity:{amount:100,unit:'g'},composition:{contractVersion:1,basis:{amount:100,unit:'g'},nutrients:{calories:101,protein:1,carbs:null,fat:0}}};
 const command=()=>({contractVersion:1,requestId:randomUUID(),mealId:null,expectedRevision:0,consumedOn:today,mealKind:'other',operation:'save',items:[structuredClone(item)]});
 const waterCommand=()=>({contractVersion:1,requestId:randomUUID(),waterId:null,expectedRevision:0,operation:'save',entry:{consumedOn:today,time:null,quantity:{amount:350,unit:'ml'}},reason:null});
 const recipeCommand=()=>({contractVersion:1,requestId:randomUUID(),documentId:null,kind:'recipe',expectedRevision:0,operation:'save',body:{title:'Synthetic recipe',notes:null,items:[structuredClone(item)]},reason:null});
 await check('membership and owner role do not confer implicit nutrition access',async()=>{for(const role of ['owner','admin','coach'])await denied(()=>meals(accounts[role].db).diary(today));});
 await check('explicit owner grants and assignments; admin cannot grant nutrition',async()=>{
  const owner=accounts.owner.db;
  for(const role of ['owner','admin','coach','reader','unassigned']){
   const user=accounts[role].id;
   value(await owner.rpc('aura_capability_save',{p_org:oa,p_user:user,p_module:'profile',p_enabled:true,p_write:true}));
   value(await owner.rpc('aura_nutrition_capability_save',{p_org:oa,p_user:user,p_enabled:true,p_write:role!=='reader'}));
   if(role!=='unassigned')value(await owner.rpc('aura_assignment_save',{p_org:oa,p_client:ca,p_user:user,p_enabled:true}));
  }
  assert.equal((await accounts.admin.db.rpc('aura_nutrition_capability_save',{p_org:oa,p_user:accounts.coach.id,p_enabled:true,p_write:true})).error?.code,'42501');
 });
 const coach=accounts.coach.db,mealRepo=meals(coach),waterRepo=water(coach),docRepo=documents(coach);
 await check('anonymous/student/unassigned/foreign actors and cross-scope requests are denied',async()=>{
  for(const db of [make(),accounts.student.db,accounts.unassigned.db,accounts.foreign.db]){
   await denied(()=>meals(db).diary(today));await denied(()=>water(db).diary(today));await denied(()=>documents(db).list('recipe'));await denied(()=>meals(db).save(command()));await denied(()=>water(db).save(waterCommand()));await denied(()=>documents(db).save(recipeCommand()));
  }
  for(const scope of [{organizationId:ob,clientId:cb},{organizationId:oa,clientId:cb},{organizationId:oa,clientId:unassignedClient}]){await denied(()=>meals(coach,scope).diary(today));await denied(()=>water(coach,scope).diary(today));await denied(()=>documents(coach,scope).list('plan'));await denied(()=>documents(coach,scope).save(recipeCommand()));}
 });
 await check('meal idempotency and concurrent CAS preserve versions and receipt',async()=>{
  const c=command(),receipts=await Promise.all([mealRepo.save(c),mealRepo.save(c)]);assert.equal(receipts[0].mealId,receipts[1].mealId);assert.deepEqual(receipts.map(r=>r.replayed).sort(),[false,true]);const mealId=receipts[0].mealId;
  const edits=[75,125].map(amount=>({...command(),mealId,expectedRevision:1,items:[{...structuredClone(item),quantity:{amount,unit:'g'}}]}));
  const results=await Promise.allSettled(edits.map(c=>mealRepo.save(c)));assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.ok(results.some(r=>r.status==='rejected'&&r.reason instanceof NutritionPersistenceError&&r.reason.kind==='conflict'));
  await mealRepo.save({...command(),mealId,expectedRevision:2,operation:'void',items:[]});const history=await mealRepo.history(mealId);assert.equal(history.versions.length,3);assert.equal(history.versions[2].items[0].quantity.amount,100);assert.equal((await mealRepo.requestStatus(c.requestId))?.revision,1);
 });
 await check('water idempotency, correction, void and original unknown time survive transport',async()=>{
  const c=waterCommand(),first=await waterRepo.save(c);assert.equal((await waterRepo.save(c)).replayed,true);
  await waterRepo.save({...waterCommand(),waterId:first.waterId,expectedRevision:1,entry:{consumedOn:today,time:null,quantity:{amount:425,unit:'ml'}},reason:'Synthetic correction'});
  await waterRepo.save({...waterCommand(),waterId:first.waterId,expectedRevision:2,operation:'void',entry:null,reason:'Synthetic withdrawal'});
  const h=await waterRepo.history(first.waterId);assert.equal(h.versions.length,3);assert.equal(h.versions[2].entry.time,null);assert.equal(h.versions[2].entry.quantity.amount,350);assert.equal((await waterRepo.diary(today)).summary.declaredMl,null);
 });
 await check('recipe publication, immutable plan composition and withdrawal do not declare consumption',async()=>{
  const recipe=recipeCommand();
  const first=await docRepo.save(recipe);await docRepo.save({...recipe,requestId:randomUUID(),documentId:first.documentId,expectedRevision:1,operation:'publish',body:null,reason:'Synthetic publication'});
  const plan={...recipe,requestId:randomUUID(),kind:'plan',body:{title:'Synthetic plan',notes:null,meals:[{id:randomUUID(),label:'Synthetic meal',time:null,primary:{source:'recipe',recipeId:first.documentId,revision:2},alternatives:[]}]}};
  const p=await docRepo.save(plan);await docRepo.save({...plan,requestId:randomUUID(),documentId:p.documentId,expectedRevision:1,operation:'publish',body:null,reason:'Synthetic plan publication'});
  await docRepo.save({...recipe,requestId:randomUUID(),documentId:first.documentId,expectedRevision:2,body:{...recipe.body,title:'Pending unpublished recipe'},reason:'Synthetic edit'});
  const publication=(await docRepo.list('recipe')).documents[0].published;assert.equal(publication?.revision,2);
  await docRepo.save({...recipe,requestId:randomUUID(),documentId:first.documentId,expectedRevision:3,operation:'withdraw',body:null,reason:'Synthetic withdrawal'});
  const loaded=(await docRepo.list('plan')).documents[0];assert.equal(loaded.published?.revision,2);assert.ok(JSON.stringify(loaded.published?.body).includes('Synthetic recipe'));assert.ok(!JSON.stringify(loaded.published?.body).includes('Pending unpublished recipe'));
  assert.equal((await docRepo.history(first.documentId)).versions[0].body.title,'Synthetic recipe');assert.equal((await mealRepo.diary(today)).meals.length,1);
 });
 await check('read-only staff can consult every resource but cannot write',async()=>{
  const db=accounts.reader.db;assert.ok((await meals(db).diary(today)).meals.length);assert.ok((await water(db).diary(today)).entries.length);assert.ok((await documents(db).list('plan')).documents.length);
  await denied(()=>meals(db).save(command()));await denied(()=>water(db).save(waterCommand()));await denied(()=>documents(db).save(recipeCommand()));
  for(const role of ['owner','admin']){assert.ok((await meals(accounts[role].db).diary(today)).meals.length);assert.ok((await water(accounts[role].db).diary(today)).entries.length);assert.ok((await documents(accounts[role].db).list('plan')).documents.length);}
 });
 await check('nutrition revocation takes effect with the existing access JWT',async()=>{
  value(await accounts.owner.db.rpc('aura_nutrition_capability_save',{p_org:oa,p_user:accounts.coach.id,p_enabled:false,p_write:false}));
  for(const repo of [meals(make(accounts.coach.token)),water(make(accounts.coach.token))])await denied(()=>repo.diary(today));await denied(()=>documents(make(accounts.coach.token)).list('plan'));
  value(await accounts.owner.db.rpc('aura_nutrition_capability_save',{p_org:oa,p_user:accounts.coach.id,p_enabled:true,p_write:true}));
  value(await accounts.owner.db.rpc('aura_assignment_save',{p_org:oa,p_client:ca,p_user:accounts.coach.id,p_enabled:false}));await denied(()=>meals(make(accounts.coach.token)).save(command()));
  await denied(()=>water(make(accounts.coach.token)).save(waterCommand()));await denied(()=>documents(make(accounts.coach.token)).save(recipeCommand()));
  value(await accounts.owner.db.rpc('aura_assignment_save',{p_org:oa,p_client:ca,p_user:accounts.coach.id,p_enabled:true}));
 });
 await check('installed grants, invoker wrappers, definer search paths and private schemas are bounded',async()=>{
  const functions=JSON.parse(sql("select jsonb_agg(jsonb_build_object('name',p.proname,'schema',n.nspname,'definer',p.prosecdef,'config',p.proconfig,'anon',has_function_privilege('anon',p.oid,'execute'))) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where (n.nspname='public' and p.proname like 'aura_nutrition_%') or (n.nspname='app_private' and p.proname like 'nutrition_%');")) as {name:string;schema:string;definer:boolean;config:string[]|null;anon:boolean}[];
  assert.ok(functions.length>=25);for(const f of functions){assert.equal(f.anon,false);if(f.schema==='public')assert.equal(f.definer,false);if(f.definer)assert.ok(f.config?.some(c=>c==='search_path=""'||c==='search_path='));}
  assert.ok((await coach.from('nutrition_meal_versions').update({meal_kind:'dinner'}).eq('organization_id',oa)).error);
  const tables=JSON.parse(sql("select jsonb_agg(jsonb_build_object('schema',n.nspname,'rls',c.relrowsecurity,'anon',has_table_privilege('anon',c.oid,'SELECT,INSERT,UPDATE,DELETE'),'dml',has_table_privilege('authenticated',c.oid,'INSERT,UPDATE,DELETE'))) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','app_private') and c.relkind='r' and c.relname like 'nutrition_%';")) as {schema:string;rls:boolean;anon:boolean;dml:boolean}[];
  assert.ok(tables.length>=10);for(const table of tables){assert.equal(table.anon,false);assert.equal(table.dml,false);if(table.schema==='public')assert.equal(table.rls,true);}
  assert.deepEqual(value(await coach.from('nutrition_meal_versions').select('meal_id').eq('organization_id',ob)),[]);
  assert.deepEqual(value(await accounts.student.db.from('nutrition_meal_versions').select('meal_id').eq('organization_id',oa)),[]);
  const privateRead=await fetch(nutritionAuthTarget+'/rest/v1/nutrition_document_events?select=id',{redirect:'error',headers:{apikey:key,Authorization:'Bearer '+accounts.coach.token,'Accept-Profile':'app_private'}});assert.equal(privateRead.status,406);
 });
 async function mfa(db:SupabaseClient){
  const enrolled=value(await db.auth.mfa.enroll({factorType:'totp',friendlyName:'Synthetic nutrition validation'}));assert.equal(enrolled.type,'totp');
  const challenge=value(await db.auth.mfa.challenge({factorId:enrolled.id}));const health=await fetch(nutritionAuthTarget+'/auth/v1/health',{redirect:'error'}),serverTime=new Date(health.headers.get('date')||'').getTime();assert.ok(Number.isFinite(serverTime));
  const verified=value(await db.auth.mfa.verify({factorId:enrolled.id,challengeId:challenge.id,code:totp(enrolled.totp.secret,serverTime)}));
  assert.equal(JSON.parse(Buffer.from(verified.access_token.split('.')[1],'base64url').toString()).aal,'aal2');return {token:verified.access_token,factorId:enrolled.id};
 }
 await check('organization AAL2 policy rejects old AAL1 JWTs for nutritional reads and writes',async()=>{
  await mfa(accounts.owner.db);value(await accounts.owner.db.rpc('aura_security_policy_save',{p_org:oa,p_required:true,p_revision:0}));
  const old=make(accounts.coach.token);await denied(()=>meals(old).diary(today));await denied(()=>water(old).diary(today));await denied(()=>documents(old).list('plan'));await denied(()=>meals(old).save(command()));await denied(()=>water(old).save(waterCommand()));await denied(()=>documents(old).save(recipeCommand()));
 });
 await check('live AAL2 succeeds; global sign-out invalidates sensitive reads with the old AAL2 JWT',async()=>{
  const verified=await mfa(coach),live=make(verified.token);assert.ok((await meals(live).diary(today)).meals.length);assert.ok((await documents(live).list('plan')).documents.length);
  assert.equal((await coach.auth.signOut({scope:'global'})).error,null);await denied(()=>meals(live).diary(today));await denied(()=>water(live).save(waterCommand()));await denied(()=>documents(live).list('plan'));
 });
 report.result='PASS';report.completedAt=new Date().toISOString();await write(reportName,report);
 console.log('PASS: '+report.checks.length+' real local GoTrue/PostgREST check groups. Synthetic fixtures retained; private report: '+fileURLToPath(new URL(reportName,root)));
}
void main().catch(error=>{console.error('Local nutrition validation stopped: '+(error as Error).message+'; code='+String((error as {code?:unknown}).code||'assertion')+'. Process output/credentials omitted.');process.exitCode=1;});
