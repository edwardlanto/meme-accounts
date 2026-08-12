import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { adminClient } from '$lib/server/auth';
import {
	appUrl,
	getStripe,
	priceIdFor,
	type BillingInterval,
	type PaidPlan,
} from '$lib/server/stripe';

const PAID: PaidPlan[] = ['pro', 'agency'];
const INTERVALS: BillingInterval[] = ['month', 'year'];

/**
 * Create a Stripe Checkout Session (subscription mode).
 * Auth via cookie session (locals.safeGetSession). Plan is never trusted from
 * free-form amounts — only from allowlisted plan + interval → env price IDs.
 */
export const POST: RequestHandler = async ({ request, locals }) => {
	const { user } = await locals.safeGetSession();
	if (!user?.id || !user.email) {
		return json({ ok: false, error: 'Sign in to continue checkout' }, { status: 401 });
	}

	let body: { plan?: string; interval?: string };
	try {
		body = await request.json();
	} catch {
		return json({ ok: false, error: 'Invalid JSON body' }, { status: 400 });
	}

	const plan = body.plan as PaidPlan;
	const interval = (body.interval ?? 'month') as BillingInterval;
	if (!PAID.includes(plan)) {
		return json({ ok: false, error: 'Invalid plan' }, { status: 400 });
	}
	if (!INTERVALS.includes(interval)) {
		return json({ ok: false, error: 'Invalid interval' }, { status: 400 });
	}

	let priceId: string;
	try {
		priceId = priceIdFor(plan, interval);
	} catch (e: any) {
		return json(
			{ ok: false, error: e?.message ?? 'Stripe prices not configured' },
			{ status: 503 }
		);
	}

	const supabase = adminClient();
	const { data: profile, error: profileErr } = await supabase
		.from('users')
		.select('id, email, stripe_customer_id, plan')
		.eq('id', user.id)
		.maybeSingle();

	if (profileErr) {
		return json({ ok: false, error: profileErr.message }, { status: 500 });
	}

	let stripe;
	try {
		stripe = getStripe();
	} catch (e: any) {
		return json({ ok: false, error: e?.message ?? 'Stripe not configured' }, { status: 503 });
	}

	let customerId = profile?.stripe_customer_id as string | null | undefined;

	if (!customerId) {
		const customer = await stripe.customers.create({
			email: user.email,
			name: user.user_metadata?.full_name ?? undefined,
			metadata: { supabase_user_id: user.id },
		});
		customerId = customer.id;
		const { error: updErr } = await supabase
			.from('users')
			.update({ stripe_customer_id: customerId, updated_at: new Date().toISOString() })
			.eq('id', user.id);
		if (updErr) {
			return json({ ok: false, error: updErr.message }, { status: 500 });
		}
	}

	if (!/^price_/.test(priceId)) {
		return json(
			{
				ok: false,
				error:
					`Invalid Stripe price id for ${plan}/${interval}. Use a Price ID from the Dashboard (starts with price_), not a dollar amount.`,
			},
			{ status: 503 }
		);
	}

	let session;
	try {
		session = await stripe.checkout.sessions.create({
			mode: 'subscription',
			customer: customerId,
			client_reference_id: user.id,
			line_items: [{ price: priceId, quantity: 1 }],
			success_url: appUrl(`/checkout/success?session_id={CHECKOUT_SESSION_ID}`),
			cancel_url: appUrl(`/checkout?plan=${plan}&interval=${interval}&canceled=1`),
			allow_promotion_codes: true,
			billing_address_collection: 'auto',
			customer_update: { address: 'auto', name: 'auto' },
			metadata: {
				supabase_user_id: user.id,
				plan,
				interval,
			},
			subscription_data: {
				metadata: {
					supabase_user_id: user.id,
					plan,
				},
			},
		});
	} catch (e: any) {
		console.error('[stripe checkout]', e?.message ?? e);
		return json(
			{ ok: false, error: e?.message ?? 'Failed to create checkout session' },
			{ status: 502 }
		);
	}

	if (!session.url) {
		return json({ ok: false, error: 'Failed to create checkout session' }, { status: 500 });
	}

	return json({ ok: true, url: session.url, sessionId: session.id });
};
