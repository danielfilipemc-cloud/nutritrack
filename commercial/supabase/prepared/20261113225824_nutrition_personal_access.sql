-- PREPARED LOCAL CANDIDATE. Generated with CLI migration new; NOT in migrations/.
-- Requires canonical 19. No remote execution or real-data activation authorized.
-- One journal/history engine; personal entries are private by default.
alter table public.nutrition_meals add column personal_user_id uuid references auth.users(id);
create index nutrition_personal_meals_idx on public.nutrition_meals(organization_id,client_id,personal_user_id,id);

create function app_private.nutrition_personal_identity_valid(p_org uuid,p_client uuid) returns boolean
language plpgsql stable security definer set search_path='' as $personal$
declare claims jsonb;sid text;begin
 if auth.uid() is null then return false;end if;
 claims:=coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb;sid:=claims->>'session_id';
 if sid is null or sid !~* '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$'
 or coalesce(claims->>'exp','') !~ '^[0-9]{1,12}$' then return false;end if;
 return (claims->>'exp')::bigint>extract(epoch from statement_timestamp())
 and exists(select 1 from auth.users u where u.id=auth.uid() and u.email_confirmed_at is not null)
 and exists(select 1 from auth.sessions s where s.id=sid::uuid and s.user_id=auth.uid() and (s.not_after is null or s.not_after>statement_timestamp()))
 and exists(select 1 from public.client_users l where l.organization_id=p_org and l.client_id=p_client and l.user_id=auth.uid() and l.revoked_at is null);
exception when invalid_text_representation then return false;end;$personal$;
revoke all on function app_private.nutrition_personal_identity_valid(uuid,uuid) from public,anon,authenticated;

create function app_private.nutrition_self_allowed(p_org uuid,p_client uuid,p_write boolean default false) returns boolean
language sql stable security definer set search_path='' as $personal$
 select p_write is not null and app_private.nutrition_personal_identity_valid(p_org,p_client)
 and app_private.sensitive_session_valid(p_org)
 and exists(select 1 from public.clients c where c.organization_id=p_org and c.id=p_client and (not p_write or c.archived_at is null));
$personal$;
revoke all on function app_private.nutrition_self_allowed(uuid,uuid,boolean) from public,anon,authenticated;

create function app_private.nutrition_scope_allowed(p_org uuid,p_client uuid,p_personal boolean,p_write boolean) returns boolean
language sql stable set search_path='' as $personal$
 select case when p_personal is true then app_private.nutrition_self_allowed(p_org,p_client,p_write)
 when p_personal is false then app_private.nutrition_allowed(p_org,p_client,p_write) else false end;
$personal$;
revoke all on function app_private.nutrition_scope_allowed(uuid,uuid,boolean,boolean) from public,anon,authenticated;

create function app_private.nutrition_meal_visible(p_meal uuid,p_org uuid,p_client uuid) returns boolean
language sql stable security definer set search_path='' as $personal$
 select auth.uid() is not null and exists(select 1 from public.nutrition_meals h where h.id=p_meal and h.organization_id=p_org and h.client_id=p_client
 and ((h.personal_user_id is null and app_private.nutrition_allowed(p_org,p_client,false))
 or (h.personal_user_id=auth.uid() and app_private.nutrition_self_allowed(p_org,p_client,false))));
