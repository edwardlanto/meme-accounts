/** Bottom canvas vignette / text-readability gradient (News template). */

export type BottomShadowCurve = 'news' | 'natural' | 'soft' | 'cinematic' | 'linear' | 'editorial';

export type BottomShadowPreset = {
	id: string;
	label: string;
	height: number;
	strength: number;
	curve: BottomShadowCurve;
};

export type BottomShadowColorSwatch = {
	id: string;
	label: string;
	hex: string;
};

export const BOTTOM_SHADOW_CURVES: { id: BottomShadowCurve; label: string; hint: string }[] = [
	{ id: 'natural', label: 'Natural', hint: 'Long, smooth fade — best for headlines' },
	{ id: 'editorial', label: 'Editorial', hint: 'Gentle lift with soft mid-tones' },
	{ id: 'news', label: 'News', hint: 'Classic punchy news read' },
	{ id: 'soft', label: 'Soft', hint: 'Light touch — busy photos' },
	{ id: 'cinematic', label: 'Cinematic', hint: 'Deeper contrast, still smooth' },
	{ id: 'linear', label: 'Linear', hint: 'Simple two-stop fade' },
];

export const BOTTOM_SHADOW_PRESETS: BottomShadowPreset[] = [
	{ id: 'none', label: 'None', height: 0, strength: 0, curve: 'natural' },
	{ id: 'whisper', label: 'Whisper', height: 32, strength: 0.45, curve: 'soft' },
	{ id: 'soft', label: 'Soft', height: 44, strength: 0.62, curve: 'soft' },
	{ id: 'natural', label: 'Natural', height: 58, strength: 0.88, curve: 'natural' },
	{ id: 'editorial', label: 'Editorial', height: 64, strength: 0.9, curve: 'editorial' },
	{ id: 'news', label: 'News', height: 56, strength: 1, curve: 'news' },
	{ id: 'cinematic', label: 'Cinematic', height: 78, strength: 1, curve: 'cinematic' },
	{ id: 'deep', label: 'Deep', height: 86, strength: 1, curve: 'cinematic' },
	{ id: 'full', label: 'Full', height: 100, strength: 1, curve: 'news' },
];

/** Curated letterbox tints — shown as mini fade previews in Studio. */
export const BOTTOM_SHADOW_COLORS: BottomShadowColorSwatch[] = [
	{ id: 'ink', label: 'Ink', hex: '#000000' },
	{ id: 'slate', label: 'Slate', hex: '#1a2332' },
	{ id: 'navy', label: 'Navy', hex: '#0b1f3a' },
	{ id: 'forest', label: 'Moss', hex: '#102418' },
	{ id: 'wine', label: 'Wine', hex: '#2a1218' },
	{ id: 'cocoa', label: 'Cocoa', hex: '#2a1c14' },
	{ id: 'indigo', label: 'Indigo', hex: '#18144a' },
	{ id: 'dusk', label: 'Dusk', hex: '#2e1a3a' },
];

export function normalizeBottomShadowCurve(raw: unknown): BottomShadowCurve {
	const id = String(raw ?? '').trim().toLowerCase();
	return BOTTOM_SHADOW_CURVES.some((c) => c.id === id) ? (id as BottomShadowCurve) : 'news';
}

