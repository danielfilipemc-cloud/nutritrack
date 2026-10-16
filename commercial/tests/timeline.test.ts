import {test} from 'node:test';
import assert from 'node:assert/strict';
import {foundationFixture,id} from './foundation-fixture';
import {appendTimeline,type TimelinePage} from '../lib/timeline';
const org=id(10),pupil=id(100);
test('integrated projection minimizes history, keeps only current measured versions and checks each competency',async()=>{
 const f=await foundationFixture();try{
  await f.grant(2,100);await f.asUser(2);
  const old=(await f.db.query<{id:string}>(`select aura_assessment_create('${org}','${pupil}',app_private.business_today(),80,175,null) id`)).rows[0].id;
  const corrected=(await f.db.query<{id:string}>(`select aura_assessment_correct('${org}',$1,1,app_private.business_today(),79,175,null,'Private correction reason') id`,[old])).rows[0].id;
  await assert.rejects(f.db.query(`select aura_assessment_create('${org}','${pupil}',app_private.business_today()+1,90,null,null)`),(e:any)=>e.code==='22023');
  const future=(await f.db.query<{id:string}>(`select aura_assessment_create('${org}','${pupil}',app_private.business_today(),90,null,null) id`)).rows[0].id;
  await f.db.exec(`reset role;update assessments set assessed_on=app_private.business_today()+1 where id='${future}'`);await f.asUser(2);
  await f.db.query(`select aura_followup_save('${org}','${pupil}','Private general focus','active',null,null,0)`);
  const goal=(await f.db.query<{id:string}>(`select aura_objective_save('${org}','${pupil}',null,'Private objective text','active',null,0) id`)).rows[0].id;
  await f.db.query(`select aura_objective_save('${org}','${pupil}',$1,'Private objective text','completed',null,1)`,[goal]);
  const read=async()=>(await f.db.query<{x:TimelinePage}>(`select aura_client_timeline('${org}','${pupil}') x`)).rows[0].x;
  let page=await read();assert.equal(page.total,4);assert.equal(page.items.filter(i=>i.kind==='assessment').length,1);assert.equal(page.items.find(i=>i.kind==='assessment')?.record_id,corrected);assert.equal(page.items.find(i=>i.kind==='assessment')?.details.weight_kg,79);
  const text=JSON.stringify(page);for(const forbidden of ['Private','actor_id','recorded_by','email','note','reason'])assert.ok(!text.includes(forbidden));
  await f.asUser(1);assert.equal((await read()).total,0,'no implicit access to sensitive modules');
  await f.db.query(`select aura_capability_save('${org}','${id(2)}','assessments',false,false)`);await f.asUser(2);page=await read();assert.equal(page.total,3);assert.ok(page.items.every(i=>i.kind!=='assessment'));
  await f.db.exec(`reset role;update clients set archived_at=now() where id='${pupil}'`);await f.asUser(2);assert.equal((await read()).total,3,'archive preserves readable authorized history');
  await f.asUser(1);await f.db.query(`select aura_assignment_save('${org}','${pupil}','${id(2)}',false)`);await f.asUser(2);await assert.rejects(read(),(e:any)=>e.code==='42501');
  await f.asUser(5);await assert.rejects(read(),(e:any)=>e.code==='42501');await f.asUser(4);await assert.rejects(read(),(e:any)=>e.code==='42501');
  await f.db.exec('reset role;set role anon');await assert.rejects(read());
 }finally{await f.db.close();}
});
test('timeline keyset pagination survives timestamp ties and rejects invalid bounds/cursors',async()=>{
 const f=await foundationFixture();try{
  await f.grant(2,100,['profile','followup']);await f.asUser(2);
  for(let n=0;n<31;n++)await f.db.query(`select aura_objective_save('${org}','${pupil}',null,'Synthetic objective','active',null,0)`);
  await f.db.exec(`reset role;update app_private.objective_events set created_at=app_private.business_today()::timestamp at time zone 'Europe/Lisbon'+interval '10 hours'`);await f.asUser(2);
  const read=async(before:string|null=null,key:string|null=null)=>(await f.db.query<{x:TimelinePage}>(`select aura_client_timeline('${org}','${pupil}',null,null,'objective',$1,$2) x`,[before,key])).rows[0].x;
  const a=await read(),b=await read(a.next!.before,a.next!.key);assert.equal(a.items.length,25);assert.equal(a.more,true);assert.equal(b.items.length,6);assert.equal(b.more,false);assert.equal(appendTimeline(a.items,b.items).length,31);assert.equal(appendTimeline(a.items,a.items).length,25);
  await assert.rejects(read(a.next!.before,null),(e:any)=>e.code==='22023');
  await assert.rejects(f.db.query(`select aura_client_timeline('${org}','${pupil}',null,app_private.business_today()+1)`),(e:any)=>e.code==='22023');
  await assert.rejects(f.db.query(`select aura_client_timeline('${org}','${pupil}',null,null,'nutrition')`),(e:any)=>e.code==='22023');
 }finally{await f.db.close();}
});
test('schedule-only professional sees appointment states without private followup or measurements',async()=>{
 const f=await foundationFixture();try{
  await f.grant(2,100);await f.asUser(2);
  await f.db.query(`select aura_followup_save('${org}','${pupil}','Hidden focus','active',null,null,0)`);
  await f.db.query(`select aura_appointment_save('${org}',null,'${pupil}','${id(2)}','session','scheduled',app_private.business_today()::timestamp at time zone 'Europe/Lisbon'+interval '10 hours',app_private.business_today()::timestamp at time zone 'Europe/Lisbon'+interval '11 hours',0)`);
  await f.asUser(1);const x=(await f.db.query<{x:TimelinePage}>(`select aura_client_timeline('${org}','${pupil}') x`)).rows[0].x;
  assert.equal(x.total,1);assert.equal(x.items[0].kind,'appointment');assert.equal(x.items[0].action,'scheduled');assert.ok(!JSON.stringify(x).includes('Hidden'));
 }finally{await f.db.close();}
});
