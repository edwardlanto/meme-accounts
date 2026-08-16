<script lang="ts">
	import { FONT_TEMPLATE_DEFAULT } from '$lib/fonts/brand-fonts';
	import CanvasMarkupTextBlock from '$lib/components/CanvasMarkupTextBlock.svelte';
	import DraggableBlock from '$lib/components/DraggableBlock.svelte';
	import HighlightedText from '$lib/components/HighlightedText.svelte';
	import type { TextElementKind, TextStyle } from '$lib/types';
	import { canvasFontFamilyStack, loadGoogleFont } from '$lib/fonts';
	import { textBgCss, textShadowStyleAttr } from '$lib/textStyleCss';
	import {
		PHOTO_CAPTION_DEFAULTS,
		PHOTO_TOPIC_DEFAULTS,
		PHOTO_TOPIC_BODY_STYLE,
		PHOTO_TOPIC_HEADLINE_STYLE,
	} from '$lib/studio/slide-content-defaults';

	interface Props {
		/** `topic` = image top / text bottom; `caption` = full-bleed photo + top text */
		layout?: 'topic' | 'caption';
		backgroundImage?: string;
		headline?: string;
		body?: string;
		headlineColor?: string;
		w?: number;
		h?: number;
		scale?: number;
		interactive?: boolean;
		exportRef?: HTMLElement | null;
		selectedText?: TextElementKind | null;
		highlightColor?: string;
		headlineStyle?: TextStyle;
		bodyStyle?: TextStyle;
		textOffsets?: Record<string, { x: number; y: number }>;
		onTextOffsetChange?: (kind: string, next: { x: number; y: number }) => void;
		onHeadlineChange?: (v: string) => void;
		onBodyChange?: (v: string) => void;
		onTextSelect?: (kind: TextElementKind, el: HTMLElement) => void;
		onHeadlineRangeSelect?: (start: number, end: number) => void;
		showToolbar?: boolean;
		previewMode?: boolean;
	}

	let {
		layout = 'topic',
		backgroundImage = '',
		headline = PHOTO_TOPIC_DEFAULTS.headline,
		body = PHOTO_TOPIC_DEFAULTS.body,
		headlineColor = PHOTO_TOPIC_DEFAULTS.headlineColor,
		w = 1080,
		h = 1920,
		scale = 1,
		interactive = true,
		exportRef = $bindable(null),
		selectedText = null,
		highlightColor = '#FFEB3B',
		headlineStyle = {},
		bodyStyle = {},
		textOffsets = {},
		onTextOffsetChange,
		onHeadlineChange,
		onBodyChange,
		onTextSelect,
		onHeadlineRangeSelect,
		showToolbar = false,
		previewMode = false,
	}: Props = $props();

	const isTopic = $derived(layout === 'topic');
	const imgSrc = $derived(
		(backgroundImage && backgroundImage.trim()) ||
			(isTopic ? PHOTO_TOPIC_DEFAULTS.imageUrl : PHOTO_CAPTION_DEFAULTS.imageUrl),
	);

	const topicHeadlineSize = $derived(
		headlineStyle.fontSize ?? (previewMode ? 42 : PHOTO_TOPIC_HEADLINE_STYLE.fontSize),
	);
	const topicBodySize = $derived(
		bodyStyle.fontSize ?? (previewMode ? 14 : PHOTO_TOPIC_BODY_STYLE.fontSize),
	);
	const captionTextSize = $derived(
		headlineStyle.fontSize ?? (previewMode ? 16 : 36),
	);

	const topicHeadlineFamily = $derived(
		headlineStyle.fontFamily ?? PHOTO_TOPIC_HEADLINE_STYLE.fontFamily,
	);
	const topicBodyFamily = $derived(bodyStyle.fontFamily ?? PHOTO_TOPIC_BODY_STYLE.fontFamily);

	$effect(() => {
		if (!isTopic) return;
		void loadGoogleFont(topicHeadlineFamily, 400);
		void loadGoogleFont(topicBodyFamily, bodyStyle.fontWeight ?? 400);
	});
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
		{#if isTopic}
			<!-- Topic: tall image (~62%) + black band; title straddles the seam -->
			<div
				style="
					position: relative;
					flex: 0 0 62%;
					min-height: 0;
					overflow: hidden;
				"
			>
				<img
					src={imgSrc}
					alt=""
					draggable="false"
					style="
						position: absolute;
						inset: 0;
						width: 100%;
						height: 100%;
						object-fit: cover;
						object-position: center top;
						display: block;
						pointer-events: none;
					"
				/>
				<div
					style="
						position: absolute;
						left: 0;
						right: 0;
						bottom: 0;
						height: 48%;
						background: linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.55) 55%, #000 100%);
						pointer-events: none;
					"
				></div>

				<!-- Title sits on the image→black seam -->
				<div
					style="
						position: absolute;
						left: 0;
						right: 0;
						bottom: {previewMode ? '-6px' : '-14px'};
						z-index: 5;
						padding: 0 {previewMode ? '18px' : '48px'};
						box-sizing: border-box;
						display: flex;
						justify-content: center;
					"
				>
					<DraggableBlock
						dx={textOffsets.blackTextHeadline?.x ?? 0}
						dy={textOffsets.blackTextHeadline?.y ?? 0}
						{interactive}
						{scale}
						immediateTextDrag={selectedText === 'blackTextHeadline'}
						onChange={(x, y) => onTextOffsetChange?.('blackTextHeadline', { x, y })}
					>
						{#snippet children()}
							<CanvasMarkupTextBlock
								value={headline}
								{interactive}
								defaultColor={headlineColor}
								selected={selectedText === 'blackTextHeadline'}
								toolbarKind="blackTextHeadline"
								rows={2}
								minHeight="0px"
								ariaLabel="Topic headline"
								fontFamily={topicHeadlineFamily}
								fontSize={topicHeadlineSize}
								lineHeight={headlineStyle.lineHeight}
								{showToolbar}
								onTextChange={onHeadlineChange}
								onTextSelect={onTextSelect}
								onHeadlineRangeSelect={onHeadlineRangeSelect}
							>
								{#snippet display()}
									<div style="text-align: center; width: 100%;">
										<HighlightedText
											as="div"
											text={headline}
											defaultColor={highlightColor}
											parseHighlights={true}
											baseFontWeight={headlineStyle.fontWeight ?? 400}
											style="
												margin: 0;
												white-space: pre-wrap;
												word-break: break-word;
												text-transform: uppercase;
												font-family: {canvasFontFamilyStack(topicHeadlineFamily)};
												letter-spacing: {headlineStyle.letterSpacing ?? PHOTO_TOPIC_HEADLINE_STYLE.letterSpacing}em;
												line-height: {headlineStyle.lineHeight ?? PHOTO_TOPIC_HEADLINE_STYLE.lineHeight};
												color: {headlineStyle.color ?? headlineColor};
												font-weight: {headlineStyle.fontWeight ?? 400};
												font-size: {topicHeadlineSize}px;
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

			<div
				style="
					flex: 1;
					min-height: 0;
					display: flex;
					flex-direction: column;
					align-items: center;
					justify-content: flex-start;
					padding: {previewMode
						? `${Math.round(topicHeadlineSize * 0.55) + 20}px 22px 28px`
						: `${Math.round(topicHeadlineSize * 0.55) + 36}px 72px 72px`};
					box-sizing: border-box;
					background: #000;
				"
			>
				<DraggableBlock
					dx={textOffsets.blackTextBody?.x ?? 0}
					dy={textOffsets.blackTextBody?.y ?? 0}
					{interactive}
					{scale}
					immediateTextDrag={selectedText === 'blackTextBody'}
					onChange={(x, y) => onTextOffsetChange?.('blackTextBody', { x, y })}
				>
					{#snippet children()}
						<CanvasMarkupTextBlock
							value={body}
							{interactive}
							defaultColor="#ffffff"
							selected={selectedText === 'blackTextBody'}
							toolbarKind="blackTextBody"
							rows={6}
							minHeight="0px"
							ariaLabel="Topic body"
							fontFamily={topicBodyFamily}
							fontSize={topicBodySize}
							lineHeight={bodyStyle.lineHeight}
							{showToolbar}
							onTextChange={onBodyChange}
							onTextSelect={onTextSelect}
							onHeadlineRangeSelect={onHeadlineRangeSelect}
						>
							{#snippet display()}
								<div style="text-align: center; width: 100%; max-width: 920px; margin: 0 auto;">
									<HighlightedText
										as="div"
										text={body}
										defaultColor={highlightColor}
										parseHighlights={true}
										baseFontWeight={bodyStyle.fontWeight ?? 400}
										style="
											margin: 0;
											white-space: pre-wrap;
											word-break: break-word;
											font-family: '{topicBodyFamily}', 'Helvetica Neue', Arial, sans-serif;
											line-height: {bodyStyle.lineHeight ?? PHOTO_TOPIC_BODY_STYLE.lineHeight};
											letter-spacing: -0.01em;
											color: {bodyStyle.color ?? '#ffffff'};
											font-weight: {bodyStyle.fontWeight ?? 400};
											font-size: {topicBodySize}px;
											{textShadowStyleAttr(bodyStyle)}
											{textBgCss(bodyStyle)}
										"
									/>
								</div>
							{/snippet}
						</CanvasMarkupTextBlock>
					{/snippet}
				</DraggableBlock>
			</div>
		{:else}
			<!-- Caption: full-bleed photo + dark top gradient + left text (no arrows) -->
			<img
				src={imgSrc}
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
			<div
				style="
					position: absolute;
					left: 0;
					right: 0;
					top: 0;
					height: 48%;
					background: linear-gradient(180deg, rgba(0,0,0,0.88) 0%, rgba(0,0,0,0.55) 55%, rgba(0,0,0,0) 100%);
					pointer-events: none;
					z-index: 1;
				"
			></div>

			<div
				style="
					position: relative;
					z-index: 5;
					padding: {previewMode ? '22px 20px 0' : '72px 64px 0'};
					box-sizing: border-box;
					display: flex;
					flex-direction: column;
					gap: {previewMode ? '14px' : '32px'};
					max-width: 100%;
				"
			>
				<DraggableBlock
					dx={textOffsets.blackTextHeadline?.x ?? 0}
					dy={textOffsets.blackTextHeadline?.y ?? 0}
					{interactive}
					{scale}
					immediateTextDrag={selectedText === 'blackTextHeadline'}
					onChange={(x, y) => onTextOffsetChange?.('blackTextHeadline', { x, y })}
				>
					{#snippet children()}
						<CanvasMarkupTextBlock
							value={headline}
							{interactive}
							defaultColor="#ffffff"
							selected={selectedText === 'blackTextHeadline'}
							toolbarKind="blackTextHeadline"
							rows={4}
							minHeight="0px"
							ariaLabel="Caption lead"
							fontFamily={headlineStyle.fontFamily ?? FONT_TEMPLATE_DEFAULT}
							fontSize={captionTextSize}
							lineHeight={headlineStyle.lineHeight}
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
										baseFontWeight={headlineStyle.fontWeight ?? 500}
										style="
											margin: 0;
											white-space: pre-wrap;
											word-break: break-word;
											line-height: {headlineStyle.lineHeight ?? 1.35};
											letter-spacing: -0.02em;
											color: #ffffff;
											font-weight: {headlineStyle.fontWeight ?? 500};
											font-size: {captionTextSize}px;
											text-shadow: {headlineStyle.textShadow ?? '0 2px 16px rgba(0,0,0,0.45)'};
											{textBgCss(headlineStyle)}
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
					immediateTextDrag={selectedText === 'blackTextBody'}
					onChange={(x, y) => onTextOffsetChange?.('blackTextBody', { x, y })}
				>
					{#snippet children()}
						<CanvasMarkupTextBlock
							value={body}
							{interactive}
							defaultColor="#ffffff"
							selected={selectedText === 'blackTextBody'}
							toolbarKind="blackTextBody"
							rows={4}
							minHeight="0px"
							ariaLabel="Caption body"
							fontFamily={bodyStyle.fontFamily ?? FONT_TEMPLATE_DEFAULT}
							fontSize={captionTextSize}
							lineHeight={bodyStyle.lineHeight}
							{showToolbar}
							onTextChange={onBodyChange}
							onTextSelect={onTextSelect}
							onHeadlineRangeSelect={onHeadlineRangeSelect}
						>
							{#snippet display()}
								<div style="text-align: left; width: 100%;">
									<HighlightedText
										as="div"
										text={body}
										parseHighlights={true}
										baseFontWeight={bodyStyle.fontWeight ?? 500}
										style="
											margin: 0;
											white-space: pre-wrap;
											word-break: break-word;
											line-height: {bodyStyle.lineHeight ?? 1.35};
											letter-spacing: -0.02em;
											color: #ffffff;
											font-weight: {bodyStyle.fontWeight ?? 500};
											font-size: {captionTextSize}px;
											text-shadow: {bodyStyle.textShadow ?? '0 2px 16px rgba(0,0,0,0.45)'};
											{textBgCss(bodyStyle)}
										"
									/>
								</div>
							{/snippet}
						</CanvasMarkupTextBlock>
					{/snippet}
				</DraggableBlock>
			</div>
		{/if}
	</div>
</div>
