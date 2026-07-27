import { json } from '@sveltejs/kit';
import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import type { RequestHandler } from './$types';
import { parseJsonBody, isValidOwnerR2Key } from '$lib/server/request-security';
import { r2PutObject, r2SignGet } from '$lib/server/r2';
import { buildClipMp4Bytes, reframeSettingsKey } from '$lib/server/clip-export';

const reframeSchema = z.object({
	aspectRatio: z.enum(['9:16', '1:1', '16:9', '4:5']).default('9:16'),
	method: z.enum(['detection', 'saliency']).default('detection'),
	motionThreshold: z.number().min(0).max(1).default(0.5),
	paddingMethod: z.enum(['blur', 'solid_color']).default('blur'),
	debug: z.boolean().default(false),
});

const schema = z.object({
	r2Key: z.string().max(600),
	startSec: z.number().min(0),
	endSec: z.number().min(0.5),
	clipId: z.string().max(120).optional(),
	speechWindows: z
		.array(
			z.object({
				startSec: z.number().min(0),
				endSec: z.number().min(0),
			}),
		)
		.max(40)
		.optional(),
	reframe: reframeSchema,
});

/** Cut + reframe a clip and store the result on R2 for preview / download. */
export const POST: RequestHandler = async ({ request, locals }) => {
	const { user } = await locals.safeGetSession();
	if (!user) return json({ error: 'Unauthorized' }, { status: 401 });

	const parsed = await parseJsonBody(request, schema);
	if (!parsed.ok) return json({ error: parsed.error }, { status: parsed.status });

	const { r2Key, startSec, endSec, clipId, speechWindows, reframe } = parsed.data;
	if (!isValidOwnerR2Key(user.id, r2Key)) {
		return json({ error: 'Invalid video key' }, { status: 403 });
	}
	if (endSec <= startSec) return json({ error: 'Invalid clip range' }, { status: 400 });

	try {
		const bytes = await buildClipMp4Bytes({
			sourceR2Key: r2Key,
			startSec,
			endSec,
			speechWindows,
			reframe,
			signal: request.signal,
		});

		if (request.signal.aborted) {
			return json({ error: 'Canceled' }, { status: 499 });
		}

		const safeClip = (clipId || 'clip').replace(/[^\w.-]+/g, '_').slice(0, 40);
		const outKey = `${user.id}/videos/reframed/${safeClip}-${randomUUID()}.mp4`;
		await r2PutObject(outKey, bytes, 'video/mp4');
		const playbackUrl = await r2SignGet(outKey, 7200);

		console.info(
			`[api/videos/reframe-clip] stored ${outKey} (${(bytes.byteLength / 1e6).toFixed(1)}MB)`,
		);

		return json({
			r2Key: outKey,
			playbackUrl,
			settingsKey: reframeSettingsKey(reframe),
			byteLength: bytes.byteLength,
		});
	} catch (e: unknown) {
		if (
			(e instanceof DOMException && e.name === 'AbortError') ||
			(e instanceof Error && e.name === 'AbortError') ||
			request.signal.aborted
		) {
			console.info('[api/videos/reframe-clip] canceled');
			return json({ error: 'Canceled' }, { status: 499 });
		}
		const message = e instanceof Error ? e.message : String(e);
		console.error('[api/videos/reframe-clip]', message);
		return json({ error: message }, { status: 500 });
	}
};
