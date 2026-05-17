import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import type { RequestHandler } from './$types';

const THENEWSAPI_BASE = 'https://api.thenewsapi.com/v1/news/top';

type ContentMode = 'news' | 'fact' | 'story';

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
				'HTTP-Referer': 'https://carouselstudio.app',
				'X-Title': 'Carousel Studio',
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
	const highlightPrompt = `You are a graphic designer. Given this Instagram overlay text, wrap 1-3 key phrases in [[...]] for highlighting.

Rules:
- Wrap ONLY nouns, numbers, proper nouns, or the most impactful words
- Never wrap: articles (the, a, an), prepositions, conjunctions
- Max 3 wrapped phrases
- Keep the original text exactly — only add [[ and ]] around phrases — NEVER use grad(, marker(, pattern(, or #hex: inside brackets
- Example: "TESLA RAISES [[PRICES BY 12%]] ACROSS ALL MODELS"

Text: "${overlayText}"

Return ONLY the modified text with [[ ]] markup. No explanation.`;

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

function demoSynthetic(mode: 'fact' | 'story', storyCategory: string, syntheticHint: string) {
	const cat = (storyCategory || 'health').toLowerCase();
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
	mode: 'fact' | 'story',
	storyCategory: string,
	autoHighlight: boolean,
	syntheticHint: string,
	regenNonce = '',
) {
	const theme = (storyCategory || 'health').trim() || 'health';
	const themeLabel = theme.charAt(0).toUpperCase() + theme.slice(1).toLowerCase();
	const hintSafe = syntheticHint.trim().replace(/"/g, "'").slice(0, 600);
	const hasHint = hintSafe.length > 0;

	const regenBlock =
		typeof regenNonce === 'string' && regenNonce.trim().length > 0
			? `\n\nStudio repeat-load: vary the hook and context substantially vs prior outputs (session ${regenNonce.replace(/"/g, "'").slice(0, 32)}).\n`
			: '';

	const userPrompt =
		mode === 'fact'
			? `You write viral Instagram overlay copy. Output ONLY valid JSON (no markdown fences) with this shape:
{"hook":"...","context":"..."}

Rules for "hook":
- One punchy fact-style line, max 28 words
- Write in ALL CAPS
- No hashtags, no emojis
- Should feel surprising but plausible (avoid obvious urban myths)

Rules for "context":
- 5–8 full sentences in normal sentence case
- Expand the fact with vivid, concrete detail a carousel writer can mine for follow-up slides
- Do not repeat the hook verbatim; add mechanisms, numbers where natural, and implications${hasHint ? `\n\nUser topic (MUST be the explicit subject of both hook and context — name it directly):\n"""${hintSafe}"""` : ''}${regenBlock}`

		: `You write viral Instagram micro-stories for overlay text. Output ONLY valid JSON (no markdown fences) with this shape:
{"hook":"...","context":"..."}

Theme for the story: "${themeLabel}"${hasHint ? `\nTopic: "${hintSafe}" — the story MUST revolve around this specific subject. Name it explicitly in the hook and weave it through the context.` : ''}

Rules for "hook":
- Opening beat of a micro-story, max 28 words
- ALL CAPS
- No hashtags, no emojis
- Drop the reader into a specific moment (who, where, what is going wrong or about to change)
- If a topic is given above, the hook MUST name or directly reference it

Rules for "context":
- 8–14 full sentences in normal sentence case — this MUST read as a tiny story, not self-help bullets
- Use one clear POV (one named person OR a tight "they" couple) and keep the same cast through the whole context
- Tell a chain of scenes in order: ordinary world → inciting incident → rising pressure → a choice or revelation → consequence → emotional landing (lesson, irony, or quiet win)
- Include at least one concrete sensory or physical detail per paragraph (sound, place, object, time of day)
- No "three tips", "here is why", or generic motivational slogans unless tied to a specific plot beat
- Do not paste the hook verbatim as the first sentence${regenBlock}`;

	const jsonRaw = await openRouterComplete(
		[{ role: 'user', content: userPrompt }],
		mode === 'story' ? 0.92 : 0.88,
		mode === 'story' ? 720 : 500,
	);
	let overlayText = '';
	let description = '';

	const parsed = jsonRaw ? parseSyntheticJson(jsonRaw) : null;
	if (parsed) {
		overlayText = parsed.hook;
		description = parsed.context;
	} else {
		overlayText =
			mode === 'fact'
				? 'YOUR BRAIN CAN SPOT A FAMILIAR FACE IN AS LITTLE AS [[150 MILLISECONDS]]'
				: `SHE WALKED AWAY FROM [[EVERYTHING SAFE]] TO BET ON ${themeLabel.toUpperCase()}`;
		description =
			mode === 'fact'
				? 'Research in cognitive neuroscience suggests humans process familiar faces faster than many other visual patterns. The brain prioritizes social information. Studies using rapid serial visual presentation measure how quickly recognition occurs. This speed may have evolved for cooperation and threat detection in groups.'
				: `On a Tuesday she still cannot name, she lied once to keep the room calm. The lie bought a week of quiet, then a voicemail she should have deleted, then a friend who stopped making eye contact. She followed the trail of small evasions until it led to a door she did not want to open. What waited inside was not scandal—it was the ordinary cruelty of people choosing comfort over honesty. She said the hardest sentence out loud anyway. The group did not applaud; some walked away. Months later, the air in her chest felt different: thinner, but hers.`;
	}

	const title = titleFromHook(overlayText);

	if (autoHighlight && overlayText && !overlayText.includes('[[')) {
		overlayText = await applyHighlightMarkup(overlayText);
	}

	return {
		text: overlayText,
		imageUrl: null,
		title,
		description,
		source: mode === 'fact' ? 'Did you know' : themeLabel,
		url: null,
		uuid: null,
		categories: [],
		demo: false,
	};
}

export const POST: RequestHandler = async ({ request }) => {
	const body = await request.json();
	const {
		search,
		categories = 'business,tech',
		locale = 'us',
		language = 'en',
		limit = 3,
		pick = 'first',
		autoHighlight = true,
	} = body;

	const mode: ContentMode =
		body.mode === 'fact' || body.mode === 'story' ? body.mode : 'news';
	const storyCategory = typeof body.storyCategory === 'string' ? body.storyCategory : 'health';
	const syntheticHint =
		typeof body.syntheticHint === 'string' ? String(body.syntheticHint).trim().slice(0, 600) : '';

	if (mode === 'fact' || mode === 'story') {
		if (!env.OPENROUTER_API_KEY) {
			return json(demoSynthetic(mode, storyCategory, syntheticHint), { status: 200 });
		}
		const regenNonce =
			typeof body.studioRegenAt === 'number' && Number.isFinite(body.studioRegenAt)
				? String(Math.floor(body.studioRegenAt))
				: '';
		return json(
			await syntheticContent(mode, storyCategory, autoHighlight !== false, syntheticHint, regenNonce),
			{ status: 200 },
		);
	}

	// ── News mode: fetch from TheNewsAPI ──────────────────────────────────
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

	const article =
		pick === 'random' ? articles[Math.floor(Math.random() * articles.length)] : articles[0];

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

		const candidate = await openRouterComplete(
			[{ role: 'user', content: rewritePrompt }],
			0.8,
			120,
		);
		if (candidate) overlayText = candidate;

		if (autoHighlight && overlayText) {
			overlayText = await applyHighlightMarkup(overlayText);
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
