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
		onOverlaysChange?: (overlays: Overlay[]) => void;
		resolveSrc?: (src: string) => string;
		/** Click canvas to open BG tools. */
		onBackgroundDblClick?: (detail: { clientX: number; clientY: number }) => void;
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
		onOverlaysChange,
		resolveSrc,
		onBackgroundDblClick,
	}: Props = $props();

	const showVideo = $derived(!!String(backgroundVideo ?? '').trim());
	const showImage = $derived(!showVideo && !!String(backgroundImage ?? '').trim());

	function onCanvasClick(e: MouseEvent) {
		if (!interactive || !onBackgroundDblClick) return;
		e.stopPropagation();
		onBackgroundDblClick({ clientX: e.clientX, clientY: e.clientY });
	}
</script>

<!-- Minimal canvas shell: background + stickers. Parent Studio shell wraps this + StudioTextOverlays for export. -->
<div
	class="relative overflow-hidden rounded-2xl"
	data-studio-canvas-root
	style="
		width: {w}px;
		height: {h}px;
		transform: scale({scale});
		transform-origin: top left;
		background: {solidBackgroundColor || '#ffffff'};
	"
	onclick={onCanvasClick}
	title={interactive && onBackgroundDblClick ? 'Click for BG tools' : undefined}
	role={interactive && onBackgroundDblClick ? 'presentation' : undefined}
>
	{#if showVideo}
		<video
			class="absolute inset-0 h-full w-full object-cover"
			data-studio-bg-video="1"
			src={backgroundVideo}
			playsinline
			muted
			loop
			autoplay
			onloadeddata={(e) => {
				const el = e.currentTarget as HTMLVideoElement;
				el.loop = true;
				el.playsInline = true;
				void el.play().catch(() => {});
			}}
			oncanplay={(e) => {
				void (e.currentTarget as HTMLVideoElement).play().catch(() => {});
			}}
		></video>
	{:else if showImage}
		<img
			class="absolute inset-0 w-full h-full object-cover"
			src={backgroundImage}
			alt=""
			draggable="false"
		/>
	{/if}

	{#each overlays ?? [] as o (o.id)}
		{#if o.kind !== 'grid'}
			<ImageStickerOverlayBox
				overlay={o}
				{overlays}
				w={w}
				h={h}
				{scale}
				{interactive}
				{onOverlaysChange}
				{resolveSrc}
			/>
		{/if}
	{/each}
</div>
