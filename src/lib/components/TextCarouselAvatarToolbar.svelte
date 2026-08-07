<script lang="ts">
	import { ImagePlus, X, Palette, Trash2, Circle } from 'lucide-svelte';

	type Props = {
		anchor: DOMRect | null;
		avatarSrc: string;
		innerBg: string;
		label: string;
		/** Shown when label is empty — derived name for initials hint */
		nameFallback: string;
		defaultInnerBg: string;
		ringColor: string;
		ringWidth: number;
		defaultRingColor?: string;
		onImageFile: (dataUrl: string) => void;
		onClearImage: () => void;
		onInnerBg: (hex: string) => void;
		onClearInnerBg: () => void;
		onLabel: (value: string) => void;
		onRingColor: (hex: string) => void;
		onRingWidth: (px: number) => void;
		onClose: () => void;
	};

	let {
		anchor,
		avatarSrc,
		innerBg,
		label,
		nameFallback,
		defaultInnerBg,
		ringColor,
		ringWidth,
		defaultRingColor = '#c9b97a',
		onImageFile,
		onClearImage,
		onInnerBg,
		onClearInnerBg,
		onLabel,
		onRingColor,
		onRingWidth,
		onClose,
	}: Props = $props();

	let fileInput = $state<HTMLInputElement | null>(null);

	/** Horizontal toolbar — wider to fit ring controls. */
	const TOOLBAR_W = 720;
	const TOOLBAR_H = 44;

	const pos = $derived.by(() => {
		if (!anchor) return { top: 0, left: 0, show: false };
		const vw = typeof window !== 'undefined' ? window.innerWidth : 1200;
		let top = anchor.top - TOOLBAR_H - 14;
		if (top < 12) top = anchor.bottom + 14;
		let left = anchor.left + anchor.width / 2 - TOOLBAR_W / 2;
		left = Math.max(12, Math.min(left, vw - TOOLBAR_W - 12));
		return { top, left, show: true };
	});

	function initialsHint(n: string) {
		return n
			.replace(/[^\w\s]/g, '')
			.trim()
			.split(/\s+/)
			.map((w) => w[0]?.toUpperCase() ?? '')
			.slice(0, 3)
			.join('');
	}

	function handleFile(e: Event) {
		const input = e.target as HTMLInputElement;
		const f = input.files?.[0];
		input.value = '';
		if (!f || !f.type.startsWith('image/')) return;
		const r = new FileReader();
		r.onload = () => onImageFile(String(r.result ?? ''));
		r.readAsDataURL(f);
	}

	function handleDocumentClick(ev: MouseEvent) {
		const el = ev.target;
		if (!(el instanceof Element)) return;
		if (el.closest('[data-floating-toolbar]')) return;
		if (el.closest('[data-text-selectable]')) return;
		if (el.closest('[data-slot="popover-content"]')) return;
		onClose();
	}

	$effect(() => {
		if (!pos.show) return;
		document.addEventListener('mousedown', handleDocumentClick);
		return () => document.removeEventListener('mousedown', handleDocumentClick);
	});

	const labelTitle = $derived(
		'Text inside the circle when no photo is set. Empty → use initials from the name (' +
			(initialsHint(nameFallback) || '…') +
			').',
	);

	const ringPx = $derived(Math.max(0, Math.min(24, Math.round(Number(ringWidth) || 0))));
</script>

