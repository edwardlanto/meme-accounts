<script lang="ts">
	import { supabase } from '$lib/supabase';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import {
		Sparkles, Loader, Upload, Trash2, Download, RefreshCw,
		Image, Wand2, Check, ChevronRight, ChevronLeft,
		Pencil, Save, X, BookMarked, Music, Calendar, Clock, Send
	} from 'lucide-svelte';

	// ── Auth ──────────────────────────────────────────────────────────────────
	let userId = $state('');
	onMount(async () => {
		const { data: { user } } = await supabase.auth.getUser();
		if (!user) { goto('/login'); return; }
		userId = user.id;
		await loadSavedTemplates();

		window.addEventListener('message', (ev) => {
			const data = (ev as MessageEvent).data as any;
			if (!data || data.type !== 'brand-studio:inline-edit') return;
			if (typeof data.slideIdx !== 'number' || typeof data.html !== 'string') return;
			applyInlineSlideHtml(data.slideIdx, data.html);
		});
	});

	// ── Stepper ───────────────────────────────────────────────────────────────
	let currentStep = $state(1);
	const STEPS = [
		{ n: 1, label: 'Brand Images',  sub: 'Upload references' },
		{ n: 2, label: 'Brand Details', sub: 'Name & colors' },
		{ n: 3, label: 'Generate',      sub: 'Content & style' },
	];

	// ── Types ─────────────────────────────────────────────────────────────────
	interface UploadedImage { name: string; dataUrl: string; base64: string; mediaType: string; }
	interface SlideCard    { idx: number; srcdoc: string; label: string; w: number; h: number; }
	interface SlideField   { key: string; label: string; value: string; multiline: boolean; }
	interface SavedTemplate {
		id: string; name: string; style: any; primary_color: string;
		brand_name: string; handle: string; generated_html: string | null;
		created_at: string;
	}
	interface SlideMusicSettings { song: string; seconds: number; }

	// ── Step 1: Images + Extract ──────────────────────────────────────────────
	let images       = $state<UploadedImage[]>([]);
	let extracting   = $state(false);
	let extractError = $state('');
	let style        = $state<Record<string, any> | null>(null);
	let isDemo       = $state(false);

	function compressImage(file: File): Promise<{ dataUrl: string; base64: string; mediaType: string }> {
		return new Promise((resolve) => {
			const img = new window.Image();
			const objectUrl = URL.createObjectURL(file);
			img.onload = () => {
				URL.revokeObjectURL(objectUrl);
				const MAX = 1024;
				let { naturalWidth: w, naturalHeight: h } = img;
				if (w > MAX || h > MAX) {
					if (w > h) { h = Math.round(h * MAX / w); w = MAX; }
					else       { w = Math.round(w * MAX / h); h = MAX; }
				}
				const canvas = document.createElement('canvas');
				canvas.width = w; canvas.height = h;
				canvas.getContext('2d')!.drawImage(img, 0, 0, w, h);
				const dataUrl  = canvas.toDataURL('image/jpeg', 0.85);
				const base64   = dataUrl.split(',')[1];
				resolve({ dataUrl, base64, mediaType: 'image/jpeg' });
			};
			img.src = objectUrl;
		});
	}

	async function handleImageUpload(e: Event) {
		const files = Array.from((e.target as HTMLInputElement).files ?? []);
		(e.target as HTMLInputElement).value = '';
		for (const file of files) {
			const { dataUrl, base64, mediaType } = await compressImage(file);
			images = [...images, { name: file.name, dataUrl, base64, mediaType }];
		}
	}
	function removeImage(i: number) { images = images.filter((_, idx) => idx !== i); }

	async function extractStyle() {
		if (!images.length) { extractError = 'Upload at least one image first.'; return; }
		extracting = true; extractError = '';
		try {
			const res = await fetch('/api/brand/extract', {
				method: 'POST', headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ images: images.map(i => ({ data: i.base64, mediaType: i.mediaType })) }),
			});
			const data = await res.json();
			if (!res.ok || data.error) throw new Error(data.error ?? 'Extraction failed');
			style = data.style;
			if (style?.primaryColor) primaryColor = style.primaryColor;
			isDemo = !!data.demo;
			currentStep = 2;
		} catch (e: any) { extractError = e.message; }
		extracting = false;
	}

	// ── Step 2: Brand Details ─────────────────────────────────────────────────
	let brandName    = $state('');
	let handle       = $state('');
	let primaryColor = $state('#8B5CF6');

	// ── Step 3: Generate ──────────────────────────────────────────────────────
	let content       = $state('');
	let slideCount    = $state(7);
	let generating    = $state(false);
	let genError      = $state('');
	let generatedHtml = $state('');

	async function generateCarousel() {
		if (!content.trim()) { genError = 'Enter a topic or content first.'; return; }
		generating = true; genError = '';
		try {
			const res = await fetch('/api/brand/generate', {
				method: 'POST', headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ style, brandName, handle, primaryColor, content, slideCount }),
			});
			const data = await res.json();
			if (!res.ok || data.error) throw new Error(data.error ?? 'Generation failed');
			generatedHtml = data.html;
			_fullHtml = data.html;
			isDemo = !!data.demo;
			extractedSlides = parseSlides(data.html);
			selectedSlide = 0;
			slideFields = extractedSlides.length ? getSlideFields(0) : [];
			slideMusic = extractedSlides.map(() => ({ song: 'No music', seconds: 15 }));
		} catch (e: any) { genError = e.message; }
		generating = false;
	}

	// ── Slide parsing (full-HTML injection approach) ──────────────────────────
	let extractedSlides = $state<SlideCard[]>([]);
	let selectedSlide   = $state(0);
	let slideFields     = $state<SlideField[]>([]);
	let _fullHtml       = '';
	let _slideW         = 400;
	let _slideH         = 500;
	let inlineEdit      = $state(false);

	function getSlideLabel(i: number, total: number): string {
		if (i === 0) return 'Hero';
		if (i === 1) return 'Problem';
		if (i === 2) return 'Pivot';
		if (i === total - 1) return 'CTA';
		if (i === total - 2) return 'Pro Tip';
		const logicIdx = Math.max(1, i - 2);
		return `Logic #${logicIdx}`;
	}

	function parseSlides(html: string): SlideCard[] {
		if (typeof window === 'undefined') return [];
		_fullHtml = html;

		const parser = new DOMParser();
		const doc = parser.parseFromString(html, 'text/html');
		const styleContent = doc.querySelector('style')?.textContent ?? '';

		// Detect slide dimensions
		const wMatch = styleContent.match(/\.slide\s*\{[^}]*(?:min-)?width:\s*(\d+)px/s);
		const hMatch = styleContent.match(/\.slide\s*\{[^}]*height:\s*(\d+)px/s);
		_slideW = wMatch ? parseInt(wMatch[1]) : 400;
		_slideH = hMatch ? parseInt(hMatch[1]) : 500;

		const count = doc.querySelectorAll('.slide').length;
		return Array.from({ length: count }, (_, i) => ({
			idx: i,
			srcdoc: buildSrcdocFromFull(html, i, _slideW, _slideH, false),
			label: getSlideLabel(i, count),
			w: _slideW,
			h: _slideH,
		}));
	}

	/**
	 * Build a minimal HTML document that includes the original styles/fonts,
	 * but renders ONLY the requested slide. This avoids brittle DOM surgery that
	 * can accidentally break layout (e.g. collapsing width).
	 */
	function buildSrcdocFromFull(fullHtml: string, slideIdx: number, w: number, h: number, enableInlineEdit: boolean = false): string {
		if (typeof window === 'undefined') return '';
		try {
			const parser = new DOMParser();
			const doc = parser.parseFromString(fullHtml, 'text/html');

			const slides = doc.querySelectorAll('.slide');
			const slideEl = slides[slideIdx] as HTMLElement | undefined;
			if (!slideEl) return '';

			// Preserve font + style resources from the original document
			const headLinks = [...doc.head.querySelectorAll('link[rel="stylesheet"]')]
				.map((n) => n.outerHTML)
				.join('\n');
			const headStyles = [...doc.head.querySelectorAll('style')]
				.map((n) => n.outerHTML)
				.join('\n');

			// Clone the slide so we can safely tweak any inline transforms
			const slideClone = slideEl.cloneNode(true) as HTMLElement;
			slideClone.style.transform = 'none';
			slideClone.style.left = '0';
			slideClone.style.top = '0';

			// Some templates scope slide styles under `.carousel .slide` / `.container .slide`.
			// Recreate the expected wrappers so selectors still match.
			const bodyHtml = `
				<div class="container" style="width:${w}px;height:${h}px;">
					<div class="carousel" style="width:${w}px;height:${h}px;overflow:hidden;position:relative;">
						${slideClone.outerHTML}
					</div>
				</div>
			`;

			const overrides = `
				<style>
					html, body { margin: 0; padding: 0; width: ${w}px; height: ${h}px; overflow: hidden; background: transparent; }
					.slide { display: flex !important; transform: none !important; }
					.arrows, .progress-bar, .slide-counter, .arrow { display: none !important; }
					${enableInlineEdit ? `
					/* Inline edit affordances */
					[data-inline-edit="1"] [contenteditable="true"] { outline: none; }
					[data-inline-edit="1"] [contenteditable="true"]:hover { box-shadow: inset 0 0 0 1px rgba(139,92,246,0.35); border-radius: 6px; }
					[data-inline-edit="1"] [contenteditable="true"]:focus { box-shadow: inset 0 0 0 2px rgba(139,92,246,0.6); border-radius: 6px; }
					` : ''}
				</style>
			`;

			const inlineEditScript = enableInlineEdit
				? `
<script>
(function(){
  document.body.setAttribute('data-inline-edit', '1');
  var slideIdx = ${slideIdx};
  var slide = document.querySelector('.slide');
  if(!slide) return;
  var targets = slide.querySelectorAll('.tag, h1, h2, p, li');
  targets.forEach(function(el){
    el.setAttribute('contenteditable', 'true');
    el.setAttribute('spellcheck', 'false');
  });
  var t = null;
  function send(){
    try{ parent.postMessage({ type:'brand-studio:inline-edit', slideIdx: slideIdx, html: slide.outerHTML }, '*'); }catch(e){}
  }
  function schedule(){
    if(t) clearTimeout(t);
    t = setTimeout(send, 250);
  }
  slide.addEventListener('input', schedule, true);
  slide.addEventListener('blur', send, true);
})();
<\/script>`
				: '';

			return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
${headLinks}
${headStyles}
${overrides}
</head>
<body>
${bodyHtml}
${inlineEditScript}
</body>
</html>`;
		} catch {
			return '';
		}
	}

	function applyInlineSlideHtml(slideIdx: number, slideOuterHtml: string) {
		if (typeof window === 'undefined' || !_fullHtml) return;
		try {
			const doc = new DOMParser().parseFromString(_fullHtml, 'text/html');
			const slides = doc.querySelectorAll('.slide');
			const existing = slides[slideIdx];
			if (!existing) return;

			const parsed = new DOMParser().parseFromString(`<!doctype html><body>${slideOuterHtml}</body>`, 'text/html');
			const incoming = parsed.body.firstElementChild as HTMLElement | null;
			if (!incoming || !incoming.classList.contains('slide')) return;

			existing.replaceWith(incoming);
			_fullHtml = '<!DOCTYPE html>' + doc.documentElement.outerHTML;

			// Refresh thumbnails + editing panel to reflect inline edits.
			extractedSlides = extractedSlides.map((s, i) => ({
				...s,
				srcdoc: buildSrcdocFromFull(_fullHtml, i, s.w, s.h, false),
			}));
			slideFields = getSlideFields(selectedSlide);
		} catch {
			// ignore
		}
	}

	function getSlideFields(slideIdx: number): SlideField[] {
		if (typeof window === 'undefined' || !_fullHtml) return [];
		const doc = new DOMParser().parseFromString(_fullHtml, 'text/html');
		const el  = doc.querySelectorAll('.slide')[slideIdx];
		if (!el) return [];

		const out: SlideField[] = [];
		const tag = el.querySelector('.tag');
		if (tag?.textContent?.trim()) out.push({ key: 'tag', label: 'Tag', value: tag.textContent.trim(), multiline: false });

		const h1 = el.querySelector('h1');
		if (h1) out.push({ key: 'h1', label: 'Heading', value: h1.textContent?.trim() ?? '', multiline: false });

		const h2 = el.querySelector('h2');
		if (h2) out.push({ key: 'h2', label: 'Subheading', value: h2.textContent?.trim() ?? '', multiline: false });

		const tip = el.querySelector('.tip-box p');
		if (tip) out.push({ key: 'tip', label: 'Tip', value: tip.textContent?.trim() ?? '', multiline: true });

		[...el.querySelectorAll('p')]
			.filter(p => !p.closest('.brand') && !p.closest('.tip-box') && p.textContent?.trim())
			.forEach((p, i) => out.push({ key: `p${i}`, label: 'Body', value: p.textContent?.trim() ?? '', multiline: true }));

		[...el.querySelectorAll('li')]
			.filter(li => li.textContent?.trim())
			.forEach((li, i) => out.push({ key: `li${i}`, label: `Item ${i + 1}`, value: li.textContent?.trim() ?? '', multiline: false }));

		return out;
	}

	function selectSlide(idx: number) {
		selectedSlide = idx;
		slideFields = getSlideFields(idx);
	}

	function applyEdits() {
		if (!_fullHtml) return;
		const doc = new DOMParser().parseFromString(_fullHtml, 'text/html');
		const el  = doc.querySelectorAll('.slide')[selectedSlide];
		if (!el) return;

		for (const f of slideFields) {
			if (f.key === 'tag')  { const e = el.querySelector('.tag');      if (e) e.textContent = f.value; }
			else if (f.key === 'h1')  { const e = el.querySelector('h1');   if (e) e.textContent = f.value; }
			else if (f.key === 'h2')  { const e = el.querySelector('h2');   if (e) e.textContent = f.value; }
			else if (f.key === 'tip') { const e = el.querySelector('.tip-box p'); if (e) e.textContent = f.value; }
			else if (f.key.startsWith('p')) {
				const i  = parseInt(f.key.slice(1));
				const ps = [...el.querySelectorAll('p')].filter(p => !p.closest('.brand') && !p.closest('.tip-box'));
				if (ps[i]) ps[i].textContent = f.value;
			} else if (f.key.startsWith('li')) {
				const i   = parseInt(f.key.slice(2));
				const lis = [...el.querySelectorAll('li')];
				if (lis[i]) lis[i].textContent = f.value;
			}
		}

		_fullHtml = '<!DOCTYPE html>' + doc.documentElement.outerHTML;
		extractedSlides = extractedSlides.map((s, i) => ({
			...s,
			srcdoc: buildSrcdocFromFull(_fullHtml, i, s.w, s.h, false),
		}));
	}

	// ── Drag to sort ──────────────────────────────────────────────────────────
	let dragFromIdx = $state<number | null>(null);
	let dragOverIdx = $state<number | null>(null);

	function onDragStart(i: number, e: DragEvent) {
		dragFromIdx = i;
		if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
	}
	function onDragOver(i: number, e: DragEvent) { e.preventDefault(); dragOverIdx = i; }
	function onDrop(i: number) {
		if (dragFromIdx === null || dragFromIdx === i) { dragFromIdx = null; dragOverIdx = null; return; }
		const arr = [...extractedSlides];
		const [moved] = arr.splice(dragFromIdx, 1);
		arr.splice(i, 0, moved);
		extractedSlides = arr.map((s, idx) => ({ ...s, idx }));
		selectedSlide = i;
		slideFields = getSlideFields(i);
		dragFromIdx = null; dragOverIdx = null;
	}
	function onDragEnd() { dragFromIdx = null; dragOverIdx = null; }

	// ── Download ──────────────────────────────────────────────────────────────
	function downloadHtml() {
		const html = _fullHtml || generatedHtml;
		const blob = new Blob([html], { type: 'text/html' });
		const url  = URL.createObjectURL(blob);
		const a    = document.createElement('a');
		a.href = url; a.download = `${brandName || 'carousel'}-carousel.html`; a.click();
		setTimeout(() => URL.revokeObjectURL(url), 1000);
	}

	// ── Music panel ───────────────────────────────────────────────────────────
	let showMusicPanel = $state(false);
	let slideMusic     = $state<SlideMusicSettings[]>([]);
	const SONG_OPTIONS = [
		'No music', 'Lo-fi Chill', 'Upbeat Corporate',
		'Cinematic Rise', 'Acoustic Mood', 'Electronic Pulse', 'Inspirational Piano',
	];

	// ── Post panel ────────────────────────────────────────────────────────────
	let showPostPanel     = $state(false);
	let selectedPlatforms = $state<string[]>([]);
	let scheduleDate      = $state('');
	let scheduleTime      = $state('');

	function togglePlatform(p: string) {
		selectedPlatforms = selectedPlatforms.includes(p)
			? selectedPlatforms.filter(x => x !== p)
			: [...selectedPlatforms, p];
	}

	// ── Saved templates ───────────────────────────────────────────────────────
	let savedTemplates = $state<SavedTemplate[]>([]);
	let savingTemplate = $state(false);
	let saveError      = $state('');
	let templateName   = $state('');
	let renamingId     = $state<string | null>(null);
	let renameValue    = $state('');
	let showSavePanel  = $state(false);

	async function loadSavedTemplates() {
		const { data, error } = await (supabase as any)
			.from('brand_templates').select('*').order('created_at', { ascending: false });
		if (!error) savedTemplates = data ?? [];
	}

	async function saveTemplate() {
		if (!_fullHtml && !generatedHtml) return;
		savingTemplate = true; saveError = '';
		const name = templateName.trim() || `Template ${savedTemplates.length + 1}`;
		const { data, error } = await (supabase as any).from('brand_templates').insert({
			user_id: userId, name, style: style ?? {},
			primary_color: primaryColor, brand_name: brandName, handle,
			generated_html: _fullHtml || generatedHtml,
		}).select().single();
		savingTemplate = false;
		if (error) { saveError = error.message ?? 'Save failed'; }
		else if (data) { savedTemplates = [data, ...savedTemplates]; templateName = ''; showSavePanel = false; }
	}

	async function renameTemplate(id: string, newName: string) {
		await (supabase as any).from('brand_templates').update({ name: newName }).eq('id', id);
		savedTemplates = savedTemplates.map(t => t.id === id ? { ...t, name: newName } : t);
		renamingId = null;
	}

	async function deleteTemplate(id: string) {
		await (supabase as any).from('brand_templates').delete().eq('id', id);
		savedTemplates = savedTemplates.filter(t => t.id !== id);
	}

	function loadTemplate(t: SavedTemplate) {
		style = t.style; primaryColor = t.primary_color;
		brandName = t.brand_name; handle = t.handle;
		if (t.generated_html) {
			generatedHtml = t.generated_html;
			_fullHtml = t.generated_html;
			extractedSlides = parseSlides(t.generated_html);
			selectedSlide = 0;
			slideFields = extractedSlides.length ? getSlideFields(0) : [];
			slideMusic = extractedSlides.map(() => ({ song: 'No music', seconds: 15 }));
		}
		currentStep = 3;
	}

	const canGenerate = $derived(content.trim().length > 0);
	const hasSlides   = $derived(extractedSlides.length > 0 && !generating);
</script>

<div class="flex h-full overflow-hidden">

<!-- ══════════════════════════════════════════════════════════ SIDEBAR -->
<div class="w-[272px] flex-shrink-0 border-r border-white/[0.05] bg-[#0d0d0d] flex flex-col overflow-hidden">

	<!-- Header + Stepper -->
	<div class="px-5 pt-5 pb-4 border-b border-white/[0.04] flex-shrink-0">
		<div class="flex items-center gap-2 mb-5">
			<Wand2 size={13} class="text-violet-400" />
			<h1 class="font-display font-bold text-sm text-white">Brand Studio</h1>
		</div>

		<div class="flex items-start">
			{#each STEPS as step, i}
				{@const done   = currentStep > step.n}
				{@const active = currentStep === step.n}
				{@const last   = i === STEPS.length - 1}
				<div class="flex items-start {last ? '' : 'flex-1'}">
					<button
						onclick={() => { if (done || active) currentStep = step.n; }}
						disabled={!done && !active}
						class="flex flex-col items-center gap-1.5"
						style="min-width:56px;"
					>
						<div class="
							w-7 h-7 rounded-full flex items-center justify-center transition-all duration-300
							{done   ? 'bg-violet-500 shadow-[0_0_12px_rgba(139,92,246,0.5)]' : ''}
							{active ? 'border-2 border-violet-400 bg-violet-500/10 shadow-[0_0_12px_rgba(139,92,246,0.3)]' : ''}
							{!done && !active ? 'border-2 border-white/[0.12] bg-transparent' : ''}
						">
							{#if done}
								<Check size={12} class="text-white" />
							{:else}
								<span class="text-[11px] font-mono font-bold leading-none {active ? 'text-violet-300' : 'text-white/20'}">{step.n}</span>
							{/if}
						</div>
						<p class="text-[8px] font-mono font-semibold uppercase tracking-wider leading-none
							{done ? 'text-white/50' : active ? 'text-violet-300' : 'text-white/20'}">
							{step.label}
						</p>
					</button>
					{#if !last}
						<div class="flex-1 h-px mt-3.5 mx-1 transition-all duration-500
							{done ? 'bg-violet-500/50' : 'bg-white/[0.07]'}"></div>
					{/if}
				</div>
			{/each}
		</div>
	</div>

	<!-- Step content -->
	<div class="flex-1 overflow-y-auto">
	<div class="p-4 flex flex-col gap-4">

	<!-- STEP 1 -->
	{#if currentStep === 1}
		<div>
			<p class="text-[9px] font-mono text-white/30 uppercase tracking-widest mb-3">Reference images</p>

			{#if images.length > 0}
				<div class="grid grid-cols-3 gap-1.5 mb-3">
					{#each images as img, i}
						<div class="relative group rounded-lg overflow-hidden border border-white/[0.07]" style="aspect-ratio:1;">
							<img src={img.dataUrl} alt={img.name} class="w-full h-full object-cover" />
							<button onclick={() => removeImage(i)}
								class="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/80 hover:bg-red-500/80 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
								<Trash2 size={7} class="text-white" />
							</button>
						</div>
					{/each}
					<label class="rounded-lg border-2 border-dashed border-white/[0.08] hover:border-violet-500/30 flex items-center justify-center cursor-pointer transition-colors" style="aspect-ratio:1;">
						<Upload size={13} class="text-white/20" />
						<input type="file" accept="image/*" multiple class="hidden" onchange={handleImageUpload} />
					</label>
				</div>
			{:else}
				<label class="flex flex-col items-center justify-center gap-2 py-8 rounded-xl border-2 border-dashed border-white/[0.08] hover:border-violet-500/30 cursor-pointer transition-all hover:bg-violet-500/[0.03] mb-3 group">
					<div class="w-10 h-10 rounded-xl bg-white/[0.03] border border-white/[0.08] flex items-center justify-center group-hover:border-violet-500/30 transition-colors">
						<Image size={16} class="text-white/20 group-hover:text-violet-400 transition-colors" />
					</div>
					<div class="text-center">
						<p class="text-xs font-body text-white/30">Upload brand images</p>
						<p class="text-[10px] font-body text-white/15 mt-0.5">logos, posts, brand guides…</p>
					</div>
					<input type="file" accept="image/*" multiple class="hidden" onchange={handleImageUpload} />
				</label>
			{/if}

			{#if extractError}
				<p class="text-[11px] font-body text-red-400 mb-2">{extractError}</p>
			{/if}

			<button onclick={extractStyle} disabled={extracting || !images.length}
				class="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold font-body transition-all disabled:opacity-40
					{style
						? 'text-violet-300 bg-violet-500/10 border border-violet-500/20 hover:bg-violet-500/20'
						: 'text-white bg-gradient-to-r from-violet-600 to-violet-500 hover:shadow-[0_0_16px_rgba(139,92,246,0.35)]'}">
				{#if extracting}
					<Loader size={13} class="animate-spin" /> Analysing…
				{:else if style}
					<RefreshCw size={12} /> Re-extract style
				{:else}
					<Sparkles size={12} /> Extract Brand Style
				{/if}
			</button>

			{#if style?.colorPalette?.length}
				<div class="mt-3 p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
					<p class="text-[9px] font-mono text-white/25 uppercase tracking-wider mb-2">Extracted palette</p>
					<div class="flex gap-1.5 flex-wrap">
						{#each style.colorPalette as hex}
							<div class="w-7 h-7 rounded-lg border border-white/10 flex-shrink-0" style="background:{hex};" title={hex}></div>
						{/each}
					</div>
					{#if style.designStyle}
						<p class="text-[10px] font-body text-white/35 mt-2 leading-relaxed">{style.designStyle}</p>
					{/if}
				</div>
			{/if}
		</div>

		<button onclick={() => currentStep = 2}
			class="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-mono text-white/20 hover:text-white/50 border border-white/[0.05] hover:border-white/15 transition-all">
			Skip — use color only <ChevronRight size={11} />
		</button>

	<!-- STEP 2 -->
	{:else if currentStep === 2}
		<div class="flex flex-col gap-2.5">
			<div>
				<p class="text-[9px] font-mono text-white/30 uppercase tracking-widest mb-2">Brand name</p>
				<input bind:value={brandName} placeholder="e.g. Health.com"
					class="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl py-2 px-3 text-sm font-body text-white placeholder-white/20 focus:outline-none focus:border-violet-500/40 transition-colors" />
			</div>
			<div>
				<p class="text-[9px] font-mono text-white/30 uppercase tracking-widest mb-2">Instagram handle</p>
				<div class="relative">
					<span class="absolute left-3 top-1/2 -translate-y-1/2 text-white/30 text-sm font-mono">@</span>
					<input bind:value={handle} placeholder="handle"
						class="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl py-2 pl-7 pr-3 text-sm font-mono text-white/80 placeholder-white/20 focus:outline-none focus:border-violet-500/40 transition-colors" />
				</div>
			</div>
			<div>
				<p class="text-[9px] font-mono text-white/30 uppercase tracking-widest mb-2">Primary color</p>
				<div class="flex items-center gap-2">
					<input type="color" bind:value={primaryColor}
						class="w-9 h-9 rounded-xl cursor-pointer border border-white/10 bg-transparent flex-shrink-0" />
					<input bind:value={primaryColor}
						class="flex-1 bg-white/[0.04] border border-white/[0.08] rounded-xl py-2 px-3 text-sm font-mono text-white/70 focus:outline-none focus:border-violet-500/40 transition-colors" />
				</div>
				{#if style?.colorPalette?.length}
					<div class="flex gap-1.5 mt-2.5 flex-wrap">
						{#each style.colorPalette as hex}
							<button onclick={() => primaryColor = hex} title={hex}
								class="w-6 h-6 rounded-md border-2 transition-all hover:scale-110 flex-shrink-0
									{primaryColor === hex ? 'border-white scale-110' : 'border-white/10'}"
								style="background:{hex};">
							</button>
						{/each}
					</div>
				{/if}
			</div>
		</div>

		<button onclick={() => currentStep = 3}
			class="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold font-body text-white bg-white/[0.08] hover:bg-white/[0.12] border border-white/[0.1] transition-all">
			Continue <ChevronRight size={13} />
		</button>

	<!-- STEP 3 -->
	{:else if currentStep === 3}
		<div class="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
			<div class="flex items-center justify-between mb-2">
				<p class="text-[9px] font-mono text-white/30 uppercase tracking-widest">Slides</p>
				<span class="text-[10px] font-mono text-white/50">{slideCount}</span>
			</div>
			<input
				type="range"
				min="3"
				max="10"
				step="1"
				bind:value={slideCount}
				class="w-full accent-violet-500 cursor-pointer"
			/>
			<div class="flex gap-1.5 mt-2">
				{#each [3,5,7,9,10] as n}
					<button
						onclick={() => (slideCount = n)}
						class="flex-1 py-1.5 rounded-lg text-[10px] font-mono transition-all border
							{slideCount === n
								? 'bg-violet-500/15 border-violet-500/30 text-violet-200'
								: 'bg-white/[0.02] border-white/[0.06] text-white/35 hover:text-white/60 hover:border-white/15'}"
					>
						{n}
					</button>
				{/each}
			</div>
			<p class="text-[10px] font-body text-white/25 mt-2 leading-snug">
				Auto-structure: Hero → Problem → Pivot → Logic slides → Pro Tip → CTA
			</p>
		</div>

		<div>
			<p class="text-[9px] font-mono text-white/30 uppercase tracking-widest mb-2">Topic or content</p>
			<textarea bind:value={content} rows={8}
				placeholder={"Paste an article or enter a topic…\n\nE.g. '8 foods that spike cortisol'"}
				class="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl py-3 px-3 text-sm font-body text-white placeholder-white/20 focus:outline-none focus:border-violet-500/40 transition-colors resize-none leading-relaxed">
			</textarea>
		</div>

		{#if genError}
			<p class="text-[11px] font-body text-red-400">{genError}</p>
		{/if}

		<button onclick={generateCarousel} disabled={generating || !canGenerate}
			class="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold font-body text-white bg-gradient-to-r from-violet-600 to-cyan-500 hover:shadow-[0_0_20px_rgba(139,92,246,0.35)] transition-all disabled:opacity-40">
			{#if generating}
				<Loader size={14} class="animate-spin" /> Generating…
			{:else}
				<Wand2 size={14} /> Generate Carousel
			{/if}
		</button>

		{#if generatedHtml || _fullHtml}
			<div class="flex flex-col gap-2">
				<button onclick={downloadHtml}
					class="w-full flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-semibold font-body text-white/60 bg-white/[0.05] hover:bg-white/[0.08] transition-all">
					<Download size={12} /> Download HTML
				</button>

				{#if !showSavePanel}
					<button onclick={() => { showSavePanel = true; templateName = brandName || 'Template ' + (savedTemplates.length + 1); }}
						class="w-full flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-semibold font-body text-violet-300 bg-violet-500/10 hover:bg-violet-500/15 border border-violet-500/20 transition-all">
						<Save size={12} /> Save as template
					</button>
				{:else}
					<div class="p-3 rounded-xl bg-violet-500/10 border border-violet-500/20 flex flex-col gap-2">
						<p class="text-[9px] font-mono text-violet-400/70 uppercase tracking-wider">Template name</p>
						<input bind:value={templateName} placeholder="Template 1"
							class="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg py-2 px-3 text-sm font-body text-white placeholder-white/20 focus:outline-none focus:border-violet-500/40 transition-colors" />
						{#if saveError}
							<p class="text-[10px] font-body text-red-400 leading-snug">{saveError}</p>
						{/if}
						<div class="flex gap-2">
							<button onclick={saveTemplate} disabled={savingTemplate}
								class="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold font-body text-white bg-violet-600 hover:bg-violet-500 transition-all disabled:opacity-50">
								{#if savingTemplate}<Loader size={10} class="animate-spin"/>{:else}<Check size={10}/>{/if} Save
							</button>
							<button onclick={() => { showSavePanel = false; saveError = ''; }}
								class="px-3 py-2 rounded-lg text-xs font-body text-white/30 hover:text-white/70 bg-white/[0.04] hover:bg-white/[0.08] transition-all">
								Cancel
							</button>
						</div>
					</div>
				{/if}
			</div>
		{/if}
	{/if}

	{#if currentStep > 1}
		<button onclick={() => currentStep--}
			class="flex items-center gap-1.5 text-xs font-mono text-white/25 hover:text-white/60 transition-colors mt-1">
			<ChevronLeft size={11} /> Back
		</button>
	{/if}

	</div>
	</div>

	<!-- Saved templates -->
	{#if savedTemplates.length > 0}
		<div class="flex-shrink-0 border-t border-white/[0.04] p-3">
			<div class="flex items-center gap-1.5 mb-2.5">
				<BookMarked size={10} class="text-white/25" />
				<p class="text-[9px] font-mono text-white/25 uppercase tracking-wider">Saved templates</p>
			</div>
			<div class="flex flex-col gap-1.5 max-h-44 overflow-y-auto">
				{#each savedTemplates as t}
					<div class="group flex items-center gap-2 px-2.5 py-2 rounded-xl bg-white/[0.03] border border-white/[0.06] hover:border-violet-500/20 hover:bg-violet-500/[0.04] transition-all">
						<div class="w-5 h-5 rounded-md flex-shrink-0 border border-white/10" style="background:{t.primary_color};"></div>
						{#if renamingId === t.id}
							<input bind:value={renameValue}
								onblur={() => renameTemplate(t.id, renameValue)}
								onkeydown={(e) => { if (e.key === 'Enter') renameTemplate(t.id, renameValue); if (e.key === 'Escape') renamingId = null; }}
								class="flex-1 bg-transparent text-xs font-body text-white focus:outline-none border-b border-violet-500/50"
								autofocus />
						{:else}
							<button onclick={() => loadTemplate(t)} class="flex-1 text-left">
								<p class="text-xs font-body text-white/70 truncate leading-none">{t.name}</p>
								<p class="text-[9px] font-mono text-white/25 mt-0.5">{t.brand_name || t.handle || 'No name'}</p>
							</button>
						{/if}
						<div class="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
							<button onclick={() => { renamingId = t.id; renameValue = t.name; }}
								class="w-5 h-5 rounded-md hover:bg-white/10 flex items-center justify-center text-white/30 hover:text-white/70 transition-colors">
								<Pencil size={9} />
							</button>
							<button onclick={() => deleteTemplate(t.id)}
								class="w-5 h-5 rounded-md hover:bg-red-500/15 flex items-center justify-center text-white/30 hover:text-red-400 transition-colors">
								<Trash2 size={9} />
							</button>
						</div>
					</div>
				{/each}
			</div>
		</div>
	{/if}
</div>

<!-- ══════════════════════════════════════════════════════════ MAIN AREA -->
<div class="flex-1 flex overflow-hidden bg-[#060606]">

	{#if generating}
		<div class="flex-1 flex flex-col items-center justify-center gap-5">
			<div class="w-16 h-16 rounded-2xl bg-violet-500/10 border border-violet-500/15 flex items-center justify-center">
				<Wand2 size={24} class="text-violet-400 animate-pulse" />
			</div>
			<div class="text-center">
				<p class="font-mono text-xs text-white/40 uppercase tracking-widest mb-1">Claude is designing…</p>
				<p class="text-[11px] font-body text-white/20">Generating all 7 slides with your brand style</p>
			</div>
			<div class="flex gap-1.5">
				{#each [0,1,2,3,4,5,6] as i}
					<div class="w-1.5 h-1.5 rounded-full bg-violet-500/30 animate-pulse" style="animation-delay:{i*120}ms;"></div>
				{/each}
			</div>
		</div>

	{:else if extractedSlides.length > 0}
		<!-- Slides area + edit panel -->
		<div class="flex-1 flex flex-col overflow-hidden">

			<!-- Top bar -->
			<div class="flex-shrink-0 flex items-center justify-between px-6 py-3 border-b border-white/[0.04]">
				<div class="flex items-center gap-3">
					<p class="font-mono text-[10px] text-white/25 uppercase tracking-wider">
						{isDemo ? 'Demo' : 'Generated'} · {extractedSlides.length} slides
					</p>
					<span class="text-[9px] font-mono text-white/15">Drag strip to reorder</span>
				</div>
				<div class="flex items-center gap-2">
					<button
						onclick={() => (inlineEdit = !inlineEdit)}
						class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold font-body border transition-all
							{inlineEdit
								? 'bg-violet-600 text-white border-violet-500/30 shadow-[0_0_14px_rgba(139,92,246,0.35)]'
								: 'text-white/50 bg-white/[0.05] hover:bg-white/[0.09] hover:text-white/80 border-white/[0.07]'}"
						title="Inline edit the preview"
					>
						<Pencil size={11} />
						Inline Edit
					</button>

					<button onclick={downloadHtml}
						class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold font-body text-white/50 bg-white/[0.05] hover:bg-white/[0.09] hover:text-white/80 border border-white/[0.07] transition-all">
						<Download size={11} /> Download HTML
					</button>
				</div>
			</div>

			<!-- Large preview -->
			{#if extractedSlides[selectedSlide]}
				{@const s = extractedSlides[selectedSlide]}
				{@const previewH = 380}
				{@const previewW = Math.round(previewH * s.w / s.h)}
				{@const previewScale = previewW / s.w}
				<div class="flex-1 flex items-center justify-center overflow-hidden bg-[#060606]">
					<div style="width:{previewW}px;height:{previewH}px;overflow:hidden;border-radius:16px;border:1px solid rgba(255,255,255,0.08);box-shadow:0 24px 60px rgba(0,0,0,0.6);flex-shrink:0;">
						<div style="width:{s.w}px;height:{s.h}px;transform:scale({previewScale});transform-origin:top left;pointer-events:{inlineEdit ? 'auto' : 'none'};">
							{#key `${selectedSlide}-${inlineEdit}`}
								<iframe
									srcdoc={inlineEdit ? buildSrcdocFromFull(_fullHtml, selectedSlide, s.w, s.h, true) : s.srcdoc}
									title="Slide preview"
									style="width:{s.w}px;height:{s.h}px;border:none;display:block;"
									sandbox={inlineEdit ? 'allow-scripts allow-same-origin' : 'allow-scripts'}
								></iframe>
							{/key}
						</div>
					</div>
				</div>
			{/if}

			<!-- Horizontal slide strip -->
			<div class="flex-shrink-0 border-t border-white/[0.04] bg-[#080808]">
				<div class="flex gap-3 px-4 py-3 overflow-x-auto" style="scrollbar-width:thin;scrollbar-color:rgba(255,255,255,0.08) transparent;">
					{#each extractedSlides as slide (slide.idx)}
						{@const thumbH = 110}
						{@const thumbW = Math.round(thumbH * slide.w / slide.h)}
						{@const thumbScale = thumbW / slide.w}
						{@const isSelected = selectedSlide === slide.idx}
						{@const isDragOver = dragOverIdx === slide.idx && dragFromIdx !== slide.idx}

						<div
							draggable="true"
							ondragstart={(e) => onDragStart(slide.idx, e)}
							ondragover={(e) => onDragOver(slide.idx, e)}
							ondrop={() => onDrop(slide.idx)}
							ondragend={onDragEnd}
							class="flex-shrink-0 flex flex-col gap-1 cursor-grab active:cursor-grabbing transition-all duration-150
								{isDragOver ? 'scale-105 opacity-70' : ''}">
							<button
								onclick={() => selectSlide(slide.idx)}
								class="rounded-xl overflow-hidden border-2 transition-all duration-200 block
									{isSelected
										? 'border-violet-500 shadow-[0_0_16px_rgba(139,92,246,0.4)]'
										: 'border-white/[0.07] hover:border-white/25'}"
								style="width:{thumbW}px;height:{thumbH}px;position:relative;background:#111;">
								<div style="width:{slide.w}px;height:{slide.h}px;transform:scale({thumbScale});transform-origin:top left;pointer-events:none;">
									<iframe
										srcdoc={slide.srcdoc}
										title={slide.label}
										style="width:{slide.w}px;height:{slide.h}px;border:none;display:block;"
										sandbox="allow-scripts"
									></iframe>
								</div>
							</button>
							<p class="text-[8px] font-mono uppercase tracking-wider text-center truncate
								{isSelected ? 'text-violet-400' : 'text-white/20'}"
								style="width:{thumbW}px;">
								{slide.label}
							</p>
						</div>
					{/each}
				</div>
			</div>
		</div>

		<!-- Edit panel -->
		<div class="w-64 flex-shrink-0 border-l border-white/[0.05] flex flex-col overflow-hidden bg-[#0a0a0a]">
			<div class="flex-shrink-0 px-4 py-3 border-b border-white/[0.04]">
				<p class="text-[9px] font-mono text-white/25 uppercase tracking-wider">
					Editing — <span class="text-violet-300">{extractedSlides[selectedSlide]?.label}</span>
				</p>
			</div>
			<div class="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
				{#if slideFields.length === 0}
					<p class="text-[11px] font-body text-white/20 text-center mt-4">No editable text found.</p>
				{:else}
					{#each slideFields as field, i}
						<div>
							<p class="text-[8px] font-mono text-white/25 uppercase tracking-wider mb-1">{field.label}</p>
							{#if field.multiline}
								<textarea bind:value={slideFields[i].value} rows={3}
									class="w-full bg-white/[0.04] border border-white/[0.07] rounded-lg py-2 px-2.5 text-xs font-body text-white/80 focus:outline-none focus:border-violet-500/40 transition-colors resize-none leading-relaxed"></textarea>
							{:else}
								<input bind:value={slideFields[i].value}
									class="w-full bg-white/[0.04] border border-white/[0.07] rounded-lg py-2 px-2.5 text-xs font-body text-white/80 focus:outline-none focus:border-violet-500/40 transition-colors" />
							{/if}
						</div>
					{/each}
				{/if}
			</div>
			{#if slideFields.length > 0}
				<div class="flex-shrink-0 p-3 border-t border-white/[0.04]">
					<button onclick={applyEdits}
						class="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold font-body text-white bg-violet-600 hover:bg-violet-500 hover:shadow-[0_0_12px_rgba(139,92,246,0.3)] transition-all">
						<Check size={13} /> Apply changes
					</button>
				</div>
			{/if}
		</div>

	{:else}
		<!-- Empty state -->
		<div class="flex-1 flex flex-col items-center justify-center gap-5 text-center p-8">
			<div class="w-20 h-20 rounded-2xl bg-white/[0.02] border border-white/[0.05] flex items-center justify-center">
				<Wand2 size={28} class="text-white/10" />
			</div>
			<div class="max-w-sm">
				<h3 class="font-display font-semibold text-base text-white/40 mb-2">Your {slideCount}-slide carousel will appear here</h3>
				<p class="font-body text-xs text-white/20 leading-relaxed">Upload brand references → extract the style → add your content → generate a fully branded Instagram carousel</p>
			</div>
			<div class="flex flex-col gap-2 w-full max-w-xs mt-2">
				{#each [
					{ n: '1', label: 'Upload brand reference images', done: images.length > 0 },
					{ n: '2', label: 'Extract brand style with AI',   done: !!style },
					{ n: '3', label: 'Add content and generate',      done: !!generatedHtml },
				] as step}
					<div class="flex items-center gap-3 px-4 py-2.5 rounded-xl border
						{step.done ? 'bg-violet-500/[0.07] border-violet-500/15' : 'bg-white/[0.02] border-white/[0.04]'}">
						<div class="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0
							{step.done ? 'bg-violet-500' : 'bg-white/[0.05] border border-white/[0.08]'}">
							{#if step.done}
								<Check size={9} class="text-white" />
							{:else}
								<span class="text-[9px] font-mono text-white/25">{step.n}</span>
							{/if}
						</div>
						<p class="text-xs font-body {step.done ? 'text-violet-300' : 'text-white/25'} text-left">{step.label}</p>
					</div>
				{/each}
			</div>
		</div>
	{/if}

</div>
</div>

<!-- ══════════════════════════════════════════════════════════ FLOATING BUTTONS -->
<!-- Only show when slides are ready -->
{#if hasSlides}
<div class="fixed bottom-8 z-50 flex flex-col items-end gap-2" style="right: calc(256px + 24px);">

	<!-- POST button + panel -->
	<div class="relative">
		{#if showPostPanel}
			<!-- Post panel -->
			<div class="absolute bottom-full mb-2 right-0 w-[340px] rounded-2xl bg-[#111] border border-white/[0.1] shadow-2xl overflow-hidden">
				<!-- Header -->
				<div class="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
					<div class="flex items-center gap-2">
						<Calendar size={13} class="text-cyan-400" />
						<span class="text-xs font-mono font-semibold text-white/80 uppercase tracking-wider">Schedule Post</span>
					</div>
					<button onclick={() => showPostPanel = false}
						class="w-6 h-6 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] flex items-center justify-center text-white/40 hover:text-white/80 transition-all">
						<X size={11} />
					</button>
				</div>

				<div class="p-4 flex flex-col gap-4">
					<!-- Platforms -->
					<div>
						<p class="text-[9px] font-mono text-white/30 uppercase tracking-widest mb-2.5">Platforms</p>
						<div class="grid grid-cols-3 gap-2">
							<!-- Instagram -->
							<button onclick={() => togglePlatform('instagram')}
								class="flex flex-col items-center gap-1.5 py-3 rounded-xl border-2 transition-all
									{selectedPlatforms.includes('instagram')
										? 'border-pink-500/60 bg-pink-500/10'
										: 'border-white/[0.07] bg-white/[0.02] hover:border-white/20'}">
								<!-- Instagram icon -->
								<svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
									<rect x="2" y="2" width="20" height="20" rx="5" stroke="{selectedPlatforms.includes('instagram') ? '#ec4899' : 'rgba(255,255,255,0.4)'}" stroke-width="1.8"/>
									<circle cx="12" cy="12" r="4.5" stroke="{selectedPlatforms.includes('instagram') ? '#ec4899' : 'rgba(255,255,255,0.4)'}" stroke-width="1.8"/>
									<circle cx="17.5" cy="6.5" r="1" fill="{selectedPlatforms.includes('instagram') ? '#ec4899' : 'rgba(255,255,255,0.4)'}"/>
								</svg>
								<span class="text-[9px] font-mono {selectedPlatforms.includes('instagram') ? 'text-pink-400' : 'text-white/30'}">Instagram</span>
							</button>

							<!-- LinkedIn -->
							<button onclick={() => togglePlatform('linkedin')}
								class="flex flex-col items-center gap-1.5 py-3 rounded-xl border-2 transition-all
									{selectedPlatforms.includes('linkedin')
										? 'border-blue-500/60 bg-blue-500/10'
										: 'border-white/[0.07] bg-white/[0.02] hover:border-white/20'}">
								<svg width="20" height="20" viewBox="0 0 24 24" fill="{selectedPlatforms.includes('linkedin') ? '#3b82f6' : 'rgba(255,255,255,0.4)'}" xmlns="http://www.w3.org/2000/svg">
									<path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/>
									<rect x="2" y="9" width="4" height="12"/>
									<circle cx="4" cy="4" r="2"/>
								</svg>
								<span class="text-[9px] font-mono {selectedPlatforms.includes('linkedin') ? 'text-blue-400' : 'text-white/30'}">LinkedIn</span>
							</button>

							<!-- Pinterest -->
							<button onclick={() => togglePlatform('pinterest')}
								class="flex flex-col items-center gap-1.5 py-3 rounded-xl border-2 transition-all
									{selectedPlatforms.includes('pinterest')
										? 'border-red-500/60 bg-red-500/10'
										: 'border-white/[0.07] bg-white/[0.02] hover:border-white/20'}">
								<svg width="20" height="20" viewBox="0 0 24 24" fill="{selectedPlatforms.includes('pinterest') ? '#ef4444' : 'rgba(255,255,255,0.4)'}" xmlns="http://www.w3.org/2000/svg">
									<path d="M12 0C5.373 0 0 5.373 0 12c0 5.084 3.163 9.426 7.627 11.174-.105-.949-.2-2.405.042-3.441.218-.937 1.407-5.965 1.407-5.965s-.359-.719-.359-1.782c0-1.668.967-2.914 2.171-2.914 1.023 0 1.518.769 1.518 1.69 0 1.029-.655 2.568-.994 3.995-.283 1.194.599 2.169 1.777 2.169 2.133 0 3.772-2.249 3.772-5.495 0-2.873-2.064-4.882-5.012-4.882-3.414 0-5.418 2.561-5.418 5.207 0 1.031.397 2.138.893 2.738a.36.36 0 0 1 .083.345l-.333 1.36c-.053.22-.174.267-.402.161-1.499-.698-2.436-2.889-2.436-4.649 0-3.785 2.75-7.262 7.929-7.262 4.163 0 7.398 2.967 7.398 6.931 0 4.136-2.607 7.464-6.227 7.464-1.216 0-2.359-.632-2.75-1.378l-.748 2.853c-.271 1.043-1.002 2.35-1.492 3.146C9.57 23.812 10.763 24 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0z"/>
								</svg>
								<span class="text-[9px] font-mono {selectedPlatforms.includes('pinterest') ? 'text-red-400' : 'text-white/30'}">Pinterest</span>
							</button>
						</div>
					</div>

					<!-- Date + Time -->
					<div class="grid grid-cols-2 gap-2">
						<div>
							<p class="text-[9px] font-mono text-white/30 uppercase tracking-widest mb-1.5">Date</p>
							<input type="date" bind:value={scheduleDate}
								class="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl py-2 px-3 text-xs font-mono text-white/60 focus:outline-none focus:border-cyan-500/40 transition-colors [color-scheme:dark]" />
						</div>
						<div>
							<p class="text-[9px] font-mono text-white/30 uppercase tracking-widest mb-1.5">Time</p>
							<input type="time" bind:value={scheduleTime}
								class="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl py-2 px-3 text-xs font-mono text-white/60 focus:outline-none focus:border-cyan-500/40 transition-colors [color-scheme:dark]" />
						</div>
					</div>

					<!-- Schedule button -->
					<button disabled
						class="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold font-body text-white/40 bg-white/[0.05] border border-white/[0.08] cursor-not-allowed transition-all">
						<Send size={13} class="opacity-40" />
						Schedule Post
						<span class="ml-auto text-[9px] font-mono text-white/20 bg-white/[0.05] px-2 py-0.5 rounded-md">Soon</span>
					</button>
				</div>
			</div>
		{/if}

		<button
			onclick={() => { showPostPanel = !showPostPanel; showMusicPanel = false; }}
			class="flex items-center gap-2 pl-3 pr-4 py-2.5 rounded-2xl text-xs font-semibold font-body shadow-lg transition-all
				{showPostPanel
					? 'bg-cyan-500 text-white shadow-[0_0_20px_rgba(6,182,212,0.4)]'
					: 'bg-[#1a1a1a] border border-white/[0.12] text-white/70 hover:text-white hover:border-cyan-500/40 hover:bg-[#1e1e1e]'}">
			<Calendar size={14} />
			Post
		</button>
	</div>

	<!-- BURN MUSIC button + panel -->
	<div class="relative">
		{#if showMusicPanel}
			<!-- Music panel -->
			<div class="absolute bottom-full mb-2 right-0 w-[400px] rounded-2xl bg-[#111] border border-white/[0.1] shadow-2xl overflow-hidden">
				<!-- Header -->
				<div class="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
					<div class="flex items-center gap-2">
						<Music size={13} class="text-violet-400" />
						<span class="text-xs font-mono font-semibold text-white/80 uppercase tracking-wider">Burn Music</span>
					</div>
					<button onclick={() => showMusicPanel = false}
						class="w-6 h-6 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] flex items-center justify-center text-white/40 hover:text-white/80 transition-all">
						<X size={11} />
					</button>
				</div>

				<!-- Slide rows -->
				<div class="max-h-[320px] overflow-y-auto" style="scrollbar-width:thin;scrollbar-color:rgba(255,255,255,0.08) transparent;">
					{#each extractedSlides as slide, i}
						{@const music = slideMusic[i] ?? { song: 'No music', seconds: 15 }}
						<div class="flex items-center gap-3 px-4 py-2.5 border-b border-white/[0.04] last:border-0 hover:bg-white/[0.02] transition-colors">
							<!-- Slide badge -->
							<div class="w-6 h-6 rounded-lg bg-violet-500/15 border border-violet-500/20 flex items-center justify-center flex-shrink-0">
								<span class="text-[9px] font-mono font-bold text-violet-400">{i + 1}</span>
							</div>

							<!-- Label -->
							<span class="text-[10px] font-mono text-white/40 w-16 flex-shrink-0 truncate">{slide.label}</span>

							<!-- Song dropdown -->
							<select
								value={music.song}
								onchange={(e) => {
									const arr = [...slideMusic];
									if (!arr[i]) arr[i] = { song: 'No music', seconds: 15 };
									arr[i] = { ...arr[i], song: (e.target as HTMLSelectElement).value };
									slideMusic = arr;
								}}
								class="flex-1 bg-white/[0.05] border border-white/[0.08] rounded-lg py-1 px-2 text-[10px] font-body text-white/60 focus:outline-none focus:border-violet-500/40 transition-colors [color-scheme:dark] cursor-pointer">
								{#each SONG_OPTIONS as opt}
									<option value={opt}>{opt}</option>
								{/each}
							</select>

							<!-- Seconds -->
							<div class="flex items-center gap-1.5 flex-shrink-0">
								<input
									type="range" min="1" max="60" step="1"
									value={music.seconds}
									oninput={(e) => {
										const arr = [...slideMusic];
										if (!arr[i]) arr[i] = { song: 'No music', seconds: 15 };
										arr[i] = { ...arr[i], seconds: parseInt((e.target as HTMLInputElement).value) };
										slideMusic = arr;
									}}
									class="w-16 accent-violet-500 cursor-pointer" />
								<span class="text-[9px] font-mono text-white/30 w-8 text-right">{music.seconds}s</span>
							</div>
						</div>
					{/each}
				</div>

				<!-- Footer -->
				<div class="px-4 py-3 border-t border-white/[0.06]">
					<button disabled
						class="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold font-body text-white/40 bg-white/[0.05] border border-white/[0.08] cursor-not-allowed">
						<Music size={13} class="opacity-40" />
						Export as Video
						<span class="ml-auto text-[9px] font-mono text-white/20 bg-white/[0.05] px-2 py-0.5 rounded-md">Coming soon</span>
					</button>
				</div>
			</div>
		{/if}

		<button
			onclick={() => { showMusicPanel = !showMusicPanel; showPostPanel = false; }}
			class="flex items-center gap-2 pl-3 pr-4 py-2.5 rounded-2xl text-xs font-semibold font-body shadow-lg transition-all
				{showMusicPanel
					? 'bg-violet-600 text-white shadow-[0_0_20px_rgba(139,92,246,0.5)]'
					: 'bg-[#1a1a1a] border border-white/[0.12] text-white/70 hover:text-white hover:border-violet-500/40 hover:bg-[#1e1e1e]'}">
			<Music size={14} />
			Burn Music
		</button>
	</div>

</div>
{/if}
