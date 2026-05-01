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

/** `[[grad(#a,#b): phrase]]` — flexible hex (models vary in digit count). */
const HIGHLIGHT_GRAD_INNER_RE =
	/^\s*grad\(\s*(#[0-9a-fA-F]{3,8})\s*,\s*(#[0-9a-fA-F]{3,8})\s*\)\s*:\s*(.+)$/is;
/** `[[#hex: phrase]]` */
const HIGHLIGHT_HEX_PREFIX_RE = /^\s*(#[0-9a-fA-F]{3,8})\s*:\s*(.*)$/is;

export interface HighlightRange {
	start: number;
	end: number;
	color: string;
	gradientFrom?: string;
	gradientTo?: string;
	pattern?: string;
	patternImage?: string;
	/** Solid background behind text (not text-fill). */
	markerBg?: string;
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
	markerBg?: string;
}

/**
 * Parse markup like:
 *   [[WORD]]                    → solid highlight (default color)
 *   [[#F59E0B: WORD]]           → solid custom color
 *   [[grad(#FF0000,#FFFF00): WORD]] → gradient
 *   [[pattern(waves,#00CED1): WORD]] → pattern fill
 *   [[marker(#hex): WORD]]          → background chip behind phrase
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

		// Do NOT trim inner — trailing/leading spaces belong to the visible phrase (e.g. after
		// splitting one highlight into [[… WILL ]][[… APPEAR]] the space must survive parse).
		const inner = raw.slice(open + 2, close);
		let phrase = inner;
		let color = defaultColor;
		let gradientFrom: string | undefined;
		let gradientTo: string | undefined;
		let pattern: string | undefined;
		let patternImage: string | undefined;
		let markerBg: string | undefined;

		// pattern(name): phrase  — any name, optional ,#hex suffix ignored (image-based)
		const patternRe = /^\s*pattern\(\s*([\w-]+)\s*(?:,\s*#[0-9a-fA-F]{3,8})?\s*\)\s*:\s*(.+)$/is;
		const pm = inner.match(patternRe);
		if (pm) {
			pattern = pm[1].toLowerCase();
			phrase = pm[2];
			patternImage = getPatternImage(pattern);
		}

		// grad(#from, #to): phrase
		const gm = !pm ? inner.match(HIGHLIGHT_GRAD_INNER_RE) : null;
		if (gm) {
			gradientFrom = gm[1];
			gradientTo = gm[2];
			color = gm[1];
			phrase = gm[3];
		}

		// marker(#hex): phrase — background chip (toolbar BG)
		const markerRe = /^\s*marker\(\s*(#[0-9a-fA-F]{3,8})\s*\)\s*:\s*(.+)$/is;
		const mm = !pm && !gm ? inner.match(markerRe) : null;
		if (mm) {
			markerBg = mm[1];
			phrase = mm[2];
			color = defaultColor;
		}

		// #hex: phrase — phrase capture keeps leading/trailing spaces (boundary chars between splits).
		const cm = !pm && !gm && !mm ? inner.match(HIGHLIGHT_HEX_PREFIX_RE) : null;
		if (cm) {
			color = cm[1];
			phrase = cm[2];
		}

		const start = plain.length;
		plain += phrase;
		ranges.push({ start, end: plain.length, color, gradientFrom, gradientTo, pattern, patternImage, markerBg });
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
			markerBg: range.markerBg,
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

/**
 * Collapses [[…]] tokens to simple [[phrase]] form — drops grad(), marker(), #hex:, pattern()
 * so rendered slides use default headline color + toolbar highlight color (e.g. white + orange).
 * Uses token walking (not only parse ranges) so odd AI formatting still collapses.
 */
export function stripAdvancedHighlightMarkup(raw: string): string {
	if (!raw?.includes('[[')) return raw;
	let out = '';
	let i = 0;
	while (i < raw.length) {
		const open = raw.indexOf('[[', i);
		if (open === -1) {
			out += raw.slice(i);
			break;
		}
		out += raw.slice(i, open);
		const close = raw.indexOf(']]', open + 2);
		if (close === -1) {
			out += raw.slice(open);
			break;
		}
		const inner = raw.slice(open + 2, close);
		let phrase = phraseFromHighlightInner(inner);
		if (
			phrase === inner &&
			(/\bgrad\s*\(/i.test(inner) || /\bmarker\s*\(/i.test(inner) || /\bpattern\s*\(/i.test(inner))
		) {
			const idx = inner.lastIndexOf(':');
			if (idx !== -1) {
				const tail = inner.slice(idx + 1);
				if (tail.trim()) phrase = tail;
			}
		}
		out += '[[' + phrase + ']]';
		i = close + 2;
	}
	return out;
}

/** Visible phrase inside a [[…]] token (must stay aligned with parseHighlightMarkup). */
export function phraseFromHighlightInner(inner: string): string {
	const patternRe = /^\s*pattern\(\s*([\w-]+)\s*(?:,\s*#[0-9a-fA-F]{3,8})?\s*\)\s*:\s*(.+)$/is;
	const pm = inner.match(patternRe);
	if (pm) return pm[2];
	const gm = inner.match(HIGHLIGHT_GRAD_INNER_RE);
	if (gm) return gm[3];
	const markerRe = /^\s*marker\(\s*(#[0-9a-fA-F]{3,8})\s*\)\s*:\s*(.+)$/is;
	const mm = inner.match(markerRe);
	if (mm) return mm[2];
	const cm = inner.match(HIGHLIGHT_HEX_PREFIX_RE);
	if (cm) return cm[2];
	return inner;
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
			const phrase = phraseFromHighlightInner(inner);
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

export type HighlightSpec =
	| { kind: 'default' }                                // [[WORD]]
	| { kind: 'color'; color: string }                   // [[#F5A623: WORD]]
	| { kind: 'gradient'; from: string; to: string }     // [[grad(#a,#b): WORD]]
	| { kind: 'pattern'; name: string }                  // [[pattern(name): WORD]]
	| { kind: 'marker'; color: string }                  // [[marker(#hex): WORD]]
	| { kind: 'clear' };                                 // remove highlight for that range

/**
 * Apply a highlight to a plain-text range within raw markup.
 *
 * Word/Canva-style behavior: when `[plainStart, plainEnd]` only partially
 * overlaps an existing `[[...]]` token, the parts of that token outside the
 * selection are PRESERVED (with their original color / gradient / marker / pattern).
 * Only the overlapping middle is replaced with the new spec (or removed for `clear`).
 */
export function applyHighlight(
	raw: string,
	plainStart: number,
	plainEnd: number,
	spec: HighlightSpec,
	defaultHighlight: string = '#F59E0B',
): string {
	if (plainStart > plainEnd) [plainStart, plainEnd] = [plainEnd, plainStart];

	const parsed = parseHighlightMarkup(raw, defaultHighlight);
	const plain = parsed.plain;
	plainStart = Math.max(0, Math.min(plain.length, plainStart));
	plainEnd = Math.max(0, Math.min(plain.length, plainEnd));
	if (plainStart >= plainEnd) return raw;

	const kept: HighlightRange[] = [];
	for (const r of parsed.ranges) {
		// Token fully outside selection — keep as-is.
		if (r.end <= plainStart || r.start >= plainEnd) {
			kept.push(r);
			continue;
		}
		// Token fully inside selection — drop (will be replaced by the new spec).
		if (r.start >= plainStart && r.end <= plainEnd) continue;
		// Partial overlap — keep the non-overlapping side(s) with the original spec.
		if (r.start < plainStart) kept.push({ ...r, end: plainStart });
		if (r.end > plainEnd) kept.push({ ...r, start: plainEnd });
	}

	if (spec.kind !== 'clear') {
		kept.push(rangeFromSpec(plainStart, plainEnd, spec, defaultHighlight));
	}

	kept.sort((a, b) => a.start - b.start || a.end - b.end);
	return emitMarkupFromRanges(plain, kept, defaultHighlight);
}

function rangeFromSpec(
	start: number,
	end: number,
	spec: HighlightSpec,
	defaultHighlight: string,
): HighlightRange {
	switch (spec.kind) {
		case 'color':    return { start, end, color: spec.color };
		case 'gradient': return { start, end, color: spec.from, gradientFrom: spec.from, gradientTo: spec.to };
		case 'pattern':  return { start, end, color: defaultHighlight, pattern: spec.name, patternImage: getPatternImage(spec.name) };
		case 'marker':   return { start, end, color: defaultHighlight, markerBg: spec.color };
		case 'default':
		case 'clear':
		default:         return { start, end, color: defaultHighlight };
	}
}

/** Re-emit a parsed range as `[[…]]` markup, picking the right spec form (marker / grad / pattern / #hex / default). */
function emitRangeMarkup(range: HighlightRange, phrase: string, defaultHighlight: string): string {
	if (range.markerBg) return `[[marker(${range.markerBg}): ${phrase}]]`;
	if (range.gradientFrom && range.gradientTo) return `[[grad(${range.gradientFrom},${range.gradientTo}): ${phrase}]]`;
	if (range.pattern) return `[[pattern(${range.pattern}): ${phrase}]]`;
	if (range.color && normalizePaintColorKey(range.color) !== normalizePaintColorKey(defaultHighlight)) {
		return `[[${range.color}: ${phrase}]]`;
	}
	return `[[${phrase}]]`;
}

function emitMarkupFromRanges(
	plain: string,
	ranges: HighlightRange[],
	defaultHighlight: string,
): string {
	let result = '';
	let cursor = 0;
	for (const r of ranges) {
		if (r.start >= r.end) continue;
		if (r.start > cursor) result += plain.slice(cursor, r.start);
		const phrase = plain.slice(r.start, r.end);
		if (phrase.length === 0) {
			cursor = r.end;
			continue;
		}
		result += emitRangeMarkup(r, phrase, defaultHighlight);
		cursor = r.end;
	}
	if (cursor < plain.length) result += plain.slice(cursor);
	return result;
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
				const phrase = phraseFromHighlightInner(inner);
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

function normalizePaintColorKey(c: string): string {
	const s = c.trim().toLowerCase();
	if (!s.startsWith('#')) return s;
	if (s.length === 4) {
		return `#${s[1]}${s[1]}${s[2]}${s[2]}${s[3]}${s[3]}`;
	}
	return s;
}

/**
 * True when a plain-text range spans more than one distinct foreground fill
 * (base body color vs [[...]] colors, multiple highlight colors, etc.).
 * Gradient or pattern spans count as mixed.
 */
export function plainRangeHasMixedForegroundPaint(
	raw: string,
	plainStart: number,
	plainEnd: number,
	defaultHighlight: string,
	baseTextColor: string,
): boolean {
	if (plainStart === plainEnd) return false;
	let a = plainStart;
	let b = plainEnd;
	if (a > b) [a, b] = [b, a];
	const parsed = parseHighlightMarkup(raw, defaultHighlight);
	const segs = segmentText(parsed);
	const paints = new Set<string>();
	let pos = 0;
	const base = normalizePaintColorKey(baseTextColor);
	const defHi = normalizePaintColorKey(defaultHighlight);

	for (const seg of segs) {
		const segEnd = pos + seg.text.length;
		const lo = Math.max(a, pos);
		const hi = Math.min(b, segEnd);
		if (lo < hi) {
			if (seg.gradientFrom || seg.gradientTo || seg.patternImage) return true;
			const fill = seg.highlighted
				? normalizePaintColorKey(seg.color ?? defHi)
				: base;
			paints.add(fill);
			if (paints.size > 1) return true;
		}
		pos = segEnd;
	}
	return false;
}

/**
 * Single color for the floating toolbar text swatch when the plain range is one uniform solid:
 * unmarked text uses `blockInk`, `[[#hex:]]` / default highlight use segment color,
 * `[[marker(...)]]` chips use `markerChipInk` (template body, not block headline color).
 * Returns undefined if the range is mixed, empty, or only gradients/patterns.
 */
export function rangeForegroundSwatchColor(
	raw: string,
	plainStart: number,
	plainEnd: number,
	defaultHighlight: string,
	blockInk: string,
	markerChipInk: string,
): string | undefined {
	if (plainStart === plainEnd) return undefined;
	let a = plainStart;
	let b = plainEnd;
	if (a > b) [a, b] = [b, a];

	const parsed = parseHighlightMarkup(raw, defaultHighlight);
	const segs = segmentText(parsed);
	const samples: string[] = [];
	let pos = 0;

	for (const seg of segs) {
		const segEnd = pos + seg.text.length;
		const lo = Math.max(a, pos);
		const hi = Math.min(b, segEnd);
		if (lo < hi) {
			if (seg.gradientFrom || seg.gradientTo || seg.patternImage) return undefined;
			if (seg.markerBg) samples.push(markerChipInk);
			else if (seg.highlighted) samples.push(seg.color ?? defaultHighlight);
			else samples.push(blockInk);
		}
		pos = segEnd;
	}

	if (samples.length === 0) return undefined;
	const norms = samples.map(normalizePaintColorKey);
	const first = norms[0];
	if (!norms.every((n) => n === first)) return undefined;
	return samples[0];
}

// ── DOM selection ↔ plain headline offsets (for floating toolbar) ───────

/**
 * Plain offset from root start to (container, offset). Must match the same DFS text order as
 * `restorePlainSelection`; Range#toString() can disagree at span/text boundaries and breaks highlights.
 */
function boundaryPlainOffset(headlineRoot: HTMLElement, container: Node, offset: number): number {
	let total = 0;
	let found = false;

	const countSubtree = (node: Node) => {
		if (node.nodeType === Node.TEXT_NODE) {
			total += (node.textContent ?? '').length;
			return;
		}
		if (node.nodeType === Node.ELEMENT_NODE) {
			for (const child of Array.from(node.childNodes)) countSubtree(child);
		}
	};

	const walk = (node: Node): void => {
		if (found) return;
		if (node === container) {
			if (node.nodeType === Node.TEXT_NODE) {
				total += Math.max(0, Math.min(offset, (node as Text).length));
				found = true;
				return;
			}
			if (node.nodeType === Node.ELEMENT_NODE) {
				for (let i = 0; i < offset; i++) {
					const ch = node.childNodes[i];
					if (ch) countSubtree(ch);
				}
				found = true;
				return;
			}
		}
		if (node.nodeType === Node.TEXT_NODE) {
			total += (node.textContent ?? '').length;
			return;
		}
		if (node.nodeType === Node.ELEMENT_NODE) {
			for (const child of Array.from(node.childNodes)) {
				if (found) return;
				walk(child);
			}
		}
	};

	try {
		walk(headlineRoot);
	} catch {
		return -1;
	}
	return found ? total : -1;
}

/** Plain-text offsets of the current Selection inside `root` (visible text only, no `[[` markup). */
export function plainRangeFromSelection(root: HTMLElement): { start: number; end: number } | null {
	const sel = window.getSelection();
	if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return null;
	const range = sel.getRangeAt(0);
	if (!root.contains(range.startContainer) || !root.contains(range.endContainer)) return null;

	const start = boundaryPlainOffset(root, range.startContainer, range.startOffset);
	const end = boundaryPlainOffset(root, range.endContainer, range.endOffset);
	if (start < 0 || end < 0) return null;
	if (start === end) return null;
	return start < end ? { start, end } : { start: end, end: start };
}

/** Re-create the browser selection from plain offsets under `root` (inverse of `plainRangeFromSelection`). */
export function restorePlainSelection(root: HTMLElement, plainStart: number, plainEnd: number): boolean {
	if (plainStart >= plainEnd) return false;
	let acc = 0;
	let startN: Text | null = null;
	let startO = 0;
	let endN: Text | null = null;
	let endO = 0;

	const walk = (node: Node): void => {
		if (startN && endN) return;
		if (node.nodeType === Node.TEXT_NODE) {
			const t = node as Text;
			const len = t.length;
			const next = acc + len;
			if (!startN && plainStart < next) {
				startN = t;
				startO = plainStart - acc;
			}
			if (!endN && plainEnd <= next) {
				endN = t;
				endO = plainEnd - acc;
			}
			acc = next;
			return;
		}
		for (const c of Array.from(node.childNodes)) walk(c);
	};

	walk(root);
	if (!startN || !endN) return false;

	const sn = startN as Text;
	const en = endN as Text;
	try {
		const r = document.createRange();
		r.setStart(sn, Math.max(0, Math.min(startO, sn.length)));
		r.setEnd(en, Math.max(0, Math.min(endO, en.length)));
		const sel = window.getSelection();
		if (!sel) return false;
		sel.removeAllRanges();
		sel.addRange(r);
		return true;
	} catch {
		return false;
	}
}
