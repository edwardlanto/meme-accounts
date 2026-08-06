import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { deleteVideoClipProject, getVideoClipProject } from '$lib/server/video-clip-projects';
import type { BulkShow } from '$lib/studio/bulk-to-studio';

export const GET: RequestHandler = async ({ params, locals }) => {
	const { user } = await locals.safeGetSession();
	if (!user) return json({ error: 'Unauthorized' }, { status: 401 });

	const id = String(params.id ?? '').trim();
	if (!id) return json({ error: 'Missing id' }, { status: 400 });

	const row = await getVideoClipProject(user.id, id);
	if (!row) return json({ error: 'Not found' }, { status: 404 });

	return json({
		project: {
			id: row.id,
			title: row.title,
			thumbnailUrl: row.thumbnail_url,
			source: row.source,
			clips: row.clips,
			summary: row.summary,
			demo: row.demo,
			model: row.model,
			bulkShows: row.bulk_shows as BulkShow[] | null,
			updatedAt: row.updated_at,
		},
	});
};

export const DELETE: RequestHandler = async ({ params, locals }) => {
	const { user } = await locals.safeGetSession();
	if (!user) return json({ error: 'Unauthorized' }, { status: 401 });

	const id = String(params.id ?? '').trim();
	if (!id) return json({ error: 'Missing id' }, { status: 400 });

	const existing = await getVideoClipProject(user.id, id);
	if (!existing) return json({ error: 'Not found' }, { status: 404 });

	const ok = await deleteVideoClipProject(user.id, id);
	if (!ok) return json({ error: 'Could not delete' }, { status: 500 });
	return json({ ok: true });
};
