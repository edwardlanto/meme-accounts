<script lang="ts">
	import { tick } from 'svelte';
	import HighlightEditor from '$lib/components/HighlightEditor.svelte';
	import { parseHighlightMarkup, segmentText } from '$lib/highlight';
	import type { TextOverlay } from '$lib/types';
	import { patternStyleForUrl } from '$lib/components/textOverlayPattern';

	interface Props {
		w: number;
		h: number;
		scale?: number;
		interactive?: boolean;
		textOverlays?: TextOverlay[];
		/** Currently-selected text overlay id (for showing selection outline). */
		selectedId?: string | null;
		highlightColor?: string;
		/** Plain-text selection range inside the active overlay editor. */
		onRangeSelect?: (plainStart: number, plainEnd: number) => void;
		onTextOverlaysChange?: (next: TextOverlay[]) => void;
		onTextSelect?: (kind: 'textOverlay', anchor: HTMLElement) => void;
	}

	let {
		w,
		h,
		scale = 1,
		interactive = true,
		textOverlays = [],
		selectedId = null,
		highlightColor = '#F5A623',
		onRangeSelect,
		onTextOverlaysChange,
		onTextSelect,
	}: Props = $props();

	const W = $derived(Math.max(1, Number(w) || 1080));
	const H = $derived(Math.max(1, Number(h) || 1350));

	let activeId = $state<string | null>(null);
	let dragId = $state<string | null>(null);
	let holdTimer: ReturnType<typeof setTimeout> | null = null;
	let downTarget: HTMLElement | null = null;
	let downPointerId = -1;
	let lastMx = 0;
	let lastMy = 0;
	let editingId = $state<string | null>(null);

	$effect(() => {
		const id = editingId;
		if (!id) return;
		void tick().then(() => {
			const el = document.querySelector<HTMLElement>(
				`[data-text-overlay-id="${CSS.escape(id)}"] [contenteditable="true"]`,
			);
			try {
				el?.focus();
				// Match the "main text" behavior: enter edit mode with a visible selection.
				// Selecting all also makes it obvious the overlay is editable.
				if (el) {
					const r = document.createRange();
					r.selectNodeContents(el);
					const sel = window.getSelection();
					sel?.removeAllRanges();
					sel?.addRange(r);
				}
			} catch {}
		});
	});

	function down(e: PointerEvent, id: string) {
		if (!interactive) return;
		// If we're currently editing this overlay, do not hijack pointer events
		// (selection/caret should behave like the main text editor).
		if (editingId === id) return;
		try { (e.currentTarget as HTMLElement).dataset.textOverlayId = id; } catch {}
		onTextSelect?.('textOverlay', e.currentTarget as HTMLElement);
		activeId = id; // selected, but not dragging yet
		downTarget = e.currentTarget as HTMLElement;
		downPointerId = e.pointerId;
		lastMx = e.clientX;
		lastMy = e.clientY;
		dragId = null;
		if (holdTimer) { try { clearTimeout(holdTimer); } catch {} holdTimer = null; }
		// Hold-to-drag: allow click/dblclick to pass through naturally.
		holdTimer = setTimeout(() => {
			if (!downTarget || downPointerId === -1) return;
			dragId = id;
			try { downTarget.setPointerCapture(downPointerId); } catch {}
		}, 180);
		e.stopPropagation();
	}

	function move(e: PointerEvent, id: string) {
		if (dragId !== id) return;
		const dx = (e.clientX - lastMx) / scale;
		const dy = (e.clientY - lastMy) / scale;
		lastMx = e.clientX;
		lastMy = e.clientY;

		const ov = textOverlays.find((o) => o.id === id);
		if (!ov) return;

		const el = e.currentTarget as HTMLElement;
		const r = el.getBoundingClientRect();
		const curW = Math.max(1, r.width / scale);
		const curH = Math.max(1, r.height / scale);
		const nx = Math.max(0, Math.min(W - curW, ov.x + dx));
		const ny = Math.max(0, Math.min(H - curH, ov.y + dy));
		onTextOverlaysChange?.(textOverlays.map((o) => (o.id === id ? { ...o, x: nx, y: ny } : o)));
	}

	function up() {
		if (holdTimer) { try { clearTimeout(holdTimer); } catch {} holdTimer = null; }
		downTarget = null;
		downPointerId = -1;
		activeId = null;
		dragId = null;
	}

	function del(e: MouseEvent, id: string) {
		e.stopPropagation();
		onTextOverlaysChange?.(textOverlays.filter((o) => o.id !== id));
		if (editingId === id) editingId = null;
	}

	function startEdit(e: MouseEvent, id: string) {
		if (!interactive) return;
		e.stopPropagation();
		// Keep toolbar selection anchored to this overlay when switching into edit mode.
		const box = (e.currentTarget as HTMLElement).closest<HTMLElement>('[data-text-overlay-id]');
		if (box) {
			try { box.dataset.textOverlayId = id; } catch {}
			onTextSelect?.('textOverlay', box);
		}
		editingId = id;
	}

	function finishEdit(id: string) {
		if (editingId !== id) return;
		editingId = null;
	}
