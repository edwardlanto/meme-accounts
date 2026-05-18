import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { dev } from '$app/environment';
import { env } from '$env/dynamic/private';
import { adminClient } from '$lib/server/auth';
import { isZernioConnectPlatform } from '$lib/integrations/zernio-platforms';
import { ensureUserZernioProfile, startZernioConnect } from '$lib/server/zernio-auth';

function randomState() {
	return crypto.randomUUID().replace(/-/g, '');
}

const cookieOpts = {
	path: '/',
	httpOnly: true,
	sameSite: 'lax' as const,
	secure: !dev,
	maxAge: 60 * 15,
};

export const GET: RequestHandler = async ({ url, cookies }) => {
	const userId = url.searchParams.get('userId') ?? '';
	const next = url.searchParams.get('next') ?? '/dashboard/integrations';
	const platform = String(url.searchParams.get('platform') ?? '').toLowerCase();

	const apiKey = env.ZERNIO_API_KEY ?? '';
	const appUrl = env.PUBLIC_APP_URL ?? '';
	if (!apiKey || !appUrl) {
		throw redirect(303, `${next}?zernio_error=${encodeURIComponent('missing_env')}&desc=${encodeURIComponent('Set ZERNIO_API_KEY and PUBLIC_APP_URL')}`);
	}
	if (!userId) {
		throw redirect(303, `${next}?zernio_error=${encodeURIComponent('missing_user')}`);
	}
	if (!isZernioConnectPlatform(platform)) {
		throw redirect(303, `${next}?zernio_error=${encodeURIComponent('bad_platform')}`);
	}

	const state = randomState();
	cookies.set('zernio_oauth_state', state, cookieOpts);
	cookies.set('zernio_oauth_uid', userId, cookieOpts);
	cookies.set('zernio_oauth_next', next, cookieOpts);
	cookies.set('zernio_oauth_platform', platform, cookieOpts);

	const supabase = adminClient();
	const profileId = await ensureUserZernioProfile(supabase, apiKey, userId);
	const authUrl = await startZernioConnect(apiKey, platform, profileId, appUrl);

	throw redirect(303, authUrl);
};
