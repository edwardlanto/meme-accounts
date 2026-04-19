import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import type { RequestHandler } from './$types';

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

export const POST: RequestHandler = async ({ request }) => {
	const { topic, style = 'dark', slideCount = 8, imageCount = 0, audience = '' } = await request.json();

	if (!topic) return json({ error: 'Missing topic' }, { status: 400 });

	if (!env.OPENROUTER_API_KEY) {
		return json({ slides: getDemoSlides(slideCount, imageCount), demo: true });
	}

	const prompt = buildPrompt(topic, style, slideCount, imageCount, audience);

	try {
		const res = await fetch(OPENROUTER_API, {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
				'Content-Type': 'application/json',
				'HTTP-Referer': 'https://carousel-studio.app',
				'X-Title': 'Carousel Studio',
			},
			body: JSON.stringify({
				model: 'anthropic/claude-3.5-sonnet',
				messages: [{ role: 'user', content: prompt }],
				temperature: 0.85,
				max_tokens: 4000,
			}),
		});

		if (!res.ok) throw new Error(`OpenRouter ${res.status}: ${await res.text()}`);

		const data = await res.json();
		const raw: string = data.choices?.[0]?.message?.content?.trim() ?? '';

		// Strip markdown fences if present
		const jsonStr = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
		const slides: GeneratedSlide[] = JSON.parse(jsonStr);

		return json({
			slides: slides.map((s, i) => ({ ...s, slideNumber: i + 1 })),
		});
	} catch (err: any) {
		console.error('[generate-slides]', err.message);
		return json({ error: err.message }, { status: 500 });
	}
};

function buildPrompt(
	topic: string,
	style: string,
	slideCount: number,
	imageCount: number,
	audience: string,
): string {
	const styleDesc: Record<string, string> = {
		dark: 'Ultra-minimal dark editorial — sparse, impactful. One powerful idea per slide. No fluff.',
		bold: 'High-energy bold — short punchy bursts, strong verbs, strategic emojis. Action-first.',
		editorial:
			'Magazine-quality editorial — elegant rhythm, thoughtful pacing. Reads like a great article.',
		minimal:
			'Clean and professional — structured, credible, business-appropriate. Clear hierarchy.',
	};

	const imageGuide =
		imageCount > 0
			? `The creator uploaded ${imageCount} photo(s) indexed 0–${imageCount - 1}. Distribute naturally — hero + key value slides get images. Always set imageIndex: null for text-only and quote layouts.`
			: `No photos uploaded. All slides use "text-only" or "quote" layouts. imageIndex must be null on every slide.`;

	return `You are a world-class viral social media strategist. Generate exactly ${slideCount} carousel slides.

TOPIC: "${topic}"${audience ? `\nAUDIENCE: ${audience}` : ''}
STYLE: ${styleDesc[style] ?? styleDesc.dark}
IMAGES: ${imageGuide}

PROVEN SLIDE FORMULA:
1. HOOK — Counterintuitive or shocking opening. Stops the scroll.
2. AGITATE — Deepen the problem. Make them feel it.
3–${slideCount - 2}. VALUE — Specific, actionable insights. Each slide = one idea.
${slideCount - 1}. PROOF or SHIFT — Story, stat, or perspective change.
${slideCount}. CTA — Save / Follow / Comment / Share. Clear and specific.

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

CRITICAL RULES:
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

function getDemoSlides(count: number, imageCount: number): GeneratedSlide[] {
	const has = (n: number) => imageCount > n;
	const all: GeneratedSlide[] = [
		{
			id: 'slide_1',
			type: 'hook',
			headline: 'Your audience is bored of you.',
			subheadline: "Here's why — and how to fix it",
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
			headline: '"My reach tripled in 30 days"',
			body: '— after switching to this exact format.',
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
			headline: 'This works for any niche.',
			body: "Finance, fitness, food, fashion — the psychology of what makes people stop and read doesn't change.",
			imageIndex: has(3) ? 3 : null,
			layout: has(3) ? 'hero' : 'text-only',
			slideNumber: 7,
		},
		{
			id: 'slide_8',
			type: 'cta',
			headline: 'Save this. Use it tomorrow.',
			body: "If this helped, follow for one carousel framework every week — no theory, just what's working right now.",
			accentEmoji: '🔖',
			imageIndex: null,
			layout: 'text-only',
			slideNumber: 8,
		},
	];
	return all.slice(0, Math.max(3, count));
}
