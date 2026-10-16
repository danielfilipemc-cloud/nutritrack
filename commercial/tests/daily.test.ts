import {test} from 'node:test';
import assert from 'node:assert/strict';
import {foundationFixture,id} from './foundation-fixture';
import type {DailyQueue} from '../lib/daily';
const org=id(10),client=id(100);
test('daily priorities combine authorized modules, exclude inactive/future records and revoke immediately',async()=>{
 const f=await foundationFixture();try{
  await f.grant(2,100);await f.asUser(2);
  await f.db.query(`select aura_followup_save('${org}','${client}','Private focus','active',null,app_private.business_today()-2,0)`);
  await f.db.query(`select aura_objective_save('${org}','${client}',null,'Due objective','active',app_private.business_today(),0)`);
  await f.db.query(`select aura_objective_save('${org}','${client}',null,'Future objective','active',app_private.business_today()+1,0)`);
  await f.db.query(`select aura_appointment_save('${org}',null,'${client}','${id(2)}','session','scheduled',app_private.business_today()::timestamp at time zone 'Europe/Lisbon'+interval '10 hours',app_private.business_today()::timestamp at time zone 'Europe/Lisbon'+interval '11 hours',0)`);
  const queue=async(kind='all',search='',offset=0)=>(await f.db.query<{x:DailyQueue}>('select aura_daily_priorities($1,$2,$3,$4) x',[org,kind,search,offset])).rows[0].x;
  let q=await queue();assert.deepEqual(q.counts,{session:1,review:1,objective:1,assessment:1});assert.equal(q.total,4);assert.ok(!JSON.stringify(q).includes('Private focus'));
  assert.equal((await queue('objective')).items[0].label,'Due objective');assert.equal((await queue('all','%')).total,0);
  await f.asUser(1);assert.equal((await queue()).counts.objective,0,'manager has no implicit followup');
  await f.db.query(`select aura_capability_save('${org}','${id(2)}','followup',false,false)`);await f.asUser(2);
  q=await queue();assert.equal(q.counts.objective,0);assert.equal(q.counts.review,0);assert.equal(q.counts.assessment,1);
  await f.db.exec(`reset role;update clients set archived_at=now() where id='${client}'`);await f.asUser(2);assert.equal((await queue()).total,0);
  await f.asUser(5);await assert.rejects(queue(),(e:any)=>e.code==='42501');
  await f.db.exec('reset role;set role anon');await assert.rejects(queue());
 }finally{await f.db.close();}
});
test('daily queue counts beyond its page, stable ties, literal search and strict filters',async()=>{
 const f=await foundationFixture();try{
  await f.grant(2,100,['profile','followup']);await f.asUser(2);
  for(let n=0;n<28;n++)await f.db.query(`select aura_objective_save('${org}','${client}',null,$1,'active',app_private.business_today()-1,0)`,['Objective '+n]);
  const queue=async(offset=0)=>(await f.db.query<{x:DailyQueue}>('select aura_daily_priorities($1,\'objective\',\'Synthetic\',$2) x',[org,offset])).rows[0].x;
  const a=await queue(),b=await queue(25);assert.equal(a.total,28);assert.equal(a.items.length,25);assert.equal(b.items.length,3);assert.equal(new Set([...a.items,...b.items].map(i=>i.id)).size,28);
  for(const args of [['unknown','',0],['all','x'.repeat(101),0],['all','',-1],['all','',null]])await assert.rejects(f.db.query('select aura_daily_priorities($1,$2,$3,$4)',[org,...args]),(e:any)=>e.code==='22023');
 }finally{await f.db.close();}
});
