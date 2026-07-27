/** Client + server options for optional pyautoflip reframe on clip download. */

export type ReframeAspectRatio = '9:16' | '1:1' | '16:9' | '4:5';
export type ReframeMethod = 'detection' | 'saliency';
export type ReframePadding = 'blur' | 'solid_color';

export type AutoReframeOptions = {
	enabled: boolean;
	aspectRatio: ReframeAspectRatio;
	method: ReframeMethod;
	/** 0–1 camera motion threshold */
	motionThreshold: number;
	paddingMethod: ReframePadding;
	debug: boolean;
};

export const DEFAULT_AUTO_REFRAME: AutoReframeOptions = {
	enabled: false,
	aspectRatio: '9:16',
	method: 'detection',
	motionThreshold: 0.5,
	paddingMethod: 'blur',
	debug: false,
};

/** Target crop — the main “what shape” choice. */
export const REFRAME_ASPECTS: { id: ReframeAspectRatio; label: string; hint: string }[] = [
	{ id: '9:16', label: '9:16', hint: 'Stories / Reels / TikTok' },
	{ id: '4:5', label: '4:5', hint: 'Instagram feed' },
	{ id: '1:1', label: '1:1', hint: 'Square' },
	{ id: '16:9', label: '16:9', hint: 'Landscape' },
];

/** How AutoFlip decides what stays in frame. */
export const REFRAME_METHODS: { id: ReframeMethod; label: string; hint: string }[] = [
	{ id: 'detection', label: 'Face & object', hint: 'Tracks people / objects (faster)' },
	{ id: 'saliency', label: 'Saliency map', hint: 'Keeps visually important areas (slower)' },
];

/** When the subject doesn’t fill the target frame. */
export const REFRAME_PADDING: { id: ReframePadding; label: string; hint: string }[] = [
	{ id: 'blur', label: 'Blur edges', hint: 'Soft background fill' },
	{ id: 'solid_color', label: 'Solid color', hint: 'Letterbox / pillarbox bars' },
];

export function reframeSettingsKey(opts: {
	aspectRatio: string;
	method: string;
	motionThreshold: number;
	paddingMethod: string;
	debug: boolean;
}): string {
	return [
		opts.aspectRatio,
		opts.method,
		opts.motionThreshold.toFixed(2),
		opts.paddingMethod,
		opts.debug ? '1' : '0',
	].join('|');
}
