/** Bulk workspace: each idea is its own multi-slide slideshow. */

import type { TemplateId } from './template-ids';
import {
	coerceTemplateId,
	isPhotoStoryFamily,
	isVideoSplitFamily,
	isVideoStoryFamily,
	isWhitePostFamily,
} from './template-ids';
	import {
		BLACK_TEXT_CAROUSEL_DEFAULTS,
		IMAGE_QUOTE_DEFAULTS,
		NEWS_DEFAULT_LAYOUT,
		PHOTO_CAPTION_DEFAULTS,
		PHOTO_TOPIC_DEFAULTS,
		TEXT_CAROUSEL_DEFAULTS,
		VIDEO_STORY_DEFAULTS,
		WHITE_MEDIA_DEFAULTS,
		WHITE_THREAD_DEFAULTS,
	} from './slide-content-defaults';
import type { StudioClipCaptionImport } from './clip-import';
import type { CaptionSegment } from '$lib/video-clips/caption-sync';
import { DEFAULT_BRAND_KIT } from './brand-kit';
import {
	parseReframeAspectFromSettingsKey,
	studioFormatForReframeAspect,
} from '$lib/video-clips/reframe';
import { resolveStudioCaptionImportForSlide } from '$lib/video-clips/clip-captions';

export const STUDIO_BULK_IMPORT_KEY = 'studio_bulk_import_v1';
export const BULK_CLIP_HANDOFF_KEY = 'bulk_clip_handoff_v1';

export type BulkRowCaptions = {
	enabled: boolean;
	templateId: string;
	fontSize: number;
	position: 'top' | 'center' | 'bottom';
	color: string;
};

/** One slide inside a slideshow. */
export type BulkSlide = {
	id: string;
	template: TemplateId;
	headline: string;
	body: string;
	captions: BulkRowCaptions;
	/** Timed cues for export / Studio (when captions enabled). */
	captionSegments?: CaptionSegment[];
	studioCaptionImport?: StudioClipCaptionImport | null;
	mediaUrl?: string;
	mediaKind?: 'image' | 'video' | null;
	mediaThumb?: string;
	mediaLoading?: boolean;
	/** Preview audio — default muted for autoplay. */
	videoMuted?: boolean;
	/** Trim window on `mediaUrl` (seconds). 0…duration when reframed standalone MP4. */
	clipStart?: number;
	clipEnd?: number;
	/** Original trim on the full source — used for reframe API. */
	sourceClipStart?: number;
	sourceClipEnd?: number;
	/** Source object key for reframe API (from Videos import). */
	sourceR2Key?: string;
	reframedR2Key?: string;
	reframedPlaybackUrl?: string;
	reframeSettingsKey?: string;
	reframeBusy?: boolean;
	/** AI clip finder metadata when slide came from a long-video clip. */
	clipMeta?: BulkClipSlideMeta;
};

/** Virality / hook metadata from the clip finder. */
export type BulkClipSlideMeta = {
	clipId: string;
	viralityScore: number;
	hook: string;
	reason: string;
	transcript?: string;
	newsHeadline?: string;
	videoHook?: string;
	/** Absolute source timestamp for the best scene still. */
	bestFrameSec?: number;
	/** R2 key for the clip-specific scene still (not the shared video poster). */
	thumbnailR2Key?: string;
};

/** One clip segment handed off from Videos → Bulk. */
export type BulkClipHandoffItem = {
	videoUrl: string;
	clipStart: number;
	clipEnd: number;
	headline?: string;
	body?: string;
	thumbnailUrl?: string;
	bestFrameSec?: number;
	thumbnailR2Key?: string;
	sourceR2Key?: string;
	reframedR2Key?: string;
	reframedPlaybackUrl?: string;
	reframeSettingsKey?: string;
	captions?: StudioClipCaptionImport | null;
};

export type BulkClipHandoff = {
	sourceTitle?: string;
	sourceR2Key?: string;
	thumbnailUrl?: string;
	clips?: BulkClipHandoffItem[];
	/** @deprecated legacy single-clip payload */
	videoUrl?: string;
	clipStart?: number;
	clipEnd?: number;
	title?: string;
	captions?: StudioClipCaptionImport | null;
};

