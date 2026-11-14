/** Prepare a reviewable plan only. No network, credentials or remote execution. */
import {readFile,writeFile,mkdir} from 'node:fs/promises';import {createHash} from 'node:crypto';import {migrationBundle} from './migration-bundle';
export const privateActivationTarget={projectId:'ivwrvaycolqlpsjvdaod',organizationId:'opdpdwwgvtdzsmebuqey',renderServiceId:'srv-dbrqt061egvs73bvnvg0',url:'https://aura-business-private.onrender.com'} as const;
export const personalCandidates=['20261113225824_nutrition_personal_access.sql','20261113225825_nutrition_personal_targets.sql','20261114003207_nutrition_personal_export.sql'];
const hash=(v:string)=>createHash('sha256').update(v.replace(/\r\n/g,'\n')).digest('hex');
export async function privateNutritionActivationPlan(){
 const canonical=await migrationBundle(),candidates=await Promise.all(personalCandidates.map(async name=>({name,body:await readFile(new URL('../supabase/prepared/'+name,import.meta.url),'utf8')})));
 const sources={canonicalSha256:hash(canonical),candidates:candidates.map(c=>({name:c.name,sha256:hash(c.body)}))};
 const guard=`do $private_guard$ begin
 if exists(select 1 from auth.users) or exists(select 1 from information_schema.tables where table_schema in ('public','app_private'))
 then raise exception 'Refusing private activation: expected NEW EMPTY project, no accounts or application data';end if;
end;$private_guard$;`;
 const sql=canonical.replace('begin;','begin;\n'+guard).replace(/commit;\s*$/,'')+'\n'+candidates.map(c=>c.body).join('\n')+`
create table app_private.aura_private_activation(id boolean primary key default true check(id),sources jsonb not null,installed_at timestamptz not null default statement_timestamp());
alter table app_private.aura_private_activation enable row level security;
revoke all on app_private.aura_private_activation from public,anon,authenticated;
insert into app_private.aura_private_activation(sources) values('${JSON.stringify(sources).replaceAll("'","''")}'::jsonb);
notify pgrst,'reload schema';
commit;\n`;
 const freeze=`-- Emergency WRITE freeze only, after separate review/authorization. Never remove ownership filters or history.
begin;
revoke execute on function public.aura_student_nutrition_meal_save(uuid,uuid,jsonb),app_private.student_nutrition_meal_save(uuid,uuid,jsonb),public.aura_student_nutrition_targets_save(uuid,uuid,jsonb),app_private.student_nutrition_targets_save(uuid,uuid,jsonb) from authenticated;
notify pgrst,'reload schema';
commit;\n`;
 return {sql,freeze,manifest:{scope:'aura-private-activation-plan',target:privateActivationTarget,sources,bundleSha256:hash(sql),canonicalCount:19,preparedCount:3,requiresExplicitSchemaAuthorization:true,requiresEmptyDestination:true,createsAccounts:false,importsPersonalData:false}};
}
if(process.argv.includes('--prepare'))void(async()=>{const plan=await privateNutritionActivationPlan(),root=new URL('../.aura-integration/private-activation/',import.meta.url);await mkdir(root,{recursive:true});await writeFile(new URL('activation.sql',root),plan.sql);await writeFile(new URL('freeze-writes.sql',root),plan.freeze);await writeFile(new URL('plan.json',root),JSON.stringify(plan.manifest,null,2)+'\n');console.log('PREPARED ONLY: canonical19 + three personal candidates, exact private target, empty guard and emergency write freeze. No remote operation.');})();