export function normalizeBottomShadowColor(raw: unknown): string {
	const s = String(raw ?? '').trim();
	if (/^#[0-9a-fA-F]{6}$/.test(s)) return s.toLowerCase();
	if (/^#[0-9a-fA-F]{3}$/.test(s)) {
		const a = s[1]!;
		const b = s[2]!;
		const c = s[3]!;
		return `#${a}${a}${b}${b}${c}${c}`.toLowerCase();
	}
	return '#000000';
}

function shadowRgba(hex: string, alpha: number): string {
	const n = normalizeBottomShadowColor(hex);
	const r = Number.parseInt(n.slice(1, 3), 16);
	const g = Number.parseInt(n.slice(3, 5), 16);
	const b = Number.parseInt(n.slice(5, 7), 16);
	const a = Math.max(0, Math.min(1, alpha));
	if (![r, g, b].every(Number.isFinite)) return `rgba(0,0,0,${a.toFixed(3)})`;
	return `rgba(${r},${g},${b},${a.toFixed(3)})`;
}

/**
 * Cap how much of the canvas the soft fade can stretch.
 * Anything taller than this becomes a solid black floor under the text
 * so tall auto-fit shadows stay readable (fade + black box).
 */
const SHADOW_FADE_MAX_PCT = 48;

/** Shared News autofit — Studio + Bulk must use the same numbers after generate. */
export const NEWS_SHADOW_AUTOFIT = {
	/** Clears the soft top of the News fade above the first headline line. */
	padAbove: 22,
	padBelow: 6,
	min: 56,
	max: 88,
} as const;

/** Split total shadow height into fade band + solid black floor. */
export function splitBottomShadowBands(heightPct: number): { fadePct: number; solidPct: number } {
	const sh = Math.max(0, Math.min(100, heightPct));
	if (sh <= 0) return { fadePct: 0, solidPct: 0 };
	const fadePct = Math.min(sh, SHADOW_FADE_MAX_PCT);
	return { fadePct, solidPct: Math.max(0, sh - fadePct) };
}

/** CSS `background` gradient for the bottom vignette layer. */
export function buildBottomShadowGradient(
	heightPct: number,
	strength: number,
	curve: BottomShadowCurve = 'news',
	color = '#000000',
): string {
	const sh = Math.max(0, Math.min(100, heightPct));
	const str = Math.max(0, Math.min(1, strength));
	const tint = normalizeBottomShadowColor(color);
	if (sh <= 0 || str <= 0) {
		return 'linear-gradient(to bottom, rgba(0,0,0,0) 0%, rgba(0,0,0,0) 100%)';
	}

	const { fadePct, solidPct } = splitBottomShadowBands(sh);
	const clear = 100 - sh;
	const fadeEnd = clear + fadePct;
	const a = (mult: number) => shadowRgba(tint, mult * str);
	const at = (offset: number) => `${(clear + fadePct * offset).toFixed(2)}%`;
	/** Hold full tint through the solid floor (and to the bottom edge). */
	const solidTail =
		solidPct > 0.5
			? `, ${a(1)} ${fadeEnd.toFixed(2)}%, ${a(1)} 100%`
			: `, ${a(1)} 100%`;

	switch (curve) {
		case 'linear':
			return `linear-gradient(to bottom, rgba(0,0,0,0) ${clear}%, ${a(0.88)} ${fadeEnd.toFixed(2)}%${solidTail})`;
		case 'soft':
			return `linear-gradient(to bottom,
				rgba(0,0,0,0) ${clear}%,
				${a(0.07)} ${at(0.32)},
				${a(0.28)} ${at(0.58)},
				${a(0.58)} ${at(0.8)},
				${a(0.9)} ${fadeEnd.toFixed(2)}%${solidTail})`;
		case 'editorial':
			return `linear-gradient(to bottom,
				rgba(0,0,0,0) ${clear}%,
				${a(0.04)} ${at(0.16)},
				${a(0.14)} ${at(0.34)},
				${a(0.34)} ${at(0.52)},
				${a(0.56)} ${at(0.7)},
				${a(0.74)} ${at(0.84)},
				${a(0.95)} ${fadeEnd.toFixed(2)}%${solidTail})`;
		case 'cinematic':
			return `linear-gradient(to bottom,
				rgba(0,0,0,0) ${clear}%,
				${a(0.1)} ${at(0.18)},
				${a(0.38)} ${at(0.42)},
				${a(0.68)} ${at(0.64)},
				${a(0.86)} ${at(0.82)},
				${a(1)} ${fadeEnd.toFixed(2)}%${solidTail})`;
		case 'news':
			return `linear-gradient(to bottom,
				rgba(0,0,0,0) ${clear}%,
				${a(0.15)} ${at(0.27)},
				${a(0.65)} ${at(0.5)},
				${a(0.88)} ${at(0.67)},
				${a(0.97)} ${at(0.84)},
				${a(1)} ${fadeEnd.toFixed(2)}%${solidTail})`;
		case 'natural':
		default:
			return `linear-gradient(to bottom,
				rgba(0,0,0,0) ${clear}%,
				${a(0.05)} ${at(0.2)},
				${a(0.18)} ${at(0.38)},
				${a(0.42)} ${at(0.54)},
				${a(0.64)} ${at(0.7)},
				${a(0.82)} ${at(0.84)},
				${a(0.98)} ${fadeEnd.toFixed(2)}%${solidTail})`;
	}
}

/** Fit shadow height to the measured headline / source text stack. */
export function bottomShadowHeightForTextStack(
	info: { topPct: number; heightPct: number },
	opts?: { padAbove?: number; padBelow?: number; min?: number; max?: number },
): number {
	/**
	 * Pad must clear the soft top of the fade, not just the geometric start.
	 * News/natural curves stay ~transparent for the first ~40% of the fade band,
	 * so pad well above the headline puts solid-enough black behind the first line.
	 */
	const padAbove = opts?.padAbove ?? NEWS_SHADOW_AUTOFIT.padAbove;
	const padBelow = opts?.padBelow ?? NEWS_SHADOW_AUTOFIT.padBelow;
	const min = opts?.min ?? NEWS_SHADOW_AUTOFIT.min;
	const max = opts?.max ?? NEWS_SHADOW_AUTOFIT.max;

	const top = Math.max(0, Math.min(100, info.topPct));
	const height = Math.max(0, Math.min(100, info.heightPct));
	const fadeStart = Math.max(0, top - padAbove);
	const tallBoost = Math.max(0, height - 24) * 0.2;
	const textBottomPad = Math.max(0, top + height + padBelow - 100);

	let cover = 100 - fadeStart + tallBoost + textBottomPad;
	cover = Math.round(Math.min(max, Math.max(min, cover)));
	return cover;
}
