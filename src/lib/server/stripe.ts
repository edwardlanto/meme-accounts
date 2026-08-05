import Stripe from 'stripe';
import { env } from '$env/dynamic/private';
import { env as publicEnv } from '$env/dynamic/public';
import { PLAN_CATALOG } from '$lib/pricing-catalog';

export { PLAN_CATALOG };
export type PaidPlan = 'pro' | 'agency';
export type BillingInterval = 'month' | 'year';

export function getStripe(): Stripe {
	const key = env.STRIPE_SECRET_KEY;
	if (!key) throw new Error('Missing STRIPE_SECRET_KEY');
	return new Stripe(key, {
		apiVersion: '2026-07-29.dahlia',
		typescript: true,
	});
}

export function appUrl(path = ''): string {
	const base = (publicEnv.PUBLIC_APP_URL || 'http://localhost:5173').replace(/\/$/, '');
	return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}

export function priceIdFor(plan: PaidPlan, interval: BillingInterval): string {
	const map: Record<PaidPlan, Record<BillingInterval, string | undefined>> = {
		pro: {
			month: env.STRIPE_PRICE_PRO_MONTHLY,
			year: env.STRIPE_PRICE_PRO_YEARLY,
		},
		agency: {
			month: env.STRIPE_PRICE_AGENCY_MONTHLY,
			year: env.STRIPE_PRICE_AGENCY_YEARLY,
		},
	};
	const id = map[plan][interval];
	if (!id) {
		throw new Error(`Missing Stripe price id for ${plan}/${interval}`);
	}
	return id;
}

export function planFromPriceId(priceId: string | undefined | null): PaidPlan | null {
	if (!priceId) return null;
	const pairs: [PaidPlan, string | undefined][] = [
		['pro', env.STRIPE_PRICE_PRO_MONTHLY],
		['pro', env.STRIPE_PRICE_PRO_YEARLY],
		['agency', env.STRIPE_PRICE_AGENCY_MONTHLY],
		['agency', env.STRIPE_PRICE_AGENCY_YEARLY],
	];
	for (const [plan, id] of pairs) {
		if (id && id === priceId) return plan;
	}
	return null;
}

export function mapSubscriptionStatus(
	status: Stripe.Subscription.Status
): 'inactive' | 'active' | 'past_due' | 'canceled' | 'trialing' {
	switch (status) {
		case 'active':
			return 'active';
		case 'past_due':
			return 'past_due';
		case 'canceled':
		case 'unpaid':
		case 'incomplete_expired':
			return 'canceled';
		case 'trialing':
			return 'trialing';
		default:
			return 'inactive';
	}
}

/** Period end across Stripe API versions (basil/dahlia moved this onto items). */
export function subscriptionPeriodEnd(sub: Stripe.Subscription): string | null {
	const anySub = sub as Stripe.Subscription & {
		current_period_end?: number;
		items?: { data?: Array<{ current_period_end?: number }> };
	};
	const end =
		anySub.current_period_end ??
		anySub.items?.data?.[0]?.current_period_end ??
		null;
	return end ? new Date(end * 1000).toISOString() : null;
}
