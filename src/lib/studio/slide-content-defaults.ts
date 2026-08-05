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
	bgOffsetX: 50,
	bgOffsetY: 50,
	bgZoom: 100,
	bgFitMode: 'cover' as const,
	bgContainMagnify: 140,
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
		'Lead with a sharp hook on the first line.\n\n' +
		'Use the second beat for proof, tone, or a CTA — keep it scannable.',
} as const;

/** Minimum plain-text length for text carousel body (studio + API fills). */
export const TEXT_CAROUSEL_BODY_MIN_CHARS = TEXT_CAROUSEL_DEFAULTS.body.trim().length;

const LEGACY_MOMENTUM_PARA =
	'End with momentum — a reason to engage, click, or remember you.';

/** Drop the retired third default paragraph if it is still present in saved decks. */
export function stripLegacyTextCarouselMomentum(body: string): string {
	return String(body ?? '')
		.replace(/\r\n/g, '\n')
		.split(/\n\s*\n+/)
		.map((p) => p.trim())
		.filter((p) => p && p !== LEGACY_MOMENTUM_PARA)
		.join('\n\n')
		.trim();
}

/**
 * If body is shorter than {@link TEXT_CAROUSEL_BODY_MIN_CHARS}, append the default deck copy
 * so slides stay visually full. Empty input becomes the full default body.
 */
export function ensureTextCarouselBodyMinLength(body: string): string {
	const min = TEXT_CAROUSEL_BODY_MIN_CHARS;
	let out = stripLegacyTextCarouselMomentum(body);
	if (out.length >= min) return out;
	const filler = String(TEXT_CAROUSEL_DEFAULTS.body)
		.trim()
		.replace(/\r\n/g, '\n');
	if (!filler.length) return out;
	let guard = 0;
	while (out.length < min && guard++ < 6) {
		out = out ? `${out}\n\n${filler}` : filler;
	}
	return out;
}

export const IMAGE_QUOTE_DEFAULTS = {
	imageUrl: '/templates/image-quote/demo-bg.png',
	body:
		"IF YOU STILL THINK THE U.S. IS\nFIGHTING IRAN OVER NUCLEAR\nWEAPONS, YOU'VE BEEN FED\nPROPAGANDA. THE U.S. IS\nFIGHTING CHINA. HERE'S THEIR\nSTRATEGY:",
	footerLeft: '$',
	footerRight: 'WEALTHY\nSETUP',
	topRatio: 0.54,
} as const;

/** Vertical short-form layout: headline + full-bleed video + watermark. */
/** Black full-bleed carousel: profile row + gold hook + white body. */
export const BLACK_TEXT_CAROUSEL_DEFAULTS = {
	name: 'Jack Blair',
	handle: '@jackblairofficial',
	headline: '3. "What\'s the cost of inaction in 6 months, 1 year, 3 years?"',
	body:
		'Step three of fear-setting. The math nobody runs.\n\n' +
		'His TED talk: "We see what could go wrong if we act. We don\'t see what goes wrong if we don\'t."\n\n' +
		'Tim left BrainQUICKEN for a month. The business did better without him.',
	headlineColor: '#E8C547',
} as const;

export const VIDEO_STORY_DEFAULTS = {
	videoUrl: '/videos/video-template.mp4',
	watermark: 'BUSINESS FOUNDERS',
	headline:
		'He messed up — but the boss taught him a lesson instead.\n\nThe moment went viral for a reason: leadership is rarely loud, and growth rarely looks perfect on camera.',
} as const;

/** Split top/bottom media with a centered brand bar (Rumble-style clip posts). */
export const BRAND_STACK_DEFAULTS = {
	topVideoUrl: '/videos/video-template.mp4',
	bottomMediaUrl: '/placeholders/placeholder-square.jpeg',
	watermark: 'Clipgang54',
	headline:
		"Rampage Jackson PRESSED these security guards after they told a handicap kid 'NO' to the event 😳👀",
	brand: 'rumble.com/RampageJackson',
} as const;

export const BRAND_STACK_HEADLINE_STYLE = {
	color: '#0f172a',
	fontWeight: 700,
	fontFamily: 'Satoshi',
	fontSize: 36,
	align: 'center' as const,
} as const;

/** Readable on the black video-story canvas (Studio + clip previews). */
export const VIDEO_STORY_HEADLINE_STYLE = {
	color: '#f4f4f5',
	fontWeight: 600,
	fontFamily: 'Satoshi',
	fontSize: 46,
} as const;

/** Black letterbox + large white hook above the clip (Hook video template). */
export const VIDEO_HOOK_DEFAULTS = {
	videoUrl: '/videos/video-template.mp4',
	watermark: '',
	headline: 'One of the most uncomfortable live interviews ever 💀',
} as const;

export const VIDEO_HOOK_HEADLINE_STYLE = {
	color: '#ffffff',
	fontWeight: 400,
	fontFamily: 'Satoshi',
	fontSize: 56,
	align: 'left' as const,
} as const;

/**
 * Creator hook: profile row + sentence-case headline (optional [[bold]] emphasis)
 * above a letterboxed clip on black.
 */
export const VIDEO_CREATOR_DEFAULTS = {
	videoUrl: '/videos/video-template.mp4',
	name: 'Startup Revenue AI',
	handle: '@startuprevenue.ai',
	headline: 'He gave a 10 second pitch that [[broke the internet]]',
} as const;

export const VIDEO_CREATOR_HEADLINE_STYLE = {
	color: '#ffffff',
	fontWeight: 400,
	fontFamily: 'Satoshi',
	fontSize: 48,
	align: 'left' as const,
} as const;

/**
 * Clip post: profile row (no verified badge) + casual hook above a wide letterboxed clip.
 */
