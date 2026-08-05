import type { VideoClip } from '$lib/video-clips/types';
import { cleanClipSpeechText } from '$lib/video-clips/transcript-segments';

const FILLER_RE =
	/\b(uh|um|uhh|umm|you know what|i mean|kind of|sort of|yeah i mean|those those|not really the like)\b/i;

/** Hard-banned canned hooks — never treat these as finished AI titles. */
const LAME_TEMPLATE_RE =
	/\b(STOPS THE SCROLL|SKIP THE SCROLL|DON'?T SKIP|IMPOSSIBLE TO IGNORE|THE CLIP THAT MAKES|MOMENT THAT STOPS)\b/i;

/** Strip [[highlight]] markers for comparison / word counts / editor fields. */
export function stripNewsHighlightMarkers(text: string): string {
	let t = String(text ?? '').replace(/\[\[([^\]]*)\]\]/g, '$1');
	t = t.replace(/\[\[/g, '').replace(/\]\]/g, '');
	return t.replace(/\s+/g, ' ').trim();
}

/** Plain headline for bulk editor inputs — no markers, light possessive fix. */
export function newsHeadlineForEditor(headline: string | undefined | null): string {
	let t = stripNewsHighlightMarkers(headline);
	// e.g. "KOHLBERGER S REVERSAL" → "KOHLBERGER'S REVERSAL" after marker strip
	t = t.replace(/\b([A-Za-z]{3,})\s+S\s+([A-Z])/g, "$1'S $2");
	return t.trim();
}

function wordCount(text: string): number {
	return stripNewsHighlightMarkers(text).split(/\s+/).filter(Boolean).length;
}

function normWords(text: string): string[] {
	return cleanClipSpeechText(stripNewsHighlightMarkers(text))
		.toLowerCase()
		.replace(/[^a-z0-9\s]/g, ' ')
		.split(/\s+/)
		.filter((w) => w.length > 2);
}

function looksLikeSpeechFragmentTitle(title: string): boolean {
	const t = cleanClipSpeechText(title);
	if (!t) return true;
	if (FILLER_RE.test(t)) return true;
	if (/^(segment|part|clip)\s*\d+$/i.test(t)) return true;
	// Mid-sentence speech starts
	if (/^(i |i'm |you |we |they |and |but |so |well )/i.test(t)) return true;
	return false;
}

/** True when the "headline" is raw speech, empty, or a banned canned template. */
export function looksLikeRawSpeechHeadline(
	headline: string | undefined | null,
	transcript?: string | null,
): boolean {
	const raw = String(headline ?? '').trim();
	if (!raw) return true;
	const plain = stripNewsHighlightMarkers(raw);
	if (plain.length < 16) return true;
	if (LAME_TEMPLATE_RE.test(plain)) return true;
	if (/^INSIDE\s+\[\[/i.test(raw) && /\bTHE MOMENT THAT\b/i.test(plain)) return true;
	if (FILLER_RE.test(plain)) return true;
	const words = wordCount(plain);
	if (words > 32) return true;
	if (words < 6) return true;
	if (/\b(the|a|an|to|of|and|or|but|in|for)\s*$/i.test(plain)) return true;
	if (/\b(t|th|w|yo)\s*$/i.test(plain) && plain.length > 40) return true;

	const speech = String(transcript ?? '').trim();
	if (speech.length >= 24) {
		const h = normWords(plain);
		const t = new Set(normWords(speech));
		if (h.length >= 8) {
			const overlap = h.filter((w) => t.has(w)).length / h.length;
			if (overlap >= 0.72) return true;
		}
		const speechStart = cleanClipSpeechText(speech).slice(0, 48).toLowerCase();
		const headStart = cleanClipSpeechText(plain).slice(0, 48).toLowerCase();
		if (speechStart.length >= 20 && headStart.startsWith(speechStart.slice(0, 20))) return true;
	}
	return false;
}

/**
 * Last-resort copy when every LLM path fails — just the video/clip title, never a viral slogan.
 */
export function demoNewsHeadlineFromClip(
	clip: Pick<VideoClip, 'title' | 'hook' | 'transcript'>,
	videoTitle?: string,
): string {
	const fromVideo = cleanClipSpeechText(videoTitle ?? '');
	const fromClip = cleanClipSpeechText(clip.title || '');
	const topic =
		fromVideo && !looksLikeSpeechFragmentTitle(fromVideo)
			? fromVideo
			: fromClip && !looksLikeSpeechFragmentTitle(fromClip)
				? fromClip
				: cleanClipSpeechText(clip.hook || '').slice(0, 80) || 'BREAKING UPDATE';

	const words = topic
		.toUpperCase()
		.replace(/[^\w\s$%'-]/g, ' ')
		.split(/\s+/)
		.filter(Boolean)
		.slice(0, 14);

	if (words.length <= 3) {
		return words.join(' ').slice(0, 140);
	}
	// Light highlight on the first meaningful chunk — still unique per video, no slogan
	const head = words.slice(0, Math.min(4, words.length)).join(' ');
	const rest = words.slice(Math.min(4, words.length)).join(' ');
	return (rest ? `[[${head}]] ${rest}` : `[[${head}]]`).slice(0, 140);
}
