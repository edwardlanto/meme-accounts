/** Shared plan catalog for client pages (mirrors server catalog — prices only; Stripe price IDs stay server-side). */
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
			'5 carousels / month',
			'1 caption style',
			'3 competitor tracks',
			'Basic canvas editor',
			'Watermark on exports',
		],
	},
	hobby: {
		id: 'hobby' as const,
		name: 'Hobby',
		tagline: 'For creators posting a few times a week.',
		monthly: 12,
		yearly: 99,
		carouselsPerMonth: PLAN_ENTITLEMENTS.hobby.carouselsPerMonth!,
		features: [
			'30 carousels / month',
			'5 caption styles',
			'AI script writer',
			'10 competitor tracks',
			'News-to-Post',
		],
	},
	creator: {
		id: 'creator' as const,
		name: 'Creator',
		tagline: 'For creators who ship every week.',
		monthly: 24,
		yearly: 199,
		carouselsPerMonth: PLAN_ENTITLEMENTS.creator.carouselsPerMonth!,
		features: [
			'100 carousels / month',
			'All caption styles',
			'No watermark',
			'25 competitor tracks',
			'Full canvas + HD export',
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
