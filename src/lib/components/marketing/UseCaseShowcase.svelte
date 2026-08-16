<script lang="ts">
	import { ArrowRight } from 'lucide-svelte';
	import { Button } from '$lib/components/ui/button';

	export type UseCaseItem = {
		id: string;
		title: string;
		description: string;
		ctaLabel: string;
		href: string;
		image: string;
		/** Optional looping preview video (shown instead of the still when set). */
		video?: string;
		accent?: string;
		features?: string[];
	};

	let {
		items,
		class: className = '',
		style = '',
	}: {
		items: UseCaseItem[];
		class?: string;
		style?: string;
	} = $props();

	let active = $state(0);
	let previewFrameEl = $state<HTMLDivElement | null>(null);

	const activeItem = $derived(items[active] ?? items[0]);

	const defaultFeatures = [
		'Auto-fit text to your canvas size',
		'Auto-highlight keywords in brand color',
		'AI image generation + 10M+ stock photos & videos',
	];

	function select(i: number) {
		if (i === active) return;
		active = i;
	}

	/** Keep the active preview video playing when the tab changes. */
	$effect(() => {
		void active;
		const root = previewFrameEl;
		if (!root) return;
		for (const v of root.querySelectorAll('video')) {
			if (v.classList.contains('is-visible')) {
				void v.play().catch(() => {});
			} else {
				v.pause();
			}
		}
	});

	function onKeydown(e: KeyboardEvent, i: number) {
		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			select(i);
		}
		if (e.key === 'ArrowDown') {
			e.preventDefault();
			select(Math.min(items.length - 1, i + 1));
		}
		if (e.key === 'ArrowUp') {
			e.preventDefault();
			select(Math.max(0, i - 1));
		}
	}
</script>

<div class="mk-usecase {className}" {style}>
	<div class="mk-usecase-list" role="tablist" aria-label="Product use cases">
		{#each items as item, i (item.id)}
			<button
				type="button"
				class="mk-usecase-item"
				class:is-active={active === i}
				role="tab"
				aria-selected={active === i}
				aria-controls="mk-usecase-panel"
				id="mk-usecase-tab-{item.id}"
				onclick={() => select(i)}
				onkeydown={(e) => onKeydown(e, i)}
			>
				<span class="mk-usecase-title">{item.title}</span>
			</button>
		{/each}
	</div>

	<div
		id="mk-usecase-panel"
		class="mk-usecase-panel"
		role="tabpanel"
		aria-labelledby="mk-usecase-tab-{activeItem.id}"
	>
		{#each items as item, i (item.id)}
			<div class="mk-usecase-panel-inner" class:is-visible={active === i} aria-hidden={active !== i}>
				<p class="mk-usecase-desc">{item.description}</p>
				<ul class="mk-usecase-features">
					{#each (item.features?.length ? item.features : defaultFeatures) as feat}
						<li>{feat}</li>
					{/each}
				</ul>
				<Button href={item.href} variant="outline" size="marketing" class="mk-usecase-cta">
					{item.ctaLabel}
					<ArrowRight size={14} />
				</Button>
			</div>
		{/each}
	</div>

	<div class="mk-usecase-preview" aria-live="polite">
		<div
			class="mk-usecase-preview-stage"
			style="--mk-usecase-accent: {activeItem.accent ?? '#7bf1a8'}"
		>
			<div class="mk-usecase-preview-frame" bind:this={previewFrameEl}>
				{#each items as item, i (item.id)}
					{#if item.video}
						<video
							src={item.video}
							poster={item.image}
							class="mk-usecase-preview-img"
							class:is-visible={active === i}
							muted
							loop
							playsinline
							autoplay={active === i}
							preload={i === 0 || active === i ? 'auto' : 'metadata'}
							aria-hidden="true"
						></video>
					{:else}
						<img
							src={item.image}
							alt=""
							loading={i === 0 ? 'eager' : 'lazy'}
							class="mk-usecase-preview-img"
							class:is-visible={active === i}
						/>
					{/if}
				{/each}
			</div>
		</div>
	</div>
</div>
