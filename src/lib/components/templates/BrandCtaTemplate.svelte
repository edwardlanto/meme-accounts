<script lang="ts">
	interface Props {
		image?: string;
		headline?: string;
		subline?: string;
		canvasW?: number;
		canvasH?: number;
		scale?: number;
		exportRef?: HTMLElement | null;
	}

	let {
		image = '',
		headline = 'If you like this content',
		subline = 'Follow for more',
		canvasW = 1080,
		canvasH = 1350,
		scale = 1,
		exportRef = $bindable(null),
	}: Props = $props();

	const hasImage = $derived(!!String(image ?? '').trim());
</script>

<div
	bind:this={exportRef}
	class="brand-cta-root"
	style="width: {canvasW}px; height: {canvasH}px; transform: scale({scale}); transform-origin: top left;"
	data-studio-canvas-root
>
	{#if hasImage}
		<img class="brand-cta-bg" src={image} alt="" />
	{:else}
		<div class="brand-cta-bg brand-cta-bg-fallback"></div>
	{/if}
	<div class="brand-cta-scrim" aria-hidden="true"></div>

	<div class="brand-cta-copy">
		<p class="brand-cta-headline">{headline || 'If you like this content'}</p>
		<p class="brand-cta-subline">{subline || 'Follow for more'}</p>
	</div>
</div>

<style>
	.brand-cta-root {
		position: relative;
		overflow: hidden;
		border-radius: 1rem;
		background: #0a0a0a;
	}

	.brand-cta-bg {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.brand-cta-bg-fallback {
		background: linear-gradient(160deg, #1e1b4b 0%, #0f172a 45%, #020617 100%);
	}

	.brand-cta-scrim {
		position: absolute;
		inset: 0;
		background: linear-gradient(
			to top,
			rgba(0, 0, 0, 0.82) 0%,
			rgba(0, 0, 0, 0.45) 42%,
			rgba(0, 0, 0, 0.25) 100%
		);
	}

	.brand-cta-copy {
		position: absolute;
		inset: 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: flex-end;
		gap: 0.65rem;
		padding: 0 8% 14%;
		text-align: center;
		z-index: 2;
	}

	.brand-cta-headline {
		margin: 0;
		font-family: 'Satoshi', ui-sans-serif, system-ui, sans-serif;
		font-size: 56px;
		font-weight: 800;
		line-height: 1.08;
		letter-spacing: -0.02em;
		color: #fff;
		max-width: 92%;
		white-space: pre-wrap;
	}

	.brand-cta-subline {
		margin: 0;
		font-family: 'Satoshi', ui-sans-serif, system-ui, sans-serif;
		font-size: 34px;
		font-weight: 700;
		line-height: 1.2;
		color: #fbbf24;
		max-width: 92%;
		white-space: pre-wrap;
	}
</style>
