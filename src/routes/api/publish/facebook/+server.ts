import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/private';
import { adminClient, requireUserId } from '$lib/server/auth';
import {
	buildZernioFacebookBodies,
	zernioCreatePost,
} from '$lib/server/zernio-publish';

type VideoItem = {
	url?: string;
	dataUrl?: string;
	serverPath?: string;
	description?: string;
};

type Body = {
	/** Zernio SocialAccount id for the connected Facebook Page */
	pageProviderAccountId: string;
	content: {
		kind?: 'feed' | 'reel' | 'photo_story' | 'video_story';
		title?: string;
		message?: string;
		link?: string;
		images?: string[];
		imageCaptions?: string[];
		imagesMode?: 'carousel' | 'individual';
		video?: string;
		videos?: VideoItem[];
		reelVideo?: VideoItem;
		reelDescription?: string;
		storyPhoto?: string;
		storyVideo?: VideoItem;
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

	const accountId = String(body.pageProviderAccountId ?? '').trim();
	const content = body.content ?? {};
	if (!accountId) return json({ ok: false, error: 'pageProviderAccountId is required' }, { status: 400 });

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
	if (!conn) return json({ ok: false, error: 'No Zernio Facebook connection for this account id' }, { status: 404 });

	const meta = (conn as any).meta ?? {};
	if (String(meta.platform ?? '') !== 'facebook') {
		return json({ ok: false, error: 'This connection is not a Facebook account' }, { status: 400 });
	}

	const pageId = meta.facebookPageId ? String(meta.facebookPageId) : undefined;

	try {
		const bodies = await buildZernioFacebookBodies(apiKey, accountId, content, {
			facebookPageId: pageId,
		});
		const results: unknown[] = [];
		for (const b of bodies) {
			results.push(await zernioCreatePost(apiKey, b));
		}
		return json({ ok: true, provider: 'zernio', count: results.length, results });
	} catch (e: any) {
		console.error('[publish/facebook zernio]', e);
		return json({ ok: false, error: e?.message ?? 'Unknown publishing error' }, { status: 500 });
	}
};
