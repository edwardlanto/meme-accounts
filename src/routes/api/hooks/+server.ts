import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import type { RequestHandler } from './$types';
import { hooksBodySchema, parseJsonBody, sandboxUserPlaintext } from '$lib/server/request-security';

export const POST: RequestHandler = async ({ request, locals }) => {
	const { user } = await locals.safeGetSession();
	if (!user) return json({ error: 'Unauthorized' }, { status: 401 });

	const parsed = await parseJsonBody(request, hooksBodySchema, 32_000);
	if (!parsed.ok) return json({ error: parsed.error }, { status: parsed.status });

	const { topic, niche, hookType, count } = parsed.data;

	const topicBlock = sandboxUserPlaintext('TOPIC', topic, 9000);
	const nicheBlock = sandboxUserPlaintext('NICHE', niche || 'General', 520);
	const styleBlock = sandboxUserPlaintext('HOOK_STYLE', hookType || 'Any (mix of styles)', 220);

	const prompt = `You are a viral Instagram content strategist. Generate ${count} high-performing carousel hook variations.

${topicBlock}
${nicheBlock}
${styleBlock}

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
			'HTTP-Referer': 'https://memeaccounts.com',
			'X-Title': 'Meme Accounts',
		},
		body: JSON.stringify({
			model: 'google/gemini-3.7-flash',
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
