import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import type { RequestHandler } from './$types';
import {
	fitTextCarouselBodyToCanvas,
	joinTextCarouselParagraphs,
	randomParagraphCount,
} from '$lib/studio/text-carousel-body';
import { newsTextCarouselBodySchema, parseJsonBody } from '$lib/server/request-security';

const OPENROUTER_API = 'https://openrouter.ai/api/v1/chat/completions';
const MODEL = 'anthropic/claude-sonnet-4.5';

type Body = {
	title?: string;
	text?: string;
	sourceUrl?: string;
	/** Optional slide-specific angle / hook. */
	angle?: string;
	/** Force 1–3 paragraphs; omit for random. */
	paragraphCount?: number;
	studioRegenAt?: number;
};

function demoBody(paragraphCount: number, title: string, text: string): string {
	const topic = (title || text || 'Markets').slice(0, 80);
	const p1 = `${topic}: the headline number is only half the story — the mechanism behind it matters more than the press release admits.`;
	const p2 = `Traders who watched order flow saw the shift before commentators caught up. Positioning had already moved while retail was still reading the summary.`;
	const p3 = `The practical takeaway is timing. When whales lean this hard one way, the window to react is shorter than most timelines on social suggest.`;
	const paras = [p1, p2, p3].slice(0, paragraphCount);
	return fitTextCarouselBodyToCanvas(joinTextCarouselParagraphs(paras));
}

export const POST: RequestHandler = async ({ request, locals }) => {
	const { user: authUser } = await locals.safeGetSession();
	if (!authUser) return json({ error: 'Unauthorized' }, { status: 401 });

	const parsed = await parseJsonBody(request, newsTextCarouselBodySchema);
	if (!parsed.ok) return json({ error: parsed.error }, { status: parsed.status });

	const body = parsed.data;
	const title = String(body.title ?? '').trim();
	const text = String(body.text ?? '').trim();
	const angle = String(body.angle ?? '').trim();
	const sourceUrl = String(body.sourceUrl ?? '').trim();

	if (!text && !title && !angle) {
		return json({ error: 'Missing source text' }, { status: 400 });
	}

	const paragraphCount =
		typeof body.paragraphCount === 'number' && body.paragraphCount >= 1 && body.paragraphCount <= 3
			? Math.floor(body.paragraphCount)
			: randomParagraphCount(1, 3);

	if (!env.OPENROUTER_API_KEY) {
		return json({
			body: demoBody(paragraphCount, title, text || angle),
			paragraphCount,
			demo: true,
		});
	}

	const regen =
		typeof body.studioRegenAt === 'number' && Number.isFinite(body.studioRegenAt)
			? `\nVariation seed: ${Math.floor(body.studioRegenAt)} — write fresh wording.\n`
			: '';

	const wordCap =
		paragraphCount === 1
			? 'Each paragraph up to ~90 words; prefer one strong block.'
			: paragraphCount === 2
				? 'Up to ~70 words per paragraph.'
				: 'Up to ~55 words per paragraph.';

	const system =
		`You write body copy for an Instagram text-carousel slide (profile header is separate). ` +
		`Output ONLY valid JSON: {"paragraphs":["paragraph one","paragraph two"]}. ` +
		`You MUST return exactly ${paragraphCount} paragraph(s) in the array — no more, no fewer. ` +
		`${wordCap} ` +
		`Rules: normal sentence case; 2–4 sentences per paragraph; blank line between paragraphs is represented as separate array items; ` +
		`no hashtags, emojis, markdown, or [[highlight]] markup; stay faithful to the source; each paragraph advances a distinct angle.`;

	const userPrompt =
		`${regen}` +
		(title ? `Title: ${title}\n` : '') +
		(sourceUrl ? `Source: ${sourceUrl}\n` : '') +
		(angle ? `Slide angle / hook:\n${angle.slice(0, 600)}\n\n` : '') +
		`Source material:\n${(text || title).slice(0, 12000)}`;

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
				model: MODEL,
				messages: [
					{ role: 'system', content: system },
					{ role: 'user', content: userPrompt },
				],
				temperature: 0.88,
				max_tokens: 900,
			}),
		});

		if (!res.ok) throw new Error(`OpenRouter ${res.status}: ${await res.text()}`);

		const data = await res.json();
		let content = String(data.choices?.[0]?.message?.content ?? '').trim();
		content = content.replace(/^```[\w]*\n?/, '').replace(/\n?```$/, '').trim();

		let paragraphs: string[] = [];
		try {
			const parsed = JSON.parse(content) as { paragraphs?: unknown };
			if (Array.isArray(parsed.paragraphs)) {
				paragraphs = parsed.paragraphs
					.map((p) => String(p ?? '').trim())
					.filter(Boolean)
					.slice(0, paragraphCount);
			}
		} catch {
			paragraphs = content
				.split(/\n\s*\n+/)
				.map((p) => p.trim())
				.filter(Boolean)
				.slice(0, paragraphCount);
		}

		while (paragraphs.length < paragraphCount) {
			paragraphs.push((paragraphs[paragraphs.length - 1] ?? title) || 'Follow for more context.');
		}

		const fitted = fitTextCarouselBodyToCanvas(
			joinTextCarouselParagraphs(paragraphs.slice(0, paragraphCount)),
			{ randomizeParagraphCount: false },
		);

		return json({ body: fitted, paragraphCount, demo: false });
	} catch (e) {
		const msg = e instanceof Error ? e.message : String(e);
		return json({
			body: demoBody(paragraphCount, title, text || angle),
			paragraphCount,
			demo: true,
			error: msg,
		});
	}
};
