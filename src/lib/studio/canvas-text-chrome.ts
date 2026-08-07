/**
 * Shared canvas text selection / edit chrome.
 * Every template (News + CanvasMarkupTextBlock) should use these so rings and
 * glyph trimming behave the same.
 */

/** Violet focus ring — outline (not box-shadow) so layout/padding does not change. */
export const CANVAS_TEXT_FOCUS_RING =
	'outline: 2px solid rgba(139,92,246,0.75); outline-offset: 0; border-radius: 2px;';

/** Trim leading/trailing glyph half-leading so rings hug caps (esp. display fonts). */
export const CANVAS_TEXT_BOX_TRIM =
	'text-box: trim-both cap alphabetic; text-box-trim: trim-both; text-box-edge: cap alphabetic;';
