/** Prompt-bar / compose settings persisted in localStorage across Studio reloads. */

import { BULK_EMOTIONS, BULK_STYLES, type BulkEmotionId, type BulkStyleId } from './bulk-to-studio';

export const STUDIO_COMPOSE_PREFS_KEY = 'studio_compose_prefs_v1';

export type NewsStudioContentMode = 'general' | 'news' | 'fact' | 'story' | 'quote' | 'steps';
export type NewsImageSourceMode = 'assets' | 'pull' | 'ai';
export type StockMediaKind = 'photo' | 'video';
export type NewsCopyLength = 'default' | 'standard' | 'short';
export type StudioFormatId = 'feed' | 'vertical' | 'wide' | 'square';

export type StudioComposePrefs = {
	formatId: StudioFormatId;
	search: string;
	category: string;
	newsContentMode: NewsStudioContentMode;
	newsImageSourceMode: NewsImageSourceMode;
	stockMediaKind: StockMediaKind;
	newsCopyLength: NewsCopyLength;
	studioAudienceId: string;
	studioAudienceCustom: string;
	studioStyle: BulkStyleId;
	studioEmotion: BulkEmotionId | '';
	slideCount: number;
	storyCategory: string;
	factTopicCategory: string;
	quoteTopicCategory: string;
	stepsCount: number;
	generalTopicPrompt: string;
	factTopicPrompt: string;
	storyTopicPrompt: string;
	quoteTopicPrompt: string;
	stepsTopicPrompt: string;
};

export const DEFAULT_STUDIO_COMPOSE_PREFS: StudioComposePrefs = {
	formatId: 'feed',
	search: '',
	category: 'general',
	newsContentMode: 'news',
	newsImageSourceMode: 'assets',
	stockMediaKind: 'video',
	newsCopyLength: 'default',
	studioAudienceId: '',
	studioAudienceCustom: '',
	studioStyle: 'bold',
	studioEmotion: 'inspiring',
	slideCount: 3,
	storyCategory: 'general',
	factTopicCategory: 'any',
	quoteTopicCategory: 'any',
	stepsCount: 5,
	generalTopicPrompt: '',
	factTopicPrompt: '',
	storyTopicPrompt: '',
	quoteTopicPrompt: '',
	stepsTopicPrompt: '',
};

const CONTENT_MODES = new Set<NewsStudioContentMode>([
	'general',
	'news',
	'fact',
	'story',
	'quote',
	'steps',
]);
const IMAGE_SOURCE_MODES = new Set<NewsImageSourceMode>(['assets', 'pull', 'ai']);
const STOCK_KINDS = new Set<StockMediaKind>(['photo', 'video']);
const COPY_LENGTHS = new Set<NewsCopyLength>(['default', 'standard', 'short']);
const FORMAT_IDS = new Set<StudioFormatId>(['feed', 'vertical', 'wide', 'square']);
const STYLE_IDS = new Set(BULK_STYLES.map((s) => s.id));
const EMOTION_IDS = new Set(BULK_EMOTIONS.map((e) => e.id));

function clampSlideCount(n: unknown): number {
	const v = Number(n);
	if (!Number.isFinite(v)) return DEFAULT_STUDIO_COMPOSE_PREFS.slideCount;
	return Math.max(3, Math.min(8, Math.floor(v)));
}

function clampStepsCount(n: unknown): number {
	const v = Number(n);
	if (!Number.isFinite(v)) return DEFAULT_STUDIO_COMPOSE_PREFS.stepsCount;
	return Math.max(3, Math.min(8, Math.floor(v)));
}

