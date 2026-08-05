<script lang="ts">
	type Props = {
		/** Optional status line under the skeleton blocks. */
		label?: string;
	};

	let { label = '' }: Props = $props();
</script>

<div class="skeleton" aria-hidden="true">
	<div class="sk-media"></div>
	<div class="sk-copy">
		<div class="sk-line sk-line-lg"></div>
		<div class="sk-line sk-line-md"></div>
		<div class="sk-line sk-line-sm"></div>
	</div>
</div>
{#if label}
	<p class="sk-label">{label}</p>
{/if}

<style>
	.skeleton {
		position: absolute;
		inset: 0;
		display: flex;
		flex-direction: column;
		justify-content: flex-end;
		gap: 0;
		padding: 0;
		border-radius: inherit;
		overflow: hidden;
		background: var(--app-surface-2, #131316);
	}
	.sk-media {
		position: absolute;
		inset: 0;
		background: linear-gradient(
			180deg,
			color-mix(in oklab, var(--app-text, #fff) 9%, transparent),
			color-mix(in oklab, var(--app-text, #fff) 4%, transparent)
		);
	}
	.sk-copy {
		position: relative;
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
		padding: 0 8% 10%;
	}
	.sk-line {
		height: 0.85rem;
		border-radius: 999px;
		background: color-mix(in oklab, var(--app-text, #fff) 14%, transparent);
	}
	.sk-line-lg {
		height: 1.6rem;
		width: 78%;
	}
	.sk-line-md {
		width: 58%;
	}
	.sk-line-sm {
		width: 40%;
		opacity: 0.7;
	}
	.sk-label {
		position: absolute;
		left: 50%;
		bottom: 1.15rem;
		transform: translateX(-50%);
		margin: 0;
		font-size: 0.6875rem;
		letter-spacing: 0.02em;
		color: color-mix(in oklab, var(--app-text, #fff) 55%, transparent);
	}

	/* One shared sweep so the blocks read as a single loading surface. */
	.skeleton::after {
		content: '';
		position: absolute;
		inset: 0;
		background: linear-gradient(
			100deg,
			transparent 20%,
			color-mix(in oklab, var(--app-text, #fff) 10%, transparent) 45%,
			transparent 70%
		);
		transform: translateX(-100%);
		animation: sk-sweep 1.5s ease-in-out infinite;
	}

	@keyframes sk-sweep {
		to {
			transform: translateX(100%);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.skeleton::after {
			animation: none;
		}
	}
</style>
