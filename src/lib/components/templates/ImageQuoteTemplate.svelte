<script lang="ts">
	import HighlightedText from '$lib/components/HighlightedText.svelte';
	import CanvasMarkupTextBlock from '$lib/components/CanvasMarkupTextBlock.svelte';
	import DraggableBlock from '$lib/components/DraggableBlock.svelte';
	import type { TextElementKind, TextStyle } from '$lib/types';

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
		text = 'YOUR BIG STATEMENT GOES HERE.\nMAKE IT SHORT, PUNCHY, AND ALL CAPS.',
		highlightColor = '#F5A623',
		footerLeft = '$',
		footerRight = 'BRAND',
		onFooterLeftChange,
		onFooterRightChange,
		topRatio = 0.56,
		bgColor = '',
		textColor = '',
		templateTheme = 'light',
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
		if (s.fontFamily) bits.push(`font-family: '${s.fontFamily}', Impact, 'Arial Black', 'Inter', system-ui, sans-serif;`);
		if (s.fontSize) bits.push(`font-size: ${s.fontSize}px;`);
		if (s.fontWeight != null) bits.push(`font-weight: ${s.fontWeight};`);
		if (s.italic) bits.push('font-style: italic;');
		if (s.underline) bits.push('text-decoration: underline;');
		if (s.color) bits.push(`color: ${s.color};`);
		if (s.letterSpacing != null) bits.push(`letter-spacing: ${s.letterSpacing}em;`);
		if (s.lineHeight != null) bits.push(`line-height: ${s.lineHeight};`);
		if (s.align) bits.push(`text-align: ${s.align};`);
		return bits.join(' ');
	});

	const W = 1080;
	const H = 1350;
	const topH = $derived(Math.round(H * Math.min(0.75, Math.max(0.35, topRatio))));
	const bottomH = $derived(H - topH);

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
			display: flex;
			flex-direction: column;
			font-family: 'Inter', system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
			overflow: hidden;
		"
	>
		<!-- Top image -->
		<div style="height: {topH}px; width: 100%; position: relative; overflow: hidden; background: {isLight ? '#f1f2f6' : '#111'};">
			{#if image}
				<img
					src={image}
					alt=""
					style="
						width: 100%;
						height: 100%;
						object-fit: cover;
						display: block;
						filter: contrast(1.05) saturate(1.05);
					"
				/>
			{/if}
			<!-- subtle top vignette -->
			<div style="position:absolute;inset:0;background:linear-gradient(to bottom, rgba(0,0,0,0.28), rgba(0,0,0,0) 45%);pointer-events:none;"></div>
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
				padding: 86px 84px 66px;
				box-sizing: border-box;
				gap: 28px;
			"
		>
			<DraggableBlock
				dx={textOffsets.headline?.x ?? 0}
				dy={textOffsets.headline?.y ?? 0}
				{interactive}
				{scale}
				onChange={(x, y) => onTextOffsetChange?.('headline', { x, y })}
			>
				{#snippet children()}
					<CanvasMarkupTextBlock
						value={text}
						{interactive}
						defaultColor={highlightColor}
						selected={selectedText === 'headline'}
						rows={5}
						uppercase={true}
						ariaLabel="Quote text"
						fontFamily={headlineStyle.fontFamily ?? 'Impact'}
						fontSize={headlineStyle.fontSize ?? 82}
						{showToolbar}
						onTextChange={onTextChange}
						onTextSelect={onTextSelect}
						onHeadlineRangeSelect={onHeadlineRangeSelect}
					>
						{#snippet display()}
							<div style="display:flex;flex-direction:column;gap:18px;">
								{#each splitLines(text) as line, i (i)}
									<HighlightedText
										as="div"
										text={line}
										defaultColor={highlightColor}
										style="color: {baseText}; font-weight: 900; text-transform: uppercase; letter-spacing: 0.02em; line-height: 1.02; font-size: 82px; text-align: center; text-shadow: 0 2px 0 rgba(0,0,0,{isLight ? 0.10 : 0.4}); font-family: Impact, 'Arial Black', 'Inter', system-ui, sans-serif; {quoteTypeCss}"
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
					margin-top: 10px;
					display:flex;
					align-items:center;
					justify-content:center;
					gap: 14px;
					opacity: 0.95;
				"
			>
				<DraggableBlock
					dx={textOffsets.imageQuoteFooterLeft?.x ?? 0}
					dy={textOffsets.imageQuoteFooterLeft?.y ?? 0}
					{interactive}
					{scale}
					onChange={(x, y) => onTextOffsetChange?.('imageQuoteFooterLeft', { x, y })}
				>
					{#snippet children()}
						<CanvasMarkupTextBlock
							value={footerLeft}
							{interactive}
							rows={1}
							showToolbar={false}
							toolbarKind="imageQuoteFooterLeft"
							selected={selectedText === 'imageQuoteFooterLeft'}
							ariaLabel="Footer left"
							fontFamily={headlineStyle.fontFamily ?? 'Impact'}
							fontSize={44}
							onTextChange={onFooterLeftChange}
							onTextSelect={onTextSelect}
						>
							{#snippet display()}
								<span style="font-size: 44px; font-weight: 900; color: {baseText}; font-family: Impact, 'Arial Black', 'Inter', system-ui, sans-serif;">
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
					{scale}
					onChange={(x, y) => onTextOffsetChange?.('imageQuoteFooterRight', { x, y })}
				>
					{#snippet children()}
						<CanvasMarkupTextBlock
							value={footerRight}
							{interactive}
							rows={1}
							showToolbar={false}
							toolbarKind="imageQuoteFooterRight"
							selected={selectedText === 'imageQuoteFooterRight'}
							ariaLabel="Footer right"
							fontFamily={headlineStyle.fontFamily ?? 'Inter'}
							fontSize={26}
							onTextChange={onFooterRightChange}
							onTextSelect={onTextSelect}
						>
							{#snippet display()}
								<span style="font-size: 26px; font-weight: 800; color: {baseText}; letter-spacing: 0.08em; font-family: 'Inter', system-ui, sans-serif;">
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

