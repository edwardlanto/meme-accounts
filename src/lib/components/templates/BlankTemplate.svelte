<script lang="ts">
	import type { Overlay } from '$lib/types';
	import ImageStickerOverlayBox from '$lib/components/ImageStickerOverlayBox.svelte';

	interface Props {
		w?: number;
		h?: number;
		scale?: number;
		interactive?: boolean;
		backgroundImage?: string;
		backgroundVideo?: string;
		solidBackgroundColor?: string;
		overlays?: Overlay[];
		/** Bound by Studio for PNG export */
		exportRef?: HTMLElement | null;
	}

	let {
		w = 1080,
		h = 1350,
		scale = 1,
		interactive = true,
		backgroundImage = '',
		backgroundVideo = '',
		solidBackgroundColor = '#ffffff',
		overlays = [],
		exportRef = null,
	}: Props = $props();

	const showVideo = $derived(!!String(backgroundVideo ?? '').trim());
	const showImage = $derived(!showVideo && !!String(backgroundImage ?? '').trim());
</script>

<!-- Minimal canvas shell: background + stickers. Text overlays render via StudioTextOverlays above this. -->
<div
	class="relative overflow-hidden rounded-2xl"
	style="
		width: {w}px;
		height: {h}px;
		transform: scale({scale});
		transform-origin: top left;
		background: {solidBackgroundColor || '#ffffff'};
	"
	bind:this={exportRef}
	data-studio-canvas-root
>
	{#if showVideo}
		<video
			class="absolute inset-0 w-full h-full object-cover"
			src={backgroundVideo}
			playsinline
			muted
			loop
			autoplay
		/>
	{:else if showImage}
		<img
			class="absolute inset-0 w-full h-full object-cover"
			src={backgroundImage}
			alt=""
			draggable="false"
		/>
	{/if}

	{#each overlays ?? [] as o (o.id)}
		<ImageStickerOverlayBox
			overlay={o}
			interactive={interactive}
			w={w}
			h={h}
			onChange={() => {}}
			onRemove={() => {}}
		/>
	{/each}
</div>

