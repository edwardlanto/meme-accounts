/** Draggable image overlay placed on top of a slide */
export interface Overlay {
	id: string;
	src: string;  // data URL
	x: number;    // left edge in template px (0–1080)
	y: number;    // top edge in template px (0–1350)
	w: number;    // width in template px
	h: number;    // height in template px
}
