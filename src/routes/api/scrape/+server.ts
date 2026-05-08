import { json } from '@sveltejs/kit';
import { createClient } from '@supabase/supabase-js';
import { env } from '$env/dynamic/private';
import type { RequestHandler } from './$types';
import { parseJsonBody, scrapeBodySchema } from '$lib/server/request-security';

const APIFY_ACTOR_ID = 'apify~instagram-post-scraper';

export const POST: RequestHandler = async ({ request, locals }) => {
	const { user } = await locals.safeGetSession();
	if (!user) return json({ error: 'Unauthorized' }, { status: 401 });

	const parsed = await parseJsonBody(request, scrapeBodySchema, 8192);
	if (!parsed.ok) return json({ error: parsed.error }, { status: parsed.status });
	const creatorId = parsed.data.creatorId;

	const supabase = createClient(env.SUPABASE_URL ?? '', env.SUPABASE_SERVICE_KEY ?? '');

	// Get creator (must belong to authenticated user — service-role bypass requires explicit filter)
	const { data: creator, error: creatorErr } = await supabase
		.from('creators')
		.select('*')
		.eq('id', creatorId)
		.eq('user_id', user.id)
		.single();

	if (creatorErr || !creator) return json({ error: 'Creator not found' }, { status: 404 });

	if (!/^[a-zA-Z0-9_.]{1,64}$/.test(String(creator.instagram_handle ?? ''))) {
		return json({ error: 'Stored handle has unsafe characters' }, { status: 400 });
	}

	if (!env.APIFY_API_TOKEN) {
		// Demo mode: insert synthetic posts so the UI works without a real token
		const demoPosts = generateDemoPosts(creator.id, creator.instagram_handle);
		await supabase.from('viral_posts').upsert(demoPosts, { onConflict: 'instagram_post_id' });
		await supabase.from('creators').update({ last_scraped_at: new Date().toISOString() }).eq('id', creatorId);
		return json({ success: true, count: demoPosts.length, demo: true });
	}

	// Run Apify actor
	const runRes = await fetch(
		`https://api.apify.com/v2/acts/${APIFY_ACTOR_ID}/runs?token=${env.APIFY_API_TOKEN}`,
		{
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				directUrls: [`https://www.instagram.com/${creator.instagram_handle}/`],
				resultsType: 'posts',
				resultsLimit: 20,
				addParentData: false,
			}),
		}
	);

	if (!runRes.ok) {
		const err = await runRes.text();
		return json({ error: `Apify error: ${err}` }, { status: 500 });
	}

	const run = await runRes.json();
	const runId = run.data?.id;

	// Poll until finished (max 90s)
	let dataset: any[] = [];
	for (let i = 0; i < 18; i++) {
		await new Promise(r => setTimeout(r, 5000));
		const statusRes = await fetch(`https://api.apify.com/v2/actor-runs/${runId}?token=${env.APIFY_API_TOKEN}`);
		const status = await statusRes.json();
		if (status.data?.status === 'SUCCEEDED') {
			const dataRes = await fetch(`https://api.apify.com/v2/actor-runs/${runId}/dataset/items?token=${env.APIFY_API_TOKEN}`);
			dataset = await dataRes.json();
			break;
		}
		if (status.data?.status === 'FAILED') {
			return json({ error: 'Apify run failed' }, { status: 500 });
		}
	}

	// Upsert posts
	const posts = dataset.map((item: any) => ({
		creator_id: creator.id,
		instagram_post_id: item.id ?? item.shortCode ?? `${creator.id}_${Date.now()}`,
		caption: item.caption ?? null,
		hook: extractHook(item.caption ?? ''),
		hook_type: detectHookType(item.caption ?? ''),
		likes: item.likesCount ?? 0,
		comments: item.commentsCount ?? 0,
		shares: item.sharesCount ?? 0,
		engagement_rate: item.likesCount && item.videoViewCount
			? ((item.likesCount + item.commentsCount) / item.videoViewCount) * 100
			: null,
		media_urls: (item.images ?? item.displayUrl ? [item.displayUrl] : []),
		scraped_at: new Date().toISOString(),
		ai_analysis: null,
	}));

	if (posts.length > 0) {
		await supabase.from('viral_posts').upsert(posts, { onConflict: 'instagram_post_id' });
	}

	await supabase.from('creators').update({ last_scraped_at: new Date().toISOString() }).eq('id', creatorId);

	return json({ success: true, count: posts.length });
};

function extractHook(caption: string): string | null {
	if (!caption) return null;
	// First sentence or first line, up to 120 chars
	const firstLine = caption.split('\n')[0];
	const firstSentence = firstLine.split(/[.!?]/)[0];
	return (firstSentence || firstLine).slice(0, 120).trim() || null;
}

function detectHookType(caption: string): string {
	const lower = caption.toLowerCase();
	if (lower.match(/\d+ (ways|tips|steps|things|reasons|mistakes)/)) return 'listicle';
	if (lower.match(/how (i|to|we)/)) return 'how-to';
	if (lower.match(/stop |don't |never |avoid /)) return 'pattern-interrupt';
	if (lower.match(/\$[\d,]+ |made .* money|income|revenue/)) return 'income-reveal';
	if (lower.match(/secret|nobody tells|they don't want/)) return 'secret-reveal';
	if (lower.match(/story time|i was|when i/)) return 'story';
	return 'other';
}

function generateDemoPosts(creatorId: string, handle: string) {
	const samples = [
		{ hook: `Stop scrolling. Here's what ${handle} doesn't want you to know about growing on Instagram.`, likes: 48200, comments: 1340, hookType: 'pattern-interrupt' },
		{ hook: `I went from 0 to 100K followers in 6 months. Here are the 7 things I did differently.`, likes: 92100, comments: 3200, hookType: 'listicle' },
		{ hook: `How I made $23,000 from a single Instagram carousel post (full breakdown).`, likes: 71500, comments: 2800, hookType: 'income-reveal' },
		{ hook: `Nobody talks about this but your hook is killing your reach. Here's why.`, likes: 35800, comments: 980, hookType: 'secret-reveal' },
		{ hook: `3 carousel formats that always go viral in any niche. Save this.`, likes: 58900, comments: 1750, hookType: 'listicle' },
	];

	return samples.map((s, i) => ({
		creator_id: creatorId,
		instagram_post_id: `demo_${handle}_${i}`,
		caption: s.hook + '\n\n#instagram #growth #content',
		hook: s.hook,
		hook_type: s.hookType,
		likes: s.likes,
		comments: s.comments,
		shares: Math.floor(s.likes * 0.12),
		engagement_rate: ((s.likes + s.comments) / (s.likes * 8)) * 100,
		media_urls: [],
		scraped_at: new Date().toISOString(),
		ai_analysis: null,
	}));
}
