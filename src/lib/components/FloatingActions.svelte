<script lang="ts">
	import { tick } from 'svelte';
	import { Music, Calendar, X, Send, LoaderCircle, Download, Bookmark, Plus } from 'lucide-svelte';
	import { goto } from '$app/navigation';
	import { Button } from '$lib/components/ui/button';
	import { setFlashToast } from '$lib/ui/flash-toast';

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
		/** Save current layout as a named reusable template (or replace an existing one). */
		onSaveTemplate?: (name: string, opts?: { overwriteId?: string }) => void | Promise<void>;
		/** Existing named templates for the replace list. */
		onListSavedTemplates?: () => Promise<{ id: string; name: string; updatedAt: string }[]>;
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
		onListSavedTemplates = undefined,
		defaultTemplateName = '',
	} = ($props() as $$Props);

	/** Host for fixed mode — portaled to `document.body` so nothing clips or re-parents the float. */
	let rootEl = $state<HTMLDivElement | null>(null);
	let saveModalEl = $state<HTMLDivElement | null>(null);
	let saveNameInputEl = $state<HTMLInputElement | null>(null);

	$effect(() => {
		if (inline) return;
		const el = rootEl;
		if (!el || typeof document === 'undefined') return;
		document.body.appendChild(el);
		return () => {
			el.remove();
		};
	});

	$effect(() => {
		const el = saveModalEl;
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
	let toastMessage = $state('');
	let toastTimer: ReturnType<typeof setTimeout> | null = null;

	function showToast(message: string) {
		const msg = String(message ?? '').trim();
		if (!msg) return;
		toastMessage = msg;
		if (toastTimer) clearTimeout(toastTimer);
		toastTimer = setTimeout(() => {
			toastMessage = '';
			toastTimer = null;
		}, 3200);
	}
	let saveTemplateName = $state('');
	let saveTemplateSaving = $state(false);
	let saveTemplateError = $state('');
	let savedTemplates = $state<{ id: string; name: string; updatedAt: string }[]>([]);
	let savedTemplatesLoading = $state(false);
	let overwriteId = $state('');

	const overwriteTarget = $derived(savedTemplates.find((t) => t.id === overwriteId) ?? null);
	const canSaveTemplate = $derived(!!saveTemplateName.trim() && !saveTemplateSaving);

	function formatTemplateTime(iso: string): string {
		if (!iso) return '';
		const d = new Date(iso);
		if (Number.isNaN(d.getTime())) return '';
		return d.toLocaleString(undefined, { month: 'short', day: 'numeric' });
	}
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
		showSavePanel = true;
		showPostPanel = false;
		showMusicPanel = false;
		saveTemplateError = '';
		overwriteId = '';
		saveTemplateName = '';
		void refreshSavedTemplates();
	}

	function closeSavePanel() {
		showSavePanel = false;
		saveTemplateError = '';
		overwriteId = '';
		saveTemplateName = '';
	}

	async function refreshSavedTemplates() {
		if (!onListSavedTemplates) {
			savedTemplates = [];
			return;
		}
		savedTemplatesLoading = true;
		try {
			savedTemplates = await onListSavedTemplates();
		} catch (e: unknown) {
			savedTemplates = [];
			saveTemplateError = e instanceof Error ? e.message : 'Could not load templates.';
		} finally {
			savedTemplatesLoading = false;
		}
	}

	function chooseNewTemplate() {
		overwriteId = '';
		saveTemplateName = '';
		saveTemplateError = '';
		void tick().then(() => saveNameInputEl?.focus());
	}

	function chooseOverwrite(row: { id: string; name: string }) {
		overwriteId = row.id;
		saveTemplateName = row.name;
		saveTemplateError = '';
		void tick().then(() => {
			saveNameInputEl?.focus();
			saveNameInputEl?.select();
		});
	}

	$effect(() => {
		if (!showSavePanel || typeof document === 'undefined') return;
		const onKey = (e: KeyboardEvent) => {
			if (e.key === 'Escape' && !saveTemplateSaving) closeSavePanel();
		};
		window.addEventListener('keydown', onKey);
		return () => window.removeEventListener('keydown', onKey);
	});

	$effect(() => {
		if (!showSavePanel) return;
		void tick().then(() => saveNameInputEl?.focus());
	});

	async function confirmSaveTemplate() {
		if (!onSaveTemplate || saveTemplateSaving) return;
		const name = saveTemplateName.trim();
		if (!name) {
			saveTemplateError = 'Enter a template name to save.';
			saveNameInputEl?.focus();
			return;
		}
		if (overwriteId) {
			const ok = confirm(
				`Replace “${overwriteTarget?.name || name}” with this design? This only updates your saved template.`,
			);
			if (!ok) return;
		}
		saveTemplateSaving = true;
		saveTemplateError = '';
		const toast = overwriteId ? `Updated “${name}”` : `Saved “${name}”`;
		try {
			await onSaveTemplate(name, overwriteId ? { overwriteId } : undefined);
			closeSavePanel();
			setFlashToast(toast);
			showToast(toast);
		} catch (e: unknown) {
			saveTemplateError = e instanceof Error ? e.message : 'Save failed — try again.';
		} finally {
			saveTemplateSaving = false;
		}
	}

</script>

{#if hasSlides}
	<div
		bind:this={rootEl}
		class="floating-actions {inline
			? 'flex w-full flex-row flex-nowrap items-end justify-end gap-2'
			: 'fixed flex flex-col items-stretch gap-1.5'}"
		style={inline
			? ''
			: `right:16px;bottom:${bottomOffsetPx}px;z-index:${zIndex};width:168px;`}
	>
		<!-- Save template -->
		{#if typeof onSaveTemplate === 'function'}
			<Button
				variant={showSavePanel ? 'default' : 'outline'}
				size="sm"
				onclick={openSavePanel}
				class="w-full justify-start shadow-sm"
				aria-expanded={showSavePanel}
				aria-haspopup="dialog"
				title="Save current layout as a reusable template"
			>
				<Bookmark />
				Save template
			</Button>
		{/if}

		<!-- EXPORT ZIP -->
		{#if typeof onExportZip === 'function'}
			<Button
				variant="default"
				size="sm"
				onclick={() => void onExportZip?.()}
				disabled={!!exportingZip || !!posting}
				class="w-full justify-start shadow-sm"
				title="Export slides as ZIP — video slides as WebM (clip length), stills as PNG"
			>
				{#if exportingZip}
					<LoaderCircle class="animate-spin" />
					Export…
				{:else}
					<Download />
					Export
				{/if}
			</Button>
		{/if}
		{#if toastMessage}
			<div class="fa-toast" role="status" aria-live="polite">{toastMessage}</div>
		{/if}
	</div>
{/if}

{#if showSavePanel}
	<div bind:this={saveModalEl} class="save-root">
		<div
			class="save-backdrop"
			role="presentation"
			onclick={(e) => {
				if (e.target === e.currentTarget && !saveTemplateSaving) closeSavePanel();
			}}
		>
			<div
				class="save-modal"
				role="dialog"
				aria-modal="true"
				aria-labelledby="save-template-title"
				tabindex="-1"
			>
				<button
					type="button"
					class="save-close"
					onclick={closeSavePanel}
					disabled={saveTemplateSaving}
					aria-label="Close"
				>
					<X size={18} />
				</button>

				<p class="save-kicker">Studio</p>
				<h2 id="save-template-title" class="save-title">Save template</h2>
				<p class="save-sub">
					Name this layout to reuse it later, or replace one you already saved.
				</p>

				<label class="save-label" for="save-template-name">
					{overwriteId ? 'Replace as' : 'Template name'}
				</label>
				<input
					id="save-template-name"
					bind:this={saveNameInputEl}
					class="save-input"
					type="text"
					bind:value={saveTemplateName}
					placeholder="Name this template"
					disabled={saveTemplateSaving}
					autocomplete="off"
					onkeydown={(e) => {
						if (e.key === 'Enter') {
							e.preventDefault();
							void confirmSaveTemplate();
						}
					}}
				/>

				<p class="save-label save-label--list">Your templates</p>
				<div class="tpl-list" role="listbox" aria-label="Saved templates">
					<button
						type="button"
						class="tpl-row"
						class:tpl-row--on={!overwriteId}
						disabled={saveTemplateSaving}
						onclick={chooseNewTemplate}
					>
						<span class="tpl-ico"><Plus size={13} strokeWidth={2.4} /></span>
						<span class="tpl-copy">
							<span class="tpl-name">New template</span>
							<span class="tpl-meta">Create a new save</span>
						</span>
					</button>
					{#if savedTemplatesLoading}
						<p class="tpl-empty">Loading…</p>
					{:else if savedTemplates.length === 0}
						<p class="tpl-empty">None yet — this will be your first.</p>
					{:else}
						{#each savedTemplates as row (row.id)}
							<button
								type="button"
								class="tpl-row"
								class:tpl-row--on={overwriteId === row.id}
								disabled={saveTemplateSaving}
								onclick={() => chooseOverwrite(row)}
							>
								<span class="tpl-copy">
									<span class="tpl-name">{row.name}</span>
									<span class="tpl-meta">{formatTemplateTime(row.updatedAt) || 'Saved'}</span>
								</span>
							</button>
						{/each}
					{/if}
				</div>

				{#if saveTemplateError}
					<p class="save-error" role="alert">{saveTemplateError}</p>
				{/if}

				<button
					type="button"
					class="save-submit"
					disabled={!canSaveTemplate}
					onclick={() => void confirmSaveTemplate()}
				>
					{#if saveTemplateSaving}
						<span class="save-spinner" aria-hidden="true"></span>
						Saving…
					{:else if overwriteId}
						Replace template
					{:else}
						Save new template
					{/if}
				</button>
				<p class="save-hint">
					{#if overwriteId}
						Overwrites that named template on your account only.
					{:else}
						Saves to your account under Carousels.
					{/if}
				</p>
			</div>
		</div>
	</div>
{/if}

<style>
	.fa-toast {
		position: fixed;
		left: 50%;
		bottom: 28px;
		transform: translateX(-50%);
		z-index: 9999;
		max-width: min(420px, calc(100vw - 32px));
		padding: 12px 18px;
		border-radius: 14px;
		background: rgba(15, 15, 16, 0.94);
		color: #fff;
		font-size: 13px;
		font-weight: 600;
		letter-spacing: -0.01em;
		box-shadow: 0 12px 40px rgba(0, 0, 0, 0.28);
		pointer-events: none;
		animation: fa-toast-in 180ms ease-out;
	}

	@keyframes fa-toast-in {
		from {
			opacity: 0;
			transform: translateX(-50%) translateY(8px);
		}
		to {
			opacity: 1;
			transform: translateX(-50%) translateY(0);
		}
	}

	.save-backdrop {
		position: fixed;
		inset: 0;
		z-index: 9999;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 16px;
		background: rgba(8, 8, 8, 0.48);
		backdrop-filter: blur(12px);
		-webkit-backdrop-filter: blur(12px);
		animation: saveFadeIn 0.18s ease;
	}
	@keyframes saveFadeIn {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}
	.save-modal {
		position: relative;
		width: min(440px, 100%);
		max-height: min(86vh, 640px);
		overflow: auto;
		padding: 28px 24px 22px;
		border-radius: 20px;
		background: #ffffff;
		border: 1px solid rgba(8, 8, 8, 0.1);
		color: #080808;
		font-family: var(--font-body, system-ui, sans-serif);
		box-shadow:
			0 1px 0 rgba(255, 255, 255, 0.7) inset,
			0 28px 72px rgba(8, 8, 8, 0.22);
		animation: savePopIn 0.22s ease;
	}
	@keyframes savePopIn {
		from {
			opacity: 0;
			transform: translateY(10px) scale(0.98);
		}
		to {
			opacity: 1;
			transform: none;
		}
	}
	.save-close {
		position: absolute;
		top: 12px;
		right: 12px;
		width: 36px;
		height: 36px;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		border: none;
		border-radius: 10px;
		background: transparent;
		color: rgba(8, 8, 8, 0.42);
		cursor: pointer;
	}
	.save-close:hover:not(:disabled) {
		background: rgba(8, 8, 8, 0.05);
		color: #080808;
	}
	.save-close:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
	.save-kicker {
		margin: 0 0 6px;
		font-size: 11px;
		font-weight: 700;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: rgba(8, 8, 8, 0.42);
	}
	.save-title {
		margin: 0 0 6px;
		padding-right: 36px;
		font-size: 28px;
		font-weight: 700;
		letter-spacing: -0.03em;
		line-height: 1.12;
		color: #080808;
	}
	.save-sub {
		margin: 0 0 20px;
		font-size: 14px;
		line-height: 1.45;
		color: #5b5b62;
	}
	.save-label {
		display: block;
		margin: 0 0 8px;
		font-size: 12px;
		font-weight: 600;
		color: #5b5b62;
	}
	.save-label--list {
		margin-top: 18px;
	}
	.save-input {
		width: 100%;
		height: 48px;
		padding: 0 14px;
		box-sizing: border-box;
		background: #fff;
		border: 1px solid rgba(8, 8, 8, 0.14);
		border-radius: 12px;
		color: #080808;
		font: inherit;
		font-size: 15px;
		outline: none;
	}
	.save-input:focus {
		border-color: #080808;
		box-shadow: 0 0 0 3px rgba(232, 255, 72, 0.55);
	}
	.save-input:disabled {
		opacity: 0.65;
	}
	.save-input::placeholder {
		color: #9a9aa1;
	}
	.save-error {
		margin: 12px 0 0;
		padding: 10px 12px;
		border-radius: 10px;
		background: rgba(239, 68, 68, 0.08);
		border: 1px solid rgba(239, 68, 68, 0.22);
		font-size: 13px;
		color: #b91c1c;
	}
	.save-submit {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		width: 100%;
		height: 50px;
		margin-top: 16px;
		border: 1px solid #e8ff48;
		border-radius: 999px;
		background: #e8ff48;
		color: #080808;
		font: inherit;
		font-size: 15px;
		font-weight: 700;
		cursor: pointer;
		transition:
			background 0.2s ease,
			border-color 0.2s ease,
			transform 0.2s ease;
	}
	.save-submit:hover:not(:disabled) {
		background: #f3ff8a;
		border-color: #f3ff8a;
		transform: translateY(-1px);
	}
	.save-submit:disabled {
		opacity: 0.45;
		cursor: not-allowed;
		transform: none;
	}
	.save-spinner {
		width: 16px;
		height: 16px;
		border: 2px solid rgba(8, 8, 8, 0.2);
		border-top-color: #080808;
		border-radius: 999px;
		animation: saveSpin 0.7s linear infinite;
	}
	@keyframes saveSpin {
		to {
			transform: rotate(360deg);
		}
	}
	.save-hint {
		margin: 10px 0 0;
		font-size: 12px;
		line-height: 1.4;
		color: rgba(8, 8, 8, 0.4);
		text-align: center;
	}

	.tpl-list {
		display: flex;
		flex-direction: column;
		gap: 6px;
		max-height: min(28vh, 220px);
		overflow-y: auto;
		padding: 2px;
		margin: 0 -2px;
		scrollbar-width: thin;
	}

	.tpl-row {
		display: flex;
		align-items: center;
		gap: 10px;
		width: 100%;
		text-align: left;
		padding: 10px 12px;
		border-radius: 12px;
		border: 1px solid transparent;
		background: rgba(8, 8, 8, 0.03);
		cursor: pointer;
		font-family: inherit;
	}

	.tpl-row:hover:not(:disabled):not(.tpl-row--on) {
		background: rgba(8, 8, 8, 0.06);
	}

	.tpl-row--on {
		border-color: #080808;
		background: #e8ff48;
	}

	.tpl-row:disabled {
		opacity: 0.55;
		cursor: not-allowed;
	}

	.tpl-ico {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 28px;
		height: 28px;
		border-radius: 8px;
		background: #080808;
		color: #e8ff48;
		flex-shrink: 0;
	}

	.tpl-row--on .tpl-ico {
		background: #080808;
		color: #e8ff48;
	}

	.tpl-copy {
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 1px;
	}

	.tpl-name {
		font-size: 13px;
		font-weight: 650;
		color: #080808;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.tpl-meta {
		font-size: 11px;
		color: rgba(8, 8, 8, 0.42);
	}

	.tpl-empty {
		margin: 4px 2px 0;
		font-size: 12px;
		color: rgba(8, 8, 8, 0.4);
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

	@media (max-width: 767px) {
		.floating-actions:not(.inline) {
			top: calc(4.25rem + env(safe-area-inset-top, 0px));
			bottom: auto !important;
			right: 10px !important;
			width: min(10.5rem, calc(100vw - 1.25rem)) !important;
		}
		.floating-actions :global(button) {
			min-height: 40px;
		}
	}
</style>
