import {test} from 'node:test';
import assert from 'node:assert/strict';
import {foundationFixture,id} from './foundation-fixture';
import {composition,deny,nutritionAccess} from './nutrition-db-fixture';
import {parseNutritionCommandV1,type NutritionCommandV1} from '../lib/nutrition-command';
import {businessToday} from '../lib/care';
const org=id(10),pupil=id(100);
const command=(request=800):NutritionCommandV1=>({contractVersion:1,requestId:id(request),mealId:null,expectedRevision:0,consumedOn:businessToday(),mealKind:'breakfast',operation:'save',items:[{label:'Synthetic food',quantity:{amount:100,unit:'g'},composition:structuredClone(composition),source:'manual'}]});
type Fixture=Awaited<ReturnType<typeof foundationFixture>>;
type Receipt={mealId:string;revision:number;replayed:boolean};
async function save(f:Fixture,value:unknown,client=pupil,organization=org){return (await f.db.query<{x:Receipt}>('select aura_nutrition_meal_save($1,$2,$3::jsonb) x',[organization,client,JSON.stringify(value)])).rows[0].x;}
async function history(f:Fixture,meal:string,before:number|null=null){return (await f.db.query<{x:{versions:any[];nextCursor:number|null}}>('select aura_nutrition_history($1,$2,$3,$4) x',[org,pupil,meal,before])).rows[0].x;}
async function receipt(f:Fixture,request:string){return (await f.db.query<{x:Receipt|null}>('select aura_nutrition_request_status($1,$2,$3) x',[org,pupil,request])).rows[0].x;}

