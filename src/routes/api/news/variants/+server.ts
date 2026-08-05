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

type VariantContentMode = 'news' | 'fact' | 'story' | 'quote' | 'steps';

function clampStepCount(raw: unknown, slideCount: number): number {
	const n = Math.floor(Number(raw));
	if (Number.isFinite(n) && n >= 1) return Math.max(1, Math.min(8, n));
	// Infer from deck: hook + N steps + CTA
	return Math.max(1, Math.min(8, Math.max(1, slideCount - 2)));
}

export const POST: RequestHandler = async ({ request }) => {
	const body = await request.json();
	const {
		count = 3,
		title = '',
		text = '',
		sourceUrl = '',
		autoHighlight = true,
		contentMode: contentModeRaw,
		stepCount: stepCountRaw,
		includeReplies: includeRepliesRaw,
	} = body;

	if (!text.trim()) return json({ error: 'Missing article text' }, { status: 400 });

	const slideCount = Math.max(1, Math.min(10, Math.floor(Number(count))));
	const contentMode: VariantContentMode =
		contentModeRaw === 'fact' ||
		contentModeRaw === 'story' ||
		contentModeRaw === 'quote' ||
		contentModeRaw === 'steps'
			? contentModeRaw
			: 'news';
	const stepCount = clampStepCount(stepCountRaw, slideCount);
	const includeReplies = includeRepliesRaw === true;

	if (!env.OPENROUTER_API_KEY) {
		const variants = getMockVariants(slideCount, title, contentMode, stepCount);
		return json(includeReplies ? { variants, replies: getMockReplies(slideCount, title) } : { variants });
	}

	try {
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
			`No near-duplicates. No quotes, markdown, emojis, or hashtags.`;

		const factSystem =
			`You write short Instagram carousel overlay copy for a DID-YOU-KNOW / science explainer (not a story). Output ONLY valid JSON. ` +
			`Return a JSON array of exactly ${slideCount} strings. Each string must be ≤ ${MAX_WORDS} words (strict). ` +
			`Slide 1 = punchy hook. Slides 2–N each reveal a different facet: mechanism, numbers, comparison, common misconception, stakes, cautious takeaway. ` +
			`No fake dialogue. No plot beats. No near-duplicates. ALL CAPS. No quotes, markdown, emojis, or hashtags.`;

		const storySystem =
			`You write Instagram carousel overlay copy for a SHORT STORY (fiction or tight real-life anecdote), not a news article and not self-help tips. Output ONLY valid JSON. ` +
			`Return a JSON array of exactly ${slideCount} strings. Each string must be ≤ ${MAX_WORDS} words (strict). ` +
			`Slide 1 = the hook (may echo the title). ` +
			`Slides 2–N are the NEXT SCENES in the same narrative: same character(s), chronological or clearly causal order. ` +
			`Each slide is ONE beat: a moment, a reversal, a choice, a consequence, a revelation, or the aftermath. ` +
			`Ban listicle framing ("three lessons…", "here is why…") unless it is clearly spoken in-scene. ` +
			`Each slide must advance plot or emotional truth — never paraphrase an earlier slide. ` +
			`ALL CAPS. No quotes, markdown, emojis, or hashtags.`;

		const quoteSystem =
			`You write Instagram carousel overlay copy for a QUOTE carousel (original lines, not copied famous quotes). Output ONLY valid JSON. ` +
			`Return a JSON array of exactly ${slideCount} strings. Each string must be ≤ ${MAX_WORDS} words (strict). ` +
			`Slide 1 = the main quote (may echo the title hook). ` +
			`Slides 2–N each deepen the same topic: meaning, tension, tradeoff, hope, or accountability — one fresh angle per slide. ` +
			`No fake celebrity names. No near-duplicates. ALL CAPS. No quotation marks, markdown, emojis, or hashtags.`;

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

		const systemPrompt =
			(contentMode === 'story'
				? storySystem
				: contentMode === 'fact'
					? factSystem
					: contentMode === 'quote'
						? quoteSystem
						: contentMode === 'steps'
							? stepsSystem
							: newsSystem) +
			(includeReplies
				? ` ALSO return tweet reply punchlines. Output ONLY a JSON object (no markdown fences) with shape ` +
					`{"variants":[...${slideCount} strings...],"replies":[...${slideCount} strings...]}. ` +
					`Each replies[i] is a short witty reply reacting to variants[i] (≤ 16 words, normal sentence case, no hashtags/emojis/quotes). ` +
					`Replies should feel like a second person dunking, clarifying, or finishing the thought — not a rewrite of the tweet.`
				: '');

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
						: `Source: ${sourceUrl}\nTitle: ${title}\n\nArticle text:\n${text.slice(0, 12000)}\n\n` +
							`Write the carousel overlay copy for all ${slideCount} slides following the structure rules. ` +
							`Slide 1 = headline hook. Every later slide must add NEW information or a new implication.`) +
			(includeReplies
				? `\n\nAlso write ${slideCount} reply tweets (one per variant) for a quote-tweet / thread reply under an image.`
				: '');

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
				temperature:
					contentMode === 'story'
						? 0.92
						: contentMode === 'quote'
							? 0.88
							: contentMode === 'fact'
								? 0.82
								: contentMode === 'steps'
									? 0.78
									: 0.8,
				max_tokens:
					contentMode === 'story'
						? 1200
						: contentMode === 'steps'
							? 1100
							: includeReplies
								? 1400
								: contentMode === 'quote'
									? 1000
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
		try {
			const parsed = JSON.parse(content);
			if (Array.isArray(parsed)) {
				variants = parsed.map((x: unknown) => truncate(String(x ?? '').trim())).filter(Boolean);
			} else if (parsed && typeof parsed === 'object') {
				const v = (parsed as { variants?: unknown }).variants;
				const r = (parsed as { replies?: unknown }).replies;
				if (Array.isArray(v)) {
					variants = v.map((x: unknown) => truncate(String(x ?? '').trim())).filter(Boolean);
				}
				if (Array.isArray(r)) {
					replies = r
						.map((x: unknown) => truncate(String(x ?? '').trim(), 16))
						.filter(Boolean);
				}
			} else {
				throw new Error('Unexpected JSON shape');
			}
		} catch {
			// Fallback: treat whole response as slide 1
			variants = [truncate(content)];
		}

		// Ensure we have exactly slideCount items
		while (variants.length < slideCount) variants.push(variants[variants.length - 1] ?? title);
		variants = variants.slice(0, slideCount);
		if (includeReplies) {
			const mockReplies = getMockReplies(slideCount, title);
			while (replies.length < slideCount) {
				replies.push(replies[replies.length - 1] ?? mockReplies[replies.length] ?? mockReplies[0]!);
			}
			replies = replies.slice(0, slideCount);
		}

		// ── Optional second pass: add [[highlights]] to each slide ───────────
		if (autoHighlight && variants.length > 0) {
			const highlighted = await addHighlights(variants, title, contentMode);
			return json(includeReplies ? { variants: highlighted, replies } : { variants: highlighted });
		}

		return json(includeReplies ? { variants, replies } : { variants });
	} catch (err: any) {
		console.error('[news/variants]', err.message);
		return json({ error: err.message }, { status: 500 });
	}
};

