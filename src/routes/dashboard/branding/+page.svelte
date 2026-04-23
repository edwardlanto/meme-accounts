<script lang="ts">
	import { Image as ImageIcon, Sparkles, Loader, X, ArrowUpDown, ArrowDownUp, Send, Music2 } from 'lucide-svelte';
	import { onDestroy } from 'svelte';

	type Step = 'idle' | 'analyzing' | 'writing' | 'rendering' | 'done' | 'error';

	type SlideItem = { id: string; url: string };
	type SortMode = 'generated' | 'reverse';
	type ImageSizePreset = 'ig_4_5' | 'square' | 'landscape';

	let referenceFile: File | null = $state(null);
	let referencePreviewUrl = $state<string>('');
	let topic = $state('');
	let brandName = $state('');
	let slideCount = $state(5);
	let imageSizePreset = $state<ImageSizePreset>('ig_4_5');

	let step: Step = $state('idle');
	let error = $state('');
	let slides = $state<SlideItem[]>([]);
	let sortMode = $state<SortMode>('generated');

	function setFile(f: File | null) {
		referenceFile = f;
		if (referencePreviewUrl) URL.revokeObjectURL(referencePreviewUrl);
		referencePreviewUrl = f ? URL.createObjectURL(f) : '';
	}

	onDestroy(() => {
		if (referencePreviewUrl) URL.revokeObjectURL(referencePreviewUrl);
	});

	const canGenerate = $derived(!!referenceFile && topic.trim().length > 0 && brandName.trim().length > 0);
	const isBusy = $derived.by(() => step === 'analyzing' || step === 'writing' || step === 'rendering');
	const statusLabel = $derived.by(() => {
		if (step === 'analyzing') return 'Analyzing Style…';
		if (step === 'writing') return 'Writing Slide Strategy…';
		if (step === 'rendering') return `Rendering ${slideCount} Branded Images…`;
		if (step === 'done') return 'Done';
		if (step === 'error') return 'Error';
		return 'Ready';
	});

	function applySort(mode: SortMode) {
		sortMode = mode;
		if (mode === 'generated') {
			// no-op: keep current order
			return;
		}
		if (mode === 'reverse') {
			slides = [...slides].reverse();
		}
	}

	function move(from: number, to: number) {
		if (from === to) return;
		const next = [...slides];
		const [it] = next.splice(from, 1);
		next.splice(to, 0, it);
		slides = next;
	}

	function onDragStart(e: DragEvent, idx: number) {
		e.dataTransfer?.setData('text/plain', String(idx));
		e.dataTransfer?.setDragImage(new window.Image(), 0, 0);
	}

	function onDrop(e: DragEvent, idx: number) {
		const raw = e.dataTransfer?.getData('text/plain') ?? '';
		const from = Number(raw);
		if (!Number.isFinite(from)) return;
		move(from, idx);
	}

	async function generate() {
		if (!canGenerate) return;
		step = 'analyzing';
		error = '';
		slides = [];

		const fd = new FormData();
		fd.set('reference', referenceFile!);
		fd.set('topic', topic);
		fd.set('brandName', brandName);
		fd.set('slideCount', String(slideCount));
		fd.set('imageSizePreset', imageSizePreset);

		try {
			const res = await fetch('/api/generate', { method: 'POST', body: fd });
			step = 'writing';
			const data = await res.json();
			if (!res.ok) throw new Error(data?.error ?? 'Generation failed');

			step = 'rendering';
			const urls: string[] = Array.isArray(data?.images) ? data.images : [];
			if (!urls.length) throw new Error('No images returned');

			slides = urls.map((url, i) => ({ id: crypto.randomUUID(), url }));
			sortMode = 'generated';
			step = 'done';
		} catch (e: any) {
			error = e?.message ?? 'Something went wrong';
			step = 'error';
		}
	}

	// Placeholder actions for the next phase (scheduler + audio burn).
	function postNow() {
		alert('Post: coming soon. (Next: export slides in current order + send to scheduler)');
	}
	function burnAudio() {
		alert('Burn audio: coming soon. (Next: pick a track + render video(s))');
	}
</script>

