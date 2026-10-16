import {test} from 'node:test';
import assert from 'node:assert/strict';
import {foundationFixture,id} from './foundation-fixture';
import {migrationBundle} from '../scripts/migration-bundle';
import {objectiveDraft,objectiveDeadline,objectiveTimestamp,type Objective} from '../lib/objectives';
import {snapshotLocalDevelopment,restoreLocalDevelopment} from '../scripts/local-recovery';
const denied=(p:Promise<unknown>,code='42501')=>assert.rejects(p,(e:any)=>e.code===code);
const create=`select aura_objective_save('${id(10)}','${id(100)}',null,'Synthetic objective','active',null,0) id`;

test('objective input and deadline states preserve dates without automatic clinical interpretation',()=>{
 assert.deepEqual(objectiveDraft('  Acordar próxima revisão  ','2028-02-29'),{title:'Acordar próxima revisão',due_on:'2028-02-29'});
 for(const [title,due] of [[' ',''],['x'.repeat(161),''],['ok','2026-02-29'],['ok','2101-01-01']])assert.throws(()=>objectiveDraft(title,due));
 assert.equal(objectiveDeadline({state:'active',due_on:'2026-10-15'},'2026-10-16'),'overdue');
 assert.equal(objectiveDeadline({state:'active',due_on:'2026-10-16'},'2026-10-16'),'today');
 assert.equal(objectiveDeadline({state:'completed',due_on:'2026-10-15'},'2026-10-16'),'closed');
 assert.match(objectiveTimestamp('2026-10-16T23:30:00Z'),/17\/10\/2026/);assert.equal(objectiveTimestamp('invalid'),'—');
});

test('objectives require followup competency AND assignment; no implicit manager, student or direct-write access',async()=>{
 const f=await foundationFixture();try{
  for(const user of [1,2,3,4,5]){await f.asUser(user);assert.equal((await f.db.query('select * from client_objectives')).rows.length,0);await denied(f.db.query(create));}
  await f.asUser(1);await f.db.query(`select aura_capability_save('${id(10)}','${id(2)}','followup',true,true)`);
  await f.asUser(2);await denied(f.db.query(create));
  await f.grant(2,100,['followup']);await f.asUser(2);await f.db.query(create);
  assert.equal((await f.db.query('select * from client_objectives')).rows.length,1);
  await denied(f.db.query(`select aura_objective_save('${id(20)}','${id(200)}',null,'Foreign','active',null,0)`));
  await denied(f.db.query(`insert into client_objectives(organization_id,client_id,title) values('${id(10)}','${id(100)}','Bypass')`));
  await denied(f.db.query('update client_objectives set title=\'Bypass\''));await denied(f.db.query('select * from app_private.objective_events'));
  await f.asUser(5);assert.equal((await f.db.query('select * from client_objectives')).rows.length,0);
 }finally{await f.db.close();}
});

test('objective revisions, closure, explicit reopening and minimized audit are server controlled',async()=>{
 const f=await foundationFixture();try{
  await f.grant(2,100,['followup']);await f.asUser(2);const goal=(await f.db.query<{id:string}>(create)).rows[0].id;
  const save=(title:string,state:string,rev:number)=>f.db.query(`select aura_objective_save($1,$2,$3,$4,$5,null,$6)`,[id(10),id(100),goal,title,state,rev]);
  await save('Synthetic objective','completed',1);
  let row=(await f.db.query<Objective>('select * from client_objectives')).rows[0];assert.equal(row.revision,2);assert.ok(row.completed_at);
  await denied(save('Lost stale write','active',1),'PT409');
  await denied(save('Changed while closed','active',2),'22023');
  await save('Synthetic objective','active',2);await save('Revised objective','active',3);await save('Revised objective','cancelled',4);
  row=(await f.db.query<Objective>('select * from client_objectives')).rows[0];assert.equal(row.revision,5);assert.equal(row.completed_at,null);
  const history=(await f.db.query<Record<string,unknown>>(`select * from aura_objective_history('${id(10)}','${id(100)}',0)`)).rows;
  assert.equal(history.length,5);assert.ok(history.some(e=>e.action==='reopened'));
  assert.ok(history.every(e=>!('title' in e)&&!('actor_id' in e)));
  await f.db.exec('reset role');const audit=(await f.db.query<Record<string,unknown>>('select * from app_private.objective_events')).rows;
  assert.ok(audit.every(e=>e.actor_id===id(2)&&!('title' in e)));
 }finally{await f.db.close();}
});

