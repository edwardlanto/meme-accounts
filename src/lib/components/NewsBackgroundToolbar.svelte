<script lang="ts">
	import { Scissors, ImagePlus, Palette, Sparkles, Trash2 } from 'lucide-svelte';
	import { Popover, PopoverContent, PopoverTrigger } from '$lib/components/ui/popover';
	import { cn } from '$lib/utils.js';

	const DEFAULT_SOLID_PRESETS = [
		'#0a0a0a',
		'#111827',
		'#1e1b4b',
		'#0c4a6e',
		'#134e4a',
		'#4c1d95',
		'#831843',
		'#ffffff',
		'#f8fafc',
	] as const;

	type Props = {
		anchor: DOMRect | null;
		/** Show “Cut out subject” — only for photo backgrounds */
		showCutout: boolean;
		/** Show delete — when slide has a photo or video background */
		showDelete?: boolean;
		/** @deprecated Kept for compatibility; label is always “Image / video”. */
		isVideoBackground?: boolean;
		/** Optional: generate / regenerate background via AI */
		onAi?: () => void;
		aiDisabled?: boolean;
		onCutOut: () => void;
		onReplace: () => void;
		onDelete?: () => void;
		onClose: () => void;
		/** Solid fill — clears photo/video and applies canvas hex */
		onApplySolid?: (hex: string) => void;
		/** Swatches for solid popover; defaults match studio `NEWS_SOLID_PRESETS` */
		solidPresets?: readonly string[];
	};

	let {
		anchor,
		showCutout,
		showDelete = false,
		isVideoBackground = false,
		onAi,
		aiDisabled = false,
		onCutOut,
		onReplace,
		onDelete,
		onClose,
		onApplySolid,
		solidPresets = DEFAULT_SOLID_PRESETS,
	}: Props = $props();

	let solidPopoverOpen = $state(false);
	let customHex = $state('#0a0a0a');
	let shellEl = $state<HTMLDivElement | null>(null);
	let measuredW = $state(0);

	const TOOLBAR_H = 48;

	const pos = $derived.by(() => {
		if (!anchor) return { top: 0, left: 0, show: false };
		let tw = measuredW;
		if (tw < 40) {
			tw = showCutout ? 280 : 180;
			if (onAi) tw += 72;
			if (onApplySolid) tw += 88;
			tw += 110; // “Image / video”
			if (showDelete && onDelete) tw += 48;
		}
		const vw = typeof window !== 'undefined' ? window.innerWidth : 1200;
		const vh = typeof window !== 'undefined' ? window.innerHeight : 800;
		const gap = 10;
		/* Prefer just below the trigger (dock button / click); flip above only if needed. */
		let top = anchor.bottom + gap;
		if (top + TOOLBAR_H > vh - 12) {
			top = Math.max(12, anchor.top - TOOLBAR_H - gap);
		}
		let left = anchor.left + anchor.width / 2 - tw / 2;
		left = Math.max(12, Math.min(left, vw - tw - 12));
		return { top, left, show: true };
	});

	$effect(() => {
		if (!anchor || !shellEl) {
			measuredW = 0;
			return;
		}
		const sync = () => {
			const w = shellEl?.offsetWidth ?? 0;
			if (w > 0) measuredW = w;
		};
		sync();
		const id = requestAnimationFrame(sync);
		return () => cancelAnimationFrame(id);
	});

	function handleDocDown(ev: MouseEvent) {
		const t = ev.target;
		if (!(t instanceof Element)) return;
		if (t.closest('[data-news-bg-toolbar]')) return;
		/* Portaled solid-color popover — don’t close BG bar when picking a swatch */
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

	function pickSolid(hex: string) {
		onApplySolid?.(hex);
		solidPopoverOpen = false;
		onClose();
	}
</script>

{#if pos.show}
	<div
		bind:this={shellEl}
		data-floating-toolbar
		data-news-bg-toolbar
		class="ftb-shell fixed z-[65] flex h-12 w-max max-w-[calc(100vw-24px)] items-center gap-1 overflow-hidden rounded-2xl px-2 py-1.5 shadow-2xl backdrop-blur-md"
		style="top: {pos.top}px; left: {pos.left}px;"
		role="toolbar"
		tabindex="-1"
		aria-label="Background"
		onmousedown={(e) => e.stopPropagation()}
	>
		{#if onAi}
			<button
				type="button"
				class="ftb-btn flex h-9 shrink-0 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold transition-colors"
				disabled={aiDisabled}
				onclick={() => {
					onAi?.();
					onClose();
				}}
			>
				<Sparkles size={13} class="text-[#7bf1a8]" strokeWidth={2} />
				<span class="ftb-strong">AI</span>
			</button>
			<div class="ftb-div h-6 w-px shrink-0" role="separator"></div>
		{/if}
		{#if showCutout}
			<button
				type="button"
				class="ftb-btn flex h-9 shrink-0 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold transition-colors"
				onclick={() => {
					onCutOut();
					onClose();
				}}
			>
				<Scissors size={13} class="text-emerald-500" strokeWidth={2} />
				<span class="ftb-strong hidden sm:inline">Cut out subject</span>
				<span class="ftb-strong sm:hidden">Cut out</span>
			</button>
			<div class="ftb-div h-6 w-px shrink-0" role="separator"></div>
		{/if}
		{#if onApplySolid}
			<Popover
				bind:open={solidPopoverOpen}
				onOpenChange={(o) => {
					if (!o) solidPopoverOpen = false;
				}}
			>
				<PopoverTrigger
					class={cn(
						'ftb-btn inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold transition-colors outline-none',
					)}
					onmousedown={(e) => e.stopPropagation()}
				>
					<Palette size={13} class="text-amber-500" strokeWidth={2} />
					<span class="ftb-strong hidden sm:inline">Solid</span>
				</PopoverTrigger>
				<PopoverContent
					class="z-[70] w-[220px] gap-0 border-border p-3 shadow-lg"
					align="center"
					side="bottom"
					sideOffset={8}
					onmousedown={(e) => e.stopPropagation()}
				>
					<p class="mb-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
						Solid fill
					</p>
					<div class="grid grid-cols-3 gap-2">
						{#each solidPresets as p (p)}
							<button
								type="button"
								class="h-9 w-9 shrink-0 rounded-full border border-border ring-offset-background transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
								style="background-color: {p}"
								aria-label="Use color {p}"
								onclick={() => pickSolid(p)}
							></button>
						{/each}
					</div>
					<div class="mt-3 flex items-center gap-2 border-t border-border pt-3">
						<label class="shrink-0 font-mono text-[10px] text-muted-foreground" for="news-bg-solid-custom"
							>Custom</label
						>
						<input
							id="news-bg-solid-custom"
							type="color"
							class="h-9 min-w-0 flex-1 cursor-pointer rounded-md border border-border bg-transparent p-0.5"
							bind:value={customHex}
							onchange={(e) => pickSolid((e.currentTarget as HTMLInputElement).value)}
						/>
					</div>
				</PopoverContent>
			</Popover>
			<div class="ftb-div h-6 w-px shrink-0" role="separator"></div>
		{/if}
		<button
			type="button"
			class="ftb-btn flex h-9 shrink-0 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold transition-colors"
			title="Upload a photo or video background"
			onclick={() => {
				onReplace();
				onClose();
			}}
		>
			<ImagePlus size={13} class="text-[#1a7a4c]" strokeWidth={2} />
			<span class="ftb-strong hidden sm:inline">Image / video</span>
			<span class="ftb-strong sm:hidden">Media</span>
		</button>
		{#if showDelete && onDelete}
			<div class="ftb-div h-6 w-px shrink-0" role="separator"></div>
			<button
				type="button"
				class="ftb-btn ftb-danger flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors"
				title="Delete background"
				aria-label="Delete background"
				onpointerdown={(e) => {
					e.preventDefault();
					e.stopPropagation();
					onDelete();
					onClose();
				}}
			>
				<Trash2 size={13} class="text-red-600" />
			</button>
		{/if}
	</div>
{/if}

<style>
	.ftb-shell {
		background: var(--app-surface-2);
		border: 1px solid var(--app-border);
		border-radius: 16px;
	}
	:root[data-theme='dark'] .ftb-shell {
		background: rgba(26, 26, 26, 0.95);
		border-color: rgba(255, 255, 255, 0.1);
	}
	.ftb-div {
		background: color-mix(in oklab, var(--app-text) 12%, transparent);
	}
	:root[data-theme='dark'] .ftb-div {
		background: rgba(255, 255, 255, 0.1);
	}

	.ftb-btn:hover {
		background: color-mix(in oklab, var(--app-text) 6%, transparent);
	}
	:root[data-theme='dark'] .ftb-btn:hover {
		background: rgba(255, 255, 255, 0.05);
	}

	.ftb-strong {
		color: var(--app-text);
	}
	.ftb-muted {
		color: var(--app-text-2);
	}
	.ftb-danger {
		color: #dc2626;
	}
	.ftb-btn.ftb-danger:hover {
		background: color-mix(in oklab, #dc2626 10%, transparent);
		color: #b91c1c;
	}
	:root[data-theme='dark'] .ftb-strong {
		color: rgba(255, 255, 255, 0.92);
	}
	:root[data-theme='dark'] .ftb-muted {
		color: rgba(255, 255, 255, 0.55);
	}
	:root[data-theme='dark'] .ftb-danger {
		color: #f87171;
	}
	:root[data-theme='dark'] .ftb-btn.ftb-danger:hover {
		background: rgba(248, 113, 113, 0.12);
		color: #fca5a5;
	}
</style>
