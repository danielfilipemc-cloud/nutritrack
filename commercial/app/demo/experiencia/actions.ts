import {validDate} from '../../../lib/validation';
import {demoDate,type DemoStudent} from './model';

export type DemoAction={id:number;studentId:number;title:string;due:string;status:'pending'|'done';completedOn:string;sourceCheckinId?:number};
export type DemoActionPlan={nextId:number;actions:DemoAction[]};
export type DemoActionDraft={title:string;due:string};
export type DemoActionFilter='all'|'pending'|'overdue'|'done';
export const actionTemplates=['Preparar próxima revisão','Confirmar agenda de exemplo','Rever histórico de avaliações'] as const;
export class DemoActionError extends Error {constructor(message:string,readonly field:'title'|'due'='title'){super(message);}}
export function createDemoActionPlan():DemoActionPlan {
 return {nextId:3,actions:[
  {id:1,studentId:1,title:'Preparar próxima revisão',due:demoDate,status:'pending',completedOn:''},
  {id:2,studentId:2,title:'Organizar notas da sessão',due:'',status:'pending',completedOn:''},
 ]};
}
export function parseDemoAction(draft:DemoActionDraft):DemoActionDraft {
 const title=draft.title.trim();
 if(title.length<2||title.length>120)throw new DemoActionError('Descreve uma ação fictícia com 2 a 120 caracteres.');
 if(draft.due&&(!validDate(draft.due)||draft.due<'2000-01-01'||draft.due>'2100-12-31'))throw new DemoActionError('Indica um prazo entre 2000-01-01 e 2100-12-31, ou deixa-o vazio.','due');
 return {title,due:draft.due};
}
export function saveDemoAction(plan:DemoActionPlan,studentId:number,draft:DemoActionDraft,students:DemoStudent[],editingId:number|null=null):DemoActionPlan {
 if(!students.some(s=>s.id===studentId))throw new DemoActionError('Escolhe um aluno de exemplo.');
 const value=parseDemoAction(draft);
 if(editingId!==null){
  if(!plan.actions.some(a=>a.id===editingId&&a.studentId===studentId))throw new DemoActionError('Esta ação não pertence ao aluno de exemplo.');
  return {...plan,actions:plan.actions.map(a=>a.id===editingId?{...a,...value}:a)};
 }
 return {nextId:plan.nextId+1,actions:[...plan.actions,{id:plan.nextId,studentId,...value,status:'pending',completedOn:''}]};
}
export function toggleDemoAction(plan:DemoActionPlan,studentId:number,id:number):DemoActionPlan {
 if(!plan.actions.some(a=>a.id===id&&a.studentId===studentId))throw new DemoActionError('Esta ação não pertence ao aluno de exemplo.');
 return {...plan,actions:plan.actions.map(a=>a.id===id?{...a,status:a.status==='pending'?'done':'pending',completedOn:a.status==='pending'?demoDate:''}:a)};
}
export function studentActions(plan:DemoActionPlan,studentId:number,filter:DemoActionFilter='all') {
 return plan.actions.filter(a=>a.studentId===studentId&&(filter==='all'||filter==='overdue'&&a.status==='pending'&&!!a.due&&a.due<demoDate||a.status===filter))
  .sort((a,b)=>Number(a.status==='done')-Number(b.status==='done')||(a.due||'9999').localeCompare(b.due||'9999')||a.id-b.id);
}
export function pendingActionCount(plan:DemoActionPlan,studentId:number){return studentActions(plan,studentId,'pending').length;}
