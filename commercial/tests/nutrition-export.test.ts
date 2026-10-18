import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createSyntheticNutritionSnapshot as capture, verifySyntheticNutritionSnapshot as verify, nutritionExportLimits} from '../lib/nutrition-export';
import {id} from './foundation-fixture';
import {composition} from './nutrition-db-fixture';
const scope = {organizationId: id(10), clientId: id(100), from: '2026-10-01', through: '2026-10-18'};
const row = (n: number) => ({mealId: id(n), revision: 1, consumedOn: '2026-10-16', mealKind: 'breakfast', status: 'recorded', items: [{label: 'Invented food', quantity: {amount: 100, unit: 'g'}, composition: structuredClone(composition), source: 'manual'}]});
const input = (versions: unknown[]) => ({scope, snapshotId: id(9000), capturedAt: '2026-10-18T12:00:00.000Z', versions, pageSize: 20});
test('immutable snapshot retains every pinned version while the source inserts, edits and moves dates between transport pages', () => {
 const source = Array.from({length: 45}, (_,i) => row(1000+i)); const snapshot = capture(input(source));
 source.unshift(row(999)); source[5].consumedOn = '2026-09-01'; source[6].items[0].quantity.amount = 75; source.pop();
 const verified = verify(scope, snapshot.manifest, snapshot.pages);
 assert.equal(verified.length, 45); assert.equal(snapshot.manifest.itemCount, 45); assert.equal(snapshot.manifest.pages.length, 3);
 assert.equal(verified[4].consumedOn, '2026-10-16'); assert.equal(verified[5].items[0].quantity.amount, 100);
 assert.equal(verified[0].items[0].composition.nutrients.carbs, null); assert.equal(verified[0].items[0].composition.nutrients.fat, 0);
 assert.throws(() => {snapshot.pages[0].versions[0].items[0].quantity.amount = 1;}, TypeError);
});
test('missing, mixed, duplicated, reordered, modified pages and false counts cannot release a partial export', () => {
 const a = capture(input(Array.from({length: 45},(_,i) => row(1000+i))));
 const b = capture({...input([row(1000)]), snapshotId: id(9001)});
 for (const pages of [a.pages.slice(0,2), [b.pages[0],...a.pages.slice(1)], [a.pages[0],a.pages[0],a.pages[2]], [...a.pages].reverse()]) assert.throws(() => verify(scope,a.manifest,pages));
 const changed = structuredClone(a.pages); changed[0].versions[0].items[0].quantity.amount = 20; assert.throws(() => verify(scope,a.manifest,changed));
 assert.throws(() => verify(scope,{...a.manifest,versionCount:44},a.pages));
 assert.throws(() => verify(scope,{...a.manifest,itemCount:44},a.pages));
 assert.throws(() => verify({...scope,organizationId:id(20)},a.manifest,a.pages));
 assert.throws(() => verify({...scope,clientId:id(200)},a.manifest,a.pages));
 assert.throws(() => verify({...scope,from:'2026-10-02'},a.manifest,a.pages));
});
test('empty snapshots, history and voided snapshots are explicit; duplicates, overflow and invalid contracts fail', () => {
 const empty = capture(input([])); assert.deepEqual(verify(scope,empty.manifest,[]),[]);
 const original = row(1000), revised = {...row(1000),revision:2,status:'voided'};
 const history = capture(input([revised,original])); assert.equal(verify(scope,history.manifest,history.pages)[1].status,'voided');
 for (const rows of [[original,original], [{...original,consumedOn:'2026-09-30'}], [{...original,revision:0}], [{...original,actorId:id(2)}], [{...original,items:[]}], Array.from({length:nutritionExportLimits.versions+1},(_,i)=>row(1000+i))]) assert.throws(() => capture(input(rows)));
 assert.throws(() => capture({...input([]),pageSize:0})); assert.throws(() => capture({...input([]),capturedAt:'invalid'}));
 assert.throws(() => capture({...input([]),scope:{...scope,through:'2026-02-30'}}));
});
