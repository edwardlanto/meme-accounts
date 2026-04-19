<script lang="ts">
	import { supabase } from '$lib/supabase';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { toPng } from 'html-to-image';
	import NewsTemplate from '$lib/components/templates/NewsTemplate.svelte';
	import {
		Newspaper, Sparkles, RefreshCw, Download, Loader, AlertCircle,
		Image, Palette, Type, ChevronDown, Search
	} from 'lucide-svelte';

	// ── State ──────────────────────────────────────────────────────────────
	let userId = $state('');

	// News controls
	let search = $state('');
	let category = $state('business');
	let fetchingNews = $state(false);
	let newsError = $state('');

	// Post data
	let overlayText = $state('YOUR HEADLINE WILL APPEAR HERE ONCE YOU FETCH A NEWS STORY');
	let source = $state('Markets');
	let articleUrl = $state('');
	let articleTitle = $state('');

	// Images
	let backgroundImage = $state('');
	let circleImage = $state('');
	let generatingBg = $state(false);
	let generatingCircle = $state(false);
	let bgError = $state('');

	// Style
	let highlightColor = $state('#F5A623');
	let textColor = $state('#FFFFFF');

	// Export
	let exporting = $state(false);
	let exportRef: HTMLElement | null = $state(null);

	// ── Auth ──────────────────────────────────────────────────────────────
	onMount(async () => {
		const { data: { user } } = await supabase.auth.getUser();
		if (!user) { goto('/login'); return; }
		userId = user.id;
	});

	// ── Categories ────────────────────────────────────────────────────────
	const categories = [
		{ id: 'business', label: 'Business' },
		{ id: 'tech', label: 'Tech' },
		{ id: 'finance', label: 'Finance' },
		{ id: 'politics', label: 'Politics' },
		{ id: 'health', label: 'Health' },
		{ id: 'science', label: 'Science' },
		{ id: 'sports', label: 'Sports' },
		{ id: 'entertainment', label: 'Entertainment' },
		{ id: 'general', label: 'General' },
	];

	const sourceLabels: Record<string, string> = {
		business: 'Markets',
		tech: 'Tech',
		finance: 'Finance',
		politics: 'Politics',
		health: 'Health',
		science: 'Science',
		sports: 'Sports',
		entertainment: 'Culture',
		general: 'News',
	};

	// ── Fetch news ────────────────────────────────────────────────────────
	async function fetchNews() {
		fetchingNews = true;
		newsError = '';

		try {
			const res = await fetch('/api/news', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					search: search || undefined,
					categories: category,
					autoHighlight: true,
					pick: 'first',
				}),
			});

			const data = await res.json();
			if (!res.ok) throw new Error(data.error ?? 'Failed to fetch news');

			overlayText = data.text ?? overlayText;
			source = sourceLabels[category] ?? data.source ?? 'News';
			articleUrl = data.url ?? '';
			articleTitle = data.title ?? '';

			// Auto-generate background image from article context
			if (data.title) {
				generateBackground(data.title);
			}
		} catch (e: any) {
			newsError = e.message;
		}

		fetchingNews = false;
	}

	// ── Generate background image ─────────────────────────────────────────
	async function generateBackground(context?: string) {
		generatingBg = true;
		bgError = '';

		try {
			const prompt = context ?? articleTitle ?? overlayText.replace(/\[\[|\]\]/g, '');
			const res = await fetch('/api/vertex', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ prompt, aspect: '3:4', context }),
			});

			const data = await res.json();
			if (data.dataUrl) {
				backgroundImage = data.dataUrl;
			} else if (data.demo) {
				bgError = data.message ?? 'Image generation not configured. Add Google credentials to enable it.';
			} else {
				bgError = data.error ?? 'Image generation failed';
			}
		} catch (e: any) {
			bgError = e.message;
		}

		generatingBg = false;
	}

	// ── Generate circle image ─────────────────────────────────────────────
	async function generateCircleImage() {
		generatingCircle = true;

		try {
			const prompt = `A single striking visual that represents: ${articleTitle || overlayText.replace(/\[\[|\]\]/g, '')}. Square composition, centered subject, bold colors.`;
			const res = await fetch('/api/vertex', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ prompt, aspect: '1:1' }),
			});

			const data = await res.json();
			if (data.dataUrl) circleImage = data.dataUrl;
		} catch { /* ignore */ }

		generatingCircle = false;
	}

	// ── Handle image uploads ──────────────────────────────────────────────
	function handleBgUpload(e: Event) {
		const file = (e.target as HTMLInputElement).files?.[0];
		if (!file) return;
		const reader = new FileReader();
		reader.onload = () => { backgroundImage = reader.result as string; };
		reader.readAsDataURL(file);
	}

	function handleCircleUpload(e: Event) {
		const file = (e.target as HTMLInputElement).files?.[0];
		if (!file) return;
		const reader = new FileReader();
		reader.onload = () => { circleImage = reader.result as string; };
		reader.readAsDataURL(file);
	}

	// ── Export to PNG ─────────────────────────────────────────────────────
	async function exportPng() {
		if (!exportRef) return;
		exporting = true;

		try {
			// Render at full 1080x1350 resolution
			const dataUrl = await toPng(exportRef, {
				width: 1080,
				height: 1350,
				pixelRatio: 1,
				style: { transform: 'scale(1)', transformOrigin: 'top left' },
			});

			const a = document.createElement('a');
			a.href = dataUrl;
			a.download = `carousel-studio-${Date.now()}.png`;
			a.click();
		} catch (e: any) {
			console.error('Export failed:', e);
			alert('Export failed: ' + e.message);
		}

		exporting = false;
	}

	// Preview scale — fit within container
	const PREVIEW_WIDTH = 340;
	const previewScale = $derived(PREVIEW_WIDTH / 1080);
