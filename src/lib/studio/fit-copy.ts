/**
 * Fit overlay/body copy to a budget without ellipsis or mid-word / mid-sentence cuts.
 * Prefer complete sentences; expand slightly over budget to finish a thought when needed.
 */

const SENTENCE_END_RE = /[.!?]["')\]]*$/;

/** Titles / list markers that look like sentence ends but are not. */
const ABBREV_BEFORE_DOT_RE =
	/\b(?:Mr|Mrs|Ms|Dr|Prof|Sr|Jr|vs|etc|approx|est|dept|No|Nos|vol|fig|eds?|eg|ie|US|UK|U\.S|U\.K)$/i;

function normalizeCopy(text: string): string {
	return String(text ?? '')
		.replace(/\u2026/g, '')
		.replace(/\.\.\./g, '')
		.replace(/\s+/g, ' ')
		.trim();
}

function wordCount(text: string): number {
	return normalizeCopy(text).split(/\s+/).filter(Boolean).length;
}

/**
 * True when `.` / `!` / `?` at index `i` is a real sentence terminator
 * (not a decimal, abbreviation, or numbered-list marker like `1.`).
 */
function isSentenceTerminatorAt(s: string, i: number): boolean {
	const ch = s[i]!;
	if (ch !== '.' && ch !== '!' && ch !== '?') return false;
	const next = s[i + 1];
	/* Decimal: 95.6 */
	if (ch === '.' && /\d/.test(s[i - 1] ?? '') && /\d/.test(next ?? '')) return false;
	if (next != null && !/\s/.test(next) && !/["')\]]/.test(next)) return false;

	const before = s.slice(0, i).trimEnd();
	/* Numbered list marker: "1." / "12." before more prose */
	if (ch === '.' && /(?:^|\s)\d+$/.test(before)) {
		const rest = s.slice(i + 1);
		if (/\S/.test(rest)) return false;
	}
	/* Common abbreviations / initials */
	if (ch === '.' && ABBREV_BEFORE_DOT_RE.test(before)) return false;
	if (ch === '.' && /(?:^|\s)[A-Za-z]$/.test(before) && /\s?[A-Z]/.test(s.slice(i + 1, i + 4))) {
		return false;
	}
	return true;
}

function terminatorEndIndex(s: string, i: number): number {
	let end = i;
	while (end + 1 < s.length && /["')\]]/.test(s[end + 1]!)) end++;
	return end;
}

function lastSentenceEndIndex(s: string): number {
	let best = -1;
	for (let i = 0; i < s.length; i++) {
		if (!isSentenceTerminatorAt(s, i)) continue;
		best = terminatorEndIndex(s, i);
	}
	return best;
}

function firstSentenceEndIndex(s: string): number {
	for (let i = 0; i < s.length; i++) {
		if (!isSentenceTerminatorAt(s, i)) continue;
		return terminatorEndIndex(s, i);
	}
	return -1;
}

function endsWithSentence(s: string): boolean {
	const t = s.trim();
	if (!SENTENCE_END_RE.test(t)) return false;
	/* Trailing period after a bare number is usually a truncated fact ("… share 95."). */
	if (/\b\d+\.$/.test(t) && wordCount(t) < 10) return false;
	return true;
}

/** Drop dangling connectors so we never leave "… a slow rise that". */
function trimDanglingTail(text: string): string {
	const dangling =
		/^(that|which|who|whom|whose|and|or|but|a|an|the|to|of|for|with|from|into|onto|upon|as|if|when|while|than|come|comes|coming|is|are|was|were|be|been|being|its|it's|their|our|your|my)$/i;
	let words = text.split(/\s+/).filter(Boolean);
	while (words.length > 3 && dangling.test(words[words.length - 1]!)) {
		words = words.slice(0, -1);
	}
	return words.join(' ').replace(/[,:;]+$/g, '').trim();
}

/**
 * Stub / truncated overlay lines that should not ship under a headline
 * (e.g. "Domestic cats share 95.").
 */
export function isIncompleteOverlayCopy(text: string, minWords = 8): boolean {
	const t = normalizeCopy(text);
	if (!t) return true;
	const words = wordCount(t);
	if (words < minWords) return true;
	if (/^\d+\.$/.test(t)) return true;
	/* Ends on a bare number — almost always a cut fact ("share 95." / "in 2020."). */
	if (/\b\d+\.$/.test(t) && words < 14) return true;
	if (/\b(?:approx|about|nearly|over|under|around)\s+\d+\.$/i.test(t)) return true;
	return false;
}

/** Ultra-short / broken fragments to merge while splitting (not merely punchy short sentences). */
function isWeakSentenceFragment(text: string): boolean {
	const t = normalizeCopy(text);
	if (!t) return true;
	if (/^\d+\.$/.test(t)) return true;
	if (wordCount(t) <= 2) return true;
	if (/\b\d+\.$/.test(t) && wordCount(t) < 8) return true;
	return false;
}

/**
 * Split on real sentence boundaries; merge weak fragments (list markers, stubs)
 * into the following sentence so News paragraphs stay readable.
 */
export function splitIntoSentences(text: string): string[] {
	const plain = normalizeCopy(text);
	if (!plain) return [];

	const ends: number[] = [];
	for (let i = 0; i < plain.length; i++) {
		if (isSentenceTerminatorAt(plain, i)) ends.push(terminatorEndIndex(plain, i));
	}

	const raw: string[] = [];
	let start = 0;
	for (const end of ends) {
		const chunk = plain.slice(start, end + 1).trim();
		if (chunk) raw.push(chunk);
		start = end + 1;
	}
	const tail = plain.slice(start).trim();
	if (tail) raw.push(tail);
	if (!raw.length) return [plain];

	const out: string[] = [];
	for (const s of raw) {
		if (out.length && isWeakSentenceFragment(out[out.length - 1]!)) {
			out[out.length - 1] = `${out[out.length - 1]} ${s}`.trim();
		} else {
			out.push(s);
		}
	}
	/* Fold a trailing stub (list marker / bare number) into the previous sentence. */
	if (out.length >= 2 && isWeakSentenceFragment(out[out.length - 1]!)) {
		const last = out.pop()!;
		out[out.length - 1] = `${out[out.length - 1]} ${last}`.trim();
	}
	return out.filter(Boolean);
}

/**
 * Ensure the string reads as a finished thought: prefer real `.!?`, else trim dangling
 * words and close with a period when the result is still a usable phrase.
 * Does not "complete" truncated number stubs by adding a period.
 */
export function ensureCompleteThought(text: string): string {
	let out = normalizeCopy(text);
	if (!out) return '';
	if (endsWithSentence(out)) return out;
	out = trimDanglingTail(out);
	if (!out) return '';
	if (endsWithSentence(out)) return out;
	/* Truncated facts ("… share 95.") — leave as-is; callers should widen the window. */
	if (/\b\d+\.?$/.test(out) && wordCount(out) < 14) return out;
	if (isIncompleteOverlayCopy(out, 8) && /[.!?]$/.test(out)) return out;
	/* Close a finished-looking clause rather than leave it hanging. */
	if (wordCount(out) >= 4) {
		if (/[.!?]$/.test(out)) return out;
		return `${out}.`;
	}
	return out;
}

export function clampToCompleteSentences(text: string, maxLen: number): string {
	const plain = normalizeCopy(text);
	if (!plain || maxLen <= 0) return '';
	if (plain.length <= maxLen) return ensureCompleteThought(plain);

	const sentences = splitIntoSentences(plain);
	let out = '';
	for (const s of sentences) {
		const next = out ? `${out} ${s}` : s;
		if (next.length <= maxLen) out = next;
		else break;
	}
	if (out && endsWithSentence(out) && !isIncompleteOverlayCopy(out, 6)) return out.trim();

	/* Expand slightly over budget to finish the first in-progress sentence. */
	const hardMax = Math.max(maxLen + 24, Math.ceil(maxLen * 1.6));
	const firstEnd = firstSentenceEndIndex(plain);
	if (firstEnd >= 0) {
		const first = plain.slice(0, firstEnd + 1).trim();
		if (first.length <= hardMax && !isIncompleteOverlayCopy(first, 6)) return first;
		/* First terminator was a stub — take through the next real sentence if possible. */
		const secondEnd = firstSentenceEndIndex(plain.slice(firstEnd + 1));
		if (secondEnd >= 0) {
			const two = plain.slice(0, firstEnd + 1 + 1 + secondEnd + 1).trim();
			if (two.length <= hardMax) return two;
		}
	}

	if (out && !isIncompleteOverlayCopy(out, 6)) return ensureCompleteThought(out);

	const slice = plain.slice(0, maxLen).trimEnd();
	const sp = slice.lastIndexOf(' ');
	const minKeep = Math.floor(maxLen * 0.45);
	return ensureCompleteThought(sp >= minKeep ? slice.slice(0, sp) : slice);
}

/** Word-budget trim that never appends "…" and always prefers a finished sentence. */
export function clampToCompleteWords(text: string, maxWords: number): string {
	const plain = normalizeCopy(text);
	if (!plain || maxWords <= 0) return '';
	const words = plain.split(/\s+/).filter(Boolean);
	if (words.length <= maxWords) return ensureCompleteThought(plain);

	const hardMax = Math.max(maxWords + 12, Math.ceil(maxWords * 2));

	const within = words.slice(0, maxWords).join(' ');
	const endWithin = lastSentenceEndIndex(within);
	if (endWithin >= Math.floor(within.length * 0.25)) {
		const cut = within.slice(0, endWithin + 1).trim();
		if (!isIncompleteOverlayCopy(cut, Math.min(6, maxWords))) return cut;
	}

	/* Expand past the word budget to finish the open sentence. */
	for (let n = maxWords + 1; n <= Math.min(words.length, hardMax); n++) {
		const cand = words.slice(0, n).join(' ');
		if (endsWithSentence(cand) && !isIncompleteOverlayCopy(cand, Math.min(6, maxWords))) {
			return cand;
		}
	}

	/* First complete non-stub sentence from the full string, if it fits the soft cap. */
	const sentences = splitIntoSentences(plain);
	for (const first of sentences) {
		const wc = wordCount(first);
		if (wc <= hardMax && !isIncompleteOverlayCopy(first, Math.min(6, maxWords))) {
			return first;
		}
		if (wc <= hardMax) continue;
		break;
	}

	return ensureCompleteThought(within);
}

export function fitCopyBudget(
	text: string,
	opts: { maxWords?: number; maxChars?: number },
): string {
	let out = normalizeCopy(text);
	if (!out) return '';
	if (opts.maxWords != null && opts.maxWords > 0) {
		out = clampToCompleteWords(out, opts.maxWords);
	}
	if (opts.maxChars != null && opts.maxChars > 0) {
		out = clampToCompleteSentences(out, opts.maxChars);
	}
	return ensureCompleteThought(out.replace(/[,;:\s]+$/g, '').trim());
}
