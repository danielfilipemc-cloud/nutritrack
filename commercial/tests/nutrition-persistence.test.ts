import test from 'node:test';
import assert from 'node:assert/strict';
import {createNutritionPersistence,NutritionPersistenceError,type NutritionRpcClient} from '../lib/nutrition-persistence';
import {foundationFixture,id} from './foundation-fixture';
import {nutritionAccess,composition} from './nutrition-db-fixture';
import {businessToday} from '../lib/care';
const context={organizationId:id(10),clientId:id(100)};
const command=(n=8100)=>({contractVersion:1,requestId:id(n),mealId:null,expectedRevision:0,consumedOn:businessToday(),mealKind:'breakfast',operation:'save',items:[{label:'Alimento fictício',quantity:{amount:100,unit:'g'},composition,source:'manual'}]});
test('inactive adapter persists/corrects/voids through existing authorized SQL, recovers receipt and denies revoked access',async()=>{
 const f=await foundationFixture();try{
  await nutritionAccess(f);
  const queries:Record<string,string>={aura_nutrition_meal_save:'select aura_nutrition_meal_save($1,$2,$3::jsonb) x',aura_nutrition_request_status:'select aura_nutrition_request_status($1,$2,$3) x',aura_nutrition_diary:'select aura_nutrition_diary($1,$2,$3,$4) x',aura_nutrition_history:'select aura_nutrition_history($1,$2,$3,$4) x'};
  const client:NutritionRpcClient={rpc(name,a){return {async abortSignal(){try{assert.ok(queries[name]);const values=name==='aura_nutrition_meal_save'?[JSON.stringify(a.p_command)]:name==='aura_nutrition_request_status'?[a.p_request]:name==='aura_nutrition_diary'?[a.p_date,a.p_after]:[a.p_meal,a.p_before];return {data:(await f.db.query<{x:unknown}>(queries[name],[a.p_org,a.p_client,...values])).rows[0].x,error:null};}catch(e){return {data:null,error:{code:(e as {code:string}).code}};}}}}};
  const repo=createNutritionPersistence(client,context,businessToday),input=command();assert.equal(await repo.requestStatus(input.requestId),null);
  const first=await repo.save(input);assert.equal(first.revision,1);assert.equal((await repo.save(input)).replayed,true);assert.equal((await repo.requestStatus(input.requestId))?.mealId,first.mealId);
  const edit={...command(8101),mealId:first.mealId,expectedRevision:1};edit.items[0].quantity.amount=50;await repo.save(edit);
  assert.equal((await repo.diary(businessToday())).meals[0].items[0].quantity.amount,50);
  await repo.save({...command(8102),mealId:first.mealId,expectedRevision:2,operation:'void',items:[]});
  const h=await repo.history(first.mealId);assert.equal(h.versions.length,3);assert.equal(h.versions[0].status,'voided');assert.equal(h.versions[2].items[0].quantity.amount,100);
  await f.asUser(1);await f.db.query('select aura_assignment_save($1,$2,$3,false)',[id(10),id(100),id(2)]);await f.asUser(2);
  await assert.rejects(()=>repo.diary(businessToday()),(e:NutritionPersistenceError)=>e.kind==='denied');repo.dispose();
  await assert.rejects(()=>repo.requestStatus(input.requestId),(e:NutritionPersistenceError)=>e.kind==='stale');
 }finally{await f.db.close();}
});
test('adapter has no anonymous fallback, rejects late responses after scope change and never auto-retries uncertain saves',async()=>{
 let resolve!:(v:{data:unknown;error:null})=>void,calls=0;
 const client:NutritionRpcClient={rpc(){calls++;return {abortSignal(){return new Promise(r=>{resolve=r;});}}}};
 const repo=createNutritionPersistence(client,context,businessToday);const pending=repo.diary(businessToday());repo.dispose();resolve({data:{meals:[],nextCursor:null},error:null});
 await assert.rejects(()=>pending,(e:NutritionPersistenceError)=>e.kind==='stale');assert.equal(calls,1);
 const failing:NutritionRpcClient={rpc(){calls++;return {async abortSignal(){throw Error('network');}}}};
 const writer=createNutritionPersistence(failing,context,businessToday);await assert.rejects(()=>writer.save(command()),(e:NutritionPersistenceError)=>e.kind==='uncertain');assert.equal(calls,2);
 await assert.rejects(()=>writer.save({...command(),actorId:id(1)}));assert.equal(calls,2);
 const missing:NutritionRpcClient={rpc(){return {async abortSignal(){return {data:null,error:{code:'PGRST202'}};}}}};
 await assert.rejects(()=>createNutritionPersistence(missing,context,businessToday).diary(businessToday()),(e:NutritionPersistenceError)=>e.kind==='unavailable');
});
test('adapter validates projections and cursors instead of displaying malformed or cross-day results',async()=>{
 for(const data of [{meals:[],nextCursor:id(1)},{meals:[],nextCursor:null,unexpected:true},{meals:[{mealId:id(1)}],nextCursor:null}]){
  const client:NutritionRpcClient={rpc(){return {async abortSignal(){return {data,error:null};}}}};
  await assert.rejects(()=>createNutritionPersistence(client,context,businessToday).diary(businessToday()),(e:NutritionPersistenceError)=>e.kind==='invalid-response');
 }
});
