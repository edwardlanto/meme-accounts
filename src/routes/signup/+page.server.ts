import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { authModalHref, safeAuthNext } from '$lib/auth-modal';

export const load: PageServerLoad = async ({ locals, url }) => {
	const next = safeAuthNext(url.searchParams.get('next'));
	const { session } = await locals.safeGetSession();
	if (session) throw redirect(303, next);
	throw redirect(303, authModalHref('signup', next));
};
