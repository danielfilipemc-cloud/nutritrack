-- Phase 1A. Additive; deliberately no blanket grant/backfill of sensitive access.
create table public.staff_capabilities (
 organization_id uuid not null,user_id uuid not null,module text not null check(module in ('profile','assessments','followup','schedule')),
 can_write boolean not null default false, primary key(organization_id,user_id,module),
 foreign key(organization_id,user_id) references public.organization_members(organization_id,user_id) on delete cascade
);
create table public.client_assignments (
 organization_id uuid not null,client_id uuid not null,user_id uuid not null,
 primary key(organization_id,client_id,user_id),
 foreign key(client_id,organization_id) references public.clients(id,organization_id) on delete cascade,
 foreign key(organization_id,user_id) references public.organization_members(organization_id,user_id) on delete cascade
);
create index assignments_user_idx on public.client_assignments(user_id,organization_id,client_id);
create table public.client_users (
 organization_id uuid not null,client_id uuid not null,user_id uuid not null references auth.users(id) on delete cascade,
 linked_at timestamptz not null default now(),revoked_at timestamptz,
 primary key(organization_id,client_id),unique(organization_id,user_id),
 foreign key(client_id,organization_id) references public.clients(id,organization_id) on delete cascade
);
create table app_private.foundation_events (
 id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id),
 client_id uuid,actor_id uuid,subject_id uuid,action text not null,created_at timestamptz not null default statement_timestamp()
);
create table app_private.student_invitations (
 id uuid primary key default gen_random_uuid(),organization_id uuid not null,client_id uuid not null,
 email text not null check(email=lower(trim(email)) and length(email) between 3 and 254),
 token_hash text not null unique,created_by uuid not null references auth.users(id),
 created_at timestamptz not null default now(),expires_at timestamptz not null default now()+interval '7 days',
 revoked_at timestamptz,accepted_at timestamptz,
 foreign key(client_id,organization_id) references public.clients(id,organization_id) on delete cascade
);
alter table public.staff_capabilities enable row level security;
alter table public.client_assignments enable row level security;
alter table public.client_users enable row level security;
alter table app_private.foundation_events enable row level security;
alter table app_private.student_invitations enable row level security;
alter table app_private.aura_migrations enable row level security;
revoke all on public.staff_capabilities,public.client_assignments,public.client_users,app_private.foundation_events,app_private.student_invitations from public,anon,authenticated;
grant select on public.staff_capabilities,public.client_assignments,public.client_users to authenticated;

create function app_private.can_manage_access(p_org uuid) returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(select 1 from public.organization_members where organization_id=p_org and user_id=auth.uid() and role in ('owner','admin'));
$$;
create function app_private.is_student(p_org uuid,p_client uuid) returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(select 1 from public.client_users where organization_id=p_org and client_id=p_client and user_id=auth.uid() and revoked_at is null);
$$;
create function app_private.can_access_client(p_org uuid,p_client uuid,p_module text,p_write boolean default false) returns boolean
language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(select 1 from public.clients where organization_id=p_org and id=p_client)
 and app_private.is_member(p_org) and (
 (p_module in ('profile','schedule') and app_private.can_manage_access(p_org)) or
 exists(select 1 from public.client_assignments a join public.staff_capabilities c
 on c.organization_id=a.organization_id and c.user_id=a.user_id
 where a.organization_id=p_org and a.client_id=p_client and a.user_id=auth.uid() and c.module=p_module and (not p_write or c.can_write)));
