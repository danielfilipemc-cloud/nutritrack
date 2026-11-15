/** PREPARE ONLY. No remote connection and no personal content. */
import {readFile,writeFile,mkdir} from 'node:fs/promises';import {createHash} from 'node:crypto';
import {privateNutritionActivationPlan,privateActivationTarget} from './private-nutrition-activation-plan';import {migrationBundle} from './migration-bundle';
const hash=(s:string)=>createHash('sha256').update(s.replace(/\r\n/g,'\n')).digest('hex');
const quote=(s:string)=>"'"+s.replaceAll("'","''")+"'";
export async function privatePlanActivation(){
 const initial=await privateNutritionActivationPlan(),canonical=await migrationBundle(),checksums=Object.fromEntries([...canonical.matchAll(/insert into app_private\.aura_migrations\(name,checksum\) values \('([^']+)','([a-f0-9]{64})'\)/g)].map(m=>[m[1],m[2]]));
 if(Object.keys(checksums).length!==19)throw Error('Expected exact canonical checksum inventory');
 const sources=await Promise.all(['20261114234627_nutrition_personal_plan_reference.sql','20261115004835_nutrition_personal_plan_changes.sql'].map(async name=>{const body=await readFile(new URL('../supabase/prepared/'+name,import.meta.url),'utf8');return {name,body,sha256:hash(body)};}));
 const manifest={scope:'private-plan-incremental-activation',target:privateActivationTarget,previousSources:initial.manifest.sources,canonicalChecksums:checksums,sources:sources.map(({name,sha256})=>({name,sha256})),createsAccounts:false,includesPersonalContent:false};
 const sql=`-- EXACT PRIVATE TARGET ${privateActivationTarget.projectId}. Never production/staging.\nbegin;
do $plan_guard$ begin
 if (select sources from app_private.aura_private_activation where id) is distinct from ${quote(JSON.stringify(initial.manifest.sources))}::jsonb
 or (select jsonb_object_agg(name,checksum) from app_private.aura_migrations) is distinct from ${quote(JSON.stringify(checksums))}::jsonb then raise exception 'Installed private source/checksum mismatch';end if;
 if to_regclass('app_private.nutrition_personal_plan_versions') is not null or to_regclass('app_private.nutrition_personal_plan_entries') is not null or to_regclass('app_private.aura_private_plan_activation') is not null then raise exception 'Existing or partial plan installation: inspect; do not reinstall';end if;
end;$plan_guard$;
${sources.map(s=>s.body).join('\n')}
create table app_private.aura_private_plan_activation(id boolean primary key default true check(id),sources jsonb not null,installed_at timestamptz not null default statement_timestamp());
alter table app_private.aura_private_plan_activation enable row level security;
revoke all on app_private.aura_private_plan_activation from public,anon,authenticated;
insert into app_private.aura_private_plan_activation(sources) values(${quote(JSON.stringify(manifest.sources))}::jsonb);
notify pgrst,'reload schema';
commit;\n`;
 return {sql,manifest:{...manifest,bundleSha256:hash(sql)}};
}
if(process.argv.includes('--prepare'))void(async()=>{const plan=await privatePlanActivation(),root=new URL('../.aura-integration/private-meal-plan/',import.meta.url);await mkdir(root,{recursive:true});await writeFile(new URL('schema-activation.sql',root),plan.sql);await writeFile(new URL('schema-activation.json',root),JSON.stringify(plan.manifest,null,2)+'\n');console.log(JSON.stringify({preparedOnly:true,target:plan.manifest.target.projectId,bundleSha256:plan.manifest.bundleSha256,sources:plan.manifest.sources,includesPersonalContent:false}));})().catch(()=>{console.error('Private plan preparation failed. No remote operation attempted.');process.exitCode=1;});
