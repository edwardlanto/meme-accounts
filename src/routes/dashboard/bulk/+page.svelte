<script lang="ts">
	import { onMount } from 'svelte';
	import { flip } from 'svelte/animate';
	import { fly } from 'svelte/transition';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { supabase } from '$lib/supabase';
	import {
		DEFAULT_BRAND_KIT,
		loadBrandKit,
		saveBrandKit,
		mergeCaptionDefaultsIntoKit,
		type BrandKitSettings,
	} from '$lib/studio/brand-kit';
	import {
		type BulkShow,
		type BulkSlide,
		createBlankShow,
		createBlankSlide,
		activeSlideOf,
		templateForSlideType,
		rowNeedsBody,
		buildDraftStateFromShow,
		stashBulkImport,
		takeBulkClipHandoff,
		peekBulkClipHandoff,
		stripEmDashes,
		BULK_EMOTIONS,
		BULK_AUDIENCES,
		audiencePromptText,
		type BulkEmotionId,
		type BulkClipHandoff,
		type BulkClipHandoffItem,
		defaultRowCaptions,
	} from '$lib/studio/bulk-to-studio';
	import {
		buildBulkShowsFromVideoClips,
		viralityScoreLabel,
		viralityScoreTone,
		takeClipImportResult,
		type BulkClipImportResult,
	} from '$lib/studio/bulk-video-clips';
	import type { VideoClip, VideoImportMeta } from '$lib/video-clips/types';
	import {
		templateUsesStockMedia,
		templateUsesStockVideo,
		resolveStockForTemplate,
		mapPool,
	} from '$lib/studio/bulk-stock';
	import { STUDIO_TEMPLATES, coerceTemplateId, type TemplateId } from '$lib/studio/template-ids';
	import { GOOGLE_FONTS } from '$lib/fonts';
	import { CAPTION_TEMPLATES } from '$lib/video-clips/caption-templates';
	import BulkSlidePreview from '$lib/components/bulk/BulkSlidePreview.svelte';
	import BulkSlideCarousel from '$lib/components/bulk/BulkSlideCarousel.svelte';
	import BulkPopover from '$lib/components/bulk/BulkPopover.svelte';
	import BulkClipImportDialog from '$lib/components/bulk/BulkClipImportDialog.svelte';
	import { r2SignRead } from '$lib/r2Client';
	import { formatTimestamp } from '$lib/video-clips/export-clip';
	import {
		DEFAULT_AUTO_REFRAME,
		REFRAME_ASPECTS,
		REFRAME_METHODS,
		REFRAME_PADDING,
		reframeSettingsKey,
		type AutoReframeOptions,
	} from '$lib/video-clips/reframe';
	import {
		Sparkles,
		Plus,
		Trash2,
		Copy,
		ChevronUp,
		ChevronDown,
		Loader2,
		Layers,
		Palette,
		ArrowRight,
		Save,
		Type,
		Captions,
		Image,
		X,
		Crop,
		Video,
		Download,
		BarChart3,
		Info,
	} from 'lucide-svelte';

	type SlidePopoverKind = 'intel' | 'reframe' | 'captions';

	/** Main preview width — filmstrip scrolls when thumbs exceed this. */
	const BULK_CAROUSEL_WIDTH = 252;
	const BULK_FILMSTRIP_THUMB = 64;

	let userId = $state('');
	let brandKit = $state<BrandKitSettings>({ ...DEFAULT_BRAND_KIT, cta: { ...DEFAULT_BRAND_KIT.cta } });
	let brandSavedNote = $state('');
	let showBrandPanel = $state(false);

	let topic = $state('');
	let audienceId = $state<string>('');
	let audience = $state('');
	let style = $state<'dark' | 'bold' | 'editorial' | 'minimal'>('bold');
	let emotion = $state<BulkEmotionId>('');
	/** Number of separate slideshows / ideas */
	let ideaCount = $state(5);
	/** Slides inside each slideshow */
	let slidesPerShow = $state(5);
	let appendMode = $state(false);
	let autoStock = $state(true);
	let stockFilling = $state(false);
	let stockNote = $state('');
	let generating = $state(false);
	let generateError = $state('');
	let shows = $state<BulkShow[]>([createBlankShow('news', undefined, 3)]);
	let selectedShowId = $state<string | null>(null);
	let pasteOpen = $state(false);
	let pasteText = $state('');
	let clipHandoff = $state<BulkClipHandoff | null>(null);
	let clipImportOpen = $state(false);
	let slidePopover = $state<{ showId: string; slideId: string; kind: SlidePopoverKind } | null>(null);
	let autoReframe = $state<AutoReframeOptions>({ ...DEFAULT_AUTO_REFRAME, enabled: true });
	let pyautoflipReady = $state(false);
	let ffmpegReady = $state(false);
	let exportBusySlideId = $state<string | null>(null);
	let clipProjectId = $state<string | null>(null);
	let clipProjectSource = $state<VideoImportMeta | null>(null);
	let clipProjectClips = $state<VideoClip[]>([]);
	let clipProjectMeta = $state({ summary: '', demo: false, model: '' });
	let clipProjectSaveTimer: ReturnType<typeof setTimeout> | null = null;
	let clipProjectSaving = $state(false);

	const currentReframeKey = $derived(
		reframeSettingsKey({
			aspectRatio: autoReframe.aspectRatio,
			method: autoReframe.method,
			motionThreshold: autoReframe.motionThreshold,
			paddingMethod: autoReframe.paddingMethod,
			debug: autoReframe.debug,
		}),
	);

	const selectedShow = $derived(shows.find((s) => s.id === selectedShowId) ?? shows[0] ?? null);
	const activeSlide = $derived(selectedShow ? activeSlideOf(selectedShow) : null);

	function captionDefaultsFromKit(kit: BrandKitSettings) {
		return defaultRowCaptions({
			enabled: kit.captionEnabledDefault === true,
			templateId: kit.captionTemplateId,
			fontSize: kit.captionFontSize,
			position: kit.captionPosition,
			color: kit.captionColor,
		});
	}

	function slideFromClipHandoffItem(
		item: BulkClipHandoffItem,
		template: TemplateId,
		caps: ReturnType<typeof captionDefaultsFromKit>,
	): BulkSlide {
		const c = item.captions;
		const usedReframe = !!String(item.reframedPlaybackUrl ?? '').trim();
		const sourceStart = item.clipStart;
		const sourceEnd = item.clipEnd;
		const duration = Math.max(0.5, sourceEnd - sourceStart);
		const playbackUrl = item.reframedPlaybackUrl || item.videoUrl;
		return {
			...createBlankSlide(template, caps),
			headline: item.headline || '',
			body: item.body || '',
			mediaUrl: playbackUrl,
			mediaKind: 'video',
			mediaThumb: item.thumbnailUrl || '',
			sourceClipStart: sourceStart,
			sourceClipEnd: sourceEnd,
			clipStart: usedReframe ? 0 : sourceStart,
			clipEnd: usedReframe ? duration : sourceEnd,
			sourceR2Key: item.sourceR2Key,
			reframedR2Key: item.reframedR2Key,
			reframedPlaybackUrl: item.reframedPlaybackUrl,
			reframeSettingsKey: item.reframeSettingsKey,
			captions: c
				? defaultRowCaptions({
						enabled: c.enabled !== false,
						templateId: c.templateId || brandKit.captionTemplateId,
						fontSize: c.fontSize || brandKit.captionFontSize,
						position: c.position || brandKit.captionPosition,
						color: c.customColor || brandKit.captionColor,
					})
				: caps,
		};
	}

	onMount(async () => {
		const {
			data: { user },
		} = await supabase.auth.getUser();
		if (!user) {
			goto('/login');
			return;
		}
		userId = user.id;
		brandKit = loadBrandKit(user.id);
		const caps = captionDefaultsFromKit(brandKit);
		const defaultTpl = coerceTemplateId(brandKit.defaultTemplateId);

		try {
			const res = await fetch('/api/videos/tools');
			if (res.ok) {
				const t = (await res.json()) as { pyautoflip?: boolean; ffmpeg?: boolean };
				pyautoflipReady = !!t.pyautoflip;
				ffmpegReady = !!t.ffmpeg;
			}
		} catch {
			/* ignore */
		}

		const pendingImport = takeClipImportResult();
		if (pendingImport) {
			onClipImportComplete(pendingImport);
			return;
		}

		const projectParam = $page.url.searchParams.get('project');
		if (projectParam) {
			await loadClipProject(projectParam);
			return;
		}

		const from = $page.url.searchParams.get('from');
		const handoff = from === 'clip' ? takeBulkClipHandoff() ?? peekBulkClipHandoff() : null;

		if (handoff?.clips?.length) {
			const newShows: BulkShow[] = handoff.clips.map((item, index) => {
				const slide = {
					...slideFromClipHandoffItem(item, defaultTpl, caps),
					sourceR2Key: item.sourceR2Key || handoff.sourceR2Key,
					mediaThumb: item.thumbnailUrl || handoff.thumbnailUrl || '',
				};
				return {
					id: crypto.randomUUID(),
					title: slide.headline || handoff.sourceTitle || `Clip ${index + 1}`,
					slides: [slide],
					activeSlideId: slide.id,
					fromVideoClips: true,
					clipSummary: index === 0 ? '' : '',
				};
			});
			shows = newShows;
			selectedShowId = newShows[0]?.id ?? null;
			return;
		}

		const show = createBlankShow(defaultTpl, caps, 3);
		shows = [show];
		selectedShowId = show.id;

		const importParam = $page.url.searchParams.get('import');
		if (importParam === 'clips') clipImportOpen = true;
	});

	function selectShow(id: string) {
		selectedShowId = id;
	}

	function selectSlide(showId: string, slideId: string) {
		shows = shows.map((s) => (s.id === showId ? { ...s, activeSlideId: slideId } : s));
		selectedShowId = showId;
	}

	function filmstripScrollAction(node: HTMLElement, activeSlideId: string) {
		function scrollActive() {
			requestAnimationFrame(() => {
				const active = node.querySelector('.filmstrip-on');
				if (active) {
					active.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
				}
			});
		}
		scrollActive();
		return {
			update(id: string) {
				if (id) scrollActive();
			},
		};
	}

	function updateShow(id: string, patch: Partial<BulkShow>) {
		shows = shows.map((s) => (s.id === id ? { ...s, ...patch } : s));
		scheduleClipProjectSave();
	}

	function updateSlide(showId: string, slideId: string, patch: Partial<BulkSlide>) {
		shows = shows.map((s) => {
			if (s.id !== showId) return s;
			return {
				...s,
				slides: s.slides.map((sl) => (sl.id === slideId ? { ...sl, ...patch } : sl)),
			};
		});
		scheduleClipProjectSave();
	}

	function setClipProjectContext(result: BulkClipImportResult) {
		clipProjectSource = result.source;
		clipProjectClips = result.clips;
		clipProjectMeta = {
			summary: result.summary,
			demo: result.demo,
			model: result.model,
		};
		if (result.projectId) clipProjectId = result.projectId;
	}

	function scheduleClipProjectSave() {
		if (!clipProjectId || !clipProjectSource) return;
		if (clipProjectSaveTimer) clearTimeout(clipProjectSaveTimer);
		clipProjectSaveTimer = setTimeout(() => {
			void persistClipProject();
		}, 1400);
	}

	async function persistClipProject() {
		if (!clipProjectId || !clipProjectSource || clipProjectSaving) return;
		clipProjectSaving = true;
		try {
			await fetch('/api/videos/clip-projects', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					id: clipProjectId,
					title: clipProjectSource.title,
					thumbnailUrl: clipProjectSource.thumbnailUrl,
					source: clipProjectSource,
					clips: clipProjectClips,
					summary: clipProjectMeta.summary,
					demo: clipProjectMeta.demo,
					model: clipProjectMeta.model,
					bulkShows: shows,
				}),
			});
		} catch {
			/* ignore — local edits still work */
		} finally {
			clipProjectSaving = false;
		}
	}

	async function loadClipProject(id: string) {
		try {
			const res = await fetch(`/api/videos/clip-projects/${id}`);
			const data = await res.json();
			if (!res.ok) throw new Error(data.error ?? 'Could not load project');
			const project = data.project as {
				id: string;
				source: VideoImportMeta;
				clips: VideoClip[];
				summary: string;
				demo: boolean;
				model: string;
				bulkShows: BulkShow[] | null;
			};
			const importResult: BulkClipImportResult = {
				source: project.source,
				clips: project.clips,
				summary: project.summary,
				demo: project.demo,
				model: project.model,
				projectId: project.id,
				bulkShows: project.bulkShows ?? undefined,
			};
			setClipProjectContext(importResult);
			if (project.bulkShows?.length) {
				shows = project.bulkShows;
				selectedShowId = project.bulkShows[0]?.id ?? null;
			} else {
				onClipImportComplete(importResult, { skipContext: true });
			}
		} catch (e: unknown) {
			generateError = e instanceof Error ? e.message : String(e);
		}
	}

	async function reframeBulkSlide(showId: string, slideId: string) {
		const show = shows.find((s) => s.id === showId);
		const slide = show?.slides.find((sl) => sl.id === slideId);
		if (!slide?.sourceR2Key) return;
		if (!pyautoflipReady) {
			alert('Auto-reframe needs pyautoflip. Run: npm run pyautoflip:install');
			return;
		}
		const startSec = Number(slide.sourceClipStart ?? slide.clipStart) || 0;
		const endSec = Math.max(startSec + 0.5, Number(slide.sourceClipEnd ?? slide.clipEnd) || 0);
		updateSlide(showId, slideId, { reframeBusy: true });
		try {
			const res = await fetch('/api/videos/reframe-clip', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					r2Key: slide.sourceR2Key,
					startSec,
					endSec,
					reframe: {
						aspectRatio: autoReframe.aspectRatio,
						method: autoReframe.method,
						motionThreshold: autoReframe.motionThreshold,
						paddingMethod: autoReframe.paddingMethod,
						debug: autoReframe.debug,
					},
				}),
			});
			const data = (await res.json()) as {
				error?: string;
				r2Key?: string;
				playbackUrl?: string;
				settingsKey?: string;
			};
			if (!res.ok) throw new Error(data.error || 'Reframe failed');
			const duration = Math.max(0.5, endSec - startSec);
			updateSlide(showId, slideId, {
				reframedR2Key: String(data.r2Key ?? ''),
				reframedPlaybackUrl: String(data.playbackUrl ?? ''),
				reframeSettingsKey: String(data.settingsKey ?? currentReframeKey),
				mediaUrl: String(data.playbackUrl ?? slide.mediaUrl),
				clipStart: 0,
				clipEnd: duration,
				reframeBusy: false,
			});
		} catch (e) {
			console.warn('[bulk] reframe failed', e);
			alert(e instanceof Error ? e.message : 'Reframe failed');
			updateSlide(showId, slideId, { reframeBusy: false });
		}
	}

	async function reframeAllBulkSlides(showId: string) {
		const show = shows.find((s) => s.id === showId);
		if (!show) return;
		for (const slide of show.slides) {
			if (!slide.sourceR2Key || slide.mediaKind !== 'video') continue;
			if (slide.reframedPlaybackUrl && slide.reframeSettingsKey === currentReframeKey) continue;
			await reframeBulkSlide(showId, slide.id);
		}
	}

	function onClipImportComplete(
		result: BulkClipImportResult,
		opts?: { skipContext?: boolean },
	) {
		if (!opts?.skipContext) setClipProjectContext(result);
		if (result.bulkShows?.length) {
			shows = appendMode ? [...shows, ...result.bulkShows] : result.bulkShows;
			selectedShowId = result.bulkShows[0]?.id ?? null;
		} else {
			const newShows = buildBulkShowsFromVideoClips(result.source, result.clips, {
				template: coerceTemplateId(brandKit.defaultTemplateId),
				captionDefaults: captionDefaultsFromKit(brandKit),
				summary: result.summary,
				demo: result.demo,
				model: result.model,
			});
			shows = appendMode ? [...shows, ...newShows] : newShows;
			selectedShowId = newShows[0]?.id ?? null;
		}
		clipHandoff = null;
		if (clipProjectId) scheduleClipProjectSave();
	}

	function openSlidePopover(showId: string, slideId: string, kind: SlidePopoverKind) {
		selectSlide(showId, slideId);
		slidePopover = { showId, slideId, kind };
	}

	function closeSlidePopover() {
		slidePopover = null;
	}

	const popoverSlide = $derived.by(() => {
		if (!slidePopover) return null;
		const show = shows.find((s) => s.id === slidePopover!.showId);
		const slide = show?.slides.find((sl) => sl.id === slidePopover!.slideId);
		if (!show || !slide) return null;
		return { show, slide, kind: slidePopover!.kind };
	});

	async function downloadBulkSlide(showId: string, slideId: string) {
		const show = shows.find((s) => s.id === showId);
		const slide = show?.slides.find((sl) => sl.id === slideId);
		if (!slide?.sourceR2Key) {
			alert('Full MP4 export needs a stored source video (re-import with yt-dlp).');
			return;
		}
		if (!ffmpegReady) {
			alert('ffmpeg is required. Run: brew install ffmpeg');
			return;
		}
		const startSec = Number(slide.sourceClipStart ?? slide.clipStart) || 0;
		const endSec = Math.max(startSec + 0.5, Number(slide.sourceClipEnd ?? slide.clipEnd) || 0);
		exportBusySlideId = slideId;
		try {
			if (
				slide.reframedR2Key &&
				slide.reframeSettingsKey === currentReframeKey &&
				slide.reframedPlaybackUrl
			) {
				const { url } = await r2SignRead({ key: slide.reframedR2Key });
				const res = await fetch(url);
				if (!res.ok) throw new Error('Could not download reframed clip');
				const blob = await res.blob();
				const filename = `${slide.headline.replace(/[^\w.-]+/g, '_').slice(0, 80) || 'clip'}.mp4`;
				const objectUrl = URL.createObjectURL(blob);
				const a = document.createElement('a');
				a.href = objectUrl;
				a.download = filename;
				document.body.appendChild(a);
				a.click();
				a.remove();
				URL.revokeObjectURL(objectUrl);
				return;
			}
			const res = await fetch('/api/videos/export-clip', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					r2Key: slide.sourceR2Key,
					startSec,
					endSec,
					filename: slide.headline,
				}),
			});
			if (!res.ok) {
				const data = await res.json().catch(() => ({}));
				throw new Error((data as { error?: string }).error ?? 'Export failed');
			}
			const blob = await res.blob();
			const filename =
				res.headers.get('content-disposition')?.match(/filename="([^"]+)"/)?.[1] ??
				`${slide.headline.replace(/[^\w.-]+/g, '_').slice(0, 80) || 'clip'}.mp4`;
			const objectUrl = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = objectUrl;
			a.download = filename;
			document.body.appendChild(a);
			a.click();
			a.remove();
			URL.revokeObjectURL(objectUrl);
		} catch (e) {
			console.warn('[bulk] export failed', e);
			alert(e instanceof Error ? e.message : 'Export failed');
		} finally {
			exportBusySlideId = null;
		}
	}

	function updateActiveCaptions(showId: string, patch: Partial<BulkSlide['captions']>) {
		const show = shows.find((s) => s.id === showId);
		if (!show) return;
		const slide = activeSlideOf(show);
		updateSlide(showId, slide.id, { captions: { ...slide.captions, ...patch } });
	}

	function setSlideTemplate(showId: string, slideId: string, template: TemplateId) {
		const next = coerceTemplateId(template);
		const current = shows.find((s) => s.id === showId)?.slides.find((sl) => sl.id === slideId);
		const usesMedia = templateUsesStockMedia(next);
		const wantsVideo = templateUsesStockVideo(next);
		// A photo can't stand in for a video template (and vice versa), so refetch on a kind switch.
		const mediaStillUsable =
			!!String(current?.mediaUrl ?? '').trim() &&
			(wantsVideo ? current?.mediaKind === 'video' : current?.mediaKind !== 'video');

		updateSlide(showId, slideId, {
			template: next,
			...(usesMedia ? {} : { mediaUrl: '', mediaKind: null, mediaThumb: '' }),
		});

		if (autoStock && usesMedia && !mediaStillUsable) {
			void fillStockForSlide(showId, slideId);
		}
	}

	function addShow() {
		const show = createBlankShow(
			coerceTemplateId(brandKit.defaultTemplateId),
			captionDefaultsFromKit(brandKit),
			slidesPerShow,
		);
		shows = [...shows, show];
		selectedShowId = show.id;
		if (autoStock) {
			void fillStockForShows([show.id], { force: true });
		}
	}

	function duplicateShow(id: string) {
		const src = shows.find((s) => s.id === id);
		if (!src) return;
		const slides = src.slides.map((sl) => ({
			...sl,
			id: crypto.randomUUID(),
			captions: { ...sl.captions },
		}));
		const copy: BulkShow = {
			...src,
			id: crypto.randomUUID(),
			title: src.title ? `${src.title} (copy)` : '',
			slides,
			activeSlideId: slides[0]?.id ?? '',
		};
		const idx = shows.findIndex((s) => s.id === id);
		shows = [...shows.slice(0, idx + 1), copy, ...shows.slice(idx + 1)];
		selectedShowId = copy.id;
	}

	function deleteShow(id: string) {
		if (shows.length <= 1) {
			const show = createBlankShow(
				coerceTemplateId(brandKit.defaultTemplateId),
				captionDefaultsFromKit(brandKit),
				3,
			);
			shows = [show];
			selectedShowId = show.id;
			return;
		}
		const idx = shows.findIndex((s) => s.id === id);
		shows = shows.filter((s) => s.id !== id);
		selectedShowId = shows[Math.max(0, idx - 1)]?.id ?? shows[0]?.id ?? null;
	}

	function moveShow(id: string, dir: -1 | 1) {
		const idx = shows.findIndex((s) => s.id === id);
		const next = idx + dir;
		if (idx < 0 || next < 0 || next >= shows.length) return;
		const copy = [...shows];
		const [item] = copy.splice(idx, 1);
		copy.splice(next, 0, item);
		shows = copy;
	}

	function addSlideToShow(showId: string) {
		const caps = captionDefaultsFromKit(brandKit);
		const slide = createBlankSlide(coerceTemplateId(brandKit.defaultTemplateId), caps);
		shows = shows.map((s) =>
			s.id === showId ? { ...s, slides: [...s.slides, slide], activeSlideId: slide.id } : s,
		);
		selectedShowId = showId;
		if (autoStock && templateUsesStockMedia(slide.template)) {
			void fillStockForSlide(showId, slide.id);
		}
	}

	function removeSlideFromShow(showId: string, slideId: string) {
		shows = shows.map((s) => {
			if (s.id !== showId) return s;
			if (s.slides.length <= 1) return s;
			const slides = s.slides.filter((sl) => sl.id !== slideId);
			const activeSlideId =
				s.activeSlideId === slideId ? slides[0]!.id : s.activeSlideId;
			return { ...s, slides, activeSlideId };
		});
	}

	function applyPasteLines() {
		const lines = pasteText
			.split(/\n/)
			.map((l) => stripEmDashes(l))
			.filter(Boolean);
		if (!lines.length) return;
		const caps = captionDefaultsFromKit(brandKit);
		const t = coerceTemplateId(brandKit.defaultTemplateId);
		const newShows = lines.map((title) => {
			const show = createBlankShow(t, caps, slidesPerShow);
			show.title = title;
			if (show.slides[0]) show.slides[0].headline = title;
			return show;
		});
		shows = appendMode ? [...shows, ...newShows] : newShows;
		selectedShowId = shows[0]?.id ?? null;
		pasteOpen = false;
		pasteText = '';
	}

	async function fillStockForShows(showIds?: string[], opts?: { force?: boolean }) {
		const force = opts?.force === true;
		const targetShows = shows.filter((s) => !showIds || showIds.includes(s.id));
		const targets: { showId: string; slideId: string; slide: BulkSlide; showTitle: string }[] = [];
		for (const show of targetShows) {
			for (const slide of show.slides) {
				if (!templateUsesStockMedia(slide.template)) continue;
				if (!force && String(slide.mediaUrl ?? '').trim()) continue;
				targets.push({
					showId: show.id,
					slideId: slide.id,
					slide,
					showTitle: show.title,
				});
			}
		}
		if (!targets.length) {
			stockNote = 'No image/video slides to fill';
			setTimeout(() => (stockNote = ''), 2500);
			return;
		}
		stockFilling = true;
		stockNote = `Finding stock for ${targets.length} slide${targets.length === 1 ? '' : 's'}…`;
		const loading = new Set(targets.map((t) => t.slideId));
		shows = shows.map((s) => ({
			...s,
			slides: s.slides.map((sl) => (loading.has(sl.id) ? { ...sl, mediaLoading: true } : sl)),
		}));

		const topicHint = topic.trim();
		const results = await mapPool(targets, 3, async ({ showId, slideId, slide, showTitle }) => {
			try {
				const pick = await resolveStockForTemplate(
					slide.template,
					slide.headline || showTitle,
					slide.body,
					[topicHint, showTitle].filter(Boolean).join(' '),
				);
				return {
					showId,
					slideId,
					ok: !!pick?.url,
					patch: {
						mediaLoading: false,
						mediaUrl: pick?.url ?? slide.mediaUrl ?? '',
						mediaKind: pick?.kind ?? slide.mediaKind ?? null,
						mediaThumb: pick?.thumb ?? slide.mediaThumb ?? '',
					} satisfies Partial<BulkSlide>,
					error: pick?.url ? '' : 'no match',
				};
			} catch (e: unknown) {
				return {
					showId,
					slideId,
					ok: false,
					patch: { mediaLoading: false } satisfies Partial<BulkSlide>,
					error: e instanceof Error ? e.message : 'stock failed',
				};
			}
		});

		// Apply all patches in one write to avoid concurrent update races
		const byKey = new Map(results.map((r) => [`${r.showId}:${r.slideId}`, r.patch]));
		shows = shows.map((s) => ({
			...s,
			slides: s.slides.map((sl) => {
				const patch = byKey.get(`${s.id}:${sl.id}`);
				return patch ? { ...sl, ...patch } : sl;
			}),
		}));

		stockFilling = false;
		const filled = results.filter((r) => r.ok).length;
		const failed = results.length - filled;
		if (filled === 0) {
			const sampleErr = results.find((r) => r.error)?.error;
			stockNote = sampleErr
				? `Stock failed: ${sampleErr}`
				: 'Stock found nothing — check Unsplash/Pexels keys or try Fill stock again';
		} else if (failed > 0) {
			stockNote = `Stock filled ${filled}/${results.length} slides`;
		} else {
			stockNote = `Stock filled ${filled} slide${filled === 1 ? '' : 's'}`;
		}
		setTimeout(() => (stockNote = ''), 4000);
	}

	async function fillStockForSlide(showId: string, slideId: string) {
		const show = shows.find((s) => s.id === showId);
		const slide = show?.slides.find((s) => s.id === slideId);
		if (!show || !slide || !templateUsesStockMedia(slide.template)) return;
		updateSlide(showId, slideId, { mediaLoading: true });
		try {
			const pick = await resolveStockForTemplate(
				slide.template,
				slide.headline || show.title,
				slide.body,
				[topic.trim(), show.title].filter(Boolean).join(' '),
			);
			updateSlide(showId, slideId, {
				mediaLoading: false,
				mediaUrl: pick?.url ?? '',
				mediaKind: pick?.kind ?? null,
				mediaThumb: pick?.thumb ?? '',
			});
			stockNote = pick?.url
				? `Stock set (${pick.source ?? 'stock'})`
				: 'No stock match for this slide';
			setTimeout(() => (stockNote = ''), 2500);
		} catch (e: unknown) {
			updateSlide(showId, slideId, { mediaLoading: false });
			stockNote = e instanceof Error ? e.message : 'Stock failed';
			setTimeout(() => (stockNote = ''), 3000);
		}
	}

	async function generateIdeas() {
		const t = topic.trim();
		if (!t || generating) return;
		generating = true;
		generateError = '';
		try {
			const res = await fetch('/api/generate-slides', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					topic: t,
					style,
					slideCount: slidesPerShow,
					deckCount: ideaCount,
					imageCount: 0,
					audience: audiencePromptText(audienceId, audience) || 'general audience',
					emotion: emotion || undefined,
				}),
			});
			const data = await res.json();
			if (!res.ok) throw new Error(data?.error || `Generate failed (${res.status})`);

			const caps = captionDefaultsFromKit(brandKit);
			let decks = Array.isArray(data.decks) ? data.decks : [];
			// Fallback: single carousel → one show
			if (!decks.length && Array.isArray(data.slides)) {
				decks = [{ title: t.slice(0, 48), slides: data.slides }];
			}
			if (!decks.length) throw new Error('No slideshows returned');

			const newShows: BulkShow[] = decks.map((d: any) => {
				const slidesRaw = Array.isArray(d.slides) ? d.slides : [];
				const slides: BulkSlide[] = slidesRaw.map((s: any) => ({
					id: crypto.randomUUID(),
					template: templateForSlideType(s.type),
					headline: stripEmDashes(String(s.headline ?? '')),
					body: stripEmDashes(String(s.body ?? s.subheadline ?? '')),
					captions: { ...caps },
				}));
				if (!slides.length) slides.push(createBlankSlide('news', caps));
				return {
					id: crypto.randomUUID(),
					title: stripEmDashes(String(d.title ?? '')),
					slides,
					activeSlideId: slides[0]!.id,
				};
			});

			shows = appendMode ? [...shows, ...newShows] : newShows;
			selectedShowId = shows[0]?.id ?? null;
			if (autoStock) {
				await fillStockForShows(
					newShows.map((s) => s.id),
					{ force: true },
				);
			}
		} catch (e: any) {
			generateError = e?.message || 'Failed to generate ideas';
		} finally {
			generating = false;
		}
	}

	function onGenerateKeydown(e: KeyboardEvent) {
		if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
			e.preventDefault();
			void generateIdeas();
		}
	}

	function saveBrand() {
		if (!userId || !activeSlide) return;
		brandKit = {
			...brandKit,
			captionTemplateId: activeSlide.captions.templateId,
			captionPosition: activeSlide.captions.position,
			captionFontSize: activeSlide.captions.fontSize,
			captionColor: activeSlide.captions.color,
			captionEnabledDefault: activeSlide.captions.enabled,
		};
		const ok = saveBrandKit(userId, brandKit);
		brandSavedNote = ok ? 'Brand saved' : 'Could not save';
		setTimeout(() => (brandSavedNote = ''), 2000);
	}

	function saveCaptionAsBrand(slide: BulkSlide) {
		if (!userId) return;
		brandKit = mergeCaptionDefaultsIntoKit(
			{ ...brandKit, captionEnabledDefault: slide.captions.enabled },
			{
				captionTemplateId: slide.captions.templateId,
				captionPosition: slide.captions.position,
				captionFontSize: slide.captions.fontSize,
				captionColor: slide.captions.color,
			},
		);
		saveBrandKit(userId, brandKit);
		brandSavedNote = 'Caption defaults saved';
		setTimeout(() => (brandSavedNote = ''), 2000);
	}

	function openShowInStudio(show: BulkShow) {
		const state = buildDraftStateFromShow(show, {
			brandCtaEnabled: !!(brandKit.cta.headline || brandKit.cta.image),
		});
		stashBulkImport(state);
		goto('/dashboard/studio?from=bulk');
	}

	function openInStudio() {
		if (!selectedShow) return;
		openShowInStudio(selectedShow);
	}
