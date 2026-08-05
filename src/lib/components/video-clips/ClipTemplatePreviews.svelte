<script lang="ts">
	import NewsTemplate from '$lib/components/templates/NewsTemplate.svelte';
	import ImageQuoteTemplate from '$lib/components/templates/ImageQuoteTemplate.svelte';
	import VideoStoryTemplate from '$lib/components/templates/VideoStoryTemplate.svelte';
	import TweetTemplate from '$lib/components/templates/TweetTemplate.svelte';
	import TextCarouselTemplate from '$lib/components/templates/TextCarouselTemplate.svelte';
	import BlankTemplate from '$lib/components/templates/BlankTemplate.svelte';
	import BlackTextCarouselTemplate from '$lib/components/templates/BlackTextCarouselTemplate.svelte';
	import type { VideoClip, VideoImportMeta } from '$lib/video-clips/types';
	import {
		buildClipTemplateCopy,
		clipDirectVideoUrl,
		clipVideoMediaFragment,
		studioImportMediaForClip,
		shiftCaptionImportTimes,
	} from '$lib/video-clips/clip-template-copy';
	import {
		NEWS_DEFAULT_SOURCE,
		TWEET_DEFAULTS,
		VIDEO_STORY_DEFAULTS,
		VIDEO_HOOK_HEADLINE_STYLE,
		VIDEO_CREATOR_DEFAULTS,
		VIDEO_CREATOR_HEADLINE_STYLE,
		VIDEO_POST_DEFAULTS,
		VIDEO_POST_HEADLINE_STYLE,
		VIDEO_TEXT_HEADLINE_STYLE,
		VIDEO_SOURCE_DEFAULTS,
		VIDEO_SOURCE_HEADLINE_STYLE,
		VIDEO_FEATURE_DEFAULTS,
		VIDEO_FEATURE_HEADLINE_STYLE,
		VIDEO_FEATURE_BODY_STYLE,
		BLACK_TEXT_CAROUSEL_DEFAULTS,
		IMAGE_QUOTE_DEFAULTS,
	} from '$lib/studio/slide-content-defaults';
	import { ensureFirstWordHighlight } from '$lib/video-clips/video-hook';
	import {
		STUDIO_FEED_CANVAS,
		studioFeedPreviewScale,
		studioFeedPreviewHeight,
	} from '$lib/studio/clip-preview-canvas';
	import {
		parseReframeAspectFromSettingsKey,
		studioFormatForReframeAspect,
	} from '$lib/video-clips/reframe';
	import {
		stashStudioClipImport,
		studioUrlForClipImport,
		type StudioClipCaptionImport,
	} from '$lib/studio/clip-import';
	import { markVideoSessionForResume } from '$lib/video-clips/session-cache';
	import { STUDIO_TEMPLATES, coerceTemplateId, videoLayoutForTemplate, isVideoStoryFamily } from '$lib/studio/template-ids';
	import { ExternalLink, Layout } from 'lucide-svelte';

	interface Props {
		clip: VideoClip;
		source: VideoImportMeta;
		watermark?: string;
		topicHint?: string;
		/** Captions from Videos page — transferred into Studio when set. */
		captions?: StudioClipCaptionImport | null;
	}

	let { clip, source, watermark = '', topicHint = '', captions = null }: Props = $props();

	const PREVIEW_W = 240;
	const CANVAS_W = STUDIO_FEED_CANVAS.w;
	const CANVAS_H = STUDIO_FEED_CANVAS.h;
	const scale = studioFeedPreviewScale(PREVIEW_W);
	const PREVIEW_H = studioFeedPreviewHeight(PREVIEW_W);

	const copy = $derived(buildClipTemplateCopy(clip, source, { watermark, topicHint }));
	const directVideo = $derived(clipDirectVideoUrl(source));
	const thumb = $derived(source.thumbnailUrl ?? '');
	const hasVideo = $derived(!!directVideo);

	const videoSrc = $derived(
		hasVideo ? clipVideoMediaFragment(directVideo, clip.startSec, clip.endSec) : '',
	);

	const videoProps = $derived({
		videoSeekSec: clip.startSec,
		videoTrimStartSec: clip.startSec,
		videoTrimEndSec: clip.endSec,
		videoMuted: true,
	});

	const storyWatermark = $derived(
		watermark.trim() || topicHint.trim() || VIDEO_STORY_DEFAULTS.watermark,
	);

	const templates = STUDIO_TEMPLATES;

	/** Stash clip media + headlines, then navigate (signed URLs are too long for query params). */
	function openInStudio(templateRaw: string) {
		const template = coerceTemplateId(templateRaw);
		const media = studioImportMediaForClip(clip, source);
		const videoUrl = media.videoUrl;
		const looksYoutube = /youtube\.com\/embed|youtu\.be\//i.test(videoUrl);
		const caps = shiftCaptionImportTimes(captions ?? null, media.captionTimeOffsetSec);
		if (videoUrl && !looksYoutube) {
			const formatId = studioFormatForReframeAspect(
				parseReframeAspectFromSettingsKey(clip.reframeSettingsKey) ?? '9:16',
			);
			stashStudioClipImport({
				template,
				videoUrl,
				clipStart: media.clipStart,
				clipEnd: media.clipEnd,
				thumbnailUrl: thumb || undefined,
				newsHeadline: copy.newsHeadline,
				newsSource: copy.newsSource,
				storyHeadline: copy.storyHeadline,
				videoHook: copy.videoHook,
				storyWatermark: copy.storyWatermark || storyWatermark,
				tweetTop: copy.tweetTop,
				tweetBottom: copy.tweetBottom,
				carouselName: copy.carouselName,
				carouselHandle: copy.carouselHandle,
				carouselBody: copy.carouselBody,
				captions: caps,
				formatId,
				usedReframe: media.usedReframe,
			});
		} else {
			console.warn('[videos] Edit in Studio: no direct video URL to import', {
				hasDirect: !!directVideo,
				usedReframe: media.usedReframe,
				r2Key: !!source.r2Key,
			});
		}
		markVideoSessionForResume();
		window.location.href = studioUrlForClipImport(template);
	}
