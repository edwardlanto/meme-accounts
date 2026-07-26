import type { VideoClip } from '$lib/video-clips/types';
import { cleanClipSpeechText } from '$lib/video-clips/transcript-segments';

const FILLER_RE =
	/\b(uh|um|uhh|umm|you know what|i mean|kind of|sort of|yeah i mean|those those|not really the like)\b/i;

const LAME_TEMPLATE_RE = /\bTHE CLIP THAT MAKES\b.*\bIMPOSSIBLE TO IGNORE\b/i;

/** Strip [[highlight]] markers for comparison / word counts. */
export function stripNewsHighlightMarkers(text: string): string {
	return text.replace(/\[\[([^\]]*)\]\]/g, '$1').replace(/\s+/g, ' ').trim();
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

/** True when the "headline" is basically dumped speech, not a news hook. */
export function looksLikeRawSpeechHeadline(
	headline: string | undefined | null,
	transcript?: string | null,
): boolean {
	const raw = String(headline ?? '').trim();
	if (!raw) return true;
	const plain = stripNewsHighlightMarkers(raw);
	if (plain.length < 16) return true;
	if (LAME_TEMPLATE_RE.test(plain)) return true;
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
 * Deterministic fallback when the LLM rewrite is unavailable.
 * Prefer the video title (who's / what's about) — never paste speech fragments.
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
				: 'THIS INTERVIEW';
	const words = topic
		.toUpperCase()
		.split(/\s+/)
		.filter(Boolean)
		.slice(0, 5)
		.join(' ');
	return `INSIDE [[${words}]] — THE MOMENT THAT [[STOPS THE SCROLL]]`.slice(0, 140);
}
