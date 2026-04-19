<script lang="ts">
	import { supabase } from '$lib/supabase';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import {
		ChevronLeft, ChevronRight, Plus, Trash2, Save, Download,
		Type, Palette, AlignLeft, AlignCenter, AlignRight, Bold,
		Sparkles, Loader, Check, ImagePlus, X
	} from 'lucide-svelte';

	const carouselId = $derived($page.params.id);

	interface Slide {
		id: string;
		text: string;
		subtext?: string;
		type: 'hook' | 'body' | 'cta';
		bg: string;
		textColor: string;
		align: 'left' | 'center' | 'right';
		bold: boolean;
		fontSize: number;
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

	const bgPresets = [
		'#0a0a0a', '#111111', '#1a0a2e', '#0a1a2e', '#1a0a0a',
		'#0d1117', '#1c1c1e', '#0f172a', '#1e1b4b', '#0c4a6e',
	];
	const textPresets = ['#ffffff', '#f8f8f8', '#8B5CF6', '#06B6D4', '#a78bfa', '#f59e0b', '#10b981', '#f43f5e'];

	onMount(async () => {
		const { data: { user } } = await supabase.auth.getUser();
		if (!user) { goto('/login'); return; }

		const { data } = await supabase.from('carousels').select('*').eq('id', carouselId).single();
		if (!data) { goto('/dashboard/carousels'); return; }
		carousel = data;

		try {
			const raw = typeof data.slides === 'string' ? JSON.parse(data.slides) : data.slides;
			slides = (raw as any[]).map(s => ({
				id: s.id ?? crypto.randomUUID(),
				text: s.text ?? '',
				subtext: s.subtext ?? '',
				type: s.type ?? 'body',
				bg: s.bg ?? '#111111',
				textColor: s.textColor ?? '#ffffff',
				align: s.align ?? 'center',
				bold: s.bold ?? false,
				fontSize: s.fontSize ?? 32,
			}));
		} catch {
			slides = [defaultSlide('hook'), defaultSlide('body'), defaultSlide('cta')];
		}
		loading = false;
	});

	function defaultSlide(type: Slide['type']): Slide {
		const defaults: Record<Slide['type'], Partial<Slide>> = {
			hook: { text: 'Your hook here', textColor: '#ffffff', bg: '#0f172a' },
			body: { text: 'Key point or insight', textColor: '#f8f8f8', bg: '#111111' },
			cta: { text: 'Follow for more!', textColor: '#8B5CF6', bg: '#0a0a0a' },
		};
		return {
			id: crypto.randomUUID(),
			text: '',
			subtext: '',
			type,
			bg: '#111111',
			textColor: '#ffffff',
			align: 'center',
			bold: false,
			fontSize: 32,
			...defaults[type],
		};
	}

	function addSlide() {
		const newSlide = defaultSlide('body');
		slides = [...slides.slice(0, activeIdx + 1), newSlide, ...slides.slice(activeIdx + 1)];
		activeIdx = activeIdx + 1;
	}

	function deleteSlide(idx: number) {
		if (slides.length <= 1) return;
		slides = slides.filter((_, i) => i !== idx);
		activeIdx = Math.min(activeIdx, slides.length - 1);
	}

	function moveSlide(from: number, to: number) {
		if (to < 0 || to >= slides.length) return;
		const s = [...slides];
		[s[from], s[to]] = [s[to], s[from]];
		slides = s;
		activeIdx = to;
	}

	async function save() {
		saving = true;
		await supabase.from('carousels').update({
			slides: JSON.stringify(slides),
			updated_at: new Date().toISOString(),
		}).eq('id', carouselId);
		saving = false;
		saved = true;
		setTimeout(() => saved = false, 2000);
	}

	async function generateHooks() {
		if (!hookTopic.trim()) return;
		generatingHooks = true;
		generatedHooks = [];
		try {
			const res = await fetch('/api/hooks', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ topic: hookTopic, count: 8 }),
			});
			const data = await res.json();
			generatedHooks = data.hooks ?? [];
		} catch { /* ignore */ }
		generatingHooks = false;
	}

	function applyHook(hook: string) {
		slides[0] = { ...slides[0], text: hook };
		slides = [...slides];
		showHookPanel = false;
		generatedHooks = [];
		hookTopic = '';
	}

	let activeSlide = $derived(slides[activeIdx]);

	function updateSlide(key: keyof Slide, value: any) {
		slides[activeIdx] = { ...slides[activeIdx], [key]: value };
		slides = [...slides];
	}
