-- AI clip finder projects (source + ranked clips + optional bulk editor state)
create table if not exists public.video_clip_projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade not null,
  title text not null default '',
  thumbnail_url text,
  source jsonb not null default '{}'::jsonb,
  clips jsonb not null default '[]'::jsonb,
  summary text not null default '',
  demo boolean not null default false,
  model text not null default '',
  bulk_shows jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.video_clip_projects enable row level security;

create policy "Users manage own clip projects"
  on public.video_clip_projects for all
  using (auth.uid() = user_id);

create index if not exists video_clip_projects_user_updated_idx
  on public.video_clip_projects(user_id, updated_at desc);

create trigger video_clip_projects_updated_at before update on public.video_clip_projects
  for each row execute procedure public.set_updated_at();