</script>

<!-- Absolute overlay layer that matches canvas geometry -->
<div
	style="
		position: absolute;
		inset: 0;
		z-index: 80;
		/* Fill the preview canvas box (which is already sized to H*scale). */
		width: 100%;
		height: 100%;
		/* Don't block interactions with the template beneath.
		   Individual overlays opt-in to pointer events. */
		pointer-events: none;
	"
>
	<!-- Inner at W×H — scaled via CSS transform -->
	<div
		style="
			width: {W}px;
			height: {H}px;
			position: relative;
			transform: scale({scale});
			transform-origin: top left;
			pointer-events: none;
		"
	>
		{#each textOverlays as t (t.id)}
			{@const isEditing = editingId === t.id}
			{@const isSelected = !!selectedId && selectedId === t.id}
			{@const css = t.style ?? {}}
			<div
				style="
					position: absolute;
					left: {t.x}px; top: {t.y}px;
					width: {Math.max(40, Number(t.w) || 0)}px;
					/* Height should hug content; old drafts may have large h values. */
					min-height: {Math.max(24, Number(t.h) || 0)}px;
					max-width: 820px;
					z-index: 60;
					touch-action: none;
					cursor: {interactive ? (activeId === t.id ? 'grabbing' : 'grab') : 'default'};
					pointer-events: {interactive ? 'auto' : 'none'};
				"
				data-text-selectable="textOverlay"
				data-text-overlay-id={t.id}
				onpointerdown={(e: PointerEvent) => down(e, t.id)}
				onpointermove={(e: PointerEvent) => move(e, t.id)}
				onpointerup={up}
				onpointercancel={up}
				ondblclick={(e: MouseEvent) => startEdit(e, t.id)}
				role="presentation"
			>
				{#if isEditing}
					<div
						style="
							/* Let the editor define height so the box stays tight. */
							padding: 6px 8px;
							box-sizing: border-box;
							border-radius: 10px;
							background: rgba(0,0,0,0.14);
							border: 1px solid rgba(255,255,255,0.25);
							color: {css.color ?? '#FFFFFF'};
							font-family: {css.fontFamily ? `'${css.fontFamily}', system-ui, -apple-system, sans-serif` : `'DM Sans', system-ui, -apple-system, sans-serif`};
							font-size: {css.fontSize ?? 42}px;
							font-weight: {css.fontWeight ?? 700};
							text-align: {css.align ?? 'left'};
							line-height: {css.lineHeight ?? 1.15};
							letter-spacing: {css.letterSpacing != null ? `${css.letterSpacing}em` : '0'};
							width: 100%;
						"
						onclick={(e) => e.stopPropagation()}
						role="presentation"
					>
						<HighlightEditor
							value={t.text}
							rows={1}
							minHeight="0px"
							showToolbar={false}
							defaultColor={highlightColor}
							fontFamily={css.fontFamily}
							fontSize={css.fontSize ?? 42}
							ariaLabel="Text overlay editor"
							onSelectionChange={(has, r) => {
								if (!has || !r) onRangeSelect?.(-1, -1);
								else onRangeSelect?.(r.start, r.end);
							}}
							onFocus={() => {
								// Re-assert selection when the editor gains focus (keeps floating toolbar stable).
								const box = document.querySelector<HTMLElement>(`[data-text-overlay-id="${CSS.escape(t.id)}"]`);
								if (box) {
									try { box.dataset.textOverlayId = t.id; } catch {}
									onTextSelect?.('textOverlay', box);
								}
							}}
							onChange={(v) => onTextOverlaysChange?.(textOverlays.map(o => o.id === t.id ? { ...o, text: v } : o))}
							onBlur={() => finishEdit(t.id)}
						/>
					</div>
				{:else}
					<!-- svelte-ignore a11y_no_static_element_interactions -->
					<div
						ondblclick={(e) => startEdit(e, t.id)}
						style="
							padding: 6px 8px;
							box-sizing: border-box;
							border-radius: 10px;
							background: {isSelected ? 'color-mix(in oklab, var(--app-selection-bg) 42%, rgba(0,0,0,0.10))' : 'rgba(0,0,0,0.10)'};
							border: 1px dashed rgba(255,255,255,0.25);
							/* Use outline so selection styling never shifts layout/position. */
							outline: {isSelected ? '2px solid color-mix(in oklab, var(--app-selection-bg) 70%, rgba(255,255,255,0.18))' : '2px solid transparent'};
							outline-offset: 0px;
							color: {css.color ?? '#FFFFFF'};
							font-family: {css.fontFamily ? `'${css.fontFamily}', system-ui, -apple-system, sans-serif` : `'DM Sans', system-ui, -apple-system, sans-serif`};
							font-size: {css.fontSize ?? 42}px;
							font-weight: {css.fontWeight ?? 700};
							text-align: {css.align ?? 'left'};
							line-height: {css.lineHeight ?? 1.15};
							letter-spacing: {css.letterSpacing != null ? `${css.letterSpacing}em` : '0'};
							width: 100%;
							overflow: hidden;
							user-select: none;
							white-space: pre-wrap;
						"
					>
						{@html segmentText(parseHighlightMarkup(t.text, highlightColor)).map((seg) => {
							if (!seg.highlighted) return seg.text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
							if (seg.patternImage) {
								const s = patternStyleForUrl(seg.patternImage).replace(/\n/g,' ');
								return `<span style="${s}">${seg.text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</span>`;
							}
							if (seg.gradientFrom && seg.gradientTo) {
								return `<span style="background: linear-gradient(90deg, ${seg.gradientFrom}, ${seg.gradientTo}); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;">${seg.text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</span>`;
							}
							return `<span style="color: ${seg.color};">${seg.text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</span>`;
						}).join('')}
					</div>
				{/if}

				{#if interactive && !isEditing}
					<button
						type="button"
						onpointerdown={(e) => { e.stopPropagation(); e.preventDefault(); }}
						onclick={(e) => del(e, t.id)}
						style="
							position: absolute; top: -12px; right: -12px;
							width: 26px; height: 26px; border-radius: 50%;
							background: rgba(0,0,0,0.85); border: 2px solid rgba(255,255,255,0.35);
							color: #fff; font-size: 12px;
							display: flex; align-items: center; justify-content: center;
							cursor: pointer;
						"
						title="Remove text"
						aria-label="Remove text overlay"
					>✕</button>
				{/if}
			</div>
		{/each}
	</div>
</div>

