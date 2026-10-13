-- AURA: minimal follow-up data and organization-scoped scheduling. No clinical notes.
create table public.client_followups (
 organization_id uuid not null references public.organizations(id) on delete cascade,
 client_id uuid primary key,
 goal text not null default '' check(length(goal)<=1000),
 status text not null default 'active' check(status in ('active','paused','completed')),
 responsible_id uuid,
 next_review date check(next_review between date '2000-01-01' and date '2100-12-31'),
 revision bigint not null default 1 check(revision>0),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 updated_by uuid references auth.users(id) on delete set null,
 foreign key(client_id,organization_id) references public.clients(id,organization_id) on delete cascade,
 foreign key(organization_id,responsible_id) references public.organization_members(organization_id,user_id) on delete set null (responsible_id)
);
create index followups_org_review_idx on public.client_followups(organization_id,next_review) where status='active';
alter table public.client_followups enable row level security;
revoke all on public.client_followups from public,anon,authenticated;
grant select on public.client_followups to authenticated;
create policy followups_read on public.client_followups for select to authenticated using(app_private.is_member(organization_id));

create table public.appointments (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.organizations(id) on delete cascade,
 client_id uuid not null,professional_id uuid,
 kind text not null check(kind in ('session','assessment','review')),
 status text not null default 'scheduled' check(status in ('scheduled','completed','cancelled','no_show')),
 starts_at timestamptz not null,ends_at timestamptz not null,
 revision bigint not null default 1 check(revision>0),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 updated_by uuid references auth.users(id) on delete set null,
 constraint appointments_duration check(ends_at>=starts_at+interval '5 minutes' and ends_at<=starts_at+interval '8 hours'),
 constraint appointments_dates check(starts_at>=timestamptz '2000-01-01 00:00:00+00' and ends_at<timestamptz '2101-01-01 00:00:00+00'),
 constraint appointments_client_tenant_fk foreign key(client_id,organization_id) references public.clients(id,organization_id) on delete cascade,
 foreign key(organization_id,professional_id) references public.organization_members(organization_id,user_id) on delete set null (professional_id),
 unique(id,organization_id)
);
create index appointments_org_date_idx on public.appointments(organization_id,starts_at,id);
create index appointments_client_date_idx on public.appointments(organization_id,client_id,starts_at);
create index appointments_professional_idx on public.appointments(organization_id,professional_id,starts_at) where status='scheduled';
alter table public.appointments enable row level security;
revoke all on public.appointments from public,anon,authenticated;
grant select on public.appointments to authenticated;
create policy appointments_read on public.appointments for select to authenticated using(app_private.is_member(organization_id));

create table app_private.care_events (
 id uuid primary key default gen_random_uuid(),organization_id uuid not null,client_id uuid not null,
 appointment_id uuid,actor_id uuid,action text not null,revision bigint not null,
 from_status text,to_status text,created_at timestamptz not null default now(),
 foreign key(client_id,organization_id) references public.clients(id,organization_id) on delete cascade,
 foreign key(appointment_id,organization_id) references public.appointments(id,organization_id) on delete cascade
);
create index care_events_client_idx on app_private.care_events(organization_id,client_id,created_at desc,id);
alter table app_private.care_events enable row level security;
revoke all on app_private.care_events from public,anon,authenticated;

create function app_private.care_stamp() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if TG_OP='INSERT' then new.revision:=1;new.created_at:=statement_timestamp();
 else
  if new.organization_id<>old.organization_id or new.client_id<>old.client_id or new.created_at<>old.created_at then raise exception using errcode='42501',message='Immutable identity';end if;
  if TG_TABLE_NAME='appointments' then
   if new.id<>old.id then raise exception using errcode='42501',message='Immutable identity';end if;
  end if;
  new.revision:=old.revision+1;
 end if;
 new.updated_at:=statement_timestamp();new.updated_by:=auth.uid();return new;
end $$;
create trigger followup_stamp before insert or update on public.client_followups for each row execute function app_private.care_stamp();
create trigger appointment_stamp before insert or update on public.appointments for each row execute function app_private.care_stamp();
create function app_private.care_audit() returns trigger language plpgsql security definer set search_path='' as $$
declare a text;appointment uuid;previous text;
begin
 if TG_TABLE_NAME='client_followups' then
  a:=case when TG_OP='INSERT' then 'followup_created' else 'followup_updated' end;appointment:=null;
 else
  appointment:=new.id;
  a:=case when TG_OP='INSERT' then 'appointment_created' when new.status is distinct from old.status then 'appointment_status' else 'appointment_updated' end;
 end if;
 if TG_OP='UPDATE' then previous:=old.status;end if;
 insert into app_private.care_events(organization_id,client_id,appointment_id,actor_id,action,revision,from_status,to_status)
 values(new.organization_id,new.client_id,appointment,auth.uid(),a,new.revision,previous,new.status);return new;
