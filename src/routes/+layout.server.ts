import type { LayoutServerLoad } from './$types';

/**
 * Expose the (validated) session + user to every page.
 * Safe to destructure as `data.session` / `data.user` in any +page.svelte.
 */
export const load: LayoutServerLoad = async ({ locals }) => {
	const { session, user } = await locals.safeGetSession();
	return { session, user };
};
