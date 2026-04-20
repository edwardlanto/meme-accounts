-- Brand Templates — saved branded carousel styles
create table if not exists public.brand_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade not null,
  name text not null default 'Template 1',
  style jsonb,
  primary_color text not null default '#8B5CF6',
  brand_name text not null default '',
  handle text not null default '',
  generated_html text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.brand_templates enable row level security;
create policy "Users manage own brand templates"
  on public.brand_templates for all using (auth.uid() = user_id);

create index brand_templates_user_idx on public.brand_templates(user_id);

create trigger brand_templates_updated_at before update on public.brand_templates
  for each row execute procedure public.set_updated_at();
