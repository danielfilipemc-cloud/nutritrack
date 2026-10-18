-- P4 local-review candidate. No UI activation or cloud execution.
create index nutrition_meals_client_idx on public.nutrition_meals(organization_id,client_id,id);
create function app_private.nutrition_keys(p_value jsonb,p_keys text[]) returns boolean
language sql immutable set search_path='' as $$select p_value is not null and jsonb_typeof(p_value)='object' and p_value ?& p_keys and p_value-p_keys='{}'::jsonb;$$;
revoke all on function app_private.nutrition_keys(jsonb,text[]) from public,anon,authenticated;

create function app_private.nutrition_command_v1(p_value jsonb) returns jsonb
language plpgsql immutable set search_path='' as $$
declare item jsonb;items jsonb:='[]';composition jsonb;nutrients jsonb;k text;grams numeric;rev numeric;meal uuid;request uuid;day date;begin
 if not app_private.nutrition_keys(p_value,array['contractVersion','requestId','mealId','expectedRevision','consumedOn','mealKind','operation','items'])
 or p_value->'contractVersion'<>'1'::jsonb or jsonb_typeof(p_value->'requestId')<>'string'
 or (p_value->>'requestId') !~* '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$'
 or jsonb_typeof(p_value->'expectedRevision')<>'number' or jsonb_typeof(p_value->'consumedOn')<>'string'
 or (p_value->>'consumedOn') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
 or p_value->>'mealKind' not in ('breakfast','lunch','dinner','snack','other')
 or p_value->>'operation' not in ('save','void') or jsonb_typeof(p_value->'items')<>'array'
 then raise exception using errcode='22023',message='Invalid nutrition command';end if;
 -- Reject null enum fields too (SQL NULL comparisons do not reject them).
 if jsonb_typeof(p_value->'mealKind')<>'string' or jsonb_typeof(p_value->'operation')<>'string' then raise exception using errcode='22023',message='Invalid command kind';end if;
 request:=(p_value->>'requestId')::uuid;rev:=(p_value->>'expectedRevision')::numeric;day:=(p_value->>'consumedOn')::date;
 if to_char(day,'YYYY-MM-DD')<>p_value->>'consumedOn' or rev<0 or rev>9007199254740991 or rev<>trunc(rev) then raise exception using errcode='22023',message='Invalid date or revision';end if;
 if p_value->'mealId'<>'null'::jsonb then
  if jsonb_typeof(p_value->'mealId')<>'string' or (p_value->>'mealId') !~* '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$' then raise exception using errcode='22023',message='Invalid meal identity';end if;
  meal:=(p_value->>'mealId')::uuid;
 end if;
 if (meal is null and rev<>0) or (meal is not null and rev<1)
 or (p_value->>'operation'='void' and (meal is null or jsonb_array_length(p_value->'items')<>0))
 or (p_value->>'operation'='save' and jsonb_array_length(p_value->'items') not between 1 and 50)
 then raise exception using errcode='22023',message='Invalid operation revision or items';end if;
 for item in select value from jsonb_array_elements(p_value->'items') loop
  if not app_private.nutrition_keys(item,array['label','quantity','composition','source']) or jsonb_typeof(item->'label')<>'string'
  or length(btrim(item->>'label')) not between 1 and 120 or (item->>'label') ~ '[[:cntrl:]]'
  or item->'source'<>'"manual"'::jsonb or not app_private.nutrition_composition_valid(item->'composition')
  or not app_private.nutrition_keys(item->'quantity',array['amount','unit']) or item->'quantity'->'unit'<>'"g"'::jsonb
  or jsonb_typeof(item->'quantity'->'amount')<>'number' then raise exception using errcode='22023',message='Invalid meal item';end if;
  grams:=(item->'quantity'->>'amount')::numeric;
  if grams<=0 or grams>5000 or grams<>round(grams,3) then raise exception using errcode='22023',message='Invalid mass';end if;
  nutrients:='{}';foreach k in array array['calories','protein','carbs','fat'] loop
   nutrients:=nutrients||jsonb_build_object(k,case when item->'composition'->'nutrients'->k='null'::jsonb then 'null'::jsonb else to_jsonb(trim_scale((item->'composition'->'nutrients'->>k)::numeric)) end);
  end loop;
  composition:=jsonb_build_object('contractVersion',1,'basis',jsonb_build_object('amount',100,'unit','g'),'nutrients',nutrients);
  items:=items||jsonb_build_array(jsonb_build_object('label',btrim(item->>'label'),'quantity',jsonb_build_object('amount',trim_scale(grams),'unit','g'),'composition',composition,'source','manual'));
 end loop;
 return jsonb_build_object('contractVersion',1,'requestId',request,'mealId',meal,'expectedRevision',rev::bigint,'consumedOn',to_char(day,'YYYY-MM-DD'),'mealKind',p_value->>'mealKind','operation',p_value->>'operation','items',items);
exception when invalid_datetime_format or datetime_field_overflow or invalid_text_representation or numeric_value_out_of_range then
 raise exception using errcode='22023',message='Invalid nutrition value';
