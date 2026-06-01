create table if not exists public.nutritrack_user_data (
  user_id uuid primary key references auth.users(id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default timezone('utc'::text, now())
);

alter table public.nutritrack_user_data enable row level security;

revoke all on table public.nutritrack_user_data from anon;
grant select, insert, update, delete on table public.nutritrack_user_data to authenticated;

drop policy if exists "Users can read their own NutriTrack data" on public.nutritrack_user_data;
create policy "Users can read their own NutriTrack data"
on public.nutritrack_user_data
for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert their own NutriTrack data" on public.nutritrack_user_data;
create policy "Users can insert their own NutriTrack data"
on public.nutritrack_user_data
for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their own NutriTrack data" on public.nutritrack_user_data;
create policy "Users can update their own NutriTrack data"
on public.nutritrack_user_data
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete their own NutriTrack data" on public.nutritrack_user_data;
create policy "Users can delete their own NutriTrack data"
on public.nutritrack_user_data
for delete
to authenticated
using ((select auth.uid()) = user_id);

create or replace function public.delete_own_nutritrack_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  delete from auth.users where id = auth.uid();
end;
$$;

revoke all on function public.delete_own_nutritrack_account() from public;
revoke all on function public.delete_own_nutritrack_account() from anon;
grant execute on function public.delete_own_nutritrack_account() to authenticated;
