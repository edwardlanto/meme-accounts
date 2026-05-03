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

	const PREVIEW_W = 260;
	const previewCard = $derived.by(() => {
		switch (imageSizePreset) {
			case 'square':
				return { w: PREVIEW_W, h: PREVIEW_W };
			case 'landscape':
				return { w: PREVIEW_W, h: Math.round((PREVIEW_W * 1024) / 1536) };
			default:
				return { w: PREVIEW_W, h: Math.round((PREVIEW_W * 1280) / 1024) };
		}
	});

	const slideCountPresets = [3, 5, 7, 8, 10] as const;
</script>

<div class="mx-auto max-w-6xl p-6 sm:p-8 pb-12">
	<div class="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
		<div class="min-w-0 max-w-xl">
			<p class="text-[11px] font-medium uppercase tracking-[0.14em] text-[color:var(--app-text-3)]">
				Brand generator
			</p>
			<h1 class="mt-2 text-2xl font-semibold tracking-tight text-[color:var(--app-text)] sm:text-[1.65rem]">
				Carousel from your visual style
			</h1>
			<p
				class="mt-3 text-sm leading-relaxed text-[color:var(--app-text-2)] border-l-2 border-[color:var(--app-focus)] pl-4"
			>
				Upload a reference image, describe the topic, and generate a matched set of slides—same palette,
				type rhythm, and composition across the deck.
			</p>
		</div>

		<div class="flex flex-shrink-0 flex-wrap items-center gap-2">
			<button
				type="button"
				onclick={burnAudio}
				class="inline-flex items-center gap-2 rounded-xl border border-[color:var(--app-border)] bg-[color:color-mix(in_oklab,var(--app-text)_5%,transparent)] px-3.5 py-2 text-sm font-semibold text-[color:var(--app-text-2)] transition-colors hover:border-[color:var(--app-border-hover)] hover:bg-[color:color-mix(in_oklab,var(--app-text)_8%,transparent)] hover:text-[color:var(--app-text)]"
			>
				<Music2 size={16} /> Burn audio
			</button>
			<button
				type="button"
				onclick={postNow}
				class="inline-flex items-center gap-2 rounded-xl border border-[color:var(--app-border)] bg-[color:color-mix(in_oklab,var(--app-text)_5%,transparent)] px-3.5 py-2 text-sm font-semibold text-[color:var(--app-text-2)] transition-colors hover:border-[color:var(--app-border-hover)] hover:bg-[color:color-mix(in_oklab,var(--app-text)_8%,transparent)] hover:text-[color:var(--app-text)]"
			>
				<Send size={16} /> Post
			</button>
			<button
				type="button"
				onclick={generate}
				disabled={!canGenerate || isBusy}
				class="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold shadow-md transition-all disabled:cursor-not-allowed disabled:opacity-55
					{canGenerate && !isBusy
					? 'bg-[color:var(--app-text)] text-[color:var(--app-bg)] hover:opacity-92 hover:shadow-lg'
					: 'bg-[color:color-mix(in_oklab,var(--app-text)_12%,transparent)] text-[color:var(--app-text-3)]'}"
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

	<div class="mt-8 grid grid-cols-1 gap-6 xl:grid-cols-2 xl:gap-8">
		<!-- Left: inputs -->
		<div
			class="rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-2)] p-5 shadow-sm sm:p-6"
		>
			<p class="text-[11px] font-mono uppercase tracking-widest text-[color:var(--app-text-3)]">Inputs</p>

			<!-- Upload -->
			<div class="mt-5">
				<label for="ref" class="text-xs font-medium text-[color:var(--app-text-2)]">Style reference image</label>
				<div class="mt-2">
					<label
						class="group relative block w-full cursor-pointer overflow-hidden rounded-xl border border-dashed border-[color:var(--app-border)]
							bg-[color:color-mix(in_oklab,var(--app-text)_3%,transparent)] transition-colors hover:border-[color:var(--app-border-hover)] hover:bg-[color:color-mix(in_oklab,var(--app-text)_5%,transparent)]"
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
								class="absolute right-2 top-2 inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[color:var(--app-border)] bg-[color:color-mix(in_oklab,var(--app-bg)_65%,var(--app-text))] text-[color:var(--app-text-2)] backdrop-blur-sm hover:text-[color:var(--app-text)]"
								onclick={(e) => {
									e.preventDefault();
									setFile(null);
								}}
								aria-label="Remove reference image"
							>
								<X size={16} />
							</button>
						{:else}
							<div class="flex h-56 w-full flex-col items-center justify-center gap-2">
								<div
									class="flex h-12 w-12 items-center justify-center rounded-2xl border border-[color:var(--app-border)] bg-[color:color-mix(in_oklab,var(--app-text)_5%,transparent)]"
								>
									<ImageIcon size={18} class="text-[color:var(--app-text-3)]" />
								</div>
								<div class="text-center">
									<p class="text-sm font-medium text-[color:var(--app-text)]">Drop or click to upload</p>
									<p class="mt-0.5 text-xs text-[color:var(--app-text-3)]">PNG or JPG · one moodboard or sample slide</p>
								</div>
							</div>
						{/if}
					</label>
				</div>
			</div>

			<div class="mt-5">
				<label for="topic" class="text-xs font-medium text-[color:var(--app-text-2)]">Carousel topic</label>
				<textarea
					id="topic"
					bind:value={topic}
					rows={3}
					placeholder="e.g. Five signals the market is topping — and what to watch next"
					class="mt-2 w-full resize-none rounded-xl border border-[color:var(--app-border)] bg-[color:var(--app-bg)] px-3 py-2.5 text-sm text-[color:var(--app-text)] placeholder:text-[color:var(--app-text-3)] focus:border-[color:var(--app-focus)] focus:outline-none focus:ring-2 focus:ring-[color:color-mix(in_oklab,var(--app-focus)_35%,transparent)]"
				></textarea>
			</div>

			<div class="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
				<div class="sm:col-span-2">
					<label for="brandName" class="text-xs font-medium text-[color:var(--app-text-2)]">Brand name</label>
					<input
						id="brandName"
						bind:value={brandName}
						placeholder="Shown on slides when the model includes a logo or wordmark"
						class="mt-2 w-full rounded-xl border border-[color:var(--app-border)] bg-[color:var(--app-bg)] px-3 py-2.5 text-sm text-[color:var(--app-text)] placeholder:text-[color:var(--app-text-3)] focus:border-[color:var(--app-focus)] focus:outline-none focus:ring-2 focus:ring-[color:color-mix(in_oklab,var(--app-focus)_35%,transparent)]"
					/>
				</div>
			</div>

			<div class="mt-5">
				<p class="text-xs font-medium text-[color:var(--app-text-2)]">Slide count</p>
				<p class="mt-0.5 text-[11px] text-[color:var(--app-text-3)]">More slides take longer and use more generation budget.</p>
				<div class="mt-2.5 flex flex-wrap gap-2" role="group" aria-label="Number of slides">
					{#each slideCountPresets as n (n)}
						<button
							type="button"
							onclick={() => (slideCount = n)}
							class="min-w-[3rem] rounded-full border px-3 py-1.5 text-xs font-semibold tabular-nums transition-colors
								{slideCount === n
								? 'border-[color:var(--app-focus)] bg-[color:color-mix(in_oklab,var(--app-focus)_18%,transparent)] text-[color:var(--app-text)]'
								: 'border-[color:var(--app-border)] bg-[color:color-mix(in_oklab,var(--app-text)_4%,transparent)] text-[color:var(--app-text-2)] hover:border-[color:var(--app-border-hover)]'}"
						>
							{n}
						</button>
					{/each}
				</div>
			</div>

			<div class="mt-5">
				<label for="img-size" class="text-xs font-medium text-[color:var(--app-text-2)]">Image size</label>
				<div class="mt-2 flex items-center gap-3">
					<select
						id="img-size"
						bind:value={imageSizePreset}
						class="w-full flex-1 rounded-xl border border-[color:var(--app-border)] bg-[color:var(--app-bg)] px-3 py-2.5 text-sm text-[color:var(--app-text)] focus:border-[color:var(--app-focus)] focus:outline-none focus:ring-2 focus:ring-[color:color-mix(in_oklab,var(--app-focus)_35%,transparent)]"
					>
						<option value="ig_4_5">Instagram 4:5 (1024×1280)</option>
						<option value="square">Square (1024×1024)</option>
						<option value="landscape">Landscape (1536×1024)</option>
					</select>
				</div>
				<p class="mt-1.5 text-[11px] text-[color:var(--app-text-3)]">
					Preview strip below matches this aspect ratio. Smaller batches help while iterating.
				</p>
			</div>

			{#if isBusy}
				<div
					class="mt-6 rounded-xl border border-[color:var(--app-border)] bg-[color:color-mix(in_oklab,var(--app-text)_4%,transparent)] p-4"
				>
					<div class="flex items-center gap-3">
						<div
							class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-2)]"
						>
							<Loader size={18} class="animate-spin text-[color:var(--app-text-2)]" />
						</div>
						<div class="min-w-0">
							<p class="truncate text-sm font-semibold text-[color:var(--app-text)]">{statusLabel}</p>
							<p class="mt-0.5 text-xs text-[color:var(--app-text-3)]">
								Typical range ~15–60s depending on slide count and API load.
							</p>
						</div>
					</div>
					<div class="mt-4 flex items-center gap-2 text-[11px] text-[color:var(--app-text-3)]">
						<div class="flex items-center gap-2">
							<span
								class="flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold {step === 'analyzing'
									? 'bg-[color:var(--app-text)] text-[color:var(--app-bg)]'
									: 'border border-[color:var(--app-border)] text-[color:var(--app-text-2)]'}"
								>1</span
							>
							<span>Analyze</span>
						</div>
						<div class="h-px flex-1 bg-[color:var(--app-border)]"></div>
						<div class="flex items-center gap-2">
							<span
								class="flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold {step === 'writing'
									? 'bg-[color:var(--app-text)] text-[color:var(--app-bg)]'
									: 'border border-[color:var(--app-border)] text-[color:var(--app-text-2)]'}"
								>2</span
							>
							<span>Strategy</span>
						</div>
						<div class="h-px flex-1 bg-[color:var(--app-border)]"></div>
						<div class="flex items-center gap-2">
							<span
								class="flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold {step === 'rendering'
									? 'bg-[color:var(--app-text)] text-[color:var(--app-bg)]'
									: 'border border-[color:var(--app-border)] text-[color:var(--app-text-2)]'}"
								>3</span
							>
							<span>Render</span>
						</div>
					</div>
				</div>
			{/if}

			{#if error}
				<div
					class="mt-4 rounded-xl border border-red-500/35 bg-red-500/[0.08] p-3 text-sm text-red-600 dark:text-red-300"
				>
					{error}
				</div>
			{/if}
		</div>

		<!-- Right: results -->
		<div
			class="rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-2)] p-5 shadow-sm sm:p-6"
		>
			<div class="flex flex-wrap items-center justify-between gap-3">
				<div>
					<p class="text-[11px] font-mono uppercase tracking-widest text-[color:var(--app-text-3)]">Deck preview</p>
					<p class="mt-1 text-xs text-[color:var(--app-text-2)]">Filmstrip matches your export aspect ratio.</p>
				</div>
				<div class="flex items-center gap-2">
					<button
						type="button"
						onclick={() => applySort(sortMode === 'generated' ? 'reverse' : 'generated')}
						disabled={slides.length < 2}
						class="inline-flex items-center gap-1.5 rounded-lg border border-[color:var(--app-border)] bg-[color:color-mix(in_oklab,var(--app-text)_4%,transparent)] px-2.5 py-1.5 font-mono text-[11px] text-[color:var(--app-text-2)] transition-colors hover:border-[color:var(--app-border-hover)] hover:text-[color:var(--app-text)] disabled:cursor-not-allowed disabled:opacity-40"
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
				<div
					class="mt-5 flex min-h-[min(420px,50vh)] items-center justify-center rounded-2xl border border-dashed border-[color:var(--app-border)] bg-[color:color-mix(in_oklab,var(--app-text)_3%,transparent)] px-6"
				>
					<div class="max-w-sm text-center">
						<div
							class="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-2)] shadow-inner"
						>
							<ImageIcon size={22} class="text-[color:var(--app-text-3)]" />
						</div>
						<p class="text-sm font-medium text-[color:var(--app-text)]">Ready when you are</p>
						<p class="mt-2 text-xs leading-relaxed text-[color:var(--app-text-3)]">
							Fill in reference, topic, and brand—then generate. Cards appear here in swipe order; drag to reorder.
						</p>
					</div>
				</div>
			{:else}
				<p class="mt-4 text-[11px] text-[color:var(--app-text-3)]">
					Drag cards to reorder. Post and burn will follow this sequence.
				</p>
				<div class="mt-3 flex snap-x snap-mandatory gap-5 overflow-x-auto pb-3 pt-1 [scrollbar-width:thin]">
					{#each slides as s, i (s.id)}
						<div
							class="flex-shrink-0 snap-start"
							draggable="true"
							ondragstart={(e) => onDragStart(e, i)}
							ondragover={(e) => {
								e.preventDefault();
							}}
							ondrop={(e) => onDrop(e, i)}
							role="listitem"
						>
							<div
								class="overflow-hidden rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-bg)] shadow-md ring-1 ring-[color:color-mix(in_oklab,var(--app-text)_6%,transparent)] transition-shadow hover:shadow-lg"
								style="width: {previewCard.w}px; height: {previewCard.h}px;"
							>
								<img src={s.url} alt="Slide {i + 1}" class="h-full w-full object-cover" draggable="false" />
							</div>
							<p class="mt-2 text-center font-mono text-[11px] tabular-nums text-[color:var(--app-text-3)]">
								{i + 1} / {slides.length}
							</p>
						</div>
					{/each}
				</div>
			{/if}
		</div>
	</div>
</div>

