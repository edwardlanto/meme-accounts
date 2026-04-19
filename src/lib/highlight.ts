/** Parses [[...]] highlight markup from AI-generated text */

export interface HighlightRange {
	start: number;
	end: number;
	color: string;
	gradientFrom?: string;
	gradientTo?: string;
	pattern?: 'waves' | 'noise';
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
	pattern?: 'waves' | 'noise';
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
		let pattern: 'waves' | 'noise' | undefined;

		// pattern(waves|noise, #hex): phrase
		const patternRe = /^pattern\(\s*(waves|noise)\s*,\s*(#[0-9a-fA-F]{6})\s*\)\s*:\s*(.+)$/i;
		const pm = inner.match(patternRe);
		if (pm) {
			pattern = pm[1] as 'waves' | 'noise';
			color = pm[2];
			phrase = pm[3].trim();
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
		ranges.push({ start, end: plain.length, color, gradientFrom, gradientTo, pattern });
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
