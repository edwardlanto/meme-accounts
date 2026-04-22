import { env } from '$env/dynamic/private';
import { adminClient } from './auth';

/**
 * Refresh a Google OAuth access token using a stored refresh_token.
 * Returns the new access token (and its expiry). Persists to Supabase.
 */
export async function refreshGoogleAccessToken(opts: {
	userId: string;
	provider: 'gmb';
	providerAccountId: string;
	refreshToken: string;
}) {
	const clientId = env.GMB_CLIENT_ID ?? env.GOOGLE_CLIENT_ID ?? '';
	const clientSecret = env.GMB_CLIENT_SECRET ?? env.GOOGLE_CLIENT_SECRET ?? '';
	if (!clientId || !clientSecret) throw new Error('Missing GMB_CLIENT_ID or GMB_CLIENT_SECRET');

	const body = new URLSearchParams({
		client_id: clientId,
		client_secret: clientSecret,
		grant_type: 'refresh_token',
		refresh_token: opts.refreshToken,
	});
	const res = await fetch('https://oauth2.googleapis.com/token', {
		method: 'POST',
		headers: { 'content-type': 'application/x-www-form-urlencoded' },
		body,
	});
	const data = await res.json();
	if (!res.ok) throw new Error(data?.error_description ?? data?.error ?? 'Google token refresh failed');

	const accessToken = String(data.access_token ?? '');
	const expiresAt = typeof data.expires_in === 'number' ? new Date(Date.now() + data.expires_in * 1000).toISOString() : null;

	const supabase = adminClient();
	await supabase
		.from('social_connections')
		.update({ access_token: accessToken, expires_at: expiresAt, needs_reauth: false, last_auth_error: null })
		.eq('user_id', opts.userId)
		.eq('provider', opts.provider)
		.eq('provider_account_id', opts.providerAccountId);

	return { accessToken, expiresAt };
}

/**
 * Get a valid Google access token for a connection, refreshing if expired.
 * Call from the worker before making a Google API request.
 */
export async function getFreshGoogleAccessToken(connection: {
	user_id: string;
	provider: string;
	provider_account_id: string;
	access_token: string | null;
	refresh_token: string | null;
	expires_at: string | null;
}): Promise<string> {
	const now = Date.now();
	const exp = connection.expires_at ? new Date(connection.expires_at).getTime() : 0;
	// 60s leeway
	const isExpired = !exp || exp - now < 60_000;

	if (!isExpired && connection.access_token) return connection.access_token;

	if (!connection.refresh_token) {
		throw new Error('Google access token expired and no refresh_token available — user must reconnect.');
	}
	const { accessToken } = await refreshGoogleAccessToken({
		userId: connection.user_id,
		provider: connection.provider as 'gmb',
		providerAccountId: connection.provider_account_id,
		refreshToken: connection.refresh_token,
	});
	return accessToken;
}
