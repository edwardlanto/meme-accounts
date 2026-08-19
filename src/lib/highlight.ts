/** Parses [[...]] highlight markup from AI-generated text */

/** Maps pattern names → static image paths */
const PATTERN_IMAGES: Record<string, string> = {
	'light-blue': '/text-patterns/light-blue.jpeg',
	'light-green': '/text-patterns/light-green.png',
	amber: '/text-patterns/amber.jpeg',
	coral: '/text-patterns/coral.jpeg',
	violet: '/text-patterns/violet.jpeg',
	orange: '/text-patterns/orange.jpeg',
	champagne: '/text-patterns/champagne.jpeg',
	magenta: '/text-patterns/magenta.jpeg',
};

export function getPatternImage(name: string): string | undefined {
	return PATTERN_IMAGES[name.toLowerCase().replace(/\s+/g, '-')];
}

export const AVAILABLE_PATTERNS = Object.entries(PATTERN_IMAGES).map(([name, url]) => ({
	name,
	label: name.split('-').map(w => w[0].toUpperCase() + w.slice(1)).join(' '),
	url,
}));

export function normalizeHighlightPatternName(
	raw: string,
	fallback = AVAILABLE_PATTERNS[0]?.name ?? 'light-blue',
): string {
	const name = String(raw ?? '').trim().toLowerCase().replace(/\s+/g, '-');
	return getPatternImage(name) ? name : fallback;
}

/** Clamp a CSS font-weight to the 100–900 axis (default 700 when unknown). */
export function normalizeHighlightBaseWeight(baseWeight?: number | string | null): number {
	const n = typeof baseWeight === 'string' ? Number.parseFloat(baseWeight) : Number(baseWeight);
	if (!Number.isFinite(n)) return 700;
	return Math.max(100, Math.min(900, Math.round(n)));
}

/**
 * Heavier weight for `[[…]]` highlight spans relative to the surrounding block.
 * Caps at 900; when the block is already ≥800, callers should also apply the
 * stroke/synthesis extras from `highlightEmphasisCss`.
 */
export function resolveHighlightEmphasisWeight(baseWeight?: number | string | null): number {
	const base = normalizeHighlightBaseWeight(baseWeight);
	return Math.min(900, Math.max(700, base + 200));
}

/**
 * Inline CSS so highlighted phrases read heavier than the parent line.
 * When the parent is already heavy (≥800), adds a light stroke so Plus Jakarta
 * (max ~800) and 900-weight blocks still show a visible bump.
 */
export function highlightEmphasisCss(baseWeight?: number | string | null): string {
	const base = normalizeHighlightBaseWeight(baseWeight);
	const w = resolveHighlightEmphasisWeight(base);
	const bits = [`font-weight: ${w};`, 'font-style: inherit;', 'text-decoration: inherit;'];
	if (base >= 800) {
		bits.push('font-synthesis: weight;');
		bits.push('-webkit-text-stroke: 0.35px currentColor;');
		bits.push('paint-order: stroke fill;');
	}
	return bits.join(' ');
}

export function normalizeInlineFontWeight(raw: number | string | null | undefined): number | undefined {
	const n = typeof raw === 'string' ? Number.parseFloat(raw) : Number(raw);
	if (!Number.isFinite(n)) return undefined;
	const rounded = Math.round(n);
	if (rounded < 100 || rounded > 900) return undefined;
	return rounded;
}

/** Inline CSS for a `[[w(800): …]]` span. Inherit when the span has no own weight. */
export function highlightWeightCss(fontWeight?: number | null): string {
	if (fontWeight == null) return 'font-weight: inherit; font-style: inherit; text-decoration: inherit;';
	return `font-weight: ${fontWeight}; font-style: inherit; text-decoration: inherit;`;
}

/** Apply the same emphasis rules to a live DOM node (HighlightEditor). */
export function applyHighlightEmphasisToElement(
	el: HTMLElement,
	baseWeight?: number | string | null,
): void {
	const base = normalizeHighlightBaseWeight(baseWeight);
	const w = resolveHighlightEmphasisWeight(base);
	el.style.fontWeight = String(w);
	if (base >= 800) {
		el.style.fontSynthesis = 'weight';
		el.style.setProperty('-webkit-text-stroke', '0.35px currentColor');
		el.style.setProperty('paint-order', 'stroke fill');
	} else {
		el.style.removeProperty('font-synthesis');
		el.style.removeProperty('-webkit-text-stroke');
		el.style.removeProperty('paint-order');
	}
}

