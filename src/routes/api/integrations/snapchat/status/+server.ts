import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
	const required = [
		'SNAPCHAT_CLIENT_ID',
		'SNAPCHAT_CLIENT_SECRET',
		'SNAPCHAT_REDIRECT_URI',
		'SUPABASE_URL',
		'SUPABASE_SERVICE_KEY',
	] as const;

	const missing = required.filter((k) => !(env as any)[k]);

	return json({
		ok: missing.length === 0,
		missing,
		present: required.filter((k) => !missing.includes(k)),
	});
};

