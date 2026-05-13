// Satoshi + Impact are local/system. Other entries load from Google Fonts on demand.

export type FontCategory = 'sans' | 'serif' | 'display' | 'handwriting' | 'mono';

export type GoogleFont = {
	family: string;
	category: FontCategory;
	weights: number[];
	italic?: boolean;
};

export const GOOGLE_FONTS: GoogleFont[] = [
	{ family: 'Satoshi', category: 'sans', weights: [300, 400, 500, 700, 900], italic: true },
	/** Text carousel body + tweet template — variable axis */
	{ family: 'Lexend', category: 'sans', weights: [400] },
	{ family: 'Impact', category: 'display', weights: [400] },
	/** News-style headlines — lighter than Impact at the same weight */
	{ family: 'Bebas Neue', category: 'sans', weights: [400] },
];

const loadedFonts = new Set<string>();
const loadPromises = new Map<string, Promise<void>>();

function buildCssUrl(font: GoogleFont): string {
	const family = font.family.replace(/\s+/g, '+');
	if (font.family === 'Lexend') {
		return `https://fonts.googleapis.com/css2?family=${family}:wght@100..900&display=swap`;
	}
	const weights = font.weights.length ? font.weights : [400];
	if (font.italic) {
		const axis = weights.flatMap((w) => [`0,${w}`, `1,${w}`]).join(';');
		return `https://fonts.googleapis.com/css2?family=${family}:ital,wght@${axis}&display=swap`;
	}
	const axis = weights.join(';');
	return `https://fonts.googleapis.com/css2?family=${family}:wght@${axis}&display=swap`;
}

async function ensureFontFaceReady(family: string, weight: number): Promise<void> {
	try {
		if ((document as any).fonts?.load) {
			await (document as any).fonts.load(`${weight} 72px "${family}"`);
		}
	} catch {
		/* ignore */
	}
}

function scheduleFontFaceHint(family: string, weight: number): void {
	queueMicrotask(() => void ensureFontFaceReady(family, weight));
}

function injectStylesheet(family: string, href: string): Promise<void> {
	return new Promise((resolve) => {
		if (document.querySelector(`link[data-gfont="${family}"]`)) {
			resolve();
			return;
		}
		const link = document.createElement('link');
		link.rel = 'stylesheet';
		link.href = href;
		link.setAttribute('data-gfont', family);
		link.onload = () => resolve();
		link.onerror = () => resolve();
		document.head.appendChild(link);
	});
}

/**
 * Ensure a font is ready for paint: self-hosted / system faces are hinted only;
 * Google Fonts families get a stylesheet injected once.
 */
export function loadGoogleFont(family: string, weightHint?: number): Promise<void> {
	if (typeof document === 'undefined') return Promise.resolve();
	const w = weightHint ?? 400;

	if (family === 'Impact' || family === 'Arial Black') {
		scheduleFontFaceHint(family, w);
		return Promise.resolve();
	}
	if (family === 'Satoshi') {
		scheduleFontFaceHint('Satoshi', w);
		return Promise.resolve();
	}

	const font = GOOGLE_FONTS.find((f) => f.family === family);
	if (!font) {
		scheduleFontFaceHint(family, w);
		return Promise.resolve();
	}

	if (loadedFonts.has(family)) {
		scheduleFontFaceHint(family, w);
		return Promise.resolve();
	}
	if (loadPromises.has(family)) {
		return loadPromises.get(family)!.then(() => {
			scheduleFontFaceHint(family, w);
		});
	}

	const p = injectStylesheet(family, buildCssUrl(font)).then(() => {
		loadedFonts.add(family);
		scheduleFontFaceHint(family, w);
	});
	loadPromises.set(family, p);
	return p;
}

export function fontsByCategory(): Record<FontCategory, GoogleFont[]> {
	const out: Record<FontCategory, GoogleFont[]> = {
		sans: [],
		serif: [],
		display: [],
		handwriting: [],
		mono: [],
	};
	for (const f of GOOGLE_FONTS) out[f.category].push(f);
	return out;
}

export const CATEGORY_LABELS: Record<FontCategory, string> = {
	sans: 'Sans Serif',
	serif: 'Serif',
	display: 'Display',
	handwriting: 'Handwriting',
	mono: 'Monospace',
};
