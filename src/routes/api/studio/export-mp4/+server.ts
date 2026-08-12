import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { sniffStrictVideoMime } from '$lib/server/request-security';
import { transcodeStudioWebmToMp4 } from '$lib/server/video-pipeline';

const MAX_BYTES = 80 * 1024 * 1024;

export const POST: RequestHandler = async ({ request, locals }) => {
	const { user } = await locals.safeGetSession();
	if (!user) return json({ error: 'Unauthorized' }, { status: 401 });

	let form: FormData;
	try {
		form = await request.formData();
	} catch {
		return json({ error: 'Invalid upload' }, { status: 400 });
	}

	const file = form.get('file');
	if (!(file instanceof File) || !file.size) {
		return json({ error: 'Missing video file' }, { status: 400 });
	}
	if (file.size > MAX_BYTES) {
		return json({ error: 'Video is too large to encode (max 80MB)' }, { status: 413 });
	}

	const buf = new Uint8Array(await file.arrayBuffer());
	const sniffed = sniffStrictVideoMime(buf);
	if (!sniffed) {
		return json({ error: 'Upload a WebM or MP4 recording' }, { status: 400 });
	}

	try {
		const mp4 = await transcodeStudioWebmToMp4(buf);
		return new Response(Buffer.from(mp4), {
			headers: {
				'Content-Type': 'video/mp4',
				'Cache-Control': 'no-store',
			},
		});
	} catch (e: unknown) {
		const message = e instanceof Error ? e.message : 'MP4 encode failed';
		console.error('[api/studio/export-mp4]', message);
		return json({ error: message }, { status: 500 });
	}
};