/** Solid swatches shared by Studio settings + floating highlight toolbar. */
export const HIGHLIGHT_SOLID_PRESETS = [
	'#08EBFF',
	'#FF3B5C',
	'#F5A623',
	'#A855F7',
	'#10B981',
	'#FFD700',
	'#FF6B6B',
	'#4ECDC4',
] as const;

/** Gradient pairs shared by Studio settings + floating highlight toolbar. */
export const HIGHLIGHT_GRADIENT_PRESETS: readonly [string, string][] = [
	['#FFFFFF', '#F5A623'],
	['#F5A623', '#FFB347'],
	['#08EBFF', '#A855F7'],
	['#10B981', '#08EBFF'],
];

/**
 * Default look for bare `[[phrase]]` markers (AI / plain markup).
 * Explicit `[[#hex:…]]` / `[[grad(…):…]]` / `[[pattern(…):…]]` always win.
 */
export type HighlightDefaults = {
	color: string;
	gradientFrom?: string;
	gradientTo?: string;
	pattern?: string;
};

export type StudioHighlightStyleKind = 'solid' | 'gradient' | 'pattern';

export function normalizeHighlightDefaults(
	input: string | HighlightDefaults | undefined,
	fallbackColor = '#F59E0B',
): HighlightDefaults {
	if (!input) return { color: fallbackColor };
	if (typeof input === 'string') {
		const color = input.trim() || fallbackColor;
		return { color };
	}
	const color = String(input.color ?? '').trim() || fallbackColor;
	const gradientFrom = String(input.gradientFrom ?? '').trim() || undefined;
	const gradientTo = String(input.gradientTo ?? '').trim() || undefined;
	const pattern = String(input.pattern ?? '')
		.trim()
		.toLowerCase()
		.replace(/\s+/g, '-') || undefined;
	return {
		color,
		...(gradientFrom && gradientTo ? { gradientFrom, gradientTo } : {}),
		...(pattern ? { pattern } : {}),
	};
}

