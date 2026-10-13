export type Dashboard={
 reviews_due?:number;appointments_today?:number;care_date?:string;
 due_reviews?:{id:string;full_name:string;next_review:string}[];
 today_appointments?:{id:string;client_id:string;full_name:string;kind:"session"|"assessment"|"review";starts_at:string;ends_at:string;professional_id:string|null}[];
 as_of:string;active_clients:number;archived_clients:number;assessments_30_days:number;pending_clients:number;
 recent:{id:string;client_id:string;full_name:string;assessed_on:string;archived_at:string|null}[];
 pending:{id:string;full_name:string;assessed_on:string|null}[];
};
export function clientProfileUrl(org:string,client:string){
 return `/alunos/${encodeURIComponent(client)}?org=${encodeURIComponent(org)}`;
}
