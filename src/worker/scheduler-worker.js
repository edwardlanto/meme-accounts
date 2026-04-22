// @ts-check
import { Worker } from 'bullmq';
import Redis from 'ioredis';
import { createClient } from '@supabase/supabase-js';

const {
	REDIS_URL,
	SUPABASE_URL,
	SUPABASE_SERVICE_KEY,
} = process.env;

if (!REDIS_URL) throw new Error('Missing REDIS_URL');
if (!SUPABASE_URL) throw new Error('Missing SUPABASE_URL');
if (!SUPABASE_SERVICE_KEY) throw new Error('Missing SUPABASE_SERVICE_KEY');

const redis = new Redis(REDIS_URL, {
	maxRetriesPerRequest: null,
});

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const QUEUE_NAME = 'scheduled-posts';
const META_GRAPH_VERSION = 'v20.0';

/**
 * @param {number} ms
 */
async function sleep(ms) {
	return new Promise((r) => setTimeout(r, ms));
}

/**
 * @param {string} path
 * @param {Record<string,string>} params
 * @param {string} accessToken
 */
async function metaGraphPost(path, params, accessToken) {
	const url = new URL(`https://graph.facebook.com/${META_GRAPH_VERSION}/${path.replace(/^\//, '')}`);
	const body = new URLSearchParams({ ...params, access_token: accessToken });
	const res = await fetch(url.toString(), {
		method: 'POST',
		headers: { 'content-type': 'application/x-www-form-urlencoded' },
		body,
	});
	const data = await res.json();
	if (!res.ok) throw new Error(data?.error?.message ?? `Meta Graph POST failed: ${path}`);
	return data;
}

/**
 * @param {string} path
 * @param {Record<string,string>} params
 * @param {string} accessToken
 */
async function metaGraphGet(path, params, accessToken) {
	const url = new URL(`https://graph.facebook.com/${META_GRAPH_VERSION}/${path.replace(/^\//, '')}`);
	for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
	url.searchParams.set('access_token', accessToken);
	const res = await fetch(url.toString());
	const data = await res.json();
	if (!res.ok) throw new Error(data?.error?.message ?? `Meta Graph GET failed: ${path}`);
	return data;
}

/**
 * @param {string} dataUrl
 */
function dataUrlToBlob(dataUrl) {
	const m = String(dataUrl).match(/^data:([^;]+);base64,(.+)$/);
	if (!m) return null;
	const [, mime, b64] = m;
	const buf = Buffer.from(b64, 'base64');
	return { mime, buf };
}

/**
 * Upload a photo to a Facebook Page.
 * Supports either:
 * - public URL (params.url)
 * - data URL (params.dataUrl)
 *
 * @param {{ pageId: string; pageAccessToken: string; url?: string; dataUrl?: string; caption?: string; published?: boolean }} args
 */
async function uploadFacebookPagePhoto({ pageId, pageAccessToken, url, dataUrl, caption, published }) {
	const endpoint = new URL(`https://graph.facebook.com/${META_GRAPH_VERSION}/${pageId}/photos`);

	// If we have a data URL, send multipart.
	if (dataUrl && String(dataUrl).startsWith('data:')) {
		const blob = dataUrlToBlob(dataUrl);
		if (!blob) throw new Error('Invalid data URL for photo');
		const form = new FormData();
		form.set('access_token', pageAccessToken);
		form.set('published', published === false ? 'false' : 'true');
		if (caption) form.set('caption', caption);
		// @ts-ignore node fetch supports Blob
		form.set('source', new Blob([blob.buf], { type: blob.mime }), 'image');
		const res = await fetch(endpoint.toString(), { method: 'POST', body: form });
		const out = await res.json();
		if (!res.ok) throw new Error(out?.error?.message ?? 'Facebook photo upload failed');
		return out; // contains id / post_id depending on published
	}

	// Otherwise use URL-based upload (Meta fetches it).
	if (url) {
		const body = new URLSearchParams({
			access_token: pageAccessToken,
			published: published === false ? 'false' : 'true',
			url: String(url),
			...(caption ? { caption: String(caption) } : {}),
		});
		const res = await fetch(endpoint.toString(), {
			method: 'POST',
			headers: { 'content-type': 'application/x-www-form-urlencoded' },
			body,
		});
		const out = await res.json();
		if (!res.ok) throw new Error(out?.error?.message ?? 'Facebook photo upload failed');
		return out;
	}

	throw new Error('Missing url or dataUrl for Facebook photo upload');
}

