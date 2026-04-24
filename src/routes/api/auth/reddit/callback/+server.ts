import { json, redirect } from '@sveltejs/kit';
import { createClient } from '@supabase/supabase-js';
import { env } from '$env/dynamic/private';
import type { RequestHandler } from './$types';

async function tokenExchange(code: string) {
	const clientId = env.REDDIT_CLIENT_ID ?? '';
	const clientSecret = env.REDDIT_CLIENT_SECRET ?? '';
	const redirectUri = env.REDDIT_REDIRECT_URI ?? '';

	const body = new URLSearchParams();
	body.set('grant_type', 'authorization_code');
	body.set('code', code);
	body.set('redirect_uri', redirectUri);

	const basic = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

	const res = await fetch('https://www.reddit.com/api/v1/access_token', {
		method: 'POST',
		headers: {
			authorization: `Basic ${basic}`,
			'content-type': 'application/x-www-form-urlencoded',
			// Reddit requires a UA; if missing they may reject/ratelimit.
			'user-agent': env.REDDIT_USER_AGENT ?? 'svelte-social-poster/1.0 (oauth)',
		},
		body,
	});

	const data = (await res.json()) as any;
	if (!res.ok) {
		const msg = typeof data?.message === 'string' ? data.message : 'Reddit token exchange failed';
		throw new Error(msg);
	}
	return data as {
		access_token: string;
		refresh_token?: string;
		expires_in?: number;
		scope?: string;
		token_type?: string;
	};
}

async function redditMe(accessToken: string) {
	const res = await fetch('https://oauth.reddit.com/api/v1/me', {
		headers: {
			authorization: `Bearer ${accessToken}`,
			'user-agent': env.REDDIT_USER_AGENT ?? 'svelte-social-poster/1.0 (oauth)',
		},
	});
	if (!res.ok) return null;
	return (await res.json()) as any;
}

export const GET: RequestHandler = async ({ url, cookies }) => {
	const code = url.searchParams.get('code');
	const state = url.searchParams.get('state');
	const errParam = url.searchParams.get('error');

	const expectedState = cookies.get('reddit_oauth_state') ?? '';
	const userId = cookies.get('reddit_oauth_uid') ?? '';
	const next = cookies.get('reddit_oauth_next') ?? '/dashboard/post-scheduler';

	cookies.delete('reddit_oauth_state', { path: '/' });
	cookies.delete('reddit_oauth_uid', { path: '/' });
	cookies.delete('reddit_oauth_next', { path: '/' });

	if (errParam) {
		throw redirect(303, `${next}?reddit_error=${encodeURIComponent(errParam)}`);
	}
	if (!code || !state || !expectedState || state !== expectedState) {
		throw redirect(303, `${next}?reddit_error=invalid_state`);
	}
	if (!userId) {
		throw redirect(303, `${next}?reddit_error=missing_user`);
	}
	if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_KEY) {
		return json({ error: 'Missing SUPABASE_URL or SUPABASE_SERVICE_KEY' }, { status: 500 });
	}

	try {
		const tok = await tokenExchange(code);
		const accessToken = tok.access_token;
		const refreshToken = tok.refresh_token ?? null;
		const expiresAt =
			typeof tok.expires_in === 'number' ? new Date(Date.now() + tok.expires_in * 1000).toISOString() : null;
		const scopes = String(tok.scope ?? env.REDDIT_SCOPES ?? '')
			.split(/[,\s]+/)
			.filter(Boolean);

		const me = await redditMe(accessToken);
		const name = String(me?.name ?? '').trim();
		const id = String(me?.id ?? '').trim();
		const accountId = id || name || 'me';
		const label = name ? `Reddit — u/${name}` : 'Reddit — Connected';

		const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);
		await supabase.from('social_connections').upsert(
			{
				user_id: userId,
				provider: 'reddit',
				provider_account_id: accountId,
				provider_account_label: label,
				access_token: accessToken,
				refresh_token: refreshToken,
				expires_at: expiresAt,
				scopes,
				meta: { kind: 'reddit_oauth', username: name || null },
			},
			{ onConflict: 'user_id,provider,provider_account_id' }
		);

		throw redirect(303, `${next}?reddit_connected=1`);
	} catch (e: any) {
		if (e?.status === 303 || e?.location) throw e;
		console.error('[reddit callback] error', e);
		throw redirect(303, `${next}?reddit_error=${encodeURIComponent(e?.message ?? 'unknown_error')}`);
	}
};

