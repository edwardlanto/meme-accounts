<script lang="ts">
	import { tick } from 'svelte';
	import { parseHighlightMarkup, segmentText } from '$lib/highlight';
	import type { Overlay, TextOverlay, TextStyle, TextElementKind } from '$lib/types';
	import { loadGoogleFont } from '$lib/fonts';
	import HighlightEditor from '$lib/components/HighlightEditor.svelte';
	import { Maximize2, Minimize2, Minus, Plus, Trash2, MoveDiagonal2 } from 'lucide-svelte';

	interface Props {
		// Canvas size (template pixels). Default is IG portrait 4:5.
		w?: number;
		h?: number;
		backgroundImage?: string;
		backgroundVideo?: string; // blob URL or data URL for video background
		/** Light/dark look for the template canvas itself. */
		templateTheme?: 'light' | 'dark';
		/** Optional trim range (seconds) for backgroundVideo preview. */
		videoTrimStartSec?: number;
		videoTrimEndSec?: number;
		/** Seek the background video to this time (seconds). */
		videoSeekSec?: number;
		/** Background video audio controls (preview only). */
		videoMuted?: boolean;
		videoVolume?: number; // 0..1
		/** Emits background video duration (seconds) when known. */
		onVideoDuration?: (durationSec: number) => void;
		/** Transparent PNG of the foreground subject (from bg-removal). When provided
		 * and `showSubjectCutout` is true, renders ABOVE the circle so the subject
		 * visually overlaps the circle edge (editorial style). */
		subjectCutout?: string;
		showSubjectCutout?: boolean;
		circleImage?: string;
		/** If false, circle UI never renders (even in interactive mode). */
		allowCircle?: boolean;
		/** Circle image zoom (1–3). */
		circleImageZoom?: number;
		/** Circle image pan position as percent (0–100). */
		circleImagePanX?: number;
		/** Circle image pan position as percent (0–100). */
		circleImagePanY?: number;
		/** Circle border color (bindable). */
		circleBorderColor?: string;
		/** Circle border thickness in px (bindable). */
		circleBorderWidth?: number;
		/** Optional second circle badge (for a second photo/logo). */
		showCircle2?: boolean;
		circle2Image?: string;
		/** If false, circle2 UI never renders (even in interactive mode). */
		allowCircle2?: boolean;
		/** Circle2 image zoom (1–3). */
		circle2ImageZoom?: number;
		/** Circle2 image pan position as percent (0–100). */
		circle2ImagePanX?: number;
		/** Circle2 image pan position as percent (0–100). */
		circle2ImagePanY?: number;
		circle2BorderColor?: string;
		/** Circle2 border thickness in px (bindable). */
		circle2BorderWidth?: number;
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
		/** Background zoom as a percentage of frame size. 100 = fill frame
		 *  (object-fit cover at 100% box); >100 enlarges the media for crop-style
		 *  zoom-in; <100 letterboxes. Pan sliders move the layer when zoom ≠ 100.
		 *  Ignored when `bgFitMode` is `contain` (use `bgContainMagnify` instead). */
		bgZoom?: number;      // default 100
		/** `cover` = fill frame (may crop). `contain` = whole image visible (letterbox). */
		bgFitMode?: 'cover' | 'contain';
		/** In `contain` mode: scale % (50–200). 100 = largest fit without crop; >100 zooms in. */
		bgContainMagnify?: number;
		textPanelOffsetY?: number; // bottom text panel offset (bindable, px)
		/** Height of the bottom shadow gradient as a % of canvas height (0–100). Default 75. */
		shadowHeight?: number;
		/** Opacity of the bottom shadow (0–1). Default 1. */
		shadowStrength?: number;
		/** Optional repeating grid texture overlay (tiled). */
		gridImage?: string;
		gridTile?: number; // px
		gridOpacity?: number; // 0..1
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
		/** When set, trash removes the whole badge (parent hides circle). Otherwise only clears the image. */
		onCircleRemove?: () => void;
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
		templateTheme = 'light',
		videoTrimStartSec = 0,
		videoTrimEndSec = 0,
		videoSeekSec = NaN,
		videoMuted = true,
		videoVolume = 0.8,
		onVideoDuration,
		subjectCutout = '',
		showSubjectCutout = false,
		circleImage,
		allowCircle = true,
		circleImageZoom = $bindable(1),
		circleImagePanX = $bindable(50),
		circleImagePanY = $bindable(50),
		circleBorderColor = $bindable('#FFFFFF'),
		circleBorderWidth = $bindable(8),
		showCircle2 = false,
		circle2Image = '',
		allowCircle2 = true,
		circle2ImageZoom = $bindable(1),
		circle2ImagePanX = $bindable(50),
		circle2ImagePanY = $bindable(50),
		circle2BorderColor = $bindable('#FFFFFF'),
		circle2BorderWidth = $bindable(8),
		text,
		source = 'Markets',
		highlightColor = '#F5A623',
		textColor = templateTheme === 'light' ? '#0a0a0a' : '#FFFFFF',
		scale = 1,
		exportRef = $bindable(null),
		interactive = false,
		circleX    = $bindable(772),
		circleY    = $bindable(52),
		circleSize = $bindable(300),
		circle2X   = $bindable(80),
		circle2Y   = $bindable(80),
		circle2Size = $bindable(220),
		bgOffsetX  = $bindable(50),
		bgOffsetY  = $bindable(50),
		bgZoom     = $bindable(100),
		bgFitMode = $bindable<'cover' | 'contain'>('cover'),
		bgContainMagnify = $bindable(100),
		textPanelOffsetY = $bindable(0),
		shadowHeight = $bindable(75),
		shadowStrength = $bindable(1),
		gridImage = '',
		gridTile = 80,
		gridOpacity = 0.25,
		overlays   = [],
		textOverlays = [],
		headlineStyle = {},
		sourceStyle = {},
		selectedText = null,
		onTextChange,
		onCircleMove,
		onCircleImageChange,
		onCircleRemove,
		onCircleAIClick,
		onCircle2Move,
		onCircle2ImageChange,
		onCircle2AIClick,
		onOverlaysChange,
		onTextOverlaysChange,
		onTextSelect,
		onHeadlineRangeSelect,
	}: Props = $props();

	const isLight = $derived(templateTheme === 'light');

	// ── Background video preview trim/seek ────────────────────────────────
	let bgVideoEl = $state<HTMLVideoElement | null>(null);
	let lastDuration = 0;

	function onBgVideoMeta(e: Event) {
		const el = e.currentTarget as HTMLVideoElement;
		bgVideoEl = el;
		const d = Number(el.duration || 0);
		if (Number.isFinite(d) && d > 0 && Math.abs(d - lastDuration) > 0.001) {
			lastDuration = d;
			onVideoDuration?.(d);
		}
	}

	function onBgVideoTimeUpdate(e: Event) {
		const el = e.currentTarget as HTMLVideoElement;
		bgVideoEl = el;
		const start = Number(videoTrimStartSec || 0);
		const end = Number(videoTrimEndSec || 0);
		if (!(Number.isFinite(start) && Number.isFinite(end) && end > start + 0.02)) return;
		if (el.currentTime < start || el.currentTime >= end) {
			try { el.currentTime = start; } catch { /* ignore */ }
		}
	}

	$effect(() => {
		const el = bgVideoEl;
		const t = Number(videoSeekSec);
		if (!el) return;
		if (!Number.isFinite(t)) return;
		// Only seek when user explicitly scrubs (avoid fighting autoplay loop).
		try { el.currentTime = Math.max(0, t); } catch { /* ignore */ }
	});

	$effect(() => {
		const el = bgVideoEl;
		if (!el) return;
		const muted = !!videoMuted;
		const vol = Math.max(0, Math.min(1, Number(videoVolume)));
		el.muted = muted;
		el.volume = Number.isFinite(vol) ? vol : 0.8;
		// If user unmutes, attempt to resume playback (requires user gesture; safe to ignore errors).
		if (!muted) {
			try { void el.play(); } catch { /* ignore */ }
		}
	});

	// ── Text overlays ─────────────────────────────────────────────────────
	let activeTextOverlayId = $state<string | null>(null);
	let textOverlayAction = $state<'drag' | null>(null);
	let toLastMx = 0;
	let toLastMy = 0;
	let editingTextOverlayId = $state<string | null>(null);
	let snapGuide = $state<null | { x?: number; y?: number }>(null);

	// When entering edit mode, focus the contenteditable immediately.
	$effect(() => {
		const id = editingTextOverlayId;
		if (!id) return;
		// Let DOM update, then focus.
		void tick().then(() => {
			const el = document.querySelector<HTMLElement>(`[data-text-overlay-id="${CSS.escape(id)}"] [contenteditable="true"]`);
			try { el?.focus(); } catch {}
		});
	});

	function textOverlayDown(e: PointerEvent, id: string) {
		if (!interactive) return;
		// Selecting a text overlay should show the floating toolbar in the studio.
		try { (e.currentTarget as HTMLElement).dataset.textOverlayId = id; } catch {}
		onTextSelect?.('textOverlay', e.currentTarget as HTMLElement);
		activeTextOverlayId = id;
		textOverlayAction = 'drag';
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
			const el = e.currentTarget as HTMLElement;
			const r = el.getBoundingClientRect();
			const curW = Math.max(1, r.width / scale);
			const curH = Math.max(1, r.height / scale);
			let nx = Math.max(0, Math.min(W - curW, ov.x + dx));
			let ny = Math.max(0, Math.min(H - curH, ov.y + dy));
			snapGuide = null;
			// Canva-style snapping to centers when close.
			const SNAP_PX = 10;
			const cx = nx + curW / 2;
			const cy = ny + curH / 2;
			const midX = W / 2;
			const midY = H / 2;
			if (Math.abs(cx - midX) <= SNAP_PX) {
				nx = Math.max(0, Math.min(W - curW, midX - curW / 2));
				snapGuide = { ...(snapGuide ?? {}), x: midX };
			}
			if (Math.abs(cy - midY) <= SNAP_PX) {
				ny = Math.max(0, Math.min(H - curH, midY - curH / 2));
				snapGuide = { ...(snapGuide ?? {}), y: midY };
			}
			onTextOverlaysChange?.(textOverlays.map((o) => (o.id === id ? { ...o, x: nx, y: ny } : o)));
		}
	}

	function textOverlayUp() {
		activeTextOverlayId = null;
		textOverlayAction = null;
		snapGuide = null;
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
		// If the user was dragging the panel, don't treat this as a "select text element" click.
		if (textMoved) return;
		e.stopPropagation();
		if (headlineEl) onTextSelect?.('headline', headlineEl);
	}

	function selectSource(e: MouseEvent) {
		if (!interactive) return;
		// If the user was dragging the panel, don't treat this as a "select text element" click.
		if (textMoved) return;
		e.stopPropagation();
		if (sourceEl) onTextSelect?.('source', sourceEl);
	}

	// Whether there's any background media (image or video)
	const hasBg = $derived(!!(backgroundVideo || backgroundImage));

	// Clamped zoom % (30–300). At ≥100, cover mode draws the layer at bgZoomPct% with
	// object-fit: cover. Minimum overscan to 105% at low zoom avoids gaps that
	// show as black lines on the sides when rasterizing (e.g. html-to-image export).
	const bgZoomPct = $derived(Math.max(30, Math.min(300, Number(bgZoom) || 100)));
	const BG_COVER_MIN_BLEED = 105; // % of frame — overscan past clip for clean PNG export
	/** Extra scale on cover media so raster export (html-to-image) doesn’t leave 1px side gutters */
	const BG_COVER_RASTER_PAD = 1.03;
	const bgRenderSize = $derived(
		bgFitMode === 'contain' ? bgZoomPct : Math.max(bgZoomPct, BG_COVER_MIN_BLEED),
	);
	const bgRenderOverflowPct = $derived(Math.max(0, bgRenderSize - 100)); // pan room when zoomed in
	// Natural panning: slide an oversized layer inside the frame.
	//  - bgOffsetX/Y = 0  → show left/top edge
	//  - bgOffsetX/Y = 100→ show right/bottom edge
	const bgPanLeftPct = $derived(-(bgRenderOverflowPct * (bgOffsetX / 100)));
	const bgPanTopPct  = $derived(-(bgRenderOverflowPct * (bgOffsetY / 100)));
	// When shrinking below 100%, the image no longer covers the frame. In that
	// case we center it and the X/Y sliders instead pan the shrunk image within
	// the frame (so 0→100% shifts the image from one edge to the other).
	const bgIsShrunk = $derived(bgZoomPct < 100);
	const bgShrunkLeftPct = $derived(bgIsShrunk ? bgOffsetX * (100 - bgZoomPct) / 100 : 0);
	const bgShrunkTopPct = $derived(bgIsShrunk ? bgOffsetY * (100 - bgZoomPct) / 100 : 0);

	const bgContainMagnifyPct = $derived(
		Math.max(50, Math.min(200, Number(bgContainMagnify) || 100)),
	);

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
	let textArmed = $state(false);
	let textPointerId = 0;
	let textCaptureEl: HTMLElement | null = null;
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
		const target = e.target as HTMLElement;
		const startedOnSelectable = !!target.closest('[data-text-selectable]');
		textArmed = true;
		textDragging = !startedOnSelectable; // if on text, only start drag after threshold move
		textMoved = false;
		textStartY = e.clientY;
		textStartOffset = textPanelOffsetY;
		textPointerId = e.pointerId;
		textCaptureEl = e.currentTarget as HTMLElement;
		// Pointer-capturing immediately can interfere with dblclick on the headline/source.
		// Only capture right away when we *know* we're dragging (i.e. started off-text).
		if (!startedOnSelectable) textCaptureEl.setPointerCapture(e.pointerId);
		// If the gesture started on text, allow click handlers to run unless we
		// later detect an actual drag (then we suppress the click via textMoved).
		if (!startedOnSelectable) e.stopPropagation();
	}

	function textPointerMove(e: PointerEvent) {
		if (!textArmed) return;
		const dy = (e.clientY - textStartY) / scale;
		if (!textDragging) {
			// Arm drag when the user actually moves, so clicks on headline/source
			// still work to select those elements.
			if (Math.abs(dy) <= 4) return;
			textDragging = true;
			textMoved = true;
			// Capture once we commit to dragging (safe for dblclick).
			try { textCaptureEl?.setPointerCapture(textPointerId); } catch { /* ignore */ }
			// Once we start dragging, prevent text selection and cancel downstream clicks.
			e.preventDefault();
			e.stopPropagation();
			window.getSelection()?.removeAllRanges();
		} else if (Math.abs(dy) > 4) {
			textMoved = true;
		}

		// Allow dragging panel from its base position (0) all the way up to top
		const baseTop = H - TEXT_PANEL_H; // y where panel starts (in template px)
		const minOffset = -baseTop;
		const maxOffset = 0;
		textPanelOffsetY = Math.max(minOffset, Math.min(maxOffset, textStartOffset + dy));
	}

	function textPointerUp(e: PointerEvent) {
		if (!textArmed) return;
		textArmed = false;
		textDragging = false;
		textPointerId = 0;
		textCaptureEl = null;
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
	let hoveringCircle = $state(false);
	let circleHoverHideTimer: ReturnType<typeof setTimeout> | null = null;
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
		if (onCircleRemove) {
			onCircleRemove();
		} else {
			onCircleImageChange?.('');
		}
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
		// Allow oversize circles (circleSize may exceed W/H).
		const minX = Math.min(0, W - circleSize);
		const maxX = Math.max(0, W - circleSize);
		const minY = Math.min(0, H - circleSize);
		const maxY = Math.max(0, H - circleSize);
		const nx = Math.max(minX, Math.min(maxX, circleX + dx));
		const ny = Math.max(minY, Math.min(maxY, circleY + dy));
		circleX = nx;
		circleY = ny;
		onCircleMove?.(nx, ny);
	}

	function circlePointerUp() {
		dragging = false;
	}

	function circleHoverEnter() {
		hoveringCircle = true;
		if (circleHoverHideTimer) {
			clearTimeout(circleHoverHideTimer);
			circleHoverHideTimer = null;
		}
	}
	function circleHoverLeave() {
		if (circleHoverHideTimer) clearTimeout(circleHoverHideTimer);
		// Small delay prevents the toolbar/handle from vanishing
		// while the cursor travels from the circle to the controls.
		circleHoverHideTimer = setTimeout(() => {
			hoveringCircle = false;
			circleHoverHideTimer = null;
		}, 160);
	}

	function clamp(n: number, a: number, b: number) { return Math.max(a, Math.min(b, n)); }

	let circlePanningImage = $state(false);
	let circlePanStart = $state<{ x: number; y: number; panX: number; panY: number } | null>(null);

	function startCircleImagePan(e: PointerEvent) {
		if (!interactive) return;
		if (!e.altKey) return;
		e.preventDefault();
		e.stopPropagation();
		(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
		circlePanningImage = true;
		circlePanStart = {
			x: e.clientX,
			y: e.clientY,
			panX: Number(circleImagePanX) || 50,
			panY: Number(circleImagePanY) || 50,
		};
	}

	function moveCircleImagePan(e: PointerEvent) {
		if (!circlePanningImage || !circlePanStart) return;
		const dx = (e.clientX - circlePanStart.x) / Math.max(0.001, scale);
		const dy = (e.clientY - circlePanStart.y) / Math.max(0.001, scale);
		const denom = Math.max(80, Number(circleSize) || 0) * (Number(circleImageZoom) || 1);
		circleImagePanX = clamp(circlePanStart.panX + (dx / denom) * 100, 0, 100);
		circleImagePanY = clamp(circlePanStart.panY + (dy / denom) * 100, 0, 100);
	}

	function endCircleImagePan(e: PointerEvent) {
		if (!circlePanningImage) return;
		e.stopPropagation();
		circlePanningImage = false;
		circlePanStart = null;
	}

	function onCircleImageWheel(e: WheelEvent) {
		if (!interactive) return;
		if (!e.altKey) return;
		e.preventDefault();
		const z = Number(circleImageZoom) || 1;
		const next = clamp(z + (e.deltaY > 0 ? -0.08 : 0.08), 1, 5);
		circleImageZoom = next;
	}

	function bumpCircleImageZoom(delta: number) {
		const z = Number(circleImageZoom) || 1;
		circleImageZoom = clamp(z + delta, 1, 5);
	}

	/** Step circle diameter (template px); clamps position like resize. */
	function bumpCircleDiameter(delta: number) {
		const next = Math.round(Math.max(96, Math.min(720, Number(circleSize) + delta)));
		if (next === circleSize) return;
		circleSize = next;
		circleX = Math.max(Math.min(0, W - circleSize), Math.min(Math.max(0, W - circleSize), circleX));
		circleY = Math.max(Math.min(0, H - circleSize), Math.min(Math.max(0, H - circleSize), circleY));
		onCircleMove?.(circleX, circleY);
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
		// No max: allow circles as large as the user wants.
		const nextSize = Math.round(Math.max(64, circleStartSize + delta));
		circleSize = nextSize;
		// Keep the circle within a sensible draggable range even when oversized.
		circleX = Math.max(Math.min(0, W - circleSize), Math.min(Math.max(0, W - circleSize), circleX));
		circleY = Math.max(Math.min(0, H - circleSize), Math.min(Math.max(0, H - circleSize), circleY));
		onCircleMove?.(circleX, circleY);
	}

	function circleResizeUp() {
		resizingCircle = false;
	}

	// ── Second circle drag ────────────────────────────────────────────────
	let dragging2 = $state(false);
	let resizingCircle2 = $state(false);
	let hoveringCircle2 = $state(false);
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
		// Allow oversize circles (circle2Size may exceed W/H).
		const minX = Math.min(0, W - circle2Size);
		const maxX = Math.max(0, W - circle2Size);
		const minY = Math.min(0, H - circle2Size);
		const maxY = Math.max(0, H - circle2Size);
		const nx = Math.max(minX, Math.min(maxX, circle2X + dx));
		const ny = Math.max(minY, Math.min(maxY, circle2Y + dy));
		circle2X = nx;
		circle2Y = ny;
		onCircle2Move?.(nx, ny);
	}

	function circle2PointerUp() {
		dragging2 = false;
	}

	let circle2HoverHideTimer: ReturnType<typeof setTimeout> | null = null;
	function circle2HoverEnter() {
		hoveringCircle2 = true;
		if (circle2HoverHideTimer) {
			clearTimeout(circle2HoverHideTimer);
			circle2HoverHideTimer = null;
		}
	}
	function circle2HoverLeave() {
		if (circle2HoverHideTimer) clearTimeout(circle2HoverHideTimer);
		circle2HoverHideTimer = setTimeout(() => {
			hoveringCircle2 = false;
			circle2HoverHideTimer = null;
		}, 160);
	}

	let circle2PanningImage = $state(false);
	let circle2PanStart = $state<{ x: number; y: number; panX: number; panY: number } | null>(null);

	function startCircle2ImagePan(e: PointerEvent) {
		if (!interactive) return;
		if (!e.altKey) return;
		e.preventDefault();
		e.stopPropagation();
		(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
		circle2PanningImage = true;
		circle2PanStart = {
			x: e.clientX,
			y: e.clientY,
			panX: Number(circle2ImagePanX) || 50,
			panY: Number(circle2ImagePanY) || 50,
		};
	}

	function moveCircle2ImagePan(e: PointerEvent) {
		if (!circle2PanningImage || !circle2PanStart) return;
		const dx = (e.clientX - circle2PanStart.x) / Math.max(0.001, scale);
		const dy = (e.clientY - circle2PanStart.y) / Math.max(0.001, scale);
		const denom = Math.max(80, Number(circle2Size) || 0) * (Number(circle2ImageZoom) || 1);
		circle2ImagePanX = clamp(circle2PanStart.panX + (dx / denom) * 100, 0, 100);
		circle2ImagePanY = clamp(circle2PanStart.panY + (dy / denom) * 100, 0, 100);
	}

	function endCircle2ImagePan(e: PointerEvent) {
		if (!circle2PanningImage) return;
		e.stopPropagation();
		circle2PanningImage = false;
		circle2PanStart = null;
	}

	function onCircle2ImageWheel(e: WheelEvent) {
		if (!interactive) return;
		if (!e.altKey) return;
		e.preventDefault();
		const z = Number(circle2ImageZoom) || 1;
		const next = clamp(z + (e.deltaY > 0 ? -0.08 : 0.08), 1, 5);
		circle2ImageZoom = next;
	}

	function bumpCircle2ImageZoom(delta: number) {
		const z = Number(circle2ImageZoom) || 1;
		circle2ImageZoom = clamp(z + delta, 1, 5);
	}

	function bumpCircle2Diameter(delta: number) {
		const next = Math.round(Math.max(96, Math.min(720, Number(circle2Size) + delta)));
		if (next === circle2Size) return;
		circle2Size = next;
		circle2X = Math.max(Math.min(0, W - circle2Size), Math.min(Math.max(0, W - circle2Size), circle2X));
		circle2Y = Math.max(Math.min(0, H - circle2Size), Math.min(Math.max(0, H - circle2Size), circle2Y));
		onCircle2Move?.(circle2X, circle2Y);
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
		// No max: allow circles as large as the user wants.
		const nextSize = Math.round(Math.max(64, circle2StartSize + delta));
		circle2Size = nextSize;
		circle2X = Math.max(Math.min(0, W - circle2Size), Math.min(Math.max(0, W - circle2Size), circle2X));
		circle2Y = Math.max(Math.min(0, H - circle2Size), Math.min(Math.max(0, H - circle2Size), circle2Y));
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
			mix-blend-mode: screen;
			filter: contrast(1.25) saturate(1.15);
			opacity: 0.98;
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
			background: {isLight ? '#ffffff' : '#0a0a0a'};
			transform: scale({scale});
			transform-origin: top left;
			font-family: 'Bebas Neue', Impact, 'Arial Black', sans-serif;
			{interactive ? 'user-select: none;' : ''}
		"
	>
		<!-- Background: video takes priority over image.

		     Zoom + pan model:
		     - Fill frame (cover): max(zoom,105)% box + slight scale() so raster export
		       doesn’t leave thin side gutters (html-to-image / subpixels).
		       Pan sliders translate the oversize element.
		     - At zoom < 100% (shrink), we letterbox the media inside a dark
		       backdrop and the pan sliders reposition the shrunken media
		       within the visible frame.
		     - The outer div always clips so nothing leaks into other layers. -->
		{#if backgroundVideo}
			<div style="position: absolute; inset: 0; overflow: hidden; pointer-events: none; background: #0a0a0a;">
				{#if bgFitMode === 'contain'}
					<div
						style="
							position: absolute;
							inset: 0;
							display: flex;
							align-items: center;
							justify-content: center;
						"
					>
						<div
							style="
								width: 100%;
								height: 100%;
								transform: scale({bgContainMagnifyPct / 100});
								transform-origin: center center;
							"
						>
							<!-- svelte-ignore a11y_media_has_caption -->
							<video
								src={backgroundVideo}
								autoplay loop playsinline
								muted={videoMuted}
								onloadedmetadata={onBgVideoMeta}
								ontimeupdate={onBgVideoTimeUpdate}
								style="
									width: 100%;
									height: 100%;
									display: block;
									object-fit: contain;
									object-position: {bgOffsetX}% {bgOffsetY}%;
								"
							></video>
						</div>
					</div>
				{:else if bgIsShrunk}
					<!-- svelte-ignore a11y_media_has_caption -->
					<video
						src={backgroundVideo}
						autoplay loop playsinline
						muted={videoMuted}
						onloadedmetadata={onBgVideoMeta}
						ontimeupdate={onBgVideoTimeUpdate}
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
						autoplay loop playsinline
						muted={videoMuted}
						onloadedmetadata={onBgVideoMeta}
						ontimeupdate={onBgVideoTimeUpdate}
						style="
							position: absolute;
							top: {bgPanTopPct}%; left: {bgPanLeftPct}%;
							width: {bgRenderSize}%; height: {bgRenderSize}%;
							object-fit: cover;
							object-position: center;
							transform: translate3d(0,0,0) scale({BG_COVER_RASTER_PAD});
							transform-origin: center center;
						"
					></video>
				{/if}
			</div>
		{:else if backgroundImage}
			<div style="position: absolute; inset: 0; overflow: hidden; pointer-events: none; background: #0a0a0a;">
				{#if bgFitMode === 'contain'}
					<div
						style="
							position: absolute;
							inset: 0;
							display: flex;
							align-items: center;
							justify-content: center;
						"
					>
						<div
							style="
								width: 100%;
								height: 100%;
								transform: scale({bgContainMagnifyPct / 100});
								transform-origin: center center;
							"
						>
							<img
								src={backgroundImage}
								alt=""
								style="
									width: 100%;
									height: 100%;
									display: block;
									object-fit: contain;
									object-position: {bgOffsetX}% {bgOffsetY}%;
								"
							/>
						</div>
					</div>
				{:else if bgIsShrunk}
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
							top: {bgPanTopPct}%; left: {bgPanLeftPct}%;
							width: {bgRenderSize}%; height: {bgRenderSize}%;
							object-fit: cover;
							object-position: center;
							transform: translate3d(0,0,0) scale({BG_COVER_RASTER_PAD});
							transform-origin: center center;
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
		<div style="position: absolute; inset: 0; z-index: 36; pointer-events: none;
			background: {shadowGradient};"></div>

		<!-- ── Grid overlay (tiled texture) ───────────────────────────────── -->
		{#if gridImage}
			<div
				style="
					position: absolute; inset: 0;
					z-index: 14;
					pointer-events: none;
					opacity: {Math.max(0, Math.min(1, gridOpacity))};
					background-image: url('{gridImage}');
					background-repeat: repeat;
					background-size: {Math.max(8, Number(gridTile) || 80)}px {Math.max(8, Number(gridTile) || 80)}px;
					background-position: 0 0;
					mix-blend-mode: overlay;
				"
			></div>
		{/if}

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
						onpointerdown={(e) => { e.stopPropagation(); e.preventDefault(); }}
						onclick={(e) => overlayDelete(e, overlay.id)}
						style="
							position: absolute; top: -14px; right: -14px;
							width: 36px; height: 36px; border-radius: 50%;
							background: rgba(0,0,0,0.85); border: 2px solid rgba(255,255,255,0.4);
							color: #fff;
							display: flex; align-items: center; justify-content: center;
							cursor: pointer; z-index: 1; touch-action: none;
						"
						title="Remove overlay"
						aria-label="Remove overlay"
					><Trash2 size={18} /></button>

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

		{#if snapGuide?.x != null}
			<div
				style="
					position: absolute;
					left: {snapGuide.x}px;
					top: 0;
					bottom: 0;
					width: 1px;
					background: rgba(34,211,238,0.65);
					box-shadow: 0 0 0 1px rgba(34,211,238,0.15);
					z-index: 34;
					pointer-events: none;
				"
			></div>
		{/if}
		{#if snapGuide?.y != null}
			<div
				style="
					position: absolute;
					top: {snapGuide.y}px;
					left: 0;
					right: 0;
					height: 1px;
					background: rgba(34,211,238,0.65);
					box-shadow: 0 0 0 1px rgba(34,211,238,0.15);
					z-index: 34;
					pointer-events: none;
				"
			></div>
		{/if}

		<!-- ── Text overlays ──────────────────────────────────────────────── -->
		{#each textOverlays as t (t.id)}
			{@const isEditing = editingTextOverlayId === t.id}
			{@const css = t.style ?? {}}
			<div
				style="
					position: absolute;
					left: {t.x}px; top: {t.y}px;
					width: fit-content;
					height: fit-content;
					max-width: 820px;
					z-index: 35;
					touch-action: none;
					cursor: {interactive ? (activeTextOverlayId === t.id && textOverlayAction === 'drag' ? 'grabbing' : 'grab') : 'default'};
				"
				data-text-selectable="textOverlay"
				data-text-overlay-id={t.id}
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
							padding: 8px;
							box-sizing: border-box;
							border-radius: 10px;
							background: rgba(0,0,0,0.14);
							border: 1px solid rgba(255,255,255,0.25);
						"
						onclick={(e) => e.stopPropagation()}
						role="presentation"
					>
						<HighlightEditor
							value={t.text}
							rows={3}
							showToolbar={false}
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
							padding: 8px;
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
						type="button"
						onpointerdown={(e) => { e.stopPropagation(); e.preventDefault(); }}
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
						aria-label="Remove text overlay"
					>✕</button>

					<!-- Text overlays are draggable-only (no resize handle) -->
				{/if}
			</div>
		{/each}

		<!-- ── Draggable circle badge ──────────────────────────────────────── -->
{#if allowCircle && (circleImage || interactive)}
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
					box-sizing: border-box;
					border-radius: 50%;
					border: {circleBorderWidth}px solid {circleBorderColor};
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
				onmouseenter={circleHoverEnter}
				onmouseleave={circleHoverLeave}
				role="presentation"
			>
				{#if circleImage}
					<div
						style="
							position: absolute;
							inset: 0;
							border-radius: 50%;
							overflow: hidden;
							touch-action: none;
							cursor: {interactive ? (circlePanningImage ? 'grabbing' : 'grab') : 'default'};
						"
						onpointerdown={startCircleImagePan}
						onpointermove={moveCircleImagePan}
						onpointerup={endCircleImagePan}
						onpointercancel={endCircleImagePan}
						onwheel={onCircleImageWheel}
						onmouseenter={circleHoverEnter}
						onmouseleave={circleHoverLeave}
						title="Alt+wheel or ± to zoom · Alt+drag to pan · use corner or ⊕/⊖ to resize circle"
						role="presentation"
					>
						<img
							src={circleImage}
							alt=""
							style="
								position:absolute;
								left:{Number(circleImagePanX) || 50}%;
								top:{Number(circleImagePanY) || 50}%;
								width:100%;
								height:100%;
								object-fit:cover;
								transform:translate(-50%,-50%) scale({Number(circleImageZoom) || 1});
								will-change: transform;
								pointer-events: none;
								user-select:none;
							"
						/>
					</div>
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
				{@const showCircleTools = hoveringCircle || dragging || resizingCircle}

				{#if showCircleTools}
					<!-- Hover toolbar (single place for all controls) -->
					<div
						style="
							position: absolute;
							top: -64px;
							left: 50%;
							transform: translateX(-50%);
							display: flex;
							gap: 10px;
							padding: 8px;
							border-radius: 999px;
							background: rgba(0,0,0,0.78);
							border: 2px solid rgba(255,255,255,0.18);
							backdrop-filter: blur(10px);
							pointer-events: auto;
						"
						onmouseenter={circleHoverEnter}
						onmouseleave={circleHoverLeave}
						role="presentation"
					>
						<button
							onpointerdown={(e) => { e.stopPropagation(); e.preventDefault(); }}
							onclick={() => onCircleAIClick?.()}
							style="width: 52px; height: 52px; border-radius: 999px; border: 0; background: rgba(255,255,255,0.06); color: rgba(255,255,255,0.9); cursor: pointer; touch-action: none; font-size: 16px;"
							title="Generate with AI"
							aria-label="Generate with AI"
						>AI</button>

						<button
							onpointerdown={(e) => { e.stopPropagation(); e.preventDefault(); }}
							onclick={openCirclePicker}
							style="width: 52px; height: 52px; border-radius: 999px; border: 0; background: rgba(255,255,255,0.06); color: rgba(255,255,255,0.9); cursor: pointer; touch-action: none; font-size: 22px;"
							title="Edit circle image"
							aria-label="Edit circle image"
						>✎</button>

						<div
							style="display:flex;align-items:center;gap:8px;padding:0 10px;height:52px;border-radius:999px;border:0;background:rgba(255,255,255,0.06);color:rgba(255,255,255,0.9);"
							title="Border thickness"
							aria-label="Border thickness"
							role="group"
						>
							<button
								type="button"
								onpointerdown={(e) => { e.stopPropagation(); e.preventDefault(); }}
								onclick={() => (circleBorderWidth = Math.max(0, Math.round((circleBorderWidth ?? 8) - 1)))}
								style="width:28px;height:28px;border-radius:999px;border:0;background:rgba(0,0,0,0.28);color:rgba(255,255,255,0.95);cursor:pointer;line-height:1;"
								title="Thinner border"
								aria-label="Thinner border"
							>−</button>
							<span style="min-width:22px;text-align:center;font-size:12px;font-weight:700;opacity:0.9;">{Math.round(circleBorderWidth ?? 8)}</span>
							<button
								type="button"
								onpointerdown={(e) => { e.stopPropagation(); e.preventDefault(); }}
								onclick={() => (circleBorderWidth = Math.min(40, Math.round((circleBorderWidth ?? 8) + 1)))}
								style="width:28px;height:28px;border-radius:999px;border:0;background:rgba(0,0,0,0.28);color:rgba(255,255,255,0.95);cursor:pointer;line-height:1;"
								title="Thicker border"
								aria-label="Thicker border"
							>+</button>
						</div>

						<button
							onpointerdown={(e) => { e.stopPropagation(); e.preventDefault(); }}
							onclick={openCircleBorderPicker}
							style="width: 52px; height: 52px; border-radius: 999px; border: 0; background: rgba(255,255,255,0.06); display:flex; align-items:center; justify-content:center; cursor: pointer; touch-action: none;"
							title="Change border color"
							aria-label="Change border color"
						>
							<span style="width:22px;height:22px;border-radius:7px;border:2px solid rgba(255,255,255,0.35);background:{circleBorderColor};display:block;"></span>
						</button>

						<button
							onpointerdown={(e) => { e.stopPropagation(); e.preventDefault(); }}
							onclick={removeCircle}
							style="width: 52px; height: 52px; border-radius: 999px; border: 0; background: rgba(255,255,255,0.06); color: rgba(255,255,255,0.9); cursor: pointer; touch-action: none; display:flex; align-items:center; justify-content:center;"
							title="Remove circle"
							aria-label="Remove circle"
						><Trash2 size={22} /></button>

						<button
							onpointerdown={(e) => { e.stopPropagation(); e.preventDefault(); }}
							onclick={() => { circleImageZoom = 1; circleImagePanX = 50; circleImagePanY = 50; }}
							style="width: 52px; height: 52px; border-radius: 999px; border: 0; background: rgba(255,255,255,0.06); color: rgba(255,255,255,0.9); cursor: pointer; touch-action: none; display:flex; align-items:center; justify-content:center; font-size: 12px; font-weight: 800;"
							title="Reset image zoom/pan"
							aria-label="Reset image zoom/pan"
						>↺</button>

						<div
							style="display:flex;flex-direction:column;gap:4px;padding:4px;border-radius:999px;background:rgba(255,255,255,0.06);"
							role="group"
							aria-label="Photo zoom inside circle"
						>
							<button
								type="button"
								onpointerdown={(e) => { e.stopPropagation(); e.preventDefault(); }}
								onclick={() => bumpCircleImageZoom(0.12)}
								disabled={(Number(circleImageZoom) || 1) >= 4.99}
								style="width:40px;height:40px;border-radius:999px;border:0;background:rgba(0,0,0,0.35);color:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center;opacity:{(Number(circleImageZoom) || 1) >= 4.99 ? 0.35 : 1};"
								title="Zoom photo in (up to 5×)"
								aria-label="Zoom photo in"
							><Plus size={18} /></button>
							<button
								type="button"
								onpointerdown={(e) => { e.stopPropagation(); e.preventDefault(); }}
								onclick={() => bumpCircleImageZoom(-0.12)}
								disabled={(Number(circleImageZoom) || 1) <= 1.01}
								style="width:40px;height:40px;border-radius:999px;border:0;background:rgba(0,0,0,0.35);color:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center;opacity:{(Number(circleImageZoom) || 1) <= 1.01 ? 0.35 : 1};"
								title="Zoom photo out"
								aria-label="Zoom photo out"
							><Minus size={18} /></button>
						</div>

						<div
							style="display:flex;flex-direction:column;gap:4px;padding:4px;border-radius:999px;background:rgba(255,255,255,0.06);"
							role="group"
							aria-label="Circle size"
						>
							<button
								type="button"
								onpointerdown={(e) => { e.stopPropagation(); e.preventDefault(); }}
								onclick={() => bumpCircleDiameter(36)}
								disabled={Number(circleSize) >= 720}
								style="width:40px;height:40px;border-radius:999px;border:0;background:rgba(0,0,0,0.35);color:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center;opacity:{Number(circleSize) >= 720 ? 0.35 : 1};"
								title="Expand circle"
								aria-label="Expand circle"
							><Maximize2 size={16} /></button>
							<button
								type="button"
								onpointerdown={(e) => { e.stopPropagation(); e.preventDefault(); }}
								onclick={() => bumpCircleDiameter(-36)}
								disabled={Number(circleSize) <= 96}
								style="width:40px;height:40px;border-radius:999px;border:0;background:rgba(0,0,0,0.35);color:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center;opacity:{Number(circleSize) <= 96 ? 0.35 : 1};"
								title="Shrink circle"
								aria-label="Shrink circle"
							><Minimize2 size={16} /></button>
						</div>
					</div>
				{/if}

				{#if showCircleTools}
					<!-- Resize handle (bottom-right) -->
					<div
						style="
							position: absolute;
							bottom: -14px; right: -14px;
							width: 52px; height: 52px;
							border-radius: 999px;
							background: rgba(0,0,0,0.85);
							border: 2px solid rgba(255,255,255,0.30);
							display: flex; align-items: center; justify-content: center;
							color: rgba(255,255,255,0.90);
							cursor: nwse-resize;
							touch-action: none;
						"
						onmouseenter={circleHoverEnter}
						onmouseleave={circleHoverLeave}
						onpointerdown={circleResizeDown}
						onpointermove={circleResizeMove}
						onpointerup={circleResizeUp}
						onpointercancel={circleResizeUp}
						role="presentation"
					title="Resize circle"
					aria-label="Resize circle"
				><MoveDiagonal2 size={22} /></div>
				{/if}
			{/if}
			</div>
		{/if}

		<!-- ── Optional second circle badge ───────────────────────────────── -->
{#if allowCircle2 && (circle2Image || (interactive && showCircle2))}
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
					box-sizing: border-box;
					border-radius: 50%;
					border: {circle2BorderWidth}px solid {circle2BorderColor};
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
				onmouseenter={circle2HoverEnter}
				onmouseleave={circle2HoverLeave}
				role="presentation"
			>
				{#if circle2Image}
					<div
						style="
							position: absolute;
							inset: 0;
							border-radius: 50%;
							overflow: hidden;
							touch-action: none;
							cursor: {interactive ? (circle2PanningImage ? 'grabbing' : 'grab') : 'default'};
						"
						onpointerdown={startCircle2ImagePan}
						onpointermove={moveCircle2ImagePan}
						onpointerup={endCircle2ImagePan}
						onpointercancel={endCircle2ImagePan}
						onwheel={onCircle2ImageWheel}
						onmouseenter={circle2HoverEnter}
						onmouseleave={circle2HoverLeave}
						title="Alt+wheel or ± to zoom · Alt+drag to pan · use corner or ⊕/⊖ to resize circle"
						role="presentation"
					>
						<img
							src={circle2Image}
							alt=""
							style="
								position:absolute;
								left:{Number(circle2ImagePanX) || 50}%;
								top:{Number(circle2ImagePanY) || 50}%;
								width:100%;
								height:100%;
								object-fit:cover;
								transform:translate(-50%,-50%) scale({Number(circle2ImageZoom) || 1});
								will-change: transform;
								pointer-events: none;
								user-select:none;
							"
						/>
					</div>
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
				{@const showCircle2Tools = hoveringCircle2 || dragging2 || resizingCircle2 || circle2PanningImage}

				{#if showCircle2Tools}
					<!-- Hover toolbar — match primary circle controls -->
					<div
						style="
							position: absolute;
							top: -64px;
							left: 50%;
							transform: translateX(-50%);
							display: flex;
							gap: 10px;
							padding: 8px;
							border-radius: 999px;
							background: rgba(0,0,0,0.78);
							border: 2px solid rgba(255,255,255,0.18);
							backdrop-filter: blur(10px);
							pointer-events: auto;
						"
						onmouseenter={circle2HoverEnter}
						onmouseleave={circle2HoverLeave}
						role="presentation"
					>
						<button
							onpointerdown={(e) => { e.stopPropagation(); e.preventDefault(); }}
							onclick={() => onCircle2AIClick?.()}
							style="width: 52px; height: 52px; border-radius: 999px; border: 0; background: rgba(255,255,255,0.06); color: rgba(255,255,255,0.9); cursor: pointer; touch-action: none; font-size: 16px;"
							title="Generate with AI"
							aria-label="Generate with AI"
						>AI</button>

						<button
							onpointerdown={(e) => { e.stopPropagation(); e.preventDefault(); }}
							onclick={openCircle2Picker}
							style="width: 52px; height: 52px; border-radius: 999px; border: 0; background: rgba(255,255,255,0.06); color: rgba(255,255,255,0.9); cursor: pointer; touch-action: none; font-size: 22px;"
							title="Edit circle image"
							aria-label="Edit circle image"
						>✎</button>

						<div
							style="display:flex;align-items:center;gap:8px;padding:0 10px;height:52px;border-radius:999px;border:0;background:rgba(255,255,255,0.06);color:rgba(255,255,255,0.9);"
							title="Border thickness"
							aria-label="Border thickness"
							role="group"
						>
							<button
								type="button"
								onpointerdown={(e) => { e.stopPropagation(); e.preventDefault(); }}
								onclick={() => (circle2BorderWidth = Math.max(0, Math.round((circle2BorderWidth ?? 8) - 1)))}
								style="width:28px;height:28px;border-radius:999px;border:0;background:rgba(0,0,0,0.28);color:rgba(255,255,255,0.95);cursor:pointer;line-height:1;"
								title="Thinner border"
								aria-label="Thinner border"
							>−</button>
							<span style="min-width:22px;text-align:center;font-size:12px;font-weight:700;opacity:0.9;">{Math.round(circle2BorderWidth ?? 8)}</span>
							<button
								type="button"
								onpointerdown={(e) => { e.stopPropagation(); e.preventDefault(); }}
								onclick={() => (circle2BorderWidth = Math.min(40, Math.round((circle2BorderWidth ?? 8) + 1)))}
								style="width:28px;height:28px;border-radius:999px;border:0;background:rgba(0,0,0,0.28);color:rgba(255,255,255,0.95);cursor:pointer;line-height:1;"
								title="Thicker border"
								aria-label="Thicker border"
							>+</button>
						</div>

						<button
							onpointerdown={(e) => { e.stopPropagation(); e.preventDefault(); }}
							onclick={openCircle2BorderPicker}
							style="width: 52px; height: 52px; border-radius: 999px; border: 0; background: rgba(255,255,255,0.06); display:flex; align-items:center; justify-content:center; cursor: pointer; touch-action: none;"
							title="Change border color"
							aria-label="Change border color"
						>
							<span style="width:22px;height:22px;border-radius:7px;border:2px solid rgba(255,255,255,0.35);background:{circle2BorderColor};display:block;"></span>
						</button>

						<button
							onpointerdown={(e) => { e.stopPropagation(); e.preventDefault(); }}
							onclick={removeCircle2}
							style="width: 52px; height: 52px; border-radius: 999px; border: 0; background: rgba(255,255,255,0.06); color: rgba(255,255,255,0.9); cursor: pointer; touch-action: none; display:flex; align-items:center; justify-content:center;"
							title="Remove circle"
							aria-label="Remove circle"
						><Trash2 size={22} /></button>

						<button
							onpointerdown={(e) => { e.stopPropagation(); e.preventDefault(); }}
							onclick={() => { circle2ImageZoom = 1; circle2ImagePanX = 50; circle2ImagePanY = 50; }}
							style="width: 52px; height: 52px; border-radius: 999px; border: 0; background: rgba(255,255,255,0.06); color: rgba(255,255,255,0.9); cursor: pointer; touch-action: none; display:flex; align-items:center; justify-content:center; font-size: 12px; font-weight: 800;"
							title="Reset image zoom/pan"
							aria-label="Reset image zoom/pan"
						>↺</button>

						<div
							style="display:flex;flex-direction:column;gap:4px;padding:4px;border-radius:999px;background:rgba(255,255,255,0.06);"
							role="group"
							aria-label="Photo zoom inside circle"
						>
							<button
								type="button"
								onpointerdown={(e) => { e.stopPropagation(); e.preventDefault(); }}
								onclick={() => bumpCircle2ImageZoom(0.12)}
								disabled={(Number(circle2ImageZoom) || 1) >= 4.99}
								style="width:40px;height:40px;border-radius:999px;border:0;background:rgba(0,0,0,0.35);color:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center;opacity:{(Number(circle2ImageZoom) || 1) >= 4.99 ? 0.35 : 1};"
								title="Zoom photo in (up to 5×)"
								aria-label="Zoom photo in"
							><Plus size={18} /></button>
							<button
								type="button"
								onpointerdown={(e) => { e.stopPropagation(); e.preventDefault(); }}
								onclick={() => bumpCircle2ImageZoom(-0.12)}
								disabled={(Number(circle2ImageZoom) || 1) <= 1.01}
								style="width:40px;height:40px;border-radius:999px;border:0;background:rgba(0,0,0,0.35);color:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center;opacity:{(Number(circle2ImageZoom) || 1) <= 1.01 ? 0.35 : 1};"
								title="Zoom photo out"
								aria-label="Zoom photo out"
							><Minus size={18} /></button>
						</div>

						<div
							style="display:flex;flex-direction:column;gap:4px;padding:4px;border-radius:999px;background:rgba(255,255,255,0.06);"
							role="group"
							aria-label="Circle size"
						>
							<button
								type="button"
								onpointerdown={(e) => { e.stopPropagation(); e.preventDefault(); }}
								onclick={() => bumpCircle2Diameter(36)}
								disabled={Number(circle2Size) >= 720}
								style="width:40px;height:40px;border-radius:999px;border:0;background:rgba(0,0,0,0.35);color:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center;opacity:{Number(circle2Size) >= 720 ? 0.35 : 1};"
								title="Expand circle"
								aria-label="Expand circle"
							><Maximize2 size={16} /></button>
							<button
								type="button"
								onpointerdown={(e) => { e.stopPropagation(); e.preventDefault(); }}
								onclick={() => bumpCircle2Diameter(-36)}
								disabled={Number(circle2Size) <= 96}
								style="width:40px;height:40px;border-radius:999px;border:0;background:rgba(0,0,0,0.35);color:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center;opacity:{Number(circle2Size) <= 96 ? 0.35 : 1};"
								title="Shrink circle"
								aria-label="Shrink circle"
							><Minimize2 size={16} /></button>
						</div>
					</div>
				{/if}

				{#if showCircle2Tools}
					<!-- Resize handle (bottom-right) -->
					<div
						style="
							position: absolute;
							bottom: -14px; right: -14px;
							width: 52px; height: 52px;
							border-radius: 999px;
							background: rgba(0,0,0,0.85);
							border: 2px solid rgba(255,255,255,0.30);
							display: flex; align-items: center; justify-content: center;
							color: rgba(255,255,255,0.90);
							cursor: nwse-resize;
							touch-action: none;
						"
						onmouseenter={circle2HoverEnter}
						onmouseleave={circle2HoverLeave}
						onpointerdown={circle2ResizeDown}
						onpointermove={circle2ResizeMove}
						onpointerup={circle2ResizeUp}
						onpointercancel={circle2ResizeUp}
						role="presentation"
						title="Resize circle"
						aria-label="Resize circle"
					><MoveDiagonal2 size={22} /></div>
				{/if}
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
			<!-- Above circles (z=31/32), below shadow shelf (z=36) and text (z=40). -->
			<div style="position: absolute; inset: 0; overflow: hidden; z-index: 34; pointer-events: none;">
				{#if bgFitMode === 'contain'}
					<div
						style="
							position: absolute;
							inset: 0;
							display: flex;
							align-items: center;
							justify-content: center;
						"
					>
						<div
							style="
								width: 100%;
								height: 100%;
								transform: scale({bgContainMagnifyPct / 100});
								transform-origin: center center;
							"
						>
							<img
								src={subjectCutout}
								alt=""
								style="
									width: 100%;
									height: 100%;
									display: block;
									object-fit: contain;
									object-position: {bgOffsetX}% {bgOffsetY}%;
								"
							/>
						</div>
					</div>
				{:else if bgIsShrunk}
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
							top: {bgPanTopPct}%; left: {bgPanLeftPct}%;
							width: {bgRenderSize}%; height: {bgRenderSize}%;
							object-fit: cover;
							object-position: center;
							transform: translate3d(0,0,0) scale({BG_COVER_RASTER_PAD});
							transform-origin: center center;
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
						showToolbar={false}
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