/**
 * Upload a video to a Facebook Page.
 * Supports either:
 * - public URL (args.url)
 * - data URL (args.dataUrl) (must be video/* base64)
 *
 * Note: Facebook generally supports one video per feed post via API.
 *
 * @param {{ pageId: string; pageAccessToken: string; url?: string; dataUrl?: string; description?: string; published?: boolean }} args
 */
async function uploadFacebookPageVideo({ pageId, pageAccessToken, url, dataUrl, description, published }) {
	const endpoint = new URL(`https://graph.facebook.com/${META_GRAPH_VERSION}/${pageId}/videos`);

	if (dataUrl && String(dataUrl).startsWith('data:')) {
		const blob = dataUrlToBlob(dataUrl);
		if (!blob) throw new Error('Invalid data URL for video');
		if (!String(blob.mime).startsWith('video/')) throw new Error('Video data URL must be video/*');
		const form = new FormData();
		form.set('access_token', pageAccessToken);
		form.set('published', published === false ? 'false' : 'true');
		if (description) form.set('description', description);
		// @ts-ignore node fetch supports Blob
		form.set('source', new Blob([blob.buf], { type: blob.mime }), 'video');
		const res = await fetch(endpoint.toString(), { method: 'POST', body: form });
		const out = await res.json();
		if (!res.ok) throw new Error(out?.error?.message ?? 'Facebook video upload failed');
		return out;
	}

	if (url) {
		// Graph supports url param for some video uploads; if it fails, surface the message.
		const body = new URLSearchParams({
			access_token: pageAccessToken,
			published: published === false ? 'false' : 'true',
			file_url: String(url),
			...(description ? { description: String(description) } : {}),
		});
		const res = await fetch(endpoint.toString(), {
			method: 'POST',
			headers: { 'content-type': 'application/x-www-form-urlencoded' },
			body,
		});
		const out = await res.json();
		if (!res.ok) throw new Error(out?.error?.message ?? 'Facebook video upload failed');
		return out;
	}

	throw new Error('Missing url or dataUrl for Facebook video upload');
}

/**
 * Publish to a Facebook Page.
 * content shapes:
 * - { message: string }
 * - { message?: string, link?: string }
 * - { message?: string, images?: string[] } where images are public URLs or data URLs
 * - { message?: string, video?: string } where video is a public URL or data URL
 *
 * @param {{ pageId: string; pageAccessToken: string; content: any }} args
 */
async function publishFacebookPage({ pageId, pageAccessToken, content }) {
	const message = String(content?.message ?? '').trim();
	const link = String(content?.link ?? '').trim();
	const images = Array.isArray(content?.images)
		? content.images.map((/** @type {unknown} */ x) => String(x)).filter(Boolean)
		: [];
	const video = String(content?.video ?? '').trim();

	// Link post (no images)
	if (link && images.length === 0) {
		const url = new URL(`https://graph.facebook.com/${META_GRAPH_VERSION}/${pageId}/feed`);
		const body = new URLSearchParams({
			access_token: pageAccessToken,
			link,
			...(message ? { message } : {}),
		});
		const res = await fetch(url.toString(), { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body });
		const data = await res.json();
		if (!res.ok) throw new Error(data?.error?.message ?? 'Facebook link post failed');
		return data;
	}

	// Photo / carousel post
	if (images.length > 0) {
		// Upload all images as unpublished, then attach to a feed post.
		const mediaFbids = [];
		for (let i = 0; i < images.length; i++) {
			const img = images[i];
			const up = await uploadFacebookPagePhoto({
				pageId,
				pageAccessToken,
				url: img.startsWith('http') ? img : undefined,
				dataUrl: img.startsWith('data:') ? img : undefined,
				// caption only on the first image if we end up publishing photos directly (we don't)
				caption: undefined,
				published: false,
			});
			const id = String(up?.id ?? '');
			if (!id) throw new Error('Facebook photo upload did not return id');
			mediaFbids.push(id);
		}

		// Graph expects attached_media[0]={"media_fbid":"..."} style params
		const url = new URL(`https://graph.facebook.com/${META_GRAPH_VERSION}/${pageId}/feed`);
		const body = new URLSearchParams({ access_token: pageAccessToken });
		if (message) body.set('message', message);
		for (let i = 0; i < mediaFbids.length; i++) {
			body.set(`attached_media[${i}]`, JSON.stringify({ media_fbid: mediaFbids[i] }));
		}
		const res = await fetch(url.toString(), {
			method: 'POST',
			headers: { 'content-type': 'application/x-www-form-urlencoded' },
			body,
		});
		const data = await res.json();
		if (!res.ok) throw new Error(data?.error?.message ?? 'Facebook carousel post failed');
		return data;
	}

	// Video post (single)
	if (video) {
		const up = await uploadFacebookPageVideo({
			pageId,
			pageAccessToken,
			url: video.startsWith('http') ? video : undefined,
			dataUrl: video.startsWith('data:') ? video : undefined,
			description: message || undefined,
			published: true,
		});
		return up;
	}

	// Text-only post
	if (!message) throw new Error('Missing content.message for Facebook Page post');
	const url = new URL(`https://graph.facebook.com/${META_GRAPH_VERSION}/${pageId}/feed`);
	const res = await fetch(url.toString(), {
		method: 'POST',
		headers: { 'content-type': 'application/x-www-form-urlencoded' },
		body: new URLSearchParams({ message, access_token: pageAccessToken }),
	});
	const data = await res.json();
	if (!res.ok) throw new Error(data?.error?.message ?? 'Facebook publish failed');
	return data;
}

