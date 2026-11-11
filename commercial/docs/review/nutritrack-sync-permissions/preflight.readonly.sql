-- PREPARED ONLY. Verify project vgbwmamntjmhzrpvhxzb externally first.
-- No personal rows, Auth identities, tokens or secrets are selected. PASS is NOT activation approval.
begin transaction read only;
with expected(name,checksum) as (values ('schema.sql','c45dd37d5cbddeaa65ded29d631421d06593fc76014cb38b68128660e8a8b890'),
('002_assessments.sql','99b9e62c5f558321700b1f1415d9fcd9898093bf3d52b908cc3ec3617816dd96'),
('003_branding.sql','97dc0225af4f4ca37b0463bf259efec2856646dc4b0ac06da3adf2f99bc683eb'),
('migrations/20261013175333_team_invitations.sql','27cc9bbd4c6720a013fccb2db2163842a987e605dac910fda0abb73c26fb6e67'),
('migrations/20261013181649_client_management.sql','d8e23c0c154bf508661db71708335c10d591743085605e53ca3698a5209359be'),
('migrations/20261013201340_client_conflict_response.sql','12ee866e584bd7dd797ba0befe8cfa06fd5cba6bdd1369d506a494ae505408e6'),
('migrations/20261013202654_professional_dashboard.sql','665047dd2eba7f069a701aa941df5054ff88d17042ae598fea006baf8efc8512'),
('migrations/20261013210823_followup_agenda.sql','105bd1fb0ef9f5a7161bf3369a45789efcac69f528a067f0add31d9ae0ef9b08'),
('migrations/20261014180741_student_identity_permissions.sql','02461ce23aac47ab4a55b83b034f277dd82b680a47f6e716e51bf506a36a50d3'),
('migrations/20261014180744_privacy_integrity_recovery.sql','61464a14070b7de465614263fd1936ea5fb4a99f541b07178a95a07d282c9746'),
('migrations/20261016184133_student_objectives.sql','6bf231893d6343885e0c1da7bec87c49a532d73561cc2deaf22525fef150e73d'),
('migrations/20261016195103_daily_priorities.sql','ae5d07ba1989d3fd491aa9d1b84acc57b32bfc629f49bdb33605b3ef31bd61a3'),
('migrations/20261016195602_integrated_timeline.sql','811ab7c767adc58fb52844dc8546e1086a0a2439cc9ba9a375bd2fa5e874ad04'),
('migrations/20261016221754_nutritrack_measurement_bridge.sql','02c2738a6680d2bd288dec3ed80ad6d53353c78e743fab7af722614dce4a298b'),
('migrations/20261016231855_privacy_scope_and_review_audit.sql','a8d44bd35453dda77db502c416e078debd2b60dd697324c7137e11a0636bc3e4'),
('migrations/20261016231856_sensitive_session_policy.sql','4015197a3f1eb675dce97d2a501dd2729ce06dc0f0c5d61fe4e0790eb2e19965'),
('migrations/20261016233912_sensitive_reads_aal2.sql','ea31a8b486e68c57724d9316382ef5ab53599a2dae4fb3afc99aeb45caa35a96'),
('migrations/20261018203955_nutrition_foundation.sql','3505720c9eff93e414fc56896535c00d8b2f281a3f7e80366806c00820ecaeaa'),
('migrations/20261018204504_nutrition_transactions.sql','1f54ecfa9ce070c8980fa6f1f80725ffb9516754cb411792e20afe405a09878b')), differences as (
 select coalesce(e.name,a.name) name from expected e full join app_private.aura_migrations a using(name)
 where e.name is null or a.name is null or e.checksum is distinct from a.checksum)
select case when count(*)=0 then 'PASS' else 'STOP' end registry_status,
 19 expected_count,(select count(*) from app_private.aura_migrations) observed_count from differences;
with required(table_name,column_name) as (values ('users','id'),('users','email_confirmed_at'),('users','is_anonymous'),('users','deleted_at'),('users','banned_until'),('sessions','id'),('sessions','user_id'),('sessions','not_after'),('mfa_factors','user_id'),('mfa_factors','status'),('mfa_factors','factor_type'))
select case when not exists(select 1 from required r where not exists(select 1 from information_schema.columns c
 where c.table_schema='auth' and c.table_name=r.table_name and c.column_name=r.column_name)) then 'PASS' else 'STOP' end auth_contract_status;
select case when not exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','app_private') and p.proname like '%nutritrack_sync_%')
 and to_regclass('app_private.nutritrack_sync_links') is null and to_regclass('app_private.nutritrack_sync_consents') is null
 and not exists(select 1 from pg_trigger where tgname in ('sync_link_immutable','sync_consent_immutable','sync_binding_invalidated'))
 and to_regclass('app_private.sync_current_binding_idx') is null then 'PASS' else 'STOP' end candidate_absent_status;
select case when to_regprocedure('app_private.nutrition_allowed(uuid,uuid,boolean)') is not null
 and to_regprocedure('app_private.require_sensitive_session(uuid)') is not null
 and to_regprocedure('app_private.sensitive_session_valid(uuid)') is not null then 'PASS' else 'STOP' end prerequisites_status;
select n.nspname schema,c.relname,c.relrowsecurity rls,
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
 where schemaname='app_private' and tablename in ('nutritrack_sync_links','nutritrack_sync_consents');
rollback;
