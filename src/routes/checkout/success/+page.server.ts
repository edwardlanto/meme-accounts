import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { adminClient } from '$lib/server/auth';
import { getStripe, planFromPriceId, PLAN_CATALOG } from '$lib/server/stripe';

export const load: PageServerLoad = async ({ url, locals }) => {
	const { user } = await locals.safeGetSession();
	if (!user) throw redirect(303, '/login');

	const sessionId = url.searchParams.get('session_id');
	if (!sessionId || !sessionId.startsWith('cs_')) {
		throw redirect(303, '/pricing');
	}

	let planName = 'Pro';
  let planId: 'pro' | 'agency' = 'pro';

	try {
		const stripe = getStripe();
		const session = await stripe.checkout.sessions.retrieve(sessionId, {
			expand: ['subscription'],
		});

		// Only show success for sessions belonging to this user.
		const owner =
			session.metadata?.supabase_user_id || session.client_reference_id || null;
		if (owner && owner !== user.id) {
			throw redirect(303, '/pricing');
		}
		if (session.payment_status !== 'paid' && session.status !== 'complete') {
			throw redirect(303, `/checkout?canceled=1`);
		}

		const metaPlan = session.metadata?.plan;
		if (metaPlan === 'agency' || metaPlan === 'pro') {
			planId = metaPlan;
		} else if (session.subscription && typeof session.subscription !== 'string') {
			const priceId = session.subscription.items.data[0]?.price?.id;
			planId = planFromPriceId(priceId) ?? 'pro';
		}

		planName = PLAN_CATALOG[planId].name;

		// Soft-confirm local profile (webhook is source of truth; this helps UX if webhook lags).
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
