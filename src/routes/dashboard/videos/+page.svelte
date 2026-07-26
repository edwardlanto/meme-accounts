<script lang="ts">
	import { onMount } from 'svelte';
	import { supabase } from '$lib/supabase';
	import { r2UploadVideo } from '$lib/r2Client';
	import type { VideoClip, VideoImportMeta } from '$lib/video-clips/types';
	import { formatTimestamp } from '$lib/video-clips/export-clip';
	import { buildClipTemplateCopy, clipDirectVideoUrl } from '$lib/video-clips/clip-template-copy';
	import { cleanClipSpeechText, hasTimedTranscript, excerptTimedLinesFromTranscript } from '$lib/video-clips/transcript-segments';
	import { normalizeVideoClips } from '$lib/video-clips/normalize-clips';
	import ClipTemplatePreviews from '$lib/components/video-clips/ClipTemplatePreviews.svelte';
	import ClipFeedCard from '$lib/components/video-clips/ClipFeedCard.svelte';
	import VideoCaptionControls from '$lib/components/video-clips/VideoCaptionControls.svelte';
	import VideoCaptionOverlay from '$lib/components/video-clips/VideoCaptionOverlay.svelte';
	import { getCaptionTemplate, type CaptionAnimation } from '$lib/video-clips/caption-templates';
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
		stashStudioClipImport,
		studioUrlForClipImport,
		type StudioClipCaptionImport,
	} from '$lib/studio/clip-import';
	import { coerceTemplateId } from '$lib/studio/template-ids';
	import { r2SignRead } from '$lib/r2Client';
	import {
		saveVideoSession,
		loadVideoSession,
		clearVideoSession,
		saveVideoFormPrefs,
		loadVideoFormPrefs,
		markVideoSessionForResume,
		shouldAutoRestoreVideoSession,
		migrateAwayFromLocalVideoSession,
		type VideoWorkflowStep,
	} from '$lib/video-clips/session-cache';
	import {
		CLIP_LENGTH_PRESETS,
		VIDEO_ASPECT_RATIOS,
		VIDEO_LAYOUT_TEMPLATES,
		applyClipLengthPreset,
		clipLengthPresetFromRange,
		videoAspectById,
		type ClipLengthPresetId,
		type VideoAspectRatioId,
		type VideoLayoutId,
	} from '$lib/video-clips/clip-presets';
	import {
		DEFAULT_CAPTION_ENHANCE,
		enhanceCaptionSegments,
		enhancePhrases,
		speechWindows,
		type CaptionEnhanceOptions,
	} from '$lib/video-clips/caption-enhance';
	import {
		Link2,
		Upload,
		Sparkles,
		Loader,
		Scissors,
		Tv,
		Film,
		Zap,
		FileVideo,
		AlertCircle,
		RotateCcw,
		Volume2,
		VolumeX,
		ChevronDown,
		Check,
		ArrowRight,
		ArrowLeft,
	} from 'lucide-svelte';

	type Phase = 'idle' | 'importing' | 'downloading' | 'analyzing' | 'ready' | 'exporting';

	const WORKFLOW_STEPS: { id: VideoWorkflowStep; label: string; hint: string }[] = [
		{ id: 'source', label: 'Video', hint: 'Import' },
		{ id: 'captions', label: 'Captions', hint: 'Style & edit' },
		{ id: 'clips', label: 'Clips', hint: 'Review & export' },
	];

	let userId = $state('');
	let phase = $state<Phase>('idle');
	let workflowStep = $state<VideoWorkflowStep>('source');
	let error = $state('');
	let toolsWarning = $state('');
	let ytDlpReady = $state(false);
	let ffmpegReady = $state(false);
	let youtubeUrl = $state('');
	let topicHint = $state('');
	let source = $state<VideoImportMeta | null>(null);
	let clips = $state<VideoClip[]>([]);
	let summary = $state('');
	let demo = $state(false);
	let model = $state('');
	let selectedClipId = $state<string | null>(null);
	let uploadProgress = $state(0);
	let fileInput = $state<HTMLInputElement | null>(null);
	let playerVideo = $state<HTMLVideoElement | null>(null);
	let captionsPreviewVideo = $state<HTMLVideoElement | null>(null);
	/** Pause sibling clip players when one starts */
	const clipVideoEls = new Map<string, HTMLVideoElement>();
	let importTab = $state<'youtube' | 'upload'>('youtube');
	let isDragging = $state(false);
	let processingHint = $state('');
	let processingTimer: ReturnType<typeof setInterval> | null = null;

	function startProcessingHints() {
		stopProcessingHints();
		const started = Date.now();
		const hints = [
			'Downloading from YouTube…',
			'Still working — compressing video…',
			'Uploading to cloud storage…',
			'Analyzing clips with AI…',
		];
		processingHint = hints[0]!;
		processingTimer = setInterval(() => {
			const elapsed = Date.now() - started;
			if (elapsed < 45_000) processingHint = hints[0]!;
			else if (elapsed < 120_000) processingHint = hints[1]!;
			else if (elapsed < 180_000) processingHint = hints[2]!;
			else processingHint = hints[3]!;
		}, 5000);
	}

	function stopProcessingHints() {
		if (processingTimer) clearInterval(processingTimer);
		processingTimer = null;
		processingHint = '';
	}

	let clipMode = $state<'highlights' | 'all'>('highlights');
	let clipCount = $state(8);
	let clipMinSec = $state(10);
	let clipMaxSec = $state(60);
	let clipLengthPreset = $state<ClipLengthPresetId>('30to60');
	let videoAspectRatio = $state<VideoAspectRatioId>('9:16');
	let clipLayout = $state<VideoLayoutId>('fit');
	let lengthMenuOpen = $state(false);
	let ratioMenuOpen = $state(false);
	let captionEnhance = $state<CaptionEnhanceOptions>({ ...DEFAULT_CAPTION_ENHANCE });
	/** Optional session the user can resume manually (not auto-loaded on login). */
	let resumableSession = $state<{ title: string; clipCount: number } | null>(null);
	/** Gate persistence until cached session/prefs are loaded (avoids overwriting on boot). */
	let sessionHydrated = $state(false);

	// Caption state — CapCut-style chunked captions
	let captionEnabled = $state(false);
	let captionTemplateId = $state('capcut-pop');
	let captionFontSize = $state(40);
	let captionPosition = $state<'top' | 'center' | 'bottom'>('bottom');
	let captionCustomColor = $state('#ffffff');
	let captionCustomBgColor = $state('transparent');
	let captionCustomHighlightColor = $state('#ffeb3b');
	let captionDraggable = $state(false);
	let captionCustomX = $state<number | null>(null);
	let captionCustomY = $state<number | null>(null);
	let captionSelectedFont = $state('Inter');
	let captionStrokeEnabled = $state(true);
	let captionAnimationOverride = $state<CaptionAnimation | null>(null);
	let captionChunkOverride = $state<number | null>(null);
	let captionSegments = $state<CaptionSegment[]>([]);
	let captionPhrases = $state<CaptionPhrase[]>([]);
	let activeCaptionPhrase = $state<CaptionPhrase | null>(null);
	let activeCaptionWordIndex = $state(-1);
	let videoCurrentTime = $state(0);
	let videoMuted = $state(true);
	/** Prevents reloading transcript from wiping in-progress text edits */
	let captionSegmentsKey = $state('');
	/** Latest phrases for rAF without re-subscribing every rebuild */
	let captionPhrasesRef: CaptionPhrase[] = [];

	function toggleVideoMuted() {
		videoMuted = !videoMuted;
		for (const v of clipVideoEls.values()) {
			v.muted = videoMuted;
		}
		if (playerVideo) playerVideo.muted = videoMuted;
	}

	function seekCaptionTo(sec: number) {
		const v = playerVideo;
		if (!v) return;
		v.currentTime = Math.max(0, sec);
		videoCurrentTime = v.currentTime;
		void v.play().catch(() => {});
	}

	function buildCaptionSegmentsForClip(clip: VideoClip | null | undefined): CaptionSegment[] {
		if (!clip) return [];

		let segments: CaptionSegment[] = [];
		const fullTimed = source?.transcript;
		if (fullTimed && hasTimedTranscript(fullTimed)) {
			const timedExcerpt = excerptTimedLinesFromTranscript(
				fullTimed,
				clip.startSec,
				clip.endSec,
			);
			if (timedExcerpt.trim()) {
				segments = dedupeAdjacentSegments(parseTimedTranscriptToSegments(timedExcerpt));
			}
		}

		if (!segments.length) {
			const transcript = clip.transcript;
			if (!transcript) return [];

			if (hasTimedTranscript(transcript)) {
				segments = dedupeAdjacentSegments(parseTimedTranscriptToSegments(transcript));
			} else {
				const duration = clip.endSec - clip.startSec;
				segments = dedupeAdjacentSegments(
					parseUntimedTranscriptToSegments(transcript, clip.startSec, duration),
				);
			}
		}

		return enhanceCaptionSegments(segments, captionEnhance);
	}

	const selectedClip = $derived(clips.find((c) => c.id === selectedClipId) ?? clips[0] ?? null);

	function buildCaptionImportForClip(clip: VideoClip): StudioClipCaptionImport | null {
		if (!captionEnabled) return null;
		const segments =
			clip.id === selectedClip?.id && captionSegments.length
				? captionSegments
				: buildCaptionSegmentsForClip(clip);
		if (!segments.length) return null;
		return {
			enabled: true,
			segments,
			templateId: captionTemplateId,
			fontSize: captionFontSize,
			position: captionPosition,
			customColor: captionCustomColor,
			customBgColor: captionCustomBgColor,
			customHighlightColor: captionCustomHighlightColor,
			selectedFont: captionSelectedFont,
			strokeEnabled: captionStrokeEnabled,
			animationOverride: captionAnimationOverride,
			wordsPerChunk: captionChunkOverride,
			customX: captionCustomX,
			customY: captionCustomY,
		};
	}

	function resetCaptionEdits() {
		captionSegments = buildCaptionSegmentsForClip(selectedClip);
	}

	const captionTemplate = $derived(getCaptionTemplate(captionTemplateId));
	const hasTranscriptForCaptions = $derived(
		!!(
			(source?.transcript && source.transcript.trim()) ||
			clips.some((c) => !!(c.transcript && c.transcript.trim()))
		),
	);
	const workflowStepIndex = $derived(
		WORKFLOW_STEPS.findIndex((s) => s.id === workflowStep),
	);

	function enterCaptionsStep() {
		phase = 'ready';
		workflowStep = 'captions';
		const hasTx = !!(
			source?.transcript?.trim() ||
			clips.some((c) => !!(c.transcript && c.transcript.trim()))
		);
		if (hasTx) captionEnabled = true;
		const clip = clips[0];
		if (clip) selectedClipId = clip.id;
	}

	function goToClipsStep() {
		if (!source || !clips.length) return;
		workflowStep = 'clips';
		persistSession();
	}

	function goToCaptionsStep() {
		if (!source || !clips.length) return;
		if (phase !== 'ready' && phase !== 'exporting') return;
		workflowStep = 'captions';
		persistSession();
	}

	function setWorkflowStep(step: VideoWorkflowStep) {
		if (step === 'source') {
			chooseAnotherVideo();
			return;
		}
		if (!source || !clips.length) return;
		if (phase !== 'ready' && phase !== 'exporting') return;
		workflowStep = step;
		persistSession();
	}

	function onCaptionsPreviewReady(el: HTMLVideoElement) {
		captionsPreviewVideo = el;
		playerVideo = el;
		const clip = selectedClip;
		if (clip) {
			el.currentTime = clip.startSec;
		}
		syncClipsToPlayerDuration(el);
	}

	function onCaptionsPreviewTimeUpdate() {
		const v = captionsPreviewVideo;
		const clip = selectedClip;
		if (!v || !clip) return;
		playerVideo = v;
		if (v.currentTime < clip.startSec - 0.05) v.currentTime = clip.startSec;
		if (v.currentTime >= clip.endSec - 0.05) {
			v.pause();
			v.currentTime = clip.startSec;
		}
		if (!captionEnabled) videoCurrentTime = v.currentTime;
	}

	function playCaptionsPreview() {
		const v = captionsPreviewVideo;
		const clip = selectedClip;
		if (!v || !clip) return;
		playerVideo = v;
		if (v.currentTime < clip.startSec || v.currentTime >= clip.endSec - 0.05) {
			v.currentTime = clip.startSec;
		}
		void v.play().catch(() => {});
	}

	function openClipInStudio(clip: VideoClip, templateRaw: string = 'videoFit') {
		if (!source) return;
		const preferred =
			templateRaw ||
			VIDEO_LAYOUT_TEMPLATES.find((l) => l.id === clipLayout)?.studioId ||
			'videoFit';
		const template = coerceTemplateId(preferred);
		const directVideo = clipDirectVideoUrl(source);
		const videoUrl = directVideo || String(source.playbackUrl ?? '').trim();
		const looksYoutube = /youtube\.com\/embed|youtu\.be\//i.test(videoUrl);
		const copy = buildClipTemplateCopy(clip, source, {
			watermark: topicHint.trim() || 'VIRAL CLIP',
			topicHint: topicHint.trim(),
		});
		if (videoUrl && !looksYoutube) {
			stashStudioClipImport({
				template,
				videoUrl,
				clipStart: clip.startSec,
				clipEnd: clip.endSec,
				thumbnailUrl: source.thumbnailUrl || undefined,
				newsHeadline: copy.newsHeadline,
				newsSource: copy.newsSource,
				storyHeadline: copy.storyHeadline,
				storyWatermark: copy.storyWatermark,
				tweetTop: copy.tweetTop,
				tweetBottom: copy.tweetBottom,
				carouselName: copy.carouselName,
				carouselHandle: copy.carouselHandle,
				carouselBody: copy.carouselBody,
				captions: buildCaptionImportForClip(clip),
			});
		} else {
			console.warn('[videos] Open in Studio: no direct video URL', {
				hasDirect: !!directVideo,
				r2Key: !!source.r2Key,
			});
		}
		persistSession();
		markVideoSessionForResume();
		window.location.href = studioUrlForClipImport(template);
	}

	function handleCaptionPositionChange(x: number, y: number) {
		captionCustomX = x;
		captionCustomY = y;
	}

	const hasStoredVideo = $derived(!!source?.r2Key);
	const captionImportPayload = $derived(
		selectedClip ? buildCaptionImportForClip(selectedClip) : null,
	);
	const isBusy = $derived(
		phase === 'analyzing' || phase === 'importing' || phase === 'downloading',
	);
	const isExporting = $derived((phase as string) === 'exporting');

	const clipMaxLabel = $derived(
		clipMaxSec >= 180
			? '3 min'
			: clipMaxSec >= 60
				? `${Math.round(clipMaxSec / 60)} min`
				: `${clipMaxSec}s`,
	);

	const clipLengthLabel = $derived(
		CLIP_LENGTH_PRESETS.find((p) => p.id === clipLengthPreset)?.label ?? 'Any length',
	);
	const aspectMeta = $derived(videoAspectById(videoAspectRatio));

	function setClipLengthPreset(id: ClipLengthPresetId) {
		clipLengthPreset = id;
		const { minSec, maxSec } = applyClipLengthPreset(id);
		clipMinSec = minSec;
		clipMaxSec = maxSec;
		lengthMenuOpen = false;
	}

	$effect(() => {
		if (clipMaxSec < clipMinSec) clipMaxSec = clipMinSec;
	});

	function registerClipVideo(clipId: string, el: HTMLVideoElement) {
		clipVideoEls.set(clipId, el);
		if (clipId === selectedClipId) playerVideo = el;
		syncClipsToPlayerDuration(el);
	}

	function pauseOtherClipVideos(except: HTMLVideoElement | null) {
		for (const el of clipVideoEls.values()) {
			if (el !== except && !el.paused) el.pause();
		}
	}

	function playClipSegment(clip: VideoClip) {
		const v = clipVideoEls.get(clip.id) ?? playerVideo;
		if (!v) return;
		playerVideo = v;
		pauseOtherClipVideos(v);
		v.currentTime = clip.startSec;
		void v.play().catch(() => {});
	}

	function onClipCardTimeUpdate(t: number, el: HTMLVideoElement) {
		if (selectedClipId && clipVideoEls.get(selectedClipId) !== el && el !== playerVideo) return;
		playerVideo = el;
		if (!captionEnabled) {
			videoCurrentTime = t;
		}
	}

	// High-frequency caption sync — only write state when phrase/word changes (avoids 60fps Svelte churn)
	let rafHandle: number | null = null;
	let lastPhraseKey = '';
	let lastWordIdx = -1;
	function tickCaptionTime() {
		const v = playerVideo;
		if (v && !v.paused && captionEnabled) {
			const t = v.currentTime;
			const phrase = getActivePhrase(captionPhrasesRef, t);
			const wordIdx = phrase ? getActiveWordIndex(phrase, t) : -1;
			const phraseKey = phrase ? `${phrase.startSec}|${phrase.text}` : '';
			if (phraseKey !== lastPhraseKey || wordIdx !== lastWordIdx) {
				lastPhraseKey = phraseKey;
				lastWordIdx = wordIdx;
				videoCurrentTime = t;
				activeCaptionPhrase = phrase;
				activeCaptionWordIndex = wordIdx;
			}
		}
		rafHandle = requestAnimationFrame(tickCaptionTime);
	}

	$effect(() => {
		if (!captionEnabled) {
			if (rafHandle != null) cancelAnimationFrame(rafHandle);
			rafHandle = null;
			activeCaptionPhrase = null;
			activeCaptionWordIndex = -1;
			lastPhraseKey = '';
			lastWordIdx = -1;
			return;
		}
		rafHandle = requestAnimationFrame(tickCaptionTime);
		return () => {
			if (rafHandle != null) cancelAnimationFrame(rafHandle);
			rafHandle = null;
		};
	});

	function syncClipsToPlayerDuration(v: HTMLVideoElement) {
		const d = v.duration;
		if (!source || !Number.isFinite(d) || d <= 0) return;
		const realDur = Math.round(d * 10) / 10;
		if (Math.abs(realDur - source.durationSec) <= 0.5) return;
		source = { ...source, durationSec: realDur };
		clips = normalizeVideoClips(clips, realDur, clipMinSec, clipMaxSec);
		if (selectedClipId && !clips.some((c) => c.id === selectedClipId)) {
			selectedClipId = clips[0]?.id ?? null;
		}
	}

	function selectClip(clip: VideoClip, opts: { play?: boolean } = {}) {
		selectedClipId = clip.id;
		const el = clipVideoEls.get(clip.id) ?? (workflowStep === 'captions' ? captionsPreviewVideo : null);
		if (el) {
			playerVideo = el;
			if (workflowStep === 'captions') {
				el.currentTime = clip.startSec;
				videoCurrentTime = clip.startSec;
			}
		}
		if (opts.play !== false && workflowStep === 'clips') playClipSegment(clip);
		requestAnimationFrame(() => {
			document.getElementById(`clip-card-${clip.id}`)?.scrollIntoView({
				behavior: 'smooth',
				block: 'nearest',
			});
			document.getElementById(`clip-nav-${clip.id}`)?.scrollIntoView({
				behavior: 'smooth',
				block: 'nearest',
			});
		});
	}

	$effect(() => {
		const clip = selectedClip;
		if (!clip || phase !== 'ready') return;
		const v = clipVideoEls.get(clip.id);
		if (v) playerVideo = v;
	});

	$effect(() => {
		const clip = selectedClip;
		if (!clip) {
			captionSegments = [];
			captionSegmentsKey = '';
			return;
		}

		// Rebuild when clip, transcript, or enhance toggles change
		const enhKey = [
			captionEnhance.addEmojis,
			captionEnhance.highlightKeywords,
			captionEnhance.autoCensor,
			captionEnhance.removeSilences,
		].join(',');
		const key = `${clip.id}|${clip.startSec}|${clip.endSec}|${source?.transcript?.length ?? 0}|${clip.transcript?.length ?? 0}|${enhKey}`;
		if (key === captionSegmentsKey) return;
		captionSegmentsKey = key;
		captionSegments = buildCaptionSegmentsForClip(selectedClip);
	});

	$effect(() => {
		if (!captionSegments.length) {
			captionPhrases = [];
			captionPhrasesRef = [];
			return;
		}
		const tpl = getCaptionTemplate(captionTemplateId);
		const chunkSize = captionChunkOverride ?? tpl.wordsPerChunk;
		const phrases = enhancePhrases(segmentsToPhrases(captionSegments, chunkSize), captionEnhance);
		captionPhrases = phrases;
		captionPhrasesRef = phrases;
	});

	function analyzeClipPayload(extra: Record<string, unknown>) {
		return {
			...extra,
			topicHint: topicHint.trim() || undefined,
			clipMinSec,
			clipMaxSec,
			segmentAll: clipMode === 'all',
			...(clipMode === 'highlights'
				? { clipCount: Math.max(1, Math.min(40, Math.round(Number(clipCount)) || 1)) }
				: {}),
		};
	}

	function persistFormPrefs() {
		if (!sessionHydrated) return;
		saveVideoFormPrefs({
			youtubeUrl,
			topicHint,
			importTab,
			clipMode,
			clipCount,
			clipMinSec,
			clipMaxSec,
			videoAspectRatio,
			clipLayout,
		});
	}

	function persistSession() {
		if (!sessionHydrated) return;
		if (phase !== 'ready' || !source || !clips.length) return;
		saveVideoSession({
			youtubeUrl,
			topicHint,
			importTab,
			clipMode,
			clipCount,
			clipMinSec,
			clipMaxSec,
			source,
			clips,
			summary,
			demo,
			model,
			selectedClipId,
			workflowStep: workflowStep === 'source' ? 'captions' : workflowStep,
		});
		persistFormPrefs();
	}

	async function refreshPlaybackUrlIfNeeded(meta: VideoImportMeta): Promise<VideoImportMeta> {
		const key = String(meta.r2Key ?? '').trim();
		if (!key) return meta;
		try {
			const { url } = await r2SignRead({ key });
			if (url?.trim()) return { ...meta, playbackUrl: url.trim() };
		} catch (e) {
			console.warn('[videos] could not refresh signed playback URL', e);
		}
		return meta;
	}

	async function applyCachedSession(cached: NonNullable<ReturnType<typeof loadVideoSession>>) {
		youtubeUrl = cached.youtubeUrl || youtubeUrl;
		topicHint = cached.topicHint || topicHint;
		importTab = cached.importTab === 'upload' ? 'upload' : 'youtube';
		clipMode = cached.clipMode === 'all' ? 'all' : 'highlights';
		clipCount = Math.max(1, Math.min(40, Number(cached.clipCount) || clipCount));
		clipMinSec = Math.max(5, Number(cached.clipMinSec) || clipMinSec);
		clipMaxSec = Math.max(clipMinSec, Number(cached.clipMaxSec) || clipMaxSec);
		clipLengthPreset = clipLengthPresetFromRange(clipMinSec, clipMaxSec);

		source = await refreshPlaybackUrlIfNeeded(cached.source);
		clips = normalizeVideoClips(
			cached.clips,
			source.durationSec || 1,
			clipMinSec,
			clipMaxSec,
		);
		summary = cached.summary ?? '';
		demo = !!cached.demo;
		model = cached.model ?? '';
		selectedClipId =
			cached.selectedClipId && clips.some((c) => c.id === cached.selectedClipId)
				? cached.selectedClipId
				: (clips[0]?.id ?? null);
		phase = 'ready';
		workflowStep =
			cached.workflowStep === 'captions' || cached.workflowStep === 'clips'
				? cached.workflowStep
				: 'clips';
		resumableSession = null;
	}

	async function restoreCachedSession() {
		migrateAwayFromLocalVideoSession();

		const prefs = loadVideoFormPrefs();
		if (prefs) {
			youtubeUrl = prefs.youtubeUrl ?? '';
			topicHint = prefs.topicHint ?? '';
			importTab = prefs.importTab === 'upload' ? 'upload' : 'youtube';
			clipMode = prefs.clipMode === 'all' ? 'all' : 'highlights';
			clipCount = Math.max(1, Math.min(40, Number(prefs.clipCount) || 8));
			clipMinSec = Math.max(5, Number(prefs.clipMinSec) || 10);
			clipMaxSec = Math.max(clipMinSec, Number(prefs.clipMaxSec) || 60);
			clipLengthPreset = clipLengthPresetFromRange(clipMinSec, clipMaxSec);
			const ar = String(prefs.videoAspectRatio ?? '');
			if (ar === '9:16' || ar === '1:1' || ar === '16:9') videoAspectRatio = ar;
			const lay = String(prefs.clipLayout ?? '');
			if (lay === 'fit' || lay === 'blur' || lay === 'story') clipLayout = lay;
		}

		const cached = loadVideoSession();
		if (!cached) {
			resumableSession = null;
			return;
		}

		// Auto-restore only after Studio / browser Back — not on every login or nav click
		if (shouldAutoRestoreVideoSession()) {
			await applyCachedSession(cached);
			return;
		}

		resumableSession = {
			title: cached.source?.title?.trim() || 'Last video',
			clipCount: cached.clips?.length ?? 0,
		};
	}

	async function resumeLastSession() {
		const cached = loadVideoSession();
		if (!cached) {
			resumableSession = null;
			return;
		}
		await applyCachedSession(cached);
		persistSession();
	}

	function dismissResumableSession() {
		clearVideoSession();
		resumableSession = null;
	}

	onMount(async () => {
		const {
			data: { user },
		} = await supabase.auth.getUser();
		userId = user?.id ?? '';
		try {
			const res = await fetch('/api/videos/tools');
			const t = await res.json();
			ytDlpReady = !!t.ytDlp;
			ffmpegReady = !!t.ffmpeg;
			if (!t.ytDlp) {
				toolsWarning = 'Install yt-dlp for YouTube download + MP4 clips: brew install yt-dlp';
			} else if (!t.ffmpeg) {
				toolsWarning = 'Install ffmpeg for MP4 export: brew install ffmpeg';
			} else if (!t.ytDlpCookiesFile && !t.ytDlpCookiesBrowser) {
				toolsWarning =
					'YouTube may return HTTP 403 without cookies. Log into YouTube in Chrome, add YT_DLP_COOKIES_BROWSER=chrome to .env, and restart the server.';
			}
		} catch {
			toolsWarning = 'Could not check video tools (yt-dlp / ffmpeg).';
		}
		await restoreCachedSession();
		sessionHydrated = true;
		// Save once after hydrate so refreshed signed URLs stick
		if (phase === 'ready') persistSession();
		else persistFormPrefs();
	});

	// Keep last session / form prefs warm while working
	$effect(() => {
		youtubeUrl;
		topicHint;
		importTab;
		clipMode;
		clipCount;
		clipMinSec;
		clipMaxSec;
		persistFormPrefs();
	});

	$effect(() => {
		phase;
		source;
		clips;
		summary;
		demo;
		model;
		selectedClipId;
		workflowStep;
		if (phase === 'ready' && source && clips.length) persistSession();
	});

	async function analyzeFromYoutube() {
		const url = youtubeUrl.trim();
		if (!url) {
			error = 'Paste a YouTube URL first';
			return;
		}
		error = '';
		phase = ytDlpReady ? 'downloading' : 'analyzing';
		if (ytDlpReady) startProcessingHints();
		try {
			const res = await fetch('/api/videos/analyze', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(analyzeClipPayload({ source: 'youtube', youtubeUrl: url })),
			});
			const data = await res.json();
			if (!res.ok) throw new Error(data.error ?? 'Analysis failed');
			source = data.source;
			clips = normalizeVideoClips(
				data.clips ?? [],
				data.source?.durationSec ?? 1,
				clipMinSec,
				clipMaxSec,
			);
			summary = data.summary ?? '';
			demo = !!data.demo;
			model = data.model ?? '';
			toolsWarning = String(data.warning ?? toolsWarning);
			selectedClipId = clips[0]?.id ?? null;
			enterCaptionsStep();
		} catch (e: unknown) {
			error = e instanceof Error ? e.message : String(e);
			phase = 'idle';
			workflowStep = 'source';
		} finally {
			stopProcessingHints();
		}
	}

	async function onFileChange(e: Event) {
		const file = (e.target as HTMLInputElement).files?.[0];
		if (!file || !userId) return;
		error = '';
		phase = 'importing';
		uploadProgress = 10;
		try {
			const key = `${userId}/videos/${crypto.randomUUID()}-${file.name.replace(/[^\w.-]+/g, '_')}`;
			uploadProgress = 30;
			const up = await r2UploadVideo({ key, blob: file, filename: file.name });
			uploadProgress = 70;

			const video = document.createElement('video');
			video.preload = 'metadata';
			const objectUrl = URL.createObjectURL(file);
			const durationSec = await new Promise<number>((resolve) => {
				video.onloadedmetadata = () => {
					const d = Number(video.duration);
					URL.revokeObjectURL(objectUrl);
					resolve(Number.isFinite(d) && d > 0 ? d : 1);
				};
				video.onerror = () => {
					URL.revokeObjectURL(objectUrl);
					resolve(1);
				};
				video.src = objectUrl;
			});

			phase = 'analyzing';
			uploadProgress = 85;
			const res = await fetch('/api/videos/analyze', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(
					analyzeClipPayload({
						source: 'upload',
						r2Key: up.key,
						title: file.name.replace(/\.[^.]+$/, ''),
						durationSec,
					}),
				),
			});
			const data = await res.json();
			if (!res.ok) throw new Error(data.error ?? 'Analysis failed');
			source = data.source;
			clips = normalizeVideoClips(
				data.clips ?? [],
				data.source?.durationSec ?? durationSec,
				clipMinSec,
				clipMaxSec,
			);
			summary = data.summary ?? '';
			demo = !!data.demo;
			model = data.model ?? '';
			selectedClipId = clips[0]?.id ?? null;
			uploadProgress = 100;
			enterCaptionsStep();
		} catch (err: unknown) {
			error = err instanceof Error ? err.message : String(err);
			phase = 'idle';
			workflowStep = 'source';
		} finally {
			if (fileInput) fileInput.value = '';
		}
	}

	function onDragOver(e: DragEvent) {
		e.preventDefault();
		isDragging = true;
	}
	function onDragLeave() {
		isDragging = false;
	}
	function onDrop(e: DragEvent) {
		e.preventDefault();
		isDragging = false;
		const file = e.dataTransfer?.files?.[0];
		if (!file) return;
		const fakeEvent = { target: { files: [file] } } as unknown as Event;
		void onFileChange(fakeEvent);
	}

	function parseDownloadFilename(header: string | null, fallback: string): string {
		if (!header) return fallback;
		const star = /filename\*=UTF-8''([^;]+)/i.exec(header);
		if (star?.[1]) {
			try {
				return decodeURIComponent(star[1]);
			} catch {
				/* use fallback */
			}
		}
		const plain = /filename="([^"]+)"/i.exec(header);
		return plain?.[1] ?? fallback;
	}

	async function downloadClip(clip: VideoClip) {
		if (!source?.r2Key) {
			error = 'Full download requires yt-dlp. Run: brew install yt-dlp, then analyze again.';
			return;
		}
		if (!ffmpegReady) {
			error = 'ffmpeg is required for MP4 export. Run: brew install ffmpeg';
			return;
		}
		error = '';
		phase = 'exporting';
		try {
			const body: Record<string, unknown> = {
				r2Key: source.r2Key,
				startSec: clip.startSec,
				endSec: clip.endSec,
				filename: clip.title,
			};
			if (captionEnhance.removeSilences) {
				const segs = buildCaptionSegmentsForClip(clip);
				const windows = speechWindows(segs, clip.startSec, clip.endSec);
				if (windows.length > 1) body.speechWindows = windows;
			}
			const res = await fetch('/api/videos/export-clip', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(body),
			});
			if (!res.ok) {
				const data = await res.json().catch(() => ({}));
				throw new Error(data.error ?? `Export failed (${res.status})`);
			}
			const blob = await res.blob();
			if (!blob.size) throw new Error('Export returned an empty file');
			const fallbackName = `${clip.title.replace(/[^\w.-]+/g, '_').slice(0, 80) || 'clip'}.mp4`;
			const filename = parseDownloadFilename(
				res.headers.get('Content-Disposition'),
				fallbackName,
			);
			const url = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = filename;
			a.rel = 'noopener';
			document.body.appendChild(a);
			a.click();
			a.remove();
			URL.revokeObjectURL(url);
		} catch (e: unknown) {
			error = e instanceof Error ? e.message : String(e);
		} finally {
			phase = 'ready';
		}
	}

	function chooseAnotherVideo() {
		clearVideoSession();
		resumableSession = null;
		phase = 'idle';
		workflowStep = 'source';
		source = null;
		clips = [];
		summary = '';
		selectedClipId = null;
		error = '';
		demo = false;
		model = '';
		captionEnabled = false;
		captionSegments = [];
		captionPhrases = [];
		captionPhrasesRef = [];
		captionSegmentsKey = '';
		activeCaptionPhrase = null;
		activeCaptionWordIndex = -1;
		playerVideo = null;
		captionsPreviewVideo = null;
		clipVideoEls.clear();
		persistFormPrefs();
	}
