/** Studio canvas template ids — shared by News Studio routes and merge/import helpers. */
export type TemplateId = 'news' | 'tweet' | 'article' | 'textCarousel' | 'imageQuote';

export type StudioTemplateDef = { id: TemplateId; label: string };

export const STUDIO_TEMPLATES: StudioTemplateDef[] = [
	{ id: 'news', label: 'News' },
	{ id: 'tweet', label: 'Tweet' },
	{ id: 'article', label: 'Article' },
	{ id: 'textCarousel', label: 'Text carousel' },
	{ id: 'imageQuote', label: 'Image quote' },
];

/** `?template=` query values → `TemplateId` (unknown keys should fall back to `news`). */
export function mapQueryParamToTemplateId(raw: string): TemplateId | undefined {
	const map: Record<string, TemplateId> = {
		news: 'news',
		tweet: 'tweet',
		article: 'article',
		text: 'textCarousel',
		textCarousel: 'textCarousel',
		'image-quote': 'imageQuote',
		imageQuote: 'imageQuote',
	};
	return map[raw];
}
