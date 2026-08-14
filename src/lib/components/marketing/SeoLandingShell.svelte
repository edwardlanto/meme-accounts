<script lang="ts">
	import type { Snippet } from 'svelte';
	import { ArrowRight } from 'lucide-svelte';
	import MarketingNav from '$lib/components/MarketingNav.svelte';
	import MarketingFooter from '$lib/components/MarketingFooter.svelte';
	import { Button } from '$lib/components/ui/button';
	import { initReveal } from '$lib/marketing/reveal';
	import { onMount } from 'svelte';

	let {
		eyebrow,
		title,
		accent,
		lead,
		ctaHref,
		ctaLabel,
		secondaryHref = '/pricing',
		secondaryLabel = 'See plans',
		image,
		imageAlt,
		featuresTitle = 'Built for the feed',
		features,
		faqs = [],
		children,
	}: {
		eyebrow: string;
		title: string;
		accent: string;
		lead: string;
		ctaHref: string;
		ctaLabel: string;
		secondaryHref?: string;
		secondaryLabel?: string;
		image?: string;
		imageAlt?: string;
		featuresTitle?: string;
		features: { title: string; body: string }[];
		faqs?: [string, string][];
		children?: Snippet;
	} = $props();

	onMount(() => initReveal());
</script>

<div class="marketing-page">
	<MarketingNav ctaHref={ctaHref} />

	<header class="marketing-section pb-8 pt-12">
		<div class="marketing-container text-center">
			<p class="mk-eyebrow justify-center">{eyebrow}</p>
			<h1 class="mk-hero-title max-w-none">
				{title} <em class="mk-hero-accent not-italic">{accent}</em>
			</h1>
			<p class="mk-hero-sub">{@html lead}</p>
			<div class="mk-hero-ctas">
				<Button href={ctaHref} size="marketing-lg">
					{ctaLabel}
					<ArrowRight size={16} />
				</Button>
				<Button href={secondaryHref} variant="outline" size="marketing-lg">{secondaryLabel}</Button>
			</div>
		</div>
	</header>

	{#if image}
		<section class="pb-12">
			<div class="marketing-container">
				<figure class="mk-reveal overflow-hidden rounded-[20px] border border-[var(--mk-line)] shadow-lg">
					<img src={image} alt={imageAlt ?? ''} class="block w-full" loading="eager" />
				</figure>
			</div>
		</section>
	{/if}

	<section class="marketing-section marketing-section--soft">
		<div class="marketing-container">
			<h2 class="mk-section-title mb-10 text-center">{featuresTitle}</h2>
			<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
				{#each features as feat, i}
					<div class="mk-card mk-reveal" style="--mk-delay:{i * 0.05}s">
						<h3 class="mk-feature-title">{feat.title}</h3>
						<p class="mk-feature-desc">{feat.body}</p>
					</div>
				{/each}
			</div>
		</div>
	</section>

	{#if children}
		{@render children()}
	{/if}

	{#if faqs.length}
		<section class="marketing-section">
			<div class="marketing-container">
				<h2 class="mk-section-title mb-8">FAQ</h2>
				<div class="mk-faq-list">
					{#each faqs as [q, a], i}
						<details class="mk-faq-item mk-reveal" style="--mk-delay:{i * 0.04}s">
							<summary>{q}</summary>
							<p class="mk-faq-answer">{a}</p>
						</details>
					{/each}
				</div>
			</div>
		</section>
	{/if}

	<section class="mk-final-cta">
		<div class="marketing-container">
			<h2>Ready to ship?</h2>
			<p>Start free. No credit card required.</p>
			<div class="mk-hero-ctas">
				<Button href={ctaHref} size="marketing-lg">
					{ctaLabel}
					<ArrowRight size={16} />
				</Button>
				<Button href={secondaryHref} variant="outline" size="marketing-lg">{secondaryLabel}</Button>
			</div>
		</div>
	</section>

	<MarketingFooter />
</div>
