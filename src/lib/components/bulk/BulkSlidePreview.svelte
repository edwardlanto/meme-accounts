<script lang="ts">
	import type { BulkSlide } from '$lib/studio/bulk-to-studio';
	import { createBlankSlide } from '$lib/studio/bulk-to-studio';
	import {
		coerceTemplateId,
		isVideoStoryFamily,
		videoLayoutForTemplate,
	} from '$lib/studio/template-ids';
	import {
		STUDIO_FEED_CANVAS,
		STUDIO_VERTICAL_CANVAS,
		studioPreviewHeight,
		studioPreviewScale,
	} from '$lib/studio/clip-preview-canvas';
	import {
		canvasSizeForStudioFormat,
		parseReframeAspectFromSettingsKey,
		studioFormatForReframeAspect,
	} from '$lib/video-clips/reframe';
	import {
		BLACK_TEXT_CAROUSEL_DEFAULTS,
		IMAGE_QUOTE_DEFAULTS,
		NEWS_DEFAULT_SOURCE,
		PHOTO_CAPTION_DEFAULTS,
		PHOTO_TOPIC_DEFAULTS,
		PHOTO_TOPIC_BODY_STYLE,
		PHOTO_TOPIC_HEADLINE_STYLE,
		TEXT_CAROUSEL_DEFAULTS,
		VIDEO_CREATOR_DEFAULTS,
		VIDEO_CREATOR_HEADLINE_STYLE,
		VIDEO_FEATURE_BODY_STYLE,
		VIDEO_FEATURE_DEFAULTS,
		VIDEO_FEATURE_HEADLINE_STYLE,
		VIDEO_HOOK_HEADLINE_STYLE,
		VIDEO_POST_DEFAULTS,
		VIDEO_POST_HEADLINE_STYLE,
		VIDEO_SOURCE_DEFAULTS,
		VIDEO_SOURCE_HEADLINE_STYLE,
		VIDEO_STORY_DEFAULTS,
		VIDEO_TEXT_HEADLINE_STYLE,
		WHITE_MEDIA_DEFAULTS,
		WHITE_THREAD_DEFAULTS,
	} from '$lib/studio/slide-content-defaults';
	import { ensureFirstWordHighlight } from '$lib/video-clips/video-hook';

	import PhotoStoryTemplate from '$lib/components/templates/PhotoStoryTemplate.svelte';
	import TextCarouselTemplate from '$lib/components/templates/TextCarouselTemplate.svelte';
	import WhitePostTemplate from '$lib/components/templates/WhitePostTemplate.svelte';
	import VideoStoryTemplate from '$lib/components/templates/VideoStoryTemplate.svelte';
	import BlackTextCarouselTemplate from '$lib/components/templates/BlackTextCarouselTemplate.svelte';
	import ImageQuoteTemplate from '$lib/components/templates/ImageQuoteTemplate.svelte';
	import NewsTemplate from '$lib/components/templates/NewsTemplate.svelte';
	import TweetTemplate from '$lib/components/templates/TweetTemplate.svelte';

	type Props = {
		slide?: BulkSlide | null;
		/** Preview width in CSS px */
		width?: number;
	};

	let { slide: slideProp = null, width = 96 }: Props = $props();

	const slide = $derived(slideProp ?? createBlankSlide('news'));

	const CANVAS_W = STUDIO_FEED_CANVAS.w;
	const CANVAS_H = STUDIO_FEED_CANVAS.h;
	const scale = $derived(studioFeedPreviewScale(width));
	const previewH = $derived(studioFeedPreviewHeight(width));

	const template = $derived(coerceTemplateId(slide.template));
	const headline = $derived(String(slide.headline ?? '').trim() || ' ');
	const newsTemplateText = $derived.by(() => {
		const raw = slide.clipMeta?.newsHeadline?.trim();
		if (raw) return raw;
		if (headline !== ' ') return headline;
		return 'YOUR HEADLINE';
	});
	const body = $derived(String(slide.body ?? '').trim());
	const mediaUrl = $derived(String(slide.mediaUrl ?? '').trim());
	const mediaKind = $derived(slide.mediaKind ?? null);
	const playbackUrl = $derived(String(slide.reframedPlaybackUrl ?? '').trim() || mediaUrl);
	const trimStart = $derived(
		slide.reframedPlaybackUrl ? 0 : Math.max(0, Number(slide.clipStart) || 0),
	);
	const trimEnd = $derived.by(() => {
		if (slide.reframedPlaybackUrl) {
			const dur = Math.max(0.5, (Number(slide.sourceClipEnd) || Number(slide.clipEnd) || 0) - (Number(slide.sourceClipStart) || Number(slide.clipStart) || 0));
			return dur;
		}
		return Math.max(trimStart + 0.5, Number(slide.clipEnd) || 0);
	});

	const imageSrc = $derived(
		mediaKind !== 'video' && mediaUrl
			? mediaUrl
			: template === 'photoTopic'
				? PHOTO_TOPIC_DEFAULTS.imageUrl
				: template === 'photoCaption'
					? PHOTO_CAPTION_DEFAULTS.imageUrl
					: template === 'whiteMedia'
						? WHITE_MEDIA_DEFAULTS.imageUrl
						: template === 'imageQuote'
							? IMAGE_QUOTE_DEFAULTS.imageUrl
							: '',
	);

	const videoSrc = $derived(
		mediaKind === 'video' && playbackUrl ? playbackUrl : VIDEO_STORY_DEFAULTS.videoUrl,
	);
	const videoPoster = $derived(String(slide.mediaThumb ?? '').trim());

	const textCarouselBody = $derived.by(() => {
		if (headline && body) return `${headline}\n\n${body}`;
		return headline || body || TEXT_CAROUSEL_DEFAULTS.body;
	});

	const whiteBody = $derived.by(() => {
		if (headline && body) return `${headline}\n\n${body}`;
		if (template === 'whiteMedia') return headline || body || WHITE_MEDIA_DEFAULTS.body;
		return headline || body || WHITE_THREAD_DEFAULTS.body;
	});
