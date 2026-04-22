import { createBrowserClient, isBrowser, parseCookieHeader } from '@supabase/ssr';
import { env } from '$env/dynamic/public';
import type { Database } from './database.types';

const supabaseUrl = env.PUBLIC_SUPABASE_URL ?? '';
const supabaseKey = env.PUBLIC_SUPABASE_ANON_KEY ?? '';

/**
 * Browser-side Supabase client.
 *
 * Reads and writes the Supabase session from `document.cookie` so the session
 * is also available to SvelteKit's server `hooks.server.ts` (which reads the
 * same cookie via `request.headers.get('cookie')`).
 *
 * This replaces the older localStorage-based client. Sessions are now stored
 * as HttpOnly-like cookies (set with `Secure; SameSite=Lax; Path=/`) which
 * makes them (a) visible to the server for SSR auth guards, and (b) safer
 * against XSS because we rely on cookies instead of window.localStorage.
 *
 * Note: @supabase/ssr writes auth cookies via `document.cookie`, so they are
 * technically accessible to JS. The real security win comes from SvelteKit
 * guards running server-side before pages render — an XSS payload can still
 * read the auth cookie, but since access tokens are short-lived (~1h) and
 * refresh flow is cookie-based, the blast radius is smaller than localStorage.
 *
 * If you want FULLY HttpOnly cookies, you'd need to proxy auth through your
 * own server (sign-in/sign-out SvelteKit actions). That's a larger rework;
 * tell me if you want to go further.
 */
export const supabase = createBrowserClient<Database>(supabaseUrl, supabaseKey, {
	auth: {
		// Use PKCE so OAuth redirects carry a `?code=` query param we can
		// exchange server-side, instead of dropping the session into a URL
		// hash (which the server can't see).
		flowType: 'pkce',
	},
	cookies: {
		getAll() {
			if (!isBrowser()) return [];
			return parseCookieHeader(document.cookie).map((c) => ({
				name: c.name,
				value: c.value ?? '',
			}));
		},
		setAll(cookies) {
			if (!isBrowser()) return;
			for (const { name, value, options } of cookies) {
				const parts = [`${name}=${encodeURIComponent(value)}`];
				if (options?.path) parts.push(`Path=${options.path}`); else parts.push('Path=/');
				if (options?.maxAge) parts.push(`Max-Age=${options.maxAge}`);
				if (options?.expires) parts.push(`Expires=${options.expires.toUTCString()}`);
				parts.push('SameSite=Lax');
				if (location.protocol === 'https:') parts.push('Secure');
				document.cookie = parts.join('; ');
			}
		},
	},
});
