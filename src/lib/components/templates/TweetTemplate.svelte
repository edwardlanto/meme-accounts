<script lang="ts">
import HighlightedText from '$lib/components/HighlightedText.svelte';
import CanvasMarkupTextBlock from '$lib/components/CanvasMarkupTextBlock.svelte';
import DraggableBlock from '$lib/components/DraggableBlock.svelte';
import type { TextElementKind, TextStyle } from '$lib/types';
import { Image as ImageIcon, Minus, Move, Plus, Trash2 } from 'lucide-svelte';

interface TweetProps {
	// Top tweet
	topName?: string;
	topHandle?: string;
	topAvatar?: string;
	topVerified?: boolean;
	topText?: string;
	topImage?: string;
	topVideo?: string;
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
	bottomVerified?: boolean;
	bottomText?: string;
	// Engagement
	replyCount?: string;
	repostCount?: string;
	likeCount?: string;
	// Style
	templateTheme?: 'light' | 'dark';
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
}

let {
	topName      = 'Chef 👨‍🍳',
	topHandle    = '@chefsevenn',
	topAvatar    = '',
	topVerified  = true,
	topText      = 'Ketchup or mayo or mustard?',
	topImage     = '/templates/tweet/demo-bg.jpg',
	topVideo     = '',
	topImageHeight = 720,
	topImageWidth = 920,
	topImageZoom = 1,
	topImagePanX = 50,
	topImagePanY = 50,
	bottomName   = 'Mo Mohler',
	bottomHandle = '@MoMohler',
	bottomAvatar = '',
	bottomVerified = true,
	bottomText   = '3 straight misses chef. These appear to be French fries.',
	replyCount = '4.2K',
	repostCount = '12.8K',
	likeCount = '89.4K',
	templateTheme = 'light',
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
}: TweetProps = $props();

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

	function bumpTopMediaZoom(delta: number) {
		const z = Number(topImageZoom) || 1;
		setTopImageZoom(z + delta);
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
		if (topImageResizing || topImagePanning) e.stopPropagation();
		topImageResizing = false;
		topImagePanning = false;
		topImageStart = null;
	}

	function onTopImageWheel(e: WheelEvent) {
		if (!interactive) return;
		// Alt/Option wheel to zoom inside the frame.
		if (!e.altKey) return;
		e.preventDefault();
		const z = Number(topImageZoom) || 1;
		const next = z + (e.deltaY > 0 ? -0.08 : 0.08);
		setTopImageZoom(next);
	}

	let topImageHovering = $state(false);
	let topImageFileEl = $state<HTMLInputElement | null>(null);

	// Keep these small for fast editing/preview; export can still upscale if needed.
	const MAX_IMAGE_DIM = 1600; // px
	const IMAGE_QUALITY = 0.82;

	async function compressImageToBlob(file: File): Promise<Blob> {
		// decode() is significantly faster than drawing raw <img> in many cases
		const bmp = await createImageBitmap(file);
		const srcW = bmp.width;
		const srcH = bmp.height;
		const scale = Math.min(1, MAX_IMAGE_DIM / Math.max(srcW, srcH));
		const w = Math.max(1, Math.round(srcW * scale));
		const h = Math.max(1, Math.round(srcH * scale));

		const canvas = document.createElement('canvas');
		canvas.width = w;
		canvas.height = h;
		const ctx = canvas.getContext('2d');
		if (!ctx) {
			bmp.close();
			return file;
		}
		ctx.imageSmoothingEnabled = true;
		ctx.imageSmoothingQuality = 'high';
		ctx.drawImage(bmp, 0, 0, w, h);
		bmp.close();

		const type = file.type === 'image/png' ? 'image/webp' : 'image/webp';
		const blob: Blob = await new Promise((resolve) =>
			canvas.toBlob((b) => resolve(b ?? file), type, IMAGE_QUALITY),
		);
		return blob;
	}

	function openTopImagePicker(e: MouseEvent) {
		e.stopPropagation();
		if (!topImageEditable && !topVideoEditable) return;
		topImageFileEl?.click();
	}

	function removeTopImage(e: MouseEvent) {
		e.stopPropagation();
		if (!topImageEditable && !topVideoEditable) return;
		onTopImageChange?.('');
		onTopVideoChange?.('');
	}

	function onTopImageFile(e: Event) {
		if (!topImageEditable && !topVideoEditable) return;
		const file = (e.target as HTMLInputElement).files?.[0];
		if (!file) return;
		(e.target as HTMLInputElement).value = '';

		const extOk = /\.(mp4|mov|webm|m4v|mkv|avi)$/i.test(file.name ?? '');
		const isVideo =
			file.type.startsWith('video/') ||
			file.type === 'application/mp4' ||
			(file.type === 'application/octet-stream' && extOk) ||
			extOk;
		if (isVideo) {
			const url = URL.createObjectURL(file);
			onTopVideoChange?.(url);
			return;
		}

		// 1) Instant preview (no base64).
		const quickUrl = URL.createObjectURL(file);
		onTopImageChange?.(quickUrl);
		onTopVideoChange?.('');

		// 2) Compress in background, then swap in a smaller blob URL.
		(async () => {
			try {
				const blob = await compressImageToBlob(file);
				const smallUrl = URL.createObjectURL(blob);
				onTopImageChange?.(smallUrl);
				// Studio revokes the previous blob when it replaces it, but revoke here too
				// in case this template is used outside Studio.
				if (quickUrl.startsWith('blob:')) URL.revokeObjectURL(quickUrl);
			} catch {
				// Keep quick preview on failure.
			}
		})();
	}
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
		if (s.fontFamily) bits.push(`font-family: '${s.fontFamily}', 'Lexend', system-ui, sans-serif;`);
		if (s.fontSize) bits.push(`font-size: ${s.fontSize}px;`);
		if (s.fontWeight != null) bits.push(`font-weight: ${s.fontWeight};`);
		if (s.italic) bits.push('font-style: italic;');
		if (s.underline) bits.push('text-decoration: underline;');
		if (s.color) bits.push(`color: ${s.color};`);
		if (s.letterSpacing != null) bits.push(`letter-spacing: ${s.letterSpacing}em;`);
		if (s.lineHeight != null) bits.push(`line-height: ${s.lineHeight};`);
		if (s.align) bits.push(`text-align: ${s.align};`);
		return bits.join(' ');
	}

	const topNameCss = $derived(styleCss(tweetStyles.tweetTopName ?? {}));
	const topHandleCss = $derived(styleCss(tweetStyles.tweetTopHandle ?? {}));
	const topTextCss = $derived(styleCss(tweetStyles.tweetTopText ?? {}));
	const bottomNameCss = $derived(styleCss(tweetStyles.tweetBottomName ?? {}));
	const bottomHandleCss = $derived(styleCss(tweetStyles.tweetBottomHandle ?? {}));
	const bottomTextCss = $derived(styleCss(tweetStyles.tweetBottomText ?? {}));
	const W = 1080;
	const H = 1350;

	/** Initials fallback for missing avatar */
	function initials(name: string) {
		return name.replace(/[^\w\s]/g, '').trim().split(/\s+/).map(w => w[0]?.toUpperCase() ?? '').slice(0, 2).join('');
	}

	/** Simple hash → hue for coloured initials placeholder */
	function nameHue(name: string) {
		let h = 0;
		for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffffffff;
		return Math.abs(h) % 360;
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
	<!-- Inner at 1080×1350 — full bleed, no card wrapper -->
	<div
		bind:this={exportRef}
		style="
			width: {W}px;
			height: {H}px;
			position: relative;
			background: {card};
			transform: scale({scale});
			transform-origin: top left;
			font-family: 'Lexend', system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
			display: flex;
			flex-direction: column;
			box-sizing: border-box;
			overflow: hidden;
			padding: 56px 72px 72px;
		"
	>
			<!-- OP: avatar + name + badge + handle (classic tweet header) -->
			<DraggableBlock
				dx={textOffsets.tweetTopProfile?.x ?? 0}
				dy={textOffsets.tweetTopProfile?.y ?? 0}
				{interactive}
				{scale}
				onChange={(x, y) => onTextOffsetChange?.('tweetTopProfile', { x, y })}
			>
				{#snippet children()}
					<div style="display:flex;align-items:flex-start;gap:16px;margin:0 0 20px;">
						<div
							style="
								width:72px;height:72px;border-radius:50%;flex-shrink:0;overflow:hidden;
								{topAvatar ? '' : `background: hsl(${nameHue(topName)}, 60%, 50%);`}
								display:flex;align-items:center;justify-content:center;
							"
						>
							{#if topAvatar}
								<img src={topAvatar} alt="" style="width:100%;height:100%;object-fit:cover;" />
							{:else}
								<span style="color:#fff;font-size:26px;font-weight:700;letter-spacing:-0.5px;">{initials(topName)}</span>
							{/if}
						</div>
						<div style="flex:1;min-width:0;padding-top:2px;">
							<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
								<CanvasMarkupTextBlock
									value={topName}
									interactive={topNameEditable}
									defaultColor={tweetHighlightDefault}
									toolbarKind="tweetTopName"
									selected={selectedText === 'tweetTopName'}
									onTextSelect={onTextSelect}
									onHeadlineRangeSelect={onHeadlineRangeSelect}
									rows={1}
									{showToolbar}
									ariaLabel="Top name"
									fontFamily="'Lexend', system-ui, -apple-system, BlinkMacSystemFont, sans-serif"
									fontSize={tweetStyles.tweetTopName?.fontSize ?? 38}
									onTextChange={onTopNameChange}
								>
									{#snippet display()}
										<span style="font-size:38px;font-weight:800;color:{textPrimary};letter-spacing:-0.35px;line-height:1.15; {topNameCss}">{topName}</span>
									{/snippet}
								</CanvasMarkupTextBlock>
								{#if topVerified}
									<svg width="22" height="22" viewBox="0 0 24 24" fill="none" style="flex-shrink:0;margin-top:1px;">
										<circle cx="12" cy="12" r="12" fill="#1D9BF0" />
										<path d="M9.5 16.5l-3-3 1.4-1.4 1.6 1.6 5.1-5.1 1.4 1.4z" fill="white" />
									</svg>
								{/if}
							</div>
							<CanvasMarkupTextBlock
								value={topHandle}
								interactive={topHandleEditable}
								defaultColor={tweetHighlightDefault}
								toolbarKind="tweetTopHandle"
								selected={selectedText === 'tweetTopHandle'}
								onTextSelect={onTextSelect}
								onHeadlineRangeSelect={onHeadlineRangeSelect}
								rows={1}
								{showToolbar}
								ariaLabel="Top handle"
								fontFamily="'Lexend', system-ui, -apple-system, BlinkMacSystemFont, sans-serif"
								fontSize={tweetStyles.tweetTopHandle?.fontSize ?? 30}
								onTextChange={onTopHandleChange}
							>
								{#snippet display()}
									<span style="font-size:30px;color:{textSecondary};font-weight:400;line-height:1.25; {topHandleCss}">{topHandle}</span>
								{/snippet}
							</CanvasMarkupTextBlock>
						</div>
					</div>
				{/snippet}
			</DraggableBlock>

			<!-- Tweet body -->
			<DraggableBlock
				dx={textOffsets.tweetTopText?.x ?? 0}
				dy={textOffsets.tweetTopText?.y ?? 0}
				{interactive}
				{scale}
				onChange={(x, y) => onTextOffsetChange?.('tweetTopText', { x, y })}
			>
				{#snippet children()}
					<div style="margin: 0 0 22px;">
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
					fontFamily={(tweetStyles.tweetTopText?.fontFamily ?? headlineStyle.fontFamily) ?? "'Lexend', system-ui, -apple-system, BlinkMacSystemFont, sans-serif"}
					fontSize={tweetStyles.tweetTopText?.fontSize ?? 44}
					onTextChange={onTopTextChange}
				>
					{#snippet display()}
						<HighlightedText
							as="p"
							text={topText}
							defaultColor={tweetHighlightDefault}
							style="font-size:44px; font-weight:400; color:{textPrimary}; line-height:1.38; margin:0; letter-spacing:-0.25px; word-break:break-word; flex-shrink: 0; {topTextCss}"
						/>
					{/snippet}
				</CanvasMarkupTextBlock>
					</div>
				{/snippet}
			</DraggableBlock>

			<!-- Attached image -->
			{#if topImage || topImageEditable}
				<input
					bind:this={topImageFileEl}
					type="file"
					accept="image/*,video/*"
					style="display:none"
					onchange={onTopImageFile}
				/>
				<DraggableBlock
					dx={textOffsets.tweetTopImage?.x ?? 0}
					dy={textOffsets.tweetTopImage?.y ?? 0}
					{interactive}
					{scale}
					onChange={(x, y) => onTextOffsetChange?.('tweetTopImage', { x, y })}
				>
					{#snippet children()}
						<div
style="border-radius:16px;overflow:hidden;margin:0 0 40px;border:1px solid {mediaBorder};flex-shrink:0;position:relative;height:{Math.max(180, Number(topImageHeight) || 360)}px;width:{clamp(Number(topImageWidth) || 920, 520, 920)}px;max-width:100%;"
							onmouseenter={() => (topImageHovering = true)}
							onmouseleave={() => {
								if (!topImagePanning && !topImageResizing) topImageHovering = false;
							}}
onpointermove={moveTopImage}
onpointerup={endTopImage}
onpointercancel={endTopImage}
onwheel={onTopImageWheel}
							role="presentation"
						>
{#if topVideo}
								<div
									style="position:absolute;inset:0;overflow:hidden;touch-action:none;cursor:{interactive && topImageHovering && !topVideo ? 'grab' : 'default'};"
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
									style="position:absolute;inset:0;overflow:hidden;touch-action:none;cursor:{interactive && topImageHovering ? 'grab' : 'default'};"
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
								<div style="width:100%;height:320px;background:{card2};display:flex;align-items:center;justify-content:center;color:{textSecondary};font-size:28px;">
									Add image
								</div>

							{/if}

							{#if topImageEditable && topImageHovering}
								<div style="position:absolute;inset:0;background:linear-gradient(to bottom, rgba(0,0,0,0.0), rgba(0,0,0,0.25));pointer-events:none;"></div>
								<div style="position:absolute;top:14px;right:14px;display:flex;gap:10px;pointer-events:auto;">
									<button
										type="button"
										onclick={openTopImagePicker}
										onmousedown={(e) => e.preventDefault()}
										style="width:44px;height:44px;border-radius:999px;border:2px solid rgba(255,255,255,0.25);background:rgba(0,0,0,0.70);color:#fff;display:flex;align-items:center;justify-content:center;cursor:pointer;"
										title="Upload media (image/video)"
										aria-label="Upload media"
									><ImageIcon size={18} /></button>
									{#if topImage || topVideo}
										<button
											type="button"
											onclick={removeTopImage}
											onmousedown={(e) => e.preventDefault()}
											style="width:44px;height:44px;border-radius:999px;border:2px solid rgba(255,255,255,0.25);background:rgba(0,0,0,0.70);color:#fff;display:flex;align-items:center;justify-content:center;cursor:pointer;"
											title="Remove media"
											aria-label="Remove media"
										><Trash2 size={18} /></button>
									{/if}
								</div>
								<div style="position:absolute;left:14px;bottom:14px;display:flex;align-items:center;gap:8px;pointer-events:none;">
									{#if topVideo && onTopImagePanChange}
										<button
											type="button"
											style="pointer-events:auto;width:44px;height:44px;border-radius:999px;border:2px solid rgba(255,255,255,0.25);background:rgba(0,0,0,0.70);color:#fff;display:flex;align-items:center;justify-content:center;cursor:grab;touch-action:none;"
											title="Drag to reposition video in frame"
											aria-label="Drag to reposition video in frame"
											onpointerdown={(e) => {
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
									{#if (topVideo || topImage) && onTopImageZoomChange}
										<div
											style="display:flex;flex-direction:column;gap:3px;pointer-events:auto;"
											role="group"
											aria-label="Zoom media in frame"
										>
											<button
												type="button"
												style="width:36px;height:36px;border-radius:10px;border:2px solid rgba(255,255,255,0.22);background:rgba(0,0,0,0.72);color:#fff;display:flex;align-items:center;justify-content:center;cursor:pointer;opacity:{(Number(topImageZoom) || 1) >= MEDIA_ZOOM_MAX - 0.02 ? 0.35 : 1};"
												disabled={(Number(topImageZoom) || 1) >= MEDIA_ZOOM_MAX - 0.02}
												title="Zoom in (expand crop)"
												aria-label="Zoom in"
												onclick={(e) => {
													e.stopPropagation();
													bumpTopMediaZoom(0.12);
												}}
												onmousedown={(e) => e.preventDefault()}
											>
												<Plus size={16} strokeWidth={2.5} />
											</button>
											<button
												type="button"
												style="width:36px;height:36px;border-radius:10px;border:2px solid rgba(255,255,255,0.22);background:rgba(0,0,0,0.72);color:#fff;display:flex;align-items:center;justify-content:center;cursor:pointer;opacity:{(Number(topImageZoom) || 1) <= MEDIA_ZOOM_MIN + 0.02 ? 0.35 : 1};"
												disabled={(Number(topImageZoom) || 1) <= MEDIA_ZOOM_MIN + 0.02}
												title="Zoom out"
												aria-label="Zoom out"
												onclick={(e) => {
													e.stopPropagation();
													bumpTopMediaZoom(-0.12);
												}}
												onmousedown={(e) => e.preventDefault()}
											>
												<Minus size={16} strokeWidth={2.5} />
											</button>
										</div>
									{/if}
									<div style="font-size:11px;color:rgba(255,255,255,0.75);background:rgba(0,0,0,0.55);border:1px solid rgba(255,255,255,0.14);padding:6px 8px;border-radius:999px;">
										{#if topVideo}
											Move icon: pan · ±: zoom · Alt+wheel · Alt+drag
										{:else}
											Corner: resize · ±: zoom · Alt+wheel · Alt+drag
										{/if}
									</div>
								</div>
								<div
									style="position:absolute;right:12px;bottom:12px;width:18px;height:18px;border-radius:6px;background:rgba(255,255,255,0.14);border:1px solid rgba(255,255,255,0.18);display:flex;align-items:center;justify-content:center;cursor:nwse-resize;pointer-events:auto;"
									onpointerdown={startTopImageResize}
									title="Drag to resize"
									role="button"
									tabindex="0"
									aria-label="Resize image"
								>
									<div style="width:10px;height:10px;border-right:2px solid rgba(255,255,255,0.7);border-bottom:2px solid rgba(255,255,255,0.7);transform:translate(1px,1px);"></div>
								</div>
							{/if}
						</div>
					{/snippet}
				</DraggableBlock>
			{/if}

			<!-- Reply: author row (directly under media, same canvas) -->
			<DraggableBlock
				dx={textOffsets.tweetBottomProfile?.x ?? 0}
				dy={textOffsets.tweetBottomProfile?.y ?? 0}
				{interactive}
				{scale}
				onChange={(x, y) => onTextOffsetChange?.('tweetBottomProfile', { x, y })}
			>
				{#snippet children()}
					<div style="display:flex;align-items:flex-start;gap:16px;margin:8px 0 14px;">
						<div
							style="
								width:72px;height:72px;border-radius:50%;flex-shrink:0;overflow:hidden;
								{bottomAvatar ? '' : `background:hsl(${nameHue(bottomName)},60%,45%);`}
								display:flex;align-items:center;justify-content:center;
							"
						>
							{#if bottomAvatar}
								<img src={bottomAvatar} alt="" style="width:100%;height:100%;object-fit:cover;" />
							{:else}
								<span style="color:#fff;font-size:26px;font-weight:700;">{initials(bottomName)}</span>
							{/if}
						</div>
						<div style="flex:1;min-width:0;padding-top:2px;">
							<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
								<CanvasMarkupTextBlock
									value={bottomName}
									interactive={bottomNameEditable}
									defaultColor={tweetHighlightDefault}
									toolbarKind="tweetBottomName"
									selected={selectedText === 'tweetBottomName'}
									onTextSelect={onTextSelect}
									onHeadlineRangeSelect={onHeadlineRangeSelect}
									rows={1}
									{showToolbar}
									ariaLabel="Bottom name"
							fontFamily="'Lexend', system-ui, -apple-system, BlinkMacSystemFont, sans-serif"
									fontSize={tweetStyles.tweetBottomName?.fontSize ?? 38}
									onTextChange={onBottomNameChange}
								>
									{#snippet display()}
										<span style="font-size:38px;font-weight:800;color:{textPrimary};letter-spacing:-0.35px;line-height:1.15; {bottomNameCss}">{bottomName}</span>
									{/snippet}
								</CanvasMarkupTextBlock>
								{#if bottomVerified}
									<svg width="22" height="22" viewBox="0 0 24 24" fill="none" style="flex-shrink:0;margin-top:1px;">
										<circle cx="12" cy="12" r="12" fill="#1D9BF0" />
										<path d="M9.5 16.5l-3-3 1.4-1.4 1.6 1.6 5.1-5.1 1.4 1.4z" fill="white" />
									</svg>
								{/if}
							</div>
							<CanvasMarkupTextBlock
								value={bottomHandle}
								interactive={bottomHandleEditable}
								defaultColor={tweetHighlightDefault}
								toolbarKind="tweetBottomHandle"
								selected={selectedText === 'tweetBottomHandle'}
								onTextSelect={onTextSelect}
								onHeadlineRangeSelect={onHeadlineRangeSelect}
								rows={1}
								{showToolbar}
								ariaLabel="Bottom handle"
						fontFamily="'Lexend', system-ui, -apple-system, BlinkMacSystemFont, sans-serif"
								fontSize={tweetStyles.tweetBottomHandle?.fontSize ?? 30}
								onTextChange={onBottomHandleChange}
							>
								{#snippet display()}
									<span style="font-size:30px;color:{textSecondary};font-weight:400;line-height:1.25; {bottomHandleCss}">{bottomHandle}</span>
								{/snippet}
							</CanvasMarkupTextBlock>
						</div>
					</div>
				{/snippet}
			</DraggableBlock>

			<!-- Reply text -->
			<DraggableBlock
				dx={textOffsets.tweetBottomText?.x ?? 0}
				dy={textOffsets.tweetBottomText?.y ?? 0}
				{interactive}
				{scale}
				onChange={(x, y) => onTextOffsetChange?.('tweetBottomText', { x, y })}
			>
				{#snippet children()}
					<CanvasMarkupTextBlock
						value={bottomText}
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
						fontFamily={headlineStyle.fontFamily ?? "'Lexend', system-ui, -apple-system, BlinkMacSystemFont, sans-serif"}
						fontSize={tweetStyles.tweetBottomText?.fontSize ?? headlineStyle.fontSize ?? 44}
						onTextChange={onBottomTextChange}
					>
						{#snippet display()}
							<HighlightedText
								as="p"
								text={bottomText}
								defaultColor={tweetHighlightDefault}
								style="font-size:44px; font-weight:400; color:{textPrimary}; line-height:1.38; margin:0; letter-spacing:-0.25px; word-break:break-word; {bottomTextCss}"
							/>
						{/snippet}
					</CanvasMarkupTextBlock>
				{/snippet}
			</DraggableBlock>

			<div style="flex:1;min-height:0;"></div>

			<!-- X watermark -->
			<div style="
				position:absolute;bottom:32px;right:64px;
				font-size:22px;font-weight:600;color:{textSecondary};opacity:0.28;
				letter-spacing:0;font-family:inherit;
			">𝕏</div>
	</div>
</div>
