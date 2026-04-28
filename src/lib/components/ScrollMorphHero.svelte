<script lang="ts">
	import { onMount } from 'svelte';
	import { spring, type Spring } from 'svelte/motion';

	type AnimationPhase = 'scatter' | 'line' | 'circle';

	type Target = { x: number; y: number; rotation: number; scale: number; opacity: number };

	const IMG_WIDTH = 60;
	const IMG_HEIGHT = 85;
	const TOTAL_IMAGES = 20;
	const MAX_SCROLL = 3000;

	interface Props {
		images?: string[];
	}

	let {
		images = [
		'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=300&q=80',
		'https://images.unsplash.com/photo-1519710164239-da123dc03ef4?w=300&q=80',
		'https://images.unsplash.com/photo-1497366216548-37526070297c?w=300&q=80',
		'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=300&q=80',
		'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=300&q=80',
		'https://images.unsplash.com/photo-1506765515384-028b60a970df?w=300&q=80',
		'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=300&q=80',
		'https://images.unsplash.com/photo-1472214103451-9374bd1c798e?w=300&q=80',
		'https://images.unsplash.com/photo-1500485035595-cbe6f645feb1?w=300&q=80',
		'https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=300&q=80',
		'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=300&q=80',
		'https://images.unsplash.com/photo-1518020382113-a7e8fc38eac9?w=300&q=80',
		'https://images.unsplash.com/photo-1465146344425-f00d5f5c8f07?w=300&q=80',
		'https://images.unsplash.com/photo-1470252649378-9c29740c9fa8?w=300&q=80',
		'https://images.unsplash.com/photo-1493246507139-91e8fad9978e?w=300&q=80',
		'https://images.unsplash.com/photo-1494438639946-1ebd1d20bf85?w=300&q=80',
		'https://images.unsplash.com/photo-1483729558449-99ef09a8c325?w=300&q=80',
		'https://images.unsplash.com/photo-1518173946687-a4c8892bbd9f?w=300&q=80',
		'https://images.unsplash.com/photo-1523961131990-5ea7c61b2107?w=300&q=80',
		'https://images.unsplash.com/photo-1496568816309-51d7c20e3b21?w=300&q=80'
	]
	}: Props = $props();

	let container: HTMLDivElement | null = null;
	let introPhase = $state<AnimationPhase>('scatter');
	let showIntroText = $state(true);

	let containerW = $state(0);
	let containerH = $state(0);

	const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n));
	const lerp = (a: number, b: number, t: number) => a * (1 - t) + b * t;

	// Mouse parallax (px) for subtle life while static.
	const parallaxX = spring(0, { stiffness: 0.06, damping: 0.35 });

	type CardSprings = {
		x: Spring<number>;
		y: Spring<number>;
		rotation: Spring<number>;
		scale: Spring<number>;
		opacity: Spring<number>;
	};

	const cards: CardSprings[] = Array.from({ length: TOTAL_IMAGES }, () => ({
		x: spring(0, { stiffness: 0.08, damping: 0.35 }),
		y: spring(0, { stiffness: 0.08, damping: 0.35 }),
		rotation: spring(0, { stiffness: 0.08, damping: 0.35 }),
		scale: spring(1, { stiffness: 0.08, damping: 0.35 }),
		opacity: spring(1, { stiffness: 0.08, damping: 0.35 })
	}));

	// Snapshot of spring values for template rendering (Svelte forbids `$store` on non-top-level vars).
	let cardVals = $state<Target[]>(Array.from({ length: TOTAL_IMAGES }, () => ({
		x: 0,
		y: 0,
		rotation: 0,
		scale: 1,
		opacity: 1
	})));

	const scatterTargets: Target[] = Array.from({ length: TOTAL_IMAGES }, () => ({
		x: (Math.random() - 0.5) * 1500,
		y: (Math.random() - 0.5) * 1000,
		rotation: (Math.random() - 0.5) * 180,
		scale: 0.6,
		opacity: 0
	}));

	function setCard(i: number, t: Target) {
		cards[i].x.set(t.x);
		cards[i].y.set(t.y);
		cards[i].rotation.set(t.rotation);
		cards[i].scale.set(t.scale);
		cards[i].opacity.set(t.opacity);
	}

	function computeTarget(i: number): Target {
		// Scatter → line
		if (introPhase === 'scatter') return scatterTargets[i];
		if (introPhase === 'line') {
			const lineSpacing = 70;
			const lineTotalWidth = TOTAL_IMAGES * lineSpacing;
			const lineX = i * lineSpacing - lineTotalWidth / 2;
			return { x: lineX, y: 0, rotation: 0, scale: 1, opacity: 1 };
		}

		// Final state: big circle (no scroll morph/rotation).
		const px = $parallaxX;

		const isMobile = containerW < 768;
		const minDim = Math.min(containerW, containerH || containerW);

		// Bigger than before; clamps keep it inside typical hero heights.
		const circleRadius = Math.min(minDim * (isMobile ? 0.48 : 0.44), isMobile ? 420 : 520);
		const circleAngle = (i / TOTAL_IMAGES) * 360;
		const circleRad = (circleAngle * Math.PI) / 180;
		return {
			x: Math.cos(circleRad) * circleRadius + px,
			y: Math.sin(circleRad) * circleRadius,
			rotation: circleAngle + 90,
			scale: isMobile ? 1.25 : 1.35,
			opacity: 1
		};
	}

	// Recompute and animate to new targets whenever inputs change.
	$effect(() => {
		for (let i = 0; i < TOTAL_IMAGES; i++) setCard(i, computeTarget(i));
	});

	onMount(() => {
		if (!container) return;

		// Subscribe to springs once; write into cardVals for rendering.
		const unsubs: Array<() => void> = [];
		for (let i = 0; i < TOTAL_IMAGES; i++) {
			unsubs.push(cards[i].x.subscribe((v) => (cardVals[i] = { ...(cardVals[i] ?? { x: 0, y: 0, rotation: 0, scale: 1, opacity: 1 }), x: v })));
			unsubs.push(cards[i].y.subscribe((v) => (cardVals[i] = { ...(cardVals[i] ?? { x: 0, y: 0, rotation: 0, scale: 1, opacity: 1 }), y: v })));
			unsubs.push(cards[i].rotation.subscribe((v) => (cardVals[i] = { ...(cardVals[i] ?? { x: 0, y: 0, rotation: 0, scale: 1, opacity: 1 }), rotation: v })));
			unsubs.push(cards[i].scale.subscribe((v) => (cardVals[i] = { ...(cardVals[i] ?? { x: 0, y: 0, rotation: 0, scale: 1, opacity: 1 }), scale: v })));
			unsubs.push(cards[i].opacity.subscribe((v) => (cardVals[i] = { ...(cardVals[i] ?? { x: 0, y: 0, rotation: 0, scale: 1, opacity: 1 }), opacity: v })));
		}

		// Resize observer
		const ro = new ResizeObserver((entries) => {
			for (const entry of entries) {
				containerW = entry.contentRect.width;
				containerH = entry.contentRect.height;
			}
		});
		ro.observe(container);
		containerW = container.offsetWidth;
		containerH = container.offsetHeight;

		// Intro timing
		const t1 = window.setTimeout(() => (introPhase = 'line'), 500);
		const t2 = window.setTimeout(() => (introPhase = 'circle'), 2500);
		const t3 = window.setTimeout(() => (showIntroText = false), 3600);

		const onMouseMove = (e: MouseEvent) => {
			const rect = container!.getBoundingClientRect();
			const relativeX = e.clientX - rect.left;
			const normalizedX = (relativeX / Math.max(1, rect.width)) * 2 - 1;
			parallaxX.set(normalizedX * 100);
		};

		container.addEventListener('mousemove', onMouseMove);

		return () => {
			for (const u of unsubs) {
				try { u(); } catch {}
			}
			try { ro.disconnect(); } catch {}
			window.clearTimeout(t1);
			window.clearTimeout(t2);
			window.clearTimeout(t3);
			container?.removeEventListener('mousemove', onMouseMove as any);
		};
	});
