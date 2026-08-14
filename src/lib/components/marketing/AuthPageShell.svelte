<script lang="ts">
	import type { Snippet } from 'svelte';
	import MarketingNav from '$lib/components/MarketingNav.svelte';
	import MarketingFooter from '$lib/components/MarketingFooter.svelte';
	import SectionEyebrow from './SectionEyebrow.svelte';

	let {
		eyebrow,
		title,
		description,
		children,
	}: {
		eyebrow: string;
		title: string;
		description: string;
		children: Snippet;
	} = $props();
</script>

<div class="marketing-page">
	<MarketingNav />

	<section class="mk-auth-section">
		<div class="marketing-container">
			<div class="mk-auth-card">
				<SectionEyebrow index="" label={eyebrow} />
				<h1 class="mk-auth-title">{title}</h1>
				<p class="mk-auth-lead">{description}</p>
				{@render children()}
			</div>
		</div>
	</section>

	<MarketingFooter />
</div>
