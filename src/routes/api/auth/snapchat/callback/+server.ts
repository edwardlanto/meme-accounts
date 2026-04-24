import { json, redirect } from '@sveltejs/kit';
import { createClient } from '@supabase/supabase-js';
import { env } from '$env/dynamic/private';
import type { RequestHandler } from './$types';

async function tokenExchange(code: string) {
	const clientId = env.SNAPCHAT_CLIENT_ID ?? '';
	const clientSecret = env.SNAPCHAT_CLIENT_SECRET ?? '';
	const redirectUri = env.SNAPCHAT_REDIRECT_URI ?? '';

	const body = new URLSearchParams();
	body.set('grant_type', 'authorization_code');
	body.set('code', code);
	body.set('redirect_uri', redirectUri);
	body.set('client_id', clientId);
	body.set('client_secret', clientSecret);

	const res = await fetch('https://accounts.snapchat.com/login/oauth2/token', {
		method: 'POST',
		headers: { 'content-type': 'application/x-www-form-urlencoded' },
		body,
	});

	const data = (await res.json()) as any;
	if (!res.ok) {
		const msg =
			typeof data?.error_description === 'string'
				? data.error_description
				: typeof data?.error === 'string'
					? data.error
					: 'Snapchat token exchange failed';
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

export const GET: RequestHandler = async ({ url, cookies }) => {
	const code = url.searchParams.get('code');
	const state = url.searchParams.get('state');
	const errParam = url.searchParams.get('error');
	const errDesc = url.searchParams.get('error_description');

	const expectedState = cookies.get('snapchat_oauth_state') ?? '';
	const userId = cookies.get('snapchat_oauth_uid') ?? '';
	const next = cookies.get('snapchat_oauth_next') ?? '/dashboard/post-scheduler';

	cookies.delete('snapchat_oauth_state', { path: '/' });
	cookies.delete('snapchat_oauth_uid', { path: '/' });
	cookies.delete('snapchat_oauth_next', { path: '/' });

	if (errParam) {
		throw redirect(303, `${next}?snapchat_error=${encodeURIComponent(errParam)}&desc=${encodeURIComponent(errDesc ?? '')}`);
	}
	if (!code || !state || !expectedState || state !== expectedState) {
		throw redirect(303, `${next}?snapchat_error=invalid_state`);
	}
	if (!userId) {
		throw redirect(303, `${next}?snapchat_error=missing_user`);
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
		const scopes = String(tok.scope ?? env.SNAPCHAT_SCOPES ?? '')
			.split(/[,\s]+/)
			.filter(Boolean);

		const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);

		// Snapchat tokens are tied to the account grant; without additional API calls
		// we store a single "me" connection row.
		await supabase.from('social_connections').upsert(
			{
				user_id: userId,
				provider: 'snapchat',
				provider_account_id: 'me',
				provider_account_label: 'Snapchat — Connected',
				access_token: accessToken,
				refresh_token: refreshToken,
				expires_at: expiresAt,
				scopes,
				meta: { kind: 'snapchat_oauth' },
			},
			{ onConflict: 'user_id,provider,provider_account_id' }
		);

		throw redirect(303, `${next}?snapchat_connected=1`);
	} catch (e: any) {
		if (e?.status === 303 || e?.location) throw e;
		console.error('[snapchat callback] error', e);
		throw redirect(303, `${next}?snapchat_error=${encodeURIComponent(e?.message ?? 'unknown_error')}`);
	}
};

