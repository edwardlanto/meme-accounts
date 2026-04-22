import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { adminClient, requireUserId } from '$lib/server/auth';

const META_GRAPH_VERSION = 'v20.0';

type VideoItem = {
	// One of these three must be provided:
	url?: string; // public http(s) URL
	dataUrl?: string; // data:video/...;base64,...
	serverPath?: string; // relative path under `static/`, e.g. "post-tests/video/vid1.mp4"
	description?: string; // per-video caption
};

type Body = {
	pageProviderAccountId: string; // e.g. "fbpage:123..."
	content: {
		title?: string; // optional human-readable label for the calendar UI
		message?: string;
		link?: string;
		images?: string[]; // http(s) URLs or data: URLs
		imageCaptions?: string[]; // optional, same length as images
		// How to publish multiple images:
		//   'carousel' (default) = one feed post with attached_media; captions are merged into the post message
		//   'individual'         = N separate feed posts, each photo with its own message (this is what surfaces per-slide captions in the feed)
		imagesMode?: 'carousel' | 'individual';
		video?: string; // single video (http(s) URL or data: URL)
		videos?: VideoItem[]; // multiple videos -> one FB video post each
	};
};

function extToMime(p: string) {
	const ext = path.extname(p).toLowerCase();
	if (ext === '.mp4' || ext === '.m4v') return 'video/mp4';
	if (ext === '.mov') return 'video/quicktime';
	if (ext === '.webm') return 'video/webm';
	return 'application/octet-stream';
}

async function readStaticVideo(relPath: string): Promise<{ mime: string; buf: Buffer; filename: string }> {
	// Only allow paths inside static/ and prevent traversal.
	const root = process.cwd();
	const base = path.join(root, 'static');
	const abs = path.resolve(base, relPath);
	if (!abs.startsWith(base + path.sep)) throw new Error('Invalid serverPath');
	if (!/\.(mp4|mov|m4v|webm)$/i.test(abs)) throw new Error('Unsupported video extension');
	const buf = await readFile(abs);
	return { mime: extToMime(abs), buf, filename: path.basename(abs) };
}

async function uploadVideo(pageId: string, token: string, item: VideoItem) {
	const endpoint = `https://graph.facebook.com/${META_GRAPH_VERSION}/${pageId}/videos`;

	// Data URL path
	if (item.dataUrl && item.dataUrl.startsWith('data:')) {
		const m = item.dataUrl.match(/^data:([^;]+);base64,(.+)$/);
		if (!m) throw new Error('Invalid video data URL');
		const mime = m[1];
		if (!mime.startsWith('video/')) throw new Error('Video data URL must be video/*');
		const buf = Buffer.from(m[2], 'base64');
		const form = new FormData();
		form.set('access_token', token);
		form.set('published', 'true');
		if (item.description) form.set('description', item.description);
		form.set('source', new Blob([buf], { type: mime }), 'video');
		const res = await fetch(endpoint, { method: 'POST', body: form });
		const out = await res.json();
		if (!res.ok) throw new Error(out?.error?.message ?? 'Facebook video upload failed');
		return out;
	}

	// Server file path (read from disk, upload as multipart)
	if (item.serverPath) {
		const { mime, buf, filename } = await readStaticVideo(item.serverPath);
		const form = new FormData();
		form.set('access_token', token);
		form.set('published', 'true');
		if (item.description) form.set('description', item.description);
		form.set('source', new Blob([buf], { type: mime }), filename);
		const res = await fetch(endpoint, { method: 'POST', body: form });
		const out = await res.json();
		if (!res.ok) throw new Error(out?.error?.message ?? 'Facebook video upload failed');
		return out;
	}

	// Public URL path
	if (item.url && /^https?:\/\//i.test(item.url)) {
		const form = new URLSearchParams({ access_token: token, published: 'true', file_url: item.url });
		if (item.description) form.set('description', item.description);
		const res = await fetch(endpoint, {
			method: 'POST',
			headers: { 'content-type': 'application/x-www-form-urlencoded' },
			body: form,
		});
		const out = await res.json();
		if (!res.ok) throw new Error(out?.error?.message ?? 'Facebook video upload failed');
		return out;
	}

	throw new Error('Video item must have url, dataUrl, or serverPath');
}

