<script lang="ts">
	import CanvasMarkupTextBlock from '$lib/components/CanvasMarkupTextBlock.svelte';
	import DraggableBlock from '$lib/components/DraggableBlock.svelte';
	import HighlightedText from '$lib/components/HighlightedText.svelte';
	import type { TextElementKind, TextStyle } from '$lib/types';
	import { BLACK_TEXT_CAROUSEL_DEFAULTS } from '$lib/studio/slide-content-defaults';

	interface Props {
		/** Full-bleed background; default is the black carousel placeholder JPG. */
		backgroundImage?: string;
		headline?: string;
		body?: string;
		headlineColor?: string;
		bodyColor?: string;
		showSwipe?: boolean;
		canvasW?: number;
		canvasH?: number;
		scale?: number;
		interactive?: boolean;
		exportRef?: HTMLElement | null;
		selectedText?: TextElementKind | null;
		highlightColor?: string;
		headlineStyle?: TextStyle;
		bodyStyle?: TextStyle;
		textOffsets?: Record<string, { x: number; y: number }>;
		onTextOffsetChange?: (kind: TextElementKind, next: { x: number; y: number }) => void;
		onHeadlineChange?: (v: string) => void;
		onBodyChange?: (v: string) => void;
		onTextSelect?: (kind: TextElementKind, el: HTMLElement) => void;
		onHeadlineRangeSelect?: (start: number, end: number) => void;
		showToolbar?: boolean;
	}

	let {
		backgroundImage = '',
		headline = BLACK_TEXT_CAROUSEL_DEFAULTS.headline,
		body = BLACK_TEXT_CAROUSEL_DEFAULTS.body,
		headlineColor = '#5B9DFF',
		bodyColor = '#ffffff',
		showSwipe = true,
		canvasW = 1080,
		canvasH = 1350,
		scale = 1,
		interactive = true,
		exportRef = $bindable(null),
		selectedText = null,
		highlightColor = '#5B9DFF',
		headlineStyle = {},
		bodyStyle = {},
		textOffsets = {},
		onTextOffsetChange,
		onHeadlineChange,
		onBodyChange,
		onTextSelect,
		onHeadlineRangeSelect,
		showToolbar = false,
	}: Props = $props();

	const BASE_W = 1080;
	const BASE_H = 1350;
	const W = $derived(Math.max(320, Number(canvasW) || BASE_W));
	const H = $derived(Math.max(320, Number(canvasH) || BASE_H));
	const layoutScale = $derived(Math.min(W / BASE_W, H / BASE_H));
	const letterInsetX = $derived((W - BASE_W * layoutScale) / 2);
	const letterInsetY = $derived((H - BASE_H * layoutScale) / 2);
	const dragScale = $derived(scale * layoutScale);

	const mergedHeadlineStyle = $derived.by(() => {
		const s = { ...headlineStyle };
		return {
			...s,
			color: s.color ?? headlineColor,
			fontFamily: s.fontFamily ?? 'Inter',
			fontSize: s.fontSize ?? 52,
			fontWeight: s.fontWeight ?? 700,
			lineHeight: s.lineHeight ?? 1.2,
		} satisfies TextStyle;
	});

	const mergedBodyStyle = $derived.by(() => {
		const s = { ...bodyStyle };
		return {
			...s,
			color: s.color ?? bodyColor,
			fontFamily: s.fontFamily ?? 'Inter',
			fontSize: s.fontSize ?? 34,
			fontWeight: s.fontWeight ?? 400,
			lineHeight: s.lineHeight ?? 1.45,
		} satisfies TextStyle;
	});

	function styleBits(s: TextStyle): string {
		const bits: string[] = [];
		if (s.fontFamily) bits.push(`font-family: '${s.fontFamily}', system-ui, sans-serif;`);
		if (s.fontSize) bits.push(`font-size: ${s.fontSize}px;`);
		if (s.fontWeight != null) bits.push(`font-weight: ${s.fontWeight};`);
		if (s.italic) bits.push('font-style: italic;');
		if (s.underline) bits.push('text-decoration: underline;');
		if (s.color) bits.push(`color: ${s.color};`);
		if (s.lineHeight != null) bits.push(`line-height: ${s.lineHeight};`);
		if (s.letterSpacing != null) bits.push(`letter-spacing: ${s.letterSpacing}em;`);
		return bits.join(' ');
	}

	const headlineCss = $derived(styleBits(mergedHeadlineStyle));
	const bodyCss = $derived(styleBits(mergedBodyStyle));
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
			position: relative;
			overflow: hidden;
			background: #000;
			transform: scale({scale});
			transform-origin: top left;
			box-sizing: border-box;
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
			"
		>
			{#if backgroundImage?.trim()}
				<img
					src={backgroundImage}
					alt=""
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

			<div
				style="
					position: absolute;
					inset: 0;
					display: flex;
					flex-direction: column;
					justify-content: center;
					box-sizing: border-box;
					padding: 96px 72px 120px;
				"
			>
				<div style="max-width: 920px; width: 100%; margin: 0 auto; display: flex; flex-direction: column; gap: 28px;">
					<DraggableBlock
						dx={textOffsets.blackTextHeadline?.x ?? 0}
						dy={textOffsets.blackTextHeadline?.y ?? 0}
						{interactive}
						scale={dragScale}
						onChange={(x, y) => onTextOffsetChange?.('blackTextHeadline', { x, y })}
					>
						{#snippet children()}
							<CanvasMarkupTextBlock
								value={headline}
								{interactive}
								selected={selectedText === 'blackTextHeadline'}
								toolbarKind="blackTextHeadline"
								rows={3}
								uppercase={false}
								{showToolbar}
								fontFamily={mergedHeadlineStyle.fontFamily}
								fontSize={mergedHeadlineStyle.fontSize}
								ariaLabel="Slide headline"
								onTextChange={onHeadlineChange}
								onTextSelect={onTextSelect}
								onHeadlineRangeSelect={onHeadlineRangeSelect}
							>
								{#snippet display()}
									<HighlightedText
										as="div"
										text={headline}
										style="margin: 0; text-align: left; word-break: break-word; white-space: pre-wrap; {headlineCss}"
									/>
								{/snippet}
							</CanvasMarkupTextBlock>
						{/snippet}
					</DraggableBlock>

					<DraggableBlock
						dx={textOffsets.blackTextBody?.x ?? 0}
						dy={textOffsets.blackTextBody?.y ?? 0}
						{interactive}
						scale={dragScale}
						onChange={(x, y) => onTextOffsetChange?.('blackTextBody', { x, y })}
					>
						{#snippet children()}
							<CanvasMarkupTextBlock
								value={body}
								{interactive}
								defaultColor={bodyColor}
								selected={selectedText === 'blackTextBody'}
								toolbarKind="blackTextBody"
								rows={12}
								uppercase={false}
								{showToolbar}
								fontFamily={mergedBodyStyle.fontFamily}
								fontSize={mergedBodyStyle.fontSize}
								ariaLabel="Slide body"
								onTextChange={onBodyChange}
								onTextSelect={onTextSelect}
								onHeadlineRangeSelect={onHeadlineRangeSelect}
							>
								{#snippet display()}
									<HighlightedText
										as="div"
										text={body}
										style="margin: 0; text-align: left; word-break: break-word; white-space: pre-wrap; opacity: 0.96; {bodyCss}"
									/>
								{/snippet}
							</CanvasMarkupTextBlock>
						{/snippet}
					</DraggableBlock>
				</div>
			</div>

			{#if showSwipe}
				<DraggableBlock
					dx={textOffsets.blackTextSwipe?.x ?? 0}
					dy={textOffsets.blackTextSwipe?.y ?? 0}
					{interactive}
					scale={dragScale}
					onChange={(x, y) => onTextOffsetChange?.('blackTextSwipe', { x, y })}
				>
					{#snippet children()}
						<div
							style="
								position: absolute;
								bottom: 72px;
								right: 72px;
								display: flex;
								align-items: center;
								opacity: 0.9;
							"
						>
							<svg width="96" height="72" viewBox="0 0 96 72" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
								<path
									d="M28 36 L8 36 M8 36 L18 26 M8 36 L18 46"
									stroke="#ffffff"
									stroke-width="4"
									stroke-linecap="round"
									stroke-linejoin="round"
								/>
								<g transform="translate(36, 4)">
									<rect x="12" y="30" width="32" height="28" rx="6" fill="#ffffff" />
									<rect x="20" y="10" width="10" height="28" rx="5" fill="#ffffff" />
									<rect x="32" y="16" width="9" height="22" rx="4.5" fill="#ffffff" />
									<rect x="42" y="20" width="8" height="18" rx="4" fill="#ffffff" />
									<rect x="51" y="23" width="7" height="15" rx="3.5" fill="#ffffff" />
									<rect x="4" y="32" width="12" height="8" rx="4" fill="#ffffff" />
								</g>
							</svg>
						</div>
					{/snippet}
				</DraggableBlock>
			{/if}
		</div>
	</div>
</div>
