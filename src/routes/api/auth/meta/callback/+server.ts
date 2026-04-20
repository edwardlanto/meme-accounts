import { json, redirect } from '@sveltejs/kit';
import { createClient } from '@supabase/supabase-js';
import { env } from '$env/dynamic/private';
import type { RequestHandler } from './$types';

async function exchangeCodeForToken(code: string) {
	const appId = env.META_APP_ID ?? '';
	const appSecret = env.META_APP_SECRET ?? '';
	const redirectUri = env.META_REDIRECT_URI ?? '';

	const tokenUrl = new URL('https://graph.facebook.com/v20.0/oauth/access_token');
	tokenUrl.searchParams.set('client_id', appId);
	tokenUrl.searchParams.set('client_secret', appSecret);
	tokenUrl.searchParams.set('redirect_uri', redirectUri);
	tokenUrl.searchParams.set('code', code);

	const res = await fetch(tokenUrl.toString());
	const data = await res.json();
	if (!res.ok) throw new Error(data.error?.message ?? 'Meta token exchange failed');
	return data as { access_token: string; token_type: string; expires_in?: number };
}

async function exchangeForLongLived(shortLived: string) {
	const appId = env.META_APP_ID ?? '';
	const appSecret = env.META_APP_SECRET ?? '';

	const url = new URL('https://graph.facebook.com/v20.0/oauth/access_token');
	url.searchParams.set('grant_type', 'fb_exchange_token');
	url.searchParams.set('client_id', appId);
	url.searchParams.set('client_secret', appSecret);
	url.searchParams.set('fb_exchange_token', shortLived);

	const res = await fetch(url.toString());
	const data = await res.json();
	if (!res.ok) throw new Error(data.error?.message ?? 'Meta long-lived exchange failed');
	return data as { access_token: string; token_type: string; expires_in?: number };
}

async function graphGet<T>(path: string, accessToken: string) {
	const url = new URL(`https://graph.facebook.com/v20.0/${path.replace(/^\//, '')}`);
	url.searchParams.set('access_token', accessToken);
	const res = await fetch(url.toString());
	const data = await res.json();
	if (!res.ok) throw new Error((data as any).error?.message ?? `Meta Graph error: ${path}`);
	return data as T;
}

export const GET: RequestHandler = async ({ url, cookies }) => {
	const code = url.searchParams.get('code');
	const state = url.searchParams.get('state');
	const error = url.searchParams.get('error');
	const errorReason = url.searchParams.get('error_reason');
	const errorDesc = url.searchParams.get('error_description');

	const expectedState = cookies.get('meta_oauth_state') ?? '';
	const userId = cookies.get('meta_oauth_uid') ?? '';
	const next = cookies.get('meta_oauth_next') ?? '/dashboard/post-scheduler';

	// clear cookies (one-time)
	cookies.delete('meta_oauth_state', { path: '/' });
	cookies.delete('meta_oauth_uid', { path: '/' });
	cookies.delete('meta_oauth_next', { path: '/' });

	if (error) {
		throw redirect(
			303,
			`${next}?meta_error=${encodeURIComponent(error)}&reason=${encodeURIComponent(errorReason ?? '')}&desc=${encodeURIComponent(errorDesc ?? '')}`
		);
	}
	if (!code || !state || !expectedState || state !== expectedState) {
		throw redirect(303, `${next}?meta_error=invalid_state`);
	}
	if (!userId) {
		throw redirect(303, `${next}?meta_error=missing_user`);
	}

	if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_KEY) {
		return json({ error: 'Missing SUPABASE_URL or SUPABASE_SERVICE_KEY' }, { status: 500 });
	}

	try {
		const short = await exchangeCodeForToken(code);
		const long = await exchangeForLongLived(short.access_token);

		const accessToken = long.access_token;
		const expiresAt =
			typeof long.expires_in === 'number' ? new Date(Date.now() + long.expires_in * 1000).toISOString() : null;

		// Fetch pages + connected IG business accounts (if any)
		const pages = await graphGet<{ data: Array<{ id: string; name: string; access_token?: string }> }>(
			'me/accounts?fields=id,name,access_token',
			accessToken
		);

		const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);

		const connections: Array<{
			provider_account_id: string;
			provider_account_label: string;
			page_id?: string;
			page_name?: string;
			ig_user_id?: string;
		}> = [];

		for (const p of pages.data ?? []) {
			// page token is needed for some fields; use it if provided
			const pageToken = p.access_token ?? accessToken;

			// Save Facebook Page connection (used for scheduling/publishing to Pages)
			await supabase.from('social_connections').upsert(
				{
					user_id: userId,
					provider: 'meta',
					provider_account_id: `fbpage:${p.id}`,
					provider_account_label: `Facebook Page — ${p.name}`,
					access_token: pageToken,
					refresh_token: null,
					expires_at: expiresAt,
					scopes: (env.META_SCOPES ?? '').split(',').filter(Boolean),
					meta: { kind: 'facebook_page', page_id: p.id, page_name: p.name },
				},
				{ onConflict: 'user_id,provider,provider_account_id' }
			);

			const page = await graphGet<any>(`${p.id}?fields=instagram_business_account`, pageToken);
			const igId = page?.instagram_business_account?.id as string | undefined;
			if (igId) {
				connections.push({
					provider_account_id: igId,
					provider_account_label: `Instagram (Business) — ${p.name}`,
					page_id: p.id,
					page_name: p.name,
					ig_user_id: igId,
				});
			}
		}

		// If no IG business account was found, still store the Meta token to allow later selection
		if (connections.length === 0) {
			await supabase.from('social_connections').upsert(
				{
					user_id: userId,
					provider: 'meta',
					provider_account_id: 'me',
					provider_account_label: 'Meta (no IG business found yet)',
					access_token: accessToken,
					refresh_token: null,
					expires_at: expiresAt,
					scopes: (env.META_SCOPES ?? '').split(',').filter(Boolean),
					meta: { kind: 'meta', pages_count: (pages.data ?? []).length },
				},
				{ onConflict: 'user_id,provider,provider_account_id' }
			);
			throw redirect(303, `${next}?meta_connected=1&ig_found=0`);
		}

		for (const c of connections) {
			await supabase.from('social_connections').upsert(
				{
					user_id: userId,
					provider: 'meta',
					provider_account_id: c.provider_account_id,
					provider_account_label: c.provider_account_label,
					access_token: accessToken,
					refresh_token: null,
					expires_at: expiresAt,
					scopes: (env.META_SCOPES ?? '').split(',').filter(Boolean),
					meta: { kind: 'instagram_business', page_id: c.page_id, page_name: c.page_name },
				},
				{ onConflict: 'user_id,provider,provider_account_id' }
			);
		}

		throw redirect(303, `${next}?meta_connected=1&ig_found=1`);
	} catch (e: any) {
		throw redirect(303, `${next}?meta_error=${encodeURIComponent(e?.message ?? 'unknown')}`);
	}
};