async function addHighlights(
	slides: string[],
	title: string,
	contentMode: VariantContentMode,
): Promise<string[]> {
		const system =
			`You add emphasis markers to Instagram slide overlay text. Output ONLY a JSON array of strings — one per slide — with emphasis added. ` +
			`Rules: wrap 1–3 short phrases per slide in [[double brackets]], e.g. [[key idea]] or [[33%]]. ` +
			`Use ONLY plain [[phrase]] markers — never grad(, marker(, pattern(, or #hex: inside brackets. ` +
			`Those spans render in the accent color. Preserve wording and line breaks. ` +
			`Keep word count ≤ ${MAX_WORDS} per slide. No hashtags, emojis, or other markdown. No nested brackets.` +
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
		'[[Founders]] increasingly build to be acquired — not to IPO',
	];
	const factMock = [
		title || 'YOUR BRAIN CAN RECOGNIZE A FAMILIAR FACE IN [[150 MILLISECONDS]]',
		'THAT SPEED PRIORITIZES [[SOCIAL SIGNALS]] OVER RANDOM OBJECTS',
		'STUDIES USE [[RAPID SERIAL PRESENTATION]] TO MEASURE RECOGNITION',
		'THE TRADE-OFF: FAST READS CAN [[MISFIRE]] UNDER STRESS OR BLUR',
		'IT LIKELY EVOLVED FOR [[COOPERATION]] AND THREAT DETECTION IN GROUPS',
	];
	const storyMock = [
		title || 'SHE FOUND THE [[KEY]] UNDER THE FLOWERPOT — THE LOCK WAS ALREADY OPEN',
		'INSIDE: [[COLD COFFEE]], A NOTE HALF WRITTEN, THE WINDOW [[AJAR]]',
		'FOOTPRINTS LED TO THE [[FIRE ESCAPE]] — RAIN WIPED HALF OF THEM',
		'ON THE ROOF HE STOOD WITH HER [[RING]] IN HIS PALM — HANDS SHAKING',
		'NOT A THIEF, HE SAID — A [[PROPOSAL]] THAT WENT SIDEWAYS IN TEN MINUTES',
	];
	const quoteMock = [
		title || 'YOU DO NOT NEED [[MORE TIME]] — YOU NEED [[FEWER LIES]]',
		'EVERY YES TO [[NOISE]] IS A QUIET NO TO YOUR [[REAL LIFE]]',
		'CLARITY IS NOT [[CRUEL]] — IT IS THE FIRST FORM OF [[RESPECT]]',
		'THE TOPIC IS NOT [[MOTIVATION]] — IT IS WHAT YOU REFUSE TO [[NAME]]',
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
		'START WITH [[STEP 1]] THIS WEEK — THEN TELL SOMEONE YOUR PLAN',
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
