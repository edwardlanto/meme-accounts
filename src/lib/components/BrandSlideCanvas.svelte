<script lang="ts">
	import { onMount, onDestroy } from 'svelte';

	// ── Shared types (also exported for the parent page) ──────────────────────
	export interface SlideObj {
		type: 'imgslot' | 'rect' | 'text' | 'line';
		id?: string;
		slot?: number;
		label?: string;
		x: number;
		y: number;
		w: number;
		h?: number;
		bg?: string;
		fill?: string;
		gradient?: {
			dir: 'top' | 'bottom' | 'left' | 'right';
			stops: Array<{ at: number; color: string }>;
		};
		text?: string;
		role?: string;
		font?: string;
		size?: number;
		weight?: string;
		color?: string;
		align?: 'left' | 'center' | 'right';
		lineHeight?: number;
		italic?: boolean;
		/** Set when the user uploads an image for this imgslot */
		dataUrl?: string;
	}

	export interface SlideData {
		bg: string;
		objects: SlideObj[];
	}

	export interface CarouselData {
		fonts: string[];
		slides: SlideData[];
	}

	interface Props {
		slide: SlideData;
		fonts?: string[];
		scale?: number;
		interactive?: boolean;
		onThumb?: (dataUrl: string) => void;
		/** Fired when user finishes editing a text object in-canvas */
		onTextEdit?: (id: string, text: string) => void;
		/** Fired when user uploads/replaces an image slot via canvas click */
		onImageFilled?: (slot: number, dataUrl: string) => void;
	}

	let {
		slide,
		fonts = [],
		scale = 1,
		interactive = true,
		onThumb,
		onTextEdit,
		onImageFilled,
	}: Props = $props();

	const W = 1080;
	const H = 1350;

	let canvasEl: HTMLCanvasElement;
	let fab: any = null;
	let fc: any = null;
	/** True once the first renderSlide() has completed */
	let rendered = false;

	onMount(async () => {
		fab = await import('fabric');
		await loadFonts(fonts);

		fc = new fab.Canvas(canvasEl, {
			width: W,
			height: H,
			selection: interactive,
			preserveObjectStacking: true,
			renderOnAddRemove: false,
		});

		if (interactive) {
			// Sync text back to parent when user finishes in-canvas editing
			fc.on('text:editing:exited', (e: any) => {
				const o = e.target;
				if (o?.data?.id) onTextEdit?.(o.data.id, o.text ?? '');
			});
			// Click on an imgslot placeholder → open file picker
			fc.on('mouse:down', (e: any) => {
				const o = e.target;
				if (o?.data?.type === 'imgslot') openFilePicker(o.data);
			});
		}

		await renderSlide();
		rendered = true;
	});

	// Re-render when the slide prop reference changes (i.e. when parent switches
	// selectedSlide). Mutating a property *inside* the slide object (e.g. dataUrl)
	// does NOT change its reference, so the canvas won't flicker on image fills.
	$effect(() => {
		void slide;
		if (rendered && fc) {
			void loadFonts(fonts).then(() => renderSlide());
		}
	});

	// ── Font loading ──────────────────────────────────────────────────────────
	async function loadFonts(names: string[]) {
		const toLoad = (names ?? []).filter(Boolean);
		if (!toLoad.length) return;
		const q = toLoad.map((f) => `family=${encodeURIComponent(f)}:wght@400;700;900`).join('&');
		const url = `https://fonts.googleapis.com/css2?${q}&display=swap`;
		const key = toLoad.join(',');
		if (!document.querySelector(`link[data-gf="${key}"]`)) {
			const link = document.createElement('link');
			link.rel = 'stylesheet';
			link.href = url;
			link.dataset.gf = key;
			document.head.appendChild(link);
		}
		try {
			await document.fonts.ready;
		} catch {}
		await new Promise((r) => setTimeout(r, 350));
	}

	// ── Render a full slide ───────────────────────────────────────────────────
	async function renderSlide() {
		if (!fc || !fab) return;
		fc.clear();
		fc.backgroundColor = slide?.bg || '#111111';

		const objs = slide?.objects ?? [];
		for (let i = 0; i < objs.length; i++) {
			const o = objs[i];
			if (o.type === 'imgslot') await addImgSlot(o, i);
			else if (o.type === 'rect') addRect(o);
			else if (o.type === 'text') addText(o, i);
			else if (o.type === 'line') addLine(o);
		}

		fc.renderAll();

		// Emit a low-res JPEG thumbnail after fonts have painted
		setTimeout(() => {
			try {
				if (fc) onThumb?.(fc.toDataURL({ format: 'jpeg', quality: 0.72, multiplier: 0.3 }));
			} catch {}
		}, 500);
	}

	// ── Object builders ───────────────────────────────────────────────────────
	async function addImgSlot(o: SlideObj, i: number) {
		const slotH = o.h ?? 675;
		const slot = o.slot ?? i;

		// If the user already uploaded an image, render it directly
		if (o.dataUrl) {
			await _renderImage(o.dataUrl, o.x, o.y, o.w, slotH, slot);
			return;
		}

		// Placeholder rect (clickable)
		fc.add(
			new fab.Rect({
				left: o.x,
				top: o.y,
				width: o.w,
				height: slotH,
				fill: o.bg ?? '#1a1a1a',
				selectable: interactive,
				evented: interactive,
				hoverCursor: interactive ? 'pointer' : 'default',
				lockMovementX: true,
				lockMovementY: true,
				lockRotation: true,
				lockScalingX: true,
				lockScalingY: true,
				hasControls: false,
				hasBorders: false,
				data: { type: 'imgslot', slot, label: o.label, x: o.x, y: o.y, w: o.w, h: slotH },
			}),
		);

		// Placeholder label
		fc.add(
			new fab.IText(`▣  ${o.label ?? `Photo ${slot + 1}`}`, {
				left: o.x + o.w / 2,
				top: o.y + slotH / 2,
				originX: 'center',
				originY: 'center',
				fontSize: 24,
				fontFamily: 'sans-serif',
				fill: 'rgba(255,255,255,0.18)',
				letterSpacing: 4,
				selectable: false,
				evented: false,
				data: { type: 'imgslot-label', slot },
			}),
		);
	}

	function addRect(o: SlideObj) {
		fc.add(
			new fab.Rect({
				left: o.x,
				top: o.y,
				width: o.w,
				height: o.h ?? H,
				fill: o.gradient ? buildGrad(o) : (o.fill ?? 'transparent'),
				selectable: false,
				evented: false,
			}),
		);
	}

	function addText(o: SlideObj, i: number) {
		const isWrapping = ['headline', 'subhead', 'body', 'list', 'tip'].includes(o.role ?? '');
		const Cls = isWrapping ? fab.Textbox : fab.IText;
		const id = o.id ?? `text-${i}`;
		fc.add(
			new Cls(o.text ?? '', {
				left: o.x,
				top: o.y,
				width: o.w ?? 400,
				fontSize: o.size ?? 48,
				fontFamily: o.font ?? 'sans-serif',
				fontWeight: o.weight ?? '400',
				fontStyle: o.italic ? 'italic' : 'normal',
				fill: o.color ?? '#FFFFFF',
				textAlign: o.align ?? 'left',
				lineHeight: o.lineHeight ?? 1.16,
				selectable: interactive,
				editable: interactive,
				hasControls: false,
				hasBorders: interactive,
				splitByGrapheme: false,
				data: { type: 'text', role: o.role, id },
			}),
		);
	}

	function addLine(o: SlideObj) {
		fc.add(
			new fab.Rect({
				left: o.x,
				top: o.y,
				width: o.w,
				height: o.h ?? 4,
				fill: o.fill ?? '#FFFFFF',
				selectable: false,
				evented: false,
			}),
		);
	}

	function buildGrad(o: SlideObj) {
		const g = o.gradient!;
		const oh = o.h ?? H;
		const ow = o.w ?? W;
		const coords: Record<string, number> =
			g.dir === 'bottom'
				? { x1: 0, y1: 0, x2: 0, y2: oh }
				: g.dir === 'top'
					? { x1: 0, y1: oh, x2: 0, y2: 0 }
					: g.dir === 'right'
						? { x1: 0, y1: 0, x2: ow, y2: 0 }
						: { x1: ow, y1: 0, x2: 0, y2: 0 };
		return new fab.Gradient({
			type: 'linear',
			gradientUnits: 'pixels',
			coords,
			colorStops: g.stops.map((s: { at: number; color: string }) => ({
				offset: s.at,
				color: s.color,
			})),
		});
	}

	// ── Image helpers ─────────────────────────────────────────────────────────
	async function _renderImage(
		dataUrl: string,
		x: number,
		y: number,
		w: number,
		h: number,
		slot: number,
	) {
		const img = await fab.FabricImage.fromURL(dataUrl);
		const sc = Math.max(w / img.width!, h / img.height!);
		const clip = new fab.Rect({ left: x, top: y, width: w, height: h, absolutePositioned: true });
		img.set({
			left: x,
			top: y,
			scaleX: sc,
			scaleY: sc,
			clipPath: clip,
			selectable: false,
			evented: false,
			data: { type: 'imgslot-filled', slot },
		});
		fc.add(img);
	}

	function openFilePicker(slotData: {
		slot: number;
		x: number;
		y: number;
		w: number;
		h: number;
		label: string;
	}) {
		const input = document.createElement('input');
		input.type = 'file';
		input.accept = 'image/*';
		input.onchange = async () => {
			const file = input.files?.[0];
			if (!file) return;
			const reader = new FileReader();
			reader.onload = async () => {
				const dataUrl = reader.result as string;
				await fillImageSlot(
					slotData.slot,
					dataUrl,
					slotData.x,
					slotData.y,
					slotData.w,
					slotData.h,
				);
				onImageFilled?.(slotData.slot, dataUrl);
			};
			reader.readAsDataURL(file);
		};
		input.click();
	}

	// ── Public methods ────────────────────────────────────────────────────────

	/** Replace an image slot with a user-provided dataUrl */
	export async function fillImageSlot(
		slot: number,
		dataUrl: string,
		x?: number,
		y?: number,
		w?: number,
		h?: number,
	) {
		if (!fc || !fab) return;
		// Resolve coords from the existing slot rect if not provided
		if (x === undefined) {
			const ex = fc
				.getObjects()
				.find((o: any) => o.data?.type === 'imgslot' && o.data?.slot === slot);
			if (ex) {
				x = ex.left;
				y = ex.top;
				w = ex.width;
				h = ex.height;
			}
		}
		if (x === undefined || y === undefined || w === undefined || h === undefined) return;

		// Remove all placeholders/previous image for this slot
		const toRm = fc
			.getObjects()
			.filter(
				(o: any) =>
					(o.data?.type === 'imgslot' && o.data?.slot === slot) ||
					(o.data?.type === 'imgslot-label' && o.data?.slot === slot) ||
					(o.data?.type === 'imgslot-filled' && o.data?.slot === slot),
			);
		toRm.forEach((o: any) => fc.remove(o));

		await _renderImage(dataUrl, x, y, w, h ?? 675, slot);
		fc.renderAll();

		setTimeout(() => {
			try {
				if (fc) onThumb?.(fc.toDataURL({ format: 'jpeg', quality: 0.72, multiplier: 0.3 }));
			} catch {}
		}, 200);
	}

	/** Update a single text object in the canvas without full re-render */
	export function updateText(id: string, text: string) {
		if (!fc) return;
		const obj = fc.getObjects().find((o: any) => o.data?.id === id);
		if (obj) {
			obj.set('text', text);
			fc.renderAll();
		}
	}

	/** Export current canvas as a full-resolution PNG data URL */
	export function exportPng(): string {
		return fc?.toDataURL({ format: 'png', multiplier: 1 }) ?? '';
	}

	/** Force a full re-render (e.g. after loading a saved template) */
	export async function forceRender() {
		await loadFonts(fonts);
		await renderSlide();
	}

	onDestroy(() => {
		fc?.dispose();
		fc = null;
	});
</script>

<canvas
	bind:this={canvasEl}
	style="width: {W * scale}px; height: {H * scale}px; display: block;"
></canvas>
