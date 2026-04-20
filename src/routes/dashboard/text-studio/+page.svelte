<script lang="ts">
	import { supabase } from '$lib/supabase';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { toPng } from 'html-to-image';
	import TextCarouselTemplate from '$lib/components/templates/TextCarouselTemplate.svelte';
	import { Download, Loader, Copy, Plus, Trash2, CheckSquare, Square, Type, Music, Calendar, X, Send } from 'lucide-svelte';

	// ── Types ──────────────────────────────────────────────────────────────────
	interface TextSlide {
		id: string;
		text: string;
		showSwipe: boolean;
	}

	// ── Auth ──────────────────────────────────────────────────────────────────
	onMount(async () => {
		const { data: { user } } = await supabase.auth.getUser();
		if (!user) goto('/login');
	});

	// ── Shared profile (same on every slide) ──────────────────────────────────
	let profileName    = $state('Captains of industry');
	let profileHandle  = $state('@captainsofindustryy');
	let profileAvatar  = $state('');
	let ringColor      = $state('#c9b97a');
	let bgColor        = $state('#0a0a0a');

	// ── Slides ────────────────────────────────────────────────────────────────
	let slides = $state<TextSlide[]>([
		{
			id: crypto.randomUUID(),
			text: 'When your home is titled in your name, it becomes a legal target.\n\nCourts, creditors, and attorneys see it as your asset…\n\nWhich means they can freeze it, lien it, or force a sale.',
			showSwipe: true,
		},
	]);
	let activeIdx  = $state(0);
	let s          = $derived(slides[activeIdx]);

	// ── Floating actions (layout only) ────────────────────────────────────────
	let showMusicPanel = $state(false);
	let showPostPanel = $state(false);
	let selectedPlatforms = $state<string[]>([]);
	let scheduleDate = $state('');
	let scheduleTime = $state('');
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
	function togglePlatform(p: string) {
		selectedPlatforms = selectedPlatforms.includes(p)
			? selectedPlatforms.filter((x) => x !== p)
			: [...selectedPlatforms, p];
	}

	// ── Slide management ──────────────────────────────────────────────────────
	function addSlide() {
		slides = [...slides, { id: crypto.randomUUID(), text: '', showSwipe: false }];
		activeIdx = slides.length - 1;
	}

	function duplicateSlide() {
		const dup: TextSlide = { ...slides[activeIdx], id: crypto.randomUUID() };
		slides = [...slides.slice(0, activeIdx + 1), dup, ...slides.slice(activeIdx + 1)];
		activeIdx = activeIdx + 1;
	}

	function deleteSlide(i: number) {
		if (slides.length === 1) return;
		slides = slides.filter((_, idx) => idx !== i);
		activeIdx = Math.min(activeIdx, slides.length - 1);
	}

	// ── Avatar upload ─────────────────────────────────────────────────────────
	function readAsDataURL(file: File): Promise<string> {
		return new Promise(res => {
			const r = new FileReader();
			r.onload = () => res(r.result as string);
			r.readAsDataURL(file);
		});
	}

	async function handleAvatarUpload(e: Event) {
		const file = (e.target as HTMLInputElement).files?.[0];
		if (file) profileAvatar = await readAsDataURL(file);
	}

	// ── Export ────────────────────────────────────────────────────────────────
	let exporting    = $state(false);
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
			a.download = `text-slide-${activeIdx + 1}.png`;
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
				a.download = `text-slide-${i + 1}.png`;
				a.click();
				await new Promise(r => setTimeout(r, 150));
			} catch {}
		}
		activeIdx = saved;
		exportingAll = false;
	}

	// ── Preview scale ─────────────────────────────────────────────────────────
	const PREVIEW_W = 360;
	const previewScale = $derived(PREVIEW_W / 1080);

	const THUMB_W = 88;
	const thumbScale = THUMB_W / 1080;
</script>

