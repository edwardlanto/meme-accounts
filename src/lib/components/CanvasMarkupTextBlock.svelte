<script lang="ts">
	/**
	 * Inline [[...]] markup editing for canvas templates: double-click to edit,
	 * single click / text drag for floating toolbar (when callbacks are wired).
	 */
	import type { Snippet } from 'svelte';
	import type { TextElementKind, TypographySnapshot } from '$lib/types';
	import { plainRangeFromSelection } from '$lib/highlight';
	import HighlightEditor from '$lib/components/HighlightEditor.svelte';

	interface Props {
		value: string;
		interactive?: boolean;
		defaultColor?: string;
		/**
		 * When true, double-click editing uses HighlightEditor (`[[…]]` markup).
		 * News headline uses a different path; other templates keep this false.
		 */
		allowHighlightMarkup?: boolean;
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
		allowHighlightMarkup = false,
		selected = false,
		toolbarKind = 'headline',
		rows = 6,
		minHeight = '0px',
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
	let editTypography = $state<TypographySnapshot | null>(null);

	function wrapRectAsAnchor(rect: DOMRect): HTMLElement {
		const ghost = document.createElement('div');
		(ghost as unknown as { getBoundingClientRect: () => DOMRect }).getBoundingClientRect =
			() => rect;
		return ghost;
	}

	function getPlainSelectionRange(): { start: number; end: number } | null {
		const root = displayRoot;
		if (!root) return null;
		// Use shared mapping with News template (no strict DOM-vs-parser equality — that
		// blocked second-pass highlights after markup/CSS subtle differences).
		return plainRangeFromSelection(root);
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
		// Match visible canvas typography (weight, size, line-height) — the editor wrapper
		// does not repeat template CSS, so without this the contenteditable inherits from
		// outer frames and looks bolder/lighter than the display layer.
		try {
			if (displayRoot) {
				const typoEl =
					(displayRoot.querySelector('[data-canvas-typography-root]') as HTMLElement | null) ??
					(displayRoot.firstElementChild as HTMLElement | null) ??
					displayRoot;
				const cs = getComputedStyle(typoEl);
				editTextColor = cs.color;
				editTypography = {
					fontWeight: cs.fontWeight,
					fontFamily: cs.fontFamily,
					fontSize: cs.fontSize,
					lineHeight: cs.lineHeight,
					letterSpacing: cs.letterSpacing,
					fontStyle: cs.fontStyle,
					textDecoration: cs.textDecoration,
					textAlign: cs.textAlign,
				};
			} else {
				editTextColor = null;
				editTypography = null;
			}
		} catch {
			editTextColor = null;
			editTypography = null;
		}
		editing = true;
		setTimeout(() => {
			const ce = editableEl?.querySelector<HTMLElement>('[contenteditable="true"]');
			const ta = editableEl?.querySelector<HTMLTextAreaElement>('textarea.plain-canvas-textarea');
			if (ce) {
				ce.focus();
				const range = document.createRange();
				range.selectNodeContents(ce);
				range.collapse(false);
				const s = window.getSelection();
				s?.removeAllRanges();
				s?.addRange(range);
			} else if (ta) {
				ta.focus();
				const n = ta.value.length;
				ta.setSelectionRange(n, n);
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

	function exitEditMode() {
		editing = false;
		editTypography = null;
	}

	function finishEdit(e?: FocusEvent) {
		if (!editing) return;
		const rt = e?.relatedTarget;
		if (rt instanceof Element) {
			if (rt.closest('[data-floating-toolbar], [data-slot="popover-content"]')) return;
		}
		requestAnimationFrame(() => {
			requestAnimationFrame(() => {
				if (!editing) return;
				const ae = document.activeElement;
				if (ae instanceof Element && ae.closest('[data-floating-toolbar], [data-slot="popover-content"]'))
					return;
				editing = false;
				editTypography = null;
			});
		});
	}

	function syncPlainTextareaSelection() {
		const ta = editableEl?.querySelector<HTMLTextAreaElement>('textarea.plain-canvas-textarea');
		if (!ta || !onHeadlineRangeSelect) return;
		const a = ta.selectionStart;
		const b = ta.selectionEnd;
		const start = Math.min(a, b);
		const end = Math.max(a, b);
		if (end > start) onHeadlineRangeSelect(start, end);
		else onHeadlineRangeSelect(-1, -1);
	}

	function onEditKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') exitEditMode();
		if (e.key === 'Enter' && e.shiftKey) {
			e.preventDefault();
			exitEditMode();
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
		data-draggable-no-pan
		onkeydown={onEditKeydown}
		onclick={(e) => e.stopPropagation()}
		onmousedown={(e) => e.stopPropagation()}
		style="margin: 0; padding: 0; color: {editTextColor ?? 'inherit'}; box-shadow: 0 0 0 2px rgba(239, 68, 68, 0.55); border-radius: 4px; cursor: text; touch-action: manipulation;"
	>
		{#if allowHighlightMarkup}
			<HighlightEditor
				value={value}
				{rows}
				{defaultColor}
				{uppercase}
				{fontFamily}
				{fontSize}
				typographySnapshot={editTypography}
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
		{:else}
			<textarea
				{rows}
				aria-label={ariaLabel}
				class="plain-canvas-textarea"
				value={value}
				style="
					display: block; width: 100%; box-sizing: border-box; margin: 0; padding: 6px 8px;
					min-height: {minHeight ?? '0px'};
					resize: none;
					border: none; outline: none; background: transparent;
					color: {editTextColor ?? 'inherit'};
					font-family: {editTypography?.fontFamily ?? (fontFamily ? `'${fontFamily}', sans-serif` : 'inherit')};
					font-size: {editTypography?.fontSize ?? (fontSize ? `${fontSize}px` : 'inherit')};
					font-weight: {editTypography?.fontWeight ?? 'inherit'};
					line-height: {editTypography?.lineHeight ?? 1.35};
					letter-spacing: {editTypography?.letterSpacing ?? 'inherit'};
					font-style: {editTypography?.fontStyle ?? 'inherit'};
					text-decoration: {editTypography?.textDecoration ?? 'inherit'};
					text-align: {editTypography?.textAlign ?? 'inherit'};
					{uppercase ? 'text-transform: uppercase;' : ''}
				"
				oninput={(e) => onTextChange?.((e.target as HTMLTextAreaElement).value)}
				onselect={syncPlainTextareaSelection}
				onkeyup={syncPlainTextareaSelection}
				onmouseup={syncPlainTextareaSelection}
				onblur={finishEdit}
			></textarea>
		{/if}
	</div>
{:else}
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		bind:this={displayRoot}
		data-draggable-no-pan
		data-text-selectable={toolbarKind}
		ondblclick={startEdit}
		onmouseup={onDisplayMouseUp}
		onpointerup={onDisplayMouseUp}
		role="button"
		aria-label={ariaLabel}
		tabindex="0"
		onkeydown={(e) => {
			if (e.key === 'Enter' || e.key === ' ') {
				e.preventDefault();
				if (displayRoot) onTextSelect?.(toolbarKind, displayRoot);
			}
		}}
		style="
			position: relative;
			{selected ? 'box-shadow: 0 0 0 2px rgba(255,235,59,0.92);' : ''}
			border-radius: 4px;
			{canEdit
				? 'cursor: text; user-select: text !important; -webkit-user-select: text !important; touch-action: pan-x pan-y;'
				: ''}
		"
		title={canEdit ? 'Double-click to edit text' : undefined}
	>
		{#if fontSize != null && Number.isFinite(fontSize)}
			<div
				data-canvas-typography-root
				data-design-font-px={String(fontSize)}
				style="font-size: {fontSize}px;"
			>
				{@render display()}
			</div>
		{:else}
			<div data-canvas-typography-root>
				{@render display()}
			</div>
		{/if}
	</div>
{/if}