test('nutrition commands reject forged identity/source, units, malformed dates and partial payloads in both parsers',async()=>{
 const f=await foundationFixture();try{
  await nutritionAccess(f);const good=command();assert.deepEqual(parseNutritionCommandV1(good,businessToday()),good);
  const invalid:unknown[]=[null,{}, {...good,contractVersion:2},{...good,actor:id(5)},{...good,organizationId:id(20)}, {...good,requestId:'not-uuid'}, {...good,mealId:id(700)}, {...good,mealKind:null}, {...good,operation:null}, {...good,expectedRevision:0.5}, {...good,expectedRevision:Number.MAX_SAFE_INTEGER+1}, {...good,consumedOn:'2026-02-30'}, {...good,items:[]}, {...good,items:Array(51).fill(good.items[0])}, {...good,items:[{...good.items[0],source:'nutritrack'}]}, {...good,items:[{...good.items[0],actor:id(5)}]}, {...good,items:[{...good.items[0],quantity:{amount:0,unit:'g'}}]}, {...good,items:[{...good.items[0],quantity:{amount:100,unit:'ml'}}]}, {...good,items:[{...good.items[0],composition:{...composition,basis:{amount:100,unit:'ml'}}}]}];
  for(const value of invalid){assert.throws(()=>parseNutritionCommandV1(value,businessToday()));await deny(save(f,value),'22023');}
  await deny(save(f,{...good,consumedOn:'9999-12-31'}),'22023');assert.throws(()=>parseNutritionCommandV1({...good,consumedOn:'9999-12-31'},businessToday()));
  assert.equal((await f.db.query('select * from nutrition_meals')).rows.length,0);
 }finally{await f.db.close();}
});
test('lost acknowledgement is recovered by actor-scoped receipt and canonical idempotency without duplicate audit',async()=>{
 const f=await foundationFixture();try{
  await nutritionAccess(f);const value=command();assert.equal(await receipt(f,value.requestId),null);
  const first=await save(f,value);assert.equal(first.revision,1);assert.equal(first.replayed,false);
  assert.deepEqual(await receipt(f,value.requestId),{mealId:first.mealId,revision:1});assert.deepEqual(await save(f,value),{...first,replayed:true});
  // Whitespace, JSON field order and numeric scale do not create false retries.
  const raw=JSON.stringify(value).replace('"amount":100','"amount":100.000');const replay=(await f.db.query<{x:Receipt}>('select aura_nutrition_meal_save($1,$2,$3::jsonb) x',[org,pupil,raw])).rows[0].x;assert.equal(replay.replayed,true);
  await deny(save(f,{...value,mealKind:'lunch'}),'PT409');
  await f.db.exec('reset role');assert.equal((await f.db.query('select * from app_private.nutrition_requests')).rows.length,1);const events=(await f.db.query('select * from app_private.nutrition_events')).rows;assert.equal(events.length,1);assert.ok(!JSON.stringify(events).includes('Synthetic food'));
  await f.asUser(1);await f.db.query(`select aura_nutrition_capability_save('${org}','${id(2)}',false,false)`);await f.asUser(2);await deny(save(f,value));await deny(receipt(f,value.requestId));
 }finally{await f.db.close();}
});
test('meal corrections preserve immutable compositions, CAS prevents lost edits, void appends rather than erases',async()=>{
 const f=await foundationFixture();try{
  await nutritionAccess(f);const value=command(),first=await save(f,value);
  const edit={...command(801),mealId:first.mealId,expectedRevision:1};edit.items[0].quantity.amount=50;
  const rival={...command(802),mealId:first.mealId,expectedRevision:1};rival.items[0].composition.nutrients.calories=200;
  const results=await Promise.allSettled([save(f,edit),save(f,rival)]);assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(results.filter(r=>r.status==='rejected'&&r.reason.code==='PT409').length,1);
  const versions=await history(f,first.mealId);assert.equal(versions.versions.length,2);assert.equal(versions.versions[1].items[0].composition.nutrients.calories,101);assert.equal(versions.versions[1].items[0].quantity.amount,100);
  assert.deepEqual(await save(f,value),{...first,replayed:true});
  const voidCommand={...command(803),mealId:first.mealId,expectedRevision:2,operation:'void',items:[]};await save(f,voidCommand);const after=await history(f,first.mealId);assert.equal(after.versions.length,3);assert.equal(after.versions[0].status,'voided');assert.deepEqual(after.versions[0].items,after.versions[1].items);
  await deny(save(f,{...command(804),mealId:first.mealId,expectedRevision:3}),'23514');
  await f.db.exec('reset role');await deny(f.db.query('update nutrition_meal_versions set meal_kind=\'other\''),'55000');await f.asUser(2);await deny(f.db.query('delete from nutrition_meal_items'));
 }finally{await f.db.close();}
});
test('nutrition command rolls back headers, items, receipts and audit on an injected late database failure',async()=>{
 const f=await foundationFixture();try{
  await nutritionAccess(f);await f.db.exec(`reset role;create function app_private.synthetic_nutrition_failure() returns trigger language plpgsql as $$begin if new.label='Synthetic fail' then raise exception using errcode='23514',message='Synthetic constraint failure';end if;return new;end;$$;
   create trigger synthetic_nutrition_failure before insert on nutrition_meal_items for each row execute function app_private.synthetic_nutrition_failure();`);await f.asUser(2);
  const value=command();value.items.push({...value.items[0],label:'Synthetic fail'});await deny(save(f,value),'23514');
  await f.db.exec('reset role');for(const table of ['public.nutrition_meals','public.nutrition_meal_versions','public.nutrition_meal_items','app_private.nutrition_requests','app_private.nutrition_events'])assert.equal((await f.db.query('select * from '+table)).rows.length,0,table);
  await f.asUser(2);assert.equal((await save(f,command())).revision,1);
 }finally{await f.db.close();}
});
test('nutrition RPCs revalidate role, assignment, tenant, capability and archive; internal projection is inaccessible',async()=>{
 const f=await foundationFixture();try{
  await nutritionAccess(f);const value=command(),first=await save(f,value);
  for(const actor of [1,3,4,5,7]){await f.asUser(actor);await deny(save(f,command(805)));await deny(history(f,first.mealId));await deny(receipt(f,value.requestId));}
  await nutritionAccess(f,false);await deny(save(f,command(805)));await deny(receipt(f,value.requestId));assert.equal((await history(f,first.mealId)).versions.length,1);
  await nutritionAccess(f);await deny(save(f,command(806),id(200),id(20)));await deny(save(f,command(806),id(101)));await deny(f.db.query('select app_private.nutrition_projection($1,1)',[first.mealId]));
  await f.asUser(1);await f.db.query(`select aura_assignment_save('${org}','${pupil}','${id(2)}',false)`);await f.asUser(2);await deny(save(f,value));await deny(history(f,first.mealId));
  await nutritionAccess(f);await f.db.exec(`reset role;update clients set archived_at=now() where id='${pupil}'`);await f.asUser(2);await deny(save(f,command(807)),'23514');assert.equal((await history(f,first.mealId)).versions.length,1);
 }finally{await f.db.close();}
});
test('nutrition diary and revision history expose stable cursors rather than silently truncate',async()=>{
 const f=await foundationFixture();try{
  await nutritionAccess(f);const meals=[];for(let i=0;i<22;i++)meals.push(await save(f,command(900+i)));
  const diary=async(after:string|null=null)=>(await f.db.query<{x:{meals:{mealId:string}[];nextCursor:string|null}}>('select aura_nutrition_diary($1,$2,$3,$4) x',[org,pupil,businessToday(),after])).rows[0].x;
  const first=await diary();assert.equal(first.meals.length,20);assert.ok(first.nextCursor);const second=await diary(first.nextCursor);assert.equal(second.meals.length,2);assert.equal(second.nextCursor,null);assert.equal(new Set([...first.meals,...second.meals].map(m=>m.mealId)).size,22);
  const meal=meals[0].mealId;for(let rev=1;rev<=21;rev++)await save(f,{...command(1000+rev),mealId:meal,expectedRevision:rev});
  const page=await history(f,meal);assert.equal(page.versions.length,20);assert.equal(page.nextCursor,3);const end=await history(f,meal,page.nextCursor);assert.deepEqual(end.versions.map(v=>v.revision),[2,1]);assert.equal(end.nextCursor,null);
 }finally{await f.db.close();}
});
test('nutrition mutation and receipt fail closed when MFA policy or live session changes',async()=>{
 const f=await foundationFixture();try{
  await nutritionAccess(f);const value=command();await save(f,value);
  await f.db.exec(`reset role;create table auth.sessions(id uuid,user_id uuid,not_after timestamptz);create table auth.mfa_factors(user_id uuid,status text,factor_type text);
   insert into auth.sessions values('${id(999)}','${id(2)}',null);insert into auth.mfa_factors values('${id(2)}','verified','totp');
   insert into app_private.organization_security(organization_id,require_sensitive_aal2,revision,updated_by) values('${org}',true,1,'${id(1)}');`);
  await f.asUser(2);await deny(save(f,value),'PT403');await deny(receipt(f,value.requestId),'PT403');
  const claims={aal:'aal2',session_id:id(999),amr:[{method:'totp',timestamp:Math.floor(Date.now()/1000)}]};await f.db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify(claims)]);
  assert.ok(await receipt(f,value.requestId));await save(f,command(808));
  await f.db.exec(`reset role;update auth.sessions set not_after=now()-interval '1 second'`);await f.asUser(2);await deny(save(f,command(809)),'PT403');await deny(receipt(f,value.requestId),'PT403');
 }finally{await f.db.close();}
});
test('fully authorized professionals in A and B cannot cross tenant or pupil boundaries, even with guessed meal/request UUIDs',async()=>{
 const f=await foundationFixture();try{
  await nutritionAccess(f);const value=command(),a=await save(f,value);
  await deny(f.db.query(`insert into nutrition_meals(id,organization_id,client_id,current_revision,created_by) values('${id(799)}','${org}','${pupil}',1,'${id(5)}')`));
  await f.asUser(1);await f.db.query(`select aura_assignment_save('${org}','${id(101)}','${id(2)}',true)`);await f.asUser(2);
  await deny(save(f,value,id(101)),'PT409');await deny(save(f,{...command(810),mealId:a.mealId,expectedRevision:1},id(101)));
  await deny(f.db.query('select aura_nutrition_history($1,$2,$3)',[org,id(101),a.mealId]));
  assert.equal((await f.db.query<{x:unknown}>('select aura_nutrition_request_status($1,$2,$3) x',[org,id(101),value.requestId])).rows[0].x,null);
  await f.asUser(5);await f.db.query(`select aura_nutrition_capability_save('${id(20)}','${id(5)}',true,true)`);await f.db.query(`select aura_assignment_save('${id(20)}','${id(200)}','${id(5)}',true)`);
  const b=await save(f,command(811),id(200),id(20));assert.deepEqual((await f.db.query<{id:string}>('select id from nutrition_meals')).rows.map(row=>row.id),[b.mealId]);await deny(history(f,a.mealId));
  await f.asUser(2);assert.deepEqual((await f.db.query<{id:string}>('select id from nutrition_meals')).rows.map(row=>row.id),[a.mealId]);await deny(f.db.query('select aura_nutrition_history($1,$2,$3)',[id(20),id(200),b.mealId]));
 }finally{await f.db.close();}
});
