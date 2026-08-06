<script lang="ts">
	import type { Overlay } from '$lib/types';
	import { removeBackground } from '$lib/backgroundRemoval';
	import { Popover, PopoverContent, PopoverTrigger } from '$lib/components/ui/popover';
	import { Button } from '$lib/components/ui/button';
	import ClassicLoader from '$lib/components/ClassicLoader.svelte';
	import { Pencil, Trash2, Eraser, Minus, Plus, X } from 'lucide-svelte';

	interface Props {
		overlay: Overlay;
		overlays: Overlay[];
		w: number;
		h: number;
		scale?: number;
		interactive?: boolean;
		onOverlaysChange?: (next: Overlay[]) => void;
		/** Resolve stored media (`r2:…`) to a displayable URL */
		resolveSrc?: (src: string) => string;
	}

	let {
		overlay,
		overlays,
		w,
		h,
		scale = 1,
		interactive = true,
		onOverlaysChange,
		resolveSrc,
	}: Props = $props();

	const W = $derived(Math.max(1, Number(w) || 1080));
	const H = $derived(Math.max(1, Number(h) || 1350));

	const displaySrc = $derived.by(() => {
		const raw = String(overlay.src ?? '').trim();
		if (!raw) return '';
		return resolveSrc?.(raw) || raw;
	});

	let popoverOpen = $state(false);
	let active = $state(false);
	let overlayAction = $state<'drag' | 'resize' | null>(null);
	let hovered = $state(false);
	let didDrag = $state(false);
	let ovLastMx = 0;
	let ovLastMy = 0;
	let removingBg = $state(false);
	let fileEl = $state<HTMLInputElement | null>(null);
	let colorEl = $state<HTMLInputElement | null>(null);
	let imgBroken = $state(false);

	const showChrome = $derived(popoverOpen || active || hovered);

	$effect(() => {
		displaySrc;
		imgBroken = false;
	});

	function apply(next: Overlay[]) {
		onOverlaysChange?.(next);
	}

	function patch(p: Partial<Overlay>) {
		apply(overlays.map((o) => (o.id === overlay.id ? { ...o, ...p } : o)));
	}

	function overlayDragDown(e: PointerEvent) {
		if (!interactive) return;
		if (e.button !== 0 && e.pointerType === 'mouse') return;
		active = true;
		didDrag = false;
		overlayAction = 'drag';
		ovLastMx = e.clientX;
		ovLastMy = e.clientY;
		(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
		e.stopPropagation();
		e.preventDefault();
	}

	function overlayResizeDown(e: PointerEvent) {
		if (!interactive) return;
		active = true;
		didDrag = false;
		overlayAction = 'resize';
		ovLastMx = e.clientX;
		ovLastMy = e.clientY;
		(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
		e.stopPropagation();
		e.preventDefault();
	}

	function overlayPointerMove(e: PointerEvent) {
		if (!active) return;
		const dx = (e.clientX - ovLastMx) / scale;
		const dy = (e.clientY - ovLastMy) / scale;
		if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) didDrag = true;
		ovLastMx = e.clientX;
		ovLastMy = e.clientY;

		const ov = overlays.find((o) => o.id === overlay.id);
		if (!ov) return;

		const pad = Math.max(0, Math.min(PADDING_MAX, Number(ov.padding) || 0));

		if (overlayAction === 'drag') {
			// Keep the padded outer box inside the canvas; x/y stay the image origin.
			const nx = Math.max(pad, Math.min(W - ov.w - pad, ov.x + dx));
			const ny = Math.max(pad, Math.min(H - ov.h - pad, ov.y + dy));
			apply(overlays.map((o) => (o.id === overlay.id ? { ...o, x: nx, y: ny } : o)));
		} else if (overlayAction === 'resize') {
			const aspect = ov.w / Math.max(1, ov.h);
			const newW = Math.max(60, Math.min(W - ov.x - pad, ov.w + dx));
			const newH = newW / aspect;
			apply(overlays.map((o) => (o.id === overlay.id ? { ...o, w: newW, h: newH } : o)));
		}
	}

	function overlayPointerUp() {
		active = false;
		overlayAction = null;
		// Keep popover closed after a drag so it doesn’t jump open mid-move
		if (didDrag) popoverOpen = false;
	}

	async function onRemoveBg() {
		if (removingBg) return;
		removingBg = true;
		try {
			const ov = overlays.find((o) => o.id === overlay.id);
			if (!ov?.src) return;
			const src = resolveSrc?.(ov.src) || ov.src;
			if (!src || src.startsWith('r2:')) {
				throw new Error('Image is still loading — try again in a moment');
			}
			const out = await removeBackground(src);
			patch({ src: out });
		} catch (e: unknown) {
			const msg = e instanceof Error ? e.message : 'Background removal failed';
			alert(msg);
		} finally {
			removingBg = false;
		}
	}

	function onDelete(e: MouseEvent) {
		e.stopPropagation();
		apply(overlays.filter((o) => o.id !== overlay.id));
		popoverOpen = false;
	}

	function openEdit() {
		popoverOpen = false;
		fileEl?.click();
	}

	function onStickerFile(e: Event) {
		const inp = e.target as HTMLInputElement;
		const f = inp.files?.[0];
		inp.value = '';
		if (!f?.type.startsWith('image/')) return;
		const reader = new FileReader();
		reader.onload = () => patch({ src: reader.result as string });
		reader.readAsDataURL(f);
	}

	const PADDING_MAX = 240;
	const PADDING_STEP = 4;

	const paddingPx = $derived.by(() => {
		const raw = Number(overlay.padding);
		const p = Number.isFinite(raw) ? Math.max(0, raw) : 0;
		return Math.min(p, PADDING_MAX);
	});

	/** Outer box including background padding (image stays `overlay.w` × `overlay.h`). */
	const outerW = $derived(overlay.w + paddingPx * 2);
	const outerH = $derived(overlay.h + paddingPx * 2);
	const outerX = $derived(overlay.x - paddingPx);
	const outerY = $derived(overlay.y - paddingPx);

	const radiusCap = $derived(Math.min(outerW, outerH) / 2);
	const borderRadiusPx = $derived.by(() => {
		const raw = Number(overlay.borderRadius);
		const r = Number.isFinite(raw) ? Math.max(0, raw) : 0;
		return Math.min(r, radiusCap);
	});

	const bgColor = $derived.by(() => {
		const raw = String(overlay.bgColor ?? '').trim();
		if (!raw || raw === 'transparent' || raw === 'none') return '';
		return raw;
	});
	const hasBgColor = $derived(!!bgColor);
	const fillBackground = $derived.by(() => {
		if (hasBgColor) return bgColor;
		if (imgBroken || !displaySrc) return 'rgba(0,0,0,0.25)';
		return 'transparent';
	});

	function bumpBorderRadius(delta: number) {
		const ov = overlays.find((o) => o.id === overlay.id);
		if (!ov) return;
		const pad = Math.max(0, Math.min(PADDING_MAX, Number(ov.padding) || 0));
		const cap = Math.min(ov.w + pad * 2, ov.h + pad * 2) / 2;
		const cur = Math.max(0, Math.min(cap, Number(ov.borderRadius) || 0));
		patch({ borderRadius: Math.max(0, Math.min(cap, cur + delta)) });
	}

	function bumpPadding(delta: number) {
		const ov = overlays.find((o) => o.id === overlay.id);
		if (!ov) return;
		const cur = Math.max(0, Math.min(PADDING_MAX, Number(ov.padding) || 0));
		const next = Math.max(0, Math.min(PADDING_MAX, cur + delta));
		if (next === cur) return;
		// Keep the image centered visually while the background grows/shrinks outward.
		patch({ padding: next });
	}

	function openBgColorPicker() {
		colorEl?.click();
	}

	function clearBgColor() {
		patch({ bgColor: undefined });
	}

	function onNativeColorInput(e: Event) {
		const v = (e.target as HTMLInputElement).value;
		if (v) patch({ bgColor: v });
	}
</script>

<input
	bind:this={fileEl}
	type="file"
	accept="image/*"
	class="hidden"
	aria-hidden="true"
	onchange={onStickerFile}
/>
<input
	bind:this={colorEl}
	type="color"
	value={hasBgColor ? bgColor : '#FFFFFF'}
	class="pointer-events-none fixed h-px w-px opacity-0"
	aria-hidden="true"
	tabindex={-1}
	oninput={onNativeColorInput}
/>

{#snippet stickerTrigger({ props }: { props: Record<string, unknown> })}
	{@const triggerProps = props as Record<string, unknown> & {
		onpointerdown?: (e: PointerEvent) => void;
		onclick?: (e: MouseEvent) => void;
	}
	}
	<div
		{...triggerProps}
		style="
			position: absolute;
			left: {outerX}px; top: {outerY}px;
			width: {outerW}px; height: {outerH}px;
			z-index: {active || hovered || popoverOpen ? 90 : 55};
			pointer-events: auto;
			cursor: {active && overlayAction === 'drag' ? 'grabbing' : interactive ? 'grab' : 'default'};
			touch-action: none;
			overflow: visible;
			user-select: none;
		"
		onpointerdown={(e) => {
			overlayDragDown(e);
			// Don’t let the popover trigger steal the gesture while dragging
		}}
		onpointermove={overlayPointerMove}
		onpointerup={overlayPointerUp}
		onpointercancel={overlayPointerUp}
		onclick={(e) => {
			if (didDrag) {
				e.preventDefault();
				e.stopPropagation();
				didDrag = false;
				return;
			}
			triggerProps.onclick?.(e);
		}}
		onmouseenter={() => (hovered = true)}
		onmouseleave={() => {
			if (!active) hovered = false;
		}}
		role="presentation"
	>
		<div
			style="
				position: relative;
				width: 100%; height: 100%;
				overflow: hidden;
				box-sizing: border-box;
				border-radius: {borderRadiusPx}px;
				background: {fillBackground};
				padding: {paddingPx}px;
			"
		>
			{#if displaySrc && !imgBroken}
				<img
					src={displaySrc}
					alt=""
					draggable="false"
					style="
						width: 100%; height: 100%;
						object-fit: contain;
						pointer-events: none;
						display: block;
						-webkit-user-drag: none;
					"
					onload={() => (imgBroken = false)}
					onerror={() => (imgBroken = true)}
				/>
			{:else}
				<div
					style="
						width: 100%; height: 100%;
						display: flex; align-items: center; justify-content: center;
						color: rgba(255,255,255,0.55); font-size: 12px; font-weight: 600;
						pointer-events: none;
					"
				>
					{displaySrc ? 'Image failed' : 'Loading…'}
				</div>
			{/if}
			{#if removingBg}
				<div
					class="bg-background/55 absolute inset-0 flex items-center justify-center backdrop-blur-[1px]"
					role="status"
					aria-label="Removing background"
				>
					<ClassicLoader size="lg" />
				</div>
			{/if}
		</div>

		{#if interactive && showChrome}
			<div
				style="
					position: absolute; bottom: -10px; right: -10px;
					width: 22px; height: 22px; border-radius: 4px;
					background: rgba(0,0,0,0.85); border: 2px solid rgba(255,255,255,0.5);
					cursor: nwse-resize; z-index: 1; touch-action: none;
					display: flex; align-items: center; justify-content: center;
					font-size: 11px; color: rgba(255,255,255,0.8);
				"
				onpointerdown={overlayResizeDown}
				onpointermove={overlayPointerMove}
				onpointerup={overlayPointerUp}
				onpointercancel={overlayPointerUp}
				role="presentation"
			>
				⤡
			</div>

			<div
				style="
					position: absolute; inset: -2px;
					border: 2px dashed rgba(255,255,255,0.5);
					border-radius: {Math.max(0, borderRadiusPx - 2)}px; pointer-events: none;
				"
			></div>
		{/if}
	</div>
{/snippet}

<Popover bind:open={popoverOpen}>
	<PopoverTrigger
		openOnHover={!!interactive && !active}
		openDelay={120}
		closeDelay={280}
		child={stickerTrigger}
	/>
	{#if interactive}
		<PopoverContent
			side="top"
			sideOffset={10}
			align="center"
			trapFocus={false}
			class="border-border bg-popover/95 text-foreground z-[60] !flex !w-max max-w-[calc(100vw-2rem)] !flex-row flex-nowrap items-center gap-1.5 overflow-x-auto rounded-full border p-2 shadow-lg ring-1 ring-border/40 backdrop-blur-md duration-100 data-[side=top]:slide-in-from-bottom-2 data-[state=closed]:animate-out data-[state=open]:animate-in data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 !gap-1.5 !p-2 [&_svg]:shrink-0 [&_svg]:text-foreground"
		>
			<Button
				variant="secondary"
				size="sm"
				class="h-11 shrink-0 rounded-full px-3 font-semibold"
				disabled={removingBg}
				onclick={() => void onRemoveBg()}
				title="Remove image background (AI)"
				aria-label="Remove background"
			>
				{#if removingBg}
					<ClassicLoader size="sm" />
				{:else}
					<Eraser size={18} strokeWidth={2} />
				{/if}
				<span class="ml-1.5 hidden sm:inline">Remove BG</span>
			</Button>
			<Button
				variant="ghost"
				size="icon"
				class="h-11 w-11 shrink-0 rounded-full"
				onclick={openEdit}
				title="Replace image"
				aria-label="Edit image"
			>
				<Pencil size={20} class="text-foreground" strokeWidth={2} />
			</Button>
			<div
				class="bg-muted/40 flex h-11 shrink-0 flex-row items-center gap-1 rounded-full px-2"
				role="group"
				aria-label="Corner radius in pixels"
				title="Corner radius"
			>
				<Button
					variant="ghost"
					size="icon"
					class="h-8 w-8 shrink-0 rounded-full"
					type="button"
					disabled={borderRadiusPx <= 0}
					onclick={() => bumpBorderRadius(-6)}
					title="Less rounded corners"
					aria-label="Decrease corner radius"
				>
					<Minus size={16} class="text-foreground" strokeWidth={2} />
				</Button>
				<span class="min-w-[1.75rem] text-center text-xs font-bold tabular-nums text-foreground"
					>{Math.round(borderRadiusPx)}</span
				>
				<Button
					variant="ghost"
					size="icon"
					class="h-8 w-8 shrink-0 rounded-full"
					type="button"
					disabled={borderRadiusPx >= radiusCap - 0.5}
					onclick={() => bumpBorderRadius(6)}
					title="More rounded corners"
					aria-label="Increase corner radius"
				>
					<Plus size={16} class="text-foreground" strokeWidth={2} />
				</Button>
			</div>
			<div class="bg-muted/40 flex h-11 shrink-0 flex-row items-center gap-0.5 rounded-full px-1">
				<Button
					variant="ghost"
					size="icon"
					class="h-11 w-11 shrink-0 rounded-full"
					type="button"
					onclick={openBgColorPicker}
					title="Background color"
					aria-label="Background color"
				>
					<span
						class="border-foreground/25 ring-foreground/15 box-border block h-[22px] w-[22px] rounded-md border-2 shadow-sm ring-1"
						style="background: {hasBgColor
							? bgColor
							: 'linear-gradient(135deg, transparent 0 42%, rgba(255,59,92,0.95) 42% 52%, transparent 52% 100%), linear-gradient(135deg, rgba(0,0,0,0.10), rgba(0,0,0,0.02))'};"
					></span>
				</Button>
				{#if hasBgColor}
					<Button
						variant="ghost"
						size="icon"
						class="h-8 w-8 shrink-0 rounded-full"
						type="button"
						onclick={clearBgColor}
						title="Clear background color"
						aria-label="Clear background color"
					>
						<X size={14} class="text-foreground" strokeWidth={2} />
					</Button>
				{/if}
			</div>
			<div
				class="bg-muted/40 flex h-11 shrink-0 flex-row items-center gap-1 rounded-full px-2"
				role="group"
				aria-label="Background padding in pixels"
				title="Background padding"
			>
				<Button
					variant="ghost"
					size="icon"
					class="h-8 w-8 shrink-0 rounded-full"
					type="button"
					disabled={paddingPx <= 0}
					onclick={() => bumpPadding(-PADDING_STEP)}
					title="Less padding"
					aria-label="Decrease background padding"
				>
					<Minus size={16} class="text-foreground" strokeWidth={2} />
				</Button>
				<span class="min-w-[1.75rem] text-center text-xs font-bold tabular-nums text-foreground"
					>{Math.round(paddingPx)}</span
				>
				<Button
					variant="ghost"
					size="icon"
					class="h-8 w-8 shrink-0 rounded-full"
					type="button"
					disabled={paddingPx >= PADDING_MAX}
					onclick={() => bumpPadding(PADDING_STEP)}
					title="More padding"
					aria-label="Increase background padding"
				>
					<Plus size={16} class="text-foreground" strokeWidth={2} />
				</Button>
			</div>
			<Button
				variant="ghost"
				size="icon"
				class="text-destructive hover:text-destructive h-11 w-11 shrink-0 rounded-full"
				onclick={onDelete}
				title="Delete overlay"
				aria-label="Delete overlay"
			>
				<Trash2 size={20} class="text-destructive" strokeWidth={2} />
			</Button>
		</PopoverContent>
	{/if}
</Popover>
