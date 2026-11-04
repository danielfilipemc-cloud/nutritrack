import {emptyAppointment,sortedAppointments,type AppointmentDraft} from './appointments';
import {demoDate,type DemoAppointment,type DemoAssessment} from './model';
import {validDate} from '../../../lib/validation';

export type AgendaRequest={sequence:number;studentId:number;mode:'consult'|'review';date:string};
export type ComposerSnapshot={draft:AppointmentDraft;editing:number|null;savedCreateDraft:AppointmentDraft};
export function copyComposer(value:ComposerSnapshot):ComposerSnapshot{return {...value,draft:{...value.draft},savedCreateDraft:{...value.savedCreateDraft}};}
export function reviewComposer(studentId:number,date:string):ComposerSnapshot{
 const safeDate=validDate(date)&&date>='2000-01-01'&&date<='2100-12-31'?date:demoDate;
 const draft={...emptyAppointment,studentId:String(studentId),date:safeDate,time:'',kind:'Revisão de acompanhamento'};
 return {draft,editing:null,savedCreateDraft:{...draft}};
}
export function nextStudentReview(appointments:DemoAppointment[],studentId:number){
 return sortedAppointments(appointments).find(a=>a.studentId===studentId&&a.status==='scheduled'&&a.kind==='Revisão de acompanhamento'&&a.date>=demoDate);
}
export type DemoMetric='weight'|'height'|'waist';
export function demoMetricSeries(records:DemoAssessment[],metric:DemoMetric){
 return records.filter(r=>r[metric]!==null).map(r=>({date:r.date,value:r[metric] as number})).sort((a,b)=>a.date.localeCompare(b.date)).slice(-30);
}
