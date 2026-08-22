import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import type { RequestHandler } from './$types';
import { MAX_STUDIO_SLIDE_COUNT } from '$lib/studio/compose-prefs';
import { newsBodySchema, parseJsonBody } from '$lib/server/request-security';
import { stripEmDashes } from '$lib/strip-em-dashes';
import { clampToCompleteWords, ensureCompleteThought } from '$lib/studio/fit-copy';
import { generationTonePromptSuffix, newsApiLanguage, normalizeGenerationLanguage } from '$lib/studio/generation-tone';
import { sanitizeOverlayLine } from '$lib/studio/overlay-copy';
import {
	assessUserTopicSafety,
	scrubGeneratedCopy,
	withCopySafetyRules,
} from '$lib/server/ai-copy-safety';
import { enforceAiHeavyRateLimit, rateLimitedJson } from '$lib/server/rate-limit';
import { canConsumeCarouselTokens, consumeCarouselTokens } from '$lib/server/usage';

const THENEWSAPI_BASE = 'https://api.thenewsapi.com/v1/news/top';
/** Prefer /all when searching — category + keyword work more reliably than top-only. */
const THENEWSAPI_ALL = 'https://api.thenewsapi.com/v1/news/all';

const THENEWS_CATEGORIES = new Set([
	'general',
	'science',
	'sports',
	'business',
	'health',
	'entertainment',
	'tech',
	'politics',
	'food',
	'travel',
]);

/** Map UI categories to TheNewsAPI-supported ids. */
function normalizeNewsCategories(raw: unknown): string {
	const parts = String(raw ?? '')
		.split(',')
		.map((s) => s.trim().toLowerCase())
		.filter(Boolean)
		.map((c) => (c === 'finance' ? 'business' : c))
		.filter((c) => THENEWS_CATEGORIES.has(c));
	return [...new Set(parts)].join(',') || 'general';
}

/** Some sources tag every story with many categories; prefer tighter matches. */
function categoryFitScore(article: { categories?: unknown }, wantedCsv: string): number {
	const wanted = wantedCsv.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
	const cats = Array.isArray(article.categories)
		? article.categories.map((c) => String(c).toLowerCase())
		: [];
	if (!wanted.some((w) => cats.includes(w))) return -1;
	// Prefer fewer tags (yahoo often dumps general+business+sports+entertainment on everything)
	let score = 20 - Math.min(cats.length, 12);
	if (cats.includes(wanted[0]!) && !cats.includes('general')) score += 4;
	if (cats.length === 1) score += 6;
	return score;
}

function pickNewsArticle(articles: any[], pick: string, wantedCsv: string) {
	const ranked = articles
		.map((a, i) => ({ a, i, score: categoryFitScore(a, wantedCsv) }))
		.filter((x) => x.score >= 0)
		.sort((x, y) => y.score - x.score || x.i - y.i);
	const pool = ranked.length ? ranked.map((x) => x.a) : articles;
	const topScore = ranked[0]?.score ?? -1;
	const top = ranked.length
		? ranked.filter((x) => x.score >= topScore - 2).map((x) => x.a)
		: pool;
	const from = top.length ? top : pool;
	if (pick === 'random') return from[Math.floor(Math.random() * from.length)] ?? articles[0];
	return from[0] ?? articles[0];
}

type ContentMode = 'general' | 'news' | 'fact' | 'story' | 'quote' | 'steps';
type SyntheticMode = 'general' | 'fact' | 'story' | 'quote' | 'steps';

function clampStepCount(raw: unknown): number {
	const n = Math.floor(Number(raw));
	if (!Number.isFinite(n)) return 5;
	return Math.max(3, Math.min(8, n));
}

async function openRouterComplete(
	messages: { role: string; content: string }[],
	temperature: number,
	max_tokens: number,
): Promise<string | null> {
	if (!env.OPENROUTER_API_KEY) return null;
	try {
		const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
				'Content-Type': 'application/json',
				'HTTP-Referer': 'https://memeaccounts.com',
				'X-Title': 'Meme Accounts',
			},
			body: JSON.stringify({
				model: 'anthropic/claude-sonnet-4.5',
				messages,
				temperature,
				max_tokens,
			}),
		});
		if (!r.ok) return null;
		const c = await r.json();
		return c.choices?.[0]?.message?.content?.trim() ?? null;
	} catch {
		return null;
	}
}

async function applyHighlightMarkup(overlayText: string): Promise<string> {
	const highlightPrompt = `You are a graphic designer marking an Instagram NEWS HEADLINE (ALL CAPS overlay).

Wrap 1-3 key phrases in [[...]] for highlighting.

Rules:
- This is a HEADLINE only — emphasize the punch (numbers, proper nouns, the claim)
- Wrap ONLY nouns, numbers, proper nouns, or the most impactful words
- Never wrap: articles (the, a, an), prepositions, conjunctions
- Max 3 wrapped phrases
- Keep the original text exactly — only add [[ and ]] around phrases — NEVER use grad(, marker(, pattern(, or #hex: inside brackets
- NEVER use em dashes (—) or en dashes (–). Use a comma, period, or plain hyphen (-) only.
- Example: "TESLA RAISES [[PRICES BY 12%]] ACROSS ALL MODELS"

Headline: "${overlayText}"

Return ONLY the modified headline with [[ ]] markup. No explanation.`;

	const highlighted = await openRouterComplete(
		[{ role: 'user', content: highlightPrompt }],
		0.3,
		120,
	);
	if (highlighted && highlighted.includes('[[')) return highlighted;
	return overlayText;
}

