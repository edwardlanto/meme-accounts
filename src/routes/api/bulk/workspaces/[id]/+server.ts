import { json } from '@sveltejs/kit';
import { z } from 'zod';
import type { RequestHandler } from './$types';
import { parseJsonBody } from '$lib/server/request-security';
import {
	deleteBulkWorkspace,
	getBulkWorkspace,
	saveBulkWorkspaceRow,
} from '$lib/server/bulk-workspaces';
import type { BulkShow } from '$lib/studio/bulk-to-studio';

const patchSchema = z.object({
	title: z.string().max(500).optional(),
	topic: z.string().max(500).optional(),
	thumbnailUrl: z.string().max(2000).nullable().optional(),
	shows: z.array(z.record(z.string(), z.unknown())).min(1).max(24).optional(),
	selectedShowId: z.string().max(80).nullable().optional(),
	clipProjectId: z.string().uuid().nullable().optional(),
});

export const GET: RequestHandler = async ({ params, locals }) => {
	const { user } = await locals.safeGetSession();
	if (!user) return json({ error: 'Unauthorized' }, { status: 401 });

	const id = String(params.id ?? '').trim();
	if (!id) return json({ error: 'Missing id' }, { status: 400 });

	const row = await getBulkWorkspace(user.id, id);
	if (!row) return json({ error: 'Not found' }, { status: 404 });

	return json({
		workspace: {
			id: row.id,
			title: row.title,
			topic: row.topic,
			thumbnailUrl: row.thumbnail_url,
			shows: row.shows,
			selectedShowId: row.selected_show_id,
			clipProjectId: row.clip_project_id,
			updatedAt: row.updated_at,
			url: `/dashboard/bulk/${row.id}`,
		},
	});
};

export const PATCH: RequestHandler = async ({ params, request, locals }) => {
	const { user } = await locals.safeGetSession();
	if (!user) return json({ error: 'Unauthorized' }, { status: 401 });

	const id = String(params.id ?? '').trim();
	if (!id) return json({ error: 'Missing id' }, { status: 400 });

	const existing = await getBulkWorkspace(user.id, id);
	if (!existing) return json({ error: 'Not found' }, { status: 404 });

	const parsed = await parseJsonBody(request, patchSchema, 2_000_000);
	if (!parsed.ok) return json({ error: parsed.error }, { status: parsed.status });

	const data = parsed.data;
	const shows = (data.shows as unknown as BulkShow[] | undefined) ?? existing.shows;
	const saved = await saveBulkWorkspaceRow(
		user.id,
		{
			title: data.title ?? existing.title,
			topic: data.topic ?? existing.topic,
			thumbnailUrl: data.thumbnailUrl === undefined ? existing.thumbnail_url : data.thumbnailUrl,
			shows,
			selectedShowId:
				data.selectedShowId === undefined ? existing.selected_show_id : data.selectedShowId,
			clipProjectId:
				data.clipProjectId === undefined ? existing.clip_project_id : data.clipProjectId,
		},
		{ id },
	);

	if (!saved) return json({ error: 'Could not update workspace' }, { status: 500 });
	return json({ ok: true, id: saved, url: `/dashboard/bulk/${saved}` });
};

export const DELETE: RequestHandler = async ({ params, locals }) => {
	const { user } = await locals.safeGetSession();
	if (!user) return json({ error: 'Unauthorized' }, { status: 401 });

	const id = String(params.id ?? '').trim();
	if (!id) return json({ error: 'Missing id' }, { status: 400 });

	const existing = await getBulkWorkspace(user.id, id);
	if (!existing) return json({ error: 'Not found' }, { status: 404 });

	const ok = await deleteBulkWorkspace(user.id, id);
	if (!ok) return json({ error: 'Could not delete' }, { status: 500 });
	return json({ ok: true });
};
