<script lang="ts">
	import { Music, Calendar, X, Send, LoaderCircle, Download } from 'lucide-svelte';
	import { goto } from '$app/navigation';

	interface $$Props {
		slideLabels?: string[];
		rightOffsetPx?: number;
		bottomOffsetPx?: number;
		zIndex?: number;
		postUrl?: string;
		onPost?: () => void | Promise<void>;
		posting?: boolean;
		/** Zip export all slides (same as Studio left-panel export). */
		onExportZip?: () => void | Promise<void>;
		exportingZip?: boolean;
		/** When set, "Burn Music" opens this flow instead of the inline panel. */
		onBurnMusicClick?: () => void | Promise<void>;
	}

	let {
		slideLabels = [],
		rightOffsetPx = 24,
		bottomOffsetPx = 24,
		zIndex = 50,
		postUrl = '/dashboard/post-scheduler',
		onPost = undefined,
		posting = false,
		onExportZip = undefined,
		exportingZip = false,
		onBurnMusicClick = undefined,
	} = ($props() as $$Props);

	interface SlideMusicSettings { song: string; seconds: number; }

	let showMusicPanel = $state(false);
	let showPostPanel = $state(false);
	let selectedPlatforms = $state<string[]>([]);
	let scheduleDate = $state('');
	let scheduleTime = $state('');
	let slideMusic = $state<SlideMusicSettings[]>([]);

	const SONG_OPTIONS = [
		'No music', 'Lo-fi Chill', 'Upbeat Corporate',
		'Cinematic Rise', 'Acoustic Mood', 'Electronic Pulse', 'Inspirational Piano',
	];

	const slideCount = $derived(slideLabels.length);
	const hasSlides = $derived(slideCount > 0);

	// Keep slideMusic aligned with slide count
	$effect(() => {
		if (!hasSlides) {
			slideMusic = [];
			return;
		}
		if (slideMusic.length !== slideCount) {
			const next = Array.from({ length: slideCount }, (_, i) => slideMusic[i] ?? { song: 'No music', seconds: 15 });
			slideMusic = next;
		}
	});

	function togglePlatform(p: string) {
		selectedPlatforms = selectedPlatforms.includes(p)
			? selectedPlatforms.filter((x) => x !== p)
			: [...selectedPlatforms, p];
	}

	async function handlePostClick() {
		if (posting) return;
		if (onPost) {
			await onPost();
			return;
		}
		await goto(postUrl);
	}
</script>

