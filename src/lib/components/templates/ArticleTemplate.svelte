<script lang="ts">
	import HighlightedText from '$lib/components/HighlightedText.svelte';
	import CanvasMarkupTextBlock from '$lib/components/CanvasMarkupTextBlock.svelte';
	import type { TextElementKind, TextStyle } from '$lib/types';

	interface Segment { text: string; accent: boolean; }

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
		// Rendering
		scale?: number;
		interactive?: boolean;
		exportRef?: HTMLElement | null;
		selectedText?: TextElementKind | null;
		onTextChange?: (t: string) => void;
		onTextSelect?: (kind: TextElementKind, el: HTMLElement) => void;
		onHeadlineRangeSelect?: (start: number, end: number) => void;
		headlineStyle?: TextStyle;
		/** When true, inline highlight controls show while editing (no parent floating toolbar). */
		showToolbar?: boolean;
	}

	let {
		text         = "Here's the trillion-dollar problem everyone avoids.\n\nTo break it down:\n\nA *1-gigawatt AI data center* costs roughly *$80B* to build & operate.",
		image        = '',
		accentColor  = '#3ecf8e',
		bgColor      = '',
		templateTheme = 'dark',
		logoSrc      = '',
		logoRingColor = '#c9b97a',
		showSwipe    = true,
		swipeText    = '«« Swipe',
		scale        = 1,
		interactive  = true,
		exportRef    = $bindable(null),
		selectedText = null,
		onTextChange,
		onTextSelect,
		onHeadlineRangeSelect,
		headlineStyle = {},
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

	const W = 1080;
	const H = 1350;

	/**
	 * Parse text with *accent* markup.
	 * Double newlines = paragraph break (returned as null sentinel).
	 */
	function parseBlocks(raw: string): Array<Segment[] | null> {
		return raw.split(/\n\n+/).map(para => {
			if (!para.trim()) return null;
			const parts = para.split(/\*([^*]+)\*/);
			return parts.map((p, i) => ({ text: p, accent: i % 2 === 1 }));
		});
	}

	const blocks = $derived(parseBlocks(text));
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
			<CanvasMarkupTextBlock
				value={text}
				{interactive}
				defaultColor={accentColor}
				selected={selectedText === 'headline'}
				rows={12}
				ariaLabel="Article body"
				fontFamily={headlineStyle.fontFamily}
				fontSize={headlineStyle.fontSize}
				{showToolbar}
				onTextChange={onTextChange}
				onTextSelect={onTextSelect}
				onHeadlineRangeSelect={onHeadlineRangeSelect}
			>
				{#snippet display()}
					<div style="flex-shrink: 0; margin-bottom: {image ? '56px' : '0'};">
						{#each blocks as block, bi}
							{#if block !== null}
								<p style="
									margin: 0;
									{bi > 0 ? 'margin-top: 40px;' : ''}
									font-size: 46px;
									font-weight: 400;
									line-height: 1.42;
									letter-spacing: -0.3px;
									color: {baseText};
									word-break: break-word;
									{bodyTypeCss}
								">
									{#each block as seg}
										{#if seg.accent}
											<HighlightedText
												as="span"
												text={seg.text}
												defaultColor={accentColor}
												style="color: {accentColor}; font-weight: 600;"
											/>
										{:else}
											<HighlightedText as="span" text={seg.text} defaultColor={accentColor} />
										{/if}
									{/each}
								</p>
							{/if}
						{/each}
					</div>
				{/snippet}
			</CanvasMarkupTextBlock>

			<!-- Embedded image -->
			{#if image}
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

			<!-- Swipe pill (right) -->
			{#if showSwipe}
				<div style="margin-left: auto;">
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
					">{swipeText}</div>
				</div>
			{/if}
		</div>

	</div>
</div>
