-- Scheduled posts + publishing attempts (queue-driven)
create table if not exists public.scheduled_posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade not null,
  -- which social connection to publish through (ex: meta fbpage:123, meta <ig_user_id>, linkedin member/org, gmb location)
  connection_provider text not null,
  connection_provider_account_id text not null,

  -- what to publish (keep flexible)
  content jsonb not null default '{}'::jsonb,

  -- scheduling + state
  scheduled_at timestamptz not null,
  status text not null default 'scheduled' check (status in ('scheduled', 'publishing', 'published', 'failed', 'cancelled')),

  attempt_count int not null default 0,
  last_error text,
  published_at timestamptz,

  -- BullMQ job id (string)
  job_id text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.scheduled_posts enable row level security;
create policy "Users manage own scheduled posts"
  on public.scheduled_posts for all using (auth.uid() = user_id);

create index if not exists scheduled_posts_user_idx
  on public.scheduled_posts(user_id);
create index if not exists scheduled_posts_due_idx
  on public.scheduled_posts(status, scheduled_at);
create unique index if not exists scheduled_posts_job_id_idx
  on public.scheduled_posts(job_id) where job_id is not null;

create trigger scheduled_posts_updated_at before update on public.scheduled_posts
  for each row execute procedure public.set_updated_at();

