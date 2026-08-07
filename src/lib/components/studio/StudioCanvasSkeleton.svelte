<script lang="ts">
	type Props = {
		/** Optional status line under the skeleton blocks. */
		label?: string;
	};

	let { label = '' }: Props = $props();
</script>

<div class="skeleton" aria-hidden="true">
	<div class="sk-media sk-shimmer"></div>
	<div class="sk-copy">
		<div class="sk-line sk-shimmer sk-line-lg"></div>
		<div class="sk-line sk-shimmer sk-line-md"></div>
		<div class="sk-line sk-shimmer sk-line-sm"></div>
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
		background: #f3f3f3;
	}
	.sk-media {
		position: absolute;
		inset: 0;
	}
	.sk-copy {
		position: relative;
		z-index: 1;
		display: flex;
		flex-direction: column;
		gap: 0.55rem;
		padding: 0 9% 14%;
	}
	.sk-line {
		height: 0.72rem;
		border-radius: 6px;
	}
	.sk-line-lg {
		height: 1.15rem;
		width: 78%;
		border-radius: 8px;
	}
	.sk-line-md {
		width: 58%;
	}
	.sk-line-sm {
		width: 40%;
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
		color: #9a9a9a;
	}
</style>
