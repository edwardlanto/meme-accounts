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
		/** fit = letterbox, blur = blurred fill, story = full cover */
		layout?: 'story' | 'fit' | 'blur';
		/** CSS aspect-ratio value e.g. "9 / 16" */
		aspectRatio?: string;
		enhance?: CaptionEnhanceOptions;
		onselect?: () => void;
		onplay?: (el: HTMLVideoElement) => void;
		onexport?: () => void;
		onreframe?: () => void;
		onstudio?: (templateId: string) => void;
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
				class:layout-blur={layout === 'blur'}
				class:layout-story={layout === 'story'}
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
				<!-- svelte-ignore a11y_media_has_caption -->
				{#key mediaSrc}
					<video
						bind:this={videoEl}
						class="clip-video"
						class:clip-video-contain={layout === 'fit' && !hasReframed}
						class:clip-video-mid={layout === 'blur'}
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
			<button type="button" class="btn-publish" onclick={() => onstudio?.(layout === 'blur' ? 'videoBlur' : layout === 'fit' ? 'videoFit' : 'videoStory')}>
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
		</div>

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
		border-radius: 1.1rem;
		border: 1px solid #e2e8f0;
		background: #fff;
		box-shadow: 0 2px 8px rgba(15, 23, 42, 0.04);
		isolation: isolate;
	}

	.feed-card-on {
		border-color: #c4b5fd;
		box-shadow:
			0 0 0 1px rgba(124, 58, 237, 0.2),
			0 10px 32px rgba(124, 58, 237, 0.08);
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
		border-color: #c4b5fd;
		background: #f5f3ff;
		color: #6d28d9;
	}

	.btn-reframe-busy {
		border-color: #c4b5fd;
		background: #faf5ff;
		color: #7c3aed;
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
		inset: -10%;
		width: 120%;
		height: 120%;
		filter: blur(28px) brightness(0.85);
		transform: scale(1.08);
		pointer-events: none;
	}

	.clip-video-contain {
		object-fit: contain;
		background: #000;
	}

	.layout-blur .clip-video-mid {
		top: 29%;
		bottom: 29%;
		height: auto;
		inset: 29% 0;
		object-fit: cover;
		box-shadow: 0 8px 28px rgba(0, 0, 0, 0.4);
	}

	.layout-fit .caption-box {
		top: 8%;
	}

	.layout-blur .caption-box {
		top: 10%;
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
		background: #a78bfa;
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
		color: #64748b;
		flex-shrink: 0;
	}

	.meta-title {
		font-size: 1.05rem;
		font-weight: 800;
		letter-spacing: -0.025em;
		line-height: 1.25;
		color: #0f172a;
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
		background: #7c3aed;
		color: #fff;
		font-size: 0.8rem;
		font-weight: 700;
		cursor: pointer;
		transition: background 0.12s;
	}

	.btn-publish:hover {
		background: #6d28d9;
	}

	.btn-dl {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		padding: 0.42rem 0.85rem;
		border-radius: 0.45rem;
		border: 1px solid #e2e8f0;
		background: #fff;
		font-size: 0.8rem;
		font-weight: 650;
		color: #334155;
		cursor: pointer;
		transition:
			border-color 0.12s,
			background 0.12s;
	}

	.btn-dl:hover:not(:disabled) {
		border-color: #cbd5e1;
		background: #f8fafc;
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

	.reason-box {
		border: 1px solid #eef2f7;
		background: #f8fafc;
		border-radius: 0.65rem;
		padding: 0.7rem 0.85rem;
	}

	.reason-label {
		font-size: 0.68rem;
		font-weight: 800;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: #64748b;
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
