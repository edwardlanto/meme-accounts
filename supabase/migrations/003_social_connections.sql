-- Social connections (OAuth tokens etc.)
create table if not exists public.social_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade not null,
  provider text not null check (provider in ('meta')),
  provider_account_id text not null,
  provider_account_label text,
  access_token text not null,
  refresh_token text,
  expires_at timestamptz,
  scopes text[] not null default '{}',
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.social_connections enable row level security;

create policy "Users manage own social connections"
  on public.social_connections for all using (auth.uid() = user_id);

create unique index if not exists social_connections_user_provider_account
  on public.social_connections(user_id, provider, provider_account_id);

create index if not exists social_connections_user_idx
  on public.social_connections(user_id);

create trigger social_connections_updated_at before update on public.social_connections
  for each row execute procedure public.set_updated_at();

