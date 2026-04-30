import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import type { RequestHandler } from './$types';

const OPENROUTER_API = 'https://openrouter.ai/api/v1/chat/completions';
const ANTHROPIC_MESSAGES_API = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';
/** Direct Anthropic model (Brand Carousel only, when `CLAUDE_API_KEY` is set). */
const ANTHROPIC_CAROUSEL_MODEL = 'claude-sonnet-4-5';

/** Brand carousel system prompt — `instagram-carousel-prompt2.md` only (see `instagram-carousel-generator.md` for legacy reference). */
const CAROUSEL_PROMPT_FILES = import.meta.glob(
	'../../../../lib/prompts/carousel/instagram-carousel-prompt2.md',
	{ as: 'raw', eager: true },
) as Record<string, string>;

function loadCarouselSystemPrompt(): string {
	const parts = Object.entries(CAROUSEL_PROMPT_FILES)
		.sort(([a], [b]) => a.localeCompare(b))
		.map(([, raw]) => String(raw).trim());
	return parts.join('\n\n---\n\n');
}

type OpenRouterContentPart =
	| { type: 'text'; text: string }
	| { type: 'image_url'; image_url: { url: string } };

type AnthropicUserBlock =
	| { type: 'text'; text: string }
	| {
			type: 'image';
			source: { type: 'base64'; media_type: string; data: string };
	  };

function openRouterPartsToAnthropicBlocks(parts: OpenRouterContentPart[]): AnthropicUserBlock[] {
	const out: AnthropicUserBlock[] = [];
	for (const p of parts) {
		if (p.type === 'text') {
			out.push({ type: 'text', text: p.text });
			continue;
		}
		const url = p.image_url?.url ?? '';
		const m = /^data:([^;]+);base64,(.+)$/i.exec(url);
		if (!m) continue;
		let mediaType = m[1].trim().toLowerCase();
		if (!mediaType.startsWith('image/')) mediaType = 'image/jpeg';
		out.push({
			type: 'image',
			source: { type: 'base64', media_type: mediaType, data: m[2].replace(/\s/g, '') },
		});
	}
	return out;
}

function extractAnthropicMessageText(data: { content?: Array<{ type?: string; text?: string }> }): string {
	const blocks = data?.content;
	if (!Array.isArray(blocks)) return '';
	return blocks
		.filter((b) => b && b.type === 'text' && typeof b.text === 'string')
		.map((b) => b.text as string)
		.join('');
}

function normalizeCarouselHtml(raw: string): string {
	return raw.replace(/^```html?\n?/i, '').replace(/\n?```$/i, '').trim();
}

type ReferenceImage = { data: string; mediaType?: string };

const MAX_REFERENCE_IMAGES = 4;

