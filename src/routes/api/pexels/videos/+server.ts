import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import type { RequestHandler } from './$types';

/**
 * Proxy Pexels video search — keeps PEXELS_API_KEY server-side.
 * Docs: https://www.pexels.com/api/documentation/#videos-search
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

	const page = Math.max(1, Math.min(30, Number(url.searchParams.get('page') ?? 1) || 1));
	const perPage = Math.max(1, Math.min(10, Number(url.searchParams.get('per_page') ?? 5) || 5));
	const orientation = url.searchParams.get('orientation') || 'portrait';

	const endpoint = new URL('https://api.pexels.com/videos/search');
	endpoint.searchParams.set('query', query);
	endpoint.searchParams.set('page', String(page));
	endpoint.searchParams.set('per_page', String(perPage));
	endpoint.searchParams.set('orientation', orientation);

	try {
		const res = await fetch(endpoint, {
			headers: { Authorization: apiKey },
		});
		const data = await res.json().catch(() => ({}));
		if (!res.ok) {
			const msg = data?.error ?? `Pexels error ${res.status}`;
			return json({ error: msg }, { status: res.status === 403 ? 403 : 502 });
		}

		const results = Array.isArray(data?.videos) ? data.videos : [];
		const videos = results
			.map((v: any) => {
				const files = Array.isArray(v?.video_files) ? v.video_files : [];
				// Prefer mid-quality mp4 portrait-ish file
				const ranked = [...files].sort((a: any, b: any) => {
					const aw = Number(a?.width ?? 0);
					const bw = Number(b?.width ?? 0);
					const aScore = Math.abs(aw - 720);
					const bScore = Math.abs(bw - 720);
					return aScore - bScore;
				});
				const file =
					ranked.find((f: any) => String(f?.file_type ?? '').includes('mp4') && f?.link) ??
					ranked.find((f: any) => f?.link) ??
					null;
				const urlOut = String(file?.link ?? '');
				const thumb = String(
					v?.image ?? v?.video_pictures?.[0]?.picture ?? '',
				);
				return {
					id: Number(v?.id ?? 0),
					url: urlOut,
					thumb,
					alt: String(v?.url ?? 'Video').slice(0, 120),
					photographer: String(v?.user?.name ?? 'Unknown').slice(0, 60),
					duration: Number(v?.duration ?? 0) || 0,
				};
			})
			.filter((v: { id: number; url: string }) => v.id && v.url)
			.slice(0, perPage);

		return json({
			videos,
			total: Number(data?.total_results ?? videos.length) || 0,
			page,
		});
	} catch (e: unknown) {
		const msg = e instanceof Error ? e.message : 'Pexels video request failed';
		console.error('[api/pexels/videos]', msg);
		return json({ error: msg }, { status: 500 });
	}
};
