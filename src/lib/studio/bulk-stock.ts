/** Pick stock photo/video queries from slide copy for media templates. */

import { optimizeImageUrl } from '$lib/client/optimize-image-url';
import type { TemplateId } from './template-ids';
import {
	isPhotoStoryFamily,
	isVideoStoryFamily,
	isVideoSplitFamily,
	isBrandStackFamily,
} from './template-ids';

/** Full-slide preview (~2× feed preview width). */
const STOCK_PREVIEW_W = 1080;
/** Filmstrip / poster thumb. */
const STOCK_THUMB_W = 256;

const STOP = new Set(
	[
		'a',
		'an',
		'the',
		'and',
		'or',
		'but',
		'to',
		'of',
		'in',
		'on',
		'for',
		'with',
		'is',
		'are',
		'was',
		'were',
		'be',
		'been',
		'it',
		'this',
		'that',
		'these',
		'those',
		'your',
		'you',
		'we',
		'our',
		'my',
		'their',
		'how',
		'what',
		'why',
		'when',
		'where',
		'who',
		'not',
		'no',
		'yes',
		'from',
		'into',
		'about',
		'just',
		'more',
		'most',
		'can',
		'will',
		'dont',
		"don't",
		'its',
		"it's",
		'than',
		'then',
		'them',
		'they',
		'here',
		'there',
		'have',
		'has',
		'had',
		'do',
		'does',
		'did',
		'get',
		'got',
		'make',
		'makes',
		'need',
		'needs',
		'want',
		'like',
		'one',
		'two',
		'all',
		'any',
		'every',
		'new',
		'old',
	].map((w) => w.toLowerCase()),
);

/** Templates that show a background / hero image. */
export function templateUsesStockImage(id: TemplateId): boolean {
	return (
		isPhotoStoryFamily(id) ||
		id === 'imageQuote' ||
		id === 'whiteMedia' ||
		id === 'news' ||
		id === 'article' ||
		id === 'blackText'
	);
}

/** Templates that show a video clip. */
export function templateUsesStockVideo(id: TemplateId): boolean {
	return isVideoStoryFamily(id) || isVideoSplitFamily(id) || isBrandStackFamily(id);
}

export function templateUsesStockMedia(id: TemplateId): boolean {
	return templateUsesStockImage(id) || templateUsesStockVideo(id);
}

/**
 * Build a short stock-search query from slide text.
 * Prefers concrete nouns from the headline; always returns something searchable.
 */
export function stockQueryFromSlide(headline: string, body = '', topicHint = ''): string {
	const keywords = (text: string, limit: number): string[] => {
		const out: string[] = [];
		const seen = new Set<string>();
		for (const w of text.replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/)) {
			const word = w.trim();
			if (word.length < 3 || STOP.has(word.toLowerCase())) continue;
			const key = word.toLowerCase();
			if (seen.has(key)) continue;
			seen.add(key);
			out.push(word);
			if (out.length >= limit) break;
		}
		return out;
	};

	// Lead with the topic so every slide in a deck pulls imagery from the same subject.
	const topicWords = keywords(topicHint, 2);
	const slideWords = keywords(`${headline} ${body}`, 3).filter(
		(w) => !topicWords.some((t) => t.toLowerCase() === w.toLowerCase()),
	);

	const q = [...topicWords, ...slideWords].join(' ').trim();
	return q.slice(0, 80) || 'cinematic editorial background';
}

export type StockQueryKind = 'photo' | 'video' | 'circle';

export type StockQueryPlan = {
	query: string;
	queries: string[];
	circleQuery: string;
};

/**
 * Ask Studio `/api/stock/query` (OpenRouter) for visual Pexels queries.
 * Falls back to `stockQueryFromSlide` when the API is unavailable.
 */
