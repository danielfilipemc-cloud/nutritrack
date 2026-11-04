import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createDemoStudents} from '../app/demo/experiencia/model';
import {cancelAppointment,createAppointment,createDemoSchedule,emptyAppointment,rescheduleAppointment} from '../app/demo/experiencia/appointments';
const students=createDemoStudents();
test('rescheduling preserves identity, student and type and excludes itself from overlap',()=>{
 const initial=createDemoSchedule(),original=initial.appointments[0];
 const same=rescheduleAppointment(initial,1,{date:original.date,time:original.time,duration:String(original.duration)},students);
 assert.equal(same.result?.ok,true);assert.equal(same.appointments.length,3);assert.deepEqual(same.appointments[0],original);
 const moved=rescheduleAppointment(initial,1,{date:original.date,time:'11:00',duration:'60'},students);
 assert.equal(moved.result?.ok,true);assert.equal(moved.appointments[0].id,1);assert.equal(moved.appointments[0].studentId,1);assert.equal(moved.appointments[0].kind,original.kind);
 assert.equal(moved.appointments[0].time,'11:00');assert.equal(initial.appointments[0].time,'09:00');assert.equal(moved.appointments[1],initial.appointments[1]);
});
test('invalid rescheduling retains original records and validates current schedule',()=>{
 const initial=createDemoSchedule();
 for(const draft of [{date:'2026-10-20',time:'10:45',duration:'30'},{date:'2026-02-30',time:'11:00',duration:'30'},{date:'2026-10-20',time:'23:30',duration:'60'}]){
  const next=rescheduleAppointment(initial,1,draft,students);assert.equal(next.result?.ok,false);assert.equal(next.appointments,initial.appointments);
 }
 const created=createAppointment(initial,emptyAppointment,students);
 const conflict=rescheduleAppointment(created,1,{date:'2026-10-20',time:'15:00',duration:'30'},students);
 assert.equal(conflict.result?.ok,false);assert.equal(conflict.appointments,created.appointments);
 assert.equal(rescheduleAppointment(initial,999,{date:'2026-10-20',time:'11:00',duration:'30'},students).result?.ok,false);
});
test('cancelled examples remain immutable history and free the slot without reusing IDs',()=>{
 const initial=createDemoSchedule(),cancelled=cancelAppointment(initial,1);
 assert.equal(cancelled.result?.ok,true);assert.equal(cancelled.appointments.length,3);assert.equal(cancelled.appointments[0].status,'cancelled');assert.equal(initial.appointments[0].status,'scheduled');
 const reused=createAppointment(cancelled,{...emptyAppointment,time:'09:00',duration:'45'},students);
 assert.equal(reused.result?.ok,true);assert.equal(reused.result?.created?.id,4);assert.equal(reused.appointments[0],cancelled.appointments[0]);
 const double=cancelAppointment(reused,1);assert.equal(double.result?.ok,false);assert.equal(double.appointments,reused.appointments);
 const edit=rescheduleAppointment(reused,1,{date:'2026-10-20',time:'11:00',duration:'30'},students);assert.equal(edit.result?.ok,false);assert.equal(edit.appointments,reused.appointments);
 assert.equal(cancelAppointment(initial,999).result?.ok,false);assert.equal(createDemoSchedule().appointments[0].status,'scheduled');
});
