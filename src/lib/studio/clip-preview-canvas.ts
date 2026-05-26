/**
 * Canvas sizes + scale for clip previews — matches Studio default FEED (4:5) format.
 * @see studio `FORMATS` feed id and `CANVAS_W` / `CANVAS_H` when `formatId === 'feed'`.
 */
export const STUDIO_FEED_CANVAS = { w: 1080, h: 1350 } as const;

export function studioFeedPreviewScale(previewWidthPx: number): number {
	return previewWidthPx / STUDIO_FEED_CANVAS.w;
}

export function studioFeedPreviewHeight(previewWidthPx: number): number {
	return Math.round(STUDIO_FEED_CANVAS.h * studioFeedPreviewScale(previewWidthPx));
}
