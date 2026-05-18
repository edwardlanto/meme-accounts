/**
 * Zernio REST client + payload builders for Facebook, Instagram, and TikTok.
 * @see https://docs.zernio.com/
 */

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { ZernioConnectPlatform } from '$lib/integrations/zernio-platforms';

export type { ZernioConnectPlatform };

const DEFAULT_BASE = 'https://zernio.com/api/v1';

export type ZernioPlatform = 'facebook' | 'instagram' | 'tiktok';

export function zernioBaseUrl(): string {
	const b = (typeof process !== 'undefined' && process.env.ZERNIO_API_BASE) || '';
	return (b || DEFAULT_BASE).replace(/\/$/, '');
}

export async function zernioJson<T = unknown>(
	apiKey: string,
	path: string,
	init?: { method?: string; json?: unknown }
): Promise<T> {
	const url = `${zernioBaseUrl()}${path.startsWith('/') ? path : `/${path}`}`;
	const headers: Record<string, string> = { Authorization: `Bearer ${apiKey}` };
	let body: string | undefined;
	if (init?.json !== undefined) {
		headers['Content-Type'] = 'application/json';
		body = JSON.stringify(init.json);
	}
	const res = await fetch(url, { method: init?.method ?? 'GET', headers, body });
	const data = (await res.json().catch(() => ({}))) as any;
	if (!res.ok) {
		const msg =
			typeof data?.error === 'string'
				? data.error
				: data?.error?.message ?? data?.message ?? JSON.stringify(data).slice(0, 400);
		throw new Error(`Zernio ${init?.method ?? 'GET'} ${path}: ${msg}`);
	}
	return data as T;
}

export async function zernioCreateProfile(apiKey: string, userId: string): Promise<string> {
	const data = await zernioJson<any>(apiKey, '/profiles', {
		method: 'POST',
		json: {
			name: `Studio user ${userId.slice(0, 8)}`,
			description: 'Carousel Studio — Zernio profile',
		},
	});
	const id = data?.profile?._id ?? data?.profile?.id ?? data?._id;
	if (!id || typeof id !== 'string') throw new Error('Zernio create profile: missing profile id');
	return id;
}

export async function zernioDeleteAccount(apiKey: string, accountId: string): Promise<void> {
	await zernioJson(apiKey, `/accounts/${encodeURIComponent(accountId)}`, { method: 'DELETE' });
}

export async function zernioGetConnectAuthUrl(
	apiKey: string,
	platform: ZernioConnectPlatform,
	profileId: string,
	redirectUrl: string
): Promise<string> {
	const q = new URLSearchParams({ profileId, redirect_url: redirectUrl });
	const data = await zernioJson<any>(apiKey, `/connect/${platform}?${q.toString()}`, { method: 'GET' });
	const url = data?.authUrl ?? data?.auth_url ?? data?.url;
	if (!url || typeof url !== 'string') throw new Error('Zernio connect: missing auth URL in response');
	return url;
}

export async function zernioListAccounts(apiKey: string, profileId?: string): Promise<any[]> {
	const path = profileId ? `/accounts?profileId=${encodeURIComponent(profileId)}` : '/accounts';
	const data = await zernioJson<any>(apiKey, path, { method: 'GET' });
	const list = data?.accounts ?? data?.data ?? data;
	return Array.isArray(list) ? list : [];
}

export async function zernioMediaPresignAndPut(
	apiKey: string,
	fileName: string,
	fileType: string,
	bytes: Uint8Array
): Promise<string> {
	const presign = await zernioJson<any>(apiKey, '/media/presign', {
		method: 'POST',
		json: { fileName, fileType },
	});
	const uploadUrl = presign?.uploadUrl ?? presign?.upload_url;
	const publicUrl = presign?.publicUrl ?? presign?.public_url;
	if (!uploadUrl || !publicUrl) throw new Error('Zernio media presign: missing URLs');
	const put = await fetch(uploadUrl, {
		method: 'PUT',
		headers: { 'Content-Type': fileType },
		body: bytes as unknown as BodyInit,
	});
	if (!put.ok) throw new Error(`Zernio media upload failed (${put.status})`);
	return publicUrl as string;
}

function extFromMime(mime: string) {
	if (mime === 'image/jpeg' || mime === 'image/jpg') return 'jpg';
	if (mime === 'image/png') return 'png';
	if (mime === 'image/webp') return 'webp';
	if (mime === 'image/gif') return 'gif';
	if (mime === 'video/mp4') return 'mp4';
	if (mime === 'video/quicktime') return 'mov';
	return 'bin';
}

