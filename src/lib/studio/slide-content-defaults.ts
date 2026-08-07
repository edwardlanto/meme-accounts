import { STUDIO_TEMPLATES, type TemplateId } from './template-ids';
import { GENERATED_DEMO_POSTS as D } from './generated-demo-posts';

/** Demo headline when opening News (real story fetch replaces this). */
export const NEWS_PLACEHOLDER_HEADLINE = D.news.headline;

/** Supporting paragraph under the News headline (matches bulk-generated decks). */
export const NEWS_DEFAULT_SUBTEXT =
	typeof D.news.body === 'string' && D.news.body.trim()
		? D.news.body
		: 'The largest AI check ever written - and the market treated it like a Tuesday. SoftBank is all-in on the next decade of compute.';

export const NEWS_DEFAULT_SOURCE = D.news.source;

/** Optional News source logo asset (user can switch source label to logo mode). */
export const NEWS_DEFAULT_SOURCE_LOGO = '/logo/meme-accounts-logo.webp';

/** Default News badge / canvas geometry (matches initial studio state). */
export const NEWS_DEFAULT_LAYOUT = {
	circleX: 772,
	circleY: 52,
	circleSize: 300,
	circle2X: 80,
	circle2Y: 80,
	circle2Size: 220,
	bgOffsetX: 50,
	bgOffsetY: 50,
	bgZoom: 100,
	bgFitMode: 'cover' as const,
	bgContainMagnify: 140,
	textPanelOffsetY: 0,
	shadowHeight: 75,
	shadowStrength: 1,
};

export const NEWS_DEMO_IMAGE = D.news.imageUrl;
/** Default News canvas media — looping demo clip (preferred over {@link NEWS_DEMO_IMAGE}). */
export const NEWS_DEMO_VIDEO = '/videos/demos/founder-talk.mp4';

export const TWEET_DEFAULTS = {
	topName: D.tweet.topName,
	topHandle: D.tweet.topHandle,
	bottomName: D.tweet.bottomName,
	bottomHandle: D.tweet.bottomHandle,
	topText: D.tweet.topText,
	bottomText: D.tweet.bottomText,
	replyCount: '4.2K',
	repostCount: '12.8K',
	likeCount: '89.4K',
	topImageHeight: 720,
	topImageWidth: 920,
	topImageZoom: 1,
	topImagePanX: 50,
	topImagePanY: 50,
	topImage: D.tweet.imageUrl,
} as const;

export const ARTICLE_DEFAULT_BODY =
	"Here's the trillion-dollar problem everyone avoids.\n\nTo break it down:\n\nA *1-gigawatt AI data center* costs roughly *$80B* to build & operate.";
export const ARTICLE_DEFAULT_SWIPE = '«« Swipe';

export const TEXT_CAROUSEL_DEFAULTS = {
	name: D.text.name,
	handle: D.text.handle,
	body: D.text.body,
} as const;

/** Minimum plain-text length for text carousel body (studio + API fills). */
export const TEXT_CAROUSEL_BODY_MIN_CHARS = TEXT_CAROUSEL_DEFAULTS.body.trim().length;

const LEGACY_MOMENTUM_PARA =
	'End with momentum — a reason to engage, click, or remember you.';

/** Drop the retired third default paragraph if it is still present in saved decks. */
export function stripLegacyTextCarouselMomentum(body: string): string {
	return String(body ?? '')
		.replace(/\r\n/g, '\n')
		.split(/\n\s*\n+/)
		.map((p) => p.trim())
		.filter((p) => p && p !== LEGACY_MOMENTUM_PARA)
		.join('\n\n')
		.trim();
}

/**
 * If body is shorter than {@link TEXT_CAROUSEL_BODY_MIN_CHARS}, append the default deck copy
 * so slides stay visually full. Empty input becomes the full default body.
 */
export function ensureTextCarouselBodyMinLength(body: string): string {
	const min = TEXT_CAROUSEL_BODY_MIN_CHARS;
	let out = stripLegacyTextCarouselMomentum(body);
	if (out.length >= min) return out;
	const filler = String(TEXT_CAROUSEL_DEFAULTS.body)
		.trim()
		.replace(/\r\n/g, '\n');
	if (!filler.length) return out;
	let guard = 0;
	while (out.length < min && guard++ < 6) {
		out = out ? `${out}\n\n${filler}` : filler;
	}
	return out;
}

