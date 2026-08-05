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

/** Default auto-reframe (face/object detection). */
export const DEFAULT_AUTO_REFRAME: AutoReframeOptions = {
	enabled: false,
	aspectRatio: '9:16',
	method: 'detection',
	motionThreshold: 0.5,
	paddingMethod: 'blur',
	debug: false,
};

/** Preferred auto-reframe for the Multi split template — saliency enables pyautoflip’s multi-face stack. */
export const VIDEO_SPLIT_AUTO_REFRAME: AutoReframeOptions = {
	enabled: true,
	aspectRatio: '9:16',
	method: 'saliency',
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

/** Studio canvas format id for a reframe aspect (clips default to vertical). */
export type StudioFormatFromReframe = 'feed' | 'vertical' | 'wide' | 'square';

export function studioFormatForReframeAspect(
	aspect: string | null | undefined,
): StudioFormatFromReframe {
	switch (String(aspect ?? '').trim()) {
		case '16:9':
			return 'wide';
		case '1:1':
			return 'square';
		case '4:5':
			return 'feed';
		case '9:16':
		default:
			return 'vertical';
	}
}

/** First segment of `reframeSettingsKey` is the aspect ratio. */
export function parseReframeAspectFromSettingsKey(
	key: string | null | undefined,
): ReframeAspectRatio | null {
	const a = String(key ?? '')
		.split('|')[0]
		?.trim();
	if (a === '9:16' || a === '4:5' || a === '1:1' || a === '16:9') return a;
	return null;
}

export function canvasSizeForStudioFormat(formatId: StudioFormatFromReframe): { w: number; h: number } {
	switch (formatId) {
		case 'vertical':
			return { w: 1080, h: 1920 };
		case 'wide':
			return { w: 1920, h: 1080 };
		case 'square':
			return { w: 1080, h: 1080 };
		case 'feed':
		default:
			return { w: 1080, h: 1350 };
	}
}

/** How AutoFlip decides what stays in frame. */
export const REFRAME_METHODS: { id: ReframeMethod; label: string; hint: string }[] = [
	{ id: 'detection', label: 'Face & object', hint: 'Tracks people / objects (faster)' },
	{
		id: 'saliency',
		label: 'Multi-face split',
		hint: 'When two faces are far apart, stacks them top/bottom (9:16)',
	},
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