$personal$;
revoke all on function app_private.nutrition_meal_visible(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function app_private.nutrition_meal_visible(uuid,uuid,uuid) to authenticated;

create function app_private.nutrition_personal_owner_guard() returns trigger language plpgsql set search_path='' as $personal$begin
 if new.personal_user_id is distinct from old.personal_user_id then raise exception using errcode='55000',message='Immutable personal owner';end if;return new;
end;$personal$;
revoke all on function app_private.nutrition_personal_owner_guard() from public,anon,authenticated;
create trigger nutrition_personal_owner_guard before update on public.nutrition_meals for each row execute function app_private.nutrition_personal_owner_guard();

-- Replace the existing policies; an additional permissive policy would leak entries.
drop policy nutrition_meals_read on public.nutrition_meals;
drop policy nutrition_versions_read on public.nutrition_meal_versions;
drop policy nutrition_items_read on public.nutrition_meal_items;
create policy nutrition_meals_read on public.nutrition_meals for select to authenticated using(app_private.nutrition_meal_visible(id,organization_id,client_id));
create policy nutrition_versions_read on public.nutrition_meal_versions for select to authenticated using(app_private.nutrition_meal_visible(meal_id,organization_id,client_id));
create policy nutrition_items_read on public.nutrition_meal_items for select to authenticated using(app_private.nutrition_meal_visible(meal_id,organization_id,client_id));

-- Owner-only core. Only the fixed-scope entrypoints below may execute it.
create function app_private.nutrition_meal_save_scoped(p_org uuid,p_client uuid,p_command jsonb,p_personal boolean) returns jsonb
language plpgsql set search_path='' as $personal$
declare command jsonb;hash text;receipt app_private.nutrition_requests%rowtype;head public.nutrition_meals%rowtype;previous public.nutrition_meal_versions%rowtype;
 meal uuid;revision bigint;item jsonb;position integer:=0;begin
 if p_personal is null then raise exception using errcode='42501',message='Access denied';end if;
 if p_personal and not app_private.nutrition_personal_identity_valid(p_org,p_client) then raise exception using errcode='42501',message='Access denied';end if;
 perform app_private.require_sensitive_session(p_org);
 if not app_private.nutrition_scope_allowed(p_org,p_client,p_personal,true) then raise exception using errcode='42501',message='Access denied';end if;
 if exists(select 1 from public.clients where id=p_client and organization_id=p_org and archived_at is not null) then raise exception using errcode='23514',message='Archived client';end if;
 command:=app_private.nutrition_command_v1(p_command);
 -- Preserve the canonical hash for all existing professional receipts.
 hash:=encode(sha256(convert_to((jsonb_build_object('organizationId',p_org,'clientId',p_client,'command',command)
 ||case when p_personal then '{"scope":"personal"}'::jsonb else '{}'::jsonb end)::text,'UTF8')),'hex');
 select * into receipt from app_private.nutrition_requests where organization_id=p_org and actor_id=auth.uid() and request_id=(command->>'requestId')::uuid;
 if found then
  if receipt.command_hash<>hash then raise exception using errcode='PT409',message='Request identity conflict';end if;
  return jsonb_build_object('mealId',receipt.meal_id,'revision',receipt.revision,'replayed',true);
 end if;
 if (command->>'consumedOn')::date>app_private.business_today() then raise exception using errcode='22023',message='Future consumption date';end if;
 meal:=(command->>'mealId')::uuid;
 if meal is null then
  meal:=gen_random_uuid();revision:=1;
  insert into public.nutrition_meals(id,organization_id,client_id,current_revision,created_by,personal_user_id)
  values(meal,p_org,p_client,revision,auth.uid(),case when p_personal then auth.uid() else null end);
 else
  select * into head from public.nutrition_meals where id=meal and organization_id=p_org and client_id=p_client
  and (case when p_personal then personal_user_id=auth.uid() else personal_user_id is null end) for update;
  if not found then raise exception using errcode='42501',message='Access denied';end if;
  if not app_private.nutrition_scope_allowed(p_org,p_client,p_personal,true) then raise exception using errcode='42501',message='Access denied';end if;
  if head.current_revision<>(command->>'expectedRevision')::bigint then raise exception using errcode='PT409',message='Meal revision conflict';end if;
  select v.* into previous from public.nutrition_meal_versions v where v.meal_id=meal and v.revision=head.current_revision;
  if previous.status='voided' then raise exception using errcode='23514',message='Voided meal cannot be edited';end if;
  if command->>'operation'='void' and ((command->>'consumedOn')::date<>previous.consumed_on or command->>'mealKind'<>previous.meal_kind) then raise exception using errcode='22023',message='Void cannot change meal details';end if;
  revision:=head.current_revision+1;
  update public.nutrition_meals set current_revision=revision where id=meal;
 end if;
 insert into public.nutrition_meal_versions(meal_id,organization_id,client_id,revision,consumed_on,meal_kind,status,recorded_by)
 values(meal,p_org,p_client,revision,(command->>'consumedOn')::date,command->>'mealKind',case when command->>'operation'='void' then 'voided' else 'recorded' end,auth.uid());
 if command->>'operation'='void' then
  insert into public.nutrition_meal_items select i.meal_id,i.revision+1,i.organization_id,i.client_id,i.position,i.label,i.grams,i.composition,i.source_kind from public.nutrition_meal_items i where i.meal_id=meal and i.revision=head.current_revision;
 else
  for item in select value from jsonb_array_elements(command->'items') loop
   position:=position+1;insert into public.nutrition_meal_items values(meal,revision,p_org,p_client,position,item->>'label',(item->'quantity'->>'amount')::numeric,item->'composition','manual');
  end loop;
 end if;
 insert into app_private.nutrition_requests(organization_id,actor_id,request_id,client_id,command_hash,meal_id,revision) values(p_org,auth.uid(),(command->>'requestId')::uuid,p_client,hash,meal,revision);
 insert into app_private.nutrition_events(organization_id,actor_id,request_id,meal_id,revision,action) values(p_org,auth.uid(),(command->>'requestId')::uuid,meal,revision,command->>'operation');
 return jsonb_build_object('mealId',meal,'revision',revision,'replayed',false);
end;$personal$;
revoke all on function app_private.nutrition_meal_save_scoped(uuid,uuid,jsonb,boolean) from public,anon,authenticated;
create or replace function app_private.nutrition_meal_save(p_org uuid,p_client uuid,p_command jsonb) returns jsonb
language sql security definer set search_path='' as $personal$select app_private.nutrition_meal_save_scoped(p_org,p_client,p_command,false);$personal$;
create function app_private.student_nutrition_meal_save(p_org uuid,p_client uuid,p_command jsonb) returns jsonb
language sql security definer set search_path='' as $personal$select app_private.nutrition_meal_save_scoped(p_org,p_client,p_command,true);$personal$;

create function app_private.nutrition_diary_scoped(p_org uuid,p_client uuid,p_date date,p_after uuid,p_personal boolean) returns jsonb
language plpgsql stable set search_path='' as $personal$declare entries jsonb;cursor uuid;begin
 if not app_private.nutrition_scope_allowed(p_org,p_client,p_personal,false) then raise exception using errcode='42501',message='Access denied';end if;
 if p_date is null then raise exception using errcode='22023',message='Missing date';end if;
 select coalesce(jsonb_agg(app_private.nutrition_projection(id,current_revision) order by id),'[]'::jsonb) into entries
 from (select h.id,h.current_revision from public.nutrition_meals h join public.nutrition_meal_versions v on v.meal_id=h.id and v.revision=h.current_revision
 where h.organization_id=p_org and h.client_id=p_client and v.consumed_on=p_date and (p_after is null or h.id>p_after)
 and (case when p_personal then h.personal_user_id=auth.uid() else h.personal_user_id is null end) order by h.id limit 21) page;
 if jsonb_array_length(entries)>20 then cursor:=(entries->19->>'mealId')::uuid;entries:=entries-20;end if;
 return jsonb_build_object('meals',entries,'nextCursor',cursor);
end;$personal$;
revoke all on function app_private.nutrition_diary_scoped(uuid,uuid,date,uuid,boolean) from public,anon,authenticated;
create or replace function app_private.nutrition_diary(p_org uuid,p_client uuid,p_date date,p_after uuid default null) returns jsonb
language sql stable security definer set search_path='' as $personal$select app_private.nutrition_diary_scoped(p_org,p_client,p_date,p_after,false);$personal$;
create function app_private.student_nutrition_diary(p_org uuid,p_client uuid,p_date date,p_after uuid default null) returns jsonb
language sql stable security definer set search_path='' as $personal$select app_private.nutrition_diary_scoped(p_org,p_client,p_date,p_after,true);$personal$;

create function app_private.nutrition_history_scoped(p_org uuid,p_client uuid,p_meal uuid,p_before bigint,p_personal boolean) returns jsonb
language plpgsql stable set search_path='' as $personal$declare entries jsonb;cursor bigint;begin
 if not app_private.nutrition_scope_allowed(p_org,p_client,p_personal,false) or not exists(select 1 from public.nutrition_meals where id=p_meal and organization_id=p_org and client_id=p_client
 and (case when p_personal then personal_user_id=auth.uid() else personal_user_id is null end)) then raise exception using errcode='42501',message='Access denied';end if;
 if p_before is not null and p_before<1 then raise exception using errcode='22023',message='Invalid cursor';end if;
 select coalesce(jsonb_agg(app_private.nutrition_projection(meal_id,revision) order by revision desc),'[]'::jsonb) into entries
 from (select meal_id,revision from public.nutrition_meal_versions where meal_id=p_meal and (p_before is null or revision<p_before) order by revision desc limit 21) page;
 if jsonb_array_length(entries)>20 then cursor:=(entries->19->>'revision')::bigint;entries:=entries-20;end if;
 return jsonb_build_object('versions',entries,'nextCursor',cursor);
end;$personal$;
revoke all on function app_private.nutrition_history_scoped(uuid,uuid,uuid,bigint,boolean) from public,anon,authenticated;
create or replace function app_private.nutrition_history(p_org uuid,p_client uuid,p_meal uuid,p_before bigint default null) returns jsonb
language sql stable security definer set search_path='' as $personal$select app_private.nutrition_history_scoped(p_org,p_client,p_meal,p_before,false);$personal$;
create function app_private.student_nutrition_history(p_org uuid,p_client uuid,p_meal uuid,p_before bigint default null) returns jsonb
language sql stable security definer set search_path='' as $personal$select app_private.nutrition_history_scoped(p_org,p_client,p_meal,p_before,true);$personal$;

create function app_private.nutrition_receipt_scoped(p_org uuid,p_client uuid,p_request uuid,p_personal boolean) returns jsonb
language plpgsql set search_path='' as $personal$declare receipt app_private.nutrition_requests%rowtype;begin
 if not app_private.nutrition_scope_allowed(p_org,p_client,p_personal,not p_personal) then raise exception using errcode='42501',message='Access denied';end if;
 select r.* into receipt from app_private.nutrition_requests r join public.nutrition_meals h on h.id=r.meal_id
 where r.organization_id=p_org and r.actor_id=auth.uid() and r.client_id=p_client and r.request_id=p_request
 and (case when p_personal then h.personal_user_id=auth.uid() else h.personal_user_id is null end);
 if not found then return null;end if;return jsonb_build_object('mealId',receipt.meal_id,'revision',receipt.revision);
end;$personal$;
revoke all on function app_private.nutrition_receipt_scoped(uuid,uuid,uuid,boolean) from public,anon,authenticated;
create or replace function app_private.nutrition_request_status(p_org uuid,p_client uuid,p_request uuid) returns jsonb
language plpgsql security definer set search_path='' as $personal$begin perform app_private.require_sensitive_session(p_org);return app_private.nutrition_receipt_scoped(p_org,p_client,p_request,false);end;$personal$;
create function app_private.student_nutrition_request_status(p_org uuid,p_client uuid,p_request uuid) returns jsonb
language sql security definer set search_path='' as $personal$select app_private.nutrition_receipt_scoped(p_org,p_client,p_request,true);$personal$;

create function app_private.student_nutrition_context(p_org uuid,p_client uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $personal$begin
 if not app_private.nutrition_self_allowed(p_org,p_client,false) then raise exception using errcode='42501',message='Access denied';end if;
 return jsonb_build_object('canWrite',app_private.nutrition_self_allowed(p_org,p_client,true));
end;$personal$;

create function public.aura_student_nutrition_context(p_org uuid,p_client uuid) returns jsonb language sql stable security invoker set search_path='' as $personal$select app_private.student_nutrition_context(p_org,p_client);$personal$;
create function public.aura_student_nutrition_meal_save(p_org uuid,p_client uuid,p_command jsonb) returns jsonb language sql security invoker set search_path='' as $personal$select app_private.student_nutrition_meal_save(p_org,p_client,p_command);$personal$;
create function public.aura_student_nutrition_diary(p_org uuid,p_client uuid,p_date date,p_after uuid default null) returns jsonb language sql stable security invoker set search_path='' as $personal$select app_private.student_nutrition_diary(p_org,p_client,p_date,p_after);$personal$;
create function public.aura_student_nutrition_history(p_org uuid,p_client uuid,p_meal uuid,p_before bigint default null) returns jsonb language sql stable security invoker set search_path='' as $personal$select app_private.student_nutrition_history(p_org,p_client,p_meal,p_before);$personal$;
create function public.aura_student_nutrition_request_status(p_org uuid,p_client uuid,p_request uuid) returns jsonb language sql security invoker set search_path='' as $personal$select app_private.student_nutrition_request_status(p_org,p_client,p_request);$personal$;
revoke all on function app_private.student_nutrition_context(uuid,uuid),public.aura_student_nutrition_context(uuid,uuid),app_private.student_nutrition_meal_save(uuid,uuid,jsonb),public.aura_student_nutrition_meal_save(uuid,uuid,jsonb),app_private.student_nutrition_diary(uuid,uuid,date,uuid),public.aura_student_nutrition_diary(uuid,uuid,date,uuid),app_private.student_nutrition_history(uuid,uuid,uuid,bigint),public.aura_student_nutrition_history(uuid,uuid,uuid,bigint),app_private.student_nutrition_request_status(uuid,uuid,uuid),public.aura_student_nutrition_request_status(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function app_private.student_nutrition_context(uuid,uuid),public.aura_student_nutrition_context(uuid,uuid),app_private.student_nutrition_meal_save(uuid,uuid,jsonb),public.aura_student_nutrition_meal_save(uuid,uuid,jsonb),app_private.student_nutrition_diary(uuid,uuid,date,uuid),public.aura_student_nutrition_diary(uuid,uuid,date,uuid),app_private.student_nutrition_history(uuid,uuid,uuid,bigint),public.aura_student_nutrition_history(uuid,uuid,uuid,bigint),app_private.student_nutrition_request_status(uuid,uuid,uuid),public.aura_student_nutrition_request_status(uuid,uuid,uuid) to authenticated;