test('archived objectives remain readable while writes and revoked access are denied',async()=>{
 const f=await foundationFixture();try{
  await f.grant(2,100,['followup']);await f.asUser(2);await f.db.query(create);
  await f.asUser(1);await f.db.query(`select aura_capability_save('${id(10)}','${id(2)}','followup',true,false)`);await f.asUser(2);
  assert.equal((await f.db.query('select * from client_objectives')).rows.length,1);await denied(f.db.query(create));
  await f.grant(2,100,['followup']);
  await f.db.exec(`reset role;update clients set archived_at=now() where id='${id(100)}'`);await f.asUser(2);
  assert.equal((await f.db.query('select * from client_objectives')).rows.length,1);await denied(f.db.query(create),'23514');
  await f.asUser(1);await f.db.query(`select aura_assignment_save('${id(10)}','${id(100)}','${id(2)}',false)`);await f.asUser(2);
  assert.equal((await f.db.query('select * from client_objectives')).rows.length,0);await denied(f.db.query(`select * from aura_objective_history('${id(10)}','${id(100)}',0)`));
 }finally{await f.db.close();}
});

test('authorized staff export includes objectives but student and commercial-only exports do not',async()=>{
 const f=await foundationFixture();try{
  await f.grant(2,100);await f.asUser(2);await f.db.query(create);
  const exportData=async()=> (await f.db.query<{v:any}>(`select aura_visible_export('${id(10)}','${id(100)}') v`)).rows[0].v;
  assert.equal((await exportData()).objectives.length,1);
  await f.asUser(1);assert.deepEqual((await exportData()).objectives,[]);
  const token=(await f.db.query<{v:string}>(`select aura_student_invite_create('${id(10)}','${id(100)}','student@example.invalid') v`)).rows[0].v;
  await f.asUser(4);await f.db.query('select aura_student_invite_accept($1)',[token]);assert.deepEqual((await exportData()).objectives,[]);
  await denied(f.db.query(`select * from aura_objective_history('${id(10)}','${id(100)}',0)`));
 }finally{await f.db.close();}
});

test('upgrade adds objectives without copying the existing focus or rewriting ten previous migrations',async()=>{
 const f=await foundationFixture('20261014180744_privacy_integrity_recovery.sql');try{
  await f.grant(2,100,['followup']);await f.asUser(2);await f.db.query(`select aura_followup_save('${id(10)}','${id(100)}','Preserved main focus','active',null,null,0)`);
  await f.db.exec('reset role');const before=(await f.db.query('select * from client_followups')).rows;
  const history=(await f.db.query<{name:string;checksum:string;applied_at:string}>('select * from app_private.aura_migrations order by name')).rows;
  await f.db.exec((await migrationBundle()).replace('create extension if not exists pgcrypto;',''));
  assert.deepEqual((await f.db.query('select * from client_followups')).rows,before);
  assert.equal((await f.db.query('select * from client_objectives')).rows.length,0);
  for(const entry of history)assert.deepEqual((await f.db.query('select * from app_private.aura_migrations where name=$1',[entry.name])).rows[0],entry);
 }finally{await f.db.close();}
});

test('recovery preserves objective closure and audit without broadening restored access',async()=>{
 const f=await foundationFixture();try{
  await f.grant(2,100,['followup']);await f.asUser(2);const goal=(await f.db.query<{id:string}>(create)).rows[0].id;
  await f.db.query(`select aura_objective_save('${id(10)}','${id(100)}',$1,'Synthetic objective','completed',null,1)`,[goal]);
  await f.db.exec('reset role');const original=(await f.db.query('select * from client_objectives')).rows;
  const snapshot=await snapshotLocalDevelopment(f.db),restored=await restoreLocalDevelopment(snapshot.bytes,snapshot.manifest);
  try{
   assert.deepEqual((await restored.query('select * from client_objectives')).rows,original);
   await restored.exec(`set role authenticated;select set_config('request.jwt.claim.sub','${id(2)}',false)`);
   assert.equal((await restored.query('select * from client_objectives')).rows.length,1);
   assert.equal((await restored.query(`select * from aura_objective_history('${id(10)}','${id(100)}',0)`)).rows.length,2);
   await denied(restored.query('select * from app_private.objective_events'));
   await restored.exec(`select set_config('request.jwt.claim.sub','${id(1)}',false)`);
   assert.equal((await restored.query('select * from client_objectives')).rows.length,0);
  }finally{await restored.close();}
 }finally{await f.db.close();}
});