<div class="p-8">
	<div class="flex items-start justify-between gap-6 flex-wrap">
		<div>
			<h1 class="text-xl font-semibold text-white/90">Branding</h1>
			<p class="mt-2 text-sm text-white/35 max-w-xl leading-relaxed">
				Upload a style reference. Enter a topic. Get a visually consistent, Instagram-ready carousel.
			</p>
		</div>

		<div class="flex items-center gap-2">
			<button
				type="button"
				onclick={burnAudio}
				class="inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-semibold
					bg-white/[0.06] text-white/70 hover:text-white hover:bg-white/[0.09] border border-white/10 transition-colors"
			>
				<Music2 size={16} /> Burn audio
			</button>
			<button
				type="button"
				onclick={postNow}
				class="inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-semibold
					bg-white/[0.06] text-white/70 hover:text-white hover:bg-white/[0.09] border border-white/10 transition-colors"
			>
				<Send size={16} /> Post
			</button>
			<button
				type="button"
				onclick={generate}
				disabled={!canGenerate || isBusy}
				class="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold
					{canGenerate ? 'bg-white text-black hover:bg-white/90' : 'bg-white/10 text-white/40'}
					transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
			>
				{#if isBusy}
					<Loader size={16} class="animate-spin" />
					<span>{statusLabel}</span>
				{:else}
					<Sparkles size={16} />
					<span>Generate carousel</span>
				{/if}
			</button>
		</div>
	</div>

	<div class="mt-7 grid grid-cols-1 xl:grid-cols-2 gap-6">
		<!-- Left: inputs -->
		<div class="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
			<p class="text-[11px] font-mono uppercase tracking-widest text-white/40">Inputs</p>

			<!-- Upload -->
			<div class="mt-4">
				<label for="ref" class="text-xs text-white/60">Style reference image</label>
				<div class="mt-2">
					<label
						class="group relative block w-full overflow-hidden rounded-xl border border-white/10 bg-black/20
							hover:border-white/20 transition-colors cursor-pointer"
					>
						<input
							id="ref"
							type="file"
							accept="image/*"
							class="hidden"
							onchange={(e) => {
								const f = (e.currentTarget as HTMLInputElement).files?.[0] ?? null;
								(e.currentTarget as HTMLInputElement).value = '';
								setFile(f);
							}}
						/>

						{#if referencePreviewUrl}
							<img src={referencePreviewUrl} alt="Reference preview" class="h-56 w-full object-cover" />
							<button
								type="button"
								class="absolute top-2 right-2 inline-flex items-center justify-center w-9 h-9 rounded-xl bg-black/70 border border-white/10 text-white/70 hover:text-white hover:border-white/20"
								onclick={(e) => {
									e.preventDefault();
									setFile(null);
								}}
								aria-label="Remove reference image"
							>
								<X size={16} />
							</button>
						{:else}
							<div class="h-56 w-full flex flex-col items-center justify-center gap-2">
								<div class="w-12 h-12 rounded-2xl bg-white/[0.05] border border-white/10 flex items-center justify-center">
									<ImageIcon size={18} class="text-white/50" />
								</div>
								<div class="text-center">
									<p class="text-sm text-white/70">Upload a reference</p>
									<p class="mt-0.5 text-xs text-white/35">PNG/JPG · 1 image</p>
								</div>
							</div>
						{/if}
					</label>
				</div>
			</div>

			<div class="mt-4">
				<label for="topic" class="text-xs text-white/60">Carousel topic</label>
				<textarea
					id="topic"
					bind:value={topic}
					rows={3}
					placeholder="e.g. Top ten richest founders under 30"
					class="mt-2 w-full rounded-xl bg-white/[0.04] border border-white/10 px-3 py-2.5 text-sm text-white/85 placeholder:text-white/25 focus:outline-none focus:border-white/25 resize-none"
				></textarea>
			</div>

			<div class="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
				<div>
					<label for="brandName" class="text-xs text-white/60">Brand name</label>
					<input
						id="brandName"
						bind:value={brandName}
						placeholder="e.g. StartupStealth"
						class="mt-2 w-full rounded-xl bg-white/[0.04] border border-white/10 px-3 py-2.5 text-sm text-white/85 placeholder:text-white/25 focus:outline-none focus:border-white/25"
					/>
				</div>
				<div>
					<label for="slides" class="text-xs text-white/60">Number of slides</label>
					<div class="mt-2 flex items-center gap-3">
						<input
							id="slides"
							type="range"
							min="1"
							max="10"
							step="1"
							bind:value={slideCount}
							class="flex-1 accent-white"
						/>
						<input
							type="number"
							min="1"
							max="10"
							bind:value={slideCount}
							class="w-20 rounded-xl bg-white/[0.04] border border-white/10 px-3 py-2.5 text-sm text-white/85 focus:outline-none focus:border-white/25"
						/>
					</div>
				</div>
			</div>

			<div class="mt-4">
				<label for="img-size" class="text-xs text-white/60">Image size</label>
				<div class="mt-2 flex items-center gap-3">
					<select
						id="img-size"
						bind:value={imageSizePreset}
						class="flex-1 rounded-xl bg-white/[0.04] border border-white/10 px-3 py-2.5 text-sm text-white/85 focus:outline-none focus:border-white/25 [color-scheme:dark]"
					>
						<option value="ig_4_5">Instagram 4:5 (1024×1280)</option>
						<option value="square">Square (1024×1024)</option>
						<option value="landscape">Landscape (1536×1024)</option>
					</select>
				</div>
				<p class="mt-1.5 text-[11px] text-white/30">Use smaller sizes while iterating to reduce cost and latency.</p>
			</div>

			{#if isBusy}
				<div class="mt-5 rounded-xl border border-white/10 bg-black/20 p-3">
					<div class="flex items-center gap-3">
						<div class="w-9 h-9 rounded-xl bg-white/[0.06] border border-white/10 flex items-center justify-center">
							<Loader size={16} class="animate-spin text-white/70" />
						</div>
						<div class="min-w-0">
							<p class="text-sm font-semibold text-white/80 truncate">{statusLabel}</p>
							<p class="text-xs text-white/35 mt-0.5">This can take ~15–60s depending on slide count.</p>
						</div>
					</div>
					<div class="mt-3 flex items-center gap-2 text-[11px] text-white/40">
						<div class="flex items-center gap-2">
							<span class="{step === 'analyzing' ? 'text-white' : 'text-white/40'}">1</span>
							<span class="text-white/30">Analyzing</span>
						</div>
						<div class="h-px flex-1 bg-white/10"></div>
						<div class="flex items-center gap-2">
							<span class="{step === 'writing' ? 'text-white' : 'text-white/40'}">2</span>
							<span class="text-white/30">Strategy</span>
						</div>
						<div class="h-px flex-1 bg-white/10"></div>
						<div class="flex items-center gap-2">
							<span class="{step === 'rendering' ? 'text-white' : 'text-white/40'}">3</span>
							<span class="text-white/30">Render</span>
						</div>
					</div>
				</div>
			{/if}

			{#if error}
				<div class="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
					{error}
				</div>
			{/if}
		</div>

		<!-- Right: results -->
		<div class="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
			<div class="flex items-center justify-between gap-3">
				<p class="text-[11px] font-mono uppercase tracking-widest text-white/40">Instagram Preview</p>
				<div class="flex items-center gap-2">
					<button
						type="button"
						onclick={() => applySort(sortMode === 'generated' ? 'reverse' : 'generated')}
						disabled={slides.length < 2}
						class="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-mono
							bg-white/[0.04] border border-white/10 text-white/55 hover:text-white/80 hover:bg-white/[0.06]
							disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
						title="Toggle sort"
					>
						{#if sortMode === 'generated'}
							<ArrowUpDown size={12} /> Sort
						{:else}
							<ArrowDownUp size={12} /> Sorted
						{/if}
					</button>
				</div>
			</div>

			{#if slides.length === 0}
				<div class="mt-4 h-[420px] rounded-2xl border border-white/10 bg-black/20 flex items-center justify-center">
					<div class="text-center max-w-xs">
						<p class="text-sm text-white/60">Your generated slides will appear here.</p>
						<p class="mt-1 text-xs text-white/30">Drag to reorder once they’re generated.</p>
					</div>
				</div>
			{:else}
				<p class="mt-3 text-[11px] text-white/35">Drag cards to reorder. This order is what Post/Burn will use.</p>
				<div class="mt-3 flex gap-4 overflow-x-auto pb-2 snap-x snap-mandatory">
					{#each slides as s, i (s.id)}
						<div
							class="snap-start flex-shrink-0"
							draggable="true"
							ondragstart={(e) => onDragStart(e, i)}
							ondragover={(e) => { e.preventDefault(); }}
							ondrop={(e) => onDrop(e, i)}
							role="listitem"
						>
							<div class="w-[260px] h-[325px] rounded-2xl overflow-hidden border border-white/10 bg-black/30">
								<img src={s.url} alt="Slide {i + 1}" class="w-full h-full object-cover" />
							</div>
							<p class="mt-2 text-[11px] text-white/35 font-mono">Slide {i + 1}/{slides.length}</p>
						</div>
					{/each}
				</div>
			{/if}
		</div>
	</div>
</div>

