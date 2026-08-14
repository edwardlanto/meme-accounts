import type { TextStyle } from '$lib/types';

export type TextShadowPreset = {
	id: string;
	label: string;
	/** Full CSS `text-shadow` value; undefined = none */
	value: string | undefined;
};

/** Presets for the floating text toolbar shadow picker. */
export const TEXT_SHADOW_PRESETS: TextShadowPreset[] = [
	{ id: 'none', label: 'None', value: undefined },
	{
		id: 'natural',
		label: 'Natural',
		value: '0 1px 2px rgba(0,0,0,0.22), 0 4px 14px rgba(0,0,0,0.28)',
	},
	{ id: 'contact', label: 'Contact', value: '0 1px 1px rgba(0,0,0,0.4), 0 2px 6px rgba(0,0,0,0.18)' },
	{ id: 'soft', label: 'Soft', value: '0 2px 8px rgba(0,0,0,0.45)' },
	{ id: 'medium', label: 'Medium', value: '0 1px 3px rgba(0,0,0,0.8), 0 4px 14px rgba(0,0,0,0.35)' },
	{ id: 'strong', label: 'Strong', value: '0 2px 4px rgba(0,0,0,0.95), 0 6px 20px rgba(0,0,0,0.55)' },
	{ id: 'hard', label: 'Hard drop', value: '0 4px 0 rgba(0,0,0,0.85)' },
	{ id: 'glow-light', label: 'Glow light', value: '0 0 14px rgba(255,255,255,0.65)' },
	{ id: 'glow-dark', label: 'Glow dark', value: '0 0 18px rgba(0,0,0,0.75)' },
	/**
	 * Hard halo + soft drop — same look POV used to hardcode with -webkit-text-stroke.
	 * Customers can pick this (or clear it) from the SH toolbar on any template.
	 */
	{
		id: 'outline',
		label: 'Outline',
		value:
			'-2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000, 2px 2px 0 #000, -2px 0 0 #000, 2px 0 0 #000, 0 -2px 0 #000, 0 2px 0 #000, 0 4px 18px rgba(0,0,0,0.5)',
	},
];

/** Default shadow for text-on-video / POV starters (matches Strong preset). */
export const TEXT_ON_VIDEO_SHADOW =
	TEXT_SHADOW_PRESETS.find((p) => p.id === 'strong')?.value ??
	'0 2px 4px rgba(0,0,0,0.95), 0 6px 20px rgba(0,0,0,0.55)';

/** Split a CSS shadow list on top-level commas (`rgba()` commas stay intact). */
export function splitCssShadowList(value: string): string[] {
	const out: string[] = [];
	let depth = 0;
	let cur = '';
	for (const ch of value) {
		if (ch === '(') depth += 1;
		else if (ch === ')') depth = Math.max(0, depth - 1);
		if (ch === ',' && depth === 0) {
			if (cur.trim()) out.push(cur.trim());
			cur = '';
			continue;
		}
		cur += ch;
	}
	if (cur.trim()) out.push(cur.trim());
	return out;
}

/**
 * `text-shadow` on `background-clip: text` fills (patterns / gradients) makes
 * Blink/WebKit paint the whole line box black. `filter: drop-shadow()` uses
 * the clipped glyph alpha instead.
 */
export function textShadowToDropFilter(value: string): string {
	const v = String(value ?? '').trim();
	if (!v || v === 'none') return 'none';
	return splitCssShadowList(v)
		.map((layer) => `drop-shadow(${layer})`)
		.join(' ');
}

export function textShadowStyleAttr(style: TextStyle | undefined | null): string {
	const v = String(style?.textShadow ?? '').trim();
	if (!v) return '';
	return `text-shadow: ${v}; --text-drop-shadow: ${textShadowToDropFilter(v)};`;
}

export function appendTextShadowCss(bits: string[], style: TextStyle | undefined | null) {
	const attr = textShadowStyleAttr(style);
	if (attr) bits.push(attr);
}

/** Shared brand / toolbar text-background swatches. Empty = none. */
export const TEXT_BG_SWATCHES = [
	'',
	'#7bf1a8',
	'#FFEB3B',
	'#FFFFFF',
	'#F5A623',
	'#08EBFF',
	'#FF3B5C',
	'#A855F7',
	'#10B981',
	'#FFD700',
	'#FF6B6B',
	'#4ECDC4',
	'#111827',
] as const;

export const TEXT_PAD_MIN = 0;
export const TEXT_PAD_MAX = 48;
export const TEXT_PAD_DEFAULT = 6;

export function clampTextPadding(n: number): number {
	return Math.max(TEXT_PAD_MIN, Math.min(TEXT_PAD_MAX, Math.round(n)));
}

/** Chip inset: explicit px from the toolbar, otherwise a tight em hug. */
export function textPaddingCss(style: TextStyle | undefined | null): string {
	const raw = style?.padding;
	if (typeof raw === 'number' && Number.isFinite(raw)) {
		const n = clampTextPadding(raw);
		return `padding: ${n}px ${Math.round(n * 1.35)}px;`;
	}
	return 'padding: 0.16em 0.3em 0.18em;';
}

/**
 * Highlight pill around glyphs.
 * Do not use text-box-trim here — trimming the same box that paints `background`
 * makes the chip disappear once an ancestor is composited / offset.
 */
export const TEXT_BG_CHIP_BOX_CSS =
	'display: inline-block; ' +
	'vertical-align: middle; ' +
	'padding: 0.16em 0.3em 0.18em; ' +
	'border-radius: 0.16em; ' +
	'box-decoration-break: clone; ' +
	'-webkit-box-decoration-break: clone;';

/** Block / label fill from the toolbar BG chip. */
export function appendTextBgCss(bits: string[], style: TextStyle | undefined | null) {
	const bg = String(style?.bgColor ?? '').trim();
	const hasBg = !!bg && bg !== 'transparent' && bg !== 'none';
	const hasPad = typeof style?.padding === 'number' && Number.isFinite(style.padding);
	if (!hasBg && !hasPad) return;
	if (hasBg) {
		// Prefer background-color (not the `background` shorthand) so clipped
		// pattern/gradient children cannot wipe the chip under a scaled canvas.
		bits.push(`background-color: ${bg};`);
		bits.push('background-image: none;');
		bits.push('-webkit-background-clip: border-box; background-clip: border-box;');
	}
	if (hasBg || hasPad) {
		bits.push(TEXT_BG_CHIP_BOX_CSS);
		bits.push(textPaddingCss(style));
		// Win over earlier CANVAS_TEXT_BOX_TRIM on the same style attribute.
		bits.push('text-box: normal; text-box-trim: none;');
		bits.push('isolation: isolate;');
	}
}

export function textBgCss(style: TextStyle | undefined | null): string {
	const bits: string[] = [];
	appendTextBgCss(bits, style);
	return bits.join(' ');
}
