import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { resolveHomeMarqueeSlides } from '$lib/marketing/home-marquee-slides.server';

/**
 * Landing page: if the user is already signed in, send them straight to the
 * dashboard. Otherwise show the marketing page.
 */
export const load: PageServerLoad = async ({ locals }) => {
	const { session } = await locals.safeGetSession();
	if (session) throw redirect(303, '/dashboard');
	return {
		marqueeSlides: resolveHomeMarqueeSlides(),
	};
};
