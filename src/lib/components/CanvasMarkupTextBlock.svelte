<script lang="ts">
	/**
	 * Inline [[...]] markup editing for canvas templates: double-click to edit,
	 * single click / text drag for floating toolbar (when callbacks are wired).
	 */
	import type { Snippet } from 'svelte';
	import type { TextElementKind } from '$lib/types';
	import { parseHighlightMarkup } from '$lib/highlight';
	import HighlightEditor from '$lib/components/HighlightEditor.svelte';

	interface Props {
		value: string;
		interactive?: boolean;
		defaultColor?: string;
		/** When true, show violet focus ring (toolbar selection). */
		selected?: boolean;
		toolbarKind?: TextElementKind;
		rows?: number;
		/** Override editor min-height (useful for tight, content-hugging boxes). */
		minHeight?: string;
		uppercase?: boolean;
		showToolbar?: boolean;
		fontFamily?: string;
		fontSize?: number;
		ariaLabel?: string;
		onTextChange?: (v: string) => void;
		onTextSelect?: (kind: TextElementKind, el: HTMLElement) => void;
		onHeadlineRangeSelect?: (start: number, end: number) => void;
		display: Snippet;
	}

	let {
		value,
		interactive = false,
		defaultColor = '#F59E0B',
		selected = false,
		toolbarKind = 'headline',
		rows = 6,
		minHeight,
		uppercase = false,
		showToolbar = false,
		fontFamily,
		fontSize,
		ariaLabel = 'Slide text',
		onTextChange,
		onTextSelect,
		onHeadlineRangeSelect,
		display,
	}: Props = $props();

	const canEdit = $derived(!!interactive && typeof onTextChange === 'function');

	let editing = $state(false);
	let displayRoot = $state<HTMLElement | null>(null);
	let editableEl = $state<HTMLElement | null>(null);
	let editTextColor = $state<string | null>(null);

	const expectedPlain = $derived(parseHighlightMarkup(value, defaultColor).plain);

	function domPlainDeep(root: HTMLElement): string {
		const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
		let s = '';
		let n: Node | null;
		while ((n = w.nextNode())) s += n.nodeValue ?? '';
		return s;
	}

	function wrapRectAsAnchor(rect: DOMRect): HTMLElement {
		const ghost = document.createElement('div');
		(ghost as unknown as { getBoundingClientRect: () => DOMRect }).getBoundingClientRect =
			() => rect;
		return ghost;
	}

	function getPlainSelectionRange(): { start: number; end: number } | null {
		const root = displayRoot;
		if (!root) return null;
		if (domPlainDeep(root) !== expectedPlain) return null;

		const sel = window.getSelection();
		if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return null;
		const range = sel.getRangeAt(0);
		if (!root.contains(range.startContainer) || !root.contains(range.endContainer)) return null;

		function boundaryPlainLen(headlineRoot: HTMLElement, container: Node, offset: number): number {
			const r = document.createRange();
			try {
				r.selectNodeContents(headlineRoot);
				r.setEnd(container, offset);
				return r.toString().length;
			} catch {
				return -1;
			}
		}

		const start = boundaryPlainLen(root, range.startContainer, range.startOffset);
		const end = boundaryPlainLen(root, range.endContainer, range.endOffset);
		if (start < 0 || end < 0) return null;
		if (start === end) return null;
		return start < end ? { start, end } : { start: end, end: start };
	}

	function onDisplayMouseUp() {
		if (!interactive || !onTextSelect) return;
		setTimeout(() => {
			const sel = window.getSelection();
			const hasRange =
				sel &&
				sel.rangeCount > 0 &&
				!sel.isCollapsed &&
				displayRoot?.contains(sel.anchorNode);

			if (hasRange && displayRoot) {
				const range = sel.getRangeAt(0);
				const rect = range.getBoundingClientRect();
				onTextSelect?.(toolbarKind, wrapRectAsAnchor(rect));
				const r = getPlainSelectionRange();
				onHeadlineRangeSelect?.(r?.start ?? -1, r?.end ?? -1);
			} else {
				if (displayRoot) onTextSelect?.(toolbarKind, displayRoot);
				onHeadlineRangeSelect?.(-1, -1);
			}
		}, 0);
	}

	function startEdit(e: MouseEvent) {
		if (!canEdit) return;
		e.stopPropagation();
		// Match the visible template text color while editing (each template is independent).
		// This avoids inheriting an unrelated outer color (e.g. white UI chrome).
		try {
			if (displayRoot) editTextColor = getComputedStyle(displayRoot).color;
		} catch {
			editTextColor = null;
		}
		editing = true;
		setTimeout(() => {
			const ce = editableEl?.querySelector<HTMLElement>('[contenteditable="true"]');
			if (ce) {
				ce.focus();
				const range = document.createRange();
				range.selectNodeContents(ce);
				range.collapse(false);
				const s = window.getSelection();
				s?.removeAllRanges();
				s?.addRange(range);
			}
			// Anchor the toolbar to a fixed rect at the top of the editable area
			// during inline editing so it doesn't vanish as the editor expands.
			if (editableEl) {
				const rect = editableEl.getBoundingClientRect();
				const fixedRect = new DOMRect(rect.left, rect.top, rect.width, 0);
				onTextSelect?.(toolbarKind, wrapRectAsAnchor(fixedRect));
			}
		}, 10);
	}

	function finishEdit() {
		if (!editing) return;
		editing = false;
	}

	function onEditKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') finishEdit();
		if (e.key === 'Enter' && e.shiftKey) {
			e.preventDefault();
			finishEdit();
		}
	}
</script>

{#if !interactive}
	{@render display()}
{:else if editing && canEdit}
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		bind:this={editableEl}
		data-text-selectable="true"
		onkeydown={onEditKeydown}
		onclick={(e) => e.stopPropagation()}
		onmousedown={(e) => e.stopPropagation()}
		style="margin: 0; padding: 0; color: {editTextColor ?? 'inherit'}; box-shadow: 0 0 0 2px rgba(239, 68, 68, 0.55); border-radius: 4px; cursor: text;"
	>
		<HighlightEditor
			value={value}
			{rows}
			{defaultColor}
			{uppercase}
			{fontFamily}
			{fontSize}
			{showToolbar}
			{ariaLabel}
			{minHeight}
			onChange={(v) => onTextChange?.(v)}
			onBlur={finishEdit}
			onSelectionChange={(has, r) => {
				if (has && r) onHeadlineRangeSelect?.(r.start, r.end);
				else onHeadlineRangeSelect?.(-1, -1);
			}}
		/>
	</div>
{:else}
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		bind:this={displayRoot}
		ondblclick={startEdit}
		onmouseup={onDisplayMouseUp}
		role="button"
		tabindex="0"
		onkeydown={(e) => {
			if (e.key === 'Enter' || e.key === ' ') {
				e.preventDefault();
				if (displayRoot) onTextSelect?.(toolbarKind, displayRoot);
			}
		}}
		style="
			position: relative;
			{selected ? 'box-shadow: 0 0 0 2px rgba(139,92,246,0.6);' : ''}
			border-radius: 4px;
			{canEdit ? 'cursor: text; user-select: text; -webkit-user-select: text;' : ''}
		"
		title={canEdit ? 'Double-click to edit text' : undefined}
	>
		{@render display()}
	</div>
{/if}
