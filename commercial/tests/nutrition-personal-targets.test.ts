import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
import {personalFixture} from './nutrition-personal-fixture';import {id} from './foundation-fixture';import {businessToday} from '../lib/care';
import {createPersonalTargetPersistence,parsePersonalTargetCommand,type PersonalTargetCommand} from '../lib/nutrition-personal-targets';
import type {NutritionRpcClient} from '../lib/nutrition-persistence';import {deny,nutritionAccess} from './nutrition-db-fixture';
export const targetsSql=new URL('../supabase/prepared/20261113225825_nutrition_personal_targets.sql',import.meta.url);
export const targetCommand=(request=7000):PersonalTargetCommand=>({contractVersion:1,requestId:id(request),expectedRevision:0,targetDate:businessToday(),targets:{contractVersion:1,source:'manual',nutrients:{calories:1800,protein:90,carbs:null,fat:60}},reason:'Referência fictícia'});
export async function targetFixture(){const f=await personalFixture();await f.db.exec('reset role;begin;'+await readFile(targetsSql,'utf8')+'commit;');await f.asStudent();return f;}
export function targetRpc(f:Awaited<ReturnType<typeof targetFixture>>):NutritionRpcClient{
 const mapping:Record<string,{sql:string;args:(a:Record<string,unknown>)=>unknown[]}>={
  aura_student_nutrition_targets_read:{sql:'select aura_student_nutrition_targets_read($1,$2,$3) x',args:a=>[a.p_org,a.p_client,a.p_date]},
  aura_student_nutrition_targets_save:{sql:'select aura_student_nutrition_targets_save($1,$2,$3::jsonb) x',args:a=>[a.p_org,a.p_client,JSON.stringify(a.p_command)]},
  aura_student_nutrition_targets_request_status:{sql:'select aura_student_nutrition_targets_request_status($1,$2,$3) x',args:a=>[a.p_org,a.p_client,a.p_request]},
  aura_student_nutrition_targets_history:{sql:'select aura_student_nutrition_targets_history($1,$2,$3,$4) x',args:a=>[a.p_org,a.p_client,a.p_date,a.p_before]},
 };return {rpc(name,args){return {async abortSignal(signal){if(signal.aborted)throw Error();const m=mapping[name];if(!m)throw Error('Unexpected target RPC');try{return {data:(await f.db.query<{x:unknown}>(m.sql,m.args(args))).rows[0].x,error:null};}catch(e){return {data:null,error:{code:(e as {code:string}).code}};}}};}};
}
const context={organizationId:id(10),clientId:id(100)};
test('daily manual references synchronize through revisions, receipts and immutable history without inferring unknowns',async()=>{
 const f=await targetFixture();try{
  const repo=createPersonalTargetPersistence(targetRpc(f),context),c=targetCommand();assert.deepEqual(await repo.read(c.targetDate),{targetDate:c.targetDate,revision:0,targets:null});
  const saved=await repo.save(c);assert.equal(saved.revision,1);assert.deepEqual(await repo.save(c),{...saved,replayed:true});assert.deepEqual((await repo.read(c.targetDate)).targets,c.targets);
  const next={...targetCommand(7001),expectedRevision:1,targets:{...c.targets,nutrients:{...c.targets.nutrients,calories:1900}}};await repo.save(next);await assert.rejects(repo.save({...next,requestId:id(7002)}),{kind:'conflict'});
  assert.equal((await repo.history(c.targetDate)).versions.length,2);assert.deepEqual(await repo.requestStatus(c.requestId),{targetDate:c.targetDate,revision:1});
  const tomorrow='2027-01-01';assert.equal((await repo.read(tomorrow)).targets,null);assert.equal((await repo.read(c.targetDate)).targets?.nutrients.carbs,null);
  await f.db.exec('reset role');await deny(f.db.query('delete from nutrition_personal_target_versions'),'55000');
 }finally{await f.db.close();}
});
test('target parsers agree on forged actors, wrong units, absent fields, zero/negative references and invalid revisions',async()=>{
 const f=await targetFixture();try{
  const c=targetCommand();for(const bad of [{...c,actor:id(8)},{...c,contractVersion:2},{...c,expectedRevision:-1},{...c,targetDate:'2026-02-30'},{...c,reason:'x'},...[-1,0,10001,1.0001].map(calories=>({...c,targets:{...c.targets,nutrients:{...c.targets.nutrients,calories}}}))]){
   assert.throws(()=>parsePersonalTargetCommand(bad));await deny(f.db.query('select aura_student_nutrition_targets_save($1,$2,$3::jsonb)',[id(10),id(100),JSON.stringify(bad)]),'22023');
  }
  const unknown={...c,targets:{...c.targets,nutrients:{calories:null,protein:null,carbs:null,fat:null}}};await createPersonalTargetPersistence(targetRpc(f),context).save(unknown);
 }finally{await f.db.close();}
});
test('private targets never leak to assigned professionals, another account or another organization; live revocation denies old claims',async()=>{
 const f=await targetFixture();try{
  const repo=createPersonalTargetPersistence(targetRpc(f),context),c=targetCommand();await repo.save(c);await nutritionAccess(f);assert.equal((await f.db.query('select * from nutrition_personal_targets')).rows.length,0);await assert.rejects(repo.read(c.targetDate),{kind:'denied'});
  await f.asStudent(8);await assert.rejects(repo.history(c.targetDate),{kind:'denied'});await assert.rejects(repo.requestStatus(c.requestId),{kind:'denied'});
  await f.asStudent();await assert.rejects(createPersonalTargetPersistence(targetRpc(f),{organizationId:id(20),clientId:id(200)}).read(c.targetDate),{kind:'denied'});
  await f.db.exec(`reset role;update client_users set revoked_at=now() where client_id='${id(100)}'`);await f.asStudent();for(const action of [()=>repo.read(c.targetDate),()=>repo.history(c.targetDate),()=>repo.requestStatus(c.requestId),()=>repo.save({...targetCommand(7002),expectedRevision:1})])await assert.rejects(action(),{kind:'denied'});
 }finally{await f.db.close();}
});
test('target history pagination reaches every immutable revision and does not change other days',async()=>{
 const f=await targetFixture();try{
  const repo=createPersonalTargetPersistence(targetRpc(f),context),c=targetCommand();for(let n=0;n<22;n++)await repo.save({...c,requestId:id(7100+n),expectedRevision:n});
  const first=await repo.history(c.targetDate);assert.equal(first.versions.length,20);assert.equal(first.nextCursor,3);const last=await repo.history(c.targetDate,first.nextCursor);assert.deepEqual(last.versions.map(v=>v.revision),[2,1]);assert.equal(last.nextCursor,null);
  await assert.rejects(repo.save({...c,requestId:id(7100),reason:'Reused request changed'}),{kind:'conflict'});
 }finally{await f.db.close();}
});