$$;
revoke all on function app_private.can_manage_access(uuid),app_private.is_student(uuid,uuid),app_private.can_access_client(uuid,uuid,text,boolean) from public,anon,authenticated;
grant execute on function app_private.can_manage_access(uuid),app_private.is_student(uuid,uuid),app_private.can_access_client(uuid,uuid,text,boolean) to authenticated;
create policy capabilities_read on public.staff_capabilities for select to authenticated using(user_id=auth.uid() or app_private.can_manage_access(organization_id));
create policy assignments_read on public.client_assignments for select to authenticated using(user_id=auth.uid() or app_private.can_manage_access(organization_id));
create policy client_users_read on public.client_users for select to authenticated using((user_id=auth.uid() and revoked_at is null) or app_private.can_manage_access(organization_id));
drop policy client_read on public.clients;
create policy client_read on public.clients for select to authenticated using(app_private.can_access_client(organization_id,id,'profile',false) or app_private.is_student(organization_id,id));
drop policy clients_insert on public.clients;
create policy clients_insert on public.clients for insert to authenticated with check(app_private.can_manage_access(organization_id));
drop policy assessments_read on public.assessments;
create policy assessments_read on public.assessments for select to authenticated using(app_private.can_access_client(organization_id,client_id,'assessments',false));
drop policy assessments_insert on public.assessments;
create policy assessments_insert on public.assessments for insert to authenticated with check(app_private.can_access_client(organization_id,client_id,'assessments',true) and recorded_by=auth.uid());
drop policy followups_read on public.client_followups;
create policy followups_read on public.client_followups for select to authenticated using(app_private.can_access_client(organization_id,client_id,'followup',false));
drop policy appointments_read on public.appointments;
create policy appointments_read on public.appointments for select to authenticated using(app_private.can_access_client(organization_id,client_id,'schedule',false) or app_private.is_student(organization_id,client_id));
create function app_private.capability_save(p_org uuid,p_user uuid,p_module text,p_enabled boolean,p_write boolean) returns void
language plpgsql security definer set search_path='' as $fn$ begin
 if auth.uid() is null then raise exception using errcode='42501',message='Access denied';end if;
perform 1 from public.organizations o where o.id=p_org for update; if not app_private.can_manage_access(p_org) then raise exception using errcode='42501',message='Access denied';end if;
 if not exists(select 1 from public.organization_members where organization_id=p_org and user_id=auth.uid() and role='owner')
 then raise exception using errcode='42501',message='Only owner can grant competencies';end if;
 if p_enabled is null or p_write is null or p_module is null or p_module not in ('profile','assessments','followup','schedule')
 or not exists(select 1 from public.organization_members where organization_id=p_org and user_id=p_user)
 then raise exception using errcode='22023',message='Invalid capability';end if;
 if p_enabled then insert into public.staff_capabilities values(p_org,p_user,p_module,p_write)
 on conflict(organization_id,user_id,module) do update set can_write=excluded.can_write;
 else delete from public.staff_capabilities where organization_id=p_org and user_id=p_user and module=p_module;end if;
 insert into app_private.foundation_events(organization_id,actor_id,subject_id,action) values(p_org,auth.uid(),p_user,case when p_enabled then 'capability_granted:'||p_module else 'capability_revoked:'||p_module end);
end; $fn$;
create function public.aura_capability_save(p_org uuid,p_user uuid,p_module text,p_enabled boolean,p_write boolean) returns void
language sql security invoker set search_path='' as $fn$ select * from app_private.capability_save(p_org,p_user,p_module,p_enabled,p_write); $fn$;
revoke all on function app_private.capability_save(uuid,uuid,text,boolean,boolean),public.aura_capability_save(uuid,uuid,text,boolean,boolean) from public,anon,authenticated;
grant execute on function app_private.capability_save(uuid,uuid,text,boolean,boolean),public.aura_capability_save(uuid,uuid,text,boolean,boolean) to authenticated;
create function app_private.assignment_save(p_org uuid,p_client uuid,p_user uuid,p_enabled boolean) returns void
language plpgsql security definer set search_path='' as $fn$ begin
 if auth.uid() is null then raise exception using errcode='42501',message='Access denied';end if;
perform 1 from public.organizations o where o.id=p_org for update; if not app_private.can_manage_access(p_org) then raise exception using errcode='42501',message='Access denied';end if;
 if p_enabled is null or not exists(select 1 from public.clients where id=p_client and organization_id=p_org)
 or not exists(select 1 from public.organization_members where user_id=p_user and organization_id=p_org)
 then raise exception using errcode='22023',message='Invalid assignment';end if;
 if p_enabled then insert into public.client_assignments values(p_org,p_client,p_user) on conflict do nothing;
 else delete from public.client_assignments where organization_id=p_org and client_id=p_client and user_id=p_user;end if;
 insert into app_private.foundation_events(organization_id,client_id,actor_id,subject_id,action)
 values(p_org,p_client,auth.uid(),p_user,case when p_enabled then 'assignment_granted' else 'assignment_revoked' end);
