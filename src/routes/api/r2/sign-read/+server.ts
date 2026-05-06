import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { r2SignGet } from '$lib/server/r2';

export const POST: RequestHandler = async ({ request, locals }) => {
	const { user } = await locals.safeGetSession();
	if (!user) return json({ error: 'Unauthorized' }, { status: 401 });

	const body = await request.json().catch(() => ({}));
	const key = String(body?.key ?? '').trim();

	if (!key) return json({ error: 'Missing key' }, { status: 400 });
	if (!key.startsWith(`${user.id}/`)) return json({ error: 'Forbidden' }, { status: 403 });

	try {
		const url = await r2SignGet(key, 60 * 60);
		return json({ url, key });
	} catch (e: unknown) {
		const message = e instanceof Error ? e.message : String(e);
		console.error('[r2/sign-read]', message);
		return json({ error: message.includes('Missing env') ? message : `R2 sign failed: ${message}` }, { status: 500 });
	}
};

