import type { CaptionSegment } from './caption-sync';

export type CaptionWord = {
	text: string;
	startSec: number;
	endSec: number;
};

export type CaptionPhrase = {
	words: CaptionWord[];
	startSec: number;
	endSec: number;
	text: string;
};

/**
 * Approximate the spoken duration of a word based on its length.
 * Short words like "a", "the" are faster than long ones like "appearance".
 * Uses a floor + per-character contribution so single-letter words aren't zero.
 */
function wordWeight(word: string): number {
	const chars = word.replace(/[^\p{L}\p{N}]/gu, '').length || 1;
	return 0.6 + chars * 0.6;
}

/**
 * Split a segment's text into words with per-word timing weighted by
 * character count (long words hold longer than short ones).
 */
function segmentToWords(
	text: string,
	startSec: number,
	endSec: number,
): CaptionWord[] {
	const tokens = text
		.split(/\s+/)
		.filter(Boolean)
		// Drop punctuation-only tokens (>>, …, ---) — not spoken words
		.filter((t) => /[\p{L}\p{N}]/u.test(t));
	if (!tokens.length) return [];

	const total = Math.max(0.3, endSec - startSec);
	const weights = tokens.map(wordWeight);
	const weightSum = weights.reduce((a, b) => a + b, 0);

	const words: CaptionWord[] = [];
	let cursor = startSec;
	for (let i = 0; i < tokens.length; i++) {
		const dur = (weights[i]! / weightSum) * total;
		const wStart = cursor;
		const wEnd = i === tokens.length - 1 ? endSec : cursor + dur;
		words.push({ text: tokens[i]!, startSec: wStart, endSec: wEnd });
		cursor = wEnd;
	}
	return words;
}

/**
 * Get end time for a segment. Prefers the segment's explicit endSec (from SRT),
 * falls back to next segment start, then to per-word estimate.
 */
function inferSegmentEnd(segments: CaptionSegment[], index: number): number {
	const cur = segments[index]!;
	if (cur.endSec != null && cur.endSec > cur.startSec) {
		const next = segments[index + 1];
		if (next && next.startSec >= cur.startSec) {
			return Math.min(cur.endSec, next.startSec);
		}
		return cur.endSec;
	}
	const next = segments[index + 1];
	if (next && next.startSec > cur.startSec) return next.startSec;
	const words = cur.text.split(/\s+/).filter(Boolean).length;
	return cur.startSec + Math.max(1, words * 0.35);
}

/**
 * Convert segments to a flat word list with distributed timing.
 * When Whisper already emitted one word per cue (word-level SRT), we keep those
 * exact start/end times instead of re-guessing by character length.
 */
export function segmentsToWords(segments: CaptionSegment[]): CaptionWord[] {
	if (!segments.length) return [];

	const singleWordCount = segments.filter(
		(s) => s.text.split(/\s+/).filter(Boolean).length === 1,
	).length;
	const mostlyWordLevel = singleWordCount / segments.length >= 0.6;

	if (mostlyWordLevel) {
		const words: CaptionWord[] = [];
		for (let i = 0; i < segments.length; i++) {
			const seg = segments[i]!;
			const token = seg.text.split(/\s+/).filter(Boolean)[0];
			if (!token || !/[\p{L}\p{N}]/u.test(token)) continue;
			const end = inferSegmentEnd(segments, i);
			words.push({
				text: token,
				startSec: seg.startSec,
				endSec: Math.max(seg.startSec + 0.05, end),
			});
		}
		return words;
	}

	const words: CaptionWord[] = [];
	for (let i = 0; i < segments.length; i++) {
		const seg = segments[i]!;
		const end = inferSegmentEnd(segments, i);
		words.push(...segmentToWords(seg.text, seg.startSec, end));
	}
	return words;
}

/**
 * Chunk words into phrases of N words each (CapCut-style short bursts).
 * wordsPerChunk: 1..8. Use 0 to keep original segments as-is.
 */
export function chunkWordsToPhrases(
	words: CaptionWord[],
	wordsPerChunk: number,
): CaptionPhrase[] {
	if (!words.length) return [];
	const size = Math.max(1, Math.min(8, Math.floor(wordsPerChunk) || 3));
	const phrases: CaptionPhrase[] = [];

	for (let i = 0; i < words.length; i += size) {
		const group = words.slice(i, i + size);
		if (!group.length) continue;
		phrases.push({
			words: group,
			startSec: group[0]!.startSec,
			endSec: group[group.length - 1]!.endSec,
			text: group.map((w) => w.text).join(' '),
		});
	}

	return phrases;
}

/**
 * Build phrases directly from segments given a target words-per-chunk.
 * If wordsPerChunk <= 0, converts each segment to a single phrase.
 */
export function segmentsToPhrases(
	segments: CaptionSegment[],
	wordsPerChunk: number,
): CaptionPhrase[] {
	if (wordsPerChunk <= 0) {
		const phrases: CaptionPhrase[] = [];
		for (let i = 0; i < segments.length; i++) {
			const seg = segments[i]!;
			const end = inferSegmentEnd(segments, i);
			const words = segmentToWords(seg.text, seg.startSec, end);
			if (!words.length) continue;
			phrases.push({
				words,
				startSec: seg.startSec,
				endSec: end,
				text: seg.text,
			});
		}
		return phrases;
	}

	const words = segmentsToWords(segments);
	return chunkWordsToPhrases(words, wordsPerChunk);
}

/**
 * Find the active phrase at a given time. Binary search for snappy karaoke.
 */
export function getActivePhrase(
	phrases: CaptionPhrase[],
	currentTime: number,
	holdSec: number = 0.12,
): CaptionPhrase | null {
	if (!phrases.length) return null;

	let lo = 0;
	let hi = phrases.length - 1;
	while (lo <= hi) {
		const mid = (lo + hi) >> 1;
		const p = phrases[mid]!;
		const next = phrases[mid + 1];
		const displayEnd = next ? next.startSec : p.endSec + holdSec;
		if (currentTime < p.startSec) {
			hi = mid - 1;
		} else if (currentTime >= displayEnd) {
			lo = mid + 1;
		} else {
			return p;
		}
	}
	return null;
}

/**
 * Find the index of the currently-spoken word within a phrase.
 * Sticky: once a word starts, stay on it until the next word starts (no flicker in gaps).
 */
export function getActiveWordIndex(
	phrase: CaptionPhrase,
	currentTime: number,
): number {
	if (!phrase.words.length) return -1;
	if (currentTime < phrase.words[0]!.startSec) return -1;
	let active = 0;
	for (let i = 0; i < phrase.words.length; i++) {
		if (currentTime >= phrase.words[i]!.startSec) active = i;
		else break;
	}
	return active;
}

/**
 * De-duplicate accidental repeats from whisper hallucinations at the
 * segment level (e.g. "he said that he said that he said...").
 */
export function dedupeAdjacentSegments(segments: CaptionSegment[]): CaptionSegment[] {
	if (segments.length < 2) return segments;
	const out: CaptionSegment[] = [];
	let prevText = '';
	for (const s of segments) {
		const norm = s.text.trim().toLowerCase();
		if (norm && norm === prevText) continue;
		out.push(s);
		prevText = norm;
	}
	return out;
}
