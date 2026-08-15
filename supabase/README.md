# Supabase

## Folder Structure

```
supabase/
  migrations/
    000_initial_schema.sql   — Run first. Creates all tables + RLS policies.
    001_backfill_users.sql   — Run second. Backfills existing auth users + adds columns.
```

## How to apply migrations

1. Go to your [Supabase dashboard](https://supabase.com) → SQL Editor
2. Run each file **in order** (000 → 001 → ...)
3. Each file is safe to re-run (uses `if not exists` / `on conflict do nothing`)

Latest: `019_library_list_views.sql` — slim library views for drafts / bulk / clip projects (list pages skip full JSON).

## Adding a new migration

Name it `NNN_description.sql` where `NNN` is the next number in sequence.
