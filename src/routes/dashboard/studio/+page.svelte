<script lang="ts">
	import { supabase } from '$lib/supabase';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { toPng } from 'html-to-image';
	import NewsTemplate from '$lib/components/templates/NewsTemplate.svelte';
	import { AVAILABLE_PATTERNS } from '$lib/highlight';
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
	let slideCount = $state(3); // 1–10
	let fetchingNews = $state(false);
	let generatingVariants = $state(false);
	let newsError = $state('');

	// Multi-slide state
	let slides = $state<string[]>(['YOUR HEADLINE WILL APPEAR HERE ONCE YOU FETCH A NEWS STORY']);
	let activeSlide = $state(0);
	let articleSnippet = $state(''); // full article text for variants call

	// Convenience derived for current active slide text
	const overlayText = $derived(slides[activeSlide] ?? '');
	function setActiveSlideText(val: string) {
		slides = slides.map((s, i) => i === activeSlide ? val : s);
	}

	// Post data
	let source = $state('Markets');
	let articleUrl = $state('');
	let articleTitle = $state('');

	// Images — one background per slide
	let backgroundImages = $state<(string)[]>([]);
	let generatingImages = $state<boolean[]>([]); // per-slide loading state
	let showCircle = $state(true);       // toggle — default ON
	let circleImage = $state('');
	let generatingCircle = $state(false);
	let bgError = $state('');

	// Convenience: active slide's background
	const backgroundImage = $derived(backgroundImages[activeSlide] ?? '');
	function setSlideImage(i: number, url: string) {
		backgroundImages = backgroundImages.map((img, idx) => idx === i ? url : img);
		generatingImages = generatingImages.map((v, idx) => idx === i ? false : v);
	}

	// Style
	let highlightColor = $state('#F5A623');
	let textColor = $state('#FFFFFF');

	// Canvas editing — circle position + size (template coordinates)
	let circleX    = $state(772);
	let circleY    = $state(52);
	let circleSize = $state(256); // diameter in template px (128–512)

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
		activeSlide = 0;
		// Reset circle position + size to defaults
		circleX    = 772;
		circleY    = 52;
		circleSize = 256;

		try {
			let hookText = '';
			let rawText  = '';
			let articleImageUrl = ''; // article's own image (used as seed for slide 0)

			if (useTestData) {
				// ── Mock mode ────────────────────────────────────────────────
				await new Promise(r => setTimeout(r, 400));
				const pool = search
					? MOCK_NEWS.filter(a =>
						a.title.toLowerCase().includes(search.toLowerCase()) ||
						a.description.toLowerCase().includes(search.toLowerCase())
					  )
					: MOCK_NEWS;
				const article = pool[Math.floor(Math.random() * pool.length)] ?? MOCK_NEWS[0];

				hookText        = article.title;
				rawText         = `${article.title}. ${article.description}. ${article.snippet}`;
				source          = sourceLabels[category] ?? article.source ?? 'News';
				articleUrl      = article.url;
				articleTitle    = article.title;
				articleImageUrl = article.image_url;

			} else {
				// ── Live mode ────────────────────────────────────────────────
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

				hookText        = data.text ?? '';
				rawText         = data.description ?? data.title ?? '';
				source          = sourceLabels[category] ?? data.source ?? 'News';
				articleUrl      = data.url ?? '';
				articleTitle    = data.title ?? '';
				articleImageUrl = data.imageUrl ?? '';
			}

			articleSnippet = rawText;

			// Show slide 1 immediately
			slides = [hookText];
			backgroundImages = [articleImageUrl]; // slide 0 gets article image right away
			generatingImages = [false];

			// Generate supporting slide variants first (so we know all slide texts before imaging)
			if (slideCount > 1) {
				fetchingNews = false;
				generatingVariants = true;
				await generateVariants(hookText, rawText);
				generatingVariants = false;
			}

			// Generate unique Vertex image per slide in parallel
			// Slide 0: keep article image if available; otherwise generate from title
			// Slides 1+: generate from their own text copy
			const imagePromise = generateAllSlideImages(articleImageUrl);

			// Auto-generate circle badge if toggle is on
			if (showCircle) generateCircleImage();

			await imagePromise;

		} catch (e: any) {
			newsError = e.message;
		}

		fetchingNews = false;
		generatingVariants = false;
	}

	// ── Generate supporting slide variants ────────────────────────────────
	async function generateVariants(hookText: string, rawText: string) {
		try {
			const res = await fetch('/api/news/variants', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					count: slideCount,
					title: articleTitle,
					text: rawText || articleTitle,
					sourceUrl: articleUrl,
					autoHighlight: true,
				}),
			});
			const data = await res.json();
			if (!res.ok) throw new Error(data.error ?? 'Variant generation failed');

			// Use hook as slide 1 if API returned generic; otherwise use all returned variants
			const variants: string[] = data.variants ?? [];
			if (variants.length > 0) {
				// Replace slide 1 only if API returned something different AND hook already has content
				slides = variants.length >= slideCount
					? variants.slice(0, slideCount)
					: [...variants, ...Array(slideCount - variants.length).fill(variants[variants.length - 1])];
			}
		} catch (e: any) {
			// Don't overwrite the hook slide on variant error
			console.error('[variants]', e.message);
			newsError = `Slide variants: ${e.message}`;
		}
	}

	// ── Highlight mode — solid color OR image pattern, never both ────────
	// 'solid'   → [[WORD]] / [[#hex: WORD]] highlights
	// 'pattern' → [[pattern(name): WORD]] image-fill highlights
	let highlightMode = $state<'solid' | 'pattern'>('solid');
	let noSelectionHint = $state(false);

	/** Strip all pattern markup from text, leaving bare words */
	function stripPatterns(text: string): string {
		return text.replace(/\[\[pattern\([\w-]+\):\s*/gi, '[[');
	}

	/** Strip all solid [[...]] highlights (but keep [[pattern(...)]] intact) */
	function stripSolidHighlights(text: string): string {
		// Remove [[#hex: word]] → word
		text = text.replace(/\[\[#[0-9a-fA-F]{3,8}:\s*([^\]]+)\]\]/g, '$1');
		// Remove plain [[word]] that are NOT pattern/grad
		text = text.replace(/\[\[(?!pattern\(|grad\()([^\]]+)\]\]/g, '$1');
		return text;
	}

	function switchToSolid() {
		highlightMode = 'solid';
		setActiveSlideText(stripPatterns(overlayText));
	}

	function switchToPattern() {
		highlightMode = 'pattern';
		setActiveSlideText(stripSolidHighlights(overlayText));
	}

	/** Wrap selected text in the textarea with [[pattern(name): sel]] */
	function insertPattern(patternName: string) {
		const textarea = document.querySelector<HTMLTextAreaElement>('textarea[data-slide-text]');
		if (!textarea) return;
		const start = textarea.selectionStart;
		const end   = textarea.selectionEnd;
		const rawSel = textarea.value.slice(start, end);
		// Strip any existing markup from the selection
		const sel = rawSel.replace(/\[\[(?:pattern\([\w-]+\)|grad\([^)]+\)|#[0-9a-fA-F]{3,8}):\s*/gi, '').replace(/\]\]/g, '').trim();

		if (!sel) {
			noSelectionHint = true;
			setTimeout(() => noSelectionHint = false, 2000);
			return;
		}

		// Switch mode and strip conflicting highlights from the full text first
		highlightMode = 'pattern';
		const cleaned = stripSolidHighlights(textarea.value);
		const markup  = `[[pattern(${patternName}): ${sel}]]`;
		const newVal  = cleaned.slice(0, start) + markup + cleaned.slice(end);
		setActiveSlideText(newVal);
	}

	/** Wrap selected text in a gradient highlight */
	function insertGradient(from: string, to: string) {
		const textarea = document.querySelector<HTMLTextAreaElement>('textarea[data-slide-text]');
		if (!textarea) return;
		const start = textarea.selectionStart;
		const end   = textarea.selectionEnd;
		const sel   = textarea.value.slice(start, end).replace(/\[\[.*?:\s*/g, '').replace(/\]\]/g, '').trim();
		if (!sel) return;
		const markup = `[[grad(${from},${to}): ${sel}]]`;
		const newVal = textarea.value.slice(0, start) + markup + textarea.value.slice(end);
		setActiveSlideText(newVal);
	}

	// ── Generate background image for a single slide ─────────────────────
	async function generateBackground(slideIdx: number, promptOverride?: string) {
		// Mark this slide as generating
		generatingImages = generatingImages.map((v, i) => i === slideIdx ? true : v);
		bgError = '';

		try {
			const slideText = (slides[slideIdx] ?? '').replace(/\[\[|\]\]/g, '').trim();
			const prompt = promptOverride ?? slideText ?? articleTitle ?? 'editorial news photo';
			const res = await fetch('/api/vertex', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ prompt, aspect: '3:4', context: articleTitle }),
			});

			const data = await res.json();
			if (data.dataUrl) {
				setSlideImage(slideIdx, data.dataUrl);
			} else if (data.demo) {
				bgError = data.message ?? 'Configure Google credentials to enable AI images.';
				generatingImages = generatingImages.map((v, i) => i === slideIdx ? false : v);
			} else {
				bgError = data.error ?? 'Image generation failed';
				generatingImages = generatingImages.map((v, i) => i === slideIdx ? false : v);
			}
		} catch (e: any) {
			bgError = e.message;
			generatingImages = generatingImages.map((v, i) => i === slideIdx ? false : v);
		}
	}

	// ── Generate unique images for all slides in parallel ─────────────────
	async function generateAllSlideImages(articleImageUrl?: string) {
		// Reset image arrays to match current slide count
		backgroundImages = new Array(slides.length).fill('');
		generatingImages = new Array(slides.length).fill(true);

		// Slide 0: use article image directly if available, otherwise Vertex
		if (articleImageUrl) {
			setSlideImage(0, articleImageUrl);
		}

		// Fire all Vertex requests in parallel (skip slide 0 if we have article image)
		const promises = slides.map((slideText, i) => {
			if (i === 0 && articleImageUrl) return Promise.resolve(); // already set
			const cleanText = slideText.replace(/\[\[|\]\]/g, '').trim();
			const prompt = i === 0
				? (articleTitle || cleanText)
				: cleanText; // supporting slides use their own copy as the image prompt
			return generateBackground(i, prompt);
		});

		await Promise.all(promises);
	}

	// ── Generate circle image via Vertex ─────────────────────────────────
	async function generateCircleImage() {
		generatingCircle = true;
		try {
			const context = articleTitle || overlayText.replace(/\[\[|\]\]/g, '');
			const prompt = `Bold editorial close-up photo representing: "${context}". Square crop, single strong subject, dramatic lighting, no text.`;
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
		const idx = activeSlide;
		reader.onload = () => { setSlideImage(idx, reader.result as string); };
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

			<!-- Slide count -->
			<div class="mb-1">
				<label class="text-[10px] font-mono text-white/30 uppercase tracking-wider block mb-2">Number of slides</label>
				<div class="flex items-center gap-2">
					<button
						onclick={() => slideCount = Math.max(1, slideCount - 1)}
						class="w-8 h-8 rounded-lg bg-white/[0.04] border border-white/[0.08] text-white/50 hover:text-white hover:bg-white/[0.08] transition-all flex items-center justify-center text-base font-bold">−</button>
					<span class="flex-1 text-center text-sm font-mono text-white">{slideCount} slide{slideCount !== 1 ? 's' : ''}</span>
					<button
						onclick={() => slideCount = Math.min(10, slideCount + 1)}
						class="w-8 h-8 rounded-lg bg-white/[0.04] border border-white/[0.08] text-white/50 hover:text-white hover:bg-white/[0.08] transition-all flex items-center justify-center text-base font-bold">+</button>
				</div>
				<div class="flex gap-1 mt-2">
					{#each [1,2,3,4,5,6,8,10] as n}
						<button
							onclick={() => slideCount = n}
							class="flex-1 py-1 rounded-lg text-[10px] font-mono transition-all
								{slideCount === n ? 'bg-amber-500/20 text-amber-300 border border-amber-500/25' : 'bg-white/[0.03] text-white/25 border border-white/[0.05] hover:text-white/50'}">
							{n}
						</button>
					{/each}
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

			<!-- Slide tabs + overlay text -->
			<div>
				<div class="flex items-center justify-between mb-2">
					<label class="text-[10px] font-mono text-white/30 uppercase tracking-wider">
						<Type size={9} class="inline mr-1" />Slide Text
					</label>
					{#if generatingVariants}
						<span class="flex items-center gap-1 text-[10px] font-mono text-amber-400">
							<Loader size={9} class="animate-spin" /> Writing slides…
						</span>
					{/if}
				</div>

				<!-- Slide tabs -->
				{#if slides.length > 1}
					<div class="flex gap-1 mb-2 flex-wrap">
						{#each slides as _, i}
							<button
								onclick={() => activeSlide = i}
								class="px-2.5 py-1 rounded-lg text-[10px] font-mono transition-all
									{activeSlide === i
										? 'bg-violet-500/20 text-violet-300 border border-violet-500/25'
										: 'bg-white/[0.03] text-white/30 border border-white/[0.05] hover:text-white/50'}">
								{i === 0 ? '① Hook' : `${['②','③','④','⑤','⑥','⑦','⑧','⑨','⑩'][i-1] ?? i+1} Slide ${i+1}`}
							</button>
						{/each}
					</div>
				{/if}

				<p class="text-[10px] font-body text-white/20 mb-1.5">Use <code class="text-violet-400 bg-violet-500/10 px-1 rounded">[[WORD]]</code> to highlight phrases</p>
				<textarea
					value={overlayText}
					oninput={(e) => setActiveSlideText(e.currentTarget.value)}
					rows={4}
					data-slide-text
					class="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl py-2.5 px-3 text-sm font-body text-white placeholder-white/20 focus:outline-none focus:border-violet-500/50 transition-colors resize-none leading-relaxed"
				></textarea>

				<!-- Word count warning -->
				{#if overlayText.split(/\s+/).filter(Boolean).length > 28}
					<p class="text-[10px] font-mono text-amber-400 mt-1">
						⚠ {overlayText.split(/\s+/).filter(Boolean).length} words — keep under 28 for best results
					</p>
				{/if}
			</div>

			<!-- Source label -->
			<div>
				<label class="text-[10px] font-mono text-white/30 uppercase tracking-wider block mb-2">Source Label</label>
				<input bind:value={source} placeholder="Markets"
					class="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl py-2.5 px-3 text-sm font-body text-white placeholder-white/20 focus:outline-none focus:border-violet-500/50 transition-colors" />
			</div>

			<!-- Divider -->
			<div class="border-t border-white/[0.05] my-3"></div>

			<!-- ── Text Highlights (solid OR pattern — exclusive) ── -->
			<div>
				<label class="text-[10px] font-mono text-white/30 uppercase tracking-wider block mb-2">
					<Palette size={9} class="inline mr-1" />Text Highlights
				</label>

				<!-- Mode toggle -->
				<div class="flex rounded-xl overflow-hidden border border-white/[0.07] mb-3">
					<button
						onclick={switchToSolid}
						class="flex-1 py-1.5 text-[11px] font-mono transition-all
							{highlightMode === 'solid'
								? 'bg-violet-500/20 text-violet-300'
								: 'text-white/30 hover:text-white/50'}">
						Solid Color
					</button>
					<div class="w-px bg-white/[0.07]"></div>
					<button
						onclick={switchToPattern}
						class="flex-1 py-1.5 text-[11px] font-mono transition-all
							{highlightMode === 'pattern'
								? 'bg-amber-500/20 text-amber-300'
								: 'text-white/30 hover:text-white/50'}">
						Pattern
					</button>
				</div>

				{#if highlightMode === 'solid'}
					<!-- Solid color swatches -->
					<div class="flex items-center gap-2">
						{#each ['#F5A623', '#08EBFF', '#FF3B5C', '#A855F7', '#10B981', '#FFFFFF'] as color}
							<button onclick={() => { highlightColor = color; switchToSolid(); }}
								class="w-7 h-7 rounded-lg border-2 transition-all flex-shrink-0
									{highlightColor === color ? 'border-white scale-110' : 'border-transparent hover:scale-105'}"
								style="background: {color};">
							</button>
						{/each}
						<input type="color" bind:value={highlightColor}
							class="w-8 h-7 rounded-lg cursor-pointer bg-transparent border border-white/[0.08] flex-shrink-0" />
					</div>
					<!-- Gradient presets -->
					<div class="flex items-center gap-1.5 mt-2">
						<span class="text-[10px] font-mono text-white/25 flex-shrink-0">Gradient</span>
						{#each [['#F5A623','#FF3B5C'],['#08EBFF','#A855F7'],['#10B981','#08EBFF'],['#FFFFFF','#F5A623']] as [from, to]}
							<button onclick={() => insertGradient(from, to)}
								class="h-5 w-9 rounded border border-white/10 hover:scale-105 transition-all flex-shrink-0"
								style="background: linear-gradient(90deg, {from}, {to});"
								title="Select text then click">
							</button>
						{/each}
					</div>
					<p class="text-[10px] font-body text-white/15 mt-1.5">
						Use <code class="text-violet-400/50">[[WORD]]</code> in the text field above
					</p>

				{:else}
					<!-- Pattern image fills -->
					<!-- "Select text first" hint -->
					{#if noSelectionHint}
						<div class="flex items-center gap-1.5 p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 mb-2">
							<span class="text-[11px] font-mono text-amber-400">← Select text in the field first</span>
						</div>
					{/if}

					<div class="grid grid-cols-2 gap-2">
						{#each AVAILABLE_PATTERNS as pat}
							<button onclick={() => insertPattern(pat.name)}
								class="flex flex-col items-center gap-1.5 p-2 rounded-xl border transition-all overflow-hidden group
									bg-white/[0.02] border-white/[0.07] hover:border-white/25 hover:bg-white/[0.05]">
								<!-- Pattern image preview with text clipped to it -->
								<div class="w-full h-10 rounded-lg overflow-hidden relative">
									<img src={pat.url} alt={pat.label} class="absolute inset-0 w-full h-full object-cover" />
									<div class="absolute inset-0 flex items-center justify-center">
										<span style="
											background-image: url('{pat.url}');
											background-size: cover;
											background-position: center;
											-webkit-background-clip: text;
											-webkit-text-fill-color: transparent;
											background-clip: text;
											font-family: 'Bebas Neue', Impact, sans-serif;
											font-size: 22px;
											letter-spacing: 2px;
											filter: contrast(1.4) brightness(1.2);
										">WORD</span>
									</div>
								</div>
								<span class="text-[10px] font-mono text-white/40 group-hover:text-white/70 transition-colors">{pat.label}</span>
							</button>
						{/each}
					</div>

					<p class="text-[10px] font-body text-white/15 mt-2 leading-relaxed">
						Select text above → click pattern to apply
					</p>
				{/if}
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
					<Image size={9} class="inline mr-1" />Background — Slide {activeSlide + 1}
				</label>
				<div class="flex flex-col gap-2">
					<button onclick={() => generateBackground(activeSlide)}
						disabled={generatingImages[activeSlide]}
						class="flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold font-body text-violet-300 bg-violet-500/10 hover:bg-violet-500/20 border border-violet-500/15 transition-all disabled:opacity-50">
						{#if generatingImages[activeSlide]}
							<Loader size={11} class="animate-spin" /> Generating...
						{:else}
							<Sparkles size={11} /> Regenerate with AI
						{/if}
					</button>
					<button onclick={() => generateAllSlideImages()}
						disabled={generatingImages.some(Boolean)}
						class="flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold font-body text-cyan-300 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/15 transition-all disabled:opacity-50">
						{#if generatingImages.some(Boolean)}
							<Loader size={11} class="animate-spin" /> Generating all…
						{:else}
							<Sparkles size={11} /> Regenerate all slides
						{/if}
					</button>
					<label class="flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold font-body text-white/40 glass glass-hover border border-white/[0.06] transition-all cursor-pointer">
						<Image size={11} /> Upload for this slide
						<input type="file" accept="image/*" class="hidden" onchange={handleBgUpload} />
					</label>
					{#if bgError}
						<p class="text-[10px] font-body text-amber-400/70 leading-relaxed">{bgError}</p>
					{/if}
				</div>
			</div>

			<!-- Circle badge -->
			<div>
				<!-- Header row with toggle -->
				<div class="flex items-center justify-between mb-2">
					<label class="text-[10px] font-mono text-white/30 uppercase tracking-wider">Circle Badge</label>
					<button
						onclick={() => { showCircle = !showCircle; if (!showCircle) circleImage = ''; }}
						class="relative w-9 h-[18px] rounded-full transition-colors duration-200 flex-shrink-0
							{showCircle ? 'bg-cyan-500/40' : 'bg-white/[0.08]'}"
					>
						<span class="absolute top-0.5 left-0.5 w-3.5 h-3.5 rounded-full shadow transition-transform duration-200
							{showCircle ? 'translate-x-[18px] bg-cyan-400' : 'translate-x-0 bg-white/30'}">
						</span>
					</button>
				</div>

				{#if showCircle}
					<div class="flex flex-col gap-2">
						<!-- Preview + spinner -->
						{#if generatingCircle}
							<div class="flex items-center gap-2 p-2 rounded-xl bg-white/[0.03] border border-white/[0.06]">
								<div class="w-8 h-8 rounded-full bg-white/[0.05] flex items-center justify-center flex-shrink-0">
									<Loader size={12} class="animate-spin text-cyan-400" />
								</div>
								<span class="text-[11px] font-mono text-white/30">Generating…</span>
							</div>
						{:else if circleImage}
							<div class="flex items-center gap-2 p-2 rounded-xl bg-white/[0.03] border border-white/[0.06]">
								<img src={circleImage} alt="circle badge" class="w-8 h-8 rounded-full object-cover flex-shrink-0 border border-white/10" />
								<span class="text-[11px] font-mono text-white/30 flex-1">Auto-generated</span>
								<button onclick={generateCircleImage} title="Regenerate" class="text-white/20 hover:text-cyan-400 transition-colors">
									<RefreshCw size={11} />
								</button>
								<button onclick={() => circleImage = ''} title="Remove" class="text-white/20 hover:text-red-400 transition-colors">
									✕
								</button>
							</div>
						{/if}

						<!-- Size slider -->
						<div class="flex items-center gap-2.5 px-1">
							<span class="text-[10px] font-mono text-white/30 flex-shrink-0 w-7">Size</span>
							<input
								type="range"
								min="128" max="512" step="8"
								bind:value={circleSize}
								class="flex-1 h-1 rounded-full accent-cyan-400 cursor-pointer"
							/>
							<span class="text-[10px] font-mono text-white/30 flex-shrink-0 w-7 text-right">{circleSize}</span>
						</div>

						<!-- Action buttons -->
						<button onclick={generateCircleImage} disabled={generatingCircle}
							class="flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold font-body text-cyan-300 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/15 transition-all disabled:opacity-50">
							{#if generatingCircle}
								<Loader size={11} class="animate-spin" /> Generating…
							{:else}
								<Sparkles size={11} /> {circleImage ? 'Regenerate' : 'Generate'} with AI
							{/if}
						</button>
						<label class="flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold font-body text-white/40 glass glass-hover border border-white/[0.06] transition-all cursor-pointer">
							<Image size={11} /> Upload custom image
							<input type="file" accept="image/*" class="hidden" onchange={handleCircleUpload} />
						</label>
					</div>
				{/if}
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
	<div class="flex-1 flex flex-col items-center justify-center bg-[#080808] overflow-hidden p-6 gap-4">

		<!-- Slide indicator + nav arrows -->
		<div class="flex items-center gap-3">
			<button
				onclick={() => activeSlide = Math.max(0, activeSlide - 1)}
				disabled={activeSlide === 0}
				class="w-7 h-7 rounded-full border border-white/10 flex items-center justify-center text-white/30 hover:text-white hover:border-white/30 disabled:opacity-20 disabled:cursor-not-allowed transition-all">
				‹
			</button>
			<p class="font-mono text-[10px] text-white/20 uppercase tracking-widest">
				{slides.length > 1 ? `Slide ${activeSlide + 1} / ${slides.length} — ` : ''}1080 × 1350
			</p>
			<button
				onclick={() => activeSlide = Math.min(slides.length - 1, activeSlide + 1)}
				disabled={activeSlide === slides.length - 1}
				class="w-7 h-7 rounded-full border border-white/10 flex items-center justify-center text-white/30 hover:text-white hover:border-white/30 disabled:opacity-20 disabled:cursor-not-allowed transition-all">
				›
			</button>
		</div>

		<!-- Main preview -->
		<div style="width: {PREVIEW_WIDTH}px; height: {1350 * previewScale}px;" class="relative">
			{#if generatingImages[activeSlide]}
				<!-- Image loading overlay -->
				<div class="absolute inset-0 rounded-2xl bg-[#111] border border-white/[0.06] flex flex-col items-center justify-center gap-3 z-10">
					<Loader size={20} class="animate-spin text-violet-400" />
					<p class="text-xs font-mono text-white/30">Generating image…</p>
				</div>
			{:else if generatingVariants && activeSlide > 0 && !slides[activeSlide]}
				<div class="absolute inset-0 rounded-2xl bg-[#111] border border-white/[0.06] flex flex-col items-center justify-center gap-3 z-10">
					<Loader size={20} class="animate-spin text-amber-400" />
					<p class="text-xs font-mono text-white/30">Writing slide {activeSlide + 1}…</p>
				</div>
			{/if}
			<NewsTemplate
				bind:exportRef
				bind:circleX
				bind:circleY
				bind:circleSize
				backgroundImage={backgroundImage}
				circleImage={showCircle ? circleImage : ''}
				text={overlayText}
				source={source}
				highlightColor={highlightColor}
				textColor={textColor}
				scale={previewScale}
				interactive={true}
				onTextChange={(t) => setActiveSlideText(t)}
				onCircleMove={(x, y) => { circleX = x; circleY = y; }}
			/>
		</div>

		{#if !backgroundImage}
			<p class="font-body text-xs text-white/20 text-center max-w-xs">
				Fetch a news article or upload a background image to see your post
			</p>
		{/if}

		<!-- Slide filmstrip (shown when >1 slide) -->
		{#if slides.length > 1}
			<div class="flex gap-2 overflow-x-auto max-w-full pb-1 px-1">
				{#each slides as slideText, i}
					<button
						onclick={() => activeSlide = i}
						class="flex-shrink-0 flex flex-col items-center gap-1 group"
					>
						<!-- Mini preview card -->
						<div class="w-14 h-[70px] rounded-lg overflow-hidden border-2 transition-all
							{activeSlide === i ? 'border-violet-500' : 'border-white/[0.06] group-hover:border-white/20'}
							bg-[#111] relative">

							{#if generatingImages[i]}
								<!-- Per-slide image spinner -->
								<div class="absolute inset-0 flex items-center justify-center bg-[#111]">
									<Loader size={12} class="animate-spin text-violet-400 opacity-60" />
								</div>
							{:else if backgroundImages[i]}
								<img src={backgroundImages[i]} alt="" class="w-full h-full object-cover opacity-70" />
							{/if}

							<!-- Text overlay on thumb -->
							<div class="absolute inset-0 flex items-end p-1 bg-gradient-to-t from-black/70 to-transparent">
								<p class="text-white leading-tight line-clamp-3"
									style="font-family: 'Bebas Neue', sans-serif; font-size: 6px;">
									{slideText.replace(/\[\[|\]\]/g, '')}
								</p>
							</div>
						</div>
						<span class="text-[9px] font-mono {activeSlide === i ? 'text-violet-400' : 'text-white/20'}">
							{i === 0 ? 'Hook' : `Slide ${i + 1}`}
						</span>
					</button>
				{/each}
			</div>
		{/if}
	</div>

</div>

<style>
	select option {
		background: #1a1a1a;
		color: #f8f8f8;
	}
</style>
