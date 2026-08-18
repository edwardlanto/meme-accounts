-- Lifetime generation totals (not reset with the monthly usage period)

alter table public.users
  add column if not exists slideshows_generated integer not null default 0,
  add column if not exists slides_generated integer not null default 0;

update public.users
set slideshows_generated = greatest(slideshows_generated, coalesce(carousel_tokens_used, 0))
where coalesce(carousel_tokens_used, 0) > slideshows_generated;

-- Protect privileged columns from client-side writes
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
  new.slideshows_generated := old.slideshows_generated;
  new.slides_generated := old.slides_generated;
  new.usage_period_start := old.usage_period_start;
  new.email := old.email;
  return new;
end;
$$;
