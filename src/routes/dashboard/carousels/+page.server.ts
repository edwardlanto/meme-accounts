import type { PageServerLoad } from './$types';
import { loadCarouselLibrary } from '$lib/server/library-list';

export const load: PageServerLoad = async ({ locals }) => {
	const { user } = await locals.safeGetSession();
	if (!user) {
		return {
			carousels: [],
			studioDrafts: [],
			studioSavedTemplates: [],
			bulkWorkspaces: [],
		};
	}
	return loadCarouselLibrary(user.id);
};
