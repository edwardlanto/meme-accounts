import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import type { RequestHandler } from './$types';

const OPENROUTER_API = 'https://openrouter.ai/api/v1/chat/completions';
const MODEL = 'anthropic/claude-sonnet-4.5';
const MAX_WORDS = 28;

function truncate(text: string, max = MAX_WORDS): string {
	const words = text.trim().split(/\s+/).filter(Boolean);
	return words.length <= max ? text.trim() : words.slice(0, max).join(' ');
}

export const POST: RequestHandler = async ({ request }) => {
	const { count = 3, title = '', text = '', sourceUrl = '', autoHighlight = true } =
		await request.json();

	if (!text.trim()) return json({ error: 'Missing article text' }, { status: 400 });

	const slideCount = Math.max(1, Math.min(10, Math.floor(Number(count))));

	if (!env.OPENROUTER_API_KEY) {
		// Return mock variants
		return json({ variants: getMockVariants(slideCount, title) });
	}

	try {
		// ── Generate all slide texts in one call ──────────────────────────────
		const systemPrompt =
			`You write short Instagram carousel overlay copy. Output ONLY valid JSON. ` +
			`Return a JSON array of exactly ${slideCount} strings. Each string must be ≤ ${MAX_WORDS} words (strict). ` +
			`Structure rules: ` +
			`Slide 1 is the strongest hook/claim. ` +
			`Slides 2–N must SUPPORT slide 1 with specific details from the article (numbers, names, mechanisms, concrete examples). ` +
			`Each supporting slide must be a DIFFERENT support type — never a rewrite of a previous slide. ` +
			`Preferred order: slide 2 = concrete evidence/stat/example, slide 3 = why it matters/implication, slide 4 = action/lesson, remaining = distinct angles. ` +
			`Each slide feels like the NEXT PANEL in the same carousel. ` +
			`No near-duplicates. No quotes, markdown, emojis, or hashtags.`;

		const userPrompt =
			`Source: ${sourceUrl}\nTitle: ${title}\n\nArticle text:\n${text.slice(0, 12000)}\n\n` +
			`Write the carousel overlay copy for all ${slideCount} slides following the structure rules. ` +
			`Slide 1 = headline hook. Every later slide must add NEW information or a new implication.`;

		const res = await fetch(OPENROUTER_API, {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
				'Content-Type': 'application/json',
				'HTTP-Referer': 'https://carousel-studio.app',
				'X-Title': 'Carousel Studio',
			},
			body: JSON.stringify({
				model: MODEL,
				messages: [
					{ role: 'system', content: systemPrompt },
					{ role: 'user', content: userPrompt },
				],
				temperature: 0.8,
				max_tokens: 1000,
			}),
		});

		if (!res.ok) throw new Error(`OpenRouter ${res.status}: ${await res.text()}`);

		const data = await res.json();
		let content = String(data.choices?.[0]?.message?.content ?? '').trim();

		// Strip markdown fences
		content = content.replace(/^```[\w]*\n?/, '').replace(/\n?```$/, '').trim();

		let variants: string[];
		try {
			const parsed = JSON.parse(content);
			if (!Array.isArray(parsed)) throw new Error('Not an array');
			variants = parsed.map((x: unknown) => truncate(String(x ?? '').trim())).filter(Boolean);
		} catch {
			// Fallback: treat whole response as slide 1
			variants = [truncate(content)];
		}

		// Ensure we have exactly slideCount items
		while (variants.length < slideCount) variants.push(variants[variants.length - 1] ?? title);
		variants = variants.slice(0, slideCount);

		// ── Optional second pass: add [[highlights]] to each slide ───────────
		if (autoHighlight && variants.length > 0) {
			const highlighted = await addHighlights(variants, title);
			return json({ variants: highlighted });
		}

		return json({ variants });
	} catch (err: any) {
		console.error('[news/variants]', err.message);
		return json({ error: err.message }, { status: 500 });
	}
};

async function addHighlights(slides: string[], title: string): Promise<string[]> {
	const system =
		`You add emphasis markers to Instagram slide overlay text. Output ONLY a JSON array of strings — one per slide — with emphasis added. ` +
		`Rules: wrap 1–3 short phrases per slide in [[double brackets]], e.g. [[key idea]] or [[33%]]. ` +
		`Those spans render in the accent color. Preserve wording and line breaks. ` +
		`Keep word count ≤ ${MAX_WORDS} per slide. No hashtags, emojis, or other markdown. No nested brackets.`;

	const user = `Article title: ${title}\n\nSlides:\n${JSON.stringify(slides, null, 2)}\n\nReturn the same array with [[highlights]] added to key phrases.`;

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
				model: MODEL,
				messages: [
					{ role: 'system', content: system },
					{ role: 'user', content: user },
				],
				temperature: 0.35,
				max_tokens: 800,
			}),
		});

		if (!res.ok) return slides; // fallback to unhighlighted

		const data = await res.json();
		let content = String(data.choices?.[0]?.message?.content ?? '').trim();
		content = content.replace(/^```[\w]*\n?/, '').replace(/\n?```$/, '').trim();

		const parsed = JSON.parse(content);
		if (Array.isArray(parsed)) return parsed.map((x: unknown) => String(x ?? '').trim());
		return slides;
	} catch {
		return slides;
	}
}

function getMockVariants(count: number, title: string): string[] {
	const mock = [
		title || '[[Silicon Valley]] controls startup exits',
		'[[33%]] of all acquisitions since 2000 came from 5 companies',
		'Google, Apple and Meta [[outpace]] every other buyer combined',
		'Private equity is [[losing ground]] to Big Tech acquirers',
		'[[Founders]] increasingly build to be acquired — not to IPO',
	];
	const out = mock.slice(0, count);
	while (out.length < count) out.push(out[out.length - 1]!);
	return out;
}
