-- Trial export tracking (free users get 1 tweet/post export before upgrade)
alter table public.users
  add column if not exists trial_exports_used integer not null default 0;
