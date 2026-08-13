import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { adminClient } from '$lib/server/auth';
import { appUrl, getStripe } from '$lib/server/stripe';

/**
 * Open the Stripe Customer Portal for the signed-in user.
 * Optional body `{ flow: 'cancel' }` deep-links into cancel subscription
 * so cancel is as easy as upgrade (one click from Settings → Billing).
 */
export const POST: RequestHandler = async ({ request, locals }) => {
	const { user } = await locals.safeGetSession();
	if (!user?.id) {
		return json({ ok: false, error: 'Sign in required' }, { status: 401 });
	}

	let flow: 'cancel' | null = null;
	try {
		const body = await request.json().catch(() => ({}));
		if (body?.flow === 'cancel') flow = 'cancel';
	} catch {
		/* empty body is fine */
	}

	const supabase = adminClient();
	const { data: profile, error } = await supabase
		.from('users')
		.select('stripe_customer_id, stripe_subscription_id')
		.eq('id', user.id)
		.maybeSingle();

	if (error) return json({ ok: false, error: error.message }, { status: 500 });
	if (!profile?.stripe_customer_id) {
		return json(
			{ ok: false, error: 'No billing account yet — upgrade from Pricing first' },
			{ status: 400 },
		);
	}

	let stripe;
	try {
		stripe = getStripe();
	} catch (e: any) {
		return json({ ok: false, error: e?.message ?? 'Stripe not configured' }, { status: 503 });
	}

	const params: Parameters<typeof stripe.billingPortal.sessions.create>[0] = {
		customer: profile.stripe_customer_id,
		return_url: appUrl('/dashboard/settings?tab=billing'),
	};

	if (flow === 'cancel' && profile.stripe_subscription_id) {
		params.flow_data = {
			type: 'subscription_cancel',
			subscription_cancel: {
				subscription: profile.stripe_subscription_id,
			},
		};
	}

	const portal = await stripe.billingPortal.sessions.create(params);

	return json({ ok: true, url: portal.url });
};
