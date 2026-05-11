import type { SupabaseClient } from '@supabase/supabase-js';
import { zernioCreateProfile, zernioGetConnectAuthUrl, zernioListAccounts } from '$lib/server/zernio-publish';

export async function ensureUserZernioProfile(
	supabase: SupabaseClient,
	apiKey: string,
	userId: string
): Promise<string> {
	const { data: existing, error: exErr } = await supabase
		.from('social_connections')
		.select('provider_account_id')
		.eq('user_id', userId)
		.eq('provider', 'zernio_profile')
		.maybeSingle();
	if (exErr) throw new Error(exErr.message);
	if (existing?.provider_account_id) return existing.provider_account_id as string;

	const profileId = await zernioCreateProfile(apiKey, userId);
	const { error: insErr } = await supabase.from('social_connections').insert({
		user_id: userId,
		provider: 'zernio_profile',
		provider_account_id: profileId,
		provider_account_label: 'Zernio profile',
		access_token: '-',
		scopes: [],
		meta: {},
	});
	if (insErr) throw new Error(insErr.message);
	return profileId;
}

export async function syncZernioConnectionsForUser(
	supabase: SupabaseClient,
	apiKey: string,
	userId: string
): Promise<{ synced: number }> {
	const { data: row, error } = await supabase
		.from('social_connections')
		.select('provider_account_id')
		.eq('user_id', userId)
		.eq('provider', 'zernio_profile')
		.maybeSingle();
	if (error) throw new Error(error.message);
	const profileId = row?.provider_account_id as string | undefined;
	if (!profileId) return { synced: 0 };

	const accounts = await zernioListAccounts(apiKey, profileId);
	let synced = 0;
	for (const a of accounts) {
		const platform = String(a.platform ?? a.provider ?? '').toLowerCase();
		if (!['facebook', 'instagram', 'tiktok'].includes(platform)) continue;
		const id = String(a._id ?? a.id ?? '').trim();
		if (!id) continue;
		const labelBase = String(a.displayName ?? a.name ?? a.username ?? a.handle ?? id).slice(0, 180);
		const { error: upErr } = await supabase.from('social_connections').upsert(
			{
				user_id: userId,
				provider: 'zernio',
				provider_account_id: id,
				provider_account_label: `${platform} — ${labelBase}`,
				access_token: '-',
				scopes: [],
				meta: {
					platform,
					zernio_profile_id: profileId,
					username: a.username ?? a.handle ?? null,
					facebookPageId: a.facebookPageId ?? a.defaultFacebookPageId ?? null,
				},
				needs_reauth: false,
				last_auth_error: null,
			},
			{ onConflict: 'user_id,provider,provider_account_id' }
		);
		if (upErr) throw new Error(upErr.message);
		synced++;
	}
	return { synced };
}

export async function startZernioConnect(
	apiKey: string,
	platform: 'facebook' | 'instagram' | 'tiktok',
	profileId: string,
	appBaseUrl: string
): Promise<string> {
	const redirectUrl = `${appBaseUrl.replace(/\/$/, '')}/api/auth/zernio/callback`;
	return zernioGetConnectAuthUrl(apiKey, platform, profileId, redirectUrl);
}