</script>

<div class="videos-page">
	<nav class="workflow-stepper" aria-label="Clip workflow">
		{#each WORKFLOW_STEPS as step, i (step.id)}
			{@const done = i < workflowStepIndex}
			{@const active = step.id === workflowStep}
			{@const reachable =
				step.id === 'source'
					? workflowStep !== 'source'
					: (phase === 'ready' || phase === 'exporting') && !!source && clips.length > 0}
			{#if i > 0}
				<span class="stepper-line" class:stepper-line-on={done || active} aria-hidden="true"></span>
			{/if}
			<button
				type="button"
				class="stepper-step"
				class:stepper-step-on={active}
				class:stepper-step-done={done}
				disabled={active || !reachable}
				aria-current={active ? 'step' : undefined}
				onclick={() => setWorkflowStep(step.id)}
			>
				<span class="stepper-num" aria-hidden="true">
					{#if done}
						<Check size={14} />
					{:else}
						{i + 1}
					{/if}
				</span>
				<span class="stepper-copy">
					<span class="stepper-label">{step.label}</span>
					<span class="stepper-hint">{step.hint}</span>
				</span>
			</button>
		{/each}
	</nav>

	<!-- ── HERO / IMPORT (step 1) ── -->
	{#if workflowStep === 'source'}
	<header class="videos-hero">
		<div class="hero-glow" aria-hidden="true"></div>
		<div class="videos-hero-inner">
			<div class="videos-hero-badge">
				<Scissors size={13} />
				AI clip finder
			</div>

			<h1 class="videos-title">
				Turn long videos into<br /><span class="title-accent">viral clips</span>
			</h1>
			<p class="videos-sub">
				Paste a YouTube link or upload a file — Vertex Gemini finds the best moments, ffmpeg
				exports the MP4s.
			</p>

			{#if resumableSession}
				<div class="resume-banner" role="status">
					<div class="resume-copy">
						<strong>Continue last clips?</strong>
						<span>
							{resumableSession.title}
							· {resumableSession.clipCount} clip{resumableSession.clipCount === 1 ? '' : 's'}
						</span>
					</div>
					<div class="resume-actions">
						<button type="button" class="btn-resume" onclick={() => void resumeLastSession()}>
							Open clips
						</button>
						<button type="button" class="btn-resume-dismiss" onclick={dismissResumableSession}>
							Dismiss
						</button>
					</div>
				</div>
			{/if}

			{#if toolsWarning}
				<div class="tools-warn" role="status">
					<AlertCircle size={14} />
					<span>{toolsWarning}</span>
				</div>
			{/if}

			<div class="import-card">
				<!-- Functional tabs -->
				<div class="import-tabs" role="tablist">
					<button
						role="tab"
						aria-selected={importTab === 'youtube'}
						class="import-tab"
						class:import-tab-on={importTab === 'youtube'}
						onclick={() => (importTab = 'youtube')}
					>
						<Tv size={14} /> YouTube
					</button>
					<button
						role="tab"
						aria-selected={importTab === 'upload'}
						class="import-tab"
						class:import-tab-on={importTab === 'upload'}
						onclick={() => (importTab = 'upload')}
					>
						<FileVideo size={14} /> Upload file
					</button>
				</div>

				{#if importTab === 'youtube'}
					<div class="import-row">
						<Link2 size={16} class="import-icon" />
						<input
							type="url"
							class="import-input"
							placeholder="https://www.youtube.com/watch?v=…"
							bind:value={youtubeUrl}
							disabled={isBusy}
							onkeydown={(e) => e.key === 'Enter' && void analyzeFromYoutube()}
						/>
						<button
							type="button"
							class="btn-primary"
							disabled={isBusy}
							onclick={() => void analyzeFromYoutube()}
						>
							{#if phase === 'downloading'}
								<Loader size={15} class="spin" />
								{processingHint || 'Processing video…'}
							{:else if phase === 'analyzing'}
								<Loader size={15} class="spin" /> Analyzing…
							{:else}
								<Sparkles size={15} /> Find clips
							{/if}
						</button>
					</div>
				{:else}
					<!-- svelte-ignore a11y_no_static_element_interactions -->
					<label
						class="upload-zone"
						class:upload-zone-drag={isDragging}
						class:upload-zone-busy={isBusy}
						ondragover={onDragOver}
						ondragleave={onDragLeave}
						ondrop={onDrop}
					>
						<input
							bind:this={fileInput}
							type="file"
							accept="video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov"
							class="sr-only"
							disabled={!userId || isBusy}
							onchange={onFileChange}
						/>
						{#if phase === 'importing'}
							<Loader size={28} class="spin upload-loader" />
							<span class="upload-title">Uploading…</span>
							<div class="upload-bar">
								<div class="upload-bar-fill" style="width: {uploadProgress}%"></div>
							</div>
							<span class="upload-pct">{Math.round(uploadProgress)}%</span>
						{:else if phase === 'analyzing'}
							<Sparkles size={28} class="upload-pulse" />
							<span class="upload-title">Analyzing with Gemini…</span>
						{:else}
							<FileVideo size={28} class="upload-icon" />
							<span class="upload-title"
								>{isDragging ? 'Drop to analyze' : 'Drop a video or click to upload'}</span
							>
							<span class="upload-hint">MP4 · WebM · MOV · up to 200 MB</span>
						{/if}
					</label>
				{/if}

				<!-- Clip settings -->
				<fieldset class="clip-settings">
					<legend class="clip-settings-legend">Clip settings</legend>

					<div class="clip-mode-row" role="radiogroup" aria-label="Clip mode">
						<label class="clip-mode-opt" class:clip-mode-opt-on={clipMode === 'highlights'}>
							<input type="radio" name="clip-mode" value="highlights" bind:group={clipMode} />
							<Zap size={13} /> Best highlights
						</label>
						<label class="clip-mode-opt" class:clip-mode-opt-on={clipMode === 'all'}>
							<input type="radio" name="clip-mode" value="all" bind:group={clipMode} />
							<Film size={13} /> Clip entire video
						</label>
					</div>

					{#if clipMode === 'highlights'}
						<label class="clip-field">
							<span class="clip-field-label">Number of clips</span>
							<input
								type="number"
								class="clip-number"
								min={1}
								max={40}
								step={1}
								bind:value={clipCount}
								disabled={isBusy}
							/>
						</label>
					{:else}
						<p class="clip-mode-hint">
							Splits the full video into back-to-back segments using the length range below.
						</p>
					{/if}

					<div class="clip-field clip-dropdown-field">
						<span class="clip-field-label">Clip length</span>
						<div class="dropdown-wrap">
							<button
								type="button"
								class="dropdown-trigger"
								disabled={isBusy}
								aria-expanded={lengthMenuOpen}
								onclick={() => {
									lengthMenuOpen = !lengthMenuOpen;
									ratioMenuOpen = false;
								}}
							>
								<span>{clipLengthLabel}</span>
								<ChevronDown size={16} />
							</button>
							{#if lengthMenuOpen}
								<ul class="dropdown-menu" role="listbox">
									{#each CLIP_LENGTH_PRESETS as p (p.id)}
										<li>
											<button
												type="button"
												class="dropdown-option"
												class:dropdown-option-on={clipLengthPreset === p.id}
												onclick={() => setClipLengthPreset(p.id)}
											>
												{#if clipLengthPreset === p.id}
													<span class="dropdown-check" aria-hidden="true">✓</span>
												{:else}
													<span class="dropdown-check" aria-hidden="true"></span>
												{/if}
												{p.label}
											</button>
										</li>
									{/each}
								</ul>
							{/if}
						</div>
					</div>

					<div class="clip-field clip-dropdown-field">
						<span class="clip-field-label">Aspect ratio</span>
						<div class="dropdown-wrap">
							<button
								type="button"
								class="dropdown-trigger"
								disabled={isBusy}
								aria-expanded={ratioMenuOpen}
								onclick={() => {
									ratioMenuOpen = !ratioMenuOpen;
									lengthMenuOpen = false;
								}}
							>
								<span>Ratio {videoAspectRatio}</span>
								<ChevronDown size={16} />
							</button>
							{#if ratioMenuOpen}
								<ul class="dropdown-menu" role="listbox">
									{#each VIDEO_ASPECT_RATIOS as a (a.id)}
										<li>
											<button
												type="button"
												class="dropdown-option"
												class:dropdown-option-on={videoAspectRatio === a.id}
												onclick={() => {
													videoAspectRatio = a.id;
													ratioMenuOpen = false;
												}}
											>
												{#if videoAspectRatio === a.id}
													<span class="dropdown-check" aria-hidden="true">✓</span>
												{:else}
													<span class="dropdown-check" aria-hidden="true"></span>
												{/if}
												<span class="ratio-icon" data-ratio={a.id} aria-hidden="true"></span>
												{a.label}
											</button>
										</li>
									{/each}
								</ul>
							{/if}
						</div>
					</div>

					<div class="clip-field">
						<span class="clip-field-label">Video template</span>
						<div class="layout-picker" role="listbox" aria-label="Video template">
							{#each VIDEO_LAYOUT_TEMPLATES as lay (lay.id)}
								<button
									type="button"
									class="layout-chip"
									class:layout-chip-on={clipLayout === lay.id}
									disabled={isBusy}
									onclick={() => (clipLayout = lay.id)}
								>
									{lay.label}
								</button>
							{/each}
						</div>
					</div>
				</fieldset>

				<div class="hint-row">
					<Sparkles size={13} class="hint-icon" />
					<input
						type="text"
						class="hint-input"
						placeholder="Topic or angle hint — e.g. motivation, startup advice"
						bind:value={topicHint}
					/>
				</div>
			</div>

			{#if error}
				<div class="videos-error" role="alert">
					<AlertCircle size={14} />
					{error}
				</div>
			{/if}
		</div>
	</header>
	{/if}

	<!-- ── CAPTIONS (step 2) ── -->
	{#if workflowStep === 'captions' && source}
		<section class="captions-step" aria-label="Caption settings">
			{#if error}
				<div class="videos-error results-error" role="alert">
					<AlertCircle size={14} />
					{error}
				</div>
			{/if}

			<div class="captions-head">
				<div class="captions-head-info">
					<h2 class="results-title">Style your captions</h2>
					<p class="captions-sub">
						Tune subtitles for <strong>{source.title}</strong>
						{#if clips.length}
							· {clips.length} clip{clips.length === 1 ? '' : 's'} ready
						{/if}
					</p>
				</div>
				<div class="captions-head-actions">
					<button type="button" class="btn-ghost" onclick={chooseAnotherVideo}>
						<ArrowLeft size={13} /> Different video
					</button>
					<button type="button" class="btn-primary captions-continue" onclick={goToClipsStep}>
						Continue to clips
						<ArrowRight size={15} />
					</button>
				</div>
			</div>

			<div class="captions-layout">
				<div class="captions-preview-col">
					{#if clips.length > 1}
						<div class="captions-clip-picker" role="listbox" aria-label="Preview clip">
							{#each clips as clip, i (clip.id)}
								<button
									type="button"
									class="captions-clip-chip"
									class:captions-clip-chip-on={selectedClipId === clip.id}
									onclick={() => selectClip(clip, { play: false })}
								>
									Clip {i + 1}
								</button>
							{/each}
						</div>
					{/if}

					<div class="captions-phone" style="aspect-ratio: {aspectMeta.css}">
						{#if hasStoredVideo && selectedClip}
							<!-- svelte-ignore a11y_media_has_caption -->
							<video
								class="captions-preview-video"
								src={source.playbackUrl}
								preload="metadata"
								playsinline
								muted={videoMuted}
								bind:this={captionsPreviewVideo}
								onloadedmetadata={(e) => onCaptionsPreviewReady(e.currentTarget)}
								ontimeupdate={onCaptionsPreviewTimeUpdate}
								onclick={playCaptionsPreview}
							></video>
							<VideoCaptionOverlay
								phrase={activeCaptionPhrase ?? captionPhrases[0] ?? null}
								currentTime={videoCurrentTime}
								activeWordIndex={activeCaptionWordIndex}
								template={captionTemplate}
								enabled={captionEnabled}
								position={captionPosition}
								customColor={captionCustomColor}
								customBgColor={captionCustomBgColor}
								customFontSize={captionFontSize}
								customHighlightColor={captionCustomHighlightColor}
								animationOverride={captionAnimationOverride}
								strokeEnabled={captionStrokeEnabled}
								draggable={captionDraggable}
								customX={captionCustomX}
								customY={captionCustomY}
								oncustomposition={handleCaptionPositionChange}
							/>
							<button
								type="button"
								class="captions-play-fab"
								onclick={playCaptionsPreview}
								aria-label="Play preview"
							>
								Play preview
							</button>
						{:else}
							<div class="captions-preview-empty">
								<Film size={28} />
								<p>
									{#if !hasStoredVideo && source.youtubeId}
										Caption styling applies after yt-dlp stores the video. You can still edit
										text options, then continue to clips.
									{:else}
										No clip preview available yet — continue to review clips.
									{/if}
								</p>
							</div>
						{/if}
					</div>

					<div class="captions-preview-tools">
						<button
							type="button"
							class="mute-chip"
							class:mute-chip-on={videoMuted}
							onclick={toggleVideoMuted}
							aria-label={videoMuted ? 'Unmute' : 'Mute'}
						>
							{#if videoMuted}
								<VolumeX size={14} /> Muted
							{:else}
								<Volume2 size={14} /> Sound
							{/if}
						</button>
						{#if selectedClip}
							<span class="captions-range">
								{formatTimestamp(selectedClip.startSec)} – {formatTimestamp(selectedClip.endSec)}
							</span>
						{/if}
					</div>
				</div>

				<div class="captions-controls-col">
					<div class="enhance-grid" role="group" aria-label="Caption options">
						<label class="enhance-opt">
							<input type="checkbox" bind:checked={captionEnhance.addEmojis} />
							<span class="enhance-box" aria-hidden="true"></span>
							Add emojis
						</label>
						<label class="enhance-opt">
							<input type="checkbox" bind:checked={captionEnhance.highlightKeywords} />
							<span class="enhance-box" aria-hidden="true"></span>
							Highlight keywords
						</label>
						<label class="enhance-opt">
							<input type="checkbox" bind:checked={captionEnhance.removeSilences} />
							<span class="enhance-box" aria-hidden="true"></span>
							Remove silences
						</label>
						<label class="enhance-opt">
							<input type="checkbox" bind:checked={captionEnhance.autoCensor} />
							<span class="enhance-box" aria-hidden="true"></span>
							Auto-censor
						</label>
					</div>

					{#if hasTranscriptForCaptions && selectedClip}
						<VideoCaptionControls
							bind:enabled={captionEnabled}
							bind:selectedTemplateId={captionTemplateId}
							bind:fontSize={captionFontSize}
							bind:position={captionPosition}
							bind:customColor={captionCustomColor}
							bind:customBgColor={captionCustomBgColor}
							bind:customHighlightColor={captionCustomHighlightColor}
							bind:draggable={captionDraggable}
							bind:selectedFont={captionSelectedFont}
							bind:strokeEnabled={captionStrokeEnabled}
							bind:animationOverride={captionAnimationOverride}
							bind:wordsPerChunkOverride={captionChunkOverride}
							bind:segments={captionSegments}
							onseek={seekCaptionTo}
							onreset={resetCaptionEdits}
						/>
					{:else}
						<div class="captions-empty-note" role="status">
							<AlertCircle size={14} />
							<span>
								No transcript was found for this video. You can skip ahead and still review clips —
								or re-analyze with Whisper / YouTube captions enabled.
							</span>
						</div>
					{/if}

					<button type="button" class="btn-primary captions-continue-mobile" onclick={goToClipsStep}>
						Continue to clips
						<ArrowRight size={15} />
					</button>
				</div>
			</div>
		</section>
	{/if}

	<!-- ── CLIPS (step 3) ── -->
	{#if workflowStep === 'clips' && source}
		<section class="results" aria-label="Clip results">
			{#if error}
				<div class="videos-error results-error" role="alert">
					<AlertCircle size={14} />
					{error}
				</div>
			{/if}
			<div class="results-head">
				<div class="results-head-info">
					<h2 class="results-title">{source.title}</h2>
					<div class="results-meta">
						<span>{clips.length} clips found</span>
						<span class="meta-sep">·</span>
						<span>{formatTimestamp(source.durationSec)} total</span>
						{#if demo}<span class="demo-pill">Demo AI</span>{/if}
						{#if model}<span class="model-pill">{model}</span>{/if}
					</div>
					{#if summary}<p class="results-summary">{summary}</p>{/if}
				</div>
				<div class="results-head-actions">
					<button type="button" class="btn-ghost" onclick={goToCaptionsStep}>
						<ArrowLeft size={13} /> Captions
					</button>
					<button type="button" class="btn-ghost" onclick={chooseAnotherVideo}>
						<RotateCcw size={13} /> Choose another video
					</button>
				</div>
			</div>

			<div class="results-layout">
				<aside class="clip-rail" aria-label="Clip thumbnails">
					<div class="clip-rail-label">AI CLIP</div>
					<nav class="clip-rail-list">
						{#each clips as clip, i (clip.id)}
							<button
								type="button"
								id="clip-nav-{clip.id}"
								class="rail-thumb"
								class:rail-thumb-on={selectedClipId === clip.id}
								onclick={() => selectClip(clip)}
								title={cleanClipSpeechText(clip.title) || `Clip ${i + 1}`}
							>
								<span class="rail-num">{i + 1}</span>
								{#if source.thumbnailUrl || hasStoredVideo}
									{#if hasStoredVideo}
										<!-- svelte-ignore a11y_media_has_caption -->
										<video
											class="rail-video"
											src="{source.playbackUrl}#t={Math.max(0.1, clip.startSec)}"
											preload="metadata"
											muted
											playsinline
										></video>
									{:else}
										<img
											class="rail-img"
											src={source.thumbnailUrl}
											alt=""
										/>
									{/if}
								{:else}
									<span class="rail-fallback">{(clip.viralityScore / 10).toFixed(1)}</span>
								{/if}
								<span class="rail-title">{cleanClipSpeechText(clip.title) || `Clip ${i + 1}`}</span>
							</button>
						{/each}
					</nav>
				</aside>

				<div class="feed-main">
					<div class="feed-toolbar">
						<label class="select-all">
							<input
								type="checkbox"
								checked={!!selectedClipId}
								onchange={() => {
									if (clips[0]) selectClip(clips[0], { play: false });
								}}
							/>
							Select
						</label>
						<span class="feed-count">{clips.length} clips</span>
						<span class="feed-sort">Highest score</span>
						<button type="button" class="mute-chip" class:mute-chip-on={videoMuted} onclick={toggleVideoMuted}>
							{#if videoMuted}
								<VolumeX size={14} /> Muted
							{:else}
								<Volume2 size={14} /> Sound
							{/if}
						</button>
					</div>

					<div class="feed-list">
						{#each clips as clip, i (clip.id)}
							<ClipFeedCard
								{clip}
								index={i}
								{source}
								{hasStoredVideo}
								selected={selectedClipId === clip.id}
								exporting={isExporting}
								muted={videoMuted}
								layout={clipLayout}
								aspectRatio={aspectMeta.css}
								enhance={captionEnhance}
								onselect={() => selectClip(clip, { play: false })}
								onplay={(el) => {
									selectedClipId = clip.id;
									playerVideo = el;
									pauseOtherClipVideos(el);
								}}
								onexport={() => void downloadClip(clip)}
								onstudio={(tpl) => openClipInStudio(clip, tpl)}
								ontimeupdate={onClipCardTimeUpdate}
								onmutechange={(m) => (videoMuted = m)}
								onvideoready={(el) => registerClipVideo(clip.id, el)}
							/>
						{/each}
					</div>

					{#if !hasStoredVideo && source.youtubeId}
						<p class="player-note feed-note">
							Preview uses YouTube embeds per clip range. Install yt-dlp to download the full video and enable MP4 export.
						</p>
					{/if}
				</div>
			</div>

			{#if selectedClip && source}
				<ClipTemplatePreviews
					clip={selectedClip}
					{source}
					watermark={topicHint.trim() || 'VIRAL CLIP'}
					topicHint={topicHint.trim()}
					captions={captionImportPayload}
				/>
			{/if}
		</section>
	{/if}
</div>

<style>
	/* ── Base ── */
	.videos-page {
		min-height: 100%;
		background: var(--app-bg);
		color: var(--app-text);
	}

	/* ── Workflow stepper ── */
	.workflow-stepper {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0;
		flex-wrap: wrap;
		padding: 1rem 1.25rem 0.25rem;
		max-width: 52rem;
		margin: 0 auto;
	}

	.stepper-step {
		display: inline-flex;
		align-items: center;
		gap: 0.55rem;
		padding: 0.45rem 0.65rem;
		border: none;
		background: transparent;
		border-radius: 0.65rem;
		cursor: pointer;
		color: #94a3b8;
		text-align: left;
	}

	.stepper-step:disabled {
		cursor: default;
	}

	.stepper-step:not(:disabled):hover {
		background: #f1f5f9;
		color: #475569;
	}

	.stepper-step-on {
		color: #0f172a;
	}

	.stepper-step-done {
		color: #2563eb;
	}

	.stepper-num {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 1.65rem;
		height: 1.65rem;
		border-radius: 999px;
		font-size: 0.75rem;
		font-weight: 700;
		background: #e2e8f0;
		color: inherit;
		flex-shrink: 0;
	}

	.stepper-step-on .stepper-num {
		background: #2563eb;
		color: #fff;
	}

	.stepper-step-done .stepper-num {
		background: #dbeafe;
		color: #1d4ed8;
	}

	.stepper-copy {
		display: flex;
		flex-direction: column;
		gap: 0.05rem;
		min-width: 0;
	}

	.stepper-label {
		font-size: 0.82rem;
		font-weight: 650;
		line-height: 1.2;
	}

	.stepper-hint {
		font-size: 0.68rem;
		opacity: 0.75;
		line-height: 1.2;
	}

	.stepper-line {
		width: 1.5rem;
		height: 2px;
		background: #e2e8f0;
		flex-shrink: 0;
		margin: 0 0.15rem;
	}

	.stepper-line-on {
		background: #93c5fd;
	}

	@media (max-width: 640px) {
		.stepper-hint {
			display: none;
		}
		.stepper-line {
			width: 0.85rem;
		}
	}

	/* ── Captions step ── */
	.captions-step {
		max-width: 72rem;
		margin: 0 auto;
		padding: 1rem 1.25rem 2.5rem;
	}

	.captions-head {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-start;
		justify-content: space-between;
		gap: 1rem;
		margin-bottom: 1.25rem;
	}

	.captions-sub {
		margin: 0.35rem 0 0;
		color: #64748b;
		font-size: 0.9rem;
		line-height: 1.45;
		max-width: 36rem;
	}

	.captions-head-actions,
	.results-head-actions {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.5rem;
	}

	.captions-continue {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
	}

	.captions-continue-mobile {
		display: none;
		width: 100%;
		justify-content: center;
		gap: 0.4rem;
		margin-top: 0.75rem;
	}

	.captions-layout {
		display: grid;
		grid-template-columns: minmax(240px, 360px) minmax(0, 1fr);
		gap: 1.5rem;
		align-items: start;
	}

	@media (max-width: 900px) {
		.captions-layout {
			grid-template-columns: 1fr;
		}
		.captions-continue {
			display: none;
		}
		.captions-continue-mobile {
			display: inline-flex;
		}
	}

	.captions-clip-picker {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
		margin-bottom: 0.75rem;
	}

	.captions-clip-chip {
		padding: 0.35rem 0.7rem;
		border-radius: 999px;
		border: 1px solid #e2e8f0;
		background: #fff;
		font-size: 0.75rem;
		font-weight: 600;
		color: #64748b;
		cursor: pointer;
	}

	.captions-clip-chip-on {
		border-color: #2563eb;
		background: #eff6ff;
		color: #1d4ed8;
	}

	.captions-phone {
		position: relative;
		width: 100%;
		max-width: 320px;
		margin: 0 auto;
		border-radius: 1rem;
		overflow: hidden;
		background: #0f172a;
		box-shadow:
			0 1px 3px rgba(15, 23, 42, 0.12),
			0 12px 32px rgba(15, 23, 42, 0.12);
	}

	.captions-preview-video {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
		cursor: pointer;
	}

	.captions-preview-empty {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.75rem;
		min-height: 280px;
		padding: 1.5rem;
		color: #94a3b8;
		text-align: center;
		font-size: 0.85rem;
		line-height: 1.5;
	}

	.captions-play-fab {
		position: absolute;
		left: 50%;
		bottom: 1rem;
		transform: translateX(-50%);
		z-index: 3;
		padding: 0.45rem 0.85rem;
		border: none;
		border-radius: 999px;
		background: rgba(15, 23, 42, 0.72);
		color: #fff;
		font-size: 0.75rem;
		font-weight: 600;
		cursor: pointer;
		backdrop-filter: blur(6px);
	}

	.captions-preview-tools {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.75rem;
		margin-top: 0.75rem;
	}

	.captions-range {
		font-size: 0.75rem;
		color: #64748b;
		font-variant-numeric: tabular-nums;
	}

	.captions-controls-col {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		min-width: 0;
	}

	.captions-empty-note {
		display: flex;
		align-items: flex-start;
		gap: 0.5rem;
		padding: 0.85rem 1rem;
		border-radius: 0.75rem;
		background: #fffbeb;
		border: 1px solid #fcd34d;
		color: #92400e;
		font-size: 0.82rem;
		line-height: 1.5;
	}

	/* ── Hero — clean white professional ── */
	.videos-hero {
		position: relative;
		background: #fff;
		color: #0f172a;
		padding: 3rem 1.5rem 3.5rem;
		border-bottom: 1px solid #e8edf2;
	}

	.hero-glow {
		display: none;
	}

	.videos-hero-inner {
		position: relative;
		max-width: 680px;
		margin: 0 auto;
	}

	.videos-hero-badge {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		font-size: 0.67rem;
		font-weight: 700;
		letter-spacing: 0.09em;
		text-transform: uppercase;
		color: #7c3aed;
		background: #f5f3ff;
		border: 1px solid #ddd6fe;
		padding: 0.28rem 0.65rem 0.28rem 0.5rem;
		border-radius: 999px;
		margin-bottom: 1rem;
		animation: badge-in 0.45s ease both;
	}

	@keyframes badge-in {
		from {
			opacity: 0;
			transform: translateY(-6px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	.videos-title {
		font-size: clamp(1.85rem, 4.5vw, 2.6rem);
		font-weight: 900;
		letter-spacing: -0.04em;
		line-height: 1.08;
		color: #0f172a;
		margin: 0 0 0.75rem;
		animation: slide-up 0.5s 0.05s ease both;
	}

	.title-accent {
		color: #7c3aed;
		background: none;
		-webkit-text-fill-color: #7c3aed;
	}

	.videos-sub {
		margin: 0 0 1.75rem;
		color: #64748b;
		font-size: 0.975rem;
		line-height: 1.65;
		max-width: 34rem;
		animation: slide-up 0.5s 0.09s ease both;
	}

	.resume-banner {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem 1rem;
		max-width: 34rem;
		margin: -0.5rem auto 1.25rem;
		padding: 0.85rem 1rem;
		border-radius: 0.75rem;
		background: #eff6ff;
		border: 1px solid #bfdbfe;
		text-align: left;
		animation: slide-up 0.45s 0.1s ease both;
	}

	.resume-copy {
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
		min-width: 0;
		flex: 1;
	}

	.resume-copy strong {
		font-size: 0.85rem;
		font-weight: 650;
		color: #1e3a8a;
	}

	.resume-copy span {
		font-size: 0.78rem;
		color: #64748b;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.resume-actions {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		flex-shrink: 0;
	}

	.btn-resume {
		padding: 0.45rem 0.85rem;
		border-radius: 0.5rem;
		border: none;
		background: #2563eb;
		color: #fff;
		font-size: 0.8rem;
		font-weight: 600;
		cursor: pointer;
	}

	.btn-resume:hover {
		background: #1d4ed8;
	}

	.btn-resume-dismiss {
		padding: 0.45rem 0.7rem;
		border-radius: 0.5rem;
		border: 1px solid #cbd5e1;
		background: #fff;
		color: #64748b;
		font-size: 0.78rem;
		font-weight: 550;
		cursor: pointer;
	}

	.btn-resume-dismiss:hover {
		background: #f8fafc;
		color: #334155;
	}

	@keyframes slide-up {
		from {
			opacity: 0;
			transform: translateY(10px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	/* ── Warning ── */
	.tools-warn {
		display: flex;
		align-items: flex-start;
		gap: 0.5rem;
		margin: 0 0 1.25rem;
		padding: 0.65rem 0.9rem;
		border-radius: 0.6rem;
		background: #fffbeb;
		border: 1px solid #fcd34d;
		color: #92400e;
		font-size: 0.78rem;
		line-height: 1.5;
	}

	.tools-warn :global(svg) {
		flex-shrink: 0;
		margin-top: 1px;
		color: #d97706;
	}

	/* ── Import card ── */
	.import-card {
		background: #fff;
		border: 1px solid #e2e8f0;
		border-radius: 1rem;
		padding: 1.35rem;
		box-shadow:
			0 1px 3px rgba(15, 23, 42, 0.06),
			0 4px 16px rgba(15, 23, 42, 0.04);
		animation: slide-up 0.55s 0.12s ease both;
	}

	/* ── Tabs ── */
	.import-tabs {
		display: flex;
		gap: 0.2rem;
		margin-bottom: 1.1rem;
		background: #f1f5f9;
		border-radius: 0.6rem;
		padding: 0.2rem;
	}

	.import-tab {
		flex: 1;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.4rem;
		font-size: 0.78rem;
		font-weight: 600;
		color: #94a3b8;
		padding: 0.48rem 0.75rem;
		border-radius: 0.45rem;
		border: none;
		background: transparent;
		cursor: pointer;
		transition:
			color 0.15s,
			background 0.15s,
			box-shadow 0.15s;
	}

	.import-tab:hover {
		color: #475569;
	}

	.import-tab-on {
		color: #0f172a;
		background: #fff;
		box-shadow: 0 1px 3px rgba(15, 23, 42, 0.1);
	}

	/* ── URL row ── */
	.import-row {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	:global(.import-icon) {
		flex-shrink: 0;
		color: #94a3b8;
	}

	.import-input {
		flex: 1;
		min-width: 0;
		height: 2.7rem;
		border-radius: 0.6rem;
		border: 1px solid #e2e8f0;
		background: #f8fafc;
		color: #0f172a;
		padding: 0 0.85rem;
		font-size: 0.875rem;
		transition:
			border-color 0.15s,
			background 0.15s,
			box-shadow 0.15s;
	}

	.import-input:focus {
		outline: none;
		border-color: #a78bfa;
		background: #fff;
		box-shadow: 0 0 0 3px rgba(124, 58, 237, 0.08);
	}

	.import-input::placeholder {
		color: #b0bac5;
	}

	/* ── Primary CTA ── */
	.btn-primary {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		height: 2.7rem;
		padding: 0 1.15rem;
		border-radius: 0.6rem;
		border: none;
		background: #7c3aed;
		color: #fff;
		font-weight: 700;
		font-size: 0.82rem;
		cursor: pointer;
		white-space: nowrap;
		transition:
			background 0.15s,
			transform 0.12s,
			box-shadow 0.15s;
		box-shadow: 0 2px 8px rgba(124, 58, 237, 0.3);
	}

	.btn-primary:hover:not(:disabled) {
		background: #6d28d9;
		transform: translateY(-1px);
		box-shadow: 0 4px 16px rgba(124, 58, 237, 0.4);
	}

	.btn-primary:active:not(:disabled) {
		transform: translateY(0);
	}

	.btn-primary:disabled {
		opacity: 0.5;
		cursor: not-allowed;
		box-shadow: none;
	}

	/* ── Upload zone ── */
	.upload-zone {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.4rem;
		padding: 2.25rem 1.5rem;
		border: 2px dashed #cbd5e1;
		border-radius: 0.85rem;
		cursor: pointer;
		transition:
			border-color 0.2s,
			background 0.2s;
		color: #475569;
		min-height: 10.5rem;
		text-align: center;
	}

	.upload-zone:hover {
		border-color: #a78bfa;
		background: #faf5ff;
	}

	.upload-zone-drag {
		border-color: #7c3aed !important;
		border-style: solid !important;
		background: #f5f3ff !important;
	}

	.upload-zone-busy {
		pointer-events: none;
		opacity: 0.7;
	}

	.upload-title {
		font-weight: 700;
		font-size: 0.9rem;
		margin-top: 0.15rem;
		color: #1e293b;
	}

	.upload-hint {
		font-size: 0.72rem;
		color: #94a3b8;
		letter-spacing: 0.03em;
	}

	.upload-bar {
		width: 100%;
		max-width: 9rem;
		height: 3px;
		background: #e2e8f0;
		border-radius: 999px;
		margin-top: 0.65rem;
		overflow: hidden;
	}

	.upload-bar-fill {
		height: 100%;
		background: linear-gradient(90deg, #7c3aed, #a78bfa);
		border-radius: 999px;
		transition: width 0.25s ease;
	}

	.upload-pct {
		font-size: 0.71rem;
		color: #64748b;
		font-variant-numeric: tabular-nums;
	}

	:global(.upload-loader) {
		color: #7c3aed;
	}

	:global(.upload-pulse) {
		animation: pulse 1.6s ease-in-out infinite;
		color: #7c3aed;
	}

	:global(.upload-icon) {
		transition: transform 0.2s;
		color: #94a3b8;
	}

	.upload-zone:hover :global(.upload-icon) {
		transform: translateY(-3px);
		color: #7c3aed;
	}

	/* ── Clip settings ── */
	.clip-settings {
		margin-top: 1.1rem;
		padding: 1rem 1rem 0.8rem;
		border-radius: 0.7rem;
		border: 1px solid #e2e8f0;
		background: #f8fafc;
		display: flex;
		flex-direction: column;
		gap: 0.85rem;
	}

	.clip-settings-legend {
		font-size: 0.67rem;
		font-weight: 700;
		letter-spacing: 0.09em;
		text-transform: uppercase;
		color: #94a3b8;
		padding: 0 0.1rem;
	}

	.clip-mode-row {
		display: flex;
		flex-wrap: wrap;
		gap: 0.45rem;
	}

	.clip-mode-opt {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		font-size: 0.8rem;
		font-weight: 600;
		color: #64748b;
		cursor: pointer;
		padding: 0.38rem 0.72rem;
		border-radius: 0.48rem;
		border: 1px solid #e2e8f0;
		background: #fff;
		transition:
			color 0.15s,
			background 0.15s,
			border-color 0.15s;
	}

	.clip-mode-opt input {
		display: none;
	}

	.clip-mode-opt-on {
		color: #7c3aed;
		background: #f5f3ff;
		border-color: #c4b5fd;
	}

	.clip-mode-hint {
		margin: 0;
		font-size: 0.76rem;
		color: #94a3b8;
		line-height: 1.5;
	}

	.clip-field {
		display: flex;
		flex-direction: column;
		gap: 0.42rem;
	}

	.clip-field-label {
		font-size: 0.76rem;
		color: #475569;
	}

	.clip-field-label strong {
		color: #7c3aed;
		font-weight: 700;
	}

	.clip-number {
		height: 2.1rem;
		width: 5.5rem;
		border-radius: 0.45rem;
		border: 1px solid #e2e8f0;
		background: #fff;
		color: #0f172a;
		padding: 0 0.6rem;
		font-size: 0.875rem;
		font-weight: 600;
	}

	.clip-number:disabled {
		opacity: 0.42;
	}

	.clip-dropdown-field {
		position: relative;
		z-index: 2;
	}

	.dropdown-wrap {
		position: relative;
	}

	.dropdown-trigger {
		display: flex;
		align-items: center;
		justify-content: space-between;
		width: 100%;
		padding: 0.65rem 0.85rem;
		border-radius: 0.65rem;
		border: 1.5px solid #c4b5fd;
		background: #fff;
		font-size: 0.9rem;
		font-weight: 600;
		color: #475569;
		cursor: pointer;
	}

	.dropdown-trigger:hover:not(:disabled) {
		border-color: #7c3aed;
	}

	.dropdown-trigger:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.dropdown-menu {
		position: absolute;
		left: 0;
		right: 0;
		top: calc(100% + 4px);
		z-index: 30;
		margin: 0;
		padding: 0.35rem;
		list-style: none;
		background: #fff;
		border: 1px solid #e2e8f0;
		border-radius: 0.75rem;
		box-shadow: 0 12px 32px rgba(15, 23, 42, 0.12);
		max-height: 240px;
		overflow: auto;
	}

	.dropdown-option {
		display: flex;
		align-items: center;
		gap: 0.55rem;
		width: 100%;
		padding: 0.55rem 0.65rem;
		border: 0;
		border-radius: 0.45rem;
		background: transparent;
		font-size: 0.875rem;
		font-weight: 600;
		color: #334155;
		cursor: pointer;
		text-align: left;
	}

	.dropdown-option:hover {
		background: #f8fafc;
	}

	.dropdown-option-on {
		color: #6d28d9;
		background: #f5f3ff;
	}

	.dropdown-check {
		width: 1rem;
		font-size: 0.8rem;
		color: #7c3aed;
		flex-shrink: 0;
	}

	.ratio-icon {
		width: 0.85rem;
		height: 0.85rem;
		border: 1.5px solid currentColor;
		border-radius: 0.15rem;
		flex-shrink: 0;
		opacity: 0.7;
	}

	.ratio-icon[data-ratio='9:16'] {
		width: 0.55rem;
		height: 0.9rem;
	}

	.ratio-icon[data-ratio='16:9'] {
		width: 0.95rem;
		height: 0.55rem;
	}

	.layout-picker {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
	}

	.layout-chip {
		padding: 0.4rem 0.75rem;
		border-radius: 0.5rem;
		border: 1px solid #e2e8f0;
		background: #fff;
		font-size: 0.78rem;
		font-weight: 700;
		color: #64748b;
		cursor: pointer;
	}

	.layout-chip-on {
		border-color: #c4b5fd;
		background: #f5f3ff;
		color: #6d28d9;
	}

	.enhance-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.55rem 0.75rem;
		padding: 0.75rem;
		border-radius: 0.75rem;
		border: 1px solid #e2e8f0;
		background: #fff;
	}

	.enhance-opt {
		display: flex;
		align-items: center;
		gap: 0.55rem;
		font-size: 0.84rem;
		font-weight: 650;
		color: #1e293b;
		cursor: pointer;
		user-select: none;
	}

	.enhance-opt input {
		position: absolute;
		opacity: 0;
		width: 0;
		height: 0;
	}

	.enhance-box {
		width: 1.15rem;
		height: 1.15rem;
		border-radius: 0.28rem;
		border: 1.5px solid #cbd5e1;
		background: #fff;
		flex-shrink: 0;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		transition:
			background 0.12s,
			border-color 0.12s;
	}

	.enhance-opt input:checked + .enhance-box {
		background: #7c3aed;
		border-color: #7c3aed;
	}

	.enhance-opt input:checked + .enhance-box::after {
		content: '';
		width: 0.28rem;
		height: 0.5rem;
		border: solid #fff;
		border-width: 0 2px 2px 0;
		transform: rotate(45deg) translate(-0.5px, -1px);
	}

	.enhance-opt input:focus-visible + .enhance-box {
		outline: 2px solid #a78bfa;
		outline-offset: 2px;
	}

	.enhance-opt:has(input:disabled) {
		opacity: 0.45;
		cursor: not-allowed;
	}

	.results-enhance {
		margin-bottom: 1rem;
	}

	.clip-range-pair {
		display: none;
	}

	.clip-range {
		display: none;
	}

	.clip-range-ticks {
		display: none;
	}

	/* ── Topic hint ── */
	.hint-row {
		display: flex;
		align-items: center;
		gap: 0.45rem;
		margin-top: 0.85rem;
	}

	:global(.hint-icon) {
		color: #b0bac5;
		flex-shrink: 0;
	}

	.hint-input {
		flex: 1;
		height: 2.25rem;
		border-radius: 0.52rem;
		border: 1px solid #e2e8f0;
		background: #f8fafc;
		color: #0f172a;
		padding: 0 0.65rem;
		font-size: 0.8rem;
		transition:
			border-color 0.15s,
			box-shadow 0.15s;
	}

	.hint-input:focus {
		outline: none;
		border-color: #a78bfa;
		box-shadow: 0 0 0 3px rgba(124, 58, 237, 0.08);
	}

	.hint-input::placeholder {
		color: #b0bac5;
	}

	/* ── Error ── */
	.videos-error {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-top: 1rem;
		padding: 0.65rem 0.9rem;
		border-radius: 0.55rem;
		background: #fef2f2;
		border: 1px solid #fecaca;
		color: #b91c1c;
		font-size: 0.8rem;
		line-height: 1.4;
	}

	/* ── Results section ── */
	.results {
		max-width: 1180px;
		margin: 0 auto;
		padding: 2.25rem 1.5rem 3.5rem;
		animation: slide-up 0.4s ease both;
		background: #f4f6f8;
		border-radius: 0;
	}

	.results-error {
		margin-bottom: 1rem;
	}

	.results-head {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: 1rem;
		margin-bottom: 1.75rem;
		padding-bottom: 1.35rem;
		border-bottom: 1px solid #e2e8f0;
		background: transparent;
	}

	.results-title {
		font-size: 1.3rem;
		font-weight: 800;
		letter-spacing: -0.025em;
		margin: 0 0 0.4rem;
	}

	.results-meta {
		font-size: 0.78rem;
		color: var(--app-text-2);
		margin: 0;
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
		align-items: center;
	}

	.meta-sep {
		opacity: 0.38;
	}

	.demo-pill,
	.model-pill {
		font-size: 0.63rem;
		font-weight: 700;
		padding: 0.15rem 0.5rem;
		border-radius: 999px;
		background: color-mix(in oklab, #f472b6 14%, transparent);
		color: #be185d;
	}

	.results-summary {
		margin: 0.65rem 0 0;
		font-size: 0.875rem;
		line-height: 1.62;
		color: var(--app-text-2);
		max-width: 44rem;
	}

	.btn-ghost {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		border: 1px solid var(--app-border);
		background: var(--app-surface);
		border-radius: 0.55rem;
		padding: 0.5rem 0.9rem;
		font-size: 0.78rem;
		font-weight: 600;
		cursor: pointer;
		color: var(--app-text);
		white-space: nowrap;
		transition: background 0.15s;
	}

	.btn-ghost:hover {
		background: var(--app-surface-2);
	}

	/* ── Results feed (Vizard-style multi-clip) ── */
	.results-layout {
		display: grid;
		grid-template-columns: 7.5rem minmax(0, 1fr);
		gap: 1.25rem;
		align-items: start;
	}

	@media (max-width: 900px) {
		.results-layout {
			grid-template-columns: 1fr;
		}

		.clip-rail {
			position: static;
			flex-direction: row;
			overflow-x: auto;
			padding-bottom: 0.35rem;
		}

		.clip-rail-list {
			flex-direction: row;
		}

		.rail-thumb {
			width: 4.5rem;
			flex-shrink: 0;
		}
	}

	.clip-rail {
		position: sticky;
		top: 1rem;
		display: flex;
		flex-direction: column;
		gap: 0.55rem;
		max-height: calc(100vh - 2rem);
		overflow: auto;
		scrollbar-width: thin;
		padding-right: 0.15rem;
	}

	.clip-rail-label {
		font-size: 0.62rem;
		font-weight: 800;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: #94a3b8;
		padding: 0 0.15rem;
	}

	.clip-rail-list {
		display: flex;
		flex-direction: column;
		gap: 0.55rem;
	}

	.rail-thumb {
		position: relative;
		display: flex;
		flex-direction: column;
		gap: 0.28rem;
		width: 100%;
		padding: 0;
		border: 2px solid transparent;
		border-radius: 0.55rem;
		background: transparent;
		cursor: pointer;
		text-align: left;
		color: inherit;
		transition: border-color 0.15s;
	}

	.rail-thumb-on {
		border-color: #7c3aed;
	}

	.rail-num {
		position: absolute;
		top: 4px;
		left: 4px;
		z-index: 2;
		width: 1.15rem;
		height: 1.15rem;
		border-radius: 0.25rem;
		background: rgba(0, 0, 0, 0.7);
		color: #fff;
		font-size: 0.62rem;
		font-weight: 800;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.rail-video,
	.rail-img {
		width: 100%;
		aspect-ratio: 9 / 16;
		object-fit: cover;
		border-radius: 0.4rem;
		background: #0f172a;
		display: block;
	}

	.rail-fallback {
		aspect-ratio: 9 / 16;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 0.4rem;
		background: #f1f5f9;
		font-weight: 800;
		color: #7c3aed;
		font-size: 0.95rem;
	}

	.rail-title {
		font-size: 0.62rem;
		font-weight: 650;
		line-height: 1.25;
		color: #64748b;
		display: -webkit-box;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}

	.rail-thumb-on .rail-title {
		color: #0f172a;
	}

	.feed-main {
		min-width: 0;
	}

	.feed-toolbar {
		display: flex;
		align-items: center;
		gap: 0.85rem;
		margin-bottom: 0.85rem;
		padding: 0.35rem 0.15rem;
		font-size: 0.78rem;
		color: #64748b;
	}

	.select-all {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		font-weight: 650;
		cursor: pointer;
	}

	.feed-count {
		font-weight: 700;
		color: #0f172a;
	}

	.feed-sort {
		margin-left: auto;
		font-weight: 650;
		color: #7c3aed;
	}

	.feed-caption-bar {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-start;
		gap: 0.75rem;
		margin-bottom: 1rem;
		padding: 0.75rem 0.9rem;
		border: 1px solid #e8edf2;
		border-radius: 0.85rem;
		background: #fff;
	}

	.feed-caption-bar :global(.caption-controls),
	.feed-caption-bar > :global(*) {
		flex: 1;
		min-width: 0;
	}

	.mute-chip {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		flex-shrink: 0;
		align-self: center;
		border: 1px solid #e2e8f0;
		background: #f8fafc;
		border-radius: 999px;
		padding: 0.4rem 0.75rem;
		font-size: 0.72rem;
		font-weight: 700;
		cursor: pointer;
		color: #475569;
	}

	.mute-chip-on {
		background: color-mix(in oklab, #7c3aed 12%, #fff);
		border-color: color-mix(in oklab, #7c3aed 28%, #e2e8f0);
		color: #6d28d9;
	}

	.feed-list {
		display: flex;
		flex-direction: column;
		gap: 1.75rem;
	}

	.feed-note {
		margin-top: 1rem;
	}

	.player-note {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		font-size: 0.71rem;
		color: var(--app-text-3);
		margin: 0.6rem 0 0;
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

	/* ── Animations ── */
	:global(.spin) {
		animation: spin 0.75s linear infinite;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	/* ── Responsive ── */
	@media (max-width: 600px) {
		.videos-hero {
			padding: 2rem 1rem 2.5rem;
		}

		.import-card {
			padding: 1rem;
		}

		.results {
			padding: 1.5rem 1rem 2.5rem;
		}
	}
</style>
