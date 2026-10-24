import {cancelAppointment,createAppointment,rescheduleAppointment,shiftDemoDate,type DemoSchedule} from './appointments';
import {validateLisbonAppointment} from './local-time';
import {demoDate,type DemoStudent} from './model';

// Individual sessions only: capacity 1, same synthetic professional calendar.
export const studentSlots=[
 {id:'today-09',date:demoDate,time:'09:00',duration:45},
 {id:'today-11',date:demoDate,time:'11:30',duration:30},
 {id:'today-16',date:demoDate,time:'16:00',duration:45},
 {id:'tomorrow-10',date:shiftDemoDate(demoDate,1),time:'10:00',duration:45},
 {id:'tomorrow-16',date:shiftDemoDate(demoDate,1),time:'16:00',duration:30},
] as const;
export function availableStudentSlots(state:DemoSchedule,excludingId?:number){return studentSlots.map(slot=>{const start=Number(slot.time.slice(0,2))*60+Number(slot.time.slice(3));const occupied=state.appointments.some(a=>a.id!==excludingId&&a.status==='scheduled'&&a.date===slot.date&&start<Number(a.time.slice(0,2))*60+Number(a.time.slice(3))+a.duration&&start+slot.duration>Number(a.time.slice(0,2))*60+Number(a.time.slice(3)));return {...slot,capacity:1 as const,available:!occupied};});}
export class StudentBookingError extends Error{}
export function bookStudentSlot(state:DemoSchedule,studentId:number,slotId:string,students:DemoStudent[],rescheduleId?:number):DemoSchedule{
 if(!students.some(s=>s.id===studentId))throw new StudentBookingError('Escolhe um aluno fictício existente.');
 if(rescheduleId!==undefined&&!state.appointments.some(a=>a.id===rescheduleId&&a.studentId===studentId&&a.status==='scheduled'&&a.date>=demoDate))throw new StudentBookingError('Só podes alterar uma marcação futura ativa deste aluno.');
 const slot=availableStudentSlots(state,rescheduleId).find(s=>s.id===slotId);
 if(!slot||slot.date<demoDate)throw new StudentBookingError('Escolhe um horário de exemplo disponível.');
 if(!slot.available)throw new StudentBookingError('Este horário já não tem vaga. Escolhe outro; a tua seleção foi preservada.');
 validateLisbonAppointment(slot.date,slot.time,String(slot.duration));
 const draft={date:slot.date,time:slot.time,duration:String(slot.duration)};
 const result=rescheduleId===undefined?createAppointment(state,{...draft,studentId:String(studentId),kind:'Sessão de treino'},students):rescheduleAppointment(state,rescheduleId,draft,students);
 if(!result.result?.ok)throw new StudentBookingError(result.result?.text||'Não foi possível guardar a marcação fictícia.');
 return {...result,result:null};
}
export function cancelStudentBooking(state:DemoSchedule,studentId:number,id:number,students:DemoStudent[]):DemoSchedule{
 if(!students.some(s=>s.id===studentId)||!state.appointments.some(a=>a.id===id&&a.studentId===studentId&&a.status==='scheduled'&&a.date>=demoDate))throw new StudentBookingError('Só podes cancelar uma marcação futura ativa deste aluno.');
 const result=cancelAppointment(state,id);if(!result.result?.ok)throw new StudentBookingError('A marcação já não está ativa.');return {...result,result:null};
}
