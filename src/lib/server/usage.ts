import { adminClient } from '$lib/server/auth';
import {
	aiImageLimitForPlan,
	carouselLimitForPlan,
	clipMinutesFromDurationSec,
	clipMinutesLimitForPlan,
	isPaidPlanActive,
	maxClipVideoMinutesForPlan,
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
	/** AI image (Fal/Vertex) usage this month. */
	aiImagesUsed: number;
	aiImagesLimit: number | null;
	aiImagesRemaining: number | null;
	canGenerateAiImage: boolean;
	/** Video clip finder source minutes this month. */
	clipMinutesUsed: number;
	clipMinutesLimit: number | null;
	clipMinutesRemaining: number | null;
	canAnalyzeClips: boolean;
	maxClipVideoMinutes: number;
	/** Lifetime decks created (not reset monthly). */
	slideshowsGenerated: number;
	/** Lifetime slides created (not reset monthly). */
	slidesGenerated: number;
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
	ai_images_used: number | null;
	clip_minutes_used: number | null;
	usage_period_start: string | null;
	slideshows_generated: number | null;
	slides_generated: number | null;
};

const USAGE_SELECT =
	'plan, plan_status, carousel_tokens_used, ai_images_used, clip_minutes_used, usage_period_start, slideshows_generated, slides_generated';
const USAGE_SELECT_NO_GEN =
	'plan, plan_status, carousel_tokens_used, ai_images_used, clip_minutes_used, usage_period_start';
const USAGE_SELECT_NO_CLIP =
	'plan, plan_status, carousel_tokens_used, ai_images_used, usage_period_start';
const USAGE_SELECT_LEGACY = 'plan, plan_status, carousel_tokens_used, usage_period_start';

function isMissingColumn(message: string | undefined, column: string): boolean {
	return new RegExp(column, 'i').test(message ?? '');
}

async function fetchUserUsage(userId: string): Promise<UserUsageRow | null> {
	const supabase = adminClient();
	const primary = await supabase.from('users').select(USAGE_SELECT).eq('id', userId).maybeSingle();

	if (!primary.error && primary.data) {
		return primary.data as UserUsageRow;
	}

	if (primary.error && isMissingColumn(primary.error.message, 'slideshows_generated')) {
		console.warn(
			'[usage] slideshows_generated missing — apply supabase/migrations/025_generation_totals.sql',
		);
		const noGen = await supabase
			.from('users')
			.select(USAGE_SELECT_NO_GEN)
			.eq('id', userId)
			.maybeSingle();
		if (!noGen.error && noGen.data) {
			return {
				...(noGen.data as UserUsageRow),
				slideshows_generated: 0,
				slides_generated: 0,
			};
		}
		if (noGen.error && isMissingColumn(noGen.error.message, 'clip_minutes_used')) {
			return fetchUserUsageWithoutClip(userId);
		}
		if (noGen.error) {
			console.error('[usage] fetchUserUsage no-gen failed', noGen.error.message);
			return null;
		}
	}

	if (primary.error && isMissingColumn(primary.error.message, 'clip_minutes_used')) {
		return fetchUserUsageWithoutClip(userId);
	}

	if (primary.error && isMissingColumn(primary.error.message, 'ai_images_used')) {
		return fetchUserUsageLegacy(userId);
	}

	if (primary.error) {
		console.error('[usage] fetchUserUsage failed', primary.error.message);
	}
	return null;
}

async function fetchUserUsageWithoutClip(userId: string): Promise<UserUsageRow | null> {
	const supabase = adminClient();
	console.warn(
		'[usage] clip_minutes_used missing — apply supabase/migrations/024_clip_minutes_used.sql',
	);
	const mid = await supabase
		.from('users')
		.select(USAGE_SELECT_NO_CLIP)
		.eq('id', userId)
		.maybeSingle();
	if (!mid.error && mid.data) {
		return {
			...(mid.data as UserUsageRow),
			clip_minutes_used: 0,
			slideshows_generated: 0,
			slides_generated: 0,
		};
	}
	if (mid.error && isMissingColumn(mid.error.message, 'ai_images_used')) {
		return fetchUserUsageLegacy(userId);
	}
	console.error('[usage] fetchUserUsage mid failed', mid.error?.message);
	return null;
}

