import {
	HOME_MARQUEE_SLIDES,
	type HomeMarqueeSlide,
} from './home-marquee-slides';

/**
 * Return a static manifest for the homepage marquee.
 * Public assets live under `static/placeholders/marquee/*` and are referenced
 * by URL at render time, so we avoid filesystem reads in production runtimes.
 */
export function resolveHomeMarqueeSlides(): HomeMarqueeSlide[] {
	return HOME_MARQUEE_SLIDES.slice();
}
