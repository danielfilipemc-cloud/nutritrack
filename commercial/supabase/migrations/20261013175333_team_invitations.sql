-- Privileged implementations stay in the unexposed app_private schema.
-- Public RPCs are invoker wrappers, authenticated only. No service key in the app.
create table app_private.organization_invitations (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.organizations(id) on delete cascade,
 email text not null check(length(email) between 3 and 254 and email=lower(trim(email))),
 role text not null check(role in ('admin','coach')),
 token_hash text not null unique,
 created_by uuid references auth.users(id) on delete set null,
 created_at timestamptz not null default now(),
 expires_at timestamptz not null default now()+interval '7 days',
 accepted_at timestamptz, accepted_by uuid references auth.users(id) on delete set null,
 revoked_at timestamptz
);
create index invitations_org_created_idx on app_private.organization_invitations(organization_id,created_at desc);
create table app_private.team_events (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.organizations(id) on delete cascade,
 actor_id uuid not null, target_id uuid, action text not null,
 created_at timestamptz not null default now()
);
alter table app_private.organization_invitations enable row level security;
alter table app_private.team_events enable row level security;
revoke all on app_private.organization_invitations,app_private.team_events from public,anon,authenticated;

create function app_private.team_manager(p_org uuid) returns text
language plpgsql security definer set search_path='' as $$
declare v_role text;
begin
 if auth.uid() is null then raise exception 'Access denied' using errcode='42501'; end if;
 -- Serialize all membership and invitation mutations for this establishment.
 perform 1 from public.organizations where id=p_org for update;
 select role into v_role from public.organization_members where organization_id=p_org and user_id=auth.uid();
 if v_role is null or v_role not in ('owner','admin') then raise exception 'Access denied' using errcode='42501'; end if;
 return v_role;
end $$;

create function app_private.team_list(p_org uuid)
returns table(user_id uuid,email text,role text,joined_at timestamptz)
language plpgsql security definer set search_path='' as $$
begin
 perform app_private.team_manager(p_org);
 return query select m.user_id,u.email::text,m.role,m.created_at from public.organization_members m
 join auth.users u on u.id=m.user_id where m.organization_id=p_org order by m.created_at,m.user_id;
end $$;

create function app_private.invitation_list(p_org uuid)
returns table(id uuid,email text,role text,expires_at timestamptz,status text)
language plpgsql security definer set search_path='' as $$
begin
 perform app_private.team_manager(p_org);
 return query select i.id,i.email,i.role,i.expires_at,
 case when i.revoked_at is not null then 'revoked' when i.accepted_at is not null then 'accepted'
 when i.expires_at<=now() then 'expired' else 'pending' end
 from app_private.organization_invitations i where i.organization_id=p_org
 order by i.created_at desc limit 100;
end $$;

create function app_private.invitation_create(p_org uuid,p_email text,p_role text)
returns table(id uuid,token text,expires_at timestamptz)
language plpgsql security definer set search_path='' as $$
declare v_role text;v_token text;v_email text;
begin
 v_role:=app_private.team_manager(p_org);v_email:=lower(trim(p_email));
 if p_role is null or p_role not in ('admin','coach') or (v_role='admin' and p_role<>'coach') then
 raise exception 'Access denied' using errcode='42501'; end if;
 if v_email is null or length(v_email)>254 or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' then
 raise exception 'Invalid email' using errcode='22023'; end if;
 if exists(select 1 from public.organization_members m join auth.users u on u.id=m.user_id
 where m.organization_id=p_org and lower(u.email)=v_email) then
 raise exception 'Already a member' using errcode='22023'; end if;
 if (select count(*) from app_private.organization_invitations where organization_id=p_org and created_at>now()-interval '1 hour')>=50 then
 raise exception 'Invitation limit reached' using errcode='22023'; end if;
 if v_role='admin' and exists(select 1 from app_private.organization_invitations where organization_id=p_org
 and email=v_email and role='admin' and accepted_at is null and revoked_at is null and app_private.organization_invitations.expires_at>now()) then
 raise exception 'Access denied' using errcode='42501'; end if;
 -- Resending revokes prior live links. Never return a stored token or token hash.
 update app_private.organization_invitations set revoked_at=now()
 where organization_id=p_org and email=v_email and accepted_at is null and revoked_at is null;
 v_token:=replace(gen_random_uuid()::text||gen_random_uuid()::text,'-','');
 return query insert into app_private.organization_invitations as i(organization_id,email,role,token_hash,created_by)
 values(p_org,v_email,p_role,encode(sha256(convert_to(v_token,'UTF8')),'hex'),auth.uid())
 returning i.id,v_token,i.expires_at;
 insert into app_private.team_events(organization_id,actor_id,action) values(p_org,auth.uid(),'invite_created');