end; $fn$;
create function public.aura_assignment_save(p_org uuid,p_client uuid,p_user uuid,p_enabled boolean) returns void
language sql security invoker set search_path='' as $fn$ select * from app_private.assignment_save(p_org,p_client,p_user,p_enabled); $fn$;
revoke all on function app_private.assignment_save(uuid,uuid,uuid,boolean),public.aura_assignment_save(uuid,uuid,uuid,boolean) from public,anon,authenticated;
grant execute on function app_private.assignment_save(uuid,uuid,uuid,boolean),public.aura_assignment_save(uuid,uuid,uuid,boolean) to authenticated;
create function app_private.student_invite_create(p_org uuid,p_client uuid,p_email text) returns text
language plpgsql security definer set search_path='' as $fn$ declare token text;begin
 if auth.uid() is null then raise exception using errcode='42501',message='Access denied';end if;
perform 1 from public.organizations o where o.id=p_org for update; if not app_private.can_manage_access(p_org) then raise exception using errcode='42501',message='Access denied';end if;
 if not exists(select 1 from public.clients where id=p_client and organization_id=p_org and archived_at is null)
 or p_email is null or length(trim(p_email))>254 or trim(p_email) !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'
 then raise exception using errcode='22023',message='Invalid invitation';end if;
 if (select count(*) from app_private.student_invitations where organization_id=p_org and created_at>now()-interval '1 hour')>=50
 then raise exception using errcode='22023',message='Invitation limit reached';end if;
 update app_private.student_invitations set revoked_at=now() where organization_id=p_org and client_id=p_client and accepted_at is null and revoked_at is null;
 token:=replace(gen_random_uuid()::text||gen_random_uuid()::text,'-','');
 insert into app_private.student_invitations(organization_id,client_id,email,token_hash,created_by)
 values(p_org,p_client,lower(trim(p_email)),encode(sha256(convert_to(token,'UTF8')),'hex'),auth.uid());
 insert into app_private.foundation_events(organization_id,client_id,actor_id,action) values(p_org,p_client,auth.uid(),'student_invited');return token;
end; $fn$;
create function public.aura_student_invite_create(p_org uuid,p_client uuid,p_email text) returns text
language sql security invoker set search_path='' as $fn$ select * from app_private.student_invite_create(p_org,p_client,p_email); $fn$;
revoke all on function app_private.student_invite_create(uuid,uuid,text),public.aura_student_invite_create(uuid,uuid,text) from public,anon,authenticated;
grant execute on function app_private.student_invite_create(uuid,uuid,text),public.aura_student_invite_create(uuid,uuid,text) to authenticated;
create function app_private.student_invite_accept(p_token text) returns uuid
language plpgsql security definer set search_path='' as $fn$ declare invite app_private.student_invitations%rowtype;org uuid;email text;begin
 if auth.uid() is null or p_token is null or p_token !~ '^[0-9a-f]{64}$' then raise exception using errcode='42501',message='Invalid invitation';end if;
 select organization_id into org from app_private.student_invitations where token_hash=encode(sha256(convert_to(p_token,'UTF8')),'hex');
 perform 1 from public.organizations where id=org for update;
 select * into invite from app_private.student_invitations where token_hash=encode(sha256(convert_to(p_token,'UTF8')),'hex') for update;
 select lower(u.email) into email from auth.users u where u.id=auth.uid() and u.email_confirmed_at is not null;
 if invite.id is null or invite.accepted_at is not null or invite.revoked_at is not null or invite.expires_at<=now() or email is null or email<>invite.email
 or not exists(select 1 from public.organization_members where organization_id=org and user_id=invite.created_by and role in ('owner','admin'))
 or not exists(select 1 from public.clients where id=invite.client_id and organization_id=org and archived_at is null)
 then raise exception using errcode='42501',message='Invalid invitation';end if;
 if exists(select 1 from public.client_users where organization_id=org and ((client_id=invite.client_id and user_id<>auth.uid()) or (user_id=auth.uid() and client_id<>invite.client_id)))
 then raise exception using errcode='42501',message='Invalid invitation';end if;
 insert into public.client_users(organization_id,client_id,user_id) values(org,invite.client_id,auth.uid())
 on conflict(organization_id,client_id) do update set revoked_at=null,linked_at=now();
 update app_private.student_invitations set accepted_at=now() where id=invite.id;
 insert into app_private.foundation_events(organization_id,client_id,actor_id,action) values(org,invite.client_id,auth.uid(),'student_linked');return invite.client_id;
