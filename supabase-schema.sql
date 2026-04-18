-- Carousel Studio — Supabase Schema
-- Run this in your Supabase SQL editor

-- Users (extends auth.users)
create table if not exists public.users (
  id uuid references auth.users(id) on delete cascade primary key,
  email text not null,
  full_name text,
  avatar_url text,
  plan text not null default 'free' check (plan in ('free', 'pro', 'agency')),
  credits integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.users enable row level security;
create policy "Users can read own profile" on public.users for select using (auth.uid() = id);
create policy "Users can update own profile" on public.users for update using (auth.uid() = id);

-- Auto-create user profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.users (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name');
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Creators (tracked competitor accounts)
create table if not exists public.creators (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade not null,
  instagram_handle text not null,
  display_name text,
  avatar_url text,
  followers integer,
  niche text,
  avg_engagement numeric(5,2),
  last_scraped_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.creators enable row level security;
create policy "Users manage own creators" on public.creators for all using (auth.uid() = user_id);
create unique index creators_user_handle_idx on public.creators(user_id, instagram_handle);

-- Viral posts (scraped from Apify)
create table if not exists public.viral_posts (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid references public.creators(id) on delete cascade not null,
  instagram_post_id text not null unique,
  caption text,
  hook text,
  hook_type text,
  likes integer not null default 0,
  comments integer not null default 0,
  shares integer not null default 0,
  engagement_rate numeric(6,2),
  media_urls text[] not null default '{}',
  scraped_at timestamptz not null default now(),
  ai_analysis jsonb,
  created_at timestamptz not null default now()
);
alter table public.viral_posts enable row level security;
create policy "Users read posts of own creators" on public.viral_posts for all
  using (creator_id in (select id from public.creators where user_id = auth.uid()));
create index viral_posts_creator_idx on public.viral_posts(creator_id);
create index viral_posts_likes_idx on public.viral_posts(likes desc);

-- Carousels
create table if not exists public.carousels (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade not null,
  title text not null default 'Untitled carousel',
  status text not null default 'draft' check (status in ('draft', 'published', 'scheduled')),
  slides jsonb not null default '[]',
  style_config jsonb,
  source_post_id uuid references public.viral_posts(id) on delete set null,
  thumbnail_url text,
  scheduled_at timestamptz,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.carousels enable row level security;
create policy "Users manage own carousels" on public.carousels for all using (auth.uid() = user_id);
create index carousels_user_idx on public.carousels(user_id);

-- Auto-update updated_at
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger carousels_updated_at before update on public.carousels
  for each row execute procedure public.set_updated_at();
create trigger users_updated_at before update on public.users
  for each row execute procedure public.set_updated_at();
