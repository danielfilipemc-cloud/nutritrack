-- Read-only dashboard. SECURITY INVOKER retains table RLS; membership is also explicit.
create or replace function public.aura_dashboard(p_org uuid)
returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare result jsonb;
begin
 if auth.uid() is null or not app_private.is_member(p_org) then
  raise exception using errcode='42501',message='Organization access denied';
 end if;
 with active as (
  select c.id,c.full_name,last_assessment.assessed_on
  from public.clients c
  left join lateral (
   select a.assessed_on from public.assessments a
   where a.organization_id=p_org and a.client_id=c.id and a.assessed_on<=current_date
   order by a.assessed_on desc,a.id desc limit 1
  ) last_assessment on true
  where c.organization_id=p_org and c.archived_at is null
 ), pending as (
  select * from active where assessed_on is null or assessed_on<current_date-30
 ), recent as (
  select a.id,a.client_id,c.full_name,a.assessed_on,c.archived_at
  from public.assessments a join public.clients c
   on c.id=a.client_id and c.organization_id=a.organization_id
  where a.organization_id=p_org and a.assessed_on between current_date-29 and current_date
  order by a.assessed_on desc,a.id desc limit 10
 )
 select jsonb_build_object(
  'as_of',current_date,
  'active_clients',(select count(*) from active),
  'archived_clients',(select count(*) from public.clients where organization_id=p_org and archived_at is not null),
  'assessments_30_days',(select count(*) from public.assessments where organization_id=p_org and assessed_on between current_date-29 and current_date),
  'pending_clients',(select count(*) from pending),
  'recent',coalesce((select jsonb_agg(to_jsonb(r) order by r.assessed_on desc,r.id desc) from recent r),'[]'::jsonb),
  'pending',coalesce((select jsonb_agg(to_jsonb(p) order by p.assessed_on asc nulls first,p.id) from
   (select * from pending order by assessed_on asc nulls first,id limit 10) p),'[]'::jsonb)
 ) into result;
 return result;
end;
$$;
revoke all on function public.aura_dashboard(uuid) from public,anon;
grant execute on function public.aura_dashboard(uuid) to authenticated;

-- Branding authorship and time must come from the authenticated database context.
create or replace function app_private.stamp_branding()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if TG_OP='UPDATE' and new.organization_id<>old.organization_id then
  raise exception using errcode='42501',message='Brand organization is immutable';
 end if;
 new.updated_at:=statement_timestamp();
 new.updated_by:=auth.uid();
 return new;
end;
$$;
revoke all on function app_private.stamp_branding() from public,anon,authenticated;
create trigger aura_branding_stamp before insert or update on public.organization_branding
for each row execute function app_private.stamp_branding();
