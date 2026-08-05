/** Starter template definitions — single source for Carousels, Videos, and Studio links. */

import type { TemplateId } from '$lib/studio/template-ids';

/** Layout ids used by the Videos workflow picker (maps to Studio video templates). */
export type VideoLayoutId =
	| 'story'
	| 'fit'
	| 'blur'
	| 'hook'
	| 'creator'
	| 'text'
	| 'source'
	| 'feature'
	| 'post';

export interface StarterTemplate {
	id: string;
	/** Canonical Studio template id */
	studioId: TemplateId;
	/** Videos page layout chip id — only set for video-family templates */
	layoutId?: VideoLayoutId;
	name: string;
	description: string;
	href: string;
	previewBg: string;
	previewText: string;
	previewSource: string;
	badge: string;
	badgeColor: string;
}

export const STARTER_TEMPLATES: StarterTemplate[] = [
	{
		id: 'empty',
		studioId: 'blank',
		name: 'Empty canvas',
		description: 'Start from a blank slide — add media, text, and overlays yourself',
		href: '/dashboard/studio?blank=1',
		previewBg: '',
		previewText: '',
		previewSource: '',
		badge: 'Blank',
		badgeColor: 'text-neutral-400',
	},
	{
		id: 'news',
		studioId: 'news',
		name: 'News Studio',
		description: 'AI writes the copy, Fal generates the images',
		href: '/dashboard/studio?template=news',
		previewBg: '/placeholders/carousel/news-template-placeholder.png',
		previewText: 'YOUR HEADLINE WILL APPEAR HERE',
		previewSource: 'Markets',
		badge: 'News',
		badgeColor: 'text-amber-400',
	},
	{
		id: 'image-quote',
		studioId: 'imageQuote',
		name: 'Image Quote',
		description: 'Top image + bold all-caps quote block',
		href: '/dashboard/studio?template=image-quote',
		previewBg: '/templates/image-quote/preview.png',
		previewText: '',
		previewSource: '',
		badge: 'Quote',
		badgeColor: 'text-white/70',
	},
	{
		id: 'tweet',
		studioId: 'tweet',
		name: 'Tweet Carousel',
		description: 'Turn viral tweet exchanges into shareable slides',
		href: '/dashboard/studio?template=tweet',
		previewBg: '',
		previewText: '',
		previewSource: '',
		badge: 'Tweet',
		badgeColor: 'text-sky-400',
	},
	{
		id: 'text',
		studioId: 'textCarousel',
		name: 'Text Carousel',
		description: 'Dark branded text carousels for any niche',
		href: '/dashboard/studio?template=text',
		previewBg: '/placeholders/carousel/text-template-placeholder.png',
		previewText: '',
		previewSource: '',
		badge: 'Text',
		badgeColor: 'text-white/60',
	},
	{
		id: 'black-text',
		studioId: 'blackText',
		name: 'Black text',
		description: 'Full-bleed dark slide with a bright hook line and long body copy',
		href: '/dashboard/studio?template=black-text',
		previewBg: '/placeholders/carousel/black-bg-placeholder.jpg',
		previewText: '',
		previewSource: '',
		badge: 'Carousel',
		badgeColor: 'text-sky-300',
	},
	{
		id: 'video-feature',
		studioId: 'videoFeature',
		layoutId: 'feature',
		name: 'Feature card',
		description: 'Headline + body with teal highlights and a rounded media card',
		href: '/dashboard/studio?template=feature',
		previewBg: '/placeholders/carousel/feature-card-placeholder.png',
		previewText: '',
		previewSource: '',
		badge: 'Video',
		badgeColor: 'text-teal-400',
	},
	{
		id: 'video-source',
		studioId: 'videoSource',
		layoutId: 'source',
		name: 'Highlight',
		description: 'Left-aligned hook with one neon highlighted word above a full-width clip',
		href: '/dashboard/studio?template=highlight',
		previewBg: '/placeholders/carousel/source-hook-placeholder.png',
		previewText: '',
		previewSource: '',
		badge: 'Video',
		badgeColor: 'text-lime-400',
	},
	{
		id: 'video-text',
		studioId: 'videoText',
		layoutId: 'text',
		name: 'Text on video',
		description: 'Full-bleed clip with centered outlined white text',
		href: '/dashboard/studio?template=pov',
		previewBg: '/placeholders/carousel/text-on-video-placeholder.png',
		previewText: '',
		previewSource: '',
		badge: 'Video',
		badgeColor: 'text-fuchsia-400',
	},
	{
		id: 'video-creator',
		studioId: 'videoCreator',
		layoutId: 'creator',
		name: 'Creator hook',
		description: 'Profile row + bold hook text above a letterboxed clip',
		href: '/dashboard/studio?template=creator',
		previewBg: '/placeholders/carousel/creator-hook-placeholder.png',
		previewText: '',
		previewSource: '',
		badge: 'Video',
		badgeColor: 'text-fuchsia-400',
	},
	{
		id: 'video-hook',
		studioId: 'videoHook',
		layoutId: 'hook',
		name: 'Hook video',
		description: 'Black letterbox with a large AI-written white hook above the clip',
		href: '/dashboard/studio?template=hook',
		previewBg: '/placeholders/carousel/hook-video-placeholder.png',
		previewText: '',
		previewSource: '',
		badge: 'Video',
		badgeColor: 'text-fuchsia-400',
	},
	{
		id: 'video-fit',
		studioId: 'videoFit',
		layoutId: 'fit',
		name: 'Fit video',
		description: 'Full-frame clip with minimal chrome — great for reframed vertical footage',
		href: '/dashboard/studio?template=fit',
		previewBg: '/placeholders/carousel/text-on-video-placeholder.png',
		previewText: '',
		previewSource: '',
		badge: 'Video',
		badgeColor: 'text-fuchsia-400',
	},
	{
		id: 'video-split',
		studioId: 'videoSplit',
		name: 'Multi split',
		description:
			'Stacked dual panel (9:16) — uses pyautoflip multi-face saliency when two subjects are far apart',
		href: '/dashboard/studio?template=split',
		previewBg: '/placeholders/carousel/hook-video-placeholder.png',
		previewText: '',
		previewSource: '',
		badge: 'Video',
		badgeColor: 'text-fuchsia-400',
	},
	{
		id: 'video-blur',
		studioId: 'videoBlur',
		layoutId: 'blur',
		name: 'Blur',
		description: 'Soft blurred backdrop with a sharp centered clip and headline',
		href: '/dashboard/studio?template=blur',
		previewBg: '/placeholders/carousel/hook-video-placeholder.png',
		previewText: '',
		previewSource: '',
		badge: 'Video',
		badgeColor: 'text-fuchsia-400',
	},
	{
		id: 'video-story',
		studioId: 'videoStory',
		layoutId: 'story',
		name: 'Video story',
		description: 'Bold headline + vertical video — Shorts, Reels, TikTok',
		href: '/dashboard/studio?template=video',
		previewBg: '/placeholders/carousel/hook-video-placeholder.png',
		previewText: '',
		previewSource: '',
		badge: 'Video',
		badgeColor: 'text-fuchsia-400',
	},
	{
		id: 'video-post',
		studioId: 'videoPost',
		layoutId: 'post',
		name: 'Clip post',
		description: 'Profile + casual hook above a letterboxed landscape clip',
		href: '/dashboard/studio?template=clip',
		previewBg: '/placeholders/carousel/clip-post-placeholder.png',
		previewText: '',
		previewSource: '',
		badge: 'Video',
		badgeColor: 'text-fuchsia-400',
	},
	{
		id: 'brand-stack',
		studioId: 'brandStack',
		name: 'Brand stack',
		description: 'Top clip + bottom media with a branded divider bar',
		href: '/dashboard/studio?template=brand-stack',
		previewBg: '/templates/brand-stack/preview.png',
		previewText: '',
		previewSource: '',
		badge: 'Video',
		badgeColor: 'text-fuchsia-400',
	},
	{
		id: 'photo-caption',
		studioId: 'photoCaption',
		name: 'Photo caption',
		description: 'Full-bleed photo with a dark top gradient and left-aligned story copy',
		href: '/dashboard/studio?template=caption',
		previewBg: '/placeholders/carousel/photo-caption-placeholder.png',
		previewText: '',
		previewSource: '',
		badge: 'Photo',
		badgeColor: 'text-orange-300',
	},
	{
		id: 'white-thread',
		studioId: 'whiteThread',
		name: 'White thread',
		description: 'Clean white post with profile header and spaced story paragraphs',
		href: '/dashboard/studio?template=thread',
		previewBg: '/placeholders/carousel/white-thread-placeholder.png',
		previewText: '',
		previewSource: '',
		badge: 'Post',
		badgeColor: 'text-neutral-500',
	},
	{
		id: 'white-media',
		studioId: 'whiteMedia',
		name: 'White media',
		description: 'White post with profile header, short copy, and a rounded media card',
		href: '/dashboard/studio?template=white-media',
		previewBg: '/placeholders/carousel/white-media-placeholder.png',
		previewText: '',
		previewSource: '',
		badge: 'Post',
		badgeColor: 'text-neutral-500',
	},
];

