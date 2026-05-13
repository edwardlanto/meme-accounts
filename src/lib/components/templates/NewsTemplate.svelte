<script lang="ts">
	import { onDestroy, tick } from 'svelte';
	import { parseHighlightMarkup, segmentText, plainRangeFromSelection, restorePlainSelection } from '$lib/highlight';
	import { removeBackground } from '$lib/backgroundRemoval';
	import type { Overlay, TextOverlay, TextStyle, TextElementKind } from '$lib/types';
	import { loadGoogleFont } from '$lib/fonts';
	import HighlightEditor from '$lib/components/HighlightEditor.svelte';
	import ImageStickerOverlayBox from '$lib/components/ImageStickerOverlayBox.svelte';
	import ClassicLoader from '$lib/components/ClassicLoader.svelte';
	import { Popover, PopoverContent, PopoverTrigger } from '$lib/components/ui/popover';
	import { Button } from '$lib/components/ui/button';
	import {
		Maximize2,
		Minimize2,
		Minus,
		Plus,
		Trash2,
		MoveDiagonal2,
		Pencil,
		ZoomIn,
		ZoomOut,
		RotateCcw,
		Eraser,
	} from 'lucide-svelte';

	interface Props {
		// Canvas size (template pixels). Default is IG portrait 4:5.
		w?: number;
		h?: number;
		backgroundImage?: string;
		backgroundVideo?: string; // blob URL or data URL for video background
		/** When there is no photo/video, fill the frame with this solid (hex). Empty = default gradient. */
		solidBackgroundColor?: string;
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
		/** Optional logo image for the source label (data URL or https URL). */
		sourceLogoSrc?: string;
		/** Whether to render the source as text or logo. */
		sourceLabelMode?: 'text' | 'logo';
		/** Max width in px for the source logo (aspect ratio preserved). Default 260. */
		sourceLogoWidth?: number;
		highlightColor?: string;
		textColor?: string;
		scale?: number;
		exportRef?: HTMLElement | null;
		// Canvas editing
		interactive?: boolean;
		circleX?: number;     // left position in template px (bindable)
		circleY?: number;     // top position in template px (bindable)
		circleSize?: number;  // diameter in template px (bindable)
		bgOffsetX?: number;   // horizontal focal % (≈0–100 typical; wider range supported for pan)
		bgOffsetY?: number;   // vertical focal % (same)
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
		/** When set (Studio), headline keystrokes update this instead of spamming `onTextChange`; parent commits `slides` on blur/escape only. */
		onHeadlineLive?: (t: string) => void;
		onHeadlineEditStart?: () => void;
		onHeadlineEditEnd?: () => void;
		/** Fired when the user selects a range of PLAIN text inside the headline.
		 *  Offsets are into the visible (unmarked-up) text, suitable for applyHighlight(). */
		onHeadlineRangeSelect?: (plainStart: number, plainEnd: number) => void;
		/** Parent bumps after applying `[[...]]` markup so we can re-select the same plain range. */
		headlineSelectionRestoreNonce?: number;
		headlineSelectionRestoreRange?: { start: number; end: number } | null;
	}

	let {
		w = 1080,
		h = 1350,
		backgroundImage = '',
		backgroundVideo = '',
		solidBackgroundColor = '',
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
		sourceLogoSrc = '',
		sourceLabelMode = 'text',
		sourceLogoWidth = 260,
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
		bgOffsetX  = $bindable(0),
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
		onHeadlineLive,
		onHeadlineEditStart,
		onHeadlineEditEnd,
		onHeadlineRangeSelect,
		headlineSelectionRestoreNonce = 0,
		headlineSelectionRestoreRange = null,
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

	function startTextOverlayEdit(e: MouseEvent, id: string) {
		if (!interactive) return;
		e.stopPropagation();
		editingTextOverlayId = id;
	}

	function finishTextOverlayEdit(id: string) {
		if (editingTextOverlayId !== id) return;
		editingTextOverlayId = null;
	}

	// Preload display + override fonts (Bebas Neue = default news headline).
	$effect(() => {
		void loadGoogleFont('Bebas Neue', 400);
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
		if (s.fontFamily) lines.push(`font-family: '${s.fontFamily}', var(--font-sans), system-ui, -apple-system, sans-serif;`);
		else lines.push(`font-family: var(--font-sans), system-ui, -apple-system, sans-serif;`);
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
	let lastHeadlineRestoreNonce = $state(-1);

	/** After parent applies highlight markup, re-show the blue selection so editing feels continuous. */
	$effect(() => {
		const n = headlineSelectionRestoreNonce;
		const range = headlineSelectionRestoreRange;
		if (!interactive || editing || !headlineEl || n <= 0 || !range || range.start >= range.end) return;
		if (n === lastHeadlineRestoreNonce) return;
		lastHeadlineRestoreNonce = n;
		const { start, end } = range;
		void tick().then(() => {
			if (headlineEl) restorePlainSelection(headlineEl, start, end);
		});
	});

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
	/** Minimum cover scale (% of frame). Must stay ≥ `100 +` usable pan range or pan math exposes gutters. */
	const BG_COVER_MIN_BLEED = 115;
	/** Extra scale on cover media so raster export (html-to-image) doesn’t leave 1px side gutters */
	const BG_COVER_RASTER_PAD = 1.03;
	const bgRenderSize = $derived(
		bgFitMode === 'contain' ? bgZoomPct : Math.max(bgZoomPct, BG_COVER_MIN_BLEED),
	);
	const bgRenderOverflowPct = $derived(Math.max(0.01, bgRenderSize - 100)); // strict cover overscan
	/** Pan travel (0–100 offsets) is limited to actual overscan so the layer always covers the clip. */
	const bgPanRangePct = $derived(bgRenderOverflowPct);
	// Natural panning: slide an oversized layer inside the frame.
	//  - bgOffsetX/Y = 0  → show left/top edge
	//  - bgOffsetX/Y = 100→ show right/bottom edge
	const bgPanLeftPct = $derived(-(bgPanRangePct * (bgOffsetX / 100)));
	const bgPanTopPct  = $derived(-(bgPanRangePct * (bgOffsetY / 100)));
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
	/** Local mirror while editing; avoids pushing every keystroke to parent when `onHeadlineLive` is used. */
	let headlineDraft = $state('');
	let editableEl = $state<HTMLElement | null>(null);
	let hoveringText = $state(false);

	function commitHeadlineToParent() {
		if (onHeadlineLive) {
			onTextChange?.(headlineDraft);
			// Clear the Studio live buffer after paint so `slides` + static headline mount
			// settle first — avoids a visible flash when swapping editor → read-only markup.
			queueMicrotask(() => onHeadlineEditEnd?.());
		}
	}

	function pushHeadlineChange(v: string) {
		headlineDraft = v;
		if (onHeadlineLive) onHeadlineLive(v);
		else onTextChange?.(v);
	}

	$effect(() => {
		if (text !== headlineDraft) headlineDraft = text;
	});

	// ── Text panel drag (HTML) ─────────────────────────────────────────────
	const TEXT_PANEL_H = 520; // must match visual design; used for clamp range
	let textDragging = $state(false);
	let textArmed = $state(false);
	let textPointerId = 0;
	let textCaptureEl: HTMLElement | null = null;
	let textStartY = 0;
	let textStartX = 0;
	let textStartOffset = 0;
	let textMoved = false;
	/** Pointer down began on headline/source (selectable) — avoid treating small moves as panel drag. */
	let textGestureBeganOnSelectable = false;

	function startEdit(e: MouseEvent) {
		if (!interactive) return;
		e.stopPropagation();
		headlineDraft = text;
		onHeadlineEditStart?.();
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

	function exitHeadlineEditMode() {
		commitHeadlineToParent();
		editing = false;
	}

	/** Blur away from the contenteditable — unless focus moved to the floating toolbar / popovers. */
	function finishHeadlineEdit(e?: FocusEvent) {
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
				commitHeadlineToParent();
				editing = false;
			});
		});
	}

	function onEditKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') exitHeadlineEditMode();
		// Do not intercept Enter / Shift+Enter — multiline editing relies on them (serialized as `\n`).
	}

	function textPointerDown(e: PointerEvent) {
		if (!interactive) return;
		if (editing) return;
		const target = e.target as HTMLElement;
		const startedOnSelectable = !!target.closest('[data-text-selectable]');
		textGestureBeganOnSelectable = startedOnSelectable;
		textArmed = true;
		textDragging = !startedOnSelectable; // if on text, only start drag after threshold move
		textMoved = false;
		textStartY = e.clientY;
		textStartX = e.clientX;
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
		const dx = (e.clientX - textStartX) / scale;
		if (!textDragging) {
			// When the gesture began on headline/source, require a clear vertical panel-drag
			// (not a slight wobble while selecting text horizontally).
			if (textGestureBeganOnSelectable) {
				if (Math.abs(dx) + Math.abs(dy) <= 10) return;
				if (Math.abs(dy) < 40) return;
				if (Math.abs(dy) < Math.abs(dx) * 1.15) return;
			} else if (Math.abs(dy) <= 4) {
				return;
			}
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
		textGestureBeganOnSelectable = false;
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
		const root = headlineEl;
		if (!root) return null;
		return plainRangeFromSelection(root);
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
	/** Drives circle chrome + shadcn popover; bits-ui trigger uses openOnHover. */
	let circleToolbarPopoverOpen = $state(false);
	let lastMx = 0;
	let lastMy = 0;
	let circleStartSize = 0;
	let circleResizeStartMx = 0;
	let circleResizeStartMy = 0;
	let circleFileEl = $state<HTMLInputElement | null>(null);
	let circleBorderPickerEl = $state<HTMLInputElement | null>(null);
	let circleRemovingBg = $state(false);
	let circle2RemovingBg = $state(false);

	async function runCircleBackgroundRemoval(which: 1 | 2) {
		const src = which === 1 ? circleImage : circle2Image;
		if (!String(src ?? '').trim()) return;
		if (which === 1 && circleRemovingBg) return;
		if (which === 2 && circle2RemovingBg) return;
		if (which === 1) circleRemovingBg = true;
		else circle2RemovingBg = true;
		try {
			const out = await removeBackground(src as string);
			if (which === 1) onCircleImageChange?.(out);
			else onCircle2ImageChange?.(out);
		} catch (e: unknown) {
			const msg = e instanceof Error ? e.message : 'Background removal failed';
			alert(msg);
		} finally {
			if (which === 1) circleRemovingBg = false;
			else circle2RemovingBg = false;
		}
	}

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
	let circle2ToolbarPopoverOpen = $state(false);
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

	// ── Background: pan only after pointerdown + move (slop); hover moves ignored
	let bgDragging = $state(false);
	let bgPanPressed = false;
	let bgLastMx = 0;
	let bgLastMy = 0;
	let bgPanStartX = 0;
	let bgPanStartY = 0;
	const BG_SLOP_PX = 6;
	/** Pointer drag sensitivity — higher = move background farther per pixel */
	const BG_PAN_DRAG_SENS = 13;
	/** Allow pan “past” the frame edges (object-position / translate headroom). */
	const BG_OFFSET_MIN = -55;
	const BG_OFFSET_MAX = 155;
	/** Alt+drag anywhere on the canvas (capture) to pan — avoids the z-index-2 dead zone under text/circle. */
	let bgAltPanActive = $state(false);

	const bgPanCursor = $derived(bgDragging || bgAltPanActive ? 'grabbing' : 'default');

	function clampBgOffset(v: number) {
		return Math.max(BG_OFFSET_MIN, Math.min(BG_OFFSET_MAX, v));
	}

	function applyBgPanPixels(dx: number, dy: number) {
		// Convert pixel drag → percent, then scale by how much pan room the current zoom actually has.
		// This makes panning feel consistent (more room when zoomed in, less when barely overscanned),
		// and prevents the "I can't drag further right" early clamp feeling.
		const panRoom = Math.max(16, Number(bgPanRangePct) || 0); // percent of extra image beyond frame
		const xPerPx = (100 / Math.max(1, W)) * (100 / panRoom) * BG_PAN_DRAG_SENS;
		const yPerPx = (100 / Math.max(1, H)) * (100 / panRoom) * BG_PAN_DRAG_SENS;
		bgOffsetX = clampBgOffset(bgOffsetX - dx * xPerPx);
		bgOffsetY = clampBgOffset(bgOffsetY - dy * yPerPx);
	}

	function removeBgAltPanListeners() {
		if (typeof window === 'undefined') return;
		window.removeEventListener('pointermove', onBgAltPanMove);
		window.removeEventListener('pointerup', onBgAltPanUp);
		window.removeEventListener('pointercancel', onBgAltPanUp);
	}

	function onBgAltPanMove(e: PointerEvent) {
		if (!bgAltPanActive) return;
		const dx = (e.clientX - bgLastMx) / scale;
		const dy = (e.clientY - bgLastMy) / scale;
		bgLastMx = e.clientX;
		bgLastMy = e.clientY;
		applyBgPanPixels(dx, dy);
	}

	function onBgAltPanUp() {
		bgAltPanActive = false;
		removeBgAltPanListeners();
	}

	function bgAltPointerDownCapture(e: PointerEvent) {
		if (!interactive || !hasBg || e.button !== 0 || !e.altKey) return;
		if (typeof window === 'undefined') return;
		e.preventDefault();
		e.stopPropagation();
		bgAltPanActive = true;
		bgPanPressed = false;
		bgDragging = false;
		bgLastMx = e.clientX;
		bgLastMy = e.clientY;
		window.addEventListener('pointermove', onBgAltPanMove, { passive: true });
		window.addEventListener('pointerup', onBgAltPanUp);
		window.addEventListener('pointercancel', onBgAltPanUp);
	}

	function onCanvasWheel(e: WheelEvent) {
		if (!interactive || !hasBg || !e.altKey) return;
		e.preventDefault();
		// Exponential zoom feels more "natural" than linear steps.
		// Trackpads generate many small wheel events; keep a gentle factor.
		const factor = e.deltaY > 0 ? 0.94 : 1.06;
		if (bgFitMode === 'contain') {
			const cur = Number(bgContainMagnify) || 100;
			bgContainMagnify = Math.round(Math.max(50, Math.min(200, cur * factor)));
		} else {
			const cur = Number(bgZoom) || 100;
			bgZoom = Math.round(Math.max(30, Math.min(300, cur * factor)));
		}
	}

	onDestroy(() => {
		removeBgAltPanListeners();
	});

	/** Alt+wheel zoom needs a non-passive listener so `preventDefault` works. */
	$effect(() => {
		if (!interactive || !hasBg) return;
		const el = exportRef;
		if (!el) return;
		const fn = (e: WheelEvent) => onCanvasWheel(e);
		el.addEventListener('wheel', fn, { passive: false });
		return () => el.removeEventListener('wheel', fn);
	});

	function bgPointerDown(e: PointerEvent) {
		if (!interactive || e.button !== 0 || e.altKey) return;
		bgPanPressed = true;
		bgPanStartX = e.clientX;
		bgPanStartY = e.clientY;
		bgLastMx = e.clientX;
		bgLastMy = e.clientY;
		bgDragging = false;
		(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
	}

	function bgPointerMove(e: PointerEvent) {
		if (!interactive || !bgPanPressed) return;
		const dx0 = e.clientX - bgPanStartX;
		const dy0 = e.clientY - bgPanStartY;
		const dist2 = dx0 * dx0 + dy0 * dy0;

		if (!bgDragging) {
			if (dist2 <= BG_SLOP_PX * BG_SLOP_PX) return;
			bgDragging = true;
			bgLastMx = e.clientX;
			bgLastMy = e.clientY;
			return;
		}
		const dx = (e.clientX - bgLastMx) / scale;
		const dy = (e.clientY - bgLastMy) / scale;
		bgLastMx = e.clientX;
		bgLastMy = e.clientY;
		applyBgPanPixels(dx, dy);
	}

	function bgPointerUp(e: PointerEvent) {
		try {
			(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
		} catch {
			/* ignore */
		}
		bgPanPressed = false;
		bgDragging = false;
	}

	function bgPointerCancel(e: PointerEvent) {
		try {
			(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
		} catch {
			/* ignore */
		}
		bgPanPressed = false;
		bgDragging = false;
	}

	function bgLostPointerCapture() {
		bgPanPressed = false;
		bgDragging = false;
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
		onpointerdowncapture={bgAltPointerDownCapture}
		style="
			width: {W}px;
			height: {H}px;
			position: relative;
			overflow: hidden;
			background: {isLight ? '#ffffff' : '#0a0a0a'};
			transform: scale({scale});
			transform-origin: top left;
			font-family: 'Bebas Neue', Impact, 'Arial Black', sans-serif;
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
			{#if solidBackgroundColor?.trim()}
				<div
					style="position: absolute; inset: 0; background: {solidBackgroundColor.trim()};"
				></div>
			{:else}
				<div style="
					position: absolute; inset: 0;
					background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
				"></div>
			{/if}
		{/if}

		<!-- Background pan capture (sits above bg, below text z-10 and circle z-20) -->
		{#if interactive && hasBg}
			<div
				style="
					position: absolute; inset: 0; z-index: 2;
					cursor: {bgPanCursor};
					touch-action: none;
				"
				title="Drag empty canvas to pan · Alt+drag anywhere to pan · Alt+scroll to zoom"
				onpointerdown={bgPointerDown}
				onpointermove={bgPointerMove}
				onpointerup={bgPointerUp}
				onpointercancel={bgPointerCancel}
				onlostpointercapture={bgLostPointerCapture}
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

		<!-- ── Image overlays (stickers / logos) — hover popover like circle badge ─ -->
		{#each overlays as overlay (overlay.id)}
			{#if overlay.kind !== 'grid'}
				<ImageStickerOverlayBox
					{overlay}
					{overlays}
					w={W}
					h={H}
					{scale}
					{interactive}
					onOverlaysChange={onOverlaysChange}
				/>
			{/if}
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
							background: transparent;
							border: 1px solid rgba(255,255,255,0.22);
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
							background: transparent;
							border: 1px dashed rgba(255,255,255,0.28);
							color: {css.color ?? '#FFFFFF'};
							font-family: {css.fontFamily ? `'${css.fontFamily}', system-ui, -apple-system, sans-serif` : `'Satoshi', system-ui, -apple-system, sans-serif`};
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
			{#snippet newsCirclePopoverTrigger({ props }: { props: Record<string, unknown> })}
			<div
				{...props}
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
						{#if circleRemovingBg}
							<div
								style="
									position: absolute;
									inset: 0;
									border-radius: 50%;
									background: rgba(0,0,0,0.48);
									display: flex;
									align-items: center;
									justify-content: center;
									z-index: 3;
									pointer-events: none;
								"
								role="status"
								aria-label="Removing background"
							>
								<ClassicLoader size="lg" />
							</div>
						{/if}
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
				{@const showCircleTools = circleToolbarPopoverOpen || dragging || resizingCircle || circlePanningImage}

				{#if showCircleTools}
					<!-- Resize handle (bottom-right) -->
					<div
						style="
							position: absolute;
							bottom: -14px; right: -14px;
							width: 52px; height: 52px;
							border-radius: 999px;
							background: #fff;
							border: 2px solid rgba(255,255,255,0.30);
							display: flex; align-items: center; justify-content: center;
							color: rgba(0,0,0,0.90);
							cursor: nwse-resize;
							touch-action: none;
						"
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
			{/snippet}
			<Popover bind:open={circleToolbarPopoverOpen}>
				<PopoverTrigger
					openOnHover={!!interactive}
					openDelay={0}
					closeDelay={280}
					child={newsCirclePopoverTrigger}
				/>
				{#if interactive}
					<PopoverContent
						side="top"
						sideOffset={10}
						align="center"
						trapFocus={false}
						class="border-border bg-popover/95 text-foreground z-[60] !flex !w-max max-w-[calc(100vw-2rem)] !flex-row flex-nowrap items-center gap-1.5 overflow-x-auto rounded-full border p-2 shadow-lg ring-1 ring-border/40 backdrop-blur-md duration-100 data-[side=top]:slide-in-from-bottom-2 data-[state=closed]:animate-out data-[state=open]:animate-in data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 !gap-1.5 !p-2 [&_svg]:shrink-0 [&_svg]:text-foreground"
					>
						<Button variant="secondary" size="sm" class="h-11 min-w-11 shrink-0 rounded-full px-3 font-semibold" onclick={() => onCircleAIClick?.()} title="Generate with AI" aria-label="Generate with AI">AI</Button>
						<Button variant="ghost" size="icon" class="h-11 w-11 shrink-0 rounded-full" onclick={openCirclePicker} title="Edit circle image" aria-label="Edit circle image"><Pencil size={20} class="text-foreground" strokeWidth={2} /></Button>
						<Button
							variant="secondary"
							size="sm"
							class="h-11 shrink-0 rounded-full px-2.5 font-semibold"
							disabled={!circleImage || circleRemovingBg}
							onclick={() => void runCircleBackgroundRemoval(1)}
							title="Remove photo background (AI)"
							aria-label="Remove circle background"
						>
							{#if circleRemovingBg}
								<ClassicLoader size="sm" />
							{:else}
								<Eraser size={18} strokeWidth={2} />
							{/if}
							<span class="ml-1 hidden sm:inline">Remove BG</span>
						</Button>
						<div class="bg-muted/40 flex h-11 shrink-0 flex-row items-center gap-1 rounded-full px-2" role="group" aria-label="Border thickness in pixels" title="Border thickness">
							<Button variant="ghost" size="icon" class="h-8 w-8 shrink-0 rounded-full" type="button" onclick={() => (circleBorderWidth = Math.max(0, Math.round((circleBorderWidth ?? 8) - 1)))} title="Thinner border" aria-label="Thinner border"><Minus size={16} class="text-foreground" strokeWidth={2} /></Button>
							<span class="min-w-[1.5rem] text-center text-xs font-bold tabular-nums text-foreground">{Math.round(circleBorderWidth ?? 8)}</span>
							<Button variant="ghost" size="icon" class="h-8 w-8 shrink-0 rounded-full" type="button" onclick={() => (circleBorderWidth = Math.min(40, Math.round((circleBorderWidth ?? 8) + 1)))} title="Thicker border" aria-label="Thicker border"><Plus size={16} class="text-foreground" strokeWidth={2} /></Button>
						</div>
						<Button variant="ghost" size="icon" class="h-11 w-11 shrink-0 rounded-full" onclick={openCircleBorderPicker} title="Change border color" aria-label="Change border color">
							<span class="border-foreground/25 ring-foreground/15 box-border block h-[22px] w-[22px] rounded-md border-2 shadow-sm ring-1" style="background:{circleBorderColor}"></span>
						</Button>
						<Button variant="ghost" size="icon" class="text-destructive hover:text-destructive h-11 w-11 shrink-0 rounded-full" onclick={removeCircle} title="Remove circle" aria-label="Remove circle"><Trash2 size={20} class="text-destructive" strokeWidth={2} /></Button>
						<Button variant="ghost" size="icon" class="h-11 w-11 shrink-0 rounded-full" onclick={() => { circleImageZoom = 1; circleImagePanX = 50; circleImagePanY = 50; }} title="Reset image zoom/pan" aria-label="Reset image zoom/pan"><RotateCcw size={18} class="text-foreground" strokeWidth={2} /></Button>
						<div class="bg-muted/40 flex h-11 shrink-0 flex-row items-center gap-0.5 rounded-full px-1" role="group" aria-label="Circle size">
							<Button variant="ghost" size="icon" class="h-9 w-9 shrink-0 rounded-full" type="button" onclick={() => bumpCircleDiameter(36)} disabled={Number(circleSize) >= 720} title="Expand circle" aria-label="Expand circle"><Maximize2 size={16} class="text-foreground" strokeWidth={2} /></Button>
							<Button variant="ghost" size="icon" class="h-9 w-9 shrink-0 rounded-full" type="button" onclick={() => bumpCircleDiameter(-36)} disabled={Number(circleSize) <= 96} title="Shrink circle" aria-label="Shrink circle"><Minimize2 size={16} class="text-foreground" strokeWidth={2} /></Button>
						</div>
						<div class="bg-muted/40 flex h-11 shrink-0 flex-row items-center gap-0.5 rounded-full px-1" role="group" aria-label="Photo zoom inside circle">
							<Button variant="ghost" size="icon" class="h-9 w-9 shrink-0 rounded-full" type="button" onclick={() => bumpCircleImageZoom(0.12)} disabled={(Number(circleImageZoom) || 1) >= 4.99} title="Zoom photo in (up to 5×)" aria-label="Zoom photo in"><ZoomIn size={16} class="text-foreground" strokeWidth={2} /></Button>
							<Button variant="ghost" size="icon" class="h-9 w-9 shrink-0 rounded-full" type="button" onclick={() => bumpCircleImageZoom(-0.12)} disabled={(Number(circleImageZoom) || 1) <= 1.01} title="Zoom photo out" aria-label="Zoom photo out"><ZoomOut size={16} class="text-foreground" strokeWidth={2} /></Button>
						</div>
					</PopoverContent>
				{/if}
			</Popover>
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
			{#snippet newsCircle2PopoverTrigger({ props }: { props: Record<string, unknown> })}
			<div
				{...props}
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
						{#if circle2RemovingBg}
							<div
								style="
									position: absolute;
									inset: 0;
									border-radius: 50%;
									background: rgba(0,0,0,0.48);
									display: flex;
									align-items: center;
									justify-content: center;
									z-index: 3;
									pointer-events: none;
								"
								role="status"
								aria-label="Removing background"
							>
								<ClassicLoader size="lg" />
							</div>
						{/if}
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
				{@const showCircle2Tools = circle2ToolbarPopoverOpen || dragging2 || resizingCircle2 || circle2PanningImage}

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
			{/snippet}
			<Popover bind:open={circle2ToolbarPopoverOpen}>
				<PopoverTrigger
					openOnHover={!!interactive}
					openDelay={0}
					closeDelay={280}
					child={newsCircle2PopoverTrigger}
				/>
				{#if interactive}
					<PopoverContent
						side="top"
						sideOffset={10}
						align="center"
						trapFocus={false}
						class="border-border bg-popover/95 text-foreground z-[60] !flex !w-max max-w-[calc(100vw-2rem)] !flex-row flex-nowrap items-center gap-1.5 overflow-x-auto rounded-full border p-2 shadow-lg ring-1 ring-border/40 backdrop-blur-md duration-100 data-[side=top]:slide-in-from-bottom-2 data-[state=closed]:animate-out data-[state=open]:animate-in data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 !gap-1.5 !p-2 [&_svg]:shrink-0 [&_svg]:text-foreground"
					>
						<Button variant="secondary" size="sm" class="h-11 min-w-11 shrink-0 rounded-full px-3 font-semibold" onclick={() => onCircle2AIClick?.()} title="Generate with AI" aria-label="Generate with AI">AI</Button>
						<Button variant="ghost" size="icon" class="h-11 w-11 shrink-0 rounded-full" onclick={openCircle2Picker} title="Edit circle image" aria-label="Edit circle image"><Pencil size={20} class="text-foreground" strokeWidth={2} /></Button>
						<Button
							variant="secondary"
							size="sm"
							class="h-11 shrink-0 rounded-full px-2.5 font-semibold"
							disabled={!circle2Image || circle2RemovingBg}
							onclick={() => void runCircleBackgroundRemoval(2)}
							title="Remove photo background (AI)"
							aria-label="Remove circle 2 background"
						>
							{#if circle2RemovingBg}
								<ClassicLoader size="sm" />
							{:else}
								<Eraser size={18} strokeWidth={2} />
							{/if}
							<span class="ml-1 hidden sm:inline">Remove BG</span>
						</Button>
						<div class="bg-muted/40 flex h-11 shrink-0 flex-row items-center gap-1 rounded-full px-2" role="group" aria-label="Border thickness in pixels" title="Border thickness">
							<Button variant="ghost" size="icon" class="h-8 w-8 shrink-0 rounded-full" type="button" onclick={() => (circle2BorderWidth = Math.max(0, Math.round((circle2BorderWidth ?? 8) - 1)))} title="Thinner border" aria-label="Thinner border"><Minus size={16} class="text-foreground" strokeWidth={2} /></Button>
							<span class="min-w-[1.5rem] text-center text-xs font-bold tabular-nums text-foreground">{Math.round(circle2BorderWidth ?? 8)}</span>
							<Button variant="ghost" size="icon" class="h-8 w-8 shrink-0 rounded-full" type="button" onclick={() => (circle2BorderWidth = Math.min(40, Math.round((circle2BorderWidth ?? 8) + 1)))} title="Thicker border" aria-label="Thicker border"><Plus size={16} class="text-foreground" strokeWidth={2} /></Button>
						</div>
						<Button variant="ghost" size="icon" class="h-11 w-11 shrink-0 rounded-full" onclick={openCircle2BorderPicker} title="Change border color" aria-label="Change border color">
							<span class="border-foreground/25 ring-foreground/15 box-border block h-[22px] w-[22px] rounded-md border-2 shadow-sm ring-1" style="background:{circle2BorderColor}"></span>
						</Button>
						<Button variant="ghost" size="icon" class="text-destructive hover:text-destructive h-11 w-11 shrink-0 rounded-full" onclick={removeCircle2} title="Remove circle" aria-label="Remove circle"><Trash2 size={20} class="text-destructive" strokeWidth={2} /></Button>
						<Button variant="ghost" size="icon" class="h-11 w-11 shrink-0 rounded-full" onclick={() => { circle2ImageZoom = 1; circle2ImagePanX = 50; circle2ImagePanY = 50; }} title="Reset image zoom/pan" aria-label="Reset image zoom/pan"><RotateCcw size={18} class="text-foreground" strokeWidth={2} /></Button>
						<div class="bg-muted/40 flex h-11 shrink-0 flex-row items-center gap-0.5 rounded-full px-1" role="group" aria-label="Circle size">
							<Button variant="ghost" size="icon" class="h-9 w-9 shrink-0 rounded-full" type="button" onclick={() => bumpCircle2Diameter(36)} disabled={Number(circle2Size) >= 720} title="Expand circle" aria-label="Expand circle"><Maximize2 size={16} class="text-foreground" strokeWidth={2} /></Button>
							<Button variant="ghost" size="icon" class="h-9 w-9 shrink-0 rounded-full" type="button" onclick={() => bumpCircle2Diameter(-36)} disabled={Number(circle2Size) <= 96} title="Shrink circle" aria-label="Shrink circle"><Minimize2 size={16} class="text-foreground" strokeWidth={2} /></Button>
						</div>
						<div class="bg-muted/40 flex h-11 shrink-0 flex-row items-center gap-0.5 rounded-full px-1" role="group" aria-label="Photo zoom inside circle">
							<Button variant="ghost" size="icon" class="h-9 w-9 shrink-0 rounded-full" type="button" onclick={() => bumpCircle2ImageZoom(0.12)} disabled={(Number(circle2ImageZoom) || 1) >= 4.99} title="Zoom photo in (up to 5×)" aria-label="Zoom photo in"><ZoomIn size={16} class="text-foreground" strokeWidth={2} /></Button>
							<Button variant="ghost" size="icon" class="h-9 w-9 shrink-0 rounded-full" type="button" onclick={() => bumpCircle2ImageZoom(-0.12)} disabled={(Number(circle2ImageZoom) || 1) <= 1.01} title="Zoom photo out" aria-label="Zoom photo out"><ZoomOut size={16} class="text-foreground" strokeWidth={2} /></Button>
						</div>
					</PopoverContent>
				{/if}
			</Popover>
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
		     circle @ 20, overlays @ 15) so words are never covered.
		     Full-frame clip + bottom-aligned inner so huge toolbar font sizes cannot
		     paint below the canvas (interactive preview + scaled studio).
		     pointer-events: none on this shell so the circle/background stay draggable;
		     only the inner content column re-enables hits. -->
		<div
			style="
				position: absolute;
				inset: 0;
				z-index: 40;
				overflow: hidden;
				display: flex;
				flex-direction: column;
				justify-content: flex-end;
				transform: translateY({textPanelOffsetY}px);
				pointer-events: none;
			"
		>
			<div
				style="
					position: relative;
					width: 100%;
					max-height: 100%;
					min-height: 0;
					flex: 0 1 auto;
					overflow-x: hidden;
					overflow-y: auto;
					overscroll-behavior: contain;
					padding: 48px 64px 72px;
					box-sizing: border-box;
					pointer-events: auto;
					{interactive && !editing ? 'cursor: grab;' : ''}
				"
				onpointerdown={textPointerDown}
				onpointermove={textPointerMove}
				onpointerup={textPointerUp}
				onpointercancel={textPointerUp}
				role={interactive ? 'group' : undefined}
				aria-label={interactive ? 'News headline area' : undefined}
				onmouseenter={() => (hoveringText = true)}
				onmouseleave={() => (hoveringText = false)}
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
					font-family: 'Satoshi', sans-serif;
					font-size: 20px;
					color: rgba(255,255,255,0.4);
					pointer-events: none;
					letter-spacing: 0;
				">✎ double-click to edit</div>
			{/if}

			<!-- Source label -->
			{#if (sourceLabelMode === 'logo' && sourceLogoSrc) || (sourceLabelMode === 'text' && source)}
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
							{interactive ? 'cursor: pointer; user-select: text !important; -webkit-user-select: text !important;' : ''}
							{selectedText === 'source' ? 'box-shadow: 0 0 0 2px rgba(139,92,246,0.6); border-radius: 2px;' : ''}
						"
					>
						{#if sourceLabelMode === 'logo' && sourceLogoSrc}
							<img
								src={sourceLogoSrc}
								alt=""
								draggable="false"
								style="
									display: block;
									max-width: {Math.max(40, sourceLogoWidth)}px;
									max-height: 52px;
									width: auto;
									height: auto;
									object-fit: contain;
									filter: drop-shadow(0 1px 0 rgba(0,0,0,0.18));
								"
							/>
						{:else if sourceLabelMode === 'text' && source}
							{#if sourceStyle.fontFamily}
								{source}
							{:else}
								<span style="font-style: italic;">{source.slice(0,1).toLowerCase()}</span>{source.slice(1)}
							{/if}
						{/if}
					</span>
					<div style="flex: 1; height: 2px; background: {sourceStyle.color ?? highlightColor}; opacity: 0.9;"></div>
				</div>
			{/if}

			<!--
			  Stack static headline + editor overlay so exiting edit only peels off the overlay.
			  The <p> stays mounted (hidden while editing) — avoids tearing down/rebuilding segment markup on blur.
			-->
			<div style="position: relative;">
				<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
				<p
					bind:this={headlineEl}
					data-text-selectable="headline"
					aria-hidden={interactive && editing ? true : undefined}
					ondblclick={onHeadlineDblClick}
					onpointerup={onHeadlineMouseUp}
					style="
						margin: 0; padding: 0;
						{headlineCss}
						text-transform: uppercase;
						word-break: break-word;
						white-space: pre-line;
						touch-action: pan-x;
						visibility: {interactive && editing ? 'hidden' : 'visible'};
						pointer-events: {interactive && editing ? 'none' : 'auto'};
						{selectedText === 'headline' ? 'box-shadow: 0 0 0 2px rgba(139,92,246,0.6); border-radius: 4px;' : ''}
						{interactive ? 'user-select: text !important; -webkit-user-select: text !important;' : ''}
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
							{:else if seg.markerBg}
								<span
									style="
										background: {seg.markerBg};
										color: {textColor};
										padding: 0.08em 0.16em;
										border-radius: 0.14em;
										box-decoration-break: clone;
										-webkit-box-decoration-break: clone;
									"
								>{seg.text}</span>
							{:else}
								<span style="color: {seg.color};">{seg.text}</span>
							{/if}
						{:else}
							{seg.text}
						{/if}
					{/each}
				</p>

				{#if editing && interactive}
					<!-- svelte-ignore a11y_no_static_element_interactions -->
					<div
						bind:this={editableEl}
						data-text-selectable="headline"
						onkeydown={onEditKeydown}
						onclick={(e) => e.stopPropagation()}
						onmousedown={(e) => e.stopPropagation()}
						style="
							position: absolute;
							inset: 0;
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
							value={headlineDraft}
							rows={4}
							showToolbar={false}
							defaultColor={highlightColor}
							onChange={pushHeadlineChange}
							onBlur={finishHeadlineEdit}
							onSelectionChange={(has, r) => {
								if (has && r) onHeadlineRangeSelect?.(r.start, r.end);
								else onHeadlineRangeSelect?.(-1, -1);
							}}
							ariaLabel="Headline editor"
						/>
					</div>
				{/if}
			</div>
			</div>
		</div>
	</div>
</div>
