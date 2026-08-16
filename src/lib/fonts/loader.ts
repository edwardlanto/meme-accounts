import { FONT_BODY, FONT_TEMPLATE_DEFAULT } from './brand-fonts';

/** Google Fonts loader + picker catalog. Brand names: see `./brand-fonts.ts`. */

export type FontCategory = 'sans' | 'serif' | 'display' | 'handwriting' | 'mono';

export type GoogleFont = {
	family: string;
	category: FontCategory;
	weights: number[];
	italic?: boolean;
};

/**
 * Local-only faces (Impact, Arial Black) are often blocked by browser
 * anti-fingerprinting — Studio would keep showing Bebas/system and look like
 * font-family “does nothing”. Anton is the Google stand-in we actually load.
 */
export const IMPACT_WEBFONT_STANDIN = 'Anton';

export const GOOGLE_FONTS: GoogleFont[] = [
	{ family: FONT_TEMPLATE_DEFAULT, category: 'sans', weights: [300, 400, 500, 700, 900], italic: true },
	{ family: FONT_BODY, category: 'sans', weights: [400, 500, 600, 700], italic: true },
	{ family: 'Lexend', category: 'sans', weights: [400] },
	{ family: 'Impact', category: 'display', weights: [400] },
	{ family: IMPACT_WEBFONT_STANDIN, category: 'display', weights: [400] },
	{ family: 'Bebas Neue', category: 'sans', weights: [400] },
	{ family: 'Montserrat', category: 'sans', weights: [400, 500, 600] },
];

const loadedFonts = new Set<string>();
const loadPromises = new Map<string, Promise<void>>();

function buildCssUrl(font: GoogleFont): string {
	const family = font.family.replace(/\s+/g, '+');
	if (font.family === 'Lexend') {
		return `https://fonts.googleapis.com/css2?family=${family}:wght@100..900&display=swap`;
	}
	if (font.family === FONT_BODY) {
		return `https://fonts.googleapis.com/css2?family=${family}:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&display=swap`;
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

/** Preloaded via app.html — hint only, no extra stylesheet. */
const APP_PRELOADED = new Set([FONT_TEMPLATE_DEFAULT, FONT_BODY]);

function isLocalOnlyDisplayFont(family: string): boolean {
	return family === 'Impact' || family === 'Arial Black';
}

/**
 * CSS `font-family` value (no property name) for canvas text.
 * Avoids chaining Bebas/Impact as generic fallbacks — those hid failed local fonts
 * (Impact often blocked) so the toolbar label changed but the canvas didn't.
 */
export function canvasFontFamilyStack(family: string): string {
	if (isLocalOnlyDisplayFont(family)) {
		return `${family}, '${IMPACT_WEBFONT_STANDIN}', system-ui, sans-serif`;
	}
	return `'${family}', system-ui, -apple-system, sans-serif`;
}

export function canvasFontFamilyCss(family: string): string {
	return `font-family: ${canvasFontFamilyStack(family)};`;
}

export function loadGoogleFont(family: string, weightHint?: number): Promise<void> {
	if (typeof document === 'undefined') return Promise.resolve();
	const w = weightHint ?? 400;

	if (isLocalOnlyDisplayFont(family)) {
		scheduleFontFaceHint(family, w);
		// Always pull the webfont stand-in so the picker choice is visible.
		return loadGoogleFont(IMPACT_WEBFONT_STANDIN, w);
	}
	if (APP_PRELOADED.has(family)) {
		scheduleFontFaceHint(family, w);
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
