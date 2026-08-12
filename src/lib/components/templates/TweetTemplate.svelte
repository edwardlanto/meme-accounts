<script lang="ts">
import CanvasMarkupTextBlock from '$lib/components/CanvasMarkupTextBlock.svelte';
import HighlightedText from '$lib/components/HighlightedText.svelte';
import { TWEET_DEFAULTS } from '$lib/studio/slide-content-defaults';
import DraggableBlock from '$lib/components/DraggableBlock.svelte';
import type { TextElementKind, TextStyle } from '$lib/types';
import { appendTextBgCss, appendTextShadowCss } from '$lib/textStyleCss';
import { Move } from 'lucide-svelte';

interface TweetProps {
	// Top tweet
	topName?: string;
	topHandle?: string;
	topAvatar?: string;
	/** Solid fill inside top profile circle when no photo (empty = tweet card surface). */
	topAvatarInnerBg?: string;
	/** Override letters in top circle; empty → initials from name. */
	topAvatarLabel?: string;
	/** Ring border color around the top avatar. */
	topAvatarRingColor?: string;
	/** Ring border thickness in px (0 = no ring). */
	topAvatarRingWidth?: number;
	topVerified?: boolean;
	topText?: string;
	topImage?: string;
	topVideo?: string;
	/** Seek attached clip video to this second (preview/export). */
	videoSeekSec?: number;
	videoTrimStartSec?: number;
	videoTrimEndSec?: number;
	onTopImageChange?: (v: string) => void;
	onTopVideoChange?: (v: string) => void;
	/** Attached image frame height in px (editable). */
	topImageHeight?: number;
	/** Attached image frame width in px (editable). */
	topImageWidth?: number;
	/** Attached image zoom (1–3). */
	topImageZoom?: number;
	/** Attached image pan position as percent (0–100). */
	topImagePanX?: number;
	/** Attached image pan position as percent (0–100). */
	topImagePanY?: number;
	onTopImageHeightChange?: (v: number) => void;
	onTopImageWidthChange?: (v: number) => void;
	onTopImageZoomChange?: (v: number) => void;
	onTopImagePanChange?: (x: number, y: number) => void;
	// Bottom reply
	bottomName?: string;
	bottomHandle?: string;
	bottomAvatar?: string;
	bottomAvatarInnerBg?: string;
	bottomAvatarLabel?: string;
	bottomAvatarRingColor?: string;
	bottomAvatarRingWidth?: number;
	bottomVerified?: boolean;
	bottomText?: string;
	// Engagement
	replyCount?: string;
	repostCount?: string;
	likeCount?: string;
	// Style
	templateTheme?: 'light' | 'dark';
	/** Logical export size (Studio); 1080×1350 design is letterboxed to fit */
	canvasW?: number;
	canvasH?: number;
	scale?: number;
	interactive?: boolean;
	exportRef?: HTMLElement | null;
	selectedText?: TextElementKind | null;
	onTextSelect?: (kind: TextElementKind, el: HTMLElement) => void;
	onHeadlineRangeSelect?: (start: number, end: number) => void;
	headlineStyle?: TextStyle;
	/** Optional per-field style overrides (font/size/color/etc). */
	tweetStyles?: Partial<Record<
		| 'tweetTopName'
		| 'tweetTopHandle'
		| 'tweetTopText'
		| 'tweetBottomName'
		| 'tweetBottomHandle'
		| 'tweetBottomText'
		| 'tweetReplyCount'
		| 'tweetRepostCount'
		| 'tweetLikeCount',
		TextStyle
	>>;
	showToolbar?: boolean;
	/** When set, tweet body is editable on the canvas (built-in highlight toolbar). */
	onTopTextChange?: (v: string) => void;
	onBottomTextChange?: (v: string) => void;
	onTopNameChange?: (v: string) => void;
	onTopHandleChange?: (v: string) => void;
	onBottomNameChange?: (v: string) => void;
	onBottomHandleChange?: (v: string) => void;
	onReplyCountChange?: (v: string) => void;
	onRepostCountChange?: (v: string) => void;
	onLikeCountChange?: (v: string) => void;
	textOffsets?: Record<string, { x: number; y: number }>;
	onTextOffsetChange?: (kind: string, next: { x: number; y: number }) => void;
	/** When false (default), hide the reply / thread under the main tweet. */
	showReply?: boolean;
}

