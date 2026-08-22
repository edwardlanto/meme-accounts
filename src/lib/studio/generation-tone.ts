/** Audience / emotion / style / language directives shared by Studio, Bulk, and generation APIs. */

export const GENERATION_LANGUAGES = [
	{ id: 'en', label: 'English', native: 'English', group: 'Popular' },
	{ id: 'es', label: 'Spanish', native: 'Español', group: 'Popular' },
	{ id: 'pt', label: 'Portuguese', native: 'Português', group: 'Popular' },
	{ id: 'fr', label: 'French', native: 'Français', group: 'Popular' },
	{ id: 'de', label: 'German', native: 'Deutsch', group: 'Popular' },
	{ id: 'it', label: 'Italian', native: 'Italiano', group: 'Popular' },
	{ id: 'ja', label: 'Japanese', native: '日本語', group: 'Asia' },
	{ id: 'zh-Hans', label: 'Chinese, Simplified', native: '简体中文', group: 'Asia' },
	{ id: 'zh-Hant', label: 'Chinese, Traditional', native: '繁體中文', group: 'Asia' },
	{ id: 'ko', label: 'Korean', native: '한국어', group: 'Asia' },
	{ id: 'hi', label: 'Hindi', native: 'हिन्दी', group: 'Asia' },
	{ id: 'ta', label: 'Tamil', native: 'தமிழ்', group: 'Asia' },
	{ id: 'id', label: 'Indonesian', native: 'Bahasa Indonesia', group: 'Asia' },
	{ id: 'th', label: 'Thai', native: 'ไทย', group: 'Asia' },
	{ id: 'vi', label: 'Vietnamese', native: 'Tiếng Việt', group: 'Asia' },
	{ id: 'ar', label: 'Arabic', native: 'العربية', group: 'Middle East' },
	{ id: 'tr', label: 'Turkish', native: 'Türkçe', group: 'Middle East' },
	{ id: 'nl', label: 'Dutch', native: 'Nederlands', group: 'Europe' },
	{ id: 'pl', label: 'Polish', native: 'Polski', group: 'Europe' },
	{ id: 'sv', label: 'Swedish', native: 'Svenska', group: 'Europe' },
	{ id: 'ru', label: 'Russian', native: 'Русский', group: 'Europe' },
] as const;

export type GenerationLanguageId = (typeof GENERATION_LANGUAGES)[number]['id'];
export const DEFAULT_GENERATION_LANGUAGE: GenerationLanguageId = 'en';

const LANGUAGE_BY_ID = new Map(GENERATION_LANGUAGES.map((l) => [l.id, l]));

/** Scripts where ALL CAPS / Latin word-count rules do not apply. */
const NATIVE_SCRIPT_IDS = new Set<GenerationLanguageId>([
	'ja',
	'zh-Hans',
	'zh-Hant',
	'ko',
	'hi',
	'ta',
	'ar',
	'th',
]);

const NEWS_API_LANGUAGE: Record<GenerationLanguageId, string> = {
	en: 'en',
	es: 'es',
	pt: 'pt',
	fr: 'fr',
	de: 'de',
	it: 'it',
	ja: 'ja',
	'zh-Hans': 'zh',
	'zh-Hant': 'zh',
	ko: 'ko',
	hi: 'hi',
	ta: 'en',
	id: 'id',
	th: 'th',
	vi: 'vi',
	ar: 'ar',
	tr: 'tr',
	nl: 'nl',
	pl: 'pl',
	sv: 'sv',
	ru: 'ru',
};

export function isGenerationLanguageId(raw: string | undefined | null): raw is GenerationLanguageId {
	return !!raw && LANGUAGE_BY_ID.has(raw as GenerationLanguageId);
}

export function normalizeGenerationLanguage(raw: string | undefined | null): GenerationLanguageId {
	const id = String(raw ?? '').trim();
	if (isGenerationLanguageId(id)) return id;
	const lower = id.toLowerCase();
	if (lower === 'zh' || lower === 'zh-cn' || lower === 'chinese') return 'zh-Hans';
	if (lower === 'zh-tw' || lower === 'zh-hk') return 'zh-Hant';
	if (lower === 'jp') return 'ja';
	if (lower === 'in' || lower === 'indian' || lower === 'hindi') return 'hi';
	const aliased = GENERATION_LANGUAGES.find((l) => l.id === lower);
	return aliased?.id ?? DEFAULT_GENERATION_LANGUAGE;
}

