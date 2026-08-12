import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import type { RequestHandler } from './$types';
import { generateSlidesBodySchema, parseJsonBody, sandboxUserPlaintext } from '$lib/server/request-security';
import { stripEmDashes } from '$lib/strip-em-dashes';
import { fitCopyBudget } from '$lib/studio/fit-copy';

const OPENROUTER_API = 'https://openrouter.ai/api/v1/chat/completions';

export interface GeneratedSlide {
	id: string;
	type: 'hook' | 'value' | 'tip' | 'proof' | 'cta' | 'quote';
	headline: string;
	subheadline?: string;
	body?: string;
	bullets?: string[];
	imageIndex?: number | null;
	layout: 'hero' | 'split-left' | 'split-right' | 'text-only' | 'quote';
	accentEmoji?: string;
	slideNumber?: number;
}

export const POST: RequestHandler = async ({ request, locals }) => {
	const { user } = await locals.safeGetSession();
	if (!user) return json({ error: 'Unauthorized' }, { status: 401 });

	const parsed = await parseJsonBody(request, generateSlidesBodySchema, 64_000);
	if (!parsed.ok) return json({ error: parsed.error }, { status: parsed.status });

	const { topic, style, slideCount, imageCount, audience, emotion, deckCount, autoHighlight } =
		parsed.data;
	const decksWanted = Math.max(1, Math.min(10, deckCount ?? 1));
	const wantHighlights = autoHighlight === true;

	if (!env.OPENROUTER_API_KEY) {
		if (decksWanted > 1) {
			return json({
				decks: getDemoDecks(decksWanted, slideCount, imageCount, wantHighlights),
				demo: true,
			});
		}
		return json({ slides: getDemoSlides(slideCount, imageCount, wantHighlights), demo: true });
	}

	const prompt =
		decksWanted > 1
			? buildDecksPrompt(topic, style, slideCount, imageCount, audience, emotion ?? '', decksWanted)
			: buildPrompt(topic, style, slideCount, imageCount, audience, emotion ?? '');

	try {
		const res = await fetch(OPENROUTER_API, {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
				'Content-Type': 'application/json',
				'HTTP-Referer': 'https://carousel-studio.app',
				'X-Title': 'Meme Accounts',
			},
			body: JSON.stringify({
				model: 'anthropic/claude-sonnet-4.5',
				messages: [{ role: 'user', content: prompt }],
				temperature: emotion ? 0.7 : 0.85,
				max_tokens: decksWanted > 1 ? 8000 : 4000,
			}),
		});

		if (!res.ok) throw new Error(`OpenRouter ${res.status}: ${await res.text()}`);

		const data = await res.json();
		const raw: string = data.choices?.[0]?.message?.content?.trim() ?? '';
		const jsonStr = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
		const parsedJson = JSON.parse(jsonStr);

		const normalizeSlide = (s: any, i: number): GeneratedSlide => ({
			id: String(s?.id ?? `slide_${i + 1}`),
			type: (s?.type ?? 'value') as GeneratedSlide['type'],
			layout: (s?.layout ?? 'text-only') as GeneratedSlide['layout'],
			imageIndex: s?.imageIndex ?? null,
			accentEmoji: s?.accentEmoji,
			slideNumber: i + 1,
			headline: fitCopy(stripDashes(String(s?.headline ?? '')), 9, 56),
			subheadline:
				s?.subheadline != null ? fitCopy(stripDashes(String(s.subheadline)), 12, 80) : undefined,
			body: s?.body != null ? fitCopy(stripDashes(String(s.body)), 26, 165) : undefined,
			bullets: Array.isArray(s?.bullets) ? s.bullets.map((b: unknown) => stripDashes(String(b))) : undefined,
		});

		if (decksWanted > 1) {
			const rawDecks = Array.isArray(parsedJson)
				? parsedJson
				: Array.isArray(parsedJson?.decks)
					? parsedJson.decks
					: [];
			let decks = rawDecks.slice(0, decksWanted).map((d: any, di: number) => {
				const slidesRaw = Array.isArray(d?.slides) ? d.slides : [];
				return {
					title: stripDashes(String(d?.title ?? d?.idea ?? `Idea ${di + 1}`)),
					slides: slidesRaw.map((s: GeneratedSlide, i: number) => normalizeSlide(s, i)),
				};
			});
			if (wantHighlights) {
				decks = await highlightDeckNewsHeadlines(decks);
			}
			return json({ decks });
		}

		let slides: GeneratedSlide[] = (
			Array.isArray(parsedJson) ? parsedJson : parsedJson?.slides ?? []
		).map((s: GeneratedSlide, i: number) => normalizeSlide(s, i));
		if (wantHighlights) {
			slides = await highlightNewsHeadlines(slides);
		}
		return json({ slides });
	} catch (err: any) {
		console.error('[generate-slides]', err.message);
		return json({ error: err.message }, { status: 500 });
	}
};

