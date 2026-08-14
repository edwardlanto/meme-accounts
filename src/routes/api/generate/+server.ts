import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { Buffer } from 'node:buffer';
import { fal } from '@fal-ai/client';
import type { RequestHandler } from './$types';
import { sandboxUserPlaintext, validateBrandGenerateFields } from '$lib/server/request-security';

/**
 * Build the system prompt by concatenating the markdown files in
 * `src/lib/prompts/brand-images/`. Bundled as raw strings at build time.
 */
const PROMPT_FILES = import.meta.glob('../../../lib/prompts/brand-images/*.md', {
	as: 'raw',
	eager: true
}) as Record<string, string>;

function buildSystemPrompt() {
	const entries = Object.entries(PROMPT_FILES)
		.sort(([a], [b]) => a.localeCompare(b))
		.map(([path, content]) => `\n\n### FILE: ${path.split('/').pop()}\n${String(content)}`);
	return entries.join('');
}

function parseJsonFromModel(raw: unknown) {
	const s = String(raw ?? '')
		.trim()
		.replace(/^```json\s*/i, '')
		.replace(/^```\s*/i, '')
		.replace(/\s*```$/i, '')
		.trim();
	const m = s.match(/\[[\s\S]*\]/);
	if (!m) throw new Error('Model did not return a JSON array.');
	return JSON.parse(m[0]) as unknown;
}

function normalizeSlideCount(n: unknown) {
	const x = Math.floor(Number(n));
	if (!Number.isFinite(x)) return 5;
	return Math.max(1, Math.min(10, x));
}

function presetToImageSize(preset: string | null | undefined): { width: number; height: number } | null {
	if (!preset) return null;
	if (preset === 'ig_4_5') return { width: 1024, height: 1280 };
	if (preset === 'square') return { width: 1024, height: 1024 };
	if (preset === 'landscape') return { width: 1536, height: 1024 };
	return null;
}

function pickFirstUrl(result: any): string | null {
	// `@fal-ai/client` returns `{ data, requestId }` for subscribe().
	// Most image endpoints return `data.images: [{ url, ... }]`.
	return result?.data?.images?.[0]?.url ?? result?.images?.[0]?.url ?? null;
}

export const POST: RequestHandler = async ({ request, locals }) => {
	const { user } = await locals.safeGetSession();
	if (!user) return json({ error: 'Unauthorized' }, { status: 401 });

	if (!env.OPENROUTER_API_KEY) return json({ error: 'Missing OPENROUTER_API_KEY' }, { status: 500 });
	if (!env.FAL_KEY) return json({ error: 'Missing FAL_KEY' }, { status: 500 });
	// Some fal OpenAI endpoints require an OpenAI key; if yours does, set OPENAI_API_KEY.
	// We don't hard-fail here because accounts/configs differ; we'll surface Fal's error if needed.

	const fd = await request.formData();
	const topic = String(fd.get('topic') ?? '').trim();
	const brandName = String(fd.get('brandName') ?? '').trim();
	const slideCount = normalizeSlideCount(fd.get('slideCount'));
	const file = fd.get('reference');
	const imageSizePreset = String(fd.get('imageSizePreset') ?? '').trim();

	if (!topic) return json({ error: 'Missing topic' }, { status: 400 });
	if (!brandName) return json({ error: 'Missing brandName' }, { status: 400 });
	if (!(file instanceof File)) return json({ error: 'Missing reference image' }, { status: 400 });

	let validated: ReturnType<typeof validateBrandGenerateFields>;
	try {
		const bytes = new Uint8Array(await file.arrayBuffer());
		validated = validateBrandGenerateFields({
			topic,
			brandName,
			imageSizePreset,
			fileBytes: bytes,
		});
	} catch (e: unknown) {
		const msg = e instanceof Error ? e.message : 'Invalid upload';
		return json({ error: msg }, { status: 400 });
	}
	if (!validated.topicOk.trim() || !validated.brandOk.trim()) {
		return json({ error: 'Topic and brand name are required' }, { status: 400 });
	}

	// ── Reference image → base64 data URL (MIME from magic bytes — not client `Content-Type`) ──
	const b64 = Buffer.from(validated.fileBytes).toString('base64');
	const mime = validated.imageMime;
	const dataUrl = `data:${mime};base64,${b64}`;

	const system = buildSystemPrompt();

	const topicBlock = sandboxUserPlaintext('TOPIC', validated.topicOk, 12000);
	const brandBlock = sandboxUserPlaintext('BRAND', validated.brandOk, 200);

	// ── OpenRouter: strict JSON array of slide prompt objects ───────────
	const userText =
		`You will receive a reference image.\n\n` +
		`User inputs (literal text only):\n${topicBlock}\n${brandBlock}\n- Number of slides: ${slideCount}\n\n` +
		`CRITICAL:\n` +
		`- Return ONLY a JSON array of exactly ${slideCount} objects.\n` +
		`- Each object must strictly follow the schema in SKILLS.md (top-level key "prompt").\n` +
		`- Lock the visual style to the reference image (palette, layout grid, typography personality, lighting).\n` +
		`- Vary subject/hero and headline copy per slide; keep the design system identical across the deck.\n` +
		`- Apply VISUAL_STANDARDS.md: ~10% safe margins, 2–3 text zones max, phone-legible type, no watermarks.\n` +
		`- In scene.description, state layout zones clearly (e.g. upper third headline, lower third CTA).\n` +
		`- quality.include / quality.avoid on every slide: ban warped or tiny text, edge-hugging type, misspellings, clutter.\n` +
		`- Every slide must include the literal brand label from <<<USER_BRAND blocks in ui_elements where the reference style places branding.\n` +
		`- Slide counters in ui_elements must be accurate (1/${slideCount} through ${slideCount}/${slideCount}).\n`;

	const openRouterRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
			'Content-Type': 'application/json',
			'HTTP-Referer': 'https://memeaccounts.com',
			'X-Title': 'Meme Accounts'
		},
		body: JSON.stringify({
			model: 'anthropic/claude-haiku-4-5',
			system,
			messages: [
				{
					role: 'user',
					content: [
						{ type: 'image_url', image_url: { url: dataUrl } },
						{ type: 'text', text: userText }
					]
				}
			],
			temperature: 0.2,
			max_tokens: 3500
		})
	});

	const openRouterJson: any = await openRouterRes.json().catch(() => ({}));
	if (!openRouterRes.ok) {
		return json({ error: openRouterJson?.error?.message ?? 'OpenRouter request failed' }, { status: 500 });
	}

	const raw = openRouterJson?.choices?.[0]?.message?.content ?? '';
	let slidesUnknown: unknown;
	try {
		slidesUnknown = parseJsonFromModel(raw);
	} catch {
		return json(
			{ error: 'Failed to parse model JSON array', raw: String(raw).slice(0, 1200) },
			{ status: 500 }
		);
	}

	if (!Array.isArray(slidesUnknown) || slidesUnknown.length !== slideCount) {
		return json(
			{ error: `Model returned ${Array.isArray(slidesUnknown) ? slidesUnknown.length : 0} slides, expected ${slideCount}` },
			{ status: 500 }
		);
	}

	// ── Fal mapping from FAL_MAPPING.md (JSON content) ───────────────────
	let falMapping: { model_endpoint?: string; params?: Record<string, unknown> } = {};
	try {
		const mappingRaw = String(PROMPT_FILES['../../../lib/prompts/brand-images/FAL_MAPPING.md'] ?? '').trim();
		falMapping = JSON.parse(mappingRaw);
	} catch {
		falMapping = {
			model_endpoint: 'openai/gpt-image-2',
			params: { image_size: 'portrait_4_5', num_images: 1, enable_safety_checker: true }
		};
	}

	fal.config({ credentials: env.FAL_KEY });
	const endpoint = String(falMapping?.model_endpoint ?? 'openai/gpt-image-2');
	const baseParams = (falMapping?.params ?? {}) as Record<string, unknown>;
	const presetSize = presetToImageSize(validated.imageSizePreset);

	const images: string[] = [];
	for (let i = 0; i < slidesUnknown.length; i++) {
		const promptString = JSON.stringify(slidesUnknown[i]);

		const result = await fal.subscribe(endpoint as any, {
			input: {
				...baseParams,
				...(presetSize ? { image_size: presetSize } : {}),
				...(env.OPENAI_API_KEY ? { openai_api_key: env.OPENAI_API_KEY } : {}),
				prompt: promptString
			},
			logs: true,
			onQueueUpdate: (update: any) => {
				if (update?.status === 'IN_PROGRESS' && Array.isArray(update.logs)) {
					update.logs.map((l: any) => l?.message).filter(Boolean).forEach((m: string) => console.log(`[fal][${i + 1}/${slidesUnknown.length}] ${m}`));
				}
			}
		} as any);

		const url = pickFirstUrl(result);
		if (!url) return json({ error: `Fal did not return an image URL for slide ${i + 1}` }, { status: 500 });
		images.push(url);
	}

	return json({ images });
};