export function generationLanguageMeta(id: string | undefined | null) {
	return LANGUAGE_BY_ID.get(normalizeGenerationLanguage(id))!;
}

/** ISO code for TheNewsAPI article fetch. */
export function newsApiLanguage(raw: string | undefined | null): string {
	return NEWS_API_LANGUAGE[normalizeGenerationLanguage(raw)] ?? 'en';
}

export const GENERATION_LANGUAGE_GROUPS = [
	'Popular',
	'Asia',
	'Middle East',
	'Europe',
] as const;

export function generationLanguagesInGroup(group: string) {
	return GENERATION_LANGUAGES.filter((l) => l.group === group);
}

function generationLanguagePromptBlock(raw: string | undefined | null): string {
	const lang = generationLanguageMeta(raw);
	if (lang.id === 'en') return '';
	const nativeScript = NATIVE_SCRIPT_IDS.has(lang.id);
	const casing = nativeScript
		? 'Never ALL CAPS. Use the standard writing system. Latin ALL CAPS instructions do not apply.'
		: 'Do not force ALL CAPS. Use natural sentence case (or light title case on a hook). Shouting every letter reads as a bad translation.';
	const length = nativeScript
		? 'Hooks ~10–22 characters. Body: 1–2 short native sentences. Ignore English word-count as a hard split — keep the overlay tight.'
		: 'Keep overlay copy as short as the English word cap would be. Prefer one complete thought over stuffing more words.';
	return `
LANGUAGE (non-negotiable — overrides English-only and ALL CAPS instructions above):
- Write every user-facing string (hook, context, headline, subheadline, body, bullets, CTA) in ${lang.native} (${lang.label}).
- JSON keys stay English. Keep [[highlight]] markers around native phrases.
- Native Instagram fluency — not a translation of English syntax.
- Do not mix English except proper nouns, brand names, numbers, and common loanwords.
- Casing: ${casing}
- Length: ${length}
`;
}

const STYLE_PROMPTS: Record<string, string> = {
	bold: 'High-energy bold: short punchy bursts, strong verbs, strategic emojis. Action-first.',
	editorial:
		'Magazine-quality editorial: elegant rhythm, thoughtful pacing. Still name the topic — elegance is not an excuse for off-topic metaphor.',
	minimal:
		'Clean and professional: structured, credible, business-appropriate. Clear hierarchy.',
	'first-person':
		'First-person voice: write as I/we. Personal, direct, conversational — lived experience and opinions, not third-person news speak.',
};

const EMOTION_PROMPTS: Record<string, string> = {
	curious: 'Lean into curiosity gaps and open loops. Make them need the next slide — about this topic.',
	urgent: 'Time pressure and stakes. Short sentences. Immediate action.',
	hopeful: 'Optimistic, forward-looking, possibility without fluff.',
	shocking: 'Surprising claims backed by concrete specifics. Stop the scroll.',
	calm: 'Steady, reassuring, clear. No hype. Trust over drama.',
	witty: 'Smart humor, light wordplay. Never mean-spirited.',
	inspiring:
		'Uplifting, agency, "you can do this" energy with specific proof ABOUT THE TOPIC. Do not wander into a pretty unrelated scene.',
};

export function generationStylePrompt(style: string | undefined): string {
	const key = String(style ?? '').trim().toLowerCase();
	return STYLE_PROMPTS[key] ?? STYLE_PROMPTS.bold!;
}

export function generationTonePromptSuffix(opts: {
	audience?: string;
	emotion?: string;
	style?: string;
	language?: string;
}): string {
	let out = '';
	const audience = String(opts.audience ?? '').trim();
	if (audience) {
		out += `\nAUDIENCE: Write for ${audience.replace(/"/g, "'")}. Use language, examples, and stakes they care about.\n`;
	}
	const emotion = String(opts.emotion ?? '').trim().toLowerCase();
	if (emotion && EMOTION_PROMPTS[emotion]) {
		out += `\nEMOTION: ${EMOTION_PROMPTS[emotion]}\n`;
	}
	const style = String(opts.style ?? '').trim().toLowerCase();
	if (style && STYLE_PROMPTS[style]) {
		out += `\nSTYLE: ${STYLE_PROMPTS[style]}\n`;
	}
	out += generationLanguagePromptBlock(opts.language);
	return out;
}
