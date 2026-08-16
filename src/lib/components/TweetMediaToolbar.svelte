<script lang="ts">
	/**
	 * Studio floating toolbar for tweet template attachment — matches TextCarouselAvatarToolbar shell.
	 */
	import { ImagePlus, Minus, Plus, Trash2, X } from 'lucide-svelte';

	const MEDIA_ZOOM_MIN = 1;
	const MEDIA_ZOOM_MAX = 5;

	type Props = {
		anchor: DOMRect | null;
		hasAttachment: boolean;
		zoom: number;
		onZoomIn: () => void;
		onZoomOut: () => void;
		onReplaceFile: (file: File) => void;
		onRemove: () => void;
		onClose: () => void;
	};

	let { anchor, hasAttachment, zoom, onZoomIn, onZoomOut, onReplaceFile, onRemove, onClose }: Props = $props();

	let fileInput = $state<HTMLInputElement | null>(null);

	const TOOLBAR_W = 560;
	const TOOLBAR_H = 44;

	const zNum = $derived(Number(zoom) || 1);
	const zoomOutDisabled = $derived(zNum <= MEDIA_ZOOM_MIN + 0.02);
	const zoomInDisabled = $derived(zNum >= MEDIA_ZOOM_MAX - 0.02);

	const pos = $derived.by(() => {
		if (!anchor) return { top: 0, left: 0, show: false };
		const vw = typeof window !== 'undefined' ? window.innerWidth : 1200;
		let top = anchor.top - TOOLBAR_H - 14;
		if (top < 12) top = anchor.bottom + 14;
		let left = anchor.left + anchor.width / 2 - TOOLBAR_W / 2;
		left = Math.max(12, Math.min(left, vw - TOOLBAR_W - 12));
		return { top, left, show: true };
	});

	function handleDocDown(ev: MouseEvent) {
		const t = ev.target;
		if (!(t instanceof Element)) return;
		if (t.closest('[data-tweet-media-toolbar]')) return;
		if (t.closest('[data-tweet-media-frame]')) return;
		if (t.closest('[data-floating-toolbar]')) return;
		if (t.closest('[data-text-selectable]')) return;
		if (t.closest('[data-slot="popover-content"]')) return;
		onClose();
	}

	$effect(() => {
		if (!pos.show) return;
		const id = requestAnimationFrame(() => {
			document.addEventListener('mousedown', handleDocDown);
		});
		return () => {
			cancelAnimationFrame(id);
			document.removeEventListener('mousedown', handleDocDown);
		};
	});

	function onFileChange(e: Event) {
		const input = e.target as HTMLInputElement;
		const f = input.files?.[0];
		input.value = '';
		if (!f) return;
		onReplaceFile(f);
	}
</script>

{#if pos.show}
	<div
		data-floating-toolbar
		data-tweet-media-toolbar
		class="fixed z-[65] flex items-center gap-1 rounded-xl border px-2 py-1.5 shadow-2xl backdrop-blur-md avatar-tb-shell"
		style="
			top: {pos.top}px;
			left: {pos.left}px;
			width: {TOOLBAR_W}px;
			min-height: {TOOLBAR_H}px;
			background: var(--app-surface-2);
			border-color: var(--app-border);
			color: var(--app-text);
		"
		role="toolbar"
		tabindex="-1"
		aria-label="Tweet media"
		onmousedown={(e) => e.stopPropagation()}
	>
		<span
			class="shrink-0 pl-1 font-mono text-[9px] uppercase tracking-wider avatar-tb-muted"
			title="Attached media"
		>
			Media
		</span>

		<div class="avatar-tb-div h-6 w-px shrink-0"></div>

		<input bind:this={fileInput} type="file" accept="image/*,video/*" class="hidden" onchange={onFileChange} />
		<button
			type="button"
			class="avatar-tb-btn inline-flex h-9 shrink-0 items-center gap-1 rounded-lg px-2.5 text-[11px] font-medium transition-colors"
			onclick={() => fileInput?.click()}
			title={hasAttachment ? 'Replace image or video' : 'Upload image or video'}
		>
			<ImagePlus size={14} class="avatar-tb-muted shrink-0" />
			<span class="hidden sm:inline">{hasAttachment ? 'Replace' : 'Image'}</span>
		</button>

		{#if hasAttachment}
			<button
				type="button"
				class="avatar-tb-btn flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors"
				onclick={() => onRemove()}
				title="Remove media"
				aria-label="Remove media"
			>
				<Trash2 size={13} class="text-red-600" />
			</button>
		{/if}

		{#if hasAttachment}
			<div class="avatar-tb-div h-6 w-px shrink-0"></div>
			<button
				type="button"
				class="avatar-tb-btn flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors disabled:cursor-not-allowed disabled:opacity-40"
				disabled={zoomOutDisabled}
				onclick={() => onZoomOut()}
				title="Zoom out"
				aria-label="Zoom out"
			>
				<Minus size={16} strokeWidth={2.5} />
			</button>
			<button
				type="button"
				class="avatar-tb-btn flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors disabled:cursor-not-allowed disabled:opacity-40"
				disabled={zoomInDisabled}
				onclick={() => onZoomIn()}
				title="Zoom in"
				aria-label="Zoom in"
			>
				<Plus size={16} strokeWidth={2.5} />
			</button>
		{/if}

		<button
			type="button"
			class="avatar-tb-btn ml-auto flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors"
			onclick={() => onClose()}
			aria-label="Close"
			title="Close"
		>
			<X size={14} class="avatar-tb-muted" />
		</button>
	</div>
{/if}

<style>
	.avatar-tb-shell {
		border-width: 1px;
		border-style: solid;
	}
	:root[data-theme='dark'] .avatar-tb-shell {
		background: rgba(26, 26, 26, 0.95);
		border-color: rgba(255, 255, 255, 0.1);
	}

	.avatar-tb-div {
		background: color-mix(in oklab, var(--app-text) 12%, transparent);
	}
	:root[data-theme='dark'] .avatar-tb-div {
		background: rgba(255, 255, 255, 0.1);
	}

	.avatar-tb-muted {
		color: var(--app-text-2);
	}
	:root[data-theme='dark'] .avatar-tb-muted {
		color: rgba(255, 255, 255, 0.55);
	}

	.avatar-tb-btn:hover:not(:disabled) {
		background: color-mix(in oklab, var(--app-text) 6%, transparent);
	}
	:root[data-theme='dark'] .avatar-tb-btn:hover:not(:disabled) {
		background: rgba(255, 255, 255, 0.05);
	}
</style>
