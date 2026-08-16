<script lang="ts">
	/**
	 * Inline text editing for canvas templates: double-click to edit,
	 * single click / text drag for floating toolbar (when callbacks are wired).
	 *
	 * Matches NewsTemplate chrome: violet outline rings, zero padding, text-box
	 * trim, and a typography snapshot so edit mode keeps the painted look.
	 */
	import type { Snippet } from 'svelte';
	import type { TextElementKind, TypographySnapshot } from '$lib/types';
	import {
		plainRangeFromSelection,
		restorePlainSelection,
		type HighlightDefaults,
	} from '$lib/highlight';
	import HighlightEditor from '$lib/components/HighlightEditor.svelte';
	import {
		CANVAS_TEXT_BOX_TRIM,
		CANVAS_TEXT_FOCUS_RING,
	} from '$lib/studio/canvas-text-chrome';
	import { textShadowToDropFilter } from '$lib/textStyleCss';
	import { canvasFontFamilyStack } from '$lib/fonts';

	interface Props {
		value: string;
		interactive?: boolean;
		defaultColor?: string;
		/** When set, bare `[[phrase]]` uses solid / gradient / pattern defaults while editing. */
		defaultStyle?: HighlightDefaults;
		/**
		 * When true (default), double-click editing uses HighlightEditor so
		 * weight/size/stroke and `[[…]]` chips match the canvas. Set false only
		 * for rare plain-textarea cases.
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
		/** Live unitless line-height from the toolbar (updates while editing). */
		lineHeight?: number;
		/** Live font-weight from the toolbar (updates while editing). */
		fontWeight?: number;
		/**
		 * Creator-hook style: `[[phrase]]` paints as bold weight in the editor
		 * (and in HighlightedText when `emphasisBold` is set on display).
		 */
		emphasisBold?: boolean;
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
		defaultStyle,
		allowHighlightMarkup = true,
		selected = false,
		toolbarKind = 'headline',
		rows = 6,
		minHeight = '0px',
		uppercase = false,
		showToolbar = false,
		fontFamily,
		fontSize,
		lineHeight,
		fontWeight,
		emphasisBold = false,
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
		const wrap = (roots[roots.length - 1] as HTMLElement | undefined) ?? null;
		if (wrap) {
			const wrapStyle = wrap.getAttribute('style') ?? '';
			const wrapHasPaint =
				/font-weight|line-height|letter-spacing|text-stroke|text-shadow|text-transform/i.test(
					wrapStyle,
				);
			if (wrapHasPaint) return wrap;

			const styled = wrap.querySelector(
				'[style*="font-weight"], [style*="text-stroke"], [style*="-webkit-text-stroke"], [style*="letter-spacing"], [style*="line-height"], [style*="text-transform"]',
			) as HTMLElement | null;
			if (styled) return styled;
			return wrap;
		}

		const candidates = [
			...root.querySelectorAll(
				'[style*="font-weight"], [style*="font-size"], [style*="line-height"], [style*="letter-spacing"]',
			),
		] as HTMLElement[];
		if (candidates.length) return candidates[candidates.length - 1];

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
		const transform = cs.textTransform?.trim();
		return {
			fontWeight: cs.fontWeight,
			fontFamily: cs.fontFamily,
			fontSize: cs.fontSize,
			lineHeight: cs.lineHeight,
			letterSpacing: cs.letterSpacing,
			fontStyle: cs.fontStyle,
			textDecoration: cs.textDecoration,
			textAlign: cs.textAlign,
			...(transform && transform !== 'none' ? { textTransform: transform } : {}),
			...(stroke && stroke !== '0px' && stroke !== 'none' ? { webkitTextStroke: stroke } : {}),
			...(paintOrder && paintOrder !== 'normal' ? { paintOrder } : {}),
			...(shadow && shadow !== 'none' ? { textShadow: shadow } : {}),
		};
	}

	function typographyCss(snap: TypographySnapshot | null, fallbackFamily?: string, fallbackSize?: number): string {
		const familyCss = fallbackFamily
			? `font-family: ${
					fallbackFamily.includes("'") || fallbackFamily.includes(',')
						? fallbackFamily
						: canvasFontFamilyStack(fallbackFamily)
				};`
			: '';
		const sizeCss =
			fallbackSize != null && Number.isFinite(fallbackSize) ? `font-size: ${fallbackSize}px;` : '';
		const lhCss =
			lineHeight != null && Number.isFinite(lineHeight) ? `line-height: ${lineHeight};` : '';
		const weightCss =
			fontWeight != null && Number.isFinite(fontWeight) ? `font-weight: ${fontWeight};` : '';
		if (!snap) {
			return [familyCss, sizeCss, weightCss, lhCss, CANVAS_TEXT_BOX_TRIM].filter(Boolean).join(' ');
		}
		return [
			/* Live toolbar props win over the enter-edit snapshot (paragraph +/- while editing). */
			familyCss || `font-family: ${snap.fontFamily};`,
			sizeCss || `font-size: ${snap.fontSize};`,
			weightCss || `font-weight: ${snap.fontWeight};`,
			lhCss || `line-height: ${snap.lineHeight};`,
			`letter-spacing: ${snap.letterSpacing};`,
			`font-style: ${snap.fontStyle};`,
			`text-decoration: ${snap.textDecoration};`,
			`text-align: ${snap.textAlign};`,
			snap.textTransform ? `text-transform: ${snap.textTransform};` : '',
			snap.webkitTextStroke ? `-webkit-text-stroke: ${snap.webkitTextStroke};` : '',
			snap.paintOrder ? `paint-order: ${snap.paintOrder};` : '',
			snap.textShadow
				? `text-shadow: ${snap.textShadow}; --text-drop-shadow: ${textShadowToDropFilter(snap.textShadow)};`
				: '',
			CANVAS_TEXT_BOX_TRIM,
		]
			.filter(Boolean)
			.join(' ');
	}

	function getPlainSelectionRange(): { start: number; end: number } | null {
		const root = displayRoot;
		if (!root) return null;
		return plainRangeFromSelection(root);
	}

	function phraseRangeFromTarget(target: EventTarget | null): { start: number; end: number } | null {
		const node =
			target instanceof Element ? target : target instanceof Node ? target.parentElement : null;
		const el = node?.closest('[data-hl-plain-start]') ?? null;
		if (!el) return null;
		const start = Number(el.getAttribute('data-hl-plain-start'));
		const end = Number(el.getAttribute('data-hl-plain-end'));
		if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null;
		return { start, end };
	}

	function onDisplayMouseUp(e: MouseEvent) {
		if (!interactive || !onTextSelect || editing) return;
		const phraseHint = phraseRangeFromTarget(e.target);
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
				return;
			}

			if (phraseHint && displayRoot) {
				restorePlainSelection(displayRoot, phraseHint.start, phraseHint.end);
				const live = window.getSelection();
				const rect =
					live && live.rangeCount > 0
						? live.getRangeAt(0).getBoundingClientRect()
						: displayRoot.getBoundingClientRect();
				onTextSelect?.(toolbarKind, wrapRectAsAnchor(rect));
				onHeadlineRangeSelect?.(phraseHint.start, phraseHint.end);
				return;
			}

			if (displayRoot) onTextSelect?.(toolbarKind, displayRoot);
			onHeadlineRangeSelect?.(-1, -1);
		}, 0);
	}

	function startEdit(e: MouseEvent) {
		if (!canEdit) return;
		e.stopPropagation();
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

	function pushChange(v: string) {
		const cleaned = v.replace(/\n+$/g, '');
		onTextChange?.(cleaned);
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
	}
</script>

{#if !interactive}
	{@render display()}
{:else}
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div style="position: relative; margin: 0; padding: 0;">
		<!--
		  Keep display mounted (hidden) while editing — same as News — so blur
		  swap does not flash and the editor can match painted metrics.
		-->
		<div
			bind:this={displayRoot}
			data-draggable-no-pan
			data-text-selectable={toolbarKind}
			ondblclick={startEdit}
			onmouseup={onDisplayMouseUp}
			onpointerup={onDisplayMouseUp}
			role="button"
			aria-label={ariaLabel}
			aria-hidden={editing ? true : undefined}
			tabindex={editing ? -1 : 0}
			onkeydown={(e) => {
				if (editing) return;
				if (e.key === 'Enter' || e.key === ' ') {
					e.preventDefault();
					if (displayRoot) onTextSelect?.(toolbarKind, displayRoot);
				}
			}}
			style="
				position: relative;
				margin: 0;
				padding: 0;
				{CANVAS_TEXT_BOX_TRIM}
				{editing
					? 'position: absolute; left: 0; right: 0; top: 0; visibility: hidden; pointer-events: none; height: auto;'
					: ''}
				{selected && !editing ? CANVAS_TEXT_FOCUS_RING : ''}
				{canEdit && !editing
					? `cursor: ${selected ? 'grab' : 'text'}; user-select: text !important; -webkit-user-select: text !important; touch-action: none;`
					: ''}
			"
			title={canEdit && !editing
				? 'Drag to move · Double-click to edit · Shift+drag to highlight'
				: undefined}
		>
			{#if fontSize != null && Number.isFinite(fontSize)}
				<div
					data-canvas-typography-root
					data-design-font-px={String(fontSize)}
					style="font-size: {fontSize}px; margin: 0; padding: 0;"
				>
					{@render display()}
				</div>
			{:else}
				<div data-canvas-typography-root style="margin: 0; padding: 0;">
					{@render display()}
				</div>
			{/if}
		</div>

		{#if editing && canEdit}
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<div
				bind:this={editableEl}
				data-text-selectable="true"
				data-draggable-no-pan
				onkeydown={onEditKeydown}
				onclick={(e) => e.stopPropagation()}
				onmousedown={(e) => e.stopPropagation()}
				style="
					position: relative;
					display: block;
					margin: 0;
					padding: 0;
					border: 0;
					color: {editTextColor ?? 'inherit'};
					{typographyCss(editTypography, fontFamily, fontSize)}
					{uppercase && !editTypography?.textTransform ? 'text-transform: uppercase;' : ''}
					outline: none;
					cursor: text;
					touch-action: manipulation;
					white-space: pre-wrap;
					word-break: break-word;
				"
			>
				{#if allowHighlightMarkup}
					<HighlightEditor
						value={value}
						{rows}
						{defaultColor}
						{defaultStyle}
						{uppercase}
						{fontFamily}
						{fontSize}
						liveLineHeight={lineHeight}
						liveFontWeight={fontWeight}
						{emphasisBold}
						lineHeight="inherit"
						typographySnapshot={editTypography}
						{showToolbar}
						{ariaLabel}
						{minHeight}
						onChange={pushChange}
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
							display: block; width: 100%; box-sizing: border-box; margin: 0; padding: 0;
							min-height: {minHeight ?? '0px'};
							resize: none;
							border: none; outline: none; background: transparent;
							color: {editTextColor ?? 'inherit'};
							{typographyCss(editTypography, fontFamily, fontSize)}
							{uppercase && !editTypography?.textTransform ? 'text-transform: uppercase;' : ''}
						"
						oninput={(e) => pushChange((e.target as HTMLTextAreaElement).value)}
						onselect={syncPlainTextareaSelection}
						onkeyup={syncPlainTextareaSelection}
						onmouseup={syncPlainTextareaSelection}
						onblur={finishEdit}
					></textarea>
				{/if}
			</div>
		{/if}
	</div>
{/if}
