-- OFFLINE CANDIDATE ONLY. Depends on reviewed baseline 18/19.
-- Outside migrations/: excluded from the installer and frozen activation package.
-- Requires a separately reviewed activation/recovery plan before any remote use.
create function app_private.nutrition_water_command_v1(p jsonb) returns jsonb
language plpgsql immutable set search_path='' as $water$
declare target uuid;request uuid;rev numeric;day date;amount numeric;entry jsonb;reason text;begin
 if not app_private.nutrition_keys(p,array['contractVersion','requestId','waterId','expectedRevision','operation','entry','reason'])
 or p->'contractVersion'<>'1'::jsonb or jsonb_typeof(p->'requestId')<>'string'
 or (p->>'requestId') !~* '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$'
 or jsonb_typeof(p->'expectedRevision')<>'number' or jsonb_typeof(p->'operation')<>'string'
 or p->>'operation' not in ('save','void') then raise exception using errcode='22023',message='Invalid water command';end if;
 request:=(p->>'requestId')::uuid;rev:=(p->>'expectedRevision')::numeric;
 if rev<0 or rev>9007199254740991 or rev<>trunc(rev) then raise exception using errcode='22023',message='Invalid water revision';end if;
 if p->'waterId'<>'null'::jsonb then
  if jsonb_typeof(p->'waterId')<>'string' or (p->>'waterId') !~* '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$' then raise exception using errcode='22023',message='Invalid water identity';end if;
  target:=(p->>'waterId')::uuid;
 end if;
 if (target is null and (rev<>0 or p->'reason'<>'null'::jsonb or p->>'operation'='void')) or (target is not null and rev<1)
 then raise exception using errcode='22023',message='Invalid water operation';end if;
 if target is not null then
  if jsonb_typeof(p->'reason')<>'string' or (p->>'reason') ~ '[[:cntrl:]]' then raise exception using errcode='22023',message='Invalid change reason';end if;
  reason:=btrim(p->>'reason');if length(reason) not between 3 and 300 then raise exception using errcode='22023',message='Invalid change reason';end if;
 end if;
 if p->>'operation'='void' then
  if p->'entry'<>'null'::jsonb then raise exception using errcode='22023',message='Void cannot replace declaration';end if;
 else
  entry:=p->'entry';
  if not app_private.nutrition_keys(entry,array['consumedOn','time','quantity']) or jsonb_typeof(entry->'consumedOn')<>'string'
  or (entry->>'consumedOn') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
  or not app_private.nutrition_keys(entry->'quantity',array['amount','unit'])
  or entry->'quantity'->'unit'<>'"ml"'::jsonb or jsonb_typeof(entry->'quantity'->'amount')<>'number'
  then raise exception using errcode='22023',message='Invalid water declaration';end if;
  day:=(entry->>'consumedOn')::date;
  if to_char(day,'YYYY-MM-DD')<>entry->>'consumedOn' then raise exception using errcode='22023',message='Invalid water day';end if;
  if entry->'time'<>'null'::jsonb and (jsonb_typeof(entry->'time')<>'string' or (entry->>'time') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$')
  then raise exception using errcode='22023',message='Invalid water time';end if;
  amount:=(entry->'quantity'->>'amount')::numeric;
  if amount<1 or amount>5000 or amount<>trunc(amount) then raise exception using errcode='22023',message='Invalid water quantity';end if;
  entry:=jsonb_build_object('consumedOn',to_char(day,'YYYY-MM-DD'),'time',entry->'time','quantity',jsonb_build_object('amount',amount::integer,'unit','ml'));
 end if;
 return jsonb_build_object('contractVersion',1,'requestId',request,'waterId',target,'expectedRevision',rev::bigint,'operation',p->>'operation','entry',entry,'reason',reason);
exception when invalid_datetime_format or datetime_field_overflow or invalid_text_representation or numeric_value_out_of_range then
 raise exception using errcode='22023',message='Invalid water value';
end;$water$;
revoke all on function app_private.nutrition_water_command_v1(jsonb) from public,anon,authenticated;

create table public.nutrition_water (
 id uuid primary key default gen_random_uuid(),organization_id uuid not null,client_id uuid not null,
 current_revision bigint not null check(current_revision between 1 and 9007199254740991),
 created_by uuid not null references auth.users(id),created_at timestamptz not null default statement_timestamp(),
 unique(id,organization_id,client_id),foreign key(client_id,organization_id) references public.clients(id,organization_id)
);
create table public.nutrition_water_versions (
 water_id uuid not null,organization_id uuid not null,client_id uuid not null,revision bigint not null check(revision between 1 and 9007199254740991),
 consumed_on date not null,recorded_time time,
 milliliters integer not null check(milliliters between 1 and 5000),
 status text not null check(status in ('recorded','voided')),reason text,
 recorded_by uuid not null references auth.users(id),created_at timestamptz not null default statement_timestamp(),
 primary key(water_id,revision),unique(water_id,revision,organization_id,client_id),
 foreign key(water_id,organization_id,client_id) references public.nutrition_water(id,organization_id,client_id),
 check(recorded_time is null or (recorded_time<'24:00'::time and extract(second from recorded_time)=0)),
 check((revision=1 and status='recorded' and reason is null) or (revision>1 and reason is not null and length(btrim(reason)) between 3 and 300))
);
alter table public.nutrition_water add constraint nutrition_water_current_fk foreign key(id,current_revision)
 references public.nutrition_water_versions(water_id,revision) deferrable initially deferred;
create index nutrition_water_scope_idx on public.nutrition_water(organization_id,client_id,id);
create index nutrition_water_day_idx on public.nutrition_water_versions(organization_id,client_id,consumed_on,water_id,revision);
create table app_private.nutrition_water_requests (
 organization_id uuid not null references public.organizations(id),actor_id uuid not null references auth.users(id),request_id uuid not null,
 client_id uuid not null,command_hash text not null,water_id uuid not null,revision bigint not null,
 created_at timestamptz not null default statement_timestamp(),primary key(organization_id,actor_id,request_id),
 foreign key(water_id,revision,organization_id,client_id) references public.nutrition_water_versions(water_id,revision,organization_id,client_id)
);
create table app_private.nutrition_water_events (
 organization_id uuid not null,actor_id uuid not null,request_id uuid not null,water_id uuid not null,revision bigint not null,
 action text not null check(action in ('save','void')),created_at timestamptz not null default statement_timestamp(),
 primary key(organization_id,actor_id,request_id),
 foreign key(organization_id,actor_id,request_id) references app_private.nutrition_water_requests(organization_id,actor_id,request_id)
);
create trigger nutrition_water_head_guard before update on public.nutrition_water for each row execute function app_private.nutrition_head_guard();
create trigger nutrition_water_head_immutable before delete on public.nutrition_water for each row execute function app_private.nutrition_immutable();
create trigger nutrition_water_versions_immutable before update or delete on public.nutrition_water_versions for each row execute function app_private.nutrition_immutable();
create trigger nutrition_water_requests_immutable before update or delete on app_private.nutrition_water_requests for each row execute function app_private.nutrition_immutable();
create trigger nutrition_water_events_immutable before update or delete on app_private.nutrition_water_events for each row execute function app_private.nutrition_immutable();
alter table public.nutrition_water enable row level security;
alter table public.nutrition_water_versions enable row level security;
alter table app_private.nutrition_water_requests enable row level security;
alter table app_private.nutrition_water_events enable row level security;
revoke all on public.nutrition_water,public.nutrition_water_versions,app_private.nutrition_water_requests,app_private.nutrition_water_events from public,anon,authenticated;
grant select on public.nutrition_water,public.nutrition_water_versions to authenticated;
create policy nutrition_water_read on public.nutrition_water for select to authenticated using(app_private.nutrition_allowed(organization_id,client_id,false));
create policy nutrition_water_versions_read on public.nutrition_water_versions for select to authenticated using(app_private.nutrition_allowed(organization_id,client_id,false));

create function app_private.nutrition_water_save(p_org uuid,p_client uuid,p_command jsonb) returns jsonb
language plpgsql security definer set search_path='' set lock_timeout='5s' as $water$
declare command jsonb;hash text;receipt app_private.nutrition_water_requests%rowtype;
 head public.nutrition_water%rowtype;previous public.nutrition_water_versions%rowtype;
 target uuid;rev bigint;day date;clock time;amount integer;begin
 perform app_private.require_sensitive_session(p_org);
 if not app_private.nutrition_allowed(p_org,p_client,true) then raise exception using errcode='42501',message='Access denied';end if;
 command:=app_private.nutrition_water_command_v1(p_command);
 perform pg_advisory_xact_lock(hashtextextended('aura:nutrition:water:'||p_org::text||':'||auth.uid()::text||':'||(command->>'requestId'),0));
 if not app_private.nutrition_allowed(p_org,p_client,true) then raise exception using errcode='42501',message='Access denied';end if;
 if exists(select 1 from public.clients where id=p_client and organization_id=p_org and archived_at is not null) then raise exception using errcode='23514',message='Archived client';end if;
 hash:=encode(sha256(convert_to(jsonb_build_object('organizationId',p_org,'clientId',p_client,'command',command)::text,'UTF8')),'hex');
 select * into receipt from app_private.nutrition_water_requests where organization_id=p_org and actor_id=auth.uid() and request_id=(command->>'requestId')::uuid;
 if found then
  if receipt.command_hash<>hash then raise exception using errcode='PT409',message='Request identity conflict';end if;
  return jsonb_build_object('waterId',receipt.water_id,'revision',receipt.revision,'replayed',true);
 end if;
 target:=(command->>'waterId')::uuid;
 if target is null then
  target:=gen_random_uuid();rev:=1;
  insert into public.nutrition_water(id,organization_id,client_id,current_revision,created_by) values(target,p_org,p_client,rev,auth.uid());
 else
  select * into head from public.nutrition_water where id=target and organization_id=p_org and client_id=p_client for update;
  if not found then raise exception using errcode='42501',message='Access denied';end if;
  perform app_private.require_sensitive_session(p_org);
  if not app_private.nutrition_allowed(p_org,p_client,true) then raise exception using errcode='42501',message='Access denied';end if;
  if exists(select 1 from public.clients where id=p_client and organization_id=p_org and archived_at is not null) then raise exception using errcode='23514',message='Archived client';end if;
  if head.current_revision<>(command->>'expectedRevision')::bigint or head.current_revision>=9007199254740991 then raise exception using errcode='PT409',message='Water revision conflict';end if;
  select v.* into previous from public.nutrition_water_versions v where v.water_id=target and v.revision=head.current_revision;
  if previous.status='voided' then raise exception using errcode='23514',message='Voided water cannot be edited';end if;
  rev:=head.current_revision+1;
  update public.nutrition_water set current_revision=rev where id=target;
 end if;
 if command->>'operation'='void' then day:=previous.consumed_on;clock:=previous.recorded_time;amount:=previous.milliliters;
 else
  day:=(command->'entry'->>'consumedOn')::date;clock:=(command->'entry'->>'time')::time;amount:=(command->'entry'->'quantity'->>'amount')::integer;
  if day>app_private.business_today() then raise exception using errcode='22023',message='Future water declaration';end if;
 end if;
 insert into public.nutrition_water_versions(water_id,organization_id,client_id,revision,consumed_on,recorded_time,milliliters,status,reason,recorded_by)
 values(target,p_org,p_client,rev,day,clock,amount,case when command->>'operation'='void' then 'voided' else 'recorded' end,command->>'reason',auth.uid());
 insert into app_private.nutrition_water_requests(organization_id,actor_id,request_id,client_id,command_hash,water_id,revision)
 values(p_org,auth.uid(),(command->>'requestId')::uuid,p_client,hash,target,rev);
 insert into app_private.nutrition_water_events(organization_id,actor_id,request_id,water_id,revision,action) values(p_org,auth.uid(),(command->>'requestId')::uuid,target,rev,command->>'operation');
 return jsonb_build_object('waterId',target,'revision',rev,'replayed',false);
end;$water$;

create function app_private.nutrition_water_projection(p_water uuid,p_revision bigint) returns jsonb
language sql stable set search_path='' as $water$
 select jsonb_build_object('waterId',v.water_id,'revision',v.revision,'entry',jsonb_build_object('consumedOn',v.consumed_on,'time',case when v.recorded_time is null then null else to_char(date '2000-01-01'+v.recorded_time,'HH24:MI') end,'quantity',jsonb_build_object('amount',v.milliliters,'unit','ml')),'status',v.status,'reason',v.reason,'recordedBy',v.recorded_by)
 from public.nutrition_water_versions v where v.water_id=p_water and v.revision=p_revision;
$water$;
create function app_private.nutrition_water_request_status(p_org uuid,p_client uuid,p_request uuid) returns jsonb
language plpgsql security definer set search_path='' as $water$declare r app_private.nutrition_water_requests%rowtype;begin
 perform app_private.require_sensitive_session(p_org);
 if not app_private.nutrition_allowed(p_org,p_client,true) then raise exception using errcode='42501',message='Access denied';end if;
 select * into r from app_private.nutrition_water_requests where organization_id=p_org and actor_id=auth.uid() and client_id=p_client and request_id=p_request;
 if not found then return null;end if;return jsonb_build_object('waterId',r.water_id,'revision',r.revision);
end;$water$;
create function app_private.nutrition_water_diary(p_org uuid,p_client uuid,p_date date,p_after uuid default null) returns jsonb
language plpgsql stable security definer set search_path='' as $water$declare entries jsonb;cursor uuid;active bigint;voided bigint;total bigint;begin
 if not app_private.nutrition_allowed(p_org,p_client,false) then raise exception using errcode='42501',message='Access denied';end if;
 if p_date is null then raise exception using errcode='22023',message='Missing water day';end if;
 select coalesce(jsonb_agg(app_private.nutrition_water_projection(id,current_revision) order by id),'[]'::jsonb) into entries
 from (select h.id,h.current_revision from public.nutrition_water h join public.nutrition_water_versions v on v.water_id=h.id and v.revision=h.current_revision
 where h.organization_id=p_org and h.client_id=p_client and v.organization_id=p_org and v.client_id=p_client and v.consumed_on=p_date and (p_after is null or h.id>p_after) order by h.id limit 21) page;
 if jsonb_array_length(entries)>20 then cursor:=(entries->19->>'waterId')::uuid;entries:=entries-20;end if;
 select count(*) filter(where v.status='recorded'),count(*) filter(where v.status='voided'),sum(v.milliliters) filter(where v.status='recorded') into active,voided,total
 from public.nutrition_water h join public.nutrition_water_versions v on v.water_id=h.id and v.revision=h.current_revision
 where h.organization_id=p_org and h.client_id=p_client and v.organization_id=p_org and v.client_id=p_client and v.consumed_on=p_date;
 if active>9007199254740991 or voided>9007199254740991 or total>9007199254740991 then raise exception using errcode='22003',message='Water summary overflow';end if;
 return jsonb_build_object('entries',entries,'nextCursor',cursor,'summary',jsonb_build_object('activeCount',active,'voidedCount',voided,'declaredMl',total));
end;$water$;
create function app_private.nutrition_water_history(p_org uuid,p_client uuid,p_water uuid,p_before bigint default null) returns jsonb
language plpgsql stable security definer set search_path='' as $water$declare entries jsonb;cursor bigint;begin
 if not app_private.nutrition_allowed(p_org,p_client,false) or not exists(select 1 from public.nutrition_water where id=p_water and organization_id=p_org and client_id=p_client) then raise exception using errcode='42501',message='Access denied';end if;
 if p_before is not null and (p_before<1 or p_before>9007199254740991) then raise exception using errcode='22023',message='Invalid water cursor';end if;
 select coalesce(jsonb_agg(app_private.nutrition_water_projection(water_id,revision) order by revision desc),'[]'::jsonb) into entries
 from (select water_id,revision from public.nutrition_water_versions where water_id=p_water and (p_before is null or revision<p_before) order by revision desc limit 21) page;
 if jsonb_array_length(entries)>20 then cursor:=(entries->19->>'revision')::bigint;entries:=entries-20;end if;
 return jsonb_build_object('versions',entries,'nextCursor',cursor);
end;$water$;
create function public.aura_nutrition_water_save(p_org uuid,p_client uuid,p_command jsonb) returns jsonb language sql security invoker set search_path='' as $water$select app_private.nutrition_water_save(p_org,p_client,p_command);$water$;
create function public.aura_nutrition_water_request_status(p_org uuid,p_client uuid,p_request uuid) returns jsonb language sql security invoker set search_path='' as $water$select app_private.nutrition_water_request_status(p_org,p_client,p_request);$water$;
create function public.aura_nutrition_water_diary(p_org uuid,p_client uuid,p_date date,p_after uuid default null) returns jsonb language sql stable security invoker set search_path='' as $water$select app_private.nutrition_water_diary(p_org,p_client,p_date,p_after);$water$;
create function public.aura_nutrition_water_history(p_org uuid,p_client uuid,p_water uuid,p_before bigint default null) returns jsonb language sql stable security invoker set search_path='' as $water$select app_private.nutrition_water_history(p_org,p_client,p_water,p_before);$water$;
revoke all on function app_private.nutrition_water_projection(uuid,bigint) from public,anon,authenticated;
revoke all on function app_private.nutrition_water_save(uuid,uuid,jsonb),public.aura_nutrition_water_save(uuid,uuid,jsonb),
 app_private.nutrition_water_request_status(uuid,uuid,uuid),public.aura_nutrition_water_request_status(uuid,uuid,uuid),
 app_private.nutrition_water_diary(uuid,uuid,date,uuid),public.aura_nutrition_water_diary(uuid,uuid,date,uuid),
 app_private.nutrition_water_history(uuid,uuid,uuid,bigint),public.aura_nutrition_water_history(uuid,uuid,uuid,bigint) from public,anon,authenticated;
grant execute on function app_private.nutrition_water_save(uuid,uuid,jsonb),public.aura_nutrition_water_save(uuid,uuid,jsonb),
 app_private.nutrition_water_request_status(uuid,uuid,uuid),public.aura_nutrition_water_request_status(uuid,uuid,uuid),
 app_private.nutrition_water_diary(uuid,uuid,date,uuid),public.aura_nutrition_water_diary(uuid,uuid,date,uuid),
 app_private.nutrition_water_history(uuid,uuid,uuid,bigint),public.aura_nutrition_water_history(uuid,uuid,uuid,bigint) to authenticated;
