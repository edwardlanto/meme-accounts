<script lang="ts">
	import { Scissors, ImagePlus, Clapperboard } from 'lucide-svelte';
	import { Button } from '$lib/components/ui/button';
	import { cn } from '$lib/utils.js';

	type Props = {
		anchor: DOMRect | null;
		/** Show “Cut out subject” — only for photo backgrounds */
		showCutout: boolean;
		/** Photo vs video replace label */
		isVideoBackground: boolean;
		onCutOut: () => void;
		onReplace: () => void;
		onClose: () => void;
	};

	let {
		anchor,
		showCutout,
		isVideoBackground,
		onCutOut,
		onReplace,
		onClose,
	}: Props = $props();

	const TOOLBAR_H = 44;

	const pos = $derived.by(() => {
		if (!anchor) return { top: 0, left: 0, show: false };
		const tw = showCutout ? 300 : 200;
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
</script>

{#if pos.show}
	<div
		data-floating-toolbar
		data-news-bg-toolbar
		data-slot="popover-content"
		data-state="open"
		data-side="top"
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
