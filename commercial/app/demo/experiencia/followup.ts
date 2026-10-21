import {validDate} from '../../../lib/validation';
import {demoDate,type DemoCare,type DemoStudent} from './model';

export const demoResponsible=['','Profissional Exemplo','Profissional Demonstração'] as const;
export type DemoReviewPriority={id:number;name:string;review:string;timing:'today'|'overdue'};
export function reviewPriorities(students:DemoStudent[],reference=demoDate):DemoReviewPriority[] {
 if(!validDate(reference))throw Error('Data de referência inválida.');
 return students.filter(s=>s.care.status==='active'&&validDate(s.care.review)&&s.care.review>='2000-01-01'&&s.care.review<='2100-12-31'&&s.care.review<=reference)
  .map(s=>({id:s.id,name:s.name,review:s.care.review,timing:s.care.review===reference?'today' as const:'overdue' as const}))
  .sort((a,b)=>a.review.localeCompare(b.review)||a.id-b.id);
}
export class DemoCareError extends Error {
 constructor(message:string,readonly field:keyof DemoCare){super(message);}
}
export function parseDemoCare(draft:DemoCare):DemoCare {
 if(!['active','paused','completed'].includes(draft.status))throw new DemoCareError('Escolhe um estado de acompanhamento de exemplo.','status');
 if(!demoResponsible.some(name=>name===draft.responsible))throw new DemoCareError('Escolhe um dos responsáveis fictícios ou deixa por atribuir.','responsible');
 if(draft.review&&(!validDate(draft.review)||draft.review<'2000-01-01'||draft.review>'2100-12-31'))throw new DemoCareError('Indica uma revisão entre 2000-01-01 e 2100-12-31, ou deixa a data vazia.','review');
 if(draft.goal.length>500)throw new DemoCareError('Usa um objetivo fictício com até 500 caracteres.','goal');
 return {status:draft.status,responsible:draft.responsible,review:draft.review,goal:draft.goal.trim()};
}
