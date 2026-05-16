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
	.format-dock-shell {
		width: auto;
		flex: 0 0 auto;
		display: flex;
		justify-content: center;
	}

	.format-dock-float {
		display: flex;
		align-items: center;
		gap: 2px;
		padding: 6px;
		border-radius: 16px;
		background: rgba(255, 255, 255, 0.82);
		border: 1px solid rgba(10, 10, 10, 0.08);
		box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08), 0 1px 3px rgba(0,0,0,0.05);
		backdrop-filter: blur(14px);
		-webkit-backdrop-filter: blur(14px);
	}

	.format-dock-btn {
		box-sizing: border-box;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 0;
		min-height: 36px;
		padding: 8px 14px;
		border: none;
		border-radius: 11px;
		background: transparent;
		cursor: pointer;
		font-size: 8px;
		font-weight: 700;
		line-height: 1.1;
		letter-spacing: 0.07em;
		text-transform: uppercase;
		white-space: nowrap;
		color: rgba(10, 10, 10, 0.45);
		transition: background-color 140ms ease, color 140ms ease, transform 140ms ease;
	}

	.format-dock-btn:hover:not(.format-dock-btn--active) {
		color: rgba(10, 10, 10, 0.85);
		background: rgba(10, 10, 10, 0.05);
		transform: none;
	}

	.format-dock-btn:active {
		transform: scale(0.97);
	}

	.format-dock-btn--active {
		color: #fff;
		background: #111;
		border-radius: 10px;
	}

	.format-dock-btn--active:hover {
		background: #222;
		color: #fff;
	}
</style>
