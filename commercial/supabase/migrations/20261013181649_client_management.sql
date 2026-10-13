alter table public.clients
 add column archived_at timestamptz,
 add column updated_at timestamptz not null default now(),
 add column revision bigint not null default 1 check(revision>0);
create index clients_org_name_id_idx on public.clients(organization_id,full_name,id);
create index clients_org_active_idx on public.clients(organization_id,archived_at);
create table app_private.client_events (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null,
 client_id uuid not null,
 actor_id uuid,
 action text not null check(action in ('created','name_changed','archived','reactivated')),
 revision bigint not null,
 created_at timestamptz not null default now(),
 foreign key(client_id,organization_id) references public.clients(id,organization_id) on delete cascade
);
create index client_events_history_idx on app_private.client_events(organization_id,client_id,created_at desc,id);
alter table app_private.client_events enable row level security;
revoke all on app_private.client_events from public,anon,authenticated;

create function app_private.client_stamp() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
 new.full_name:=trim(new.full_name);
 if tg_op='INSERT' then
 new.archived_at:=null;new.updated_at:=now();new.created_at:=now();new.revision:=1;
 else
 if new.id<>old.id or new.organization_id<>old.organization_id or new.created_at<>old.created_at then
 raise exception 'Immutable client identity' using errcode='42501'; end if;
 new.updated_at:=now();new.revision:=old.revision+1;
 end if;
 return new;
end $$;
create trigger client_stamp before insert or update on public.clients for each row execute function app_private.client_stamp();

create function app_private.client_audit() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if tg_op='INSERT' then
 insert into app_private.client_events(organization_id,client_id,actor_id,action,revision)
 values(new.organization_id,new.id,auth.uid(),'created',new.revision);
 else
 if new.full_name is distinct from old.full_name then
 insert into app_private.client_events(organization_id,client_id,actor_id,action,revision)
 values(new.organization_id,new.id,auth.uid(),'name_changed',new.revision);end if;
 if new.archived_at is distinct from old.archived_at then
 insert into app_private.client_events(organization_id,client_id,actor_id,action,revision)
 values(new.organization_id,new.id,auth.uid(),case when new.archived_at is null then 'reactivated' else 'archived' end,new.revision);end if;
 end if;return new;
end $$;
create trigger client_audit after insert or update on public.clients for each row execute function app_private.client_audit();
revoke all on function app_private.client_stamp(),app_private.client_audit() from public,anon,authenticated;

create function app_private.client_change(p_org uuid,p_client uuid,p_name text,p_archived boolean,p_revision bigint)
returns bigint language plpgsql security definer set search_path='' as $$
declare v_client public.clients%rowtype;v_role text;v_archived timestamptz;v_revision bigint;
begin
 if auth.uid() is null then raise exception 'Access denied' using errcode='42501';end if;
 perform 1 from public.organizations where id=p_org for update;
 select role into v_role from public.organization_members where organization_id=p_org and user_id=auth.uid();
 if v_role is null then raise exception 'Access denied' using errcode='42501';end if;
 select * into v_client from public.clients where id=p_client and organization_id=p_org for update;
 if v_client.id is null then raise exception 'Access denied' using errcode='42501';end if;
 if p_name is null or length(trim(p_name)) not between 2 and 160 or p_archived is null or p_revision is null then
 raise exception 'Invalid client data' using errcode='22023';end if;
 if p_revision<>v_client.revision then raise exception 'Client changed; reload before saving' using errcode='40001';end if;
 if p_archived<>(v_client.archived_at is not null) and v_role not in ('owner','admin') then
 raise exception 'Access denied' using errcode='42501';end if;
 if trim(p_name)=v_client.full_name and p_archived=(v_client.archived_at is not null) then return v_client.revision;end if;
 v_archived:=case when not p_archived then null else coalesce(v_client.archived_at,now()) end;
 update public.clients set full_name=trim(p_name),archived_at=v_archived where id=p_client and organization_id=p_org returning revision into v_revision;
 return v_revision;
end $$;
create function public.aura_client_change(p_org uuid,p_client uuid,p_name text,p_archived boolean,p_revision bigint)
returns bigint language sql security invoker set search_path='' as $$select app_private.client_change(p_org,p_client,p_name,p_archived,p_revision);$$;
revoke all on function app_private.client_change(uuid,uuid,text,boolean,bigint),public.aura_client_change(uuid,uuid,text,boolean,bigint) from public,anon,authenticated;
grant execute on function app_private.client_change(uuid,uuid,text,boolean,bigint),public.aura_client_change(uuid,uuid,text,boolean,bigint) to authenticated;

create function app_private.client_history(p_org uuid,p_client uuid,p_offset integer)
returns table(id uuid,actor_id uuid,action text,revision bigint,created_at timestamptz)
language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not app_private.is_member(p_org) or not exists(select 1 from public.clients c where c.id=p_client and c.organization_id=p_org) then
 raise exception 'Access denied' using errcode='42501';end if;
 if p_offset is null or p_offset<0 or p_offset>1000000 then raise exception 'Invalid offset' using errcode='22023';end if;
 return query select e.id,e.actor_id,e.action,e.revision,e.created_at from app_private.client_events e
 where e.organization_id=p_org and e.client_id=p_client order by e.created_at desc,e.id desc limit 25 offset p_offset;
end $$;
create function public.aura_client_history(p_org uuid,p_client uuid,p_offset integer default 0)
returns table(id uuid,actor_id uuid,action text,revision bigint,created_at timestamptz)
language sql security invoker set search_path='' as $$select * from app_private.client_history(p_org,p_client,p_offset);$$;
revoke all on function app_private.client_history(uuid,uuid,integer),public.aura_client_history(uuid,uuid,integer) from public,anon,authenticated;
grant execute on function app_private.client_history(uuid,uuid,integer),public.aura_client_history(uuid,uuid,integer) to authenticated;

-- The share lock makes inserts and archival serialize, including direct Data API inserts.
create function app_private.assessment_active_client() returns trigger
language plpgsql security definer set search_path='' as $$
declare v_archived timestamptz;
begin
 if (auth.uid() is not null and (not app_private.is_member(new.organization_id) or new.recorded_by is distinct from auth.uid()))
 or (auth.uid() is null and current_setting('role',true) in ('authenticated','anon')) then
 raise exception 'Access denied' using errcode='42501';end if;
 select archived_at into v_archived from public.clients where id=new.client_id and organization_id=new.organization_id for share;
 if not found then raise exception 'Invalid client/organization' using errcode='23503';end if;
 if v_archived is not null then raise exception 'Archived client cannot receive assessments' using errcode='23514';end if;
 return new;
end $$;
revoke all on function app_private.assessment_active_client() from public,anon,authenticated;
create trigger assessment_active_client before insert on public.assessments for each row execute function app_private.assessment_active_client();
-- Existing SELECT/INSERT grants and tenant RLS remain unchanged; no direct UPDATE/DELETE grant.
