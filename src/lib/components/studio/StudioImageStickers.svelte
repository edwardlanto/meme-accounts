<script lang="ts">
	import ImageStickerOverlayLayer from '$lib/components/ImageStickerOverlayLayer.svelte';
	import type { Overlay } from '$lib/types';

	interface Props {
		w: number;
		h: number;
		scale?: number;
		interactive?: boolean;
		overlays: Overlay[];
		onOverlaysChange?: (next: Overlay[]) => void;
		resolveSrc?: (src: string) => string;
	}

	let {
		w,
		h,
		scale = 1,
		interactive = true,
		overlays,
		onOverlaysChange,
		resolveSrc,
	}: Props = $props();
</script>

<ImageStickerOverlayLayer
	{w}
	{h}
	{scale}
	{interactive}
	overlays={overlays ?? []}
	{onOverlaysChange}
	{resolveSrc}
/>