test('lost target acknowledgement is recovered by the same actor receipt without an automatic duplicate write',async()=>{
 const f=await targetFixture();try{
  const transport=targetRpc(f);let saves=0;
  const repo=createPersonalTargetPersistence({rpc(name,args){const request=transport.rpc(name,args);return {async abortSignal(signal){const result=await request.abortSignal(signal);if(name.endsWith('_save')){saves++;throw Error('synthetic lost acknowledgement');}return result;}};}},context);
  const c=targetCommand();await assert.rejects(repo.save(c),{kind:'uncertain'});assert.deepEqual(await repo.requestStatus(c.requestId),{targetDate:c.targetDate,revision:1});assert.equal(saves,1);assert.equal((await repo.history(c.targetDate)).versions.length,1);
 }finally{await f.db.close();}
});
test('malformed target responses never masquerade as saved or complete references',async()=>{
 for(const data of [{targetDate:businessToday(),revision:0,targets:targetCommand().targets},{targetDate:'2000-01-01',revision:1,targets:targetCommand().targets},null]){
  const repo=createPersonalTargetPersistence({rpc(){return {abortSignal:async()=>({data,error:null})};}},context);await assert.rejects(repo.read(businessToday()),{kind:'invalid-response'});
 }
 const repo=createPersonalTargetPersistence({rpc(){return {abortSignal:async()=>({data:{targetDate:businessToday(),revision:99,replayed:true},error:null})};}},context);await assert.rejects(repo.save(targetCommand()),{kind:'uncertain'});
});
