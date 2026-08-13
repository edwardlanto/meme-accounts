<script lang="ts">
	import { cn } from "$lib/utils.js";
	import { Popover as PopoverPrimitive } from "bits-ui";
	import type { Snippet } from "svelte";

	let {
		ref = $bindable(null),
		class: className,
		children,
		child,
		...restProps
	}: PopoverPrimitive.TriggerProps & {
		child?: Snippet<[{ props: Record<string, unknown> }]>;
	} = $props();

	const childSnippet = child;
</script>

{#if childSnippet}
	<PopoverPrimitive.Trigger bind:ref data-slot="popover-trigger" {...restProps}>
		{#snippet child({ props }: { props: Record<string, unknown> })}
			{@render childSnippet({
				props: {
					...props,
					class: cn(String(props.class ?? ""), className),
				},
			})}
		{/snippet}
	</PopoverPrimitive.Trigger>
{:else}
	<PopoverPrimitive.Trigger
		bind:ref
		data-slot="popover-trigger"
		class={cn("", className)}
		{...restProps}
	>
		{@render children?.()}
	</PopoverPrimitive.Trigger>
{/if}
