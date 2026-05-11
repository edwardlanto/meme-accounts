<script lang="ts">
	const letters = 'Loading'.split('');
</script>

<div class="loading-root">
	<!-- Animated letters -->
	{#each letters as letter, idx}
		<span
			class="loading-letter"
			style="animation-delay: {0.1 + idx * 0.105}s"
		>{letter}</span>
	{/each}

	<!-- Colorful sweep background -->
	<div class="loading-bg-mask">
		<div class="loading-bg-glow"></div>
	</div>
</div>

<style>
	.loading-root {
		position: relative;
		display: flex;
		align-items: center;
		justify-content: center;
		font-family: 'Poppins', 'Inter', system-ui, sans-serif;
		font-size: 2.2em;
		font-weight: 700;
		letter-spacing: 0.04em;
		user-select: none;
		color: #ffffff;
	}

	.loading-letter {
		position: relative;
		display: inline-block;
		opacity: 0;
		z-index: 2;
		animation: letterAnim 4s linear infinite;
	}

	.loading-bg-mask {
		position: absolute;
		inset: 0;
		z-index: 1;
		background: transparent;
		-webkit-mask: repeating-linear-gradient(
			90deg,
			transparent 0,
			transparent 6px,
			black 7px,
			black 8px
		);
		mask: repeating-linear-gradient(
			90deg,
			transparent 0,
			transparent 6px,
			black 7px,
			black 8px
		);
	}

	.loading-bg-glow {
		position: absolute;
		inset: 0;
		background-image:
			radial-gradient(circle at 50% 50%, #ff0 0%, transparent 50%),
			radial-gradient(circle at 45% 45%, #f00 0%, transparent 45%),
			radial-gradient(circle at 55% 55%, #0ff 0%, transparent 45%),
			radial-gradient(circle at 45% 55%, #0f0 0%, transparent 45%),
			radial-gradient(circle at 55% 45%, #00f 0%, transparent 45%);
		-webkit-mask: radial-gradient(
			circle at 50% 50%,
			transparent 0%,
			transparent 10%,
			black 25%
		);
		mask: radial-gradient(
			circle at 50% 50%,
			transparent 0%,
			transparent 10%,
			black 25%
		);
		animation:
			transformAnim 2s infinite alternate cubic-bezier(0.6, 0.8, 0.5, 1),
			opacityAnim 4s infinite;
	}

	@keyframes transformAnim {
		0%   { transform: translate(-55%); }
		100% { transform: translate(55%); }
	}

	@keyframes opacityAnim {
		0%, 100% { opacity: 0; }
		15%       { opacity: 1; }
		65%       { opacity: 0; }
	}

	@keyframes letterAnim {
		0%   { opacity: 0; }
		5%   { opacity: 1; text-shadow: 0 0 6px rgba(255,255,255,0.8); transform: scale(1.1) translateY(-2px); }
		20%  { opacity: 0.25; transform: scale(1) translateY(0); }
		100% { opacity: 0; }
	}
</style>
