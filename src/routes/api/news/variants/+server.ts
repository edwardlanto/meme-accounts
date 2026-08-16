import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import type { RequestHandler } from './$types';
import { newsVariantsBodySchema, parseJsonBody } from '$lib/server/request-security';
import { stripEmDashes } from '$lib/strip-em-dashes';
import { clampToCompleteWords, ensureCompleteThought } from '$lib/studio/fit-copy';
import { generationTonePromptSuffix } from '$lib/studio/generation-tone';
import {
	assessUserTopicSafety,
	filterUnsafeGeneratedStrings,
	withCopySafetyRules,
} from '$lib/server/ai-copy-safety';
import { enforceAiHeavyRateLimit, rateLimitedJson } from '$lib/server/rate-limit';

const OPENROUTER_API = 'https://openrouter.ai/api/v1/chat/completions';
const MODEL = 'anthropic/claude-sonnet-4.5';
const DEFAULT_MAX_WORDS = 28;

function clampMaxWords(raw: unknown): number {
	const n = Math.floor(Number(raw));
	if (!Number.isFinite(n)) return DEFAULT_MAX_WORDS;
	return Math.max(6, Math.min(120, n));
}

function truncate(text: string, max = DEFAULT_MAX_WORDS): string {
	return ensureCompleteThought(
		clampToCompleteWords(stripEmDashes(String(text ?? '').trim()), max),
	);
}

type VariantContentMode = 'general' | 'news' | 'fact' | 'story' | 'quote' | 'steps';

function clampStepCount(raw: unknown, slideCount: number): number {
	const n = Math.floor(Number(raw));
	if (Number.isFinite(n) && n >= 1) return Math.max(1, Math.min(8, n));
	// Infer from deck: hook + N steps + CTA
	return Math.max(1, Math.min(8, Math.max(1, slideCount - 2)));
}