/** Slide types that map to News in Bulk (`templateForSlideType`) — those parse `[[…]]`. */
const NEWS_HEADLINE_TYPES = new Set(['hook', 'proof', 'cta']);

function isNewsHeadlineSlide(slide: { type?: string; headline?: string }): boolean {
	return NEWS_HEADLINE_TYPES.has(String(slide?.type ?? '').toLowerCase());
}

/**
 * Second-pass LLM: wrap 1–3 key phrases in [[…]] on News-bound headlines.
 * Falls back to plain text on failure.
 */
async function highlightNewsHeadlines(slides: GeneratedSlide[]): Promise<GeneratedSlide[]> {
	const idxs: number[] = [];
	const texts: string[] = [];
	for (let i = 0; i < slides.length; i++) {
		const s = slides[i]!;
		const h = String(s.headline ?? '').trim();
		if (!isNewsHeadlineSlide(s) || !h || h.includes('[[')) continue;
		idxs.push(i);
		texts.push(h);
	}
	if (!texts.length) return slides;

	const marked = await batchAddHighlights(texts);
	return slides.map((s, i) => {
		const pos = idxs.indexOf(i);
		if (pos < 0) return s;
		const next = String(marked[pos] ?? s.headline).trim();
		return next.includes('[[') ? { ...s, headline: next } : s;
	});
}

async function highlightDeckNewsHeadlines<T extends { slides: GeneratedSlide[] }>(
	decks: T[],
): Promise<T[]> {
	const flat: { deck: number; slide: number; text: string }[] = [];
	for (let di = 0; di < decks.length; di++) {
		const slides = decks[di]!.slides;
		for (let si = 0; si < slides.length; si++) {
			const s = slides[si]!;
			const h = String(s.headline ?? '').trim();
			if (!isNewsHeadlineSlide(s) || !h || h.includes('[[')) continue;
			flat.push({ deck: di, slide: si, text: h });
		}
	}
	if (!flat.length) return decks;

	const marked = await batchAddHighlights(flat.map((f) => f.text));
	return decks.map((deck, di) => ({
		...deck,
		slides: deck.slides.map((s, si) => {
			const pos = flat.findIndex((f) => f.deck === di && f.slide === si);
			if (pos < 0) return s;
			const next = String(marked[pos] ?? s.headline).trim();
			return next.includes('[[') ? { ...s, headline: next } : s;
		}),
	}));
}

