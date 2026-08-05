<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { supabase } from '$lib/supabase';
	import {
		DEFAULT_BRAND_KIT,
		loadBrandKit,
		saveBrandKit,
		mergeCaptionDefaultsIntoKit,
		type BrandKitSettings,
	} from '$lib/studio/brand-kit';
	import {
		type BulkShow,
		type BulkSlide,
		createBlankShow,
		createBlankSlide,
		activeSlideOf,
		templateForSlideType,
		rowNeedsBody,
		buildDraftStateFromShow,
		stashBulkImport,
		takeBulkClipHandoff,
		peekBulkClipHandoff,
		stripEmDashes,
		BULK_EMOTIONS,
		BULK_AUDIENCES,
		audiencePromptText,
		type BulkEmotionId,
		type BulkClipHandoff,
		defaultRowCaptions,
	} from '$lib/studio/bulk-to-studio';
	import {
		templateUsesStockMedia,
		templateUsesStockVideo,
		resolveStockForTemplate,
		mapPool,
	} from '$lib/studio/bulk-stock';
	import { STUDIO_TEMPLATES, coerceTemplateId, type TemplateId } from '$lib/studio/template-ids';
	import { GOOGLE_FONTS } from '$lib/fonts';
	import { CAPTION_TEMPLATES } from '$lib/video-clips/caption-templates';
	import BulkSlidePreview from '$lib/components/bulk/BulkSlidePreview.svelte';
	import {
		Sparkles,
		Plus,
		Trash2,
		Copy,
		ChevronUp,
		ChevronDown,
		ChevronRight,
		ChevronLeft,
		Loader2,
		Layers,
		Palette,
		ArrowRight,
		Save,
		Type,
		Captions,
		Image,
		X,
	} from 'lucide-svelte';

	let userId = $state('');
	let brandKit = $state<BrandKitSettings>({ ...DEFAULT_BRAND_KIT, cta: { ...DEFAULT_BRAND_KIT.cta } });
	let brandSavedNote = $state('');
	let showBrandPanel = $state(false);

	let topic = $state('');
	let audienceId = $state<string>('');
	let audience = $state('');
	let style = $state<'dark' | 'bold' | 'editorial' | 'minimal'>('bold');
	let emotion = $state<BulkEmotionId>('');
	/** Number of separate slideshows / ideas */
	let ideaCount = $state(5);
	/** Slides inside each slideshow */
	let slidesPerShow = $state(5);
	let appendMode = $state(false);
	let autoStock = $state(true);
	let stockFilling = $state(false);
	let stockNote = $state('');
	let generating = $state(false);
	let generateError = $state('');
	let shows = $state<BulkShow[]>([createBlankShow('news', undefined, 3)]);
	let selectedShowId = $state<string | null>(null);
	let captionsMenuShowId = $state<string | null>(null);
	let pasteOpen = $state(false);
	let pasteText = $state('');
	let clipHandoff = $state<BulkClipHandoff | null>(null);

	const selectedShow = $derived(shows.find((s) => s.id === selectedShowId) ?? shows[0] ?? null);
	const activeSlide = $derived(selectedShow ? activeSlideOf(selectedShow) : null);

	function captionDefaultsFromKit(kit: BrandKitSettings) {
		return defaultRowCaptions({
			enabled: kit.captionEnabledDefault === true,
			templateId: kit.captionTemplateId,
			fontSize: kit.captionFontSize,
			position: kit.captionPosition,
			color: kit.captionColor,
		});
	}

	onMount(async () => {
		const {
			data: { user },
		} = await supabase.auth.getUser();
		if (!user) {
			goto('/login');
			return;
		}
		userId = user.id;
		brandKit = loadBrandKit(user.id);
		const caps = captionDefaultsFromKit(brandKit);
		const show = createBlankShow(coerceTemplateId(brandKit.defaultTemplateId), caps, 3);
		shows = [show];
		selectedShowId = show.id;

		const from = $page.url.searchParams.get('from');
		if (from === 'clip') {
			const handoff = takeBulkClipHandoff() ?? peekBulkClipHandoff();
			if (handoff) {
				clipHandoff = handoff;
				const slide = activeSlideOf(show);
				const c = handoff.captions;
				updateSlide(show.id, slide.id, {
					mediaUrl: handoff.videoUrl,
					mediaKind: 'video',
					mediaThumb: handoff.thumbnailUrl ?? '',
					captions: c
						? defaultRowCaptions({
								enabled: c.enabled !== false,
								templateId: c.templateId || brandKit.captionTemplateId,
								fontSize: c.fontSize || brandKit.captionFontSize,
								position: c.position || brandKit.captionPosition,
								color: c.customColor || brandKit.captionColor,
							})
						: slide.captions,
				});
			}
		}
	});

	function selectShow(id: string) {
		selectedShowId = id;
	}

	function selectSlide(showId: string, slideId: string) {
		shows = shows.map((s) => (s.id === showId ? { ...s, activeSlideId: slideId } : s));
		selectedShowId = showId;
	}

	function updateShow(id: string, patch: Partial<BulkShow>) {
		shows = shows.map((s) => (s.id === id ? { ...s, ...patch } : s));
	}

	function updateSlide(showId: string, slideId: string, patch: Partial<BulkSlide>) {
		shows = shows.map((s) => {
			if (s.id !== showId) return s;
			return {
				...s,
				slides: s.slides.map((sl) => (sl.id === slideId ? { ...sl, ...patch } : sl)),
			};
		});
	}

	function updateActiveCaptions(showId: string, patch: Partial<BulkSlide['captions']>) {
		const show = shows.find((s) => s.id === showId);
		if (!show) return;
		const slide = activeSlideOf(show);
		updateSlide(showId, slide.id, { captions: { ...slide.captions, ...patch } });
	}

	function setSlideTemplate(showId: string, slideId: string, template: TemplateId) {
		const next = coerceTemplateId(template);
		const current = shows.find((s) => s.id === showId)?.slides.find((sl) => sl.id === slideId);
		const usesMedia = templateUsesStockMedia(next);
		const wantsVideo = templateUsesStockVideo(next);
		// A photo can't stand in for a video template (and vice versa), so refetch on a kind switch.
		const mediaStillUsable =
			!!String(current?.mediaUrl ?? '').trim() &&
			(wantsVideo ? current?.mediaKind === 'video' : current?.mediaKind !== 'video');

		updateSlide(showId, slideId, {
			template: next,
			...(usesMedia ? {} : { mediaUrl: '', mediaKind: null, mediaThumb: '' }),
		});

		if (autoStock && usesMedia && !mediaStillUsable) {
			void fillStockForSlide(showId, slideId);
		}
	}

	function addShow() {
		const show = createBlankShow(
			coerceTemplateId(brandKit.defaultTemplateId),
			captionDefaultsFromKit(brandKit),
			slidesPerShow,
		);
		shows = [...shows, show];
		selectedShowId = show.id;
		if (autoStock) {
			void fillStockForShows([show.id], { force: true });
		}
	}

	function duplicateShow(id: string) {
		const src = shows.find((s) => s.id === id);
		if (!src) return;
		const slides = src.slides.map((sl) => ({
			...sl,
			id: crypto.randomUUID(),
			captions: { ...sl.captions },
		}));
		const copy: BulkShow = {
			...src,
			id: crypto.randomUUID(),
			title: src.title ? `${src.title} (copy)` : '',
			slides,
			activeSlideId: slides[0]?.id ?? '',
		};
		const idx = shows.findIndex((s) => s.id === id);
		shows = [...shows.slice(0, idx + 1), copy, ...shows.slice(idx + 1)];
		selectedShowId = copy.id;
	}

	function deleteShow(id: string) {
		if (shows.length <= 1) {
			const show = createBlankShow(
				coerceTemplateId(brandKit.defaultTemplateId),
				captionDefaultsFromKit(brandKit),
				3,
			);
			shows = [show];
			selectedShowId = show.id;
			captionsMenuShowId = null;
			return;
		}
		const idx = shows.findIndex((s) => s.id === id);
		shows = shows.filter((s) => s.id !== id);
		selectedShowId = shows[Math.max(0, idx - 1)]?.id ?? shows[0]?.id ?? null;
		if (captionsMenuShowId === id) captionsMenuShowId = null;
	}

	function moveShow(id: string, dir: -1 | 1) {
		const idx = shows.findIndex((s) => s.id === id);
		const next = idx + dir;
		if (idx < 0 || next < 0 || next >= shows.length) return;
		const copy = [...shows];
		const [item] = copy.splice(idx, 1);
		copy.splice(next, 0, item);
		shows = copy;
	}

	function addSlideToShow(showId: string) {
		const caps = captionDefaultsFromKit(brandKit);
		const slide = createBlankSlide(coerceTemplateId(brandKit.defaultTemplateId), caps);
		shows = shows.map((s) =>
			s.id === showId ? { ...s, slides: [...s.slides, slide], activeSlideId: slide.id } : s,
		);
		selectedShowId = showId;
		if (autoStock && templateUsesStockMedia(slide.template)) {
			void fillStockForSlide(showId, slide.id);
		}
	}

	function removeSlideFromShow(showId: string, slideId: string) {
		shows = shows.map((s) => {
			if (s.id !== showId) return s;
			if (s.slides.length <= 1) return s;
			const slides = s.slides.filter((sl) => sl.id !== slideId);
			const activeSlideId =
				s.activeSlideId === slideId ? slides[0]!.id : s.activeSlideId;
			return { ...s, slides, activeSlideId };
		});
	}

	function applyPasteLines() {
		const lines = pasteText
			.split(/\n/)
			.map((l) => stripEmDashes(l))
			.filter(Boolean);
		if (!lines.length) return;
		const caps = captionDefaultsFromKit(brandKit);
		const t = coerceTemplateId(brandKit.defaultTemplateId);
		const newShows = lines.map((title) => {
			const show = createBlankShow(t, caps, slidesPerShow);
			show.title = title;
			if (show.slides[0]) show.slides[0].headline = title;
			return show;
		});
		shows = appendMode ? [...shows, ...newShows] : newShows;
		selectedShowId = shows[0]?.id ?? null;
		pasteOpen = false;
		pasteText = '';
	}

	async function fillStockForShows(showIds?: string[], opts?: { force?: boolean }) {
		const force = opts?.force === true;
		const targetShows = shows.filter((s) => !showIds || showIds.includes(s.id));
		const targets: { showId: string; slideId: string; slide: BulkSlide; showTitle: string }[] = [];
		for (const show of targetShows) {
			for (const slide of show.slides) {
				if (!templateUsesStockMedia(slide.template)) continue;
				if (!force && String(slide.mediaUrl ?? '').trim()) continue;
				targets.push({
					showId: show.id,
					slideId: slide.id,
					slide,
					showTitle: show.title,
				});
			}
		}
		if (!targets.length) {
			stockNote = 'No image/video slides to fill';
			setTimeout(() => (stockNote = ''), 2500);
			return;
		}
		stockFilling = true;
		stockNote = `Finding stock for ${targets.length} slide${targets.length === 1 ? '' : 's'}…`;
		const loading = new Set(targets.map((t) => t.slideId));
		shows = shows.map((s) => ({
			...s,
			slides: s.slides.map((sl) => (loading.has(sl.id) ? { ...sl, mediaLoading: true } : sl)),
		}));

		const topicHint = topic.trim();
		const results = await mapPool(targets, 3, async ({ showId, slideId, slide, showTitle }) => {
			try {
				const pick = await resolveStockForTemplate(
					slide.template,
					slide.headline || showTitle,
					slide.body,
					[topicHint, showTitle].filter(Boolean).join(' '),
				);
				return {
					showId,
					slideId,
					ok: !!pick?.url,
					patch: {
						mediaLoading: false,
						mediaUrl: pick?.url ?? slide.mediaUrl ?? '',
						mediaKind: pick?.kind ?? slide.mediaKind ?? null,
						mediaThumb: pick?.thumb ?? slide.mediaThumb ?? '',
					} satisfies Partial<BulkSlide>,
					error: pick?.url ? '' : 'no match',
				};
			} catch (e: unknown) {
				return {
					showId,
					slideId,
					ok: false,
					patch: { mediaLoading: false } satisfies Partial<BulkSlide>,
					error: e instanceof Error ? e.message : 'stock failed',
				};
			}
		});

		// Apply all patches in one write to avoid concurrent update races
		const byKey = new Map(results.map((r) => [`${r.showId}:${r.slideId}`, r.patch]));
		shows = shows.map((s) => ({
			...s,
			slides: s.slides.map((sl) => {
				const patch = byKey.get(`${s.id}:${sl.id}`);
				return patch ? { ...sl, ...patch } : sl;
			}),
		}));

		stockFilling = false;
		const filled = results.filter((r) => r.ok).length;
		const failed = results.length - filled;
		if (filled === 0) {
			const sampleErr = results.find((r) => r.error)?.error;
			stockNote = sampleErr
				? `Stock failed: ${sampleErr}`
				: 'Stock found nothing — check Unsplash/Pexels keys or try Fill stock again';
		} else if (failed > 0) {
			stockNote = `Stock filled ${filled}/${results.length} slides`;
		} else {
			stockNote = `Stock filled ${filled} slide${filled === 1 ? '' : 's'}`;
		}
		setTimeout(() => (stockNote = ''), 4000);
	}

	async function fillStockForSlide(showId: string, slideId: string) {
		const show = shows.find((s) => s.id === showId);
		const slide = show?.slides.find((s) => s.id === slideId);
		if (!show || !slide || !templateUsesStockMedia(slide.template)) return;
		updateSlide(showId, slideId, { mediaLoading: true });
		try {
			const pick = await resolveStockForTemplate(
				slide.template,
				slide.headline || show.title,
				slide.body,
				[topic.trim(), show.title].filter(Boolean).join(' '),
			);
			updateSlide(showId, slideId, {
				mediaLoading: false,
				mediaUrl: pick?.url ?? '',
				mediaKind: pick?.kind ?? null,
				mediaThumb: pick?.thumb ?? '',
			});
			stockNote = pick?.url
				? `Stock set (${pick.source ?? 'stock'})`
				: 'No stock match for this slide';
			setTimeout(() => (stockNote = ''), 2500);
		} catch (e: unknown) {
			updateSlide(showId, slideId, { mediaLoading: false });
			stockNote = e instanceof Error ? e.message : 'Stock failed';
			setTimeout(() => (stockNote = ''), 3000);
		}
	}

	async function generateIdeas() {
		const t = topic.trim();
		if (!t || generating) return;
		generating = true;
		generateError = '';
		try {
			const res = await fetch('/api/generate-slides', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					topic: t,
					style,
					slideCount: slidesPerShow,
					deckCount: ideaCount,
					imageCount: 0,
					audience: audiencePromptText(audienceId, audience) || 'general audience',
					emotion: emotion || undefined,
				}),
			});
			const data = await res.json();
			if (!res.ok) throw new Error(data?.error || `Generate failed (${res.status})`);

			const caps = captionDefaultsFromKit(brandKit);
			let decks = Array.isArray(data.decks) ? data.decks : [];
			// Fallback: single carousel → one show
			if (!decks.length && Array.isArray(data.slides)) {
				decks = [{ title: t.slice(0, 48), slides: data.slides }];
			}
			if (!decks.length) throw new Error('No slideshows returned');

			const newShows: BulkShow[] = decks.map((d: any) => {
				const slidesRaw = Array.isArray(d.slides) ? d.slides : [];
				const slides: BulkSlide[] = slidesRaw.map((s: any) => ({
					id: crypto.randomUUID(),
					template: templateForSlideType(s.type),
					headline: stripEmDashes(String(s.headline ?? '')),
					body: stripEmDashes(String(s.body ?? s.subheadline ?? '')),
					captions: { ...caps },
				}));
				if (!slides.length) slides.push(createBlankSlide('news', caps));
				return {
					id: crypto.randomUUID(),
					title: stripEmDashes(String(d.title ?? '')),
					slides,
					activeSlideId: slides[0]!.id,
				};
			});

			shows = appendMode ? [...shows, ...newShows] : newShows;
			selectedShowId = shows[0]?.id ?? null;
			captionsMenuShowId = null;
			if (autoStock) {
				await fillStockForShows(
					newShows.map((s) => s.id),
					{ force: true },
				);
			}
		} catch (e: any) {
			generateError = e?.message || 'Failed to generate ideas';
		} finally {
			generating = false;
		}
	}

	function onGenerateKeydown(e: KeyboardEvent) {
		if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
			e.preventDefault();
			void generateIdeas();
		}
	}

	function saveBrand() {
		if (!userId || !activeSlide) return;
		brandKit = {
			...brandKit,
			captionTemplateId: activeSlide.captions.templateId,
			captionPosition: activeSlide.captions.position,
			captionFontSize: activeSlide.captions.fontSize,
			captionColor: activeSlide.captions.color,
			captionEnabledDefault: activeSlide.captions.enabled,
		};
		const ok = saveBrandKit(userId, brandKit);
		brandSavedNote = ok ? 'Brand saved' : 'Could not save';
		setTimeout(() => (brandSavedNote = ''), 2000);
	}

	function saveCaptionAsBrand(slide: BulkSlide) {
		if (!userId) return;
		brandKit = mergeCaptionDefaultsIntoKit(
			{ ...brandKit, captionEnabledDefault: slide.captions.enabled },
			{
				captionTemplateId: slide.captions.templateId,
				captionPosition: slide.captions.position,
				captionFontSize: slide.captions.fontSize,
				captionColor: slide.captions.color,
			},
		);
		saveBrandKit(userId, brandKit);
		brandSavedNote = 'Caption defaults saved';
		setTimeout(() => (brandSavedNote = ''), 2000);
	}

	function openShowInStudio(show: BulkShow) {
		const state = buildDraftStateFromShow(show, {
			brandCtaEnabled: !!(brandKit.cta.headline || brandKit.cta.image),
		});
		stashBulkImport(state);
		goto('/dashboard/studio?from=bulk');
	}

	function openInStudio() {
		if (!selectedShow) return;
		openShowInStudio(selectedShow);
	}

	function templateLabel(id: TemplateId): string {
		return STUDIO_TEMPLATES.find((t) => t.id === id)?.label ?? id;
	}

	function toggleCaptionsMenu(showId: string) {
		selectShow(showId);
		captionsMenuShowId = captionsMenuShowId === showId ? null : showId;
	}
