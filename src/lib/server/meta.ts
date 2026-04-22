import { env } from '$env/dynamic/private';
import { adminClient } from './auth';

const META_GRAPH_VERSION = 'v20.0';

/**
 * Detect Meta Graph API auth errors that require the user to reconnect.
 * Codes 190 / 102 / 463 / 467 are the well-known "token expired / invalid" codes.
 */
export function isMetaAuthError(err: any): boolean {
	const msg = String(err?.message ?? err ?? '').toLowerCase();
	if (/oauth/.test(msg) && /(expired|invalid|revoked|session)/.test(msg)) return true;
	const code = Number(err?.code ?? err?.error?.code ?? 0);
	return [102, 190, 463, 467].includes(code);
}

/**
 * Refresh a long-lived Meta user token (extends ~60 days).
 * Note: Facebook Page tokens derived from a long-lived user token are effectively
 * non-expiring so long as the user token is valid — but calling this on the user
 * token extends the Page tokens' validity as well.
 */
export async function refreshMetaLongLivedToken(shortOrLongLived: string) {
	const appId = env.META_APP_ID ?? '';
	const appSecret = env.META_APP_SECRET ?? '';
	if (!appId || !appSecret) throw new Error('Missing META_APP_ID or META_APP_SECRET');

	const url = new URL(`https://graph.facebook.com/${META_GRAPH_VERSION}/oauth/access_token`);
	url.searchParams.set('grant_type', 'fb_exchange_token');
	url.searchParams.set('client_id', appId);
	url.searchParams.set('client_secret', appSecret);
	url.searchParams.set('fb_exchange_token', shortOrLongLived);

	const res = await fetch(url.toString());
	const data = await res.json();
	if (!res.ok) throw new Error(data?.error?.message ?? 'Meta long-lived exchange failed');
	return data as { access_token: string; token_type: string; expires_in?: number };
}

/**
 * Mark a social_connections row as needing reauth so the UI can prompt.
 */
export async function markConnectionNeedsReauth(
	userId: string,
	provider: string,
	providerAccountId: string,
	errorMessage: string
) {
	const supabase = adminClient();
	await supabase
		.from('social_connections')
		.update({ needs_reauth: true, last_auth_error: errorMessage })
		.eq('user_id', userId)
		.eq('provider', provider)
		.eq('provider_account_id', providerAccountId);
}
