import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import type { RequestHandler } from './$types';
import { parseJsonBody, sandboxUserPlaintext, stockQueryBodySchema } from '$lib/server/request-security';
import { stockQueryFromSlide } from '$lib/studio/bulk-stock';

const OPENROUTER_API = 'https://openrouter.ai/api/v1/chat/completions';
const MODEL = 'anthropic/claude-sonnet-4.5';

function cleanQuery(raw: unknown): string {
	return String(raw ?? '')
		.replace(/["'`]/g, '')
		.replace(/\s+/g, ' ')
		.trim()
		.slice(0, 80);
}

function heuristicFallback(
	topic: string,
	slides: { headline?: string; body?: string }[],
	kind: 'photo' | 'video' | 'circle' = 'photo',
): { query: string; queries: string[]; circleQuery: string } {
	const first = slides[0] ?? {};
	const bodyFor = (s: { headline?: string; body?: string }) =>
		kind === 'circle' ? '' : String(s.body ?? '');
	const base = stockQueryFromSlide(
		String(first.headline ?? ''),
		bodyFor(first),
		topic,
	);
	const queries = slides.map((s) =>
		stockQueryFromSlide(String(s.headline ?? ''), bodyFor(s), topic),
	);
	const circleQuery = stockQueryFromSlide(
		String(first.headline ?? topic),
		'',
		topic,
	);
	return {
		query: base || 'editorial photo',
		queries: queries.length ? queries : [base || 'editorial photo'],
		circleQuery: circleQuery || `${topic || 'editorial'} close up`.trim(),
	};
}

export const POST: RequestHandler = async ({ request, locals }) => {
	const { user } = await locals.safeGetSession();
	if (!user) return json({ error: 'Unauthorized' }, { status: 401 });

	const parsed = await parseJsonBody(request, stockQueryBodySchema);
	if (!parsed.ok) return json({ error: parsed.error }, { status: parsed.status });

	const topic = String(parsed.data.topic ?? '').trim();
	const kind = parsed.data.kind === 'video' || parsed.data.kind === 'circle' ? parsed.data.kind : 'photo';
	const slides = (parsed.data.slides ?? [])
		.map((s) => ({
			headline: String(s.headline ?? '').trim().slice(0, 400),
			body: String(s.body ?? '').trim().slice(0, 600),
		}))
		.filter((s) => s.headline || s.body)
		.slice(0, 8);

	const fallback = heuristicFallback(topic, slides.length ? slides : [{ headline: topic }], kind);

	if (!env.OPENROUTER_API_KEY) {
		return json({ ...fallback, demo: true });
	}

	const n = Math.max(1, slides.length || 1);
	const kindHint =
		kind === 'video'
			? 'Stock VIDEO search (Pexels). Favor scenes with natural motion: walking, cooking, city traffic, waves, hands at work. Avoid static product shots.'
			: kind === 'circle'
				? 'Tight CIRCLE BADGE crop for Instagram news. Prefer a single clear real-world subject matching the slide headline + topic (face, food close-up, landmark detail, object hero). Never return finance charts, candlesticks, trading screens, or generic dashboard UI unless the topic is explicitly markets/stocks.'
				: 'Stock PHOTO search (Pexels/Unsplash). Favor concrete visual scenes that read at Instagram feed size.';

	const slideBlock = slides.length
		? slides
				.map(
					(s, i) =>
						`Slide ${i + 1}:\n` +
						sandboxUserPlaintext('HEADLINE', s.headline || '(none)', 400) +
						sandboxUserPlaintext('BODY', s.body || '(none)', 600),
				)
				.join('\n')
		: sandboxUserPlaintext('TOPIC', topic || 'editorial lifestyle', 500);

	const system =
		`You write short stock-media SEARCH QUERIES for Pexels and Unsplash. Output ONLY valid JSON.\n` +
		`Return shape: {"query":"...","queries":["..."],"circleQuery":"..."}\n` +
		`Rules:\n` +
		`- ${kindHint}\n` +
		`- "query" = best overall deck search (3–7 concrete visual words).\n` +
		`- "queries" = exactly ${n} strings, one per slide, each 3–7 words, visually specific to that slide while staying on the same topic.\n` +
		`- "circleQuery" = 3–6 words for a circular inset / badge crop — MUST match the topic (never finance charts, candlesticks, stock tickers, or generic dashboards unless the topic is markets).\n` +
		`- Use searchable nouns: places, objects, food, architecture, nature, people-in-context.\n` +
		`- Avoid abstract alone (success, motivation, growth, vibes). Ground abstracts in imagery.\n` +
		`- No quotes, hashtags, cameras brands, "stock photo", "4k", "cinematic grading".\n` +
		`- English only.`;

	const userPrompt =
		`Topic hint: ${topic || '(infer from slides)'}\n\n` +
		`${slideBlock}\n\n` +
		`Write the JSON search queries now.`;

	try {
		const res = await fetch(OPENROUTER_API, {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
				'Content-Type': 'application/json',
				'HTTP-Referer': 'https://memeaccounts.com',
				'X-Title': 'Meme Accounts',
			},
			body: JSON.stringify({
				model: MODEL,
				messages: [
					{ role: 'system', content: system },
					{ role: 'user', content: userPrompt },
				],
				temperature: 0.4,
				max_tokens: 400,
			}),
		});
		if (!res.ok) {
			console.warn('[stock/query] OpenRouter', res.status, await res.text());
			return json(fallback);
		}
		const data = await res.json();
		let content = String(data?.choices?.[0]?.message?.content ?? '').trim();
		content = content.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
		let parsedJson: Record<string, unknown> | null = null;
		try {
			parsedJson = JSON.parse(content);
		} catch {
			const m = content.match(/\{[\s\S]*\}/);
			if (m) {
				try {
					parsedJson = JSON.parse(m[0]!);
				} catch {
					parsedJson = null;
				}
			}
		}
		if (!parsedJson) return json(fallback);

		const query = cleanQuery(parsedJson.query) || fallback.query;
		let queries = Array.isArray(parsedJson.queries)
			? parsedJson.queries.map(cleanQuery).filter(Boolean)
			: [];
		while (queries.length < n) queries.push(query);
		queries = queries.slice(0, n).map((q) => q || query);
		const circleQuery = cleanQuery(parsedJson.circleQuery) || fallback.circleQuery;

		return json({ query, queries, circleQuery });
	} catch (e) {
		console.warn('[stock/query]', e);
		return json(fallback);
	}
};
