import {validDate} from '../../../lib/validation';
import {demoDate,type DemoStudent} from './model';
import {saveDemoAction,type DemoActionPlan} from './actions';

export const checkinQuestions={version:1,activity:'Conseguiste realizar a atividade combinada?',difficulty:'Que dificuldade prática queres partilhar?',topic:'O que gostarias de tratar na próxima sessão?'} as const;
export type CheckinAnswers={activity:''|'yes'|'partly'|'no'|'skip';difficulty:string;topic:string};
export const blankCheckin:CheckinAnswers={activity:'',difficulty:'',topic:''};
export type DemoCheckin={id:number;studentId:number;due:string;questions:typeof checkinQuestions;status:'prepared'|'submitted'|'cancelled';answers:CheckinAnswers|null;submittedOn:string;submittedOrder:number;reviewedOn:string;reviewer:string};
export type CheckinPlan={nextId:number;nextSubmission:number;items:DemoCheckin[]};
export function createCheckinPlan():CheckinPlan{return {nextId:3,nextSubmission:2,items:[
 {id:1,studentId:1,due:demoDate,questions:{...checkinQuestions},status:'submitted',answers:{activity:'partly',difficulty:'Organizar o horário de exemplo.',topic:'Preparar a próxima sessão de exemplo.'},submittedOn:demoDate,submittedOrder:1,reviewedOn:'',reviewer:''},
 {id:2,studentId:2,due:'2026-10-19',questions:{...checkinQuestions},status:'prepared',answers:null,submittedOn:'',submittedOrder:0,reviewedOn:'',reviewer:''},
]};}
function studentExists(students:DemoStudent[],id:number){if(!students.some(s=>s.id===id))throw Error('Escolhe um aluno fictício existente.');}
function own(plan:CheckinPlan,studentId:number,id:number){const item=plan.items.find(i=>i.id===id&&i.studentId===studentId);if(!item)throw Error('Este check-in não pertence ao aluno.');return item;}
export function prepareCheckin(plan:CheckinPlan,studentId:number,due:string,students:DemoStudent[]):CheckinPlan {
 studentExists(students,studentId);
 if(!validDate(due)||due<'2000-01-01'||due>'2100-12-31')throw Error('Indica um prazo válido entre 2000 e 2100.');
 return {...plan,nextId:plan.nextId+1,items:[...plan.items,{id:plan.nextId,studentId,due,questions:{...checkinQuestions},status:'prepared',answers:null,submittedOn:'',submittedOrder:0,reviewedOn:'',reviewer:''}]};
}
export function submitCheckin(plan:CheckinPlan,studentId:number,id:number,answers:CheckinAnswers):CheckinPlan {
 const item=own(plan,studentId,id);if(item.status!=='prepared')throw Error('Só um exemplo preparado pode receber uma resposta simulada.');
 if(!['yes','partly','no','skip'].includes(answers.activity)||answers.difficulty.trim().length>500||answers.topic.trim().length>500)throw Error('Escolhe uma resposta e usa até 500 caracteres em cada campo opcional.');
 if(item.due>demoDate)throw Error('A simulação de resposta só está disponível até à data de referência.');
 const value={activity:answers.activity,difficulty:answers.difficulty.trim(),topic:answers.topic.trim()};
 return {...plan,nextSubmission:plan.nextSubmission+1,items:plan.items.map(i=>i.id===id?{...i,status:'submitted',answers:value,submittedOn:demoDate,submittedOrder:plan.nextSubmission}:i)};
}
export function reviewCheckin(plan:CheckinPlan,studentId:number,id:number,students:DemoStudent[]):CheckinPlan {
 studentExists(students,studentId);const item=own(plan,studentId,id);if(item.status!=='submitted'||item.reviewedOn)throw Error('Escolhe uma resposta fictícia por rever.');
 const responsible=students.find(s=>s.id===studentId)!.care.responsible;
 if(!responsible)throw Error('Guarda um responsável no acompanhamento antes de rever.');
 return {...plan,items:plan.items.map(i=>i.id===id?{...i,reviewedOn:demoDate,reviewer:responsible}:i)};
}
export function cancelCheckin(plan:CheckinPlan,studentId:number,id:number):CheckinPlan {
 const item=own(plan,studentId,id);if(item.status!=='prepared')throw Error('Só é possível cancelar um exemplo sem resposta.');
 return {...plan,items:plan.items.map(i=>i.id===id?{...i,status:'cancelled'}:i)};
}
export function actionFromCheckin(actions:DemoActionPlan,plan:CheckinPlan,studentId:number,id:number,students:DemoStudent[]):DemoActionPlan {
 const item=own(plan,studentId,id);if(item.status!=='submitted'||!item.reviewedOn)throw Error('Revê primeiro a resposta fictícia.');
 if(actions.actions.some(a=>a.studentId===studentId&&a.sourceCheckinId===id))return actions;
 const next=saveDemoAction(actions,studentId,{title:`Preparar sessão a partir do check-in #${id}`,due:''},students);
 return {...next,actions:next.actions.map(a=>a.id===actions.nextId?{...a,sourceCheckinId:id}:a)};
}
export function checkinState(item:DemoCheckin){return item.status==='cancelled'?'Cancelado':item.status==='submitted'?(item.reviewedOn?'Revisto':'Por rever'):item.due<demoDate?'Prazo vencido · Sem resposta':'Preparado para simulação';}
export function latestSubmittedCheckin(plan:CheckinPlan,studentId:number){return plan.items.filter(i=>i.studentId===studentId&&i.status==='submitted').sort((a,b)=>a.submittedOrder-b.submittedOrder).at(-1);}
export function reviewRows(students:DemoStudent[],plan:CheckinPlan,actions:DemoActionPlan,training:readonly {studentId:number;reviewedOn:string}[]=[]){
 return students.map(student=>({student,trainingUnreviewed:training.filter(r=>r.studentId===student.id&&!r.reviewedOn).length,unreviewed:plan.items.filter(i=>i.studentId===student.id&&i.status==='submitted'&&!i.reviewedOn).length,overdue:plan.items.filter(i=>i.studentId===student.id&&i.status==='prepared'&&i.due<demoDate).length,pending:actions.actions.filter(a=>a.studentId===student.id&&a.status==='pending').length})).filter(r=>r.unreviewed||r.overdue||r.pending||r.trainingUnreviewed);
}
