<script lang="ts">
	/**
	 * Renders a string containing `[[...]]` highlight markup as styled spans,
	 * so users never see raw brackets. Templates that used to print `{text}`
	 * directly should route through this component to stay consistent with
	 * NewsTemplate (the only template that previously parsed markup).
	 *
	 * Supported syntax (shared across every template):
	 *   [[WORD]]                  → colored with `defaultColor`
	 *   [[#hex: WORD]]            → colored with explicit hex
	 *   [[grad(#a,#b): WORD]]     → linear gradient fill on the text
	 *   [[pattern(name): WORD]]   → image/pattern fill on the text
	 */
	import { parseHighlightMarkup, segmentText } from '$lib/highlight';

	interface Props {
		text: string;
		defaultColor?: string;
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
		as = 'span',
		style = '',
		class: klass = '',
	}: Props = $props();

	const segments = $derived(segmentText(parseHighlightMarkup(text, defaultColor)));

	function patternStyle(img: string | undefined): string {
		if (!img) return '';
		return `background-image: url('${img}');` +
			`background-size: cover; background-position: center;` +
			`-webkit-background-clip: text; -webkit-text-fill-color: transparent;` +
			`background-clip: text; display: inline;`;
	}
</script>

{#if as === 'div'}
	<div {style} class={klass}>
		{#each segments as seg}
			{#if seg.highlighted}
				{#if seg.patternImage}
					<span style={patternStyle(seg.patternImage)}>{seg.text}</span>
				{:else if seg.gradientFrom && seg.gradientTo}
					<span style="background: linear-gradient(90deg, {seg.gradientFrom}, {seg.gradientTo}); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;">{seg.text}</span>
				{:else}
					<span style="color: {seg.color};">{seg.text}</span>
				{/if}
			{:else}
				{seg.text}
			{/if}
		{/each}
	</div>
{:else if as === 'p'}
	<p {style} class={klass}>
		{#each segments as seg}
			{#if seg.highlighted}
				{#if seg.patternImage}
					<span style={patternStyle(seg.patternImage)}>{seg.text}</span>
				{:else if seg.gradientFrom && seg.gradientTo}
					<span style="background: linear-gradient(90deg, {seg.gradientFrom}, {seg.gradientTo}); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;">{seg.text}</span>
				{:else}
					<span style="color: {seg.color};">{seg.text}</span>
				{/if}
			{:else}
				{seg.text}
			{/if}
		{/each}
	</p>
{:else}
	<span {style} class={klass}>
		{#each segments as seg}
			{#if seg.highlighted}
				{#if seg.patternImage}
					<span style={patternStyle(seg.patternImage)}>{seg.text}</span>
				{:else if seg.gradientFrom && seg.gradientTo}
					<span style="background: linear-gradient(90deg, {seg.gradientFrom}, {seg.gradientTo}); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;">{seg.text}</span>
				{:else}
					<span style="color: {seg.color};">{seg.text}</span>
				{/if}
			{:else}
				{seg.text}
			{/if}
		{/each}
	</span>
{/if}
