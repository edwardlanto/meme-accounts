<script lang="ts">
	import { Button } from '$lib/components/ui/button';

	let {
		tag,
		title,
		description,
		image,
		href = '',
		ctaLabel = '',
		class: className = '',
	}: {
		tag: string;
		title: string;
		description: string;
		image: string;
		href?: string;
		ctaLabel?: string;
		class?: string;
	} = $props();
</script>

<div class="mk-media-card mk-bento-studio-main mk-reveal {className}">
	<img src={image} alt="" loading="lazy" />
	<div class="mk-media-card-content">
		<span class="mk-media-tag">{tag}</span>
		<h3 class="mk-media-title">{title}</h3>
		<p class="mk-media-desc">{description}</p>
		{#if href && ctaLabel}
			<Button href={href} size="marketing">
				{ctaLabel}
			</Button>
		{/if}
	</div>
</div>
