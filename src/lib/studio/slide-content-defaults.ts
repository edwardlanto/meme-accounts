import { STUDIO_TEMPLATES, type TemplateId } from './template-ids';

/** Placeholder headline when no story is loaded (News + shared `slides` array). */
export const NEWS_PLACEHOLDER_HEADLINE =
	'YOUR HEADLINE WILL APPEAR HERE ONCE YOU FETCH A NEWS STORY';

export const NEWS_DEFAULT_SOURCE = 'Markets';

/** Default News badge / canvas geometry (matches initial studio state). */
export const NEWS_DEFAULT_LAYOUT = {
	circleX: 772,
	circleY: 52,
	circleSize: 300,
	circle2X: 80,
	circle2Y: 80,
	circle2Size: 220,
	bgOffsetX: 0,
	bgOffsetY: 50,
	bgZoom: 100,
	bgFitMode: 'cover' as const,
	bgContainMagnify: 100,
	textPanelOffsetY: 0,
	shadowHeight: 75,
	shadowStrength: 1,
};

export const TWEET_DEFAULTS = {
	topName: 'Chef 👨‍🍳',
	topHandle: '@chefsevenn',
	bottomName: 'Mo Mohler',
	bottomHandle: '@MoMohler',
	topText: 'Ketchup or mayo or mustard?',
	bottomText: '3 straight misses chef. These appear to be French fries.',
	replyCount: '4.2K',
	repostCount: '12.8K',
	likeCount: '89.4K',
	topImageHeight: 720,
	topImageWidth: 920,
	topImageZoom: 1,
	topImagePanX: 50,
	topImagePanY: 50,
} as const;

export const ARTICLE_DEFAULT_BODY =
	"Here's the trillion-dollar problem everyone avoids.\n\nTo break it down:\n\nA *1-gigawatt AI data center* costs roughly *$80B* to build & operate.";
export const ARTICLE_DEFAULT_SWIPE = '«« Swipe';

export const TEXT_CAROUSEL_DEFAULTS = {
	name: 'Captains of industry',
	handle: '@captainsofindustryy',
	body:
		'Beijing and Washington will reaffirm plans to reopen the Strait of Hormuz together.\n\n' +
		'The announcement follows months of quiet negotiation between regional partners and shipping insurers. Officials stressed that stability through the strait remains critical for energy markets — and for consumers far beyond the Gulf.\n\n' +
		'Analysts expect a joint statement outlining timelines, escort protocols, and coordination with commercial fleets. Until routes normalize, volatility in futures markets may persist; traders are watching every headline.\n\n' +
		'What this means for operators: supply chains that depend on Gulf transit should scenario-plan for both a quick reopening and a phased rollout. Clear communication to customers beats surprise every time.',
} as const;

export const IMAGE_QUOTE_DEFAULTS = {
	body: 'YOUR BIG STATEMENT GOES HERE.\nMAKE IT SHORT, PUNCHY, AND ALL CAPS.',
	footerLeft: '$',
	footerRight: 'BRAND',
} as const;

/** Vertical short-form layout: headline + full-bleed video + watermark. */
/** Black full-bleed carousel: blue hook + white body + optional swipe hint. */
export const BLACK_TEXT_CAROUSEL_DEFAULTS = {
	headline: '1. Find flights so cheap they feel like a steal',
	body:
		'Learn the flight booking strategies frequent travelers use but rarely share. Find the lowest possible fares from [departure city] to [destination] in [month]. Include the best days to search, the best days to fly, hidden-city ticketing insights, and the common booking mistake that costs most travelers hundreds on every trip.',
} as const;

export const VIDEO_STORY_DEFAULTS = {
	videoUrl: '/videos/video-template.mp4',
	watermark: 'BUSINESS FOUNDERS',
	headline:
		'He messed up — but the boss taught him a lesson instead.\n\nThe moment went viral for a reason: leadership is rarely loud, and growth rarely looks perfect on camera.',
} as const;

/** Labels for docs / error messages when extending templates. */
export function templateLabel(id: TemplateId): string {
	return STUDIO_TEMPLATES.find((t) => t.id === id)?.label ?? id;
}
