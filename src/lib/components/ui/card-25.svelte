<script lang="ts">
	import type { Component, HTMLAttributes } from 'svelte/elements';
	import type { Snippet } from 'svelte';
	import { ArrowRight } from 'lucide-svelte';
	import { cn, type WithElementRef } from '$lib/utils.js';

	export type Stat = {
		/** Lucide (or any) Svelte icon component */
		icon: Component<{ class?: string }>;
		label: string;
	};

	export type AnimatedHikeCardProps = {
		title: string;
		images: string[];
		stats: Stat[];
		description: string;
		href: string;
		class?: string;
	};

	let {
		ref = $bindable(null),
		title,
		images,
		stats,
		description,
		href,
		class: className,
		...restProps
	}: WithElementRef<Omit<HTMLAttributes<HTMLAnchorElement>, 'href' | 'children'>> &
		AnimatedHikeCardProps = $props();
</script>

<a
	bind:this={ref}
	{href}
	data-slot="animated-hike-card"
	class={cn(
		'group relative block w-full max-w-sm cursor-pointer rounded-2xl border bg-card p-6 text-card-foreground shadow-sm transition-all duration-300 ease-in-out hover:-translate-y-1 hover:shadow-lg lg:max-w-md',
		className,
	)}
	aria-label={`Learn more about ${title}`}
	{...restProps}
>
	<div class="flex flex-col">
		<div class="mb-6 flex items-center justify-between">
			<h2 class="text-3xl font-bold tracking-tighter">{title}</h2>
			<ArrowRight class="h-6 w-6 transition-transform duration-300 ease-in-out group-hover:translate-x-1" />
		</div>

		<div class="relative mb-6 h-32">
			{#each images as src, index (src)}
				<div
					class={cn(
						'absolute h-full w-[40%] overflow-hidden rounded-lg border-2 border-background shadow-md transition-all duration-300 ease-in-out',
						'group-hover:translate-x-[var(--tx)] group-hover:rotate-[var(--r)]',
					)}
					style="transform: translateX({index * 32}px); --tx: {index * 80}px; --r: {index * 5 - 5}deg; z-index: {images.length - index};"
				>
					<img {src} alt={`${title} view ${index + 1}`} class="h-full w-full object-cover" />
				</div>
			{/each}
		</div>

		<div class="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
			{#each stats as stat, index (stat.label + index)}
				{@const Icon = stat.icon}
				<div class="flex items-center space-x-1.5">
					<Icon class="h-4 w-4" />
					<span>{stat.label}</span>
				</div>
			{/each}
		</div>

		<p class="text-sm leading-relaxed text-muted-foreground">
			{description}
		</p>
	</div>
</a>
