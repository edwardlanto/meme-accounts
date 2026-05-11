import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/private';

export const GET: RequestHandler = async () => {
	const missing: string[] = [];
	if (!env.ZERNIO_API_KEY) missing.push('ZERNIO_API_KEY');
	if (!env.PUBLIC_APP_URL) missing.push('PUBLIC_APP_URL');
	return json({ ok: missing.length === 0, missing, present: missing.length === 0 ? ['ZERNIO_API_KEY', 'PUBLIC_APP_URL'] : [] });
};
