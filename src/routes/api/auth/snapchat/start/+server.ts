import { redirect } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { dev } from '$app/environment';
import type { RequestHandler } from './$types';

function randomState() {
	return crypto.randomUUID().replace(/-/g, '');
}

const cookieOpts = {
	path: '/',
	httpOnly: true,
	sameSite: 'lax' as const,
	secure: !dev,
	maxAge: 60 * 10,
};

export const GET: RequestHandler = async ({ url, cookies }) => {
	const userId = url.searchParams.get('userId') ?? '';
	const next = url.searchParams.get('next') ?? '/dashboard/post-scheduler';

	const clientId = env.SNAPCHAT_CLIENT_ID ?? '';
	const redirectUri = env.SNAPCHAT_REDIRECT_URI ?? '';

	if (!clientId || !env.SNAPCHAT_CLIENT_SECRET || !redirectUri) {
		throw redirect(303, `${next}?snapchat_error=missing_snapchat_env`);
	}
	if (!userId) {
		throw redirect(303, `${next}?snapchat_error=missing_user`);
	}

	// Default to Public Profile API scope. Note: API access is allowlist-only.
	const scope = (env.SNAPCHAT_SCOPES?.trim() || 'snapchat-profile-api').replace(/\s+/g, ' ');

	const state = randomState();
	cookies.set('snapchat_oauth_state', state, cookieOpts);
	cookies.set('snapchat_oauth_uid', userId, cookieOpts);
	cookies.set('snapchat_oauth_next', next, cookieOpts);

	const authUrl = new URL('https://accounts.snapchat.com/login/oauth2/authorize');
	authUrl.searchParams.set('client_id', clientId);
	authUrl.searchParams.set('redirect_uri', redirectUri);
	authUrl.searchParams.set('response_type', 'code');
	authUrl.searchParams.set('scope', scope);
	authUrl.searchParams.set('state', state);

	throw redirect(303, authUrl.toString());
};

