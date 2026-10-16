import {validDate} from './validation';
import {CARE_TIME_ZONE} from './care';
export const objectiveStates={active:'Em curso',completed:'Concluído',cancelled:'Cancelado'};
export type Objective={id:string;organization_id:string;client_id:string;title:string;state:keyof typeof objectiveStates;due_on:string|null;completed_at:string|null;revision:number;created_at:string;updated_at:string};
export function objectiveDraft(title:string,due:string){
 const clean=title.trim();
 if(!clean||clean.length>160||due&&(!validDate(due)||due<'2000-01-01'||due>'2100-12-31'))throw new Error('Indica um título e um prazo válido, quando aplicável.');
 return {title:clean,due_on:due||null};
}
export function objectiveDeadline(goal:Pick<Objective,'state'|'due_on'>,today:string){
 if(goal.state!=='active')return 'closed';
 if(!goal.due_on)return 'undated';
 return goal.due_on<today?'overdue':goal.due_on===today?'today':'upcoming';
}
const clock=new Intl.DateTimeFormat('pt-PT',{timeZone:CARE_TIME_ZONE,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',timeZoneName:'short'});
export function objectiveTimestamp(value:string){const date=new Date(value);return Number.isFinite(date.getTime())?clock.format(date):'—';}