</script>

<div
	class="bulk-preview"
	style="width:{width}px;height:{previewH}px"
	aria-hidden="true"
>
	{#if template === 'photoTopic' || template === 'photoCaption'}
		<PhotoStoryTemplate
			layout={template === 'photoCaption' ? 'caption' : 'topic'}
			backgroundImage={imageSrc || (template === 'photoCaption' ? PHOTO_CAPTION_DEFAULTS.imageUrl : PHOTO_TOPIC_DEFAULTS.imageUrl)}
			headline={headline === ' ' ? (template === 'photoCaption' ? PHOTO_CAPTION_DEFAULTS.headline : PHOTO_TOPIC_DEFAULTS.headline) : headline}
			body={body || (template === 'photoCaption' ? PHOTO_CAPTION_DEFAULTS.body : PHOTO_TOPIC_DEFAULTS.body)}
			headlineStyle={{ ...PHOTO_TOPIC_HEADLINE_STYLE }}
			bodyStyle={{ ...PHOTO_TOPIC_BODY_STYLE }}
			w={CANVAS_W}
			h={CANVAS_H}
			{scale}
			interactive={false}
			previewMode={true}
		/>
	{:else if template === 'textCarousel'}
		<TextCarouselTemplate
			name={TEXT_CAROUSEL_DEFAULTS.name}
			handle={TEXT_CAROUSEL_DEFAULTS.handle}
			text={textCarouselBody}
			canvasW={CANVAS_W}
			canvasH={CANVAS_H}
			{scale}
			interactive={false}
		/>
	{:else if template === 'whiteThread' || template === 'whiteMedia'}
		<WhitePostTemplate
			layout={template === 'whiteMedia' ? 'media' : 'thread'}
			name={template === 'whiteMedia' ? WHITE_MEDIA_DEFAULTS.name : WHITE_THREAD_DEFAULTS.name}
			handle={template === 'whiteMedia' ? WHITE_MEDIA_DEFAULTS.handle : WHITE_THREAD_DEFAULTS.handle}
			avatar={template === 'whiteMedia' ? WHITE_MEDIA_DEFAULTS.avatarUrl : WHITE_THREAD_DEFAULTS.avatarUrl}
			text={whiteBody}
			mediaImage={mediaUrl || WHITE_MEDIA_DEFAULTS.imageUrl}
			w={CANVAS_W}
			h={CANVAS_H}
			{scale}
			interactive={false}
			previewMode={true}
		/>
	{:else if isVideoStoryFamily(template)}
		<VideoStoryTemplate
			layout={videoLayoutForTemplate(template)}
			headline={
				template === 'videoFeature'
					? headline || VIDEO_FEATURE_DEFAULTS.headline
					: template === 'videoSource'
						? ensureFirstWordHighlight(headline || VIDEO_STORY_DEFAULTS.headline)
						: headline || VIDEO_STORY_DEFAULTS.headline
			}
			body={template === 'videoFeature' ? body || VIDEO_FEATURE_DEFAULTS.body : undefined}
			watermark={
				template === 'videoHook' ||
				template === 'videoCreator' ||
				template === 'videoPost' ||
				template === 'videoText' ||
				template === 'videoSource' ||
				template === 'videoFeature'
					? ''
					: VIDEO_STORY_DEFAULTS.watermark
			}
			profileName={
				template === 'videoPost'
					? VIDEO_POST_DEFAULTS.name
					: template === 'videoCreator'
						? VIDEO_CREATOR_DEFAULTS.name
						: undefined
			}
			profileHandle={
				template === 'videoPost'
					? VIDEO_POST_DEFAULTS.handle
					: template === 'videoCreator'
						? VIDEO_CREATOR_DEFAULTS.handle
						: undefined
			}
			videoSrc={videoSrc}
			videoPoster={videoPoster}
			videoMuted={true}
			videoTrimStartSec={trimStart}
			videoTrimEndSec={trimEnd}
			headlineStyle={
				template === 'videoFeature'
					? { ...VIDEO_FEATURE_HEADLINE_STYLE }
					: template === 'videoSource'
						? { ...VIDEO_SOURCE_HEADLINE_STYLE }
						: template === 'videoText'
							? { ...VIDEO_TEXT_HEADLINE_STYLE }
							: template === 'videoPost'
								? { ...VIDEO_POST_HEADLINE_STYLE }
								: template === 'videoCreator'
									? { ...VIDEO_CREATOR_HEADLINE_STYLE }
									: template === 'videoHook'
										? { ...VIDEO_HOOK_HEADLINE_STYLE }
										: undefined
			}
			bodyStyle={template === 'videoFeature' ? { ...VIDEO_FEATURE_BODY_STYLE } : undefined}
			highlightColor={
				template === 'videoFeature'
					? VIDEO_FEATURE_DEFAULTS.highlightColor
					: template === 'videoSource'
						? VIDEO_SOURCE_DEFAULTS.highlightColor
						: '#F5A623'
			}
			w={CANVAS_W}
			h={CANVAS_H}
			{scale}
			interactive={false}
			previewMode={true}
		/>
	{:else if template === 'blackText'}
		<BlackTextCarouselTemplate
			headline={headline === ' ' ? BLACK_TEXT_CAROUSEL_DEFAULTS.headline : headline}
			body={body || BLACK_TEXT_CAROUSEL_DEFAULTS.body}
			backgroundImage={mediaUrl}
			canvasW={CANVAS_W}
			canvasH={CANVAS_H}
			{scale}
			interactive={false}
		/>
	{:else if template === 'imageQuote'}
		<ImageQuoteTemplate
			image={mediaUrl || IMAGE_QUOTE_DEFAULTS.imageUrl}
			text={headline === ' ' ? IMAGE_QUOTE_DEFAULTS.body : headline}
			footerLeft={IMAGE_QUOTE_DEFAULTS.footerLeft}
			footerRight={IMAGE_QUOTE_DEFAULTS.footerRight}
			topRatio={IMAGE_QUOTE_DEFAULTS.topRatio}
			templateTheme="dark"
			bgColor="#000000"
			textColor="#ffffff"
			canvasW={CANVAS_W}
			canvasH={CANVAS_H}
			{scale}
			interactive={false}
		/>
	{:else if template === 'news'}
		<NewsTemplate
			text={newsTemplateText}
			subtext={body}
			source={NEWS_DEFAULT_SOURCE}
			backgroundImage={mediaKind !== 'video' ? mediaUrl : ''}
			backgroundVideo={mediaKind === 'video' ? playbackUrl : ''}
			videoMuted={true}
			videoTrimStartSec={mediaKind === 'video' ? trimStart : 0}
			videoTrimEndSec={mediaKind === 'video' ? trimEnd : 0}
			highlightColor="#F5A623"
			textColor="#FFFFFF"
			templateTheme="dark"
			allowCircle={false}
			showCircle2={false}
			bgFitMode="cover"
			bgZoom={100}
			w={CANVAS_W}
			h={CANVAS_H}
			{scale}
			interactive={false}
		/>
	{:else if template === 'tweet'}
		<TweetTemplate
			topText={headline === ' ' ? '' : headline}
			bottomText={body}
			canvasW={CANVAS_W}
			canvasH={CANVAS_H}
			{scale}
			interactive={false}
		/>
	{:else}
		<div class="blank-slide" style="width:{width}px;height:{previewH}px">
			<p>{headline.trim() || 'Blank'}</p>
		</div>
	{/if}
</div>

<style>
	.bulk-preview {
		position: relative;
		overflow: hidden;
		border-radius: 8px;
		background: #0a0a0c;
		box-shadow: 0 1px 4px rgba(0, 0, 0, 0.25);
		flex-shrink: 0;
		pointer-events: none;
		user-select: none;
	}
	.blank-slide {
		background: #111;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 0.5rem;
		box-sizing: border-box;
	}
	.blank-slide p {
		margin: 0;
		color: #f8fafc;
		font-size: 0.55rem;
		font-weight: 700;
		line-height: 1.15;
		text-align: center;
		word-break: break-word;
	}
</style>
