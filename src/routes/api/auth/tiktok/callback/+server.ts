import { json, redirect } from '@sveltejs/kit';
import { createClient } from '@supabase/supabase-js';
import { env } from '$env/dynamic/private';
import type { RequestHandler } from './$types';

async function tokenExchange(code: string) {
	const clientKey = env.TIKTOK_CLIENT_KEY ?? '';
	const clientSecret = env.TIKTOK_CLIENT_SECRET ?? '';
	const redirectUri = env.TIKTOK_REDIRECT_URI ?? '';

	const body = new URLSearchParams();
	body.set('client_key', clientKey);
	body.set('client_secret', clientSecret);
	body.set('code', code);
	body.set('grant_type', 'authorization_code');
	body.set('redirect_uri', redirectUri);

	const res = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
		method: 'POST',
		headers: {
			'content-type': 'application/x-www-form-urlencoded',
			'cache-control': 'no-cache',
		},
		body,
	});
	const data = (await res.json()) as any;
	if (!res.ok || data?.error) {
		const msg = data?.error_description ?? data?.error ?? 'TikTok token exchange failed';
		throw new Error(msg);
	}
	return data as {
		access_token: string;
		expires_in: number;
		refresh_token: string;
		refresh_expires_in: number;
		open_id: string;
		scope: string;
		token_type: string;
	};
}

async function fetchUserInfo(accessToken: string) {
	// Minimal profile to get a nice display label.
	const url = new URL('https://open.tiktokapis.com/v2/user/info/');
	url.searchParams.set('fields', 'open_id,union_id,avatar_url,display_name');
	const res = await fetch(url.toString(), {
		headers: { authorization: `Bearer ${accessToken}` },
	});
	const data = (await res.json()) as any;
	if (!res.ok) return null;
	return data?.data?.user ?? null;
}

export const GET: RequestHandler = async ({ url, cookies }) => {
	const code = url.searchParams.get('code');
	const state = url.searchParams.get('state');
	const errParam = url.searchParams.get('error');
	const errDesc = url.searchParams.get('error_description');

	const expectedState = cookies.get('tiktok_oauth_state') ?? '';
	const userId = cookies.get('tiktok_oauth_uid') ?? '';
	const next = cookies.get('tiktok_oauth_next') ?? '/dashboard/post-tests';

	cookies.delete('tiktok_oauth_state', { path: '/' });
	cookies.delete('tiktok_oauth_uid', { path: '/' });
	cookies.delete('tiktok_oauth_next', { path: '/' });

	if (errParam) {
		throw redirect(303, `${next}?tiktok_error=${encodeURIComponent(errParam)}&desc=${encodeURIComponent(errDesc ?? '')}`);
	}
	if (!code || !state || !expectedState || state !== expectedState) {
		throw redirect(303, `${next}?tiktok_error=invalid_state`);
	}
	if (!userId) {
		throw redirect(303, `${next}?tiktok_error=missing_user`);
	}
	if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_KEY) {
		return json({ error: 'Missing SUPABASE_URL or SUPABASE_SERVICE_KEY' }, { status: 500 });
	}

	try {
		const tok = await tokenExchange(code);
		const accessToken = tok.access_token;
		const refreshToken = tok.refresh_token ?? null;
		const expiresAt =
			typeof tok.expires_in === 'number'
				? new Date(Date.now() + tok.expires_in * 1000).toISOString()
				: null;
		const scopes = (tok.scope ?? '').split(/[,\s]+/).filter(Boolean);

		const profile = await fetchUserInfo(accessToken);
		const openId = String(tok.open_id ?? profile?.open_id ?? '');
		const displayName = String(profile?.display_name ?? '').trim();
		const label = displayName ? `TikTok — ${displayName}` : `TikTok — ${openId.slice(0, 10)}`;

		const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);

		await supabase.from('social_connections').upsert(
			{
				user_id: userId,
				provider: 'tiktok',
				provider_account_id: openId,
				provider_account_label: label,
				access_token: accessToken,
				refresh_token: refreshToken,
				expires_at: expiresAt,
				scopes,
				meta: {
					kind: 'tiktok_user',
					open_id: openId,
					union_id: profile?.union_id ?? null,
					avatar_url: profile?.avatar_url ?? null,
					display_name: displayName || null,
					refresh_expires_in: tok.refresh_expires_in ?? null,
				},
			},
			{ onConflict: 'user_id,provider,provider_account_id' }
		);

		throw redirect(303, `${next}?tiktok_connected=1`);
	} catch (e: any) {
		// Re-throw SvelteKit redirects — they're not errors.
		if (e?.status === 303 || e?.location) throw e;
		console.error('[tiktok callback] error', e);
		throw redirect(303, `${next}?tiktok_error=${encodeURIComponent(e?.message ?? 'unknown_error')}`);
	}
};
