<script lang="ts">
	import { supabase } from '$lib/supabase';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { toPng } from 'html-to-image';
	import NewsTemplate from '$lib/components/templates/NewsTemplate.svelte';
	import {
		ChevronLeft, ChevronRight, Plus, Trash2, Save, Download,
		Type, Palette, AlignLeft, AlignCenter, AlignRight, Bold,
		Sparkles, Loader, Check, ImagePlus, X, Newspaper, Pencil,
		Search, Image, RefreshCw, AlertCircle, ChevronDown, Video
	} from 'lucide-svelte';

	const carouselId = $derived($page.params.id);

	// ── Mode ──────────────────────────────────────────────────────────────
	type EditorMode = 'carousel' | 'news';
	let mode = $state<EditorMode>('carousel');

	// ── Carousel state ────────────────────────────────────────────────────
	interface Slide {
		id: string; text: string; subtext?: string;
		type: 'hook' | 'body' | 'cta';
		bg: string; textColor: string;
		align: 'left' | 'center' | 'right';
		bold: boolean; fontSize: number;
	}

	let carousel: any = $state(null);
	let slides: Slide[] = $state([]);
	let activeIdx = $state(0);
	let loading = $state(true);
	let saving = $state(false);
	let saved = $state(false);
	let generatingHooks = $state(false);
	let hookTopic = $state('');
	let generatedHooks: string[] = $state([]);
	let showHookPanel = $state(false);

	const bgPresets = ['#0a0a0a','#111111','#1a0a2e','#0a1a2e','#1a0a0a','#0d1117','#1c1c1e','#0f172a','#1e1b4b','#0c4a6e'];
	const textPresets = ['#ffffff','#f8f8f8','#8B5CF6','#06B6D4','#a78bfa','#f59e0b','#10b981','#f43f5e'];

	// ── News state ────────────────────────────────────────────────────────
	let newsSearch = $state('');
	let newsCategory = $state('business');
	let fetchingNews = $state(false);
	let newsError = $state('');
	let overlayText = $state('FETCH A NEWS STORY TO GET STARTED');
	let newsSource = $state('Markets');
	let articleTitle = $state('');
	let articleUrl = $state('');
	let bgImage = $state('');
	let circleImage = $state('');
	let generatingBg = $state(false);
	let generatingCircle = $state(false);
	let bgError = $state('');
	let highlightColor = $state('#F5A623');
	let newsTextColor = $state('#FFFFFF');
	let exporting = $state(false);
	let newsExportRef: HTMLElement | null = $state(null);

	const newsCategories = [
		{ id: 'business', label: 'Business' },{ id: 'tech', label: 'Tech' },
		{ id: 'finance', label: 'Finance' },{ id: 'politics', label: 'Politics' },
		{ id: 'health', label: 'Health' },{ id: 'science', label: 'Science' },
		{ id: 'sports', label: 'Sports' },{ id: 'entertainment', label: 'Entertainment' },
	];
	const sourceLabels: Record<string,string> = {
		business:'Markets', tech:'Tech', finance:'Finance',
		politics:'Politics', health:'Health', science:'Science',
		sports:'Sports', entertainment:'Culture',
	};

	// ── Load carousel ─────────────────────────────────────────────────────
	onMount(async () => {
		const { data: { user } } = await supabase.auth.getUser();
		if (!user) { goto('/login'); return; }

		const { data } = await supabase.from('carousels').select('*').eq('id', carouselId).single();
		if (!data) { goto('/dashboard/carousels'); return; }
		carousel = data;

		try {
			const raw = typeof data.slides === 'string' ? JSON.parse(data.slides) : data.slides;
			slides = (raw as any[]).map(s => ({
				id: s.id ?? crypto.randomUUID(), text: s.text ?? '',
				subtext: s.subtext ?? '', type: s.type ?? 'body',
				bg: s.bg ?? '#111111', textColor: s.textColor ?? '#ffffff',
				align: s.align ?? 'center', bold: s.bold ?? false, fontSize: s.fontSize ?? 32,
			}));
		} catch {
			slides = [defaultSlide('hook'), defaultSlide('body'), defaultSlide('cta')];
		}
		loading = false;
	});

	// ── Carousel helpers ──────────────────────────────────────────────────
	function defaultSlide(type: Slide['type']): Slide {
		const d: Record<Slide['type'], Partial<Slide>> = {
			hook: { text: 'Your hook here', textColor: '#ffffff', bg: '#0f172a' },
			body: { text: 'Key point or insight', textColor: '#f8f8f8', bg: '#111111' },
			cta:  { text: 'Follow for more!',  textColor: '#8B5CF6', bg: '#0a0a0a' },
		};
		return { id: crypto.randomUUID(), text: '', subtext: '', type, bg: '#111111', textColor: '#ffffff', align: 'center', bold: false, fontSize: 32, ...d[type] };
	}
	function addSlide() { const s = defaultSlide('body'); slides = [...slides.slice(0, activeIdx+1), s, ...slides.slice(activeIdx+1)]; activeIdx++; }
	function deleteSlide(idx: number) { if (slides.length <= 1) return; slides = slides.filter((_,i) => i !== idx); activeIdx = Math.min(activeIdx, slides.length-1); }
	function moveSlide(from: number, to: number) { if (to < 0 || to >= slides.length) return; const s=[...slides]; [s[from],s[to]]=[s[to],s[from]]; slides=s; activeIdx=to; }
	function updateSlide(key: keyof Slide, value: any) { slides[activeIdx] = { ...slides[activeIdx], [key]: value }; slides=[...slides]; }
	let activeSlide = $derived(slides[activeIdx]);

	async function save() {
		saving = true;
		await supabase.from('carousels').update({ slides: JSON.stringify(slides), updated_at: new Date().toISOString() }).eq('id', carouselId);
		saving = false; saved = true; setTimeout(() => saved = false, 2000);
	}

	async function generateHooks() {
		if (!hookTopic.trim()) return;
		generatingHooks = true; generatedHooks = [];
		try {
			const r = await fetch('/api/hooks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ topic: hookTopic, count: 8 }) });
			generatedHooks = (await r.json()).hooks ?? [];
		} catch {}
		generatingHooks = false;
	}
	function applyHook(hook: string) { slides[0]={...slides[0], text: hook}; slides=[...slides]; showHookPanel=false; generatedHooks=[]; hookTopic=''; }

	// ── News helpers ──────────────────────────────────────────────────────
	async function fetchNews() {
		fetchingNews = true; newsError = '';
		try {
			const r = await fetch('/api/news', { method: 'POST', headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ search: newsSearch || undefined, categories: newsCategory, autoHighlight: true }) });
			const d = await r.json();
			if (!r.ok) throw new Error(d.error ?? 'Failed');
			overlayText = d.text ?? overlayText;
			newsSource = sourceLabels[newsCategory] ?? d.source ?? 'News';
			articleTitle = d.title ?? ''; articleUrl = d.url ?? '';
			if (d.title) generateBg(d.title);
		} catch (e: any) { newsError = e.message; }
		fetchingNews = false;
	}

	async function generateBg(context?: string) {
		generatingBg = true; bgError = '';
		try {
			const r = await fetch('/api/vertex', { method: 'POST', headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ prompt: context ?? articleTitle ?? overlayText.replace(/\[\[|\]\]/g,''), aspect: '3:4' }) });
			const d = await r.json();
			if (d.dataUrl) bgImage = d.dataUrl;
			else bgError = d.message ?? d.error ?? 'Image generation failed or not configured';
		} catch (e: any) { bgError = e.message; }
		generatingBg = false;
	}

	async function generateCircle() {
		generatingCircle = true;
		try {
			const r = await fetch('/api/vertex', { method: 'POST', headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ prompt: `Square editorial photo representing: ${articleTitle || overlayText.replace(/\[\[|\]\]/g,'')}`, aspect: '1:1' }) });
			const d = await r.json(); if (d.dataUrl) circleImage = d.dataUrl;
		} catch {}
		generatingCircle = false;
	}

	function handleBgUpload(e: Event) { const f=(e.target as HTMLInputElement).files?.[0]; if(!f) return; const r=new FileReader(); r.onload=()=>{bgImage=r.result as string}; r.readAsDataURL(f); }
	function handleCircleUpload(e: Event) { const f=(e.target as HTMLInputElement).files?.[0]; if(!f) return; const r=new FileReader(); r.onload=()=>{circleImage=r.result as string}; r.readAsDataURL(f); }

	async function exportNewsPng() {
		if (!newsExportRef) return;
		exporting = true;
		try {
			const url = await toPng(newsExportRef, { width: 1080, height: 1350, pixelRatio: 1, style: { transform: 'scale(1)', transformOrigin: 'top left' } });
			const a = document.createElement('a'); a.href=url; a.download=`news-post-${Date.now()}.png`; a.click();
		} catch (e: any) { alert('Export failed: ' + e.message); }
		exporting = false;
	}

	const PREVIEW_SCALE = $derived(300 / 1080);
