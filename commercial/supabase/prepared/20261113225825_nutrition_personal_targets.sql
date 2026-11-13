-- PREPARED LOCAL CANDIDATE. Requires canonical19 + prepared personal access.
-- Explicit manual references for one calendar day. No prescription or sharing.
create function app_private.nutrition_target_command(p jsonb) returns jsonb
language plpgsql immutable set search_path='' as $targets$
declare day date;rev numeric;request uuid;v numeric;k text;values jsonb:='{}';begin
 if not app_private.nutrition_keys(p,array['contractVersion','requestId','expectedRevision','targetDate','targets','reason'])
 or p->'contractVersion'<>'1'::jsonb or jsonb_typeof(p->'requestId')<>'string'
 or (p->>'requestId') !~* '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$'
 or jsonb_typeof(p->'expectedRevision')<>'number' or jsonb_typeof(p->'targetDate')<>'string'
 or (p->>'targetDate') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
 or jsonb_typeof(p->'reason')<>'string' or length(btrim(p->>'reason')) not between 3 and 300 or (p->>'reason') ~ '[[:cntrl:]]'
 or not app_private.nutrition_keys(p->'targets',array['contractVersion','source','nutrients'])
 or p->'targets'->'contractVersion'<>'1'::jsonb or p->'targets'->'source'<>'"manual"'::jsonb
 or not app_private.nutrition_keys(p->'targets'->'nutrients',array['calories','protein','carbs','fat']) then raise exception using errcode='22023',message='Invalid manual target command';end if;
 day:=(p->>'targetDate')::date;rev:=(p->>'expectedRevision')::numeric;request:=(p->>'requestId')::uuid;
 if to_char(day,'YYYY-MM-DD')<>p->>'targetDate' or rev<0 or rev>=9007199254740991 or rev<>trunc(rev) then raise exception using errcode='22023',message='Invalid target date or revision';end if;
 foreach k in array array['calories','protein','carbs','fat'] loop
  if p->'targets'->'nutrients'->k='null'::jsonb then values:=values||jsonb_build_object(k,null);continue;end if;
  if jsonb_typeof(p->'targets'->'nutrients'->k)<>'number' then raise exception using errcode='22023',message='Invalid reference value';end if;
  v:=(p->'targets'->'nutrients'->>k)::numeric;
  if v<=0 or v>(case k when 'calories' then 10000 when 'carbs' then 2000 else 1000 end) or v<>round(v,3) then raise exception using errcode='22023',message='Invalid reference range';end if;
  values:=values||jsonb_build_object(k,trim_scale(v));
 end loop;
 return jsonb_build_object('contractVersion',1,'requestId',request,'expectedRevision',rev::bigint,'targetDate',to_char(day,'YYYY-MM-DD'),
 'targets',jsonb_build_object('contractVersion',1,'source','manual','nutrients',values),'reason',btrim(p->>'reason'));
exception when invalid_datetime_format or datetime_field_overflow or invalid_text_representation or numeric_value_out_of_range then raise exception using errcode='22023',message='Invalid manual target value';end;$targets$;
revoke all on function app_private.nutrition_target_command(jsonb) from public,anon,authenticated;

create function app_private.nutrition_manual_targets_valid(p jsonb) returns boolean language plpgsql immutable set search_path='' as $targets$begin
 perform app_private.nutrition_target_command(jsonb_build_object('contractVersion',1,'requestId','00000000-0000-0000-0000-000000000001','expectedRevision',0,'targetDate','2000-01-01','targets',p,'reason','Validate snapshot'));
 return true;exception when sqlstate '22023' then return false;end;$targets$;
revoke all on function app_private.nutrition_manual_targets_valid(jsonb) from public,anon,authenticated;

