-- Saved bulk editor stacks (topic-generated slideshows), owner-only via RLS
create table if not exists public.bulk_workspaces (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade not null,
  title text not null default '',
  topic text not null default '',
  thumbnail_url text,
  shows jsonb not null default '[]'::jsonb,
  selected_show_id text,
  clip_project_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.bulk_workspaces enable row level security;

drop policy if exists "Users manage own bulk workspaces" on public.bulk_workspaces;
create policy "Users manage own bulk workspaces"
  on public.bulk_workspaces for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists bulk_workspaces_user_updated_idx
  on public.bulk_workspaces(user_id, updated_at desc);

drop trigger if exists bulk_workspaces_updated_at on public.bulk_workspaces;
create trigger bulk_workspaces_updated_at before update on public.bulk_workspaces
  for each row execute procedure public.set_updated_at();
