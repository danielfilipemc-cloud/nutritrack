-- Incremental after private_participant_daily_session. Allow the participant's
-- separately chosen thirty-day maximum without extending existing opt-ins.
alter table app_private.participant_session_policy drop constraint participant_session_policy_maximum_seconds_check;
alter table app_private.participant_session_policy add constraint participant_session_policy_maximum_seconds_check check(maximum_seconds in (604800,2592000));
create table app_private.participant_session_policy_versions(
 organization_id uuid not null,client_id uuid not null,personal_user_id uuid not null,revision bigint not null,
 enabled boolean not null,maximum_seconds integer not null check(maximum_seconds in (604800,2592000)),reason text not null,
 effective_at timestamptz not null,recorded_at timestamptz not null default statement_timestamp(),baseline boolean not null,
 primary key(organization_id,client_id,personal_user_id,revision),
 foreign key(organization_id,client_id,personal_user_id) references app_private.participant_session_policy(organization_id,client_id,personal_user_id)
);
alter table app_private.participant_session_policy_versions enable row level security;
revoke all on app_private.participant_session_policy_versions from public,anon,authenticated;
insert into app_private.participant_session_policy_versions(organization_id,client_id,personal_user_id,revision,enabled,maximum_seconds,reason,effective_at,baseline)
select organization_id,client_id,personal_user_id,revision,enabled,maximum_seconds,reason,updated_at,true from app_private.participant_session_policy;
create function app_private.participant_policy_record() returns trigger language plpgsql set search_path='' as $$begin
 insert into app_private.participant_session_policy_versions(organization_id,client_id,personal_user_id,revision,enabled,maximum_seconds,reason,effective_at,baseline)
 values(new.organization_id,new.client_id,new.personal_user_id,new.revision,new.enabled,new.maximum_seconds,new.reason,new.updated_at,false);return new;
end;$$;
revoke all on function app_private.participant_policy_record() from public,anon,authenticated;
create trigger participant_policy_record after insert or update on app_private.participant_session_policy for each row execute function app_private.participant_policy_record();
create trigger participant_policy_versions_immutable before update or delete on app_private.participant_session_policy_versions for each row execute function app_private.nutrition_immutable();
create or replace function app_private.student_session_requirement(p_org uuid,p_client uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$declare daily boolean;expires timestamptz;live boolean;days integer;begin
 if auth.uid() is null or not exists(select 1 from public.client_users where organization_id=p_org and client_id=p_client and user_id=auth.uid() and revoked_at is null)
 then raise exception using errcode='42501',message='Access denied';end if;
 daily:=app_private.participant_daily_configured(p_org,p_client);
 if daily then
  select maximum_seconds/86400 into days from app_private.participant_session_policy where organization_id=p_org and client_id=p_client and personal_user_id=auth.uid() and enabled;
  select least(s.created_at+make_interval(days=>days),coalesce(s.not_after,'infinity'::timestamptz)) into expires from auth.sessions s
  where s.user_id=auth.uid() and s.id=(coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb->>'session_id')::uuid and (s.not_after is null or s.not_after>statement_timestamp());
 end if;
 live:=app_private.nutrition_self_allowed(p_org,p_client,false);
 return jsonb_build_object('mode',case when daily then 'daily' else 'recent' end,'satisfied',live,'sessionExpiresAt',expires,'maximumDays',days,
 'reason',case when live then 'none' when daily and (expires is null or expires<=statement_timestamp()) then 'login-required' else 'mfa-required' end);
exception when invalid_text_representation then raise exception using errcode='42501',message='Access denied';end;$$;
-- No opt-in inserted or updated here. Existing seven-day participants stay at
-- seven days until a separately authorized, scope-bound policy revision.
