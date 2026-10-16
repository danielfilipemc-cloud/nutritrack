-- Phase 1B technical controls. No automatic deletion or legal basis assumptions.
alter table public.assessments add column revision bigint not null default 1 check(revision>0),
 add column student_visible boolean not null default false,
 add column supersedes_id uuid unique,
 add column superseded_at timestamptz,
 add constraint assessment_correction_tenant_fk foreign key(supersedes_id,organization_id) references public.assessments(id,organization_id),
 add constraint assessment_not_self_correction check(supersedes_id is null or supersedes_id<>id);
create table app_private.assessment_corrections (
 assessment_id uuid primary key,organization_id uuid not null,actor_id uuid not null,
 reason text not null check(length(trim(reason)) between 5 and 500),created_at timestamptz not null default statement_timestamp(),
 foreign key(assessment_id,organization_id) references public.assessments(id,organization_id)
);
create table app_private.consent_records (
 id uuid primary key default gen_random_uuid(),organization_id uuid not null,client_id uuid not null,actor_id uuid not null,
 purpose text not null check(purpose in ('progress_photos','optional_notifications')),
 document_version text not null check(length(trim(document_version)) between 1 and 80),accepted boolean not null,
 created_at timestamptz not null default statement_timestamp(),
 foreign key(client_id,organization_id) references public.clients(id,organization_id)
);
create table app_private.privacy_requests (
 id uuid primary key default gen_random_uuid(),organization_id uuid not null,client_id uuid not null,requested_by uuid not null,
 kind text not null check(kind in ('export','erasure')),status text not null default 'requested' check(status in ('requested','in_review','blocked','withdrawn')),
 review_reference text check(length(review_reference)<=200),revision bigint not null default 1,
 created_at timestamptz not null default statement_timestamp(),updated_at timestamptz not null default statement_timestamp(),
 foreign key(client_id,organization_id) references public.clients(id,organization_id)
);
create table app_private.retention_policies (
 organization_id uuid primary key references public.organizations(id),days integer not null check(days between 1 and 36500),
 review_reference text not null check(length(trim(review_reference)) between 5 and 200),updated_by uuid not null,updated_at timestamptz not null default statement_timestamp()
);
alter table app_private.assessment_corrections enable row level security;
alter table app_private.consent_records enable row level security;
alter table app_private.privacy_requests enable row level security;
alter table app_private.retention_policies enable row level security;
revoke all on app_private.assessment_corrections,app_private.consent_records,app_private.privacy_requests,app_private.retention_policies from public,anon,authenticated;

create function app_private.business_today() returns date language sql stable security invoker set search_path='' as $$select (statement_timestamp() at time zone 'Europe/Lisbon')::date$$;
revoke all on function app_private.business_today() from public,anon,authenticated;
grant execute on function app_private.business_today() to authenticated;
create function app_private.assessment_stamp() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if TG_OP='INSERT' then
 if new.assessed_on<date '2000-01-01' or new.assessed_on>app_private.business_today() then raise exception using errcode='22023',message='Invalid assessment date';end if;
 new.created_at:=statement_timestamp();new.revision:=1;
 if auth.uid() is not null then
 if not app_private.can_access_client(new.organization_id,new.client_id,'assessments',true) then raise exception using errcode='42501',message='Access denied';end if;
 new.recorded_by:=auth.uid();
 end if;
 end if;return new;
end;$$;
create trigger a_foundation_assessment_stamp before insert on public.assessments for each row execute function app_private.assessment_stamp();
revoke all on function app_private.assessment_stamp() from public,anon,authenticated;
-- All browser writes use validated commands; publication/correction are server controlled.
revoke insert on public.assessments from authenticated;

create function app_private.assessment_share(p_org uuid,p_assessment uuid,p_visible boolean,p_revision bigint) returns bigint
language plpgsql security definer set search_path='' as $fn$ declare a public.assessments%rowtype;begin
 if auth.uid() is null then raise exception using errcode='42501',message='Access denied';end if;
