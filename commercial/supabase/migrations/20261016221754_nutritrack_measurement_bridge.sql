create table public.nutritrack_links(
 id uuid primary key default gen_random_uuid(),organization_id uuid not null,client_id uuid not null,
 source_subject text not null check(length(btrim(source_subject)) between 1 and 80),active boolean not null default true,
 created_by uuid not null references auth.users(id),created_at timestamptz not null default statement_timestamp(),
 unique(organization_id,client_id),unique(organization_id,source_subject),unique(id,organization_id,client_id),
 foreign key(client_id,organization_id) references public.clients(id,organization_id)
);
alter table public.nutritrack_links enable row level security;
revoke all on public.nutritrack_links from public,anon,authenticated;
grant select on public.nutritrack_links to authenticated;
create policy nutritrack_link_read on public.nutritrack_links for select to authenticated using(app_private.can_access_client(organization_id,client_id,'profile',false) and app_private.can_access_client(organization_id,client_id,'assessments',false));
alter table public.assessments add column source_system text not null default 'aura',add column source_link_id uuid,add column source_record_id text,add column source_revision bigint,
 add constraint assessment_source_valid check((source_system='aura' and source_link_id is null and source_record_id is null and source_revision is null) or (source_system='nutritrack' and source_link_id is not null and source_record_id is not null and source_revision is not null and length(source_record_id) between 1 and 80 and source_revision>0)),
 add constraint assessment_source_link_fk foreign key(source_link_id,organization_id,client_id) references public.nutritrack_links(id,organization_id,client_id);
create table app_private.nutritrack_records(
 link_id uuid not null references public.nutritrack_links(id),source_record_id text not null,
 revision bigint not null check(revision>0),assessment_id uuid not null references public.assessments(id),content jsonb not null,
 updated_by uuid not null references auth.users(id),updated_at timestamptz not null default statement_timestamp(),primary key(link_id,source_record_id)
);
alter table app_private.nutritrack_records enable row level security;
revoke all on app_private.nutritrack_records from public,anon,authenticated;
create function app_private.nutritrack_link_save(p_org uuid,p_client uuid,p_subject text,p_active boolean) returns uuid
language plpgsql security definer set search_path='' as $$declare existing public.nutritrack_links%rowtype;result uuid;begin
 if auth.uid() is null then raise exception using errcode='42501',message='Access denied';end if;
 perform 1 from public.organizations where id=p_org for update;
 if not app_private.can_manage_access(p_org) or not app_private.can_access_client(p_org,p_client,'assessments',true) then raise exception using errcode='42501',message='Access denied';end if;
 if exists(select 1 from public.clients where id=p_client and organization_id=p_org and archived_at is not null) then raise exception using errcode='23514',message='Archived client';end if;
 if p_subject is null or length(btrim(p_subject)) not between 1 and 80 or p_active is null then raise exception using errcode='22023',message='Invalid identity';end if;
 select * into existing from public.nutritrack_links where organization_id=p_org and client_id=p_client;
 if existing.id is not null and existing.source_subject<>btrim(p_subject) then raise exception using errcode='PT409',message='Identity cannot be reassigned';end if;
 if existing.id is null then
  if not p_active then raise exception using errcode='22023',message='Missing link';end if;
  insert into public.nutritrack_links(organization_id,client_id,source_subject,created_by) values(p_org,p_client,btrim(p_subject),auth.uid()) returning id into result;
 else update public.nutritrack_links set active=p_active where id=existing.id;result:=existing.id;end if;
 insert into app_private.foundation_events(organization_id,client_id,actor_id,subject_id,action) values(p_org,p_client,auth.uid(),result,case when p_active then 'nutritrack_link_enabled' else 'nutritrack_link_revoked' end);
 return result;
