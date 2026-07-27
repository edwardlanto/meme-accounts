import type { VideoClip, VideoImportMeta } from '$lib/video-clips/types';

export const VIDEO_SESSION_KEY = 'videos_clip_session_v1';
export const VIDEO_FORM_PREFS_KEY = 'videos_clip_form_prefs_v1';
/** Set when leaving Videos → Studio so Back / return restores clips once. */
export const VIDEO_RESUME_FLAG_KEY = 'videos_resume_once_v1';

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
	clipLayout?: 'story' | 'fit' | 'blur';
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

/** Drop legacy localStorage session so logins stop auto-loading old videos.
 *  One-time move into sessionStorage so "Continue last clips" still works. */
export function migrateAwayFromLocalVideoSession(): void {
	if (typeof window === 'undefined') return;
	try {
		const raw = localStorage.getItem(VIDEO_SESSION_KEY);
		if (raw && !sessionStorage.getItem(VIDEO_SESSION_KEY)) {
			sessionStorage.setItem(VIDEO_SESSION_KEY, raw);
		}
	} catch {
		/* ignore */
	}
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

function isBackForwardNavigation(): boolean {
	if (typeof window === 'undefined') return false;
	try {
		const nav = performance.getEntriesByType('navigation')[0] as
			| PerformanceNavigationTiming
			| undefined;
		if (nav?.type === 'back_forward') return true;
	} catch {
		/* ignore */
	}
	// Legacy
	try {
		const legacy = (performance as unknown as { navigation?: { type?: number } }).navigation;
		// 2 === TYPE_BACK_FORWARD
		if (legacy?.type === 2) return true;
	} catch {
		/* ignore */
	}
	return false;
}

/**
 * Auto-restore only when returning from Studio / browser Back —
 * not on fresh login or sidebar navigation to Videos.
 */
export function shouldAutoRestoreVideoSession(): boolean {
	if (consumeVideoResumeFlag()) return true;
	if (isBackForwardNavigation()) return true;
	return false;
}

export function saveVideoFormPrefs(prefs: Omit<VideoFormPrefs, 'v'>): void {
	writeLocalJson(VIDEO_FORM_PREFS_KEY, { ...prefs, v: 1 as const } satisfies VideoFormPrefs);
}

export function loadVideoFormPrefs(): VideoFormPrefs | null {
	const parsed = readLocalJson<VideoFormPrefs>(VIDEO_FORM_PREFS_KEY);
	if (!parsed || parsed.v !== 1) return null;
	return parsed;
}