export const IMAGE_QUOTE_DEFAULTS = {
	imageUrl: D['image-quote'].imageUrl,
	body: D['image-quote'].body,
	footerLeft: D['image-quote'].footerLeft,
	footerRight: D['image-quote'].footerRight,
	topRatio: D['image-quote'].topRatio,
} as const;

/**
 * Black letterbox / film-strip heights as % of canvas height.
 * Each side is 0–100%; top + bottom are capped at 100% so 50/50 meets in the middle.
 */
export type FilmStripPct = { topPct: number; bottomPct: number };

/** Structural templates keep their layout defaults; everyone else starts at 0. */
export function filmStripDefaultsFor(id: TemplateId): FilmStripPct {
	switch (id) {
		case 'imageQuote':
			return { topPct: 0, bottomPct: 37 };
		case 'videoHook':
			return { topPct: 26, bottomPct: 10 };
		case 'videoCreator':
			return { topPct: 28, bottomPct: 8 };
		case 'videoSource':
			return { topPct: 30, bottomPct: 8 };
		default:
			return { topPct: 0, bottomPct: 0 };
	}
}

/** @deprecated Prefer `filmStripDefaultsFor` — kept for call sites that indexed by structural id. */
export const FILM_STRIP_DEFAULTS: Record<
	'imageQuote' | 'videoHook' | 'videoCreator' | 'videoSource',
	FilmStripPct
> = {
	imageQuote: { topPct: 0, bottomPct: 37 },
	videoHook: { topPct: 26, bottomPct: 10 },
	videoCreator: { topPct: 28, bottomPct: 8 },
	videoSource: { topPct: 30, bottomPct: 8 },
};

/** Combined top+bottom cannot exceed full canvas (50+50 aligns at center). */
export const FILM_STRIP_MAX_SUM_PCT = 100;
/** Each bar can cover the full height on its own. */
export const FILM_STRIP_MAX_SIDE_PCT = 100;

export function clampFilmStripPct(
	topPct: number,
	bottomPct: number,
	prefer: 'top' | 'bottom' = 'top',
): FilmStripPct {
	let top = Math.max(0, Math.min(FILM_STRIP_MAX_SIDE_PCT, Number(topPct) || 0));
	let bottom = Math.max(0, Math.min(FILM_STRIP_MAX_SIDE_PCT, Number(bottomPct) || 0));
	if (top + bottom > FILM_STRIP_MAX_SUM_PCT) {
		const overflow = top + bottom - FILM_STRIP_MAX_SUM_PCT;
		if (prefer === 'bottom') {
			top = Math.max(0, top - overflow);
			if (top + bottom > FILM_STRIP_MAX_SUM_PCT) {
				bottom = Math.max(0, FILM_STRIP_MAX_SUM_PCT - top);
			}
		} else {
			bottom = Math.max(0, bottom - overflow);
			if (top + bottom > FILM_STRIP_MAX_SUM_PCT) {
				top = Math.max(0, FILM_STRIP_MAX_SUM_PCT - bottom);
			}
		}
	}
	return { topPct: Math.round(top * 10) / 10, bottomPct: Math.round(bottom * 10) / 10 };
}

/** Black full-bleed carousel: left-aligned profile + gold hook + white body. */
export const BLACK_TEXT_CAROUSEL_DEFAULTS = {
	name: D['black-text'].name,
	handle: D['black-text'].handle,
	headline: D['black-text'].headline,
	body: D['black-text'].body,
	headlineColor: '#E8C547',
} as const;

export const VIDEO_STORY_DEFAULTS = {
	videoUrl: D['video-story'].videoUrl,
	watermark: D['video-story'].watermark,
	headline: D['video-story'].headline,
	posterUrl: D['video-story'].posterUrl,
} as const;

/** Split top/bottom media with a centered brand bar (Rumble-style clip posts). */
export const BRAND_STACK_DEFAULTS = {
	topVideoUrl: D['brand-stack'].videoUrl,
	bottomMediaUrl: D['brand-stack'].bottomMediaUrl,
	watermark: D['brand-stack'].watermark,
	headline: D['brand-stack'].headline,
	brand: D['brand-stack'].brand,
	posterUrl: D['brand-stack'].posterUrl,
} as const;