async function fetchUserUsageLegacy(userId: string): Promise<UserUsageRow | null> {
	const supabase = adminClient();
	console.warn(
		'[usage] ai_images_used missing — apply supabase/migrations/023_ai_images_used.sql',
	);
	const legacy = await supabase
		.from('users')
		.select(USAGE_SELECT_LEGACY)
		.eq('id', userId)
		.maybeSingle();
	if (legacy.error || !legacy.data) {
		console.error('[usage] fetchUserUsage legacy failed', legacy.error?.message);
		return null;
	}
	return {
		...(legacy.data as UserUsageRow),
		ai_images_used: 0,
		clip_minutes_used: 0,
		slideshows_generated: 0,
		slides_generated: 0,
	};
}

/** Reset token counters when the billing month rolls over. */
async function ensureCurrentPeriod(userId: string): Promise<UserUsageRow | null> {
	const row = await fetchUserUsage(userId);
	if (!row) return null;

	const period = currentUsagePeriodStart();
	const stored = row.usage_period_start?.slice(0, 10) ?? null;
	if (stored === period) return row;

	const supabase = adminClient();
	const resetRow: UserUsageRow = {
		...row,
		carousel_tokens_used: 0,
		ai_images_used: 0,
		clip_minutes_used: 0,
		usage_period_start: period,
	};

	const primary = await supabase
		.from('users')
		.update({
			carousel_tokens_used: 0,
			ai_images_used: 0,
			clip_minutes_used: 0,
			usage_period_start: period,
			updated_at: new Date().toISOString(),
		})
		.eq('id', userId)
		.select(USAGE_SELECT)
		.maybeSingle();

	if (!primary.error && primary.data) {
		return primary.data as UserUsageRow;
	}

	if (primary.error && isMissingColumn(primary.error.message, 'slideshows_generated')) {
		const noGen = await supabase
			.from('users')
			.update({
				carousel_tokens_used: 0,
				ai_images_used: 0,
				clip_minutes_used: 0,
				usage_period_start: period,
				updated_at: new Date().toISOString(),
			})
			.eq('id', userId)
			.select(USAGE_SELECT_NO_GEN)
			.maybeSingle();
		if (!noGen.error && noGen.data) {
			return {
				...(noGen.data as UserUsageRow),
				slideshows_generated: 0,
				slides_generated: 0,
			};
		}
		if (noGen.error && isMissingColumn(noGen.error.message, 'clip_minutes_used')) {
			/* fall through to clip fallback */
		} else if (noGen.error && isMissingColumn(noGen.error.message, 'ai_images_used')) {
			/* fall through to clip then legacy */
		}
	}

	if (primary.error && isMissingColumn(primary.error.message, 'clip_minutes_used')) {
		const mid = await supabase
			.from('users')
			.update({
				carousel_tokens_used: 0,
				ai_images_used: 0,
				usage_period_start: period,
				updated_at: new Date().toISOString(),
			})
			.eq('id', userId)
			.select(USAGE_SELECT_NO_CLIP)
			.maybeSingle();
		if (!mid.error && mid.data) {
			return { ...(mid.data as UserUsageRow), clip_minutes_used: 0 };
		}
		if (mid.error && isMissingColumn(mid.error.message, 'ai_images_used')) {
			const legacy = await supabase
				.from('users')
				.update({
					carousel_tokens_used: 0,
					usage_period_start: period,
					updated_at: new Date().toISOString(),
				})
				.eq('id', userId)
				.select(USAGE_SELECT_LEGACY)
				.maybeSingle();
			if (!legacy.error && legacy.data) {
				return {
					...(legacy.data as UserUsageRow),
					ai_images_used: 0,
					clip_minutes_used: 0,
				};
			}
		}
	}

	if (primary.error) {
		console.error('[usage] ensureCurrentPeriod update failed', primary.error.message);
	}
	return resetRow;
}

function buildAiImageFields(row: UserUsageRow, plan: PlanId, isPaid: boolean) {
	const aiImagesUsed = row.ai_images_used ?? 0;
	const aiImagesLimit = aiImageLimitForPlan(plan);
	/* Free (and any 0-cap plan): no AI images — stock only. */
	if (aiImagesLimit === 0) {
		return {
			aiImagesUsed,
			aiImagesLimit: 0,
			aiImagesRemaining: 0,
			canGenerateAiImage: false,
		};
	}
	if (aiImagesLimit === null) {
		return {
			aiImagesUsed,
			aiImagesLimit: null,
			aiImagesRemaining: null,
			canGenerateAiImage: isPaid,
		};
	}
	const aiImagesRemaining = Math.max(0, aiImagesLimit - aiImagesUsed);
	return {
		aiImagesUsed,
		aiImagesLimit,
		aiImagesRemaining,
		canGenerateAiImage: aiImagesRemaining > 0,
	};
}

