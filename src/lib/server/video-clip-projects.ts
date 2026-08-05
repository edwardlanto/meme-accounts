import type { VideoClip, VideoImportMeta } from '$lib/video-clips/types';
import { adminClient } from '$lib/server/auth';

export type VideoClipProjectRow = {
	id: string;
	user_id: string;
	title: string;
	thumbnail_url: string | null;
	source: VideoImportMeta;
	clips: VideoClip[];
	summary: string;
	demo: boolean;
	model: string;
	bulk_shows: unknown | null;
	created_at: string;
	updated_at: string;
};

export type VideoClipProjectPayload = {
	title: string;
	thumbnailUrl?: string;
	source: VideoImportMeta;
	clips: VideoClip[];
	summary: string;
	demo: boolean;
	model: string;
	bulkShows?: unknown;
};

export async function saveVideoClipProject(
	userId: string,
	payload: VideoClipProjectPayload,
	opts?: { id?: string },
): Promise<string | null> {
	try {
		const admin = adminClient();

		const row = {
			user_id: userId,
			title: payload.title || payload.source?.title || 'Video clips',
			thumbnail_url: payload.thumbnailUrl ?? payload.source?.thumbnailUrl ?? null,
			source: payload.source,
			clips: payload.clips,
			summary: payload.summary ?? '',
			demo: payload.demo ?? false,
			model: payload.model ?? '',
			bulk_shows: payload.bulkShows ?? null,
		};

		if (opts?.id) {
			const { data, error } = await admin
				.from('video_clip_projects')
				.update(row)
				.eq('id', opts.id)
				.eq('user_id', userId)
				.select('id')
				.single();
			if (error) {
				console.warn('[video_clip_projects] update failed', error.message);
				return null;
			}
			return data?.id ?? opts.id;
		}

		const { data, error } = await admin
			.from('video_clip_projects')
			.insert(row)
			.select('id')
			.single();
		if (error) {
			console.warn('[video_clip_projects] insert failed', error.message);
			return null;
		}
		return data?.id ?? null;
	} catch (e) {
		console.warn('[video_clip_projects] save error', e);
		return null;
	}
}

export async function listVideoClipProjects(userId: string, limit = 12): Promise<VideoClipProjectRow[]> {
	try {
		const admin = adminClient();
		const { data, error } = await admin
			.from('video_clip_projects')
			.select('*')
			.eq('user_id', userId)
			.order('updated_at', { ascending: false })
			.limit(limit);
		if (error) {
			console.warn('[video_clip_projects] list failed', error.message);
			return [];
		}
		return (data ?? []) as VideoClipProjectRow[];
	} catch (e) {
		console.warn('[video_clip_projects] list error', e);
		return [];
	}
}

export async function getVideoClipProject(userId: string, id: string): Promise<VideoClipProjectRow | null> {
	try {
		const admin = adminClient();
		const { data, error } = await admin
			.from('video_clip_projects')
			.select('*')
			.eq('user_id', userId)
			.eq('id', id)
			.maybeSingle();
		if (error || !data) return null;
		return data as VideoClipProjectRow;
	} catch (e) {
		console.warn('[video_clip_projects] get error', e);
		return null;
	}
}
