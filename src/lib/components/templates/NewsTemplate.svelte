<script lang="ts">
	import { parseHighlightMarkup, segmentText } from '$lib/highlight';

	interface Props {
		backgroundImage: string;       // URL or base64 data URL
		circleImage?: string;          // URL or base64 data URL (optional)
		text: string;                  // Overlay text with optional [[...]] markup
		source?: string;               // Source label e.g. "Markets", "Tech", "Finance"
		highlightColor?: string;       // Default highlight color (gold)
		textColor?: string;            // Main text color (white)
		scale?: number;                // Scale factor for preview (1 = full 1080x1350)
		exportRef?: HTMLElement | null; // Bind this to capture the element for export
	}

	let {
		backgroundImage,
		circleImage,
		text,
		source = 'Markets',
		highlightColor = '#F5A623',
		textColor = '#FFFFFF',
		scale = 1,
		exportRef = $bindable(null),
	}: Props = $props();

	let parsed = $derived(parseHighlightMarkup(text, highlightColor));
	let segments = $derived(segmentText(parsed));

	// Dynamically size font based on text length
	let fontSize = $derived(
		parsed.plain.length < 60 ? 108
		: parsed.plain.length < 90 ? 92
		: parsed.plain.length < 120 ? 78
		: 66
	);
</script>

<!-- Outer wrapper handles preview scaling -->
<div style="
	width: {1080 * scale}px;
	height: {1350 * scale}px;
	overflow: hidden;
	border-radius: {scale < 1 ? '12px' : '0'};
	flex-shrink: 0;
">
	<!-- The actual 1080×1350 template — scaled down for preview -->
	<div
		bind:this={exportRef}
		style="
			width: 1080px;
			height: 1350px;
			position: relative;
			overflow: hidden;
			background: #000;
			transform: scale({scale});
			transform-origin: top left;
			font-family: 'Bebas Neue', Impact, 'Arial Black', sans-serif;
		"
	>
		<!-- Background image -->
		{#if backgroundImage}
			<img
				src={backgroundImage}
				alt=""
				style="
					position: absolute;
					inset: 0;
					width: 100%;
					height: 100%;
					object-fit: cover;
					object-position: center top;
				"
			/>
		{:else}
			<!-- Placeholder gradient when no image -->
			<div style="
				position: absolute;
				inset: 0;
				background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
			"></div>
		{/if}

		<!-- Bottom gradient overlay — dark fade for text legibility -->
		<div style="
			position: absolute;
			inset: 0;
			background: linear-gradient(
				to bottom,
				rgba(0,0,0,0) 0%,
				rgba(0,0,0,0) 25%,
				rgba(0,0,0,0.15) 45%,
				rgba(0,0,0,0.65) 62%,
				rgba(0,0,0,0.88) 75%,
				rgba(0,0,0,0.97) 88%,
				#000 100%
			);
		"></div>

		<!-- Circle image badge (top-right) -->
		{#if circleImage}
			<div style="
				position: absolute;
				top: 52px;
				right: 52px;
				width: 256px;
				height: 256px;
				border-radius: 50%;
				border: 8px solid #fff;
				overflow: hidden;
				z-index: 20;
				box-shadow: 0 8px 32px rgba(0,0,0,0.5);
			">
				<img
					src={circleImage}
					alt=""
					style="width: 100%; height: 100%; object-fit: cover; object-position: center;"
				/>
			</div>
		{/if}

		<!-- Bottom text area -->
		<div style="
			position: absolute;
			bottom: 0;
			left: 0;
			right: 0;
			padding: 48px 64px 72px;
			z-index: 10;
		">
			<!-- Source label -->
			{#if source}
				<div style="
					display: flex;
					align-items: center;
					gap: 18px;
					margin-bottom: 22px;
				">
					<div style="flex: 1; height: 2px; background: {highlightColor}; opacity: 0.9;"></div>
					<span style="
						color: {highlightColor};
						font-style: italic;
						font-family: Georgia, 'Times New Roman', serif;
						font-size: 34px;
						letter-spacing: 3px;
						font-weight: bold;
						white-space: nowrap;
					">
						<!-- Italic m + rest: mimic the "Markets" logo style -->
						<span style="font-style: italic;">{source.slice(0,1).toLowerCase()}</span>{source.slice(1)}
					</span>
					<div style="flex: 1; height: 2px; background: {highlightColor}; opacity: 0.9;"></div>
				</div>
			{/if}

			<!-- Main headline text with inline highlights -->
			<p style="
				margin: 0;
				padding: 0;
				color: {textColor};
				font-size: {fontSize}px;
				font-family: 'Bebas Neue', Impact, 'Arial Black', sans-serif;
				font-weight: 400;
				line-height: 1.06;
				letter-spacing: 3px;
				text-transform: uppercase;
				word-break: break-word;
			">
				{#each segments as seg}
					{#if seg.highlighted}
						{#if seg.gradientFrom && seg.gradientTo}
							<span style="
								background: linear-gradient(90deg, {seg.gradientFrom}, {seg.gradientTo});
								-webkit-background-clip: text;
								-webkit-text-fill-color: transparent;
								background-clip: text;
							">{seg.text}</span>
						{:else}
							<span style="color: {seg.color};">{seg.text}</span>
						{/if}
					{:else}
						{seg.text}
					{/if}
				{/each}
			</p>
		</div>
	</div>
</div>
