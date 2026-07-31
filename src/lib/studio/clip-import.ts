import type { TemplateId } from '$lib/studio/template-ids';
import { mapQueryParamToTemplateId, coerceTemplateId } from '$lib/studio/template-ids';
import type { CaptionSegment } from '$lib/video-clips/caption-sync';
import type { CaptionAnimation } from '$lib/video-clips/caption-templates';

export const STUDIO_CLIP_IMPORT_KEY = 'studio_clip_import_v1';

/** CapCut-style captions carried from Videos → Studio with the clip. */
export type StudioClipCaptionImport = {
	enabled: boolean;
	segments: CaptionSegment[];
	templateId: string;
	fontSize: number;
	position: 'top' | 'center' | 'bottom';
	customColor: string;
	customBgColor: string;
	customHighlightColor: string;
	selectedFont: string;
	strokeEnabled: boolean;
	animationOverride: CaptionAnimation | null;
	wordsPerChunk: number | null;
	customX: number | null;
	customY: number | null;
};

/** Payload stashed before navigating Videos → Studio (avoids huge signed URLs in the query string). */
export type StudioClipImport = {
	/** Primary / first-slide template (also used in ?template= URL). */
	template: TemplateId;
	/**
	 * Optional ordered templates for a multi-slide carousel that reuses the same clip.
	 * e.g. ['news', 'blank'] → slide 1 News + slide 2 Blank, both with this video.
	 * When omitted or length ≤ 1, behaves as a single-template import.
	 */
	carouselTemplates?: TemplateId[];
	videoUrl: string;
	clipStart: number;
	clipEnd: number;
	thumbnailUrl?: string;
	newsHeadline?: string;
	newsSource?: string;
	storyHeadline?: string;
	storyWatermark?: string;
	tweetTop?: string;
	tweetBottom?: string;
	carouselName?: string;
	carouselHandle?: string;
	carouselBody?: string;
	/** Timed captions from the Videos page (when captions were on). */
	captions?: StudioClipCaptionImport | null;
};

export function stashStudioClipImport(payload: StudioClipImport): void {
	if (typeof window === 'undefined') return;
	const json = JSON.stringify(payload);
	try {
		sessionStorage.setItem(STUDIO_CLIP_IMPORT_KEY, json);
	} catch (e) {
		console.warn('[studio] sessionStorage stash failed, trying localStorage', e);
	}
	try {
		localStorage.setItem(STUDIO_CLIP_IMPORT_KEY, json);
	} catch (e) {
		console.warn('[studio] failed to stash clip import', e);
	}
}

export function peekStudioClipImport(): StudioClipImport | null {
	if (typeof window === 'undefined') return null;
	const raw =
		sessionStorage.getItem(STUDIO_CLIP_IMPORT_KEY) ??
		localStorage.getItem(STUDIO_CLIP_IMPORT_KEY);
	if (!raw) return null;
	try {
		const parsed = JSON.parse(raw) as StudioClipImport;
		if (!parsed?.videoUrl || !Number.isFinite(parsed.clipStart) || !Number.isFinite(parsed.clipEnd)) {
			return null;
		}
		parsed.template = coerceTemplateId(parsed.template);
		if (Array.isArray(parsed.carouselTemplates) && parsed.carouselTemplates.length) {
			parsed.carouselTemplates = parsed.carouselTemplates.map((t) => coerceTemplateId(t));
		}
		return parsed;
	} catch {
		return null;
	}
}

export function consumeStudioClipImport(): StudioClipImport | null {
	const payload = peekStudioClipImport();
	try {
		sessionStorage.removeItem(STUDIO_CLIP_IMPORT_KEY);
	} catch {
		/* ignore */
	}
	try {
		localStorage.removeItem(STUDIO_CLIP_IMPORT_KEY);
	} catch {
		/* ignore */
	}
	return payload;
}

export function studioUrlForClipImport(templateRaw: string): string {
	const template = mapQueryParamToTemplateId(templateRaw) ?? coerceTemplateId(templateRaw);
	const params = new URLSearchParams();
	params.set('from', 'clip');
	params.set('template', template);
	return `/dashboard/studio?${params.toString()}`;
}
