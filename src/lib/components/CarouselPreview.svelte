<script lang="ts">
	import type { Snippet } from 'svelte';
	import { ChevronLeft, ChevronRight } from 'lucide-svelte';

	interface Props {
		/** Total slide count. */
		count: number;
		/** Currently-featured slide (center card). */
		active: number;
		/** Template pixel size (for aspect ratio). */
		canvasW: number;
		canvasH: number;
		/** Width in px of the center (featured) card. Side cards scale down. */
		centerWidth?: number;
		/** Scale factor for the side peek cards, relative to center. */
		sideScale?: number;
		/** Horizontal gap between the cards, in px. */
		gap?: number;
		onActiveChange: (i: number) => void;
		/** Render a single slide. Receives 0-based index. */
		slide: Snippet<[{ index: number }]>;
	}

	let {
		count,
		active,
		canvasW,
		canvasH,
		centerWidth = 360,
		sideScale = 0.72,
		gap = 24,
		onActiveChange,
		slide,
	}: Props = $props();

	const aspect = $derived(canvasH / canvasW);
	const centerHeight = $derived(centerWidth * aspect);
	const sideWidth = $derived(centerWidth * sideScale);
	const sideHeight = $derived(centerHeight * sideScale);

	// Stage width: center + both side peeks + gaps
	const stageWidth = $derived(centerWidth + sideWidth * 2 + gap * 2);
	const stageHeight = $derived(centerHeight + 12);

	function go(delta: number) {
		const next = Math.max(0, Math.min(count - 1, active + delta));
		if (next !== active) onActiveChange(next);
	}

	function offsetFor(i: number) {
		const d = i - active;
		if (d === 0) return { x: 0, scale: 1, opacity: 1, z: 30, visible: true };
		if (d === -1) return { x: -(centerWidth / 2 + gap + sideWidth / 2), scale: sideScale, opacity: 0.85, z: 20, visible: true };
		if (d === 1)  return { x:  (centerWidth / 2 + gap + sideWidth / 2), scale: sideScale, opacity: 0.85, z: 20, visible: true };
		// Further slides: tuck further out, fade
		const dir = Math.sign(d);
		return {
			x: dir * (centerWidth / 2 + gap + sideWidth * 1.5),
			scale: sideScale * 0.9,
			opacity: 0,
			z: 10,
			visible: false,
		};
	}
</script>

<div class="flex flex-col items-center gap-4 select-none">
	<div
		class="relative flex items-center justify-center"
		style="width: {stageWidth}px; height: {stageHeight}px;"
	>
		<!-- Prev -->
		<button
			type="button"
			onclick={() => go(-1)}
			disabled={active === 0}
			class="absolute left-0 z-40 w-10 h-10 rounded-full bg-white/90 hover:bg-white text-neutral-800 shadow-lg flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed transition-all"
			aria-label="Previous slide"
		>
			<ChevronLeft size={18} />
		</button>

		<!-- Slides -->
		{#each Array.from({ length: count }, (_, i) => i) as i (i)}
			{@const o = offsetFor(i)}
			<button
				type="button"
				onclick={() => onActiveChange(i)}
				class="absolute rounded-[28px] overflow-hidden shadow-2xl transition-all duration-500 ease-out bg-neutral-900 border border-black/10"
				style="
					width: {centerWidth}px;
					height: {centerHeight}px;
					transform: translateX({o.x}px) scale({o.scale});
					opacity: {o.opacity};
					z-index: {o.z};
					pointer-events: {o.visible ? 'auto' : 'none'};
					cursor: {i === active ? 'default' : 'pointer'};
				"
				aria-label={`Show slide ${i + 1}`}
			>
				<div
					class="absolute inset-0 origin-top-left"
					style="
						width: {canvasW}px;
						height: {canvasH}px;
						transform: scale({centerWidth / canvasW});
						pointer-events: none;
					"
				>
					{@render slide({ index: i })}
				</div>
			</button>
		{/each}

		<!-- Next -->
		<button
			type="button"
			onclick={() => go(1)}
			disabled={active === count - 1}
			class="absolute right-0 z-40 w-10 h-10 rounded-full bg-white/90 hover:bg-white text-neutral-800 shadow-lg flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed transition-all"
			aria-label="Next slide"
		>
			<ChevronRight size={18} />
		</button>
	</div>

	<!-- Pagination dots -->
	<div class="flex items-center gap-1.5">
		{#each Array.from({ length: count }, (_, i) => i) as i (i)}
			<button
				type="button"
				onclick={() => onActiveChange(i)}
				class="h-1.5 rounded-full transition-all {i === active ? 'w-6 bg-white/80' : 'w-1.5 bg-white/20 hover:bg-white/40'}"
				aria-label={`Go to slide ${i + 1}`}
			></button>
		{/each}
	</div>
</div>
