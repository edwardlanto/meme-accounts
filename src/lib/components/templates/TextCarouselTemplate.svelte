<script lang="ts">
	import HighlightedText from '$lib/components/HighlightedText.svelte';
	import CanvasMarkupTextBlock from '$lib/components/CanvasMarkupTextBlock.svelte';
	import DraggableBlock from '$lib/components/DraggableBlock.svelte';
	import type { TextElementKind, TextStyle } from '$lib/types';
	import { appendTextShadowCss } from '$lib/textStyleCss';
	import { TEXT_CAROUSEL_DEFAULTS } from '$lib/studio/slide-content-defaults';
	import { autoTextCarouselFontPx } from '$lib/studio/text-carousel-body';
	import { stripMarkup } from '$lib/highlight';
	import { loadGoogleFont } from '$lib/fonts';

	interface Props {
		name?: string;
		handle?: string;
		avatar?: string;
		/** Solid fill inside the circle when no image (empty = use canvas `baseBg`). */
		avatarInnerBg?: string;
		/** Override text inside the circle; empty = derive initials from `name`. */
		avatarLabel?: string;
		ringColor?: string;
		/** Ring border thickness in px (0 = no ring). */
		ringWidth?: number;
		bgColor?: string;
		templateTheme?: 'light' | 'dark';
		text?: string;
		showSwipe?: boolean;
		/** Logical export size (Studio); 1080×1350 design is letterboxed */
		canvasW?: number;
		canvasH?: number;
		scale?: number;
		interactive?: boolean;
		exportRef?: HTMLElement | null;
		selectedText?: TextElementKind | null;
		onTextChange?: (t: string) => void;
		onNameChange?: (v: string) => void;
		onHandleChange?: (v: string) => void;
		onTextSelect?: (kind: TextElementKind, el: HTMLElement) => void;
		onHeadlineRangeSelect?: (start: number, end: number) => void;
		headlineStyle?: TextStyle;
		textOffsets?: Record<string, { x: number; y: number }>;
		onTextOffsetChange?: (kind: string, next: { x: number; y: number }) => void;
		/** Optional per-field style overrides (font/size/color/etc). */
		textCarouselStyles?: Partial<Record<
			| 'textCarouselName'
			| 'textCarouselHandle'
			| 'textCarouselBody',
			TextStyle
		>>;
		showToolbar?: boolean;
	}

	const DEFAULT_NAME_SIZE = 46;
	const DEFAULT_HANDLE_SIZE = 36;
	const DEFAULT_BODY_SIZE = 72;

	let {
		name      = 'Captains of industry',
		handle    = '@captainsofindustryy',
		avatar    = '',
		avatarInnerBg = '',
		avatarLabel = '',
		ringColor = '#c9b97a',
		ringWidth = 5,
		bgColor   = '',
		templateTheme = 'light',
		text      = TEXT_CAROUSEL_DEFAULTS.body,
		showSwipe = false,
		canvasW   = 1080,
		canvasH   = 1350,
		scale     = 1,
		interactive = true,
		exportRef = $bindable(null),
		selectedText = null,
		onTextChange,
		onNameChange,
		onHandleChange,
		onTextSelect,
		onHeadlineRangeSelect,
		headlineStyle = {},
		textCarouselStyles = {},
		textOffsets = {},
		onTextOffsetChange,
		showToolbar = false,
	}: Props = $props();

	const isLight = $derived(templateTheme === 'light');
	const baseBg = $derived((bgColor || (isLight ? '#ffffff' : '#0a0a0a')).trim());
	const baseText = $derived(isLight ? '#0a0a0a' : '#ffffff');
	const baseMuted = $derived(isLight ? 'rgba(10,10,10,0.50)' : '#888888');

	/** Drop ink colors that disappear on a light canvas (e.g. saved white while preview is white). */
	function safeInk(c: string | undefined): string | undefined {
		if (c == null || String(c).trim() === '') return undefined;
		if (!isLight) return c;
		const t = String(c).trim().toLowerCase();
		if (t === '#fff' || t === '#ffffff' || t === 'white') return undefined;
		if (/^rgba?\(\s*255\s*,\s*255\s*,\s*255\b/.test(t)) return undefined;
		return c;
	}

	function sanitizeStyle(s: TextStyle): TextStyle {
		if (s.color === undefined) return s;
		const ink = safeInk(s.color);
		if (ink === undefined) {
			const { color: _drop, ...rest } = s;
			return rest;
		}
		return ink === s.color ? s : { ...s, color: ink };
	}

	const bodyDisplayText = $derived((text && text.trim()) ? text : TEXT_CAROUSEL_DEFAULTS.body);
	const bodyPlainForSizing = $derived(stripMarkup(bodyDisplayText));

	const toolbarBodyFontPx = $derived(textCarouselStyles.textCarouselBody?.fontSize ?? null);

	/** Body = headlineStyle ∪ textCarouselBody; defaults folded in so styleCss always emits weight/size/line-height (toolbar overrides win). */
	/** Default slide typography — Lexend (variable Google Font), same as pre–Impact change */
	const DEFAULT_BODY_FONT = 'Lexend';

	const mergedBodyStyle = $derived.by(() => {
		const merged = sanitizeStyle({
			...headlineStyle,
			...(textCarouselStyles.textCarouselBody ?? {}),
		});
		return {
			...merged,
			fontFamily: merged.fontFamily ?? DEFAULT_BODY_FONT,
			fontWeight: merged.fontWeight ?? 400,
			fontSize: merged.fontSize ?? autoTextCarouselFontPx(bodyPlainForSizing, toolbarBodyFontPx),
			lineHeight: merged.lineHeight ?? 1.38,
			align: merged.align ?? 'left',
		};
	});

	$effect(() => {
		void loadGoogleFont('Lexend', mergedBodyStyle.fontWeight ?? 400);
	});

	function styleCss(s: TextStyle, opts?: { omitBlockBg?: boolean }) {
		const bits: string[] = [];
		if (s.fontFamily) bits.push(`font-family: '${s.fontFamily}', 'Lexend', -apple-system, 'SF Pro Display', sans-serif;`);
		if (s.fontSize) bits.push(`font-size: ${s.fontSize}px;`);
		if (s.fontWeight != null) bits.push(`font-weight: ${s.fontWeight};`);
		if (s.italic) bits.push('font-style: italic;');
		if (s.underline) bits.push('text-decoration: underline;');
		if (s.color) bits.push(`color: ${s.color};`);
		if (s.bgColor && !opts?.omitBlockBg) {
			bits.push(`background: ${s.bgColor};`);
			bits.push('box-decoration-break: clone; -webkit-box-decoration-break: clone;');
			bits.push('padding: 0.08em 0.18em;');
			bits.push('border-radius: 0.18em;');
		}
		if (s.align) bits.push(`text-align: ${s.align};`);
		if (s.letterSpacing != null) bits.push(`letter-spacing: ${s.letterSpacing}em;`);
		if (s.lineHeight != null) bits.push(`line-height: ${s.lineHeight};`);
		appendTextShadowCss(bits, s);
		return bits.join(' ');
	}

	const nameCss = $derived(styleCss(sanitizeStyle(textCarouselStyles.textCarouselName ?? {})));
	const handleCss = $derived(styleCss(sanitizeStyle(textCarouselStyles.textCarouselHandle ?? {})));
	const bodyMergedCss = $derived(styleCss(mergedBodyStyle, { omitBlockBg: true }));

	const innerDiscBg = $derived(
		(avatarInnerBg && avatarInnerBg.trim()) ? avatarInnerBg.trim() : baseBg,
	);
	const nameForInitials = $derived((name && name.trim()) ? name : TEXT_CAROUSEL_DEFAULTS.name);
	const discText = $derived((avatarLabel && avatarLabel.trim()) || initials(nameForInitials));
	const ringPx = $derived(Math.max(0, Math.min(24, Math.round(Number(ringWidth) || 0))));
	const avatarOuterSize = $derived(130 + ringPx * 2);

	const BASE_W = 1080;
	const BASE_H = 1350;
	const W = $derived(Math.max(320, Number(canvasW) || BASE_W));
	const H = $derived(Math.max(320, Number(canvasH) || BASE_H));
	const layoutScale = $derived(Math.min(W / BASE_W, H / BASE_H));
	const letterInsetX = $derived((W - BASE_W * layoutScale) / 2);
	const letterInsetY = $derived((H - BASE_H * layoutScale) / 2);
	const dragScale = $derived(scale * layoutScale);

	function initials(n: string) {
		return n.replace(/[^\w\s]/g, '').trim().split(/\s+/).map(w => w[0]?.toUpperCase() ?? '').slice(0, 3).join('');
	}

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
			font-family: '{DEFAULT_BODY_FONT}', -apple-system, 'SF Pro Display', 'Helvetica Neue', Arial, sans-serif;
			box-sizing: border-box;
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
				box-sizing: border-box;
				padding: 88px 88px 88px;
				overflow: visible;
			"
		>
		<!-- ── Profile row ─────────────────────────────────────────────────── -->
		<DraggableBlock
			dx={textOffsets.textCarouselProfile?.x ?? 0}
			dy={textOffsets.textCarouselProfile?.y ?? 0}
			{interactive}
			scale={dragScale}
			holdDragFromText={interactive}
			snapToCenter={interactive}
			snapRoot={exportRef}
			onChange={(x, y) => onTextOffsetChange?.('textCarouselProfile', { x, y })}
		>
			{#snippet children()}
				<div style="display: flex; align-items: center; gap: 36px; margin-bottom: 72px; flex-shrink: 0;">

			<!-- Avatar circle with ring -->
			<div style="
				width: {avatarOuterSize}px; height: {avatarOuterSize}px; border-radius: 50%; flex-shrink: 0;
				display: flex; align-items: center; justify-content: center;
				padding: {ringPx}px;
				box-sizing: border-box;
				background: {ringPx > 0
					? `linear-gradient(135deg, ${ringColor}, color-mix(in srgb, ${ringColor} 60%, white))`
					: 'transparent'};
			">
				<div
					role="button"
					tabindex="0"
					data-draggable-no-pan
					data-text-selectable="textCarouselAvatar"
					class="text-carousel-avatar-disc"
					style="
						width: 100%; height: 100%; border-radius: 50%; overflow: hidden;
						background: {innerDiscBg};
						display: flex; align-items: center; justify-content: center;
						box-sizing: border-box;
						cursor: {interactive ? 'pointer' : 'default'};
						outline: none;
						{selectedText === 'textCarouselAvatar'
							? 'box-shadow: 0 0 0 3px rgba(139, 92, 246, 0.75);'
							: ''}
					"
					onclick={(e) => {
						e.stopPropagation();
						if (!interactive || !onTextSelect) return;
						onTextSelect('textCarouselAvatar', e.currentTarget as HTMLElement);
					}}
					onkeydown={(e) => {
						if (!interactive || !onTextSelect) return;
						if (e.key === 'Enter' || e.key === ' ') {
							e.preventDefault();
							onTextSelect('textCarouselAvatar', e.currentTarget as HTMLElement);
						}
					}}
				>
					{#if avatar?.trim()}
						<img src={avatar} alt="" style="width: 100%; height: 100%; object-fit: cover; pointer-events: none;" />
					{:else}
						<span style="
							color: {baseText};
							font-size: 36px;
							font-weight: 800;
							letter-spacing: -1px;
							line-height: 1;
							pointer-events: none;
						">{discText}</span>
					{/if}
				</div>
			</div>

			<!-- Name + handle -->
			<div style="flex: 1; min-width: 0;">
				<CanvasMarkupTextBlock
					value={name}
					interactive={!!interactive && typeof onNameChange === 'function'}
					rows={1}
					{showToolbar}
					toolbarKind="textCarouselName"
					selected={selectedText === 'textCarouselName'}
					ariaLabel="Name"
					fontFamily={textCarouselStyles.textCarouselName?.fontFamily ?? headlineStyle.fontFamily}
					fontSize={textCarouselStyles.textCarouselName?.fontSize ?? headlineStyle.fontSize ?? DEFAULT_NAME_SIZE}
					onTextChange={onNameChange}
					onTextSelect={onTextSelect}
					onHeadlineRangeSelect={onHeadlineRangeSelect}
				>
					{#snippet display()}
						<p
							data-canvas-typography-root
							style="
							margin: 0 0 8px;
							font-size: {textCarouselStyles.textCarouselName?.fontSize ?? headlineStyle.fontSize ?? DEFAULT_NAME_SIZE}px;
							font-weight: 800;
							color: {baseText};
							line-height: 1.1;
							letter-spacing: -0.5px;
							{nameCss}
						"
						>{name.trim() ? name : TEXT_CAROUSEL_DEFAULTS.name}</p>
					{/snippet}
				</CanvasMarkupTextBlock>

				<CanvasMarkupTextBlock
					value={handle}
					interactive={!!interactive && typeof onHandleChange === 'function'}
					rows={1}
					{showToolbar}
					toolbarKind="textCarouselHandle"
					selected={selectedText === 'textCarouselHandle'}
					ariaLabel="Handle"
					fontFamily={textCarouselStyles.textCarouselHandle?.fontFamily ?? headlineStyle.fontFamily}
					fontSize={textCarouselStyles.textCarouselHandle?.fontSize ?? headlineStyle.fontSize ?? DEFAULT_HANDLE_SIZE}
					onTextChange={onHandleChange}
					onTextSelect={onTextSelect}
					onHeadlineRangeSelect={onHeadlineRangeSelect}
				>
					{#snippet display()}
						<p
							data-canvas-typography-root
							style="
							margin: 0;
							font-size: {textCarouselStyles.textCarouselHandle?.fontSize ?? headlineStyle.fontSize ?? DEFAULT_HANDLE_SIZE}px;
							font-weight: 400;
							font-style: italic;
							color: {baseMuted};
							letter-spacing: -0.2px;
							{handleCss}
						"
						>{handle.trim() ? handle : TEXT_CAROUSEL_DEFAULTS.handle}</p>
					{/snippet}
				</CanvasMarkupTextBlock>
			</div>
				</div>
			{/snippet}
		</DraggableBlock>

		<!-- ── Body text ──────────────────────────────────────────────────── -->
		<div style="flex: 1; min-height: 0; display: flex; flex-direction: column; justify-content: center; align-items: stretch; overflow: visible;">
			<DraggableBlock
				dx={textOffsets.textCarouselBody?.x ?? 0}
				dy={textOffsets.textCarouselBody?.y ?? 0}
				{interactive}
				scale={dragScale}
				holdDragFromText={interactive}
				snapToCenter={interactive}
				snapRoot={exportRef}
				onChange={(x, y) => onTextOffsetChange?.('textCarouselBody', { x, y })}
			>
				{#snippet children()}
					<CanvasMarkupTextBlock
						value={text}
						interactive={!!interactive && typeof onTextChange === 'function'}
						selected={selectedText === 'textCarouselBody'}
						toolbarKind="textCarouselBody"
						rows={10}
						ariaLabel="Carousel text"
						fontFamily={mergedBodyStyle.fontFamily}
						fontSize={mergedBodyStyle.fontSize}
						{showToolbar}
						onTextChange={onTextChange}
						onTextSelect={onTextSelect}
						onHeadlineRangeSelect={onHeadlineRangeSelect}
					>
						{#snippet display()}
							<!-- Single block so plain-text selection maps to the stored `text` string (incl. \\n\\n). -->
							<HighlightedText
								as="div"
								text={bodyDisplayText}
								parseHighlights={true}
								defaultColor="#F5A623"
								style="margin: 0; letter-spacing: -0.8px; word-break: break-word; white-space: pre-wrap; text-align: left; color: {baseText}; {bodyMergedCss}"
							/>
						{/snippet}
					</CanvasMarkupTextBlock>
				{/snippet}
			</DraggableBlock>
		</div>

		<!-- ── Swipe indicator ─────────────────────────────────────────────── -->
		{#if showSwipe}
			<DraggableBlock
				dx={textOffsets.textCarouselSwipe?.x ?? 0}
				dy={textOffsets.textCarouselSwipe?.y ?? 0}
				{interactive}
				scale={dragScale}
				onChange={(x, y) => onTextOffsetChange?.('textCarouselSwipe', { x, y })}
			>
				{#snippet children()}
					<div style="
						position: absolute;
						bottom: 72px;
						right: 72px;
						display: flex;
						align-items: center;
						gap: 10px;
						opacity: 0.85;
					">
				<!-- Arrow + hand SVG -->
				<svg width="96" height="72" viewBox="0 0 96 72" fill="none" xmlns="http://www.w3.org/2000/svg">
					<!-- Arrow pointing left -->
					<path d="M28 36 L8 36 M8 36 L18 26 M8 36 L18 46" stroke="{baseText}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
					<!-- Hand / finger pointing right (simplified) -->
					<g transform="translate(36, 4)">
						<!-- Palm -->
						<rect x="12" y="30" width="32" height="28" rx="6" fill="{baseText}"/>
						<!-- Index finger -->
						<rect x="20" y="10" width="10" height="28" rx="5" fill="{baseText}"/>
						<!-- Middle finger -->
						<rect x="32" y="16" width="9" height="22" rx="4.5" fill="{baseText}"/>
						<!-- Ring finger -->
						<rect x="42" y="20" width="8" height="18" rx="4" fill="{baseText}"/>
						<!-- Pinky -->
						<rect x="51" y="23" width="7" height="15" rx="3.5" fill="{baseText}"/>
						<!-- Thumb -->
						<rect x="4" y="32" width="12" height="8" rx="4" fill="{baseText}"/>
					</g>
				</svg>
					</div>
				{/snippet}
			</DraggableBlock>
		{/if}
		</div>
	</div>
</div>
