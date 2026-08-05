import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { PLAN_CATALOG } from '$lib/server/stripe';

export const load: PageServerLoad = async ({ url, locals }) => {
	const { user } = await locals.safeGetSession();
	if (!user) {
		const next = `/checkout?${url.searchParams.toString()}`;
		throw redirect(303, `/?auth=login&next=${encodeURIComponent(next)}`);
	}

	const planParam = url.searchParams.get('plan') ?? 'pro';
	const plan = planParam === 'agency' ? 'agency' : 'pro';
	const intervalParam = url.searchParams.get('interval') ?? 'month';
	const interval = intervalParam === 'year' ? 'year' : 'month';
	const canceled = url.searchParams.get('canceled') === '1';

	const catalog = PLAN_CATALOG[plan];
	const amount = interval === 'year' ? catalog.yearly : catalog.monthly;
	const perMonth = interval === 'year' ? Math.round(catalog.yearly / 12) : catalog.monthly;

	return {
		plan,
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