function buildClipMinuteFields(row: UserUsageRow, plan: PlanId) {
	const clipMinutesUsed = row.clip_minutes_used ?? 0;
	const clipMinutesLimit = clipMinutesLimitForPlan(plan);
	const maxClipVideoMinutes = maxClipVideoMinutesForPlan(plan);
	if (clipMinutesLimit === null) {
		return {
			clipMinutesUsed,
			clipMinutesLimit: null,
			clipMinutesRemaining: null,
			canAnalyzeClips: true,
			maxClipVideoMinutes,
		};
	}
	const clipMinutesRemaining = Math.max(0, clipMinutesLimit - clipMinutesUsed);
	return {
		clipMinutesUsed,
		clipMinutesLimit,
		clipMinutesRemaining,
		canAnalyzeClips: clipMinutesRemaining > 0,
		maxClipVideoMinutes,
	};
}

function buildStatus(row: UserUsageRow): UsageStatus {
	const plan = normalizePlanId(row.plan);
	const isPaid = isPaidPlanActive(plan, row.plan_status);
	const used = row.carousel_tokens_used ?? 0;
	const limit = carouselLimitForPlan(plan);
	const periodStart = row.usage_period_start?.slice(0, 10) ?? currentUsagePeriodStart();
	const ai = buildAiImageFields(row, plan, isPaid);
	const clips = buildClipMinuteFields(row, plan);
	const generated = {
		slideshowsGenerated: Math.max(0, row.slideshows_generated ?? 0),
		slidesGenerated: Math.max(0, row.slides_generated ?? 0),
	};

	if (isPaid && limit === null) {
		return {
			canGenerate: true,
			isPaid: true,
			used,
			limit: null,
			remaining: null,
			plan,
			periodStart,
			...ai,
			...clips,
			...generated,
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
		...ai,
		...clips,
		...generated,
	};
}

function emptyStatus(overrides?: Partial<UsageStatus>): UsageStatus {
	const limit = carouselLimitForPlan('free') ?? 5;
	const clipLimit = clipMinutesLimitForPlan('free') ?? 60;
	return {
		canGenerate: false,
		isPaid: false,
		used: limit,
		limit,
		remaining: 0,
		plan: 'free',
		periodStart: currentUsagePeriodStart(),
		aiImagesUsed: 0,
		aiImagesLimit: 0,
		aiImagesRemaining: 0,
		canGenerateAiImage: false,
		clipMinutesUsed: 0,
		clipMinutesLimit: clipLimit,
		clipMinutesRemaining: 0,
		canAnalyzeClips: false,
		maxClipVideoMinutes: maxClipVideoMinutesForPlan('free'),
		slideshowsGenerated: 0,
		slidesGenerated: 0,
		...overrides,
	};
}

/** Lightweight plan lookup — avoids full usage calculation when only the plan tier is needed. */
export async function getUserPlan(userId: string): Promise<import('$lib/plan-entitlements').PlanId> {
	const supabase = adminClient();
	const { data } = await supabase.from('users').select('plan').eq('id', userId).maybeSingle();
	return normalizePlanId((data as { plan?: string } | null)?.plan);
}

export async function getUsageStatus(userId: string): Promise<UsageStatus> {
	const row = await ensureCurrentPeriod(userId);
	if (!row) return emptyStatus();
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

async function bumpGenerationTotals(
	userId: string,
	decks: number,
	slides: number,
	row: UserUsageRow,
) {
	const supabase = adminClient();
	const { error } = await supabase
		.from('users')
		.update({
			slideshows_generated: Math.max(0, row.slideshows_generated ?? 0) + decks,
			slides_generated: Math.max(0, row.slides_generated ?? 0) + slides,
			updated_at: new Date().toISOString(),
		})
		.eq('id', userId);
	if (error && isMissingColumn(error.message, 'slideshows_generated')) {
		console.warn(
			'[usage] slideshows_generated missing — apply supabase/migrations/025_generation_totals.sql',
		);
	} else if (error) {
		console.warn('[usage] bumpGenerationTotals failed', error.message);
	}
}

export async function getGenerationOverview(userId: string): Promise<{
	slideshows: number;
	slides: number;
}> {
	const status = await getUsageStatus(userId);
	let bulkShows = 0;
	let bulkSlides = 0;
	try {
		const { listBulkWorkspaces } = await import('$lib/server/bulk-workspaces');
		const rows = await listBulkWorkspaces(userId, 100);
		for (const row of rows) {
			for (const show of row.shows ?? []) {
				bulkShows += 1;
				bulkSlides += Array.isArray(show.slides) ? show.slides.length : 0;
			}
		}
	} catch {
		/* library count is a floor, not required */
	}
	return {
		slideshows: Math.max(status.slideshowsGenerated, bulkShows),
		slides: Math.max(status.slidesGenerated, bulkSlides),
	};
}

/**
 * Atomically consume carousel generation tokens (1 per deck / carousel).
 * Paid unlimited plans skip the monthly cap but still record lifetime totals.
 */
export async function consumeCarouselTokens(
	userId: string,
	count = 1,
	opts?: { slides?: number },
): Promise<
	| { ok: true; status: UsageStatus }
	| { ok: false; error: string; code: 'LIMIT_REACHED'; status: UsageStatus }
> {
	const tokens = Math.max(1, Math.floor(count));
	const slideN = Math.max(tokens, Math.floor(Number(opts?.slides) || tokens));
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

	const unlimited = precheck.status.isPaid && precheck.status.limit === null;
	await bumpGenerationTotals(userId, tokens, slideN, row);

	if (unlimited) {
		return { ok: true, status: await getUsageStatus(userId) };
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

/** Check whether the user can generate AI images without incrementing. */
export async function canConsumeAiImages(
	userId: string,
	count = 1,
): Promise<
	| { ok: true; status: UsageStatus }
	| { ok: false; error: string; code: 'AI_IMAGE_LIMIT' | 'LIMIT_REACHED'; status: UsageStatus }
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
	if (status.aiImagesLimit === 0) {
		return {
			ok: false,
			error: 'AI images are not included on Free. Use stock photos or upgrade to Hobby.',
			code: 'AI_IMAGE_LIMIT',
			status,
		};
	}
	if (status.aiImagesLimit === null) {
		return { ok: true, status };
	}
	if ((status.aiImagesRemaining ?? 0) < tokens) {
		const limit = status.aiImagesLimit;
		return {
			ok: false,
			error: `You've used ${status.aiImagesUsed}/${limit} AI image${limit === 1 ? '' : 's'} this month. Upgrade for more.`,
			code: 'AI_IMAGE_LIMIT',
			status,
		};
	}
	return { ok: true, status };
}

/** Atomically consume AI image generation tokens (1 per Fal/Vertex call that returns an image). */
export async function consumeAiImages(
	userId: string,
	count = 1,
): Promise<
	| { ok: true; status: UsageStatus }
	| { ok: false; error: string; code: 'AI_IMAGE_LIMIT' | 'LIMIT_REACHED'; status: UsageStatus }
> {
	const tokens = Math.max(1, Math.floor(count));
	const precheck = await canConsumeAiImages(userId, tokens);
	if (!precheck.ok) return precheck;

	if (precheck.status.aiImagesLimit === null) {
		return { ok: true, status: precheck.status };
	}

	const row = await fetchUserUsage(userId);
	if (!row) {
		return {
			ok: false,
			error: 'Could not verify usage. Try again.',
			code: 'LIMIT_REACHED',
			status: precheck.status,
		};
	}

	const supabase = adminClient();
	const used = row.ai_images_used ?? 0;
	const { data, error } = await supabase
		.from('users')
		.update({
			ai_images_used: used + tokens,
			usage_period_start: precheck.status.periodStart,
			updated_at: new Date().toISOString(),
		})
		.eq('id', userId)
		.eq('ai_images_used', used)
		.select('ai_images_used')
		.maybeSingle();

	if (error || !data) {
		const retry = await getUsageStatus(userId);
		if (!retry.canGenerateAiImage || (retry.aiImagesRemaining ?? 0) < tokens) {
			const limit = retry.aiImagesLimit ?? 0;
			return {
				ok: false,
				error:
					limit === 0
						? 'AI images are not included on Free. Use stock photos or upgrade to Hobby.'
						: `You've used ${retry.aiImagesUsed}/${limit} AI image${limit === 1 ? '' : 's'} this month. Upgrade for more.`,
				code: 'AI_IMAGE_LIMIT',
				status: retry,
			};
		}
		return {
			ok: false,
			error: 'Could not record AI image usage. Try again.',
			code: 'LIMIT_REACHED',
			status: retry,
		};
	}

	const next = await getUsageStatus(userId);
	return { ok: true, status: next };
}

/** Check whether a clip-analyze job of `durationSec` fits plan max + monthly minutes. */
export async function canConsumeClipMinutes(
	userId: string,
	durationSec: number,
): Promise<
	| { ok: true; status: UsageStatus; minutes: number }
	| {
			ok: false;
			error: string;
			code: 'CLIP_LIMIT' | 'CLIP_TOO_LONG' | 'LIMIT_REACHED';
			status: UsageStatus;
			minutes: number;
	  }
> {
	const minutes = clipMinutesFromDurationSec(durationSec);
	const row = await ensureCurrentPeriod(userId);
	if (!row) {
		const status = await getUsageStatus(userId);
		return {
			ok: false,
			error: 'Could not verify usage. Try again.',
			code: 'LIMIT_REACHED',
			status,
			minutes,
		};
	}

	const status = buildStatus(row);
	const maxMin = status.maxClipVideoMinutes;
	const durationMin = Math.max(0, Number(durationSec) || 0) / 60;
	if (durationMin > maxMin + 0.05) {
		return {
			ok: false,
			error: `Videos longer than ${maxMin} minutes aren't allowed on your plan. Upgrade for longer clips.`,
			code: 'CLIP_TOO_LONG',
			status,
			minutes,
		};
	}

	if (status.clipMinutesLimit === null) {
		return { ok: true, status, minutes };
	}
	if ((status.clipMinutesRemaining ?? 0) < minutes) {
		const limit = status.clipMinutesLimit;
		return {
			ok: false,
			error: `You've used ${status.clipMinutesUsed}/${limit} clip minutes this month. This video needs ${minutes} min. Upgrade for more.`,
			code: 'CLIP_LIMIT',
			status,
			minutes,
		};
	}
	return { ok: true, status, minutes };
}

/** Atomically consume clip minutes after a successful analyze. */
export async function consumeClipMinutes(
	userId: string,
	durationSec: number,
): Promise<
	| { ok: true; status: UsageStatus; minutes: number }
	| {
			ok: false;
			error: string;
			code: 'CLIP_LIMIT' | 'CLIP_TOO_LONG' | 'LIMIT_REACHED';
			status: UsageStatus;
			minutes: number;
	  }
> {
	const precheck = await canConsumeClipMinutes(userId, durationSec);
	if (!precheck.ok) return precheck;

	const minutes = precheck.minutes;
	if (precheck.status.clipMinutesLimit === null) {
		return { ok: true, status: precheck.status, minutes };
	}

	const row = await fetchUserUsage(userId);
	if (!row) {
		return {
			ok: false,
			error: 'Could not verify usage. Try again.',
			code: 'LIMIT_REACHED',
			status: precheck.status,
			minutes,
		};
	}

	const supabase = adminClient();
	const used = row.clip_minutes_used ?? 0;
	const { data, error } = await supabase
		.from('users')
		.update({
			clip_minutes_used: used + minutes,
			usage_period_start: precheck.status.periodStart,
			updated_at: new Date().toISOString(),
		})
		.eq('id', userId)
		.eq('clip_minutes_used', used)
		.select('clip_minutes_used')
		.maybeSingle();

	if (error || !data) {
		if (error && isMissingColumn(error.message, 'clip_minutes_used')) {
			console.warn(
				'[usage] clip_minutes_used missing — apply supabase/migrations/024_clip_minutes_used.sql',
			);
			/* Allow analyze until migration is applied; do not soft-bill. */
			return { ok: true, status: precheck.status, minutes };
		}
		const retry = await canConsumeClipMinutes(userId, durationSec);
		if (!retry.ok) return retry;
		return {
			ok: false,
			error: 'Could not record clip usage. Try again.',
			code: 'LIMIT_REACHED',
			status: retry.status,
			minutes,
		};
	}

	const next = await getUsageStatus(userId);
	return { ok: true, status: next, minutes };
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
