import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import type { RequestHandler } from './$types';

/**
 * Proxy Pexels photo search — keeps PEXELS_API_KEY server-side.
 * Docs: https://www.pexels.com/api/documentation/#photos-search
 */
export const GET: RequestHandler = async ({ url, locals }) => {
	const { user } = await locals.safeGetSession();
	if (!user) return json({ error: 'Unauthorized' }, { status: 401 });

	const apiKey = env.PEXELS_API_KEY?.trim();
	if (!apiKey) {
		return json({ error: 'Configure PEXELS_API_KEY in .env' }, { status: 500 });
	}

	const query = String(url.searchParams.get('query') ?? '').trim().slice(0, 120);
	if (!query) return json({ error: 'Missing query' }, { status: 400 });

	// Hard cap to keep payload small: max 15 photos per request
	const page = Math.max(1, Math.min(30, Number(url.searchParams.get('page') ?? 1) || 1));
	const perPage = Math.max(1, Math.min(15, Number(url.searchParams.get('per_page') ?? 15) || 15));
	const orientation = url.searchParams.get('orientation') || 'portrait';

	const endpoint = new URL('https://api.pexels.com/v1/search');
	endpoint.searchParams.set('query', query);
	endpoint.searchParams.set('page', String(page));
	endpoint.searchParams.set('per_page', String(perPage));
	endpoint.searchParams.set('orientation', orientation);

	console.log(`[Pexels API] Request: query="${query}", page=${page}, per_page=${perPage}`);

	try {
		const res = await fetch(endpoint, {
			headers: {
				Authorization: apiKey,
			},
		});
		const data = await res.json().catch(() => ({}));
		if (!res.ok) {
			const msg = data?.error ?? `Pexels error ${res.status}`;
			const friendly =
				res.status === 401 || res.status === 403
					? 'Pexels API key invalid — update PEXELS_API_KEY in .env'
					: msg;
			return json({ error: friendly }, { status: res.status === 403 || res.status === 401 ? res.status : 502 });
		}

		const results = Array.isArray(data?.photos) ? data.photos : [];
		console.log(`[Pexels API] Response: ${results.length} photos, total=${data?.total_results}, page=${page}`);
		
		// Strip to minimal fields — only return what the UI needs (+ score signals)
		const photos = results
			.map((p: any) => ({
				id: Number(p?.id ?? 0),
				small: String(p?.src?.large ?? ''),
				regular: String(p?.src?.large2x ?? p?.src?.original ?? ''),
				original: String(p?.src?.original ?? ''),
				alt: String(p?.alt ?? 'Photo').slice(0, 100),
				photographer: String(p?.photographer ?? 'Unknown').slice(0, 60),
				photographerUrl: String(p?.photographer_url ?? ''),
				likes: Number(p?.liked ?? 0) || 0,
				width: Number(p?.width ?? 0) || 0,
				height: Number(p?.height ?? 0) || 0,
			}))
			.filter((p: { id: number; small: string; regular: string }) => p.id && p.small && p.regular)
			.slice(0, 15); // Guarantee max 15

		return json({
			photos,
			total: Number(data?.total_results ?? photos.length) || 0,
			totalPages: Math.ceil((Number(data?.total_results ?? 0) || photos.length) / perPage),
			page,
		});
	} catch (e: unknown) {
		const msg = e instanceof Error ? e.message : 'Pexels request failed';
		console.error('[api/pexels/search]', msg);
		return json({ error: msg }, { status: 500 });
	}
};
