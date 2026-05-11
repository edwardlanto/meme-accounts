<script lang="ts">
	import { supabase } from '$lib/supabase';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { STARTER_TEMPLATES } from '$lib/templates';
	import { stripMarkup } from '$lib/highlight';
	import { coerceTemplateId, STUDIO_TEMPLATES } from '$lib/studio/template-ids';
	import { r2DeleteObject, r2SignRead } from '$lib/r2Client';

	/** Must match `DRAFT_KIND` in `dashboard/studio/+page.svelte` (workspace autosave rows). */
	const STUDIO_WORKSPACE_DRAFT_KIND = 'news_studio';
	/** Must match `STUDIO_SAVED_TEMPLATE_KIND` in `dashboard/studio/+page.svelte` (saved templates). */
	const STUDIO_SAVED_TEMPLATE_KIND = 'studio_saved_template';
	import TweetTemplate from '$lib/components/templates/TweetTemplate.svelte';
	import TextCarouselTemplate from '$lib/components/templates/TextCarouselTemplate.svelte';
	import ArticleTemplate from '$lib/components/templates/ArticleTemplate.svelte';
	// ImageQuoteTemplate removed from public templates
	import { ImagePlus, Plus, Trash2, Edit2, Clock, CheckCircle, FileText, Loader, ArrowRight } from 'lucide-svelte';

	let carousels: any[] = $state([]);
	let studioDrafts = $state<{ id: string; updated_at: string; state?: Record<string, unknown> }[]>([]);
	let studioSavedTemplates = $state<{ id: string; updated_at: string; state?: Record<string, unknown> }[]>([]);
	let studioSavedTemplateThumbById = $state<Record<string, string>>({});
	/** Signed GET URLs for News Studio workspace draft card heroes (keeps PNG egress off Supabase). */
	let studioDraftThumbById = $state<Record<string, string>>({});
	let loading = $state(true);
	let creating = $state(false);
	let createError = $state('');
	let userId = $state('');
	let mounted = $state(false);
	onMount(() => { mounted = true; });

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
		/** Saved slide PNG from Storage — already includes headline; don’t paint copy on top */
		fullSlideRaster: boolean;
	};

	function studioDraftPreview(d: {
		id: string;
		updated_at?: string;
		state?: Record<string, unknown>;
	}): StudioDraftPreview {
		const s = d.state ?? {};
		const slideList = strArr(s.slides);
		const slideCount = Math.max(1, slideList.length);
		const templates = strArr(s.slideTemplates);
		const tpl = coerceTemplateId(templates[0] ?? 'news');
		const templateLabel = templateLabelFromId(templates[0] ?? tpl);

		const bgMap = (s.bgImagesByTemplate ?? {}) as Record<string, string[]>;
		const pickHero = (key: string) => {
			const u = String(bgMap[key]?.[0] ?? '').trim();
			if (u.startsWith('http://') || u.startsWith('https://')) return u;
			// Draft state embeds AI/uploads as data URLs — same-origin img supports these for thumbnails.
			if (u.startsWith('data:image/') && u.length < 2_500_000) return u;
			return '';
		};

		/** Prefer R2-signed hero (stored key in draft state); then legacy HTTPS URL; avoids Supabase CDN for PNGs when R2 is set up. */
		const storagePreviewHero = (() => {
			const id = String(d.id ?? '').trim();
			const signed = id ? (studioDraftThumbById[id] ?? '').trim() : '';
			if (signed.startsWith('http://') || signed.startsWith('https://')) return signed;
			const u = String((s as any).draftPreviewUrl ?? '').trim();
			return u.startsWith('http://') || u.startsWith('https://') ? u : '';
		})();

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
			heroUrl = storagePreviewHero || pickHero('news');
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
			heroUrl = storagePreviewHero || pickHero('tweet');
		} else if (tpl === 'blackText') {
			bgSolid = '#000000';
			textColor = '#e5e5e5';
			heroUrl = storagePreviewHero || pickHero('blackText');
		} else if (tpl === 'textCarousel') {
			bgSolid = '#0a0a0a';
			textColor = '#f5f5f5';
			heroUrl = storagePreviewHero;
		} else if (tpl === 'videoStory') {
			bgSolid = '#0a0a0a';
			textColor = '#fafafa';
			heroUrl = storagePreviewHero || pickHero('videoStory');
		} else if (tpl === 'imageQuote') {
			bgSolid = '#0f172a';
			textColor = '#fafafa';
			heroUrl = storagePreviewHero || pickHero('imageQuote');
		} else if (tpl === 'article') {
			bgSolid = '#fafafa';
			textColor = '#0a0a0a';
			heroUrl = storagePreviewHero || pickHero('article');
		}

		const fullSlideRaster = !!storagePreviewHero;
		const filmLight =
			!fullSlideRaster &&
			(tpl === 'tweet' ||
				(tpl === 'article' && !heroUrl) ||
				(tpl === 'news' && !heroUrl && isLightHex(bgSolid)));

		return {
			templateLabel,
			headline,
			textColor,
			bgSolid,
			heroUrl,
			slideCount,
			slideHints,
			filmLight,
			fullSlideRaster,
		};
	}

	async function deleteStudioDraft(id: string) {
		if (!confirm('Delete this studio draft? This cannot be undone.')) return;
		// Best-effort: remove raster thumbnail from R2 (Studio saves `{userId}/{draftId}.png`).
		try {
			const row = studioDrafts.find((x) => x.id === id);
			const st = row?.state as any;
			const key =
				String(st?.draftPreviewKey ?? '').trim() ||
				String(st?.draftPreviewPath ?? '').trim() ||
				`${userId}/${id}.png`;
			if (key) await r2DeleteObject({ key });
		} catch {
			// ignore
		}
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
		const nextThumb = { ...studioDraftThumbById };
		delete nextThumb[id];
		studioDraftThumbById = nextThumb;
	}

	async function deleteStudioSavedTemplate(id: string) {
		if (!confirm('Delete this saved template? This cannot be undone.')) return;
		// Best-effort: delete stored PNG first (ignore errors).
		try {
			const row = studioSavedTemplates.find((x) => x.id === id);
			const s = row?.state as any;
			const key =
				String(s?.draftPreviewKey ?? '').trim() ||
				String(s?.draftPreviewPath ?? '').trim() ||
				`${userId}/templates/${id}.png`;
			if (key) await r2DeleteObject({ key });
		} catch {
			// ignore
		}
		const { error } = await (supabase as any)
			.from('drafts')
			.delete()
			.eq('id', id)
			.eq('user_id', userId)
			.eq('kind', STUDIO_SAVED_TEMPLATE_KIND);
		if (error) {
			alert(error.message ?? 'Could not delete template');
			return;
		}
		studioSavedTemplates = studioSavedTemplates.filter((x) => x.id !== id);
		{
			const next = { ...studioSavedTemplateThumbById };
			delete next[id];
			studioSavedTemplateThumbById = next;
		}
	}

	onMount(async () => {
		const { data: { user } } = await supabase.auth.getUser();
		if (!user) { goto('/login'); return; }
		userId = user.id;

		const [carouselRes, draftRes, savedTplRes] = await Promise.all([
			(supabase as any).from('carousels').select('*').order('updated_at', { ascending: false }),
			(supabase as any)
				.from('drafts')
				.select('id,updated_at,state')
				.eq('user_id', user.id)
				.eq('kind', STUDIO_WORKSPACE_DRAFT_KIND)
				.order('updated_at', { ascending: false })
				.limit(40),
			(supabase as any)
				.from('drafts')
				.select('id,updated_at,state')
				.eq('user_id', user.id)
				.eq('kind', STUDIO_SAVED_TEMPLATE_KIND)
				.order('updated_at', { ascending: false })
				.limit(24),
		]);
		carousels = carouselRes.data ?? [];
		studioDrafts = draftRes.data ?? [];
		studioSavedTemplates = savedTplRes.data ?? [];
		await hydrateSavedTemplateThumbs();
		await hydrateStudioDraftThumbs();
		loading = false;
	});

	function studioSavedTemplateName(row: { state?: Record<string, unknown> }): string {
		const raw = String((row.state as any)?._templateName ?? '').trim();
		return raw || 'Untitled template';
	}

	async function hydrateStudioDraftThumbs() {
		const rows = studioDrafts;
		if (!userId || !rows.length) {
			studioDraftThumbById = {};
			return;
		}
		const next: Record<string, string> = {};
		await Promise.all(
			rows.map(async (row) => {
				const id = String(row.id ?? '').trim();
				if (!id) return;
				const s = row.state as any;
				const key =
					String(s?.draftPreviewKey ?? '').trim() ||
					String(s?.draftPreviewPath ?? '').trim() ||
					`${userId}/${id}.png`;
				try {
					const { url } = await r2SignRead({ key });
					next[id] = url;
				} catch {
					// No object yet or legacy draft — card falls back to `draftPreviewUrl` / inlined data URLs.
				}
			}),
		);
		studioDraftThumbById = next;
	}

	async function hydrateSavedTemplateThumbs() {
		const rows = studioSavedTemplates;
		if (!userId || !rows.length) {
			studioSavedTemplateThumbById = {};
			return;
		}
		const next: Record<string, string> = {};
		await Promise.all(
			rows.map(async (row) => {
				const id = String(row.id ?? '').trim();
				if (!id) return;
				const s = row.state as any;
				const key =
					String(s?.draftPreviewKey ?? '').trim() ||
					String(s?.draftPreviewPath ?? '').trim() ||
					`${userId}/templates/${id}.png`;
				try {
					const { url } = await r2SignRead({ key });
					// Do not append query params — presigned URLs must match signing exactly or R2 returns SignatureDoesNotMatch.
					next[id] = url;
				} catch {
					// ignore
				}
			}),
		);
		studioSavedTemplateThumbById = next;
	}

	function studioSavedTemplatePreviewUrl(row: { state?: Record<string, unknown> }): { url: string; fullSlideRaster: boolean } {
		const signed = studioSavedTemplateThumbById[String((row as any)?.id ?? '').trim()];
		if (signed) return { url: signed, fullSlideRaster: true };
		const s = row.state as any;
		const draftPreviewUrl = String(s?.draftPreviewUrl ?? '').trim();
		if (draftPreviewUrl.startsWith('http://') || draftPreviewUrl.startsWith('https://')) {
			return { url: draftPreviewUrl, fullSlideRaster: true };
		}
		const templatePreviewUrl = String(s?.templatePreviewUrl ?? '').trim();
		if (templatePreviewUrl.startsWith('http://') || templatePreviewUrl.startsWith('https://')) {
			return { url: templatePreviewUrl, fullSlideRaster: false };
		}
		return { url: '', fullSlideRaster: false };
	}

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

