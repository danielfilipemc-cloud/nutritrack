export const priorityLabels={all:'Todas as prioridades',session:'Marcações de hoje',review:'Revisões pendentes',objective:'Objetivos até hoje',assessment:'Avaliações pendentes'};
export type PriorityKind=Exclude<keyof typeof priorityLabels,'all'>;
export type Priority={kind:PriorityKind;id:string;client_id:string;full_name:string;due_on:string|null;starts_at:string|null;label:string};
export type DailyQueue={as_of:string;total:number;counts:Record<PriorityKind,number>;items:Priority[]};
export type ProfileSection='overview'|'assessments'|'agenda'|'evolution'|'objectives'|'timeline';
export function profileSectionUrl(org:string,client:string,section:ProfileSection){return `/alunos/${encodeURIComponent(client)}?org=${encodeURIComponent(org)}&section=${section}`;}
export function prioritySection(kind:PriorityKind):ProfileSection{return {session:'agenda',review:'overview',objective:'objectives',assessment:'assessments'}[kind] as ProfileSection;}
