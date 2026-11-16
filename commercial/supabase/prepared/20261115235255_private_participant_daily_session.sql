-- Incremental opt-in for an EXACT participant link. No Auth settings or global
-- MFA policy changes. Requires canonical19 and the five private candidates.
create table app_private.participant_session_policy(
 organization_id uuid not null,client_id uuid not null,personal_user_id uuid not null references auth.users(id),
 enabled boolean not null,maximum_seconds integer not null check(maximum_seconds=604800),
 revision bigint not null check(revision>0),reason text not null check(length(btrim(reason)) between 3 and 300),
 updated_at timestamptz not null default statement_timestamp(),primary key(organization_id,client_id,personal_user_id),
 foreign key(client_id,organization_id) references public.clients(id,organization_id)
);
alter table app_private.participant_session_policy enable row level security;
revoke all on app_private.participant_session_policy from public,anon,authenticated;
create function app_private.participant_policy_guard() returns trigger language plpgsql set search_path='' as $$begin
 if tg_op='UPDATE' and ((new.organization_id,new.client_id,new.personal_user_id) is distinct from (old.organization_id,old.client_id,old.personal_user_id) or new.revision<>old.revision+1) then raise exception using errcode='PT409',message='Participant policy revision conflict';end if;
 if tg_op='INSERT' and new.revision<>1 then raise exception using errcode='PT409',message='Participant policy starts at revision one';end if;
 if not exists(select 1 from public.client_users where organization_id=new.organization_id and client_id=new.client_id and user_id=new.personal_user_id and revoked_at is null)
 or not exists(select 1 from app_private.organization_security where organization_id=new.organization_id and require_sensitive_aal2) then raise exception using errcode='42501',message='Verified own scope with mandatory MFA required';end if;
 new.updated_at:=statement_timestamp();
 insert into app_private.foundation_events(organization_id,client_id,subject_id,action) values(new.organization_id,new.client_id,new.personal_user_id,case when new.enabled then 'participant_daily_session_enabled' else 'participant_daily_session_disabled' end);
 return new;
end;$$;
create trigger participant_policy_guard before insert or update on app_private.participant_session_policy for each row execute function app_private.participant_policy_guard();
create trigger participant_policy_no_delete before delete on app_private.participant_session_policy for each row execute function app_private.nutrition_immutable();
create function app_private.participant_daily_configured(p_org uuid,p_client uuid) returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(select 1 from app_private.participant_session_policy where organization_id=p_org and client_id=p_client and personal_user_id=auth.uid() and enabled);
$$;
create function app_private.participant_daily_allowed(p_org uuid,p_client uuid) returns boolean
language plpgsql stable security definer set search_path='' as $$declare claims jsonb;sid uuid;begin
 if not app_private.participant_daily_configured(p_org,p_client) or not app_private.nutrition_personal_identity_valid(p_org,p_client) then return false;end if;
 claims:=coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb;
 if claims->>'aal' is distinct from 'aal2' then return false;end if;sid:=(claims->>'session_id')::uuid;
 return exists(select 1 from auth.sessions s join auth.mfa_factors f on f.id=s.factor_id and f.user_id=s.user_id
 join auth.users u on u.id=s.user_id join app_private.participant_session_policy p on p.organization_id=p_org and p.client_id=p_client and p.personal_user_id=s.user_id
 where s.id=sid and s.user_id=auth.uid() and s.aal::text='aal2' and p.enabled
 and s.created_at>statement_timestamp()-make_interval(secs=>p.maximum_seconds) and s.created_at<=statement_timestamp()+interval '1 minute'
 and (s.not_after is null or s.not_after>statement_timestamp()) and (u.banned_until is null or u.banned_until<=statement_timestamp())
 and f.status='verified' and f.factor_type='totp'
 and exists(select 1 from jsonb_array_elements(coalesce(claims->'amr','[]'::jsonb)) a where a->>'method'='totp' and (a->>'timestamp') ~ '^[0-9]{1,12}$'
 and (a->>'timestamp')::bigint between extract(epoch from s.created_at)-60 and extract(epoch from statement_timestamp())+60)
 and exists(select 1 from app_private.organization_security where organization_id=p_org and require_sensitive_aal2));
