-- Incremental repair. Historical requests and reviews are not rewritten.
create table app_private.privacy_reviews(
 id uuid primary key default gen_random_uuid(),organization_id uuid not null,
 request_id uuid not null references app_private.privacy_requests(id),actor_id uuid not null,
 status text not null check(status in ('in_review','blocked')),reference text not null check(length(btrim(reference)) between 5 and 200),
 revision bigint not null,created_at timestamptz not null default statement_timestamp(),unique(request_id,revision)
);
alter table app_private.privacy_reviews enable row level security;
revoke all on app_private.privacy_reviews from public,anon,authenticated;
create index privacy_requests_client_actor_idx on app_private.privacy_requests(organization_id,client_id,requested_by,created_at desc);

create or replace function app_private.privacy_context(p_org uuid,p_client uuid) returns jsonb
language plpgsql security definer set search_path='' as $fn$
declare manager boolean:=app_private.can_manage_access(p_org);begin
 if auth.uid() is null or (not app_private.is_student(p_org,p_client) and not manager)
 or not exists(select 1 from public.clients where id=p_client and organization_id=p_org)
 then raise exception using errcode='42501',message='Access denied';end if;
 -- A linked pupil sees their own requests and preferences, including after a
 -- different person previously had access to the same client. Management sees
 -- the minimal queue, never author IDs or internal review references here.
 return jsonb_build_object('can_review',manager,'consents',coalesce((select jsonb_agg(to_jsonb(c)) from (
 select distinct on(purpose) purpose,document_version,accepted,created_at from app_private.consent_records
 where organization_id=p_org and client_id=p_client and (manager or actor_id=auth.uid())
 order by purpose,created_at desc,id desc)c),'[]'::jsonb),
 'requests',coalesce((select jsonb_agg(to_jsonb(r)) from (
 select id,kind,status,revision,created_at from app_private.privacy_requests
 where organization_id=p_org and client_id=p_client and (manager or requested_by=auth.uid())
 order by created_at desc,id limit 50)r),'[]'::jsonb));end;$fn$;

create or replace function app_private.privacy_review(p_org uuid,p_request uuid,p_status text,p_reference text,p_revision bigint) returns bigint
language plpgsql security definer set search_path='' as $fn$
declare r app_private.privacy_requests%rowtype;begin
 if auth.uid() is null then raise exception using errcode='42501',message='Access denied';end if;
 perform 1 from public.organizations where id=p_org for update;
 if not app_private.can_manage_access(p_org) then raise exception using errcode='42501',message='Access denied';end if;
 select * into r from app_private.privacy_requests where id=p_request and organization_id=p_org for update;
 if r.id is null then raise exception using errcode='42501',message='Access denied';end if;
 if p_revision is null or r.revision<>p_revision or r.status='withdrawn' then raise exception using errcode='PT409',message='Revision conflict';end if;
 if p_status is null or p_status not in ('in_review','blocked') or p_reference is null or length(btrim(p_reference)) not between 5 and 200
 then raise exception using errcode='22023',message='Invalid review';end if;
 update app_private.privacy_requests set status=p_status,review_reference=btrim(p_reference),revision=revision+1,updated_at=statement_timestamp() where id=r.id;
 insert into app_private.privacy_reviews(organization_id,request_id,actor_id,status,reference,revision) values(p_org,r.id,auth.uid(),p_status,btrim(p_reference),r.revision+1);
 insert into app_private.foundation_events(organization_id,client_id,actor_id,subject_id,action) values(p_org,r.client_id,auth.uid(),r.id,'privacy_reviewed:'||p_status);
 return r.revision+1;end;$fn$;

create function app_private.privacy_review_history(p_org uuid,p_client uuid,p_request uuid) returns jsonb
language plpgsql security definer set search_path='' as $fn$begin
 if not app_private.can_manage_access(p_org) or not exists(select 1 from app_private.privacy_requests where id=p_request and organization_id=p_org and client_id=p_client)
 then raise exception using errcode='42501',message='Access denied';end if;
 return coalesce((select jsonb_agg(to_jsonb(r)) from (select status,reference,revision,created_at from app_private.privacy_reviews
 where request_id=p_request and organization_id=p_org order by revision desc limit 50)r),'[]'::jsonb);end;$fn$;
create function public.aura_privacy_review_history(p_org uuid,p_client uuid,p_request uuid) returns jsonb language sql security invoker set search_path='' as $fn$select app_private.privacy_review_history(p_org,p_client,p_request);$fn$;
revoke all on function app_private.privacy_review_history(uuid,uuid,uuid),public.aura_privacy_review_history(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function app_private.privacy_review_history(uuid,uuid,uuid),public.aura_privacy_review_history(uuid,uuid,uuid) to authenticated;
