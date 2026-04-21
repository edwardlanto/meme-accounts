<script lang="ts">
	import { parseHighlightMarkup, segmentText } from '$lib/highlight';
	import type { Overlay } from '$lib/types';

	interface Props {
		// Canvas size (template pixels). Default is IG portrait 4:5.
		w?: number;
		h?: number;
		backgroundImage?: string;
		backgroundVideo?: string; // blob URL or data URL for video background
		circleImage?: string;
		text: string;
		source?: string;
		highlightColor?: string;
		textColor?: string;
		scale?: number;
		exportRef?: HTMLElement | null;
		// Canvas editing
		interactive?: boolean;
		circleX?: number;     // left position in template px (bindable)
		circleY?: number;     // top position in template px (bindable)
		circleSize?: number;  // diameter in template px (bindable)
		bgOffsetX?: number;   // background horizontal position 0–100% (bindable)
		bgOffsetY?: number;   // background vertical position 0–100% (bindable)
		textPanelOffsetY?: number; // bottom text panel offset (bindable, px)
		overlays?: Overlay[];
		onTextChange?: (t: string) => void;
		onCircleMove?: (x: number, y: number) => void;
		onOverlaysChange?: (overlays: Overlay[]) => void;
	}

	let {
		w = 1080,
		h = 1350,
		backgroundImage = '',
		backgroundVideo = '',
		circleImage,
		text,
		source = 'Markets',
		highlightColor = '#F5A623',
		textColor = '#FFFFFF',
		scale = 1,
		exportRef = $bindable(null),
		interactive = false,
		circleX    = $bindable(772),
		circleY    = $bindable(52),
		circleSize = $bindable(256),
		bgOffsetX  = $bindable(50),
		bgOffsetY  = $bindable(50),
		textPanelOffsetY = $bindable(0),
		overlays   = [],
		onTextChange,
		onCircleMove,
		onOverlaysChange,
	}: Props = $props();

	// Whether there's any background media (image or video)
	const hasBg = $derived(!!(backgroundVideo || backgroundImage));

	const W = $derived(Math.max(320, Number(w) || 1080));
	const H = $derived(Math.max(320, Number(h) || 1350));

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

	// ── Text panel drag (HTML) ─────────────────────────────────────────────
	const TEXT_PANEL_H = 520; // must match visual design; used for clamp range
	let textDragging = $state(false);
	let textStartY = 0;
	let textStartOffset = 0;
	let textMoved = false;

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

	function textPointerDown(e: PointerEvent) {
		if (!interactive) return;
		if (editing) return;
		textDragging = true;
		textMoved = false;
		textStartY = e.clientY;
		textStartOffset = textPanelOffsetY;
		(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
		e.stopPropagation();
	}

	function textPointerMove(e: PointerEvent) {
		if (!textDragging) return;
		const dy = (e.clientY - textStartY) / scale;
		if (Math.abs(dy) > 4) textMoved = true;

		// Allow dragging panel from its base position (0) all the way up to top
		const baseTop = H - TEXT_PANEL_H; // y where panel starts (in template px)
		const minOffset = -baseTop;
		const maxOffset = 0;
		textPanelOffsetY = Math.max(minOffset, Math.min(maxOffset, textStartOffset + dy));
	}

	function textPointerUp(e: PointerEvent) {
		if (!textDragging) return;
		textDragging = false;
		// If this was effectively a click (not a drag), enter edit mode.
		if (!textMoved) {
			startEdit(e as any);
		}
	}

	// ── Circle drag ────────────────────────────────────────────────────────
	let dragging = $state(false);
	let resizingCircle = $state(false);
	let lastMx = 0;
	let lastMy = 0;
	let circleStartSize = 0;
	let circleResizeStartMx = 0;
	let circleResizeStartMy = 0;

	function circlePointerDown(e: PointerEvent) {
		if (!interactive) return;
		if (resizingCircle) return;
		dragging = true;
		lastMx = e.clientX;
		lastMy = e.clientY;
		(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
		e.stopPropagation();
		e.preventDefault();
	}

	function circlePointerMove(e: PointerEvent) {
		if (!dragging || resizingCircle) return;
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

	function circleResizeDown(e: PointerEvent) {
		if (!interactive) return;
		resizingCircle = true;
		circleStartSize = circleSize;
		circleResizeStartMx = e.clientX;
		circleResizeStartMy = e.clientY;
		(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
		e.stopPropagation();
		e.preventDefault();
	}

	function circleResizeMove(e: PointerEvent) {
		if (!resizingCircle) return;
		const dx = (e.clientX - circleResizeStartMx) / scale;
		const dy = (e.clientY - circleResizeStartMy) / scale;
		const delta = Math.max(dx, dy);
		const nextSize = Math.round(Math.max(128, Math.min(512, circleStartSize + delta)));
		// Keep circle in bounds as it grows/shrinks
		circleSize = nextSize;
		circleX = Math.max(0, Math.min(W - circleSize, circleX));
		circleY = Math.max(0, Math.min(H - circleSize, circleY));
		onCircleMove?.(circleX, circleY);
	}

	function circleResizeUp() {
		resizingCircle = false;
	}

	// ── Background pan ─────────────────────────────────────────────────────
	let bgDragging = $state(false);
	let bgLastMx = 0;
	let bgLastMy = 0;

	function bgPointerDown(e: PointerEvent) {
		if (!interactive) return;
		bgDragging = true;
		bgLastMx = e.clientX;
		bgLastMy = e.clientY;
		(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
	}

	function bgPointerMove(e: PointerEvent) {
		if (!bgDragging) return;
		const dx = (e.clientX - bgLastMx) / scale;
		const dy = (e.clientY - bgLastMy) / scale;
		bgLastMx = e.clientX;
		bgLastMy = e.clientY;
		// "Grab and drag right" → image shifts right → offset decreases (shows left side)
		bgOffsetX = Math.max(0, Math.min(100, bgOffsetX - (dx / W) * 100));
		bgOffsetY = Math.max(0, Math.min(100, bgOffsetY - (dy / H) * 100));
	}

	function bgPointerUp() {
		bgDragging = false;
	}

	// ── Overlay drag + resize ──────────────────────────────────────────────
	let activeOverlayId = $state<string | null>(null); // dragging or resizing
	let overlayAction   = $state<'drag' | 'resize' | null>(null);
	let hoveredOverlayId = $state<string | null>(null);
	let ovLastMx = 0;
	let ovLastMy = 0;

	function overlayDragDown(e: PointerEvent, id: string) {
		if (!interactive) return;
		activeOverlayId = id;
		overlayAction   = 'drag';
		ovLastMx = e.clientX;
		ovLastMy = e.clientY;
		(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
		e.stopPropagation();
		e.preventDefault();
	}

	function overlayResizeDown(e: PointerEvent, id: string) {
		if (!interactive) return;
		activeOverlayId = id;
		overlayAction   = 'resize';
		ovLastMx = e.clientX;
		ovLastMy = e.clientY;
		(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
		e.stopPropagation();
		e.preventDefault();
	}

	function overlayPointerMove(e: PointerEvent, id: string) {
		if (activeOverlayId !== id) return;
		const dx = (e.clientX - ovLastMx) / scale;
		const dy = (e.clientY - ovLastMy) / scale;
		ovLastMx = e.clientX;
		ovLastMy = e.clientY;

		const ov = overlays.find(o => o.id === id);
		if (!ov) return;

		if (overlayAction === 'drag') {
			const nx = Math.max(0, Math.min(W - ov.w, ov.x + dx));
			const ny = Math.max(0, Math.min(H - ov.h, ov.y + dy));
			onOverlaysChange?.(overlays.map(o => o.id === id ? { ...o, x: nx, y: ny } : o));
		} else if (overlayAction === 'resize') {
			const aspect = ov.w / ov.h;
			const newW = Math.max(60, Math.min(W - ov.x, ov.w + dx));
			const newH = newW / aspect;
			onOverlaysChange?.(overlays.map(o => o.id === id ? { ...o, w: newW, h: newH } : o));
		}
	}

	function overlayPointerUp() {
		activeOverlayId = null;
		overlayAction   = null;
	}

	function overlayDelete(e: MouseEvent, id: string) {
		e.stopPropagation();
		onOverlaysChange?.(overlays.filter(o => o.id !== id));
	}

	// ── Add overlay image (upload) ─────────────────────────────────────────
	let overlayInputEl = $state<HTMLInputElement | null>(null);

	function openOverlayPicker(e: MouseEvent) {
		if (!interactive) return;
		e.stopPropagation();
		overlayInputEl?.click();
	}

	function onOverlayFile(e: Event) {
		if (!interactive) return;
		const file = (e.target as HTMLInputElement).files?.[0];
		if (!file) return;
		// reset input so same file can be re-added
		(e.target as HTMLInputElement).value = '';

		const reader = new FileReader();
		reader.onload = () => {
			const src = reader.result as string;
			const img = new window.Image();
			img.onload = () => {
				const aspect = img.naturalWidth / img.naturalHeight;
				const w0 = Math.min(320, img.naturalWidth || 320);
				const h0 = w0 / aspect;
				const next: Overlay = {
					id: crypto.randomUUID(),
					src,
					w: Math.round(w0),
					h: Math.round(h0),
					x: Math.round((W - w0) / 2),
					y: Math.round((H - h0) / 2),
				};
				onOverlaysChange?.([...(overlays ?? []), next]);
			};
			img.src = src;
		};
		reader.readAsDataURL(file);
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
	<!-- Inner at W×H — scaled via CSS transform -->
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
		<!-- Add overlay image (upload) -->
		{#if interactive}
			<!-- svelte-ignore a11y_consider_explicit_label -->
			<button
				onclick={openOverlayPicker}
				style="
					position: absolute;
					top: 18px; left: 18px;
					z-index: 30;
					padding: 10px 12px;
					border-radius: 999px;
					background: rgba(0,0,0,0.55);
					border: 1px solid rgba(255,255,255,0.18);
					color: rgba(255,255,255,0.85);
					font-family: 'DM Sans', system-ui, -apple-system, sans-serif;
					font-size: 14px;
					letter-spacing: 0;
					cursor: pointer;
					backdrop-filter: blur(6px);
				"
			>
				＋ Add image
			</button>
			<input
				bind:this={overlayInputEl}
				type="file"
				accept="image/*"
				style="display:none"
				onchange={onOverlayFile}
			/>
		{/if}

		<!-- Background: video takes priority over image -->
		{#if backgroundVideo}
			<!-- svelte-ignore a11y_media_has_caption -->
			<video
				src={backgroundVideo}
				autoplay
				loop
				muted
				playsinline
				style="
					position: absolute; inset: 0;
					width: 100%; height: 100%;
					object-fit: cover;
					object-position: {bgOffsetX}% {bgOffsetY}%;
					pointer-events: none;
				"
			></video>
		{:else if backgroundImage}
			<img
				src={backgroundImage}
				alt=""
				style="
					position: absolute; inset: 0;
					width: 100%; height: 100%;
					object-fit: cover;
					object-position: {bgOffsetX}% {bgOffsetY}%;
					pointer-events: none;
				"
			/>
		{:else}
			<div style="
				position: absolute; inset: 0;
				background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
			"></div>
		{/if}

		<!-- Background pan capture (sits above bg, below text z-10 and circle z-20) -->
		{#if interactive && hasBg}
			<div
				style="
					position: absolute; inset: 0; z-index: 2;
					cursor: {bgDragging ? 'grabbing' : 'move'};
					touch-action: none;
				"
				onpointerdown={bgPointerDown}
				onpointermove={bgPointerMove}
				onpointerup={bgPointerUp}
				onpointercancel={bgPointerUp}
				role="presentation"
			></div>
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

		<!-- ── Image overlays (stickers / logos) ────────────────────────────── -->
		{#each overlays as overlay (overlay.id)}
			{@const isActive  = activeOverlayId === overlay.id}
			{@const isHovered = hoveredOverlayId === overlay.id}
			{@const showControls = interactive && (isHovered || isActive)}
			<div
				style="
					position: absolute;
					left: {overlay.x}px; top: {overlay.y}px;
					width: {overlay.w}px; height: {overlay.h}px;
					z-index: 15;
					cursor: {isActive && overlayAction === 'drag' ? 'grabbing' : (interactive ? 'grab' : 'default')};
					touch-action: none;
					overflow: visible;
				"
				onpointerdown={(e) => overlayDragDown(e, overlay.id)}
				onpointermove={(e) => overlayPointerMove(e, overlay.id)}
				onpointerup={overlayPointerUp}
				onpointercancel={overlayPointerUp}
				onmouseenter={() => hoveredOverlayId = overlay.id}
				onmouseleave={() => { if (hoveredOverlayId === overlay.id) hoveredOverlayId = null; }}
				role="presentation"
			>
				<img
					src={overlay.src}
					alt=""
					style="
						width: 100%; height: 100%;
						object-fit: contain;
						pointer-events: none;
						display: block;
					"
				/>

				{#if showControls}
					<!-- Delete button — top-right corner -->
					<!-- svelte-ignore a11y_consider_explicit_label -->
					<button
						onclick={(e) => overlayDelete(e, overlay.id)}
						style="
							position: absolute; top: -14px; right: -14px;
							width: 28px; height: 28px; border-radius: 50%;
							background: rgba(0,0,0,0.85); border: 2px solid rgba(255,255,255,0.4);
							color: #fff; font-size: 13px; line-height: 1;
							display: flex; align-items: center; justify-content: center;
							cursor: pointer; z-index: 1; touch-action: none;
						"
					>✕</button>

					<!-- Resize handle — bottom-right corner -->
					<div
						style="
							position: absolute; bottom: -10px; right: -10px;
							width: 22px; height: 22px; border-radius: 4px;
							background: rgba(0,0,0,0.85); border: 2px solid rgba(255,255,255,0.5);
							cursor: nwse-resize; z-index: 1; touch-action: none;
							display: flex; align-items: center; justify-content: center;
							font-size: 11px; color: rgba(255,255,255,0.8);
						"
						onpointerdown={(e) => overlayResizeDown(e, overlay.id)}
						onpointermove={(e) => overlayPointerMove(e, overlay.id)}
						onpointerup={overlayPointerUp}
						onpointercancel={overlayPointerUp}
						role="presentation"
					>⤡</div>

					<!-- Selection outline -->
					<div style="
						position: absolute; inset: -2px;
						border: 2px dashed rgba(255,255,255,0.5);
						border-radius: 4px; pointer-events: none;
					"></div>
				{/if}
			</div>
		{/each}

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
				role="presentation"
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
					<!-- Resize handle (drag corner) -->
					<div
						style="
							position: absolute;
							right: -10px; bottom: -10px;
							width: 26px; height: 26px;
							border-radius: 8px;
							background: rgba(0,0,0,0.85);
							border: 2px solid rgba(255,255,255,0.45);
							display: flex; align-items: center; justify-content: center;
							font-size: 12px; color: rgba(255,255,255,0.85);
							cursor: nwse-resize;
							touch-action: none;
						"
						onpointerdown={circleResizeDown}
						onpointermove={circleResizeMove}
						onpointerup={circleResizeUp}
						onpointercancel={circleResizeUp}
						role="presentation"
					>⤡</div>
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
				transform: translateY({textPanelOffsetY}px);
				{interactive && !editing ? 'cursor: grab;' : ''}
			"
			onpointerdown={textPointerDown}
			onpointermove={textPointerMove}
			onpointerup={textPointerUp}
			onpointercancel={textPointerUp}
			role={interactive ? 'button' : undefined}
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
