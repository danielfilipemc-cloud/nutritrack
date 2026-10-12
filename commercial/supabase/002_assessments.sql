-- Run ONLY in the new, isolated commercial Supabase project after schema.sql.
-- Development scaffold: do not enter real health data before DPIA/consent/security review.
create table public.assessments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  recorded_by uuid not null references auth.users(id),
  assessed_on date not null default current_date,
  weight_kg numeric(5,2) check(weight_kg > 0 and weight_kg <= 500),
  height_cm numeric(5,1) check(height_cm > 0 and height_cm <= 300),
  waist_cm numeric(5,1) check(waist_cm > 0 and waist_cm <= 300),
  note text check(length(note) <= 2000),
  created_at timestamptz not null default now(),
  constraint measurement_present check (weight_kg is not null or height_cm is not null or waist_cm is not null),
  unique(id, organization_id)
);
-- Prevent cross-organization client references even if the caller guesses another client's UUID.
alter table public.clients add constraint clients_id_org_unique unique(id,organization_id);
alter table public.assessments add constraint assessments_client_tenant_fk
  foreign key(client_id,organization_id) references public.clients(id,organization_id) on delete cascade;
create index assessments_client_date_idx on public.assessments(client_id,assessed_on desc);
create index assessments_org_date_idx on public.assessments(organization_id,assessed_on desc);
alter table public.assessments enable row level security;
revoke all on public.assessments from anon,authenticated;
grant select, insert on public.assessments to authenticated;
-- Staff access is organization-scoped; no user-editable metadata is trusted.
create policy assessments_read on public.assessments for select to authenticated
  using (app_private.is_member(organization_id));
create policy assessments_insert on public.assessments for insert to authenticated
  with check(app_private.is_member(organization_id) and recorded_by=(select auth.uid()));
-- No update/delete for assessments: future corrections need an auditable revision flow.
-- At this development stage any provisioned staff member can add clients.
grant insert on public.clients to authenticated;
create policy clients_insert on public.clients for insert to authenticated
  with check(app_private.is_member(organization_id));
