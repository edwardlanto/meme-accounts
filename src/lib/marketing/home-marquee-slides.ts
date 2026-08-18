/** One slide in the home hero phone marquee (`static/placeholders/marquee/slide-{n}.*`). */
export type HomeMarqueeSlide = {
	/** Filename only, e.g. `slide-1.mp4` or `slide-3.png`. */
	file: string;
	tint: string;
	tag: string;
	/** Optional still used as the video poster / first frame. */
	poster?: string;
};

const MARQUEE_BASE = '/placeholders/marquee';

const VIDEO_EXT = /\.(mp4|webm|mov)$/i;

export function marqueeAssetPath(file: string): string {
	return `${MARQUEE_BASE}/${file}`;
}

export function isMarqueeVideo(file: string): boolean {
	return VIDEO_EXT.test(file);
}

/** Per-index chrome; extras cycle the palette. Shared with the server resolver. */
export const HOME_MARQUEE_SLIDE_META: Array<{ tint: string; tag: string }> = [
	{ tint: '#FFB4A2', tag: 'Carousel' },
	{ tint: '#B5E48C', tag: 'Reel' },
	{ tint: '#A0C4FF', tag: 'Story' },
	{ tint: '#FFC8DD', tag: 'Post' },
	{ tint: '#FFD6A5', tag: 'Schedule' },
	{ tint: '#CDB4DB', tag: 'Clip' },
	{ tint: '#BDE0FE', tag: 'Hook' },
	{ tint: '#F1C0E8', tag: 'Drop' },
];

/**
 * Vercel serves these from `static/placeholders/marquee/*`.
 * Keep this manifest explicit rather than scanning the filesystem at runtime,
 * which can come back empty in serverless environments.
 */
export const HOME_MARQUEE_SLIDES: HomeMarqueeSlide[] = [
	{ file: 'slide-1.mp4', poster: 'slide-1.png', ...HOME_MARQUEE_SLIDE_META[0]! },
	{ file: 'slide-2.mp4', poster: 'slide-2.png', ...HOME_MARQUEE_SLIDE_META[1]! },
	{ file: 'slide-3.mp4', ...HOME_MARQUEE_SLIDE_META[2]! },
	{ file: 'slide-4.mp4', ...HOME_MARQUEE_SLIDE_META[3]! },
	{ file: 'slide-5.png', ...HOME_MARQUEE_SLIDE_META[4]! },
];
