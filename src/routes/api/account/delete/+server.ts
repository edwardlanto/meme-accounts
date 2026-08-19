import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { adminClient } from '$lib/server/auth';
import { canDeleteAccount } from '$lib/plan-entitlements';
import { r2DeleteOwnerPrefix } from '$lib/server/r2';

/**
 * Permanently delete the signed-in user.
 * Requires a canceled / Free account with no Stripe subscription.
 * Purges R2 uploads under `{userId}/`, then removes auth.users
 * (public.users and related rows cascade).
 */
export const POST: RequestHandler = async ({ request, locals }) => {
	const { user } = await locals.safeGetSession();
	if (!user?.id) {
		return json({ ok: false, error: 'Sign in required' }, { status: 401 });
	}

	let confirm = '';
	try {
		const body = await request.json();
		confirm = String(body?.confirm ?? '').trim();
	} catch {
		return json({ ok: false, error: 'Invalid request body' }, { status: 400 });
	}

	const email = String(user.email ?? '').trim().toLowerCase();
	if (!confirm || confirm.toLowerCase() !== email) {
		return json(
			{ ok: false, error: 'Type your account email to confirm deletion' },
			{ status: 400 },
		);
	}

	const supabase = adminClient();
	const { data: profile } = await supabase
		.from('users')
		.select('plan, plan_status, stripe_subscription_id')
		.eq('id', user.id)
		.maybeSingle();

	if (
		!canDeleteAccount({
			plan: profile?.plan,
			planStatus: profile?.plan_status,
			hasSubscription: Boolean(profile?.stripe_subscription_id),
		})
	) {
		return json(
			{
				ok: false,
				error:
					'Cancel your subscription first. You can delete your account after you are back on the Free plan.',
				code: 'PLAN_ACTIVE',
			},
			{ status: 403 },
		);
	}

	// Purge uploaded media before auth delete (keys are `{userId}/…`).
	try {
		const { deleted } = await r2DeleteOwnerPrefix(user.id);
		console.info(`[account/delete] purged ${deleted} R2 object(s) for ${user.id}`);
	} catch (e) {
		console.warn('[account/delete] R2 purge failed (continuing with account delete)', e);
	}

	const { error } = await supabase.auth.admin.deleteUser(user.id);
	if (error) {
		console.error('[account/delete]', error.message);
		return json({ ok: false, error: error.message }, { status: 500 });
	}

	return json({ ok: true });
};
