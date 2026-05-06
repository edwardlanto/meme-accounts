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
	}

	let {
		w,
		h,
		scale = 1,
		interactive = true,
		overlays,
		onOverlaysChange,
	}: Props = $props();
</script>

<ImageStickerOverlayLayer {w} {h} {scale} {interactive} overlays={overlays ?? []} {onOverlaysChange} />