perform 1 from public.organizations o where o.id=p_org for update; select * into a from public.assessments where id=p_assessment and organization_id=p_org for update;
 if a.id is null or not app_private.can_access_client(p_org,a.client_id,'assessments',true) then raise exception using errcode='42501',message='Access denied';end if;
 if p_visible is null then raise exception using errcode='22023',message='Invalid visibility';end if;
 if p_revision is null or p_revision<>a.revision or a.superseded_at is not null then raise exception using errcode='PT409',message='Revision conflict';end if;
 update public.assessments set student_visible=p_visible,revision=revision+1 where id=a.id;
 insert into app_private.foundation_events(organization_id,client_id,actor_id,subject_id,action) values(p_org,a.client_id,auth.uid(),a.id,case when p_visible then 'assessment_shared' else 'assessment_unshared' end);
 return a.revision+1;end; $fn$;
create function public.aura_assessment_share(p_org uuid,p_assessment uuid,p_visible boolean,p_revision bigint) returns bigint
language sql security invoker set search_path='' as $fn$ select * from app_private.assessment_share(p_org,p_assessment,p_visible,p_revision); $fn$;
revoke all on function app_private.assessment_share(uuid,uuid,boolean,bigint),public.aura_assessment_share(uuid,uuid,boolean,bigint) from public,anon,authenticated;
grant execute on function app_private.assessment_share(uuid,uuid,boolean,bigint),public.aura_assessment_share(uuid,uuid,boolean,bigint) to authenticated;
create function app_private.assessment_correct(p_org uuid,p_assessment uuid,p_revision bigint,p_date date,p_weight numeric,p_height numeric,p_waist numeric,p_reason text) returns uuid
language plpgsql security definer set search_path='' as $fn$ declare a public.assessments%rowtype;new_id uuid;begin
 if auth.uid() is null then raise exception using errcode='42501',message='Access denied';end if;
perform 1 from public.organizations o where o.id=p_org for update; select * into a from public.assessments where id=p_assessment and organization_id=p_org for update;
 if a.id is null or not app_private.can_access_client(p_org,a.client_id,'assessments',true) then raise exception using errcode='42501',message='Access denied';end if;
 if p_reason is null or length(trim(p_reason)) not between 5 and 500 or p_date is null or not app_private.valid_metrics(p_weight,p_height,p_waist) then raise exception using errcode='22023',message='Invalid correction';end if;
 if p_revision is null or p_revision<>a.revision or a.superseded_at is not null then raise exception using errcode='PT409',message='Revision conflict';end if;
 insert into public.assessments(organization_id,client_id,recorded_by,assessed_on,weight_kg,height_cm,waist_cm,note,supersedes_id)
 values(p_org,a.client_id,auth.uid(),p_date,p_weight,p_height,p_waist,a.note,a.id) returning id into new_id;
 update public.assessments set superseded_at=statement_timestamp(),student_visible=false,revision=revision+1 where id=a.id;
 insert into app_private.assessment_corrections(assessment_id,organization_id,actor_id,reason) values(new_id,p_org,auth.uid(),trim(p_reason));
 insert into app_private.foundation_events(organization_id,client_id,actor_id,subject_id,action) values(p_org,a.client_id,auth.uid(),new_id,'assessment_corrected');return new_id;end; $fn$;
create function public.aura_assessment_correct(p_org uuid,p_assessment uuid,p_revision bigint,p_date date,p_weight numeric,p_height numeric,p_waist numeric,p_reason text) returns uuid
language sql security invoker set search_path='' as $fn$ select * from app_private.assessment_correct(p_org,p_assessment,p_revision,p_date,p_weight,p_height,p_waist,p_reason); $fn$;
revoke all on function app_private.assessment_correct(uuid,uuid,bigint,date,numeric,numeric,numeric,text),public.aura_assessment_correct(uuid,uuid,bigint,date,numeric,numeric,numeric,text) from public,anon,authenticated;
grant execute on function app_private.assessment_correct(uuid,uuid,bigint,date,numeric,numeric,numeric,text),public.aura_assessment_correct(uuid,uuid,bigint,date,numeric,numeric,numeric,text) to authenticated;
create function app_private.student_assessments(p_org uuid,p_client uuid,p_offset integer) returns table(id uuid,assessed_on date,weight_kg numeric,height_cm numeric,waist_cm numeric)
language plpgsql security definer set search_path='' as $fn$ begin
 if not app_private.is_student(p_org,p_client) then raise exception using errcode='42501',message='Access denied';end if;
 if p_offset is null or p_offset<0 or p_offset>1000000 then raise exception using errcode='22023',message='Invalid offset';end if;
 return query select a.id,a.assessed_on,a.weight_kg,a.height_cm,a.waist_cm from public.assessments a
 where a.organization_id=p_org and a.client_id=p_client and a.student_visible and a.superseded_at is null and a.assessed_on<=app_private.business_today()
 order by a.assessed_on desc,a.id desc limit 25 offset p_offset;end; $fn$;