export async function resolveStockSearchQueries(opts: {
	topic?: string;
	kind?: StockQueryKind;
	slides?: { headline?: string; body?: string }[];
}): Promise<StockQueryPlan> {
	const topic = String(opts.topic ?? '').trim();
	const kind: StockQueryKind =
		opts.kind === 'video' || opts.kind === 'circle' ? opts.kind : 'photo';
	const slides = (opts.slides ?? [])
		.map((s) => ({
			headline: String(s.headline ?? '').trim(),
			body: String(s.body ?? '').trim(),
		}))
		.filter((s) => s.headline || s.body)
		.slice(0, 8);

	const localFallback = (): StockQueryPlan => {
		const first = slides[0] ?? { headline: topic, body: '' };
		const query =
			stockQueryFromSlide(first.headline, first.body, topic) || 'editorial photo';
		const queries = (slides.length ? slides : [first]).map(
			(s) => stockQueryFromSlide(s.headline, s.body, topic) || query,
		);
		const circleQuery =
			stockQueryFromSlide(first.headline || topic, '', topic) || 'portrait close up';
		return { query, queries, circleQuery };
	};

	try {
		const res = await fetch('/api/stock/query', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				topic: topic || undefined,
				kind,
				slides: slides.length ? slides : undefined,
			}),
		});
		const data = await res.json().catch(() => ({}));
		if (!res.ok) return localFallback();
		const query = String(data?.query ?? '').trim();
		const queries = Array.isArray(data?.queries)
			? data.queries.map((q: unknown) => String(q ?? '').trim()).filter(Boolean)
			: [];
		const circleQuery = String(data?.circleQuery ?? '').trim();
		if (!query && !queries.length) return localFallback();
		const primary = query || queries[0] || localFallback().query;
		return {
			query: primary.slice(0, 80),
			queries: (queries.length ? queries : [primary]).map((q: string) => q.slice(0, 80)),
			circleQuery: (circleQuery || primary).slice(0, 80),
		};
	} catch {
		return localFallback();
	}
}

export type StockPick = {
	url: string;
	kind: 'image' | 'video';
	thumb?: string;
	alt?: string;
	photographer?: string;
	source?: 'unsplash' | 'pexels';
	downloadLocation?: string;
	duration?: number;
};

type PhotoCandidate = {
	regular: string;
	small?: string;
	alt?: string;
	photographer?: string;
	likes?: number;
	downloads?: number;
	downloadLocation?: string;
	width?: number;
	height?: number;
	source: 'unsplash' | 'pexels';
};

function scorePhoto(p: PhotoCandidate): number {
	const likes = Number(p.likes ?? 0) || 0;
	const downloads = Number(p.downloads ?? 0) || 0;
	const w = Number(p.width ?? 0) || 0;
	const h = Number(p.height ?? 0) || 0;
	// Prefer portrait / tall frames for feed posts
	const aspectBonus = h > w && w > 0 ? 40 : w > 0 && h > 0 ? 10 : 0;
	return likes * 2 + downloads * 0.05 + aspectBonus;
}

/** Prefer square-ish frames for News circle badges. */
function scoreCirclePhoto(p: PhotoCandidate): number {
	const likes = Number(p.likes ?? 0) || 0;
	const downloads = Number(p.downloads ?? 0) || 0;
	const w = Number(p.width ?? 0) || 0;
	const h = Number(p.height ?? 0) || 0;
	let aspectBonus = 0;
	if (w > 0 && h > 0) {
		const ratio = w / h;
		aspectBonus = (1 - Math.min(1, Math.abs(ratio - 1))) * 50;
	}
	return likes * 2 + downloads * 0.05 + aspectBonus;
}

function bestPhoto(photos: PhotoCandidate[]): PhotoCandidate | null {
	if (!photos.length) return null;
	return [...photos].sort((a, b) => scorePhoto(b) - scorePhoto(a))[0] ?? null;
}

