import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { isClipFinderEnabled } from '$lib/launch-flags';
import { loadClipsLibrary } from '$lib/server/library-list';

export const load: PageServerLoad = async ({ locals, url }) => {
	if (!isClipFinderEnabled(url.hostname)) redirect(302, '/dashboard');
	const { user } = await locals.safeGetSession();
	if (!user) {
		return {
			bulkWorkspaces: [],
			clipProjects: [],
		};
	}
	return loadClipsLibrary(user.id);
};
