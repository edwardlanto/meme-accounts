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
	import { VIDEO_STORY_HEADLINE_STYLE } from '$lib/studio/slide-content-defaults';

	interface Props {
		clip: VideoClip;
		source: VideoImportMeta;
		watermark?: string;
		topicHint?: string;
	}

	let { clip, source, watermark = '', topicHint = '' }: Props = $props();

	/** Uniform 9:16 preview card (px). */
	const PREVIEW_W = 280;
	const PREVIEW_H = Math.round((PREVIEW_W * 16) / 9);

	const CANVAS_W = 1080;
	const CANVAS_H_45 = 1350;
	const STORY_H = 1920;

	const scale45 = PREVIEW_W / CANVAS_W;
	const scaleStory = PREVIEW_W / CANVAS_W;

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
			Preview uses your clip segment ({Math.floor(clip.startSec)}s–{Math.floor(clip.endSec)}s). Open Studio to edit and export.
		{:else}
			Full video download unavailable — previews use the thumbnail. Install yt-dlp + cookies for clip video in templates.
		{/if}
	</p>

	<div class="previews-grid">
		{#each templates as t (t.id)}
			<article class="preview-card">
				<span class="preview-label">{t.label}</span>
				<div class="preview-frame" style="width:{PREVIEW_W}px;height:{PREVIEW_H}px">
					{#if t.id === 'news'}
						<div class="preview-slot preview-slot-center">
							<NewsTemplate
								text={copy.newsHeadline}
								source={copy.newsSource}
								backgroundImage={hasVideo ? '' : thumb}
								backgroundVideo={videoSrc}
								{...videoProps}
								highlightColor="#F5A623"
								textColor="#FFFFFF"
								templateTheme="dark"
								w={CANVAS_W}
								h={CANVAS_H_45}
								scale={scale45}
								interactive={false}
							/>
						</div>
					{:else if t.id === 'videoStory'}
						<div class="preview-slot preview-slot-fill">
							<VideoStoryTemplate
								headline={copy.storyHeadline}
								watermark={copy.storyWatermark}
								videoSrc={videoSrc}
								videoPoster={thumb}
								{...videoProps}
								headlineStyle={VIDEO_STORY_HEADLINE_STYLE}
								w={CANVAS_W}
								h={STORY_H}
								scale={scaleStory}
								interactive={false}
							/>
						</div>
					{:else if t.id === 'tweet'}
						<div class="preview-slot preview-slot-center">
							<TweetTemplate
								topName={copy.carouselName}
								topHandle={copy.carouselHandle}
								topText={copy.tweetTop}
								topImage={hasVideo ? '' : thumb}
								topVideo={videoSrc}
								bottomName="Audience"
								bottomHandle="@replies"
								bottomText={copy.tweetBottom}
								replyCount="2.4K"
								repostCount="8.1K"
								likeCount="42K"
								topImageHeight={720}
								topImageWidth={920}
								canvasW={CANVAS_W}
								canvasH={CANVAS_H_45}
								scale={scale45}
								interactive={false}
								templateTheme="dark"
							/>
						</div>
					{:else if t.id === 'textCarousel'}
						<div class="preview-slot preview-slot-center">
							<TextCarouselTemplate
								name={copy.carouselName}
								handle={copy.carouselHandle}
								text={copy.carouselBody}
								templateTheme="dark"
								canvasW={CANVAS_W}
								canvasH={CANVAS_H_45}
								scale={scale45}
								interactive={false}
								showSwipe={true}
							/>
						</div>
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
		position: relative;
	}

	.preview-slot {
		position: absolute;
		inset: 0;
		overflow: hidden;
		background: #0a0a0a;
	}

	.preview-slot-center {
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.preview-slot-fill {
		display: block;
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
