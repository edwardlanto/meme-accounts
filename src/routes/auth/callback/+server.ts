import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

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
	const next = url.searchParams.get('next') ?? '/dashboard';

	if (code) {
		const { error } = await locals.supabase.auth.exchangeCodeForSession(code);
		if (!error) throw redirect(303, next);
		// Fall through to auth-error redirect with message
		throw redirect(303, `/login?error=${encodeURIComponent(error.message)}`);
	}

	// Old flows that landed here without a code — just send them to login.
	throw redirect(303, '/login?error=missing_code');
};