async function batchAddHighlights(headlines: string[]): Promise<string[]> {
	if (!env.OPENROUTER_API_KEY || !headlines.length) return headlines;

	const system =
		`You add emphasis markers to short Instagram News headlines. Output ONLY a JSON array of strings — one per input — with emphasis added. ` +
		`Rules: wrap 1–3 short phrases per headline in [[double brackets]], e.g. [[key idea]] or [[33%]]. ` +
		`Use ONLY plain [[phrase]] markers — never grad(, marker(, pattern(, or #hex: inside brackets. ` +
		`Preserve wording exactly aside from adding brackets. No hashtags, emojis, or other markdown. No nested brackets.`;

	const user = `Headlines:\n${JSON.stringify(headlines, null, 2)}\n\nReturn the same array with [[highlights]] added to key phrases.`;

	try {
		const res = await fetch(OPENROUTER_API, {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
				'Content-Type': 'application/json',
				'HTTP-Referer': 'https://carousel-studio.app',
				'X-Title': 'Meme Accounts',
			},
			body: JSON.stringify({
				model: 'anthropic/claude-sonnet-4.5',
				messages: [
					{ role: 'system', content: system },
					{ role: 'user', content: user },
				],
				temperature: 0.35,
				max_tokens: Math.min(2000, 80 * headlines.length + 200),
			}),
		});
		if (!res.ok) return headlines;

		const data = await res.json();
		let content = String(data.choices?.[0]?.message?.content ?? '').trim();
		content = content.replace(/^```[\w]*\n?/, '').replace(/\n?```$/, '').trim();
		const parsed = JSON.parse(content);
		if (!Array.isArray(parsed) || parsed.length !== headlines.length) return headlines;
		return parsed.map((x: unknown, i: number) => {
			const next = String(x ?? '').trim();
			return next.includes('[[') ? next : headlines[i]!;
		});
	} catch {
		return headlines;
	}
}

/**
 * Keep copy inside what the 1080x1350 canvas can render. Trims on a sentence
 * boundary when one exists, otherwise on a word boundary. Never uses ellipsis.
 */
function fitCopy(text: string, maxWords: number, maxChars: number): string {
	return fitCopyBudget(text, { maxWords, maxChars });
}

function stripDashes(text: string): string {
	return stripEmDashes(text);
}

function buildPrompt(
	topic: string,
	style: string,
	slideCount: number,
	imageCount: number,
	audience: string,
	emotion: string,
): string {
	const styleDesc: Record<string, string> = {
		dark: 'Ultra-minimal dark editorial: sparse, impactful. One powerful idea per slide. No fluff.',
		bold: 'High-energy bold: short punchy bursts, strong verbs, strategic emojis. Action-first.',
		editorial:
			'Magazine-quality editorial: elegant rhythm, thoughtful pacing. Reads like a great article.',
		minimal:
			'Clean and professional: structured, credible, business-appropriate. Clear hierarchy.',
	};

	const emotionDesc: Record<string, string> = {
		curious: 'Lean into curiosity gaps and open loops. Make them need the next slide.',
		urgent: 'Time pressure and stakes. Short sentences. Immediate action.',
		hopeful: 'Optimistic, forward-looking, possibility without fluff.',
		shocking: 'Surprising claims backed by concrete specifics. Stop the scroll.',
		calm: 'Steady, reassuring, clear. No hype. Trust over drama.',
		witty: 'Smart humor, light wordplay. Never mean-spirited.',
		inspiring: 'Uplifting, agency, "you can do this" energy with specific proof.',
	};

	const imageGuide =
		imageCount > 0
			? `The creator uploaded ${imageCount} photo(s) indexed 0-${imageCount - 1}. Distribute naturally: hero + key value slides get images. Always set imageIndex: null for text-only and quote layouts.`
			: `No photos uploaded. All slides use "text-only" or "quote" layouts. imageIndex must be null on every slide.`;

	const topicBlock = sandboxUserPlaintext('TOPIC', topic, 12000);
	const audienceBlock = audience.trim()
		? `\n${sandboxUserPlaintext('AUDIENCE', audience, 2400)}\n`
		: '';
	const emotionBlock =
		emotion && emotionDesc[emotion]
			? `\nEMOTION (fixed directive): ${emotionDesc[emotion]}\n`
			: '';

	return `You are a world-class viral social media strategist. Generate exactly ${slideCount} carousel slides.
Be fast and precise: one clear idea per slide, no filler.
Copy is rendered on a 1080x1350 image, so it MUST fit: short headlines, tight body text, zero padding words.

${topicBlock}${audienceBlock}${emotionBlock}
STYLE (fixed directive): ${styleDesc[style] ?? styleDesc.dark}
IMAGES (fixed directive): ${imageGuide}

PROVEN SLIDE FORMULA:
1. HOOK: Counterintuitive or shocking opening. Stops the scroll.
2. AGITATE: Deepen the problem. Make them feel it.
3-${slideCount - 2}. VALUE: Specific, actionable insights. Each slide = one idea.
${slideCount - 1}. PROOF or SHIFT: Story, stat, or perspective change.
${slideCount}. CTA: Save / Follow / Comment / Share. Clear and specific.

OUTPUT: Raw JSON array only. No markdown. No explanation. No wrapper.

[
  {
    "id": "slide_1",
    "type": "hook",
    "headline": "Max 7 words. Make it sting.",
    "subheadline": "Optional supporting line (omit if empty)",
    "body": "Optional 1-2 sentence expansion, max 28 words (omit if empty)",
    "bullets": ["Only for tip/value slides", "Max 3 items", "Omit otherwise"],
    "imageIndex": 0,
    "layout": "hero",
    "accentEmoji": "🔥"
  }
]

FIT RULES (hard limits, the text is rendered on an image):
- headline: MAX 7 words AND max 48 characters. No trailing period.
- body: 1-2 sentences, MAX 24 words AND max 150 characters total.
- subheadline: MAX 10 words.
- Never write placeholder or meta copy ("lead with a hook", "your headline here", "insert stat").
- Every slide must carry real substance: a specific number, name, mechanism, example, or consequence.
- Vary sentence shape across slides so the deck does not read like a template.

CRITICAL RULES:
- NEVER use em dashes (—) or en dashes (–). Use commas, periods, or a plain hyphen (-) only.
- headline: MAX 7 WORDS. Short = more impact. Every word must earn its place.
- layout "hero": full-bleed image. Requires imageIndex >= 0.
- layout "split-left": image left, text right. Requires imageIndex >= 0.
- layout "split-right": text left, image right. Requires imageIndex >= 0.
- layout "text-only": no image. imageIndex = null.
- layout "quote": italic centered quote. imageIndex = null. Type must be "quote".
- First slide: use "hero" if images available, else "text-only".
- Last slide: always "text-only" CTA.
- bullets: only on tip/value type slides. Max 3. Omit key entirely otherwise.
- accentEmoji: optional. Only where it adds genuine energy.
- subheadline/body: omit the key entirely if empty (don't use empty strings).`;
}

