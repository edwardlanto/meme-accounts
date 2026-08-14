<script lang="ts">
	import SectionEyebrow from './SectionEyebrow.svelte';

	let {
		index,
		label,
		title,
		description = '',
		stacked = false,
		class: className = '',
	}: {
		index: string;
		label: string;
		title: string;
		description?: string;
		stacked?: boolean;
		class?: string;
	} = $props();
</script>

<div class="mk-section-head mk-reveal {stacked ? 'mk-section-head--stacked' : ''} {className}">
	<div>
		<SectionEyebrow {index} {label} />
		<h2 class="mk-section-title">{@html title}</h2>
	</div>
	{#if description}
		<p class="mk-section-desc">{description}</p>
	{/if}
</div>