function parseSyntheticJson(raw: string): { hook: string; context: string } | null {
	const stripped = raw
		.replace(/^```(?:json)?\s*/i, '')
		.replace(/\s*```\s*$/i, '')
		.trim();
	const tryParse = (s: string) => {
		try {
			const j = JSON.parse(s);
			if (j && typeof j.hook === 'string' && typeof j.context === 'string') {
				return { hook: j.hook.trim(), context: j.context.trim() };
			}
		} catch {
			/* ignore */
		}
		return null;
	};
	const direct = tryParse(stripped);
	if (direct) return direct;
	const m = stripped.match(/\{[\s\S]*"hook"[\s\S]*"context"[\s\S]*\}/);
	if (m) return tryParse(m[0]);
	return null;
}

function titleFromHook(hook: string): string {
	const plain = hook.replace(/\[\[|\]\]/g, '').trim();
	return plain.slice(0, 120) || 'Generated';
}

/** Pull uppercase tokens from user hint for demo hooks when OpenRouter is off. */
function wordsFromHint(hint: string, minCount: number): string[] {
	const raw = hint.replace(/[^a-zA-Z0-9\s]/g, ' ').trim();
	const w = raw.split(/\s+/).filter(Boolean).map((x) => x.toUpperCase().slice(0, 24));
	const fill = ['IDEAS', 'SCIENCE', 'CHANGE', 'DISCOVERY', 'QUESTIONS'];
	let i = 0;
	while (w.length < minCount) {
		w.push(fill[i % fill.length]!);
		i++;
	}
	return w;
}