function buildDecksPrompt(
	topic: string,
	style: string,
	slideCount: number,
	imageCount: number,
	audience: string,
	emotion: string,
	deckCount: number,
): string {
	const single = buildPrompt(topic, style, slideCount, imageCount, audience, emotion);
	return `You are a world-class viral social media strategist.
Generate exactly ${deckCount} SEPARATE Instagram carousel slideshows about the same topic.
Each slideshow is its own distinct ANGLE / IDEA (not the same carousel rewritten).
Each slideshow has exactly ${slideCount} slides.

TOPIC COHERENCE (most important rule):
- Every slide inside a deck must advance that deck's ONE angle, named in its title.
- A reader seeing any single slide must be able to tell it belongs to that deck.
- Do not drift: no generic social-media advice, no unrelated tangents, no filler slides.
- Repeat the deck's core subject noun (or an unmistakable synonym) in most slides.
- The last slide's CTA must reference that deck's specific angle, not a generic "follow for more".

${single}

OVERRIDE OUTPUT FORMAT (multi-deck):
Return ONLY a raw JSON array of ${deckCount} decks. No markdown.

[
  {
    "title": "Short idea title (max 6 words)",
    "slides": [ /* exactly ${slideCount} slide objects as above */ ]
  }
]

CRITICAL MULTI-DECK RULES:
- Each deck title must be a different angle on the topic.
- Slides within a deck must form one coherent carousel.
- Never reuse the same headline across decks.
- Every slide needs a "body" (except pure CTA slides), since the layout renders a paragraph under the headline.
- Respect the FIT RULES above on every slide of every deck.
- NEVER use em dashes or en dashes.`;
}

