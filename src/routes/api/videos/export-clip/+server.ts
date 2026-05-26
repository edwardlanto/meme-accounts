import { json } from '@sveltejs/kit';
import { z } from 'zod';
import { readFile } from 'node:fs/promises';
import type { RequestHandler } from './$types';
import { parseJsonBody, isValidOwnerR2Key } from '$lib/server/request-security';
import { r2SignGet, r2PutObject } from '$lib/server/r2';
import { extractClipWithFfmpeg, withTempDir } from '$lib/server/video-pipeline';

const schema = z.object({
	r2Key: z.string().max(600),
	startSec: z.number().min(0),
	endSec: z.number().min(0.5),
	filename: z.string().max(200).optional(),
});

export const POST: RequestHandler = async ({ request, locals }) => {
	const { user } = await locals.safeGetSession();
	if (!user) return json({ error: 'Unauthorized' }, { status: 401 });

	const parsed = await parseJsonBody(request, schema);
	if (!parsed.ok) return json({ error: parsed.error }, { status: parsed.status });

	const { r2Key, startSec, endSec, filename } = parsed.data;
	if (!isValidOwnerR2Key(user.id, r2Key)) {
		return json({ error: 'Invalid video key' }, { status: 403 });
	}
	if (endSec <= startSec) return json({ error: 'Invalid clip range' }, { status: 400 });

	try {
		const sourceUrl = await r2SignGet(r2Key, 3600);
		const outKey = `${user.id}/videos/clips/${crypto.randomUUID()}.mp4`;
		const safeName = (filename ?? 'clip').replace(/[^\w.-]+/g, '_').slice(0, 80);

		const downloadUrl = await withTempDir(async (dir) => {
			const res = await fetch(sourceUrl);
			if (!res.ok) throw new Error('Could not read source video from storage');
			const buf = new Uint8Array(await res.arrayBuffer());
			const inputPath = `${dir}/source.mp4`;
			const outputPath = `${dir}/clip.mp4`;
			const { writeFile } = await import('node:fs/promises');
			await writeFile(inputPath, buf);

			await extractClipWithFfmpeg({
				inputPath,
				outputPath,
				startSec,
				endSec,
			});

			const clipBytes = await readFile(outputPath);
			await r2PutObject(outKey, clipBytes, 'video/mp4');
			return await r2SignGet(outKey, 7200);
		});

		return json({
			ok: true,
			downloadUrl,
			key: outKey,
			filename: `${safeName}.mp4`,
		});
	} catch (e: unknown) {
		const message = e instanceof Error ? e.message : String(e);
		console.error('[api/videos/export-clip]', message);
		return json({ error: message }, { status: 500 });
	}
};
