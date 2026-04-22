<script lang="ts">
	import { supabase } from '$lib/supabase';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { toPng } from 'html-to-image';
	import ArticleTemplate from '$lib/components/templates/ArticleTemplate.svelte';
	import FloatingActions from '$lib/components/FloatingActions.svelte';
	import { Download, Loader, Copy, Plus, Trash2, CheckSquare, Square, Image, FileText } from 'lucide-svelte';

	// ── Types ──────────────────────────────────────────────────────────────────
	interface ArticleSlide {
		id: string;
		text: string;
		image: string;
	}

	// ── Auth ──────────────────────────────────────────────────────────────────
	onMount(async () => {
		const { data: { user } } = await supabase.auth.getUser();
		if (!user) goto('/login');
	});

	// ── Shared settings ───────────────────────────────────────────────────────
	let accentColor   = $state('#3ecf8e');
	let bgColor       = $state('#000000');
	let logoSrc       = $state('');
	let logoRingColor = $state('#c9b97a');
	let showSwipe     = $state(true);
	let swipeText     = $state('«« Swipe');

	// ── Slides ────────────────────────────────────────────────────────────────
	let slides = $state<ArticleSlide[]>([{
		id: crypto.randomUUID(),
		text: "Here's the trillion-dollar problem everyone avoids.\n\nTo break it down:\n\nA *1-gigawatt AI data center* costs roughly *$80B* to build & operate.",
		image: '',
	}]);
	let activeIdx = $state(0);
	let s = $derived(slides[activeIdx]);

	// ── Slide management ──────────────────────────────────────────────────────
	function addSlide() {
		slides = [...slides, { id: crypto.randomUUID(), text: '', image: '' }];
		activeIdx = slides.length - 1;
	}

	function duplicateSlide() {
		const dup: ArticleSlide = { ...slides[activeIdx], id: crypto.randomUUID() };
		slides = [...slides.slice(0, activeIdx + 1), dup, ...slides.slice(activeIdx + 1)];
		activeIdx = activeIdx + 1;
	}

	function deleteSlide(i: number) {
		if (slides.length === 1) return;
		slides = slides.filter((_, idx) => idx !== i);
		activeIdx = Math.min(activeIdx, slides.length - 1);
	}

	// ── File helpers ──────────────────────────────────────────────────────────
	function readAsDataURL(file: File): Promise<string> {
		return new Promise(res => {
			const r = new FileReader();
			r.onload = () => res(r.result as string);
			r.readAsDataURL(file);
		});
	}

	async function handleLogoUpload(e: Event) {
		const file = (e.target as HTMLInputElement).files?.[0];
		if (file) logoSrc = await readAsDataURL(file);
	}

	async function handleSlideImageUpload(e: Event) {
		const file = (e.target as HTMLInputElement).files?.[0];
		if (file) slides[activeIdx].image = await readAsDataURL(file);
	}

	// ── Export ────────────────────────────────────────────────────────────────
	let exporting    = $state(false);
	let exportingAll = $state(false);
	let exportRef: HTMLElement | null = $state(null);

	async function exportCurrent() {
		if (!exportRef) return;
		exporting = true;
		try {
			const dataUrl = await toPng(exportRef, {
				width: 1080, height: 1350, pixelRatio: 1,
				style: { transform: 'scale(1)', transformOrigin: 'top left' },
			});
			const a = document.createElement('a');
			a.href = dataUrl;
			a.download = `article-slide-${activeIdx + 1}.png`;
			a.click();
		} catch (e: any) { alert('Export failed: ' + e.message); }
		exporting = false;
	}

	async function exportAll() {
		exportingAll = true;
		const saved = activeIdx;
		for (let i = 0; i < slides.length; i++) {
			activeIdx = i;
			await new Promise(r => setTimeout(r, 120));
			if (!exportRef) continue;
			try {
				const dataUrl = await toPng(exportRef, {
					width: 1080, height: 1350, pixelRatio: 1,
					style: { transform: 'scale(1)', transformOrigin: 'top left' },
				});
				const a = document.createElement('a');
				a.href = dataUrl;
				a.download = `article-slide-${i + 1}.png`;
				a.click();
				await new Promise(r => setTimeout(r, 150));
			} catch {}
		}
		activeIdx = saved;
		exportingAll = false;
	}

	const PREVIEW_W  = 520;
	const previewScale = $derived(PREVIEW_W / 1080);
	const THUMB_W    = 88;
	const thumbScale = THUMB_W / 1080;
