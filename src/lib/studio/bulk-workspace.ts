/** Persist Bulk editor workspace across Studio round-trips / reloads. */

import type { BulkShow, BulkSlide } from './bulk-to-studio';
import { coerceTemplateId } from './template-ids';
import { optimizeImageUrl } from '$lib/client/optimize-image-url';

export const BULK_WORKSPACE_KEY_PREFIX = 'bulk_workspace_v1';
export const BULK_HISTORY_KEY_PREFIX = 'bulk_history_v1';
export const BULK_HISTORY_MAX = 12;

export type BulkWorkspaceSnapshot = {
	v: 1;
	savedAt: number;
	selectedShowId: string | null;
	topic?: string;
	shows: BulkShow[];
	clipProjectId?: string | null;
};

/** One archived generation / workspace snapshot for later reopen. */
export type BulkHistoryEntry = {
	id: string;
	savedAt: number;
	topic: string;
	showCount: number;
	titles: string[];
	/** First available thumb for the card preview */
	previewThumb?: string;
	selectedShowId: string | null;
	shows: BulkShow[];
};

export type BulkHistoryLibrary = {
	v: 1;
	entries: BulkHistoryEntry[];
};

export function bulkWorkspaceStorageKey(userId: string): string {
	return `${BULK_WORKSPACE_KEY_PREFIX}_${userId}`;
}

export function bulkHistoryStorageKey(userId: string): string {
	return `${BULK_HISTORY_KEY_PREFIX}_${userId}`;
}

/** True when the stack has real content worth keeping in history. */
export function showsHaveContent(shows: BulkShow[]): boolean {
	return (shows ?? []).some((show) => {
		if (String(show.title ?? '').trim()) return true;
		return (show.slides ?? []).some(
			(sl) =>
				String(sl.headline ?? '').trim() ||
				String(sl.body ?? '').trim() ||
				String(sl.mediaUrl ?? '').trim() ||
				String(sl.mediaThumb ?? '').trim(),
		);
	});
}

function firstPreviewThumb(shows: BulkShow[]): string | undefined {
	for (const show of shows ?? []) {
		for (const sl of show.slides ?? []) {
			const thumb = String(sl.mediaThumb || sl.mediaUrl || '').trim();
			if (thumb && !thumb.startsWith('blob:')) return thumb;
		}
	}
	return undefined;
}

function stripEphemeralSlide(slide: BulkSlide): BulkSlide {
	const {
		mediaLoading: _ml,
		reframeBusy: _rb,
		...rest
	} = slide;
	return {
		...rest,
		template: coerceTemplateId(slide.template),
		headline: String(slide.headline ?? ''),
		body: String(slide.body ?? ''),
		captions: { ...slide.captions },
		mediaUrl: String(slide.mediaUrl ?? '').trim() || undefined,
		mediaThumb: String(slide.mediaThumb ?? '').trim() || undefined,
		mediaKind: slide.mediaKind ?? null,
	};
}

function stripEphemeralShow(show: BulkShow): BulkShow {
	return {
		...show,
		title: String(show.title ?? ''),
		slides: (show.slides ?? []).filter(Boolean).map(stripEphemeralSlide),
		activeSlideId: show.activeSlideId || show.slides?.[0]?.id || '',
	};
}

/** Compress a data:/blob: image for localStorage (WebP, capped size). */
async function compressDataUrlImage(
	src: string,
	opts?: { maxDim?: number; quality?: number },
): Promise<string> {
	const maxDim = opts?.maxDim ?? 1280;
	const quality = opts?.quality ?? 0.82;
	try {
		const img = await new Promise<HTMLImageElement>((resolve, reject) => {
			const el = new Image();
			el.onload = () => resolve(el);
			el.onerror = () => reject(new Error('decode failed'));
			el.src = src;
		});
		const scale = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight, 1));
		const w = Math.max(1, Math.round(img.naturalWidth * scale));
		const h = Math.max(1, Math.round(img.naturalHeight * scale));
		const canvas = document.createElement('canvas');
		canvas.width = w;
		canvas.height = h;
		const ctx = canvas.getContext('2d');
		if (!ctx) return src;
		ctx.drawImage(img, 0, 0, w, h);
		const out = canvas.toDataURL('image/webp', quality);
		// Prefer smaller encoding; fall back if WebP balloons somehow
		if (out.startsWith('data:image/webp') && out.length < src.length * 1.05) return out;
		const jpeg = canvas.toDataURL('image/jpeg', quality);
		return jpeg.length < src.length ? jpeg : src;
	} catch {
		return src;
	}
}