end; $fn$;
create function public.aura_student_invite_accept(p_token text) returns uuid
language sql security invoker set search_path='' as $fn$ select * from app_private.student_invite_accept(p_token); $fn$;
revoke all on function app_private.student_invite_accept(text),public.aura_student_invite_accept(text) from public,anon,authenticated;
grant execute on function app_private.student_invite_accept(text),public.aura_student_invite_accept(text) to authenticated;
create function app_private.student_revoke(p_org uuid,p_client uuid) returns void
language plpgsql security definer set search_path='' as $fn$ begin if auth.uid() is null then raise exception using errcode='42501',message='Access denied';end if;
perform 1 from public.organizations o where o.id=p_org for update; if not app_private.can_manage_access(p_org) then raise exception using errcode='42501',message='Access denied';end if;
 update public.client_users set revoked_at=now() where organization_id=p_org and client_id=p_client;
 update app_private.student_invitations set revoked_at=now() where organization_id=p_org and client_id=p_client and accepted_at is null;
 insert into app_private.foundation_events(organization_id,client_id,actor_id,action) values(p_org,p_client,auth.uid(),'student_revoked');end; $fn$;
create function public.aura_student_revoke(p_org uuid,p_client uuid) returns void
language sql security invoker set search_path='' as $fn$ select * from app_private.student_revoke(p_org,p_client); $fn$;
revoke all on function app_private.student_revoke(uuid,uuid),public.aura_student_revoke(uuid,uuid) from public,anon,authenticated;
grant execute on function app_private.student_revoke(uuid,uuid),public.aura_student_revoke(uuid,uuid) to authenticated;
create function app_private.client_permissions(p_org uuid,p_client uuid) returns jsonb
language plpgsql security definer set search_path='' as $fn$ begin
 if not app_private.can_access_client(p_org,p_client,'profile',false) then raise exception using errcode='42501',message='Access denied';end if;
 return jsonb_build_object('assessments_read',app_private.can_access_client(p_org,p_client,'assessments',false),'assessments_write',app_private.can_access_client(p_org,p_client,'assessments',true),
 'followup_read',app_private.can_access_client(p_org,p_client,'followup',false),'followup_write',app_private.can_access_client(p_org,p_client,'followup',true),
 'schedule_read',app_private.can_access_client(p_org,p_client,'schedule',false),'schedule_write',app_private.can_access_client(p_org,p_client,'schedule',true));end; $fn$;
create function public.aura_client_permissions(p_org uuid,p_client uuid) returns jsonb
language sql security invoker set search_path='' as $fn$ select * from app_private.client_permissions(p_org,p_client); $fn$;
revoke all on function app_private.client_permissions(uuid,uuid),public.aura_client_permissions(uuid,uuid) from public,anon,authenticated;
grant execute on function app_private.client_permissions(uuid,uuid),public.aura_client_permissions(uuid,uuid) to authenticated;
alter function app_private.client_change(uuid,uuid,text,boolean,bigint) rename to client_change_foundation_base;
revoke all on function app_private.client_change_foundation_base(uuid,uuid,text,boolean,bigint) from public,anon,authenticated;
create function app_private.client_change(p_org uuid,p_client uuid,p_name text,p_archived boolean,p_revision bigint) returns bigint language plpgsql security definer set search_path='' as $$
begin if auth.uid() is null then raise exception using errcode='42501',message='Access denied';end if;
perform 1 from public.organizations o where o.id=p_org for update; if not (app_private.can_access_client(p_org,p_client,'profile',true)) then raise exception using errcode='42501',message='Access denied';end if;
 return app_private.client_change_foundation_base(p_org,p_client,p_name,p_archived,p_revision); end;$$;