create function public.aura_student_assessments(p_org uuid,p_client uuid,p_offset integer) returns table(id uuid,assessed_on date,weight_kg numeric,height_cm numeric,waist_cm numeric)
language sql security invoker set search_path='' as $fn$ select * from app_private.student_assessments(p_org,p_client,p_offset); $fn$;
revoke all on function app_private.student_assessments(uuid,uuid,integer),public.aura_student_assessments(uuid,uuid,integer) from public,anon,authenticated;
grant execute on function app_private.student_assessments(uuid,uuid,integer),public.aura_student_assessments(uuid,uuid,integer) to authenticated;
create function app_private.visible_export(p_org uuid,p_client uuid) returns jsonb
language plpgsql security definer set search_path='' as $fn$ declare student boolean:=app_private.is_student(p_org,p_client);result jsonb;begin
 if not student and not app_private.can_access_client(p_org,p_client,'profile',false) then raise exception using errcode='42501',message='Access denied';end if;
 result:=jsonb_build_object('format_version',1,'scope','visible_records_only','exported_at',statement_timestamp(),
 'client',(select jsonb_build_object('id',id,'organization_id',organization_id,'full_name',full_name,'archived_at',archived_at) from public.clients where id=p_client and organization_id=p_org),
 'assessments',case when student or app_private.can_access_client(p_org,p_client,'assessments',false) then
 coalesce((select jsonb_agg(jsonb_build_object('id',id,'assessed_on',assessed_on,'weight_kg',weight_kg,'height_cm',height_cm,'waist_cm',waist_cm) order by assessed_on,id)
 from public.assessments where organization_id=p_org and client_id=p_client and superseded_at is null and (not student or student_visible) and assessed_on<=app_private.business_today()),'[]'::jsonb) else '[]'::jsonb end,
 'appointments',case when student or app_private.can_access_client(p_org,p_client,'schedule',false) then
 coalesce((select jsonb_agg(jsonb_build_object('id',id,'kind',kind,'status',status,'starts_at',starts_at,'ends_at',ends_at) order by starts_at,id) from public.appointments where organization_id=p_org and client_id=p_client),'[]'::jsonb) else '[]'::jsonb end);
 insert into app_private.foundation_events(organization_id,client_id,actor_id,action) values(p_org,p_client,auth.uid(),'visible_export');return result;end; $fn$;
create function public.aura_visible_export(p_org uuid,p_client uuid) returns jsonb
language sql security invoker set search_path='' as $fn$ select * from app_private.visible_export(p_org,p_client); $fn$;
revoke all on function app_private.visible_export(uuid,uuid),public.aura_visible_export(uuid,uuid) from public,anon,authenticated;
grant execute on function app_private.visible_export(uuid,uuid),public.aura_visible_export(uuid,uuid) to authenticated;
create function app_private.consent_set(p_org uuid,p_client uuid,p_purpose text,p_version text,p_accepted boolean) returns uuid
language plpgsql security definer set search_path='' as $fn$ declare result uuid;begin
 if auth.uid() is null then raise exception using errcode='42501',message='Access denied';end if;
perform 1 from public.organizations o where o.id=p_org for update; if not app_private.is_student(p_org,p_client) then raise exception using errcode='42501',message='Access denied';end if;
 if p_accepted is null or p_purpose is null or p_purpose not in ('progress_photos','optional_notifications') or p_version is null or length(trim(p_version)) not between 1 and 80
 then raise exception using errcode='22023',message='Invalid consent';end if;
 insert into app_private.consent_records(organization_id,client_id,actor_id,purpose,document_version,accepted) values(p_org,p_client,auth.uid(),p_purpose,trim(p_version),p_accepted) returning id into result;
 insert into app_private.foundation_events(organization_id,client_id,actor_id,subject_id,action) values(p_org,p_client,auth.uid(),result,case when p_accepted then 'consent_recorded' else 'consent_revoked' end);return result;end; $fn$;
