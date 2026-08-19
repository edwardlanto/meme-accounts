import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import type { RequestHandler } from './$types';
import {
	fitTextCarouselBodyToCanvas,
	joinTextCarouselParagraphs,
	textCarouselBudgetFromMaxWords,
	uniqueTextCarouselParagraphs,
} from '$lib/studio/text-carousel-body';
import { newsTextCarouselBodySchema, parseJsonBody } from '$lib/server/request-security';
import {
	assessUserTopicSafety,
	scrubGeneratedCopy,
	withCopySafetyRules,
} from '$lib/server/ai-copy-safety';
import { enforceAiHeavyRateLimit, rateLimitedJson } from '$lib/server/rate-limit';

const OPENROUTER_API = 'https://openrouter.ai/api/v1/chat/completions';
const MODEL = 'anthropic/claude-sonnet-4.5';

function demoBody(
	paragraphCount: number,
	title: string,
	text: string,
	slideIndex = 0,
	slideCount = 1,
	maxWords?: number,
): string {
	const topic = (title || text || 'Markets').slice(0, 80);
	const role =
		slideCount <= 1 || slideIndex <= 0
			? 'hook'
			: slideIndex >= slideCount - 1
				? 'close'
				: 'support';
	const packs: Record<string, string[]> = {
		hook: [
			`${topic} isn’t just a headline — the pressure behind it is what matters.`,
			`The first read is the easy part. What happens next is where the story gets sharp.`,
		],
		support: [
			`Order flow and positioning shifted before the commentary caught up.`,
			`Retail was still reading the summary while the real move was already underway.`,
		],
		close: [
			`The window to react is shorter than most timelines on social suggest.`,
			`Treat this as a next-step beat, not a rewrite of the opener.`,
		],
	};
	const paras = (packs[role] ?? packs.hook!).slice(0, Math.max(1, paragraphCount));
	return fitTextCarouselBodyToCanvas(joinTextCarouselParagraphs(paras), {
		randomizeParagraphCount: false,
		maxParagraphs: paragraphCount,
		maxWordsTotal: maxWords,
	});
}

function wordCapPrompt(maxWords: number, paragraphCount: number): string {
	const minWords = Math.max(8, Math.floor(maxWords * 0.7));
	const distinct =
		paragraphCount > 1
			? `Each paragraph must be a NEW thought — never repeat or lightly paraphrase the previous one. `
			: '';
	if (maxWords <= 20) {
		return (
			`HARD CAP: at most ${maxWords} words TOTAL for this slide. ` +
			`One short punchy paragraph only (${paragraphCount} item in the array). ` +
			`Prefer 1 sentence; 2 max. Do not pad.`
		);
	}
	if (maxWords <= 36) {
		const per = Math.max(8, Math.ceil(maxWords / Math.max(1, paragraphCount)));
		return (
			`HARD CAP: at most ${maxWords} words TOTAL across ${paragraphCount} paragraph(s). ` +
			`Write at least ${minWords} words. About ~${per} words per paragraph. 1–2 short sentences each. ` +
			distinct
		);
	}
	if (paragraphCount === 1) {
		return `One paragraph (~${Math.min(65, maxWords)} words). Prefer 2–3 punchy sentences. Write at least ${minWords} words.`;
	}
	if (paragraphCount === 2) {
		return (
			`Two distinct paragraphs (~${Math.min(45, Math.ceil(maxWords / 2))} words each). ` +
			`1–2 sentences per paragraph. Write at least ${minWords} words and stay under ${maxWords} total. ` +
			distinct
		);
	}
	return (
		`Three distinct paragraphs (~${Math.min(35, Math.ceil(maxWords / 3))} words each). ` +
		`1–2 sentences per paragraph. Write at least ${minWords} words and stay under ${maxWords} total. ` +
		distinct
	);
}

