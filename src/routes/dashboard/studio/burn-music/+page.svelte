<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import JSZip from 'jszip';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import BurnSegmentRange from '$lib/components/BurnSegmentRange.svelte';
	import ClassicLoader from '$lib/components/ClassicLoader.svelte';
	import {
		ArrowLeft,
		ChevronLeft,
		ChevronRight,
		Download,
		Music,
		Play,
	} from 'lucide-svelte';
	import type { PageProps } from './$types';

	const STORAGE_KEY = 'burn-music-v1';

	const MIN_SEG = 1;
	const MAX_SEG = 120;

	let { data }: PageProps = $props();

	type SlideRow = {
		label: string;
		preview: string;
		/** Empty string = no music; otherwise URL under `/music/…` from `static/music`. */
		song: string;
		/** Segment start in source (seconds). */
		audioStartSec: number;
		/** Segment end in source (seconds, exclusive): plays [audioStartSec, audioEndSec). */
		audioEndSec: number;
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

	function segmentLen(row: SlideRow): number {
		return Math.max(0, row.audioEndSec - row.audioStartSec);
	}

	function clampSegment(i: number) {
		const row = slides[i];
		if (!row) return;
		const dur = row.song ? (trackDurations[row.song] ?? 0) : 0;
		let s = Number(row.audioStartSec) || 0;
		let e = Number(row.audioEndSec);
		if (!Number.isFinite(e)) e = s + MIN_SEG;
		if (e <= s) e = s + MIN_SEG;

		let minLen = dur > 0 ? Math.min(MIN_SEG, dur) : MIN_SEG;
		let maxLen = dur > 0 ? Math.min(MAX_SEG, dur) : MAX_SEG;
		if (maxLen < minLen) minLen = maxLen;

		let len = Math.min(maxLen, Math.max(minLen, e - s));

		if (dur > 0) {
			s = Math.max(0, Math.min(s, dur - len));
			e = s + len;
			if (e > dur + 1e-6) {
				e = dur;
				s = Math.max(0, e - len);
				len = e - s;
				if (len < minLen && dur >= minLen) {
					len = minLen;
					s = Math.max(0, dur - len);
					e = s + len;
				}
			}
		} else {
			s = Math.max(0, s);
			e = s + len;
		}

		s = Math.round(s * 10) / 10;
		e = Math.round(e * 10) / 10;

		if (Math.abs(s - row.audioStartSec) > 1e-6 || Math.abs(e - row.audioEndSec) > 1e-6) {
			slides = slides.map((sl, j) => (j === i ? { ...sl, audioStartSec: s, audioEndSec: e } : sl));
		}
	}

	function setSegmentRange(i: number, start: number, end: number) {
		slides = slides.map((sl, j) => (j === i ? { ...sl, audioStartSec: start, audioEndSec: end } : sl));
		clampSegment(i);
	}

	function maxStartForRow(row: SlideRow): number {
		const dur = row.song ? (trackDurations[row.song] ?? 0) : 0;
		if (dur <= 0) return 0;
		const len = Math.max(MIN_SEG, row.audioEndSec - row.audioStartSec);
		return Math.max(0, dur - len);
	}

	function minEndForRow(row: SlideRow): number {
		return row.audioStartSec + MIN_SEG;
	}

	function maxEndForRow(row: SlideRow): number {
		const dur = row.song ? (trackDurations[row.song] ?? 0) : 0;
		if (dur <= 0) return row.audioStartSec + MAX_SEG;
		return Math.min(dur, row.audioStartSec + MAX_SEG);
	}

	/** Move segment start; keeps clip length, then clamps into the file. */
	function setAudioStart(i: number, sec: number) {
		const row = slides[i];
		if (!row) return;
		const len = Math.max(MIN_SEG, row.audioEndSec - row.audioStartSec);
		const s = sec;
		slides = slides.map((sl, j) => (j === i ? { ...sl, audioStartSec: s, audioEndSec: s + len } : sl));
		clampSegment(i);
	}

	/** Move segment end (exclusive); changes clip length. */
	function setAudioEnd(i: number, sec: number) {
		slides = slides.map((sl, j) => (j === i ? { ...sl, audioEndSec: sec } : sl));
		clampSegment(i);
	}

	function setSegmentDuration(i: number, len: number) {
		const row = slides[i];
		if (!row) return;
		const dur = row.song ? (trackDurations[row.song] ?? 0) : 0;
		const minLen = dur > 0 ? Math.min(MIN_SEG, dur) : MIN_SEG;
		const maxLen = dur > 0 ? Math.min(MAX_SEG, dur) : MAX_SEG;
		const L = Math.min(maxLen, Math.max(minLen, len));
		const s = row.audioStartSec;
		slides = slides.map((sl, j) => (j === i ? { ...sl, audioEndSec: s + L } : sl));
		clampSegment(i);
	}

	function applyStartPreset(i: number, kind: 'start' | 'q1' | 'half' | 'q3' | 'end') {
		const row = slides[i];
		if (!row?.song) return;
		const dur = trackDurations[row.song] ?? 0;
		if (dur <= 0) return;
		const minLen = Math.min(MIN_SEG, dur);
		const maxLen = Math.min(MAX_SEG, dur);
		let len = Math.min(maxLen, Math.max(minLen, row.audioEndSec - row.audioStartSec));
		let anchor = 0;
		if (kind === 'start') anchor = 0;
		else if (kind === 'end') anchor = dur - len;
		else if (kind === 'q1') anchor = dur * 0.25 - len / 2;
		else if (kind === 'half') anchor = dur * 0.5 - len / 2;
		else anchor = dur * 0.75 - len / 2;
		const s = Math.max(0, Math.min(anchor, dur - len));
		slides = slides.map((sl, j) => (j === i ? { ...sl, audioStartSec: s, audioEndSec: s + len } : sl));
		clampSegment(i);
	}

	function applySegmentMidSlice(i: number) {
		const row = slides[i];
		if (!row?.song) return;
		const dur = trackDurations[row.song] ?? 0;
		if (dur <= 0) return;
		const len = Math.min(MAX_SEG, Math.max(MIN_SEG, dur / 3));
		const s = Math.max(0, (dur - len) / 2);
		slides = slides.map((sl, j) => (j === i ? { ...sl, audioStartSec: s, audioEndSec: s + len } : sl));
		clampSegment(i);
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
			if (slides[si]?.song === url) clampSegment(si);
		}
	}

	/** Full usable track [0, min(duration, MAX_SEG)] for a fresh pick. */
	function defaultSegmentEndForDuration(dur: number): number {
		if (!(dur > 0)) return MIN_SEG;
		return Math.max(MIN_SEG, Math.min(dur, MAX_SEG));
	}

	function applyFullTrackSegmentForSlide(i: number, url: string) {
		const d = trackDurations[url] ?? 0;
		if (!url || d <= 0) {
			clampSegment(i);
			return;
		}
		const end = defaultSegmentEndForDuration(d);
		slides = slides.map((s, j) =>
			j === i ? { ...s, audioStartSec: 0, audioEndSec: end } : s,
		);
		clampSegment(i);
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
		const end = row.audioEndSec;
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
				audioEndSec: s.song ? s.audioEndSec : null,
				clipDurationSec: s.song ? s.audioEndSec - s.audioStartSec : null,
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
				audioStartSec: 0,
				audioEndSec: 5,
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
			<div class="flex items-center gap-3 text-sm burn-muted">
				<ClassicLoader size="md" />
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
						{@const dur = row.song ? (trackDurations[row.song] ?? 0) : 0}
						{@const pending = row.song ? !!durationFetchPending[row.song] : false}
						{@const maxSt = row.song ? maxStartForRow(row) : 0}
						{@const minE = row.song ? minEndForRow(row) : MIN_SEG}
						{@const maxE = row.song ? maxEndForRow(row) : MAX_SEG}
						{@const len = segmentLen(row)}
						<div class="burn-card-wrap flex flex-shrink-0 flex-col snap-start">
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
								class="burn-controls mt-3 w-full space-y-3 rounded-lg border p-2.5 burn-control-border burn-control-bg"
							>
								<div class="space-y-1">
									<Label class="text-[9px] font-mono uppercase tracking-wider burn-muted">Song</Label>
									<select
										bind:value={slides[i].song}
										onchange={() => {
											const url = slides[i].song;
											if (!url) {
												slides = slides.map((s, j) =>
													j === i ? { ...s, song: '', audioStartSec: 0, audioEndSec: 5 } : s,
												);
												return;
											}
											slides = slides.map((s, j) =>
												j === i ? { ...s, song: url, audioStartSec: 0, audioEndSec: MIN_SEG } : s,
											);
											void (async () => {
												await ensureDuration(url);
												applyFullTrackSegmentForSlide(i, url);
											})();
										}}
										class="burn-select w-full rounded-lg border py-1.5 pl-2 pr-1 text-[11px]"
									>
										<option value="">No music</option>
										{#each data.tracks as t (t.url)}
											<option value={t.url}>{t.label}</option>
										{/each}
									</select>
								</div>

								<div
									class="burn-segment burn-seg-range-host space-y-2 rounded-md border border-dashed burn-segment-border px-2 py-2"
								>
									<div class="flex flex-col gap-0.5">
										<Label class="text-[9px] font-mono uppercase tracking-wider burn-muted"
											>Segment in track</Label
										>
										{#if !row.song}
											<span class="text-[10px] burn-muted">Select a track — segment trims the part you burn.</span
											>
										{:else if pending}
											<span class="text-[10px] burn-muted">Reading length…</span>
										{:else if dur > 0}
											<span class="text-[10px] font-mono burn-muted"
												>Track {formatTime(dur)} · {row.audioStartSec.toFixed(1)}s → {row.audioEndSec.toFixed(
													1,
												)}s ({len.toFixed(1)}s)</span
											>
										{:else}
											<span class="text-[10px] burn-muted">Could not read this file’s duration.</span>
										{/if}
									</div>
									{#if row.song && !pending && dur > 0}
										<p class="text-[10px] burn-muted leading-snug">
											Drag the <strong class="text-foreground/80">two handles</strong> on one bar, or tap the
											bar to jump the nearest handle. Use the number fields for exact times.
										</p>
										<BurnSegmentRange
											durationSec={dur}
											startSec={row.audioStartSec}
											endSec={row.audioEndSec}
											minSeg={MIN_SEG}
											maxSeg={MAX_SEG}
											onChange={(s, e) => setSegmentRange(i, s, e)}
										/>
										<div class="burn-seg-inputs grid min-w-0 grid-cols-2 gap-2">
											<div class="min-w-0 space-y-0.5">
												<span class="text-[9px] font-mono uppercase tracking-wider burn-muted"
													>Start (sec)</span
												>
												<input
													type="number"
													min="0"
													max={maxSt}
													step="0.1"
													value={row.audioStartSec}
													oninput={(e) => {
														const v = parseFloat((e.currentTarget as HTMLInputElement).value);
														setAudioStart(i, Number.isFinite(v) ? v : 0);
													}}
													class="burn-num box-border w-full min-w-0 max-w-full rounded-md border px-2 py-1 text-xs"
												/>
											</div>
											<div class="min-w-0 space-y-0.5">
												<span class="text-[9px] font-mono uppercase tracking-wider burn-muted"
													>End (sec)</span
												>
												<input
													type="number"
													min={minE}
													max={maxE}
													step="0.1"
													value={row.audioEndSec}
													oninput={(e) => {
														const v = parseFloat((e.currentTarget as HTMLInputElement).value);
														setAudioEnd(i, Number.isFinite(v) ? v : minE);
													}}
													class="burn-num box-border w-full min-w-0 max-w-full rounded-md border px-2 py-1 text-xs"
												/>
											</div>
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
											<button type="button" class="burn-chip" onclick={() => applySegmentMidSlice(i)}
												>Mid slice</button
											>
										</div>
									{:else if row.song}
										<div class="burn-seg-range-host min-h-[2.25rem]"></div>
									{/if}
								</div>

								<div class="space-y-1">
									<Label class="text-[9px] font-mono uppercase tracking-wider burn-muted"
										>Clip length (seconds)</Label
									>
									<Input
										type="number"
										min="1"
										max="120"
										step="0.1"
										value={segmentLen(row)}
										oninput={(e) => {
											const v = parseFloat((e.currentTarget as HTMLInputElement).value);
											setSegmentDuration(i, Number.isFinite(v) ? v : MIN_SEG);
										}}
										class="h-8 text-xs"
									/>
								</div>
								<div class="flex flex-col gap-2 sm:flex-row">
									<button
										type="button"
										class="btn btn-outline btn-block sm:flex-1"
										disabled={!row.song}
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
							<ClassicLoader size="sm" />
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

	/* Same column width with or without a track — matches preview max width */
	.burn-card-wrap {
		width: min(320px, calc(100vw - 3rem));
	}

	.burn-seg-inputs {
		grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
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

	.burn-seg-range-host {
		--burn-seg-accent: var(--ap-accent);
		--burn-seg-muted: var(--app-text);
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
