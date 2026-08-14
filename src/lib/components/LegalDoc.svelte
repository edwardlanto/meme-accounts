<script lang="ts">
	import type { Snippet } from 'svelte';
	import MarketingNav from '$lib/components/MarketingNav.svelte';
	import MarketingFooter from '$lib/components/MarketingFooter.svelte';

	let {
		title,
		effectiveDate,
		children,
	}: {
		title: string;
		effectiveDate: string;
		children: Snippet;
	} = $props();
</script>

<MarketingNav />

<main class="wrap">
	<article class="doc">
		<a class="back" href="/">← Home</a>
		<nav class="legal-nav" aria-label="Legal">
			<a href="/privacy">Privacy</a>
			<a href="/terms">Terms</a>
			<a href="/refund-policy">Refunds</a>
		</nav>

		<h1>{title}</h1>
		<p class="meta">Effective date: {effectiveDate}</p>

		{@render children()}
	</article>
</main>

<MarketingFooter />

<style>
	.wrap {
		min-height: auto;
		background: var(--mk-soft);
		color: var(--mk-text);
		font-family: var(--font-body);
		padding: 48px 24px 96px;
	}
	.doc {
		max-width: 720px;
		margin: 0 auto;
		line-height: 1.65;
	}
	.back {
		display: inline-block;
		margin-bottom: 16px;
		font-size: 13px;
		color: rgba(10, 5, 5, 0.55);
		text-decoration: none;
	}
	.back:hover {
		color: #0a0505;
	}
	.legal-nav {
		display: flex;
		flex-wrap: wrap;
		gap: 16px;
		margin-bottom: 32px;
		font-size: 13px;
	}
	.legal-nav a {
		color: rgba(10, 5, 5, 0.55);
		text-decoration: none;
		font-weight: 600;
	}
	.legal-nav a:hover {
		color: #0a0505;
	}
	:global(.doc h2) {
		font-family: var(--font-display);
		font-size: 20px;
		font-weight: 700;
		margin: 36px 0 10px;
		color: #0a0505;
	}
	:global(.doc p) {
		font-size: 15px;
		color: rgba(10, 5, 5, 0.72);
		margin: 0 0 12px;
	}
	:global(.doc ul) {
		margin: 0 0 16px;
		padding-left: 20px;
	}
	:global(.doc li) {
		font-size: 15px;
		color: rgba(10, 5, 5, 0.72);
		margin-bottom: 6px;
	}
	:global(.doc a) {
		color: #0a0505;
		font-weight: 600;
		text-decoration: underline;
		text-decoration-color: rgba(232, 255, 72, 0.9);
		text-underline-offset: 3px;
	}
	h1 {
		font-family: var(--font-display);
		font-size: clamp(32px, 5vw, 44px);
		font-weight: 700;
		letter-spacing: -0.02em;
		margin: 0 0 8px;
	}
	.meta {
		font-size: 13px;
		color: rgba(10, 5, 5, 0.45);
		margin: 0 0 48px;
	}
</style>