export const POST: RequestHandler = async ({ request, locals }) => {
	const { user: authUser } = await locals.safeGetSession();
	if (!authUser) return json({ error: 'Unauthorized' }, { status: 401 });

	const heavy = enforceAiHeavyRateLimit(authUser.id);
	if (!heavy.ok) return rateLimitedJson(heavy.retryAfterSec);

	const parsed = await parseJsonBody(request, newsTextCarouselBodySchema);
	if (!parsed.ok) return json({ error: parsed.error }, { status: parsed.status });

	const body = parsed.data;
	const title = String(body.title ?? '').trim();
	const text = String(body.text ?? '').trim();
	const angle = String(body.angle ?? '').trim();
	const sourceUrl = String(body.sourceUrl ?? '').trim();
	const slideIndex =
		typeof body.slideIndex === 'number' && Number.isFinite(body.slideIndex)
			? Math.max(0, Math.floor(body.slideIndex))
			: 0;
	const slideCount =
		typeof body.slideCount === 'number' && Number.isFinite(body.slideCount)
			? Math.max(1, Math.floor(body.slideCount))
			: 1;

	if (!text && !title && !angle) {
		return json({ error: 'Missing source text' }, { status: 400 });
	}

	const topicSafety = assessUserTopicSafety(title, text, angle);
	if (!topicSafety.ok) {
		return json({ error: topicSafety.error, code: topicSafety.code }, { status: 400 });
	}

	const maxWordsRaw =
		typeof body.maxWords === 'number' && Number.isFinite(body.maxWords)
			? Math.floor(body.maxWords)
			: undefined;
	const budget = textCarouselBudgetFromMaxWords(maxWordsRaw);

	const paragraphCount =
		typeof body.paragraphCount === 'number' && body.paragraphCount >= 1 && body.paragraphCount <= 3
			? Math.floor(body.paragraphCount)
			: budget.paragraphCount;

	const maxWords = maxWordsRaw ?? budget.maxWordsTotal;

	if (!env.OPENROUTER_API_KEY) {
		return json({
			body: demoBody(paragraphCount, title, text || angle, slideIndex, slideCount, maxWords),
			paragraphCount,
			maxWords,
			demo: true,
		});
	}

	const regen =
		typeof body.studioRegenAt === 'number' && Number.isFinite(body.studioRegenAt)
			? `\nVariation seed: ${Math.floor(body.studioRegenAt)} — write fresh wording.\n`
			: '';

	const wordCap = wordCapPrompt(maxWords, paragraphCount);

	const slideRole =
		slideCount <= 1 || slideIndex <= 0
			? 'HOOK (open the carousel — strongest claim)'
			: slideIndex >= slideCount - 1
				? 'CLOSING SUPPORT (final new beat — implication or takeaway, not a rewrite)'
				: `SUPPORT panel ${slideIndex + 1} of ${slideCount} (new evidence / mechanism / stakes — must NOT repeat the hook)`;

	const system =
		`You write body copy for ONE Instagram text-carousel slide (profile header is separate). ` +
		`This is slide ${slideIndex + 1} of ${slideCount}: ${slideRole}. ` +
		`Output ONLY valid JSON: {"paragraphs":["paragraph one","paragraph two"]}. ` +
		`Return ${paragraphCount} DISTINCT paragraph(s) — never repeat or lightly paraphrase the same line. ` +
		`${wordCap} ` +
		`Expand the slide angle / beat into the requested length with NEW sentences. ` +
		`Do NOT retell the entire article. Do NOT reuse wording from other slides. ` +
		`Do NOT return the same sentence twice. ` +
		`Use the word budget — when ${paragraphCount} paragraphs are requested, write that many distinct paragraphs, not a one-line hook copied twice. ` +
		`Rules: normal sentence case; separate array items ARE the paragraph breaks (blank lines on the card); ` +
		`never smash all sentences into one long paragraph; never join paragraphs with spaces only; ` +
		`no hashtags, emojis, markdown, or [[highlight]] markup; stay faithful to the source; ` +
		`each paragraph MUST be complete sentences — never cut mid-word, never use ellipsis (…).`;

	const userPrompt =
		`${regen}` +
		(title ? `Title: ${title}\n` : '') +
		(sourceUrl ? `Source: ${sourceUrl}\n` : '') +
		`Carousel position: slide ${slideIndex + 1} / ${slideCount} (${slideRole}).\n` +
		`Word budget: ≤ ${maxWords} words total, ${paragraphCount} paragraph(s).\n` +
		(angle
			? `THIS SLIDE'S BEAT (expand this — do not invent a different topic):\n${angle.slice(0, 600)}\n\n`
			: '') +
		`Source material (context only):\n${(text || title).slice(0, 12000)}\n\n` +
		`Remember: return ${paragraphCount} distinct paragraph(s) totaling at least ${Math.max(8, Math.floor(maxWords * 0.7))} and ≤ ${maxWords} words for THIS slide only.`;

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
					{ role: 'system', content: withCopySafetyRules(system) },
					{ role: 'user', content: userPrompt },
				],
				temperature: 0.88,
				max_tokens: maxWords <= 20 ? 220 : maxWords <= 36 ? 450 : 900,
			}),
		});

		if (!res.ok) throw new Error(`OpenRouter ${res.status}: ${await res.text()}`);

		const data = await res.json();
		let content = String(data.choices?.[0]?.message?.content ?? '').trim();
		content = content.replace(/^```[\w]*\n?/, '').replace(/\n?```$/, '').trim();

		let paragraphs: string[] = [];
		try {
			const parsedJson = JSON.parse(content) as { paragraphs?: unknown };
			if (Array.isArray(parsedJson.paragraphs)) {
				paragraphs = parsedJson.paragraphs
					.map((p) => scrubGeneratedCopy(String(p ?? '').trim()))
					.filter(Boolean)
					.slice(0, paragraphCount);
			}
		} catch {
			paragraphs = content
				.split(/\n\s*\n+/)
				.map((p) => scrubGeneratedCopy(p.trim()))
				.filter(Boolean)
				.slice(0, paragraphCount);
		}

		if (!paragraphs.length) {
			return json(
				{ error: 'Generated copy didn’t pass safety checks. Try a different topic.' },
				{ status: 422 },
			);
		}

		paragraphs = uniqueTextCarouselParagraphs(paragraphs, paragraphCount, angle);

		const fitted = fitTextCarouselBodyToCanvas(
			joinTextCarouselParagraphs(paragraphs),
			{
				randomizeParagraphCount: false,
				maxParagraphs: paragraphCount,
				maxWordsTotal: maxWords,
			},
		);

		return json({ body: fitted, paragraphCount, maxWords, demo: false });
	} catch (e) {
		const msg = e instanceof Error ? e.message : String(e);
		return json({
			body: demoBody(paragraphCount, title, text || angle, slideIndex, slideCount, maxWords),
			paragraphCount,
			maxWords,
			demo: true,
			error: msg,
		});
	}
};
