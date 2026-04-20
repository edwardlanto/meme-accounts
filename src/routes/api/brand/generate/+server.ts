import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import type { RequestHandler } from './$types';

const OPENROUTER_API = 'https://openrouter.ai/api/v1/chat/completions';

const SYSTEM_PROMPT = `You are an Instagram carousel design system. Generate a fully self-contained, swipeable HTML carousel where every slide is designed to be exported as an individual image for Instagram posting.

Rules:
- Every slide must be exactly 400px × 500px (4:5 ratio)
- Use Google Fonts: 'Lora' for headings, 'Nunito Sans' for body text
- Design Style: Editorial Infographic / Newsletter-style — single-column vertical layout with sectioned content blocks
- Include left/right arrow buttons and a progress bar at the top
- All CSS must be embedded in a <style> tag, no external CSS files
- All JavaScript must be inline in a <script> tag

Color System — derive from the provided primary color:
- BRAND_PRIMARY: user's color — for progress bars, icons, tags
- BRAND_LIGHT: primary lightened 20% — pills, highlights
- BRAND_DARK: primary darkened 30% — CTA text, gradient anchors
- LIGHT_BG: #FDFCF8 (warm cream) or #F8F9FA (cool white) — main light background
- DARK_BG: #1A1817 (near-black with primary tint) — high-impact background
- TEXT_MAIN: #1A1A1A — for light slides
- TEXT_INVERSE: #F9F9F9 — for dark slides

Slide Structure (variable length):
- You will be told an exact SLIDE_COUNT (3–10). Generate exactly that many slides with class "slide".
- Always include these sections in order: HERO → PROBLEM → PIVOT → (one or more LOGIC slides) → PRO TIP → CTA.
- If SLIDE_COUNT is smaller, merge adjacent sections while preserving the narrative arc.
- If SLIDE_COUNT is larger, add additional LOGIC slides (Key Insight / Stat / Example / Framework) — keep each slide scannable.

Navigation JavaScript: clicking arrows changes slide, progress bar updates. Keyboard left/right also works.

After the carousel container, include this export note styled in small muted text:
<p style="text-align:center;font-family:'Nunito Sans',sans-serif;font-size:11px;color:rgba(255,255,255,0.3);margin-top:16px;line-height:1.6;">To export for Instagram: Open in Chrome → Right-click each slide → Screenshot,<br>or use an extension like GoFullPage.</p>

Generate ONLY the complete HTML document. No explanation, no markdown fences, just raw HTML starting with <!DOCTYPE html>.`;

export const POST: RequestHandler = async ({ request }) => {
	const { style, brandName, handle, primaryColor, content, slideCount } = await request.json();

	if (!content) return json({ error: 'Content is required' }, { status: 400 });
	const slideCountNum = Math.min(10, Math.max(3, Number.isFinite(+slideCount) ? Math.round(+slideCount) : 7));

	const styleBlock = typeof style === 'object' && style !== null
		? JSON.stringify(style, null, 2)
		: String(style ?? '');

	const userMessage = `Brand Style (extracted from reference images):
${styleBlock}

Brand Name: ${brandName || 'My Brand'}
Instagram Handle: @${(handle || 'mybrand').replace(/^@/, '')}
Primary Color: ${primaryColor || style?.primaryColor || '#F5A623'}
SLIDE_COUNT: ${slideCountNum}

Content / Topic to turn into a carousel:
${content}

Generate the complete ${slideCountNum}-slide HTML carousel now. Apply the brand style (colors, mood, design language) throughout.

Hard requirements:
- Exactly ${slideCountNum} elements with class="slide"
- Ensure the progress indicator and slide counter match ${slideCountNum}

Output raw HTML only.`;

	if (!env.OPENROUTER_API_KEY) {
		// Return a demo HTML
		return json({ html: getDemoHtml(brandName, handle, primaryColor, slideCountNum), demo: true });
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
				max_tokens: 8192,
				system: SYSTEM_PROMPT,
				messages: [{ role: 'user', content: userMessage }],
			}),
		});

		const data = await res.json();
		if (!res.ok) return json({ error: data.error?.message ?? 'Generation failed' }, { status: 500 });

		let html: string = data.choices?.[0]?.message?.content ?? '';

		// Strip markdown fences if Claude wrapped the HTML
		html = html.replace(/^```html?\n?/i, '').replace(/\n?```$/i, '').trim();

		if (!html.includes('<html') && !html.includes('<!DOCTYPE')) {
			return json({ error: 'No HTML returned', raw: html }, { status: 500 });
		}

		return json({ html });
	} catch (e: any) {
		return json({ error: e.message }, { status: 500 });
	}
};