/** One idea = one full slideshow (multiple slides). */
export type BulkShow = {
	id: string;
	/** Short idea / deck title */
	title: string;
	slides: BulkSlide[];
	/** Which slide is selected for editing in this show */
	activeSlideId: string;
	/** Slideshow built from long-video clip finder */
	fromVideoClips?: boolean;
	clipSummary?: string;
	videoDemo?: boolean;
	videoModel?: string;
};

/** @deprecated use BulkShow — kept as alias for gradual renames */
export type BulkRow = BulkShow;

export function normalizeBulkClipHandoff(raw: BulkClipHandoff | null | undefined): BulkClipHandoff | null {
	if (!raw) return null;
	if (Array.isArray(raw.clips) && raw.clips.length) {
		return {
			sourceTitle: raw.sourceTitle ?? raw.title,
			sourceR2Key: raw.sourceR2Key,
			thumbnailUrl: raw.thumbnailUrl,
			clips: raw.clips.filter((c) => String(c?.videoUrl ?? '').trim()),
		};
	}
	const url = String(raw.videoUrl ?? '').trim();
	if (!url) return null;
	return {
		sourceTitle: raw.title ?? raw.sourceTitle,
		sourceR2Key: raw.sourceR2Key,
		thumbnailUrl: raw.thumbnailUrl,
		clips: [
			{
				videoUrl: url,
				clipStart: Number(raw.clipStart) || 0,
				clipEnd: Number(raw.clipEnd) || 0,
				headline: raw.title,
				thumbnailUrl: raw.thumbnailUrl,
				captions: raw.captions ?? null,
			},
		],
	};
}

export const BULK_EMOTIONS = [
	{ id: '', label: 'Any' },
	{ id: 'curious', label: 'Curious' },
	{ id: 'urgent', label: 'Urgent' },
	{ id: 'hopeful', label: 'Hopeful' },
	{ id: 'shocking', label: 'Shocking' },
	{ id: 'calm', label: 'Calm' },
	{ id: 'witty', label: 'Witty' },
	{ id: 'inspiring', label: 'Inspiring' },
] as const;

export type BulkEmotionId = (typeof BULK_EMOTIONS)[number]['id'];

export const BULK_AUDIENCES = [
	{ id: '', label: 'General audience' },
	{ id: 'beginners', label: 'Beginners / newcomers' },
	{ id: 'founders', label: 'Founders & entrepreneurs' },
	{ id: 'creators', label: 'Content creators' },
	{ id: 'marketers', label: 'Marketers' },
	{ id: 'developers', label: 'Developers & engineers' },
	{ id: 'students', label: 'Students' },
	{ id: 'professionals', label: 'Busy professionals' },
	{ id: 'parents', label: 'Parents' },
	{ id: 'investors', label: 'Investors' },
	{ id: 'travelers', label: 'Travelers' },
	{ id: 'fitness', label: 'Fitness & health seekers' },
	{ id: 'custom', label: 'Custom…' },
] as const;

export type BulkAudienceId = (typeof BULK_AUDIENCES)[number]['id'];

export const BULK_STYLES = [
	{ id: 'bold', label: 'Bold' },
	{ id: 'editorial', label: 'Editorial' },
	{ id: 'minimal', label: 'Minimal' },
] as const;

export type BulkStyleId = (typeof BULK_STYLES)[number]['id'];

/** Turn the picked audience (or free text) into a prompt-ready phrase. */
export function audiencePromptText(id: string, custom: string): string {
	if (id === 'custom') return custom.trim();
	return BULK_AUDIENCES.find((a) => a.id === id)?.label ?? '';
}

export { stripEmDashes } from '$lib/strip-em-dashes';

export function defaultRowCaptions(overrides?: Partial<BulkRowCaptions>): BulkRowCaptions {
	return {
		enabled: false,
		templateId: DEFAULT_BRAND_KIT.captionTemplateId,
		fontSize: DEFAULT_BRAND_KIT.captionFontSize,
		position: DEFAULT_BRAND_KIT.captionPosition,
		color: DEFAULT_BRAND_KIT.captionColor,
		...overrides,
	};
}

