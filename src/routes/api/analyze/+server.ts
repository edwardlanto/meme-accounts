import { json } from '@sveltejs/kit';
import { createClient } from '@supabase/supabase-js';
import { env } from '$env/dynamic/private';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
	const { postId } = await request.json();
	if (!postId) return json({ error: 'Missing postId' }, { status: 400 });

	const supabase = createClient(env.SUPABASE_URL ?? '', env.SUPABASE_SERVICE_KEY ?? '');

	const { data: post, error: postErr } = await supabase
		.from('viral_posts')
		.select('*, creators(instagram_handle, niche)')
		.eq('id', postId)
		.single();

	if (postErr || !post) return json({ error: 'Post not found' }, { status: 404 });

	const prompt = `You are a viral content strategist. Analyze this Instagram post and provide a concise breakdown.

Creator: @${post.creators?.instagram_handle}
Niche: ${post.creators?.niche ?? 'Unknown'}
Likes: ${post.likes.toLocaleString()}
Comments: ${post.comments.toLocaleString()}
Hook: ${post.hook ?? 'N/A'}
Caption: ${(post.caption ?? '').slice(0, 500)}

Respond with a JSON object (no markdown) with these exact keys:
{
  "hook_analysis": "Why this hook works (1-2 sentences)",
  "emotional_trigger": "Primary emotion this activates (e.g. FOMO, curiosity, inspiration)",
  "content_structure": "How the post is structured (e.g. problem-solution, list, story-arc)",
  "why_it_went_viral": "The core reason this performed well (2-3 sentences)",
  "remix_hooks": ["Hook variation 1", "Hook variation 2", "Hook variation 3"],
  "target_audience": "Who this resonates with most"
}`;

	if (!env.OPENROUTER_API_KEY) {
		// Demo analysis
		const demoAnalysis = {
			hook_analysis: "This hook uses a pattern interrupt combined with a curiosity gap — the reader must continue to resolve the tension created in the opening line.",
			emotional_trigger: "Curiosity + FOMO",
			content_structure: "Problem → Agitation → Solution (PAS framework)",
			why_it_went_viral: "The hook creates immediate stakes and promises insider knowledge. Combined with a specific number or claim, it triggers the brain's completion loop — viewers feel compelled to see the full answer.",
			remix_hooks: [
				"Here's the uncomfortable truth about why your content isn't growing.",
				"I analyzed 500 viral posts so you don't have to. Here's what I found.",
				"This one content mistake is costing you 80% of your reach."
			],
			target_audience: "Aspiring creators and small business owners frustrated with slow growth"
		};
		await supabase.from('viral_posts').update({ ai_analysis: demoAnalysis }).eq('id', postId);
		return json({ success: true, analysis: demoAnalysis, demo: true });
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
			temperature: 0.7,
			max_tokens: 800,
		}),
	});

	if (!res.ok) {
		const err = await res.text();
		return json({ error: `OpenRouter error: ${err}` }, { status: 500 });
	}

	const completion = await res.json();
	const raw = completion.choices?.[0]?.message?.content ?? '{}';

	let analysis: any;
	try {
		analysis = JSON.parse(raw);
	} catch {
		analysis = { raw_response: raw };
	}

	await supabase.from('viral_posts').update({ ai_analysis: analysis }).eq('id', postId);

	return json({ success: true, analysis });
};
