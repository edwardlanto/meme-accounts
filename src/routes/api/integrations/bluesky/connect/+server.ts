import { json } from '@sveltejs/kit';
import { createClient } from '@supabase/supabase-js';
import { BskyAgent } from '@atproto/api';
import { env } from '$env/dynamic/private';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
	if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_KEY) {
		return json({ ok: false, error: 'Missing SUPABASE_URL or SUPABASE_SERVICE_KEY' }, { status: 500 });
	}

	let body: any;
	try {
		body = await request.json();
	} catch {
		return json({ ok: false, error: 'Invalid JSON body' }, { status: 400 });
	}

	const userId = String(body?.userId ?? '').trim();
	const identifier = String(body?.handle ?? body?.identifier ?? '').trim();
	const appPassword = String(body?.appPassword ?? body?.password ?? '').trim();

	if (!userId) return json({ ok: false, error: 'Missing userId' }, { status: 400 });
	if (!identifier) return json({ ok: false, error: 'Missing handle' }, { status: 400 });
	if (!appPassword) return json({ ok: false, error: 'Missing app password' }, { status: 400 });

	try {
		const agent = new BskyAgent({ service: 'https://bsky.social' });
		const session = await agent.login({ identifier, password: appPassword });

		const did = String(session?.data?.did ?? agent?.did ?? '').trim();
		const handle = String(session?.data?.handle ?? '').trim() || identifier;

		if (!did) return json({ ok: false, error: 'Bluesky login failed (no DID returned)' }, { status: 400 });

		const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);
		await supabase.from('social_connections').upsert(
			{
				user_id: userId,
				provider: 'bluesky',
				provider_account_id: did,
				provider_account_label: `Bluesky — @${handle}`,
				access_token: agent.session?.accessJwt ?? null,
				refresh_token: agent.session?.refreshJwt ?? null,
				expires_at: null,
				scopes: ['atproto'],
				meta: {
					kind: 'atproto_app_password',
					did,
					handle,
					service: agent.service?.toString?.() ?? 'https://bsky.social',
				},
			},
			{ onConflict: 'user_id,provider,provider_account_id' }
		);

		return json({ ok: true, did, handle });
	} catch (e: any) {
		const msg = typeof e?.message === 'string' ? e.message : 'Bluesky connect failed';
		return json({ ok: false, error: msg }, { status: 400 });
	}
};

