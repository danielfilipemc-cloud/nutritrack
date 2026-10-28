import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {id,foundationFixture} from './foundation-fixture';
import {nutritionAccess,deny} from './nutrition-db-fixture';
import {documentFixture,documentCommand,documentRpc,documentSql,recipeBody,planBody,type DocumentFixture} from './native-document-fixture';
import {parseDocumentCommand,type PlanBody,type FrozenDish} from '../lib/nutrition-document-command';
import {createNutritionDocumentPersistence} from '../lib/nutrition-document-persistence';
import {NutritionPersistenceError,type NutritionRpcClient} from '../lib/nutrition-persistence';
import {migrationBundle} from '../scripts/migration-bundle';
const org=id(10),pupil=id(100),context={organizationId:org,clientId:pupil};
const adapter=(f:DocumentFixture)=>createNutritionDocumentPersistence(documentRpc(f),context);
const kind=(value:string)=>(e:unknown)=>e instanceof NutritionPersistenceError&&e.kind===value;
const raw=(f:DocumentFixture,c:unknown)=>f.db.query('select aura_nutrition_document_save($1,$2,$3::jsonb)',[org,pupil,JSON.stringify(c)]);
const change=(request:number,documentId:string,expectedRevision:number,operation:'publish'|'withdraw'='publish',docKind:'recipe'|'plan'='recipe')=>({...documentCommand(request,docKind),documentId,expectedRevision,operation,body:null,reason:'Revisão fictícia explícita'});