function getDemoDecks(
	deckCount: number,
	slideCount: number,
	imageCount: number,
	autoHighlight = false,
) {
	const base = getDemoSlides(Math.max(slideCount, 3), imageCount, autoHighlight);
	const titles = [
		'Gut mood connection',
		'Fermented food basics',
		'Stress and digestion',
		'Sleep starts in the gut',
		'Simple daily reset',
		'Myths about probiotics',
		'What to eat first',
		'When to see a doctor',
		'Travel gut kit',
		'Build the habit',
	];
	return Array.from({ length: deckCount }, (_, i) => ({
		title: titles[i] ?? `Idea ${i + 1}`,
		slides: base.slice(0, slideCount).map((s, si) => ({
			...s,
			id: `deck_${i + 1}_slide_${si + 1}`,
			headline:
				si === 0
					? autoHighlight
						? `[[${titles[i] ?? 'Idea'}]]`
						: `${titles[i] ?? 'Idea'}`
					: s.headline,
			slideNumber: si + 1,
		})),
	}));
}

function getDemoSlides(
	count: number,
	imageCount: number,
	autoHighlight = false,
): GeneratedSlide[] {
	const has = (n: number) => imageCount > n;
	const hl = (plain: string, marked: string) => (autoHighlight ? marked : plain);
	const all: GeneratedSlide[] = [
		{
			id: 'slide_1',
			type: 'hook',
			headline: hl('Your audience is bored of you.', 'Your audience is [[bored]] of you.'),
			subheadline: "Here's why - and how to fix it",
			imageIndex: has(0) ? 0 : null,
			layout: has(0) ? 'hero' : 'text-only',
			slideNumber: 1,
		},
		{
			id: 'slide_2',
			type: 'value',
			headline: 'Generic content gets ignored.',
			body: "People scroll past advice they've heard 100 times. Your story is the only thing they can't find anywhere else.",
			imageIndex: null,
			layout: 'text-only',
			slideNumber: 2,
		},
		{
			id: 'slide_3',
			type: 'tip',
			headline: 'Hook in the first 3 words.',
			body: 'Algorithms show your first slide to cold audiences. Make the opener impossible to scroll past.',
			imageIndex: has(1) ? 1 : null,
			layout: has(1) ? 'split-right' : 'text-only',
			slideNumber: 3,
		},
		{
			id: 'slide_4',
			type: 'tip',
			headline: 'One idea per slide. Always.',
			bullets: ['Clarity beats cleverness', 'White space is content', 'Less = more saves'],
			imageIndex: null,
			layout: 'text-only',
			slideNumber: 4,
		},
		{
			id: 'slide_5',
			type: 'proof',
			headline: hl('"My reach tripled in 30 days"', '"My reach [[tripled]] in 30 days"'),
			body: 'after switching to this exact format.',
			imageIndex: has(2) ? 2 : null,
			layout: has(2) ? 'split-left' : 'quote',
			slideNumber: 5,
		},
		{
			id: 'slide_6',
			type: 'value',
			headline: 'End with a question. Always.',
			body: 'Comments signal to the algorithm your post is worth pushing. Ask something they actually want to answer.',
			imageIndex: null,
			layout: 'text-only',
			slideNumber: 6,
		},
		{
			id: 'slide_7',
			type: 'proof',
			headline: hl('This works for any niche.', 'This works for [[any niche]].'),
			body: "Finance, fitness, food, fashion - the psychology of what makes people stop and read doesn't change.",
			imageIndex: has(3) ? 3 : null,
			layout: has(3) ? 'hero' : 'text-only',
			slideNumber: 7,
		},
		{
			id: 'slide_8',
			type: 'cta',
			headline: hl('Save this. Use it tomorrow.', '[[Save this]]. Use it tomorrow.'),
			body: "If this helped, follow for one carousel framework every week - no theory, just what's working right now.",
			accentEmoji: '🔖',
			imageIndex: null,
			layout: 'text-only',
			slideNumber: 8,
		},
	];
	return all.slice(0, Math.max(3, count));
}
