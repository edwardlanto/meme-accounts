import { json, redirect } from '@sveltejs/kit';
import { createClient } from '@supabase/supabase-js';
import { env } from '$env/dynamic/private';
import type { RequestHandler } from './$types';

async function tokenExchange(code: string) {
	const clientId = env.YOUTUBE_CLIENT_ID ?? '';
	const clientSecret = env.YOUTUBE_CLIENT_SECRET ?? '';
	const redirectUri = env.YOUTUBE_REDIRECT_URI ?? '';

	const body = new URLSearchParams();
	body.set('grant_type', 'authorization_code');
	body.set('code', code);
	body.set('client_id', clientId);
	body.set('client_secret', clientSecret);
	body.set('redirect_uri', redirectUri);

	const res = await fetch('https://oauth2.googleapis.com/token', {
		method: 'POST',
		headers: { 'content-type': 'application/x-www-form-urlencoded' },
		body,
	});
	const data = await res.json();
	if (!res.ok) throw new Error((data as any)?.error_description ?? (data as any)?.error ?? 'Google token exchange failed');
	return data as {
		access_token: string;
		expires_in?: number;
		refresh_token?: string;
		scope?: string;
		token_type?: string;
		id_token?: string;
	};
}

async function gGet<T>(url: string, accessToken: string) {
	const res = await fetch(url, { headers: { authorization: `Bearer ${accessToken}` } });
	const data = await res.json();
	if (!res.ok) throw new Error((data as any)?.error?.message ?? `Google API error: ${url}`);
	return data as T;
}

export const GET: RequestHandler = async ({ url, cookies }) => {
	const code = url.searchParams.get('code');
	const state = url.searchParams.get('state');
	const error = url.searchParams.get('error');
	const errorDesc = url.searchParams.get('error_description');

	const expectedState = cookies.get('youtube_oauth_state') ?? '';
	const userId = cookies.get('youtube_oauth_uid') ?? '';
	const next = cookies.get('youtube_oauth_next') ?? '/dashboard/post-scheduler';

	cookies.delete('youtube_oauth_state', { path: '/' });
	cookies.delete('youtube_oauth_uid', { path: '/' });
	cookies.delete('youtube_oauth_next', { path: '/' });

	if (error) {
		throw redirect(303, `${next}?youtube_error=${encodeURIComponent(error)}&desc=${encodeURIComponent(errorDesc ?? '')}`);
	}
	if (!code || !state || !expectedState || state !== expectedState) {
		throw redirect(303, `${next}?youtube_error=invalid_state`);
	}
	if (!userId) {
		throw redirect(303, `${next}?youtube_error=missing_user`);
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

		const scopes =
			(tok.scope ?? '').trim().length > 0
				? (tok.scope ?? '').split(/\s+/).filter(Boolean)
				: (env.YOUTUBE_SCOPES ?? '').split(/\s+/).filter(Boolean);

		// Friendly label: Google user
		let identityLabel: string | null = null;
		try {
			const info = await gGet<any>('https://www.googleapis.com/oauth2/v3/userinfo', accessToken);
			const email = String(info?.email ?? '');
			const name = String(info?.name ?? '');
			identityLabel = name || email || null;
		} catch {
			// ignore
		}

		// Channel info (optional but nice)
		let channelId: string | null = null;
		let channelTitle: string | null = null;
		try {
			const ch = await gGet<any>('https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true', accessToken);
			const item = Array.isArray(ch?.items) ? ch.items[0] : null;
			channelId = item?.id ? String(item.id) : null;
			channelTitle = item?.snippet?.title ? String(item.snippet.title) : null;
		} catch {
			// ignore (some accounts have no channel, or scope mismatch)
		}

		const labelBase =
			channelTitle ? `YouTube — ${channelTitle}` : identityLabel ? `YouTube — ${identityLabel}` : 'YouTube';

		const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);

		// Root connection keeps refresh token; channel row helps selection later.
		await supabase.from('social_connections').upsert(
			{
				user_id: userId,
				provider: 'youtube',
				provider_account_id: 'me',
				provider_account_label: labelBase,
				access_token: accessToken,
				refresh_token: refreshToken,
				expires_at: expiresAt,
				scopes,
				meta: { kind: 'google_youtube', channel_id: channelId, channel_title: channelTitle, identity_label: identityLabel },
			},
			{ onConflict: 'user_id,provider,provider_account_id' }
		);

		if (channelId) {
			await supabase.from('social_connections').upsert(
				{
					user_id: userId,
					provider: 'youtube',
					provider_account_id: `channel:${channelId}`,
					provider_account_label: channelTitle ? `YouTube Channel — ${channelTitle}` : `YouTube Channel — ${channelId}`,
					access_token: accessToken,
					refresh_token: refreshToken,
					expires_at: expiresAt,
					scopes,
					meta: { kind: 'youtube_channel', channel_id: channelId, channel_title: channelTitle },
				},
				{ onConflict: 'user_id,provider,provider_account_id' }
			);
		}

		throw redirect(303, `${next}?youtube_connected=1`);
	} catch (e: any) {
		throw redirect(303, `${next}?youtube_error=${encodeURIComponent(e?.message ?? 'unknown')}`);
	}
};

