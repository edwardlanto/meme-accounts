<script lang="ts">
	import {
		Select,
		SelectContent,
		SelectItem,
		SelectTrigger,
		SelectSeparator,
	} from '$lib/components/ui/select';
	import * as ButtonGroup from '$lib/components/ui/button-group/index.js';

	export type TemplateTab = { id: string; label: string; title?: string; separatorBefore?: boolean };

	const APPLY_ALL_VALUE = '__apply_template_all_slides__';

	type Props = {
		templates: TemplateTab[];
		selectedId: string;
		/** Optional label override (e.g. "Blank"). */
		selectedLabelOverride?: string;
		onSelect: (id: string) => void;
		/** Apply the current template to every slide (same as sidebar "Apply all"). */
		onApplyAll?: () => void;
		className?: string;
	};

	let { templates, selectedId, selectedLabelOverride, onSelect, onApplyAll, className = '' }: Props =
		$props();

	const selectedLabel = $derived(
		selectedLabelOverride?.trim() ||
			templates.find((t) => t.id === selectedId)?.label ||
			'Template',
	);
</script>

<ButtonGroup.Root class={className} aria-label="Slide template">
	<Select
		type="single"
		value={selectedId}
		onValueChange={(v) => {
			if (!v) return;
			if (v === APPLY_ALL_VALUE) {
				onApplyAll?.();
				return;
			}
			onSelect(String(v));
		}}
	>
		<SelectTrigger
			aria-label="Slide template"
			title={templates.find((t) => t.id === selectedId)?.title ?? selectedLabel}
		>
			{selectedLabel}
		</SelectTrigger>
		<SelectContent
			preventScroll={false}
			class="z-[200] min-w-[var(--bits-select-anchor-width)]"
			align="center"
			sideOffset={8}
		>
			{#each templates as t (t.id)}
				{#if t.separatorBefore}
					<SelectSeparator />
				{/if}
				<SelectItem value={t.id} label={t.label} title={t.title ?? t.label}>
					{t.label}
				</SelectItem>
			{/each}
			{#if onApplyAll}
				<SelectSeparator />
				<SelectItem value={APPLY_ALL_VALUE} label="Apply to all slides">
					Apply to all slides
				</SelectItem>
			{/if}
		</SelectContent>
	</Select>
</ButtonGroup.Root>
