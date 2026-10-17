export type ClientPermissions={assessments_read:boolean;assessments_write:boolean;followup_read:boolean;followup_write:boolean;schedule_read:boolean;schedule_write:boolean};
export const noPermissions:ClientPermissions={assessments_read:false,assessments_write:false,followup_read:false,followup_write:false,schedule_read:false,schedule_write:false};
export function parsePermissions(value:unknown):ClientPermissions{
 const object=value&&typeof value==='object'?value as Record<string,unknown>:{};
 return Object.fromEntries(Object.keys(noPermissions).map(key=>[key,object[key]===true])) as ClientPermissions;
}
export function foundationError(error:{code?:string}|null){
 if(error?.code==='PT403')return 'Confirma o segundo fator em Segurança e volta a tentar. A confirmação é válida durante 10 minutos.';
 if(error?.code==='PT409')return 'O registo mudou ou já existe um pedido aberto. Atualiza antes de continuar.';
 if(error?.code==='42501')return 'Não tens autorização para esta operação.';
 if(error?.code==='23514'||error?.code==='22023')return 'Confirma os dados e os limites indicados.';
 return 'Não foi possível concluir. Tenta novamente.';
}
export function downloadVisibleExport(value:unknown,clientId:string){
 const blob=new Blob([JSON.stringify(value,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob);
 const link=document.createElement('a');link.href=url;link.download=`aura-registos-${clientId}.json`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
