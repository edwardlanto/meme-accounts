import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getTrialStatus, TRIAL_EXPORT_LIMIT } from '$lib/server/trial';

export const GET: RequestHandler = async ({ locals }) => {
	const { user } = await locals.safeGetSession();
	if (!user?.id) {
		return json({
			ok: true,
			signedIn: false,
			limit: TRIAL_EXPORT_LIMIT,
			remaining: TRIAL_EXPORT_LIMIT,
			canExport: false,
		});
	}

	const status = await getTrialStatus(user.id);
	return json({
		ok: true,
		signedIn: true,
		...status,
		remaining: status.isPaid ? null : status.remaining,
	});
};
