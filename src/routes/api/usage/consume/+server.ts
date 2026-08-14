import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getUsageStatus, consumeCarouselTokens } from '$lib/server/usage';

export const GET: RequestHandler = async ({ locals }) => {
	const { user } = await locals.safeGetSession();
	if (!user?.id) {
		return json({ ok: false, error: 'Sign in required' }, { status: 401 });
	}
	const status = await getUsageStatus(user.id);
	return json({ ok: true, ...status });
};

export const POST: RequestHandler = async ({ request, locals }) => {
	const { user } = await locals.safeGetSession();
	if (!user?.id) {
		return json({ ok: false, error: 'Sign in required' }, { status: 401 });
	}

	let count = 1;
	try {
		const body = await request.json();
		if (typeof body?.count === 'number' && Number.isFinite(body.count)) {
			count = Math.max(1, Math.floor(body.count));
		}
	} catch {
		/* default count = 1 */
	}

	const result = await consumeCarouselTokens(user.id, count);
	if (!result.ok) {
		return json(
			{
				ok: false,
				error: result.error,
				code: result.code,
				...result.status,
			},
			{ status: 402 },
		);
	}
	return json({ ok: true, ...result.status });
};
