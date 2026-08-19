<script lang="ts">
	import { ArrowLeft, ArrowRight } from 'lucide-svelte';
	import ProofCard from './ProofCard.svelte';

	export type ProofItem = {
		id: string;
		title: string;
		description: string;
		format: string;
		platform: string;
		formatLabel?: string;
		platformLabel?: string;
		href?: string;
		layout?: 'featured' | 'side' | 'tile' | 'wide';
		visual?: 'mix';
		index?: string;
	};

	let {
		items,
		class: className = '',
	}: {
		items: ProofItem[];
		class?: string;
	} = $props();

	let track: HTMLDivElement | null = $state(null);

	function scrollByDir(dir: -1 | 1) {
		const el = track;
		if (!el) return;
		const card = el.querySelector('.mk-proof-slot') as HTMLElement | null;
		const gap = 14;
		const w = card ? card.offsetWidth + gap : Math.round(el.clientWidth * 0.82);
		el.scrollBy({ left: dir * w, behavior: 'smooth' });
	}
</script>

<div class="mk-proof-carousel {className}">
	<div class="mk-proof-showcase" bind:this={track}>
		{#each items as item, i (item.id)}
			<div class="mk-proof-slot mk-reveal" style="--mk-delay:{i * 0.06}s">
				<ProofCard
					title={item.title}
					description={item.description}
					format={item.format}
					platform={item.platform}
					formatLabel={item.formatLabel}
					platformLabel={item.platformLabel}
					href={item.href}
					index={item.index}
				/>
			</div>
		{/each}
	</div>
</div>
