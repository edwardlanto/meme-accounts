<script lang="ts">
	import { supabase } from '$lib/supabase';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { wizardStore } from '$lib/stores/wizard';
	import SlideCard from '$lib/components/SlideCard.svelte';
	import {
		ChevronLeft, ChevronRight, Upload, Sparkles, X, Loader,
		Image, Palette, FileText, Zap, Check, Download, Video,
		RefreshCw, AlertCircle
	} from 'lucide-svelte';
	import { toPng } from 'html-to-image';

	// ── Auth ─────────────────────────────────────────────────────────────────
	let userId = $state('');

	// ── Wizard step (1–4) ─────────────────────────────────────────────────
	let step = $state(1);

	// ── Step 1: Topic ─────────────────────────────────────────────────────
	let topic = $state('');
	let audience = $state('');

	// ── Step 2: Images ────────────────────────────────────────────────────
	let images = $state<string[]>([]);    // base64 data URLs
	let imageNames = $state<string[]>([]);
	let dragging = $state(false);
	let uploadEl: HTMLInputElement;

	// ── Step 3: Style ─────────────────────────────────────────────────────
	let style = $state<'bold' | 'editorial' | 'minimal' | 'first-person'>('bold');
	let slideCount = $state(8);
	let brandColor = $state('#7bf1a8');
	let brandName = $state('Your Brand');

	const styles = [
		{ id: 'bold',     label: 'Bold & Punchy',  desc: 'High energy. Short hits. Emoji-forward.' },
		{ id: 'editorial',label: 'Magazine',       desc: 'Elegant rhythm. Reads like great writing.' },
		{ id: 'minimal',  label: 'Clean Pro',      desc: 'Structured. Business-ready. Clear.' },
		{ id: 'first-person', label: 'First Person', desc: 'I/we voice. Personal, direct, conversational.' },
	] as const;

	const slideCounts = [5, 8, 10, 12];

	// ── Step 4: Generate ──────────────────────────────────────────────────
	let generating = $state(false);
	let slides = $state<any[]>([]);
	let genError = $state('');
	let saving = $state(false);
	let savedId = $state('');
	let activePreview = $state(0);

	// Export refs for each slide
	let exportRefs = $state<(HTMLElement | null)[]>([]);
	let exporting = $state(false);

	onMount(async () => {
		const { data: { user } } = await supabase.auth.getUser();
		if (!user) { goto('/login'); return; }
		userId = user.id;
	});

	// ── Image helpers ─────────────────────────────────────────────────────
	async function resizeImage(file: File, maxPx = 1080): Promise<string> {
		return new Promise((resolve) => {
			const img = new window.Image();
			const url = URL.createObjectURL(file);
			img.onload = () => {
				const ratio = Math.min(maxPx / img.width, maxPx / img.height, 1);
				const canvas = document.createElement('canvas');
				canvas.width  = Math.round(img.width  * ratio);
				canvas.height = Math.round(img.height * ratio);
				canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
				URL.revokeObjectURL(url);
				resolve(canvas.toDataURL('image/jpeg', 0.88));
			};
			img.src = url;
		});
	}

	async function addFiles(files: FileList | File[]) {
		for (const file of Array.from(files)) {
			if (!file.type.startsWith('image/')) continue;
			if (images.length >= 10) break;
			const dataUrl = await resizeImage(file);
			images = [...images, dataUrl];
			imageNames = [...imageNames, file.name];
		}
	}

	function removeImage(i: number) {
		images = images.filter((_, idx) => idx !== i);
		imageNames = imageNames.filter((_, idx) => idx !== i);
	}

	function onDrop(e: DragEvent) {
		e.preventDefault();
		dragging = false;
		if (e.dataTransfer?.files) addFiles(e.dataTransfer.files);
	}

	// ── Generate slides ───────────────────────────────────────────────────
	async function generate() {
		if (!topic.trim()) return;
		generating = true;
		genError = '';
		slides = [];
		step = 4;

		try {
			const res = await fetch('/api/generate-slides', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					topic: topic.trim(),
					style,
					slideCount,
					imageCount: images.length,
					audience: audience.trim(),
				}),
			});
			const data = await res.json();
			if (data.error) {
				if (res.status === 402) {
					throw new Error(`${data.error} Upgrade at /pricing`);
				}
				throw new Error(data.error);
			}
			slides = data.slides ?? [];
			exportRefs = new Array(slides.length).fill(null);

			// Save to wizard store
			wizardStore.set({ carouselId: null, images, slides, topic, style, brandColor, brandName });

			// Auto-save to Supabase
			await saveCarousel();
		} catch (err: any) {
			genError = err.message;
		} finally {
			generating = false;
		}
	}

	async function saveCarousel() {
		if (savedId) return savedId;
		saving = true;
		const { data, error } = await (supabase as any)
			.from('carousels')
			.insert({
				user_id: userId,
				title: topic.trim().slice(0, 80),
				status: 'draft',
				slides: JSON.stringify(slides),
				style_config: JSON.stringify({ brandColor, brandName, style, images }),
			})
			.select()
			.single();
		saving = false;
		if (error) { genError = error.message; return null; }
		savedId = data.id;
		wizardStore.update(s => ({ ...s, carouselId: data.id }));
		return data.id;
	}

	async function exportAll() {
		exporting = true;
		try {
			const { default: JSZip } = await import('jszip');
			const zip = new JSZip();
			for (let i = 0; i < exportRefs.length; i++) {
				const el = exportRefs[i];
				if (!el) continue;
				const png = await toPng(el, { width: 1080, height: 1350, pixelRatio: 1 });
				const base64 = png.split(',')[1];
				zip.file(`slide-${String(i + 1).padStart(2, '0')}.png`, base64, { base64: true });
			}
			const blob = await zip.generateAsync({ type: 'blob' });
			const url = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url; a.download = 'carousel-slides.zip'; a.click();
			URL.revokeObjectURL(url);
		} catch (err: any) {
			// jszip not available — export individually
			for (let i = 0; i < exportRefs.length; i++) {
				const el = exportRefs[i];
				if (!el) continue;
				const png = await toPng(el, { width: 1080, height: 1350, pixelRatio: 1 });
				const a = document.createElement('a');
				a.href = png; a.download = `slide-${i + 1}.png`; a.click();
				await new Promise(r => setTimeout(r, 300));
			}
		} finally {
			exporting = false;
		}
	}

	function goToVideo() {
		if (savedId) goto(`/dashboard/editor/${savedId}/video`);
	}

	// ── Navigation ────────────────────────────────────────────────────────
	function canNext() {
		if (step === 1) return topic.trim().length >= 3;
		if (step === 2) return true; // images optional
		if (step === 3) return true;
		return false;
	}
