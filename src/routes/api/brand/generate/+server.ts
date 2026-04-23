import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import type { RequestHandler } from './$types';

const OPENROUTER_API = 'https://openrouter.ai/api/v1/chat/completions';

const SYSTEM_PROMPT = `You are a world-class Instagram carousel designer. Generate a fully self-contained HTML carousel that FAITHFULLY replicates the visual identity extracted from the user's reference images.

## CRITICAL: The brand style JSON is the law
Every design choice must derive from the provided style object:
- Colors: use the EXACT hex values from colorPalette — no substitutions, no invented colors
- Typography: match the font character described precisely. Examples:
  • "bold condensed heavy" → Bebas Neue, Anton, or Oswald Black
  • "elegant serif" → Playfair Display, Lora, or Cormorant
  • "clean humanist sans" → Inter, DM Sans, or Nunito Sans
  • "display bold sans" → Space Grotesk, Syne, or Barlow Condensed
  Load fonts via Google Fonts <link> tags.
- Layout: mirror the layoutPatterns field exactly.
  • "photo-heavy full-bleed with text overlay" → large image areas covering 50–100% of slide, text layered on top with gradient
  • "single-column editorial" → structured text blocks, minimal images
  • "split-photo" → two photo areas side by side or diagonal split
- Mood: dark/dramatic → dark backgrounds + high contrast. Warm/editorial → warm neutrals + airy spacing.
- Visual elements: implement every element listed (gradients, overlays, divider lines, shape cutouts, etc.)

## Technical Requirements
- Canvas: 1080px × 1350px per slide (native Instagram 4:5 format)
- Every slide: <div class="slide"> — exactly SLIDE_COUNT of them
- All CSS in one <style> tag; all JS in one <script> tag at body end
- Google Fonts via <link> tags in <head>
- Navigation: ◀ ▶ arrow buttons + top progress bar
- NO external CSS files. NO remote image URLs.

## Image Placeholders — MANDATORY FORMAT
For every photo/image area, use this exact structure (never use http:// or unsplash URLs):

<div data-img-slot="N" data-img-label="Descriptive label" style="width:100%;height:100%;background:{dark_brand_color};display:flex;align-items:center;justify-content:center;overflow:hidden;position:relative;">
  <span style="color:rgba(255,255,255,0.2);font-size:18px;font-family:sans-serif;letter-spacing:3px;text-transform:uppercase;">▣  Photo {N+1}</span>
</div>

- Increment N starting from 0 across ALL slides (globally unique per carousel)
- Use a brand dark color as placeholder background (not gray #888)
- For split-photo layouts: create two side-by-side containers each with their own data-img-slot

## Text Editability — Tag every text element
<h1 data-text-slot="headline">…</h1>
<h2 data-text-slot="subhead">…</h2>
<p data-text-slot="body-0">…</p>
<p data-text-slot="body-1">…</p>
<span data-text-slot="tag">…</span>
<span data-text-slot="handle">@handle</span>
<span data-text-slot="cta">…</span>
<li data-text-slot="li-0">…</li>

## Slide Narrative Arc
HERO → PROBLEM → PIVOT → LOGIC slides → PRO TIP → CTA

Each slide layout should reflect the brand's visual language while serving its narrative role.
- HERO: most visually impactful — for photo-heavy brands, 1-2 large image placeholders
- PROBLEM / PIVOT / LOGIC: content-focused but using brand's color and layout language
- CTA: strong brand identity, repeat handle/name, clear action

Output ONLY raw HTML starting with <!DOCTYPE html>. No markdown. No explanation.`;

export const POST: RequestHandler = async ({ request }) => {
	const { style, brandName, handle, primaryColor, content, slideCount } = await request.json();

	if (!content) return json({ error: 'Content is required' }, { status: 400 });
	const slideCountNum = Math.min(10, Math.max(3, Number.isFinite(+slideCount) ? Math.round(+slideCount) : 7));

	const styleBlock = typeof style === 'object' && style !== null
		? JSON.stringify(style, null, 2)
		: String(style ?? '{}');

	const h = (handle || 'mybrand').replace(/^@/, '');
	const color = primaryColor || (typeof style === 'object' && style?.primaryColor) || '#FF0000';

	const userMessage = `## Brand Style (extracted from reference images — implement this exactly):
${styleBlock}

## Brand Details
Name: ${brandName || 'My Brand'}
Handle: @${h}
Primary color: ${color}

## SLIDE_COUNT: ${slideCountNum}

## Content to turn into a ${slideCountNum}-slide Instagram carousel:
${content}

## Design Instructions
1. READ the designStyle, mood, visualElements, and layoutPatterns fields above carefully
2. Build a carousel that looks like it CAME FROM THIS BRAND — not a generic template
3. If layoutPatterns mentions photos/images, include prominent image placeholder areas using data-img-slot
4. Use ONLY the colors from colorPalette — no other colors except pure black/white for contrast if needed
5. Choose Google Fonts that closely match the font descriptions
6. Generate exactly ${slideCountNum} slides with class="slide", each 1080px × 1350px
7. Make the HERO slide visually striking and faithful to the reference aesthetic

Output raw HTML only. Start with <!DOCTYPE html>.`;

	if (!env.OPENROUTER_API_KEY) {
		return json({ html: getDemoHtml(brandName, h, color, slideCountNum, style), demo: true });
	}

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
				model: 'anthropic/claude-3.7-sonnet',
				max_tokens: 16000,
				system: SYSTEM_PROMPT,
				messages: [{ role: 'user', content: userMessage }],
			}),
		});

		const data = await res.json();
		if (!res.ok) return json({ error: data.error?.message ?? 'Generation failed' }, { status: 500 });

		let html: string = data.choices?.[0]?.message?.content ?? '';

		// Strip markdown fences if the model wrapped the HTML
		html = html.replace(/^```html?\n?/i, '').replace(/\n?```$/i, '').trim();

		if (!html.includes('<html') && !html.includes('<!DOCTYPE')) {
			return json({ error: 'No HTML returned', raw: html }, { status: 500 });
		}

		return json({ html });
	} catch (e: any) {
		return json({ error: e.message }, { status: 500 });
	}
};

// ── Demo HTML (shown when OPENROUTER_API_KEY is not set) ──────────────────────
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
