import { stripMarkup } from '$lib/highlight';

/** Layout constants matching TextCarouselTemplate (1080×1350 design). */
export const TEXT_CAROUSEL_BODY_LAYOUT = {
	contentWidthPx: 904,
	bodyMaxHeightPx: 980,
	minFontPx: 30,
	maxFontPx: 72,
	lineHeight: 1.48,
	/** Extra blank-line feel between paragraphs (in em of line-height). */
	paragraphGapEm: 0.9,
} as const;

/** Random integer in [min, max] inclusive. Default 2–3 so slides breathe. */
export function randomParagraphCount(min = 2, max = 3): number {
	const lo = Math.max(1, Math.min(min, max));
	const hi = Math.max(lo, Math.max(min, max));
	return lo + Math.floor(Math.random() * (hi - lo + 1));
}

/**
 * Split on blank lines; if the source is one blob, break into short paragraphs
 * on sentence boundaries (never a single wall of text when 2+ sentences exist —
 * unless `maxParagraphs` is 1, e.g. Studio Short).
 */
export function splitTextCarouselParagraphs(
	raw: string,
	opts?: { maxParagraphs?: number },
): string[] {
	const maxParas = Math.max(1, Math.min(3, Math.floor(opts?.maxParagraphs ?? 3)));
	let s = stripMarkup(String(raw ?? ''))
		.replace(/\r\n/g, '\n')
		.replace(/[ \t]+\n/g, '\n')
		.replace(/\n{3,}/g, '\n\n')
		.trim();
	if (!s) return [];

	let paras = s.split(/\n\s*\n+/).map((p) => p.trim()).filter(Boolean);
	if (paras.length > 1) return paras.slice(0, maxParas);

	// Short / single-para budgets: keep one block, don't invent spacing.
	if (maxParas <= 1) return paras.length ? paras.slice(0, 1) : [s];

	const sentences = s
		.replace(/\n+/g, ' ')
		.split(/(?<=[.!?])\s+/)
		.map((x) => x.trim())
		.filter(Boolean);
	if (sentences.length <= 1) return paras.length ? paras : [s];

	// Prefer spaced slides: at least 2 paragraphs whenever we have 2+ sentences.
	const want = Math.min(maxParas, Math.max(2, randomParagraphCount(2, Math.min(3, maxParas))));
	const per = Math.max(1, Math.ceil(sentences.length / want));
	const out: string[] = [];
	for (let i = 0; i < sentences.length; i += per) {
		out.push(sentences.slice(i, i + per).join(' '));
	}
	return out.slice(0, maxParas);
}

/** Keep the first `count` paragraphs (1–3). */
export function takeParagraphCount(paras: string[], count: number): string[] {
	const n = Math.max(1, Math.min(3, Math.floor(count)));
	return paras.slice(0, n);
}

export function joinTextCarouselParagraphs(paras: string[]): string {
	return paras
		.map((p) => p.trim())
		.filter(Boolean)
		.join('\n\n');
}

/** Rough chars-per-line for Lexend at a given size (conservative). */
function charsPerLine(fontPx: number): number {
	return Math.max(18, Math.floor(TEXT_CAROUSEL_BODY_LAYOUT.contentWidthPx / (fontPx * 0.48)));
}

/** Estimated total body height in px at `fontPx`. */
export function estimateTextCarouselBodyHeightPx(body: string, fontPx: number): number {
	const { lineHeight, paragraphGapEm } = TEXT_CAROUSEL_BODY_LAYOUT;
	const paras = splitTextCarouselParagraphs(body);
	if (!paras.length) return 0;
	const cpl = charsPerLine(fontPx);
	const lineH = fontPx * lineHeight;
	let lines = 0;
	for (let i = 0; i < paras.length; i++) {
		const compact = paras[i]!.replace(/\s+/g, ' ').trim();
		lines += Math.max(1, Math.ceil(compact.length / cpl));
		if (i < paras.length - 1) lines += paragraphGapEm;
	}
	return lines * lineH;
}

/** Largest font size that keeps body within the card text area (or min font). */
export function autoTextCarouselFontPx(body: string, toolbarFontPx?: number | null): number {
	if (toolbarFontPx != null && Number.isFinite(toolbarFontPx) && toolbarFontPx > 0) {
		return toolbarFontPx;
	}
	const { minFontPx, maxFontPx, bodyMaxHeightPx } = TEXT_CAROUSEL_BODY_LAYOUT;
	for (let font = maxFontPx; font >= minFontPx; font -= 2) {
		if (estimateTextCarouselBodyHeightPx(body, font) <= bodyMaxHeightPx) return font;
	}
	return minFontPx;
}

/**
 * Map Studio word-count chip (Short≈12 / Standard≈28 / Default≈52 on carousel) onto
 * paragraph count + per-para budgets for text-carousel body copy.
 */
export type TextCarouselCopyBudget = {
	paragraphCount: number;
	maxWordsTotal: number;
	maxWordsPerPara: number;
};

/** Default chip for text carousel: longer than Standard (28), two distinct paragraphs. */
export const TEXT_CAROUSEL_DEFAULT_BODY_WORDS = 52;

