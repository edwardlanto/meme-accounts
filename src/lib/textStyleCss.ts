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
	{ id: 'soft', label: 'Soft', value: '0 2px 8px rgba(0,0,0,0.45)' },
	{ id: 'medium', label: 'Medium', value: '0 1px 3px rgba(0,0,0,0.8), 0 4px 14px rgba(0,0,0,0.35)' },
	{ id: 'strong', label: 'Strong', value: '0 2px 4px rgba(0,0,0,0.95), 0 6px 20px rgba(0,0,0,0.55)' },
	{ id: 'hard', label: 'Hard drop', value: '0 4px 0 rgba(0,0,0,0.85)' },
	{ id: 'glow-light', label: 'Glow light', value: '0 0 14px rgba(255,255,255,0.65)' },
	{ id: 'glow-dark', label: 'Glow dark', value: '0 0 18px rgba(0,0,0,0.75)' },
	{ id: 'outline', label: 'Outline', value: '2px 2px 0 #000, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000' },
];

export function textShadowStyleAttr(style: TextStyle | undefined | null): string {
	const v = String(style?.textShadow ?? '').trim();
	return v ? `text-shadow: ${v};` : '';
}

export function appendTextShadowCss(bits: string[], style: TextStyle | undefined | null) {
	const attr = textShadowStyleAttr(style);
	if (attr) bits.push(attr);
}
