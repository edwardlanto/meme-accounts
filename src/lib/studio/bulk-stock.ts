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

async function searchUnsplash(
	query: string,
	page = 1,
	perPage = 12,
): Promise<{ photos: PhotoCandidate[]; error?: string; totalPages?: number }> {
	const res = await fetch(
		`/api/unsplash/search?query=${encodeURIComponent(query)}&per_page=${perPage}&page=${page}`,
	);
	const data = await res.json().catch(() => ({}));
	if (!res.ok) {
		return { photos: [], error: String(data?.error || `Unsplash ${res.status}`) };
	}
	const photos = (Array.isArray(data.photos) ? data.photos : [])
		.map((p: any) => ({
			regular: String(p?.regular ?? ''),
			small: String(p?.small ?? ''),
			alt: String(p?.alt ?? ''),
			photographer: String(p?.photographer ?? ''),
			likes: Number(p?.likes ?? 0) || 0,
			downloads: Number(p?.downloads ?? 0) || 0,
			downloadLocation: String(p?.downloadLocation ?? ''),
			source: 'unsplash' as const,
		}))
		.filter((p: PhotoCandidate) => p.regular);
	return { photos, totalPages: Number(data?.totalPages ?? 1) || 1 };
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

function pingUnsplashDownload(downloadLocation?: string) {
	if (!downloadLocation) return;
	void fetch('/api/unsplash/download', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ downloadLocation }),
	}).catch(() => {});
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
		const pick = candidateToPick(p);
		if (pick.source === 'unsplash') pingUnsplashDownload(pick.downloadLocation);
		out.push(pick);
		if (out.length >= limit) break;
	}
}

/** Pexels photos first, then Unsplash. No videos. */
export async function fetchStockImagePool(query: string, limit = 24): Promise<StockPick[]> {
	const q = query.trim();
	if (!q) return [];
	const out: StockPick[] = [];
	const seen = new Set<string>();
	const pexels = await searchPexelsPhotos(q);
	appendUniquePhotos(out, pexels.photos, limit, seen);
	if (out.length >= limit) return out;
	const unsplash = await searchUnsplash(q);
	appendUniquePhotos(out, unsplash.photos, limit, seen);
	return out;
}

/** Fetch best still: Pexels photos, then Unsplash. */
export async function fetchStockImage(query: string): Promise<StockPick | null> {
	const pool = await fetchStockImagePool(query, 1);
	return pool[0] ?? null;
}

/** Pexels first, then Unsplash — ranked for square circle badges. */
export async function fetchStockCircleImagePool(query: string, limit = 12): Promise<StockPick[]> {
	const q = query.trim();
	if (!q) return [];
	const out: StockPick[] = [];
	const seen = new Set<string>();
	const pexels = await searchPexelsPhotos(q, 1, Math.max(limit, 12));
	appendUniquePhotos(out, pexels.photos, limit, seen, scoreCirclePhoto);
	if (out.length >= limit) return out;
	const unsplash = await searchUnsplash(q, 1, Math.max(limit, 12));
	appendUniquePhotos(out, unsplash.photos, limit, seen, scoreCirclePhoto);
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

const STOCK_SIDEBAR_FILL_THRESHOLD = 6;

/** Sidebar search: Pexels page first, Unsplash fills when results are sparse. */
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

	if (page === 1 && photos.length < STOCK_SIDEBAR_FILL_THRESHOLD) {
		const unsplash = await searchUnsplash(q, 1, perPage);
		const seen = new Set(photos.map((p) => p.regular.split('?')[0]));
		for (const p of unsplash.photos) {
			const key = photoKey(p);
			if (!key || seen.has(key)) continue;
			seen.add(key);
			photos.push({
				id: `unsplash-${photos.length}-${key}`,
				small: p.small || p.regular,
				regular: p.regular,
				alt: p.alt || '',
				photographer: p.photographer || '',
				source: 'unsplash',
				downloadLocation: p.downloadLocation,
			});
			if (photos.length >= perPage) break;
		}
	}

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
 * Waterfall pool: Pexels videos → Pexels photos → Unsplash.
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
	if (out.length >= limit) return out;
	const unsplash = await searchUnsplash(q);
	appendUniquePhotos(out, unsplash.photos, limit, seen);
	return out;
}

/**
 * Resolve stock for one template + copy. Returns null for text-only templates.
 */
export async function resolveStockForTemplate(
	template: TemplateId,
	headline: string,
	body: string,
	topicHint = '',
): Promise<StockPick | null> {
	if (!templateUsesStockMedia(template)) return null;
	const query = stockQueryFromSlide(headline, body, topicHint);
	const video = await fetchStockVideo(query);
	if (video) return video;
	return fetchStockImage(query);
}

/** Run stock picks with limited concurrency (keeps Unsplash/Pexels happy). */
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
