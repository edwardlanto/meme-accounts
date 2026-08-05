/** Extract the best still frame for one clip segment from a source R2 video. */

import { json } from '@sveltejs/kit';
import { z } from 'zod';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { RequestHandler } from './$types';
import { parseJsonBody, isValidOwnerR2Key } from '$lib/server/request-security';
import { r2PutObject, r2SignGet } from '$lib/server/r2';
import { extractFrameWithFfmpeg, withTempDir, checkVideoTools } from '$lib/server/video-pipeline';
import { resolveBestFrameSec } from '$lib/server/clip-stills';
import type { VideoClip } from '$lib/video-clips/types';

const bodySchema = z.object({
	r2Key: z.string().min(1).max(600),
	startSec: z.number().min(0).max(86_400),
	endSec: z.number().min(0).max(86_400),
	bestFrameSec: z.number().min(0).max(86_400).optional(),
});

export const POST: RequestHandler = async ({ request, locals }) => {
	const { user } = await locals.safeGetSession();
	if (!user) return json({ error: 'Unauthorized' }, { status: 401 });

	const parsed = await parseJsonBody(request, bodySchema, 8_192);
	if (!parsed.ok) return json({ error: parsed.error }, { status: parsed.status });

	const { r2Key, startSec, endSec, bestFrameSec } = parsed.data;
	if (!isValidOwnerR2Key(user.id, r2Key)) {
		return json({ error: 'Invalid source key' }, { status: 400 });
	}

	const start = Math.max(0, Number(startSec) || 0);
	const end = Math.max(start + 0.2, Number(endSec) || start + 1);
	const clip = {
		id: 'scene',
		title: '',
		startSec: start,
		endSec: end,
		viralityScore: 0,
		hook: '',
		reason: '',
		bestFrameSec: Number.isFinite(Number(bestFrameSec)) ? Number(bestFrameSec) : undefined,
	} satisfies VideoClip;
	const atSec = resolveBestFrameSec(clip);

	const tools = await checkVideoTools();
	if (!tools.ffmpeg) {
		return json({ error: 'ffmpeg is required to grab a scene photo' }, { status: 503 });
	}

	try {
		const sourceUrl = await r2SignGet(r2Key, 3600);
		const result = await withTempDir(async (dir) => {
			const res = await fetch(sourceUrl);
			if (!res.ok) throw new Error(`Could not fetch source video (${res.status})`);
			const inputPath = join(dir, 'source.mp4');
			await writeFile(inputPath, new Uint8Array(await res.arrayBuffer()));
			const framePath = join(dir, 'still.jpg');
			await extractFrameWithFfmpeg({
				inputPath,
				outputPath: framePath,
				atSec,
				maxWidth: 1280,
			});
			const bytes = await readFile(framePath);
			const stillKey = `${user.id}/clip-stills/${crypto.randomUUID()}.jpg`;
			await r2PutObject(stillKey, new Uint8Array(bytes), 'image/jpeg');
			const url = await r2SignGet(stillKey, 60 * 60 * 24 * 7);
			return { url, r2Key: stillKey, bestFrameSec: atSec };
		});
		return json(result);
	} catch (e) {
		console.error('[api/videos/scene-still]', e);
		return json(
			{ error: e instanceof Error ? e.message : 'Failed to extract scene photo' },
			{ status: 500 },
		);
	}
};
