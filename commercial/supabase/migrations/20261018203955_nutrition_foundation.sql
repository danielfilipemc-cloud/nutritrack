-- P3: additive, local-review candidate. No grants/backfill from legacy modules.
create table public.nutrition_capabilities (
 organization_id uuid not null, user_id uuid not null, can_write boolean not null,
 primary key(organization_id,user_id),
 foreign key(organization_id,user_id) references public.organization_members(organization_id,user_id) on delete cascade
);
alter table public.nutrition_capabilities enable row level security;
revoke all on public.nutrition_capabilities from public,anon,authenticated;
grant select on public.nutrition_capabilities to authenticated;
create policy nutrition_capabilities_read on public.nutrition_capabilities for select to authenticated
 using(user_id=auth.uid() or app_private.can_manage_access(organization_id));

create function app_private.nutrition_allowed(p_org uuid,p_client uuid,p_write boolean default false) returns boolean
language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and p_write is not null
 and app_private.can_access_client(p_org,p_client,'profile',false)
 and exists(select 1 from public.nutrition_capabilities c join public.client_assignments a
 on a.organization_id=c.organization_id and a.user_id=c.user_id
 where c.organization_id=p_org and c.user_id=auth.uid() and a.client_id=p_client and (not p_write or c.can_write));
$$;
revoke all on function app_private.nutrition_allowed(uuid,uuid,boolean) from public,anon,authenticated;
grant execute on function app_private.nutrition_allowed(uuid,uuid,boolean) to authenticated;

create function app_private.nutrition_capability_save(p_org uuid,p_user uuid,p_enabled boolean,p_write boolean) returns void
language plpgsql security definer set search_path='' as $$begin
 perform app_private.require_sensitive_session(p_org);
 if not exists(select 1 from public.organization_members where organization_id=p_org and user_id=auth.uid() and role='owner')
 then raise exception using errcode='42501',message='Only owner may grant nutrition capability';end if;
 if p_enabled is null or p_write is null or not exists(select 1 from public.organization_members where organization_id=p_org and user_id=p_user)
 then raise exception using errcode='22023',message='Invalid capability';end if;
 if p_enabled then insert into public.nutrition_capabilities values(p_org,p_user,p_write)
 on conflict(organization_id,user_id) do update set can_write=excluded.can_write;
 else delete from public.nutrition_capabilities where organization_id=p_org and user_id=p_user;end if;
 insert into app_private.foundation_events(organization_id,actor_id,subject_id,action)
 values(p_org,auth.uid(),p_user,case when p_enabled then 'nutrition_capability_granted' else 'nutrition_capability_revoked' end);
end;$$;
create function public.aura_nutrition_capability_save(p_org uuid,p_user uuid,p_enabled boolean,p_write boolean) returns void
language sql security invoker set search_path='' as $$select app_private.nutrition_capability_save(p_org,p_user,p_enabled,p_write);$$;
revoke all on function app_private.nutrition_capability_save(uuid,uuid,boolean,boolean),public.aura_nutrition_capability_save(uuid,uuid,boolean,boolean) from public,anon,authenticated;
grant execute on function app_private.nutrition_capability_save(uuid,uuid,boolean,boolean),public.aura_nutrition_capability_save(uuid,uuid,boolean,boolean) to authenticated;

create function app_private.nutrition_composition_valid(p_value jsonb) returns boolean
language plpgsql immutable set search_path='' as $$declare k text;v numeric;begin
 if p_value is null or jsonb_typeof(p_value)<>'object'
 or not p_value ?& array['contractVersion','basis','nutrients']
 or p_value-array['contractVersion','basis','nutrients']<>'{}'::jsonb
 or p_value->'contractVersion'<>'1'::jsonb or p_value->'basis'<>'{"amount":100,"unit":"g"}'::jsonb
 or jsonb_typeof(p_value->'nutrients')<>'object'
 or not (p_value->'nutrients') ?& array['calories','protein','carbs','fat']
 or (p_value->'nutrients')-array['calories','protein','carbs','fat']<>'{}'::jsonb then return false;end if;
 foreach k in array array['calories','protein','carbs','fat'] loop
  if p_value->'nutrients'->k='null'::jsonb then continue;end if;
  if jsonb_typeof(p_value->'nutrients'->k)<>'number' then return false;end if;
  v:=(p_value->'nutrients'->>k)::numeric;
  if v<0 or v>(case when k='calories' then 1000 else 100 end) or v<>round(v,3) then return false;end if;
 end loop;return true;
