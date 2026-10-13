export type Dashboard={
 as_of:string;active_clients:number;archived_clients:number;assessments_30_days:number;pending_clients:number;
 recent:{id:string;client_id:string;full_name:string;assessed_on:string;archived_at:string|null}[];
 pending:{id:string;full_name:string;assessed_on:string|null}[];
};
export function clientProfileUrl(org:string,client:string){
 return `/alunos/${encodeURIComponent(client)}?org=${encodeURIComponent(org)}`;
}
