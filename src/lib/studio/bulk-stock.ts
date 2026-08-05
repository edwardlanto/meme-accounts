/** Pick stock photo/video queries from slide copy for media templates. */

import type { TemplateId } from './template-ids';
import { isPhotoStoryFamily, isVideoStoryFamily } from './template-ids';

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
	return isVideoStoryFamily(id);
}

export function templateUsesStockMedia(id: TemplateId): boolean {
	return templateUsesStockImage(id) || templateUsesStockVideo(id);
}

/**
 * Build a short stock-search query from slide text.
 * Prefers concrete nouns from the headline; always returns something searchable.
 */
export function stockQueryFromSlide(headline: string, body = '', topicHint = ''): string {
	const raw = `${headline} ${body}`.replace(/[^\p{L}\p{N}\s]/gu, ' ');
	const words = raw
		.split(/\s+/)
		.map((w) => w.trim())
		.filter((w) => w.length > 2 && !STOP.has(w.toLowerCase()));
	const unique: string[] = [];
	const seen = new Set<string>();
	for (const w of words) {
		const key = w.toLowerCase();
		if (seen.has(key)) continue;
		seen.add(key);
		unique.push(w);
		if (unique.length >= 5) break;
	}
	let q = unique.join(' ').trim();
	if (!q && topicHint.trim()) {
		q = topicHint
			.trim()
			.split(/\s+/)
			.filter((w) => w.length > 1 && !STOP.has(w.toLowerCase()))
			.slice(0, 4)
			.join(' ');
	}
	return q.slice(0, 80) || 'cinematic portrait business';
}

export type StockPick = {
	url: string;
	kind: 'image' | 'video';
	thumb?: string;
	alt?: string;
	photographer?: string;
	source?: 'unsplash' | 'pexels';
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

function bestPhoto(photos: PhotoCandidate[]): PhotoCandidate | null {
	if (!photos.length) return null;
	return [...photos].sort((a, b) => scorePhoto(b) - scorePhoto(a))[0] ?? null;
}

async function searchUnsplash(query: string): Promise<{ photos: PhotoCandidate[]; error?: string }> {
	const res = await fetch(
		`/api/unsplash/search?query=${encodeURIComponent(query)}&per_page=12&page=1`,
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
	return { photos };
}

async function searchPexelsPhotos(
	query: string,
): Promise<{ photos: PhotoCandidate[]; error?: string }> {
	const res = await fetch(
		`/api/pexels/search?query=${encodeURIComponent(query)}&per_page=12&page=1&orientation=portrait`,
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
	return { photos };
}

function pingUnsplashDownload(downloadLocation?: string) {
	if (!downloadLocation) return;
	void fetch('/api/unsplash/download', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ downloadLocation }),
	}).catch(() => {});
}

/** Fetch best stock image: Unsplash first, Pexels fallback. */
export async function fetchStockImage(query: string): Promise<StockPick | null> {
	const q = query.trim();
	if (!q) return null;

	const unsplash = await searchUnsplash(q);
	let pick = bestPhoto(unsplash.photos);
	let lastError = unsplash.error;

	if (!pick) {
		const pexels = await searchPexelsPhotos(q);
		pick = bestPhoto(pexels.photos);
		lastError = pexels.error || lastError;
	}
	if (!pick) {
		if (lastError) throw new Error(lastError);
		return null;
	}

	if (pick.source === 'unsplash') pingUnsplashDownload(pick.downloadLocation);

	return {
		url: pick.regular,
		kind: 'image',
		thumb: pick.small || pick.regular,
		alt: pick.alt || '',
		photographer: pick.photographer || '',
		source: pick.source,
	};
}

/** Fetch first/best Pexels portrait video match for a query. */
export async function fetchStockVideo(query: string): Promise<StockPick | null> {
	const q = query.trim();
	if (!q) return null;
	const res = await fetch(
		`/api/pexels/videos?query=${encodeURIComponent(q)}&per_page=8&page=1`,
	);
	const data = await res.json().catch(() => ({}));
	if (!res.ok) {
		throw new Error(String(data?.error || `Pexels video ${res.status}`));
	}
	const videos = Array.isArray(data.videos) ? data.videos : [];
	// Prefer mid-length clips with a thumb
	const ranked = [...videos].sort((a: any, b: any) => {
		const ad = Math.abs(Number(a?.duration ?? 12) - 10);
		const bd = Math.abs(Number(b?.duration ?? 12) - 10);
		const ath = a?.thumb ? 0 : 20;
		const bth = b?.thumb ? 0 : 20;
		return ad + ath - (bd + bth);
	});
	const v = ranked[0];
	if (!v?.url) return null;
	return {
		url: String(v.url),
		kind: 'video',
		thumb: String(v.thumb || ''),
		alt: String(v.alt || ''),
		photographer: String(v.photographer || ''),
		source: 'pexels',
	};
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
	if (templateUsesStockVideo(template)) {
		return (await fetchStockVideo(query)) ?? (await fetchStockImage(query));
	}
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
