import type {DemoCare,DemoStudent} from './model';

export type DemoDirectoryFilter='all'|DemoCare['status'];
export type DemoDirectoryRow={id:number;name:string;status:DemoCare['status']};
export const demoDirectoryLabels={active:'Em acompanhamento',paused:'Em pausa',completed:'Concluído'} as const;

function searchable(value:string){
 return value.normalize('NFD').replace(/\p{M}/gu,'').trim().replace(/\s+/g,' ').toLocaleLowerCase('pt-PT');
}

/** Local name search and saved care status only; never forwards notes or measurements. */
export function filterDemoStudents(students:readonly DemoStudent[],query:string,status:DemoDirectoryFilter):DemoDirectoryRow[]{
 const term=searchable(query);
 return students.filter(s=>(status==='all'||s.care.status===status)&&searchable(s.name).includes(term))
  .map(s=>({id:s.id,name:s.name,status:s.care.status}));
}
