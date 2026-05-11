import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/private';
import { adminClient, requireUserId } from '$lib/server/auth';
import { buildZernioInstagramBody, zernioCreatePost } from '$lib/server/zernio-publish';

type CarouselItem = { imageUrl?: string; videoUrl?: string };

type Body = {
	/** Zernio SocialAccount id */
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

	const apiKey = env.ZERNIO_API_KEY ?? '';
	if (!apiKey) return json({ ok: false, error: 'Server missing ZERNIO_API_KEY' }, { status: 500 });

	const supabase = adminClient();
	const { data: conn, error: connErr } = await supabase
		.from('social_connections')
		.select('*')
		.eq('user_id', userId)
		.eq('provider', 'zernio')
		.eq('provider_account_id', igUserId)
		.maybeSingle();
	if (connErr) return json({ ok: false, error: connErr.message }, { status: 500 });
	if (!conn) return json({ ok: false, error: 'No Zernio Instagram connection for this user + id' }, { status: 404 });

	const meta = (conn as any).meta ?? {};
	if (String(meta.platform ?? '') !== 'instagram') {
		return json({ ok: false, error: 'This connection is not an Instagram account' }, { status: 400 });
	}

	try {
		const zBody = await buildZernioInstagramBody(apiKey, igUserId, content);
		const result = await zernioCreatePost(apiKey, zBody);
		return json({ ok: true, provider: 'zernio', result });
	} catch (e: any) {
		console.error('[publish/instagram zernio]', e);
		return json({ ok: false, error: e?.message ?? 'Unknown error' }, { status: 500 });
	}
};
