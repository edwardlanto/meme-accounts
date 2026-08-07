/**
 * Measure a selection box that hugs glyph ink instead of the font’s tall em-box.
 * Used for canvas text focus rings (News headlines, etc.) where `text-box-trim`
 * alone still leaves large top/bottom gaps at display sizes.
 */

export type InkBox = { x: number; y: number; w: number; h: number };

/** Sample ink height for the element’s computed font (cap-ish for all-caps display). */
function measureInkHeight(el: HTMLElement): number {
	const cs = getComputedStyle(el);
	const fontSize = parseFloat(cs.fontSize) || 16;
	try {
		const ctx = document.createElement('canvas').getContext('2d');
		if (ctx) {
			ctx.font = cs.font;
			const m = ctx.measureText('ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789');
			const ascent = m.actualBoundingBoxAscent;
			const descent = m.actualBoundingBoxDescent;
			if (
				typeof ascent === 'number' &&
				typeof descent === 'number' &&
				Number.isFinite(ascent) &&
				Number.isFinite(descent) &&
				ascent + descent > 0
			) {
				return ascent + descent;
			}
		}
	} catch {
		/* ignore */
	}
	// Display / all-caps fonts typically ink ~70–78% of the em square.
	return fontSize * 0.74;
}

/**
 * Union of line boxes, each shrunk to approximate ink height, in `relativeTo`’s
 * local CSS pixels (`scale` undoes an ancestor `transform: scale()`).
 */
export function measureTightTextBox(
	el: HTMLElement,
	relativeTo: HTMLElement,
	scale = 1,
): InkBox | null {
	const range = document.createRange();
	range.selectNodeContents(el);
	const lineRects = [...range.getClientRects()].filter((r) => r.width > 0 && r.height > 0);
	if (!lineRects.length) {
		const fallback = el.getBoundingClientRect();
		if (fallback.width <= 0 || fallback.height <= 0) return null;
		lineRects.push(fallback);
	}

	const inkHeight = measureInkHeight(el);
	let top = Infinity;
	let left = Infinity;
	let bottom = -Infinity;
	let right = -Infinity;

	for (const r of lineRects) {
		const extra = Math.max(0, r.height - inkHeight);
		// More trim on top — Latin line boxes leave more space above caps than below baseline.
		const topPad = extra * 0.64;
		const botPad = extra * 0.36;
		top = Math.min(top, r.top + topPad);
		left = Math.min(left, r.left);
		bottom = Math.max(bottom, r.bottom - botPad);
		right = Math.max(right, r.right);
	}

	if (!Number.isFinite(top) || bottom <= top || right <= left) return null;

	const origin = relativeTo.getBoundingClientRect();
	const s = scale > 0 ? scale : 1;
	return {
		x: (left - origin.left) / s,
		y: (top - origin.top) / s,
		w: (right - left) / s,
		h: (bottom - top) / s,
	};
}

/** CSS for an absolutely positioned ink ring (parent must be `position: relative`). */
export function inkRingStyle(box: InkBox | null): string {
	if (!box) return 'display: none;';
	return [
		'position: absolute;',
		`left: ${box.x}px;`,
		`top: ${box.y}px;`,
		`width: ${box.w}px;`,
		`height: ${box.h}px;`,
		'box-sizing: border-box;',
		'pointer-events: none;',
		'outline: 2px solid rgba(139,92,246,0.75);',
		'outline-offset: 0;',
		'border-radius: 2px;',
		'z-index: 5;',
	].join(' ');
}
