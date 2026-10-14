import {test} from 'node:test';
import assert from 'node:assert/strict';
import {evolutionSeries,evolutionChange,evolutionStart,type EvolutionRecord} from '../lib/evolution';
import {chartData} from '../lib/chart';
const row=(id:string,date:string,value:number|null,superseded_at:string|null=null):EvolutionRecord=>({id,assessed_on:date,weight_kg:value,height_cm:null,waist_cm:null,superseded_at});
test('evolution excludes corrected, future, missing and non-finite measurements and includes period boundaries',()=>{
 const records=[row('b','2026-10-14',79.75),row('a','2026-09-15',80),row('old','2026-09-14',90),row('future','2026-10-15',70),row('replaced','2026-10-13',100,'2026-10-14'),row('null','2026-10-12',null),row('bad','2026-10-11',Infinity)];
 const points=evolutionSeries(records,'weight_kg','2026-10-14',30);
 assert.deepEqual(points,[{date:'2026-09-15',value:80},{date:'2026-10-14',value:79.75}]);assert.equal(evolutionChange(points),-.25);assert.equal(records[0].id,'b');
 assert.equal(evolutionSeries(records,'waist_cm','2026-10-14',0).length,0);
});
test('evolution handles leap years, empty windows and chart history beyond thirty points',()=>{
 assert.equal(evolutionStart('2024-03-01',2),'2024-02-29');assert.equal(evolutionStart('2026-10-14',0),null);assert.equal(evolutionChange([]),null);assert.equal(evolutionChange([{value:80}]),null);
 const points=Array.from({length:40},(_,i)=>({date:`2026-09-${String(1+i%28).padStart(2,'0')}`,value:i}));
 assert.equal(chartData(points).length,30);assert.equal(chartData(points,40).length,40);
});
