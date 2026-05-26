import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { r2PutObject, r2SignGet } from '$lib/server/r2';
import { isValidOwnerR2Key, sniffStrictVideoMime } from '$lib/server/request-security';

const MAX_VIDEO_BYTES = 200 * 1024 * 1024;

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

	const buf = new Uint8Array(await file.arrayBuffer());
	if (buf.byteLength > MAX_VIDEO_BYTES) {
		return json({ error: 'Video must be under 200MB' }, { status: 413 });
	}
	const sniffed = sniffStrictVideoMime(buf);
	if (!sniffed) return json({ error: 'Unsupported video format (use MP4, WebM, or MOV)' }, { status: 400 });

	try {
		await r2PutObject(key, buf, sniffed);
		const playbackUrl = await r2SignGet(key, 7200);
		return json({
			ok: true,
			key,
			playbackUrl,
			contentType: sniffed,
			sizeBytes: buf.byteLength,
		});
	} catch (e: unknown) {
		const message = e instanceof Error ? e.message : String(e);
		console.error('[api/videos/upload]', message);
		return json({ error: message }, { status: 500 });
	}
};