</script>

<div class="flex h-full overflow-hidden">

	<!-- ── Left panel: controls ──────────────────────────────────────────── -->
	<div class="w-80 flex-shrink-0 border-r border-white/[0.05] bg-[#0d0d0d] flex flex-col overflow-y-auto">
		<div class="px-5 py-4 border-b border-white/[0.04]">
			<h1 class="font-display font-bold text-base text-white">News Studio</h1>
			<p class="font-body text-xs text-white/40 mt-0.5">AI-powered Instagram news posts</p>
		</div>

		<div class="flex flex-col gap-1 p-4">

			<!-- Category -->
			<div class="mb-1">
				<label class="text-[10px] font-mono text-white/30 uppercase tracking-wider block mb-2">Category</label>
				<div class="relative">
					<select bind:value={category}
						class="w-full appearance-none bg-white/[0.04] border border-white/[0.08] rounded-xl py-2.5 pl-3 pr-8 text-sm font-body text-white focus:outline-none focus:border-violet-500/50 transition-colors">
						{#each categories as cat}
							<option value={cat.id}>{cat.label}</option>
						{/each}
					</select>
					<ChevronDown size={13} class="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none" />
				</div>
			</div>

			<!-- Search -->
			<div class="mb-3">
				<label class="text-[10px] font-mono text-white/30 uppercase tracking-wider block mb-2">Search (optional)</label>
				<div class="relative">
					<Search size={13} class="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
					<input bind:value={search} placeholder="e.g. interest rates, Tesla..."
						class="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl py-2.5 pl-8 pr-3 text-sm font-body text-white placeholder-white/20 focus:outline-none focus:border-violet-500/50 transition-colors" />
				</div>
			</div>

			<!-- Fetch button -->
			<button onclick={fetchNews} disabled={fetchingNews}
				class="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold font-body text-white bg-gradient-to-r from-violet-600 to-cyan-500 hover:shadow-[0_0_20px_rgba(139,92,246,0.3)] transition-all disabled:opacity-50">
				{#if fetchingNews}
					<Loader size={13} class="animate-spin" /> Fetching + Rewriting...
				{:else}
					<Newspaper size={13} /> Fetch News
				{/if}
			</button>

			{#if newsError}
				<div class="flex items-start gap-2 p-2.5 rounded-xl bg-red-500/10 border border-red-500/20 mt-1">
					<AlertCircle size={12} class="text-red-400 shrink-0 mt-0.5" />
					<p class="text-[11px] font-body text-red-400 leading-relaxed">{newsError}</p>
				</div>
			{/if}

			<!-- Divider -->
			<div class="border-t border-white/[0.05] my-3"></div>

			<!-- Overlay text -->
			<div>
				<label class="text-[10px] font-mono text-white/30 uppercase tracking-wider block mb-2">
					<Type size={9} class="inline mr-1" />Overlay Text
				</label>
				<p class="text-[10px] font-body text-white/20 mb-1.5">Use <code class="text-violet-400 bg-violet-500/10 px-1 rounded">[[WORD]]</code> to highlight phrases</p>
				<textarea bind:value={overlayText} rows={5}
					class="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl py-2.5 px-3 text-sm font-body text-white placeholder-white/20 focus:outline-none focus:border-violet-500/50 transition-colors resize-none leading-relaxed">
				</textarea>
			</div>

			<!-- Source label -->
			<div>
				<label class="text-[10px] font-mono text-white/30 uppercase tracking-wider block mb-2">Source Label</label>
				<input bind:value={source} placeholder="Markets"
					class="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl py-2.5 px-3 text-sm font-body text-white placeholder-white/20 focus:outline-none focus:border-violet-500/50 transition-colors" />
			</div>

			<!-- Divider -->
			<div class="border-t border-white/[0.05] my-3"></div>

			<!-- Highlight color -->
			<div>
				<label class="text-[10px] font-mono text-white/30 uppercase tracking-wider block mb-2">
					<Palette size={9} class="inline mr-1" />Highlight Color
				</label>
				<div class="flex items-center gap-2">
					<!-- Presets -->
					{#each ['#F5A623', '#08EBFF', '#FF3B5C', '#A855F7', '#10B981', '#FFFFFF'] as color}
						<button onclick={() => highlightColor = color}
							class="w-7 h-7 rounded-lg border-2 transition-all flex-shrink-0 {highlightColor === color ? 'border-white scale-110' : 'border-transparent hover:scale-105'}"
							style="background: {color};">
						</button>
					{/each}
					<input type="color" bind:value={highlightColor}
						class="w-8 h-7 rounded-lg cursor-pointer bg-transparent border border-white/[0.08] flex-shrink-0" />
				</div>
			</div>

			<!-- Text color -->
			<div>
				<label class="text-[10px] font-mono text-white/30 uppercase tracking-wider block mb-2">Text Color</label>
				<div class="flex items-center gap-2">
					{#each ['#FFFFFF', '#F5A623', '#08EBFF', '#000000'] as color}
						<button onclick={() => textColor = color}
							class="w-7 h-7 rounded-lg border-2 transition-all {textColor === color ? 'border-violet-400 scale-110' : 'border-white/10 hover:scale-105'}"
							style="background: {color};">
						</button>
					{/each}
				</div>
			</div>

			<!-- Divider -->
			<div class="border-t border-white/[0.05] my-3"></div>

			<!-- Background image -->
			<div>
				<label class="text-[10px] font-mono text-white/30 uppercase tracking-wider block mb-2">
					<Image size={9} class="inline mr-1" />Background Image
				</label>
				<div class="flex flex-col gap-2">
					<button onclick={() => generateBackground()}
						disabled={generatingBg}
						class="flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold font-body text-violet-300 bg-violet-500/10 hover:bg-violet-500/20 border border-violet-500/15 transition-all disabled:opacity-50">
						{#if generatingBg}
							<Loader size={11} class="animate-spin" /> Generating...
						{:else}
							<Sparkles size={11} /> Generate with AI
						{/if}
					</button>
					<label class="flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold font-body text-white/40 glass glass-hover border border-white/[0.06] transition-all cursor-pointer">
						<Image size={11} /> Upload image
						<input type="file" accept="image/*" class="hidden" onchange={handleBgUpload} />
					</label>
					{#if bgError}
						<p class="text-[10px] font-body text-amber-400/70 leading-relaxed">{bgError}</p>
					{/if}
				</div>
			</div>

			<!-- Circle image -->
			<div>
				<label class="text-[10px] font-mono text-white/30 uppercase tracking-wider block mb-2">Circle Badge (optional)</label>
				<div class="flex flex-col gap-2">
					<button onclick={generateCircleImage} disabled={generatingCircle}
						class="flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold font-body text-cyan-300 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/15 transition-all disabled:opacity-50">
						{#if generatingCircle}
							<Loader size={11} class="animate-spin" /> Generating...
						{:else}
							<Sparkles size={11} /> Generate with AI
						{/if}
					</button>
					<label class="flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold font-body text-white/40 glass glass-hover border border-white/[0.06] transition-all cursor-pointer">
						<Image size={11} /> Upload circle image
						<input type="file" accept="image/*" class="hidden" onchange={handleCircleUpload} />
					</label>
					{#if circleImage}
						<button onclick={() => circleImage = ''}
							class="text-[10px] font-mono text-red-400/60 hover:text-red-400 transition-colors text-left">
							✕ Remove circle
						</button>
					{/if}
				</div>
			</div>

			<!-- Divider -->
			<div class="border-t border-white/[0.05] my-3"></div>

			<!-- Export -->
			<button onclick={exportPng} disabled={exporting}
				class="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold font-body text-white bg-gradient-to-r from-violet-600 to-cyan-500 hover:shadow-[0_0_20px_rgba(139,92,246,0.3)] transition-all disabled:opacity-50">
				{#if exporting}
					<Loader size={13} class="animate-spin" /> Exporting...
				{:else}
					<Download size={13} /> Export 1080×1350 PNG
				{/if}
			</button>

			{#if articleUrl}
				<a href={articleUrl} target="_blank" rel="noopener noreferrer"
					class="text-center text-[10px] font-body text-violet-400/60 hover:text-violet-400 transition-colors underline underline-offset-2">
					View source article ↗
				</a>
			{/if}
		</div>
	</div>

	<!-- ── Right panel: preview ──────────────────────────────────────────── -->
	<div class="flex-1 flex flex-col items-center justify-center bg-[#080808] overflow-hidden p-8">
		<p class="font-mono text-[10px] text-white/20 mb-5 uppercase tracking-widest">Preview — 1080 × 1350</p>

		<div style="width: {PREVIEW_WIDTH}px; height: {1350 * previewScale}px;">
			<NewsTemplate
				bind:exportRef
				backgroundImage={backgroundImage}
				circleImage={circleImage}
				text={overlayText}
				source={source}
				highlightColor={highlightColor}
				textColor={textColor}
				scale={previewScale}
			/>
		</div>

		{#if !backgroundImage}
			<p class="font-body text-xs text-white/20 mt-5 text-center max-w-xs">
				Fetch a news article or upload a background image to see your post
			</p>
		{/if}
	</div>

</div>

<style>
	select option {
		background: #1a1a1a;
		color: #f8f8f8;
	}
</style>