test('document SQL only adds isolated objects and is excluded from remote installer',async()=>{
 const f=await foundationFixture();try{
  await f.db.exec('begin;'+await readFile(new URL('../supabase/prepared/20261028140720_nutrition_water_native.sql',import.meta.url),'utf8')+'commit;');
  const before=await f.db.query<{oid:number;definition:string;acl:string}>("select p.oid::integer oid,pg_get_functiondef(p.oid) definition,p.proacl::text acl from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','app_private') order by oid");
  const policies=await f.db.query("select oid::integer oid,polrelid::integer rel,pg_get_expr(polqual,polrelid) expression from pg_policy order by oid");
  const sql=await readFile(documentSql,'utf8');await f.db.exec('begin;'+sql+'commit;');
  assert.deepEqual((await f.db.query("select p.oid::integer oid,pg_get_functiondef(p.oid) definition,p.proacl::text acl from pg_proc p where p.oid=any($1::oid[]) order by p.oid",[before.rows.map(r=>r.oid)])).rows,before.rows);
  assert.deepEqual((await f.db.query("select oid::integer oid,polrelid::integer rel,pg_get_expr(polqual,polrelid) expression from pg_policy where oid=any($1::oid[]) order by oid",[policies.rows.map(r=>(r as {oid:number}).oid)])).rows,policies.rows);
  const funcs=(await f.db.query<{anon:boolean;staff:boolean}>("select has_function_privilege('anon',p.oid,'execute') anon,has_function_privilege('authenticated',p.oid,'execute') staff from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','app_private') and (proname like 'nutrition_document_%' or proname like 'aura_nutrition_document_%')")).rows;
  assert.equal(funcs.length,18);assert.ok(funcs.every(r=>!r.anon));assert.equal(funcs.filter(r=>r.staff).length,8);
  const tables=(await f.db.query<{rls:boolean;write:boolean}>("select relrowsecurity rls,has_table_privilege('authenticated',c.oid,'insert,update,delete') write from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','app_private') and c.relkind='r' and c.relname like 'nutrition_document%'")).rows;
  assert.equal(tables.length,4);assert.ok(tables.every(t=>t.rls&&!t.write));assert.ok(!(await migrationBundle()).includes('create table public.nutrition_documents('));assert.ok(!sql.includes('create or replace'));
 }finally{await f.db.close();}
});
test('document commands reject identity forgery malformed units precision source snapshots and duplicate meal identities',async()=>{
 const f=await documentFixture();try{
  const c=documentCommand(),plan=documentCommand(8100,'plan'),p=planBody(),r=recipeBody();
  const bad=[null,{}, {...c,actor:id(1)},{...c,kind:null},{...c,operation:null},{...c,requestId:null},{...c,documentId:id(8101)},{...c,expectedRevision:1},{...c,reason:'forged'},
   {...c,body:{...r,title:null}},{...c,body:{...r,notes:'\t'}},{...c,body:{...r,items:[]}},
   ...[0,5001,1.2345].map(amount=>({...c,body:{...r,items:[{...r.items[0],quantity:{amount,unit:'g'}}]}})),
   {...c,body:{...r,items:[{...r.items[0],source:'recipe'}]}},
   {...plan,body:{...p,meals:[p.meals[0],p.meals[0]]}},
   {...plan,body:{...p,meals:[{...p.meals[0],time:'24:00'}]}},
   {...plan,body:{...p,meals:[{...p.meals[0],primary:{source:'recipe',recipeId:id(8102),revision:2,snapshot:r}}]}},
   {...plan,body:{...p,meals:[{...p.meals[0],alternatives:[{id:p.meals[0].id,label:'Duplicado',dish:p.meals[0].primary}]}]}}];
  for(const value of bad){assert.throws(()=>parseDocumentCommand(value));await deny(raw(f,value),'22023');}
  assert.equal(parseDocumentCommand({...c,body:{...r,title:'  Exemplo  '}}).body?.title,'Exemplo');
  for(const label of ['\u00a0Ingrediente fictício\u00a0','\ufeffIngrediente fictício\ufeff','\u00a0','\ufeff']){
   const value={...c,body:{...r,items:[{...r.items[0],label}]}};
   await f.db.exec('reset role;');
   const sql=(await f.db.query<{x:unknown}>('select app_private.nutrition_document_command($1::jsonb) x',[JSON.stringify(value)])).rows[0].x;
   assert.deepEqual(sql,parseDocumentCommand(value));await f.asUser(2);
  }
 }finally{await f.db.close();}
});
test('draft edits preserve publication, publish freezes exact draft, withdrawal retains all versions and original receipts replay',async()=>{
 const f=await documentFixture();try{
  const a=adapter(f),c=documentCommand(),saved=await a.save(c);assert.equal((await a.list('recipe')).documents[0].published,null);
  await a.save(change(8201,saved.documentId,1));const pub=(await a.list('recipe')).documents[0].published!;assert.equal(pub.revision,2);
  const edit={...documentCommand(8202),documentId:saved.documentId,expectedRevision:2,reason:'Editar exemplo',body:{...recipeBody(),title:'Segunda versão'}};
  await a.save(edit);const list=await a.list('recipe');assert.equal(list.documents[0].current.revision,3);assert.deepEqual(list.documents[0].published,pub);
  await assert.rejects(a.save({...edit,requestId:id(8203)}),kind('conflict'));await a.save(change(8204,saved.documentId,3));
  assert.equal((await a.list('recipe')).documents[0].published?.body.title,'Segunda versão');assert.deepEqual(await a.save(c),{...saved,replayed:true});
  await a.save({...edit,requestId:id(8205),expectedRevision:4,body:{...recipeBody(),title:'Rascunho pendente'}});
  await a.save(change(8206,saved.documentId,5,'withdraw'));const withdrawn=(await a.list('recipe')).documents[0];assert.equal(withdrawn.published,null);assert.equal(withdrawn.current.body.title,'Segunda versão');
  const h=await a.history(saved.documentId);assert.equal(h.versions.length,6);assert.equal(h.versions[1].body.title,'Rascunho pendente');assert.equal(h.versions[0].recordedBy,id(2));
  assert.deepEqual(await a.requestStatus(c.requestId),{documentId:saved.documentId,revision:1});await assert.rejects(a.save(change(8207,saved.documentId,6)),kind('conflict'));
  await f.db.exec('reset role');await deny(f.db.exec('delete from nutrition_documents'),'55000');await deny(f.db.exec("update nutrition_document_versions set status='draft'"),'55000');
 }finally{await f.db.close();}
});
test('plan captures recipe server-side, alternatives stay separate and later recipe changes never rewrite plan snapshots',async()=>{
 const f=await documentFixture();try{
  const a=adapter(f),r=await a.save(documentCommand(8300));await a.save(change(8301,r.documentId,1));
  const p=planBody();p.meals[0].primary={source:'recipe',recipeId:r.documentId,revision:2};p.meals[0].alternatives=[{id:id(8302),label:'Alternativa explícita',dish:{source:'manual',items:recipeBody().items}}];
  const command={...documentCommand(8303,'plan'),body:p},plan=await a.save(command);const draft=(await a.history(plan.documentId)).versions[0].body as PlanBody<FrozenDish>;
  assert.equal(draft.meals[0].primary.source,'recipe');assert.equal((draft.meals[0].primary as Extract<FrozenDish,{source:'recipe'}>).snapshot.title,recipeBody().title);
  await a.save(change(8304,plan.documentId,1,'publish','plan'));const frozen=(await a.list('plan')).documents[0].published;
  await a.save({...documentCommand(8305),documentId:r.documentId,expectedRevision:2,body:{...recipeBody(),title:'Receita alterada'},reason:'Alteração explícita'});await a.save(change(8306,r.documentId,3));
  assert.deepEqual((await a.list('plan')).documents[0].published,frozen);assert.deepEqual(await a.save(command),{...plan,replayed:true});
  await assert.rejects(a.save({...command,requestId:id(8307)}),kind('conflict'));
  await a.save({...documentCommand(8308,'plan'),body:{...p,meals:[{...p.meals[0],primary:{source:'recipe',recipeId:r.documentId,revision:4}}]}});
  await a.save(change(8309,r.documentId,4,'withdraw'));assert.deepEqual((await a.list('plan')).documents.find(d=>d.current.documentId===plan.documentId)?.published,frozen);
  await assert.rejects(a.save({...command,requestId:id(8310),body:{...p,meals:[{...p.meals[0],primary:{source:'recipe',recipeId:r.documentId,revision:4}}]}}),kind('conflict'));
  await f.db.exec('reset role');assert.equal((await f.db.query('select * from nutrition_meals')).rows.length,0);assert.equal((await f.db.query('select * from app_private.nutrition_document_events')).rows.length,8);
 }finally{await f.db.close();}
});
test('only one plan can be available; failed publication rolls revision receipt and audit back',async()=>{
 const f=await documentFixture();try{
  const a=adapter(f),first=await a.save(documentCommand(8400,'plan')),second=await a.save(documentCommand(8401,'plan'));
  await a.save(change(8402,first.documentId,1,'publish','plan'));const c=change(8403,second.documentId,1,'publish','plan');await assert.rejects(a.save(c),kind('conflict'));
  assert.equal(await a.requestStatus(c.requestId),null);assert.equal((await a.history(second.documentId)).versions.length,1);
  await a.save(change(8404,first.documentId,2,'withdraw','plan'));await a.save(c);assert.equal((await a.list('plan')).documents.filter(d=>d.published).length,1);
 }finally{await f.db.close();}
});
test('document permissions isolate pupil tenant actor receipts, read-only, revocation, archive and MFA',async()=>{
 const f=await documentFixture();try{
  const a=adapter(f),c=documentCommand(8500),saved=await a.save(c);
  for(const u of [1,3,4,5,7]){await f.asUser(u);await assert.rejects(a.list('recipe'),kind('denied'));await assert.rejects(a.history(saved.documentId),kind('denied'));await assert.rejects(a.save(c),kind('denied'));assert.equal((await f.db.query('select * from nutrition_documents')).rows.length,0);}
  await nutritionAccess(f,false);assert.equal((await a.list('recipe')).documents.length,1);await assert.rejects(a.save(c),kind('denied'));await assert.rejects(a.requestStatus(c.requestId),kind('denied'));
  await nutritionAccess(f);await f.grant(2,101,['profile']);await f.asUser(2);const other=createNutritionDocumentPersistence(documentRpc(f),{organizationId:org,clientId:id(101)});assert.equal(await other.requestStatus(c.requestId),null);await assert.rejects(other.history(saved.documentId),kind('denied'));await assert.rejects(other.save(c),kind('conflict'));
  const p=planBody();p.meals[0].primary={source:'recipe',recipeId:saved.documentId,revision:1};await assert.rejects(other.save({...documentCommand(8501,'plan'),body:p}),kind('conflict'));
  await f.asUser(1);await f.db.query('select aura_assignment_save($1,$2,$3,false)',[org,pupil,id(2)]);await f.asUser(2);await assert.rejects(a.history(saved.documentId),kind('denied'));
  await nutritionAccess(f);await f.db.exec("reset role;insert into app_private.organization_security(organization_id,require_sensitive_aal2,revision,updated_by) values('"+org+"',true,1,'"+id(1)+"')");await f.asUser(2);await assert.rejects(a.list('recipe'),kind('denied'));await assert.rejects(a.save(c),kind('denied'));
  await f.db.exec("reset role;update app_private.organization_security set require_sensitive_aal2=false;update clients set archived_at=now() where id='"+pupil+"'");await f.asUser(2);await assert.rejects(a.save({...c,requestId:id(8502)}),kind('conflict'));assert.equal((await a.history(saved.documentId)).versions.length,1);
  await f.db.exec("reset role;set role anon;select set_config('request.jwt.claim.sub','',false)");await deny(raw(f,c));
 }finally{await f.db.close();}
});
test('document pages and histories remain contiguous; injected final failure rolls all tables back',async()=>{
 const f=await documentFixture();try{
  const a=adapter(f);for(let n=0;n<22;n++)await a.save(documentCommand(8600+n));const page=await a.list('recipe'),last=await a.list('recipe',page.nextCursor);assert.equal(page.documents.length,20);assert.equal(last.documents.length,2);assert.equal(last.nextCursor,null);
  const target=page.documents[0].current.documentId;for(let rev=1;rev<23;rev++)await a.save({...documentCommand(8700+rev),documentId:target,expectedRevision:rev,reason:'Editar exemplo'});
  const h=await a.history(target);assert.equal(h.versions.length,20);assert.equal(h.nextCursor,4);assert.deepEqual((await a.history(target,h.nextCursor)).versions.map(v=>v.revision),[3,2,1]);
  await f.db.exec("reset role;create function app_private.synthetic_document_failure() returns trigger language plpgsql as $$begin raise exception using errcode='23514',message='Synthetic late failure';end;$$;create trigger synthetic_document_failure before insert on app_private.nutrition_document_events for each row execute function app_private.synthetic_document_failure();");await f.asUser(2);
  const before=(await a.history(target)).versions[0];await assert.rejects(a.save({...documentCommand(8800),documentId:target,expectedRevision:23,reason:'Falha fictícia'}),kind('conflict'));assert.equal(await a.requestStatus(id(8800)),null);assert.deepEqual((await a.history(target)).versions[0],before);
 }finally{await f.db.close();}
});
test('inactive document adapter refuses stale context uncertain writes malformed publication and truncated history',async()=>{
 let calls=0,release!:(v:{data:unknown;error:null})=>void;const delayed:NutritionRpcClient={rpc(){calls++;return {abortSignal:()=>new Promise(r=>{release=r;})};}};
 const a=createNutritionDocumentPersistence(delayed,context),pending=a.list('recipe');a.dispose();release({data:null,error:null});await assert.rejects(pending,kind('stale'));await assert.rejects(a.save(documentCommand()),kind('stale'));assert.equal(calls,1);
 const fixed=(data:unknown,error:{code:string}|null=null):NutritionRpcClient=>({rpc(){return {abortSignal:async()=>({data,error})};}});
 const b=(data:unknown)=>createNutritionDocumentPersistence(fixed(data),context);
 await assert.rejects(b({}).save(documentCommand()),kind('uncertain'));await assert.rejects(createNutritionDocumentPersistence(fixed(null,{code:'PGRST202'}),context).list('recipe'),kind('unavailable'));
 const row={documentId:id(8900),kind:'recipe',revision:1,status:'draft',body:recipeBody(),reason:null,recordedBy:id(2)};
 await assert.rejects(b({documents:[{current:row,published:row}],nextCursor:null}).list('recipe'),kind('invalid-response'));
 await assert.rejects(b({versions:[{...row,revision:3,reason:'Corrigido'},row],nextCursor:null}).history(row.documentId),kind('invalid-response'));
 await assert.rejects(b({versions:[],nextCursor:null}).history(row.documentId,2),kind('invalid-response'));assert.deepEqual(await b({versions:[],nextCursor:null}).history(row.documentId,1),{versions:[],nextCursor:null});
});
