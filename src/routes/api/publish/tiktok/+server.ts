import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { adminClient, requireUserId } from '$lib/server/auth';

/**
 * Publish a video to TikTok.
 *
 * Body shape:
 * {
 *   openId: string,                 // the tiktok connection's provider_account_id
 *   content: {
 *     videoUrl: string,             // public HTTPS URL of the video (use PUBLIC_APP_URL + /post-tests/...)
 *     mode?: 'inbox' | 'direct',    // default: 'inbox' if video.publish not granted, else 'direct'
 *     // direct-post-only (requires video.publish approval):
 *     title?: string,
 *     privacy?: 'PUBLIC_TO_EVERYONE' | 'MUTUAL_FOLLOW_FRIENDS' | 'FOLLOWER_OF_CREATOR' | 'SELF_ONLY',
 *     disableComment?: boolean,
 *     disableDuet?: boolean,
 *     disableStitch?: boolean,
 *   }
 * }
 *
 * Returns:
 * { ok, publishId, mode, status?: string }
 *
 * Poll /api/publish/tiktok?publishId=... to get current status if you want.
 */

const TT = 'https://open.tiktokapis.com';

type Body = {
	openId: string;
	content: {
		videoUrl: string;
		mode?: 'inbox' | 'direct';
		title?: string;
		privacy?: string;
		disableComment?: boolean;
		disableDuet?: boolean;
		disableStitch?: boolean;
	};
};

async function postJson(path: string, token: string, payload: any) {
	const res = await fetch(`${TT}${path}`, {
		method: 'POST',
		headers: {
			authorization: `Bearer ${token}`,
			'content-type': 'application/json; charset=UTF-8',
		},
		body: JSON.stringify(payload),
	});
	const data = (await res.json()) as any;
	if (!res.ok || data?.error?.code !== 'ok') {
		const msg = data?.error?.message || data?.error?.code || `TikTok ${path} failed (${res.status})`;
		throw new Error(msg);
	}
	return data;
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

	const openId = String(body.openId ?? '').trim();
	const content = body.content ?? ({} as Body['content']);
	if (!openId) return json({ ok: false, error: 'openId is required' }, { status: 400 });
	if (!content?.videoUrl) return json({ ok: false, error: 'content.videoUrl is required' }, { status: 400 });

	const supabase = adminClient();
	const { data: conn, error: connErr } = await supabase
		.from('social_connections')
		.select('*')
		.eq('user_id', userId)
		.eq('provider', 'tiktok')
		.eq('provider_account_id', openId)
		.maybeSingle();
	if (connErr) return json({ ok: false, error: connErr.message }, { status: 500 });
	if (!conn) return json({ ok: false, error: 'No TikTok connection found for this user + openId' }, { status: 404 });

	const token = String((conn as any).access_token ?? '');
	const scopes: string[] = Array.isArray((conn as any).scopes) ? (conn as any).scopes : [];
	if (!token) return json({ ok: false, error: 'Connection has no access_token' }, { status: 500 });

	// Default mode: direct if user granted video.publish, otherwise inbox (draft).
	const canDirect = scopes.some((s) => String(s).toLowerCase() === 'video.publish');
	const mode = content.mode ?? (canDirect ? 'direct' : 'inbox');

	if (mode === 'direct' && !canDirect) {
		return json(
			{
				ok: false,
				error:
					'Direct posting requires the `video.publish` scope which is granted after TikTok app audit. Use mode=inbox (draft) until approved.',
			},
			{ status: 400 }
		);
	}

	try {
		if (mode === 'inbox') {
			// Inbox upload — sandbox-friendly, no audit required.
			// Video lands in the user's TikTok drafts inbox; they tap "Post" in the app to finish.
			const data = await postJson('/v2/post/publish/inbox/video/init/', token, {
				source_info: {
					source: 'PULL_FROM_URL',
					video_url: content.videoUrl,
				},
			});
			return json({
				ok: true,
				mode: 'inbox',
				publishId: data?.data?.publish_id ?? '',
				note: 'Video sent to TikTok drafts inbox. Open the TikTok app → Inbox → Drafts to finish posting.',
			});
		}

		// Direct post (requires video.publish).
		const postInfo: Record<string, any> = {
			title: content.title ?? '',
			privacy_level: content.privacy ?? 'SELF_ONLY',
			disable_comment: !!content.disableComment,
			disable_duet: !!content.disableDuet,
			disable_stitch: !!content.disableStitch,
		};
		const data = await postJson('/v2/post/publish/video/init/', token, {
			post_info: postInfo,
			source_info: {
				source: 'PULL_FROM_URL',
				video_url: content.videoUrl,
			},
		});
		return json({
			ok: true,
			mode: 'direct',
			publishId: data?.data?.publish_id ?? '',
		});
	} catch (e: any) {
		console.error('[publish/tiktok] error', e);
		return json({ ok: false, error: e?.message ?? 'Unknown error' }, { status: 500 });
	}
};

// --- Status polling endpoint (same path, GET) ------------------------------
export const GET: RequestHandler = async ({ request, url }) => {
	let userId: string;
	try {
		userId = await requireUserId(request);
	} catch (e: any) {
		return json({ ok: false, error: e?.message ?? 'Unauthorized' }, { status: e?.status ?? 401 });
	}

	const openId = url.searchParams.get('openId') ?? '';
	const publishId = url.searchParams.get('publishId') ?? '';
	if (!openId || !publishId) return json({ ok: false, error: 'openId and publishId are required' }, { status: 400 });

	const supabase = adminClient();
	const { data: conn } = await supabase
		.from('social_connections')
		.select('access_token')
		.eq('user_id', userId)
		.eq('provider', 'tiktok')
		.eq('provider_account_id', openId)
		.maybeSingle();
	const token = String((conn as any)?.access_token ?? '');
	if (!token) return json({ ok: false, error: 'No TikTok connection' }, { status: 404 });

	try {
		const data = await postJson('/v2/post/publish/status/fetch/', token, { publish_id: publishId });
		return json({ ok: true, status: data?.data?.status, raw: data?.data });
	} catch (e: any) {
		return json({ ok: false, error: e?.message ?? 'Unknown error' }, { status: 500 });
	}
};
