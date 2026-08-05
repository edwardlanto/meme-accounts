import { json } from '@sveltejs/kit';
import { z } from 'zod';
import type { RequestHandler } from './$types';
import { parseJsonBody } from '$lib/server/request-security';
import {
	listVideoClipProjects,
	saveVideoClipProject,
	getVideoClipProject,
} from '$lib/server/video-clip-projects';

const upsertSchema = z.object({
	id: z.string().uuid().optional(),
	title: z.string().max(500).optional(),
	thumbnailUrl: z.string().max(2000).optional(),
	source: z.record(z.unknown()),
	clips: z.array(z.record(z.unknown())),
	summary: z.string().max(8000).optional(),
	demo: z.boolean().optional(),
	model: z.string().max(120).optional(),
	bulkShows: z.unknown().optional(),
});

export const GET: RequestHandler = async ({ locals }) => {
	const { user } = await locals.safeGetSession();
	if (!user) return json({ error: 'Unauthorized' }, { status: 401 });
	const projects = await listVideoClipProjects(user.id, 12);
	return json({
		projects: projects.map((p) => ({
			id: p.id,
			title: p.title,
			thumbnailUrl: p.thumbnail_url,
			clipCount: Array.isArray(p.clips) ? p.clips.length : 0,
			summary: p.summary,
			updatedAt: p.updated_at,
			hasBulkShows: !!p.bulk_shows,
		})),
	});
};

export const POST: RequestHandler = async ({ request, locals }) => {
	const { user } = await locals.safeGetSession();
	if (!user) return json({ error: 'Unauthorized' }, { status: 401 });

	const parsed = await parseJsonBody(request, upsertSchema, 2_000_000);
	if (!parsed.ok) return json({ error: parsed.error }, { status: parsed.status });

	const data = parsed.data;
	const source = data.source as import('$lib/video-clips/types').VideoImportMeta;
	const clips = data.clips as import('$lib/video-clips/types').VideoClip[];

	const projectId = await saveVideoClipProject(user.id, {
		title: data.title ?? source?.title ?? 'Video clips',
		thumbnailUrl: data.thumbnailUrl ?? source?.thumbnailUrl,
		source,
		clips,
		summary: data.summary ?? '',
		demo: data.demo ?? false,
		model: data.model ?? '',
		bulkShows: data.bulkShows,
	}, { id: data.id });

	if (!projectId) return json({ error: 'Could not save project' }, { status: 500 });
	return json({ ok: true, projectId });
};