end;$$;
revoke all on function app_private.nutrition_composition_valid(jsonb) from public,anon,authenticated;

create table public.nutrition_meals (
 id uuid primary key default gen_random_uuid(),organization_id uuid not null,client_id uuid not null,
 current_revision bigint not null check(current_revision>0),created_by uuid not null references auth.users(id),
 created_at timestamptz not null default statement_timestamp(),unique(id,organization_id,client_id),
 foreign key(client_id,organization_id) references public.clients(id,organization_id)
);
create table public.nutrition_meal_versions (
 meal_id uuid not null,organization_id uuid not null,client_id uuid not null,revision bigint not null check(revision>0),
 consumed_on date not null,meal_kind text not null check(meal_kind in ('breakfast','lunch','dinner','snack','other')),
 status text not null default 'recorded' check(status in ('recorded','voided')),
 recorded_by uuid not null references auth.users(id),created_at timestamptz not null default statement_timestamp(),
 primary key(meal_id,revision),unique(meal_id,revision,organization_id,client_id),
 foreign key(meal_id,organization_id,client_id) references public.nutrition_meals(id,organization_id,client_id)
);
alter table public.nutrition_meals add constraint nutrition_current_version_fk
 foreign key(id,current_revision) references public.nutrition_meal_versions(meal_id,revision) deferrable initially deferred;
create index nutrition_versions_day_idx on public.nutrition_meal_versions(organization_id,client_id,consumed_on,meal_id,revision);
create table public.nutrition_meal_items (
 meal_id uuid not null,revision bigint not null,organization_id uuid not null,client_id uuid not null,
 position integer not null check(position between 1 and 50),label text not null check(length(btrim(label)) between 1 and 120),
 grams numeric not null check(grams>0 and grams<=5000 and grams=round(grams,3)),
 composition jsonb not null check(app_private.nutrition_composition_valid(composition)),
 source_kind text not null check(source_kind='manual'),
 primary key(meal_id,revision,position),
 foreign key(meal_id,revision,organization_id,client_id) references public.nutrition_meal_versions(meal_id,revision,organization_id,client_id)
);
create function app_private.nutrition_immutable() returns trigger language plpgsql set search_path='' as $$begin
 raise exception using errcode='55000',message='Nutrition history is append-only';end;$$;
revoke all on function app_private.nutrition_immutable() from public,anon,authenticated;
create trigger nutrition_versions_immutable before update or delete on public.nutrition_meal_versions for each row execute function app_private.nutrition_immutable();
create trigger nutrition_items_immutable before update or delete on public.nutrition_meal_items for each row execute function app_private.nutrition_immutable();
create function app_private.nutrition_head_guard() returns trigger language plpgsql set search_path='' as $$begin
 if (new.id,new.organization_id,new.client_id,new.created_by,new.created_at) is distinct from (old.id,old.organization_id,old.client_id,old.created_by,old.created_at)
 or new.current_revision<>old.current_revision+1 then raise exception using errcode='55000',message='Immutable meal identity or invalid revision';end if;return new;
end;$$;
revoke all on function app_private.nutrition_head_guard() from public,anon,authenticated;
create trigger nutrition_head_guard before update on public.nutrition_meals for each row execute function app_private.nutrition_head_guard();

alter table public.nutrition_meals enable row level security;
alter table public.nutrition_meal_versions enable row level security;
alter table public.nutrition_meal_items enable row level security;
revoke all on public.nutrition_meals,public.nutrition_meal_versions,public.nutrition_meal_items from public,anon,authenticated;
grant select on public.nutrition_meals,public.nutrition_meal_versions,public.nutrition_meal_items to authenticated;
create policy nutrition_meals_read on public.nutrition_meals for select to authenticated using(app_private.nutrition_allowed(organization_id,client_id,false));
create policy nutrition_versions_read on public.nutrition_meal_versions for select to authenticated using(app_private.nutrition_allowed(organization_id,client_id,false));
create policy nutrition_items_read on public.nutrition_meal_items for select to authenticated using(app_private.nutrition_allowed(organization_id,client_id,false));