export const BRAND_STACK_HEADLINE_STYLE = {
	color: '#0f172a',
	fontWeight: 700,
	fontFamily: 'Satoshi',
	fontSize: 36,
	align: 'center' as const,
} as const;

/** Dual-panel 9:16 — pyautoflip saliency multi-face stack. */
export const VIDEO_SPLIT_DEFAULTS = {
	videoUrl: D['video-split'].videoUrl,
	badgeLabel: 'Output (9:16)',
	posterUrl: D['video-split'].posterUrl,
} as const;

/** Readable on the black video-story canvas (Studio + clip previews). */
export const VIDEO_STORY_HEADLINE_STYLE = {
	color: '#f4f4f5',
	fontWeight: 600,
	fontFamily: 'Satoshi',
	fontSize: 46,
} as const;

/** Black letterbox + large white hook above the clip (Hook video template). */
export const VIDEO_HOOK_DEFAULTS = {
	videoUrl: D['video-hook'].videoUrl,
	watermark: '',
	headline: D['video-hook'].headline,
	posterUrl: D['video-hook'].posterUrl,
} as const;

export const VIDEO_HOOK_HEADLINE_STYLE = {
	color: '#ffffff',
	fontWeight: 400,
	fontFamily: 'Satoshi',
	fontSize: 56,
	align: 'left' as const,
} as const;

/**
 * Creator hook: profile row + sentence-case headline (optional [[bold]] emphasis)
 * above a letterboxed clip on black.
 */
export const VIDEO_CREATOR_DEFAULTS = {
	videoUrl: D['video-creator'].videoUrl,
	name: D['video-creator'].name,
	handle: D['video-creator'].handle,
	headline: D['video-creator'].headline,
	posterUrl: D['video-creator'].posterUrl,
} as const;

export const VIDEO_CREATOR_HEADLINE_STYLE = {
	color: '#ffffff',
	fontWeight: 400,
	fontFamily: 'Satoshi',
	fontSize: 48,
	align: 'left' as const,
} as const;

/**
 * Clip post: profile row (no verified badge) + casual hook above a wide letterboxed clip.
 */
export const VIDEO_POST_DEFAULTS = {
	videoUrl: D['video-post'].videoUrl,
	name: D['video-post'].name,
	handle: D['video-post'].handle,
	avatarUrl: D['video-post'].avatarUrl,
	headline: D['video-post'].headline,
	posterUrl: D['video-post'].posterUrl,
} as const;

export const VIDEO_POST_HEADLINE_STYLE = {
	color: '#ffffff',
	fontWeight: 600,
	fontFamily: 'Satoshi',
	fontSize: 44,
	align: 'left' as const,
} as const;

/** Full-bleed video with centered outlined white text (Text on video template). */
export const VIDEO_TEXT_DEFAULTS = {
	videoUrl: D['video-text'].videoUrl,
	watermark: '',
	headline: D['video-text'].headline,
	posterUrl: D['video-text'].posterUrl,
} as const;

export const VIDEO_TEXT_HEADLINE_STYLE = {
	color: '#ffffff',
	fontWeight: 800,
	fontFamily: 'Satoshi',
	fontSize: 64,
	align: 'center' as const,
} as const;

/**
 * Highlight: full multi-line hook with one neon [[highlighted]] word above a full-width clip.
 */
export const VIDEO_SOURCE_DEFAULTS = {
	videoUrl: D['video-source'].videoUrl,
	watermark: '',
	headline: D['video-source'].headline,
	highlightColor: D['video-source'].highlightColor,
	posterUrl: D['video-source'].posterUrl,
} as const;

export const VIDEO_SOURCE_HEADLINE_STYLE = {
	color: '#ffffff',
	fontWeight: 400,
	fontFamily: 'Satoshi',
	fontSize: 48,
	align: 'left' as const,
	lineHeight: 1.28,
} as const;

/**
 * Feature card: left-aligned headline + body with teal [[highlights]],
 * rounded landscape media in the lower half on black.
 */
export const VIDEO_FEATURE_DEFAULTS = {
	videoUrl: D['video-feature'].videoUrl,
	highlightColor: D['video-feature'].highlightColor,
	headline: D['video-feature'].headline,
	body: D['video-feature'].body,
	posterUrl: D['video-feature'].posterUrl,
} as const;

export const VIDEO_FEATURE_HEADLINE_STYLE = {
	color: '#ffffff',
	fontWeight: 700,
	fontFamily: 'Satoshi',
	fontSize: 44,
	align: 'left' as const,
} as const;

