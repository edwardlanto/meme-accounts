/**
 * BullMQ worker: publishes scheduled_posts at their due time.
 * Facebook / Instagram / TikTok use Zernio (ZERNIO_API_KEY).
 */
import { Worker } from 'bullmq';
import Redis from 'ioredis';
import { createClient } from '@supabase/supabase-js';
import {
	buildZernioFacebookBodies,
	buildZernioInstagramBody,
	buildZernioTikTokBody,
	normalizeIgWorkerContent,
	zernioCreatePost,
} from '../lib/server/zernio-publish';

const { REDIS_URL, SUPABASE_URL, SUPABASE_SERVICE_KEY, ZERNIO_API_KEY } = process.env;

if (!REDIS_URL) throw new Error('Missing REDIS_URL');
if (!SUPABASE_URL) throw new Error('Missing SUPABASE_URL');
if (!SUPABASE_SERVICE_KEY) throw new Error('Missing SUPABASE_SERVICE_KEY');
if (!ZERNIO_API_KEY) throw new Error('Missing ZERNIO_API_KEY');

const redis = new Redis(REDIS_URL, { maxRetriesPerRequest: null });
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
const QUEUE_NAME = 'scheduled-posts';

const worker = new Worker(
	QUEUE_NAME,
	async (job) => {
		const postId = job.data?.postId;
		if (!postId) throw new Error('Missing postId');

		const { data: post, error: postErr } = await supabase
			.from('scheduled_posts')
			.select('*')
			.eq('id', postId)
			.maybeSingle();
		if (postErr) throw new Error(postErr.message);
		if (!post) return;

		if (post.status === 'cancelled' || post.status === 'published') return;

		const { data: claimed, error: claimErr } = await supabase
			.from('scheduled_posts')
			.update({ status: 'publishing' })
			.eq('id', postId)
			.eq('status', 'scheduled')
			.select('*')
			.maybeSingle();
		if (claimErr) throw new Error(claimErr.message);
		if (!claimed) return;

		try {
			const provider = claimed.connection_provider;
			const acct = claimed.connection_provider_account_id;
			const content = claimed.content ?? {};

			if (provider !== 'zernio') {
				throw new Error(`Publishing not implemented for ${provider}:${acct} (use Zernio for Facebook, Instagram, TikTok)`);
			}

			const { data: conn, error: connErr } = await supabase
				.from('social_connections')
				.select('*')
				.eq('user_id', claimed.user_id)
				.eq('provider', 'zernio')
				.eq('provider_account_id', acct)
				.maybeSingle();
			if (connErr) throw new Error(connErr.message);
			if (!conn) throw new Error('Missing Zernio social connection');

			const platform = String((conn as any).meta?.platform ?? '');
			const apiKey = ZERNIO_API_KEY;
			let publishRes: unknown;

			if (platform === 'facebook') {
				const pageId = (conn as any).meta?.facebookPageId ? String((conn as any).meta.facebookPageId) : undefined;
				const bodies = await buildZernioFacebookBodies(apiKey, String(acct), content, {
					facebookPageId: pageId,
				});
				const results: unknown[] = [];
				for (const b of bodies) results.push(await zernioCreatePost(apiKey, b));
				publishRes = { kind: 'facebook', results };
			} else if (platform === 'instagram') {
				const normalized = normalizeIgWorkerContent(content);
				const body = await buildZernioInstagramBody(apiKey, String(acct), normalized);
				publishRes = await zernioCreatePost(apiKey, body);
			} else if (platform === 'tiktok') {
				const body = await buildZernioTikTokBody(apiKey, String(acct), content);
				publishRes = await zernioCreatePost(apiKey, body);
			} else {
				throw new Error(`Unknown Zernio platform: ${platform}`);
			}

			await supabase
				.from('scheduled_posts')
				.update({
					status: 'published',
					published_at: new Date().toISOString(),
					last_error: null,
					content: { ...content, provider_result: publishRes },
				})
				.eq('id', postId);
		} catch (e) {
			const err = e as any;
			const msg = err?.message ?? String(err);
			const lower = String(msg).toLowerCase();
			const isAuthErr =
				/(reconnect|unauthoriz|401|403)/.test(lower) ||
				(/oauth/.test(lower) && /(expired|invalid|revoked|session)/.test(lower));
			let finalMsg = msg;
			if (isAuthErr && claimed?.user_id && claimed?.connection_provider && claimed?.connection_provider_account_id) {
				finalMsg = `Reconnect required: ${msg}`;
				try {
					await supabase
						.from('social_connections')
						.update({ needs_reauth: true, last_auth_error: msg })
						.eq('user_id', claimed.user_id)
						.eq('provider', claimed.connection_provider)
						.eq('provider_account_id', claimed.connection_provider_account_id);
				} catch (markErr: any) {
					console.error('[worker] failed to flag connection for reauth:', markErr?.message ?? markErr);
				}
			}

			await supabase
				.from('scheduled_posts')
				.update({
					status: 'failed',
					last_error: finalMsg,
					attempt_count: (claimed.attempt_count ?? 0) + 1,
				})
				.eq('id', postId);
			throw e;
		}
	},
	{ connection: redis }
);

worker.on('completed', (job) => console.log(`[worker] ✓ completed job ${job.id}`));
worker.on('failed', (job, err) => console.error(`[worker] ✗ failed job ${job?.id}:`, err?.message ?? err));
worker.on('error', (err) => console.error('[worker] error:', err?.message ?? err));

console.log(`[worker] listening on queue "${QUEUE_NAME}" (Zernio)`);
