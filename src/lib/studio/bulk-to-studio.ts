/** Bulk workspace: each idea is its own multi-slide slideshow. */

import type { TemplateId } from './template-ids';
import { coerceTemplateId, isPhotoStoryFamily, isVideoStoryFamily, isWhitePostFamily } from './template-ids';
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
import { DEFAULT_BRAND_KIT } from './brand-kit';

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
	mediaUrl?: string;
	mediaKind?: 'image' | 'video' | null;
	mediaThumb?: string;
	mediaLoading?: boolean;
};

/** One idea = one full slideshow (multiple slides). */
export type BulkShow = {
	id: string;
	/** Short idea / deck title */
	title: string;
	slides: BulkSlide[];
	/** Which slide is selected for editing in this show */
	activeSlideId: string;
};

/** @deprecated use BulkShow — kept as alias for gradual renames */
export type BulkRow = BulkShow;

export type BulkClipHandoff = {
	videoUrl: string;
	clipStart: number;
	clipEnd: number;
	thumbnailUrl?: string;
	title?: string;
	captions?: StudioClipCaptionImport | null;
};

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

/** Turn the picked audience (or free text) into a prompt-ready phrase. */
export function audiencePromptText(id: string, custom: string): string {
	if (id === 'custom') return custom.trim();
	return BULK_AUDIENCES.find((a) => a.id === id)?.label ?? '';
}

export function stripEmDashes(text: string): string {
	return String(text ?? '')
		.replace(/\u2014/g, ' - ')
		.replace(/\u2013/g, '-')
		.replace(/\s+-\s+/g, ' - ')
		.replace(/ {2,}/g, ' ')
		.trim();
}

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
	const slides = Array.from({ length: n }, (_, i) =>
		createBlankSlide(i === 0 ? template : 'textCarousel', captionDefaults),
	);
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
	const slides = list.map((r) => r.headline.trim() || ' ');
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
		if (r.mediaKind === 'video' || isVideoStoryFamily(tpl)) {
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

	return {
		slideCount: n,
		activeSlide: opts?.activeSlide ?? (activeIdx >= 0 ? activeIdx : 0),
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
		brandCtaEnabled: opts?.brandCtaEnabled === true,
		exportedSlides: [],
		_fromBulk: true,
		_bulkTitle: show.title,
		_bulkCaptions: list.map((r) => ({ ...r.captions })),
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
	try {
		sessionStorage.setItem(BULK_CLIP_HANDOFF_KEY, JSON.stringify(payload));
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
		const parsed = JSON.parse(raw) as BulkClipHandoff;
		if (!parsed?.videoUrl) return null;
		return parsed;
	} catch {
		return null;
	}
}

export function peekBulkClipHandoff(): BulkClipHandoff | null {
	if (typeof window === 'undefined') return null;
	const raw = sessionStorage.getItem(BULK_CLIP_HANDOFF_KEY);
	if (!raw) return null;
	try {
		return JSON.parse(raw) as BulkClipHandoff;
	} catch {
		return null;
	}
}