end;$$;
create function public.aura_nutritrack_link_save(p_org uuid,p_client uuid,p_subject text,p_active boolean) returns uuid language sql security invoker set search_path='' as $$select app_private.nutritrack_link_save(p_org,p_client,p_subject,p_active);$$;
create function app_private.nutritrack_context(p_org uuid,p_client uuid,p_keys text[]) returns jsonb
language plpgsql stable security definer set search_path='' as $$declare link public.nutritrack_links%rowtype;begin
 if auth.uid() is null or not app_private.can_access_client(p_org,p_client,'profile',false) or not app_private.can_access_client(p_org,p_client,'assessments',false) then raise exception using errcode='42501',message='Access denied';end if;
 if cardinality(p_keys)>50 then raise exception using errcode='22023',message='Too many keys';end if;
 select * into link from public.nutritrack_links where organization_id=p_org and client_id=p_client;
 return jsonb_build_object('link',case when link.id is null then null else jsonb_build_object('id',link.id,'source_subject',link.source_subject,'active',link.active) end,
 'can_manage',app_private.can_manage_access(p_org) and app_private.can_access_client(p_org,p_client,'assessments',true),
 'records',coalesce((select jsonb_agg(jsonb_build_object('source_record_id',r.source_record_id,'revision',r.revision,'content',r.content,'superseded',a.superseded_at is not null)) from app_private.nutritrack_records r join public.assessments a on a.id=r.assessment_id where r.link_id=link.id and r.source_record_id=any(p_keys)),'[]'::jsonb));
