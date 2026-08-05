import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import type { RequestHandler } from './$types';
import { brandExtractBodySchema, parseJsonBody } from '$lib/server/request-security';

const OPENROUTER_API = 'https://openrouter.ai/api/v1/chat/completions';

/** Try every reasonable strategy to pull a JSON object out of a model response. */
function extractJson(text: string): Record<string, any> | null {
	// 1. Strip markdown fences (```json ... ``` or ``` ... ```)
	let cleaned = text.replace(/^```(?:json)?\s*/im, '').replace(/\s*```\s*$/im, '').trim();

	// 2. Direct parse
	try { return JSON.parse(cleaned); } catch {}

	// 3. Find first { ... } block (handles extra prose before/after)
	const start = cleaned.indexOf('{');
	const end   = cleaned.lastIndexOf('}');
	if (start !== -1 && end > start) {
		try { return JSON.parse(cleaned.slice(start, end + 1)); } catch {}
	}

	// 4. Try the original untouched text the same way
	const s2 = text.indexOf('{');
	const e2 = text.lastIndexOf('}');
	if (s2 !== -1 && e2 > s2) {
		try { return JSON.parse(text.slice(s2, e2 + 1)); } catch {}
	}

	return null;
}

export const POST: RequestHandler = async ({ request, locals }) => {
	const { user } = await locals.safeGetSession();
	if (!user) return json({ error: 'Unauthorized' }, { status: 401 });

	const parsed = await parseJsonBody(request, brandExtractBodySchema);
	if (!parsed.ok) return json({ error: parsed.error }, { status: parsed.status });

	const { images } = parsed.data;

	if (!env.OPENROUTER_API_KEY) {
		// Demo fallback
		return json({
			style: {
				primaryColor: '#F5A623',
				secondaryColor: '#1A1817',
				backgroundColor: '#FDFCF8',
				accentColor: '#FF6B35',
				textColor: '#1A1A1A',
				fonts: { heading: 'Bold serif with high contrast', body: 'Clean humanist sans-serif' },
				designStyle: 'Modern editorial with warm tones and strong hierarchy',
				mood: 'professional, warm, approachable, confident',
				visualElements: ['rounded corners', 'subtle shadows', 'gradient overlays', 'strong typography'],
				layoutPatterns: 'Single-column vertical with clear section breaks',
				colorPalette: ['#F5A623', '#1A1817', '#FDFCF8', '#FF6B35'],
			},
			demo: true,
		});
	}

	const imageMessages = images.map((img: { data: string; mediaType: string }) => ({
		type: 'image_url',
		image_url: { url: `data:${img.mediaType};base64,${img.data}` },
	}));

	try {
		const res = await fetch(OPENROUTER_API, {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
				'Content-Type': 'application/json',
				'HTTP-Referer': 'https://carousel-studio.app',
				'X-Title': 'Carousel Studio',
			},
			body: JSON.stringify({
				model: 'anthropic/claude-haiku-4-5',
				max_tokens: 2048,
				messages: [
					{
						role: 'user',
						content: [
							...imageMessages,
							{
								type: 'text',
								text: `Analyse the visual style of these images — ignore all written text content. Focus only on: colors, typography style, design aesthetic, mood, layout patterns, and recurring visual elements.

Respond with ONLY a raw JSON object (no markdown, no code fences, no explanation, no preamble). The object must have exactly these fields:

{"primaryColor":"#hex","secondaryColor":"#hex","backgroundColor":"#hex","accentColor":"#hex","textColor":"#hex","fonts":{"heading":"description","body":"description"},"designStyle":"1-2 sentences","mood":"keywords","visualElements":["el1","el2"],"layoutPatterns":"description","colorPalette":["#hex1","#hex2","#hex3","#hex4","#hex5"]}`,
							},
						],
					},
				],
			}),
		});

		const data = await res.json();
		if (!res.ok) {
			const msg = data.error?.message ?? data.error ?? JSON.stringify(data);
			return json({ error: `OpenRouter: ${msg}` }, { status: 500 });
		}

		const text: string = data.choices?.[0]?.message?.content ?? '';

		// Try multiple strategies to extract valid JSON
		const style = extractJson(text);
		if (style) return json({ style });

		return json({ style: null, raw: text, error: 'Could not parse style JSON' });
	} catch (e: any) {
		return json({ error: e.message }, { status: 500 });
	}
};
