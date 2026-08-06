<script lang="ts">
	import CanvasMarkupTextBlock from '$lib/components/CanvasMarkupTextBlock.svelte';
	import DraggableBlock from '$lib/components/DraggableBlock.svelte';
	import type { TextElementKind, TextStyle } from '$lib/types';
	import { appendTextShadowCss } from '$lib/textStyleCss';
	import { BLACK_TEXT_CAROUSEL_DEFAULTS } from '$lib/studio/slide-content-defaults';
	import { stripMarkup } from '$lib/highlight';
	import { loadGoogleFont } from '$lib/fonts';

	interface Props {
		backgroundImage?: string;
		name?: string;
		handle?: string;
		avatar?: string;
		avatarInnerBg?: string;
		avatarLabel?: string;
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
		name = BLACK_TEXT_CAROUSEL_DEFAULTS.name,
		handle = BLACK_TEXT_CAROUSEL_DEFAULTS.handle,
		avatar = '',
		avatarInnerBg = '#1a1a1a',
		avatarLabel = '',
		headline = BLACK_TEXT_CAROUSEL_DEFAULTS.headline,
		body = BLACK_TEXT_CAROUSEL_DEFAULTS.body,
		headlineColor = BLACK_TEXT_CAROUSEL_DEFAULTS.headlineColor,
		bodyColor = '#ffffff',
		showSwipe = true,
		canvasW = 1080,
		canvasH = 1350,
		scale = 1,
		interactive = true,
		exportRef = $bindable(null),
		selectedText = null,
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

	const headlineDisplay = $derived(stripMarkup(headline));
	const bodyDisplay = $derived(stripMarkup(body));

	const BASE_W = 1080;
	const BASE_H = 1350;
	const W = $derived(Math.max(320, Number(canvasW) || BASE_W));
	const H = $derived(Math.max(320, Number(canvasH) || BASE_H));
	const layoutScale = $derived(Math.min(W / BASE_W, H / BASE_H));
	const letterInsetX = $derived((W - BASE_W * layoutScale) / 2);
	const letterInsetY = $derived((H - BASE_H * layoutScale) / 2);
	const dragScale = $derived(scale * layoutScale);

	const DEFAULT_HEADLINE_FONT = 'Lexend';
	const DEFAULT_BODY_FONT = 'Lexend';

	const mergedHeadlineStyle = $derived.by(() => {
		const s = { ...headlineStyle };
		return {
			...s,
			color: s.color ?? headlineColor,
			fontFamily: s.fontFamily ?? DEFAULT_HEADLINE_FONT,
			fontSize: s.fontSize ?? 46,
			fontWeight: s.fontWeight ?? 700,
			lineHeight: s.lineHeight ?? 1.28,
			align: s.align ?? 'left',
		} satisfies TextStyle;
	});

	const mergedBodyStyle = $derived.by(() => {
		const s = { ...bodyStyle };
		return {
			...s,
			color: s.color ?? bodyColor,
			fontFamily: s.fontFamily ?? DEFAULT_BODY_FONT,
			fontSize: s.fontSize ?? 36,
			fontWeight: s.fontWeight ?? 400,
			lineHeight: s.lineHeight ?? 1.5,
			align: s.align ?? 'left',
		} satisfies TextStyle;
	});

	$effect(() => {
		void loadGoogleFont(DEFAULT_HEADLINE_FONT, mergedHeadlineStyle.fontWeight ?? 700);
		void loadGoogleFont(DEFAULT_BODY_FONT, mergedBodyStyle.fontWeight ?? 400);
	});

	function styleBits(s: TextStyle): string {
		const bits: string[] = [];
		if (s.fontFamily) bits.push(`font-family: '${s.fontFamily}', 'Lexend', -apple-system, sans-serif;`);
		if (s.fontSize) bits.push(`font-size: ${s.fontSize}px;`);
		if (s.fontWeight != null) bits.push(`font-weight: ${s.fontWeight};`);
		if (s.italic) bits.push('font-style: italic;');
		if (s.underline) bits.push('text-decoration: underline;');
		if (s.color) bits.push(`color: ${s.color};`);
		if (s.lineHeight != null) bits.push(`line-height: ${s.lineHeight};`);
		if (s.letterSpacing != null) bits.push(`letter-spacing: ${s.letterSpacing}em;`);
		bits.push(`text-align: ${s.align ?? 'left'};`);
		appendTextShadowCss(bits, s);
		return bits.join(' ');
	}

	const headlineCss = $derived(styleBits(mergedHeadlineStyle));
	const bodyCss = $derived(styleBits(mergedBodyStyle));

	function initials(n: string) {
		return n
			.replace(/[^\w\s]/g, '')
			.trim()
			.split(/\s+/)
			.map((w) => w[0]?.toUpperCase() ?? '')
			.slice(0, 2)
			.join('');
	}

	const discText = $derived((avatarLabel && avatarLabel.trim()) || initials(name));
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
			font-family: 'Lexend', -apple-system, 'SF Pro Display', sans-serif;
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
						opacity: 0.35;
					"
				/>
			{/if}

			<div
				style="
					position: absolute;
					inset: 0;
					display: flex;
					flex-direction: column;
					align-items: stretch;
					justify-content: center;
					box-sizing: border-box;
					padding: 88px 72px 120px;
				"
			>
				<!-- Profile row -->
				<DraggableBlock
					dx={textOffsets.blackTextProfile?.x ?? 0}
					dy={textOffsets.blackTextProfile?.y ?? 0}
					{interactive}
					scale={dragScale}
					onChange={(x, y) => onTextOffsetChange?.('blackTextProfile', { x, y })}
				>
					{#snippet children()}
						<div style="display: flex; flex-direction: column; align-items: flex-start; gap: 18px; margin-bottom: 56px; flex-shrink: 0; width: 100%;">
							<div
								style="
									width: 108px;
									height: 108px;
									border-radius: 50%;
									overflow: hidden;
									flex-shrink: 0;
									background: {avatarInnerBg};
									display: flex;
									align-items: center;
									justify-content: center;
								"
							>
								{#if avatar?.trim()}
									<img
										src={avatar}
										alt=""
										style="width: 100%; height: 100%; object-fit: cover; display: block;"
									/>
								{:else}
									<span style="font-size: 32px; font-weight: 600; color: #fff; letter-spacing: -0.02em;">
										{discText}
									</span>
								{/if}
							</div>
							<div style="min-width: 0; text-align: left; width: 100%;">
								<div style="display: flex; align-items: center; justify-content: flex-start; gap: 10px; flex-wrap: wrap;">
									<span style="font-size: 38px; font-weight: 700; color: #fff; letter-spacing: -0.02em;">
										{name}
									</span>
									<svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true" style="flex-shrink: 0;">
										<circle cx="12" cy="12" r="10" fill="#1D9BF0" />
										<path
											d="M7.5 12.2l2.8 2.8 6.2-6.4"
											stroke="#fff"
											stroke-width="2"
											stroke-linecap="round"
											stroke-linejoin="round"
										/>
									</svg>
								</div>
								<span style="font-size: 32px; font-weight: 400; color: rgba(255,255,255,0.55); letter-spacing: -0.01em;">
									{handle}
								</span>
							</div>
						</div>
					{/snippet}
				</DraggableBlock>

				<div style="flex: 0 1 auto; display: flex; flex-direction: column; align-items: stretch; gap: 36px; min-height: 0; width: 100%;">
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
									<div
										style="margin: 0; text-align: {mergedHeadlineStyle.align ?? 'left'}; word-break: break-word; white-space: pre-wrap; {headlineCss}"
									>
										{headlineDisplay}
									</div>
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
									<div
										style="margin: 0; text-align: {mergedBodyStyle.align ?? 'left'}; word-break: break-word; white-space: pre-wrap; {bodyCss}"
									>
										{bodyDisplay}
									</div>
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
