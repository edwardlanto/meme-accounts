import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { adminClient } from '$lib/server/auth';
import { appUrl, getStripe } from '$lib/server/stripe';

/**
 * Open the Stripe Customer Portal for the signed-in user.
 * Requires an existing stripe_customer_id (created at first checkout).
 */
export const POST: RequestHandler = async ({ locals }) => {
	const { user } = await locals.safeGetSession();
	if (!user?.id) {
		return json({ ok: false, error: 'Sign in required' }, { status: 401 });
	}

	const supabase = adminClient();
	const { data: profile, error } = await supabase
		.from('users')
		.select('stripe_customer_id')
		.eq('id', user.id)
		.maybeSingle();

	if (error) return json({ ok: false, error: error.message }, { status: 500 });
	if (!profile?.stripe_customer_id) {
		return json(
			{ ok: false, error: 'No billing account yet — upgrade from Pricing first' },
			{ status: 400 }
		);
	}

	let stripe;
	try {
		stripe = getStripe();
	} catch (e: any) {
		return json({ ok: false, error: e?.message ?? 'Stripe not configured' }, { status: 503 });
	}

	const portal = await stripe.billingPortal.sessions.create({
		customer: profile.stripe_customer_id,
		return_url: appUrl('/dashboard/settings?tab=billing'),
	});

	return json({ ok: true, url: portal.url });
};
