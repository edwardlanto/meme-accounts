<script lang="ts">
	import type { Overlay } from '$lib/types';
	import ImageStickerOverlayBox from '$lib/components/ImageStickerOverlayBox.svelte';

	interface Props {
		w: number;
		h: number;
		scale?: number;
		interactive?: boolean;
		overlays?: Overlay[];
		onOverlaysChange?: (next: Overlay[]) => void;
	}

	let {
		w,
		h,
		scale = 1,
		interactive = true,
		overlays = [],
		onOverlaysChange,
	}: Props = $props();

	const W = $derived(Math.max(1, Number(w) || 1080));
	const H = $derived(Math.max(1, Number(h) || 1350));
</script>

<!-- Matches TextOverlayLayer geometry: above template, below text overlays (z-80). -->
<div
	style="
		position: absolute;
		inset: 0;
		z-index: 70;
		width: 100%;
		height: 100%;
		pointer-events: none;
	"
	aria-hidden={overlays.length === 0}
>
	<div
		style="
			width: {W}px;
			height: {H}px;
			position: relative;
			transform: scale({scale});
			transform-origin: top left;
			pointer-events: none;
		"
	>
		{#each overlays as overlay (overlay.id)}
			{#if overlay.kind !== 'grid'}
				<ImageStickerOverlayBox
					{overlay}
					{overlays}
					w={W}
					h={H}
					{scale}
					{interactive}
					{onOverlaysChange}
				/>
			{/if}
		{/each}
	</div>
</div>
