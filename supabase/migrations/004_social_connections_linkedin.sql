-- Expand social_connections.provider to include LinkedIn
alter table public.social_connections
  drop constraint if exists social_connections_provider_check;

do $$
declare
  r record;
begin
  -- Drop any existing CHECK constraint that restricts provider values.
  -- (Constraint names vary depending on how the migration was applied.)
  for r in (
    select conname
    from pg_constraint
    where conrelid = 'public.social_connections'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) like '%provider in (%'
  )
  loop
    execute format('alter table public.social_connections drop constraint if exists %I', r.conname);
  end loop;
end $$;

-- Re-add constraint with additional providers
alter table public.social_connections
  add constraint social_connections_provider_check
  check (provider in ('meta', 'linkedin'));

