/** Parses [[...]] highlight markup from AI-generated text */

/** Maps pattern names → static image paths */
const PATTERN_IMAGES: Record<string, string> = {
	'light-blue':  '/text-patterns/light-blue.jpeg',
	'light-green': '/text-patterns/light-green.png',
};

export function getPatternImage(name: string): string | undefined {
	return PATTERN_IMAGES[name.toLowerCase().replace(/\s+/g, '-')];
}

export const AVAILABLE_PATTERNS = Object.entries(PATTERN_IMAGES).map(([name, url]) => ({
	name,
	label: name.split('-').map(w => w[0].toUpperCase() + w.slice(1)).join(' '),
	url,
}));

export interface HighlightRange {
	start: number;
	end: number;
	color: string;
	gradientFrom?: string;
	gradientTo?: string;
	pattern?: string;
	patternImage?: string;
}

export interface ParsedText {
	plain: string;
	ranges: HighlightRange[];
}

export interface TextSegment {
	text: string;
	highlighted: boolean;
	color?: string;
	gradientFrom?: string;
	gradientTo?: string;
	pattern?: string;
	patternImage?: string;
}

/**
 * Parse markup like:
 *   [[WORD]]                    → solid highlight (default color)
 *   [[#F59E0B: WORD]]           → solid custom color
 *   [[grad(#FF0000,#FFFF00): WORD]] → gradient
 *   [[pattern(waves,#00CED1): WORD]] → pattern fill
 */