create function public.aura_consent_set(p_org uuid,p_client uuid,p_purpose text,p_version text,p_accepted boolean) returns uuid
language sql security invoker set search_path='' as $fn$ select * from app_private.consent_set(p_org,p_client,p_purpose,p_version,p_accepted); $fn$;
revoke all on function app_private.consent_set(uuid,uuid,text,text,boolean),public.aura_consent_set(uuid,uuid,text,text,boolean) from public,anon,authenticated;
grant execute on function app_private.consent_set(uuid,uuid,text,text,boolean),public.aura_consent_set(uuid,uuid,text,text,boolean) to authenticated;
create function app_private.privacy_request_create(p_org uuid,p_client uuid,p_kind text) returns uuid
language plpgsql security definer set search_path='' as $fn$ declare result uuid;begin
 if auth.uid() is null then raise exception using errcode='42501',message='Access denied';end if;
perform 1 from public.organizations o where o.id=p_org for update; if not app_private.is_student(p_org,p_client) and not app_private.can_access_client(p_org,p_client,'profile',false) then raise exception using errcode='42501',message='Access denied';end if;
 if p_kind is null or p_kind not in ('export','erasure') then raise exception using errcode='22023',message='Invalid request';end if;
 if exists(select 1 from app_private.privacy_requests where organization_id=p_org and client_id=p_client and requested_by=auth.uid() and kind=p_kind and status in ('requested','in_review','blocked')) then raise exception using errcode='PT409',message='Open request exists';end if;
 insert into app_private.privacy_requests(organization_id,client_id,requested_by,kind) values(p_org,p_client,auth.uid(),p_kind) returning id into result;
 insert into app_private.foundation_events(organization_id,client_id,actor_id,subject_id,action) values(p_org,p_client,auth.uid(),result,'privacy_requested:'||p_kind);return result;end; $fn$;
create function public.aura_privacy_request_create(p_org uuid,p_client uuid,p_kind text) returns uuid
language sql security invoker set search_path='' as $fn$ select * from app_private.privacy_request_create(p_org,p_client,p_kind); $fn$;
revoke all on function app_private.privacy_request_create(uuid,uuid,text),public.aura_privacy_request_create(uuid,uuid,text) from public,anon,authenticated;
grant execute on function app_private.privacy_request_create(uuid,uuid,text),public.aura_privacy_request_create(uuid,uuid,text) to authenticated;
create function app_private.privacy_review(p_org uuid,p_request uuid,p_status text,p_reference text,p_revision bigint) returns bigint
language plpgsql security definer set search_path='' as $fn$ declare r app_private.privacy_requests%rowtype;begin
 if auth.uid() is null then raise exception using errcode='42501',message='Access denied';end if;
perform 1 from public.organizations o where o.id=p_org for update; if not app_private.can_manage_access(p_org) then raise exception using errcode='42501',message='Access denied';end if; select * into r from app_private.privacy_requests where id=p_request and organization_id=p_org for update;
 if r.id is null then raise exception using errcode='42501',message='Access denied';end if;
 if p_revision is null or r.revision<>p_revision or r.status='withdrawn' then raise exception using errcode='PT409',message='Revision conflict';end if;
 if p_status is null or p_status not in ('in_review','blocked') or p_reference is null or length(trim(p_reference)) not between 5 and 200 then raise exception using errcode='22023',message='Invalid review';end if;
 update app_private.privacy_requests set status=p_status,review_reference=trim(p_reference),revision=revision+1,updated_at=statement_timestamp() where id=r.id;
 insert into app_private.foundation_events(organization_id,client_id,actor_id,subject_id,action) values(p_org,r.client_id,auth.uid(),r.id,'privacy_reviewed:'||p_status);return r.revision+1;end; $fn$;
