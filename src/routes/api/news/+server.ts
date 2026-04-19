import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import type { RequestHandler } from './$types';

const THENEWSAPI_BASE = 'https://api.thenewsapi.com/v1/news/top';

export const POST: RequestHandler = async ({ request }) => {
	const body = await request.json();
	const {
		search,
		categories = 'business,tech',
		locale = 'us',
		language = 'en',
		limit = 3,
		pick = 'first',           // 'first' | 'random'
		autoHighlight = true,
	} = body;

	// ── 1. Fetch from TheNewsAPI ──────────────────────────────────────────
	if (!env.THENEWSAPI_TOKEN) {
		return json(demoArticle(), { status: 200 });
	}

	const params = new URLSearchParams({
		api_token: env.THENEWSAPI_TOKEN,
		locale,
		language,
		limit: String(Math.min(50, limit)),
		...(search ? { search } : {}),
		...(categories ? { categories } : {}),
	});

	let articles: any[] = [];
	try {
		const res = await fetch(`${THENEWSAPI_BASE}?${params}`, {
			headers: { Accept: 'application/json' },
		});
		if (!res.ok) throw new Error(`TheNewsAPI ${res.status}`);
		const data = await res.json();
		articles = data?.data ?? [];
	} catch (err: any) {
		console.error('[api/news] fetch error', err.message);
		return json(demoArticle(), { status: 200 });
	}

	if (!articles.length) return json(demoArticle(), { status: 200 });

	const article = pick === 'random'
		? articles[Math.floor(Math.random() * articles.length)]
		: articles[0];

	// ── 2. Rewrite headline with OpenRouter ──────────────────────────────
	let overlayText = article.title ?? '';

	if (env.OPENROUTER_API_KEY) {
		const snippet = [article.title, article.description].filter(Boolean).join(' ').slice(0, 600);
		const rewritePrompt = `You are a viral Instagram post copywriter.
Rewrite this news headline into punchy Instagram overlay text.

Rules:
- Max 28 words total
- ALL CAPS (the template will uppercase it, but write in caps anyway)
- No hashtags, no emojis
- Short, punchy sentences — prioritize impact over completeness
- Start with the most shocking/interesting fact

Headline & snippet: "${snippet}"

Return ONLY the rewritten text. No quotes, no explanation.`;

		try {
			const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
				method: 'POST',
				headers: {
					Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
					'Content-Type': 'application/json',
					'HTTP-Referer': 'https://carouselstudio.app',
					'X-Title': 'Carousel Studio',
				},
				body: JSON.stringify({
					model: 'anthropic/claude-sonnet-4.5',
					messages: [{ role: 'user', content: rewritePrompt }],
					temperature: 0.8,
					max_tokens: 120,
				}),
			});
			if (r.ok) {
				const c = await r.json();
				const candidate = c.choices?.[0]?.message?.content?.trim();
				if (candidate) overlayText = candidate;
			}
		} catch {
			// Fall through with original title
		}

		// ── 3. Auto-highlight key words ─────────────────────────────────
		if (autoHighlight && overlayText) {
			const highlightPrompt = `You are a graphic designer. Given this Instagram overlay text, wrap 1-3 key phrases in [[...]] for highlighting.

Rules:
- Wrap ONLY nouns, numbers, proper nouns, or the most impactful words
- Never wrap: articles (the, a, an), prepositions, conjunctions
- Max 3 wrapped phrases
- Keep the original text exactly — only add [[ and ]]
- Example: "TESLA RAISES [[PRICES BY 12%]] ACROSS ALL MODELS"

Text: "${overlayText}"

Return ONLY the modified text with [[ ]] markup. No explanation.`;

			try {
				const r2 = await fetch('https://openrouter.ai/api/v1/chat/completions', {
					method: 'POST',
					headers: {
						Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
						'Content-Type': 'application/json',
						'HTTP-Referer': 'https://carouselstudio.app',
						'X-Title': 'Carousel Studio',
					},
					body: JSON.stringify({
						model: 'anthropic/claude-sonnet-4.5',
						messages: [{ role: 'user', content: highlightPrompt }],
						temperature: 0.3,
						max_tokens: 120,
					}),
				});
				if (r2.ok) {
					const c2 = await r2.json();
					const highlighted = c2.choices?.[0]?.message?.content?.trim();
					if (highlighted && highlighted.includes('[[')) overlayText = highlighted;
				}
			} catch {
				// Fall through without highlights
			}
		}
	}

	return json({
		text: overlayText,
		imageUrl: article.image_url ?? null,
		title: article.title ?? '',
		description: article.description ?? '',
		source: article.source ?? null,
		url: article.url ?? null,
		uuid: article.uuid ?? null,
		categories: article.categories ?? [],
		demo: false,
	});
};

function demoArticle() {
	return {
		text: 'BARS ACROSS THE U.S. ARE NOW USING [[YOUR HEIGHT]] TO DECIDE HOW MUCH [[YOU DRINK]]',
		imageUrl: null,
		title: 'Bars across the U.S. are now using your height to decide how much you drink',
		description: 'A growing number of bars are implementing height-based alcohol limits.',
		source: 'Markets',
		url: null,
		uuid: 'demo',
		categories: ['business'],
		demo: true,
	};
}
