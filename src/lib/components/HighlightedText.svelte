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
	 */
	import { parseHighlightMarkup, segmentText } from '$lib/highlight';
	import { TEXT_BG_CHIP_BOX_CSS } from '$lib/textStyleCss';
	import {
		CLIPPED_TEXT_SHADOW_WRAP_CSS,
		gradientTextFillCss,
		patternStyleForUrl,
	} from '$lib/components/textOverlayPattern';

	interface Props {
		text: string;
		defaultColor?: string;
		/** If false, `[[...]]` is shown as plain text (no accent spans). Default true. */
		parseHighlights?: boolean;
		/**
		 * When true with `parseHighlights`, highlighted spans keep the base text color
		 * and use a heavier weight (Creator-hook emphasis) instead of a color accent.
		 */
		emphasisBold?: boolean;
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
		as = 'span',
		style = '',
		class: klass = '',
	}: Props = $props();

	const boldSpanStyle = $derived(
		emphasisBold
			? 'color: inherit; font-weight: 800; font-style: inherit; text-decoration: inherit;'
			: '',
	);

	const segments = $derived(
		parseHighlights
			? segmentText(parseHighlightMarkup(text, defaultColor))
			: [{ text, highlighted: false as const, start: 0, end: text.length }],
	);

	function patternStyle(img: string | undefined): string {
		if (!img) return '';
		return (
			`${patternStyleForUrl(img)}` +
			`font-weight: inherit; font-style: inherit; text-decoration: inherit;` +
			`pointer-events: none;`
		);
	}

	function markerStyle(bg: string): string {
		return (
			`background: ${bg};` +
			`${TEXT_BG_CHIP_BOX_CSS}` +
			`color: inherit; font-weight: inherit; font-style: inherit; text-decoration: inherit;`
		);
	}

</script>

{#snippet painted()}
	{#each segments as seg}
		{#if seg.highlighted}
			<span
				data-hl-plain-start={seg.start ?? ''}
				data-hl-plain-end={seg.end ?? ''}
				style="cursor: text; pointer-events: auto; {seg.patternImage || (seg.gradientFrom && seg.gradientTo)
					? CLIPPED_TEXT_SHADOW_WRAP_CSS
					: 'display: inline;'}"
			>
				{#if seg.markerBg}
					<span style={markerStyle(seg.markerBg)}>{seg.text}</span>
				{:else if seg.patternImage}
					<span style={patternStyle(seg.patternImage)}>{seg.text}</span>
				{:else if seg.gradientFrom && seg.gradientTo}
					<span style="{gradientTextFillCss(seg.gradientFrom, seg.gradientTo)} font-weight: inherit; font-style: inherit; text-decoration: inherit; pointer-events: none;">{seg.text}</span>
				{:else if emphasisBold}
					<span style={boldSpanStyle}>{seg.text}</span>
				{:else}
					<span style="color: {seg.color}; font-weight: 700; font-style: inherit; text-decoration: inherit;">{seg.text}</span>
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
