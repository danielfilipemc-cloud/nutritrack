import {appointmentKinds,appointmentStatuses,followupLabels} from './care';
import {objectiveStates} from './objectives';
export const timelineLabels={all:'Todos os registos',assessment:'Avaliações',followup:'Acompanhamento',objective:'Objetivos',appointment:'Marcações'};
export type TimelineKind=Exclude<keyof typeof timelineLabels,'all'>;
export type TimelineEvent={event_key:string;kind:TimelineKind;record_id:string;occurred_at:string;occurred_on:string;action:string;details:Record<string,unknown>};
export type TimelineCursor={before:string;key:string};
export type TimelinePage={as_of:string;total:number;more:boolean;items:TimelineEvent[];next:TimelineCursor|null};
export function timelineTitle(event:TimelineEvent){
 if(event.kind==='assessment')return 'Avaliação registada';
 if(event.kind==='followup')return event.action==='followup_created'?'Acompanhamento iniciado':'Acompanhamento atualizado';
 if(event.kind==='objective')return ({created:'Objetivo criado',updated:'Objetivo atualizado',completed:'Objetivo concluído',cancelled:'Objetivo cancelado',reopened:'Objetivo reaberto'} as Record<string,string>)[event.action]||'Objetivo alterado';
 return `${appointmentKinds[event.details.kind as keyof typeof appointmentKinds]||'Marcação'} · ${appointmentStatuses[event.action as keyof typeof appointmentStatuses]||'Estado indisponível'}`;
}
export function timelineState(event:TimelineEvent){
 const value=event.details.to_state;
 if(typeof value!=='string')return null;
 const labels=event.kind==='objective'?objectiveStates:followupLabels;
 return (labels as Record<string,string>)[value]||null;
}
export function appendTimeline(previous:TimelineEvent[],next:TimelineEvent[]){
 const seen=new Set(previous.map(e=>e.event_key));return [...previous,...next.filter(e=>{if(seen.has(e.event_key))return false;seen.add(e.event_key);return true;})];
}
