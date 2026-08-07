<script lang="ts">
	import { Music, Calendar, X, Send, LoaderCircle, Download, Bookmark, Save } from 'lucide-svelte';
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
		/** Explicit workspace draft save (listed under Carousels → Studio drafts). */
		onSaveDraft?: () => void | Promise<void>;
		draftSaving?: boolean;
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
		onSaveDraft = undefined,
		draftSaving = false,
	} = ($props() as $$Props);

	/** Host for fixed mode — portaled to `document.body` so nothing clips or re-parents the float. */
	let rootEl = $state<HTMLDivElement | null>(null);

	$effect(() => {
		if (inline) return;
		const el = rootEl;
		if (!el || typeof document === 'undefined') return;
		document.body.appendChild(el);
		return () => {
			el.remove();
		};
	});

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

	async function handleSaveDraftClick() {
		if (!onSaveDraft || draftSaving) return;
		await onSaveDraft();
	}
</script>

{#if hasSlides}
	<div
		bind:this={rootEl}
		class="floating-actions flex flex-row flex-nowrap items-end gap-2 {inline
			? 'w-full justify-end'
			: 'fixed left-auto'}"
		style={inline
			? ''
			: `right:${rightOffsetPx}px;bottom:${bottomOffsetPx}px;z-index:${zIndex};`}
	>
		{#if typeof onSaveDraft === 'function'}
			<button
				type="button"
				onclick={() => void handleSaveDraftClick()}
				class="fa-btn"
				disabled={draftSaving}
				title="Save a workspace draft to Carousels"
			>
				{#if draftSaving}
					<LoaderCircle size={13} class="animate-spin" />
					Saving…
				{:else}
					<Save size={13} />
					Save draft
				{/if}
			</button>
		{/if}

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
								Named copy under Carousels. Use Save draft for a quick workspace restore.
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

		<!-- EXPORT ZIP -->
		{#if typeof onExportZip === 'function'}
			<button
				type="button"
				onclick={() => void onExportZip?.()}
				disabled={!!exportingZip || !!posting}
				class="fa-btn"
				title="Export slides as ZIP — video slides as WebM (clip length), stills as PNG"
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
		background: #7bf1a8 !important;
		color: #0f0f10 !important;
		border-color: #7bf1a8 !important;
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
		border-radius: 999px;
		font-size: 12.5px;
		font-weight: 600;
		font-family: inherit;
		color: #0f0f10;
		background: #7bf1a8;
		border: 1px solid #7bf1a8;
		cursor: pointer;
		transition: background 140ms ease, transform 140ms ease, box-shadow 140ms ease;
	}
	.panel-save-btn:hover:not(:disabled) {
		background: #a7f7c6;
		border-color: #a7f7c6;
		box-shadow: 0 8px 24px rgba(123, 241, 168, 0.35);
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
