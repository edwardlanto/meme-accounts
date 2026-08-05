import { redirect } from '@sveltejs/kit';

/**
 * OAuth start routes must bind the flow to the signed-in user — never trust ?userId= from the client.
 */
export async function requireOAuthUserId(
	locals: App.Locals,
	loginNext: string,
): Promise<string> {
	const { user } = await locals.safeGetSession();
	if (!user) {
		throw redirect(303, `/login?next=${encodeURIComponent(loginNext)}`);
	}
	return user.id;
}