/**
 * Instagram container-based publishing.
 * content shape:
 * - { igType: 'post', caption?: string, imageUrl: string }
 * - { igType: 'carousel', caption?: string, children: Array<{ imageUrl?: string, videoUrl?: string }> }
 * - { igType: 'reel', caption?: string, videoUrl: string }
 *
 * Note: URLs must be publicly reachable by Meta.
 *
 * @param {{ igUserId: string; accessToken: string; content: any }} args
 */
async function publishInstagram({ igUserId, accessToken, content }) {
	const igType = String(content.igType ?? '').toLowerCase();
	const caption = String(content.caption ?? '').trim();

	if (igType === 'post') {
		const imageUrl = String(content.imageUrl ?? '').trim();
		if (!imageUrl) throw new Error('Missing content.imageUrl for IG post');
		const c = await metaGraphPost(`${igUserId}/media`, { image_url: imageUrl, ...(caption ? { caption } : {}) }, accessToken);
		const creationId = String(c?.id ?? '');
		if (!creationId) throw new Error('IG create container did not return id');
		const pub = await metaGraphPost(`${igUserId}/media_publish`, { creation_id: creationId }, accessToken);
		return { creation_id: creationId, publish: pub };
	}

	if (igType === 'reel') {
		const videoUrl = String(content.videoUrl ?? '').trim();
		if (!videoUrl) throw new Error('Missing content.videoUrl for IG reel');
		const c = await metaGraphPost(
			`${igUserId}/media`,
			{ media_type: 'REELS', video_url: videoUrl, ...(caption ? { caption } : {}) },
			accessToken
		);
		const creationId = String(c?.id ?? '');
		if (!creationId) throw new Error('IG create reel container did not return id');

		// Poll until video is finished processing
		for (let i = 0; i < 40; i++) {
			const st = await metaGraphGet(`${creationId}`, { fields: 'status_code' }, accessToken);
			const code = String(st?.status_code ?? '');
			if (code === 'FINISHED') break;
			if (code === 'ERROR') throw new Error('IG reel processing failed');
			await sleep(5000);
		}

		const pub = await metaGraphPost(`${igUserId}/media_publish`, { creation_id: creationId }, accessToken);
		return { creation_id: creationId, publish: pub };
	}

	if (igType === 'carousel') {
		const children = Array.isArray(content.children) ? content.children : [];
		if (children.length < 2) throw new Error('IG carousel requires content.children with 2-10 items');
		if (children.length > 10) throw new Error('IG carousel supports up to 10 items');

		/** @type {string[]} */
		const childIds = [];
		for (const child of children) {
			const imageUrl = String(child?.imageUrl ?? '').trim();
			const videoUrl = String(child?.videoUrl ?? '').trim();
			if (!imageUrl && !videoUrl) throw new Error('Carousel child must have imageUrl or videoUrl');

			if (imageUrl) {
				const c = await metaGraphPost(
					`${igUserId}/media`,
					{ image_url: imageUrl, is_carousel_item: 'true' },
					accessToken
				);
				const id = String(c?.id ?? '');
				if (!id) throw new Error('IG carousel child container did not return id');
				childIds.push(id);
				continue;
			}

			// Video child (some docs still use media_type=VIDEO for carousel items)
			const c = await metaGraphPost(
				`${igUserId}/media`,
				{ media_type: 'VIDEO', video_url: videoUrl, is_carousel_item: 'true' },
				accessToken
			);
			const id = String(c?.id ?? '');
			if (!id) throw new Error('IG carousel video child container did not return id');
			// Poll processing
			for (let i = 0; i < 40; i++) {
				const st = await metaGraphGet(`${id}`, { fields: 'status_code' }, accessToken);
				const code = String(st?.status_code ?? '');
				if (code === 'FINISHED') break;
				if (code === 'ERROR') throw new Error('IG carousel video child processing failed');
				await sleep(5000);
			}
			childIds.push(id);
		}

		const parent = await metaGraphPost(
			`${igUserId}/media`,
			{
				media_type: 'CAROUSEL',
				children: childIds.join(','),
				...(caption ? { caption } : {}),
			},
			accessToken
		);
		const creationId = String(parent?.id ?? '');
		if (!creationId) throw new Error('IG carousel parent container did not return id');

		const pub = await metaGraphPost(`${igUserId}/media_publish`, { creation_id: creationId }, accessToken);
		return { creation_id: creationId, child_creation_ids: childIds, publish: pub };
	}

	throw new Error(`Unknown IG content.igType: ${String(content.igType ?? '')}`);
}

