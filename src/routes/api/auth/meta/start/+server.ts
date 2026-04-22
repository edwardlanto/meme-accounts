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

	const appId = env.META_APP_ID ?? '';
	const redirectUri = env.META_REDIRECT_URI ?? '';

	if (!appId || !env.META_APP_SECRET || !redirectUri) {
		throw redirect(303, `/dashboard/settings?integrations=1&error=missing_meta_env`);
	}
	if (!userId) {
		throw redirect(303, `/dashboard/settings?integrations=1&error=missing_user`);
	}

	const state = randomState();
	cookies.set('meta_oauth_state', state, cookieOpts);
	cookies.set('meta_oauth_uid', userId, cookieOpts);
	cookies.set('meta_oauth_next', next, cookieOpts);

	const scope =
		env.META_SCOPES ??
		[
			'public_profile',
			'pages_show_list',
			'pages_manage_posts',
			'pages_read_engagement',
			'instagram_basic',
			'instagram_content_publish',
		].join(',');

	const authUrl = new URL('https://www.facebook.com/v20.0/dialog/oauth');
	authUrl.searchParams.set('client_id', appId);
	authUrl.searchParams.set('redirect_uri', redirectUri);
	authUrl.searchParams.set('state', state);
	authUrl.searchParams.set('response_type', 'code');
	authUrl.searchParams.set('scope', scope);

	throw redirect(303, authUrl.toString());
};

