-- PREPARED candidate: canonical19 + personal access + personal targets.
-- No automatic installer/cloud activation. Read-only, complete or explicit error.
create function app_private.student_nutrition_export(p_org uuid,p_client uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $export$
declare payload jsonb;counts jsonb;result jsonb;row_count bigint;begin
 if not app_private.nutrition_self_allowed(p_org,p_client,false) then
  raise exception using errcode='42501',message='Access denied';
 end if;
 -- STABLE: all queries use the calling statement's MVCC snapshot. No pagination,
 -- time watermark or UUID cursor can omit a concurrent insert/correction.
 with mh as materialized(select h.* from public.nutrition_meals h
   where h.organization_id=p_org and h.client_id=p_client and h.personal_user_id=auth.uid()),
 mv as materialized(select v.* from public.nutrition_meal_versions v join mh on mh.id=v.meal_id),
 mi as materialized(select i.* from public.nutrition_meal_items i join mh on mh.id=i.meal_id),
 mr as materialized(select r.* from app_private.nutrition_requests r join mh on mh.id=r.meal_id
   where r.organization_id=p_org and r.client_id=p_client and r.actor_id=auth.uid()),
 me as materialized(select e.* from app_private.nutrition_events e join mr
   on (mr.organization_id,mr.actor_id,mr.request_id)=(e.organization_id,e.actor_id,e.request_id)),
 th as materialized(select h.* from public.nutrition_personal_targets h
   where h.organization_id=p_org and h.client_id=p_client and h.personal_user_id=auth.uid()),
 tv as materialized(select v.* from public.nutrition_personal_target_versions v join th on th.id=v.target_id),
 tr as materialized(select r.* from app_private.nutrition_personal_target_requests r join th on th.id=r.target_id
   where r.organization_id=p_org and r.client_id=p_client and r.actor_id=auth.uid()),
 c as(select jsonb_build_object('meals',(select count(*) from mh),'mealVersions',(select count(*) from mv),
   'items',(select count(*) from mi),'mealRequests',(select count(*) from mr),'mealEvents',(select count(*) from me),
   'targets',(select count(*) from th),'targetVersions',(select count(*) from tv),'targetRequests',(select count(*) from tr)) n)
 select n,(select sum(value::bigint) from jsonb_each_text(n)),
 case when (select sum(value::bigint) from jsonb_each_text(n))<=20000 then jsonb_build_object(
  'meals',coalesce((select jsonb_agg(to_jsonb(h) order by id) from mh h),'[]'),
  'mealVersions',coalesce((select jsonb_agg(to_jsonb(v) order by meal_id,revision) from mv v),'[]'),
  'items',coalesce((select jsonb_agg(to_jsonb(i) order by meal_id,revision,position) from mi i),'[]'),
  'mealRequests',coalesce((select jsonb_agg(to_jsonb(r) order by meal_id,revision,request_id) from mr r),'[]'),
  'mealEvents',coalesce((select jsonb_agg(to_jsonb(e) order by meal_id,revision,request_id) from me e),'[]'),
  'targets',coalesce((select jsonb_agg(to_jsonb(h) order by id) from th h),'[]'),
  'targetVersions',coalesce((select jsonb_agg(to_jsonb(v) order by target_id,revision) from tv v),'[]'),
  'targetRequests',coalesce((select jsonb_agg(to_jsonb(r) order by target_id,revision,request_id) from tr r),'[]')) end
 into counts,row_count,payload from c;
 if row_count>20000 then raise exception using errcode='54000',message='Complete private export exceeds interactive limit; request assisted export';end if;
 result:=jsonb_build_object('format','aura.private-nutrition.v1','complete',true,'generatedAt',statement_timestamp(),
   'scope',jsonb_build_object('organizationId',p_org,'clientId',p_client,'userId',auth.uid()),'counts',counts,'data',payload,
   'sha256',encode(sha256(convert_to(payload::text,'UTF8')),'hex'));
 if octet_length(result::text)>8388608 then raise exception using errcode='54000',message='Complete private export exceeds size limit; request assisted export';end if;
 return result;
end;$export$;
create function public.aura_student_nutrition_export(p_org uuid,p_client uuid) returns jsonb
language sql stable security invoker set search_path='' as $export$
 select app_private.student_nutrition_export(p_org,p_client);$export$;
revoke all on function app_private.student_nutrition_export(uuid,uuid),public.aura_student_nutrition_export(uuid,uuid) from public,anon,authenticated;
grant execute on function app_private.student_nutrition_export(uuid,uuid),public.aura_student_nutrition_export(uuid,uuid) to authenticated;