export function parseHighlightMarkup(raw: string, defaultColor = '#F59E0B'): ParsedText {
	const ranges: HighlightRange[] = [];
	let plain = '';
	let i = 0;

	while (i < raw.length) {
		const open = raw.indexOf('[[', i);
		if (open === -1) { plain += raw.slice(i); break; }
		plain += raw.slice(i, open);

		const close = raw.indexOf(']]', open + 2);
		if (close === -1) { plain += raw.slice(open); break; }

		const inner = raw.slice(open + 2, close).trim();
		let phrase = inner;
		let color = defaultColor;
		let gradientFrom: string | undefined;
		let gradientTo: string | undefined;
		let pattern: string | undefined;
		let patternImage: string | undefined;

		// pattern(name): phrase  — any name, optional ,#hex suffix ignored (image-based)
		const patternRe = /^pattern\(\s*([\w-]+)\s*(?:,\s*#[0-9a-fA-F]{3,8})?\s*\)\s*:\s*(.+)$/i;
		const pm = inner.match(patternRe);
		if (pm) {
			pattern = pm[1].toLowerCase();
			phrase = pm[2].trim();
			patternImage = getPatternImage(pattern);
		}

		// grad(#from, #to): phrase
		const gradRe = /^grad\(\s*(#[0-9a-fA-F]{6})\s*,\s*(#[0-9a-fA-F]{6})\s*\)\s*:\s*(.+)$/i;
		const gm = !pm ? inner.match(gradRe) : null;
		if (gm) {
			gradientFrom = gm[1];
			gradientTo = gm[2];
			color = gm[1];
			phrase = gm[3].trim();
		}

		// #hex: phrase
		const colorRe = /^(#[0-9a-fA-F]{6})\s*:\s*(.+)$/i;
		const cm = !pm && !gm ? inner.match(colorRe) : null;
		if (cm) {
			color = cm[1];
			phrase = cm[2].trim();
		}

		const start = plain.length;
		plain += phrase;
		ranges.push({ start, end: plain.length, color, gradientFrom, gradientTo, pattern, patternImage });
		i = close + 2;
	}

	return { plain, ranges };
}

/** Split parsed text into renderable segments */
export function segmentText(parsed: ParsedText): TextSegment[] {
	const segments: TextSegment[] = [];
	let cursor = 0;

	const sorted = [...parsed.ranges].sort((a, b) => a.start - b.start);

	for (const range of sorted) {
		if (cursor < range.start) {
			segments.push({ text: parsed.plain.slice(cursor, range.start), highlighted: false });
		}
		segments.push({
			text: parsed.plain.slice(range.start, range.end),
			highlighted: true,
			color: range.color,
			gradientFrom: range.gradientFrom,
			gradientTo: range.gradientTo,
			pattern: range.pattern,
			patternImage: range.patternImage,
		});
		cursor = range.end;
	}

	if (cursor < parsed.plain.length) {
		segments.push({ text: parsed.plain.slice(cursor), highlighted: false });
	}

	return segments;
}

/** Strip markup to plain text */
export function stripMarkup(raw: string): string {
	return parseHighlightMarkup(raw).plain;
}

// ── Raw-markup <-> plain-text offset mapping ──────────────────────────────
/**
 * Given raw markup (with `[[...]]`) and an offset in the PLAIN text,
 * returns the equivalent offset in the RAW markup string.
 *
 * Example (defaults):
 *   raw:   "FIVE [[BIG]] COMPANIES"
 *   plain: "FIVE BIG COMPANIES"
 *   plainOffset 5 → rawOffset 7  (inside the [[BIG]] token, right after "[[")
 *
 * Boundary rule: when `plainOffset` lands exactly at the start of a highlight,
 * we return the position BEFORE the `[[`. When it lands exactly at the end,
 * we return the position AFTER the `]]`. This makes insertions at boundaries
 * behave the way a human expects (outside the existing highlight, not inside).
 */
function plainOffsetToRaw(raw: string, plainOffset: number): number {
	let i = 0;
	let plain = 0;

	while (i < raw.length) {
		if (plain === plainOffset) return i;

		// Entering a [[...]] token?
		if (raw[i] === '[' && raw[i + 1] === '[') {
			const close = raw.indexOf(']]', i + 2);
			if (close === -1) {
				// unterminated — treat rest as plain
				const remaining = raw.length - i;
				if (plain + remaining >= plainOffset) return i + (plainOffset - plain);
				plain += remaining;
				i = raw.length;
				continue;
			}
			const inner = raw.slice(i + 2, close);

			// Strip markup prefix to get the phrase that actually shows up in plain.
			const phrase = extractPhraseFromInner(inner);
			const prefixLen = inner.length - phrase.length; // how many chars inside the [[...]] are metadata
			const tokenPlainLen = phrase.length;

			// Does the target offset fall inside this highlight's phrase?
			if (plain + tokenPlainLen >= plainOffset) {
				const inside = plainOffset - plain;
				// Boundary case: return position BEFORE [[ when inside === 0
				if (inside === 0) return i;
				// Boundary case: return position AFTER ]] when at the tail
				if (inside === tokenPlainLen) return close + 2;
				// Mid-token: return position inside the phrase in the raw string
				return i + 2 + prefixLen + inside;
			}

			plain += tokenPlainLen;
			i = close + 2;
			continue;
		}

		plain++;
		i++;
	}

	return raw.length;
}

/** Extract just the visible phrase from the inside of a [[...]] token. */
function extractPhraseFromInner(inner: string): string {
	const trimmed = inner.trim();
	const patternRe = /^pattern\(\s*[\w-]+\s*(?:,\s*#[0-9a-fA-F]{3,8})?\s*\)\s*:\s*(.+)$/i;
	const gradRe = /^grad\(\s*#[0-9a-fA-F]{6}\s*,\s*#[0-9a-fA-F]{6}\s*\)\s*:\s*(.+)$/i;
	const colorRe = /^#[0-9a-fA-F]{3,8}\s*:\s*(.+)$/i;
	const m = trimmed.match(patternRe) ?? trimmed.match(gradRe) ?? trimmed.match(colorRe);
	return m ? m[1].trim() : trimmed;
}

export type HighlightSpec =
	| { kind: 'default' }                                // [[WORD]]
	| { kind: 'color'; color: string }                   // [[#F5A623: WORD]]
	| { kind: 'gradient'; from: string; to: string }     // [[grad(#a,#b): WORD]]
	| { kind: 'pattern'; name: string }                  // [[pattern(name): WORD]]
	| { kind: 'clear' };                                 // remove highlight for that range

/**
 * Apply a highlight to a plain-text range within raw markup.
 * The function first strips any existing `[[...]]` wrapping that overlaps the
 * range (so switching highlight types is clean), then inserts the new wrapper.
 */
export function applyHighlight(
	raw: string,
	plainStart: number,
	plainEnd: number,
	spec: HighlightSpec,
): string {
	if (plainStart > plainEnd) [plainStart, plainEnd] = [plainEnd, plainStart];

	// Step 1: strip existing highlights that overlap [plainStart, plainEnd].
	const stripped = stripHighlightsInRange(raw, plainStart, plainEnd);

	// Step 2: compute raw offsets in the stripped string (now fewer markup chars).
	const rawStart = plainOffsetToRaw(stripped, plainStart);
	const rawEnd = plainOffsetToRaw(stripped, plainEnd);

	if (rawStart >= rawEnd) return stripped;

	if (spec.kind === 'clear') return stripped;

	const phrase = stripped.slice(rawStart, rawEnd);
	const wrapped = wrapPhrase(phrase, spec);
	return stripped.slice(0, rawStart) + wrapped + stripped.slice(rawEnd);
}

function wrapPhrase(phrase: string, spec: HighlightSpec): string {
	switch (spec.kind) {
		case 'default':  return `[[${phrase}]]`;
		case 'color':    return `[[${spec.color}: ${phrase}]]`;
		case 'gradient': return `[[grad(${spec.from},${spec.to}): ${phrase}]]`;
		case 'pattern':  return `[[pattern(${spec.name}): ${phrase}]]`;
		case 'clear':    return phrase;
	}
}

/**
 * Remove any `[[...]]` wrappers whose plain-text range overlaps `[plainStart, plainEnd]`.
 * Returns the raw string with those wrappers removed (their inner phrase stays).
 */
function stripHighlightsInRange(raw: string, plainStart: number, plainEnd: number): string {
	let result = '';
	let i = 0;
	let plain = 0;

	while (i < raw.length) {
		if (raw[i] === '[' && raw[i + 1] === '[') {
			const close = raw.indexOf(']]', i + 2);
			if (close !== -1) {
				const inner = raw.slice(i + 2, close);
				const phrase = extractPhraseFromInner(inner);
				const tokenStart = plain;
				const tokenEnd = plain + phrase.length;
				const overlaps = !(tokenEnd <= plainStart || tokenStart >= plainEnd);
				if (overlaps) {
					result += phrase; // drop markup, keep the visible text
				} else {
					result += raw.slice(i, close + 2); // keep intact
				}
				plain = tokenEnd;
				i = close + 2;
				continue;
			}
		}
		result += raw[i];
		plain++;
		i++;
	}

	return result;
}