function dataUrlToBlob(dataUrl: string): { mime: string; buf: Buffer } | null {
	const m = String(dataUrl).match(/^data:([^;]+);base64,(.+)$/);
	if (!m) return null;
	return { mime: m[1], buf: Buffer.from(m[2], 'base64') };
}

async function uploadPhoto(pageId: string, token: string, img: string, caption?: string, published = false) {
	const endpoint = `https://graph.facebook.com/${META_GRAPH_VERSION}/${pageId}/photos`;
	const cap = (caption ?? '').trim();
	const publishedStr = published ? 'true' : 'false';
	if (img.startsWith('data:')) {
		const blob = dataUrlToBlob(img);
		if (!blob) throw new Error('Invalid data URL for photo');
		const form = new FormData();
		form.set('access_token', token);
		form.set('published', publishedStr);
		if (cap) form.set(published ? 'message' : 'caption', cap);
		form.set('source', new Blob([blob.buf], { type: blob.mime }), 'image');
		const res = await fetch(endpoint, { method: 'POST', body: form });
		const out = await res.json();
		if (!res.ok) throw new Error(out?.error?.message ?? 'Facebook photo upload failed');
		return String(out.post_id ?? out.id);
	}
	const params: Record<string, string> = { access_token: token, published: publishedStr, url: img };
	if (cap) params[published ? 'message' : 'caption'] = cap;
	const res = await fetch(endpoint, {
		method: 'POST',
		headers: { 'content-type': 'application/x-www-form-urlencoded' },
		body: new URLSearchParams(params),
	});
	const out = await res.json();
	if (!res.ok) throw new Error(out?.error?.message ?? 'Facebook photo upload failed');
	return String(out.post_id ?? out.id);
}

