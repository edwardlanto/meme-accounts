<script lang="ts">
	import HighlightedText from '$lib/components/HighlightedText.svelte';
	import CanvasMarkupTextBlock from '$lib/components/CanvasMarkupTextBlock.svelte';
	import DraggableBlock from '$lib/components/DraggableBlock.svelte';
	import type { TextElementKind, TextStyle } from '$lib/types';
	import { appendTextShadowCss } from '$lib/textStyleCss';
	import { stripMarkup } from '$lib/highlight';
	import {
		VIDEO_CREATOR_DEFAULTS,
		VIDEO_FEATURE_DEFAULTS,
		VIDEO_POST_DEFAULTS,
		VIDEO_STORY_DEFAULTS,
	} from '$lib/studio/slide-content-defaults';

	interface Props {
		headline?: string;
		watermark?: string;
		/** Feature-card body under the headline */
		body?: string;
		/** Creator-hook profile */
		profileName?: string;
		profileHandle?: string;
		profileAvatar?: string;
		videoSrc?: string;
		/** When `videoSrc` is empty, show this image instead of the template placeholder clip. */
		videoPoster?: string;
		w?: number;
		h?: number;
		scale?: number;
		interactive?: boolean;
		exportRef?: HTMLElement | null;
		selectedText?: TextElementKind | null;
		highlightColor?: string;
		headlineStyle?: TextStyle;
		watermarkStyle?: TextStyle;
		bodyStyle?: TextStyle;
		onHeadlineChange?: (v: string) => void;
		onWatermarkChange?: (v: string) => void;
		onBodyChange?: (v: string) => void;
		onProfileNameChange?: (v: string) => void;
		onProfileHandleChange?: (v: string) => void;
		onTextSelect?: (kind: TextElementKind, el: HTMLElement) => void;
		onHeadlineRangeSelect?: (start: number, end: number) => void;
		textOffsets?: Record<string, { x: number; y: number }>;
		onTextOffsetChange?: (kind: string, next: { x: number; y: number }) => void;
		showToolbar?: boolean;
		/** Studio preview: sync with floating dock mute/volume/trim */
		videoMuted?: boolean;
		videoVolume?: number;
		videoSeekSec?: number;
		videoTrimStartSec?: number;
		videoTrimEndSec?: number;
		onVideoDuration?: (durationSec: number) => void;
		/** Tighter layout for dashboard clip previews */
		previewMode?: boolean;
		/** Visual layout — story / fit / blur / hook / creator / text / source / feature / post */
		layout?: 'story' | 'fit' | 'blur' | 'hook' | 'creator' | 'text' | 'source' | 'feature' | 'post';
		/** Double-click video/media frame to open BG tools. */
		onBackgroundDblClick?: (detail: { clientX: number; clientY: number }) => void;
	}

	let {
		headline = VIDEO_STORY_DEFAULTS.headline,
		watermark = VIDEO_STORY_DEFAULTS.watermark,
		body = VIDEO_FEATURE_DEFAULTS.body,
		profileName = VIDEO_CREATOR_DEFAULTS.name,
		profileHandle = VIDEO_CREATOR_DEFAULTS.handle,
		profileAvatar = '',
		videoSrc = '',
		videoPoster = '',
		w = 1080,
		h = 1920,
		scale = 1,
		interactive = true,
		exportRef = $bindable(null),
		selectedText = null,
		highlightColor = '#F5A623',
		headlineStyle = {},
		watermarkStyle = {},
		bodyStyle = {},
		onHeadlineChange,
		onWatermarkChange,
		onBodyChange,
		onProfileNameChange,
		onProfileHandleChange,
		onTextSelect,
		onHeadlineRangeSelect,
		textOffsets = {},
		onTextOffsetChange,
		showToolbar = false,
		videoMuted = true,
		videoVolume = 0.8,
		videoSeekSec = NaN,
		videoTrimStartSec = 0,
		videoTrimEndSec = 0,
		onVideoDuration,
		previewMode = false,
		layout = 'story',
		onBackgroundDblClick,
	}: Props = $props();

	const isHookLayout = $derived(layout === 'hook');
	const headlinePad = $derived(
		isHookLayout
			? previewMode
				? '0'
				: '0'
			: previewMode
				? '20px 28px 12px'
				: '40px 40px 20px',
	);
	const videoPad = $derived(previewMode ? '4px 20px 40px' : '8px 32px 60px');
	const hookFontSize = $derived(
		headlineStyle.fontSize ?? (previewMode ? 26 : 56),
	);
	const creatorFontSize = $derived(
		headlineStyle.fontSize ?? (previewMode ? 22 : 48),
	);
	const postFontSize = $derived(
		headlineStyle.fontSize ?? (previewMode ? 20 : 44),
	);
	const textOnVideoFontSize = $derived(
		headlineStyle.fontSize ?? (previewMode ? 30 : 64),
	);
	const sourceFontSize = $derived(
		headlineStyle.fontSize ?? (previewMode ? 26 : 56),
	);
	const featureHeadlineSize = $derived(
		headlineStyle.fontSize ?? (previewMode ? 20 : 44),
	);
	const featureBodySize = $derived(
		bodyStyle.fontSize ?? (previewMode ? 14 : 32),
	);
	const sourceLine = $derived.by(() => {
		const w = (watermark ?? '').trim();
		if (!w) return 'Source:';
		return /^source\s*:/i.test(w) ? w : `Source: ${w}`;
	});
	/** Crisp black outline so white text stays readable on any footage. */
	const textOnVideoStroke = $derived(
		previewMode
			? `
				-webkit-text-stroke: 1.5px #000;
				paint-order: stroke fill;
				text-shadow:
					-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000,
					0 2px 10px rgba(0,0,0,0.45);
			`
			: `
				-webkit-text-stroke: 3px #000;
				paint-order: stroke fill;
				text-shadow:
					-2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000, 2px 2px 0 #000,
					0 4px 18px rgba(0,0,0,0.5);
			`,
	);

	function profileInitials(n: string) {
		return n
			.replace(/[^\w\s]/g, '')
			.trim()
			.split(/\s+/)
			.map((w) => w[0]?.toUpperCase() ?? '')
			.slice(0, 2)
			.join('');
	}
	const avatarInitials = $derived(profileInitials(profileName));

	const DEFAULT_VIDEO = VIDEO_STORY_DEFAULTS.videoUrl;

	const trimmedVideo = $derived((videoSrc && videoSrc.trim()) || '');
	const posterSrc = $derived((videoPoster && videoPoster.trim()) || '');
	// Prefer explicit video; fall back to demo clip unless the user set a still/poster only.
	const resolvedVideo = $derived(trimmedVideo || (!posterSrc ? DEFAULT_VIDEO : ''));

	let storyVideoEl = $state<HTMLVideoElement | null>(null);
	let lastDuration = 0;

	/** Uniform stretch of the video frame (1 = fill parent). Stored in textOffsets.videoStoryMediaSize.x */
	const mediaStretch = $derived(
		Math.max(0.4, Math.min(1.75, Number(textOffsets.videoStoryMediaSize?.x ?? 1) || 1)),
	);
	const mediaSelected = $derived(selectedText === 'videoStoryMedia');

	let mediaResizeStart: { x: number; y: number; stretch: number } | null = null;

	function clampMediaStretch(v: number) {
		return Math.max(0.4, Math.min(1.75, v));
	}

	function startMediaResize(e: PointerEvent) {
		if (!interactive || !onTextOffsetChange) return;
		e.preventDefault();
		e.stopPropagation();
		(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
		mediaResizeStart = {
			x: e.clientX,
			y: e.clientY,
			stretch: mediaStretch,
		};
	}

	function moveMediaResize(e: PointerEvent) {
		if (!mediaResizeStart || !onTextOffsetChange) return;
		const dx = (e.clientX - mediaResizeStart.x) / Math.max(0.001, scale);
		const dy = (e.clientY - mediaResizeStart.y) / Math.max(0.001, scale);
		// Average axis so corner drag feels like uniform stretch.
		const delta = (dx + dy) / 2;
		const next = clampMediaStretch(mediaResizeStart.stretch + delta / 520);
		onTextOffsetChange('videoStoryMediaSize', { x: next, y: next });
	}

	function endMediaResize() {
		mediaResizeStart = null;
	}

	function onMediaFrameClick(e: MouseEvent) {
		if (!interactive || !onTextSelect) return;
		e.stopPropagation();
		onTextSelect('videoStoryMedia', e.currentTarget as HTMLElement);
	}

	function onMediaFrameDblClick(e: MouseEvent) {
		if (!interactive || !onBackgroundDblClick) return;
		e.stopPropagation();
		e.preventDefault();
		onBackgroundDblClick({ clientX: e.clientX, clientY: e.clientY });
	}

	function onStoryVideoMeta(e: Event) {
		const el = e.currentTarget as HTMLVideoElement;
		storyVideoEl = el;
		const d = Number(el.duration || 0);
		if (Number.isFinite(d) && d > 0 && Math.abs(d - lastDuration) > 0.001) {
			lastDuration = d;
			onVideoDuration?.(d);
		}
	}

	$effect(() => {
		const el = storyVideoEl;
		const t = Number(videoSeekSec);
		if (!el) return;
		if (!Number.isFinite(t)) return;
		try {
			el.currentTime = Math.max(0, t);
		} catch {
			/* ignore */
		}
	});

	$effect(() => {
		const el = storyVideoEl;
		if (!el) return;
		const muted = !!videoMuted;
		const vol = Math.max(0, Math.min(1, Number(videoVolume)));
		el.muted = muted;
		el.volume = Number.isFinite(vol) ? vol : 0.8;
		if (!muted) {
			try {
				void el.play();
			} catch {
				/* ignore */
			}
		}
	});

	const HEADLINE_INK = '#f4f4f5';
	const WATERMARK_INK = 'rgba(255,255,255,0.95)';

	function inkOnBlack(preferred: string | undefined, fallback: string): string {
		const c = preferred?.trim();
		if (!c) return fallback;
		const hex = c.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
		if (!hex) return c;
		let h = hex[1];
		if (h.length === 3) h = h.split('').map((ch) => ch + ch).join('');
		const r = parseInt(h.slice(0, 2), 16);
		const g = parseInt(h.slice(2, 4), 16);
		const b = parseInt(h.slice(4, 6), 16);
		const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
		return lum < 0.45 ? fallback : c;
	}

	function hlCss(
		s: TextStyle,
		baseSize: number,
		weight = 600,
		baseFamily = `'Satoshi', ui-sans-serif, system-ui, sans-serif`,
		defaultInk = HEADLINE_INK,
	) {
		const bits: string[] = [];
		bits.push(`font-family: ${baseFamily};`);
		if (s.fontFamily) bits.push(`font-family: '${s.fontFamily}', ${baseFamily};`);
		bits.push(`font-size: ${s.fontSize ?? baseSize}px;`);
		bits.push(`font-weight: ${s.fontWeight ?? weight};`);
		if (s.italic) bits.push('font-style: italic;');
		if (s.underline) bits.push('text-decoration: underline;');
		bits.push(`color: ${inkOnBlack(s.color, defaultInk)};`);
		if (s.letterSpacing != null) bits.push(`letter-spacing: ${s.letterSpacing}em;`);
		if (s.lineHeight != null) bits.push(`line-height: ${s.lineHeight};`);
		if (s.align) bits.push(`text-align: ${s.align};`);
		appendTextShadowCss(bits, s);
		return bits.join(' ');
	}

	const headlineCss = $derived(hlCss(headlineStyle, 46, 600));
	const watermarkCss = $derived(
		hlCss(watermarkStyle, 22, 600, `'Satoshi', ui-sans-serif, system-ui, sans-serif`, WATERMARK_INK),
	);

	const subtitleWords = $derived(
		String(watermark ?? '')
			.trim()
			.split(/\s+/)
			.filter(Boolean),
	);

	let blurBgVideoEl = $state<HTMLVideoElement | null>(null);

	function syncBlurBg(t: number) {
		const bg = blurBgVideoEl;
		if (!bg) return;
		if (Math.abs(bg.currentTime - t) > 0.25) {
			try {
				bg.currentTime = t;
			} catch {
				/* ignore */
			}
		}
	}

	function onStoryVideoTimeUpdate(e: Event) {
		const el = e.currentTarget as HTMLVideoElement;
		storyVideoEl = el;
		syncBlurBg(el.currentTime);
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
</script>

{#snippet mediaLayer(objectFit: 'cover' | 'contain', extraStyle = '')}
	{#if resolvedVideo}
		<!-- svelte-ignore a11y_media_has_caption -->
		<video
			class="video-story-player"
			src={resolvedVideo}
			poster={posterSrc || undefined}
			autoplay
			loop
			playsinline
			muted={videoMuted}
			onloadedmetadata={onStoryVideoMeta}
			ontimeupdate={onStoryVideoTimeUpdate}
			style="
				position: absolute;
				inset: 0;
				width: 100%;
				height: 100%;
				object-fit: {objectFit};
				object-position: center center;
				pointer-events: none;
				user-select: none;
				{extraStyle}
			"
		></video>
	{:else if posterSrc}
		<img
			src={posterSrc}
			alt=""
			class="video-story-player"
			draggable="false"
			style="
				position: absolute;
				inset: 0;
				width: 100%;
				height: 100%;
				object-fit: {objectFit};
				object-position: center center;
				pointer-events: none;
				user-select: none;
				{extraStyle}
			"
		/>
	{/if}
{/snippet}

{#snippet draggableMedia(objectFit: 'cover' | 'contain', frameStyle = '')}
	<DraggableBlock
		dx={textOffsets.videoStoryMedia?.x ?? 0}
		dy={textOffsets.videoStoryMedia?.y ?? 0}
		{interactive}
		{scale}
		fill
		onChange={(x, y) => onTextOffsetChange?.('videoStoryMedia', { x, y })}
	>
		{#snippet children()}
			<div
				role="presentation"
				data-text-selectable="videoStoryMedia"
				onclick={onMediaFrameClick}
				ondblclick={onMediaFrameDblClick}
				onpointermove={moveMediaResize}
				onpointerup={endMediaResize}
				onpointercancel={endMediaResize}
				title={interactive && onBackgroundDblClick ? 'Double-click for BG tools' : undefined}
				style="
					position: relative;
					width: {mediaStretch * 100}%;
					height: {mediaStretch * 100}%;
					min-height: 0;
					margin: 0 auto;
					touch-action: none;
					cursor: {interactive ? 'grab' : 'default'};
					box-sizing: border-box;
					{mediaSelected && interactive
						? 'box-shadow: 0 0 0 2px rgba(139, 92, 246, 0.7);'
						: ''}
					{frameStyle}
				"
			>
				{@render mediaLayer(objectFit)}
				{#if interactive && mediaSelected}
					<div
						data-draggable-no-pan
						style="
							position: absolute;
							right: 10px;
							bottom: 10px;
							z-index: 4;
							width: 22px;
							height: 22px;
							border-radius: 8px;
							background: rgba(0,0,0,0.5);
							border: 1px solid rgba(255,255,255,0.25);
							display: flex;
							align-items: center;
							justify-content: center;
							cursor: nwse-resize;
							pointer-events: auto;
							touch-action: none;
						"
						onpointerdown={startMediaResize}
						title="Drag to stretch video"
						role="button"
						tabindex="0"
						aria-label="Stretch video frame"
					>
						<div
							style="
								width: 10px;
								height: 10px;
								border-right: 2px solid rgba(255,255,255,0.8);
								border-bottom: 2px solid rgba(255,255,255,0.8);
								transform: translate(1px, 1px);
							"
						></div>
					</div>
				{/if}
			</div>
		{/snippet}
	</DraggableBlock>
{/snippet}

{#snippet headlineBlock(pill = false)}
	<DraggableBlock
		dx={textOffsets.videoStoryHeadline?.x ?? 0}
		dy={textOffsets.videoStoryHeadline?.y ?? 0}
		{interactive}
		{scale}
		holdDragFromText={interactive}
		onChange={(x, y) => onTextOffsetChange?.('videoStoryHeadline', { x, y })}
	>
		{#snippet children()}
			<div
				style="
					flex-shrink: 0;
					padding: {pill
						? layout === 'blur'
							? previewMode
								? '0 22px 0'
								: '0 56px 0'
							: previewMode
								? '28px 36px 12px'
								: '56px 48px 20px'
						: headlinePad};
					box-sizing: border-box;
					position: relative;
					z-index: 5;
					display: flex;
					justify-content: {isHookLayout ? 'stretch' : 'center'};
					width: 100%;
				"
			>
				<CanvasMarkupTextBlock
					value={headline}
					{interactive}
					defaultColor={highlightColor}
					selected={selectedText === 'videoStoryHeadline'}
					toolbarKind="videoStoryHeadline"
					rows={isHookLayout ? 2 : 4}
					minHeight="0px"
					ariaLabel="Video headline"
					fontFamily={headlineStyle.fontFamily ?? 'Satoshi'}
					fontSize={headlineStyle.fontSize ?? (pill ? 36 : isHookLayout ? hookFontSize : 46)}
					{showToolbar}
					onTextChange={onHeadlineChange}
					onTextSelect={onTextSelect}
					onHeadlineRangeSelect={onHeadlineRangeSelect}
				>
					{#snippet display()}
						{#if pill}
							<div
								style="
									display: inline-block;
									max-width: {layout === 'blur' ? '86%' : '92%'};
									padding: {layout === 'blur'
										? previewMode
											? '12px 18px'
											: '22px 36px'
										: previewMode
											? '10px 18px'
											: '16px 28px'};
									border-radius: {layout === 'blur' ? (previewMode ? '18px' : '32px') : '999px'};
									background: rgba(255,255,255,0.96);
									box-shadow: 0 10px 32px rgba(0,0,0,0.28);
									text-align: center;
								"
							>
								<HighlightedText
									as="div"
									text={headline}
									parseHighlights={false}
									defaultColor={highlightColor}
									style="
										margin: 0;
										white-space: pre-wrap;
										word-break: break-word;
										line-height: {layout === 'blur' ? 1.28 : 1.2};
										letter-spacing: -0.02em;
										color: #0f172a;
										font-weight: 700;
										font-size: {headlineStyle.fontSize ??
										(layout === 'blur'
											? previewMode
												? 22
												: 34
											: previewMode
												? 28
												: 36)}px;
									"
								/>
							</div>
						{:else}
							<div style="text-align: {headlineStyle.align ?? (isHookLayout ? 'left' : 'center')}; width: 100%;">
								<HighlightedText
									as="div"
									text={isHookLayout ? stripMarkup(headline) : headline}
									parseHighlights={false}
									defaultColor={highlightColor}
									style="
										margin: 0;
										white-space: {isHookLayout ? 'normal' : 'pre-wrap'};
										word-break: break-word;
										line-height: {isHookLayout ? 1.22 : 1.18};
										letter-spacing: {isHookLayout ? '-0.02em' : '-0.03em'};
										color: {isHookLayout ? '#ffffff' : '#f4f4f5'};
										font-weight: {headlineStyle.fontWeight ?? (isHookLayout ? 400 : 600)};
										font-size: {isHookLayout ? hookFontSize : (headlineStyle.fontSize ?? 46)}px;
										text-shadow: {isHookLayout ? 'none' : '0 2px 12px rgba(0,0,0,0.45)'};
										max-width: 100%;
										{isHookLayout
										? 'display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;overflow:hidden;'
										: 'margin-left:auto;margin-right:auto;'}
									"
								/>
							</div>
						{/if}
					{/snippet}
				</CanvasMarkupTextBlock>
			</div>
		{/snippet}
	</DraggableBlock>
{/snippet}

{#snippet subtitleBlock(mode: 'pill' | 'karaoke' | 'plain')}
	<DraggableBlock
		dx={textOffsets.videoStoryWatermark?.x ?? 0}
		dy={textOffsets.videoStoryWatermark?.y ?? 0}
		{interactive}
		{scale}
		holdDragFromText={interactive}
		onChange={(x, y) => onTextOffsetChange?.('videoStoryWatermark', { x, y })}
	>
		{#snippet children()}
			<div
				style="
					position: relative;
					z-index: 5;
					display: flex;
					justify-content: center;
					padding: {previewMode ? '8px 20px 28px' : '12px 40px 48px'};
					box-sizing: border-box;
				"
			>
				<CanvasMarkupTextBlock
					value={watermark}
					{interactive}
					defaultColor="#ffffff"
					selected={selectedText === 'videoStoryWatermark'}
					toolbarKind="videoStoryWatermark"
					rows={2}
					minHeight="0px"
					ariaLabel="Subtitle"
					fontFamily={watermarkStyle.fontFamily ?? 'Satoshi'}
					fontSize={watermarkStyle.fontSize ?? 28}
					{showToolbar}
					onTextChange={onWatermarkChange}
					onTextSelect={onTextSelect}
					onHeadlineRangeSelect={onHeadlineRangeSelect}
				>
					{#snippet display()}
						{#if mode === 'karaoke'}
							<p
								style="
									margin: 0;
									text-align: center;
									font-size: {watermarkStyle.fontSize ?? (previewMode ? 22 : 32)}px;
									font-weight: 700;
									line-height: 1.35;
									color: #fff;
									text-shadow: 0 2px 8px rgba(0,0,0,0.65);
								"
							>
								{#each subtitleWords as word, wi (wi)}
									{#if wi === 0}
										<span
											style="
												display: inline-block;
												background: #3b82f6;
												color: #fff;
												padding: 0.08em 0.28em;
												border-radius: 0.2em;
												margin-right: 0.2em;
											">{word}</span
										>
									{:else}
										<span style="margin-right: 0.2em;">{word}</span>
									{/if}
								{/each}
							</p>
						{:else if mode === 'pill'}
							<div
								style="
									display: inline-block;
									padding: 14px 28px;
									border-radius: 12px;
									background: rgba(12,12,12,0.72);
									backdrop-filter: blur(10px);
									-webkit-backdrop-filter: blur(10px);
									border: 1px solid rgba(255,255,255,0.08);
									text-align: center;
								"
							>
								<span
									style="
										font-size: 22px;
										font-weight: 700;
										letter-spacing: 0.14em;
										text-transform: uppercase;
										color: rgba(255,255,255,0.95);
										white-space: nowrap;
										{watermarkCss}
									">{watermark}</span
								>
							</div>
						{:else}
							<p
								style="
									margin: 0;
									text-align: center;
									font-size: {watermarkStyle.fontSize ?? (previewMode ? 22 : 32)}px;
									font-weight: 700;
									line-height: 1.35;
									color: #fff;
									text-shadow:
										0 0 4px #000,
										0 2px 10px rgba(0,0,0,0.8);
								"
							>
								{watermark}
							</p>
						{/if}
					{/snippet}
				</CanvasMarkupTextBlock>
			</div>
		{/snippet}
	</DraggableBlock>
{/snippet}

<div
	style="
		width: {w * scale}px;
		height: {h * scale}px;
		overflow: hidden;
		border-radius: {scale < 1 ? '12px' : '0'};
		flex-shrink: 0;
		position: relative;
	"
>
	<div
		bind:this={exportRef}
		style="
			width: {w}px;
			height: {h}px;
			position: relative;
			background: #000000;
			transform: scale({scale});
			transform-origin: top left;
			display: flex;
			flex-direction: column;
			box-sizing: border-box;
			overflow: hidden;
		"
	>
		{#if layout === 'feature'}
			<!-- Feature card: left headline + body (teal [[highlights]]) + rounded media -->
			<div
				style="
					flex: 1;
					min-height: 0;
					display: flex;
					flex-direction: column;
					padding: {previewMode ? '22px 20px 16px' : '72px 64px 40px'};
					box-sizing: border-box;
					position: relative;
					z-index: 5;
					gap: {previewMode ? '12px' : '28px'};
				"
			>
				<div style="flex-shrink: 0; display: flex; flex-direction: column; gap: {previewMode ? '10px' : '24px'};">
					<DraggableBlock
						dx={textOffsets.videoStoryHeadline?.x ?? 0}
						dy={textOffsets.videoStoryHeadline?.y ?? 0}
						{interactive}
						{scale}
						holdDragFromText={interactive}
						onChange={(x, y) => onTextOffsetChange?.('videoStoryHeadline', { x, y })}
					>
						{#snippet children()}
							<CanvasMarkupTextBlock
								value={headline}
								{interactive}
								defaultColor={highlightColor}
								selected={selectedText === 'videoStoryHeadline'}
								toolbarKind="videoStoryHeadline"
								rows={4}
								minHeight="0px"
								ariaLabel="Feature headline"
								fontFamily={headlineStyle.fontFamily ?? 'Satoshi'}
								fontSize={featureHeadlineSize}
								{showToolbar}
								onTextChange={onHeadlineChange}
								onTextSelect={onTextSelect}
								onHeadlineRangeSelect={onHeadlineRangeSelect}
							>
								{#snippet display()}
									<div style="text-align: {headlineStyle.align ?? 'left'}; width: 100%;">
										<HighlightedText
											as="div"
											text={headline}
											parseHighlights={true}
											defaultColor={highlightColor}
											style="
												margin: 0;
												white-space: pre-wrap;
												word-break: break-word;
												line-height: 1.2;
												letter-spacing: -0.03em;
												color: #ffffff;
												font-weight: {headlineStyle.fontWeight ?? 700};
												font-size: {featureHeadlineSize}px;
											"
										/>
									</div>
								{/snippet}
							</CanvasMarkupTextBlock>
						{/snippet}
					</DraggableBlock>

					<DraggableBlock
						dx={textOffsets.blackTextBody?.x ?? 0}
						dy={textOffsets.blackTextBody?.y ?? 0}
						{interactive}
						{scale}
						holdDragFromText={interactive}
						onChange={(x, y) => onTextOffsetChange?.('blackTextBody', { x, y })}
					>
						{#snippet children()}
							<CanvasMarkupTextBlock
								value={body}
								{interactive}
								defaultColor={highlightColor}
								selected={selectedText === 'blackTextBody'}
								toolbarKind="blackTextBody"
								rows={6}
								minHeight="0px"
								ariaLabel="Feature body"
								fontFamily={bodyStyle.fontFamily ?? 'Satoshi'}
								fontSize={featureBodySize}
								{showToolbar}
								onTextChange={onBodyChange}
								onTextSelect={onTextSelect}
								onHeadlineRangeSelect={onHeadlineRangeSelect}
							>
								{#snippet display()}
									<div style="text-align: {bodyStyle.align ?? 'left'}; width: 100%;">
										<HighlightedText
											as="div"
											text={body}
											parseHighlights={true}
											defaultColor={highlightColor}
											style="
												margin: 0;
												white-space: pre-wrap;
												word-break: break-word;
												line-height: 1.4;
												letter-spacing: -0.015em;
												color: rgba(255,255,255,0.92);
												font-weight: {bodyStyle.fontWeight ?? 500};
												font-size: {featureBodySize}px;
											"
										/>
									</div>
								{/snippet}
							</CanvasMarkupTextBlock>
						{/snippet}
					</DraggableBlock>
				</div>

				<div
					style="
						flex: 1;
						min-height: 0;
						display: flex;
						align-items: stretch;
						justify-content: stretch;
						padding-top: {previewMode ? '8px' : '16px'};
					"
				>
					<div
						style="
							position: relative;
							width: 100%;
							height: 100%;
							min-height: {previewMode ? '72px' : '240px'};
							border-radius: {previewMode ? '14px' : '28px'};
							overflow: hidden;
							background: #111;
							box-shadow: 0 18px 48px rgba(0,0,0,0.45);
						"
					>
						{@render draggableMedia('contain')}
					</div>
				</div>
			</div>
		{:else if layout === 'source'}
			<!-- Highlight: full multi-line hook + tall nearly-full-width video -->
			<div
				style="
					flex: 1;
					min-height: 0;
					display: flex;
					flex-direction: column;
					align-items: stretch;
					justify-content: flex-start;
					gap: {previewMode ? '12px' : '28px'};
					padding: {previewMode ? '28px 14px 24px' : '56px 40px 48px'};
					box-sizing: border-box;
					background: #000;
				"
			>
				<div style="flex-shrink: 0; width: 100%;">
					<DraggableBlock
						dx={textOffsets.videoStoryHeadline?.x ?? 0}
						dy={textOffsets.videoStoryHeadline?.y ?? 0}
						{interactive}
						{scale}
						onChange={(x, y) => onTextOffsetChange?.('videoStoryHeadline', { x, y })}
					>
						{#snippet children()}
							<CanvasMarkupTextBlock
								value={headline}
								{interactive}
								defaultColor={highlightColor}
								selected={selectedText === 'videoStoryHeadline'}
								toolbarKind="videoStoryHeadline"
								rows={6}
								minHeight="0px"
								ariaLabel="Highlight headline"
								fontFamily={headlineStyle.fontFamily ?? 'Satoshi'}
								fontSize={sourceFontSize}
								{showToolbar}
								onTextChange={onHeadlineChange}
								onTextSelect={onTextSelect}
								onHeadlineRangeSelect={onHeadlineRangeSelect}
							>
								{#snippet display()}
									<div style="text-align: {headlineStyle.align ?? 'left'}; width: 100%;">
										<HighlightedText
											as="div"
											text={headline}
											parseHighlights={true}
											defaultColor={highlightColor}
											style="
												margin: 0;
												white-space: pre-wrap;
												word-break: break-word;
												line-height: {headlineStyle.lineHeight ?? 1.28};
												letter-spacing: -0.02em;
												color: #ffffff;
												font-weight: {headlineStyle.fontWeight ?? 400};
												font-size: {sourceFontSize}px;
												max-width: 100%;
											"
										/>
									</div>
								{/snippet}
							</CanvasMarkupTextBlock>
						{/snippet}
					</DraggableBlock>
				</div>
				<div
					style="
						position: relative;
						flex: 1;
						min-height: {previewMode ? '55%' : '58%'};
						width: 100%;
						background: #0a0a0a;
						overflow: visible;
					"
				>
					{@render draggableMedia('cover')}
				</div>
			</div>
		{:else if layout === 'text'}
			<!-- Text on video: full-bleed cover + centered outlined white text -->
			<div style="position: absolute; inset: 0; z-index: 0;">
				{@render draggableMedia('cover')}
			</div>
			<div
				style="
					position: relative;
					z-index: 5;
					flex: 1;
					min-height: 0;
					display: flex;
					align-items: center;
					justify-content: center;
					padding: {previewMode ? '28px 22px' : '80px 72px'};
					box-sizing: border-box;
					pointer-events: none;
				"
			>
				<div style="pointer-events: auto; width: 100%; max-width: 92%;">
					<DraggableBlock
						dx={textOffsets.videoStoryHeadline?.x ?? 0}
						dy={textOffsets.videoStoryHeadline?.y ?? 0}
						{interactive}
						{scale}
						holdDragFromText={interactive}
						onChange={(x, y) => onTextOffsetChange?.('videoStoryHeadline', { x, y })}
					>
						{#snippet children()}
							<CanvasMarkupTextBlock
								value={headline}
								{interactive}
								defaultColor={highlightColor}
								selected={selectedText === 'videoStoryHeadline'}
								toolbarKind="videoStoryHeadline"
								rows={6}
								minHeight="0px"
								ariaLabel="On-video text"
								fontFamily={headlineStyle.fontFamily ?? 'Satoshi'}
								fontSize={textOnVideoFontSize}
								{showToolbar}
								onTextChange={onHeadlineChange}
								onTextSelect={onTextSelect}
								onHeadlineRangeSelect={onHeadlineRangeSelect}
							>
								{#snippet display()}
									<div style="text-align: {headlineStyle.align ?? 'center'}; width: 100%;">
										<HighlightedText
											as="div"
											text={stripMarkup(headline)}
											parseHighlights={false}
											defaultColor={highlightColor}
											style="
												margin: 0;
												white-space: pre-wrap;
												word-break: break-word;
												line-height: 1.15;
												letter-spacing: -0.03em;
												color: #ffffff;
												font-weight: {headlineStyle.fontWeight ?? 800};
												font-size: {textOnVideoFontSize}px;
												{textOnVideoStroke}
											"
										/>
									</div>
								{/snippet}
							</CanvasMarkupTextBlock>
						{/snippet}
					</DraggableBlock>
				</div>
			</div>
		{:else if layout === 'post'}
			<!-- Clip post: profile (no badge) + casual hook above wide letterboxed clip -->
			<div
				style="
					flex-shrink: 0;
					padding: {previewMode ? '20px 20px 12px' : '56px 52px 24px'};
					box-sizing: border-box;
					position: relative;
					z-index: 5;
				"
			>
				<DraggableBlock
					dx={textOffsets.videoCreatorProfile?.x ?? 0}
					dy={textOffsets.videoCreatorProfile?.y ?? 0}
					{interactive}
					{scale}
					holdDragFromText={interactive}
					onChange={(x, y) => onTextOffsetChange?.('videoCreatorProfile', { x, y })}
				>
					{#snippet children()}
						<div
							style="
								display: flex;
								align-items: center;
								gap: {previewMode ? '10px' : '20px'};
								margin-bottom: {previewMode ? '12px' : '26px'};
							"
						>
							<div
								style="
									width: {previewMode ? 34 : 68}px;
									height: {previewMode ? 34 : 68}px;
									border-radius: 50%;
									overflow: hidden;
									flex-shrink: 0;
									background: #1f2937;
									display: flex;
									align-items: center;
									justify-content: center;
								"
							>
								{#if profileAvatar?.trim()}
									<img
										src={profileAvatar.trim()}
										alt=""
										style="width: 100%; height: 100%; object-fit: cover; display: block;"
									/>
								{:else}
									<span
										style="
											font-size: {previewMode ? 11 : 20}px;
											font-weight: 700;
											color: #fff;
											letter-spacing: -0.02em;
										"
									>
										{avatarInitials}
									</span>
								{/if}
							</div>
							<div style="min-width: 0; flex: 1; display: flex; flex-direction: column; gap: {previewMode ? 2 : 4}px;">
								<CanvasMarkupTextBlock
									value={profileName}
									{interactive}
									selected={selectedText === 'textCarouselName'}
									toolbarKind="textCarouselName"
									rows={1}
									minHeight="0px"
									ariaLabel="Account name"
									fontFamily="Satoshi"
									fontSize={previewMode ? 13 : 30}
									{showToolbar}
									onTextChange={onProfileNameChange}
									onTextSelect={onTextSelect}
								>
									{#snippet display()}
										<span
											style="
												font-size: {previewMode ? 13 : 30}px;
												font-weight: 700;
												color: #fff;
												letter-spacing: -0.02em;
												line-height: 1.15;
											"
										>
											{profileName?.trim() ?? ''}
										</span>
									{/snippet}
								</CanvasMarkupTextBlock>
								<CanvasMarkupTextBlock
									value={profileHandle}
									{interactive}
									selected={selectedText === 'textCarouselHandle'}
									toolbarKind="textCarouselHandle"
									rows={1}
									minHeight="0px"
									ariaLabel="Account handle"
									fontFamily="Satoshi"
									fontSize={previewMode ? 11 : 24}
									{showToolbar}
									onTextChange={onProfileHandleChange}
									onTextSelect={onTextSelect}
								>
									{#snippet display()}
										<span
											style="
												font-size: {previewMode ? 11 : 24}px;
												font-weight: 400;
												color: rgba(255,255,255,0.5);
												letter-spacing: -0.01em;
												line-height: 1.2;
											"
										>
											{profileHandle?.trim() ?? ''}
										</span>
									{/snippet}
								</CanvasMarkupTextBlock>
							</div>
						</div>
					{/snippet}
				</DraggableBlock>

				<DraggableBlock
					dx={textOffsets.videoStoryHeadline?.x ?? 0}
					dy={textOffsets.videoStoryHeadline?.y ?? 0}
					{interactive}
					{scale}
					holdDragFromText={interactive}
					onChange={(x, y) => onTextOffsetChange?.('videoStoryHeadline', { x, y })}
				>
					{#snippet children()}
						<CanvasMarkupTextBlock
							value={headline}
							{interactive}
							defaultColor="#ffffff"
							selected={selectedText === 'videoStoryHeadline'}
							toolbarKind="videoStoryHeadline"
							rows={4}
							minHeight="0px"
							ariaLabel="Clip post hook"
							fontFamily={headlineStyle.fontFamily ?? 'Satoshi'}
							fontSize={postFontSize}
							{showToolbar}
							onTextChange={onHeadlineChange}
							onTextSelect={onTextSelect}
							onHeadlineRangeSelect={onHeadlineRangeSelect}
						>
							{#snippet display()}
								<div style="text-align: left; width: 100%;">
									<HighlightedText
										as="div"
										text={headline?.trim() ?? ''}
										parseHighlights={false}
										defaultColor="#ffffff"
										style="
											margin: 0;
											white-space: pre-wrap;
											word-break: break-word;
											line-height: 1.32;
											letter-spacing: -0.02em;
											color: #ffffff;
											font-weight: {headlineStyle.fontWeight ?? 600};
											font-size: {postFontSize}px;
											max-width: 100%;
										"
									/>
								</div>
							{/snippet}
						</CanvasMarkupTextBlock>
					{/snippet}
				</DraggableBlock>
			</div>
			<div
				style="
					flex: 1;
					min-height: 0;
					position: relative;
					background: #000;
					display: flex;
					align-items: center;
					justify-content: center;
					padding: {previewMode ? '0 0 18px' : '0 0 48px'};
					box-sizing: border-box;
				"
			>
				<div
					style="
						position: relative;
						width: 100%;
						height: {previewMode ? '52%' : '48%'};
						min-height: 0;
					"
				>
					{@render draggableMedia('contain')}
				</div>
			</div>
		{:else if layout === 'creator'}
			<!-- Creator: profile + bold [[emphasis]] headline + tall nearly-full-width video -->
			<div
				style="
					flex: 1;
					min-height: 0;
					display: flex;
					flex-direction: column;
					align-items: stretch;
					gap: {previewMode ? '12px' : '26px'};
					padding: {previewMode ? '24px 14px 20px' : '64px 40px 48px'};
					box-sizing: border-box;
					background: #000;
				"
			>
				<DraggableBlock
					dx={textOffsets.videoCreatorProfile?.x ?? 0}
					dy={textOffsets.videoCreatorProfile?.y ?? 0}
					{interactive}
					{scale}
					onChange={(x, y) => onTextOffsetChange?.('videoCreatorProfile', { x, y })}
				>
					{#snippet children()}
						<div
							style="
								display: flex;
								align-items: center;
								gap: {previewMode ? '10px' : '18px'};
							"
						>
							<div
								style="
									width: {previewMode ? 34 : 68}px;
									height: {previewMode ? 34 : 68}px;
									border-radius: 50%;
									overflow: hidden;
									flex-shrink: 0;
									background: #111;
									display: flex;
									align-items: center;
									justify-content: center;
								"
							>
								{#if profileAvatar?.trim()}
									<img
										src={profileAvatar}
										alt=""
										style="width: 100%; height: 100%; object-fit: cover; display: block;"
									/>
								{:else}
									<span
										style="
											font-size: {previewMode ? 11 : 20}px;
											font-weight: 700;
											color: #fff;
											letter-spacing: -0.02em;
										"
									>
										{avatarInitials}
									</span>
								{/if}
							</div>
							<div style="min-width: 0; flex: 1;">
								<div
									style="
										display: flex;
										align-items: center;
										gap: {previewMode ? 5 : 8}px;
										flex-wrap: wrap;
									"
								>
									<CanvasMarkupTextBlock
										value={profileName}
										{interactive}
										selected={selectedText === 'textCarouselName'}
										toolbarKind="textCarouselName"
										rows={1}
										minHeight="0px"
										ariaLabel="Creator name"
										fontFamily="Satoshi"
										fontSize={previewMode ? 13 : 30}
										{showToolbar}
										onTextChange={onProfileNameChange}
										onTextSelect={onTextSelect}
									>
										{#snippet display()}
											<span
												style="
													font-size: {previewMode ? 13 : 30}px;
													font-weight: 700;
													color: #fff;
													letter-spacing: -0.02em;
													line-height: 1.15;
												"
											>
												{profileName}
											</span>
										{/snippet}
									</CanvasMarkupTextBlock>
									<svg
										width={previewMode ? 13 : 24}
										height={previewMode ? 13 : 24}
										viewBox="0 0 24 24"
										fill="none"
										aria-hidden="true"
										style="flex-shrink: 0;"
									>
										<circle cx="12" cy="12" r="10" fill="#1D9BF0" />
										<path
											d="M7.5 12.2l2.8 2.8 6.2-6.4"
											stroke="#fff"
											stroke-width="2"
											stroke-linecap="round"
											stroke-linejoin="round"
										/>
									</svg>
								</div>
								<CanvasMarkupTextBlock
									value={profileHandle}
									{interactive}
									selected={selectedText === 'textCarouselHandle'}
									toolbarKind="textCarouselHandle"
									rows={1}
									minHeight="0px"
									ariaLabel="Creator handle"
									fontFamily="Satoshi"
									fontSize={previewMode ? 11 : 24}
									{showToolbar}
									onTextChange={onProfileHandleChange}
									onTextSelect={onTextSelect}
								>
									{#snippet display()}
										<span
											style="
												font-size: {previewMode ? 11 : 24}px;
												font-weight: 400;
												color: rgba(255,255,255,0.5);
												letter-spacing: -0.01em;
												line-height: 1.2;
											"
										>
											{profileHandle}
										</span>
									{/snippet}
								</CanvasMarkupTextBlock>
							</div>
						</div>
					{/snippet}
				</DraggableBlock>

				<DraggableBlock
					dx={textOffsets.videoStoryHeadline?.x ?? 0}
					dy={textOffsets.videoStoryHeadline?.y ?? 0}
					{interactive}
					{scale}
					onChange={(x, y) => onTextOffsetChange?.('videoStoryHeadline', { x, y })}
				>
					{#snippet children()}
						<CanvasMarkupTextBlock
							value={headline}
							{interactive}
							defaultColor="#ffffff"
							selected={selectedText === 'videoStoryHeadline'}
							toolbarKind="videoStoryHeadline"
							rows={3}
							minHeight="0px"
							ariaLabel="Creator hook headline"
							fontFamily={headlineStyle.fontFamily ?? 'Satoshi'}
							fontSize={creatorFontSize}
							{showToolbar}
							onTextChange={onHeadlineChange}
							onTextSelect={onTextSelect}
							onHeadlineRangeSelect={onHeadlineRangeSelect}
						>
							{#snippet display()}
								<div style="text-align: left; width: 100%;">
									<HighlightedText
										as="div"
										text={headline}
										parseHighlights={true}
										emphasisBold={true}
										defaultColor="#ffffff"
										style="
											margin: 0;
											white-space: pre-wrap;
											word-break: break-word;
											line-height: 1.28;
											letter-spacing: -0.025em;
											color: #ffffff;
											font-weight: {headlineStyle.fontWeight ?? 400};
											font-size: {creatorFontSize}px;
											max-width: 100%;
										"
									/>
								</div>
							{/snippet}
						</CanvasMarkupTextBlock>
					{/snippet}
				</DraggableBlock>

				<div
					style="
						position: relative;
						flex: 1;
						min-height: {previewMode ? '52%' : '56%'};
						width: 100%;
						background: #0a0a0a;
						overflow: visible;
					"
				>
					{@render draggableMedia('cover')}
				</div>
			</div>
		{:else if layout === 'hook'}
			<!-- Hook: 2-line left-aligned title sharing the video column edge -->
			<div
				style="
					flex: 1;
					min-height: 0;
					display: flex;
					flex-direction: column;
					align-items: center;
					justify-content: center;
					gap: {previewMode ? '14px' : '36px'};
					padding: {previewMode ? '36px 16px 40px' : '120px 0 140px'};
					box-sizing: border-box;
					background: #000;
				"
			>
				<div
					style="
						display: flex;
						flex-direction: column;
						align-items: stretch;
						gap: {previewMode ? '14px' : '36px'};
						width: {previewMode ? '92%' : '920px'};
						max-width: 92%;
					"
				>
					<div style="flex-shrink: 0; width: 100%;">
						{@render headlineBlock(false)}
					</div>
					<div
						style="
							position: relative;
							flex-shrink: 0;
							width: 100%;
							aspect-ratio: 16 / 9;
							background: #0a0a0a;
							overflow: hidden;
						"
					>
						{@render draggableMedia('cover')}
					</div>
				</div>
			</div>
		{:else if layout === 'fit'}
			<!-- Fit: letterboxed video + title + karaoke subtitle -->
			{@render headlineBlock(false)}
			<div
				style="
					flex: 1;
					min-height: 0;
					position: relative;
					background: #000;
					display: flex;
					align-items: center;
					justify-content: center;
				"
			>
				<div style="position: relative; width: 100%; height: 56%; min-height: 0;">
					{@render draggableMedia('contain')}
				</div>
			</div>
			{@render subtitleBlock('karaoke')}
		{:else if layout === 'blur'}
			<!--
				Blur template proportions (9:16 canvas):
				- Full-bleed zoomed/blurred backdrop
				- Sharp landscape band = full width × 16:9 (~31.6% of frame height), vertically centered
				- Thin black letterbox bars above/below the sharp band
				- White pill headline in the upper third, watermark in the lower third
			-->
			{@const blurBar = previewMode ? 6 : 18}
			<div style="position: absolute; inset: 0; z-index: 0; overflow: hidden; background: #0a0a0a;">
				{#if resolvedVideo}
					<!-- svelte-ignore a11y_media_has_caption -->
					<video
						bind:this={blurBgVideoEl}
						src={resolvedVideo}
						poster={posterSrc || undefined}
						autoplay
						loop
						playsinline
						muted
						aria-hidden="true"
						style="
							position: absolute;
							inset: -18%;
							width: 136%;
							height: 136%;
							object-fit: cover;
							filter: blur(42px) brightness(0.78) saturate(1.05);
							transform: scale(1.12);
						"
					></video>
				{:else if posterSrc}
					<img
						src={posterSrc}
						alt=""
						aria-hidden="true"
						style="
							position: absolute;
							inset: -18%;
							width: 136%;
							height: 136%;
							object-fit: cover;
							filter: blur(42px) brightness(0.78) saturate(1.05);
							transform: scale(1.12);
						"
					/>
				{/if}
			</div>

			<!-- Sharp 16:9 band + black letterbox bars, locked to full-canvas center -->
			<div
				style="
					position: absolute;
					left: 0;
					right: 0;
					top: 50%;
					transform: translateY(-50%);
					z-index: 1;
					display: flex;
					flex-direction: column;
					width: 100%;
					pointer-events: none;
				"
			>
				<div style="height: {blurBar}px; width: 100%; background: #000; flex-shrink: 0;"></div>
				<div
					style="
						position: relative;
						width: 100%;
						aspect-ratio: 16 / 9;
						overflow: hidden;
						background: #000;
						pointer-events: auto;
					"
				>
					{@render draggableMedia('cover')}
				</div>
				<div style="height: {blurBar}px; width: 100%; background: #000; flex-shrink: 0;"></div>
			</div>

			<!-- Text layers sit above the blur + strip without shifting strip proportions -->
			<div
				style="
					position: absolute;
					inset: 0;
					z-index: 2;
					display: flex;
					flex-direction: column;
					justify-content: space-between;
					pointer-events: none;
				"
			>
				<div style="pointer-events: auto; padding-top: {previewMode ? '8%' : '7%'};">
					{@render headlineBlock(true)}
				</div>
				<div style="pointer-events: auto; padding-bottom: {previewMode ? '6%' : '5%'};">
					{@render subtitleBlock('plain')}
				</div>
			</div>
		{:else}
			<!-- Story (default): inset rounded video card -->
			{@render headlineBlock(false)}
			<div
				style="
					flex: 1;
					min-height: 0;
					display: flex;
					align-items: center;
					justify-content: center;
					padding: {videoPad};
					box-sizing: border-box;
				"
			>
				<div
					style="
						position: relative;
						width: 100%;
						max-width: 920px;
						height: 100%;
						min-height: 0;
						border-radius: {previewMode ? '14px' : '20px'};
						overflow: hidden;
						background: #0a0a0a;
						box-shadow: 0 24px 80px rgba(0,0,0,0.55);
					"
				>
					{@render draggableMedia('cover')}
					<div
						style="
							position: absolute;
							left: 0;
							right: 0;
							bottom: 0;
							z-index: 2;
						"
					>
						{@render subtitleBlock('pill')}
					</div>
				</div>
			</div>
		{/if}
	</div>
</div>

