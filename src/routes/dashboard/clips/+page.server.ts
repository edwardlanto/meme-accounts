import type { PageServerLoad } from './$types';
import { loadClipsLibrary } from '$lib/server/library-list';

export const load: PageServerLoad = async ({ locals }) => {
	const { user } = await locals.safeGetSession();
	if (!user) {
		return {
			bulkWorkspaces: [],
			clipProjects: [],
		};
	}
	return loadClipsLibrary(user.id);
};