async function searchPexelsPhotos(
	query: string,
	page = 1,
	perPage = 12,
): Promise<{ photos: PhotoCandidate[]; error?: string; totalPages?: number }> {
	const res = await fetch(
		`/api/pexels/search?query=${encodeURIComponent(query)}&per_page=${perPage}&page=${page}&orientation=portrait`,
	);
	const data = await res.json().catch(() => ({}));
	if (!res.ok) {
		return { photos: [], error: String(data?.error || `Pexels ${res.status}`) };
	}
	const photos = (Array.isArray(data.photos) ? data.photos : [])
		.map((p: any) => ({
			regular: String(p?.regular ?? ''),
			small: String(p?.small ?? ''),
			alt: String(p?.alt ?? ''),
			photographer: String(p?.photographer ?? ''),
			likes: Number(p?.likes ?? 0) || 0,
			width: Number(p?.width ?? 0) || 0,
			height: Number(p?.height ?? 0) || 0,
			source: 'pexels' as const,
		}))
		.filter((p: PhotoCandidate) => p.regular);
	return { photos, totalPages: Number(data?.totalPages ?? 1) || 1 };
}

function candidateToPick(pick: PhotoCandidate): StockPick {
	const full = pick.regular;
	const small = pick.small || pick.regular;
	return {
		url: optimizeImageUrl(full, STOCK_PREVIEW_W),
		kind: 'image',
		thumb: optimizeImageUrl(small, STOCK_THUMB_W),
		alt: pick.alt || '',
		photographer: pick.photographer || '',
		source: pick.source,
		downloadLocation: pick.downloadLocation,
	};
}

function photoKey(p: PhotoCandidate): string {
	return p.regular.split('?')[0] || p.regular;
}

function appendUniquePhotos(
	out: StockPick[],
	photos: PhotoCandidate[],
	limit: number,
	seen: Set<string>,
	scoreFn: (p: PhotoCandidate) => number = scorePhoto,
) {
	for (const p of [...photos].sort((a, b) => scoreFn(b) - scoreFn(a))) {
		const key = photoKey(p);
		if (!key || seen.has(key)) continue;
		seen.add(key);
		out.push(candidateToPick(p));
		if (out.length >= limit) break;
	}
}

/** Pexels photos only. No videos. */
export async function fetchStockImagePool(query: string, limit = 24): Promise<StockPick[]> {
	const q = query.trim();
	if (!q) return [];
	const out: StockPick[] = [];
	const seen = new Set<string>();
	const pexels = await searchPexelsPhotos(q);
	appendUniquePhotos(out, pexels.photos, limit, seen);
	return out;
}

/** Fetch best still from Pexels. */
export async function fetchStockImage(query: string): Promise<StockPick | null> {
	const pool = await getStockPool(query, false, 1);
	return pool[0] ?? null;
}

/** In-flight + short-lived cache so identical queries don't hit Pexels repeatedly. */
const stockPoolCache = new Map<string, Promise<StockPick[]>>();

function stockPoolCacheKey(query: string, wantVideo: boolean, limit: number): string {
	return `${wantVideo ? 'video' : 'photo'}::${query.trim().toLowerCase()}::${limit}`;
}

async function getStockPool(query: string, wantVideo: boolean, limit: number): Promise<StockPick[]> {
	const q = query.trim();
	if (!q) return [];
	const key = stockPoolCacheKey(q, wantVideo, limit);
	let pending = stockPoolCache.get(key);
	if (!pending) {
		pending = wantVideo ? fetchStockMediaPool(q, limit) : fetchStockImagePool(q, limit);
		stockPoolCache.set(key, pending);
		void pending.finally(() => {
			setTimeout(() => {
				if (stockPoolCache.get(key) === pending) stockPoolCache.delete(key);
			}, 120_000);
		});
	}
	return pending;
}

export function pickFromStockPool(
	pool: StockPick[],
	preferVideo: boolean,
	offset = 0,
): StockPick | null {
	if (!pool.length) return null;
	const base = ((offset % pool.length) + pool.length) % pool.length;
	for (let k = 0; k < pool.length; k++) {
		const pick = pool[(base + k) % pool.length]!;
		if (preferVideo) {
			if (pick.kind === 'video') return pick;
		} else if (pick.kind === 'image') {
			return pick;
		}
	}
	return pool[base] ?? null;
}

