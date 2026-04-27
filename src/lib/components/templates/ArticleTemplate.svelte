<script lang="ts">
	import HighlightedText from '$lib/components/HighlightedText.svelte';
	import CanvasMarkupTextBlock from '$lib/components/CanvasMarkupTextBlock.svelte';
	import DraggableBlock from '$lib/components/DraggableBlock.svelte';
	import type { TextElementKind, TextStyle } from '$lib/types';

	interface Props {
		// Content
		text?: string;
		image?: string;
		// Style
		accentColor?: string;
		bgColor?: string;
		templateTheme?: 'light' | 'dark';
		// Bottom bar
		logoSrc?: string;
		logoRingColor?: string;
		showSwipe?: boolean;
		swipeText?: string;
		onSwipeTextChange?: (v: string) => void;
		// Rendering
		scale?: number;
		interactive?: boolean;
		exportRef?: HTMLElement | null;
		selectedText?: TextElementKind | null;
		onTextChange?: (t: string) => void;
		onTextSelect?: (kind: TextElementKind, el: HTMLElement) => void;
		onHeadlineRangeSelect?: (start: number, end: number) => void;
		headlineStyle?: TextStyle;
		textOffsets?: Record<string, { x: number; y: number }>;
		onTextOffsetChange?: (kind: string, next: { x: number; y: number }) => void;
		/** Optional per-field style overrides (font/size/color/etc). */
		articleStyles?: Partial<Record<
			| 'articleBody'
			| 'articleSwipeText',
			TextStyle
		>>;
		/** When true, inline highlight controls show while editing (no parent floating toolbar). */
		showToolbar?: boolean;
	}

	let {
		text         = "Here's the trillion-dollar problem everyone avoids.\n\nTo break it down:\n\nA *1-gigawatt AI data center* costs roughly *$80B* to build & operate.",
		image        = '',
		accentColor  = '#3ecf8e',
		bgColor      = '',
		templateTheme = 'light',
		logoSrc      = '',
		logoRingColor = '#c9b97a',
		showSwipe    = true,
		swipeText    = '«« Swipe',
		onSwipeTextChange,
		scale        = 1,
		interactive  = true,
		exportRef    = $bindable(null),
		selectedText = null,
		onTextChange,
		onTextSelect,
		onHeadlineRangeSelect,
		headlineStyle = {},
		articleStyles = {},
		textOffsets = {},
		onTextOffsetChange,
		showToolbar = false,
	}: Props = $props();

	const isLight = $derived(templateTheme === 'light');
	const baseBg = $derived((bgColor || (isLight ? '#ffffff' : '#000000')).trim());
	const baseText = $derived(isLight ? '#0a0a0a' : '#ffffff');

	const bodyTypeCss = $derived.by(() => {
		const s = headlineStyle;
		const bits: string[] = [];
		if (s.fontFamily) bits.push(`font-family: '${s.fontFamily}', -apple-system, 'SF Pro Text', sans-serif;`);
		if (s.fontSize) bits.push(`font-size: ${s.fontSize}px;`);
		if (s.fontWeight != null) bits.push(`font-weight: ${s.fontWeight};`);
		if (s.italic) bits.push('font-style: italic;');
		if (s.underline) bits.push('text-decoration: underline;');
		if (s.color) bits.push(`color: ${s.color};`);
		if (s.letterSpacing != null) bits.push(`letter-spacing: ${s.letterSpacing}em;`);
		if (s.lineHeight != null) bits.push(`line-height: ${s.lineHeight};`);
		return bits.join(' ');
	});

	function styleCss(s: TextStyle) {
		const bits: string[] = [];
		if (s.fontFamily) bits.push(`font-family: '${s.fontFamily}', -apple-system, 'SF Pro Text', sans-serif;`);
		if (s.fontSize) bits.push(`font-size: ${s.fontSize}px;`);
		if (s.fontWeight != null) bits.push(`font-weight: ${s.fontWeight};`);
		if (s.italic) bits.push('font-style: italic;');
		if (s.underline) bits.push('text-decoration: underline;');
		if (s.color) bits.push(`color: ${s.color};`);
		if (s.bgColor) {
			bits.push(`background: ${s.bgColor};`);
			bits.push('box-decoration-break: clone; -webkit-box-decoration-break: clone;');
			bits.push('padding: 0.08em 0.18em;');
			bits.push('border-radius: 0.18em;');
		}
		if (s.align) bits.push(`text-align: ${s.align};`);
		if (s.letterSpacing != null) bits.push(`letter-spacing: ${s.letterSpacing}em;`);
		if (s.lineHeight != null) bits.push(`line-height: ${s.lineHeight};`);
		return bits.join(' ');
	}

	const bodyCss = $derived(styleCss(articleStyles.articleBody ?? {}));
	const swipeCss = $derived(styleCss(articleStyles.articleSwipeText ?? {}));

	const W = 1080;
	const H = 1350;

	// Back-compat: old Article content used *accent* markup.
	// We normalize it to the shared [[...]] highlight markup so highlights remain visible while editing.
	function normalizeArticleMarkup(raw: string) {
		const s = (raw ?? '').toString();
		if (s.includes('[[')) return s;
		return s.replace(/\*([^*\n]+)\*/g, (_, inner) => `[[${inner}]]`);
	}

	const normalizedText = $derived(normalizeArticleMarkup(text));
