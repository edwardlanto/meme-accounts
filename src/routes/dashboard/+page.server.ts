import type { PageServerLoad } from './$types';
import { getGenerationOverview } from '$lib/server/usage';

export const load: PageServerLoad = async ({ parent }) => {
	const { user } = await parent();
	if (!user) {
		return { generation: { slideshows: 0, slides: 0 } };
	}
	return { generation: await getGenerationOverview(user.id) };
};
