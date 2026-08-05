import { json } from '@sveltejs/kit';
import { dev } from '$app/environment';
import type { RequestHandler } from './$types';
import { adminClient, requireUserId } from '$lib/server/auth';

/**
 * Debug endpoint: calls the Meta Graph API with the authenticated user's stored
 * token(s) and dumps exactly what Meta sees. Use this to diagnose "IG not
 * detected" issues.
 *
 * Returns:
 * {
 *   ok, userId,
 *   connections: [
 *     {
 *       providerAccountId,                // raw id stored in social_connections
 *       label,                            // human label
 *       metaKind,                         // 'facebook_page' | 'instagram_business' | 'meta' | ...
 *       expiresAt,
 *       scopesStored,                     // scopes as we stored them
 *       scopesFromGraph,                  // scopes Meta currently reports via /debug_token
 *       me: { id, name } | error,
 *       pages: [
 *         {
 *           id, name, accessTokenPresent, category, tasks,
 *           igBusiness: { id, username, account_type } | null,
 *           igConnected: { id, username, account_type } | null,
 *           igError: string | null
 *         }
 *       ]
 *     }
 *   ]
 * }
 */

const GRAPH = 'https://graph.facebook.com/v20.0';

async function safeGet(path: string, token: string): Promise<any> {
	try {
		const url = `${GRAPH}/${path}${path.includes('?') ? '&' : '?'}access_token=${encodeURIComponent(token)}`;
		const res = await fetch(url);
		const data = await res.json().catch(() => ({}));
		if (!res.ok) return { __error: data?.error?.message ?? `HTTP ${res.status}`, __status: res.status, __raw: data };
		return data;
	} catch (e: any) {
		return { __error: e?.message ?? 'fetch failed' };
	}
}

export const GET: RequestHandler = async ({ request }) => {
	if (!dev) return json({ ok: false, error: 'Not found' }, { status: 404 });

	let userId: string;
	try {
		userId = await requireUserId(request);
	} catch (e: any) {
		return json({ ok: false, error: e?.message ?? 'Unauthorized' }, { status: e?.status ?? 401 });
	}

	const supabase = adminClient();
	const { data: conns, error: connErr } = await supabase
		.from('social_connections')
		.select('provider,provider_account_id,provider_account_label,access_token,expires_at,scopes,meta')
		.eq('user_id', userId)
		.eq('provider', 'meta');

	if (connErr) return json({ ok: false, error: connErr.message }, { status: 500 });

	const out: any[] = [];

	for (const c of (conns ?? []) as any[]) {
		const token = String(c.access_token ?? '');
		const row: any = {
			providerAccountId: c.provider_account_id,
			label: c.provider_account_label,
			metaKind: c.meta?.kind ?? null,
			expiresAt: c.expires_at,
			scopesStored: c.scopes ?? [],
		};

		if (!token) {
			row.error = 'No access_token stored';
			out.push(row);
			continue;
		}

		// 1. /me — confirm which FB user this token is for
		const me = await safeGet('me?fields=id,name', token);
		row.me = me.__error ? { error: me.__error } : { id: me.id, name: me.name };

		// 2. /debug_token — what scopes does Meta think this token has right now?
		//    Requires app access token or the same token. Try the same-token shortcut.
		const dbg = await safeGet(`debug_token?input_token=${encodeURIComponent(token)}`, token);
		const gscopes = dbg?.data?.scopes ?? dbg?.__raw?.data?.scopes ?? null;
		row.scopesFromGraph = gscopes;
		row.tokenIsValid = dbg?.data?.is_valid ?? null;
		if (dbg.__error && !gscopes) row.debugTokenError = dbg.__error;

		// 3. /me/accounts — the pages list. If this is empty, the user didn't grant
		//    any pages during OAuth (or has no pages).
		const pages = await safeGet('me/accounts?fields=id,name,category,tasks,access_token', token);
		if (pages.__error) {
			row.pagesError = pages.__error;
			row.pages = [];
		} else {
			const rows: any[] = [];
			for (const p of pages.data ?? []) {
				const pageToken = p.access_token ?? token;
				// 4. For each page, check both IG fields (Business vs Connected).
				const ig = await safeGet(
					`${p.id}?fields=instagram_business_account{id,username,account_type},connected_instagram_account{id,username,account_type}`,
					pageToken
				);
				rows.push({
					id: p.id,
					name: p.name,
					category: p.category ?? null,
					tasks: p.tasks ?? [],
					accessTokenPresent: Boolean(p.access_token),
					igBusiness: ig?.instagram_business_account ?? null,
					igConnected: ig?.connected_instagram_account ?? null,
					igError: ig?.__error ?? null,
				});
			}
			row.pages = rows;
			row.pagesCount = rows.length;
			row.pagesWithIg = rows.filter((r) => r.igBusiness || r.igConnected).length;
		}

		out.push(row);
	}

	// Write a short hint based on what we found.
	let hint = '';
	const flat = out.flatMap((r) => r.pages ?? []);
	if (out.length === 0) hint = 'No meta connection stored. Click Connect Meta first.';
	else if (out.every((r) => !r.pages || r.pages.length === 0))
		hint = 'Your Facebook user has no Pages attached to this app grant. During OAuth you likely did not tick any Pages on the "Which Pages?" screen. Remove the app from facebook.com/settings?tab=applications and reconnect — make sure to tick the Page.';
	else if (flat.every((p: any) => !p.igBusiness && !p.igConnected))
		hint = 'Pages were returned but none of them have an Instagram Business/Creator account linked. Open the Instagram mobile app → Settings → Account → Sharing to other apps → Facebook → link to the correct Page. Also confirm IG is switched to Business or Creator (not Personal).';
	else hint = 'Looks good — at least one Page has an IG account linked. If the UI still says "no IG connection detected", your stored connection rows may be stale. Try Connect Meta again to refresh.';

	return json({ ok: true, userId, hint, connections: out });
};
