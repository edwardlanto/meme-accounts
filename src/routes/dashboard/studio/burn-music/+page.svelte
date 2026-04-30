<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import JSZip from 'jszip';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { ArrowLeft, Download, LoaderCircle, Music } from 'lucide-svelte';

	const STORAGE_KEY = 'burn-music-v1';

	const SONG_OPTIONS = [
		'No music',
		'Lo-fi Chill',
		'Upbeat Corporate',
		'Cinematic Rise',
		'Acoustic Mood',
		'Electronic Pulse',
		'Inspirational Piano',
	] as const;

	type SlideRow = { label: string; preview: string; song: string; seconds: number };

	let loading = $state(true);
	let slides = $state<SlideRow[]>([]);
	let exportImagesBusy = $state(false);
	let loadError = $state('');

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
				song: 'No music',
				seconds: 5,
			}));
		} catch {
			loadError = 'Could not read slide data.';
		} finally {
			loading = false;
		}
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

<div class="min-h-screen bg-neutral-950 text-neutral-100">
	<div class="mx-auto max-w-6xl px-4 py-6 md:px-8">
		<div class="mb-6 flex flex-wrap items-center gap-3">
			<Button
				variant="outline"
				size="sm"
				class="border-neutral-700 bg-neutral-900 text-neutral-200 hover:bg-neutral-800"
				onclick={() => void goto('/dashboard/studio?template=news')}
			>
				<ArrowLeft size={16} class="mr-1.5" />
				Back to Studio
			</Button>
			<h1 class="font-display text-lg font-semibold tracking-tight text-white md:text-xl">
				Burn music
			</h1>
			<span class="text-xs font-mono text-neutral-500">Per-slide audio · clip length · export</span>
		</div>

		{#if loading}
			<div class="flex items-center gap-2 text-sm text-neutral-400">
				<LoaderCircle size={18} class="animate-spin" />
				Loading slides…
			</div>
		{:else if loadError}
			<p class="text-sm text-amber-200/90">{loadError}</p>
		{:else}
			<p class="mb-4 max-w-2xl text-sm text-neutral-400">
				Choose a track and how long each clip should be (default 5s). Image export uses the previews
				captured when you left the studio. Video burn-in is not wired to an encoder yet — use Export
				images for now.
			</p>

			<div
				class="flex justify-between gap-3 overflow-x-auto pb-4 pt-1 [scrollbar-width:thin]"
				style="scrollbar-color: rgba(255,255,255,0.12) transparent"
			>
				{#each slides as row, i (i)}
					<div
						class="group relative w-[33%] flex-shrink-0 overflow-hidden rounded-xl border border-neutral-800 bg-neutral-900/80 shadow-lg transition-transform duration-200 hover:scale-[1.02] hover:shadow-xl"
					>
						<div class="relative aspect-[9/16] w-full bg-black">
							{#if row.preview}
								<img src={row.preview} alt="" class="absolute inset-0 h-full w-full object-cover" />
							{:else}
								<div class="flex h-full items-center justify-center text-[10px] text-neutral-600">
									No preview
								</div>
							{/if}
							<div
								class="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/70 to-transparent"
							></div>
							<span
								class="absolute bottom-2 left-2 rounded-md bg-black/50 px-1.5 py-0.5 font-mono text-[10px] text-white/90"
							>
								{row.label}
							</span>
						</div>
						<div class="space-y-2 border-t border-neutral-800 p-2.5">
							<div class="space-y-1">
								<Label class="text-[9px] font-mono uppercase tracking-wider text-neutral-500">Song</Label>
								<select
									value={row.song}
									onchange={(e) => {
										const v = (e.currentTarget as HTMLSelectElement).value;
										slides = slides.map((s, j) => (j === i ? { ...s, song: v } : s));
									}}
									class="w-full rounded-lg border border-neutral-700 bg-neutral-950 py-1.5 pl-2 pr-1 text-[11px] text-neutral-200 [color-scheme:dark]"
								>
									{#each SONG_OPTIONS as opt}
										<option value={opt}>{opt}</option>
									{/each}
								</select>
							</div>
							<div class="space-y-1">
								<Label class="text-[9px] font-mono uppercase tracking-wider text-neutral-500"
									>Length (seconds)</Label
								>
								<Input
									type="number"
									min="1"
									max="120"
									step="1"
									value={row.seconds}
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
									}}
									class="h-8 border-neutral-700 bg-neutral-950 text-xs text-neutral-200"
								/>
							</div>
							<Button
								variant="secondary"
								size="sm"
								class="h-8 w-full gap-1 text-[11px]"
								disabled
								title="Video encoding is not connected yet"
							>
								<Music size={14} />
								Burn to video
							</Button>
						</div>
					</div>
				{/each}
			</div>

			<div
				class="mt-8 flex flex-col gap-3 border-t border-neutral-800 pt-6 sm:flex-row sm:items-center sm:justify-between"
			>
				<div class="text-xs text-neutral-500">
					Export uses slide previews from your last visit to Burn music.
				</div>
				<div class="flex flex-wrap gap-2">
					<Button
						variant="default"
						class="gap-2 bg-violet-600 text-white hover:bg-violet-500"
						disabled={exportImagesBusy || slides.length === 0}
						onclick={() => void exportImageZip()}
					>
						{#if exportImagesBusy}
							<LoaderCircle size={16} class="animate-spin" />
							Building ZIP…
						{:else}
							<Download size={16} />
							Export images (ZIP)
						{/if}
					</Button>
				</div>
			</div>
		{/if}
	</div>
</div>
