<script lang="ts">
	import { onDestroy, tick } from 'svelte';
	import { parseHighlightMarkup, segmentText, plainRangeFromSelection, restorePlainSelection, type HighlightDefaults } from '$lib/highlight';
	import { removeBackground } from '$lib/backgroundRemoval';
	import type { Overlay, TextOverlay, TextStyle, TextElementKind } from '$lib/types';
	import { loadGoogleFont } from '$lib/fonts';
	import HighlightEditor from '$lib/components/HighlightEditor.svelte';
	import ImageStickerOverlayBox from '$lib/components/ImageStickerOverlayBox.svelte';
	import DraggableBlock from '$lib/components/DraggableBlock.svelte';
	import ClassicLoader from '$lib/components/ClassicLoader.svelte';
	import {
		CANVAS_TEXT_BOX_TRIM,
		CANVAS_TEXT_FOCUS_RING,
	} from '$lib/studio/canvas-text-chrome';
	import { appendTextBgCss, appendTextShadowCss, textPaddingCss, textShadowStyleAttr, TEXT_BG_CHIP_BOX_CSS } from '$lib/textStyleCss';
	import {
		CLIPPED_TEXT_SHADOW_WRAP_CSS,
		gradientTextFillCss,
		patternStyleForUrl,
		wrapClippedFillHtml,
	} from '$lib/components/textOverlayPattern';
	import {
		inkRingStyle,
		measureTightTextBox,
		type InkBox,
	} from '$lib/studio/canvas-text-ink';
	import { Popover, PopoverContent, PopoverTrigger } from '$lib/components/ui/popover';
	import { Button } from '$lib/components/ui/button';
	import CircleShadowPopover from '$lib/components/CircleShadowPopover.svelte';
	import CircleColorPopover from '$lib/components/CircleColorPopover.svelte';
	import {
		DEFAULT_CIRCLE_SHADOW,
		circleShadowCss,
		type CircleShadow,
	} from '$lib/studio/circle-shadow';
	import { buildBottomShadowGradient, normalizeBottomShadowCurve, type BottomShadowCurve } from '$lib/studio/bottom-shadow';
	import {
		isVideoFile,
		isVideoMediaUrl,
		objectUrlForVideoFile,
		playMediaVideo,
	} from '$lib/studio/media-url';
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
		X,
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
		/** Drop shadow on the primary circle badge. */
		circleShadow?: CircleShadow;
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
		/** Drop shadow on the second circle badge. */
		circle2Shadow?: CircleShadow;
		circle2X?: number;
		circle2Y?: number;
		circle2Size?: number;
		text: string;
		/** Optional supporting paragraph rendered under the headline. */
		subtext?: string;
		source?: string;
		/** Optional logo image for the source label (data URL or https URL). */
		sourceLogoSrc?: string;
		/** Whether to render the source as text or logo. */
		sourceLabelMode?: 'text' | 'logo';
		/** Hairlines, boxed outline, or no chrome around the source label. */
		sourceBorderKind?: 'none' | 'rules' | 'box';
		/** Hex for rules / box. Empty = follow source text / highlight color. */
		sourceBorderColor?: string;
		/** Max width in px for the source logo (aspect ratio preserved). Default 260. */
		sourceLogoWidth?: number;
		/** Replace / clear the News source logo image. */
		onSourceLogoChange?: (src: string) => void;
		/** Fired when the user resizes the source logo from the canvas tools. */
		onSourceLogoWidthChange?: (width: number) => void;
		/** Patch News source chip style (logo BG / padding / radius, or text chip). */
		onSourceStyleChange?: (patch: Partial<TextStyle>) => void;
		highlightColor?: string;
		/** Default look for bare `[[phrase]]` (solid / gradient / pattern). Falls back to `highlightColor`. */
		highlightDefaults?: HighlightDefaults;
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
		/** In `contain` mode: scale % (50–400). 100 = largest fit without crop; >100 zooms in / extends past frame. */
		bgContainMagnify?: number;
		textPanelOffsetY?: number; // bottom text panel offset (bindable, px)
		/** Height of the bottom shadow gradient as a % of canvas height (0–100). Default 92. */
		shadowHeight?: number;
		/** Opacity of the bottom shadow (0–1). Default 1. */
		shadowStrength?: number;
		/** Fade curve — `natural` is the smoothest editorial look. */
		shadowCurve?: BottomShadowCurve;
		/** Optional repeating grid texture overlay (tiled). */
		gridImage?: string;
		gridTile?: number; // px
		gridOpacity?: number; // 0..1
		overlays?: Overlay[];
		textOverlays?: TextOverlay[];
		resolveSrc?: (src: string) => string;
		/** Per-element style overrides (font, size, weight, color, etc.) */
		headlineStyle?: TextStyle;
		/** Supporting paragraph under the headline (independent from headline style). */
		subtextStyle?: TextStyle;
		sourceStyle?: TextStyle;
		/** Independent drag offsets for source vs headline (template px). */
		textOffsets?: Record<string, { x: number; y: number }>;
		onTextOffsetChange?: (kind: string, next: { x: number; y: number }) => void;
		/** Which text element is currently selected (shows dashed outline). */
		selectedText?: TextElementKind | null;
		onTextChange?: (t: string) => void;
		/** Supporting paragraph under the headline. */
		onSubtextChange?: (t: string) => void;
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
		/** Double-click empty canvas / background to open BG tools (replace, solid, AI). */
		onBackgroundDblClick?: (detail: { clientX: number; clientY: number }) => void;
		/** Text stack size vs canvas — parent can match the bottom shadow to the copy. */
		onTextStackLayout?: (info: { topPct: number; heightPct: number }) => void;
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
		circleBorderWidth = $bindable(0),
		circleShadow = $bindable<CircleShadow>({ ...DEFAULT_CIRCLE_SHADOW }),
		showCircle2 = false,
		circle2Image = '',
		allowCircle2 = true,
		circle2ImageZoom = $bindable(1),
		circle2ImagePanX = $bindable(50),
		circle2ImagePanY = $bindable(50),
		circle2BorderColor = $bindable('#FFFFFF'),
		circle2BorderWidth = $bindable(0),
		circle2Shadow = $bindable<CircleShadow>({ ...DEFAULT_CIRCLE_SHADOW }),
		text,
		subtext = '',
		source = '',
		sourceLogoSrc = '',
		sourceLabelMode = 'logo',
		sourceBorderKind = 'none',
		sourceBorderColor = '',
		sourceLogoWidth = 260,
		onSourceLogoChange,
		onSourceLogoWidthChange,
		onSourceStyleChange,
		highlightColor = '#F5A623',
		highlightDefaults,
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
		shadowHeight = $bindable(92),
		shadowStrength = $bindable(1),
		shadowCurve = $bindable<BottomShadowCurve>('news'),
		gridImage = '',
		gridTile = 80,
		gridOpacity = 0.25,
		overlays   = [],
		textOverlays = [],
		resolveSrc,
		headlineStyle = {},
		subtextStyle = {},
		sourceStyle = {},
		textOffsets = {},
		onTextOffsetChange,
		selectedText = null,
		onTextChange,
		onSubtextChange,
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
		onBackgroundDblClick,
		onTextStackLayout,
	}: Props = $props();

	const isLight = $derived(templateTheme === 'light');

	// ── Background video preview trim/seek ────────────────────────────────
	let bgVideoEl = $state<HTMLVideoElement | null>(null);
	let lastDuration = 0;

	function onBgVideoMeta(e: Event) {
		const el = e.currentTarget as HTMLVideoElement;
		bgVideoEl = el;
		const vw = el.videoWidth || 0;
		const vh = el.videoHeight || 0;
		// Some browsers report 0×0 until a later frame — fall back so handles still appear.
		rememberBgMediaSize(vw > 0 && vh > 0 ? vw : W, vh > 0 && vw > 0 ? vh : H);
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
		const src = backgroundVideo;
		if (!el || !src) return;
		const muted = !!videoMuted;
		const vol = Math.max(0, Math.min(1, Number(videoVolume)));
		el.muted = muted;
		el.loop = true;
		el.playsInline = true;
		el.volume = Number.isFinite(vol) ? vol : 0.8;
		playMediaVideo(el);
	});

	const circleSrcIsVideo = $derived(isVideoMediaUrl(String(circleImage ?? '')));
	const circle2SrcIsVideo = $derived(isVideoMediaUrl(String(circle2Image ?? '')));

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
		const family = headlineStyle.fontFamily || 'Bebas Neue';
		const weight = headlineStyle.fontWeight ?? 400;
		void loadGoogleFont(family, weight);
		if (sourceStyle.fontFamily) {
			void loadGoogleFont(sourceStyle.fontFamily, sourceStyle.fontWeight ?? 700);
		}
	});

	// Build the effective CSS properties for each text element.
	const headlineCss = $derived.by(() => {
		const s = headlineStyle;
		const lines: string[] = [];
		if (s.fontFamily) lines.push(`font-family: '${s.fontFamily}', 'Bebas Neue', Impact, sans-serif;`);
		else lines.push(`font-family: 'Bebas Neue', Impact, 'Arial Black', sans-serif;`);
		lines.push(`font-size: ${s.fontSize ?? fontSize}px;`);
		lines.push(`font-weight: ${s.fontWeight ?? 400};`);
		// Bebas Neue is single-weight — allow synthetic bold so toolbar weight changes are visible.
		if (!s.fontFamily || s.fontFamily === 'Bebas Neue') {
			lines.push('font-synthesis: weight;');
		}
		if (s.italic) lines.push('font-style: italic;');
		if (s.underline) lines.push('text-decoration: underline;');
		lines.push(`color: ${s.color ?? textColor};`);
		lines.push(`text-align: ${s.align ?? 'left'};`);
		lines.push(`letter-spacing: ${s.letterSpacing != null ? `${s.letterSpacing}em` : '3px'};`);
		// Tight leading + trim so selection/edit rings hug glyph caps (Bebas leaves large em padding).
		// Prefer author line-height when set; otherwise a compact default for display caps.
		const lh = s.lineHeight != null ? s.lineHeight : 0.82;
		lines.push(`line-height: ${lh};`);
		lines.push(CANVAS_TEXT_BOX_TRIM);
		appendTextShadowCss(lines, s);
		appendTextBgCss(lines, s);
		return lines.join(' ');
	});

	/** Design-space px for toolbar + `data-design-font-px` (not scaled preview CSS). */
	const effectiveSubtextFontSize = $derived.by(() => {
		if (typeof subtextStyle.fontSize === 'number' && Number.isFinite(subtextStyle.fontSize)) {
			return subtextStyle.fontSize;
		}
		const headlinePx =
			typeof headlineStyle.fontSize === 'number' && Number.isFinite(headlineStyle.fontSize)
				? headlineStyle.fontSize
				: fontSize;
		return Math.round(headlinePx * 0.3);
	});

	const subtextCss = $derived.by(() => {
		const s = subtextStyle;
		const lines: string[] = [];
		if (s.fontFamily) lines.push(`font-family: '${s.fontFamily}', var(--font-sans), system-ui, -apple-system, sans-serif;`);
		else lines.push(`font-family: var(--font-sans), system-ui, -apple-system, sans-serif;`);
		lines.push(`font-size: ${effectiveSubtextFontSize}px;`);
		lines.push(`font-weight: ${s.fontWeight ?? 500};`);
		if (s.italic) lines.push('font-style: italic;');
		if (s.underline) lines.push('text-decoration: underline;');
		lines.push(`color: ${s.color ?? textColor};`);
		lines.push(`text-align: ${s.align ?? headlineStyle.align ?? 'left'};`);
		lines.push(`letter-spacing: ${s.letterSpacing != null ? `${s.letterSpacing}em` : '0'};`);
		lines.push(`line-height: ${s.lineHeight ?? 1.4};`);
		lines.push(`opacity: ${s.color ? 1 : 0.86};`);
		lines.push(CANVAS_TEXT_BOX_TRIM);
		appendTextShadowCss(lines, s);
		appendTextBgCss(lines, s);
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
		lines.push(`text-align: ${s.align ?? 'right'};`);
		lines.push(`letter-spacing: ${s.letterSpacing != null ? `${s.letterSpacing}em` : '3px'};`);
		appendTextShadowCss(lines, s);
		/* Logo mode paints BG / pad / radius on the image chip — not this text span. */
		if (sourceLabelMode !== 'logo') appendTextBgCss(lines, s);
		return lines.join(' ');
	});

	const LOGO_PAD_DEFAULT = 6;
	const LOGO_PAD_MAX = 64;
	const LOGO_RADIUS_DEFAULT = 10;
	const LOGO_RADIUS_MAX = 80;

	const sourceLogoPad = $derived.by(() => {
		const raw = Number(sourceStyle?.padding);
		if (Number.isFinite(raw)) return Math.max(0, Math.min(LOGO_PAD_MAX, Math.round(raw)));
		const bg = String(sourceStyle?.bgColor ?? '').trim();
		return bg && bg !== 'transparent' && bg !== 'none' ? LOGO_PAD_DEFAULT : 0;
	});
	const sourceLogoRadius = $derived.by(() => {
		const raw = Number(sourceStyle?.borderRadius);
		if (Number.isFinite(raw)) return Math.max(0, Math.min(LOGO_RADIUS_MAX, Math.round(raw)));
		return LOGO_RADIUS_DEFAULT;
	});
	const sourceLogoBg = $derived.by(() => {
		const raw = String(sourceStyle?.bgColor ?? '').trim();
		if (!raw || raw === 'transparent' || raw === 'none') return '';
		return raw;
	});
	const sourceLogoChromeCss = $derived(
		[
			'position: relative;',
			'display: inline-flex;',
			'align-items: center;',
			'justify-content: center;',
			'box-sizing: border-box;',
			`padding: ${sourceLogoPad}px;`,
			`border-radius: ${sourceLogoRadius}px;`,
			sourceLogoBg
				? `background-color: ${sourceLogoBg}; background-image: none;`
				: 'background: transparent;',
		].join(' '),
	);

	function bumpSourceLogoPad(delta: number) {
		const next = Math.max(0, Math.min(LOGO_PAD_MAX, sourceLogoPad + delta));
		onSourceStyleChange?.({ padding: next });
	}
	function bumpSourceLogoRadius(delta: number) {
		const next = Math.max(0, Math.min(LOGO_RADIUS_MAX, sourceLogoRadius + delta));
		onSourceStyleChange?.({ borderRadius: next });
	}
	function setSourceLogoBg(hex: string | undefined) {
		onSourceStyleChange?.({ bgColor: hex });
	}

	let headlineEl = $state<HTMLElement | null>(null);
	let sourceEl = $state<HTMLElement | null>(null);
	let lastHeadlineRestoreNonce = $state(-1);

	const showSource = $derived(
		(sourceLabelMode === 'logo' && !!sourceLogoSrc) || (sourceLabelMode === 'text' && !!source),
	);

	const sourceRuleColor = $derived(
		String(sourceBorderColor ?? '').trim() || sourceStyle.color || highlightColor,
	);
	const sourceShowRules = $derived(sourceLabelMode === 'text' && sourceBorderKind === 'rules');
	const sourceShowBox = $derived(sourceBorderKind === 'box');

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

	/** Live range while the user is still dragging a word selection — enables the highlighter before mouseup. */
	$effect(() => {
		if (!interactive) return;
		const onSel = () => {
			if (editing || editingSubtext) return;
			const sel = window.getSelection();
			if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return;
			if (headlineEl?.contains(sel.anchorNode)) {
				const r = plainRangeFromSelection(headlineEl);
				if (r) onHeadlineRangeSelect?.(r.start, r.end);
			} else if (subtextEl?.contains(sel.anchorNode)) {
				const r = plainRangeFromSelection(subtextEl);
				if (r) onHeadlineRangeSelect?.(r.start, r.end);
			}
		};
		document.addEventListener('selectionchange', onSel);
		return () => document.removeEventListener('selectionchange', onSel);
	});

	function selectHeadline(e: MouseEvent) {
		if (!interactive) return;
		// If the user was dragging the panel, don't treat this as a "select text element" click.
		if (textMoved) return;
		e.stopPropagation();
		if (headlineEl) onTextSelect?.('headline', headlineEl);
	}

	function selectSource(e: Event) {
		if (!interactive) return;
		// Don't stop pointerdown — DraggableBlock needs it to drag / snap.
		if (e.type !== 'pointerdown') e.stopPropagation();
		const el =
			sourceEl ??
			(e.currentTarget instanceof HTMLElement ? e.currentTarget : null) ??
			(e.target instanceof HTMLElement ? e.target.closest<HTMLElement>('[data-news-block="source"]') : null);
		if (el) onTextSelect?.('source', el);
	}

	let sourceLogoFileEl = $state<HTMLInputElement | null>(null);
	let sourceLogoColorEl = $state<HTMLInputElement | null>(null);
	let sourceLogoToolbarOpen = $state(false);
	let sourceLogoRemovingBg = $state(false);

	function openSourceLogoPicker() {
		if (!interactive) return;
		sourceLogoToolbarOpen = false;
		sourceLogoFileEl?.click();
	}

	function onSourceLogoFile(e: Event) {
		const file = (e.target as HTMLInputElement).files?.[0];
		(e.target as HTMLInputElement).value = '';
		if (!file?.type.startsWith('image/')) return;
		const reader = new FileReader();
		reader.onload = () => onSourceLogoChange?.(String(reader.result ?? ''));
		reader.readAsDataURL(file);
	}

	function bumpSourceLogoWidth(delta: number) {
		const next = Math.round(Math.max(80, Math.min(400, (Number(sourceLogoWidth) || 260) + delta)));
		onSourceLogoWidthChange?.(next);
	}

	async function removeSourceLogoBg() {
		if (!interactive || sourceLogoRemovingBg) return;
		const src = String(resolveSrc?.(sourceLogoSrc) || sourceLogoSrc || '').trim();
		if (!src || src.startsWith('r2:')) {
			alert('Logo is still loading — try again in a moment');
			return;
		}
		sourceLogoRemovingBg = true;
		try {
			const out = await removeBackground(src);
			onSourceLogoChange?.(out);
		} catch (err: unknown) {
			alert(err instanceof Error ? err.message : 'Background removal failed');
		} finally {
			sourceLogoRemovingBg = false;
		}
	}

	function clearSourceLogo() {
		onSourceLogoChange?.('');
		sourceLogoToolbarOpen = false;
	}

	function onSourceLogoDblClick(e: MouseEvent) {
		if (!interactive || sourceLabelMode !== 'logo') return;
		e.preventDefault();
		e.stopPropagation();
		if (sourceEl) onTextSelect?.('source', sourceEl);
		openSourceLogoPicker();
	}

	// Whether there's any background media (image or video)
	const hasBg = $derived(!!(backgroundVideo || backgroundImage));

	// Clamped zoom % (30–300). Cover mode uses inset:0 + object-fit:cover so the
	// media always full-bleeds; zoom>100 scales up; object-position pans the crop.
	const bgZoomPct = $derived(Math.max(30, Math.min(300, Number(bgZoom) || 100)));
	/** Extra scale on cover media so raster export (html-to-image) doesn’t leave 1px side gutters */
	const BG_COVER_RASTER_PAD = 1.03;
	/** Cover paint scale: zoom-in (≥1) × raster pad. Never below full-bleed. */
	const bgCoverScale = $derived(Math.max(bgZoomPct / 100, 1) * BG_COVER_RASTER_PAD);
	/** Pan travel for drag math when zoomed (object-position still works at 100%). */
	const bgPanRangePct = $derived(Math.max(15, bgZoomPct - 100 + 15));
	// When shrinking below 100%, letterbox the media; X/Y pan within the frame
	// (50 = centered). Offset 0 was left-aligning and leaving a right gutter.
	const bgIsShrunk = $derived(bgZoomPct < 100);
	const bgShrunkLeftPct = $derived(bgIsShrunk ? bgOffsetX * (100 - bgZoomPct) / 100 : 0);
	const bgShrunkTopPct = $derived(bgIsShrunk ? bgOffsetY * (100 - bgZoomPct) / 100 : 0);

	/** Rendered image size at current bgContainMagnify (50–400%). */
	const bgContainMagnifyPct = $derived(
		Math.max(50, Math.min(400, Number(bgContainMagnify) || 100)),
	);

	// Bottom shadow gradient — height/strength/curve controllable.
	const shadowGradient = $derived(
		buildBottomShadowGradient(shadowHeight, shadowStrength, normalizeBottomShadowCurve(shadowCurve)),
	);

	const W = $derived(Math.max(320, Number(w) || 1080));
	const H = $derived(Math.max(320, Number(h) || 1350));

	let textStackEl = $state<HTMLDivElement | null>(null);
	let lastReportedStackKey = '';

	function reportTextStackLayout() {
		const canvas = exportRef;
		const stack = textStackEl;
		if (!canvas || !stack || !onTextStackLayout) return;
		const c = canvas.getBoundingClientRect();
		const s = stack.getBoundingClientRect();
		if (c.height < 8) return;
		const topPct = ((s.top - c.top) / c.height) * 100;
		const heightPct = (s.height / c.height) * 100;
		if (!Number.isFinite(topPct) || !Number.isFinite(heightPct)) return;
		const key = `${topPct.toFixed(1)}:${heightPct.toFixed(1)}`;
		if (key === lastReportedStackKey) return;
		lastReportedStackKey = key;
		onTextStackLayout({ topPct, heightPct });
	}

	$effect(() => {
		void text;
		void subtext;
		void source;
		void sourceLogoSrc;
		void sourceLabelMode;
		void showSource;
		void W;
		void H;
		void scale;
		const stack = textStackEl;
		if (!stack || typeof ResizeObserver === 'undefined') {
			queueMicrotask(reportTextStackLayout);
			return;
		}
		const ro = new ResizeObserver(() => reportTextStackLayout());
		ro.observe(stack);
		if (exportRef) ro.observe(exportRef);
		queueMicrotask(reportTextStackLayout);
		return () => ro.disconnect();
	});

	// Contain-mode pan: bgOffsetX/Y are reused as the focal point (50 = center).
	// Convert to canvas-pixel translate so dragging is 1:1 with the cursor.
	const containTranslateX = $derived((bgOffsetX - 50) / 100 * W);
	const containTranslateY = $derived((bgOffsetY - 50) / 100 * H);

	const highlightParseDefaults = $derived(
		highlightDefaults ?? { color: highlightColor },
	);
	let parsed = $derived(
		parseHighlightMarkup(String(text ?? '').replace(/\n+$/g, ''), highlightParseDefaults),
	);
	let segments = $derived(segmentText(parsed));
	let subtextParsed = $derived(
		parseHighlightMarkup(String(subtext ?? ''), highlightParseDefaults),
	);
	let subtextSegments = $derived(segmentText(subtextParsed));

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
	let hoveringSource = $state(false);

	let editingSubtext = $state(false);
	let subtextDraft = $state('');
	let subtextEl = $state<HTMLElement | null>(null);
	let subtextEditableEl = $state<HTMLElement | null>(null);
	let headlineInkWrap = $state<HTMLElement | null>(null);
	let subtextInkWrap = $state<HTMLElement | null>(null);
	let headlineInkBox = $state<InkBox | null>(null);
	let subtextInkBox = $state<InkBox | null>(null);

	function refreshHeadlineInk() {
		const el = editing
			? (editableEl?.querySelector<HTMLElement>('[contenteditable="true"]') ?? editableEl)
			: headlineEl;
		const wrap = headlineInkWrap;
		if (!el || !wrap) {
			headlineInkBox = null;
			return;
		}
		headlineInkBox = measureTightTextBox(el, wrap, scale);
	}

	function refreshSubtextInk() {
		const el = editingSubtext ? subtextEditableEl : subtextEl;
		const wrap = subtextInkWrap;
		if (!el || !wrap) {
			subtextInkBox = null;
			return;
		}
		subtextInkBox = measureTightTextBox(el, wrap, scale);
	}

	$effect(() => {
		void text;
		void headlineStyle;
		void editing;
		void scale;
		void selectedText;
		if (selectedText !== 'headline') {
			headlineInkBox = null;
			return;
		}
		const id = requestAnimationFrame(() => refreshHeadlineInk());
		return () => cancelAnimationFrame(id);
	});

	$effect(() => {
		void subtext;
		void subtextStyle;
		void editingSubtext;
		void scale;
		void selectedText;
		if (selectedText !== 'newsSubtext') {
			subtextInkBox = null;
			return;
		}
		const id = requestAnimationFrame(() => refreshSubtextInk());
		return () => cancelAnimationFrame(id);
	});

	$effect(() => {
		if (!editingSubtext && subtext !== subtextDraft) subtextDraft = subtext;
	});

	function startSubtextEdit(e: MouseEvent) {
		if (!interactive) return;
		e.stopPropagation();
		subtextDraft = String(subtext ?? '');
		editingSubtext = true;
		void tick().then(() => {
			const ce = subtextEditableEl;
			if (!ce) return;
			try {
				ce.innerText = subtextDraft;
				ce.focus();
				const range = document.createRange();
				range.selectNodeContents(ce);
				range.collapse(false);
				const sel = window.getSelection();
				sel?.removeAllRanges();
				sel?.addRange(range);
			} catch {
				/* ignore */
			}
			onTextSelect?.('newsSubtext', ce);
			refreshSubtextInk();
		});
	}

	function commitSubtext() {
		if (!editingSubtext) return;
		const next = subtextDraft.replace(/\u00a0/g, ' ');
		if (next !== String(subtext ?? '')) onSubtextChange?.(next);
		editingSubtext = false;
	}

	function finishSubtextEdit(e?: FocusEvent) {
		if (!editingSubtext) return;
		const rt = e?.relatedTarget;
		if (rt instanceof Element && rt.closest('[data-floating-toolbar], [data-slot="popover-content"]')) {
			return;
		}
		requestAnimationFrame(() => {
			requestAnimationFrame(() => {
				if (!editingSubtext) return;
				const ae = document.activeElement;
				if (ae instanceof Element && ae.closest('[data-floating-toolbar], [data-slot="popover-content"]')) {
					return;
				}
				commitSubtext();
			});
		});
	}

	function onSubtextKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			e.preventDefault();
			subtextDraft = String(subtext ?? '');
			editingSubtext = false;
			return;
		}
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			commitSubtext();
		}
	}

	function onSubtextInput(e: Event) {
		subtextDraft = (e.currentTarget as HTMLElement).innerText ?? '';
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

	function reportFieldRange(
		kind: 'headline' | 'newsSubtext',
		root: HTMLElement,
		phrase: { start: number; end: number } | null,
	) {
		const sel = window.getSelection();
		const hasRange =
			sel && sel.rangeCount > 0 && !sel.isCollapsed && root.contains(sel.anchorNode);
		if (hasRange) {
			const range = sel.getRangeAt(0);
			onTextSelect?.(kind, wrapRectAsAnchor(range.getBoundingClientRect()));
			const r = plainRangeFromSelection(root);
			onHeadlineRangeSelect?.(r?.start ?? -1, r?.end ?? -1);
			return;
		}
		if (phrase) {
			restorePlainSelection(root, phrase.start, phrase.end);
			const live = window.getSelection();
			const rect =
				live && live.rangeCount > 0
					? live.getRangeAt(0).getBoundingClientRect()
					: root.getBoundingClientRect();
			onTextSelect?.(kind, wrapRectAsAnchor(rect));
			onHeadlineRangeSelect?.(phrase.start, phrase.end);
			return;
		}
		onTextSelect?.(kind, root);
		onHeadlineRangeSelect?.(-1, -1);
	}

	function onSubtextMouseUp(e: MouseEvent) {
		if (!interactive || editingSubtext || !subtextEl) return;
		const phrase = phraseRangeFromTarget(e.target);
		setTimeout(() => {
			if (subtextEl) reportFieldRange('newsSubtext', subtextEl, phrase);
			refreshSubtextInk();
		}, 0);
	}

	function commitHeadlineToParent() {
		const cleaned = headlineDraft.replace(/\n+$/g, '');
		if (cleaned !== headlineDraft) headlineDraft = cleaned;
		if (onHeadlineLive) {
			onTextChange?.(cleaned);
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
	let textStartOffset = 0;
	let textMoved = false;

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
			refreshHeadlineInk();
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
		if (editing || editingSubtext) return;
		const target = e.target as HTMLElement;
		// Source + headline are separate DraggableBlocks — never pan the whole stack from them.
		const startedOnSelectable = !!target.closest('[data-text-selectable], [data-news-block]');
		if (startedOnSelectable) return;
		textArmed = true;
		textDragging = true;
		textMoved = false;
		textStartY = e.clientY;
		textStartOffset = textPanelOffsetY;
		textPointerId = e.pointerId;
		textCaptureEl = e.currentTarget as HTMLElement;
		textCaptureEl.setPointerCapture(e.pointerId);
		e.stopPropagation();
	}

	function textPointerMove(e: PointerEvent) {
		if (!textArmed) return;
		const dy = (e.clientY - textStartY) / scale;
		if (!textDragging) return;
		if (Math.abs(dy) > 4) textMoved = true;

		// Empty-padding drag only: nudge the whole stack vertically.
		const baseTop = H - TEXT_PANEL_H;
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
		// Keep textMoved through this gesture's click, then clear so later
		// source / headline taps are not stuck ignored after a panel pan.
		requestAnimationFrame(() => {
			textMoved = false;
		});
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
	function onHeadlineMouseUp(e: MouseEvent) {
		if (!interactive) return;
		const phrase = phraseRangeFromTarget(e.target);
		// Defer so the browser finalises the selection first.
		setTimeout(() => {
			if (headlineEl) reportFieldRange('headline', headlineEl, phrase);
			refreshHeadlineInk();
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
	let circleShadowPanelOpen = $state(false);
	let circleColorPanelOpen = $state(false);
	let lastMx = 0;
	let lastMy = 0;
	let circleStartSize = 0;
	let circleResizeStartMx = 0;
	let circleResizeStartMy = 0;
	let circleFileEl = $state<HTMLInputElement | null>(null);
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
		if (isVideoFile(file)) {
			onCircleImageChange?.(objectUrlForVideoFile(file));
			return;
		}
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
	let circle2ShadowPanelOpen = $state(false);
	let circle2ColorPanelOpen = $state(false);
	let lastMx2 = 0;
	let lastMy2 = 0;
	let circle2StartSize = 0;
	let circle2ResizeStartMx = 0;
	let circle2ResizeStartMy = 0;
	let circle2FileEl = $state<HTMLInputElement | null>(null);

	function openCircle2Picker(e: MouseEvent) {
		if (!interactive) return;
		e.stopPropagation();
		circle2FileEl?.click();
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
		if (isVideoFile(file)) {
			onCircle2ImageChange?.(objectUrlForVideoFile(file));
			return;
		}
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

	// ── Background: selection + resize handles (contain mode) ─────────────
	let bgSelected = $state(false);
	let bgImgNaturalW = $state(0);
	let bgImgNaturalH = $state(0);

	function rememberBgMediaSize(w: number, h: number) {
		if (!(w > 0 && h > 0)) return;
		bgImgNaturalW = w;
		bgImgNaturalH = h;
	}

	/** Painted cover size after object-fit + zoom pad — used for 1:1 pan. */
	function coverPaintSize(cw: number, ch: number, iw: number, ih: number, scale: number) {
		const s = Math.max(1, scale);
		if (!(iw > 0 && ih > 0)) {
			return { rw: cw * s, rh: ch * s };
		}
		const cr = cw / ch;
		const ir = iw / ih;
		if (ir > cr) {
			const rh = ch * s;
			return { rw: rh * ir, rh };
		}
		const rw = cw * s;
		return { rw, rh: rw / ir };
	}

	/** Natural-fit scale: scale that makes the image touch both edges of the canvas in contain mode. */
	const bgImgFitScale = $derived(
		!bgImgNaturalW || !bgImgNaturalH
			? 1
			: Math.min(W / bgImgNaturalW, H / bgImgNaturalH),
	);
	/** Rendered image size at current bgContainMagnify */
	const bgSelBoxW = $derived(bgImgNaturalW * bgImgFitScale * bgContainMagnifyPct / 100);
	const bgSelBoxH = $derived(bgImgNaturalH * bgImgFitScale * bgContainMagnifyPct / 100);
	const bgSelBoxX = $derived(W / 2 + containTranslateX - bgSelBoxW / 2);
	const bgSelBoxY = $derived(H / 2 + containTranslateY - bgSelBoxH / 2);

	/** 8 resize handles: id, direction vector (nx,ny), fractional position on the selection box */
	const BG_HANDLES = [
		{ id: 'nw', nx: -1, ny: -1, fx: 0,   fy: 0,   cursor: 'nwse-resize' },
		{ id: 'n',  nx:  0, ny: -1, fx: 0.5, fy: 0,   cursor: 'ns-resize'   },
		{ id: 'ne', nx:  1, ny: -1, fx: 1,   fy: 0,   cursor: 'nesw-resize' },
		{ id: 'e',  nx:  1, ny:  0, fx: 1,   fy: 0.5, cursor: 'ew-resize'   },
		{ id: 'se', nx:  1, ny:  1, fx: 1,   fy: 1,   cursor: 'nwse-resize' },
		{ id: 's',  nx:  0, ny:  1, fx: 0.5, fy: 1,   cursor: 'ns-resize'   },
		{ id: 'sw', nx: -1, ny:  1, fx: 0,   fy: 1,   cursor: 'nesw-resize' },
		{ id: 'w',  nx: -1, ny:  0, fx: 0,   fy: 0.5, cursor: 'ew-resize'   },
	] as const;

	let bgResizeActive: string | null = null;
	let bgResizeStartMagnify = 0;
	let bgResizeStartX = 0;
	let bgResizeStartY = 0;

	function bgHandlePointerDown(e: PointerEvent, id: string, nx: number, ny: number) {
		e.stopPropagation();
		e.preventDefault();
		bgResizeActive = id;
		bgResizeStartMagnify =
			bgFitMode === 'contain' ? bgContainMagnifyPct : Math.max(30, Number(bgZoom) || 100);
		bgResizeStartX = e.clientX;
		bgResizeStartY = e.clientY;
		(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
	}

	function bgHandlePointerMove(e: PointerEvent, nx: number, ny: number) {
		if (!bgResizeActive) return;
		const dx = (e.clientX - bgResizeStartX) / scale;
		const dy = (e.clientY - bgResizeStartY) / scale;
		// Project drag onto the handle's outward direction; normalise so diagonal = same as axis
		const len = Math.max(1, Math.sqrt(nx * nx + ny * ny));
		const proj = (nx * dx + ny * dy) / len;
		// Scale change: how many pixels we moved relative to half-canvas width
		const delta = (proj / (W * 0.5)) * bgResizeStartMagnify;
		if (bgFitMode === 'contain') {
			bgContainMagnify = Math.max(50, Math.min(400, Math.round(bgResizeStartMagnify + delta)));
		} else {
			bgZoom = Math.max(30, Math.min(300, Math.round(bgResizeStartMagnify + delta)));
		}
	}

	function bgHandlePointerUp() {
		bgResizeActive = null;
	}

	/** Selection ring box in template px — contain uses natural aspect; cover uses zoom frame. */
	const bgHandleBox = $derived.by(() => {
		if (bgFitMode === 'contain' && bgImgNaturalW > 0) {
			return { x: bgSelBoxX, y: bgSelBoxY, w: bgSelBoxW, h: bgSelBoxH };
		}
		if (bgIsShrunk) {
			return {
				x: (bgShrunkLeftPct / 100) * W,
				y: (bgShrunkTopPct / 100) * H,
				w: (bgZoomPct / 100) * W,
				h: (bgZoomPct / 100) * H,
			};
		}
		return { x: 0, y: 0, w: W, h: H };
	});

	const canShowBgHandles = $derived(
		interactive && bgSelected && !!(backgroundImage || backgroundVideo) && (bgImgNaturalW > 0 || bgFitMode === 'cover'),
	);

	// Deselect bg when pressing Escape
	$effect(() => {
		if (!bgSelected) return;
		function onKey(e: KeyboardEvent) { if (e.key === 'Escape') bgSelected = false; }
		window.addEventListener('keydown', onKey);
		return () => window.removeEventListener('keydown', onKey);
	});

	// ── Background: pan only after pointerdown + move (slop); hover moves ignored
	let bgDragging = $state(false);
	let bgPanPressed = false;
	let bgLastMx = 0;
	let bgLastMy = 0;
	let bgPanStartX = 0;
	let bgPanStartY = 0;
	const BG_SLOP_PX = 6;
	/** Allow pan “past” the frame edges (object-position / translate headroom). */
	const BG_OFFSET_MIN = -55;
	const BG_OFFSET_MAX = 155;
	/** Alt+drag anywhere on the canvas (capture) to pan — avoids the z-index-2 dead zone under text/circle. */
	let bgAltPanActive = $state(false);

	const bgPanCursor = $derived(bgDragging || bgAltPanActive ? 'grabbing' : 'grab');

	function clampBgOffset(v: number) {
		return Math.max(BG_OFFSET_MIN, Math.min(BG_OFFSET_MAX, v));
	}

	function applyBgPanPixels(dx: number, dy: number) {
		if (bgFitMode === 'contain') {
			const rangeX = 50 + Math.max(0, (bgContainMagnifyPct - 100) * 0.8);
			const rangeY = 50 + Math.max(0, (bgContainMagnifyPct - 100) * 0.8);
			bgOffsetX = Math.max(50 - rangeX, Math.min(50 + rangeX, bgOffsetX + (dx / W) * 100));
			bgOffsetY = Math.max(50 - rangeY, Math.min(50 + rangeY, bgOffsetY + (dy / H) * 100));
			return;
		}
		if (bgIsShrunk) {
			const gap = Math.max(1, 100 - bgZoomPct);
			bgOffsetX = clampBgOffset(bgOffsetX + (dx * 10000) / (gap * W));
			bgOffsetY = clampBgOffset(bgOffsetY + (dy * 10000) / (gap * H));
			return;
		}
		// Cover: object-position % maps across the overflow. Keep grab 1:1.
		const { rw, rh } = coverPaintSize(W, H, bgImgNaturalW, bgImgNaturalH, bgCoverScale);
		const overflowX = Math.max(8, rw - W);
		const overflowY = Math.max(8, rh - H);
		bgOffsetX = clampBgOffset(bgOffsetX - (dx * 100) / overflowX);
		bgOffsetY = clampBgOffset(bgOffsetY - (dy * 100) / overflowY);
	}

	let bgPanRaf = 0;
	let bgPanPendX = 0;
	let bgPanPendY = 0;

	function queueBgPan(dx: number, dy: number) {
		bgPanPendX += dx;
		bgPanPendY += dy;
		if (bgPanRaf) return;
		bgPanRaf = requestAnimationFrame(() => {
			bgPanRaf = 0;
			const x = bgPanPendX;
			const y = bgPanPendY;
			bgPanPendX = 0;
			bgPanPendY = 0;
			if (x || y) applyBgPanPixels(x, y);
		});
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
		queueBgPan(dx, dy);
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
			bgContainMagnify = Math.round(Math.max(50, Math.min(400, cur * factor)));
		} else {
			const cur = Number(bgZoom) || 100;
			bgZoom = Math.round(Math.max(30, Math.min(300, cur * factor)));
		}
	}

	onDestroy(() => {
		if (bgPanRaf) cancelAnimationFrame(bgPanRaf);
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
		e.preventDefault();
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
		}
		const dx = (e.clientX - bgLastMx) / scale;
		const dy = (e.clientY - bgLastMy) / scale;
		bgLastMx = e.clientX;
		bgLastMy = e.clientY;
		queueBgPan(dx, dy);
	}

	function bgPointerUp(e: PointerEvent) {
		try {
			(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
		} catch {
			/* ignore */
		}
		// Click without drag → select media (if any) and open BG tools.
		if (!bgDragging && bgPanPressed) {
			if (backgroundImage || backgroundVideo) {
				bgSelected = true;
			} else {
				bgSelected = false;
			}
			if (onBackgroundDblClick) {
				onBackgroundDblClick({ clientX: e.clientX, clientY: e.clientY });
			}
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

	function bgLayerClick(e: MouseEvent) {
		if (!interactive || !onBackgroundDblClick) return;
		// When a photo/video is present, pointer-up already opens BG tools (and
		// distinguishes click vs pan). This handles empty / solid backgrounds.
		if (hasBg) return;
		e.stopPropagation();
		e.preventDefault();
		onBackgroundDblClick({ clientX: e.clientX, clientY: e.clientY });
	}

	// ── Pattern rendering helpers ──────────────────────────────────────────
	function patternStyle(patternImage: string | undefined): string {
		return patternStyleForUrl(patternImage);
	}
</script>

<!-- Outer wrapper — overflow visible so resize handles can extend past the canvas edge -->
<div style="
	width: {W * scale}px;
	height: {H * scale}px;
	flex-shrink: 0;
	position: relative;
">
	<!-- Clip layer: applies rounded corners + clips the canvas content -->
	<div style="
		position: absolute; inset: 0;
		overflow: hidden;
		border-radius: {scale < 1 ? '12px' : '0'};
	">
	<!-- Inner at W×H — scaled via CSS transform -->
	<div
		bind:this={exportRef}
		data-studio-canvas-root
		data-news-canvas
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
		     - Fill frame (cover): inset 0 + object-fit cover (always full-bleed).
		       object-position pans; zoom>100 scales from the focal point.
		     - At zoom < 100% (shrink), we letterbox the media inside a dark
		       backdrop and the pan sliders reposition the shrunken media
		       within the visible frame (50 = centered).
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
						<!-- svelte-ignore a11y_media_has_caption -->
						<video
							bind:this={bgVideoEl}
							data-studio-bg-video="1"
							src={backgroundVideo}
							autoplay loop playsinline
							muted={videoMuted}
							onloadedmetadata={onBgVideoMeta}
							onloadeddata={() => playMediaVideo(bgVideoEl)}
							oncanplay={() => playMediaVideo(bgVideoEl)}
							ontimeupdate={onBgVideoTimeUpdate}
							style="
								max-width: 100%;
								max-height: 100%;
								width: auto;
								height: auto;
								display: block;
								transform: translate({containTranslateX}px, {containTranslateY}px) scale({bgContainMagnifyPct / 100});
								transform-origin: center center;
								will-change: transform;
							"
						></video>
					</div>
				{:else if bgIsShrunk}
					<!-- svelte-ignore a11y_media_has_caption -->
					<video
						bind:this={bgVideoEl}
						data-studio-bg-video="1"
						src={backgroundVideo}
						autoplay loop playsinline
						muted={videoMuted}
						onloadedmetadata={onBgVideoMeta}
						onloadeddata={() => playMediaVideo(bgVideoEl)}
						oncanplay={() => playMediaVideo(bgVideoEl)}
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
						bind:this={bgVideoEl}
						data-studio-bg-video="1"
						src={backgroundVideo}
						autoplay loop playsinline
						muted={videoMuted}
						onloadedmetadata={onBgVideoMeta}
						onloadeddata={() => playMediaVideo(bgVideoEl)}
						oncanplay={() => playMediaVideo(bgVideoEl)}
						ontimeupdate={onBgVideoTimeUpdate}
						style="
							position: absolute;
							inset: 0;
							width: 100%;
							height: 100%;
							object-fit: cover;
							object-position: {bgOffsetX}% {bgOffsetY}%;
							transform: translate3d(0,0,0) scale({bgCoverScale});
							transform-origin: 50% 50%;
							will-change: object-position;
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
					<img
						src={backgroundImage}
						alt=""
						onload={(e) => {
							const el = e.currentTarget as HTMLImageElement;
							bgImgNaturalW = el.naturalWidth;
							bgImgNaturalH = el.naturalHeight;
						}}
						style="
							max-width: 100%;
							max-height: 100%;
							width: auto;
							height: auto;
							display: block;
							transform: translate({containTranslateX}px, {containTranslateY}px) scale({bgContainMagnifyPct / 100});
							transform-origin: center center;
							will-change: transform;
						"
					/>
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
						onload={(e) => {
							const el = e.currentTarget as HTMLImageElement;
							rememberBgMediaSize(el.naturalWidth, el.naturalHeight);
						}}
						style="
							position: absolute;
							inset: 0;
							width: 100%;
							height: 100%;
							object-fit: cover;
							object-position: {bgOffsetX}% {bgOffsetY}%;
							transform: translate3d(0,0,0) scale({bgCoverScale});
							transform-origin: 50% 50%;
							will-change: object-position;
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

		<!-- Background pan + click for BG tools (above bg, below text/circle) -->
		{#if interactive && (hasBg || onBackgroundDblClick)}
			<div
				style="
					position: absolute; inset: 0; z-index: 2;
					cursor: {hasBg ? bgPanCursor : 'default'};
					touch-action: none;
				"
				title={hasBg
					? 'Click for BG tools · Drag corners to resize · Drag to pan · Alt+scroll to zoom'
					: 'Click for BG tools'}
				onpointerdown={hasBg ? bgPointerDown : undefined}
				onpointermove={hasBg ? bgPointerMove : undefined}
				onpointerup={hasBg ? bgPointerUp : undefined}
				onpointercancel={hasBg ? bgPointerCancel : undefined}
				onlostpointercapture={hasBg ? bgLostPointerCapture : undefined}
				onclick={bgLayerClick}
				role="presentation"
			></div>
		{/if}

		<!-- Gradient overlay — below text (z≈60) so copy always overlaps the letterbox/shadow. -->
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
					{resolveSrc}
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
							padding: 0;
							box-sizing: border-box;
							border-radius: 2px;
							background: transparent;
							{CANVAS_TEXT_FOCUS_RING}
							{CANVAS_TEXT_BOX_TRIM}
						"
						onclick={(e) => e.stopPropagation()}
						role="presentation"
					>
						<HighlightEditor
							value={t.text}
							rows={1}
							minHeight="0px"
							showToolbar={false}
							defaultColor={highlightColor}
							defaultStyle={highlightParseDefaults}
							liveLineHeight={css.lineHeight}
							lineHeight="inherit"
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
							padding: 0;
							box-sizing: border-box;
							border-radius: 2px;
							background: transparent;
							border: 1px dashed rgba(255,255,255,0.28);
							color: {css.color ?? '#FFFFFF'};
							font-family: {css.fontFamily ? `'${css.fontFamily}', system-ui, -apple-system, sans-serif` : `'Satoshi', system-ui, -apple-system, sans-serif`};
							font-size: {css.fontSize ?? 36}px;
							font-weight: {css.fontWeight ?? 600};
							text-align: {css.align ?? 'left'};
							line-height: {css.lineHeight ?? 1.3};
							letter-spacing: {css.letterSpacing != null ? `${css.letterSpacing}em` : '-0.015em'};
							{textShadowStyleAttr(css)}
							{CANVAS_TEXT_BOX_TRIM}
							overflow: visible;
							user-select: none;
						"
					>
						{@html segmentText(parseHighlightMarkup(t.text, highlightParseDefaults)).map((seg) => {
							if (!seg.highlighted) return seg.text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
							const esc = seg.text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
							if (seg.patternImage) {
								return wrapClippedFillHtml(patternStyle(seg.patternImage).replace(/\n/g,' '), esc);
							}
							if (seg.gradientFrom && seg.gradientTo) {
								return wrapClippedFillHtml(gradientTextFillCss(seg.gradientFrom, seg.gradientTo), esc);
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
				accept="image/*,video/mp4,video/webm,video/quicktime,video/x-m4v"
				style="display:none"
				onchange={onCircleFile}
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
					/* Above gradient; floats over text while dragging/editing. */
					z-index: {dragging || circleToolbarPopoverOpen ? 85 : 45};
					box-shadow: {circleShadowCss(circleShadow)};
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
						{#if circleSrcIsVideo}
							<!-- svelte-ignore a11y_media_has_caption -->
							<video
								src={circleImage}
								muted
								loop
								autoplay
								playsinline
								draggable="false"
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
								onloadeddata={(e) => playMediaVideo(e.currentTarget)}
								oncanplay={(e) => playMediaVideo(e.currentTarget)}
							></video>
						{:else}
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
						{/if}
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
			<Popover
				bind:open={circleToolbarPopoverOpen}
				onOpenChange={(o) => {
					if (!o && (circleShadowPanelOpen || circleColorPanelOpen)) {
						circleToolbarPopoverOpen = true;
						return;
					}
					circleToolbarPopoverOpen = o;
				}}
			>
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
							<Button variant="ghost" size="icon" class="h-8 w-8 shrink-0 rounded-full" type="button" onclick={() => (circleBorderWidth = Math.max(0, Math.round((circleBorderWidth ?? 0) - 1)))} title="Thinner border" aria-label="Thinner border"><Minus size={16} class="text-foreground" strokeWidth={2} /></Button>
							<span class="min-w-[1.5rem] text-center text-xs font-bold tabular-nums text-foreground">{Math.round(circleBorderWidth ?? 0)}</span>
							<Button variant="ghost" size="icon" class="h-8 w-8 shrink-0 rounded-full" type="button" onclick={() => (circleBorderWidth = Math.min(40, Math.round((circleBorderWidth ?? 0) + 1)))} title="Thicker border" aria-label="Thicker border"><Plus size={16} class="text-foreground" strokeWidth={2} /></Button>
						</div>
						<CircleColorPopover
							bind:color={circleBorderColor}
							onInteract={() => (circleToolbarPopoverOpen = true)}
							onOpenChange={(o) => {
								circleColorPanelOpen = o;
								if (o) circleToolbarPopoverOpen = true;
							}}
						/>
						<CircleShadowPopover
							bind:shadow={circleShadow}
							onInteract={() => (circleToolbarPopoverOpen = true)}
							onOpenChange={(o) => {
								circleShadowPanelOpen = o;
								if (o) circleToolbarPopoverOpen = true;
							}}
						/>
						<Button variant="ghost" size="icon" class="h-11 w-11 shrink-0 rounded-full" onclick={() => { circleImageZoom = 1; circleImagePanX = 50; circleImagePanY = 50; }} title="Reset image zoom/pan" aria-label="Reset image zoom/pan"><RotateCcw size={18} class="text-foreground" strokeWidth={2} /></Button>
						<div class="bg-muted/40 flex h-11 shrink-0 flex-row items-center gap-0.5 rounded-full px-1" role="group" aria-label="Circle size">
							<Button variant="ghost" size="icon" class="h-9 w-9 shrink-0 rounded-full" type="button" onclick={() => bumpCircleDiameter(36)} disabled={Number(circleSize) >= 720} title="Expand circle" aria-label="Expand circle"><Maximize2 size={16} class="text-foreground" strokeWidth={2} /></Button>
							<Button variant="ghost" size="icon" class="h-9 w-9 shrink-0 rounded-full" type="button" onclick={() => bumpCircleDiameter(-36)} disabled={Number(circleSize) <= 96} title="Shrink circle" aria-label="Shrink circle"><Minimize2 size={16} class="text-foreground" strokeWidth={2} /></Button>
						</div>
						<div class="bg-muted/40 flex h-11 shrink-0 flex-row items-center gap-0.5 rounded-full px-1" role="group" aria-label="Photo zoom inside circle">
							<Button variant="ghost" size="icon" class="h-9 w-9 shrink-0 rounded-full" type="button" onclick={() => bumpCircleImageZoom(0.12)} disabled={(Number(circleImageZoom) || 1) >= 4.99} title="Zoom photo in (up to 5×)" aria-label="Zoom photo in"><ZoomIn size={16} class="text-foreground" strokeWidth={2} /></Button>
							<Button variant="ghost" size="icon" class="h-9 w-9 shrink-0 rounded-full" type="button" onclick={() => bumpCircleImageZoom(-0.12)} disabled={(Number(circleImageZoom) || 1) <= 1.01} title="Zoom photo out" aria-label="Zoom photo out"><ZoomOut size={16} class="text-foreground" strokeWidth={2} /></Button>
						</div>
						<Button variant="ghost" size="icon" class="text-destructive hover:text-destructive h-11 w-11 shrink-0 rounded-full" onclick={removeCircle} title="Remove circle" aria-label="Remove circle"><Trash2 size={20} class="text-destructive" strokeWidth={2} /></Button>
					</PopoverContent>
				{/if}
			</Popover>
		{/if}

		<!-- ── Optional second circle badge ───────────────────────────────── -->
{#if allowCircle2 && (circle2Image || (interactive && showCircle2))}
			<input
				bind:this={circle2FileEl}
				type="file"
				accept="image/*,video/mp4,video/webm,video/quicktime,video/x-m4v"
				style="display:none"
				onchange={onCircle2File}
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
					z-index: {dragging2 || circle2ToolbarPopoverOpen ? 84 : 44};
					box-shadow: {circleShadowCss(circle2Shadow)};
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
						{#if circle2SrcIsVideo}
							<!-- svelte-ignore a11y_media_has_caption -->
							<video
								src={circle2Image}
								muted
								loop
								autoplay
								playsinline
								draggable="false"
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
								onloadeddata={(e) => playMediaVideo(e.currentTarget)}
								oncanplay={(e) => playMediaVideo(e.currentTarget)}
							></video>
						{:else}
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
						{/if}
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
			<Popover
				bind:open={circle2ToolbarPopoverOpen}
				onOpenChange={(o) => {
					if (!o && (circle2ShadowPanelOpen || circle2ColorPanelOpen)) {
						circle2ToolbarPopoverOpen = true;
						return;
					}
					circle2ToolbarPopoverOpen = o;
				}}
			>
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
							<Button variant="ghost" size="icon" class="h-8 w-8 shrink-0 rounded-full" type="button" onclick={() => (circle2BorderWidth = Math.max(0, Math.round((circle2BorderWidth ?? 0) - 1)))} title="Thinner border" aria-label="Thinner border"><Minus size={16} class="text-foreground" strokeWidth={2} /></Button>
							<span class="min-w-[1.5rem] text-center text-xs font-bold tabular-nums text-foreground">{Math.round(circle2BorderWidth ?? 0)}</span>
							<Button variant="ghost" size="icon" class="h-8 w-8 shrink-0 rounded-full" type="button" onclick={() => (circle2BorderWidth = Math.min(40, Math.round((circle2BorderWidth ?? 0) + 1)))} title="Thicker border" aria-label="Thicker border"><Plus size={16} class="text-foreground" strokeWidth={2} /></Button>
						</div>
						<CircleColorPopover
							bind:color={circle2BorderColor}
							onInteract={() => (circle2ToolbarPopoverOpen = true)}
							onOpenChange={(o) => {
								circle2ColorPanelOpen = o;
								if (o) circle2ToolbarPopoverOpen = true;
							}}
						/>
						<CircleShadowPopover
							bind:shadow={circle2Shadow}
							onInteract={() => (circle2ToolbarPopoverOpen = true)}
							onOpenChange={(o) => {
								circle2ShadowPanelOpen = o;
								if (o) circle2ToolbarPopoverOpen = true;
							}}
						/>
						<Button variant="ghost" size="icon" class="h-11 w-11 shrink-0 rounded-full" onclick={() => { circle2ImageZoom = 1; circle2ImagePanX = 50; circle2ImagePanY = 50; }} title="Reset image zoom/pan" aria-label="Reset image zoom/pan"><RotateCcw size={18} class="text-foreground" strokeWidth={2} /></Button>
						<div class="bg-muted/40 flex h-11 shrink-0 flex-row items-center gap-0.5 rounded-full px-1" role="group" aria-label="Circle size">
							<Button variant="ghost" size="icon" class="h-9 w-9 shrink-0 rounded-full" type="button" onclick={() => bumpCircle2Diameter(36)} disabled={Number(circle2Size) >= 720} title="Expand circle" aria-label="Expand circle"><Maximize2 size={16} class="text-foreground" strokeWidth={2} /></Button>
							<Button variant="ghost" size="icon" class="h-9 w-9 shrink-0 rounded-full" type="button" onclick={() => bumpCircle2Diameter(-36)} disabled={Number(circle2Size) <= 96} title="Shrink circle" aria-label="Shrink circle"><Minimize2 size={16} class="text-foreground" strokeWidth={2} /></Button>
						</div>
						<div class="bg-muted/40 flex h-11 shrink-0 flex-row items-center gap-0.5 rounded-full px-1" role="group" aria-label="Photo zoom inside circle">
							<Button variant="ghost" size="icon" class="h-9 w-9 shrink-0 rounded-full" type="button" onclick={() => bumpCircle2ImageZoom(0.12)} disabled={(Number(circle2ImageZoom) || 1) >= 4.99} title="Zoom photo in (up to 5×)" aria-label="Zoom photo in"><ZoomIn size={16} class="text-foreground" strokeWidth={2} /></Button>
							<Button variant="ghost" size="icon" class="h-9 w-9 shrink-0 rounded-full" type="button" onclick={() => bumpCircle2ImageZoom(-0.12)} disabled={(Number(circle2ImageZoom) || 1) <= 1.01} title="Zoom photo out" aria-label="Zoom photo out"><ZoomOut size={16} class="text-foreground" strokeWidth={2} /></Button>
						</div>
						<Button variant="ghost" size="icon" class="text-destructive hover:text-destructive h-11 w-11 shrink-0 rounded-full" onclick={removeCircle2} title="Remove circle" aria-label="Remove circle"><Trash2 size={20} class="text-destructive" strokeWidth={2} /></Button>
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
			<!-- Above circle badge (z≈45) so the subject overlaps the ring;
			     below the text stack (z≈60) so headlines always overlap letterbox/shadow. -->
			<div style="position: absolute; inset: 0; overflow: hidden; z-index: 48; pointer-events: none;">
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
						<img
							src={subjectCutout}
							alt=""
							style="
								max-width: 100%;
								max-height: 100%;
								width: auto;
								height: auto;
								display: block;
								transform: translate({containTranslateX}px, {containTranslateY}px) scale({bgContainMagnifyPct / 100});
								transform-origin: center center;
							"
						/>
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
							inset: 0;
							width: 100%;
							height: 100%;
							object-fit: cover;
							object-position: {bgOffsetX}% {bgOffsetY}%;
							transform: translate3d(0,0,0) scale({bgCoverScale});
							transform-origin: 50% 50%;
							will-change: object-position;
						"
					/>
				{/if}
			</div>
		{/if}

		{#snippet newsSourceBlock()}
						<DraggableBlock
							dx={textOffsets.source?.x ?? 0}
							dy={textOffsets.source?.y ?? 0}
							{interactive}
							{scale}
							holdDragFromText={interactive}
							immediateTextDrag={selectedText === 'source'}
							holdMs={220}
							snapToCenter={interactive}
							snapRoot={exportRef}
							onChange={(x, y) => onTextOffsetChange?.('source', { x, y })}
						>
							{#snippet children()}
								<input
									bind:this={sourceLogoFileEl}
									type="file"
									accept="image/*"
									style="display:none"
									onchange={onSourceLogoFile}
								/>
								<input
									bind:this={sourceLogoColorEl}
									type="color"
									value={sourceLogoBg || '#C8F050'}
									style="position:fixed;width:1px;height:1px;opacity:0;pointer-events:none;"
									aria-hidden="true"
									tabindex={-1}
									oninput={(e) => {
										const v = (e.currentTarget as HTMLInputElement).value;
										if (v) setSourceLogoBg(v);
									}}
								/>
								<!-- svelte-ignore a11y_no_static_element_interactions -->
								<div
									data-news-block="source"
									data-text-selectable="source"
									class="news-source-block"
									style="
										position: relative;
										display: flex; align-items: center;
										gap: {sourceLabelMode === 'logo' ? '0' : '18px'};
										overflow: visible;
										padding: 10px 0;
										box-sizing: content-box;
										{sourceLabelMode === 'logo' || sourceBorderKind !== 'rules' ? 'width: fit-content; max-width: 100%;' : 'width: 100%;'}
										{interactive ? 'cursor: grab;' : ''}
										{selectedText === 'source' && sourceLabelMode === 'text' ? CANVAS_TEXT_FOCUS_RING : ''}
									"
									onmouseenter={() => (hoveringSource = true)}
									onmouseleave={() => (hoveringSource = false)}
									onpointerdown={(e) => {
										if (!interactive) return;
										selectSource(e);
									}}
									onclick={(e) => {
										if (!interactive) return;
										selectSource(e);
									}}
								>
									{#if interactive && hoveringSource && selectedText !== 'source' && sourceLabelMode === 'text'}
										<div style="
											position: absolute;
											inset: -6px;
											border: 2px dashed rgba(255,255,255,0.28);
											border-radius: 8px;
											pointer-events: none;
										"></div>
									{/if}
									{#if sourceShowRules}
										<div style="flex: 1; height: 2px; background: {sourceRuleColor}; opacity: 0.9;"></div>
									{/if}
									<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
									<span
										bind:this={sourceEl}
										data-text-selectable="source"
										data-canvas-typography-root
										data-design-font-px={String(sourceStyle.fontSize ?? 34)}
										onpointerdown={selectSource}
										onclick={selectSource}
										ondblclick={onSourceLogoDblClick}
										onkeydown={(e) => { if (e.key === 'Enter') selectSource(e as any); }}
										role={interactive ? 'button' : undefined}
										tabindex={interactive ? 0 : undefined}
										title={interactive && sourceLabelMode === 'logo' ? 'Drag to move · Double-click to replace logo' : undefined}
										style="
											{sourceLabelMode === 'logo' ? 'display: inline-flex; align-items: center;' : sourceCss}
											white-space: nowrap;
											overflow: visible;
											{sourceShowBox
												? `box-sizing: border-box; ${textPaddingCss(sourceStyle)}; border: 2px solid ${sourceRuleColor}; border-radius: 999px;`
												: ''}
											{interactive && sourceLabelMode === 'text' ? 'cursor: pointer; user-select: text !important; -webkit-user-select: text !important;' : ''}
											{interactive && sourceLabelMode === 'logo' ? 'cursor: grab; user-select: none;' : ''}
										"
									>
										{#if sourceLabelMode === 'logo' && sourceLogoSrc}
											{@const logoSrc = resolveSrc?.(sourceLogoSrc) || sourceLogoSrc}
											{@const logoSelected = selectedText === 'source' || sourceLogoToolbarOpen}
											{#snippet sourceLogoTrigger({ props }: { props: Record<string, unknown> })}
												{@const triggerProps = props as Record<string, unknown> & {
													onclick?: (e: MouseEvent) => void;
												}}
												<!-- svelte-ignore a11y_no_static_element_interactions -->
												<div
													{...triggerProps}
													style="
														{sourceLogoChromeCss}
														{logoSelected ? 'box-shadow: 0 0 0 2px rgba(139,92,246,0.65);' : ''}
														{interactive && hoveringSource && selectedText !== 'source' && !sourceLogoToolbarOpen ? 'outline: 2px dashed rgba(255,255,255,0.35); outline-offset: 2px;' : ''}
													"
													onclick={(e) => {
														selectSource(e);
														triggerProps.onclick?.(e);
													}}
													ondblclick={onSourceLogoDblClick}
												>
													<img
														src={logoSrc}
														alt=""
														draggable="false"
														style="
															display: block;
															max-width: {Math.max(40, sourceLogoWidth)}px;
															max-height: 52px;
															width: auto;
															height: auto;
															object-fit: contain;
															pointer-events: none;
															filter: drop-shadow(0 1px 0 rgba(0,0,0,0.18)){templateTheme === 'dark' ? ' brightness(0) invert(1)' : ''};
														"
													/>
													{#if sourceLogoRemovingBg}
														<div
															style="
																position: absolute; inset: 0;
																border-radius: {sourceLogoRadius}px;
																background: rgba(0,0,0,0.45);
																display: flex; align-items: center; justify-content: center;
															"
															role="status"
															aria-label="Removing background"
														>
															<ClassicLoader size="sm" />
														</div>
													{/if}
												</div>
											{/snippet}
											{#if interactive}
												<Popover bind:open={sourceLogoToolbarOpen}>
													<PopoverTrigger
														openOnHover={true}
														openDelay={0}
														closeDelay={280}
														child={sourceLogoTrigger}
													/>
													<PopoverContent
														side="top"
														sideOffset={10}
														align="center"
														trapFocus={false}
														class="border-border bg-popover/95 text-foreground z-[60] !flex !w-max max-w-[calc(100vw-2rem)] !flex-row flex-nowrap items-center gap-1.5 overflow-x-auto rounded-full border p-2 shadow-lg ring-1 ring-border/40 backdrop-blur-md !gap-1.5 !p-2 [&_svg]:shrink-0 [&_svg]:text-foreground"
													>
														<Button
															variant="ghost"
															size="icon"
															class="h-11 w-11 shrink-0 rounded-full"
															onclick={openSourceLogoPicker}
															title="Replace logo"
															aria-label="Replace logo"
														>
															<Pencil size={20} class="text-foreground" strokeWidth={2} />
														</Button>
														<Button
															variant="ghost"
															size="icon"
															class="h-11 w-11 shrink-0 rounded-full"
															onclick={() => bumpSourceLogoWidth(-20)}
															title="Smaller"
															aria-label="Make logo smaller"
														>
															<Minus size={20} strokeWidth={2} />
														</Button>
														<Button
															variant="ghost"
															size="icon"
															class="h-11 w-11 shrink-0 rounded-full"
															onclick={() => bumpSourceLogoWidth(20)}
															title="Larger"
															aria-label="Make logo larger"
														>
															<Plus size={20} strokeWidth={2} />
														</Button>
														<div
															class="bg-muted/40 flex h-11 shrink-0 flex-row items-center gap-1 rounded-full px-2"
															role="group"
															aria-label="Corner radius"
															title="Corner radius"
														>
															<Button
																variant="ghost"
																size="icon"
																class="h-8 w-8 shrink-0 rounded-full"
																type="button"
																disabled={sourceLogoRadius <= 0}
																onclick={() => bumpSourceLogoRadius(-4)}
																title="Less rounded"
																aria-label="Decrease corner radius"
															>
																<Minus size={16} strokeWidth={2} />
															</Button>
															<span class="min-w-[1.75rem] text-center text-xs font-bold tabular-nums">{sourceLogoRadius}</span>
															<Button
																variant="ghost"
																size="icon"
																class="h-8 w-8 shrink-0 rounded-full"
																type="button"
																disabled={sourceLogoRadius >= LOGO_RADIUS_MAX}
																onclick={() => bumpSourceLogoRadius(4)}
																title="More rounded"
																aria-label="Increase corner radius"
															>
																<Plus size={16} strokeWidth={2} />
															</Button>
														</div>
														<div class="bg-muted/40 flex h-11 shrink-0 flex-row items-center gap-0.5 rounded-full px-1">
															<Button
																variant="ghost"
																size="icon"
																class="h-11 w-11 shrink-0 rounded-full"
																type="button"
																onclick={() => sourceLogoColorEl?.click()}
																title="Background color"
																aria-label="Background color"
															>
																<span
																	class="border-foreground/25 ring-foreground/15 box-border block h-[22px] w-[22px] rounded-md border-2 shadow-sm ring-1"
																	style="background: {sourceLogoBg
																		? sourceLogoBg
																		: 'linear-gradient(135deg, transparent 0 42%, rgba(255,59,92,0.95) 42% 52%, transparent 52% 100%), linear-gradient(135deg, rgba(0,0,0,0.10), rgba(0,0,0,0.02))'};"
																></span>
															</Button>
															{#if sourceLogoBg}
																<Button
																	variant="ghost"
																	size="icon"
																	class="h-8 w-8 shrink-0 rounded-full"
																	type="button"
																	onclick={() => setSourceLogoBg(undefined)}
																	title="Clear background"
																	aria-label="Clear background"
																>
																	<X size={14} strokeWidth={2} />
																</Button>
															{/if}
														</div>
														<div
															class="bg-muted/40 flex h-11 shrink-0 flex-row items-center gap-1 rounded-full px-2"
															role="group"
															aria-label="Background padding"
															title="Background padding"
														>
															<Button
																variant="ghost"
																size="icon"
																class="h-8 w-8 shrink-0 rounded-full"
																type="button"
																disabled={sourceLogoPad <= 0}
																onclick={() => bumpSourceLogoPad(-2)}
																title="Less padding"
																aria-label="Decrease padding"
															>
																<Minus size={16} strokeWidth={2} />
															</Button>
															<span class="min-w-[1.75rem] text-center text-xs font-bold tabular-nums">{sourceLogoPad}</span>
															<Button
																variant="ghost"
																size="icon"
																class="h-8 w-8 shrink-0 rounded-full"
																type="button"
																disabled={sourceLogoPad >= LOGO_PAD_MAX}
																onclick={() => bumpSourceLogoPad(2)}
																title="More padding"
																aria-label="Increase padding"
															>
																<Plus size={16} strokeWidth={2} />
															</Button>
														</div>
														<Button
															variant="ghost"
															size="icon"
															class="h-11 w-11 shrink-0 rounded-full"
															onclick={() => void removeSourceLogoBg()}
															title="Remove background"
															aria-label="Remove background"
															disabled={sourceLogoRemovingBg}
														>
															<Eraser size={20} strokeWidth={2} />
														</Button>
														<Button
															variant="ghost"
															size="icon"
															class="h-11 w-11 shrink-0 rounded-full text-destructive"
															onclick={clearSourceLogo}
															title="Remove logo"
															aria-label="Remove logo"
														>
															<Trash2 size={20} strokeWidth={2} />
														</Button>
													</PopoverContent>
												</Popover>
											{:else}
												<div style={sourceLogoChromeCss}>
													<img
														src={logoSrc}
														alt=""
														draggable="false"
														style="
															display: block;
															max-width: {Math.max(40, sourceLogoWidth)}px;
															max-height: 52px;
															width: auto;
															height: auto;
															object-fit: contain;
															pointer-events: none;
															filter: drop-shadow(0 1px 0 rgba(0,0,0,0.18)){templateTheme === 'dark' ? ' brightness(0) invert(1)' : ''};
														"
													/>
												</div>
											{/if}
										{:else if sourceLabelMode === 'text' && source}
											{source}
										{/if}
									</span>
									{#if sourceShowRules}
										<div style="flex: 1; height: 2px; background: {sourceRuleColor}; opacity: 0.9;"></div>
									{/if}
								</div>
							{/snippet}
						</DraggableBlock>
		{/snippet}

		<!-- ── Text area (source + headline + paragraph) ─────────────────── -->
		<!-- z above shadow/letterbox/cutout so copy always overlaps the black bands. -->
		<div
			style="
				position: absolute;
				inset: 0;
				z-index: 60;
				overflow: visible;
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
					overflow: visible;
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
				aria-label={interactive ? 'News text area' : undefined}
			>
			<div
				bind:this={textStackEl}
				data-news-text-stack
				style="
					display: flex;
					flex-direction: column;
					align-items: stretch;
					gap: 12px;
				"
			>
			{#if showSource}
				<div style="position: relative; z-index: 90; width: 100%; display: flex; justify-content: flex-end; align-items: center;">
					{@render newsSourceBlock()}
				</div>
			{/if}
			<!-- Headline -->
			<div
				style="
					position: relative;
					z-index: {selectedText === 'headline' || hoveringText || editing ? 70 : 50};
				"
			>
			<DraggableBlock
				dx={textOffsets.headline?.x ?? 0}
				dy={textOffsets.headline?.y ?? 0}
				{interactive}
				{scale}
				holdDragFromText={interactive}
				immediateTextDrag={selectedText === 'headline'}
				holdMs={220}
				snapToCenter={interactive}
				snapRoot={exportRef}
				onChange={(x, y) => onTextOffsetChange?.('headline', { x, y })}
			>
				{#snippet children()}
					<!-- svelte-ignore a11y_no_static_element_interactions -->
					<div
						data-news-block="headline"
						style="position: relative; overflow: visible; {interactive ? (selectedText === 'headline' && !editing ? 'cursor: grab;' : 'cursor: text;') : ''}"
						title={interactive ? 'Drag to move · Double-click to edit · Shift+drag to highlight' : undefined}
						onmouseenter={() => (hoveringText = true)}
						onmouseleave={() => (hoveringText = false)}
					>
						{#if interactive && hoveringText && !editing && selectedText !== 'headline'}
							<div style="
								position: absolute;
								inset: -8px;
								border: 2px dashed rgba(255,255,255,0.25);
								border-radius: 8px;
								pointer-events: none;
								z-index: 1;
							"></div>
							<div style="
								position: absolute;
								top: -2px; right: 0;
								font-family: 'Satoshi', sans-serif;
								font-size: 20px;
								color: rgba(255,255,255,0.4);
								pointer-events: none;
								letter-spacing: 0;
								z-index: 2;
							">✎ double-click to edit</div>
						{/if}

			<!--
			  In-flow edit swap (not a taller absolute overlay) so headline stays put.
			  Keep the <p> mounted off-layout while editing to avoid markup flash on blur.
			-->
			<div style="position: relative;" bind:this={headlineInkWrap}>
				<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
				<p
					bind:this={headlineEl}
					data-text-selectable="headline"
					data-canvas-typography-root
					data-design-font-px={String(headlineStyle.fontSize ?? fontSize)}
					aria-hidden={interactive && editing ? true : undefined}
					ondblclick={onHeadlineDblClick}
					onmouseup={onHeadlineMouseUp}
					onpointerup={onHeadlineMouseUp}
					style="
						margin: 0;
						padding: 0;
						border: 0;
						{headlineCss}
						text-transform: uppercase;
						word-break: break-word;
						white-space: pre-line;
						touch-action: pan-x;
						{interactive && editing
							? 'position: absolute; left: 0; right: 0; top: 0; visibility: hidden; pointer-events: none; height: auto;'
							: ''}
						{interactive ? 'cursor: text; user-select: text !important; -webkit-user-select: text !important;' : ''}
					"
				>
					{#each segments as seg}
						{#if seg.highlighted}
							<span
								data-hl-plain-start={seg.start ?? ''}
								data-hl-plain-end={seg.end ?? ''}
								style="cursor: text; pointer-events: auto; {seg.patternImage || (seg.gradientFrom && seg.gradientTo)
									? CLIPPED_TEXT_SHADOW_WRAP_CSS
									: 'display: inline;'}"
							>
							{#if seg.patternImage}
								<span style="{patternStyle(seg.patternImage)}; pointer-events: none;">{seg.text}</span>
							{:else if seg.gradientFrom && seg.gradientTo}
								<span style="{gradientTextFillCss(seg.gradientFrom, seg.gradientTo)}; pointer-events: none;">{seg.text}</span>
							{:else if seg.markerBg}
								<span
									style="
										background-color: {seg.markerBg};
										background-image: none;
										-webkit-background-clip: border-box;
										background-clip: border-box;
										color: {textColor};
										{TEXT_BG_CHIP_BOX_CSS}
										text-box: normal; text-box-trim: none;
										isolation: isolate;
										{textPaddingCss(headlineStyle)}
									"
								>{seg.text}</span>
							{:else}
								<span style="color: {seg.color};">{seg.text}</span>
							{/if}
							</span>
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
							position: relative;
							display: block;
							margin: 0;
							padding: 0;
							border: 0;
							{headlineCss}
							text-transform: uppercase;
							word-break: break-word;
							cursor: text;
							white-space: pre-wrap;
						"
					>
						<HighlightEditor
							value={headlineDraft}
							rows={1}
							minHeight="0px"
							showToolbar={false}
							defaultColor={highlightColor}
							defaultStyle={highlightParseDefaults}
							liveLineHeight={headlineStyle.lineHeight}
							liveFontWeight={headlineStyle.fontWeight}
							lineHeight="inherit"
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

				{#if selectedText === 'headline' && interactive && !editing}
					<div aria-hidden="true" style={inkRingStyle(headlineInkBox)}></div>
				{/if}
			</div>
					</div>
				{/snippet}
			</DraggableBlock>
			</div>

			{#if String(subtext ?? '').trim() || editingSubtext}
			<div
				style="
					position: relative;
					margin-top: 18px;
					z-index: {selectedText === 'newsSubtext' || editingSubtext ? 70 : 50};
				"
			>
			<DraggableBlock
				dx={textOffsets.newsSubtext?.x ?? 0}
				dy={textOffsets.newsSubtext?.y ?? 0}
				{interactive}
				{scale}
				holdDragFromText={interactive}
				immediateTextDrag={selectedText === 'newsSubtext'}
				holdMs={220}
				snapToCenter={interactive}
				snapRoot={exportRef}
				onChange={(x, y) => onTextOffsetChange?.('newsSubtext', { x, y })}
			>
				{#snippet children()}
				<div style="position: relative;" bind:this={subtextInkWrap}>
					<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
					<p
						bind:this={subtextEl}
						data-text-selectable="newsSubtext"
						data-canvas-typography-root
						data-design-font-px={String(effectiveSubtextFontSize)}
						aria-hidden={interactive && editingSubtext ? true : undefined}
						ondblclick={startSubtextEdit}
						onmouseup={onSubtextMouseUp}
						onpointerup={onSubtextMouseUp}
						onclick={(e) => {
							if (!interactive || textMoved) return;
							e.stopPropagation();
						}}
						style="
							margin: 0;
							padding: 0;
							{subtextCss}
							word-break: break-word;
							white-space: pre-line;
							visibility: {interactive && editingSubtext ? 'hidden' : 'visible'};
							pointer-events: {interactive && editingSubtext ? 'none' : 'auto'};
							{interactive ? 'user-select: text !important; -webkit-user-select: text !important; cursor: text;' : ''}
						"
					>{#each subtextSegments as seg}{#if seg.highlighted}<span data-hl-plain-start={seg.start ?? ''} data-hl-plain-end={seg.end ?? ''} style="cursor:text;pointer-events:auto;display:inline;">{#if seg.markerBg}<span style="background-color:{seg.markerBg};background-image:none;-webkit-background-clip:border-box;background-clip:border-box;color:{textColor};{TEXT_BG_CHIP_BOX_CSS}text-box:normal;text-box-trim:none;isolation:isolate;{textPaddingCss(subtextStyle)}">{seg.text}</span>{:else if seg.gradientFrom && seg.gradientTo}<span style="background:linear-gradient(90deg,{seg.gradientFrom},{seg.gradientTo});-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;pointer-events:none;">{seg.text}</span>{:else}<span style="color:{seg.color};">{seg.text}</span>{/if}</span>{:else}{seg.text}{/if}{/each}</p>
					{#if editingSubtext && interactive}
						<!-- svelte-ignore a11y_no_static_element_interactions -->
						<div
							bind:this={subtextEditableEl}
							data-text-selectable="newsSubtext"
							contenteditable="true"
							role="textbox"
							tabindex="0"
							aria-label="Paragraph editor"
							oninput={onSubtextInput}
							onkeydown={onSubtextKeydown}
							onblur={finishSubtextEdit}
							onclick={(e) => e.stopPropagation()}
							onmousedown={(e) => e.stopPropagation()}
							style="
								position: absolute;
								inset: 0;
								margin: 0;
								padding: 0;
								{subtextCss}
								opacity: 1;
								word-break: break-word;
								white-space: pre-wrap;
								cursor: text;
							"
						></div>
					{/if}
					{#if selectedText === 'newsSubtext' && interactive && !editingSubtext}
						<div aria-hidden="true" style={inkRingStyle(subtextInkBox)}></div>
					{/if}
				</div>
				{/snippet}
			</DraggableBlock>
			</div>
			{/if}
			</div>
			</div>
		</div>
	</div>
	</div><!-- /clip layer -->

	<!-- ── Background resize handles — outside the clip layer so they overflow the canvas edge -->
	{#if canShowBgHandles}
		{@const sx = bgHandleBox.x * scale}
		{@const sy = bgHandleBox.y * scale}
		{@const sw = bgHandleBox.w * scale}
		{@const sh = bgHandleBox.h * scale}
		<div
			style="
				position: absolute;
				left: {sx}px;
				top: {sy}px;
				width: {sw}px;
				height: {sh}px;
				border: 2px solid rgba(99, 158, 255, 0.85);
				box-shadow: 0 0 0 1px rgba(0,0,0,0.25);
				pointer-events: none;
				z-index: 10;
				box-sizing: border-box;
			"
		>
			{#each BG_HANDLES as h}
				<div
					style="
						position: absolute;
						left: {h.fx * 100}%;
						top: {h.fy * 100}%;
						width: 16px;
						height: 16px;
						border-radius: 50%;
						background: #fff;
						border: 2px solid rgba(99, 158, 255, 0.95);
						box-shadow: 0 1px 6px rgba(0,0,0,0.4);
						transform: translate(-50%, -50%);
						cursor: {h.cursor};
						pointer-events: all;
						touch-action: none;
					"
					role="presentation"
					title="Drag to resize"
					onpointerdown={(e) => bgHandlePointerDown(e, h.id, h.nx, h.ny)}
					onpointermove={(e) => bgHandlePointerMove(e, h.nx, h.ny)}
					onpointerup={bgHandlePointerUp}
					onpointercancel={bgHandlePointerUp}
				></div>
			{/each}
		</div>
	{/if}
</div>
