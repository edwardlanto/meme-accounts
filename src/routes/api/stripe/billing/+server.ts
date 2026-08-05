import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { adminClient } from '$lib/server/auth';
import { PLAN_CATALOG } from '$lib/server/stripe';

/** Return the signed-in user's plan + billing fields for Settings / checkout. */
export const GET: RequestHandler = async ({ locals }) => {
	const { user } = await locals.safeGetSession();
	if (!user?.id) {
		return json({ ok: false, error: 'Unauthorized' }, { status: 401 });
	}

	const supabase = adminClient();
	const { data, error } = await supabase
		.from('users')
		.select(
			'plan, credits, plan_status, stripe_customer_id, stripe_subscription_id, current_period_end'
		)
		.eq('id', user.id)
		.maybeSingle();

	if (error) return json({ ok: false, error: error.message }, { status: 500 });

	const plan = (data?.plan ?? 'free') as keyof typeof PLAN_CATALOG;
	const catalog = PLAN_CATALOG[plan] ?? PLAN_CATALOG.free;

	return json({
		ok: true,
		billing: {
			plan,
			planName: catalog.name,
			credits: data?.credits ?? 0,
			planStatus: data?.plan_status ?? 'inactive',
			hasCustomer: Boolean(data?.stripe_customer_id),
			hasSubscription: Boolean(data?.stripe_subscription_id),
			currentPeriodEnd: data?.current_period_end ?? null,
			features: catalog.features,
			monthlyPrice: catalog.monthly,
		},
	});
};
