import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/private';
import { adminClient } from '$lib/server/auth';
import { isZernioConnectPlatform, type ZernioConnectPlatform } from '$lib/integrations/zernio-platforms';
import { zernioDeleteAccount } from '$lib/server/zernio-publish';

export const POST: RequestHandler = async ({ request, locals }) => {
	const { user } = await locals.safeGetSession();
	if (!user) return json({ ok: false, error: 'Unauthorized' }, { status: 401 });

	let body: { platform?: string; accountId?: string };
	try {
		body = await request.json();
	} catch {
		return json({ ok: false, error: 'Invalid JSON body' }, { status: 400 });
	}

	const platform = String(body?.platform ?? '').toLowerCase();
	const accountId = String(body?.accountId ?? '').trim();

	if (!platform && !accountId) {
		return json({ ok: false, error: 'Provide platform or accountId' }, { status: 400 });
	}
	if (platform && !isZernioConnectPlatform(platform)) {
		return json({ ok: false, error: 'Unknown platform' }, { status: 400 });
	}

	const apiKey = env.ZERNIO_API_KEY ?? '';
	const supabase = adminClient();

	let query = supabase
		.from('social_connections')
		.select('id, provider_account_id, meta')
		.eq('user_id', user.id)
		.eq('provider', 'zernio');

	if (accountId) {
		query = query.eq('provider_account_id', accountId);
	} else {
		query = query.contains('meta', { platform: platform as ZernioConnectPlatform });
	}

	const { data: rows, error: fetchErr } = await query;
	if (fetchErr) return json({ ok: false, error: fetchErr.message }, { status: 500 });
	if (!rows?.length) return json({ ok: true, removed: 0 });

	const zernioErrors: string[] = [];
	if (apiKey) {
		for (const row of rows) {
			const zid = String(row.provider_account_id ?? '').trim();
			if (!zid) continue;
			try {
				await zernioDeleteAccount(apiKey, zid);
			} catch (e: any) {
				zernioErrors.push(e?.message ?? 'Zernio disconnect failed');
			}
		}
	}

	const ids = rows.map((r) => r.id);
	const { error: delErr } = await supabase.from('social_connections').delete().in('id', ids);
	if (delErr) return json({ ok: false, error: delErr.message }, { status: 500 });

	return json({
		ok: true,
		removed: ids.length,
		zernioWarning: zernioErrors.length ? zernioErrors[0] : undefined,
	});
};
