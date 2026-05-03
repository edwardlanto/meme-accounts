<script lang="ts">
	import { onDestroy } from 'svelte';

	/**
	 * Single-track range control: left thumb = segment start, right thumb = segment end (exclusive).
	 */
	interface Props {
		durationSec: number;
		startSec: number;
		endSec: number;
		minSeg?: number;
		maxSeg?: number;
		onChange: (start: number, end: number) => void;
	}

	let {
		durationSec,
		startSec,
		endSec,
		minSeg = 1,
		maxSeg = 120,
		onChange,
	}: Props = $props();

	let trackEl = $state<HTMLDivElement | null>(null);
	let dragging = $state<'start' | 'end' | null>(null);

	const pct = (t: number) => (durationSec > 0 ? Math.min(100, Math.max(0, (t / durationSec) * 100)) : 0);

	function round1(x: number): number {
		return Math.round(x * 10) / 10;
	}

	function clientToSec(clientX: number): number {
		if (!trackEl || durationSec <= 0) return 0;
		const r = trackEl.getBoundingClientRect();
		const w = Math.max(1e-6, r.width);
		const x = Math.min(Math.max(0, clientX - r.left), w);
		return (x / w) * durationSec;
	}

	function applyStart(raw: number) {
		let s = round1(raw);
		let e = endSec;
		s = Math.max(0, Math.min(s, e - minSeg));
		if (e - s > maxSeg) {
			e = Math.min(durationSec, s + maxSeg);
		}
		onChange(round1(s), round1(e));
	}

	function applyEnd(raw: number) {
		let e = round1(raw);
		let s = startSec;
		e = Math.min(durationSec, Math.max(e, s + minSeg));
		if (e - s > maxSeg) {
			s = Math.max(0, e - maxSeg);
		}
		onChange(round1(s), round1(e));
	}

	function onPointerMove(e: PointerEvent) {
		if (!dragging) return;
		const t = clientToSec(e.clientX);
		if (dragging === 'start') applyStart(t);
		else applyEnd(t);
	}

	function onPointerUp() {
		dragging = null;
		window.removeEventListener('pointermove', onPointerMove);
		window.removeEventListener('pointerup', onPointerUp);
		window.removeEventListener('pointercancel', onPointerUp);
	}

	function beginThumb(which: 'start' | 'end', e: PointerEvent) {
		e.preventDefault();
		e.stopPropagation();
		dragging = which;
		(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
		window.addEventListener('pointermove', onPointerMove, { passive: true });
		window.addEventListener('pointerup', onPointerUp);
		window.addEventListener('pointercancel', onPointerUp);
		const t = clientToSec(e.clientX);
		if (which === 'start') applyStart(t);
		else applyEnd(t);
	}

	function onTrackPointerDown(e: PointerEvent) {
		if ((e.target as HTMLElement).closest('button.burn-seg-thumb')) return;
		if (!trackEl || durationSec <= 0) return;
		e.preventDefault();
		const t = clientToSec(e.clientX);
		const mid = (startSec + endSec) / 2;
		if (t <= mid) applyStart(t);
		else applyEnd(t);
	}

	onDestroy(() => {
		window.removeEventListener('pointermove', onPointerMove);
		window.removeEventListener('pointerup', onPointerUp);
		window.removeEventListener('pointercancel', onPointerUp);
	});
</script>

<div
	class="burn-seg-range"
	role="group"
	aria-label="Segment range on track"
	aria-valuemin={0}
	aria-valuemax={durationSec}
>
	<div
		bind:this={trackEl}
		class="burn-seg-track"
		onpointerdown={onTrackPointerDown}
		role="presentation"
	>
		<div
			class="burn-seg-fill"
			style:left="{pct(startSec)}%"
			style:width="{pct(endSec - startSec)}%"
		></div>
		<button
			type="button"
			class="burn-seg-thumb burn-seg-thumb-start"
			style:left="{pct(startSec)}%"
			aria-label="Segment start"
			aria-valuenow={startSec}
			onpointerdown={(e) => beginThumb('start', e)}
		></button>
		<button
			type="button"
			class="burn-seg-thumb burn-seg-thumb-end"
			style:left="{pct(endSec)}%"
			aria-label="Segment end"
			aria-valuenow={endSec}
			onpointerdown={(e) => beginThumb('end', e)}
		></button>
	</div>
</div>

<style>
	.burn-seg-range {
		padding: 0.35rem 0;
		user-select: none;
		touch-action: none;
	}

	.burn-seg-track {
		position: relative;
		height: 2.25rem;
		cursor: pointer;
		border-radius: 999px;
		background: color-mix(in oklab, var(--burn-seg-muted, #888) 18%, transparent);
		outline: none;
	}

	.burn-seg-fill {
		position: absolute;
		top: 50%;
		height: 0.5rem;
		margin-top: -0.25rem;
		border-radius: 999px;
		background: var(--burn-seg-accent, #0f0f10);
		pointer-events: none;
		min-width: 2px;
	}

	.burn-seg-thumb {
		position: absolute;
		top: 50%;
		width: 1.125rem;
		height: 1.125rem;
		margin-top: -0.5625rem;
		margin-left: -0.5625rem;
		border-radius: 999px;
		border: 2px solid var(--burn-seg-thumb-border, #fff);
		background: var(--burn-seg-accent, #0f0f10);
		box-shadow: 0 1px 4px rgba(0, 0, 0, 0.22);
		cursor: grab;
		padding: 0;
		z-index: 2;
	}

	.burn-seg-thumb-end {
		z-index: 3;
	}

	.burn-seg-thumb:active {
		cursor: grabbing;
		transform: scale(1.06);
	}

	:global([data-theme='dark']) .burn-seg-thumb {
		border-color: color-mix(in oklab, #fff 85%, transparent);
	}
</style>
