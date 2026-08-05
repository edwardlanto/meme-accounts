import type { VideoClip, VideoImportMeta } from '$lib/video-clips/types';
import type { CaptionSegment } from '$lib/video-clips/caption-sync';
import {
	parseTimedTranscriptToSegments,
	parseUntimedTranscriptToSegments,
} from '$lib/video-clips/caption-sync';
import {
	excerptTimedLinesFromTranscript,
	hasTimedTranscript,
	cleanClipSpeechText,
} from '$lib/video-clips/transcript-segments';
import { dedupeAdjacentSegments } from '$lib/video-clips/caption-chunking';
import type { StudioClipCaptionImport } from '$lib/studio/clip-import';
import type { BulkRowCaptions } from '$lib/studio/bulk-to-studio';
import { shiftCaptionImportTimes } from '$lib/video-clips/clip-template-copy';

/** Build timed caption cues for a clip segment from the source transcript. */
export function buildCaptionSegmentsForClip(
	clip: VideoClip,
	source?: VideoImportMeta | null,
): CaptionSegment[] {
	let segments: CaptionSegment[] = [];
	const full = source?.transcript;
	if (full && hasTimedTranscript(full)) {
		const excerpt = excerptTimedLinesFromTranscript(full, clip.startSec, clip.endSec);
		if (excerpt.trim()) {
			segments = dedupeAdjacentSegments(parseTimedTranscriptToSegments(excerpt));
		}
	}
	if (!segments.length && clip.transcript) {
		if (hasTimedTranscript(clip.transcript)) {
			segments = dedupeAdjacentSegments(parseTimedTranscriptToSegments(clip.transcript));
		} else {
			const duration = Math.max(0.5, clip.endSec - clip.startSec);
			segments = dedupeAdjacentSegments(
				parseUntimedTranscriptToSegments(clip.transcript, clip.startSec, duration),
			);
		}
	}
	return segments;
}

export function studioCaptionImportForClip(
	segments: CaptionSegment[],
	caps: BulkRowCaptions,
): StudioClipCaptionImport | null {
	if (!segments.length) return null;
	return {
		enabled: caps.enabled !== false,
		segments,
		templateId: caps.templateId,
		fontSize: caps.fontSize,
		position: caps.position,
		customColor: caps.color,
		customBgColor: 'transparent',
		customHighlightColor: '#ffeb3b',
		selectedFont: 'Inter',
		strokeEnabled: true,
		animationOverride: null,
		wordsPerChunk: null,
		customX: null,
		customY: null,
	};
}

/** Merge latest Bulk caption styles onto a stored import (or rebuild from segments). */
export function resolveStudioCaptionImportForSlide(slide: {
	captions: BulkRowCaptions;
	captionSegments?: CaptionSegment[] | null;
	studioCaptionImport?: StudioClipCaptionImport | null;
	reframedPlaybackUrl?: string | null;
	sourceClipStart?: number | null;
}): StudioClipCaptionImport | null {
	if (!slide.captions?.enabled) return null;
	let base =
		slide.studioCaptionImport && slide.studioCaptionImport.segments?.length
			? slide.studioCaptionImport
			: slide.captionSegments?.length
				? studioCaptionImportForClip(slide.captionSegments, slide.captions)
				: null;
	if (!base?.segments?.length) return null;
	const merged: StudioClipCaptionImport = {
		...base,
		enabled: true,
		templateId: slide.captions.templateId || base.templateId,
		fontSize: slide.captions.fontSize ?? base.fontSize,
		position: slide.captions.position || base.position,
		customColor: slide.captions.color || base.customColor,
	};
	const offset =
		String(slide.reframedPlaybackUrl ?? '').trim()
			? Math.max(0, Number(slide.sourceClipStart) || 0)
			: 0;
	return shiftCaptionImportTimes(merged, offset);
}

/** One-line caption preview for the editor body field. */
export function captionPreviewText(segments: CaptionSegment[]): string {
	const text = segments
		.map((s) => cleanClipSpeechText(s.text))
		.filter(Boolean)
		.slice(0, 3)
		.join(' ');
	return text.slice(0, 280);
}
