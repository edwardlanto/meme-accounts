/**
 * BulkSlide payloads for the "Start from a template" grid — same copy + stock
 * media Studio opens with, so cards match the live canvas.
 */
import { createBlankSlide, type BulkSlide } from '$lib/studio/bulk-to-studio';
import { GENERATED_DEMO_POSTS as D } from '$lib/studio/generated-demo-posts';
import {
	isBrandStackFamily,
	isVideoSplitFamily,
	isVideoStoryFamily,
	type TemplateId,
} from '$lib/studio/template-ids';
import {
	BLACK_TEXT_CAROUSEL_DEFAULTS,
	BRAND_STACK_DEFAULTS,
	IMAGE_QUOTE_DEFAULTS,
	NEWS_DEMO_IMAGE,
	NEWS_DEFAULT_SUBTEXT,
	NEWS_PLACEHOLDER_HEADLINE,
	PHOTO_CAPTION_DEFAULTS,
	TEXT_CAROUSEL_DEFAULTS,
	TWEET_DEFAULTS,
	VIDEO_CREATOR_DEFAULTS,
	VIDEO_FEATURE_DEFAULTS,
	VIDEO_HOOK_DEFAULTS,
	VIDEO_POST_DEFAULTS,
	VIDEO_SOURCE_DEFAULTS,
	VIDEO_SPLIT_DEFAULTS,
	VIDEO_STORY_DEFAULTS,
	VIDEO_TEXT_DEFAULTS,
	WHITE_MEDIA_DEFAULTS,
	WHITE_THREAD_DEFAULTS,
} from '$lib/studio/slide-content-defaults';

function withDemoVideo(
	slide: BulkSlide,
	opts: { headline: string; body?: string; videoUrl: string; posterUrl?: string },
): BulkSlide {
	return {
		...slide,
		headline: opts.headline,
		body: opts.body ?? '',
		mediaUrl: opts.videoUrl,
		mediaKind: 'video',
		mediaThumb: opts.posterUrl || opts.videoUrl,
		videoMuted: true,
		clipStart: 0,
		clipEnd: 8,
	};
}

/** Still frame used by headless cover capture when video can't autoplay. */
export const STOCK_VIDEO_POSTER =
	VIDEO_STORY_DEFAULTS.posterUrl || '/placeholders/carousel/video-template-poster.jpg';