exception when invalid_text_representation then return false;end;$$;
create or replace function app_private.nutrition_self_allowed(p_org uuid,p_client uuid,p_write boolean default false) returns boolean
language sql stable security definer set search_path='' as $$
 select p_write is not null and app_private.nutrition_personal_identity_valid(p_org,p_client)
 and (case when app_private.participant_daily_configured(p_org,p_client) then app_private.participant_daily_allowed(p_org,p_client) else app_private.sensitive_session_valid(p_org) end)
 and exists(select 1 from public.clients c where c.organization_id=p_org and c.id=p_client and (not p_write or c.archived_at is null));
$$;
-- Patch two FIXED owner-only transaction cores at their single existing MFA gate.
-- The professional path still invokes the original recent-MFA requirement.
do $daily_gates$ declare source text;signature text;needle constant text:='perform app_private.require_sensitive_session(p_org);';begin
 foreach signature in array array['app_private.nutrition_meal_save_scoped(uuid,uuid,jsonb,boolean)','app_private.student_nutrition_targets_save(uuid,uuid,jsonb)'] loop
  source:=pg_get_functiondef(signature::regprocedure);
  if (length(source)-length(replace(source,needle,'')))/length(needle)<>1 then raise exception 'Unexpected transaction MFA gate: %',signature;end if;
  source:=replace(source,needle,case when signature like '%nutrition_meal_save_scoped%' then
   'if not (p_personal and app_private.participant_daily_allowed(p_org,p_client)) then perform app_private.require_sensitive_session(p_org);end if;'
   else 'if not app_private.participant_daily_allowed(p_org,p_client) then perform app_private.require_sensitive_session(p_org);end if;' end);
  execute source;
 end loop;
