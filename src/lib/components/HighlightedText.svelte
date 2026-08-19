<script lang="ts">
	/**
	 * Renders a string containing `[[...]]` highlight markup as styled spans when
	 * `parseHighlights` is true (default). Pass `parseHighlights={false}` only when
	 * `[[...]]` should stay literal plain text.
	 *
	 * When `parseHighlights` is true, supported syntax:
	 *   [[WORD]]                  → colored with `defaultColor`
	 *   [[#hex: WORD]]            → colored with explicit hex
	 *   [[grad(#a,#b): WORD]]     → linear gradient fill on the text
	 *   [[pattern(name): WORD]]   → image/pattern fill on the text
	 *   [[marker(#hex): WORD]]  → solid background behind phrase
	 *   [[w(800): WORD]]        → heavier weight, same ink (mid-word OK)
	 *
	 * Color / marker / pattern / gradient spans inherit the parent font-weight unless
	 * the span has its own `[[w(N): …]]`. Bare `[[phrase]]` only bumps weight when
	 * `emphasisBold` (Creator-hook).
	 */
	import {
		highlightEmphasisCss,
		highlightWeightCss,
		parseHighlightMarkup,
		segmentText,
		type HighlightDefaults,
	} from '$lib/highlight';
	import { TEXT_BG_CHIP_BOX_CSS } from '$lib/textStyleCss';
	import {
		CLIPPED_TEXT_SHADOW_WRAP_CSS,
		gradientTextFillCss,
		patternStyleForUrl,
	} from '$lib/components/textOverlayPattern';

	interface Props {
		text: string;
		/** Solid hex or full Studio defaults (pattern / gradient for bare `[[phrase]]`). */
		defaultColor?: string | HighlightDefaults;
		/** If false, `[[...]]` is shown as plain text (no accent spans). Default true. */
		parseHighlights?: boolean;
		/**
		 * When true with `parseHighlights`, highlighted spans keep the base text color
		 * and use a heavier weight (Creator-hook emphasis) instead of a color accent.
		 */
		emphasisBold?: boolean;
		/** Parent line weight — used only when `emphasisBold` (default 700). */
		baseFontWeight?: number;
		/** Optional wrapper tag name for the rendered text. Defaults to span. */
		as?: 'span' | 'div' | 'p';
		/** Pass-through style string on the wrapping element. */
		style?: string;
		/** Pass-through class string. */
		class?: string;
	}

	let {
		text,
		defaultColor = '#F5A623',
		parseHighlights = true,
		emphasisBold = false,
		baseFontWeight = 700,
		as = 'span',
		style = '',
		class: klass = '',
	}: Props = $props();

	const emphasisCss = $derived(highlightEmphasisCss(baseFontWeight));
	const boldSpanStyle = $derived(`color: inherit; ${emphasisCss}`);

	function spanWeightCss(seg: { fontWeight?: number }): string {
		return highlightWeightCss(seg.fontWeight);
	}

	const segments = $derived(
		parseHighlights
			? segmentText(parseHighlightMarkup(text, defaultColor))
			: [{ text, highlighted: false as const, start: 0, end: text.length }],
	);

	function patternStyle(img: string | undefined, fontWeight?: number): string {
		if (!img) return '';
		return `${patternStyleForUrl(img)}${highlightWeightCss(fontWeight)} pointer-events: none;`;
	}

	function markerStyle(bg: string, fontWeight?: number): string {
		return (
			`background-color: ${bg};` +
			`background-image: none;` +
			`-webkit-background-clip: border-box; background-clip: border-box;` +
			`${TEXT_BG_CHIP_BOX_CSS}` +
			`text-box: normal; text-box-trim: none;` +
			`isolation: isolate;` +
			`color: inherit; ${highlightWeightCss(fontWeight)}`
		);
	}
</script>

{#snippet painted()}
	{#each segments as seg}
		{#if seg.highlighted}
			<span
				data-hl-plain-start={seg.start ?? ''}
				data-hl-plain-end={seg.end ?? ''}
				style="cursor: text; user-select: text; pointer-events: auto; {seg.patternImage || (seg.gradientFrom && seg.gradientTo)
					? CLIPPED_TEXT_SHADOW_WRAP_CSS
					: 'display: inline;'}"
			>
				{#if seg.painted === false}
					<span style="color: inherit; {spanWeightCss(seg)}">{seg.text}</span>
				{:else if seg.markerBg}
					<span style={markerStyle(seg.markerBg, seg.fontWeight)}>{seg.text}</span>
				{:else if seg.patternImage}
					<span style={patternStyle(seg.patternImage, seg.fontWeight)}>{seg.text}</span>
				{:else if seg.gradientFrom && seg.gradientTo}
					<span style="{gradientTextFillCss(seg.gradientFrom, seg.gradientTo)} {spanWeightCss(seg)} pointer-events: none;">{seg.text}</span>
				{:else if emphasisBold && seg.fontWeight == null}
					<span style={boldSpanStyle}>{seg.text}</span>
				{:else}
					<span style="color: {seg.color}; {spanWeightCss(seg)}">{seg.text}</span>
				{/if}
			</span>
		{:else}
			{seg.text}
		{/if}
	{/each}
{/snippet}

{#if as === 'div'}
	<div {style} class={klass} data-canvas-typography-root data-canvas-paint-root>
		{@render painted()}
	</div>
{:else if as === 'p'}
	<p {style} class={klass} data-canvas-typography-root data-canvas-paint-root>
		{@render painted()}
	</p>
{:else}
	<span {style} class={klass} data-canvas-typography-root data-canvas-paint-root>
		{@render painted()}
	</span>
{/if}
