import { adminClient } from '$lib/server/auth';
import type { BulkShow } from '$lib/studio/bulk-to-studio';

export type BulkWorkspaceRow = {
	id: string;
	user_id: string;
	title: string;
	topic: string;
	thumbnail_url: string | null;
	shows: BulkShow[];
	selected_show_id: string | null;
	clip_project_id: string | null;
	created_at: string;
	updated_at: string;
};

export type BulkWorkspacePayload = {
	title?: string;
	topic?: string;
	thumbnailUrl?: string | null;
	shows: BulkShow[];
	selectedShowId?: string | null;
	clipProjectId?: string | null;
};

function firstThumb(shows: BulkShow[]): string | null {
	for (const show of shows ?? []) {
		for (const sl of show.slides ?? []) {
			const t = String(sl.mediaThumb || sl.mediaUrl || '').trim();
			if (t && !t.startsWith('blob:') && t.length < 2000) return t;
		}
	}
	return null;
}

function titleFromShows(shows: BulkShow[], topic?: string): string {
	const t = String(topic ?? '').trim();
	if (t) return t.slice(0, 120);
	const first = shows?.[0]?.title?.trim() || shows?.[0]?.slides?.[0]?.headline?.trim();
	return (first || 'Bulk slideshow').slice(0, 120);
}

export async function saveBulkWorkspaceRow(
	userId: string,
	payload: BulkWorkspacePayload,
	opts?: { id?: string },
): Promise<string | null> {
	try {
		const admin = adminClient();
		const shows = Array.isArray(payload.shows) ? payload.shows : [];
		const row = {
			user_id: userId,
			title: titleFromShows(shows, payload.title ?? payload.topic),
			topic: String(payload.topic ?? '').trim().slice(0, 500),
			thumbnail_url: payload.thumbnailUrl ?? firstThumb(shows),
			shows,
			selected_show_id: payload.selectedShowId ?? shows[0]?.id ?? null,
			clip_project_id: payload.clipProjectId ?? null,
		};

		if (opts?.id) {
			const { data, error } = await admin
				.from('bulk_workspaces')
				.update(row)
				.eq('id', opts.id)
				.eq('user_id', userId)
				.select('id')
				.single();
			if (error) {
				console.warn('[bulk_workspaces] update failed', error.message);
				return null;
			}
			return data?.id ?? opts.id;
		}

		const { data, error } = await admin.from('bulk_workspaces').insert(row).select('id').single();
		if (error) {
			console.warn('[bulk_workspaces] insert failed', error.message);
			return null;
		}
		return data?.id ?? null;
	} catch (e) {
		console.warn('[bulk_workspaces] save error', e);
		return null;
	}
}

export async function listBulkWorkspaces(userId: string, limit = 24): Promise<BulkWorkspaceRow[]> {
	try {
		const admin = adminClient();
		const { data, error } = await admin
			.from('bulk_workspaces')
			.select('*')
			.eq('user_id', userId)
			.order('updated_at', { ascending: false })
			.limit(limit);
		if (error) {
			console.warn('[bulk_workspaces] list failed', error.message);
			return [];
		}
		return (data ?? []) as BulkWorkspaceRow[];
	} catch (e) {
		console.warn('[bulk_workspaces] list error', e);
		return [];
	}
}

export async function getBulkWorkspace(userId: string, id: string): Promise<BulkWorkspaceRow | null> {
	try {
		const admin = adminClient();
		const { data, error } = await admin
			.from('bulk_workspaces')
			.select('*')
			.eq('user_id', userId)
			.eq('id', id)
			.maybeSingle();
		if (error || !data) return null;
		return data as BulkWorkspaceRow;
	} catch (e) {
		console.warn('[bulk_workspaces] get error', e);
		return null;
	}
}

export async function deleteBulkWorkspace(userId: string, id: string): Promise<boolean> {
	try {
		const admin = adminClient();
		const { error } = await admin.from('bulk_workspaces').delete().eq('id', id).eq('user_id', userId);
		if (error) {
			console.warn('[bulk_workspaces] delete failed', error.message);
			return false;
		}
		return true;
	} catch (e) {
		console.warn('[bulk_workspaces] delete error', e);
		return false;
	}
}