end $$;

create function app_private.invitation_revoke(p_org uuid,p_invite uuid) returns void
language plpgsql security definer set search_path='' as $$
declare v_role text;v_inv_role text;
begin
 v_role:=app_private.team_manager(p_org);
 select role into v_inv_role from app_private.organization_invitations where id=p_invite and organization_id=p_org;
 if v_inv_role is null or (v_role='admin' and v_inv_role<>'coach') then raise exception 'Access denied' using errcode='42501'; end if;
 update app_private.organization_invitations set revoked_at=now() where id=p_invite and organization_id=p_org and accepted_at is null and revoked_at is null;
 insert into app_private.team_events(organization_id,actor_id,target_id,action) values(p_org,auth.uid(),p_invite,'invite_revoked');
end $$;

create function app_private.invitation_accept(p_token text) returns uuid
language plpgsql security definer set search_path='' as $$
declare v_hash text;v_org uuid;v_inv app_private.organization_invitations%rowtype;v_email text;v_creator_role text;
begin
 if auth.uid() is null or p_token is null or p_token !~ '^[0-9a-f]{64}$' then raise exception 'Invalid invitation' using errcode='42501'; end if;
 v_hash:=encode(sha256(convert_to(p_token,'UTF8')),'hex');
 select organization_id into v_org from app_private.organization_invitations where token_hash=v_hash;
 if v_org is null then raise exception 'Invalid invitation' using errcode='42501'; end if;
 -- Same lock order as create/revoke/manage avoids deadlocks.
 perform 1 from public.organizations where id=v_org for update;
 select * into v_inv from app_private.organization_invitations where token_hash=v_hash for update;
 select lower(email) into v_email from auth.users where id=auth.uid() and email_confirmed_at is not null;
 select role into v_creator_role from public.organization_members where organization_id=v_org and user_id=v_inv.created_by;
 if v_inv.id is null or v_inv.revoked_at is not null or v_inv.accepted_at is not null or v_inv.expires_at<=now()
 or v_email is null or v_email<>v_inv.email or v_creator_role is null or v_creator_role not in ('owner','admin')
 or (v_creator_role='admin' and v_inv.role<>'coach') then raise exception 'Invalid invitation' using errcode='42501'; end if;
 -- An invitation never overwrites or escalates an existing membership.
 insert into public.organization_members(organization_id,user_id,role) values(v_org,auth.uid(),v_inv.role)
 on conflict(organization_id,user_id) do nothing;
 update app_private.organization_invitations set accepted_at=now(),accepted_by=auth.uid() where id=v_inv.id;
 insert into app_private.team_events(organization_id,actor_id,target_id,action) values(v_org,auth.uid(),v_inv.id,'invite_accepted');
 return v_org;
end $$;