async function optimizeSlideMedia(slide: BulkSlide): Promise<BulkSlide> {
	let mediaUrl = String(slide.mediaUrl ?? '').trim();
	let mediaThumb = String(slide.mediaThumb ?? '').trim();

	if (mediaUrl.startsWith('data:') || mediaUrl.startsWith('blob:')) {
		mediaUrl = await compressDataUrlImage(mediaUrl, { maxDim: 1280, quality: 0.82 });
	} else if (mediaUrl && slide.mediaKind !== 'video') {
		mediaUrl = optimizeImageUrl(mediaUrl, 1080);
	}

	if (mediaThumb.startsWith('data:') || mediaThumb.startsWith('blob:')) {
		mediaThumb = await compressDataUrlImage(mediaThumb, { maxDim: 320, quality: 0.78 });
	} else if (mediaThumb) {
		mediaThumb = optimizeImageUrl(mediaThumb, 256);
	}

	return {
		...slide,
		mediaUrl: mediaUrl || undefined,
		mediaThumb: mediaThumb || undefined,
	};
}

async function optimizeShowsForStorage(shows: BulkShow[]): Promise<BulkShow[]> {
	const out: BulkShow[] = [];
	for (const show of shows) {
		const slides: BulkSlide[] = [];
		for (const slide of show.slides ?? []) {
			slides.push(await optimizeSlideMedia(stripEphemeralSlide(slide)));
		}
		out.push({
			...stripEphemeralShow(show),
			slides,
			activeSlideId: show.activeSlideId || slides[0]?.id || '',
		});
	}
	return out;
}

export async function saveBulkWorkspace(
	userId: string,
	snapshot: Omit<BulkWorkspaceSnapshot, 'v' | 'savedAt' | 'shows'> & { shows: BulkShow[] },
): Promise<boolean> {
	if (typeof localStorage === 'undefined' || !userId) return false;
	try {
		const shows = await optimizeShowsForStorage(snapshot.shows ?? []);
		const payload: BulkWorkspaceSnapshot = {
			v: 1,
			savedAt: Date.now(),
			selectedShowId: snapshot.selectedShowId,
			topic: snapshot.topic,
			shows,
			clipProjectId: snapshot.clipProjectId ?? null,
		};
		localStorage.setItem(bulkWorkspaceStorageKey(userId), JSON.stringify(payload));
		return true;
	} catch (e) {
		console.warn('[bulk] workspace save failed', e);
		// Quota? try again with fewer / more compressed thumbs only
		try {
			const lean = await optimizeShowsForStorage(snapshot.shows ?? []);
			const smaller = lean.map((show) => ({
				...show,
				slides: show.slides.map((sl) => {
					const url = String(sl.mediaUrl ?? '');
					// Drop huge data URLs if still too big; keep remote URLs
					if (url.startsWith('data:') && url.length > 400_000) {
						return { ...sl, mediaUrl: sl.mediaThumb || '', mediaThumb: sl.mediaThumb };
					}
					return sl;
				}),
			}));
			const payload: BulkWorkspaceSnapshot = {
				v: 1,
				savedAt: Date.now(),
				selectedShowId: snapshot.selectedShowId,
				topic: snapshot.topic,
				shows: smaller,
				clipProjectId: snapshot.clipProjectId ?? null,
			};
			localStorage.setItem(bulkWorkspaceStorageKey(userId), JSON.stringify(payload));
			return true;
		} catch {
			return false;
		}
	}
}

export function loadBulkWorkspace(userId: string): BulkWorkspaceSnapshot | null {
	if (typeof localStorage === 'undefined' || !userId) return null;
	try {
		const raw = localStorage.getItem(bulkWorkspaceStorageKey(userId));
		if (!raw) return null;
		const parsed = JSON.parse(raw) as BulkWorkspaceSnapshot;
		if (!parsed || parsed.v !== 1 || !Array.isArray(parsed.shows) || !parsed.shows.length) {
			return null;
		}
		return {
			...parsed,
			shows: parsed.shows.map(stripEphemeralShow),
		};
	} catch {
		return null;
	}
}