/** `[[grad(#a,#b): phrase]]` — flexible hex (models vary in digit count). */
const HIGHLIGHT_GRAD_INNER_RE =
	/^\s*grad\(\s*(#[0-9a-fA-F]{3,8})\s*,\s*(#[0-9a-fA-F]{3,8})\s*\)\s*:\s?(.*)$/is;
/** `[[#hex: phrase]]` — only one whitespace after `:` is delimiter; phrase may start with spaces (split tokens). */
const HIGHLIGHT_HEX_PREFIX_RE = /^\s*(#[0-9a-fA-F]{3,8})\s*:\s?(.*)$/is;
/** `[[w(800): phrase]]` — inline weight; rest of inner may still carry paint (`#hex:`, grad, …). */
const HIGHLIGHT_WEIGHT_PREFIX_RE = /^\s*w\(\s*(\d{2,3})\s*\)\s*:\s?(.*)$/is;

function parseWeightPrefix(inner: string): { fontWeight?: number; rest: string } {
	const wm = inner.match(HIGHLIGHT_WEIGHT_PREFIX_RE);
	if (!wm) return { rest: inner };
	const fontWeight = normalizeInlineFontWeight(wm[1]);
	return { fontWeight, rest: wm[2] ?? '' };
}

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
	/** Inline font-weight for this span (100–900). Independent of color paint. */
	fontWeight?: number;
	/**
	 * True when this span has color / gradient / pattern / marker / default highlight paint.
	 * Weight-only spans (`[[w(800): met]]`) keep surrounding ink.
	 */
	painted?: boolean;
}

export interface ParsedText {
	plain: string;
	ranges: HighlightRange[];
}

export interface TextSegment {
	text: string;
	highlighted: boolean;
	/** Plain-text offsets into the visible string (no `[[…]]`). */
	start?: number;
	end?: number;
	color?: string;
	gradientFrom?: string;
	gradientTo?: string;
	pattern?: string;
	patternImage?: string;
	markerBg?: string;
	fontWeight?: number;
	/** False for weight-only spans (bold part of a word without recoloring). */
	painted?: boolean;
}

/**
 * Parse markup like:
 *   [[WORD]]                    → solid highlight (default color)
 *   [[#F59E0B: WORD]]           → solid custom color
 *   [[grad(#FF0000,#FFFF00): WORD]] → gradient
 *   [[pattern(waves,#00CED1): WORD]] → pattern fill
 *   [[marker(#hex): WORD]]          → background chip behind phrase
 *   [[w(800): WORD]]                → bold/weight only (keeps surrounding ink)
 *   [[w(800):hl: WORD]]             → weight + default highlight paint
 *   [[w(800):#hex: WORD]]           → weight + solid color
 */
export function parseHighlightMarkup(
	raw: string,
	defaultColorOrStyle: string | HighlightDefaults = '#F59E0B',
): ParsedText {
	const defaults = normalizeHighlightDefaults(defaultColorOrStyle);
	const defaultColor = defaults.color;
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
		let inner = raw.slice(open + 2, close);
		let fontWeight: number | undefined;
		const weightPrefix = inner.match(/^\s*w\(\s*(\d{2,3})\s*\)\s*:\s?(.*)$/is);
		if (weightPrefix) {
			fontWeight = normalizeInlineFontWeight(weightPrefix[1]);
			inner = weightPrefix[2] ?? '';
		}

		let phrase = inner;
		let color = defaultColor;
		let gradientFrom: string | undefined;
		let gradientTo: string | undefined;
		let pattern: string | undefined;
		let patternImage: string | undefined;
		let markerBg: string | undefined;
		let styledExplicitly = false;
		let forceDefaultPaint = false;

		const hlBare = inner.match(/^\s*hl\s*:\s?(.*)$/is);
		if (hlBare) {
			phrase = hlBare[1];
			styledExplicitly = true;
			forceDefaultPaint = true;
		}

		// pattern(name): phrase  — any name, optional ,#hex suffix ignored (image-based)
		const patternRe = /^\s*pattern\(\s*([\w-]+)\s*(?:,\s*#[0-9a-fA-F]{3,8})?\s*\)\s*:\s?(.*)$/is;
		const pm = !hlBare ? inner.match(patternRe) : null;
		if (pm) {
			pattern = pm[1].toLowerCase();
			phrase = pm[2];
			patternImage = getPatternImage(pattern);
			styledExplicitly = true;
		}

		// grad(#from, #to): phrase
		const gm = !hlBare && !pm ? inner.match(HIGHLIGHT_GRAD_INNER_RE) : null;
		if (gm) {
			gradientFrom = gm[1];
			gradientTo = gm[2];
			color = gm[1];
			phrase = gm[3];
			styledExplicitly = true;
		}

		// marker(#hex): phrase — background chip (toolbar BG)
		const markerRe = /^\s*marker\(\s*(#[0-9a-fA-F]{3,8})\s*\)\s*:\s?(.*)$/is;
		const mm = !hlBare && !pm && !gm ? inner.match(markerRe) : null;
		if (mm) {
			markerBg = mm[1];
			phrase = mm[2];
			color = defaultColor;
			styledExplicitly = true;
		}

		// #hex: phrase — phrase capture keeps leading/trailing spaces (boundary chars between splits).
		const cm = !hlBare && !pm && !gm && !mm ? inner.match(HIGHLIGHT_HEX_PREFIX_RE) : null;
		if (cm) {
			color = cm[1];
			phrase = cm[2];
			styledExplicitly = true;
		}

		const painted = styledExplicitly || !fontWeight;

		// Bare `[[phrase]]` or `[[w(800):hl: phrase]]` — apply Studio default gradient / pattern when set.
		if (painted && (!styledExplicitly || forceDefaultPaint)) {
			if (defaults.pattern) {
				pattern = defaults.pattern;
				patternImage = getPatternImage(pattern);
			} else if (defaults.gradientFrom && defaults.gradientTo) {
				gradientFrom = defaults.gradientFrom;
				gradientTo = defaults.gradientTo;
				color = defaults.gradientFrom;
			}
		}

		const start = plain.length;
		plain += phrase;
		ranges.push({
			start,
			end: plain.length,
			color,
			gradientFrom,
			gradientTo,
			pattern,
			patternImage,
			markerBg,
			fontWeight,
			painted,
		});
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
			segments.push({
				text: parsed.plain.slice(cursor, range.start),
				highlighted: false,
				start: cursor,
				end: range.start,
			});
		}
		segments.push({
			text: parsed.plain.slice(range.start, range.end),
			highlighted: range.painted !== false || range.fontWeight != null,
			start: range.start,
			end: range.end,
			color: range.color,
			gradientFrom: range.gradientFrom,
			gradientTo: range.gradientTo,
			pattern: range.pattern,
			patternImage: range.patternImage,
			markerBg: range.markerBg,
			fontWeight: range.fontWeight,
			painted: range.painted !== false && (range.painted === true || range.fontWeight == null),
		});
		cursor = range.end;
	}

	if (cursor < parsed.plain.length) {
		segments.push({
			text: parsed.plain.slice(cursor),
			highlighted: false,
			start: cursor,
			end: parsed.plain.length,
		});
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
		const weightParsed = parseWeightPrefix(inner);
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
		const wPre = weightParsed.fontWeight != null ? `w(${weightParsed.fontWeight}): ` : '';
		out += '[[' + wPre + phrase + ']]';
		i = close + 2;
	}
	return out;
}

/** Visible phrase inside a [[…]] token (must stay aligned with parseHighlightMarkup). */
export function phraseFromHighlightInner(inner: string): string {
	const rest = parseWeightPrefix(inner).rest;
	const hlBare = rest.match(/^\s*hl\s*:\s?(.*)$/is);
	if (hlBare) return hlBare[1];
	const patternRe = /^\s*pattern\(\s*([\w-]+)\s*(?:,\s*#[0-9a-fA-F]{3,8})?\s*\)\s*:\s?(.*)$/is;
	const pm = rest.match(patternRe);
	if (pm) return pm[2];
	const gm = rest.match(HIGHLIGHT_GRAD_INNER_RE);
	if (gm) return gm[3];
	const markerRe = /^\s*marker\(\s*(#[0-9a-fA-F]{3,8})\s*\)\s*:\s?(.*)$/is;
	const mm = rest.match(markerRe);
	if (mm) return mm[2];
	const cm = rest.match(HIGHLIGHT_HEX_PREFIX_RE);
	if (cm) return cm[2];
	return rest;
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
	| { kind: 'weight'; weight: number | undefined }     // [[w(800): WORD]] — undefined clears weight
	| { kind: 'clear' };                                 // remove highlight for that range

/**
 * Apply a highlight to a plain-text range within raw markup.
 *
 * Word/Canva-style behavior: when `[plainStart, plainEnd]` only partially
 * overlaps an existing `[[...]]` token, the parts of that token outside the
 * selection are PRESERVED (with their original color / gradient / marker / pattern).
 * Only the overlapping middle is replaced with the new spec (or removed for `clear`).
 * Weight specs merge onto existing paint instead of replacing it.
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

	if (spec.kind === 'weight') {
		return applyWeightToPlainRange(parsed, plainStart, plainEnd, spec.weight, defaultHighlight);
	}

	const kept: HighlightRange[] = [];
	let inheritedWeight: number | undefined;
	for (const r of parsed.ranges) {
		// Token fully outside selection — keep as-is.
		if (r.end <= plainStart || r.start >= plainEnd) {
			kept.push(r);
			continue;
		}
		if (r.fontWeight != null) inheritedWeight = r.fontWeight;
		// Token fully inside selection — drop (will be replaced by the new spec).
		if (r.start >= plainStart && r.end <= plainEnd) continue;
		// Partial overlap — keep the non-overlapping side(s) with the original spec.
		if (r.start < plainStart) kept.push({ ...r, end: plainStart });
		if (r.end > plainEnd) kept.push({ ...r, start: plainEnd });
	}

	if (spec.kind !== 'clear') {
		const next = rangeFromSpec(plainStart, plainEnd, spec, defaultHighlight);
		if (inheritedWeight != null) next.fontWeight = inheritedWeight;
		kept.push(next);
	}

	kept.sort((a, b) => a.start - b.start || a.end - b.end);
	return emitMarkupFromRanges(plain, kept, defaultHighlight);
}

function rangeHasPaint(r: HighlightRange): boolean {
	return r.painted !== false;
}

function applyWeightToPlainRange(
	parsed: ParsedText,
	plainStart: number,
	plainEnd: number,
	weight: number | undefined,
	defaultHighlight: string,
): string {
	const next: HighlightRange[] = [];
	for (const r of parsed.ranges) {
		if (r.end <= plainStart || r.start >= plainEnd) {
			next.push(r);
			continue;
		}
		if (r.start < plainStart) next.push({ ...r, end: plainStart });
		const mid: HighlightRange = {
			...r,
			start: Math.max(r.start, plainStart),
			end: Math.min(r.end, plainEnd),
		};
		if (weight == null) {
			delete mid.fontWeight;
			if (rangeHasPaint(mid)) next.push(mid);
		} else {
			mid.fontWeight = weight;
			next.push(mid);
		}
		if (r.end > plainEnd) next.push({ ...r, start: plainEnd });
	}

	if (weight != null) {
		const covering = next
			.filter((r) => r.end > plainStart && r.start < plainEnd)
			.sort((a, b) => a.start - b.start);
		let cursor = plainStart;
		for (const r of covering) {
			if (r.start > cursor) {
				next.push({
					start: cursor,
					end: r.start,
					color: defaultHighlight,
					fontWeight: weight,
					painted: false,
				});
			}
			cursor = Math.max(cursor, r.end);
		}
		if (cursor < plainEnd) {
			next.push({
				start: cursor,
				end: plainEnd,
				color: defaultHighlight,
				fontWeight: weight,
				painted: false,
			});
		}
	}

	next.sort((a, b) => a.start - b.start || a.end - b.end);
	return emitMarkupFromRanges(parsed.plain, next, defaultHighlight);
}

/**
 * Re-wrap highlight phrases from `sourceWithMarkup` if they still appear in `expanded`.
 * Used after text-carousel body expansion so Highlights can stay on while copy gets longer.
 */
export function reapplyHighlightPhrases(
	expanded: string,
	sourceWithMarkup: string,
	defaultHighlight: string = '#F59E0B',
): string {
	if (!expanded || !sourceWithMarkup?.includes('[[')) return expanded;
	const { plain, ranges } = parseHighlightMarkup(sourceWithMarkup, defaultHighlight);
	let out = expanded;
	for (const r of ranges) {
		const phrase = plain.slice(r.start, r.end);
		if (!phrase.trim()) continue;
		const target = stripMarkup(out);
		const idx = target.toLowerCase().indexOf(phrase.toLowerCase());
		if (idx < 0) continue;
		const spec: HighlightSpec = r.markerBg
			? { kind: 'marker', color: r.markerBg }
			: r.gradientFrom && r.gradientTo
				? { kind: 'gradient', from: r.gradientFrom, to: r.gradientTo }
				: r.pattern
					? { kind: 'pattern', name: r.pattern }
					: r.painted === false
						? { kind: 'weight', weight: r.fontWeight }
						: r.color &&
							  normalizePaintColorKey(r.color) !== normalizePaintColorKey(defaultHighlight)
							? { kind: 'color', color: r.color }
							: { kind: 'default' };
		out = applyHighlight(out, idx, idx + phrase.length, spec, defaultHighlight);
		if (r.fontWeight != null && spec.kind !== 'weight') {
			out = applyHighlight(out, idx, idx + phrase.length, { kind: 'weight', weight: r.fontWeight }, defaultHighlight);
		}
	}
	return out;
}

function rangeFromSpec(
	start: number,
	end: number,
	spec: HighlightSpec,
	defaultHighlight: string,
): HighlightRange {
	switch (spec.kind) {
		case 'color':    return { start, end, color: spec.color, painted: true };
		case 'gradient': return { start, end, color: spec.from, gradientFrom: spec.from, gradientTo: spec.to, painted: true };
		case 'pattern':  return { start, end, color: defaultHighlight, pattern: spec.name, patternImage: getPatternImage(spec.name), painted: true };
		case 'marker':   return { start, end, color: defaultHighlight, markerBg: spec.color, painted: true };
		case 'default':
		case 'clear':
		default:         return { start, end, color: defaultHighlight, painted: true };
	}
}

/** Re-emit a parsed range as `[[…]]` markup, picking the right spec form (marker / grad / pattern / #hex / default). */
function emitRangeMarkup(range: HighlightRange, phrase: string, defaultHighlight: string): string {
	const weight = normalizeInlineFontWeight(range.fontWeight);
	const painted = range.painted !== false;
	let inner = phrase;
	if (range.markerBg) inner = `marker(${range.markerBg}): ${phrase}`;
	else if (range.gradientFrom && range.gradientTo) inner = `grad(${range.gradientFrom},${range.gradientTo}): ${phrase}`;
	else if (range.pattern) inner = `pattern(${range.pattern}): ${phrase}`;
	else if (range.color && normalizePaintColorKey(range.color) !== normalizePaintColorKey(defaultHighlight)) {
		inner = `${range.color}: ${phrase}`;
	} else if (painted && weight != null) {
		inner = `hl: ${phrase}`;
	}
	if (weight != null) inner = `w(${weight}): ${inner}`;
	else if (!painted) return phrase;
	return `[[${inner}]]`;
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
		const weight = normalizeInlineFontWeight(r.fontWeight);
		if (r.painted === false && weight == null) continue;
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

/** Normalize hex / color tokens for swatch equality (`#abc` → `#aabbcc`). */
export function normalizePaintColorKey(c: string): string {
	const s = c.trim().toLowerCase();
	if (!s.startsWith('#')) return s;
	if (s.length === 4) {
		return `#${s[1]}${s[1]}${s[2]}${s[2]}${s[3]}${s[3]}`;
	}
	return s;
}

/**
 * Drop `[[marker(#hex): …]]` background chips; keep color / gradient / pattern highlights.
 * Used when the toolbar applies a *block* `bgColor` so canvas + chip share one source of truth.
 */
export function stripMarkerBackgrounds(
	raw: string,
	defaultHighlight: string | HighlightDefaults = '#F59E0B',
): string {
	const defaults = normalizeHighlightDefaults(defaultHighlight);
	const parsed = parseHighlightMarkup(raw, defaults);
	const kept = parsed.ranges.filter((r) => !String(r.markerBg ?? '').trim());
	if (kept.length === parsed.ranges.length) return raw;
	return emitMarkupFromRanges(parsed.plain, kept, defaults.color);
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
			if (seg.painted !== false && (seg.gradientFrom || seg.gradientTo || seg.patternImage)) return true;
			const fill = seg.highlighted && seg.painted !== false
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
			if (seg.painted === false) samples.push(blockInk);
			else if (seg.gradientFrom || seg.gradientTo || seg.patternImage) return undefined;
			else if (seg.markerBg) samples.push(markerChipInk);
			else if (seg.highlighted && seg.painted !== false) samples.push(seg.color ?? defaultHighlight);
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

/** What the floating toolbar should show as the selection’s actual fill (not brand default). */
export type RangePaintInspection = {
	styleKind: 'solid' | 'gradient' | 'pattern' | 'none';
	/** Solid highlight / block ink for the swatch when styleKind is solid or none. */
	color?: string;
	pattern?: string;
	gradientFrom?: string;
	gradientTo?: string;
	/** Uniform `[[marker(#hex)]]` background in the range, if any. */
	markerBg?: string;
};

/**
 * Inspect a plain-text selection for a single uniform paint (color / gradient / pattern / marker).
 * Mixed paints → `styleKind: 'none'` with no extras (caller falls back to brand / block style).
 */
export function inspectPlainRangePaint(
	raw: string,
	plainStart: number,
	plainEnd: number,
	defaultHighlight: string | HighlightDefaults,
	blockInk: string,
): RangePaintInspection {
	if (plainStart === plainEnd) return { styleKind: 'none' };
	let a = plainStart;
	let b = plainEnd;
	if (a > b) [a, b] = [b, a];

	const defaults = normalizeHighlightDefaults(defaultHighlight);
	const parsed = parseHighlightMarkup(raw, defaults);
	const segs = segmentText(parsed);

	type Sample = {
		kind: 'none' | 'solid' | 'gradient' | 'pattern';
		color?: string;
		pattern?: string;
		gradientFrom?: string;
		gradientTo?: string;
		markerBg?: string;
	};
	const samples: Sample[] = [];
	let pos = 0;

	for (const seg of segs) {
		const segEnd = pos + seg.text.length;
		const lo = Math.max(a, pos);
		const hi = Math.min(b, segEnd);
		if (lo < hi) {
			const markerBg = String(seg.markerBg ?? '').trim() || undefined;
			if (seg.painted === false) {
				samples.push({ kind: 'none', color: blockInk, markerBg });
			} else if (seg.pattern || seg.patternImage) {
				samples.push({
					kind: 'pattern',
					pattern: String(seg.pattern ?? '').toLowerCase() || undefined,
					color: seg.color ?? defaults.color,
					markerBg,
				});
			} else if (seg.gradientFrom && seg.gradientTo) {
				samples.push({
					kind: 'gradient',
					gradientFrom: seg.gradientFrom,
					gradientTo: seg.gradientTo,
					color: seg.gradientFrom,
					markerBg,
				});
			} else if (seg.highlighted) {
				samples.push({
					kind: 'solid',
					color: seg.color ?? defaults.color,
					markerBg,
				});
			} else {
				samples.push({ kind: 'none', color: blockInk, markerBg });
			}
		}
		pos = segEnd;
	}

	if (samples.length === 0) return { styleKind: 'none' };

	const first = samples[0]!;
	const sameKind = samples.every((s) => s.kind === first.kind);
	if (!sameKind) return { styleKind: 'none' };

	const markers = samples.map((s) => normalizePaintColorKey(s.markerBg ?? ''));
	const uniformMarker =
		markers.every((m) => m === markers[0]) && markers[0] ? samples[0]!.markerBg : undefined;

	if (first.kind === 'pattern') {
		const pat = String(first.pattern ?? '').toLowerCase();
		if (!pat || !samples.every((s) => String(s.pattern ?? '').toLowerCase() === pat)) {
			return { styleKind: 'none', markerBg: uniformMarker };
		}
		return { styleKind: 'pattern', pattern: pat, color: first.color, markerBg: uniformMarker };
	}

	if (first.kind === 'gradient') {
		const from = normalizePaintColorKey(first.gradientFrom ?? '');
		const to = normalizePaintColorKey(first.gradientTo ?? '');
		if (
			!from ||
			!to ||
			!samples.every(
				(s) =>
					normalizePaintColorKey(s.gradientFrom ?? '') === from &&
					normalizePaintColorKey(s.gradientTo ?? '') === to,
			)
		) {
			return { styleKind: 'none', markerBg: uniformMarker };
		}
		return {
			styleKind: 'gradient',
			gradientFrom: first.gradientFrom,
			gradientTo: first.gradientTo,
			color: first.gradientFrom,
			markerBg: uniformMarker,
		};
	}

	if (first.kind === 'solid') {
		const c = normalizePaintColorKey(first.color ?? '');
		if (!c || !samples.every((s) => normalizePaintColorKey(s.color ?? '') === c)) {
			return { styleKind: 'none', markerBg: uniformMarker };
		}
		return { styleKind: 'solid', color: first.color, markerBg: uniformMarker };
	}

	// Unmarked body text
	const c = normalizePaintColorKey(first.color ?? '');
	if (!c || !samples.every((s) => normalizePaintColorKey(s.color ?? '') === c)) {
		return { styleKind: 'none', markerBg: uniformMarker };
	}
	return { styleKind: 'none', color: first.color, markerBg: uniformMarker };
}

/**
 * Uniform inline `[[w(N): …]]` weight in a plain-text selection.
 * Inherit / mixed / empty → undefined (toolbar should show the block weight).
 */
export function inspectPlainRangeWeight(
	raw: string,
	plainStart: number,
	plainEnd: number,
	defaultHighlight: string | HighlightDefaults = '#F59E0B',
): number | undefined {
	if (plainStart === plainEnd) return undefined;
	let a = plainStart;
	let b = plainEnd;
	if (a > b) [a, b] = [b, a];
	const segs = segmentText(parseHighlightMarkup(raw, defaultHighlight));
	const weights: Array<number | null> = [];
	let pos = 0;
	for (const seg of segs) {
		const segEnd = pos + seg.text.length;
		const lo = Math.max(a, pos);
		const hi = Math.min(b, segEnd);
		if (lo < hi) weights.push(seg.fontWeight ?? null);
		pos = segEnd;
	}
	if (weights.length === 0) return undefined;
	const first = weights[0];
	if (first == null) return undefined;
	if (!weights.every((w) => w === first)) return undefined;
	return first;
}

/** Foreground + weight CSS for HTML overlay renderers. */
export function highlightForegroundCss(
	seg: Pick<TextSegment, 'color' | 'fontWeight' | 'painted'>,
): string {
	const w = highlightWeightCss(seg.fontWeight);
	if (seg.painted === false) return `color: inherit; ${w}`;
	return `color: ${seg.color}; ${w}`;
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
