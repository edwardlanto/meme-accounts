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
		/** Visual layout — story (default inset), fit (letterbox), blur (blurred fill) */
		layout?: 'story' | 'fit' | 'blur';
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
		layout = 'story',
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
		(watermark || 'Here is your subtitle').trim().split(/\s+/).filter(Boolean),
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
				{extraStyle}
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
				object-fit: {objectFit};
				object-position: center center;
				{extraStyle}
			"
		/>
	{/if}
{/snippet}

{#snippet headlineBlock(pill = false)}
	<DraggableBlock
		dx={textOffsets.videoStoryHeadline?.x ?? 0}
		dy={textOffsets.videoStoryHeadline?.y ?? 0}
		{interactive}
		{scale}
		onChange={(x, y) => onTextOffsetChange?.('videoStoryHeadline', { x, y })}
	>
		{#snippet children()}
			<div
				style="
					flex-shrink: 0;
					padding: {pill ? (previewMode ? '28px 36px 12px' : '56px 48px 20px') : headlinePad};
					box-sizing: border-box;
					position: relative;
					z-index: 5;
					display: flex;
					justify-content: center;
				"
			>
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
					fontSize={headlineStyle.fontSize ?? (pill ? 36 : 46)}
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
									max-width: 92%;
									padding: {previewMode ? '10px 18px' : '16px 28px'};
									border-radius: 999px;
									background: rgba(255,255,255,0.95);
									box-shadow: 0 8px 28px rgba(0,0,0,0.25);
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
										line-height: 1.2;
										letter-spacing: -0.02em;
										color: #0f172a;
										font-weight: 700;
										font-size: {headlineStyle.fontSize ?? (previewMode ? 28 : 36)}px;
									"
								/>
							</div>
						{:else}
							<div style="text-align: {headlineStyle.align ?? 'center'}; width: 100%;">
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
		{#if layout === 'fit'}
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
					{@render mediaLayer('contain')}
				</div>
			</div>
			{@render subtitleBlock('karaoke')}
		{:else if layout === 'blur'}
			<!-- Blur: blurred fill + sharp middle band -->
			<div style="position: absolute; inset: 0; z-index: 0; overflow: hidden;">
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
							inset: -8%;
							width: 116%;
							height: 116%;
							object-fit: cover;
							filter: blur(28px) brightness(0.85);
							transform: scale(1.08);
						"
					></video>
				{:else if posterSrc}
					<img
						src={posterSrc}
						alt=""
						aria-hidden="true"
						style="
							position: absolute;
							inset: -8%;
							width: 116%;
							height: 116%;
							object-fit: cover;
							filter: blur(28px) brightness(0.85);
							transform: scale(1.08);
						"
					/>
				{/if}
				<div
					style="
						position: absolute;
						inset: 0;
						background: linear-gradient(
							180deg,
							rgba(0,0,0,0.25) 0%,
							transparent 28%,
							transparent 72%,
							rgba(0,0,0,0.35) 100%
						);
					"
				></div>
			</div>

			<div style="position: relative; z-index: 2; flex: 1; display: flex; flex-direction: column; min-height: 0;">
				{@render headlineBlock(true)}
				<div
					style="
						flex: 1;
						min-height: 0;
						display: flex;
						align-items: center;
						justify-content: center;
						padding: 0;
					"
				>
					<div
						style="
							position: relative;
							width: 100%;
							height: 42%;
							min-height: 180px;
							overflow: hidden;
							background: #0a0a0a;
							box-shadow: 0 12px 40px rgba(0,0,0,0.45);
						"
					>
						{@render mediaLayer('cover')}
					</div>
				</div>
				{@render subtitleBlock('plain')}
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
					{@render mediaLayer('cover')}
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

