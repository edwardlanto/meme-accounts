import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { scheduledPostsQueue } from '$lib/server/queue';
import { adminClient, requireUserId } from '$lib/server/auth';
import { parseJsonBody, schedulerCancelBodySchema } from '$lib/server/request-security';

export const POST: RequestHandler = async ({ request }) => {
	let userId: string;
	try {
		userId = await requireUserId(request);
	} catch (e: any) {
		return json({ ok: false, error: e?.message ?? 'Unauthorized' }, { status: e?.status ?? 401 });
	}

	const parsed = await parseJsonBody(request, schedulerCancelBodySchema);
	if (!parsed.ok) return json({ ok: false, error: parsed.error }, { status: parsed.status });

	const postId = parsed.data.postId;

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

