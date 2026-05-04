<script lang="ts">
	import { supabase } from '$lib/supabase';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { STARTER_TEMPLATES } from '$lib/templates';
	import { stripMarkup } from '$lib/highlight';
	import { coerceTemplateId, STUDIO_TEMPLATES } from '$lib/studio/template-ids';

	/** Must match `DRAFT_KIND` in `dashboard/studio/+page.svelte` (workspace autosave rows). */
	const STUDIO_WORKSPACE_DRAFT_KIND = 'news_studio';
	import TweetTemplate from '$lib/components/templates/TweetTemplate.svelte';
	import TextCarouselTemplate from '$lib/components/templates/TextCarouselTemplate.svelte';
	import ArticleTemplate from '$lib/components/templates/ArticleTemplate.svelte';
	// ImageQuoteTemplate removed from public templates
	import { ImagePlus, Plus, Trash2, Edit2, Clock, CheckCircle, FileText, Loader, ArrowRight, Wand2 } from 'lucide-svelte';

	let carousels: any[] = $state([]);
	let studioDrafts = $state<{ id: string; updated_at: string; state?: Record<string, unknown> }[]>([]);
	let loading = $state(true);
	let creating = $state(false);
	let createError = $state('');
	let userId = $state('');

	// Preview scale for template cards — fixed 220px preview width
	let templatesWrapEl = $state<HTMLDivElement | null>(null);
	let templateCols = $state(5);
	let templateCardW = $state(220);
	const templateScale = $derived(templateCardW / 1080);

	onMount(() => {
		const el = templatesWrapEl;
		if (!el) return;
		const GAP = 16; // px
		const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

		const compute = (w: number) => {
			const cols =
				w >= 1560 ? 6 :
				w >= 1240 ? 5 :
				w >= 980  ? 4 :
				w >= 720  ? 3 :
				2;
			templateCols = cols;
			const card = (w - GAP * (cols - 1)) / cols;
			templateCardW = Math.round(clamp(card, 180, 260));
		};

		const ro = new ResizeObserver((entries) => {
			const cr = entries[0]?.contentRect;
			if (!cr) return;
			compute(cr.width);
		});
		ro.observe(el);
		// Initial pass
		compute(el.getBoundingClientRect().width);
		return () => ro.disconnect();
	});

	function studioDraftTitle(d: { state?: Record<string, unknown> }): string {
		const slides = d.state?.slides;
		if (Array.isArray(slides) && slides.length) {
			const t = stripMarkup(String(slides[0] ?? '')).trim().replace(/\s+/g, ' ');
			if (t) return t.length > 72 ? `${t.slice(0, 69)}…` : t;
		}
		const src = d.state?.source;
		if (typeof src === 'string' && src.trim()) {
			const t = src.trim();
			return t.length > 72 ? `${t.slice(0, 69)}…` : t;
		}
		return 'Studio draft';
	}

	function isLightHex(hex: string): boolean {
		const m = /^#?([0-9a-f]{6})$/i.exec(String(hex ?? '').trim());
		if (!m) return false;
		const v = parseInt(m[1], 16);
		const r = (v >> 16) & 0xff;
		const g = (v >> 8) & 0xff;
		const b = v & 0xff;
		const L = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
		return L > 0.62;
	}

	function strArr(v: unknown): string[] {
		return Array.isArray(v) ? v.map((x) => String(x ?? '')) : [];
	}

	function templateLabelFromId(id: string): string {
		const t = coerceTemplateId(id);
		return STUDIO_TEMPLATES.find((x) => x.id === t)?.label ?? t;
	}

	type StudioDraftPreview = {
		templateLabel: string;
		headline: string;
		textColor: string;
		bgSolid: string;
		heroUrl: string;
		slideCount: number;
		slideHints: string[];
		/** Filmstrip chips on light previews (tweet / light news) */
		filmLight: boolean;
	};

	function studioDraftPreview(d: { state?: Record<string, unknown> }): StudioDraftPreview {
		const s = d.state ?? {};
		const slideList = strArr(s.slides);
		const slideCount = Math.max(1, slideList.length);
		const templates = strArr(s.slideTemplates);
		const tpl = coerceTemplateId(templates[0] ?? 'news');
		const templateLabel = templateLabelFromId(templates[0] ?? tpl);

		const bgMap = (s.bgImagesByTemplate ?? {}) as Record<string, string[]>;
		const pickHero = (key: string) => {
			const u = String(bgMap[key]?.[0] ?? '').trim();
			return u.startsWith('http://') || u.startsWith('https://') ? u : '';
		};

		let headline = '';
		if (tpl === 'tweet') {
			headline = stripMarkup(String(strArr(s.tweetTopTextBySlide)[0] ?? '')).trim();
		} else if (tpl === 'blackText') {
			headline = stripMarkup(String(strArr(s.blackTextHeadlineBySlide)[0] ?? '')).trim();
		} else if (tpl === 'textCarousel') {
			headline = stripMarkup(String(strArr(s.textCarouselTextBySlide)[0] ?? '')).trim();
		} else if (tpl === 'videoStory') {
			headline = stripMarkup(String(strArr(s.videoStoryHeadlineBySlide)[0] ?? '')).trim();
		} else if (tpl === 'imageQuote') {
			headline = stripMarkup(String(strArr(s.imageQuoteTextBySlide)[0] ?? '')).trim();
		} else if (tpl === 'article') {
			headline = stripMarkup(String(strArr(s.articleTextBySlide)[0] ?? '')).trim();
		} else {
			headline = stripMarkup(String(slideList[0] ?? '')).trim();
		}
		if (!headline) headline = studioDraftTitle(d);

		const stripLen = Math.min(slideCount, 10);
		const slideHints = Array.from({ length: stripLen }, (_, i) => {
			const raw = stripMarkup(String(slideList[i] ?? '')).trim();
			return raw ? raw.slice(0, 2).toUpperCase() : '·';
		});

		let bgSolid = '#111111';
		let textColor = '#f5f5f5';
		let heroUrl = '';

		if (tpl === 'news') {
			heroUrl = pickHero('news');
			const solid = String(strArr(s.newsSolidBgBySlide)[0] ?? '').trim();
			bgSolid = solid || (heroUrl ? '#0a0a0a' : '#ffffff');
			const tc = String(s.textColor ?? '').trim();
			if (tc) {
				textColor = tc;
			} else if (heroUrl) {
				textColor = '#ffffff';
			} else {
				textColor = isLightHex(bgSolid) ? '#0a0a0a' : '#f5f5f5';
			}
		} else if (tpl === 'tweet') {
			bgSolid = '#ffffff';
			textColor = '#0a0a0a';
			heroUrl = pickHero('tweet');
		} else if (tpl === 'blackText') {
			bgSolid = '#000000';
			textColor = '#e5e5e5';
			heroUrl = pickHero('blackText');
		} else if (tpl === 'textCarousel') {
			bgSolid = '#0a0a0a';
			textColor = '#f5f5f5';
		} else if (tpl === 'videoStory') {
			bgSolid = '#0a0a0a';
			textColor = '#fafafa';
			heroUrl = pickHero('videoStory');
		} else if (tpl === 'imageQuote') {
			bgSolid = '#0f172a';
			textColor = '#fafafa';
			heroUrl = pickHero('imageQuote');
		} else if (tpl === 'article') {
			bgSolid = '#fafafa';
			textColor = '#0a0a0a';
			heroUrl = pickHero('article');
		}

		const filmLight =
			tpl === 'tweet' ||
			(tpl === 'article' && !heroUrl) ||
			(tpl === 'news' && !heroUrl && isLightHex(bgSolid));

		return { templateLabel, headline, textColor, bgSolid, heroUrl, slideCount, slideHints, filmLight };
	}

	async function deleteStudioDraft(id: string) {
		if (!confirm('Delete this studio draft? This cannot be undone.')) return;
		const { error } = await (supabase as any)
			.from('drafts')
			.delete()
			.eq('id', id)
			.eq('user_id', userId)
			.eq('kind', STUDIO_WORKSPACE_DRAFT_KIND);
		if (error) {
			alert(error.message ?? 'Could not delete draft');
			return;
		}
		studioDrafts = studioDrafts.filter((x) => x.id !== id);
	}

	onMount(async () => {
		const { data: { user } } = await supabase.auth.getUser();
		if (!user) { goto('/login'); return; }
		userId = user.id;

		const [carouselRes, draftRes] = await Promise.all([
			(supabase as any).from('carousels').select('*').order('updated_at', { ascending: false }),
			(supabase as any)
				.from('drafts')
				.select('id,updated_at,state')
				.eq('user_id', user.id)
				.eq('kind', STUDIO_WORKSPACE_DRAFT_KIND)
				.order('updated_at', { ascending: false })
				.limit(40),
		]);
		carousels = carouselRes.data ?? [];
		studioDrafts = draftRes.data ?? [];
		loading = false;
	});

	async function createNew() {
		creating = true;
		createError = '';
		const { data, error } = await (supabase as any).from('carousels').insert({
			user_id: userId,
			title: 'Untitled carousel',
			status: 'draft',
			slides: JSON.stringify([
				{ id: '1', text: 'Your hook here', type: 'hook', bg: '#0f172a', textColor: '#ffffff', align: 'center', bold: true, fontSize: 32 },
				{ id: '2', text: 'Key insight or point', type: 'body', bg: '#111111', textColor: '#f8f8f8', align: 'center', bold: false, fontSize: 28 },
				{ id: '3', text: 'Another key point', type: 'body', bg: '#111111', textColor: '#f8f8f8', align: 'center', bold: false, fontSize: 28 },
				{ id: '4', text: 'Follow for more!', type: 'cta', bg: '#0a0a0a', textColor: '#8B5CF6', align: 'center', bold: true, fontSize: 30 },
			]),
		}).select().single();
		creating = false;
		if (error) { createError = error.message; return; }
		if (data) goto(`/dashboard/editor/${data.id}`);
	}

	async function deleteCarousel(id: string) {
		if (!confirm('Delete this carousel?')) return;
		await (supabase as any).from('carousels').delete().eq('id', id);
		carousels = carousels.filter(c => c.id !== id);
	}

	const statusIcon: Record<string, any> = { draft: FileText, published: CheckCircle, scheduled: Clock };
	const statusColor: Record<string, string> = {
		draft: 'text-white/30',
		published: 'text-cyan-400',
		scheduled: 'text-violet-400',
	};

	let filterTab = $state<'all' | 'draft' | 'published' | 'scheduled'>('all');
	let uiTheme = $state<'light' | 'dark'>('light');

	onMount(() => {
		const readTheme = (): 'light' | 'dark' => (document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light');
		uiTheme = readTheme();
		const obs = new MutationObserver(() => { uiTheme = readTheme(); });
		obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
		return () => obs.disconnect();
	});

	const filteredCarousels = $derived(
		filterTab === 'all' ? carousels : carousels.filter(c => c.status === filterTab)
	);

	const counts = $derived({
		all: carousels.length,
		draft: carousels.filter(c => c.status === 'draft').length,
		published: carousels.filter(c => c.status === 'published').length,
		scheduled: carousels.filter(c => c.status === 'scheduled').length,
	});

	function timeAgo(dateStr: string): string {
		const d = new Date(dateStr);
		const diff = Date.now() - d.getTime();
		const m = Math.floor(diff / 60000);
		if (m < 1) return 'just now';
		if (m < 60) return `${m}m ago`;
		const h = Math.floor(m / 60);
		if (h < 24) return `${h}h ago`;
		return `${Math.floor(h / 24)}d ago`;
	}
</script>

<div class="page-wrap">

	<!-- ── Header ─────────────────────────────────────────────────────────── -->
	<div class="page-header">
		<div>
			<h1 class="page-title">Carousels</h1>
		</div>
		<button onclick={createNew} disabled={creating}
			class="create-btn">
			{#if creating}<Loader size={13} class="spin" />{:else}<Plus size={14} />{/if}
			New carousel
		</button>
	</div>

	{#if createError}
		<div style="margin-bottom:1rem;padding:0.75rem 1rem;border-radius:10px;background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.2);font-size:0.8125rem;color:#f87171;">
			⚠ {createError}
		</div>
	{/if}

	<!-- ── Starter Templates ───────────────────────────────────────────────── -->
	<div class="templates-section">

		<div
			bind:this={templatesWrapEl}
			class="templates-grid"
			style="--cols:{templateCols}; --cardw:{templateCardW}px;"
		>
			{#each STARTER_TEMPLATES.filter((t) => t.id !== 'image-quote') as tmpl}
				{@const hoverClass =
						tmpl.id === 'empty'   ? 'hover:border-neutral-400/35 hover:shadow-[0_0_24px_rgba(115,115,115,0.10)]'
						: tmpl.id === 'tweet'   ? 'hover:border-sky-500/40 hover:shadow-[0_0_28px_rgba(14,165,233,0.12)]'
						: tmpl.id === 'text'  ? 'hover:border-white/25 hover:shadow-[0_0_28px_rgba(255,255,255,0.06)]'
						: tmpl.id === 'black-text' ? 'hover:border-sky-500/35 hover:shadow-[0_0_28px_rgba(14,165,233,0.10)]'
						: tmpl.id === 'article' ? 'hover:border-emerald-500/40 hover:shadow-[0_0_28px_rgba(52,211,153,0.12)]'
						: tmpl.id === 'brand' ? 'hover:border-violet-500/40 hover:shadow-[0_0_28px_rgba(139,92,246,0.15)]'
						: 'hover:border-amber-500/40 hover:shadow-[0_0_28px_rgba(245,166,35,0.12)]'}
				{@const arrowColor =
						tmpl.id === 'empty'   ? 'group-hover:text-neutral-400'
						: tmpl.id === 'tweet'   ? 'group-hover:text-sky-400'
						: tmpl.id === 'text'  ? 'group-hover:text-white/70'
						: tmpl.id === 'black-text' ? 'group-hover:text-sky-400'
						: tmpl.id === 'article' ? 'group-hover:text-emerald-400'
						: tmpl.id === 'brand' ? 'group-hover:text-violet-400'
						: 'group-hover:text-amber-400'}
				<a
					href={tmpl.href}
					class="tmpl-card group flex flex-col rounded-2xl overflow-hidden transition-all duration-200 flex-shrink-0 {hoverClass}"
					style="width: 100%;"
				>
					<!-- Preview area -->
					<div style="width: 100%; height: {Math.round(templateCardW * 1350/1080)}px; overflow: hidden; flex-shrink: 0; position: relative; display: flex; align-items: center; justify-content: center;">
						{#if tmpl.id === 'empty'}
							<div
								class="absolute inset-0 flex flex-col items-center justify-center gap-2 pointer-events-none select-none"
								style="background: {uiTheme === 'dark' ? 'rgba(23,23,23,0.92)' : '#fafafa'}; border: 2px dashed {uiTheme === 'dark' ? 'rgba(163,163,163,0.35)' : 'rgba(163,163,163,0.55)'};"
							>
								<span
									class="text-[9px] font-mono uppercase tracking-[0.2em]"
									style="color: {uiTheme === 'dark' ? 'rgba(163,163,163,0.65)' : 'rgba(115,115,115,0.85)'};"
								>Blank canvas</span>
								<span
									class="text-[8px] font-body max-w-[75%] text-center leading-snug"
									style="color: {uiTheme === 'dark' ? 'rgba(163,163,163,0.45)' : 'rgba(115,115,115,0.55)'};"
								>Opens Studio with no placeholder copy or media</span>
							</div>
						{:else if tmpl.id === 'news'}
							<img
								src={tmpl.previewBg}
								alt=""
								class="absolute inset-0 h-full w-full object-cover pointer-events-none select-none"
								loading="lazy"
								draggable="false"
							/>
						{:else if tmpl.id === 'tweet'}
							<TweetTemplate
								templateTheme={uiTheme}
								topName="Chef 👨‍🍳"
								topHandle="@chefsevenn"
								topVerified={true}
								topText="Ketchup or mayo or mustard?"
								bottomName="Mo Mohler"
								bottomHandle="@MoMohler"
								bottomVerified={true}
								bottomText="3 straight misses chef. These appear to be French fries."
								scale={templateScale}
							/>
						{:else if tmpl.id === 'text'}
							{#if tmpl.previewBg}
								<img
									src={tmpl.previewBg}
									alt=""
									class="absolute inset-0 h-full w-full object-cover pointer-events-none select-none"
									loading="lazy"
									draggable="false"
								/>
							{:else}
								<TextCarouselTemplate
									templateTheme={uiTheme}
									name="Captains of industry"
									handle="@captainsofindustryy"
									text={"Lead with a sharp hook on the first line.\n\nUse the second beat for proof, tone, or a CTA — keep it scannable."}
									showSwipe={false}
									scale={templateScale}
									interactive={false}
								/>
							{/if}
						{:else if tmpl.id === 'black-text'}
							{#if tmpl.previewBg}
								<img
									src={tmpl.previewBg}
									alt=""
									class="absolute inset-0 h-full w-full object-cover pointer-events-none select-none"
									loading="lazy"
									draggable="false"
								/>
							{/if}
						{:else if tmpl.id === 'article'}
							<ArticleTemplate
								templateTheme={uiTheme}
								text={"Here's the trillion-dollar problem everyone avoids.\n\nA *1-gigawatt AI data center* costs roughly *$80B* to build & operate."}
								showSwipe={true}
								scale={templateScale}
								interactive={false}
							/>
						{:else if tmpl.id === 'brand'}
							<!-- Slideshows static preview -->
							<div style="
								width: 100%; height: 100%;
								background: {uiTheme === 'dark'
									? 'linear-gradient(135deg, #0f0a1e 0%, #1a0f3a 45%, #0d1a2e 100%)'
									: 'linear-gradient(135deg, #ffffff 0%, #f4f2ff 45%, #eef6ff 100%)'};
								display: flex; flex-direction: column;
								align-items: center; justify-content: center;
								gap: 14px; padding: 20px; position: relative; overflow: hidden;
							">
								<!-- Background glow -->
								<div style="position:absolute;top:-30px;left:50%;transform:translateX(-50%);width:140px;height:140px;border-radius:50%;background:{uiTheme === 'dark' ? 'rgba(139,92,246,0.15)' : 'rgba(124,58,237,0.12)'};filter:blur(40px);pointer-events:none;"></div>

								<!-- Icon -->
								<div style="
									width: 44px; height: 44px; border-radius: 14px;
									background: {uiTheme === 'dark' ? 'rgba(139,92,246,0.2)' : 'rgba(124,58,237,0.10)'};
									border: 1.5px solid {uiTheme === 'dark' ? 'rgba(139,92,246,0.4)' : 'rgba(124,58,237,0.22)'};
									display: flex; align-items: center; justify-content: center;
									position: relative; z-index: 1;
								">
									<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="{uiTheme === 'dark' ? 'rgba(167,139,250,1)' : 'rgba(124,58,237,0.95)'}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
										<path d="M15 3h6v6M14 10l6.1-6.1M9 21H3v-6M10 14l-6.1 6.1"/>
										<path d="m3 3 18 18" opacity="0"/>
										<circle cx="12" cy="12" r="3"/>
										<path d="M12 2v2M12 20v2M2 12h2M20 12h2"/>
									</svg>
								</div>

								<!-- Slide strip preview -->
								<div style="display:flex; gap:5px; position:relative;z-index:1;">
									{#each [
										{ bg: '#FDFCF8', label: 'HERO', accent: '#8B5CF6' },
										{ bg: '#1A0F3A', label: 'PROB', accent: '#c4b5fd' },
										{ bg: '#F8F9FA', label: 'TIP', accent: '#8B5CF6' },
										{ bg: '#1A0F3A', label: 'CTA', accent: '#c4b5fd' },
									] as slide}
										<div style="
											width: 34px; height: 43px; border-radius: 4px;
											background: {slide.bg};
											border: 1px solid {uiTheme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(15,23,42,0.10)'};
											display: flex; flex-direction: column;
											align-items: center; justify-content: center; gap: 3px;
											flex-shrink: 0;
										">
											<div style="width: 20px; height: 2px; background: {slide.accent}; border-radius: 1px;"></div>
											<div style="width: 16px; height: 1.5px; background: {slide.accent}; opacity: 0.5; border-radius: 1px;"></div>
											<div style="width: 18px; height: 1.5px; background: {slide.accent}; opacity: 0.3; border-radius: 1px;"></div>
										</div>
									{/each}
									<div style="
										width: 34px; height: 43px; border-radius: 4px;
										border: 1px dashed {uiTheme === 'dark' ? 'rgba(139,92,246,0.3)' : 'rgba(124,58,237,0.30)'};
										display: flex; align-items: center; justify-content: center;
										flex-shrink: 0;
									">
										<span style="font-size:14px;color:{uiTheme === 'dark' ? 'rgba(139,92,246,0.4)' : 'rgba(124,58,237,0.45)'};">+</span>
									</div>
								</div>

								<!-- Color swatches -->
								<div style="display:flex;gap:4px;position:relative;z-index:1;">
									{#each ['#8B5CF6','#C4B5FD','#1A0F3A','#F8F9FA','#FDFCF8'] as swatch}
										<div style="width:14px;height:14px;border-radius:50%;background:{swatch};border:1px solid {uiTheme === 'dark' ? 'rgba(255,255,255,0.15)' : 'rgba(15,23,42,0.12)'};flex-shrink:0;"></div>
									{/each}
									<div style="width:14px;height:14px;border-radius:50%;border:1.5px dashed {uiTheme === 'dark' ? 'rgba(255,255,255,0.2)' : 'rgba(15,23,42,0.16)'};flex-shrink:0;display:flex;align-items:center;justify-content:center;">
										<span style="font-size:8px;color:{uiTheme === 'dark' ? 'rgba(255,255,255,0.3)' : 'rgba(15,23,42,0.35)'};">+</span>
									</div>
								</div>

								<!-- Label -->
								<div style="position:relative;z-index:1;text-align:center;">
									<p style="font-family:'Nunito Sans',sans-serif;font-size:10px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:{uiTheme === 'dark' ? 'rgba(167,139,250,0.8)' : 'rgba(124,58,237,0.70)'};margin-bottom:2px;">Upload images</p>
									<p style="font-family:'Nunito Sans',sans-serif;font-size:9px;color:{uiTheme === 'dark' ? 'rgba(255,255,255,0.25)' : 'rgba(15,23,42,0.40)'};letter-spacing:0.04em;">AI copies your brand style</p>
								</div>

								<!-- Bottom bar in preview -->
								<div style="
									position:absolute;bottom:0;left:0;right:0;
									padding: 8px 12px;
									background: {uiTheme === 'dark'
										? 'linear-gradient(to top, rgba(15,10,30,0.95), transparent)'
										: 'linear-gradient(to top, rgba(255,255,255,0.92), transparent)'};
								">
									<div style="display:flex;gap:4px;">
										{#each [30,60,45,70,50] as w}
											<div style="height:2px;flex:{w};background:{uiTheme === 'dark' ? 'rgba(139,92,246,0.4)' : 'rgba(124,58,237,0.35)'};border-radius:1px;"></div>
										{/each}
									</div>
								</div>
							</div>
						{/if}
					</div>

					<!-- Card footer -->
					<div class="tmpl-footer px-3 py-2.5 flex items-center justify-between gap-2 border-t">
						<div class="min-w-0">
							<p class="tmpl-title text-xs font-display font-semibold truncate">{tmpl.name}</p>
							<p class="tmpl-desc text-[10px] font-body truncate leading-tight">{tmpl.description}</p>
						</div>
						<ArrowRight size={13} class="tmpl-arrow {arrowColor} group-hover:translate-x-0.5 transition-all flex-shrink-0" />
					</div>
				</a>
			{/each}

			<!-- "More coming" placeholder -->
			<div class="tmpl-more flex flex-col items-center justify-center rounded-2xl border-2 border-dashed flex-shrink-0"
				style="width: 100%; height: {Math.round(templateCardW * 1350/1080) + 46}px; display: flex;">
				<Plus size={18} class="mb-2 opacity-40" />
				<span class="text-[10px] font-mono">More templates soon</span>
			</div>
		</div>
	</div>

	{#if studioDrafts.length > 0}
		<div class="studio-drafts-block">
			<div class="studio-drafts-head">
				<h2 class="studio-drafts-title">Studio drafts</h2>
				<p class="studio-drafts-sub">
					Workspace saves from News Studio — same card layout as your carousels. Open to edit, or delete when you no longer need a snapshot.
				</p>
			</div>
			<div class="carousel-grid studio-drafts-grid">
				{#each studioDrafts as d}
					{@const pv = studioDraftPreview(d)}
					<div
						class="carousel-card group studio-draft-card"
						style="--card-bg: {pv.bgSolid}; --card-color: {pv.textColor};"
					>
						<a
							href="/dashboard/studio?draft={d.id}"
							class="card-preview studio-draft-card-preview"
							style={pv.heroUrl ? '' : `background-color: ${pv.bgSolid};`}
						>
							{#if pv.heroUrl}
								<img src={pv.heroUrl} alt="" class="studio-draft-bg-img" referrerpolicy="no-referrer" />
								<div class="studio-draft-bg-scrim" aria-hidden="true"></div>
							{/if}
							<p class="card-preview-text studio-draft-preview-headline" style="color: {pv.textColor};">
								{pv.headline}
							</p>
							<div
								class="studio-draft-filmstrip"
								class:studio-draft-filmstrip--light={pv.filmLight}
								aria-hidden="true"
							>
								{#each pv.slideHints as hint, i}
									<div
										class="studio-draft-film-cell"
										class:studio-draft-film-cell--on={i === 0}
										title="Slide {i + 1}"
									>
										<span class="studio-draft-film-hint">{hint}</span>
									</div>
								{/each}
							</div>
						</a>

						<div class="slide-count">{pv.slideCount} slides</div>
						<div class="studio-draft-template-pill">{pv.templateLabel}</div>

						<div class="card-footer">
							<div class="card-info">
								<p class="card-title-text">{studioDraftTitle(d)}</p>
								<p class="card-time">Updated {timeAgo(d.updated_at)}</p>
							</div>
							<div class="card-actions">
								<a href="/dashboard/studio?draft={d.id}" class="card-action card-action--edit" title="Open in Studio">
									<Edit2 size={11} />
								</a>
								<button
									type="button"
									class="card-action card-action--delete"
									title="Delete draft"
									onclick={() => void deleteStudioDraft(d.id)}
								>
									<Trash2 size={11} />
								</button>
							</div>
						</div>
					</div>
				{/each}
			</div>
		</div>
	{/if}

	<!-- ── Divider ────────────────────────────────────────────────────────── -->
	<div class="section-divider"></div>

	<!-- ── Your Carousels ─────────────────────────────────────────────────── -->
	<div class="library-header">
		<h2 class="library-title">Your Carousels</h2>

		<!-- Filter tabs -->
		<div class="filter-tabs">
			{#each [
				{id: 'all',       label: 'All',       count: counts.all},
				{id: 'draft',     label: 'Drafts',    count: counts.draft},
				{id: 'published', label: 'Published', count: counts.published},
				{id: 'scheduled', label: 'Scheduled', count: counts.scheduled},
			] as t}
				<button
					type="button"
					class="filter-tab {filterTab === t.id ? 'filter-tab--on' : ''}"
					onclick={() => filterTab = t.id as typeof filterTab}
				>
					{t.label}
					{#if t.count > 0}
						<span class="filter-count">{t.count}</span>
					{/if}
				</button>
			{/each}
		</div>
	</div>

	{#if loading}
		<div class="carousel-grid">
			{#each Array(6) as _}
				<div class="skeleton-card"></div>
			{/each}
		</div>
	{:else if filteredCarousels.length === 0 && carousels.length === 0}
		<div class="empty-state">
			<div class="empty-icon">
				<ImagePlus size={22} />
			</div>
			<h3 class="empty-title">No carousels yet</h3>
			<p class="empty-desc">Pick a template above or create a blank carousel.</p>
			<button onclick={createNew}
				class="empty-cta">
				<Plus size={14} /> Create blank carousel
			</button>
		</div>
	{:else if filteredCarousels.length === 0}
		<div class="empty-state">
			<div class="empty-icon"><FileText size={22} /></div>
			<h3 class="empty-title">No {filterTab} carousels</h3>
			<p class="empty-desc">You don't have any {filterTab} carousels yet.</p>
		</div>
	{:else}
		<div class="carousel-grid">
			{#each filteredCarousels as c}
				{@const slides = (() => { try { return JSON.parse(typeof c.slides === 'string' ? c.slides : JSON.stringify(c.slides)); } catch { return []; } })()}
				{@const firstSlide = slides[0]}
				<div class="carousel-card group"
					style="--card-bg: {firstSlide?.bg ?? '#111111'}; --card-color: {firstSlide?.textColor ?? '#ffffff'}">

					<!-- Preview -->
					<a href="/dashboard/editor/{c.id}" class="card-preview">
						<p class="card-preview-text">
							{firstSlide?.text || 'Untitled'}
						</p>
					</a>

					<!-- Slide count badge -->
					<div class="slide-count">
						{slides.length} slides
					</div>

					<!-- Status badge -->
					<div class="card-status status-{c.status}">
						<svelte:component this={statusIcon[c.status] ?? FileText} size={9} />
						{c.status}
					</div>

					<!-- Bottom bar -->
					<div class="card-footer">
						<div class="card-info">
							<p class="card-title-text">{c.title}</p>
							<p class="card-time">{timeAgo(c.updated_at ?? c.created_at)}</p>
						</div>
						<div class="card-actions">
							<a href="/dashboard/editor/{c.id}" class="card-action card-action--edit">
								<Edit2 size={11} />
							</a>
							<button onclick={() => deleteCarousel(c.id)} class="card-action card-action--delete">
								<Trash2 size={11} />
							</button>
						</div>
					</div>
				</div>
			{/each}

			<!-- New blank card -->
			<button onclick={createNew} disabled={creating}
				class="new-card-btn">
				<div class="new-card-icon">
					<Plus size={18} />
				</div>
				<span class="new-card-label">New carousel</span>
			</button>
		</div>
	{/if}
</div>

<style>
	:root:not([data-theme="dark"]) {
		--panel-bg: color-mix(in oklab, var(--app-text) 3%, transparent);
		--panel-bg-2: color-mix(in oklab, var(--app-text) 5%, transparent);
		--panel-border: var(--app-border);
		--panel-border-hover: var(--app-border-hover);
		--t-strong: var(--app-text);
		--t: var(--app-text-2);
		--t-muted: var(--app-text-3);
	}
	:root[data-theme="dark"] {
		--panel-bg: rgba(255,255,255,0.02);
		--panel-bg-2: rgba(255,255,255,0.04);
		--panel-border: rgba(255,255,255,0.06);
		--panel-border-hover: rgba(255,255,255,0.15);
		--t-strong: rgba(255,255,255,0.92);
		--t: rgba(255,255,255,0.55);
		--t-muted: rgba(255,255,255,0.38);
	}

	.page-wrap { padding: 2rem 2.5rem; max-width: 1560px; }

	/* Header */
	.page-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 1rem; margin-bottom: 2rem; }
	.page-title { font-family: var(--font-display), var(--font-sans), system-ui, -apple-system, sans-serif; font-size: 1.6rem; font-weight: 900; letter-spacing: -0.03em; color: var(--t-strong); margin: 0 0 0.25rem; }
	.page-sub   { font-size: 0.8125rem; color: var(--t-muted); margin: 0; }
	.create-btn {
		display: flex; align-items: center; gap: 0.4rem;
		padding: 0.6rem 1.1rem; border-radius: 10px; border: none;
		background: #E8FF48; color: #0a0a0a;
		font-size: 0.8125rem; font-weight: 600; cursor: pointer;
		font-family: 'DM Sans', sans-serif; transition: transform 0.12s, box-shadow 0.12s;
	}
	.create-btn:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 6px 20px rgba(232,255,72,0.25); }
	.create-btn:disabled { opacity: 0.5; cursor: not-allowed; }
	.spin { animation: spin 0.8s linear infinite; }
	@keyframes spin { to { transform: rotate(360deg); } }

	/* Templates section */
	.templates-section { margin-bottom: 2rem; }
	.templates-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 1rem; }
	.templates-title { font-family: 'Space Mono', monospace; font-size: 0.65rem; text-transform: uppercase; letter-spacing: 0.12em; color: var(--t-muted); margin: 0; }
	.templates-see-all { font-size: 0.75rem; color: var(--t-muted); text-decoration: none; font-family: 'Space Mono', monospace; transition: color 0.15s; }
	.templates-see-all:hover { color: #E8FF48; }

	.templates-grid {
		display: grid;
		grid-template-columns: repeat(var(--cols, 5), minmax(0, 1fr));
		gap: 16px;
		align-items: start;
	}

	/* Starter template cards */
	.tmpl-card {
		border: 1px solid var(--panel-border);
		background: var(--panel-bg);
	}
	.tmpl-card:hover { border-color: var(--panel-border-hover); }
	:root:not([data-theme="dark"]) .tmpl-card:hover { box-shadow: 0 14px 44px rgba(2, 6, 23, 0.08); }
	:root[data-theme="dark"] .tmpl-card:hover { box-shadow: 0 14px 44px rgba(0, 0, 0, 0.34); }

	.tmpl-footer { background: #fff; border-color: var(--panel-border); }
	.tmpl-title { color: var(--t-strong); }
	.tmpl-desc { color: var(--t-muted); }
	.tmpl-arrow { color: color-mix(in oklab, var(--t-muted) 55%, transparent); }

	.tmpl-more { border-color: var(--panel-border); color: var(--t-muted); background: color-mix(in oklab, var(--panel-bg) 70%, transparent); }

	/* Studio workspace drafts (News Studio `news_studio` rows) */
	.studio-drafts-block {
		margin-bottom: 1.5rem;
		padding: 1rem 1.25rem;
		border-radius: 16px;
		border: 1px solid var(--panel-border);
		background: var(--panel-bg);
	}
	.studio-drafts-head { margin-bottom: 0.75rem; }
	.studio-drafts-title {
		font-family: var(--font-display), var(--font-sans), system-ui, -apple-system, sans-serif;
		font-size: 1rem;
		font-weight: 700;
		color: var(--t-strong);
		margin: 0 0 0.35rem;
	}
	.studio-drafts-sub {
		font-size: 0.75rem;
		color: var(--t-muted);
		margin: 0;
		line-height: 1.45;
		max-width: 56rem;
	}
	.studio-drafts-grid { margin-top: 0.5rem; }

	.studio-draft-card-preview {
		position: relative;
		overflow: hidden;
	}
	.studio-draft-bg-img {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		object-fit: cover;
		object-position: center;
	}
	.studio-draft-bg-scrim {
		position: absolute;
		inset: 0;
		background: linear-gradient(to bottom, rgba(0, 0, 0, 0.15) 0%, rgba(0, 0, 0, 0.55) 100%);
		pointer-events: none;
	}
	.studio-draft-preview-headline {
		position: relative;
		z-index: 2;
		text-shadow: 0 1px 14px rgba(0, 0, 0, 0.45);
	}
	.studio-draft-filmstrip {
		position: absolute;
		bottom: 0.55rem;
		left: 0.5rem;
		right: 0.5rem;
		display: flex;
		gap: 4px;
		z-index: 2;
		pointer-events: none;
	}
	.studio-draft-film-cell {
		flex: 1;
		min-width: 0;
		height: 22px;
		border-radius: 4px;
		display: flex;
		align-items: center;
		justify-content: center;
		background: rgba(255, 255, 255, 0.14);
		border: 1px solid rgba(255, 255, 255, 0.22);
		font-size: 8px;
		font-weight: 700;
		letter-spacing: 0.02em;
		color: rgba(255, 255, 255, 0.9);
	}
	.studio-draft-filmstrip--light .studio-draft-film-cell {
		background: rgba(0, 0, 0, 0.06);
		border-color: rgba(0, 0, 0, 0.12);
		color: rgba(0, 0, 0, 0.55);
	}
	.studio-draft-film-cell--on {
		background: rgba(232, 255, 72, 0.22);
		border-color: rgba(232, 255, 72, 0.45);
		color: #eab308;
	}
	.studio-draft-filmstrip--light .studio-draft-film-cell--on {
		background: rgba(124, 58, 237, 0.12);
		border-color: rgba(124, 58, 237, 0.35);
		color: #6d28d9;
	}
	.studio-draft-template-pill {
		position: absolute;
		top: 0.5rem;
		left: 0.5rem;
		z-index: 3;
		padding: 2px 8px;
		border-radius: 999px;
		background: rgba(0, 0, 0, 0.55);
		color: rgba(255, 255, 255, 0.92);
		font-size: 0.58rem;
		font-family: 'Space Mono', monospace;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		backdrop-filter: blur(4px);
		max-width: calc(100% - 5rem);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	/* Section divider */
	.section-divider { border: none; border-top: 1px solid var(--panel-border); margin: 0.5rem 0 1.5rem; }

	/* Library header */
	.library-header { display: flex; align-items: center; justify-content: space-between; gap: 1rem; margin-bottom: 1rem; flex-wrap: wrap; }
	.library-title { font-family: var(--font-display), var(--font-sans), system-ui, -apple-system, sans-serif; font-size: 1rem; font-weight: 700; color: var(--t-strong); margin: 0; }

	/* Filter tabs */
	.filter-tabs {
		display: flex; gap: 0.25rem; padding: 0.3rem;
		background: var(--panel-bg); border: 1px solid var(--panel-border);
		border-radius: 10px;
	}
	.filter-tab {
		display: inline-flex; align-items: center; gap: 0.4rem;
		padding: 0.35rem 0.8rem; border-radius: 7px; border: none;
		background: transparent; color: var(--t-muted);
		font-family: 'DM Sans', sans-serif; font-size: 0.78rem; font-weight: 500;
		cursor: pointer; transition: all 0.12s;
	}
	.filter-tab:hover { color: var(--t-strong); }
	.filter-tab--on { color: var(--t-strong); background: var(--panel-bg-2); }
	.filter-count {
		display: inline-flex; align-items: center; justify-content: center;
		width: 18px; height: 18px; border-radius: 5px;
		background: var(--panel-bg-2); font-size: 0.65rem;
		font-family: 'Space Mono', monospace; color: var(--t);
	}
	.filter-tab--on .filter-count { background: rgba(232,255,72,0.15); color: #E8FF48; }

	/* Carousel grid */
	.carousel-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; }
	.skeleton-card {
		aspect-ratio: 4/5; border-radius: 16px;
		background: var(--panel-bg);
		animation: pulse 1.5s ease-in-out infinite;
	}
	@keyframes pulse { 0%,100%{opacity:0.5} 50%{opacity:1} }

	/* Carousel card */
	.carousel-card {
		position: relative; border-radius: 16px; overflow: hidden;
		border: 1px solid var(--panel-border);
		background: var(--card-bg, #111);
		transition: border-color 0.2s, transform 0.2s, box-shadow 0.2s;
	}
	.carousel-card:hover { border-color: var(--panel-border-hover); transform: translateY(-2px); box-shadow: 0 12px 40px rgba(0,0,0,0.12); }

	.card-preview {
		display: flex; align-items: center; justify-content: center;
		padding: 1.5rem; aspect-ratio: 4/5;
		text-decoration: none; cursor: pointer;
	}
	.card-preview-text {
		font-family: var(--font-display), var(--font-sans), system-ui, -apple-system, sans-serif; font-weight: 700; text-align: center;
		line-height: 1.25; color: var(--card-color, #fff);
		font-size: clamp(10px, 1.8vw, 16px);
		display: -webkit-box; -webkit-line-clamp: 4; -webkit-box-orient: vertical; overflow: hidden;
	}

	.slide-count {
		position: absolute; top: 0.5rem; right: 0.5rem;
		padding: 2px 7px; border-radius: 5px;
		background: rgba(0,0,0,0.65); color: rgba(255,255,255,0.45);
		font-size: 0.6rem; font-family: 'Space Mono', monospace;
		backdrop-filter: blur(4px);
	}

	.card-status {
		position: absolute; top: 0.5rem; left: 0.5rem;
		display: inline-flex; align-items: center; gap: 0.25rem;
		padding: 2px 7px; border-radius: 5px;
		font-size: 0.6rem; font-family: 'Space Mono', monospace; font-weight: 700;
		text-transform: capitalize; backdrop-filter: blur(4px);
		opacity: 0; transition: opacity 0.2s;
	}
	.carousel-card:hover .card-status { opacity: 1; }
	.status-draft     { background: color-mix(in oklab, var(--app-text) 8%, transparent); color: var(--t); }
	.status-published { background: rgba(6,182,212,0.2); color: #06b6d4; border: 1px solid rgba(6,182,212,0.3); }
	.status-scheduled { background: rgba(139,92,246,0.2); color: #8b5cf6; border: 1px solid rgba(139,92,246,0.3); }

	.card-footer {
		position: absolute; bottom: 0; left: 0; right: 0;
		padding: 0.75rem; background: linear-gradient(to top, rgba(0,0,0,0.9), transparent);
		display: flex; align-items: flex-end; justify-content: space-between; gap: 0.5rem;
	}
	.card-info { flex: 1; min-width: 0; }
	.card-title-text { font-size: 0.78rem; font-weight: 600; color: var(--t-strong); margin: 0 0 0.15rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
	.card-time        { font-size: 0.6rem; color: var(--t-muted); font-family: 'Space Mono', monospace; margin: 0; }

	.card-actions { display: flex; gap: 0.25rem; opacity: 0; transition: opacity 0.2s; }
	.carousel-card:hover .card-actions { opacity: 1; }
	.card-action {
		display: flex; align-items: center; justify-content: center;
		width: 26px; height: 26px; border-radius: 6px; border: none; cursor: pointer;
		text-decoration: none; transition: background 0.15s;
	}
	.card-action--edit   { background: rgba(139,92,246,0.2); color: #a78bfa; }
	.card-action--edit:hover { background: rgba(139,92,246,0.4); }
	.card-action--delete { background: rgba(239,68,68,0.2); color: #f87171; }
	.card-action--delete:hover { background: rgba(239,68,68,0.4); }

	/* New card button */
	.new-card-btn {
		aspect-ratio: 4/5; border-radius: 16px;
		border: 2px dashed var(--panel-border);
		background: transparent;
		display: flex; flex-direction: column; align-items: center; justify-content: center;
		gap: 0.6rem; cursor: pointer; transition: all 0.2s; color: var(--t-muted);
	}
	.new-card-btn:hover { border-color: rgba(232,255,72,0.3); color: #E8FF48; background: rgba(232,255,72,0.03); }
	.new-card-icon {
		width: 40px; height: 40px; border-radius: 11px;
		border: 2px solid currentColor;
		display: flex; align-items: center; justify-content: center;
		transition: transform 0.2s;
	}
	.new-card-btn:hover .new-card-icon { transform: scale(1.1); }
	.new-card-label { font-size: 0.72rem; font-family: 'Space Mono', monospace; }

	/* Empty states */
	.empty-state {
		display: flex; flex-direction: column; align-items: center; text-align: center;
		padding: 4rem 2rem; gap: 0.75rem;
	}
	.empty-icon {
		width: 56px; height: 56px; border-radius: 16px;
		background: rgba(139,92,246,0.1); border: 1px solid rgba(139,92,246,0.15);
		display: flex; align-items: center; justify-content: center;
		color: rgba(139,92,246,0.7); margin-bottom: 0.5rem;
	}
	.empty-title { font-family: var(--font-display), var(--font-sans), system-ui, -apple-system, sans-serif; font-size: 1.1rem; font-weight: 700; color: var(--t-strong); margin: 0; }
	.empty-desc  { font-size: 0.8125rem; color: var(--t-muted); margin: 0; max-width: 280px; }
	.empty-cta {
		display: inline-flex; align-items: center; gap: 0.4rem;
		padding: 0.6rem 1.2rem; border-radius: 10px; border: none;
		background: linear-gradient(135deg, #7c3aed, #06b6d4);
		color: #fff; font-size: 0.8125rem; font-weight: 600; cursor: pointer;
		font-family: 'DM Sans', sans-serif; margin-top: 0.5rem;
		transition: opacity 0.15s, transform 0.15s;
	}
	:root:not([data-theme="dark"]) .empty-cta { color: #ffffff; }
	.empty-cta:hover { opacity: 0.9; transform: translateY(-1px); }
</style>
