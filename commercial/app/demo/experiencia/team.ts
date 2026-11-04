import {demoResponsible} from './followup';
import type {DemoStudent} from './model';
export type DemoTeamMember={id:number;name:string;role:'professional'|'coordination';status:'active'|'paused'};
export const teamRoleLabels={professional:'Profissional',coordination:'Coordenação'} as const;
export function createDemoTeam():DemoTeamMember[]{return demoResponsible.slice(1).map((name,i)=>({id:i+1,name,role:i===0?'professional':'coordination',status:'active'}));}
export function updateDemoTeam(team:DemoTeamMember[],id:number,patch:Pick<DemoTeamMember,'role'|'status'>){
 if(!team.some(m=>m.id===id)||!['professional','coordination'].includes(patch.role)||!['active','paused'].includes(patch.status))throw Error('Escolhe um profissional e estado de exemplo válidos.');
 return team.map(m=>m.id===id?{...m,...patch}:m);
}
export function activeResponsible(team:DemoTeamMember[]){return team.filter(m=>m.status==='active').map(m=>m.name);}
export function assignedDemoStudents(students:DemoStudent[],name:string){return students.filter(s=>s.care.responsible===name).map(s=>({id:s.id,name:s.name,status:s.care.status}));}
