import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import type { RequestHandler } from './$types';

/**
 * Proxy Unsplash photo search — keeps UNSPLASH_ACCESS_KEY server-side.
 * Docs: https://unsplash.com/documentation#search-photos
 */
export const GET: RequestHandler = async ({ url, locals }) => {
	const { user } = await locals.safeGetSession();
	if (!user) return json({ error: 'Unauthorized' }, { status: 401 });

	const accessKey = env.UNSPLASH_ACCESS_KEY?.trim();
	if (!accessKey) {
		return json({ error: 'Configure UNSPLASH_ACCESS_KEY in .env' }, { status: 500 });
	}

	const query = String(url.searchParams.get('query') ?? '').trim().slice(0, 120);
	if (!query) return json({ error: 'Missing query' }, { status: 400 });

	// Hard cap to keep payload small: max 15 photos per request
	const page = Math.max(1, Math.min(30, Number(url.searchParams.get('page') ?? 1) || 1));
	const perPage = Math.max(1, Math.min(15, Number(url.searchParams.get('per_page') ?? 15) || 15));

	console.log(`[Unsplash API] Request: query="${query}", page=${page}, per_page=${perPage}`);

	const endpoint = new URL('https://api.unsplash.com/search/photos');
	endpoint.searchParams.set('query', query);
	endpoint.searchParams.set('page', String(page));
	endpoint.searchParams.set('per_page', String(perPage));
	endpoint.searchParams.set('orientation', 'portrait');

	try {
		const res = await fetch(endpoint, {
			headers: {
				Authorization: `Client-ID ${accessKey}`,
				'Accept-Version': 'v1',
			},
		});
		const data = await res.json().catch(() => ({}));
		if (!res.ok) {
			const msg =
				typeof data?.errors?.[0] === 'string'
					? data.errors[0]
					: `Unsplash error ${res.status}`;
			return json({ error: msg }, { status: res.status === 403 ? 403 : 502 });
		}

		const results = Array.isArray(data?.results) ? data.results : [];
		console.log(`[Unsplash API] Response: ${results.length} photos, total=${data?.total}, total_pages=${data?.total_pages}, page=${page}`);
		
		// Strip to minimal fields — only return what the UI needs
		const photos = results
			.map((p: any) => ({
				id: String(p?.id ?? ''),
				small: String(p?.urls?.small ?? ''),
				regular: String(p?.urls?.regular ?? ''),
				alt: String(p?.alt_description ?? p?.description ?? 'Photo').slice(0, 100),
				photographer: String(p?.user?.name ?? 'Unknown').slice(0, 60),
				downloadLocation: String(p?.links?.download_location ?? ''),
			}))
			.filter((p: { id: string; small: string; regular: string }) => p.id && p.small && p.regular)
			.slice(0, 15); // Guarantee max 15

		return json({
			photos,
			total: Number(data?.total ?? photos.length) || 0,
			totalPages: Number(data?.total_pages ?? 1) || 1,
			page,
		});
	} catch (e: unknown) {
		const msg = e instanceof Error ? e.message : 'Unsplash request failed';
		console.error('[api/unsplash/search]', msg);
		return json({ error: msg }, { status: 500 });
	}
};
