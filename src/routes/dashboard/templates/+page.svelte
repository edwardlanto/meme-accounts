<script lang="ts">
	import { onMount } from 'svelte';
	import { STARTER_TEMPLATES } from '$lib/templates';
	import StarterTemplateGrid from '$lib/components/templates/StarterTemplateGrid.svelte';

	let mounted = $state(false);
	onMount(() => {
		mounted = true;
	});
</script>

<div class="page-wrap" class:mounted>
	<header class="page-hero">
		<div class="page-hero-text">
			<div class="page-eyebrow">
				<span class="page-eyebrow-dot"></span>
				<span>Library</span>
			</div>
			<h1 class="page-title">Templates</h1>
			<p class="page-sub">Pick a layout to open in Studio. Your saved work lives under Carousels.</p>
		</div>
		<a href="/dashboard/carousels" class="ma-btn ma-btn-primary">Your carousels →</a>
	</header>

	<section class="templates-section reveal" style="--d:0.05s">
		<div class="section-head">
			<h2 class="section-title">Start from a template</h2>
			<p class="section-sub">
				Hand‑crafted layouts that open straight into Studio — {STARTER_TEMPLATES.length} templates.
			</p>
		</div>
		<StarterTemplateGrid templates={STARTER_TEMPLATES} />
	</section>
</div>

<style>
	:root:not([data-theme='dark']) {
		--ap-text: #0f0f10;
		--ap-text-2: #5b5b62;
		--ap-soft: #f6f7f9;
		--ap-bg: #ffffff;
		--panel-bg: #ffffff;
		--panel-bg-2: #f6f7f9;
		--panel-border: rgba(15, 15, 16, 0.08);
		--t-strong: var(--ap-text);
		--t: var(--ap-text-2);
		--shadow-soft: 0 1px 2px rgba(15, 15, 16, 0.04), 0 8px 22px -10px rgba(15, 15, 16, 0.1);
	}
	:root[data-theme='dark'] {
		--ap-text: #f5f5f5;
		--ap-text-2: rgba(245, 245, 245, 0.66);
		--ap-soft: #161616;
		--ap-bg: #0a0a0a;
		--panel-bg: rgba(255, 255, 255, 0.025);
		--panel-bg-2: rgba(255, 255, 255, 0.045);
		--panel-border: rgba(255, 255, 255, 0.07);
		--t-strong: var(--ap-text);
		--t: var(--ap-text-2);
		--shadow-soft: 0 1px 0 rgba(255, 255, 255, 0.04) inset, 0 12px 28px -16px rgba(0, 0, 0, 0.55);
	}

	.page-wrap {
		padding: 32px 32px 64px;
		max-width: 1560px;
		margin: 0 auto;
		font-family: 'Satoshi', -apple-system, BlinkMacSystemFont, sans-serif;
	}
	.reveal {
		opacity: 0;
		transform: translateY(14px);
		transition:
			opacity 0.7s cubic-bezier(0.16, 1, 0.3, 1) var(--d, 0s),
			transform 0.7s cubic-bezier(0.16, 1, 0.3, 1) var(--d, 0s);
	}
	.page-wrap.mounted .reveal {
		opacity: 1;
		transform: none;
	}
	.page-hero {
		display: flex;
		align-items: flex-end;
		justify-content: space-between;
		gap: 24px;
		flex-wrap: wrap;
		margin-bottom: 36px;
	}
	.page-hero-text {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	.page-eyebrow {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		padding: 5px 12px 5px 10px;
		width: fit-content;
		border-radius: 999px;
		background: var(--panel-bg-2);
		border: 1px solid var(--panel-border);
		color: var(--t);
		font-size: 11px;
		font-weight: 600;
		letter-spacing: 0.06em;
		text-transform: uppercase;
	}
	.page-eyebrow-dot {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: #7bf1a8;
		box-shadow: 0 0 0 3px rgba(123, 241, 168, 0.22);
	}
	.page-title {
		font-size: clamp(28px, 3.4vw, 42px);
		font-weight: 800;
		letter-spacing: -0.025em;
		color: var(--t-strong);
		margin: 0;
		line-height: 1.05;
	}
	.page-sub {
		font-size: 14px;
		line-height: 1.55;
		color: var(--t);
		margin: 0;
		max-width: 60ch;
	}
	.section-head {
		margin-bottom: 16px;
	}
	.section-title {
		font-size: 18px;
		font-weight: 800;
		letter-spacing: -0.02em;
		color: var(--t-strong);
		margin: 0 0 4px;
	}
	.section-sub {
		font-size: 13px;
		line-height: 1.5;
		color: var(--t);
		margin: 0;
	}
	.templates-section {
		margin-bottom: 32px;
	}
</style>
