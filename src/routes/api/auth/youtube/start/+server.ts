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

	const clientId = env.YOUTUBE_CLIENT_ID ?? '';
	const redirectUri = env.YOUTUBE_REDIRECT_URI ?? '';

	if (!clientId || !env.YOUTUBE_CLIENT_SECRET || !redirectUri) {
		throw redirect(303, `${next}?youtube_error=missing_youtube_env`);
	}
	if (!userId) {
		throw redirect(303, `${next}?youtube_error=missing_user`);
	}

	const state = randomState();
	cookies.set('youtube_oauth_state', state, cookieOpts);
	cookies.set('youtube_oauth_uid', userId, cookieOpts);
	cookies.set('youtube_oauth_next', next, cookieOpts);

	const scope =
		(env.YOUTUBE_SCOPES ?? '').trim() ||
		[
			'https://www.googleapis.com/auth/youtube.upload',
			// Useful for labeling
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
	authUrl.searchParams.set('prompt', 'consent');
	authUrl.searchParams.set('include_granted_scopes', 'true');

	throw redirect(303, authUrl.toString());
};

