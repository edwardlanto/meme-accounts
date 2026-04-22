import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { scheduledPostsQueue } from '$lib/server/queue';
import { adminClient, requireUserId } from '$lib/server/auth';

type Body = {
	connectionProvider: string; // 'meta' | 'linkedin' | 'gmb' ...
	connectionProviderAccountId: string; // 'fbpage:123' | ig_user_id | 'org:..' etc.
	scheduledAt: string; // ISO
	content: Record<string, any>;
};

export const POST: RequestHandler = async ({ request }) => {
	let userId: string;
	try {
		userId = await requireUserId(request);
	} catch (e: any) {
		return json({ ok: false, error: e?.message ?? 'Unauthorized' }, { status: e?.status ?? 401 });
	}

	const body = (await request.json()) as Body;
	const connectionProvider = body.connectionProvider ?? '';
	const connectionProviderAccountId = body.connectionProviderAccountId ?? '';
	const scheduledAt = body.scheduledAt ?? '';
	const content = body.content ?? {};

	if (!connectionProvider || !connectionProviderAccountId || !scheduledAt) {
		return json({ ok: false, error: 'Missing required fields' }, { status: 400 });
	}

	const when = new Date(scheduledAt);
	if (Number.isNaN(when.getTime())) {
		return json({ ok: false, error: 'Invalid scheduledAt' }, { status: 400 });
	}

	const supabase = adminClient();

	// Verify the connection belongs to the authenticated user before scheduling.
	const { data: conn, error: connErr } = await supabase
		.from('social_connections')
		.select('user_id')
		.eq('user_id', userId)
		.eq('provider', connectionProvider)
		.eq('provider_account_id', connectionProviderAccountId)
		.maybeSingle();
	if (connErr) return json({ ok: false, error: connErr.message }, { status: 500 });
	if (!conn) return json({ ok: false, error: 'Connection not found for this user' }, { status: 403 });

	const { data: row, error: insErr } = await supabase
		.from('scheduled_posts')
		.insert({
			user_id: userId,
			connection_provider: connectionProvider,
			connection_provider_account_id: connectionProviderAccountId,
			content,
			scheduled_at: when.toISOString(),
			status: 'scheduled',
		})
		.select('*')
		.single();

	if (insErr) return json({ ok: false, error: insErr.message }, { status: 500 });

	const queue = scheduledPostsQueue();
	const delay = Math.max(0, when.getTime() - Date.now());
	const job = await queue.add(
		'publish',
		{ postId: row.id },
		{
			delay,
			attempts: 5,
			backoff: { type: 'exponential', delay: 30_000 },
			removeOnComplete: { count: 1000 },
			removeOnFail: { count: 5000 },
		}
	);

	const { error: upErr } = await supabase
		.from('scheduled_posts')
		.update({ job_id: String(job.id) })
		.eq('id', row.id);
	if (upErr) {
		// If we couldn't store the job id, still return success (job is scheduled).
		return json({ ok: true, post: row, jobId: String(job.id), warning: upErr.message });
	}

	return json({ ok: true, post: { ...row, job_id: String(job.id) }, jobId: String(job.id) });
};

