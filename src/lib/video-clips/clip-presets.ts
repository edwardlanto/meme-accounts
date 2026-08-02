/** Clip length presets for the Videos finder (maps to min/max seconds sent to analyze). */
export type ClipLengthPresetId =
	| 'any'
	| 'lt30'
	| '30to60'
	| '60to90'
	| '90to180'
	| 'gt180';

export type ClipLengthPreset = {
	id: ClipLengthPresetId;
	label: string;
	minSec: number;
	maxSec: number;
};

export const CLIP_LENGTH_PRESETS: ClipLengthPreset[] = [
	{ id: 'any', label: 'Any length', minSec: 10, maxSec: 180 },
	{ id: 'lt30', label: '<30s', minSec: 10, maxSec: 30 },
	{ id: '30to60', label: '30s–60s', minSec: 30, maxSec: 60 },
	{ id: '60to90', label: '60s–90s', minSec: 60, maxSec: 90 },
	{ id: '90to180', label: '90s–3 min', minSec: 90, maxSec: 180 },
	{ id: 'gt180', label: '>3 min', minSec: 180, maxSec: 300 },
];

export function clipLengthPresetFromRange(minSec: number, maxSec: number): ClipLengthPresetId {
	const hit = CLIP_LENGTH_PRESETS.find((p) => p.minSec === minSec && p.maxSec === maxSec);
	return hit?.id ?? 'any';
}

export function applyClipLengthPreset(id: ClipLengthPresetId): { minSec: number; maxSec: number } {
	const p = CLIP_LENGTH_PRESETS.find((x) => x.id === id) ?? CLIP_LENGTH_PRESETS[0]!;
	return { minSec: p.minSec, maxSec: p.maxSec };
}

/** Output / preview aspect ratios for clip cards + Studio open. */
export type VideoAspectRatioId = '9:16' | '1:1' | '16:9';

export type VideoAspectRatio = {
	id: VideoAspectRatioId;
	label: string;
	w: number;
	h: number;
	css: string;
};

export const VIDEO_ASPECT_RATIOS: VideoAspectRatio[] = [
	{ id: '9:16', label: '9:16', w: 1080, h: 1920, css: '9 / 16' },
	{ id: '1:1', label: '1:1', w: 1080, h: 1080, css: '1 / 1' },
	{ id: '16:9', label: '16:9', w: 1920, h: 1080, css: '16 / 9' },
];

export function videoAspectById(id: string | null | undefined): VideoAspectRatio {
	return VIDEO_ASPECT_RATIOS.find((a) => a.id === id) ?? VIDEO_ASPECT_RATIOS[0]!;
}

/** Featured video layout templates (Fit / Blur / Hook). */
export type VideoLayoutId =
	| 'story'
	| 'fit'
	| 'blur'
	| 'hook'
	| 'creator'
	| 'text'
	| 'source'
	| 'feature';

export const VIDEO_LAYOUT_TEMPLATES: { id: VideoLayoutId; label: string; studioId: string }[] = [
	{ id: 'feature', label: 'Feature card', studioId: 'videoFeature' },
	{ id: 'source', label: 'Source hook', studioId: 'videoSource' },
	{ id: 'text', label: 'Text on video', studioId: 'videoText' },
	{ id: 'creator', label: 'Creator hook', studioId: 'videoCreator' },
	{ id: 'hook', label: 'Hook video', studioId: 'videoHook' },
	{ id: 'fit', label: 'Fit video', studioId: 'videoFit' },
	{ id: 'blur', label: 'Blur', studioId: 'videoBlur' },
	{ id: 'story', label: 'Video story', studioId: 'videoStory' },
];
