-- Marketing email opt-in (set at signup)
alter table public.users
  add column if not exists marketing_emails boolean not null default false;

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.users (id, email, full_name, marketing_emails)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name',
    coalesce((new.raw_user_meta_data->>'marketing_emails')::boolean, false)
  )
  on conflict (id) do update set
    email = excluded.email,
    full_name = coalesce(excluded.full_name, public.users.full_name),
    marketing_emails = coalesce(excluded.marketing_emails, public.users.marketing_emails),
    updated_at = now();
  return new;
end;
$$ language plpgsql security definer;
