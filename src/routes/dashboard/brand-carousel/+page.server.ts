import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

/** Legacy route: Brand Carousel was removed from the product nav. */
export const load: PageServerLoad = async () => {
	redirect(307, '/dashboard/carousels');
};
