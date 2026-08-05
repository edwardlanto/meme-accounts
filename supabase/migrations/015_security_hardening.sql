-- Security hardening: block client-side escalation of billing/plan fields on public.users

create or replace function public.protect_users_privileged_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Service role (webhooks, server jobs) may update billing fields.
  if coalesce(auth.role(), '') = 'service_role' then
    return new;
  end if;

  new.plan := old.plan;
  new.credits := old.credits;
  new.stripe_customer_id := old.stripe_customer_id;
  new.stripe_subscription_id := old.stripe_subscription_id;
  new.plan_status := old.plan_status;
  new.current_period_end := old.current_period_end;
  new.trial_exports_used := old.trial_exports_used;
  new.email := old.email;
  return new;
end;
$$;

drop trigger if exists protect_users_privileged_columns on public.users;
create trigger protect_users_privileged_columns
  before update on public.users
  for each row execute function public.protect_users_privileged_columns();

-- Harden signup trigger against search_path attacks
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
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
$$;
