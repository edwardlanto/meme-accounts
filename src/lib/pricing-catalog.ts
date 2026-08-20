/** Shared plan catalog for client pages (mirrors server catalog — prices only; Stripe price IDs stay server-side). */
/** Clip-minute bullets omitted while `CLIP_FINDER_ENABLED` is false — restore from plan-entitlements when shipping Clips. */
import { PLAN_ENTITLEMENTS } from '$lib/plan-entitlements';

export const PLAN_CATALOG = {
	free: {
		id: 'free' as const,
		name: 'Free',
		tagline: 'No card needed. Forever free.',
		monthly: 0,
		yearly: 0,
		carouselsPerMonth: PLAN_ENTITLEMENTS.free.carouselsPerMonth!,
		features: [
			'3 carousels / month',
			'Stock photos only (no AI)',
			'Studio canvas editor',
			'News + text templates',
			'Watermark on exports',
		],
	},
	hobby: {
		id: 'hobby' as const,
		name: 'Hobby',
		tagline: 'For creators posting a few times a week.',
		monthly: 19,
		yearly: 157,
		carouselsPerMonth: PLAN_ENTITLEMENTS.hobby.carouselsPerMonth!,
		features: [
			'45 carousels / month',
			'30 AI images / month',
			'Bulk generate (multi-deck AI)',
			'News-to-Post',
			'Word highlights',
			'Brand kit + saved templates',
		],
	},
	creator: {
		id: 'creator' as const,
		name: 'Creator',
		tagline: 'For creators who ship every week.',
		monthly: 29,
		yearly: 239,
		carouselsPerMonth: PLAN_ENTITLEMENTS.creator.carouselsPerMonth!,
		features: [
			'100 carousels / month',
			'80 AI images / month',
			'No watermark',
			'Full canvas + HD export',
			'Brand kit + saved templates',
			'Everything in Hobby',
		],
	},
	business: {
		id: 'business' as const,
		name: 'Business',
		tagline: 'For teams managing multiple brands.',
		monthly: 49,
		yearly: 399,
		carouselsPerMonth: null,
		features: [
			'Unlimited carousels',
			'200 AI images / month',
			'Everything in Creator',
			'Team workspace',
			'API access',
			'Priority support',
		],
	},
} as const;

export type PlanId = keyof typeof PLAN_CATALOG;
export type PaidPlanId = Exclude<PlanId, 'free'>;

export const PAID_PLAN_IDS: PaidPlanId[] = ['hobby', 'creator', 'business'];
