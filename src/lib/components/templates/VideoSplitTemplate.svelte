<script lang="ts">
	import { FONT_TEMPLATE_DEFAULT, FONT_UI_STACK } from '$lib/fonts/brand-fonts';
	/**
	 * Dual-panel 9:16 split — matches pyautoflip saliency “multi-face” output
	 * (two subjects stacked top/bottom). Before reframe, previews the same source
	 * in two CSS crops; after a saliency reframe, shows the composited MP4 full-bleed.
	 */
	interface Props {
		videoSrc?: string;
		/** When video is empty, show this still in both panels (covers / headless capture). */
		posterSrc?: string;
		/** True when `videoSrc` is already a pyautoflip saliency split-screen export. */
		autoflipComposited?: boolean;
		w?: number;
		h?: number;
		scale?: number;
		interactive?: boolean;
		exportRef?: HTMLElement | null;
		showBadge?: boolean;
		badgeLabel?: string;
		videoMuted?: boolean;
		videoVolume?: number;
		videoSeekSec?: number;
		videoTrimStartSec?: number;
		videoTrimEndSec?: number;
		onVideoDuration?: (durationSec: number) => void;
		previewMode?: boolean;
	}

	let {
		videoSrc = '',
		posterSrc = '',
		autoflipComposited = false,
		w = 1080,
		h = 1920,
		scale = 1,
		interactive = true,
		exportRef = $bindable(null),
		showBadge = true,
		badgeLabel = 'Output (9:16)',
		videoMuted = true,
		videoVolume = 0.8,
		videoSeekSec = NaN,
		videoTrimStartSec = 0,
		videoTrimEndSec = 0,
		onVideoDuration,
		previewMode = false,
	}: Props = $props();

	const DEFAULT_VIDEO = '/videos/video-template.mp4';
	const trimmedVideo = $derived((videoSrc && videoSrc.trim()) || '');
	const trimmedPoster = $derived((posterSrc && posterSrc.trim()) || '');
	const resolvedSrc = $derived(trimmedVideo || (!trimmedPoster ? DEFAULT_VIDEO : ''));
	const usePoster = $derived(!resolvedSrc && !!trimmedPoster);

	const PANEL_H = $derived(Math.floor(h / 2));
	const DIVIDER_H = 4;
	const TOP_H = $derived(PANEL_H);
	const BOTTOM_H = $derived(h - TOP_H - DIVIDER_H);

	let topEl = $state<HTMLVideoElement | null>(null);
	let bottomEl = $state<HTMLVideoElement | null>(null);
	let fullEl = $state<HTMLVideoElement | null>(null);
	let lastDuration = 0;

	function onMeta(e: Event) {
		const el = e.currentTarget as HTMLVideoElement;
		const d = Number(el.duration || 0);
		if (Number.isFinite(d) && d > 0 && Math.abs(d - lastDuration) > 0.001) {
			lastDuration = d;
			onVideoDuration?.(d);
		}
	}

	$effect(() => {
		const t = Number(videoSeekSec);
		if (!Number.isFinite(t)) return;
		for (const el of [topEl, bottomEl, fullEl]) {
			if (!el) continue;
			try {
				el.currentTime = Math.max(0, t);
			} catch {
				/* ignore seek races */
			}
		}
	});

	$effect(() => {
		const start = Number(videoTrimStartSec) || 0;
		const end = Number(videoTrimEndSec) || 0;
		const muted = videoMuted;
		const vol = Math.max(0, Math.min(1, videoVolume));
		for (const el of [topEl, bottomEl, fullEl]) {
			if (!el) continue;
			el.muted = muted;
			el.volume = muted ? 0 : vol;
			if (end > start && Number.isFinite(el.currentTime)) {
				if (el.currentTime < start || el.currentTime > end) {
					try {
						el.currentTime = start;
					} catch {
						/* ignore */
					}
				}
			}
		}
	});

	/** Keep dual CSS videos in sync while playing. */
	function onTopTimeUpdate() {
		if (autoflipComposited || !topEl || !bottomEl) return;
		if (Math.abs(topEl.currentTime - bottomEl.currentTime) > 0.12) {
			try {
				bottomEl.currentTime = topEl.currentTime;
			} catch {
				/* ignore */
			}
		}
	}
</script>

<div
	bind:this={exportRef}
	class="video-split-root"
	class:preview={previewMode}
	style="
		width: {w}px;
		height: {h}px;
		transform: scale({scale});
		transform-origin: top left;
		pointer-events: {interactive ? 'auto' : 'none'};
	"
	data-studio-canvas-root
	data-template="videoSplit"
>
	{#if autoflipComposited && resolvedSrc}
		<!-- Pyautoflip saliency already stacked both faces into one 9:16 frame -->
		<video
			bind:this={fullEl}
			class="full-video"
			src={resolvedSrc}
			playsinline
			loop
			autoplay
			muted={videoMuted}
			preload="metadata"
			onloadedmetadata={onMeta}
		></video>
	{:else if usePoster}
		<div class="panel top" style="height: {TOP_H}px;">
			<img class="panel-still" src={trimmedPoster} alt="" draggable="false" />
		</div>
		<div class="divider" style="height: {DIVIDER_H}px;" aria-hidden="true"></div>
		<div class="panel bottom" style="height: {BOTTOM_H}px;">
			<img class="panel-still bottom-still" src={trimmedPoster} alt="" draggable="false" />
		</div>
	{:else}
		<!-- CSS multi-panel preview (same source, two focal crops) -->
		<div class="panel top" style="height: {TOP_H}px;">
			<video
				bind:this={topEl}
				src={resolvedSrc}
				playsinline
				loop
				autoplay
				muted={videoMuted}
				preload="metadata"
				onloadedmetadata={onMeta}
				ontimeupdate={onTopTimeUpdate}
			></video>
		</div>
		<div class="divider" style="height: {DIVIDER_H}px;" aria-hidden="true"></div>
		<div class="panel bottom" style="height: {BOTTOM_H}px;">
			<video
				bind:this={bottomEl}
				src={resolvedSrc}
				playsinline
				loop
				autoplay
				muted={true}
				preload="metadata"
			></video>
		</div>
	{/if}

	{#if showBadge}
		<span class="badge">{badgeLabel}</span>
	{/if}
</div>

<style>
	.video-split-root {
		position: relative;
		overflow: hidden;
		background: #000;
		color: #fff;
	}
	.panel {
		position: relative;
		width: 100%;
		overflow: hidden;
		background: #0a0a0a;
	}
	.panel video,
	.panel-still,
	.full-video {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	.panel.top video,
	.panel.top .panel-still {
		object-position: center 22%;
	}
	.panel.bottom video,
	.panel.bottom .panel-still {
		object-position: center 78%;
	}
	.full-video {
		object-position: center center;
	}
	.divider {
		width: 100%;
		background: #000;
		flex-shrink: 0;
	}
	.badge {
		position: absolute;
		top: 3.2%;
		left: 4%;
		z-index: 3;
		padding: 0.2em 0.45em;
		font-family: FONT_UI_STACK;
		font-size: 42px;
		font-weight: 700;
		letter-spacing: 0.01em;
		line-height: 1.1;
		color: #fff;
		text-shadow:
			0 0 2px #000,
			1px 0 0 #000,
			-1px 0 0 #000,
			0 1px 0 #000,
			0 -1px 0 #000,
			1px 1px 0 #000,
			-1px -1px 0 #000;
		pointer-events: none;
		user-select: none;
	}
	.preview .badge {
		font-size: 11px;
		top: 6%;
		left: 6%;
	}
</style>