/** Video layout chips for the Videos workflow — derived from starter templates. */
export const VIDEO_LAYOUT_TEMPLATES: { id: VideoLayoutId; label: string; studioId: TemplateId }[] =
	STARTER_TEMPLATES.filter((t): t is StarterTemplate & { layoutId: VideoLayoutId } => !!t.layoutId).map(
		(t) => ({
			id: t.layoutId,
			label: t.name,
			studioId: t.studioId,
		}),
	);

export function starterByStudioId(studioId: TemplateId): StarterTemplate | undefined {
	return STARTER_TEMPLATES.find((t) => t.studioId === studioId);
}

export function layoutIdForStudioId(studioId: TemplateId): VideoLayoutId | undefined {
	return STARTER_TEMPLATES.find((t) => t.studioId === studioId)?.layoutId;
}

export function studioIdForLayoutId(layoutId: VideoLayoutId): TemplateId {
	return VIDEO_LAYOUT_TEMPLATES.find((l) => l.id === layoutId)?.studioId ?? 'videoFit';
}

export function starterHoverClass(id: string): string {
	if (id === 'empty') return 'hover:border-neutral-400/35 hover:shadow-[0_0_24px_rgba(115,115,115,0.10)]';
	if (id === 'tweet') return 'hover:border-sky-500/40 hover:shadow-[0_0_28px_rgba(14,165,233,0.12)]';
	if (id === 'text') return 'hover:border-white/25 hover:shadow-[0_0_28px_rgba(255,255,255,0.06)]';
	if (id === 'black-text') return 'hover:border-sky-500/35 hover:shadow-[0_0_28px_rgba(14,165,233,0.10)]';
	if (id === 'image-quote') return 'hover:border-white/30 hover:shadow-[0_0_28px_rgba(255,255,255,0.08)]';
	if (id.startsWith('video-')) return 'hover:border-fuchsia-500/40 hover:shadow-[0_0_28px_rgba(217,70,239,0.12)]';
	if (id.startsWith('photo-')) return 'hover:border-sky-500/40 hover:shadow-[0_0_28px_rgba(56,189,248,0.12)]';
	if (id.startsWith('white-')) return 'hover:border-neutral-400/50 hover:shadow-[0_0_28px_rgba(0,0,0,0.08)]';
	return 'hover:border-amber-500/40 hover:shadow-[0_0_28px_rgba(245,166,35,0.12)]';
}

export function starterArrowClass(id: string): string {
	if (id === 'empty') return 'group-hover:text-neutral-400';
	if (id === 'tweet') return 'group-hover:text-sky-400';
	if (id === 'text') return 'group-hover:text-white/70';
	if (id === 'black-text') return 'group-hover:text-sky-400';
	if (id === 'image-quote') return 'group-hover:text-white/80';
	if (id.startsWith('video-')) return 'group-hover:text-fuchsia-400';
	if (id.startsWith('photo-')) return 'group-hover:text-sky-300';
	if (id.startsWith('white-')) return 'group-hover:text-neutral-500';
	return 'group-hover:text-amber-400';
}
