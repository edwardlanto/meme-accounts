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
		/* Distinct from empty canvas so boot is obvious in light + dark */
		background: color-mix(in oklab, var(--app-text, #111) 6%, var(--app-surface, #f4f4f5));
	}
	.sk-media {
		position: absolute;
		inset: 0;
		background: linear-gradient(
			165deg,
			color-mix(in oklab, var(--app-text, #111) 8%, transparent),
			color-mix(in oklab, var(--app-text, #111) 3%, transparent) 55%,
			color-mix(in oklab, var(--app-text, #111) 10%, transparent)
		);
	}
	.sk-copy {
		position: relative;
		z-index: 1;
		display: flex;
		flex-direction: column;
		gap: 0.65rem;
		padding: 0 9% 12%;
	}
	.sk-line {
		height: 0.85rem;
		border-radius: 999px;
		background: color-mix(in oklab, var(--app-text, #111) 16%, transparent);
	}
	.sk-line-lg {
		height: 1.65rem;
		width: 78%;
	}
	.sk-line-md {
		width: 58%;
	}
	.sk-line-sm {
		width: 40%;
		opacity: 0.75;
	}
	.sk-label {
		position: absolute;
		left: 50%;
		bottom: 1.15rem;
		z-index: 2;
		transform: translateX(-50%);
		margin: 0;
		font-size: 0.6875rem;
		letter-spacing: 0.02em;
		white-space: nowrap;
		color: color-mix(in oklab, var(--app-text, #111) 55%, transparent);
	}

	.skeleton::after {
		content: '';
		position: absolute;
		inset: 0;
		z-index: 1;
		background: linear-gradient(
			100deg,
			transparent 18%,
			color-mix(in oklab, var(--app-text, #111) 12%, transparent) 48%,
			transparent 72%
		);
		transform: translateX(-100%);
		animation: sk-sweep 1.45s ease-in-out infinite;
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
