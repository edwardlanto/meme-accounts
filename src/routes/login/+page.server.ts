import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { authModalHref, safeAuthNext } from '$lib/auth-modal';

export const load: PageServerLoad = async ({ locals, url }) => {
	const next = safeAuthNext(url.searchParams.get('next'));
	const { session } = await locals.safeGetSession();
	if (session) throw redirect(303, next);
	const err = url.searchParams.get('error');
	const href = authModalHref('login', next);
	throw redirect(303, err ? `${href}&error=${encodeURIComponent(err)}` : href);
};
