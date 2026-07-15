import type { VideoClip, VideoImportMeta } from '$lib/video-clips/types';
import { cleanClipSpeechText, collapseRepeatedPhrases } from '$lib/video-clips/transcript-segments';

export type ClipNarrative = {
	headline: string;
	hook: string;
	sentences: string[];
};

function normSentence(s: string): string {
	return s
		.toLowerCase()
		.replace(/[^\w\s']/g, '')
		.replace(/\s+/g, ' ')
		.trim();
}

export function splitSpeechSentences(text: string): string[] {
	const cleaned = collapseRepeatedPhrases(text);
	if (!cleaned) return [];

	const parts = cleaned
		.split(/(?<=[.!?])\s+/)
		.map((s) => s.trim())
		.filter(Boolean);

	if (parts.length > 1) return parts;

	// Long caption blobs without punctuation — split on "?" when it's a Q&A clip
	if (cleaned.includes('?')) {
		return cleaned
			.split(/\?\s+/)
			.map((s, i, arr) => (i < arr.length - 1 ? `${s.trim()}?` : s.trim()))
			.filter((s) => s.length >= 12);
	}

	return parts.length ? parts : [cleaned];
}

function isNearDuplicateSentence(a: string, b: string): boolean {
	const na = normSentence(a);
	const nb = normSentence(b);
	if (!na || !nb) return false;
	if (na === nb) return true;
	const shorter = na.length <= nb.length ? na : nb;
	const longer = na.length > nb.length ? na : nb;
	if (longer.includes(shorter) && shorter.length / longer.length > 0.72) return true;
	return false;
}

/** Keep first occurrence of each unique thought. */
export function dedupeSentences(sentences: string[], minLen = 12): string[] {
	const out: string[] = [];
	for (const raw of sentences) {
		const s = cleanClipSpeechText(raw);
		if (s.length < minLen) continue;
		if (out.some((prev) => isNearDuplicateSentence(prev, s))) continue;
		out.push(s);
	}
	return out;
}

function wordsHeadline(text: string, maxWords = 8): string {
	const words = collapseRepeatedPhrases(text)
		.replace(/[.!?,;:]+$/, '')
		.split(/\s+/)
		.filter(Boolean);
	if (!words.length) return '';
	return words.slice(0, maxWords).join(' ');
}

function clipRawSpeech(clip: VideoClip, source?: VideoImportMeta): string {
	return cleanClipSpeechText(
		clip.transcript?.trim() || clip.hook?.trim() || clip.title?.trim() || source?.title?.trim() || '',
	);
}

function bestHook(text: string): string {
	const cleaned = collapseRepeatedPhrases(text);
	if (!cleaned) return '';

	const sentences = cleaned
		.split(/(?<=[.!?])\s+/)
		.map((s) => s.trim())
		.filter((s) => s.length >= 12);
	if (sentences[0]) return sentences[0];

	if (cleaned.includes('?')) {
		const q = cleaned.split('?')[0]?.trim();
		if (q && q.length >= 12) return `${q}?`;
	}

	return wordsHeadline(cleaned, 14) || cleaned.slice(0, 180);
}

/** Clean, deduped speech lines suitable for social templates. */
export function clipNarrative(clip: VideoClip, source?: VideoImportMeta): ClipNarrative {
	const raw = clipRawSpeech(clip, source);
	const sentences = dedupeSentences(splitSpeechSentences(raw), 10);

	const title = cleanClipSpeechText(clip.title);
	const titleWords = title.split(/\s+/).filter(Boolean).length;
	const titleOk = title.length >= 8 && titleWords >= 2 && titleWords <= 12;

	const hook = sentences[0] ? bestHook(sentences[0]) : bestHook(raw);
	const headline = titleOk ? title : wordsHeadline(hook, 8) || title || 'Clip highlight';

	return {
		headline,
		hook,
		sentences: sentences.length ? sentences.map((s) => bestHook(s)).filter(Boolean) : hook ? [hook] : [],
	};
}