export const POST: RequestHandler = async ({ request, locals }) => {
	const { user } = await locals.safeGetSession();
	if (!user) return json({ error: 'Unauthorized' }, { status: 401 });

	const heavy = enforceAiHeavyRateLimit(user.id);
	if (!heavy.ok) return rateLimitedJson(heavy.retryAfterSec);

	const parsed = await parseJsonBody(request, newsVariantsBodySchema);
	if (!parsed.ok) return json({ error: parsed.error }, { status: parsed.status });

	const body = parsed.data;
	const {
		count = 3,
		title = '',
		text = '',
		sourceUrl = '',
		autoHighlight = true,
		contentMode: contentModeRaw,
		stepCount: stepCountRaw,
		includeReplies: includeRepliesRaw,
		includeBodies: includeBodiesRaw,
		maxWords: maxWordsRaw,
		maxWordsSupport: maxWordsSupportRaw,
		audience: audienceRaw,
		emotion: emotionRaw,
		style: styleRaw,
	} = body;

	if (!text.trim()) return json({ error: 'Missing article text' }, { status: 400 });

	const topicSafety = assessUserTopicSafety(title, text);
	if (!topicSafety.ok) {
		return json({ error: topicSafety.error, code: topicSafety.code }, { status: 400 });
	}

	const slideCount = Math.max(1, Math.min(10, Math.floor(Number(count))));
	const contentMode: VariantContentMode =
		contentModeRaw === 'general' ||
		contentModeRaw === 'fact' ||
		contentModeRaw === 'story' ||
		contentModeRaw === 'quote' ||
		contentModeRaw === 'steps'
			? contentModeRaw
			: 'news';
	const stepCount = clampStepCount(stepCountRaw, slideCount);
	const includeReplies = includeRepliesRaw === true;
	/** Default on: Studio needs a unique paragraph under each headline. */
	const includeBodies = includeBodiesRaw !== false;
	const MAX_WORDS = clampMaxWords(maxWordsRaw);
	const SUPPORT_WORDS = clampMaxWords(maxWordsSupportRaw ?? 24);
	const toneSuffix = generationTonePromptSuffix({
		audience: audienceRaw,
		emotion: emotionRaw,
		style: styleRaw,
	});

	if (!env.OPENROUTER_API_KEY) {
		const variants = getMockVariants(slideCount, title, contentMode, stepCount).map(stripEmDashes);
		const bodies = includeBodies
			? getMockBodies(slideCount, title, contentMode).map((b) => truncate(b, SUPPORT_WORDS))
			: [];
		return json({
			variants,
			...(includeBodies ? { bodies } : {}),
			...(includeReplies
				? { replies: getMockReplies(slideCount, title).map(stripEmDashes) }
				: {}),
		});
	}

	try {
		const noEmDash =
			` NEVER use em dashes (—) or en dashes (–); use commas, periods, or a plain hyphen (-) only.` +
			` Each string MUST be a COMPLETE grammatical thought that starts and finishes — never cut mid-sentence or mid-clause, never use ellipsis (…).` +
			` Never end on dangling words like "that", "and", "to", or "a".` +
			` If it will not fit in ${MAX_WORDS} words, write a shorter finished line instead.`;
		// ── Generate all slide texts in one call ──────────────────────────────
		const newsSystem =
			`You write short Instagram carousel overlay copy. Output ONLY valid JSON. ` +
			`Return a JSON array of exactly ${slideCount} strings. Each string must be ≤ ${MAX_WORDS} words (strict). ` +
			`Structure rules: ` +
			`Slide 1 is the strongest hook/claim. ` +
			`Slides 2–N must SUPPORT slide 1 with specific details from the article (numbers, names, mechanisms, concrete examples). ` +
			`Each supporting slide must be a DIFFERENT support type — never a rewrite of a previous slide. ` +
			`Preferred order: slide 2 = concrete evidence/stat/example, slide 3 = why it matters/implication, slide 4 = action/lesson, remaining = distinct angles. ` +
			`Each slide feels like the NEXT PANEL in the same carousel. ` +
			`No near-duplicates. No quotes, markdown, emojis, or hashtags.` +
			noEmDash;

		const generalSystem =
			`You write short Instagram carousel overlay copy from a natural-language request. Output ONLY valid JSON. ` +
			`Return a JSON array of exactly ${slideCount} strings. Each string must be ≤ ${MAX_WORDS} words (strict). ` +
			`The user asked casually (e.g. "god is real", "japan", "beds") — write ABOUT that topic, not about how to post. ` +
			`Ban meta advice: no algorithms, feeds, "carousels", "hooks", "creators", "stop the scroll", or posting tips. ` +
			`RELEVANCE: every slide must be unmistakably about the request. Ban distant metaphors that never name the subject. ` +
			`Slide 1 = strongest scroll-stopping hook matching their request (front-load the subject). ` +
			`If slide 1 is already provided as a HOOK in the user message, keep its claim — polish for punch, do not change the topic. ` +
			`Slides 2–N each add a NEW facet, tip, example, or beat about the subject — never paraphrase slide 1. ` +
			`Match implied format (tips → concrete tips; claim/belief → proof/tension/stakes; product/topic → facets; story → beats). ` +
			`ALL CAPS. No near-duplicates. No quotes, markdown, emojis, or hashtags.` +
			noEmDash;

		const factSystem =
			`You write short Instagram carousel overlay copy for a DID-YOU-KNOW / science explainer (not a story). Output ONLY valid JSON. ` +
			`Return a JSON array of exactly ${slideCount} strings. Each string must be ≤ ${MAX_WORDS} words (strict). ` +
			`Slide 1 = punchy hook. Slides 2–N each reveal a different facet: mechanism, numbers, comparison, common misconception, stakes, cautious takeaway. ` +
			`No fake dialogue. No plot beats. No near-duplicates. ALL CAPS. No quotes, markdown, emojis, or hashtags.` +
			noEmDash;

		const storySystem =
			`You write Instagram carousel overlay copy for a SHORT STORY (fiction or tight real-life anecdote), not a news article and not self-help tips. Output ONLY valid JSON. ` +
			`Return a JSON array of exactly ${slideCount} strings. Each string must be ≤ ${MAX_WORDS} words (strict). ` +
			`Slide 1 = the hook (may echo the title). ` +
			`Slides 2–N are the NEXT SCENES in the same narrative: same character(s), chronological or clearly causal order. ` +
			`Each slide is ONE beat: a moment, a reversal, a choice, a consequence, a revelation, or the aftermath. ` +
			`Ban listicle framing ("three lessons…", "here is why…") unless it is clearly spoken in-scene. ` +
			`Each slide must advance plot or emotional truth — never paraphrase an earlier slide. ` +
			`ALL CAPS. No quotes, markdown, emojis, or hashtags.` +
			noEmDash;

		const quoteSystem =
			`You write Instagram carousel overlay copy for a QUOTE carousel (original lines, not copied famous quotes). Output ONLY valid JSON. ` +
			`Return a JSON array of exactly ${slideCount} strings. Each string must be ≤ ${MAX_WORDS} words (strict). ` +
			`Slide 1 = the main quote (may echo the title hook). ` +
			`Slides 2–N each deepen the same topic: meaning, tension, tradeoff, hope, or accountability — one fresh angle per slide. ` +
			`No fake celebrity names. No near-duplicates. ALL CAPS. No quotation marks, markdown, emojis, or hashtags.` +
			noEmDash;

		const middleSteps = Math.max(0, slideCount - 2);
		const effectiveSteps = slideCount <= 1 ? 0 : slideCount === 2 ? 1 : Math.min(stepCount, middleSteps);
		const stepsSystem =
			`You write Instagram carousel overlay copy for a NUMBERED STEPS / listicle carousel. Output ONLY valid JSON. ` +
			`Return a JSON array of exactly ${slideCount} strings. Each string must be ≤ ${MAX_WORDS} words (strict). ` +
			`Structure is FIXED: ` +
			(slideCount === 1
				? `Only slide 1 = the cover hook promising the steps.`
				: slideCount === 2
					? `Slide 1 = cover hook. Slide 2 = STEP 1: one concrete action (or a short CTA if the bible has only one move).`
					: `Slide 1 = cover hook (e.g. "${stepCount} STEPS TO…"). ` +
						`Slides 2 through ${1 + effectiveSteps} = STEP 1, STEP 2, … STEP ${effectiveSteps} — each line MUST start with "STEP k:" (k = 1..${effectiveSteps}) then one concrete action. ` +
						(slideCount > effectiveSteps + 1
							? `Final slide(s) = CTA / invitation to start (no new step number). `
							: ``) +
						`Use the numbered bible in the context; do not invent unrelated tips.`) +
			` ALL CAPS. No quotes, markdown, emojis, or hashtags. No near-duplicates.`;

		const bodyRules = includeBodies
			? ` ALSO return supporting paragraphs. Output ONLY a JSON object (no markdown fences) with shape ` +
				`{"variants":[...${slideCount} strings...],"bodies":[...${slideCount} strings...]` +
				(includeReplies ? `,"replies":[...${slideCount} strings...]` : '') +
				`}. ` +
				`bodies[i] is the paragraph UNDER variants[i] on the same slide. ` +
				`Each body: sentence case (not ALL CAPS), ≤ ${SUPPORT_WORDS} words, 1–2 complete sentences, no hashtags/emojis/quotes/[[highlights]]. ` +
				`CRITICAL: every bodies[i] must be DISTINCT — never reuse the same paragraph on multiple slides. ` +
				`bodies[i] must FOLLOW and deepen variants[i] specifically (evidence, mechanism, stakes, or implication for THAT headline), not restate the hook or another slide.`
			: includeReplies
				? ` ALSO return tweet reply punchlines. Output ONLY a JSON object (no markdown fences) with shape ` +
					`{"variants":[...${slideCount} strings...],"replies":[...${slideCount} strings...]}. ` +
					`Each replies[i] is a short witty reply reacting to variants[i] (≤ 16 words, normal sentence case, no hashtags/emojis/quotes). ` +
					`Replies should feel like a second person dunking, clarifying, or finishing the thought — not a rewrite of the tweet.`
				: '';

		const replyExtra =
			includeBodies && includeReplies
				? ` Also include "replies":[...${slideCount} strings...] — each replies[i] is a short witty reply reacting to variants[i] (≤ 16 words, normal sentence case, no hashtags/emojis/quotes).`
				: '';

		const systemPrompt =
			(includeBodies || includeReplies
				? `CRITICAL OUTPUT FORMAT: return ONLY a JSON object (not a bare array). `
				: '') +
			(contentMode === 'story'
				? storySystem
				: contentMode === 'fact'
					? factSystem
					: contentMode === 'quote'
						? quoteSystem
						: contentMode === 'steps'
							? stepsSystem
							: contentMode === 'general'
								? generalSystem
								: newsSystem) +
			bodyRules +
			replyExtra;

		const userPrompt =
			(contentMode === 'steps'
				? `Cover title / hook topic: ${title || 'Untitled'}\n\nSteps bible (mine numbered steps from this):\n${text.slice(0, 12000)}\n\n` +
					`Write all ${slideCount} slides as ONE steps carousel. Target about ${stepCount} numbered steps. ` +
					`Slide 1 = hook. Middle slides = STEP k: …. Last slide = CTA when the deck is long enough.`
				: contentMode === 'quote'
					? `Quote topic / title: ${title || 'Untitled'}\n\nContext (meaning and angles to mine):\n${text.slice(0, 12000)}\n\n` +
						`Write all ${slideCount} slides as ONE quote carousel. Slide 1 = the quote. Later slides unpack it with distinct emotional or practical angles on the same topic.`
					: contentMode === 'story'
						? `Title: ${title || 'Untitled'}\n\nStory bible + narrative context (this is fiction or a tight anecdote — not a news article):\n${text.slice(0, 12000)}\n\n` +
							`Write all ${slideCount} slides as ONE continuous mini-story. Slide 1 = the hook. Each later slide is the next beat: same characters, forward motion, rising stakes or emotional truth. ` +
							`Do not pivot into tips, statistics, or unrelated angles unless they appear inside the scene.`
						: contentMode === 'general'
							? `User request / title: ${title || 'Untitled'}\n\nContext bible (interpret and deliver what they asked for):\n${text.slice(0, 12000)}\n\n` +
								`Write all ${slideCount} slides as ONE carousel ABOUT THE TOPIC. Slide 1 = the strongest on-topic hook (name the subject). ` +
								`If a HOOK line is already in the context, keep that claim — make it punchier, do not swap topics. ` +
								`Every later slide must add NEW information or a new angle on the SAME subject. ` +
								`Ban distant metaphors that never mention the request. Never write meta tips about posting, algorithms, carousels, hooks, or the feed.`
							: `Source: ${sourceUrl}\nTitle: ${title}\n\nArticle text:\n${text.slice(0, 12000)}\n\n` +
								`Write the carousel overlay copy for all ${slideCount} slides following the structure rules. ` +
								`Slide 1 = headline hook. Every later slide must add NEW information or a new implication.`) +
			(includeBodies
				? `\n\nAlso write ${slideCount} supporting paragraphs (bodies) — one unique paragraph per slide that follows that slide's headline.`
				: '') +
			(includeReplies
				? `\n\nAlso write ${slideCount} reply tweets (one per variant) for a quote-tweet / thread reply under an image.`
				: '') +
			toneSuffix;

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
					{ role: 'system', content: withCopySafetyRules(systemPrompt) },
					{ role: 'user', content: userPrompt },
				],
				temperature:
					contentMode === 'story'
						? 0.92
						: contentMode === 'quote'
							? 0.88
							: contentMode === 'fact'
								? 0.82
								: contentMode === 'steps'
									? 0.78
									: contentMode === 'general'
										? 0.86
										: 0.8,
				max_tokens:
					contentMode === 'story'
						? includeBodies
							? 1800
							: 1200
						: contentMode === 'steps'
							? includeBodies
								? 1600
								: 1100
							: includeBodies || includeReplies
								? 1800
								: contentMode === 'quote'
									? 1000
									: contentMode === 'general'
										? 1100
										: 1000,
			}),
		});

		if (!res.ok) throw new Error(`OpenRouter ${res.status}: ${await res.text()}`);

		const data = await res.json();
		let content = String(data.choices?.[0]?.message?.content ?? '').trim();

		// Strip markdown fences
		content = content.replace(/^```[\w]*\n?/, '').replace(/\n?```$/, '').trim();

		let variants: string[] = [];
		let replies: string[] = [];
		let bodies: string[] = [];
		try {
			const parsed = JSON.parse(content);
			if (Array.isArray(parsed)) {
				variants = parsed.map((x: unknown) => truncate(String(x ?? '').trim(), MAX_WORDS)).filter(Boolean);
			} else if (parsed && typeof parsed === 'object') {
				const v = (parsed as { variants?: unknown }).variants;
				const r = (parsed as { replies?: unknown }).replies;
				const b = (parsed as { bodies?: unknown }).bodies;
				if (Array.isArray(v)) {
					variants = v.map((x: unknown) => truncate(String(x ?? '').trim(), MAX_WORDS)).filter(Boolean);
				}
				if (Array.isArray(r)) {
					replies = r
						.map((x: unknown) => truncate(String(x ?? '').trim(), 16))
						.filter(Boolean);
				}
				if (Array.isArray(b)) {
					bodies = b
						.map((x: unknown) => truncate(String(x ?? '').trim().replace(/\[\[|\]\]/g, ''), SUPPORT_WORDS))
						.filter(Boolean);
				}
			} else {
				throw new Error('Unexpected JSON shape');
			}
		} catch {
			// Fallback: treat whole response as slide 1
			variants = [truncate(content, MAX_WORDS)];
		}

		// Ensure we have exactly slideCount items
		variants = filterUnsafeGeneratedStrings(variants);
		replies = filterUnsafeGeneratedStrings(replies);
		bodies = filterUnsafeGeneratedStrings(bodies);
		if (!variants.length) {
			return json(
				{ error: 'Generated copy didn’t pass safety checks. Try a different topic.' },
				{ status: 422 },
			);
		}
		while (variants.length < slideCount) variants.push(variants[variants.length - 1] ?? title);
		variants = variants.slice(0, slideCount);
		if (includeBodies) {
			const mockBodies = getMockBodies(slideCount, title, contentMode);
			while (bodies.length < slideCount) {
				bodies.push(
					truncate(
						bodies[bodies.length - 1] ?? mockBodies[bodies.length] ?? mockBodies[0]!,
						SUPPORT_WORDS,
					),
				);
			}
			bodies = dedupeBodies(bodies.slice(0, slideCount), SUPPORT_WORDS, title);
		}
		if (includeReplies) {
			const mockReplies = getMockReplies(slideCount, title);
			while (replies.length < slideCount) {
				replies.push(replies[replies.length - 1] ?? mockReplies[replies.length] ?? mockReplies[0]!);
			}
			replies = replies.slice(0, slideCount);
		}

		// ── Optional second pass: add [[highlights]] to each slide ───────────
		if (autoHighlight && variants.length > 0) {
			const highlighted = await addHighlights(variants, title, contentMode, MAX_WORDS);
			variants = highlighted;
		}
		variants = variants.map((v) => stripEmDashes(v));
		replies = replies.map((r) => stripEmDashes(r));
		bodies = bodies.map((b) => stripEmDashes(b));
		return json({
			variants,
			...(includeBodies ? { bodies } : {}),
			...(includeReplies ? { replies } : {}),
		});
	} catch (err: any) {
		console.error('[news/variants]', err.message);
		return json({ error: err.message }, { status: 500 });
	}
};

