import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	assertPublicHttpsUrl,
	fetchContentTypeAllowsImage,
	mediaToDataUrlSchema,
	parseJsonBody,
	sniffStrictImageMime,
} from '$lib/server/request-security';

function guessMimeFromUrl(url: string) {
	const u = url.toLowerCase();
	if (u.endsWith('.png')) return 'image/png';
	if (u.endsWith('.jpg') || u.endsWith('.jpeg')) return 'image/jpeg';
	if (u.endsWith('.webp')) return 'image/webp';
	if (u.endsWith('.gif')) return 'image/gif';
	return '';
}

export const POST: RequestHandler = async ({ request, fetch, locals }) => {
	try {
		const { user } = await locals.safeGetSession();
		if (!user) return json({ ok: false, error: 'Unauthorized' }, { status: 401 });

		const parsed = await parseJsonBody(request, mediaToDataUrlSchema, 8192);
		if (!parsed.ok) return json({ ok: false, error: parsed.error }, { status: parsed.status });

		let validatedUrl: URL;
		try {
			validatedUrl = assertPublicHttpsUrl(parsed.data.url.trim());
		} catch {
			return json({ ok: false, error: 'URL not allowed (use https only, no localhost/private hosts)' }, { status: 400 });
		}

		const src = validatedUrl.href;
		const res = await fetch(src, {
			redirect: 'follow',
			headers: {
				// Avoid passing through user cookies to third parties via fetch impersonation semantics.
				Accept: 'image/*,*/*;q=0.8',
			},
		});
		if (!res.ok) {
			return json({ ok: false, error: `Fetch failed (${res.status})` }, { status: 400 });
		}

		const mimeHeader = res.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase() ?? '';
		// Prefer magic-byte sniff — many hosts send `octet-stream` for images.
		if (mimeHeader.startsWith('text/') || mimeHeader.includes('text/html') || mimeHeader.includes('application/json')) {
			return json({ ok: false, error: 'Refusing non-binary content-type from remote URL' }, { status: 400 });
		}
		if (mimeHeader.startsWith('image/') && !fetchContentTypeAllowsImage(mimeHeader)) {
			return json({ ok: false, error: 'Image content-type not allowed' }, { status: 400 });
		}

		const ab = await res.arrayBuffer();
		const maxBytes = 10 * 1024 * 1024;
		if (ab.byteLength > maxBytes) {
			return json({ ok: false, error: 'Image too large to convert' }, { status: 413 });
		}

		const head = new Uint8Array(ab, 0, Math.min(ab.byteLength, 32));
		const sniffed = sniffStrictImageMime(head);
		if (!sniffed) {
			return json({ ok: false, error: 'Bytes do not match a supported raster image' }, { status: 400 });
		}

		const b64 = Buffer.from(ab).toString('base64');
		const mime = sniffed;
		const dataUrl = `data:${mime};base64,${b64}`;
		return json({ ok: true, dataUrl });
	} catch (e: any) {
		return json({ ok: false, error: e?.message ?? 'unknown error' }, { status: 500 });
	}
};

