<script lang="ts">
	import { onMount } from 'svelte';
	import { supabase } from '$lib/supabase';
	import { r2UploadVideo } from '$lib/r2Client';
	import type { VideoClip, VideoImportMeta } from '$lib/video-clips/types';
	import { formatTimestamp } from '$lib/video-clips/export-clip';
	import { buildClipTemplateCopy, clipDirectVideoUrl, studioImportMediaForClip, shiftCaptionImportTimes } from '$lib/video-clips/clip-template-copy';
	import { cleanClipSpeechText, hasTimedTranscript, excerptTimedLinesFromTranscript } from '$lib/video-clips/transcript-segments';
	import { normalizeVideoClips } from '$lib/video-clips/normalize-clips';
	import ClipTemplatePreviews from '$lib/components/video-clips/ClipTemplatePreviews.svelte';
	import ClipFeedCard from '$lib/components/video-clips/ClipFeedCard.svelte';
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
	import { stashBulkClipHandoff } from '$lib/studio/bulk-to-studio';
	import { coerceTemplateId } from '$lib/studio/template-ids';
	import { loadBrandKit } from '$lib/studio/brand-kit';
	import { goto } from '$app/navigation';
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
		loadSavedVideoClips,
		saveVideoClipsToLibrary,
		removeSavedVideoClips,
		getSavedVideoClipsEntry,
		type VideoWorkflowStep,
		type SavedVideoClipsEntry,
		type VideoSessionCache,
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
		DEFAULT_AUTO_REFRAME,
		REFRAME_ASPECTS,
		REFRAME_METHODS,
		REFRAME_PADDING,
		reframeSettingsKey,
		type AutoReframeOptions,
	} from '$lib/video-clips/reframe';
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
		Bookmark,
		Trash2,
	} from 'lucide-svelte';

	type Phase = 'idle' | 'importing' | 'downloading' | 'analyzing' | 'ready' | 'exporting';

	const WORKFLOW_STEPS: { id: VideoWorkflowStep; label: string; hint: string }[] = [
		{ id: 'source', label: 'Video', hint: 'Import' },
		{ id: 'captions', label: 'Captions', hint: 'Style in Bulk' },
		{ id: 'clips', label: 'Clips', hint: 'Review & export' },
	];

	let userId = $state('');
	let phase = $state<Phase>('idle');
	let workflowStep = $state<VideoWorkflowStep>('source');
	let error = $state('');
	let toolsWarning = $state('');
	let ytDlpReady = $state(false);
	let ffmpegReady = $state(false);
	let pyautoflipReady = $state(false);
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
	let autoReframe = $state<AutoReframeOptions>({ ...DEFAULT_AUTO_REFRAME });
	let reframeBusy = $state(false);
	let reframeProgress = $state({ done: 0, total: 0, clipTitle: '' });
	let reframingClipId = $state<string | null>(null);
	let reframeController: AbortController | null = null;
	/** Explicitly saved clip jobs — reopen from Videos home (never auto-loaded). */
	let savedClipJobs = $state<SavedVideoClipsEntry[]>([]);
	let clipsSavedNote = $state('');
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
	let captionDraggable = $state(true);
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
		const hasTx = !!(
			source?.transcript?.trim() ||
			clips.some((c) => !!(c.transcript && c.transcript.trim()))
		);
		if (hasTx) captionEnabled = true;
		const clip = clips[0];
		if (clip) selectedClipId = clip.id;
		// Skip captions step when there's no stored video — preview would be empty
		if (!source?.r2Key) {
			workflowStep = 'clips';
		} else {
			workflowStep = 'captions';
		}
	}

	function goToClipsStep() {
		if (!source || !clips.length) return;
		workflowStep = 'clips';
		persistSession();
	}

	function goToCaptionsStep() {
		if (!source || !clips.length) return;
		if (phase !== 'ready' && phase !== 'exporting') return;
		// Captions preview needs a stored video — stay on clips if we only have YouTube metadata
		if (!source.r2Key) {
			workflowStep = 'clips';
			persistSession();
			return;
		}
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
		if (step === 'captions' && !source.r2Key) {
			workflowStep = 'clips';
		} else {
			workflowStep = step;
		}
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

	async function openClipInStudio(
		clip: VideoClip,
		templateRaw: string | string[] = 'videoFit',
	) {
		if (!source) return;
		const list = (Array.isArray(templateRaw) ? templateRaw : [templateRaw])
			.map((t) => coerceTemplateId(t))
			.filter(Boolean);
		const preferred =
			list[0] ||
			VIDEO_LAYOUT_TEMPLATES.find((l) => l.id === clipLayout)?.studioId ||
			'videoFit';
		const template = coerceTemplateId(preferred);
		const carouselTemplates = list.length >= 2 ? list.slice(0, 10) : undefined;

		let reframedOverride = '';
		const reframedKey = String(clip.reframedR2Key ?? '').trim();
		if (reframedKey) {
			try {
				const { url } = await r2SignRead({ key: reframedKey });
				if (url?.trim()) reframedOverride = url.trim();
			} catch (e) {
				console.warn('[videos] could not refresh reframed playback URL', e);
			}
		}

		const media = studioImportMediaForClip(clip, source, {
			reframedUrlOverride: reframedOverride || undefined,
		});
		const videoUrl = media.videoUrl;
		const looksYoutube = /youtube\.com\/embed|youtu\.be\//i.test(videoUrl);
		const copy = buildClipTemplateCopy(clip, source, {
			watermark: topicHint.trim() || 'VIRAL CLIP',
			topicHint: topicHint.trim(),
		});
		const captions = shiftCaptionImportTimes(
			buildCaptionImportForClip(clip),
			media.captionTimeOffsetSec,
		);
		if (videoUrl && !looksYoutube) {
			stashStudioClipImport({
				template,
				carouselTemplates,
				videoUrl,
				clipStart: media.clipStart,
				clipEnd: media.clipEnd,
				thumbnailUrl: source.thumbnailUrl || undefined,
				newsHeadline: copy.newsHeadline,
				newsSource: copy.newsSource,
				storyHeadline: copy.storyHeadline,
				videoHook: copy.videoHook,
				storyWatermark: copy.storyWatermark,
				tweetTop: copy.tweetTop,
				tweetBottom: copy.tweetBottom,
				carouselName: copy.carouselName,
				carouselHandle: copy.carouselHandle,
				carouselBody: copy.carouselBody,
				captions,
			});
		} else {
			console.warn('[videos] Open in Studio: no direct video URL', {
				hasDirect: !!clipDirectVideoUrl(source),
				usedReframe: media.usedReframe,
				r2Key: !!source.r2Key,
			});
		}
		persistSession();
		markVideoSessionForResume();
		window.location.href = studioUrlForClipImport(template);
	}

	async function openCaptionsInBulk(clip?: VideoClip | null) {
		const target = clip ?? selectedClip;
		if (!source || !target) return;
		let reframedOverride = '';
		const reframedKey = String((target as any).reframedR2Key ?? '').trim();
		if (reframedKey) {
			try {
				const { url } = await r2SignRead({ key: reframedKey });
				if (url?.trim()) reframedOverride = url.trim();
			} catch {
				/* ignore */
			}
		}
		const media = studioImportMediaForClip(target, source, {
			reframedUrlOverride: reframedOverride || undefined,
		});
		const captions = shiftCaptionImportTimes(
			buildCaptionImportForClip(target),
			media.captionTimeOffsetSec,
		);
		// Seed from brand kit when captions weren't enabled yet
		if (userId && (!captions || !captions.enabled)) {
			const kit = loadBrandKit(userId);
			stashBulkClipHandoff({
				videoUrl: media.videoUrl || source.playbackUrl,
				clipStart: media.clipStart,
				clipEnd: media.clipEnd,
				thumbnailUrl: source.thumbnailUrl || undefined,
				title: source.title,
				captions: captions
					? {
							...captions,
							enabled: true,
							templateId: captions.templateId || kit.captionTemplateId,
							fontSize: captions.fontSize || kit.captionFontSize,
							position: captions.position || kit.captionPosition,
							customColor: captions.customColor || kit.captionColor,
						}
					: {
							enabled: true,
							segments: buildCaptionSegmentsForClip(target),
							templateId: kit.captionTemplateId,
							fontSize: kit.captionFontSize,
							position: kit.captionPosition,
							customColor: kit.captionColor,
							customBgColor: 'transparent',
							customHighlightColor: '#ffeb3b',
							selectedFont: 'Inter',
							strokeEnabled: true,
							animationOverride: null,
							wordsPerChunk: null,
							customX: null,
							customY: null,
						},
			});
		} else {
			stashBulkClipHandoff({
				videoUrl: media.videoUrl || source.playbackUrl,
				clipStart: media.clipStart,
				clipEnd: media.clipEnd,
				thumbnailUrl: source.thumbnailUrl || undefined,
				title: source.title,
				captions,
			});
		}
		persistSession();
		markVideoSessionForResume();
		await goto('/dashboard/bulk?from=clip');
	}

	function handleCaptionPositionChange(x: number, y: number) {
		captionCustomX = x;
		captionCustomY = y;
	}

	function clearCaptionCustomPosition() {
		captionCustomX = null;
		captionCustomY = null;
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
	const currentReframeKey = $derived(
		reframeSettingsKey({
			aspectRatio: autoReframe.aspectRatio,
			method: autoReframe.method,
			motionThreshold: autoReframe.motionThreshold,
			paddingMethod: autoReframe.paddingMethod,
			debug: autoReframe.debug,
		}),
	);
	const reframeAspectCss = $derived(
		autoReframe.aspectRatio === '9:16'
			? '9 / 16'
			: autoReframe.aspectRatio === '4:5'
				? '4 / 5'
				: autoReframe.aspectRatio === '1:1'
					? '1 / 1'
					: '16 / 9',
	);
	const clipsNeedingReframe = $derived(
		clips.filter(
			(c) => !c.reframedPlaybackUrl || c.reframeSettingsKey !== currentReframeKey,
		).length,
	);
	const clipsReframedReady = $derived(
		clips.filter(
			(c) => !!c.reframedPlaybackUrl && c.reframeSettingsKey === currentReframeKey,
		).length,
	);

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
			youtubeUrl: '',
			topicHint,
			importTab,
			clipMode,
			clipCount,
			clipMinSec,
			clipMaxSec,
			videoAspectRatio,
			clipLayout,
			autoReframeEnabled: autoReframe.enabled,
			reframeAspectRatio: autoReframe.aspectRatio,
			reframeMethod: autoReframe.method,
			reframeMotionThreshold: autoReframe.motionThreshold,
			reframePaddingMethod: autoReframe.paddingMethod,
			reframeDebug: autoReframe.debug,
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

	async function applyCachedSession(
		cached: NonNullable<ReturnType<typeof loadVideoSession>> | VideoSessionCache,
	) {
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
		// Captions step needs stored video — fall back to clips for YouTube-only sessions
		if (workflowStep === 'captions' && !source.r2Key) {
			workflowStep = 'clips';
		}
	}

	function refreshSavedClipJobs() {
		savedClipJobs = loadSavedVideoClips();
	}

	function buildSessionPayload(): Omit<VideoSessionCache, 'v' | 'savedAt'> | null {
		if (!source || !clips.length) return null;
		return {
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
		};
	}

	function saveCurrentClipsToLibrary() {
		const payload = buildSessionPayload();
		if (!payload) return;
		const entry = saveVideoClipsToLibrary(payload);
		if (!entry) return;
		refreshSavedClipJobs();
		clipsSavedNote = 'Saved — find it on the Videos home screen';
		setTimeout(() => {
			clipsSavedNote = '';
		}, 2800);
	}

	async function restoreCachedSession() {
		migrateAwayFromLocalVideoSession();
		refreshSavedClipJobs();

		const prefs = loadVideoFormPrefs();
		if (prefs) {
			// Never restore YouTube URL — source step should start empty
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
			if (
				lay === 'fit' ||
				lay === 'blur' ||
				lay === 'story' ||
				lay === 'hook' ||
				lay === 'creator' ||
				lay === 'text' ||
				lay === 'source' ||
				lay === 'feature'
			)
				clipLayout = lay;
			if (typeof prefs.autoReframeEnabled === 'boolean') {
				autoReframe = { ...autoReframe, enabled: prefs.autoReframeEnabled };
			}
			const rar = String(prefs.reframeAspectRatio ?? prefs.videoAspectRatio ?? '');
			if (rar === '9:16' || rar === '1:1' || rar === '16:9' || rar === '4:5') {
				autoReframe = { ...autoReframe, aspectRatio: rar };
			}
			const rm = String(prefs.reframeMethod ?? '');
			if (rm === 'detection' || rm === 'saliency') {
				autoReframe = { ...autoReframe, method: rm };
			}
			const mt = Number(prefs.reframeMotionThreshold);
			if (Number.isFinite(mt)) {
				autoReframe = {
					...autoReframe,
					motionThreshold: Math.min(1, Math.max(0, mt)),
				};
			}
			const pad = String(prefs.reframePaddingMethod ?? '');
			if (pad === 'blur' || pad === 'solid_color') {
				autoReframe = { ...autoReframe, paddingMethod: pad };
			}
			if (typeof prefs.reframeDebug === 'boolean') {
				autoReframe = { ...autoReframe, debug: prefs.reframeDebug };
			}
		}

		// Only restore when returning from Studio — otherwise always start fresh
		if (shouldAutoRestoreVideoSession()) {
			const cached = loadVideoSession();
			if (cached) {
				await applyCachedSession(cached);
				return;
			}
		}

		clearVideoSession();
		phase = 'idle';
		workflowStep = 'source';
		source = null;
		clips = [];
		youtubeUrl = '';
		selectedClipId = null;
	}

	async function openSavedClipJob(id: string) {
		const entry = getSavedVideoClipsEntry(id);
		if (!entry?.session) return;
		const s = entry.session;
		await applyCachedSession({
			v: 1,
			savedAt: entry.savedAt,
			youtubeUrl: s.youtubeUrl ?? '',
			topicHint: s.topicHint ?? '',
			importTab: s.importTab === 'upload' ? 'upload' : 'youtube',
			clipMode: s.clipMode === 'all' ? 'all' : 'highlights',
			clipCount: s.clipCount ?? 8,
			clipMinSec: s.clipMinSec ?? 10,
			clipMaxSec: s.clipMaxSec ?? 60,
			source: s.source,
			clips: s.clips,
			summary: s.summary ?? '',
			demo: !!s.demo,
			model: s.model ?? '',
			selectedClipId: s.selectedClipId ?? null,
			workflowStep: s.workflowStep === 'captions' ? 'captions' : 'clips',
		});
		persistSession();
	}

	function deleteSavedClipJob(id: string) {
		removeSavedVideoClips(id);
		refreshSavedClipJobs();
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
			pyautoflipReady = !!t.pyautoflip;
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
		topicHint;
		importTab;
		clipMode;
		clipCount;
		clipMinSec;
		clipMaxSec;
		videoAspectRatio;
		clipLayout;
		autoReframe.enabled;
		autoReframe.aspectRatio;
		autoReframe.method;
		autoReframe.motionThreshold;
		autoReframe.paddingMethod;
		autoReframe.debug;
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
			// Prefer already-reframed preview file when settings still match
			if (
				clip.reframedR2Key &&
				clip.reframeSettingsKey === currentReframeKey &&
				autoReframe.enabled
			) {
				const { url } = await r2SignRead({ key: clip.reframedR2Key });
				const res = await fetch(url);
				if (!res.ok) throw new Error('Could not download reframed clip');
				const blob = await res.blob();
				if (!blob.size) throw new Error('Export returned an empty file');
				const filename = `${clip.title.replace(/[^\w.-]+/g, '_').slice(0, 80) || 'clip'}.mp4`;
				const objectUrl = URL.createObjectURL(blob);
				const a = document.createElement('a');
				a.href = objectUrl;
				a.download = filename;
				a.rel = 'noopener';
				document.body.appendChild(a);
				a.click();
				a.remove();
				URL.revokeObjectURL(objectUrl);
				return;
			}

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

	function clearClipReframes() {
		clips = clips.map((c) => {
			const { reframedR2Key: _k, reframedPlaybackUrl: _u, reframeSettingsKey: _s, ...rest } = c;
			return rest;
		});
	}

	function cancelReframe() {
		reframeController?.abort();
		reframeController = null;
		reframeBusy = false;
		reframingClipId = null;
		reframeProgress = { done: 0, total: 0, clipTitle: '' };
	}

	function reframeGuards(): string | null {
		if (!source?.r2Key) return 'Reframe needs a stored video. Analyze with yt-dlp first.';
		if (!pyautoflipReady) return 'Auto-reframe needs pyautoflip. Run: npm run pyautoflip:install';
		if (!ffmpegReady) return 'ffmpeg is required. Run: brew install ffmpeg';
		return null;
	}

	async function reframeOneClip(clip: VideoClip, signal: AbortSignal): Promise<boolean> {
		if (!source?.r2Key) return false;

		const body: Record<string, unknown> = {
			r2Key: source.r2Key,
			startSec: clip.startSec,
			endSec: clip.endSec,
			clipId: clip.id,
			reframe: {
				aspectRatio: autoReframe.aspectRatio,
				method: autoReframe.method,
				motionThreshold: autoReframe.motionThreshold,
				paddingMethod: autoReframe.paddingMethod,
				debug: autoReframe.debug,
			},
		};
		if (captionEnhance.removeSilences) {
			const segs = buildCaptionSegmentsForClip(clip);
			const windows = speechWindows(segs, clip.startSec, clip.endSec);
			if (windows.length > 1) body.speechWindows = windows;
		}

		const res = await fetch('/api/videos/reframe-clip', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(body),
			signal,
		});
		if (signal.aborted) return false;

		const data = await res.json().catch(() => ({}));
		if (!res.ok) {
			if (res.status === 499 || data.error === 'Canceled') return false;
			throw new Error(data.error ?? `Reframe failed (${res.status})`);
		}

		clips = clips.map((c) =>
			c.id === clip.id
				? {
						...c,
						reframedR2Key: String(data.r2Key ?? ''),
						reframedPlaybackUrl: String(data.playbackUrl ?? ''),
						reframeSettingsKey: String(data.settingsKey ?? currentReframeKey),
					}
				: c,
		);
		persistSession();
		return true;
	}

	async function reframeSingleClip(clip: VideoClip) {
		const guard = reframeGuards();
		if (guard) {
			error = guard;
			return;
		}

		error = '';
		reframeController?.abort();
		const controller = new AbortController();
		reframeController = controller;
		reframeBusy = true;
		reframingClipId = clip.id;

		try {
			await reframeOneClip(clip, controller.signal);
		} catch (e: unknown) {
			if (e instanceof DOMException && e.name === 'AbortError') {
				/* canceled */
			} else if (e instanceof Error && e.name === 'AbortError') {
				/* canceled */
			} else {
				error = e instanceof Error ? e.message : String(e);
			}
		} finally {
			if (reframeController === controller) reframeController = null;
			reframeBusy = false;
			reframingClipId = null;
		}
	}

	async function applyReframeToClips() {
		const guard = reframeGuards();
		if (guard) {
			error = guard;
			return;
		}

		const pending = clips.filter(
			(c) => !c.reframedPlaybackUrl || c.reframeSettingsKey !== currentReframeKey,
		);
		if (!pending.length) return;

		error = '';
		reframeController?.abort();
		const controller = new AbortController();
		reframeController = controller;
		reframeBusy = true;
		reframeProgress = { done: 0, total: pending.length, clipTitle: '' };

		try {
			for (let i = 0; i < pending.length; i++) {
				if (controller.signal.aborted) break;
				const clip = pending[i]!;
				reframingClipId = clip.id;
				reframeProgress = {
					done: i,
					total: pending.length,
					clipTitle: cleanClipSpeechText(clip.title) || `Clip ${i + 1}`,
				};

				const ok = await reframeOneClip(clip, controller.signal);
				if (!ok) break;

				reframeProgress = {
					done: i + 1,
					total: pending.length,
					clipTitle: cleanClipSpeechText(clip.title) || `Clip ${i + 1}`,
				};
			}
		} catch (e: unknown) {
			if (e instanceof DOMException && e.name === 'AbortError') {
				/* canceled */
			} else if (e instanceof Error && e.name === 'AbortError') {
				/* canceled */
			} else {
				error = e instanceof Error ? e.message : String(e);
			}
		} finally {
			if (reframeController === controller) reframeController = null;
			reframeBusy = false;
			reframingClipId = null;
		}
	}

	function chooseAnotherVideo() {
		cancelReframe();
		clearVideoSession();
		phase = 'idle';
		workflowStep = 'source';
		youtubeUrl = '';
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
		refreshSavedClipJobs();
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
					: step.id === 'captions' && !hasStoredVideo
						? false
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

			{#if savedClipJobs.length}
				<div class="saved-clips" aria-label="Saved clips">
					<div class="saved-clips-head">
						<strong>Saved clips</strong>
						<span>Reopen anytime — Videos always starts fresh otherwise</span>
					</div>
					<ul class="saved-clips-list">
						{#each savedClipJobs as job (job.id)}
							<li class="saved-clips-item">
								{#if job.thumbnailUrl}
									<img class="saved-clips-thumb" src={job.thumbnailUrl} alt="" />
								{:else}
									<div class="saved-clips-thumb saved-clips-thumb-empty" aria-hidden="true">
										<Film size={14} />
									</div>
								{/if}
								<div class="saved-clips-copy">
									<span class="saved-clips-title">{job.title}</span>
									<span class="saved-clips-meta">
										{job.clipCount} clip{job.clipCount === 1 ? '' : 's'}
										· {new Date(job.savedAt).toLocaleDateString()}
									</span>
								</div>
								<div class="saved-clips-actions">
									<button
										type="button"
										class="btn-resume"
										onclick={() => void openSavedClipJob(job.id)}
									>
										Open
									</button>
									<button
										type="button"
										class="btn-resume-dismiss"
										onclick={() => deleteSavedClipJob(job.id)}
										aria-label="Remove saved clips"
									>
										<Trash2 size={13} />
									</button>
								</div>
							</li>
						{/each}
					</ul>
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

	<!-- ── CAPTIONS (step 2) — handoff to Bulk ── -->
	{#if workflowStep === 'captions' && source}
		<section class="captions-step captions-handoff" aria-label="Caption settings">
			{#if error}
				<div class="videos-error results-error" role="alert">
					<AlertCircle size={14} />
					{error}
				</div>
			{/if}

			<div class="captions-head">
				<div class="captions-head-info">
					<h2 class="results-title">Style captions in Bulk</h2>
					<p class="captions-sub">
						Caption templates, colors, and brand defaults live in the Bulk editor — next to
						multi-idea generation and per-row templates.
					</p>
				</div>
				<div class="captions-head-actions">
					<button type="button" class="btn-ghost" onclick={chooseAnotherVideo}>
						<ArrowLeft size={13} /> Different video
					</button>
					<button type="button" class="btn-ghost" onclick={goToClipsStep}>
						Skip to clips
						<ArrowRight size={15} />
					</button>
				</div>
			</div>

			<div class="captions-handoff-card">
				{#if clips.length > 1}
					<div class="captions-clip-picker" role="listbox" aria-label="Clip for Bulk">
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
				<p class="captions-handoff-copy">
					{#if hasTranscriptForCaptions}
						Transcript ready for <strong>{source.title}</strong>
						{#if selectedClip}
							· {formatTimestamp(selectedClip.startSec)}–{formatTimestamp(selectedClip.endSec)}
						{/if}
					{:else}
						No transcript yet — you can still open Bulk to set caption brand defaults, or continue to clips.
					{/if}
				</p>
				<div class="captions-handoff-actions">
					<button
						type="button"
						class="btn-primary"
						onclick={() => void openCaptionsInBulk()}
						disabled={!selectedClip}
					>
						Open Bulk captions
						<ArrowRight size={15} />
					</button>
					<button type="button" class="btn-ghost" onclick={goToClipsStep}>
						Continue to clips
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
					{#if hasStoredVideo}
						<button type="button" class="btn-ghost" onclick={() => void openCaptionsInBulk()}>
							Style captions in Bulk
						</button>
						<button type="button" class="btn-ghost" onclick={goToCaptionsStep}>
							<ArrowLeft size={13} /> Captions
						</button>
					{/if}
					<button type="button" class="btn-ghost" onclick={saveCurrentClipsToLibrary}>
						<Bookmark size={13} />
						{clipsSavedNote || 'Save clips'}
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
					<div class="reframe-panel" aria-label="Auto-reframe clip options">
						<label class="enhance-opt reframe-toggle">
							<input
								type="checkbox"
								checked={autoReframe.enabled}
								disabled={reframeBusy}
								onchange={(e) => {
									const on = (e.currentTarget as HTMLInputElement).checked;
									autoReframe = { ...autoReframe, enabled: on };
									if (!on) clearClipReframes();
								}}
							/>
							<span class="enhance-box" aria-hidden="true"></span>
							Auto-reframe clips
						</label>
						{#if autoReframe.enabled}
							<div class="reframe-options">
								<label class="reframe-field">
									<span>Target ratio</span>
									<select
										value={autoReframe.aspectRatio}
										disabled={reframeBusy}
										onchange={(e) => {
											const v = (e.currentTarget as HTMLSelectElement).value;
											if (v === '9:16' || v === '4:5' || v === '1:1' || v === '16:9') {
												autoReframe = { ...autoReframe, aspectRatio: v };
											}
										}}
									>
										{#each REFRAME_ASPECTS as a}
											<option value={a.id}>{a.label} — {a.hint}</option>
										{/each}
									</select>
								</label>
								<label class="reframe-field">
									<span>Reframe type</span>
									<select
										value={autoReframe.method}
										disabled={reframeBusy}
										onchange={(e) => {
											const v = (e.currentTarget as HTMLSelectElement).value;
											if (v === 'detection' || v === 'saliency') {
												autoReframe = { ...autoReframe, method: v };
											}
										}}
									>
										{#each REFRAME_METHODS as m}
											<option value={m.id}>{m.label} — {m.hint}</option>
										{/each}
									</select>
								</label>
								<label class="reframe-field">
									<span>Edge fill</span>
									<select
										value={autoReframe.paddingMethod}
										disabled={reframeBusy}
										onchange={(e) => {
											const v = (e.currentTarget as HTMLSelectElement).value;
											if (v === 'blur' || v === 'solid_color') {
												autoReframe = { ...autoReframe, paddingMethod: v };
											}
										}}
									>
										{#each REFRAME_PADDING as p}
											<option value={p.id}>{p.label} — {p.hint}</option>
										{/each}
									</select>
								</label>
								<label class="reframe-field reframe-motion">
									<span>Camera motion {autoReframe.motionThreshold.toFixed(2)}</span>
									<input
										type="range"
										min="0"
										max="1"
										step="0.05"
										disabled={reframeBusy}
										value={autoReframe.motionThreshold}
										oninput={(e) => {
											autoReframe = {
												...autoReframe,
												motionThreshold: Number((e.currentTarget as HTMLInputElement).value),
											};
										}}
									/>
								</label>
								<label class="enhance-opt">
									<input
										type="checkbox"
										checked={autoReframe.debug}
										disabled={reframeBusy}
										onchange={(e) => {
											autoReframe = {
												...autoReframe,
												debug: (e.currentTarget as HTMLInputElement).checked,
											};
										}}
									/>
									<span class="enhance-box" aria-hidden="true"></span>
									Debug mode
								</label>
							</div>

							<div class="reframe-actions">
								{#if reframeBusy}
									<button type="button" class="btn-ghost reframe-cancel" onclick={cancelReframe}>
										Cancel
									</button>
									<span class="reframe-progress" role="status">
										<Loader size={14} class="spin" />
										Reframing {Math.min(reframeProgress.done + 1, reframeProgress.total)}/{reframeProgress.total}
										{#if reframeProgress.clipTitle}
											— {reframeProgress.clipTitle}
										{/if}
									</span>
								{:else}
									<button
										type="button"
										class="btn-primary"
										disabled={!pyautoflipReady || !hasStoredVideo || clipsNeedingReframe === 0}
										onclick={() => void applyReframeToClips()}
									>
										{#if clipsNeedingReframe === 0 && clipsReframedReady > 0}
											Clips reframed ({clipsReframedReady})
										{:else}
											Apply to {clipsNeedingReframe || clips.length} clip{clipsNeedingReframe === 1 ? '' : 's'}
										{/if}
									</button>
								{/if}
							</div>

							{#if !pyautoflipReady}
								<p class="reframe-warn" role="status">
									<AlertCircle size={13} />
									Install with <code>npm run pyautoflip:install</code>, then refresh.
								</p>
							{:else if clipsReframedReady > 0 && clipsNeedingReframe > 0}
								<p class="reframe-hint">
									{clipsReframedReady} ready · {clipsNeedingReframe} need apply (settings changed).
								</p>
							{:else}
								<p class="reframe-hint">
									Reframe one clip with the button under its preview, or apply to all at once.
									Download uses the reframed file. Can take a while per clip.
								</p>
							{/if}
						{/if}
					</div>

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
								exporting={isExporting || reframingClipId === clip.id}
								reframeEnabled={autoReframe.enabled && hasStoredVideo}
								reframing={reframingClipId === clip.id}
								reframeReady={
									!!clip.reframedPlaybackUrl && clip.reframeSettingsKey === currentReframeKey
								}
								reframeLocked={reframeBusy && reframingClipId !== clip.id}
								muted={videoMuted}
								layout={clipLayout}
								aspectRatio={
									clip.reframedPlaybackUrl && clip.reframeSettingsKey === currentReframeKey
										? reframeAspectCss
										: aspectMeta.css
								}
								enhance={captionEnhance}
								onselect={() => selectClip(clip, { play: false })}
								onplay={(el) => {
									selectedClipId = clip.id;
									playerVideo = el;
									pauseOtherClipVideos(el);
								}}
								onexport={() => void downloadClip(clip)}
								onreframe={() => void reframeSingleClip(clip)}
								onstudio={(tpl) => void openClipInStudio(clip, tpl)}
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

	.captions-handoff-card {
		max-width: 32rem;
		padding: 1.25rem;
		border-radius: 12px;
		border: 1px solid color-mix(in oklab, var(--app-border, #e2e8f0) 90%, transparent);
		background: var(--app-surface-2, #f8fafc);
		display: flex;
		flex-direction: column;
		gap: 0.85rem;
	}

	.captions-handoff-copy {
		margin: 0;
		font-size: 0.875rem;
		line-height: 1.45;
		color: var(--app-text-2, #475569);
	}

	.captions-handoff-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
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

	.saved-clips {
		max-width: 34rem;
		margin: -0.35rem auto 1.35rem;
		padding: 0.9rem 1rem;
		border-radius: 0.85rem;
		background: #f8fafc;
		border: 1px solid #e2e8f0;
		text-align: left;
		animation: slide-up 0.45s 0.1s ease both;
	}

	.saved-clips-head {
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
		margin-bottom: 0.7rem;
	}

	.saved-clips-head strong {
		font-size: 0.85rem;
		font-weight: 700;
		color: #0f172a;
	}

	.saved-clips-head span {
		font-size: 0.72rem;
		color: #64748b;
	}

	.saved-clips-list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.45rem;
	}

	.saved-clips-item {
		display: flex;
		align-items: center;
		gap: 0.65rem;
		padding: 0.45rem 0.5rem;
		border-radius: 0.65rem;
		background: #fff;
		border: 1px solid #e2e8f0;
	}

	.saved-clips-thumb {
		width: 40px;
		height: 40px;
		border-radius: 0.45rem;
		object-fit: cover;
		flex-shrink: 0;
		background: #e2e8f0;
	}

	.saved-clips-thumb-empty {
		display: grid;
		place-items: center;
		color: #94a3b8;
	}

	.saved-clips-copy {
		min-width: 0;
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 0.1rem;
	}

	.saved-clips-title {
		font-size: 0.8rem;
		font-weight: 600;
		color: #0f172a;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.saved-clips-meta {
		font-size: 0.7rem;
		color: #64748b;
	}

	.saved-clips-actions {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		flex-shrink: 0;
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

	.reframe-panel {
		margin-bottom: 0.85rem;
		padding: 0.75rem 0.85rem;
		border-radius: 0.75rem;
		border: 1px solid #e2e8f0;
		background: #fff;
	}

	.reframe-toggle {
		margin-bottom: 0;
	}

	.reframe-options {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.65rem 0.85rem;
		margin-top: 0.75rem;
		padding-top: 0.75rem;
		border-top: 1px solid #f1f5f9;
	}

	.reframe-field {
		display: flex;
		flex-direction: column;
		gap: 0.28rem;
		font-size: 0.72rem;
		font-weight: 650;
		color: #64748b;
		text-transform: uppercase;
		letter-spacing: 0.03em;
	}

	.reframe-field select,
	.reframe-field input[type='range'] {
		font: inherit;
		text-transform: none;
		letter-spacing: normal;
		font-weight: 550;
		color: #1e293b;
		border: 1px solid #e2e8f0;
		border-radius: 0.45rem;
		padding: 0.4rem 0.5rem;
		background: #f8fafc;
	}

	.reframe-motion {
		grid-column: 1 / -1;
	}

	.reframe-motion input[type='range'] {
		padding: 0;
		border: none;
		background: transparent;
		accent-color: #7c3aed;
	}

	.reframe-actions {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.65rem;
		margin-top: 0.75rem;
	}

	.reframe-cancel {
		border-color: #fecaca;
		color: #b91c1c;
	}

	.reframe-cancel:hover {
		background: #fef2f2;
	}

	.reframe-progress {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		font-size: 0.78rem;
		font-weight: 600;
		color: #475569;
	}

	.reframe-warn,
	.reframe-hint {
		display: flex;
		align-items: flex-start;
		gap: 0.4rem;
		margin: 0.65rem 0 0;
		font-size: 0.78rem;
		line-height: 1.35;
		color: #64748b;
	}

	.reframe-warn {
		color: #b45309;
	}

	.reframe-warn code {
		font-size: 0.72rem;
		padding: 0.05rem 0.28rem;
		border-radius: 0.25rem;
		background: #f1f5f9;
		color: #334155;
	}

	@media (max-width: 640px) {
		.reframe-options {
			grid-template-columns: 1fr;
		}
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
