import {test} from 'node:test';import assert from 'node:assert/strict';
import {createDemoTeam,updateDemoTeam,activeResponsible,assignedDemoStudents} from '../app/demo/experiencia/team';
import {accentAppearance,demoPalettes,defaultDemoAccent} from '../app/demo/experiencia/branding';
import {createDemoStudents} from '../app/demo/experiencia/model';import {parseDemoCare} from '../app/demo/experiencia/followup';
test('team state is session-local and pause/role changes never reassign saved students',()=>{
 const first=createDemoTeam(),second=createDemoTeam(),students=createDemoStudents(),original=JSON.stringify(students);const paused=updateDemoTeam(first,1,{role:'coordination',status:'paused'});assert.equal(first[0].status,'active');assert.equal(second[0].role,'professional');assert.deepEqual(activeResponsible(paused),['Profissional Demonstração']);assert.equal(assignedDemoStudents(students,paused[0].name).length,3);assert.equal(JSON.stringify(students),original);assert.throws(()=>updateDemoTeam(first,999,{role:'professional',status:'active'}));assert.throws(()=>updateDemoTeam(first,1,{role:'owner' as 'professional',status:'active'}));
});
test('paused staff can retain saved assignments but cannot receive a pending new assignment',()=>{
 const students=createDemoStudents(),care=students[0].care,available=['Profissional Demonstração'];assert.equal(parseDemoCare({...care,goal:'Atualizado'},available,care.responsible).responsible,'Profissional Exemplo');assert.throws(()=>parseDemoCare(care,available,''),/pausa/);assert.throws(()=>parseDemoCare({...care,responsible:'Outro nome'},['Outro nome'],'Outro nome'));assert.equal(parseDemoCare({...care,responsible:''},[],care.responsible).responsible,'');assert.equal(parseDemoCare(care,activeResponsible(createDemoTeam()),'').responsible,'Profissional Exemplo');
});
test('assignment presentation projects saved names/statuses only, not measurements or care drafts',()=>{
 const students=createDemoStudents();students[0].care.status='paused';students[1].care.status='completed';students[2].care.responsible='';const rows=assignedDemoStudents(students,'Profissional Exemplo');assert.deepEqual(rows,[{id:1,name:'Sofia Exemplo',status:'paused'},{id:2,name:'Miguel Exemplo',status:'completed'}]);assert.deepEqual(assignedDemoStudents(students,'Profissional Demonstração'),[]);
});
test('sampled RGB colours selects actual black/white text with at least 4.5 contrast, and malformed colours fail',()=>{
 assert.equal(accentAppearance(defaultDemoAccent).ink,'#FFFFFF');assert.equal(accentAppearance('#ffffff').ink,'#000000');assert.equal(accentAppearance('#000000').ink,'#FFFFFF');assert.equal(accentAppearance('#777777').ink,'#000000');assert.equal(accentAppearance('#757575').ink,'#FFFFFF');for(const p of demoPalettes)assert.ok(accentAppearance(p.color).ratio>=4.5);
 for(let r=0;r<256;r+=17)for(let g=0;g<256;g+=17)for(let b=0;b<256;b+=17){const color='#'+[r,g,b].map(n=>n.toString(16).padStart(2,'0')).join('');const a=accentAppearance(color);assert.ok(a.ratio>=4.5,color);assert.ok(['#000000','#FFFFFF'].includes(a.ink));}
 for(const value of ['red','#fff','#1234567','url(x)','#GGGGGG'])assert.throws(()=>accentAppearance(value));
});
