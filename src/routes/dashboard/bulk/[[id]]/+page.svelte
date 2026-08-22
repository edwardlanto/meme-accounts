<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { flip } from 'svelte/animate';
	import { fly } from 'svelte/transition';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { supabase } from '$lib/supabase';
	import {
		BRAND_KIT_UPDATED_EVENT,
		DEFAULT_BRAND_KIT,
		hydrateBrandKit,
		loadBrandKit,
		saveBrandKit,
		mergeCaptionDefaultsIntoKit,
		highlightDefaultsFromBrandKit,
		normalizeHighlightHex,
		normalizeHighlightStyleKind,
		type BrandKitSettings,
	} from '$lib/studio/brand-kit';
	import {
		type BulkShow,
		type BulkSlide,
		createBlankShow,
		createBlankSlide,
		activeSlideOf,
		rowNeedsBody,
		buildDraftStateFromShow,
		stashBulkImport,
		takeBulkClipHandoff,
		peekBulkClipHandoff,
		stripEmDashes,
		BULK_EMOTIONS,
		BULK_AUDIENCES,
		BULK_STYLES,
		audiencePromptText,
		type BulkEmotionId,
		type BulkStyleId,
		type BulkClipHandoff,
		type BulkClipHandoffItem,
		defaultRowCaptions,
	} from '$lib/studio/bulk-to-studio';
	import {
		DEFAULT_GENERATION_LANGUAGE,
		generationLanguageMeta,
		GENERATION_LANGUAGE_GROUPS,
		generationLanguagesInGroup,
		type GenerationLanguageId,
	} from '$lib/studio/generation-tone';
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
		rematerializeBulkShows,
		BULK_WORKSPACE_DELETED_EVENT,
		wasBulkWorkspaceDeletedLocally,
	} from '$lib/studio/bulk-workspace';
	import type { PageData } from './$types';
	import type { VideoClip, VideoImportMeta } from '$lib/video-clips/types';
	import {
		templateUsesStockMedia,
		templateUsesStockVideo,
		resolveStockPicksForSlides,
		resolveStockForTemplate,
		mapPool,
	} from '$lib/studio/bulk-stock';
	import { STUDIO_TEMPLATES, coerceTemplateId, isVideoSplitFamily, type TemplateId } from '$lib/studio/template-ids';
	import { fetchDraftLibraryRows } from '$lib/studio/draft-library';
	import { fetchDeckStoryBeats } from '$lib/studio/deck-story-beats';
	import {
		resolveNewsSourceChrome,
		resolveNewsSourceChromeMedia,
		newsSourceTextOffsets,
		type NewsSourceChrome,
	} from '$lib/studio/news-source-chrome';
	import {
		imageOverlaysBySlideFromSavedDraft,
		imageOverlaysFromNewsOverride,
		imageOverlaysForSlide,
		resolveImageOverlaysBySlideMedia,
	} from '$lib/studio/bulk-image-overlays';
	import type { Overlay } from '$lib/types';
	import type { TemplateDevOverride } from '$lib/studio/template-dev-override';
	import {
		DEFAULT_STUDIO_COMPOSE_PREFS,
		MAX_STUDIO_SLIDE_COUNT,
		STUDIO_SLIDE_COUNT_OPTIONS,
		type NewsCopyLength,
		type NewsStudioContentMode,
		type StockMediaKind,
	} from '$lib/studio/compose-prefs';
	import { CAPTION_TEMPLATES } from '$lib/video-clips/caption-templates';
	import { prepareImageAsDataUrl } from '$lib/client/image-upload-prep';
	import BulkSlidePreview from '$lib/components/bulk/BulkSlidePreview.svelte';
	import BulkSlideCarousel from '$lib/components/bulk/BulkSlideCarousel.svelte';
	import BulkPopover from '$lib/components/bulk/BulkPopover.svelte';
	import { r2SignRead } from '$lib/r2Client';
	import { formatTimestamp } from '$lib/video-clips/export-clip';
	import JSZip from 'jszip';
	import { toPng } from 'html-to-image';
	import { STUDIO_FEED_CANVAS } from '$lib/studio/clip-preview-canvas';
	import {
		formatExportError,
		materializeDomImagesForExport,
		replaceVideosWithFrameImages,
		SAFE_HTML_TO_IMAGE_OPTS,
	} from '$lib/studio/export-capture';
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
		ChevronUp,
		ChevronDown,
		Loader2,
		Layers,
		ArrowRight,
		ArrowUp,
		Captions,
		Image,
		X,
		Crop,
		Download,
		BarChart3,
		Info,
		Volume2,
		VolumeX,
		Highlighter,
		Users,
		Palette,
		Heart,
		History,
		Globe,
		Rows3,
		Wallpaper,
		Play,
		Ban,
		MessageSquare,
		Newspaper,
		Type,
		ListOrdered,
		LayoutTemplate,
	} from 'lucide-svelte';
	import { NEWS_DEFAULT_SUBTEXT, NEWS_PLACEHOLDER_HEADLINE } from '$lib/studio/slide-content-defaults';
	import {
		clampToCompleteWords,
		ensureCompleteThought,
		fitCopyBudget,
		splitIntoSentences,
	} from '$lib/studio/fit-copy';
	import { sanitizeOverlayLine } from '$lib/studio/overlay-copy';
	import {
		clearPromptHistory,
		loadPromptHistory,
		pushPromptHistory,
		recentTitlesForQuery,
		removePromptHistoryEntry,
		type StudioPromptHistoryEntry,
	} from '$lib/studio/prompt-history';
	import { Popover, PopoverContent, PopoverTrigger } from '$lib/components/ui/popover';
	import {
		AVAILABLE_PATTERNS,
		HIGHLIGHT_SOLID_PRESETS,
		HIGHLIGHT_GRADIENT_PRESETS,
		normalizeHighlightPatternName,
	} from '$lib/highlight';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Textarea } from '$lib/components/ui/textarea/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import * as NativeSelect from '$lib/components/ui/native-select/index.js';
	import { refreshUsageStatus } from '$lib/usage-client';
	import { PLAN_CATALOG } from '$lib/pricing-catalog';

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
	/** Studio account News override (logo move / size / plate) — same as Studio. */
	let newsTemplateOverride = $state<TemplateDevOverride | null>(null);
	let brandSavedNote = $state('');

	let topic = $state('');
	let newsContentMode = $state<NewsStudioContentMode>('general');
	let newsCopyLength = $state<NewsCopyLength>('default');
	let newsCategory = $state('general');
	let factTopicCategory = $state('any');
	let quoteTopicCategory = $state('any');
	let storyCategory = $state('health');
	let stepsCount = $state(5);
	let audienceId = $state<string>('');
	let audience = $state('');
	let style = $state<BulkStyleId>('bold');
	let emotion = $state<BulkEmotionId>('inspiring');
	let language = $state<GenerationLanguageId>(DEFAULT_GENERATION_LANGUAGE);
	/** Number of separate slideshows / ideas */
	let ideaCount = $state(1);
	/** Slides inside each slideshow — same default as Studio (3). */
	let slidesPerShow = $state(DEFAULT_STUDIO_COMPOSE_PREFS.slideCount);
	/** Per-slide template workflow — length always matches `slidesPerShow`. */
	type BulkWorkflowStep = {
		template: TemplateId;
		/** Saved Studio template draft id (from Save template). */
		savedId?: string;
		savedName?: string;
	};
	type SavedWorkflowTemplate = {
		id: string;
		name: string;
		templates: TemplateId[];
		/** News logo from the saved Studio draft (`r2:` or https). */
		logoSrc?: string;
		/** Per-slide News stickers from the saved Studio draft. */
		overlaysBySlide?: Overlay[][];
	};
	const STUDIO_SAVED_TEMPLATE_KIND = 'studio_saved_template';
	const BULK_WORKFLOW_STORAGE_KEY = 'bulk_slide_workflow_v1';
	let slideWorkflow = $state<BulkWorkflowStep[]>(
		Array.from({ length: DEFAULT_STUDIO_COMPOSE_PREFS.slideCount }, () => ({
			template: 'news' as TemplateId,
		})),
	);
	let savedWorkflowTemplates = $state<SavedWorkflowTemplate[]>([]);
	let savedWorkflowLoading = $state(false);
	/** Off | Stock photos | Stock videos — matches Studio media chip. */
	type BulkStockMode = 'off' | StockMediaKind;
	let stockMediaMode = $state<BulkStockMode>('photo');
	let stockFilling = $state(false);
	let stockNote = $state('');
	let generating = $state(false);
	let generateError = $state('');
	let promptHistory = $state<StudioPromptHistoryEntry[]>([]);
	let promptHistoryOpen = $state(false);

	const NEWS_CATEGORIES = [
		{ id: 'general', label: 'General' },
		{ id: 'business', label: 'Business' },
		{ id: 'tech', label: 'Tech' },
		{ id: 'finance', label: 'Finance' },
		{ id: 'politics', label: 'Politics' },
		{ id: 'health', label: 'Health' },
		{ id: 'science', label: 'Science' },
		{ id: 'sports', label: 'Sports' },
		{ id: 'entertainment', label: 'Entertainment' },
	] as const;

	const FACT_TOPICS = [
		{ id: 'any', label: 'Any' },
		{ id: 'business', label: 'Business' },
		{ id: 'tech', label: 'Technology' },
		{ id: 'science', label: 'Science' },
		{ id: 'health', label: 'Health' },
		{ id: 'history', label: 'History' },
		{ id: 'nature', label: 'Nature' },
		{ id: 'space', label: 'Space' },
		{ id: 'finance', label: 'Finance' },
		{ id: 'psychology', label: 'Psychology' },
		{ id: 'culture', label: 'Culture' },
		{ id: 'sports', label: 'Sports' },
		{ id: 'food', label: 'Food' },
		{ id: 'environment', label: 'Environment' },
		{ id: 'education', label: 'Education' },
	] as const;

	const STORY_THEMES = [
		{ id: 'health', label: 'Health' },
		{ id: 'wealth', label: 'Wealth' },
		{ id: 'relationships', label: 'Relationships' },
		{ id: 'career', label: 'Career' },
		{ id: 'mindset', label: 'Mindset' },
		{ id: 'productivity', label: 'Productivity' },
		{ id: 'fitness', label: 'Fitness' },
		{ id: 'money', label: 'Money' },
	] as const;

	const CONTENT_MODE_OPTS = [
		{ id: 'general' as const, icon: MessageSquare, label: 'General' },
		{ id: 'news' as const, icon: Newspaper, label: 'News' },
		{ id: 'fact' as const, icon: Sparkles, label: 'Random fact' },
		{ id: 'story' as const, icon: Type, label: 'Random story' },
		{ id: 'steps' as const, icon: ListOrdered, label: 'Steps' },
	];

	const topicPlaceholder = $derived(
		newsContentMode === 'news'
			? 'Search keyword…'
			: newsContentMode === 'fact'
				? 'Specific angle or context…'
				: newsContentMode === 'quote'
					? 'Topic for the quote (e.g. discipline)…'
					: newsContentMode === 'steps'
						? 'e.g. 5 steps to get a better gut…'
						: newsContentMode === 'story'
							? 'Story direction or angle…'
							: 'Message…',
	);

	let usageCanGenerate = $state<boolean | null>(null);
	let usageRemaining = $state<number | null>(null);
	let usageUsed = $state(0);
	let usageLimit = $state<number | null>(3);
	// Initialise from server data so the paywall renders on first paint — no flash.
	let usageIsPaid = $state<boolean | null>(data.isPaid ?? null);
	let usageUpgradeOpen = $state(false);
	let usageUpgradeMessage = $state('');

	const usageBlocked = $derived(usageCanGenerate === false);
	const maxIdeasAllowed = $derived(
		usageRemaining == null ? 8 : Math.max(0, Math.min(8, usageRemaining)),
	);
	const promptReady = $derived(topic.trim().length > 0);
	const promptSubmitDisabled = $derived(
		generating || (!usageBlocked && (!promptReady || ideaCount < 1 || maxIdeasAllowed < 1)),
	);
	const workflowTemplateSummary = $derived.by(() => {
		const labels = slideWorkflow.map((step) => workflowStepLabel(step));
		if (!labels.length) return 'Workflow';
		if (labels.length === 1) return `Workflow · ${labels[0]}`;
		const uniq = new Set(labels);
		if (uniq.size === 1) return `Workflow · ${labels[0]} ×${labels.length}`;
		return `Workflow · ${labels.join(' → ')}`;
	});

	function defaultWorkflowTemplate(): TemplateId {
		return coerceTemplateId(brandKit.defaultTemplateId) || 'news';
	}

	function workflowStepLabel(step: BulkWorkflowStep): string {
		const layout =
			STUDIO_TEMPLATES.find((t) => t.id === step.template)?.label ?? step.template;
		const saved = step.savedName?.trim();
		if (saved) {
			/* Saved Studio templates often sit on News — show both so Bulk doesn’t look “stuck” on News. */
			return saved.toLowerCase() === layout.toLowerCase() ? saved : `${saved} · ${layout}`;
		}
		return layout;
	}

	function workflowStepSelectValue(step: BulkWorkflowStep): string {
		return step.savedId ? `saved:${step.savedId}` : step.template;
	}

	function templatesFromSavedDraftState(state: Record<string, unknown> | null | undefined): TemplateId[] {
		const raw = Array.isArray(state?.slideTemplates) ? (state!.slideTemplates as unknown[]) : [];
		const templates = raw
			.map((t) => coerceTemplateId(String(t ?? '')))
			.filter(Boolean) as TemplateId[];
		if (templates.length) return templates;
		/* Older / partial saves — fall back to a single primary if present. */
		const primary = coerceTemplateId(String(state?.templateId ?? state?.activeTemplate ?? ''));
		return primary ? [primary] : [];
	}

	function logoFromSavedDraftState(state: Record<string, unknown> | null | undefined): string {
		if (!state || typeof state !== 'object') return '';
		const top = String(state.sourceLogoSrc ?? '').trim();
		if (top) return top;
		const layout = state.newsLayout as { sourceLogoSrc?: unknown } | undefined;
		const fromLayout = String(layout?.sourceLogoSrc ?? '').trim();
		if (fromLayout) return fromLayout;
		const doc = state.newsDocument as { layout?: { sourceLogoSrc?: unknown } } | undefined;
		const fromDoc = String(doc?.layout?.sourceLogoSrc ?? '').trim();
		if (fromDoc) return fromDoc;
		const starter = state.starter as { sourceLogoSrc?: unknown } | undefined;
		return String(starter?.sourceLogoSrc ?? '').trim();
	}

	function persistSlideWorkflow() {
		if (!userId || typeof localStorage === 'undefined') return;
		try {
			localStorage.setItem(
				`${BULK_WORKFLOW_STORAGE_KEY}:${userId}`,
				JSON.stringify({
					slidesPerShow,
					steps: slideWorkflow.map((s) => ({
						template: coerceTemplateId(s.template),
						...(s.savedId ? { savedId: s.savedId, savedName: s.savedName } : {}),
					})),
				}),
			);
		} catch {
			/* ignore quota */
		}
	}

	function restoreSlideWorkflow(): boolean {
		if (!userId || typeof localStorage === 'undefined') return false;
		try {
			const raw = localStorage.getItem(`${BULK_WORKFLOW_STORAGE_KEY}:${userId}`);
			if (!raw) return false;
			const parsed = JSON.parse(raw) as {
				slidesPerShow?: number;
				steps?: Array<{ template?: string; savedId?: string; savedName?: string }>;
			};
			const steps = Array.isArray(parsed.steps) ? parsed.steps : [];
			if (!steps.length) return false;
			const n = Math.max(
				1,
				Math.min(MAX_STUDIO_SLIDE_COUNT, Math.floor(Number(parsed.slidesPerShow)) || steps.length),
			);
			slideWorkflow = Array.from({ length: n }, (_, i) => {
				const cur = steps[i] ?? steps[steps.length - 1]!;
				return {
					template: coerceTemplateId(cur.template ?? 'news'),
					...(cur.savedId
						? { savedId: String(cur.savedId), savedName: String(cur.savedName ?? '').trim() || undefined }
						: {}),
				};
			});
			slidesPerShow = n;
			return true;
		} catch {
			return false;
		}
	}

	function syncSlideWorkflow(count = slidesPerShow) {
		const n = Math.max(1, Math.min(MAX_STUDIO_SLIDE_COUNT, Math.floor(Number(count)) || 1));
		const fallback: BulkWorkflowStep = { template: defaultWorkflowTemplate() };
		const prev = slideWorkflow;
		const next = Array.from({ length: n }, (_, i) => {
			const cur = prev[i] ?? prev[prev.length - 1] ?? fallback;
			return {
				template: coerceTemplateId(cur.template ?? fallback.template),
				...(cur.savedId ? { savedId: cur.savedId, savedName: cur.savedName } : {}),
			};
		});
		slideWorkflow = next;
		slidesPerShow = n;
		persistSlideWorkflow();
	}

	function setSlideWorkflowTemplate(index: number, template: TemplateId) {
		const next = [...slideWorkflow];
		next[index] = { template: coerceTemplateId(template) };
		slideWorkflow = next;
		persistSlideWorkflow();
	}

	function setSlideWorkflowFromSelect(index: number, raw: string) {
		const v = String(raw ?? '');
		if (v.startsWith('saved:')) {
			const id = v.slice(6);
			const saved = savedWorkflowTemplates.find((s) => s.id === id);
			if (!saved) return;
			/* Picking a saved Studio template replaces the whole flow (not just slide 1’s layout id). */
			applySavedTemplateAsFlow(saved);
			return;
		}
		setSlideWorkflowTemplate(index, v as TemplateId);
	}

	function addWorkflowStep(template?: TemplateId) {
		if (slideWorkflow.length >= 8) return;
		const fallback = defaultWorkflowTemplate();
		const tpl = coerceTemplateId(
			template ?? slideWorkflow[slideWorkflow.length - 1]?.template ?? fallback,
		);
		slideWorkflow = [...slideWorkflow, { template: tpl }];
		slidesPerShow = slideWorkflow.length;
		persistSlideWorkflow();
	}

	function addSavedWorkflowStep(saved: SavedWorkflowTemplate) {
		if (slideWorkflow.length >= 8) return;
		const tpl = coerceTemplateId(
			saved.templates[Math.min(slideWorkflow.length, saved.templates.length - 1)] ??
				saved.templates[0] ??
				'news',
		);
		slideWorkflow = [
			...slideWorkflow,
			{
				template: tpl,
				savedId: saved.id,
				savedName: saved.name,
			},
		];
		slidesPerShow = slideWorkflow.length;
		persistSlideWorkflow();
	}

	/** Replace the whole flow with every slide layout from a saved Studio template. */
	function applySavedTemplateAsFlow(saved: SavedWorkflowTemplate) {
		const templates = (saved.templates.length ? saved.templates : ['news' as TemplateId]).slice(0, 8);
		slideWorkflow = templates.map((template) => ({
			template: coerceTemplateId(template),
			savedId: saved.id,
			savedName: saved.name,
		}));
		slidesPerShow = slideWorkflow.length;
		persistSlideWorkflow();
		/* Pull the saved template’s News logo into the brand kit so Bulk keeps it. */
		const logo = String(saved.logoSrc ?? '').trim();
		if (logo && userId && !String(brandKit.logoUrl ?? '').trim()) {
			brandKit = { ...brandKit, logoUrl: logo, sourceLabelMode: 'logo' };
			saveBrandKit(userId, brandKit);
		}
	}

	function removeWorkflowStep(index: number) {
		if (slideWorkflow.length <= 1) return;
		slideWorkflow = slideWorkflow.filter((_, i) => i !== index);
		slidesPerShow = Math.max(1, slideWorkflow.length);
		persistSlideWorkflow();
	}

	function workflowTemplatesForShow(): TemplateId[] {
		const n = Math.max(1, slidesPerShow);
		const fallback = defaultWorkflowTemplate();
		return Array.from({ length: n }, (_, i) =>
			coerceTemplateId(slideWorkflow[i]?.template ?? fallback),
		);
	}

	/** Prefer live `slideTemplates` from the saved Studio draft so Bulk can’t drift to News. */
	async function resolveWorkflowTemplatesForGenerate(): Promise<TemplateId[]> {
		const n = Math.max(1, slidesPerShow);
		const fallback = defaultWorkflowTemplate();
		const savedIds = [
			...new Set(
				slideWorkflow.map((s) => String(s.savedId ?? '').trim()).filter(Boolean),
			),
		];
		if (savedIds.length === 1 && userId) {
			const savedId = savedIds[0]!;
			try {
				const { data } = await (supabase as any)
					.from('drafts')
					.select('state')
					.eq('id', savedId)
					.eq('user_id', userId)
					.eq('kind', STUDIO_SAVED_TEMPLATE_KIND)
					.maybeSingle();
				const templates = templatesFromSavedDraftState(
					(data?.state ?? null) as Record<string, unknown> | null,
				);
				if (templates.length) {
					const name =
						String((data?.state as Record<string, unknown> | undefined)?._templateName ?? '')
							.trim() ||
						slideWorkflow.find((s) => s.savedId === savedId)?.savedName ||
						'Saved template';
					slideWorkflow = Array.from({ length: n }, (_, i) => ({
						template: coerceTemplateId(
							templates[i] ?? templates[templates.length - 1] ?? fallback,
						),
						savedId,
						savedName: name,
					}));
					persistSlideWorkflow();
					return workflowTemplatesForShow();
				}
			} catch {
				/* fall through to in-memory workflow */
			}
		}
		return workflowTemplatesForShow();
	}

	async function refreshSavedWorkflowTemplates() {
		if (!userId) {
			savedWorkflowTemplates = [];
			return;
		}
		savedWorkflowLoading = true;
		try {
			const data = await fetchDraftLibraryRows(supabase, {
				userId,
				kind: STUDIO_SAVED_TEMPLATE_KIND,
				limit: 40,
			});
			savedWorkflowTemplates = data
				.map((row) => {
					const state = (row.state ?? null) as Record<string, unknown> | null;
					const templates = templatesFromSavedDraftState(state);
					const logoSrc = logoFromSavedDraftState(state);
					const overlaysBySlide = imageOverlaysBySlideFromSavedDraft(state);
					return {
						id: String(row.id ?? ''),
						name: String(row.state?._templateName ?? '').trim() || 'Untitled template',
						templates: templates.length ? templates : (['news'] as TemplateId[]),
						...(logoSrc ? { logoSrc } : {}),
						...(overlaysBySlide.some((r) => r.length)
							? { overlaysBySlide }
							: {}),
					};
				})
				.filter((row) => row.id);
		} catch {
			savedWorkflowTemplates = [];
		} finally {
			savedWorkflowLoading = false;
		}
	}

	$effect(() => {
		if (maxIdeasAllowed >= 1 && ideaCount > maxIdeasAllowed) {
			ideaCount = maxIdeasAllowed;
		}
	});

	const autoStock = $derived(stockMediaMode !== 'off');
	const stockChipLabel = $derived(
		stockMediaMode === 'video'
			? 'Stock videos'
			: stockMediaMode === 'photo'
				? 'Stock photos'
				: 'No stock',
	);

	const audienceChipLabel = $derived(
		audienceId === 'custom'
			? audience.trim() || 'Custom…'
			: (BULK_AUDIENCES.find((a) => a.id === audienceId)?.label ?? 'Audience'),
	);
	const languageChipLabel = $derived(generationLanguageMeta(language).native);
	const styleChipLabel = $derived(BULK_STYLES.find((s) => s.id === style)?.label ?? 'Style');
	const emotionChipLabel = $derived(BULK_EMOTIONS.find((e) => e.id === emotion)?.label ?? 'Emotion');
	const copyLengthChipLabel = $derived(
		newsCopyLength === 'short' ? 'Short' : newsCopyLength === 'standard' ? 'Standard' : 'Default',
	);

	function countPlainWords(text: string): number {
		return String(text ?? '')
			.replace(/\[\[|\]\]/g, '')
			.trim()
			.split(/\s+/)
			.filter(Boolean).length;
	}

	/** Headline / hook budget — matches Studio. */
	const bulkHeadlineMaxWords = $derived.by(() => {
		if (newsCopyLength === 'short') return 10;
		if (newsCopyLength === 'standard') return 16;
		const n = countPlainWords(NEWS_PLACEHOLDER_HEADLINE);
		return Math.max(6, Math.min(24, n || 12));
	});

	/** Body / support budget — matches Studio News default. */
	const bulkBodyMaxWords = $derived.by(() => {
		if (newsCopyLength === 'short') return 18;
		if (newsCopyLength === 'standard') return 28;
		const n = countPlainWords(NEWS_DEFAULT_SUBTEXT);
		return Math.max(6, Math.min(80, n || 24));
	});

	const bulkDefaultWordBudgetLabel = $derived(
		`Match placeholder — ${bulkBodyMaxWords} words`,
	);

	/** SoftBank-length News body — first 1–2 sentences only (API context is a longer bible). */
	function clampBulkNewsBody(text: string): string {
		const plain = stripEmDashes(String(text ?? '').replace(/\[\[|\]\]/g, ''))
			.replace(/\u2026/g, '')
			.replace(/\s+/g, ' ')
			.trim();
		if (!plain) return '';
		const maxWords = bulkBodyMaxWords;
		const maxSentences = newsCopyLength === 'short' ? 1 : 2;
		const maxChars = Math.max(140, Math.min(320, maxWords * 7));
		const sentences = splitIntoSentences(plain).filter((s) => s.trim());
		const candidate = (sentences.slice(0, maxSentences).join(' ').trim() || plain).trim();
		return fitCopyBudget(candidate, { maxWords, maxChars });
	}

	/** Headline / hook — same word chip as Studio News. */
	function clampBulkHeadline(text: string, keepMarkup: boolean): string {
		const raw = sanitizeOverlayLine(stripEmDashes(String(text ?? '').trim()));
		if (!raw) return '';
		const maxWords = bulkHeadlineMaxWords;
		const plain = raw.replace(/\[\[|\]\]/g, '').replace(/\s+/g, ' ').trim();
		if (keepMarkup && raw.includes('[[') && countPlainWords(plain) <= maxWords) {
			return raw;
		}
		return ensureCompleteThought(clampToCompleteWords(plain, maxWords));
	}

	async function refreshBulkUsage() {
		try {
			const s = await refreshUsageStatus();
			if (!s.signedIn) {
				usageCanGenerate = false;
				usageIsPaid = false;
				return;
			}
			usageIsPaid = s.isPaid === true;
			usageCanGenerate = s.canGenerate !== false;
			usageRemaining = s.remaining ?? null;
			usageUsed = typeof s.used === 'number' ? s.used : usageUsed;
			usageLimit = s.limit === undefined ? usageLimit : s.limit;
			if (usageRemaining != null && ideaCount > usageRemaining) {
				ideaCount = Math.max(1, usageRemaining);
			}
		} catch {
			/* keep last known */
		}
	}

	function openUsageUpgrade(message?: string) {
		usageUpgradeMessage =
			message ||
			(usageLimit != null
				? `You've used ${usageUsed}/${usageLimit} carousel${usageLimit === 1 ? '' : 's'} this month. Upgrade for more.`
				: 'Carousel limit reached. Upgrade for more.');
		usageUpgradeOpen = true;
		usageCanGenerate = false;
	}

	function refreshPromptHistory() {
		if (!userId) {
			promptHistory = [];
			return;
		}
		promptHistory = loadPromptHistory(userId);
	}

	function applyPromptHistoryEntry(entry: StudioPromptHistoryEntry) {
		newsContentMode = entry.mode === 'quote' ? 'general' : entry.mode;
		topic = entry.query;
		promptHistoryOpen = false;
	}

	function parseStepsCountFromPrompt(prompt: string, fallback: number): number {
		const m = String(prompt ?? '').match(/\b([3-8])\s*(?:steps?|ways?|tips?|things?)\b/i);
		if (m) return Math.max(3, Math.min(8, Number(m[1])));
		return Math.max(3, Math.min(8, Math.floor(fallback) || 5));
	}

	function bulkTonePayload() {
		return {
			audience: audiencePromptText(audienceId, audience) || undefined,
			emotion: emotion || undefined,
			style,
			language,
		};
	}

	function bulkSyntheticHint(mode: NewsStudioContentMode, query: string): string {
		const q = query.trim();
		if (mode === 'fact') {
			const label =
				factTopicCategory !== 'any'
					? (FACT_TOPICS.find((t) => t.id === factTopicCategory)?.label ?? '')
					: '';
			return [label, q].filter(Boolean).join(': ').slice(0, 600);
		}
		if (mode === 'quote') {
			const label =
				quoteTopicCategory !== 'any'
					? (FACT_TOPICS.find((t) => t.id === quoteTopicCategory)?.label ?? '')
					: '';
			return [label, q].filter(Boolean).join(': ').slice(0, 600);
		}
		return q.slice(0, 600);
	}

	function applyUsageFromPayload(data: { usage?: unknown }) {
		if (data.usage && typeof data.usage === 'object') {
			const u = data.usage as {
				canGenerate?: boolean;
				remaining?: number | null;
				used?: number;
				limit?: number | null;
			};
			if (typeof u.canGenerate === 'boolean') usageCanGenerate = u.canGenerate;
			if (u.remaining !== undefined) usageRemaining = u.remaining;
			if (typeof u.used === 'number') usageUsed = u.used;
			if (u.limit !== undefined) usageLimit = u.limit;
			return true;
		}
		return false;
	}

	function submitBulkPrompt() {
		if (usageBlocked) {
			openUsageUpgrade();
			return;
		}
		if (promptSubmitDisabled) return;
		if (maxIdeasAllowed < 1) {
			openUsageUpgrade();
			return;
		}
		if (ideaCount > maxIdeasAllowed) ideaCount = maxIdeasAllowed;
		void generateIdeas();
	}
	/** Empty until hydrate so we never flash a blank starter show. */
	let shows = $state<BulkShow[]>([]);
	let selectedShowId = $state<string | null>(null);
	let libraryOpen = $state(false);
	let libraryEntries = $state<CloudWorkspaceListItem[]>([]);
	let libraryBusy = $state(false);
	let libraryNote = $state('');
	/** Cloud row currently open at /dashboard/bulk/[id] */
	let cloudWorkspaceId = $state<string | null>(null);
	let clipHandoff = $state<BulkClipHandoff | null>(null);
	let slidePopover = $state<{ showId: string; slideId: string; kind: SlidePopoverKind } | null>(null);
	let autoReframe = $state<AutoReframeOptions>({ ...DEFAULT_AUTO_REFRAME, enabled: true });
	let pyautoflipReady = $state(false);
	let ffmpegReady = $state(false);
	let exportBusySlideId = $state<string | null>(null);
	let exportBusyShowId = $state<string | null>(null);
	let exportCaptureSlide = $state<BulkSlide | null>(null);
	let exportCaptureIndex = $state(0);
	let exportHostEl = $state<HTMLDivElement | null>(null);
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
	/** Empty compose: bar centered. Generating / has ideas: dock to bottom. */
	const promptCompose = $derived(!generating && !showsHaveContent(shows));
	/** Skip the dock/compose transition on first paint (resume shouldn't fly from center). */
	let promptChromeMotion = $state(false);

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
		return source.map((show) => {
			const seen = new Set<string>();
			const slides = (show.slides ?? []).filter((sl) => {
				const id = String(sl.id ?? '').trim();
				if (!id) return true;
				if (seen.has(id)) return false;
				seen.add(id);
				return true;
			});
			return {
				...show,
				slides: slides.map((sl) => {
					const { mediaLoading: _m, reframeBusy: _r, ...rest } = sl;
					const mediaUrl = String(rest.mediaUrl ?? '');
					const mediaThumb = String(rest.mediaThumb ?? '');
					const dropUrl = mediaUrl.startsWith('data:') || mediaUrl.startsWith('blob:');
					const dropThumb = mediaThumb.startsWith('data:') || mediaThumb.startsWith('blob:');
					return {
						...rest,
						mediaUrl: dropUrl ? (dropThumb ? undefined : mediaThumb || undefined) : rest.mediaUrl,
						mediaThumb: dropThumb ? undefined : rest.mediaThumb,
					};
				}),
			};
		});
	}

	function dedupeShowSlides(source: BulkShow[]): BulkShow[] {
		return source.map((show) => {
			const seen = new Set<string>();
			const slides = (show.slides ?? []).filter((sl) => {
				const id = String(sl.id ?? '').trim();
				if (!id) return true;
				if (seen.has(id)) return false;
				seen.add(id);
				return true;
			});
			const active =
				slides.some((s) => s.id === show.activeSlideId) ? show.activeSlideId : slides[0]?.id ?? '';
			return { ...show, slides, activeSlideId: active };
		});
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

	async function resignShowsMedia(source: BulkShow[]): Promise<BulkShow[]> {
		if (!source.length) return source;
		try {
			return await rematerializeBulkShows(source, async (key) => {
				const { url } = await r2SignRead({ key });
				return url;
			});
		} catch (e) {
			console.warn('[bulk] rematerialize media failed', e);
			return source;
		}
	}

	async function finishWorkspaceHydrate(opts?: { skeletonCount?: number; resumeUrl?: boolean }) {
		workspaceHydrated = true;
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
				/* Next frame: allow compose↔dock transitions (not the initial layout). */
				requestAnimationFrame(() => {
					promptChromeMotion = true;
				});
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
		const updateId = String(opts?.updateId ?? '').trim() || undefined;
		if (updateId && userId && wasBulkWorkspaceDeletedLocally(userId, updateId)) {
			/* User deleted this row in Carousels — don't PATCH/resurrect it; insert fresh if needed. */
		} else if (updateId) {
			const res = await fetch(`/api/bulk/workspaces/${updateId}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(payload),
			});
			if (res.ok) return updateId;
			/* Deleted from Carousels (or stale id) — fall through to a fresh insert. */
			if (res.status !== 404) {
				const err = await res.json().catch(() => ({}));
				throw new Error((err as { error?: string }).error || 'Could not save slideshow');
			}
		}
		const res = await fetch('/api/bulk/workspaces', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(payload),
		});
		if (!res.ok) {
			const err = await res.json().catch(() => ({}));
			throw new Error((err as { error?: string }).error || 'Could not save slideshow');
		}
		const json = (await res.json()) as { id?: string };
		return json.id ?? null;
	}

	/** Keep prior stack in local history — do not spam Carousels with a new cloud row. */
	async function archiveCurrentToLocalHistory() {
		if (!userId || !showsHaveContent(shows)) return null;
		return archiveBulkShowsToHistory(userId, {
			shows,
			selectedShowId,
			topic,
		});
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
			if (showsHaveContent(shows) && userId) {
				await archiveBulkShowsToHistory(userId, {
					shows,
					selectedShowId,
					topic,
				}).catch(() => {});
				/* Update existing library row only — never recreate a row the user deleted. */
				if (
					cloudWorkspaceId &&
					!wasBulkWorkspaceDeletedLocally(userId, cloudWorkspaceId)
				) {
					await saveShowsToCloud(shows, { updateId: cloudWorkspaceId }).catch(() => {});
				}
			}
			if (userId) clearBulkWorkspace(userId);
			const caps = captionDefaultsFromKit(brandKit);
			const blank = createBlankShow(workflowTemplatesForShow(), caps, slidesPerShow);
			workspaceAutosaveReady = false;
			workspaceRevealReady = false;
			shows = [blank];
			selectedShowId = blank.id;
			topic = '';
			cloudWorkspaceId = null;
			clipProjectId = null;
			libraryOpen = false;
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
				const blank = createBlankShow(workflowTemplatesForShow(), caps, slidesPerShow);
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

	// Separate, synchronous onMount: only a sync callback's return value is
	// treated by Svelte as a cleanup/destroy function. The hydration work below
	// is async, so it cannot also own this listener's teardown.
	onMount(() => {
		const onBrandKit = (e: Event) => {
			const kit = (e as CustomEvent<BrandKitSettings>).detail;
			if (kit) brandKit = kit;
		};
		const onWorkspaceDeleted = (e: Event) => {
			const ids = (e as CustomEvent<{ ids?: string[] }>).detail?.ids ?? [];
			const hit = ids.some((id) => id && id === cloudWorkspaceId);
			if (!hit) return;
			cloudWorkspaceId = null;
			if (userId) clearBulkWorkspace(userId);
			const caps = captionDefaultsFromKit(brandKit);
			const blank = createBlankShow(workflowTemplatesForShow(), caps, slidesPerShow);
			shows = [blank];
			selectedShowId = blank.id;
			topic = '';
			clipProjectId = null;
			void goto('/dashboard/bulk', { replaceState: true, noScroll: true });
		};
		window.addEventListener(BRAND_KIT_UPDATED_EVENT, onBrandKit);
		window.addEventListener(BULK_WORKSPACE_DELETED_EVENT, onWorkspaceDeleted);
		return () => {
			window.removeEventListener(BRAND_KIT_UPDATED_EVENT, onBrandKit);
			window.removeEventListener(BULK_WORKSPACE_DELETED_EVENT, onWorkspaceDeleted);
		};
	});

	onMount(async () => {
		if (typeof history !== 'undefined' && 'scrollRestoration' in history) {
			history.scrollRestoration = 'manual';
		}
		try {
			window.scrollTo(0, 0);
		} catch {
			/* ignore */
		}

		try {
			const {
				data: { user },
			} = await supabase.auth.getUser();
			if (!user) {
				goto('/login');
				return;
			}
			userId = user.id;
			void refreshBulkUsage();
			brandKit = await hydrateBrandKit(user.id);
			try {
				const { data: ovRows } = await (supabase as any)
					.from('drafts')
					.select('state')
					.eq('user_id', user.id)
					.eq('kind', 'studio_template_override')
					.limit(40);
				const newsOv = (Array.isArray(ovRows) ? ovRows : [])
					.map((row: { state?: TemplateDevOverride }) => row?.state)
					.find(
						(s: TemplateDevOverride | undefined) =>
							s &&
							s.v === 1 &&
							s.enabled !== false &&
							coerceTemplateId(String(s.templateId ?? '')) === 'news',
					) as TemplateDevOverride | undefined;
				newsTemplateOverride = newsOv ?? null;
			} catch {
				newsTemplateOverride = null;
			}
			const caps = captionDefaultsFromKit(brandKit);
			const defaultTpl = coerceTemplateId(brandKit.defaultTemplateId);
			const restoredWorkflow = restoreSlideWorkflow();
			if (!restoredWorkflow) {
				syncSlideWorkflow(slidesPerShow);
				if (
					slideWorkflow.every((s) => s.template === 'news' && !s.savedId) &&
					defaultTpl !== 'news'
				) {
					slideWorkflow = Array.from({ length: slidesPerShow }, () => ({ template: defaultTpl }));
					persistSlideWorkflow();
				}
			}
			void refreshSavedWorkflowTemplates();

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
				shows = dedupeShowSlides(
					await resignShowsMedia(
						cloud.shows.map((s) => ({
							...s,
							slides: (s.slides ?? []).map((sl) => ({ ...sl })),
						})),
					),
				);
				const showParam = $page.url.searchParams.get('show');
				selectedShowId =
					showParam && shows.some((s) => s.id === showParam)
						? showParam
						: cloud.selectedShowId && shows.some((s) => s.id === cloud.selectedShowId)
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
				const localCloudId = String(saved.cloudWorkspaceId ?? '').trim();
				if (localCloudId && wasBulkWorkspaceDeletedLocally(user.id, localCloudId)) {
					clearBulkWorkspace(user.id);
				} else {
					shows = dedupeShowSlides(await resignShowsMedia(saved.shows));
					selectedShowId =
						saved.selectedShowId && shows.some((s) => s.id === saved.selectedShowId)
							? saved.selectedShowId
							: shows[0]?.id ?? null;
					if (saved.topic?.trim()) topic = saved.topic;
					if (saved.clipProjectId) clipProjectId = saved.clipProjectId;
					if (localCloudId) cloudWorkspaceId = localCloudId;
					touchBulkWorkspaceSession(user.id);
					await finishWorkspaceHydrate({ skeletonCount: saved.shows.length, resumeUrl: true });
					return;
				}
			}

			if (saved?.shows?.length) {
				// Don't block first paint — archiving large media can take a long time.
				void archiveBulkShowsToHistory(user.id, {
					shows: saved.shows,
					selectedShowId: saved.selectedShowId,
					topic: saved.topic,
				}).catch(() => {});
				clearBulkWorkspace(user.id);
			}

			const show = createBlankShow(workflowTemplatesForShow(), caps, slidesPerShow);
			shows = [show];
			selectedShowId = show.id;
			await finishWorkspaceHydrate({ skeletonCount: 1 });
		} catch (e) {
			console.warn('[bulk] hydrate failed', e);
			if (!workspaceHydrated) {
				try {
					const caps = captionDefaultsFromKit(brandKit);
					const blank = createBlankShow(
						workflowTemplatesForShow(),
						caps,
						slidesPerShow,
					);
					if (!shows.length) {
						shows = [blank];
						selectedShowId = blank.id;
					}
				} catch {
					/* ignore */
				}
				await finishWorkspaceHydrate({ skeletonCount: Math.max(1, shows.length) });
			}
		}

	});

	function scheduleBulkWorkspaceSave() {
		if (!userId || !workspaceHydrated) return;
		if (workspaceSaveTimer) clearTimeout(workspaceSaveTimer);
		workspaceSaveTimer = setTimeout(() => {
			void persistBulkWorkspace();
		}, 5000);
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
				cloudWorkspaceId,
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
				if (wasBulkWorkspaceDeletedLocally(userId, cloudWorkspaceId)) {
					cloudWorkspaceId = null;
				} else {
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
				shows = await resignShowsMedia(project.bulkShows);
				selectedShowId = shows[0]?.id ?? null;
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
			const prevSelected = selectedShowId;
			const prevTopic = topic;
			void archiveBulkShowsToHistory(userId, {
				shows: prevShows,
				selectedShowId: prevSelected,
				topic: prevTopic,
			}).catch(() => {});
		}
		const replaceCloudId = cloudWorkspaceId;
		shows = incoming;
		selectedShowId = incoming[0]?.id ?? null;
		clipHandoff = null;
		if (clipProjectId) scheduleClipProjectSave();
		workspaceHydrated = true;
		void persistBulkWorkspace();
		// Same as topic generate: land clip carousels in Library / Carousels immediately.
		if (userId && showsHaveContent(incoming)) {
			void saveShowsToCloud(incoming, { updateId: replaceCloudId })
				.then(async (id) => {
					if (!id) return;
					cloudWorkspaceId = id;
					void refreshLibrary();
					if ($page.params.id !== id) {
						await goto(`/dashboard/bulk/${id}`, { replaceState: true, noScroll: true });
					}
				})
				.catch(() => {
					cloudWorkspaceId = null;
				});
		} else {
			cloudWorkspaceId = null;
		}
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

	function slugForExport(raw: string): string {
		return (
			String(raw ?? '')
				.replace(/\[\[|\]\]/g, '')
				.replace(/[^\w.-]+/g, '_')
				.replace(/^_+|_+$/g, '')
				.slice(0, 60) || 'slideshow'
		);
	}

	async function waitForExportPaint() {
		await tick();
		await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
		try {
			await document.fonts?.ready;
		} catch {
			/* ignore */
		}
		const host = exportHostEl;
		if (!host) return;
		await Promise.all(
			Array.from(host.querySelectorAll('img')).map(
				(img) =>
					new Promise<void>((resolve) => {
						if (img.complete && img.naturalWidth > 0) {
							resolve();
							return;
						}
						img.addEventListener('load', () => resolve(), { once: true });
						img.addEventListener('error', () => resolve(), { once: true });
						setTimeout(() => resolve(), 4000);
					}),
			),
		);
	}

	async function toBulkExportSafeImageUrl(url: string): Promise<string> {
		const src = String(url ?? '').trim();
		if (!src) return '';
		if (src.startsWith('data:')) return src;
		if (src.startsWith('blob:') || src.startsWith('http://') || src.startsWith('https://') || src.startsWith('/')) {
			try {
				const res = await fetch(src, { signal: AbortSignal.timeout(20_000) });
				if (!res.ok) return src;
				const blob = await res.blob();
				return await new Promise<string>((resolve, reject) => {
					const reader = new FileReader();
					reader.onload = () => resolve(String(reader.result ?? ''));
					reader.onerror = () => reject(reader.error ?? new Error('read failed'));
					reader.readAsDataURL(blob);
				});
			} catch {
				return src;
			}
		}
		return src;
	}

	async function rasterizeBulkExportNode(node: HTMLElement): Promise<string> {
		const w = Math.max(1, Math.round(node.offsetWidth) || STUDIO_FEED_CANVAS.w);
		const h = Math.max(1, Math.round(node.offsetHeight) || STUDIO_FEED_CANVAS.h);
		await Promise.all(
			Array.from(node.querySelectorAll('video')).map(
				(video) =>
					new Promise<void>((resolve) => {
						if (video.readyState >= 2 && video.videoWidth > 0) {
							resolve();
							return;
						}
						const done = () => resolve();
						video.addEventListener('loadeddata', done, { once: true });
						video.addEventListener('canplay', done, { once: true });
						video.addEventListener('error', done, { once: true });
						try {
							void video.play?.().then(() => video.pause?.()).catch(() => {});
						} catch {
							/* ignore */
						}
						setTimeout(done, 4000);
					}),
			),
		);
		const restoreVideos = await replaceVideosWithFrameImages(node);
		const restoreImgs = await materializeDomImagesForExport(node, toBulkExportSafeImageUrl);
		try {
			return await toPng(node, {
				width: w,
				height: h,
				pixelRatio: 1,
				backgroundColor: '#0a0a0a',
				style: { transform: 'scale(1)', transformOrigin: 'top left' },
				filter: (n: HTMLElement) => n.tagName !== 'VIDEO',
				...SAFE_HTML_TO_IMAGE_OPTS,
			} as Parameters<typeof toPng>[1]);
		} finally {
			restoreImgs();
			restoreVideos();
		}
	}

	async function exportShowAsZip(show: BulkShow) {
		const slides = show.slides.length ? show.slides : [];
		if (!slides.length) {
			alert('This slideshow has no slides to export.');
			return;
		}
		if (exportBusyShowId) return;
		exportBusyShowId = show.id;
		try {
			const zip = new JSZip();
			const folder = zip.folder(slugForExport(show.title)) ?? zip;
			for (let i = 0; i < slides.length; i++) {
				const slide = slides[i]!;
				exportCaptureIndex = i;
				exportCaptureSlide = { ...slide, videoMuted: true };
				await waitForExportPaint();
				const host = exportHostEl;
				const node =
					host?.querySelector<HTMLElement>('[data-studio-canvas-root]') ??
					host?.querySelector<HTMLElement>('.bulk-preview > div') ??
					null;
				if (!node) throw new Error('Preview not ready for export');
				const dataUrl = await rasterizeBulkExportNode(node);
				const base64 = dataUrl.split(',')[1] ?? '';
				if (!base64) throw new Error(`Could not capture slide ${i + 1}`);
				folder.file(`slide-${i + 1}.png`, base64, { base64: true });
			}
			const blob = await zip.generateAsync({ type: 'blob' });
			const url = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = `${slugForExport(show.title)}.zip`;
			document.body.appendChild(a);
			a.click();
			a.remove();
			setTimeout(() => URL.revokeObjectURL(url), 30_000);
		} catch (e) {
			console.warn('[bulk] slideshow export failed', e);
			alert(formatExportError(e));
		} finally {
			exportCaptureSlide = null;
			exportBusyShowId = null;
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
			savedTemplateId: undefined,
			savedTemplateName: undefined,
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

	function setSlideTemplateFromSelect(showId: string, slideId: string, raw: string) {
		const v = String(raw ?? '');
		if (v.startsWith('saved:')) {
			const id = v.slice(6);
			const saved = savedWorkflowTemplates.find((s) => s.id === id);
			const tpl = coerceTemplateId(
				saved?.templates[0] ??
					shows.find((s) => s.id === showId)?.slides.find((sl) => sl.id === slideId)?.template ??
					'news',
			);
			updateSlide(showId, slideId, {
				template: tpl,
				savedTemplateId: id,
				savedTemplateName: saved?.name || 'Saved template',
			});
			if (autoStock && templateUsesStockMedia(tpl)) {
				void fillStockForSlide(showId, slideId);
			}
			return;
		}
		setSlideTemplate(showId, slideId, v as TemplateId);
	}

	function slideTemplateSelectValue(slide: BulkSlide): string {
		if (slide.savedTemplateId) return `saved:${slide.savedTemplateId}`;
		/* Infer from the current Bulk workflow so “new news” stays selected after generate. */
		const fromFlow = slideWorkflow.find(
			(s) => s.savedId && coerceTemplateId(s.template) === coerceTemplateId(slide.template),
		);
		if (fromFlow?.savedId) return `saved:${fromFlow.savedId}`;
		return slide.template;
	}

	function addShow() {
		const show = createBlankShow(
			workflowTemplatesForShow(),
			captionDefaultsFromKit(brandKit),
			slidesPerShow,
		);
		shows = [...shows, show];
		selectedShowId = show.id;
		if (autoStock) {
			void fillStockForShows([show.id], { force: true });
		}
	}

	function deleteShow(id: string) {
		if (shows.length <= 1) {
			const show = createBlankShow(
				workflowTemplatesForShow(),
				captionDefaultsFromKit(brandKit),
				slidesPerShow,
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
		const show = shows.find((s) => s.id === showId);
		const idx = show?.slides.length ?? 0;
		const tpl =
			workflowTemplatesForShow()[idx] ??
			slideWorkflow[slideWorkflow.length - 1]?.template ??
			defaultWorkflowTemplate();
		const slide = createBlankSlide(coerceTemplateId(tpl), caps);
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

	async function fillStockForShows(showIds?: string[], opts?: { force?: boolean }) {
		const force = opts?.force === true;
		if (stockMediaMode === 'off') {
			stockNote = 'Stock is off — pick Stock photos or Stock videos';
			setTimeout(() => (stockNote = ''), 2500);
			return;
		}
		const preferredKind = stockMediaMode;
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
		const byShow = new Map<
			string,
			{ showId: string; slideId: string; slide: BulkSlide; showTitle: string }[]
		>();
		for (const t of targets) {
			const list = byShow.get(t.showId) ?? [];
			list.push(t);
			byShow.set(t.showId, list);
		}

		const deckResults = await mapPool([...byShow.entries()], 2, async ([showId, group]) => {
			const showTitle = group[0]?.showTitle ?? '';
			const topicForShow = [topicHint, showTitle].filter(Boolean).join(' ');
			const picks = await resolveStockPicksForSlides(
				group.map((t) => ({
					template: t.slide.template,
					headline: t.slide.headline || showTitle,
					body: t.slide.body,
				})),
				topicForShow,
				{ preferredKind },
			);
			return group.map((t, i) => {
				const pick = picks[i];
				return {
					showId: t.showId,
					slideId: t.slideId,
					ok: !!pick?.url,
					error: pick?.url ? '' : 'no match',
					patch: {
						mediaLoading: false,
						mediaUrl: pick?.url ?? '',
						mediaKind: pick?.kind ?? null,
						mediaThumb: pick?.thumb ?? '',
					} satisfies Partial<BulkSlide>,
				};
			});
		});
		const results = deckResults.flat();

		// Apply all patches in one write so concurrent fills don't clobber each other.
		const bySlide = new Map(results.map((r) => [`${r.showId}:${r.slideId}`, r.patch]));
		shows = shows.map((s) => ({
			...s,
			slides: s.slides.map((sl) => {
				const patch = bySlide.get(`${s.id}:${sl.id}`);
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
		void persistBulkWorkspace();
	}

	async function fillStockForSlide(showId: string, slideId: string) {
		const show = shows.find((s) => s.id === showId);
		const slide = show?.slides.find((s) => s.id === slideId);
		if (!show || !slide || !templateUsesStockMedia(slide.template)) return;
		if (stockMediaMode === 'off') {
			stockNote = 'Stock is off';
			setTimeout(() => (stockNote = ''), 2000);
			return;
		}
		updateSlide(showId, slideId, { mediaLoading: true });
		try {
			const pick = await resolveStockForTemplate(
				slide.template,
				slide.headline || show.title,
				slide.body,
				[topic.trim(), show.title].filter(Boolean).join(' '),
				{ preferredKind: stockMediaMode },
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
		if (usageBlocked || maxIdeasAllowed < 1) {
			openUsageUpgrade();
			return;
		}
		const decksWanted = Math.min(ideaCount, maxIdeasAllowed);
		if (decksWanted < 1) {
			openUsageUpgrade();
			return;
		}
		generating = true;
		generateError = '';
		try {
			const mode = newsContentMode;
			const resolvedSteps =
				mode === 'steps' ? parseStepsCountFromPrompt(t, stepsCount) : stepsCount;
			if (mode === 'steps') stepsCount = resolvedSteps;
			const syntheticHint = mode === 'news' ? '' : bulkSyntheticHint(mode, t);
			const histQuery = mode === 'news' ? t : syntheticHint || t;

			if (userId) {
				promptHistory = pushPromptHistory(userId, {
					query: histQuery,
					mode,
					title: `${decksWanted} idea${decksWanted === 1 ? '' : 's'} · ${slidesPerShow} slides`,
				});
			}

			const caps = captionDefaultsFromKit(brandKit);
			const workflowTpls = await resolveWorkflowTemplatesForGenerate();
			const defaultTpl = workflowTpls[0] ?? coerceTemplateId(brandKit.defaultTemplateId);
			const tone = bulkTonePayload();
			const deckTitlesSeen: string[] = [];
			let copyStopped = false;
			const DECK_COPY_CONCURRENCY = 2;

			const deckResults: Array<BulkShow | null> = await mapPool(
				Array.from({ length: decksWanted }, (_, d) => d),
				DECK_COPY_CONCURRENCY,
				async (d): Promise<BulkShow | null> => {
					if (copyStopped) return null;

					const avoidHooks =
						mode === 'news' || !userId
							? []
							: [...deckTitlesSeen, ...recentTitlesForQuery(userId, histQuery, 8)].slice(0, 12);

					const slideN = Math.max(1, slidesPerShow);
					const newsRes = await fetch('/api/news', {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({
							mode,
							storyCategory,
							search: mode === 'news' ? t : undefined,
							categories: mode === 'news' ? newsCategory : undefined,
							limit: 15,
							autoHighlight: wordHighlightsOn,
							pick: mode === 'news' ? 'random' : 'first',
							syntheticHint: syntheticHint || undefined,
							stepCount: mode === 'steps' ? resolvedSteps : undefined,
							slideCount: mode === 'news' ? undefined : slideN,
							studioRegenAt: Date.now() + d,
							avoidHooks: avoidHooks.length ? avoidHooks : undefined,
							maxWords: bulkHeadlineMaxWords,
							maxWordsSupport: bulkBodyMaxWords,
							...tone,
						}),
					});
					const newsData = await newsRes.json();
					if (newsRes.status === 402 || newsData?.code === 'LIMIT_REACHED') {
						copyStopped = true;
						if (!applyUsageFromPayload(newsData)) usageCanGenerate = false;
						openUsageUpgrade(typeof newsData?.error === 'string' ? newsData.error : undefined);
						return null;
					}
					if (!newsRes.ok) {
						throw new Error(newsData?.error || `Generate failed (${newsRes.status})`);
					}
					if (!applyUsageFromPayload(newsData)) void refreshBulkUsage();

					const hookText = stripEmDashes(String(newsData.text ?? ''));
					const rawBody = stripEmDashes(String(newsData.description ?? newsData.title ?? ''));
					const deckTitle = stripEmDashes(
						String(newsData.title ?? hookText).replace(/\[\[|\]\]/g, ''),
					).slice(0, 80);
					if (deckTitle) deckTitlesSeen.push(deckTitle);

					/* Same Hook → N distinct beats as Studio (`fetchDeckStoryBeats` / `/api/news/variants`). */
					const { copyStrings, bodies: beatBodies } = await fetchDeckStoryBeats({
						hookText: hookText || deckTitle,
						rawText: rawBody || deckTitle || hookText || t,
						count: slideN,
						title: deckTitle || t.slice(0, 80),
						sourceUrl: typeof newsData.url === 'string' ? newsData.url : undefined,
						contentMode: mode,
						userRequest: t,
						stepCount: mode === 'steps' ? resolvedSteps : undefined,
						autoHighlight: wordHighlightsOn,
						includeBodies: true,
						maxWords: bulkHeadlineMaxWords,
						maxWordsSupport: bulkBodyMaxWords,
						tone,
						clampBody: (text) => clampBulkNewsBody(text),
					});

					const keepMarkup = wordHighlightsOn;
					const headlines = copyStrings.map((h) =>
						clampBulkHeadline(h || hookText || deckTitle, keepMarkup),
					);
					const bodies = (
						beatBodies.length ? beatBodies : Array.from({ length: slideN }, () => rawBody)
					).map((b) => clampBulkNewsBody(b || rawBody));

					let slides: BulkSlide[] = Array.from({ length: slideN }, (_, i) => {
						const step = slideWorkflow[i] ?? slideWorkflow[slideWorkflow.length - 1];
						const savedId = String(step?.savedId ?? '').trim();
						const savedName = String(step?.savedName ?? '').trim();
						return {
							id: crypto.randomUUID(),
							template: coerceTemplateId(workflowTpls[i] ?? defaultTpl),
							headline:
								headlines[i] ||
								(i === 0
									? clampBulkHeadline(hookText, keepMarkup)
									: clampBulkHeadline(copyStrings[i] || headlines[0] || hookText, keepMarkup)),
							body: bodies[i] || (i === 0 ? clampBulkNewsBody(rawBody) : ''),
							captions: { ...caps },
							...(savedId
								? { savedTemplateId: savedId, savedTemplateName: savedName || undefined }
								: {}),
						};
					});
					if (!slides.length) slides.push(createBlankSlide(defaultTpl, caps));

					return {
						id: crypto.randomUUID(),
						title: deckTitle || t.slice(0, 48),
						slides,
						activeSlideId: slides[0]!.id,
					};
				},
			);
			const newShows = deckResults.filter((s): s is BulkShow => s != null);

			if (!newShows.length) {
				if (usageBlocked) return;
				throw new Error('No slideshows returned');
			}

			await archiveCurrentToLocalHistory().catch(() => {});
			const replaceCloudId = cloudWorkspaceId;
			shows = dedupeShowSlides(newShows);
			selectedShowId = shows[0]?.id ?? null;
			generating = false;
			if (autoStock) {
				await fillStockForShows(
					newShows.map((s) => s.id),
					{ force: true },
				);
			}
			await persistBulkWorkspace();
			try {
				/* Replace the open cloud row in place — don't leave deleted orphans that reappear. */
				const id = await saveShowsToCloud(shows, { updateId: replaceCloudId });
				if (id) {
					cloudWorkspaceId = id;
					void refreshLibrary();
					await goto(`/dashboard/bulk/${id}`, { replaceState: true, noScroll: true });
				} else {
					cloudWorkspaceId = null;
					generateError =
						'Generated locally, but cloud save failed — check Carousels after fixing bulk_workspaces, or use Save in the Bulk library.';
				}
			} catch (e: unknown) {
				const msg = e instanceof Error ? e.message : 'Cloud save failed';
				generateError = `Generated locally, but not saved to Carousels: ${msg}`;
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
			submitBulkPrompt();
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

	const wordHighlightsOn = $derived(brandKit.textHighlightsEnabled !== false);
	const newsSourceChromeBase = $derived(resolveNewsSourceChrome(brandKit, newsTemplateOverride));
	/** Paint-ready chrome — `r2:` logos signed for Bulk previews. */
	let newsSourceChrome = $state<NewsSourceChrome>(newsSourceChromeFromEmpty());
	const newsSourceOffsets = $derived(newsSourceTextOffsets(newsSourceChrome));

	function newsSourceChromeFromEmpty(): NewsSourceChrome {
		return {
			sourceLogoSrc: '',
			sourceLogoWidth: 140,
			sourceLogoPlateColor: '',
			sourceOffsetX: 0,
			sourceOffsetY: 0,
			sourceLabel: '',
			sourceBorderKind: 'none',
			sourceBorderColor: '#ffffff',
		};
	}

	$effect(() => {
		const base = newsSourceChromeBase;
		const savedIds = slideWorkflow.map((s) => String(s.savedId ?? '').trim()).filter(Boolean);
		const savedLogo =
			savedIds
				.map((id) => savedWorkflowTemplates.find((t) => t.id === id)?.logoSrc?.trim())
				.find((u) => !!u) || '';
		const displayable =
			base.sourceLogoSrc.startsWith('data:') ||
			base.sourceLogoSrc.startsWith('blob:') ||
			base.sourceLogoSrc.startsWith('http://') ||
			base.sourceLogoSrc.startsWith('https://') ||
			base.sourceLogoSrc.startsWith('/');
		const withSavedLogo =
			!displayable && savedLogo
				? { ...base, sourceLogoSrc: savedLogo }
				: base;
		let cancelled = false;
		newsSourceChrome = withSavedLogo;
		void resolveNewsSourceChromeMedia(withSavedLogo).then((resolved) => {
			if (!cancelled) newsSourceChrome = resolved;
		});
		return () => {
			cancelled = true;
		};
	});

	/** Paint-ready News stickers for Bulk preview (override + saved template). */
	let newsImageOverlaysBySlide = $state<Overlay[][]>([]);

	$effect(() => {
		const fromOverride = imageOverlaysFromNewsOverride(newsTemplateOverride);
		const savedIds = slideWorkflow.map((s) => String(s.savedId ?? '').trim()).filter(Boolean);
		const fromSaved =
			savedIds
				.map((id) => savedWorkflowTemplates.find((t) => t.id === id)?.overlaysBySlide)
				.find((rows) => Array.isArray(rows) && rows.some((r) => r.length)) ?? [];
		const rows: Overlay[][] =
			fromSaved.length && fromSaved.some((r) => r.length)
				? fromSaved
				: fromOverride.length
					? [fromOverride]
					: [];
		let cancelled = false;
		newsImageOverlaysBySlide = rows;
		if (rows.length) {
			void resolveImageOverlaysBySlideMedia(rows).then((resolved) => {
				if (!cancelled) newsImageOverlaysBySlide = resolved;
			});
		}
		return () => {
			cancelled = true;
		};
	});

	const brandHighlightDefaults = $derived(highlightDefaultsFromBrandKit(brandKit));
	const brandHighlightColor = $derived(brandHighlightDefaults.color);
	const highlightStyleKind = $derived(normalizeHighlightStyleKind(brandKit.highlightStyleKind));
	const highlightColor = $derived(
		normalizeHighlightHex(brandKit.highlightColor, DEFAULT_BRAND_KIT.highlightColor),
	);
	const highlightGradientFrom = $derived(
		normalizeHighlightHex(brandKit.highlightGradientFrom, DEFAULT_BRAND_KIT.highlightGradientFrom),
	);
	const highlightGradientTo = $derived(
		normalizeHighlightHex(brandKit.highlightGradientTo, DEFAULT_BRAND_KIT.highlightGradientTo),
	);
	const highlightPattern = $derived(
		normalizeHighlightPatternName(brandKit.highlightPattern, DEFAULT_BRAND_KIT.highlightPattern),
	);

	function patchBrandHighlights(patch: Partial<BrandKitSettings>) {
		brandKit = { ...brandKit, ...patch };
		if (userId) saveBrandKit(userId, brandKit);
	}

	function setWordHighlights(on: boolean) {
		patchBrandHighlights({ textHighlightsEnabled: on });
	}

	function persistBrandHighlight(nextRaw: string) {
		patchBrandHighlights({
			highlightColor: normalizeHighlightHex(nextRaw, highlightColor),
			highlightStyleKind: 'solid',
			textHighlightsEnabled: true,
		});
	}

	function persistBrandHighlightPattern(name: string) {
		const next = normalizeHighlightPatternName(name);
		if (!AVAILABLE_PATTERNS.some((p) => p.name === next)) return;
		patchBrandHighlights({
			highlightPattern: next,
			highlightStyleKind: 'pattern',
			textHighlightsEnabled: true,
		});
	}

	function persistBrandHighlightGradient(from: string, to: string) {
		const a = normalizeHighlightHex(from, highlightGradientFrom);
		const b = normalizeHighlightHex(to, highlightGradientTo);
		patchBrandHighlights({
			highlightColor: a,
			highlightStyleKind: 'gradient',
			highlightGradientFrom: a,
			highlightGradientTo: b,
			textHighlightsEnabled: true,
		});
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
			brandKit = {
				...brandKit,
				logoUrl: dataUrl,
				sourceLabelMode: 'logo',
				/* First upload often still has the old 260 default — snap to byline-sized mark. */
				sourceLogoWidth:
					Number(brandKit.sourceLogoWidth) >= 220
						? 140
						: Math.round(
								Math.max(80, Math.min(400, Number(brandKit.sourceLogoWidth) || 140)),
							),
			};
			if (userId) saveBrandKit(userId, brandKit);
			brandSavedNote = 'Logo saved';
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
		const chrome = newsSourceChrome;
		const state = buildDraftStateFromShow(show, {
			brandCtaEnabled: false,
			newsChrome: {
				sourceLogoSrc: chrome.sourceLogoSrc,
				sourceLogoWidth: chrome.sourceLogoWidth,
				sourceLogoPlateColor: chrome.sourceLogoPlateColor,
				sourceOffsetX: chrome.sourceOffsetX,
				sourceOffsetY: chrome.sourceOffsetY,
				sourceLabel: chrome.sourceLabel,
				sourceBorderKind: chrome.sourceBorderKind,
				sourceBorderColor: chrome.sourceBorderColor,
			},
			imageOverlaysBySlide: newsImageOverlaysBySlide,
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

<div class="bulk dash-page" class:bulk--prompt-compose={promptCompose}>

	{#if usageIsPaid === false}
		<div class="flex min-h-[60vh] flex-col items-center justify-center gap-6 px-6 py-20 text-center">
			<div class="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#f4f4f5]">
				<Layers size={28} class="text-[#888]" />
			</div>
			<div class="max-w-sm">
				<h1 class="text-xl font-semibold tracking-tight text-[#111]">Bulk generate is a paid feature</h1>
				<p class="mt-2 text-sm leading-relaxed text-[#666]">
					Generate multiple carousels at once with AI-powered bulk workflows. Upgrade to Hobby or higher to unlock it.
				</p>
			</div>
			<div class="flex flex-wrap justify-center gap-3">
				<Button href="/pricing" size="sm">See plans — from $19/mo</Button>
				<Button variant="outline" size="sm" href="/dashboard/studio">Open Studio instead</Button>
			</div>
			<p class="text-xs text-[#aaa]">Hobby: 45 carousels/mo · Creator: 100/mo · Business: unlimited</p>
		</div>
	{:else if !promptCompose}
	<section
		class="stack-wrap"
		aria-label="Slideshow stack"
		in:fly={{ y: 28, duration: 520, opacity: 0 }}
	>
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
				<Popover>
					<PopoverTrigger>
						{#snippet child({ props }: { props: Record<string, unknown> })}
							<Button
								{...props}
								variant="outline"
								size="sm"
								title={wordHighlightsOn
									? `Highlights on. ${highlightStyleKind === 'solid' ? highlightColor : highlightStyleKind}`
									: 'Highlights off. Tap to turn on'}
								aria-label="Highlights"
								aria-pressed={wordHighlightsOn}
								class={wordHighlightsOn ? '' : 'opacity-70'}
							>
								<span
									class="bulk-hl-swatch"
									class:bulk-hl-swatch--off={!wordHighlightsOn}
									style={
										!wordHighlightsOn
											? ''
											: highlightStyleKind === 'gradient'
												? `background: linear-gradient(90deg, ${highlightGradientFrom}, ${highlightGradientTo});`
												: highlightStyleKind === 'pattern'
													? `background-image: url('${AVAILABLE_PATTERNS.find((p) => p.name === highlightPattern)?.url ?? ''}'); background-size: cover;`
													: `background: ${highlightColor};`
									}
									aria-hidden="true"
								></span>
								<Highlighter data-icon="inline-start" />
								Highlights
								{#if wordHighlightsOn}
									<span class="bulk-hl-on-dot" aria-hidden="true"></span>
								{/if}
							</Button>
						{/snippet}
					</PopoverTrigger>
					<PopoverContent
						side="bottom"
						sideOffset={10}
						align="end"
						portalProps={{ to: 'body' }}
						class="z-[400] w-[280px] gap-0 rounded-[16px] border-[#ebebeb] bg-white p-3.5 shadow-[0_12px_40px_rgba(0,0,0,0.12),0_2px_8px_rgba(0,0,0,0.06)] text-[#1a1a1a]"
					>
						<div class="mb-3 flex items-center justify-between gap-2">
							<p class="text-[12px] font-semibold tracking-tight">Highlights</p>
							<div class="flex items-center gap-0.5 rounded-lg bg-[#ececec] p-0.5">
								<button
									type="button"
									aria-pressed={wordHighlightsOn}
									class="h-6 rounded-md px-2.5 text-[10px] font-semibold transition-all
										{wordHighlightsOn
											? 'bg-white text-[#111] ring-1 ring-black/10'
											: 'bg-transparent text-[#888] hover:text-[#333]'}"
									onclick={() => setWordHighlights(true)}
								>On</button>
								<button
									type="button"
									aria-pressed={!wordHighlightsOn}
									class="h-6 rounded-md px-2.5 text-[10px] font-semibold transition-all
										{!wordHighlightsOn
											? 'bg-white text-[#111] ring-1 ring-black/10'
											: 'bg-transparent text-[#888] hover:text-[#333]'}"
									onclick={() => setWordHighlights(false)}
								>Off</button>
							</div>
						</div>
						{#if wordHighlightsOn}
							<p class="mb-2 text-[10px] leading-snug text-[#999]">
								Accent color for highlighted words in generated copy.
							</p>
							<div class="flex flex-wrap items-center gap-1.5">
								{#each HIGHLIGHT_SOLID_PRESETS as c (c)}
									<button
										type="button"
										title={c}
										aria-label="Highlight {c}"
										aria-pressed={highlightStyleKind === 'solid' &&
											highlightColor.toUpperCase() === c.toUpperCase()}
										onclick={() => persistBrandHighlight(c)}
										class="h-7 w-7 shrink-0 rounded-full transition-transform hover:scale-105
											{highlightStyleKind === 'solid' &&
											highlightColor.toUpperCase() === c.toUpperCase()
												? 'ring-2 ring-[#111] ring-offset-2 ring-offset-white scale-105'
												: 'ring-1 ring-black/15'}"
										style="background: {c};"
									></button>
								{/each}
								<label
									title="Custom highlight color"
									aria-label="Custom highlight color"
									class="relative h-7 w-7 shrink-0 cursor-pointer overflow-hidden rounded-full
										{highlightStyleKind === 'solid' &&
										!HIGHLIGHT_SOLID_PRESETS.some((c) => c.toUpperCase() === highlightColor.toUpperCase())
											? 'ring-2 ring-[#111] ring-offset-2 ring-offset-white'
											: 'ring-1 ring-black/15'}"
									style="background: {highlightColor};"
								>
									<input
										type="color"
										value={highlightColor}
										oninput={(e) =>
											persistBrandHighlight((e.currentTarget as HTMLInputElement).value)}
										class="absolute inset-0 h-full w-full cursor-pointer opacity-0"
									/>
								</label>
							</div>
							<div class="mt-2 flex flex-wrap items-center gap-1.5">
								{#each HIGHLIGHT_GRADIENT_PRESETS as [from, to] (`${from}-${to}`)}
									<button
										type="button"
										title="{from} → {to}"
										aria-label="Highlight gradient {from} to {to}"
										aria-pressed={highlightStyleKind === 'gradient' &&
											highlightGradientFrom.toUpperCase() === from.toUpperCase() &&
											highlightGradientTo.toUpperCase() === to.toUpperCase()}
										onclick={() => persistBrandHighlightGradient(from, to)}
										class="h-7 w-10 shrink-0 rounded-full transition-transform hover:scale-105
											{highlightStyleKind === 'gradient' &&
											highlightGradientFrom.toUpperCase() === from.toUpperCase() &&
											highlightGradientTo.toUpperCase() === to.toUpperCase()
												? 'ring-2 ring-[#111] ring-offset-2 ring-offset-white scale-105'
												: 'ring-1 ring-black/15'}"
										style="background: linear-gradient(90deg, {from}, {to});"
									></button>
								{/each}
							</div>
							<div class="mt-2 flex flex-wrap items-center gap-1.5">
								{#each AVAILABLE_PATTERNS as pat (pat.name)}
									<button
										type="button"
										title={pat.label}
										aria-label="Highlight pattern {pat.label}"
										aria-pressed={highlightStyleKind === 'pattern' && highlightPattern === pat.name}
										onclick={() => persistBrandHighlightPattern(pat.name)}
										class="h-7 w-7 shrink-0 overflow-hidden rounded-full transition-transform hover:scale-105
											{highlightStyleKind === 'pattern' && highlightPattern === pat.name
												? 'ring-2 ring-[#111] ring-offset-2 ring-offset-white scale-105'
												: 'ring-1 ring-black/15'}"
										style="background-image: url('{pat.url}'); background-size: cover; background-position: center;"
									></button>
								{/each}
							</div>
						{:else}
							<p class="text-[11px] leading-snug text-[#888]">
								Highlights are off. New generates stay plain; existing [[…]] markup is hidden.
							</p>
						{/if}
					</PopoverContent>
				</Popover>
				<Button type="button" variant="outline" size="sm" onclick={addShow} disabled={stackLoading}>
					<Plus /> Add slideshow
				</Button>
			</div>
		</div>

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
									textHighlightsEnabled={wordHighlightsOn}
									sourceLogoSrc={newsSourceChrome.sourceLogoSrc || undefined}
									sourceLogoWidth={newsSourceChrome.sourceLogoWidth}
									sourceLogoPlateColor={newsSourceChrome.sourceLogoPlateColor || undefined}
									textOffsets={newsSourceOffsets}
									sourceLabel={newsSourceChrome.sourceLabel || undefined}
									highlightColor={brandHighlightColor}
									highlightDefaults={brandHighlightDefaults}
									imageOverlaysBySlide={newsImageOverlaysBySlide}
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
												textHighlightsEnabled={wordHighlightsOn}
												sourceLogoSrc={newsSourceChrome.sourceLogoSrc || undefined}
												sourceLogoWidth={newsSourceChrome.sourceLogoWidth}
												sourceLogoPlateColor={newsSourceChrome.sourceLogoPlateColor || undefined}
												textOffsets={newsSourceOffsets}
												sourceLabel={newsSourceChrome.sourceLabel || undefined}
												highlightColor={brandHighlightColor}
												highlightDefaults={brandHighlightDefaults}
												overlays={imageOverlaysForSlide(newsImageOverlaysBySlide, si)}
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
							</div>
							{/if}
						</div>

						<div class="show-side flex min-w-0 flex-1 flex-col gap-3">
							<div class="flex min-w-0 items-center gap-2">
								<Button
									type="button"
									variant="outline"
									size="icon-sm"
									class="tabular-nums"
									onclick={() => selectShow(show.id)}
								>
									{i + 1}
								</Button>
								<Input
									class="min-w-0 flex-1"
									value={show.title}
									oninput={(e) =>
										updateShow(show.id, { title: (e.currentTarget as HTMLInputElement).value })}
									onfocus={() => selectShow(show.id)}
									placeholder="Slideshow idea title"
								/>
								{#if show.fromVideoClips && show.clipSummary}
									<Button
										type="button"
										variant="ghost"
										size="icon-sm"
										title="AI summary"
										onclick={() => openSlidePopover(show.id, show.slides[0]!.id, 'intel')}
									>
										<Info />
									</Button>
								{/if}
								<div class="flex shrink-0 items-center gap-0.5">
									<Button
										type="button"
										variant="ghost"
										size="icon-sm"
										title="Move up"
										onclick={() => moveShow(show.id, -1)}
										disabled={i === 0}
									>
										<ChevronUp />
									</Button>
									<Button
										type="button"
										variant="ghost"
										size="icon-sm"
										title="Move down"
										onclick={() => moveShow(show.id, 1)}
										disabled={i === shows.length - 1}
									>
										<ChevronDown />
									</Button>
									<Button
										type="button"
										variant="ghost"
										size="icon-sm"
										class="text-destructive hover:bg-destructive/10 hover:text-destructive"
										title="Delete"
										onclick={() => deleteShow(show.id)}
									>
										<Trash2 />
									</Button>
								</div>
							</div>

							{#key slide.id}
							<div class="flex flex-col gap-3">
							<div class="flex items-start gap-2">
								<Textarea
									class="min-w-0 flex-1"
									rows={2}
									value={slide.headline}
									oninput={(e) =>
										updateSlide(show.id, slide.id, {
											headline: (e.currentTarget as HTMLTextAreaElement).value,
										})}
									placeholder="Slide headline / hook"
								/>
								{#if show.slides.length > 1}
									<Button
										type="button"
										variant="ghost"
										size="icon-sm"
										class="text-muted-foreground"
										title="Remove slide"
										aria-label="Remove slide"
										onclick={() => removeSlideFromShow(show.id, slide.id)}
									>
										<X />
									</Button>
								{/if}
							</div>

							{#if rowNeedsBody(slide.template)}
								<Textarea
									rows={3}
									value={slide.body}
									oninput={(e) =>
										updateSlide(show.id, slide.id, {
											body: (e.currentTarget as HTMLTextAreaElement).value,
										})}
									placeholder="Body copy"
								/>
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
								<!-- {#if String(slide.mediaThumb ?? '').trim() || slide.sourceR2Key}
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
								{/if} -->
								<!-- {#if slide.sourceR2Key && slide.mediaKind === 'video'}
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
								{/if} -->
							</div>

							<div class="flex flex-col gap-1.5">
								<Label for="bulk-tpl-{slide.id}">Template</Label>
								<NativeSelect.Root
									id="bulk-tpl-{slide.id}"
									class="w-full max-w-xs"
									value={slideTemplateSelectValue(slide)}
									onchange={(e) =>
										setSlideTemplateFromSelect(
											show.id,
											slide.id,
											(e.currentTarget as HTMLSelectElement).value,
										)}
								>
									<NativeSelect.OptGroup label="Layouts">
										{#each STUDIO_TEMPLATES as t}
											<NativeSelect.Option value={t.id}>{t.label}</NativeSelect.Option>
										{/each}
									</NativeSelect.OptGroup>
									{#if savedWorkflowTemplates.length || slide.savedTemplateId || slideWorkflow.some((s) => s.savedId)}
										<NativeSelect.OptGroup label="My templates">
											{#each savedWorkflowTemplates as s}
												<NativeSelect.Option value="saved:{s.id}">{s.name}</NativeSelect.Option>
											{/each}
											{#if slide.savedTemplateId && !savedWorkflowTemplates.some((s) => s.id === slide.savedTemplateId)}
												<NativeSelect.Option value="saved:{slide.savedTemplateId}">
													{slide.savedTemplateName || 'Saved template'}
												</NativeSelect.Option>
											{/if}
											{#each slideWorkflow as step}
												{#if step.savedId && !savedWorkflowTemplates.some((s) => s.id === step.savedId) && step.savedId !== slide.savedTemplateId}
													<NativeSelect.Option value="saved:{step.savedId}">
														{step.savedName || 'Saved template'}
													</NativeSelect.Option>
												{/if}
											{/each}
										</NativeSelect.OptGroup>
									{/if}
								</NativeSelect.Root>
							</div>
							</div>
							{/key}

							<div class="flex flex-wrap items-center gap-2 self-start max-md:self-stretch">
								<Button
									type="button"
									variant="outline"
									size="sm"
									class="shadow-sm max-md:flex-1"
									disabled={!!exportBusyShowId}
									onclick={() => void exportShowAsZip(show)}
									title="Download this slideshow as PNGs"
								>
									{#if exportBusyShowId === show.id}
										<Loader2 size={14} class="spin" />
										Exporting…
									{:else}
										<Download size={14} />
										Export
									{/if}
								</Button>
								<Button
									type="button"
									size="sm"
									class="shadow-sm max-md:flex-1"
									onclick={() => openShowInStudio(show)}
									title="Edit this slideshow in Studio"
								>
									Edit in Studio
									<ArrowRight data-icon="inline-end" />
								</Button>
							</div>
						</div>
					</div>
				</li>
			{/each}
			{/if}
		</ul>
	</section>
	{/if}

	{#if usageIsPaid !== false}
	<section
		class="bulk-prompt-chrome"
		class:bulk-prompt-chrome--compose={promptCompose}
		class:bulk-prompt-chrome--docked={!promptCompose}
		class:bulk-prompt-chrome--motion={promptChromeMotion}
		aria-label="Generate ideas"
	>
		<div class="bulk-prompt-shell">
			<div class="prompt-bar">
				<div class="prompt-bar-input">
					{#if userId}
						<Popover
							bind:open={promptHistoryOpen}
							onOpenChange={(o) => {
								if (o) refreshPromptHistory();
							}}
						>
							<PopoverTrigger>
								{#snippet child({ props }: { props: Record<string, unknown> })}
									<button
										{...props}
										type="button"
										class="prompt-bar-icon-btn"
										title="Prompt history"
										aria-label="Prompt history"
									>
										<History size={18} />
									</button>
								{/snippet}
							</PopoverTrigger>
							<PopoverContent
								side="top"
								sideOffset={10}
								align="start"
								portalProps={{ to: 'body' }}
								class="z-[400] w-[min(92vw,320px)] gap-0 overflow-hidden rounded-[18px] border-[#ebebeb] bg-white p-0 shadow-[0_12px_40px_rgba(0,0,0,0.12),0_2px_8px_rgba(0,0,0,0.06)] text-[#1a1a1a]"
							>
								<div class="flex items-center justify-between gap-2 border-b border-[#f0f0f0] px-3 py-2.5">
									<span class="text-[11px] font-semibold tracking-wide text-[#444]">Recent prompts</span>
									{#if promptHistory.length}
										<button
											type="button"
											class="text-[10px] font-medium text-[#999] hover:text-[#555]"
											onclick={() => {
												clearPromptHistory(userId);
												promptHistory = [];
											}}
										>
											Clear
										</button>
									{/if}
								</div>
								{#if !promptHistory.length}
									<p class="px-3 py-4 text-[12px] leading-relaxed text-[#999]">
										Your Generate queries show up here.
									</p>
								{:else}
									<ul class="max-h-[min(50vh,280px)] overflow-y-auto p-1.5">
										{#each promptHistory as entry (entry.id)}
											<li class="group flex items-stretch gap-0.5">
												<button
													type="button"
													class="min-w-0 flex-1 rounded-xl px-2.5 py-2 text-left hover:bg-[#f6f6f6]"
													onclick={() => applyPromptHistoryEntry(entry)}
												>
													<div class="truncate text-[12px] font-medium text-[#1a1a1a]">{entry.query}</div>
													{#if entry.title}
														<div class="mt-0.5 truncate text-[10px] text-[#999]">{entry.title}</div>
													{/if}
												</button>
												<button
													type="button"
													class="shrink-0 rounded-lg px-2 text-[#ccc] opacity-0 hover:bg-[#f0f0f0] hover:text-[#888] group-hover:opacity-100"
													title="Remove"
													aria-label="Remove from history"
													onclick={() => {
														promptHistory = removePromptHistoryEntry(userId, entry.id);
													}}
												>
													<X size={12} />
												</button>
											</li>
										{/each}
									</ul>
								{/if}
							</PopoverContent>
						</Popover>
					{/if}
					<input
						bind:value={topic}
						placeholder={topicPlaceholder}
						onkeydown={(e) => {
							if (e.key === 'Enter' && !e.metaKey && !e.ctrlKey) {
								e.preventDefault();
								submitBulkPrompt();
							}
						}}
						class="prompt-bar-field"
					/>
					{#if generateError}
						<div class="flex items-center gap-1 shrink-0 pt-1">
							<span class="text-[11px] font-body text-red-500 max-w-[180px] truncate" title={generateError}
								>{generateError}</span
							>
						</div>
					{/if}
				</div>

				<div class="prompt-bar-tools">
					<Popover>
						<PopoverTrigger class="prompt-chip">
							{#if newsContentMode === 'general'}
								<MessageSquare size={11} class="shrink-0" />
								General
							{:else if newsContentMode === 'news'}
								<Newspaper size={11} class="shrink-0" />
								News
							{:else if newsContentMode === 'fact'}
								<Sparkles size={11} class="shrink-0" />
								Random fact
							{:else if newsContentMode === 'story'}
								<Type size={11} class="shrink-0" />
								Random story
							{:else}
								<ListOrdered size={11} class="shrink-0" />
								Steps
							{/if}
							<ChevronDown size={10} class="ml-0.5 text-[#aaa] shrink-0" />
						</PopoverTrigger>
						<PopoverContent
							side="top"
							sideOffset={10}
							align="start"
							avoidCollisions={false}
							portalProps={{ to: 'body' }}
							class="z-[400] max-h-[min(70vh,420px)] w-52 gap-0 overflow-y-auto rounded-[18px] border-[#ebebeb] bg-white p-2 shadow-[0_12px_40px_rgba(0,0,0,0.12),0_2px_8px_rgba(0,0,0,0.06)] text-[#1a1a1a]"
						>
							{#each CONTENT_MODE_OPTS as opt}
								<button
									type="button"
									onclick={() => (newsContentMode = opt.id)}
									class="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-[12.5px] text-left transition-colors duration-100
										{newsContentMode === opt.id
											? 'bg-[#f0f0f0] font-semibold text-[#111]'
											: 'font-medium text-[#555] hover:bg-[#f7f7f7]'}"
								>
									<opt.icon size={13} class="shrink-0" />
									{opt.label}
									{#if newsContentMode === opt.id}
										<span class="ml-auto text-[#111]">✓</span>
									{/if}
								</button>
							{/each}
						</PopoverContent>
					</Popover>

					{#if newsContentMode !== 'general'}
						<Popover>
							<PopoverTrigger class="prompt-chip">
								{#if newsContentMode === 'news'}
									{NEWS_CATEGORIES.find((c) => c.id === newsCategory)?.label ?? 'Topic'}
								{:else if newsContentMode === 'story'}
									{STORY_THEMES.find((t) => t.id === storyCategory)?.label ?? 'Theme'}
								{:else if newsContentMode === 'quote'}
									{FACT_TOPICS.find((t) => t.id === quoteTopicCategory)?.label ?? 'Any'}
								{:else if newsContentMode === 'steps'}
									{stepsCount} steps
								{:else}
									{FACT_TOPICS.find((t) => t.id === factTopicCategory)?.label ?? 'Any'}
								{/if}
								<ChevronDown size={10} class="ml-0.5 text-[#aaa] shrink-0" />
							</PopoverTrigger>
							<PopoverContent
								side="top"
								sideOffset={10}
								align="start"
								avoidCollisions={false}
								portalProps={{ to: 'body' }}
								class="z-[400] max-h-[min(70vh,420px)] w-64 gap-0 overflow-y-auto rounded-[18px] border-[#ebebeb] bg-white p-3 shadow-[0_12px_40px_rgba(0,0,0,0.12),0_2px_8px_rgba(0,0,0,0.06)] text-[#1a1a1a]"
							>
								{#if newsContentMode === 'news'}
									<p class="mb-2 px-1 text-[10px] font-semibold uppercase tracking-widest text-[#b0b0b0]">
										News Category
									</p>
									<div class="grid grid-cols-2 gap-1.5">
										{#each NEWS_CATEGORIES as cat}
											<button
												type="button"
												onclick={() => (newsCategory = cat.id)}
												class="rounded-xl px-3 py-2 text-[12px] font-medium text-left transition-colors duration-100
													{newsCategory === cat.id
														? 'bg-[#7bf1a8] text-[#080808] font-semibold shadow-[inset_0_0_0_1px_rgba(8,8,8,0.06)]'
														: 'bg-[#f5f5f5] text-[#444] hover:bg-[#ececec]'}"
											>
												{cat.label}
											</button>
										{/each}
									</div>
								{:else if newsContentMode === 'story'}
									<p class="mb-2 px-1 text-[10px] font-semibold uppercase tracking-widest text-[#b0b0b0]">
										Story Theme
									</p>
									<div class="grid grid-cols-2 gap-1.5">
										{#each STORY_THEMES as th}
											<button
												type="button"
												onclick={() => (storyCategory = th.id)}
												class="rounded-xl px-3 py-2 text-[12px] font-medium text-left transition-colors duration-100
													{storyCategory === th.id
														? 'bg-[#7bf1a8] text-[#080808] font-semibold shadow-[inset_0_0_0_1px_rgba(8,8,8,0.06)]'
														: 'bg-[#f5f5f5] text-[#444] hover:bg-[#ececec]'}"
											>
												{th.label}
											</button>
										{/each}
									</div>
								{:else if newsContentMode === 'steps'}
									<p class="mb-2 px-1 text-[10px] font-semibold uppercase tracking-widest text-[#b0b0b0]">
										Step count
									</p>
									<div class="grid grid-cols-3 gap-1.5">
										{#each [3, 4, 5, 6, 7, 8] as n}
											<button
												type="button"
												onclick={() => (stepsCount = n)}
												class="rounded-xl px-3 py-2 text-[12px] font-medium text-center transition-colors duration-100
													{stepsCount === n
														? 'bg-[#7bf1a8] text-[#080808] font-semibold shadow-[inset_0_0_0_1px_rgba(8,8,8,0.06)]'
														: 'bg-[#f5f5f5] text-[#444] hover:bg-[#ececec]'}"
											>
												{n}
											</button>
										{/each}
									</div>
								{:else}
									<p class="mb-2 px-1 text-[10px] font-semibold uppercase tracking-widest text-[#b0b0b0]">
										{newsContentMode === 'quote' ? 'Quote topic' : 'Fact topic'}
									</p>
									<div class="grid grid-cols-2 gap-1.5">
										{#each FACT_TOPICS as ft}
											<button
												type="button"
												onclick={() =>
													newsContentMode === 'quote'
														? (quoteTopicCategory = ft.id)
														: (factTopicCategory = ft.id)}
												class="rounded-xl px-3 py-2 text-[12px] font-medium text-left transition-colors duration-100
													{(newsContentMode === 'quote' ? quoteTopicCategory : factTopicCategory) ===
													ft.id
														? 'bg-[#7bf1a8] text-[#080808] font-semibold shadow-[inset_0_0_0_1px_rgba(8,8,8,0.06)]'
														: 'bg-[#f5f5f5] text-[#444] hover:bg-[#ececec]'}"
											>
												{ft.label}
											</button>
										{/each}
									</div>
								{/if}
							</PopoverContent>
						</Popover>
					{/if}

					<Popover>
						<PopoverTrigger class="prompt-chip max-w-[9.5rem]" title="Language for generated copy">
							<Globe size={11} class="shrink-0" />
							<span class="truncate">{languageChipLabel}</span>
							<ChevronDown size={10} class="ml-0.5 text-[#aaa] shrink-0" />
						</PopoverTrigger>
						<PopoverContent
							side="top"
							sideOffset={10}
							align="start"
							avoidCollisions={false}
							portalProps={{ to: 'body' }}
							class="z-[400] max-h-[min(70vh,420px)] w-64 gap-0 overflow-y-auto rounded-[18px] border-[#ebebeb] bg-white p-2 shadow-[0_12px_40px_rgba(0,0,0,0.12),0_2px_8px_rgba(0,0,0,0.06)] text-[#1a1a1a]"
						>
							<p class="mb-1.5 px-2 pt-1 text-[10px] font-semibold uppercase tracking-widest text-[#b0b0b0]">
								Language
							</p>
							{#each GENERATION_LANGUAGE_GROUPS as group}
								<p class="mb-1 mt-2 px-2 text-[10px] font-semibold uppercase tracking-widest text-[#c4c4c4] first:mt-0">
									{group}
								</p>
								{#each generationLanguagesInGroup(group) as lang (lang.id)}
									<button
										type="button"
										onclick={() => (language = lang.id)}
										class="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left transition-colors duration-100
											{language === lang.id
												? 'bg-[#f0f0f0] text-[#111]'
												: 'text-[#555] hover:bg-[#f7f7f7]'}"
									>
										<span class="min-w-0">
											<span class="block text-[12.5px] font-semibold">{lang.native}</span>
											{#if lang.native !== lang.label}
												<span class="mt-0.5 block text-[10.5px] font-medium text-[#888]">{lang.label}</span>
											{/if}
										</span>
										{#if language === lang.id}
											<span class="ml-auto shrink-0 text-[#111]">✓</span>
										{/if}
									</button>
								{/each}
							{/each}
						</PopoverContent>
					</Popover>

					<Popover>
						<PopoverTrigger class="prompt-chip max-w-[9.5rem]" title="Who this copy is written for">
							<Users size={11} class="shrink-0" />
							<span class="truncate">{audienceChipLabel}</span>
							<ChevronDown size={10} class="ml-0.5 text-[#aaa] shrink-0" />
						</PopoverTrigger>
						<PopoverContent
							side="top"
							sideOffset={10}
							align="start"
							avoidCollisions={false}
							portalProps={{ to: 'body' }}
							class="z-[400] max-h-[min(70vh,420px)] w-64 gap-0 overflow-y-auto rounded-[18px] border-[#ebebeb] bg-white p-2 shadow-[0_12px_40px_rgba(0,0,0,0.12),0_2px_8px_rgba(0,0,0,0.06)] text-[#1a1a1a]"
						>
							<p class="mb-1.5 px-2 pt-1 text-[10px] font-semibold uppercase tracking-widest text-[#b0b0b0]">
								Audience
							</p>
							{#each BULK_AUDIENCES as aud}
								<button
									type="button"
									onclick={() => (audienceId = aud.id)}
									class="flex w-full items-start gap-2.5 rounded-xl px-3 py-2.5 text-left transition-colors duration-100
										{audienceId === aud.id
											? 'bg-[#f0f0f0] text-[#111]'
											: 'text-[#555] hover:bg-[#f7f7f7]'}"
								>
									<span class="min-w-0 text-[12.5px] font-semibold">{aud.label}</span>
									{#if audienceId === aud.id}
										<span class="ml-auto shrink-0 text-[#111]">✓</span>
									{/if}
								</button>
							{/each}
							{#if audienceId === 'custom'}
								<div class="px-2 pb-1">
									<input
										bind:value={audience}
										placeholder="e.g. first-time home buyers"
										class="h-9 w-full rounded-lg border border-[#e8e8e8] bg-white px-2.5 text-[12px] text-[#111] outline-none focus:border-[#ccc]"
									/>
								</div>
							{/if}
						</PopoverContent>
					</Popover>

					<Popover>
						<PopoverTrigger class="prompt-chip max-w-[8.5rem]" title="Writing style">
							<Palette size={11} class="shrink-0" />
							<span class="truncate">{styleChipLabel}</span>
							<ChevronDown size={10} class="ml-0.5 text-[#aaa] shrink-0" />
						</PopoverTrigger>
						<PopoverContent
							side="top"
							sideOffset={10}
							align="start"
							avoidCollisions={false}
							portalProps={{ to: 'body' }}
							class="z-[400] w-56 gap-0 rounded-[18px] border-[#ebebeb] bg-white p-2 shadow-[0_12px_40px_rgba(0,0,0,0.12),0_2px_8px_rgba(0,0,0,0.06)] text-[#1a1a1a]"
						>
							<p class="mb-1.5 px-2 pt-1 text-[10px] font-semibold uppercase tracking-widest text-[#b0b0b0]">Style</p>
							{#each BULK_STYLES as st}
								<button
									type="button"
									onclick={() => (style = st.id)}
									class="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left transition-colors duration-100
										{style === st.id ? 'bg-[#f0f0f0] text-[#111]' : 'text-[#555] hover:bg-[#f7f7f7]'}"
								>
									<span class="text-[12.5px] font-semibold">{st.label}</span>
									{#if style === st.id}
										<span class="ml-auto shrink-0 text-[#111]">✓</span>
									{/if}
								</button>
							{/each}
						</PopoverContent>
					</Popover>

					<Popover>
						<PopoverTrigger class="prompt-chip max-w-[8.5rem]" title="Emotional tone">
							<Heart size={11} class="shrink-0" />
							<span class="truncate">{emotionChipLabel}</span>
							<ChevronDown size={10} class="ml-0.5 text-[#aaa] shrink-0" />
						</PopoverTrigger>
						<PopoverContent
							side="top"
							sideOffset={10}
							align="start"
							avoidCollisions={false}
							portalProps={{ to: 'body' }}
							class="z-[400] w-56 gap-0 rounded-[18px] border-[#ebebeb] bg-white p-2 shadow-[0_12px_40px_rgba(0,0,0,0.12),0_2px_8px_rgba(0,0,0,0.06)] text-[#1a1a1a]"
						>
							<p class="mb-1.5 px-2 pt-1 text-[10px] font-semibold uppercase tracking-widest text-[#b0b0b0]">
								Emotion
							</p>
							{#each BULK_EMOTIONS as em}
								<button
									type="button"
									onclick={() => (emotion = em.id)}
									class="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left transition-colors duration-100
										{emotion === em.id ? 'bg-[#f0f0f0] text-[#111]' : 'text-[#555] hover:bg-[#f7f7f7]'}"
								>
									<span class="text-[12.5px] font-semibold">{em.label}</span>
									{#if emotion === em.id}
										<span class="ml-auto shrink-0 text-[#111]">✓</span>
									{/if}
								</button>
							{/each}
						</PopoverContent>
					</Popover>

					<Popover>
						<PopoverTrigger class="prompt-chip" title="How long each slide’s overlay copy should be">
							<Type size={11} class="shrink-0" />
							<span class="truncate">{copyLengthChipLabel}</span>
							<ChevronDown size={10} class="ml-0.5 text-[#aaa] shrink-0" />
						</PopoverTrigger>
						<PopoverContent
							side="top"
							sideOffset={10}
							align="start"
							avoidCollisions={false}
							portalProps={{ to: 'body' }}
							class="z-[400] max-h-[min(70vh,420px)] w-64 gap-0 overflow-y-auto rounded-[18px] border-[#ebebeb] bg-white p-2 shadow-[0_12px_40px_rgba(0,0,0,0.12),0_2px_8px_rgba(0,0,0,0.06)] text-[#1a1a1a]"
						>
							<p class="mb-1.5 px-2 pt-1 text-[10px] font-semibold uppercase tracking-widest text-[#b0b0b0]">
								Word count
							</p>
							<button
								type="button"
								onclick={() => (newsCopyLength = 'default')}
								class="flex w-full items-start gap-2.5 rounded-xl px-3 py-2.5 text-left transition-colors duration-100
									{newsCopyLength === 'default'
										? 'bg-[#f0f0f0] text-[#111]'
										: 'text-[#555] hover:bg-[#f7f7f7]'}"
							>
								<span class="min-w-0">
									<span class="block text-[12.5px] font-semibold">Default</span>
									<span class="mt-0.5 block text-[10.5px] font-medium leading-snug text-[#888]"
										>{bulkDefaultWordBudgetLabel}</span
									>
								</span>
								{#if newsCopyLength === 'default'}
									<span class="ml-auto shrink-0 text-[#111]">✓</span>
								{/if}
							</button>
							<button
								type="button"
								onclick={() => (newsCopyLength = 'standard')}
								class="flex w-full items-start gap-2.5 rounded-xl px-3 py-2.5 text-left transition-colors duration-100
									{newsCopyLength === 'standard'
										? 'bg-[#f0f0f0] text-[#111]'
										: 'text-[#555] hover:bg-[#f7f7f7]'}"
							>
								<span class="min-w-0">
									<span class="block text-[12.5px] font-semibold">Standard</span>
									<span class="mt-0.5 block text-[10.5px] font-medium leading-snug text-[#888]"
										>Up to 28 words</span
									>
								</span>
								{#if newsCopyLength === 'standard'}
									<span class="ml-auto shrink-0 text-[#111]">✓</span>
								{/if}
							</button>
							<button
								type="button"
								onclick={() => (newsCopyLength = 'short')}
								class="flex w-full items-start gap-2.5 rounded-xl px-3 py-2.5 text-left transition-colors duration-100
									{newsCopyLength === 'short'
										? 'bg-[#f0f0f0] text-[#111]'
										: 'text-[#555] hover:bg-[#f7f7f7]'}"
							>
								<span class="min-w-0">
									<span class="block text-[12.5px] font-semibold">Short</span>
									<span class="mt-0.5 block text-[10.5px] font-medium leading-snug text-[#888]"
										>≤12-word hook + 1 short body sentence</span
									>
								</span>
								{#if newsCopyLength === 'short'}
									<span class="ml-auto shrink-0 text-[#111]">✓</span>
								{/if}
							</button>
						</PopoverContent>
					</Popover>

					<Popover>
						<PopoverTrigger class="prompt-chip" title="How many slideshow ideas to generate">
							<Rows3 size={11} class="shrink-0" />
							<span class="truncate">{ideaCount} idea{ideaCount === 1 ? '' : 's'}</span>
							<ChevronDown size={10} class="ml-0.5 text-[#aaa] shrink-0" />
						</PopoverTrigger>
						<PopoverContent
							side="top"
							sideOffset={10}
							align="start"
							avoidCollisions={false}
							portalProps={{ to: 'body' }}
							class="z-[400] w-56 gap-0 rounded-[18px] border-[#ebebeb] bg-white p-3 shadow-[0_12px_40px_rgba(0,0,0,0.12),0_2px_8px_rgba(0,0,0,0.06)] text-[#1a1a1a]"
						>
							<p class="mb-2 px-1 text-[10px] font-semibold uppercase tracking-widest text-[#b0b0b0]">
								Ideas / slideshows
							</p>
							<div class="grid grid-cols-4 gap-1.5">
								{#each [1, 2, 3, 4, 5, 6, 7, 8] as n}
									<button
										type="button"
										disabled={n > maxIdeasAllowed}
										onclick={() => {
											if (n <= maxIdeasAllowed) ideaCount = n;
										}}
										title={n > maxIdeasAllowed
											? usageLimit != null
												? `Only ${maxIdeasAllowed} carousel${maxIdeasAllowed === 1 ? '' : 's'} left this month`
												: 'Not enough carousel tokens'
											: undefined}
										class="rounded-xl px-3 py-2 text-[12px] font-medium text-center transition-colors duration-100
											{ideaCount === n
												? 'bg-[#7bf1a8] text-[#080808] font-semibold shadow-[inset_0_0_0_1px_rgba(8,8,8,0.06)]'
												: n > maxIdeasAllowed
													? 'bg-[#f5f5f5] text-[#ccc] cursor-not-allowed'
													: 'bg-[#f5f5f5] text-[#555] hover:bg-[#ececec]'}"
									>
										{n}
									</button>
								{/each}
							</div>
							{#if usageLimit != null}
								<p class="mt-2 px-1 text-[10px] leading-snug text-[#999]">
									{usageUsed}/{usageLimit} carousels used this month
									{#if usageRemaining != null}
										· {usageRemaining} left
									{/if}
								</p>
							{/if}
						</PopoverContent>
					</Popover>

					<button
						type="button"
						class="prompt-bar-submit {usageBlocked ? 'opacity-50' : ''}"
						disabled={promptSubmitDisabled}
						title={usageBlocked
							? usageUpgradeMessage || 'Carousel limit reached — upgrade for more'
							: undefined}
						aria-label={usageBlocked ? 'Limit reached' : generating ? 'Generating' : 'Generate'}
						onclick={() => submitBulkPrompt()}
					>
						{#if generating}
							<Loader2 size={15} class="spin" />
						{:else}
							<ArrowUp size={15} strokeWidth={2.5} />
						{/if}
					</button>
				</div>

				<!-- Deck structure: slides + workflow share a row -->
				<div class="prompt-bar-tools">
					<Popover>
						<PopoverTrigger class="prompt-chip max-w-[8.5rem]" title="Slides in each slideshow">
							<Layers size={11} class="shrink-0" />
							<span class="truncate">{slidesPerShow} slide{slidesPerShow === 1 ? '' : 's'}</span>
							<ChevronDown size={10} class="ml-0.5 text-[#aaa] shrink-0" />
						</PopoverTrigger>
						<PopoverContent
							side="top"
							sideOffset={10}
							align="start"
							avoidCollisions={false}
							portalProps={{ to: 'body' }}
							class="z-[400] w-56 gap-0 rounded-[18px] border-[#ebebeb] bg-white p-3 shadow-[0_12px_40px_rgba(0,0,0,0.12),0_2px_8px_rgba(0,0,0,0.06)] text-[#1a1a1a]"
						>
							<p class="mb-2 px-1 text-[10px] font-semibold uppercase tracking-widest text-[#b0b0b0]">
								Slides / show
							</p>
							<div class="grid grid-cols-4 gap-1.5">
								{#each STUDIO_SLIDE_COUNT_OPTIONS as n}
									<button
										type="button"
										onclick={() => syncSlideWorkflow(n)}
										class="rounded-xl px-3 py-2 text-[12px] font-medium text-center transition-colors duration-100
											{slidesPerShow === n
												? 'bg-[#7bf1a8] text-[#080808] font-semibold shadow-[inset_0_0_0_1px_rgba(8,8,8,0.06)]'
												: 'bg-[#f5f5f5] text-[#555] hover:bg-[#ececec]'}"
									>
										{n}
									</button>
								{/each}
							</div>
						</PopoverContent>
					</Popover>

					<Popover
						onOpenChange={(o) => {
							if (o) void refreshSavedWorkflowTemplates();
						}}
					>
						<PopoverTrigger
							class="prompt-chip max-w-[14rem]"
							title="Template flow for each slide — e.g. News → Blank → Tweet"
						>
							<LayoutTemplate size={11} class="shrink-0" />
							<span class="truncate">{workflowTemplateSummary}</span>
							<ChevronDown size={10} class="ml-0.5 text-[#aaa] shrink-0" />
						</PopoverTrigger>
						<PopoverContent
							side="top"
							sideOffset={10}
							align="start"
							avoidCollisions={false}
							portalProps={{ to: 'body' }}
							class="z-[400] w-[min(24rem,calc(100vw-1.5rem))] gap-0 rounded-[18px] border-[#ebebeb] bg-white p-3 shadow-[0_12px_40px_rgba(0,0,0,0.12),0_2px_8px_rgba(0,0,0,0.06)] text-[#1a1a1a]"
						>
							<p class="mb-1.5 px-1 text-[10px] font-semibold uppercase tracking-widest text-[#b0b0b0]">
								Template workflow
							</p>
							<p class="mb-2.5 px-1 text-[10px] leading-snug text-[#999]">
								Pick layouts or a saved Studio template. Choosing a saved template replaces the whole flow for new ideas.
							</p>

							<ul class="flex max-h-[16rem] flex-col gap-1.5 overflow-y-auto pr-0.5">
								{#each slideWorkflow as step, i (i)}
									<li class="flex items-center gap-2 rounded-xl bg-[#f7f7f7] px-2.5 py-2">
										<span
											class="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-white text-[10px] font-bold text-[#555] shadow-[inset_0_0_0_1px_#ebebeb]"
										>
											{i + 1}
										</span>
										<select
											class="workflow-tpl-select min-w-0 flex-1"
											value={workflowStepSelectValue(step)}
											aria-label="Template for slide {i + 1}"
											onchange={(e) =>
												setSlideWorkflowFromSelect(
													i,
													(e.currentTarget as HTMLSelectElement).value,
												)}
										>
											<optgroup label="Layouts">
												{#each STUDIO_TEMPLATES as t}
													<option value={t.id}>{t.label}</option>
												{/each}
											</optgroup>
											{#if savedWorkflowTemplates.length}
												<optgroup label="My templates">
													{#each savedWorkflowTemplates as s}
														<option value="saved:{s.id}">{s.name}</option>
													{/each}
												</optgroup>
											{/if}
										</select>
										<button
											type="button"
											class="shrink-0 rounded-lg px-1.5 py-1 text-[#bbb] hover:bg-white hover:text-[#888] disabled:opacity-30"
											title="Remove slide"
											aria-label="Remove slide {i + 1}"
											disabled={slideWorkflow.length <= 1}
											onclick={() => removeWorkflowStep(i)}
										>
											<X size={12} />
										</button>
									</li>
								{/each}
							</ul>

							<div class="mt-2.5 flex flex-wrap items-center gap-1.5 px-0.5">
								<button
									type="button"
									class="inline-flex items-center gap-1 rounded-xl bg-[#f0f0f0] px-2.5 py-1.5 text-[11px] font-semibold text-[#333] hover:bg-[#e8e8e8] disabled:cursor-not-allowed disabled:opacity-40"
									disabled={slideWorkflow.length >= 8}
									onclick={() => addWorkflowStep()}
								>
									<Plus size={12} />
									Add slide
								</button>
								{#each STUDIO_TEMPLATES.slice(0, 6) as t}
									<button
										type="button"
										class="rounded-xl bg-[#f7f7f7] px-2 py-1.5 text-[10px] font-medium text-[#666] hover:bg-[#ececec] disabled:cursor-not-allowed disabled:opacity-40"
										disabled={slideWorkflow.length >= 8}
										title="Append {t.label}"
										onclick={() => addWorkflowStep(t.id)}
									>
										+ {t.label}
									</button>
								{/each}
							</div>

							{#if savedWorkflowLoading}
								<p class="mt-2 px-1 text-[10px] text-[#aaa]">Loading your templates…</p>
							{:else if savedWorkflowTemplates.length}
								<p class="mb-1.5 mt-3 px-1 text-[10px] font-semibold uppercase tracking-widest text-[#b0b0b0]">
									My templates
								</p>
								<ul class="flex max-h-[9rem] flex-col gap-1 overflow-y-auto pr-0.5">
									{#each savedWorkflowTemplates as s (s.id)}
										<li
											class="flex items-center gap-1.5 rounded-xl bg-[#f7f7f7] px-2 py-1.5"
										>
											<span class="min-w-0 flex-1 truncate text-[11px] font-medium text-[#333]"
												>{s.name}</span
											>
											<button
												type="button"
												class="shrink-0 rounded-lg bg-white px-2 py-1 text-[10px] font-semibold text-[#444] shadow-[inset_0_0_0_1px_#ebebeb] hover:bg-[#fafafa] disabled:opacity-40"
												disabled={slideWorkflow.length >= 8}
												title="Add as next slide"
												onclick={() => addSavedWorkflowStep(s)}
											>
												+ Add
											</button>
											<button
												type="button"
												class="shrink-0 rounded-lg bg-[#7bf1a8] px-2 py-1 text-[10px] font-semibold text-[#080808] hover:brightness-95"
												title="Replace workflow with this template’s slides"
												onclick={() => applySavedTemplateAsFlow(s)}
											>
												Use flow
											</button>
										</li>
									{/each}
								</ul>
							{:else}
								<p class="mt-2 px-1 text-[10px] leading-snug text-[#aaa]">
									No saved Studio templates yet. Save one in Studio (Save template) and it shows up here.
								</p>
							{/if}

							{#if slideWorkflow.length > 1}
								<p class="mt-2 truncate px-1 text-[10px] text-[#aaa]" title={workflowTemplateSummary}>
									{slideWorkflow.map((step) => workflowStepLabel(step)).join(' → ')}
								</p>
							{/if}
						</PopoverContent>
					</Popover>

					<Popover>
						<PopoverTrigger
							class="prompt-chip max-w-[11.5rem] {autoStock ? 'prompt-chip--on' : ''}"
							title="Where slide media comes from"
						>
							{#if stockMediaMode === 'video'}
								<Play size={11} class="shrink-0" />
							{:else if stockMediaMode === 'photo'}
								<Wallpaper size={11} class="shrink-0" />
							{:else}
								<Ban size={11} class="shrink-0" />
							{/if}
							<span class="truncate">{stockChipLabel}</span>
							<ChevronDown size={10} class="ml-0.5 text-[#aaa] shrink-0" />
						</PopoverTrigger>
						<PopoverContent
							side="top"
							sideOffset={10}
							align="start"
							avoidCollisions={false}
							portalProps={{ to: 'body' }}
							class="z-[400] w-64 gap-0 rounded-[18px] border-[#ebebeb] bg-white p-2 shadow-[0_12px_40px_rgba(0,0,0,0.12),0_2px_8px_rgba(0,0,0,0.06)] text-[#1a1a1a]"
						>
							<p class="mb-1.5 px-2 pt-1 text-[10px] font-semibold uppercase tracking-widest text-[#b0b0b0]">
								Media source
							</p>
							<button
								type="button"
								onclick={() => (stockMediaMode = 'photo')}
								class="flex w-full items-start gap-2.5 rounded-xl px-3 py-2.5 text-left transition-colors duration-100
									{stockMediaMode === 'photo'
										? 'bg-[#f0f0f0] text-[#111]'
										: 'text-[#555] hover:bg-[#f7f7f7]'}"
							>
								<Wallpaper size={13} class="mt-0.5 shrink-0" />
								<span class="min-w-0">
									<span class="block text-[12.5px] font-semibold">Stock photos</span>
									<span class="mt-0.5 block text-[10.5px] font-medium leading-snug text-[#888]"
										>Pexels stills for image templates</span
									>
								</span>
								{#if stockMediaMode === 'photo'}
									<span class="ml-auto shrink-0 text-[#111]">✓</span>
								{/if}
							</button>
							<button
								type="button"
								onclick={() => (stockMediaMode = 'video')}
								class="flex w-full items-start gap-2.5 rounded-xl px-3 py-2.5 text-left transition-colors duration-100
									{stockMediaMode === 'video'
										? 'bg-[#f0f0f0] text-[#111]'
										: 'text-[#555] hover:bg-[#f7f7f7]'}"
							>
								<Play size={13} class="mt-0.5 shrink-0" />
								<span class="min-w-0">
									<span class="block text-[12.5px] font-semibold">Stock videos</span>
									<span class="mt-0.5 block text-[10.5px] font-medium leading-snug text-[#888]"
										>Pexels clips; falls back to photos when needed</span
									>
								</span>
								{#if stockMediaMode === 'video'}
									<span class="ml-auto shrink-0 text-[#111]">✓</span>
								{/if}
							</button>
							<button
								type="button"
								onclick={() => (stockMediaMode = 'off')}
								class="flex w-full items-start gap-2.5 rounded-xl px-3 py-2.5 text-left transition-colors duration-100
									{stockMediaMode === 'off'
										? 'bg-[#f0f0f0] text-[#111]'
										: 'text-[#555] hover:bg-[#f7f7f7]'}"
							>
								<Ban size={13} class="mt-0.5 shrink-0" />
								<span class="min-w-0">
									<span class="block text-[12.5px] font-semibold">No stock</span>
									<span class="mt-0.5 block text-[10.5px] font-medium leading-snug text-[#888]"
										>Skip auto-fill after generate</span
									>
								</span>
								{#if stockMediaMode === 'off'}
									<span class="ml-auto shrink-0 text-[#111]">✓</span>
								{/if}
							</button>
						</PopoverContent>
					</Popover>
				</div>
			</div>
		</div>
	</section>
	{#if generateError}
		<p class="err" role="alert">{generateError}</p>
	{/if}
	{#if stockNote}
		<p class="stock-note" role="status">{stockNote}</p>
	{/if}
	{/if}

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
						<Button
							type="button"
							size="sm"
							disabled={popSlide.reframeBusy || !pyautoflipReady}
							onclick={() => void reframeBulkSlide(popShow.id, popSlide.id)}
						>
							{#if popSlide.reframeBusy}
								<Loader2 class="animate-spin" />
								Reframing…
							{:else}
								<Crop />
								Apply to this clip
							{/if}
						</Button>
						{#if popShow.fromVideoClips}
							<Button
								type="button"
								variant="outline"
								size="sm"
								disabled={!pyautoflipReady}
								onclick={() => void reframeAllBulkSlides(popShow.id)}
							>
								Reframe all clips
							</Button>
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
					{/if}
				</div>
			{/if}
		</BulkPopover>
	{/if}

	{#if usageUpgradeOpen}
		<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
		<div
			class="fixed inset-0 z-[500] flex items-center justify-center bg-black/45 p-4"
			role="presentation"
			onclick={() => (usageUpgradeOpen = false)}
		>
			<div
				class="w-full max-w-md rounded-2xl border border-black/10 bg-white p-6 shadow-xl text-[#111]"
				role="dialog"
				aria-modal="true"
				aria-labelledby="bulk-usage-upgrade-title"
				onclick={(e) => e.stopPropagation()}
			>
				<h2 id="bulk-usage-upgrade-title" class="text-lg font-semibold tracking-tight">
					Carousel limit reached
				</h2>
				<p class="mt-2 text-sm leading-relaxed text-[#555]">
					{usageUpgradeMessage}
				</p>
				<p class="mt-3 text-xs leading-relaxed text-[#888]">
					Free: {PLAN_CATALOG.free.carouselsPerMonth}/mo · Hobby (${PLAN_CATALOG.hobby.monthly}/mo): {PLAN_CATALOG.hobby.carouselsPerMonth} · Creator (${PLAN_CATALOG.creator.monthly}/mo): {PLAN_CATALOG.creator.carouselsPerMonth}
				</p>
				<div class="mt-5 flex flex-wrap gap-2">
					<Button href="/pricing" size="sm">View plans</Button>
					<Button type="button" variant="outline" size="sm" onclick={() => (usageUpgradeOpen = false)}>
						Close
					</Button>
				</div>
			</div>
		</div>
	{/if}

	{#if exportCaptureSlide}
		<div
			bind:this={exportHostEl}
			class="pointer-events-none fixed top-0 left-[-12000px] z-[-1] overflow-hidden"
			aria-hidden="true"
		>
			<BulkSlidePreview
				slide={exportCaptureSlide}
				width={STUDIO_FEED_CANVAS.w}
				preferThumb={false}
				textHighlightsEnabled={wordHighlightsOn}
				sourceLogoSrc={newsSourceChrome.sourceLogoSrc || undefined}
				sourceLogoWidth={newsSourceChrome.sourceLogoWidth}
				sourceLogoPlateColor={newsSourceChrome.sourceLogoPlateColor || undefined}
				textOffsets={newsSourceOffsets}
				sourceLabel={newsSourceChrome.sourceLabel || undefined}
				highlightColor={brandHighlightColor}
				highlightDefaults={brandHighlightDefaults}
				overlays={imageOverlaysForSlide(newsImageOverlaysBySlide, exportCaptureIndex)}
			/>
		</div>
	{/if}
</div>

<style>
	.bulk {
		--bulk-border: color-mix(in oklab, var(--app-border) 65%, transparent);
		--bulk-preview-width: 252px;
		--bulk-prompt-dock-pad: 8.5rem;
		color: var(--app-text);
		background: #fff;
		padding-bottom: var(--bulk-prompt-dock-pad);
		transition: padding-bottom 0.55s cubic-bezier(0.22, 1, 0.36, 1);
	}
	:global(.workflow-tpl-select) {
		appearance: none;
		border: 1px solid #e8e8e8;
		border-radius: 10px;
		background: #fff
			url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23999' stroke-width='2.5'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")
			no-repeat right 0.55rem center;
		padding: 0.4rem 1.75rem 0.4rem 0.65rem;
		font-size: 12px;
		font-weight: 550;
		color: #222;
		line-height: 1.2;
		cursor: pointer;
	}
	:global(.workflow-tpl-select:focus) {
		outline: none;
		border-color: #cfcfcf;
		box-shadow: 0 0 0 3px rgba(123, 241, 168, 0.35);
	}
	.bulk--prompt-compose {
		padding-bottom: 0;
		min-height: calc(100dvh - 5.5rem);
	}
	.bulk-header {
		display: flex;
		flex-wrap: wrap;
		justify-content: space-between;
		gap: 1rem;
		margin-bottom: 1rem;
		transition:
			opacity 0.4s cubic-bezier(0.22, 1, 0.36, 1),
			transform 0.55s cubic-bezier(0.22, 1, 0.36, 1);
	}
	.bulk--prompt-compose .bulk-header,
	.bulk-header--compose {
		opacity: 0.45;
		pointer-events: none;
	}
	.bulk-header h1 {
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
		border-color: var(--app-accent, #7bf1a8);
		box-shadow: 0 0 0 1px var(--app-accent, #7bf1a8);
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
		background: #7bf1a8;
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
		border-color: var(--app-accent, #7bf1a8);
		box-shadow: 0 0 0 1px var(--app-accent, #7bf1a8);
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
	.bulk-prompt-chrome {
		position: fixed;
		left: 50%;
		z-index: 40;
		width: min(52rem, calc(100vw - 1.75rem));
		margin: 0;
		padding: 0;
		background: transparent;
		pointer-events: none;
		/* Keep above the overflow-hidden dashboard inset + room for upward popovers */
		bottom: max(1.75rem, calc(env(safe-area-inset-bottom, 0px) + 0.75rem));
		transform: translate3d(-50%, 0, 0);
		will-change: bottom, transform;
	}
	.bulk-prompt-chrome--motion {
		transition:
			bottom 0.6s cubic-bezier(0.22, 1, 0.36, 1),
			transform 0.6s cubic-bezier(0.22, 1, 0.36, 1);
	}
	.bulk-prompt-chrome--compose {
		bottom: 50%;
		transform: translate3d(-50%, 50%, 0);
	}
	.bulk-prompt-chrome--docked {
		bottom: max(1.75rem, calc(env(safe-area-inset-bottom, 0px) + 0.75rem));
		transform: translate3d(-50%, 0, 0);
	}
	.bulk-prompt-shell {
		width: 100%;
		pointer-events: auto;
		filter: drop-shadow(0 14px 32px rgba(0, 0, 0, 0.07));
		transition: filter 0.45s ease;
	}
	.bulk-prompt-chrome--compose .bulk-prompt-shell {
		filter: drop-shadow(0 22px 48px rgba(0, 0, 0, 0.12));
	}
	@media (prefers-reduced-motion: reduce) {
		.bulk,
		.bulk-header,
		.bulk-prompt-chrome--motion,
		.bulk-prompt-shell {
			transition: none !important;
		}
	}
	/* Prompt bar chrome: `$lib/styles/prompt-bar.css` */
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
		gap: 0.5rem;
		flex-wrap: wrap;
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
	.bulk-hl-swatch {
		width: 12px;
		height: 12px;
		border-radius: 999px;
		flex-shrink: 0;
		box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.14);
	}
	.bulk-hl-swatch--off {
		background: transparent !important;
		background-image: none !important;
		box-shadow: inset 0 0 0 1.5px rgba(0, 0, 0, 0.28);
		position: relative;
	}
	.bulk-hl-swatch--off::after {
		content: '';
		position: absolute;
		left: 50%;
		top: 50%;
		width: 13px;
		height: 1.5px;
		background: rgba(0, 0, 0, 0.35);
		transform: translate(-50%, -50%) rotate(-45deg);
		border-radius: 1px;
	}
	.bulk-hl-on-dot {
		width: 6px;
		height: 6px;
		border-radius: 999px;
		flex-shrink: 0;
		background: #22c55e;
		box-shadow: 0 0 0 1.5px rgba(34, 197, 94, 0.25);
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
		.bulk {
			--bulk-preview-width: min(252px, calc(100vw - 2rem));
			padding-left: 0;
			padding-right: 0;
		}
		.bulk-prompt-chrome {
			width: calc(100vw - 1rem);
		}
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
	.show-meta {
		font-size: 0.68rem;
		color: var(--app-text-3);
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
	/* Prefer global `.sk-shimmer` — keep local aliases in sync with Bulk/site skeleton. */
	.skeleton-block,
	.skeleton-thumb,
	.skeleton-line,
	.skeleton-chips span {
		background-image: linear-gradient(110deg, #ececec 8%, #f8f8f8 18%, #ececec 33%);
		background-size: 200% 100%;
		animation: sk-shimmer 1.4s ease-in-out infinite;
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
	}
	.skeleton-line {
		height: 0.72rem;
		border-radius: 6px;
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
	}
	@media (prefers-reduced-motion: reduce) {
		.skeleton-block,
		.skeleton-thumb,
		.skeleton-line,
		.skeleton-chips span {
			animation: none;
			background-image: none;
			background-color: #ececec;
		}
	}
</style>
