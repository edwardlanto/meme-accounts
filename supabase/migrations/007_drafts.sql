-- Drafts (editor state persistence)
create table if not exists public.drafts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade not null,
  kind text not null, -- e.g. 'news_studio'
  state jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.drafts enable row level security;

create policy "Users manage own drafts"
  on public.drafts for all
  using (auth.uid() = user_id);

create index if not exists drafts_user_kind_idx
  on public.drafts(user_id, kind, updated_at desc);

create trigger drafts_updated_at before update on public.drafts
  for each row execute procedure public.set_updated_at();

