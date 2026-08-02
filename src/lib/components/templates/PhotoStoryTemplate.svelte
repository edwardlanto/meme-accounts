<script lang="ts">
	import CanvasMarkupTextBlock from '$lib/components/CanvasMarkupTextBlock.svelte';
	import DraggableBlock from '$lib/components/DraggableBlock.svelte';
	import HighlightedText from '$lib/components/HighlightedText.svelte';
	import type { TextElementKind, TextStyle } from '$lib/types';
	import {
		PHOTO_CAPTION_DEFAULTS,
		PHOTO_TOPIC_DEFAULTS,
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
		highlightColor = '#2EE6C5',
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
		headlineStyle.fontSize ?? (previewMode ? 28 : 56),
	);
	const topicBodySize = $derived(bodyStyle.fontSize ?? (previewMode ? 14 : 30));
	const captionTextSize = $derived(
		headlineStyle.fontSize ?? (previewMode ? 16 : 36),
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
		{#if isTopic}
			<!-- Topic: cinematic image on top, title + body on black below -->
			<div
				style="
					position: relative;
					flex: 0 0 54%;
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
						bottom: 0;
						height: 42%;
						background: linear-gradient(180deg, rgba(0,0,0,0) 0%, #000 92%);
						pointer-events: none;
					"
				></div>
			</div>

			<div
				style="
					flex: 1;
					min-height: 0;
					display: flex;
					flex-direction: column;
					align-items: center;
					justify-content: flex-start;
					padding: {previewMode ? '18px 22px 28px' : '36px 72px 80px'};
					box-sizing: border-box;
					gap: {previewMode ? '12px' : '28px'};
					background: #000;
				"
			>
				<DraggableBlock
					dx={textOffsets.blackTextHeadline?.x ?? 0}
					dy={textOffsets.blackTextHeadline?.y ?? 0}
					{interactive}
					{scale}
					onChange={(x, y) => onTextOffsetChange?.('blackTextHeadline', { x, y })}
				>
					{#snippet children()}
						<CanvasMarkupTextBlock
							value={headline}
							{interactive}
							defaultColor={headlineColor}
							selected={selectedText === 'blackTextHeadline'}
							toolbarKind="blackTextHeadline"
							rows={3}
							minHeight="0px"
							ariaLabel="Topic headline"
							fontFamily={headlineStyle.fontFamily ?? 'Satoshi'}
							fontSize={topicHeadlineSize}
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
										parseHighlights={false}
										style="
											margin: 0;
											white-space: pre-wrap;
											word-break: break-word;
											text-transform: uppercase;
											letter-spacing: 0.04em;
											line-height: 1.12;
											color: {headlineStyle.color ?? headlineColor};
											font-weight: {headlineStyle.fontWeight ?? 800};
											font-size: {topicHeadlineSize}px;
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
							fontFamily={bodyStyle.fontFamily ?? 'Satoshi'}
							fontSize={topicBodySize}
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
										parseHighlights={false}
										style="
											margin: 0;
											white-space: pre-wrap;
											word-break: break-word;
											line-height: 1.45;
											letter-spacing: -0.01em;
											color: {bodyStyle.color ?? '#ffffff'};
											font-weight: {bodyStyle.fontWeight ?? 400};
											font-size: {topicBodySize}px;
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
							fontFamily={headlineStyle.fontFamily ?? 'Satoshi'}
							fontSize={captionTextSize}
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
										parseHighlights={false}
										style="
											margin: 0;
											white-space: pre-wrap;
											word-break: break-word;
											line-height: 1.35;
											letter-spacing: -0.02em;
											color: #ffffff;
											font-weight: {headlineStyle.fontWeight ?? 500};
											font-size: {captionTextSize}px;
											text-shadow: 0 2px 16px rgba(0,0,0,0.45);
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
							fontFamily={bodyStyle.fontFamily ?? 'Satoshi'}
							fontSize={captionTextSize}
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
										parseHighlights={false}
										style="
											margin: 0;
											white-space: pre-wrap;
											word-break: break-word;
											line-height: 1.35;
											letter-spacing: -0.02em;
											color: #ffffff;
											font-weight: {bodyStyle.fontWeight ?? 500};
											font-size: {captionTextSize}px;
											text-shadow: 0 2px 16px rgba(0,0,0,0.45);
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