create function public.aura_privacy_review(p_org uuid,p_request uuid,p_status text,p_reference text,p_revision bigint) returns bigint
language sql security invoker set search_path='' as $fn$ select * from app_private.privacy_review(p_org,p_request,p_status,p_reference,p_revision); $fn$;
revoke all on function app_private.privacy_review(uuid,uuid,text,text,bigint),public.aura_privacy_review(uuid,uuid,text,text,bigint) from public,anon,authenticated;
grant execute on function app_private.privacy_review(uuid,uuid,text,text,bigint),public.aura_privacy_review(uuid,uuid,text,text,bigint) to authenticated;
create function app_private.privacy_context(p_org uuid,p_client uuid) returns jsonb
language plpgsql security definer set search_path='' as $fn$ begin
 if not app_private.is_student(p_org,p_client) and not app_private.can_manage_access(p_org) then raise exception using errcode='42501',message='Access denied';end if;
 if not exists(select 1 from public.clients where id=p_client and organization_id=p_org) then raise exception using errcode='42501',message='Access denied';end if;
 return jsonb_build_object('consents',coalesce((select jsonb_agg(to_jsonb(c)) from (select distinct on(purpose) purpose,document_version,accepted,created_at from app_private.consent_records where organization_id=p_org and client_id=p_client order by purpose,created_at desc,id desc)c),'[]'::jsonb),
 'requests',coalesce((select jsonb_agg(to_jsonb(r)) from (select id,kind,status,revision,created_at from app_private.privacy_requests where organization_id=p_org and client_id=p_client order by created_at desc,id limit 50)r),'[]'::jsonb));end; $fn$;
create function public.aura_privacy_context(p_org uuid,p_client uuid) returns jsonb
language sql security invoker set search_path='' as $fn$ select * from app_private.privacy_context(p_org,p_client); $fn$;
revoke all on function app_private.privacy_context(uuid,uuid),public.aura_privacy_context(uuid,uuid) from public,anon,authenticated;
grant execute on function app_private.privacy_context(uuid,uuid),public.aura_privacy_context(uuid,uuid) to authenticated;
create function app_private.retention_save(p_org uuid,p_days integer,p_reference text) returns void
language plpgsql security definer set search_path='' as $fn$ begin
 if auth.uid() is null then raise exception using errcode='42501',message='Access denied';end if;
perform 1 from public.organizations o where o.id=p_org for update; if not app_private.can_manage_access(p_org) then raise exception using errcode='42501',message='Access denied';end if; if not exists(select 1 from public.organization_members where organization_id=p_org and user_id=auth.uid() and role='owner') then raise exception using errcode='42501',message='Access denied';end if;
 if p_days is null or p_days not between 1 and 36500 or p_reference is null or length(trim(p_reference)) not between 5 and 200 then raise exception using errcode='22023',message='Invalid policy';end if;
 insert into app_private.retention_policies values(p_org,p_days,trim(p_reference),auth.uid(),statement_timestamp()) on conflict(organization_id) do update set days=excluded.days,review_reference=excluded.review_reference,updated_by=excluded.updated_by,updated_at=excluded.updated_at;
 insert into app_private.foundation_events(organization_id,actor_id,action) values(p_org,auth.uid(),'retention_configured');end; $fn$;
create function public.aura_retention_save(p_org uuid,p_days integer,p_reference text) returns void
language sql security invoker set search_path='' as $fn$ select * from app_private.retention_save(p_org,p_days,p_reference); $fn$;
revoke all on function app_private.retention_save(uuid,integer,text),public.aura_retention_save(uuid,integer,text) from public,anon,authenticated;
grant execute on function app_private.retention_save(uuid,integer,text),public.aura_retention_save(uuid,integer,text) to authenticated;
create function app_private.retention_preview(p_org uuid) returns jsonb
language plpgsql security definer set search_path='' as $fn$ declare days integer;begin
 if auth.uid() is null then raise exception using errcode='42501',message='Access denied';end if;
perform 1 from public.organizations o where o.id=p_org for update; if not app_private.can_manage_access(p_org) then raise exception using errcode='42501',message='Access denied';end if; select p.days into days from app_private.retention_policies p where p.organization_id=p_org;
 return jsonb_build_object('configured',days is not null,'days',days,'automatic_deletion',false,'candidate_count',case when days is null then 0 else (select count(*) from public.clients where organization_id=p_org and archived_at<statement_timestamp()-make_interval(days=>days)) end);end; $fn$;
