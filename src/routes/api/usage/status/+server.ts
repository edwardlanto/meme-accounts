import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getUsageStatus } from '$lib/server/usage';

export const GET: RequestHandler = async ({ locals }) => {
	const { user } = await locals.safeGetSession();
	if (!user?.id) {
		return json({
			ok: true,
			signedIn: false,
			limit: 5,
			remaining: 5,
			canGenerate: false,
			aiImagesUsed: 0,
			aiImagesLimit: 0,
			aiImagesRemaining: 0,
			canGenerateAiImage: false,
			clipMinutesUsed: 0,
			clipMinutesLimit: 60,
			clipMinutesRemaining: 60,
			canAnalyzeClips: true,
			maxClipVideoMinutes: 20,
			slideshowsGenerated: 0,
			slidesGenerated: 0,
		});
	}

	const status = await getUsageStatus(user.id);
	return json({
		ok: true,
		signedIn: true,
		canGenerate: status.canGenerate,
		canExport: true,
		isPaid: status.isPaid,
		used: status.used,
		limit: status.limit,
		remaining: status.isPaid && status.limit === null ? null : status.remaining,
		plan: status.plan,
		periodStart: status.periodStart,
		aiImagesUsed: status.aiImagesUsed,
		aiImagesLimit: status.aiImagesLimit,
		aiImagesRemaining: status.aiImagesRemaining,
		canGenerateAiImage: status.canGenerateAiImage,
		clipMinutesUsed: status.clipMinutesUsed,
		clipMinutesLimit: status.clipMinutesLimit,
		clipMinutesRemaining: status.clipMinutesRemaining,
		canAnalyzeClips: status.canAnalyzeClips,
		maxClipVideoMinutes: status.maxClipVideoMinutes,
		slideshowsGenerated: status.slideshowsGenerated,
		slidesGenerated: status.slidesGenerated,
	});
};
