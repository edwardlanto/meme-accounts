import type { PageServerLoad } from './$types';

export type AnalyticsPlatform = 'instagram' | 'facebook' | 'tiktok' | 'linkedin' | 'gmb';

export type ConnectionSummary = {
	provider: string;
	provider_account_id: string;
	provider_account_label: string | null;
	updated_at: string | null;
	meta: Record<string, unknown> | null;
};

export type PostStats = {
	published: number;
	scheduled: number;
	failed: number;
	publishing: number;
	cancelled: number;
	total: number;
};

function classifyScheduledPost(row: {
	connection_provider: string;
	connection_provider_account_id: string;
	content?: { meta?: { platform?: string } } | null;
}): AnalyticsPlatform | null {
	const p = (row.connection_provider ?? '').toLowerCase();
	const acct = String(row.connection_provider_account_id ?? '');
	if (p === 'tiktok') return 'tiktok';
	if (p === 'linkedin') return 'linkedin';
	if (p === 'gmb') return 'gmb';
	if (p === 'zernio') {
		const c = row.content ?? {};
		let zp = String((c as any).meta?.platform ?? '').toLowerCase();
		if (!zp && (c as any).igType) zp = 'instagram';
		if (!zp && ((c as any).images || (c as any).message || (c as any).video || (c as any).videos || (c as any).kind)) {
			const k = String((c as any).kind ?? '').toLowerCase();
			if (k.startsWith('ig_')) zp = 'instagram';
			else zp = 'facebook';
		}
		if (!zp && (c as any).videoUrl && !(c as any).igType) zp = 'tiktok';
		if (zp === 'instagram') return 'instagram';
		if (zp === 'facebook') return 'facebook';
		if (zp === 'tiktok') return 'tiktok';
		return null;
	}
	if (p === 'meta') {
		if (acct.startsWith('fbpage:')) return 'facebook';
		return 'instagram';
	}
	return null;
}

function emptyStats(): PostStats {
	return { published: 0, scheduled: 0, failed: 0, publishing: 0, cancelled: 0, total: 0 };
}

export const load: PageServerLoad = async ({ locals }) => {
	const { user } = await locals.safeGetSession();
	if (!user) {
		return {
			connections: [] as ConnectionSummary[],
			statsByPlatform: {} as Record<AnalyticsPlatform, PostStats>,
		};
	}

	const sb = locals.supabase as import('@supabase/supabase-js').SupabaseClient<any>;

	const [{ data: connRows, error: connErr }, { data: postRows, error: postErr }] = await Promise.all([
		sb
			.from('social_connections')
			.select('provider, provider_account_id, provider_account_label, updated_at, meta')
			.eq('user_id', user.id)
			.order('updated_at', { ascending: false }),
		sb
			.from('scheduled_posts')
			.select('status, connection_provider, connection_provider_account_id, content')
			.eq('user_id', user.id),
	]);

	if (connErr) console.error('[analytics] social_connections', connErr);
	if (postErr) console.error('[analytics] scheduled_posts', postErr);

	const connections = (connRows ?? []) as ConnectionSummary[];

	const statsByPlatform: Record<AnalyticsPlatform, PostStats> = {
		instagram: emptyStats(),
		facebook: emptyStats(),
		tiktok: emptyStats(),
		linkedin: emptyStats(),
		gmb: emptyStats(),
	};

	for (const row of (postRows ?? []) as {
		status: string;
		connection_provider: string;
		connection_provider_account_id: string;
	}[]) {
		const plat = classifyScheduledPost(row);
		if (!plat) continue;
		const s = statsByPlatform[plat];
		s.total += 1;
		const st = (row.status ?? '').toLowerCase();
		if (st === 'published') s.published += 1;
		else if (st === 'scheduled') s.scheduled += 1;
		else if (st === 'failed') s.failed += 1;
		else if (st === 'publishing') s.publishing += 1;
		else if (st === 'cancelled') s.cancelled += 1;
	}

	return { connections, statsByPlatform };
};