export const POST: RequestHandler = async ({ request }) => {
	let userId: string;
	try {
		userId = await requireUserId(request);
	} catch (e: any) {
		return json({ ok: false, error: e?.message ?? 'Unauthorized' }, { status: e?.status ?? 401 });
	}

	let body: Body;
	try {
		body = (await request.json()) as Body;
	} catch {
		return json({ ok: false, error: 'Invalid JSON body' }, { status: 400 });
	}

	const acct = body.pageProviderAccountId ?? '';
	const content = body.content ?? {};

	if (!acct.startsWith('fbpage:')) return json({ ok: false, error: 'pageProviderAccountId must start with "fbpage:"' }, { status: 400 });

	const pageId = acct.slice('fbpage:'.length);
	const supabase = adminClient();

	const { data: conn, error: connErr } = await supabase
		.from('social_connections')
		.select('*')
		.eq('user_id', userId)
		.eq('provider', 'meta')
		.eq('provider_account_id', acct)
		.maybeSingle();
	if (connErr) return json({ ok: false, error: connErr.message }, { status: 500 });
	if (!conn) return json({ ok: false, error: 'No Facebook Page connection found for this user' }, { status: 404 });

	const token = String((conn as any).access_token ?? '');
	if (!token) return json({ ok: false, error: 'Connection has no access_token' }, { status: 500 });

	const message = String(content?.message ?? '').trim();
	const link = String(content?.link ?? '').trim();
	const images = Array.isArray(content?.images) ? content.images.map(String).filter(Boolean) : [];
	const imageCaptions = Array.isArray(content?.imageCaptions) ? content.imageCaptions.map((c: any) => String(c ?? '')) : [];
	const imagesMode = content?.imagesMode === 'individual' ? 'individual' : 'carousel';

	// Facebook only renders the parent `message` under a multi-photo carousel in the feed.
	// So when mode = 'carousel' and the caller provided per-slide captions, merge them
	// into the feed `message` so they're visible under the post.
	function buildCarouselMessage() {
		const caps = imageCaptions.map((c) => c.trim()).filter(Boolean);
		if (images.length > 1 && caps.length > 0) {
			const slideLines = caps.map((c, i) => `${i + 1}. ${c}`).join('\n');
			return message ? `${message}\n\n${slideLines}` : slideLines;
		}
		if (images.length === 1 && !message && caps[0]) return caps[0];
		return message;
	}
	const feedMessage = buildCarouselMessage();
	const video = String(content?.video ?? '').trim();
	const videos: VideoItem[] = Array.isArray(content?.videos) ? content.videos : [];

	try {
		// Individual photo mode: N separate feed posts, each with its own caption.
		// This is the only way per-slide captions show up in the Facebook feed.
		if (images.length > 0 && imagesMode === 'individual' && images.length > 1) {
			const results: any[] = [];
			for (let i = 0; i < images.length; i++) {
				const cap = (imageCaptions[i] ?? '').trim() || message;
				const id = await uploadPhoto(pageId, token, images[i], cap, /* publish */ true);
				results.push({ index: i, id, caption: cap });
			}
			return json({ ok: true, kind: 'photos-individual', count: results.length, results });
		}

		// Carousel / single photo (one feed post)
		if (images.length > 0) {
			const mediaIds: string[] = [];
			for (let i = 0; i < images.length; i++) {
				// IMPORTANT: do NOT send a per-photo caption on carousel uploads —
				// Facebook sometimes overrides the parent feed `message` with the
				// first photo's caption, making the main caption invisible.
				mediaIds.push(await uploadPhoto(pageId, token, images[i]));
			}
			const feedUrl = `https://graph.facebook.com/${META_GRAPH_VERSION}/${pageId}/feed`;
			const form = new URLSearchParams({ access_token: token });
			if (feedMessage) form.set('message', feedMessage);
			mediaIds.forEach((id, i) => form.set(`attached_media[${i}]`, JSON.stringify({ media_fbid: id })));
			const res = await fetch(feedUrl, {
				method: 'POST',
				headers: { 'content-type': 'application/x-www-form-urlencoded' },
				body: form,
			});
			const data = await res.json();
			if (!res.ok) throw new Error(data?.error?.message ?? 'Facebook feed post failed');
			return json({ ok: true, kind: images.length === 1 ? 'photo' : 'carousel', mediaIds, result: data });
		}

		// Link post
		if (link) {
			const feedUrl = `https://graph.facebook.com/${META_GRAPH_VERSION}/${pageId}/feed`;
			const form = new URLSearchParams({ access_token: token, link });
			if (message) form.set('message', message);
			const res = await fetch(feedUrl, {
				method: 'POST',
				headers: { 'content-type': 'application/x-www-form-urlencoded' },
				body: form,
			});
			const data = await res.json();
			if (!res.ok) throw new Error(data?.error?.message ?? 'Facebook link post failed');
			return json({ ok: true, kind: 'link', result: data });
		}

		// Multiple videos → Facebook does NOT support video carousels via the API,
		// so we publish one video post per item.
		if (videos.length > 0) {
			const results: any[] = [];
			for (let i = 0; i < videos.length; i++) {
				const v = videos[i];
				const desc = (v.description ?? '').trim() || (i === 0 ? message : '');
				const out = await uploadVideo(pageId, token, { ...v, description: desc || undefined });
				results.push(out);
			}
			return json({
				ok: true,
				kind: 'videos',
				count: results.length,
				note: 'Facebook does not support multi-video carousels; each video was posted as its own post.',
				results,
			});
		}

		// Single video (legacy shape: content.video as a URL string)
		if (video) {
			const out = await uploadVideo(pageId, token, {
				url: video.startsWith('http') ? video : undefined,
				dataUrl: video.startsWith('data:') ? video : undefined,
				description: message || undefined,
			});
			return json({ ok: true, kind: 'video', result: out });
		}

		// Text-only
		if (!message) return json({ ok: false, error: 'Nothing to post: provide message, images, link, or video.' }, { status: 400 });
		const feedUrl = `https://graph.facebook.com/${META_GRAPH_VERSION}/${pageId}/feed`;
		const res = await fetch(feedUrl, {
			method: 'POST',
			headers: { 'content-type': 'application/x-www-form-urlencoded' },
			body: new URLSearchParams({ access_token: token, message }),
		});
		const data = await res.json();
		if (!res.ok) throw new Error(data?.error?.message ?? 'Facebook text post failed');
		return json({ ok: true, kind: 'text', result: data });
	} catch (e: any) {
		return json({ ok: false, error: e?.message ?? 'Unknown publishing error' }, { status: 500 });
	}
};