export function textCarouselBudgetFromMaxWords(maxWords?: number | null): TextCarouselCopyBudget {
	const w = Math.floor(Number(maxWords));
	const capped = Number.isFinite(w) && w > 0 ? Math.max(6, Math.min(120, w)) : 56;
	// Short — one tight punchline, not a wall of text. Studio Short chip is 18 words.
	if (capped <= 20) {
		return { paragraphCount: 1, maxWordsTotal: capped, maxWordsPerPara: capped };
	}
	// Standard — two short beats.
	if (capped <= 36) {
		const per = Math.max(8, Math.ceil(capped / 2) + 1);
		return { paragraphCount: 2, maxWordsTotal: capped, maxWordsPerPara: per };
	}
	// Default / longer — airy 2–3 paragraphs.
	if (capped <= 64) {
		const per = Math.max(14, Math.ceil(capped / 2) + 2);
		return { paragraphCount: 2, maxWordsTotal: capped, maxWordsPerPara: per };
	}
	const per = Math.max(16, Math.ceil(capped / 3) + 4);
	return { paragraphCount: 3, maxWordsTotal: capped, maxWordsPerPara: per };
}

function trimParaToWordBudget(p: string, maxWords: number): string {
	const words = p.trim().split(/\s+/).filter(Boolean);
	if (words.length <= maxWords) return p.trim();
	const sliced = words.slice(0, maxWords).join(' ');
	const end = Math.max(
		sliced.lastIndexOf('. '),
		sliced.lastIndexOf('! '),
		sliced.lastIndexOf('? '),
	);
	if (end >= Math.floor(sliced.length * 0.35)) {
		return sliced.slice(0, end + 1).trim();
	}
	return sliced.trim();
}

function clampJoinedToTotalWords(
	joined: string,
	maxWordsTotal: number,
	maxParagraphs?: number,
): string {
	const paras = splitTextCarouselParagraphs(joined, { maxParagraphs });
	if (!paras.length) return '';
	let used = 0;
	const out: string[] = [];
	for (const p of paras) {
		const left = maxWordsTotal - used;
		if (left <= 0) break;
		const next = trimParaToWordBudget(p, left);
		if (!next) break;
		out.push(next);
		used += next.split(/\s+/).filter(Boolean).length;
	}
	return joinTextCarouselParagraphs(out);
}

/**
 * Keep unique paragraphs only — never clone the last one to hit a count.
 * Optionally pull extra distinct sentences from `fallbackSource`.
 */
export function uniqueTextCarouselParagraphs(
	paragraphs: string[],
	want: number,
	fallbackSource?: string,
): string[] {
	const n = Math.max(1, Math.min(3, Math.floor(want)));
	const norm = (s: string) => s.replace(/\s+/g, ' ').trim().toLowerCase();
	const seen: string[] = [];
	const out: string[] = [];
	const push = (raw: string): boolean => {
		const t = String(raw ?? '').replace(/\s+/g, ' ').trim();
		const k = norm(t);
		if (!t || k.length < 8) return false;
		if (seen.some((s) => s === k || s.includes(k) || k.includes(s))) return false;
		seen.push(k);
		out.push(t);
		return true;
	};
	for (const p of paragraphs) {
		if (out.length >= n) break;
		push(p);
	}
	if (out.length < n && fallbackSource) {
		const extras = String(fallbackSource)
			.replace(/\r\n/g, '\n')
			.split(/(?<=[.!?])\s+/)
			.map((s) => s.trim())
			.filter(Boolean);
		for (const s of extras) {
			if (out.length >= n) break;
			push(s);
		}
	}
	return out;
}

/** Trim from the end until the body fits at min font size. Never use ellipsis. */
export function fitTextCarouselBodyToCanvas(
	raw: string,
	opts?: {
		randomizeParagraphCount?: boolean;
		/** Hard cap across the whole slide (Studio Short / Standard / Default). */
		maxWordsTotal?: number;
		/** Force paragraph count (1–3). */
		maxParagraphs?: number;
	},
): string {
	const budget =
		opts?.maxWordsTotal != null && opts.maxWordsTotal > 0
			? textCarouselBudgetFromMaxWords(opts.maxWordsTotal)
			: null;

	let want: number;
	if (typeof opts?.maxParagraphs === 'number' && opts.maxParagraphs >= 1) {
		want = Math.min(3, Math.max(1, Math.floor(opts.maxParagraphs)));
	} else if (budget) {
		want = budget.paragraphCount;
	} else if (opts?.randomizeParagraphCount === false) {
		want = 3;
	} else {
		want = randomParagraphCount(2, 3);
	}

	let paras = splitTextCarouselParagraphs(raw, { maxParagraphs: want });
	if (!paras.length) return '';
	// Don't invent empty paras — only keep what we have, capped by budget.
	want = Math.min(want, Math.max(1, paras.length));
	paras = takeParagraphCount(paras, want);

	const { minFontPx, bodyMaxHeightPx } = TEXT_CAROUSEL_BODY_LAYOUT;
	const maxWordsPerPara =
		budget?.maxWordsPerPara ?? (want === 1 ? 70 : want === 2 ? 48 : 38);
	const maxWordsTotal = budget?.maxWordsTotal;

	let guard = 0;
	while (guard++ < 40) {
		paras = paras.map((p) => trimParaToWordBudget(p, maxWordsPerPara));
		let joined = joinTextCarouselParagraphs(paras);
		if (maxWordsTotal != null) {
			joined = clampJoinedToTotalWords(joined, maxWordsTotal, want);
		}
		paras = splitTextCarouselParagraphs(joined, { maxParagraphs: want });
		if (estimateTextCarouselBodyHeightPx(joined, minFontPx) <= bodyMaxHeightPx) {
			return joined;
		}
		if (paras.length > 1) {
			paras = paras.slice(0, -1);
			want = paras.length;
			continue;
		}
		const words = paras[0]!.split(/\s+/).filter(Boolean);
		if (words.length <= 8) break;
		paras = [words.slice(0, Math.max(8, words.length - 6)).join(' ')];
	}

	let out = joinTextCarouselParagraphs(paras);
	if (maxWordsTotal != null) out = clampJoinedToTotalWords(out, maxWordsTotal, want);
	return out;
}
