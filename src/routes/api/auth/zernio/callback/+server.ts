import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/private';
import { adminClient } from '$lib/server/auth';
import { syncZernioConnectionsForUser } from '$lib/server/zernio-auth';

const cookiePath = { path: '/' };

export const GET: RequestHandler = async ({ url, cookies }) => {
	const next = cookies.get('zernio_oauth_next') ?? '/dashboard/post-scheduler';
	const userId = cookies.get('zernio_oauth_uid') ?? '';

	cookies.delete('zernio_oauth_state', cookiePath);
	cookies.delete('zernio_oauth_uid', cookiePath);
	cookies.delete('zernio_oauth_next', cookiePath);
	cookies.delete('zernio_oauth_platform', cookiePath);

	const err = url.searchParams.get('error') ?? url.searchParams.get('zernio_error');
	if (err) {
		const desc = url.searchParams.get('error_description') ?? url.searchParams.get('desc') ?? '';
		throw redirect(303, `${next}?zernio_error=${encodeURIComponent(err)}&desc=${encodeURIComponent(desc)}`);
	}

	const apiKey = env.ZERNIO_API_KEY ?? '';
	if (!apiKey || !userId) {
		throw redirect(303, `${next}?zernio_error=${encodeURIComponent('session_lost')}`);
	}

	try {
		const supabase = adminClient();
		await syncZernioConnectionsForUser(supabase, apiKey, userId);
		throw redirect(303, `${next}?zernio_connected=1`);
	} catch (e: any) {
		if (e?.status === 303 || e?.location) throw e;
		console.error('[zernio callback]', e);
		throw redirect(
			303,
			`${next}?zernio_error=${encodeURIComponent(e?.message ?? 'sync_failed')}`
		);
	}
};
