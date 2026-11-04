import test from 'node:test';
import assert from 'node:assert/strict';
import {parseSyncEnvelope,receiveSyncEnvelope,syncRecordKey,SyncConflict,type SyncState,type SyncAccess} from '../lib/nutritrack-sync';
import {nutritionTotals} from '../lib/nutrition-contract';
const U=(n:number)=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const clock={now:'2026-10-25T12:00:00Z',today:'2026-10-25'};
const item={id:'food:1',label:'Alimento sintético',portion:{composition:{contractVersion:1,basis:{amount:100,unit:'g'},nutrients:{calories:null,protein:10,carbs:0,fat:2}},quantity:{amount:125,unit:'g'}}};
const access=(source:'aura'|'nutritrack'):SyncAccess=>({actorId:U(source==='aura'?4:3),source,organizationId:U(1),clientId:U(2),maySend:['nutrition-plan','nutrition-entry','measurement']});
const state=():SyncState=>({links:[{id:U(5),organizationId:U(1),clientId:U(2),nutritrackAccountId:U(3),active:true,consentVersion:1,scopes:['nutrition-plan','nutrition-entry','measurement'],consentExpiresAt:'2026-11-25T12:00:00Z'}],records:{},receipts:{}});
const base=()=>({contractVersion:1,eventId:U(10),linkId:U(5),consentVersion:1,sourceRecordId:'plan:1',revision:1,occurredAt:'2026-10-25T11:00:00Z'});
const plan=()=>({...base(),kind:'nutrition-plan',source:'aura',payload:{state:'published',validFrom:'2026-10-20',validTo:'2026-11-20',meals:[{id:'meal:1',name:'Refeição sintética',time:'08:30',items:[structuredClone(item)]}]}});
const entry=()=>({...base(),eventId:U(11),sourceRecordId:'entry:1',kind:'nutrition-entry',source:'nutritrack',payload:{consumedOn:'2026-10-25',mealKind:'breakfast',items:[structuredClone(item)],originPlan:{id:'plan:1',revision:1}}});
const send=(s:SyncState,e:unknown,source:'aura'|'nutritrack')=>receiveSyncEnvelope(s,e,access(source),clock);