function getDemoHtml(brandName = 'My Brand', handle = 'mybrand', color = '#F5A623', slideCount = 7) {
	const h = (handle || 'mybrand').replace(/^@/, '');
	const total = Math.min(10, Math.max(3, slideCount));
	return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${brandName} Carousel</title>
<link href="https://fonts.googleapis.com/css2?family=Lora:wght@400;600;700&family=Nunito+Sans:wght@300;400;600;700&display=swap" rel="stylesheet">
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: #111; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; font-family: 'Nunito Sans', sans-serif; padding: 20px; }
  .container { position: relative; width: 400px; }
  .progress-bar { width: 100%; height: 4px; background: rgba(255,255,255,0.15); border-radius: 2px; margin-bottom: 12px; overflow: hidden; }
  .progress-fill { height: 100%; background: ${color}; border-radius: 2px; transition: width 0.3s ease; }
  .carousel { width: 400px; height: 500px; position: relative; overflow: hidden; border-radius: 12px; }
  .slide { position: absolute; width: 400px; height: 500px; display: flex; flex-direction: column; justify-content: center; align-items: flex-start; padding: 40px 36px; transition: transform 0.4s cubic-bezier(.4,0,.2,1); }
  .slide-1 { background: #FDFCF8; }
  .slide-2 { background: #1A1817; }
  .slide-3 { background: #FDFCF8; }
  .slide-4 { background: #F8F9FA; }
  .slide-5 { background: #F8F9FA; }
  .slide-6 { background: #FDFCF8; }
  .slide-7 { background: #1A1817; }
  .tag { display: inline-block; background: ${color}22; color: ${color}; font-family: 'Nunito Sans'; font-size: 11px; font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase; padding: 4px 10px; border-radius: 4px; margin-bottom: 16px; }
  .slide h1 { font-family: 'Lora'; font-size: 32px; font-weight: 700; color: #1A1A1A; line-height: 1.2; margin-bottom: 12px; }
  .slide h2 { font-family: 'Lora'; font-size: 26px; font-weight: 700; color: #1A1A1A; line-height: 1.25; margin-bottom: 14px; }
  .dark h1, .dark h2 { color: #F9F9F9; }
  .slide p { font-family: 'Nunito Sans'; font-size: 15px; color: #444; line-height: 1.6; }
  .dark p { color: #ccc; }
  .accent { color: ${color}; }
  .divider { width: 40px; height: 3px; background: ${color}; border-radius: 2px; margin-bottom: 20px; }
  .brand { position: absolute; bottom: 20px; right: 24px; font-family: 'Nunito Sans'; font-size: 11px; color: #aaa; font-weight: 600; }
  .dark .brand { color: #666; }
  .arrows { display: flex; justify-content: space-between; margin-top: 12px; }
  .arrow { width: 36px; height: 36px; border-radius: 50%; border: 1.5px solid rgba(255,255,255,0.2); background: rgba(255,255,255,0.08); color: #fff; font-size: 16px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.2s; }
  .arrow:hover { background: ${color}; border-color: ${color}; }
  .slide-counter { text-align: center; font-family: 'Nunito Sans'; font-size: 12px; color: rgba(255,255,255,0.4); margin-top: 8px; }
  .tip-box { background: ${color}18; border-left: 3px solid ${color}; padding: 14px 16px; border-radius: 0 8px 8px 0; margin-top: 16px; width: 100%; }
  .checklist { list-style: none; margin-top: 16px; }
  .checklist li { font-family: 'Nunito Sans'; font-size: 14px; color: #ccc; padding: 6px 0; display: flex; gap: 10px; align-items: center; }
  .checklist li::before { content: "✓"; color: ${color}; font-weight: 700; }
  .handle { color: ${color}; font-weight: 700; }
</style>
</head>
<body>
<div class="container">
  <div class="progress-bar"><div class="progress-fill" id="progress" style="width:${(1 / total) * 100}%"></div></div>
  <div class="carousel" id="carousel">
    <div class="slide slide-1" style="transform:translateX(0%)">
      <div class="tag">Cheat Sheet</div>
      <div class="divider"></div>
      <h1>5 Things You Didn't Know About This Topic</h1>
      <p>A visual breakdown that'll change how you think about it.</p>
      <div class="brand">@${h}</div>
    </div>
    <div class="slide slide-2 dark" style="transform:translateX(100%)">
      <div class="tag" style="background:#fff1;color:#fff9">The Problem</div>
      <div class="divider"></div>
      <h2>Most people are still doing it the old way.</h2>
      <p>And it's costing them time, money, and results.</p>
      <div class="brand">@${h}</div>
    </div>
    <div class="slide slide-3" style="transform:translateX(200%)">
      <div class="tag">The Pivot</div>
      <div class="divider"></div>
      <h2>Here's the shift that changes everything.</h2>
      <p>Once you see it, you can't unsee it.</p>
      <div class="brand">@${h}</div>
    </div>
${Array.from({ length: total }, (_, i) => i)
	.map((i) => {
		if (i < 3) return '';
		if (i === total - 1) {
			return `    <div class="slide slide-7 dark" style="transform:translateX(${i * 100}%)">
      <div class="tag" style="background:${color};color:#fff">Subscribe</div>
      <div class="divider"></div>
      <h2>Your quick-reference checklist</h2>
      <ul class="checklist">
        <li>Point one to remember</li>
        <li>Point two to remember</li>
        <li>Point three to remember</li>
      </ul>
      <p style="margin-top:20px;font-size:13px;">Follow <span class="handle">@${h}</span> &amp; Subscribe to the Newsletter.</p>
      <div class="brand">@${h}</div>
    </div>`;
		}
		if (i === total - 2) {
			return `    <div class="slide slide-6" style="transform:translateX(${i * 100}%)">
      <div class="tag">Pro Tip</div>
      <div class="divider"></div>
      <h2>The expert workflow.</h2>
      <div class="tip-box"><p style="color:#333;font-size:14px;">Step-by-step: Here's exactly how to apply this today, in the most efficient way possible.</p></div>
      <div class="brand">@${h}</div>
    </div>`;
		}
		const n = i - 2;
		return `    <div class="slide slide-4" style="transform:translateX(${i * 100}%)">
      <div class="tag">Key Insight #${n}</div>
      <div class="divider"></div>
      <h2>Insight #${n} headline</h2>
      <p>Scannable supporting context for this point.</p>
      <div class="brand">@${h}</div>
    </div>`;
	})
	.filter(Boolean)
	.join('\n')}
  </div>
  <div class="arrows">
    <button class="arrow" onclick="navigate(-1)">←</button>
    <button class="arrow" onclick="navigate(1)">→</button>
  </div>
  <div class="slide-counter" id="counter">1 / ${total}</div>
</div>
<p style="text-align:center;font-family:'Nunito Sans',sans-serif;font-size:11px;color:rgba(255,255,255,0.3);margin-top:16px;line-height:1.6;">To export for Instagram: Open in Chrome → Right-click each slide → Screenshot,<br>or use an extension like GoFullPage.</p>
<script>
  let cur = 0; const total = ${total};
  function navigate(dir) {
    cur = Math.max(0, Math.min(total-1, cur+dir));
    const slides = document.querySelectorAll('.slide');
    slides.forEach((s,i) => s.style.transform = \`translateX(\${(i-cur)*100}%)\`);
    document.getElementById('progress').style.width = ((cur+1)/total*100)+'%';
    document.getElementById('counter').textContent = (cur+1)+' / '+total;
  }
  document.addEventListener('keydown', e => { if(e.key==='ArrowLeft') navigate(-1); if(e.key==='ArrowRight') navigate(1); });
</script>
</body>
</html>`;
}