create function app_private.team_change(p_org uuid,p_user uuid,p_role text) returns void
language plpgsql security definer set search_path='' as $$
declare v_role text;v_target text;
begin
 v_role:=app_private.team_manager(p_org);
 select role into v_target from public.organization_members where organization_id=p_org and user_id=p_user;
 if v_target is null or v_target='owner' or (p_role is not null and p_role not in ('admin','coach'))
 or (v_role='admin' and (v_target<>'coach' or p_role is not null and p_role<>'coach')) then
 raise exception 'Access denied' using errcode='42501'; end if;
 if p_role is null then delete from public.organization_members where organization_id=p_org and user_id=p_user;
 else update public.organization_members set role=p_role where organization_id=p_org and user_id=p_user; end if;
 insert into app_private.team_events(organization_id,actor_id,target_id,action)
 values(p_org,auth.uid(),p_user,case when p_role is null then 'member_removed' else 'member_role_changed' end);
end $$;

create function public.aura_team_list(p_org uuid) returns table(user_id uuid,email text,role text,joined_at timestamptz)
language sql security invoker set search_path='' as $$select * from app_private.team_list(p_org);$$;
revoke all on function public.aura_team_list(uuid) from public,anon,authenticated;
grant execute on function public.aura_team_list(uuid) to authenticated;
revoke all on function app_private.team_list(uuid) from public,anon,authenticated;
grant execute on function app_private.team_list(uuid) to authenticated;

create function public.aura_invitation_list(p_org uuid) returns table(id uuid,email text,role text,expires_at timestamptz,status text)
language sql security invoker set search_path='' as $$select * from app_private.invitation_list(p_org);$$;
revoke all on function public.aura_invitation_list(uuid) from public,anon,authenticated;
grant execute on function public.aura_invitation_list(uuid) to authenticated;
revoke all on function app_private.invitation_list(uuid) from public,anon,authenticated;
grant execute on function app_private.invitation_list(uuid) to authenticated;

create function public.aura_invitation_create(p_org uuid,p_email text,p_role text) returns table(id uuid,token text,expires_at timestamptz)
language sql security invoker set search_path='' as $$select * from app_private.invitation_create(p_org,p_email,p_role);$$;
revoke all on function public.aura_invitation_create(uuid,text,text) from public,anon,authenticated;
grant execute on function public.aura_invitation_create(uuid,text,text) to authenticated;
revoke all on function app_private.invitation_create(uuid,text,text) from public,anon,authenticated;
grant execute on function app_private.invitation_create(uuid,text,text) to authenticated;

create function public.aura_invitation_revoke(p_org uuid,p_invite uuid) returns void
language sql security invoker set search_path='' as $$select * from app_private.invitation_revoke(p_org,p_invite);$$;
revoke all on function public.aura_invitation_revoke(uuid,uuid) from public,anon,authenticated;
grant execute on function public.aura_invitation_revoke(uuid,uuid) to authenticated;
revoke all on function app_private.invitation_revoke(uuid,uuid) from public,anon,authenticated;
grant execute on function app_private.invitation_revoke(uuid,uuid) to authenticated;

create function public.aura_invitation_accept(p_token text) returns uuid
language sql security invoker set search_path='' as $$select * from app_private.invitation_accept(p_token);$$;
revoke all on function public.aura_invitation_accept(text) from public,anon,authenticated;
grant execute on function public.aura_invitation_accept(text) to authenticated;
revoke all on function app_private.invitation_accept(text) from public,anon,authenticated;
grant execute on function app_private.invitation_accept(text) to authenticated;

create function public.aura_team_change(p_org uuid,p_user uuid,p_role text) returns void
language sql security invoker set search_path='' as $$select * from app_private.team_change(p_org,p_user,p_role);$$;
revoke all on function public.aura_team_change(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.aura_team_change(uuid,uuid,text) to authenticated;
revoke all on function app_private.team_change(uuid,uuid,text) from public,anon,authenticated;
grant execute on function app_private.team_change(uuid,uuid,text) to authenticated;

revoke all on function app_private.team_manager(uuid) from public,anon,authenticated;
-- team_manager is internal: only the owner of the privileged functions invokes it.
