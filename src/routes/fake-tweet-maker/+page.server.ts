import type { PageServerLoad } from './$types';
import { getTrialStatus } from '$lib/server/trial';

export const load: PageServerLoad = async ({ locals }) => {
	const { user } = await locals.safeGetSession();
	if (!user) {
		return { user: null, trial: null };
	}
	const trial = await getTrialStatus(user.id);
	return {
		user: { id: user.id, email: user.email },
		trial: {
			...trial,
			remaining: trial.isPaid ? null : trial.remaining,
		},
	};
};
