import { json } from '@sveltejs/kit';
import { createClient } from '@supabase/supabase-js';
import { env } from '$env/dynamic/private';
import type { RequestHandler } from './$types';
import { scheduledPostsQueue } from '$lib/server/queue';

type Body = { userId: string; postId: string };

export const POST: RequestHandler = async ({ request }) => {
	if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_KEY) {
		return json({ ok: false, error: 'Missing SUPABASE_URL or SUPABASE_SERVICE_KEY' }, { status: 500 });
	}

	const body = (await request.json()) as Body;
	const userId = body.userId ?? '';
	const postId = body.postId ?? '';
	if (!userId || !postId) return json({ ok: false, error: 'Missing userId or postId' }, { status: 400 });

	const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);

	const { data: post, error: getErr } = await supabase
		.from('scheduled_posts')
		.select('*')
		.eq('id', postId)
		.eq('user_id', userId)
		.maybeSingle();
	if (getErr) return json({ ok: false, error: getErr.message }, { status: 500 });
	if (!post) return json({ ok: false, error: 'Not found' }, { status: 404 });

	const queue = scheduledPostsQueue();
	if (post.job_id) {
		const job = await queue.getJob(post.job_id);
		if (job) await job.remove();
	}

	const { error: upErr } = await supabase
		.from('scheduled_posts')
		.update({ status: 'cancelled' })
		.eq('id', postId)
		.eq('user_id', userId);
	if (upErr) return json({ ok: false, error: upErr.message }, { status: 500 });

	return json({ ok: true });
};

