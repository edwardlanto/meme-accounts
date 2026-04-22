import { createClient } from '@supabase/supabase-js';
import { env } from '$env/dynamic/private';

/**
 * Validate the Supabase access token sent by the browser in `Authorization: Bearer <jwt>`
 * and return the authenticated user's id. Throws on any failure.
 *
 * Call this at the top of every API route that mutates user-scoped data or talks to
 * third-party APIs using stored tokens.
 */
export async function requireUserId(request: Request): Promise<string> {
	if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_KEY) {
		throw new Error('Server missing SUPABASE_URL or SUPABASE_SERVICE_KEY');
	}
	const header = request.headers.get('authorization') ?? request.headers.get('Authorization') ?? '';
	const m = header.match(/^Bearer\s+(.+)$/i);
	if (!m) {
		const err: any = new Error('Missing Authorization: Bearer <token>');
		err.status = 401;
		throw err;
	}
	const jwt = m[1].trim();

	// Use the service role client to validate the JWT server-side.
	const admin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);
	const { data, error } = await admin.auth.getUser(jwt);
	if (error || !data?.user) {
		const err: any = new Error(error?.message ?? 'Invalid or expired session');
		err.status = 401;
		throw err;
	}
	return data.user.id;
}

/**
 * Get a Supabase admin client. Only use in server code (worker, API routes).
 * This bypasses RLS — always scope queries by the authenticated user's id.
 */
export function adminClient() {
	if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_KEY) {
		throw new Error('Server missing SUPABASE_URL or SUPABASE_SERVICE_KEY');
	}
	return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);
}
