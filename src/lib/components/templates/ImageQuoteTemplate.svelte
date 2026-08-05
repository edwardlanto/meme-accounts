<script lang="ts">
	import HighlightedText from '$lib/components/HighlightedText.svelte';
	import CanvasMarkupTextBlock from '$lib/components/CanvasMarkupTextBlock.svelte';
	import DraggableBlock from '$lib/components/DraggableBlock.svelte';
	import type { TextElementKind, TextStyle } from '$lib/types';
	import { appendTextShadowCss } from '$lib/textStyleCss';

	interface Props {
		image?: string;
		text?: string;
		highlightColor?: string;
		footerLeft?: string;
		footerRight?: string;
		onFooterLeftChange?: (v: string) => void;
		onFooterRightChange?: (v: string) => void;
		// Style
		topRatio?: number; // portion of height reserved for image (0..1)
		bgColor?: string;
		textColor?: string;
		templateTheme?: 'light' | 'dark';
		canvasW?: number;
		canvasH?: number;
		scale?: number;
		interactive?: boolean;
		exportRef?: HTMLElement | null;
		selectedText?: TextElementKind | null;
		onTextChange?: (t: string) => void;
		onTextSelect?: (kind: TextElementKind, el: HTMLElement) => void;
		onHeadlineRangeSelect?: (start: number, end: number) => void;
		headlineStyle?: TextStyle;
		textOffsets?: Record<string, { x: number; y: number }>;
		onTextOffsetChange?: (kind: TextElementKind, next: { x: number; y: number }) => void;
		showToolbar?: boolean;
	}

	let {
		image = '/templates/image-quote/demo-bg.png',
		text = "IF YOU STILL THINK THE U.S. IS\nFIGHTING IRAN OVER NUCLEAR\nWEAPONS, YOU'VE BEEN FED\nPROPAGANDA. THE U.S. IS\nFIGHTING CHINA. HERE'S THEIR\nSTRATEGY:",
		highlightColor = '#F5A623',
		footerLeft = '$',
		footerRight = 'WEALTHY\nSETUP',
		onFooterLeftChange,
		onFooterRightChange,
		topRatio = 0.54,
		bgColor = '',
		textColor = '',
		templateTheme = 'dark',
		canvasW = 1080,
		canvasH = 1350,
		scale = 1,
		interactive = true,
		exportRef = $bindable(null),
		selectedText = null,
		onTextChange,
		onTextSelect,
		onHeadlineRangeSelect,
		headlineStyle = {},
		textOffsets = {},
		onTextOffsetChange,
		showToolbar = false,
	}: Props = $props();

	const isLight = $derived(templateTheme === 'light');
	const baseBg = $derived((bgColor || (isLight ? '#ffffff' : '#000000')).trim());
	const baseText = $derived((textColor || (isLight ? '#0a0a0a' : '#ffffff')).trim());

	const quoteTypeCss = $derived.by(() => {
		const s = headlineStyle;
		const bits: string[] = [];
		if (s.fontFamily) bits.push(`font-family: '${s.fontFamily}', Impact, 'Arial Black', sans-serif;`);
		if (s.fontSize) bits.push(`font-size: ${s.fontSize}px;`);
		if (s.fontWeight != null) bits.push(`font-weight: ${s.fontWeight};`);
		if (s.italic) bits.push('font-style: italic;');
		if (s.underline) bits.push('text-decoration: underline;');
		if (s.color) bits.push(`color: ${s.color};`);
		if (s.letterSpacing != null) bits.push(`letter-spacing: ${s.letterSpacing}em;`);
		if (s.lineHeight != null) bits.push(`line-height: ${s.lineHeight};`);
		if (s.align) bits.push(`text-align: ${s.align};`);
		appendTextShadowCss(bits, s);
		return bits.join(' ');
	});

	const BASE_W = 1080;
	const BASE_H = 1350;
	const W = $derived(Math.max(320, Number(canvasW) || BASE_W));
	const H = $derived(Math.max(320, Number(canvasH) || BASE_H));
	const layoutScale = $derived(Math.min(W / BASE_W, H / BASE_H));
	const letterInsetX = $derived((W - BASE_W * layoutScale) / 2);
	const letterInsetY = $derived((H - BASE_H * layoutScale) / 2);
	const dragScale = $derived(scale * layoutScale);
	const topH = $derived(Math.round(BASE_H * Math.min(0.75, Math.max(0.35, topRatio))));
	const bottomH = $derived(BASE_H - topH);
	const quoteSize = $derived(headlineStyle.fontSize ?? 72);

	function splitLines(v: string) {
		return (v || '').split('\n').map((x) => x.trim()).filter(Boolean);
	}
</script>

<div
	style="
		width: {W * scale}px;
		height: {H * scale}px;
		overflow: hidden;
		border-radius: {scale < 1 ? '12px' : '0'};
		flex-shrink: 0;
		position: relative;
	"
