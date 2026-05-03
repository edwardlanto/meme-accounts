<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import JSZip from 'jszip';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import {
		ArrowLeft,
		ChevronLeft,
		ChevronRight,
		Download,
		LoaderCircle,
		Music,
		Play,
	} from 'lucide-svelte';
	import type { PageProps } from './$types';

	const STORAGE_KEY = 'burn-music-v1';

	let { data }: PageProps = $props();

	type SlideRow = {
		label: string;
		preview: string;
		/** Empty string = no music; otherwise URL under `/music/…` from `static/music`. */
		song: string;
		/** Clip length on the slide / audio excerpt length (seconds). */
		seconds: number;
		/** Where playback starts inside the source track (seconds). */
		audioStartSec: number;
	};

	let loading = $state(true);
	let slides = $state<SlideRow[]>([]);
	let exportImagesBusy = $state(false);
	let loadError = $state('');

	let scrollEl = $state<HTMLDivElement | null>(null);
	let canScrollLeft = $state(false);
	let canScrollRight = $state(true);

	/** Cached `Audio.duration` per track URL (seconds). */
	let trackDurations = $state<Record<string, number>>({});
	let durationFetchPending = $state<Record<string, boolean>>({});
	let previewAudioEl = $state<HTMLAudioElement | null>(null);
	let burnToast = $state('');

	function checkScrollability() {
		const container = scrollEl;
		if (!container) return;
		const { scrollLeft, scrollWidth, clientWidth } = container;
		canScrollLeft = scrollLeft > 2;
		canScrollRight = scrollLeft < scrollWidth - clientWidth - 2;
	}

	function scrollStrip(dir: 'left' | 'right') {
		const container = scrollEl;
		if (!container) return;
		const dx = container.clientWidth * 0.8;
		container.scrollBy({ left: dir === 'left' ? -dx : dx, behavior: 'smooth' });
	}

	function maxStartFor(row: SlideRow): number {
		const dur = row.song ? (trackDurations[row.song] ?? 0) : 0;
		if (dur <= 0) return 0;
		return Math.max(0, dur - row.seconds);
	}

	function clampStart(i: number) {
		const row = slides[i];
		if (!row) return;
		const m = maxStartFor(row);
		const next = Math.min(Math.max(0, row.audioStartSec), m);
		if (next !== row.audioStartSec) {
			slides = slides.map((s, j) => (j === i ? { ...s, audioStartSec: next } : s));
		}
	}

	function setAudioStart(i: number, sec: number) {
		slides = slides.map((s, j) => (j === i ? { ...s, audioStartSec: sec } : s));
		clampStart(i);
	}

	function applyStartPreset(i: number, kind: 'start' | 'q1' | 'half' | 'q3' | 'end') {
		const row = slides[i];
		if (!row?.song) return;
		const dur = trackDurations[row.song] ?? 0;
		const m = maxStartFor(row);
		let ideal = 0;
		if (kind === 'start') ideal = 0;
		else if (kind === 'end') ideal = m;
		else if (kind === 'q1') ideal = dur * 0.25;
		else if (kind === 'half') ideal = dur * 0.5;
		else ideal = dur * 0.75;
		setAudioStart(i, Math.min(Math.max(0, ideal), m));
	}

	async function ensureDuration(url: string): Promise<void> {
		if (!url || trackDurations[url] != null || durationFetchPending[url]) return;
		durationFetchPending = { ...durationFetchPending, [url]: true };
		const a = new Audio();
		a.preload = 'metadata';
		a.src = url;
		await new Promise<void>((resolve) => {
			const done = (dur: number) => {
				trackDurations = { ...trackDurations, [url]: dur };
				durationFetchPending = { ...durationFetchPending, [url]: false };
				resolve();
			};
			a.addEventListener('loadedmetadata', () => done(Number.isFinite(a.duration) ? a.duration : 0));
			a.addEventListener('error', () => done(0));
		});
		for (let si = 0; si < slides.length; si++) {
			if (slides[si]?.song === url) clampStart(si);
		}
	}

	function stopPreview() {
		if (previewAudioEl) {
			previewAudioEl.pause();
			previewAudioEl.src = '';
			previewAudioEl = null;
		}
	}

	function previewClip(i: number) {
		const row = slides[i];
		if (!row?.song) return;
		stopPreview();
		const a = new Audio(row.song);
		previewAudioEl = a;
		const start = Math.max(0, row.audioStartSec);
		const end = start + row.seconds;
		const onTime = () => {
			if (a.currentTime >= end - 0.08) {
				a.pause();
				a.removeEventListener('timeupdate', onTime);
				stopPreview();
			}
		};
		a.addEventListener('loadedmetadata', () => {
			try {
				a.currentTime = Math.min(start, (a.duration || 0) - 0.01);
			} catch {
				a.currentTime = start;
			}
			a.addEventListener('timeupdate', onTime);
			void a.play().catch(() => {});
		});
		a.addEventListener('error', stopPreview);
	}

	function formatTime(sec: number): string {
		if (!Number.isFinite(sec)) return '0:00';
		const m = Math.floor(sec / 60);
		const s = Math.floor(sec % 60);
		return `${m}:${String(s).padStart(2, '0')}`;
	}

	function downloadBurnManifest() {
		const manifest = {
			version: 1,
			generatedAt: new Date().toISOString(),
			slides: slides.map((s, idx) => ({
				index: idx + 1,
				label: s.label,
				audioUrl: s.song || null,
				audioStartSec: s.song ? s.audioStartSec : null,
				clipDurationSec: s.seconds,
				hasImagePreview: !!s.preview,
			})),
		};
		const blob = new Blob([JSON.stringify(manifest, null, 2)], { type: 'application/json' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = 'burn-music-manifest.json';
		a.click();
		URL.revokeObjectURL(url);
		burnToast =
			'Manifest downloaded. Use these timings when you wire FFmpeg or your encoder; full video encode is still optional.';
		setTimeout(() => {
			burnToast = '';
		}, 6000);
	}

	onMount(() => {
		try {
			const raw = sessionStorage.getItem(STORAGE_KEY);
			if (!raw) {
				loadError = 'No slide data found. Open News Studio and use Burn Music again.';
				loading = false;
				return;
			}
			const parsed = JSON.parse(raw) as { labels?: string[]; previews?: string[] };
			const labels = Array.isArray(parsed.labels) ? parsed.labels : [];
			const previews = Array.isArray(parsed.previews) ? parsed.previews : [];
			const n = Math.max(labels.length, previews.length, 1);
			slides = Array.from({ length: n }, (_, i) => ({
				label: labels[i] ?? `Slide ${i + 1}`,
				preview: previews[i] ?? '',
				song: '',
				seconds: 5,
				audioStartSec: 0,
			}));
		} catch {
			loadError = 'Could not read slide data.';
		} finally {
			loading = false;
		}
	});

	$effect(() => {
		if (!scrollEl || slides.length === 0) return;
		checkScrollability();
		const el = scrollEl;
		const onScroll = () => checkScrollability();
		el.addEventListener('scroll', onScroll, { passive: true });
		const ro = new ResizeObserver(() => checkScrollability());
		ro.observe(el);
		return () => {
			el.removeEventListener('scroll', onScroll);
			ro.disconnect();
		};
	});

	function dataUrlToBlob(dataUrl: string): Blob | null {
		const m = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
		if (!m) return null;
		const binary = atob(m[2]);
		const bytes = new Uint8Array(binary.length);
		for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
		return new Blob([bytes], { type: m[1] || 'image/png' });
	}

	async function exportImageZip() {
		if (exportImagesBusy || slides.length === 0) return;
		exportImagesBusy = true;
		try {
			const zip = new JSZip();
			for (let i = 0; i < slides.length; i++) {
				const p = slides[i].preview;
				if (!p) continue;
				const blob = dataUrlToBlob(p);
				if (!blob) continue;
				zip.file(`slide-${String(i + 1).padStart(2, '0')}.png`, blob);
			}
			const out = await zip.generateAsync({ type: 'blob' });
			const url = URL.createObjectURL(out);
			const a = document.createElement('a');
			a.href = url;
			a.download = 'burn-music-slides.zip';
			a.click();
			URL.revokeObjectURL(url);
		} finally {
			exportImagesBusy = false;
		}
	}
</script>

<div class="burn-page min-h-full">
	<div class="mx-auto max-w-7xl px-4 py-6 sm:px-6 md:px-8">
		<div class="mb-6 flex flex-wrap items-center gap-3">
			<button
				type="button"
				class="btn btn-ghost-sm"
				onclick={() => void goto('/dashboard/studio?template=news')}
			>
				<ArrowLeft size={16} aria-hidden="true" />
				Back to Studio
			</button>
			<h1 class="font-display text-lg font-semibold tracking-tight md:text-xl">Burn music</h1>
			<span class="text-xs font-mono burn-muted">Per-slide audio · clip length · export</span>
		</div>

		{#if loading}
			<div class="flex items-center gap-2 text-sm burn-muted">
				<LoaderCircle size={18} class="animate-spin" aria-hidden="true" />
				Loading slides…
			</div>
		{:else if loadError}
			<p class="text-sm burn-warn">{loadError}</p>
		{:else}
			<p class="burn-muted mb-6 max-w-2xl text-sm">
				Pick a track from <code class="rounded bg-black/5 px-1 py-0.5 font-mono text-[11px] dark:bg-white/10"
					>static/music</code
				>, set where the clip starts in the song (slider or presets), then preview. Export images uses
				studio previews; <strong>Burn to video</strong> downloads a JSON manifest for your encoder (FFmpeg,
				etc.).
			</p>
			{#if burnToast}
				<p class="burn-toast mb-4 rounded-xl border px-4 py-3 text-sm">{burnToast}</p>
			{/if}

			<section class="burn-strip-section" aria-labelledby="burn-slides-heading">
				<div class="mb-4 flex items-center justify-between gap-3 px-1">
					<div>
						<h2 id="burn-slides-heading" class="text-xl font-semibold tracking-tight">
							Slide previews
						</h2>
						<p class="mt-0.5 text-sm burn-muted">Powering your carousel exports</p>
					</div>
					<div class="hidden items-center gap-2 sm:flex">
						<button
							type="button"
							class="burn-arrow"
							aria-label="Scroll left"
							disabled={!canScrollLeft}
							onclick={() => scrollStrip('left')}
						>
							<ChevronLeft class="h-5 w-5" aria-hidden="true" />
						</button>
						<button
							type="button"
							class="burn-arrow"
							aria-label="Scroll right"
							disabled={!canScrollRight}
							onclick={() => scrollStrip('right')}
						>
							<ChevronRight class="h-5 w-5" aria-hidden="true" />
						</button>
					</div>
				</div>

				<div
					bind:this={scrollEl}
					class="burn-scroll flex gap-4 overflow-x-auto scroll-smooth pb-2 pt-1 md:gap-6 [scrollbar-width:thin] snap-x snap-mandatory"
				>
					{#each slides as row, i (i)}
						<div class="burn-card-wrap flex w-max max-w-full flex-shrink-0 flex-col snap-start">
							<div class="burn-card group cursor-pointer">
								<div
									class="burn-card-frame relative mx-auto mb-3 w-fit max-w-full overflow-hidden rounded-lg border transition-all duration-300 ease-in-out group-hover:-translate-y-1 group-hover:shadow-lg"
								>
									{#if row.preview}
										<img
											src={row.preview}
											alt=""
											loading="lazy"
											decoding="async"
											class="burn-slide-img block"
											style="image-rendering: auto;"
										/>
									{:else}
										<div
											class="burn-placeholder flex min-h-[200px] w-[min(280px,calc(100vw-3rem))] items-center justify-center text-[10px] burn-muted"
										>
											No preview
										</div>
									{/if}
								</div>
							</div>

							<div
								class="burn-controls mt-3 space-y-3 rounded-lg border p-2.5 burn-control-border burn-control-bg"
							>
								<div class="space-y-1">
									<Label class="text-[9px] font-mono uppercase tracking-wider burn-muted">Song</Label>
									<select
										bind:value={slides[i].song}
										onchange={() => {
											const url = slides[i].song;
											slides = slides.map((s, j) =>
												j === i ? { ...s, song: url, audioStartSec: 0 } : s,
											);
											void ensureDuration(url);
										}}
										class="burn-select w-full rounded-lg border py-1.5 pl-2 pr-1 text-[11px]"
									>
										<option value="">No music</option>
										{#each data.tracks as t (t.url)}
											<option value={t.url}>{t.label}</option>
										{/each}
									</select>
								</div>

								{#if slides[i].song}
									{@const dur = trackDurations[slides[i].song] ?? 0}
									{@const pending = !!durationFetchPending[slides[i].song]}
									{@const maxSt = maxStartFor(slides[i])}
									<div class="burn-segment space-y-2 rounded-md border border-dashed burn-segment-border px-2 py-2">
										<div class="flex items-center justify-between gap-2">
											<Label class="text-[9px] font-mono uppercase tracking-wider burn-muted"
												>Clip starts in track</Label
											>
											{#if pending}
												<span class="text-[10px] burn-muted">Reading length…</span>
											{:else if dur > 0}
												<span class="text-[10px] font-mono burn-muted"
													>Track {formatTime(dur)} · clip ends at {formatTime(
														slides[i].audioStartSec + slides[i].seconds,
													)}</span
												>
											{/if}
										</div>
										{#if !pending && dur > 0}
											<input
												type="range"
												min="0"
												max={maxSt}
												step="0.1"
												value={slides[i].audioStartSec}
												oninput={(e) =>
													setAudioStart(i, parseFloat((e.currentTarget as HTMLInputElement).value))}
												class="burn-range w-full"
												aria-label="Start position in track"
											/>
											<div class="flex flex-wrap items-center gap-2">
												<input
													type="number"
													min="0"
													max={maxSt}
													step="0.1"
													value={slides[i].audioStartSec}
													oninput={(e) => {
														const v = parseFloat((e.currentTarget as HTMLInputElement).value);
														setAudioStart(i, Number.isFinite(v) ? v : 0);
													}}
													class="burn-num flex-1 min-w-[4rem] rounded-md border px-2 py-1 text-xs"
												/>
												<span class="text-[10px] burn-muted">sec</span>
											</div>
											<div class="flex flex-wrap gap-1.5">
												<button
													type="button"
													class="burn-chip"
													onclick={() => applyStartPreset(i, 'start')}>Start</button
												>
												<button
													type="button"
													class="burn-chip"
													onclick={() => applyStartPreset(i, 'q1')}>25%</button
												>
												<button
													type="button"
													class="burn-chip"
													onclick={() => applyStartPreset(i, 'half')}>Half</button
												>
												<button
													type="button"
													class="burn-chip"
													onclick={() => applyStartPreset(i, 'q3')}>75%</button
												>
												<button
													type="button"
													class="burn-chip"
													onclick={() => applyStartPreset(i, 'end')}>End</button
												>
											</div>
										{:else if !pending && slides[i].song}
											<p class="text-[11px] burn-muted">Could not read this file’s duration.</p>
										{/if}
									</div>
								{/if}

								<div class="space-y-1">
									<Label class="text-[9px] font-mono uppercase tracking-wider burn-muted"
										>Clip length (seconds)</Label
									>
									<Input
										type="number"
										min="1"
										max="120"
										step="1"
										value={slides[i].seconds}
										oninput={(e) => {
											const v = parseInt((e.currentTarget as HTMLInputElement).value, 10);
											slides = slides.map((s, j) =>
												j === i
													? {
															...s,
															seconds: Number.isFinite(v) ? Math.max(1, Math.min(120, v)) : s.seconds,
														}
													: s,
											);
											clampStart(i);
										}}
										class="h-8 text-xs"
									/>
								</div>
								<div class="flex flex-col gap-2 sm:flex-row">
									<button
										type="button"
										class="btn btn-outline btn-block sm:flex-1"
										disabled={!slides[i].song}
										onclick={() => previewClip(i)}
									>
										<Play size={14} aria-hidden="true" />
										Preview clip
									</button>
									<button
										type="button"
										class="btn btn-dark btn-block sm:flex-1"
										disabled={slides.filter((s) => s.song).length === 0}
										onclick={() => downloadBurnManifest()}
									>
										<Music size={14} aria-hidden="true" />
										Burn to video
									</button>
								</div>
							</div>
						</div>
					{/each}
				</div>
			</section>

			<div
				class="mt-8 flex flex-col gap-3 border-t pt-6 burn-divider sm:flex-row sm:items-center sm:justify-between"
			>
				<div class="text-xs burn-muted">
					Export uses slide previews from your last visit to Burn music.
				</div>
				<div class="flex flex-wrap gap-2">
					<button
						type="button"
						class="btn btn-dark gap-2"
						disabled={exportImagesBusy || slides.length === 0}
						onclick={() => void exportImageZip()}
					>
						{#if exportImagesBusy}
							<LoaderCircle size={16} class="animate-spin" aria-hidden="true" />
							Building ZIP…
						{:else}
							<Download size={16} aria-hidden="true" />
							Export images (ZIP)
						{/if}
					</button>
				</div>
			</div>
		{/if}
	</div>
</div>

<style>
	/* Theme-aware shell (follows dashboard data-theme) */
	.burn-page {
		background: var(--app-bg);
		color: var(--app-text);
		--ap-accent: #0f0f10;
	}

	.burn-muted {
		color: var(--app-text-2);
	}

	.burn-warn {
		color: var(--color-orange, #ff6b35);
	}

	:global([data-theme='dark']) .burn-warn {
		color: #fcd34d;
	}

	.burn-divider {
		border-color: var(--app-border, rgba(255, 255, 255, 0.08));
	}

	.burn-scroll {
		scrollbar-color: color-mix(in oklab, var(--app-text) 15%, transparent) transparent;
	}

	.burn-card-frame {
		background: var(--app-surface-2);
		border-color: var(--app-border, rgba(0, 0, 0, 0.08));
	}

	/* Intrinsic-width images: avoid squashing previews into a % width (was causing blur) */
	.burn-slide-img {
		max-height: min(85vh, 960px);
		width: auto;
		height: auto;
		max-width: min(320px, calc(100vw - 3rem));
		vertical-align: top;
	}

	.burn-placeholder {
		background: color-mix(in oklab, var(--app-text) 5%, transparent);
	}

	.burn-arrow {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: 0.5rem;
		border-radius: 999px;
		border: 1px solid var(--app-border, rgba(0, 0, 0, 0.1));
		background: var(--app-surface-2);
		color: var(--app-text);
		transition: opacity 0.2s ease, background 0.2s ease;
		cursor: pointer;
	}

	.burn-arrow:hover:not(:disabled) {
		background: var(--app-surface-3);
	}

	.burn-arrow:disabled {
		opacity: 0.35;
		cursor: not-allowed;
	}

	.burn-control-border {
		border-color: var(--app-border, rgba(0, 0, 0, 0.1));
	}

	.burn-control-bg {
		background: color-mix(in oklab, var(--app-text) 3%, transparent);
	}

	.burn-select {
		border-color: var(--app-border, rgba(0, 0, 0, 0.12));
		background: var(--app-bg);
		color: var(--app-text);
		color-scheme: light dark;
	}

	.burn-controls :global(input[type='number']) {
		border-color: var(--app-border, rgba(0, 0, 0, 0.12));
		background: var(--app-bg);
		color: var(--app-text);
	}

	/* Landing-style buttons (matches marketing `.btn` / `.btn-dark`) */
	.btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		padding: 11px 22px;
		border-radius: 999px;
		font-family: inherit;
		font-weight: 600;
		font-size: 14px;
		text-decoration: none;
		border: 1px solid transparent;
		transition:
			transform 0.25s ease,
			background 0.25s ease,
			border-color 0.25s ease,
			color 0.25s ease,
			box-shadow 0.25s ease;
		cursor: pointer;
		white-space: nowrap;
	}

	.btn:disabled {
		opacity: 0.45;
		cursor: not-allowed;
		transform: none;
	}

	.btn-dark {
		color: #fff;
		background: var(--ap-accent);
		border-color: var(--ap-accent);
	}

	.btn-dark:hover:not(:disabled) {
		background: #2a2a2a;
		border-color: #2a2a2a;
		transform: translateY(-1px);
		box-shadow: 0 8px 24px rgba(15, 15, 16, 0.18);
	}

	.btn-block {
		width: 100%;
	}

	.btn-ghost-sm {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 8px 14px;
		border-radius: 999px;
		font-size: 13px;
		font-weight: 600;
		border: 1px solid var(--app-border, rgba(0, 0, 0, 0.12));
		background: transparent;
		color: var(--app-text);
		cursor: pointer;
		transition: background 0.2s ease;
	}

	.btn-ghost-sm:hover {
		background: color-mix(in oklab, var(--app-text) 6%, transparent);
	}

	.btn-outline {
		color: var(--app-text);
		background: transparent;
		border-color: var(--app-border, rgba(0, 0, 0, 0.15));
	}

	.btn-outline:hover:not(:disabled) {
		background: color-mix(in oklab, var(--app-text) 7%, transparent);
		border-color: color-mix(in oklab, var(--app-text) 22%, var(--app-border));
	}

	.burn-toast {
		border-color: var(--app-border, rgba(0, 0, 0, 0.1));
		background: color-mix(in oklab, var(--app-text) 4%, transparent);
		color: var(--app-text);
	}

	.burn-segment-border {
		border-color: color-mix(in oklab, var(--app-text) 14%, transparent);
	}

	.burn-range {
		accent-color: var(--ap-accent);
		height: 1.25rem;
	}

	.burn-num {
		border: 1px solid var(--app-border, rgba(0, 0, 0, 0.12));
		background: var(--app-bg);
		color: var(--app-text);
	}

	.burn-chip {
		padding: 0.25rem 0.55rem;
		border-radius: 999px;
		font-size: 10px;
		font-weight: 600;
		border: 1px solid var(--app-border, rgba(0, 0, 0, 0.12));
		background: var(--app-bg);
		color: var(--app-text);
		cursor: pointer;
		transition: background 0.15s ease, border-color 0.15s ease;
	}

	.burn-chip:hover {
		background: color-mix(in oklab, var(--app-text) 8%, transparent);
	}
</style>
