<script lang="ts">
	import { FONT_TEMPLATE_DEFAULT } from '$lib/fonts/brand-fonts';
	import CanvasMarkupTextBlock from '$lib/components/CanvasMarkupTextBlock.svelte';
	import DraggableBlock from '$lib/components/DraggableBlock.svelte';
	import HighlightedText from '$lib/components/HighlightedText.svelte';
	import type { TextElementKind, TextStyle } from '$lib/types';
	import {
		BRAND_STACK_DEFAULTS,
		BRAND_STACK_HEADLINE_STYLE,
	} from '$lib/studio/slide-content-defaults';
	import { textBgCss, textShadowStyleAttr } from '$lib/textStyleCss';

	interface Props {
		headline?: string;
		watermark?: string;
		brand?: string;
		topVideoSrc?: string;
		topImageSrc?: string;
		bottomMediaSrc?: string;
		w?: number;
		h?: number;
		scale?: number;
		interactive?: boolean;
		exportRef?: HTMLElement | null;
		selectedText?: TextElementKind | null;
		headlineStyle?: TextStyle;
		watermarkStyle?: TextStyle;
		brandStyle?: TextStyle;
		onHeadlineChange?: (v: string) => void;
		onWatermarkChange?: (v: string) => void;
		onBrandChange?: (v: string) => void;
		onTextSelect?: (kind: TextElementKind, el: HTMLElement) => void;
		onHeadlineRangeSelect?: (start: number, end: number) => void;
		textOffsets?: Record<string, { x: number; y: number }>;
		onTextOffsetChange?: (kind: string, next: { x: number; y: number }) => void;
		showToolbar?: boolean;
		videoMuted?: boolean;
		videoVolume?: number;
		videoSeekSec?: number;
		videoTrimStartSec?: number;
		videoTrimEndSec?: number;
		onVideoDuration?: (durationSec: number) => void;
		previewMode?: boolean;
	}

	let {
		headline = BRAND_STACK_DEFAULTS.headline,
		watermark = BRAND_STACK_DEFAULTS.watermark,
		brand = BRAND_STACK_DEFAULTS.brand,
		topVideoSrc = '',
		topImageSrc = '',
		bottomMediaSrc = '',
		w = 1080,
		h = 1920,
		scale = 1,
		interactive = true,
		exportRef = $bindable(null),
		selectedText = null,
		headlineStyle = {},
		watermarkStyle = {},
		brandStyle = {},
		onHeadlineChange,
		onWatermarkChange,
		onBrandChange,
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
	}: Props = $props();

	/** Reference layout: 960 + 130 + 830 on a 1920-tall canvas. */
	const TOP_H = $derived(Math.round(h * (960 / 1920)));
	const BRAND_H = $derived(Math.round(h * (130 / 1920)));
	const BOTTOM_H = $derived(h - TOP_H - BRAND_H);

	const resolvedTopVideo = $derived(
		(topVideoSrc && topVideoSrc.trim()) || BRAND_STACK_DEFAULTS.topVideoUrl,
	);
	const resolvedTopImage = $derived((topImageSrc && topImageSrc.trim()) || '');
	const resolvedBottom = $derived(
		(bottomMediaSrc && bottomMediaSrc.trim()) || BRAND_STACK_DEFAULTS.bottomMediaUrl,
	);

	function isVideoUrl(url: string) {
		const u = String(url ?? '').trim().toLowerCase();
		if (!u) return false;
		if (u.startsWith('data:video/')) return true;
		if (u.startsWith('blob:') && /[?#].*\b(video|mp4|webm|mov|m4v|vid)\b/i.test(url)) return true;
		return /\.(mp4|webm|mov|m4v)(\?|#|$)/i.test(u);
	}

	const topUsesVideo = $derived(isVideoUrl(resolvedTopVideo) && !resolvedTopImage);
	const bottomUsesVideo = $derived(isVideoUrl(resolvedBottom));

	let topVideoEl = $state<HTMLVideoElement | null>(null);
	let bottomVideoEl = $state<HTMLVideoElement | null>(null);
	let lastDuration = 0;

	function onTopVideoMeta(e: Event) {
		const el = e.currentTarget as HTMLVideoElement;
		topVideoEl = el;
		const d = Number(el.duration || 0);
		if (Number.isFinite(d) && d > 0 && Math.abs(d - lastDuration) > 0.001) {
			lastDuration = d;
			onVideoDuration?.(d);
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

	$effect(() => {
		const el = topVideoEl;
		if (!el) return;
		el.muted = videoMuted;
		el.loop = true;
		el.playsInline = true;
		el.volume = Math.max(0, Math.min(1, videoVolume));
		void el.play().catch(() => {});
	});

	$effect(() => {
		const el = topVideoEl;
		if (!el) return;
		const start = Math.max(0, Number(videoTrimStartSec) || 0);
		const end = Number(videoTrimEndSec) || 0;
		if (end > start && el.currentTime < start) el.currentTime = start;
	});

	const brandParts = $derived.by(() => {
		const raw = String(brand ?? '').trim();
		if (!raw) return { green: '', white: '' };
		const idx = raw.toLowerCase().indexOf('rumble');
		if (idx === -1) return { green: '', white: raw };
		return {
			green: raw.slice(idx, idx + 6),
			white: raw.slice(idx + 6),
		};
	});

	const headlineSize = $derived(
		headlineStyle.fontSize ?? (previewMode ? 22 : BRAND_STACK_HEADLINE_STYLE.fontSize),
	);
	const watermarkSize = $derived(watermarkStyle.fontSize ?? (previewMode ? 18 : 30));
</script>

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
		data-studio-canvas-root
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
		<!-- Top media (~50%) -->
		<div
			style="
				position: relative;
				flex: 0 0 {TOP_H}px;
				height: {TOP_H}px;
				overflow: hidden;
				background: #0a0a0a;
			"
		>
			{#if topUsesVideo}
				<!-- svelte-ignore a11y_media_has_caption -->
				<video
					bind:this={topVideoEl}
					src={resolvedTopVideo}
					autoplay
					loop
					playsinline
					muted={videoMuted}
					onloadedmetadata={onTopVideoMeta}
					style="
						position: absolute;
						inset: 0;
						width: 100%;
						height: 100%;
						object-fit: cover;
						object-position: center;
						display: block;
					"
				></video>
			{:else if resolvedTopImage}
				<img
					src={resolvedTopImage}
					alt=""
					draggable="false"
					style="
						position: absolute;
						inset: 0;
						width: 100%;
						height: 100%;
						object-fit: cover;
						object-position: center;
						display: block;
						pointer-events: none;
					"
				/>
			{:else}
				<!-- svelte-ignore a11y_media_has_caption -->
				<video
					bind:this={topVideoEl}
					src={resolvedTopVideo}
					autoplay
					loop
					playsinline
					muted={videoMuted}
					onloadedmetadata={onTopVideoMeta}
					style="
						position: absolute;
						inset: 0;
						width: 100%;
						height: 100%;
						object-fit: cover;
						object-position: center;
						display: block;
					"
				></video>
			{/if}

			<!-- Top watermark -->
			<div
				style="
					position: absolute;
					top: {previewMode ? '10px' : '22px'};
					left: 0;
					right: 0;
					z-index: 4;
					display: flex;
					justify-content: center;
					padding: 0 {previewMode ? '16px' : '32px'};
					box-sizing: border-box;
					pointer-events: none;
				"
			>
				<DraggableBlock
					dx={textOffsets.videoStoryWatermark?.x ?? 0}
					dy={textOffsets.videoStoryWatermark?.y ?? 0}
					{interactive}
					{scale}
					holdDragFromText={interactive}
					onChange={(x, y) => onTextOffsetChange?.('videoStoryWatermark', { x, y })}
				>
					{#snippet children()}
						<CanvasMarkupTextBlock
							value={watermark}
							{interactive}
							defaultColor="#ffffff"
							selected={selectedText === 'videoStoryWatermark'}
							toolbarKind="videoStoryWatermark"
							rows={1}
							minHeight="0px"
							ariaLabel="Watermark"
							fontFamily={watermarkStyle.fontFamily ?? FONT_TEMPLATE_DEFAULT}
							fontSize={watermarkSize}
							{showToolbar}
							onTextChange={onWatermarkChange}
							onTextSelect={onTextSelect}
							onHeadlineRangeSelect={onHeadlineRangeSelect}
						>
							{#snippet display()}
								<p
									style="
										margin: 0;
										text-align: center;
										font-size: {watermarkSize}px;
										font-weight: 700;
										font-style: italic;
										line-height: 1.2;
										color: rgba(255,255,255,0.92);
										text-shadow:
											0 0 4px rgba(0,0,0,0.85),
											0 2px 10px rgba(0,0,0,0.75);
										white-space: nowrap;
									"
								>
									{watermark}
								</p>
							{/snippet}
						</CanvasMarkupTextBlock>
					{/snippet}
				</DraggableBlock>
			</div>

			<!-- White headline bubble straddling the brand bar -->
			<div
				style="
					position: absolute;
					left: 0;
					right: 0;
					bottom: {previewMode ? '-18px' : '-34px'};
					z-index: 6;
					display: flex;
					justify-content: center;
					padding: 0 {previewMode ? '14px' : '36px'};
					box-sizing: border-box;
				"
			>
				<DraggableBlock
					dx={textOffsets.videoStoryHeadline?.x ?? 0}
					dy={textOffsets.videoStoryHeadline?.y ?? 0}
					{interactive}
					{scale}
					holdDragFromText={interactive}
					immediateTextDrag={selectedText === 'videoStoryHeadline'}
					onChange={(x, y) => onTextOffsetChange?.('videoStoryHeadline', { x, y })}
				>
					{#snippet children()}
						<CanvasMarkupTextBlock
							value={headline}
							{interactive}
							defaultColor="#0f172a"
							selected={selectedText === 'videoStoryHeadline'}
							toolbarKind="videoStoryHeadline"
							rows={4}
							minHeight="0px"
							ariaLabel="Headline"
							fontFamily={headlineStyle.fontFamily ?? BRAND_STACK_HEADLINE_STYLE.fontFamily}
							fontSize={headlineSize}
							{showToolbar}
							onTextChange={onHeadlineChange}
							onTextSelect={onTextSelect}
							onHeadlineRangeSelect={onHeadlineRangeSelect}
						>
							{#snippet display()}
								<div
									style="
										display: inline-block;
										max-width: {previewMode ? '94%' : '920px'};
										padding: {previewMode ? '12px 16px' : '22px 28px'};
										border-radius: {previewMode ? '14px' : '22px'};
										background: #ffffff;
										box-shadow: 0 8px 28px rgba(0,0,0,0.28);
										text-align: center;
									"
								>
									<HighlightedText
										as="div"
										text={headline}
										parseHighlights={true}
										baseFontWeight={headlineStyle.fontWeight ?? BRAND_STACK_HEADLINE_STYLE.fontWeight}
										style="
											margin: 0;
											white-space: pre-wrap;
											word-break: break-word;
											line-height: 1.22;
											letter-spacing: -0.02em;
											color: #0f172a;
											font-weight: {headlineStyle.fontWeight ?? BRAND_STACK_HEADLINE_STYLE.fontWeight};
											font-size: {headlineSize}px;
											{textShadowStyleAttr(headlineStyle)}
											{textBgCss(headlineStyle)}
										"
									/>
								</div>
							{/snippet}
						</CanvasMarkupTextBlock>
					{/snippet}
				</DraggableBlock>
			</div>
		</div>

		<!-- Brand bar -->
		<div
			style="
				position: relative;
				z-index: 5;
				flex: 0 0 {BRAND_H}px;
				height: {BRAND_H}px;
				background: #000000;
				display: flex;
				align-items: center;
				justify-content: center;
				padding: 0 {previewMode ? '12px' : '28px'};
				box-sizing: border-box;
			"
		>
			<DraggableBlock
				dx={textOffsets.brandStackBrand?.x ?? 0}
				dy={textOffsets.brandStackBrand?.y ?? 0}
				{interactive}
				{scale}
				holdDragFromText={interactive}
				onChange={(x, y) => onTextOffsetChange?.('brandStackBrand', { x, y })}
			>
				{#snippet children()}
					<CanvasMarkupTextBlock
						value={brand}
						{interactive}
						defaultColor="#ffffff"
						selected={selectedText === 'brandStackBrand'}
						toolbarKind="brandStackBrand"
						rows={1}
						minHeight="0px"
						ariaLabel="Brand link"
						fontFamily={brandStyle.fontFamily ?? FONT_TEMPLATE_DEFAULT}
						fontSize={brandStyle.fontSize ?? (previewMode ? 16 : 34)}
						{showToolbar}
						onTextChange={onBrandChange}
						onTextSelect={onTextSelect}
						onHeadlineRangeSelect={onHeadlineRangeSelect}
					>
						{#snippet display()}
							<div
								style="
									display: inline-flex;
									align-items: center;
									justify-content: center;
									gap: {previewMode ? '6px' : '12px'};
									max-width: 100%;
								"
							>
								<svg
									width={previewMode ? 22 : 42}
									height={previewMode ? 22 : 42}
									viewBox="0 0 42 42"
									aria-hidden="true"
									style="flex-shrink: 0;"
								>
									<circle cx="21" cy="21" r="21" fill="#85C742" />
									<path d="M17 13 L17 29 L31 21 Z" fill="#ffffff" />
								</svg>
								<span
									style="
										font-size: {brandStyle.fontSize ?? (previewMode ? 16 : 34)}px;
										font-weight: 700;
										line-height: 1;
										letter-spacing: -0.01em;
										{textBgCss(brandStyle)}
										white-space: nowrap;
									"
								>
									{#if brandParts.green}
										<span style="color: #85C742;">{brandParts.green}</span>
									{/if}
									<span style="color: #ffffff;">{brandParts.white}</span>
								</span>
							</div>
						{/snippet}
					</CanvasMarkupTextBlock>
				{/snippet}
			</DraggableBlock>
		</div>

		<!-- Bottom media (~43%) -->
		<div
			style="
				position: relative;
				flex: 0 0 {BOTTOM_H}px;
				height: {BOTTOM_H}px;
				overflow: hidden;
				background: #0a0a0a;
			"
		>
			{#if bottomUsesVideo}
				<!-- svelte-ignore a11y_media_has_caption -->
				<video
					bind:this={bottomVideoEl}
					src={resolvedBottom}
					autoplay
					loop
					playsinline
					muted
					onloadeddata={(e) => {
						void (e.currentTarget as HTMLVideoElement).play().catch(() => {});
					}}
					style="
						position: absolute;
						inset: 0;
						width: 100%;
						height: 100%;
						object-fit: cover;
						object-position: center;
						display: block;
					"
				></video>
			{:else}
				<img
					src={resolvedBottom}
					alt=""
					draggable="false"
					style="
						position: absolute;
						inset: 0;
						width: 100%;
						height: 100%;
						object-fit: cover;
						object-position: center;
						display: block;
						pointer-events: none;
					"
				/>
			{/if}
		</div>
	</div>
</div>
