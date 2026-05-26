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
	import { ExternalLink, Layout } from 'lucide-svelte';

	interface Props {
		clip: VideoClip;
		source: VideoImportMeta;
		watermark?: string;
		topicHint?: string;
	}

	let { clip, source, watermark = '', topicHint = '' }: Props = $props();

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
	<div class="previews-header">
		<Layout size={16} class="previews-icon" />
		<div>
			<h3 class="previews-title">How this clip could look</h3>
			<p class="previews-sub">
				{#if hasVideo}
					Live preview · clip {Math.floor(clip.startSec)}s–{Math.floor(clip.endSec)}s · same
					4:5 canvas as Studio
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
					<ExternalLink size={12} />
					Edit in Studio
				</a>
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
		grid-template-columns: repeat(4, minmax(0, 1fr));
		gap: 1.5rem;
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
		font-size: 0.67rem;
		font-weight: 700;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--app-text-muted, rgba(15, 23, 42, 0.42));
	}

	.preview-frame {
		overflow: hidden;
		border-radius: 14px;
		border: 1px solid var(--app-border, rgba(0, 0, 0, 0.1));
		box-shadow:
			0 8px 24px rgba(0, 0, 0, 0.1),
			0 2px 6px rgba(0, 0, 0, 0.06);
		background: #0a0a0a;
		flex-shrink: 0;
		line-height: 0;
		transition:
			transform 0.22s ease,
			box-shadow 0.22s ease;
		cursor: default;
	}

	.preview-frame:hover {
		transform: translateY(-4px) scale(1.01);
		box-shadow:
			0 18px 44px rgba(0, 0, 0, 0.16),
			0 4px 12px rgba(0, 0, 0, 0.1);
	}

	.preview-studio-link {
		display: inline-flex;
		align-items: center;
		gap: 0.32rem;
		font-size: 0.73rem;
		font-weight: 600;
		color: #db2777;
		text-decoration: none;
		padding: 0.3rem 0.65rem;
		border-radius: 0.45rem;
		border: 1px solid rgba(219, 39, 119, 0.22);
		background: rgba(219, 39, 119, 0.05);
		transition:
			background 0.15s,
			border-color 0.15s,
			transform 0.12s;
	}

	.preview-studio-link:hover {
		background: rgba(219, 39, 119, 0.11);
		border-color: rgba(219, 39, 119, 0.38);
		transform: translateY(-1px);
	}
</style>
