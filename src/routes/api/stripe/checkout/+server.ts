import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { adminClient } from '$lib/server/auth';
import { PAID_PLAN_IDS } from '$lib/pricing-catalog';
import {
	appUrl,
	getStripe,
	isMissingStripeCustomer,
	priceIdFor,
	type BillingInterval,
	type PaidPlan,
} from '$lib/server/stripe';

const PAID: PaidPlan[] = PAID_PLAN_IDS;
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

	async function persistCustomerId(id: string) {
		const { error: updErr } = await supabase
			.from('users')
			.update({ stripe_customer_id: id, updated_at: new Date().toISOString() })
			.eq('id', user.id);
		if (updErr) throw new Error(updErr.message);
	}

	async function createStripeCustomer(): Promise<string> {
		const customer = await stripe.customers.create({
			email: user.email,
			name: user.user_metadata?.full_name ?? undefined,
			metadata: { supabase_user_id: user.id },
		});
		await persistCustomerId(customer.id);
		return customer.id;
	}

	let customerId = String(profile?.stripe_customer_id ?? '').trim();

	if (customerId) {
		try {
			const existing = await stripe.customers.retrieve(customerId);
			if ('deleted' in existing && existing.deleted) {
				console.warn('[stripe checkout] replacing deleted customer', customerId);
				customerId = '';
			}
		} catch (e: unknown) {
			if (!isMissingStripeCustomer(e)) {
				console.error('[stripe checkout] retrieve customer', e);
				return json({ ok: false, error: 'Could not reach Stripe. Try again.' }, { status: 502 });
			}
			// Stale id (test vs live keys, deleted customer, or another Stripe account).
			console.warn('[stripe checkout] replacing missing customer', customerId);
			customerId = '';
		}
	}

	if (!customerId) {
		try {
			customerId = await createStripeCustomer();
		} catch (e: unknown) {
			const msg = e instanceof Error ? e.message : 'Could not create Stripe customer';
			return json({ ok: false, error: msg }, { status: 500 });
		}
	}

	// Guard: if this customer already has an active/trialing subscription, don't create
	// a second one — send them to the billing portal to upgrade/switch instead.
	let existingSubs: { data: { id: string }[] };
	let trialingSubs: { data: { id: string }[] } = { data: [] };
	try {
		existingSubs = await stripe.subscriptions.list({
			customer: customerId,
			status: 'active',
			limit: 1,
		});
		if (existingSubs.data.length === 0) {
			trialingSubs = await stripe.subscriptions.list({
				customer: customerId,
				status: 'trialing',
				limit: 1,
			});
		}
	} catch (e: unknown) {
		if (!isMissingStripeCustomer(e)) {
			console.error('[stripe checkout] list subscriptions', e);
			return json({ ok: false, error: 'Could not start checkout. Try again.' }, { status: 502 });
		}
		try {
			customerId = await createStripeCustomer();
			existingSubs = { data: [] };
			trialingSubs = { data: [] };
		} catch (createErr: unknown) {
			const msg = createErr instanceof Error ? createErr.message : 'Could not create Stripe customer';
			return json({ ok: false, error: msg }, { status: 500 });
		}
	}

	if (existingSubs.data.length > 0 || trialingSubs.data.length > 0) {
		const origin = new URL(request.url).origin;
		try {
			const portalSession = await stripe.billingPortal.sessions.create({
				customer: customerId,
				return_url: appUrl('/dashboard/settings?tab=billing', origin),
			});
			// Signal the client to redirect to the portal for plan changes.
			return json({ ok: true, url: portalSession.url, sessionId: null, portal: true });
		} catch {
			// Portal not configured — fall through and surface a clear message.
			return json(
				{
					ok: false,
					error:
						'You already have an active subscription. Go to Settings → Billing to change your plan.',
				},
				{ status: 409 },
			);
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
		const origin = new URL(request.url).origin;
		session = await stripe.checkout.sessions.create({
			mode: 'subscription',
			customer: customerId,
			client_reference_id: user.id,
			line_items: [{ price: priceId, quantity: 1 }],
			success_url: appUrl(`/checkout/success?session_id={CHECKOUT_SESSION_ID}`, origin),
			cancel_url: appUrl(`/checkout?plan=${plan}&interval=${interval}&canceled=1`, origin),
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
