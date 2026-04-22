import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

/**
 * Protect every /dashboard/* route server-side. If there's no validated
 * session, bounce to the landing page.
 */
export const load: LayoutServerLoad = async ({ locals }) => {
	const { session, user } = await locals.safeGetSession();
	if (!session || !user) throw redirect(303, '/');
	return { session, user };
};
