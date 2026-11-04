import test from 'node:test';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {parseMigrationJson,previewNativeMigration,canonical,type Json} from '../lib/native-migration';
import {migrationFixture} from '../lib/native-migration-fixture';
import {initializeRehearsal,rehearseMigration} from '../scripts/native-migration-rehearsal';
const backup=()=>structuredClone(migrationFixture);
const preview=(value:unknown)=>previewNativeMigration(JSON.stringify(value),'synthetic-source','2026-10-27');
test('inventory preserves rounded totals, daily water, source paths, all categories and legitimate identical meals',async()=>{
 const p=await preview(backup());assert.equal(p.counts.total,p.counts.prepared+p.counts.pending);
 const meals=p.records.filter(r=>r.category==='meals');assert.equal(meals.length,2);assert.notEqual(meals[0].id,meals[1].id);
 assert.equal(meals[0].fingerprint,meals[1].fingerprint);
 const content=meals[0].normalized as Record<string,Json>;assert.equal(content.composition,null);assert.deepEqual(content.reportedTotals,{calories:76,protein:1,carbs:17,fat:0});
 const water=p.records.filter(r=>r.category==='water').map(r=>r.normalized as Record<string,Json>);assert.equal(water.find(r=>r.totalMl===750)?.time,null);assert.ok(water.some(r=>r.totalMl===0));
 assert.equal(p.records.find(r=>r.category==='profile')?.disposition,'pending');assert.equal(p.records.find(r=>r.category==='templates')?.disposition,'pending');
 assert.ok(p.records.some(r=>r.origin==='weightLog'));assert.ok(p.records.some(r=>r.origin==='bodyMeasurements'));
 assert.ok(p.records.some(r=>r.category==='unknown'&&canonical(r.raw).includes('fieldToReview')));
 const totals=p.records.find(r=>r.category==='foods')!.normalized as Record<string,Json>;assert.ok(totals.composition);
});
test('strict JSON fails closed on duplicate keys, pollution, invalid numbers, size/depth and trailing content',async()=>{
 for(const text of ['{"a":1,"a":2}','{"__proto__":{}}','{"constructor":1}','[1e999]','[9007199254740993]','[9007199254740992]','[1e-400]','[0.100000000000000001]','[1e-3]x','[1]\v','[01]','[1,]','{} trailing','{"a":"\\x"}','['.repeat(26)+'0'+']'.repeat(26),' '.repeat(2_000_001)]) assert.throws(()=>parseMigrationJson(text));
 assert.deepEqual(JSON.parse(canonical(parseMigrationJson('{"b":[1,true,null,"a\\\"b"],"a":0}'))),{a:0,b:[1,true,null,'a"b']});
 await assert.rejects(()=>previewNativeMigration(JSON.stringify(backup()),'email@example.com','2026-10-27'));
 await assert.rejects(()=>preview({...backup(),version:1}));
});
test('unsupported fields and invalid values quarantine the whole record without dropping raw content',async()=>{
 const b=backup();Object.assign(b.data.nutritrackData.meals[0],{unexpected:{note:'keep me'}});b.data.nutritrackData.meals[1].quantity=-1;b.data.waterData['2026-10-25']=1.5;
 const p=await preview(b);const meals=p.records.filter(r=>r.category==='meals');assert.ok(meals.every(r=>r.disposition==='pending'&&r.normalized===null));
 assert.ok(meals.some(r=>canonical(r.raw).includes('keep me')));assert.equal(p.records.find(r=>r.category==='water'&&canonical(r.raw).includes('1.5'))?.disposition,'pending');
});
test('same source reordered and re-exported replays, changed snapshot conflicts atomically; isolated clients and late failure rollback',async()=>{
 const db=new PGlite();try{
  await initializeRehearsal(db);const p=await preview(backup());const target={organizationId:'synthetic-org-a',clientId:'synthetic-client-a',actorId:'synthetic-actor-a'};
  await assert.rejects(()=>rehearseMigration(db,p,target,p.records.length));assert.equal((await db.query<{n:number}>('select count(*)::int n from rehearsal_records')).rows[0].n,0);
  const receipt=await rehearseMigration(db,p,target);assert.equal(receipt.replayed,false);
  const b=backup();b.data.nutritrackData.meals.reverse();b.data.bodyMeasurements.reverse();b.exportedAt='2026-10-27T11:00:00Z';const reordered=await preview(b);assert.equal(reordered.snapshot,p.snapshot);
  assert.equal((await rehearseMigration(db,reordered,target)).replayed,true);
  assert.equal((await db.query<{n:number}>('select count(*)::int n from rehearsal_records')).rows[0].n,p.records.length);
  b.data.waterData['2026-10-25']=4;await assert.rejects(async()=>rehearseMigration(db,await preview(b),target),/snapshot diferente/);
  assert.equal((await db.query<{n:number}>('select count(*)::int n from rehearsal_records')).rows[0].n,p.records.length);
  assert.equal((await rehearseMigration(db,p,{...target,clientId:'synthetic-client-b'})).replayed,false);
  const raw=(await db.query<{payload:Json}>('select payload from rehearsal_records')).rows.map(r=>r.payload);assert.ok(raw.some(r=>canonical(r).includes('Campo desconhecido')));
 }finally{await db.close();}
});
test('modification after preview cannot enter the rehearsal journal',async()=>{
 const db=new PGlite();try{await initializeRehearsal(db);const p=await preview(backup());p.records[0].raw={tampered:true};
 await assert.rejects(()=>rehearseMigration(db,p,{organizationId:'synthetic-org-a',clientId:'synthetic-client-a',actorId:'synthetic-actor-a'}),/Integridade/);
 assert.equal((await db.query<{n:number}>('select count(*)::int n from rehearsal_records')).rows[0].n,0);
 }finally{await db.close();}
});

test('numeric tokens cannot silently change unknown values or prepare a tiny water count as zero',async()=>{
 const text=JSON.stringify(backup()).replace('"2026-10-25":3','"2026-10-25":1e-400');
 await assert.rejects(()=>previewNativeMigration(text,'synthetic-source','2026-10-27'),/representação exata/);
 assert.equal(canonical(parseMigrationJson('[0.10,1e2,1e-3,-0,0e999999,1.25]')),'[0.1,100,0.001,0,0,1.25]');
});
