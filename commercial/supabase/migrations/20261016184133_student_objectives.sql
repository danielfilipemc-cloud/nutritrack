-- Operational objectives extend the existing follow-up competency, not nutrition
-- or clinical prescription. No backfill, change to existing goals or implicit grants.
create table public.client_objectives (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.organizations(id) on delete cascade,
 client_id uuid not null,
 title text not null check(length(btrim(title,E' \t\n\r')) between 1 and 160),
 state text not null default 'active' check(state in ('active','completed','cancelled')),
 due_on date check(due_on between date '2000-01-01' and date '2100-12-31'),
 completed_at timestamptz,
 revision bigint not null default 1 check(revision>0),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 check((state='completed')=(completed_at is not null)),
 foreign key(client_id,organization_id) references public.clients(id,organization_id) on delete cascade,
 unique(id,organization_id,client_id)
);
create index objectives_client_order_idx on public.client_objectives(organization_id,client_id,created_at desc,id desc);
alter table public.client_objectives enable row level security;
revoke all on public.client_objectives from public,anon,authenticated;
grant select on public.client_objectives to authenticated;
create policy objectives_read on public.client_objectives for select to authenticated
 using(app_private.can_access_client(organization_id,client_id,'followup',false));

create table app_private.objective_events (
 id uuid primary key default gen_random_uuid(),organization_id uuid not null,client_id uuid not null,objective_id uuid not null,
 actor_id uuid references auth.users(id) on delete set null,
 action text not null check(action in ('created','updated','completed','cancelled','reopened')),
 revision bigint not null,from_state text,to_state text not null,created_at timestamptz not null default now(),
 foreign key(objective_id,organization_id,client_id) references public.client_objectives(id,organization_id,client_id) on delete cascade
);
create index objective_events_client_idx on app_private.objective_events(organization_id,client_id,created_at desc,id desc);
alter table app_private.objective_events enable row level security;
revoke all on app_private.objective_events from public,anon,authenticated;

create function app_private.objective_save(p_org uuid,p_client uuid,p_id uuid,p_title text,p_state text,p_due date,p_revision bigint)
returns uuid language plpgsql security definer set search_path='' as $fn$
declare existing public.client_objectives%rowtype;archived timestamptz;result uuid;new_revision bigint;event_action text;clean_title text:=btrim(p_title,E' \t\n\r');
begin
 if auth.uid() is null then raise exception using errcode='42501',message='Access denied';end if;
 -- Same lock order as capability/assignment revocation and existing care commands.
 perform 1 from public.organizations where id=p_org for update;
 if not app_private.can_access_client(p_org,p_client,'followup',true) then raise exception using errcode='42501',message='Access denied';end if;
 select archived_at into archived from public.clients where id=p_client and organization_id=p_org for update;
 if not found then raise exception using errcode='42501',message='Access denied';end if;
 if archived is not null then raise exception using errcode='23514',message='Archived client';end if;
 if clean_title is null or length(clean_title) not between 1 and 160 or p_state is null or p_state not in ('active','completed','cancelled')
 or p_revision is null or p_revision<0 or (p_due is not null and p_due not between date '2000-01-01' and date '2100-12-31') then
 raise exception using errcode='22023',message='Invalid objective';end if;
 if p_id is null then
  if p_revision<>0 or p_state<>'active' then raise exception using errcode='22023',message='Invalid initial objective';end if;
  insert into public.client_objectives(organization_id,client_id,title,state,due_on) values(p_org,p_client,clean_title,p_state,p_due)
   returning id,revision into result,new_revision;event_action:='created';
 else
  select * into existing from public.client_objectives where id=p_id and organization_id=p_org and client_id=p_client for update;
  if not found then raise exception using errcode='42501',message='Access denied';end if;
  if existing.revision<>p_revision then raise exception using errcode='PT409',message='Revision conflict';end if;
  -- Closed objectives must be explicitly reopened before editing or changing closure.
  if existing.state<>'active' and (p_state<>'active' or clean_title<>existing.title or p_due is distinct from existing.due_on) then
   raise exception using errcode='22023',message='Reopen before editing';end if;
  update public.client_objectives set title=clean_title,state=p_state,due_on=p_due,
   completed_at=case when p_state='completed' then statement_timestamp() else null end,
   revision=revision+1,updated_at=statement_timestamp() where id=p_id returning id,revision into result,new_revision;
  event_action:=case when existing.state<>'active' then 'reopened' when p_state='completed' then 'completed' when p_state='cancelled' then 'cancelled' else 'updated' end;
 end if;
 insert into app_private.objective_events(organization_id,client_id,objective_id,actor_id,action,revision,from_state,to_state)
 values(p_org,p_client,result,auth.uid(),event_action,new_revision,existing.state,p_state);
 return result;