</script>

<div style="
	width: {W * scale}px;
	height: {H * scale}px;
	overflow: hidden;
	border-radius: {scale < 1 ? '12px' : '0'};
	flex-shrink: 0;
	position: relative;
">
	<div
		bind:this={exportRef}
		style="
			width: {W}px;
			height: {H}px;
			position: relative;
			background: {baseBg};
			transform: scale({scale});
			transform-origin: top left;
			font-family: -apple-system, 'SF Pro Text', 'Helvetica Neue', Arial, sans-serif;
			display: flex;
			flex-direction: column;
			box-sizing: border-box;
			overflow: hidden;
		"
	>
		<!-- ── Main content ──────────────────────────────────────────────────── -->
		<div style="
			flex: 1;
			display: flex;
			flex-direction: column;
			padding: 110px 72px 0;
			box-sizing: border-box;
			overflow: hidden;
		">
			<!-- Text blocks -->
			<DraggableBlock
				dx={textOffsets.articleBody?.x ?? 0}
				dy={textOffsets.articleBody?.y ?? 0}
				{interactive}
				{scale}
				onChange={(x, y) => onTextOffsetChange?.('articleBody', { x, y })}
			>
				{#snippet children()}
					<CanvasMarkupTextBlock
						value={normalizedText}
						{interactive}
						defaultColor={accentColor}
						selected={selectedText === 'articleBody'}
						toolbarKind="articleBody"
						rows={1}
						minHeight="0px"
						ariaLabel="Article body"
						fontFamily={articleStyles.articleBody?.fontFamily ?? headlineStyle.fontFamily}
						fontSize={articleStyles.articleBody?.fontSize ?? headlineStyle.fontSize ?? 46}
						{showToolbar}
						onTextChange={(v) => onTextChange?.(v)}
						onTextSelect={onTextSelect}
						onHeadlineRangeSelect={onHeadlineRangeSelect}
					>
						{#snippet display()}
							<div style="flex-shrink: 0; margin-bottom: {image ? '56px' : '0'};">
								<HighlightedText
									as="div"
									text={normalizedText}
									defaultColor={accentColor}
									style="
										font-size: 46px;
										font-weight: 400;
										line-height: 1.42;
										letter-spacing: -0.3px;
										color: {baseText};
										word-break: break-word;
										white-space: pre-wrap;
										{bodyTypeCss} {bodyCss}
									"
								/>
							</div>
						{/snippet}
					</CanvasMarkupTextBlock>
				{/snippet}
			</DraggableBlock>

			<!-- Embedded image -->
			{#if image}
				<DraggableBlock
					dx={textOffsets.articleImage?.x ?? 0}
					dy={textOffsets.articleImage?.y ?? 0}
					{interactive}
					{scale}
					onChange={(x, y) => onTextOffsetChange?.('articleImage', { x, y })}
				>
					{#snippet children()}
						<div style="
							flex: 1;
							min-height: 0;
							border-radius: 20px;
							overflow: hidden;
							flex-shrink: 0;
							max-height: 620px;
						">
							<img
								src={image}
								alt=""
								style="width: 100%; height: 100%; object-fit: cover; display: block;"
							/>
						</div>
					{/snippet}
				</DraggableBlock>
			{/if}
		</div>

		<!-- ── Bottom bar ─────────────────────────────────────────────────────── -->
		<div style="
			flex-shrink: 0;
			height: 140px;
			position: relative;
			display: flex;
			align-items: center;
			padding: 0 72px;
			box-sizing: border-box;
		">
			<!-- Centered logo -->
			<DraggableBlock
				dx={textOffsets.articleLogo?.x ?? 0}
				dy={textOffsets.articleLogo?.y ?? 0}
				{interactive}
				{scale}
				onChange={(x, y) => onTextOffsetChange?.('articleLogo', { x, y })}
			>
				{#snippet children()}
					<div style="
						position: absolute;
						left: 50%;
						transform: translateX(-50%);
						width: 80px;
						height: 80px;
						border-radius: 50%;
						padding: 3.5px;
						background: linear-gradient(135deg, {logoRingColor}, color-mix(in srgb, {logoRingColor} 55%, white));
						box-sizing: border-box;
					">
						<div style="
							width: 100%;
							height: 100%;
							border-radius: 50%;
							background: {baseBg};
							display: flex;
							align-items: center;
							justify-content: center;
							overflow: hidden;
							box-sizing: border-box;
						">
							{#if logoSrc}
								<img src={logoSrc} alt="" style="width: 100%; height: 100%; object-fit: cover;" />
							{:else}
								<!-- Default lightning bolt -->
								<svg width="36" height="36" viewBox="0 0 24 24" fill="none">
									<path d="M13 2L4.5 13.5H11L10 22L19.5 10.5H13L13 2Z"
										fill="{logoRingColor}" stroke="{logoRingColor}" stroke-width="0.5"
										stroke-linejoin="round"/>
								</svg>
							{/if}
						</div>
					</div>
				{/snippet}
			</DraggableBlock>

			<!-- Swipe pill (right) -->
			{#if showSwipe}
				<DraggableBlock
					dx={textOffsets.articleSwipeText?.x ?? 0}
					dy={textOffsets.articleSwipeText?.y ?? 0}
					{interactive}
					{scale}
					onChange={(x, y) => onTextOffsetChange?.('articleSwipeText', { x, y })}
				>
					{#snippet children()}
						<div style="margin-left: auto;">
							<CanvasMarkupTextBlock
								value={swipeText}
								{interactive}
								rows={1}
								{showToolbar}
								toolbarKind="articleSwipeText"
								ariaLabel="Swipe text"
								fontFamily={articleStyles.articleSwipeText?.fontFamily ?? headlineStyle.fontFamily}
								fontSize={articleStyles.articleSwipeText?.fontSize ?? 28}
								onTextChange={onSwipeTextChange}
								onTextSelect={onTextSelect}
							>
								{#snippet display()}
									<div style="
										display: flex;
										align-items: center;
										gap: 8px;
										padding: 18px 36px;
										border-radius: 100px;
										border: 2.5px solid {isLight ? 'rgba(10,10,10,0.75)' : 'rgba(255,255,255,0.85)'};
										font-size: 28px;
										font-weight: 600;
										color: {baseText};
										letter-spacing: -0.2px;
										white-space: nowrap;
										{swipeCss}
									">{swipeText}</div>
								{/snippet}
							</CanvasMarkupTextBlock>
						</div>
					{/snippet}
				</DraggableBlock>
			{/if}
		</div>

	</div>
</div>
