import { json, redirect } from '@sveltejs/kit';
import { createClient } from '@supabase/supabase-js';
import { env } from '$env/dynamic/private';
import type { RequestHandler } from './$types';

async function tokenExchange(code: string) {
	const clientId = env.GMB_CLIENT_ID ?? '';
	const clientSecret = env.GMB_CLIENT_SECRET ?? '';
	const redirectUri = env.GMB_REDIRECT_URI ?? '';

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
	return data as { access_token: string; expires_in?: number; refresh_token?: string; scope?: string; token_type?: string; id_token?: string };
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

	const expectedState = cookies.get('gmb_oauth_state') ?? '';
	const userId = cookies.get('gmb_oauth_uid') ?? '';
	const next = cookies.get('gmb_oauth_next') ?? '/dashboard/post-scheduler';

	cookies.delete('gmb_oauth_state', { path: '/' });
	cookies.delete('gmb_oauth_uid', { path: '/' });
	cookies.delete('gmb_oauth_next', { path: '/' });

	if (error) {
		throw redirect(303, `${next}?gmb_error=${encodeURIComponent(error)}&desc=${encodeURIComponent(errorDesc ?? '')}`);
	}
	if (!code || !state || !expectedState || state !== expectedState) {
		throw redirect(303, `${next}?gmb_error=invalid_state`);
	}
	if (!userId) {
		throw redirect(303, `${next}?gmb_error=missing_user`);
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
				: (env.GMB_SCOPES ?? '').split(/\s+/).filter(Boolean);

		// Try to get a friendly label for the Google identity
		let identityLabel: string | null = null;
		try {
			const info = await gGet<any>('https://www.googleapis.com/oauth2/v3/userinfo', accessToken);
			const email = String(info?.email ?? '');
			const name = String(info?.name ?? '');
			identityLabel = name || email || null;
		} catch {
			// ignore
		}

		// Business Profile Accounts (Account Management API)
		const accounts = await gGet<any>('https://mybusinessaccountmanagement.googleapis.com/v1/accounts', accessToken);
		const accountList: any[] = Array.isArray(accounts?.accounts) ? accounts.accounts : [];

		const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);

		// Save a root connection even if there are no accounts (still keeps refresh token)
		await supabase.from('social_connections').upsert(
			{
				user_id: userId,
				provider: 'gmb',
				provider_account_id: 'me',
				provider_account_label: identityLabel ? `Google (GMB) — ${identityLabel}` : 'Google (GMB)',
				access_token: accessToken,
				refresh_token: refreshToken,
				expires_at: expiresAt,
				scopes,
				meta: { kind: 'google', accounts_count: accountList.length },
			},
			{ onConflict: 'user_id,provider,provider_account_id' }
		);

		let locationsSaved = 0;
		for (const acct of accountList) {
			const accountName = String(acct?.name ?? ''); // e.g. "accounts/123"
			if (!accountName) continue;
			const accountId = accountName.split('/')[1] ?? accountName;
			const accountLabel = String(acct?.accountName ?? acct?.name ?? `Account ${accountId}`);

			// Locations (Business Information API)
			const locations = await gGet<any>(
				`https://mybusinessbusinessinformation.googleapis.com/v1/${accountName}/locations?readMask=name,title,storefrontAddress,websiteUri`,
				accessToken
			);
			const locs: any[] = Array.isArray(locations?.locations) ? locations.locations : [];

			for (const loc of locs) {
				const locName = String(loc?.name ?? ''); // e.g. "locations/456" or "accounts/123/locations/456"
				if (!locName) continue;
				const title = String(loc?.title ?? 'Location');
				const label = `GBP — ${title} (${accountLabel})`;

				await supabase.from('social_connections').upsert(
					{
						user_id: userId,
						provider: 'gmb',
						provider_account_id: `location:${locName}`,
						provider_account_label: label,
						access_token: accessToken,
						refresh_token: refreshToken,
						expires_at: expiresAt,
						scopes,
						meta: {
							kind: 'gmb_location',
							account_name: accountName,
							account_label: accountLabel,
							location_name: locName,
							location_title: title,
							location: loc,
						},
					},
					{ onConflict: 'user_id,provider,provider_account_id' }
				);
				locationsSaved += 1;
			}
		}

		throw redirect(303, `${next}?gmb_connected=1&locations=${locationsSaved}`);
	} catch (e: any) {
		throw redirect(303, `${next}?gmb_error=${encodeURIComponent(e?.message ?? 'unknown')}`);
	}
};

