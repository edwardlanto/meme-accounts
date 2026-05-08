import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { r2Delete } from '$lib/server/r2';
import { isValidOwnerR2Key, parseJsonBody, r2KeyBodySchema } from '$lib/server/request-security';

export const POST: RequestHandler = async ({ request, locals }) => {
	const { user } = await locals.safeGetSession();
	if (!user) return json({ error: 'Unauthorized' }, { status: 401 });

	const parsed = await parseJsonBody(request, r2KeyBodySchema);
	if (!parsed.ok) return json({ error: parsed.error }, { status: parsed.status });
	const key = parsed.data.key.trim();

	if (!isValidOwnerR2Key(user.id, key)) return json({ error: 'Forbidden key' }, { status: 403 });

	try {
		await r2Delete(key);
		return json({ ok: true });
	} catch (e: unknown) {
		const message = e instanceof Error ? e.message : String(e);
		console.error('[r2/delete]', message);
		return json({ error: message }, { status: 500 });
	}
};

