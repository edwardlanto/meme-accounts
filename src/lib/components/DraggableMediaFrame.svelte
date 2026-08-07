<script lang="ts">
	/**
	 * Shared studio media chrome: drag to reposition, corner handle to stretch.
	 * Used by video templates, image-quote, and any framed image/video.
	 * Not marked `data-text-selectable` so drag starts immediately (unlike text blocks).
	 */
	import type { Snippet } from 'svelte';
	import DraggableBlock from '$lib/components/DraggableBlock.svelte';

	interface Props {
		dx?: number;
		dy?: number;
		/** Uniform scale of the frame inside its parent (1 = fill). */
		stretch?: number;
		scale?: number;
		interactive?: boolean;
		selected?: boolean;
		/** Stretch parent to 100% (video slots). */
		fill?: boolean;
		frameStyle?: string;
		title?: string;
		onOffsetChange?: (x: number, y: number) => void;
		onStretchChange?: (stretch: number) => void;
		onSelect?: (el: HTMLElement) => void;
		onDblClick?: (detail: { clientX: number; clientY: number }) => void;
		children: Snippet;
	}

	let {
		dx = 0,
		dy = 0,
		stretch = 1,
		scale = 1,
		interactive = true,
		selected = false,
		fill = true,
		frameStyle = '',
		title = undefined,
		onOffsetChange,
		onStretchChange,
		onSelect,
		onDblClick,
		children,
	}: Props = $props();

	const stretchClamped = $derived(Math.max(0.4, Math.min(1.75, Number(stretch) || 1)));

	let resizeStart: { x: number; y: number; stretch: number } | null = null;

	function clampStretch(v: number) {
		return Math.max(0.4, Math.min(1.75, v));
	}

	function selectFromEvent(el: HTMLElement) {
		if (!interactive || !onSelect) return;
		onSelect(el);
	}

	function onFramePointerDown(e: PointerEvent) {
		if (!interactive) return;
		selectFromEvent(e.currentTarget as HTMLElement);
	}

	function onFrameClick(e: MouseEvent) {
		if (!interactive) return;
		e.stopPropagation();
		selectFromEvent(e.currentTarget as HTMLElement);
	}

	function onFrameDblClick(e: MouseEvent) {
		if (!interactive || !onDblClick) return;
		e.stopPropagation();
		e.preventDefault();
		onDblClick({ clientX: e.clientX, clientY: e.clientY });
	}

	function startResize(e: PointerEvent) {
		if (!interactive || !onStretchChange) return;
		e.preventDefault();
		e.stopPropagation();
		(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
		resizeStart = {
			x: e.clientX,
			y: e.clientY,
			stretch: stretchClamped,
		};
	}

	function moveResize(e: PointerEvent) {
		if (!resizeStart || !onStretchChange) return;
		const rdx = (e.clientX - resizeStart.x) / Math.max(0.001, scale);
		const rdy = (e.clientY - resizeStart.y) / Math.max(0.001, scale);
		const delta = (rdx + rdy) / 2;
		onStretchChange(clampStretch(resizeStart.stretch + delta / 520));
	}

	function endResize() {
		resizeStart = null;
	}
</script>

<DraggableBlock
	{dx}
	{dy}
	{interactive}
	{scale}
	{fill}
	onChange={(x, y) => onOffsetChange?.(x, y)}
>
	{#snippet children()}
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div
			role="presentation"
			data-studio-media-frame
			onpointerdown={onFramePointerDown}
			onclick={onFrameClick}
			ondblclick={onFrameDblClick}
			onpointermove={moveResize}
			onpointerup={endResize}
			onpointercancel={endResize}
			title={title ?? (interactive ? 'Drag to move · Corner to expand · Double-click for BG tools' : undefined)}
			style="
				position: relative;
				width: {stretchClamped * 100}%;
				height: {stretchClamped * 100}%;
				min-height: 0;
				margin: 0 auto;
				touch-action: none;
				cursor: {interactive ? 'grab' : 'default'};
				box-sizing: border-box;
				{selected && interactive
					? 'box-shadow: 0 0 0 2px rgba(139, 92, 246, 0.7);'
					: ''}
				{frameStyle}
			"
		>
			{@render children()}
			{#if interactive && selected && onStretchChange}
				<div
					data-draggable-no-pan
					style="
						position: absolute;
						right: 10px;
						bottom: 10px;
						z-index: 4;
						width: 22px;
						height: 22px;
						border-radius: 8px;
						background: rgba(0,0,0,0.5);
						border: 1px solid rgba(255,255,255,0.25);
						display: flex;
						align-items: center;
						justify-content: center;
						cursor: nwse-resize;
						pointer-events: auto;
						touch-action: none;
					"
					onpointerdown={startResize}
					title="Drag to expand media"
					role="button"
					tabindex="0"
					aria-label="Expand media frame"
				>
					<div
						style="
							width: 10px;
							height: 10px;
							border-right: 2px solid rgba(255,255,255,0.8);
							border-bottom: 2px solid rgba(255,255,255,0.8);
							transform: translate(1px, 1px);
						"
					></div>
				</div>
			{/if}
		</div>
	{/snippet}
</DraggableBlock>
