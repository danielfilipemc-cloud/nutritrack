-- Explicit opt-in per organization. No existing organization is locked out.
create table app_private.organization_security(
 organization_id uuid primary key references public.organizations(id),require_sensitive_aal2 boolean not null,
 revision bigint not null check(revision>0),updated_by uuid not null,updated_at timestamptz not null default statement_timestamp()
);
alter table app_private.organization_security enable row level security;
revoke all on app_private.organization_security from public,anon,authenticated;

create function app_private.require_aal2_session() returns void language plpgsql security definer set search_path='' as $fn$
declare claims jsonb:=coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb;sid text:=claims->>'session_id';begin
 if auth.uid() is null or claims->>'aal' is distinct from 'aal2' or sid is null or sid !~* '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$'
 then raise exception using errcode='PT403',message='Recent MFA required';end if;
 if not exists(select 1 from auth.sessions where id=sid::uuid and user_id=auth.uid() and (not_after is null or not_after>statement_timestamp()))
 or not exists(select 1 from auth.mfa_factors where user_id=auth.uid() and status='verified' and factor_type='totp')
 or not exists(select 1 from jsonb_array_elements(coalesce(claims->'amr','[]'::jsonb)) a
 where a->>'method'='totp' and (a->>'timestamp') ~ '^[0-9]{1,12}$'
 and (a->>'timestamp')::bigint between extract(epoch from statement_timestamp())-600 and extract(epoch from statement_timestamp())+60)
 then raise exception using errcode='PT403',message='Recent active MFA session required';end if;
end;$fn$;
create function app_private.require_sensitive_session(p_org uuid) returns void language plpgsql security definer set search_path='' as $fn$begin
 if auth.uid() is null then raise exception using errcode='42501',message='Access denied';end if;
 perform 1 from public.organizations where id=p_org for update;
 if exists(select 1 from app_private.organization_security where organization_id=p_org and require_sensitive_aal2) then perform app_private.require_aal2_session();end if;
end;$fn$;
revoke all on function app_private.require_aal2_session(),app_private.require_sensitive_session(uuid) from public,anon,authenticated;

create function app_private.security_context(p_org uuid) returns jsonb language plpgsql security definer set search_path='' as $fn$
declare policy app_private.organization_security%rowtype;begin
 if not app_private.can_manage_access(p_org) then raise exception using errcode='42501',message='Access denied';end if;
 select * into policy from app_private.organization_security where organization_id=p_org;
 return jsonb_build_object('required',coalesce(policy.require_sensitive_aal2,false),'revision',coalesce(policy.revision,0),
 'can_configure',exists(select 1 from public.organization_members where organization_id=p_org and user_id=auth.uid() and role='owner'));
end;$fn$;
create function public.aura_security_context(p_org uuid) returns jsonb language sql security invoker set search_path='' as $fn$select app_private.security_context(p_org);$fn$;
create function app_private.security_policy_save(p_org uuid,p_required boolean,p_revision bigint) returns bigint language plpgsql security definer set search_path='' as $fn$
declare rev bigint;begin
 perform 1 from public.organizations where id=p_org for update;
 if auth.uid() is null or not exists(select 1 from public.organization_members where organization_id=p_org and user_id=auth.uid() and role='owner')
 then raise exception using errcode='42501',message='Only owner may configure MFA policy';end if;
 -- Both enabling and disabling require current AAL2, live session and a recent TOTP.
 perform app_private.require_aal2_session();
 select revision into rev from app_private.organization_security where organization_id=p_org;
 if p_revision is null or p_revision<>coalesce(rev,0) then raise exception using errcode='PT409',message='Revision conflict';end if;
 if p_required is null then raise exception using errcode='22023',message='Invalid policy';end if;
 insert into app_private.organization_security(organization_id,require_sensitive_aal2,revision,updated_by) values(p_org,p_required,1,auth.uid())
 on conflict(organization_id) do update set require_sensitive_aal2=excluded.require_sensitive_aal2,revision=organization_security.revision+1,updated_by=auth.uid(),updated_at=statement_timestamp()
 returning revision into rev;
 insert into app_private.foundation_events(organization_id,actor_id,action) values(p_org,auth.uid(),case when p_required then 'sensitive_mfa_enabled' else 'sensitive_mfa_disabled' end);
 return rev;end;$fn$;
create function public.aura_security_policy_save(p_org uuid,p_required boolean,p_revision bigint) returns bigint language sql security invoker set search_path='' as $fn$select app_private.security_policy_save(p_org,p_required,p_revision);$fn$;
revoke all on function app_private.security_context(uuid),public.aura_security_context(uuid),app_private.security_policy_save(uuid,boolean,bigint),public.aura_security_policy_save(uuid,boolean,bigint) from public,anon,authenticated;
grant execute on function app_private.security_context(uuid),public.aura_security_context(uuid),app_private.security_policy_save(uuid,boolean,bigint),public.aura_security_policy_save(uuid,boolean,bigint) to authenticated;

-- Wrap a fixed, reviewed command list without changing the existing contracts.
-- Historical implementations become owner-only; there is no authenticated bypass.
do $wrap$declare f record;args text;body text;begin
 for f in select p.oid,p.proname,p.proargnames,p.pronargs,p.proretset,pg_get_function_identity_arguments(p.oid) signature,pg_get_function_arguments(p.oid) declarations,pg_get_function_result(p.oid) result,p.prorettype
 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='app_private' and p.proname in
 ('capability_save','assignment_save','student_invite_create','student_revoke','invitation_create','invitation_revoke','team_change','privacy_review','retention_save','assessment_share','assessment_correct','visible_export','nutritrack_link_save')
 loop
 if f.proargnames[1]<>'p_org' then raise exception 'Unexpected sensitive command signature';end if;
 args:=array_to_string(f.proargnames[1:f.pronargs],',');
 execute format('alter function app_private.%I(%s) rename to %I',f.proname,f.signature,f.proname||'_sensitive_base');
 execute format('revoke all on function app_private.%I(%s) from public,anon,authenticated',f.proname||'_sensitive_base',f.signature);
 body:='begin perform app_private.require_sensitive_session(p_org); '||case when f.proretset then 'return query select * from ' when f.prorettype='void'::regtype then 'perform ' else 'return ' end||format('app_private.%I(%s);',f.proname||'_sensitive_base',args)||case when f.prorettype='void'::regtype then 'return; ' else '' end||'end;';
 execute format('create function app_private.%I(%s) returns %s language plpgsql security definer set search_path='''' as %L',f.proname,f.declarations,f.result,body);
 execute format('revoke all on function app_private.%I(%s) from public,anon,authenticated',f.proname,f.signature);
 execute format('grant execute on function app_private.%I(%s) to authenticated',f.proname,f.signature);
 end loop;
end;$wrap$;
