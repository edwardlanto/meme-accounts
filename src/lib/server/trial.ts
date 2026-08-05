import { adminClient } from '$lib/server/auth';

/** Free-plan users may export this many posts before upgrading. */
export const TRIAL_EXPORT_LIMIT = 1;

export type TrialStatus = {
	canExport: boolean;
	isPaid: boolean;
	used: number;
	limit: number;
	remaining: number;
	plan: 'free' | 'pro' | 'agency';
};

export async function getTrialStatus(userId: string): Promise<TrialStatus> {
	const supabase = adminClient();
	const { data, error } = await supabase
		.from('users')
		.select('plan, plan_status, trial_exports_used')
		.eq('id', userId)
		.maybeSingle();

	if (error || !data) {
		return {
			canExport: false,
			isPaid: false,
			used: TRIAL_EXPORT_LIMIT,
			limit: TRIAL_EXPORT_LIMIT,
			remaining: 0,
			plan: 'free',
		};
	}

	const plan = (data.plan ?? 'free') as TrialStatus['plan'];
	const used = data.trial_exports_used ?? 0;
	const isPaid =
		(plan === 'pro' || plan === 'agency') &&
		['active', 'trialing'].includes(data.plan_status ?? '');

	if (isPaid) {
		return {
			canExport: true,
			isPaid: true,
			used,
			limit: TRIAL_EXPORT_LIMIT,
			remaining: Infinity,
			plan,
		};
	}

	const remaining = Math.max(0, TRIAL_EXPORT_LIMIT - used);
	return {
		canExport: remaining > 0,
		isPaid: false,
		used,
		limit: TRIAL_EXPORT_LIMIT,
		remaining,
		plan,
	};
}

/**
 * Atomically consume one trial export for free users.
 * Paid users pass through without incrementing.
 */
export async function consumeTrialExport(userId: string): Promise<
	| { ok: true; status: TrialStatus }
	| { ok: false; error: string; status: TrialStatus }
> {
	const status = await getTrialStatus(userId);
	if (status.isPaid) return { ok: true, status };
	if (!status.canExport) {
		return {
			ok: false,
			error: 'Trial limit reached. Upgrade to export more posts.',
			status,
		};
	}

	const supabase = adminClient();
	const { data, error } = await supabase
		.from('users')
		.update({
			trial_exports_used: status.used + 1,
			updated_at: new Date().toISOString(),
		})
		.eq('id', userId)
		.eq('trial_exports_used', status.used)
		.select('trial_exports_used')
		.maybeSingle();

	if (error || !data) {
		const retry = await getTrialStatus(userId);
		if (!retry.canExport) {
			return {
				ok: false,
				error: 'Trial limit reached. Upgrade to export more posts.',
				status: retry,
			};
		}
		return { ok: false, error: 'Could not record export. Try again.', status: retry };
	}

	const next = await getTrialStatus(userId);
	return { ok: true, status: next };
}
