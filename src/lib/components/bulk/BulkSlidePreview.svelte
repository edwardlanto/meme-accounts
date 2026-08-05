<script lang="ts">
	import type { BulkSlide } from '$lib/studio/bulk-to-studio';
	import { createBlankSlide } from '$lib/studio/bulk-to-studio';
	import {
		coerceTemplateId,
		isVideoStoryFamily,
		isVideoSplitFamily,
		videoLayoutForTemplate,
	} from '$lib/studio/template-ids';
	import {
		STUDIO_FEED_CANVAS,
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
		VIDEO_SPLIT_DEFAULTS,
		VIDEO_TEXT_HEADLINE_STYLE,
		WHITE_MEDIA_DEFAULTS,
		WHITE_THREAD_DEFAULTS,
	} from '$lib/studio/slide-content-defaults';
	import { ensureFirstWordHighlight } from '$lib/video-clips/video-hook';
	import { optimizeImageUrl, preloadImage } from '$lib/client/optimize-image-url';
	import { Loader2 } from 'lucide-svelte';

	import PhotoStoryTemplate from '$lib/components/templates/PhotoStoryTemplate.svelte';
	import TextCarouselTemplate from '$lib/components/templates/TextCarouselTemplate.svelte';
	import WhitePostTemplate from '$lib/components/templates/WhitePostTemplate.svelte';
	import VideoStoryTemplate from '$lib/components/templates/VideoStoryTemplate.svelte';
	import VideoSplitTemplate from '$lib/components/templates/VideoSplitTemplate.svelte';
	import BlackTextCarouselTemplate from '$lib/components/templates/BlackTextCarouselTemplate.svelte';
	import ImageQuoteTemplate from '$lib/components/templates/ImageQuoteTemplate.svelte';
	import NewsTemplate from '$lib/components/templates/NewsTemplate.svelte';
	import TweetTemplate from '$lib/components/templates/TweetTemplate.svelte';

	type Props = {
		slide?: BulkSlide | null;
		/** Preview width in CSS px */
		width?: number;
		/** Parent is still resolving stock / media URL */
		mediaFetching?: boolean;
		/** Prefer mediaThumb for small filmstrip previews */
		preferThumb?: boolean;
	};

	let {
		slide: slideProp = null,
		width = 96,
		mediaFetching = false,
		preferThumb = false,
	}: Props = $props();

	const slide = $derived(slideProp ?? createBlankSlide('news'));

	/** Video / reframed clips preview in the matching Studio format (usually 9:16). */
	const previewFormat = $derived.by(() => {
		if (isVideoSplitFamily(coerceTemplateId(slide.template))) return 'vertical' as const;
		if (slide.mediaKind === 'video') {
			const aspect =
				parseReframeAspectFromSettingsKey(slide.reframeSettingsKey) ??
				(slide.reframedPlaybackUrl ? '9:16' : null);
			return studioFormatForReframeAspect(aspect ?? '9:16');
		}
		return 'feed' as const;
	});
	const canvasSize = $derived(
		slide.mediaKind === 'video' || isVideoSplitFamily(coerceTemplateId(slide.template))
			? canvasSizeForStudioFormat(previewFormat)
			: STUDIO_FEED_CANVAS,
	);
	const CANVAS_W = $derived(canvasSize.w);
	const CANVAS_H = $derived(canvasSize.h);
	const scale = $derived(studioPreviewScale(width, CANVAS_W));
	const previewH = $derived(studioPreviewHeight(width, CANVAS_W, CANVAS_H));

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
	const mediaThumb = $derived(String(slide.mediaThumb ?? '').trim());
	const mediaKind = $derived(slide.mediaKind ?? null);
	const playbackUrl = $derived(String(slide.reframedPlaybackUrl ?? '').trim() || mediaUrl);
	const trimStart = $derived(
		slide.reframedPlaybackUrl ? 0 : Math.max(0, Number(slide.clipStart) || 0),
	);
	const trimEnd = $derived.by(() => {
		if (slide.reframedPlaybackUrl) {
			const dur = Math.max(
				0.5,
				(Number(slide.sourceClipEnd) || Number(slide.clipEnd) || 0) -
					(Number(slide.sourceClipStart) || Number(slide.clipStart) || 0),
			);
			return dur;
		}
		return Math.max(trimStart + 0.5, Number(slide.clipEnd) || 0);
	});

	/** Target pixel width for CDN resize (2× CSS for retina). */
	const fetchW = $derived(Math.round(width * 2));

	const rawImageSrc = $derived.by(() => {
		if (mediaKind === 'video') return '';
		if (preferThumb && mediaThumb) return mediaThumb;
		if (mediaUrl) return mediaUrl;
		if (template === 'photoTopic') return PHOTO_TOPIC_DEFAULTS.imageUrl;
		if (template === 'photoCaption') return PHOTO_CAPTION_DEFAULTS.imageUrl;
		if (template === 'whiteMedia') return WHITE_MEDIA_DEFAULTS.imageUrl;
		if (template === 'imageQuote') return IMAGE_QUOTE_DEFAULTS.imageUrl;
		return '';
	});

	const imageSrc = $derived(optimizeImageUrl(rawImageSrc, fetchW));

	const videoSrc = $derived(
		mediaKind === 'video' && playbackUrl ? playbackUrl : VIDEO_STORY_DEFAULTS.videoUrl,
	);
	const videoPoster = $derived(optimizeImageUrl(String(slide.mediaThumb ?? '').trim(), fetchW));

	const textCarouselBody = $derived.by(() => {
		if (headline && body) return `${headline}\n\n${body}`;
		return headline || body || TEXT_CAROUSEL_DEFAULTS.body;
	});

	const whiteBody = $derived.by(() => {
		if (headline && body) return `${headline}\n\n${body}`;
		if (template === 'whiteMedia') return headline || body || WHITE_MEDIA_DEFAULTS.body;
		return headline || body || WHITE_THREAD_DEFAULTS.body;
	});

	const needsMediaWait = $derived(
		mediaFetching ||
			(mediaKind !== 'video' &&
				!!mediaUrl &&
				(template === 'photoTopic' ||
					template === 'photoCaption' ||
					template === 'whiteMedia' ||
					template === 'imageQuote' ||
					template === 'blackText' ||
					template === 'news')),
	);

	let imageReady = $state(false);
	let preloadToken = 0;

	$effect(() => {
		const fetching = mediaFetching;
		const src = imageSrc;
		const wait = needsMediaWait;
		const token = ++preloadToken;

		if (fetching) {
			imageReady = false;
			return;
		}
		if (!wait || !src) {
			imageReady = true;
			return;
		}

		imageReady = false;
		void preloadImage(src).then(() => {
			if (token === preloadToken) imageReady = true;
		});
	});

	const showSpinner = $derived(mediaFetching || (needsMediaWait && !imageReady));