<div class="page-wrap" class:mounted>

	<!-- ── Hero header ─────────────────────────────────────────────────────── -->
	<header class="page-hero">
		<div class="page-hero-text">
			<div class="page-eyebrow">
				<span class="page-eyebrow-dot"></span>
				<span>Library</span>
			</div>
			<h1 class="page-title">Carousels</h1>
			<p class="page-sub">Pick a template to start, or jump back into a saved layout or studio draft.</p>
		</div>
		<button onclick={createNew} disabled={creating} class="create-btn">
			{#if creating}<Loader size={14} class="spin" />{:else}<Plus size={15} />{/if}
			New carousel
		</button>
	</header>

	{#if createError}
		<div style="margin-bottom:1rem;padding:0.75rem 1rem;border-radius:10px;background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.2);font-size:0.8125rem;color:#f87171;">
			⚠ {createError}
		</div>
	{/if}

	<!-- ── Starter Templates ───────────────────────────────────────────────── -->
	<section class="templates-section reveal" style="--d:0.05s">
		<div class="section-head">
			<h2 class="section-title">Start from a template</h2>
			<p class="section-sub">Hand‑crafted layouts that open straight into Studio.</p>
		</div>

		<div
			bind:this={templatesWrapEl}
			class="templates-grid"
			style="--cols:{templateCols}; --cardw:{templateCardW}px;"
		>
			{#each STARTER_TEMPLATES.filter((t) => t.id !== 'image-quote') as tmpl, i}
				{@const hoverClass =
						tmpl.id === 'empty'   ? 'hover:border-neutral-400/35 hover:shadow-[0_0_24px_rgba(115,115,115,0.10)]'
						: tmpl.id === 'tweet'   ? 'hover:border-sky-500/40 hover:shadow-[0_0_28px_rgba(14,165,233,0.12)]'
						: tmpl.id === 'text'  ? 'hover:border-white/25 hover:shadow-[0_0_28px_rgba(255,255,255,0.06)]'
						: tmpl.id === 'black-text' ? 'hover:border-sky-500/35 hover:shadow-[0_0_28px_rgba(14,165,233,0.10)]'
						: tmpl.id === 'article' ? 'hover:border-emerald-500/40 hover:shadow-[0_0_28px_rgba(52,211,153,0.12)]'
						: 'hover:border-amber-500/40 hover:shadow-[0_0_28px_rgba(245,166,35,0.12)]'}
				{@const arrowColor =
						tmpl.id === 'empty'   ? 'group-hover:text-neutral-400'
						: tmpl.id === 'tweet'   ? 'group-hover:text-sky-400'
						: tmpl.id === 'text'  ? 'group-hover:text-white/70'
						: tmpl.id === 'black-text' ? 'group-hover:text-sky-400'
						: tmpl.id === 'article' ? 'group-hover:text-emerald-400'
						: 'group-hover:text-amber-400'}
				<a
					href={tmpl.href}
					class="tmpl-card reveal group flex flex-col rounded-2xl overflow-hidden flex-shrink-0 {hoverClass}"
					style="width: 100%; --d:{0.06 + i * 0.04}s"
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
			<div
				class="tmpl-more reveal flex flex-col items-center justify-center rounded-2xl border-2 border-dashed flex-shrink-0"
				style="width: 100%; height: {Math.round(templateCardW * 1350/1080) + 46}px; display: flex; --d:{0.06 + STARTER_TEMPLATES.length * 0.04}s"
			>
				<Plus size={18} class="mb-2 opacity-40" />
				<span class="text-[10px] font-mono">More templates soon</span>
			</div>
		</div>
	</section>

	{#if studioSavedTemplates.length > 0}
		<section class="saved-templates-block reveal" style="--d:0.18s">
			<div class="saved-templates-head">
				<h2 class="saved-templates-title">Saved Studio templates</h2>
				<p class="saved-templates-sub">
					Layouts and copy you saved from News Studio open as a new session. Thumbnails show the saved first slide PNG when available.
				</p>
			</div>
			<div class="saved-templates-grid">
				{#each studioSavedTemplates as row, i (row.id)}
					{@const pv = studioSavedTemplatePreviewUrl(row)}
					<div class="saved-template-tile reveal group" style="--d:{0.22 + i * 0.04}s">
						<a class="saved-template-link" href="/dashboard/studio?saved={row.id}" aria-label="Open saved template">
							{#if pv.url}
								<img
									src={pv.url}
									alt=""
									class="saved-template-img"
									class:saved-template-img--full={pv.fullSlideRaster}
									referrerpolicy="no-referrer"
									loading="lazy"
									draggable="false"
								/>
							{:else}
								<div class="saved-template-empty">
									<span class="saved-template-empty-text">{studioSavedTemplateName(row)}</span>
								</div>
							{/if}
						</a>
						<button
							type="button"
							class="saved-template-del"
							title="Delete template"
							aria-label="Delete template"
							onclick={() => void deleteStudioSavedTemplate(row.id)}
						>
							<Trash2 size={12} />
						</button>
					</div>
				{/each}
			</div>
		</section>
	{/if}

	{#if studioDrafts.length > 0}
		<section class="studio-drafts-block reveal" style="--d:0.24s">
			<div class="studio-drafts-head">
				<h2 class="studio-drafts-title">Studio drafts</h2>
				<p class="studio-drafts-sub">
					Workspace saves from News Studio — same card layout as your carousels. Open to edit, or delete when you no longer need a snapshot.
				</p>
			</div>
			<div class="carousel-grid studio-drafts-grid">
				{#each studioDrafts as d, i}
					{@const pv = studioDraftPreview(d)}
					<div
						class="carousel-card reveal group studio-draft-card"
						style="--card-bg: {pv.bgSolid}; --card-color: {pv.textColor}; --d:{0.28 + i * 0.04}s"
					>
						<a
							href="/dashboard/studio?draft={d.id}"
							class="card-preview studio-draft-card-preview"
							style={
								pv.heroUrl
									? pv.fullSlideRaster
										? `background-color: ${pv.bgSolid};`
										: ''
									: `background-color: ${pv.bgSolid};`
							}
						>
							{#if pv.heroUrl}
								<img
									src={pv.heroUrl}
									alt=""
									class="studio-draft-bg-img"
									class:studio-draft-bg-img--full-slide={pv.fullSlideRaster}
									referrerpolicy="no-referrer"
								/>
								{#if !pv.fullSlideRaster}
									<div class="studio-draft-bg-scrim" aria-hidden="true"></div>
								{/if}
							{/if}
							{#if !pv.fullSlideRaster}
								<p class="card-preview-text studio-draft-preview-headline" style="color: {pv.textColor};">
									{pv.headline}
								</p>
							{/if}
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
		</section>
	{/if}
</div>

<style>
	/* ─── Tokens (homepage palette) ────────────────────────── */
	:root:not([data-theme="dark"]) {
		--ap-text:   #0a0a0a;
		--ap-text-2: rgba(10, 10, 10, 0.62);
		--ap-text-3: rgba(10, 10, 10, 0.42);
		--ap-line:   rgba(10, 10, 10, 0.08);
		--ap-line-2: rgba(10, 10, 10, 0.16);
		--ap-soft:   #f6f5f1;
		--ap-bg:     #ffffff;

		--panel-bg: #ffffff;
		--panel-bg-2: #fafafa;
		--panel-border: rgba(10, 10, 10, 0.08);
		--panel-border-hover: rgba(10, 10, 10, 0.16);
		--t-strong: var(--ap-text);
		--t: var(--ap-text-2);
		--t-muted: var(--ap-text-3);

		--shadow-soft: 0 1px 2px rgba(10, 10, 10, 0.04), 0 8px 22px -10px rgba(10, 10, 10, 0.10);
		--shadow-pop:  0 18px 40px -16px rgba(10, 10, 10, 0.18), 0 6px 14px -8px rgba(10, 10, 10, 0.12);
	}
	:root[data-theme="dark"] {
		--ap-text:   #f5f5f5;
		--ap-text-2: rgba(245, 245, 245, 0.66);
		--ap-text-3: rgba(245, 245, 245, 0.42);
		--ap-line:   rgba(255, 255, 255, 0.07);
		--ap-line-2: rgba(255, 255, 255, 0.14);
		--ap-soft:   #161616;
		--ap-bg:     #0a0a0a;

		--panel-bg: rgba(255, 255, 255, 0.025);
		--panel-bg-2: rgba(255, 255, 255, 0.045);
		--panel-border: rgba(255, 255, 255, 0.07);
		--panel-border-hover: rgba(255, 255, 255, 0.16);
		--t-strong: var(--ap-text);
		--t: var(--ap-text-2);
		--t-muted: var(--ap-text-3);

		--shadow-soft: 0 1px 0 rgba(255, 255, 255, 0.04) inset, 0 12px 28px -16px rgba(0, 0, 0, 0.55);
		--shadow-pop:  0 18px 40px -18px rgba(0, 0, 0, 0.55);
	}

	.page-wrap {
		padding: 32px 32px 64px;
		max-width: 1560px;
		margin: 0 auto;
		font-family: 'Satoshi', -apple-system, BlinkMacSystemFont, sans-serif;
		letter-spacing: -0.01em;
		-webkit-font-smoothing: antialiased;
	}

	/* ─── Reveal animation ─────────────────────────────────── */
	.reveal {
		opacity: 0;
		transform: translateY(14px);
		transition:
			opacity 0.7s cubic-bezier(0.16, 1, 0.3, 1) var(--d, 0s),
			transform 0.7s cubic-bezier(0.16, 1, 0.3, 1) var(--d, 0s);
		will-change: opacity, transform;
	}
	.page-wrap.mounted .reveal {
		opacity: 1;
		transform: translateY(0);
	}

	/* ─── Hero header ──────────────────────────────────────── */
	.page-hero {
		display: flex;
		align-items: flex-end;
		justify-content: space-between;
		gap: 24px;
		flex-wrap: wrap;
		margin-bottom: 36px;
		opacity: 0;
		transform: translateY(10px);
		animation: cs-hero-in 0.8s cubic-bezier(0.16, 1, 0.3, 1) 0.04s both;
	}
	@keyframes cs-hero-in {
		to { opacity: 1; transform: translateY(0); }
	}
	.page-hero-text { display: flex; flex-direction: column; gap: 8px; min-width: 0; }
	.page-eyebrow {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		padding: 5px 12px 5px 10px;
		width: fit-content;
		border-radius: 999px;
		background: var(--panel-bg-2);
		border: 1px solid var(--panel-border);
		color: var(--t);
		font-size: 11px;
		font-weight: 600;
		letter-spacing: 0.06em;
		text-transform: uppercase;
	}
	.page-eyebrow-dot {
		width: 6px; height: 6px;
		border-radius: 50%;
		background: #34d399;
		box-shadow: 0 0 0 3px rgba(52, 211, 153, 0.18);
	}

	.page-title {
		font-family: 'Satoshi', sans-serif;
		font-size: clamp(28px, 3.4vw, 42px);
		font-weight: 800;
		letter-spacing: -0.025em;
		color: var(--t-strong);
		margin: 0;
		line-height: 1.05;
	}
	.page-sub   {
		font-size: 14px;
		line-height: 1.55;
		color: var(--t);
		margin: 0;
		max-width: 60ch;
	}
	.create-btn {
		display: inline-flex; align-items: center; gap: 8px;
		padding: 12px 20px; border-radius: 999px; border: 1px solid var(--ap-text);
		background: var(--ap-text); color: var(--ap-bg);
		font-family: inherit;
		font-size: 13.5px; font-weight: 700; cursor: pointer;
		letter-spacing: -0.005em;
		transition: transform 0.22s ease, box-shadow 0.22s ease, opacity 0.22s ease;
		flex-shrink: 0;
		white-space: nowrap;
	}
	.create-btn:hover:not(:disabled) {
		transform: translateY(-1px);
		box-shadow: 0 12px 28px -12px color-mix(in oklab, var(--ap-text) 50%, transparent);
	}
	.create-btn:disabled { opacity: 0.5; cursor: not-allowed; }
	.spin { animation: spin 0.8s linear infinite; }
	@keyframes spin { to { transform: rotate(360deg); } }

	/* ─── Section heads ────────────────────────────────────── */
	.section-head { margin-bottom: 16px; }
	.section-title {
		font-family: 'Satoshi', sans-serif;
		font-size: 18px;
		font-weight: 800;
		letter-spacing: -0.02em;
		color: var(--t-strong);
		margin: 0 0 4px;
	}
	.section-sub {
		font-size: 13px;
		line-height: 1.5;
		color: var(--t);
		margin: 0;
		max-width: 56rem;
	}

	/* ─── Templates section ────────────────────────────────── */
	.templates-section { margin-bottom: 32px; }

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
		box-shadow: var(--shadow-soft);
		transition:
			transform 0.32s cubic-bezier(0.16, 1, 0.3, 1),
			border-color 0.25s ease,
			box-shadow 0.32s ease,
			opacity 0.7s cubic-bezier(0.16, 1, 0.3, 1) var(--d, 0s);
	}
	.tmpl-card:hover {
		transform: translateY(-3px);
		border-color: var(--panel-border-hover);
		box-shadow: var(--shadow-pop);
	}

	:global(.tmpl-footer) {
		background: var(--panel-bg);
		border-color: var(--panel-border) !important;
	}
	:global(.tmpl-title) {
		color: var(--t-strong) !important;
		font-family: 'Satoshi', sans-serif;
		font-weight: 700;
		letter-spacing: -0.01em;
	}
	:global(.tmpl-desc)  { color: var(--t-muted) !important; }
	:global(.tmpl-arrow) {
		color: var(--t-muted) !important;
		transition: transform 0.22s ease, color 0.22s ease;
	}
	.tmpl-card:hover :global(.tmpl-arrow) {
		color: var(--t-strong) !important;
		transform: translateX(2px);
	}

	.tmpl-more {
		border-color: var(--panel-border);
		color: var(--t-muted);
		background: color-mix(in oklab, var(--panel-bg) 70%, transparent);
		transition:
			transform 0.32s cubic-bezier(0.16, 1, 0.3, 1),
			border-color 0.25s ease,
			color 0.25s ease,
			opacity 0.7s cubic-bezier(0.16, 1, 0.3, 1) var(--d, 0s);
	}
	.tmpl-more:hover {
		transform: translateY(-3px);
		border-color: var(--panel-border-hover);
		color: var(--t-strong);
	}

	/* ─── Studio workspace drafts ──────────────────────────── */
	.studio-drafts-block {
		margin-bottom: 24px;
		padding: 24px 26px 22px;
		border-radius: 22px;
		border: 1px solid var(--panel-border);
		background: var(--panel-bg);
		box-shadow: var(--shadow-soft);
	}
	.studio-drafts-head { margin-bottom: 14px; }
	.studio-drafts-title {
		font-family: 'Satoshi', sans-serif;
		font-size: 18px;
		font-weight: 800;
		letter-spacing: -0.02em;
		color: var(--t-strong);
		margin: 0 0 4px;
	}
	.studio-drafts-sub {
		font-size: 13px;
		line-height: 1.5;
		color: var(--t);
		margin: 0;
		max-width: 56rem;
	}
	.studio-drafts-grid { margin-top: 12px; }

	/* ─── Saved Studio templates ───────────────────────────── */
	.saved-templates-block {
		margin-bottom: 24px;
		padding: 24px 26px 22px;
		border-radius: 22px;
		border: 1px solid var(--panel-border);
		background: var(--panel-bg);
		box-shadow: var(--shadow-soft);
	}
	.saved-templates-head { margin-bottom: 14px; }
	.saved-templates-title {
		font-family: 'Satoshi', sans-serif;
		font-size: 18px;
		font-weight: 800;
		letter-spacing: -0.02em;
		color: var(--t-strong);
		margin: 0 0 4px;
	}
	.saved-templates-sub {
		font-size: 13px;
		line-height: 1.5;
		color: var(--t);
		margin: 0;
		max-width: 56rem;
	}
	.saved-templates-grid {
		margin-top: 14px;
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
		gap: 14px;
	}
	.saved-template-tile {
		position: relative;
		border-radius: 18px;
		overflow: hidden;
		border: 1px solid var(--panel-border);
		background: var(--ap-soft);
		aspect-ratio: 4 / 5;
		box-shadow: var(--shadow-soft);
		transition:
			transform 0.32s cubic-bezier(0.16, 1, 0.3, 1),
			border-color 0.25s ease,
			box-shadow 0.32s ease,
			opacity 0.7s cubic-bezier(0.16, 1, 0.3, 1) var(--d, 0s);
	}
	.saved-template-tile:hover {
		transform: translateY(-3px);
		border-color: var(--panel-border-hover);
		box-shadow: var(--shadow-pop);
	}
	.saved-template-link {
		display: block;
		width: 100%;
		height: 100%;
		text-decoration: none;
	}
	.saved-template-img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
	}
	/* First-slide PNGs should be shown whole (contain) to match Studio expectations */
	.saved-template-img--full {
		object-fit: contain;
		background: rgba(0, 0, 0, 0.35);
	}
	.saved-template-empty {
		width: 100%;
		height: 100%;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 1rem;
		color: var(--t-muted);
		font-family: 'Space Mono', monospace;
		font-size: 0.7rem;
		text-align: center;
		background: color-mix(in oklab, var(--panel-bg) 70%, transparent);
	}
	.saved-template-empty-text {
		display: -webkit-box;
		line-clamp: 3;
		-webkit-line-clamp: 3;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}
	.saved-template-del {
		position: absolute;
		top: 0.55rem;
		right: 0.55rem;
		width: 32px;
		height: 32px;
		border-radius: 10px;
		border: 1px solid color-mix(in oklab, var(--panel-border) 60%, transparent);
		background: rgba(0, 0, 0, 0.55);
		color: rgba(255, 255, 255, 0.9);
		backdrop-filter: blur(6px);
		display: inline-flex;
		align-items: center;
		justify-content: center;
		opacity: 0;
		transform: translateY(-2px);
		transition: opacity 0.15s, transform 0.15s, background 0.15s;
		cursor: pointer;
	}
	.saved-template-tile:hover .saved-template-del {
		opacity: 1;
		transform: translateY(0);
	}
	.saved-template-del:hover {
		background: rgba(239, 68, 68, 0.55);
	}

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
	/* Saved PNG is already the full composed slide — show it whole (no crop) like Studio; letterbox if aspect differs slightly */
	.studio-draft-bg-img--full-slide {
		object-fit: contain;
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

	/* ─── Library header (legacy, retained) ────────────────── */
	.library-header { display: flex; align-items: center; justify-content: space-between; gap: 1rem; margin-bottom: 1rem; flex-wrap: wrap; }
	.library-title  { font-family: 'Satoshi', sans-serif; font-size: 18px; font-weight: 800; letter-spacing: -0.02em; color: var(--t-strong); margin: 0; }

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

	/* ─── Carousel grid ────────────────────────────────────── */
	.carousel-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 14px; }
	.skeleton-card {
		aspect-ratio: 4/5; border-radius: 18px;
		background: var(--panel-bg);
		animation: pulse 1.5s ease-in-out infinite;
	}
	@keyframes pulse { 0%,100%{opacity:0.5} 50%{opacity:1} }

	/* Carousel card */
	.carousel-card {
		position: relative; border-radius: 18px; overflow: hidden;
		border: 1px solid var(--panel-border);
		background: var(--card-bg, #111);
		box-shadow: var(--shadow-soft);
		transition:
			transform 0.32s cubic-bezier(0.16, 1, 0.3, 1),
			border-color 0.25s ease,
			box-shadow 0.32s ease,
			opacity 0.7s cubic-bezier(0.16, 1, 0.3, 1) var(--d, 0s);
	}
	.carousel-card:hover {
		transform: translateY(-3px);
		border-color: var(--panel-border-hover);
		box-shadow: var(--shadow-pop);
	}

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

	/* ─── Responsive ───────────────────────────────────────── */
	@media (max-width: 720px) {
		.page-wrap { padding: 22px 18px 48px; }
		.page-hero { margin-bottom: 24px; }
		.create-btn { padding: 11px 16px; font-size: 13px; }
		.studio-drafts-block, .saved-templates-block { padding: 18px 18px 16px; border-radius: 18px; }
	}

	/* ─── Reduced motion ───────────────────────────────────── */
	@media (prefers-reduced-motion: reduce) {
		.reveal { opacity: 1 !important; transform: none !important; transition: none !important; }
		.page-hero { animation: none; opacity: 1; transform: none; }
		.tmpl-card, .saved-template-tile, .carousel-card, .tmpl-more {
			transition: border-color 0.2s, box-shadow 0.2s;
		}
	}
</style>
