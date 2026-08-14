<script lang="ts">
	import { ArrowUpRight } from 'lucide-svelte';

	let {
		title,
		description = '',
		format,
		platform,
		image,
		tag = '',
		metric = '',
		href = '',
		featured = false,
		class: className = '',
		delay = '0s',
	}: {
		title: string;
		description?: string;
		format: string;
		platform: string;
		image: string;
		tag?: string;
		metric?: string;
		href?: string;
		featured?: boolean;
		class?: string;
		delay?: string;
	} = $props();
</script>

{#if href}
	<a
		{href}
		class="mk-proof-card {className}"
		class:mk-proof-card--featured={featured}
		style="--mk-delay:{delay}"
		aria-label="Open {format} in Studio"
	>
		{@render cardBody()}
	</a>
{:else}
	<div
		class="mk-proof-card {className}"
		class:mk-proof-card--featured={featured}
		style="--mk-delay:{delay}"
	>
		{@render cardBody()}
	</div>
{/if}

{#snippet cardBody()}
	<div class="mk-proof-card-bg" aria-hidden="true">
		<img src={image} alt="" loading="lazy" />
		<div class="mk-proof-card-scrim"></div>
	</div>

	<div class="mk-proof-card-content">
		<div class="mk-proof-card-top">
			{#if tag}
				<span class="mk-proof-tag">{tag}</span>
			{/if}
			{#if metric}
				<span class="mk-proof-metric">{metric}</span>
			{/if}
		</div>

		<div class="mk-proof-card-main">
			<h3 class="mk-proof-title">{title}</h3>
			{#if description}
				<p class="mk-proof-desc">{description}</p>
			{/if}
		</div>

		<div class="mk-proof-card-foot">
			<div class="mk-proof-stats">
				<div>
					<p class="mk-proof-stat-label">Format</p>
					<p class="mk-proof-stat-value">{format}</p>
				</div>
				<div>
					<p class="mk-proof-stat-label">Platform</p>
					<p class="mk-proof-stat-value">{platform}</p>
				</div>
			</div>
			{#if href}
				<span class="mk-proof-link-icon" aria-hidden="true">
					<ArrowUpRight size={18} />
				</span>
			{/if}
		</div>
	</div>
{/snippet}
