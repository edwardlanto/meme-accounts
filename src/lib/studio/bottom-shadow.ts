/** Bottom canvas vignette / text-readability gradient (News template). */

export type BottomShadowCurve = 'news' | 'natural' | 'soft' | 'cinematic' | 'linear' | 'editorial';

export type BottomShadowPreset = {
	id: string;
	label: string;
	height: number;
	strength: number;
	curve: BottomShadowCurve;
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
	{ id: 'news', label: 'News', height: 92, strength: 1, curve: 'news' },
	{ id: 'cinematic', label: 'Cinematic', height: 78, strength: 1, curve: 'cinematic' },
	{ id: 'deep', label: 'Deep', height: 86, strength: 1, curve: 'cinematic' },
	{ id: 'full', label: 'Full', height: 100, strength: 1, curve: 'news' },
];

export function normalizeBottomShadowCurve(raw: unknown): BottomShadowCurve {
	const id = String(raw ?? '').trim().toLowerCase();
	return BOTTOM_SHADOW_CURVES.some((c) => c.id === id) ? (id as BottomShadowCurve) : 'news';
}

/**
 * Cap how much of the canvas the soft fade can stretch.
 * Anything taller than this becomes a solid black floor under the text
 * so tall auto-fit shadows stay readable (fade + black box).
 */
const SHADOW_FADE_MAX_PCT = 48;

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
): string {
	const sh = Math.max(0, Math.min(100, heightPct));
	const str = Math.max(0, Math.min(1, strength));
	if (sh <= 0 || str <= 0) {
		return 'linear-gradient(to bottom, rgba(0,0,0,0) 0%, rgba(0,0,0,0) 100%)';
	}

	const { fadePct, solidPct } = splitBottomShadowBands(sh);
	const clear = 100 - sh;
	const fadeEnd = clear + fadePct;
	const a = (mult: number) => `rgba(0,0,0,${(mult * str).toFixed(3)})`;
	const at = (offset: number) => `${(clear + fadePct * offset).toFixed(2)}%`;
	/** Hold full black through the solid floor (and to the bottom edge). */
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
	const padAbove = opts?.padAbove ?? 12;
	const padBelow = opts?.padBelow ?? 8;
	/** Floor high enough that short body slides still match the Hook vignette. */
	const min = opts?.min ?? 92;
	const max = opts?.max ?? 98;

	const top = Math.max(0, Math.min(100, info.topPct));
	const height = Math.max(0, Math.min(100, info.heightPct));
	const fadeStart = Math.max(0, top - padAbove);
	const tallBoost = Math.max(0, height - 26) * 0.28;
	const textBottomPad = Math.max(0, top + height + padBelow - 100);

	let cover = 100 - fadeStart + tallBoost + textBottomPad;
	cover = Math.round(Math.min(max, Math.max(min, cover)));
	return cover;
}