end;$fn$;
create function public.aura_objective_save(p_org uuid,p_client uuid,p_id uuid,p_title text,p_state text,p_due date,p_revision bigint)
returns uuid language sql security invoker set search_path='' as $fn$ select app_private.objective_save(p_org,p_client,p_id,p_title,p_state,p_due,p_revision);$fn$;
revoke all on function app_private.objective_save(uuid,uuid,uuid,text,text,date,bigint),public.aura_objective_save(uuid,uuid,uuid,text,text,date,bigint) from public,anon,authenticated;
grant execute on function app_private.objective_save(uuid,uuid,uuid,text,text,date,bigint),public.aura_objective_save(uuid,uuid,uuid,text,text,date,bigint) to authenticated;

create function app_private.objective_history(p_org uuid,p_client uuid,p_offset integer)
returns table(id uuid,objective_id uuid,action text,revision bigint,from_state text,to_state text,created_at timestamptz)
language plpgsql stable security definer set search_path='' as $fn$ begin
 if auth.uid() is null or not app_private.can_access_client(p_org,p_client,'followup',false) then raise exception using errcode='42501',message='Access denied';end if;
 if p_offset is null or p_offset<0 or p_offset>1000000 then raise exception using errcode='22023',message='Invalid offset';end if;
 return query select e.id,e.objective_id,e.action,e.revision,e.from_state,e.to_state,e.created_at from app_private.objective_events e
 where e.organization_id=p_org and e.client_id=p_client order by e.created_at desc,e.id desc limit 25 offset p_offset;
end;$fn$;
create function public.aura_objective_history(p_org uuid,p_client uuid,p_offset integer default 0)
returns table(id uuid,objective_id uuid,action text,revision bigint,from_state text,to_state text,created_at timestamptz)
language sql stable security invoker set search_path='' as $fn$ select * from app_private.objective_history(p_org,p_client,p_offset);$fn$;
revoke all on function app_private.objective_history(uuid,uuid,integer),public.aura_objective_history(uuid,uuid,integer) from public,anon,authenticated;
grant execute on function app_private.objective_history(uuid,uuid,integer),public.aura_objective_history(uuid,uuid,integer) to authenticated;

-- Keep the existing export's identity/projection checks. Add objectives only
-- for an already-authorized staff export; the student projection stays minimal.
alter function app_private.visible_export(uuid,uuid) rename to visible_export_objectives_base;
revoke all on function app_private.visible_export_objectives_base(uuid,uuid) from public,anon,authenticated;
create function app_private.visible_export(p_org uuid,p_client uuid) returns jsonb
language plpgsql security definer set search_path='' as $fn$ declare result jsonb;begin
 result:=app_private.visible_export_objectives_base(p_org,p_client);
 return result||jsonb_build_object('objectives',case when not app_private.is_student(p_org,p_client)
 and app_private.can_access_client(p_org,p_client,'followup',false) then (
 select coalesce(jsonb_agg(jsonb_build_object('id',o.id,'title',o.title,'state',o.state,'due_on',o.due_on,
 'completed_at',o.completed_at,'revision',o.revision,'created_at',o.created_at,'updated_at',o.updated_at) order by o.created_at,o.id),'[]'::jsonb)
 from public.client_objectives o where o.organization_id=p_org and o.client_id=p_client) else '[]'::jsonb end);
end;$fn$;
revoke all on function app_private.visible_export(uuid,uuid) from public,anon,authenticated;
grant execute on function app_private.visible_export(uuid,uuid) to authenticated;