test('a published plan and returning diary snapshot keep source versions, unknowns, explicit zero and review state',async()=>{
 const outgoing=plan(),original=state(),first=await send(original,outgoing,'aura'),second=await send(first.state,entry(),'nutritrack');
 assert.equal(Object.keys(original.records).length,0);
 const parsed=parseSyncEnvelope(entry(),clock),record=second.state.records[syncRecordKey(parsed)];
 assert.equal(record.pendingReview,true);assert.equal(record.versions[0].source,'nutritrack');
 assert.equal(parsed.kind,'nutrition-entry');if(parsed.kind!=='nutrition-entry')throw Error();
 const totals=nutritionTotals(parsed.payload.items.map(i=>i.portion));assert.equal(totals.nutrients.calories,null);assert.equal(totals.nutrients.carbs,0);assert.equal(totals.nutrients.protein,12.5);
 outgoing.payload.meals[0].name='Alterado fora do conector';const kept=first.state.records[syncRecordKey(parseSyncEnvelope(plan(),clock))].versions[0];if(kept.kind!=='nutrition-plan')throw Error();assert.equal(kept.payload.meals[0].name,'Refeição sintética');
});
test('a lost acknowledgement can be replayed exactly; changed content and source revision gaps cannot overwrite',async()=>{
 const e=plan(),first=await send(state(),e,'aura');const again=await send(first.state,structuredClone(e),'aura');assert.equal(again.state,first.state);assert.equal(again.receipt.status,'duplicate');
 await assert.rejects(send(first.state,{...e,payload:{...e.payload,validTo:'2026-12-20'}},'aura'),SyncConflict);
 await assert.rejects(send(first.state,{...e,eventId:U(20),revision:3},'aura'),SyncConflict);
 const next=await send(first.state,{...e,eventId:U(21),revision:2,payload:{state:'withdrawn',validFrom:e.payload.validFrom,validTo:e.payload.validTo,meals:[]}},'aura');
 const rows=Object.values(next.state.records)[0].versions;assert.equal(rows.length,2);assert.equal(rows[0].kind,'nutrition-plan');if(rows[0].kind==='nutrition-plan')assert.equal(rows[0].payload.state,'published');
});
test('wrong tenant, client, account, source, scope or consent cannot deliver or disclose a receipt',async()=>{
 const e=plan(),first=await send(state(),e,'aura');
 for(const edit of [(a:SyncAccess)=>{a.organizationId=U(90);},(a:SyncAccess)=>{a.clientId=U(90);},(a:SyncAccess)=>{a.maySend=[];},(a:SyncAccess)=>{a.source='nutritrack';}]){const a=access('aura');edit(a);await assert.rejects(receiveSyncEnvelope(first.state,e,a,clock),/acesso vigente/);}
 const s=state();s.links[0].scopes=[];await assert.rejects(send(s,e,'aura'),/acesso vigente/);
 await assert.rejects(send(state(),{...e,consentVersion:2},'aura'),/acesso vigente/);
 const n={...entry(),payload:{...entry().payload,originPlan:null}};await assert.rejects(receiveSyncEnvelope(state(),n,{...access('nutritrack'),actorId:U(90)},clock),/acesso vigente/);
});
test('revocation or expiry during processing blocks both new writes and retries of acknowledged events',async()=>{
 const s=state(),pending=send(s,plan(),'aura');s.links[0].active=false;await assert.rejects(pending,/acesso vigente/);assert.deepEqual(s.records,{});
 const first=await send(state(),plan(),'aura');const revoked={...first.state,links:first.state.links.map(l=>({...l,active:false}))};await assert.rejects(send(revoked,plan(),'aura'),/acesso vigente/);
 const expired=state();expired.links[0].consentExpiresAt=clock.now;await assert.rejects(send(expired,plan(),'aura'),/acesso vigente/);
});
test('a local correction blocks the next automatic version and an origin plan must belong to the same linked history',async()=>{
 const first=await send(state(),plan(),'aura'),key=syncRecordKey(parseSyncEnvelope(plan(),clock));const protectedState=structuredClone(first.state);protectedState.records[key].locallyEdited=true;
 await assert.rejects(send(protectedState,{...plan(),eventId:U(30),revision:2},'aura'),SyncConflict);
 assert.equal(protectedState.records[key].versions.length,1);
 await assert.rejects(send(state(),entry(),'nutritrack'),/plano/);
 const wrong={...entry(),payload:{...entry().payload,originPlan:{id:'foreign-plan',revision:1}}};await assert.rejects(send(first.state,wrong,'nutritrack'),/plano/);
});
test('transport rejects legacy backups, private fields, implicit units, missing values and future diary days',()=>{
 const backup={app:'NutriTrack Pro',version:2,data:{nutritrackData:{meals:[]}}};assert.throws(()=>parseSyncEnvelope(backup,clock));
 assert.throws(()=>parseSyncEnvelope({...plan(),actorId:U(90)},clock));
 assert.throws(()=>parseSyncEnvelope({...plan(),source:'nutritrack'},clock));
 const e=entry();for(const change of [(v:any)=>{v.payload.items[0].portion.quantity.unit='ml';},(v:any)=>{delete v.payload.items[0].portion.composition.nutrients.calories;},(v:any)=>{v.payload.note='PRIVATE_FIXTURE';},(v:any)=>{v.payload.consumedOn='2026-10-26';},(v:any)=>{v.payload.items[0].portion.quantity.amount=-10;},(v:any)=>{v.occurredAt='2026-02-30T10:00:00Z';}]){const v=structuredClone(e);change(v);assert.throws(()=>parseSyncEnvelope(v,clock));}
});
test('measurement transport preserves null and original date, and does not accept clinical or profile payloads',async()=>{
 const e={...base(),sourceRecordId:'measurement:1',kind:'measurement',source:'nutritrack',payload:{observedOn:'2026-10-20',weightKg:80,heightCm:null,waistCm:90}};
 const result=await send(state(),e,'nutritrack');const record=Object.values(result.state.records)[0];assert.equal(record.pendingReview,true);assert.equal(record.versions.length,1);
 const parsed=record.versions[0];if(parsed.kind!=='measurement')throw Error();assert.equal(parsed.payload.heightCm,null);assert.equal(parsed.payload.observedOn,'2026-10-20');
 assert.throws(()=>parseSyncEnvelope({...e,payload:{...e.payload,diagnosis:'PRIVATE_FIXTURE'}},clock));
});
test('withdrawal or replacement blocks unacknowledged backlog; an accepted receipt does not resurrect the old plan',async()=>{
 const first=await send(state(),plan(),'aura'),recorded=await send(first.state,entry(),'nutritrack');
 const withdrawn=await send(recorded.state,{...plan(),eventId:U(40),revision:2,occurredAt:'2026-10-25T11:30:00Z',payload:{state:'withdrawn',validFrom:'2026-10-20',validTo:'2026-11-20',meals:[]}},'aura');
 const replay=await send(withdrawn.state,entry(),'nutritrack');assert.equal(replay.state,withdrawn.state);assert.equal(replay.receipt.status,'duplicate');
 await assert.rejects(send(withdrawn.state,{...entry(),eventId:U(41),sourceRecordId:'entry:2'},'nutritrack'),SyncConflict);
 await assert.rejects(send(withdrawn.state,{...entry(),eventId:U(45),revision:2},'nutritrack'),SyncConflict);
 const replaced=await send(withdrawn.state,{...plan(),eventId:U(42),revision:3},'aura');
 await assert.rejects(send(replaced.state,{...entry(),eventId:U(43),sourceRecordId:'entry:3'},'nutritrack'),SyncConflict);
 const unplanned={...entry(),eventId:U(44),sourceRecordId:'entry:4',payload:{...entry().payload,originPlan:null}};
 const explicit=await send(replaced.state,unplanned,'nutritrack');assert.equal(explicit.receipt.status,'applied');
});
