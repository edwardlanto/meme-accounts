<script lang="ts">
	import NewsTemplate from '$lib/components/templates/NewsTemplate.svelte';
	import VideoStoryTemplate from '$lib/components/templates/VideoStoryTemplate.svelte';
	import TweetTemplate from '$lib/components/templates/TweetTemplate.svelte';
	import TextCarouselTemplate from '$lib/components/templates/TextCarouselTemplate.svelte';
	import type { VideoClip, VideoImportMeta } from '$lib/video-clips/types';
	import {
		buildClipTemplateCopy,
		clipDirectVideoUrl,
		clipVideoMediaFragment,
	} from '$lib/video-clips/clip-template-copy';
	import {
		NEWS_DEFAULT_SOURCE,
		TWEET_DEFAULTS,
		VIDEO_STORY_DEFAULTS,
		ensureTextCarouselBodyMinLength,
	} from '$lib/studio/slide-content-defaults';
	import {
		STUDIO_FEED_CANVAS,
		studioFeedPreviewScale,
		studioFeedPreviewHeight,
	} from '$lib/studio/clip-preview-canvas';

	interface Props {
		clip: VideoClip;
		source: VideoImportMeta;
		watermark?: string;
		topicHint?: string;
	}

	let { clip, source, watermark = '', topicHint = '' }: Props = $props();

	/** Same width scaling as Studio carousel thumbs — native 4:5 feed canvas. */
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

	const carouselBody = $derived(
		ensureTextCarouselBodyMinLength(copy.carouselBody || copy.tweetTop),
	);

	const templates = [
		{ id: 'news', label: 'News', studio: 'news' },
		{ id: 'videoStory', label: 'Video story', studio: 'videoStory' },
		{ id: 'tweet', label: 'Tweet', studio: 'tweet' },
		{ id: 'textCarousel', label: 'Text carousel', studio: 'textCarousel' },
	] as const;
</script>

<section class="clip-template-previews" aria-label="Template previews for selected clip">
	<h3 class="previews-title">How this clip could look</h3>
	<p class="previews-sub">
		{#if hasVideo}
			Same templates as Studio (4:5 feed) · clip {Math.floor(clip.startSec)}s–{Math.floor(clip.endSec)}s
		{:else}
			Studio layout preview · thumbnail only until full video is downloaded
		{/if}
	</p>

	<div class="previews-grid">
		{#each templates as t (t.id)}
			<article class="preview-card">
				<span class="preview-label">{t.label}</span>
				<div class="preview-frame" style="width:{PREVIEW_W}px;height:{PREVIEW_H}px">
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
					{:else if t.id === 'videoStory'}
						<VideoStoryTemplate
							headline={copy.storyHeadline}
							watermark={storyWatermark}
							videoSrc={videoSrc}
							videoPoster={thumb}
							{...videoProps}
							highlightColor="#F5A623"
							w={CANVAS_W}
							h={CANVAS_H}
							{scale}
							interactive={false}
						/>
					{:else if t.id === 'tweet'}
						<TweetTemplate
							topName={TWEET_DEFAULTS.topName}
							topHandle={TWEET_DEFAULTS.topHandle}
							topText={copy.tweetTop}
							topImage={hasVideo ? '' : thumb}
							topVideo={videoSrc}
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
							text={carouselBody}
							templateTheme="dark"
							canvasW={CANVAS_W}
							canvasH={CANVAS_H}
							{scale}
							interactive={false}
							showSwipe={true}
						/>
					{/if}
				</div>
				<a class="preview-studio-link" href="/dashboard/studio?template={t.studio}">
					Edit in Studio
				</a>
			</article>
		{/each}
	</div>
</section>

<style>
	.clip-template-previews {
		margin-top: 2rem;
		padding-top: 1.75rem;
		border-top: 1px solid var(--app-border, rgba(0, 0, 0, 0.08));
		grid-column: 1 / -1;
	}

	.previews-title {
		margin: 0 0 0.35rem;
		font-size: 1.1rem;
		font-weight: 700;
		letter-spacing: -0.02em;
	}

	.previews-sub {
		margin: 0 0 1.35rem;
		font-size: 0.85rem;
		color: var(--app-text-muted, rgba(15, 23, 42, 0.55));
		line-height: 1.45;
		max-width: 42rem;
	}

	.previews-grid {
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		gap: 1.25rem;
		align-items: start;
	}

	@media (max-width: 1200px) {
		.previews-grid {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
	}

	@media (max-width: 560px) {
		.previews-grid {
			grid-template-columns: 1fr;
		}
	}

	.preview-card {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.6rem;
		min-width: 0;
	}

	.preview-label {
		font-size: 0.7rem;
		font-weight: 700;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--app-text-muted, rgba(15, 23, 42, 0.45));
	}

	.preview-frame {
		overflow: hidden;
		border-radius: 12px;
		border: 1px solid var(--app-border, rgba(0, 0, 0, 0.1));
		box-shadow: 0 12px 32px rgba(0, 0, 0, 0.12);
		background: #0a0a0a;
		flex-shrink: 0;
		line-height: 0;
	}

	.preview-studio-link {
		font-size: 0.78rem;
		font-weight: 600;
		color: #db2777;
		text-decoration: none;
	}

	.preview-studio-link:hover {
		text-decoration: underline;
	}
</style>