</script>

<FloatingActions {...({ slideLabels: slides.map((_, i) => `Slide ${i + 1}`) } as any)} />

<div class="flex h-full overflow-hidden">

	<!-- ── Left sidebar ────────────────────────────────────────────────────── -->
	<div class="w-80 flex-shrink-0 border-r border-white/[0.05] bg-[#0d0d0d] flex flex-col overflow-hidden">

		<!-- Header -->
		<div class="px-5 py-4 border-b border-white/[0.04] flex-shrink-0">
			<div class="flex items-center gap-2">
				<FileText size={13} class="text-emerald-400" />
				<h1 class="font-display font-bold text-base text-white">Article Studio</h1>
			</div>
			<p class="font-body text-xs text-white/40 mt-0.5">Text + image breakdown carousels</p>
		</div>

		<!-- ── Slide strip ─────────────────────────────────────────────────── -->
		<div class="flex-shrink-0 border-b border-white/[0.04] px-3 py-3">
			<div class="flex items-center gap-1.5 mb-2.5">
				<span class="text-[9px] font-mono text-white/25 uppercase tracking-widest flex-1">Slides ({slides.length})</span>
				<button onclick={duplicateSlide} title="Duplicate"
					class="p-1 rounded-md hover:bg-white/[0.06] text-white/25 hover:text-white/60 transition-colors">
					<Copy size={11} />
				</button>
				<button onclick={addSlide} title="Add slide"
					class="p-1 rounded-md hover:bg-white/[0.06] text-white/25 hover:text-emerald-400 transition-colors">
					<Plus size={11} />
				</button>
			</div>

			<div class="flex gap-2 overflow-x-auto pb-1" style="scrollbar-width: none;">
				{#each slides as slide, i (slide.id)}
					<button
						onclick={() => activeIdx = i}
						class="relative flex-shrink-0 group rounded-xl overflow-hidden border-2 transition-all {i === activeIdx ? 'border-emerald-500' : 'border-white/[0.07] hover:border-white/20'}"
						style="width: {THUMB_W}px; height: {Math.round(THUMB_W * 1350/1080)}px;"
					>
						<div style="width: {THUMB_W}px; height: {Math.round(THUMB_W * 1350/1080)}px; overflow: hidden; pointer-events: none;">
							<ArticleTemplate
								text={slide.text || 'Slide text…'}
								image={slide.image}
								{accentColor} {bgColor} {logoSrc} {logoRingColor} {showSwipe} {swipeText}
								scale={thumbScale}
								interactive={false}
							/>
						</div>
						<div class="absolute top-1 left-1 w-4 h-4 rounded-full bg-black/70 flex items-center justify-center">
							<span class="text-[8px] font-mono text-white/70">{i + 1}</span>
						</div>
						{#if slides.length > 1}
							<button
								onclick={(e) => { e.stopPropagation(); deleteSlide(i); }}
								class="absolute top-1 right-1 w-4 h-4 rounded-full bg-black/70 hover:bg-red-500/80 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
								<Trash2 size={7} class="text-white" />
							</button>
						{/if}
					</button>
				{/each}

				<button onclick={addSlide}
					class="flex-shrink-0 rounded-xl border-2 border-dashed border-white/[0.08] hover:border-emerald-500/40 flex items-center justify-center text-white/20 hover:text-emerald-400 transition-all"
					style="width: {THUMB_W}px; height: {Math.round(THUMB_W * 1350/1080)}px;">
					<Plus size={16} />
				</button>
			</div>
		</div>

		<!-- ── Scrollable form ─────────────────────────────────────────────── -->
		<div class="flex-1 overflow-y-auto">
			<div class="flex flex-col gap-5 p-4">

				<!-- ── Slide text ────────────────────────────────────────────── -->
				<div>
					<div class="flex items-center justify-between mb-2">
						<p class="text-[10px] font-mono text-white/30 uppercase tracking-wider">Slide {activeIdx + 1} text</p>
						<span class="text-[9px] font-mono text-white/20">*word* = accent color</span>
					</div>
					<textarea
						bind:value={slides[activeIdx].text}
						rows={8}
						placeholder={"Write your text here…\n\nBlank line = new paragraph.\nWrap *words* in asterisks for accent color."}
						class="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl py-3 px-3 text-sm font-body text-white placeholder-white/20 focus:outline-none focus:border-emerald-500/40 transition-colors resize-none leading-relaxed"
					></textarea>
				</div>

				<!-- ── Slide image ────────────────────────────────────────────── -->
				<div>
					<p class="text-[10px] font-mono text-white/30 uppercase tracking-wider mb-2">Slide {activeIdx + 1} image</p>
					{#if s.image}
						<div class="relative rounded-xl overflow-hidden mb-1">
							<img src={s.image} alt="" class="w-full h-32 object-cover" />
							<button onclick={() => slides[activeIdx].image = ''}
								class="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/70 text-white text-xs flex items-center justify-center hover:bg-red-500/80 transition-colors">✕</button>
						</div>
					{:else}
						<label class="flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-body text-white/30 border border-dashed border-white/[0.08] hover:border-emerald-500/30 cursor-pointer transition-colors">
							<Image size={12} /> Add image (optional)
							<input type="file" accept="image/*" class="hidden" onchange={handleSlideImageUpload} />
						</label>
					{/if}
				</div>

				<div class="border-t border-white/[0.05]"></div>

				<!-- ── Brand settings (shared) ───────────────────────────────── -->
				<div>
					<p class="text-[10px] font-mono text-white/30 uppercase tracking-wider mb-3">Brand</p>

					<!-- Logo upload -->
					<div class="flex items-center gap-3 mb-3">
						<div class="w-10 h-10 rounded-full overflow-hidden flex-shrink-0 flex items-center justify-center"
							style="background: {bgColor}; outline: 2px solid {logoRingColor}; outline-offset: 2px;">
							{#if logoSrc}
								<img src={logoSrc} alt="" class="w-full h-full object-cover" />
							{:else}
								<svg width="18" height="18" viewBox="0 0 24 24" fill="none">
									<path d="M13 2L4.5 13.5H11L10 22L19.5 10.5H13L13 2Z" fill="{logoRingColor}" stroke="{logoRingColor}" stroke-width="0.5" stroke-linejoin="round"/>
								</svg>
							{/if}
						</div>
						<label class="flex-1 text-[11px] font-mono text-white/30 border border-white/[0.07] rounded-lg px-2.5 py-1.5 cursor-pointer hover:border-white/20 transition-colors">
							{logoSrc ? 'Change logo' : 'Upload logo'}
							<input type="file" accept="image/*" class="hidden" onchange={handleLogoUpload} />
						</label>
						{#if logoSrc}
							<button onclick={() => logoSrc = ''} class="text-white/20 hover:text-red-400 transition-colors text-xs">✕</button>
						{/if}
					</div>

					<!-- Colors -->
					<div class="flex gap-3 mb-3">
						<div class="flex-1">
							<p class="text-[10px] font-mono text-white/25 mb-1.5">Background</p>
							<div class="flex items-center gap-2">
								<input type="color" bind:value={bgColor} class="w-8 h-8 rounded-lg cursor-pointer border border-white/10" />
								<input bind:value={bgColor} class="flex-1 bg-white/[0.04] border border-white/[0.08] rounded-lg py-1.5 px-2 text-xs font-mono text-white/70 focus:outline-none focus:border-white/30" />
							</div>
						</div>
						<div class="flex-1">
							<p class="text-[10px] font-mono text-white/25 mb-1.5">Accent</p>
							<div class="flex items-center gap-2">
								<input type="color" bind:value={accentColor} class="w-8 h-8 rounded-lg cursor-pointer border border-white/10" />
								<input bind:value={accentColor} class="flex-1 bg-white/[0.04] border border-white/[0.08] rounded-lg py-1.5 px-2 text-xs font-mono text-white/70 focus:outline-none focus:border-white/30" />
							</div>
						</div>
					</div>
					<div class="flex gap-3">
						<div class="flex-1">
							<p class="text-[10px] font-mono text-white/25 mb-1.5">Ring color</p>
							<div class="flex items-center gap-2">
								<input type="color" bind:value={logoRingColor} class="w-8 h-8 rounded-lg cursor-pointer border border-white/10" />
								<input bind:value={logoRingColor} class="flex-1 bg-white/[0.04] border border-white/[0.08] rounded-lg py-1.5 px-2 text-xs font-mono text-white/70 focus:outline-none focus:border-white/30" />
							</div>
						</div>
					</div>
				</div>

				<div class="border-t border-white/[0.05]"></div>

				<!-- ── Swipe pill ─────────────────────────────────────────────── -->
				<div>
					<p class="text-[10px] font-mono text-white/30 uppercase tracking-wider mb-3">Swipe indicator</p>
					<button onclick={() => showSwipe = !showSwipe}
						class="flex items-center gap-2 text-[11px] font-mono mb-3 {showSwipe ? 'text-white/60' : 'text-white/25'} hover:text-white/70 transition-colors">
						{#if showSwipe}<CheckSquare size={12} />{:else}<Square size={12} />{/if}
						Show swipe pill
					</button>
					{#if showSwipe}
						<input bind:value={swipeText}
							class="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl py-2 px-3 text-sm font-body text-white placeholder-white/20 focus:outline-none focus:border-white/30 transition-colors" />
					{/if}
				</div>

				<div class="border-t border-white/[0.05]"></div>

				<!-- Export -->
				<div class="flex flex-col gap-2 pb-2">
					<button onclick={exportCurrent} disabled={exporting || exportingAll}
						class="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold font-body text-black bg-emerald-400 hover:bg-emerald-300 transition-all disabled:opacity-50">
						{#if exporting}
							<Loader size={13} class="animate-spin" /> Exporting…
						{:else}
							<Download size={13} /> Export slide {activeIdx + 1}
						{/if}
					</button>
					{#if slides.length > 1}
						<button onclick={exportAll} disabled={exporting || exportingAll}
							class="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold font-body text-white/70 bg-white/[0.06] hover:bg-white/[0.09] transition-all disabled:opacity-50">
							{#if exportingAll}
								<Loader size={13} class="animate-spin" /> Exporting all…
							{:else}
								<Download size={13} /> Export all {slides.length} slides
							{/if}
						</button>
					{/if}
				</div>

			</div>
		</div>
	</div>

	<!-- ── Preview panel ───────────────────────────────────────────────────── -->
	<div class="flex-1 flex flex-col items-center justify-center bg-[#060606] overflow-auto p-8 gap-4">
		<p class="font-mono text-[10px] text-white/20 uppercase tracking-widest">
			Slide {activeIdx + 1} / {slides.length} — 1080 × 1350
		</p>

		<div style="width: {PREVIEW_W}px; height: {Math.round(PREVIEW_W * 1350 / 1080)}px;">
			<ArticleTemplate
				bind:exportRef
				text={s.text}
				image={s.image}
				{accentColor} {bgColor} {logoSrc} {logoRingColor} {showSwipe} {swipeText}
				scale={previewScale}
				showToolbar={true}
				onTextChange={(v) => {
					const i = activeIdx;
					slides = slides.map((sl, j) => (j === i ? { ...sl, text: v } : sl));
				}}
			/>
		</div>

		{#if slides.length > 1}
			<div class="flex items-center gap-3 mt-1">
				<button onclick={() => activeIdx = Math.max(0, activeIdx - 1)} disabled={activeIdx === 0}
					class="px-3 py-1.5 rounded-lg text-xs font-mono text-white/40 hover:text-white/80 bg-white/[0.04] hover:bg-white/[0.08] disabled:opacity-25 transition-all">
					← Prev
				</button>
				<span class="text-[10px] font-mono text-white/20">{activeIdx + 1} / {slides.length}</span>
				<button onclick={() => activeIdx = Math.min(slides.length - 1, activeIdx + 1)} disabled={activeIdx === slides.length - 1}
					class="px-3 py-1.5 rounded-lg text-xs font-mono text-white/40 hover:text-white/80 bg-white/[0.04] hover:bg-white/[0.08] disabled:opacity-25 transition-all">
					Next →
				</button>
			</div>
		{/if}
	</div>

</div>