export const VIDEO_POST_DEFAULTS = {
	videoUrl: '/videos/video-template.mp4',
	name: 'Saturday Nite MMA',
	handle: '@SaturdayNiteMMA',
	avatarUrl: '/placeholders/carousel/clip-post-avatar.png',
	headline: "Rampage Jackson found out he couldn't take his son anymore 😭💀",
} as const;

export const VIDEO_POST_HEADLINE_STYLE = {
	color: '#ffffff',
	fontWeight: 600,
	fontFamily: 'Satoshi',
	fontSize: 44,
	align: 'left' as const,
} as const;

/** Full-bleed video with centered outlined white text (Text on video template). */
export const VIDEO_TEXT_DEFAULTS = {
	videoUrl: '/videos/video-template.mp4',
	watermark: '',
	headline: 'POV: you found the clip that explains everything',
} as const;

export const VIDEO_TEXT_HEADLINE_STYLE = {
	color: '#ffffff',
	fontWeight: 800,
	fontFamily: 'Satoshi',
	fontSize: 64,
	align: 'center' as const,
} as const;

/**
 * Highlight: left-aligned 2-line hook with one neon [[highlighted]] word above a full-width clip.
 */
export const VIDEO_SOURCE_DEFAULTS = {
	videoUrl: '/videos/video-template.mp4',
	watermark: '',
	headline: '[[Entrepreneur]] reveals the secret to finding billion-dollar ideas:',
	highlightColor: '#39FF14',
} as const;

export const VIDEO_SOURCE_HEADLINE_STYLE = {
	color: '#ffffff',
	fontWeight: 400,
	fontFamily: 'Satoshi',
	fontSize: 56,
	align: 'left' as const,
} as const;

/**
 * Feature card: left-aligned headline + body with teal [[highlights]],
 * rounded landscape media in the lower half on black.
 */
export const VIDEO_FEATURE_DEFAULTS = {
	videoUrl: '/videos/video-template.mp4',
	highlightColor: '#2EE6C5',
	headline: 'Rocket.new just launched 1.0 as the world’s first [[Vibe Solutioning]] platform',
	body:
		'Data from 1.5M users shows 60–70% of vibe coding users still don’t know what they’re building... [[Rocket 1.0]] brings its original vision to life as a complete product.',
} as const;

export const VIDEO_FEATURE_HEADLINE_STYLE = {
	color: '#ffffff',
	fontWeight: 700,
	fontFamily: 'Satoshi',
	fontSize: 44,
	align: 'left' as const,
} as const;

export const VIDEO_FEATURE_BODY_STYLE = {
	color: '#ffffff',
	fontWeight: 500,
	fontFamily: 'Satoshi',
	fontSize: 32,
	align: 'left' as const,
} as const;

/** Image top + centered title/body on black (Topic card). */
export const PHOTO_TOPIC_DEFAULTS = {
	imageUrl: '/images/templates/topic-bg.jpeg',
	headlineColor: '#95B8F6',
	headline: 'REGENERATIVE\nMEDICINE',
	body: 'Stem cells, tissue engineering, and lab-grown organs aim to repair or replace failing body parts, reducing the need for transplants and extending functional lifespan.',
} as const;

export const PHOTO_TOPIC_HEADLINE_STYLE = {
	color: '#95B8F6',
	fontWeight: 400,
	fontFamily: 'Bebas Neue',
	fontSize: 96,
	align: 'center' as const,
	letterSpacing: 0.06,
	lineHeight: 0.92,
} as const;

export const PHOTO_TOPIC_BODY_STYLE = {
	color: '#ffffff',
	fontWeight: 400,
	fontFamily: 'Montserrat',
	fontSize: 32,
	align: 'center' as const,
	lineHeight: 1.45,
} as const;

/** Full-bleed photo with top gradient + left caption paragraphs (Photo caption). */
export const PHOTO_CAPTION_DEFAULTS = {
	imageUrl: '/placeholders/carousel/photo-caption-placeholder.png',
	headline:
		'Despite having no engineering background and no technical co-founder…',
	body: 'Nico built the entire product using Lovable, working nights after putting his kids to bed.',
} as const;

/** White card: profile row + multi-paragraph thread body (no emoji CTA). */
export const WHITE_THREAD_DEFAULTS = {
	name: 'Katie & Luke Johnson',
	handle: '@feetandmore',
	avatarUrl: '/placeholders/carousel/white-thread-avatar.png',
	body:
		"A year ago today, I was diagnosed with a rare disease that left me with limited mobility and in need of a full-time caregiver.\n\n" +
		"Today, I'm happy to report that I've made a full recovery.\n\n" +
		"I never would have made it without Luke.\n\n" +
		"He quit his job to take care of me.\n\n" +
		"He carried me when I couldn't walk.\n\n" +
		"He fed me when I couldn't feed myself.\n\n" +
		'He never once complained.',
} as const;

/** White card: profile + short copy + rounded media attachment. */
export const WHITE_MEDIA_DEFAULTS = {
	name: 'chronically online',
	handle: '@chronicallyon',
	avatarUrl: '/placeholders/carousel/white-media-avatar.png',
	imageUrl: '/placeholders/carousel/white-media-attachment.png',
	body:
		"If you've been scrolling this week, you've probably seen this image.\n\n" +
		"It's a bizarre illustration from a Persian manuscript created in 1921.\n\n" +
		"And somehow...it's become the internet's newest obsession.",
} as const;

/** Labels for docs / error messages when extending templates. */
export function templateLabel(id: TemplateId): string {
	return STUDIO_TEMPLATES.find((t) => t.id === id)?.label ?? id;
}
