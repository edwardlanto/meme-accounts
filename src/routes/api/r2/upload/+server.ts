import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { r2PutObject } from '$lib/server/r2';
import { isValidOwnerR2Key, sniffStrictImageMime, sniffStrictVideoMime } from '$lib/server/request-security';
import { getUserPlan } from '$lib/server/usage';
import { maxUploadBytesForPlan, formatUploadLimit } from '$lib/plan-entitlements';

/** Same-origin upload — avoids browser CORS when PUT-ing directly to R2. */
export const POST: RequestHandler = async ({ request, locals }) => {
	const { user } = await locals.safeGetSession();
	if (!user) return json({ error: 'Unauthorized' }, { status: 401 });

	const form = await request.formData().catch(() => null);
	if (!form) return json({ error: 'Expected multipart form' }, { status: 400 });

	const key = String(form.get('key') ?? '').trim();
	const file = form.get('file');

	if (!key) return json({ error: 'Missing key' }, { status: 400 });
	if (!isValidOwnerR2Key(user.id, key)) return json({ error: 'Forbidden key' }, { status: 403 });
	if (!file || !(file instanceof File)) return json({ error: 'Missing file' }, { status: 400 });

	const plan = await getUserPlan(user.id);
	const maxBytes = maxUploadBytesForPlan(plan);

	const buf = new Uint8Array(await file.arrayBuffer());
	if (buf.byteLength > maxBytes) {
		return json(
			{ error: `File too large. Your plan allows uploads up to ${formatUploadLimit(maxBytes)}.` },
			{ status: 413 },
		);
	}
	const imageMime = sniffStrictImageMime(buf);
	const videoMime = imageMime ? null : sniffStrictVideoMime(buf);
	if (!imageMime && !videoMime) {
		return json({ error: 'Unsupported or invalid image file' }, { status: 400 });
	}
	const contentType = imageMime ?? videoMime!;

	try {
		await r2PutObject(key, buf, contentType);
		return json({ ok: true, key, contentType });
	} catch (e: unknown) {
		const message = e instanceof Error ? e.message : String(e);
		console.error('[r2/upload]', message);
		return json({ error: message }, { status: 500 });
	}
};