{#if hasSlides}
	<div
		class="fixed flex flex-row items-end gap-2"
		style="right:{rightOffsetPx}px;bottom:{bottomOffsetPx}px;z-index:{zIndex};"
	>
		<!-- POST button + panel -->
		<div class="relative">
			{#if showPostPanel}
				<div class="absolute bottom-full mb-2 right-0 w-[340px] rounded-2xl shadow-2xl overflow-hidden"
					style="background: var(--app-surface-2); border: 1px solid var(--app-border);"
				>
					<div class="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
						<div class="flex items-center gap-2">
							<Calendar size={13} class="text-cyan-400" />
							<span class="text-xs font-mono font-semibold text-white/80 uppercase tracking-wider">Schedule Post</span>
						</div>
						<button
							onclick={() => (showPostPanel = false)}
							class="w-6 h-6 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] flex items-center justify-center text-white/40 hover:text-white/80 transition-all"
							aria-label="Close post panel"
						>
							<X size={11} />
						</button>
					</div>

					<div class="p-4 flex flex-col gap-4">
						<div>
							<p class="text-[9px] font-mono text-white/30 uppercase tracking-widest mb-2.5">Platforms</p>
							<div class="grid grid-cols-3 gap-2">
								<button
									onclick={() => togglePlatform('instagram')}
									class="flex flex-col items-center gap-1.5 py-3 rounded-xl border-2 transition-all
										{selectedPlatforms.includes('instagram')
											? 'border-pink-500/60 bg-pink-500/10'
											: 'border-white/[0.07] bg-white/[0.02] hover:border-white/20'}"
								>
									<svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
										<rect x="2" y="2" width="20" height="20" rx="5" stroke="{selectedPlatforms.includes('instagram') ? '#ec4899' : 'rgba(255,255,255,0.4)'}" stroke-width="1.8" />
										<circle cx="12" cy="12" r="4.5" stroke="{selectedPlatforms.includes('instagram') ? '#ec4899' : 'rgba(255,255,255,0.4)'}" stroke-width="1.8" />
										<circle cx="17.5" cy="6.5" r="1" fill="{selectedPlatforms.includes('instagram') ? '#ec4899' : 'rgba(255,255,255,0.4)'}" />
									</svg>
									<span class="text-[9px] font-mono {selectedPlatforms.includes('instagram') ? 'text-pink-400' : 'text-white/30'}">Instagram</span>
								</button>

								<button
									onclick={() => togglePlatform('linkedin')}
									class="flex flex-col items-center gap-1.5 py-3 rounded-xl border-2 transition-all
										{selectedPlatforms.includes('linkedin')
											? 'border-blue-500/60 bg-blue-500/10'
											: 'border-white/[0.07] bg-white/[0.02] hover:border-white/20'}"
								>
									<svg width="20" height="20" viewBox="0 0 24 24" fill="{selectedPlatforms.includes('linkedin') ? '#3b82f6' : 'rgba(255,255,255,0.4)'}" xmlns="http://www.w3.org/2000/svg">
										<path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
										<rect x="2" y="9" width="4" height="12" />
										<circle cx="4" cy="4" r="2" />
									</svg>
									<span class="text-[9px] font-mono {selectedPlatforms.includes('linkedin') ? 'text-blue-400' : 'text-white/30'}">LinkedIn</span>
								</button>

								<button
									onclick={() => togglePlatform('pinterest')}
									class="flex flex-col items-center gap-1.5 py-3 rounded-xl border-2 transition-all
										{selectedPlatforms.includes('pinterest')
											? 'border-red-500/60 bg-red-500/10'
											: 'border-white/[0.07] bg-white/[0.02] hover:border-white/20'}"
								>
									<svg width="20" height="20" viewBox="0 0 24 24" fill="{selectedPlatforms.includes('pinterest') ? '#ef4444' : 'rgba(255,255,255,0.4)'}" xmlns="http://www.w3.org/2000/svg">
										<path d="M12 0C5.373 0 0 5.373 0 12c0 5.084 3.163 9.426 7.627 11.174-.105-.949-.2-2.405.042-3.441.218-.937 1.407-5.965 1.407-5.965s-.359-.719-.359-1.782c0-1.668.967-2.914 2.171-2.914 1.023 0 1.518.769 1.518 1.69 0 1.029-.655 2.568-.994 3.995-.283 1.194.599 2.169 1.777 2.169 2.133 0 3.772-2.249 3.772-5.495 0-2.873-2.064-4.882-5.012-4.882-3.414 0-5.418 2.561-5.418 5.207 0 1.031.397 2.138.893 2.738a.36.36 0 0 1 .083.345l-.333 1.36c-.053.22-.174.267-.402.161-1.499-.698-2.436-2.889-2.436-4.649 0-3.785 2.75-7.262 7.929-7.262 4.163 0 7.398 2.967 7.398 6.931 0 4.136-2.607 7.464-6.227 7.464-1.216 0-2.359-.632-2.75-1.378l-.748 2.853c-.271 1.043-1.002 2.35-1.492 3.146C9.57 23.812 10.763 24 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0z" />
									</svg>
									<span class="text-[9px] font-mono {selectedPlatforms.includes('pinterest') ? 'text-red-400' : 'text-white/30'}">Pinterest</span>
								</button>
							</div>
						</div>

						<div class="grid grid-cols-2 gap-2">
							<div>
								<p class="text-[9px] font-mono text-white/30 uppercase tracking-widest mb-1.5">Date</p>
								<input
									type="date"
									bind:value={scheduleDate}
									class="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl py-2 px-3 text-xs font-mono text-white/60 focus:outline-none focus:border-cyan-500/40 transition-colors [color-scheme:dark]"
								/>
							</div>
							<div>
								<p class="text-[9px] font-mono text-white/30 uppercase tracking-widest mb-1.5">Time</p>
								<input
									type="time"
									bind:value={scheduleTime}
									class="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl py-2 px-3 text-xs font-mono text-white/60 focus:outline-none focus:border-cyan-500/40 transition-colors [color-scheme:dark]"
								/>
							</div>
						</div>

						<button
							disabled
							class="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold font-body text-white/40 bg-white/[0.05] border border-white/[0.08] cursor-not-allowed transition-all"
						>
							<Send size={13} class="opacity-40" />
							Schedule Post
							<span class="ml-auto text-[9px] font-mono text-white/20 bg-white/[0.05] px-2 py-0.5 rounded-md">Soon</span>
						</button>
					</div>
				</div>
			{/if}

			<button
				onclick={handlePostClick}
				disabled={posting}
				class="flex items-center gap-2 pl-3 pr-4 py-2.5 rounded-2xl text-xs font-semibold font-body shadow-lg transition-all border"
				style="
					background: {showPostPanel ? 'rgb(6 182 212)' : 'color-mix(in oklab, var(--app-text) 6%, transparent)'};
					border-color: {showPostPanel ? 'rgba(6,182,212,0.35)' : 'var(--app-border)'};
					color: {showPostPanel ? '#fff' : 'var(--app-text-2)'};
					{posting ? 'opacity: 0.75; cursor: progress;' : 'cursor: pointer;'}
				"
			>
				<Calendar size={14} />
				{#if posting}
					<span class="inline-flex items-center gap-2">
						Exporting…
						<LoaderCircle size={14} class="animate-spin" />
					</span>
				{:else}
					Post
				{/if}
			</button>
		</div>

		<!-- BURN MUSIC button + panel (inline panel only when no navigate handler) -->
		<div class="relative">
			{#if showMusicPanel && !onBurnMusicClick}
				<div class="absolute bottom-full mb-2 right-0 w-[400px] rounded-2xl shadow-2xl overflow-hidden"
					style="background: var(--app-surface-2); border: 1px solid var(--app-border);"
				>
					<div class="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
						<div class="flex items-center gap-2">
							<Music size={13} class="text-violet-400" />
							<span class="text-xs font-mono font-semibold text-white/80 uppercase tracking-wider">Burn Music</span>
						</div>
						<button
							onclick={() => (showMusicPanel = false)}
							class="w-6 h-6 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] flex items-center justify-center text-white/40 hover:text-white/80 transition-all"
							aria-label="Close burn music panel"
						>
							<X size={11} />
						</button>
					</div>

					<div class="max-h-[320px] overflow-y-auto" style="scrollbar-width:thin;scrollbar-color:rgba(255,255,255,0.08) transparent;">
						{#each slideLabels as label, i}
							{@const music = slideMusic[i] ?? { song: 'No music', seconds: 15 }}
							<div class="flex items-center gap-3 px-4 py-2.5 border-b border-white/[0.04] last:border-0 hover:bg-white/[0.02] transition-colors">
								<div class="w-6 h-6 rounded-lg bg-violet-500/15 border border-violet-500/20 flex items-center justify-center flex-shrink-0">
									<span class="text-[9px] font-mono font-bold text-violet-400">{i + 1}</span>
								</div>

								<span class="text-[10px] font-mono text-white/40 w-24 flex-shrink-0 truncate">{label}</span>

								<select
									value={music.song}
									onchange={(e) => {
										const arr = [...slideMusic];
										if (!arr[i]) arr[i] = { song: 'No music', seconds: 15 };
										arr[i] = { ...arr[i], song: (e.target as HTMLSelectElement).value };
										slideMusic = arr;
									}}
									class="flex-1 bg-white/[0.05] border border-white/[0.08] rounded-lg py-1 px-2 text-[10px] font-body text-white/60 focus:outline-none focus:border-violet-500/40 transition-colors [color-scheme:dark] cursor-pointer"
								>
									{#each SONG_OPTIONS as opt}
										<option value={opt}>{opt}</option>
									{/each}
								</select>

								<div class="flex items-center gap-1.5 flex-shrink-0">
									<input
										type="range"
										min="1"
										max="60"
										step="1"
										value={music.seconds}
										oninput={(e) => {
											const arr = [...slideMusic];
											if (!arr[i]) arr[i] = { song: 'No music', seconds: 15 };
											arr[i] = { ...arr[i], seconds: parseInt((e.target as HTMLInputElement).value) };
											slideMusic = arr;
										}}
										class="w-16 accent-violet-500 cursor-pointer"
									/>
									<span class="text-[9px] font-mono text-white/30 w-8 text-right">{music.seconds}s</span>
								</div>
							</div>
						{/each}
					</div>

					<div class="px-4 py-3 border-t border-white/[0.06]">
						<button
							disabled
							class="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold font-body text-white/40 bg-white/[0.05] border border-white/[0.08] cursor-not-allowed"
						>
							<Music size={13} class="opacity-40" />
							Export as Video
							<span class="ml-auto text-[9px] font-mono text-white/20 bg-white/[0.05] px-2 py-0.5 rounded-md">Coming soon</span>
						</button>
					</div>
				</div>
			{/if}

			<button
				onclick={async () => {
					if (onBurnMusicClick) {
						await onBurnMusicClick();
						return;
					}
					showMusicPanel = !showMusicPanel;
					showPostPanel = false;
				}}
				class="flex items-center gap-2 pl-3 pr-4 py-2.5 rounded-2xl text-xs font-semibold font-body shadow-lg transition-all border"
				style="
					background: {showMusicPanel && !onBurnMusicClick ? 'rgb(124 58 237)' : 'color-mix(in oklab, var(--app-text) 6%, transparent)'};
					border-color: {showMusicPanel && !onBurnMusicClick ? 'rgba(139,92,246,0.35)' : 'var(--app-border)'};
					color: {showMusicPanel && !onBurnMusicClick ? '#fff' : 'var(--app-text-2)'};
				"
			>
				<Music size={14} />
				Burn Music
			</button>
		</div>

		{#if typeof onExportZip === 'function'}
			<button
				type="button"
				onclick={() => void onExportZip?.()}
				disabled={!!exportingZip || !!posting}
				class="flex items-center gap-2 pl-3 pr-4 py-2.5 rounded-2xl text-xs font-semibold font-body shadow-lg transition-all border"
				style="
					background: color-mix(in oklab, var(--app-text) 6%, transparent);
					border-color: var(--app-border);
					color: var(--app-text-2);
					{exportingZip || posting ? 'opacity: 0.65; cursor: wait;' : 'cursor: pointer;'}
				"
				title="Export all slides as PNG (ZIP)"
			>
				{#if exportingZip}
					<LoaderCircle size={14} class="animate-spin" />
					Export…
				{:else}
					<Download size={14} />
					Export
				{/if}
			</button>
		{/if}
	</div>
{/if}

