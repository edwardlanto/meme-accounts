<script lang="ts">
	let {
		index,
		label,
		class: className = '',
	}: {
		index: string;
		label: string;
		class?: string;
	} = $props();
</script>

<p class="mk-eyebrow {className}">
	{#if index}
		<span class="mk-eyebrow-index">§ {index}</span>
		<span>· {label}</span>
	{:else}
		<span>{label}</span>
	{/if}
</p>
