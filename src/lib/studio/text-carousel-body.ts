import { stripMarkup } from '$lib/highlight';

/** Layout constants matching TextCarouselTemplate (1080×1350 design). */
export const TEXT_CAROUSEL_BODY_LAYOUT = {
	contentWidthPx: 904,
	bodyMaxHeightPx: 900,
	minFontPx: 30,
	maxFontPx: 72,
	lineHeight: 1.38,
	paragraphGapEm: 0.55,
} as const;

/** Random integer in [min, max] inclusive. */
export function randomParagraphCount(min = 1, max = 3): number {
	return min + Math.floor(Math.random() * (max - min + 1));
}

/** Split on blank lines; fall back to sentence groups when source is one blob. */
export function splitTextCarouselParagraphs(raw: string): string[] {
	let s = stripMarkup(String(raw ?? ''))
		.replace(/\r\n/g, '\n')
		.replace(/[ \t]+\n/g, '\n')
		.replace(/\n{3,}/g, '\n\n')
		.trim();
	if (!s) return [];

	let paras = s.split(/\n\s*\n+/).map((p) => p.trim()).filter(Boolean);
	if (paras.length > 1) return paras;

	const sentences = s
		.replace(/\n+/g, ' ')
		.split(/(?<=[.!?])\s+/)
		.map((x) => x.trim())
		.filter(Boolean);
	if (sentences.length <= 1) return paras.length ? paras : [s];

	const want = randomParagraphCount(1, 3);
	const per = Math.max(1, Math.ceil(sentences.length / want));
	const out: string[] = [];
	for (let i = 0; i < sentences.length; i += per) {
		out.push(sentences.slice(i, i + per).join(' '));
	}
	return out.slice(0, 3);
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

/** Trim from the end until the body fits at min font size. */
export function fitTextCarouselBodyToCanvas(
	raw: string,
	opts?: { randomizeParagraphCount?: boolean },
): string {
	let paras = splitTextCarouselParagraphs(raw);
	if (!paras.length) return '';

	const want =
		opts?.randomizeParagraphCount === false
			? Math.min(3, paras.length)
			: randomParagraphCount(1, Math.min(3, paras.length));
	paras = takeParagraphCount(paras, want);

	const { minFontPx, bodyMaxHeightPx } = TEXT_CAROUSEL_BODY_LAYOUT;

	const trimParaWords = (p: string, maxWords: number) => {
		const words = p.trim().split(/\s+/).filter(Boolean);
		if (words.length <= maxWords) return p.trim();
		return `${words.slice(0, maxWords).join(' ').trimEnd()}…`;
	};

	const maxWordsPerPara = want === 1 ? 95 : want === 2 ? 72 : 58;

	let guard = 0;
	while (guard++ < 40) {
		paras = paras.map((p) => trimParaWords(p, maxWordsPerPara));
		const joined = joinTextCarouselParagraphs(paras);
		if (estimateTextCarouselBodyHeightPx(joined, minFontPx) <= bodyMaxHeightPx) {
			return joined;
		}
		if (paras.length > 1) {
			paras = paras.slice(0, -1);
			continue;
		}
		const words = paras[0]!.split(/\s+/).filter(Boolean);
		if (words.length <= 12) break;
		paras = [words.slice(0, Math.max(12, words.length - 8)).join(' ')];
	}

	return joinTextCarouselParagraphs(paras);
}
