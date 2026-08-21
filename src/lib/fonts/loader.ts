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
 * anti-fingerprinting. Anton is the Google stand-in we actually load.
 */
export const IMPACT_WEBFONT_STANDIN = 'Anton';

export const GOOGLE_FONTS: GoogleFont[] = [
	/* Brand + defaults */
	{ family: FONT_TEMPLATE_DEFAULT, category: 'sans', weights: [300, 400, 500, 700, 800], italic: true },
	{ family: FONT_BODY, category: 'sans', weights: [400, 500, 600, 700], italic: true },
	{ family: 'Lexend', category: 'sans', weights: [400, 500, 700] },
	{ family: 'Montserrat', category: 'sans', weights: [400, 500, 700, 900], italic: true },
	{ family: 'Poppins', category: 'sans', weights: [400, 500, 600, 700, 900], italic: true },
	{ family: 'Oswald', category: 'sans', weights: [400, 500, 700] },
	{ family: 'Bebas Neue', category: 'display', weights: [400] },
	{ family: 'DM Sans', category: 'sans', weights: [400, 500, 700, 900], italic: true },
	{ family: 'Space Grotesk', category: 'sans', weights: [400, 500, 700] },

	/* Faceless / viral niche — condensed & clean sans (news, hooks, captions) */
	{ family: 'Barlow Condensed', category: 'sans', weights: [400, 500, 600, 700, 800, 900], italic: true },
	{ family: 'Barlow', category: 'sans', weights: [400, 500, 600, 700, 800, 900], italic: true },
	{ family: 'Roboto Condensed', category: 'sans', weights: [400, 500, 700], italic: true },
	{ family: 'Teko', category: 'sans', weights: [400, 500, 600, 700] },
	{ family: 'Fjalla One', category: 'sans', weights: [400] },
	{ family: 'Chivo', category: 'sans', weights: [400, 700, 900], italic: true },
	{ family: 'Kanit', category: 'sans', weights: [400, 500, 600, 700, 800, 900], italic: true },
	{ family: 'League Spartan', category: 'sans', weights: [400, 500, 700, 800, 900] },
	{ family: 'Rubik', category: 'sans', weights: [400, 500, 600, 700, 800, 900], italic: true },
	{ family: 'Outfit', category: 'sans', weights: [400, 500, 600, 700, 800, 900] },
	{ family: 'Manrope', category: 'sans', weights: [400, 500, 600, 700, 800] },
	{ family: 'Nunito Sans', category: 'sans', weights: [400, 600, 700, 800, 900], italic: true },
	{ family: 'Figtree', category: 'sans', weights: [400, 500, 600, 700, 800, 900], italic: true },

	/* Heavy display — meme / all-caps hooks (Impact-style) */
	{ family: IMPACT_WEBFONT_STANDIN, category: 'display', weights: [400] },
	{ family: 'Impact', category: 'display', weights: [400] },
	{ family: 'Archivo Black', category: 'display', weights: [400] },
	{ family: 'Staatliches', category: 'display', weights: [400] },
	{ family: 'Russo One', category: 'display', weights: [400] },
	{ family: 'Passion One', category: 'display', weights: [400, 700, 900] },
	{ family: 'Alfa Slab One', category: 'display', weights: [400] },
	{ family: 'Black Ops One', category: 'display', weights: [400] },
	{ family: 'Titan One', category: 'display', weights: [400] },
	{ family: 'Lilita One', category: 'display', weights: [400] },
	{ family: 'Bangers', category: 'display', weights: [400] },
	{ family: 'Luckiest Guy', category: 'display', weights: [400] },

	/* Serif — quote / story / editorial carousels */
	{ family: 'Playfair Display', category: 'serif', weights: [400, 500, 700, 900], italic: true },
	{ family: 'DM Serif Display', category: 'serif', weights: [400], italic: true },
	{ family: 'Lora', category: 'serif', weights: [400, 500, 700], italic: true },
	{ family: 'Instrument Serif', category: 'serif', weights: [400], italic: true },
	{ family: 'Merriweather', category: 'serif', weights: [400, 700, 900], italic: true },
	{ family: 'Libre Baskerville', category: 'serif', weights: [400, 700], italic: true },
	{ family: 'Roboto Slab', category: 'serif', weights: [400, 500, 700, 900] },

	/* Handwriting — casual faceless / story beats */
	{ family: 'Caveat', category: 'handwriting', weights: [400, 600, 700] },
	{ family: 'Permanent Marker', category: 'handwriting', weights: [400] },
	{ family: 'Patrick Hand', category: 'handwriting', weights: [400] },
	{ family: 'Kalam', category: 'handwriting', weights: [400, 700] },

	{ family: 'IBM Plex Mono', category: 'mono', weights: [400, 500, 700] },
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
	if (font.family === FONT_TEMPLATE_DEFAULT) {
		return `https://fonts.googleapis.com/css2?family=${family}:ital,wght@0,200..800;1,200..800&display=swap`;
	}
	const weights = font.weights.length ? font.weights : [400];
	if (font.italic) {
		const axis = weights.flatMap((w) => [`0,${w}`, `1,${w}`]).join(';');
		return `https://fonts.googleapis.com/css2?family=${family}:ital,wght@${axis}&display=swap`;
	}
	if (weights.length === 1 && weights[0] === 400) {
		return `https://fonts.googleapis.com/css2?family=${family}&display=swap`;
	}
	const axis = weights.join(';');
	return `https://fonts.googleapis.com/css2?family=${family}:wght@${axis}&display=swap`;
}

