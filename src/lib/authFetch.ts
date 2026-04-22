import { supabase } from './supabase';

/**
 * Wrapper around fetch that attaches the current Supabase access token
 * as a Bearer Authorization header. Use for all calls to our own
 * authenticated API routes (scheduler, publish, etc).
 */
export async function authFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
	const { data } = await supabase.auth.getSession();
	const token = data.session?.access_token;
	const headers = new Headers(init.headers ?? {});
	if (token) headers.set('Authorization', `Bearer ${token}`);
	if (init.body && !headers.has('content-type') && typeof init.body === 'string') {
		headers.set('content-type', 'application/json');
	}
	return fetch(input, { ...init, headers });
}
