import {test} from 'node:test';
import assert from 'node:assert/strict';
import {evolutionSeries,evolutionChange,evolutionStart,loadEvolutionWindow,type EvolutionRecord} from '../lib/evolution';
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

test('evolution loads beyond API row caps and distinguishes exact end from a partial window',async()=>{
 const data=Array.from({length:1205},(_,i)=>i),sizes:number[]=[];
 const read=async(offset:number,size:number)=>{sizes.push(size);return data.slice(offset,offset+Math.min(size,1000));};
 assert.deepEqual(await loadEvolutionWindow(read,1000),{rows:data.slice(0,1000),more:true});
 assert.deepEqual(await loadEvolutionWindow(read,1400),{rows:data,more:false});
 assert.deepEqual(await loadEvolutionWindow(async(offset,size)=>data.slice(offset,Math.min(offset+size,1000)),1000),{rows:data.slice(0,1000),more:false});
 assert.ok(sizes.every(size=>size<=201));
 assert.deepEqual(await loadEvolutionWindow(async()=>[],200),{rows:[],more:false});
});

test('evolution discards failed or obsolete pages and rejects invalid window sizes',async()=>{
 let calls=0;
 await assert.rejects(loadEvolutionWindow(async(_offset,size)=>{if(++calls===2)throw new Error('revoked or offline');return Array(size).fill(1);},400),/revoked or offline/);
 let current=true;
 assert.equal(await loadEvolutionWindow(async(_offset,size)=>{current=false;return Array(size).fill(1);},400,()=>current),null);
 await assert.rejects(loadEvolutionWindow(async()=>[1,2,3],1),/exceeded/);
 for(const limit of [0,-1,2001,NaN,1.5])await assert.rejects(loadEvolutionWindow(async()=>[],limit),RangeError);
});
