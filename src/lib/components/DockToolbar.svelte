<script lang="ts">
	export type DockItem = {
		icon: any;
		label: string;
		onClick?: () => void;
		disabled?: boolean;
	};

	type Props = {
		items: DockItem[];
		className?: string;
	};

	let { items, className = '' }: Props = $props();
</script>

<div class={`dock-shell ${className}`} aria-label="Editor dock">
	<div class="dock-float">
		{#each items as item (item.label)}
			<button
				type="button"
				class="dock-btn"
				aria-label={item.label}
				title={item.label}
				disabled={!!item.disabled}
				onclick={() => item.onClick?.()}
			>
				<item.icon size={18} />
				<span class="dock-tip" aria-hidden="true">{item.label}</span>
			</button>
		{/each}
	</div>
</div>

<style>
	@keyframes dock-float {
		0% { transform: translateY(0); }
		50% { transform: translateY(4px); }
		100% { transform: translateY(0); }
	}

	.dock-shell {
		width: 100%;
		display: flex;
		justify-content: center;
	}

	.dock-float {
		display: flex;
		align-items: center;
		gap: 4px;
		padding: 8px;
		border-radius: 16px;
		background: rgba(255,255,255,0.78);
		border: 1px solid rgba(10,10,10,0.08);
		box-shadow: 0 14px 44px rgba(0,0,0,0.10);
		backdrop-filter: blur(14px);
		-webkit-backdrop-filter: blur(14px);
		animation: dock-float 4s ease-in-out infinite;
	}

	.dock-btn {
		position: relative;
		border: none;
		background: transparent;
		padding: 10px;
		border-radius: 12px;
		cursor: pointer;
		transition: transform 160ms ease, background-color 160ms ease, opacity 160ms ease;
		color: rgba(10,10,10,0.9);
	}

	.dock-btn:hover:not(:disabled) {
		transform: translateY(-2px) scale(1.08);
		background: rgba(10,10,10,0.06);
	}

	.dock-btn:active:not(:disabled) {
		transform: translateY(-1px) scale(0.98);
	}

	.dock-btn:disabled {
		opacity: 0.35;
		cursor: not-allowed;
	}

	.dock-tip {
		position: absolute;
		left: 50%;
		top: -8px;
		transform: translate(-50%, -100%);
		padding: 4px 8px;
		border-radius: 10px;
		font-size: 12px;
		line-height: 1;
		white-space: nowrap;
		background: rgba(10,10,10,0.92);
		color: rgba(255,255,255,0.92);
		opacity: 0;
		pointer-events: none;
		transition: opacity 160ms ease;
	}

	.dock-btn:hover .dock-tip {
		opacity: 1;
	}
</style>

