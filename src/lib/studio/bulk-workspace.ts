/** Persist Bulk editor workspace across Studio round-trips / reloads. */

import type { BulkShow, BulkSlide } from './bulk-to-studio';
import { coerceTemplateId } from './template-ids';
import { optimizeImageUrl } from '$lib/client/optimize-image-url';

export const BULK_WORKSPACE_KEY_PREFIX = 'bulk_workspace_v1';
export const BULK_HISTORY_KEY_PREFIX = 'bulk_history_v1';
export const BULK_HISTORY_MAX = 12;

/**
 * Local draft auto-restore window (hard cap). Combined with a live session
 * marker so overnight / new-day visits open placeholders instead of old clips.
 */
export const BULK_WORKSPACE_MAX_AGE_MS = 6 * 60 * 60 * 1000;

/** sessionStorage: only restore local draft while this tab session is “live”. */
const BULK_WS_SESSION_PREFIX = 'bulk_ws_live_v1';
/** How long a tab session stays eligible for auto-restore after last touch. */
export const BULK_WS_SESSION_MAX_AGE_MS = 4 * 60 * 60 * 1000;

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
		touchBulkWorkspaceSession(userId);
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
			touchBulkWorkspaceSession(userId);
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

/** True when a local draft is recent enough to auto-restore on /dashboard/bulk. */
export function isBulkWorkspaceFresh(
	savedAt: number | null | undefined,
	now = Date.now(),
): boolean {
	const t = Number(savedAt);
	if (!Number.isFinite(t) || t <= 0) return false;
	return now - t <= BULK_WORKSPACE_MAX_AGE_MS;
}

function bulkWorkspaceSessionKey(userId: string): string {
	return `${BULK_WS_SESSION_PREFIX}_${userId}`;
}

/** Mark this tab as actively editing Bulk (Studio round-trips / reloads). */
export function touchBulkWorkspaceSession(userId: string): void {
	if (typeof sessionStorage === 'undefined' || !userId) return;
	try {
		sessionStorage.setItem(bulkWorkspaceSessionKey(userId), String(Date.now()));
	} catch {
		/* ignore */
	}
}

/** True when this tab recently edited Bulk — safe to restore the local draft. */
export function hasLiveBulkWorkspaceSession(
	userId: string,
	now = Date.now(),
): boolean {
	if (typeof sessionStorage === 'undefined' || !userId) return false;
	try {
		const t = Number(sessionStorage.getItem(bulkWorkspaceSessionKey(userId)));
		if (!Number.isFinite(t) || t <= 0) return false;
		return now - t <= BULK_WS_SESSION_MAX_AGE_MS;
	} catch {
		return false;
	}
}

export function clearBulkWorkspaceSession(userId: string): void {
	if (typeof sessionStorage === 'undefined' || !userId) return;
	try {
		sessionStorage.removeItem(bulkWorkspaceSessionKey(userId));
	} catch {
		/* ignore */
	}
}

/**
 * Whether bare `/dashboard/bulk` should hydrate from localStorage.
 * Requires both a fresh snapshot and a live tab session (not yesterday’s leftovers).
 */
export function shouldRestoreBulkWorkspace(
	userId: string,
	saved: BulkWorkspaceSnapshot | null | undefined,
): boolean {
	if (!userId || !saved?.shows?.length) return false;
	return isBulkWorkspaceFresh(saved.savedAt) && hasLiveBulkWorkspaceSession(userId);
}

export function clearBulkWorkspace(userId: string): void {
	if (typeof localStorage === 'undefined' || !userId) return;
	try {
		localStorage.removeItem(bulkWorkspaceStorageKey(userId));
	} catch {
		/* ignore */
	}
	clearBulkWorkspaceSession(userId);
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

function looksLikeR2ObjectKey(value: string): boolean {
	const v = value.trim();
	if (!v || v.startsWith('http://') || v.startsWith('https://') || v.startsWith('blob:') || v.startsWith('data:')) {
		return false;
	}
	if (v.startsWith('r2:')) return true;
	// ownerId/… paths used by clip stills + video uploads
	return /^[0-9a-f-]{36}\//i.test(v) || v.includes('/videos/') || v.includes('/clip-stills/');
}

function normalizeR2Key(value: string): string {
	const v = value.trim();
	return v.startsWith('r2:') ? v.slice(3) : v;
}

/**
 * Fresh signed URLs for clip media after reopen. Saved workspaces keep R2 keys +
 * expired signed URLs; without this, News/video previews render black.
 */
export async function rematerializeBulkShows(
	shows: BulkShow[],
	signRead: (key: string) => Promise<string>,
): Promise<BulkShow[]> {
	const cache = new Map<string, Promise<string>>();
	const sign = (rawKey: string): Promise<string> => {
		const key = normalizeR2Key(rawKey);
		if (!key) return Promise.reject(new Error('empty key'));
		let p = cache.get(key);
		if (!p) {
			p = signRead(key).catch((err) => {
				cache.delete(key);
				throw err;
			});
			cache.set(key, p);
		}
		return p;
	};

	const nextShows: BulkShow[] = [];
	for (const show of shows) {
		const slides: BulkSlide[] = [];
		for (const slide of show.slides ?? []) {
			let mediaUrl = String(slide.mediaUrl ?? '').trim();
			let mediaThumb = String(slide.mediaThumb ?? '').trim();
			let reframedPlaybackUrl = String(slide.reframedPlaybackUrl ?? '').trim();

			const thumbKey = String(slide.clipMeta?.thumbnailR2Key ?? '').trim();
			if (thumbKey) {
				try {
					mediaThumb = await sign(thumbKey);
				} catch {
					/* keep prior */
				}
			} else if (looksLikeR2ObjectKey(mediaThumb)) {
				try {
					mediaThumb = await sign(mediaThumb);
				} catch {
					/* keep prior */
				}
			}

			const reframedKey = String(slide.reframedR2Key ?? '').trim();
			const sourceKey = String(slide.sourceR2Key ?? '').trim();
			if (reframedKey) {
				try {
					const url = await sign(reframedKey);
					reframedPlaybackUrl = url;
					if (slide.mediaKind === 'video') mediaUrl = url;
				} catch {
					/* keep prior */
				}
			} else if (sourceKey && slide.mediaKind === 'video') {
				try {
					mediaUrl = await sign(sourceKey);
				} catch {
					/* keep prior */
				}
			} else if (looksLikeR2ObjectKey(mediaUrl)) {
				try {
					mediaUrl = await sign(mediaUrl);
				} catch {
					/* keep prior */
				}
			}

			slides.push({
				...slide,
				mediaUrl: mediaUrl || undefined,
				mediaThumb: mediaThumb || undefined,
				reframedPlaybackUrl: reframedPlaybackUrl || undefined,
			});
		}
		nextShows.push({ ...show, slides });
	}
	return nextShows;
}

