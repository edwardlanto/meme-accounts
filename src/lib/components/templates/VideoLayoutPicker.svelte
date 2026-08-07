<script lang="ts">
	import { VIDEO_LAYOUT_TEMPLATES, type VideoLayoutId } from '$lib/templates';

	interface Props {
		value: VideoLayoutId;
		disabled?: boolean;
		ariaLabel?: string;
	}

	let { value = $bindable(), disabled = false, ariaLabel = 'Video template' }: Props = $props();
</script>

<div class="layout-picker" role="listbox" aria-label={ariaLabel}>
	{#each VIDEO_LAYOUT_TEMPLATES as lay (lay.id)}
		<button
			type="button"
			class="layout-chip"
			class:layout-chip-on={value === lay.id}
			{disabled}
			role="option"
			aria-selected={value === lay.id}
			onclick={() => (value = lay.id)}
		>
			{lay.label}
		</button>
	{/each}
</div>

<style>
	.layout-picker {
		display: flex;
		flex-wrap: wrap;
		gap: 0.45rem;
	}

	.layout-chip {
		padding: 0.42rem 0.72rem;
		border-radius: 999px;
		border: 1px solid var(--panel-border, rgba(0, 0, 0, 0.1));
		background: var(--panel-bg, #fff);
		color: var(--t-muted, #666);
		font-size: 0.72rem;
		font-weight: 600;
		cursor: pointer;
		transition:
			background 0.18s ease,
			border-color 0.18s ease,
			color 0.18s ease,
			box-shadow 0.18s ease;
	}

	.layout-chip:hover:not(:disabled) {
		border-color: color-mix(in oklab, var(--t-strong, #111) 18%, transparent);
		color: var(--t-strong, #111);
	}

	.layout-chip-on {
		background: color-mix(in oklab, var(--accent, #7bf1a8) 22%, var(--panel-bg, #fff));
		border-color: color-mix(in oklab, var(--accent, #7bf1a8) 55%, transparent);
		color: var(--t-strong, #111);
		box-shadow: 0 0 0 1px color-mix(in oklab, var(--accent, #7bf1a8) 35%, transparent);
	}

	.layout-chip:disabled {
		opacity: 0.55;
		cursor: not-allowed;
	}
</style>
