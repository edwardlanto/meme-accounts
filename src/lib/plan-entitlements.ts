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
	captionStyles: number | 'all';
	watermark: boolean;
	competitorTracks: number | null;
};

export const PLAN_ENTITLEMENTS: Record<PlanId, PlanEntitlements> = {
	free: {
		carouselsPerMonth: 5,
		captionStyles: 1,
		watermark: true,
		competitorTracks: 3,
	},
	hobby: {
		carouselsPerMonth: 30,
		captionStyles: 5,
		watermark: true,
		competitorTracks: 10,
	},
	creator: {
		carouselsPerMonth: 100,
		captionStyles: 'all',
		watermark: false,
		competitorTracks: 25,
	},
	business: {
		carouselsPerMonth: null,
		captionStyles: 'all',
		watermark: false,
		competitorTracks: null,
	},
};

export function carouselLimitForPlan(plan: string | null | undefined): number | null {
	return PLAN_ENTITLEMENTS[normalizePlanId(plan)].carouselsPerMonth;
}

export function isPaidPlanActive(
	plan: string | null | undefined,
	planStatus: string | null | undefined,
): boolean {
	const id = normalizePlanId(plan);
	if (id === 'free') return false;
	return ['active', 'trialing'].includes(planStatus ?? '');
}
