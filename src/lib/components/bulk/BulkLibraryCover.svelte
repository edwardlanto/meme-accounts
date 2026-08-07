<script lang="ts">
	import type { BulkSlide } from '$lib/studio/bulk-to-studio';
	import {
		coverSlideFromCardSummary,
		slimBulkCoverSlide,
	} from '$lib/studio/bulk-to-studio';
	import { optimizeImageUrl } from '$lib/client/optimize-image-url';

	type Props = {
		/** Slim first-slide from the list API (preferred). */
		coverSlide?: BulkSlide | null;
		/** Fallback fields when coverSlide is missing. */
		thumb?: string;
		headline?: string;
		template?: string;
		showId?: string;
	};

	let {
		coverSlide = null,
		thumb = '',
		headline = '',
		template = 'news',
		showId = '',
	}: Props = $props();

	let hostEl = $state<HTMLElement | null>(null);
	/** True once the card is near the viewport — mounts the live template. */
	let live = $state(false);
	let previewW = $state(0);

	const slide = $derived.by(() => {
		const slim = slimBulkCoverSlide(coverSlide);
		if (slim) return slim;
		return coverSlideFromCardSummary({
			id: showId,
			template,
			headline,
			thumb,
		});
	});

	const fallbackSrc = $derived.by(() => {
		const raw =
			String(slide?.mediaThumb || slide?.mediaUrl || thumb || '').trim() || '';
		return raw ? optimizeImageUrl(raw, Math.max(320, previewW * 2 || 560)) : '';
	});

	const fallbackHeadline = $derived(
		String(slide?.headline || headline || '').trim() || 'Untitled',
	);

	$effect(() => {
		const el = hostEl;
		if (!el || typeof IntersectionObserver === 'undefined') {
			live = true;
			return;
		}

		const ro =
			typeof ResizeObserver !== 'undefined'
				? new ResizeObserver((entries) => {
						const w = entries[0]?.contentRect?.width ?? 0;
						if (w > 0 && Math.abs(w - previewW) >= 2) {
							previewW = Math.round(w);
						}
					})
				: null;
		ro?.observe(el);
		if (!previewW) {
			const w = el.getBoundingClientRect().width;
			if (w > 0) previewW = Math.round(w);
		}

		const io = new IntersectionObserver(
			(entries) => {
				const e = entries[0];
				if (!e) return;
				if (e.isIntersecting) {
					live = true;
					return;
				}
				// Tear down only when far off-screen to avoid scroll thrash.
				const rect = e.boundingClientRect;
				const vh = typeof window !== 'undefined' ? window.innerHeight : 800;
				if (rect.bottom < -900 || rect.top > vh + 900) {
					live = false;
				}
			},
			{ root: null, rootMargin: '220px 0px', threshold: 0 },
		);
		io.observe(el);

		return () => {
			ro?.disconnect();
			io.disconnect();
		};
	});
</script>

<div class="bulk-lib-cover" bind:this={hostEl} aria-hidden="true">
	{#if live && slide && previewW > 0}
		{#await import('$lib/components/bulk/BulkSlidePreview.svelte')}
			{#if fallbackSrc}
				<img
					class="bulk-lib-fallback-img"
					src={fallbackSrc}
					alt=""
					loading="lazy"
					decoding="async"
					draggable="false"
				/>
			{:else}
				<p class="bulk-lib-fallback-text">{fallbackHeadline}</p>
			{/if}
		{:then mod}
			{@const BulkSlidePreview = mod.default}
			<div class="bulk-lib-cover-fit">
				<BulkSlidePreview
					{slide}
					width={previewW}
					preferThumb={true}
					textHighlightsEnabled={true}
				/>
			</div>
		{:catch}
			{#if fallbackSrc}
				<img class="bulk-lib-fallback-img" src={fallbackSrc} alt="" loading="lazy" draggable="false" />
			{:else}
				<p class="bulk-lib-fallback-text">{fallbackHeadline}</p>
			{/if}
		{/await}
	{:else if fallbackSrc}
		<img
			class="bulk-lib-fallback-img"
			src={fallbackSrc}
			alt=""
			loading="lazy"
			decoding="async"
			draggable="false"
		/>
		<div class="bulk-lib-fallback-scrim"></div>
		<p class="bulk-lib-fallback-text">{fallbackHeadline}</p>
	{:else}
		<p class="bulk-lib-fallback-text">{fallbackHeadline}</p>
	{/if}
</div>

<style>
	.bulk-lib-cover {
		position: absolute;
		inset: 0;
		overflow: hidden;
		background: #0a0a0a;
		/* Skip layout/paint work for off-screen cards in supporting browsers. */
		content-visibility: auto;
		contain-intrinsic-size: 240px 300px;
	}
	.bulk-lib-cover-fit {
		position: absolute;
		left: 50%;
		top: 50%;
		transform: translate(-50%, -50%);
		line-height: 0;
	}
	.bulk-lib-cover-fit :global(.bulk-preview) {
		border-radius: 0;
		box-shadow: none;
	}
	.bulk-lib-fallback-img {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	.bulk-lib-fallback-scrim {
		position: absolute;
		inset: 0;
		background: linear-gradient(to bottom, rgba(0, 0, 0, 0.12), rgba(0, 0, 0, 0.55));
		pointer-events: none;
	}
	.bulk-lib-fallback-text {
		position: absolute;
		left: 0.85rem;
		right: 0.85rem;
		bottom: 0.85rem;
		z-index: 1;
		margin: 0;
		font-size: 14px;
		font-weight: 700;
		line-height: 1.25;
		color: #f5f5f5;
		text-shadow: 0 1px 14px rgba(0, 0, 0, 0.45);
		display: -webkit-box;
		line-clamp: 4;
		-webkit-line-clamp: 4;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}
</style>