end $$;
create trigger followup_audit after insert or update on public.client_followups for each row execute function app_private.care_audit();
create trigger appointment_audit after insert or update on public.appointments for each row execute function app_private.care_audit();
revoke all on function app_private.care_stamp(),app_private.care_audit() from public,anon,authenticated;

-- Minimal staff labels; no email or authorization from user-editable metadata.
create function app_private.professional_choices(p_org uuid)
returns table(user_id uuid,display_name text,role text) language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null or not app_private.is_member(p_org) then raise exception using errcode='42501',message='Access denied';end if;
 return query select m.user_id,left(coalesce(nullif(btrim(to_jsonb(u)->'raw_user_meta_data'->>'display_name'),''),'Profissional '||left(m.user_id::text,8)),80),m.role
 from public.organization_members m join auth.users u on u.id=m.user_id where m.organization_id=p_org order by m.role,m.user_id;
end $$;
create function public.aura_professional_choices(p_org uuid)
returns table(user_id uuid,display_name text,role text) language sql security invoker set search_path='' as $$select * from app_private.professional_choices(p_org);$$;
revoke all on function app_private.professional_choices(uuid),public.aura_professional_choices(uuid) from public,anon,authenticated;
grant execute on function app_private.professional_choices(uuid),public.aura_professional_choices(uuid) to authenticated;

create function app_private.followup_save(p_org uuid,p_client uuid,p_goal text,p_status text,p_responsible uuid,p_review date,p_revision bigint)
returns bigint language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid();member_role text;existing public.client_followups%rowtype;v_revision bigint;archived timestamptz;
begin
 if actor is null then raise exception using errcode='42501',message='Access denied';end if;
 perform 1 from public.organizations where id=p_org for update;
 select role into member_role from public.organization_members where organization_id=p_org and user_id=actor;
 if member_role is null then raise exception using errcode='42501',message='Access denied';end if;
 select archived_at into archived from public.clients where id=p_client and organization_id=p_org for update;
 if not found then raise exception using errcode='42501',message='Access denied';end if;
 if archived is not null then raise exception using errcode='23514',message='Archived client';end if;
 if p_goal is null or length(btrim(p_goal))>1000 or p_status is null or p_status not in ('active','paused','completed') or p_revision is null or p_revision<0
 or (p_review is not null and (p_review<date '2000-01-01' or p_review>date '2100-12-31')) then raise exception using errcode='22023',message='Invalid follow-up';end if;
 select * into existing from public.client_followups where client_id=p_client and organization_id=p_org for update;
 if coalesce(existing.revision,0)<>p_revision then raise exception using errcode='PT409',message='Revision conflict';end if;
 if p_responsible is distinct from existing.responsible_id and member_role not in ('owner','admin') then raise exception using errcode='42501',message='Assignment reserved for managers';end if;
 if p_responsible is not null and not exists(select 1 from public.organization_members where organization_id=p_org and user_id=p_responsible) then raise exception using errcode='22023',message='Invalid professional';end if;
 if existing.client_id is null then
 insert into public.client_followups(organization_id,client_id,goal,status,responsible_id,next_review) values(p_org,p_client,btrim(p_goal),p_status,p_responsible,p_review) returning revision into v_revision;
 else
 update public.client_followups set goal=btrim(p_goal),status=p_status,responsible_id=p_responsible,next_review=p_review where client_id=p_client and organization_id=p_org returning revision into v_revision;
 end if;return v_revision;
end $$;
create function public.aura_followup_save(p_org uuid,p_client uuid,p_goal text,p_status text,p_responsible uuid,p_review date,p_revision bigint)
returns bigint language sql security invoker set search_path='' as $$select app_private.followup_save(p_org,p_client,p_goal,p_status,p_responsible,p_review,p_revision);$$;
revoke all on function app_private.followup_save(uuid,uuid,text,text,uuid,date,bigint),public.aura_followup_save(uuid,uuid,text,text,uuid,date,bigint) from public,anon,authenticated;
grant execute on function app_private.followup_save(uuid,uuid,text,text,uuid,date,bigint),public.aura_followup_save(uuid,uuid,text,text,uuid,date,bigint) to authenticated;

