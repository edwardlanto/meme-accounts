import { createServerClient } from '@supabase/ssr';
import type { Handle } from '@sveltejs/kit';
import { env as publicEnv } from '$env/dynamic/public';
import { apiRateLimitKey, checkRateLimit, RATE_LIMITS } from '$lib/server/rate-limit';

/**
 * Attach a per-request Supabase server client + a cached `safeGetSession`
 * helper to `event.locals` so every `+layout.server.ts` / `+page.server.ts`
 * can read the authenticated user without re-parsing cookies.
 *
 * `safeGetSession()` validates the access token with `auth.getUser()` because
 * `supabase.auth.getSession()` trusts whatever the cookie says — a malicious
 * cookie value could forge a session otherwise. Calling `getUser()` forces a
 * round-trip to Supabase's Auth server to verify the JWT signature + expiry,
 * then we trust the session.
 */
export const handle: Handle = async ({ event, resolve }) => {
	const supabaseUrl = publicEnv.PUBLIC_SUPABASE_URL ?? '';
	const supabaseKey = publicEnv.PUBLIC_SUPABASE_ANON_KEY ?? '';

	event.locals.supabase = createServerClient(supabaseUrl, supabaseKey, {
		cookies: {
			getAll: () => event.cookies.getAll(),
			setAll: (cookiesToSet) => {
				for (const { name, value, options } of cookiesToSet) {
					event.cookies.set(name, value, {
						...options,
						path: options?.path ?? '/',
						// Harden cookie flags for anything Supabase sets.
						httpOnly: false, // supabase-js needs to read this on the client too
						sameSite: options?.sameSite ?? 'lax',
						secure: event.url.protocol === 'https:',
					});
				}
			},
		},
	});

	event.locals.safeGetSession = async () => {
		// Call getUser() first — it hits Supabase Auth and validates the JWT,
		// so the returned user is guaranteed authentic. Then pair it with the
		// session token info (but overwrite .user with the validated one) so
		// downstream consumers never read the unvalidated user from the cookie.
		const {
			data: { user },
			error,
		} = await event.locals.supabase.auth.getUser();
		if (error || !user) return { session: null, user: null };

		const {
			data: { session },
		} = await event.locals.supabase.auth.getSession();
		if (!session) return { session: null, user: null };

		return { session: { ...session, user }, user };
	};

	if (event.url.pathname.startsWith('/api/')) {
		const kind = apiRateLimitKey(event.url.pathname);
		const { max, windowMs } = RATE_LIMITS[kind];
		const ip = event.getClientAddress();
		const { user } = await event.locals.safeGetSession();
		const rlKey = user ? `user:${user.id}:${kind}` : `ip:${ip}:${kind}`;
		const rl = checkRateLimit(rlKey, max, windowMs);
		if (!rl.ok) {
			return new Response(JSON.stringify({ error: 'Too many requests', code: 'rate_limited' }), {
				status: 429,
				headers: {
					'Content-Type': 'application/json',
					'Retry-After': String(rl.retryAfterSec),
				},
			});
		}
		// Unauthenticated callers get a tighter AI cap (auth still required on most AI routes).
		if (kind === 'ai' && !user) {
			const anon = checkRateLimit(`ip:${ip}:aiAnon`, 6, 60_000);
			if (!anon.ok) {
				return new Response(JSON.stringify({ error: 'Too many requests', code: 'rate_limited' }), {
					status: 429,
					headers: {
						'Content-Type': 'application/json',
						'Retry-After': String(anon.retryAfterSec),
					},
				});
			}
		}
	}

	const response = await resolve(event, {
		// Let SvelteKit forward any `set-cookie` headers Supabase wrote during
		// token refresh.
		filterSerializedResponseHeaders: (name) => name === 'content-range' || name === 'x-supabase-auth',
	});
	// Baseline hardening (does not replace handler-level auth / validation).
	response.headers.set('X-Content-Type-Options', 'nosniff');
	response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
	response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
	return response;
};
