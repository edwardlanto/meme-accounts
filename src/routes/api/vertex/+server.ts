import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { Buffer } from 'node:buffer';
import { fal } from '@fal-ai/client';
import type { RequestHandler } from './$types';
import { assertPublicHttpsUrl, parseJsonBody, vertexBodySchema } from '$lib/server/request-security';
import { canConsumeAiImages, consumeAiImages } from '$lib/server/usage';

/** Cheap text-to-image — Nano Banana 2 Lite */
const T2I_ENDPOINT = 'google/nano-banana-2-lite';
/** Image-to-image / edit — Nano Banana 2 Edit */
const I2I_ENDPOINT = 'fal-ai/nano-banana-2/edit';

/** Simple in-memory LRU cache (prompt → dataUrl) */
const cache = new Map<string, string>();
const MAX_CACHE = 50;

const ASPECT_RATIO_SET = new Set([
	'auto',
	'21:9',
	'16:9',
	'3:2',
	'4:3',
	'5:4',
	'1:1',
	'4:5',
	'3:4',
	'2:3',
	'9:16',
	'4:1',
	'1:4',
	'8:1',
	'1:8',
]);

function cacheSet(key: string, val: string) {
	if (cache.size >= MAX_CACHE) {
		const first = cache.keys().next().value;
		if (first) cache.delete(first);
	}
	cache.set(key, val);
}

function sleep(ms: number) {
	return new Promise<void>((r) => setTimeout(r, ms));
}

function pickFirstImageUrl(result: unknown): string | null {
	const r = result as { data?: { images?: { url?: string }[] }; images?: { url?: string }[] };
	return r?.data?.images?.[0]?.url ?? r?.images?.[0]?.url ?? null;
}

function normalizeAspect(aspect: unknown): string {
	const a = String(aspect ?? '3:4').trim();
	return ASPECT_RATIO_SET.has(a) ? a : '3:4';
}

function normalizeImageUrls(body: Record<string, unknown>): string[] {
	const urls: string[] = [];
	const single = body.imageUrl ?? body.image_url;
	if (typeof single === 'string' && single.trim()) urls.push(single.trim());
	const list = body.imageUrls ?? body.image_urls;
	if (Array.isArray(list)) {
		for (const u of list) {
			if (typeof u === 'string' && u.trim()) urls.push(u.trim());
		}
	}
	return [...new Set(urls)].slice(0, 14);
}

function safeRemoteImageUrls(urls: string[]): string[] {
	const out: string[] = [];
	for (const raw of urls) {
		if (raw.startsWith('data:')) {
			out.push(raw);
			continue;
		}
		out.push(assertPublicHttpsUrl(raw).toString());
	}
	return out;
}

async function urlToDataUrl(url: string): Promise<string> {
	if (url.startsWith('data:')) return url;
	const res = await fetch(url);
	if (!res.ok) throw new Error(`Failed to download Fal image (${res.status})`);
	const buf = Buffer.from(await res.arrayBuffer());
	const ct = (res.headers.get('content-type') || 'image/jpeg').split(';')[0].trim() || 'image/jpeg';
	return `data:${ct};base64,${buf.toString('base64')}`;
}

function isRetryableFalError(err: unknown): boolean {
	const msg = err instanceof Error ? err.message : String(err ?? '');
	return /429|503|502|rate|quota|timeout|ECONNRESET|fetch failed/i.test(msg);
}

export const POST: RequestHandler = async ({ request, locals }) => {
	const { user } = await locals.safeGetSession();
	if (!user) return json({ error: 'Unauthorized' }, { status: 401 });

	const parsed = await parseJsonBody(request, vertexBodySchema);
	if (!parsed.ok) return json({ error: parsed.error }, { status: parsed.status });

	const body = parsed.data;
	const { prompt, aspect = '3:4', context, skipCache } = body;

	if (!prompt.trim()) {
		return json({ error: 'Missing prompt' }, { status: 400 });
	}

	const falKey = env.FAL_AI_API_KEY?.trim();
	if (!falKey) {
		return json({
			dataUrl: null,
			demo: true,
			message: 'Configure FAL_AI_API_KEY to enable image generation.',
		});
	}

	const aspectRatio = normalizeAspect(aspect);
	let imageUrls: string[];
	try {
		imageUrls = safeRemoteImageUrls(normalizeImageUrls(body as Record<string, unknown>));
	} catch (e: unknown) {
		const msg = e instanceof Error ? e.message : 'Invalid image URL';
		return json({ error: msg }, { status: 400 });
	}
	const isEdit = imageUrls.length > 0;

	const cacheKey = `${isEdit ? 'edit' : 't2i'}:${prompt}:${aspectRatio}:${imageUrls.join('|')}`;
	if (!skipCache && cache.has(cacheKey)) {
		return json({ dataUrl: cache.get(cacheKey), cached: true });
	}

	const imageGate = await canConsumeAiImages(user.id, 1);
	if (!imageGate.ok) {
		return json(
			{
				error: imageGate.error,
				code: imageGate.code,
				usage: imageGate.status,
			},
			{ status: 402 },
		);
	}

	const fullPrompt = isEdit
		? `${String(prompt).trim()}${context ? ` Context: ${context}` : ''}`
		: `Editorial news photograph: ${String(prompt).trim()}.
${context ? `Context: ${context}` : ''}
Photojournalistic, natural light, no text overlays, Instagram-ready (${aspectRatio}).`;

	fal.config({ credentials: falKey });

	const endpoint = isEdit ? I2I_ENDPOINT : T2I_ENDPOINT;
	const input: Record<string, unknown> = {
		prompt: fullPrompt,
		aspect_ratio: aspectRatio,
		num_images: 1,
		// Cheap / fast defaults
		output_format: 'jpeg',
		limit_generations: true,
		safety_tolerance: '4',
	};

	if (isEdit) {
		input.image_urls = imageUrls;
		// 0.5K is the cheapest resolution tier for Nano Banana 2 edit
		input.resolution = '0.5K';
	}

	const model = endpoint;
	const maxAttempts = 4;
	let lastErr = '';

	for (let attempt = 0; attempt < maxAttempts; attempt++) {
		try {
			const result = await fal.subscribe(endpoint as Parameters<typeof fal.subscribe>[0], {
				input,
				logs: false,
			} as Parameters<typeof fal.subscribe>[1]);

			const imageUrl = pickFirstImageUrl(result);
			if (!imageUrl) {
				return json({ error: 'No image returned from Fal' }, { status: 500 });
			}

			const dataUrl = await urlToDataUrl(imageUrl);
			if (!skipCache) cacheSet(cacheKey, dataUrl);

			const billed = await consumeAiImages(user.id, 1);
			if (!billed.ok) {
				return json(
					{
						error: billed.error,
						code: billed.code,
						usage: billed.status,
					},
					{ status: 402 },
				);
			}

			return json({ dataUrl, model, usage: billed.status });
		} catch (err: unknown) {
			lastErr = err instanceof Error ? err.message : String(err);
			console.warn(`[api/vertex] Fal attempt ${attempt + 1}/${maxAttempts}:`, lastErr);
			if (isRetryableFalError(err) && attempt < maxAttempts - 1) {
				await sleep(Math.min(10_000, 500 * 2 ** attempt));
				continue;
			}
			break;
		}
	}

	console.error('[api/vertex] Fal generation error:', lastErr);
	return json({ error: `Fal error: ${lastErr || 'unknown'}` }, { status: 500 });
};