revoke all on function app_private.client_change(uuid,uuid,text,boolean,bigint) from public,anon,authenticated;
grant execute on function app_private.client_change(uuid,uuid,text,boolean,bigint) to authenticated;
alter function app_private.followup_save(uuid,uuid,text,text,uuid,date,bigint) rename to followup_save_foundation_base;
revoke all on function app_private.followup_save_foundation_base(uuid,uuid,text,text,uuid,date,bigint) from public,anon,authenticated;
create function app_private.followup_save(p_org uuid,p_client uuid,p_goal text,p_status text,p_responsible uuid,p_review date,p_revision bigint) returns bigint language plpgsql security definer set search_path='' as $$
begin if auth.uid() is null then raise exception using errcode='42501',message='Access denied';end if;
perform 1 from public.organizations o where o.id=p_org for update; if not (app_private.can_access_client(p_org,p_client,'followup',true)) then raise exception using errcode='42501',message='Access denied';end if;
 return app_private.followup_save_foundation_base(p_org,p_client,p_goal,p_status,p_responsible,p_review,p_revision); end;$$;
revoke all on function app_private.followup_save(uuid,uuid,text,text,uuid,date,bigint) from public,anon,authenticated;
grant execute on function app_private.followup_save(uuid,uuid,text,text,uuid,date,bigint) to authenticated;
alter function app_private.appointment_save(uuid,uuid,uuid,uuid,text,text,timestamptz,timestamptz,bigint) rename to appointment_save_foundation_base;
revoke all on function app_private.appointment_save_foundation_base(uuid,uuid,uuid,uuid,text,text,timestamptz,timestamptz,bigint) from public,anon,authenticated;
create function app_private.appointment_save(p_org uuid,p_id uuid,p_client uuid,p_professional uuid,p_kind text,p_status text,p_start timestamptz,p_end timestamptz,p_revision bigint) returns uuid language plpgsql security definer set search_path='' as $$
begin if auth.uid() is null then raise exception using errcode='42501',message='Access denied';end if;
perform 1 from public.organizations o where o.id=p_org for update; if not (app_private.can_access_client(p_org,p_client,'schedule',true)) then raise exception using errcode='42501',message='Access denied';end if;
 return app_private.appointment_save_foundation_base(p_org,p_id,p_client,p_professional,p_kind,p_status,p_start,p_end,p_revision); end;$$;
revoke all on function app_private.appointment_save(uuid,uuid,uuid,uuid,text,text,timestamptz,timestamptz,bigint) from public,anon,authenticated;
grant execute on function app_private.appointment_save(uuid,uuid,uuid,uuid,text,text,timestamptz,timestamptz,bigint) to authenticated;
alter function app_private.client_history(uuid,uuid,integer) rename to client_history_foundation_base;
revoke all on function app_private.client_history_foundation_base(uuid,uuid,integer) from public,anon,authenticated;
create function app_private.client_history(p_org uuid,p_client uuid,p_offset integer) returns table(id uuid,actor_id uuid,action text,revision bigint,created_at timestamptz) language plpgsql security definer set search_path='' as $$
begin if auth.uid() is null then raise exception using errcode='42501',message='Access denied';end if;
perform 1 from public.organizations o where o.id=p_org for update; if not (app_private.can_access_client(p_org,p_client,'profile',false)) then raise exception using errcode='42501',message='Access denied';end if;
 return query select * from app_private.client_history_foundation_base(p_org,p_client,p_offset); end;$$;
revoke all on function app_private.client_history(uuid,uuid,integer) from public,anon,authenticated;
grant execute on function app_private.client_history(uuid,uuid,integer) to authenticated;
alter function app_private.care_history(uuid,uuid,integer) rename to care_history_foundation_base;
revoke all on function app_private.care_history_foundation_base(uuid,uuid,integer) from public,anon,authenticated;
create function app_private.care_history(p_org uuid,p_client uuid,p_offset integer) returns table(id uuid,appointment_id uuid,actor_id uuid,action text,revision bigint,from_status text,to_status text,created_at timestamptz) language plpgsql security definer set search_path='' as $$
begin if auth.uid() is null then raise exception using errcode='42501',message='Access denied';end if;
perform 1 from public.organizations o where o.id=p_org for update; if not (app_private.can_access_client(p_org,p_client,'followup',false) and app_private.can_access_client(p_org,p_client,'schedule',false)) then raise exception using errcode='42501',message='Access denied';end if;
 return query select * from app_private.care_history_foundation_base(p_org,p_client,p_offset); end;$$;
revoke all on function app_private.care_history(uuid,uuid,integer) from public,anon,authenticated;
grant execute on function app_private.care_history(uuid,uuid,integer) to authenticated;