</script>

<div
	class="bulk-preview"
	class:bulk-preview-loading={showSpinner}
	style="width:{width}px;height:{previewH}px"
	aria-hidden="true"
>
	{#if !mediaFetching}
		{#if template === 'photoTopic' || template === 'photoCaption'}
			<PhotoStoryTemplate
				layout={template === 'photoCaption' ? 'caption' : 'topic'}
				backgroundImage={imageSrc ||
					(template === 'photoCaption'
						? PHOTO_CAPTION_DEFAULTS.imageUrl
						: PHOTO_TOPIC_DEFAULTS.imageUrl)}
				headline={headline === ' '
					? template === 'photoCaption'
						? PHOTO_CAPTION_DEFAULTS.headline
						: PHOTO_TOPIC_DEFAULTS.headline
					: headline}
				body={body ||
					(template === 'photoCaption' ? PHOTO_CAPTION_DEFAULTS.body : PHOTO_TOPIC_DEFAULTS.body)}
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
				mediaImage={optimizeImageUrl(mediaUrl || WHITE_MEDIA_DEFAULTS.imageUrl, fetchW)}
				w={CANVAS_W}
				h={CANVAS_H}
				{scale}
				interactive={false}
				previewMode={true}
			/>
		{:else if isVideoSplitFamily(template)}
			<VideoSplitTemplate
				videoSrc={mediaUrl || VIDEO_SPLIT_DEFAULTS.videoUrl}
				autoflipComposited={String(slide.reframeSettingsKey ?? '').includes('|saliency|')}
				badgeLabel={VIDEO_SPLIT_DEFAULTS.badgeLabel}
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
				{videoSrc}
				{videoPoster}
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
				backgroundImage={imageSrc}
				canvasW={CANVAS_W}
				canvasH={CANVAS_H}
				{scale}
				interactive={false}
			/>
		{:else if template === 'imageQuote'}
			<ImageQuoteTemplate
				image={imageSrc || IMAGE_QUOTE_DEFAULTS.imageUrl}
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
				backgroundImage={mediaKind !== 'video' ? imageSrc : ''}
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
				bgOffsetX={50}
				bgOffsetY={50}
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
	{/if}

	{#if showSpinner}
		<div class="bulk-preview-spinner" aria-hidden="true">
			<Loader2 size={width < 80 ? 14 : 22} class="spin" />
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
	.bulk-preview-loading {
		background: #e8e8ea;
	}
	.bulk-preview-spinner {
		position: absolute;
		inset: 0;
		z-index: 6;
		display: flex;
		align-items: center;
		justify-content: center;
		background: color-mix(in oklab, #f0f0f2 88%, transparent);
		color: #64748b;
	}
	.bulk-preview-spinner :global(.spin) {
		animation: bulk-preview-spin 0.85s linear infinite;
	}
	@keyframes bulk-preview-spin {
		to {
			transform: rotate(360deg);
		}
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
