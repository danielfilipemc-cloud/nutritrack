/** Offline only: emits checksum manifests and READ ONLY inspection SQL, never migrations. */
import {readFile,readdir,mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {migrationSource} from './migration-bundle';
export const nutritionIntegrationSha='f2a5e90cb8592043f839de2281c0a9c5cdf0ff0a';
const additions=['migrations/20261018203955_nutrition_foundation.sql','migrations/20261018204504_nutrition_transactions.sql'];
function inspectionSql(entries:{name:string;checksum:string}[]){
 const values=entries.map(entry=>`('${entry.name}','${entry.checksum}')`).join(',\n');
 return `-- PREPARED ONLY. Verify project vgbwmamntjmhzrpvhxzb externally first.
-- PASS below means registry match ONLY, not authorization or readiness.
begin transaction read only;
with expected(name,checksum) as (values ${values}), differences as (
 select coalesce(e.name,a.name) name,e.checksum expected_checksum,a.checksum observed_checksum,
 case when e.name is null then 'unexpected' when a.name is null then 'missing' else 'checksum_mismatch' end reason
 from expected e full join app_private.aura_migrations a using(name)
 where e.name is null or a.name is null or e.checksum is distinct from a.checksum
)
select case when count(*)=0 then 'PASS' else 'STOP' end registry_status,
 ${entries.length} expected_count,(select count(*) from app_private.aura_migrations) observed_count,
 coalesce(jsonb_agg(to_jsonb(differences) order by name),'[]'::jsonb) differences from differences;
select name,checksum,applied_at from app_private.aura_migrations order by name;
select n.nspname schema,c.relname table_name,c.relrowsecurity rls,c.relforcerowsecurity force_rls,
 has_table_privilege('anon',c.oid,'SELECT') anon_select,has_table_privilege('authenticated',c.oid,'SELECT') authenticated_select,
 has_table_privilege('authenticated',c.oid,'INSERT') authenticated_insert,
 has_table_privilege('authenticated',c.oid,'UPDATE') authenticated_update,
 has_table_privilege('authenticated',c.oid,'DELETE') authenticated_delete
 from pg_class c join pg_namespace n on n.oid=c.relnamespace
 where n.nspname in ('public','app_private') and c.relkind='r' and c.relname like 'nutrition_%' order by n.nspname,c.relname;
select n.nspname schema,p.proname function_name,pg_get_function_identity_arguments(p.oid) signature,
 p.prosecdef security_definer,p.proconfig configuration,
 has_function_privilege('anon',p.oid,'EXECUTE') anon_execute,
 has_function_privilege('authenticated',p.oid,'EXECUTE') authenticated_execute
 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where (n.nspname='public' and p.proname like 'aura_nutrition_%') or (n.nspname='app_private' and p.proname like 'nutrition_%')
 order by n.nspname,p.proname;
select schemaname,tablename,policyname,roles,cmd,qual,with_check from pg_policies where tablename like 'nutrition_%' order by schemaname,tablename,policyname;
rollback;
`;
}
export async function nutritionActivationArtifacts(){
 const dir=new URL('../supabase/',import.meta.url);
 const extras=(await readdir(new URL('migrations/',dir))).filter(name=>name.endsWith('.sql')).sort().map(name=>'migrations/'+name);
 const names=['schema.sql','002_assessments.sql','003_branding.sql',...extras];
 if(names.length!==19||JSON.stringify(names.slice(17))!==JSON.stringify(additions))throw Error('Migration set changed: independent plan review required');
 const entries=await Promise.all(names.map(async(name,index)=>({sequence:index+1,name,checksum:createHash('sha256').update(migrationSource(name,await readFile(new URL(name,dir),'utf8'))).digest('hex')})));
 return {
  manifest:{schemaVersion:1,state:'prepared-not-authorized',codeSha:nutritionIntegrationSha,projectRef:'vgbwmamntjmhzrpvhxzb',environment:'staging',remoteExecutionAuthorized:false,deployAuthorized:false,baselineCount:17,candidateCount:19,checksumConvention:'migrationSource: foundation CRLF, later migrations LF; SHA-256',fixtureBinding:'unbound-private-manifest-required',migrations:entries},
  preflight:inspectionSql(entries.slice(0,17)),postflight:inspectionSql(entries)
 };
}
if(process.argv.includes('--emit-plan'))void(async()=>{
 const value=await nutritionActivationArtifacts();const folder=new URL('../docs/review/nutrition-activation/',import.meta.url);await mkdir(folder,{recursive:true});
 await writeFile(new URL('migration-manifest.json',folder),JSON.stringify(value.manifest,null,2)+'\n');
 await writeFile(new URL('preflight.readonly.sql',folder),value.preflight);
 await writeFile(new URL('postflight.readonly.sql',folder),value.postflight);
 console.log('Offline artifacts prepared. No network, migrations or remote verification performed.');
})().catch(error=>{console.error(error);process.exitCode=1;});
