-- Application version conflicts are HTTP 409, not serialization failures.
create or replace function app_private.client_change(p_org uuid,p_client uuid,p_name text,p_archived boolean,p_revision bigint)
returns bigint language plpgsql security definer set search_path='' as $$
declare v_client public.clients%rowtype;v_role text;v_archived timestamptz;v_revision bigint;
begin
 if auth.uid() is null then raise exception 'Access denied' using errcode='42501';end if;
 perform 1 from public.organizations where id=p_org for update;
 select role into v_role from public.organization_members where organization_id=p_org and user_id=auth.uid();
 if v_role is null then raise exception 'Access denied' using errcode='42501';end if;
 select * into v_client from public.clients where id=p_client and organization_id=p_org for update;
 if v_client.id is null then raise exception 'Access denied' using errcode='42501';end if;
 if p_name is null or length(trim(p_name)) not between 2 and 160 or p_archived is null or p_revision is null then
 raise exception 'Invalid client data' using errcode='22023';end if;
 if p_revision<>v_client.revision then raise exception 'Client changed; reload before saving' using errcode='PT409';end if;
 if p_archived<>(v_client.archived_at is not null) and v_role not in ('owner','admin') then
 raise exception 'Access denied' using errcode='42501';end if;
 if trim(p_name)=v_client.full_name and p_archived=(v_client.archived_at is not null) then return v_client.revision;end if;
 v_archived:=case when not p_archived then null else coalesce(v_client.archived_at,now()) end;
 update public.clients set full_name=trim(p_name),archived_at=v_archived where id=p_client and organization_id=p_org returning revision into v_revision;
 return v_revision;
end $$;
