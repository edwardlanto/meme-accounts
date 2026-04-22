import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { scheduledPostsQueue } from '$lib/server/queue';
import { adminClient, requireUserId } from '$lib/server/auth';

type Body = { postId: string };

export const POST: RequestHandler = async ({ request }) => {
	let userId: string;
	try {
		userId = await requireUserId(request);
	} catch (e: any) {
		return json({ ok: false, error: e?.message ?? 'Unauthorized' }, { status: e?.status ?? 401 });
	}

	const body = (await request.json()) as Body;
	const postId = body.postId ?? '';
	if (!postId) return json({ ok: false, error: 'Missing postId' }, { status: 400 });

	const supabase = adminClient();

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

