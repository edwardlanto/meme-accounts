<script lang="ts">
	import { Scissors, ImagePlus, Clapperboard, Palette, Sparkles } from 'lucide-svelte';
	import { Button } from '$lib/components/ui/button';
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
		/** Photo vs video replace label */
		isVideoBackground: boolean;
		/** Optional: generate / regenerate background via AI */
		onAi?: () => void;
		aiDisabled?: boolean;
		onCutOut: () => void;
		onReplace: () => void;
		onClose: () => void;
		/** Solid fill — clears photo/video and applies canvas hex */
		onApplySolid?: (hex: string) => void;
		/** Swatches for solid popover; defaults match studio `NEWS_SOLID_PRESETS` */
		solidPresets?: readonly string[];
	};

	let {
		anchor,
		showCutout,
		isVideoBackground,
		onAi,
		aiDisabled = false,
		onCutOut,
		onReplace,
		onClose,
		onApplySolid,
		solidPresets = DEFAULT_SOLID_PRESETS,
	}: Props = $props();

	let solidPopoverOpen = $state(false);
	let customHex = $state('#0a0a0a');

	const TOOLBAR_H = 44;

	const pos = $derived.by(() => {
		if (!anchor) return { top: 0, left: 0, show: false };
		let tw = showCutout ? 300 : 200;
		if (onAi) tw += 128;
		if (onApplySolid) tw += 108;
		const vw = typeof window !== 'undefined' ? window.innerWidth : 1200;
		let top = anchor.top - TOOLBAR_H - 14;
		if (top < 12) top = anchor.bottom + 14;
		let left = anchor.left + anchor.width / 2 - tw / 2;
		left = Math.max(12, Math.min(left, vw - tw - 12));
		return { top, left, show: true };
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

	/** Same chrome + motion as News circle `PopoverContent` (rounded pill, zoom/fade). */
	const shellClass =
		'border-border bg-popover/95 text-foreground !flex !w-max max-w-[calc(100vw-2rem)] !flex-row flex-nowrap items-center gap-1.5 overflow-x-auto rounded-full border p-2 shadow-lg ring-1 ring-border/40 backdrop-blur-md duration-100 data-[side=top]:slide-in-from-bottom-2 data-[state=closed]:animate-out data-[state=open]:animate-in data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 !gap-1.5 !p-2 [&_svg]:shrink-0 [&_svg]:text-foreground';

	function pickSolid(hex: string) {
		onApplySolid?.(hex);
		solidPopoverOpen = false;
		onClose();
	}
</script>

{#if pos.show}
	<div
		data-floating-toolbar
		data-news-bg-toolbar
		class={cn('fixed z-[65]', shellClass)}
		style="top: {pos.top}px; left: {pos.left}px; min-height: {TOOLBAR_H}px;"
		role="toolbar"
		tabindex="-1"
		aria-label="Background"
		onmousedown={(e) => e.stopPropagation()}
	>
		<span class="text-muted-foreground shrink-0 pl-1 font-mono text-[9px] uppercase tracking-wider">
			BG
		</span>
		<div class="bg-border h-7 w-px shrink-0" role="separator"></div>
		{#if onAi}
			<Button
				variant="ghost"
				size="sm"
				class="h-11 shrink-0 rounded-full px-3 text-xs font-semibold"
				disabled={aiDisabled}
				onclick={() => {
					onAi?.();
					onClose();
				}}
			>
				<Sparkles size={18} class="text-[#E8FF48]" strokeWidth={2} />
				AI bg
			</Button>
			<div class="bg-border h-7 w-px shrink-0" role="separator"></div>
		{/if}
		{#if showCutout}
			<Button
				variant="ghost"
				size="sm"
				class="h-11 shrink-0 rounded-full px-3 text-xs font-semibold"
				onclick={() => {
					onCutOut();
					onClose();
				}}
			>
				<Scissors size={18} class="text-emerald-500" strokeWidth={2} />
				<span class="hidden sm:inline">Cut out subject</span>
				<span class="sm:hidden">Cut out</span>
			</Button>
			<div class="bg-border h-7 w-px shrink-0" role="separator"></div>
		{/if}
		{#if onApplySolid}
			<Popover
				bind:open={solidPopoverOpen}
				onOpenChange={(o) => {
					if (!o) solidPopoverOpen = false;
				}}
			>
				<PopoverTrigger
					class="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-full px-3 text-xs font-semibold text-foreground outline-none ring-offset-background transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring"
					onmousedown={(e) => e.stopPropagation()}
				>
					<Palette size={18} class="text-amber-500" strokeWidth={2} />
					<span class="hidden sm:inline">Solid</span>
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
			<div class="bg-border h-7 w-px shrink-0" role="separator"></div>
		{/if}
		<Button
			variant="ghost"
			size="sm"
			class="h-11 shrink-0 rounded-full px-3 text-xs font-semibold"
			onclick={() => {
				onReplace();
				onClose();
			}}
		>
			{#if isVideoBackground}
				<Clapperboard size={18} class="text-cyan-500" strokeWidth={2} />
				Replace video
			{:else}
				<ImagePlus size={18} class="text-violet-500" strokeWidth={2} />
				Replace image
			{/if}
		</Button>
	</div>
{/if}
