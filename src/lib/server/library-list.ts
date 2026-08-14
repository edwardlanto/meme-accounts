import { adminClient } from '$lib/server/auth';
import { listBulkWorkspaces } from '$lib/server/bulk-workspaces';
import { listVideoClipProjects } from '$lib/server/video-clip-projects';
import { slimBulkCoverSlide, type BulkShow } from '$lib/studio/bulk-to-studio';
import type { VideoClip } from '$lib/video-clips/types';

const STUDIO_WORKSPACE_DRAFT_KIND = 'news_studio';
const STUDIO_SAVED_TEMPLATE_KIND = 'studio_saved_template';

function safeThumb(raw: unknown, fallback = ''): string {
	const candidates = [String(raw ?? '').trim(), String(fallback ?? '').trim()];
	for (const thumb of candidates) {
		if (!thumb || thumb.startsWith('blob:') || thumb.length >= 2000) continue;
		if (/\.(mp4|webm|mov)(\?|$)/i.test(thumb)) continue;
		if (/youtube\.com\/embed|youtu\.be\//i.test(thumb)) continue;
		return thumb;
	}
	return '';
}

export function mapBulkWorkspaceRows(rows: Awaited<ReturnType<typeof listBulkWorkspaces>>) {
	return rows.map((r) => {
		const shows = Array.isArray(r.shows) ? (r.shows as BulkShow[]) : [];
		const workspaceThumb = String(r.thumbnail_url ?? '').trim();
		const safeWorkspaceThumb = safeThumb(workspaceThumb);
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
				let thumb = '';
				for (const c of candidates) {
					const t = safeThumb(c);
					if (t) {
						thumb = t;
						break;
					}
				}
				const durationSec = slides.reduce((sum, sl) => {
					const start = Number(sl?.clipStart) || 0;
					const end = Number(sl?.clipEnd) || 0;
					return sum + (end > start ? end - start : 0);
				}, 0);
				return {
					id: s.id,
					title: String(s.title ?? '').trim() || 'Untitled',
					slideCount: Math.max(1, slides.length),
					headline: String(first?.headline ?? '').trim(),
					thumb,
					template: String(first?.template ?? 'news'),
					coverSlide,
					durationSec: durationSec > 0 ? durationSec : undefined,
					fromVideoClips: !!s.fromVideoClips,
				};
			}),
		};
	});
}

export function mapClipProjectRows(rows: Awaited<ReturnType<typeof listVideoClipProjects>>) {
	return rows.map((p) => {
		const bulkShows = Array.isArray(p.bulk_shows) ? (p.bulk_shows as BulkShow[]) : [];
		const clips = (Array.isArray(p.clips) ? p.clips : []) as VideoClip[];
		const projectThumb = safeThumb(p.thumbnail_url, p.source?.thumbnailUrl);
		const durationSec = clips.reduce((sum, c) => {
			const start = Number(c.startSec) || 0;
			const end = Number(c.endSec) || 0;
			const span = Math.max(0, end - start);
			return sum + (span > 0 ? span : 0);
		}, 0);
		const sourceDuration = Number(p.source?.durationSec) || 0;
		const shows =
			bulkShows.length > 0
				? bulkShows.slice(0, 24).map((s) => {
						const slides = Array.isArray(s.slides) ? s.slides : [];
						const first = slides[0];
						const showDuration = slides.reduce((sum, sl) => {
							const start = Number(sl?.clipStart) || 0;
							const end = Number(sl?.clipEnd) || 0;
							return sum + (end > start ? end - start : 0);
						}, 0);
						return {
							id: s.id,
							title: String(s.title ?? '').trim() || 'Untitled',
							slideCount: Math.max(1, slides.length),
							headline: String(first?.headline ?? '').trim(),
							thumb: safeThumb(first?.mediaThumb || first?.mediaUrl, projectThumb),
							template: String(first?.template ?? 'news'),
							durationSec: showDuration > 0 ? showDuration : undefined,
						};
					})
				: clips.slice(0, 24).map((c, i) => {
						const start = Number(c.startSec) || 0;
						const end = Number(c.endSec) || 0;
						const span = end > start ? end - start : 0;
						return {
							id: String(c.id ?? `clip-${i}`),
							title:
								String(c.newsHeadline ?? c.videoHook ?? c.title ?? '').trim() || `Clip ${i + 1}`,
							slideCount: 1,
							headline: String(c.newsHeadline ?? c.hook ?? '').trim(),
							thumb: safeThumb(c.thumbnailUrl, projectThumb),
							template: 'news',
							durationSec: span > 0 ? span : undefined,
						};
					});
		const topicHint = String((p.source as { topicHint?: string } | undefined)?.topicHint ?? '').trim();
		return {
			id: p.id,
			title: p.title || p.source?.title || 'YouTube clips',
			thumbnailUrl: projectThumb || p.thumbnail_url,
			sourceTitle: p.source?.title ?? '',
			sourceKind: p.source?.kind === 'upload' ? 'upload' : 'youtube',
			clipCount: clips.length,
			showCount: shows.length,
			durationSec: durationSec || sourceDuration,
			topic: topicHint,
			summary: p.summary,
			updatedAt: p.updated_at,
			hasBulkShows: bulkShows.length > 0,
			url: `/dashboard/bulk?project=${encodeURIComponent(p.id)}`,
			shows,
		};
	});
}

export async function loadCarouselLibrary(userId: string) {
	const admin = adminClient();
	const empty = {
		carousels: [] as any[],
		studioDrafts: [] as { id: string; updated_at: string; state?: Record<string, unknown> }[],
		studioSavedTemplates: [] as { id: string; updated_at: string; state?: Record<string, unknown> }[],
		bulkWorkspaces: [] as ReturnType<typeof mapBulkWorkspaceRows>,
	};

	try {
		const [carouselsRes, draftsRes, savedRes, bulkRows] = await Promise.all([
			admin
				.from('carousels')
				.select('*')
				.eq('user_id', userId)
				.order('updated_at', { ascending: false }),
			admin
				.from('drafts')
				.select('id,updated_at,state')
				.eq('user_id', userId)
				.eq('kind', STUDIO_WORKSPACE_DRAFT_KIND)
				.order('updated_at', { ascending: false })
				.limit(40),
			admin
				.from('drafts')
				.select('id,updated_at,state')
				.eq('user_id', userId)
				.eq('kind', STUDIO_SAVED_TEMPLATE_KIND)
				.order('updated_at', { ascending: false })
				.limit(48),
			listBulkWorkspaces(userId, 48).catch(() => []),
		]);

		if (carouselsRes.error) console.warn('[library] carousels:', carouselsRes.error.message);
		if (draftsRes.error) console.warn('[library] studio drafts:', draftsRes.error.message);
		if (savedRes.error) console.warn('[library] saved templates:', savedRes.error.message);

		return {
			carousels: carouselsRes.data ?? [],
			studioDrafts: draftsRes.data ?? [],
			studioSavedTemplates: savedRes.data ?? [],
			bulkWorkspaces: mapBulkWorkspaceRows(Array.isArray(bulkRows) ? bulkRows : []),
		};
	} catch (e) {
		console.warn('[library] loadCarouselLibrary failed:', e);
		return empty;
	}
}

export async function loadClipsLibrary(userId: string) {
	const [bulkRows, clipRows] = await Promise.all([
		listBulkWorkspaces(userId, 48),
		listVideoClipProjects(userId, 48),
	]);
	return {
		bulkWorkspaces: mapBulkWorkspaceRows(bulkRows),
		clipProjects: mapClipProjectRows(clipRows),
	};
}