</script>

{#if loading}
	<div class="flex items-center justify-center h-full">
		<Loader size={20} class="animate-spin text-violet-400" />
	</div>
{:else}
<div class="flex flex-col h-full">

	<!-- ── Top bar: mode toggle ────────────────────────────────────────── -->
	<div class="flex items-center gap-3 px-4 py-2.5 border-b border-white/[0.05] bg-[#0d0d0d] shrink-0">
		<a href="/dashboard/carousels" class="flex items-center gap-1 text-xs font-body text-white/40 hover:text-white transition-colors shrink-0">
			<ChevronLeft size={13} /> Back
		</a>

		<div class="h-4 w-px bg-white/10 shrink-0"></div>

		<!-- Mode toggle -->
		<div class="flex items-center gap-1 p-1 rounded-xl bg-white/[0.04] border border-white/[0.06]">
			<button onclick={() => mode = 'carousel'}
				class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold font-body transition-all
					{mode === 'carousel' ? 'bg-violet-500/20 text-violet-300 border border-violet-500/25' : 'text-white/40 hover:text-white'}">
				<Pencil size={11} /> Create Myself
			</button>
			<button onclick={() => mode = 'news'}
				class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold font-body transition-all
					{mode === 'news' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/25' : 'text-white/40 hover:text-white'}">
				<Newspaper size={11} /> News API
			</button>
		</div>

		<span class="font-body text-xs text-white/30 truncate">{carousel?.title}</span>

		<div class="ml-auto flex items-center gap-2">
			{#if mode === 'carousel'}
				<button onclick={save} disabled={saving}
					class="flex items-center gap-1 text-xs font-mono px-2.5 py-1.5 rounded-lg transition-all
						{saved ? 'text-cyan-400 bg-cyan-500/10' : 'text-violet-400 bg-violet-500/10 hover:bg-violet-500/20'}">
					{#if saving}<Loader size={10} class="animate-spin" />
					{:else if saved}<Check size={10} /> Saved
					{:else}<Save size={10} /> Save
					{/if}
				</button>
			{:else}
				<button onclick={exportNewsPng} disabled={exporting}
					class="flex items-center gap-1.5 text-xs font-semibold font-body px-3 py-1.5 rounded-lg text-white bg-gradient-to-r from-violet-600 to-cyan-500 hover:shadow-[0_0_15px_rgba(139,92,246,0.3)] transition-all disabled:opacity-50">
					{#if exporting}<Loader size={10} class="animate-spin" />{:else}<Download size={10} />{/if}
					Export PNG
				</button>
			{/if}
			<!-- Video burner link -->
			<a href="/dashboard/editor/{carouselId}/video"
				class="flex items-center gap-1.5 text-xs font-semibold font-body px-3 py-1.5 rounded-lg
					bg-[#E8FF48]/10 text-[#E8FF48] border border-[#E8FF48]/20 hover:bg-[#E8FF48]/18 transition-all">
				<Video size={10} /> Make Video
			</a>
		</div>
	</div>

	<!-- ── Editor body ─────────────────────────────────────────────────── -->
	<div class="flex flex-1 overflow-hidden">

		{#if mode === 'carousel'}
		<!-- ════════════════ CAROUSEL MODE ════════════════ -->

		<!-- Left: slide strip -->
		<div class="w-52 border-r border-white/[0.05] flex flex-col bg-[#0d0d0d]">
			<div class="flex-1 overflow-y-auto p-3 flex flex-col gap-2">
				{#each slides as slide, i}
					<button onclick={() => activeIdx = i}
						class="relative group rounded-xl overflow-hidden border-2 transition-all aspect-[4/5] flex items-center justify-center
							{i === activeIdx ? 'border-violet-500' : 'border-white/[0.06] hover:border-white/20'}"
						style="background: {slide.bg}">
						<p class="text-[8px] font-display font-bold px-2 text-center leading-tight"
							style="color: {slide.textColor}; font-size: clamp(6px, 1.5vw, 10px)">{slide.text || '...'}</p>
						<div class="absolute top-1 left-1 text-[8px] font-mono text-white/30">{i + 1}</div>
						{#if slides.length > 1}
							<button onclick={(e) => { e.stopPropagation(); deleteSlide(i); }}
								class="absolute top-1 right-1 opacity-0 group-hover:opacity-100 w-4 h-4 rounded bg-red-500/80 flex items-center justify-center transition-opacity">
								<X size={8} color="white" />
							</button>
						{/if}
					</button>
				{/each}
				<button onclick={addSlide}
					class="rounded-xl border-2 border-dashed border-white/[0.08] hover:border-violet-500/40 flex items-center justify-center aspect-[4/5] transition-all text-white/20 hover:text-violet-400">
					<Plus size={16} />
				</button>
			</div>
			<div class="px-3 pb-3 flex gap-2">
				<button onclick={() => moveSlide(activeIdx, activeIdx-1)} disabled={activeIdx===0}
					class="flex-1 py-1.5 rounded-lg text-xs font-mono text-white/30 glass glass-hover disabled:opacity-30 transition-all flex items-center justify-center">
					<ChevronLeft size={12} />
				</button>
				<button onclick={() => moveSlide(activeIdx, activeIdx+1)} disabled={activeIdx===slides.length-1}
					class="flex-1 py-1.5 rounded-lg text-xs font-mono text-white/30 glass glass-hover disabled:opacity-30 transition-all flex items-center justify-center">
					<ChevronRight size={12} />
				</button>
			</div>
		</div>

		<!-- Center: canvas -->
		<div class="flex-1 flex flex-col items-center justify-center bg-[#080808] relative p-8 gap-6">
			<div class="flex items-center gap-3 self-stretch">
				<span class="text-[10px] font-mono px-2 py-0.5 rounded-full bg-white/[0.05] text-white/30">{slides.length} slides</span>
				<div class="ml-auto">
					<button onclick={() => showHookPanel = !showHookPanel}
						class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-body text-violet-300 bg-violet-500/10 hover:bg-violet-500/20 border border-violet-500/15 transition-all">
						<Sparkles size={11} /> AI Hooks
					</button>
				</div>
			</div>

			{#if showHookPanel}
				<div class="absolute top-16 right-6 w-80 glass border border-violet-500/20 rounded-2xl p-5 z-20 shadow-2xl">
					<div class="flex items-center justify-between mb-4">
						<h3 class="font-display font-semibold text-sm text-white">Generate AI Hooks</h3>
						<button onclick={() => showHookPanel = false} class="text-white/30 hover:text-white transition-colors"><X size={14} /></button>
					</div>
					<div class="flex gap-2 mb-4">
						<input bind:value={hookTopic} placeholder="e.g. productivity tips"
							class="flex-1 bg-white/[0.04] border border-white/[0.08] rounded-xl py-2 px-3 text-sm font-body text-white placeholder-white/20 focus:outline-none focus:border-violet-500/50 transition-colors" />
						<button onclick={generateHooks} disabled={generatingHooks || !hookTopic.trim()}
							class="px-3 py-2 rounded-xl text-xs font-semibold font-body text-white bg-violet-600 hover:bg-violet-500 transition-colors disabled:opacity-40 shrink-0">
							{generatingHooks ? '...' : 'Go'}
						</button>
					</div>
					{#if generatingHooks}<div class="flex items-center gap-2 text-xs text-white/30 font-mono py-2"><Loader size={11} class="animate-spin text-violet-400" /> Generating...</div>{/if}
					{#if generatedHooks.length > 0}
						<div class="flex flex-col gap-1.5 max-h-60 overflow-y-auto">
							{#each generatedHooks as hook}
								<button onclick={() => applyHook(hook)}
									class="text-left p-2.5 rounded-lg bg-white/[0.03] hover:bg-violet-500/10 border border-white/[0.04] hover:border-violet-500/20 text-xs font-body text-white/60 hover:text-white/90 transition-all leading-relaxed">
									{hook}
								</button>
							{/each}
						</div>
					{/if}
				</div>
			{/if}

			{#if activeSlide}
				<div class="relative rounded-2xl overflow-hidden shadow-2xl"
					style="width:420px;height:525px;background:{activeSlide.bg};display:flex;flex-direction:column;align-items:{activeSlide.align==='left'?'flex-start':activeSlide.align==='right'?'flex-end':'center'};justify-content:center;padding:48px 36px;">
					<div class="absolute inset-0 opacity-30" style="background:radial-gradient(ellipse at 30% 20%,rgba(139,92,246,0.15) 0%,transparent 60%)"></div>
					<div class="relative z-10 w-full" style="text-align:{activeSlide.align}">
						<div class="inline-block mb-4 px-2 py-0.5 rounded-full border" style="border-color:{activeSlide.textColor}22;background:{activeSlide.textColor}11">
							<span class="text-[10px] font-mono" style="color:{activeSlide.textColor}88">{activeSlide.type.toUpperCase()} · {activeIdx+1}/{slides.length}</span>
						</div>
						<p class="leading-tight" style="color:{activeSlide.textColor};font-size:{activeSlide.fontSize}px;font-family:'Syne',sans-serif;font-weight:{activeSlide.bold?800:600};word-break:break-word">
							{activeSlide.text || 'Click to edit text →'}
						</p>
						{#if activeSlide.subtext}<p class="mt-3 text-sm leading-relaxed" style="color:{activeSlide.textColor}99;font-family:'DM Sans',sans-serif">{activeSlide.subtext}</p>{/if}
					</div>
				</div>
			{/if}

			<div class="flex items-center gap-1.5">
				{#each slides as _, i}
					<button onclick={() => activeIdx = i}
						class="rounded-full transition-all {i===activeIdx?'w-4 h-1.5 bg-violet-500':'w-1.5 h-1.5 bg-white/20 hover:bg-white/40'}">
					</button>
				{/each}
			</div>
		</div>

		<!-- Right: properties -->
		{#if activeSlide}
		<div class="w-64 border-l border-white/[0.05] bg-[#0d0d0d] flex flex-col overflow-y-auto">
			<div class="px-5 py-4 border-b border-white/[0.04]">
				<p class="font-display font-semibold text-sm text-white">Slide {activeIdx+1} properties</p>
			</div>
			<div class="p-4 flex flex-col gap-5">
				<div>
					<label class="text-[10px] font-mono text-white/30 uppercase tracking-wider block mb-2">Type</label>
					<div class="flex gap-1">
						{#each ['hook','body','cta'] as t}
							<button onclick={() => updateSlide('type', t)}
								class="flex-1 py-1.5 rounded-lg text-xs font-mono capitalize transition-all {activeSlide.type===t?'bg-violet-500/20 text-violet-300 border border-violet-500/25':'text-white/30 glass glass-hover'}">
								{t}
							</button>
						{/each}
					</div>
				</div>
				<div>
					<label class="text-[10px] font-mono text-white/30 uppercase tracking-wider block mb-2"><Type size={9} class="inline mr-1" />Main Text</label>
					<textarea bind:value={slides[activeIdx].text} oninput={(e)=>updateSlide('text',(e.target as HTMLTextAreaElement).value)} rows={4} placeholder="Enter your text..."
						class="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl py-2.5 px-3 text-sm font-body text-white placeholder-white/20 focus:outline-none focus:border-violet-500/50 transition-colors resize-none"></textarea>
				</div>
				<div>
					<label class="text-[10px] font-mono text-white/30 uppercase tracking-wider block mb-2">Subtext (optional)</label>
					<textarea bind:value={slides[activeIdx].subtext} oninput={(e)=>updateSlide('subtext',(e.target as HTMLTextAreaElement).value)} rows={2} placeholder="Supporting copy..."
						class="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl py-2.5 px-3 text-sm font-body text-white placeholder-white/20 focus:outline-none focus:border-violet-500/50 transition-colors resize-none"></textarea>
				</div>
				<div>
					<label class="text-[10px] font-mono text-white/30 uppercase tracking-wider block mb-2">Font size: {activeSlide.fontSize}px</label>
					<input type="range" min={16} max={56} step={2} bind:value={slides[activeIdx].fontSize} oninput={(e)=>updateSlide('fontSize',parseInt((e.target as HTMLInputElement).value))} class="w-full accent-violet-500" />
				</div>
				<div>
					<label class="text-[10px] font-mono text-white/30 uppercase tracking-wider block mb-2">Format</label>
					<div class="flex gap-1">
						{#each [['left',AlignLeft],['center',AlignCenter],['right',AlignRight]] as [val, Icon]}
							<button onclick={() => updateSlide('align', val)}
								class="flex-1 py-1.5 rounded-lg flex items-center justify-center transition-all {activeSlide.align===val?'bg-violet-500/20 text-violet-300 border border-violet-500/25':'text-white/30 glass glass-hover'}">
								<svelte:component this={Icon} size={13} />
							</button>
						{/each}
						<button onclick={() => updateSlide('bold', !activeSlide.bold)}
							class="flex-1 py-1.5 rounded-lg flex items-center justify-center transition-all {activeSlide.bold?'bg-violet-500/20 text-violet-300 border border-violet-500/25':'text-white/30 glass glass-hover'}">
							<Bold size={13} />
						</button>
					</div>
				</div>
				<div>
					<label class="text-[10px] font-mono text-white/30 uppercase tracking-wider block mb-2"><Palette size={9} class="inline mr-1" />Text color</label>
					<div class="flex flex-wrap gap-1.5 mb-2">
						{#each textPresets as color}
							<button onclick={() => updateSlide('textColor', color)} class="w-6 h-6 rounded-lg border-2 transition-all {activeSlide.textColor===color?'border-white scale-110':'border-transparent hover:scale-105'}" style="background:{color}"></button>
						{/each}
					</div>
					<input type="color" value={activeSlide.textColor} oninput={(e)=>updateSlide('textColor',(e.target as HTMLInputElement).value)} class="w-full h-8 rounded-lg cursor-pointer bg-transparent border border-white/[0.08]" />
				</div>
				<div>
					<label class="text-[10px] font-mono text-white/30 uppercase tracking-wider block mb-2">Background</label>
					<div class="flex flex-wrap gap-1.5 mb-2">
						{#each bgPresets as color}
							<button onclick={() => updateSlide('bg', color)} class="w-6 h-6 rounded-lg border-2 transition-all {activeSlide.bg===color?'border-white scale-110':'border-white/10 hover:scale-105'}" style="background:{color}"></button>
						{/each}
					</div>
					<input type="color" value={activeSlide.bg} oninput={(e)=>updateSlide('bg',(e.target as HTMLInputElement).value)} class="w-full h-8 rounded-lg cursor-pointer bg-transparent border border-white/[0.08]" />
				</div>
			</div>
			<div class="p-4 border-t border-white/[0.04] mt-auto">
				<button onclick={save} disabled={saving}
					class="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold font-body text-white bg-gradient-to-r from-violet-600 to-cyan-500 hover:shadow-[0_0_20px_rgba(139,92,246,0.3)] transition-all disabled:opacity-50">
					{#if saving}<Loader size={13} class="animate-spin" />{:else if saved}<Check size={13} /> Saved!{:else}<Save size={13} /> Save carousel{/if}
				</button>
			</div>
		</div>
		{/if}

		{:else}
		<!-- ════════════════ NEWS MODE ════════════════ -->

		<!-- Left: news controls -->
		<div class="w-72 border-r border-white/[0.05] bg-[#0d0d0d] flex flex-col overflow-y-auto">
			<div class="p-4 flex flex-col gap-3">

				<!-- Category -->
				<div>
					<label class="text-[10px] font-mono text-white/30 uppercase tracking-wider block mb-1.5">Category</label>
					<div class="relative">
						<select bind:value={newsCategory}
							class="w-full appearance-none bg-white/[0.04] border border-white/[0.08] rounded-xl py-2 pl-3 pr-8 text-sm font-body text-white focus:outline-none focus:border-amber-500/50 transition-colors">
							{#each newsCategories as cat}<option value={cat.id}>{cat.label}</option>{/each}
						</select>
						<ChevronDown size={12} class="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none" />
					</div>
				</div>

				<!-- Search -->
				<div>
					<label class="text-[10px] font-mono text-white/30 uppercase tracking-wider block mb-1.5">Search (optional)</label>
					<div class="relative">
						<Search size={12} class="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
						<input bind:value={newsSearch} placeholder="e.g. Tesla, interest rates..."
							class="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl py-2 pl-8 pr-3 text-sm font-body text-white placeholder-white/20 focus:outline-none focus:border-amber-500/50 transition-colors" />
					</div>
				</div>

				<button onclick={fetchNews} disabled={fetchingNews}
					class="flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold font-body text-white bg-gradient-to-r from-amber-600 to-orange-500 hover:shadow-[0_0_20px_rgba(245,158,11,0.3)] transition-all disabled:opacity-50">
					{#if fetchingNews}<Loader size={13} class="animate-spin" /> Fetching + Rewriting...{:else}<Newspaper size={13} /> Fetch News{/if}
				</button>

				{#if newsError}
					<div class="flex items-start gap-2 p-2.5 rounded-xl bg-red-500/10 border border-red-500/20">
						<AlertCircle size={11} class="text-red-400 shrink-0 mt-0.5" />
						<p class="text-[11px] font-body text-red-400">{newsError}</p>
					</div>
				{/if}

				<div class="border-t border-white/[0.05]"></div>

				<!-- Overlay text -->
				<div>
					<label class="text-[10px] font-mono text-white/30 uppercase tracking-wider block mb-1">Overlay Text</label>
					<p class="text-[10px] text-white/20 font-body mb-1.5">Use <code class="text-amber-400 bg-amber-500/10 px-1 rounded">[[WORD]]</code> to highlight</p>
					<textarea bind:value={overlayText} rows={5}
						class="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl py-2 px-3 text-sm font-body text-white placeholder-white/20 focus:outline-none focus:border-amber-500/50 transition-colors resize-none"></textarea>
				</div>

				<!-- Source label -->
				<div>
					<label class="text-[10px] font-mono text-white/30 uppercase tracking-wider block mb-1.5">Source Label</label>
					<input bind:value={newsSource} placeholder="Markets"
						class="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl py-2 px-3 text-sm font-body text-white placeholder-white/20 focus:outline-none focus:border-amber-500/50 transition-colors" />
				</div>

				<!-- Highlight color -->
				<div>
					<label class="text-[10px] font-mono text-white/30 uppercase tracking-wider block mb-1.5"><Palette size={9} class="inline mr-1" />Highlight Color</label>
					<div class="flex items-center gap-1.5">
						{#each ['#F5A623','#08EBFF','#FF3B5C','#A855F7','#10B981','#FFFFFF'] as c}
							<button onclick={() => highlightColor = c}
								class="w-6 h-6 rounded-lg border-2 transition-all flex-shrink-0 {highlightColor===c?'border-white scale-110':'border-transparent hover:scale-105'}"
								style="background:{c}"></button>
						{/each}
						<input type="color" bind:value={highlightColor} class="w-7 h-6 rounded-lg cursor-pointer bg-transparent border border-white/[0.08] flex-shrink-0" />
					</div>
				</div>

				<div class="border-t border-white/[0.05]"></div>

				<!-- Background image -->
				<div>
					<label class="text-[10px] font-mono text-white/30 uppercase tracking-wider block mb-1.5"><Image size={9} class="inline mr-1" />Background Image</label>
					<div class="flex flex-col gap-1.5">
						<button onclick={() => generateBg()} disabled={generatingBg}
							class="flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold font-body text-violet-300 bg-violet-500/10 hover:bg-violet-500/20 border border-violet-500/15 transition-all disabled:opacity-50">
							{#if generatingBg}<Loader size={11} class="animate-spin" /> Generating...{:else}<Sparkles size={11} /> Generate with AI{/if}
						</button>
						<label class="flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold font-body text-white/40 glass glass-hover border border-white/[0.06] cursor-pointer transition-all">
							<Image size={11} /> Upload image
							<input type="file" accept="image/*" class="hidden" onchange={handleBgUpload} />
						</label>
						{#if bgError}<p class="text-[10px] font-body text-amber-400/70 leading-relaxed">{bgError}</p>{/if}
					</div>
				</div>

				<!-- Circle badge -->
				<div>
					<label class="text-[10px] font-mono text-white/30 uppercase tracking-wider block mb-1.5">Circle Badge (optional)</label>
					<div class="flex flex-col gap-1.5">
						<button onclick={generateCircle} disabled={generatingCircle}
							class="flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold font-body text-cyan-300 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/15 transition-all disabled:opacity-50">
							{#if generatingCircle}<Loader size={11} class="animate-spin" /> Generating...{:else}<Sparkles size={11} /> Generate with AI{/if}
						</button>
						<label class="flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold font-body text-white/40 glass glass-hover border border-white/[0.06] cursor-pointer transition-all">
							<Image size={11} /> Upload circle image
							<input type="file" accept="image/*" class="hidden" onchange={handleCircleUpload} />
						</label>
						{#if circleImage}
							<button onclick={() => circleImage = ''} class="text-[10px] font-mono text-red-400/60 hover:text-red-400 transition-colors text-left">✕ Remove circle</button>
						{/if}
					</div>
				</div>

				{#if articleUrl}
					<a href={articleUrl} target="_blank" rel="noopener noreferrer"
						class="text-center text-[10px] font-body text-amber-400/60 hover:text-amber-400 transition-colors underline underline-offset-2">
						View source article ↗
					</a>
				{/if}
			</div>
		</div>

		<!-- Center: news template preview -->
		<div class="flex-1 flex flex-col items-center justify-center bg-[#080808] overflow-hidden p-8">
			<p class="font-mono text-[10px] text-white/20 mb-4 uppercase tracking-widest">Preview — 1080 × 1350</p>
			<NewsTemplate
				bind:exportRef={newsExportRef}
				backgroundImage={bgImage}
				circleImage={circleImage}
				text={overlayText}
				source={newsSource}
				highlightColor={highlightColor}
				textColor={newsTextColor}
				scale={PREVIEW_SCALE}
			/>
			{#if !bgImage}
				<p class="font-body text-xs text-white/20 mt-4 text-center max-w-xs">Fetch a news article or upload a background image to preview</p>
			{/if}
		</div>

		{/if}
	</div>
</div>
{/if}

<style>
	select option { background: #1a1a1a; color: #f8f8f8; }
</style>