async function readStaticVideoBytes(relPath: string): Promise<{ mime: string; buf: Buffer }> {
	const root = process.cwd();
	const base = path.join(root, 'static');
	const abs = path.resolve(base, relPath);
	if (!abs.startsWith(base + path.sep)) throw new Error('Invalid serverPath');
	if (!/\.(mp4|mov|m4v|webm)$/i.test(abs)) throw new Error('Unsupported video extension');
	const buf = await readFile(abs);
	const ext = path.extname(abs).toLowerCase();
	const mime = ext === '.mov' ? 'video/quicktime' : ext === '.webm' ? 'video/webm' : 'video/mp4';
	return { mime, buf };
}

type VideoLike = { url?: string; dataUrl?: string; serverPath?: string };

/** Resolve a video reference to a Zernio-hosted public URL. */
export async function resolveVideoItemToPublicUrl(apiKey: string, item: VideoLike): Promise<string> {
	const url = item.url && String(item.url).trim();
	const dataUrl = item.dataUrl && String(item.dataUrl).trim();
	const serverPath = item.serverPath && String(item.serverPath).trim();
	if (dataUrl) return ensurePublicMediaUrl(apiKey, dataUrl);
	if (url) return ensurePublicMediaUrl(apiKey, url);
	if (serverPath) {
		const { mime, buf } = await readStaticVideoBytes(serverPath);
		const name = `vid-${Date.now()}${path.extname(serverPath) || '.mp4'}`;
		return zernioMediaPresignAndPut(apiKey, name, mime, buf);
	}
	throw new Error('Video item needs url, dataUrl, or serverPath');
}

