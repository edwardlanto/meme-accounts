<script lang="ts">
	/**
	 * Hold-to-drag wrapper for template text elements.
	 * - Pointer down on markup text (`data-draggable-no-pan`, etc.) does not start a drag
	 *   so the user can highlight; hold **Alt** while pressing to drag from inside text.
	 * - Pointer down on chrome: hold (or small move) begins dragging dx/dy (template px).
	 * - Optional center snap: when the block’s center nears `snapRoot`’s center, offsets lock
	 *   and light crosshair guides appear.
	 */
	import type { Snippet } from 'svelte';

	interface Props {
		dx?: number;
		dy?: number;
		scale?: number;
		interactive?: boolean;
		holdMs?: number;
		/**
		 * When true (default), pointer-down on markup text can still arm hold-to-drag /
		 * nudge-drag. Pass false to require Alt+drag over selectable text.
		 */
		holdDragFromText?: boolean;
		/** Stretch to parent box (needed when wrapping absolutely-positioned media). */
		fill?: boolean;
		/** Snap block center to snapRoot (or viewport) center while dragging. */
		snapToCenter?: boolean;
		/** Canvas / export root used for center snap bounds. */
		snapRoot?: HTMLElement | null;
		onChange?: (nextDx: number, nextDy: number) => void;
		children: Snippet;
	}

	let {
		dx = 0,
		dy = 0,
		scale = 1,
		interactive = true,
		holdMs = 180,
		/** Default on: all templates share hold/nudge-to-drag from text. Pass false to force Alt-only. */
		holdDragFromText = true,
		fill = false,
		snapToCenter = false,
		snapRoot = null,
		onChange,
		children,
	}: Props = $props();

	let root = $state<HTMLElement | null>(null);
	let downX = 0;
	let downY = 0;
	let baseDx = 0;
	let baseDy = 0;
	let dragging = $state(false);
	let armed = false;
	let pointerId = 0;
	let holdTimer: any = null;
	let snapGuide = $state<null | { x?: number; y?: number }>(null);
	let snappedAxisX = false;
	let snappedAxisY = false;

	const SNAP_IN_PX = 12;
	const SNAP_OUT_PX = 20;

	function beginDrag() {
		dragging = true;
		armed = false;
		snappedAxisX = false;
		snappedAxisY = false;
		snapGuide = null;
		if (holdTimer) clearTimeout(holdTimer);
		holdTimer = null;
		// Only capture once we commit to dragging, so clicks still focus editors.
		if (pointerId) {
			try { root?.setPointerCapture(pointerId); } catch {}
		}
	}

	function onPointerDown(e: PointerEvent) {
		if (!interactive) return;
		// Only left mouse / primary touch.
		if ((e as any).button != null && (e as any).button !== 0) return;

		const t = e.target as HTMLElement | null;
		const onSelectableText = !!t?.closest?.(
			'[data-draggable-no-pan],[contenteditable="true"],[data-text-selectable="true"]',
		);
		// Let the inner markup layer own the gesture for selection/editing.
		// Hold Alt while pressing to drag-reposition from inside text (default).
		// Optional `holdDragFromText`: hold timer / small move can still start a block drag.
		if (onSelectableText && !e.altKey && !holdDragFromText) return;

		dragging = false;
		armed = true;
		pointerId = e.pointerId;
		downX = e.clientX;
		downY = e.clientY;
		baseDx = dx;
		baseDy = dy;
		snapGuide = null;
		if (holdTimer) clearTimeout(holdTimer);
		holdTimer = setTimeout(() => {
			if (!armed) return;
			beginDrag();
		}, holdMs);
	}

	function onPointerMove(e: PointerEvent) {
		if (!interactive) return;
		if (!armed && !dragging) return;
		const mx = e.clientX;
		const my = e.clientY;
		const dpx = mx - downX;
		const dpy = my - downY;
		// Fast “nudge to drag” when the pointer started on chrome (not on markup text).
		if (!dragging && armed && Math.abs(dpx) + Math.abs(dpy) > 6) beginDrag();
		if (!dragging) return;
		const s = Math.max(0.0001, scale);
		let nx = baseDx + dpx / s;
		let ny = baseDy + dpy / s;

		if (snapToCenter && root) {
			const elRect = root.getBoundingClientRect();
			const bounds = snapRoot?.getBoundingClientRect() ?? null;
			if (bounds && bounds.width > 0 && bounds.height > 0) {
				const midX = bounds.left + bounds.width / 2;
				const midY = bounds.top + bounds.height / 2;
				const curCx = elRect.left + elRect.width / 2;
				const curCy = elRect.top + elRect.height / 2;
				const visualCx = curCx + (nx - dx) * s;
				const visualCy = curCy + (ny - dy) * s;
				snapGuide = null;

				if (snappedAxisX || Math.abs(visualCx - midX) <= SNAP_IN_PX) {
					if (Math.abs(visualCx - midX) <= SNAP_OUT_PX) {
						nx = nx - (visualCx - midX) / s;
						snappedAxisX = true;
						snapGuide = { ...(snapGuide ?? {}), x: midX };
					} else {
						snappedAxisX = false;
					}
				}
				if (snappedAxisY || Math.abs(visualCy - midY) <= SNAP_IN_PX) {
					if (Math.abs(visualCy - midY) <= SNAP_OUT_PX) {
						ny = ny - (visualCy - midY) / s;
						snappedAxisY = true;
						snapGuide = { ...(snapGuide ?? {}), y: midY };
					} else {
						snappedAxisY = false;
					}
				}
			}
		}

		onChange?.(nx, ny);
		e.preventDefault();
	}

	function endPointer() {
		armed = false;
		dragging = false;
		pointerId = 0;
		snapGuide = null;
		snappedAxisX = false;
		snappedAxisY = false;
		if (holdTimer) clearTimeout(holdTimer);
		holdTimer = null;
	}
</script>

<div
	bind:this={root}
	style="
		transform: translate({dx}px, {dy}px);
		touch-action: none;
		cursor: {interactive ? (dragging ? 'grabbing' : 'default') : 'default'};
		{fill ? 'width:100%;height:100%;' : ''}
	"
	onpointerdown={onPointerDown}
	onpointermove={onPointerMove}
	onpointerup={endPointer}
	onpointercancel={endPointer}
>
	{@render children()}
</div>

{#if snapToCenter && snapGuide?.x != null}
	<div
		aria-hidden="true"
		style="
			position: fixed;
			left: {snapGuide.x}px;
			top: 0;
			bottom: 0;
			width: 1px;
			background: rgba(56, 189, 248, 0.85);
			pointer-events: none;
			z-index: 99999;
		"
	></div>
{/if}
{#if snapToCenter && snapGuide?.y != null}
	<div
		aria-hidden="true"
		style="
			position: fixed;
			top: {snapGuide.y}px;
			left: 0;
			right: 0;
			height: 1px;
			background: rgba(56, 189, 248, 0.85);
			pointer-events: none;
			z-index: 99999;
		"
	></div>
{/if}
