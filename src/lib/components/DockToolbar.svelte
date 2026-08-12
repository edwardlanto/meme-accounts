<script lang="ts">
	export type DockItem = {
		icon: any;
		label: string;
		onClick?: (e?: MouseEvent) => void;
		disabled?: boolean;
	};

	type Props = {
		items: DockItem[];
		className?: string;
		/** When true, the shell does not stretch full width — use beside another dock (e.g. format picker). */
		inline?: boolean;
	};

	let { items, className = '', inline = false }: Props = $props();
</script>

<div
	class={`dock-shell ${inline ? 'dock-shell--inline' : ''} ${className}`}
	aria-label="Editor dock"
>
	<div class="dock-float">
		{#each items as item (item.label)}
			<button
				type="button"
				class="dock-btn"
				aria-label={item.label}
				title={item.label}
				disabled={!!item.disabled}
				onclick={(e) => item.onClick?.(e)}
			>
				<item.icon size={17} strokeWidth={1.8} />
				<span class="dock-tip" aria-hidden="true">{item.label}</span>
			</button>
		{/each}
	</div>
</div>

<style>
	.dock-shell {
		width: 100%;
		display: flex;
		justify-content: center;
	}

	.dock-shell--inline {
		width: auto;
		flex: 0 0 auto;
	}

	.dock-float {
		display: flex;
		align-items: center;
		gap: 2px;
		padding: 6px;
		min-height: 48px;
		box-sizing: border-box;
		border-radius: 16px;
		background: rgba(255, 255, 255, 0.82);
		border: 1px solid rgba(10, 10, 10, 0.08);
		backdrop-filter: blur(14px);
		-webkit-backdrop-filter: blur(14px);
	}

	.dock-btn {
		position: relative;
		border: none;
		background: transparent;
		padding: 9px 10px;
		width: 36px;
		height: 36px;
		box-sizing: border-box;
		border-radius: 11px;
		cursor: pointer;
		transition: background-color 140ms ease, opacity 140ms ease;
		color: rgba(10, 10, 10, 0.75);
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}

	.dock-btn:hover:not(:disabled) {
		background: rgba(10, 10, 10, 0.06);
		color: rgba(10, 10, 10, 1);
	}

	.dock-btn:active:not(:disabled) {
		background: rgba(10, 10, 10, 0.09);
	}

	.dock-btn:disabled {
		opacity: 0.3;
		cursor: not-allowed;
	}

	/* Separator between logical groups — add a data-sep attribute to the item wrapper if needed */
	.dock-btn + .dock-sep {
		width: 1px;
		height: 20px;
		background: rgba(10, 10, 10, 0.10);
		margin: 0 2px;
		flex-shrink: 0;
	}

	.dock-tip {
		position: absolute;
		left: 50%;
		top: -6px;
		transform: translate(-50%, -100%);
		padding: 4px 8px;
		border-radius: 8px;
		font-size: 11px;
		font-weight: 500;
		line-height: 1;
		white-space: nowrap;
		background: rgba(10, 10, 10, 0.88);
		color: rgba(255, 255, 255, 0.95);
		opacity: 0;
		pointer-events: none;
		transition: opacity 120ms ease;
		letter-spacing: 0.01em;
	}

	.dock-btn:hover .dock-tip {
		opacity: 1;
	}
</style>
