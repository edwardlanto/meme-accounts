/** Studio canvas template ids — shared by News Studio routes and merge/import helpers. */
export type TemplateId =
	| 'blank'
	| 'news'
	| 'tweet'
	| 'article'
	| 'textCarousel'
	| 'imageQuote'
	| 'videoStory'
	| 'videoFit'
	| 'videoBlur'
	| 'blackText';

export type StudioTemplateDef = { id: TemplateId; label: string };

export const STUDIO_TEMPLATES: StudioTemplateDef[] = [
	{ id: 'blank', label: 'Blank' },
	{ id: 'news', label: 'News' },
	{ id: 'tweet', label: 'Tweet' },
	// { id: 'article', label: 'Article' },
	{ id: 'textCarousel', label: 'Text carousel' },
	{ id: 'videoFit', label: 'Fit video' },
	{ id: 'videoBlur', label: 'Blur' },
	{ id: 'videoStory', label: 'Video story' },
	{ id: 'imageQuote', label: 'Image quote' },
	{ id: 'blackText', label: 'Black text' },
];

/** Keys must be lowercase — `mapQueryParamToTemplateId` lowercases before lookup. */
const QUERY_TEMPLATE_MAP: Record<string, TemplateId> = {
	blank: 'blank',
	news: 'news',
	tweet: 'tweet',
	article: 'article',
	text: 'textCarousel',
	textcarousel: 'textCarousel',
	'image-quote': 'imageQuote',
	imagequote: 'imageQuote',
	video: 'videoStory',
	videostory: 'videoStory',
	videofit: 'videoFit',
	'video-fit': 'videoFit',
	fit: 'videoFit',
	videoblur: 'videoBlur',
	'video-blur': 'videoBlur',
	blur: 'videoBlur',
	'black-text': 'blackText',
	blacktext: 'blackText',
	black: 'blackText',
};

/** `?template=` query values → `TemplateId` (unknown keys should fall back to `news`). */
export function mapQueryParamToTemplateId(raw: string): TemplateId | undefined {
	const key = String(raw ?? '').trim().toLowerCase();
	if (!key) return undefined;
	return QUERY_TEMPLATE_MAP[key];
}

const CANONICAL_TEMPLATE_IDS: TemplateId[] = [
	'blank',
	'news',
	'tweet',
	'article',
	'textCarousel',
	'imageQuote',
	'videoStory',
	'videoFit',
	'videoBlur',
	'blackText',
];

/** Normalize draft/API/legacy strings to a valid template id (never returns invalid ids). */
export function coerceTemplateId(raw: unknown): TemplateId {
	const s = String(raw ?? '').trim();
	if (!s) return 'news';
	const lower = s.toLowerCase();
	// Query aliases (map keys are lowercase where ambiguous).
	const fromQuery = mapQueryParamToTemplateId(lower);
	if (fromQuery) return fromQuery;
	// Stored ids are camelCase (`textCarousel`, …); match case-insensitively — don't use
	// includes(lower) against camelCase literals (always fails).
	const hit = CANONICAL_TEMPLATE_IDS.find((id) => id.toLowerCase() === lower);
	return hit ?? 'news';
}

/** Map fit/blur/story template ids to VideoStoryTemplate layout prop. */
export function videoLayoutForTemplate(id: TemplateId): 'story' | 'fit' | 'blur' {
	if (id === 'videoFit') return 'fit';
	if (id === 'videoBlur') return 'blur';
	return 'story';
}

export function isVideoStoryFamily(id: TemplateId): boolean {
	return id === 'videoStory' || id === 'videoFit' || id === 'videoBlur';
}
