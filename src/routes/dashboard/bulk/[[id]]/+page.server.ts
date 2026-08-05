import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getBulkWorkspace } from '$lib/server/bulk-workspaces';

const UUID_RE =
	/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const load: PageServerLoad = async ({ params, locals, url }) => {
	const { user } = await locals.safeGetSession();
	// Dashboard layout already requires login; keep a hard stop here.
	if (!user) {
		throw error(401, 'Unauthorized');
	}

	const id = String(params.id ?? '').trim();
	if (!id) {
		return { cloudWorkspace: null as null };
	}

	if (!UUID_RE.test(id)) {
		throw error(404, 'Slideshow not found');
	}

	const row = await getBulkWorkspace(user.id, id);
	if (!row) {
		// Wrong owner or missing — never leak existence to other users
		throw error(404, 'Slideshow not found');
	}

	return {
		cloudWorkspace: {
			id: row.id,
			title: row.title,
			topic: row.topic,
			thumbnailUrl: row.thumbnail_url,
			shows: row.shows,
			selectedShowId: row.selected_show_id,
			clipProjectId: row.clip_project_id,
			updatedAt: row.updated_at,
			url: `${url.pathname}`,
		},
	};
};
