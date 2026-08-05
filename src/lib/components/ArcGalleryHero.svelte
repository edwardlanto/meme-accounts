<script lang="ts">
	import { onMount } from 'svelte';

	type ArcGalleryHeroProps = {
		images: string[];
		startAngle?: number;
		endAngle?: number;
		radiusLg?: number;
		radiusMd?: number;
		radiusSm?: number;
		cardSizeLg?: number;
		cardSizeMd?: number;
		cardSizeSm?: number;
		className?: string;
	};

	let {
		images,
		startAngle = 20,
		endAngle = 160,
		radiusLg = 480,
		radiusMd = 360,
		radiusSm = 260,
		cardSizeLg = 120,
		cardSizeMd = 100,
		cardSizeSm = 80,
		className = '',
	}: ArcGalleryHeroProps = $props();

	let dims = $state({ radius: radiusLg, cardSize: cardSizeLg });

	function updateDims() {
		const w = typeof window !== 'undefined' ? window.innerWidth : 1200;
		if (w < 640) dims = { radius: radiusSm, cardSize: cardSizeSm };
		else if (w < 1024) dims = { radius: radiusMd, cardSize: cardSizeMd };
		else dims = { radius: radiusLg, cardSize: cardSizeLg };
	}

	onMount(() => {
		updateDims();
		window.addEventListener('resize', updateDims, { passive: true });
		return () => window.removeEventListener('resize', updateDims);
	});

	const safeImages = $derived((images ?? []).filter(Boolean));
	const count = $derived(Math.max(safeImages.length, 2));
	const step = $derived((endAngle - startAngle) / (count - 1));
</script>

<section class={`relative overflow-hidden bg-white text-gray-900 flex flex-col ${className}`}>
	<!-- Background ring container that controls geometry -->
	<div
		class="relative mx-auto w-full"
		style={`height: ${dims.radius * 1.2}px;`}
	>
		<!-- Center pivot for transforms - positioned at bottom center -->
		<div class="absolute left-1/2 bottom-0 -translate-x-1/2">
			{#each safeImages as src, i (src + ':' + i)}
				{@const angle = startAngle + step * i}
				{@const angleRad = (angle * Math.PI) / 180}
				{@const x = Math.cos(angleRad) * dims.radius}
				{@const y = Math.sin(angleRad) * dims.radius}
				<div
					class="absolute opacity-0 animate-fade-in-up"
					style="
						width: {dims.cardSize}px;
						height: {dims.cardSize}px;
						left: calc(50% + {x}px);
						bottom: {y}px;
						transform: translate(-50%, 50%);
						animation-delay: {i * 100}ms;
						animation-fill-mode: forwards;
						z-index: {count - i};
					"
				>
					<div
						class="rounded-2xl shadow-xl overflow-hidden ring-1 ring-gray-200 bg-white w-full h-full"
						style={`transform: rotate(${angle / 4}deg);`}
					>
						<img
							src={src}
							alt={`Memory ${i + 1}`}
							class="block w-full h-full object-cover"
							draggable="false"
							onerror={(e) => {
								(e.currentTarget as HTMLImageElement).src =
									'https://placehold.co/400x400/334155/e2e8f0?text=Memory';
							}}
						/>
					</div>
				</div>
			{/each}
		</div>
	</div>

	<!-- Content positioned below the arc -->
	<div class="relative z-10 flex-1 flex items-center justify-center px-6 -mt-40 md:-mt-52 lg:-mt-64">
		<div
			class="text-center max-w-2xl px-6 opacity-0 animate-fade-in"
			style="animation-delay: 800ms; animation-fill-mode: forwards;"
		>
			<h1 class="text-3xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-gray-900">
				Rediscover Your Memories with AI
			</h1>
			<p class="mt-4 text-lg text-gray-600">
				Our intelligent platform finds, organizes, and brings your most cherished moments back to life.
			</p>
			<div class="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
				<a
					href="/?auth=signup"
					class="w-full sm:w-auto px-6 py-3 rounded-full bg-indigo-600 text-white hover:bg-indigo-700 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
				>
					Explore Your Past
				</a>
				<a
					href="#how"
					class="w-full sm:w-auto px-6 py-3 rounded-full border border-gray-300 hover:bg-gray-100 transition-all duration-200"
				>
					How It Works
				</a>
			</div>
		</div>
	</div>
</section>

<style>
	@keyframes fade-in-up {
		from { opacity: 0; transform: translate(-50%, 60%); }
		to   { opacity: 1; transform: translate(-50%, 50%); }
	}
	@keyframes fade-in {
		from { opacity: 0; transform: translateY(10px); }
		to   { opacity: 1; transform: translateY(0); }
	}
	.animate-fade-in-up {
		animation-name: fade-in-up;
		animation-duration: 0.8s;
		animation-timing-function: ease-out;
	}
	.animate-fade-in {
		animation-name: fade-in;
		animation-duration: 0.8s;
		animation-timing-function: ease-out;
	}
</style>

