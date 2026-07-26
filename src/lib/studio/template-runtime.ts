/**
 * Per-template Studio chrome metadata — one place to adjust layout behavior
 * so editing one template’s overflow/stacking doesn’t require hunting the page.
 */
import type { TemplateId } from './template-ids';

export type StudioTemplateRuntime = {
	/** Preview clip: Tweet card shadows need visible overflow; most slides clip to rounded rect. */
	canvasOverflowClass: 'overflow-hidden' | 'overflow-visible';
};

const DEFAULT: StudioTemplateRuntime = { canvasOverflowClass: 'overflow-hidden' };

const BY_TEMPLATE: Partial<Record<TemplateId, StudioTemplateRuntime>> = {
	blank: DEFAULT,
	news: DEFAULT,
	article: DEFAULT,
	textCarousel: DEFAULT,
	imageQuote: DEFAULT,
	videoStory: DEFAULT,
	videoFit: DEFAULT,
	videoBlur: DEFAULT,
	blackText: DEFAULT,
	tweet: { canvasOverflowClass: 'overflow-visible' },
};

export function studioTemplateRuntime(id: TemplateId): StudioTemplateRuntime {
	return BY_TEMPLATE[id] ?? DEFAULT;
}
