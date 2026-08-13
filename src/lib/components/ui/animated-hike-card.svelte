<script lang="ts">
	import { ArrowRight } from 'lucide-svelte';
	import { cn } from '$lib/utils';

	export type CardStat = {
		label: string;
		/** Lucide (or any) Svelte icon component */
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		icon: any;
	};

	type Props = {
		title: string;
		images: string[];
		stats: CardStat[];
		description: string;
		href: string;
		class?: string;
	};

	let {
		title,
		images,
		stats,
		description,
		href,
		class: className = '',
	}: Props = $props();

	/** Portrait 4:5 frames — slightly smaller so two cards fit a shared container. */
	const ASPECT = 4 / 5;
	const FRAME_W = 96;
	const FRAME_H = Math.round(FRAME_W / ASPECT);
	const shown = $derived(images.slice(0, 5));
	const rest = $derived(Math.max(0, shown.length - 1));
	const hoverStep = $derived(rest > 0 ? Math.min(64, Math.floor(200 / rest)) : 0);
	const restGap = $derived(rest > 0 ? Math.min(26, Math.floor(110 / rest)) : 0);
</script>

<a
	{href}
	class={cn(
		'group relative flex h-full w-full max-w-sm cursor-pointer flex-col rounded-2xl border border-border bg-card p-6 text-card-foreground shadow-sm transition-all duration-300 ease-in-out hover:-translate-y-1 hover:shadow-lg lg:max-w-md',
		className,
	)}
	aria-label="Learn more about {title}"
>
	<div class="flex min-h-0 flex-1 flex-col">
		<div class="mb-6 flex items-start justify-between gap-3">
			<h2 class="text-2xl font-bold tracking-tighter text-foreground sm:text-3xl">{title}</h2>
			<ArrowRight
				class="h-6 w-6 shrink-0 text-foreground transition-transform duration-300 ease-in-out group-hover:translate-x-1"
			/>
		</div>

		<!-- Stacked images — each frame is 4:5 like /home/story-placeholder -->
		<div class="relative mb-6 w-full" style="height: {FRAME_H}px;">
			{#each shown as src, index (src)}
				<div
					class={cn(
						'absolute top-0 left-0 overflow-hidden rounded-lg border-2 border-background bg-muted shadow-md transition-all duration-300 ease-in-out',
						'group-hover:translate-x-[var(--tx)] group-hover:rotate-[var(--r)]',
					)}
					style="
						width: {FRAME_W}px;
						height: {FRAME_H}px;
						aspect-ratio: 4 / 5;
						transform: translateX({index * restGap}px);
						--tx: {index * hoverStep}px;
						--r: {index * 5 - 5}deg;
						z-index: {shown.length - index};
					"
				>
					<img
						{src}
						alt="{title} slide {index + 1}"
						class="h-full w-full object-cover object-top"
						width="1080"
						height="1350"
						loading="lazy"
						draggable="false"
					/>
				</div>
			{/each}
		</div>

		<div class="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
			{#each stats as stat, index (index)}
				{@const Icon = stat.icon}
				<div class="flex items-center gap-1.5">
					<Icon class="h-4 w-4 shrink-0" />
					<span>{stat.label}</span>
				</div>
			{/each}
		</div>

		<p class="mt-auto text-sm leading-relaxed text-muted-foreground">
			{description}
		</p>
	</div>
</a>
