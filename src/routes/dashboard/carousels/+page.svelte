<script lang="ts">
	import { supabase } from '$lib/supabase';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { STARTER_TEMPLATES } from '$lib/templates';
	import NewsTemplate from '$lib/components/templates/NewsTemplate.svelte';
	import TweetTemplate from '$lib/components/templates/TweetTemplate.svelte';
	import TextCarouselTemplate from '$lib/components/templates/TextCarouselTemplate.svelte';
	import ArticleTemplate from '$lib/components/templates/ArticleTemplate.svelte';
	import ImageQuoteTemplate from '$lib/components/templates/ImageQuoteTemplate.svelte';
	import { ImagePlus, Plus, Trash2, Edit2, Clock, CheckCircle, FileText, Loader, ArrowRight, Wand2 } from 'lucide-svelte';

	let carousels: any[] = $state([]);
	let loading = $state(true);
	let creating = $state(false);
	let createError = $state('');
	let userId = $state('');

	// Preview scale for template cards — fixed 220px preview width
	const TEMPLATE_CARD_W = 220;
	const templateScale = TEMPLATE_CARD_W / 1080;

	onMount(async () => {
		const { data: { user } } = await supabase.auth.getUser();
		if (!user) { goto('/login'); return; }
		userId = user.id;

		const { data } = await (supabase as any).from('carousels').select('*').order('updated_at', { ascending: false });
		carousels = data ?? [];
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
			<p class="page-sub">Your carousel library — drafts, published, and scheduled</p>
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
		<div class="templates-header">
			<h2 class="templates-title">Start from a template</h2>
			<a href="/dashboard/carousels/new" class="templates-see-all">See all templates →</a>
		</div>

		<div class="flex gap-4 flex-wrap">
			{#each STARTER_TEMPLATES as tmpl}
				{@const hoverClass =
						tmpl.id === 'tweet'   ? 'hover:border-sky-500/40 hover:shadow-[0_0_28px_rgba(14,165,233,0.12)]'
						: tmpl.id === 'text'  ? 'hover:border-white/25 hover:shadow-[0_0_28px_rgba(255,255,255,0.06)]'
						: tmpl.id === 'article' ? 'hover:border-emerald-500/40 hover:shadow-[0_0_28px_rgba(52,211,153,0.12)]'
						: tmpl.id === 'brand' ? 'hover:border-violet-500/40 hover:shadow-[0_0_28px_rgba(139,92,246,0.15)]'
						: 'hover:border-amber-500/40 hover:shadow-[0_0_28px_rgba(245,166,35,0.12)]'}
				{@const arrowColor =
						tmpl.id === 'tweet'   ? 'group-hover:text-sky-400'
						: tmpl.id === 'text'  ? 'group-hover:text-white/70'
						: tmpl.id === 'article' ? 'group-hover:text-emerald-400'
						: tmpl.id === 'brand' ? 'group-hover:text-violet-400'
						: 'group-hover:text-amber-400'}
				<a
					href={tmpl.href}
					class="group flex flex-col rounded-2xl overflow-hidden border border-white/[0.08] transition-all duration-200 flex-shrink-0 {hoverClass}"
					style="width: {TEMPLATE_CARD_W}px;"
				>
					<!-- Preview area -->
					<div style="width: {TEMPLATE_CARD_W}px; height: {Math.round(TEMPLATE_CARD_W * 1350/1080)}px; overflow: hidden; flex-shrink: 0; position: relative;">
						{#if tmpl.id === 'news'}
							<NewsTemplate
								backgroundImage={tmpl.previewBg}
								text={tmpl.previewText}
								source={tmpl.previewSource}
								highlightColor="#F5A623"
								textColor="#FFFFFF"
								scale={templateScale}
								interactive={false}
							/>
						{:else if tmpl.id === 'tweet'}
							<TweetTemplate
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
						{:else if tmpl.id === 'image-quote'}
							<ImageQuoteTemplate
								image={tmpl.previewBg}
								text={"YOUR BIG STATEMENT GOES HERE.\nMAKE IT SHORT AND PUNCHY."}
								footerLeft="$"
								footerRight="WEALTHY SETUP"
								scale={templateScale}
								interactive={false}
							/>
						{:else if tmpl.id === 'text'}
							<TextCarouselTemplate
								name="Captains of industry"
								handle="@captainsofindustryy"
								text={"When your home is titled in your name, it becomes a legal target.\n\nCourts, creditors, and attorneys see it as your asset…"}
								showSwipe={true}
								scale={templateScale}
								interactive={false}
							/>
						{:else if tmpl.id === 'article'}
							<ArticleTemplate
								text={"Here's the trillion-dollar problem everyone avoids.\n\nA *1-gigawatt AI data center* costs roughly *$80B* to build & operate."}
								showSwipe={true}
								scale={templateScale}
								interactive={false}
							/>
						{:else if tmpl.id === 'brand'}
							<!-- Slideshows static preview -->
							<div style="
								width: 100%; height: 100%;
								background: linear-gradient(135deg, #0f0a1e 0%, #1a0f3a 45%, #0d1a2e 100%);
								display: flex; flex-direction: column;
								align-items: center; justify-content: center;
								gap: 14px; padding: 20px; position: relative; overflow: hidden;
							">
								<!-- Background glow -->
								<div style="position:absolute;top:-30px;left:50%;transform:translateX(-50%);width:140px;height:140px;border-radius:50%;background:rgba(139,92,246,0.15);filter:blur(40px);pointer-events:none;"></div>

								<!-- Icon -->
								<div style="
									width: 44px; height: 44px; border-radius: 14px;
									background: rgba(139,92,246,0.2); border: 1.5px solid rgba(139,92,246,0.4);
									display: flex; align-items: center; justify-content: center;
									position: relative; z-index: 1;
								">
									<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(167,139,250,1)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
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
											border: 1px solid rgba(255,255,255,0.1);
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
										border: 1px dashed rgba(139,92,246,0.3);
										display: flex; align-items: center; justify-content: center;
										flex-shrink: 0;
									">
										<span style="font-size:14px;color:rgba(139,92,246,0.4);">+</span>
									</div>
								</div>

								<!-- Color swatches -->
								<div style="display:flex;gap:4px;position:relative;z-index:1;">
									{#each ['#8B5CF6','#C4B5FD','#1A0F3A','#F8F9FA','#FDFCF8'] as swatch}
										<div style="width:14px;height:14px;border-radius:50%;background:{swatch};border:1px solid rgba(255,255,255,0.15);flex-shrink:0;"></div>
									{/each}
									<div style="width:14px;height:14px;border-radius:50%;border:1.5px dashed rgba(255,255,255,0.2);flex-shrink:0;display:flex;align-items:center;justify-content:center;">
										<span style="font-size:8px;color:rgba(255,255,255,0.3);">+</span>
									</div>
								</div>

								<!-- Label -->
								<div style="position:relative;z-index:1;text-align:center;">
									<p style="font-family:'Nunito Sans',sans-serif;font-size:10px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:rgba(167,139,250,0.8);margin-bottom:2px;">Upload images</p>
									<p style="font-family:'Nunito Sans',sans-serif;font-size:9px;color:rgba(255,255,255,0.25);letter-spacing:0.04em;">AI copies your brand style</p>
								</div>

								<!-- Bottom bar in preview -->
								<div style="
									position:absolute;bottom:0;left:0;right:0;
									padding: 8px 12px;
									background: linear-gradient(to top, rgba(15,10,30,0.95), transparent);
								">
									<div style="display:flex;gap:4px;">
										{#each [30,60,45,70,50] as w}
											<div style="height:2px;flex:{w};background:rgba(139,92,246,0.4);border-radius:1px;"></div>
										{/each}
									</div>
								</div>
							</div>
						{/if}
					</div>

					<!-- Card footer -->
					<div class="px-3 py-2.5 bg-[#111] flex items-center justify-between gap-2 border-t border-white/[0.05]">
						<div class="min-w-0">
							<p class="text-xs font-display font-semibold text-white truncate">{tmpl.name}</p>
							<p class="text-[10px] font-body text-white/30 truncate leading-tight">{tmpl.description}</p>
						</div>
						<ArrowRight size={13} class="text-white/20 {arrowColor} group-hover:translate-x-0.5 transition-all flex-shrink-0" />
					</div>
				</a>
			{/each}

			<!-- "More coming" placeholder -->
			<div class="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-white/[0.05] text-white/15 flex-shrink-0"
				style="width: {TEMPLATE_CARD_W}px; height: {Math.round(TEMPLATE_CARD_W * 1350/1080) + 46}px;">
				<Plus size={18} class="mb-2 opacity-40" />
				<span class="text-[10px] font-mono">More templates soon</span>
			</div>
		</div>
	</div>

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
	.page-wrap { padding: 2rem 2.5rem; max-width: 1100px; }

	/* Header */
	.page-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 1rem; margin-bottom: 2rem; }
	.page-title { font-family: 'Fraunces', serif; font-size: 1.6rem; font-weight: 900; letter-spacing: -0.03em; color: #fff; margin: 0 0 0.25rem; }
	.page-sub   { font-size: 0.8125rem; color: rgba(255,255,255,0.38); margin: 0; }
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
	.templates-title { font-family: 'Space Mono', monospace; font-size: 0.65rem; text-transform: uppercase; letter-spacing: 0.12em; color: rgba(255,255,255,0.3); margin: 0; }
	.templates-see-all { font-size: 0.75rem; color: rgba(255,255,255,0.3); text-decoration: none; font-family: 'Space Mono', monospace; transition: color 0.15s; }
	.templates-see-all:hover { color: #E8FF48; }

	/* Section divider */
	.section-divider { border: none; border-top: 1px solid rgba(255,255,255,0.05); margin: 0.5rem 0 1.5rem; }

	/* Library header */
	.library-header { display: flex; align-items: center; justify-content: space-between; gap: 1rem; margin-bottom: 1rem; flex-wrap: wrap; }
	.library-title { font-family: 'Fraunces', serif; font-size: 1rem; font-weight: 700; color: rgba(255,255,255,0.9); margin: 0; }

	/* Filter tabs */
	.filter-tabs {
		display: flex; gap: 0.25rem; padding: 0.3rem;
		background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.06);
		border-radius: 10px;
	}
	.filter-tab {
		display: inline-flex; align-items: center; gap: 0.4rem;
		padding: 0.35rem 0.8rem; border-radius: 7px; border: none;
		background: transparent; color: rgba(255,255,255,0.38);
		font-family: 'DM Sans', sans-serif; font-size: 0.78rem; font-weight: 500;
		cursor: pointer; transition: all 0.12s;
	}
	.filter-tab:hover { color: rgba(255,255,255,0.7); }
	.filter-tab--on { color: #fff; background: rgba(255,255,255,0.08); }
	.filter-count {
		display: inline-flex; align-items: center; justify-content: center;
		width: 18px; height: 18px; border-radius: 5px;
		background: rgba(255,255,255,0.08); font-size: 0.65rem;
		font-family: 'Space Mono', monospace; color: rgba(255,255,255,0.5);
	}
	.filter-tab--on .filter-count { background: rgba(232,255,72,0.15); color: #E8FF48; }

	/* Carousel grid */
	.carousel-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; }
	.skeleton-card {
		aspect-ratio: 4/5; border-radius: 16px;
		background: rgba(255,255,255,0.03);
		animation: pulse 1.5s ease-in-out infinite;
	}
	@keyframes pulse { 0%,100%{opacity:0.5} 50%{opacity:1} }

	/* Carousel card */
	.carousel-card {
		position: relative; border-radius: 16px; overflow: hidden;
		border: 1px solid rgba(255,255,255,0.06);
		background: var(--card-bg, #111);
		transition: border-color 0.2s, transform 0.2s, box-shadow 0.2s;
	}
	.carousel-card:hover { border-color: rgba(255,255,255,0.15); transform: translateY(-2px); box-shadow: 0 12px 40px rgba(0,0,0,0.3); }

	.card-preview {
		display: flex; align-items: center; justify-content: center;
		padding: 1.5rem; aspect-ratio: 4/5;
		text-decoration: none; cursor: pointer;
	}
	.card-preview-text {
		font-family: 'Fraunces', serif; font-weight: 700; text-align: center;
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
	.status-draft     { background: rgba(0,0,0,0.6); color: rgba(255,255,255,0.4); }
	.status-published { background: rgba(6,182,212,0.2); color: #06b6d4; border: 1px solid rgba(6,182,212,0.3); }
	.status-scheduled { background: rgba(139,92,246,0.2); color: #8b5cf6; border: 1px solid rgba(139,92,246,0.3); }

	.card-footer {
		position: absolute; bottom: 0; left: 0; right: 0;
		padding: 0.75rem; background: linear-gradient(to top, rgba(0,0,0,0.9), transparent);
		display: flex; align-items: flex-end; justify-content: space-between; gap: 0.5rem;
	}
	.card-info { flex: 1; min-width: 0; }
	.card-title-text { font-size: 0.78rem; font-weight: 600; color: #fff; margin: 0 0 0.15rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
	.card-time        { font-size: 0.6rem; color: rgba(255,255,255,0.35); font-family: 'Space Mono', monospace; margin: 0; }

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
		border: 2px dashed rgba(255,255,255,0.08);
		background: transparent;
		display: flex; flex-direction: column; align-items: center; justify-content: center;
		gap: 0.6rem; cursor: pointer; transition: all 0.2s; color: rgba(255,255,255,0.2);
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
	.empty-title { font-family: 'Fraunces', serif; font-size: 1.1rem; font-weight: 700; color: rgba(255,255,255,0.8); margin: 0; }
	.empty-desc  { font-size: 0.8125rem; color: rgba(255,255,255,0.35); margin: 0; max-width: 280px; }
	.empty-cta {
		display: inline-flex; align-items: center; gap: 0.4rem;
		padding: 0.6rem 1.2rem; border-radius: 10px; border: none;
		background: linear-gradient(135deg, #7c3aed, #06b6d4);
		color: #fff; font-size: 0.8125rem; font-weight: 600; cursor: pointer;
		font-family: 'DM Sans', sans-serif; margin-top: 0.5rem;
		transition: opacity 0.15s, transform 0.15s;
	}
	.empty-cta:hover { opacity: 0.9; transform: translateY(-1px); }
</style>
