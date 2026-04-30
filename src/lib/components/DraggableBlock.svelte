<script lang="ts">
	/**
	 * Hold-to-drag wrapper for template text elements.
	 * - Pointer down on markup text (`data-draggable-no-pan`, etc.) does not start a drag
	 *   so the user can highlight; hold **Alt** while pressing to drag from inside text.
	 * - Pointer down on chrome: hold (or small move) begins dragging dx/dy (template px).
	 */
	import type { Snippet } from 'svelte';

	interface Props {
		dx?: number;
		dy?: number;
		scale?: number;
		interactive?: boolean;
		holdMs?: number;
		onChange?: (nextDx: number, nextDy: number) => void;
		children: Snippet;
	}

	let {
		dx = 0,
		dy = 0,
		scale = 1,
		interactive = true,
		holdMs = 180,
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

	function beginDrag() {
		dragging = true;
		armed = false;
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
		// Hold-to-drag on body text steals the pointer after ~300ms (broken highlights).
		// Hold Alt while pressing to drag-reposition from inside text.
		if (onSelectableText && !e.altKey) return;

		dragging = false;
		armed = true;
		pointerId = e.pointerId;
		downX = e.clientX;
		downY = e.clientY;
		baseDx = dx;
		baseDy = dy;
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
		const nx = baseDx + dpx / Math.max(0.0001, scale);
		const ny = baseDy + dpy / Math.max(0.0001, scale);
		onChange?.(nx, ny);
		e.preventDefault();
	}

	function endPointer() {
		armed = false;
		dragging = false;
		pointerId = 0;
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
	"
	onpointerdown={onPointerDown}
	onpointermove={onPointerMove}
	onpointerup={endPointer}
	onpointercancel={endPointer}
>
	{@render children()}
</div>

