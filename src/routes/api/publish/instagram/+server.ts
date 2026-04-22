import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { adminClient, requireUserId } from '$lib/server/auth';

/**
 * Publish to an Instagram Business/Creator account (linked to a Facebook Page).
 *
 * Body shape:
 * {
 *   igUserId: string,       // IG Graph user id (stored as provider_account_id on the `meta` connection)
 *   content: {
 *     kind?: 'image' | 'carousel' | 'reel' | 'story_image' | 'story_video',
 *     title?: string,       // UI label only
 *     caption?: string,
 *
 *     // image / single photo
 *     imageUrl?: string,    // public https URL
 *
 *     // carousel (2-10 items, images and/or reels)
 *     items?: Array<{ imageUrl?: string; videoUrl?: string }>,
 *
 *     // reel (video)
 *     videoUrl?: string,
 *     shareToFeed?: boolean, // default true
 *
 *     // stories: use imageUrl or videoUrl depending on kind
 *   }
 * }
 *
 * IG Graph API requires public https URLs — it cannot fetch localhost or data URLs.
 */

const META_GRAPH_VERSION = 'v20.0';
const GRAPH = `https://graph.facebook.com/${META_GRAPH_VERSION}`;

type CarouselItem = { imageUrl?: string; videoUrl?: string };

type Body = {
	igUserId: string;
	content: {
		kind?: 'image' | 'carousel' | 'reel' | 'story_image' | 'story_video';
		title?: string;
		caption?: string;
		imageUrl?: string;
		items?: CarouselItem[];
		videoUrl?: string;
		shareToFeed?: boolean;
	};
};

async function graphPost<T = any>(path: string, params: Record<string, string>): Promise<T> {
	const url = `${GRAPH}/${path}`;
	const body = new URLSearchParams(params);
	const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body });
	const data = (await res.json()) as any;
	if (!res.ok) throw new Error(data?.error?.message ?? `IG API ${path} failed (${res.status})`);
	return data as T;
}

async function graphGet<T = any>(path: string, token: string): Promise<T> {
	const res = await fetch(`${GRAPH}/${path}${path.includes('?') ? '&' : '?'}access_token=${encodeURIComponent(token)}`);
	const data = (await res.json()) as any;
	if (!res.ok) throw new Error(data?.error?.message ?? `IG API ${path} failed (${res.status})`);
	return data as T;
}

// Poll an IG media container until it's ready (or errored). Reels/videos need this
// because IG asynchronously transcodes the video after the container is created.
async function waitForContainerReady(containerId: string, token: string, { timeoutMs = 5 * 60 * 1000, intervalMs = 3000 } = {}) {
	const started = Date.now();
	while (Date.now() - started < timeoutMs) {
		const out = await graphGet<{ status_code?: string; status?: string }>(`${containerId}?fields=status_code,status`, token);
		const status = out.status_code ?? out.status ?? '';
		if (status === 'FINISHED') return;
		if (status === 'ERROR' || status === 'EXPIRED') throw new Error(`IG container ${containerId} failed: ${status}`);
		await new Promise((r) => setTimeout(r, intervalMs));
	}
	throw new Error(`IG container ${containerId} did not become ready within timeout`);
}

async function createImageContainer(igUserId: string, token: string, imageUrl: string, caption?: string, isCarouselItem = false) {
	const params: Record<string, string> = {
		access_token: token,
		image_url: imageUrl,
	};
	if (caption) params.caption = caption;
	if (isCarouselItem) params.is_carousel_item = 'true';
	const out = await graphPost<{ id: string }>(`${igUserId}/media`, params);
	return out.id;
}

async function createReelContainer(igUserId: string, token: string, videoUrl: string, caption?: string, shareToFeed = true, isCarouselItem = false) {
	const params: Record<string, string> = {
		access_token: token,
		media_type: 'REELS',
		video_url: videoUrl,
		share_to_feed: String(shareToFeed),
	};
	if (caption) params.caption = caption;
	if (isCarouselItem) params.is_carousel_item = 'true';
	const out = await graphPost<{ id: string }>(`${igUserId}/media`, params);
	return out.id;
}

async function createCarouselContainer(igUserId: string, token: string, childIds: string[], caption?: string) {
	const params: Record<string, string> = {
		access_token: token,
		media_type: 'CAROUSEL',
		children: childIds.join(','),
	};
	if (caption) params.caption = caption;
	const out = await graphPost<{ id: string }>(`${igUserId}/media`, params);
	return out.id;
}

async function createStoryImageContainer(igUserId: string, token: string, imageUrl: string) {
	const out = await graphPost<{ id: string }>(`${igUserId}/media`, {
		access_token: token,
		media_type: 'STORIES',
		image_url: imageUrl,
	});
	return out.id;
}

