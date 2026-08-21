import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';
import { isClipFinderEnabled } from '$lib/launch-flags';

/**
 * Protect dashboard routes server-side. Settings is reachable while signed out
 * so users can sign in, review legal info, and manage billing after login.
 */
export const load: LayoutServerLoad = async ({ locals, url }) => {
	const { session, user } = await locals.safeGetSession();
	const path = url.pathname.replace(/\/+$/, '') || '/';
	const clipFinderEnabled = isClipFinderEnabled(url.hostname);

	if (!session || !user) {
		if (path === '/dashboard/settings') {
			return { session: null, user: null, clipFinderEnabled };
		}
		const next = encodeURIComponent(url.pathname + url.search);
		throw redirect(303, `/?auth=login&next=${next}`);
	}

	return { session, user, clipFinderEnabled };
};