export function normalizeStudioComposePrefs(raw: unknown): StudioComposePrefs {
	const src = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
	const out: StudioComposePrefs = { ...DEFAULT_STUDIO_COMPOSE_PREFS };

	const formatId = String(src.formatId ?? '').trim();
	if (FORMAT_IDS.has(formatId as StudioFormatId)) out.formatId = formatId as StudioFormatId;

	if (typeof src.search === 'string') out.search = src.search;
	if (typeof src.category === 'string' && src.category.trim()) out.category = src.category.trim();

	const mode = String(src.newsContentMode ?? '');
	if (CONTENT_MODES.has(mode as NewsStudioContentMode)) {
		out.newsContentMode = mode as NewsStudioContentMode;
	}

	const imageMode = String(src.newsImageSourceMode ?? '');
	if (IMAGE_SOURCE_MODES.has(imageMode as NewsImageSourceMode)) {
		out.newsImageSourceMode = imageMode as NewsImageSourceMode;
	}

	const stockKind = String(src.stockMediaKind ?? '');
	if (STOCK_KINDS.has(stockKind as StockMediaKind)) {
		out.stockMediaKind = stockKind as StockMediaKind;
	}

	const copyLen = String(src.newsCopyLength ?? '');
	if (COPY_LENGTHS.has(copyLen as NewsCopyLength)) {
		out.newsCopyLength = copyLen as NewsCopyLength;
	}

	if (typeof src.studioAudienceId === 'string') out.studioAudienceId = src.studioAudienceId;
	if (typeof src.studioAudienceCustom === 'string') out.studioAudienceCustom = src.studioAudienceCustom;

	const style = String(src.studioStyle ?? '');
	if (style === 'dark') out.studioStyle = 'bold';
	else if (STYLE_IDS.has(style as BulkStyleId)) out.studioStyle = style as BulkStyleId;

	const emotion = String(src.studioEmotion ?? '');
	if (!emotion) out.studioEmotion = 'inspiring';
	else if (EMOTION_IDS.has(emotion as BulkEmotionId)) out.studioEmotion = emotion as BulkEmotionId;

	out.slideCount = clampSlideCount(src.slideCount);
	out.stepsCount = clampStepsCount(src.stepsCount);

	if (typeof src.storyCategory === 'string' && src.storyCategory.trim()) {
		out.storyCategory = src.storyCategory.trim();
	}
	if (typeof src.factTopicCategory === 'string' && src.factTopicCategory.trim()) {
		out.factTopicCategory = src.factTopicCategory.trim();
	}
	if (typeof src.quoteTopicCategory === 'string' && src.quoteTopicCategory.trim()) {
		out.quoteTopicCategory = src.quoteTopicCategory.trim();
	}
	if (typeof src.generalTopicPrompt === 'string') out.generalTopicPrompt = '';
	if (typeof src.factTopicPrompt === 'string') out.factTopicPrompt = '';
	if (typeof src.storyTopicPrompt === 'string') out.storyTopicPrompt = '';
	if (typeof src.quoteTopicPrompt === 'string') out.quoteTopicPrompt = '';
	if (typeof src.stepsTopicPrompt === 'string') out.stepsTopicPrompt = '';
	/* search / free-text prompts are never restored across reloads */
	out.search = '';

	return out;
}

export function loadStudioComposePrefs(): StudioComposePrefs | null {
	if (typeof window === 'undefined') return null;
	try {
		const raw = localStorage.getItem(STUDIO_COMPOSE_PREFS_KEY);
		if (!raw) return null;
		return normalizeStudioComposePrefs(JSON.parse(raw));
	} catch {
		return null;
	}
}

export function saveStudioComposePrefs(prefs: StudioComposePrefs): void {
	if (typeof window === 'undefined') return;
	try {
		localStorage.setItem(STUDIO_COMPOSE_PREFS_KEY, JSON.stringify(normalizeStudioComposePrefs(prefs)));
	} catch {
		/* quota / private mode */
	}
}

export function snapshotStudioComposePrefs(source: {
	formatId: string;
	search: string;
	category: string;
	newsContentMode: NewsStudioContentMode;
	newsImageSourceMode: NewsImageSourceMode;
	stockMediaKind: StockMediaKind;
	newsCopyLength: NewsCopyLength;
	studioAudienceId: string;
	studioAudienceCustom: string;
	studioStyle: BulkStyleId;
	studioEmotion: BulkEmotionId | '';
	slideCount: number;
	storyCategory: string;
	factTopicCategory: string;
	quoteTopicCategory: string;
	stepsCount: number;
	generalTopicPrompt: string;
	factTopicPrompt: string;
	storyTopicPrompt: string;
	quoteTopicPrompt: string;
	stepsTopicPrompt: string;
}): StudioComposePrefs {
	return normalizeStudioComposePrefs(source);
}