</script>

<div class="wizard-root">

	<!-- ── Top bar ──────────────────────────────────────────────────────── -->
	<div class="wizard-topbar">
		<a href="/dashboard/carousels" class="back-btn">
			<ChevronLeft size={15} /> Back
		</a>
		<div class="steps-track">
			{#each [1,2,3,4] as s}
				<div class="step-pip {step >= s ? 'active' : ''} {step > s ? 'done' : ''}">
					{#if step > s}
						<Check size={11} />
					{:else}
						{s}
					{/if}
				</div>
				{#if s < 4}
					<div class="step-line {step > s ? 'active' : ''}"></div>
				{/if}
			{/each}
		</div>
		<div class="step-label">
			{['Topic', 'Photos', 'Style', 'Generate'][step - 1]}
		</div>
	</div>

	<!-- ── Step content ─────────────────────────────────────────────────── -->
	<div class="wizard-body">

		<!-- STEP 1: TOPIC -->
		{#if step === 1}
			<div class="step-content">
				<p class="step-eyebrow">01 / TOPIC</p>
				<h1 class="step-headline">What's your carousel about?</h1>

				<div class="field-group">
					<label class="field-label">Topic or hook <span class="required">*</span></label>
					<textarea
						bind:value={topic}
						placeholder="e.g. 'Why most people never build wealth — and the 3 habits that actually change that'"
						class="big-textarea"
						rows="3"
					></textarea>
					<p class="field-hint">Be specific. A niche topic always outperforms a generic one.</p>
				</div>

				<div class="field-group">
					<label class="field-label">Target audience <span class="optional">(optional)</span></label>
					<input
						bind:value={audience}
						type="text"
						placeholder="e.g. 'Entrepreneurs aged 25–40 who want to escape the 9–5'"
						class="text-input"
					/>
				</div>
			</div>
		{/if}

		<!-- STEP 2: PHOTOS -->
		{#if step === 2}
			<div class="step-content">
				<p class="step-eyebrow">02 / PHOTOS</p>
				<h1 class="step-headline">Add your photos.</h1>

				<!-- Drop zone -->
				<!-- svelte-ignore a11y_click_events_have_key_events -->
				<!-- svelte-ignore a11y_no_static_element_interactions -->
				<div
					class="drop-zone {dragging ? 'dragging' : ''}"
					role="button"
					tabindex="0"
					onclick={() => uploadEl.click()}
					ondragover={(e) => { e.preventDefault(); dragging = true; }}
					ondragleave={() => dragging = false}
					ondrop={onDrop}
				>
					<input
						bind:this={uploadEl}
						type="file" multiple accept="image/*"
						class="hidden-input"
						onchange={(e) => { if (e.currentTarget.files) addFiles(e.currentTarget.files); }}
					/>
					<div class="drop-icon">
						<Upload size={28} />
					</div>
					<p class="drop-text">Drop photos here or <span class="drop-link">browse</span></p>
					<p class="drop-sub">JPEG, PNG, WEBP — resized automatically to 1080px</p>
				</div>

				<!-- Thumbnails -->
				{#if images.length > 0}
					<div class="thumb-grid">
						{#each images as img, i}
							<div class="thumb-item">
								<img src={img} alt={imageNames[i]} class="thumb-img" />
								<button class="thumb-remove" onclick={() => removeImage(i)}>
									<X size={12} />
								</button>
								<span class="thumb-idx">{i}</span>
							</div>
						{/each}
					</div>
				{/if}

				{#if images.length === 0}
					<p class="skip-hint">No photos? That's fine — AI will generate a text-only carousel.</p>
				{/if}
			</div>
		{/if}

		<!-- STEP 3: STYLE -->
		{#if step === 3}
			<div class="step-content">
				<p class="step-eyebrow">03 / STYLE</p>
				<h1 class="step-headline">Choose your look.</h1>

				<!-- Style grid -->
				<div class="style-grid">
					{#each styles as s}
						<button
							class="style-card {style === s.id ? 'selected' : ''}"
							onclick={() => style = s.id as any}
						>
							<div class="style-dot {style === s.id ? 'lit' : ''}"></div>
							<p class="style-name">{s.label}</p>
							<p class="style-desc">{s.desc}</p>
						</button>
					{/each}
				</div>


				<!-- Brand settings -->
				<div class="brand-row">
					<div class="field-group" style="flex:1;">
						<label class="field-label">Brand name</label>
						<input bind:value={brandName} type="text" placeholder="Your Brand" class="text-input" />
					</div>
					<div class="field-group">
						<label class="field-label">Accent color</label>
						<div class="color-row">
							<input bind:value={brandColor} type="color" class="color-swatch" />
							<span class="color-hex">{brandColor}</span>
						</div>
					</div>
				</div>
			</div>
		{/if}

		<!-- STEP 4: GENERATE -->
		{#if step === 4}
			<div class="gen-view">
				{#if generating}
					<div class="gen-loading">
						<div class="gen-spinner">
							<Sparkles size={32} />
						</div>
						<h2 class="gen-title">Generating your carousel…</h2>
						<div class="gen-dots">
							<span></span><span></span><span></span>
						</div>
					</div>
				{:else if genError}
					<div class="gen-error">
						<AlertCircle size={28} />
						<h3>Generation failed</h3>
						<p>{genError}</p>
						<button class="btn-primary" onclick={() => { step = 3; genError = ''; }}>
							<ChevronLeft size={14} /> Back to settings
						</button>
					</div>
				{:else if slides.length > 0}
					<!-- Preview area -->
					<div class="preview-header">
						<div class="preview-meta">
							<h2 class="preview-title">Your carousel is ready</h2>
							<p class="preview-count">{slides.length} slides · {images.length} photo{images.length !== 1 ? 's' : ''} · {style}</p>
						</div>
						<div class="preview-actions">
							<button class="btn-secondary" onclick={() => generate()} title="Regenerate">
								<RefreshCw size={14} /> Regenerate
							</button>
							<button class="btn-secondary" onclick={exportAll} disabled={exporting}>
								{#if exporting}<Loader size={14} class="spin" />{:else}<Download size={14} />{/if}
								Export PNGs
							</button>
							<button class="btn-video" onclick={goToVideo} disabled={!savedId}>
								<Video size={14} /> Make Video
							</button>
						</div>
					</div>

					<!-- Slide filmstrip -->
					<div class="filmstrip">
						{#each slides as slide, i}
							<!-- svelte-ignore a11y_click_events_have_key_events -->
							<!-- svelte-ignore a11y_no_static_element_interactions -->
							<div
								class="film-item {activePreview === i ? 'active' : ''}"
								onclick={() => activePreview = i}
								role="button"
								tabindex="0"
							>
								<SlideCard
									{slide}
									{images}
									{brandColor}
									{brandName}
									total={slides.length}
									scale={0.14}
									bind:exportRef={exportRefs[i]}
								/>
								<span class="film-num">{i + 1}</span>
							</div>
						{/each}
					</div>

					<!-- Main preview -->
					<div class="main-preview">
						{#if slides[activePreview]}
							<SlideCard
								slide={slides[activePreview]}
								{images}
								{brandColor}
								{brandName}
								total={slides.length}
								scale={0.44}
							/>
						{/if}
						<div class="preview-nav">
							<button
								class="nav-arrow"
								disabled={activePreview === 0}
								onclick={() => activePreview--}
							><ChevronLeft size={18} /></button>
							<span class="nav-count">{activePreview + 1} / {slides.length}</span>
							<button
								class="nav-arrow"
								disabled={activePreview === slides.length - 1}
								onclick={() => activePreview++}
							><ChevronRight size={18} /></button>
						</div>
					</div>

					{#if saving}
						<p class="saving-note"><Loader size={12} class="spin" /> Saving to your account…</p>
					{:else if savedId}
						<p class="saving-note saved"><Check size={12} /> Saved · <a href="/dashboard/editor/{savedId}" class="edit-link">Open in editor</a></p>
					{/if}
				{/if}
			</div>
		{/if}
	</div>

	<!-- ── Bottom navigation ─────────────────────────────────────────────── -->
	{#if step < 4}
		<div class="wizard-footer">
			<button
				class="btn-ghost"
				onclick={() => step--}
				disabled={step === 1}
			>
				<ChevronLeft size={15} /> Back
			</button>
			{#if step < 3}
				<button
					class="btn-primary"
					onclick={() => step++}
					disabled={!canNext()}
				>
					Continue <ChevronRight size={15} />
				</button>
			{:else}
				<button
					class="btn-primary btn-generate"
					onclick={generate}
					disabled={generating}
				>
					<Sparkles size={15} /> Generate {slideCount} slides <ChevronRight size={15} />
				</button>
			{/if}
		</div>
	{/if}
</div>

<style>
	:root:not([data-theme="dark"]) {
		--wiz-bg: var(--app-bg);
		--wiz-border: var(--app-border);
		--wiz-border-2: var(--app-border-hover);
		--wiz-text: var(--app-text);
		--wiz-muted: var(--app-text-2);
		--wiz-muted2: var(--app-text-3);
		--wiz-input-bg: var(--app-surface-2);
		--wiz-input-border: var(--app-border);
		--wiz-chip-bg: color-mix(in oklab, var(--app-text) 5%, transparent);
		--wiz-chip-border: color-mix(in oklab, var(--app-text) 12%, transparent);
		--wiz-elev: 0 18px 60px rgba(2, 6, 23, 0.08);
	}
	:root[data-theme="dark"] {
		--wiz-bg: #080808;
		--wiz-border: rgba(255,255,255,0.08);
		--wiz-border-2: rgba(255,255,255,0.14);
		--wiz-text: rgba(255,255,255,0.92);
		--wiz-muted: rgba(255,255,255,0.55);
		--wiz-muted2: rgba(255,255,255,0.32);
		--wiz-input-bg: rgba(255,255,255,0.04);
		--wiz-input-border: rgba(255,255,255,0.08);
		--wiz-chip-bg: rgba(255,255,255,0.05);
		--wiz-chip-border: rgba(255,255,255,0.10);
		--wiz-elev: 0 18px 60px rgba(0,0,0,0.42);
	}

	.wizard-root {
		display: flex;
		flex-direction: column;
		height: 100vh;
		background: var(--wiz-bg);
		overflow: hidden;
	}

	/* ── Top bar ─────────────────────────────────────────────────────────── */
	.wizard-topbar {
		display: flex;
		align-items: center;
		gap: 24px;
		padding: 20px 32px;
		border-bottom: 1px solid var(--wiz-border);
		flex-shrink: 0;
	}

	.back-btn {
		display: flex;
		align-items: center;
		gap: 4px;
		font-size: 13px;
		color: var(--wiz-muted2);
		text-decoration: none;
		font-family: var(--font-display);
		transition: color 0.15s;
	}
	.back-btn:hover { color: var(--wiz-muted); }

	.steps-track {
		display: flex;
		align-items: center;
		gap: 0;
	}

	.step-pip {
		width: 28px; height: 28px;
		border-radius: 50%;
		border: 1.5px solid var(--wiz-border);
		display: flex; align-items: center; justify-content: center;
		font-family: var(--font-display);
		font-size: 11px;
		color: var(--wiz-muted2);
		transition: all 0.2s;
		flex-shrink: 0;
	}
	.step-pip.active {
		border-color: #7bf1a8;
		color: #7bf1a8;
		background: rgba(123,241,168,0.08);
	}
	.step-pip.done {
		border-color: #7bf1a8;
		background: #7bf1a8;
		color: #0a0a0a;
	}
	.step-line {
		width: 32px; height: 1.5px;
		background: var(--wiz-border);
		transition: background 0.2s;
	}
	.step-line.active { background: rgba(123,241,168,0.4); }

	.step-label {
		font-family: var(--font-display);
		font-size: 11px;
		color: var(--wiz-muted2);
		text-transform: uppercase;
		letter-spacing: 0.1em;
		margin-left: auto;
	}

	/* ── Body ────────────────────────────────────────────────────────────── */
	.wizard-body {
		flex: 1;
		overflow-y: auto;
		display: flex;
		align-items: flex-start;
		justify-content: center;
		padding: 48px 32px 120px;
	}

	.step-content {
		width: 100%;
		max-width: 640px;
	}

	.step-eyebrow {
		font-family: var(--font-display);
		font-size: 11px;
		letter-spacing: 0.14em;
		color: #7bf1a8;
		margin: 0 0 16px;
		text-transform: uppercase;
	}

	.step-headline {
		font-family: var(--font-display), var(--font-sans), system-ui, -apple-system, sans-serif;
		font-size: 48px;
		font-weight: 900;
		color: var(--wiz-text);
		margin: 0 0 12px;
		line-height: 1.08;
		letter-spacing: -0.02em;
	}

	.step-sub {
		font-family: var(--font-display);
		font-size: 16px;
		color: var(--wiz-muted);
		margin: 0 0 40px;
		line-height: 1.6;
	}

	/* ── Fields ─────────────────────────────────────────────────────────── */
	.field-group { margin-bottom: 28px; }

	.field-label {
		display: block;
		font-family: var(--font-display);
		font-size: 11px;
		text-transform: uppercase;
		letter-spacing: 0.1em;
		color: var(--wiz-muted2);
		margin-bottom: 10px;
	}
	.required { color: #7bf1a8; }
	.optional { color: color-mix(in oklab, var(--wiz-muted2) 80%, transparent); font-size: 10px; }

	.big-textarea, .text-input {
		width: 100%;
		background: var(--wiz-input-bg);
		border: 1.5px solid var(--wiz-input-border);
		border-radius: 12px;
		padding: 14px 16px;
		font-family: var(--font-display);
		font-size: 15px;
		color: var(--wiz-text);
		outline: none;
		resize: none;
		transition: border-color 0.15s;
		box-sizing: border-box;
	}
	.big-textarea:focus, .text-input:focus {
		border-color: rgba(123,241,168,0.35);
	}
	::placeholder { color: color-mix(in oklab, var(--wiz-muted2) 70%, transparent); }

	.field-hint {
		font-family: var(--font-display);
		font-size: 12px;
		color: var(--wiz-muted2);
		margin: 8px 0 0;
	}

	/* ── Drop zone ───────────────────────────────────────────────────────── */
	.drop-zone {
		border: 1.5px dashed var(--wiz-border);
		border-radius: 16px;
		padding: 48px 32px;
		text-align: center;
		cursor: pointer;
		transition: all 0.2s;
		margin-bottom: 24px;
	}
	.drop-zone:hover, .drop-zone.dragging {
		border-color: rgba(123,241,168,0.4);
		background: rgba(123,241,168,0.03);
	}

	.hidden-input { display: none; }

	.drop-icon {
		width: 52px; height: 52px;
		border-radius: 12px;
		background: var(--wiz-chip-bg);
		display: flex; align-items: center; justify-content: center;
		margin: 0 auto 16px;
		color: var(--wiz-muted2);
	}

	.drop-text {
		font-family: var(--font-display);
		font-size: 15px;
		color: var(--wiz-muted);
		margin: 0 0 6px;
	}
	.drop-link { color: #7bf1a8; text-decoration: underline; }

	.drop-sub {
		font-family: var(--font-display);
		font-size: 11px;
		color: var(--wiz-muted2);
		margin: 0;
	}

	/* ── Thumbnails ──────────────────────────────────────────────────────── */
	.thumb-grid {
		display: flex;
		flex-wrap: wrap;
		gap: 12px;
	}

	.thumb-item {
		position: relative;
		width: 88px; height: 88px;
		border-radius: 10px;
		overflow: hidden;
		border: 1.5px solid var(--wiz-border);
	}

	.thumb-img {
		width: 100%; height: 100%;
		object-fit: cover;
	}

	.thumb-remove {
		position: absolute; top: 4px; right: 4px;
		width: 20px; height: 20px;
		border-radius: 50%;
		background: rgba(0,0,0,0.8);
		border: none; cursor: pointer;
		display: flex; align-items: center; justify-content: center;
		color: rgba(255,255,255,0.8);
	}

	.thumb-idx {
		position: absolute; bottom: 4px; left: 6px;
		font-family: var(--font-display);
		font-size: 10px;
		color: rgba(255,255,255,0.5);
		background: rgba(0,0,0,0.6);
		padding: 1px 5px;
		border-radius: 4px;
	}

	.skip-hint {
		font-family: var(--font-display);
		font-size: 13px;
		color: rgba(255,255,255,0.25);
		text-align: center;
		margin-top: 16px;
	}

	/* ── Style cards ─────────────────────────────────────────────────────── */
	.style-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 12px;
	}

	.style-card {
		background: rgba(255,255,255,0.03);
		border: 1.5px solid rgba(255,255,255,0.07);
		border-radius: 14px;
		padding: 20px;
		text-align: left;
		cursor: pointer;
		transition: all 0.15s;
	}
	.style-card:hover {
		border-color: rgba(255,255,255,0.15);
	}
	.style-card.selected {
		border-color: rgba(123,241,168,0.4);
		background: rgba(123,241,168,0.04);
	}

	.style-dot {
		width: 10px; height: 10px;
		border-radius: 50%;
		border: 1.5px solid rgba(255,255,255,0.2);
		margin-bottom: 14px;
		transition: all 0.15s;
	}
	.style-dot.lit {
		border-color: #7bf1a8;
		background: #7bf1a8;
		box-shadow: 0 0 8px rgba(123,241,168,0.5);
	}

	.style-name {
		font-family: var(--font-display), var(--font-sans), system-ui, -apple-system, sans-serif;
		font-size: 17px;
		font-weight: 700;
		color: #fff;
		margin: 0 0 6px;
	}

	.style-desc {
		font-family: var(--font-display);
		font-size: 13px;
		color: rgba(255,255,255,0.35);
		margin: 0;
		line-height: 1.5;
	}

	/* ── Count pills ─────────────────────────────────────────────────────── */
	.count-pills {
		display: flex;
		gap: 8px;
	}

	.count-pill {
		padding: 8px 20px;
		border-radius: 100px;
		border: 1.5px solid rgba(255,255,255,0.08);
		background: transparent;
		font-family: var(--font-display);
		font-size: 13px;
		color: rgba(255,255,255,0.4);
		cursor: pointer;
		transition: all 0.15s;
	}
	.count-pill:hover { border-color: rgba(255,255,255,0.2); color: rgba(255,255,255,0.7); }
	.count-pill.active {
		border-color: #7bf1a8;
		color: #7bf1a8;
		background: rgba(123,241,168,0.08);
	}

	/* ── Brand row ───────────────────────────────────────────────────────── */
	.brand-row {
		display: flex;
		gap: 16px;
		align-items: flex-end;
	}

	.color-row {
		display: flex;
		align-items: center;
		gap: 10px;
	}

	.color-swatch {
		width: 44px; height: 44px;
		border-radius: 10px;
		border: 1.5px solid rgba(255,255,255,0.1);
		cursor: pointer;
		padding: 2px;
		background: transparent;
	}

	.color-hex {
		font-family: var(--font-display);
		font-size: 13px;
		color: rgba(255,255,255,0.4);
	}

	/* ── Generate view ───────────────────────────────────────────────────── */
	.gen-view {
		width: 100%;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 24px;
	}

	.gen-loading {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 16px;
		padding: 80px 32px;
		text-align: center;
	}

	.gen-spinner {
		width: 72px; height: 72px;
		border-radius: 20px;
		background: rgba(123,241,168,0.08);
		border: 1.5px solid rgba(123,241,168,0.2);
		display: flex; align-items: center; justify-content: center;
		color: #7bf1a8;
		animation: pulse 1.8s ease-in-out infinite;
	}

	@keyframes pulse {
		0%, 100% { opacity: 1; transform: scale(1); }
		50% { opacity: 0.6; transform: scale(0.96); }
	}

	.gen-title {
		font-family: var(--font-display), var(--font-sans), system-ui, -apple-system, sans-serif;
		font-size: 32px;
		font-weight: 900;
		color: #fff;
		margin: 0;
	}

	.gen-sub {
		font-family: var(--font-display);
		font-size: 15px;
		color: rgba(255,255,255,0.35);
		margin: 0;
	}

	.gen-dots {
		display: flex;
		gap: 6px;
	}
	.gen-dots span {
		width: 6px; height: 6px;
		border-radius: 50%;
		background: #7bf1a8;
		animation: dot 1.4s ease-in-out infinite;
	}
	.gen-dots span:nth-child(2) { animation-delay: 0.2s; }
	.gen-dots span:nth-child(3) { animation-delay: 0.4s; }
	@keyframes dot {
		0%, 80%, 100% { opacity: 0.2; transform: scale(0.8); }
		40% { opacity: 1; transform: scale(1); }
	}

	.gen-error {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 12px;
		padding: 60px 32px;
		color: #f87171;
		text-align: center;
	}
	.gen-error h3 {
		font-family: var(--font-display), var(--font-sans), system-ui, -apple-system, sans-serif;
		font-size: 22px;
		font-weight: 700;
		color: #fff;
		margin: 0;
	}
	.gen-error p {
		font-family: var(--font-display);
		font-size: 14px;
		color: rgba(255,255,255,0.4);
		margin: 0;
	}

	/* ── Preview area ────────────────────────────────────────────────────── */
	.preview-header {
		width: 100%;
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0 8px;
		flex-wrap: wrap;
		gap: 12px;
	}

	.preview-meta { }
	.preview-title {
		font-family: var(--font-display), var(--font-sans), system-ui, -apple-system, sans-serif;
		font-size: 22px;
		font-weight: 700;
		color: #fff;
		margin: 0 0 4px;
	}
	.preview-count {
		font-family: var(--font-display);
		font-size: 11px;
		color: rgba(255,255,255,0.25);
		text-transform: uppercase;
		letter-spacing: 0.08em;
		margin: 0;
	}

	.preview-actions {
		display: flex;
		gap: 8px;
	}

	.btn-secondary, .btn-video {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 8px 16px;
		border-radius: 10px;
		font-family: var(--font-display);
		font-size: 13px;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.15s;
		border: none;
	}

	.btn-secondary {
		background: rgba(255,255,255,0.06);
		color: rgba(255,255,255,0.6);
		border: 1px solid rgba(255,255,255,0.08);
	}
	.btn-secondary:hover { background: rgba(255,255,255,0.1); color: #fff; }
	.btn-secondary:disabled { opacity: 0.4; cursor: not-allowed; }

	.btn-video {
		background: rgba(123,241,168,0.1);
		color: #7bf1a8;
		border: 1px solid rgba(123,241,168,0.25);
	}
	.btn-video:hover { background: rgba(123,241,168,0.18); }
	.btn-video:disabled { opacity: 0.4; cursor: not-allowed; }

	/* ── Filmstrip ───────────────────────────────────────────────────────── */
	.filmstrip {
		width: 100%;
		display: flex;
		gap: 10px;
		overflow-x: auto;
		padding: 8px 4px;
		scrollbar-width: thin;
		scrollbar-color: rgba(255,255,255,0.1) transparent;
	}

	.film-item {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 6px;
		cursor: pointer;
		flex-shrink: 0;
		opacity: 0.5;
		transition: opacity 0.15s;
		border-radius: 6px;
		border: 2px solid transparent;
	}
	.film-item:hover { opacity: 0.75; }
	.film-item.active {
		opacity: 1;
		border-color: #7bf1a8;
	}

	.film-num {
		font-family: var(--font-display);
		font-size: 10px;
		color: rgba(255,255,255,0.3);
	}

	/* ── Main preview ────────────────────────────────────────────────────── */
	.main-preview {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 16px;
	}

	.preview-nav {
		display: flex;
		align-items: center;
		gap: 16px;
	}

	.nav-arrow {
		width: 36px; height: 36px;
		border-radius: 50%;
		border: 1.5px solid rgba(255,255,255,0.1);
		background: transparent;
		color: rgba(255,255,255,0.4);
		cursor: pointer;
		display: flex; align-items: center; justify-content: center;
		transition: all 0.15s;
	}
	.nav-arrow:hover:not(:disabled) {
		border-color: rgba(255,255,255,0.3);
		color: #fff;
	}
	.nav-arrow:disabled { opacity: 0.25; cursor: not-allowed; }

	.nav-count {
		font-family: var(--font-display);
		font-size: 12px;
		color: rgba(255,255,255,0.3);
	}

	.saving-note {
		display: flex;
		align-items: center;
		gap: 6px;
		font-family: var(--font-display);
		font-size: 11px;
		color: rgba(255,255,255,0.3);
	}
	.saving-note.saved { color: rgba(123,241,168,0.6); }
	.edit-link { color: #7bf1a8; text-decoration: underline; }

	/* ── Footer nav ──────────────────────────────────────────────────────── */
	.wizard-footer {
		position: fixed;
		bottom: 0;
		left: 224px; /* sidebar width */
		right: 0;
		padding: 20px 32px;
		background: rgba(8,8,8,0.95);
		backdrop-filter: blur(12px);
		border-top: 1px solid rgba(255,255,255,0.05);
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.btn-ghost, .btn-primary {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 10px 20px;
		border-radius: 10px;
		font-family: var(--font-display);
		font-size: 14px;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.15s;
		border: none;
	}

	.btn-ghost {
		background: transparent;
		color: rgba(255,255,255,0.35);
		border: 1.5px solid rgba(255,255,255,0.08);
	}
	.btn-ghost:hover:not(:disabled) { color: rgba(255,255,255,0.7); }
	.btn-ghost:disabled { opacity: 0.2; cursor: not-allowed; }

	.btn-primary {
		background: #7bf1a8;
		color: #0a0a0a;
		font-weight: 600;
	}
	.btn-primary:hover:not(:disabled) {
		background: #f0ff6e;
		transform: translateY(-1px);
	}
	.btn-primary:disabled { opacity: 0.35; cursor: not-allowed; }

	.btn-generate { font-size: 14px; }

	:global(.spin) {
		animation: spin 1s linear infinite;
	}
	@keyframes spin { to { transform: rotate(360deg); } }
</style>