/** Turn data URLs or relative paths into a public https URL via Zernio presigned upload. */
export async function ensurePublicMediaUrl(apiKey: string, raw: string): Promise<string> {
	const s = String(raw ?? '').trim();
	if (!s) throw new Error('Empty media URL');
	if (/^https:\/\//i.test(s)) return s;
	if (/^http:\/\/localhost/i.test(s)) {
		throw new Error('Localhost media URLs cannot be fetched by Zernio. Use PUBLIC_APP_URL + HTTPS tunnel or upload to R2 first.');
	}
	if (/^https?:\/\//i.test(s)) return s;

	if (s.startsWith('data:')) {
		const m = s.match(/^data:([^;]+);base64,(.+)$/);
		if (!m) throw new Error('Invalid data URL');
		const mime = m[1];
		const buf = Buffer.from(m[2], 'base64');
		const name = `upload-${Date.now()}.${extFromMime(mime)}`;
		return zernioMediaPresignAndPut(apiKey, name, mime, buf);
	}

	throw new Error('Media must be an https URL or a data: URL for Zernio upload');
}

type VideoItem = { url?: string; dataUrl?: string; serverPath?: string; description?: string };

function defaultTikTokSettings(overrides?: Partial<Record<string, unknown>>) {
	return {
		privacy_level: 'PUBLIC_TO_EVERYONE',
		allow_comment: true,
		allow_duet: true,
		allow_stitch: true,
		content_preview_confirmed: true,
		express_consent_given: true,
		draft: false,
		...overrides,
	};
}

/** One or more POST /v1/posts bodies (Facebook "individual" image mode → multiple). */
export async function buildZernioFacebookBodies(
	apiKey: string,
	accountId: string,
	content: any,
	opts?: { facebookPageId?: string }
): Promise<any[]> {
	const message = String(content?.message ?? '').trim();
	const link = String(content?.link ?? '').trim();
	const images = Array.isArray(content?.images) ? content.images.map(String).filter(Boolean) : [];
	const imageCaptions = Array.isArray(content?.imageCaptions) ? content.imageCaptions.map((c: any) => String(c ?? '')) : [];
	const imagesMode = content?.imagesMode === 'individual' ? 'individual' : 'carousel';
	const video = String(content?.video ?? '').trim();
	const videos = Array.isArray(content?.videos) ? content.videos : [];
	const kind = content?.kind;

	const fbPlatform: any = {
		platform: 'facebook',
		accountId,
		platformSpecificData: {
			...(opts?.facebookPageId ? { pageId: opts.facebookPageId } : {}),
		},
	};

	function buildCarouselMessage() {
		const caps = imageCaptions.map((c: string) => c.trim()).filter(Boolean);
		if (images.length > 1 && caps.length > 0) {
			const slideLines = caps.map((c: string, i: number) => `${i + 1}. ${c}`).join('\n');
			return message ? `${message}\n\n${slideLines}` : slideLines;
		}
		if (images.length === 1 && !message && caps[0]) return caps[0];
		return message;
	}
	const feedMessage = buildCarouselMessage();

	const psdStory = { contentType: 'story', ...(opts?.facebookPageId ? { pageId: opts.facebookPageId } : {}) };
	const psdReel = { contentType: 'reel', ...(opts?.facebookPageId ? { pageId: opts.facebookPageId } : {}) };

	if (kind === 'reel') {
		const rv = content?.reelVideo as VideoItem | undefined;
		if (!rv) throw new Error('reelVideo is required for kind=reel');
		const url = await resolveVideoItemToPublicUrl(apiKey, rv);
		return [
			{
				content: String(content?.reelDescription ?? message ?? '').trim() || ' ',
				mediaItems: [{ type: 'video', url }],
				platforms: [{ ...fbPlatform, platformSpecificData: { ...psdReel, title: String(content?.title ?? '').trim() || undefined } }],
				publishNow: true,
			},
		];
	}
	if (kind === 'photo_story') {
		const img = String(content?.storyPhoto ?? '').trim();
		if (!img) throw new Error('storyPhoto is required for kind=photo_story');
		const url = await ensurePublicMediaUrl(apiKey, img);
		return [
			{
				content: ' ',
				mediaItems: [{ type: 'image', url }],
				platforms: [{ ...fbPlatform, platformSpecificData: psdStory }],
				publishNow: true,
			},
		];
	}
	if (kind === 'video_story') {
		const sv = content?.storyVideo as VideoItem | undefined;
		if (!sv) throw new Error('storyVideo is required for kind=video_story');
		const url = await resolveVideoItemToPublicUrl(apiKey, sv);
		return [
			{
				content: ' ',
				mediaItems: [{ type: 'video', url }],
				platforms: [{ ...fbPlatform, platformSpecificData: psdStory }],
				publishNow: true,
			},
		];
	}

	if (images.length > 1 && imagesMode === 'individual') {
		const bodies: any[] = [];
		for (let i = 0; i < images.length; i++) {
			const url = await ensurePublicMediaUrl(apiKey, images[i]);
			const cap = (imageCaptions[i] ?? '').trim() || message || ' ';
			bodies.push({
				content: cap,
				mediaItems: [{ type: 'image', url }],
				platforms: [{ ...fbPlatform }],
				publishNow: true,
			});
		}
		return bodies;
	}

	if (images.length > 0) {
		const mediaItems = [];
		for (const img of images) {
			const url = await ensurePublicMediaUrl(apiKey, img);
			mediaItems.push({ type: 'image', url });
		}
		const text = feedMessage || link || ' ';
		return [{ content: link && !feedMessage ? `${text}\n${link}` : text, mediaItems, platforms: [{ ...fbPlatform }], publishNow: true }];
	}

	if (link) {
		return [{ content: message ? `${message}\n${link}` : link, platforms: [{ ...fbPlatform }], publishNow: true }];
	}

	if (videos.length > 0) {
		const bodies: any[] = [];
		for (let i = 0; i < videos.length; i++) {
			const v = videos[i] as VideoItem;
			const url = await resolveVideoItemToPublicUrl(apiKey, v ?? {});
			const desc = String(v?.description ?? '').trim() || (i === 0 ? message : '') || ' ';
			bodies.push({
				content: desc,
				mediaItems: [{ type: 'video', url }],
				platforms: [{ ...fbPlatform }],
				publishNow: true,
			});
		}
		return bodies;
	}

	if (video) {
		const url = await ensurePublicMediaUrl(apiKey, video);
		return [{ content: message || ' ', mediaItems: [{ type: 'video', url }], platforms: [{ ...fbPlatform }], publishNow: true }];
	}

	if (!message) throw new Error('Nothing to post: provide message, images, link, or video.');
	return [{ content: message, platforms: [{ ...fbPlatform }], publishNow: true }];
}

export async function buildZernioInstagramBody(apiKey: string, accountId: string, content: any): Promise<any> {
	let kind = String(content?.kind ?? '').toLowerCase();
	if (!kind) {
		if (Array.isArray(content?.items) && content.items.length > 1) kind = 'carousel';
		else if (content?.videoUrl) kind = 'reel';
		else kind = 'image';
	}
	const caption = String(content?.caption ?? '').trim();

	const igPlat = (extra: any) => ({
		platform: 'instagram',
		accountId,
		platformSpecificData: extra,
	});

	if (kind === 'image' || kind === 'post') {
		const imageUrl = String(content?.imageUrl ?? '').trim();
		if (!imageUrl) throw new Error('imageUrl is required for image post');
		const url = await ensurePublicMediaUrl(apiKey, imageUrl);
		return {
			content: caption || ' ',
			mediaItems: [{ type: 'image', url }],
			platforms: [igPlat({})],
			publishNow: true,
		};
	}

	if (kind === 'reel') {
		const videoUrl = String(content?.videoUrl ?? '').trim();
		if (!videoUrl) throw new Error('videoUrl is required for reel');
		const url = await ensurePublicMediaUrl(apiKey, videoUrl);
		return {
			content: caption || ' ',
			mediaItems: [{ type: 'video', url }],
			platforms: [igPlat({ contentType: 'reels', shareToFeed: content?.shareToFeed !== false })],
			publishNow: true,
		};
	}

	if (kind === 'carousel') {
		const items = Array.isArray(content?.items) ? content.items : [];
		if (items.length < 2 || items.length > 10) throw new Error('Carousel requires 2–10 items');
		const mediaItems: { type: string; url: string }[] = [];
		for (const it of items) {
			const iu = String(it?.imageUrl ?? '').trim();
			const vu = String(it?.videoUrl ?? '').trim();
			if (iu) {
				mediaItems.push({ type: 'image', url: await ensurePublicMediaUrl(apiKey, iu) });
			} else if (vu) {
				mediaItems.push({ type: 'video', url: await ensurePublicMediaUrl(apiKey, vu) });
			} else throw new Error('Carousel item needs imageUrl or videoUrl');
		}
		return {
			content: caption || ' ',
			mediaItems,
			platforms: [igPlat({})],
			publishNow: true,
		};
	}

	if (kind === 'story_image' || kind === 'photo_story') {
		const imageUrl = String(content?.imageUrl ?? '').trim();
		if (!imageUrl) throw new Error('imageUrl is required for story');
		const url = await ensurePublicMediaUrl(apiKey, imageUrl);
		return {
			content: ' ',
			mediaItems: [{ type: 'image', url }],
			platforms: [igPlat({ contentType: 'story' })],
			publishNow: true,
		};
	}

	if (kind === 'story_video' || kind === 'video_story') {
		const videoUrl = String(content?.videoUrl ?? '').trim();
		if (!videoUrl) throw new Error('videoUrl is required for video story');
		const url = await ensurePublicMediaUrl(apiKey, videoUrl);
		return {
			content: ' ',
			mediaItems: [{ type: 'video', url }],
			platforms: [igPlat({ contentType: 'story' })],
			publishNow: true,
		};
	}

	throw new Error(`Unsupported Instagram kind: ${kind}`);
}

/** Map legacy worker `igType` + `children` to instagram `kind` shape. */
export function normalizeIgWorkerContent(content: any): any {
	if (content?.kind && String(content.kind).startsWith('ig_')) return content;
	const igType = String(content?.igType ?? '').toLowerCase();
	if (igType === 'post') {
		const imageUrl =
			String(content?.imageUrl ?? '').trim() ||
			(Array.isArray(content?.images) ? String(content.images[0] ?? '').trim() : '');
		return { kind: 'image', caption: content?.caption, imageUrl };
	}
	if (igType === 'carousel') {
		return {
			kind: 'carousel',
			caption: content?.caption,
			items: content?.children ?? content?.items ?? [],
		};
	}
	if (igType === 'reel') {
		return { kind: 'reel', caption: content?.caption, videoUrl: content?.videoUrl, shareToFeed: content?.shareToFeed };
	}
	if (igType === 'carousel') {
		return { kind: 'carousel', caption: content?.caption, items: content?.children ?? content?.items };
	}
	if (igType === 'story_image' || igType === 'photo_story') {
		return { kind: 'story_image', imageUrl: content?.imageUrl };
	}
	if (igType === 'story_video' || igType === 'video_story') {
		return { kind: 'story_video', videoUrl: content?.videoUrl };
	}
	return content;
}

export async function buildZernioTikTokBody(apiKey: string, accountId: string, content: any): Promise<any> {
	const videoUrl = String(content?.videoUrl ?? '').trim();
	if (!videoUrl) throw new Error('videoUrl is required');
	const url = await ensurePublicMediaUrl(apiKey, videoUrl);
	const mode = String(content?.mode ?? 'direct');
	const draft = mode === 'inbox';
	const title = String(content?.title ?? content?.caption ?? '').trim() || ' ';

	const tiktokSettings = defaultTikTokSettings({
		privacy_level: content?.privacy ?? 'PUBLIC_TO_EVERYONE',
		allow_comment: content?.disableComment !== true,
		allow_duet: content?.disableDuet !== true,
		allow_stitch: content?.disableStitch !== true,
		draft,
	});

	return {
		content: title,
		mediaItems: [{ type: 'video', url }],
		platforms: [
			{
				platform: 'tiktok',
				accountId,
				platformSpecificData: { tiktokSettings },
			},
		],
		publishNow: true,
	};
}

export async function zernioCreatePost(apiKey: string, body: any): Promise<any> {
	return zernioJson(apiKey, '/posts', { method: 'POST', json: body });
}
