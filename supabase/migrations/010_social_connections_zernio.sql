-- Zernio-backed Facebook / Instagram / TikTok connections + legacy TikTok provider
alter table public.social_connections
  drop constraint if exists social_connections_provider_check;

do $$
declare
  r record;
begin
  for r in
    select conname
    from pg_constraint
    where conrelid = 'public.social_connections'::regclass
      and pg_get_constraintdef(oid) like '%provider in (%'
  loop
    execute format('alter table public.social_connections drop constraint if exists %I', r.conname);
  end loop;
end $$;

alter table public.social_connections
  add constraint social_connections_provider_check
  check (provider in ('meta', 'linkedin', 'gmb', 'tiktok', 'zernio', 'zernio_profile'));