export type StockFillSlideInput = {
	template: TemplateId;
	headline: string;
	body: string;
};

/**
 * Resolve stock for many slides in one deck with ONE `/api/stock/query` call
 * and ONE Pexels fetch per unique search query (Studio-style batching).
 */
export async function resolveStockPicksForSlides(
	slides: StockFillSlideInput[],
	topicHint: string,
	opts?: { preferredKind?: 'photo' | 'video' },
): Promise<(StockPick | null)[]> {
	const preferred = opts?.preferredKind;
	const out: (StockPick | null)[] = slides.map(() => null);
	const stockIdx: number[] = [];
	const stockSlides: StockFillSlideInput[] = [];
	const wantVideoByIdx: boolean[] = [];

	slides.forEach((slide, index) => {
		if (!templateUsesStockMedia(slide.template)) return;
		const wantVideo =
			preferred === 'video'
				? true
				: preferred === 'photo'
					? false
					: templateUsesStockVideo(slide.template);
		stockIdx.push(index);
		stockSlides.push(slide);
		wantVideoByIdx.push(wantVideo);
	});

	if (!stockSlides.length) return out;

	// Bulk uses one Stock photos / Stock videos chip for the whole run.
	const wantVideo = wantVideoByIdx[0] ?? false;

	const plan = await resolveStockSearchQueries({
		topic: topicHint,
		kind: wantVideo ? 'video' : 'photo',
		slides: stockSlides.map((s) => ({ headline: s.headline, body: s.body })),
	});

	const deckQuery =
		plan.query.trim() ||
		topicHint.trim() ||
		stockQueryFromSlide(stockSlides[0]!.headline, stockSlides[0]!.body, topicHint) ||
		'editorial photo';

	const queryBySlide = stockSlides.map((s, i) => {
		const fromPlan = String(plan.queries[i] ?? plan.queries[0] ?? deckQuery).trim();
		return (
			fromPlan ||
			stockQueryFromSlide(s.headline, s.body, topicHint) ||
			deckQuery
		);
	});

	const uniqueQueries = [...new Set([deckQuery, ...queryBySlide])];
	const poolLimit = Math.max(24, stockSlides.length + 4);
	const pools = new Map<string, StockPick[]>();
	await Promise.all(
		uniqueQueries.map(async (q) => {
			pools.set(q, await getStockPool(q, wantVideo, poolLimit));
		}),
	);

	stockIdx.forEach((outIndex, i) => {
		const q = queryBySlide[i]!;
		const pool = pools.get(q) ?? pools.get(deckQuery) ?? [];
		out[outIndex] = pickFromStockPool(pool, wantVideo, i);
	});

	return out;
}

/** Pexels photos ranked for square circle badges. */
export async function fetchStockCircleImagePool(query: string, limit = 12): Promise<StockPick[]> {
	const q = query.trim();
	if (!q) return [];
	const out: StockPick[] = [];
	const seen = new Set<string>();
	const pexels = await searchPexelsPhotos(q, 1, Math.max(limit, 12));
	appendUniquePhotos(out, pexels.photos, limit, seen, scoreCirclePhoto);
	return out;
}

export async function fetchStockCircleImage(query: string): Promise<StockPick | null> {
	const pool = await fetchStockCircleImagePool(query, 1);
	return pool[0] ?? null;
}

export type SidebarStockPhoto = {
	id: string;
	small: string;
	regular: string;
	alt: string;
	photographer: string;
	source: 'pexels' | 'unsplash';
	downloadLocation?: string;
	pexelsId?: number;
};

