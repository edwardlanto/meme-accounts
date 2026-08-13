<script lang="ts">
	import { TrendingDown, TrendingUp, Minus } from 'lucide-svelte';
	import * as Card from '$lib/components/ui/card/index.js';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { cn } from '$lib/utils.js';

	export type SectionCardItem = {
		title: string;
		value: string;
		badge?: string;
		trend?: 'up' | 'down' | 'neutral';
		footer: string;
		hint: string;
	};

	type Props = {
		items: SectionCardItem[];
		class?: string;
	};

	let { items, class: className }: Props = $props();
</script>

<div
	class={cn(
		'@container/main grid grid-cols-1 gap-4 *:data-[slot=card]:bg-linear-to-t *:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card *:data-[slot=card]:shadow-xs @xl/main:grid-cols-2 @5xl/main:grid-cols-4 dark:*:data-[slot=card]:bg-card',
		className,
	)}
>
	{#each items as item (item.title)}
		<Card.Root class="@container/card">
			<Card.Header>
				<Card.Description>{item.title}</Card.Description>
				<Card.Title class="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
					{item.value}
				</Card.Title>
				{#if item.badge}
					<Card.Action>
						<Badge variant="outline">
							{#if item.trend === 'down'}
								<TrendingDown />
							{:else if item.trend === 'up'}
								<TrendingUp />
							{:else}
								<Minus />
							{/if}
							{item.badge}
						</Badge>
					</Card.Action>
				{/if}
			</Card.Header>
			<Card.Footer class="border-t flex-col items-start gap-1.5 text-sm">
				<div class="line-clamp-1 flex gap-2 font-medium">
					{item.footer}
					{#if item.trend === 'down'}
						<TrendingDown class="size-4" />
					{:else if item.trend === 'up'}
						<TrendingUp class="size-4" />
					{/if}
				</div>
				<div class="text-muted-foreground">{item.hint}</div>
			</Card.Footer>
		</Card.Root>
	{/each}
</div>
