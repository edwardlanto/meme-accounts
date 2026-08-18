<script lang="ts">
	import * as ToggleGroup from '$lib/components/ui/toggle-group/index.js';

	export type FormatTab = { id: string; label: string; title?: string };

	type Props = {
		formats: FormatTab[];
		selectedId: string;
		onSelect: (id: string) => void;
		className?: string;
	};

	let { formats, selectedId, onSelect, className = '' }: Props = $props();
</script>

<div class="format-dock {className}" aria-label="Canvas format">
	<ToggleGroup.Root
		type="single"
		variant="outline"
		value={selectedId}
		onValueChange={(v) => {
			if (v) onSelect(String(v));
		}}
	>
		{#each formats as f (f.id)}
			<ToggleGroup.Item value={f.id} aria-label={f.title ?? f.label} title={f.title ?? f.label}>
				{f.label}
			</ToggleGroup.Item>
		{/each}
	</ToggleGroup.Root>
</div>

<style>
	.format-dock {
		max-width: 100%;
		overflow-x: auto;
		-webkit-overflow-scrolling: touch;
		scrollbar-width: none;
	}
	.format-dock::-webkit-scrollbar {
		display: none;
	}
	.format-dock :global([data-slot='toggle-group']) {
		flex-wrap: nowrap;
	}
	.format-dock :global([data-slot='toggle-group-item'][data-state='on']) {
		background: var(--app-accent, #7bf1a8);
		color: #080808;
		font-weight: 600;
	}
</style>
