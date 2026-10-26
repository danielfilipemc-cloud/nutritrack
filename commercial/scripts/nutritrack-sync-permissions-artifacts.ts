/** OFFLINE ONLY. Emits a proposal/checksums and inspection SQL, never executes SQL. */
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {nutritionActivationArtifacts} from './nutrition-activation-artifacts';
import {migrationSource} from './migration-bundle';

export const syncCandidateFile='20261025234116_nutritrack_sync_permissions.sql';
const requiredAuthColumns=[['users','id'],['users','email_confirmed_at'],['users','is_anonymous'],['users','deleted_at'],['users','banned_until'],['sessions','id'],['sessions','user_id'],['sessions','not_after'],['mfa_factors','user_id'],['mfa_factors','status'],['mfa_factors','factor_type']];
type Entry={name:string;checksum:string};
function registrySql(entries:Entry[]){return `with expected(name,checksum) as (values ${entries.map(e=>`('${e.name}','${e.checksum}')`).join(',\n')}), differences as (
 select coalesce(e.name,a.name) name from expected e full join app_private.aura_migrations a using(name)
 where e.name is null or a.name is null or e.checksum is distinct from a.checksum)
select case when count(*)=0 then 'PASS' else 'STOP' end registry_status,
 ${entries.length} expected_count,(select count(*) from app_private.aura_migrations) observed_count from differences;\n`;}
const inventory=`select n.nspname schema,c.relname,c.relrowsecurity rls,
 has_table_privilege('anon',c.oid,'SELECT') anon_read,has_table_privilege('authenticated',c.oid,'SELECT') authenticated_read,
 has_table_privilege('authenticated',c.oid,'INSERT') authenticated_insert,has_table_privilege('authenticated',c.oid,'UPDATE') authenticated_update,
 has_table_privilege('authenticated',c.oid,'DELETE') authenticated_delete
 from pg_class c join pg_namespace n on n.oid=c.relnamespace
 where n.nspname='app_private' and c.relname in ('nutritrack_sync_links','nutritrack_sync_consents');
select n.nspname schema,p.proname,p.prosecdef security_definer,p.proconfig configuration,
 pg_get_function_identity_arguments(p.oid) signature,md5(pg_get_functiondef(p.oid)) definition_digest,
 has_function_privilege('anon',p.oid,'EXECUTE') anon_execute,has_function_privilege('authenticated',p.oid,'EXECUTE') authenticated_execute
 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname in ('public','app_private') and p.proname like '%nutritrack_sync_%' order by n.nspname,p.proname;
select n.nspname schema,c.relname,t.tgname,pg_get_triggerdef(t.oid) definition
 from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace
 where not t.tgisinternal and t.tgname in ('sync_link_immutable','sync_consent_immutable','sync_binding_invalidated');
select schemaname,tablename,policyname,roles,cmd,qual,with_check from pg_policies
 where schemaname='app_private' and tablename in ('nutritrack_sync_links','nutritrack_sync_consents');\n`;
export async function syncPermissionsArtifacts(){
 const base=await nutritionActivationArtifacts();
 const path='supabase/local-validation/nutritrack-sync/'+syncCandidateFile;
 const source=await readFile(new URL('../'+path,import.meta.url),'utf8');
 const proposed={name:'migrations/'+syncCandidateFile,checksum:createHash('sha256').update(migrationSource('migrations/'+syncCandidateFile,source)).digest('hex')};
 const header='-- PREPARED ONLY. Verify project vgbwmamntjmhzrpvhxzb externally first.\n-- No personal rows, Auth identities, tokens or secrets are selected. PASS is NOT activation approval.\nbegin transaction read only;\n';
 const authValues=requiredAuthColumns.map(([table,column])=>`('${table}','${column}')`).join(',');
 const preflight=header+registrySql(base.manifest.migrations)+`with required(table_name,column_name) as (values ${authValues})
select case when not exists(select 1 from required r where not exists(select 1 from information_schema.columns c
 where c.table_schema='auth' and c.table_name=r.table_name and c.column_name=r.column_name)) then 'PASS' else 'STOP' end auth_contract_status;
select case when not exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','app_private') and p.proname like '%nutritrack_sync_%')
 and to_regclass('app_private.nutritrack_sync_links') is null and to_regclass('app_private.nutritrack_sync_consents') is null
 and not exists(select 1 from pg_trigger where tgname in ('sync_link_immutable','sync_consent_immutable','sync_binding_invalidated'))
 and to_regclass('app_private.sync_current_binding_idx') is null then 'PASS' else 'STOP' end candidate_absent_status;
select case when to_regprocedure('app_private.nutrition_allowed(uuid,uuid,boolean)') is not null
 and to_regprocedure('app_private.require_sensitive_session(uuid)') is not null
 and to_regprocedure('app_private.sensitive_session_valid(uuid)') is not null then 'PASS' else 'STOP' end prerequisites_status;
`+inventory+'rollback;\n';
 return {manifest:{schemaVersion:1,state:'offline-permission-candidate',projectRef:'vgbwmamntjmhzrpvhxzb',environment:'staging',remoteExecutionAuthorized:false,
  baselineCount:19,candidateCount:20,candidatePath:path,proposedRegistryEntry:proposed,baseline:base.manifest.migrations,
  effects:{privateTables:2,functions:11,publicInvokerRPCs:3,selectPolicies:2,triggers:3,explicitIndexes:1},
  existingRelationChange:'One additive invalidation trigger on public.client_users; no existing function or policy is replaced.',
  authConfigurationChanged:false,payloadStorageOrTransportEnabled:false,checksumConvention:'migrationSource SHA-256; historical CRLF sources unchanged'},
  preflight,postflight:header+registrySql([...base.manifest.migrations,proposed])+inventory+'rollback;\n'};
}
if(process.argv.includes('--emit-sync-plan'))void(async()=>{
 const a=await syncPermissionsArtifacts(),dir=new URL('../docs/review/nutritrack-sync-permissions/',import.meta.url);await mkdir(dir,{recursive:true});
 await writeFile(new URL('manifest.json',dir),JSON.stringify(a.manifest,null,2)+'\n');
 await writeFile(new URL('preflight.readonly.sql',dir),a.preflight);await writeFile(new URL('postflight.readonly.sql',dir),a.postflight);
 console.log('Offline candidate and read-only inspection artifacts emitted. No network or database execution.');
})().catch(e=>{console.error(e);process.exitCode=1;});
