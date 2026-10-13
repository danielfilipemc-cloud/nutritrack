import {randomUUID} from "node:crypto";
import {writeFile} from "node:fs/promises";
/** Runs only synthetic fixtures in a transaction that ALWAYS rolls back.
 * Requires an administrative SQL connection to the dedicated AURA project.
 * Auth claims here exercise database authorization, not JWT signature validation. */
export function supabaseRlsSql(){
 const [ownerA,ownerB,coach,unassigned,orgA,orgB,clientA,clientB]=Array.from({length:8},()=>randomUUID());
 const statements=["begin;"];
 let assertions=0;
 const check=(condition:string,label:string)=>{assertions++;statements.push(`do $check$ begin if not (${condition}) then raise exception '${label}'; end if; end $check$;`);};
 const deny=(query:string,code="42501")=>{assertions++;statements.push(`do $deny$ begin begin ${query}; raise exception 'Unexpected authorization success'; exception when sqlstate '${code}' then null; end; end $deny$;`);};
 const asUser=(id:string|null)=>statements.push(`reset role; set local role authenticated; select set_config('request.jwt.claim.sub','${id||""}',true); select set_config('request.jwt.claims','${JSON.stringify({sub:id,role:"authenticated",user_metadata:{role:"owner",organization_id:orgB}})}',true);`);
 statements.push(`insert into auth.users(id,aud,role,email,raw_user_meta_data) values ${[ownerA,ownerB,coach,unassigned].map(id=>`('${id}','authenticated','authenticated','aura-rls-${id}@example.invalid','{"role":"owner"}')`).join(",")};
 insert into public.organizations(id,name) values ('${orgA}','AURA Synthetic A'),('${orgB}','AURA Synthetic B');
 insert into public.organization_members(organization_id,user_id,role) values ('${orgA}','${ownerA}','owner'),('${orgB}','${ownerB}','admin'),('${orgA}','${coach}','coach');
 insert into public.clients(id,organization_id,full_name) values ('${clientA}','${orgA}','Synthetic A'),('${clientB}','${orgB}','Synthetic B');`);
 for(const [user,org,other,ownClient,otherClient] of [[ownerA,orgA,orgB,clientA,clientB],[ownerB,orgB,orgA,clientB,clientA]]){
 asUser(user);
 for(const table of ["organizations","organization_members","clients"])check(`(select count(*)=1 from public.${table})`,`${table}: own tenant only`);
 statements.push(`insert into public.clients(organization_id,full_name) values ('${org}','Synthetic new');
 insert into public.assessments(organization_id,client_id,recorded_by,weight_kg) values ('${org}','${ownClient}','${user}',80);
 insert into public.organization_branding(organization_id,display_name,updated_by) values ('${org}','Synthetic brand','${user}');`);
 check(`(select count(*)=1 from public.assessments)`,"Own assessment visible");
 check(`(select count(*)=1 from public.organization_branding)`,"Own branding visible");
 statements.push(`update public.organization_branding set display_name='Synthetic edited',updated_by='${user}' where organization_id='${org}';`);
 check(`(select display_name='Synthetic edited' from public.organization_branding where organization_id='${org}')`,"Owner/admin update succeeds");
 deny(`insert into public.clients(organization_id,full_name) values ('${other}','Synthetic denied')`);
 deny(`insert into public.assessments(organization_id,client_id,recorded_by,weight_kg) values ('${other}','${otherClient}','${user}',80)`);
 deny(`insert into public.assessments(organization_id,client_id,recorded_by,weight_kg) values ('${org}','${otherClient}','${user}',80)`,"23503");
 deny(`insert into public.assessments(organization_id,client_id,recorded_by,weight_kg) values ('${org}','${ownClient}','${unassigned}',80)`);
 deny(`insert into public.assessments(organization_id,client_id,recorded_by,weight_kg) values ('${org}','${ownClient}','${user}',501)`,"23514");
 deny(`insert into public.organization_branding(organization_id,display_name,updated_by) values ('${other}','Synthetic denied','${user}')`);
 check(`(select count(*)=0 from public.organizations where id='${other}')`,"Other organization hidden");
 deny(`insert into public.organization_members(organization_id,user_id,role) values ('${other}','${user}','owner')`);
 deny(`update public.clients set full_name='Synthetic denied'`);deny(`delete from public.clients`);
 deny(`update public.assessments set weight_kg=90`);deny(`delete from public.assessments`);
 }
 asUser(coach);check(`(select count(*)=1 from public.assessments)`,"Coach sees own tenant");
 statements.push(`insert into public.assessments(organization_id,client_id,recorded_by,waist_cm) values ('${orgA}','${clientA}','${coach}',90);`);
 check(`(select count(*)=2 from public.assessments)`,"Coach may record own assessment");
 statements.push(`update public.organization_branding set display_name='Synthetic forbidden',updated_by='${coach}' where organization_id='${orgA}';`);
 check(`(select display_name='Synthetic edited' from public.organization_branding where organization_id='${orgA}')`,"Coach branding update affects zero rows");
 deny(`insert into public.organization_branding(organization_id,display_name,updated_by) values ('${orgB}','Synthetic denied','${coach}')`);
 for(const user of [unassigned,null]){
 asUser(user);
 for(const table of ["organizations","organization_members","clients","assessments","organization_branding"])check(`(select count(*)=0 from public.${table})`,"Unassigned/empty identity sees no rows");
 deny(`insert into public.clients(organization_id,full_name) values ('${orgA}','Synthetic denied')`);
 }
 statements.push("reset role; set local role anon; select set_config('request.jwt.claim.sub','',true);");
 for(const table of ["organizations","organization_members","clients","assessments","organization_branding"])deny(`perform 1 from public.${table}`);
 statements.push(`reset role; rollback; select 'PASS' as result, ${assertions} as assertions, 'All synthetic fixtures rolled back' as cleanup;`);
 return statements.join("\n");
}
if(process.argv.includes("--write")){void writeFile(new URL("../supabase/rls-check.generated.sql",import.meta.url),supabaseRlsSql()).catch(e=>{console.error(e);process.exitCode=1;});}
