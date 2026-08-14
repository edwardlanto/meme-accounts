import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getUsageStatus } from '$lib/server/usage';

/** @deprecated Prefer GET /api/usage/status */
export const GET: RequestHandler = async ({ locals }) => {
	const { user } = await locals.safeGetSession();
	if (!user?.id) {
		return json({
			ok: true,
			signedIn: false,
			limit: 5,
			remaining: 5,
			canExport: false,
			canGenerate: false,
		});
	}

	const status = await getUsageStatus(user.id);
	return json({
		ok: true,
		signedIn: true,
		canExport: true,
		canGenerate: status.canGenerate,
		isPaid: status.isPaid,
		used: status.used,
		limit: status.limit,
		remaining: status.isPaid && status.limit === null ? null : status.remaining,
		plan: status.plan,
	});
};
