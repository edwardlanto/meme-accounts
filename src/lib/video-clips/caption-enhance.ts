import type { CaptionSegment } from './caption-sync';
import type { CaptionPhrase, CaptionWord } from './caption-chunking';

export type CaptionEnhanceOptions = {
	addEmojis: boolean;
	highlightKeywords: boolean;
	removeSilences: boolean;
	autoCensor: boolean;
};

export const DEFAULT_CAPTION_ENHANCE: CaptionEnhanceOptions = {
	addEmojis: true,
	highlightKeywords: false,
	removeSilences: false,
	autoCensor: false,
};

const STOPWORDS = new Set(
	`a an the and or but if in on at to for of is are was were be been being it this that these those i you he she we they my your his her our their me him them what which who whom whose with from by as into about over after before under again further then once here there when where why how all each few more most other some such no nor not only own same so than too very can will just don should now`.split(
		/\s+/,
	),
);

/** Mild / common swear list for consumer auto-censor (substring-safe word boundaries). */
const PROFANITY = [
	'fuck',
	'fucking',
	'fucked',
	'fucker',
	'shit',
	'shitty',
	'bullshit',
	'asshole',
	'bitch',
	'bastard',
	'dick',
	'piss',
	'crap',
	'damn',
	'dammit',
	'hell',
	'cunt',
	'cock',
	'pussy',
	'whore',
	'slut',
	'nigger',
	'nigga',
	'faggot',
	'fag',
	'retard',
	'retarded',
];

const EMOJI_MAP: Array<{ re: RegExp; emoji: string }> = [
	{ re: /\b(love|loved|loving|heart)\b/i, emoji: '❤️' },
	{ re: /\b(money|cash|rich|dollar|profit|revenue|million|billion)\b/i, emoji: '💰' },
	{ re: /\b(fire|lit|hot|blazing)\b/i, emoji: '🔥' },
	{ re: /\b(laugh|lol|funny|hilarious|joke)\b/i, emoji: '😂' },
	{ re: /\b(cry|tears|sad|upset)\b/i, emoji: '😢' },
	{ re: /\b(shock|shocked|wow|omg|unbelievable)\b/i, emoji: '😱' },
	{ re: /\b(win|winner|victory|champion|success)\b/i, emoji: '🏆' },
	{ re: /\b(idea|think|thought|brain)\b/i, emoji: '💡' },
	{ re: /\b(warn|warning|danger|careful|risk)\b/i, emoji: '⚠️' },
	{ re: /\b(time|clock|minute|hour|second|deadline)\b/i, emoji: '⏰' },
	{ re: /\b(phone|call|text|message)\b/i, emoji: '📱' },
	{ re: /\b(video|camera|film|movie|clip)\b/i, emoji: '🎬' },
	{ re: /\b(music|song|beat|rap)\b/i, emoji: '🎵' },
	{ re: /\b(food|eat|pizza|burger|coffee)\b/i, emoji: '🍔' },
	{ re: /\b(game|gaming|play|player)\b/i, emoji: '🎮' },
	{ re: /\b(rocket|launch|grow|growth|skyrocket)\b/i, emoji: '🚀' },
	{ re: /\b(star|famous|viral|trending)\b/i, emoji: '⭐' },
	{ re: /\b(fight|punch|hit|attack|violence)\b/i, emoji: '🥊' },
	{ re: /\b(yes|yeah|yep|agree)\b/i, emoji: '✅' },
	{ re: /\b(no|nope|never|stop)\b/i, emoji: '🚫' },
	{ re: /\b(question|why|how|what)\b/i, emoji: '❓' },
	{ re: /\b(100|percent|%|hundred)\b/i, emoji: '💯' },
];

function stripPunct(token: string): string {
	return token.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');
}

function censorWord(token: string): string {
	const core = stripPunct(token);
	if (!core) return token;
	const lower = core.toLowerCase();
	const hit = PROFANITY.find((p) => lower === p || lower.startsWith(p));
	if (!hit) return token;
	const stars = '*'.repeat(Math.max(3, core.length));
	return token.replace(core, stars);
}

function emojiForToken(token: string): string | null {
	const core = stripPunct(token);
	if (!core) return null;
	for (const { re, emoji } of EMOJI_MAP) {
		if (re.test(core)) return emoji;
	}
	return null;
}

export function isKeywordToken(token: string): boolean {
	const core = stripPunct(token);
	if (!core) return false;
	if (/^\d[\d,.%]*$/.test(core)) return true;
	if (core.length <= 2) return false;
	const lower = core.toLowerCase();
	if (STOPWORDS.has(lower)) return false;
	// Prefer longer content words and Title Case / ALL CAPS
	if (core[0] === core[0]?.toUpperCase() && /[a-z]/i.test(core)) return true;
	return core.length >= 5;
}

