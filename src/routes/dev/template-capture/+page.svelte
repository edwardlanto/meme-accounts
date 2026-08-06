<script lang="ts">
	import { page } from '$app/stores';
	import BulkSlidePreview from '$lib/components/bulk/BulkSlidePreview.svelte';
	import {
		createStarterPreviewSlide,
		STOCK_VIDEO_POSTER,
	} from '$lib/studio/starter-preview-slide';
	import { STARTER_TEMPLATES } from '$lib/templates';
	import type { BulkSlide } from '$lib/studio/bulk-to-studio';
	import type { TemplateId } from '$lib/studio/template-ids';

	/** Capture width — 4:5 feed frame (matches carousel cards). */
	const CAPTURE_W = 540;

	const idParam = $derived(String($page.url.searchParams.get('id') ?? '').trim());
	const templates = $derived(
		idParam
			? STARTER_TEMPLATES.filter((t) => t.id === idParam && t.id !== 'empty')
			: STARTER_TEMPLATES.filter((t) => t.id !== 'empty'),
	);

	/** Prefer poster stills so headless Chromium covers aren't black voids. */
	function slideForCapture(studioId: TemplateId): BulkSlide {
		const slide = createStarterPreviewSlide(studioId);
		if (slide.mediaKind !== 'video') return slide;
		return {
			...slide,
			mediaUrl: '',
			mediaThumb: slide.mediaThumb || STOCK_VIDEO_POSTER,
			mediaKind: 'video',
		};
	}
</script>

<svelte:head>
	<title>Template capture</title>
</svelte:head>

<div class="capture-page">
	{#each templates as tmpl (tmpl.id)}
		{@const slide = slideForCapture(tmpl.studioId as TemplateId)}
		<section class="capture-card" data-capture-id={tmpl.id} data-studio-id={tmpl.studioId}>
			<BulkSlidePreview {slide} width={CAPTURE_W} />
		</section>
	{/each}
</div>

<style>
	:global(html),
	:global(body) {
		margin: 0;
		background: #111;
	}

	.capture-page {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 48px;
		padding: 48px 24px 80px;
		min-height: 100vh;
		box-sizing: border-box;
	}

	.capture-card {
		display: inline-flex;
		background: #0a0a0c;
		/* Match carousel card crop: 4:5 */
		width: 540px;
		height: 675px;
		overflow: hidden;
		border-radius: 0;
	}

	.capture-card :global(.bulk-preview) {
		border-radius: 0 !important;
		box-shadow: none !important;
	}
</style>
