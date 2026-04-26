<script lang="ts">
	import HighlightedText from '$lib/components/HighlightedText.svelte';
	import CanvasMarkupTextBlock from '$lib/components/CanvasMarkupTextBlock.svelte';
	import type { TextElementKind, TextStyle } from '$lib/types';

	interface Props {
		name?: string;
		handle?: string;
		avatar?: string;
		ringColor?: string;
		bgColor?: string;
		templateTheme?: 'light' | 'dark';
		text?: string;
		showSwipe?: boolean;
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
		showToolbar?: boolean;
	}

	let {
		name      = 'Captains of industry',
		handle    = '@captainsofindustryy',
		avatar    = '',
		ringColor = '#c9b97a',
		bgColor   = '',
		templateTheme = 'light',
		text      = 'When your home is titled in your name, it becomes a legal target.',
		showSwipe = true,
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
		showToolbar = false,
	}: Props = $props();

	const isLight = $derived(templateTheme === 'light');
	const baseBg = $derived((bgColor || (isLight ? '#ffffff' : '#0a0a0a')).trim());
	const baseText = $derived(isLight ? '#0a0a0a' : '#ffffff');
	const baseMuted = $derived(isLight ? 'rgba(10,10,10,0.50)' : '#888888');

	const bodyTypeCss = $derived.by(() => {
		const s = headlineStyle;
		const bits: string[] = [];
		if (s.fontFamily) bits.push(`font-family: '${s.fontFamily}', -apple-system, 'SF Pro Display', sans-serif;`);
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

	function initials(n: string) {
		return n.replace(/[^\w\s]/g, '').trim().split(/\s+/).map(w => w[0]?.toUpperCase() ?? '').slice(0, 3).join('');
	}

	/** Split text into paragraphs on double-newline */
	const paragraphs = $derived(text.split(/\n\n+/).map(p => p.trim()).filter(Boolean));
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
			font-family: -apple-system, 'SF Pro Display', 'Helvetica Neue', Arial, sans-serif;
			display: flex;
			flex-direction: column;
			box-sizing: border-box;
			padding: 100px 88px 100px;
			overflow: hidden;
		"
	>
		<!-- ── Profile row ─────────────────────────────────────────────────── -->
		<div style="display: flex; align-items: center; gap: 36px; margin-bottom: 100px; flex-shrink: 0;">

			<!-- Avatar circle with ring -->
			<div style="
				width: 130px; height: 130px; border-radius: 50%; flex-shrink: 0;
				display: flex; align-items: center; justify-content: center;
				padding: 5px;
				background: linear-gradient(135deg, {ringColor}, color-mix(in srgb, {ringColor} 60%, white));
			">
				<div style="
					width: 100%; height: 100%; border-radius: 50%; overflow: hidden;
					background: {baseBg};
					display: flex; align-items: center; justify-content: center;
					box-sizing: border-box;
				">
					{#if avatar}
						<img src={avatar} alt="" style="width: 100%; height: 100%; object-fit: cover;" />
					{:else}
						<span style="
							color: {baseText};
							font-size: 36px;
							font-weight: 800;
							letter-spacing: -1px;
							line-height: 1;
						">{initials(name)}</span>
					{/if}
				</div>
			</div>

			<!-- Name + handle -->
			<div style="flex: 1; min-width: 0;">
				<CanvasMarkupTextBlock
					value={name}
					{interactive}
					rows={1}
					showToolbar={false}
					ariaLabel="Name"
					fontFamily={headlineStyle.fontFamily}
					fontSize={46}
					onTextChange={onNameChange}
					onTextSelect={onTextSelect}
				>
					{#snippet display()}
						<p style="
							margin: 0 0 8px;
							font-size: 46px;
							font-weight: 800;
							color: {baseText};
							line-height: 1.1;
							letter-spacing: -0.5px;
						">{name}</p>
					{/snippet}
				</CanvasMarkupTextBlock>

				<CanvasMarkupTextBlock
					value={handle}
					{interactive}
					rows={1}
					showToolbar={false}
					ariaLabel="Handle"
					fontFamily={headlineStyle.fontFamily}
					fontSize={36}
					onTextChange={onHandleChange}
					onTextSelect={onTextSelect}
				>
					{#snippet display()}
						<p style="
							margin: 0;
							font-size: 36px;
							font-weight: 400;
							font-style: italic;
							color: {baseMuted};
							letter-spacing: -0.2px;
						">{handle}</p>
					{/snippet}
				</CanvasMarkupTextBlock>
			</div>
		</div>

		<!-- ── Body text ──────────────────────────────────────────────────── -->
		<div style="flex: 1; display: flex; flex-direction: column; justify-content: flex-start;">
			<CanvasMarkupTextBlock
				value={text}
				{interactive}
				selected={selectedText === 'headline'}
				rows={10}
				ariaLabel="Carousel text"
				fontFamily={headlineStyle.fontFamily}
				fontSize={headlineStyle.fontSize}
				{showToolbar}
				onTextChange={onTextChange}
				onTextSelect={onTextSelect}
				onHeadlineRangeSelect={onHeadlineRangeSelect}
			>
				{#snippet display()}
					<div style="display: flex; flex-direction: column; justify-content: flex-start;">
						{#each paragraphs as para, i}
							<HighlightedText
								as="p"
								text={para}
								style="margin: 0; {i < paragraphs.length - 1 ? 'margin-bottom: 72px;' : ''} font-size: 72px; font-weight: 500; color: {baseText}; line-height: 1.38; letter-spacing: -0.8px; word-break: break-word; {bodyTypeCss}"
							/>
						{/each}
					</div>
				{/snippet}
			</CanvasMarkupTextBlock>
		</div>

		<!-- ── Swipe indicator ─────────────────────────────────────────────── -->
		{#if showSwipe}
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
		{/if}
	</div>
</div>