create table public.nutrition_personal_targets(
 id uuid primary key default gen_random_uuid(),organization_id uuid not null,client_id uuid not null,personal_user_id uuid not null references auth.users(id),
 target_date date not null,current_revision bigint not null check(current_revision between 1 and 9007199254740991),
 created_at timestamptz not null default statement_timestamp(),
 unique(organization_id,client_id,personal_user_id,target_date),unique(id,organization_id,client_id,personal_user_id),
 foreign key(client_id,organization_id) references public.clients(id,organization_id)
);
create table public.nutrition_personal_target_versions(
 target_id uuid not null,organization_id uuid not null,client_id uuid not null,personal_user_id uuid not null,
 revision bigint not null check(revision between 1 and 9007199254740991),targets jsonb not null check(app_private.nutrition_manual_targets_valid(targets)),reason text not null check(reason=btrim(reason) and length(reason) between 3 and 300 and reason !~ '[[:cntrl:]]'),
 created_at timestamptz not null default statement_timestamp(),primary key(target_id,revision),
 foreign key(target_id,organization_id,client_id,personal_user_id) references public.nutrition_personal_targets(id,organization_id,client_id,personal_user_id)
);
alter table public.nutrition_personal_targets add constraint nutrition_target_current_fk foreign key(id,current_revision) references public.nutrition_personal_target_versions(target_id,revision) deferrable initially deferred;
create table app_private.nutrition_personal_target_requests(
 organization_id uuid not null,client_id uuid not null,actor_id uuid not null,request_id uuid not null,command_hash text not null,
 target_id uuid not null,revision bigint not null,created_at timestamptz not null default statement_timestamp(),primary key(organization_id,actor_id,request_id),
 foreign key(target_id,revision) references public.nutrition_personal_target_versions(target_id,revision)
);
create function app_private.nutrition_target_head_guard() returns trigger language plpgsql set search_path='' as $targets$begin
 if (to_jsonb(new)-'current_revision') is distinct from (to_jsonb(old)-'current_revision') or new.current_revision<>old.current_revision+1 then raise exception using errcode='55000',message='Immutable target identity or invalid revision';end if;return new;
end;$targets$;
revoke all on function app_private.nutrition_target_head_guard() from public,anon,authenticated;
create trigger nutrition_target_head_guard before update on public.nutrition_personal_targets for each row execute function app_private.nutrition_target_head_guard();
create trigger nutrition_target_head_immutable before delete on public.nutrition_personal_targets for each row execute function app_private.nutrition_immutable();
create trigger nutrition_target_versions_immutable before update or delete on public.nutrition_personal_target_versions for each row execute function app_private.nutrition_immutable();
create trigger nutrition_target_requests_immutable before update or delete on app_private.nutrition_personal_target_requests for each row execute function app_private.nutrition_immutable();
alter table public.nutrition_personal_targets enable row level security;
alter table public.nutrition_personal_target_versions enable row level security;
alter table app_private.nutrition_personal_target_requests enable row level security;
revoke all on public.nutrition_personal_targets,public.nutrition_personal_target_versions,app_private.nutrition_personal_target_requests from public,anon,authenticated;
grant select on public.nutrition_personal_targets,public.nutrition_personal_target_versions to authenticated;
-- Minimal policy boolean only; the underlying identity/scope helper stays internal.
create function app_private.nutrition_personal_targets_visible(p_org uuid,p_client uuid,p_user uuid) returns boolean language sql stable security definer set search_path='' as $targets$
 select auth.uid() is not null and auth.uid()=p_user and app_private.nutrition_self_allowed(p_org,p_client,false);$targets$;
