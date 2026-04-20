import { redirect } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import type { RequestHandler } from './$types';

function randomState() {
	return crypto.randomUUID().replace(/-/g, '');
}

export const GET: RequestHandler = async ({ url, cookies }) => {
	const userId = url.searchParams.get('userId') ?? '';
	const next = url.searchParams.get('next') ?? '/dashboard/post-scheduler';

	const clientId = env.GMB_CLIENT_ID ?? '';
	const redirectUri = env.GMB_REDIRECT_URI ?? '';

	if (!clientId || !env.GMB_CLIENT_SECRET || !redirectUri) {
		throw redirect(303, `/dashboard/settings?integrations=1&error=missing_gmb_env#gmb`);
	}
	if (!userId) {
		throw redirect(303, `/dashboard/settings?integrations=1&error=missing_user#gmb`);
	}

	const state = randomState();
	cookies.set('gmb_oauth_state', state, {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		secure: false,
		maxAge: 60 * 10,
	});
	cookies.set('gmb_oauth_uid', userId, {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		secure: false,
		maxAge: 60 * 10,
	});
	cookies.set('gmb_oauth_next', next, {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		secure: false,
		maxAge: 60 * 10,
	});

	const scope =
		(env.GMB_SCOPES ?? '').trim() ||
		[
			'https://www.googleapis.com/auth/business.manage',
			// Useful for labeling + avoiding "unknown account" UX
			'openid',
			'email',
			'profile',
		].join(' ');

	const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
	authUrl.searchParams.set('client_id', clientId);
	authUrl.searchParams.set('redirect_uri', redirectUri);
	authUrl.searchParams.set('response_type', 'code');
	authUrl.searchParams.set('scope', scope);
	authUrl.searchParams.set('state', state);
	authUrl.searchParams.set('access_type', 'offline');
	authUrl.searchParams.set('prompt', 'consent'); // ensures refresh_token on first connect
	authUrl.searchParams.set('include_granted_scopes', 'true');

	throw redirect(303, authUrl.toString());
};

