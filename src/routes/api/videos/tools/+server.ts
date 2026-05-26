import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { checkVideoTools } from '$lib/server/video-pipeline';

export const GET: RequestHandler = async () => {
	const tools = await checkVideoTools();
	return json(tools);
};
