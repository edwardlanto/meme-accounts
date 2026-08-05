import type { VideoClip, VideoImportMeta } from '$lib/video-clips/types';
import type { VideoLayoutId } from '$lib/templates';

export const VIDEO_SESSION_KEY = 'videos_clip_session_v1';
export const VIDEO_FORM_PREFS_KEY = 'videos_clip_form_prefs_v1';
/** Set when leaving Videos → Studio so Back / return restores clips once. */
export const VIDEO_RESUME_FLAG_KEY = 'videos_resume_once_v1';
/** Explicitly saved clip jobs (localStorage) — reopen from Videos home. */
export const VIDEO_SAVED_CLIPS_KEY = 'videos_saved_clips_v1';

export type VideoWorkflowStep = 'source' | 'captions' | 'clips';

/** Working clip-finder session (tab sessionStorage only — not restored on every login). */
export type VideoSessionCache = {
	v: 1;
	savedAt: number;
	youtubeUrl: string;
	topicHint: string;
	importTab: 'youtube' | 'upload';
	clipMode: 'highlights' | 'all';
	clipCount: number;
	clipMinSec: number;
	clipMaxSec: number;
	source: VideoImportMeta;
	clips: VideoClip[];
	summary: string;
	demo: boolean;
	model: string;
	selectedClipId: string | null;
	/** Where the user left the stepper (defaults to clips for older caches). */
	workflowStep?: VideoWorkflowStep;
};

export type SavedVideoClipsEntry = {
	id: string;
	savedAt: number;
	title: string;
	clipCount: number;
	thumbnailUrl?: string;
	session: Omit<VideoSessionCache, 'v' | 'savedAt'> & { v?: 1; savedAt?: number };
};

const MAX_SAVED_CLIPS = 12;

/** Form prefs even before analysis (URL, slider settings, etc.). */
export type VideoFormPrefs = {
	v: 1;
	youtubeUrl: string;
	topicHint: string;
	importTab: 'youtube' | 'upload';
	clipMode: 'highlights' | 'all';
	clipCount: number;
	clipMinSec: number;
	clipMaxSec: number;
	videoAspectRatio?: '9:16' | '1:1' | '16:9';
	/** @deprecated Template picker removed from Videos — ignored if present. */
	clipLayout?: VideoLayoutId;
	autoReframeEnabled?: boolean;
	reframeAspectRatio?: '9:16' | '1:1' | '16:9' | '4:5';
	reframeMethod?: 'detection' | 'saliency';
	reframeMotionThreshold?: number;
	reframePaddingMethod?: 'blur' | 'solid_color';
	reframeDebug?: boolean;
};

function writeSessionJson(key: string, value: unknown): boolean {
	if (typeof window === 'undefined') return false;
	try {
		sessionStorage.setItem(key, JSON.stringify(value));
		return true;
	} catch (e) {
		console.warn('[videos] failed to cache session', e);
		return false;
	}
}

function writeLocalJson(key: string, value: unknown): boolean {
	if (typeof window === 'undefined') return false;
	try {
		localStorage.setItem(key, JSON.stringify(value));
		return true;
	} catch (e) {
		console.warn('[videos] failed to cache prefs', e);
		return false;
	}
}

function readSessionJson<T>(key: string): T | null {
	if (typeof window === 'undefined') return null;
	try {
		const raw = sessionStorage.getItem(key);
		if (!raw) return null;
		return JSON.parse(raw) as T;
	} catch {
		return null;
	}
}

function readLocalJson<T>(key: string): T | null {
	if (typeof window === 'undefined') return null;
	try {
		const raw = localStorage.getItem(key);
		if (!raw) return null;
		return JSON.parse(raw) as T;
	} catch {
		return null;
	}
}

function removeSessionKey(key: string): void {
	if (typeof window === 'undefined') return;
	try {
		sessionStorage.removeItem(key);
	} catch {
		/* ignore */
	}
}

function removeLocalKey(key: string): void {
	if (typeof window === 'undefined') return;
	try {
		localStorage.removeItem(key);
	} catch {
		/* ignore */
	}
}

/** Drop legacy localStorage session so logins stop auto-loading old videos. */
export function migrateAwayFromLocalVideoSession(): void {
	if (typeof window === 'undefined') return;
	// Do not rehydrate into sessionStorage — that caused Videos to reopen old jobs.
	removeLocalKey(VIDEO_SESSION_KEY);
}

export function saveVideoSession(session: Omit<VideoSessionCache, 'v' | 'savedAt'>): void {
	writeSessionJson(VIDEO_SESSION_KEY, {
		...session,
		v: 1 as const,
		savedAt: Date.now(),
	} satisfies VideoSessionCache);
}

