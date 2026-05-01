// Curated list of popular Google Fonts grouped by style.
// Using the CSS API (no API key required). Fonts load lazily when selected.

export type FontCategory = 'sans' | 'serif' | 'display' | 'handwriting' | 'mono';

export type GoogleFont = {
	family: string;
	category: FontCategory;
	weights: number[]; // weights to request from Google Fonts CSS API
	italic?: boolean;
};

export const GOOGLE_FONTS: GoogleFont[] = [
	// ── Sans (workhorse UI + body) ─────────────────────────────────────
	/** App / studio default sans — variable weight axis (see `buildCssUrl`). */
	{ family: 'Lexend', category: 'sans', weights: [400] },
	{ family: 'Inter', category: 'sans', weights: [400, 500, 600, 700, 900], italic: true },
	{ family: 'DM Sans', category: 'sans', weights: [400, 500, 600, 700, 800, 900], italic: true },
	{ family: 'Manrope', category: 'sans', weights: [400, 600, 700, 800] },
	{ family: 'Work Sans', category: 'sans', weights: [400, 500, 700, 900], italic: true },
	{ family: 'Plus Jakarta Sans', category: 'sans', weights: [400, 500, 700, 800] },
	{ family: 'Poppins', category: 'sans', weights: [400, 500, 600, 700, 900], italic: true },
	{ family: 'Montserrat', category: 'sans', weights: [400, 500, 700, 900], italic: true },
	{ family: 'Nunito', category: 'sans', weights: [400, 600, 700, 900], italic: true },
	{ family: 'Raleway', category: 'sans', weights: [400, 500, 700, 900], italic: true },
	{ family: 'Outfit', category: 'sans', weights: [400, 500, 700, 900] },
	{ family: 'Urbanist', category: 'sans', weights: [400, 500, 700, 900], italic: true },
	{ family: 'Archivo', category: 'sans', weights: [400, 500, 700, 900], italic: true },
	{ family: 'Archivo Black', category: 'sans', weights: [400] },
	{ family: 'Oswald', category: 'sans', weights: [400, 500, 700] },
	{ family: 'Barlow', category: 'sans', weights: [400, 500, 700, 900], italic: true },
	{ family: 'Bebas Neue', category: 'sans', weights: [400] },
	{ family: 'Anton', category: 'sans', weights: [400] },

	// ── Serif (editorial + classic) ────────────────────────────────────
	{ family: 'Playfair Display', category: 'serif', weights: [400, 500, 700, 900], italic: true },
	{ family: 'Lora', category: 'serif', weights: [400, 500, 700], italic: true },
	{ family: 'Merriweather', category: 'serif', weights: [400, 700, 900], italic: true },
	{ family: 'DM Serif Display', category: 'serif', weights: [400], italic: true },
	{ family: 'DM Serif Text', category: 'serif', weights: [400], italic: true },
	{ family: 'EB Garamond', category: 'serif', weights: [400, 500, 700], italic: true },
	{ family: 'Cormorant Garamond', category: 'serif', weights: [400, 500, 700], italic: true },
	{ family: 'Libre Baskerville', category: 'serif', weights: [400, 700], italic: true },
	{ family: 'Crimson Pro', category: 'serif', weights: [400, 500, 700], italic: true },
	{ family: 'Source Serif 4', category: 'serif', weights: [400, 600, 700] },
	{ family: 'Bodoni Moda', category: 'serif', weights: [400, 700, 900], italic: true },
	{ family: 'Noto Serif Display', category: 'serif', weights: [400, 700, 900], italic: true },

	// ── Display (hero / bold) ──────────────────────────────────────────
	{ family: 'Abril Fatface', category: 'display', weights: [400] },
	{ family: 'Alfa Slab One', category: 'display', weights: [400] },
	{ family: 'Rubik', category: 'display', weights: [400, 500, 700, 900], italic: true },
	{ family: 'Rubik Mono One', category: 'display', weights: [400] },
	{ family: 'Bungee', category: 'display', weights: [400] },
	{ family: 'Black Ops One', category: 'display', weights: [400] },
	{ family: 'Monoton', category: 'display', weights: [400] },
	{ family: 'Staatliches', category: 'display', weights: [400] },
	{ family: 'Passion One', category: 'display', weights: [400, 700, 900] },
	{ family: 'Righteous', category: 'display', weights: [400] },
	{ family: 'Chakra Petch', category: 'display', weights: [400, 500, 700], italic: true },
	{ family: 'Orbitron', category: 'display', weights: [400, 500, 700, 900] },
	{ family: 'Syncopate', category: 'display', weights: [400, 700] },
	{ family: 'Big Shoulders Display', category: 'display', weights: [400, 700, 900] },
	{ family: 'Unbounded', category: 'display', weights: [400, 500, 700, 900] },

	// ── Handwriting / script ───────────────────────────────────────────
	{ family: 'Caveat', category: 'handwriting', weights: [400, 500, 700] },
	{ family: 'Pacifico', category: 'handwriting', weights: [400] },
	{ family: 'Dancing Script', category: 'handwriting', weights: [400, 500, 700] },
	{ family: 'Satisfy', category: 'handwriting', weights: [400] },
	{ family: 'Great Vibes', category: 'handwriting', weights: [400] },
	{ family: 'Sacramento', category: 'handwriting', weights: [400] },
	{ family: 'Shadows Into Light', category: 'handwriting', weights: [400] },
	{ family: 'Permanent Marker', category: 'handwriting', weights: [400] },
	{ family: 'Kalam', category: 'handwriting', weights: [400, 700] },
	{ family: 'Homemade Apple', category: 'handwriting', weights: [400] },

	// ── Monospace ──────────────────────────────────────────────────────
	{ family: 'JetBrains Mono', category: 'mono', weights: [400, 500, 700], italic: true },
	{ family: 'Space Mono', category: 'mono', weights: [400, 700], italic: true },
	{ family: 'IBM Plex Mono', category: 'mono', weights: [400, 500, 700], italic: true },
	{ family: 'Fira Code', category: 'mono', weights: [400, 500, 700] },
	{ family: 'Roboto Mono', category: 'mono', weights: [400, 500, 700], italic: true },
];

