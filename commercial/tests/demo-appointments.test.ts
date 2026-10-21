import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createDemoStudents} from '../app/demo/experiencia/model';
import {createDemoSchedule,createAppointment,emptyAppointment,appointmentEnd,weekStart,inAppointmentRange,shiftDemoDate,sortedAppointments} from '../app/demo/experiencia/appointments';
const students=createDemoStudents();
test('appointment sessions own independent mutable histories',()=>{
 const a=createDemoSchedule(),b=createDemoSchedule();a.appointments[0].time='07:00';
 assert.equal(b.appointments[0].time,'09:00');assert.equal(createDemoSchedule().appointments[0].time,'09:00');
});
test('creation allocates local IDs and does not mutate previous state',()=>{
 const initial=createDemoSchedule();const next=createAppointment(initial,emptyAppointment,students);
 assert.equal(next.result?.ok,true);assert.equal(next.appointments.length,4);assert.equal(initial.appointments.length,3);
 assert.equal(next.result?.created?.id,4);assert.equal(next.sequence,1);
 const duplicate=createAppointment(next,emptyAppointment,students);assert.equal(duplicate.result?.ok,false);assert.equal(duplicate.appointments.length,4);
});
test('appointments validate all inputs at the state boundary',()=>{
 for(const patch of [{studentId:'9999'},{studentId:'1.0'},{date:'2026-02-30'},{date:'1999-12-31'},{date:'2101-01-01'},{time:'24:00'},{time:'12:99'},{time:'9:00'},{duration:'0'},{duration:'30.0'},{duration:'Infinity'},{kind:'Tipo não revisto'}]){
  const initial=createDemoSchedule(),next=createAppointment(initial,{...emptyAppointment,...patch},students);
  assert.equal(next.result?.ok,false,JSON.stringify(patch));assert.equal(next.appointments,initial.appointments);assert.ok(next.result?.field);
 }
});
test('a single synthetic professional rejects partial, contained and enclosing overlaps',()=>{
 for(const patch of [{time:'08:45',duration:'30'},{time:'09:15',duration:'15'},{time:'08:30',duration:'120'},{time:'10:45',duration:'30'}]){
  const next=createAppointment(createDemoSchedule(),{...emptyAppointment,...patch,studentId:'3'},students);
  assert.equal(next.result?.ok,false);assert.equal(next.result?.field,'time');
 }
});
test('adjacent bookings, other days and an exact midnight ending are allowed',()=>{
 const adjacent=createAppointment(createDemoSchedule(),{...emptyAppointment,time:'09:45',duration:'45'},students);
 assert.equal(adjacent.result?.ok,true);
 const otherDay=createAppointment(createDemoSchedule(),{...emptyAppointment,date:'2026-10-21',time:'09:00'},students);assert.equal(otherDay.result?.ok,true);
 const midnight=createAppointment(createDemoSchedule(),{...emptyAppointment,time:'23:00',duration:'60'},students);assert.equal(midnight.result?.ok,true);assert.equal(appointmentEnd(midnight.result!.created!),'24:00');
 assert.equal(createAppointment(createDemoSchedule(),{...emptyAppointment,time:'23:45',duration:'30'},students).result?.ok,false);
});
test('day and Monday-based week ranges stay deterministic across month and year boundaries',()=>{
 assert.equal(weekStart('2026-10-20'),'2026-10-19');assert.equal(weekStart('2027-01-01'),'2026-12-28');
 assert.equal(shiftDemoDate('2028-02-28',1),'2028-02-29');assert.equal(shiftDemoDate('2026-10-25',1),'2026-10-26');
 assert.equal(inAppointmentRange('2026-10-25','2026-10-20','week'),true);assert.equal(inAppointmentRange('2026-10-26','2026-10-20','week'),false);
 assert.equal(inAppointmentRange('2026-10-21','2026-10-20','day'),false);
 const source=createDemoSchedule().appointments.slice().reverse();assert.equal(sortedAppointments(source)[0].time,'09:00');assert.equal(source[0].time,'14:00');
});