function isSafeStillUrl(url: string): boolean {
	const t = String(url ?? '').trim();
	if (!t || t.startsWith('blob:') || t.length >= 2000) return false;
	if (/\.(mp4|webm|mov)(\?|$)/i.test(t)) return false;
	if (/youtube\.com\/embed|youtu\.be\//i.test(t)) return false;
	return true;
}

/**
 * First-slide payload for Carousels library live previews.
 * Drops video playback URLs / caption tracks so list cards stay light.
 */
export function slimBulkCoverSlide(slide: BulkSlide | null | undefined): BulkSlide | null {
	if (!slide) return null;
	const template = coerceTemplateId(slide.template);
	const thumb = String(slide.mediaThumb ?? '').trim();
	const media = String(slide.mediaUrl ?? '').trim();
	const isVideo = slide.mediaKind === 'video';
	let safeStill = '';
	for (const candidate of [thumb, isVideo ? '' : media]) {
		if (isSafeStillUrl(candidate)) {
			safeStill = candidate.trim();
			break;
		}
	}

	const out: BulkSlide = {
		id: String(slide.id || 'cover'),
		template,
		headline: String(slide.headline ?? '').slice(0, 400),
		body: String(slide.body ?? '').slice(0, 600),
		captions: defaultRowCaptions({ enabled: false }),
		mediaKind: isVideo ? 'video' : safeStill ? 'image' : (slide.mediaKind ?? null),
		mediaThumb: safeStill || undefined,
		// Videos: omit playback so BulkSlidePreview uses the poster still.
		mediaUrl: isVideo ? undefined : safeStill || undefined,
		videoMuted: true,
	};

	const clipStart = Number(slide.clipStart);
	const clipEnd = Number(slide.clipEnd);
	if (Number.isFinite(clipStart) && clipStart >= 0) out.clipStart = clipStart;
	if (Number.isFinite(clipEnd) && clipEnd > 0) out.clipEnd = clipEnd;

	const newsHeadline = String(slide.clipMeta?.newsHeadline ?? '').trim();
	if (newsHeadline || slide.clipMeta?.clipId) {
		out.clipMeta = {
			clipId: String(slide.clipMeta?.clipId ?? ''),
			viralityScore: Number(slide.clipMeta?.viralityScore) || 0,
			hook: String(slide.clipMeta?.hook ?? '').slice(0, 200),
			reason: '',
			newsHeadline: newsHeadline || undefined,
		};
	}
	return out;
}

/** Reconstruct a cover slide from list-card summary fields when `coverSlide` is absent. */
export function coverSlideFromCardSummary(opts: {
	id?: string;
	template?: string;
	headline?: string;
	thumb?: string;
}): BulkSlide | null {
	const thumb = String(opts.thumb ?? '').trim();
	const headline = String(opts.headline ?? '').trim();
	if (!isSafeStillUrl(thumb) && !headline) return null;
	const still = isSafeStillUrl(thumb) ? thumb : '';
	return {
		id: String(opts.id || 'cover'),
		template: coerceTemplateId(opts.template || 'news'),
		headline: headline || ' ',
		body: '',
		captions: defaultRowCaptions({ enabled: false }),
		mediaKind: still ? 'image' : null,
		mediaThumb: still || undefined,
		mediaUrl: still || undefined,
		videoMuted: true,
	};
}

export function templateForSlideType(type: string): TemplateId {
	switch (String(type ?? '').toLowerCase()) {
		case 'hook':
			return 'news';
		case 'quote':
			return 'imageQuote';
		case 'tip':
			return 'blackText';
		case 'proof':
			return 'news';
		case 'cta':
			return 'news';
		case 'value':
			return 'textCarousel';
		default:
			return 'news';
	}
}

export function rowNeedsBody(template: TemplateId): boolean {
	return (
		template === 'blackText' ||
		isPhotoStoryFamily(template) ||
		template === 'textCarousel' ||
		isWhitePostFamily(template) ||
		template === 'article' ||
		template === 'news' ||
		template === 'tweet'
	);
}

function newId(): string {
	try {
		if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
			return crypto.randomUUID();
		}
	} catch {
		/* ignore */
	}
	return `id_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export function createBlankSlide(
	template: TemplateId = 'news',
	captionDefaults?: Partial<BulkRowCaptions>,
): BulkSlide {
	return {
		id: newId(),
		template: coerceTemplateId(template),
		headline: '',
		body: '',
		captions: defaultRowCaptions(captionDefaults),
	};
}

export function createBlankShow(
	template: TemplateId = 'news',
	captionDefaults?: Partial<BulkRowCaptions>,
	slideCount = 3,
): BulkShow {
	const n = Math.max(1, Math.min(12, Math.floor(Number(slideCount)) || 3));
	const tpl = coerceTemplateId(template);
	const slides = Array.from({ length: n }, () => createBlankSlide(tpl, captionDefaults));
	return {
		id: newId(),
		title: '',
		slides,
		activeSlideId: slides[0]!.id,
	};
}

/** @deprecated use createBlankShow */
export function createBlankRow(
	template: TemplateId = 'news',
	captionDefaults?: Partial<BulkRowCaptions>,
): BulkShow {
	return createBlankShow(template, captionDefaults, 1);
}

export function activeSlideOf(show: BulkShow): BulkSlide {
	const slides = Array.isArray(show?.slides) ? show.slides.filter(Boolean) : [];
	if (!slides.length) return createBlankSlide('news');
	return slides.find((s) => s.id === show.activeSlideId) ?? slides[0]!;
}

/**
 * Build Studio draft state from one slideshow (one idea).
 */
export function buildDraftStateFromShow(
	show: BulkShow,
	opts?: { brandCtaEnabled?: boolean; activeSlide?: number },
): Record<string, unknown> {
	const list = show.slides.length ? show.slides : [createBlankSlide()];
	const n = list.length;
	const slideTemplates = list.map((r) => coerceTemplateId(r.template));
	const slides = list.map((r) => {
		if (r.template === 'news' && r.clipMeta?.newsHeadline?.trim()) {
			return r.clipMeta.newsHeadline.trim();
		}
		return r.headline.trim() || ' ';
	});
	const slideIds = list.map((r) => r.id);

	const videoStoryHeadlineBySlide = list.map((r) =>
		isVideoStoryFamily(r.template) ? r.headline.trim() || VIDEO_STORY_DEFAULTS.headline : VIDEO_STORY_DEFAULTS.headline,
	);
	const videoStoryWatermarkBySlide = list.map(() => VIDEO_STORY_DEFAULTS.watermark);

	const blackTextHeadlineBySlide = list.map((r) => {
		if (r.template === 'blackText' || isPhotoStoryFamily(r.template)) {
			return (
				r.headline.trim() ||
				(r.template === 'photoTopic' ? PHOTO_TOPIC_DEFAULTS.headline : BLACK_TEXT_CAROUSEL_DEFAULTS.headline)
			);
		}
		return BLACK_TEXT_CAROUSEL_DEFAULTS.headline;
	});
	const blackTextBodyBySlide = list.map((r) => {
		if (r.template === 'blackText') return r.body.trim() || BLACK_TEXT_CAROUSEL_DEFAULTS.body;
		if (r.template === 'photoTopic') return r.body.trim() || PHOTO_TOPIC_DEFAULTS.body;
		if (r.template === 'photoCaption') return r.body.trim() || PHOTO_CAPTION_DEFAULTS.body;
		return BLACK_TEXT_CAROUSEL_DEFAULTS.body;
	});

	const imageQuoteTextBySlide = list.map((r) =>
		r.template === 'imageQuote' ? r.headline.trim() || IMAGE_QUOTE_DEFAULTS.body : IMAGE_QUOTE_DEFAULTS.body,
	);
	const textCarouselTextBySlide = list.map((r) => {
		if (r.template === 'textCarousel') {
			const h = r.headline.trim();
			const b = r.body.trim();
			if (h && b) return `${h}\n\n${b}`;
			return h || b || TEXT_CAROUSEL_DEFAULTS.body;
		}
		if (isWhitePostFamily(r.template)) {
			const h = r.headline.trim();
			const b = r.body.trim();
			if (h && b) return `${h}\n\n${b}`;
			return (
				h ||
				b ||
				(r.template === 'whiteMedia' ? WHITE_MEDIA_DEFAULTS.body : WHITE_THREAD_DEFAULTS.body)
			);
		}
		return TEXT_CAROUSEL_DEFAULTS.body;
	});
	const textCarouselNameBySlide = list.map(() => TEXT_CAROUSEL_DEFAULTS.name);
	const textCarouselHandleBySlide = list.map(() => TEXT_CAROUSEL_DEFAULTS.handle);
	const tweetTopTextBySlide = list.map((r) => (r.template === 'tweet' ? r.headline.trim() : ''));
	const tweetBottomTextBySlide = list.map((r) => (r.template === 'tweet' ? r.body.trim() : ''));
	const articleTextBySlide = list.map((r) =>
		r.template === 'article' ? r.body.trim() || r.headline.trim() : '',
	);
	const newsSubtextBySlide = list.map((r) => (r.template === 'news' ? r.body.trim() : ''));

	const bgImagesByTemplate: Record<string, string[]> = {};
	const bgVideosByTemplate: Record<string, string[]> = {};
	for (const tpl of new Set(slideTemplates)) {
		bgImagesByTemplate[tpl] = Array.from({ length: n }, () => '');
		bgVideosByTemplate[tpl] = Array.from({ length: n }, () => '');
	}
	list.forEach((r, i) => {
		const tpl = coerceTemplateId(r.template);
		const url = String(r.mediaUrl ?? '').trim();
		if (!url) return;
		if (r.mediaKind === 'video' || isVideoStoryFamily(tpl) || isVideoSplitFamily(tpl)) {
			if (!bgVideosByTemplate[tpl]) bgVideosByTemplate[tpl] = Array.from({ length: n }, () => '');
			bgVideosByTemplate[tpl]![i] = url;
		} else {
			if (!bgImagesByTemplate[tpl]) bgImagesByTemplate[tpl] = Array.from({ length: n }, () => '');
			bgImagesByTemplate[tpl]![i] = url;
		}
	});

	const activeIdx = Math.max(
		0,
		list.findIndex((s) => s.id === show.activeSlideId),
	);

	// Studio blanks the canvas before applying an import, which zeroes the News
	// shadow. Ship the defaults back so the headline keeps its dark shelf.
	const usesNews = slideTemplates.includes('news');
	const videoSlide = list.find((s) => s.mediaKind === 'video');
	const reframeAspect =
		parseReframeAspectFromSettingsKey(videoSlide?.reframeSettingsKey) ??
		(videoSlide?.reframedPlaybackUrl ? '9:16' : null);
	const formatId = videoSlide
		? studioFormatForReframeAspect(reframeAspect ?? '9:16')
		: 'feed';

	return {
		slideCount: n,
		activeSlide: opts?.activeSlide ?? (activeIdx >= 0 ? activeIdx : 0),
		formatId,
		bgFitMode: NEWS_DEFAULT_LAYOUT.bgFitMode,
		bgZoom: NEWS_DEFAULT_LAYOUT.bgZoom,
		bgOffsetX: NEWS_DEFAULT_LAYOUT.bgOffsetX,
		bgOffsetY: NEWS_DEFAULT_LAYOUT.bgOffsetY,
		bgContainMagnify: NEWS_DEFAULT_LAYOUT.bgContainMagnify,
		...(usesNews
			? {
					shadowHeight: NEWS_DEFAULT_LAYOUT.shadowHeight,
					shadowStrength: NEWS_DEFAULT_LAYOUT.shadowStrength,
					textPanelOffsetY: NEWS_DEFAULT_LAYOUT.textPanelOffsetY,
				}
			: {}),
		slides,
		slideTemplates,
		slideIds,
		videoStoryHeadlineBySlide,
		videoStoryWatermarkBySlide,
		blackTextHeadlineBySlide,
		blackTextBodyBySlide,
		imageQuoteTextBySlide,
		textCarouselTextBySlide,
		textCarouselNameBySlide,
		textCarouselHandleBySlide,
		tweetTopTextBySlide,
		tweetBottomTextBySlide,
		articleTextBySlide,
		newsSubtextBySlide,
		bgImagesByTemplate,
		bgVideosByTemplate,
		/** True when pyautoflip saliency already stacked faces into one 9:16 MP4. */
		videoSplitCompositedBySlide: list.map(
			(r) =>
				isVideoSplitFamily(coerceTemplateId(r.template)) &&
				String(r.reframeSettingsKey ?? '').includes('|saliency|'),
		),
		brandCtaEnabled: opts?.brandCtaEnabled === true,
		exportedSlides: [],
		_fromBulk: true,
		_bulkTitle: show.title,
		_bulkCaptions: list.map((r) => ({ ...r.captions })),
		/** Timed CapCut captions per slide for Studio overlay + drag. */
		_studioCaptionsBySlide: list.map((r) => resolveStudioCaptionImportForSlide(r)),
	};
}

/** @deprecated use buildDraftStateFromShow */
export function buildDraftStateFromBulkRows(
	rows: BulkSlide[],
	opts?: { brandCtaEnabled?: boolean; activeSlide?: number },
): Record<string, unknown> {
	const show: BulkShow = {
		id: 'legacy',
		title: '',
		slides: rows,
		activeSlideId: rows[0]?.id ?? '',
	};
	return buildDraftStateFromShow(show, opts);
}

export function stashBulkImport(state: Record<string, unknown>): void {
	if (typeof window === 'undefined') return;
	const json = JSON.stringify(state);
	try {
		sessionStorage.setItem(STUDIO_BULK_IMPORT_KEY, json);
	} catch {
		/* ignore */
	}
	try {
		localStorage.setItem(STUDIO_BULK_IMPORT_KEY, json);
	} catch {
		/* ignore */
	}
}

export function takeBulkImport(): Record<string, unknown> | null {
	if (typeof window === 'undefined') return null;
	const raw =
		sessionStorage.getItem(STUDIO_BULK_IMPORT_KEY) ?? localStorage.getItem(STUDIO_BULK_IMPORT_KEY);
	try {
		sessionStorage.removeItem(STUDIO_BULK_IMPORT_KEY);
	} catch {
		/* ignore */
	}
	try {
		localStorage.removeItem(STUDIO_BULK_IMPORT_KEY);
	} catch {
		/* ignore */
	}
	if (!raw) return null;
	try {
		const parsed = JSON.parse(raw) as Record<string, unknown>;
		if (!parsed || !Array.isArray(parsed.slideTemplates)) return null;
		return parsed;
	} catch {
		return null;
	}
}

export function peekBulkImport(): Record<string, unknown> | null {
	if (typeof window === 'undefined') return null;
	const raw =
		sessionStorage.getItem(STUDIO_BULK_IMPORT_KEY) ?? localStorage.getItem(STUDIO_BULK_IMPORT_KEY);
	if (!raw) return null;
	try {
		return JSON.parse(raw) as Record<string, unknown>;
	} catch {
		return null;
	}
}

export function stashBulkClipHandoff(payload: BulkClipHandoff): void {
	if (typeof window === 'undefined') return;
	const normalized = normalizeBulkClipHandoff(payload);
	if (!normalized) return;
	try {
		sessionStorage.setItem(BULK_CLIP_HANDOFF_KEY, JSON.stringify(normalized));
	} catch {
		/* ignore */
	}
}

export function takeBulkClipHandoff(): BulkClipHandoff | null {
	if (typeof window === 'undefined') return null;
	const raw = sessionStorage.getItem(BULK_CLIP_HANDOFF_KEY);
	try {
		sessionStorage.removeItem(BULK_CLIP_HANDOFF_KEY);
	} catch {
		/* ignore */
	}
	if (!raw) return null;
	try {
		return normalizeBulkClipHandoff(JSON.parse(raw) as BulkClipHandoff);
	} catch {
		return null;
	}
}

export function peekBulkClipHandoff(): BulkClipHandoff | null {
	if (typeof window === 'undefined') return null;
	const raw = sessionStorage.getItem(BULK_CLIP_HANDOFF_KEY);
	if (!raw) return null;
	try {
		return normalizeBulkClipHandoff(JSON.parse(raw) as BulkClipHandoff);
	} catch {
		return null;
	}
}