end;$$;
revoke all on function app_private.nutrition_command_v1(jsonb) from public,anon,authenticated;

create table app_private.nutrition_requests (
 organization_id uuid not null references public.organizations(id),actor_id uuid not null references auth.users(id),request_id uuid not null,
 client_id uuid not null,command_hash text not null,meal_id uuid not null,revision bigint not null,
 created_at timestamptz not null default statement_timestamp(),primary key(organization_id,actor_id,request_id),
 foreign key(meal_id,revision,organization_id,client_id) references public.nutrition_meal_versions(meal_id,revision,organization_id,client_id)
);
create table app_private.nutrition_events (
 organization_id uuid not null,actor_id uuid not null,request_id uuid not null,meal_id uuid not null,revision bigint not null,
 action text not null check(action in ('save','void')),created_at timestamptz not null default statement_timestamp(),
 primary key(organization_id,actor_id,request_id),
 foreign key(organization_id,actor_id,request_id) references app_private.nutrition_requests(organization_id,actor_id,request_id)
);
alter table app_private.nutrition_requests enable row level security;
alter table app_private.nutrition_events enable row level security;
revoke all on app_private.nutrition_requests,app_private.nutrition_events from public,anon,authenticated;
create trigger nutrition_events_immutable before update or delete on app_private.nutrition_events for each row execute function app_private.nutrition_immutable();
create trigger nutrition_requests_immutable before update or delete on app_private.nutrition_requests for each row execute function app_private.nutrition_immutable();

