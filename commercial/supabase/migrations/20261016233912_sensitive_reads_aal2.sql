-- Extend opt-in MFA to pupil data reads as well as sensitive commands.
create function app_private.sensitive_session_valid(p_org uuid) returns boolean
language plpgsql stable security definer set search_path='' as $fn$begin
 if auth.uid() is null then return false;end if;
 if not exists(select 1 from app_private.organization_security where organization_id=p_org and require_sensitive_aal2) then return true;end if;
 perform app_private.require_aal2_session();return true;
exception when sqlstate 'PT403' then return false;end;$fn$;
revoke all on function app_private.sensitive_session_valid(uuid) from public,anon,authenticated;
grant execute on function app_private.sensitive_session_valid(uuid) to authenticated;

create or replace function app_private.can_access_client(p_org uuid,p_client uuid,p_module text,p_write boolean default false) returns boolean
language sql stable security definer set search_path='' as $fn$
 select auth.uid() is not null and exists(select 1 from public.clients where organization_id=p_org and id=p_client)
 and app_private.is_member(p_org) and app_private.sensitive_session_valid(p_org) and (
 (p_module in ('profile','schedule') and app_private.can_manage_access(p_org)) or
 exists(select 1 from public.client_assignments a join public.staff_capabilities c on c.organization_id=a.organization_id and c.user_id=a.user_id
 where a.organization_id=p_org and a.client_id=p_client and a.user_id=auth.uid() and c.module=p_module and (not p_write or c.can_write)));
$fn$;
create or replace function app_private.is_student(p_org uuid,p_client uuid) returns boolean language sql stable security definer set search_path='' as $fn$
 select auth.uid() is not null and app_private.sensitive_session_valid(p_org) and exists(select 1 from public.client_users where organization_id=p_org and client_id=p_client and user_id=auth.uid() and revoked_at is null);
$fn$;

create function app_private.security_requirement(p_org uuid) returns jsonb language plpgsql stable security definer set search_path='' as $fn$begin
 if auth.uid() is null or (not app_private.is_member(p_org) and not exists(select 1 from public.client_users where organization_id=p_org and user_id=auth.uid() and revoked_at is null)) then raise exception using errcode='42501',message='Access denied';end if;
 return jsonb_build_object('required',exists(select 1 from app_private.organization_security where organization_id=p_org and require_sensitive_aal2),'satisfied',app_private.sensitive_session_valid(p_org));
end;$fn$;
create function public.aura_security_requirement(p_org uuid) returns jsonb language sql stable security invoker set search_path='' as $fn$select app_private.security_requirement(p_org);$fn$;
revoke all on function app_private.security_requirement(uuid),public.aura_security_requirement(uuid) from public,anon,authenticated;
grant execute on function app_private.security_requirement(uuid),public.aura_security_requirement(uuid) to authenticated;

do $wrap$declare f record;args text;begin
 for f in select p.proname,p.proargnames,pg_get_function_identity_arguments(p.oid) signature,pg_get_function_arguments(p.oid) declarations
 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='app_private' and p.proname in ('privacy_context','privacy_review_history')
 loop
 args:=array_to_string(f.proargnames,',');
 execute format('alter function app_private.%I(%s) rename to %I',f.proname,f.signature,f.proname||'_session_base');
 execute format('revoke all on function app_private.%I(%s) from public,anon,authenticated',f.proname||'_session_base',f.signature);
 execute format('create function app_private.%I(%s) returns jsonb language plpgsql security definer set search_path='''' as %L',f.proname,f.declarations,
 'begin if not app_private.sensitive_session_valid(p_org) then raise exception using errcode=''PT403'',message=''Recent MFA required'';end if;return '||format('app_private.%I(%s);end;',f.proname||'_session_base',args));
 execute format('revoke all on function app_private.%I(%s) from public,anon,authenticated',f.proname,f.signature);
 execute format('grant execute on function app_private.%I(%s) to authenticated',f.proname,f.signature);
 end loop;
end;$wrap$;
