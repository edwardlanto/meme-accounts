// @ts-check
import { Worker } from 'bullmq';
import Redis from 'ioredis';
import { createClient } from '@supabase/supabase-js';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

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
	const publishedStr = published === false ? 'false' : 'true';
	// FB uses `message` for published photos (renders as post text) and `caption` for unpublished photos.
	const captionKey = publishedStr === 'true' ? 'message' : 'caption';

	// If we have a data URL, send multipart.
	if (dataUrl && String(dataUrl).startsWith('data:')) {
		const blob = dataUrlToBlob(dataUrl);
		if (!blob) throw new Error('Invalid data URL for photo');
		const form = new FormData();
		form.set('access_token', pageAccessToken);
		form.set('published', publishedStr);
		if (caption) form.set(captionKey, caption);
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
			published: publishedStr,
			url: String(url),
			...(caption ? { [captionKey]: String(caption) } : {}),
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
 * @param {string} relPath path under static/ (e.g. "post-tests/video/vid1.mp4")
 */
async function readStaticVideo(relPath) {
	const root = process.cwd();
	const base = path.join(root, 'static');
	const abs = path.resolve(base, relPath);
	if (!abs.startsWith(base + path.sep)) throw new Error('Invalid serverPath');
	if (!/\.(mp4|mov|m4v|webm)$/i.test(abs)) throw new Error('Unsupported video extension');
	const buf = await readFile(abs);
	const ext = path.extname(abs).toLowerCase();
	const mime = ext === '.mov' ? 'video/quicktime' : ext === '.webm' ? 'video/webm' : 'video/mp4';
	return { mime, buf, filename: path.basename(abs) };
}

/**
 * Upload a video to a Facebook Page.
 * Supports either:
 * - public URL (args.url)
 * - data URL (args.dataUrl) (must be video/* base64)
 * - server file path (args.serverPath) relative to static/
 *
 * Note: Facebook generally supports one video per feed post via API.
 *
 * @param {{ pageId: string; pageAccessToken: string; url?: string; dataUrl?: string; serverPath?: string; description?: string; published?: boolean }} args
 */
async function uploadFacebookPageVideo({ pageId, pageAccessToken, url, dataUrl, serverPath, description, published }) {
	const endpoint = new URL(`https://graph.facebook.com/${META_GRAPH_VERSION}/${pageId}/videos`);

	if (serverPath) {
		const { mime, buf, filename } = await readStaticVideo(serverPath);
		const form = new FormData();
		form.set('access_token', pageAccessToken);
		form.set('published', published === false ? 'false' : 'true');
		if (description) form.set('description', description);
		// @ts-ignore node fetch supports Blob
		form.set('source', new Blob([buf], { type: mime }), filename);
		const res = await fetch(endpoint.toString(), { method: 'POST', body: form });
		const out = await res.json();
		if (!res.ok) throw new Error(out?.error?.message ?? 'Facebook video upload failed');
		return out;
	}

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
	const imageCaptions = Array.isArray(content?.imageCaptions)
		? content.imageCaptions.map((/** @type {unknown} */ x) => String(x ?? ''))
		: [];
	const imagesMode = content?.imagesMode === 'individual' ? 'individual' : 'carousel';
	const video = String(content?.video ?? '').trim();
	const videos = Array.isArray(content?.videos) ? content.videos : [];

	// Merge per-slide captions into the parent feed message so they're visible
	// under the carousel post in the Facebook feed (FB's feed UI ignores per-photo
	// captions for multi-photo posts; they only appear when clicking the image).
	function buildCarouselMessage() {
		const caps = imageCaptions.map((/** @type {string} */ c) => String(c ?? '').trim()).filter(Boolean);
		if (images.length > 1 && caps.length > 0) {
			const slideLines = caps.map((/** @type {string} */ c, /** @type {number} */ i) => `${i + 1}. ${c}`).join('\n');
			return message ? `${message}\n\n${slideLines}` : slideLines;
		}
		if (images.length === 1 && !message && caps[0]) return caps[0];
		return message;
	}
	const feedMessage = buildCarouselMessage();

	// Multiple videos → one post each (FB has no video-carousel API)
	if (videos.length > 0) {
		const results = [];
		for (let i = 0; i < videos.length; i++) {
			const v = videos[i] ?? {};
			const desc = String(v.description ?? '').trim() || (i === 0 ? message : '');
			const out = await uploadFacebookPageVideo({
				pageId,
				pageAccessToken,
				url: v.url && String(v.url).startsWith('http') ? String(v.url) : undefined,
				dataUrl: v.dataUrl && String(v.dataUrl).startsWith('data:') ? String(v.dataUrl) : undefined,
				serverPath: v.serverPath ? String(v.serverPath) : undefined,
				description: desc || undefined,
				published: true,
			});
			results.push(out);
		}
		return { kind: 'videos', count: results.length, results };
	}

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

	// Individual photos mode: each photo → its own published feed post with its own caption.
	// This is the only way per-slide captions appear in the FB feed.
	if (images.length > 1 && imagesMode === 'individual') {
		const results = [];
		for (let i = 0; i < images.length; i++) {
			const img = images[i];
			const cap = (imageCaptions[i] ?? '').trim() || message;
			const up = await uploadFacebookPagePhoto({
				pageId,
				pageAccessToken,
				url: img.startsWith('http') ? img : undefined,
				dataUrl: img.startsWith('data:') ? img : undefined,
				caption: cap || undefined,
				published: true,
			});
			results.push({ index: i, id: String(up?.post_id ?? up?.id ?? ''), caption: cap });
		}
		return { kind: 'photos-individual', count: results.length, results };
	}

	// Photo / carousel post (one feed post)
	if (images.length > 0) {
		// Upload all images as unpublished, then attach to a feed post.
		// IMPORTANT: do NOT send per-photo captions here — FB will sometimes
		// use the first photo's caption as the post message, hiding our main
		// feed message. Captions are instead merged into the feed message.
		console.log(`[worker] carousel publishing ${images.length} image(s); feedMessage length=${feedMessage.length}`);
		const mediaFbids = [];
		for (let i = 0; i < images.length; i++) {
			const img = images[i];
			const up = await uploadFacebookPagePhoto({
				pageId,
				pageAccessToken,
				url: img.startsWith('http') ? img : undefined,
				dataUrl: img.startsWith('data:') ? img : undefined,
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
		if (feedMessage) body.set('message', feedMessage);
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

const worker = new Worker(
	QUEUE_NAME,
	async (job) => {
		const postId = job.data?.postId;
		console.log(`[worker] picked up job ${job.id} postId=${postId}`);
		if (!postId) throw new Error('Missing postId');

		// Load post
		const { data: post, error: postErr } = await supabase
			.from('scheduled_posts')
			.select('*')
			.eq('id', postId)
			.maybeSingle();
		if (postErr) throw new Error(postErr.message);
		if (!post) {
			console.log(`[worker] postId=${postId} not found in DB; skipping`);
			return;
		}
		console.log(`[worker] postId=${postId} provider=${post.connection_provider} acct=${post.connection_provider_account_id} status=${post.status}`);
		const c = post.content ?? {};
		console.log(`[worker]   content keys=${Object.keys(c).join(',')} message="${String(c.message ?? '').slice(0, 80)}" images=${Array.isArray(c.images) ? c.images.length : 0} imageCaptions=${Array.isArray(c.imageCaptions) ? c.imageCaptions.length : 0} imagesMode=${c.imagesMode ?? '(default)'}`);

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

			// Detect Meta OAuth / token-expired errors and flag the connection for reauth.
			const lower = String(msg).toLowerCase();
			const isAuthErr =
				/oauth/.test(lower) && /(expired|invalid|revoked|session)/.test(lower);
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
				} catch (markErr) {
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
			throw e; // let BullMQ apply retry policy
		}
	},
	{
		connection: redis,
	}
);

worker.on('completed', (job) => {
	console.log(`[worker] ✓ completed job ${job.id}`);
});
worker.on('failed', (job, err) => {
	console.error(`[worker] ✗ failed job ${job?.id}:`, err?.message ?? err);
});
worker.on('error', (err) => {
	console.error('[worker] error:', err?.message ?? err);
});

console.log(`[worker] listening on queue "${QUEUE_NAME}"`);

