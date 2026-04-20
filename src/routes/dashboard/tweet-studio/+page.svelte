<script lang="ts">
	import { supabase } from '$lib/supabase';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { toPng } from 'html-to-image';
	import TweetTemplate from '$lib/components/templates/TweetTemplate.svelte';
	import { Download, Loader, Image, CheckSquare, Square, Bird, Plus, Trash2, Copy, Music, Calendar, X } from 'lucide-svelte';

	// ── Types ──────────────────────────────────────────────────────────────────
	interface TweetSlide {
		id: string;
		topName: string;
		topHandle: string;
		topAvatar: string;
		topVerified: boolean;
		topText: string;
		topImage: string;
		bottomName: string;
		bottomHandle: string;
		bottomAvatar: string;
		bottomVerified: boolean;
		bottomText: string;
	}

	function defaultSlide(inherit?: TweetSlide): TweetSlide {
		return {
			id: crypto.randomUUID(),
			topName:      inherit?.topName      ?? 'Chef 👨‍🍳',
			topHandle:    inherit?.topHandle    ?? '@chefsevenn',
			topAvatar:    inherit?.topAvatar    ?? '',
			topVerified:  inherit?.topVerified  ?? true,
			topText:      '',
			topImage:     inherit?.topImage     ?? '/templates/tweet/demo-bg.jpg',
			bottomName:   inherit?.bottomName   ?? 'Mo Mohler',
			bottomHandle: inherit?.bottomHandle ?? '@MoMohler',
			bottomAvatar: inherit?.bottomAvatar ?? '',
			bottomVerified: inherit?.bottomVerified ?? true,
			bottomText:   '',
		};
	}

	// ── Auth ──────────────────────────────────────────────────────────────────
	onMount(async () => {
		const { data: { user } } = await supabase.auth.getUser();
		if (!user) goto('/login');
	});

	// ── Slides state ──────────────────────────────────────────────────────────
	let slides = $state<TweetSlide[]>([{
		id: crypto.randomUUID(),
		topName: 'Chef 👨‍🍳',
		topHandle: '@chefsevenn',
		topAvatar: '',
		topVerified: true,
		topText: 'Ketchup or mayo or mustard?',
		topImage: '/templates/tweet/demo-bg.jpg',
		bottomName: 'Mo Mohler',
		bottomHandle: '@MoMohler',
		bottomAvatar: '',
		bottomVerified: true,
		bottomText: '3 straight misses chef. These appear to be French fries.',
	}]);
	let activeIdx = $state(0);
	let s = $derived(slides[activeIdx]); // shorthand for active slide

	// ── Slide management ──────────────────────────────────────────────────────
	function addSlide() {
		const cur = slides[activeIdx];
		slides = [...slides, defaultSlide(cur)];
		activeIdx = slides.length - 1;
	}

	function duplicateSlide() {
		const src = slides[activeIdx];
		const dup: TweetSlide = { ...src, id: crypto.randomUUID() };
		slides = [...slides.slice(0, activeIdx + 1), dup, ...slides.slice(activeIdx + 1)];
		activeIdx = activeIdx + 1;
	}

	function deleteSlide(i: number) {
		if (slides.length === 1) return;
		slides = slides.filter((_, idx) => idx !== i);
		activeIdx = Math.min(activeIdx, slides.length - 1);
	}

	// ── Upload helpers ─────────────────────────────────────────────────────────
	function readAsDataURL(file: File): Promise<string> {
		return new Promise((res) => {
			const r = new FileReader();
			r.onload = () => res(r.result as string);
			r.readAsDataURL(file);
		});
	}

	async function handleTopAvatarUpload(e: Event) {
		const file = (e.target as HTMLInputElement).files?.[0];
		if (file) slides[activeIdx].topAvatar = await readAsDataURL(file);
	}

	async function handleTopImageUpload(e: Event) {
		const file = (e.target as HTMLInputElement).files?.[0];
		if (file) slides[activeIdx].topImage = await readAsDataURL(file);
	}

	async function handleBottomAvatarUpload(e: Event) {
		const file = (e.target as HTMLInputElement).files?.[0];
		if (file) slides[activeIdx].bottomAvatar = await readAsDataURL(file);
	}

	// ── Export ─────────────────────────────────────────────────────────────────
	let exporting = $state(false);
	let exportingAll = $state(false);
	let exportRef: HTMLElement | null = $state(null);

	async function exportCurrent() {
		if (!exportRef) return;
		exporting = true;
		try {
			const dataUrl = await toPng(exportRef, {
				width: 1080, height: 1350, pixelRatio: 1,
				style: { transform: 'scale(1)', transformOrigin: 'top left' },
			});
			const a = document.createElement('a');
			a.href = dataUrl;
			a.download = `tweet-slide-${activeIdx + 1}.png`;
			a.click();
		} catch (e: any) { alert('Export failed: ' + e.message); }
		exporting = false;
	}

	async function exportAll() {
		exportingAll = true;
		const saved = activeIdx;
		for (let i = 0; i < slides.length; i++) {
			activeIdx = i;
			await new Promise(r => setTimeout(r, 120));
			if (!exportRef) continue;
			try {
				const dataUrl = await toPng(exportRef, {
					width: 1080, height: 1350, pixelRatio: 1,
					style: { transform: 'scale(1)', transformOrigin: 'top left' },
				});
				const a = document.createElement('a');
				a.href = dataUrl;
				a.download = `tweet-slide-${i + 1}.png`;
				a.click();
				await new Promise(r => setTimeout(r, 150));
			} catch {}
		}
		activeIdx = saved;
		exportingAll = false;
	}

	// Preview scale
	const PREVIEW_W = 520;
	const previewScale = $derived(PREVIEW_W / 1080);

	// Thumbnail scale (for slide strip)
	const THUMB_W = 88;
	const thumbScale = THUMB_W / 1080;

	// ── Floating actions (layout only) ────────────────────────────────────────
	let showMusicPanel = $state(false);
	let slideMusic = $state<{ song: string; seconds: number }[]>([]);
	const SONG_OPTIONS = [
		'No music', 'Lo-fi Chill', 'Upbeat Corporate',
		'Cinematic Rise', 'Acoustic Mood', 'Electronic Pulse', 'Inspirational Piano',
	];
	$effect(() => {
		const count = slides.length;
		if (slideMusic.length !== count) {
			slideMusic = Array.from({ length: count }, (_, i) => slideMusic[i] ?? { song: 'No music', seconds: 15 });
		}
	});
