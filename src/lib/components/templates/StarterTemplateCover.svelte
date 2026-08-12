<script lang="ts">
	import { carouselCoverUrls } from '$lib/templates';

	interface Props {
		previewBg: string;
	}

	let { previewBg }: Props = $props();

	const urls = $derived(carouselCoverUrls(previewBg));
	/** Always prefer mp4; fall back to png if the video is missing or fails. */
	let kind = $state<'video' | 'image'>('video');
	let src = $state('');

	$effect(() => {
		kind = 'video';
		src = urls.mp4;
	});
</script>

{#if kind === 'video'}
	<video
		src={src}
		class="cover-media"
		muted
		playsinline
		loop
		autoplay
		preload="metadata"
		draggable="false"
		aria-hidden="true"
		onerror={() => {
			kind = 'image';
			src = urls.png;
		}}
	></video>
{:else}
	<img {src} alt="" class="cover-media" loading="lazy" draggable="false" />
{/if}

<style>
	.cover-media {
		display: block;
		width: 100%;
		height: 100%;
		object-fit: contain;
		object-position: center;
		pointer-events: none;
		user-select: none;
		background: #0a0a0c;
	}
</style>
