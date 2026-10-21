import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createDemoStudents,type DemoCare} from '../app/demo/experiencia/model';
import {DemoCareError,parseDemoCare,reviewPriorities} from '../app/demo/experiencia/followup';
test('review priorities include only active due reviews ordered by calendar date and local ID',()=>{
 const students=createDemoStudents();students[1].care.review='2026-10-18';students[2].care.review='2026-10-18';
 const before=structuredClone(students),items=reviewPriorities(students);
 assert.deepEqual(items.map(p=>p.id),[2,3,1]);assert.deepEqual(items.map(p=>p.timing),['overdue','overdue','today']);assert.deepEqual(students,before);
 assert.deepEqual(Object.keys(items[0]).sort(),['id','name','review','timing']);
 students[1].care.status='paused';students[2].care.status='completed';assert.deepEqual(reviewPriorities(students).map(p=>p.id),[1]);
});
test('review selection uses explicit reference dates and skips absent, future or invalid calendar dates',()=>{
 for(const review of ['','2026-10-21','2026-02-30','1999-12-31','2101-01-01']){
  const students=createDemoStudents();students[0].care.review=review;assert.deepEqual(reviewPriorities(students),[]);
 }
 const students=createDemoStudents();students[0].care.review='2028-02-29';assert.equal(reviewPriorities(students,'2028-02-28').length,0);assert.equal(reviewPriorities(students,'2028-03-01')[0].timing,'overdue');assert.throws(()=>reviewPriorities(students,'2026-02-30'));
});
test('care validation returns a normalized copy and allows clearing the review or changing state',()=>{
 const draft={...createDemoStudents()[0].care,goal:'  Objetivo de exemplo  '},before={...draft};
 const parsed=parseDemoCare(draft);assert.notEqual(parsed,draft);assert.equal(parsed.goal,'Objetivo de exemplo');assert.deepEqual(draft,before);
 for(const status of ['active','paused','completed'] as const)assert.deepEqual(parseDemoCare({...draft,status,review:'',responsible:''}),{status,review:'',responsible:'',goal:'Objetivo de exemplo'});
 assert.equal(parseDemoCare({...draft,responsible:'Profissional Demonstração',review:'2028-02-29'}).review,'2028-02-29');
});
test('invalid care values are rejected with the corresponding field before updating local students',()=>{
 const draft=createDemoStudents()[0].care;
 for(const [field,value] of [['status','unknown'],['responsible','private-user-id'],['review','2026-02-30'],['review','1999-12-31'],['review','2101-01-01'],['goal','F'.repeat(501)]] as const){
  assert.throws(()=>parseDemoCare({...draft,[field]:value} as DemoCare),(e:unknown)=>e instanceof DemoCareError&&e.field===field);
 }
 assert.equal(createDemoStudents()[0].care.review,'2026-10-20');
});
