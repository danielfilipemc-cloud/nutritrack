import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
import {personalFixture} from './nutrition-personal-fixture';import {id} from './foundation-fixture';import {deny} from './nutrition-db-fixture';
import {parsePersonalPlanState,parsePersonalPlanExport,createPersonalPlanReader,type PersonalPlanScope} from '../lib/nutrition-personal-plan';
import {nutritionTotals} from '../lib/nutrition-contract';
const scope:PersonalPlanScope={organizationId:id(10),clientId:id(100),userId:id(4)};
const food=(grams=100)=>({label:'Alimento fictício, cozinhado',source:'manual',quantity:{amount:grams,unit:'g'},composition:{contractVersion:1,basis:{amount:100,unit:'g'},nutrients:{calories:200,protein:10,carbs:null,fat:5}}});
const body=()=>({title:'Plano fictício para consulta',notes:'Sem consumo declarado.',meals:[{id:id(7001),label:'Refeição fictícia',time:'13:00',primary:{source:'manual',items:[food()]},alternatives:[{id:id(7002),label:'Outra opção fictícia',dish:{source:'manual',items:[food(50)]}}]}]});
async function fixture(){const f=await personalFixture();await f.db.exec('reset role;begin;'+await readFile(new URL('../supabase/prepared/20261114234627_nutrition_personal_plan_reference.sql',import.meta.url),'utf8')+`insert into app_private.organization_security(organization_id,require_sensitive_aal2,revision,updated_by) values('${id(10)}',true,1,'${id(1)}');insert into auth.mfa_factors values('${id(4)}','verified','totp');commit;`);return f;}
async function aal2(f:Awaited<ReturnType<typeof fixture>>,n=4){await f.asStudent(n,{aal:'aal2',amr:[{method:'totp',timestamp:Math.floor(Date.now()/1000)}]});}
async function insert(f:Awaited<ReturnType<typeof fixture>>,revision=1,plan:unknown=body(),status='available'){
 await f.db.exec('reset role');await f.db.query('insert into app_private.nutrition_personal_plan_versions(organization_id,client_id,personal_user_id,revision,status,body,source_label,reason) values($1,$2,$3,$4,$5,$6::jsonb,$7,$8)',[scope.organizationId,scope.clientId,scope.userId,revision,status,plan===null?null:JSON.stringify(plan),'Fonte fictícia','Publicação assistida fictícia']);
}
async function read(f:Awaited<ReturnType<typeof fixture>>){return (await f.db.query<{x:unknown}>('select aura_student_nutrition_plan_read($1,$2) x',[scope.organizationId,scope.clientId])).rows[0].x;}
test('private plan consultation preserves frozen quantities and alternatives without declaring consumption',async()=>{
 const f=await fixture();try{await aal2(f);assert.equal(parsePersonalPlanState(await read(f),scope).status,'none');await insert(f);await aal2(f);const r=parsePersonalPlanState(await read(f),scope);assert.equal(r.revision,1);assert.equal(r.body!.meals[0].primary.source,'manual');assert.equal(nutritionTotals((r.body!.meals[0].primary.source==='manual'?r.body!.meals[0].primary.items:[]).map(({composition,quantity})=>({composition,quantity}))).nutrients.calories,200);assert.equal((await f.db.query('select * from nutrition_meals')).rows.length,0);await f.db.exec('reset role');assert.equal((await f.db.query<{n:number}>('select count(*) n from app_private.aura_migrations')).rows[0].n,19);}finally{await f.db.close();}
});
test('plan read denies AAL1, another student, foreign scope, unconfirmed account and revoked link or session',async()=>{
 const f=await fixture();try{await insert(f);await f.asStudent();await deny(read(f),'42501');await aal2(f,8);await deny(read(f),'42501');await aal2(f);await deny(f.db.query('select aura_student_nutrition_plan_read($1,$2)',[id(20),id(200)]),'42501');
  await f.asStudent(4,{aal:'aal2',amr:[{method:'totp',timestamp:Math.floor(Date.now()/1000)-601}]});await deny(read(f),'42501');
  await f.db.exec(`reset role;update auth.users set email_confirmed_at=null where id='${id(4)}';`);await aal2(f);await deny(read(f),'42501');await f.db.exec(`reset role;update auth.users set email_confirmed_at=now() where id='${id(4)}';`);
  await f.db.exec(`reset role;update client_users set revoked_at=now() where user_id='${id(4)}';`);await aal2(f);await deny(read(f),'42501');await f.db.exec(`reset role;update client_users set revoked_at=null where user_id='${id(4)}';delete from auth.sessions where user_id='${id(4)}';`);await aal2(f);await deny(read(f),'42501');
 }finally{await f.db.close();}
});
test('browser DML and anonymous invocation remain denied; latest withdrawal preserves historical content',async()=>{
 const f=await fixture();try{await insert(f);await aal2(f);await deny(f.db.query('select * from app_private.nutrition_personal_plan_versions'),'42501');await deny(f.db.query("delete from app_private.nutrition_personal_plan_versions"),'42501');
  await insert(f,2,null,'withdrawn');await aal2(f);const r=parsePersonalPlanState(await read(f),scope);assert.equal(r.status,'withdrawn');assert.equal(r.body,null);await f.db.exec('reset role');assert.equal((await f.db.query<{n:number}>('select count(*) n from app_private.nutrition_personal_plan_versions')).rows[0].n,2);await deny(f.db.exec('delete from app_private.nutrition_personal_plan_versions'),'55000');await f.db.exec('set role anon');await deny(read(f),'42501');
 }finally{await f.db.close();}
});
test('trusted provisioning rejects gaps, malformed quantities and forged document fields atomically',async()=>{
 const f=await fixture();try{await assert.rejects(insert(f,2));const bad=body();bad.meals[0].primary.items[0].quantity.unit='ml';await assert.rejects(insert(f,1,bad));await assert.rejects(insert(f,1,{...body(),actorId:id(8)}));await insert(f);await assert.rejects(insert(f));await f.db.exec('reset role');assert.equal((await f.db.query<{n:number}>('select count(*) n from app_private.nutrition_personal_plan_versions')).rows[0].n,1);
  const p=(await f.db.query<{d:boolean;a:boolean;c:string[]}> ("select prosecdef d,has_function_privilege('anon',oid,'execute') a,proconfig c from pg_proc where oid='public.aura_student_nutrition_plan_read(uuid,uuid)'::regprocedure")).rows[0];assert.equal(p.d,false);assert.equal(p.a,false);assert.ok(p.c.includes('search_path=""'));
 }finally{await f.db.close();}
});
test('foreign/malformed or late responses never become a personal plan and no professional fallback exists',async()=>{
 const valid={scope,revision:1,status:'available',recordedAt:'2026-11-14T12:00:00Z',sourceLabel:'Fonte fictícia',body:body()};
 for(const bad of [{...valid,scope:{...scope,userId:id(8)}},{...valid,revision:0},{...valid,body:null},{...valid,body:{...body(),extra:true}}])assert.throws(()=>parsePersonalPlanState(bad,scope));
 let release!:(v:{data:unknown;error:null})=>void;const names:string[]=[];const reader=createPersonalPlanReader({rpc(name){names.push(name);return {abortSignal:()=>new Promise(resolve=>{release=resolve;})};}},scope);const pending=reader.read();reader.dispose();release({data:valid,error:null});await assert.rejects(pending,{kind:'stale'});assert.deepEqual(names,['aura_student_nutrition_plan_read']);
 await assert.rejects(createPersonalPlanReader({rpc(){return {abortSignal:async()=>({data:null,error:{code:'42501'}})};}},scope).read(),{kind:'denied'});
});
test('own plan export includes every immutable version and withdrawal in one snapshot; truncated or foreign history is rejected',async()=>{
 const f=await fixture();try{for(let n=1;n<=23;n++)await insert(f,n,n===23?null:body(),n===23?'withdrawn':'available');await aal2(f);
  const raw=(await f.db.query<{x:unknown}>('select aura_student_nutrition_plan_export($1,$2) x',[scope.organizationId,scope.clientId])).rows[0].x,exported=parsePersonalPlanExport(raw,scope);assert.equal(exported.count,23);assert.equal(exported.versions[22].status,'withdrawn');
  assert.throws(()=>parsePersonalPlanExport({...exported,versions:exported.versions.slice(1),count:22},scope));assert.throws(()=>parsePersonalPlanExport({...exported,scope:{...scope,userId:id(8)}},scope));
  await f.asStudent(8);await deny(f.db.query('select aura_student_nutrition_plan_export($1,$2)',[scope.organizationId,scope.clientId]),'42501');
 }finally{await f.db.close();}
});
