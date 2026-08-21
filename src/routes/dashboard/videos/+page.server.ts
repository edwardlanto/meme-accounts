import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { isClipFinderEnabled } from '$lib/launch-flags';

export const load: PageServerLoad = async ({ url }) => {
	if (!isClipFinderEnabled(url.hostname)) redirect(302, '/dashboard');
	return {};
};