</script>

<section class="clip-template-previews" aria-label="Template previews for selected clip">
	<div class="previews-header">
		<Layout size={16} class="previews-icon" />
		<div>
			<h3 class="previews-title">How this clip could look</h3>
			<p class="previews-sub">
				{#if hasVideo}
					Live preview · clip {Math.floor(clip.startSec)}s–{Math.floor(clip.endSec)}s · open in any
					Studio template
				{:else}
					Layout preview · download the full video to see it with your clip
				{/if}
			</p>
		</div>
	</div>

	<div class="previews-grid">
		{#each templates as t, i (t.id)}
			<article class="preview-card" style="--card-i: {i}">
				<span class="preview-label">{t.label}</span>
				<div
					class="preview-frame"
					style="width:{PREVIEW_W}px;height:{PREVIEW_H}px"
				>
					{#if t.id === 'news'}
						<NewsTemplate
							text={copy.newsHeadline}
							source={copy.newsSource || NEWS_DEFAULT_SOURCE}
							backgroundImage={hasVideo ? '' : thumb}
							backgroundVideo={videoSrc}
							{...videoProps}
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
					{:else if t.id === 'imageQuote'}
						<ImageQuoteTemplate
							image={hasVideo ? IMAGE_QUOTE_DEFAULTS.imageUrl : (thumb || IMAGE_QUOTE_DEFAULTS.imageUrl)}
							text={copy.newsHeadline || IMAGE_QUOTE_DEFAULTS.body}
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
					{:else if isVideoStoryFamily(t.id)}
						<VideoStoryTemplate
							layout={videoLayoutForTemplate(t.id)}
							headline={
								t.id === 'videoFeature'
									? copy.videoHook || copy.storyHeadline || VIDEO_FEATURE_DEFAULTS.headline
									: t.id === 'videoSource'
										? ensureFirstWordHighlight(copy.videoHook || copy.storyHeadline)
										: t.id === 'videoHook' ||
											  t.id === 'videoCreator' ||
											  t.id === 'videoPost' ||
											  t.id === 'videoText'
											? copy.videoHook || copy.storyHeadline
											: copy.storyHeadline
							}
							body={
								t.id === 'videoFeature'
									? copy.carouselBody || copy.tweetBottom || VIDEO_FEATURE_DEFAULTS.body
									: undefined
							}
							watermark={
								t.id === 'videoSource' ||
								t.id === 'videoHook' ||
								t.id === 'videoCreator' ||
								t.id === 'videoPost' ||
								t.id === 'videoText' ||
								t.id === 'videoFeature'
									? ''
									: storyWatermark
							}
							profileName={
								t.id === 'videoPost'
									? copy.carouselName || VIDEO_POST_DEFAULTS.name
									: copy.carouselName || VIDEO_CREATOR_DEFAULTS.name
							}
							profileHandle={
								t.id === 'videoPost'
									? copy.carouselHandle || VIDEO_POST_DEFAULTS.handle
									: copy.carouselHandle || VIDEO_CREATOR_DEFAULTS.handle
							}
							profileAvatar={thumb || (t.id === 'videoPost' ? VIDEO_POST_DEFAULTS.avatarUrl : '')}
							videoSrc={videoSrc}
							videoPoster={thumb}
							{...videoProps}
							highlightColor={
								t.id === 'videoFeature'
									? VIDEO_FEATURE_DEFAULTS.highlightColor
									: t.id === 'videoSource'
										? VIDEO_SOURCE_DEFAULTS.highlightColor
										: '#F5A623'
							}
							headlineStyle={
								t.id === 'videoFeature'
									? { ...VIDEO_FEATURE_HEADLINE_STYLE }
									: t.id === 'videoSource'
										? { ...VIDEO_SOURCE_HEADLINE_STYLE }
										: t.id === 'videoText'
											? { ...VIDEO_TEXT_HEADLINE_STYLE }
											: t.id === 'videoPost'
												? { ...VIDEO_POST_HEADLINE_STYLE }
											: t.id === 'videoCreator'
												? { ...VIDEO_CREATOR_HEADLINE_STYLE }
												: t.id === 'videoHook'
													? { ...VIDEO_HOOK_HEADLINE_STYLE }
													: undefined
							}
							bodyStyle={t.id === 'videoFeature' ? { ...VIDEO_FEATURE_BODY_STYLE } : undefined}
							w={CANVAS_W}
							h={CANVAS_H}
							{scale}
							interactive={false}
							previewMode={true}
						/>
					{:else if t.id === 'tweet'}
						<TweetTemplate
							topName={TWEET_DEFAULTS.topName}
							topHandle={TWEET_DEFAULTS.topHandle}
							topText={copy.tweetTop}
							topImage={hasVideo ? '' : thumb}
							topVideo={videoSrc}
							videoSeekSec={clip.startSec}
							videoTrimStartSec={clip.startSec}
							videoTrimEndSec={clip.endSec}
							bottomName={TWEET_DEFAULTS.bottomName}
							bottomHandle={TWEET_DEFAULTS.bottomHandle}
							bottomText={copy.tweetBottom || TWEET_DEFAULTS.bottomText}
							replyCount={TWEET_DEFAULTS.replyCount}
							repostCount={TWEET_DEFAULTS.repostCount}
							likeCount={TWEET_DEFAULTS.likeCount}
							topImageHeight={TWEET_DEFAULTS.topImageHeight}
							topImageWidth={TWEET_DEFAULTS.topImageWidth}
							topImageZoom={TWEET_DEFAULTS.topImageZoom}
							topImagePanX={TWEET_DEFAULTS.topImagePanX}
							topImagePanY={TWEET_DEFAULTS.topImagePanY}
							canvasW={CANVAS_W}
							canvasH={CANVAS_H}
							{scale}
							interactive={false}
							templateTheme="dark"
						/>
					{:else if t.id === 'textCarousel'}
						<TextCarouselTemplate
							name={copy.carouselName}
							handle={copy.carouselHandle}
							text={copy.carouselBody}
							templateTheme="dark"
							canvasW={CANVAS_W}
							canvasH={CANVAS_H}
							{scale}
							interactive={false}
							showSwipe={true}
						/>
					{:else if t.id === 'blank'}
						<BlankTemplate
							backgroundImage={hasVideo ? '' : thumb}
							backgroundVideo={videoSrc}
							solidBackgroundColor="#0a0a0a"
							w={CANVAS_W}
							h={CANVAS_H}
							{scale}
							interactive={false}
						/>
					{:else if t.id === 'blackText'}
						<BlackTextCarouselTemplate
							backgroundImage=""
							name={BLACK_TEXT_CAROUSEL_DEFAULTS.name}
							handle={BLACK_TEXT_CAROUSEL_DEFAULTS.handle}
							headline={copy.storyHeadline || copy.newsHeadline}
							body={copy.carouselBody || copy.tweetBottom}
							headlineColor={BLACK_TEXT_CAROUSEL_DEFAULTS.headlineColor}
							canvasW={CANVAS_W}
							canvasH={CANVAS_H}
							{scale}
							interactive={false}
							showSwipe={true}
						/>
					{:else}
						<NewsTemplate
							text={copy.newsHeadline}
							source={copy.newsSource || NEWS_DEFAULT_SOURCE}
							backgroundImage={hasVideo ? '' : thumb}
							backgroundVideo={videoSrc}
							{...videoProps}
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
					{/if}
				</div>
				<button type="button" class="preview-studio-link" onclick={() => openInStudio(t.id)}>
					<ExternalLink size={12} />
					Edit in Studio
				</button>
			</article>
		{/each}
	</div>
</section>

<style>
	.clip-template-previews {
		margin-top: 2.5rem;
		padding-top: 2rem;
		border-top: 1px solid var(--app-border, rgba(0, 0, 0, 0.08));
		grid-column: 1 / -1;
	}

	.previews-header {
		display: flex;
		align-items: flex-start;
		gap: 0.65rem;
		margin-bottom: 1.5rem;
	}

	:global(.previews-icon) {
		color: var(--app-text-3, rgba(15, 23, 42, 0.38));
		flex-shrink: 0;
		margin-top: 3px;
	}

	.previews-title {
		margin: 0 0 0.25rem;
		font-size: 1.1rem;
		font-weight: 800;
		letter-spacing: -0.025em;
	}

	.previews-sub {
		margin: 0;
		font-size: 0.82rem;
		color: var(--app-text-muted, rgba(15, 23, 42, 0.52));
		line-height: 1.5;
	}

	.previews-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
		gap: 1.5rem;
		align-items: start;
	}

	.preview-card {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.65rem;
		min-width: 0;
		animation: preview-enter 0.4s calc(var(--card-i, 0) * 0.07s) ease both;
	}

	@keyframes preview-enter {
		from {
			opacity: 0;
			transform: translateY(12px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	.preview-label {
		font-size: 0.75rem;
		font-weight: 700;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: var(--app-text-muted, rgba(15, 23, 42, 0.55));
	}

	.preview-frame {
		position: relative;
		overflow: hidden;
		border-radius: 12px;
		box-shadow: 0 8px 28px rgba(15, 23, 42, 0.12);
		background: #0a0a0a;
	}

	.preview-studio-link {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		padding: 0.4rem 0.75rem;
		border-radius: 8px;
		border: 1px solid var(--app-border, rgba(15, 23, 42, 0.12));
		background: var(--app-surface, #fff);
		color: var(--app-text, #0f172a);
		font-size: 0.78rem;
		font-weight: 600;
		cursor: pointer;
	}

	.preview-studio-link:hover {
		border-color: var(--app-text, #0f172a);
	}
</style>
