<script lang="ts">
	import { parseHighlightMarkup, segmentText } from '$lib/highlight';
	import type { Overlay, TextOverlay, TextStyle, TextElementKind } from '$lib/types';
	import { loadGoogleFont } from '$lib/fonts';
	import HighlightEditor from '$lib/components/HighlightEditor.svelte';

	interface Props {
		// Canvas size (template pixels). Default is IG portrait 4:5.
		w?: number;
		h?: number;
		backgroundImage?: string;
		backgroundVideo?: string; // blob URL or data URL for video background
		/** Transparent PNG of the foreground subject (from bg-removal). When provided
		 * and `showSubjectCutout` is true, renders ABOVE the circle so the subject
		 * visually overlaps the circle edge (editorial style). */
		subjectCutout?: string;
		showSubjectCutout?: boolean;
		circleImage?: string;
		/** Circle border color (bindable). */
		circleBorderColor?: string;
		/** Optional second circle badge (for a second photo/logo). */
		showCircle2?: boolean;
		circle2Image?: string;
		circle2BorderColor?: string;
		circle2X?: number;
		circle2Y?: number;
		circle2Size?: number;
		text: string;
		source?: string;
		highlightColor?: string;
		textColor?: string;
		scale?: number;
		exportRef?: HTMLElement | null;
		// Canvas editing
		interactive?: boolean;
		circleX?: number;     // left position in template px (bindable)
		circleY?: number;     // top position in template px (bindable)
		circleSize?: number;  // diameter in template px (bindable)
		bgOffsetX?: number;   // background horizontal position 0–100% (bindable)
		bgOffsetY?: number;   // background vertical position 0–100% (bindable)
		/** Background zoom as a percentage of frame size. 100 = exact cover,
		 *  values >100 zoom in, values <100 shrink the image and letterbox it.
		 *  We always *render* at max(bgZoom, 115) so both pan sliders still have
		 *  room to work regardless of the source aspect ratio. */
		bgZoom?: number;      // default 100
		textPanelOffsetY?: number; // bottom text panel offset (bindable, px)
		/** Height of the bottom shadow gradient as a % of canvas height (0–100). Default 75. */
		shadowHeight?: number;
		/** Opacity of the bottom shadow (0–1). Default 1. */
		shadowStrength?: number;
		overlays?: Overlay[];
		textOverlays?: TextOverlay[];
		/** Per-element style overrides (font, size, weight, color, etc.) */
		headlineStyle?: TextStyle;
		sourceStyle?: TextStyle;
		/** Which text element is currently selected (shows dashed outline). */
		selectedText?: TextElementKind | null;
		onTextChange?: (t: string) => void;
		onCircleMove?: (x: number, y: number) => void;
		onCircleImageChange?: (src: string) => void;
		onCircleAIClick?: () => void;
		onCircle2Move?: (x: number, y: number) => void;
		onCircle2ImageChange?: (src: string) => void;
		onCircle2AIClick?: () => void;
		onOverlaysChange?: (overlays: Overlay[]) => void;
		onTextOverlaysChange?: (overlays: TextOverlay[]) => void;
		/** Fired when the user clicks a stylable text element. */
		onTextSelect?: (kind: TextElementKind, anchor: HTMLElement) => void;
		/** Fired when the user selects a range of PLAIN text inside the headline.
		 *  Offsets are into the visible (unmarked-up) text, suitable for applyHighlight(). */
		onHeadlineRangeSelect?: (plainStart: number, plainEnd: number) => void;
	}

	let {
		w = 1080,
		h = 1350,
		backgroundImage = '',
		backgroundVideo = '',
		subjectCutout = '',
		showSubjectCutout = false,
		circleImage,
		circleBorderColor = $bindable('#FFFFFF'),
		showCircle2 = false,
		circle2Image = '',
		circle2BorderColor = $bindable('#FFFFFF'),
		text,
		source = 'Markets',
		highlightColor = '#F5A623',
		textColor = '#FFFFFF',
		scale = 1,
		exportRef = $bindable(null),
		interactive = false,
		circleX    = $bindable(772),
		circleY    = $bindable(52),
		circleSize = $bindable(256),
		circle2X   = $bindable(80),
		circle2Y   = $bindable(80),
		circle2Size = $bindable(220),
		bgOffsetX  = $bindable(50),
		bgOffsetY  = $bindable(50),
		bgZoom     = $bindable(100),
		textPanelOffsetY = $bindable(0),
		shadowHeight = $bindable(75),
		shadowStrength = $bindable(1),
		overlays   = [],
		textOverlays = [],
		headlineStyle = {},
		sourceStyle = {},
		selectedText = null,
		onTextChange,
		onCircleMove,
		onCircleImageChange,
		onCircleAIClick,
		onCircle2Move,
		onCircle2ImageChange,
		onCircle2AIClick,
		onOverlaysChange,
		onTextOverlaysChange,
		onTextSelect,
		onHeadlineRangeSelect,
	}: Props = $props();

	// ── Text overlays ─────────────────────────────────────────────────────
	let activeTextOverlayId = $state<string | null>(null);
	let textOverlayAction = $state<'drag' | 'resize' | null>(null);
	let toLastMx = 0;
	let toLastMy = 0;
	let editingTextOverlayId = $state<string | null>(null);

	function textOverlayDown(e: PointerEvent, id: string) {
		if (!interactive) return;
		activeTextOverlayId = id;
		textOverlayAction = 'drag';
		toLastMx = e.clientX;
		toLastMy = e.clientY;
		(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
		e.stopPropagation();
		e.preventDefault();
	}

	function textOverlayResizeDown(e: PointerEvent, id: string) {
		if (!interactive) return;
		activeTextOverlayId = id;
		textOverlayAction = 'resize';
		toLastMx = e.clientX;
		toLastMy = e.clientY;
		(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
		e.stopPropagation();
		e.preventDefault();
	}

	function textOverlayMove(e: PointerEvent, id: string) {
		if (activeTextOverlayId !== id) return;
		const dx = (e.clientX - toLastMx) / scale;
		const dy = (e.clientY - toLastMy) / scale;
		toLastMx = e.clientX;
		toLastMy = e.clientY;

		const ov = textOverlays.find((o) => o.id === id);
		if (!ov) return;

		if (textOverlayAction === 'drag') {
			const nx = Math.max(0, Math.min(W - ov.w, ov.x + dx));
			const ny = Math.max(0, Math.min(H - ov.h, ov.y + dy));
			onTextOverlaysChange?.(textOverlays.map((o) => (o.id === id ? { ...o, x: nx, y: ny } : o)));
		} else if (textOverlayAction === 'resize') {
			const nw = Math.max(140, Math.min(W - ov.x, ov.w + dx));
			const nh = Math.max(60, Math.min(H - ov.y, ov.h + dy));
			onTextOverlaysChange?.(textOverlays.map((o) => (o.id === id ? { ...o, w: nw, h: nh } : o)));
		}
	}

	function textOverlayUp() {
		activeTextOverlayId = null;
		textOverlayAction = null;
	}

	function textOverlayDelete(e: MouseEvent, id: string) {
		e.stopPropagation();
		onTextOverlaysChange?.(textOverlays.filter((o) => o.id !== id));
		if (editingTextOverlayId === id) editingTextOverlayId = null;
	}

	function startTextOverlayEdit(e: MouseEvent, id: string) {
		if (!interactive) return;
		e.stopPropagation();
		editingTextOverlayId = id;
	}

	function finishTextOverlayEdit(id: string) {
		if (editingTextOverlayId !== id) return;
		editingTextOverlayId = null;
	}

	// Preload Google Fonts used by the overrides so they're ready for render + export.
	$effect(() => {
		if (headlineStyle.fontFamily) void loadGoogleFont(headlineStyle.fontFamily);
		if (sourceStyle.fontFamily) void loadGoogleFont(sourceStyle.fontFamily);
	});

	// Build the effective CSS properties for each text element.
	const headlineCss = $derived.by(() => {
		const s = headlineStyle;
		const lines: string[] = [];
		if (s.fontFamily) lines.push(`font-family: '${s.fontFamily}', 'Bebas Neue', Impact, sans-serif;`);
		else lines.push(`font-family: 'Bebas Neue', Impact, 'Arial Black', sans-serif;`);
		lines.push(`font-size: ${s.fontSize ?? fontSize}px;`);
		lines.push(`font-weight: ${s.fontWeight ?? 400};`);
		if (s.italic) lines.push('font-style: italic;');
		if (s.underline) lines.push('text-decoration: underline;');
		lines.push(`color: ${s.color ?? textColor};`);
		lines.push(`text-align: ${s.align ?? 'left'};`);
		lines.push(`letter-spacing: ${s.letterSpacing != null ? `${s.letterSpacing}em` : '3px'};`);
		lines.push(`line-height: ${s.lineHeight ?? 1.06};`);
		return lines.join(' ');
	});

	const sourceCss = $derived.by(() => {
		const s = sourceStyle;
		const lines: string[] = [];
		if (s.fontFamily) lines.push(`font-family: '${s.fontFamily}', Georgia, serif;`);
		else lines.push(`font-family: Georgia, 'Times New Roman', serif;`);
		lines.push(`font-size: ${s.fontSize ?? 34}px;`);
		lines.push(`font-weight: ${s.fontWeight ?? 700};`);
		lines.push(`font-style: ${s.italic === false ? 'normal' : (s.italic ?? true) ? 'italic' : 'normal'};`);
		if (s.underline) lines.push('text-decoration: underline;');
		lines.push(`color: ${s.color ?? highlightColor};`);
		lines.push(`letter-spacing: ${s.letterSpacing != null ? `${s.letterSpacing}em` : '3px'};`);
		return lines.join(' ');
	});

	let headlineEl = $state<HTMLElement | null>(null);
	let sourceEl = $state<HTMLElement | null>(null);

	function selectHeadline(e: MouseEvent) {
		if (!interactive) return;
		e.stopPropagation();
		if (headlineEl) onTextSelect?.('headline', headlineEl);
	}

	function selectSource(e: MouseEvent) {
		if (!interactive) return;
		e.stopPropagation();
		if (sourceEl) onTextSelect?.('source', sourceEl);
	}

	// Whether there's any background media (image or video)
	const hasBg = $derived(!!(backgroundVideo || backgroundImage));

	// Effective background zoom. We render at max(bgZoom, 115) so the X/Y pan
	// sliders always have room to move the image regardless of source aspect
	// ratio (even a 1:1 image inside a 4:5 frame). When the user asks for LESS
	// than 100% (shrink), the image is positioned inside a full-frame solid
	// backdrop (letterboxed) rather than stretched. That case is handled with
	// a separate render path below.
	const bgZoomPct = $derived(Math.max(30, Math.min(300, Number(bgZoom) || 100)));
	const bgRenderSize = $derived(Math.max(bgZoomPct, 115));
	const bgRenderOverflowPct = $derived(bgRenderSize - 100); // total overflow
	const bgTranslateX = $derived((-bgOffsetX * bgRenderOverflowPct) / bgRenderSize);
	const bgTranslateY = $derived((-bgOffsetY * bgRenderOverflowPct) / bgRenderSize);
	// When shrinking below 100%, the image no longer covers the frame. In that
	// case we center it and the X/Y sliders instead pan the shrunk image within
	// the frame (so 0→100% shifts the image from one edge to the other).
	const bgIsShrunk = $derived(bgZoomPct < 100);
	const bgShrunkLeftPct = $derived(bgIsShrunk ? bgOffsetX * (100 - bgZoomPct) / 100 : 0);
	const bgShrunkTopPct = $derived(bgIsShrunk ? bgOffsetY * (100 - bgZoomPct) / 100 : 0);

	// Bottom shadow gradient — height/strength controllable.
	const shadowGradient = $derived.by(() => {
		const sh = Math.max(0, Math.min(100, shadowHeight));
		const str = Math.max(0, Math.min(1, shadowStrength));
		const clear = Math.max(0, 100 - sh);
		const a = (mult: number) => `rgba(0,0,0,${(mult * str).toFixed(3)})`;
		return `linear-gradient(to bottom,
			rgba(0,0,0,0) ${clear}%,
			${a(0.15)} ${(clear + sh * 0.27).toFixed(2)}%,
			${a(0.65)} ${(clear + sh * 0.5).toFixed(2)}%,
			${a(0.88)} ${(clear + sh * 0.67).toFixed(2)}%,
			${a(0.97)} ${(clear + sh * 0.84).toFixed(2)}%,
			${a(1)} 100%)`;
	});

	const W = $derived(Math.max(320, Number(w) || 1080));
	const H = $derived(Math.max(320, Number(h) || 1350));

	let parsed   = $derived(parseHighlightMarkup(text, highlightColor));
	let segments = $derived(segmentText(parsed));

	let fontSize = $derived(
		parsed.plain.length < 60  ? 108
		: parsed.plain.length < 90  ? 92
		: parsed.plain.length < 120 ? 78
		: 66
	);

	// ── Inline text editing ────────────────────────────────────────────────
	let editing = $state(false);
	let editableEl = $state<HTMLElement | null>(null);
	let hoveringText = $state(false);

	// ── Text panel drag (HTML) ─────────────────────────────────────────────
	const TEXT_PANEL_H = 520; // must match visual design; used for clamp range
	let textDragging = $state(false);
	let textStartY = 0;
	let textStartOffset = 0;
	let textMoved = false;

	function startEdit(e: MouseEvent) {
		if (!interactive) return;
		e.stopPropagation();
		editing = true;
		setTimeout(() => {
			const ce = editableEl?.querySelector<HTMLElement>('[contenteditable="true"]');
			if (ce) {
				ce.focus();
				const range = document.createRange();
				range.selectNodeContents(ce);
				range.collapse(false);
				const sel = window.getSelection();
				sel?.removeAllRanges();
				sel?.addRange(range);
			}
			// Anchor the toolbar to a fixed rect at the top of the editable area
			// during inline editing so it doesn't vanish as the editor expands.
			if (editableEl) {
				const rect = editableEl.getBoundingClientRect();
				const fixedRect = new DOMRect(rect.left, rect.top, rect.width, 0);
				onTextSelect?.('headline', wrapRectAsAnchor(fixedRect));
			}
		}, 10);
	}

	function finishEdit() {
		if (!editing) return;
		editing = false;
		// HighlightEditor has already emitted onChange(markup) through the edits,
		// so `text` prop is already up-to-date in the parent.
	}

	function onEditKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') { finishEdit(); }
		if (e.key === 'Enter' && e.shiftKey) { e.preventDefault(); finishEdit(); }
	}

	function textPointerDown(e: PointerEvent) {
		if (!interactive) return;
		if (editing) return;
		// Don't start a panel drag if the user is clicking directly on the headline
		// or source — those should support text selection / element selection instead.
		const target = e.target as HTMLElement;
		if (target.closest('[data-text-selectable]')) return;
		textDragging = true;
		textMoved = false;
		textStartY = e.clientY;
		textStartOffset = textPanelOffsetY;
		(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
		e.stopPropagation();
	}

	function textPointerMove(e: PointerEvent) {
		if (!textDragging) return;
		const dy = (e.clientY - textStartY) / scale;
		if (Math.abs(dy) > 4) textMoved = true;

		// Allow dragging panel from its base position (0) all the way up to top
		const baseTop = H - TEXT_PANEL_H; // y where panel starts (in template px)
		const minOffset = -baseTop;
		const maxOffset = 0;
		textPanelOffsetY = Math.max(minOffset, Math.min(maxOffset, textStartOffset + dy));
	}

	function textPointerUp(e: PointerEvent) {
		if (!textDragging) return;
		textDragging = false;
		// No-op when click ends without drag — selection is handled by the
		// individual headline / source elements' own click handlers.
	}

	function onHeadlineDblClick(e: MouseEvent) {
		if (!interactive) return;
		startEdit(e);
	}

	/**
	 * Translate a browser Selection inside the headline into a plain-text range
	 * (offsets into the visible text, ignoring our [[...]] markup). Returns null
	 * if selection is empty or outside the headline.
	 */
	function getPlainSelectionRange(): { start: number; end: number } | null {
		if (!headlineEl) return null;
		const sel = window.getSelection();
		if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return null;
		const range = sel.getRangeAt(0);

		// Ensure the selection is actually inside our headline.
		if (!headlineEl.contains(range.startContainer) || !headlineEl.contains(range.endContainer)) return null;

		// Walk text nodes under headlineEl in document order, accumulating
		// character offsets until we hit the selection's start / end nodes.
		const walker = document.createTreeWalker(headlineEl, NodeFilter.SHOW_TEXT);
		let offset = 0;
		let start = -1;
		let end = -1;

		let node = walker.nextNode();
		while (node) {
			const len = node.nodeValue?.length ?? 0;
			if (node === range.startContainer) start = offset + range.startOffset;
			if (node === range.endContainer)   end   = offset + range.endOffset;
			offset += len;
			if (start !== -1 && end !== -1) break;
			node = walker.nextNode();
		}

		if (start === -1 || end === -1) return null;
		if (start === end) return null;
		return start < end ? { start, end } : { start: end, end: start };
	}

	function onHeadlineMouseUp() {
		if (!interactive) return;
		// Defer so the browser finalises the selection first.
		setTimeout(() => {
			const sel = window.getSelection();
			const hasRange =
				sel && sel.rangeCount > 0 && !sel.isCollapsed && headlineEl?.contains(sel.anchorNode);

			if (hasRange && headlineEl) {
				// The user highlighted a range. Anchor the toolbar to the
				// SELECTION rect (not the whole headline) so it doesn't cover
				// the selected text and the toolbar doesn't appear to "jump"
				// as the user refines their selection.
				const range = sel!.getRangeAt(0);
				const rect = range.getBoundingClientRect();
				// Wrap the DOMRect in a synthetic anchor element-like target.
				// We reuse onTextSelect but swap the anchor strategy: pass the
				// headline element as the anchor target (so later scroll tracking
				// works) but prime the toolbar position from the selection rect.
				onTextSelect?.('headline', wrapRectAsAnchor(rect));
				const r = getPlainSelectionRange();
				onHeadlineRangeSelect?.(r?.start ?? -1, r?.end ?? -1);
			} else {
				// No selection — treat as a plain element click for font styling.
				if (headlineEl) onTextSelect?.('headline', headlineEl);
				onHeadlineRangeSelect?.(-1, -1);
			}
		}, 0);
	}

	/** Synthesize an element whose getBoundingClientRect() returns `rect`.
	 *  Lets us anchor the floating toolbar to a DOM Range without it covering
	 *  the selected text. */
	function wrapRectAsAnchor(rect: DOMRect): HTMLElement {
		const ghost = document.createElement('div');
		(ghost as any).getBoundingClientRect = () => rect;
		// Also needed for the parent's scroll-tracking effect; returning the
		// selection rect directly is fine because the user's selection moves
		// with scroll too.
		return ghost;
	}

	// ── Circle drag ────────────────────────────────────────────────────────
	let dragging = $state(false);
	let resizingCircle = $state(false);
	let lastMx = 0;
	let lastMy = 0;
	let circleStartSize = 0;
	let circleResizeStartMx = 0;
	let circleResizeStartMy = 0;
	let circleFileEl = $state<HTMLInputElement | null>(null);
	let circleBorderPickerEl = $state<HTMLInputElement | null>(null);

	function openCirclePicker(e: MouseEvent) {
		if (!interactive) return;
		e.stopPropagation();
		circleFileEl?.click();
	}

	function openCircleBorderPicker(e: MouseEvent) {
		if (!interactive) return;
		e.stopPropagation();
		circleBorderPickerEl?.click();
	}

	function removeCircle(e: MouseEvent) {
		if (!interactive) return;
		e.stopPropagation();
		onCircleImageChange?.('');
	}

	function onCircleFile(e: Event) {
		if (!interactive) return;
		const file = (e.target as HTMLInputElement).files?.[0];
		if (!file) return;
		(e.target as HTMLInputElement).value = '';
		const reader = new FileReader();
		reader.onload = () => {
			const src = reader.result as string;
			onCircleImageChange?.(src);
		};
		reader.readAsDataURL(file);
	}

	function circlePointerDown(e: PointerEvent) {
		if (!interactive) return;
		if (resizingCircle) return;
		dragging = true;
		lastMx = e.clientX;
		lastMy = e.clientY;
		(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
		e.stopPropagation();
		e.preventDefault();
	}

	function circlePointerMove(e: PointerEvent) {
		if (!dragging || resizingCircle) return;
		const dx = (e.clientX - lastMx) / scale;
		const dy = (e.clientY - lastMy) / scale;
		lastMx = e.clientX;
		lastMy = e.clientY;
		const nx = Math.max(0, Math.min(W - circleSize, circleX + dx));
		const ny = Math.max(0, Math.min(H - circleSize, circleY + dy));
		circleX = nx;
		circleY = ny;
		onCircleMove?.(nx, ny);
	}

	function circlePointerUp() {
		dragging = false;
	}

	function circleResizeDown(e: PointerEvent) {
		if (!interactive) return;
		resizingCircle = true;
		circleStartSize = circleSize;
		circleResizeStartMx = e.clientX;
		circleResizeStartMy = e.clientY;
		(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
		e.stopPropagation();
		e.preventDefault();
	}

	function circleResizeMove(e: PointerEvent) {
		if (!resizingCircle) return;
		const dx = (e.clientX - circleResizeStartMx) / scale;
		const dy = (e.clientY - circleResizeStartMy) / scale;
		const delta = Math.max(dx, dy);
		const nextSize = Math.round(Math.max(128, Math.min(512, circleStartSize + delta)));
		// Keep circle in bounds as it grows/shrinks
		circleSize = nextSize;
		circleX = Math.max(0, Math.min(W - circleSize, circleX));
		circleY = Math.max(0, Math.min(H - circleSize, circleY));
		onCircleMove?.(circleX, circleY);
	}

	function circleResizeUp() {
		resizingCircle = false;
	}

	// ── Second circle drag ────────────────────────────────────────────────
	let dragging2 = $state(false);
	let resizingCircle2 = $state(false);
	let lastMx2 = 0;
	let lastMy2 = 0;
	let circle2StartSize = 0;
	let circle2ResizeStartMx = 0;
	let circle2ResizeStartMy = 0;
	let circle2FileEl = $state<HTMLInputElement | null>(null);
	let circle2BorderPickerEl = $state<HTMLInputElement | null>(null);

	function openCircle2Picker(e: MouseEvent) {
		if (!interactive) return;
		e.stopPropagation();
		circle2FileEl?.click();
	}

	function openCircle2BorderPicker(e: MouseEvent) {
		if (!interactive) return;
		e.stopPropagation();
		circle2BorderPickerEl?.click();
	}

	function removeCircle2(e: MouseEvent) {
		if (!interactive) return;
		e.stopPropagation();
		onCircle2ImageChange?.('');
	}

	function onCircle2File(e: Event) {
		if (!interactive) return;
		const file = (e.target as HTMLInputElement).files?.[0];
		if (!file) return;
		(e.target as HTMLInputElement).value = '';
		const reader = new FileReader();
		reader.onload = () => {
			const src = reader.result as string;
			onCircle2ImageChange?.(src);
		};
		reader.readAsDataURL(file);
	}

	function circle2PointerDown(e: PointerEvent) {
		if (!interactive) return;
		if (resizingCircle2) return;
		dragging2 = true;
		lastMx2 = e.clientX;
		lastMy2 = e.clientY;
		(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
		e.stopPropagation();
		e.preventDefault();
	}

	function circle2PointerMove(e: PointerEvent) {
		if (!dragging2 || resizingCircle2) return;
		const dx = (e.clientX - lastMx2) / scale;
		const dy = (e.clientY - lastMy2) / scale;
		lastMx2 = e.clientX;
		lastMy2 = e.clientY;
		const nx = Math.max(0, Math.min(W - circle2Size, circle2X + dx));
		const ny = Math.max(0, Math.min(H - circle2Size, circle2Y + dy));
		circle2X = nx;
		circle2Y = ny;
		onCircle2Move?.(nx, ny);
	}

	function circle2PointerUp() {
		dragging2 = false;
	}

	function circle2ResizeDown(e: PointerEvent) {
		if (!interactive) return;
		resizingCircle2 = true;
		circle2StartSize = circle2Size;
		circle2ResizeStartMx = e.clientX;
		circle2ResizeStartMy = e.clientY;
		(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
		e.stopPropagation();
		e.preventDefault();
	}

	function circle2ResizeMove(e: PointerEvent) {
		if (!resizingCircle2) return;
		const dx = (e.clientX - circle2ResizeStartMx) / scale;
		const dy = (e.clientY - circle2ResizeStartMy) / scale;
		const delta = Math.max(dx, dy);
		const nextSize = Math.round(Math.max(128, Math.min(512, circle2StartSize + delta)));
		circle2Size = nextSize;
		circle2X = Math.max(0, Math.min(W - circle2Size, circle2X));
		circle2Y = Math.max(0, Math.min(H - circle2Size, circle2Y));
		onCircle2Move?.(circle2X, circle2Y);
	}

	function circle2ResizeUp() {
		resizingCircle2 = false;
	}

	// ── Background pan ─────────────────────────────────────────────────────
	let bgDragging = $state(false);
	let bgLastMx = 0;
	let bgLastMy = 0;

	function bgPointerDown(e: PointerEvent) {
		if (!interactive) return;
		bgDragging = true;
		bgLastMx = e.clientX;
		bgLastMy = e.clientY;
		(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
	}

	function bgPointerMove(e: PointerEvent) {
		if (!bgDragging) return;
		const dx = (e.clientX - bgLastMx) / scale;
		const dy = (e.clientY - bgLastMy) / scale;
		bgLastMx = e.clientX;
		bgLastMy = e.clientY;
		// Apply 3x multiplier for much more responsive dragging, and allow
		// going beyond 0-100 range so the image can be dragged partially off-canvas.
		bgOffsetX = bgOffsetX - (dx / W) * 100 * 3;
		bgOffsetY = bgOffsetY - (dy / H) * 100 * 3;
	}

	function bgPointerUp() {
		bgDragging = false;
	}

	// ── Overlay drag + resize ──────────────────────────────────────────────
	let activeOverlayId = $state<string | null>(null); // dragging or resizing
	let overlayAction   = $state<'drag' | 'resize' | null>(null);
	let hoveredOverlayId = $state<string | null>(null);
	let ovLastMx = 0;
	let ovLastMy = 0;

	function overlayDragDown(e: PointerEvent, id: string) {
		if (!interactive) return;
		activeOverlayId = id;
		overlayAction   = 'drag';
		ovLastMx = e.clientX;
		ovLastMy = e.clientY;
		(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
		e.stopPropagation();
		e.preventDefault();
	}

	function overlayResizeDown(e: PointerEvent, id: string) {
		if (!interactive) return;
		activeOverlayId = id;
		overlayAction   = 'resize';
		ovLastMx = e.clientX;
		ovLastMy = e.clientY;
		(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
		e.stopPropagation();
		e.preventDefault();
	}

	function overlayPointerMove(e: PointerEvent, id: string) {
		if (activeOverlayId !== id) return;
		const dx = (e.clientX - ovLastMx) / scale;
		const dy = (e.clientY - ovLastMy) / scale;
		ovLastMx = e.clientX;
		ovLastMy = e.clientY;

		const ov = overlays.find(o => o.id === id);
		if (!ov) return;

		if (overlayAction === 'drag') {
			const nx = Math.max(0, Math.min(W - ov.w, ov.x + dx));
			const ny = Math.max(0, Math.min(H - ov.h, ov.y + dy));
			onOverlaysChange?.(overlays.map(o => o.id === id ? { ...o, x: nx, y: ny } : o));
		} else if (overlayAction === 'resize') {
			const aspect = ov.w / ov.h;
			const newW = Math.max(60, Math.min(W - ov.x, ov.w + dx));
			const newH = newW / aspect;
			onOverlaysChange?.(overlays.map(o => o.id === id ? { ...o, w: newW, h: newH } : o));
		}
	}

	function overlayPointerUp() {
		activeOverlayId = null;
		overlayAction   = null;
	}

	function overlayDelete(e: MouseEvent, id: string) {
		e.stopPropagation();
		onOverlaysChange?.(overlays.filter(o => o.id !== id));
	}

	// ── Pattern rendering helpers ──────────────────────────────────────────
	function patternStyle(patternImage: string | undefined): string {
		if (!patternImage) return '';
		return `
			background-image: url('${patternImage}');
			background-size: cover;
			background-position: center;
			-webkit-background-clip: text;
			-webkit-text-fill-color: transparent;
			background-clip: text;
			display: inline;
		`;
	}
</script>

<!-- Outer wrapper — controls display size -->
<div style="
	width: {W * scale}px;
	height: {H * scale}px;
	overflow: hidden;
	border-radius: {scale < 1 ? '12px' : '0'};
	flex-shrink: 0;
	position: relative;
">
	<!-- Inner at W×H — scaled via CSS transform -->
	<div
		bind:this={exportRef}
		style="
			width: {W}px;
			height: {H}px;
			position: relative;
			overflow: hidden;
			background: #000;
			transform: scale({scale});
			transform-origin: top left;
			font-family: 'Bebas Neue', Impact, 'Arial Black', sans-serif;
			{interactive ? 'user-select: none;' : ''}
		"
	>
		<!-- Background: video takes priority over image.

		     Zoom + pan model:
		     - At zoom ≥ 100%, we render the media at max(zoom, 115)% using
		       object-fit:cover so the image always fills the frame; pan
		       sliders translate the oversize element within the clip.
		     - At zoom < 100% (shrink), we letterbox the media inside a dark
		       backdrop and the pan sliders reposition the shrunken media
		       within the visible frame.
		     - The outer div always clips so nothing leaks into other layers. -->
		{#if backgroundVideo}
			<div style="position: absolute; inset: 0; overflow: hidden; pointer-events: none; background: #0a0a0a;">
				{#if bgIsShrunk}
					<!-- svelte-ignore a11y_media_has_caption -->
					<video
						src={backgroundVideo}
						autoplay loop muted playsinline
						style="
							position: absolute;
							top: {bgShrunkTopPct}%; left: {bgShrunkLeftPct}%;
							width: {bgZoomPct}%; height: {bgZoomPct}%;
							object-fit: contain;
						"
					></video>
				{:else}
					<!-- svelte-ignore a11y_media_has_caption -->
					<video
						src={backgroundVideo}
						autoplay loop muted playsinline
						style="
							position: absolute;
							top: 0; left: 0;
							width: {bgRenderSize}%; height: {bgRenderSize}%;
							object-fit: cover;
							object-position: {bgOffsetX}% {bgOffsetY}%;
							transform: translate({bgTranslateX}%, {bgTranslateY}%);
						"
					></video>
				{/if}
			</div>
		{:else if backgroundImage}
			<div style="position: absolute; inset: 0; overflow: hidden; pointer-events: none; background: #0a0a0a;">
				{#if bgIsShrunk}
					<img
						src={backgroundImage}
						alt=""
						style="
							position: absolute;
							top: {bgShrunkTopPct}%; left: {bgShrunkLeftPct}%;
							width: {bgZoomPct}%; height: {bgZoomPct}%;
							object-fit: contain;
						"
					/>
				{:else}
					<img
						src={backgroundImage}
						alt=""
						style="
							position: absolute;
							top: 0; left: 0;
							width: {bgRenderSize}%; height: {bgRenderSize}%;
							object-fit: cover;
							object-position: {bgOffsetX}% {bgOffsetY}%;
							transform: translate({bgTranslateX}%, {bgTranslateY}%);
						"
					/>
				{/if}
			</div>
		{:else}
			<div style="
				position: absolute; inset: 0;
				background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
			"></div>
		{/if}

		<!-- Background pan capture (sits above bg, below text z-10 and circle z-20) -->
		{#if interactive && hasBg}
			<div
				style="
					position: absolute; inset: 0; z-index: 2;
					cursor: {bgDragging ? 'grabbing' : 'move'};
					touch-action: none;
				"
				onpointerdown={bgPointerDown}
				onpointermove={bgPointerMove}
				onpointerup={bgPointerUp}
				onpointercancel={bgPointerUp}
				role="presentation"
			></div>
		{/if}

		<!-- Gradient overlay — height/strength user-controlled. z=30 so it sits
		     ABOVE the subject cutout (z=25) but BELOW the text (z=40), giving
		     the text its legibility shelf even when a subject is cut out. -->
		<div style="position: absolute; inset: 0; z-index: 30; pointer-events: none;
			background: {shadowGradient};"></div>

		<!-- ── Image overlays (stickers / logos) ────────────────────────────── -->
		{#each overlays as overlay (overlay.id)}
			{@const isActive  = activeOverlayId === overlay.id}
			{@const isHovered = hoveredOverlayId === overlay.id}
			{@const showControls = interactive && (isHovered || isActive)}
			<div
				style="
					position: absolute;
					left: {overlay.x}px; top: {overlay.y}px;
					width: {overlay.w}px; height: {overlay.h}px;
					z-index: 15;
					cursor: {isActive && overlayAction === 'drag' ? 'grabbing' : (interactive ? 'grab' : 'default')};
					touch-action: none;
					overflow: visible;
				"
				onpointerdown={(e) => overlayDragDown(e, overlay.id)}
				onpointermove={(e) => overlayPointerMove(e, overlay.id)}
				onpointerup={overlayPointerUp}
				onpointercancel={overlayPointerUp}
				onmouseenter={() => hoveredOverlayId = overlay.id}
				onmouseleave={() => { if (hoveredOverlayId === overlay.id) hoveredOverlayId = null; }}
				role="presentation"
			>
				<img
					src={overlay.src}
					alt=""
					style="
						width: 100%; height: 100%;
						object-fit: contain;
						pointer-events: none;
						display: block;
					"
				/>

				{#if showControls}
					<!-- Delete button — top-right corner -->
					<!-- svelte-ignore a11y_consider_explicit_label -->
					<button
						onclick={(e) => overlayDelete(e, overlay.id)}
						style="
							position: absolute; top: -14px; right: -14px;
							width: 28px; height: 28px; border-radius: 50%;
							background: rgba(0,0,0,0.85); border: 2px solid rgba(255,255,255,0.4);
							color: #fff; font-size: 13px; line-height: 1;
							display: flex; align-items: center; justify-content: center;
							cursor: pointer; z-index: 1; touch-action: none;
						"
					>✕</button>

					<!-- Resize handle — bottom-right corner -->
					<div
						style="
							position: absolute; bottom: -10px; right: -10px;
							width: 22px; height: 22px; border-radius: 4px;
							background: rgba(0,0,0,0.85); border: 2px solid rgba(255,255,255,0.5);
							cursor: nwse-resize; z-index: 1; touch-action: none;
							display: flex; align-items: center; justify-content: center;
							font-size: 11px; color: rgba(255,255,255,0.8);
						"
						onpointerdown={(e) => overlayResizeDown(e, overlay.id)}
						onpointermove={(e) => overlayPointerMove(e, overlay.id)}
						onpointerup={overlayPointerUp}
						onpointercancel={overlayPointerUp}
						role="presentation"
					>⤡</div>

					<!-- Selection outline -->
					<div style="
						position: absolute; inset: -2px;
						border: 2px dashed rgba(255,255,255,0.5);
						border-radius: 4px; pointer-events: none;
					"></div>
				{/if}
			</div>
		{/each}

		<!-- ── Text overlays ──────────────────────────────────────────────── -->
		{#each textOverlays as t (t.id)}
			{@const isEditing = editingTextOverlayId === t.id}
			{@const css = t.style ?? {}}
			<div
				style="
					position: absolute;
					left: {t.x}px; top: {t.y}px;
					width: {t.w}px; height: {t.h}px;
					z-index: 35;
					touch-action: none;
					cursor: {interactive ? (activeTextOverlayId === t.id && textOverlayAction === 'drag' ? 'grabbing' : 'grab') : 'default'};
				"
				onpointerdown={(e) => textOverlayDown(e, t.id)}
				onpointermove={(e) => textOverlayMove(e, t.id)}
				onpointerup={textOverlayUp}
				onpointercancel={textOverlayUp}
				role="presentation"
			>
				{#if isEditing}
					<div
						style="
							position: absolute; inset: 0;
							background: rgba(0,0,0,0.35);
							border: 1px solid rgba(255,255,255,0.25);
							border-radius: 10px;
							padding: 10px;
							box-sizing: border-box;
						"
						onclick={(e) => e.stopPropagation()}
					>
						<HighlightEditor
							value={t.text}
							rows={3}
							showToolbar={true}
							defaultColor={highlightColor}
							ariaLabel="Text overlay editor"
							onChange={(v) => onTextOverlaysChange?.(textOverlays.map(o => o.id === t.id ? { ...o, text: v } : o))}
							onBlur={() => finishTextOverlayEdit(t.id)}
						/>
					</div>
				{:else}
					<!-- svelte-ignore a11y_no_static_element_interactions -->
					<div
						ondblclick={(e) => startTextOverlayEdit(e, t.id)}
						style="
							position: absolute; inset: 0;
							padding: 10px;
							box-sizing: border-box;
							border-radius: 10px;
							background: rgba(0,0,0,0.10);
							border: 1px dashed rgba(255,255,255,0.25);
							color: {css.color ?? '#FFFFFF'};
							font-family: {css.fontFamily ? `'${css.fontFamily}', system-ui, -apple-system, sans-serif` : `'DM Sans', system-ui, -apple-system, sans-serif`};
							font-size: {css.fontSize ?? 42}px;
							font-weight: {css.fontWeight ?? 700};
							text-align: {css.align ?? 'left'};
							line-height: {css.lineHeight ?? 1.15};
							letter-spacing: {css.letterSpacing != null ? `${css.letterSpacing}em` : '0'};
							overflow: hidden;
							user-select: none;
						"
					>
						{@html segmentText(parseHighlightMarkup(t.text, highlightColor)).map((seg) => {
							if (!seg.highlighted) return seg.text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
							if (seg.patternImage) {
								const s = patternStyle(seg.patternImage).replace(/\n/g,' ');
								return `<span style="${s}">${seg.text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</span>`;
							}
							if (seg.gradientFrom && seg.gradientTo) {
								return `<span style="background: linear-gradient(90deg, ${seg.gradientFrom}, ${seg.gradientTo}); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;">${seg.text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</span>`;
							}
							return `<span style="color: ${seg.color};">${seg.text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</span>`;
						}).join('')}
					</div>
				{/if}

				{#if interactive && !isEditing}
					<!-- svelte-ignore a11y_consider_explicit_label -->
					<button
						onclick={(e) => textOverlayDelete(e, t.id)}
						style="
							position: absolute; top: -12px; right: -12px;
							width: 26px; height: 26px; border-radius: 50%;
							background: rgba(0,0,0,0.85); border: 2px solid rgba(255,255,255,0.35);
							color: #fff; font-size: 12px;
							display: flex; align-items: center; justify-content: center;
							cursor: pointer;
						"
						title="Remove text"
					>✕</button>

					<div
						style="
							position: absolute; bottom: -10px; right: -10px;
							width: 22px; height: 22px; border-radius: 6px;
							background: rgba(0,0,0,0.85); border: 2px solid rgba(255,255,255,0.45);
							cursor: nwse-resize;
							display:flex;align-items:center;justify-content:center;
							font-size: 11px; color: rgba(255,255,255,0.8);
						"
						onpointerdown={(e) => textOverlayResizeDown(e, t.id)}
						onpointermove={(e) => textOverlayMove(e, t.id)}
						onpointerup={textOverlayUp}
						onpointercancel={textOverlayUp}
						role="presentation"
					>⤡</div>
				{/if}
			</div>
		{/each}

		<!-- ── Draggable circle badge ──────────────────────────────────────── -->
		{#if circleImage || interactive}
			<input
				bind:this={circleFileEl}
				type="file"
				accept="image/*"
				style="display:none"
				onchange={onCircleFile}
			/>
			<input
				bind:this={circleBorderPickerEl}
				type="color"
				value={circleBorderColor}
				style="position:fixed;opacity:0;pointer-events:none;width:1px;height:1px"
				oninput={(e) => (circleBorderColor = (e.target as HTMLInputElement).value)}
			/>
			<div
				style="
					position: absolute;
					left: {circleX}px;
					top: {circleY}px;
					width: {circleSize}px;
					height: {circleSize}px;
					border-radius: 50%;
					border: 8px solid {circleBorderColor};
					overflow: visible;
					/* Keep circle controls above the shadow gradient (z=30),
					   but below the main text layer (z=40). */
					z-index: 32;
					box-shadow: 0 8px 32px rgba(0,0,0,0.5);
					cursor: {interactive ? (dragging ? 'grabbing' : 'grab') : 'default'};
					touch-action: none;
				"
				onpointerdown={circlePointerDown}
				onpointermove={circlePointerMove}
				onpointerup={circlePointerUp}
				onpointercancel={circlePointerUp}
				role="presentation"
			>
				{#if circleImage}
					<img
						src={circleImage}
						alt=""
						style="
							width: 100%; height: 100%;
							object-fit: cover; object-position: center;
							border-radius: 50%;
							pointer-events: none;
						"
					/>
				{:else}
					<div style="
						width: 100%; height: 100%;
						border-radius: 50%;
						background: radial-gradient(circle at 30% 30%, rgba(255,255,255,0.12), rgba(255,255,255,0.03));
						display: flex; align-items: center; justify-content: center;
						color: rgba(255,255,255,0.35);
						font-family: system-ui, -apple-system, sans-serif;
						font-weight: 700;
						letter-spacing: 0.02em;
						pointer-events: none;
					">Circle</div>
				{/if}
				<!-- Drag indicator (only in interactive mode) -->
			{#if interactive}
				<!-- Drag indicator (bottom-right) -->
				<div style="
					position: absolute;
					bottom: -38px; right: -38px;
					width: 60px; height: 60px;
					border-radius: 50%;
					background: rgba(0,0,0,0.75);
					border: 2px solid rgba(255,255,255,0.3);
					display: flex; align-items: center; justify-content: center;
					font-size: 28px; color: rgba(255,255,255,0.8);
					pointer-events: none;
				">⠿</div>

				<!-- Compact controls cluster (top-left) -->
				<div
					style="
						position: absolute;
						top: -22px; left: -22px;
						display: flex;
						gap: 8px;
						pointer-events: auto;
					"
					role="presentation"
				>
					<!-- svelte-ignore a11y_consider_explicit_label -->
					<button
						onpointerdown={(e) => { e.stopPropagation(); e.preventDefault(); }}
						onclick={() => onCircleAIClick?.()}
						style="
							width: 42px; height: 42px;
							border-radius: 999px;
							background: rgba(0,0,0,0.78);
							border: 2px solid rgba(255,255,255,0.24);
							display: flex; align-items: center; justify-content: center;
							font-size: 14px; color: rgba(255,255,255,0.9);
							cursor: pointer;
							touch-action: none;
						"
						title="Generate with AI"
					>AI</button>

					<!-- svelte-ignore a11y_consider_explicit_label -->
					<button
						onpointerdown={(e) => { e.stopPropagation(); e.preventDefault(); }}
						onclick={removeCircle}
						style="
							width: 42px; height: 42px;
							border-radius: 999px;
							background: rgba(0,0,0,0.78);
							border: 2px solid rgba(255,255,255,0.24);
							display: flex; align-items: center; justify-content: center;
							font-size: 18px; color: rgba(255,255,255,0.9);
							cursor: pointer;
							touch-action: none;
						"
						title="Remove circle"
					>✕</button>

					<!-- svelte-ignore a11y_consider_explicit_label -->
					<button
						onpointerdown={(e) => { e.stopPropagation(); e.preventDefault(); }}
						onclick={openCirclePicker}
						style="
							width: 42px; height: 42px;
							border-radius: 999px;
							background: rgba(0,0,0,0.78);
							border: 2px solid rgba(255,255,255,0.24);
							display: flex; align-items: center; justify-content: center;
							font-size: 18px; color: rgba(255,255,255,0.9);
							cursor: pointer;
							touch-action: none;
						"
						title="Edit circle image"
					>✎</button>

					<!-- svelte-ignore a11y_consider_explicit_label -->
					<button
						onpointerdown={(e) => { e.stopPropagation(); e.preventDefault(); }}
						onclick={openCircleBorderPicker}
						style="
							width: 42px; height: 42px;
							border-radius: 999px;
							background: rgba(0,0,0,0.78);
							border: 2px solid rgba(255,255,255,0.24);
							display: flex; align-items: center; justify-content: center;
							cursor: pointer;
							touch-action: none;
						"
						title="Change border color"
					>
						<span style="width:18px;height:18px;border-radius:6px;border:2px solid rgba(255,255,255,0.35);background:{circleBorderColor};display:block;"></span>
					</button>
				</div>

				<!-- Resize handle (bottom-center) -->
				<div
					style="
						position: absolute;
						bottom: -38px; left: 50%; transform: translateX(-50%);
						width: 34px; height: 34px;
						border-radius: 10px;
						background: rgba(0,0,0,0.85);
						border: 2px solid rgba(255,255,255,0.45);
						display: flex; align-items: center; justify-content: center;
						font-size: 15px; color: rgba(255,255,255,0.85);
						cursor: nwse-resize;
						touch-action: none;
					"
					onpointerdown={circleResizeDown}
					onpointermove={circleResizeMove}
					onpointerup={circleResizeUp}
					onpointercancel={circleResizeUp}
					role="presentation"
				>⤡</div>
			{/if}
			</div>
		{/if}

		<!-- ── Optional second circle badge ───────────────────────────────── -->
		{#if circle2Image || (interactive && showCircle2)}
			<input
				bind:this={circle2FileEl}
				type="file"
				accept="image/*"
				style="display:none"
				onchange={onCircle2File}
			/>
			<input
				bind:this={circle2BorderPickerEl}
				type="color"
				value={circle2BorderColor}
				style="position:fixed;opacity:0;pointer-events:none;width:1px;height:1px"
				oninput={(e) => (circle2BorderColor = (e.target as HTMLInputElement).value)}
			/>
			<div
				style="
					position: absolute;
					left: {circle2X}px;
					top: {circle2Y}px;
					width: {circle2Size}px;
					height: {circle2Size}px;
					border-radius: 50%;
					border: 8px solid {circle2BorderColor};
					overflow: visible;
					/* Above gradient (z=30), below text (z=40), below main circle (z=32). */
					z-index: 31;
					box-shadow: 0 8px 32px rgba(0,0,0,0.5);
					cursor: {interactive ? (dragging2 ? 'grabbing' : 'grab') : 'default'};
					touch-action: none;
				"
				onpointerdown={circle2PointerDown}
				onpointermove={circle2PointerMove}
				onpointerup={circle2PointerUp}
				onpointercancel={circle2PointerUp}
				role="presentation"
			>
				{#if circle2Image}
					<img
						src={circle2Image}
						alt=""
						style="
							width: 100%; height: 100%;
							object-fit: cover; object-position: center;
							border-radius: 50%;
							pointer-events: none;
						"
					/>
				{:else}
					<div style="
						width: 100%; height: 100%;
						border-radius: 50%;
						background: radial-gradient(circle at 30% 30%, rgba(255,255,255,0.12), rgba(255,255,255,0.03));
						display: flex; align-items: center; justify-content: center;
						color: rgba(255,255,255,0.35);
						font-family: system-ui, -apple-system, sans-serif;
						font-weight: 700;
						letter-spacing: 0.02em;
						pointer-events: none;
					">Circle</div>
				{/if}
			{#if interactive}
				<!-- Drag indicator (bottom-right) -->
				<div style="
					position: absolute;
					bottom: -38px; right: -38px;
					width: 60px; height: 60px;
					border-radius: 50%;
					background: rgba(0,0,0,0.75);
					border: 2px solid rgba(255,255,255,0.3);
					display: flex; align-items: center; justify-content: center;
					font-size: 28px; color: rgba(255,255,255,0.8);
					pointer-events: none;
				">⠿</div>

				<!-- Compact controls cluster (top-left) -->
				<div
					style="
						position: absolute;
						top: -22px; left: -22px;
						display: flex;
						gap: 8px;
						pointer-events: auto;
					"
					role="presentation"
				>
					<!-- svelte-ignore a11y_consider_explicit_label -->
					<button
						onpointerdown={(e) => { e.stopPropagation(); e.preventDefault(); }}
						onclick={() => onCircle2AIClick?.()}
						style="
							width: 42px; height: 42px;
							border-radius: 999px;
							background: rgba(0,0,0,0.78);
							border: 2px solid rgba(255,255,255,0.24);
							display: flex; align-items: center; justify-content: center;
							font-size: 14px; color: rgba(255,255,255,0.9);
							cursor: pointer;
							touch-action: none;
						"
						title="Generate with AI"
					>AI</button>

					<!-- svelte-ignore a11y_consider_explicit_label -->
					<button
						onpointerdown={(e) => { e.stopPropagation(); e.preventDefault(); }}
						onclick={removeCircle2}
						style="
							width: 42px; height: 42px;
							border-radius: 999px;
							background: rgba(0,0,0,0.78);
							border: 2px solid rgba(255,255,255,0.24);
							display: flex; align-items: center; justify-content: center;
							font-size: 18px; color: rgba(255,255,255,0.9);
							cursor: pointer;
							touch-action: none;
						"
						title="Remove circle"
					>✕</button>

					<!-- svelte-ignore a11y_consider_explicit_label -->
					<button
						onpointerdown={(e) => { e.stopPropagation(); e.preventDefault(); }}
						onclick={openCircle2Picker}
						style="
							width: 42px; height: 42px;
							border-radius: 999px;
							background: rgba(0,0,0,0.78);
							border: 2px solid rgba(255,255,255,0.24);
							display: flex; align-items: center; justify-content: center;
							font-size: 18px; color: rgba(255,255,255,0.9);
							cursor: pointer;
							touch-action: none;
						"
						title="Edit circle image"
					>✎</button>

					<!-- svelte-ignore a11y_consider_explicit_label -->
					<button
						onpointerdown={(e) => { e.stopPropagation(); e.preventDefault(); }}
						onclick={openCircle2BorderPicker}
						style="
							width: 42px; height: 42px;
							border-radius: 999px;
							background: rgba(0,0,0,0.78);
							border: 2px solid rgba(255,255,255,0.24);
							display: flex; align-items: center; justify-content: center;
							cursor: pointer;
							touch-action: none;
						"
						title="Change border color"
					>
						<span style="width:18px;height:18px;border-radius:6px;border:2px solid rgba(255,255,255,0.35);background:{circle2BorderColor};display:block;"></span>
					</button>
				</div>

				<!-- Resize handle (bottom-center) -->
				<div
					style="
						position: absolute;
						bottom: -38px; left: 50%; transform: translateX(-50%);
						width: 34px; height: 34px;
						border-radius: 10px;
						background: rgba(0,0,0,0.85);
						border: 2px solid rgba(255,255,255,0.45);
						display: flex; align-items: center; justify-content: center;
						font-size: 15px; color: rgba(255,255,255,0.85);
						cursor: nwse-resize;
						touch-action: none;
					"
					onpointerdown={circle2ResizeDown}
					onpointermove={circle2ResizeMove}
					onpointerup={circle2ResizeUp}
					onpointercancel={circle2ResizeUp}
					role="presentation"
				>⤡</div>
			{/if}
			</div>
		{/if}

		<!-- ── Subject cutout (transparent PNG) ────────────────────────────
			Renders ABOVE the circle so the subject overlaps the circle's edge,
			matching the "editorial" look of the reference. Uses the same
			background-position as the full image so the cutout lines up
			pixel-perfectly with the background behind it.
		-->
		{#if showSubjectCutout && subjectCutout}
			<!-- Cutout must pan + zoom identically to the background (it was
			     derived from the same pixels). Mirror the zoom/pan math above. -->
			<div style="position: absolute; inset: 0; overflow: hidden; z-index: 25; pointer-events: none;">
				{#if bgIsShrunk}
					<img
						src={subjectCutout}
						alt=""
						style="
							position: absolute;
							top: {bgShrunkTopPct}%; left: {bgShrunkLeftPct}%;
							width: {bgZoomPct}%; height: {bgZoomPct}%;
							object-fit: contain;
						"
					/>
				{:else}
					<img
						src={subjectCutout}
						alt=""
						style="
							position: absolute;
							top: 0; left: 0;
							width: {bgRenderSize}%; height: {bgRenderSize}%;
							object-fit: cover;
							object-position: {bgOffsetX}% {bgOffsetY}%;
							transform: translate({bgTranslateX}%, {bgTranslateY}%);
						"
					/>
				{/if}
			</div>
		{/if}

		<!-- ── Text area ──────────────────────────────────────────────────── -->
		<!-- z=40 keeps text in front of EVERYTHING (cutout @ 25, gradient @ 30,
		     circle @ 20, overlays @ 15) so words are never covered. -->
		<div
			style="
				position: absolute;
				bottom: 0; left: 0; right: 0;
				padding: 48px 64px 72px;
				z-index: 40;
				transform: translateY({textPanelOffsetY}px);
				{interactive && !editing ? 'cursor: grab;' : ''}
			"
			onpointerdown={textPointerDown}
			onpointermove={textPointerMove}
			onpointerup={textPointerUp}
			onpointercancel={textPointerUp}
			role={interactive ? 'button' : undefined}
			onmouseenter={() => hoveringText = true}
			onmouseleave={() => hoveringText = false}
		>
			<!-- Edit hint outline -->
			{#if interactive && hoveringText && !editing}
				<div style="
					position: absolute;
					inset: 8px;
					border: 2px dashed rgba(255,255,255,0.25);
					border-radius: 8px;
					pointer-events: none;
				"></div>
				<div style="
					position: absolute;
					top: 14px; right: 18px;
					font-family: 'DM Sans', sans-serif;
					font-size: 20px;
					color: rgba(255,255,255,0.4);
					pointer-events: none;
					letter-spacing: 0;
				">✎ double-click to edit</div>
			{/if}

			<!-- Source label -->
			{#if source}
				<div style="
					display: flex; align-items: center;
					gap: 18px; margin-bottom: 22px;
				">
					<div style="flex: 1; height: 2px; background: {sourceStyle.color ?? highlightColor}; opacity: 0.9;"></div>
					<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
					<span
						bind:this={sourceEl}
						data-text-selectable="source"
						onclick={selectSource}
						onkeydown={(e) => { if (e.key === 'Enter') selectSource(e as any); }}
						role={interactive ? 'button' : undefined}
						tabindex={interactive ? 0 : undefined}
						style="
							{sourceCss}
							white-space: nowrap;
							{interactive ? 'cursor: pointer;' : ''}
							{selectedText === 'source' ? 'box-shadow: 0 0 0 2px rgba(139,92,246,0.6); border-radius: 2px;' : ''}
						"
					>
						{#if sourceStyle.fontFamily}
							{source}
						{:else}
							<span style="font-style: italic;">{source.slice(0,1).toLowerCase()}</span>{source.slice(1)}
						{/if}
					</span>
					<div style="flex: 1; height: 2px; background: {sourceStyle.color ?? highlightColor}; opacity: 0.9;"></div>
				</div>
			{/if}

			<!-- Inline editor (active) -->
			{#if editing && interactive}
				<!-- svelte-ignore a11y_no_static_element_interactions -->
				<div
					bind:this={editableEl}
					data-text-selectable="headline"
					onkeydown={onEditKeydown}
					onclick={(e) => e.stopPropagation()}
					onmousedown={(e) => e.stopPropagation()}
					style="
						margin: 0; padding: 0;
						{headlineCss}
						text-transform: uppercase;
						word-break: break-word;
						box-shadow: 0 0 0 2px rgba(255,255,255,0.4);
						border-radius: 4px;
						cursor: text;
						white-space: pre-wrap;
					"
				>
					<HighlightEditor
						value={text}
						rows={1}
						showToolbar={true}
						defaultColor={highlightColor}
						onChange={(v) => onTextChange?.(v)}
						onBlur={finishEdit}
						onSelectionChange={(has, r) => {
							if (has && r) onHeadlineRangeSelect?.(r.start, r.end);
							else onHeadlineRangeSelect?.(-1, -1);
						}}
						ariaLabel="Headline editor"
					/>
				</div>
				<p style="
					font-family: 'DM Sans', sans-serif;
					font-size: 20px;
					color: rgba(255,255,255,0.3);
					margin: 12px 0 0;
					letter-spacing: 0;
					text-transform: none;
				">Select text and pick a color to highlight · Shift+Enter or Esc to finish</p>

			{:else}
				<!-- Rendered headline with highlights -->
				<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
				<p
					bind:this={headlineEl}
					data-text-selectable="headline"
					ondblclick={onHeadlineDblClick}
					onmouseup={onHeadlineMouseUp}
					style="
						margin: 0; padding: 0;
						{headlineCss}
						text-transform: uppercase;
						word-break: break-word;
						{selectedText === 'headline' ? 'box-shadow: 0 0 0 2px rgba(139,92,246,0.6); border-radius: 4px;' : ''}
						{interactive ? 'user-select: text; -webkit-user-select: text;' : ''}
					"
				>
					{#each segments as seg}
						{#if seg.highlighted}
							{#if seg.patternImage}
								<span style={patternStyle(seg.patternImage)}>{seg.text}</span>
							{:else if seg.gradientFrom && seg.gradientTo}
								<span style="
									background: linear-gradient(90deg, {seg.gradientFrom}, {seg.gradientTo});
									-webkit-background-clip: text;
									-webkit-text-fill-color: transparent;
									background-clip: text;
								">{seg.text}</span>
							{:else}
								<span style="color: {seg.color};">{seg.text}</span>
							{/if}
						{:else}
							{seg.text}
						{/if}
					{/each}
				</p>
			{/if}
		</div>
	</div>
</div>