export function clearBulkWorkspace(userId: string): void {
	if (typeof localStorage === 'undefined' || !userId) return;
	try {
		localStorage.removeItem(bulkWorkspaceStorageKey(userId));
	} catch {
		/* ignore */
	}
}

export function loadBulkHistory(userId: string): BulkHistoryEntry[] {
	if (typeof localStorage === 'undefined' || !userId) return [];
	try {
		const raw = localStorage.getItem(bulkHistoryStorageKey(userId));
		if (!raw) return [];
		const parsed = JSON.parse(raw) as BulkHistoryLibrary;
		if (!parsed || parsed.v !== 1 || !Array.isArray(parsed.entries)) return [];
		return parsed.entries
			.filter((e) => e && Array.isArray(e.shows) && e.shows.length)
			.map((e) => ({
				...e,
				shows: e.shows.map(stripEphemeralShow),
				titles: Array.isArray(e.titles) ? e.titles : e.shows.map((s) => s.title || 'Untitled'),
				showCount: e.showCount || e.shows.length,
				topic: String(e.topic ?? ''),
				savedAt: Number(e.savedAt) || Date.now(),
			}));
	} catch {
		return [];
	}
}

function writeBulkHistory(userId: string, entries: BulkHistoryEntry[]): boolean {
	if (typeof localStorage === 'undefined' || !userId) return false;
	try {
		const payload: BulkHistoryLibrary = {
			v: 1,
			entries: entries.slice(0, BULK_HISTORY_MAX),
		};
		localStorage.setItem(bulkHistoryStorageKey(userId), JSON.stringify(payload));
		return true;
	} catch (e) {
		console.warn('[bulk] history save failed', e);
		return false;
	}
}

/**
 * Archive the current stack into history (newest first).
 * Skips empty/blank stacks. Dedupes against the most recent entry when identical ids.
 */
export async function archiveBulkShowsToHistory(
	userId: string,
	opts: {
		shows: BulkShow[];
		selectedShowId: string | null;
		topic?: string;
	},
): Promise<BulkHistoryEntry | null> {
	if (!userId || !showsHaveContent(opts.shows)) return null;

	const optimized = await optimizeShowsForStorage(opts.shows);
	const entry: BulkHistoryEntry = {
		id: crypto.randomUUID(),
		savedAt: Date.now(),
		topic: String(opts.topic ?? '').trim(),
		showCount: optimized.length,
		titles: optimized.map((s) => String(s.title ?? '').trim() || 'Untitled'),
		previewThumb: firstPreviewThumb(optimized),
		selectedShowId: opts.selectedShowId,
		shows: optimized,
	};

	const existing = loadBulkHistory(userId);
	// Skip if identical show ids to the newest entry (avoid double-archive on rapid generate)
	const newest = existing[0];
	if (
		newest &&
		newest.shows.length === entry.shows.length &&
		newest.shows.every((s, i) => s.id === entry.shows[i]?.id)
	) {
		return newest;
	}

	const next = [entry, ...existing].slice(0, BULK_HISTORY_MAX);
	if (!writeBulkHistory(userId, next)) {
		// Quota: try without full-res mediaUrl on slides
		const lean = next.map((e, idx) => {
			if (idx > 0) return e;
			return {
				...e,
				shows: e.shows.map((show) => ({
					...show,
					slides: show.slides.map((sl) => {
						const url = String(sl.mediaUrl ?? '');
						if (url.startsWith('data:') && url.length > 120_000) {
							return { ...sl, mediaUrl: sl.mediaThumb || '', mediaThumb: sl.mediaThumb };
						}
						return sl;
					}),
				})),
			};
		});
		writeBulkHistory(userId, lean);
	}
	return entry;
}

export function deleteBulkHistoryEntry(userId: string, entryId: string): BulkHistoryEntry[] {
	const next = loadBulkHistory(userId).filter((e) => e.id !== entryId);
	writeBulkHistory(userId, next);
	return next;
}

export function getBulkHistoryEntry(userId: string, entryId: string): BulkHistoryEntry | null {
	return loadBulkHistory(userId).find((e) => e.id === entryId) ?? null;
}
