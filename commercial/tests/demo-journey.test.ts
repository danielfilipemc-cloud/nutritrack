import {test} from 'node:test';import assert from 'node:assert/strict';
import {copyComposer,reviewComposer,nextStudentReview,demoMetricSeries} from '../app/demo/experiencia/journey';
import {createDemoStudents,demoDate} from '../app/demo/experiencia/model';
import {createDemoSchedule,createAppointment,cancelAppointment} from '../app/demo/experiencia/appointments';
import {reviewPriorities,parseDemoCare} from '../app/demo/experiencia/followup';
test('review and general composer snapshots never share mutable drafts',()=>{
 const a=reviewComposer(2,demoDate),b=copyComposer(a);b.draft.time='16:00';b.savedCreateDraft.date='2026-10-25';
 assert.equal(a.draft.time,'');assert.equal(a.savedCreateDraft.date,demoDate);assert.equal(a.draft.studentId,'2');assert.equal(a.draft.kind,'Revisão de acompanhamento');
 assert.equal(reviewComposer(3,'2101-01-01').draft.date,demoDate);assert.equal(reviewComposer(3,'2026-02-30').draft.date,demoDate);
});
test('the next review excludes other students, cancelled bookings, past days and other booking kinds',()=>{
 const students=createDemoStudents();let schedule=createDemoSchedule();schedule=createAppointment(schedule,{...reviewComposer(2,demoDate).draft,time:'16:00'},students);
 const id=schedule.result!.created!.id;assert.equal(nextStudentReview(schedule.appointments,2)?.id,id);assert.equal(nextStudentReview(schedule.appointments,1),undefined);
 assert.equal(nextStudentReview(cancelAppointment(schedule,id).appointments,2),undefined);
 assert.equal(nextStudentReview([{...schedule.appointments.at(-1)!,date:'2026-10-19'}],2),undefined);
});
test('chart series retain zero values, select each metric independently and cap presentation without changing history',()=>{
 const records=Array.from({length:31},(_,i)=>({date:`2026-10-${String(i+1).padStart(2,'0')}`,weight:i,height:i%2?null:170,waist:null}));const before=JSON.stringify(records);
 assert.equal(demoMetricSeries(records.slice(0,1),'weight')[0].value,0);assert.equal(demoMetricSeries(records,'weight').length,30);assert.equal(demoMetricSeries(records,'height').length,16);assert.deepEqual(demoMetricSeries(records,'waist'),[]);assert.equal(JSON.stringify(records),before);
});
test('booking creation does not silently publish care drafts; explicit care save controls priorities',()=>{
 const students=createDemoStudents();const original=JSON.stringify(students);const schedule=createAppointment(createDemoSchedule(),{...reviewComposer(2,demoDate).draft,time:'16:00'},students);
 assert.equal(JSON.stringify(students),original);assert.equal(schedule.appointments.length,4);assert.deepEqual(reviewPriorities(students).map(s=>s.id),[1]);
 students[1]={...students[1],care:parseDemoCare({...students[1].care,review:nextStudentReview(schedule.appointments,2)!.date})};assert.deepEqual(reviewPriorities(students).map(s=>s.id),[1,2]);
 students[1]={...students[1],care:parseDemoCare({...students[1].care,review:'2026-10-25'})};assert.deepEqual(reviewPriorities(students).map(s=>s.id),[1]);
});
