<script lang="ts">
	import { FONT_TEMPLATE_DEFAULT } from '$lib/fonts/brand-fonts';
	import { canvasFontFamilyStack, loadGoogleFont } from '$lib/fonts';
	import { tick } from 'svelte';
	import HighlightEditor from '$lib/components/HighlightEditor.svelte';
	import { parseHighlightMarkup as parseHighlightToSegments, segmentText, highlightForegroundCss, highlightWeightCss } from '$lib/highlight';
	import type { TextOverlay } from '$lib/types';
	import { gradientTextFillCss, patternStyleForUrl, wrapClippedFillHtml } from '$lib/components/textOverlayPattern';
	import { textBgCss, textShadowStyleAttr } from '$lib/textStyleCss';
	import {
		CANVAS_TEXT_OVERLAY_PAD_PX,
		CANVAS_TEXT_OVERLAY_RING,
	} from '$lib/studio/canvas-text-chrome';

	interface Props {
		w: number;
		h: number;
		scale?: number;
		interactive?: boolean;
		textOverlays?: TextOverlay[];
		/** Currently-selected text overlay id (for showing selection outline). */
		selectedId?: string | null;
		highlightColor?: string;
		/** When false, overlay text is plain (no `[[…]]` rendering or HighlightEditor). */
		parseHighlightMarkup?: boolean;
		/** Snap box center to canvas center while dragging (blank / custom canvas). */
		snapToCanvasCenter?: boolean;
		/** CSS scale applied outside this layer (e.g. blank export wrapper). Used for pointer → template px. */
		pointerScale?: number;
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
		parseHighlightMarkup = false,
		snapToCanvasCenter = false,
		pointerScale,
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
	let snapGuide = $state<null | { x?: number; y?: number }>(null);

	const SNAP_IN_PX = 10;
	const SNAP_OUT_PX = 16;
	const ps = $derived(Math.max(0.001, pointerScale ?? scale));
	const PAD = CANVAS_TEXT_OVERLAY_PAD_PX;

	$effect(() => {
		for (const o of textOverlays) {
			const family = o.style?.fontFamily;
			if (family) void loadGoogleFont(family, o.style?.fontWeight ?? 600);
		}
	});
	const MIN_BOX_W = 80 + PAD * 2;
	const MIN_BOX_H = 40 + PAD * 2;
	const HANDLE = 10;

	type OverlayAction = 'drag' | 'resize' | null;

	let overlayAction = $state<OverlayAction>(null);
	let actionOverlayId = $state<string | null>(null);
	let resizeHandle = $state<string | null>(null);

	let dragOriginX = 0;
	let dragOriginY = 0;
	let dragPointerStartX = 0;
	let dragPointerStartY = 0;
	let snappedAxisX = false;
	let snappedAxisY = false;

	let resizeOriginX = 0;
	let resizeOriginY = 0;
	let resizeOriginW = 0;
	let resizeOriginH = 0;
	let resizePointerStartX = 0;
	let resizePointerStartY = 0;

	const RESIZE_HANDLES = [
		{ id: 'nw', cursor: 'nwse-resize', fx: 0, fy: 0 },
		{ id: 'n', cursor: 'ns-resize', fx: 0.5, fy: 0 },
		{ id: 'ne', cursor: 'nesw-resize', fx: 1, fy: 0 },
		{ id: 'e', cursor: 'ew-resize', fx: 1, fy: 0.5 },
		{ id: 'se', cursor: 'nwse-resize', fx: 1, fy: 1 },
		{ id: 's', cursor: 'ns-resize', fx: 0.5, fy: 1 },
		{ id: 'sw', cursor: 'nesw-resize', fx: 0, fy: 1 },
		{ id: 'w', cursor: 'ew-resize', fx: 0, fy: 0.5 },
	] as const;

	function overlayDims(t: TextOverlay) {
		const boxW = Math.max(MIN_BOX_W, Math.min(W - t.x, Number(t.w) || 200));
		const boxH = Math.max(MIN_BOX_H, Number(t.h) || MIN_BOX_H);
		return { boxW, boxH };
	}

	function patchOverlay(id: string, patch: Partial<TextOverlay>) {
		onTextOverlaysChange?.(textOverlays.map((o) => (o.id === id ? { ...o, ...patch } : o)));
	}

	function beginResize(
		id: string,
		handle: string,
		el: HTMLElement,
		opts: { pointerId: number; clientX: number; clientY: number },
	) {
		const ov = textOverlays.find((o) => o.id === id);
		if (!ov) return;
		const { boxW, boxH } = overlayDims(ov);
		overlayAction = 'resize';
		actionOverlayId = id;
		resizeHandle = handle;
		resizeOriginX = ov.x;
		resizeOriginY = ov.y;
		resizeOriginW = boxW;
		resizeOriginH = boxH;
		resizePointerStartX = opts.clientX;
		resizePointerStartY = opts.clientY;
		activeId = id;
		if (holdTimer) {
			try {
				clearTimeout(holdTimer);
			} catch {
				/* ignore */
			}
			holdTimer = null;
		}
		try {
			el.setPointerCapture(opts.pointerId);
		} catch {
			/* ignore */
		}
	}

	function resizeDown(e: PointerEvent, id: string, handle: string) {
		if (!interactive || editingId === id) return;
		const box = (e.currentTarget as HTMLElement).closest<HTMLElement>('[data-text-overlay-id]');
		if (!box) return;
		try {
			box.dataset.textOverlayId = id;
		} catch {
			/* ignore */
		}
		onTextSelect?.('textOverlay', box);
		beginResize(id, handle, box, {
			pointerId: e.pointerId,
			clientX: e.clientX,
			clientY: e.clientY,
		});
		e.stopPropagation();
		e.preventDefault();
	}

	function applyResizeMove(e: PointerEvent, id: string) {
		const h = resizeHandle;
		if (!h || overlayAction !== 'resize' || actionOverlayId !== id) return;

		const dx = (e.clientX - resizePointerStartX) / ps;
		const dy = (e.clientY - resizePointerStartY) / ps;
		let nx = resizeOriginX;
		let ny = resizeOriginY;
		let nw = resizeOriginW;
		let nh = resizeOriginH;

		const affectsEast = h === 'e' || h === 'ne' || h === 'se';
		const affectsWest = h === 'w' || h === 'nw' || h === 'sw';
		const affectsSouth = h === 's' || h === 'se' || h === 'sw';
		const affectsNorth = h === 'n' || h === 'ne' || h === 'nw';

		if (affectsEast) {
			nw = Math.max(MIN_BOX_W, Math.min(W - resizeOriginX, resizeOriginW + dx));
		}
		if (affectsWest) {
			const maxShrink = resizeOriginW - MIN_BOX_W;
			const d = Math.min(maxShrink, Math.max(-resizeOriginX, dx));
			nw = resizeOriginW - d;
			nx = resizeOriginX + d;
		}
		if (affectsSouth) {
			nh = Math.max(MIN_BOX_H, Math.min(H - resizeOriginY, resizeOriginH + dy));
		}
		if (affectsNorth) {
			const maxShrink = resizeOriginH - MIN_BOX_H;
			const d = Math.min(maxShrink, Math.max(-resizeOriginY, dy));
			nh = resizeOriginH - d;
			ny = resizeOriginY + d;
		}

		patchOverlay(id, { x: nx, y: ny, w: nw, h: nh });
	}

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

	function beginDrag(
		id: string,
		el: HTMLElement,
		opts: { pointerId: number; clientX: number; clientY: number },
	) {
		const ov = textOverlays.find((o) => o.id === id);
		if (!ov) return;
		dragId = id;
		dragOriginX = ov.x;
		dragOriginY = ov.y;
		dragPointerStartX = opts.clientX;
		dragPointerStartY = opts.clientY;
		snappedAxisX = false;
		snappedAxisY = false;
		snapGuide = null;
		try {
			el.setPointerCapture(opts.pointerId);
		} catch {
			/* ignore */
		}
	}

	function down(e: PointerEvent, id: string) {
		if (!interactive) return;
		// If we're currently editing this overlay, do not hijack pointer events
		// (selection/caret should behave like the main text editor).
		if (editingId === id) return;
		const el = e.currentTarget as HTMLElement;
		try {
			el.dataset.textOverlayId = id;
		} catch {
			/* ignore */
		}
		onTextSelect?.('textOverlay', el);
		activeId = id;
		downTarget = el;
		downPointerId = e.pointerId;
		lastMx = e.clientX;
		lastMy = e.clientY;
		dragId = null;
		if (holdTimer) {
			try {
				clearTimeout(holdTimer);
			} catch {
				/* ignore */
			}
			holdTimer = null;
		}
		// Blank canvas: drag immediately (parent applies previewScale). Other templates: brief hold so dbl-click still works.
		if (snapToCanvasCenter) {
			beginDrag(id, el, { pointerId: e.pointerId, clientX: e.clientX, clientY: e.clientY });
			e.preventDefault();
		} else {
			holdTimer = setTimeout(() => {
				if (!downTarget || downPointerId === -1) return;
				beginDrag(id, downTarget, {
					pointerId: downPointerId,
					clientX: lastMx,
					clientY: lastMy,
				});
			}, 180);
		}
		e.stopPropagation();
	}

	function move(e: PointerEvent, id: string) {
		if (overlayAction === 'resize' && actionOverlayId === id) {
			applyResizeMove(e, id);
			return;
		}
		if (dragId !== id) return;

		const ov = textOverlays.find((o) => o.id === id);
		if (!ov) return;
		const { boxW: curW } = overlayDims(ov);
		const el = e.currentTarget as HTMLElement;
		const measuredH = Math.max(overlayDims(ov).boxH, el.getBoundingClientRect().height / ps);

		const dx = (e.clientX - dragPointerStartX) / ps;
		const dy = (e.clientY - dragPointerStartY) / ps;
		let nx = Math.max(0, Math.min(W - curW, dragOriginX + dx));
		let ny = Math.max(0, Math.min(H - measuredH, dragOriginY + dy));
		snapGuide = null;

		if (snapToCanvasCenter) {
			const midX = W / 2;
			const midY = H / 2;
			const cx = nx + curW / 2;
			const cy = ny + measuredH / 2;
			if (snappedAxisX || Math.abs(cx - midX) <= SNAP_IN_PX) {
				if (Math.abs(cx - midX) <= SNAP_OUT_PX) {
					nx = Math.max(0, Math.min(W - curW, midX - curW / 2));
					snappedAxisX = true;
					snapGuide = { ...(snapGuide ?? {}), x: midX };
				} else {
					snappedAxisX = false;
				}
			}
			if (snappedAxisY || Math.abs(cy - midY) <= SNAP_IN_PX) {
				if (Math.abs(cy - midY) <= SNAP_OUT_PX) {
					ny = Math.max(0, Math.min(H - measuredH, midY - measuredH / 2));
					snappedAxisY = true;
					snapGuide = { ...(snapGuide ?? {}), y: midY };
				} else {
					snappedAxisY = false;
				}
			}
		}

		onTextOverlaysChange?.(textOverlays.map((o) => (o.id === id ? { ...o, x: nx, y: ny } : o)));
	}

	function up() {
		if (holdTimer) {
			try {
				clearTimeout(holdTimer);
			} catch {
				/* ignore */
			}
			holdTimer = null;
		}
		downTarget = null;
		downPointerId = -1;
		activeId = null;
		dragId = null;
		overlayAction = null;
		actionOverlayId = null;
		resizeHandle = null;
		snapGuide = null;
		snappedAxisX = false;
		snappedAxisY = false;
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

	function exitOverlayEdit(id: string) {
		if (editingId !== id) return;
		editingId = null;
	}

	function finishEdit(id: string, e?: FocusEvent) {
		if (editingId !== id) return;
		const rt = e?.relatedTarget;
		if (rt instanceof Element) {
			if (rt.closest('[data-floating-toolbar], [data-slot="popover-content"]')) return;
		}
		requestAnimationFrame(() => {
			requestAnimationFrame(() => {
				if (editingId !== id) return;
				const ae = document.activeElement;
				if (ae instanceof Element && ae.closest('[data-floating-toolbar], [data-slot="popover-content"]'))
					return;
				editingId = null;
			});
		});
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
		{#if snapToCanvasCenter && snapGuide?.x != null}
			<div
				style="
					position: absolute;
					left: {snapGuide.x}px;
					top: 0;
					bottom: 0;
					width: 1px;
					background: rgba(34,211,238,0.65);
					box-shadow: 0 0 0 1px rgba(34,211,238,0.15);
					z-index: 34;
					pointer-events: none;
				"
			></div>
		{/if}
		{#if snapToCanvasCenter && snapGuide?.y != null}
			<div
				style="
					position: absolute;
					top: {snapGuide.y}px;
					left: 0;
					right: 0;
					height: 1px;
					background: rgba(34,211,238,0.65);
					box-shadow: 0 0 0 1px rgba(34,211,238,0.15);
					z-index: 34;
					pointer-events: none;
				"
			></div>
		{/if}
		{#each textOverlays as t (t.id)}
			{@const isEditing = editingId === t.id}
			{@const isSelected = !!selectedId && selectedId === t.id}
			{@const css = t.style ?? {}}
			{@const dims = overlayDims(t)}
			{@const fontPx = css.fontSize ?? 36}
			{@const weight = css.fontWeight ?? 600}
			{@const align = css.align ?? 'left'}
			{@const lh = css.lineHeight ?? 1.3}
			{@const tracking =
				css.letterSpacing != null ? `${css.letterSpacing}em` : '-0.015em'}
			{@const family = css.fontFamily
				? canvasFontFamilyStack(css.fontFamily)
				: canvasFontFamilyStack(FONT_TEMPLATE_DEFAULT)}
			{@const blockBg = String(css.bgColor ?? '').trim()}
			{@const hasBlockBg =
				!!blockBg && blockBg !== 'transparent' && blockBg !== 'none'}
			{@const textBoxWidth = hasBlockBg ? 'fit-content' : '100%'}
			{@const textBoxMargin =
				align === 'center'
					? 'margin-left: auto; margin-right: auto;'
					: align === 'right'
						? 'margin-left: auto; margin-right: 0;'
						: 'margin-left: 0; margin-right: auto;'}
			<div
				style="
					position: absolute;
					left: {t.x}px; top: {t.y}px;
					width: {dims.boxW}px;
					min-height: {Math.max(MIN_BOX_H, Number(t.h) || 0)}px;
					height: auto;
					padding: {PAD}px;
					box-sizing: border-box;
					overflow: visible;
					z-index: 60;
					touch-action: none;
					border-radius: 4px;
					{isSelected && !isEditing ? CANVAS_TEXT_OVERLAY_RING : ''}
					{!isSelected && !isEditing
						? 'box-shadow: inset 0 0 0 1px rgba(255,255,255,0.18);'
						: ''}
					{isEditing ? CANVAS_TEXT_OVERLAY_RING : ''}
					cursor: {interactive
						? overlayAction === 'resize' && actionOverlayId === t.id
							? 'default'
							: activeId === t.id && dragId === t.id
								? 'grabbing'
								: 'grab'
						: 'default'};
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
							padding: 0;
							margin: 0;
							box-sizing: border-box;
							background: transparent;
							color: {css.color ?? '#FFFFFF'};
							font-family: {family};
							font-size: {fontPx}px;
							font-weight: {weight};
							text-align: {align};
							line-height: {lh};
							letter-spacing: {tracking};
							{textShadowStyleAttr(css)}
							{textBgCss(css)}
							width: {textBoxWidth};
							max-width: 100%;
							{textBoxMargin}
						"
						onclick={(e) => e.stopPropagation()}
						role="presentation"
					>
						{#if parseHighlightMarkup}
							<HighlightEditor
								value={t.text}
								rows={1}
								minHeight="0px"
								showToolbar={false}
								hugGlyphs={false}
								defaultColor={highlightColor}
								fontFamily={css.fontFamily}
								fontSize={fontPx}
								liveLineHeight={css.lineHeight}
								lineHeight="inherit"
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
								onChange={(v) => {
									// HighlightEditor can leave a trailing newline on blur/commit; strip it so overlays
									// don't "grow" by one empty line after editing.
									const next = String(v ?? '').replace(/\n$/, '');
									onTextOverlaysChange?.(textOverlays.map((o) => (o.id === t.id ? { ...o, text: next } : o)));
								}}
								onBlur={(e) => finishEdit(t.id, e)}
							/>
						{:else}
							<textarea
								rows={2}
								aria-label="Text overlay editor"
								class="w-full resize-none border-0 bg-transparent p-0 outline-none"
								style="
									color: {css.color ?? '#FFFFFF'};
									font-family: {family};
									font-size: {fontPx}px;
									font-weight: {weight};
									text-align: {align};
									line-height: {lh};
									letter-spacing: {tracking};
									{textShadowStyleAttr(css)}
									{textBgCss(css)}
									padding: 0;
									margin: 0;
									field-sizing: content;
									min-height: {Math.max(fontPx * lh, 1)}px;
									overflow: hidden;
									white-space: pre-wrap;
									overflow-wrap: break-word;
									word-break: normal;
								"
								value={t.text}
								oninput={(e) => {
									const next = (e.target as HTMLTextAreaElement).value.replace(/\n$/, '');
									onTextOverlaysChange?.(textOverlays.map((o) => (o.id === t.id ? { ...o, text: next } : o)));
								}}
								onselect={(e) => {
									const ta = e.target as HTMLTextAreaElement;
									const a = ta.selectionStart;
									const b = ta.selectionEnd;
									const s = Math.min(a, b);
									const en = Math.max(a, b);
									if (en > s) onRangeSelect?.(s, en);
									else onRangeSelect?.(-1, -1);
								}}
								onkeyup={(e) => {
									const ta = e.target as HTMLTextAreaElement;
									const a = ta.selectionStart;
									const b = ta.selectionEnd;
									const s = Math.min(a, b);
									const en = Math.max(a, b);
									if (en > s) onRangeSelect?.(s, en);
									else onRangeSelect?.(-1, -1);
								}}
								onfocus={() => {
									const box = document.querySelector<HTMLElement>(`[data-text-overlay-id="${CSS.escape(t.id)}"]`);
									if (box) {
										try { box.dataset.textOverlayId = t.id; } catch {}
										onTextSelect?.('textOverlay', box);
									}
								}}
								onblur={(e) => finishEdit(t.id, e)}
							></textarea>
						{/if}
					</div>
				{:else}
					<!-- svelte-ignore a11y_no_static_element_interactions -->
					<div
						ondblclick={(e) => startEdit(e, t.id)}
						style="
							padding: 0;
							margin: 0;
							box-sizing: border-box;
							background: transparent;
							color: {css.color ?? '#FFFFFF'};
							font-family: {family};
							font-size: {fontPx}px;
							font-weight: {weight};
							text-align: {align};
							line-height: {lh};
							letter-spacing: {tracking};
							{textShadowStyleAttr(css)}
							{textBgCss(css)}
							width: {textBoxWidth};
							max-width: 100%;
							{textBoxMargin}
							overflow: visible;
							user-select: none;
							white-space: pre-wrap;
							overflow-wrap: break-word;
							word-break: normal;
						"
					>
						{#if parseHighlightMarkup}
							{@html segmentText(parseHighlightToSegments(t.text, highlightColor)).map((seg) => {
								if (!seg.highlighted) return seg.text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
								const esc = seg.text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
								if (seg.patternImage) {
									return wrapClippedFillHtml(
										patternStyleForUrl(seg.patternImage).replace(/\n/g,' ') + highlightWeightCss(seg.fontWeight),
										esc,
									);
								}
								if (seg.gradientFrom && seg.gradientTo) {
									return wrapClippedFillHtml(
										gradientTextFillCss(seg.gradientFrom, seg.gradientTo) + highlightWeightCss(seg.fontWeight),
										esc,
									);
								}
								return `<span style="${highlightForegroundCss(seg)}">${esc}</span>`;
							}).join('')}
						{:else}
							{t.text}
						{/if}
					</div>
				{/if}

				{#if interactive && isSelected && !isEditing}
					{#each RESIZE_HANDLES as handle (handle.id)}
						<div
							data-resize-handle={handle.id}
							style="
								position: absolute;
								left: calc({handle.fx * 100}% - {HANDLE / 2}px);
								top: calc({handle.fy * 100}% - {HANDLE / 2}px);
								width: {HANDLE}px;
								height: {HANDLE}px;
								border-radius: 2px;
								background: #fff;
								border: 1px solid rgba(0,0,0,0.4);
								box-shadow: 0 0 0 1px rgba(255,255,255,0.35);
								cursor: {handle.cursor};
								z-index: 3;
								touch-action: none;
							"
							onpointerdown={(e: PointerEvent) => resizeDown(e, t.id, handle.id)}
							role="presentation"
							aria-hidden="true"
						></div>
					{/each}
				{/if}
			</div>
		{/each}
	</div>
</div>

