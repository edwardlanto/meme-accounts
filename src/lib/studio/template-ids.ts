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
	| 'videoHook'
	| 'videoCreator'
	| 'videoText'
	| 'videoSource'
	| 'videoFeature'
	| 'videoPost'
	| 'videoSplit'
	| 'brandStack'
	| 'photoTopic'
	| 'photoCaption'
	| 'whiteThread'
	| 'whiteMedia'
	| 'blackText';

export type StudioTemplateDef = { id: TemplateId; label: string };

export const STUDIO_TEMPLATES: StudioTemplateDef[] = [
	{ id: 'blank', label: 'Blank' },
	{ id: 'news', label: 'News' },
	{ id: 'tweet', label: 'Tweet' },
	// { id: 'article', label: 'Article' },
	{ id: 'textCarousel', label: 'Text carousel' },
	{ id: 'whiteThread', label: 'White thread' },
	{ id: 'whiteMedia', label: 'White media' },
	{ id: 'photoCaption', label: 'Photo caption' },
	{ id: 'videoPost', label: 'Clip post' },
	{ id: 'videoFeature', label: 'Feature card' },
	{ id: 'videoSource', label: 'Highlight' },
	{ id: 'videoText', label: 'Text on video' },
	{ id: 'videoCreator', label: 'Creator hook' },
	{ id: 'videoHook', label: 'Hook video' },
	{ id: 'videoFit', label: 'Fit video' },
	{ id: 'videoSplit', label: 'Multi split' },
	{ id: 'videoBlur', label: 'Blur' },
	{ id: 'videoStory', label: 'Video story' },
	{ id: 'brandStack', label: 'Brand stack' },
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
	videosplit: 'videoSplit',
	'video-split': 'videoSplit',
	split: 'videoSplit',
	'multi-split': 'videoSplit',
	multisplit: 'videoSplit',
	'dual-split': 'videoSplit',
	autoflip: 'videoSplit',
	videohook: 'videoHook',
	'video-hook': 'videoHook',
	hook: 'videoHook',
	videocreator: 'videoCreator',
	'video-creator': 'videoCreator',
	creator: 'videoCreator',
	'creator-hook': 'videoCreator',
	'profile-hook': 'videoCreator',
	videotext: 'videoText',
	'video-text': 'videoText',
	'text-on-video': 'videoText',
	pov: 'videoText',
	cover: 'videoText',
	videosource: 'videoSource',
	'video-source': 'videoSource',
	'source-hook': 'videoSource',
	source: 'videoSource',
	highlight: 'videoSource',
	videofeature: 'videoFeature',
	'video-feature': 'videoFeature',
	feature: 'videoFeature',
	'feature-card': 'videoFeature',
	launch: 'videoFeature',
	videopost: 'videoPost',
	'video-post': 'videoPost',
	'clip-post': 'videoPost',
	clippost: 'videoPost',
	clip: 'videoPost',
	mma: 'videoPost',
	brandstack: 'brandStack',
	'brand-stack': 'brandStack',
	stack: 'brandStack',
	'rumble-stack': 'brandStack',
	photocaption: 'photoCaption',
	'photo-caption': 'photoCaption',
	caption: 'photoCaption',
	whitethread: 'whiteThread',
	'white-thread': 'whiteThread',
	thread: 'whiteThread',
	'text-thread': 'whiteThread',
	whitemedia: 'whiteMedia',
	'white-media': 'whiteMedia',
	'post-media': 'whiteMedia',
	'media-post': 'whiteMedia',
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
	'videoSplit',
	'videoBlur',
	'videoHook',
	'videoCreator',
	'videoText',
	'videoSource',
	'videoFeature',
	'videoPost',
	'brandStack',
	'photoTopic',
	'photoCaption',
	'whiteThread',
	'whiteMedia',
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
export function videoLayoutForTemplate(
	id: TemplateId,
): 'story' | 'fit' | 'blur' | 'hook' | 'creator' | 'text' | 'source' | 'feature' | 'post' {
	if (id === 'videoPost') return 'post';
	if (id === 'videoFeature') return 'feature';
	if (id === 'videoSource') return 'source';
	if (id === 'videoText') return 'text';
	if (id === 'videoCreator') return 'creator';
	if (id === 'videoHook') return 'hook';
	if (id === 'videoFit') return 'fit';
	if (id === 'videoBlur') return 'blur';
	return 'story';
}

export function isBrandStackFamily(id: TemplateId): boolean {
	return id === 'brandStack';
}

/** Dual-panel / pyautoflip multi-face saliency split. */
export function isVideoSplitFamily(id: TemplateId): boolean {
	return id === 'videoSplit';
}

export function isVideoStoryFamily(id: TemplateId): boolean {
	return (
		id === 'videoStory' ||
		id === 'videoFit' ||
		id === 'videoBlur' ||
		id === 'videoHook' ||
		id === 'videoCreator' ||
		id === 'videoText' ||
		id === 'videoSource' ||
		id === 'videoFeature' ||
		id === 'videoPost'
	);
}

export function isPhotoStoryFamily(id: TemplateId): boolean {
	return id === 'photoTopic' || id === 'photoCaption';
}

/** White X/IG-style posts: profile header + body (± rounded media). */
export function isWhitePostFamily(id: TemplateId): boolean {
	return id === 'whiteThread' || id === 'whiteMedia';
}
