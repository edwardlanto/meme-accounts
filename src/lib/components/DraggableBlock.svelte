<script lang="ts">
	/**
	 * Hold-to-drag wrapper for template text elements.
	 * - Drag on markup text → native highlight / selection (block does not steal the gesture).
	 * - Hold still on text (~holdMs), then drag → move the block (when holdDragFromText).
	 * - Alt+drag on text → move the block immediately.
	 * - When `immediateTextDrag` is set (element already selected): drag moves the block;
	 *   Shift+drag still highlights text; double-click still edits.
	 * - Never steals gestures from an active contenteditable.
	 * - Pointer down on chrome / padding: small move or hold begins dragging dx/dy (template px).
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
		 * When true (default), a still hold on markup text can start a block drag.
		 * Quick drag on text always selects. Pass false to require Alt+drag over text.
		 */
		holdDragFromText?: boolean;
		/**
		 * When true, pointer-down on selectable text nudges into a block drag immediately
		 * (same as chrome). Use after the element is already selected so a follow-up drag
		 * repositions. Shift+drag still selects text; contenteditable is never stolen.
		 */
		immediateTextDrag?: boolean;
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
		holdMs = 220,
		/** Default on: still-hold on text can drag; never steal a quick selection drag. */
		holdDragFromText = true,
		immediateTextDrag = false,
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
	/** True when the gesture began on selectable / editable text (not chrome). */
	let startedOnText = false;
	/** Alt was held at pointer-down — allow immediate drag from text. */
	let startedWithAlt = false;
	let snapGuide = $state<null | { x?: number; y?: number }>(null);
	let snappedAxisX = false;
	let snappedAxisY = false;

	const SNAP_IN_PX = 12;
	const SNAP_OUT_PX = 20;
	/** Chrome / Alt / selected-move: start block drag after this much pointer travel. */
	const NUDGE_PX = 6;
	/**
	 * Text selection mode: abort hold-to-drag after a clear highlight stroke.
	 * High enough that mouse jitter during a still-hold does not cancel move.
	 */
	const SELECT_CANCEL_PX = 16;

	function beginDrag() {
		dragging = true;
		armed = false;
		snappedAxisX = false;
		snappedAxisY = false;
		snapGuide = null;
		if (holdTimer) clearTimeout(holdTimer);
		holdTimer = null;
		// Only capture once we commit to dragging, so clicks / selection still work.
		if (pointerId) {
			try { root?.setPointerCapture(pointerId); } catch {}
		}
		try {
			window.getSelection()?.removeAllRanges();
		} catch {
			/* ignore */
		}
	}

	function cancelArm() {
		armed = false;
		if (holdTimer) clearTimeout(holdTimer);
		holdTimer = null;
	}

	function onPointerDown(e: PointerEvent) {
		if (!interactive) return;
		// Only left mouse / primary touch.
		if ((e as any).button != null && (e as any).button !== 0) return;

		const t = e.target as HTMLElement | null;
		// Inline editors own their gestures (highlight / caret) — never steal.
		if (t?.closest?.('[contenteditable="true"]') && !e.altKey) return;

		const onSelectableText = !!t?.closest?.(
			'[data-draggable-no-pan],[data-text-selectable]',
		);
		// Shift forces highlight even when the block is in move-on-drag mode.
		const forceTextSelect = !!e.shiftKey;
		startedOnText = onSelectableText && (!immediateTextDrag || forceTextSelect);
		startedWithAlt = !!e.altKey;

		// Text without Alt: either allow still-hold-to-drag, move-on-drag, or leave to selection.
		if (
			onSelectableText &&
			!e.altKey &&
			!holdDragFromText &&
			!immediateTextDrag &&
			!forceTextSelect
		) {
			return;
		}

		dragging = false;
		armed = true;
		pointerId = e.pointerId;
		downX = e.clientX;
		downY = e.clientY;
		baseDx = dx;
		baseDy = dy;
		snapGuide = null;
		if (holdTimer) clearTimeout(holdTimer);
		holdTimer = null;

		// Selected move-on-drag: no hold timer so a plain click / double-click stays a click.
		// Hold-to-drag only when we are in text-selection gesture mode.
		if (!(immediateTextDrag && !forceTextSelect && !startedOnText)) {
			holdTimer = setTimeout(() => {
				if (!armed) return;
				beginDrag();
			}, holdMs);
		}
	}

	function onPointerMove(e: PointerEvent) {
		if (!interactive) return;
		if (!armed && !dragging) return;
		const mx = e.clientX;
		const my = e.clientY;
		const dpx = mx - downX;
		const dpy = my - downY;
		const travel = Math.abs(dpx) + Math.abs(dpy);
		const moved = travel > NUDGE_PX;

		if (!dragging && armed && moved) {
			// Chrome / Alt: nudge immediately into a block drag.
			if (!startedOnText || startedWithAlt) {
				beginDrag();
			} else {
				// Text without Alt: keep the hold timer alive through tiny jitter.
				// Only cancel once movement looks like an intentional highlight stroke.
				if (travel > SELECT_CANCEL_PX) {
					cancelArm();
				}
				return;
			}
		}
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
		startedOnText = false;
		startedWithAlt = false;
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