function demoSynthetic(
	mode: SyntheticMode,
	storyCategory: string,
	syntheticHint: string,
	stepCount = 5,
	regenNonce = '',
) {
	const cat = (storyCategory || 'health').toLowerCase();
	const salt = Math.abs(
		Number(String(regenNonce).replace(/\D/g, '').slice(-6)) ||
			Math.floor(Math.random() * 900000) + 100000,
	);
	if (mode === 'general') {
		const h = syntheticHint.trim() || 'something surprising';
		const topic = h.replace(/[^a-zA-Z0-9\s]/g, ' ').trim() || h;
		const topicTitle = topic
			.split(/\s+/)
			.filter(Boolean)
			.map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
			.join(' ');
		const keyWord = wordsFromHint(h, 1)[0] ?? 'IDEAS';
		/* Content ABOUT the topic — never meta advice about posting / carousels / algorithms. */
		const hooks = [
			`WHY [[${keyWord}]] STILL SURPRISES PEOPLE`,
			`THE [[${keyWord}]] DETAIL MOST PEOPLE MISS`,
			`WHAT [[${keyWord}]] LOOKS LIKE UP CLOSE`,
			`ONE [[${keyWord}]] MOMENT THAT CHANGES THE STORY`,
			`[[${keyWord}]] IS NOT WHAT YOU THINK IT IS`,
		];
		const hook = hooks[salt % hooks.length]!;
		const ledes = [
			`${topicTitle} rewards attention to one concrete scene: a place, a habit, or a detail you can picture in a second.`,
			`Most takes on ${topic} stay vague. The ones that stick name a moment, a street, a ritual, or a number people recognize.`,
			`${topicTitle} feels real when you lead with something tangible, then widen into a pattern readers can notice in their own week.`,
			`Start with what people already feel about ${topic}, then show the small shift that changes the outcome.`,
		];
		const bibleBeats = [
			`Open on one specific image or fact tied to ${topic} that stops the scroll.`,
			`Name a common misconception about ${topic} and what actually happens instead.`,
			`Give one example, scene, or object that makes ${topic} feel concrete, not abstract.`,
			`Close with one practical next step a reader can try this week related to ${topic}.`,
		];
		const lede = ledes[salt % ledes.length]!;
		const description = [lede, ...bibleBeats].join(' ');
		return {
			text: hook,
			imageUrl: null,
			title: titleFromHook(hook),
			description,
			source: 'General',
			url: null,
			uuid: `demo-general-${salt % 97}`,
			categories: [],
			demo: true,
		};
	}
	if (mode === 'steps') {
		const h = syntheticHint.trim() || 'a better gut';
		const topic = h.replace(/^\d+\s*(?:steps?|ways|tips|habits|rules|things)\s*(?:to|for)?\s*/i, '').trim() || h;
		const topicUp = wordsFromHint(topic, 3);
		const hook = `${stepCount} STEPS TO [[${topicUp[0]}]] ${topicUp.slice(1).join(' ')}`.trim();
		const stepLines = Array.from({ length: stepCount }, (_, i) => {
			const verbs = ['AUDIT', 'CUT', 'ADD', 'TRACK', 'PROTECT', 'REPEAT', 'REFRAME', 'STACK'];
			const v = verbs[i % verbs.length]!;
			return `${i + 1}. ${v} one concrete habit tied to ${topic.slice(0, 60)} — make it small enough to finish today.`;
		});
		return {
			text: hook,
			imageUrl: null,
			title: titleFromHook(hook),
			description:
				`Listicle bible for "${topic.slice(0, 120)}" (${stepCount} steps).\n` +
				stepLines.join('\n') +
				`\nCTA: Invite the reader to start with step 1 this week and share which step they will try first.`,
			source: 'Steps',
			url: null,
			uuid: 'demo-steps',
			categories: [],
			demo: true,
			stepCount,
		};
	}
	if (mode === 'quote') {
		const h = syntheticHint.trim();
		if (h) {
			const topic = h.slice(0, 80);
			const hook = `THE REAL [[COST]] OF ${wordsFromHint(h, 1)[0]} IS WHAT YOU STOP [[BECOMING]]`;
			return {
				text: hook,
				imageUrl: null,
				title: topic,
				description: `This line is about ${h.slice(0, 200)}. Use follow-up slides to name the tension honestly, one tradeoff readers recognize, and one quiet choice that changes the week. Avoid fake celebrity attributions; keep the voice universal and specific to the topic.`,
				source: 'Quotes',
				url: null,
				uuid: 'demo-quote-topic',
				categories: [],
				demo: true,
			};
		}
		return {
			text: 'YOU DO NOT NEED [[MORE TIME]] — YOU NEED [[FEWER LIES]] ABOUT WHAT MATTERS',
			imageUrl: null,
			title: 'What matters',
			description:
				'Most burnout is not workload—it is misalignment. We say yes to things that look impressive and feel hollow. The quote is a filter: if the answer is not clearly yes, the default can be no. Clarity is not cruelty; it is respect for the one life you are actually living.',
			source: 'Quotes',
			url: null,
			uuid: 'demo-quote',
			categories: [],
			demo: true,
		};
	}
	if (mode === 'fact') {
		const h = syntheticHint.trim();
		if (h) {
			const [a, b, c] = wordsFromHint(h, 3);
			const hook = `${a} SHOWS UP IN [[HEADLINES AND LABS]] — WHAT SHOULD READERS KNOW ABOUT [[${b}]] AND [[${c}]]?`;
			return {
				text: hook,
				imageUrl: null,
				title: titleFromHook(hook),
				description: `Use follow-up slides to define ${h.slice(0, 120)}, where it matters in real life, and what experts still debate. Add one myth to puncture and one cautious takeaway. Full topic: ${h.slice(0, 500)}`,
				source: 'Did you know',
				url: null,
				uuid: 'demo-fact-topic',
				categories: [],
				demo: true,
			};
		}
		const factDesc =
			'Honey is naturally acidic and low in moisture, which prevents bacteria and mold from growing. Archaeologists have found pots of honey in Egyptian tombs that were still safe to eat after thousands of years. Enzymes from bees also contribute to its stability. This is why honey is one of the few foods that can last indefinitely when stored sealed.';
		return {
			text: 'HONEY NEVER [[SPOILS]] — ARCHAEOLOGISTS FOUND EDIBLE JARS IN ANCIENT TOMBS',
			imageUrl: null,
			title: 'Honey never spoils',
			description: factDesc,
			source: 'Did you know',
			url: null,
			uuid: 'demo-fact',
			categories: [],
			demo: true,
		};
	}
	type DemoStoryRow = {
		text: string;
		title: string;
		description: string;
		source: string;
		uuid: string;
	};
	const byTheme: Record<string, DemoStoryRow> = {
		health: {
			text: 'SHE QUIT [[CAFFEINE]] FOR 30 DAYS — THEN HER SLEEP [[FLIPPED]]',
			title: 'Caffeine reset',
			description:
				'After years of late coffees, she tracked her resting heart rate and sleep latency. The first week brought headaches and fog. By week three, deep sleep increased and afternoon crashes vanished. She kept a simple journal of energy scores. The story is about small habits compounding into better recovery, not perfection.',
			source: 'Health',
			uuid: 'demo-story-health',
		},
		wealth: {
			text: 'HE [[AUTOMATED]] HIS SAVINGS — THREE YEARS LATER THE NUMBER [[STUNNED]] HIM',
			title: 'Automated savings',
			description:
				'He started by routing 10% of every paycheck to a separate account before touching spending money. Raises went straight to investments. He avoided lifestyle creep by delaying big purchases 30 days. Small raises stacked into index contributions. The narrative follows discipline over income level.',
			source: 'Wealth',
			uuid: 'demo-story-wealth',
		},
		relationships: {
			text: 'THEY STOPPED TEXTING [[GOOD MORNINGS]] — SIX MONTHS LATER THE SILENCE [[HURT LESS]]',
			title: 'Boundaries in love',
			description:
				'They realized performative check-ins masked resentment. Weekly honest walks replaced constant pings. Therapy vocabulary entered the kitchen: bids for connection, repair attempts. Arguments got shorter because they named fears earlier. It was not a movie ending—it was maintenance.',
			source: 'Relationships',
			uuid: 'demo-story-relationships',
		},
		career: {
			text: 'SHE TURNED DOWN [[THE PROMOTION]] — THEN HER WORK [[GOT BETTER]]',
			title: 'Career tradeoff',
			description:
				'The new title meant twelve more meetings a week. She mapped where impact actually came from: deep work blocks and mentoring juniors. She proposed a hybrid role with fewer reports. Leadership pushed back, then agreed on a trial quarter. Output metrics rose while burnout scores fell.',
			source: 'Career',
			uuid: 'demo-story-career',
		},
		mindset: {
			text: 'HE REPLACED [[MOTIVATION]] WITH [[ONE BORING RULE]]',
			title: 'Mindset shift',
			description:
				'Motivation spiked and vanished. He chose a minimum viable habit: ten minutes before coffee. Missed days did not reset the score to zero. He tracked streaks loosely and focused on never missing twice. Identity shifted from athlete to person who shows up. Compounding beat intensity.',
			source: 'Mindset',
			uuid: 'demo-story-mindset',
		},
		productivity: {
			text: 'SHE DELETED [[THREE APPS]] — HER AFTERNOONS [[DOUBLED]]',
			title: 'Productivity cut',
			description:
				'Notifications were the real workload. She batch-processed email twice daily. Calendar blocks got names that matched outcomes, not tasks. Deep work lived in the morning; admin slid to four pm. Colleagues adapted after two weeks of slower replies. Throughput went up, not down.',
			source: 'Productivity',
			uuid: 'demo-story-productivity',
		},
		fitness: {
			text: 'HE ONLY TRAINED [[20 MINUTES]] — BUT NEVER [[SKIPPED]]',
			title: 'Fitness minimums',
			description:
				'Long gym sessions were a fantasy with travel. He kept dumbbells in the closet and a timer. Twenty minutes of compounds, three times a week. Progress was modest on paper but joints felt better. Consistency beat heroic January weeks. The habit became non-negotiable.',
			source: 'Fitness',
			uuid: 'demo-story-fitness',
		},
		money: {
			text: 'THEY TRACKED [[EVERY DOLLAR]] FOR ONE MONTH — THEN [[CUT]] THREE LEAKS',
			title: 'Money awareness',
			description:
				'Subscriptions had duplicated quietly. Takeout was a social tax they did not notice. They categorized without shame, then chose two cuts. Automated transfers followed. The spreadsheet was boring; the relief was not. They kept one splint intentionally so the plan felt human.',
			source: 'Money',
			uuid: 'demo-story-money',
		},
	};
	const hStory = syntheticHint.trim();
	if (hStory) {
		const themeLabel = cat.charAt(0).toUpperCase() + cat.slice(1).toLowerCase();
		const [a, b] = wordsFromHint(hStory, 2);
		const hook = `THEY KEPT RETURNING TO [[${a}]] — UNTIL [[${b}]] FORCED A NEW CHAPTER`;
		const angle = hStory.slice(0, 280).trim();
		return {
			text: hook,
			imageUrl: null,
			title: `${themeLabel}: ${hStory.slice(0, 80)}`,
			description: `Two people who used to trust each other collide over something that matters for ${themeLabel.toLowerCase()}: ${angle || 'a secret they both pretended not to see.'} It starts with a small dodge to keep the peace, then a message that should have been deleted, then a witness who does not want sides. One of them risks looking dramatic to drag the truth into the light. The fallout is awkward and specific—not a list of lessons, but scenes: where they meet, what they almost say, what they finally say, and what breaks or mends afterward.`,
			source: themeLabel,
			url: null,
			uuid: 'demo-story-topic',
			categories: [] as string[],
			demo: true,
		};
	}
	const row = byTheme[cat] ?? byTheme.health;
	return {
		...row,
		imageUrl: null,
		url: null,
		categories: [] as string[],
		demo: true,
	};
}

