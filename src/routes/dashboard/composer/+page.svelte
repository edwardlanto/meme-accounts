<script lang="ts">
	import { supabase } from '$lib/supabase';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { toPng } from 'html-to-image';
	import TweetTemplate from '$lib/components/templates/TweetTemplate.svelte';
	import TextCarouselTemplate from '$lib/components/templates/TextCarouselTemplate.svelte';
	import ArticleTemplate from '$lib/components/templates/ArticleTemplate.svelte';
	import NewsTemplate from '$lib/components/templates/NewsTemplate.svelte';
	import ImageQuoteTemplate from '$lib/components/templates/ImageQuoteTemplate.svelte';
	import { AVAILABLE_PATTERNS } from '$lib/highlight';
	import type { Overlay } from '$lib/types';
	import {
		Download, Loader, Copy, Plus, Trash2, CheckSquare, Square,
		Image, Layers, Bird, Type, FileText, Newspaper, Calendar,
		Sparkles, RefreshCw, Search, FlaskConical, Wifi,
		AlertCircle, Palette, ChevronDown
	} from 'lucide-svelte';

	// ── Types ──────────────────────────────────────────────────────────────────
	type TemplateType = 'tweet' | 'text' | 'article' | 'news' | 'imageQuote';

	interface TweetData {
		topName: string; topHandle: string; topAvatar: string;
		topVerified: boolean; topText: string; topImage: string;
		bottomName: string; bottomHandle: string; bottomAvatar: string;
		bottomVerified: boolean; bottomText: string;
	}
	interface TextData {
		name: string; handle: string; avatar: string;
		ringColor: string; bgColor: string; text: string; showSwipe: boolean;
	}
	interface ArticleData {
		text: string; image: string;
		accentColor: string; bgColor: string;
		logoSrc: string; logoRingColor: string;
		showSwipe: boolean; swipeText: string;
	}
	interface NewsData {
		text: string; source: string;
		backgroundImage: string; backgroundVideo: string;
		circleImage: string; showCircle: boolean;
		circleX: number; circleY: number; circleSize: number;
		bgOffsetX: number; bgOffsetY: number;
		textPanelOffsetY: number;
		highlightColor: string; textColor: string;
		highlightMode: 'solid' | 'pattern';
		overlays: Overlay[];
		generatingImage: boolean; generatingCircle: boolean;
	}
	interface ImageQuoteData {
		image: string;
		text: string;
		footerLeft: string;
		footerRight: string;
		topRatio: number;
		bgColor: string;
		textColor: string;
	}
	interface Slide {
		id: string; template: TemplateType;
		tweet: TweetData; text: TextData; article: ArticleData; news: NewsData; imageQuote: ImageQuoteData;
	}

	function blankTweet(): TweetData {
		return { topName:'', topHandle:'', topAvatar:'', topVerified:true, topText:'', topImage:'', bottomName:'', bottomHandle:'', bottomAvatar:'', bottomVerified:true, bottomText:'' };
	}
	function blankText(): TextData {
		return { name:'', handle:'', avatar:'', ringColor:'#c9b97a', bgColor:'#0a0a0a', text:'', showSwipe:false };
	}
	function blankArticle(): ArticleData {
		return { text:'', image:'', accentColor:'#3ecf8e', bgColor:'#000000', logoSrc:'', logoRingColor:'#c9b97a', showSwipe:true, swipeText:'«« Swipe' };
	}
	function blankNews(): NewsData {
		return { text:'YOUR HEADLINE WILL APPEAR HERE', source:'Markets', backgroundImage:'', backgroundVideo:'', circleImage:'', showCircle:true, circleX:772, circleY:52, circleSize:256, bgOffsetX:50, bgOffsetY:50, textPanelOffsetY:0, highlightColor:'#F5A623', textColor:'#FFFFFF', highlightMode:'solid', overlays:[], generatingImage:false, generatingCircle:false };
	}
	function blankImageQuote(): ImageQuoteData {
		return {
			image: '/templates/image-quote/demo-bg.png',
			text: 'YOUR BIG STATEMENT GOES HERE.\nMAKE IT SHORT, PUNCHY, AND ALL CAPS.',
			footerLeft: '$',
			footerRight: 'WEALTHY SETUP',
			topRatio: 0.56,
			bgColor: '#000000',
			textColor: '#FFFFFF',
		};
	}
	function blankSlide(template: TemplateType = 'tweet', inherit?: Slide): Slide {
		return {
			id: crypto.randomUUID(), template,
			tweet: inherit ? { ...inherit.tweet, topText:'', topImage:'', bottomText:'' } : blankTweet(),
			text:  inherit ? { ...inherit.text,  text:'' } : blankText(),
			article: inherit ? { ...inherit.article, text:'', image:'' } : blankArticle(),
			news: inherit ? { ...inherit.news, text:'', backgroundImage:'', backgroundVideo:'', overlays:[], generatingImage:false, generatingCircle:false } : blankNews(),
			imageQuote: inherit ? { ...inherit.imageQuote } : blankImageQuote(),
		};
	}

	// ── Auth ──────────────────────────────────────────────────────────────────
	onMount(async () => {
		const { data: { user } } = await supabase.auth.getUser();
		if (!user) goto('/login');
	});

	// ── Slides ────────────────────────────────────────────────────────────────
	let slides = $state<Slide[]>([{
		id: crypto.randomUUID(), template: 'tweet',
		tweet: { topName:'Chef 👨‍🍳', topHandle:'@chefsevenn', topAvatar:'', topVerified:true, topText:'Ketchup or mayo or mustard?', topImage:'', bottomName:'Mo Mohler', bottomHandle:'@MoMohler', bottomAvatar:'', bottomVerified:true, bottomText:'3 straight misses chef. These appear to be French fries.' },
		text: blankText(), article: blankArticle(), news: blankNews(), imageQuote: blankImageQuote(),
	}]);
	let activeIdx = $state(0);
	let s = $derived(slides[activeIdx]);

	// ── Per-slide music (layout only) ─────────────────────────────────────────
	let slideMusic = $state<{ song: string }[]>([]);
	const SONG_OPTIONS = [
		'No music', 'Lo-fi Chill', 'Upbeat Corporate',
		'Cinematic Rise', 'Acoustic Mood', 'Electronic Pulse', 'Inspirational Piano',
	];
	$effect(() => {
		const count = slides.length;
		if (slideMusic.length !== count) {
			slideMusic = Array.from({ length: count }, (_, i) => slideMusic[i] ?? { song: 'No music' });
		}
	});

	function addSlide() {
		slides = [...slides, blankSlide(s.template, s)];
		activeIdx = slides.length - 1;
	}
	function duplicateSlide() {
		const src = slides[activeIdx];
		const dup: Slide = { ...src, id: crypto.randomUUID(), tweet:{...src.tweet}, text:{...src.text}, article:{...src.article}, news:{...src.news, overlays:[...src.news.overlays]} };
		slides = [...slides.slice(0, activeIdx+1), dup, ...slides.slice(activeIdx+1)];
		activeIdx = activeIdx + 1;
	}
	function deleteSlide(i: number) {
		if (slides.length === 1) return;
		slides = slides.filter((_,idx) => idx !== i);
		activeIdx = Math.min(activeIdx, slides.length - 1);
	}

	// ── File helpers ──────────────────────────────────────────────────────────
	function readAsDataURL(file: File): Promise<string> {
		return new Promise(res => { const r = new FileReader(); r.onload = () => res(r.result as string); r.readAsDataURL(file); });
	}
	async function upload(e: Event, setter: (v: string) => void) {
		const f = (e.target as HTMLInputElement).files?.[0];
		if (f) setter(await readAsDataURL(f));
	}

	// ── News AI state ─────────────────────────────────────────────────────────
	const MOCK_NEWS = [
		{ title:"The top 5 startup buyers in Silicon Valley", description:"Silicon Valley giants made up 33% of total startup acquisition deals since 2000", snippet:"Silicon Valley is known for nurturing some of the world's most successful tech startups...", url:"https://qz.com/google-apple-meta-startup-acquisitions-silicon-valley-1851681629", image_url:"https://i.kinja-img.com/image/upload/c_fill,h_675,pg_1,q_80,w_1200/0c461b0f4587d274f2cc0a13ac4c1e1a.jpg", source:"qz.com", categories:["business","tech"] },
		{ title:"Mental-Health Startup Cerebral Investigated by FTC", description:"Regulators focus on whether online provider engaged in deceptive or unfair marketing practices", snippet:"Mental health startup Cerebral was subpoenaed last month by federal prosecutors...", url:"https://www.wsj.com/articles/ftc-launches-probe-of-cerebrals-business-practices-11655241983", image_url:"https://images.wsj.net/im-563603/social", source:"wsj.com", categories:["business"] },
	] as const;

	const categories = [
		{ id:'business',label:'Business' },{ id:'tech',label:'Tech' },{ id:'finance',label:'Finance' },
		{ id:'politics',label:'Politics' },{ id:'health',label:'Health' },{ id:'science',label:'Science' },
		{ id:'sports',label:'Sports' },{ id:'entertainment',label:'Entertainment' },{ id:'general',label:'General' },
	];
	const sourceLabels: Record<string,string> = { business:'Markets',tech:'Tech',finance:'Finance',politics:'Politics',health:'Health',science:'Science',sports:'Sports',entertainment:'Culture',general:'News' };

	let newsCategory  = $state('business');
	let newsSearch    = $state('');
	let useTestData   = $state(true);
	let fetchingNews  = $state(false);
	let newsError     = $state('');
	let articleTitle  = $state('');
	let articleUrl    = $state('');
	let noSelectionHint = $state(false);

	async function fetchNewsForSlide() {
		fetchingNews = true; newsError = '';
		try {
			if (useTestData) {
				await new Promise(r => setTimeout(r, 400));
				const pool = newsSearch ? MOCK_NEWS.filter(a => a.title.toLowerCase().includes(newsSearch.toLowerCase())) : MOCK_NEWS;
				const art = pool[Math.floor(Math.random() * pool.length)] ?? MOCK_NEWS[0];
				articleTitle = art.title; articleUrl = art.url;
				slides[activeIdx].news.text = art.title;
				slides[activeIdx].news.source = sourceLabels[newsCategory] ?? art.source;
				slides[activeIdx].news.backgroundImage = art.image_url;
				slides[activeIdx].news.backgroundVideo = '';
			} else {
				const res = await fetch('/api/news', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ search: newsSearch||undefined, categories: newsCategory, autoHighlight:true, pick:'first' }) });
				const data = await res.json();
				if (!res.ok) throw new Error(data.error ?? 'Failed to fetch news');
				articleTitle = data.title ?? ''; articleUrl = data.url ?? '';
				slides[activeIdx].news.text = data.text ?? data.title ?? '';
				slides[activeIdx].news.source = sourceLabels[newsCategory] ?? 'News';
				slides[activeIdx].news.backgroundImage = data.imageUrl ?? '';
				slides[activeIdx].news.backgroundVideo = '';
			}
		} catch (e: any) { newsError = e.message; }
		fetchingNews = false;
	}

	async function generateBg() {
		const idx = activeIdx;
		slides[idx].news.generatingImage = true;
		try {
			const prompt = slides[idx].news.text.replace(/\[\[|\]\]/g,'').trim() || articleTitle || 'editorial news photo';
			const res = await fetch('/api/vertex', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ prompt, aspect:'3:4', context: articleTitle }) });
			const data = await res.json();
			if (data.dataUrl) {
				slides[idx].news.backgroundImage = data.dataUrl;
				slides[idx].news.backgroundVideo = '';
			} else { newsError = data.message ?? data.error ?? 'Image generation failed'; }
		} catch (e: any) { newsError = e.message; }
		slides[idx].news.generatingImage = false;
	}

	async function generateCircle() {
		const idx = activeIdx;
		slides[idx].news.generatingCircle = true;
		try {
			const context = articleTitle || slides[idx].news.text.replace(/\[\[|\]\]/g,'');
			const prompt = `Bold editorial close-up photo representing: "${context}". Square crop, single strong subject, dramatic lighting, no text.`;
			const res = await fetch('/api/vertex', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ prompt, aspect:'1:1' }) });
			const data = await res.json();
			if (data.dataUrl) slides[idx].news.circleImage = data.dataUrl;
		} catch {}
		slides[idx].news.generatingCircle = false;
	}

	function insertHighlight(color: string) {
		// Applies [[WORD]] to selected text in the data-slide-text textarea
		const ta = document.querySelector<HTMLTextAreaElement>('textarea[data-slide-text]');
		if (!ta) return;
		const { selectionStart: s, selectionEnd: e, value } = ta;
		const sel = value.slice(s, e).replace(/\[\[.*?:\s*/g,'').replace(/\]\]/g,'').trim();
		if (!sel) return;
		const markup = `[[#${color.replace('#','')}: ${sel}]]`;
		const next = value.slice(0, s) + markup + value.slice(e);
		slides[activeIdx].news.text = next;
	}

	function insertGradient(from: string, to: string) {
		const ta = document.querySelector<HTMLTextAreaElement>('textarea[data-slide-text]');
		if (!ta) return;
		const { selectionStart: s, selectionEnd: e, value } = ta;
		const sel = value.slice(s, e).replace(/\[\[.*?:\s*/g,'').replace(/\]\]/g,'').trim();
		if (!sel) return;
		slides[activeIdx].news.text = value.slice(0,s) + `[[grad(${from},${to}): ${sel}]]` + value.slice(e);
	}

	function insertPattern(name: string) {
		const ta = document.querySelector<HTMLTextAreaElement>('textarea[data-slide-text]');
		if (!ta) return;
		const { selectionStart: s, selectionEnd: e, value } = ta;
		const sel = value.slice(s, e).replace(/\[\[.*?:\s*/g,'').replace(/\]\]/g,'').trim();
		if (!sel) { noSelectionHint = true; setTimeout(() => noSelectionHint = false, 2000); return; }
		slides[activeIdx].news.highlightMode = 'pattern';
		slides[activeIdx].news.text = value.slice(0,s) + `[[pattern(${name}): ${sel}]]` + value.slice(e);
	}

	// ── Export ────────────────────────────────────────────────────────────────
	let exporting    = $state(false);
	let exportingAll = $state(false);
	let exportRef: HTMLElement | null = $state(null);

	async function exportCurrent() {
		if (!exportRef) return; exporting = true;
		try {
			const url = await toPng(exportRef, { width:1080, height:1350, pixelRatio:1, style:{ transform:'scale(1)', transformOrigin:'top left' } });
			const a = document.createElement('a'); a.href=url; a.download=`slide-${activeIdx+1}.png`; a.click();
		} catch (e:any) { alert('Export failed: '+e.message); }
		exporting = false;
	}
	async function exportAll() {
		exportingAll = true; const saved = activeIdx;
		for (let i = 0; i < slides.length; i++) {
			activeIdx = i; await new Promise(r => setTimeout(r, 130));
			if (!exportRef) continue;
			try {
				const url = await toPng(exportRef, { width:1080, height:1350, pixelRatio:1, style:{ transform:'scale(1)', transformOrigin:'top left' } });
				const a = document.createElement('a'); a.href=url; a.download=`slide-${i+1}.png`; a.click();
				await new Promise(r => setTimeout(r, 150));
			} catch {}
		}
		activeIdx = saved; exportingAll = false;
	}

	// ── Scales ────────────────────────────────────────────────────────────────
	const PREVIEW_W  = 520;
	const THUMB_W    = 88;
	const previewScale = $derived(PREVIEW_W / 1080);
	const thumbScale   = THUMB_W / 1080;

	const TEMPLATES = [
		{ id:'tweet'   as TemplateType, label:'Tweet',   icon: Bird,      color:'#38bdf8' },
		{ id:'text'    as TemplateType, label:'Text',    icon: Type,      color:'#d4d4d4' },
		{ id:'article' as TemplateType, label:'Article', icon: FileText,  color:'#34d399' },
		{ id:'news'    as TemplateType, label:'News',    icon: Newspaper, color:'#F5A623' },
		{ id:'imageQuote' as TemplateType, label:'Quote', icon: Image,    color:'#ffffff' },
	];
	function tColor(t: TemplateType) { return TEMPLATES.find(x => x.id === t)?.color ?? '#fff'; }
