import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { consumeTrialExport } from '$lib/server/trial';

/** Record a trial export before client-side PNG download. */
export const POST: RequestHandler = async ({ locals }) => {
	const { user } = await locals.safeGetSession();
	if (!user?.id) {
		return json({ ok: false, error: 'Sign in to export' }, { status: 401 });
	}

	const result = await consumeTrialExport(user.id);
	if (!result.ok) {
		return json(
			{
				ok: false,
				error: result.error,
				...result.status,
				remaining: result.status.isPaid ? null : result.status.remaining,
			},
			{ status: 403 }
		);
	}

	return json({
		ok: true,
		...result.status,
		remaining: result.status.isPaid ? null : result.status.remaining,
	});
};
