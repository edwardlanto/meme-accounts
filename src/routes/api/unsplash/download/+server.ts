import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import type { RequestHandler } from './$types';

/**
 * Hit Unsplash download_location when a photo is used (API guideline).
 * Body: { downloadLocation: string }
 */
export const POST: RequestHandler = async ({ request, locals }) => {
	const { user } = await locals.safeGetSession();
	if (!user) return json({ error: 'Unauthorized' }, { status: 401 });

	const accessKey = env.UNSPLASH_ACCESS_KEY?.trim();
	if (!accessKey) return json({ error: 'Missing UNSPLASH_ACCESS_KEY' }, { status: 500 });

	const body = await request.json().catch(() => ({}));
	const downloadLocation = String(body?.downloadLocation ?? '').trim();
	if (!downloadLocation.startsWith('https://api.unsplash.com/')) {
		return json({ error: 'Invalid download location' }, { status: 400 });
	}

	try {
		const res = await fetch(downloadLocation, {
			headers: {
				Authorization: `Client-ID ${accessKey}`,
				'Accept-Version': 'v1',
			},
		});
		// Guidelines only require triggering the endpoint; ignore body.
		if (!res.ok) {
			console.warn('[api/unsplash/download]', res.status);
		}
		return json({ ok: true });
	} catch (e: unknown) {
		console.warn('[api/unsplash/download]', e);
		return json({ ok: true }); // don't block applying the image
	}
};
