/** Shared plan catalog for client pages (mirrors server catalog — prices only; Stripe price IDs stay server-side). */
export const PLAN_CATALOG = {
	free: {
		id: 'free' as const,
		name: 'Free',
		tagline: 'No card needed. Forever free.',
		monthly: 0,
		yearly: 0,
		features: [
			'5 carousels / month',
			'3 competitor tracks',
			'AI hook suggestions',
			'Basic canvas editor',
		],
	},
	pro: {
		id: 'pro' as const,
		name: 'Pro',
		tagline: 'For creators who ship every week.',
		monthly: 29,
		yearly: 290,
		features: [
			'Unlimited carousels',
			'25 competitor tracks',
			'Claude 3.5 Sonnet AI',
			'News-to-Post (Vertex AI)',
			'Full canvas + export',
			'Style extraction',
		],
	},
	agency: {
		id: 'agency' as const,
		name: 'Agency',
		tagline: 'For teams managing multiple brands.',
		monthly: 99,
		yearly: 990,
		features: [
			'Everything in Pro',
			'Unlimited accounts',
			'Team workspace',
			'White-label export',
			'API access',
			'Priority support',
		],
	},
} as const;

export type PlanId = keyof typeof PLAN_CATALOG;
export type PaidPlanId = 'pro' | 'agency';
