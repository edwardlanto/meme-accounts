import { redirect } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { dev } from '$app/environment';
import type { RequestHandler } from './$types';

/**
 * TikTok OAuth 2.0 start.
 *
 * Works in "sandbox" mode (no app audit required) as long as:
 *   - Your account is added as a sandbox tester in the TikTok Developer Portal.
 *   - The redirect URI matches exactly (must be HTTPS — use ngrok locally).
 *   - You only request scopes available pre-audit.
 *
 * Scopes we request by default:
 *   - user.info.basic           (always granted; lets us fetch open_id + display name)
 *   - video.upload              (pre-audit OK; uploads videos to user's DRAFTS INBOX)
 *
 * To publish directly to a public profile you need `video.publish` and must pass
 * TikTok's audit. Without it, users open the TikTok app and tap "Post" to finish.
 */

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
	const next = url.searchParams.get('next') ?? '/dashboard/post-tests';

	const clientKey = env.TIKTOK_CLIENT_KEY ?? '';
	const redirectUri = env.TIKTOK_REDIRECT_URI ?? '';

	if (!clientKey || !env.TIKTOK_CLIENT_SECRET || !redirectUri) {
		throw redirect(303, `${next}?tiktok_error=missing_tiktok_env`);
	}
	if (!userId) {
		throw redirect(303, `${next}?tiktok_error=missing_user`);
	}

	// Allow callers to override scopes (e.g. once you get video.publish approved).
	const scopes = (env.TIKTOK_SCOPES?.trim() || 'user.info.basic,video.upload').replace(/\s+/g, '');

	const state = randomState();
	cookies.set('tiktok_oauth_state', state, cookieOpts);
	cookies.set('tiktok_oauth_uid', userId, cookieOpts);
	cookies.set('tiktok_oauth_next', next, cookieOpts);

	const authUrl = new URL('https://www.tiktok.com/v2/auth/authorize/');
	authUrl.searchParams.set('client_key', clientKey);
	authUrl.searchParams.set('response_type', 'code');
	authUrl.searchParams.set('scope', scopes);
	authUrl.searchParams.set('redirect_uri', redirectUri);
	authUrl.searchParams.set('state', state);

	throw redirect(303, authUrl.toString());
};