export const VIDEO_FEATURE_BODY_STYLE = {
	color: '#ffffff',
	fontWeight: 500,
	fontFamily: 'Satoshi',
	fontSize: 32,
	align: 'left' as const,
} as const;

/** Image top + centered title/body on black (Topic card). */
export const PHOTO_TOPIC_DEFAULTS = {
	imageUrl: '/images/templates/topic-bg.jpeg',
	headlineColor: '#95B8F6',
	headline: 'REGENERATIVE\nMEDICINE',
	body: 'Stem cells, tissue engineering, and lab-grown organs aim to repair or replace failing body parts, reducing the need for transplants and extending functional lifespan.',
} as const;

export const PHOTO_TOPIC_HEADLINE_STYLE = {
	color: '#95B8F6',
	fontWeight: 400,
	fontFamily: 'Bebas Neue',
	fontSize: 96,
	align: 'center' as const,
	letterSpacing: 0.06,
	lineHeight: 0.92,
} as const;

export const PHOTO_TOPIC_BODY_STYLE = {
	color: '#ffffff',
	fontWeight: 400,
	fontFamily: 'Montserrat',
	fontSize: 32,
	align: 'center' as const,
	lineHeight: 1.45,
} as const;

/** Full-bleed photo with top gradient + left caption paragraphs (Photo caption). */
export const PHOTO_CAPTION_DEFAULTS = {
	imageUrl: D['photo-caption'].imageUrl,
	headline: D['photo-caption'].headline,
	body: D['photo-caption'].body,
} as const;

/** White card: profile row + multi-paragraph thread body (no emoji CTA). */
export const WHITE_THREAD_DEFAULTS = {
	name: D['white-thread'].name,
	handle: D['white-thread'].handle,
	avatarUrl: D['white-thread'].avatarUrl,
	body: D['white-thread'].body,
} as const;

/** White card: profile + short copy + rounded media attachment. */
export const WHITE_MEDIA_DEFAULTS = {
	name: D['white-media'].name,
	handle: D['white-media'].handle,
	avatarUrl: D['white-media'].avatarUrl,
	imageUrl: D['white-media'].imageUrl,
	body: D['white-media'].body,
} as const;

/** Labels for docs / error messages when extending templates. */
export function templateLabel(id: TemplateId): string {
	return STUDIO_TEMPLATES.find((t) => t.id === id)?.label ?? id;
}

/**
 * Still-image fallback for Carousels / library cards when a draft has no
 * captured `draftPreviewKey` and no usable `bgImagesByTemplate` entry.
 * Video templates use demo posters; photo templates use their default image.
 */
export function defaultThumbForTemplate(id: TemplateId): string {
	switch (id) {
		case 'news':
			return NEWS_DEMO_IMAGE;
		case 'tweet':
			return TWEET_DEFAULTS.topImage;
		case 'imageQuote':
			return IMAGE_QUOTE_DEFAULTS.imageUrl;
		case 'blackText':
			return '';
		case 'videoFeature':
			return VIDEO_FEATURE_DEFAULTS.posterUrl;
		case 'videoHook':
			return VIDEO_HOOK_DEFAULTS.posterUrl;
		case 'videoCreator':
			return VIDEO_CREATOR_DEFAULTS.posterUrl;
		case 'videoText':
			return VIDEO_TEXT_DEFAULTS.posterUrl;
		case 'videoSource':
			return VIDEO_SOURCE_DEFAULTS.posterUrl;
		case 'videoPost':
			return VIDEO_POST_DEFAULTS.posterUrl;
		case 'videoSplit':
			return VIDEO_SPLIT_DEFAULTS.posterUrl;
		case 'brandStack':
			return BRAND_STACK_DEFAULTS.posterUrl;
		case 'photoTopic':
			return PHOTO_TOPIC_DEFAULTS.imageUrl;
		case 'photoCaption':
			return PHOTO_CAPTION_DEFAULTS.imageUrl;
		case 'whiteMedia':
			return WHITE_MEDIA_DEFAULTS.imageUrl;
		case 'videoFit':
			return D['video-fit'].posterUrl;
		case 'videoBlur':
			return D['video-blur'].posterUrl;
		case 'videoStory':
			return VIDEO_STORY_DEFAULTS.posterUrl;
		default:
			return '';
	}
}
