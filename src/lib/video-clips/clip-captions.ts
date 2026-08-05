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
		enabled: true,
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

/** One-line caption preview for the editor body field. */
export function captionPreviewText(segments: CaptionSegment[]): string {
	const text = segments
		.map((s) => cleanClipSpeechText(s.text))
		.filter(Boolean)
		.slice(0, 3)
		.join(' ');
	return text.slice(0, 280);
}
