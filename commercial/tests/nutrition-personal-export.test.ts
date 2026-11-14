import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
import {personalFixture,personalCommand} from './nutrition-personal-fixture';import {id} from './foundation-fixture';import {deny,nutritionAccess} from './nutrition-db-fixture';
import {parsePersonalNutritionExport,createPersonalNutritionExport} from '../lib/nutrition-personal-export';
const scope={organizationId:id(10),clientId:id(100),userId:id(4)};
async function setup(){const f=await personalFixture();await f.db.exec('reset role;begin;'+await readFile(new URL('../supabase/prepared/20261113225825_nutrition_personal_targets.sql',import.meta.url),'utf8')+await readFile(new URL('../supabase/prepared/20261114003207_nutrition_personal_export.sql',import.meta.url),'utf8')+'commit;');await f.asStudent();return f;}
const read=async(f:Awaited<ReturnType<typeof setup>>)=>(await f.db.query<{x:unknown}>('select aura_student_nutrition_export($1,$2) x',[scope.organizationId,scope.clientId])).rows[0].x;
test('complete own export includes every version beyond diary pages, void snapshots, references, audit and receipts',async()=>{
 const f=await setup();try{const c=personalCommand(),saved=(await f.db.query<{x:{mealId:string}}> ('select aura_student_nutrition_meal_save($1,$2,$3::jsonb) x',[id(10),id(100),JSON.stringify(c)])).rows[0].x;
  for(let n=1;n<=22;n++)await f.db.query('select aura_student_nutrition_meal_save($1,$2,$3::jsonb)',[id(10),id(100),JSON.stringify({...c,requestId:id(8000+n),mealId:saved.mealId,expectedRevision:n,operation:n===22?'void':'save',items:n===22?[]:c.items})]);
  const target={contractVersion:1,requestId:id(9001),expectedRevision:0,targetDate:c.consumedOn,targets:{contractVersion:1,source:'manual',nutrients:{calories:1800,protein:null,carbs:null,fat:null}},reason:'Synthetic export reference'};
  await f.db.query('select aura_student_nutrition_targets_save($1,$2,$3::jsonb)',[id(10),id(100),JSON.stringify(target)]);
  const value=parsePersonalNutritionExport(await read(f),scope);assert.equal(value.complete,true);assert.equal(value.counts.meals,1);assert.equal(value.counts.mealVersions,23);assert.equal(value.counts.items,23);assert.equal(value.counts.mealRequests,23);assert.equal(value.counts.mealEvents,23);assert.equal(value.counts.targetVersions,1);assert.equal(value.data.mealVersions.at(-1)?.status,'voided');assert.equal(value.data.items.at(-1)?.source_kind,'manual');
  const before=JSON.stringify(value.data);await f.db.query('select aura_student_nutrition_meal_save($1,$2,$3::jsonb)',[id(10),id(100),JSON.stringify({...c,requestId:id(9900)})]);assert.equal(JSON.stringify(value.data),before);assert.equal(parsePersonalNutritionExport(await read(f),scope).counts.meals,2);
  const hash=(await f.db.query<{x:string}>('select encode(sha256(convert_to(($1::jsonb)::text,\'UTF8\')),\'hex\') x',[JSON.stringify(value.data)])).rows[0].x;assert.equal(value.sha256,hash);
 }finally{await f.db.close();}
});
test('export is readable when archived but denied to professionals, another account, organization, unconfirmed user and revoked link/session',async()=>{
 const f=await setup();try{
  parsePersonalNutritionExport(await read(f),scope);await f.db.exec(`reset role;update clients set archived_at=now() where id='${id(100)}'`);await f.asStudent();assert.equal(parsePersonalNutritionExport(await read(f),scope).counts.meals,0);
  await nutritionAccess(f);await deny(read(f),'42501');await f.asStudent(8);await deny(read(f),'42501');await f.asStudent();await deny(f.db.query('select aura_student_nutrition_export($1,$2)',[id(20),id(200)]),'42501');
  await f.db.exec(`reset role;update auth.users set email_confirmed_at=null where id='${id(4)}'`);await f.asStudent();await deny(read(f),'42501');await f.db.exec(`reset role;update auth.users set email_confirmed_at=now() where id='${id(4)}';update client_users set revoked_at=now() where client_id='${id(100)}'`);await f.asStudent();await deny(read(f),'42501');
  await f.db.exec(`reset role;update client_users set revoked_at=null where client_id='${id(100)}';delete from auth.sessions where user_id='${id(4)}'`);await f.asStudent();await deny(read(f),'42501');
 }finally{await f.db.close();}
});
test('export wrappers are INVOKER with empty search_path, no anonymous grant and no account/session credential payload',async()=>{
 const f=await setup();try{const exported=parsePersonalNutritionExport(await read(f),scope);assert.ok(!/password|refresh_token|access_token|totp_secret/.test(JSON.stringify(exported)));await f.db.exec('reset role');const r=(await f.db.query<{d:boolean;a:boolean;c:string[]}> ("select p.prosecdef d,has_function_privilege('anon',p.oid,'execute') a,p.proconfig c from pg_proc p where p.oid='public.aura_student_nutrition_export(uuid,uuid)'::regprocedure")).rows[0];assert.equal(r.d,false);assert.equal(r.a,false);assert.ok(r.c.includes('search_path=""'));}finally{await f.db.close();}
});
test('changed MFA policy rejects an unchanged AAL1 claim before export',async()=>{
 const f=await setup();try{await f.db.exec(`reset role;insert into app_private.organization_security(organization_id,require_sensitive_aal2,revision,updated_by) values('${id(10)}',true,1,'${id(1)}');`);await f.asStudent();await deny(read(f),'42501');await f.db.exec(`reset role;insert into auth.mfa_factors(user_id,status,factor_type) values('${id(4)}','verified','totp');`);await f.asStudent(4,{aal:'aal2',amr:[{method:'totp',timestamp:Math.floor(Date.now()/1000)}]});assert.equal(parsePersonalNutritionExport(await read(f),scope).complete,true);}finally{await f.db.close();}
});
test('interactive limit refuses the entire export instead of truncating historical records',async()=>{
 const f=await setup();try{
  await f.db.exec(`reset role;begin;create temporary table synthetic_export_heads as select gen_random_uuid() id,('2000-01-01'::date+n) target_day from generate_series(1,10001) n;
   insert into nutrition_personal_targets(id,organization_id,client_id,personal_user_id,target_date,current_revision) select id,'${id(10)}','${id(100)}','${id(4)}',target_day,1 from synthetic_export_heads;
   insert into nutrition_personal_target_versions(target_id,organization_id,client_id,personal_user_id,revision,targets,reason) select id,'${id(10)}','${id(100)}','${id(4)}',1,'{"contractVersion":1,"source":"manual","nutrients":{"calories":null,"protein":null,"carbs":null,"fat":null}}','Synthetic volume' from synthetic_export_heads;commit;`);
  await f.asStudent();await deny(read(f),'54000');
 }finally{await f.db.close();}
});
test('export transport refuses partial, foreign, truncated-history and malformed manifests instead of creating files',async()=>{
 const f=await setup();try{const c=personalCommand();await f.db.query('select aura_student_nutrition_meal_save($1,$2,$3::jsonb)',[id(10),id(100),JSON.stringify(c)]);const good=parsePersonalNutritionExport(await read(f),scope);
  const partial=structuredClone(good);partial.data.mealVersions=[];partial.counts.mealVersions=0;const foreign=structuredClone(good);foreign.data.meals[0].personal_user_id=id(8);
  for(const bad of [{...good,complete:false},{...good,scope:{...scope,userId:id(8)}},{...good,counts:{...good.counts,items:99}},partial,foreign])assert.throws(()=>parsePersonalNutritionExport(bad,scope));
  let release:()=>void=()=>{};const repo=createPersonalNutritionExport({rpc(){return {abortSignal:()=>new Promise(resolve=>release=()=>resolve({data:good,error:null}))};}},scope),pending=repo.read();repo.dispose();release();await assert.rejects(pending,{kind:'stale'});
  await assert.rejects(createPersonalNutritionExport({rpc(){return {abortSignal:async()=>({data:null,error:{code:'54000'}})};}},scope).read(),/nenhum ficheiro parcial/);
 }finally{await f.db.close();}
});
