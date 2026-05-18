import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/private';
import { adminClient } from '$lib/server/auth';
import { ensureUserZernioProfile, syncZernioConnectionsForUser } from '$lib/server/zernio-auth';

export const POST: RequestHandler = async ({ locals }) => {
	const { user } = await locals.safeGetSession();
	if (!user) return json({ ok: false, error: 'Unauthorized' }, { status: 401 });

	const apiKey = env.ZERNIO_API_KEY ?? '';
	if (!apiKey) {
		return json({ ok: false, error: 'Zernio is not configured (missing ZERNIO_API_KEY)' }, { status: 503 });
	}

	try {
		const supabase = adminClient();
		await ensureUserZernioProfile(supabase, apiKey, user.id);
		const { synced } = await syncZernioConnectionsForUser(supabase, apiKey, user.id);
		return json({ ok: true, synced });
	} catch (e: any) {
		console.error('[zernio sync]', e);
		return json({ ok: false, error: e?.message ?? 'Sync failed' }, { status: 500 });
	}
};
