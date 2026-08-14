<script lang="ts">
	import type { BulkSlide } from '$lib/studio/bulk-to-studio';
	import { createBlankSlide } from '$lib/studio/bulk-to-studio';
	import {
		coerceTemplateId,
		isBrandStackFamily,
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
		BRAND_STACK_DEFAULTS,
		IMAGE_QUOTE_DEFAULTS,
		NEWS_DEFAULT_SOURCE,
		NEWS_HEADLINE_STYLE,
		NEWS_SUBTEXT_STYLE,
		PHOTO_CAPTION_DEFAULTS,
		PHOTO_TOPIC_DEFAULTS,
		PHOTO_TOPIC_BODY_STYLE,
		PHOTO_TOPIC_HEADLINE_STYLE,
		TEXT_CAROUSEL_DEFAULTS,
		TWEET_DEFAULTS,
		VIDEO_CREATOR_DEFAULTS,
		VIDEO_CREATOR_HEADLINE_STYLE,
		VIDEO_FEATURE_BODY_STYLE,
		VIDEO_FEATURE_DEFAULTS,
		VIDEO_FEATURE_HEADLINE_STYLE,
		VIDEO_HOOK_DEFAULTS,
		VIDEO_HOOK_HEADLINE_STYLE,
		VIDEO_POST_DEFAULTS,
		VIDEO_POST_HEADLINE_STYLE,
		VIDEO_SOURCE_DEFAULTS,
		VIDEO_SOURCE_HEADLINE_STYLE,
		VIDEO_STORY_DEFAULTS,
		VIDEO_SPLIT_DEFAULTS,
		VIDEO_TEXT_DEFAULTS,
		VIDEO_TEXT_HEADLINE_STYLE,
		WHITE_MEDIA_DEFAULTS,
		WHITE_THREAD_DEFAULTS,
	} from '$lib/studio/slide-content-defaults';
	import { ensureFirstWordHighlight } from '$lib/video-clips/video-hook';
	import { stripMarkup, type HighlightDefaults } from '$lib/highlight';
	import { DEFAULT_BRAND_KIT } from '$lib/studio/brand-kit';
	import { optimizeImageUrl, preloadImage } from '$lib/client/optimize-image-url';
	import { Loader2 } from 'lucide-svelte';

	import PhotoStoryTemplate from '$lib/components/templates/PhotoStoryTemplate.svelte';
	import TextCarouselTemplate from '$lib/components/templates/TextCarouselTemplate.svelte';
	import WhitePostTemplate from '$lib/components/templates/WhitePostTemplate.svelte';
	import VideoStoryTemplate from '$lib/components/templates/VideoStoryTemplate.svelte';
	import VideoSplitTemplate from '$lib/components/templates/VideoSplitTemplate.svelte';
	import BrandStackTemplate from '$lib/components/templates/BrandStackTemplate.svelte';
	import BlackTextCarouselTemplate from '$lib/components/templates/BlackTextCarouselTemplate.svelte';
	import ImageQuoteTemplate from '$lib/components/templates/ImageQuoteTemplate.svelte';
	import NewsTemplate from '$lib/components/templates/NewsTemplate.svelte';
	import TweetTemplate from '$lib/components/templates/TweetTemplate.svelte';
	import VideoCaptionOverlay from '$lib/components/video-clips/VideoCaptionOverlay.svelte';
	import { resolveStudioCaptionImportForSlide } from '$lib/video-clips/clip-captions';
	import { getCaptionTemplate } from '$lib/video-clips/caption-templates';
	import {
		segmentsToPhrases,
		getActivePhrase,
		getActiveWordIndex,
		type CaptionPhrase,
	} from '$lib/video-clips/caption-chunking';
	import { onDestroy } from 'svelte';

	type Props = {
		slide?: BulkSlide | null;
		/** Preview width in CSS px */
		width?: number;
		/** Parent is still resolving stock / media URL */
		mediaFetching?: boolean;
		/** Prefer mediaThumb for small filmstrip previews */
		preferThumb?: boolean;
		/**
		 * When false, strip `[[…]]` markup and skip first-word highlight injection
		 * so News / video layouts render plain text.
		 */
		textHighlightsEnabled?: boolean;
		/** Optional News source logo when slide is in logo mode. */
		sourceLogoSrc?: string;
		/** Brand-kit highlight paint for bare `[[phrase]]` (Settings → Branding). */
		highlightColor?: string;
		highlightDefaults?: HighlightDefaults;
	};

	let {
		slide: slideProp = null,
		width = 96,
		mediaFetching = false,
		preferThumb = false,
		textHighlightsEnabled = true,
		sourceLogoSrc = '',
		highlightColor = DEFAULT_BRAND_KIT.highlightColor,
		highlightDefaults,
	}: Props = $props();

	const resolvedHighlightColor = $derived(
		String(highlightDefaults?.color ?? highlightColor ?? DEFAULT_BRAND_KIT.highlightColor).trim() ||
			DEFAULT_BRAND_KIT.highlightColor,
	);
	const resolvedHighlightDefaults = $derived(
		highlightDefaults ?? { color: resolvedHighlightColor },
	);

	const slide = $derived(slideProp ?? createBlankSlide('news'));
	const previewMuted = $derived(slide.videoMuted !== false);

	function maybeStrip(text: string): string {
		return textHighlightsEnabled ? text : stripMarkup(text);
	}

	/** Video / reframed clips preview in the matching Studio format (usually 9:16). */
	const previewFormat = $derived.by(() => {
		const tid = coerceTemplateId(slide.template);
		if (isVideoSplitFamily(tid) || isBrandStackFamily(tid)) return 'vertical' as const;
		if (slide.mediaKind === 'video' || isVideoStoryFamily(tid)) {
			const aspect =
				parseReframeAspectFromSettingsKey(slide.reframeSettingsKey) ??
				(slide.reframedPlaybackUrl ? '9:16' : null);
			return studioFormatForReframeAspect(aspect ?? '9:16');
		}
		return 'feed' as const;
	});
	const canvasSize = $derived(
		slide.mediaKind === 'video' ||
			isVideoSplitFamily(coerceTemplateId(slide.template)) ||
			isBrandStackFamily(coerceTemplateId(slide.template)) ||
			isVideoStoryFamily(coerceTemplateId(slide.template))
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
		const text = raw || (headline !== ' ' ? headline : 'YOUR HEADLINE');
		return maybeStrip(text);
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

	const videoSrc = $derived.by(() => {
		if (mediaKind === 'video' && playbackUrl) return playbackUrl;
		// Poster-only still (capture covers / empty clip URL with thumb).
		if (mediaKind === 'video' && mediaThumb && !playbackUrl) return '';
		return VIDEO_STORY_DEFAULTS.videoUrl;
	});
	const videoPoster = $derived(
		optimizeImageUrl(String(slide.mediaThumb ?? '').trim(), fetchW) ||
			optimizeImageUrl(String(VIDEO_STORY_DEFAULTS.posterUrl ?? '').trim(), fetchW),
	);

	const textCarouselBody = $derived.by(() => {
		const h = headline.trim();
		const b = body.trim();
		if (h && b) return `${h}\n\n${b}`;
		return h || b || TEXT_CAROUSEL_DEFAULTS.body;
	});

	const whiteBody = $derived.by(() => {
		const h = headline.trim();
		const b = body.trim();
		if (h && b) return `${h}\n\n${b}`;
		if (template === 'whiteMedia') return h || b || WHITE_MEDIA_DEFAULTS.body;
		return h || b || WHITE_THREAD_DEFAULTS.body;
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

	const captionImport = $derived(resolveStudioCaptionImportForSlide(slide));
	const captionTemplate = $derived(
		captionImport ? getCaptionTemplate(captionImport.templateId) : getCaptionTemplate('capcut-pop'),
	);
	const captionPhrases = $derived.by(() => {
		if (!captionImport?.enabled || !captionImport.segments?.length) return [] as CaptionPhrase[];
		const chunk = captionImport.wordsPerChunk ?? captionTemplate.wordsPerChunk;
		return segmentsToPhrases(captionImport.segments, chunk);
	});
	const showCaptions = $derived(
		!!captionImport?.enabled && captionPhrases.length > 0 && mediaKind === 'video' && !preferThumb,
	);

	let previewRootEl = $state<HTMLElement | null>(null);
	let captionTime = $state(0);
	let captionPhrase = $state<CaptionPhrase | null>(null);
	let captionWordIndex = $state(-1);
	let captionRaf: number | null = null;

	$effect(() => {
		if (!showCaptions) {
			if (captionRaf != null) cancelAnimationFrame(captionRaf);
			captionRaf = null;
			captionPhrase = null;
			captionWordIndex = -1;
			return;
		}
		const phrases = captionPhrases;
		const tick = () => {
			const v = previewRootEl?.querySelector?.('video') as HTMLVideoElement | null | undefined;
			if (v && phrases.length) {
				const t = v.currentTime;
				const phrase = getActivePhrase(phrases, t);
				captionTime = t;
				captionPhrase = phrase;
				captionWordIndex = phrase ? getActiveWordIndex(phrase, t) : -1;
			}
			captionRaf = requestAnimationFrame(tick);
		};
		captionRaf = requestAnimationFrame(tick);
		return () => {
			if (captionRaf != null) cancelAnimationFrame(captionRaf);
			captionRaf = null;
		};
	});

	onDestroy(() => {
		if (captionRaf != null) cancelAnimationFrame(captionRaf);
	});
</script>

<div
	class="bulk-preview"
	class:bulk-preview-loading={showSpinner}
	bind:this={previewRootEl}
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
				headline={maybeStrip(
					headline === ' '
						? template === 'photoCaption'
							? PHOTO_CAPTION_DEFAULTS.headline
							: PHOTO_TOPIC_DEFAULTS.headline
						: headline,
				)}
				body={maybeStrip(
					body ||
						(template === 'photoCaption' ? PHOTO_CAPTION_DEFAULTS.body : PHOTO_TOPIC_DEFAULTS.body),
				)}
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
				text={maybeStrip(textCarouselBody)}
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
				text={maybeStrip(whiteBody)}
				mediaImage={optimizeImageUrl(mediaUrl || WHITE_MEDIA_DEFAULTS.imageUrl, fetchW)}
				w={CANVAS_W}
				h={CANVAS_H}
				{scale}
				interactive={false}
				previewMode={true}
			/>
		{:else if isVideoSplitFamily(template)}
			<VideoSplitTemplate
				videoSrc={playbackUrl || (mediaThumb ? '' : VIDEO_SPLIT_DEFAULTS.videoUrl)}
				posterSrc={mediaThumb || '/placeholders/carousel/video-template-poster.jpg'}
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
						? maybeStrip(headline.trim() || VIDEO_FEATURE_DEFAULTS.headline)
						: template === 'videoSource'
							? textHighlightsEnabled
								? ensureFirstWordHighlight(headline.trim() || VIDEO_SOURCE_DEFAULTS.headline)
								: stripMarkup(headline.trim() || VIDEO_SOURCE_DEFAULTS.headline)
							: template === 'videoHook'
								? maybeStrip(headline.trim() || VIDEO_HOOK_DEFAULTS.headline)
								: template === 'videoCreator'
									? maybeStrip(headline.trim() || VIDEO_CREATOR_DEFAULTS.headline)
									: template === 'videoText'
										? maybeStrip(headline.trim() || VIDEO_TEXT_DEFAULTS.headline)
										: template === 'videoPost'
											? maybeStrip(headline.trim() || VIDEO_POST_DEFAULTS.headline)
											: maybeStrip(headline.trim() || VIDEO_STORY_DEFAULTS.headline)
				}
				body={
					template === 'videoFeature'
						? maybeStrip(body || VIDEO_FEATURE_DEFAULTS.body)
						: undefined
				}
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
				videoMuted={previewMuted}
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
				highlightColor={resolvedHighlightColor}
				w={CANVAS_W}
				h={CANVAS_H}
				{scale}
				interactive={false}
				previewMode={true}
			/>
		{:else if template === 'blackText'}
			<BlackTextCarouselTemplate
				headline={maybeStrip(headline === ' ' ? BLACK_TEXT_CAROUSEL_DEFAULTS.headline : headline)}
				body={maybeStrip(body || BLACK_TEXT_CAROUSEL_DEFAULTS.body)}
				backgroundImage={imageSrc}
				canvasW={CANVAS_W}
				canvasH={CANVAS_H}
				{scale}
				interactive={false}
			/>
		{:else if template === 'imageQuote'}
			<ImageQuoteTemplate
				image={imageSrc || IMAGE_QUOTE_DEFAULTS.imageUrl}
				text={maybeStrip(headline === ' ' ? IMAGE_QUOTE_DEFAULTS.body : headline)}
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
				subtext={maybeStrip(body)}
				source={NEWS_DEFAULT_SOURCE}
				sourceLogoSrc={String(sourceLogoSrc ?? '').trim()}
				sourceLabelMode={String(sourceLogoSrc ?? '').trim() ? 'logo' : 'text'}
				sourceLogoWidth={160}
				backgroundImage={
					mediaKind === 'video'
						? playbackUrl
							? ''
							: optimizeImageUrl(mediaThumb, fetchW)
						: imageSrc
				}
				backgroundVideo={mediaKind === 'video' && playbackUrl ? playbackUrl : ''}
				videoMuted={previewMuted}
				videoTrimStartSec={mediaKind === 'video' ? trimStart : 0}
				videoTrimEndSec={mediaKind === 'video' ? trimEnd : 0}
				highlightColor={resolvedHighlightColor}
				highlightDefaults={resolvedHighlightDefaults}
				textColor="#FFFFFF"
				templateTheme="dark"
				allowCircle={false}
				showCircle2={false}
				bgFitMode="cover"
				bgZoom={100}
				bgOffsetX={50}
				bgOffsetY={50}
				shadowHeight={58}
				shadowStrength={0.88}
				shadowCurve="natural"
				headlineStyle={{ ...NEWS_HEADLINE_STYLE }}
				subtextStyle={{ ...NEWS_SUBTEXT_STYLE }}
				w={CANVAS_W}
				h={CANVAS_H}
				{scale}
				interactive={false}
			/>
		{:else if template === 'tweet'}
			<TweetTemplate
				topText={headline === ' ' ? TWEET_DEFAULTS.topText : headline}
				bottomText={body.trim() || TWEET_DEFAULTS.bottomText}
				canvasW={CANVAS_W}
				canvasH={CANVAS_H}
				{scale}
				interactive={false}
			/>
		{:else if isBrandStackFamily(template)}
			<BrandStackTemplate
				headline={headline === ' ' ? BRAND_STACK_DEFAULTS.headline : headline}
				watermark={BRAND_STACK_DEFAULTS.watermark}
				brand={BRAND_STACK_DEFAULTS.brand}
				topVideoSrc={playbackUrl || ''}
				topImageSrc={!playbackUrl ? (mediaThumb || '/placeholders/carousel/video-template-poster.jpg') : ''}
				bottomMediaSrc={BRAND_STACK_DEFAULTS.bottomMediaUrl}
				w={CANVAS_W}
				h={CANVAS_H}
				{scale}
				interactive={false}
				previewMode={true}
				videoMuted={previewMuted}
				videoTrimStartSec={trimStart}
				videoTrimEndSec={trimEnd}
			/>
		{:else}
			<div class="blank-slide" style="width:{width}px;height:{previewH}px">
				<p>{headline.trim() || 'Blank'}</p>
			</div>
		{/if}
	{/if}

	{#if showCaptions}
		<div
			class="bulk-caption-layer"
			style="width:{CANVAS_W}px;height:{CANVAS_H}px;transform:scale({scale});transform-origin:top left;"
			aria-hidden="true"
		>
			<VideoCaptionOverlay
				phrase={captionPhrase}
				currentTime={captionTime}
				activeWordIndex={captionWordIndex}
				template={captionTemplate}
				enabled={true}
				position={captionImport?.position ?? 'bottom'}
				customColor={captionImport?.customColor}
				customBgColor={captionImport?.customBgColor}
				customFontSize={captionImport?.fontSize}
				customHighlightColor={captionImport?.customHighlightColor}
				animationOverride={captionImport?.animationOverride}
				strokeEnabled={captionImport?.strokeEnabled ?? true}
				draggable={false}
				customX={captionImport?.customX ?? null}
				customY={captionImport?.customY ?? null}
			/>
		</div>
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
	.bulk-caption-layer {
		position: absolute;
		left: 0;
		top: 0;
		z-index: 5;
		pointer-events: none;
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
