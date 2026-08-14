import { adminClient } from '$lib/server/auth';
import {
	carouselLimitForPlan,
	isPaidPlanActive,
	normalizePlanId,
	type PlanId,
} from '$lib/plan-entitlements';

/** @deprecated Use carousel token limits from plan entitlements instead. */
export const TRIAL_EXPORT_LIMIT = 5;

export type UsageStatus = {
	canGenerate: boolean;
	isPaid: boolean;
	used: number;
	limit: number | null;
	remaining: number | null;
	plan: PlanId;
	periodStart: string;
};

/** UTC calendar month key, e.g. `2026-08-01`. */
export function currentUsagePeriodStart(): string {
	const d = new Date();
	return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-01`;
}

type UserUsageRow = {
	plan: string | null;
	plan_status: string | null;
	carousel_tokens_used: number | null;
	usage_period_start: string | null;
};

async function fetchUserUsage(userId: string): Promise<UserUsageRow | null> {
	const supabase = adminClient();
	const { data, error } = await supabase
		.from('users')
		.select('plan, plan_status, carousel_tokens_used, usage_period_start')
		.eq('id', userId)
		.maybeSingle();
	if (error || !data) return null;
	return data as UserUsageRow;
}

/** Reset token counter when the billing month rolls over. */
async function ensureCurrentPeriod(userId: string): Promise<UserUsageRow | null> {
	const row = await fetchUserUsage(userId);
	if (!row) return null;

	const period = currentUsagePeriodStart();
	const stored = row.usage_period_start?.slice(0, 10) ?? null;
	if (stored === period) return row;

	const supabase = adminClient();
	const { data, error } = await supabase
		.from('users')
		.update({
			carousel_tokens_used: 0,
			usage_period_start: period,
			updated_at: new Date().toISOString(),
		})
		.eq('id', userId)
		.select('plan, plan_status, carousel_tokens_used, usage_period_start')
		.maybeSingle();

	if (error || !data) return { ...row, carousel_tokens_used: 0, usage_period_start: period };
	return data as UserUsageRow;
}

function buildStatus(row: UserUsageRow): UsageStatus {
	const plan = normalizePlanId(row.plan);
	const isPaid = isPaidPlanActive(plan, row.plan_status);
	const used = row.carousel_tokens_used ?? 0;
	const limit = carouselLimitForPlan(plan);
	const periodStart = row.usage_period_start?.slice(0, 10) ?? currentUsagePeriodStart();

	if (isPaid && limit === null) {
		return {
			canGenerate: true,
			isPaid: true,
			used,
			limit: null,
			remaining: null,
			plan,
			periodStart,
		};
	}

	const cap = limit ?? 0;
	const remaining = Math.max(0, cap - used);
	return {
		canGenerate: remaining > 0,
		isPaid,
		used,
		limit: cap,
		remaining,
		plan,
		periodStart,
	};
}

export async function getUsageStatus(userId: string): Promise<UsageStatus> {
	const row = await ensureCurrentPeriod(userId);
	if (!row) {
		const limit = carouselLimitForPlan('free') ?? 5;
		return {
			canGenerate: false,
			isPaid: false,
			used: limit,
			limit,
			remaining: 0,
			plan: 'free',
			periodStart: currentUsagePeriodStart(),
		};
	}
	return buildStatus(row);
}

/** Check whether the user can generate without incrementing usage. */
export async function canConsumeCarouselTokens(
	userId: string,
	count = 1,
): Promise<
	| { ok: true; status: UsageStatus }
	| { ok: false; error: string; code: 'LIMIT_REACHED'; status: UsageStatus }
> {
	const tokens = Math.max(1, Math.floor(count));
	const row = await ensureCurrentPeriod(userId);
	if (!row) {
		const status = await getUsageStatus(userId);
		return {
			ok: false,
			error: 'Could not verify usage. Try again.',
			code: 'LIMIT_REACHED',
			status,
		};
	}

	const status = buildStatus(row);
	if (status.isPaid && status.limit === null) {
		return { ok: true, status };
	}

	if (!status.canGenerate || (status.remaining ?? 0) < tokens) {
		const limit = status.limit ?? 5;
		return {
			ok: false,
			error: `You've used ${status.used}/${limit} carousel${limit === 1 ? '' : 's'} this month. Upgrade for more.`,
			code: 'LIMIT_REACHED',
			status,
		};
	}

	return { ok: true, status };
}

/**
 * Atomically consume carousel generation tokens (1 per deck / carousel).
 * Paid unlimited plans pass through without incrementing.
 */
export async function consumeCarouselTokens(
	userId: string,
	count = 1,
): Promise<
	| { ok: true; status: UsageStatus }
	| { ok: false; error: string; code: 'LIMIT_REACHED'; status: UsageStatus }
> {
	const tokens = Math.max(1, Math.floor(count));
	const precheck = await canConsumeCarouselTokens(userId, tokens);
	if (!precheck.ok) return precheck;

	const row = await fetchUserUsage(userId);
	if (!row) {
		return {
			ok: false,
			error: 'Could not verify usage. Try again.',
			code: 'LIMIT_REACHED',
			status: precheck.status,
		};
	}

	if (precheck.status.isPaid && precheck.status.limit === null) {
		return { ok: true, status: precheck.status };
	}

	const supabase = adminClient();
	const used = row.carousel_tokens_used ?? 0;
	const { data, error } = await supabase
		.from('users')
		.update({
			carousel_tokens_used: used + tokens,
			usage_period_start: precheck.status.periodStart,
			updated_at: new Date().toISOString(),
		})
		.eq('id', userId)
		.eq('carousel_tokens_used', used)
		.select('carousel_tokens_used')
		.maybeSingle();

	if (error || !data) {
		const retry = await getUsageStatus(userId);
		if (!retry.canGenerate || (retry.remaining ?? 0) < tokens) {
			const limit = retry.limit ?? 5;
			return {
				ok: false,
				error: `You've used ${retry.used}/${limit} carousel${limit === 1 ? '' : 's'} this month. Upgrade for more.`,
				code: 'LIMIT_REACHED',
				status: retry,
			};
		}
		return {
			ok: false,
			error: 'Could not record usage. Try again.',
			code: 'LIMIT_REACHED',
			status: retry,
		};
	}

	const next = await getUsageStatus(userId);
	return { ok: true, status: next };
}

/** @deprecated Prefer getUsageStatus — kept for settings/export compatibility. */
export async function getTrialStatus(userId: string): Promise<UsageStatus> {
	return getUsageStatus(userId);
}

/** @deprecated Export no longer consumes tokens; generation does. Always allows export. */
export async function consumeTrialExport(userId: string): Promise<
	| { ok: true; status: UsageStatus }
	| { ok: false; error: string; status: UsageStatus }
> {
	const status = await getUsageStatus(userId);
	if (status.isPaid) return { ok: true, status };
	// Free users can export content they create; carousel generation is gated separately.
	return { ok: true, status };
}
