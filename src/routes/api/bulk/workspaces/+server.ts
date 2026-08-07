import { json } from '@sveltejs/kit';
import { z } from 'zod';
import type { RequestHandler } from './$types';
import { parseJsonBody } from '$lib/server/request-security';
import {
	listBulkWorkspaces,
	saveBulkWorkspaceRow,
} from '$lib/server/bulk-workspaces';
import { slimBulkCoverSlide, type BulkShow } from '$lib/studio/bulk-to-studio';

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

	const rows = await listBulkWorkspaces(user.id, 48);
	return json({
		workspaces: rows.map((r) => {
			const shows = Array.isArray(r.shows) ? (r.shows as BulkShow[]) : [];
			const workspaceThumb = String(r.thumbnail_url ?? '').trim();
			const safeWorkspaceThumb =
				workspaceThumb &&
				!workspaceThumb.startsWith('blob:') &&
				workspaceThumb.length < 2000 &&
				!/\.(mp4|webm|mov)(\?|$)/i.test(workspaceThumb)
					? workspaceThumb
					: '';
			return {
				id: r.id,
				title: r.title,
				topic: r.topic,
				thumbnailUrl: r.thumbnail_url,
				clipProjectId: r.clip_project_id,
				fromVideoClips: shows.some((s) => !!s.fromVideoClips) || !!r.clip_project_id,
				showCount: shows.length,
				titles: shows.slice(0, 4).map((s) => s.title || 'Untitled'),
				updatedAt: r.updated_at,
				url: `/dashboard/bulk/${r.id}`,
				shows: shows.slice(0, 24).map((s) => {
					const slides = Array.isArray(s.slides) ? s.slides : [];
					const first = slides[0];
					const coverSlide = slimBulkCoverSlide(first);
					const candidates = [
						String(coverSlide?.mediaThumb ?? '').trim(),
						String(coverSlide?.mediaUrl ?? '').trim(),
						String(first?.mediaThumb ?? '').trim(),
						String(first?.mediaUrl ?? '').trim(),
						safeWorkspaceThumb,
					];
					let safeThumb = '';
					for (const thumb of candidates) {
						if (!thumb || thumb.startsWith('blob:') || thumb.length >= 2000) continue;
						if (/\.(mp4|webm|mov)(\?|$)/i.test(thumb)) continue;
						if (/youtube\.com\/embed|youtu\.be\//i.test(thumb)) continue;
						safeThumb = thumb;
						break;
					}
					return {
						id: s.id,
						title: String(s.title ?? '').trim() || 'Untitled',
						slideCount: Math.max(1, slides.length),
						headline: String(first?.headline ?? '').trim(),
						thumb: safeThumb,
						template: String(first?.template ?? 'news'),
						coverSlide,
						fromVideoClips: !!s.fromVideoClips,
					};
				}),
			};
		}),
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
