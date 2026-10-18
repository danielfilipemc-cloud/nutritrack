import {test} from 'node:test';
import assert from 'node:assert/strict';
import {foundationFixture,id} from './foundation-fixture';
import {composition,nutritionAccess,deny} from './nutrition-db-fixture';
import {businessToday} from '../lib/care';
const org=id(10),client=id(100),today=businessToday();
type Fixture=Awaited<ReturnType<typeof foundationFixture>>;
type Meal={mealId:string;revision:number;consumedOn:string;status:string;items:{quantity:{amount:number}}[]};
async function seed(f:Fixture,ids:number[]){await f.db.exec('reset role;begin;');try{
 for(const n of ids){await f.db.query('insert into nutrition_meals(id,organization_id,client_id,current_revision,created_by) values($1,$2,$3,1,$4)',[id(n),org,client,id(2)]);await f.db.query("insert into nutrition_meal_versions(meal_id,organization_id,client_id,revision,consumed_on,meal_kind,recorded_by) values($1,$2,$3,1,$4,'breakfast',$5)",[id(n),org,client,today,id(2)]);await f.db.query("insert into nutrition_meal_items values($1,1,$2,$3,1,'Synthetic pagination food',100,$4::jsonb,'manual')",[id(n),org,client,JSON.stringify(composition)]);}
 await f.db.exec('commit');}catch(error){await f.db.exec('rollback');throw error;}await f.asUser(2);
}
async function edit(f:Fixture,meal:number,revision:number,request:number,date=today){const value={contractVersion:1,requestId:id(request),mealId:id(meal),expectedRevision:revision,consumedOn:date,mealKind:'breakfast',operation:'save',items:[{label:'Synthetic revision',quantity:{amount:50,unit:'g'},composition,source:'manual'}]};return f.db.query('select aura_nutrition_meal_save($1,$2,$3::jsonb)',[org,client,JSON.stringify(value)]);}
async function diary(f:Fixture,after:string|null=null){return (await f.db.query<{x:{meals:Meal[];nextCursor:string|null}}>('select aura_nutrition_diary($1,$2,$3,$4) x',[org,client,today,after])).rows[0].x;}
async function history(f:Fixture,meal:number,before:number|null=null){return (await f.db.query<{x:{versions:Meal[];nextCursor:number|null}}>('select aura_nutrition_history($1,$2,$3,$4) x',[org,client,id(meal),before])).rows[0].x;}

test('diary keysets tolerate interleaved writes but do not promise a complete or current multi-page snapshot',async()=>{
 const f=await foundationFixture();try{
  await nutritionAccess(f);await seed(f,Array.from({length:22},(_,i)=>1000+i));const first=await diary(f);assert.equal(first.nextCursor,id(1019));
  await seed(f,[999,1022]);await edit(f,1005,1,2000,'2000-01-01');await edit(f,1020,1,2001,'2000-01-01');
  const second=await diary(f,first.nextCursor);assert.deepEqual(second.meals.map(m=>m.mealId),[id(1021),id(1022)]);assert.equal(second.nextCursor,null);
  const mixed=[...first.meals,...second.meals];assert.equal(new Set(mixed.map(m=>m.mealId)).size,mixed.length);assert.ok(!mixed.some(m=>m.mealId===id(999)));assert.ok(mixed.some(m=>m.mealId===id(1005)));
  const refreshed:Meal[]=[];let cursor:string|null=null;do{const page=await diary(f,cursor);refreshed.push(...page.meals);cursor=page.nextCursor;}while(cursor);
  assert.equal(refreshed.length,22);assert.ok(refreshed.some(m=>m.mealId===id(999)));assert.ok(!refreshed.some(m=>[id(1005),id(1020)].includes(m.mealId)));
  assert.notDeepEqual(mixed.map(m=>m.mealId).sort(),refreshed.map(m=>m.mealId).sort(),'null nextCursor cannot certify a coherent multi-request export');
  assert.equal((await history(f,1005)).versions.length,2);
 }finally{await f.db.close();}
});
test('new history revisions do not duplicate older keyset pages and require refreshing the newest page',async()=>{
 const f=await foundationFixture();try{
  await nutritionAccess(f);await seed(f,[1000]);for(let rev=1;rev<=21;rev++)await edit(f,1000,rev,3000+rev);
  const first=await history(f,1000);assert.equal(first.nextCursor,3);await edit(f,1000,22,3022);
  const second=await history(f,1000,first.nextCursor);assert.deepEqual(second.versions.map(v=>v.revision),[2,1]);assert.equal(second.nextCursor,null);
  const mixed=[...first.versions,...second.versions];assert.equal(new Set(mixed.map(v=>v.revision)).size,22);assert.ok(!mixed.some(v=>v.revision===23));assert.equal((await history(f,1000)).versions[0].revision,23);
  assert.equal(second.versions[1].items[0].quantity.amount,100,'original snapshot preserved');
 }finally{await f.db.close();}
});
test('resuming a cursor after assignment, capability or MFA revocation is denied rather than silently emptied',async()=>{
 const f=await foundationFixture();try{
  await nutritionAccess(f);await seed(f,Array.from({length:22},(_,i)=>1000+i));const first=await diary(f);assert.ok(first.nextCursor);
  await f.asUser(1);await f.db.query('select aura_assignment_save($1,$2,$3,false)',[org,client,id(2)]);await f.asUser(2);await deny(diary(f,first.nextCursor));await deny(history(f,1000,1));
  await nutritionAccess(f);await f.asUser(1);await f.db.query('select aura_nutrition_capability_save($1,$2,false,false)',[org,id(2)]);await f.asUser(2);await deny(diary(f,first.nextCursor));
  await nutritionAccess(f);await f.db.exec(`reset role;insert into app_private.organization_security(organization_id,require_sensitive_aal2,revision,updated_by) values('${org}',true,1,'${id(1)}')`);await f.asUser(2);await deny(diary(f,first.nextCursor));
  await f.db.exec('reset role');assert.equal((await f.db.query('select * from nutrition_meal_versions')).rows.length,22);
 }finally{await f.db.close();}
});
