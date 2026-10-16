-- Read-only operational queue. Invoker rights preserve RLS and current capabilities.
create index objectives_due_idx on public.client_objectives(organization_id,due_on,client_id,id) where state='active' and due_on is not null;
create function public.aura_daily_priorities(p_org uuid,p_kind text default 'all',p_search text default '',p_offset integer default 0)
returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare result jsonb;today date:=app_private.business_today();
begin
 if auth.uid() is null or not app_private.is_member(p_org) then raise exception using errcode='42501',message='Access denied';end if;
 if p_kind is null or p_kind not in ('all','session','review','objective','assessment') or p_search is null or length(p_search)>100 or p_offset is null or p_offset<0 or p_offset>1000000 then raise exception using errcode='22023',message='Invalid queue filter';end if;
 with active as materialized (
  select c.id,c.full_name from public.clients c where c.organization_id=p_org and c.archived_at is null
  and app_private.can_access_client(p_org,c.id,'profile',false)
  and position(lower(btrim(p_search)) in lower(c.full_name))>0
 ), queue as (
  select 'session'::text kind,a.id,c.id client_id,c.full_name,(a.starts_at at time zone 'Europe/Lisbon')::date due_on,a.starts_at,'Marcação agendada'::text label
  from public.appointments a join active c on c.id=a.client_id where a.organization_id=p_org and a.status='scheduled'
  and a.starts_at>=today::timestamp at time zone 'Europe/Lisbon' and a.starts_at<(today+1)::timestamp at time zone 'Europe/Lisbon'
  and app_private.can_access_client(p_org,c.id,'schedule',false)
  union all
  select 'review',c.id,c.id,c.full_name,f.next_review,null::timestamptz,'Revisão pendente'
  from public.client_followups f join active c on c.id=f.client_id where f.organization_id=p_org and f.status='active' and f.next_review<=today
  union all
  select 'objective',o.id,c.id,c.full_name,o.due_on,null::timestamptz,o.title
  from public.client_objectives o join active c on c.id=o.client_id where o.organization_id=p_org and o.state='active' and o.due_on<=today
  union all
  select 'assessment',c.id,c.id,c.full_name,last.assessed_on,null::timestamptz,case when last.assessed_on is null then 'Sem avaliação' else 'Avaliação há mais de 30 dias' end
  from active c left join lateral(select a.assessed_on from public.assessments a where a.organization_id=p_org and a.client_id=c.id and a.superseded_at is null and a.assessed_on<=today order by a.assessed_on desc,a.id desc limit 1) last on true
  where app_private.can_access_client(p_org,c.id,'assessments',false) and (last.assessed_on is null or last.assessed_on<today-30)
 ), filtered as(select * from queue where p_kind='all' or kind=p_kind), page as(
  select * from filtered order by due_on asc nulls first,starts_at asc nulls last,kind,id limit 25 offset p_offset
 ) select jsonb_build_object('as_of',today,'total',(select count(*) from filtered),'counts',jsonb_build_object(
 'session',(select count(*) from queue where kind='session'),'review',(select count(*) from queue where kind='review'),
 'objective',(select count(*) from queue where kind='objective'),'assessment',(select count(*) from queue where kind='assessment')),
 'items',coalesce((select jsonb_agg(to_jsonb(p) order by due_on asc nulls first,starts_at asc nulls last,kind,id) from page p),'[]'::jsonb)) into result;
 return result;
end;$$;
revoke all on function public.aura_daily_priorities(uuid,text,text,integer) from public,anon,authenticated;
grant execute on function public.aura_daily_priorities(uuid,text,text,integer) to authenticated;