create function public.aura_retention_preview(p_org uuid) returns jsonb
language sql security invoker set search_path='' as $fn$ select * from app_private.retention_preview(p_org); $fn$;
revoke all on function app_private.retention_preview(uuid),public.aura_retention_preview(uuid) from public,anon,authenticated;
grant execute on function app_private.retention_preview(uuid),public.aura_retention_preview(uuid) to authenticated;
create or replace function public.aura_dashboard(p_org uuid)
returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare result jsonb;
begin
 if auth.uid() is null or not app_private.is_member(p_org) then
  raise exception using errcode='42501',message='Organization access denied';
 end if;
 with active as (
  select c.id,c.full_name,last_assessment.assessed_on
  from public.clients c
  left join lateral (
   select a.assessed_on from public.assessments a
   where a.organization_id=p_org and a.client_id=c.id and a.superseded_at is null and a.assessed_on<=app_private.business_today()
   order by a.assessed_on desc,a.id desc limit 1
  ) last_assessment on true
  where c.organization_id=p_org and c.archived_at is null
 ), pending as (
  select * from active where app_private.can_access_client(p_org,id,'assessments',false) and (assessed_on is null or assessed_on<app_private.business_today()-30)
 ), recent as (
  select a.id,a.client_id,c.full_name,a.assessed_on,c.archived_at
  from public.assessments a join public.clients c
   on c.id=a.client_id and c.organization_id=a.organization_id
  where a.organization_id=p_org and a.superseded_at is null and a.assessed_on between app_private.business_today()-29 and app_private.business_today()
  order by a.assessed_on desc,a.id desc limit 10
 )
 select jsonb_build_object(
  'as_of',app_private.business_today(),
  'active_clients',(select count(*) from active),
  'archived_clients',(select count(*) from public.clients where organization_id=p_org and archived_at is not null),
  'assessments_30_days',(select count(*) from public.assessments where organization_id=p_org and superseded_at is null and assessed_on between app_private.business_today()-29 and app_private.business_today()),
  'pending_clients',(select count(*) from pending),
  'recent',coalesce((select jsonb_agg(to_jsonb(r) order by r.assessed_on desc,r.id desc) from recent r),'[]'::jsonb),
  'pending',coalesce((select jsonb_agg(to_jsonb(p) order by p.assessed_on asc nulls first,p.id) from
   (select * from pending order by assessed_on asc nulls first,id limit 10) p),'[]'::jsonb)
 ) into result;
 return result;
end;
$$;
revoke all on function public.aura_dashboard(uuid) from public,anon;
grant execute on function public.aura_dashboard(uuid) to authenticated;


create or replace function public.aura_care_dashboard(p_org uuid)
returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare result jsonb;today date:=app_private.business_today();day_start timestamptz;day_end timestamptz;
begin
 result:=public.aura_dashboard(p_org); -- Existing membership gate and RLS apply.
 day_start:=today::timestamp at time zone 'Europe/Lisbon';day_end:=(today+1)::timestamp at time zone 'Europe/Lisbon';
 return result||jsonb_build_object(
 'care_date',today,'time_zone','Europe/Lisbon',
 'reviews_due',(select count(*) from public.client_followups f join public.clients c on c.id=f.client_id and c.organization_id=f.organization_id where f.organization_id=p_org and c.archived_at is null and f.status='active' and f.next_review<=today),
 'appointments_today',(select count(*) from public.appointments where organization_id=p_org and status='scheduled' and starts_at>=day_start and starts_at<day_end),
 'due_reviews',coalesce((select jsonb_agg(to_jsonb(r) order by r.next_review,r.id) from (select c.id,c.full_name,f.next_review from public.client_followups f join public.clients c on c.id=f.client_id and c.organization_id=f.organization_id where f.organization_id=p_org and c.archived_at is null and f.status='active' and f.next_review<=today order by f.next_review,c.id limit 10) r),'[]'::jsonb),
 'today_appointments',coalesce((select jsonb_agg(to_jsonb(a) order by a.starts_at,a.id) from (select a.id,a.client_id,c.full_name,a.kind,a.starts_at,a.ends_at,a.professional_id from public.appointments a join public.clients c on c.id=a.client_id and c.organization_id=a.organization_id where a.organization_id=p_org and a.status='scheduled' and a.starts_at>=day_start and a.starts_at<day_end order by a.starts_at,a.id limit 10) a),'[]'::jsonb)
 );
