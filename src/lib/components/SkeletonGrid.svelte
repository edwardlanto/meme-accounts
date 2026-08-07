<script lang="ts">
	/**
	 * Grid of bulk-style shimmer cards — used in assets / media pickers while loading.
	 */
	type Props = {
		count?: number;
		/** Match Unsplash/Pexels cards (3/4) or Bulk previews (4/5). */
		ratio?: '3/4' | '4/5';
		class?: string;
	};

	let { count = 6, ratio = '3/4', class: className = '' }: Props = $props();
</script>

<ul class="sk-grid {className}" aria-hidden="true">
	{#each Array(count) as _, i (i)}
		<li
			class="sk-shimmer sk-card"
			class:sk-card--4-5={ratio === '4/5'}
			class:sk-card--3-4={ratio === '3/4'}
		></li>
	{/each}
</ul>

<style>
	.sk-grid {
		margin: 0;
		padding: 0;
		list-style: none;
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 8px;
		width: 100%;
	}
	.sk-card {
		width: 100%;
		border-radius: 10px;
		min-height: 0;
	}
	.sk-card--3-4 {
		aspect-ratio: 3 / 4;
	}
	.sk-card--4-5 {
		aspect-ratio: 4 / 5;
		border-radius: 12px;
	}
</style>
