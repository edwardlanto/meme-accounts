import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { CLIP_FINDER_ENABLED } from '$lib/launch-flags';

export const load: PageServerLoad = async () => {
	if (!CLIP_FINDER_ENABLED) redirect(302, '/dashboard');
	return {};
};
