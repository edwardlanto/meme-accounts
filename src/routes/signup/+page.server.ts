import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

function safeNext(raw: string | null): string {
	if (!raw || !raw.startsWith('/') || raw.startsWith('//')) return '/dashboard';
	return raw;
}

export const load: PageServerLoad = async ({ locals, url }) => {
	const next = safeNext(url.searchParams.get('next'));
	const { session } = await locals.safeGetSession();
	if (session) throw redirect(303, next);
	return { next };
};