end;$daily_gates$;
-- Complete exports always require recent MFA, even for a daily participant.
do $recent_exports$ declare name text;begin
 foreach name in array array['student_nutrition_export','student_nutrition_plan_export','student_nutrition_plan_feedback_export'] loop
  execute format('alter function app_private.%I(uuid,uuid) rename to %I',name,name||'_recent_base');
  execute format('revoke all on function app_private.%I(uuid,uuid) from public,anon,authenticated',name||'_recent_base');
  execute format('create function app_private.%I(p_org uuid,p_client uuid) returns jsonb language plpgsql stable security definer set search_path='''' as %L',name,
   'begin if not app_private.nutrition_personal_identity_valid(p_org,p_client) then raise exception using errcode=''42501'',message=''Access denied'';end if;if app_private.participant_daily_configured(p_org,p_client) then perform app_private.require_aal2_session();end if;return app_private.'||name||'_recent_base(p_org,p_client);end;');
  execute format('revoke all on function app_private.%I(uuid,uuid) from public,anon,authenticated',name);
  execute format('grant execute on function app_private.%I(uuid,uuid) to authenticated',name);
 end loop;
end;$recent_exports$;
create or replace function app_private.student_assessments(p_org uuid,p_client uuid,p_offset integer)
returns table(id uuid,assessed_on date,weight_kg numeric,height_cm numeric,waist_cm numeric)
language plpgsql security definer set search_path='' as $$begin
 if not (case when app_private.participant_daily_configured(p_org,p_client) then app_private.nutrition_self_allowed(p_org,p_client,false) else app_private.is_student(p_org,p_client) end)
 then raise exception using errcode='42501',message='Access denied';end if;
 if p_offset is null or p_offset<0 or p_offset>1000000 then raise exception using errcode='22023',message='Invalid offset';end if;
 return query select a.id,a.assessed_on,a.weight_kg,a.height_cm,a.waist_cm from public.assessments a
 where a.organization_id=p_org and a.client_id=p_client and a.student_visible and a.superseded_at is null and a.assessed_on<=app_private.business_today()
 order by a.assessed_on desc,a.id desc limit 25 offset p_offset;
end;$$;
create function app_private.student_session_requirement(p_org uuid,p_client uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$declare daily boolean;expires timestamptz;live boolean;begin
 if auth.uid() is null or not exists(select 1 from public.client_users where organization_id=p_org and client_id=p_client and user_id=auth.uid() and revoked_at is null)
 then raise exception using errcode='42501',message='Access denied';end if;
 daily:=app_private.participant_daily_configured(p_org,p_client);
 if daily then
  select s.created_at+make_interval(secs=>p.maximum_seconds) into expires from auth.sessions s join app_private.participant_session_policy p on p.organization_id=p_org and p.client_id=p_client and p.personal_user_id=s.user_id
  where s.user_id=auth.uid() and s.id=(coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb->>'session_id')::uuid and (s.not_after is null or s.not_after>statement_timestamp());
 end if;
 live:=app_private.nutrition_self_allowed(p_org,p_client,false);
 return jsonb_build_object('mode',case when daily then 'daily' else 'recent' end,'satisfied',live,'sessionExpiresAt',expires,
 'reason',case when live then 'none' when daily and (expires is null or expires<=statement_timestamp()) then 'login-required' else 'mfa-required' end);
exception when invalid_text_representation then raise exception using errcode='42501',message='Access denied';end;$$;
create function public.aura_student_session_requirement(p_org uuid,p_client uuid) returns jsonb language sql stable security invoker set search_path='' as $$select app_private.student_session_requirement(p_org,p_client);$$;
-- Daily feedback history is paginated; full export keeps its recent-MFA gate.
create function app_private.student_nutrition_plan_feedback_history(p_org uuid,p_client uuid,p_before bigint default null) returns jsonb
language plpgsql stable security definer set search_path='' as $$declare entries jsonb;cursor bigint;begin
 if not app_private.nutrition_self_allowed(p_org,p_client,false) then raise exception using errcode='42501',message='Access denied';end if;
 if p_before is not null and (p_before<1 or p_before>=9007199254740991) then raise exception using errcode='22023',message='Invalid history cursor';end if;
 select coalesce(jsonb_agg(jsonb_build_object('entryRevision',entry_revision,'planRevision',plan_revision,'kind',kind,'comment',comment,'recordedAt',recorded_at) order by entry_revision desc),'[]'::jsonb) into entries
 from (select * from app_private.nutrition_personal_plan_entries where organization_id=p_org and client_id=p_client and personal_user_id=auth.uid() and (p_before is null or entry_revision<p_before) order by entry_revision desc limit 20) page;
 if jsonb_array_length(entries)=20 and (entries->19->>'entryRevision')::bigint>1 then cursor:=(entries->19->>'entryRevision')::bigint;end if;
 return jsonb_build_object('scope',jsonb_build_object('organizationId',p_org,'clientId',p_client,'userId',auth.uid()),'entries',entries,'nextBefore',cursor);
end;$$;
create function public.aura_student_nutrition_plan_feedback_history(p_org uuid,p_client uuid,p_before bigint default null) returns jsonb language sql stable security invoker set search_path='' as $$select app_private.student_nutrition_plan_feedback_history(p_org,p_client,p_before);$$;
revoke all on function app_private.participant_policy_guard(),app_private.participant_daily_configured(uuid,uuid),app_private.participant_daily_allowed(uuid,uuid),app_private.nutrition_self_allowed(uuid,uuid,boolean),app_private.student_session_requirement(uuid,uuid),public.aura_student_session_requirement(uuid,uuid),app_private.student_nutrition_plan_feedback_history(uuid,uuid,bigint),public.aura_student_nutrition_plan_feedback_history(uuid,uuid,bigint) from public,anon,authenticated;
grant execute on function app_private.student_session_requirement(uuid,uuid),public.aura_student_session_requirement(uuid,uuid),app_private.student_nutrition_plan_feedback_history(uuid,uuid,bigint),public.aura_student_nutrition_plan_feedback_history(uuid,uuid,bigint) to authenticated;
