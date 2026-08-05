/** Build bulk slideshows from AI-ranked video clips. */

import type { VideoClip, VideoImportMeta } from '$lib/video-clips/types';
import type { TemplateId } from './template-ids';
import {
	type BulkShow,
	type BulkSlide,
	type BulkRowCaptions,
	type BulkClipSlideMeta,
	createBlankSlide,
	defaultRowCaptions,
} from './bulk-to-studio';
import {
	buildClipTemplateCopy,
	studioImportMediaForClip,
} from '$lib/video-clips/clip-template-copy';
import { cleanClipSpeechText } from '$lib/video-clips/transcript-segments';
import { newsHeadlineForEditor, demoNewsHeadlineFromClip } from '$lib/video-clips/news-headline';
import type { CaptionSegment } from '$lib/video-clips/caption-sync';
import {
	buildCaptionSegmentsForClip,
	captionPreviewText,
	studioCaptionImportForClip,
} from '$lib/video-clips/clip-captions';

export const BULK_CLIP_IMPORT_RESULT_KEY = 'bulk_clip_import_result_v1';

export type BulkClipImportResult = {
	source: VideoImportMeta;
	clips: VideoClip[];
	summary: string;
	demo: boolean;
	model: string;
	projectId?: string;
	bulkShows?: BulkShow[];
};

export function stashClipImportResult(result: BulkClipImportResult): void {
	if (typeof window === 'undefined') return;
	try {
		sessionStorage.setItem(BULK_CLIP_IMPORT_RESULT_KEY, JSON.stringify(result));
	} catch {
		/* ignore */
	}
}

export function takeClipImportResult(): BulkClipImportResult | null {
	if (typeof window === 'undefined') return null;
	const raw = sessionStorage.getItem(BULK_CLIP_IMPORT_RESULT_KEY);
	try {
		sessionStorage.removeItem(BULK_CLIP_IMPORT_RESULT_KEY);
	} catch {
		/* ignore */
	}
	if (!raw) return null;
	try {
		return JSON.parse(raw) as BulkClipImportResult;
	} catch {
		return null;
	}
}

