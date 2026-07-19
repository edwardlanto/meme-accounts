import {
	parseTranscriptLineRange,
	cleanClipSpeechText,
	collapseRepeatedPhrases,
} from './transcript-segments';

export type CaptionSegment = {
	startSec: number;
	/** Explicit end time when available (from SRT cue), else null (will be inferred). */
	endSec: number | null;
	text: string;
};

/**
 * Parse timed transcript (`[m:ss] text` or `[m:ss->m:ss.ms] text`) into segments.
 * Preserves explicit end times when present; otherwise leaves `endSec` null so the
 * chunker can infer from the next segment's start.
 */
export function parseTimedTranscriptToSegments(transcript: string): CaptionSegment[] {
	const segments: CaptionSegment[] = [];
	const lines = transcript.split('\n').filter((l) => l.trim());

	for (const line of lines) {
		const range = parseTranscriptLineRange(line);
		if (!range) continue;
		const rawText = line.replace(/^\[[^\]]+\]\s*/, '').trim();
		if (!rawText) continue;
		const clean = collapseRepeatedPhrases(rawText);
		if (!clean) continue;
		segments.push({
			startSec: range.startSec,
			endSec: range.endSec,
			text: clean,
		});
	}

	return segments;
}

/**
 * Get the current caption text based on video time (legacy helper).
 */
export function getCurrentCaptionText(
	segments: CaptionSegment[],
	currentTime: number,
	windowSec: number = 3,
): string {
	if (!segments.length) return '';

	for (let i = 0; i < segments.length; i++) {
		const seg = segments[i]!;
		const next = segments[i + 1];
		const endTime = seg.endSec ?? (next ? next.startSec : seg.startSec + windowSec);

		if (currentTime >= seg.startSec && currentTime < endTime) {
			return seg.text;
		}
	}

	return '';
}

/**
 * Parse non-timed transcript (just plain text) into rough segments
 * based on sentences distributed evenly across the clip.
 */
export function parseUntimedTranscriptToSegments(
	transcript: string,
	clipStartSec: number,
	clipDurationSec: number,
): CaptionSegment[] {
	const cleaned = cleanClipSpeechText(transcript);
	if (!cleaned) return [];

	const sentences = cleaned
		.split(/[.!?]+/)
		.map((s) => s.trim())
		.filter(Boolean);

	if (!sentences.length) return [];

	const segments: CaptionSegment[] = [];
	const timePerSegment = clipDurationSec / sentences.length;

	sentences.forEach((text, i) => {
		const startSec = clipStartSec + i * timePerSegment;
		segments.push({
			startSec,
			endSec: startSec + timePerSegment,
			text,
		});
	});

	return segments;
}
