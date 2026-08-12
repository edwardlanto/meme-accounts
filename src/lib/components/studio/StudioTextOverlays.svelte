<script lang="ts">
	import TextOverlayLayer from '$lib/components/TextOverlayLayer.svelte';
	import type { TextElementKind, TextOverlay } from '$lib/types';

	interface Props {
		w: number;
		h: number;
		scale?: number;
		interactive?: boolean;
		highlightColor?: string;
		textOverlays: TextOverlay[];
		parseHighlightMarkup?: boolean;
		/** Snap text box center to canvas center while dragging. */
		snapToCanvasCenter?: boolean;
		/** Outer CSS scale (blank canvas export wrapper) for pointer math. */
		pointerScale?: number;
		/** Which studio text target is active (not the DOM selection API). */
		activeTextKind: TextElementKind | null;
		/** Null when nothing selected; mirrors `TextOverlayLayer.selectedId`. */
		activeTextOverlayId: string | null;
		onRangeSelect?: (plainStart: number, plainEnd: number) => void;
		onTextOverlaysChange?: (next: TextOverlay[]) => void;
		onTextSelect?: (kind: 'textOverlay', anchor: HTMLElement) => void;
	}

	let {
		w,
		h,
		scale = 1,
		interactive = true,
		highlightColor = '#F5A623',
		textOverlays,
		parseHighlightMarkup = false,
		snapToCanvasCenter = true,
		pointerScale,
		activeTextKind,
		activeTextOverlayId,
		onRangeSelect,
		onTextOverlaysChange,
		onTextSelect,
	}: Props = $props();

	const selectedId = $derived(activeTextKind === 'textOverlay' ? activeTextOverlayId : null);
</script>

<!-- Shared across all Studio templates — edit once to change behavior everywhere (Canva-style shell). -->
<TextOverlayLayer
	{w}
	{h}
	{scale}
	{interactive}
	{highlightColor}
	{parseHighlightMarkup}
	{snapToCanvasCenter}
	{pointerScale}
	textOverlays={textOverlays ?? []}
	{selectedId}
	{onRangeSelect}
	{onTextOverlaysChange}
	{onTextSelect}
/>
