import { json } from '@sveltejs/kit';
import { z } from 'zod';
import type { RequestHandler } from './$types';
import { parseJsonBody, isValidOwnerR2Key } from '$lib/server/request-security';
import { buildClipMp4Bytes } from '$lib/server/clip-export';

function attachmentFilename(raw: string): string {
	const safe = (raw || 'clip').replace(/[^\w.-]+/g, '_').slice(0, 80);
	return `${safe}.mp4`;
}

const schema = z.object({
	r2Key: z.string().max(600),
	startSec: z.number().min(0),
	endSec: z.number().min(0.5),
	filename: z.string().max(200).optional(),
	speechWindows: z
		.array(
			z.object({
				startSec: z.number().min(0),
				endSec: z.number().min(0),
			}),
		)
		.max(40)
		.optional(),
	reframe: z
		.object({
			aspectRatio: z.enum(['9:16', '1:1', '16:9', '4:5']).default('9:16'),
			method: z.enum(['detection', 'saliency']).default('detection'),
			motionThreshold: z.number().min(0).max(1).default(0.5),
			paddingMethod: z.enum(['blur', 'solid_color']).default('blur'),
			debug: z.boolean().default(false),
		})
		.optional(),
});

export const POST: RequestHandler = async ({ request, locals }) => {
	const { user } = await locals.safeGetSession();
	if (!user) return json({ error: 'Unauthorized' }, { status: 401 });

	const parsed = await parseJsonBody(request, schema);
	if (!parsed.ok) return json({ error: parsed.error }, { status: parsed.status });

	const { r2Key, startSec, endSec, filename, speechWindows, reframe } = parsed.data;
	if (!isValidOwnerR2Key(user.id, r2Key)) {
		return json({ error: 'Invalid video key' }, { status: 403 });
	}
	if (endSec <= startSec) return json({ error: 'Invalid clip range' }, { status: 400 });

	try {
		const outName = attachmentFilename(filename ?? 'clip');
		const clipBytes = await buildClipMp4Bytes({
			sourceR2Key: r2Key,
			startSec,
			endSec,
			speechWindows,
			reframe,
		});

		console.info(`[api/videos/export-clip] ready (${(clipBytes.byteLength / 1e6).toFixed(1)}MB)`);
		return new Response(Buffer.from(clipBytes), {
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