new Worker(
	QUEUE_NAME,
	async (job) => {
		const postId = job.data?.postId;
		if (!postId) throw new Error('Missing postId');

		// Load post
		const { data: post, error: postErr } = await supabase
			.from('scheduled_posts')
			.select('*')
			.eq('id', postId)
			.maybeSingle();
		if (postErr) throw new Error(postErr.message);
		if (!post) return;

		// If cancelled/published already, no-op
		if (post.status === 'cancelled' || post.status === 'published') return;

		// Claim (best-effort): only one worker should proceed
		const { data: claimed, error: claimErr } = await supabase
			.from('scheduled_posts')
			.update({ status: 'publishing' })
			.eq('id', postId)
			.eq('status', 'scheduled')
			.select('*')
			.maybeSingle();
		if (claimErr) throw new Error(claimErr.message);
		if (!claimed) return; // someone else claimed or not in scheduled state

		try {
			const provider = claimed.connection_provider;
			const acct = claimed.connection_provider_account_id;
			const content = claimed.content ?? {};

			if (provider === 'meta' && typeof acct === 'string' && acct.startsWith('fbpage:')) {
				const pageId = acct.slice('fbpage:'.length);

				const { data: conn, error: connErr } = await supabase
					.from('social_connections')
					.select('*')
					.eq('user_id', claimed.user_id)
					.eq('provider', 'meta')
					.eq('provider_account_id', acct)
					.maybeSingle();
				if (connErr) throw new Error(connErr.message);
				if (!conn) throw new Error('Missing social connection for Facebook Page');

				const publishRes = await publishFacebookPage({
					pageId,
					pageAccessToken: conn.access_token,
					content,
				});

				await supabase
					.from('scheduled_posts')
					.update({
						status: 'published',
						published_at: new Date().toISOString(),
						last_error: null,
						content: { ...content, provider_result: publishRes },
					})
					.eq('id', postId);
				return;
			}

			// Instagram Business/Creator (Meta)
			if (provider === 'meta' && typeof acct === 'string' && !acct.startsWith('fbpage:') && String(content.igType ?? '')) {
				const igUserId = acct;
				const { data: conn, error: connErr } = await supabase
					.from('social_connections')
					.select('*')
					.eq('user_id', claimed.user_id)
					.eq('provider', 'meta')
					.eq('provider_account_id', igUserId)
					.maybeSingle();
				if (connErr) throw new Error(connErr.message);
				if (!conn) throw new Error('Missing social connection for Instagram Business');

				const publishRes = await publishInstagram({
					igUserId,
					accessToken: conn.access_token,
					content,
				});

				await supabase
					.from('scheduled_posts')
					.update({
						status: 'published',
						published_at: new Date().toISOString(),
						last_error: null,
						content: { ...content, provider_result: publishRes },
					})
					.eq('id', postId);
				return;
			}

			// TODO: add LinkedIn, GBP publishing implementations here.
			throw new Error(`Publishing not implemented for ${provider}:${acct}`);
		} catch (e) {
			const err = /** @type {any} */ (e);
			const msg = err?.message ?? String(err);
			await supabase
				.from('scheduled_posts')
				.update({
					status: 'failed',
					last_error: msg,
					attempt_count: (claimed.attempt_count ?? 0) + 1,
				})
				.eq('id', postId);
			throw e; // let BullMQ apply retry policy
		}
	},
	{
		connection: redis,
	}
);

console.log(`[worker] listening on queue "${QUEUE_NAME}"`);

