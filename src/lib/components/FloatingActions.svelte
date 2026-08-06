<script lang="ts">
	import { Music, Calendar, X, Send, LoaderCircle, Download, Bookmark } from 'lucide-svelte';
	import { goto } from '$app/navigation';

	interface $$Props {
		slideLabels?: string[];
		/** Render as a normal row inside a layout column instead of a fixed overlay. */
		inline?: boolean;
		rightOffsetPx?: number;
		bottomOffsetPx?: number;
		zIndex?: number;
		postUrl?: string;
		onPost?: () => void | Promise<void>;
		posting?: boolean;
		onExportZip?: () => void | Promise<void>;
		exportingZip?: boolean;
		onBurnMusicClick?: () => void | Promise<void>;
		/** Save current layout as a named reusable template. */
		onSaveTemplate?: (name: string) => void | Promise<void>;
		/** Prefill for the save-template name field when the popover opens. */
		defaultTemplateName?: string;
	}

	let {
		slideLabels = [],
		inline = false,
		rightOffsetPx = 24,
		bottomOffsetPx = 24,
		zIndex = 50,
		postUrl = '/dashboard/post-scheduler',
		onPost = undefined,
		posting = false,
		onExportZip = undefined,
		exportingZip = false,
		onBurnMusicClick = undefined,
		onSaveTemplate = undefined,
		defaultTemplateName = '',
	} = ($props() as $$Props);

	interface SlideMusicSettings { song: string; seconds: number; }

	let showMusicPanel = $state(false);
	let showPostPanel = $state(false);
	let showSavePanel = $state(false);
	let saveTemplateName = $state('');
	let saveTemplateSaving = $state(false);
	let saveTemplateError = $state('');
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

	$effect(() => {
		if (!hasSlides) { slideMusic = []; return; }
		if (slideMusic.length !== slideCount) {
			slideMusic = Array.from({ length: slideCount }, (_, i) => slideMusic[i] ?? { song: 'No music', seconds: 15 });
		}
	});

	function togglePlatform(p: string) {
		selectedPlatforms = selectedPlatforms.includes(p)
			? selectedPlatforms.filter((x) => x !== p)
			: [...selectedPlatforms, p];
	}

	async function handlePostClick() {
		if (posting) return;
		if (onPost) { await onPost(); return; }
		await goto(postUrl);
	}

	function openSavePanel() {
		showSavePanel = !showSavePanel;
		showPostPanel = false;
		showMusicPanel = false;
		saveTemplateError = '';
		if (showSavePanel && !saveTemplateName.trim()) {
			saveTemplateName = defaultTemplateName.trim() || 'My carousel layout';
		}
	}

	function closeSavePanel() {
		showSavePanel = false;
		saveTemplateError = '';
	}

	async function confirmSaveTemplate() {
		if (!onSaveTemplate || saveTemplateSaving) return;
		const name = saveTemplateName.trim() || defaultTemplateName.trim() || 'My carousel layout';
		saveTemplateSaving = true;
		saveTemplateError = '';
		try {
			await onSaveTemplate(name);
			closeSavePanel();
		} catch (e: unknown) {
			saveTemplateError = e instanceof Error ? e.message : 'Save failed — try again.';
		} finally {
			saveTemplateSaving = false;
		}
	}
</script>

