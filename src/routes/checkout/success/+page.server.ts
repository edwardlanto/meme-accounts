import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { adminClient } from '$lib/server/auth';
import { getStripe, planFromPriceId, PLAN_CATALOG } from '$lib/server/stripe';
import { PAID_PLAN_IDS, type PaidPlanId } from '$lib/pricing-catalog';
import { normalizePlanId } from '$lib/plan-entitlements';

export const load: PageServerLoad = async ({ url, locals }) => {
	const { user } = await locals.safeGetSession();
	if (!user) throw redirect(303, '/?auth=login&next=/checkout/success');

	const sessionId = url.searchParams.get('session_id');
	if (!sessionId || !sessionId.startsWith('cs_')) {
		throw redirect(303, '/pricing');
	}

	let planName = 'Creator';
	let planId: PaidPlanId = 'creator';

	try {
		const stripe = getStripe();
		const session = await stripe.checkout.sessions.retrieve(sessionId, {
			expand: ['subscription'],
		});

		const owner =
			session.metadata?.supabase_user_id || session.client_reference_id || null;
		if (owner && owner !== user.id) {
			throw redirect(303, '/pricing');
		}
		if (session.payment_status !== 'paid' && session.status !== 'complete') {
			throw redirect(303, `/checkout?canceled=1`);
		}

		const metaPlan = session.metadata?.plan;
		if (metaPlan && (PAID_PLAN_IDS as readonly string[]).includes(metaPlan)) {
			planId = metaPlan as PaidPlanId;
		} else if (session.subscription && typeof session.subscription !== 'string') {
			const priceId = session.subscription.items.data[0]?.price?.id;
			planId = planFromPriceId(priceId) ?? 'creator';
		} else {
			planId = normalizePlanId(metaPlan) as PaidPlanId;
			if (planId === 'free') planId = 'creator';
		}

		planName = PLAN_CATALOG[planId].name;

		const supabase = adminClient();
		await supabase
			.from('users')
			.update({
				plan: planId,
				plan_status: 'active',
				stripe_customer_id:
					typeof session.customer === 'string' ? session.customer : undefined,
				stripe_subscription_id:
					typeof session.subscription === 'string'
						? session.subscription
						: session.subscription?.id,
				updated_at: new Date().toISOString(),
			})
			.eq('id', user.id);
	} catch (e: any) {
		if (e?.status === 303) throw e;
		console.error('[checkout/success]', e?.message);
	}

	return { planName, planId };
};