/** Transform a caption line for censor + emoji (keeps timing on the segment). */
export function enhanceCaptionText(
	text: string,
	opts: Pick<CaptionEnhanceOptions, 'addEmojis' | 'autoCensor'>,
): string {
	if (!text.trim()) return text;
	const tokens = text.split(/(\s+)/);
	const out: string[] = [];
	let emojisAdded = 0;
	for (const tok of tokens) {
		if (/^\s+$/.test(tok)) {
			out.push(tok);
			continue;
		}
		let next = tok;
		if (opts.autoCensor) next = censorWord(next);
		if (opts.addEmojis && emojisAdded < 2) {
			const emoji = emojiForToken(next);
			if (emoji && !next.includes(emoji)) {
				next = `${next} ${emoji}`;
				emojisAdded += 1;
			}
		}
		out.push(next);
	}
	return out.join('');
}

export function enhanceCaptionSegments(
	segments: CaptionSegment[],
	opts: CaptionEnhanceOptions,
): CaptionSegment[] {
	if (!opts.addEmojis && !opts.autoCensor) return segments;
	return segments.map((s) => ({
		...s,
		text: enhanceCaptionText(s.text, opts),
	}));
}

export function markKeywordWords(
	words: CaptionWord[],
	highlightKeywords: boolean,
): CaptionWord[] {
	if (!highlightKeywords) {
		return words.map((w) => ({ ...w, keyword: false }));
	}
	// Highlight up to ~40% of content words so captions stay readable
	const candidates = words
		.map((w, i) => ({ w, i, score: isKeywordToken(w.text) ? stripPunct(w.text).length : 0 }))
		.filter((x) => x.score > 0)
		.sort((a, b) => b.score - a.score);
	const maxKeep = Math.max(1, Math.ceil(words.length * 0.4));
	const keep = new Set(candidates.slice(0, maxKeep).map((c) => c.i));
	return words.map((w, i) => ({ ...w, keyword: keep.has(i) }));
}

export function enhancePhrases(
	phrases: CaptionPhrase[],
	opts: CaptionEnhanceOptions,
): CaptionPhrase[] {
	return phrases.map((p) => {
		const words = markKeywordWords(p.words, opts.highlightKeywords);
		return {
			...p,
			words,
			text: words.map((w) => w.text).join(' '),
		};
	});
}

export type SilenceGap = { startSec: number; endSec: number };

/** Gaps between spoken segments longer than `minGapSec` (inside clip bounds). */
export function findSilenceGaps(
	segments: CaptionSegment[],
	clipStart: number,
	clipEnd: number,
	minGapSec = 0.45,
): SilenceGap[] {
	const inRange = segments
		.filter((s) => (s.endSec ?? s.startSec + 0.4) > clipStart && s.startSec < clipEnd)
		.map((s) => ({
			startSec: Math.max(clipStart, s.startSec),
			endSec: Math.min(clipEnd, s.endSec ?? s.startSec + 0.4),
		}))
		.filter((s) => s.endSec > s.startSec + 0.05)
		.sort((a, b) => a.startSec - b.startSec);

	if (!inRange.length) return [];

	const gaps: SilenceGap[] = [];
	// Leading silence
	if (inRange[0]!.startSec - clipStart >= minGapSec) {
		gaps.push({ startSec: clipStart, endSec: inRange[0]!.startSec });
	}
	for (let i = 0; i < inRange.length - 1; i++) {
		const a = inRange[i]!;
		const b = inRange[i + 1]!;
		if (b.startSec - a.endSec >= minGapSec) {
			gaps.push({ startSec: a.endSec, endSec: b.startSec });
		}
	}
	// Trailing silence
	const last = inRange[inRange.length - 1]!;
	if (clipEnd - last.endSec >= minGapSec) {
		gaps.push({ startSec: last.endSec, endSec: clipEnd });
	}
	return gaps;
}

/** If playhead is inside a silence gap, return the time to jump to (gap end). */
export function silenceSkipTarget(
	currentTime: number,
	gaps: SilenceGap[],
	epsilon = 0.04,
): number | null {
	for (const g of gaps) {
		if (currentTime >= g.startSec - epsilon && currentTime < g.endSec - epsilon) {
			return g.endSec;
		}
	}
	return null;
}

/** Speech keep-windows for export (inverse of silence gaps). */
export function speechWindows(
	segments: CaptionSegment[],
	clipStart: number,
	clipEnd: number,
	minGapSec = 0.45,
): Array<{ startSec: number; endSec: number }> {
	const gaps = findSilenceGaps(segments, clipStart, clipEnd, minGapSec);
	if (!gaps.length) return [{ startSec: clipStart, endSec: clipEnd }];

	const windows: Array<{ startSec: number; endSec: number }> = [];
	let cursor = clipStart;
	for (const g of gaps) {
		if (g.startSec > cursor + 0.08) {
			windows.push({ startSec: cursor, endSec: g.startSec });
		}
		cursor = Math.max(cursor, g.endSec);
	}
	if (clipEnd > cursor + 0.08) {
		windows.push({ startSec: cursor, endSec: clipEnd });
	}
	return windows.length ? windows : [{ startSec: clipStart, endSec: clipEnd }];
}
