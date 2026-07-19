-- Persistent custom image assets for News Studio (metadata in Postgres, files in R2).
create table if not exists public.studio_assets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade not null,
  name text not null,
  r2_key text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint studio_assets_name_nonempty check (char_length(trim(name)) > 0),
  constraint studio_assets_r2_key_nonempty check (char_length(trim(r2_key)) > 0)
);

alter table public.studio_assets enable row level security;

create policy "Users manage own studio assets"
  on public.studio_assets for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists studio_assets_user_updated_idx
  on public.studio_assets(user_id, updated_at desc);

create index if not exists studio_assets_user_name_idx
  on public.studio_assets(user_id, lower(name));

create trigger studio_assets_updated_at before update on public.studio_assets
  for each row execute procedure public.set_updated_at();