</script>

<svelte:head>
	<title>Bulk editor - Social Poster</title>
</svelte:head>

<svelte:window onkeydown={onGenerateKeydown} />

<div class="bulk">
	<header class="bulk-header">
		<div class="bulk-header-text">
			<h1>Bulk editor</h1>
		</div>
		<div class="bulk-header-actions">
			<button type="button" class="btn-ghost" onclick={() => (clipImportOpen = true)}>
				<Video size={15} />
				Import clips
			</button>
			<button type="button" class="btn-ghost" onclick={() => (showBrandPanel = !showBrandPanel)}>
				<Palette size={15} />
				Brand
			</button>
			<!-- <button type="button" class="btn-primary" onclick={openInStudio} disabled={!selectedShow}>
				Studio
				<ArrowRight size={15} />
			</button> -->
		</div>
	</header>

	{#if brandSavedNote}
		<p class="saved-toast" role="status">{brandSavedNote}</p>
	{/if}

	{#if showBrandPanel}
		<section class="brand-panel" aria-label="Brand settings">
			<div class="brand-grid">
				<label class="field">
					<span>Logo URL</span>
					<input bind:value={brandKit.logoUrl} placeholder="https://…" />
				</label>
				<label class="field">
					<span>Primary</span>
					<input type="color" bind:value={brandKit.primaryColor} />
				</label>
				<label class="field">
					<span>Accent</span>
					<input type="color" bind:value={brandKit.accentColor} />
				</label>
				<label class="field">
					<span>Headline font</span>
					<select bind:value={brandKit.headlineFont}>
						{#each GOOGLE_FONTS as f}
							<option value={f.family}>{f.family}</option>
						{/each}
					</select>
				</label>
				<label class="field">
					<span>Default template</span>
					<select bind:value={brandKit.defaultTemplateId}>
						{#each STUDIO_TEMPLATES as t}
							<option value={t.id}>{t.label}</option>
						{/each}
					</select>
				</label>
				<label class="field">
					<span>Caption size</span>
					<input type="number" min="16" max="64" bind:value={brandKit.captionFontSize} />
				</label>
				<label class="field check">
					<span>Captions on by default</span>
					<input type="checkbox" bind:checked={brandKit.captionEnabledDefault} />
				</label>
			</div>
			<div class="brand-actions">
				<button type="button" class="btn-primary" onclick={saveBrand}>
					<Save size={14} /> Save brand
				</button>
			</div>
		</section>
	{/if}

	<section class="generate-bar" aria-label="Generate ideas">
		<label class="field grow">
			<span>Topic</span>
			<input
				bind:value={topic}
				placeholder="e.g. regenerative medicine breakthroughs"
				onkeydown={(e) => e.key === 'Enter' && !e.metaKey && !e.ctrlKey && e.preventDefault()}
			/>
		</label>
		<label class="field">
			<span>Audience</span>
			<select bind:value={audienceId}>
				{#each BULK_AUDIENCES as a}
					<option value={a.id}>{a.label}</option>
				{/each}
			</select>
		</label>
		{#if audienceId === 'custom'}
			<label class="field">
				<span>Describe audience</span>
				<input bind:value={audience} placeholder="e.g. first-time home buyers" />
			</label>
		{/if}
		<label class="field">
			<span>Style</span>
			<select bind:value={style}>
				<option value="bold">Bold</option>
				<option value="dark">Dark</option>
				<option value="editorial">Editorial</option>
				<option value="minimal">Minimal</option>
			</select>
		</label>
		<label class="field">
			<span>Emotion</span>
			<select bind:value={emotion}>
				{#each BULK_EMOTIONS as e}
					<option value={e.id}>{e.label}</option>
				{/each}
			</select>
		</label>
		<label class="field count">
			<span>Ideas ({ideaCount})</span>
			<input type="range" min="1" max="8" bind:value={ideaCount} />
		</label>
		<label class="field count">
			<span>Slides/show ({slidesPerShow})</span>
			<input type="range" min="3" max="8" bind:value={slidesPerShow} />
		</label>
		<label class="append-toggle">
			<input type="checkbox" bind:checked={appendMode} />
			Append
		</label>
		<label class="append-toggle" title="Only image & video templates">
			<input type="checkbox" bind:checked={autoStock} />
			Auto stock
		</label>
		<div class="generate-bar-tail">
			<button
				type="button"
				class="btn-primary generate-btn"
				onclick={() => void generateIdeas()}
				disabled={generating || !topic.trim()}
			>
				{#if generating}
					<Loader2 size={15} class="spin" />
					Generating…
				{:else}
					<Sparkles size={15} />
					Generate
				{/if}
			</button>
		</div>
	</section>
	{#if generateError}
		<p class="err" role="alert">{generateError}</p>
	{/if}
	{#if stockNote}
		<p class="stock-note" role="status">{stockNote}</p>
	{/if}

	<BulkClipImportDialog bind:open={clipImportOpen} userId={userId} oncomplete={onClipImportComplete} />

	<section class="stack-wrap" aria-label="Slideshow stack">
		<div class="rows-toolbar">
			<span class="rows-count"><Layers size={14} /> {shows.length} slideshows</span>
			<div class="rows-toolbar-actions">
				<button type="button" class="btn-ghost sm" onclick={() => (clipImportOpen = true)}>
					<Video size={13} />
					Import clips
				</button>
				<button
					type="button"
					class="btn-ghost sm"
					onclick={() => void fillStockForShows(undefined, { force: true })}
					disabled={stockFilling}
				>
					{#if stockFilling}
						<Loader2 size={13} class="spin" />
					{:else}
						<Image size={13} />
					{/if}
					Fill stock
				</button>
				<button type="button" class="btn-ghost sm" onclick={() => (pasteOpen = !pasteOpen)}>
					<Type size={13} /> Paste ideas
				</button>
				<button type="button" class="btn-ghost sm" onclick={addShow}>
					<Plus size={13} /> Add slideshow
				</button>
			</div>
		</div>

		{#if pasteOpen}
			<div class="paste-box">
				<textarea bind:value={pasteText} rows="3" placeholder="One idea title per line…"></textarea>
				<button type="button" class="btn-primary sm" onclick={applyPasteLines}>Apply lines</button>
			</div>
		{/if}

		<ul class="show-stack">
			{#if generating}
				{#each Array(Math.max(1, ideaCount)) as _, gi (gi)}
					<li class="show-row show-skeleton" aria-hidden="true">
						<div class="show-body">
							<div class="show-preview-col">
								<div class="skeleton-block skeleton-preview"></div>
								<div class="skeleton-dots">
									{#each Array(3) as _}
										<span class="skeleton-dot"></span>
									{/each}
								</div>
								<div class="skeleton-filmstrip">
									{#each Array(3) as _}
										<span class="skeleton-thumb"></span>
									{/each}
								</div>
							</div>
							<div class="show-side">
								<div class="skeleton-line skeleton-title-row"></div>
								<div class="slide-editor skeleton-editor">
									<div class="skeleton-line skeleton-headline"></div>
									<div class="skeleton-line skeleton-body"></div>
									<div class="skeleton-line skeleton-body short"></div>
									<div class="skeleton-chips">
										<span></span><span></span>
									</div>
								</div>
							</div>
						</div>
					</li>
				{/each}
			{:else}
			{#each shows as show, i (show.id)}
				{@const slide = activeSlideOf(show)}
				<li
					class="show-row"
					class:show-on={show.id === selectedShow?.id}
					animate:flip={{ duration: 380 }}
					in:fly={{ y: 22, duration: 460, delay: Math.min(i * 48, 280) }}
				>
					<div class="show-body">
						<div class="show-preview-col" aria-label="Slide carousel">
							{#if show.slides.length}
								<BulkSlideCarousel
									slides={show.slides}
									activeSlideId={show.activeSlideId}
									width={BULK_CAROUSEL_WIDTH}
									loadingSlideIds={show.slides.filter((s) => s.mediaLoading).map((s) => s.id)}
									onselect={(slideId) => selectSlide(show.id, slideId)}
								/>
							{/if}

							{#if show.slides.length > 1}
							<div class="filmstrip-wrap">
								<div
									class="clip-filmstrip"
									aria-label="All slides"
									use:filmstripScrollAction={show.activeSlideId}
								>
									{#each show.slides as sl, si (sl.id)}
										<button
											type="button"
											class="filmstrip-item"
											class:filmstrip-on={sl.id === show.activeSlideId}
											style="width:{BULK_FILMSTRIP_THUMB}px"
											title={`Slide ${si + 1}${sl.headline ? `: ${sl.headline}` : ''}`}
											onclick={() => selectSlide(show.id, sl.id)}
										>
											{#if sl.mediaLoading}
												<span class="skeleton-block skeleton-thumb-inline"></span>
											{:else}
												<BulkSlidePreview slide={sl} width={BULK_FILMSTRIP_THUMB} />
											{/if}
											<span class="filmstrip-num">{si + 1}</span>
											{#if sl.clipMeta && !sl.mediaLoading}
												<span class="filmstrip-score score-{viralityScoreTone(sl.clipMeta.viralityScore)}">
													{viralityScoreLabel(sl.clipMeta.viralityScore)}
												</span>
											{/if}
										</button>
									{/each}
								</div>
								<button
									type="button"
									class="filmstrip-add-fab"
									title="Add slide"
									aria-label="Add slide"
									onclick={() => addSlideToShow(show.id)}
								>
									<Plus size={16} strokeWidth={2.5} />
								</button>
							</div>
							{/if}
						</div>

						<div class="show-side">
							<div class="show-head">
								<button type="button" class="show-index" onclick={() => selectShow(show.id)}>{i + 1}</button>
								<input
									class="show-title"
									value={show.title}
									oninput={(e) => updateShow(show.id, { title: (e.currentTarget as HTMLInputElement).value })}
									onfocus={() => selectShow(show.id)}
									placeholder="Slideshow idea title"
								/>
								{#if show.fromVideoClips && show.clipSummary}
									<button
										type="button"
										class="show-summary-btn"
										title="AI summary"
										onclick={() => openSlidePopover(show.id, show.slides[0]!.id, 'intel')}
									>
										<Info size={13} />
									</button>
								{/if}
								<div class="show-actions">
									<button type="button" class="icon-btn" title="Move up" onclick={() => moveShow(show.id, -1)} disabled={i === 0}>
										<ChevronUp size={14} />
									</button>
									<button
										type="button"
										class="icon-btn"
										title="Move down"
										onclick={() => moveShow(show.id, 1)}
										disabled={i === shows.length - 1}
									>
										<ChevronDown size={14} />
									</button>
									<button type="button" class="icon-btn" title="Duplicate" onclick={() => duplicateShow(show.id)}>
										<Copy size={14} />
									</button>
									<button type="button" class="icon-btn danger" title="Delete" onclick={() => deleteShow(show.id)}>
										<Trash2 size={14} />
									</button>
								</div>
							</div>

							{#key slide.id}
							<div class="slide-editor">
							<div class="slide-main">
								<input
									class="slide-headline"
									value={slide.headline}
									oninput={(e) =>
										updateSlide(show.id, slide.id, {
											headline: (e.currentTarget as HTMLInputElement).value,
										})}
									placeholder="Slide headline / hook"
								/>
								{#if show.slides.length > 1}
									<button
										type="button"
										class="icon-btn remove-slide"
										title="Remove slide"
										aria-label="Remove slide"
										onclick={() => removeSlideFromShow(show.id, slide.id)}
									>
										<X size={16} />
									</button>
								{/if}
							</div>

							{#if rowNeedsBody(slide.template)}
								<textarea
									class="slide-body-text"
									rows="3"
									value={slide.body}
									oninput={(e) =>
										updateSlide(show.id, slide.id, {
											body: (e.currentTarget as HTMLTextAreaElement).value,
										})}
									placeholder="Body copy"
								></textarea>
							{/if}

							<div class="slide-menu">
								{#if slide.clipMeta}
									<button
										type="button"
										class="menu-item score-chip score-{viralityScoreTone(slide.clipMeta.viralityScore)}"
										onclick={() => openSlidePopover(show.id, slide.id, 'intel')}
									>
										<BarChart3 size={14} />
										{viralityScoreLabel(slide.clipMeta.viralityScore)} viral
									</button>
								{/if}
								<button
									type="button"
									class="menu-item"
									class:menu-item-on={slidePopover?.showId === show.id && slidePopover?.slideId === slide.id && slidePopover?.kind === 'captions'}
									class:menu-item-active={slide.captions.enabled}
									onclick={() => openSlidePopover(show.id, slide.id, 'captions')}
								>
									<Captions size={14} />
									Captions
									{#if slide.captions.enabled}
										<span class="menu-pill">on</span>
									{:else}
										<span class="menu-pill muted">off</span>
									{/if}
								</button>
								{#if templateUsesStockMedia(slide.template)}
									<button
										type="button"
										class="menu-item"
										disabled={slide.mediaLoading}
										onclick={() => void fillStockForSlide(show.id, slide.id)}
									>
										{#if slide.mediaLoading}
											<Loader2 size={14} class="spin" />
										{:else}
											<Image size={14} />
										{/if}
										Stock
										{#if slide.mediaUrl}
											<span class="menu-pill">set</span>
										{/if}
									</button>
								{/if}
								{#if slide.sourceR2Key && slide.mediaKind === 'video'}
									<button
										type="button"
										class="menu-item"
										class:menu-item-on={slidePopover?.showId === show.id && slidePopover?.slideId === slide.id && slidePopover?.kind === 'reframe'}
										onclick={() => openSlidePopover(show.id, slide.id, 'reframe')}
									>
										<Crop size={14} />
										Reframe
										{#if slide.reframedPlaybackUrl && slide.reframeSettingsKey === currentReframeKey}
											<span class="menu-pill">done</span>
										{/if}
									</button>
									<button
										type="button"
										class="menu-item"
										disabled={exportBusySlideId === slide.id}
										onclick={() => void downloadBulkSlide(show.id, slide.id)}
									>
										{#if exportBusySlideId === slide.id}
											<Loader2 size={14} class="spin" />
										{:else}
											<Download size={14} />
										{/if}
										MP4
									</button>
								{/if}
							</div>

							<div class="slide-template-row">
								<label class="slide-template-label">
									<span>Template</span>
									<select
										class="tpl-select"
										value={slide.template}
										onchange={(e) =>
											setSlideTemplate(show.id, slide.id, (e.currentTarget as HTMLSelectElement).value as TemplateId)}
									>
										{#each STUDIO_TEMPLATES as t}
											<option value={t.id}>{t.label}</option>
										{/each}
									</select>
								</label>
							</div>
							</div>
							{/key}

							<button
								type="button"
								class="studio-fab"
								onclick={() => openShowInStudio(show)}
								title="Edit this slideshow in Studio"
							>
								Edit in Studio
								<ArrowRight size={15} />
							</button>
						</div>
					</div>
				</li>
			{/each}
			{/if}
		</ul>
	</section>

	{#if popoverSlide}
		{@const { show: popShow, slide: popSlide, kind } = popoverSlide}
		<BulkPopover
			open={true}
			onclose={closeSlidePopover}
			wide={kind !== 'intel'}
			title={kind === 'intel' ? 'Clip intel' : kind === 'reframe' ? 'Auto-reframe' : 'Captions'}
			subtitle={popSlide.headline || 'Slide'}
		>
			{#if kind === 'intel'}
				<div class="intel-panel">
					{#if popShow.clipSummary}
						<p class="intel-summary">{popShow.clipSummary}</p>
					{/if}
					{#if popSlide.clipMeta}
						<div class="intel-score score-{viralityScoreTone(popSlide.clipMeta.viralityScore)}">
							<span class="intel-score-num">{viralityScoreLabel(popSlide.clipMeta.viralityScore)}</span>
							<span class="intel-score-label">virality / 10</span>
						</div>
						{#if popSlide.clipMeta.hook}
							<p class="intel-hook"><strong>Hook</strong> {popSlide.clipMeta.hook}</p>
						{/if}
						<p class="intel-reason">
							<strong>Why viral</strong>
							{popSlide.clipMeta.reason || popSlide.body || 'Ranked for pacing, hook strength, and engagement potential.'}
						</p>
						{#if popSlide.sourceClipStart != null && popSlide.sourceClipEnd != null}
							<p class="intel-time">
								Segment {formatTimestamp(popSlide.sourceClipStart)} → {formatTimestamp(popSlide.sourceClipEnd)}
							</p>
						{/if}
						{#if popSlide.clipMeta.transcript}
							<div class="intel-transcript">
								<strong>Transcript</strong>
								<p>{popSlide.clipMeta.transcript}</p>
							</div>
						{/if}
					{:else}
						<p class="intel-reason">{popSlide.body || 'No clip metadata on this slide.'}</p>
					{/if}
				</div>
			{:else if kind === 'reframe'}
				<div class="reframe-pop">
					<div class="bulk-reframe-grid">
						<label class="bulk-reframe-field">
							<span>Target ratio</span>
							<select
								value={autoReframe.aspectRatio}
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
						<label class="bulk-reframe-field">
							<span>Reframe type</span>
							<select
								value={autoReframe.method}
								onchange={(e) => {
									const v = (e.currentTarget as HTMLSelectElement).value;
									if (v === 'detection' || v === 'saliency') {
										autoReframe = { ...autoReframe, method: v };
									}
								}}
							>
								{#each REFRAME_METHODS as m}
									<option value={m.id}>{m.label}</option>
								{/each}
							</select>
						</label>
						<label class="bulk-reframe-field">
							<span>Edge fill</span>
							<select
								value={autoReframe.paddingMethod}
								onchange={(e) => {
									const v = (e.currentTarget as HTMLSelectElement).value;
									if (v === 'blur' || v === 'solid_color') {
										autoReframe = { ...autoReframe, paddingMethod: v };
									}
								}}
							>
								{#each REFRAME_PADDING as p}
									<option value={p.id}>{p.label}</option>
								{/each}
							</select>
						</label>
					</div>
					{#if !pyautoflipReady}
						<p class="bulk-reframe-warn">Install pyautoflip: <code>npm run pyautoflip:install</code></p>
					{/if}
					<div class="reframe-pop-actions">
						<button
							type="button"
							class="btn-primary sm"
							disabled={popSlide.reframeBusy || !pyautoflipReady}
							onclick={() => void reframeBulkSlide(popShow.id, popSlide.id)}
						>
							{#if popSlide.reframeBusy}
								<Loader2 size={14} class="spin" />
								Reframing…
							{:else}
								<Crop size={14} />
								Apply to this clip
							{/if}
						</button>
						{#if popShow.fromVideoClips}
							<button
								type="button"
								class="btn-ghost sm"
								disabled={!pyautoflipReady}
								onclick={() => void reframeAllBulkSlides(popShow.id)}
							>
								Reframe all clips
							</button>
						{/if}
					</div>
				</div>
			{:else}
				<div class="captions-pop">
					<label class="cap-enable">
						<input
							type="checkbox"
							checked={popSlide.captions.enabled}
							onchange={(e) =>
								updateSlide(popShow.id, popSlide.id, {
									captions: {
										...popSlide.captions,
										enabled: (e.currentTarget as HTMLInputElement).checked,
									},
								})}
						/>
						Enable captions on this slide
					</label>
					{#if popSlide.captions.enabled}
						<div class="cap-grid">
							<label class="field">
								<span>Style</span>
								<select
									value={popSlide.captions.templateId}
									onchange={(e) =>
										updateSlide(popShow.id, popSlide.id, {
											captions: {
												...popSlide.captions,
												templateId: (e.currentTarget as HTMLSelectElement).value,
											},
										})}
								>
									{#each CAPTION_TEMPLATES as t}
										<option value={t.id}>{t.name}</option>
									{/each}
								</select>
							</label>
							<label class="field">
								<span>Size</span>
								<input
									type="number"
									min="16"
									max="64"
									value={popSlide.captions.fontSize}
									oninput={(e) =>
										updateSlide(popShow.id, popSlide.id, {
											captions: {
												...popSlide.captions,
												fontSize: Number((e.currentTarget as HTMLInputElement).value) || 28,
											},
										})}
								/>
							</label>
							<label class="field">
								<span>Position</span>
								<select
									value={popSlide.captions.position}
									onchange={(e) =>
										updateSlide(popShow.id, popSlide.id, {
											captions: {
												...popSlide.captions,
												position: (e.currentTarget as HTMLSelectElement).value as
													| 'top'
													| 'center'
													| 'bottom',
											},
										})}
								>
									<option value="top">Top</option>
									<option value="center">Center</option>
									<option value="bottom">Bottom</option>
								</select>
							</label>
							<label class="field">
								<span>Color</span>
								<input
									type="color"
									value={popSlide.captions.color}
									oninput={(e) =>
										updateSlide(popShow.id, popSlide.id, {
											captions: {
												...popSlide.captions,
												color: (e.currentTarget as HTMLInputElement).value,
											},
										})}
								/>
							</label>
						</div>
						<button type="button" class="btn-ghost sm" onclick={() => saveCaptionAsBrand(popSlide)}>
							Save as brand defaults
						</button>
					{/if}
				</div>
			{/if}
		</BulkPopover>
	{/if}
</div>

<style>
	.bulk {
		--bulk-border: color-mix(in oklab, var(--app-border) 65%, transparent);
		--bulk-preview-width: 252px;
		padding: 1.25rem 1.5rem 2.5rem;
		max-width: 1200px;
		margin: 0 auto;
		color: var(--app-text);
		background: #fff;
	}
	.bulk-header {
		display: flex;
		flex-wrap: wrap;
		justify-content: space-between;
		gap: 1rem;
		margin-bottom: 1rem;
	}
	.bulk-header h1 {
		font-size: 1.35rem;
		font-weight: 700;
		margin: 0 0 0.25rem;
	}
	.bulk-header p {
		margin: 0;
		font-size: 0.8125rem;
		color: var(--app-text-3);
		max-width: 40rem;
		line-height: 1.45;
	}
	.bulk-header-actions {
		gap: 0.5rem;
	}
	.saved-toast,
	.stock-note,
	.clip-banner {
		font-size: 0.75rem;
		color: var(--app-text-2);
		margin: 0 0 0.65rem;
	}
	.clip-banner-wrap {
		margin-bottom: 0.75rem;
	}
	.clip-banner-wrap .clip-banner {
		margin-bottom: 0.45rem;
	}
	.bulk-reframe-panel {
		padding: 0.65rem 0.75rem;
		border: 1px solid var(--bulk-border);
		border-radius: 10px;
		background: var(--app-surface-2);
	}
	.bulk-reframe-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
		gap: 0.55rem;
	}
	.bulk-reframe-field {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		font-size: 0.65rem;
		font-weight: 650;
		text-transform: uppercase;
		letter-spacing: 0.03em;
		color: var(--app-text-3);
	}
	.bulk-reframe-field select {
		font: inherit;
		text-transform: none;
		letter-spacing: normal;
		font-weight: 550;
		font-size: 0.78rem;
		color: var(--app-text);
		border: 1px solid var(--bulk-border);
		border-radius: 8px;
		padding: 0.35rem 0.45rem;
		background: var(--app-surface);
	}
	.bulk-reframe-warn {
		margin: 0.45rem 0 0;
		font-size: 0.72rem;
		color: var(--app-text-2);
	}
	.filmstrip-wrap {
		position: relative;
		width: var(--bulk-preview-width);
		max-width: var(--bulk-preview-width);
		padding-right: 1.1rem;
	}
	.clip-filmstrip {
		display: flex;
		flex-wrap: nowrap;
		gap: 0.35rem;
		width: 100%;
		overflow-x: auto;
		overflow-y: hidden;
		padding: 0.2rem 0.15rem 0.35rem;
		scroll-behavior: smooth;
		-webkit-overflow-scrolling: touch;
		scrollbar-width: thin;
		scrollbar-color: color-mix(in oklab, var(--app-text) 22%, transparent) transparent;
		mask-image: linear-gradient(to right, #000 0%, #000 calc(100% - 18px), transparent 100%);
	}
	.clip-filmstrip::-webkit-scrollbar {
		height: 4px;
	}
	.clip-filmstrip::-webkit-scrollbar-thumb {
		background: color-mix(in oklab, var(--app-text) 22%, transparent);
		border-radius: 999px;
	}
	.filmstrip-item {
		position: relative;
		flex: 0 0 auto;
		padding: 0;
		border: 2px solid transparent;
		border-radius: 10px;
		background: none;
		cursor: pointer;
		line-height: 0;
		transition:
			border-color 0.2s ease,
			box-shadow 0.2s ease,
			transform 0.2s ease;
	}
	.skeleton-thumb-inline {
		display: block;
		width: 100%;
		aspect-ratio: 4 / 5;
		border-radius: 8px;
	}
	.filmstrip-add-fab {
		position: absolute;
		right: -0.15rem;
		top: 50%;
		z-index: 5;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 2.15rem;
		height: 2.15rem;
		margin: 0;
		padding: 0;
		border: none;
		border-radius: 999px;
		background: var(--app-text);
		color: #fff;
		cursor: pointer;
		box-shadow:
			0 6px 18px color-mix(in oklab, var(--app-text) 35%, transparent),
			0 2px 6px rgba(0, 0, 0, 0.12);
		transform: translateY(-50%) translateY(-2px);
		transition:
			transform 0.22s cubic-bezier(0.22, 1, 0.36, 1),
			box-shadow 0.22s ease;
	}
	.filmstrip-add-fab:hover {
		transform: translateY(-50%) translateY(-5px) scale(1.06);
		box-shadow:
			0 10px 24px color-mix(in oklab, var(--app-text) 40%, transparent),
			0 4px 10px rgba(0, 0, 0, 0.16);
	}
	.filmstrip-add-fab:active {
		transform: translateY(-50%) translateY(-1px) scale(0.98);
	}
	.filmstrip-item.filmstrip-on {
		border-color: var(--app-accent, #e8ff48);
		box-shadow: 0 0 0 1px var(--app-accent, #e8ff48);
		transform: scale(1.04);
	}
	.filmstrip-num {
		position: absolute;
		top: 4px;
		left: 4px;
		z-index: 2;
		font-size: 0.55rem;
		font-weight: 700;
		color: #fff;
		background: rgba(0, 0, 0, 0.6);
		border-radius: 3px;
		padding: 0.05rem 0.25rem;
		line-height: 1.2;
	}
	.filmstrip-score {
		position: absolute;
		bottom: 4px;
		right: 4px;
		z-index: 2;
		font-size: 0.55rem;
		font-weight: 800;
		padding: 0.08rem 0.28rem;
		border-radius: 4px;
		line-height: 1.2;
	}
	.score-hot {
		background: #e8ff48;
		color: #080808;
	}
	.score-mid {
		background: #fbbf24;
		color: #080808;
	}
	.score-cool {
		background: rgba(255, 255, 255, 0.85);
		color: #334155;
	}
	.show-summary-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		width: 1.85rem;
		height: 1.85rem;
		padding: 0;
		border: 1px solid var(--bulk-border);
		border-radius: 7px;
		background: #fff;
		color: var(--app-text-2);
		cursor: pointer;
	}
	.menu-item.score-chip {
		font-weight: 800;
	}
	.intel-panel {
		display: flex;
		flex-direction: column;
		gap: 0.65rem;
		font-size: 0.82rem;
		line-height: 1.45;
		color: var(--app-text);
	}
	.intel-summary {
		margin: 0;
		padding: 0.55rem 0.65rem;
		border-radius: 8px;
		background: var(--app-surface-2);
		color: var(--app-text-2);
	}
	.intel-score {
		display: flex;
		align-items: baseline;
		gap: 0.35rem;
		padding: 0.45rem 0.65rem;
		border-radius: 8px;
	}
	.intel-score-num {
		font-size: 1.35rem;
		font-weight: 800;
		line-height: 1;
	}
	.intel-score-label {
		font-size: 0.72rem;
		font-weight: 650;
		opacity: 0.85;
	}
	.intel-hook,
	.intel-reason,
	.intel-time {
		margin: 0;
	}
	.intel-transcript {
		margin: 0;
	}
	.intel-transcript p {
		margin: 0.35rem 0 0;
		font-size: 0.78rem;
		color: var(--app-text-2);
		max-height: 8rem;
		overflow: auto;
	}
	.reframe-pop-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		margin-top: 0.75rem;
	}
	.captions-pop .cap-enable {
		display: flex;
		align-items: center;
		gap: 0.45rem;
		font-size: 0.82rem;
		margin-bottom: 0.65rem;
	}
	.captions-pop .cap-grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.55rem;
		margin-bottom: 0.65rem;
	}
	.brand-panel {
		border: 1px solid var(--bulk-border);
		border-radius: 10px;
		padding: 1rem;
		margin-bottom: 1rem;
		background: var(--app-surface-2);
	}
	.brand-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
		gap: 0.75rem;
	}
	.brand-actions {
		margin-top: 0.85rem;
	}
	.generate-bar {
		display: flex;
		flex-wrap: nowrap;
		gap: 0.55rem;
		align-items: flex-end;
		margin-bottom: 0.75rem;
		padding: 0.75rem;
		border: 1px solid var(--bulk-border);
		border-radius: 10px;
		background: #fff;
		overflow-x: auto;
		scrollbar-width: thin;
	}
	.generate-bar-tail {
		display: flex;
		align-items: flex-end;
		flex-shrink: 0;
	}
	.generate-bar .generate-btn {
		flex-shrink: 0;
		min-width: 7.35rem;
		white-space: nowrap;
	}
	.generate-bar .append-toggle {
		flex-shrink: 0;
	}
	.generate-bar .field {
		flex-shrink: 0;
	}
	.generate-bar .field.grow {
		flex: 1 1 8rem;
		min-width: 7rem;
	}
	.field {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		font-size: 0.6875rem;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: var(--app-text-3);
		min-width: 0;
	}
	.field.grow {
		flex: 1 1 180px;
	}
	.field.count {
		width: 130px;
	}
	.field.check {
		flex-direction: row;
		align-items: center;
		gap: 0.5rem;
		text-transform: none;
		letter-spacing: normal;
		font-size: 0.75rem;
		color: var(--app-text-2);
	}
	.field input,
	.field select,
	.paste-box textarea,
	.tpl-select,
	.slide-headline,
	.slide-body-text,
	.show-title,
	.cap-grid input,
	.cap-grid select {
		font: inherit;
		font-size: 0.8125rem;
		text-transform: none;
		letter-spacing: normal;
		color: var(--app-text);
		background: var(--app-surface-3);
		border: 1px solid var(--bulk-border);
		border-radius: 6px;
		padding: 0.4rem 0.5rem;
	}
	.field input[type='color'] {
		padding: 0.1rem;
		height: 2rem;
	}
	.field input[type='range'] {
		padding: 0;
		border: none;
		background: transparent;
	}
	.append-toggle {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		font-size: 0.75rem;
		color: var(--app-text-2);
		padding-bottom: 0.3rem;
	}
	.err {
		color: #e11d48;
		font-size: 0.8125rem;
		margin: 0 0 0.65rem;
	}
	.stack-wrap {
		border: 1px solid var(--bulk-border);
		border-radius: 12px;
		background: #fff;
		padding: 0.75rem;
	}
	.rows-toolbar {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 0.55rem;
	}
	.rows-count {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		font-size: 0.75rem;
		color: var(--app-text-2);
	}
	.rows-toolbar-actions {
		display: flex;
		gap: 0.35rem;
		flex-wrap: wrap;
	}
	.paste-box {
		display: flex;
		flex-direction: column;
		gap: 0.45rem;
		margin-bottom: 0.65rem;
	}
	.show-stack {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 10px;
	}
	.show-row {
		position: relative;
		padding: 0.85rem;
		min-height: 0;
		border-radius: 12px;
		background: #fff;
		border: 1px solid var(--bulk-border);
	}
	.show-row.show-on {
		background: #fff;
		border-color: color-mix(in oklab, var(--app-text) 18%, var(--bulk-border));
		box-shadow: 0 2px 12px color-mix(in oklab, var(--app-text) 6%, transparent);
	}
	.show-row.show-skeleton {
		pointer-events: none;
	}
	.show-body {
		display: flex;
		align-items: flex-start;
		gap: 0.85rem;
		min-width: 0;
	}
	.show-preview-col {
		display: flex;
		flex-direction: column;
		align-items: stretch;
		gap: 0.45rem;
		flex: 0 0 auto;
		width: var(--bulk-preview-width);
		min-width: 0;
	}
	.show-side {
		display: flex;
		flex-direction: column;
		gap: 0.55rem;
		flex: 1 1 0;
		min-width: 0;
	}
	.show-head {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		min-width: 0;
	}
	.show-index {
		width: 1.85rem;
		height: 1.85rem;
		flex-shrink: 0;
		border-radius: 7px;
		border: 1px solid var(--bulk-border);
		background: #fff;
		color: var(--app-text);
		font-weight: 700;
		font-size: 0.75rem;
		cursor: pointer;
	}
	.show-title {
		flex: 1 1 0;
		min-width: 0;
		font-weight: 650;
		font-size: 0.8125rem;
		background: #fff;
		border: 1px solid var(--bulk-border);
		border-radius: 8px;
		padding: 0.35rem 0.5rem;
	}
	.show-meta {
		font-size: 0.68rem;
		color: var(--app-text-3);
	}
	.show-actions {
		display: flex;
		gap: 0.1rem;
		flex-shrink: 0;
	}
	.slide-editor {
		display: flex;
		flex-direction: column;
		gap: 0.45rem;
		padding: 0.65rem 0.7rem 0.75rem;
		border-radius: 10px;
		background: #fff;
		border: 1px solid var(--bulk-border);
		flex: 1 1 auto;
		min-width: 0;
	}
	.studio-fab {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.4rem;
		align-self: flex-start;
		padding: 0.5rem 0.85rem;
		border: none;
		border-radius: 999px;
		background: var(--app-text);
		color: var(--app-surface);
		font-size: 0.75rem;
		font-weight: 650;
		cursor: pointer;
		box-shadow: 0 4px 14px color-mix(in oklab, var(--app-text) 22%, transparent);
	}
	.studio-fab:hover {
		transform: translateY(-1px);
		box-shadow: 0 6px 18px color-mix(in oklab, var(--app-text) 28%, transparent);
	}
	@media (max-width: 820px) {
		.show-body {
			flex-direction: column;
		}
		.show-preview-col {
			align-items: stretch;
			width: 100%;
			max-width: var(--bulk-preview-width);
		}
		.filmstrip-wrap {
			width: 100%;
			max-width: var(--bulk-preview-width);
		}
		.studio-fab {
			align-self: stretch;
			border-radius: 10px;
		}
	}
	.slide-main {
		display: flex;
		flex-wrap: wrap;
		gap: 0.35rem;
		align-items: center;
	}
	.slide-template-row {
		display: flex;
		align-items: flex-end;
		margin-top: 0.15rem;
		padding-top: 0.5rem;
		border-top: 1px solid color-mix(in oklab, var(--bulk-border) 70%, transparent);
	}
	.slide-template-label {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		font-size: 0.6875rem;
		font-weight: 600;
		color: var(--app-text-3);
		min-width: 0;
		flex: 1 1 140px;
	}
	.slide-template-label .tpl-select {
		width: 100%;
	}
	.tpl-select {
		background: var(--app-surface);
	}
	.slide-headline {
		flex: 1 1 180px;
		background: var(--app-surface);
		font-weight: 550;
	}
	.slide-body-text {
		width: 100%;
		resize: vertical;
		min-height: 2.6rem;
		background: var(--app-surface);
	}
	.slide-menu {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		flex-wrap: wrap;
	}
	.menu-item {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		border: 1px solid var(--bulk-border);
		background: var(--app-surface);
		color: var(--app-text-2);
		border-radius: 6px;
		padding: 0.28rem 0.5rem;
		font-size: 0.75rem;
		font-weight: 550;
		cursor: pointer;
	}
	.menu-item:hover,
	.menu-item-on {
		background: color-mix(in oklab, var(--app-text) 6%, var(--app-surface));
		color: var(--app-text);
	}
	.menu-item-active {
		border-color: color-mix(in oklab, var(--app-text) 35%, var(--bulk-border));
	}
	.menu-pill {
		font-size: 0.625rem;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		padding: 0.1rem 0.35rem;
		border-radius: 999px;
		background: color-mix(in oklab, var(--app-text) 14%, transparent);
		color: var(--app-text);
	}
	.menu-pill.muted {
		background: color-mix(in oklab, var(--app-text) 8%, transparent);
		color: var(--app-text-3);
	}
	.tpl-hint {
		font-size: 0.65rem;
		color: var(--app-text-3);
	}
	.captions-drawer {
		padding: 0.55rem;
		border-radius: 8px;
		background: var(--app-surface);
		border: 1px solid var(--bulk-border);
		color: var(--app-text);
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}
	.cap-enable {
		display: flex;
		align-items: center;
		gap: 0.45rem;
		font-size: 0.8rem;
		cursor: pointer;
	}
	.cap-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(110px, 1fr));
		gap: 0.45rem;
	}
	.cap-grid .field {
		color: var(--app-text-3);
	}
	.cap-grid input,
	.cap-grid select {
		background: var(--app-surface-3);
		border-color: var(--bulk-border);
		color: var(--app-text);
	}
	.icon-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 1.55rem;
		height: 1.55rem;
		border: none;
		border-radius: 4px;
		background: transparent;
		color: var(--app-text-3);
		cursor: pointer;
	}
	.icon-btn:hover:not(:disabled) {
		background: color-mix(in oklab, var(--app-text) 8%, transparent);
		color: var(--app-text);
	}
	.icon-btn:disabled {
		opacity: 0.3;
	}
	.icon-btn.danger:hover:not(:disabled),
	.icon-btn.remove-slide:hover:not(:disabled) {
		color: #e11d48;
	}
	.remove-slide {
		margin-left: 0.15rem;
	}
	.btn-primary,
	.btn-ghost {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.35rem;
		border-radius: 7px;
		font-size: 0.8125rem;
		font-weight: 550;
		padding: 0.5rem 0.75rem;
		cursor: pointer;
		border: 1px solid transparent;
	}
	.btn-primary {
		background: var(--app-text);
		color: var(--app-surface);
	}
	.btn-primary:disabled {
		opacity: 0.45;
	}
	.btn-ghost {
		background: transparent;
		border-color: var(--bulk-border);
		color: var(--app-text-2);
	}
	.sm {
		padding: 0.35rem 0.55rem;
		font-size: 0.75rem;
	}
	:global(.spin) {
		animation: spin 0.8s linear infinite;
	}
	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}
	@keyframes bulk-shimmer {
		0% {
			background-position: 100% 0;
		}
		100% {
			background-position: -100% 0;
		}
	}
	.skeleton-block {
		background: linear-gradient(110deg, #ececec 8%, #f8f8f8 18%, #ececec 33%);
		background-size: 200% 100%;
		animation: bulk-shimmer 1.4s ease-in-out infinite;
	}
	.skeleton-preview {
		width: 100%;
		aspect-ratio: 4 / 5;
		border-radius: 12px;
	}
	.skeleton-dots {
		display: flex;
		justify-content: center;
		gap: 0.38rem;
	}
	.skeleton-dot {
		width: 0.42rem;
		height: 0.42rem;
		border-radius: 999px;
		background: #e8e8e8;
	}
	.skeleton-filmstrip {
		display: flex;
		gap: 0.35rem;
		width: 100%;
	}
	.skeleton-thumb {
		flex: 1 1 0;
		aspect-ratio: 4 / 5;
		border-radius: 8px;
		background: linear-gradient(110deg, #ececec 8%, #f8f8f8 18%, #ececec 33%);
		background-size: 200% 100%;
		animation: bulk-shimmer 1.4s ease-in-out infinite;
	}
	.skeleton-line {
		height: 0.72rem;
		border-radius: 6px;
		background: linear-gradient(110deg, #ececec 8%, #f8f8f8 18%, #ececec 33%);
		background-size: 200% 100%;
		animation: bulk-shimmer 1.4s ease-in-out infinite;
	}
	.skeleton-title-row {
		height: 1.85rem;
		border-radius: 8px;
		margin-bottom: 0.45rem;
	}
	.skeleton-headline {
		height: 1.1rem;
		margin-bottom: 0.5rem;
	}
	.skeleton-body {
		height: 0.65rem;
		margin-bottom: 0.35rem;
	}
	.skeleton-body.short {
		width: 72%;
	}
	.skeleton-editor {
		background: #fff;
	}
	.skeleton-chips {
		display: flex;
		gap: 0.35rem;
		margin-top: 0.25rem;
	}
	.skeleton-chips span {
		width: 4.5rem;
		height: 1.5rem;
		border-radius: 999px;
		background: linear-gradient(110deg, #ececec 8%, #f8f8f8 18%, #ececec 33%);
		background-size: 200% 100%;
		animation: bulk-shimmer 1.4s ease-in-out infinite;
	}
</style>