function newId(): string {
	try {
		if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
			return crypto.randomUUID();
		}
	} catch {
		/* ignore */
	}
	return `id_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export function clipMetaFromVideoClip(clip: VideoClip): BulkClipSlideMeta {
	return {
		clipId: clip.id,
		viralityScore: clip.viralityScore,
		hook: clip.hook,
		reason: clip.reason,
		transcript: clip.transcript,
		newsHeadline: clip.newsHeadline,
		videoHook: clip.videoHook,
		bestFrameSec: Number.isFinite(Number(clip.bestFrameSec)) ? Number(clip.bestFrameSec) : undefined,
		thumbnailR2Key: clip.thumbnailR2Key,
	};
}

export function viralityScoreLabel(score: number): string {
	const outOf10 = Math.min(10, Math.max(0, score / 10));
	return outOf10.toFixed(1);
}

export function viralityScoreTone(score: number): 'hot' | 'mid' | 'cool' {
	const outOf10 = score / 10;
	if (outOf10 >= 7.5) return 'hot';
	if (outOf10 >= 5) return 'mid';
	return 'cool';
}

export function bulkSlideFromVideoClip(
	clip: VideoClip,
	source: VideoImportMeta,
	template: TemplateId,
	caps: BulkRowCaptions,
	opts?: { topicHint?: string },
): BulkSlide {
	const copy = buildClipTemplateCopy(clip, source, { topicHint: opts?.topicHint });
	const media = studioImportMediaForClip(clip, source);
	const usedReframe = media.usedReframe;
	const sourceStart = Math.max(0, Number(clip.startSec) || 0);
	const sourceEnd = Math.max(sourceStart + 0.5, Number(clip.endSec) || 0);
	const duration = Math.max(0.5, sourceEnd - sourceStart);
	const templateHeadline = copy.newsHeadline || clip.newsHeadline || '';
	// Prefer AI news chyron — never fall back to titleFromExcerpt speech slices
	const safeDisplay =
		newsHeadlineForEditor(templateHeadline) ||
		newsHeadlineForEditor(
			demoNewsHeadlineFromClip(clip, source.title || source.description?.slice(0, 80)),
		) ||
		'Clip highlight';
	const captionSegments = buildCaptionSegmentsForClip(clip, source);
	const captionBody = captionPreviewText(captionSegments);
	const capsForImport = { ...caps, enabled: caps.enabled !== false && captionSegments.length > 0 };
	// Store absolute segment times — resolveStudioCaptionImportForSlide shifts for reframed MP4s
	const studioCaptions = studioCaptionImportForClip(captionSegments, capsForImport);

	return {
		...createBlankSlide(template, caps),
		headline: safeDisplay,
		body: captionBody || clip.reason || copy.carouselBody || '',
		captions: {
			...caps,
			enabled: captionSegments.length > 0 && caps.enabled !== false,
		},
		captionSegments: captionSegments.length ? captionSegments : undefined,
		studioCaptionImport: studioCaptions,
		mediaUrl: media.videoUrl || source.playbackUrl,
		mediaKind: 'video',
		// Clip-specific Gemini still only — shared source poster is not a per-scene photo.
		mediaThumb: clip.thumbnailUrl || '',
		sourceClipStart: sourceStart,
		sourceClipEnd: sourceEnd,
		clipStart: usedReframe ? 0 : media.clipStart,
		clipEnd: usedReframe ? duration : media.clipEnd,
		sourceR2Key: source.r2Key,
		reframedR2Key: clip.reframedR2Key,
		reframedPlaybackUrl: clip.reframedPlaybackUrl,
		reframeSettingsKey: clip.reframeSettingsKey,
		clipMeta: {
			...clipMetaFromVideoClip(clip),
			newsHeadline: templateHeadline || clip.newsHeadline,
		},
	};
}

function coerceFollowTemplate(index: number): TemplateId {
	if (index % 3 === 0) return 'news';
	if (index % 3 === 1) return 'textCarousel';
	return 'blackText';
}

export function buildBulkShowsFromVideoClips(
	source: VideoImportMeta,
	clips: VideoClip[],
	opts: {
		template: TemplateId;
		captionDefaults?: Partial<BulkRowCaptions>;
		topicHint?: string;
		summary?: string;
		demo?: boolean;
		model?: string;
		/** Total slides per clip show (hook video + follow-ons). Default 1. */
		slideCount?: number;
	},
): BulkShow[] {
	const caps = defaultRowCaptions(opts.captionDefaults);
	const slideCount = Math.max(1, Math.min(12, Math.floor(Number(opts.slideCount)) || 1));
	return clips.map((clip, index) => {
		const slide = bulkSlideFromVideoClip(clip, source, opts.template, caps, {
			topicHint: opts.topicHint,
		});
		const title =
			slide.headline.trim() ||
			cleanClipSpeechText(clip.title) ||
			source.title ||
			`Clip ${index + 1}`;
		const slides = [slide];
		while (slides.length < slideCount) {
			const extra = createBlankSlide(
				slides.length === 1 ? 'textCarousel' : coerceFollowTemplate(slides.length),
				caps,
			);
			if (slides.length === 1 && (clip.hook || clip.reason)) {
				extra.headline = cleanClipSpeechText(clip.hook || clip.title).slice(0, 72);
				extra.body = cleanClipSpeechText(clip.reason || '').slice(0, 180);
			} else if (slides.length === 2 && clip.transcript) {
				extra.headline = 'Key takeaway';
				extra.body = cleanClipSpeechText(clip.transcript).slice(0, 180);
			}
			slides.push(extra);
		}
		return {
			id: newId(),
			title,
			slides,
			activeSlideId: slides[0]!.id,
			fromVideoClips: true,
			clipSummary: index === 0 ? opts.summary ?? '' : '',
			videoDemo: opts.demo ?? false,
			videoModel: opts.model ?? '',
		};
	});
}

/** Legacy: one slideshow with every clip as a slide. Prefer `buildBulkShowsFromVideoClips`. */
export function buildBulkShowFromVideoClips(
	source: VideoImportMeta,
	clips: VideoClip[],
	opts: {
		template: TemplateId;
		captionDefaults?: Partial<BulkRowCaptions>;
		topicHint?: string;
		summary?: string;
		demo?: boolean;
		model?: string;
	},
): BulkShow {
	const caps = defaultRowCaptions(opts.captionDefaults);
	const slides = clips.map((clip) =>
		bulkSlideFromVideoClip(clip, source, opts.template, caps, { topicHint: opts.topicHint }),
	);
	return {
		id: newId(),
		title: source.title || '',
		slides,
		activeSlideId: slides[0]!.id,
		fromVideoClips: true,
		clipSummary: opts.summary ?? '',
		videoDemo: opts.demo ?? false,
		videoModel: opts.model ?? '',
	};
}