{#if hasSlides}
	<div
		class="flex flex-row flex-nowrap items-end gap-2 {inline
			? 'w-full justify-end'
			: 'fixed'}"
		style={inline
			? ''
			: `right:${rightOffsetPx}px;bottom:${bottomOffsetPx}px;z-index:${zIndex};`}
	>
		<!-- Save template -->
		{#if typeof onSaveTemplate === 'function'}
			<div class="relative">
				{#if showSavePanel}
					<div class="panel absolute bottom-full mb-2 right-0 w-[300px] overflow-hidden z-10">
						<div class="panel-header">
							<div class="flex items-center gap-2">
								<Bookmark size={13} class="text-[#7c3aed]" />
								<span class="panel-title">Save template</span>
							</div>
							<button type="button" onclick={closeSavePanel} class="panel-close" aria-label="Close">
								<X size={11} />
							</button>
						</div>
						<div class="p-4 flex flex-col gap-3">
							<div>
								<p class="panel-label">Template name</p>
								<input
									type="text"
									bind:value={saveTemplateName}
									placeholder="My carousel layout"
									class="panel-input"
									disabled={saveTemplateSaving}
									onkeydown={(e) => {
										if (e.key === 'Enter') void confirmSaveTemplate();
										if (e.key === 'Escape') closeSavePanel();
									}}
								/>
							</div>
							{#if saveTemplateError}
								<p class="text-[11px] leading-snug text-red-600/90">{saveTemplateError}</p>
							{/if}
							<button
								type="button"
								class="panel-save-btn"
								disabled={saveTemplateSaving}
								onclick={() => void confirmSaveTemplate()}
							>
								{#if saveTemplateSaving}
									<LoaderCircle size={13} class="animate-spin" />
									Saving…
								{:else}
									<Bookmark size={13} />
									Save &amp; open Carousels
								{/if}
							</button>
							<p class="text-[10px] leading-snug text-[rgba(10,10,10,0.38)]">
								Shows up under Carousels. Studio also autosaves drafts as you edit.
							</p>
						</div>
					</div>
				{/if}
				<button
					type="button"
					onclick={openSavePanel}
					class="fa-btn"
					class:fa-btn--active={showSavePanel}
					title="Save current layout as a reusable template"
				>
					<Bookmark size={13} />
					Save template
				</button>
			</div>
		{/if}

		<!-- POST -->
		<div class="relative">
			{#if showPostPanel}
				<div class="panel absolute bottom-full mb-2 right-0 w-[340px] overflow-hidden">
					<div class="panel-header">
						<div class="flex items-center gap-2">
							<Calendar size={13} class="text-[#0ea5e9]" />
							<span class="panel-title">Schedule Post</span>
						</div>
						<button onclick={() => (showPostPanel = false)} class="panel-close" aria-label="Close">
							<X size={11} />
						</button>
					</div>

					<div class="p-4 flex flex-col gap-4">
						<div>
							<p class="panel-label">Platforms</p>
							<div class="grid grid-cols-3 gap-2">
								{#each [
									{ id: 'instagram', name: 'Instagram', color: '#ec4899' },
									{ id: 'linkedin', name: 'LinkedIn', color: '#3b82f6' },
									{ id: 'pinterest', name: 'Pinterest', color: '#ef4444' },
								] as platform}
									<button
										onclick={() => togglePlatform(platform.id)}
										class="platform-btn"
										class:platform-btn--active={selectedPlatforms.includes(platform.id)}
										style="--platform-color: {platform.color};"
									>
										<span class="text-[9px] font-mono" style="color: {selectedPlatforms.includes(platform.id) ? platform.color : 'rgba(10,10,10,0.3)'};">{platform.name}</span>
									</button>
								{/each}
							</div>
						</div>

						<div class="grid grid-cols-2 gap-2">
							<div>
								<p class="panel-label">Date</p>
								<input type="date" bind:value={scheduleDate} class="panel-input" />
							</div>
							<div>
								<p class="panel-label">Time</p>
								<input type="time" bind:value={scheduleTime} class="panel-input" />
							</div>
						</div>

						<button disabled class="panel-action-btn">
							<Send size={13} class="opacity-40" />
							Schedule Post
							<span class="soon-badge">Soon</span>
						</button>
					</div>
				</div>
			{/if}

			<button
				onclick={handlePostClick}
				disabled={posting}
				class="fa-btn"
				class:fa-btn--active={showPostPanel}
			>
				<Calendar size={13} />
				{#if posting}
					Exporting… <LoaderCircle size={13} class="animate-spin" />
				{:else}
					Post
				{/if}
			</button>
		</div>

		<!-- BURN MUSIC -->
		<div class="relative">
			{#if showMusicPanel && !onBurnMusicClick}
				<div class="panel absolute bottom-full mb-2 right-0 w-[400px] overflow-hidden">
					<div class="panel-header">
						<div class="flex items-center gap-2">
							<Music size={13} class="text-[#a78bfa]" />
							<span class="panel-title">Burn Music</span>
						</div>
						<button onclick={() => (showMusicPanel = false)} class="panel-close" aria-label="Close">
							<X size={11} />
						</button>
					</div>

					<div class="max-h-[320px] overflow-y-auto" style="scrollbar-width:thin;">
						{#each slideLabels as label, i}
							{@const music = slideMusic[i] ?? { song: 'No music', seconds: 15 }}
							<div class="music-row">
								<div class="slide-badge">{i + 1}</div>
								<span class="slide-label">{label}</span>
								<select
									value={music.song}
									onchange={(e) => {
										const arr = [...slideMusic];
										if (!arr[i]) arr[i] = { song: 'No music', seconds: 15 };
										arr[i] = { ...arr[i], song: (e.target as HTMLSelectElement).value };
										slideMusic = arr;
									}}
									class="panel-select"
								>
									{#each SONG_OPTIONS as opt}
										<option value={opt}>{opt}</option>
									{/each}
								</select>
								<div class="flex items-center gap-1.5 flex-shrink-0">
									<input type="range" min="1" max="60" step="1" value={music.seconds}
										oninput={(e) => {
											const arr = [...slideMusic];
											if (!arr[i]) arr[i] = { song: 'No music', seconds: 15 };
											arr[i] = { ...arr[i], seconds: parseInt((e.target as HTMLInputElement).value) };
											slideMusic = arr;
										}}
										class="w-16 cursor-pointer"
									/>
									<span class="text-[9px] text-[rgba(10,10,10,0.3)] w-8 text-right">{music.seconds}s</span>
								</div>
							</div>
						{/each}
					</div>

					<div class="p-3 border-t border-black/[0.06]">
						<button disabled class="panel-action-btn">
							<Music size={13} class="opacity-40" />
							Export as Video
							<span class="soon-badge">Coming soon</span>
						</button>
					</div>
				</div>
			{/if}

			<button
				onclick={async () => {
					if (onBurnMusicClick) { await onBurnMusicClick(); return; }
					showMusicPanel = !showMusicPanel;
					showPostPanel = false;
					showSavePanel = false;
				}}
				class="fa-btn"
				class:fa-btn--active={showMusicPanel && !onBurnMusicClick}
			>
				<Music size={13} />
				Burn
			</button>
		</div>

		<!-- EXPORT ZIP -->
		{#if typeof onExportZip === 'function'}
			<button
				type="button"
				onclick={() => void onExportZip?.()}
				disabled={!!exportingZip || !!posting}
				class="fa-btn"
				title="Export all slides as PNG (ZIP)"
			>
				{#if exportingZip}
					<LoaderCircle size={13} class="animate-spin" /> Export…
				{:else}
					<Download size={13} /> Export
				{/if}
			</button>
		{/if}
	</div>
{/if}

<style>
	/* ── Shared action button ── */
	.fa-btn {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 9px 14px;
		border-radius: 14px;
		font-size: 11.5px;
		font-weight: 600;
		font-family: inherit;
		white-space: nowrap;
		cursor: pointer;
		border: 1px solid rgba(10, 10, 10, 0.08);
		background: rgba(255, 255, 255, 0.82);
		color: rgba(10, 10, 10, 0.70);
		backdrop-filter: blur(14px);
		-webkit-backdrop-filter: blur(14px);
		box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08), 0 1px 3px rgba(0,0,0,0.05);
		transition: background 140ms ease, color 140ms ease, transform 140ms ease, box-shadow 140ms ease;
	}

	.fa-btn:hover:not(:disabled) {
		background: rgba(255, 255, 255, 0.96);
		color: rgba(10, 10, 10, 0.90);
		box-shadow: 0 6px 24px rgba(0, 0, 0, 0.11), 0 1px 3px rgba(0,0,0,0.06);
	}

	.fa-btn:active:not(:disabled) {
		transform: scale(0.97);
	}

	.fa-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.fa-btn--active {
		background: rgba(10, 10, 10, 0.88) !important;
		color: rgba(255, 255, 255, 0.92) !important;
		border-color: transparent !important;
	}

	/* ── Floating panel ── */
	.panel {
		border-radius: 18px;
		background: rgba(255, 255, 255, 0.94);
		border: 1px solid rgba(10, 10, 10, 0.08);
		box-shadow: 0 16px 48px rgba(0, 0, 0, 0.13), 0 2px 8px rgba(0,0,0,0.06);
		backdrop-filter: blur(20px);
		-webkit-backdrop-filter: blur(20px);
	}

	.panel-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 12px 16px;
		border-bottom: 1px solid rgba(10, 10, 10, 0.07);
	}

	.panel-title {
		font-size: 10px;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: rgba(10, 10, 10, 0.55);
	}

	.panel-close {
		width: 24px;
		height: 24px;
		border-radius: 8px;
		border: none;
		background: rgba(10, 10, 10, 0.05);
		color: rgba(10, 10, 10, 0.40);
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		transition: background 120ms ease, color 120ms ease;
	}

	.panel-close:hover {
		background: rgba(10, 10, 10, 0.09);
		color: rgba(10, 10, 10, 0.75);
	}

	.panel-label {
		font-size: 9px;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: rgba(10, 10, 10, 0.35);
		margin-bottom: 8px;
	}

	.panel-input {
		width: 100%;
		background: rgba(10, 10, 10, 0.04);
		border: 1px solid rgba(10, 10, 10, 0.09);
		border-radius: 10px;
		padding: 7px 10px;
		font-size: 12px;
		color: rgba(10, 10, 10, 0.65);
		outline: none;
		transition: border-color 120ms ease;
	}

	.panel-input:focus {
		border-color: rgba(10, 10, 10, 0.22);
	}

	.panel-action-btn {
		width: 100%;
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 10px 14px;
		border-radius: 11px;
		font-size: 12.5px;
		font-weight: 600;
		font-family: inherit;
		color: rgba(10, 10, 10, 0.35);
		background: rgba(10, 10, 10, 0.04);
		border: 1px solid rgba(10, 10, 10, 0.08);
		cursor: not-allowed;
	}

	.panel-save-btn {
		width: 100%;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		padding: 10px 14px;
		border-radius: 11px;
		font-size: 12.5px;
		font-weight: 600;
		font-family: inherit;
		color: #fff;
		background: #0f0f10;
		border: 1px solid transparent;
		cursor: pointer;
		transition: background 140ms ease, transform 140ms ease;
	}
	.panel-save-btn:hover:not(:disabled) {
		background: #2a2a2e;
	}
	.panel-save-btn:active:not(:disabled) {
		transform: scale(0.98);
	}
	.panel-save-btn:disabled {
		opacity: 0.55;
		cursor: not-allowed;
	}

	.soon-badge {
		margin-left: auto;
		font-size: 9px;
		font-weight: 600;
		letter-spacing: 0.04em;
		padding: 2px 7px;
		border-radius: 6px;
		background: rgba(10, 10, 10, 0.06);
		color: rgba(10, 10, 10, 0.30);
	}

	/* Music row */
	.music-row {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 8px 16px;
		border-bottom: 1px solid rgba(10, 10, 10, 0.05);
		transition: background 100ms ease;
	}

	.music-row:last-child { border-bottom: none; }
	.music-row:hover { background: rgba(10, 10, 10, 0.02); }

	.slide-badge {
		width: 22px;
		height: 22px;
		border-radius: 7px;
		background: rgba(10, 10, 10, 0.06);
		border: 1px solid rgba(10, 10, 10, 0.09);
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 9px;
		font-weight: 700;
		color: rgba(10, 10, 10, 0.45);
		flex-shrink: 0;
	}

	.slide-label {
		font-size: 10px;
		color: rgba(10, 10, 10, 0.40);
		width: 80px;
		flex-shrink: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.panel-select {
		flex: 1;
		background: rgba(10, 10, 10, 0.04);
		border: 1px solid rgba(10, 10, 10, 0.09);
		border-radius: 8px;
		padding: 4px 8px;
		font-size: 10px;
		color: rgba(10, 10, 10, 0.60);
		outline: none;
		cursor: pointer;
	}

	.platform-btn {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 6px;
		padding: 10px;
		border-radius: 11px;
		border: 1px solid rgba(10, 10, 10, 0.08);
		background: rgba(10, 10, 10, 0.03);
		cursor: pointer;
		transition: border-color 120ms ease, background 120ms ease;
	}

	.platform-btn:hover { background: rgba(10, 10, 10, 0.06); }
	.platform-btn--active { border-color: var(--platform-color); background: color-mix(in srgb, var(--platform-color) 8%, transparent); }
</style>
