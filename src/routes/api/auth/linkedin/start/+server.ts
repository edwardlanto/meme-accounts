import { redirect } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import type { RequestHandler } from './$types';

function randomState() {
	return crypto.randomUUID().replace(/-/g, '');
}

type Mode = 'member' | 'org' | 'both';

function scopesForMode(mode: Mode) {
	// LinkedIn expects scopes space-delimited.
	// Default to the union (works for both buttons if the app has those products enabled).
	const defaultBoth = ['r_liteprofile', 'w_member_social', 'r_organization_social', 'w_organization_social'];
	const memberOnly = ['r_liteprofile', 'w_member_social'];
	const orgOnly = ['r_liteprofile', 'r_organization_social', 'w_organization_social'];

	const fromEnv = (env.LINKEDIN_SCOPES ?? '').trim();
	if (fromEnv) return fromEnv;

	if (mode === 'member') return memberOnly.join(' ');
	if (mode === 'org') return orgOnly.join(' ');
	return defaultBoth.join(' ');
}

export const GET: RequestHandler = async ({ url, cookies }) => {
	const userId = url.searchParams.get('userId') ?? '';
	const next = url.searchParams.get('next') ?? '/dashboard/post-scheduler';
	const mode = ((url.searchParams.get('mode') ?? 'both') as Mode) || 'both';

	const clientId = env.LINKEDIN_CLIENT_ID ?? '';
	const redirectUri = env.LINKEDIN_REDIRECT_URI ?? '';

	if (!clientId || !env.LINKEDIN_CLIENT_SECRET || !redirectUri) {
		throw redirect(303, `/dashboard/settings?integrations=1&error=missing_linkedin_env#linkedin`);
	}
	if (!userId) {
		throw redirect(303, `/dashboard/settings?integrations=1&error=missing_user#linkedin`);
	}

	const state = randomState();
	cookies.set('linkedin_oauth_state', state, {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		secure: false,
		maxAge: 60 * 10,
	});
	cookies.set('linkedin_oauth_uid', userId, {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		secure: false,
		maxAge: 60 * 10,
	});
	cookies.set('linkedin_oauth_next', next, {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		secure: false,
		maxAge: 60 * 10,
	});
	cookies.set('linkedin_oauth_mode', mode, {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		secure: false,
		maxAge: 60 * 10,
	});

	const authUrl = new URL('https://www.linkedin.com/oauth/v2/authorization');
	authUrl.searchParams.set('response_type', 'code');
	authUrl.searchParams.set('client_id', clientId);
	authUrl.searchParams.set('redirect_uri', redirectUri);
	authUrl.searchParams.set('state', state);
	authUrl.searchParams.set('scope', scopesForMode(mode));

	throw redirect(303, authUrl.toString());
};

