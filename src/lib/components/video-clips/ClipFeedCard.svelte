<script lang="ts">
	import { Download, Loader, Play, Pause, Film, Volume2, VolumeX, Crop } from 'lucide-svelte';
	import type { VideoClip, VideoImportMeta } from '$lib/video-clips/types';
	import { formatTimestamp } from '$lib/video-clips/export-clip';
	import { clipDisplayQuote } from '$lib/video-clips/clip-template-copy';
	import {
		cleanClipSpeechText,
		excerptTimedLinesFromTranscript,
		hasTimedTranscript,
	} from '$lib/video-clips/transcript-segments';
	import {
		parseTimedTranscriptToSegments,
		parseUntimedTranscriptToSegments,
		type CaptionSegment,
	} from '$lib/video-clips/caption-sync';
	import {
		segmentsToPhrases,
		getActivePhrase,
		getActiveWordIndex,
		dedupeAdjacentSegments,
		type CaptionPhrase,
	} from '$lib/video-clips/caption-chunking';
	import {
		enhanceCaptionSegments,
		enhancePhrases,
		findSilenceGaps,
		silenceSkipTarget,
		type CaptionEnhanceOptions,
		DEFAULT_CAPTION_ENHANCE,
	} from '$lib/video-clips/caption-enhance';
	import { STUDIO_TEMPLATES } from '$lib/studio/template-ids';

	type Props = {
		clip: VideoClip;
		index: number;
		source: VideoImportMeta;
		hasStoredVideo: boolean;
		selected?: boolean;
		exporting?: boolean;
		/** Show per-clip reframe control (uses parent auto-reframe settings). */
		reframeEnabled?: boolean;
		reframing?: boolean;
		reframeReady?: boolean;
		/** Another clip is reframing — disable this button. */
		reframeLocked?: boolean;
		muted?: boolean;
		/** Video preview layouts matching Studio video templates */
		layout?: 'story' | 'fit' | 'blur' | 'hook' | 'creator' | 'text' | 'source' | 'feature' | 'post';
		/** CSS aspect-ratio value e.g. "9 / 16" */
		aspectRatio?: string;
		enhance?: CaptionEnhanceOptions;
		onselect?: () => void;
		onplay?: (el: HTMLVideoElement) => void;
		onexport?: () => void;
		onreframe?: () => void;
		onstudio?: (templateId: string | string[]) => void;
		ontimeupdate?: (t: number, el: HTMLVideoElement) => void;
		onmutechange?: (muted: boolean) => void;
		onvideoready?: (el: HTMLVideoElement) => void;
	};

	let {
		clip,
		index,
		source,
		hasStoredVideo,
		selected = false,
		exporting = false,
		reframeEnabled = false,
		reframing = false,
		reframeReady = false,
		reframeLocked = false,
		muted = true,
		layout = 'fit',
		aspectRatio = '9 / 16',
		enhance = DEFAULT_CAPTION_ENHANCE,
		onselect,
		onplay,
		onexport,
		onreframe,
		onstudio,
		ontimeupdate,
		onmutechange,
		onvideoready,
	}: Props = $props();

	let videoEl = $state<HTMLVideoElement | null>(null);
	let playing = $state(false);
	let localTime = $state(0);
	let activePhrase = $state<CaptionPhrase | null>(null);
	let activeWordIndex = $state(-1);
	/** Ordered templates for a multi-slide Studio carousel that reuses this clip. */
	let carouselBuilderOpen = $state(false);
	let carouselTemplates = $state<string[]>([]);

	$effect(() => {
		if (videoEl) videoEl.muted = muted;
	});

	const scoreOutOf10 = $derived(Math.min(10, Math.max(0, clip.viralityScore / 10)));
	const scoreLabel = $derived(scoreOutOf10.toFixed(1));
	const durationSec = $derived(Math.max(0, Math.round(clip.endSec - clip.startSec)));
	const durationLabel = $derived(
		`${String(Math.floor(durationSec / 60)).padStart(2, '0')}:${String(durationSec % 60).padStart(2, '0')}`,
	);
	/** Standalone reframed MP4 — timeline starts at 0 instead of clip.startSec. */
	const hasReframed = $derived(!!clip.reframedPlaybackUrl?.trim());
	const mediaSrc = $derived(
		hasReframed ? clip.reframedPlaybackUrl!.trim() : source.playbackUrl,
	);
	const playStart = $derived(hasReframed ? 0 : clip.startSec);
	const playEnd = $derived(hasReframed ? Math.max(0.5, clip.endSec - clip.startSec) : clip.endSec);

	function sourceTimeFromLocal(t: number) {
		return hasReframed ? t + clip.startSec : t;
	}
	const headline = $derived(
		cleanClipSpeechText(clip.title) || clipDisplayQuote(clip, source) || `Clip ${index + 1}`,
	);
	const hookLine = $derived(clipDisplayQuote(clip, source));
	const videoHookLine = $derived(
		(clip.videoHook?.trim() || hookLine || headline)
			.replace(/\[\[([^\]]*)\]\]/g, '$1')
			.slice(0, 120),
	);
	const studioTemplateForLayout = $derived(
		layout === 'blur'
			? 'videoBlur'
			: layout === 'fit'
				? 'videoFit'
				: layout === 'hook'
					? 'videoHook'
					: layout === 'creator'
						? 'videoCreator'
						: layout === 'post'
							? 'videoPost'
						: layout === 'text'
							? 'videoText'
							: layout === 'source'
								? 'videoSource'
								: layout === 'feature'
									? 'videoFeature'
									: 'videoStory',
	);
	const reasonText = $derived(
		(clip.reason || '').trim() ||
			(clip.hook || '').trim() ||
			'This segment was ranked highly for virality based on pacing, hook strength, and engagement potential.',
	);

	const baseSegments = $derived.by((): CaptionSegment[] => {
		let segments: CaptionSegment[] = [];
		const full = source.transcript;
		if (full && hasTimedTranscript(full)) {
			const excerpt = excerptTimedLinesFromTranscript(full, clip.startSec, clip.endSec);
			if (excerpt.trim()) {
				segments = dedupeAdjacentSegments(parseTimedTranscriptToSegments(excerpt));
			}
		}
		if (!segments.length && clip.transcript) {
			if (hasTimedTranscript(clip.transcript)) {
				segments = dedupeAdjacentSegments(parseTimedTranscriptToSegments(clip.transcript));
			} else {
				segments = dedupeAdjacentSegments(
					parseUntimedTranscriptToSegments(
						clip.transcript,
						clip.startSec,
						Math.max(0.5, clip.endSec - clip.startSec),
					),
				);
			}
		}
		return segments;
	});

	const phrases = $derived.by((): CaptionPhrase[] => {
		const segments = enhanceCaptionSegments(baseSegments, enhance);
		if (!segments.length) return [];
		return enhancePhrases(segmentsToPhrases(segments, 4), enhance);
	});

	const silenceGaps = $derived(
		enhance.removeSilences
			? findSilenceGaps(baseSegments, clip.startSec, clip.endSec)
			: [],
	);

	/** Caption text shown on the phone preview (Vizard-style). */
	const overlayCaption = $derived.by(() => {
		if (playing && activePhrase?.text?.trim()) return activePhrase.text.trim();
		if (phrases[0]?.text?.trim()) return phrases[0]!.text.trim();
		return headline;
	});

	type TranscriptRow = { t: string; text: string; active?: boolean };
	const transcriptRows = $derived.by((): TranscriptRow[] => {
		const rows: TranscriptRow[] = [];
		if (phrases.length) {
			for (const p of phrases.slice(0, 28)) {
				rows.push({
					t: formatTimestamp(p.startSec),
					text: p.text,
					active: !!(activePhrase && p.startSec === activePhrase.startSec && p.text === activePhrase.text),
				});
			}
			return rows;
		}
		const full = source.transcript;
		if (full && hasTimedTranscript(full)) {
			const excerpt = excerptTimedLinesFromTranscript(full, clip.startSec, clip.endSec);
			for (const line of excerpt.split('\n')) {
				const m = /^\[(\d+:\d+(?:\.\d+)?)\s*(?:->|–|-)\s*(\d+:\d+(?:\.\d+)?)\]\s*(.*)$/.exec(
					line.trim(),
				);
				if (m) rows.push({ t: m[1]!, text: m[3]!.trim() });
			}
			if (rows.length) return rows.slice(0, 24);
		}
		const raw = (clip.transcript || '').trim();
		if (!raw) return rows;
		if (hasTimedTranscript(raw)) {
			for (const line of raw.split('\n')) {
				const m = /^\[(\d+:\d+(?:\.\d+)?)\s*(?:->|–|-)\s*(\d+:\d+(?:\.\d+)?)\]\s*(.*)$/.exec(
					line.trim(),
				);
				if (m) rows.push({ t: m[1]!, text: m[3]!.trim() });
			}
			return rows.slice(0, 24);
		}
		const words = raw.replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
		const chunk = 8;
		const dur = Math.max(0.1, clip.endSec - clip.startSec);
		for (let i = 0; i < words.length && rows.length < 16; i += chunk) {
			const frac = i / Math.max(1, words.length);
			const sec = clip.startSec + frac * dur;
			rows.push({
				t: formatTimestamp(sec),
				text: words.slice(i, i + chunk).join(' '),
			});
		}
		return rows;
	});

	function syncCaptionAt(t: number) {
		const phrase = getActivePhrase(phrases, t) ?? phrases[0] ?? null;
		activePhrase = phrase;
		activeWordIndex = phrase ? getActiveWordIndex(phrase, t) : -1;
	}

	function clampToClip(v: HTMLVideoElement) {
		if (v.currentTime < playStart - 0.05) {
			v.currentTime = playStart;
		}
		if (v.currentTime >= playEnd - 0.05) {
			v.pause();
			v.currentTime = playStart;
			playing = false;
			syncCaptionAt(clip.startSec);
		}
	}

	function handleTimeUpdate() {
		const v = videoEl;
		if (!v) return;
		clampToClip(v);
		const sourceT = sourceTimeFromLocal(v.currentTime);
		if (enhance.removeSilences && silenceGaps.length && !hasReframed) {
			const jump = silenceSkipTarget(v.currentTime, silenceGaps);
			if (jump != null && Number.isFinite(jump)) {
				try {
					v.currentTime = jump;
				} catch {
					/* ignore */
				}
			}
		}
		localTime = Math.max(0, v.currentTime - playStart);
		syncCaptionAt(sourceT);
		ontimeupdate?.(sourceT, v);
	}

	function handleLoadedMetadata() {
		const v = videoEl;
		if (!v) return;
		v.currentTime = playStart;
		v.muted = muted;
		syncCaptionAt(clip.startSec);
		onvideoready?.(v);
	}

	function handlePlay() {
		const v = videoEl;
		if (!v) return;
		playing = true;
		if (v.currentTime < playStart || v.currentTime >= playEnd - 0.05) {
			v.currentTime = playStart;
		}
		onplay?.(v);
	}

	function handlePause() {
		playing = false;
	}

	function togglePlay(e: MouseEvent) {
		e.stopPropagation();
		onselect?.();
		const v = videoEl;
		if (!v) return;
		if (v.paused) {
			if (v.currentTime < playStart || v.currentTime >= playEnd - 0.05) {
				v.currentTime = playStart;
			}
			void v.play().catch(() => {});
		} else {
			v.pause();
		}
	}

	function toggleMute(e: MouseEvent) {
		e.stopPropagation();
		onmutechange?.(!muted);
	}

	function scoreTone(score: number) {
		if (score >= 8.5) return '#16a34a';
		if (score >= 7) return '#ca8a04';
		if (score >= 5) return '#ea580c';
		return '#dc2626';
	}

	const progressPct = $derived(
		Math.min(100, Math.max(0, (localTime / Math.max(0.1, playEnd - playStart)) * 100)),
	);

	/** Words for karaoke highlight inside the caption box */
	const overlayWords = $derived.by(() => {
		const phrase = playing ? activePhrase : phrases[0];
		if (!phrase?.words?.length) {
			return overlayCaption.split(/\s+/).filter(Boolean).map((text) => ({
				text,
				active: false,
				keyword: false,
			}));
		}
		return phrase.words.map((w, i) => ({
			text: w.text,
			active: playing && i === activeWordIndex,
			keyword: !!w.keyword,
		}));
	});