</script>

<div class="flex h-full overflow-hidden">

	<!-- ── Left sidebar ────────────────────────────────────────────────────── -->
	<div class="w-80 flex-shrink-0 border-r border-white/[0.05] bg-[#0d0d0d] flex flex-col overflow-hidden">

		<!-- Header -->
		<div class="px-5 py-4 border-b border-white/[0.04] flex-shrink-0">
			<div class="flex items-center gap-2">
				<Bird size={13} class="text-sky-400" />
				<h1 class="font-display font-bold text-base text-white">Tweet Studio</h1>
			</div>
			<p class="font-body text-xs text-white/40 mt-0.5">Turn viral tweets into Instagram slides</p>
		</div>

		<!-- ── Slide strip ─────────────────────────────────────────────────── -->
		<div class="flex-shrink-0 border-b border-white/[0.04] px-3 py-3">
			<div class="flex items-center gap-1.5 mb-2.5">
				<span class="text-[9px] font-mono text-white/25 uppercase tracking-widest flex-1">Slides ({slides.length})</span>
				<button onclick={duplicateSlide} title="Duplicate slide"
					class="p-1 rounded-md hover:bg-white/[0.06] text-white/25 hover:text-white/60 transition-colors">
					<Copy size={11} />
				</button>
				<button onclick={addSlide} title="Add blank slide"
					class="p-1 rounded-md hover:bg-white/[0.06] text-white/25 hover:text-sky-400 transition-colors">
					<Plus size={11} />
				</button>
			</div>

			<div class="flex gap-2 overflow-x-auto pb-1" style="scrollbar-width: none;">
				{#each slides as slide, i (slide.id)}
					<button
						onclick={() => activeIdx = i}
						class="relative flex-shrink-0 rounded-xl overflow-hidden border-2 transition-all {i === activeIdx ? 'border-sky-500' : 'border-white/[0.07] hover:border-white/20'}"
						style="width: {THUMB_W}px; height: {Math.round(THUMB_W * 1350/1080)}px;"
					>
						<!-- Mini preview -->
						<div style="width: {THUMB_W}px; height: {Math.round(THUMB_W * 1350/1080)}px; overflow: hidden; pointer-events: none;">
							<TweetTemplate
								topName={slide.topName}
								topHandle={slide.topHandle}
								topAvatar={slide.topAvatar}
								topVerified={slide.topVerified}
								topText={slide.topText || 'Tweet text…'}
								topImage={slide.topImage}
								bottomName={slide.bottomName}
								bottomHandle={slide.bottomHandle}
								bottomAvatar={slide.bottomAvatar}
								bottomVerified={slide.bottomVerified}
								bottomText={slide.bottomText || 'Reply text…'}
								scale={thumbScale}
								interactive={false}
							/>
						</div>

						<!-- Slide number badge -->
						<div class="absolute top-1 left-1 w-4 h-4 rounded-full bg-black/70 flex items-center justify-center">
							<span class="text-[8px] font-mono text-white/70">{i + 1}</span>
						</div>

						<!-- Delete button -->
						{#if slides.length > 1}
							<button
								onclick={(e) => { e.stopPropagation(); deleteSlide(i); }}
								class="absolute top-1 right-1 w-4 h-4 rounded-full bg-black/70 hover:bg-red-500/80 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity group-hover:opacity-100"
								title="Delete slide"
							>
								<Trash2 size={7} class="text-white" />
							</button>
						{/if}
					</button>
				{/each}

				<!-- Add new -->
				<button onclick={addSlide}
					class="flex-shrink-0 rounded-xl border-2 border-dashed border-white/[0.08] hover:border-sky-500/40 flex items-center justify-center text-white/20 hover:text-sky-400 transition-all"
					style="width: {THUMB_W}px; height: {Math.round(THUMB_W * 1350/1080)}px;">
					<Plus size={16} />
				</button>
			</div>
		</div>

		<!-- ── Form for active slide ───────────────────────────────────────── -->
		<div class="flex-1 overflow-y-auto">
			<div class="flex flex-col gap-4 p-4">

				<!-- ── Top tweet ────────────────────────────────────────────── -->
				<div>
					<p class="text-[10px] font-mono text-white/30 uppercase tracking-wider mb-3 flex items-center gap-1.5">
						<span class="w-2 h-2 rounded-full bg-sky-400 inline-block"></span> Original tweet
					</p>

					<!-- Avatar upload -->
					<div class="flex items-center gap-3 mb-3">
						<div class="w-10 h-10 rounded-full overflow-hidden bg-white/[0.06] flex-shrink-0 flex items-center justify-center">
							{#if s.topAvatar}
								<img src={s.topAvatar} alt="" class="w-full h-full object-cover" />
							{:else}
								<span class="text-xs font-bold text-white/30">{s.topName.replace(/[^\w\s]/g,'').trim()[0]?.toUpperCase() ?? '?'}</span>
							{/if}
						</div>
						<label class="flex-1 text-[11px] font-mono text-white/30 border border-white/[0.07] rounded-lg px-2.5 py-1.5 cursor-pointer hover:border-white/20 transition-colors">
							{s.topAvatar ? 'Change avatar' : 'Upload avatar'}
							<input type="file" accept="image/*" class="hidden" onchange={handleTopAvatarUpload} />
						</label>
						{#if s.topAvatar}
							<button onclick={() => slides[activeIdx].topAvatar = ''} class="text-white/20 hover:text-red-400 transition-colors text-xs">✕</button>
						{/if}
					</div>

					<!-- Name + handle -->
					<div class="flex flex-col gap-2 mb-2">
						<input bind:value={slides[activeIdx].topName} placeholder="Display name"
							class="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl py-2 px-3 text-sm font-body text-white placeholder-white/20 focus:outline-none focus:border-sky-500/50 transition-colors" />
						<input bind:value={slides[activeIdx].topHandle} placeholder="@handle"
							class="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl py-2 px-3 text-sm font-mono text-white/70 placeholder-white/20 focus:outline-none focus:border-sky-500/50 transition-colors" />
					</div>

					<!-- Verified toggle -->
					<button onclick={() => slides[activeIdx].topVerified = !slides[activeIdx].topVerified}
						class="flex items-center gap-2 text-[11px] font-mono mb-3 {s.topVerified ? 'text-sky-400' : 'text-white/30'} hover:text-sky-300 transition-colors">
						{#if s.topVerified}<CheckSquare size={12} />{:else}<Square size={12} />{/if}
						Verified badge
					</button>

					<!-- Tweet text -->
					<textarea bind:value={slides[activeIdx].topText} rows={3} placeholder="The original tweet..."
						class="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl py-2.5 px-3 text-sm font-body text-white placeholder-white/20 focus:outline-none focus:border-sky-500/50 transition-colors resize-none leading-relaxed mb-2"></textarea>

					<!-- Tweet image upload -->
					<div class="flex flex-col gap-1.5">
						{#if s.topImage}
							<div class="relative rounded-xl overflow-hidden">
								<img src={s.topImage} alt="tweet attachment" class="w-full h-24 object-cover" />
								<button onclick={() => slides[activeIdx].topImage = ''}
									class="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/70 text-white text-xs flex items-center justify-center hover:bg-red-500/80 transition-colors">✕</button>
							</div>
						{:else}
							<label class="flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-body text-white/30 border border-dashed border-white/[0.08] hover:border-white/20 cursor-pointer transition-colors">
								<Image size={11} /> Attach tweet image (optional)
								<input type="file" accept="image/*" class="hidden" onchange={handleTopImageUpload} />
							</label>
						{/if}
					</div>
				</div>

				<!-- Divider -->
				<div class="border-t border-white/[0.05]"></div>

				<!-- ── Bottom reply ──────────────────────────────────────────── -->
				<div>
					<p class="text-[10px] font-mono text-white/30 uppercase tracking-wider mb-3 flex items-center gap-1.5">
						<span class="w-2 h-2 rounded-full bg-violet-400 inline-block"></span> Reply
					</p>

					<!-- Avatar upload -->
					<div class="flex items-center gap-3 mb-3">
						<div class="w-10 h-10 rounded-full overflow-hidden bg-white/[0.06] flex-shrink-0 flex items-center justify-center">
							{#if s.bottomAvatar}
								<img src={s.bottomAvatar} alt="" class="w-full h-full object-cover" />
							{:else}
								<span class="text-xs font-bold text-white/30">{s.bottomName.trim()[0]?.toUpperCase() ?? '?'}</span>
							{/if}
						</div>
						<label class="flex-1 text-[11px] font-mono text-white/30 border border-white/[0.07] rounded-lg px-2.5 py-1.5 cursor-pointer hover:border-white/20 transition-colors">
							{s.bottomAvatar ? 'Change avatar' : 'Upload avatar'}
							<input type="file" accept="image/*" class="hidden" onchange={handleBottomAvatarUpload} />
						</label>
						{#if s.bottomAvatar}
							<button onclick={() => slides[activeIdx].bottomAvatar = ''} class="text-white/20 hover:text-red-400 transition-colors text-xs">✕</button>
						{/if}
					</div>

					<!-- Name + handle -->
					<div class="flex flex-col gap-2 mb-2">
						<input bind:value={slides[activeIdx].bottomName} placeholder="Display name"
							class="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl py-2 px-3 text-sm font-body text-white placeholder-white/20 focus:outline-none focus:border-violet-500/50 transition-colors" />
						<input bind:value={slides[activeIdx].bottomHandle} placeholder="@handle"
							class="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl py-2 px-3 text-sm font-mono text-white/70 placeholder-white/20 focus:outline-none focus:border-violet-500/50 transition-colors" />
					</div>

					<!-- Verified toggle -->
					<button onclick={() => slides[activeIdx].bottomVerified = !slides[activeIdx].bottomVerified}
						class="flex items-center gap-2 text-[11px] font-mono mb-3 {s.bottomVerified ? 'text-violet-400' : 'text-white/30'} hover:text-violet-300 transition-colors">
						{#if s.bottomVerified}<CheckSquare size={12} />{:else}<Square size={12} />{/if}
						Verified badge
					</button>

					<!-- Reply text -->
					<textarea bind:value={slides[activeIdx].bottomText} rows={3} placeholder="The reply..."
						class="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl py-2.5 px-3 text-sm font-body text-white placeholder-white/20 focus:outline-none focus:border-violet-500/50 transition-colors resize-none leading-relaxed"></textarea>
				</div>

				<!-- Divider -->
				<div class="border-t border-white/[0.05]"></div>

				<!-- Export buttons -->
				<div class="flex flex-col gap-2 pb-2">
					<button onclick={exportCurrent} disabled={exporting || exportingAll}
						class="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold font-body text-white bg-gradient-to-r from-sky-600 to-violet-600 hover:shadow-[0_0_20px_rgba(14,165,233,0.3)] transition-all disabled:opacity-50">
						{#if exporting}
							<Loader size={13} class="animate-spin" /> Exporting…
						{:else}
							<Download size={13} /> Export slide {activeIdx + 1}
						{/if}
					</button>

					{#if slides.length > 1}
						<button onclick={exportAll} disabled={exporting || exportingAll}
							class="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold font-body text-white/70 bg-white/[0.06] hover:bg-white/[0.09] transition-all disabled:opacity-50">
							{#if exportingAll}
								<Loader size={13} class="animate-spin" /> Exporting all…
							{:else}
								<Download size={13} /> Export all {slides.length} slides
							{/if}
						</button>
					{/if}
				</div>

			</div>
		</div>
	</div>

	<!-- ── Preview panel ───────────────────────────────────────────────────── -->
	<div class="flex-1 flex flex-col items-center justify-center bg-[#080808] overflow-auto p-8 gap-4">
		<p class="font-mono text-[10px] text-white/20 uppercase tracking-widest">
			Slide {activeIdx + 1} / {slides.length} — 1080 × 1350
		</p>

		<div style="width: {PREVIEW_W}px; height: {Math.round(PREVIEW_W * 1350 / 1080)}px;">
			<TweetTemplate
				bind:exportRef
				topName={s.topName}
				topHandle={s.topHandle}
				topAvatar={s.topAvatar}
				topVerified={s.topVerified}
				topText={s.topText}
				topImage={s.topImage}
				bottomName={s.bottomName}
				bottomHandle={s.bottomHandle}
				bottomAvatar={s.bottomAvatar}
				bottomVerified={s.bottomVerified}
				bottomText={s.bottomText}
				scale={previewScale}
			/>
		</div>

		<!-- Prev / next arrows -->
		{#if slides.length > 1}
			<div class="flex items-center gap-3 mt-1">
				<button
					onclick={() => activeIdx = Math.max(0, activeIdx - 1)}
					disabled={activeIdx === 0}
					class="px-3 py-1.5 rounded-lg text-xs font-mono text-white/40 hover:text-white/80 bg-white/[0.04] hover:bg-white/[0.08] disabled:opacity-25 transition-all">
					← Prev
				</button>
				<span class="text-[10px] font-mono text-white/20">{activeIdx + 1} / {slides.length}</span>
				<button
					onclick={() => activeIdx = Math.min(slides.length - 1, activeIdx + 1)}
					disabled={activeIdx === slides.length - 1}
					class="px-3 py-1.5 rounded-lg text-xs font-mono text-white/40 hover:text-white/80 bg-white/[0.04] hover:bg-white/[0.08] disabled:opacity-25 transition-all">
					Next →
				</button>
			</div>
		{/if}
	</div>

</div>

{#if slides.length > 0}
	<div class="fixed bottom-8 right-8 z-50 flex flex-col items-end gap-2">
		<button onclick={() => goto('/dashboard/post-scheduler')} class="flex items-center gap-2 pl-3 pr-4 py-2.5 rounded-2xl text-xs font-semibold font-body shadow-lg transition-all bg-[#1a1a1a] border border-white/[0.12] text-white/70 hover:text-white hover:border-cyan-500/40 hover:bg-[#1e1e1e]">
			<Calendar size={14} /> Post
		</button>

		<!-- Burn Music -->
		<div class="relative">
			{#if showMusicPanel}
				<div class="absolute bottom-full mb-2 right-0 w-[400px] rounded-2xl bg-[#111] border border-white/[0.1] shadow-2xl overflow-hidden">
					<div class="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
						<div class="flex items-center gap-2">
							<Music size={13} class="text-violet-400" />
							<span class="text-xs font-mono font-semibold text-white/80 uppercase tracking-wider">Burn Music</span>
						</div>
						<button onclick={() => showMusicPanel = false} class="w-6 h-6 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] flex items-center justify-center text-white/40 hover:text-white/80 transition-all" aria-label="Close burn music panel">
							<X size={11} />
						</button>
					</div>
					<div class="max-h-[320px] overflow-y-auto" style="scrollbar-width:thin;scrollbar-color:rgba(255,255,255,0.08) transparent;">
						{#each slides as _, i}
							{@const music = slideMusic[i] ?? { song: 'No music', seconds: 15 }}
							<div class="flex items-center gap-3 px-4 py-2.5 border-b border-white/[0.04] last:border-0 hover:bg-white/[0.02] transition-colors">
								<div class="w-6 h-6 rounded-lg bg-violet-500/15 border border-violet-500/20 flex items-center justify-center flex-shrink-0">
									<span class="text-[9px] font-mono font-bold text-violet-400">{i + 1}</span>
								</div>
								<span class="text-[10px] font-mono text-white/40 w-16 flex-shrink-0 truncate">Slide {i + 1}</span>
								<select value={music.song} onchange={(e) => { const arr=[...slideMusic]; if(!arr[i]) arr[i]={song:'No music',seconds:15}; arr[i]={...arr[i],song:(e.target as HTMLSelectElement).value}; slideMusic=arr; }} class="flex-1 bg-white/[0.05] border border-white/[0.08] rounded-lg py-1 px-2 text-[10px] font-body text-white/60 focus:outline-none focus:border-violet-500/40 transition-colors [color-scheme:dark] cursor-pointer">
									{#each SONG_OPTIONS as opt}
										<option value={opt}>{opt}</option>
									{/each}
								</select>
								<div class="flex items-center gap-1.5 flex-shrink-0">
									<input type="range" min="1" max="60" step="1" value={music.seconds} oninput={(e) => { const arr=[...slideMusic]; if(!arr[i]) arr[i]={song:'No music',seconds:15}; arr[i]={...arr[i],seconds:parseInt((e.target as HTMLInputElement).value)}; slideMusic=arr; }} class="w-16 accent-violet-500 cursor-pointer" />
									<span class="text-[9px] font-mono text-white/30 w-8 text-right">{music.seconds}s</span>
								</div>
							</div>
						{/each}
					</div>
					<div class="px-4 py-3 border-t border-white/[0.06]">
						<button disabled class="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold font-body text-white/40 bg-white/[0.05] border border-white/[0.08] cursor-not-allowed">
							<Music size={13} class="opacity-40" /> Export as Video
							<span class="ml-auto text-[9px] font-mono text-white/20 bg-white/[0.05] px-2 py-0.5 rounded-md">Coming soon</span>
						</button>
					</div>
				</div>
			{/if}
			<button onclick={() => { showMusicPanel = !showMusicPanel; }} class="flex items-center gap-2 pl-3 pr-4 py-2.5 rounded-2xl text-xs font-semibold font-body shadow-lg transition-all {showMusicPanel ? 'bg-violet-600 text-white shadow-[0_0_20px_rgba(139,92,246,0.5)]' : 'bg-[#1a1a1a] border border-white/[0.12] text-white/70 hover:text-white hover:border-violet-500/40 hover:bg-[#1e1e1e]'}">
				<Music size={14} /> Burn Music
			</button>
		</div>
	</div>
{/if}
