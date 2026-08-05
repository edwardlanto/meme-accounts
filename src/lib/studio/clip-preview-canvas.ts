/**
 * Canvas sizes + scale for clip / bulk previews.
 * Default FEED (4:5) matches Studio; video clips often use VERTICAL (9:16).
 */
export const STUDIO_FEED_CANVAS = { w: 1080, h: 1350 } as const;
export const STUDIO_VERTICAL_CANVAS = { w: 1080, h: 1920 } as const;

export function studioFeedPreviewScale(previewWidthPx: number): number {
	return previewWidthPx / STUDIO_FEED_CANVAS.w;
}

export function studioFeedPreviewHeight(previewWidthPx: number): number {
	return Math.round(STUDIO_FEED_CANVAS.h * studioFeedPreviewScale(previewWidthPx));
}

export function studioPreviewScale(previewWidthPx: number, canvasW: number): number {
	return previewWidthPx / Math.max(1, canvasW);
}

export function studioPreviewHeight(previewWidthPx: number, canvasW: number, canvasH: number): number {
	return Math.round(canvasH * studioPreviewScale(previewWidthPx, canvasW));
}