export const POST: RequestHandler = async ({ request }) => {
	const body = await request.json();
	const { style, brandName, handle, primaryColor, content, slideCount, referenceImages } = body;
	const refs: ReferenceImage[] = Array.isArray(referenceImages)
		? referenceImages
				.filter((r: unknown) => r && typeof r === 'object' && 'data' in (r as ReferenceImage))
				.slice(0, MAX_REFERENCE_IMAGES)
		: [];

	if (!content) return json({ error: 'Content is required' }, { status: 400 });
	const slideCountNum = Math.min(10, Math.max(3, Number.isFinite(+slideCount) ? Math.round(+slideCount) : 7));

	const styleBlock = typeof style === 'object' && style !== null
		? JSON.stringify(style, null, 2)
		: String(style ?? '{}');

	const h = (handle || 'mybrand').replace(/^@/, '');
	const color = primaryColor || (typeof style === 'object' && style?.primaryColor) || '#FF0000';

	const systemPrompt = loadCarouselSystemPrompt();
	if (!systemPrompt.trim()) {
		return json(
			{
				error:
					'Missing carousel prompt: add src/lib/prompts/carousel/instagram-carousel-prompt2.md',
			},
			{ status: 500 },
		);
	}

	const userMessage = `The user submitted this through the Brand Carousel UI. Do not ask clarifying questions — use the data below and follow the system instructions.

## Extracted style (from uploaded reference images; may be empty object if skipped)
${styleBlock}

## Brand details (form)
- Brand name: ${brandName || '(not set — infer from content)'}
- Instagram handle: @${h}
- Primary color: ${color}

## Slide count
Generate exactly **${slideCountNum}** slides (\`<div class="slide">\` each), each **1080px × 1350px**.

## Topic / article / content to turn into the carousel
${content}

Generate the full HTML document now. Start with <!DOCTYPE html>.`;

	const imageParts: { type: 'image_url'; image_url: { url: string } }[] = [];
	for (const img of refs) {
		const mt = typeof img.mediaType === 'string' && img.mediaType.startsWith('image/')
			? img.mediaType
			: 'image/jpeg';
		const data = typeof img.data === 'string' ? img.data.replace(/\s/g, '') : '';
		if (!data) continue;
		imageParts.push({
			type: 'image_url',
			image_url: { url: `data:${mt};base64,${data}` },
		});
	}

	const userContent: Array<
		| { type: 'text'; text: string }
		| { type: 'image_url'; image_url: { url: string } }
	> = [];
	if (imageParts.length) {
		userContent.push({
			type: 'text',
			text: `The next ${imageParts.length} message part(s) are reference image(s) the user uploaded for this brand. Study whitespace, image-to-text balance, grids, and margins — then produce HTML that feels similarly polished and intentional (while still following every slot and dimension rule in the following text).`,
		});
		userContent.push(...imageParts);
	}
	userContent.push({ type: 'text', text: userMessage });

	const claudeKey = env.CLAUDE_API_KEY;
	const openRouterKey = env.OPENROUTER_API_KEY;

	if (!claudeKey && !openRouterKey) {
		return json({ html: getDemoHtml(brandName, h, color, slideCountNum, style), demo: true });
	}

	const openRouterUserContent: OpenRouterContentPart[] | string =
		userContent.length > 1 ? userContent : userMessage;

	try {
		/** Brand Carousel: direct Anthropic API when `CLAUDE_API_KEY` is set. */
		if (claudeKey) {
			const anthropicUserBlocks = Array.isArray(openRouterUserContent)
				? openRouterPartsToAnthropicBlocks(openRouterUserContent)
				: [{ type: 'text' as const, text: openRouterUserContent }];

			const res = await fetch(ANTHROPIC_MESSAGES_API, {
				method: 'POST',
				headers: {
					'x-api-key': claudeKey,
					'anthropic-version': ANTHROPIC_VERSION,
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					model: ANTHROPIC_CAROUSEL_MODEL,
					max_tokens: 16000,
					system: systemPrompt,
					messages: [{ role: 'user', content: anthropicUserBlocks }],
				}),
			});

			const data = await res.json();
			if (!res.ok) {
				const msg =
					typeof data?.error?.message === 'string'
						? data.error.message
						: typeof data?.error === 'string'
							? data.error
							: 'Anthropic request failed';
				return json({ error: msg }, { status: 500 });
			}

			const raw = extractAnthropicMessageText(data);
			const html = normalizeCarouselHtml(raw);
			if (!html.includes('<html') && !html.includes('<!DOCTYPE')) {
				return json({ error: 'No HTML returned', raw: html.slice(0, 2000) }, { status: 500 });
			}
			return json({ html, provider: 'anthropic', model: ANTHROPIC_CAROUSEL_MODEL });
		}

		if (!openRouterKey) {
			return json({ error: 'OPENROUTER_API_KEY is not set' }, { status: 500 });
		}

		const res = await fetch(OPENROUTER_API, {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${openRouterKey}`,
				'Content-Type': 'application/json',
				'HTTP-Referer': 'https://carousel-studio.app',
				'X-Title': 'Carousel Studio',
			},
			body: JSON.stringify({
				model: 'anthropic/claude-3.7-sonnet',
				max_tokens: 16000,
				system: systemPrompt,
				messages: [{ role: 'user', content: openRouterUserContent }],
			}),
		});

		const data = await res.json();
		if (!res.ok) return json({ error: data.error?.message ?? 'Generation failed' }, { status: 500 });

		let html: string = data.choices?.[0]?.message?.content ?? '';
		html = normalizeCarouselHtml(html);

		if (!html.includes('<html') && !html.includes('<!DOCTYPE')) {
			return json({ error: 'No HTML returned', raw: html }, { status: 500 });
		}

		return json({ html, provider: 'openrouter', model: 'anthropic/claude-3.7-sonnet' });
	} catch (e: any) {
		return json({ error: e.message }, { status: 500 });
	}
};

// ── Demo HTML (when `CLAUDE_API_KEY` and `OPENROUTER_API_KEY` are both unset) ─
function getDemoHtml(
	brandName = 'My Brand',
	handle = 'mybrand',
	color = '#FF0000',
	slideCount = 7,
	style: Record<string, any> | null = null,
) {
	const h = handle.replace(/^@/, '');
	const total = Math.min(10, Math.max(3, slideCount));
	const bg = style?.backgroundColor ?? '#111111';
	const textCol = style?.textColor ?? '#FFFFFF';
	const secondaryBg = style?.secondaryColor ?? '#1a1a1a';

	// Derive a slightly lighter bg for alternating slides
	const altBg = '#1c1c1c';

	const slides = Array.from({ length: total }, (_, i) => {
		const isFirst = i === 0;
		const isLast  = i === total - 1;
		const isSecond = i === 1;
		const isLastTwo = i === total - 2;

		if (isFirst) {
			return `
    <div class="slide slide-${i}" style="transform:translateX(${i * 100}%); background:${bg}; position:relative; overflow:hidden;">
      <div class="img-area" data-img-slot="0" data-img-label="Cover photo" style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:${secondaryBg};">
        <span class="img-placeholder">▣  Photo 1</span>
      </div>
      <div class="overlay"></div>
      <div class="slide-content bottom-content">
        <span class="tag" data-text-slot="tag">Hero</span>
        <h1 data-text-slot="headline">${brandName}</h1>
        <p data-text-slot="body-0">Your brand story starts here. Upload a reference image to generate a fully branded carousel.</p>
        <span class="handle-text" data-text-slot="handle">@${h}</span>
      </div>
    </div>`;
		}
		if (isSecond) {
			return `
    <div class="slide slide-${i}" style="transform:translateX(${i * 100}%); background:${altBg};">
      <div class="slide-content">
        <span class="tag" data-text-slot="tag">The Problem</span>
        <div class="divider"></div>
        <h2 data-text-slot="subhead">Most people are still doing it the old way.</h2>
        <p data-text-slot="body-0">And it's costing them time, money, and results.</p>
      </div>
      <span class="handle-text bottom-right" data-text-slot="handle">@${h}</span>
    </div>`;
		}
		if (isLast) {
			return `
    <div class="slide slide-${i}" style="transform:translateX(${i * 100}%); background:${color};">
      <div class="slide-content">
        <span class="tag tag-dark" data-text-slot="tag">Subscribe</span>
        <div class="divider" style="background:${bg};"></div>
        <h2 data-text-slot="subhead" style="color:${bg};">Your Quick-Reference Checklist</h2>
        <ul class="checklist">
          <li data-text-slot="li-0">Point one to remember</li>
          <li data-text-slot="li-1">Point two to remember</li>
          <li data-text-slot="li-2">Point three to remember</li>
        </ul>
        <p data-text-slot="cta" style="color:${bg};font-size:22px;margin-top:32px;">Follow <strong>@${h}</strong> for more.</p>
      </div>
    </div>`;
		}
		if (isLastTwo) {
			return `
    <div class="slide slide-${i}" style="transform:translateX(${i * 100}%); background:${bg};">
      <div class="slide-content">
        <span class="tag" data-text-slot="tag">Pro Tip</span>
        <div class="divider"></div>
        <h2 data-text-slot="subhead">The expert workflow.</h2>
        <div class="tip-box">
          <p data-text-slot="body-0">Here's exactly how to apply this today, step by step.</p>
        </div>
      </div>
      <span class="handle-text bottom-right" data-text-slot="handle">@${h}</span>
    </div>`;
		}
		const n = i - 1;
		return `
    <div class="slide slide-${i}" style="transform:translateX(${i * 100}%); background:${i % 2 === 0 ? bg : altBg};">
      <div class="slide-content">
        <span class="tag" data-text-slot="tag">Key Insight #${n}</span>
        <div class="divider"></div>
        <h2 data-text-slot="subhead">Insight #${n} headline</h2>
        <p data-text-slot="body-0">Supporting context for this insight. Keep it short and scannable.</p>
      </div>
      <span class="handle-text bottom-right" data-text-slot="handle">@${h}</span>
    </div>`;
	}).join('\n');

	return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${brandName} Carousel</title>
<link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@300;400;600;700&display=swap" rel="stylesheet">
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: #000; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; padding: 20px; }
  .container { position: relative; width: 1080px; }
  .progress-bar { width: 100%; height: 5px; background: rgba(255,255,255,0.12); border-radius: 3px; margin-bottom: 14px; overflow: hidden; }
  .progress-fill { height: 100%; background: ${color}; border-radius: 3px; transition: width 0.35s ease; }
  .carousel { width: 1080px; height: 1350px; position: relative; overflow: hidden; border-radius: 16px; }
  .slide {
    position: absolute;
    width: 1080px; height: 1350px;
    display: flex; flex-direction: column;
    transition: transform 0.4s cubic-bezier(.4,0,.2,1);
    font-family: 'DM Sans', sans-serif;
    color: ${textCol};
  }
  .slide-content { position: relative; z-index: 10; display: flex; flex-direction: column; justify-content: flex-end; padding: 72px 80px; height: 100%; }
  .bottom-content { justify-content: flex-end; }
  .img-area { position: absolute; inset: 0; }
  .img-placeholder { color: rgba(255,255,255,0.15); font-size: 22px; font-family: sans-serif; letter-spacing: 4px; text-transform: uppercase; }
  .overlay { position: absolute; inset: 0; z-index: 5; background: linear-gradient(to bottom, rgba(0,0,0,0) 30%, rgba(0,0,0,0.85) 100%); }
  .tag { display: inline-block; background: ${color}; color: ${bg}; font-family: 'DM Sans', sans-serif; font-size: 22px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase; padding: 8px 20px; border-radius: 6px; margin-bottom: 24px; align-self: flex-start; }
  .tag-dark { background: ${bg}; color: ${color}; }
  h1 { font-family: 'Bebas Neue', sans-serif; font-size: 128px; line-height: 1.0; margin-bottom: 24px; }
  h2 { font-family: 'Bebas Neue', sans-serif; font-size: 88px; line-height: 1.05; margin-bottom: 24px; }
  p { font-size: 32px; line-height: 1.5; color: rgba(255,255,255,0.8); margin-bottom: 20px; }
  .divider { width: 60px; height: 4px; background: ${color}; border-radius: 2px; margin-bottom: 32px; }
  .handle-text { font-size: 24px; font-weight: 700; color: ${color}; margin-top: 16px; }
  .handle-text.bottom-right { position: absolute; bottom: 40px; right: 64px; z-index: 10; }
  .tip-box { background: ${color}22; border-left: 5px solid ${color}; padding: 28px 32px; border-radius: 0 12px 12px 0; margin-top: 16px; }
  .tip-box p { color: ${textCol}cc; font-size: 28px; }
  .checklist { list-style: none; margin-top: 24px; }
  .checklist li { font-size: 30px; padding: 10px 0; display: flex; gap: 16px; align-items: flex-start; color: ${bg}dd; }
  .checklist li::before { content: "✓"; color: ${bg}; font-weight: 900; font-size: 28px; flex-shrink: 0; }
  .arrows { display: flex; justify-content: space-between; margin-top: 14px; }
  .arrow { width: 48px; height: 48px; border-radius: 50%; border: 1.5px solid rgba(255,255,255,0.2); background: rgba(255,255,255,0.08); color: #fff; font-size: 20px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.2s; }
  .arrow:hover { background: ${color}; border-color: ${color}; }
  .slide-counter { text-align: center; font-family: 'DM Sans', sans-serif; font-size: 18px; color: rgba(255,255,255,0.35); margin-top: 10px; }
</style>
</head>
<body>
<div class="container">
  <div class="progress-bar"><div class="progress-fill" id="progress" style="width:${(1/total*100).toFixed(1)}%"></div></div>
  <div class="carousel" id="carousel">
${slides}
  </div>
  <div class="arrows">
    <button class="arrow" onclick="navigate(-1)">◀</button>
    <button class="arrow" onclick="navigate(1)">▶</button>
  </div>
  <div class="slide-counter" id="counter">1 / ${total}</div>
</div>
<script>
  let cur = 0; const total = ${total};
  function navigate(dir) {
    cur = Math.max(0, Math.min(total - 1, cur + dir));
    document.querySelectorAll('.slide').forEach((s, i) => s.style.transform = \`translateX(\${(i - cur) * 100}%)\`);
    document.getElementById('progress').style.width = ((cur + 1) / total * 100).toFixed(1) + '%';
    document.getElementById('counter').textContent = (cur + 1) + ' / ' + total;
  }
  document.addEventListener('keydown', e => {
    if (e.key === 'ArrowLeft') navigate(-1);
    if (e.key === 'ArrowRight') navigate(1);
  });
<\/script>
</body>
</html>`;
}