</script>

{#if loading}
	<div class="flex items-center justify-center h-full">
		<Loader size={20} class="animate-spin text-violet-400" />
	</div>
{:else}
<div class="flex h-full">
	<!-- Left: Slide strip + controls -->
	<div class="w-52 border-r border-white/[0.05] flex flex-col bg-[#0d0d0d]">
		<!-- Header -->
		<div class="flex items-center justify-between px-4 py-3 border-b border-white/[0.04]">
			<a href="/dashboard/carousels" class="flex items-center gap-1 text-xs font-body text-white/40 hover:text-white transition-colors">
				<ChevronLeft size={13} /> Back
			</a>
			<button onclick={save} disabled={saving}
				class="flex items-center gap-1 text-xs font-mono px-2.5 py-1 rounded-lg transition-all
					{saved ? 'text-cyan-400 bg-cyan-500/10' : 'text-violet-400 bg-violet-500/10 hover:bg-violet-500/20'}">
				{#if saving}<Loader size={10} class="animate-spin" />
				{:else if saved}<Check size={10} /> Saved
				{:else}<Save size={10} /> Save
				{/if}
			</button>
		</div>

		<!-- Slide thumbnails -->
		<div class="flex-1 overflow-y-auto p-3 flex flex-col gap-2">
			{#each slides as slide, i}
				<button onclick={() => activeIdx = i}
					class="relative group rounded-xl overflow-hidden border-2 transition-all aspect-[4/5] flex items-center justify-center
						{i === activeIdx ? 'border-violet-500' : 'border-white/[0.06] hover:border-white/20'}"
					style="background: {slide.bg}">
					<p class="text-[8px] font-display font-bold px-2 text-center leading-tight"
						style="color: {slide.textColor}; font-size: clamp(6px, 1.5vw, 10px)">
						{slide.text || '...'}
					</p>
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

		<!-- Move controls -->
		<div class="px-3 pb-3 flex gap-2">
			<button onclick={() => moveSlide(activeIdx, activeIdx - 1)} disabled={activeIdx === 0}
				class="flex-1 py-1.5 rounded-lg text-xs font-mono text-white/30 glass glass-hover disabled:opacity-30 transition-all flex items-center justify-center">
				<ChevronLeft size={12} />
			</button>
			<button onclick={() => moveSlide(activeIdx, activeIdx + 1)} disabled={activeIdx === slides.length - 1}
				class="flex-1 py-1.5 rounded-lg text-xs font-mono text-white/30 glass glass-hover disabled:opacity-30 transition-all flex items-center justify-center">
				<ChevronRight size={12} />
			</button>
		</div>
	</div>

	<!-- Center: Canvas preview -->
	<div class="flex-1 flex flex-col items-center justify-center bg-[#080808] relative p-8 gap-6">
		<!-- Title bar -->
		<div class="flex items-center gap-3 self-stretch">
			<p class="font-display font-semibold text-sm text-white">{carousel?.title}</p>
			<span class="text-[10px] font-mono px-2 py-0.5 rounded-full bg-white/[0.05] text-white/30">{slides.length} slides</span>
			<div class="ml-auto flex items-center gap-2">
				<button onclick={() => showHookPanel = !showHookPanel}
					class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-body text-violet-300 bg-violet-500/10 hover:bg-violet-500/20 border border-violet-500/15 transition-all">
					<Sparkles size={11} />
					AI Hooks
				</button>
			</div>
		</div>

		<!-- Hook generator panel -->
		{#if showHookPanel}
			<div class="absolute top-16 right-6 w-80 glass border border-violet-500/20 rounded-2xl p-5 z-20 shadow-2xl">
				<div class="flex items-center justify-between mb-4">
					<h3 class="font-display font-semibold text-sm text-white">Generate AI Hooks</h3>
					<button onclick={() => showHookPanel = false} class="text-white/30 hover:text-white transition-colors">
						<X size={14} />
					</button>
				</div>
				<div class="flex gap-2 mb-4">
					<input bind:value={hookTopic} placeholder="e.g. productivity tips"
						class="flex-1 bg-white/[0.04] border border-white/[0.08] rounded-xl py-2 px-3 text-sm font-body text-white placeholder-white/20 focus:outline-none focus:border-violet-500/50 transition-colors" />
					<button onclick={generateHooks} disabled={generatingHooks || !hookTopic.trim()}
						class="px-3 py-2 rounded-xl text-xs font-semibold font-body text-white bg-violet-600 hover:bg-violet-500 transition-colors disabled:opacity-40 shrink-0">
						{generatingHooks ? '...' : 'Go'}
					</button>
				</div>
				{#if generatingHooks}
					<div class="flex items-center gap-2 text-xs text-white/30 font-mono py-2">
						<Loader size={11} class="animate-spin text-violet-400" /> Generating with Claude...
					</div>
				{/if}
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

		<!-- Canvas slide preview -->
		{#if activeSlide}
			<div class="relative rounded-2xl overflow-hidden shadow-2xl"
				style="width: 320px; height: 400px; background: {activeSlide.bg}; display: flex; flex-direction: column; align-items: {activeSlide.align === 'left' ? 'flex-start' : activeSlide.align === 'right' ? 'flex-end' : 'center'}; justify-content: center; padding: 32px;">
				<!-- Subtle gradient overlay -->
				<div class="absolute inset-0 opacity-30"
					style="background: radial-gradient(ellipse at 30% 20%, rgba(139,92,246,0.15) 0%, transparent 60%)">
				</div>
				<div class="relative z-10 w-full" style="text-align: {activeSlide.align}">
					<!-- Slide number badge -->
					<div class="inline-block mb-4 px-2 py-0.5 rounded-full border"
						style="border-color: {activeSlide.textColor}22; background: {activeSlide.textColor}11">
						<span class="text-[10px] font-mono" style="color: {activeSlide.textColor}88">
							{activeSlide.type.toUpperCase()} · {activeIdx + 1}/{slides.length}
						</span>
					</div>
					<p class="leading-tight"
						style="color: {activeSlide.textColor}; font-size: {activeSlide.fontSize}px; font-family: 'Syne', sans-serif; font-weight: {activeSlide.bold ? 800 : 600}; word-break: break-word">
						{activeSlide.text || 'Click to edit text →'}
					</p>
					{#if activeSlide.subtext}
						<p class="mt-3 text-sm leading-relaxed"
							style="color: {activeSlide.textColor}99; font-family: 'DM Sans', sans-serif">
							{activeSlide.subtext}
						</p>
					{/if}
				</div>
			</div>
		{/if}

		<!-- Slide nav dots -->
		<div class="flex items-center gap-1.5">
			{#each slides as _, i}
				<button onclick={() => activeIdx = i}
					class="rounded-full transition-all {i === activeIdx ? 'w-4 h-1.5 bg-violet-500' : 'w-1.5 h-1.5 bg-white/20 hover:bg-white/40'}">
				</button>
			{/each}
		</div>
	</div>

	<!-- Right: Properties panel -->
	{#if activeSlide}
		<div class="w-64 border-l border-white/[0.05] bg-[#0d0d0d] flex flex-col overflow-y-auto">
			<div class="px-5 py-4 border-b border-white/[0.04]">
				<p class="font-display font-semibold text-sm text-white">Slide {activeIdx + 1} properties</p>
			</div>

			<div class="p-4 flex flex-col gap-5">
				<!-- Slide type -->
				<div>
					<label class="text-[10px] font-mono text-white/30 uppercase tracking-wider block mb-2">Type</label>
					<div class="flex gap-1">
						{#each ['hook', 'body', 'cta'] as t}
							<button onclick={() => updateSlide('type', t)}
								class="flex-1 py-1.5 rounded-lg text-xs font-mono capitalize transition-all {activeSlide.type === t ? 'bg-violet-500/20 text-violet-300 border border-violet-500/25' : 'text-white/30 glass glass-hover'}">
								{t}
							</button>
						{/each}
					</div>
				</div>

				<!-- Main text -->
				<div>
					<label class="text-[10px] font-mono text-white/30 uppercase tracking-wider block mb-2">
						<Type size={9} class="inline mr-1" />Main Text
					</label>
					<textarea bind:value={slides[activeIdx].text}
						oninput={(e) => updateSlide('text', (e.target as HTMLTextAreaElement).value)}
						rows={4}
						placeholder="Enter your text..."
						class="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl py-2.5 px-3 text-sm font-body text-white placeholder-white/20 focus:outline-none focus:border-violet-500/50 transition-colors resize-none">
					</textarea>
				</div>

				<!-- Subtext -->
				<div>
					<label class="text-[10px] font-mono text-white/30 uppercase tracking-wider block mb-2">Subtext (optional)</label>
					<textarea bind:value={slides[activeIdx].subtext}
						oninput={(e) => updateSlide('subtext', (e.target as HTMLTextAreaElement).value)}
						rows={2}
						placeholder="Supporting copy..."
						class="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl py-2.5 px-3 text-sm font-body text-white placeholder-white/20 focus:outline-none focus:border-violet-500/50 transition-colors resize-none">
					</textarea>
				</div>

				<!-- Font size -->
				<div>
					<label class="text-[10px] font-mono text-white/30 uppercase tracking-wider block mb-2">
						Font size: {activeSlide.fontSize}px
					</label>
					<input type="range" min={16} max={56} step={2} bind:value={slides[activeIdx].fontSize}
						oninput={(e) => updateSlide('fontSize', parseInt((e.target as HTMLInputElement).value))}
						class="w-full accent-violet-500" />
				</div>

				<!-- Text align + bold -->
				<div>
					<label class="text-[10px] font-mono text-white/30 uppercase tracking-wider block mb-2">Format</label>
					<div class="flex gap-1">
						{#each [['left', AlignLeft], ['center', AlignCenter], ['right', AlignRight]] as [val, Icon]}
							<button onclick={() => updateSlide('align', val)}
								class="flex-1 py-1.5 rounded-lg flex items-center justify-center transition-all {activeSlide.align === val ? 'bg-violet-500/20 text-violet-300 border border-violet-500/25' : 'text-white/30 glass glass-hover'}">
								<svelte:component this={Icon} size={13} />
							</button>
						{/each}
						<button onclick={() => updateSlide('bold', !activeSlide.bold)}
							class="flex-1 py-1.5 rounded-lg flex items-center justify-center transition-all {activeSlide.bold ? 'bg-violet-500/20 text-violet-300 border border-violet-500/25' : 'text-white/30 glass glass-hover'}">
							<Bold size={13} />
						</button>
					</div>
				</div>

				<!-- Text color -->
				<div>
					<label class="text-[10px] font-mono text-white/30 uppercase tracking-wider block mb-2">
						<Palette size={9} class="inline mr-1" />Text color
					</label>
					<div class="flex flex-wrap gap-1.5 mb-2">
						{#each textPresets as color}
							<button onclick={() => updateSlide('textColor', color)}
								class="w-6 h-6 rounded-lg border-2 transition-all {activeSlide.textColor === color ? 'border-white scale-110' : 'border-transparent hover:scale-105'}"
								style="background: {color}">
							</button>
						{/each}
					</div>
					<input type="color" value={activeSlide.textColor}
						oninput={(e) => updateSlide('textColor', (e.target as HTMLInputElement).value)}
						class="w-full h-8 rounded-lg cursor-pointer bg-transparent border border-white/[0.08]" />
				</div>

				<!-- Background color -->
				<div>
					<label class="text-[10px] font-mono text-white/30 uppercase tracking-wider block mb-2">Background</label>
					<div class="flex flex-wrap gap-1.5 mb-2">
						{#each bgPresets as color}
							<button onclick={() => updateSlide('bg', color)}
								class="w-6 h-6 rounded-lg border-2 transition-all {activeSlide.bg === color ? 'border-white scale-110' : 'border-white/10 hover:scale-105'}"
								style="background: {color}">
							</button>
						{/each}
					</div>
					<input type="color" value={activeSlide.bg}
						oninput={(e) => updateSlide('bg', (e.target as HTMLInputElement).value)}
						class="w-full h-8 rounded-lg cursor-pointer bg-transparent border border-white/[0.08]" />
				</div>
			</div>

			<!-- Save button -->
			<div class="p-4 border-t border-white/[0.04] mt-auto">
				<button onclick={save} disabled={saving}
					class="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold font-body text-white bg-gradient-to-r from-violet-600 to-cyan-500 hover:shadow-[0_0_20px_rgba(139,92,246,0.3)] transition-all disabled:opacity-50">
					{#if saving}<Loader size={13} class="animate-spin" />
					{:else if saved}<Check size={13} /> Saved!
					{:else}<Save size={13} /> Save carousel
					{/if}
				</button>
			</div>
		</div>
	{/if}
</div>
{/if}
