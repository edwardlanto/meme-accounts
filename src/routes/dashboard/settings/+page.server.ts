import type { PageServerLoad } from './$types';
import { adminClient } from '$lib/server/auth';
import { PLAN_CATALOG } from '$lib/server/stripe';
import { getUsageStatus } from '$lib/server/usage';
import { normalizePlanId } from '$lib/plan-entitlements';

export const load: PageServerLoad = async ({ parent }) => {
	const { user } = await parent();
	if (!user) {
		return {
			billing: null,
			usage: null,
			profile: null,
		};
	}

	const supabase = adminClient();
	const { data, error } = await supabase
		.from('users')
		.select(
			'plan, credits, plan_status, stripe_customer_id, stripe_subscription_id, current_period_end, full_name, marketing_emails'
		)
		.eq('id', user.id)
		.maybeSingle();

	if (error) {
		return {
			billing: null,
			usage: null,
			profile: null,
			billingError: error.message,
		};
	}

	const plan = normalizePlanId(data?.plan);
	const catalog = PLAN_CATALOG[plan] ?? PLAN_CATALOG.free;
	const usage = await getUsageStatus(user.id);

	return {
		billing: {
			plan,
			planName: catalog.name,
			credits: data?.credits ?? 0,
			planStatus: data?.plan_status ?? 'inactive',
			hasCustomer: Boolean(data?.stripe_customer_id),
			hasSubscription: Boolean(data?.stripe_subscription_id),
			currentPeriodEnd: data?.current_period_end ?? null,
			features: catalog.features,
			monthlyPrice: catalog.monthly,
			yearlyPrice: catalog.yearly,
			carouselsPerMonth: catalog.carouselsPerMonth,
		},
		usage: {
			...usage,
			remaining: usage.isPaid && usage.limit === null ? null : usage.remaining,
			aiImagesUsed: usage.aiImagesUsed,
			aiImagesLimit: usage.aiImagesLimit,
			aiImagesRemaining: usage.aiImagesRemaining,
			canGenerateAiImage: usage.canGenerateAiImage,
			clipMinutesUsed: usage.clipMinutesUsed,
			clipMinutesLimit: usage.clipMinutesLimit,
			clipMinutesRemaining: usage.clipMinutesRemaining,
			canAnalyzeClips: usage.canAnalyzeClips,
			maxClipVideoMinutes: usage.maxClipVideoMinutes,
		},
		profile: {
			fullName:
				(typeof data?.full_name === 'string' && data.full_name.trim()) ||
				(typeof user.user_metadata?.full_name === 'string'
					? String(user.user_metadata.full_name)
					: '') ||
				'',
			marketingEmails: data?.marketing_emails === true,
		},
	};
};
