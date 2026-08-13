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

<div class={className} aria-label="Canvas format">
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
