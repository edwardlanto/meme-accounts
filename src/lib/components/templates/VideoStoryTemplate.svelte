<script lang="ts">
	import HighlightedText from '$lib/components/HighlightedText.svelte';
	import CanvasMarkupTextBlock from '$lib/components/CanvasMarkupTextBlock.svelte';
	import DraggableBlock from '$lib/components/DraggableBlock.svelte';
	import type { TextElementKind, TextStyle } from '$lib/types';
	import { appendTextShadowCss } from '$lib/textStyleCss';
	import { VIDEO_STORY_DEFAULTS } from '$lib/studio/slide-content-defaults';

	interface Props {
		headline?: string;
		watermark?: string;
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
		onHeadlineChange?: (v: string) => void;
		onWatermarkChange?: (v: string) => void;
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
	}

	let {
		headline = VIDEO_STORY_DEFAULTS.headline,
		watermark = VIDEO_STORY_DEFAULTS.watermark,
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
		onHeadlineChange,
		onWatermarkChange,
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

	const headlinePad = $derived(previewMode ? '20px 28px 12px' : '40px 40px 20px');
	const videoPad = $derived(previewMode ? '4px 20px 40px' : '8px 32px 60px');

	const DEFAULT_VIDEO = VIDEO_STORY_DEFAULTS.videoUrl;

	const trimmedVideo = $derived((videoSrc && videoSrc.trim()) || '');
	const posterSrc = $derived((videoPoster && videoPoster.trim()) || '');
	const resolvedVideo = $derived(trimmedVideo || (!posterSrc ? DEFAULT_VIDEO : ''));

	let storyVideoEl = $state<HTMLVideoElement | null>(null);
	let lastDuration = 0;

	function onStoryVideoMeta(e: Event) {
		const el = e.currentTarget as HTMLVideoElement;
		storyVideoEl = el;
		const d = Number(el.duration || 0);
		if (Number.isFinite(d) && d > 0 && Math.abs(d - lastDuration) > 0.001) {
			lastDuration = d;
			onVideoDuration?.(d);
		}
	}

	function onStoryVideoTimeUpdate(e: Event) {
		const el = e.currentTarget as HTMLVideoElement;
		storyVideoEl = el;
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
		<!-- Top headline -->
		<DraggableBlock
			dx={textOffsets.videoStoryHeadline?.x ?? 0}
			dy={textOffsets.videoStoryHeadline?.y ?? 0}
			{interactive}
			{scale}
			onChange={(x, y) => onTextOffsetChange?.('videoStoryHeadline', { x, y })}
		>
			{#snippet children()}
				<div style="flex-shrink: 0; padding: {headlinePad}; box-sizing: border-box; position: relative; z-index: 3;">
					<CanvasMarkupTextBlock
						value={headline}
						{interactive}
						defaultColor={highlightColor}
						selected={selectedText === 'videoStoryHeadline'}
						toolbarKind="videoStoryHeadline"
						rows={4}
						minHeight="0px"
						ariaLabel="Video headline"
						fontFamily={headlineStyle.fontFamily ?? 'Satoshi'}
						fontSize={headlineStyle.fontSize ?? 46}
						{showToolbar}
						onTextChange={onHeadlineChange}
						onTextSelect={onTextSelect}
						onHeadlineRangeSelect={onHeadlineRangeSelect}
					>
						{#snippet display()}
							<div style="text-align: {headlineStyle.align ?? 'center'};">
								<HighlightedText
									as="div"
									text={headline}
									parseHighlights={false}
									defaultColor={highlightColor}
									style="
										margin: 0;
										white-space: pre-wrap;
										word-break: break-word;
										line-height: 1.18;
										letter-spacing: -0.03em;
										color: #f4f4f5;
										{headlineCss}
									"
								/>
							</div>
						{/snippet}
					</CanvasMarkupTextBlock>
				</div>
			{/snippet}
		</DraggableBlock>

		<!-- Video + watermark -->
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
							object-fit: cover;
							object-position: center center;
						"
					></video>
				{:else if posterSrc}
					<img
						src={posterSrc}
						alt=""
						class="video-story-player"
						style="
							position: absolute;
							inset: 0;
							width: 100%;
							height: 100%;
							object-fit: cover;
							object-position: center center;
						"
					/>
				{/if}

				<DraggableBlock
					dx={textOffsets.videoStoryWatermark?.x ?? 0}
					dy={textOffsets.videoStoryWatermark?.y ?? 0}
					{interactive}
					{scale}
					onChange={(x, y) => onTextOffsetChange?.('videoStoryWatermark', { x, y })}
				>
					{#snippet children()}
						<div
							style="
								position: absolute;
								left: 50%;
								bottom: 36px;
								transform: translateX(-50%);
								max-width: 92%;
								z-index: 2;
							"
						>
							<CanvasMarkupTextBlock
								value={watermark}
								{interactive}
								defaultColor="#ffffff"
								selected={selectedText === 'videoStoryWatermark'}
								toolbarKind="videoStoryWatermark"
								rows={1}
								minHeight="0px"
								ariaLabel="Watermark"
								fontFamily={watermarkStyle.fontFamily ?? 'Satoshi'}
								fontSize={watermarkStyle.fontSize ?? 22}
								{showToolbar}
								onTextChange={onWatermarkChange}
								onTextSelect={onTextSelect}
								onHeadlineRangeSelect={onHeadlineRangeSelect}
							>
								{#snippet display()}
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
											"
										>{watermark}</span>
									</div>
								{/snippet}
							</CanvasMarkupTextBlock>
						</div>
					{/snippet}
				</DraggableBlock>
			</div>
		</div>
	</div>
</div>
