import {test} from 'node:test';import assert from 'node:assert/strict';
import {dashboardSnapshot} from '../app/demo/experiencia/dashboard';
import {createDemoStudents,type DemoAppointment} from '../app/demo/experiencia/model';
import {createDemoSchedule,createAppointment,rescheduleAppointment,cancelAppointment} from '../app/demo/experiencia/appointments';
test('dashboard totals follow saved create, reschedule and cancellation state without publishing care',()=>{
 const students=createDemoStudents();let schedule=createDemoSchedule();const initial=JSON.stringify(students);let d=dashboardSnapshot(students,schedule.appointments);assert.deepEqual(d.counts,{students:3,day:3,withWeight:3,priorities:1});assert.equal(d.weekMinutes,105);
 schedule=createAppointment(schedule,{studentId:'2',date:'2026-10-22',time:'16:00',duration:'45',kind:'Revisão de acompanhamento'},students);d=dashboardSnapshot(students,schedule.appointments);assert.equal(d.week.length,4);assert.equal(d.weekMinutes,150);assert.equal(d.day.length,3);assert.equal(d.days.find(v=>v.date==='2026-10-22')?.count,1);
 schedule=rescheduleAppointment(schedule,1,{date:'2026-10-26',time:'09:00',duration:'60'},students);d=dashboardSnapshot(students,schedule.appointments);assert.equal(d.day.length,2);assert.equal(d.week.length,3);assert.equal(d.weekMinutes,105);assert.equal(d.next?.id,2);
 schedule=cancelAppointment(schedule,2);d=dashboardSnapshot(students,schedule.appointments);assert.equal(d.day.length,1);assert.equal(d.weekMinutes,75);assert.equal(d.next?.id,3);assert.equal(JSON.stringify(students),initial);assert.equal(d.priorities.length,1);
});
test('week uses Monday to Sunday across years, ignores cancelled and orphaned rows, and does not mutate input',()=>{
 const students=createDemoStudents();const dates=['2026-12-27','2026-12-28','2027-01-01','2027-01-03','2027-01-04'];const rows:DemoAppointment[]=dates.map((date,i)=>({id:i+1,studentId:1,date,time:'10:00',duration:30,kind:'Avaliação física',status:'scheduled'}));rows.push({...rows[2],id:20,status:'cancelled'},{...rows[2],id:21,studentId:999});const original=JSON.stringify(rows);const d=dashboardSnapshot(students,rows,'2027-01-01');assert.equal(d.start,'2026-12-28');assert.equal(d.end,'2027-01-03');assert.deepEqual(d.week.map(a=>a.id),[2,3,4]);assert.equal(d.day.length,1);assert.equal(d.weekMinutes,90);assert.equal(d.days.length,7);assert.equal(d.next?.id,3);assert.equal(JSON.stringify(rows),original);assert.throws(()=>dashboardSnapshot(students,rows,'2026-02-30'));
});
test('empty, partial measurements and saved care statuses remain explicit and deterministic',()=>{
 assert.deepEqual(dashboardSnapshot([],[]).counts,{students:0,day:0,withWeight:0,priorities:0});assert.equal(dashboardSnapshot([],[]).next,undefined);
 const students=createDemoStudents();students[0].assessments=[];students[1].assessments=[{date:'2026-10-19',weight:null,height:170,waist:null}];students[0].care.review='2026-10-19';students[1].care.review='2026-10-19';students[2].care.review='2026-10-18';students[2].care.status='paused';const d=dashboardSnapshot(students,[]);assert.equal(d.counts.withWeight,1);assert.deepEqual(d.priorities.map(p=>p.id),[1,2]);assert.equal(d.weekMinutes,0);assert.ok(d.days.every(v=>v.count===0&&v.minutes===0));
});
