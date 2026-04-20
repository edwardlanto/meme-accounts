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
</script>

<div class="p-8 max-w-5xl">

	<!-- ── Header ─────────────────────────────────────────────────────────── -->
	<div class="flex items-start justify-between mb-10">
		<div>
			<h1 class="font-display font-bold text-2xl text-white mb-1">Carousels</h1>
			<p class="font-body text-sm text-white/40">Your carousel library — drafts, published, and scheduled</p>
		</div>
		<button onclick={createNew} disabled={creating}
			class="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold font-body text-white bg-gradient-to-r from-violet-600 to-cyan-500 hover:shadow-[0_0_20px_rgba(139,92,246,0.3)] transition-all disabled:opacity-50">
			{#if creating}<Loader size={13} class="animate-spin" />{:else}<Plus size={14} />{/if}
			New carousel
		</button>
	</div>

	{#if createError}
		<div class="mb-6 flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-xs font-body text-red-400">
			<span>⚠ {createError}</span>
		</div>
	{/if}

	<!-- ── Starter Templates ───────────────────────────────────────────────── -->
	<div class="mb-10">
		<div class="flex items-center justify-between mb-4">
			<h2 class="font-display font-semibold text-sm text-white/60 uppercase tracking-widest">Start from a template</h2>
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
							<!-- Brand Studio static preview -->
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
	<div class="border-t border-white/[0.04] mb-8"></div>

	<!-- ── Your Carousels ─────────────────────────────────────────────────── -->
	<div class="flex items-center justify-between mb-4">
		<h2 class="font-display font-semibold text-sm text-white/60 uppercase tracking-widest">Your carousels</h2>
	</div>

	{#if loading}
		<div class="grid grid-cols-3 gap-4">
			{#each Array(6) as _}
				<div class="aspect-[4/5] rounded-2xl bg-white/[0.03] animate-pulse"></div>
			{/each}
		</div>
	{:else if carousels.length === 0}
		<div class="flex flex-col items-center justify-center py-20 text-center">
			<div class="w-14 h-14 rounded-2xl bg-violet-500/10 border border-violet-500/15 flex items-center justify-center mb-5">
				<ImagePlus size={22} class="text-violet-400" />
			</div>
			<h3 class="font-display font-semibold text-base text-white mb-1.5">No carousels yet</h3>
			<p class="font-body text-sm text-white/35 max-w-xs mb-5">Pick a template above or create a blank carousel.</p>
			<button onclick={createNew}
				class="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold font-body text-white bg-gradient-to-r from-violet-600 to-cyan-500 transition-all hover:shadow-[0_0_20px_rgba(139,92,246,0.3)]">
				<Plus size={14} /> Create blank carousel
			</button>
		</div>
	{:else}
		<div class="grid grid-cols-2 md:grid-cols-3 gap-4">
			{#each carousels as c}
				{@const slides = (() => { try { return JSON.parse(typeof c.slides === 'string' ? c.slides : JSON.stringify(c.slides)); } catch { return []; } })()}
				{@const firstSlide = slides[0]}
				<div class="group relative rounded-2xl overflow-hidden border border-white/[0.06] hover:border-violet-500/25 transition-all cursor-pointer"
					style="background: {firstSlide?.bg ?? '#111111'}">
					<!-- Preview -->
					<a href="/dashboard/editor/{c.id}" class="block aspect-[4/5] flex items-center justify-center p-6">
						<p class="font-display font-bold text-center leading-tight"
							style="color: {firstSlide?.textColor ?? '#ffffff'}; font-size: clamp(12px, 2.5vw, 18px)">
							{firstSlide?.text || 'Untitled'}
						</p>
					</a>

					<!-- Slide count badge -->
					<div class="absolute top-2 right-2 px-1.5 py-0.5 rounded-md bg-black/60 text-[10px] font-mono text-white/50">
						{slides.length} slides
					</div>

					<!-- Bottom bar -->
					<div class="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/80 to-transparent flex items-center justify-between">
						<div class="flex-1 min-w-0">
							<p class="text-xs font-display font-semibold text-white truncate">{c.title}</p>
							<div class="flex items-center gap-1 mt-0.5">
								<svelte:component this={statusIcon[c.status] ?? FileText} size={9} class={statusColor[c.status] ?? 'text-white/30'} />
								<p class="text-[10px] font-mono {statusColor[c.status] ?? 'text-white/30'} capitalize">{c.status}</p>
							</div>
						</div>
						<div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
							<a href="/dashboard/editor/{c.id}"
								class="p-1.5 rounded-lg bg-violet-500/20 hover:bg-violet-500/40 text-violet-300 transition-colors">
								<Edit2 size={11} />
							</a>
							<button onclick={() => deleteCarousel(c.id)}
								class="p-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/40 text-red-400 transition-colors">
								<Trash2 size={11} />
							</button>
						</div>
					</div>
				</div>
			{/each}

			<!-- New blank card -->
			<button onclick={createNew} disabled={creating}
				class="aspect-[4/5] rounded-2xl border-2 border-dashed border-white/[0.08] hover:border-violet-500/40 flex flex-col items-center justify-center gap-2 transition-all text-white/20 hover:text-violet-400 group">
				<div class="w-10 h-10 rounded-xl border-2 border-current flex items-center justify-center group-hover:scale-110 transition-transform">
					<Plus size={18} />
				</div>
				<span class="text-xs font-mono">New carousel</span>
			</button>
		</div>
	{/if}
</div>