</script>

<div bind:this={container} class="relative w-full h-full bg-[#FAFAFA] overflow-hidden">
	<!-- Intro text -->
	{#if introPhase === 'circle' && showIntroText}
		<div class="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
			<div
				class="transition-all duration-700"
				style="opacity: 1; transform: translateY(0px); filter: blur(0px);"
			>
				<h1 class="text-2xl font-medium tracking-tight text-gray-800 md:text-4xl">
					The future is built on AI.
				</h1>
				<p class="mt-4 text-xs font-bold tracking-[0.2em] text-gray-500">
					SCROLL TO EXPLORE
				</p>
			</div>
		</div>
	{/if}

	<!-- Active content -->
	<div
		class="absolute top-[10%] z-10 flex w-full flex-col items-center justify-center text-center pointer-events-none px-4 transition-all duration-700"
		style="opacity: {introPhase === 'circle' && !showIntroText ? 1 : 0}; transform: translateY({introPhase === 'circle' && !showIntroText ? 0 : 20}px);"
	>
		<h2 class="text-3xl md:text-5xl font-semibold text-gray-900 tracking-tight mb-4">
			Explore Our Vision
		</h2>
		<p class="text-sm md:text-base text-gray-600 max-w-lg leading-relaxed">
			Discover a world where technology meets creativity.
			<br class="hidden md:block" />
			Scroll through our curated collection of innovations designed to shape the future.
		</p>
	</div>

	<!-- Cards -->
	<div class="absolute inset-0 flex items-center justify-center">
		{#each images.slice(0, TOTAL_IMAGES) as src, i (i)}
			<div
				class="cursor-default"
				style="
					position:absolute;
					width:{IMG_WIDTH}px;height:{IMG_HEIGHT}px;
					opacity:{clamp(cardVals[i]?.opacity ?? 1,0,1)};
					transform:
						translate3d({cardVals[i]?.x ?? 0}px, {cardVals[i]?.y ?? 0}px, 0)
						rotate({cardVals[i]?.rotation ?? 0}deg)
						scale({cardVals[i]?.scale ?? 1});
					transform-style: preserve-3d;
					perspective: 1000px;
				"
			>
				<div
					class="relative h-full w-full hoverFlip"
					style="
						transform-style: preserve-3d;
						transition: transform 600ms cubic-bezier(.2,.8,.2,1);
					"
				>
					<!-- Front -->
					<div
						class="absolute inset-0 h-full w-full overflow-hidden rounded-xl shadow-lg bg-gray-200"
						style="backface-visibility:hidden;"
					>
						<img src={src} alt={`hero-${i}`} class="h-full w-full object-cover" />
						<div class="absolute inset-0 bg-black/10"></div>
					</div>
					<!-- Back -->
					<div
						class="absolute inset-0 h-full w-full overflow-hidden rounded-xl shadow-lg bg-gray-900 flex flex-col items-center justify-center p-4 border border-gray-700"
						style="backface-visibility:hidden; transform: rotateY(180deg);"
					>
						<div class="text-center">
							<p class="text-[8px] font-bold text-blue-400 uppercase tracking-widest mb-1">View</p>
							<p class="text-xs font-medium text-white">Details</p>
						</div>
					</div>
				</div>
			</div>
		{/each}
	</div>
</div>
