import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { adminClient } from '$lib/server/auth';

function safeNext(raw: string | null): string {
	if (!raw || !raw.startsWith('/') || raw.startsWith('//')) return '/dashboard';
	return raw;
}

/**
 * OAuth callback endpoint.
 *
 * Supabase sends the browser here with `?code=...` after Google (or any other
 * provider) finishes. We exchange the code for a session server-side, which
 * writes the auth cookies via the hooks-provided cookie adapter, and then
 * redirect to the final destination.
 */
export const GET: RequestHandler = async ({ url, locals }) => {
	const code = url.searchParams.get('code');
	const next = safeNext(url.searchParams.get('next'));
	const marketingParam = url.searchParams.get('marketing_emails');

	if (code) {
		const { error } = await locals.supabase.auth.exchangeCodeForSession(code);
		if (!error) {
			if (marketingParam === '0' || marketingParam === '1') {
				const optedIn = marketingParam === '1';
				const {
					data: { user },
				} = await locals.supabase.auth.getUser();
				if (user?.id) {
					try {
						const admin = adminClient();
						await admin
							.from('users')
							.update({
								marketing_emails: optedIn,
								updated_at: new Date().toISOString(),
							})
							.eq('id', user.id);
						await admin.auth.admin.updateUserById(user.id, {
							user_metadata: {
								...user.user_metadata,
								marketing_emails: optedIn,
							},
						});
					} catch (e) {
						console.error('[auth/callback] marketing_emails sync failed', e);
					}
				}
			}
			throw redirect(303, next);
		}
		// Fall through to auth-error redirect with message
		throw redirect(303, `/?auth=login&error=${encodeURIComponent(error.message)}`);
	}

	// Old flows that landed here without a code — just send them to login.
	throw redirect(303, '/?auth=login&error=missing_code');
};
