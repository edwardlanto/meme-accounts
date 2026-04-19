<script lang="ts">
	import { supabase } from '$lib/supabase';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { toPng } from 'html-to-image';
	import NewsTemplate from '$lib/components/templates/NewsTemplate.svelte';
	import {
		Newspaper, Sparkles, RefreshCw, Download, Loader, AlertCircle,
		Image, Palette, Type, ChevronDown, Search, FlaskConical, Wifi
	} from 'lucide-svelte';

	// ── Mock data ─────────────────────────────────────────────────────────
	const MOCK_NEWS = [
		{
			uuid: "8d906cbc-8d65-43d0-93ff-f67842145d66",
			title: "The top 5 startup buyers in Silicon Valley",
			description: "Silicon Valley giants made up 33% of total startup acquisition deals since 2000, an analysis found",
			snippet: "Silicon Valley is known for nurturing some of the world's most successful tech startups and companies, making it not so surprising that it's also home to so...",
			url: "https://qz.com/google-apple-meta-startup-acquisitions-silicon-valley-1851681629",
			image_url: "https://i.kinja-img.com/image/upload/c_fill,h_675,pg_1,q_80,w_1200/0c461b0f4587d274f2cc0a13ac4c1e1a.jpg",
			source: "qz.com",
			categories: ["general", "business", "tech"],
		},
		{
			uuid: "2a304e6c-774a-4820-8128-0e19d6121934",
			title: "Mental-Health Startup Cerebral Investigated by FTC",
			description: "Regulators focus on whether online provider engaged in deceptive or unfair marketing practices",
			snippet: "Mental health startup Cerebral was subpoenaed last month by federal prosecutors as part of an investigation into possible violations of the Controlled Substance...",
			url: "https://www.wsj.com/articles/ftc-launches-probe-of-cerebrals-business-practices-11655241983",
			image_url: "https://images.wsj.net/im-563603/social",
			source: "online.wsj.com",
			categories: ["business"],
		},
		{
			uuid: "b619002a-76ab-4223-8703-648ee7a17175",
			title: "Top Startup Crowdfunding Campaigns To Invest In",
			description: "If you're looking for startups to invest in, here's Benzinga's list of the top startup investments for August 2022.",
			snippet: "If you're looking for startups to invest in, here's Benzinga's list of the top startup investments for August 2022. Gryphon is recognized as one of th...",
			url: "https://www.benzinga.com/markets/22/08/28639261/top-startup-crowdfunding-campaigns-to-invest-in",
			image_url: "https://cdn.benzinga.com/files/images/story/2022/08/25/shutterstock_1532955209.jpg?width=1200&height=800&fit=crop",
			source: "benzinga.com",
			categories: ["business"],
		},
	] as const;

	// ── State ──────────────────────────────────────────────────────────────
	let userId = $state('');
	let useTestData = $state(true); // default to mock data

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
			if (useTestData) {
				// ── Mock mode: pick a random article from test data ──────────
				await new Promise(r => setTimeout(r, 400)); // fake loading feel
				const pool = search
					? MOCK_NEWS.filter(a =>
						a.title.toLowerCase().includes(search.toLowerCase()) ||
						a.description.toLowerCase().includes(search.toLowerCase())
					  )
					: MOCK_NEWS;
				const article = pool[Math.floor(Math.random() * pool.length)] ?? MOCK_NEWS[0];

				overlayText   = article.title;
				source        = sourceLabels[category] ?? article.source ?? 'News';
				articleUrl    = article.url;
				articleTitle  = article.title;

				// Use the article's real image as background
				if (article.image_url) backgroundImage = article.image_url;

			} else {
				// ── Live mode: call the real News API ────────────────────────
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

				overlayText  = data.text ?? overlayText;
				source       = sourceLabels[category] ?? data.source ?? 'News';
				articleUrl   = data.url ?? '';
				articleTitle = data.title ?? '';

				if (data.imageUrl) backgroundImage = data.imageUrl;
				if (data.title && !data.imageUrl) generateBackground(data.title);
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

			<!-- Data source toggle -->
			<div class="flex items-center justify-between p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] mb-1">
				<div class="flex items-center gap-2">
					{#if useTestData}
						<FlaskConical size={12} class="text-amber-400" />
						<span class="text-xs font-mono text-amber-400">Test data</span>
					{:else}
						<Wifi size={12} class="text-emerald-400" />
						<span class="text-xs font-mono text-emerald-400">Live API</span>
					{/if}
				</div>
				<!-- Toggle switch -->
				<button
					onclick={() => useTestData = !useTestData}
					class="relative w-10 h-5 rounded-full transition-colors duration-200 focus:outline-none flex-shrink-0
						{useTestData ? 'bg-amber-500/30' : 'bg-emerald-500/40'}"
					title="{useTestData ? 'Switch to Live API' : 'Switch to Test Data'}"
				>
					<span class="absolute top-0.5 left-0.5 w-4 h-4 rounded-full shadow transition-transform duration-200
						{useTestData ? 'translate-x-0 bg-amber-400' : 'translate-x-5 bg-emerald-400'}">
					</span>
				</button>
			</div>

			<!-- Fetch button -->
			<button onclick={fetchNews} disabled={fetchingNews}
				class="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold font-body text-white bg-gradient-to-r from-violet-600 to-cyan-500 hover:shadow-[0_0_20px_rgba(139,92,246,0.3)] transition-all disabled:opacity-50">
				{#if fetchingNews}
					<Loader size={13} class="animate-spin" /> {useTestData ? 'Loading mock...' : 'Fetching + Rewriting...'}
				{:else}
					{#if useTestData}
						<FlaskConical size={13} /> Load Test Article
					{:else}
						<Newspaper size={13} /> Fetch Live News
					{/if}
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