let {
	topName      = 'Chef 👨‍🍳',
	topHandle    = '@chefsevenn',
	topAvatar    = '',
	topAvatarInnerBg = '',
	topAvatarLabel = '',
	topAvatarRingColor = '#c9b97a',
	topAvatarRingWidth = 4,
	topVerified  = true,
	topText      = 'Ketchup or mayo or mustard?',
	topImage     = TWEET_DEFAULTS.topImage || '/templates/tweet/demo-bg.jpg',
	topVideo     = '',
	videoSeekSec = NaN,
	videoTrimStartSec = 0,
	videoTrimEndSec = 0,
	topImageHeight = 720,
	topImageWidth = 920,
	topImageZoom = 1,
	topImagePanX = 50,
	topImagePanY = 50,
	bottomName   = 'Mo Mohler',
	bottomHandle = '@MoMohler',
	bottomAvatar = '',
	bottomAvatarInnerBg = '',
	bottomAvatarLabel = '',
	bottomAvatarRingColor = '#c9b97a',
	bottomAvatarRingWidth = 4,
	bottomVerified = true,
	bottomText   = '3 straight misses chef. These appear to be French fries.',
	replyCount = '4.2K',
	repostCount = '12.8K',
	likeCount = '89.4K',
	templateTheme = 'light',
	canvasW      = 1080,
	canvasH      = 1350,
	scale        = 1,
	interactive  = true,
	exportRef    = $bindable<HTMLElement | null>(null),
	selectedText = null,
	onTextSelect,
	onHeadlineRangeSelect,
	headlineStyle = {},
	tweetStyles = {},
	showToolbar = false,
	onTopTextChange,
	onBottomTextChange,
	onTopNameChange,
	onTopHandleChange,
	onBottomNameChange,
	onBottomHandleChange,
	onReplyCountChange,
	onRepostCountChange,
	onLikeCountChange,
	onTopImageChange,
	onTopVideoChange,
	onTopImageHeightChange,
	onTopImageWidthChange,
	onTopImageZoomChange,
	onTopImagePanChange,
	textOffsets = {},
	onTextOffsetChange,
	/** Reply / thread under the main tweet — off by default (single-post card). */
	showReply = false,
}: TweetProps = $props();

	const topNameDisplay = $derived(String(topName ?? ''));
	const topHandleDisplay = $derived(String(topHandle ?? ''));
	const bottomNameDisplay = $derived(String(bottomName ?? ''));
	const bottomHandleDisplay = $derived(String(bottomHandle ?? ''));

	const topEditable = $derived(!!interactive && typeof onTopTextChange === 'function');
	const bottomEditable = $derived(!!interactive && typeof onBottomTextChange === 'function');
	const topNameEditable = $derived(!!interactive && typeof onTopNameChange === 'function');
	const topHandleEditable = $derived(!!interactive && typeof onTopHandleChange === 'function');
	const bottomNameEditable = $derived(!!interactive && typeof onBottomNameChange === 'function');
	const bottomHandleEditable = $derived(!!interactive && typeof onBottomHandleChange === 'function');
	const topImageEditable = $derived(!!interactive && typeof onTopImageChange === 'function');
	const topVideoEditable = $derived(!!interactive && typeof onTopVideoChange === 'function');

	let topImageResizing = $state(false);
	let topImagePanning = $state(false);
	let topImageStart = $state<{ x: number; y: number; h: number; w: number; panX: number; panY: number } | null>(null);
	let topVideoEl = $state<HTMLVideoElement | null>(null);

	function onTopVideoTimeUpdate(e: Event) {
		const el = e.currentTarget as HTMLVideoElement;
		topVideoEl = el;
		const start = Number(videoTrimStartSec || 0);
		const end = Number(videoTrimEndSec || 0);
		if (!(Number.isFinite(start) && Number.isFinite(end) && end > start + 0.02)) return;
		if (el.currentTime < start || el.currentTime >= end) {
			try {
				el.currentTime = start;
			} catch {
				/* ignore */
			}
		}
	}

	function onTopVideoLoaded(e: Event) {
		const el = e.currentTarget as HTMLVideoElement;
		topVideoEl = el;
		const t = Number(videoSeekSec);
		if (Number.isFinite(t) && t >= 0) {
			try {
				el.currentTime = t;
			} catch {
				/* ignore */
			}
		}
	}

	$effect(() => {
		const el = topVideoEl;
		const t = Number(videoSeekSec);
		if (!el || !Number.isFinite(t)) return;
		try {
			el.currentTime = Math.max(0, t);
		} catch {
			/* ignore */
		}
	});

	function clamp(n: number, a: number, b: number) { return Math.max(a, Math.min(b, n)); }
	function setTopImageHeight(next: number) {
		const v = clamp(Math.round(next), 180, 760);
		onTopImageHeightChange?.(v);
	}
	function setTopImageWidth(next: number) {
		const v = clamp(Math.round(next), 520, 920);
		onTopImageWidthChange?.(v);
	}
	/** Inner media zoom (object-fit cover + transform scale). */
	const MEDIA_ZOOM_MIN = 1;
	const MEDIA_ZOOM_MAX = 5;

	function setTopImageZoom(next: number) {
		const v = clamp(Number(next) || 1, MEDIA_ZOOM_MIN, MEDIA_ZOOM_MAX);
		onTopImageZoomChange?.(v);
	}

	/** Wider than 0–100 so tall/wide cover crops can reach edges without hitting a hard wall. */
	const PAN_PCT_MIN = -55;
	const PAN_PCT_MAX = 155;

	function setTopImagePan(x: number, y: number) {
		onTopImagePanChange?.(clamp(x, PAN_PCT_MIN, PAN_PCT_MAX), clamp(y, PAN_PCT_MIN, PAN_PCT_MAX));
	}

	function startTopImageResize(e: PointerEvent) {
		if (!interactive) return;
		e.preventDefault();
		e.stopPropagation();
		(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
		topImageResizing = true;
		topImageStart = {
			x: e.clientX,
			y: e.clientY,
			h: Number(topImageHeight) || 360,
			w: Number(topImageWidth) || 920,
			panX: Number(topImagePanX) || 50,
			panY: Number(topImagePanY) || 50,
		};
	}

	function beginMediaPan(e: PointerEvent) {
		if (!interactive) return;
		e.preventDefault();
		e.stopPropagation();
		(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
		topImagePanning = true;
		topImageStart = {
			x: e.clientX,
			y: e.clientY,
			h: Number(topImageHeight) || 360,
			w: Number(topImageWidth) || 920,
			panX: Number(topImagePanX) || 50,
			panY: Number(topImagePanY) || 50,
		};
	}

	function startTopImagePan(e: PointerEvent) {
		// Alt/Option drag pans the image inside its frame (keeps normal drag-to-move for the block).
		if (!e.altKey) return;
		beginMediaPan(e);
	}

	/** Pan video (or framed media) from the visible move handle — no Alt required. */
	function startTopVideoPanFromHandle(e: PointerEvent) {
		if (!interactive || !topVideo) return;
		beginMediaPan(e);
	}

	function moveTopImage(e: PointerEvent) {
		if (!topImageStart) return;
		if (!topImageResizing && !topImagePanning) return;
		const dx = (e.clientX - topImageStart.x) / Math.max(0.001, scale);
		const dy = (e.clientY - topImageStart.y) / Math.max(0.001, scale);
		if (topImageResizing) {
			setTopImageHeight(topImageStart.h + dy);
			setTopImageWidth(topImageStart.w + dx);
			return;
		}
		if (topImagePanning) {
			const h = topImageStart.h;
			const w = topImageStart.w;
			const z = Number(topImageZoom) || 1;
			// Single scale for X and Y so diagonal drags feel even (split denoms felt “sticky” vertically).
			const denom = Math.max(380, (w + h) * 0.52) * z;
			setTopImagePan(topImageStart.panX + (dx / denom) * 100, topImageStart.panY + (dy / denom) * 100);
		}
	}

	function endTopImage(e: PointerEvent) {
		const wasDragging = topImageResizing || topImagePanning;
		if (topImageResizing || topImagePanning) e.stopPropagation();
		topImageResizing = false;
		topImagePanning = false;
		topImageStart = null;
		if (wasDragging) {
			suppressMediaClick = true;
			setTimeout(() => {
				suppressMediaClick = false;
			}, 120);
		}
	}

	/** Suppress frame click after pan/resize so the media toolbar doesn’t reopen. */
	let suppressMediaClick = $state(false);

	function onTweetMediaFrameClick(e: MouseEvent) {
		if (suppressMediaClick) return;
		if (!interactive || !topImageEditable || !onTextSelect) return;
		e.stopPropagation();
		onTextSelect('tweetTopMedia', e.currentTarget as HTMLElement);
	}

	const mediaFrameSelected = $derived(selectedText === 'tweetTopMedia');
	const mediaFrameOutline = $derived(
		mediaFrameSelected && topImageEditable ? 'box-shadow: 0 0 0 2px rgba(139, 92, 246, 0.65);' : '',
	);
	const tweetHighlightDefault = '#1D9BF0';
	const isLight = $derived(templateTheme === 'light');
	const card = $derived(isLight ? '#FFFFFF' : '#111111');
	const card2 = $derived(isLight ? '#F0F3F4' : '#0f0f10');
	const divider = $derived(isLight ? '#EFF3F4' : 'rgba(255,255,255,0.10)');
	/** Media frame border (X / screenshot style). */
	const mediaBorder = $derived(isLight ? '#CFD9DE' : 'rgba(255,255,255,0.14)');
	const textPrimary = $derived(isLight ? '#0F1419' : '#F3F5F7');
	const textSecondary = $derived(isLight ? '#536471' : 'rgba(243,245,247,0.62)');

	function styleCss(s: TextStyle) {
		const bits: string[] = [];
		if (s.fontFamily) bits.push(`font-family: '${s.fontFamily}', 'Satoshi', system-ui, sans-serif;`);
		if (s.fontSize) bits.push(`font-size: ${s.fontSize}px;`);
		if (s.fontWeight != null) bits.push(`font-weight: ${s.fontWeight};`);
		if (s.italic) bits.push('font-style: italic;');
		if (s.underline) bits.push('text-decoration: underline;');
		if (s.color) bits.push(`color: ${s.color};`);
		if (s.bgColor) {
			appendTextBgCss(bits, s);
		}
		if (s.letterSpacing != null) bits.push(`letter-spacing: ${s.letterSpacing}em;`);
		if (s.lineHeight != null) bits.push(`line-height: ${s.lineHeight};`);
		if (s.align) bits.push(`text-align: ${s.align};`);
		appendTextShadowCss(bits, s);
		return bits.join(' ');
	}

	const topNameCss = $derived(styleCss(tweetStyles.tweetTopName ?? {}));
	const topHandleCss = $derived(styleCss(tweetStyles.tweetTopHandle ?? {}));
	const topTextCss = $derived(styleCss(tweetStyles.tweetTopText ?? {}));
	const bottomNameCss = $derived(styleCss(tweetStyles.tweetBottomName ?? {}));
	const bottomHandleCss = $derived(styleCss(tweetStyles.tweetBottomHandle ?? {}));
	const bottomTextCss = $derived(styleCss(tweetStyles.tweetBottomText ?? {}));
	const BASE_W = 1080;
	const BASE_H = 1350;
	const W = $derived(Math.max(320, Number(canvasW) || BASE_W));
	const H = $derived(Math.max(320, Number(canvasH) || BASE_H));
	const layoutScale = $derived(Math.min(W / BASE_W, H / BASE_H));
	const letterInsetX = $derived((W - BASE_W * layoutScale) / 2);
	const letterInsetY = $derived((H - BASE_H * layoutScale) / 2);
	const dragScale = $derived(scale * layoutScale);

	/** Initials fallback for missing avatar (match text carousel: up to 3 letters). */
	function initials(name: string) {
		return name.replace(/[^\w\s]/g, '').trim().split(/\s+/).map(w => w[0]?.toUpperCase() ?? '').slice(0, 3).join('');
	}

	const topInnerDiscBg = $derived(
		(topAvatarInnerBg && topAvatarInnerBg.trim()) ? topAvatarInnerBg.trim() : card,
	);
	const bottomInnerDiscBg = $derived(
		(bottomAvatarInnerBg && bottomAvatarInnerBg.trim()) ? bottomAvatarInnerBg.trim() : card,
	);
	const topDiscText = $derived((topAvatarLabel && topAvatarLabel.trim()) || initials(topNameDisplay));
	const bottomDiscText = $derived((bottomAvatarLabel && bottomAvatarLabel.trim()) || initials(bottomNameDisplay));

	function topDiscInk() {
		const custom = !!(topAvatarInnerBg && topAvatarInnerBg.trim());
		if (custom) return '#ffffff';
		return textPrimary;
	}
	function bottomDiscInk() {
		const custom = !!(bottomAvatarInnerBg && bottomAvatarInnerBg.trim());
		if (custom) return '#ffffff';
		return textPrimary;
	}

	function onTopAvatarClick(e: MouseEvent) {
		e.stopPropagation();
		if (!interactive || !onTextSelect) return;
		onTextSelect('tweetTopAvatar', e.currentTarget as HTMLElement);
	}
	function onBottomAvatarClick(e: MouseEvent) {
		e.stopPropagation();
		if (!interactive || !onTextSelect) return;
		onTextSelect('tweetBottomAvatar', e.currentTarget as HTMLElement);
	}

	const topAvatarSelected = $derived(selectedText === 'tweetTopAvatar');
	const bottomAvatarSelected = $derived(selectedText === 'tweetBottomAvatar');

	const topRingW = $derived(Math.max(0, Math.min(24, Math.round(Number(topAvatarRingWidth) || 0))));
	const bottomRingW = $derived(Math.max(0, Math.min(24, Math.round(Number(bottomAvatarRingWidth) || 0))));
	const topRingCol = $derived((topAvatarRingColor && topAvatarRingColor.trim()) || '#c9b97a');
	const bottomRingCol = $derived((bottomAvatarRingColor && bottomAvatarRingColor.trim()) || '#c9b97a');
</script>

<!-- Outer wrapper — controls display size -->
<div style="
	width: {W * scale}px;
	height: {H * scale}px;
	overflow: visible;
	border-radius: {scale < 1 ? '12px' : '0'};
	flex-shrink: 0;
	position: relative;
">
	<!-- Inner export surface — letterboxed 1080×1350 design when w/h differ -->
	<div
		bind:this={exportRef}
		data-studio-canvas-root
		style="
			width: {W}px;
			height: {H}px;
			position: relative;
			background: {card};
			transform: scale({scale});
			transform-origin: top left;
			font-family: 'Satoshi', system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
			box-sizing: border-box;
			overflow: hidden;
		"
	>
		<div
			style="
				position: absolute;
				left: {letterInsetX}px;
				top: {letterInsetY}px;
				width: {BASE_W}px;
				height: {BASE_H}px;
				transform: scale({layoutScale});
				transform-origin: 0 0;
				display: flex;
				flex-direction: column;
				justify-content: center;
				box-sizing: border-box;
				overflow: visible;
				padding: 72px 80px 88px;
			"
		>
			<!-- OP: avatar, name, and handle are independent (not one locked profile group) -->
			<div style="display:flex;align-items:flex-start;gap:24px;margin:0 0 28px;width:100%;">
				<DraggableBlock
					dx={textOffsets.tweetTopAvatar?.x ?? textOffsets.tweetTopProfile?.x ?? 0}
					dy={textOffsets.tweetTopAvatar?.y ?? textOffsets.tweetTopProfile?.y ?? 0}
					{interactive}
					scale={dragScale}
					immediateTextDrag={true}
					onChange={(x, y) => onTextOffsetChange?.('tweetTopAvatar', { x, y })}
				>
					{#snippet children()}
						<div
							role="button"
							tabindex="0"
							data-draggable-no-pan
							data-text-selectable="tweetTopAvatar"
							style="
								width:{88 + topRingW * 2}px;height:{88 + topRingW * 2}px;border-radius:50%;flex-shrink:0;
								display:flex;align-items:center;justify-content:center;
								padding:{topRingW}px;box-sizing:border-box;
								background:{topRingW > 0
									? `linear-gradient(135deg, ${topRingCol}, color-mix(in srgb, ${topRingCol} 60%, white))`
									: 'transparent'};
								cursor:{interactive ? 'grab' : 'default'};
								outline:none;
								{topAvatarSelected ? 'box-shadow: 0 0 0 3px rgba(139, 92, 246, 0.75);' : ''}
							"
							onclick={onTopAvatarClick}
							onkeydown={(e) => {
								if (!interactive || !onTextSelect) return;
								if (e.key === 'Enter' || e.key === ' ') {
									e.preventDefault();
									onTextSelect('tweetTopAvatar', e.currentTarget as HTMLElement);
								}
							}}
						>
							<div
								style="
									width:100%;height:100%;border-radius:50%;overflow:hidden;
									background:{topInnerDiscBg};
									display:flex;align-items:center;justify-content:center;
									pointer-events:none;
								"
							>
								{#if topAvatar?.trim()}
									<img src={topAvatar} alt="" style="width:100%;height:100%;object-fit:cover;display:block;" />
								{:else}
									<span style="color:{topDiscInk()};font-size:28px;font-weight:700;letter-spacing:-0.5px;">{topDiscText}</span>
								{/if}
							</div>
						</div>
					{/snippet}
				</DraggableBlock>

				<div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:6px;align-items:flex-start;">
					<div style="display:flex;align-items:center;gap:8px;min-width:0;max-width:100%;">
						<DraggableBlock
							dx={textOffsets.tweetTopName?.x ?? textOffsets.tweetTopProfile?.x ?? 0}
							dy={textOffsets.tweetTopName?.y ?? textOffsets.tweetTopProfile?.y ?? 0}
							{interactive}
							scale={dragScale}
							holdDragFromText={!!topNameEditable}
							immediateTextDrag={selectedText === 'tweetTopName'}
							holdMs={300}
							onChange={(x, y) => onTextOffsetChange?.('tweetTopName', { x, y })}
						>
							{#snippet children()}
								<div style="min-width:0;max-width:100%;">
									<CanvasMarkupTextBlock
										value={topName}
										interactive={topNameEditable}
										defaultColor={tweetHighlightDefault}
										toolbarKind="tweetTopName"
										selected={selectedText === 'tweetTopName'}
										onTextSelect={onTextSelect}
										onHeadlineRangeSelect={onHeadlineRangeSelect}
										rows={1}
										minHeight="0px"
										{showToolbar}
										ariaLabel="Top name"
										fontFamily="'Satoshi', system-ui, -apple-system, BlinkMacSystemFont, sans-serif"
										fontSize={tweetStyles.tweetTopName?.fontSize ?? 36}
										onTextChange={onTopNameChange}
									>
										{#snippet display()}
											<p style="margin:0;font-size:{tweetStyles.tweetTopName?.fontSize ?? 36}px;font-weight:700;color:{textPrimary};letter-spacing:-0.02em;line-height:1.2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis; {topNameCss}">{topNameDisplay}</p>
										{/snippet}
									</CanvasMarkupTextBlock>
								</div>
							{/snippet}
						</DraggableBlock>
						{#if topVerified}
							<svg width="24" height="24" viewBox="0 0 24 24" fill="none" style="flex-shrink:0;" aria-hidden="true">
								<circle cx="12" cy="12" r="12" fill="#1D9BF0" />
								<path d="M9.5 16.5l-3-3 1.4-1.4 1.6 1.6 5.1-5.1 1.4 1.4z" fill="white" />
							</svg>
						{/if}
					</div>
					<DraggableBlock
						dx={textOffsets.tweetTopHandle?.x ?? textOffsets.tweetTopProfile?.x ?? 0}
						dy={textOffsets.tweetTopHandle?.y ?? textOffsets.tweetTopProfile?.y ?? 0}
						{interactive}
						scale={dragScale}
						holdDragFromText={!!topHandleEditable}
						immediateTextDrag={selectedText === 'tweetTopHandle'}
						holdMs={300}
						onChange={(x, y) => onTextOffsetChange?.('tweetTopHandle', { x, y })}
					>
						{#snippet children()}
							<CanvasMarkupTextBlock
								value={topHandle}
								interactive={topHandleEditable}
								defaultColor={tweetHighlightDefault}
								toolbarKind="tweetTopHandle"
								selected={selectedText === 'tweetTopHandle'}
								onTextSelect={onTextSelect}
								onHeadlineRangeSelect={onHeadlineRangeSelect}
								rows={1}
								minHeight="0px"
								{showToolbar}
								ariaLabel="Top handle"
								fontFamily="'Satoshi', system-ui, -apple-system, BlinkMacSystemFont, sans-serif"
								fontSize={tweetStyles.tweetTopHandle?.fontSize ?? 28}
								onTextChange={onTopHandleChange}
							>
								{#snippet display()}
									<p style="margin:0;font-size:{tweetStyles.tweetTopHandle?.fontSize ?? 28}px;color:{textSecondary};font-weight:400;line-height:1.25;letter-spacing:-0.01em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis; {topHandleCss}">{topHandleDisplay}</p>
								{/snippet}
							</CanvasMarkupTextBlock>
						{/snippet}
					</DraggableBlock>
				</div>
			</div>

			<!-- Tweet body -->
			<DraggableBlock
				dx={textOffsets.tweetTopText?.x ?? 0}
				dy={textOffsets.tweetTopText?.y ?? 0}
				{interactive}
				scale={dragScale}
				holdDragFromText={!!topEditable}
				immediateTextDrag={selectedText === 'tweetTopText'}
				holdMs={300}
				onChange={(x, y) => onTextOffsetChange?.('tweetTopText', { x, y })}
			>
				{#snippet children()}
					<div style="margin: 0 0 28px;">
						<CanvasMarkupTextBlock
							value={topText}
							interactive={topEditable}
							defaultColor={tweetHighlightDefault}
							toolbarKind="tweetTopText"
							selected={selectedText === 'tweetTopText'}
							onTextSelect={onTextSelect}
							onHeadlineRangeSelect={onHeadlineRangeSelect}
							rows={1}
							minHeight="0px"
							{showToolbar}
							ariaLabel="Tweet text"
							fontFamily={(tweetStyles.tweetTopText?.fontFamily ?? headlineStyle.fontFamily) ?? "'Satoshi', system-ui, -apple-system, BlinkMacSystemFont, sans-serif"}
							fontSize={tweetStyles.tweetTopText?.fontSize ?? 42}
							onTextChange={onTopTextChange}
						>
							{#snippet display()}
								<p
									style="font-size:{tweetStyles.tweetTopText?.fontSize ?? 42}px; font-weight:400; color:{textPrimary}; line-height:1.4; margin:0; letter-spacing:-0.02em; word-break:break-word; flex-shrink: 0; {topTextCss}"
								>
									<HighlightedText
										text={topText}
										defaultColor={tweetHighlightDefault}
										parseHighlights={true}
									/>
								</p>
							{/snippet}
						</CanvasMarkupTextBlock>
					</div>
				{/snippet}
			</DraggableBlock>

			<!-- Attached image / video -->
			{#if topVideo || topImage || topImageEditable}
				<DraggableBlock
					dx={textOffsets.tweetTopImage?.x ?? 0}
					dy={textOffsets.tweetTopImage?.y ?? 0}
					{interactive}
					scale={dragScale}
					onChange={(x, y) => onTextOffsetChange?.('tweetTopImage', { x, y })}
				>
					{#snippet children()}
						<div
							data-tweet-media-frame
							style="border-radius:24px;overflow:hidden;margin:0 0 28px;border:1px solid {mediaBorder};flex-shrink:0;position:relative;height:{Math.max(180, Number(topImageHeight) || 360)}px;width:100%;max-width:100%;{mediaFrameOutline}"
							onclick={onTweetMediaFrameClick}
							onpointermove={moveTopImage}
							onpointerup={endTopImage}
							onpointercancel={endTopImage}
							role="presentation"
						>
							{#if topVideo}
								<div
									style="position:absolute;inset:0;overflow:hidden;touch-action:none;cursor:{interactive && mediaFrameSelected ? 'grab' : 'default'};"
									onpointerdown={(e) => {
										if (e.altKey) startTopImagePan(e);
									}}
									role="presentation"
								>
									<video
										src={topVideo}
										muted
										playsinline
										autoplay
										loop
										onloadedmetadata={onTopVideoLoaded}
										ontimeupdate={onTopVideoTimeUpdate}
										style="
											position:absolute;
											left:{Number(topImagePanX) || 50}%;
											top:{Number(topImagePanY) || 50}%;
											width:100%;
											height:100%;
											object-fit:cover;
											transform:translate(-50%,-50%) scale({Number(topImageZoom) || 1});
											will-change: transform;
											display:block;
											user-select:none;
											pointer-events:none;
										"
									></video>
								</div>
							{:else if topImage}
								<div
									style="position:absolute;inset:0;overflow:hidden;touch-action:none;cursor:{interactive && mediaFrameSelected ? 'grab' : 'default'};"
									onpointerdown={startTopImagePan}
									role="presentation"
								>
									<img
										src={topImage}
										alt=""
										style="
											position:absolute;
											left:{Number(topImagePanX) || 50}%;
											top:{Number(topImagePanY) || 50}%;
											width:100%;
											height:100%;
											object-fit:cover;
											transform:translate(-50%,-50%) scale({Number(topImageZoom) || 1});
											will-change: transform;
											display:block;
											user-select:none;
											pointer-events:none;
										"
									/>
								</div>
							{:else}
								<div
									style="width:100%;height:320px;background:{card2};display:flex;align-items:center;justify-content:center;color:{textSecondary};font-size:28px;cursor:{topImageEditable ? 'pointer' : 'default'};"
								>
									Add image
								</div>
							{/if}

							{#if topVideo && topImageEditable && onTopImagePanChange}
								<button
									type="button"
									style="position:absolute;left:12px;bottom:12px;z-index:3;width:40px;height:40px;border-radius:999px;border:1px solid rgba(255,255,255,0.22);background:rgba(0,0,0,0.55);color:#fff;display:flex;align-items:center;justify-content:center;cursor:grab;touch-action:none;pointer-events:auto;opacity:{mediaFrameSelected ? 1 : 0.85};"
									title="Drag to reposition video"
									aria-label="Drag to reposition video in frame"
									onpointerdown={(e) => {
										e.stopPropagation();
										onTextSelect?.(
											'tweetTopMedia',
											(e.currentTarget as HTMLElement).closest('[data-tweet-media-frame]') as HTMLElement ??
												(e.currentTarget as HTMLElement),
										);
										(e.currentTarget as HTMLButtonElement).style.cursor = 'grabbing';
										startTopVideoPanFromHandle(e);
									}}
									onpointerup={(e) => {
										(e.currentTarget as HTMLButtonElement).style.cursor = 'grab';
									}}
									onpointercancel={(e) => {
										(e.currentTarget as HTMLButtonElement).style.cursor = 'grab';
									}}
									onlostpointercapture={(e) => {
										(e.currentTarget as HTMLButtonElement).style.cursor = 'grab';
									}}
									onmousedown={(e) => e.preventDefault()}
								>
									<Move size={18} />
								</button>
							{/if}

							{#if topImageEditable && (topVideo || topImage || mediaFrameSelected)}
								<div
									style="position:absolute;right:10px;bottom:10px;z-index:3;width:{mediaFrameSelected || topVideo ? 28 : 22}px;height:{mediaFrameSelected || topVideo ? 28 : 22}px;border-radius:8px;background:{mediaFrameSelected ? 'rgba(99,158,255,0.95)' : 'rgba(0,0,0,0.55)'};border:1.5px solid rgba(255,255,255,{mediaFrameSelected ? 0.95 : 0.35});display:flex;align-items:center;justify-content:center;cursor:nwse-resize;pointer-events:auto;touch-action:none;opacity:{topVideo || mediaFrameSelected ? 1 : 0.9};"
									onpointerdown={(e) => {
										e.stopPropagation();
										onTextSelect?.(
											'tweetTopMedia',
											(e.currentTarget as HTMLElement).closest('[data-tweet-media-frame]') as HTMLElement ??
												(e.currentTarget as HTMLElement),
										);
										startTopImageResize(e);
									}}
									title="Drag to resize frame"
									role="button"
									tabindex="0"
									aria-label="Resize media frame"
								>
									<div style="width:11px;height:11px;border-right:2.5px solid rgba(255,255,255,0.95);border-bottom:2.5px solid rgba(255,255,255,0.95);transform:translate(1px,1px);"></div>
								</div>
							{/if}
						</div>
					{/snippet}
				</DraggableBlock>
			{/if}

			<!-- Engagement row -->
			<div
				style="
					display:flex;
					align-items:center;
					gap:36px;
					padding-top:4px;
					border-top:1px solid {divider};
					margin-top:4px;
					flex-shrink:0;
				"
			>
				{#each [
					{ label: 'Replies', value: replyCount, kind: 'tweetReplyCount' as const, onChange: onReplyCountChange },
					{ label: 'Reposts', value: repostCount, kind: 'tweetRepostCount' as const, onChange: onRepostCountChange },
					{ label: 'Likes', value: likeCount, kind: 'tweetLikeCount' as const, onChange: onLikeCountChange },
				] as metric}
					<div style="display:flex;align-items:baseline;gap:8px;min-width:0;">
						{#if metric.onChange && interactive}
							<CanvasMarkupTextBlock
								value={metric.value}
								interactive={true}
								defaultColor={tweetHighlightDefault}
								toolbarKind={metric.kind}
								selected={selectedText === metric.kind}
								onTextSelect={onTextSelect}
								onHeadlineRangeSelect={onHeadlineRangeSelect}
								rows={1}
								minHeight="0px"
								{showToolbar}
								ariaLabel={metric.label}
								fontFamily="'Satoshi', system-ui, sans-serif"
								fontSize={26}
								onTextChange={metric.onChange}
							>
								{#snippet display()}
									<span style="font-size:26px;font-weight:700;color:{textPrimary};letter-spacing:-0.02em;line-height:1.2;">{metric.value}</span>
								{/snippet}
							</CanvasMarkupTextBlock>
						{:else}
							<span style="font-size:26px;font-weight:700;color:{textPrimary};letter-spacing:-0.02em;line-height:1.2;">{metric.value}</span>
						{/if}
						<span style="font-size:24px;font-weight:400;color:{textSecondary};line-height:1.2;">{metric.label}</span>
					</div>
				{/each}
			</div>

			{#if showReply}
			<!-- Reply: author row — avatar / name / handle independent -->
			<div style="height:1px;background:{divider};margin:36px 0 28px;width:100%;flex-shrink:0;"></div>
			<div style="display:flex;align-items:flex-start;gap:24px;margin:0 0 18px;width:100%;">
				<DraggableBlock
					dx={textOffsets.tweetBottomAvatar?.x ?? textOffsets.tweetBottomProfile?.x ?? 0}
					dy={textOffsets.tweetBottomAvatar?.y ?? textOffsets.tweetBottomProfile?.y ?? 0}
					{interactive}
					scale={dragScale}
					immediateTextDrag={true}
					onChange={(x, y) => onTextOffsetChange?.('tweetBottomAvatar', { x, y })}
				>
					{#snippet children()}
						<div
							role="button"
							tabindex="0"
							data-draggable-no-pan
							data-text-selectable="tweetBottomAvatar"
							style="
								width:{72 + bottomRingW * 2}px;height:{72 + bottomRingW * 2}px;border-radius:50%;flex-shrink:0;
								display:flex;align-items:center;justify-content:center;
								padding:{bottomRingW}px;box-sizing:border-box;
								background:{bottomRingW > 0
									? `linear-gradient(135deg, ${bottomRingCol}, color-mix(in srgb, ${bottomRingCol} 60%, white))`
									: 'transparent'};
								cursor:{interactive ? 'grab' : 'default'};
								outline:none;
								{bottomAvatarSelected ? 'box-shadow: 0 0 0 3px rgba(139, 92, 246, 0.75);' : ''}
							"
							onclick={onBottomAvatarClick}
							onkeydown={(e) => {
								if (!interactive || !onTextSelect) return;
								if (e.key === 'Enter' || e.key === ' ') {
									e.preventDefault();
									onTextSelect('tweetBottomAvatar', e.currentTarget as HTMLElement);
								}
							}}
						>
							<div
								style="
									width:100%;height:100%;border-radius:50%;overflow:hidden;
									background:{bottomInnerDiscBg};
									display:flex;align-items:center;justify-content:center;
									pointer-events:none;
								"
							>
								{#if bottomAvatar?.trim()}
									<img src={bottomAvatar} alt="" style="width:100%;height:100%;object-fit:cover;display:block;" />
								{:else}
									<span style="color:{bottomDiscInk()};font-size:26px;font-weight:700;">{bottomDiscText}</span>
								{/if}
							</div>
						</div>
					{/snippet}
				</DraggableBlock>

				<div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:6px;align-items:flex-start;">
					<div style="display:flex;align-items:center;gap:8px;max-width:100%;">
						<DraggableBlock
							dx={textOffsets.tweetBottomName?.x ?? textOffsets.tweetBottomProfile?.x ?? 0}
							dy={textOffsets.tweetBottomName?.y ?? textOffsets.tweetBottomProfile?.y ?? 0}
							{interactive}
							scale={dragScale}
							holdDragFromText={!!bottomNameEditable}
							immediateTextDrag={selectedText === 'tweetBottomName'}
							holdMs={300}
							onChange={(x, y) => onTextOffsetChange?.('tweetBottomName', { x, y })}
						>
							{#snippet children()}
								<CanvasMarkupTextBlock
									value={bottomName}
									interactive={bottomNameEditable}
									defaultColor={tweetHighlightDefault}
									toolbarKind="tweetBottomName"
									selected={selectedText === 'tweetBottomName'}
									onTextSelect={onTextSelect}
									onHeadlineRangeSelect={onHeadlineRangeSelect}
									rows={1}
									minHeight="0px"
									{showToolbar}
									ariaLabel="Bottom name"
									fontFamily="'Satoshi', system-ui, -apple-system, BlinkMacSystemFont, sans-serif"
									fontSize={tweetStyles.tweetBottomName?.fontSize ?? 34}
									onTextChange={onBottomNameChange}
								>
									{#snippet display()}
										<p style="margin:0;font-size:{tweetStyles.tweetBottomName?.fontSize ?? 34}px;font-weight:700;color:{textPrimary};letter-spacing:-0.02em;line-height:1.2; {bottomNameCss}">{bottomNameDisplay}</p>
									{/snippet}
								</CanvasMarkupTextBlock>
							{/snippet}
						</DraggableBlock>
						{#if bottomVerified}
							<svg width="22" height="22" viewBox="0 0 24 24" fill="none" style="flex-shrink:0;" aria-hidden="true">
								<circle cx="12" cy="12" r="12" fill="#1D9BF0" />
								<path d="M9.5 16.5l-3-3 1.4-1.4 1.6 1.6 5.1-5.1 1.4 1.4z" fill="white" />
							</svg>
						{/if}
					</div>
					<DraggableBlock
						dx={textOffsets.tweetBottomHandle?.x ?? textOffsets.tweetBottomProfile?.x ?? 0}
						dy={textOffsets.tweetBottomHandle?.y ?? textOffsets.tweetBottomProfile?.y ?? 0}
						{interactive}
						scale={dragScale}
						holdDragFromText={!!bottomHandleEditable}
						immediateTextDrag={selectedText === 'tweetBottomHandle'}
						holdMs={300}
						onChange={(x, y) => onTextOffsetChange?.('tweetBottomHandle', { x, y })}
					>
						{#snippet children()}
							<CanvasMarkupTextBlock
								value={bottomHandle}
								interactive={bottomHandleEditable}
								defaultColor={tweetHighlightDefault}
								toolbarKind="tweetBottomHandle"
								selected={selectedText === 'tweetBottomHandle'}
								onTextSelect={onTextSelect}
								onHeadlineRangeSelect={onHeadlineRangeSelect}
								rows={1}
								minHeight="0px"
								{showToolbar}
								ariaLabel="Bottom handle"
								fontFamily="'Satoshi', system-ui, -apple-system, BlinkMacSystemFont, sans-serif"
								fontSize={tweetStyles.tweetBottomHandle?.fontSize ?? 26}
								onTextChange={onBottomHandleChange}
							>
								{#snippet display()}
									<p style="margin:0;font-size:{tweetStyles.tweetBottomHandle?.fontSize ?? 26}px;color:{textSecondary};font-weight:400;line-height:1.25; {bottomHandleCss}">{bottomHandleDisplay}</p>
								{/snippet}
							</CanvasMarkupTextBlock>
						{/snippet}
					</DraggableBlock>
				</div>
			</div>

			<!-- Reply text -->
			<DraggableBlock
				dx={textOffsets.tweetBottomText?.x ?? 0}
				dy={textOffsets.tweetBottomText?.y ?? 0}
				{interactive}
				scale={dragScale}
				holdDragFromText={!!bottomEditable}
				immediateTextDrag={selectedText === 'tweetBottomText'}
				holdMs={300}
				onChange={(x, y) => onTextOffsetChange?.('tweetBottomText', { x, y })}
			>
				{#snippet children()}
					<CanvasMarkupTextBlock
						value={bottomText.trim() ? bottomText : TWEET_DEFAULTS.bottomText}
						interactive={bottomEditable}
						defaultColor={tweetHighlightDefault}
						toolbarKind="tweetBottomText"
						selected={selectedText === 'tweetBottomText'}
						onTextSelect={onTextSelect}
						onHeadlineRangeSelect={onHeadlineRangeSelect}
						rows={1}
						minHeight="0px"
						{showToolbar}
						ariaLabel="Reply text"
						fontFamily={headlineStyle.fontFamily ?? "'Satoshi', system-ui, -apple-system, BlinkMacSystemFont, sans-serif"}
						fontSize={tweetStyles.tweetBottomText?.fontSize ?? headlineStyle.fontSize ?? 40}
						onTextChange={onBottomTextChange}
					>
						{#snippet display()}
							<p
								style="font-size:{tweetStyles.tweetBottomText?.fontSize ?? headlineStyle.fontSize ?? 40}px; font-weight:400; color:{textPrimary}; line-height:1.4; margin:0; letter-spacing:-0.02em; word-break:break-word; {bottomTextCss}"
							>
								<HighlightedText
									text={bottomText}
									defaultColor={tweetHighlightDefault}
									parseHighlights={true}
								/>
							</p>
						{/snippet}
					</CanvasMarkupTextBlock>
				{/snippet}
			</DraggableBlock>
			{/if}

			<!-- X watermark -->
			<div style="
				position:absolute;bottom:36px;right:72px;
				font-size:22px;font-weight:600;color:{textSecondary};opacity:0.28;
				letter-spacing:0;font-family:inherit;
			">𝕏</div>
		</div>
	</div>
</div>
