-- 4-tier plans + monthly carousel token tracking

-- Migrate legacy plan names before updating the check constraint
update public.users set plan = 'creator' where plan = 'pro';
update public.users set plan = 'business' where plan = 'agency';

alter table public.users drop constraint if exists users_plan_check;
alter table public.users
  add constraint users_plan_check
  check (plan in ('free', 'hobby', 'creator', 'business'));

alter table public.users
  add column if not exists carousel_tokens_used integer not null default 0,
  add column if not exists usage_period_start date default (date_trunc('month', now() at time zone 'utc'))::date;

-- Backfill period start for existing rows
update public.users
set usage_period_start = (date_trunc('month', now() at time zone 'utc'))::date
where usage_period_start is null;

-- Protect new privileged columns from client-side writes
create or replace function public.protect_users_privileged_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
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
  new.carousel_tokens_used := old.carousel_tokens_used;
  new.usage_period_start := old.usage_period_start;
  new.email := old.email;
  return new;
end;
$$;