>
	<div
		bind:this={exportRef}
		style="
			width: {W}px;
			height: {H}px;
			transform: scale({scale});
			transform-origin: top left;
			background: {baseBg};
			font-family: Impact, 'Arial Black', sans-serif;
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
				overflow: hidden;
			"
		>
		<!-- Top image -->
		<div style="height: {topH}px; width: 100%; position: relative; overflow: hidden; background: #111;">
			{#if image}
				<img
					src={image}
					alt=""
					style="
						width: 100%;
						height: 100%;
						object-fit: cover;
						object-position: center top;
						display: block;
					"
				/>
			{/if}
		</div>

		<!-- Bottom quote block -->
		<div
			style="
				height: {bottomH}px;
				width: 100%;
				background: {baseBg};
				display: flex;
				flex-direction: column;
				justify-content: center;
				align-items: center;
				padding: 56px 72px 72px;
				box-sizing: border-box;
				gap: 36px;
			"
		>
			<DraggableBlock
				dx={textOffsets.headline?.x ?? 0}
				dy={textOffsets.headline?.y ?? 0}
				{interactive}
				scale={dragScale}
				onChange={(x, y) => onTextOffsetChange?.('headline', { x, y })}
			>
				{#snippet children()}
					<CanvasMarkupTextBlock
						value={text}
						{interactive}
						defaultColor={highlightColor}
						selected={selectedText === 'headline'}
						rows={6}
						uppercase={true}
						ariaLabel="Quote text"
						fontFamily={headlineStyle.fontFamily ?? 'Impact'}
						fontSize={quoteSize}
						{showToolbar}
						onTextChange={onTextChange}
						onTextSelect={onTextSelect}
						onHeadlineRangeSelect={onHeadlineRangeSelect}
					>
						{#snippet display()}
							<div style="display:flex;flex-direction:column;gap:6px;width:100%;">
								{#each splitLines(text) as line, i (i)}
									<HighlightedText
										as="div"
										text={line}
										defaultColor={highlightColor}
										style="color: {baseText}; font-weight: 900; text-transform: uppercase; letter-spacing: 0.01em; line-height: 1.05; font-size: {quoteSize}px; text-align: center; font-family: Impact, 'Arial Black', sans-serif; {quoteTypeCss}"
									/>
								{/each}
							</div>
						{/snippet}
					</CanvasMarkupTextBlock>
				{/snippet}
			</DraggableBlock>

			<!-- Footer -->
			<div
				style="
					display:flex;
					align-items:center;
					justify-content:center;
					gap: 12px;
					opacity: 0.95;
				"
			>
				<DraggableBlock
					dx={textOffsets.imageQuoteFooterLeft?.x ?? 0}
					dy={textOffsets.imageQuoteFooterLeft?.y ?? 0}
					{interactive}
					scale={dragScale}
					onChange={(x, y) => onTextOffsetChange?.('imageQuoteFooterLeft', { x, y })}
				>
					{#snippet children()}
						<CanvasMarkupTextBlock
							value={footerLeft}
							{interactive}
							rows={1}
							{showToolbar}
							toolbarKind="imageQuoteFooterLeft"
							selected={selectedText === 'imageQuoteFooterLeft'}
							ariaLabel="Footer left"
							fontFamily={headlineStyle.fontFamily ?? 'Impact'}
							fontSize={40}
							onTextChange={onFooterLeftChange}
							onTextSelect={onTextSelect}
						>
							{#snippet display()}
								<span style="font-size: 40px; font-weight: 900; color: {baseText}; font-family: Impact, 'Arial Black', sans-serif; line-height: 1;">
									{footerLeft}
								</span>
							{/snippet}
						</CanvasMarkupTextBlock>
					{/snippet}
				</DraggableBlock>

				<DraggableBlock
					dx={textOffsets.imageQuoteFooterRight?.x ?? 0}
					dy={textOffsets.imageQuoteFooterRight?.y ?? 0}
					{interactive}
					scale={dragScale}
					onChange={(x, y) => onTextOffsetChange?.('imageQuoteFooterRight', { x, y })}
				>
					{#snippet children()}
						<CanvasMarkupTextBlock
							value={footerRight}
							{interactive}
							rows={2}
							{showToolbar}
							toolbarKind="imageQuoteFooterRight"
							selected={selectedText === 'imageQuoteFooterRight'}
							ariaLabel="Footer right"
							fontFamily="Satoshi"
							fontSize={18}
							onTextChange={onFooterRightChange}
							onTextSelect={onTextSelect}
						>
							{#snippet display()}
								<span style="font-size: 18px; font-weight: 800; color: {baseText}; letter-spacing: 0.14em; font-family: 'Satoshi', system-ui, sans-serif; text-transform: uppercase; line-height: 1.15; text-align: left; white-space: pre-line;">
									{footerRight}
								</span>
							{/snippet}
						</CanvasMarkupTextBlock>
					{/snippet}
				</DraggableBlock>
			</div>
		</div>
		</div>
	</div>
</div>
