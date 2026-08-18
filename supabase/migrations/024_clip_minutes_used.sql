-- Monthly video clipping minutes (source duration billed on /api/videos/analyze)

alter table public.users
  add column if not exists clip_minutes_used integer not null default 0;

-- Protect privileged column from client-side writes
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
  new.ai_images_used := old.ai_images_used;
  new.clip_minutes_used := old.clip_minutes_used;
  new.usage_period_start := old.usage_period_start;
  new.email := old.email;
  return new;
end;
$$;
