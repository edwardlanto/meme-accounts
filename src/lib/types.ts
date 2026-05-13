/** Draggable image overlay placed on top of a slide */
export interface Overlay {
	id: string;
	src: string;  // data URL
	/** Render mode. 'grid' is a repeating tiled background layer. */
	kind?: 'image' | 'grid';
	/** For grid overlays: tile size in template px. */
	tile?: number;
	/** For grid overlays: opacity 0..1. */
	opacity?: number;
	x: number;    // left edge in template px (0–1080)
	y: number;    // top edge in template px (0–1350)
	w: number;    // width in template px
	h: number;    // height in template px
	/** Image sticker overlays: corner radius in template px (clamped to half the shorter side). */
	borderRadius?: number;
}

/** Draggable text overlay placed on top of a slide */
export interface TextOverlay {
	id: string;
	text: string;
	x: number;
	y: number;
	w: number;
	h: number;
	style?: TextStyle;
}

/**
 * Per-element text style override. When a field is undefined the template's
 * default behavior is used (e.g. undefined fontSize → auto-sizing kicks in).
 */
export interface TextStyle {
	fontFamily?: string;     // Display name for a typeface; app renders with self-hosted Satoshi
	fontSize?: number;       // template px; overrides auto-sizing when set
	fontWeight?: number;     // CSS weight 100–900
	italic?: boolean;
	underline?: boolean;
	color?: string;          // hex
	bgColor?: string;        // hex (behind text)
	align?: 'left' | 'center' | 'right';
	letterSpacing?: number;  // em
	lineHeight?: number;     // unitless multiplier
}

/** Typography sampled from the canvas display layer so inline markup editors match view mode. */
export interface TypographySnapshot {
	fontWeight: string;
	fontFamily: string;
	fontSize: string;
	lineHeight: string;
	letterSpacing: string;
	fontStyle: string;
	textDecoration: string;
	textAlign: string;
}

/** A text element that can be edited/styled via the floating toolbar. */
export type TextElementKind =
	| 'headline'
	| 'source'
	| 'textOverlay'
	| 'tweetTopName'
	| 'tweetTopHandle'
	| 'tweetTopText'
	/** Studio: tweet attachment frame selected (floating media toolbar). */
	| 'tweetTopMedia'
	/** Studio: top tweet profile circle (avatar toolbar). */
	| 'tweetTopAvatar'
	/** Studio: reply profile circle (avatar toolbar). */
	| 'tweetBottomAvatar'
	| 'tweetBottomName'
	| 'tweetBottomHandle'
	| 'tweetBottomText'
	| 'tweetReplyCount'
	| 'tweetRepostCount'
	| 'tweetLikeCount'
	| 'textCarouselName'
	| 'textCarouselHandle'
	| 'textCarouselAvatar'
	| 'textCarouselBody'
	| 'articleBody'
	| 'articleSwipeText'
	| 'articleImage'
	| 'articleLogo'
	| 'imageQuoteFooterLeft'
	| 'imageQuoteFooterRight'
	| 'videoStoryHeadline'
	| 'videoStoryWatermark'
	| 'blackTextHeadline'
	| 'blackTextBody'
	| 'blackTextSwipe';

export interface TextSelection {
	slideIndex: number;
	kind: TextElementKind;
}