const loadedFonts = new Set<string>();
const loadPromises = new Map<string, Promise<void>>();

/** Build the Google Fonts CSS2 URL for a font. */
function buildCssUrl(font: GoogleFont): string {
	const family = font.family.replace(/\s+/g, '+');
	/* Variable Lexend — single axis covers 100–900 (matches `app.html` preload). */
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

/** Hint the browser after layout — avoids competing with the same turn as inline style updates. */
function scheduleFontFaceHint(family: string, weight: number): void {
	queueMicrotask(() => void ensureFontFaceReady(family, weight));
}

/**
 * Lazy-load a Google Font by injecting a <link> into the document head.
 * Safe to call repeatedly — same font only loads once.
 * After the stylesheet is present, `weightHint` is applied via `document.fonts.load` so the correct
 * weight is available (calling again with a new weight still resolves the matching face).
 */
export function loadGoogleFont(family: string, weightHint?: number): Promise<void> {
	if (typeof document === 'undefined') return Promise.resolve();
	const w = weightHint ?? 400;
	/** Variable Lexend is preloaded in `app.html` (wght 100–900). CSS `font-weight` updates instantly; `fonts.load` per tick only delays paint. */
	if (family === 'Lexend') return Promise.resolve();

	const font = GOOGLE_FONTS.find((f) => f.family === family);
	/** Still resolve `document.fonts.load` for faces linked elsewhere (e.g. custom CSS). */
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

	const p = new Promise<void>((resolve) => {
		const link = document.createElement('link');
		link.rel = 'stylesheet';
		link.href = buildCssUrl(font);
		link.setAttribute('data-gfont', family);
		link.onload = async () => {
			loadedFonts.add(family);
			scheduleFontFaceHint(family, w);
			resolve();
		};
		link.onerror = () => resolve(); // fail open — fall back to system font
		document.head.appendChild(link);
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