</script>

<svelte:head>
	<title>Bulk - Social Poster</title>
</svelte:head>

<svelte:window onkeydown={onGenerateKeydown} />

<div class="bulk">
	<header class="bulk-header">
		<div class="bulk-header-text">
			<h1>Bulk editor</h1>
			<p>Each row is one idea = one full slideshow. Generate many decks, preview every slide, open one in Studio.</p>
		</div>
		<div class="bulk-header-actions">
			<button type="button" class="btn-ghost" onclick={() => (showBrandPanel = !showBrandPanel)}>
				<Palette size={15} />
				Brand
			</button>
			<!-- <button type="button" class="btn-primary" onclick={openInStudio} disabled={!selectedShow}>
				Studio
				<ArrowRight size={15} />
			</button> -->
		</div>
	</header>

	{#if brandSavedNote}
		<p class="saved-toast" role="status">{brandSavedNote}</p>
	{/if}

	{#if showBrandPanel}
		<section class="brand-panel" aria-label="Brand settings">
			<div class="brand-grid">
				<label class="field">
					<span>Logo URL</span>
					<input bind:value={brandKit.logoUrl} placeholder="https://…" />
				</label>
				<label class="field">
					<span>Primary</span>
					<input type="color" bind:value={brandKit.primaryColor} />
				</label>
				<label class="field">
					<span>Accent</span>
					<input type="color" bind:value={brandKit.accentColor} />
				</label>
				<label class="field">
					<span>Headline font</span>
					<select bind:value={brandKit.headlineFont}>
						{#each GOOGLE_FONTS as f}
							<option value={f.family}>{f.family}</option>
						{/each}
					</select>
				</label>
				<label class="field">
					<span>Default template</span>
					<select bind:value={brandKit.defaultTemplateId}>
						{#each STUDIO_TEMPLATES as t}
							<option value={t.id}>{t.label}</option>
						{/each}
					</select>
				</label>
				<label class="field">
					<span>Caption size</span>
					<input type="number" min="16" max="64" bind:value={brandKit.captionFontSize} />
				</label>
				<label class="field check">
					<span>Captions on by default</span>
					<input type="checkbox" bind:checked={brandKit.captionEnabledDefault} />
				</label>
			</div>
			<div class="brand-actions">
				<button type="button" class="btn-primary" onclick={saveBrand}>
					<Save size={14} /> Save brand
				</button>
			</div>
		</section>
	{/if}

	<section class="generate-bar" aria-label="Generate ideas">
		<label class="field grow">
			<span>Topic</span>
			<input
				bind:value={topic}
				placeholder="e.g. regenerative medicine breakthroughs"
				onkeydown={(e) => e.key === 'Enter' && !e.metaKey && !e.ctrlKey && e.preventDefault()}
			/>
		</label>
		<label class="field">
			<span>Audience</span>
			<select bind:value={audienceId}>
				{#each BULK_AUDIENCES as a}
					<option value={a.id}>{a.label}</option>
				{/each}
			</select>
		</label>
		{#if audienceId === 'custom'}
			<label class="field">
				<span>Describe audience</span>
				<input bind:value={audience} placeholder="e.g. first-time home buyers" />
			</label>
		{/if}
		<label class="field">
			<span>Style</span>
			<select bind:value={style}>
				<option value="bold">Bold</option>
				<option value="dark">Dark</option>
				<option value="editorial">Editorial</option>
				<option value="minimal">Minimal</option>
			</select>
		</label>
		<label class="field">
			<span>Emotion</span>
			<select bind:value={emotion}>
				{#each BULK_EMOTIONS as e}
					<option value={e.id}>{e.label}</option>
				{/each}
			</select>
		</label>
		<label class="field count">
			<span>Ideas ({ideaCount})</span>
			<input type="range" min="1" max="8" bind:value={ideaCount} />
		</label>
		<label class="field count">
			<span>Slides/show ({slidesPerShow})</span>
			<input type="range" min="3" max="8" bind:value={slidesPerShow} />
		</label>
		<label class="append-toggle">
			<input type="checkbox" bind:checked={appendMode} />
			Append
		</label>
		<label class="append-toggle" title="Only image & video templates">
			<input type="checkbox" bind:checked={autoStock} />
			Auto stock
		</label>
		<button type="button" class="btn-primary" onclick={() => void generateIdeas()} disabled={generating || !topic.trim()}>
			{#if generating}
				<Loader2 size={15} class="spin" />
				Generating…
			{:else}
				<Sparkles size={15} />
				Generate
			{/if}
		</button>
	</section>
	{#if generateError}
		<p class="err" role="alert">{generateError}</p>
	{/if}
	{#if stockNote}
		<p class="stock-note" role="status">{stockNote}</p>
	{/if}
	{#if clipHandoff}
		<p class="clip-banner" role="status">Clip from Videos attached to the first slide of the selected show.</p>
	{/if}

	<section class="stack-wrap" aria-label="Slideshow stack">
		<div class="rows-toolbar">
			<span class="rows-count"><Layers size={14} /> {shows.length} slideshows</span>
			<div class="rows-toolbar-actions">
				<button
					type="button"
					class="btn-ghost sm"
					onclick={() => void fillStockForShows(undefined, { force: true })}
					disabled={stockFilling}
				>
					{#if stockFilling}
						<Loader2 size={13} class="spin" />
					{:else}
						<Image size={13} />
					{/if}
					Fill stock
				</button>
				<button type="button" class="btn-ghost sm" onclick={() => (pasteOpen = !pasteOpen)}>
					<Type size={13} /> Paste ideas
				</button>
				<button type="button" class="btn-ghost sm" onclick={addShow}>
					<Plus size={13} /> Add slideshow
				</button>
			</div>
		</div>

		{#if pasteOpen}
			<div class="paste-box">
				<textarea bind:value={pasteText} rows="3" placeholder="One idea title per line…"></textarea>
				<button type="button" class="btn-primary sm" onclick={applyPasteLines}>Apply lines</button>
			</div>
		{/if}

		<ul class="show-stack">
			{#each shows as show, i (show.id)}
				{@const slide = activeSlideOf(show)}
				{@const activeIdx = Math.max(
					0,
					show.slides.findIndex((s) => s.id === show.activeSlideId),
				)}
				{@const activeSl = show.slides[activeIdx] ?? show.slides[0]}
				<li class="show-row" class:show-on={show.id === selectedShow?.id}>
					<div class="show-head">
						<button type="button" class="show-index" onclick={() => selectShow(show.id)}>{i + 1}</button>
						<input
							class="show-title"
							value={show.title}
							oninput={(e) => updateShow(show.id, { title: (e.currentTarget as HTMLInputElement).value })}
							onfocus={() => selectShow(show.id)}
							placeholder="Slideshow idea title"
						/>
						<span class="show-meta">{show.slides.length} slides</span>
						<div class="show-actions">
							<button type="button" class="icon-btn" title="Move up" onclick={() => moveShow(show.id, -1)} disabled={i === 0}>
								<ChevronUp size={14} />
							</button>
							<button
								type="button"
								class="icon-btn"
								title="Move down"
								onclick={() => moveShow(show.id, 1)}
								disabled={i === shows.length - 1}
							>
								<ChevronDown size={14} />
							</button>
							<button type="button" class="icon-btn" title="Duplicate" onclick={() => duplicateShow(show.id)}>
								<Copy size={14} />
							</button>
							<button type="button" class="icon-btn danger" title="Delete" onclick={() => deleteShow(show.id)}>
								<Trash2 size={14} />
							</button>
						</div>
					</div>

					<div class="show-body">
						<!-- Carousel: left-aligned preview + dots -->
						<div class="slide-carousel" aria-label="Slide carousel">
							{#if activeSl}
								<div class="carousel-stage">
									<button
										type="button"
										class="carousel-nav prev"
										title="Previous slide"
										aria-label="Previous slide"
										disabled={show.slides.length < 2}
										onclick={() => {
											const next =
												show.slides[(activeIdx - 1 + show.slides.length) % show.slides.length];
											if (next) selectSlide(show.id, next.id);
										}}
									>
										<ChevronLeft size={18} />
									</button>
									<div class="carousel-frame">
										<span class="film-num">{activeIdx + 1}</span>
										<BulkSlidePreview slide={activeSl} width={200} />
									</div>
									<button
										type="button"
										class="carousel-nav next"
										title="Next slide"
										aria-label="Next slide"
										disabled={show.slides.length < 2}
										onclick={() => {
											const next = show.slides[(activeIdx + 1) % show.slides.length];
											if (next) selectSlide(show.id, next.id);
										}}
									>
										<ChevronRight size={18} />
									</button>
								</div>
							{/if}
							<div class="carousel-dots" role="tablist" aria-label="Slides">
								{#each show.slides as sl, si (sl.id)}
									{#if sl}
										<button
											type="button"
											class="dot"
											class:dot-on={sl.id === show.activeSlideId}
											role="tab"
											aria-selected={sl.id === show.activeSlideId}
											aria-label={`Slide ${si + 1}`}
											title={`Slide ${si + 1}`}
											onclick={() => selectSlide(show.id, sl.id)}
										></button>
									{/if}
								{/each}
								<button
									type="button"
									class="dot-add"
									title="Add slide"
									aria-label="Add slide"
									onclick={() => addSlideToShow(show.id)}
								>
									<Plus size={12} />
								</button>
							</div>
						</div>

						<!-- Editor fills unused space -->
						<div class="slide-editor">
							<div class="slide-main">
								<select
									class="tpl-select"
									value={slide.template}
									onchange={(e) =>
										setSlideTemplate(show.id, slide.id, (e.currentTarget as HTMLSelectElement).value as TemplateId)}
								>
									{#each STUDIO_TEMPLATES as t}
										<option value={t.id}>{t.label}</option>
									{/each}
								</select>
								<input
									class="slide-headline"
									value={slide.headline}
									oninput={(e) =>
										updateSlide(show.id, slide.id, {
											headline: (e.currentTarget as HTMLInputElement).value,
										})}
									placeholder="Slide headline / hook"
								/>
								{#if show.slides.length > 1}
									<button
										type="button"
										class="icon-btn remove-slide"
										title="Remove slide"
										aria-label="Remove slide"
										onclick={() => removeSlideFromShow(show.id, slide.id)}
									>
										<X size={16} />
									</button>
								{/if}
							</div>

							{#if rowNeedsBody(slide.template)}
								<textarea
									class="slide-body-text"
									rows="3"
									value={slide.body}
									oninput={(e) =>
										updateSlide(show.id, slide.id, {
											body: (e.currentTarget as HTMLTextAreaElement).value,
										})}
									placeholder="Body copy"
								></textarea>
							{/if}

							<div class="slide-menu">
								<button
									type="button"
									class="menu-item"
									class:menu-item-on={captionsMenuShowId === show.id}
									class:menu-item-active={slide.captions.enabled}
									onclick={() => toggleCaptionsMenu(show.id)}
								>
									{#if captionsMenuShowId === show.id}
										<ChevronDown size={14} />
									{:else}
										<ChevronRight size={14} />
									{/if}
									<Captions size={14} />
									Captions
									{#if slide.captions.enabled}
										<span class="menu-pill">on</span>
									{:else}
										<span class="menu-pill muted">off</span>
									{/if}
								</button>
								{#if templateUsesStockMedia(slide.template)}
									<button
										type="button"
										class="menu-item"
										disabled={slide.mediaLoading}
										onclick={() => void fillStockForSlide(show.id, slide.id)}
									>
										{#if slide.mediaLoading}
											<Loader2 size={14} class="spin" />
										{:else}
											<Image size={14} />
										{/if}
										Stock
										{#if slide.mediaUrl}
											<span class="menu-pill">set</span>
										{/if}
									</button>
								{/if}
								<span class="tpl-hint">{templateLabel(slide.template)}</span>
							</div>

							{#if captionsMenuShowId === show.id}
								<div class="captions-drawer">
									<label class="cap-enable">
										<input
											type="checkbox"
											checked={slide.captions.enabled}
											onchange={(e) =>
												updateActiveCaptions(show.id, {
													enabled: (e.currentTarget as HTMLInputElement).checked,
												})}
										/>
										Enable captions on this slide
									</label>
									{#if slide.captions.enabled}
										<div class="cap-grid">
											<label class="field">
												<span>Style</span>
												<select
													value={slide.captions.templateId}
													onchange={(e) =>
														updateActiveCaptions(show.id, {
															templateId: (e.currentTarget as HTMLSelectElement).value,
														})}
												>
													{#each CAPTION_TEMPLATES as t}
														<option value={t.id}>{t.name}</option>
													{/each}
												</select>
											</label>
											<label class="field">
												<span>Size</span>
												<input
													type="number"
													min="16"
													max="64"
													value={slide.captions.fontSize}
													oninput={(e) =>
														updateActiveCaptions(show.id, {
															fontSize: Number((e.currentTarget as HTMLInputElement).value) || 28,
														})}
												/>
											</label>
											<label class="field">
												<span>Position</span>
												<select
													value={slide.captions.position}
													onchange={(e) =>
														updateActiveCaptions(show.id, {
															position: (e.currentTarget as HTMLSelectElement).value as
																| 'top'
																| 'center'
																| 'bottom',
														})}
												>
													<option value="top">Top</option>
													<option value="center">Center</option>
													<option value="bottom">Bottom</option>
												</select>
											</label>
											<label class="field">
												<span>Color</span>
												<input
													type="color"
													value={slide.captions.color}
													oninput={(e) =>
														updateActiveCaptions(show.id, {
															color: (e.currentTarget as HTMLInputElement).value,
														})}
												/>
											</label>
										</div>
										<button type="button" class="btn-ghost sm" onclick={() => saveCaptionAsBrand(slide)}>
											Save as brand defaults
										</button>
									{/if}
								</div>
							{/if}
						</div>
					</div>

					<button
						type="button"
						class="studio-fab"
						onclick={() => openShowInStudio(show)}
						title="Edit this slideshow in Studio"
					>
						Edit in Studio
						<ArrowRight size={15} />
					</button>
				</li>
			{/each}
		</ul>
	</section>
</div>

<style>
	.bulk {
		--bulk-border: color-mix(in oklab, var(--app-border) 80%, transparent);
		--stack-bar: var(--app-surface-3);
		--stack-bar-on: color-mix(in oklab, var(--app-text) 8%, var(--app-surface-3));
		padding: 1.25rem 1.5rem 2.5rem;
		max-width: 1200px;
		margin: 0 auto;
		color: var(--app-text);
	}
	.bulk-header {
		display: flex;
		flex-wrap: wrap;
		justify-content: space-between;
		gap: 1rem;
		margin-bottom: 1rem;
	}
	.bulk-header h1 {
		font-size: 1.35rem;
		font-weight: 700;
		margin: 0 0 0.25rem;
	}
	.bulk-header p {
		margin: 0;
		font-size: 0.8125rem;
		color: var(--app-text-3);
		max-width: 40rem;
		line-height: 1.45;
	}
	.bulk-header-actions {
		display: flex;
		gap: 0.5rem;
	}
	.saved-toast,
	.stock-note,
	.clip-banner {
		font-size: 0.75rem;
		color: var(--app-text-2);
		margin: 0 0 0.65rem;
	}
	.brand-panel {
		border: 1px solid var(--bulk-border);
		border-radius: 10px;
		padding: 1rem;
		margin-bottom: 1rem;
		background: var(--app-surface-2);
	}
	.brand-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
		gap: 0.75rem;
	}
	.brand-actions {
		margin-top: 0.85rem;
	}
	.generate-bar {
		display: flex;
		flex-wrap: wrap;
		gap: 0.55rem;
		align-items: flex-end;
		margin-bottom: 0.75rem;
		padding: 0.75rem;
		border: 1px solid var(--bulk-border);
		border-radius: 10px;
		background: var(--app-surface-2);
	}
	.field {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		font-size: 0.6875rem;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: var(--app-text-3);
		min-width: 0;
	}
	.field.grow {
		flex: 1 1 180px;
	}
	.field.count {
		width: 130px;
	}
	.field.check {
		flex-direction: row;
		align-items: center;
		gap: 0.5rem;
		text-transform: none;
		letter-spacing: normal;
		font-size: 0.75rem;
		color: var(--app-text-2);
	}
	.field input,
	.field select,
	.paste-box textarea,
	.tpl-select,
	.slide-headline,
	.slide-body-text,
	.show-title,
	.cap-grid input,
	.cap-grid select {
		font: inherit;
		font-size: 0.8125rem;
		text-transform: none;
		letter-spacing: normal;
		color: var(--app-text);
		background: var(--app-surface-3);
		border: 1px solid var(--bulk-border);
		border-radius: 6px;
		padding: 0.4rem 0.5rem;
	}
	.field input[type='color'] {
		padding: 0.1rem;
		height: 2rem;
	}
	.field input[type='range'] {
		padding: 0;
		border: none;
		background: transparent;
	}
	.append-toggle {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		font-size: 0.75rem;
		color: var(--app-text-2);
		padding-bottom: 0.3rem;
	}
	.err {
		color: #e11d48;
		font-size: 0.8125rem;
		margin: 0 0 0.65rem;
	}
	.stack-wrap {
		border: 1px solid var(--bulk-border);
		border-radius: 12px;
		background: var(--app-surface-2);
		padding: 0.75rem;
	}
	.rows-toolbar {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 0.55rem;
	}
	.rows-count {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		font-size: 0.75rem;
		color: var(--app-text-2);
	}
	.rows-toolbar-actions {
		display: flex;
		gap: 0.35rem;
		flex-wrap: wrap;
	}
	.paste-box {
		display: flex;
		flex-direction: column;
		gap: 0.45rem;
		margin-bottom: 0.65rem;
	}
	.show-stack {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 10px;
	}
	.show-row {
		position: relative;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		padding: 0.85rem 0.75rem 1rem;
		min-height: 220px;
		border-radius: 12px;
		background: var(--stack-bar);
		border: 1px solid var(--bulk-border);
	}
	.show-row.show-on {
		background: var(--stack-bar-on);
		border-color: color-mix(in oklab, var(--app-text) 22%, var(--bulk-border));
	}
	.show-head {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.45rem;
		padding-right: 0.25rem;
	}
	.show-index {
		width: 2.1rem;
		height: 2.1rem;
		border-radius: 7px;
		border: none;
		background: color-mix(in oklab, var(--app-text) 12%, transparent);
		color: var(--app-text);
		font-weight: 700;
		cursor: pointer;
	}
	.show-title {
		flex: 1 1 200px;
		font-weight: 650;
		background: var(--app-surface);
	}
	.show-meta {
		font-size: 0.7rem;
		color: var(--app-text-3);
	}
	.show-actions {
		display: flex;
		gap: 0.1rem;
		margin-left: auto;
	}
	.show-body {
		display: flex;
		align-items: stretch;
		gap: 1rem;
		min-width: 0;
	}
	.slide-carousel {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 0.55rem;
		flex: 0 0 auto;
		padding: 0.1rem 0;
	}
	.carousel-stage {
		display: flex;
		align-items: center;
		gap: 0.4rem;
	}
	.carousel-frame {
		position: relative;
		line-height: 0;
		border-radius: 12px;
		overflow: hidden;
		box-shadow: 0 2px 10px color-mix(in oklab, var(--app-text) 12%, transparent);
	}
	.film-num {
		position: absolute;
		top: 6px;
		left: 6px;
		z-index: 2;
		font-size: 0.625rem;
		font-weight: 700;
		color: #fff;
		background: rgba(0, 0, 0, 0.55);
		border-radius: 4px;
		padding: 0.1rem 0.3rem;
		line-height: 1.2;
	}
	.carousel-nav {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 1.85rem;
		height: 1.85rem;
		border-radius: 999px;
		border: 1px solid var(--bulk-border);
		background: var(--app-surface);
		color: var(--app-text-2);
		cursor: pointer;
		flex-shrink: 0;
	}
	.carousel-nav:hover:not(:disabled) {
		color: var(--app-text);
		background: color-mix(in oklab, var(--app-text) 6%, var(--app-surface));
	}
	.carousel-nav:disabled {
		opacity: 0.35;
		cursor: default;
	}
	.carousel-dots {
		display: flex;
		align-items: center;
		justify-content: flex-start;
		gap: 0.4rem;
		flex-wrap: wrap;
		padding-left: 2.25rem;
	}
	.dot {
		width: 0.55rem;
		height: 0.55rem;
		padding: 0;
		border: none;
		border-radius: 999px;
		background: color-mix(in oklab, var(--app-text) 22%, transparent);
		cursor: pointer;
		transition: width 0.15s ease, background 0.15s ease;
	}
	.dot:hover {
		background: color-mix(in oklab, var(--app-text) 40%, transparent);
	}
	.dot.dot-on {
		width: 1.15rem;
		background: var(--app-text);
	}
	.dot-add {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 1.25rem;
		height: 1.25rem;
		border-radius: 999px;
		border: 1px dashed color-mix(in oklab, var(--app-text) 30%, transparent);
		background: transparent;
		color: var(--app-text-3);
		cursor: pointer;
		padding: 0;
	}
	.dot-add:hover {
		color: var(--app-text);
		border-color: color-mix(in oklab, var(--app-text) 50%, transparent);
	}
	.slide-editor {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		padding: 0.7rem 0.75rem 0.85rem;
		border-radius: 10px;
		background: color-mix(in oklab, var(--app-text) 5%, var(--app-surface));
		border: 1px solid var(--bulk-border);
		flex: 1 1 0;
		min-width: 0;
		padding-bottom: 3.1rem;
	}
	.studio-fab {
		position: absolute;
		right: 1rem;
		bottom: 1rem;
		z-index: 3;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.4rem;
		padding: 0.65rem 1rem;
		border: none;
		border-radius: 999px;
		background: var(--app-text);
		color: var(--app-surface);
		font-size: 0.8125rem;
		font-weight: 650;
		cursor: pointer;
		box-shadow: 0 8px 24px color-mix(in oklab, var(--app-text) 28%, transparent);
	}
	.studio-fab:hover {
		transform: translateY(-1px);
		box-shadow: 0 10px 28px color-mix(in oklab, var(--app-text) 34%, transparent);
	}
	@media (max-width: 820px) {
		.show-body {
			flex-direction: column;
		}
		.slide-carousel {
			align-items: center;
			width: 100%;
		}
		.carousel-dots {
			justify-content: center;
			padding-left: 0;
		}
		.slide-editor {
			padding-bottom: 0.85rem;
		}
		.studio-fab {
			position: static;
			width: 100%;
			margin-top: 0.15rem;
			border-radius: 10px;
		}
	}
	.slide-main {
		display: flex;
		flex-wrap: wrap;
		gap: 0.35rem;
		align-items: center;
	}
	.tpl-select {
		background: var(--app-surface);
	}
	.slide-headline {
		flex: 1 1 180px;
		background: var(--app-surface);
		font-weight: 550;
	}
	.slide-body-text {
		width: 100%;
		resize: vertical;
		min-height: 2.6rem;
		background: var(--app-surface);
	}
	.slide-menu {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		flex-wrap: wrap;
	}
	.menu-item {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		border: 1px solid var(--bulk-border);
		background: var(--app-surface);
		color: var(--app-text-2);
		border-radius: 6px;
		padding: 0.28rem 0.5rem;
		font-size: 0.75rem;
		font-weight: 550;
		cursor: pointer;
	}
	.menu-item:hover,
	.menu-item-on {
		background: color-mix(in oklab, var(--app-text) 6%, var(--app-surface));
		color: var(--app-text);
	}
	.menu-item-active {
		border-color: color-mix(in oklab, var(--app-text) 35%, var(--bulk-border));
	}
	.menu-pill {
		font-size: 0.625rem;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		padding: 0.1rem 0.35rem;
		border-radius: 999px;
		background: color-mix(in oklab, var(--app-text) 14%, transparent);
		color: var(--app-text);
	}
	.menu-pill.muted {
		background: color-mix(in oklab, var(--app-text) 8%, transparent);
		color: var(--app-text-3);
	}
	.tpl-hint {
		font-size: 0.65rem;
		color: var(--app-text-3);
	}
	.captions-drawer {
		padding: 0.55rem;
		border-radius: 8px;
		background: var(--app-surface);
		border: 1px solid var(--bulk-border);
		color: var(--app-text);
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}
	.cap-enable {
		display: flex;
		align-items: center;
		gap: 0.45rem;
		font-size: 0.8rem;
		cursor: pointer;
	}
	.cap-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(110px, 1fr));
		gap: 0.45rem;
	}
	.cap-grid .field {
		color: var(--app-text-3);
	}
	.cap-grid input,
	.cap-grid select {
		background: var(--app-surface-3);
		border-color: var(--bulk-border);
		color: var(--app-text);
	}
	.icon-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 1.55rem;
		height: 1.55rem;
		border: none;
		border-radius: 4px;
		background: transparent;
		color: var(--app-text-3);
		cursor: pointer;
	}
	.icon-btn:hover:not(:disabled) {
		background: color-mix(in oklab, var(--app-text) 8%, transparent);
		color: var(--app-text);
	}
	.icon-btn:disabled {
		opacity: 0.3;
	}
	.icon-btn.danger:hover:not(:disabled),
	.icon-btn.remove-slide:hover:not(:disabled) {
		color: #e11d48;
	}
	.remove-slide {
		margin-left: 0.15rem;
	}
	.btn-primary,
	.btn-ghost {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.35rem;
		border-radius: 7px;
		font-size: 0.8125rem;
		font-weight: 550;
		padding: 0.5rem 0.75rem;
		cursor: pointer;
		border: 1px solid transparent;
	}
	.btn-primary {
		background: var(--app-text);
		color: var(--app-surface);
	}
	.btn-primary:disabled {
		opacity: 0.45;
	}
	.btn-ghost {
		background: transparent;
		border-color: var(--bulk-border);
		color: var(--app-text-2);
	}
	.sm {
		padding: 0.35rem 0.55rem;
		font-size: 0.75rem;
	}
	:global(.spin) {
		animation: spin 0.8s linear infinite;
	}
	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}
</style>
