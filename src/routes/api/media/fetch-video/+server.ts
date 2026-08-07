import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	assertPublicHttpsUrl,
	mediaToDataUrlSchema,
	parseJsonBody,
	sniffStrictVideoMime,
} from '$lib/server/request-security';

const MAX_VIDEO_BYTES = 48 * 1024 * 1024;

/**
 * Fetch a remote stock video (e.g. Pexels) through the app so the browser can
 * use a same-origin blob URL — required for canvas / html-to-image export.
 */
export const POST: RequestHandler = async ({ request, fetch, locals }) => {
	const { user } = await locals.safeGetSession();
	if (!user) return json({ ok: false, error: 'Unauthorized' }, { status: 401 });

	const parsed = await parseJsonBody(request, mediaToDataUrlSchema, 8192);
	if (!parsed.ok) return json({ ok: false, error: parsed.error }, { status: parsed.status });

	let validatedUrl: URL;
	try {
		validatedUrl = assertPublicHttpsUrl(parsed.data.url.trim());
	} catch {
		return json(
			{ ok: false, error: 'URL not allowed (use https only, no localhost/private hosts)' },
			{ status: 400 },
		);
	}

	const src = validatedUrl.href;
	try {
		const res = await fetch(src, {
			redirect: 'follow',
			headers: {
				Accept: 'video/*,*/*;q=0.8',
			},
		});
		if (!res.ok) {
			return json({ ok: false, error: `Fetch failed (${res.status})` }, { status: 400 });
		}

		const mimeHeader = res.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase() ?? '';
		if (
			mimeHeader.startsWith('text/') ||
			mimeHeader.includes('text/html') ||
			mimeHeader.includes('application/json')
		) {
			return json({ ok: false, error: 'Refusing non-video content-type from remote URL' }, { status: 400 });
		}

		const ab = await res.arrayBuffer();
		if (ab.byteLength > MAX_VIDEO_BYTES) {
			return json({ ok: false, error: 'Video too large to import for export-safe playback' }, { status: 413 });
		}
		if (ab.byteLength < 32) {
			return json({ ok: false, error: 'Empty video response' }, { status: 400 });
		}

		const head = new Uint8Array(ab, 0, Math.min(ab.byteLength, 32));
		const sniffed = sniffStrictVideoMime(head);
		let mime = sniffed ?? '';
		if (!mime && mimeHeader.startsWith('video/')) mime = mimeHeader;
		if (!mime) mime = 'video/mp4';
		if (!mime.startsWith('video/')) {
			return json({ ok: false, error: 'Bytes do not look like a supported video' }, { status: 400 });
		}

		return new Response(ab, {
			status: 200,
			headers: {
				'Content-Type': mime,
				'Cache-Control': 'private, max-age=60',
				'X-Content-Type-Options': 'nosniff',
			},
		});
	} catch (e: unknown) {
		const msg = e instanceof Error ? e.message : 'Video fetch failed';
		return json({ ok: false, error: msg }, { status: 500 });
	}
};