end;$$;
create function public.aura_nutritrack_context(p_org uuid,p_client uuid,p_keys text[] default null) returns jsonb language sql stable security invoker set search_path='' as $$select app_private.nutritrack_context(p_org,p_client,p_keys);$$;
create function app_private.nutritrack_import(p_org uuid,p_client uuid,p_link uuid,p_records jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare link public.nutritrack_links%rowtype;r jsonb;content jsonb;existing app_private.nutritrack_records%rowtype;
 key text;day date;w numeric;h numeric;wa numeric;expected bigint;assessment uuid;next_revision bigint;result jsonb:='[]'::jsonb;old public.assessments%rowtype;
begin
 if auth.uid() is null then raise exception using errcode='42501',message='Access denied';end if;
 perform 1 from public.organizations where id=p_org for update;
 if not app_private.can_access_client(p_org,p_client,'profile',false) or not app_private.can_access_client(p_org,p_client,'assessments',true) then raise exception using errcode='42501',message='Access denied';end if;
 perform 1 from public.clients where id=p_client and organization_id=p_org for update;
 if exists(select 1 from public.clients where id=p_client and organization_id=p_org and archived_at is not null) then raise exception using errcode='23514',message='Archived client';end if;
 select * into link from public.nutritrack_links where id=p_link and organization_id=p_org and client_id=p_client and active;
 if link.id is null then raise exception using errcode='42501',message='Link unavailable';end if;
 if p_records is null or jsonb_typeof(p_records)<>'array' then raise exception using errcode='22023',message='Invalid batch';end if;
 if jsonb_array_length(p_records) not between 1 and 50 or octet_length(p_records::text)>64000 then raise exception using errcode='22023',message='Invalid batch size';end if;
 if (select count(distinct x->>'source_record_id') from jsonb_array_elements(p_records) x)<>jsonb_array_length(p_records) then raise exception using errcode='22023',message='Duplicate keys';end if;
 for r in select * from jsonb_array_elements(p_records) loop
  if jsonb_typeof(r)<>'object' then raise exception using errcode='22023',message='Invalid record';end if;
  if exists(select 1 from jsonb_object_keys(r) k where k not in ('source_record_id','observed_on','weight_kg','height_cm','waist_cm','expected_revision')) then raise exception using errcode='22023',message='Unknown field';end if;
  key:=r->>'source_record_id';
  if key is null or length(key) not between 1 and 80 or jsonb_typeof(r->'source_record_id') is distinct from 'string' or jsonb_typeof(r->'observed_on') is distinct from 'string' or (r->>'observed_on') !~ '^\d{4}-\d{2}-\d{2}$' or jsonb_typeof(r->'expected_revision') is distinct from 'number' then raise exception using errcode='22023',message='Invalid source identity';end if;
  if exists(select 1 from jsonb_each(r) e where e.key in ('weight_kg','height_cm','waist_cm') and jsonb_typeof(e.value) not in ('number','null')) then raise exception using errcode='22023',message='Invalid metric type';end if;
  day:=(r->>'observed_on')::date;w:=(r->>'weight_kg')::numeric;h:=(r->>'height_cm')::numeric;wa:=(r->>'waist_cm')::numeric;
  if (r->>'expected_revision') !~ '^[0-9]+$' or day<'2000-01-01'::date or day>app_private.business_today() or not app_private.valid_metrics(w,h,wa) then raise exception using errcode='22023',message='Invalid source measurements';end if;
  expected:=(r->>'expected_revision')::bigint;
  content:=jsonb_build_object('observed_on',day,'weight_kg',w,'height_cm',h,'waist_cm',wa);
  select * into existing from app_private.nutritrack_records where link_id=p_link and source_record_id=key;
  if existing.assessment_id is not null and existing.content=content then
   result:=result||jsonb_build_array(jsonb_build_object('source_record_id',key,'status','duplicate','revision',existing.revision));continue;
  end if;
  if expected<>coalesce(existing.revision,0) then raise exception using errcode='PT409',message='Source revision conflict';end if;
  next_revision:=expected+1;
  if existing.assessment_id is null then
   assessment:=app_private.assessment_create(p_org,p_client,day,w,h,wa);
  else
   select * into old from public.assessments where id=existing.assessment_id;
   if old.superseded_at is not null then raise exception using errcode='PT409',message='Local correction requires review';end if;
   assessment:=app_private.assessment_correct(p_org,old.id,old.revision,day,w,h,wa,'NutriTrack source update');
  end if;
  update public.assessments set source_system='nutritrack',source_link_id=p_link,source_record_id=key,source_revision=next_revision where id=assessment;
  insert into app_private.nutritrack_records(link_id,source_record_id,revision,assessment_id,content,updated_by) values(p_link,key,next_revision,assessment,content,auth.uid())
  on conflict(link_id,source_record_id) do update set revision=excluded.revision,assessment_id=excluded.assessment_id,content=excluded.content,updated_by=excluded.updated_by,updated_at=statement_timestamp();
  insert into app_private.foundation_events(organization_id,client_id,actor_id,subject_id,action) values(p_org,p_client,auth.uid(),assessment,'nutritrack_measurement_imported');
  result:=result||jsonb_build_array(jsonb_build_object('source_record_id',key,'status',case when expected=0 then 'created' else 'updated' end,'revision',next_revision));
 end loop;
 return result;
end;$$;
create function public.aura_nutritrack_import(p_org uuid,p_client uuid,p_link uuid,p_records jsonb) returns jsonb language sql security invoker set search_path='' as $$select app_private.nutritrack_import(p_org,p_client,p_link,p_records);$$;
revoke all on function app_private.nutritrack_link_save(uuid,uuid,text,boolean),public.aura_nutritrack_link_save(uuid,uuid,text,boolean),app_private.nutritrack_context(uuid,uuid,text[]),public.aura_nutritrack_context(uuid,uuid,text[]),app_private.nutritrack_import(uuid,uuid,uuid,jsonb),public.aura_nutritrack_import(uuid,uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function app_private.nutritrack_link_save(uuid,uuid,text,boolean),public.aura_nutritrack_link_save(uuid,uuid,text,boolean),app_private.nutritrack_context(uuid,uuid,text[]),public.aura_nutritrack_context(uuid,uuid,text[]),app_private.nutritrack_import(uuid,uuid,uuid,jsonb),public.aura_nutritrack_import(uuid,uuid,uuid,jsonb) to authenticated;

create or replace function app_private.assessment_correct(p_org uuid,p_assessment uuid,p_revision bigint,p_date date,p_weight numeric,p_height numeric,p_waist numeric,p_reason text) returns uuid
language plpgsql security definer set search_path='' as $fn$ declare a public.assessments%rowtype;new_id uuid;begin
 if auth.uid() is null then raise exception using errcode='42501',message='Access denied';end if;
perform 1 from public.organizations o where o.id=p_org for update; select * into a from public.assessments where id=p_assessment and organization_id=p_org for update;
 if a.id is null or not app_private.can_access_client(p_org,a.client_id,'assessments',true) then raise exception using errcode='42501',message='Access denied';end if;
 if p_reason is null or length(trim(p_reason)) not between 5 and 500 or p_date is null or not app_private.valid_metrics(p_weight,p_height,p_waist) then raise exception using errcode='22023',message='Invalid correction';end if;
 if p_revision is null or p_revision<>a.revision or a.superseded_at is not null then raise exception using errcode='PT409',message='Revision conflict';end if;
 insert into public.assessments(organization_id,client_id,recorded_by,assessed_on,weight_kg,height_cm,waist_cm,note,supersedes_id,source_system,source_link_id,source_record_id,source_revision)
 values(p_org,a.client_id,auth.uid(),p_date,p_weight,p_height,p_waist,a.note,a.id,a.source_system,a.source_link_id,a.source_record_id,a.source_revision) returning id into new_id;
 update public.assessments set superseded_at=statement_timestamp(),student_visible=false,revision=revision+1 where id=a.id;
 insert into app_private.assessment_corrections(assessment_id,organization_id,actor_id,reason) values(new_id,p_org,auth.uid(),trim(p_reason));
 insert into app_private.foundation_events(organization_id,client_id,actor_id,subject_id,action) values(p_org,a.client_id,auth.uid(),new_id,'assessment_corrected');return new_id;end; $fn$;

create or replace function app_private.client_timeline(p_org uuid,p_client uuid,p_from date,p_to date,p_kind text,p_before timestamptz,p_key text)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;today date:=app_private.business_today();
begin
 if auth.uid() is null or not app_private.can_access_client(p_org,p_client,'profile',false) then raise exception using errcode='42501',message='Access denied';end if;
 if p_kind is null or p_kind not in ('all','assessment','followup','objective','appointment')
 or (p_from is not null and (p_from<'2000-01-01'::date or p_from>today))
 or (p_to is not null and (p_to>today or p_to<'2000-01-01'::date))
 or (p_from is not null and p_to is not null and p_from>p_to)
 or (p_before is null)<>(p_key is null) or (p_key is not null and (length(p_key)>60 or p_key !~ '^(assessment|followup|objective|appointment):[0-9a-f-]{36}$'))
 then raise exception using errcode='22023',message='Invalid timeline filter';end if;
 with events as (
  select 'assessment:'||a.id as event_key,'assessment'::text kind,a.id record_id,
  a.assessed_on::timestamp at time zone 'Europe/Lisbon' occurred_at,a.assessed_on occurred_on,'assessment_recorded'::text action,
  jsonb_build_object('source',a.source_system,'source_revision',a.source_revision,'weight_kg',a.weight_kg,'height_cm',a.height_cm,'waist_cm',a.waist_cm) details
  from public.assessments a where a.organization_id=p_org and a.client_id=p_client and a.superseded_at is null and a.assessed_on<=today
  and app_private.can_access_client(p_org,p_client,'assessments',false)
  union all
  select 'followup:'||e.id,'followup',e.client_id,e.created_at,(e.created_at at time zone 'Europe/Lisbon')::date,e.action,
  jsonb_build_object('from_state',e.from_status,'to_state',e.to_status,'revision',e.revision)
  from app_private.care_events e where e.organization_id=p_org and e.client_id=p_client and e.action like 'followup_%'
  and app_private.can_access_client(p_org,p_client,'followup',false)
  union all
  select 'objective:'||e.id,'objective',e.objective_id,e.created_at,(e.created_at at time zone 'Europe/Lisbon')::date,e.action,
  jsonb_build_object('from_state',e.from_state,'to_state',e.to_state,'revision',e.revision)
  from app_private.objective_events e where e.organization_id=p_org and e.client_id=p_client
  and app_private.can_access_client(p_org,p_client,'followup',false)
  union all
  select 'appointment:'||a.id,'appointment',a.id,a.starts_at,(a.starts_at at time zone 'Europe/Lisbon')::date,a.status,
  jsonb_build_object('kind',a.kind,'status',a.status,'ends_at',a.ends_at)
  from public.appointments a where a.organization_id=p_org and a.client_id=p_client
  and app_private.can_access_client(p_org,p_client,'schedule',false)
 ), filtered as(
  select * from events where occurred_on between coalesce(p_from,'2000-01-01'::date) and coalesce(p_to,today)
  and (p_kind='all' or kind=p_kind)
 ), batch as(
  select * from filtered where p_before is null or (occurred_at,event_key)<(p_before,p_key)
  order by occurred_at desc,event_key desc limit 26
 ), page as(select * from batch order by occurred_at desc,event_key desc limit 25)
 select jsonb_build_object('as_of',today,'total',(select count(*) from filtered),'more',(select count(*)>25 from batch),
 'items',coalesce((select jsonb_agg(to_jsonb(p) order by occurred_at desc,event_key desc) from page p),'[]'::jsonb),
 'next',(select jsonb_build_object('before',occurred_at,'key',event_key) from page order by occurred_at,event_key limit 1)) into result;
 return result;
end;$$;
