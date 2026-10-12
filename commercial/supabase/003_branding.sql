-- AURA Business: per-tenant white-label settings. Run after 001 schema.
create table public.organization_branding (
 organization_id uuid primary key references public.organizations(id) on delete cascade,
 display_name text not null check(length(trim(display_name)) between 2 and 100),
 primary_color text not null default '#1d856e' check(primary_color ~ '^#[0-9a-fA-F]{6}$'),
 logo_url text,
 updated_at timestamptz not null default now(),
 updated_by uuid references auth.users(id),
 constraint logo_url_safe check(logo_url is null or (length(logo_url) <= 1000 and logo_url ~ '^https://[A-Za-z0-9._~/?#%&=+-]+$'))
);
alter table public.organization_branding enable row level security;
revoke all on public.organization_branding from anon,authenticated;
grant select,insert,update on public.organization_branding to authenticated;
create policy brand_read on public.organization_branding for select to authenticated using(app_private.is_member(organization_id));
-- Only owners/admins can change tenant branding.
create or replace function app_private.can_manage_branding(org uuid)
returns boolean language sql security definer stable set search_path='' as $$
 select exists(select 1 from public.organization_members m
 where m.organization_id=org and m.user_id=(select auth.uid()) and m.role in ('owner','admin'));
$$;
revoke all on function app_private.can_manage_branding(uuid) from public,anon;
grant execute on function app_private.can_manage_branding(uuid) to authenticated;
create policy brand_insert on public.organization_branding for insert to authenticated
 with check(app_private.can_manage_branding(organization_id) and updated_by=(select auth.uid()));
create policy brand_update on public.organization_branding for update to authenticated
 using(app_private.can_manage_branding(organization_id))
 with check(app_private.can_manage_branding(organization_id) and updated_by=(select auth.uid()));
-- Domain mapping and logo uploads intentionally deferred until verification and private-storage policy.
