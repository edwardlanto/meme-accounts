import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { r2Delete } from '$lib/server/r2';

export const POST: RequestHandler = async ({ request, locals }) => {
	const { user } = await locals.safeGetSession();
	if (!user) return json({ error: 'Unauthorized' }, { status: 401 });

	const body = await request.json().catch(() => ({}));
	const key = String(body?.key ?? '').trim();

	if (!key) return json({ error: 'Missing key' }, { status: 400 });
	if (!key.startsWith(`${user.id}/`)) return json({ error: 'Forbidden' }, { status: 403 });

	try {
		await r2Delete(key);
		return json({ ok: true });
	} catch (e: unknown) {
		const message = e instanceof Error ? e.message : String(e);
		console.error('[r2/delete]', message);
		return json({ error: message }, { status: 500 });
	}
};