create function app_private.nutrition_meal_save(p_org uuid,p_client uuid,p_command jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare command jsonb;hash text;receipt app_private.nutrition_requests%rowtype;head public.nutrition_meals%rowtype;previous public.nutrition_meal_versions%rowtype;
 meal uuid;revision bigint;item jsonb;position integer:=0;begin
 perform app_private.require_sensitive_session(p_org);
 if not app_private.nutrition_allowed(p_org,p_client,true) then raise exception using errcode='42501',message='Access denied';end if;
 if exists(select 1 from public.clients where id=p_client and organization_id=p_org and archived_at is not null) then raise exception using errcode='23514',message='Archived client';end if;
 command:=app_private.nutrition_command_v1(p_command);
 hash:=encode(sha256(convert_to(jsonb_build_object('organizationId',p_org,'clientId',p_client,'command',command)::text,'UTF8')),'hex');
 select * into receipt from app_private.nutrition_requests where organization_id=p_org and actor_id=auth.uid() and request_id=(command->>'requestId')::uuid;
 if found then
  if receipt.command_hash<>hash then raise exception using errcode='PT409',message='Request identity conflict';end if;
  return jsonb_build_object('mealId',receipt.meal_id,'revision',receipt.revision,'replayed',true);
 end if;
 if (command->>'consumedOn')::date>app_private.business_today() then raise exception using errcode='22023',message='Future consumption date';end if;
 meal:=(command->>'mealId')::uuid;
 if meal is null then
  meal:=gen_random_uuid();revision:=1;
  insert into public.nutrition_meals(id,organization_id,client_id,current_revision,created_by) values(meal,p_org,p_client,revision,auth.uid());
 else
  select * into head from public.nutrition_meals where id=meal and organization_id=p_org and client_id=p_client;
  if not found then raise exception using errcode='42501',message='Access denied';end if;
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
   position:=position+1;
   insert into public.nutrition_meal_items values(meal,revision,p_org,p_client,position,item->>'label',(item->'quantity'->>'amount')::numeric,item->'composition','manual');
  end loop;
 end if;
 insert into app_private.nutrition_requests(organization_id,actor_id,request_id,client_id,command_hash,meal_id,revision) values(p_org,auth.uid(),(command->>'requestId')::uuid,p_client,hash,meal,revision);
 insert into app_private.nutrition_events(organization_id,actor_id,request_id,meal_id,revision,action) values(p_org,auth.uid(),(command->>'requestId')::uuid,meal,revision,command->>'operation');
 return jsonb_build_object('mealId',meal,'revision',revision,'replayed',false);
end;$$;
create function public.aura_nutrition_meal_save(p_org uuid,p_client uuid,p_command jsonb) returns jsonb
language sql security invoker set search_path='' as $$select app_private.nutrition_meal_save(p_org,p_client,p_command);$$;
revoke all on function app_private.nutrition_meal_save(uuid,uuid,jsonb),public.aura_nutrition_meal_save(uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function app_private.nutrition_meal_save(uuid,uuid,jsonb),public.aura_nutrition_meal_save(uuid,uuid,jsonb) to authenticated;

create function app_private.nutrition_request_status(p_org uuid,p_client uuid,p_request uuid) returns jsonb
language plpgsql security definer set search_path='' as $$declare receipt app_private.nutrition_requests%rowtype;begin
 perform app_private.require_sensitive_session(p_org);
 if not app_private.nutrition_allowed(p_org,p_client,true) then raise exception using errcode='42501',message='Access denied';end if;
 select * into receipt from app_private.nutrition_requests where organization_id=p_org and actor_id=auth.uid() and client_id=p_client and request_id=p_request;
 if not found then return null;end if;
 return jsonb_build_object('mealId',receipt.meal_id,'revision',receipt.revision);
end;$$;
create function public.aura_nutrition_request_status(p_org uuid,p_client uuid,p_request uuid) returns jsonb
language sql security invoker set search_path='' as $$select app_private.nutrition_request_status(p_org,p_client,p_request);$$;
revoke all on function app_private.nutrition_request_status(uuid,uuid,uuid),public.aura_nutrition_request_status(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function app_private.nutrition_request_status(uuid,uuid,uuid),public.aura_nutrition_request_status(uuid,uuid,uuid) to authenticated;

create function app_private.nutrition_projection(p_meal uuid,p_revision bigint) returns jsonb
language sql stable set search_path='' as $$
 select jsonb_build_object('mealId',v.meal_id,'revision',v.revision,'consumedOn',v.consumed_on,'mealKind',v.meal_kind,'status',v.status,
 'items',coalesce((select jsonb_agg(jsonb_build_object('label',i.label,'quantity',jsonb_build_object('amount',i.grams,'unit','g'),'composition',i.composition,'source',i.source_kind) order by i.position) from public.nutrition_meal_items i where i.meal_id=v.meal_id and i.revision=v.revision),'[]'::jsonb))
 from public.nutrition_meal_versions v where v.meal_id=p_meal and v.revision=p_revision;
$$;
revoke all on function app_private.nutrition_projection(uuid,bigint) from public,anon,authenticated;
create function app_private.nutrition_diary(p_org uuid,p_client uuid,p_date date,p_after uuid default null) returns jsonb
language plpgsql stable security definer set search_path='' as $$declare entries jsonb;cursor uuid;begin
 if not app_private.nutrition_allowed(p_org,p_client,false) then raise exception using errcode='42501',message='Access denied';end if;
 if p_date is null then raise exception using errcode='22023',message='Missing date';end if;
 select coalesce(jsonb_agg(app_private.nutrition_projection(id,current_revision) order by id),'[]'::jsonb) into entries
 from (select h.id,h.current_revision from public.nutrition_meals h join public.nutrition_meal_versions v on v.meal_id=h.id and v.revision=h.current_revision and v.organization_id=h.organization_id and v.client_id=h.client_id
 where h.organization_id=p_org and h.client_id=p_client and v.consumed_on=p_date and (p_after is null or h.id>p_after) order by h.id limit 21) page;
 if jsonb_array_length(entries)>20 then cursor:=(entries->19->>'mealId')::uuid;entries:=entries-20;end if;
 return jsonb_build_object('meals',entries,'nextCursor',cursor);
end;$$;
create function public.aura_nutrition_diary(p_org uuid,p_client uuid,p_date date,p_after uuid default null) returns jsonb
language sql stable security invoker set search_path='' as $$select app_private.nutrition_diary(p_org,p_client,p_date,p_after);$$;
revoke all on function app_private.nutrition_diary(uuid,uuid,date,uuid),public.aura_nutrition_diary(uuid,uuid,date,uuid) from public,anon,authenticated;
grant execute on function app_private.nutrition_diary(uuid,uuid,date,uuid),public.aura_nutrition_diary(uuid,uuid,date,uuid) to authenticated;
create function app_private.nutrition_history(p_org uuid,p_client uuid,p_meal uuid,p_before bigint default null) returns jsonb
language plpgsql stable security definer set search_path='' as $$declare entries jsonb;cursor bigint;begin
 if not app_private.nutrition_allowed(p_org,p_client,false) or not exists(select 1 from public.nutrition_meals where id=p_meal and organization_id=p_org and client_id=p_client) then raise exception using errcode='42501',message='Access denied';end if;
 if p_before is not null and p_before<1 then raise exception using errcode='22023',message='Invalid cursor';end if;
 select coalesce(jsonb_agg(app_private.nutrition_projection(meal_id,revision) order by revision desc),'[]'::jsonb) into entries
 from (select meal_id,revision from public.nutrition_meal_versions where meal_id=p_meal and (p_before is null or revision<p_before) order by revision desc limit 21) page;
 if jsonb_array_length(entries)>20 then cursor:=(entries->19->>'revision')::bigint;entries:=entries-20;end if;
 return jsonb_build_object('versions',entries,'nextCursor',cursor);
end;$$;
create function public.aura_nutrition_history(p_org uuid,p_client uuid,p_meal uuid,p_before bigint default null) returns jsonb
language sql stable security invoker set search_path='' as $$select app_private.nutrition_history(p_org,p_client,p_meal,p_before);$$;
revoke all on function app_private.nutrition_history(uuid,uuid,uuid,bigint),public.aura_nutrition_history(uuid,uuid,uuid,bigint) from public,anon,authenticated;
grant execute on function app_private.nutrition_history(uuid,uuid,uuid,bigint),public.aura_nutrition_history(uuid,uuid,uuid,bigint) to authenticated;
