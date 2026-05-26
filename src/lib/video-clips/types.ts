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
};

export type VideoAnalyzeResult = {
	clips: VideoClip[];
	summary: string;
	demo?: boolean;
	model?: string;
};