end $$;
revoke all on function public.aura_care_dashboard(uuid) from public,anon;
grant execute on function public.aura_care_dashboard(uuid) to authenticated;

revoke insert on public.assessments from authenticated;
revoke insert(id,organization_id,client_id,recorded_by,assessed_on,weight_kg,height_cm,waist_cm,note) on public.assessments from authenticated;
create function app_private.valid_metrics(w numeric,h numeric,wa numeric) returns boolean language sql immutable security invoker set search_path='' as $$
 select (w is not null or h is not null or wa is not null)
 and (w is null or (w>0 and w<=500 and w=round(w,2)))
 and (h is null or (h>0 and h<=300 and h=round(h,1)))
 and (wa is null or (wa>0 and wa<=300 and wa=round(wa,1)));
$$;
revoke all on function app_private.valid_metrics(numeric,numeric,numeric) from public,anon,authenticated;
create function app_private.assessment_create(p_org uuid,p_client uuid,p_date date,p_weight numeric,p_height numeric,p_waist numeric) returns uuid
language plpgsql security definer set search_path='' as $fn$ declare result uuid;begin
 if auth.uid() is null then raise exception using errcode='42501',message='Access denied';end if;
perform 1 from public.organizations o where o.id=p_org for update; if not app_private.can_access_client(p_org,p_client,'assessments',true) then raise exception using errcode='42501',message='Access denied';end if;
 if p_date is null or not app_private.valid_metrics(p_weight,p_height,p_waist) then raise exception using errcode='22023',message='Invalid metrics';end if;
 insert into public.assessments(organization_id,client_id,recorded_by,assessed_on,weight_kg,height_cm,waist_cm)
 values(p_org,p_client,auth.uid(),p_date,p_weight,p_height,p_waist) returning id into result;return result;end; $fn$;
create function public.aura_assessment_create(p_org uuid,p_client uuid,p_date date,p_weight numeric,p_height numeric,p_waist numeric) returns uuid
language sql security invoker set search_path='' as $fn$ select * from app_private.assessment_create(p_org,p_client,p_date,p_weight,p_height,p_waist); $fn$;
revoke all on function app_private.assessment_create(uuid,uuid,date,numeric,numeric,numeric),public.aura_assessment_create(uuid,uuid,date,numeric,numeric,numeric) from public,anon,authenticated;
grant execute on function app_private.assessment_create(uuid,uuid,date,numeric,numeric,numeric),public.aura_assessment_create(uuid,uuid,date,numeric,numeric,numeric) to authenticated;
create or replace function app_private.care_history(p_org uuid,p_client uuid,p_offset integer)
returns table(id uuid,appointment_id uuid,actor_id uuid,action text,revision bigint,from_status text,to_status text,created_at timestamptz)
language plpgsql security definer set search_path='' as $$
begin if auth.uid() is null then raise exception using errcode='42501',message='Access denied';end if;
perform 1 from public.organizations o where o.id=p_org for update;
 if not app_private.can_access_client(p_org,p_client,'followup',false) and not app_private.can_access_client(p_org,p_client,'schedule',false) then raise exception using errcode='42501',message='Access denied';end if;
 if p_offset is null or p_offset<0 or p_offset>1000000 then raise exception using errcode='22023',message='Invalid offset';end if;
 return query select e.id,e.appointment_id,e.actor_id,e.action,e.revision,e.from_status,e.to_status,e.created_at from app_private.care_events e
 where e.organization_id=p_org and e.client_id=p_client and (
 (e.action like 'followup_%' and app_private.can_access_client(p_org,p_client,'followup',false)) or
 (e.action like 'appointment_%' and app_private.can_access_client(p_org,p_client,'schedule',false)))
 order by e.created_at desc,e.id desc limit 25 offset p_offset;end;$$;