export function createStarterPreviewSlide(studioId: TemplateId): BulkSlide {
	const slide = createBlankSlide(studioId);

	if (studioId === 'blank') return slide;

	if (studioId === 'news') {
		return {
			...slide,
			headline: NEWS_PLACEHOLDER_HEADLINE,
			body: NEWS_DEFAULT_SUBTEXT,
			mediaUrl: NEWS_DEMO_IMAGE,
			mediaKind: 'image',
		};
	}

	if (studioId === 'imageQuote') {
		return {
			...slide,
			headline: IMAGE_QUOTE_DEFAULTS.body,
			mediaUrl: IMAGE_QUOTE_DEFAULTS.imageUrl,
			mediaKind: 'image',
		};
	}

	if (studioId === 'tweet') {
		return {
			...slide,
			headline: TWEET_DEFAULTS.topText,
			body: TWEET_DEFAULTS.bottomText,
		};
	}

	if (studioId === 'textCarousel') {
		return {
			...slide,
			headline: '',
			body: TEXT_CAROUSEL_DEFAULTS.body,
		};
	}

	if (studioId === 'blackText') {
		return {
			...slide,
			headline: BLACK_TEXT_CAROUSEL_DEFAULTS.headline,
			body: BLACK_TEXT_CAROUSEL_DEFAULTS.body,
		};
	}

	if (studioId === 'photoCaption') {
		return {
			...slide,
			headline: PHOTO_CAPTION_DEFAULTS.headline,
			body: PHOTO_CAPTION_DEFAULTS.body,
			mediaUrl: PHOTO_CAPTION_DEFAULTS.imageUrl,
			mediaKind: 'image',
		};
	}

	if (studioId === 'photoTopic') return slide;

	if (studioId === 'whiteThread') {
		return { ...slide, body: WHITE_THREAD_DEFAULTS.body };
	}

	if (studioId === 'whiteMedia') {
		return {
			...slide,
			body: WHITE_MEDIA_DEFAULTS.body,
			mediaUrl: WHITE_MEDIA_DEFAULTS.imageUrl,
			mediaKind: 'image',
		};
	}

	if (studioId === 'videoFeature') {
		return withDemoVideo(slide, {
			headline: VIDEO_FEATURE_DEFAULTS.headline,
			body: VIDEO_FEATURE_DEFAULTS.body,
			videoUrl: VIDEO_FEATURE_DEFAULTS.videoUrl,
			posterUrl: VIDEO_FEATURE_DEFAULTS.posterUrl,
		});
	}

	if (studioId === 'videoSource') {
		return withDemoVideo(slide, {
			headline: VIDEO_SOURCE_DEFAULTS.headline,
			videoUrl: VIDEO_SOURCE_DEFAULTS.videoUrl,
			posterUrl: VIDEO_SOURCE_DEFAULTS.posterUrl,
		});
	}

	if (studioId === 'videoText') {
		return withDemoVideo(slide, {
			headline: VIDEO_TEXT_DEFAULTS.headline,
			videoUrl: VIDEO_TEXT_DEFAULTS.videoUrl,
			posterUrl: VIDEO_TEXT_DEFAULTS.posterUrl,
		});
	}

	if (studioId === 'videoCreator') {
		return withDemoVideo(slide, {
			headline: VIDEO_CREATOR_DEFAULTS.headline,
			videoUrl: VIDEO_CREATOR_DEFAULTS.videoUrl,
			posterUrl: VIDEO_CREATOR_DEFAULTS.posterUrl,
		});
	}

	if (studioId === 'videoHook') {
		return withDemoVideo(slide, {
			headline: VIDEO_HOOK_DEFAULTS.headline,
			videoUrl: VIDEO_HOOK_DEFAULTS.videoUrl,
			posterUrl: VIDEO_HOOK_DEFAULTS.posterUrl,
		});
	}

	if (studioId === 'videoPost') {
		return withDemoVideo(slide, {
			headline: VIDEO_POST_DEFAULTS.headline,
			videoUrl: VIDEO_POST_DEFAULTS.videoUrl,
			posterUrl: VIDEO_POST_DEFAULTS.posterUrl,
		});
	}

	if (studioId === 'videoStory') {
		return withDemoVideo(slide, {
			headline: VIDEO_STORY_DEFAULTS.headline,
			videoUrl: VIDEO_STORY_DEFAULTS.videoUrl,
			posterUrl: VIDEO_STORY_DEFAULTS.posterUrl,
		});
	}

	if (studioId === 'videoFit') {
		return withDemoVideo(slide, {
			headline: D['video-fit'].headline || '',
			videoUrl: D['video-fit'].videoUrl,
			posterUrl: D['video-fit'].posterUrl,
		});
	}

	if (studioId === 'videoBlur') {
		return withDemoVideo(slide, {
			headline: D['video-blur'].headline,
			videoUrl: D['video-blur'].videoUrl,
			posterUrl: D['video-blur'].posterUrl,
		});
	}

	if (isVideoSplitFamily(studioId)) {
		return withDemoVideo(slide, {
			headline: '',
			videoUrl: VIDEO_SPLIT_DEFAULTS.videoUrl,
			posterUrl: VIDEO_SPLIT_DEFAULTS.posterUrl,
		});
	}

	if (isVideoStoryFamily(studioId)) {
		return withDemoVideo(slide, {
			headline: VIDEO_STORY_DEFAULTS.headline,
			videoUrl: VIDEO_STORY_DEFAULTS.videoUrl,
			posterUrl: VIDEO_STORY_DEFAULTS.posterUrl,
		});
	}

	if (isBrandStackFamily(studioId)) {
		return {
			...slide,
			headline: BRAND_STACK_DEFAULTS.headline,
			mediaUrl: BRAND_STACK_DEFAULTS.topVideoUrl,
			mediaKind: 'video',
			mediaThumb: BRAND_STACK_DEFAULTS.posterUrl,
			videoMuted: true,
			clipStart: 0,
			clipEnd: 8,
		};
	}

	return slide;
}
