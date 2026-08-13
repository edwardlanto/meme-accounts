/**
 * Shared canvas text selection / edit chrome.
 * Every template (News + CanvasMarkupTextBlock) should use these so rings and
 * glyph trimming behave the same.
 */

/** Violet focus ring — outline (not box-shadow) so layout/padding does not change. */
export const CANVAS_TEXT_FOCUS_RING =
	'outline: 2px solid rgba(139,92,246,0.75); outline-offset: 0; border-radius: 2px;';

/**
 * Trim half-leading so selection rings hug caps, but keep the full under-edge
 * (`text`) so descenders (p/g/y/q/j) are never clipped — critical for body copy.
 */
export const CANVAS_TEXT_BOX_TRIM =
	'text-box: trim-both cap text; text-box-trim: trim-both; text-box-edge: cap text;';

/**
 * Free text overlays (Canva-style): breathing room between glyphs and the
 * selection frame. Applied as real padding so handles sit on the padded box.
 */
export const CANVAS_TEXT_OVERLAY_PAD_PX = 14;

/** Selection ring for free text overlays — slightly softer radius than ink-hug headlines. */
export const CANVAS_TEXT_OVERLAY_RING =
	'outline: 2px solid rgba(139,92,246,0.85); outline-offset: 0; border-radius: 4px;';
