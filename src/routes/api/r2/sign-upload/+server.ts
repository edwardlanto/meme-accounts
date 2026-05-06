import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { r2SignPut } from '$lib/server/r2';

export const POST: RequestHandler = async ({ request, locals }) => {
	const { user } = await locals.safeGetSession();
	if (!user) return json({ error: 'Unauthorized' }, { status: 401 });

	const body = await request.json().catch(() => ({}));
	const key = String(body?.key ?? '').trim();
	const contentType = String(body?.contentType ?? '').trim() || 'application/octet-stream';

	if (!key) return json({ error: 'Missing key' }, { status: 400 });
	if (!key.startsWith(`${user.id}/`)) return json({ error: 'Forbidden' }, { status: 403 });

	try {
		const url = await r2SignPut(key, contentType, 60 * 5);
		return json({ url, key });
	} catch (e: unknown) {
		const message = e instanceof Error ? e.message : String(e);
		console.error('[r2/sign-upload]', message);
		return json({ error: message.includes('Missing env') ? message : `R2 sign failed: ${message}` }, { status: 500 });
	}
};

