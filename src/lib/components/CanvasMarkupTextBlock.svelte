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

	/** Parent cleared the field (toolbar delete) — leave inline edit so display shows empty. */
	$effect(() => {
		if (editing && String(value ?? '') === '') {
			editing = false;
			editTypography = null;
		}
	});

	function wrapRectAsAnchor(rect: DOMRect): HTMLElement {
		const ghost = document.createElement('div');
		(ghost as unknown as { getBoundingClientRect: () => DOMRect }).getBoundingClientRect =
			() => rect;
		return ghost;
	}

	/**
	 * Prefer the painted text node over the thin outer `data-canvas-typography-root`
	 * wrapper (often only sets font-size). POV / outlined templates put real
	 * weight, align, and stroke on a descendant (or innermost typography root).
	 */
	function pickTypographySource(root: HTMLElement): HTMLElement {
		const paint = root.querySelector('[data-canvas-paint-root]') as HTMLElement | null;
		if (paint) return paint;

		const roots = [...root.querySelectorAll('[data-canvas-typography-root]')];
		// Innermost typography root is usually the real styled text (HighlightedText).
		const wrap = (roots[roots.length - 1] as HTMLElement | undefined) ?? null;
		if (wrap) {
			const styled = wrap.querySelector(
				'[style*="font-weight"], [style*="text-stroke"], [style*="-webkit-text-stroke"], [style*="letter-spacing"], [style*="line-height"]',
			) as HTMLElement | null;
			if (styled) return styled;
			return wrap;
		}

		return (root.firstElementChild as HTMLElement | null) ?? root;
	}

	function snapshotTypography(el: HTMLElement): TypographySnapshot {
		const cs = getComputedStyle(el);
		const stroke =
			(cs as CSSStyleDeclaration & { webkitTextStroke?: string }).webkitTextStroke?.trim() ||
			[
				cs.getPropertyValue('-webkit-text-stroke-width')?.trim(),
				cs.getPropertyValue('-webkit-text-stroke-color')?.trim(),
			]
				.filter(Boolean)
				.join(' ');
		const shadow = cs.textShadow?.trim();
		const paintOrder = cs.paintOrder?.trim();
		return {
			fontWeight: cs.fontWeight,
			fontFamily: cs.fontFamily,
			fontSize: cs.fontSize,
			lineHeight: cs.lineHeight,
			letterSpacing: cs.letterSpacing,
			fontStyle: cs.fontStyle,
			textDecoration: cs.textDecoration,
			textAlign: cs.textAlign,
			...(stroke && stroke !== '0px' && stroke !== 'none' ? { webkitTextStroke: stroke } : {}),
			...(paintOrder && paintOrder !== 'normal' ? { paintOrder } : {}),
			...(shadow && shadow !== 'none' ? { textShadow: shadow } : {}),
		};
	}

	function typographyCss(snap: TypographySnapshot | null, fallbackFamily?: string, fallbackSize?: number): string {
		if (!snap) {
			return [
				fallbackFamily ? `font-family: '${fallbackFamily}', sans-serif;` : '',
				fallbackSize ? `font-size: ${fallbackSize}px;` : '',
			]
				.filter(Boolean)
				.join(' ');
		}
		return [
			`font-family: ${snap.fontFamily};`,
			`font-size: ${snap.fontSize};`,
			`font-weight: ${snap.fontWeight};`,
			`line-height: ${snap.lineHeight};`,
			`letter-spacing: ${snap.letterSpacing};`,
			`font-style: ${snap.fontStyle};`,
			`text-decoration: ${snap.textDecoration};`,
			`text-align: ${snap.textAlign};`,
			snap.webkitTextStroke ? `-webkit-text-stroke: ${snap.webkitTextStroke};` : '',
			snap.paintOrder ? `paint-order: ${snap.paintOrder};` : '',
			snap.textShadow ? `text-shadow: ${snap.textShadow};` : '',
		]
			.filter(Boolean)
			.join(' ');
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
		// Match visible canvas typography (weight, size, stroke, align) — not the thin
		// font-size wrapper — so POV / outlined text keep their look while editing.
		try {
			if (displayRoot) {
				const typoEl = pickTypographySource(displayRoot);
				const cs = getComputedStyle(typoEl);
				editTextColor = cs.color;
				editTypography = snapshotTypography(typoEl);
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
					{typographyCss(editTypography, fontFamily, fontSize)}
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
