import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { r2SignPut } from '$lib/server/r2';
import { isValidOwnerR2Key, parseJsonBody, r2SignUploadBodySchema } from '$lib/server/request-security';

export const POST: RequestHandler = async ({ request, locals }) => {
	const { user } = await locals.safeGetSession();
	if (!user) return json({ error: 'Unauthorized' }, { status: 401 });

	const parsed = await parseJsonBody(request, r2SignUploadBodySchema);
	if (!parsed.ok) return json({ error: parsed.error }, { status: parsed.status });

	const key = parsed.data.key.trim();
	const contentType = parsed.data.contentType;

	if (!isValidOwnerR2Key(user.id, key)) return json({ error: 'Forbidden key' }, { status: 403 });

	try {
		const url = await r2SignPut(key, contentType, 60 * 5);
		return json({ url, key });
	} catch (e: unknown) {
		const message = e instanceof Error ? e.message : String(e);
		console.error('[r2/sign-upload]', message);
		return json({ error: message.includes('Missing env') ? message : `R2 sign failed: ${message}` }, { status: 500 });
	}
};

