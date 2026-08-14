import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/private';
import type Stripe from 'stripe';
import { adminClient } from '$lib/server/auth';
import {
	getStripe,
	mapSubscriptionStatus,
	planFromPriceId,
	subscriptionPeriodEnd,
	type PaidPlan,
} from '$lib/server/stripe';

/**
 * Stripe webhook — sole authority for plan changes.
 * Verifies signature; never trusts client-sent plan upgrades.
 */
export const POST: RequestHandler = async ({ request }) => {
	const secret = env.STRIPE_WEBHOOK_SECRET;
	if (!secret) {
		return json({ error: 'Webhook not configured' }, { status: 503 });
	}

	const signature = request.headers.get('stripe-signature');
	if (!signature) {
		return json({ error: 'Missing stripe-signature' }, { status: 400 });
	}

	const rawBody = await request.text();
	let event: Stripe.Event;
	try {
		const stripe = getStripe();
		event = stripe.webhooks.constructEvent(rawBody, signature, secret);
	} catch (err: any) {
		console.error('[stripe webhook] signature verify failed', err?.message);
		return json({ error: 'Invalid signature' }, { status: 400 });
	}

	const supabase = adminClient();

	try {
		switch (event.type) {
			case 'checkout.session.completed': {
				const session = event.data.object as Stripe.Checkout.Session;
				if (session.mode !== 'subscription') break;
				const userId =
					session.metadata?.supabase_user_id ||
					session.client_reference_id ||
					null;
				const customerId =
					typeof session.customer === 'string'
						? session.customer
						: session.customer?.id;
				const subscriptionId =
					typeof session.subscription === 'string'
						? session.subscription
						: session.subscription?.id;

				if (!userId || !subscriptionId) break;

				const stripe = getStripe();
				const sub = await stripe.subscriptions.retrieve(subscriptionId);
				const priceId = sub.items.data[0]?.price?.id;
				const plan =
					(session.metadata?.plan as PaidPlan | undefined) ||
					planFromPriceId(priceId) ||
					'creator';

				await supabase
					.from('users')
					.update({
						stripe_customer_id: customerId ?? undefined,
						stripe_subscription_id: subscriptionId,
						plan,
						plan_status: mapSubscriptionStatus(sub.status),
						current_period_end: subscriptionPeriodEnd(sub),
						updated_at: new Date().toISOString(),
					})
					.eq('id', userId);
				break;
			}

			case 'customer.subscription.updated':
			case 'customer.subscription.deleted': {
				const sub = event.data.object as Stripe.Subscription;
				const userId = sub.metadata?.supabase_user_id;
				const customerId =
					typeof sub.customer === 'string' ? sub.customer : sub.customer?.id;
				const priceId = sub.items.data[0]?.price?.id;
				const plan = planFromPriceId(priceId);

				const status = mapSubscriptionStatus(sub.status);
				const isGone =
					event.type === 'customer.subscription.deleted' ||
					status === 'canceled';

				const patch: Record<string, unknown> = {
					stripe_subscription_id: isGone ? null : sub.id,
					plan_status: isGone ? 'canceled' : status,
					current_period_end: isGone ? null : subscriptionPeriodEnd(sub),
					updated_at: new Date().toISOString(),
				};

				if (isGone) {
					patch.plan = 'free';
				} else if (plan) {
					patch.plan = plan;
				}

				if (userId) {
					await supabase.from('users').update(patch).eq('id', userId);
				} else if (customerId) {
					await supabase
						.from('users')
						.update(patch)
						.eq('stripe_customer_id', customerId);
				}
				break;
			}

			case 'invoice.paid':
			case 'invoice.payment_failed': {
				const invoice = event.data.object as Stripe.Invoice;
				const customerId =
					typeof invoice.customer === 'string'
						? invoice.customer
						: invoice.customer?.id;
				if (!customerId) break;

				const planStatus =
					event.type === 'invoice.paid' ? 'active' : 'past_due';
				await supabase
					.from('users')
					.update({
						plan_status: planStatus,
						updated_at: new Date().toISOString(),
					})
					.eq('stripe_customer_id', customerId);
				break;
			}

			default:
				break;
		}
	} catch (err: any) {
		console.error('[stripe webhook] handler error', event.type, err?.message);
		return json({ error: 'Handler failed' }, { status: 500 });
	}

	return json({ received: true });
};
