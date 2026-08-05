import { json } from '@sveltejs/kit';
import { BskyAgent } from '@atproto/api';
import { adminClient } from '$lib/server/auth';
import { blueskyConnectBodySchema, parseJsonBody } from '$lib/server/request-security';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, locals }) => {
	const { user } = await locals.safeGetSession();
	if (!user) return json({ ok: false, error: 'Unauthorized' }, { status: 401 });

	const parsed = await parseJsonBody(request, blueskyConnectBodySchema);
	if (!parsed.ok) return json({ ok: false, error: parsed.error }, { status: parsed.status });

	const identifier = String(parsed.data.handle ?? parsed.data.identifier ?? '').trim();
	const appPassword = String(parsed.data.appPassword ?? parsed.data.password ?? '').trim();
	if (!identifier) return json({ ok: false, error: 'Missing handle' }, { status: 400 });
	if (!appPassword) return json({ ok: false, error: 'Missing app password' }, { status: 400 });

	try {
		const agent = new BskyAgent({ service: 'https://bsky.social' });
		const session = await agent.login({ identifier, password: appPassword });

		const did = String(session?.data?.did ?? agent?.did ?? '').trim();
		const handle = String(session?.data?.handle ?? '').trim() || identifier;
		if (!did) return json({ ok: false, error: 'Bluesky login failed (no DID returned)' }, { status: 400 });

		const supabase = adminClient();
		await supabase.from('social_connections').upsert(
			{
				user_id: user.id,
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
			{ onConflict: 'user_id,provider,provider_account_id' },
		);

		return json({ ok: true, did, handle });
	} catch (e: unknown) {
		const msg = e instanceof Error ? e.message : 'Bluesky connect failed';
		return json({ ok: false, error: msg }, { status: 400 });
	}
};
