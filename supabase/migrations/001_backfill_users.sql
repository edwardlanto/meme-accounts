-- Migration 001: Backfill existing auth users + robustness fixes
-- Run this in your Supabase SQL Editor after supabase-schema.sql

-- 1. Backfill any existing auth users who don't have a public.users profile yet
--    (happens when schema is applied after users already signed up)
insert into public.users (id, email, full_name)
select
  au.id,
  au.email,
  au.raw_user_meta_data->>'full_name'
from auth.users au
where au.id not in (select id from public.users)
on conflict (id) do nothing;

-- 2. Make sure the trigger exists to auto-create profiles for new signups
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.users (id, email, full_name)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name'
  )
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 3. Ensure carousels has source_post_id column (in case it was missed)
alter table public.carousels
  add column if not exists source_post_id uuid references public.viral_posts(id) on delete set null;

-- 4. Ensure style_config column exists on carousels
alter table public.carousels
  add column if not exists style_config jsonb;

-- 5. Ensure thumbnail_url column exists
alter table public.carousels
  add column if not exists thumbnail_url text;

-- 6. Add design_preset column to carousels (for tracking which style was used)
alter table public.carousels
  add column if not exists design_preset text;

-- Verify: show the current user profiles
select id, email, full_name, plan, credits from public.users;
