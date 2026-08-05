import type { VideoClip } from '$lib/video-clips/types';
import { cleanClipSpeechText } from '$lib/video-clips/transcript-segments';

const FILLER_RE =
	/\b(uh|um|uhh|umm|you know what|i mean|kind of|sort of|yeah i mean|those those|not really the like)\b/i;

/** Hard-banned canned hooks — never treat these as finished AI titles. */
const LAME_TEMPLATE_RE =
	/\b(STOPS THE SCROLL|SKIP THE SCROLL|DON'?T SKIP|IMPOSSIBLE TO IGNORE|THE CLIP THAT MAKES|MOMENT THAT STOPS)\b/i;

/**
 * Headline must not end on these — classic mid-sentence cutoffs
 * ("…GET INTO MY", "…WHICH IS", "…BEFORE THE").
 */
const DANGLING_END_RE =
	/\b(the|a|an|to|of|and|or|but|nor|in|for|my|your|his|her|their|our|its|is|are|was|were|be|been|being|am|have|has|had|will|would|can|could|should|may|might|must|with|from|as|at|by|on|into|onto|upon|about|before|after|during|while|until|than|then|if|so|just|very|really|like|okay|ok|which|that|who|whom|whose|what|when|where|how|why|this|these|those|not|no|do|does|did|don'?t|doesn'?t|didn'?t|won'?t|can'?t|i|i'?m|i'?ve|i'?ll|i'?d|we|we'?re|we'?ve|gonna|wanna|gotta|get|got|go|going|true|new|big|real|full|same|next|last|first|only|other|own|few|many|much|more|most|such)\s*[.!?…]*\s*$/i;

/** First-person / spoken openers — news titles should be third-person. */
const FIRST_PERSON_START_RE =
	/^(i|i'?m|i'?ve|i'?ll|i'?d|we|we'?re|we'?ve|okay|ok|so|well|and|but|now|yeah|uh|um|look|listen|alright|all right|before i|let me|you know|hey)\b/i;

/**
 * Mid-clause / fragment openers — "TO ALULOSE…", "WHICH IS…", "THANKS TO…"
 * are transcript slices, not news chyrons.
 */
const MID_CLAUSE_START_RE =
	/^(to|of|and|or|but|for|with|from|as|at|by|on|into|about|before|after|which|that|who|when|where|how|why|than|then|if|so|just|thanks|thank|because|since|while|during|until|unless|though|although|whether|like|true|this|these|those|is|are|was|were|am|be|been|being|have|has|had|the|a|an|my|your|his|her|their)\b/i;

/** Strip [[highlight]] markers for comparison / word counts / editor fields. */
export function stripNewsHighlightMarkers(text: string | undefined | null): string {
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

function lastWord(text: string): string {
	const parts = stripNewsHighlightMarkers(text).split(/\s+/).filter(Boolean);
	return parts[parts.length - 1] ?? '';
}

/** Content words (len > 2) for soft matching / dedupe. */
function normWords(text: string): string[] {
	return cleanClipSpeechText(stripNewsHighlightMarkers(text))
		.toLowerCase()
		.replace(/[^a-z0-9\s']/g, ' ')
		.split(/\s+/)
		.filter((w) => w.length > 2);
}

/** Every token including short words — for contiguous speech-slice detection. */
function allTokens(text: string): string[] {
	return cleanClipSpeechText(stripNewsHighlightMarkers(text))
		.toLowerCase()
		.replace(/[^a-z0-9\s']/g, ' ')
		.split(/\s+/)
		.filter(Boolean);
}

/** Stable key for duplicate detection across clips. */
export function newsHeadlineDedupeKey(headline: string | undefined | null): string {
	return normWords(String(headline ?? ''))
		.join(' ')
		.trim();
}

/**
 * True when the headline is a contiguous word slice of the transcript
 * (e.g. "TO ALULOSE WHICH IS A TRUE" ⊂ "…thanks to Alulose, which is a true sugar").
 */
export function headlineIsTranscriptSlice(
	headline: string | undefined | null,
	transcript?: string | null,
): boolean {
	const speech = String(transcript ?? '').trim();
	if (speech.length < 12) return false;
	const h = allTokens(String(headline ?? ''));
	const t = allTokens(speech);
	if (h.length < 3 || t.length < h.length) return false;

	const hJoined = h.join(' ');
	const tJoined = t.join(' ');
	if (tJoined.includes(hJoined)) return true;

	// Sliding window exact match (handles punctuation already stripped)
	for (let i = 0; i <= t.length - h.length; i++) {
		let ok = true;
		for (let j = 0; j < h.length; j++) {
			if (t[i + j] !== h[j]) {
				ok = false;
				break;
			}
		}
		if (ok) return true;
	}
	return false;
}

function looksLikeSpeechFragmentTitle(title: string): boolean {
	const t = cleanClipSpeechText(title);
	if (!t) return true;
	if (FILLER_RE.test(t)) return true;
	if (/^(segment|part|clip)\s*\d+$/i.test(t)) return true;
	if (FIRST_PERSON_START_RE.test(t)) return true;
	if (MID_CLAUSE_START_RE.test(t)) return true;
	if (DANGLING_END_RE.test(t)) return true;
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

/** Ends mid-thought: function word, preposition, auxiliary, weak adjective, etc. */
export function headlineEndsIncomplete(headline: string | undefined | null): boolean {
	const plain = stripNewsHighlightMarkers(headline);
	if (!plain) return true;
	if (DANGLING_END_RE.test(plain)) return true;
	// Trailing hyphen / em-dash / ellipsis without a following word
	if (/[-–—:]\s*$/.test(plain)) return true;
	if (/\.{2,}\s*$/.test(plain) || /…\s*$/.test(plain)) return true;
	// Unclosed highlight marker
	if (/\[\[[^\]]*$/.test(String(headline ?? ''))) return true;
	// Single dangling letter / stump ("T", "TH", "YO")
	const lw = lastWord(plain);
	if (lw.length <= 2 && !/^\d+$/.test(lw) && plain.length > 24) return true;
	return false;
}

/** True when the "headline" is raw speech, empty, incomplete, or a banned template. */
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
	if (FIRST_PERSON_START_RE.test(plain)) return true;
	if (MID_CLAUSE_START_RE.test(plain)) return true;
	if (headlineEndsIncomplete(plain)) return true;

	const words = wordCount(plain);
	// News chyrons are 12–28 words; under 8 is almost always a truncated speech slice
	if (words > 32) return true;
	if (words < 8) return true;

	const speech = String(transcript ?? '').trim();
	if (speech.length >= 12) {
		if (headlineIsTranscriptSlice(plain, speech)) return true;

		const h = normWords(plain);
		const tWords = normWords(speech);
		const t = new Set(tWords);
		if (h.length >= 3) {
			const overlap = h.filter((w) => t.has(w)).length / h.length;
			// Pasted/lightly-edited speech usually shares most content words
			if (overlap >= 0.5) return true;
		}
		const speechStart = cleanClipSpeechText(speech).slice(0, 48).toLowerCase();
		const headStart = cleanClipSpeechText(plain).slice(0, 48).toLowerCase();
		if (speechStart.length >= 16 && headStart.startsWith(speechStart.slice(0, 16))) return true;
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

/**
 * Clamp a finished headline without introducing mid-sentence cuts.
 * If a hard length cap would leave a dangling function word, keep the full string.
 */
export function clampNewsHeadline(text: string, max = 160): string {
	const t = String(text ?? '').trim();
	if (!t || t.length <= max) return t;
	const cut = t.slice(0, max).replace(/\s+\S*$/, '').trim();
	if (cut.length >= 40 && !looksLikeRawSpeechHeadline(cut)) return cut;
	return t;
}

function formatCompleteNewsFromLabel(label: string): string {
	const words = label
		.toUpperCase()
		.replace(/[^\w\s$%'-]/g, ' ')
		.split(/\s+/)
		.filter(Boolean)
		.slice(0, 8);

	if (words.length === 0) {
		return '[[THIS CLIP]] CAPTURES A KEY MOMENT FROM THE CONVERSATION';
	}

	const head = words.slice(0, Math.min(3, words.length)).join(' ');
	// Always a finished third-person sentence — never return a sliced topic alone
	return `[[${head}]] GETS A CLOSER LOOK IN THIS FEATURED CLIP`;
}

/**
 * Last-resort copy when every LLM path fails.
 * Always a complete third-person line — never word-truncated transcript speech.
 */
export function demoNewsHeadlineFromClip(
	clip: Pick<VideoClip, 'title' | 'hook' | 'transcript'>,
	videoTitle?: string,
): string {
	const fromVideo = cleanClipSpeechText(videoTitle ?? '');
	const speech = cleanClipSpeechText(clip.transcript || clip.hook || '');

	// Prefer video title as a topic anchor — never clip.title (often titleFromExcerpt speech)
	if (
		fromVideo.length >= 8 &&
		!looksLikeSpeechFragmentTitle(fromVideo) &&
		!headlineIsTranscriptSlice(fromVideo, speech)
	) {
		return formatCompleteNewsFromLabel(fromVideo);
	}

	return '[[THIS CLIP]] CAPTURES A KEY MOMENT FROM THE FULL CONVERSATION';
}
