<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import * as ButtonGroup from '$lib/components/ui/button-group/index.js';

	export type DockItem = {
		icon: any;
		label: string;
		onClick?: (e?: MouseEvent) => void;
		disabled?: boolean;
		/** Red destructive styling (e.g. delete). */
		danger?: boolean;
	};

	type Props = {
		items: DockItem[];
		className?: string;
		/** Kept for call-site compatibility; groups are always inline. */
		inline?: boolean;
	};

	let { items, className = '' }: Props = $props();
</script>

<ButtonGroup.Root class={className} aria-label="Editor dock">
	{#each items as item (item.label)}
		<Button
			type="button"
			variant="outline"
			size="icon"
			aria-label={item.label}
			title={item.label}
			disabled={!!item.disabled}
			onclick={(e) => item.onClick?.(e)}
			class={item.danger ? 'text-red-600 hover:text-red-600' : undefined}
		>
			<item.icon class={item.danger ? 'text-red-600' : undefined} />
		</Button>
	{/each}
</ButtonGroup.Root>
