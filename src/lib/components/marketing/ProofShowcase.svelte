<script lang="ts">
	import ProofCard from './ProofCard.svelte';

	export type ProofItem = {
		id: string;
		title: string;
		description: string;
		format: string;
		platform: string;
		image: string;
		tag?: string;
		metric?: string;
		href?: string;
		layout?: 'featured' | 'side' | 'tile';
	};

	let {
		items,
		class: className = '',
	}: {
		items: ProofItem[];
		class?: string;
	} = $props();

	const layoutClass = (layout: ProofItem['layout']) => {
		if (layout === 'featured') return 'mk-proof-slot--featured';
		if (layout === 'side') return 'mk-proof-slot--side';
		return 'mk-proof-slot--tile';
	};
</script>

<div class="mk-proof-showcase {className}">
	{#each items as item, i (item.id)}
		<div
			class="mk-proof-slot mk-reveal {layoutClass(item.layout)}"
			style="--mk-delay:{i * 0.06}s"
		>
			<ProofCard
				title={item.title}
				description={item.description}
				format={item.format}
				platform={item.platform}
				image={item.image}
				tag={item.tag}
				metric={item.metric}
				href={item.href}
				featured={item.layout === 'featured'}
			/>
		</div>
	{/each}
</div>