async function addHighlights(
	slides: string[],
	title: string,
	contentMode: VariantContentMode,
	maxWords = DEFAULT_MAX_WORDS,
): Promise<string[]> {
		const system =
			`You add emphasis markers to Instagram slide HEADLINES / primary overlay lines only — never invent a separate paragraph. Output ONLY a JSON array of strings — one per slide — with emphasis added. ` +
			`Rules: wrap 1–3 short phrases per slide in [[double brackets]], e.g. [[key idea]] or [[33%]]. ` +
			`Use ONLY plain [[phrase]] markers — never grad(, marker(, pattern(, or #hex: inside brackets. ` +
			`Those spans render in the accent color. Preserve wording and line breaks. ` +
			`Keep word count ≤ ${maxWords} per slide. No hashtags, emojis, or other markdown. No nested brackets.` +
			(contentMode === 'story'
				? ` For story carousels, highlight turning-point words (revelations, stakes, choices) more than scenery.`
				: contentMode === 'quote'
					? ` For quote carousels, highlight the most resonant nouns and verbs (stakes, truth, choice).`
					: contentMode === 'steps'
						? ` For steps carousels, highlight the action verb or the key habit noun in each STEP line.`
						: '');

	const user =
		(contentMode === 'story'
			? `Story title: ${title}\n\n`
			: contentMode === 'quote'
				? `Quote title: ${title}\n\n`
				: contentMode === 'steps'
					? `Steps title: ${title}\n\n`
					: `Article title: ${title}\n\n`) +
		`Slides:\n${JSON.stringify(slides, null, 2)}\n\nReturn the same array with [[highlights]] added to key phrases.`;

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

function getMockVariants(
	count: number,
	title: string,
	contentMode: VariantContentMode = 'news',
	stepCount = 5,
): string[] {
	const newsMock = [
		title || '[[Silicon Valley]] controls startup exits',
		'[[33%]] of all acquisitions since 2000 came from 5 companies',
		'Google, Apple and Meta [[outpace]] every other buyer combined',
		'Private equity is [[losing ground]] to Big Tech acquirers',
		'[[Founders]] increasingly build to be acquired - not to IPO',
	];
	const factMock = [
		title || 'YOUR BRAIN CAN RECOGNIZE A FAMILIAR FACE IN [[150 MILLISECONDS]]',
		'THAT SPEED PRIORITIZES [[SOCIAL SIGNALS]] OVER RANDOM OBJECTS',
		'STUDIES USE [[RAPID SERIAL PRESENTATION]] TO MEASURE RECOGNITION',
		'THE TRADE-OFF: FAST READS CAN [[MISFIRE]] UNDER STRESS OR BLUR',
		'IT LIKELY EVOLVED FOR [[COOPERATION]] AND THREAT DETECTION IN GROUPS',
	];
	const storyMock = [
		title || 'SHE FOUND THE [[KEY]] UNDER THE FLOWERPOT - THE LOCK WAS ALREADY OPEN',
		'INSIDE: [[COLD COFFEE]], A NOTE HALF WRITTEN, THE WINDOW [[AJAR]]',
		'FOOTPRINTS LED TO THE [[FIRE ESCAPE]] - RAIN WIPED HALF OF THEM',
		'ON THE ROOF HE STOOD WITH HER [[RING]] IN HIS PALM - HANDS SHAKING',
		'NOT A THIEF, HE SAID - A [[PROPOSAL]] THAT WENT SIDEWAYS IN TEN MINUTES',
	];
	const quoteMock = [
		title || 'YOU DO NOT NEED [[MORE TIME]] - YOU NEED [[FEWER LIES]]',
		'EVERY YES TO [[NOISE]] IS A QUIET NO TO YOUR [[REAL LIFE]]',
		'CLARITY IS NOT [[CRUEL]] - IT IS THE FIRST FORM OF [[RESPECT]]',
		'THE TOPIC IS NOT [[MOTIVATION]] - IT IS WHAT YOU REFUSE TO [[NAME]]',
		'ONE HONEST [[NO]] CAN PROTECT A THOUSAND [[FUTURE YESSES]]',
	];
	const n = Math.max(1, Math.min(8, stepCount));
	const stepsMock = [
		title || `${n} STEPS TO [[FEEL BETTER]] THIS WEEK`,
		...Array.from({ length: n }, (_, i) => {
			const actions = [
				'[[AUDIT]] WHAT YOU ALREADY DO DAILY',
				'[[CUT]] ONE HABIT THAT QUIETLY HURTS PROGRESS',
				'[[ADD]] ONE SMALL MOVE YOU CAN FINISH TODAY',
				'[[TRACK]] THE CHANGE FOR SEVEN DAYS',
				'[[PROTECT]] THE WINDOW WHEN YOU ACTUALLY FOLLOW THROUGH',
				'[[REPEAT]] THE MINIMUM ON HARD DAYS',
				'[[REFRAME]] SLIPS AS DATA NOT FAILURE',
				'[[STACK]] THE HABIT ONTO SOMETHING YOU NEVER SKIP',
			];
			return `STEP ${i + 1}: ${actions[i % actions.length]}`;
		}),
		'START WITH [[STEP 1]] THIS WEEK - THEN TELL SOMEONE YOUR PLAN',
	];
	const mock =
		contentMode === 'story'
			? storyMock
			: contentMode === 'fact'
				? factMock
				: contentMode === 'quote'
					? quoteMock
					: contentMode === 'steps'
						? stepsMock
						: contentMode === 'general'
							? [
									title || 'HERE IS WHAT YOU NEED TO KNOW ABOUT [[BEDS]]',
									'THE BEST ONES [[SUPPORT]] YOUR SPINE WITHOUT FEELING STIFF',
									'MATERIAL AND [[FIRMNESS]] CHANGE HOW YOU WAKE UP',
									'SKIP THE HYPE — MATCH THE BED TO HOW YOU [[SLEEP]]',
									'START WITH [[ONE CHANGE]] THAT MAKES NIGHTS EASIER',
								]
							: newsMock;
	const out = mock.slice(0, count);
	while (out.length < count) out.push(out[out.length - 1]!);
	return out;
}

function getMockReplies(count: number, title = ''): string[] {
	const topic = String(title || 'that').replace(/\[\[|\]\]/g, '').trim().slice(0, 40) || 'that';
	const pool = [
		`3 straight misses chef. These appear to be French fries.`,
		`Nobody asked but here's the quiet part out loud about ${topic}.`,
		`Say it louder for the people still coping.`,
		`This aged like milk in the sun.`,
		`Bookmarking this for the next group chat meltdown.`,
		`The ratio writes itself.`,
		`Brother what is this timeline.`,
		`Finally someone said it without a TED Talk.`,
	];
	const out = pool.slice(0, count);
	while (out.length < count) out.push(out[out.length - 1] ?? pool[0]!);
	return out;
}

function getMockBodies(
	count: number,
	title: string,
	contentMode: VariantContentMode = 'news',
): string[] {
	const topic = String(title || 'the story').replace(/\[\[|\]\]/g, '').trim().slice(0, 60) || 'the story';
	const newsBodies = [
		`City leaders say the plan hinges on borrowed fleets and remote work, not new rail.`,
		`Transit agencies would lend buses for the Games while offices stay hybrid to cut peak demand.`,
		`Critics warn the timeline is tight if ridership spikes and lane space stays contested.`,
		`Organizers still have not published a full street-closure map for the busiest corridors.`,
		`The bet is behavioral: move people without pouring concrete before 2028.`,
	];
	const factBodies = [
		`Researchers timed recognition under controlled flashes, not casual scrolling.`,
		`The pathway favors faces we already know, which is why strangers take longer.`,
		`Stress and blur raise false matches, so the speed has a known failure mode.`,
		`Cross-culture studies still find the same early spike in brain response.`,
		`That design likely helped groups coordinate before language caught up.`,
	];
	const storyBodies = [
		`The porch light was on, but nobody answered the first knock.`,
		`A half-finished sentence on the table made the empty room feel recent.`,
		`Rain had already started erasing the trail down the metal stairs.`,
		`He did not run. He waited like someone who knew she would follow.`,
		`The apology and the proposal arrived in the same shaky breath.`,
	];
	const quoteBodies = [
		`Time expands when you stop negotiating with distractions you already named.`,
		`Noise wins by sounding urgent while the real work waits without a lobby.`,
		`Respect starts when you say the hard sentence without decorating it.`,
		`Most people avoid the topic because naming it ends the comfortable lie.`,
		`A clean boundary today protects the calendar you keep pretending you have.`,
	];
	const stepsBodies = [
		`Start by listing what already happens on autopilot before adding anything new.`,
		`Removing one drain often frees more energy than stacking another habit.`,
		`Make the first win finishable in under ten minutes so it survives busy days.`,
		`A week of marks beats a perfect plan you abandon by Wednesday.`,
		`Tell one person the next move so the commitment has a witness.`,
	];
	const generalBodies = [
		`The useful take on ${topic} starts with what actually changes day to day.`,
		`Skip the hype cycle and look at the constraint people feel first.`,
		`One concrete example beats a vague promise every time.`,
		`Tradeoffs matter more than features once you live with the choice.`,
		`Leave with one next step you can test this week, not a manifesto.`,
	];
	const pool =
		contentMode === 'story'
			? storyBodies
			: contentMode === 'fact'
				? factBodies
				: contentMode === 'quote'
					? quoteBodies
					: contentMode === 'steps'
						? stepsBodies
						: contentMode === 'general'
							? generalBodies
							: newsBodies;
	const out = pool.slice(0, count);
	while (out.length < count) {
		out.push(`${topic} still leaves an open question on slide ${out.length + 1}.`);
	}
	return out;
}

/** If the model echoed the same lede, force uniqueness with light role-specific stubs. */
function dedupeBodies(bodies: string[], maxWords: number, title: string): string[] {
	const seen = new Set<string>();
	const topic = String(title || 'this').replace(/\[\[|\]\]/g, '').trim().slice(0, 40) || 'this';
	const fillers = [
		`The next beat on ${topic} is the mechanism behind the claim.`,
		`What changes in practice is the part most summaries skip.`,
		`The stakes show up when timelines and budgets collide.`,
		`A quieter detail: who absorbs the cost when the plan slips.`,
		`The takeaway is a concrete next check, not another slogan.`,
	];
	return bodies.map((raw, i) => {
		let t = String(raw ?? '').trim();
		const key = t.toLowerCase().replace(/\s+/g, ' ');
		if (!t || seen.has(key)) {
			t = truncate(fillers[i % fillers.length]!, maxWords);
		}
		seen.add(t.toLowerCase().replace(/\s+/g, ' '));
		return t;
	});
}
