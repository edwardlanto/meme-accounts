-- Stripe billing fields on public.users
alter table public.users
  add column if not exists stripe_customer_id text,
  add column if not exists stripe_subscription_id text,
  add column if not exists plan_status text not null default 'inactive'
    check (plan_status in ('inactive', 'active', 'past_due', 'canceled', 'trialing')),
  add column if not exists current_period_end timestamptz;

create unique index if not exists users_stripe_customer_id_idx
  on public.users (stripe_customer_id)
  where stripe_customer_id is not null;

create unique index if not exists users_stripe_subscription_id_idx
  on public.users (stripe_subscription_id)
  where stripe_subscription_id is not null;
