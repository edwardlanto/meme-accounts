<script lang="ts">
	/**
	 * Renders a string containing `[[...]]` highlight markup as styled spans when
	 * `parseHighlights` is true. **NewsTemplate** is the only slide type that should
	 * use highlight markup in Studio; all other templates pass `parseHighlights={false}`
	 * so `[[...]]` stays literal plain text.
	 *
	 * When `parseHighlights` is true, supported syntax:
	 *   [[WORD]]                  → colored with `defaultColor`
	 *   [[#hex: WORD]]            → colored with explicit hex
	 *   [[grad(#a,#b): WORD]]     → linear gradient fill on the text
	 *   [[pattern(name): WORD]]   → image/pattern fill on the text
	 *   [[marker(#hex): WORD]]  → solid background behind phrase
	 */
	import { parseHighlightMarkup, segmentText } from '$lib/highlight';

	interface Props {
		text: string;
		defaultColor?: string;
		/** If false, `[[...]]` is shown as plain text (no accent spans). Default false — only News uses markup. */
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
		parseHighlights = false,
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
			: [{ text, highlighted: false as const }],
	);

	function patternStyle(img: string | undefined): string {
		if (!img) return '';
		return `background-image: url('${img}');` +
			`background-size: cover; background-position: center;` +
			`-webkit-background-clip: text; -webkit-text-fill-color: transparent;` +
			`background-clip: text; display: inline;` +
			`font-weight: inherit; font-style: inherit; text-decoration: inherit;`;
	}

	function markerStyle(bg: string): string {
		return (
			`background: ${bg};` +
			`box-decoration-break: clone; -webkit-box-decoration-break: clone;` +
			`padding: 0.08em 0.16em; border-radius: 0.14em;` +
			`color: inherit; font-weight: inherit; font-style: inherit; text-decoration: inherit;`
		);
	}
</script>

{#if as === 'div'}
	<div {style} class={klass} data-canvas-typography-root data-canvas-paint-root>
		{#each segments as seg}
			{#if seg.highlighted}
				{#if seg.markerBg}
					<span style={markerStyle(seg.markerBg)}>{seg.text}</span>
				{:else if seg.patternImage}
					<span style={patternStyle(seg.patternImage)}>{seg.text}</span>
				{:else if seg.gradientFrom && seg.gradientTo}
					<span style="background: linear-gradient(90deg, {seg.gradientFrom}, {seg.gradientTo}); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; font-weight: inherit; font-style: inherit; text-decoration: inherit;">{seg.text}</span>
				{:else if emphasisBold}
					<span style={boldSpanStyle}>{seg.text}</span>
				{:else}
					<span style="color: {seg.color}; font-weight: 700; font-style: inherit; text-decoration: inherit;">{seg.text}</span>
				{/if}
			{:else}
				{seg.text}
			{/if}
		{/each}
	</div>
{:else if as === 'p'}
	<p {style} class={klass} data-canvas-typography-root data-canvas-paint-root>
		{#each segments as seg}
			{#if seg.highlighted}
				{#if seg.markerBg}
					<span style={markerStyle(seg.markerBg)}>{seg.text}</span>
				{:else if seg.patternImage}
					<span style={patternStyle(seg.patternImage)}>{seg.text}</span>
				{:else if seg.gradientFrom && seg.gradientTo}
					<span style="background: linear-gradient(90deg, {seg.gradientFrom}, {seg.gradientTo}); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; font-weight: inherit; font-style: inherit; text-decoration: inherit;">{seg.text}</span>
				{:else if emphasisBold}
					<span style={boldSpanStyle}>{seg.text}</span>
				{:else}
					<span style="color: {seg.color}; font-weight: 700; font-style: inherit; text-decoration: inherit;">{seg.text}</span>
				{/if}
			{:else}
				{seg.text}
			{/if}
		{/each}
	</p>
{:else}
	<span {style} class={klass} data-canvas-typography-root data-canvas-paint-root>
		{#each segments as seg}
			{#if seg.highlighted}
				{#if seg.markerBg}
					<span style={markerStyle(seg.markerBg)}>{seg.text}</span>
				{:else if seg.patternImage}
					<span style={patternStyle(seg.patternImage)}>{seg.text}</span>
				{:else if seg.gradientFrom && seg.gradientTo}
					<span style="background: linear-gradient(90deg, {seg.gradientFrom}, {seg.gradientTo}); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; font-weight: inherit; font-style: inherit; text-decoration: inherit;">{seg.text}</span>
				{:else if emphasisBold}
					<span style={boldSpanStyle}>{seg.text}</span>
				{:else}
					<span style="color: {seg.color}; font-weight: 700; font-style: inherit; text-decoration: inherit;">{seg.text}</span>
				{/if}
			{:else}
				{seg.text}
			{/if}
		{/each}
	</span>
{/if}
