/** Drop shadow for the News circle badge (CSS `box-shadow`). */

export type CircleShadowCast = 'flat' | 'layered';

export type CircleShadow = {
	enabled: boolean;
	/** Hex, e.g. `#000000`. */
	color: string;
	/** 0–1 */
	opacity: number;
	blur: number;
	offsetX: number;
	offsetY: number;
	spread: number;
	/**
	 * `layered` stacks contact + mid + ambient (photographic).
	 * `flat` is a single CSS shadow.
	 */
	cast: CircleShadowCast;
};

function shadow(
	partial: Partial<CircleShadow> & Pick<CircleShadow, 'enabled' | 'cast'>,
): CircleShadow {
	return {
		color: '#000000',
		opacity: 0.32,
		blur: 48,
		offsetX: 0,
		offsetY: 8,
		spread: 0,
		...partial,
	};
}

/** Soft 3-layer contact shadow — default. */
export const DEFAULT_CIRCLE_SHADOW: CircleShadow = shadow({
	enabled: true,
	cast: 'layered',
	opacity: 0.32,
	blur: 48,
	offsetY: 8,
});

export const CIRCLE_SHADOW_NONE: CircleShadow = shadow({
	enabled: false,
	cast: 'flat',
	opacity: 0,
	blur: 0,
	offsetY: 0,
});

export const CIRCLE_SHADOW_PRESETS: { id: string; label: string; value: CircleShadow }[] = [
	{ id: 'none', label: 'None', value: { ...CIRCLE_SHADOW_NONE } },
	{ id: 'natural', label: 'Natural', value: { ...DEFAULT_CIRCLE_SHADOW } },
	{
		id: 'contact',
		label: 'Contact',
		value: shadow({ enabled: true, cast: 'layered', opacity: 0.34, blur: 12, offsetY: 3, spread: -2 }),
	},
	{
		id: 'soft',
		label: 'Soft',
		value: shadow({ enabled: true, cast: 'layered', opacity: 0.2, blur: 32, offsetY: 6 }),
	},
	{
		id: 'lift',
		label: 'Lift',
		value: shadow({ enabled: true, cast: 'layered', opacity: 0.3, blur: 36, offsetY: 16 }),
	},
	{
		id: 'long',
		label: 'Long',
		value: shadow({ enabled: true, cast: 'layered', opacity: 0.28, blur: 28, offsetX: 10, offsetY: 22 }),
	},
	{
		id: 'deep',
		label: 'Deep',
		value: shadow({ enabled: true, cast: 'layered', opacity: 0.44, blur: 58, offsetY: 14 }),
	},
	{
		id: 'hard',
		label: 'Hard',
		value: shadow({ enabled: true, cast: 'flat', opacity: 0.72, blur: 0, offsetY: 10 }),
	},
	{
		id: 'glow',
		label: 'Glow',
		value: shadow({
			enabled: true,
			cast: 'flat',
			color: '#FFFFFF',
			opacity: 0.55,
			blur: 28,
			offsetY: 0,
			spread: 4,
		}),
	},
];

export type ShadowDirectionId = 'nw' | 'n' | 'ne' | 'w' | 'c' | 'e' | 'sw' | 's' | 'se';

export const SHADOW_DIRECTIONS: { id: ShadowDirectionId; x: number; y: number; label: string }[] = [
	{ id: 'nw', x: -1, y: -1, label: 'Up left' },
	{ id: 'n', x: 0, y: -1, label: 'Up' },
	{ id: 'ne', x: 1, y: -1, label: 'Up right' },
	{ id: 'w', x: -1, y: 0, label: 'Left' },
	{ id: 'c', x: 0, y: 0, label: 'Center' },
	{ id: 'e', x: 1, y: 0, label: 'Right' },
	{ id: 'sw', x: -1, y: 1, label: 'Down left' },
	{ id: 's', x: 0, y: 1, label: 'Down' },
	{ id: 'se', x: 1, y: 1, label: 'Down right' },
];

export const CIRCLE_SHADOW_COLORS = [
	'#000000',
	'#1a1a1a',
	'#3b3b3b',
	'#5c4033',
	'#FFFFFF',
	'#08EBFF',
	'#F5A623',
	'#FF3B5C',
] as const;

function clamp(n: number, lo: number, hi: number): number {
	return Math.min(hi, Math.max(lo, n));
}

