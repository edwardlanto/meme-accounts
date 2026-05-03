/**
 * Optional post-pass: replace empty `[data-img-slot]` regions with Fal-generated images.
 * Uses the same `FAL_KEY` credential as `/api/generate`.
 */
import { fal } from '@fal-ai/client';

const DEFAULT_ENDPOINT = 'fal-ai/flux/schnell';

function findClosingDivEnd(html: string, afterOpenTag: number): number {
	let i = afterOpenTag;
	let depth = 1;
	const n = html.length;
	while (i < n && depth > 0) {
		const lt = html.indexOf('<', i);
		if (lt === -1) return -1;
		const tail = html.slice(lt, lt + 4).toLowerCase();
		if (tail.startsWith('<!--')) {
			const end = html.indexOf('-->', lt + 4);
			i = end === -1 ? lt + 4 : end + 3;
			continue;
		}
		if (html.slice(lt, lt + 6).toLowerCase() === '</div>') {
			depth--;
			i = lt + 6;
			if (depth === 0) return lt;
			continue;
		}
		if (/^<div\b/i.test(html.slice(lt))) {
			const gt = html.indexOf('>', lt);
			if (gt === -1) return -1;
			const openChunk = html.slice(lt, gt + 1);
			if (/\/\s*>$/.test(openChunk)) {
				i = gt + 1;
				continue;
			}
			depth++;
			i = gt + 1;
			continue;
		}
		const gt = html.indexOf('>', lt);
		i = gt === -1 ? lt + 1 : gt + 1;
	}
	return -1;
}

function pickFirstUrl(result: unknown): string | null {
	const r = result as { data?: { images?: { url?: string }[] }; images?: { url?: string }[] };
	return r?.data?.images?.[0]?.url ?? r?.images?.[0]?.url ?? null;
}

function extractDataImgLabel(openTag: string): string {
	const m = /\bdata-img-label\s*=\s*"([^"]*)"/i.exec(openTag);
	return m?.[1]?.trim() || 'Carousel image';
}

export async function fillDataImgSlotsWithFal(
	html: string,
	opts: { topic: string; brandName: string; falKey: string; endpoint?: string },
): Promise<{ html: string; filled: number; errors: string[] }> {
	fal.config({ credentials: opts.falKey });
	const endpoint = (opts.endpoint || DEFAULT_ENDPOINT).trim() || DEFAULT_ENDPOINT;
	const topicShort = opts.topic.replace(/\s+/g, ' ').trim().slice(0, 280);
	const brand = (opts.brandName || 'brand').replace(/\s+/g, ' ').trim().slice(0, 80);

	const openRe = /<div\b[^>]*\bdata-img-slot\s*=\s*["'](\d+)["'][^>]*>/gi;
	const matches: { openStart: number; openEnd: number; closeStart: number; slot: string; openTag: string }[] = [];
	let m: RegExpExecArray | null;
	const seenOpen = new Set<number>();
	while ((m = openRe.exec(html)) !== null) {
		const openTag = m[0];
		const openStart = m.index;
		if (seenOpen.has(openStart)) continue;
		seenOpen.add(openStart);
		const openEnd = openStart + openTag.length;
		const closeStart = findClosingDivEnd(html, openEnd);
		if (closeStart < 0) continue;
		const inner = html.slice(openEnd, closeStart);
		if (/\bsrc\s*=\s*["']https?:\/\//i.test(inner)) continue;
		const slot = m[1];
		matches.push({ openStart, openEnd, closeStart, slot, openTag });
	}

	matches.sort((a, b) => b.openStart - a.openStart);

	let out = html;
	let filled = 0;
	const errors: string[] = [];

	for (const hit of matches) {
		const label = extractDataImgLabel(hit.openTag);
		const prompt =
			`Professional editorial photograph for an Instagram carousel (vertical 4:5). ` +
			`Topic: ${topicShort}. Brand context: ${brand}. ` +
			`This frame is: ${label}. ` +
			`Single clear subject, soft natural light, realistic texture, premium magazine aesthetic. ` +
			`Solid or very soft gradient background if needed—no busy patterns. ` +
			`CRITICAL: absolutely no text, no letters, no numbers, no watermark, no logo, no UI mockups.`;

		try {
			const result = await fal.subscribe(endpoint as `fal-ai/${string}`, {
				input: {
					prompt,
					image_size: 'square_hd',
					num_inference_steps: 4,
					num_images: 1,
				},
				logs: false,
			} as Parameters<typeof fal.subscribe>[1]);

			const url = pickFirstUrl(result);
			if (!url) {
				errors.push(`Slot ${hit.slot}: Fal returned no image URL`);
				continue;
			}
			const img = `<img src="${url}" alt="" style="width:100%;height:100%;object-fit:cover;object-position:center;display:block;" />`;
			out = out.slice(0, hit.openEnd) + img + out.slice(hit.closeStart);
			filled++;
		} catch (e: unknown) {
			const msg = e instanceof Error ? e.message : String(e);
			errors.push(`Slot ${hit.slot}: ${msg}`);
		}
	}

	return { html: out, filled, errors };
}
