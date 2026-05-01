/** Studio canvas template ids — shared by News Studio routes and merge/import helpers. */
export type TemplateId = 'news' | 'tweet' | 'article' | 'textCarousel' | 'imageQuote' | 'videoStory';

export type StudioTemplateDef = { id: TemplateId; label: string };

export const STUDIO_TEMPLATES: StudioTemplateDef[] = [
	{ id: 'news', label: 'News' },
	{ id: 'tweet', label: 'Tweet' },
	// { id: 'article', label: 'Article' },
	{ id: 'textCarousel', label: 'Text carousel' },
	{ id: 'videoStory', label: 'Video story' },
	{ id: 'imageQuote', label: 'Image quote' },
];

/** Keys must be lowercase — `mapQueryParamToTemplateId` lowercases before lookup. */
const QUERY_TEMPLATE_MAP: Record<string, TemplateId> = {
	news: 'news',
	tweet: 'tweet',
	article: 'article',
	text: 'textCarousel',
	textcarousel: 'textCarousel',
	'image-quote': 'imageQuote',
	imagequote: 'imageQuote',
	video: 'videoStory',
	videostory: 'videoStory',
};

/** `?template=` query values → `TemplateId` (unknown keys should fall back to `news`). */
export function mapQueryParamToTemplateId(raw: string): TemplateId | undefined {
	const key = String(raw ?? '').trim().toLowerCase();
	if (!key) return undefined;
	return QUERY_TEMPLATE_MAP[key];
}

const CANONICAL_TEMPLATE_IDS: TemplateId[] = [
	'news',
	'tweet',
	'article',
	'textCarousel',
	'imageQuote',
	'videoStory',
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
