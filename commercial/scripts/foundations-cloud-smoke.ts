import {randomUUID} from 'node:crypto';
import {writeFile,mkdir} from 'node:fs/promises';

/** Database authorization only: simulated claims are NOT a real Auth/JWT test.
 * Synthetic fixtures live inside one transaction and are always rolled back. */
export function foundationsCloudSmokeSql(){
 const [owner,coach,foreign,org,otherOrg,pupil,otherPupil,goal]=Array.from({length:8},()=>randomUUID());
 const sql=['begin;'];let assertions=0;
 const check=(predicate:string,label:string)=>{assertions++;sql.push(`do $check$ begin if not (${predicate}) then raise exception '${label}'; end if; end $check$;`);};
 const deny=(query:string,code='42501')=>{assertions++;sql.push(`do $deny$ begin begin ${query}; raise exception 'Unexpected authorization success'; exception when sqlstate '${code}' then null; end; end $deny$;`);};
 const asUser=(id:string)=>sql.push(`reset role;set local role authenticated;select set_config('request.jwt.claim.sub','${id}',true);select set_config('request.jwt.claims','{"sub":"${id}","role":"authenticated","user_metadata":{"role":"owner","organization_id":"${otherOrg}"}}',true);`);
 sql.push(`insert into auth.users(id,email,email_confirmed_at,raw_app_meta_data) values ${[owner,coach,foreign].map(id=>`('${id}','smoke-${id}@example.invalid',now(),'{"synthetic":true}')`).join(',')};
 insert into public.organizations(id,name) values('${org}','Synthetic cloud A'),('${otherOrg}','Synthetic cloud B');
 insert into public.organization_members(organization_id,user_id,role) values('${org}','${owner}','owner'),('${org}','${coach}','coach'),('${otherOrg}','${foreign}','owner');
 insert into public.clients(id,organization_id,full_name) values('${pupil}','${org}','Synthetic A'),('${otherPupil}','${otherOrg}','Synthetic B');`);
 asUser(owner);
 deny(`perform aura_objective_save('${org}','${pupil}',null,'Denied implicit owner','active',null,0)`);
 sql.push(`select aura_capability_save('${org}','${coach}','followup',true,true);`);
 asUser(coach);deny(`perform aura_objective_save('${org}','${pupil}',null,'Denied without assignment','active',null,0)`);
 asUser(owner);sql.push(`select aura_assignment_save('${org}','${pupil}','${coach}',true);`);
 asUser(coach);
 // Store the server-generated ID in a transaction-local setting.
 sql.push(`select set_config('aura.smoke_goal',aura_objective_save('${org}','${pupil}',null,'Synthetic objective','active',null,0)::text,true);`);
 const saved="current_setting('aura.smoke_goal')::uuid";
 check(`(select count(*)=1 from public.client_objectives where organization_id='${org}')`,'Authorized objective visible');
 deny(`insert into public.client_objectives(id,organization_id,client_id,title) values('${goal}','${org}','${pupil}','Direct write')`);
 deny(`perform 1 from app_private.objective_events`);
 deny(`perform aura_objective_save('${otherOrg}','${otherPupil}',null,'Foreign write','active',null,0)`);
 sql.push(`select aura_objective_save('${org}','${pupil}',${saved},'Synthetic objective','completed',null,1);`);
 check(`(select revision=2 and completed_at is not null from public.client_objectives where id=${saved})`,'Server controlled completion');
 deny(`perform aura_objective_save('${org}','${pupil}',${saved},'Stale','active',null,1)`,'PT409');
 sql.push(`select aura_objective_save('${org}','${pupil}',${saved},'Synthetic objective','active',null,2);`);
 check(`(select count(*)=3 from aura_objective_history('${org}','${pupil}',0))`,'Audited reopen');
 asUser(foreign);
 check(`(select count(*)=0 from public.client_objectives where organization_id='${org}')`,'Foreign tenant hidden');
 deny(`perform 1 from aura_objective_history('${org}','${pupil}',0)`);
 asUser(owner);sql.push(`select aura_capability_save('${org}','${coach}','followup',true,false);`);
 asUser(coach);
 check(`(select count(*)=1 from public.client_objectives where id=${saved})`,'Read only remains visible');
 deny(`perform aura_objective_save('${org}','${pupil}',null,'Read only write','active',null,0)`);
 asUser(owner);sql.push(`select aura_assignment_save('${org}','${pupil}','${coach}',false);`);
 asUser(coach);
 check(`(select count(*)=0 from public.client_objectives where id=${saved})`,'Revocation without refreshed claims');
 deny(`perform 1 from aura_objective_history('${org}','${pupil}',0)`);
 sql.push(`reset role;set local role anon;select set_config('request.jwt.claim.sub','',true);`);
 deny('perform 1 from public.client_objectives');
 sql.push(`reset role;rollback;select 'PASS' as result,${assertions} as assertions,'Simulated claims only; all fixtures rolled back' as scope;`);
 return sql.join('\n');
}
if(process.argv.includes('--write'))void(async()=>{await mkdir(new URL('../.aura-integration/',import.meta.url),{recursive:true});await writeFile(new URL('../.aura-integration/cloud-smoke.generated.sql',import.meta.url),foundationsCloudSmokeSql());})();