async function ensureFontFaceReady(family: string, weight: number): Promise<void> {
	try {
		const fonts = document.fonts;
		if (fonts?.load) {
			await fonts.load(`${weight} 72px "${family}"`);
			if (fonts.ready) await fonts.ready;
		}
	} catch {
		/* ignore */
	}
}

function injectStylesheet(family: string, href: string): Promise<boolean> {
	return new Promise((resolve) => {
		if (document.querySelector(`link[data-gfont="${family.replace(/"/g, '')}"]`)) {
			resolve(true);
			return;
		}
		const link = document.createElement('link');
		link.rel = 'stylesheet';
		link.href = href;
		link.setAttribute('data-gfont', family);
		link.onload = () => resolve(true);
		link.onerror = () => resolve(false);
		document.head.appendChild(link);
	});
}

/** Preloaded via app.html — hint only, no extra stylesheet. */
const APP_PRELOADED = new Set([FONT_TEMPLATE_DEFAULT, FONT_BODY, 'Bebas Neue']);

function isLocalOnlyDisplayFont(family: string): boolean {
	return family === 'Impact' || family === 'Arial Black';
}

/**
 * CSS `font-family` value (no property name) for canvas text.
 * Avoids chaining Bebas/Impact as generic fallbacks — those hid failed local fonts
 * so the toolbar label changed but the canvas didn't.
 */
export function canvasFontFamilyStack(family: string): string {
	if (isLocalOnlyDisplayFont(family)) {
		return `"${family}", "${IMPACT_WEBFONT_STANDIN}", system-ui, sans-serif`;
	}
	return `"${family}", system-ui, -apple-system, sans-serif`;
}

export function canvasFontFamilyCss(family: string): string {
	return `font-family: ${canvasFontFamilyStack(family)};`;
}

export function loadGoogleFont(family: string, weightHint?: number): Promise<void> {
	if (typeof document === 'undefined') return Promise.resolve();
	const w = weightHint ?? 400;
	const name = family.trim();
	if (!name) return Promise.resolve();

	if (isLocalOnlyDisplayFont(name)) {
		return loadGoogleFont(IMPACT_WEBFONT_STANDIN, w).then(() => ensureFontFaceReady(name, w));
	}
	if (APP_PRELOADED.has(name)) {
		return ensureFontFaceReady(name, w);
	}

	const font =
		GOOGLE_FONTS.find((f) => f.family === name) ??
		({ family: name, category: 'sans', weights: [400] } satisfies GoogleFont);

	if (loadedFonts.has(name)) {
		return ensureFontFaceReady(name, w);
	}
	const pending = loadPromises.get(name);
	if (pending) return pending.then(() => ensureFontFaceReady(name, w));

	const p = injectStylesheet(name, buildCssUrl(font)).then(async (ok) => {
		await ensureFontFaceReady(name, w);
		if (ok) loadedFonts.add(name);
		else loadPromises.delete(name);
	});
	loadPromises.set(name, p);
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