create function app_private.appointment_save(p_org uuid,p_id uuid,p_client uuid,p_professional uuid,p_kind text,p_status text,p_start timestamptz,p_end timestamptz,p_revision bigint)
returns uuid language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid();member_role text;existing public.appointments%rowtype;archived timestamptz;result uuid;
begin
 if actor is null then raise exception using errcode='42501',message='Access denied';end if;
 -- Same organization lock as team/client mutations serializes slot checks and membership changes.
 perform 1 from public.organizations where id=p_org for update;
 select role into member_role from public.organization_members where organization_id=p_org and user_id=actor;
 if member_role is null then raise exception using errcode='42501',message='Access denied';end if;
 if p_id is not null then
 select * into existing from public.appointments where id=p_id and organization_id=p_org for update;
 if not found or existing.client_id<>p_client then raise exception using errcode='42501',message='Access denied';end if;
 if member_role='coach' and existing.professional_id is distinct from actor then raise exception using errcode='42501',message='Access denied';end if;
 end if;
 select archived_at into archived from public.clients where id=p_client and organization_id=p_org for update;
 if not found then raise exception using errcode='42501',message='Access denied';end if;
 if p_revision is null or p_revision<>coalesce(existing.revision,0) then raise exception using errcode='PT409',message='Revision conflict';end if;
 if (p_professional is null and (p_id is null or p_status='scheduled')) or (p_professional is not null and not exists(select 1 from public.organization_members where organization_id=p_org and user_id=p_professional)) then raise exception using errcode='22023',message='Invalid professional';end if;
 if member_role='coach' and p_professional<>actor then raise exception using errcode='42501',message='Access denied';end if;
 if p_kind is null or p_kind not in ('session','assessment','review') or p_status is null or p_status not in ('scheduled','completed','cancelled','no_show')
 or p_start is null or p_end is null or p_start<timestamptz '2000-01-01 00:00:00+00' or p_end>=timestamptz '2101-01-01 00:00:00+00'
 or p_end<p_start+interval '5 minutes' or p_end>p_start+interval '8 hours' then raise exception using errcode='22023',message='Invalid appointment';end if;
 if p_id is null and p_status<>'scheduled' then raise exception using errcode='22023',message='New appointment must be scheduled';end if;
 if p_id is not null and (existing.status in ('completed','no_show') or (existing.status='cancelled' and p_status not in ('scheduled','cancelled'))) then raise exception using errcode='PT409',message='Final appointment';end if;
 if archived is not null and (p_id is null or p_status='scheduled') then raise exception using errcode='23514',message='Archived client';end if;
 if p_status='scheduled' and exists(select 1 from public.appointments where organization_id=p_org and (professional_id=p_professional or client_id=p_client) and status='scheduled'
 and (p_id is null or id<>p_id) and starts_at<p_end and ends_at>p_start) then raise exception using errcode='PT409',message='Slot unavailable';end if;
 if p_id is null then
 insert into public.appointments(organization_id,client_id,professional_id,kind,status,starts_at,ends_at) values(p_org,p_client,p_professional,p_kind,p_status,p_start,p_end) returning id into result;
 else
 update public.appointments set professional_id=p_professional,kind=p_kind,status=p_status,starts_at=p_start,ends_at=p_end where id=p_id and organization_id=p_org returning id into result;
 end if;return result;
end $$;
create function public.aura_appointment_save(p_org uuid,p_id uuid,p_client uuid,p_professional uuid,p_kind text,p_status text,p_start timestamptz,p_end timestamptz,p_revision bigint)
returns uuid language sql security invoker set search_path='' as $$select app_private.appointment_save(p_org,p_id,p_client,p_professional,p_kind,p_status,p_start,p_end,p_revision);$$;
revoke all on function app_private.appointment_save(uuid,uuid,uuid,uuid,text,text,timestamptz,timestamptz,bigint),public.aura_appointment_save(uuid,uuid,uuid,uuid,text,text,timestamptz,timestamptz,bigint) from public,anon,authenticated;
grant execute on function app_private.appointment_save(uuid,uuid,uuid,uuid,text,text,timestamptz,timestamptz,bigint),public.aura_appointment_save(uuid,uuid,uuid,uuid,text,text,timestamptz,timestamptz,bigint) to authenticated;

create function app_private.care_history(p_org uuid,p_client uuid,p_offset integer)
returns table(id uuid,appointment_id uuid,actor_id uuid,action text,revision bigint,from_status text,to_status text,created_at timestamptz)
language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null or not app_private.is_member(p_org) or not exists(select 1 from public.clients c where c.id=p_client and c.organization_id=p_org) then raise exception using errcode='42501',message='Access denied';end if;
 if p_offset is null or p_offset<0 or p_offset>1000000 then raise exception using errcode='22023',message='Invalid offset';end if;
 return query select e.id,e.appointment_id,e.actor_id,e.action,e.revision,e.from_status,e.to_status,e.created_at from app_private.care_events e where e.organization_id=p_org and e.client_id=p_client order by e.created_at desc,e.id desc limit 25 offset p_offset;
end $$;
create function public.aura_care_history(p_org uuid,p_client uuid,p_offset integer default 0)
returns table(id uuid,appointment_id uuid,actor_id uuid,action text,revision bigint,from_status text,to_status text,created_at timestamptz)
language sql security invoker set search_path='' as $$select * from app_private.care_history(p_org,p_client,p_offset);$$;
revoke all on function app_private.care_history(uuid,uuid,integer),public.aura_care_history(uuid,uuid,integer) from public,anon,authenticated;
grant execute on function app_private.care_history(uuid,uuid,integer),public.aura_care_history(uuid,uuid,integer) to authenticated;

create function public.aura_care_dashboard(p_org uuid)
returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare result jsonb;today date:=(now() at time zone 'Europe/Lisbon')::date;day_start timestamptz;day_end timestamptz;
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
