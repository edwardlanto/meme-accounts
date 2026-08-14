<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		title,
		description,
		icon,
		class: className = '',
		delay = '0s',
	}: {
		title: string;
		description: string;
		icon?: Snippet;
		class?: string;
		delay?: string;
	} = $props();
</script>

<div class="mk-card mk-reveal {className}" style="--mk-delay:{delay}">
	{#if icon}
		<div class="mk-feature-icon">
			{@render icon()}
		</div>
	{/if}
	<h3 class="mk-feature-title">{title}</h3>
	<p class="mk-feature-desc">{description}</p>
</div>
