import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/private';
import { adminClient, requireUserId } from '$lib/server/auth';
import { buildZernioTikTokBody, zernioCreatePost } from '$lib/server/zernio-publish';

/**
 * Publish a video to TikTok via Zernio.
 *
 * Body:
 * { openId: string (Zernio account id), content: { videoUrl, mode?, title?, privacy?, disableComment?, ... } }
 */

type Body = {
	openId: string;
	content: {
		videoUrl: string;
		mode?: 'inbox' | 'direct';
		title?: string;
		caption?: string;
		privacy?: string;
		disableComment?: boolean;
		disableDuet?: boolean;
		disableStitch?: boolean;
	};
};

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

	const accountId = String(body.openId ?? '').trim();
	const content = body.content ?? ({} as Body['content']);
	if (!accountId) return json({ ok: false, error: 'openId is required' }, { status: 400 });
	if (!content?.videoUrl) return json({ ok: false, error: 'content.videoUrl is required' }, { status: 400 });

	const apiKey = env.ZERNIO_API_KEY ?? '';
	if (!apiKey) return json({ ok: false, error: 'Server missing ZERNIO_API_KEY' }, { status: 500 });

	const supabase = adminClient();
	const { data: conn, error: connErr } = await supabase
		.from('social_connections')
		.select('*')
		.eq('user_id', userId)
		.eq('provider', 'zernio')
		.eq('provider_account_id', accountId)
		.maybeSingle();
	if (connErr) return json({ ok: false, error: connErr.message }, { status: 500 });
	if (!conn) return json({ ok: false, error: 'No Zernio TikTok connection for this user + openId' }, { status: 404 });

	const meta = (conn as any).meta ?? {};
	if (String(meta.platform ?? '') !== 'tiktok') {
		return json({ ok: false, error: 'This connection is not a TikTok account' }, { status: 400 });
	}

	try {
		const zBody = await buildZernioTikTokBody(apiKey, accountId, content);
		const result = await zernioCreatePost(apiKey, zBody);
		return json({ ok: true, provider: 'zernio', mode: content.mode ?? 'direct', result });
	} catch (e: any) {
		console.error('[publish/tiktok zernio]', e);
		return json({ ok: false, error: e?.message ?? 'Unknown error' }, { status: 500 });
	}
};

export const GET: RequestHandler = () => {
	return json(
		{
			ok: false,
			error:
				'Publish status polling is not used with Zernio. The POST response includes the Zernio post payload; check status in the Zernio dashboard or API.',
		},
		{ status: 410 }
	);
};
