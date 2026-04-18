import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
	const { topic, niche, hookType, count = 10 } = await request.json();
	if (!topic) return json({ error: 'Missing topic' }, { status: 400 });

	const prompt = `You are a viral Instagram content strategist. Generate ${count} high-performing carousel hook variations.

Topic: ${topic}
Niche: ${niche ?? 'General'}
Hook style: ${hookType ?? 'Any (mix of styles)'}

Rules for great hooks:
- Under 15 words ideally, 20 max
- Create a curiosity gap or make a bold claim
- Use specific numbers where possible
- Start with action or tension, not "I" or "We"
- Make the reader NEED to swipe

Return a JSON array of strings only, no markdown, no commentary. Example format:
["Hook 1", "Hook 2", ...]`;

	if (!env.OPENROUTER_API_KEY) {
		const demoHooks = [
			`The ${topic} mistake costing you 90% of your reach.`,
			`Nobody talks about this ${topic} strategy. Here's why.`,
			`I tried every ${topic} method. Only 3 actually work.`,
			`Stop doing ${topic} wrong. Here's what actually converts.`,
			`This ${topic} formula doubled my engagement in 30 days.`,
			`The ${topic} secret top creators don't share publicly.`,
			`${topic} is changing. Here's what's working in 2025.`,
			`5 ${topic} shortcuts that saved me 10 hours a week.`,
			`Warning: This ${topic} advice will feel counterintuitive.`,
			`I analyzed 100 viral ${topic} posts. Here's the pattern.`,
		];
		return json({ hooks: demoHooks.slice(0, count), demo: true });
	}

	const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
		method: 'POST',
		headers: {
			'Authorization': `Bearer ${env.OPENROUTER_API_KEY}`,
			'Content-Type': 'application/json',
			'HTTP-Referer': 'https://carouselstudio.app',
			'X-Title': 'Carousel Studio',
		},
		body: JSON.stringify({
			model: 'anthropic/claude-3.5-sonnet',
			messages: [{ role: 'user', content: prompt }],
			temperature: 0.85,
			max_tokens: 600,
		}),
	});

	if (!res.ok) return json({ error: 'OpenRouter error' }, { status: 500 });

	const completion = await res.json();
	const raw = completion.choices?.[0]?.message?.content ?? '[]';

	let hooks: string[];
	try {
		hooks = JSON.parse(raw);
	} catch {
		hooks = raw.split('\n').filter((l: string) => l.trim()).slice(0, count);
	}

	return json({ hooks });
};
