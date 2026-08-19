/** Plan limits and feature gates — single source of truth for server + client catalog. */

export const PLAN_IDS = ['free', 'hobby', 'creator', 'business'] as const;
export type PlanId = (typeof PLAN_IDS)[number];
export type PaidPlanId = Exclude<PlanId, 'free'>;

/** Legacy plan ids stored before the 4-tier rollout. */
const LEGACY_PLAN_MAP: Record<string, PlanId> = {
	pro: 'creator',
	agency: 'business',
};

export function normalizePlanId(plan: string | null | undefined): PlanId {
	const p = (plan ?? 'free').toLowerCase();
	if (LEGACY_PLAN_MAP[p]) return LEGACY_PLAN_MAP[p];
	if ((PLAN_IDS as readonly string[]).includes(p)) return p as PlanId;
	return 'free';
}

export type PlanEntitlements = {
	/** Carousels (AI generate-slides decks) allowed per calendar month. `null` = unlimited. */
	carouselsPerMonth: number | null;
	/** Fal / Vertex AI images per calendar month. `null` = unlimited. Free = 0 (stock only). */
	aiImagesPerMonth: number | null;
	/**
	 * Source video minutes for clip finder (`/api/videos/analyze`) per calendar month.
	 * Billed as ceil(durationSec / 60) per job. `null` = unlimited.
	 */
	clipMinutesPerMonth: number | null;
	/** Max single source video length in minutes for clipping. */
	maxClipVideoMinutes: number;
	captionStyles: number | 'all';
	watermark: boolean;
	competitorTracks: number | null;
	/** Max bytes for a single file upload (images or videos). */
	maxUploadBytes: number;
};

export const PLAN_ENTITLEMENTS: Record<PlanId, PlanEntitlements> = {
	free: {
		carouselsPerMonth: 3,
		aiImagesPerMonth: 0,
		clipMinutesPerMonth: 60,
		maxClipVideoMinutes: 20,
		captionStyles: 1,
		watermark: true,
		competitorTracks: 3,
		maxUploadBytes: 25 * 1024 * 1024, // 25 MB
	},
	hobby: {
		carouselsPerMonth: 45,
		aiImagesPerMonth: 50,
		clipMinutesPerMonth: 180,
		maxClipVideoMinutes: 60,
		captionStyles: 5,
		watermark: true,
		competitorTracks: 10,
		maxUploadBytes: 150 * 1024 * 1024, // 150 MB
	},
	creator: {
		carouselsPerMonth: 100,
		aiImagesPerMonth: 120,
		clipMinutesPerMonth: 600,
		maxClipVideoMinutes: 180,
		captionStyles: 'all',
		watermark: false,
		competitorTracks: 25,
		maxUploadBytes: 350 * 1024 * 1024, // 350 MB
	},
	business: {
		carouselsPerMonth: null,
		aiImagesPerMonth: 400,
		clipMinutesPerMonth: 2000,
		maxClipVideoMinutes: 240,
		captionStyles: 'all',
		watermark: false,
		competitorTracks: null,
		maxUploadBytes: 500 * 1024 * 1024, // 500 MB
	},
};

export function carouselLimitForPlan(plan: string | null | undefined): number | null {
	return PLAN_ENTITLEMENTS[normalizePlanId(plan)].carouselsPerMonth;
}

export function aiImageLimitForPlan(plan: string | null | undefined): number | null {
	return PLAN_ENTITLEMENTS[normalizePlanId(plan)].aiImagesPerMonth;
}

export function clipMinutesLimitForPlan(plan: string | null | undefined): number | null {
	return PLAN_ENTITLEMENTS[normalizePlanId(plan)].clipMinutesPerMonth;
}

export function maxClipVideoMinutesForPlan(plan: string | null | undefined): number {
	return PLAN_ENTITLEMENTS[normalizePlanId(plan)].maxClipVideoMinutes;
}

export function maxUploadBytesForPlan(plan: string | null | undefined): number {
	return PLAN_ENTITLEMENTS[normalizePlanId(plan)].maxUploadBytes;
}

export function formatUploadLimit(bytes: number): string {
	return `${Math.round(bytes / (1024 * 1024))} MB`;
}

/** Billable minutes for a source duration (always ≥ 1 when duration > 0). */
export function clipMinutesFromDurationSec(durationSec: number): number {
	const sec = Math.max(0, Number(durationSec) || 0);
	if (sec <= 0) return 1;
	return Math.max(1, Math.ceil(sec / 60));
}

export function isPaidPlanActive(
	plan: string | null | undefined,
	planStatus: string | null | undefined,
): boolean {
	const id = normalizePlanId(plan);
	if (id === 'free') return false;
	return ['active', 'trialing'].includes(planStatus ?? '');
}

/**
 * Account deletion is allowed only on Free with no Stripe subscription.
 * Cancel-at-period-end still has a subscription id until the period ends.
 */
export function canDeleteAccount(opts: {
	plan?: string | null;
	planStatus?: string | null;
	hasSubscription?: boolean;
}): boolean {
	if (opts.hasSubscription) return false;
	if (normalizePlanId(opts.plan) !== 'free') return false;
	const status = String(opts.planStatus ?? '').toLowerCase();
	return !['active', 'trialing', 'past_due'].includes(status);
}
