-- Minimal professional projection. Private event text/actors are never exported.
create function app_private.client_timeline(p_org uuid,p_client uuid,p_from date,p_to date,p_kind text,p_before timestamptz,p_key text)
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
  jsonb_build_object('source','aura','weight_kg',a.weight_kg,'height_cm',a.height_cm,'waist_cm',a.waist_cm) details
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
create function public.aura_client_timeline(p_org uuid,p_client uuid,p_from date default null,p_to date default null,p_kind text default 'all',p_before timestamptz default null,p_key text default null)
returns jsonb language sql stable security invoker set search_path='' as $$select app_private.client_timeline(p_org,p_client,p_from,p_to,p_kind,p_before,p_key);$$;
revoke all on function app_private.client_timeline(uuid,uuid,date,date,text,timestamptz,text),public.aura_client_timeline(uuid,uuid,date,date,text,timestamptz,text) from public,anon,authenticated;
grant execute on function app_private.client_timeline(uuid,uuid,date,date,text,timestamptz,text),public.aura_client_timeline(uuid,uuid,date,date,text,timestamptz,text) to authenticated;
