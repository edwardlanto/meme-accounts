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

	const clientId = env.REDDIT_CLIENT_ID ?? '';
	const redirectUri = env.REDDIT_REDIRECT_URI ?? '';

	if (!clientId || !env.REDDIT_CLIENT_SECRET || !redirectUri) {
		throw redirect(303, `${next}?reddit_error=missing_reddit_env`);
	}
	if (!userId) {
		throw redirect(303, `${next}?reddit_error=missing_user`);
	}

	const scope = (env.REDDIT_SCOPES?.trim() || 'identity submit').replace(/\s+/g, ' ');
	const state = randomState();
	cookies.set('reddit_oauth_state', state, cookieOpts);
	cookies.set('reddit_oauth_uid', userId, cookieOpts);
	cookies.set('reddit_oauth_next', next, cookieOpts);

	const authUrl = new URL('https://www.reddit.com/api/v1/authorize');
	authUrl.searchParams.set('client_id', clientId);
	authUrl.searchParams.set('response_type', 'code');
	authUrl.searchParams.set('state', state);
	authUrl.searchParams.set('redirect_uri', redirectUri);
	authUrl.searchParams.set('duration', 'permanent');
	authUrl.searchParams.set('scope', scope);

	throw redirect(303, authUrl.toString());
};

