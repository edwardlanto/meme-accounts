import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { PLAN_CATALOG, PAID_PLAN_IDS, type PaidPlanId } from '$lib/pricing-catalog';
import { normalizePlanId } from '$lib/plan-entitlements';

export const load: PageServerLoad = async ({ url, locals }) => {
	const { user } = await locals.safeGetSession();
	if (!user) {
		const next = `/checkout?${url.searchParams.toString()}`;
		throw redirect(303, `/?auth=login&next=${encodeURIComponent(next)}`);
	}

	const planParam = url.searchParams.get('plan') ?? 'creator';
	const plan = normalizePlanId(planParam);
	const paidPlan: PaidPlanId =
		plan !== 'free' && (PAID_PLAN_IDS as readonly string[]).includes(plan)
			? (plan as PaidPlanId)
			: 'creator';
	const intervalParam = url.searchParams.get('interval') ?? 'month';
	const interval = intervalParam === 'year' ? 'year' : 'month';
	const canceled = url.searchParams.get('canceled') === '1';

	const catalog = PLAN_CATALOG[paidPlan];
	const amount = interval === 'year' ? catalog.yearly : catalog.monthly;
	const perMonth = interval === 'year' ? Math.round(catalog.yearly / 12) : catalog.monthly;

	return {
		plan: paidPlan,
		interval,
		canceled,
		amount,
		perMonth,
		planName: catalog.name,
		features: catalog.features,
		tagline: catalog.tagline,
		userEmail: user.email ?? '',
	};
};
