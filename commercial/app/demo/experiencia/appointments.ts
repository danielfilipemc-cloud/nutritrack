import {validDate} from '../../../lib/validation';
import {demoAppointments,demoDate,type DemoAppointment,type DemoStudent} from './model';

export const appointmentKinds=['Sessão de treino','Avaliação física','Revisão de acompanhamento'] as const;
export type AppointmentDraft={studentId:string;date:string;time:string;duration:string;kind:string};
export const emptyAppointment:AppointmentDraft={studentId:'1',date:demoDate,time:'15:00',duration:'30',kind:appointmentKinds[0]};
export type AppointmentResult={ok:boolean;text:string;field?:keyof AppointmentDraft;created?:DemoAppointment;updated?:DemoAppointment;operation?:'reschedule'|'cancel'};
export type DemoSchedule={appointments:DemoAppointment[];sequence:number;result:AppointmentResult|null};
class AppointmentError extends Error {
 constructor(message:string,readonly field:keyof AppointmentDraft){super(message);}
}
export function createDemoSchedule():DemoSchedule {
 return {appointments:demoAppointments.map(a=>({...a})),sequence:0,result:null};
}
export function appointmentEnd(a:Pick<DemoAppointment,'time'|'duration'>):string {
 const end=Number(a.time.slice(0,2))*60+Number(a.time.slice(3))+a.duration;
 return `${String(Math.floor(end/60)).padStart(2,'0')}:${String(end%60).padStart(2,'0')}`;
}
export function sortedAppointments(appointments:DemoAppointment[]):DemoAppointment[] {
 return [...appointments].sort((a,b)=>`${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`)||a.id-b.id);
}
export function shiftDemoDate(date:string,days:number):string {
 const next=new Date(`${date}T12:00:00Z`);next.setUTCDate(next.getUTCDate()+days);return next.toISOString().slice(0,10);
}
export function weekStart(date:string):string {
 const day=new Date(`${date}T12:00:00Z`).getUTCDay();return shiftDemoDate(date,-((day+6)%7));
}
export function inAppointmentRange(date:string,anchor:string,view:'day'|'week'):boolean {
 const start=view==='day'?anchor:weekStart(anchor);return date>=start&&date<=(view==='day'?start:shiftDemoDate(start,6));
}
export function createAppointment(state:DemoSchedule,draft:AppointmentDraft,students:DemoStudent[]):DemoSchedule {
 try {
  const studentId=Number(draft.studentId);
  if(!/^\d+$/.test(draft.studentId)||!students.some(s=>s.id===studentId))throw new AppointmentError('Escolhe um aluno de exemplo existente.','studentId');
  if(!validDate(draft.date)||draft.date<'2000-01-01'||draft.date>'2100-12-31')throw new AppointmentError('Indica uma data entre 2000-01-01 e 2100-12-31.','date');
  if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(draft.time))throw new AppointmentError('Indica uma hora válida.','time');
  const duration=Number(draft.duration);
  if(!['15','30','45','60','90','120'].includes(draft.duration))throw new AppointmentError('Escolhe uma duração entre 15 e 120 minutos.','duration');
  if(!appointmentKinds.some(kind=>kind===draft.kind))throw new AppointmentError('Escolhe um tipo de marcação de exemplo.','kind');
  const start=Number(draft.time.slice(0,2))*60+Number(draft.time.slice(3));
  if(start+duration>24*60)throw new AppointmentError('A marcação deve terminar até às 24:00 do mesmo dia.','time');
  if(state.appointments.some(a=>a.status==='scheduled'&&a.date===draft.date&&start<Number(a.time.slice(0,2))*60+Number(a.time.slice(3))+a.duration&&start+duration>Number(a.time.slice(0,2))*60+Number(a.time.slice(3))))throw new AppointmentError('Este horário sobrepõe-se a outra marcação de exemplo. Escolhe outro horário.','time');
  const created:DemoAppointment={id:Math.max(0,...state.appointments.map(a=>a.id))+1,studentId,date:draft.date,time:draft.time,duration,kind:draft.kind,status:'scheduled'};
  return {appointments:[...state.appointments,created],sequence:state.sequence+1,result:{ok:true,text:'Marcação fictícia criada apenas nesta sessão.',created}};
 }catch(error){
  if(!(error instanceof AppointmentError))throw error;
  return {...state,sequence:state.sequence+1,result:{ok:false,text:error.message,field:error.field}};
 }
}

export type RescheduleDraft=Pick<AppointmentDraft,'date'|'time'|'duration'>;
function unavailableAppointment(state:DemoSchedule,operation?:'reschedule'|'cancel'):DemoSchedule {
 return {...state,sequence:state.sequence+1,result:{ok:false,text:'A marcação já não está ativa nesta sessão.',operation}};
}
export function rescheduleAppointment(state:DemoSchedule,id:number,draft:RescheduleDraft,students:DemoStudent[]):DemoSchedule {
 const original=state.appointments.find(a=>a.id===id&&a.status==='scheduled');
 if(!original)return unavailableAppointment(state,'reschedule');
 const validated=createAppointment({...state,appointments:state.appointments.filter(a=>a.id!==id)},
  {...draft,studentId:String(original.studentId),kind:original.kind},students);
 if(!validated.result?.ok)return {...state,sequence:state.sequence+1,result:validated.result};
 const updated:DemoAppointment={...original,date:draft.date,time:draft.time,duration:Number(draft.duration)};
 return {appointments:state.appointments.map(a=>a.id===id?updated:a),sequence:state.sequence+1,result:{ok:true,text:'Marcação fictícia reagendada apenas nesta sessão.',operation:'reschedule',updated}};
}
export function cancelAppointment(state:DemoSchedule,id:number):DemoSchedule {
 const original=state.appointments.find(a=>a.id===id&&a.status==='scheduled');
 if(!original)return unavailableAppointment(state,'cancel');
 const updated:DemoAppointment={...original,status:'cancelled'};
 return {appointments:state.appointments.map(a=>a.id===id?updated:a),sequence:state.sequence+1,result:{ok:true,text:'Marcação fictícia cancelada. O exemplo foi preservado no histórico desta sessão.',operation:'cancel',updated}};
}
