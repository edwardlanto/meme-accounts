<script lang="ts">
	import { Trash2 } from 'lucide-svelte';
	import type { Overlay } from '$lib/types';

	interface Props {
		w: number;
		h: number;
		scale?: number;
		interactive?: boolean;
		overlays?: Overlay[];
		onOverlaysChange?: (next: Overlay[]) => void;
	}

	let {
		w,
		h,
		scale = 1,
		interactive = true,
		overlays = [],
		onOverlaysChange,
	}: Props = $props();

	const W = $derived(Math.max(1, Number(w) || 1080));
	const H = $derived(Math.max(1, Number(h) || 1350));

	let activeOverlayId = $state<string | null>(null);
	let overlayAction = $state<'drag' | 'resize' | null>(null);
	let hoveredOverlayId = $state<string | null>(null);
	let ovLastMx = 0;
	let ovLastMy = 0;

	function overlayDragDown(e: PointerEvent, id: string) {
		if (!interactive) return;
		activeOverlayId = id;
		overlayAction = 'drag';
		ovLastMx = e.clientX;
		ovLastMy = e.clientY;
		(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
		e.stopPropagation();
		e.preventDefault();
	}

	function overlayResizeDown(e: PointerEvent, id: string) {
		if (!interactive) return;
		activeOverlayId = id;
		overlayAction = 'resize';
		ovLastMx = e.clientX;
		ovLastMy = e.clientY;
		(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
		e.stopPropagation();
		e.preventDefault();
	}

	function overlayPointerMove(e: PointerEvent, id: string) {
		if (activeOverlayId !== id) return;
		const dx = (e.clientX - ovLastMx) / scale;
		const dy = (e.clientY - ovLastMy) / scale;
		ovLastMx = e.clientX;
		ovLastMy = e.clientY;

		const ov = overlays.find((o) => o.id === id);
		if (!ov) return;

		if (overlayAction === 'drag') {
			const nx = Math.max(0, Math.min(W - ov.w, ov.x + dx));
			const ny = Math.max(0, Math.min(H - ov.h, ov.y + dy));
			onOverlaysChange?.(overlays.map((o) => (o.id === id ? { ...o, x: nx, y: ny } : o)));
		} else if (overlayAction === 'resize') {
			const aspect = ov.w / ov.h;
			const newW = Math.max(60, Math.min(W - ov.x, ov.w + dx));
			const newH = newW / aspect;
			onOverlaysChange?.(overlays.map((o) => (o.id === id ? { ...o, w: newW, h: newH } : o)));
		}
	}

	function overlayPointerUp() {
		activeOverlayId = null;
		overlayAction = null;
	}

	function overlayDelete(e: MouseEvent, id: string) {
		e.stopPropagation();
		onOverlaysChange?.(overlays.filter((o) => o.id !== id));
	}
</script>

<!-- Matches TextOverlayLayer geometry: above template, below text overlays (z-80). -->
<div
	style="
		position: absolute;
		inset: 0;
		z-index: 70;
		width: 100%;
		height: 100%;
		pointer-events: none;
	"
	aria-hidden={overlays.length === 0}
>
	<div
		style="
			width: {W}px;
			height: {H}px;
			position: relative;
			transform: scale({scale});
			transform-origin: top left;
			pointer-events: none;
		"
	>
		{#each overlays as overlay (overlay.id)}
			{#if overlay.kind !== 'grid'}
				{@const isActive = activeOverlayId === overlay.id}
				{@const isHovered = hoveredOverlayId === overlay.id}
				{@const showControls = interactive && (isHovered || isActive)}
				<div
					style="
						position: absolute;
						left: {overlay.x}px; top: {overlay.y}px;
						width: {overlay.w}px; height: {overlay.h}px;
						z-index: 15;
						cursor: {isActive && overlayAction === 'drag' ? 'grabbing' : interactive ? 'grab' : 'default'};
						touch-action: none;
						overflow: visible;
						pointer-events: auto;
					"
					onpointerdown={(e) => overlayDragDown(e, overlay.id)}
					onpointermove={(e) => overlayPointerMove(e, overlay.id)}
					onpointerup={overlayPointerUp}
					onpointercancel={overlayPointerUp}
					onmouseenter={() => (hoveredOverlayId = overlay.id)}
					onmouseleave={() => {
						if (hoveredOverlayId === overlay.id) hoveredOverlayId = null;
					}}
					role="presentation"
				>
					<img
						src={overlay.src}
						alt=""
						style="
							width: 100%; height: 100%;
							object-fit: contain;
							pointer-events: none;
							display: block;
						"
					/>

					{#if showControls}
						<button
							type="button"
							onpointerdown={(e) => {
								e.stopPropagation();
								e.preventDefault();
							}}
							onclick={(e) => overlayDelete(e, overlay.id)}
							style="
								position: absolute; top: -14px; right: -14px;
								width: 36px; height: 36px; border-radius: 50%;
								background: rgba(0,0,0,0.85); border: 2px solid rgba(255,255,255,0.4);
								color: #fff;
								display: flex; align-items: center; justify-content: center;
								cursor: pointer; z-index: 1; touch-action: none;
							"
							title="Remove overlay"
							aria-label="Remove overlay"
						>
							<Trash2 size={18} />
						</button>

						<div
							style="
								position: absolute; bottom: -10px; right: -10px;
								width: 22px; height: 22px; border-radius: 4px;
								background: rgba(0,0,0,0.85); border: 2px solid rgba(255,255,255,0.5);
								cursor: nwse-resize; z-index: 1; touch-action: none;
								display: flex; align-items: center; justify-content: center;
								font-size: 11px; color: rgba(255,255,255,0.8);
							"
							onpointerdown={(e) => overlayResizeDown(e, overlay.id)}
							onpointermove={(e) => overlayPointerMove(e, overlay.id)}
							onpointerup={overlayPointerUp}
							onpointercancel={overlayPointerUp}
							role="presentation"
						>
							⤡
						</div>

						<div
							style="
								position: absolute; inset: -2px;
								border: 2px dashed rgba(255,255,255,0.5);
								border-radius: 4px; pointer-events: none;
							"
						></div>
					{/if}
				</div>
			{/if}
		{/each}
	</div>
</div>
