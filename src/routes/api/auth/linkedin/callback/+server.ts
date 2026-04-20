import { json, redirect } from '@sveltejs/kit';
import { createClient } from '@supabase/supabase-js';
import { env } from '$env/dynamic/private';
import type { RequestHandler } from './$types';

type Mode = 'member' | 'org' | 'both';

async function tokenExchange(code: string) {
	const clientId = env.LINKEDIN_CLIENT_ID ?? '';
	const clientSecret = env.LINKEDIN_CLIENT_SECRET ?? '';
	const redirectUri = env.LINKEDIN_REDIRECT_URI ?? '';

	const body = new URLSearchParams();
	body.set('grant_type', 'authorization_code');
	body.set('code', code);
	body.set('client_id', clientId);
	body.set('client_secret', clientSecret);
	body.set('redirect_uri', redirectUri);

	const res = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
		method: 'POST',
		headers: { 'content-type': 'application/x-www-form-urlencoded' },
		body,
	});
	const data = await res.json();
	if (!res.ok) throw new Error((data as any)?.error_description ?? (data as any)?.message ?? 'LinkedIn token exchange failed');

	return data as { access_token: string; expires_in?: number; refresh_token?: string; refresh_token_expires_in?: number; scope?: string };
}

async function liGet<T>(path: string, accessToken: string) {
	const url = new URL(`https://api.linkedin.com/v2/${path.replace(/^\//, '')}`);
	const res = await fetch(url.toString(), {
		headers: {
			authorization: `Bearer ${accessToken}`,
			'X-Restli-Protocol-Version': '2.0.0',
		},
	});
	const data = await res.json();
	if (!res.ok) throw new Error((data as any)?.message ?? `LinkedIn API error: ${path}`);
	return data as T;
}

function extractOrgId(target: string) {
	// target is often "urn:li:organization:123"
	const m = /organization:(\d+)/.exec(target);
	return m?.[1] ?? '';
}

export const GET: RequestHandler = async ({ url, cookies }) => {
	const code = url.searchParams.get('code');
	const state = url.searchParams.get('state');
	const error = url.searchParams.get('error');
	const errorDesc = url.searchParams.get('error_description');

	const expectedState = cookies.get('linkedin_oauth_state') ?? '';
	const userId = cookies.get('linkedin_oauth_uid') ?? '';
	const next = cookies.get('linkedin_oauth_next') ?? '/dashboard/post-scheduler';
	const mode = (cookies.get('linkedin_oauth_mode') ?? 'both') as Mode;

	cookies.delete('linkedin_oauth_state', { path: '/' });
	cookies.delete('linkedin_oauth_uid', { path: '/' });
	cookies.delete('linkedin_oauth_next', { path: '/' });
	cookies.delete('linkedin_oauth_mode', { path: '/' });

	if (error) {
		throw redirect(303, `${next}?linkedin_error=${encodeURIComponent(error)}&desc=${encodeURIComponent(errorDesc ?? '')}`);
	}
	if (!code || !state || !expectedState || state !== expectedState) {
		throw redirect(303, `${next}?linkedin_error=invalid_state`);
	}
	if (!userId) {
		throw redirect(303, `${next}?linkedin_error=missing_user`);
	}
	if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_KEY) {
		return json({ error: 'Missing SUPABASE_URL or SUPABASE_SERVICE_KEY' }, { status: 500 });
	}

	try {
		const tok = await tokenExchange(code);
		const accessToken = tok.access_token;
		const expiresAt =
			typeof tok.expires_in === 'number' ? new Date(Date.now() + tok.expires_in * 1000).toISOString() : null;

		const scopes =
			(tok.scope ?? '').trim().length > 0
				? (tok.scope ?? '').split(/\s+/).filter(Boolean)
				: (env.LINKEDIN_SCOPES ?? '').split(/\s+/).filter(Boolean);

		const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);

		// Always store the member connection when possible (needed for "post as me")
		let memberId = '';
		let memberLabel = 'LinkedIn — Member';
		try {
			const me = await liGet<any>('me', accessToken);
			memberId = String(me?.id ?? '');
			const first = me?.localizedFirstName ?? '';
			const last = me?.localizedLastName ?? '';
			const name = `${first} ${last}`.trim();
			if (name) memberLabel = `LinkedIn — ${name}`;
		} catch {
			// If the app doesn't have member profile product enabled, keep going for org-only flows.
		}

		let memberSaved = 0;
		if (mode !== 'org' && memberId) {
			await supabase.from('social_connections').upsert(
				{
					user_id: userId,
					provider: 'linkedin',
					provider_account_id: `member:${memberId}`,
					provider_account_label: memberLabel,
					access_token: accessToken,
					refresh_token: (tok as any).refresh_token ?? null,
					expires_at: expiresAt,
					scopes,
					meta: { kind: 'member', member_id: memberId },
				},
				{ onConflict: 'user_id,provider,provider_account_id' }
			);
			memberSaved = 1;
		}

		// Optionally store organizations where the member is an admin.
		let orgSaved = 0;
		if (mode !== 'member') {
			// Older, widely-supported endpoint. Newer LinkedIn docs recommend organizationAuthorizations.
			const acls = await liGet<any>(
				'organizationalEntityAcls?q=roleAssignee&role=ADMINISTRATOR&state=APPROVED',
				accessToken
			);
			const elements: any[] = Array.isArray(acls?.elements) ? acls.elements : [];

			for (const el of elements) {
				const target = String(el?.organizationalTarget ?? '');
				const orgId = extractOrgId(target);
				if (!orgId) continue;

				let orgName = `Organization ${orgId}`;
				try {
					const org = await liGet<any>(`organizations/${orgId}`, accessToken);
					orgName = String(org?.localizedName ?? orgName);
				} catch {
					// ignore
				}

				await supabase.from('social_connections').upsert(
					{
						user_id: userId,
						provider: 'linkedin',
						provider_account_id: `org:${orgId}`,
						provider_account_label: `LinkedIn Page — ${orgName}`,
						access_token: accessToken,
						refresh_token: (tok as any).refresh_token ?? null,
						expires_at: expiresAt,
						scopes,
						meta: { kind: 'organization', organization_id: orgId, organization_urn: target },
					},
					{ onConflict: 'user_id,provider,provider_account_id' }
				);
				orgSaved += 1;
			}
		}

		throw redirect(303, `${next}?linkedin_connected=1&member=${memberSaved}&orgs=${orgSaved}`);
	} catch (e: any) {
		throw redirect(303, `${next}?linkedin_error=${encodeURIComponent(e?.message ?? 'unknown')}`);
	}
};

