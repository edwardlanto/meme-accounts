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
	import {
		loadBulkWorkspace,
		saveBulkWorkspace,
		clearBulkWorkspace,
		showsHaveContent,
		touchBulkWorkspaceSession,
		archiveBulkShowsToHistory,
	} from '$lib/studio/bulk-workspace';
	import type { PageData } from './$types';
	import type { VideoClip, VideoImportMeta } from '$lib/video-clips/types';
	import {
		templateUsesStockMedia,
		templateUsesStockVideo,
		resolveStockForTemplate,
		mapPool,
	} from '$lib/studio/bulk-stock';
	import { STUDIO_TEMPLATES, coerceTemplateId, isVideoSplitFamily, type TemplateId } from '$lib/studio/template-ids';
	import { GOOGLE_FONTS } from '$lib/fonts';
	import { CAPTION_TEMPLATES } from '$lib/video-clips/caption-templates';
	import { prepareImageAsDataUrl } from '$lib/client/image-upload-prep';
	import BulkSlidePreview from '$lib/components/bulk/BulkSlidePreview.svelte';
	import BulkSlideCarousel from '$lib/components/bulk/BulkSlideCarousel.svelte';
	import BulkPopover from '$lib/components/bulk/BulkPopover.svelte';
	import BulkClipImportDialog from '$lib/components/bulk/BulkClipImportDialog.svelte';
	import { r2SignRead } from '$lib/r2Client';
	import { formatTimestamp } from '$lib/video-clips/export-clip';
	import {
		DEFAULT_AUTO_REFRAME,
		VIDEO_SPLIT_AUTO_REFRAME,
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
		History,
		FolderOpen,
		Clock,
		Eraser,
		Volume2,
		VolumeX,
		Highlighter,
	} from 'lucide-svelte';

	type SlidePopoverKind = 'intel' | 'reframe' | 'captions';

	type CloudWorkspaceListItem = {
		id: string;
		title: string;
		topic: string;
		thumbnailUrl: string | null;
		showCount: number;
		titles: string[];
		updatedAt: string;
		url: string;
	};

	/** Main preview width — filmstrip scrolls when thumbs exceed this. */
	const BULK_CAROUSEL_WIDTH = 252;
	const BULK_FILMSTRIP_THUMB = 64;

	let { data }: { data: PageData } = $props();

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
	let slidesPerShow = $state(3);
	let autoStock = $state(true);
	let stockFilling = $state(false);
	let stockNote = $state('');
	let generating = $state(false);
	let generateError = $state('');
	/** Empty until hydrate so we never flash a blank starter show. */
	let shows = $state<BulkShow[]>([]);
	let selectedShowId = $state<string | null>(null);
	let pasteOpen = $state(false);
	let pasteText = $state('');
	let libraryOpen = $state(false);
	let libraryEntries = $state<CloudWorkspaceListItem[]>([]);
	let libraryBusy = $state(false);
	let libraryNote = $state('');
	/** Cloud row currently open at /dashboard/bulk/[id] */
	let cloudWorkspaceId = $state<string | null>(null);
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
	let workspaceSaveTimer: ReturnType<typeof setTimeout> | null = null;
	let workspaceSaving = $state(false);
	let workspaceHydrated = $state(false);
	/** Brief hold so restore doesn't pop in before paint settles. */
	let workspaceRevealReady = $state(false);
	/** Ignore autosave until hydrate finishes (prevents refreshing yesterday’s savedAt). */
	let workspaceAutosaveReady = $state(false);

	const stackLoading = $derived(!workspaceHydrated || !workspaceRevealReady || generating);

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
			clipMeta: item.bestFrameSec || item.thumbnailR2Key
				? {
						clipId: '',
						viralityScore: 0,
						hook: '',
						reason: '',
						bestFrameSec: item.bestFrameSec,
						thumbnailR2Key: item.thumbnailR2Key,
					}
				: undefined,
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

	function leanShowsForCloud(source: BulkShow[]): BulkShow[] {
		return source.map((show) => ({
			...show,
			slides: (show.slides ?? []).map((sl) => {
				const { mediaLoading: _m, reframeBusy: _r, ...rest } = sl;
				const mediaUrl = String(rest.mediaUrl ?? '');
				if (mediaUrl.startsWith('data:') && mediaUrl.length > 180_000) {
					return { ...rest, mediaUrl: rest.mediaThumb || '', mediaThumb: rest.mediaThumb };
				}
				return rest;
			}),
		}));
	}

	async function refreshLibrary() {
		if (!userId) {
			libraryEntries = [];
			return;
		}
		try {
			const res = await fetch('/api/bulk/workspaces');
			if (!res.ok) return;
			const json = (await res.json()) as { workspaces?: CloudWorkspaceListItem[] };
			libraryEntries = Array.isArray(json.workspaces) ? json.workspaces : [];
		} catch {
			/* ignore */
		}
	}

	async function finishWorkspaceHydrate(opts?: { skeletonCount?: number; resumeUrl?: boolean }) {
		workspaceHydrated = true;
		void refreshLibrary();
		const holdMs = opts?.skeletonCount != null && opts.skeletonCount > 0 ? 280 : 160;
		await new Promise((r) => setTimeout(r, holdMs));
		// Filmstrips / focus can shove the window mid-page — pin to top after reveal.
		try {
			window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
		} catch {
			window.scrollTo(0, 0);
		}
		workspaceRevealReady = true;
		requestAnimationFrame(() => {
			try {
				window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
			} catch {
				window.scrollTo(0, 0);
			}
			// Enable autosave after the hydrate assignment wave settles
			setTimeout(() => {
				workspaceAutosaveReady = true;
			}, 80);
		});
		if (opts?.resumeUrl && typeof window !== 'undefined') {
			const url = new URL(window.location.href);
			if (url.searchParams.get('resume') !== '1' && !url.pathname.match(/\/bulk\/[^/]+$/)) {
				url.searchParams.set('resume', '1');
				history.replaceState({}, '', url.pathname + url.search + url.hash);
			}
		}
	}

	async function saveShowsToCloud(
		source: BulkShow[],
		opts?: { updateId?: string | null; topicOverride?: string },
	): Promise<string | null> {
		if (!userId || !showsHaveContent(source)) return null;
		const payload = {
			topic: opts?.topicOverride ?? topic,
			shows: leanShowsForCloud(source),
			selectedShowId,
			clipProjectId,
		};
		const updateId = opts?.updateId || undefined;
		const res = await fetch(updateId ? `/api/bulk/workspaces/${updateId}` : '/api/bulk/workspaces', {
			method: updateId ? 'PATCH' : 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(payload),
		});
		if (!res.ok) {
			const err = await res.json().catch(() => ({}));
			throw new Error((err as { error?: string }).error || 'Could not save slideshow');
		}
		const json = (await res.json()) as { id?: string };
		return json.id ?? updateId ?? null;
	}

	async function archiveCurrentToCloud() {
		if (!userId || !showsHaveContent(shows)) return null;
		const id = await saveShowsToCloud(shows);
		void refreshLibrary();
		return id;
	}

	async function saveCurrentToLibrary() {
		if (!userId || libraryBusy) return;
		if (!showsHaveContent(shows)) {
			libraryNote = 'Nothing to save yet — generate or edit a carousel first.';
			setTimeout(() => (libraryNote = ''), 2800);
			return;
		}
		libraryBusy = true;
		try {
			const id = await saveShowsToCloud(shows, { updateId: cloudWorkspaceId });
			if (!id) throw new Error('Save failed');
			cloudWorkspaceId = id;
			await refreshLibrary();
			libraryNote = 'Saved — only you can open this link';
			setTimeout(() => (libraryNote = ''), 2400);
			if ($page.params.id !== id) {
				await goto(`/dashboard/bulk/${id}`, { replaceState: true, noScroll: true });
			}
		} catch (e) {
			libraryNote = e instanceof Error ? e.message : 'Save failed';
			setTimeout(() => (libraryNote = ''), 3200);
		} finally {
			libraryBusy = false;
		}
	}

	async function clearAndStartFresh() {
		if (libraryBusy) return;
		libraryBusy = true;
		try {
			if (showsHaveContent(shows)) {
				const id = await saveShowsToCloud(shows, { updateId: cloudWorkspaceId });
				if (id) cloudWorkspaceId = id;
				await refreshLibrary();
			}
			if (userId) clearBulkWorkspace(userId);
			const caps = captionDefaultsFromKit(brandKit);
			const blank = createBlankShow(coerceTemplateId(brandKit.defaultTemplateId), caps, 3);
			workspaceAutosaveReady = false;
			workspaceRevealReady = false;
			shows = [blank];
			selectedShowId = blank.id;
			topic = '';
			cloudWorkspaceId = null;
			clipProjectId = null;
			libraryOpen = false;
			libraryNote = 'Saved previous work to library — starting fresh';
			setTimeout(() => (libraryNote = ''), 2800);
			await goto('/dashboard/bulk', { replaceState: true, noScroll: true });
			await new Promise((r) => setTimeout(r, 180));
			workspaceRevealReady = true;
			workspaceAutosaveReady = true;
		} catch (e) {
			libraryNote = e instanceof Error ? e.message : 'Could not clear workspace';
			setTimeout(() => (libraryNote = ''), 3200);
		} finally {
			libraryBusy = false;
		}
	}

	async function deleteLibraryEntry(entryId: string) {
		if (!userId || libraryBusy) return;
		try {
			const res = await fetch(`/api/bulk/workspaces/${entryId}`, { method: 'DELETE' });
			if (!res.ok) throw new Error('Delete failed');
			libraryEntries = libraryEntries.filter((e) => e.id !== entryId);
			if (cloudWorkspaceId === entryId) {
				cloudWorkspaceId = null;
				if (userId) clearBulkWorkspace(userId);
				const caps = captionDefaultsFromKit(brandKit);
				const blank = createBlankShow(coerceTemplateId(brandKit.defaultTemplateId), caps, 3);
				shows = [blank];
				selectedShowId = blank.id;
				topic = '';
				await goto('/dashboard/bulk', { replaceState: true, noScroll: true });
			}
		} catch (e) {
			libraryNote = e instanceof Error ? e.message : 'Delete failed';
			setTimeout(() => (libraryNote = ''), 2800);
		}
	}

	function formatHistoryWhen(isoOrTs: string | number): string {
		try {
			const ts = typeof isoOrTs === 'number' ? isoOrTs : Date.parse(isoOrTs);
			if (!Number.isFinite(ts)) return '';
			const now = Date.now();
			const diff = now - ts;
			if (diff < 60_000) return 'Just now';
			if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
			if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
			return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
		} catch {
			return '';
		}
	}

	onMount(async () => {
		if (typeof history !== 'undefined' && 'scrollRestoration' in history) {
			history.scrollRestoration = 'manual';
		}
		try {
			window.scrollTo(0, 0);
		} catch {
			/* ignore */
		}

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

		const cloud = data.cloudWorkspace;
		if (cloud?.shows?.length) {
			cloudWorkspaceId = cloud.id;
			shows = cloud.shows.map((s) => ({
				...s,
				slides: (s.slides ?? []).map((sl) => ({ ...sl })),
			}));
			selectedShowId =
				cloud.selectedShowId && shows.some((s) => s.id === cloud.selectedShowId)
					? cloud.selectedShowId
					: shows[0]?.id ?? null;
			if (cloud.topic?.trim()) topic = cloud.topic;
			if (cloud.clipProjectId) clipProjectId = cloud.clipProjectId;
			touchBulkWorkspaceSession(user.id);
			void persistBulkWorkspace();
			await finishWorkspaceHydrate({ skeletonCount: shows.length, resumeUrl: true });
			return;
		}

		const pendingImport = takeClipImportResult();
		if (pendingImport) {
			onClipImportComplete(pendingImport);
			touchBulkWorkspaceSession(user.id);
			await finishWorkspaceHydrate({ skeletonCount: shows.length || 2, resumeUrl: true });
			return;
		}

		const projectParam = $page.url.searchParams.get('project');
		if (projectParam) {
			await loadClipProject(projectParam);
			touchBulkWorkspaceSession(user.id);
			await finishWorkspaceHydrate({ skeletonCount: shows.length || 2, resumeUrl: true });
			return;
		}

		const from = $page.url.searchParams.get('from');
		const handoff = from === 'clip' ? takeBulkClipHandoff() ?? peekBulkClipHandoff() : null;

		if (handoff?.clips?.length) {
			const newShows: BulkShow[] = handoff.clips.map((item, index) => {
				const slide = {
					...slideFromClipHandoffItem(item, defaultTpl, caps),
					sourceR2Key: item.sourceR2Key || handoff.sourceR2Key,
					// Never fall back to the shared video poster — that made every scene photo identical.
					mediaThumb: item.thumbnailUrl || '',
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
			touchBulkWorkspaceSession(user.id);
			void persistBulkWorkspace();
			await finishWorkspaceHydrate({ skeletonCount: newShows.length, resumeUrl: true });
			return;
		}

		const saved = loadBulkWorkspace(user.id);
		// Bare /dashboard/bulk → placeholders. Resume only with ?resume=1 (Studio / F5 mid-edit).
		const wantResume = $page.url.searchParams.get('resume') === '1';
		if (wantResume && saved?.shows?.length) {
			shows = saved.shows;
			selectedShowId =
				saved.selectedShowId && saved.shows.some((s) => s.id === saved.selectedShowId)
					? saved.selectedShowId
					: saved.shows[0]?.id ?? null;
			if (saved.topic?.trim()) topic = saved.topic;
			if (saved.clipProjectId) clipProjectId = saved.clipProjectId;
			touchBulkWorkspaceSession(user.id);
			await finishWorkspaceHydrate({ skeletonCount: saved.shows.length, resumeUrl: true });
			return;
		}

		if (saved?.shows?.length) {
			try {
				await archiveBulkShowsToHistory(user.id, {
					shows: saved.shows,
					selectedShowId: saved.selectedShowId,
					topic: saved.topic,
				});
				libraryNote = 'Previous draft moved to Library — starting fresh';
				setTimeout(() => (libraryNote = ''), 3200);
			} catch {
				/* ignore */
			}
			clearBulkWorkspace(user.id);
		}

		const show = createBlankShow(defaultTpl, caps, 3);
		shows = [show];
		selectedShowId = show.id;
		await finishWorkspaceHydrate({ skeletonCount: 1 });

		const importParam = $page.url.searchParams.get('import');
		if (importParam === 'clips') clipImportOpen = true;
	});

	function scheduleBulkWorkspaceSave() {
		if (!userId || !workspaceHydrated) return;
		if (workspaceSaveTimer) clearTimeout(workspaceSaveTimer);
		workspaceSaveTimer = setTimeout(() => {
			void persistBulkWorkspace();
		}, 700);
	}

	async function persistBulkWorkspace() {
		if (!userId || workspaceSaving) return;
		workspaceSaving = true;
		try {
			await saveBulkWorkspace(userId, {
				shows,
				selectedShowId,
				topic,
				clipProjectId,
			});
			// Keep F5 / Studio return on the active draft
			if (typeof window !== 'undefined' && showsHaveContent(shows)) {
				const url = new URL(window.location.href);
				if (
					url.pathname.replace(/\/+$/, '') === '/dashboard/bulk' &&
					url.searchParams.get('resume') !== '1'
				) {
					url.searchParams.set('resume', '1');
					history.replaceState({}, '', url.pathname + url.search + url.hash);
				}
			}
			// Keep the open cloud row in sync while editing /dashboard/bulk/[id]
			if (cloudWorkspaceId && showsHaveContent(shows)) {
				await fetch(`/api/bulk/workspaces/${cloudWorkspaceId}`, {
					method: 'PATCH',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						topic,
						shows: leanShowsForCloud(shows),
						selectedShowId,
						clipProjectId,
					}),
				}).catch(() => {});
			}
		} finally {
			workspaceSaving = false;
		}
	}

	$effect(() => {
		// Track workspace mutations for autosave
		void shows;
		void selectedShowId;
		void topic;
		if (!workspaceHydrated || !userId || !workspaceAutosaveReady) return;
		scheduleBulkWorkspaceSave();
	});

	function selectShow(id: string) {
		selectedShowId = id;
	}

	function selectSlide(showId: string, slideId: string) {
		shows = shows.map((s) => {
			if (s.id !== showId) {
				// Keep other slideshows fully muted so only one preview can make sound.
				return {
					...s,
					slides: s.slides.map((sl) =>
						sl.mediaKind === 'video' && sl.videoMuted === false ? { ...sl, videoMuted: true } : sl,
					),
				};
			}
			return {
				...s,
				activeSlideId: slideId,
				slides: s.slides.map((sl) => {
					if (sl.id === slideId) return sl;
					if (sl.mediaKind === 'video' && sl.videoMuted === false) {
						return { ...sl, videoMuted: true };
					}
					return sl;
				}),
			};
		});
		selectedShowId = showId;
	}

	function filmstripScrollAction(node: HTMLElement, _activeSlideId: string) {
		function scrollActive() {
			requestAnimationFrame(() => {
				const active = node.querySelector('.filmstrip-on') as HTMLElement | null;
				if (!active) return;
				// Horizontal only inside the filmstrip — never scrollIntoView (that jumps the page).
				const left = active.offsetLeft - (node.clientWidth - active.offsetWidth) / 2;
				node.scrollTo({ left: Math.max(0, left), behavior: 'smooth' });
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
		const incoming = result.bulkShows?.length
			? result.bulkShows
			: buildBulkShowsFromVideoClips(result.source, result.clips, {
					template: coerceTemplateId(brandKit.defaultTemplateId),
					captionDefaults: captionDefaultsFromKit(brandKit),
					summary: result.summary,
					demo: result.demo,
					model: result.model,
					slideCount: slidesPerShow,
				});
		if (workspaceRevealReady && userId && showsHaveContent(shows)) {
			const prevShows = shows;
			void saveShowsToCloud(prevShows).then(() => refreshLibrary()).catch(() => {});
		}
		shows = incoming;
		selectedShowId = incoming[0]?.id ?? null;
		clipHandoff = null;
		if (clipProjectId) scheduleClipProjectSave();
		workspaceHydrated = true;
		void persistBulkWorkspace();
	}

	async function applyScenePhoto(showId: string, slideId: string) {
		const show = shows.find((s) => s.id === showId);
		const slide = show?.slides.find((sl) => sl.id === slideId);
		if (!slide) return;

		const existingStill = String(slide.mediaThumb ?? '').trim();
		// Only reuse a thumb when we know it's a clip-specific still (not the shared video poster).
		const hasDedicatedStill = !!(slide.clipMeta?.thumbnailR2Key && existingStill);
		if (hasDedicatedStill) {
			updateSlide(showId, slideId, {
				mediaUrl: existingStill,
				mediaKind: 'image',
				mediaThumb: existingStill,
			});
			stockNote = 'Scene photo applied';
			setTimeout(() => (stockNote = ''), 2500);
			return;
		}

		const r2Key = String(slide.sourceR2Key ?? '').trim();
		if (!r2Key) {
			if (existingStill) {
				updateSlide(showId, slideId, {
					mediaUrl: existingStill,
					mediaKind: 'image',
				});
				stockNote = 'Scene photo applied';
				setTimeout(() => (stockNote = ''), 2500);
				return;
			}
			stockNote = 'Scene photo needs the source video (re-import clips)';
			setTimeout(() => (stockNote = ''), 3500);
			return;
		}

		updateSlide(showId, slideId, { mediaLoading: true });
		stockNote = 'Grabbing best scene frame…';
		try {
			const startSec = Number(slide.sourceClipStart ?? slide.clipStart) || 0;
			const endSec = Math.max(
				startSec + 0.5,
				Number(slide.sourceClipEnd ?? slide.clipEnd) || startSec + 1,
			);
			const res = await fetch('/api/videos/scene-still', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					r2Key,
					startSec,
					endSec,
					bestFrameSec: slide.clipMeta?.bestFrameSec,
				}),
			});
			const data = await res.json().catch(() => ({}));
			if (!res.ok) throw new Error(String(data?.error || `Scene still failed (${res.status})`));
			const url = String(data.url ?? '').trim();
			if (!url) throw new Error('No still returned');
			updateSlide(showId, slideId, {
				mediaLoading: false,
				mediaUrl: url,
				mediaKind: 'image',
				mediaThumb: url,
				clipMeta: slide.clipMeta
					? {
							...slide.clipMeta,
							bestFrameSec: Number(data.bestFrameSec) || slide.clipMeta.bestFrameSec,
							thumbnailR2Key: String(data.r2Key ?? '') || slide.clipMeta.thumbnailR2Key,
						}
					: {
							clipId: '',
							viralityScore: 0,
							hook: '',
							reason: '',
							bestFrameSec: Number(data.bestFrameSec) || undefined,
							thumbnailR2Key: String(data.r2Key ?? '') || undefined,
						},
			});
			stockNote = 'Scene photo applied';
			setTimeout(() => (stockNote = ''), 2500);
		} catch (e: unknown) {
			updateSlide(showId, slideId, { mediaLoading: false });
			stockNote = e instanceof Error ? e.message : 'Scene photo failed';
			setTimeout(() => (stockNote = ''), 4000);
		}
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
		const nextCaptions = { ...slide.captions, ...patch };
		const nextImport = slide.studioCaptionImport
			? {
					...slide.studioCaptionImport,
					enabled: nextCaptions.enabled,
					templateId: nextCaptions.templateId,
					fontSize: nextCaptions.fontSize,
					position: nextCaptions.position,
					customColor: nextCaptions.color,
				}
			: slide.studioCaptionImport;
		updateSlide(showId, slide.id, {
			captions: nextCaptions,
			studioCaptionImport: nextImport,
		});
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

		// Multi split → prefer pyautoflip saliency (multi-face top/bottom stack)
		if (isVideoSplitFamily(next)) {
			autoReframe = { ...VIDEO_SPLIT_AUTO_REFRAME };
		}

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

	async function applyPasteLines() {
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
		await archiveCurrentToCloud().catch(() => {});
		shows = newShows;
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
				updateSlide(showId, slideId, {
					mediaLoading: false,
					mediaUrl: pick?.url ?? slide.mediaUrl ?? '',
					mediaKind: pick?.kind ?? slide.mediaKind ?? null,
					mediaThumb: pick?.thumb ?? slide.mediaThumb ?? '',
				});
				return { ok: !!pick?.url, error: pick?.url ? '' : 'no match' };
			} catch (e: unknown) {
				updateSlide(showId, slideId, { mediaLoading: false });
				return {
					ok: false,
					error: e instanceof Error ? e.message : 'stock failed',
				};
			}
		});

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
		void persistBulkWorkspace();
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
					autoHighlight: brandKit.textHighlightsEnabled !== false,
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
				let slides: BulkSlide[] = slidesRaw.map((s: any) => ({
					id: crypto.randomUUID(),
					template: templateForSlideType(s.type),
					headline: stripEmDashes(String(s.headline ?? '')),
					body: stripEmDashes(String(s.body ?? s.subheadline ?? '')),
					captions: { ...caps },
				}));
				while (slides.length < slidesPerShow) {
					slides.push(
						createBlankSlide(
							slides.length === 0 ? 'news' : 'textCarousel',
							caps,
						),
					);
				}
				slides = slides.slice(0, slidesPerShow);
				if (!slides.length) slides.push(createBlankSlide('news', caps));
				return {
					id: crypto.randomUUID(),
					title: stripEmDashes(String(d.title ?? '')),
					slides,
					activeSlideId: slides[0]!.id,
				};
			});

			await archiveCurrentToCloud().catch(() => {});
			shows = newShows;
			selectedShowId = shows[0]?.id ?? null;
			cloudWorkspaceId = null;
			// Reveal decks immediately so filmstrip/main show loaders while stock fills
			generating = false;
			if (autoStock) {
				await fillStockForShows(
					newShows.map((s) => s.id),
					{ force: true },
				);
			}
			await persistBulkWorkspace();
			try {
				const id = await saveShowsToCloud(newShows);
				if (id) {
					cloudWorkspaceId = id;
					void refreshLibrary();
					await goto(`/dashboard/bulk/${id}`, { replaceState: true, noScroll: true });
				}
			} catch {
				/* local stack still usable */
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

	function toggleWordHighlights() {
		brandKit = { ...brandKit, textHighlightsEnabled: !brandKit.textHighlightsEnabled };
		if (userId) saveBrandKit(userId, brandKit);
	}

	let brandLogoBusy = $state(false);

	async function onBrandLogoFile(e: Event) {
		const input = e.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		input.value = '';
		if (!file) return;
		brandLogoBusy = true;
		try {
			const dataUrl = await prepareImageAsDataUrl(file, {
				maxDim: 512,
				maxBytes: 400_000,
				quality: 0.82,
			});
			brandKit = { ...brandKit, logoUrl: dataUrl };
			brandSavedNote = 'Logo optimized — click Save brand';
			setTimeout(() => (brandSavedNote = ''), 2500);
		} catch (err: unknown) {
			brandSavedNote = err instanceof Error ? err.message : 'Logo upload failed';
			setTimeout(() => (brandSavedNote = ''), 3000);
		} finally {
			brandLogoBusy = false;
		}
	}

	async function onBrandCtaImageFile(e: Event) {
		const input = e.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		input.value = '';
		if (!file) return;
		brandLogoBusy = true;
		try {
			const dataUrl = await prepareImageAsDataUrl(file, {
				maxDim: 1080,
				maxBytes: 900_000,
				quality: 0.84,
			});
			brandKit = { ...brandKit, cta: { ...brandKit.cta, image: dataUrl } };
			brandSavedNote = 'CTA image optimized — click Save brand';
			setTimeout(() => (brandSavedNote = ''), 2500);
		} catch (err: unknown) {
			brandSavedNote = err instanceof Error ? err.message : 'CTA image failed';
			setTimeout(() => (brandSavedNote = ''), 3000);
		} finally {
			brandLogoBusy = false;
		}
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

	async function openShowInStudio(show: BulkShow) {
		const state = buildDraftStateFromShow(show, {
			brandCtaEnabled: !!(brandKit.cta.headline || brandKit.cta.image),
		});
		stashBulkImport(state);
		await persistBulkWorkspace();
		goto('/dashboard/studio?from=bulk');
	}

	function openInStudio() {
		if (!selectedShow) return;
		void openShowInStudio(selectedShow);
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
					<span>Upload logo</span>
					<input
						type="file"
						accept="image/*"
						disabled={brandLogoBusy}
						onchange={(e) => void onBrandLogoFile(e)}
					/>
				</label>
				<label class="field">
					<span>CTA image URL</span>
					<input
						value={brandKit.cta.image}
						placeholder="https://…"
						oninput={(e) => {
							brandKit = {
								...brandKit,
								cta: { ...brandKit.cta, image: (e.currentTarget as HTMLInputElement).value },
							};
						}}
					/>
				</label>
				<label class="field">
					<span>Upload CTA image</span>
					<input
						type="file"
						accept="image/*"
						disabled={brandLogoBusy}
						onchange={(e) => void onBrandCtaImageFile(e)}
					/>
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
	{#if libraryNote && !libraryOpen}
		<p class="stock-note" role="status">{libraryNote}</p>
	{/if}

	<BulkClipImportDialog bind:open={clipImportOpen} userId={userId} oncomplete={onClipImportComplete} />

	<section class="stack-wrap" aria-label="Slideshow stack">
		<div class="rows-toolbar">
			<span class="rows-count"
				><Layers size={14} />
				{#if stackLoading && !generating}
					Loading…
				{:else}
					{shows.length} slideshows
				{/if}
				{#if cloudWorkspaceId}
					<span class="workspace-url-chip" title="Private link — only you can open it"
						>/bulk/{cloudWorkspaceId.slice(0, 8)}…</span
					>
				{/if}
			</span>
			<div class="rows-toolbar-actions">
				<button
					type="button"
					class="btn-ghost sm"
					class:btn-ghost-on={libraryOpen}
					onclick={() => {
						libraryOpen = !libraryOpen;
						if (libraryOpen) void refreshLibrary();
					}}
					title="Your saved carousel stacks"
				>
					<History size={13} />
					Library
					{#if libraryEntries.length}
						<span class="history-badge">{libraryEntries.length}</span>
					{/if}
				</button>
				<button
					type="button"
					class="btn-ghost sm"
					onclick={() => void clearAndStartFresh()}
					disabled={libraryBusy || stackLoading}
					title="Save current work to Library and start a blank stack"
				>
					{#if libraryBusy}
						<Loader2 size={13} class="spin" />
					{:else}
						<Eraser size={13} />
					{/if}
					Clear &amp; fresh
				</button>
				<button type="button" class="btn-ghost sm" onclick={() => (clipImportOpen = true)}>
					<Video size={13} />
					Import clips
				</button>
				<button
					type="button"
					class="btn-ghost sm"
					onclick={() => void fillStockForShows(undefined, { force: true })}
					disabled={stockFilling || stackLoading}
				>
					{#if stockFilling}
						<Loader2 size={13} class="spin" />
					{:else}
						<Image size={13} />
					{/if}
					Fill stock
				</button>
				<button
					type="button"
					class="btn-ghost sm"
					class:btn-ghost-on={brandKit.textHighlightsEnabled}
					onclick={toggleWordHighlights}
					title={brandKit.textHighlightsEnabled
						? 'Word highlights on — generate wraps key phrases; [[…]] shows colored accents'
						: 'Word highlights off — headlines stay plain'}
					aria-pressed={brandKit.textHighlightsEnabled}
				>
					<Highlighter size={13} />
					Word highlights
				</button>
				<button type="button" class="btn-ghost sm" onclick={() => (pasteOpen = !pasteOpen)} disabled={stackLoading}>
					<Type size={13} /> Paste ideas
				</button>
				<button type="button" class="btn-ghost sm" onclick={addShow} disabled={stackLoading}>
					<Plus size={13} /> Add slideshow
				</button>
			</div>
		</div>

		{#if libraryOpen}
			<div class="history-panel" transition:fly={{ y: -8, duration: 220 }}>
				<div class="history-panel-head">
					<div class="history-panel-title">
						<FolderOpen size={15} />
						<span>Your library</span>
					</div>
					<div class="history-panel-actions">
						<button
							type="button"
							class="btn-ghost sm"
							onclick={() => void saveCurrentToLibrary()}
							disabled={libraryBusy || !showsHaveContent(shows)}
						>
							{#if libraryBusy}
								<Loader2 size={13} class="spin" />
							{:else}
								<Save size={13} />
							{/if}
							Save current
						</button>
						<button type="button" class="icon-btn" aria-label="Close" onclick={() => (libraryOpen = false)}>
							<X size={14} />
						</button>
					</div>
				</div>
				{#if libraryNote}
					<p class="history-note" role="status">{libraryNote}</p>
				{/if}
				{#if !libraryEntries.length}
					<p class="history-empty">
						Saved stacks appear here. Use Save current, Clear &amp; fresh, or Generate again — each gets a private
						URL only you can open.
					</p>
				{:else}
					<ul class="history-list">
						{#each libraryEntries as entry (entry.id)}
							<li class="history-item">
								<a
									class="history-card"
									class:history-card-on={entry.id === cloudWorkspaceId}
									href={entry.url}
									onclick={() => (libraryOpen = false)}
								>
									<div class="history-thumb-wrap">
										{#if entry.thumbnailUrl}
											<img class="history-thumb" src={entry.thumbnailUrl} alt="" loading="lazy" />
										{:else}
											<span class="history-thumb history-thumb-empty"><Layers size={18} /></span>
										{/if}
									</div>
									<div class="history-meta">
										<span class="history-topic">{entry.topic || entry.title || entry.titles[0] || 'Untitled'}</span>
										<span class="history-sub">
											<Clock size={11} />
											{formatHistoryWhen(entry.updatedAt)}
											· {entry.showCount} slideshow{entry.showCount === 1 ? '' : 's'}
										</span>
										<span class="history-titles">{entry.url}</span>
									</div>
								</a>
								<button
									type="button"
									class="icon-btn danger history-delete"
									title="Delete from library"
									aria-label="Delete from library"
									onclick={() => void deleteLibraryEntry(entry.id)}
								>
									<Trash2 size={13} />
								</button>
							</li>
						{/each}
					</ul>
				{/if}
			</div>
		{/if}

		{#if pasteOpen}
			<div class="paste-box">
				<textarea bind:value={pasteText} rows="3" placeholder="One idea title per line…"></textarea>
				<button type="button" class="btn-primary sm" onclick={() => void applyPasteLines()}>Apply lines</button>
			</div>
		{/if}

		<ul class="show-stack" class:show-stack-loading={stackLoading}>
			{#if stackLoading}
				{#each Array(Math.max(1, generating ? ideaCount : Math.max(shows.length, 2))) as _, gi (gi)}
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
									textHighlightsEnabled={brandKit.textHighlightsEnabled}
									onselect={(slideId) => selectSlide(show.id, slideId)}
								/>
							{/if}

							{#if show.slides.length}
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
											<BulkSlidePreview
												slide={{ ...sl, videoMuted: true }}
												width={BULK_FILMSTRIP_THUMB}
												preferThumb={true}
												mediaFetching={!!sl.mediaLoading}
												textHighlightsEnabled={brandKit.textHighlightsEnabled}
											/>
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
								<textarea
									class="slide-headline"
									rows="2"
									value={slide.headline}
									oninput={(e) =>
										updateSlide(show.id, slide.id, {
											headline: (e.currentTarget as HTMLTextAreaElement).value,
										})}
									placeholder="Slide headline / hook"
								></textarea>
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
								{#if slide.mediaKind === 'video'}
									<button
										type="button"
										class="menu-item"
										class:menu-item-active={slide.videoMuted === false}
										title={slide.videoMuted === false ? 'Mute preview' : 'Unmute preview'}
										onclick={() => {
											const enabling = slide.videoMuted !== false;
											shows = shows.map((s) => ({
												...s,
												slides: s.slides.map((sl) => {
													if (enabling) {
														// Only this slide in this slideshow may play audio.
														const isTarget = s.id === show.id && sl.id === slide.id;
														return { ...sl, videoMuted: !isTarget };
													}
													if (s.id === show.id && sl.id === slide.id) {
														return { ...sl, videoMuted: true };
													}
													return sl;
												}),
											}));
											selectSlide(show.id, slide.id);
										}}
									>
										{#if slide.videoMuted === false}
											<Volume2 size={14} />
											Sound
											<span class="menu-pill">on</span>
										{:else}
											<VolumeX size={14} />
											Sound
											<span class="menu-pill muted">off</span>
										{/if}
									</button>
								{/if}
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
								{#if String(slide.mediaThumb ?? '').trim() || slide.sourceR2Key}
									<button
										type="button"
										class="menu-item"
										disabled={slide.mediaLoading}
										title="Use the best frame from this clip as the slide image"
										onclick={() => void applyScenePhoto(show.id, slide.id)}
									>
										{#if slide.mediaLoading}
											<Loader2 size={14} class="spin" />
										{:else}
											<Image size={14} />
										{/if}
										Scene photo
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
						<div class="cap-style-section">
							<span class="cap-style-label">Style</span>
							<div class="cap-style-grid" role="listbox" aria-label="Caption style">
								{#each CAPTION_TEMPLATES as template (template.id)}
									<button
										type="button"
										class="cap-style-card"
										class:cap-style-card-on={popSlide.captions.templateId === template.id}
										role="option"
										aria-selected={popSlide.captions.templateId === template.id}
										title={template.name}
										onclick={() =>
											updateSlide(popShow.id, popSlide.id, {
												captions: {
													...popSlide.captions,
													templateId: template.id,
												},
											})}
									>
										<span class="cap-style-preview-frame">
											<span
												class="cap-style-preview"
												style="
													font-family: {template.fontFamily};
													font-weight: {template.fontWeight};
													color: {template.textColor};
													background: {template.backgroundColor === 'transparent'
														? 'transparent'
														: template.backgroundColor};
													text-transform: {template.textTransform};
													letter-spacing: 0;
													border-radius: {template.borderRadius};
													{template.textStroke
														? `-webkit-text-stroke: 0.6px ${template.strokeColor}; paint-order: stroke fill;`
														: ''}
													{template.textShadow && template.textShadow !== 'none'
														? 'text-shadow: 1px 1px 0 rgba(0,0,0,0.55);'
														: ''}
												"
											>
												{#if template.id === 'cyan-punch' && template.highlightColor}
													<span>A</span><span style="color: {template.highlightColor};">a</span>
												{:else}
													Aa
												{/if}
											</span>
										</span>
										<span class="cap-style-name">{template.name}</span>
									</button>
								{/each}
							</div>
						</div>
						<div class="cap-grid">
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
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 0.55rem;
		margin-bottom: 0.65rem;
	}
	.cap-style-section {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		margin-bottom: 0.75rem;
	}
	.cap-style-label {
		font-size: 0.6875rem;
		font-weight: 600;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: var(--app-text-3);
	}
	.cap-style-grid {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 0.55rem 0.5rem;
		max-height: 260px;
		overflow-x: hidden;
		overflow-y: auto;
		padding: 0.2rem 0.1rem 0.35rem;
	}
	.cap-style-card {
		display: flex;
		flex-direction: column;
		align-items: stretch;
		gap: 0.35rem;
		min-width: 0;
		margin: 0;
		padding: 0.4rem 0.35rem 0.45rem;
		border: 1.5px solid var(--bulk-border);
		border-radius: 8px;
		background: var(--app-surface);
		cursor: pointer;
		overflow: hidden;
		isolation: isolate;
		transition:
			border-color 0.15s ease,
			box-shadow 0.15s ease;
	}
	.cap-style-card:hover {
		border-color: color-mix(in oklab, var(--app-text) 28%, transparent);
	}
	.cap-style-card-on {
		border-color: var(--app-accent, #e8ff48);
		box-shadow: 0 0 0 1px var(--app-accent, #e8ff48);
	}
	.cap-style-preview-frame {
		display: flex;
		align-items: center;
		justify-content: center;
		height: 2.5rem;
		padding: 0.2rem;
		overflow: hidden;
		border-radius: 5px;
		background: color-mix(in oklab, var(--app-text) 6%, transparent);
	}
	.cap-style-preview {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		max-width: 100%;
		padding: 0.2rem 0.45rem;
		font-size: 0.8rem;
		line-height: 1;
		text-align: center;
		white-space: nowrap;
		overflow: hidden;
		border-radius: 3px;
		paint-order: stroke fill;
	}
	.cap-style-name {
		font-size: 0.6rem;
		font-weight: 600;
		color: var(--app-text-3);
		text-align: center;
		line-height: 1.25;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		padding: 0 0.1rem;
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
	.btn-ghost-on {
		border-color: color-mix(in oklab, var(--app-text) 28%, var(--bulk-border));
		background: color-mix(in oklab, var(--app-text) 6%, transparent);
		color: var(--app-text);
	}
	.history-badge {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 1.1rem;
		height: 1.1rem;
		padding: 0 0.28rem;
		margin-left: 0.15rem;
		border-radius: 999px;
		font-size: 0.625rem;
		font-weight: 700;
		background: color-mix(in oklab, var(--app-text) 12%, transparent);
		color: var(--app-text);
	}
	.history-panel {
		margin-bottom: 0.75rem;
		padding: 0.75rem 0.85rem;
		border-radius: 12px;
		border: 1px solid var(--bulk-border);
		background: var(--app-surface-2, #f7f7f8);
	}
	.history-panel-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		margin-bottom: 0.65rem;
	}
	.history-panel-title {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		font-size: 0.8125rem;
		font-weight: 650;
		color: var(--app-text);
	}
	.history-panel-actions {
		display: flex;
		align-items: center;
		gap: 0.35rem;
	}
	.history-note {
		margin: 0 0 0.55rem;
		font-size: 0.75rem;
		color: var(--app-text-2);
	}
	.history-empty {
		margin: 0;
		font-size: 0.78rem;
		line-height: 1.45;
		color: var(--app-text-3);
	}
	.history-list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.45rem;
		max-height: 280px;
		overflow-y: auto;
	}
	.history-item {
		display: flex;
		align-items: stretch;
		gap: 0.35rem;
	}
	.history-card {
		flex: 1 1 0;
		min-width: 0;
		display: flex;
		align-items: center;
		gap: 0.65rem;
		margin: 0;
		padding: 0.5rem 0.6rem;
		border: 1px solid var(--bulk-border);
		border-radius: 10px;
		background: #fff;
		text-align: left;
		text-decoration: none;
		color: inherit;
		cursor: pointer;
		transition:
			border-color 0.15s ease,
			box-shadow 0.15s ease;
	}
	.history-card:hover:not(:disabled) {
		border-color: color-mix(in oklab, var(--app-text) 22%, var(--bulk-border));
		box-shadow: 0 2px 10px color-mix(in oklab, var(--app-text) 6%, transparent);
	}
	.history-card-on {
		border-color: color-mix(in oklab, var(--app-text) 35%, var(--bulk-border));
		box-shadow: 0 0 0 1px color-mix(in oklab, var(--app-text) 18%, transparent);
	}
	.workspace-url-chip {
		margin-left: 0.45rem;
		font-size: 0.625rem;
		font-weight: 600;
		letter-spacing: 0.02em;
		color: var(--app-text-3);
		font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
	}
	.history-card:disabled {
		opacity: 0.6;
		cursor: wait;
	}
	.history-thumb-wrap {
		flex: 0 0 auto;
	}
	.history-thumb {
		display: block;
		width: 2.75rem;
		height: 3.45rem;
		object-fit: cover;
		border-radius: 6px;
		background: #ebebeb;
	}
	.history-thumb-empty {
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--app-text-3);
	}
	.history-meta {
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
		min-width: 0;
	}
	.history-topic {
		font-size: 0.8125rem;
		font-weight: 650;
		color: var(--app-text);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.history-sub {
		display: inline-flex;
		align-items: center;
		gap: 0.28rem;
		font-size: 0.6875rem;
		color: var(--app-text-3);
	}
	.history-titles {
		font-size: 0.6875rem;
		color: var(--app-text-2);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.history-delete {
		align-self: center;
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
		flex-wrap: nowrap;
		gap: 0.35rem;
		align-items: flex-start;
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
		width: 100%;
		min-width: 0;
		min-height: 2.75rem;
		line-height: 1.35;
		resize: vertical;
		overflow: auto;
		background: var(--app-surface);
		font-weight: 550;
		field-sizing: content;
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
