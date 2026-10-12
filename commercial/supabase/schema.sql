-- Run in a NEW Supabase project, not in the legacy NutriTrack database.
create extension if not exists pgcrypto;
create table public.organizations (id uuid primary key default gen_random_uuid(), name text not null check(length(trim(name)) between 2 and 160), created_at timestamptz not null default now());
create table public.organization_members (organization_id uuid not null references public.organizations(id) on delete cascade, user_id uuid not null references auth.users(id) on delete cascade, role text not null check(role in ('owner','admin','coach')), created_at timestamptz not null default now(), primary key(organization_id,user_id));
create table public.clients (id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade, full_name text not null check(length(trim(full_name)) between 2 and 160), created_at timestamptz not null default now());
create index clients_org_created_idx on public.clients(organization_id,created_at desc);
create index members_user_idx on public.organization_members(user_id,organization_id);

-- Deliberately no public signup-to-tenant or client write policies yet.
-- Provision organizations/members through trusted administrative workflow only.
create schema if not exists app_private;
revoke all on schema app_private from public, anon, authenticated;
create or replace function app_private.is_member(org uuid) returns boolean language sql security definer stable set search_path='' as $$
  select exists(select 1 from public.organization_members m where m.organization_id=org and m.user_id=(select auth.uid()));
$$;
revoke all on function app_private.is_member(uuid) from public, anon;
grant usage on schema app_private to authenticated;
grant execute on function app_private.is_member(uuid) to authenticated;

alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.clients enable row level security;
revoke all on public.organizations, public.organization_members, public.clients from anon, authenticated;
grant select on public.organizations, public.organization_members, public.clients to authenticated;
create policy org_read on public.organizations for select to authenticated using (app_private.is_member(id));
create policy member_read on public.organization_members for select to authenticated using (user_id=(select auth.uid()));
create policy client_read on public.clients for select to authenticated using (app_private.is_member(organization_id));
-- No INSERT/UPDATE/DELETE rights or RLS policies for the browser at this stage.