async function syntheticContent(
	mode: SyntheticMode,
	storyCategory: string,
	autoHighlight: boolean,
	syntheticHint: string,
	regenNonce = '',
	stepCount = 5,
	maxWords = 28,
	maxWordsSupport = 0,
	tone: { audience?: string; emotion?: string; style?: string; language?: string } = {},
	avoidHooks: string[] = [],
	slideCount = 0,
) {
	const theme = (storyCategory || 'health').trim() || 'health';
	const themeLabel = theme.charAt(0).toUpperCase() + theme.slice(1).toLowerCase();
	const hintSafe = syntheticHint.trim().replace(/"/g, "'").slice(0, 600);
	const hasHint = hintSafe.length > 0;
	const stepsN = clampStepCount(stepCount);
	const slidesN = Math.max(0, Math.min(MAX_STUDIO_SLIDE_COUNT, Math.floor(Number(slideCount)) || 0));
	const supportCap =
		maxWordsSupport > 0
			? Math.max(6, Math.min(120, maxWordsSupport))
			: maxWords <= 16
				? Math.max(12, Math.min(16, maxWords + 2))
				: maxWords <= 28
					? Math.min(28, Math.max(20, maxWords))
					: Math.max(24, Math.min(120, maxWords));

	const avoidClean = avoidHooks
		.map((h) => String(h ?? '').replace(/\[\[|\]\]/g, '').replace(/"/g, "'").trim())
		.filter(Boolean)
		.slice(0, 12);

	const ANGLE_HINTS = [
		'Lead with a surprising statistic or concrete number tied to the request.',
		'Lead with a common mistake people make about this exact topic.',
		'Lead with a vivid before/after beat that still names the topic.',
		'Lead with a myth people still believe about this topic.',
		'Lead with a day-in-the-life scene where the topic is unmistakable.',
		'Lead with a contrarian take on the request that still feels true.',
		'Lead with one sharp practical move about this topic the reader can try today.',
		'Lead with an emotional personal stake (fear, pride, or relief) about the topic.',
		'Lead with a weird-but-true detail about this topic most people overlook.',
		'Lead with a question about the topic the reader cannot ignore.',
	];
	const angleHint = ANGLE_HINTS[Math.floor(Math.random() * ANGLE_HINTS.length)]!;

	const avoidBlock =
		avoidClean.length > 0
			? `\n\nCRITICAL — prior runs for this same request already used these hooks/angles (do NOT reuse wording, structure, or the same core claim):\n${avoidClean
					.map((h, i) => `${i + 1}. "${h}"`)
					.join('\n')}\nPick a genuinely different angle ON THE SAME TOPIC. ${angleHint}\n`
			: `\n\nFreshness: ${angleHint} Do not default to the most generic take — but stay on the user's subject.\n`;

	const regenBlock =
		(typeof regenNonce === 'string' && regenNonce.trim().length > 0
			? `\n\nStudio repeat-load (session ${regenNonce.replace(/"/g, "'").slice(0, 32)}):
- Write a NEW hook — do not reuse prior wording.
- Rewrite context with a DIFFERENT opening sentence and different concrete details than any prior run on this topic.
- The first sentence of context is shown under the headline; it must feel fresh on every regenerate.
- Still name the user's topic — freshness is a new ANGLE, not a new subject.\n`
			: '') + avoidBlock;

	/** Shared hook craft — stops metaphor drift (e.g. "god is real" → random surgery scene). */
	const hookCraft = `HOOK CRAFT (non-negotiable):
- RELEVANCE LOCK: A stranger reading ONLY the hook must know it is about the user's request. Include distinctive words from the request (or an unmistakable paraphrase). Ban distant metaphors that never name the subject.
- Bad (off-topic metaphor): user says "god is real" → hook about a surgeon and a heart with no God/faith/belief words.
- Good: name God, faith, belief, prayer, creation, or the claim itself — then make it punchy.
- EYE-CATCHING: pattern interrupt + specificity. Prefer a bold claim, tension, or concrete image OVER soft poetic scenes.
- Front-load the subject in the first 4–6 words when the request is a short claim or topic.
- One complete grammatical thought. Contrast needs a comma ("FAST, NOT EVERYTHING" not "FAST NOT EVERYTHING").
- No hashtags, no emojis.`;

	const userPrompt =
		mode === 'general'
			? `You turn a natural-language request into Instagram carousel overlay copy. Output ONLY valid JSON (no markdown fences) with this shape:
{"hook":"...","context":"..."}

The user speaks casually — e.g. "god is real", "Make me a carousel of beds", "why founders quit", "japan".
Interpret their intent and produce carousel-ready copy that is ABOUT THE TOPIC ITSELF.

CRITICAL — never write meta advice about social media, posting, algorithms, "carousels", "hooks", "slides", "creators", or the feed.
If they ask for Japan, write about Japan. If they ask "god is real", write about that claim / faith / belief — not an unrelated medical or nature metaphor that never says so.

${hookCraft}

Rules for "hook":
- Slide 1 overlay: the strongest, most scroll-stopping line about THEIR request
- Max ${maxWords} words, ALL CAPS
- Must pass the relevance lock above
- Make it feel like a cover line people screenshot — not a caption under a stock photo

Rules for "context":
- ${slidesN > 1 ? `Write about ${Math.max(6, slidesN + 3)}–${Math.max(10, slidesN * 2)} full sentences` : `6–12 full sentences`} in normal sentence case
- Bible for later slides: concrete details, angles, examples, and beats about THE SAME topic as the hook
${
	slidesN > 1
		? `- DECK PACING: this bible must support exactly ${slidesN} carousel slides — order sentences as a clear arc ` +
			`(lede under the hook → evidence/example → implication/stakes` +
			(slidesN > 3 ? ` → extra distinct facets` : '') +
			` → landing/takeaway). Each beat should be usable as its own slide without repeating earlier claims.\n`
		: ''
}- Match the shape they implied (tips → numbered ideas; claim/belief → proof, tension, stakes; product/topic → facets; story → beats)
- Do not paste the hook verbatim
- Prefer specific nouns, numbers, and images over vague advice
- Sentence 1 is the on-canvas paragraph under the headline — sharp lede of at most ${supportCap} words (1–2 complete sentences). Remaining sentences are bible only.
- Sentence 1 MUST finish the idea (spell out units: "95 percent", never stop at "95.") and stay on the same subject as the hook
- Ban listicle-about-content-creation: no "open with a tangible image", "stop the scroll", "what the algorithm rewards", etc.

${hasHint ? `User request (hook + context MUST be unmistakably about this — quote its key words in the hook when short):\n"""${hintSafe}"""` : `No request given — invent a vivid, useful carousel topic.`}${regenBlock}`

			: mode === 'steps'
			? `You write a numbered STEPS / listicle bible for an Instagram carousel. Output ONLY valid JSON (no markdown fences) with this shape:
{"hook":"...","context":"..."}

${hookCraft}

Rules for "hook":
- One punchy cover line that promises exactly ${stepsN} steps (or ways/tips) about the topic
- Max ${maxWords} words, ALL CAPS
- Prefer forms like "${stepsN} STEPS TO …" or "${stepsN} WAYS TO …"
- Name the topic clearly in the cover line

Rules for "context":
- Normal sentence case
- Start with one short sentence naming the outcome
- Then exactly ${stepsN} numbered steps on their own lines: "1. …", "2. …", through "${stepsN}."
- Each step is one concrete, actionable habit or move (not vague advice)
- End with 1–2 sentences for a closing CTA angle (what to do first / invite the reader)
- Do not paste the hook verbatim${hasHint ? `\n\nUser topic (hook + every step MUST be clearly about this):\n"""${hintSafe}"""` : `\n\nPick a useful everyday topic if none is given.`}${regenBlock}`

			: mode === 'quote'
			? `You write viral Instagram quote carousel copy. Output ONLY valid JSON (no markdown fences) with this shape:
{"hook":"...","context":"..."}

${hookCraft}

Rules for "hook":
- One original, memorable quote line ABOUT the user's topic (do NOT copy a famous person's exact words)
- Max ${maxWords} words, ALL CAPS
- No quotation marks in the hook text
- Wise, sharp, or emotionally true — not generic poster filler and not an off-topic metaphor

Rules for "context":
- 6–10 full sentences in normal sentence case
- Unpack what the quote means for someone navigating this topic: tension, tradeoff, hope, or accountability
- Give carousel writers distinct follow-up angles (not a numbered tip list)
- Do not attribute to a real named person unless the user topic requires it; prefer universal voice${hasHint ? `\n\nUser topic (quote + context MUST be clearly about this — name it in the hook):\n"""${hintSafe}"""` : ''}${regenBlock}`

			: mode === 'fact'
			? `You write viral Instagram overlay copy. Output ONLY valid JSON (no markdown fences) with this shape:
{"hook":"...","context":"..."}

${hookCraft}

Rules for "hook":
- One punchy fact-style line ABOUT the user's topic, max ${maxWords} words
- ALL CAPS
- Surprising but plausible (avoid urban myths and off-topic science flexes)

Rules for "context":
- 5–8 full sentences in normal sentence case
- Expand the fact with vivid detail a carousel writer can mine — still on the same subject
- Sentence 1 is the on-canvas lede (≤ ${supportCap} words); finish the idea; spell out units
- Do not repeat the hook verbatim; add mechanisms, numbers where natural, and implications${hasHint ? `\n\nUser topic (MUST be the explicit subject of both hook and context — name it directly):\n"""${hintSafe}"""` : ''}${regenBlock}`

		: `You write viral Instagram micro-stories for overlay text. Output ONLY valid JSON (no markdown fences) with this shape:
{"hook":"...","context":"..."}

Theme for the story: "${themeLabel}"${hasHint ? `\nTopic: "${hintSafe}" — the story MUST revolve around this specific subject. Name it explicitly in the hook and weave it through the context.` : ''}

${hookCraft}

Rules for "hook":
- Opening beat of a micro-story, max ${maxWords} words
- ALL CAPS
- Drop the reader into a specific moment (who, where, what is going wrong or about to change)
- The topic must be unmistakable in the hook — not implied by a parallel metaphor

Rules for "context":
- 8–14 full sentences in normal sentence case — a tiny story, not self-help bullets
- One clear POV; same cast throughout
- Chain: ordinary world → incident → pressure → choice/revelation → consequence → landing
- Concrete sensory detail; no generic slogans unless in-scene
- Do not paste the hook verbatim as the first sentence${regenBlock}`;

	const toneSuffix = generationTonePromptSuffix(tone);
	const userPromptWithTone = withCopySafetyRules(userPrompt + toneSuffix);

	const baseTemp =
		mode === 'general'
			? 0.92
			: mode === 'story'
				? 0.94
				: mode === 'quote'
					? 0.92
					: mode === 'steps'
						? 0.9
						: 0.9;
	const temperature = Math.min(1, baseTemp + (avoidClean.length ? 0.05 : 0));

	const jsonRaw = await openRouterComplete(
		[{ role: 'user', content: userPromptWithTone }],
		temperature,
		mode === 'general'
			? Math.min(1100, 700 + (slidesN > 1 ? slidesN * 40 : 0))
			: mode === 'story'
				? 720
				: mode === 'steps'
					? 700
					: mode === 'quote'
						? 560
						: 500,
	);
	let overlayText = '';
	let description = '';

	const parsed = jsonRaw ? parseSyntheticJson(jsonRaw) : null;
	let usedDemoFallback = false;
	let parseWarning: string | undefined;
	if (parsed) {
		overlayText = scrubGeneratedCopy(parsed.hook);
		description = scrubGeneratedCopy(parsed.context);
		if (!overlayText && !description) {
			usedDemoFallback = true;
			parseWarning = 'Generated copy didn’t pass safety checks — using offline demo.';
			const demo = demoSynthetic(mode, storyCategory, syntheticHint, stepsN, regenNonce);
			overlayText = demo.text;
			description = demo.description;
		}
	} else if (mode === 'steps' || mode === 'general') {
		usedDemoFallback = true;
		if (jsonRaw) {
			parseWarning = 'AI copy failed to parse — using offline demo. Try Generate again.';
		}
		const demo = demoSynthetic(mode, storyCategory, syntheticHint, stepsN, regenNonce);
		overlayText = demo.text;
		description = demo.description;
	} else {
		overlayText =
			mode === 'quote'
				? 'THE WORK IS NOT [[HARD]] — PRETENDING IT DOES NOT [[HURT]] IS'
				: mode === 'fact'
					? 'YOUR BRAIN CAN SPOT A FAMILIAR FACE IN AS LITTLE AS [[150 MILLISECONDS]]'
					: `SHE WALKED AWAY FROM [[EVERYTHING SAFE]] TO BET ON ${themeLabel.toUpperCase()}`;
		description =
			mode === 'quote'
				? 'Naming the pain is not weakness; it is the first honest inventory. When we stop performing invulnerability, we can choose smaller commitments that match our real capacity. The topic is not about grinding harder—it is about alignment between what we say matters and what our calendar proves. One clear no can protect a thousand future yeses that would have been resentful.'
				: mode === 'fact'
					? 'Research in cognitive neuroscience suggests humans process familiar faces faster than many other visual patterns. The brain prioritizes social information. Studies using rapid serial visual presentation measure how quickly recognition occurs. This speed may have evolved for cooperation and threat detection in groups.'
					: `On a Tuesday she still cannot name, she lied once to keep the room calm. The lie bought a week of quiet, then a voicemail she should have deleted, then a friend who stopped making eye contact. She followed the trail of small evasions until it led to a door she did not want to open. What waited inside was not scandal—it was the ordinary cruelty of people choosing comfort over honesty. She said the hardest sentence out loud anyway. The group did not applaud; some walked away. Months later, the air in her chest felt different: thinner, but hers.`;
	}

	const title = titleFromHook(overlayText);

	overlayText = clampToCompleteWords(
		stripEmDashes(String(overlayText ?? '').replace(/\[\[|\]\]/g, '')),
		maxWords,
	);
	overlayText = ensureCompleteThought(overlayText);
	description = stripEmDashes(description);

	if (autoHighlight && overlayText && !overlayText.includes('[[')) {
		overlayText = await applyHighlightMarkup(overlayText);
	}

	return {
		text: sanitizeOverlayLine(overlayText),
		imageUrl: null,
		title: stripEmDashes(title),
		description,
		source:
			mode === 'general'
				? 'General'
				: mode === 'quote'
				? 'Quotes'
				: mode === 'fact'
					? 'Did you know'
					: mode === 'steps'
						? 'Steps'
						: themeLabel,
		url: null,
		uuid: null,
		categories: [],
		demo: usedDemoFallback,
		...(parseWarning ? { warning: parseWarning } : {}),
		...(mode === 'steps' ? { stepCount: stepsN } : {}),
	};
}

export const POST: RequestHandler = async ({ request, locals }) => {
	const { user } = await locals.safeGetSession();
	if (!user) return json({ error: 'Unauthorized' }, { status: 401 });
	const userId = user.id;

	const heavy = enforceAiHeavyRateLimit(userId);
	if (!heavy.ok) return rateLimitedJson(heavy.retryAfterSec);

	const parsed = await parseJsonBody(request, newsBodySchema);
	if (!parsed.ok) return json({ error: parsed.error }, { status: parsed.status });

	const body = parsed.data;
	const {
		search,
		categories = 'general',
		locale = 'us',
		language: languageRaw = 'en',
		limit = 3,
		pick = 'first',
		autoHighlight = true,
	} = body;

	const copyLanguage = normalizeGenerationLanguage(languageRaw);
	const newsFetchLanguage = newsApiLanguage(copyLanguage);
	const mode: ContentMode = body.mode ?? 'news';
	const storyCategory = typeof body.storyCategory === 'string' ? body.storyCategory : 'health';
	const syntheticHint = String(body.syntheticHint ?? '').trim();
	const stepCount = clampStepCount(body.stepCount);
	const maxWords = Math.max(6, Math.min(120, Math.floor(Number(body.maxWords)) || 28));
	const maxWordsSupport = Math.max(
		6,
		Math.min(120, Math.floor(Number(body.maxWordsSupport)) || 0),
	);
	const tone = {
		audience: body.audience,
		emotion: body.emotion,
		style: body.style,
		language: copyLanguage,
	};
	const slideCountRaw = Number(body.slideCount);
	const requestedSlides =
		Number.isFinite(slideCountRaw) && slideCountRaw > 0
			? Math.max(1, Math.min(MAX_STUDIO_SLIDE_COUNT, Math.floor(slideCountRaw)))
			: mode === 'steps'
				? stepCount
				: 1;

	const topicSafety = assessUserTopicSafety(search, syntheticHint, storyCategory);
	if (!topicSafety.ok) {
		return json({ error: topicSafety.error, code: topicSafety.code }, { status: 400 });
	}

	const tokenGate = await canConsumeCarouselTokens(userId, 1);
	if (!tokenGate.ok) {
		return json(
			{
				error: tokenGate.error,
				code: tokenGate.code,
				usage: tokenGate.status,
			},
			{ status: 402 },
		);
	}

	/** Supporting paragraph under the hook — prefer explicit body budget from Studio. */
	function supportWordCap(headlineWords: number): number {
		if (maxWordsSupport > 0) return maxWordsSupport;
		if (headlineWords <= 16) return Math.max(12, Math.min(16, headlineWords + 2));
		if (headlineWords <= 28) return Math.min(28, Math.max(20, headlineWords));
		return Math.max(24, Math.min(120, headlineWords));
	}

	async function billedJson(payload: Record<string, unknown>, opts?: { demo?: boolean }) {
		if (opts?.demo) return json(payload);
		const billed = await consumeCarouselTokens(userId, 1, { slides: requestedSlides });
		if (!billed.ok) {
			return json(
				{ error: billed.error, code: billed.code, usage: billed.status },
				{ status: 402 },
			);
		}
		return json({ ...payload, usage: billed.status });
	}

	if (mode === 'general' || mode === 'fact' || mode === 'story' || mode === 'quote' || mode === 'steps') {
		if (mode === 'general' && !syntheticHint) {
			return json(
				{ error: 'Describe what you want — e.g. “Make me a carousel of beds”.' },
				{ status: 400 },
			);
		}
		if (!env.OPENROUTER_API_KEY) {
			const regenNonce =
				typeof body.studioRegenAt === 'number' && Number.isFinite(body.studioRegenAt)
					? String(Math.floor(body.studioRegenAt))
					: '';
			return billedJson(
				demoSynthetic(mode, storyCategory, syntheticHint, stepCount, regenNonce) as Record<
					string,
					unknown
				>,
				{ demo: true },
			);
		}
		const regenNonce =
			typeof body.studioRegenAt === 'number' && Number.isFinite(body.studioRegenAt)
				? String(Math.floor(body.studioRegenAt))
				: '';
		const avoidHooks = Array.isArray(body.avoidHooks)
			? body.avoidHooks.map((h) => String(h ?? '').trim()).filter(Boolean).slice(0, 12)
			: [];
		const slideCount =
			Number.isFinite(slideCountRaw) && slideCountRaw > 0 ? requestedSlides : 0;
		return billedJson(
			(await syntheticContent(
				mode,
				storyCategory,
				autoHighlight !== false,
				syntheticHint,
				regenNonce,
				stepCount,
				maxWords,
				maxWordsSupport,
				tone,
				avoidHooks,
				slideCount,
			)) as Record<string, unknown>,
		);
	}

	// ── News mode: fetch from TheNewsAPI ──────────────────────────────────
	if (!env.THENEWSAPI_TOKEN) {
		return billedJson(demoArticle() as Record<string, unknown>, { demo: true });
	}

	const categoryParam = normalizeNewsCategories(categories);
	const searchTerm = typeof search === 'string' ? search.trim() : '';
	const fetchLimit = Math.min(50, Math.max(10, Number(limit) || 10));

	async function fetchArticles(extra: Record<string, string>): Promise<any[]> {
		const params = new URLSearchParams({
			api_token: env.THENEWSAPI_TOKEN!,
			locale,
			language: newsFetchLanguage,
			limit: String(fetchLimit),
			categories: categoryParam,
			...extra,
		});
		const endpoint = extra.search ? THENEWSAPI_ALL : THENEWSAPI_BASE;
		const res = await fetch(`${endpoint}?${params}`, {
			headers: { Accept: 'application/json' },
		});
		if (!res.ok) throw new Error(`TheNewsAPI ${res.status}`);
		const data = await res.json();
		return data?.data ?? [];
	}

	let articles: any[] = [];
	try {
		if (searchTerm) {
			articles = await fetchArticles({
				search: searchTerm,
				search_fields: 'title,description,keywords,main_text',
			});
			// Empty keyword hits (typos like "alchohol") → still return category news
			if (!articles.length) {
				articles = await fetchArticles({});
			}
		} else {
			articles = await fetchArticles({});
		}
	} catch (err: any) {
		console.error('[api/news] fetch error', err.message);
		return json(
			{
				error: `News fetch failed (${err.message}). Check THENEWSAPI_TOKEN and try again.`,
				demo: true,
			},
			{ status: 502 },
		);
	}

	if (!articles.length) {
		return json(
			{
				error: searchTerm
					? `No ${categoryParam} articles found for “${searchTerm}”. Try another keyword or category.`
					: `No articles found in category “${categoryParam}”.`,
			},
			{ status: 404 },
		);
	}

	const article = pickNewsArticle(articles, pick, categoryParam);

	let overlayText = article.title ?? '';
	let supportingCopy = stripEmDashes(String(article.description ?? '').trim());

	if (env.OPENROUTER_API_KEY) {
		const snippet = [article.title, article.description].filter(Boolean).join(' ').slice(0, 600);
		const rewritePrompt = `You are a viral Instagram post copywriter.
Rewrite this news headline into punchy Instagram overlay text.

Rules:
- Max ${maxWords} words total
- ALL CAPS (the template will uppercase it, but write in caps anyway)
- No hashtags, no emojis
- ONE complete grammatical sentence (or two short clauses joined by a comma or colon)
- Contrast needs a comma: "READ THE RIGHT THINGS FAST, NOT EVERYTHING" — never "FAST NOT EVERYTHING"
- Never mash two unrelated claims together without punctuation
- NEVER use em dashes (—) or en dashes (–). Use commas, periods, or a plain hyphen (-) only.
- MUST END WITH A COMPLETE THOUGHT — do not cut off mid-sentence or mid-clause
- If the full story won't fit in ${maxWords} words, write a shorter complete hook instead
- Keep the SAME news subject — do not swap in a prettier unrelated metaphor
- Start with the most shocking/interesting fact; front-load specificity
- NEVER wrap the sentence in quotation marks (no leading or trailing quotes)

Headline & snippet: "${snippet}"
${generationTonePromptSuffix(tone)}

Return ONLY the rewritten text. No quotes, no explanation.`;

		const candidate = await openRouterComplete(
			[{ role: 'user', content: rewritePrompt }],
			0.8,
			150,
		);
		if (candidate) overlayText = sanitizeOverlayLine(candidate, article.title ?? '');

		overlayText = ensureCompleteThought(
			clampToCompleteWords(
				stripEmDashes(String(overlayText ?? '').replace(/\[\[|\]\]/g, '')),
				maxWords,
			),
		);

		if (autoHighlight && overlayText) {
			overlayText = await applyHighlightMarkup(overlayText);
			overlayText = sanitizeOverlayLine(overlayText, overlayText);
		}

		const supportCap = supportWordCap(maxWords);
		const supportPrompt = `You write the supporting paragraph under an Instagram news meme headline.

Rules:
- ${supportCap <= 16 ? 'Exactly 1 complete sentence only' : '1 or 2 complete sentences only (never 3+)'}
- Max ${supportCap} words total — match this budget closely (SoftBank-length lede when ~24)
- Sentence case (not ALL CAPS)
- Must end on a finished sentence with . ! or ?
- Every sentence must start and finish a full idea — never end on "that", "and", "to", "a", or similar
- NEVER stop on a bare number (write "95 percent" / "16 hours", never "95." or "16.")
- NEVER use ellipsis (…) or cut a word short
- NEVER use em dashes (—) or en dashes (–)
- NEVER use [[double brackets]] or any highlight markup — plain text only (highlights belong on the headline)
- No hashtags, no emojis, no quotes around the whole blurb
- Faithful to the source; do not invent facts
- Prefer concrete fact or implication — no essay

Headline: "${stripEmDashes(article.title ?? '')}"
Source blurb: "${stripEmDashes(String(article.description ?? '').slice(0, 500))}"
${generationTonePromptSuffix(tone)}

Return ONLY the supporting paragraph.`;

		const support = await openRouterComplete(
			[{ role: 'user', content: supportPrompt }],
			0.55,
			supportCap <= 16 ? 60 : supportCap <= 28 ? 100 : Math.min(200, 40 + supportCap * 3),
		);
		if (support) {
			supportingCopy = sanitizeOverlayLine(
				stripEmDashes(support.replace(/\u2026/g, '').trim()),
				stripEmDashes(String(article.description ?? '').trim()),
			);
		}
		// Keep supporting copy in the same ballpark as the word-count chip.
		{
			supportingCopy = ensureCompleteThought(
				clampToCompleteWords(supportingCopy, supportCap),
			);
		}
		/* Paragraph role: never ship highlight markup under the headline. */
		supportingCopy = supportingCopy.replace(/\[\[|\]\]/g, '').trim();
	} else {
		overlayText = ensureCompleteThought(
			clampToCompleteWords(stripEmDashes(String(overlayText ?? '')), maxWords),
		);
		supportingCopy = ensureCompleteThought(
			clampToCompleteWords(
				stripEmDashes(String(supportingCopy ?? '')),
				supportWordCap(maxWords),
			),
		).replace(/\[\[|\]\]/g, '').trim();
	}

	return billedJson({
		text: sanitizeOverlayLine(stripEmDashes(overlayText), stripEmDashes(article.title ?? '')),
		imageUrl: article.image_url ?? null,
		title: stripEmDashes(article.title ?? ''),
		description: sanitizeOverlayLine(
			supportingCopy,
			stripEmDashes(String(article.description ?? '').trim()),
		),
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