export function loadVideoSession(): VideoSessionCache | null {
	const parsed = readSessionJson<VideoSessionCache>(VIDEO_SESSION_KEY);
	if (!parsed || parsed.v !== 1) return null;
	if (!parsed.source?.playbackUrl && !parsed.source?.r2Key && !parsed.source?.youtubeId) {
		return null;
	}
	if (!Array.isArray(parsed.clips) || !parsed.clips.length) return null;
	// Drop sessions older than 24h (tab leftover)
	if (Date.now() - (parsed.savedAt || 0) > 24 * 60 * 60 * 1000) {
		clearVideoSession();
		return null;
	}
	return parsed;
}

export function clearVideoSession(): void {
	removeSessionKey(VIDEO_SESSION_KEY);
	removeSessionKey(VIDEO_RESUME_FLAG_KEY);
	removeLocalKey(VIDEO_SESSION_KEY);
}

/** Call before navigating to Studio so returning restores the clip list. */
export function markVideoSessionForResume(): void {
	if (typeof window === 'undefined') return;
	try {
		sessionStorage.setItem(VIDEO_RESUME_FLAG_KEY, '1');
	} catch {
		/* ignore */
	}
}

export function consumeVideoResumeFlag(): boolean {
	if (typeof window === 'undefined') return false;
	try {
		const on = sessionStorage.getItem(VIDEO_RESUME_FLAG_KEY) === '1';
		if (on) sessionStorage.removeItem(VIDEO_RESUME_FLAG_KEY);
		return on;
	} catch {
		return false;
	}
}

/**
 * Auto-restore only when returning from Studio (one-shot flag).
 * Never on homepage / sidebar / browser back — Videos always starts fresh otherwise.
 */
export function shouldAutoRestoreVideoSession(): boolean {
	return consumeVideoResumeFlag();
}

export function loadSavedVideoClips(): SavedVideoClipsEntry[] {
	const parsed = readLocalJson<{ v: 1; items: SavedVideoClipsEntry[] }>(VIDEO_SAVED_CLIPS_KEY);
	if (!parsed || parsed.v !== 1 || !Array.isArray(parsed.items)) return [];
	return parsed.items
		.filter((x) => x?.id && x?.session && Array.isArray(x.session?.clips) && x.session.clips.length)
		.sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0));
}

function writeSavedVideoClips(items: SavedVideoClipsEntry[]): void {
	writeLocalJson(VIDEO_SAVED_CLIPS_KEY, { v: 1 as const, items: items.slice(0, MAX_SAVED_CLIPS) });
}

/** Persist the current working session into the saved library (explicit user action or auto-save). */
export function saveVideoClipsToLibrary(
	session: Omit<VideoSessionCache, 'v' | 'savedAt'>,
): SavedVideoClipsEntry | null {
	if (!session?.clips?.length || !session.source) return null;
	const title =
		session.source.title?.trim() ||
		session.topicHint?.trim() ||
		session.youtubeUrl?.trim() ||
		'Saved clips';
	const sourceKey =
		session.source.r2Key?.trim() ||
		session.source.youtubeId?.trim() ||
		session.youtubeUrl?.trim() ||
		'';
	const entry: SavedVideoClipsEntry = {
		id: `saved_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
		savedAt: Date.now(),
		title,
		clipCount: session.clips.length,
		thumbnailUrl: session.source.thumbnailUrl || undefined,
		session: { ...session },
	};
	const existing = loadSavedVideoClips();
	const next = [
		entry,
		...existing.filter((x) => {
			if (!sourceKey) return !(x.title === title && x.clipCount === entry.clipCount);
			const otherKey =
				x.session?.source?.r2Key?.trim() ||
				x.session?.source?.youtubeId?.trim() ||
				x.session?.youtubeUrl?.trim() ||
				'';
			return otherKey !== sourceKey;
		}),
	];
	writeSavedVideoClips(next);
	return entry;
}

export function removeSavedVideoClips(id: string): void {
	writeSavedVideoClips(loadSavedVideoClips().filter((x) => x.id !== id));
}

export function getSavedVideoClipsEntry(id: string): SavedVideoClipsEntry | null {
	return loadSavedVideoClips().find((x) => x.id === id) ?? null;
}

export function saveVideoFormPrefs(prefs: Omit<VideoFormPrefs, 'v'>): void {
	writeLocalJson(VIDEO_FORM_PREFS_KEY, { ...prefs, v: 1 as const } satisfies VideoFormPrefs);
}

export function loadVideoFormPrefs(): VideoFormPrefs | null {
	const parsed = readLocalJson<VideoFormPrefs>(VIDEO_FORM_PREFS_KEY);
	if (!parsed || parsed.v !== 1) return null;
	return parsed;
}
