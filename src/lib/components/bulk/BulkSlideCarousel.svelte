<script lang="ts">
	import type { BulkSlide } from '$lib/studio/bulk-to-studio';
	import { viralityScoreLabel, viralityScoreTone } from '$lib/studio/bulk-video-clips';
	import BulkSlidePreview from '$lib/components/bulk/BulkSlidePreview.svelte';

	type Props = {
		slides: BulkSlide[];
		activeSlideId: string;
		onselect: (slideId: string) => void;
		/** Preview width in CSS px */
		width?: number;
		/** Slide ids currently loading stock media */
		loadingSlideIds?: string[];
	};

	let { slides, activeSlideId, onselect, width = 200, loadingSlideIds = [] }: Props = $props();

	const previewWidth = $derived(width);
	const loadingSet = $derived(new Set(loadingSlideIds));

	const activeIdx = $derived(Math.max(0, slides.findIndex((s) => s.id === activeSlideId)));

	let offsetX = $state(0);
	let isDragging = $state(false);
	let animId = 0;
	/** Skip one external sync when this carousel initiated the activeSlideId change. */
	let ignoreNextActiveId = '';
	let syncedActiveId = '';

	let viewportEl: HTMLElement | null = null;
	let dragPointerId: number | null = null;
	let dragStartX = 0;
	let dragStartOffset = 0;
	let dragArmed = false;
	let moveSamples: { x: number; t: number }[] = [];

	const DRAG_THRESHOLD_PX = 6;

	$effect(() => {
		if (isDragging) return;

		const id = activeSlideId;
		if (id === ignoreNextActiveId) {
			ignoreNextActiveId = '';
			syncedActiveId = id;
			return;
		}

		if (id === syncedActiveId) return;
		const firstSync = !syncedActiveId;
		syncedActiveId = id;

		if (animId) {
			cancelAnimationFrame(animId);
			animId = 0;
		}

		const target = -activeIdx * previewWidth;
		if (firstSync) {
			offsetX = target;
			return;
		}

		springTo(target);
	});

	$effect(() => {
		return () => {
			teardownDragListeners();
			if (animId) cancelAnimationFrame(animId);
		};
	});

	function clampIdx(idx: number) {
		return Math.max(0, Math.min(slides.length - 1, idx));
	}

	function selectIndex(idx: number, velocity = 0) {
		const slide = slides[clampIdx(idx)];
		if (!slide) return;
		const target = -clampIdx(idx) * previewWidth;
		ignoreNextActiveId = slide.id;
		if (slide.id !== activeSlideId) onselect(slide.id);
		springTo(target, velocity);
	}

	function rubberBandX(x: number) {
		const minX = -(slides.length - 1) * previewWidth;
		if (x > 0) return x * 0.22;
		if (x < minX) return minX + (x - minX) * 0.22;
		return x;
	}

	function releaseVelocityPxPerSec(): number {
		if (moveSamples.length < 2) return 0;
		const first = moveSamples[0]!;
		const last = moveSamples[moveSamples.length - 1]!;
		const dt = (last.t - first.t) / 1000;
		if (dt < 0.016) return 0;
		return (last.x - first.x) / dt;
	}

	function springTo(target: number, startVelocity = 0) {
		if (animId) cancelAnimationFrame(animId);

		let x = offsetX;
		let v = startVelocity;
		const stiffness = 320;
		const damping = 28;
		const dt = 1 / 60;

		const step = () => {
			const displacement = target - x;
			const acceleration = displacement * stiffness - v * damping;
			v += acceleration * dt;
			x += v * dt;

			if (Math.abs(displacement) < 0.4 && Math.abs(v) < 8) {
				offsetX = target;
				animId = 0;
				return;
			}

			offsetX = x;
			animId = requestAnimationFrame(step);
		};

		animId = requestAnimationFrame(step);
	}

	function teardownDragListeners() {
		window.removeEventListener('pointerup', onWindowPointerEnd, true);
		window.removeEventListener('pointercancel', onWindowPointerEnd, true);
	}

	function finishDrag(pointerId: number) {
		if (!dragArmed && !isDragging) return;
		if (dragPointerId != null && pointerId !== dragPointerId) return;

		const wasDragging = isDragging;
		const velocity = wasDragging ? releaseVelocityPxPerSec() : 0;

		isDragging = false;
		dragArmed = false;
		const capturedId = dragPointerId;
		dragPointerId = null;
		teardownDragListeners();

		if (viewportEl && capturedId != null) {
			try {
				if (viewportEl.hasPointerCapture(capturedId)) {
					viewportEl.releasePointerCapture(capturedId);
				}
			} catch {
				/* ignore */
			}
		}

		if (!wasDragging) return;

		const projected = offsetX + velocity * 0.14;
		const idx = clampIdx(Math.round(-projected / previewWidth));
		selectIndex(idx, velocity);
	}

	function onWindowPointerEnd(e: PointerEvent) {
		finishDrag(e.pointerId);
	}

	function onPointerDown(e: PointerEvent) {
		if (slides.length < 2) return;
		if (e.button !== 0 && e.pointerType === 'mouse') return;

		if (animId) {
			cancelAnimationFrame(animId);
			animId = 0;
		}

		viewportEl = e.currentTarget as HTMLElement;
		dragArmed = true;
		isDragging = false;
		dragPointerId = e.pointerId;
		dragStartX = e.clientX;
		dragStartOffset = offsetX;
		moveSamples = [{ x: e.clientX, t: performance.now() }];

		try {
			viewportEl.setPointerCapture(e.pointerId);
		} catch {
			/* ignore */
		}

		teardownDragListeners();
		window.addEventListener('pointerup', onWindowPointerEnd, true);
		window.addEventListener('pointercancel', onWindowPointerEnd, true);
	}

	function onPointerMove(e: PointerEvent) {
		if ((!dragArmed && !isDragging) || e.pointerId !== dragPointerId) return;

		const dx = e.clientX - dragStartX;
		if (!isDragging) {
			if (Math.abs(dx) < DRAG_THRESHOLD_PX) return;
			isDragging = true;
		}

		const now = performance.now();
		moveSamples.push({ x: e.clientX, t: now });
		if (moveSamples.length > 6) moveSamples.shift();

		offsetX = rubberBandX(dragStartOffset + dx);
	}

	function onPointerUp(e: PointerEvent) {
		finishDrag(e.pointerId);
	}

	function onLostPointerCapture(e: PointerEvent) {
		finishDrag(e.pointerId);
	}

	function slideVisualStyle(si: number): string {
		const slideCenter = si * previewWidth + previewWidth / 2;
		const viewCenter = -offsetX + previewWidth / 2;
		const dist = Math.abs(slideCenter - viewCenter) / previewWidth;
		const scale = 1 - Math.min(dist, 1) * 0.055;
		const opacity = 1 - Math.min(dist, 1) * 0.28;
		return `transform: scale(${scale.toFixed(3)}); opacity: ${opacity.toFixed(3)};`;
	}

	const trackStyle = $derived(`transform: translate3d(${offsetX}px, 0, 0);`);
