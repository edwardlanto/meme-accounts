import { json } from '@sveltejs/kit';
import { z } from 'zod';
import type { RequestHandler } from './$types';
import { parseJsonBody } from '$lib/server/request-security';
import {
	listVideoClipProjects,
	saveVideoClipProject,
} from '$lib/server/video-clip-projects';
import type { BulkShow } from '$lib/studio/bulk-to-studio';
import type { VideoClip } from '$lib/video-clips/types';

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

function safeListThumb(raw: unknown, fallback = ''): string {
	const candidates = [String(raw ?? '').trim(), String(fallback ?? '').trim()];
	for (const thumb of candidates) {
		if (!thumb || thumb.startsWith('blob:') || thumb.length >= 2000) continue;
		if (/\.(mp4|webm|mov)(\?|$)/i.test(thumb)) continue;
		if (/youtube\.com\/embed|youtu\.be\//i.test(thumb)) continue;
		return thumb;
	}
	return '';
}

export const GET: RequestHandler = async ({ locals }) => {
	const { user } = await locals.safeGetSession();
	if (!user) return json({ error: 'Unauthorized' }, { status: 401 });
	const projects = await listVideoClipProjects(user.id, 48);
	return json({
		projects: projects.map((p) => {
			const bulkShows = Array.isArray(p.bulk_shows) ? (p.bulk_shows as BulkShow[]) : [];
			const clips = (Array.isArray(p.clips) ? p.clips : []) as VideoClip[];
			const projectThumb = safeListThumb(p.thumbnail_url, p.source?.thumbnailUrl);
			const shows =
				bulkShows.length > 0
					? bulkShows.slice(0, 24).map((s) => {
							const slides = Array.isArray(s.slides) ? s.slides : [];
							const first = slides[0];
							return {
								id: s.id,
								title: String(s.title ?? '').trim() || 'Untitled',
								slideCount: Math.max(1, slides.length),
								headline: String(first?.headline ?? '').trim(),
								thumb: safeListThumb(first?.mediaThumb || first?.mediaUrl, projectThumb),
								template: String(first?.template ?? 'news'),
							};
						})
					: clips.slice(0, 24).map((c, i) => ({
							id: String(c.id ?? `clip-${i}`),
							title:
								String(c.newsHeadline ?? c.videoHook ?? c.title ?? '').trim() ||
								`Clip ${i + 1}`,
							slideCount: 1,
							headline: String(c.newsHeadline ?? c.hook ?? '').trim(),
							thumb: safeListThumb(c.thumbnailUrl, projectThumb),
							template: 'news',
						}));
			return {
				id: p.id,
				title: p.title || p.source?.title || 'YouTube clips',
				thumbnailUrl: projectThumb || p.thumbnail_url,
				sourceTitle: p.source?.title ?? '',
				clipCount: clips.length,
				showCount: shows.length,
				summary: p.summary,
				updatedAt: p.updated_at,
				hasBulkShows: bulkShows.length > 0,
				url: `/dashboard/bulk?project=${encodeURIComponent(p.id)}`,
				shows,
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
