import {measurement, validDate} from '../../../lib/validation';

// Synthetic, deterministic examples. No organization IDs or persistence adapters.
export const demoDate = '2026-10-20';
export type DemoAssessment = {date:string; weight:number|null; height:number|null; waist:number|null};
export type DemoCare = {status:'active'|'paused'|'completed'; responsible:string; review:string; goal:string};
export type DemoStudent = {id:number; name:string; assessments:DemoAssessment[]; care:DemoCare};
export type DemoAppointment = {id:number; studentId:number; date:string; time:string; duration:number; kind:string; status:'scheduled'|'cancelled';seriesId?:number;occurrence?:number};
export const demoAppointments:DemoAppointment[] = [
 {id:1,studentId:1,date:demoDate,time:'09:00',duration:45,status:'scheduled',kind:'Sessão de treino'},
 {id:2,studentId:2,date:demoDate,time:'10:30',duration:30,status:'scheduled',kind:'Avaliação física'},
 {id:3,studentId:3,date:demoDate,time:'14:00',duration:30,status:'scheduled',kind:'Revisão de acompanhamento'},
];
export function createDemoStudents():DemoStudent[] {
 return [
  {id:1,name:'Sofia Exemplo',weight:70.5,previous:71.2,height:168,waist:78},
  {id:2,name:'Miguel Exemplo',weight:80.3,previous:81,height:180,waist:88},
  {id:3,name:'Inês Exemplo',weight:65.4,previous:66.1,height:165,waist:74},
 ].map(s=>({id:s.id,name:s.name,assessments:[
  {date:'2026-09-15',weight:s.previous,height:s.height,waist:s.waist+1},
  {date:'2026-10-15',weight:s.weight,height:s.height,waist:s.waist},
 ],care:{status:'active',responsible:'Profissional Exemplo',review:s.id===1?demoDate:'',goal:'Rever a consistência das sessões de exemplo.'}}));
}
export const emptyAssessment = {date:demoDate,weight:'',height:'',waist:''};
export type AssessmentDraft = typeof emptyAssessment;
export function parseDemoAssessment(draft:AssessmentDraft):DemoAssessment {
 if(!validDate(draft.date)||draft.date>demoDate||draft.date<'2000-01-01')throw Error('Indica uma data entre 2000-01-01 e a data de referência da demo.');
 const weight=measurement(draft.weight,500,2),height=measurement(draft.height,300,1),waist=measurement(draft.waist,300,1);
 if(weight===null&&height===null&&waist===null)throw Error('Preenche pelo menos uma medição.');
 return {date:draft.date,weight,height,waist};
}
export function sortedAssessments(student:DemoStudent) {
 return student.assessments.slice().sort((a,b)=>a.date.localeCompare(b.date));
}
