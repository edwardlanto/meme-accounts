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
		highlightColor?: string;
		onTextOverlaysChange?: (next: TextOverlay[]) => void;
		onTextSelect?: (kind: 'textOverlay', anchor: HTMLElement) => void;
	}

	let {
		w,
		h,
		scale = 1,
		interactive = true,
		textOverlays = [],
		highlightColor = '#F5A623',
		onTextOverlaysChange,
		onTextSelect,
	}: Props = $props();

	const W = $derived(Math.max(1, Number(w) || 1080));
	const H = $derived(Math.max(1, Number(h) || 1350));

	let activeId = $state<string | null>(null);
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
			try { el?.focus(); } catch {}
		});
	});

	function down(e: PointerEvent, id: string) {
		if (!interactive) return;
		try { (e.currentTarget as HTMLElement).dataset.textOverlayId = id; } catch {}
		onTextSelect?.('textOverlay', e.currentTarget as HTMLElement);
		activeId = id;
		lastMx = e.clientX;
		lastMy = e.clientY;
		(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
		e.stopPropagation();
		e.preventDefault();
	}

	function move(e: PointerEvent, id: string) {
		if (activeId !== id) return;
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
		activeId = null;
	}

	function del(e: MouseEvent, id: string) {
		e.stopPropagation();
		onTextOverlaysChange?.(textOverlays.filter((o) => o.id !== id));
		if (editingId === id) editingId = null;
	}

	function startEdit(e: MouseEvent, id: string) {
		if (!interactive) return;
		e.stopPropagation();
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
		width: {W * scale}px;
		height: {H * scale}px;
		pointer-events: {interactive ? 'auto' : 'none'};
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
		"
	>
		{#each textOverlays as t (t.id)}
			{@const isEditing = editingId === t.id}
			{@const css = t.style ?? {}}
			<div
				style="
					position: absolute;
					left: {t.x}px; top: {t.y}px;
					width: fit-content;
					height: fit-content;
					max-width: 820px;
					z-index: 60;
					touch-action: none;
					cursor: {interactive ? (activeId === t.id ? 'grabbing' : 'grab') : 'default'};
				"
				data-text-selectable="textOverlay"
				data-text-overlay-id={t.id}
				onpointerdown={(e) => down(e, t.id)}
				onpointermove={(e) => move(e, t.id)}
				onpointerup={up}
				onpointercancel={up}
				role="presentation"
			>
				{#if isEditing}
					<div
						style="
							position: absolute; inset: 0;
							padding: 8px;
							box-sizing: border-box;
							border-radius: 10px;
							background: rgba(0,0,0,0.14);
							border: 1px solid rgba(255,255,255,0.25);
						"
						onclick={(e) => e.stopPropagation()}
						role="presentation"
					>
						<HighlightEditor
							value={t.text}
							rows={3}
							showToolbar={false}
							defaultColor={highlightColor}
							ariaLabel="Text overlay editor"
							onChange={(v) => onTextOverlaysChange?.(textOverlays.map(o => o.id === t.id ? { ...o, text: v } : o))}
							onBlur={() => finishEdit(t.id)}
						/>
					</div>
				{:else}
					<!-- svelte-ignore a11y_no_static_element_interactions -->
					<div
						ondblclick={(e) => startEdit(e, t.id)}
						style="
							position: absolute; inset: 0;
							padding: 8px;
							box-sizing: border-box;
							border-radius: 10px;
							background: rgba(0,0,0,0.10);
							border: 1px dashed rgba(255,255,255,0.25);
							color: {css.color ?? '#FFFFFF'};
							font-family: {css.fontFamily ? `'${css.fontFamily}', system-ui, -apple-system, sans-serif` : `'DM Sans', system-ui, -apple-system, sans-serif`};
							font-size: {css.fontSize ?? 42}px;
							font-weight: {css.fontWeight ?? 700};
							text-align: {css.align ?? 'left'};
							line-height: {css.lineHeight ?? 1.15};
							letter-spacing: {css.letterSpacing != null ? `${css.letterSpacing}em` : '0'};
							overflow: hidden;
							user-select: none;
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

