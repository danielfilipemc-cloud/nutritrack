import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseNutritrackBackup,selectNutritrackWindow,previewNutritrack,syntheticNutritrackBackup} from '../lib/nutritrack-import';
import {foundationFixture,id} from './foundation-fixture';
const org=id(10),pupil=id(100);
const record={source_record_id:'day:2026-10-15',observed_on:'2026-10-15',weight_kg:80,height_cm:null,waist_cm:90,expected_revision:0};

test('three manual batches resume idempotently after lost acknowledgement; concurrent source revisions and revoked access stay protected',async()=>{
 const f=await foundationFixture();try{
  await f.grant(1,100);await f.grant(2,100);await f.asUser(1);
  const link=(await f.db.query<{id:string}>(`select aura_nutritrack_link_save('${org}','${pupil}','synthetic-multibatch',true) id`)).rows[0].id;
  const rows=Array.from({length:120},(_,i)=>{const date=new Date(Date.UTC(2026,0,i+1)).toISOString().slice(0,10);return {...record,source_record_id:'day:'+date,observed_on:date};});
  const send=(r:unknown[])=>f.db.query<{x:any}>(`select aura_nutritrack_import('${org}','${pupil}',$1,$2) x`,[link,JSON.stringify(r)]);
  await f.asUser(2);await send(rows.slice(0,50)); // Simulates commit whose HTTP acknowledgement was lost.
  assert.ok((await send(rows.slice(0,50))).rows[0].x.every((r:any)=>r.status==='duplicate'));
  await send(rows.slice(50,100));await f.asUser(1);await f.db.query(`select aura_assignment_save('${org}','${pupil}','${id(2)}',false)`);
  await f.asUser(2);await assert.rejects(send(rows.slice(100)),(e:any)=>e.code==='42501');
  await f.grant(2,100);await f.asUser(2);await send(rows.slice(100));assert.equal((await f.db.query('select * from assessments')).rows.length,120);
  const attempts=await Promise.allSettled([send([{...rows[0],weight_kg:79,expected_revision:1}]),send([{...rows[0],weight_kg:78,expected_revision:1}])]);
  assert.equal(attempts.filter(a=>a.status==='fulfilled').length,1);assert.equal((attempts.find(a=>a.status==='rejected') as PromiseRejectedResult).reason.code,'PT409');
  assert.equal((await f.db.query('select * from assessments')).rows.length,121);
 }finally{await f.db.close();}
});
test('actual NutriTrack v2 backup adapter merges measurements and drops profile/nutrition while refusing conflicts',()=>{
 const rows=parseNutritrackBackup(JSON.stringify({...syntheticNutritrackBackup,data:{...syntheticNutritrackBackup.data,secret:'discard me'}}),'2026-10-16');assert.deepEqual(rows,[record]);assert.ok(!JSON.stringify(rows).includes('discard'));
 for(const raw of [{}, {...syntheticNutritrackBackup,version:3},{...syntheticNutritrackBackup,data:{weightLog:[{date:'2026-10-17',weight:80}]}},{...syntheticNutritrackBackup,data:{weightLog:[{date:'2026-10-15',weight:81}],bodyMeasurements:syntheticNutritrackBackup.data.bodyMeasurements}}])assert.throws(()=>parseNutritrackBackup(JSON.stringify(raw),'2026-10-16'));
 assert.throws(()=>parseNutritrackBackup('x'.repeat(2_000_001),'2026-10-16'));
 const large=Array.from({length:60},(_,i)=>({...record,observed_on:new Date(Date.UTC(2026,0,i+1)).toISOString().slice(0,10)}));assert.throws(()=>selectNutritrackWindow(large,'2026-01-01','2026-03-01'));assert.equal(selectNutritrackWindow(large,'2026-01-01','2026-01-10').length,10);
 const context={link:null,can_manage:false,records:[{source_record_id:record.source_record_id,revision:1,content:record,superseded:true}]};assert.equal(previewNutritrack(rows,context)[0].status,'duplicate');assert.equal(previewNutritrack([{...record,weight_kg:79}],context)[0].status,'blocked');
});
test('bridge imports atomically, repeats idempotently, versions source updates and preserves provenance on local correction',async()=>{
 const f=await foundationFixture();try{
  await f.grant(1,100);await f.asUser(1);const link=(await f.db.query<{id:string}>(`select aura_nutritrack_link_save('${org}','${pupil}','synthetic-person',true) id`)).rows[0].id;
  const send=async(rows:unknown[])=>(await f.db.query<{x:any}>(`select aura_nutritrack_import('${org}','${pupil}',$1,$2) x`,[link,JSON.stringify(rows)])).rows[0].x;
  assert.equal((await send([record]))[0].status,'created');assert.equal((await send([record]))[0].status,'duplicate');
  await assert.rejects(send([{...record,weight_kg:79}]),(e:any)=>e.code==='PT409');
  assert.equal((await send([{...record,weight_kg:79,expected_revision:1}]))[0].status,'updated');
  let rows=(await f.db.query<any>('select * from assessments order by source_revision')).rows;assert.equal(rows.length,2);assert.ok(rows[0].superseded_at);assert.equal(rows[1].source_system,'nutritrack');assert.equal(rows[1].student_visible,false);
  const timeline=(await f.db.query<{x:any}>(`select aura_client_timeline('${org}','${pupil}') x`)).rows[0].x;assert.equal(timeline.items[0].details.source,'nutritrack');assert.equal(timeline.total,1);
  await f.db.query(`select aura_assessment_correct('${org}',$1,1,'2026-10-15',78,null,90,'Local synthetic correction')`,[rows[1].id]);
  await assert.rejects(send([{...record,weight_kg:77,expected_revision:2}]),(e:any)=>e.code==='PT409');
  rows=(await f.db.query<any>('select * from assessments where superseded_at is null')).rows;assert.equal(rows[0].source_system,'nutritrack');assert.equal(rows[0].source_revision,2);
  assert.equal((await send([{...record,weight_kg:79,expected_revision:2}]))[0].status,'duplicate');
 }finally{await f.db.close();}
});
test('bridge denies implicit access, foreign links, direct writes, revoked links and rolls back a bad batch',async()=>{
 const f=await foundationFixture();try{
  await f.asUser(1);await assert.rejects(f.db.query(`select aura_nutritrack_link_save('${org}','${pupil}','synthetic',true)`),(e:any)=>e.code==='42501');
  await f.grant(1,100);await f.asUser(1);const link=(await f.db.query<{id:string}>(`select aura_nutritrack_link_save('${org}','${pupil}','synthetic',true) id`)).rows[0].id;
  const send=(rows:unknown[])=>f.db.query(`select aura_nutritrack_import('${org}','${pupil}',$1,$2)`,[link,JSON.stringify(rows)]);
  await assert.rejects(send([record,{...record,source_record_id:'bad',weight_kg:-1}]),(e:any)=>e.code==='22023');assert.equal((await f.db.query('select * from assessments')).rows.length,0);
  await assert.rejects(f.db.query(`update nutritrack_links set active=false`),(e:any)=>e.code==='42501');await assert.rejects(f.db.query(`select * from app_private.nutritrack_records`),(e:any)=>e.code==='42501');
  await f.asUser(5);await assert.rejects(send([record]),(e:any)=>e.code==='42501');await f.asUser(4);await assert.rejects(send([record]),(e:any)=>e.code==='42501');
  await f.asUser(1);await f.db.query(`select aura_nutritrack_link_save('${org}','${pupil}','synthetic',false)`);await assert.rejects(send([record]),(e:any)=>e.code==='42501');
  await assert.rejects(f.db.query(`select aura_nutritrack_link_save('${org}','${pupil}','other-person',true)`),(e:any)=>e.code==='PT409');
 }finally{await f.db.close();}
});