async function createStoryVideoContainer(igUserId: string, token: string, videoUrl: string) {
	const out = await graphPost<{ id: string }>(`${igUserId}/media`, {
		access_token: token,
		media_type: 'STORIES',
		video_url: videoUrl,
	});
	return out.id;
}

async function publishContainer(igUserId: string, token: string, creationId: string) {
	const out = await graphPost<{ id: string }>(`${igUserId}/media_publish`, {
		access_token: token,
		creation_id: creationId,
	});
	return out.id;
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

	const igUserId = String(body.igUserId ?? '').trim();
	const content = body.content ?? {};
	if (!igUserId) return json({ ok: false, error: 'igUserId is required' }, { status: 400 });

	const supabase = adminClient();
	const { data: conn, error: connErr } = await supabase
		.from('social_connections')
		.select('*')
		.eq('user_id', userId)
		.eq('provider', 'meta')
		.eq('provider_account_id', igUserId)
		.maybeSingle();
	if (connErr) return json({ ok: false, error: connErr.message }, { status: 500 });
	if (!conn) return json({ ok: false, error: 'No Instagram connection found for this user + igUserId' }, { status: 404 });

	const token = String((conn as any).access_token ?? '');
	if (!token) return json({ ok: false, error: 'Connection has no access_token' }, { status: 500 });

	const kind = content.kind ?? (Array.isArray(content.items) && content.items.length > 1 ? 'carousel' : content.videoUrl ? 'reel' : 'image');
	const caption = content.caption?.trim() || undefined;

	try {
		// --- Single image ---
		if (kind === 'image') {
			if (!content.imageUrl) return json({ ok: false, error: 'imageUrl is required for kind=image' }, { status: 400 });
			const containerId = await createImageContainer(igUserId, token, content.imageUrl, caption);
			const mediaId = await publishContainer(igUserId, token, containerId);
			return json({ ok: true, kind: 'image', containerId, mediaId });
		}

		// --- Reel ---
		if (kind === 'reel') {
			if (!content.videoUrl) return json({ ok: false, error: 'videoUrl is required for kind=reel' }, { status: 400 });
			const containerId = await createReelContainer(igUserId, token, content.videoUrl, caption, content.shareToFeed ?? true);
			await waitForContainerReady(containerId, token);
			const mediaId = await publishContainer(igUserId, token, containerId);
			return json({ ok: true, kind: 'reel', containerId, mediaId });
		}

		// --- Carousel ---
		if (kind === 'carousel') {
			const items = Array.isArray(content.items) ? content.items : [];
			if (items.length < 2 || items.length > 10) {
				return json({ ok: false, error: 'Carousel requires 2–10 items' }, { status: 400 });
			}
			// Create child containers (images publish instantly, reels need polling).
			const childIds: string[] = [];
			for (const it of items) {
				if (it.videoUrl) {
					const cid = await createReelContainer(igUserId, token, it.videoUrl, undefined, false, /* isCarouselItem */ true);
					await waitForContainerReady(cid, token);
					childIds.push(cid);
				} else if (it.imageUrl) {
					const cid = await createImageContainer(igUserId, token, it.imageUrl, undefined, /* isCarouselItem */ true);
					childIds.push(cid);
				} else {
					return json({ ok: false, error: 'Carousel item must have imageUrl or videoUrl' }, { status: 400 });
				}
			}
			const containerId = await createCarouselContainer(igUserId, token, childIds, caption);
			// The carousel container itself may also need a moment to settle; poll briefly.
			await waitForContainerReady(containerId, token, { timeoutMs: 60_000, intervalMs: 2000 }).catch(() => {
				/* some carousel containers return FINISHED immediately; ignore timeout for image-only */
			});
			const mediaId = await publishContainer(igUserId, token, containerId);
			return json({ ok: true, kind: 'carousel', containerId, mediaId, childCount: childIds.length });
		}

		// --- Photo Story ---
		if (kind === 'story_image') {
			if (!content.imageUrl) return json({ ok: false, error: 'imageUrl is required for kind=story_image' }, { status: 400 });
			const containerId = await createStoryImageContainer(igUserId, token, content.imageUrl);
			const mediaId = await publishContainer(igUserId, token, containerId);
			return json({ ok: true, kind: 'story_image', containerId, mediaId });
		}

		// --- Video Story ---
		if (kind === 'story_video') {
			if (!content.videoUrl) return json({ ok: false, error: 'videoUrl is required for kind=story_video' }, { status: 400 });
			const containerId = await createStoryVideoContainer(igUserId, token, content.videoUrl);
			await waitForContainerReady(containerId, token);
			const mediaId = await publishContainer(igUserId, token, containerId);
			return json({ ok: true, kind: 'story_video', containerId, mediaId });
		}

		return json({ ok: false, error: `Unsupported kind: ${kind}` }, { status: 400 });
	} catch (e: any) {
		console.error('[publish/instagram] error', e);
		return json({ ok: false, error: e?.message ?? 'Unknown error' }, { status: 500 });
	}
};