{#if slides.length > 0}
	<div class="fixed bottom-8 right-8 z-50 flex flex-col items-end gap-2">
		<div class="relative">
			{#if showPostPanel}
				<div class="absolute bottom-full mb-2 right-0 w-[340px] rounded-2xl bg-[#111] border border-white/[0.1] shadow-2xl overflow-hidden">
					<div class="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
						<div class="flex items-center gap-2">
							<Calendar size={13} class="text-cyan-400" />
							<span class="text-xs font-mono font-semibold text-white/80 uppercase tracking-wider">Schedule Post</span>
						</div>
						<button onclick={() => showPostPanel = false} class="w-6 h-6 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] flex items-center justify-center text-white/40 hover:text-white/80 transition-all" aria-label="Close post panel">
							<X size={11} />
						</button>
					</div>
					<div class="p-4 flex flex-col gap-4">
						<div>
							<p class="text-[9px] font-mono text-white/30 uppercase tracking-widest mb-2.5">Platforms</p>
							<div class="grid grid-cols-3 gap-2">
								<button onclick={() => togglePlatform('instagram')} class="flex flex-col items-center gap-1.5 py-3 rounded-xl border-2 transition-all {selectedPlatforms.includes('instagram') ? 'border-pink-500/60 bg-pink-500/10' : 'border-white/[0.07] bg-white/[0.02] hover:border-white/20'}">
									<svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
										<rect x="2" y="2" width="20" height="20" rx="5" stroke="{selectedPlatforms.includes('instagram') ? '#ec4899' : 'rgba(255,255,255,0.4)'}" stroke-width="1.8"/>
										<circle cx="12" cy="12" r="4.5" stroke="{selectedPlatforms.includes('instagram') ? '#ec4899' : 'rgba(255,255,255,0.4)'}" stroke-width="1.8"/>
										<circle cx="17.5" cy="6.5" r="1" fill="{selectedPlatforms.includes('instagram') ? '#ec4899' : 'rgba(255,255,255,0.4)'}"/>
									</svg>
									<span class="text-[9px] font-mono {selectedPlatforms.includes('instagram') ? 'text-pink-400' : 'text-white/30'}">Instagram</span>
								</button>
								<button onclick={() => togglePlatform('linkedin')} class="flex flex-col items-center gap-1.5 py-3 rounded-xl border-2 transition-all {selectedPlatforms.includes('linkedin') ? 'border-blue-500/60 bg-blue-500/10' : 'border-white/[0.07] bg-white/[0.02] hover:border-white/20'}">
									<svg width="20" height="20" viewBox="0 0 24 24" fill="{selectedPlatforms.includes('linkedin') ? '#3b82f6' : 'rgba(255,255,255,0.4)'}" xmlns="http://www.w3.org/2000/svg">
										<path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/>
										<rect x="2" y="9" width="4" height="12"/>
										<circle cx="4" cy="4" r="2"/>
									</svg>
									<span class="text-[9px] font-mono {selectedPlatforms.includes('linkedin') ? 'text-blue-400' : 'text-white/30'}">LinkedIn</span>
								</button>
								<button onclick={() => togglePlatform('pinterest')} class="flex flex-col items-center gap-1.5 py-3 rounded-xl border-2 transition-all {selectedPlatforms.includes('pinterest') ? 'border-red-500/60 bg-red-500/10' : 'border-white/[0.07] bg-white/[0.02] hover:border-white/20'}">
									<svg width="20" height="20" viewBox="0 0 24 24" fill="{selectedPlatforms.includes('pinterest') ? '#ef4444' : 'rgba(255,255,255,0.4)'}" xmlns="http://www.w3.org/2000/svg">
										<path d="M12 0C5.373 0 0 5.373 0 12c0 5.084 3.163 9.426 7.627 11.174-.105-.949-.2-2.405.042-3.441.218-.937 1.407-5.965 1.407-5.965s-.359-.719-.359-1.782c0-1.668.967-2.914 2.171-2.914 1.023 0 1.518.769 1.518 1.69 0 1.029-.655 2.568-.994 3.995-.283 1.194.599 2.169 1.777 2.169 2.133 0 3.772-2.249 3.772-5.495 0-2.873-2.064-4.882-5.012-4.882-3.414 0-5.418 2.561-5.418 5.207 0 1.031.397 2.138.893 2.738a.36.36 0 0 1 .083.345l-.333 1.36c-.053.22-.174.267-.402.161-1.499-.698-2.436-2.889-2.436-4.649 0-3.785 2.75-7.262 7.929-7.262 4.163 0 7.398 2.967 7.398 6.931 0 4.136-2.607 7.464-6.227 7.464-1.216 0-2.359-.632-2.75-1.378l-.748 2.853c-.271 1.043-1.002 2.35-1.492 3.146C9.57 23.812 10.763 24 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0z"/>
									</svg>
									<span class="text-[9px] font-mono {selectedPlatforms.includes('pinterest') ? 'text-red-400' : 'text-white/30'}">Pinterest</span>
								</button>
							</div>
						</div>
						<div class="grid grid-cols-2 gap-2">
							<div>
								<p class="text-[9px] font-mono text-white/30 uppercase tracking-widest mb-1.5">Date</p>
								<input type="date" bind:value={scheduleDate} class="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl py-2 px-3 text-xs font-mono text-white/60 focus:outline-none focus:border-cyan-500/40 transition-colors [color-scheme:dark]" />
							</div>
							<div>
								<p class="text-[9px] font-mono text-white/30 uppercase tracking-widest mb-1.5">Time</p>
								<input type="time" bind:value={scheduleTime} class="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl py-2 px-3 text-xs font-mono text-white/60 focus:outline-none focus:border-cyan-500/40 transition-colors [color-scheme:dark]" />
							</div>
						</div>
						<button disabled class="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold font-body text-white/40 bg-white/[0.05] border border-white/[0.08] cursor-not-allowed transition-all">
							<Send size={13} class="opacity-40" /> Schedule Post
							<span class="ml-auto text-[9px] font-mono text-white/20 bg-white/[0.05] px-2 py-0.5 rounded-md">Soon</span>
						</button>
					</div>
				</div>
			{/if}
			<button onclick={() => { showPostPanel = !showPostPanel; showMusicPanel = false; }} class="flex items-center gap-2 pl-3 pr-4 py-2.5 rounded-2xl text-xs font-semibold font-body shadow-lg transition-all {showPostPanel ? 'bg-cyan-500 text-white shadow-[0_0_20px_rgba(6,182,212,0.4)]' : 'bg-[#1a1a1a] border border-white/[0.12] text-white/70 hover:text-white hover:border-cyan-500/40 hover:bg-[#1e1e1e]'}">
				<Calendar size={14} /> Post
			</button>
		</div>
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
			<button onclick={() => { showMusicPanel = !showMusicPanel; showPostPanel = false; }} class="flex items-center gap-2 pl-3 pr-4 py-2.5 rounded-2xl text-xs font-semibold font-body shadow-lg transition-all {showMusicPanel ? 'bg-violet-600 text-white shadow-[0_0_20px_rgba(139,92,246,0.5)]' : 'bg-[#1a1a1a] border border-white/[0.12] text-white/70 hover:text-white hover:border-violet-500/40 hover:bg-[#1e1e1e]'}">
				<Music size={14} /> Burn Music
			</button>
		</div>
	</div>
{/if}

<div class="flex h-full overflow-hidden">

	<!-- ── Left sidebar ────────────────────────────────────────────────────── -->
	<div class="w-80 flex-shrink-0 border-r border-white/[0.05] bg-[#0d0d0d] flex flex-col overflow-hidden">

		<!-- Header -->
		<div class="px-5 py-4 border-b border-white/[0.04] flex-shrink-0">
			<div class="flex items-center gap-2">
				<Type size={13} class="text-white/50" />
				<h1 class="font-display font-bold text-base text-white">Text Studio</h1>
			</div>
			<p class="font-body text-xs text-white/40 mt-0.5">Dark text carousels with your brand</p>
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
					class="p-1 rounded-md hover:bg-white/[0.06] text-white/25 hover:text-white/70 transition-colors">
					<Plus size={11} />
				</button>
			</div>

			<div class="flex gap-2 overflow-x-auto pb-1" style="scrollbar-width: none;">
				{#each slides as slide, i (slide.id)}
					<button
						onclick={() => activeIdx = i}
						class="relative flex-shrink-0 group rounded-xl overflow-hidden border-2 transition-all {i === activeIdx ? 'border-white/50' : 'border-white/[0.07] hover:border-white/20'}"
						style="width: {THUMB_W}px; height: {Math.round(THUMB_W * 1350/1080)}px;"
					>
						<div style="width: {THUMB_W}px; height: {Math.round(THUMB_W * 1350/1080)}px; overflow: hidden; pointer-events: none;">
							<TextCarouselTemplate
								name={profileName}
								handle={profileHandle}
								avatar={profileAvatar}
								{ringColor}
								{bgColor}
								text={slide.text || 'Slide text…'}
								showSwipe={slide.showSwipe}
								scale={thumbScale}
								interactive={false}
							/>
						</div>

						<div class="absolute top-1 left-1 w-4 h-4 rounded-full bg-black/70 flex items-center justify-center">
							<span class="text-[8px] font-mono text-white/70">{i + 1}</span>
						</div>

						{#if slides.length > 1}
							<button
								onclick={(e) => { e.stopPropagation(); deleteSlide(i); }}
								class="absolute top-1 right-1 w-4 h-4 rounded-full bg-black/70 hover:bg-red-500/80 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
							>
								<Trash2 size={7} class="text-white" />
							</button>
						{/if}
					</button>
				{/each}

				<button onclick={addSlide}
					class="flex-shrink-0 rounded-xl border-2 border-dashed border-white/[0.08] hover:border-white/25 flex items-center justify-center text-white/20 hover:text-white/50 transition-all"
					style="width: {THUMB_W}px; height: {Math.round(THUMB_W * 1350/1080)}px;">
					<Plus size={16} />
				</button>
			</div>
		</div>

		<!-- ── Scrollable form ─────────────────────────────────────────────── -->
		<div class="flex-1 overflow-y-auto">
			<div class="flex flex-col gap-5 p-4">

				<!-- ── Profile (shared) ─────────────────────────────────────── -->
				<div>
					<p class="text-[10px] font-mono text-white/30 uppercase tracking-wider mb-3">Profile</p>

					<!-- Avatar -->
					<div class="flex items-center gap-3 mb-3">
						<div class="w-10 h-10 rounded-full overflow-hidden flex-shrink-0 flex items-center justify-center"
							style="background: {bgColor}; outline: 2px solid {ringColor}; outline-offset: 2px;">
							{#if profileAvatar}
								<img src={profileAvatar} alt="" class="w-full h-full object-cover" />
							{:else}
								<span class="text-[11px] font-bold text-white">
									{profileName.replace(/[^\w\s]/g,'').trim().split(/\s+/).map((w:string) => w[0]?.toUpperCase() ?? '').slice(0,3).join('')}
								</span>
							{/if}
						</div>
						<label class="flex-1 text-[11px] font-mono text-white/30 border border-white/[0.07] rounded-lg px-2.5 py-1.5 cursor-pointer hover:border-white/20 transition-colors">
							{profileAvatar ? 'Change avatar' : 'Upload avatar'}
							<input type="file" accept="image/*" class="hidden" onchange={handleAvatarUpload} />
						</label>
						{#if profileAvatar}
							<button onclick={() => profileAvatar = ''} class="text-white/20 hover:text-red-400 transition-colors text-xs">✕</button>
						{/if}
					</div>

					<div class="flex flex-col gap-2">
						<input bind:value={profileName} placeholder="Display name"
							class="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl py-2 px-3 text-sm font-body text-white placeholder-white/20 focus:outline-none focus:border-white/30 transition-colors" />
						<input bind:value={profileHandle} placeholder="@handle"
							class="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl py-2 px-3 text-sm font-mono text-white/70 placeholder-white/20 focus:outline-none focus:border-white/30 transition-colors" />
					</div>
				</div>

				<!-- ── Style ────────────────────────────────────────────────── -->
				<div>
					<p class="text-[10px] font-mono text-white/30 uppercase tracking-wider mb-3">Style</p>
					<div class="flex gap-3">
						<div class="flex-1">
							<p class="text-[10px] font-mono text-white/25 mb-1.5">Background</p>
							<div class="flex items-center gap-2">
								<input type="color" bind:value={bgColor}
									class="w-8 h-8 rounded-lg cursor-pointer border border-white/10 bg-transparent" />
								<input bind:value={bgColor}
									class="flex-1 bg-white/[0.04] border border-white/[0.08] rounded-lg py-1.5 px-2 text-xs font-mono text-white/70 focus:outline-none focus:border-white/30" />
							</div>
						</div>
						<div class="flex-1">
							<p class="text-[10px] font-mono text-white/25 mb-1.5">Ring color</p>
							<div class="flex items-center gap-2">
								<input type="color" bind:value={ringColor}
									class="w-8 h-8 rounded-lg cursor-pointer border border-white/10 bg-transparent" />
								<input bind:value={ringColor}
									class="flex-1 bg-white/[0.04] border border-white/[0.08] rounded-lg py-1.5 px-2 text-xs font-mono text-white/70 focus:outline-none focus:border-white/30" />
							</div>
						</div>
					</div>
				</div>

				<div class="border-t border-white/[0.05]"></div>

				<!-- ── Slide text ────────────────────────────────────────────── -->
				<div>
					<div class="flex items-center justify-between mb-2">
						<p class="text-[10px] font-mono text-white/30 uppercase tracking-wider">
							Slide {activeIdx + 1} text
						</p>
						<span class="text-[9px] font-mono text-white/20">double line-break = new paragraph</span>
					</div>
					<textarea
						bind:value={slides[activeIdx].text}
						rows={10}
						placeholder="Write your slide text here…&#10;&#10;Use a blank line to separate paragraphs."
						class="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl py-3 px-3 text-sm font-body text-white placeholder-white/20 focus:outline-none focus:border-white/30 transition-colors resize-none leading-relaxed"
					></textarea>

					<!-- Swipe toggle -->
					<button
						onclick={() => slides[activeIdx].showSwipe = !slides[activeIdx].showSwipe}
						class="flex items-center gap-2 mt-2 text-[11px] font-mono {s.showSwipe ? 'text-white/60' : 'text-white/25'} hover:text-white/70 transition-colors">
						{#if s.showSwipe}<CheckSquare size={12} />{:else}<Square size={12} />{/if}
						Show swipe indicator
					</button>
				</div>

				<div class="border-t border-white/[0.05]"></div>

				<!-- Export -->
				<div class="flex flex-col gap-2 pb-2">
					<button onclick={exportCurrent} disabled={exporting || exportingAll}
						class="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold font-body text-black bg-white hover:bg-white/90 transition-all disabled:opacity-50">
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
	<div class="flex-1 flex flex-col items-center justify-center bg-[#060606] overflow-auto p-8 gap-4">
		<p class="font-mono text-[10px] text-white/20 uppercase tracking-widest">
			Slide {activeIdx + 1} / {slides.length} — 1080 × 1350
		</p>

		<div style="width: {PREVIEW_W}px; height: {Math.round(PREVIEW_W * 1350 / 1080)}px;">
			<TextCarouselTemplate
				bind:exportRef
				name={profileName}
				handle={profileHandle}
				avatar={profileAvatar}
				{ringColor}
				{bgColor}
				text={s.text}
				showSwipe={s.showSwipe}
				scale={previewScale}
			/>
		</div>

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
