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
		/** Preferred image height fraction (0–1). Bottom panel grows with copy and can push this down. */
		topRatio?: number;
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
		text = "THE COMPANIES WINNING THE NEXT DECADE AREN'T THE ONES WITH THE MOST DATA.\n\nTHEY'RE THE ONES THAT SHIP WHILE EVERYONE ELSE IS STILL IN A MEETING.",
		highlightColor = '#F5A623',
		footerLeft = '$',
		footerRight = 'OPERATOR\nNOTES',
		onFooterLeftChange,
		onFooterRightChange,
		topRatio = 0.48,
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

	/** Soft-wrap copy: collapse single newlines so CSS wraps; keep paragraph breaks. */
	const displayText = $derived(
		String(text ?? '')
			.replace(/\r\n/g, '\n')
			.replace(/[ \t]+\n/g, '\n')
			.replace(/\n{3,}/g, '\n\n')
			.replace(/([^\n])\n(?!\n)/g, '$1 ')
			.replace(/[ \t]{2,}/g, ' ')
			.trim(),
	);

	const plainLen = $derived(displayText.replace(/\s+/g, ' ').length);

	/** Auto size so the black panel can wrap the quote without overflowing into the photo. */
	const autoQuoteSize = $derived.by(() => {
		const n = plainLen;
		if (n <= 70) return 68;
		if (n <= 110) return 58;
		if (n <= 160) return 50;
		if (n <= 220) return 44;
		return 38;
	});
	const quoteSize = $derived(headlineStyle.fontSize ?? autoQuoteSize);

	const preferredTopH = $derived(
		Math.round(BASE_H * Math.min(0.72, Math.max(0.28, Number(topRatio) || 0.48))),
	);
	/** Bottom never smaller than footer+padding; never taller than ~62% so photo still shows. */
	const maxBottomH = $derived(Math.round(BASE_H * 0.62));
	const minBottomH = $derived(Math.round(BASE_H * 0.32));
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
			<!-- Top image — fills leftover space after the quote panel -->
			<div
				data-text-selectable={interactive ? 'articleImage' : undefined}
				role={interactive ? 'button' : undefined}
				tabindex={interactive ? 0 : undefined}
				aria-label={interactive ? 'Quote image' : undefined}
				onclick={(e) => {
					if (!interactive || !onTextSelect) return;
					e.stopPropagation();
					onTextSelect('articleImage', e.currentTarget as HTMLElement);
				}}
				onkeydown={(e) => {
					if (!interactive || !onTextSelect) return;
					if (e.key === 'Enter' || e.key === ' ') {
						e.preventDefault();
						onTextSelect('articleImage', e.currentTarget as HTMLElement);
					}
				}}
				style="
					flex: 1 1 {preferredTopH}px;
					min-height: {BASE_H - maxBottomH}px;
					max-height: {BASE_H - minBottomH}px;
					width: 100%;
					position: relative;
					overflow: hidden;
					background: #111;
					cursor: {interactive && onTextSelect ? 'pointer' : 'default'};
					outline: {selectedText === 'articleImage' ? '3px solid rgba(167,139,250,0.85)' : 'none'};
					outline-offset: -3px;
				"
			>
				{#if image}
					<img
						src={image}
						alt=""
						draggable="false"
						style="
							width: 100%;
							height: 100%;
							object-fit: cover;
							object-position: center top;
							display: block;
							pointer-events: none;
						"
					/>
				{/if}
			</div>

			<!-- Black quote panel — always wraps text + logo -->
			<div
				class="iq-quote-panel"
				style="
					flex: 0 1 auto;
					min-height: {minBottomH}px;
					max-height: {maxBottomH}px;
					width: 100%;
					background: {baseBg};
					display: flex;
					flex-direction: column;
					justify-content: space-between;
					align-items: stretch;
					padding: 48px 64px 56px;
					box-sizing: border-box;
					gap: 28px;
					overflow: hidden;
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
								<HighlightedText
									as="div"
									text={displayText}
									defaultColor={highlightColor}
									style="
										color: {baseText};
										font-weight: 900;
										text-transform: uppercase;
										letter-spacing: 0.01em;
										line-height: 1.12;
										font-size: {quoteSize}px;
										text-align: center;
										font-family: Impact, 'Arial Black', sans-serif;
										white-space: pre-wrap;
										overflow-wrap: break-word;
										word-break: normal;
										hyphens: none;
										width: 100%;
										{quoteTypeCss}
									"
								/>
							{/snippet}
						</CanvasMarkupTextBlock>
					{/snippet}
				</DraggableBlock>

				<!-- Footer / logo — always reserved -->
				<div
					class="iq-footer"
					style="
						display: flex;
						align-items: center;
						justify-content: center;
						gap: 14px;
						flex-shrink: 0;
						padding-top: 8px;
						opacity: 1;
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
								fontSize={44}
								onTextChange={onFooterLeftChange}
								onTextSelect={onTextSelect}
							>
								{#snippet display()}
									<span
										style="
											font-size: 44px;
											font-weight: 900;
											color: {baseText};
											font-family: Impact, 'Arial Black', sans-serif;
											line-height: 1;
											display: inline-block;
											min-height: 1em;
											min-width: {footerLeft ? '0' : '0.6em'};
										"
									>
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
								fontSize={22}
								onTextChange={onFooterRightChange}
								onTextSelect={onTextSelect}
							>
								{#snippet display()}
									<span
										style="
											font-size: 22px;
											font-weight: 800;
											color: {baseText};
											letter-spacing: 0.16em;
											font-family: 'Satoshi', system-ui, sans-serif;
											text-transform: uppercase;
											line-height: 1.2;
											text-align: left;
											white-space: pre-line;
											display: inline-block;
											min-height: 1.2em;
											min-width: {footerRight ? '0' : '4em'};
										"
									>
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