</script>

<article
	class="feed-card"
	class:feed-card-on={selected}
	id="clip-card-{clip.id}"
	style="--score-tone: {scoreTone(scoreOutOf10)}"
>
	<div class="feed-card-media">
		{#if hasStoredVideo}
			<div
				class="phone-frame"
				class:layout-fit={layout === 'fit'}
				class:layout-hook={layout === 'hook'}
				class:layout-creator={layout === 'creator' || layout === 'post'}
				class:layout-text={layout === 'text'}
				class:layout-source={layout === 'source'}
				class:layout-feature={layout === 'feature'}
				class:layout-blur={layout === 'blur'}
				class:layout-story={layout === 'story'}
				class:layout-post={layout === 'post'}
				style="aspect-ratio: {aspectRatio}"
			>
				{#if layout === 'blur'}
					<!-- svelte-ignore a11y_media_has_caption -->
					<video
						class="clip-video clip-video-blur"
						src={mediaSrc}
						preload="metadata"
						playsinline
						muted
						aria-hidden="true"
					></video>
				{/if}
				{#if layout === 'hook'}
					<p class="hook-title" aria-hidden="true">{videoHookLine}</p>
				{/if}
				{#if layout === 'creator' || layout === 'post'}
					<div class="creator-head" aria-hidden="true">
						<div class="creator-avatar">
							{#if source.thumbnailUrl}
								<img src={source.thumbnailUrl} alt="" />
							{/if}
						</div>
						<div class="creator-meta">
							<div class="creator-name-row">
								<span class="creator-name">{clip.title.slice(0, 28) || 'Creator'}</span>
								<svg width="12" height="12" viewBox="0 0 24 24" fill="none">
									<circle cx="12" cy="12" r="10" fill="#1D9BF0" />
									<path
										d="M7.5 12.2l2.8 2.8 6.2-6.4"
										stroke="#fff"
										stroke-width="2"
										stroke-linecap="round"
										stroke-linejoin="round"
									/>
								</svg>
							</div>
							<span class="creator-handle">@clip</span>
						</div>
						<p class="creator-hook">{videoHookLine}</p>
					</div>
				{/if}
				{#if layout === 'text'}
					<p class="cover-text" aria-hidden="true">{videoHookLine}</p>
				{/if}
				{#if layout === 'source'}
					{@const sourceWords = videoHookLine.trim().split(/\s+/).filter(Boolean)}
					<div class="source-head" aria-hidden="true">
						<p class="source-hook">
							{#each sourceWords as w, wi (wi)}
								<span class:source-hi={wi === 0}>{w}</span>{wi < sourceWords.length - 1 ? ' ' : ''}
							{/each}
						</p>
					</div>
				{/if}
				{#if layout === 'feature'}
					{@const featWords = videoHookLine.trim().split(/\s+/).filter(Boolean)}
					<div class="feature-head" aria-hidden="true">
						<p class="feature-hook">
							{#each featWords as w, wi (wi)}
								<span class:feature-hi={wi > 0 && wi < 3}>{w}</span
								>{wi < featWords.length - 1 ? ' ' : ''}
							{/each}
						</p>
						<p class="feature-body">{reasonText.slice(0, 110)}</p>
					</div>
				{/if}
				<!-- svelte-ignore a11y_media_has_caption -->
				{#key mediaSrc}
					<video
						bind:this={videoEl}
						class="clip-video"
						class:clip-video-contain={(layout === 'fit' || layout === 'hook' || layout === 'creator' || layout === 'post') && !hasReframed}
						class:clip-video-mid={layout === 'blur'}
						class:clip-video-hook={layout === 'hook' || layout === 'creator' || layout === 'post'}
						class:clip-video-source={layout === 'source'}
						class:clip-video-feature={layout === 'feature'}
						src={mediaSrc}
						preload="metadata"
						playsinline
						muted={muted}
						ontimeupdate={handleTimeUpdate}
						onloadedmetadata={handleLoadedMetadata}
						onplay={handlePlay}
						onpause={handlePause}
						onvolumechange={(e) => onmutechange?.(e.currentTarget.muted)}
						onclick={togglePlay}
					></video>
				{/key}

				<!-- Always-on captions (Vizard-style boxed overlay) -->
				<div class="caption-box" aria-hidden="true">
					<p class="caption-line">
						{#each overlayWords as w, wi (wi)}
							<span
								class="cap-word"
								class:cap-word-on={w.active}
								class:cap-word-key={w.keyword && !w.active}
							>{w.text}</span
							>{' '}
						{/each}
					</p>
				</div>

				<button
					type="button"
					class="play-hit"
					class:playing
					onclick={togglePlay}
					aria-label={playing ? 'Pause' : 'Play'}
				>
					<span class="play-badge">
						{#if playing}
							<Pause size={22} fill="currentColor" />
						{:else}
							<Play size={22} fill="currentColor" />
						{/if}
					</span>
					<span class="dur-badge">{durationLabel}</span>
				</button>

				<button
					type="button"
					class="mute-fab"
					class:mute-fab-on={muted}
					onclick={toggleMute}
					aria-label={muted ? 'Unmute' : 'Mute'}
					title={muted ? 'Unmute' : 'Mute'}
				>
					{#if muted}
						<VolumeX size={14} />
					{:else}
						<Volume2 size={14} />
					{/if}
				</button>

				<div class="progress-track" aria-hidden="true">
					<div class="progress-fill" style="width: {progressPct}%"></div>
				</div>

				<span class="res-pill">{hasReframed ? 'Reframed' : '720p'}</span>
			</div>
			{#if reframeEnabled}
				<button
					type="button"
					class="btn-reframe"
					class:btn-reframe-done={reframeReady}
					class:btn-reframe-busy={reframing}
					disabled={reframing || exporting || reframeLocked || !source.r2Key}
					onclick={() => onreframe?.()}
					title={reframeReady ? 'Re-apply reframe with current settings' : 'Reframe this clip'}
				>
					{#if reframing}
						<Loader size={14} class="spin" />
						Reframing…
					{:else if reframeReady}
						<Crop size={14} />
						Reframed
					{:else}
						<Crop size={14} />
						Reframe
					{/if}
				</button>
			{/if}
		{:else if source.youtubeId}
			<div class="phone-frame yt-frame">
				{#key `${clip.id}-${clip.startSec}-${clip.endSec}`}
					<iframe
						title="YouTube clip {index + 1}"
						src="https://www.youtube.com/embed/{source.youtubeId}?start={Math.floor(clip.startSec)}&end={Math.ceil(clip.endSec)}&autoplay=0&rel=0"
						allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
						allowfullscreen
					></iframe>
				{/key}
				<div class="caption-box" aria-hidden="true">
					<p class="caption-line">{overlayCaption}</p>
				</div>
				<span class="dur-badge yt-dur">{durationLabel}</span>
			</div>
		{:else}
			<div class="phone-frame phone-empty">
				<Film size={28} />
				<span>No preview</span>
			</div>
		{/if}
	</div>

	<div class="feed-card-meta">
		<header class="meta-head">
			<button type="button" class="meta-title-btn" onclick={() => onselect?.()}>
				<span class="meta-index">#{index + 1}</span>
				<span class="meta-title">{headline}</span>
			</button>
			<div class="virality-block" title="Virality score">
				<span class="virality-num">{scoreLabel}</span>
				<span class="virality-label">VIRALITY</span>
			</div>
		</header>

		<div class="action-row">
			<button type="button" class="btn-publish" onclick={() => onstudio?.(studioTemplateForLayout)}>
				Publish
			</button>
			<button
				type="button"
				class="btn-dl"
				disabled={exporting || !source.r2Key}
				onclick={() => onexport?.()}
				title={source.r2Key ? 'Download MP4 clip' : 'Requires full video download'}
			>
				{#if exporting}
					<Loader size={14} class="spin" />
				{:else}
					<Download size={14} />
				{/if}
				Download
			</button>
			<label class="studio-pick">
				<span class="sr-only">Open in Studio template</span>
				<select
					onchange={(e) => {
						const t = (e.currentTarget as HTMLSelectElement).value;
						if (!t) return;
						onstudio?.(t);
						e.currentTarget.selectedIndex = 0;
					}}
					title="Open in Studio"
				>
					<option value="">Studio…</option>
					{#each STUDIO_TEMPLATES as t (t.id)}
						<option value={t.id}>{t.label}</option>
					{/each}
				</select>
			</label>
			<button
				type="button"
				class="btn-carousel"
				class:btn-carousel-on={carouselBuilderOpen}
				onclick={() => {
					carouselBuilderOpen = !carouselBuilderOpen;
					if (carouselBuilderOpen && !carouselTemplates.length) {
						carouselTemplates = ['news', 'blank'];
					}
				}}
				title="Reuse this clip across multiple templates in one carousel"
			>
				Carousel
			</button>
		</div>

		{#if carouselBuilderOpen}
			<div class="carousel-builder" role="group" aria-label="Build Studio carousel">
				<p class="carousel-builder-hint">
					Pick templates in order — same clip on every slide. Example: News then Blank.
				</p>
				<div class="carousel-chips">
					{#each STUDIO_TEMPLATES as t (t.id)}
						{@const selected = carouselTemplates.includes(t.id)}
						{@const ord = carouselTemplates.indexOf(t.id)}
						<button
							type="button"
							class="carousel-chip"
							class:carousel-chip-on={selected}
							onclick={() => {
								if (selected) {
									carouselTemplates = carouselTemplates.filter((x) => x !== t.id);
								} else if (carouselTemplates.length < 8) {
									carouselTemplates = [...carouselTemplates, t.id];
								}
							}}
						>
							{#if selected}<span class="carousel-ord">{ord + 1}</span>{/if}
							{t.label}
						</button>
					{/each}
				</div>
				{#if carouselTemplates.length}
					<p class="carousel-order">
						Order: {carouselTemplates
							.map((id) => STUDIO_TEMPLATES.find((t) => t.id === id)?.label ?? id)
							.join(' → ')}
					</p>
				{/if}
				<button
					type="button"
					class="btn-open-carousel"
					disabled={carouselTemplates.length < 2}
					onclick={() => {
						if (carouselTemplates.length < 2) return;
						onstudio?.([...carouselTemplates]);
					}}
				>
					Open {carouselTemplates.length || 0}-slide carousel
				</button>
			</div>
		{/if}

		<div class="reason-box">
			<div class="reason-label">Viral reason</div>
			<p class="reason-text">{reasonText}</p>
		</div>

		{#if hookLine && hookLine !== headline}
			<p class="hook-line">{hookLine}</p>
		{/if}

		<div class="times-line">
			{formatTimestamp(clip.startSec)} – {formatTimestamp(clip.endSec)}
			· {durationLabel}
		</div>

		{#if transcriptRows.length}
			<div class="transcript" aria-label="Clip transcript">
				{#each transcriptRows as row, ri (ri)}
					<div class="tr-row" class:tr-row-on={row.active}>
						<span class="tr-t">{row.t}</span>
						<span class="tr-text">{row.text}</span>
					</div>
				{/each}
			</div>
		{/if}
	</div>
</article>

<style>
	.feed-card {
		display: grid;
		grid-template-columns: minmax(200px, 260px) minmax(0, 1fr);
		gap: 1.35rem 1.75rem;
		padding: 1.35rem 1.4rem;
		border-radius: 1rem;
		border: 1px solid var(--app-border);
		background: var(--app-surface-2);
		isolation: isolate;
	}

	.feed-card-on {
		border-color: color-mix(in oklab, #7bf1a8 45%, var(--app-border));
		box-shadow: 0 0 0 1px color-mix(in oklab, #7bf1a8 20%, transparent);
	}

	.feed-card-media {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		min-width: 0;
	}

	.btn-reframe {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.35rem;
		width: 100%;
		padding: 0.45rem 0.65rem;
		border-radius: 0.55rem;
		border: 1px solid #e2e8f0;
		background: #f8fafc;
		color: #475569;
		font-size: 0.78rem;
		font-weight: 650;
		cursor: pointer;
	}

	.btn-reframe:hover:not(:disabled) {
		background: #f1f5f9;
		border-color: #cbd5e1;
		color: #1e293b;
	}

	.btn-reframe:disabled {
		opacity: 0.55;
		cursor: not-allowed;
	}

	.btn-reframe-done {
		border-color: color-mix(in oklab, #7bf1a8 40%, var(--app-border));
		background: color-mix(in oklab, #7bf1a8 8%, transparent);
		color: #7bf1a8;
	}

	.btn-reframe-busy {
		border-color: color-mix(in oklab, #7bf1a8 35%, var(--app-border));
		background: color-mix(in oklab, #7bf1a8 6%, transparent);
		color: #7bf1a8;
	}

	.phone-frame {
		position: relative;
		aspect-ratio: 9 / 16;
		width: 100%;
		max-height: min(64vh, 560px);
		margin-inline: auto;
		border-radius: 0.9rem;
		overflow: hidden;
		background: #0a0a0a;
		box-shadow: 0 14px 40px rgba(0, 0, 0, 0.28);
	}

	.clip-video {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		object-fit: cover;
		cursor: pointer;
		z-index: 1;
	}

	.clip-video-blur {
		z-index: 0;
		inset: -18%;
		width: 136%;
		height: 136%;
		filter: blur(42px) brightness(0.78) saturate(1.05);
		transform: scale(1.12);
		pointer-events: none;
	}

	.clip-video-contain {
		object-fit: contain;
		background: #000;
	}

	.layout-hook .clip-video-hook {
		top: auto;
		bottom: auto;
		left: 4%;
		right: 4%;
		width: 92%;
		height: auto;
		aspect-ratio: 16 / 9;
		inset: auto;
		top: 52%;
		transform: translateY(-40%);
		object-fit: cover;
		background: #000;
	}

	.hook-title {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		z-index: 3;
		margin: 0;
		padding: 14% 4% 0;
		text-align: left;
		color: #fff;
		font-weight: 400;
		font-size: clamp(0.9rem, 3.8vw, 1.2rem);
		line-height: 1.22;
		letter-spacing: -0.02em;
		display: -webkit-box;
		-webkit-box-orient: vertical;
		-webkit-line-clamp: 2;
		overflow: hidden;
		pointer-events: none;
	}

	.creator-head {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		z-index: 3;
		padding: 8% 7% 0;
		pointer-events: none;
		display: grid;
		grid-template-columns: auto 1fr;
		grid-template-rows: auto auto;
		column-gap: 0.45rem;
		row-gap: 0.45rem;
	}

	.creator-avatar {
		grid-row: 1;
		width: 1.65rem;
		height: 1.65rem;
		border-radius: 50%;
		overflow: hidden;
		background: #334155;
	}

	.creator-avatar img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
	}

	.creator-meta {
		grid-row: 1;
		min-width: 0;
	}

	.creator-name-row {
		display: flex;
		align-items: center;
		gap: 0.25rem;
	}

	.creator-name {
		color: #fff;
		font-weight: 700;
		font-size: 0.72rem;
		line-height: 1.1;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.creator-handle {
		display: block;
		color: rgba(255, 255, 255, 0.55);
		font-size: 0.62rem;
		line-height: 1.2;
	}

	.creator-hook {
		grid-column: 1 / -1;
		margin: 0;
		color: #fff;
		font-weight: 500;
		font-size: clamp(0.78rem, 3.2vw, 1.05rem);
		line-height: 1.25;
		letter-spacing: -0.02em;
		text-shadow: 0 2px 12px rgba(0, 0, 0, 0.55);
	}

	.layout-creator .caption-box {
		top: auto;
		bottom: 28%;
	}

	.cover-text {
		position: absolute;
		inset: 0;
		z-index: 3;
		margin: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 12%;
		text-align: center;
		color: #fff;
		font-weight: 800;
		font-size: clamp(0.95rem, 4.2vw, 1.35rem);
		line-height: 1.15;
		letter-spacing: -0.03em;
		-webkit-text-stroke: 1.25px #000;
		paint-order: stroke fill;
		text-shadow:
			-1px -1px 0 #000,
			1px -1px 0 #000,
			-1px 1px 0 #000,
			1px 1px 0 #000;
		pointer-events: none;
	}

	.layout-text .caption-box {
		opacity: 0;
	}

	.source-head {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		z-index: 3;
		padding: 8% 7% 0;
		pointer-events: none;
	}

	.source-hook {
		margin: 0;
		color: #fff;
		font-weight: 400;
		font-size: clamp(0.9rem, 3.8vw, 1.15rem);
		line-height: 1.22;
		letter-spacing: -0.02em;
		text-align: left;
		display: -webkit-box;
		-webkit-box-orient: vertical;
		-webkit-line-clamp: 2;
		overflow: hidden;
	}

	.source-hi {
		color: #39ff14;
		font-weight: 700;
	}

	.layout-source .clip-video-source {
		left: 0;
		right: 0;
		width: 100%;
		height: auto;
		aspect-ratio: 16 / 9;
		inset: auto;
		top: 48%;
		transform: translateY(-35%);
		object-fit: cover;
		background: #000;
	}

	.source-attr {
		display: none;
	}

	.layout-source .caption-box {
		top: auto;
		bottom: 30%;
	}

	.feature-head {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		z-index: 3;
		padding: 8% 7% 0;
		pointer-events: none;
	}

	.feature-hook {
		margin: 0 0 0.4rem;
		color: #fff;
		font-weight: 700;
		font-size: clamp(0.72rem, 3vw, 0.98rem);
		line-height: 1.2;
		letter-spacing: -0.02em;
		text-align: left;
	}

	.feature-hi {
		color: #2ee6c5;
	}

	.feature-body {
		margin: 0;
		color: rgba(255, 255, 255, 0.88);
		font-size: 0.62rem;
		line-height: 1.35;
		font-weight: 500;
	}

	.layout-feature .clip-video-feature {
		top: auto;
		bottom: 7%;
		left: 7%;
		right: 7%;
		width: auto;
		height: 38%;
		object-fit: cover;
		border-radius: 0.65rem;
	}

	.layout-feature .caption-box {
		opacity: 0;
	}

	.layout-blur .clip-video-mid {
		/* Full-width 16:9 band centered — matches Studio blur template (~31.6% of 9:16 frame) */
		inset: auto;
		left: 0;
		right: 0;
		top: 50%;
		width: 100%;
		height: auto;
		aspect-ratio: 16 / 9;
		transform: translateY(-50%);
		object-fit: cover;
		box-shadow:
			0 -18px 0 #000,
			0 18px 0 #000;
	}

	.layout-fit .caption-box {
		top: 8%;
	}

	.layout-hook .caption-box {
		top: auto;
		bottom: 28%;
	}

	.layout-blur .caption-box {
		top: 9%;
		bottom: auto;
	}

	.yt-frame iframe {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		border: 0;
	}

	.phone-empty {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		color: #94a3b8;
		font-size: 0.75rem;
	}

	/* Vizard-style caption overlay — stroke text, no forced box */
	.caption-box {
		position: absolute;
		top: 11%;
		left: 7%;
		right: 7%;
		z-index: 6;
		pointer-events: none;
		display: flex;
		justify-content: center;
	}

	.caption-line {
		margin: 0;
		text-align: center;
		font-size: clamp(0.78rem, 2.6vw, 1.05rem);
		font-weight: 800;
		line-height: 1.28;
		letter-spacing: -0.02em;
		color: #fff;
		text-transform: uppercase;
		background: transparent;
		border: none;
		padding: 0;
		border-radius: 0;
		-webkit-text-stroke: 1.5px #000;
		paint-order: stroke fill;
		text-shadow:
			0 2px 4px rgba(0, 0, 0, 0.85),
			0 0 10px rgba(0, 0, 0, 0.45);
		display: -webkit-box;
		-webkit-line-clamp: 5;
		line-clamp: 5;
		-webkit-box-orient: vertical;
		overflow: hidden;
		max-width: 100%;
	}

	.cap-word {
		display: inline;
	}

	.cap-word-on {
		color: #ffe566;
	}

	.cap-word-key {
		/* Color-only keyword emphasis — no yellow pill box */
		color: #ffe566;
		background: none;
		padding: 0;
	}

	.play-hit {
		position: absolute;
		inset: 0;
		z-index: 8;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.55rem;
		background: transparent;
		border: 0;
		cursor: pointer;
		color: #fff;
		pointer-events: none;
	}

	.play-hit .play-badge,
	.play-hit .dur-badge {
		pointer-events: auto;
	}

	.play-hit.playing .play-badge {
		opacity: 0;
		transition: opacity 0.2s;
	}

	.phone-frame:hover .play-hit.playing .play-badge {
		opacity: 1;
	}

	.play-hit:hover .play-badge {
		transform: scale(1.06);
		background: rgba(0, 0, 0, 0.72);
	}

	.play-badge {
		width: 3rem;
		height: 3rem;
		border-radius: 999px;
		background: rgba(0, 0, 0, 0.55);
		border: 1.5px solid rgba(255, 255, 255, 0.35);
		display: flex;
		align-items: center;
		justify-content: center;
		backdrop-filter: blur(6px);
		transition:
			transform 0.15s,
			background 0.15s,
			opacity 0.2s;
		padding-left: 2px;
	}

	.dur-badge {
		font-size: 0.78rem;
		font-weight: 700;
		font-variant-numeric: tabular-nums;
		letter-spacing: 0.04em;
		text-shadow: 0 1px 4px rgba(0, 0, 0, 0.8);
	}

	.yt-dur {
		position: absolute;
		bottom: 12px;
		left: 50%;
		transform: translateX(-50%);
		z-index: 6;
		color: #fff;
	}

	.progress-track {
		position: absolute;
		left: 0;
		right: 0;
		bottom: 0;
		height: 3px;
		background: rgba(255, 255, 255, 0.2);
		z-index: 9;
	}

	.progress-fill {
		height: 100%;
		background: #7bf1a8;
		transition: width 0.1s linear;
	}

	.res-pill {
		position: absolute;
		top: 10px;
		left: 10px;
		z-index: 10;
		font-size: 0.62rem;
		font-weight: 700;
		letter-spacing: 0.04em;
		color: #fff;
		background: rgba(0, 0, 0, 0.55);
		border: 1px solid rgba(255, 255, 255, 0.2);
		padding: 0.2rem 0.4rem;
		border-radius: 0.3rem;
		pointer-events: none;
	}

	.mute-fab {
		position: absolute;
		top: 10px;
		right: 10px;
		z-index: 12;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 2rem;
		height: 2rem;
		border: 1px solid rgba(255, 255, 255, 0.25);
		border-radius: 999px;
		background: rgba(0, 0, 0, 0.55);
		color: #fff;
		cursor: pointer;
		padding: 0;
	}

	.mute-fab:hover {
		background: rgba(0, 0, 0, 0.75);
	}

	.mute-fab-on {
		color: #fbbf24;
	}

	.feed-card-meta {
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 0.8rem;
	}

	.meta-head {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 0.75rem;
	}

	.meta-title-btn {
		display: flex;
		align-items: baseline;
		gap: 0.4rem;
		min-width: 0;
		text-align: left;
		background: none;
		border: 0;
		padding: 0;
		cursor: pointer;
		color: inherit;
	}

	.meta-index {
		font-size: 0.95rem;
		font-weight: 800;
		color: var(--app-text-3);
		flex-shrink: 0;
	}

	.meta-title {
		font-size: 1.05rem;
		font-weight: 800;
		letter-spacing: -0.025em;
		line-height: 1.25;
		color: var(--app-text);
		display: -webkit-box;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}

	.virality-block {
		flex-shrink: 0;
		text-align: right;
		line-height: 1;
	}

	.virality-num {
		display: block;
		font-size: 1.65rem;
		font-weight: 900;
		letter-spacing: -0.04em;
		color: var(--score-tone, #16a34a);
		font-variant-numeric: tabular-nums;
	}

	.virality-label {
		display: block;
		margin-top: 0.2rem;
		font-size: 0.58rem;
		font-weight: 800;
		letter-spacing: 0.12em;
		color: #94a3b8;
	}

	.action-row {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.45rem;
	}

	.btn-publish {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: 0.45rem 1.05rem;
		border-radius: 0.45rem;
		border: 0;
		background: #7bf1a8;
		color: #080808;
		font-size: 0.8rem;
		font-weight: 700;
		cursor: pointer;
		transition: filter 0.12s;
	}

	.btn-publish:hover {
		filter: brightness(1.05);
	}

	.btn-dl {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		padding: 0.42rem 0.85rem;
		border-radius: 0.45rem;
		border: 1px solid var(--app-border);
		background: var(--app-surface-3);
		font-size: 0.8rem;
		font-weight: 650;
		color: var(--app-text-2);
		cursor: pointer;
		transition: border-color 0.12s, background 0.12s;
	}

	.btn-dl:hover:not(:disabled) {
		border-color: var(--app-border-hover);
		background: color-mix(in oklab, var(--app-text) 5%, transparent);
	}

	.btn-dl:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}

	.studio-pick select {
		appearance: none;
		padding: 0.42rem 1.6rem 0.42rem 0.7rem;
		border-radius: 0.45rem;
		border: 1px solid #e2e8f0;
		background: #fff
			url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2.5'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")
			no-repeat right 0.45rem center;
		font-size: 0.78rem;
		font-weight: 600;
		color: #475569;
		cursor: pointer;
	}

	.btn-carousel {
		display: inline-flex;
		align-items: center;
		padding: 0.42rem 0.75rem;
		border-radius: 0.45rem;
		border: 1px solid #e2e8f0;
		background: #fff;
		font-size: 0.78rem;
		font-weight: 650;
		color: #475569;
		cursor: pointer;
	}

	.btn-carousel:hover,
	.btn-carousel-on {
		border-color: color-mix(in oklab, #7bf1a8 40%, var(--app-border));
		background: color-mix(in oklab, #7bf1a8 10%, transparent);
		color: #7bf1a8;
	}

	.carousel-builder {
		margin-top: 0.55rem;
		padding: 0.7rem 0.75rem;
		border-radius: 0.65rem;
		border: 1px solid #e9e5ff;
		background: #faf8ff;
		display: flex;
		flex-direction: column;
		gap: 0.55rem;
	}

	.carousel-builder-hint {
		margin: 0;
		font-size: 0.72rem;
		line-height: 1.4;
		color: #64748b;
	}

	.carousel-chips {
		display: flex;
		flex-wrap: wrap;
		gap: 0.35rem;
	}

	.carousel-chip {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		padding: 0.28rem 0.55rem;
		border-radius: 999px;
		border: 1px solid #e2e8f0;
		background: #fff;
		font-size: 0.7rem;
		font-weight: 600;
		color: #475569;
		cursor: pointer;
	}

	.carousel-chip-on {
		border-color: color-mix(in oklab, #7bf1a8 45%, var(--app-border));
		background: color-mix(in oklab, #7bf1a8 10%, transparent);
		color: #c8e838;
	}

	.carousel-ord {
		display: inline-grid;
		place-items: center;
		width: 1rem;
		height: 1rem;
		border-radius: 999px;
		background: #7bf1a8;
		color: #080808;
		font-size: 0.58rem;
		font-weight: 800;
	}

	.carousel-order {
		margin: 0;
		font-size: 0.7rem;
		color: var(--app-text-3);
	}

	.btn-open-carousel {
		align-self: flex-start;
		padding: 0.4rem 0.85rem;
		border-radius: 0.45rem;
		border: 0;
		background: #7bf1a8;
		color: #080808;
		font-size: 0.78rem;
		font-weight: 700;
		cursor: pointer;
	}

	.btn-open-carousel:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}

	.reason-box {
		border: 1px solid var(--app-border);
		background: var(--app-surface-3);
		border-radius: 0.65rem;
		padding: 0.7rem 0.85rem;
	}

	.reason-label {
		font-size: 0.68rem;
		font-weight: 800;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: var(--app-text-3);
		margin-bottom: 0.3rem;
	}

	.reason-text {
		margin: 0;
		font-size: 0.82rem;
		line-height: 1.5;
		color: #334155;
	}

	.hook-line {
		margin: 0;
		font-size: 0.8rem;
		color: #64748b;
		line-height: 1.45;
	}

	.times-line {
		font-size: 0.72rem;
		color: #94a3b8;
		font-variant-numeric: tabular-nums;
	}

	.transcript {
		max-height: 12.5rem;
		overflow: auto;
		border: 1px solid #f1f5f9;
		border-radius: 0.65rem;
		padding: 0.65rem 0.75rem;
		background: #fafbfc;
		display: flex;
		flex-direction: column;
		gap: 0.38rem;
		scrollbar-width: thin;
	}

	.tr-row {
		display: grid;
		grid-template-columns: 3.2rem minmax(0, 1fr);
		gap: 0.55rem;
		font-size: 0.78rem;
		line-height: 1.4;
		border-radius: 0.3rem;
		padding: 0.15rem 0.2rem;
	}

	.tr-row-on {
		background: color-mix(in oklab, #7c3aed 10%, transparent);
	}

	.tr-t {
		font-variant-numeric: tabular-nums;
		color: #94a3b8;
		font-weight: 600;
	}

	.tr-text {
		color: #475569;
	}

	.tr-row-on .tr-text {
		color: #0f172a;
		font-weight: 650;
	}

	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border: 0;
	}

	@media (max-width: 720px) {
		.feed-card {
			grid-template-columns: 1fr;
			padding: 1.1rem;
		}

		.phone-frame {
			max-width: 280px;
			max-height: 52vh;
		}
	}

	:global(.spin) {
		animation: spin 0.75s linear infinite;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}
</style>
