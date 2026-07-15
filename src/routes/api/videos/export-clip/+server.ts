import { json } from '@sveltejs/kit';
import { z } from 'zod';
import { readFile } from 'node:fs/promises';
import type { RequestHandler } from './$types';
import { parseJsonBody, isValidOwnerR2Key } from '$lib/server/request-security';
import { r2SignGet } from '$lib/server/r2';
import { extractClipWithFfmpeg, withTempDir } from '$lib/server/video-pipeline';

function attachmentFilename(raw: string): string {
	const safe = (raw || 'clip').replace(/[^\w.-]+/g, '_').slice(0, 80);
	return `${safe}.mp4`;
}

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
		const outName = attachmentFilename(filename ?? 'clip');

		const clipBytes = await withTempDir(async (dir) => {
			console.info('[api/videos/export-clip] fetching source from R2…');
			const res = await fetch(sourceUrl);
			if (!res.ok) throw new Error('Could not read source video from storage');
			const buf = new Uint8Array(await res.arrayBuffer());
			const inputPath = `${dir}/source.mp4`;
			const outputPath = `${dir}/clip.mp4`;
			const { writeFile } = await import('node:fs/promises');
			await writeFile(inputPath, buf);

			console.info(
				`[api/videos/export-clip] cutting ${startSec.toFixed(1)}s–${endSec.toFixed(1)}s…`,
			);
			await extractClipWithFfmpeg({
				inputPath,
				outputPath,
				startSec,
				endSec,
			});

			return readFile(outputPath);
		});

		console.info(`[api/videos/export-clip] ready (${(clipBytes.byteLength / 1e6).toFixed(1)}MB)`);
		return new Response(clipBytes, {
			headers: {
				'Content-Type': 'video/mp4',
				'Content-Disposition': `attachment; filename="${outName}"; filename*=UTF-8''${encodeURIComponent(outName)}`,
				'Content-Length': String(clipBytes.byteLength),
				'Cache-Control': 'no-store',
			},
		});
	} catch (e: unknown) {
		const message = e instanceof Error ? e.message : String(e);
		console.error('[api/videos/export-clip]', message);
		return json({ error: message }, { status: 500 });
	}
};
