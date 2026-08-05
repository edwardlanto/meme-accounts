<script lang="ts">
	import { X } from 'lucide-svelte';
	import type { Snippet } from 'svelte';

	type Props = {
		open: boolean;
		title: string;
		subtitle?: string;
		wide?: boolean;
		onclose?: () => void;
		children: Snippet;
	};

	let { open = $bindable(false), title, subtitle = '', wide = false, onclose, children }: Props = $props();

	let dialogEl = $state<HTMLDialogElement | null>(null);

	$effect(() => {
		const el = dialogEl;
		if (!el) return;
		if (open && !el.open) el.showModal();
		if (!open && el.open) el.close();
	});

	function handleClose() {
		open = false;
		onclose?.();
	}
</script>

<dialog
	class="bulk-popover"
	class:wide
	bind:this={dialogEl}
	onclose={handleClose}
	onclick={(e) => {
		if (e.target === dialogEl) handleClose();
	}}
>
	<div class="popover-panel" role="document">
		<header class="popover-head">
			<div>
				<h2>{title}</h2>
				{#if subtitle}
					<p>{subtitle}</p>
				{/if}
			</div>
			<button type="button" class="popover-close" aria-label="Close" onclick={handleClose}>
				<X size={18} />
			</button>
		</header>
		<div class="popover-body">
			{@render children()}
		</div>
	</div>
</dialog>

<style>
	.bulk-popover {
		border: none;
		padding: 0;
		margin: auto;
		max-width: calc(100vw - 2rem);
		max-height: calc(100vh - 2rem);
		background: transparent;
	}
	.bulk-popover::backdrop {
		background: rgba(8, 8, 8, 0.45);
		backdrop-filter: blur(2px);
	}
	.bulk-popover.wide .popover-panel {
		width: min(560px, calc(100vw - 2rem));
	}
	.popover-panel {
		width: min(420px, calc(100vw - 2rem));
		max-height: calc(100vh - 2rem);
		border-radius: 14px;
		border: 1px solid var(--bulk-border, #e2e8f0);
		background: var(--app-surface, #fff);
		box-shadow: 0 16px 48px rgba(0, 0, 0, 0.18);
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}
	.popover-head {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 0.75rem;
		padding: 0.85rem 1rem;
		border-bottom: 1px solid var(--bulk-border, #e2e8f0);
		background: var(--app-surface-2, #f8fafc);
	}
	.popover-head h2 {
		margin: 0;
		font-size: 0.95rem;
		font-weight: 700;
		color: var(--app-text);
	}
	.popover-head p {
		margin: 0.2rem 0 0;
		font-size: 0.75rem;
		color: var(--app-text-2);
		line-height: 1.35;
	}
	.popover-close {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 2rem;
		height: 2rem;
		border: none;
		border-radius: 8px;
		background: transparent;
		color: var(--app-text-2);
		cursor: pointer;
		flex-shrink: 0;
	}
	.popover-close:hover {
		background: var(--app-surface-3, #f1f5f9);
	}
	.popover-body {
		padding: 1rem;
		overflow: auto;
		flex: 1;
		min-height: 0;
	}
</style>
