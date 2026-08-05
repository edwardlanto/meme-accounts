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

/** Stable key for duplicate detection across clips. */
export function newsHeadlineDedupeKey(headline: string | undefined | null): string {
	return normWords(String(headline ?? ''))
		.join(' ')
		.trim();
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

function isGenericSegmentTitle(title: string): boolean {
	return /^(segment|part|clip)\s*\d+$/i.test(cleanClipSpeechText(title).trim());
}

/**
 * True when the headline mostly restates the full video title
 * (common Gemini failure: same overlay for every clip).
 */
export function headlineEchoesVideoTitle(
	headline: string | undefined | null,
	videoTitle: string | undefined | null,
): boolean {
	const h = normWords(String(headline ?? ''));
	const v = normWords(String(videoTitle ?? ''));
	if (h.length < 4 || v.length < 4) return false;
	const vSet = new Set(v);
	const overlap = h.filter((w) => vSet.has(w)).length / h.length;
	if (overlap >= 0.62) return true;
	const hKey = h.join(' ');
	const vKey = v.join(' ');
	if (hKey === vKey) return true;
	if (vKey.startsWith(hKey) || hKey.startsWith(vKey.slice(0, Math.min(hKey.length, 48)))) return true;
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

/** Whether this clip still needs a per-moment news title. */
export function needsNewsHeadlineRewrite(
	headline: string | undefined | null,
	opts: {
		transcript?: string | null;
		videoTitle?: string | null;
		/** Other headlines already used in this batch (dedupe keys). */
		usedKeys?: Iterable<string>;
	} = {},
): boolean {
	const speech = opts.transcript;
	if (looksLikeRawSpeechHeadline(headline, speech)) return true;
	if (headlineEchoesVideoTitle(headline, opts.videoTitle)) return true;
	const key = newsHeadlineDedupeKey(headline);
	if (!key) return true;
	if (opts.usedKeys) {
		for (const u of opts.usedKeys) {
			if (u && u === key) return true;
		}
	}
	return false;
}

/** Pull a short topic phrase from spoken words (not a full quote dump). */
function topicFromSpeech(speech: string): string {
	const cleaned = cleanClipSpeechText(speech);
	const sentence = cleaned.split(/(?<=[.!?])\s+/)[0]?.trim() || cleaned;
	const stripped = sentence
		.replace(
			/^(okay|ok|so|well|and|but|now|like|yeah|uh|um|look|listen|alright|all right)[,.]?\s+/i,
			'',
		)
		.replace(/^(before i get into|let me|i want to|i'm going to|we're going to)\s+/i, '');
	const words = stripped
		.replace(/[.!?,;:]+$/g, '')
		.split(/\s+/)
		.filter((w) => w.length > 0 && !/^[\[\],.]+$/.test(w));
	if (words.length === 0) return '';
	return words.slice(0, Math.min(12, words.length)).join(' ');
}

function formatAllCapsNews(topic: string): string {
	const words = topic
		.toUpperCase()
		.replace(/[^\w\s$%'-]/g, ' ')
		.split(/\s+/)
		.filter(Boolean)
		.slice(0, 14);

	if (words.length === 0) return 'BREAKING UPDATE';
	if (words.length <= 3) return words.join(' ').slice(0, 140);

	const head = words.slice(0, Math.min(4, words.length)).join(' ');
	const rest = words.slice(Math.min(4, words.length)).join(' ');
	return (rest ? `[[${head}]] ${rest}` : `[[${head}]]`).slice(0, 140);
}

/**
 * Last-resort copy when every LLM path fails — prefer THIS clip's moment,
 * never stamp the full video title on every slide.
 */
export function demoNewsHeadlineFromClip(
	clip: Pick<VideoClip, 'title' | 'hook' | 'transcript'>,
	videoTitle?: string,
): string {
	const speech = cleanClipSpeechText(clip.transcript || clip.hook || '');
	const fromClip = cleanClipSpeechText(clip.title || '');
	const fromVideo = cleanClipSpeechText(videoTitle ?? '');

	let topic = '';
	if (
		fromClip.length >= 8 &&
		!looksLikeSpeechFragmentTitle(fromClip) &&
		!isGenericSegmentTitle(fromClip) &&
		!headlineEchoesVideoTitle(fromClip, fromVideo)
	) {
		topic = fromClip;
	} else if (speech.length >= 20) {
		topic = topicFromSpeech(speech);
	} else if (
		fromClip.length >= 8 &&
		!isGenericSegmentTitle(fromClip) &&
		!headlineEchoesVideoTitle(fromClip, fromVideo)
	) {
		topic = fromClip;
	} else if (fromVideo) {
		// Absolute last resort — only when this clip has no usable speech/title
		topic = fromVideo;
	} else {
		topic = 'BREAKING UPDATE';
	}

	return formatAllCapsNews(topic || 'BREAKING UPDATE');
}
