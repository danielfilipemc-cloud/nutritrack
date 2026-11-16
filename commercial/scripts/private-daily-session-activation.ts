/** PREPARE ONLY. Two incremental sources; no accounts, opt-ins or health data. */
import {readFile,writeFile,mkdir} from 'node:fs/promises';import {createHash} from 'node:crypto';import {resolve} from 'node:path';import {fileURLToPath} from 'node:url';
import {privatePlanActivation} from './private-plan-activation';
const hash=(s:string)=>createHash('sha256').update(s.replace(/\r\n/g,'\n')).digest('hex'),quote=(s:string)=>"'"+s.replaceAll("'","''")+"'";
export async function privateDailySessionActivation(){const previous=await privatePlanActivation(),files=await Promise.all(['20261115235255_private_participant_daily_session.sql','20261116154212_participant_thirty_day_sessions.sql'].map(async name=>{const body=await readFile(new URL('../supabase/prepared/'+name,import.meta.url),'utf8');return {name,body,sha256:hash(body)};}));
 const manifest={scope:'private-participant-daily-session-activation',target:previous.manifest.target,canonicalChecksums:previous.manifest.canonicalChecksums,previousSources:previous.manifest.previousSources,previousPlanSources:previous.manifest.sources,sources:files.map(({name,sha256})=>({name,sha256})),chosenMaximumDays:30,createsAccounts:false,importsHealthData:false,enablesParticipantPolicy:false};
 const sql=`-- ONLY ${manifest.target.projectId}. No participant policy is enabled by this installation.\nbegin;
do $guard$ begin
 if (select jsonb_object_agg(name,checksum) from app_private.aura_migrations) is distinct from ${quote(JSON.stringify(manifest.canonicalChecksums))}::jsonb
 or (select sources from app_private.aura_private_activation where id) is distinct from ${quote(JSON.stringify(manifest.previousSources))}::jsonb
 or (select sources from app_private.aura_private_plan_activation where id) is distinct from ${quote(JSON.stringify(manifest.previousPlanSources))}::jsonb then raise exception 'Private installed checksum inventory mismatch';end if;
 if to_regclass('app_private.participant_session_policy') is not null or to_regclass('app_private.aura_private_daily_session_activation') is not null then raise exception 'Existing or partial daily-session installation: inspect, never reinstall';end if;
end;$guard$;
${files.map(f=>f.body).join('\n')}
create table app_private.aura_private_daily_session_activation(id boolean primary key default true check(id),sources jsonb not null,installed_at timestamptz not null default statement_timestamp());
alter table app_private.aura_private_daily_session_activation enable row level security;
revoke all on app_private.aura_private_daily_session_activation from public,anon,authenticated;
insert into app_private.aura_private_daily_session_activation(sources) values(${quote(JSON.stringify(manifest.sources))}::jsonb);
notify pgrst,'reload schema';commit;\n`;
 return {sql,manifest:{...manifest,bundleSha256:hash(sql)}};
}
if(process.argv.includes('--prepare')&&resolve(process.argv[1]||'')===fileURLToPath(import.meta.url))void(async()=>{const plan=await privateDailySessionActivation(),root=new URL('../.aura-integration/private-daily-session/',import.meta.url);await mkdir(root,{recursive:true});await writeFile(new URL('schema-activation.sql',root),plan.sql);await writeFile(new URL('schema-activation.json',root),JSON.stringify(plan.manifest,null,2)+'\n');console.log(JSON.stringify({preparedOnly:true,target:plan.manifest.target.projectId,bundleSha256:plan.manifest.bundleSha256,sources:plan.manifest.sources,enablesParticipantPolicy:false}));})().catch(()=>{console.error('Daily-session preparation failed. No remote action attempted.');process.exitCode=1;});
