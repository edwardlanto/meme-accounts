export type VideoClip = {
	id: string;
	title: string;
	startSec: number;
	endSec: number;
	viralityScore: number;
	hook: string;
	reason: string;
	/** Optional transcript excerpt for this segment */
	transcript?: string;
	/**
	 * Slash / FutureTech-style News overlay hook (ALL CAPS).
	 * May include `[[phrase]]` highlight markers for the News template.
	 */
	newsHeadline?: string;
	/**
	 * Casual top-of-frame hook for the Hook video template (sentence case).
	 * e.g. "One of the most uncomfortable live interviews ever"
	 */
	videoHook?: string;
	/** R2 key for a cut+reframed preview MP4 (standalone clip, starts at 0). */
	reframedR2Key?: string;
	/** Signed playback URL for `reframedR2Key`. */
	reframedPlaybackUrl?: string;
	/** Fingerprint of reframe settings used to produce the preview. */
	reframeSettingsKey?: string;
	/**
	 * Absolute timestamp (seconds on source timeline) of the best visual frame
	 * for a scene still — chosen by Gemini when available.
	 */
	bestFrameSec?: number;
	/** R2 key for a JPEG still of the best frame in this clip. */
	thumbnailR2Key?: string;
	/** Signed URL for `thumbnailR2Key` (or equivalent). */
	thumbnailUrl?: string;
};

export type VideoSourceKind = 'upload' | 'youtube';

export type VideoImportMeta = {
	kind: VideoSourceKind;
	title: string;
	durationSec: number;
	/** Playback URL (signed R2 or YouTube embed page) */
	playbackUrl: string;
	/** R2 key — set for uploads and YouTube after yt-dlp ingest */
	r2Key?: string;
	youtubeId?: string;
	thumbnailUrl?: string;
	/** Full timed transcript (`[m:ss->m:ss] text`) for caption sync */
	transcript?: string;
	/** YouTube / source description — who & what context for News hooks */
	description?: string;
	/** Channel / uploader when known */
	channel?: string;
};

export type VideoAnalyzeResult = {
	clips: VideoClip[];
	summary: string;
	demo?: boolean;
	model?: string;
};