{#if pos.show}
	<div
		data-floating-toolbar
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
		aria-label="Profile circle"
	>
		<span
			class="shrink-0 pl-1 font-mono text-[9px] uppercase tracking-wider avatar-tb-muted"
			title="Logo / profile circle"
		>
			Circle
		</span>

		<div class="w-px h-6 shrink-0 avatar-tb-div"></div>

		<input bind:this={fileInput} type="file" accept="image/*" class="hidden" onchange={handleFile} />
		<button
			type="button"
			class="avatar-tb-btn inline-flex h-9 shrink-0 items-center gap-1 rounded-lg px-2.5 text-[11px] font-medium transition-colors"
			onclick={() => fileInput?.click()}
			title={avatarSrc.trim() ? 'Replace circle image' : 'Upload circle image'}
		>
			<ImagePlus size={14} class="avatar-tb-muted shrink-0" />
			<span class="hidden sm:inline">{avatarSrc.trim() ? 'Replace' : 'Image'}</span>
		</button>
		{#if avatarSrc.trim()}
			<button
				type="button"
				class="avatar-tb-btn flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors"
				onclick={() => onClearImage()}
				title="Remove image"
				aria-label="Remove circle image"
			>
				<Trash2 size={13} class="avatar-tb-muted" />
			</button>
		{/if}

		<div class="w-px h-6 shrink-0 avatar-tb-div"></div>

		<span class="inline-flex h-9 shrink-0 items-center gap-1 rounded-lg px-1.5 avatar-tb-btn" title="Solid fill behind initials (no photo)">
			<Palette size={13} class="avatar-tb-muted shrink-0" />
			<input
				type="color"
				value={innerBg.trim() ? innerBg : defaultInnerBg}
				class="h-8 w-9 cursor-pointer rounded-md border p-0"
				style="border-color: var(--app-border); background: var(--app-surface-3);"
				oninput={(e) => onInnerBg((e.target as HTMLInputElement).value)}
				aria-label="Circle fill color"
			/>
		</span>

		<div class="w-px h-6 shrink-0 avatar-tb-div"></div>

		<span
			class="inline-flex h-9 shrink-0 items-center gap-1 rounded-lg px-1.5 avatar-tb-btn"
			title="Ring border color"
		>
			<Circle size={13} class="avatar-tb-muted shrink-0" />
			<input
				type="color"
				value={ringColor.trim() ? ringColor : defaultRingColor}
				class="h-8 w-9 cursor-pointer rounded-md border p-0"
				style="border-color: var(--app-border); background: var(--app-surface-3);"
				oninput={(e) => onRingColor((e.target as HTMLInputElement).value)}
				aria-label="Ring border color"
			/>
		</span>

		<label class="inline-flex h-9 shrink-0 items-center gap-1 rounded-lg px-1.5" title="Ring border thickness (px)">
			<span class="font-mono text-[9px] uppercase tracking-wider avatar-tb-muted">Ring</span>
			<input
				type="number"
				min="0"
				max="24"
				step="1"
				value={ringPx}
				class="avatar-tb-input h-8 w-12 rounded-md border px-1.5 text-xs tabular-nums outline-none"
				style="
					border-color: var(--app-border);
					background: var(--app-surface-3);
					color: var(--app-text);
				"
				oninput={(e) => {
					const n = Number((e.target as HTMLInputElement).value);
					onRingWidth(Number.isFinite(n) ? Math.max(0, Math.min(24, Math.round(n))) : 0);
				}}
				aria-label="Ring border thickness in pixels"
			/>
		</label>

		<div class="w-px h-6 shrink-0 avatar-tb-div"></div>

		<label class="flex min-w-0 flex-1 items-center gap-1.5">
			<span class="sr-only">Circle text</span>
			<input
				type="text"
				value={label}
				placeholder={initialsHint(nameFallback) || 'ABC'}
				class="avatar-tb-input min-w-[72px] flex-1 rounded-lg border px-2 py-1.5 text-xs outline-none"
				style="
					border-color: var(--app-border);
					background: var(--app-surface-3);
					color: var(--app-text);
				"
				oninput={(e) => onLabel((e.target as HTMLInputElement).value)}
				title={labelTitle}
			/>
		</label>

		<button
			type="button"
			class="avatar-tb-btn flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors"
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

	.avatar-tb-btn:hover {
		background: color-mix(in oklab, var(--app-text) 6%, transparent);
	}
	:root[data-theme='dark'] .avatar-tb-btn:hover {
		background: rgba(255, 255, 255, 0.05);
	}

	.avatar-tb-on {
		background: color-mix(in oklab, var(--color-violet) 18%, transparent);
		color: var(--color-violet);
	}
	:root[data-theme='dark'] .avatar-tb-on {
		background: rgba(139, 92, 246, 0.2);
		color: rgba(167, 139, 250, 1);
	}

	.avatar-tb-input:focus {
		border-color: rgba(139, 92, 246, 0.45);
	}
</style>
