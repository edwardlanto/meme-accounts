import { json } from '@sveltejs/kit';
import { z } from 'zod';
import type { RequestHandler } from './$types';
import { parseJsonBody } from '$lib/server/request-security';
import {
	listBulkWorkspaces,
	saveBulkWorkspaceRow,
} from '$lib/server/bulk-workspaces';
import type { BulkShow } from '$lib/studio/bulk-to-studio';

const upsertSchema = z.object({
	id: z.string().uuid().optional(),
	title: z.string().max(500).optional(),
	topic: z.string().max(500).optional(),
	thumbnailUrl: z.string().max(2000).nullable().optional(),
	shows: z.array(z.record(z.string(), z.unknown())).min(1).max(24),
	selectedShowId: z.string().max(80).nullable().optional(),
	clipProjectId: z.string().uuid().nullable().optional(),
});

export const GET: RequestHandler = async ({ locals }) => {
	const { user } = await locals.safeGetSession();
	if (!user) return json({ error: 'Unauthorized' }, { status: 401 });

	const rows = await listBulkWorkspaces(user.id, 24);
	return json({
		workspaces: rows.map((r) => ({
			id: r.id,
			title: r.title,
			topic: r.topic,
			thumbnailUrl: r.thumbnail_url,
			showCount: Array.isArray(r.shows) ? r.shows.length : 0,
			titles: Array.isArray(r.shows)
				? (r.shows as BulkShow[]).slice(0, 4).map((s) => s.title || 'Untitled')
				: [],
			updatedAt: r.updated_at,
			url: `/dashboard/bulk/${r.id}`,
		})),
	});
};

export const POST: RequestHandler = async ({ request, locals }) => {
	const { user } = await locals.safeGetSession();
	if (!user) return json({ error: 'Unauthorized' }, { status: 401 });

	const parsed = await parseJsonBody(request, upsertSchema, 2_000_000);
	if (!parsed.ok) return json({ error: parsed.error }, { status: parsed.status });

	const data = parsed.data;
	const id = await saveBulkWorkspaceRow(
		user.id,
		{
			title: data.title,
			topic: data.topic,
			thumbnailUrl: data.thumbnailUrl,
			shows: data.shows as unknown as BulkShow[],
			selectedShowId: data.selectedShowId,
			clipProjectId: data.clipProjectId,
		},
		{ id: data.id },
	);

	if (!id) return json({ error: 'Could not save workspace' }, { status: 500 });
	return json({ ok: true, id, url: `/dashboard/bulk/${id}` });
};
