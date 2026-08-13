<script lang="ts">
	import { Music, Calendar, X, Send, LoaderCircle, Download, Bookmark, Save, Plus } from 'lucide-svelte';
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
		/** Built-in starter this canvas belongs to (e.g. News). Choosing it replaces that default. */
		builtinTemplateLabel?: string;
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
		onListSavedTemplates = undefined,
		defaultTemplateName = '',
		builtinTemplateLabel = '',
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
	const BUILTIN_DEFAULT_ID = '__builtin__';

	const overwriteTarget = $derived(savedTemplates.find((t) => t.id === overwriteId) ?? null);
	const overwritingBuiltin = $derived(overwriteId === BUILTIN_DEFAULT_ID);
	const builtinLabel = $derived(builtinTemplateLabel.trim() || 'template');

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
		showSavePanel = !showSavePanel;
		showPostPanel = false;
		showMusicPanel = false;
		saveTemplateError = '';
		if (showSavePanel) {
			if (!saveTemplateName.trim()) {
				saveTemplateName = defaultTemplateName.trim() || 'My carousel layout';
			}
			overwriteId = '';
			void refreshSavedTemplates();
		}
	}

	function closeSavePanel() {
		showSavePanel = false;
		saveTemplateError = '';
		overwriteId = '';
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
		if (!saveTemplateName.trim()) {
			saveTemplateName = defaultTemplateName.trim() || 'My carousel layout';
		}
	}

	function chooseBuiltinDefault() {
		overwriteId = BUILTIN_DEFAULT_ID;
		if (!saveTemplateName.trim()) {
			saveTemplateName = `${builtinLabel} default`;
		}
	}

	function chooseOverwrite(row: { id: string; name: string }) {
		overwriteId = row.id;
		saveTemplateName = row.name;
	}

	async function confirmSaveTemplate() {
		if (!onSaveTemplate || saveTemplateSaving) return;
		const name = saveTemplateName.trim() || defaultTemplateName.trim() || 'My carousel layout';
		if (overwritingBuiltin) {
			const ok = confirm(
				`Replace the built-in ${builtinLabel} template with this design? New ${builtinLabel} decks will use this look.`,
			);
			if (!ok) return;
		} else if (overwriteId) {
			const ok = confirm(
				`Replace “${overwriteTarget?.name || name}” and use it as the ${builtinLabel} default? This cannot be undone.`,
			);
			if (!ok) return;
		}
		saveTemplateSaving = true;
		saveTemplateError = '';
		try {
			await onSaveTemplate(name, overwriteId ? { overwriteId } : undefined);
			closeSavePanel();
			const toast = overwritingBuiltin
				? `Saved as your ${builtinLabel} default`
				: overwriteId
					? `Updated “${name}”`
					: `Saved “${name}”`;
			setFlashToast(toast);
			showToast(toast);
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
		class="floating-actions {inline
			? 'flex w-full flex-row flex-nowrap items-end justify-end gap-2'
			: 'fixed flex flex-col items-stretch gap-1.5'}"
		style={inline
			? ''
			: `right:16px;bottom:${bottomOffsetPx}px;z-index:${zIndex};width:168px;`}
	>
		{#if typeof onSaveDraft === 'function'}
			<Button
				variant="outline"
				size="sm"
				onclick={() => void handleSaveDraftClick()}
				disabled={draftSaving}
				class="w-full justify-start shadow-sm"
				title="Save a workspace draft to Carousels"
			>
				{#if draftSaving}
					<LoaderCircle class="animate-spin" />
					Saving…
				{:else}
					<Save />
					Save draft
				{/if}
			</Button>
		{/if}

		<!-- Save template -->
		{#if typeof onSaveTemplate === 'function'}
			<div class="relative">
				{#if showSavePanel}
					<div class="panel absolute bottom-0 right-full mr-2 w-[320px] overflow-hidden z-10">
						<div class="panel-header">
							<div class="flex items-center gap-2">
								<Bookmark size={13} class="text-[#7c3aed]" />
								<span class="panel-title">Save template</span>
							</div>
							<Button
								type="button"
								variant="ghost"
								size="icon-xs"
								onclick={closeSavePanel}
								aria-label="Close"
							>
								<X />
							</Button>
						</div>
						<div class="p-4 flex flex-col gap-3">
							<div>
								<p class="panel-label">Your templates</p>
								<div class="tpl-list" role="listbox" aria-label="Saved templates">
									<button
										type="button"
										class="tpl-row"
										class:tpl-row--on={!overwriteId}
										disabled={saveTemplateSaving}
										onclick={chooseNewTemplate}
									>
										<span class="tpl-ico"><Plus size={12} /></span>
										<span class="tpl-copy">
											<span class="tpl-name">New template</span>
											<span class="tpl-meta">Keep existing ones</span>
										</span>
									</button>
									<button
										type="button"
										class="tpl-row"
										class:tpl-row--on={overwritingBuiltin}
										disabled={saveTemplateSaving}
										onclick={chooseBuiltinDefault}
									>
										<span class="tpl-copy">
											<span class="tpl-name">{builtinLabel} default</span>
											<span class="tpl-meta">Replace the built-in starter</span>
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
							</div>
							<div>
								<p class="panel-label">
									{overwritingBuiltin ? 'Save as' : overwriteId ? 'Replace as' : 'Template name'}
								</p>
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
							<Button
								type="button"
								class="w-full"
								disabled={saveTemplateSaving}
								onclick={() => void confirmSaveTemplate()}
							>
								{#if saveTemplateSaving}
									<LoaderCircle class="animate-spin" />
									Saving…
								{:else if overwritingBuiltin}
									<Bookmark />
									Replace {builtinLabel} default
								{:else if overwriteId}
									<Bookmark />
									Replace template
								{:else}
									<Bookmark />
									Save new template
								{/if}
							</Button>
							<p class="text-[10px] leading-snug text-[rgba(10,10,10,0.38)]">
								{#if overwritingBuiltin}
									Becomes the {builtinLabel} starter for your account. New {builtinLabel} decks use this design and copy.
								{:else if overwriteId}
									Overwrites that named template and sets it as your {builtinLabel} default.
								{:else}
									Creates a named copy under Carousels. Choose “{builtinLabel} default” to replace the built-in starter.
								{/if}
							</p>
						</div>
					</div>
				{/if}
				<Button
					variant={showSavePanel ? 'default' : 'outline'}
					size="sm"
					onclick={openSavePanel}
					class="w-full justify-start shadow-sm"
					aria-expanded={showSavePanel}
					title="Save current layout as a reusable template"
				>
					<Bookmark />
					Save template
				</Button>
			</div>
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

	.tpl-list {
		display: flex;
		flex-direction: column;
		gap: 4px;
		max-height: 168px;
		overflow-y: auto;
		padding: 2px;
		margin: 0 -2px;
	}

	.tpl-row {
		display: flex;
		align-items: center;
		gap: 8px;
		width: 100%;
		text-align: left;
		padding: 7px 8px;
		border-radius: 10px;
		border: 1px solid transparent;
		background: rgba(10, 10, 10, 0.03);
		cursor: pointer;
		font-family: inherit;
	}

	.tpl-row:hover:not(:disabled) {
		background: rgba(10, 10, 10, 0.06);
	}

	.tpl-row--on {
		border-color: rgba(124, 58, 237, 0.35);
		background: rgba(124, 58, 237, 0.08);
	}

	.tpl-row:disabled {
		opacity: 0.55;
		cursor: not-allowed;
	}

	.tpl-ico {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 22px;
		height: 22px;
		border-radius: 7px;
		background: rgba(10, 10, 10, 0.06);
		color: rgba(10, 10, 10, 0.55);
		flex-shrink: 0;
	}

	.tpl-copy {
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 1px;
	}

	.tpl-name {
		font-size: 12px;
		font-weight: 600;
		color: rgba(10, 10, 10, 0.78);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.tpl-meta {
		font-size: 10px;
		color: rgba(10, 10, 10, 0.38);
	}

	.tpl-empty {
		margin: 4px 2px 0;
		font-size: 11px;
		color: rgba(10, 10, 10, 0.4);
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