revoke all on function app_private.nutrition_personal_targets_visible(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function app_private.nutrition_personal_targets_visible(uuid,uuid,uuid) to authenticated;
create policy personal_targets_read on public.nutrition_personal_targets for select to authenticated using(app_private.nutrition_personal_targets_visible(organization_id,client_id,personal_user_id));
create policy personal_target_versions_read on public.nutrition_personal_target_versions for select to authenticated using(app_private.nutrition_personal_targets_visible(organization_id,client_id,personal_user_id));

create function app_private.student_nutrition_targets_save(p_org uuid,p_client uuid,p_command jsonb) returns jsonb
language plpgsql security definer set search_path='' as $targets$
declare c jsonb;hash text;r app_private.nutrition_personal_target_requests%rowtype;h public.nutrition_personal_targets%rowtype;target uuid;rev bigint;begin
 if not app_private.nutrition_personal_identity_valid(p_org,p_client) then raise exception using errcode='42501',message='Access denied';end if;
 perform app_private.require_sensitive_session(p_org);
 if not app_private.nutrition_self_allowed(p_org,p_client,true) then raise exception using errcode='42501',message='Access denied';end if;
 c:=app_private.nutrition_target_command(p_command);hash:=encode(sha256(convert_to(jsonb_build_object('org',p_org,'client',p_client,'command',c)::text,'UTF8')),'hex');
 select * into r from app_private.nutrition_personal_target_requests where organization_id=p_org and actor_id=auth.uid() and request_id=(c->>'requestId')::uuid;
 if found then
  if r.command_hash<>hash then raise exception using errcode='PT409',message='Request identity conflict';end if;
  return jsonb_build_object('targetDate',c->>'targetDate','revision',r.revision,'replayed',true);
 end if;
 select * into h from public.nutrition_personal_targets where organization_id=p_org and client_id=p_client and personal_user_id=auth.uid() and target_date=(c->>'targetDate')::date for update;
 if not app_private.nutrition_self_allowed(p_org,p_client,true) then raise exception using errcode='42501',message='Access denied';end if;
 if coalesce(h.current_revision,0)<>(c->>'expectedRevision')::bigint then raise exception using errcode='PT409',message='Target revision conflict';end if;
 rev:=coalesce(h.current_revision,0)+1;target:=coalesce(h.id,gen_random_uuid());
 if h.id is null then insert into public.nutrition_personal_targets(id,organization_id,client_id,personal_user_id,target_date,current_revision) values(target,p_org,p_client,auth.uid(),(c->>'targetDate')::date,rev);
 else update public.nutrition_personal_targets set current_revision=rev where id=target;end if;
 insert into public.nutrition_personal_target_versions(target_id,organization_id,client_id,personal_user_id,revision,targets,reason) values(target,p_org,p_client,auth.uid(),rev,c->'targets',c->>'reason');
 insert into app_private.nutrition_personal_target_requests(organization_id,client_id,actor_id,request_id,command_hash,target_id,revision) values(p_org,p_client,auth.uid(),(c->>'requestId')::uuid,hash,target,rev);
 return jsonb_build_object('targetDate',c->>'targetDate','revision',rev,'replayed',false);
end;$targets$;

create function app_private.student_nutrition_targets_read(p_org uuid,p_client uuid,p_date date) returns jsonb
language plpgsql stable security definer set search_path='' as $targets$declare result jsonb;begin
 if not app_private.nutrition_self_allowed(p_org,p_client,false) then raise exception using errcode='42501',message='Access denied';end if;
 if p_date is null then raise exception using errcode='22023',message='Missing day';end if;
 select jsonb_build_object('targetDate',to_char(h.target_date,'YYYY-MM-DD'),'revision',h.current_revision,'targets',v.targets) into result
 from public.nutrition_personal_targets h join public.nutrition_personal_target_versions v on v.target_id=h.id and v.revision=h.current_revision
 where h.organization_id=p_org and h.client_id=p_client and h.personal_user_id=auth.uid() and h.target_date=p_date;
 return coalesce(result,jsonb_build_object('targetDate',to_char(p_date,'YYYY-MM-DD'),'revision',0,'targets',null));
end;$targets$;
create function app_private.student_nutrition_targets_request_status(p_org uuid,p_client uuid,p_request uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $targets$declare result jsonb;begin
 if not app_private.nutrition_self_allowed(p_org,p_client,false) then raise exception using errcode='42501',message='Access denied';end if;
 select jsonb_build_object('targetDate',to_char(h.target_date,'YYYY-MM-DD'),'revision',r.revision) into result
 from app_private.nutrition_personal_target_requests r join public.nutrition_personal_targets h on h.id=r.target_id
 where r.organization_id=p_org and r.client_id=p_client and r.actor_id=auth.uid() and r.request_id=p_request;
 return result;
end;$targets$;
create function app_private.student_nutrition_targets_history(p_org uuid,p_client uuid,p_date date,p_before bigint default null) returns jsonb
language plpgsql stable security definer set search_path='' as $targets$declare versions jsonb;cursor bigint;begin
 if not app_private.nutrition_self_allowed(p_org,p_client,false) then raise exception using errcode='42501',message='Access denied';end if;
 if p_date is null or (p_before is not null and p_before<1) then raise exception using errcode='22023',message='Invalid target history cursor';end if;
 select coalesce(jsonb_agg(jsonb_build_object('targetDate',to_char(p_date,'YYYY-MM-DD'),'revision',revision,'targets',targets,'reason',reason) order by revision desc),'[]'::jsonb) into versions
 from (select v.revision,v.targets,v.reason from public.nutrition_personal_target_versions v join public.nutrition_personal_targets h on h.id=v.target_id
 where h.organization_id=p_org and h.client_id=p_client and h.personal_user_id=auth.uid() and h.target_date=p_date and (p_before is null or v.revision<p_before) order by v.revision desc limit 21) page;
 if jsonb_array_length(versions)>20 then cursor:=(versions->19->>'revision')::bigint;versions:=versions-20;end if;
 return jsonb_build_object('versions',versions,'nextCursor',cursor);
end;$targets$;

create function public.aura_student_nutrition_targets_save(p_org uuid,p_client uuid,p_command jsonb) returns jsonb language sql security invoker set search_path='' as $targets$select app_private.student_nutrition_targets_save(p_org,p_client,p_command);$targets$;
create function public.aura_student_nutrition_targets_read(p_org uuid,p_client uuid,p_date date) returns jsonb language sql stable security invoker set search_path='' as $targets$select app_private.student_nutrition_targets_read(p_org,p_client,p_date);$targets$;
create function public.aura_student_nutrition_targets_request_status(p_org uuid,p_client uuid,p_request uuid) returns jsonb language sql stable security invoker set search_path='' as $targets$select app_private.student_nutrition_targets_request_status(p_org,p_client,p_request);$targets$;
create function public.aura_student_nutrition_targets_history(p_org uuid,p_client uuid,p_date date,p_before bigint default null) returns jsonb language sql stable security invoker set search_path='' as $targets$select app_private.student_nutrition_targets_history(p_org,p_client,p_date,p_before);$targets$;
revoke all on function app_private.student_nutrition_targets_save(uuid,uuid,jsonb),public.aura_student_nutrition_targets_save(uuid,uuid,jsonb),app_private.student_nutrition_targets_read(uuid,uuid,date),public.aura_student_nutrition_targets_read(uuid,uuid,date),app_private.student_nutrition_targets_request_status(uuid,uuid,uuid),public.aura_student_nutrition_targets_request_status(uuid,uuid,uuid),app_private.student_nutrition_targets_history(uuid,uuid,date,bigint),public.aura_student_nutrition_targets_history(uuid,uuid,date,bigint) from public,anon,authenticated;
grant execute on function app_private.student_nutrition_targets_save(uuid,uuid,jsonb),public.aura_student_nutrition_targets_save(uuid,uuid,jsonb),app_private.student_nutrition_targets_read(uuid,uuid,date),public.aura_student_nutrition_targets_read(uuid,uuid,date),app_private.student_nutrition_targets_request_status(uuid,uuid,uuid),public.aura_student_nutrition_targets_request_status(uuid,uuid,uuid),app_private.student_nutrition_targets_history(uuid,uuid,date,bigint),public.aura_student_nutrition_targets_history(uuid,uuid,date,bigint) to authenticated;