</script>

<div class="bulk-carousel">
	<div
		class="carousel-swipe-viewport"
		class:is-dragging={isDragging}
		style="width:{previewWidth}px"
		onpointerdown={onPointerDown}
		onpointermove={onPointerMove}
		onpointerup={onPointerUp}
		onpointercancel={onPointerUp}
		onlostpointercapture={onLostPointerCapture}
		role="region"
		aria-roledescription="carousel"
		aria-label="Slide preview"
	>
		<div class="carousel-swipe-track" style={trackStyle}>
			{#each slides as sl, si (sl.id)}
				<div
					class="carousel-swipe-slide"
					style="width:{previewWidth}px; {slideVisualStyle(si)}"
					aria-hidden={si !== activeIdx}
				>
					<div class="carousel-frame">
						<span class="film-num">{si + 1}</span>
						{#if sl.clipMeta && !loadingSet.has(sl.id)}
							<div
								class="preview-viral-badge score-{viralityScoreTone(sl.clipMeta.viralityScore)}"
								aria-label="Virality score {viralityScoreLabel(sl.clipMeta.viralityScore)} out of 10"
							>
								<span class="preview-viral-num">{viralityScoreLabel(sl.clipMeta.viralityScore)}</span>
								<span class="preview-viral-label">viral</span>
							</div>
						{/if}
						{#if loadingSet.has(sl.id)}
							<BulkSlidePreview
								slide={{
									...sl,
									/* Only the active slide may unmute — avoids stacked audio. */
									videoMuted: si !== activeIdx || sl.videoMuted !== false,
								}}
								width={previewWidth}
								mediaFetching={true}
							/>
						{:else}
							<BulkSlidePreview
								slide={{
									...sl,
									videoMuted: si !== activeIdx || sl.videoMuted !== false,
								}}
								width={previewWidth}
							/>
						{/if}
					</div>
				</div>
			{/each}
		</div>
	</div>

	{#if slides.length > 1}
		<div class="carousel-dots" role="tablist" aria-label="Slide navigation">
			{#each slides as sl, si (sl.id)}
				<button
					type="button"
					class="carousel-dot"
					class:dot-on={si === activeIdx}
					role="tab"
					aria-selected={si === activeIdx}
					aria-label="Slide {si + 1}"
					onclick={() => selectIndex(si)}
				/>
			{/each}
		</div>
	{/if}
</div>

<style>
	.bulk-carousel {
		display: flex;
		flex-direction: column;
		align-items: stretch;
		gap: 0.5rem;
		width: 100%;
	}
	.carousel-swipe-viewport {
		position: relative;
		overflow: hidden;
		border-radius: 12px;
		touch-action: pan-y;
		cursor: grab;
		user-select: none;
		contain: layout style paint;
	}
	.carousel-swipe-viewport.is-dragging {
		cursor: grabbing;
	}
	.carousel-swipe-track {
		display: flex;
		will-change: transform;
		backface-visibility: hidden;
		pointer-events: none;
	}
	.carousel-swipe-slide {
		flex: 0 0 auto;
		transform-origin: center center;
		will-change: transform, opacity;
	}
	.carousel-frame {
		position: relative;
		line-height: 0;
		border-radius: 12px;
		overflow: hidden;
		box-shadow: 0 2px 10px color-mix(in oklab, var(--app-text) 12%, transparent);
	}
	.film-num {
		position: absolute;
		top: 6px;
		left: 6px;
		z-index: 2;
		font-size: 0.625rem;
		font-weight: 700;
		color: #fff;
		background: rgba(0, 0, 0, 0.55);
		border-radius: 4px;
		padding: 0.1rem 0.3rem;
		line-height: 1.2;
		pointer-events: none;
	}
	.preview-viral-badge {
		position: absolute;
		top: 6px;
		right: 6px;
		z-index: 3;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		min-width: 2.65rem;
		padding: 0.28rem 0.42rem 0.22rem;
		border-radius: 10px;
		box-shadow: 0 2px 10px rgba(0, 0, 0, 0.35);
		line-height: 1;
		pointer-events: none;
	}
	.preview-viral-num {
		font-size: 1.05rem;
		font-weight: 900;
		letter-spacing: -0.03em;
	}
	.preview-viral-label {
		font-size: 0.5rem;
		font-weight: 800;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		margin-top: 0.12rem;
		opacity: 0.92;
	}
	.score-hot {
		background: #e8ff48;
		color: #080808;
	}
	.score-mid {
		background: #fbbf24;
		color: #080808;
	}
	.score-cool {
		background: rgba(255, 255, 255, 0.85);
		color: #334155;
	}
	.carousel-dots {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.38rem;
		padding: 0.1rem 0;
		align-self: center;
	}
	.carousel-dot {
		width: 0.42rem;
		height: 0.42rem;
		border-radius: 999px;
		border: none;
		padding: 0;
		background: color-mix(in oklab, var(--app-text) 22%, transparent);
		cursor: pointer;
		transition:
			transform 0.28s cubic-bezier(0.22, 1, 0.36, 1),
			background 0.28s ease,
			width 0.28s cubic-bezier(0.22, 1, 0.36, 1);
	}
	.carousel-dot:hover {
		background: color-mix(in oklab, var(--app-text) 40%, transparent);
	}
	.carousel-dot.dot-on {
		width: 0.62rem;
		background: var(--app-accent, #e8ff48);
		transform: scale(1.08);
	}
</style>
