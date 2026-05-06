<script lang="ts">
	import {
		Select,
		SelectContent,
		SelectItem,
		SelectTrigger,
		SelectSeparator,
	} from '$lib/components/ui/select';

	export type TemplateTab = { id: string; label: string; title?: string };

	const APPLY_ALL_VALUE = '__apply_template_all_slides__';

	type Props = {
		templates: TemplateTab[];
		selectedId: string;
		/** Optional label override (e.g. "Blank"). */
		selectedLabelOverride?: string;
		onSelect: (id: string) => void;
		/** Apply the current template to every slide (same as sidebar “Apply all”). */
		onApplyAll?: () => void;
		className?: string;
	};

	let { templates, selectedId, selectedLabelOverride, onSelect, onApplyAll, className = '' }: Props = $props();

	const selectedLabel = $derived(
		selectedLabelOverride?.trim() ||
			templates.find((t) => t.id === selectedId)?.label ||
			'Template',
	);
</script>

<div class={`template-dock-shell ${className}`} aria-label="Slide template">
	<div class="template-dock-float">
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
				size="sm"
				class="template-dock-trigger border-0 bg-transparent shadow-none h-9 min-w-[9.5rem] rounded-xl px-3 font-semibold text-[11px] text-neutral-800 hover:bg-black/[0.06] focus-visible:ring-1 focus-visible:ring-violet-500/40 dark:text-neutral-900 [&_svg]:text-neutral-500"
				aria-label="Slide template"
				title={templates.find((t) => t.id === selectedId)?.title ?? selectedLabel}
			>
				{selectedLabel}
			</SelectTrigger>
			<SelectContent class="z-[200] min-w-[var(--bits-select-anchor-width)]" align="center" sideOffset={8}>
				{#each templates as t (t.id)}
					<SelectItem value={t.id} label={t.label} title={t.title ?? t.label}>
						{t.label}
					</SelectItem>
				{/each}
				{#if onApplyAll}
					<SelectSeparator />
					<SelectItem
						value={APPLY_ALL_VALUE}
						label="Apply to all slides"
						class="font-semibold text-violet-600 dark:text-violet-400"
					>
						Apply to all slides
					</SelectItem>
				{/if}
			</SelectContent>
		</Select>
	</div>
</div>

<style>
	@keyframes template-dock-float {
		0% {
			transform: translateY(0);
		}
		50% {
			transform: translateY(4px);
		}
		100% {
			transform: translateY(0);
		}
	}

	.template-dock-shell {
		width: auto;
		flex: 0 0 auto;
		display: flex;
		justify-content: center;
	}

	.template-dock-float {
		display: flex;
		align-items: center;
		padding: 8px;
		border-radius: 16px;
		background: rgba(255, 255, 255, 0.78);
		border: 1px solid rgba(10, 10, 10, 0.08);
		box-shadow: 0 14px 44px rgba(0, 0, 0, 0.1);
		backdrop-filter: blur(14px);
		-webkit-backdrop-filter: blur(14px);
		animation: template-dock-float 4s ease-in-out infinite;
	}

	:global(.template-dock-float [data-slot='select-trigger']) {
		gap: 6px;
	}
</style>