export function hexToRgba(hex: string, opacity: number): string {
	const raw = String(hex ?? '').trim().replace('#', '');
	const full =
		raw.length === 3
			? raw
					.split('')
					.map((c) => c + c)
					.join('')
			: raw.padEnd(6, '0').slice(0, 6);
	const n = Number.parseInt(full, 16);
	if (!Number.isFinite(n)) return `rgba(0,0,0,${clamp(opacity, 0, 1)})`;
	const r = (n >> 16) & 255;
	const g = (n >> 8) & 255;
	const b = n & 255;
	return `rgba(${r},${g},${b},${clamp(opacity, 0, 1)})`;
}

function oneLayer(
	s: CircleShadow,
	ox: number,
	oy: number,
	blur: number,
	spread: number,
	opacity: number,
): string {
	return `${Math.round(ox)}px ${Math.round(oy)}px ${Math.max(0, Math.round(blur))}px ${Math.round(spread)}px ${hexToRgba(s.color, clamp(opacity, 0, 1))}`;
}

export function circleShadowCss(s: CircleShadow | null | undefined): string {
	if (!s?.enabled) return 'none';
	if (s.cast !== 'layered') {
		return oneLayer(s, s.offsetX, s.offsetY, s.blur, s.spread, s.opacity);
	}
	const x = s.offsetX;
	const y = s.offsetY;
	const blur = s.blur;
	const spread = s.spread;
	const o = s.opacity;
	const contact = oneLayer(
		s,
		x * 0.28,
		y === 0 ? 1 : y * 0.28,
		Math.max(2, blur * 0.16),
		spread * 0.15,
		Math.min(1, o * 0.85),
	);
	const mid = oneLayer(s, x, y, blur, spread, o);
	const ambient = oneLayer(s, x * 1.2, y === 0 ? blur * 0.12 : y * 2.2, blur * 1.75, spread * 0.25, o * 0.34);
	return `${contact}, ${mid}, ${ambient}`;
}

export function shadowDistance(s: CircleShadow): number {
	const d = Math.hypot(s.offsetX, s.offsetY);
	if (d >= 1) return Math.round(d);
	return Math.max(8, Math.round(s.offsetY || s.blur * 0.2 || 8));
}

export function applyShadowDirection(s: CircleShadow, dx: number, dy: number): CircleShadow {
	const dist = shadowDistance(s);
	if (dx === 0 && dy === 0) {
		return { ...s, offsetX: 0, offsetY: 0, enabled: true };
	}
	return {
		...s,
		offsetX: Math.round(dx * dist),
		offsetY: Math.round(dy * dist),
		enabled: true,
	};
}

export function activeShadowDirection(s: CircleShadow): ShadowDirectionId {
	const ax = Math.abs(s.offsetX);
	const ay = Math.abs(s.offsetY);
	if (ax < 2 && ay < 2) return 'c';
	const x = ax < 2 ? 0 : Math.sign(s.offsetX);
	const y = ay < 2 ? 0 : Math.sign(s.offsetY);
	const hit = SHADOW_DIRECTIONS.find((d) => d.x === x && d.y === y);
	return hit?.id ?? 's';
}

export function normalizeCircleShadow(raw: unknown, fallback: CircleShadow = DEFAULT_CIRCLE_SHADOW): CircleShadow {
	if (!raw || typeof raw !== 'object') return { ...fallback };
	const o = raw as Record<string, unknown>;
	const color = typeof o.color === 'string' && o.color.trim() ? o.color.trim() : fallback.color;
	const cast: CircleShadowCast = o.cast === 'layered' ? 'layered' : o.cast === 'flat' ? 'flat' : 'flat';
	return {
		enabled: o.enabled !== false && o.enabled !== 0,
		color: color.startsWith('#') ? color : `#${color}`,
		opacity: clamp(Number(o.opacity), 0, 1) || 0,
		blur: clamp(Number(o.blur), 0, 120) || 0,
		offsetX: clamp(Number(o.offsetX), -80, 80) || 0,
		offsetY: clamp(Number(o.offsetY), -80, 80) || 0,
		spread: clamp(Number(o.spread), -40, 80) || 0,
		cast,
	};
}

export function circleShadowsMatch(a: CircleShadow, b: CircleShadow): boolean {
	return (
		a.enabled === b.enabled &&
		a.cast === b.cast &&
		a.color.toLowerCase() === b.color.toLowerCase() &&
		Math.abs(a.opacity - b.opacity) < 0.02 &&
		a.blur === b.blur &&
		a.offsetX === b.offsetX &&
		a.offsetY === b.offsetY &&
		a.spread === b.spread
	);
}