/** Sidebar search: Pexels photos only. */
export async function searchStockPhotosForSidebar(
	query: string,
	page = 1,
	perPage = 15,
): Promise<{ photos: SidebarStockPhoto[]; totalPages: number; hasMore: boolean }> {
	const q = query.trim();
	if (!q) return { photos: [], totalPages: 1, hasMore: false };

	const pexels = await searchPexelsPhotos(q, page, perPage);
	const photos: SidebarStockPhoto[] = pexels.photos.map((p, i) => ({
		id: `pexels-${page}-${i}-${photoKey(p)}`,
		small: p.small || p.regular,
		regular: p.regular,
		alt: p.alt || '',
		photographer: p.photographer || '',
		source: 'pexels' as const,
	}));

	const totalPages = Math.max(Number(pexels.totalPages ?? 1) || 1, 1);
	return {
		photos,
		totalPages,
		hasMore: page < totalPages && pexels.photos.length > 0,
	};
}

async function searchPexelsVideos(query: string, perPage = 15): Promise<StockPick[]> {
	const q = query.trim();
	if (!q) return [];
	const res = await fetch(
		`/api/pexels/videos?query=${encodeURIComponent(q)}&per_page=${perPage}&page=1&orientation=portrait`,
	);
	const data = await res.json().catch(() => ({}));
	if (!res.ok) return [];
	const videos = Array.isArray(data.videos) ? data.videos : [];
	const ranked = [...videos].sort((a: any, b: any) => {
		const ad = Math.abs(Number(a?.duration ?? 12) - 10);
		const bd = Math.abs(Number(b?.duration ?? 12) - 10);
		const ath = a?.thumb ? 0 : 20;
		const bth = b?.thumb ? 0 : 20;
		return ad + ath - (bd + bth);
	});
	const seen = new Set<string>();
	const out: StockPick[] = [];
	for (const v of ranked) {
		const url = String(v?.url ?? '').trim();
		if (!url || seen.has(url)) continue;
		seen.add(url);
		out.push({
			url,
			kind: 'video',
			thumb: String(v?.thumb || ''),
			alt: String(v?.alt || ''),
			photographer: String(v?.photographer || ''),
			source: 'pexels',
			duration: Number(v?.duration ?? 0) || undefined,
		});
	}
	return out;
}

/** Fetch first/best Pexels portrait video match for a query. */
export async function fetchStockVideo(query: string): Promise<StockPick | null> {
	const videos = await searchPexelsVideos(query, 8);
	return videos[0] ?? null;
}

/**
 * Pexels videos, then Pexels photos if the video pool is short.
 * Used when Generate / Pull from assets fills slide backgrounds.
 */
export async function fetchStockMediaPool(query: string, limit = 24): Promise<StockPick[]> {
	const q = query.trim();
	if (!q) return [];
	const videos = await searchPexelsVideos(q, Math.min(15, Math.max(8, limit)));
	if (videos.length >= limit) return videos.slice(0, limit);
	const out = [...videos];
	const seen = new Set(out.map((p) => p.url.split('?')[0] || p.url));
	const pexels = await searchPexelsPhotos(q);
	appendUniquePhotos(out, pexels.photos, limit, seen);
	return out;
}

/**
 * Resolve stock for one template + copy. Returns null for text-only templates.
 * `preferredKind` mirrors Studio’s Stock photos / Stock videos chip.
 */
export async function resolveStockForTemplate(
	template: TemplateId,
	headline: string,
	body: string,
	topicHint = '',
	opts?: { preferredKind?: 'photo' | 'video' },
): Promise<StockPick | null> {
	const [pick] = await resolveStockPicksForSlides(
		[{ template, headline, body }],
		topicHint,
		opts,
	);
	return pick;
}

/** Run stock picks with limited concurrency (keeps Pexels happy). */
export async function mapPool<T, R>(
	items: T[],
	limit: number,
	fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
	const out: R[] = new Array(items.length);
	let next = 0;
	async function worker() {
		while (next < items.length) {
			const i = next++;
			out[i] = await fn(items[i]!, i);
		}
	}
	const n = Math.max(1, Math.min(limit, items.length));
	await Promise.all(Array.from({ length: n }, () => worker()));
	return out;
}
