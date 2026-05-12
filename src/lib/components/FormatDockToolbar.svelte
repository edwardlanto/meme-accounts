<script lang="ts">
	export type FormatTab = { id: string; label: string; title?: string };

	type Props = {
		formats: FormatTab[];
		selectedId: string;
		onSelect: (id: string) => void;
		className?: string;
	};

	let { formats, selectedId, onSelect, className = '' }: Props = $props();
</script>

<div class={`format-dock-shell ${className}`} aria-label="Canvas format">
	<div class="format-dock-float">
		{#each formats as f (f.id)}
			<button
				type="button"
				class="format-dock-btn"
				class:format-dock-btn--active={selectedId === f.id}
				aria-pressed={selectedId === f.id}
				title={f.title ?? f.label}
				onclick={() => onSelect(f.id)}
			>
				{f.label}
			</button>
		{/each}
	</div>
</div>

<style>
	/* Keep motion + shell metrics in lockstep with `DockToolbar.svelte` (`.dock-float` / `.dock-btn`). */
	@keyframes format-dock-float {
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

	.format-dock-shell {
		width: auto;
		flex: 0 0 auto;
		display: flex;
		justify-content: center;
	}

	.format-dock-float {
		display: flex;
		align-items: center;
		gap: 4px;
		padding: 8px;
		border-radius: 16px;
		background: rgba(255, 255, 255, 0.78);
		border: 1px solid rgba(10, 10, 10, 0.08);
		box-shadow: 0 14px 44px rgba(0, 0, 0, 0.1);
		backdrop-filter: blur(14px);
		-webkit-backdrop-filter: blur(14px);
		animation: format-dock-float 4s ease-in-out infinite;
	}

	/* Match editor dock hit target: 10px padding + 18px icon row = 38px tall */
	.format-dock-btn {
		box-sizing: border-box;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 0;
		min-height: 38px;
		padding: 10px 15px;
		border: none;
		border-radius: 12px;
		background: transparent;
		cursor: pointer;
		font-size: 8.5px;
		font-weight: 600;
		line-height: 1.1;
		letter-spacing: 0.03em;
		text-transform: uppercase;
		white-space: nowrap;
		color: rgba(10, 10, 10, 0.55);
		transition: transform 160ms ease, background-color 160ms ease, color 160ms ease, opacity 160ms ease;
	}

	.format-dock-btn:hover {
		transform: translateY(-2px) scale(1.08);
		color: rgba(10, 10, 10, 0.9);
		background: rgba(10, 10, 10, 0.06);
	}

	.format-dock-btn:active {
		transform: translateY(-1px) scale(0.98);
	}

	.format-dock-btn--active {
		color: #fff;
		border-radius:50px;
		background: #000;
	}

	.format-dock-btn--active:hover {
		color: rgba(76, 29, 149, 1);
		background: rgba(139, 92, 246, 0.24);
	}
</style>
