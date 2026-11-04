import {test} from 'node:test';
import assert from 'node:assert/strict';
import {filterDemoStudents} from '../app/demo/experiencia/directory';
import {createDemoStudents} from '../app/demo/experiencia/model';

test('directory name search ignores accents, case and repeated whitespace but treats punctuation literally',()=>{
 const students=createDemoStudents();
 for(const query of ['ines',' INÊS  exemplo ','Ine\u0302s'])assert.deepEqual(filterDemoStudents(students,query,'all').map(s=>s.id),[3]);
 assert.deepEqual(filterDemoStudents(students,'  ','all').map(s=>s.id),[1,2,3]);
 students[0].name='Aluna %_[.* Exemplo';
 assert.deepEqual(filterDemoStudents(students,'%_[.*','all').map(s=>s.id),[1]);
 assert.equal(filterDemoStudents(students,'^.*$','all').length,0);
});
test('directory combines saved status and name, preserves input order and projects only presentation fields',()=>{
 const students=createDemoStudents();students[0].care.status='paused';students[1].care.status='completed';
 const before=JSON.stringify(students);
 for(const [status,id] of [['paused',1],['completed',2],['active',3]] as const)assert.deepEqual(filterDemoStudents(students,'exemplo',status).map(s=>s.id),[id]);
 assert.deepEqual(filterDemoStudents(students,'Sofia','active'),[]);
 assert.deepEqual(filterDemoStudents(students,'','all'),students.map(s=>({id:s.id,name:s.name,status:s.care.status})));
 const result=filterDemoStudents(students,'','all');result[0].name='Alteração só da projeção';
 assert.equal(JSON.stringify(students),before);
 assert.deepEqual(filterDemoStudents([],'','all'),[]);
});