</script>

<div class="flex h-full overflow-hidden">

<!-- ═══════════════════════════════════════════════════════════════ SIDEBAR -->
<div class="w-80 flex-shrink-0 border-r border-white/[0.05] bg-[#0d0d0d] flex flex-col overflow-hidden">

	<!-- Header -->
	<div class="px-5 py-4 border-b border-white/[0.04] flex-shrink-0 flex items-center gap-2">
		<Layers size={13} class="text-white/40" />
		<div>
			<h1 class="font-display font-bold text-sm text-white leading-none">Composer</h1>
			<p class="font-body text-[10px] text-white/30 mt-0.5">Mix any template per slide</p>
		</div>
	</div>

	<!-- ── Slide strip ──────────────────────────────────────────────────────── -->
	<div class="flex-shrink-0 border-b border-white/[0.04] px-3 py-3">
		<div class="flex items-center gap-1.5 mb-2.5">
			<span class="text-[9px] font-mono text-white/25 uppercase tracking-widest flex-1">Slides ({slides.length})</span>
			<button onclick={duplicateSlide} title="Duplicate" class="p-1 rounded-md hover:bg-white/[0.06] text-white/25 hover:text-white/60 transition-colors"><Copy size={11} /></button>
			<button onclick={addSlide} title="New slide" class="p-1 rounded-md hover:bg-white/[0.06] text-white/25 hover:text-white/70 transition-colors"><Plus size={11} /></button>
		</div>

		<div class="flex gap-2 overflow-x-auto pb-1" style="scrollbar-width:none;">
			{#each slides as slide, i (slide.id)}
				{@const tc = tColor(slide.template)}
				{@const music = slideMusic[i] ?? { song: 'No music' }}
				<div class="flex-shrink-0 flex flex-col gap-1">
					<button onclick={() => activeIdx = i}
						class="relative group rounded-xl overflow-hidden border-2 transition-all"
						style="width:{THUMB_W}px;height:{Math.round(THUMB_W*1350/1080)}px;border-color:{i===activeIdx ? tc : 'rgba(255,255,255,0.07)'};">
						<div style="width:{THUMB_W}px;height:{Math.round(THUMB_W*1350/1080)}px;overflow:hidden;pointer-events:none;">
							{#if slide.template==='tweet'}
								<TweetTemplate {...slide.tweet} topText={slide.tweet.topText||'Tweet…'} bottomText={slide.tweet.bottomText||'Reply…'} scale={thumbScale} interactive={false} />
							{:else if slide.template==='text'}
								<TextCarouselTemplate {...slide.text} text={slide.text.text||'Text…'} scale={thumbScale} interactive={false} />
							{:else if slide.template==='article'}
								<ArticleTemplate {...slide.article} text={slide.article.text||'Text…'} scale={thumbScale} interactive={false} />
							{:else if slide.template==='news'}
								<NewsTemplate text={slide.news.text||'Headline…'} backgroundImage={slide.news.backgroundImage} circleImage={slide.news.showCircle?slide.news.circleImage:''} source={slide.news.source} highlightColor={slide.news.highlightColor} textColor={slide.news.textColor} scale={thumbScale} interactive={false} />
							{/if}
						</div>
						<div class="absolute bottom-1 left-1 px-1 py-0.5 rounded text-[7px] font-mono font-bold uppercase" style="background:rgba(0,0,0,0.8);color:{tc};">{slide.template}</div>
						<div class="absolute top-1 left-1 w-4 h-4 rounded-full bg-black/70 flex items-center justify-center"><span class="text-[8px] font-mono text-white/70">{i+1}</span></div>
						{#if slides.length > 1}
							<button onclick={(e)=>{e.stopPropagation();deleteSlide(i);}} class="absolute top-1 right-1 w-4 h-4 rounded-full bg-black/70 hover:bg-red-500/80 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity" aria-label="Delete slide"><Trash2 size={7} class="text-white" /></button>
						{/if}
					</button>

					<!-- Per-slide music -->
					<div class="flex items-center gap-1" style="width:{THUMB_W}px;">
						<select
							value={music.song}
							onchange={(e) => {
								const arr = [...slideMusic];
								arr[i] = { song: (e.target as HTMLSelectElement).value };
								slideMusic = arr;
							}}
							class="flex-1 bg-white/[0.04] border border-white/[0.08] rounded-lg py-1 px-1.5 text-[9px] font-body text-white/60 focus:outline-none focus:border-violet-500/40 transition-colors [color-scheme:dark]"
						>
							{#each SONG_OPTIONS as opt}
								<option value={opt}>{opt}</option>
							{/each}
						</select>
						<button disabled class="px-2 py-1 rounded-lg text-[9px] font-mono text-white/35 bg-white/[0.04] border border-white/[0.08] cursor-not-allowed">
							Burn
						</button>
					</div>
				</div>
			{/each}
			<button onclick={addSlide} class="flex-shrink-0 rounded-xl border-2 border-dashed border-white/[0.08] hover:border-white/25 flex items-center justify-center text-white/20 hover:text-white/50 transition-all" style="width:{THUMB_W}px;height:{Math.round(THUMB_W*1350/1080)}px;"><Plus size={16} /></button>
		</div>

		{#if slides.length > 1}
			<div class="flex items-center justify-center gap-1.5 mt-2">
				{#each slides as _, i (i)}
					<button
						onclick={() => (activeIdx = i)}
						class="w-2 h-2 rounded-full transition-all {i === activeIdx ? 'bg-white/70' : 'bg-white/20 hover:bg-white/35'}"
						aria-label={`Go to slide ${i + 1}`}
					></button>
				{/each}
			</div>
		{/if}
	</div>

	<!-- ── Template selector ────────────────────────────────────────────────── -->
	<div class="flex-shrink-0 px-3 pt-3 pb-3 border-b border-white/[0.04]">
		<p class="text-[9px] font-mono text-white/25 uppercase tracking-widest mb-2">Slide {activeIdx+1} template</p>
		<div class="grid grid-cols-5 gap-1.5">
			{#each TEMPLATES as tmpl}
				{@const active = s.template === tmpl.id}
				<button onclick={() => slides[activeIdx].template = tmpl.id}
					class="flex flex-col items-center gap-1 py-2 rounded-xl text-[10px] font-mono font-semibold transition-all border"
					style="border-color:{active?tmpl.color+'60':'rgba(255,255,255,0.07)'};background:{active?tmpl.color+'14':'transparent'};color:{active?tmpl.color:'rgba(255,255,255,0.3)'};">
					<svelte:component this={tmpl.icon} size={12} />
					{tmpl.label}
				</button>
			{/each}
		</div>
	</div>

	<!-- ── Scrollable form ───────────────────────────────────────────────────── -->
	<div class="flex-1 overflow-y-auto">
	<div class="flex flex-col gap-4 p-4">

	<!-- ════════════════════════ TWEET FORM -->
	{#if s.template === 'tweet'}
		<div>
			<p class="text-[10px] font-mono mb-3 flex items-center gap-1.5" style="color:rgba(56,189,248,0.7);"><span class="w-2 h-2 rounded-full bg-sky-400 inline-block"></span>Original tweet</p>
			<div class="flex items-center gap-3 mb-3">
				<div class="w-9 h-9 rounded-full overflow-hidden bg-white/[0.06] flex-shrink-0 flex items-center justify-center">
					{#if s.tweet.topAvatar}<img src={s.tweet.topAvatar} alt="" class="w-full h-full object-cover" />{:else}<span class="text-[10px] font-bold text-white/30">{s.tweet.topName.replace(/[^\w\s]/g,'').trim()[0]?.toUpperCase()??'?'}</span>{/if}
				</div>
								<label class="flex-1 text-[11px] font-mono text-white/30 border border-white/[0.07] rounded-lg px-2.5 py-1.5 cursor-pointer hover:border-white/20 transition-colors">{s.tweet.topAvatar?'Change':'Upload'} avatar<input type="file" accept="image/*" class="sr-only" onchange={(e)=>upload(e,v=>slides[activeIdx].tweet.topAvatar=v)} /></label>
				{#if s.tweet.topAvatar}<button onclick={()=>slides[activeIdx].tweet.topAvatar=''} class="text-white/20 hover:text-red-400 text-xs">✕</button>{/if}
			</div>
			<div class="flex flex-col gap-2 mb-2">
				<input bind:value={slides[activeIdx].tweet.topName} placeholder="Display name" class="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl py-2 px-3 text-sm font-body text-white placeholder-white/20 focus:outline-none focus:border-sky-500/40 transition-colors" />
				<input bind:value={slides[activeIdx].tweet.topHandle} placeholder="@handle" class="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl py-2 px-3 text-sm font-mono text-white/70 placeholder-white/20 focus:outline-none focus:border-sky-500/40 transition-colors" />
			</div>
			<button onclick={()=>slides[activeIdx].tweet.topVerified=!slides[activeIdx].tweet.topVerified} class="flex items-center gap-2 text-[11px] font-mono mb-3 {s.tweet.topVerified?'text-sky-400':'text-white/30'} hover:text-sky-300 transition-colors">{#if s.tweet.topVerified}<CheckSquare size={12}/>{:else}<Square size={12}/>{/if} Verified</button>
			<textarea bind:value={slides[activeIdx].tweet.topText} rows={3} placeholder="The original tweet…" class="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl py-2.5 px-3 text-sm font-body text-white placeholder-white/20 focus:outline-none focus:border-sky-500/40 transition-colors resize-none leading-relaxed mb-2"></textarea>
			{#if s.tweet.topImage}
				<div class="relative rounded-xl overflow-hidden mb-2"><img src={s.tweet.topImage} alt="" class="w-full h-20 object-cover" /><button onclick={()=>slides[activeIdx].tweet.topImage=''} class="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-black/70 text-white text-xs flex items-center justify-center hover:bg-red-500/80">✕</button></div>
			{:else}
								<label class="flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs text-white/25 border border-dashed border-white/[0.07] hover:border-white/20 cursor-pointer transition-colors mb-2"><Image size={11}/>Attach image<input type="file" accept="image/*" class="sr-only" onchange={(e)=>upload(e,v=>slides[activeIdx].tweet.topImage=v)} /></label>
			{/if}
		</div>
		<div class="border-t border-white/[0.05]"></div>
		<div>
			<p class="text-[10px] font-mono mb-3 flex items-center gap-1.5" style="color:rgba(167,139,250,0.7);"><span class="w-2 h-2 rounded-full bg-violet-400 inline-block"></span>Reply</p>
			<div class="flex items-center gap-3 mb-3">
				<div class="w-9 h-9 rounded-full overflow-hidden bg-white/[0.06] flex-shrink-0 flex items-center justify-center">
					{#if s.tweet.bottomAvatar}<img src={s.tweet.bottomAvatar} alt="" class="w-full h-full object-cover" />{:else}<span class="text-[10px] font-bold text-white/30">{s.tweet.bottomName.trim()[0]?.toUpperCase()??'?'}</span>{/if}
				</div>
								<label class="flex-1 text-[11px] font-mono text-white/30 border border-white/[0.07] rounded-lg px-2.5 py-1.5 cursor-pointer hover:border-white/20 transition-colors">{s.tweet.bottomAvatar?'Change':'Upload'} avatar<input type="file" accept="image/*" class="sr-only" onchange={(e)=>upload(e,v=>slides[activeIdx].tweet.bottomAvatar=v)} /></label>
				{#if s.tweet.bottomAvatar}<button onclick={()=>slides[activeIdx].tweet.bottomAvatar=''} class="text-white/20 hover:text-red-400 text-xs">✕</button>{/if}
			</div>
			<div class="flex flex-col gap-2 mb-2">
				<input bind:value={slides[activeIdx].tweet.bottomName} placeholder="Display name" class="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl py-2 px-3 text-sm font-body text-white placeholder-white/20 focus:outline-none focus:border-violet-500/40 transition-colors" />
				<input bind:value={slides[activeIdx].tweet.bottomHandle} placeholder="@handle" class="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl py-2 px-3 text-sm font-mono text-white/70 placeholder-white/20 focus:outline-none focus:border-violet-500/40 transition-colors" />
			</div>
			<button onclick={()=>slides[activeIdx].tweet.bottomVerified=!slides[activeIdx].tweet.bottomVerified} class="flex items-center gap-2 text-[11px] font-mono mb-3 {s.tweet.bottomVerified?'text-violet-400':'text-white/30'} hover:text-violet-300 transition-colors">{#if s.tweet.bottomVerified}<CheckSquare size={12}/>{:else}<Square size={12}/>{/if} Verified</button>
			<textarea bind:value={slides[activeIdx].tweet.bottomText} rows={3} placeholder="The reply…" class="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl py-2.5 px-3 text-sm font-body text-white placeholder-white/20 focus:outline-none focus:border-violet-500/40 transition-colors resize-none leading-relaxed"></textarea>
		</div>

	<!-- ════════════════════════ TEXT FORM -->
	{:else if s.template === 'text'}
		<div>
			<p class="text-[10px] font-mono text-white/30 uppercase tracking-wider mb-3">Profile</p>
			<div class="flex items-center gap-3 mb-3">
				<div class="w-9 h-9 rounded-full overflow-hidden flex-shrink-0 flex items-center justify-center" style="background:{s.text.bgColor};outline:2px solid {s.text.ringColor};outline-offset:2px;">
					{#if s.text.avatar}<img src={s.text.avatar} alt="" class="w-full h-full object-cover"/>{:else}<span class="text-[10px] font-bold text-white">{s.text.name.replace(/[^\w\s]/g,'').trim().split(/\s+/).map((w:string)=>w[0]?.toUpperCase()??'').slice(0,2).join('')||'?'}</span>{/if}
				</div>
								<label class="flex-1 text-[11px] font-mono text-white/30 border border-white/[0.07] rounded-lg px-2.5 py-1.5 cursor-pointer hover:border-white/20 transition-colors">{s.text.avatar?'Change':'Upload'} avatar<input type="file" accept="image/*" class="sr-only" onchange={(e)=>upload(e,v=>slides[activeIdx].text.avatar=v)} /></label>
				{#if s.text.avatar}<button onclick={()=>slides[activeIdx].text.avatar=''} class="text-white/20 hover:text-red-400 text-xs">✕</button>{/if}
			</div>
			<div class="flex flex-col gap-2">
				<input bind:value={slides[activeIdx].text.name} placeholder="Display name" class="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl py-2 px-3 text-sm font-body text-white placeholder-white/20 focus:outline-none focus:border-white/30 transition-colors" />
				<input bind:value={slides[activeIdx].text.handle} placeholder="@handle" class="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl py-2 px-3 text-sm font-mono text-white/70 placeholder-white/20 focus:outline-none focus:border-white/30 transition-colors" />
			</div>
		</div>
		<div>
			<p class="text-[10px] font-mono text-white/30 uppercase tracking-wider mb-3">Style</p>
			<div class="flex gap-3">
				<div class="flex-1"><p class="text-[10px] font-mono text-white/25 mb-1.5">Background</p><div class="flex items-center gap-2"><input type="color" bind:value={slides[activeIdx].text.bgColor} class="w-8 h-8 rounded-lg cursor-pointer border border-white/10"/><input bind:value={slides[activeIdx].text.bgColor} class="flex-1 bg-white/[0.04] border border-white/[0.08] rounded-lg py-1.5 px-2 text-xs font-mono text-white/70 focus:outline-none"/></div></div>
				<div class="flex-1"><p class="text-[10px] font-mono text-white/25 mb-1.5">Ring</p><div class="flex items-center gap-2"><input type="color" bind:value={slides[activeIdx].text.ringColor} class="w-8 h-8 rounded-lg cursor-pointer border border-white/10"/><input bind:value={slides[activeIdx].text.ringColor} class="flex-1 bg-white/[0.04] border border-white/[0.08] rounded-lg py-1.5 px-2 text-xs font-mono text-white/70 focus:outline-none"/></div></div>
			</div>
		</div>
		<div>
			<div class="flex items-center justify-between mb-2"><p class="text-[10px] font-mono text-white/30 uppercase tracking-wider">Text</p><span class="text-[9px] font-mono text-white/20">blank line = new paragraph</span></div>
			<textarea bind:value={slides[activeIdx].text.text} rows={9} placeholder={"Your text here…\n\nBlank line for new paragraph."} class="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl py-3 px-3 text-sm font-body text-white placeholder-white/20 focus:outline-none focus:border-white/30 transition-colors resize-none leading-relaxed mb-2"></textarea>
			<button onclick={()=>slides[activeIdx].text.showSwipe=!slides[activeIdx].text.showSwipe} class="flex items-center gap-2 text-[11px] font-mono {s.text.showSwipe?'text-white/60':'text-white/25'} hover:text-white/70 transition-colors">{#if s.text.showSwipe}<CheckSquare size={12}/>{:else}<Square size={12}/>{/if} Show swipe indicator</button>
		</div>

	<!-- ════════════════════════ ARTICLE FORM -->
	{:else if s.template === 'article'}
		<div>
			<div class="flex items-center justify-between mb-2"><p class="text-[10px] font-mono text-white/30 uppercase tracking-wider">Text</p><span class="text-[9px] font-mono text-white/20">*word* = accent</span></div>
			<textarea bind:value={slides[activeIdx].article.text} rows={7} placeholder={"Text here…\n\nBlank line = paragraph.\n*Asterisks* = accent color."} class="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl py-3 px-3 text-sm font-body text-white placeholder-white/20 focus:outline-none focus:border-emerald-500/40 transition-colors resize-none leading-relaxed"></textarea>
		</div>
		<div>
			<p class="text-[10px] font-mono text-white/30 uppercase tracking-wider mb-2">Image</p>
			{#if s.article.image}
				<div class="relative rounded-xl overflow-hidden"><img src={s.article.image} alt="" class="w-full h-28 object-cover"/><button onclick={()=>slides[activeIdx].article.image=''} class="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/70 text-white text-xs flex items-center justify-center hover:bg-red-500/80">✕</button></div>
			{:else}
								<label class="flex items-center justify-center gap-2 py-3 rounded-xl text-xs text-white/30 border border-dashed border-white/[0.08] hover:border-emerald-500/30 cursor-pointer transition-colors"><Image size={12}/>Add image (optional)<input type="file" accept="image/*" class="sr-only" onchange={(e)=>upload(e,v=>slides[activeIdx].article.image=v)} /></label>
			{/if}
		</div>
		<div>
			<p class="text-[10px] font-mono text-white/30 uppercase tracking-wider mb-3">Style</p>
			<div class="flex gap-3 mb-3">
				<div class="flex-1"><p class="text-[10px] font-mono text-white/25 mb-1.5">Background</p><div class="flex items-center gap-2"><input type="color" bind:value={slides[activeIdx].article.bgColor} class="w-8 h-8 rounded-lg cursor-pointer border border-white/10"/><input bind:value={slides[activeIdx].article.bgColor} class="flex-1 bg-white/[0.04] border border-white/[0.08] rounded-lg py-1.5 px-2 text-xs font-mono text-white/70 focus:outline-none"/></div></div>
				<div class="flex-1"><p class="text-[10px] font-mono text-white/25 mb-1.5">Accent</p><div class="flex items-center gap-2"><input type="color" bind:value={slides[activeIdx].article.accentColor} class="w-8 h-8 rounded-lg cursor-pointer border border-white/10"/><input bind:value={slides[activeIdx].article.accentColor} class="flex-1 bg-white/[0.04] border border-white/[0.08] rounded-lg py-1.5 px-2 text-xs font-mono text-white/70 focus:outline-none"/></div></div>
			</div>
		</div>
		<div>
			<p class="text-[10px] font-mono text-white/30 uppercase tracking-wider mb-3">Logo</p>
			<div class="flex items-center gap-3 mb-2">
				<div class="w-9 h-9 rounded-full overflow-hidden flex-shrink-0 flex items-center justify-center" style="background:{s.article.bgColor};outline:2px solid {s.article.logoRingColor};outline-offset:2px;">
					{#if s.article.logoSrc}<img src={s.article.logoSrc} alt="" class="w-full h-full object-cover"/>{:else}<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M13 2L4.5 13.5H11L10 22L19.5 10.5H13L13 2Z" fill="{s.article.logoRingColor}" stroke="{s.article.logoRingColor}" stroke-width="0.5" stroke-linejoin="round"/></svg>{/if}
				</div>
								<label class="flex-1 text-[11px] font-mono text-white/30 border border-white/[0.07] rounded-lg px-2.5 py-1.5 cursor-pointer hover:border-white/20 transition-colors">{s.article.logoSrc?'Change':'Upload'} logo<input type="file" accept="image/*" class="sr-only" onchange={(e)=>upload(e,v=>slides[activeIdx].article.logoSrc=v)} /></label>
				{#if s.article.logoSrc}<button onclick={()=>slides[activeIdx].article.logoSrc=''} class="text-white/20 hover:text-red-400 text-xs">✕</button>{/if}
			</div>
			<div class="flex items-center gap-2 mb-3"><input type="color" bind:value={slides[activeIdx].article.logoRingColor} class="w-8 h-8 rounded-lg cursor-pointer border border-white/10"/><input bind:value={slides[activeIdx].article.logoRingColor} class="flex-1 bg-white/[0.04] border border-white/[0.08] rounded-lg py-1.5 px-2 text-xs font-mono text-white/70 focus:outline-none"/></div>
			<button onclick={()=>slides[activeIdx].article.showSwipe=!slides[activeIdx].article.showSwipe} class="flex items-center gap-2 text-[11px] font-mono mb-2 {s.article.showSwipe?'text-emerald-400':'text-white/25'} hover:text-emerald-300 transition-colors">{#if s.article.showSwipe}<CheckSquare size={12}/>{:else}<Square size={12}/>{/if} Swipe pill</button>
			{#if s.article.showSwipe}<input bind:value={slides[activeIdx].article.swipeText} class="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl py-2 px-3 text-sm font-body text-white focus:outline-none focus:border-emerald-500/40 transition-colors"/>{/if}
		</div>

	<!-- ════════════════════════ IMAGE QUOTE FORM -->
	{:else if s.template === 'imageQuote'}
		<div>
			<p class="text-[10px] font-mono text-white/30 uppercase tracking-wider mb-2">Top image</p>
			{#if s.imageQuote.image}
				<div class="relative rounded-xl overflow-hidden mb-2">
					<img src={s.imageQuote.image} alt="" class="w-full h-28 object-cover" />
					<button onclick={() => (slides[activeIdx].imageQuote.image = '')}
						class="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/70 text-white text-xs flex items-center justify-center hover:bg-red-500/80">✕</button>
				</div>
			{/if}
			<label class="flex items-center justify-center gap-2 py-3 rounded-xl text-xs text-white/30 border border-dashed border-white/[0.08] hover:border-white/25 cursor-pointer transition-colors">
				<Image size={12} /> {s.imageQuote.image ? 'Change image' : 'Upload image'}
				<input type="file" accept="image/*" class="sr-only" onchange={(e) => upload(e, (v) => (slides[activeIdx].imageQuote.image = v))} />
			</label>
		</div>

		<div>
			<div class="flex items-center justify-between mb-2">
				<p class="text-[10px] font-mono text-white/30 uppercase tracking-wider">Quote text</p>
				<span class="text-[9px] font-mono text-white/20">new line = forced break</span>
			</div>
			<textarea
				bind:value={slides[activeIdx].imageQuote.text}
				rows={6}
				placeholder={"WRITE YOUR STATEMENT HERE.\nUSE NEWLINES TO CONTROL WRAPPING."}
				class="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl py-3 px-3 text-sm font-body text-white placeholder-white/20 focus:outline-none focus:border-white/30 transition-colors resize-none leading-relaxed"
			></textarea>
		</div>

		<div>
			<p class="text-[10px] font-mono text-white/30 uppercase tracking-wider mb-2">Footer</p>
			<div class="flex gap-2">
				<input bind:value={slides[activeIdx].imageQuote.footerLeft} placeholder="$" class="w-24 bg-white/[0.04] border border-white/[0.08] rounded-xl py-2 px-3 text-sm font-mono text-white/70 placeholder-white/20 focus:outline-none focus:border-white/30 transition-colors" />
				<input bind:value={slides[activeIdx].imageQuote.footerRight} placeholder="BRAND" class="flex-1 bg-white/[0.04] border border-white/[0.08] rounded-xl py-2 px-3 text-sm font-mono text-white/70 placeholder-white/20 focus:outline-none focus:border-white/30 transition-colors" />
			</div>
		</div>

		<div>
			<p class="text-[10px] font-mono text-white/30 uppercase tracking-wider mb-3">Layout</p>
			<div class="flex items-center gap-3">
				<div class="flex-1">
					<p class="text-[10px] font-mono text-white/25 mb-1.5">Image height</p>
					<input
						type="range"
						min="0.40"
						max="0.70"
						step="0.01"
						value={s.imageQuote.topRatio}
						oninput={(e) => (slides[activeIdx].imageQuote.topRatio = parseFloat((e.target as HTMLInputElement).value))}
						class="w-full accent-white"
					/>
					<p class="text-[10px] font-mono text-white/20 mt-1">{Math.round(s.imageQuote.topRatio * 100)}%</p>
				</div>
			</div>
			<div class="flex gap-3 mt-3">
				<div class="flex-1">
					<p class="text-[10px] font-mono text-white/25 mb-1.5">Background</p>
					<div class="flex items-center gap-2">
						<input type="color" bind:value={slides[activeIdx].imageQuote.bgColor} class="w-8 h-8 rounded-lg cursor-pointer border border-white/10" />
						<input bind:value={slides[activeIdx].imageQuote.bgColor} class="flex-1 bg-white/[0.04] border border-white/[0.08] rounded-lg py-1.5 px-2 text-xs font-mono text-white/70 focus:outline-none" />
					</div>
				</div>
				<div class="flex-1">
					<p class="text-[10px] font-mono text-white/25 mb-1.5">Text</p>
					<div class="flex items-center gap-2">
						<input type="color" bind:value={slides[activeIdx].imageQuote.textColor} class="w-8 h-8 rounded-lg cursor-pointer border border-white/10" />
						<input bind:value={slides[activeIdx].imageQuote.textColor} class="flex-1 bg-white/[0.04] border border-white/[0.08] rounded-lg py-1.5 px-2 text-xs font-mono text-white/70 focus:outline-none" />
					</div>
				</div>
			</div>
		</div>

	<!-- ════════════════════════ NEWS FORM -->
	{:else if s.template === 'news'}

		<!-- AI Fetch -->
		<div>
			<p class="text-[10px] font-mono text-white/30 uppercase tracking-wider mb-3">Fetch News</p>
			<div class="flex flex-col gap-2 mb-2">
				<div class="relative">
					<select bind:value={newsCategory} class="w-full appearance-none bg-white/[0.04] border border-white/[0.08] rounded-xl py-2 pl-3 pr-8 text-sm font-body text-white focus:outline-none focus:border-amber-500/40 transition-colors">
						{#each categories as cat}<option value={cat.id}>{cat.label}</option>{/each}
					</select>
					<ChevronDown size={12} class="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none" />
				</div>
				<div class="relative"><Search size={12} class="absolute left-3 top-1/2 -translate-y-1/2 text-white/30"/><input bind:value={newsSearch} placeholder="Search (optional)" class="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl py-2 pl-8 pr-3 text-sm font-body text-white placeholder-white/20 focus:outline-none focus:border-amber-500/40 transition-colors"/></div>
			</div>
			<div class="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06] mb-2">
				<div class="flex items-center gap-2">{#if useTestData}<FlaskConical size={11} class="text-amber-400"/><span class="text-xs font-mono text-amber-400">Test data</span>{:else}<Wifi size={11} class="text-emerald-400"/><span class="text-xs font-mono text-emerald-400">Live API</span>{/if}</div>
				<button onclick={()=>useTestData=!useTestData} class="relative w-9 h-[18px] rounded-full transition-colors duration-200 {useTestData?'bg-amber-500/30':'bg-emerald-500/40'}"><span class="absolute top-0.5 left-0.5 w-3.5 h-3.5 rounded-full shadow transition-transform duration-200 {useTestData?'translate-x-0 bg-amber-400':'translate-x-[18px] bg-emerald-400'}"></span></button>
			</div>
			<button onclick={fetchNewsForSlide} disabled={fetchingNews} class="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold font-body text-white bg-gradient-to-r from-amber-600 to-orange-500 hover:shadow-[0_0_16px_rgba(245,166,35,0.3)] transition-all disabled:opacity-50">
				{#if fetchingNews}<Loader size={13} class="animate-spin"/>Fetching…{:else}<Newspaper size={13}/>Fill this slide{/if}
			</button>
			{#if newsError}<div class="flex items-start gap-2 p-2.5 rounded-xl bg-red-500/10 border border-red-500/20 mt-1"><AlertCircle size={11} class="text-red-400 shrink-0 mt-0.5"/><p class="text-[11px] font-body text-red-400">{newsError}</p></div>{/if}
		</div>

		<div class="border-t border-white/[0.05]"></div>

		<!-- Slide text -->
		<div>
			<p class="text-[10px] font-mono text-white/30 uppercase tracking-wider mb-1.5">Headline text</p>
			<p class="text-[10px] font-body text-white/20 mb-1.5">Use <code class="text-amber-400/70 bg-amber-500/10 px-1 rounded">[[WORD]]</code> to highlight</p>
			<textarea value={s.news.text} oninput={(e)=>slides[activeIdx].news.text=e.currentTarget.value} rows={4} data-slide-text class="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl py-2.5 px-3 text-sm font-body text-white placeholder-white/20 focus:outline-none focus:border-amber-500/40 transition-colors resize-none leading-relaxed"></textarea>
			<input bind:value={slides[activeIdx].news.source} placeholder="Source label" class="w-full mt-2 bg-white/[0.04] border border-white/[0.08] rounded-xl py-2 px-3 text-sm font-body text-white placeholder-white/20 focus:outline-none focus:border-amber-500/40 transition-colors"/>
		</div>

		<!-- Highlights -->
		<div>
			<div class="flex items-center gap-1.5 mb-2"><Palette size={9} class="text-white/30"/><p class="text-[10px] font-mono text-white/30 uppercase tracking-wider">Highlights</p></div>
			<div class="flex rounded-xl overflow-hidden border border-white/[0.07] mb-3">
				<button onclick={()=>slides[activeIdx].news.highlightMode='solid'} class="flex-1 py-1.5 text-[11px] font-mono transition-all {s.news.highlightMode==='solid'?'bg-amber-500/20 text-amber-300':'text-white/30 hover:text-white/50'}">Solid</button>
				<div class="w-px bg-white/[0.07]"></div>
				<button onclick={()=>slides[activeIdx].news.highlightMode='pattern'} class="flex-1 py-1.5 text-[11px] font-mono transition-all {s.news.highlightMode==='pattern'?'bg-amber-500/20 text-amber-300':'text-white/30 hover:text-white/50'}">Pattern</button>
			</div>
			{#if s.news.highlightMode==='solid'}
				<div class="flex items-center gap-2 mb-2">
					{#each ['#F5A623','#08EBFF','#FF3B5C','#A855F7','#10B981','#FFFFFF'] as c}
						<button onclick={()=>{slides[activeIdx].news.highlightColor=c;}} class="w-7 h-7 rounded-lg border-2 transition-all flex-shrink-0 {s.news.highlightColor===c?'border-white scale-110':'border-transparent hover:scale-105'}" style="background:{c};"></button>
					{/each}
					<input type="color" bind:value={slides[activeIdx].news.highlightColor} class="w-8 h-7 rounded-lg cursor-pointer bg-transparent border border-white/[0.08] flex-shrink-0"/>
				</div>
				<div class="flex items-center gap-1.5">
					<span class="text-[10px] font-mono text-white/25 flex-shrink-0">Grad</span>
					{#each [['#F5A623','#FF3B5C'],['#08EBFF','#A855F7'],['#10B981','#08EBFF'],['#FFFFFF','#F5A623']] as [f,t]}
						<button onclick={()=>insertGradient(f,t)} class="h-5 w-9 rounded border border-white/10 hover:scale-105 transition-all" style="background:linear-gradient(90deg,{f},{t});" title="Select text then click"></button>
					{/each}
				</div>
			{:else}
				{#if noSelectionHint}<div class="flex items-center gap-1.5 p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 mb-2"><span class="text-[11px] font-mono text-amber-400">← Select text first</span></div>{/if}
				<div class="grid grid-cols-2 gap-2">
					{#each AVAILABLE_PATTERNS as pat}
						<button onclick={()=>insertPattern(pat.name)} class="flex flex-col items-center gap-1.5 p-2 rounded-xl border bg-white/[0.02] border-white/[0.07] hover:border-white/25 hover:bg-white/[0.05] transition-all overflow-hidden group">
							<div class="w-full h-10 rounded-lg overflow-hidden relative"><img src={pat.url} alt={pat.label} class="absolute inset-0 w-full h-full object-cover"/><div class="absolute inset-0 flex items-center justify-center"><span style="background-image:url('{pat.url}');background-size:cover;background-position:center;-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;font-family:'Bebas Neue',Impact,sans-serif;font-size:22px;letter-spacing:2px;filter:contrast(1.4) brightness(1.2);">WORD</span></div></div>
							<span class="text-[10px] font-mono text-white/40 group-hover:text-white/70 transition-colors">{pat.label}</span>
						</button>
					{/each}
				</div>
			{/if}
			<div class="flex items-center gap-2 mt-3">
				<p class="text-[10px] font-mono text-white/25 flex-shrink-0">Text</p>
				{#each ['#FFFFFF','#F5A623','#08EBFF','#000000'] as c}
					<button onclick={()=>slides[activeIdx].news.textColor=c} class="w-6 h-6 rounded-md border-2 transition-all {s.news.textColor===c?'border-amber-400 scale-110':'border-white/10 hover:scale-105'}" style="background:{c};"></button>
				{/each}
			</div>
		</div>

		<div class="border-t border-white/[0.05]"></div>

		<!-- Background -->
		<div>
			<p class="text-[10px] font-mono text-white/30 uppercase tracking-wider mb-2">Background</p>
			<div class="flex flex-col gap-2">
				<button onclick={generateBg} disabled={s.news.generatingImage} class="flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold font-body text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/15 transition-all disabled:opacity-50">{#if s.news.generatingImage}<Loader size={11} class="animate-spin"/>Generating…{:else}<Sparkles size={11}/>Generate with AI{/if}</button>
				<div class="grid grid-cols-2 gap-2">
					<label class="flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold font-body text-white/40 border border-white/[0.06] hover:border-white/20 cursor-pointer transition-colors"><Image size={11}/>Photo<input type="file" accept="image/*" class="sr-only" onchange={(e)=>upload(e,v=>{slides[activeIdx].news.backgroundImage=v;slides[activeIdx].news.backgroundVideo='';})} /></label>
					<label class="flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold font-body text-white/40 border border-white/[0.06] hover:border-white/20 cursor-pointer transition-colors">▶ Video<input type="file" accept="video/mp4,video/webm,video/quicktime" class="sr-only" onchange={(e)=>{const f=(e.target as HTMLInputElement).files?.[0];if(f){const old=slides[activeIdx].news.backgroundVideo;if(old?.startsWith('blob:'))URL.revokeObjectURL(old);slides[activeIdx].news.backgroundVideo=URL.createObjectURL(f);slides[activeIdx].news.backgroundImage='';}}} /></label>
				</div>
				{#if s.news.backgroundVideo}
					<div class="flex items-center gap-2 px-2.5 py-2 rounded-xl bg-cyan-500/10 border border-cyan-500/20"><span class="text-cyan-400 text-[11px]">▶</span><span class="text-[11px] font-mono text-cyan-300 flex-1 truncate">Video active</span><button onclick={()=>{const old=s.news.backgroundVideo;if(old?.startsWith('blob:'))URL.revokeObjectURL(old);slides[activeIdx].news.backgroundVideo='';}} class="text-white/20 hover:text-red-400 text-xs">✕</button></div>
				{/if}
				{#if s.news.backgroundImage}
					<div class="flex flex-col gap-1.5 pt-1">
						<p class="text-[10px] font-mono text-white/25">Position</p>
						<div class="flex items-center gap-2"><span class="text-[10px] font-mono text-white/30 w-3">←</span><input type="range" min="0" max="100" step="1" bind:value={slides[activeIdx].news.bgOffsetX} class="flex-1 h-1 rounded-full accent-amber-400 cursor-pointer"/><span class="text-[10px] font-mono text-white/30 w-3">→</span></div>
						<div class="flex items-center gap-2"><span class="text-[10px] font-mono text-white/30 w-3">↑</span><input type="range" min="0" max="100" step="1" bind:value={slides[activeIdx].news.bgOffsetY} class="flex-1 h-1 rounded-full accent-amber-400 cursor-pointer"/><span class="text-[10px] font-mono text-white/30 w-3">↓</span></div>
					</div>
				{/if}
			</div>
		</div>

		<!-- Circle badge -->
		<div>
			<div class="flex items-center justify-between mb-2">
				<p class="text-[10px] font-mono text-white/30 uppercase tracking-wider">Circle Badge</p>
				<button onclick={()=>{slides[activeIdx].news.showCircle=!slides[activeIdx].news.showCircle;if(!slides[activeIdx].news.showCircle)slides[activeIdx].news.circleImage='';}} class="relative w-9 h-[18px] rounded-full transition-colors duration-200 {s.news.showCircle?'bg-cyan-500/40':'bg-white/[0.08]'}"><span class="absolute top-0.5 left-0.5 w-3.5 h-3.5 rounded-full shadow transition-transform duration-200 {s.news.showCircle?'translate-x-[18px] bg-cyan-400':'translate-x-0 bg-white/30'}"></span></button>
			</div>
			{#if s.news.showCircle}
				<div class="flex flex-col gap-2">
					{#if s.news.circleImage}
						<div class="flex items-center gap-2 p-2 rounded-xl bg-white/[0.03] border border-white/[0.06]"><img src={s.news.circleImage} alt="" class="w-8 h-8 rounded-full object-cover flex-shrink-0 border border-white/10"/><span class="text-[11px] font-mono text-white/30 flex-1">Circle image</span><button onclick={generateCircle} class="text-white/20 hover:text-cyan-400 transition-colors"><RefreshCw size={11}/></button><button onclick={()=>slides[activeIdx].news.circleImage=''} class="text-white/20 hover:text-red-400 transition-colors">✕</button></div>
					{/if}
					<div class="flex items-center gap-2.5 px-1"><span class="text-[10px] font-mono text-white/30 flex-shrink-0 w-7">Size</span><input type="range" min="128" max="512" step="8" bind:value={slides[activeIdx].news.circleSize} class="flex-1 h-1 rounded-full accent-cyan-400 cursor-pointer"/><span class="text-[10px] font-mono text-white/30 flex-shrink-0 w-7 text-right">{s.news.circleSize}</span></div>
					<button onclick={generateCircle} disabled={s.news.generatingCircle} class="flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold font-body text-cyan-300 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/15 transition-all disabled:opacity-50">{#if s.news.generatingCircle}<Loader size={11} class="animate-spin"/>Generating…{:else}<Sparkles size={11}/>{s.news.circleImage?'Regenerate':'Generate'} with AI{/if}</button>
					<label class="flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold font-body text-white/40 border border-white/[0.06] hover:border-white/20 cursor-pointer transition-colors"><Image size={11}/>Upload image<input type="file" accept="image/*" class="sr-only" onchange={(e)=>upload(e,v=>slides[activeIdx].news.circleImage=v)} /></label>
				</div>
			{/if}
		</div>

		<!-- Image overlays -->
		<div>
			<div class="flex items-center justify-between mb-2"><p class="text-[10px] font-mono text-white/30 uppercase tracking-wider">Image Overlays</p>{#if s.news.overlays.length>0}<span class="text-[10px] font-mono text-white/20">{s.news.overlays.length} layer{s.news.overlays.length!==1?'s':''}</span>{/if}</div>
			<label class="flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold font-body text-white/40 border border-white/[0.08] hover:border-white/20 cursor-pointer transition-colors w-full mb-2"><Image size={11}/>Add PNG / JPG / GIF<input type="file" accept="image/*" class="sr-only" onchange={(e)=>{const f=(e.target as HTMLInputElement).files?.[0];if(!f)return;(e.target as HTMLInputElement).value='';const r=new FileReader();r.onload=()=>{const src=r.result as string;const img=new window.Image();img.onload=()=>{const aspect=img.naturalWidth/img.naturalHeight;const w=Math.min(300,img.naturalWidth);const h=w/aspect;slides[activeIdx].news.overlays=[...slides[activeIdx].news.overlays,{id:crypto.randomUUID(),src,x:Math.round((1080-w)/2),y:Math.round((1350-h)/2),w:Math.round(w),h:Math.round(h)}];};img.src=src;};r.readAsDataURL(f);}} /></label>
			{#if s.news.overlays.length>0}
				<div class="flex flex-col gap-1.5">
					{#each s.news.overlays as ov,i (ov.id)}
						<div class="flex items-center gap-2 p-1.5 rounded-xl bg-white/[0.03] border border-white/[0.06]"><img src={ov.src} alt="" class="w-8 h-8 rounded object-contain bg-white/[0.05] flex-shrink-0"/><div class="flex-1 min-w-0"><p class="text-[11px] font-mono text-white/50 truncate">Layer {i+1}</p><p class="text-[10px] font-body text-white/25">{Math.round(ov.w)}×{Math.round(ov.h)}px</p></div><button onclick={()=>slides[activeIdx].news.overlays=s.news.overlays.filter(o=>o.id!==ov.id)} class="text-white/20 hover:text-red-400 transition-colors p-1">✕</button></div>
					{/each}
				</div>
			{/if}
		</div>

	{/if}

	<div class="border-t border-white/[0.05]"></div>

	<!-- Export -->
	<div class="flex flex-col gap-2 pb-2">
		<button onclick={exportCurrent} disabled={exporting||exportingAll} class="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold font-body text-white bg-white/[0.1] hover:bg-white/[0.15] border transition-all disabled:opacity-50" style="border-color:{tColor(s.template)}40;">
			{#if exporting}<Loader size={13} class="animate-spin"/>Exporting…{:else}<Download size={13}/>Export slide {activeIdx+1}{/if}
		</button>
		{#if slides.length > 1}
			<button onclick={exportAll} disabled={exporting||exportingAll} class="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold font-body text-white/50 bg-white/[0.04] hover:bg-white/[0.07] transition-all disabled:opacity-50">
				{#if exportingAll}<Loader size={13} class="animate-spin"/>Exporting all…{:else}<Download size={13}/>Export all {slides.length} slides{/if}
			</button>
		{/if}
	</div>

	</div>
	</div>
</div>

<!-- Floating Post button -->
<div class="fixed bottom-6 right-6 z-50">
	<button
		onclick={() => goto('/dashboard/post-scheduler')}
		class="flex items-center gap-2 pl-3 pr-4 py-2.5 rounded-2xl text-xs font-semibold font-body shadow-lg transition-all bg-[#1a1a1a] border border-white/[0.12] text-white/70 hover:text-white hover:border-cyan-500/40 hover:bg-[#1e1e1e]"
	>
		<Calendar size={14} /> Post
	</button>
</div>

<!-- ════════════════════════════════════════════════════════════ PREVIEW -->
<div class="flex-1 flex flex-col items-center justify-center bg-[#060606] overflow-auto p-8 gap-4">
	<p class="font-mono text-[10px] text-white/20 uppercase tracking-widest">Slide {activeIdx+1} / {slides.length} — 1080 × 1350</p>

	<div style="width:{PREVIEW_W}px;height:{Math.round(PREVIEW_W*1350/1080)}px;">
		{#if s.template === 'tweet'}
			<TweetTemplate bind:exportRef {...s.tweet} scale={previewScale} />
		{:else if s.template === 'text'}
			<TextCarouselTemplate bind:exportRef {...s.text} scale={previewScale} />
		{:else if s.template === 'article'}
			<ArticleTemplate bind:exportRef {...s.article} scale={previewScale} />
		{:else if s.template === 'imageQuote'}
			<ImageQuoteTemplate
				bind:exportRef
				image={s.imageQuote.image}
				text={s.imageQuote.text}
				footerLeft={s.imageQuote.footerLeft}
				footerRight={s.imageQuote.footerRight}
				topRatio={s.imageQuote.topRatio}
				bgColor={s.imageQuote.bgColor}
				textColor={s.imageQuote.textColor}
				scale={previewScale}
				interactive={true}
			/>
		{:else if s.template === 'news'}
			<NewsTemplate
				bind:exportRef
				bind:circleX={slides[activeIdx].news.circleX}
				bind:circleY={slides[activeIdx].news.circleY}
				bind:circleSize={slides[activeIdx].news.circleSize}
				bind:bgOffsetX={slides[activeIdx].news.bgOffsetX}
				bind:bgOffsetY={slides[activeIdx].news.bgOffsetY}
				bind:textPanelOffsetY={slides[activeIdx].news.textPanelOffsetY}
				backgroundImage={s.news.backgroundImage}
				backgroundVideo={s.news.backgroundVideo}
				circleImage={s.news.showCircle ? s.news.circleImage : ''}
				text={s.news.text}
				source={s.news.source}
				highlightColor={s.news.highlightColor}
				textColor={s.news.textColor}
				overlays={s.news.overlays}
				onTextChange={(t) => slides[activeIdx].news.text = t}
				onCircleMove={(x,y) => { slides[activeIdx].news.circleX=x; slides[activeIdx].news.circleY=y; }}
				onOverlaysChange={(o) => slides[activeIdx].news.overlays = o}
				scale={previewScale}
				interactive={true}
			/>
		{/if}
	</div>

	{#if slides.length > 1}
		<div class="flex items-center gap-3 mt-1">
			<button onclick={()=>activeIdx=Math.max(0,activeIdx-1)} disabled={activeIdx===0} class="px-3 py-1.5 rounded-lg text-xs font-mono text-white/40 hover:text-white/80 bg-white/[0.04] hover:bg-white/[0.08] disabled:opacity-25 transition-all">← Prev</button>
			<span class="text-[10px] font-mono text-white/20">{activeIdx+1} / {slides.length}</span>
			<button onclick={()=>activeIdx=Math.min(slides.length-1,activeIdx+1)} disabled={activeIdx===slides.length-1} class="px-3 py-1.5 rounded-lg text-xs font-mono text-white/40 hover:text-white/80 bg-white/[0.04] hover:bg-white/[0.08] disabled:opacity-25 transition-all">Next →</button>
		</div>
	{/if}
</div>

</div>

<style>
	select option { background: #1a1a1a; color: #f8f8f8; }
</style>
