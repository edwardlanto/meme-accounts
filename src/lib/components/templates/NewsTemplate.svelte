<script lang="ts">
	import { parseHighlightMarkup, segmentText } from '$lib/highlight';

	interface Props {
		backgroundImage: string;
		circleImage?: string;
		text: string;
		source?: string;
		highlightColor?: string;
		textColor?: string;
		scale?: number;
		exportRef?: HTMLElement | null;
		// Canvas editing
		interactive?: boolean;
		circleX?: number;    // left position in template px (bindable)
		circleY?: number;    // top position in template px (bindable)
		circleSize?: number; // diameter in template px (bindable)
		onTextChange?: (t: string) => void;
		onCircleMove?: (x: number, y: number) => void;
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
		interactive = false,
		circleX = $bindable(772),
		circleY = $bindable(52),
		circleSize = $bindable(256),
		onTextChange,
		onCircleMove,
	}: Props = $props();

	const W = 1080;
	const H = 1350;

	let parsed   = $derived(parseHighlightMarkup(text, highlightColor));
	let segments = $derived(segmentText(parsed));

	let fontSize = $derived(
		parsed.plain.length < 60  ? 108
		: parsed.plain.length < 90  ? 92
		: parsed.plain.length < 120 ? 78
		: 66
	);

	// ── Inline text editing ────────────────────────────────────────────────
	let editing = $state(false);
	let editableEl = $state<HTMLElement | null>(null);
	let hoveringText = $state(false);

	function startEdit(e: MouseEvent) {
		if (!interactive) return;
		e.stopPropagation();
		editing = true;
		setTimeout(() => {
			if (editableEl) {
				editableEl.focus();
				// Place cursor at end
				const range = document.createRange();
				range.selectNodeContents(editableEl);
				range.collapse(false);
				const sel = window.getSelection();
				sel?.removeAllRanges();
				sel?.addRange(range);
			}
		}, 10);
	}

	function finishEdit() {
		if (!editing) return;
		editing = false;
		const newText = editableEl?.innerText?.trim() ?? text;
		if (newText !== text) onTextChange?.(newText);
	}

	function onEditKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') { finishEdit(); }
		if (e.key === 'Enter' && e.shiftKey) { e.preventDefault(); finishEdit(); }
	}

	// ── Circle drag ────────────────────────────────────────────────────────
	let dragging = $state(false);
	let lastMx = 0;
	let lastMy = 0;

	function circlePointerDown(e: PointerEvent) {
		if (!interactive) return;
		dragging = true;
		lastMx = e.clientX;
		lastMy = e.clientY;
		(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
		e.stopPropagation();
		e.preventDefault();
	}

	function circlePointerMove(e: PointerEvent) {
		if (!dragging) return;
		const dx = (e.clientX - lastMx) / scale;
		const dy = (e.clientY - lastMy) / scale;
		lastMx = e.clientX;
		lastMy = e.clientY;
		const nx = Math.max(0, Math.min(W - circleSize, circleX + dx));
		const ny = Math.max(0, Math.min(H - circleSize, circleY + dy));
		circleX = nx;
		circleY = ny;
		onCircleMove?.(nx, ny);
	}

	function circlePointerUp() {
		dragging = false;
	}

	// ── Pattern rendering helpers ──────────────────────────────────────────
	function patternStyle(patternImage: string | undefined): string {
		if (!patternImage) return '';
		return `
			background-image: url('${patternImage}');
			background-size: cover;
			background-position: center;
			-webkit-background-clip: text;
			-webkit-text-fill-color: transparent;
			background-clip: text;
			display: inline;
		`;
	}
</script>

<!-- Outer wrapper — controls display size -->
<div style="
	width: {W * scale}px;
	height: {H * scale}px;
	overflow: hidden;
	border-radius: {scale < 1 ? '12px' : '0'};
	flex-shrink: 0;
	position: relative;
">
	<!-- Inner at 1080×1350 — scaled via CSS transform -->
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
			font-family: 'Bebas Neue', Impact, 'Arial Black', sans-serif;
			{interactive ? 'user-select: none;' : ''}
		"
	>
		<!-- Background image -->
		{#if backgroundImage}
			<img
				src={backgroundImage}
				alt=""
				style="
					position: absolute; inset: 0;
					width: 100%; height: 100%;
					object-fit: cover; object-position: center top;
				"
			/>
		{:else}
			<div style="
				position: absolute; inset: 0;
				background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
			"></div>
		{/if}

		<!-- Gradient overlay -->
		<div style="
			position: absolute; inset: 0;
			background: linear-gradient(
				to bottom,
				rgba(0,0,0,0)    0%,
				rgba(0,0,0,0)    25%,
				rgba(0,0,0,0.15) 45%,
				rgba(0,0,0,0.65) 62%,
				rgba(0,0,0,0.88) 75%,
				rgba(0,0,0,0.97) 88%,
				#000             100%
			);
			pointer-events: none;
		"></div>

		<!-- ── Draggable circle badge ──────────────────────────────────────── -->
		{#if circleImage}
			<div
				style="
					position: absolute;
					left: {circleX}px;
					top: {circleY}px;
					width: {circleSize}px;
					height: {circleSize}px;
					border-radius: 50%;
					border: 8px solid #fff;
					overflow: visible;
					z-index: 20;
					box-shadow: 0 8px 32px rgba(0,0,0,0.5);
					cursor: {interactive ? (dragging ? 'grabbing' : 'grab') : 'default'};
					touch-action: none;
				"
				onpointerdown={circlePointerDown}
				onpointermove={circlePointerMove}
				onpointerup={circlePointerUp}
				onpointercancel={circlePointerUp}
			>
				<img
					src={circleImage}
					alt=""
					style="
						width: 100%; height: 100%;
						object-fit: cover; object-position: center;
						border-radius: 50%;
						pointer-events: none;
					"
				/>
				<!-- Drag indicator (only in interactive mode) -->
				{#if interactive}
					<div style="
						position: absolute;
						bottom: -2px; right: -2px;
						width: 48px; height: 48px;
						border-radius: 50%;
						background: rgba(0,0,0,0.75);
						border: 2px solid rgba(255,255,255,0.3);
						display: flex; align-items: center; justify-content: center;
						font-size: 22px; color: rgba(255,255,255,0.8);
						pointer-events: none;
					">⠿</div>
				{/if}
			</div>
		{/if}

		<!-- ── Text area ──────────────────────────────────────────────────── -->
		<div
			style="
				position: absolute;
				bottom: 0; left: 0; right: 0;
				padding: 48px 64px 72px;
				z-index: 10;
				{interactive && !editing ? 'cursor: text;' : ''}
			"
			onclick={startEdit}
			role={interactive ? 'button' : undefined}
			tabindex={interactive ? 0 : undefined}
			onmouseenter={() => hoveringText = true}
			onmouseleave={() => hoveringText = false}
		>
			<!-- Edit hint outline -->
			{#if interactive && hoveringText && !editing}
				<div style="
					position: absolute;
					inset: 8px;
					border: 2px dashed rgba(255,255,255,0.25);
					border-radius: 8px;
					pointer-events: none;
				"></div>
				<div style="
					position: absolute;
					top: 14px; right: 18px;
					font-family: 'DM Sans', sans-serif;
					font-size: 20px;
					color: rgba(255,255,255,0.4);
					pointer-events: none;
					letter-spacing: 0;
				">✎ click to edit</div>
			{/if}

			<!-- Source label -->
			{#if source}
				<div style="
					display: flex; align-items: center;
					gap: 18px; margin-bottom: 22px;
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
						<span style="font-style: italic;">{source.slice(0,1).toLowerCase()}</span>{source.slice(1)}
					</span>
					<div style="flex: 1; height: 2px; background: {highlightColor}; opacity: 0.9;"></div>
				</div>
			{/if}

			<!-- Inline editor (active) -->
			{#if editing && interactive}
				<!-- svelte-ignore a11y_no_static_element_interactions -->
				<div
					bind:this={editableEl}
					contenteditable="true"
					onblur={finishEdit}
					onkeydown={onEditKeydown}
					onclick={(e) => e.stopPropagation()}
					style="
						margin: 0; padding: 8px;
						color: {textColor};
						font-size: {fontSize}px;
						font-family: 'Bebas Neue', Impact, 'Arial Black', sans-serif;
						font-weight: 400;
						line-height: 1.06;
						letter-spacing: 3px;
						text-transform: uppercase;
						word-break: break-word;
						outline: 2px solid rgba(255,255,255,0.4);
						border-radius: 4px;
						min-height: 80px;
						cursor: text;
						white-space: pre-wrap;
					"
				>{text}</div>
				<p style="
					font-family: 'DM Sans', sans-serif;
					font-size: 20px;
					color: rgba(255,255,255,0.3);
					margin: 12px 0 0;
					letter-spacing: 0;
					text-transform: none;
				">Use [[WORD]] for highlights · Shift+Enter or Esc to finish</p>

			{:else}
				<!-- Rendered headline with highlights -->
				<p style="
					margin: 0; padding: 0;
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
							{#if seg.patternImage}
								<span style={patternStyle(seg.patternImage)}>{seg.text}</span>
							{:else if seg.gradientFrom && seg.gradientTo}
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
			{/if}
		</div>
	</div>
</div>
