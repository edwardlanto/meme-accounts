import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

function guessMimeFromUrl(url: string) {
	const u = url.toLowerCase();
	if (u.endsWith('.png')) return 'image/png';
	if (u.endsWith('.jpg') || u.endsWith('.jpeg')) return 'image/jpeg';
	if (u.endsWith('.webp')) return 'image/webp';
	if (u.endsWith('.gif')) return 'image/gif';
	return '';
}

export const POST: RequestHandler = async ({ request, fetch }) => {
	try {
		const { url } = (await request.json()) as { url?: string };
		const src = String(url ?? '').trim();
		if (!src || !(src.startsWith('http://') || src.startsWith('https://'))) {
			return json({ ok: false, error: 'Missing or invalid url' }, { status: 400 });
		}

		const res = await fetch(src);
		if (!res.ok) {
			return json({ ok: false, error: `Fetch failed (${res.status})` }, { status: 400 });
		}

		const ab = await res.arrayBuffer();
		// Basic safety: avoid giant images blowing up memory
		const maxBytes = 10 * 1024 * 1024;
		if (ab.byteLength > maxBytes) {
			return json({ ok: false, error: 'Image too large to convert' }, { status: 413 });
		}

		const b64 = Buffer.from(ab).toString('base64');
		const mime =
			res.headers.get('content-type')?.split(';')[0]?.trim() ||
			guessMimeFromUrl(src) ||
			'image/jpeg';
		const dataUrl = `data:${mime};base64,${b64}`;
		return json({ ok: true, dataUrl });
	} catch (e: any) {
		return json({ ok: false, error: e?.message ?? 'unknown error' }, { status: 500 });
	}
};

