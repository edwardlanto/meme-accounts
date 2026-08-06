import { error } from '@sveltejs/kit';
import { dev } from '$app/environment';
import type { PageLoad } from './$types';

/** Local-only page for Playwright cover captures — 404 in production. */
export const load: PageLoad = () => {
	if (!dev) error(404, 'Not found');
	return {};
};
