<script lang="ts">
	import { FONT_TEMPLATE_DEFAULT, FONT_UI_STACK } from '$lib/fonts/brand-fonts';
	import { supabase } from '$lib/supabase';
	import { fetchDraftLibraryRows } from '$lib/studio/draft-library';
	import {
		isSavedStudioTemplateSelectId,
		savedStudioTemplateIdFromSelectId,
		savedStudioTemplateMetaFromRow,
		type SavedStudioTemplateMeta,
	} from '$lib/studio/saved-template-library';
	import { onMount, tick, untrack } from 'svelte';
	import { goto, afterNavigate, beforeNavigate } from '$app/navigation';
import { toPng } from 'html-to-image';
import JSZip from 'jszip';
	import NewsTemplate from '$lib/components/templates/NewsTemplate.svelte';
	import BlankTemplate from '$lib/components/templates/BlankTemplate.svelte';
	import TweetTemplate from '$lib/components/templates/TweetTemplate.svelte';
	import ArticleTemplate from '$lib/components/templates/ArticleTemplate.svelte';
	import TextCarouselTemplate from '$lib/components/templates/TextCarouselTemplate.svelte';
	import ImageQuoteTemplate from '$lib/components/templates/ImageQuoteTemplate.svelte';
	import VideoStoryTemplate from '$lib/components/templates/VideoStoryTemplate.svelte';
	import BrandStackTemplate from '$lib/components/templates/BrandStackTemplate.svelte';
	import VideoSplitTemplate from '$lib/components/templates/VideoSplitTemplate.svelte';
	import BlackTextCarouselTemplate from '$lib/components/templates/BlackTextCarouselTemplate.svelte';
	import PhotoStoryTemplate from '$lib/components/templates/PhotoStoryTemplate.svelte';
	import WhitePostTemplate from '$lib/components/templates/WhitePostTemplate.svelte';
	import BrandCtaTemplate from '$lib/components/templates/BrandCtaTemplate.svelte';
	import {
		DEFAULT_BRAND_CTA,
		loadBrandCta,
		saveBrandCta,
		type BrandCtaSettings,
	} from '$lib/studio/brand-cta';
	import StudioTextOverlays from '$lib/components/studio/StudioTextOverlays.svelte';
	import StudioImageStickers from '$lib/components/studio/StudioImageStickers.svelte';
	import StudioAssetsSidebar from '$lib/components/studio/StudioAssetsSidebar.svelte';
	import FloatingActions from '$lib/components/FloatingActions.svelte';
	import StudioLeavePrompt from '$lib/components/studio/StudioLeavePrompt.svelte';
	import StudioAiPromptModal from '$lib/components/studio/StudioAiPromptModal.svelte';
	import { refreshUsageStatus } from '$lib/usage-client';
	import {
		isTemplateDevToolsEnabled,
		loadEnabledTemplateDevOverride,
		saveTemplateDevOverride,
		type TemplateDevOverride as TemplateDevOverrideSnapshot,
		type TemplateDevStarterContent,
	} from '$lib/studio/template-dev-override';
	import {
		captureNewsLayoutDocument,
		newsDocumentToApplyPatch,
		newsOffsetsForStudioRow,
		parseNewsLayoutDocument,
		type NewsLayoutDocument,
	} from '$lib/studio/news-layout-document';
	import { clampToCompleteSentences, clampToCompleteWords, ensureCompleteThought, fitCopyBudget, isIncompleteOverlayCopy, splitIntoSentences } from '$lib/studio/fit-copy';
	import StudioCanvasSkeleton from '$lib/components/studio/StudioCanvasSkeleton.svelte';
	import { prepareImageAsDataUrl } from '$lib/client/image-upload-prep';
	import { studioCanvasImageUrl } from '$lib/client/optimize-image-url';
	import { formatExportError, replaceVideosWithFrameImages, fetchRemoteVideoAsBlobUrl, materializeDomImagesForExport, SAFE_HTML_TO_IMAGE_OPTS } from '$lib/studio/export-capture';
	import { isVideoFile, objectUrlForVideoFile, playMediaVideo } from '$lib/studio/media-url';
	import {
		fetchStockMediaPool,
		fetchStockImagePool,
		fetchStockCircleImagePool,
		resolveStockSearchQueries,
		stockQueryFromSlide,
		templateUsesStockMedia,
		templateUsesStockVideo,
		type StockPick,
	} from '$lib/studio/bulk-stock';
	import {
		audiencePromptText,
		BULK_AUDIENCES,
		BULK_EMOTIONS,
		BULK_STYLES,
		type BulkEmotionId,
		type BulkStyleId,
	} from '$lib/studio/bulk-to-studio';
	import {
		loadStudioComposePrefs,
		MAX_STUDIO_SLIDE_COUNT,
		STUDIO_SLIDE_COUNT_OPTIONS,
		type StudioComposePrefs,
	} from '$lib/studio/compose-prefs';
	import {
		fetchDeckStoryBeats as fetchDeckStoryBeatsShared,
		fallbackStoryBeats,
		normalizeHeadlineVariants,
	} from '$lib/studio/deck-story-beats';
	import {
		draftStateHasEmbeddedMedia,
		stripEmbeddedMediaFromDraftState,
	} from '$lib/studio/draft-state-prune';
	import {
		clearPromptHistory,
		loadPromptHistory,
		pushPromptHistory,
		recentTitlesForQuery,
		removePromptHistoryEntry,
		type StudioPromptHistoryEntry,
	} from '$lib/studio/prompt-history';
	import { setFlashToast } from '$lib/ui/flash-toast';
	import { assessUserTopicSafety } from '$lib/topic-safety';
	import {
		recordSlideAsVideo,
		slideExportDurationSec,
		transcodeSlideVideoToMp4,
	} from '$lib/studio/export-slide-video';
	import { fade } from 'svelte/transition';
	import FloatingTextToolbar from '$lib/components/FloatingTextToolbar.svelte';
	import TextCarouselAvatarToolbar from '$lib/components/TextCarouselAvatarToolbar.svelte';
	import TweetMediaToolbar from '$lib/components/TweetMediaToolbar.svelte';
	import NewsBackgroundToolbar from '$lib/components/NewsBackgroundToolbar.svelte';
	import HighlightEditor from '$lib/components/HighlightEditor.svelte';
	import DockToolbar from '$lib/components/DockToolbar.svelte';
	import FormatDockToolbar from '$lib/components/FormatDockToolbar.svelte';
	import TemplateDockToolbar from '$lib/components/TemplateDockToolbar.svelte';
	import { Button } from '$lib/components/ui/button';
	import * as ButtonGroup from '$lib/components/ui/button-group/index.js';
	import { GOOGLE_FONTS, loadGoogleFont } from '$lib/fonts';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { r2UploadBlob, r2UploadVideo } from '$lib/r2Client';
	import { r2SignRead } from '$lib/r2Client';
	import { resolveStoredMediaUrl, ensureR2RefLoaded, prefetchAllR2RefsInStudioMedia, isR2Ref } from '$lib/studio/r2-media-resolve';
	import { studioTemplateRuntime } from '$lib/studio/template-runtime';
	import {
		Select,
		SelectContent,
		SelectItem,
		SelectTrigger,
	} from '$lib/components/ui/select';
	import { Switch } from '$lib/components/ui/switch';
	import { Slider } from '$lib/components/ui/slider';
	import { Tabs, TabsList, TabsTrigger } from '$lib/components/ui/tabs';
	import { Separator } from '$lib/components/ui/separator';
	import { Popover, PopoverContent, PopoverTrigger } from '$lib/components/ui/popover';
	import { DragDropProvider, DragOverlay } from '@dnd-kit-svelte/svelte';
	import { PointerSensor } from '@dnd-kit-svelte/svelte';
	import { PointerActivationConstraints } from '@dnd-kit/dom';
	import { useSortable, isSortable } from '@dnd-kit-svelte/svelte/sortable';
	import { RestrictToHorizontalAxis } from '@dnd-kit-svelte/svelte/modifiers';
	import { move } from '@dnd-kit/helpers';
	import {
		applyHighlight,
		reapplyHighlightPhrases,
		type HighlightSpec,
		type StudioHighlightStyleKind,
		type HighlightDefaults,
		plainRangeFromSelection,
		plainRangeHasMixedForegroundPaint,
		rangeForegroundSwatchColor,
		inspectPlainRangePaint,
		inspectPlainRangeWeight,
		stripMarkup,
		stripMarkerBackgrounds,
		AVAILABLE_PATTERNS,
		HIGHLIGHT_SOLID_PRESETS,
		HIGHLIGHT_GRADIENT_PRESETS,
	} from '$lib/highlight';
	import { stripEmDashes } from '$lib/strip-em-dashes';
	import { TEXT_PAD_DEFAULT } from '$lib/textStyleCss';
	import type { Overlay, TextOverlay, TextStyle, TextElementKind } from '$lib/types';
	import { removeBackground } from '$lib/backgroundRemoval';
	import {
		STUDIO_TEMPLATES,
		mapQueryParamToTemplateId,
		coerceTemplateId,
		isVideoStoryFamily,
		isBrandStackFamily,
		isVideoSplitFamily,
		isPhotoStoryFamily,
		isWhitePostFamily,
		videoLayoutForTemplate,
		supportsFilmStrip,
		usesStructuralFilmStrip,
		FILM_STRIP_TEMPLATE_IDS,
		type TemplateId,
		type StudioTemplateDef,
		type FilmStripTemplateId,
	} from '$lib/studio/template-ids';
	import {
		DEFAULT_CIRCLE_SHADOW,
		normalizeCircleShadow,
	} from '$lib/studio/circle-shadow';
	import {
		BOTTOM_SHADOW_CURVES,
		BOTTOM_SHADOW_PRESETS,
		BOTTOM_SHADOW_COLORS,
		bottomShadowHeightForTextStack,
		buildBottomShadowGradient,
		normalizeBottomShadowCurve,
		normalizeBottomShadowColor,
		NEWS_SHADOW_AUTOFIT,
		type BottomShadowCurve,
	} from '$lib/studio/bottom-shadow';
	import {
		NEWS_PLACEHOLDER_HEADLINE,
		NEWS_DEFAULT_SOURCE,
		NEWS_DEFAULT_SUBTEXT,
		NEWS_DEFAULT_LAYOUT,
		NEWS_DEFAULT_CIRCLE_IMAGE,
		NEWS_HEADLINE_STYLE,
		NEWS_SUBTEXT_STYLE,
		NEWS_DEMO_VIDEO,
		NEWS_DEMO_IMAGE,
		TWEET_DEFAULTS,
		ARTICLE_DEFAULT_BODY,
		ARTICLE_DEFAULT_SWIPE,
		TEXT_CAROUSEL_DEFAULTS,
		ensureTextCarouselBodyMinLength,
		IMAGE_QUOTE_DEFAULTS,
		FILM_STRIP_DEFAULTS,
		filmStripDefaultsFor,
		clampFilmStripPct,
		VIDEO_STORY_DEFAULTS,
		VIDEO_HOOK_DEFAULTS,
		VIDEO_HOOK_HEADLINE_STYLE,
		VIDEO_CREATOR_DEFAULTS,
		VIDEO_CREATOR_HEADLINE_STYLE,
		VIDEO_TEXT_DEFAULTS,
		VIDEO_TEXT_HEADLINE_STYLE,
		VIDEO_SOURCE_DEFAULTS,
		VIDEO_SOURCE_HEADLINE_STYLE,
		VIDEO_FEATURE_DEFAULTS,
		VIDEO_FEATURE_HEADLINE_STYLE,
		VIDEO_FEATURE_BODY_STYLE,
		VIDEO_POST_DEFAULTS,
		VIDEO_POST_HEADLINE_STYLE,
		BRAND_STACK_DEFAULTS,
		VIDEO_SPLIT_DEFAULTS,
		BRAND_STACK_HEADLINE_STYLE,
		PHOTO_TOPIC_DEFAULTS,
		PHOTO_TOPIC_HEADLINE_STYLE,
		PHOTO_TOPIC_BODY_STYLE,
		PHOTO_CAPTION_DEFAULTS,
		WHITE_THREAD_DEFAULTS,
		WHITE_MEDIA_DEFAULTS,
		BLACK_TEXT_CAROUSEL_DEFAULTS,
	} from '$lib/studio/slide-content-defaults';
	import { ensureFirstWordHighlight } from '$lib/video-clips/video-hook';
	import {
		fitTextCarouselBodyToCanvas,
		TEXT_CAROUSEL_DEFAULT_BODY_WORDS,
		textCarouselBudgetFromMaxWords,
	} from '$lib/studio/text-carousel-body';
	import {
		parseExternalSlideBlocksJson,
		computeStudioSlideMergePatches,
		type ExternalSlideMergeMode,
	} from '$lib/studio/external-slide-merge';
	import {
		consumeStudioClipImport,
		peekStudioClipImport,
		type StudioClipImport,
		type StudioClipCaptionImport,
	} from '$lib/studio/clip-import';
	import { takeBulkImport, peekBulkImport } from '$lib/studio/bulk-to-studio';
	import {
		BRAND_KIT_UPDATED_EVENT,
		DEFAULT_BRAND_KIT,
		brandProfile,
		hydrateBrandKit,
		isPlaceholderNewsSource,
		isPlaceholderProfileHandle,
		isPlaceholderProfileName,
		loadBrandKit,
		normalizeBrandHandle,
		normalizeHighlightHex,
		normalizeHighlightStyleKind,
		normalizeTextBgHex,
		saveBrandKit,
	} from '$lib/studio/brand-kit';
	import VideoCaptionOverlay from '$lib/components/video-clips/VideoCaptionOverlay.svelte';
	import { getCaptionTemplate } from '$lib/video-clips/caption-templates';
	import {
		segmentsToPhrases,
		getActivePhrase,
		getActiveWordIndex,
		type CaptionPhrase,
	} from '$lib/video-clips/caption-chunking';
	import {
		Newspaper, Sparkles, Quote, RefreshCw, Download, Loader, AlertCircle,
		Image, ImagePlus, Type, Layers, ListOrdered, MessageSquare,
		Scissors, Volume2, VolumeX, Eye, EyeOff, Music, Play, X, Circle, Palette, Trash2, RotateCcw, Wallpaper, ArrowUp, ChevronDown, PanelBottom, User, Users, Heart, Highlighter, History
	} from 'lucide-svelte';
	import { IsMobile } from '$lib/hooks/is-mobile.svelte.js';

	/** Default full-bleed asset for the Black text carousel template. */
	/** Empty: solid `#000` from the template. Avoid a JPEG that already contains the sample copy — it would stack under live text and look doubled. */
	const BLACK_TEXT_BG_DEFAULT = '';

	/** Fresh `/dashboard/studio` sessions start with this many slides (filmstrip + News fetch deck). */
	const DEFAULT_STUDIO_SLIDE_COUNT = 3;

	const emptySlides = <T,>(factory: (i: number) => T): T[] =>
		Array.from({ length: DEFAULT_STUDIO_SLIDE_COUNT }, (_, i) => factory(i));

	/** Empty media rows — demos are seeded only via `seedFreshTemplateSession`, not at init. */
	const emptyTemplateMediaUrls = (): Record<TemplateId, string[]> => ({
		blank: emptySlides(() => ''),
		news: emptySlides(() => ''),
		tweet: emptySlides(() => ''),
		article: emptySlides(() => ''),
		textCarousel: emptySlides(() => ''),
		imageQuote: emptySlides(() => ''),
		videoStory: emptySlides(() => ''),
		videoFit: emptySlides(() => ''),
		videoSplit: emptySlides(() => ''),
		videoBlur: emptySlides(() => ''),
		videoHook: emptySlides(() => ''),
		videoCreator: emptySlides(() => ''),
		videoText: emptySlides(() => ''),
		videoSource: emptySlides(() => ''),
		videoFeature: emptySlides(() => ''),
		videoPost: emptySlides(() => ''),
		brandStack: emptySlides(() => ''),
		blackText: emptySlides(() => ''),
		photoTopic: emptySlides(() => ''),
		photoCaption: emptySlides(() => ''),
		whiteThread: emptySlides(() => ''),
		whiteMedia: emptySlides(() => ''),
	});

	function friendlySupabaseError(message: string): string {
		if (/upstream connect error|delayed connect error:\s*111|connection refused/i.test(message)) {
			return 'Could not reach Supabase (your database may be paused). Open the Supabase dashboard → Restore project, then refresh.';
		}
		return message;
	}

	function openFreshTemplateStarter(template: TemplateId) {
		applyBlankCanvas();
		applyTemplateToAll(template, { skipNewsSeed: true });
		seedFreshTemplateSession(template);
		freshStarterApplied = true;
		consumeForcedTemplateStarter();
	}

	// ── State ──────────────────────────────────────────────────────────────
	let userId = $state('');

	/** Refresh session and return the authenticated user id (RLS requires auth.uid()). */
	async function ensureStudioAuthUserId(): Promise<string> {
		const { data: userData, error: userErr } = await supabase.auth.getUser();
		if (userErr || !userData?.user?.id) {
			const { data: refreshed, error: refreshErr } = await supabase.auth.refreshSession();
			if (refreshErr || !refreshed?.session?.user?.id) {
				throw new Error('Your session expired — sign in again, then save.');
			}
			userId = refreshed.session.user.id;
			return userId;
		}
		userId = userData.user.id;
		return userId;
	}
	let initialTemplateParamApplied = $state(false);
	let forcedTemplateFromQuery = $state<TemplateId | null>(null);
	/** `?blank=1` — skip draft restore and open the Blank canvas template (custom layout; not News). */
	let forcedBlankFromQuery = $state(false);
	/** `?template=…` starter links (template carousel / nav) — don’t restore last autosave workspace on top of a “new” session. */
	let skipLatestWorkspaceDraftRestore = $state(false);
	/** True once `openFreshTemplateStarter` ran this session (avoids double-seed / wrong fallback). */
	let freshStarterApplied = $state(false);
	/** Clip payload from Videos → Edit in Studio (sessionStorage), applied after template boot. */
	let pendingClipImport = $state<StudioClipImport | null>(null);
	let clipImportApplied = $state(false);
	/** Timed captions imported with a clip (CapCut-style overlay on the canvas video). */
	let studioClipCaptions = $state<StudioClipCaptionImport | null>(null);
	let studioCaptionPhrases = $state<CaptionPhrase[]>([]);
	let studioCaptionPhrasesRef: CaptionPhrase[] = [];
	let studioCaptionTime = $state(0);
	let studioCaptionPhrase = $state<CaptionPhrase | null>(null);
	let studioCaptionWordIndex = $state(-1);
	let studioCaptionRaf: number | null = null;
	let studioCaptionLastPhraseKey = '';
	let studioCaptionLastWordIdx = -1;
	/** Per-slide captions from Bulk → Studio handoff. */
	let bulkCaptionsBySlide = $state<(StudioClipCaptionImport | null)[]>([]);

	function applyStudioCaptionsPayload(caps: StudioClipCaptionImport | null | undefined) {
		if (caps?.enabled && Array.isArray(caps.segments) && caps.segments.length) {
			studioClipCaptions = caps;
			const tpl = getCaptionTemplate(caps.templateId);
			const chunk = caps.wordsPerChunk ?? tpl.wordsPerChunk;
			const phrases = segmentsToPhrases(caps.segments, chunk);
			studioCaptionPhrases = phrases;
			studioCaptionPhrasesRef = phrases;
			studioCaptionPhrase = null;
			studioCaptionWordIndex = -1;
			studioCaptionTime = 0;
		} else {
			studioClipCaptions = null;
			studioCaptionPhrases = [];
			studioCaptionPhrasesRef = [];
			studioCaptionPhrase = null;
			studioCaptionWordIndex = -1;
		}
	}

	// News controls
	let search = $state('');
	// Fill-in-text uses the same topic input (`search`) as Generate/Fetch.
	let category = $state('general');
	/** Sidebar mode for the News template generator: live articles vs synthetic fact/story/steps. */
	type NewsStudioContentMode = 'general' | 'news' | 'fact' | 'story' | 'quote' | 'steps';
	let newsContentMode = $state<NewsStudioContentMode>('general');
	/** How Load & Fill fills backgrounds in News studio (News / fact / story / quote / steps). */
	type NewsImageSourceMode = 'assets' | 'pull' | 'ai';
	let newsImageSourceMode = $state<NewsImageSourceMode>('assets');
	/** When stock source is active: still photos (default) vs Pexels videos. */
	type StockMediaKind = 'photo' | 'video';
	let stockMediaKind = $state<StockMediaKind>('photo');
	/** Pushed into the assets sidebar search when Generate runs. */
	let assetsSidebarSeedQuery = $state('');
	/** Increments on each Generate seed so the sidebar re-runs even for the same query. */
	let assetsSidebarSeedNonce = $state(0);
	/** Whether to generate/pull images at all (when off, only text is generated). */
	let newsGenerateImages = $state(true);
	type NewsCopyLength = 'default' | 'standard' | 'short';
	let newsCopyLength = $state<NewsCopyLength>('default');
	let studioAudienceId = $state('');
	let studioAudienceCustom = $state('');
	let studioStyle = $state<BulkStyleId>('editorial');
	let studioEmotion = $state<BulkEmotionId>('inspiring');
	const studioAudiencePrompt = $derived(audiencePromptText(studioAudienceId, studioAudienceCustom));
	const studioAudienceChipLabel = $derived.by(() => {
		if (studioAudienceId === 'custom') {
			return studioAudienceCustom.trim() || 'Custom audience';
		}
		return BULK_AUDIENCES.find((a) => a.id === studioAudienceId)?.label ?? 'Audience';
	});
	const studioStyleLabel = $derived(
		BULK_STYLES.find((s) => s.id === studioStyle)?.label ?? 'Style',
	);
	const studioEmotionLabel = $derived(
		studioEmotion === ''
			? 'Any'
			: (BULK_EMOTIONS.find((e) => e.id === studioEmotion)?.label ?? 'Inspiring'),
	);
	function studioGenerationTonePayload() {
		return {
			audience: studioAudiencePrompt || undefined,
			emotion: studioEmotion || undefined,
			style: studioStyle,
		};
	}

	let studioDraftWasRestored = $state(false);

	function applyStudioComposePrefs(prefs: StudioComposePrefs) {
		formatId = normalizeStudioFormatId(prefs.formatId);
		/* Prompt text is session-only — refresh clears it (history keeps past queries). */
		search = '';
		category = prefs.category;
		newsContentMode = prefs.newsContentMode;
		newsImageSourceMode = prefs.newsImageSourceMode;
		stockMediaKind = prefs.stockMediaKind;
		newsCopyLength = prefs.newsCopyLength;
		studioAudienceId = prefs.studioAudienceId;
		studioAudienceCustom = prefs.studioAudienceCustom;
		studioStyle = prefs.studioStyle;
		studioEmotion = prefs.studioEmotion;
		slideCount = prefs.slideCount;
		storyCategory = prefs.storyCategory;
		factTopicCategory = prefs.factTopicCategory;
		quoteTopicCategory = prefs.quoteTopicCategory;
		stepsCount = prefs.stepsCount;
		factTopicPrompt = '';
		storyTopicPrompt = '';
		quoteTopicPrompt = '';
		stepsTopicPrompt = '';
		generalTopicPrompt = '';
	}

	function placeholderCopyForWordBudget(): string {
		const kind = selectedText;
		const tpl = previewTemplate;
		if (kind === 'headline') return NEWS_PLACEHOLDER_HEADLINE;
		if (kind === 'newsSubtext') return NEWS_DEFAULT_SUBTEXT;
		if (kind === 'source') return NEWS_DEFAULT_SOURCE;
		if (kind === 'tweetTopText') return TWEET_DEFAULTS.topText;
		if (kind === 'tweetBottomText') return TWEET_DEFAULTS.bottomText;
		if (kind === 'articleBody') return ARTICLE_DEFAULT_BODY;
		if (kind === 'textCarouselBody') return TEXT_CAROUSEL_DEFAULTS.body;
		if (kind === 'blackTextHeadline') return BLACK_TEXT_CAROUSEL_DEFAULTS.headline;
		if (kind === 'blackTextBody') return BLACK_TEXT_CAROUSEL_DEFAULTS.body;
		if (kind === 'videoStoryHeadline') {
			if (tpl === 'videoHook') return VIDEO_HOOK_DEFAULTS.headline;
			if (tpl === 'videoCreator') return VIDEO_CREATOR_DEFAULTS.headline;
			if (tpl === 'videoText') return VIDEO_TEXT_DEFAULTS.headline;
			if (tpl === 'videoSource') return VIDEO_SOURCE_DEFAULTS.headline;
			if (tpl === 'videoFeature') return VIDEO_FEATURE_DEFAULTS.headline;
			if (tpl === 'videoPost') return VIDEO_POST_DEFAULTS.headline;
			if (tpl === 'brandStack') return BRAND_STACK_DEFAULTS.headline;
			if (tpl === 'photoTopic') return PHOTO_TOPIC_DEFAULTS.headline;
			if (tpl === 'photoCaption') return PHOTO_CAPTION_DEFAULTS.headline;
			return VIDEO_STORY_DEFAULTS.headline;
		}
		if (kind === 'imageQuoteFooterLeft') return IMAGE_QUOTE_DEFAULTS.footerLeft;
		if (kind === 'imageQuoteFooterRight') return IMAGE_QUOTE_DEFAULTS.footerRight;
		switch (tpl) {
			case 'tweet':
				return TWEET_DEFAULTS.topText;
			case 'article':
				return ARTICLE_DEFAULT_BODY;
			case 'textCarousel':
				return TEXT_CAROUSEL_DEFAULTS.body;
			case 'imageQuote':
				return IMAGE_QUOTE_DEFAULTS.body;
			case 'videoStory':
				return VIDEO_STORY_DEFAULTS.headline;
			case 'videoHook':
				return VIDEO_HOOK_DEFAULTS.headline;
			case 'videoCreator':
				return VIDEO_CREATOR_DEFAULTS.headline;
			case 'videoText':
				return VIDEO_TEXT_DEFAULTS.headline;
			case 'videoSource':
				return VIDEO_SOURCE_DEFAULTS.headline;
			case 'videoFeature':
				return VIDEO_FEATURE_DEFAULTS.headline;
			case 'videoPost':
				return VIDEO_POST_DEFAULTS.headline;
			case 'brandStack':
				return BRAND_STACK_DEFAULTS.headline;
			case 'photoTopic':
				return PHOTO_TOPIC_DEFAULTS.headline;
			case 'photoCaption':
				return PHOTO_CAPTION_DEFAULTS.body;
			case 'whiteThread':
				return WHITE_THREAD_DEFAULTS.body;
			case 'whiteMedia':
				return WHITE_MEDIA_DEFAULTS.body;
			case 'blackText':
				return BLACK_TEXT_CAROUSEL_DEFAULTS.body;
			case 'news':
				/* Default word budget = paragraph placeholder (not the short headline). */
				return NEWS_DEFAULT_SUBTEXT;
			default:
				return NEWS_DEFAULT_SUBTEXT;
		}
	}

	function countPlainWords(text: string): number {
		return stripMarkup(String(text ?? ''))
			.replace(/\s+/g, ' ')
			.trim()
			.split(' ')
			.filter(Boolean).length;
	}

	/** Live on-canvas copy for the Default word-budget chip (prefer what the user already has). */
	function liveCopyForWordBudget(): string {
		const kind = selectedText;
		const tpl = previewTemplate;
		const si = activeSlide;
		if (kind === 'headline') return readSlidePrimary(tpl, si);
		if (kind === 'newsSubtext') return readSlideBody('news', si);
		if (kind === 'tweetTopText') return String(tweetTopTextBySlide[si] ?? '').trim();
		if (kind === 'tweetBottomText') return String(tweetBottomTextBySlide[si] ?? '').trim();
		if (kind === 'articleBody') return String(articleTextBySlide[si] ?? '').trim();
		if (kind === 'textCarouselBody') return String(textCarouselTextBySlide[si] ?? '').trim();
		if (kind === 'blackTextHeadline') return String(blackTextHeadlineBySlide[si] ?? '').trim();
		if (kind === 'blackTextBody') return String(blackTextBodyBySlide[si] ?? '').trim();
		if (kind === 'videoStoryHeadline') return String(videoStoryHeadlineBySlide[si] ?? '').trim();
		if (kind === 'imageQuoteFooterLeft') return String(imageQuoteFooterLeftBySlide[si] ?? '').trim();
		if (kind === 'imageQuoteFooterRight') return String(imageQuoteFooterRightBySlide[si] ?? '').trim();
		if (kind === 'textOverlay' && selectedTextOverlayId) {
			const ov = ((slideTextOverlaysByTemplate[tpl] ?? [])[si] ?? []).find(
				(o) => o.id === selectedTextOverlayId,
			);
			return String(ov?.text ?? '').trim();
		}
		/* No field selected — match the template’s body/paragraph when present (not the hook). */
		const body = readSlideBody(tpl, si);
		if (body) return body;
		if (tpl === 'textCarousel' || isWhitePostFamily(tpl)) {
			return String(textCarouselTextBySlide[si] ?? '').trim();
		}
		return readSlidePrimary(tpl, si);
	}

	const studioHeadlineMaxWords = $derived.by(() => {
		if (newsCopyLength === 'short') return 10;
		if (newsCopyLength === 'standard') return 16;
		/* Default = SoftBank-length headline (not the body budget). */
		const n = countPlainWords(NEWS_PLACEHOLDER_HEADLINE);
		return Math.max(6, Math.min(24, n || 12));
	});

	/** Body / paragraph budget (News subtext, carousel, etc.). Default = placeholder — never live-inflated. */
	const studioBodyMaxWords = $derived.by(() => {
		if (newsCopyLength === 'short') return 18;
		if (newsCopyLength === 'standard') return 28;
		const tpl = previewTemplate;
		const sample =
			tpl === 'news'
				? NEWS_DEFAULT_SUBTEXT
				: tpl === 'textCarousel' || isWhitePostFamily(tpl)
					? TEXT_CAROUSEL_DEFAULTS.body
					: tpl === 'blackText' || isPhotoStoryFamily(tpl)
						? BLACK_TEXT_CAROUSEL_DEFAULTS.body
						: tpl === 'imageQuote'
							? IMAGE_QUOTE_DEFAULTS.body
							: placeholderCopyForWordBudget();
		const n = countPlainWords(sample);
		const floor =
			tpl === 'textCarousel' || isWhitePostFamily(tpl) ? TEXT_CAROUSEL_DEFAULT_BODY_WORDS : 6;
		return Math.max(floor, Math.min(80, n || 24));
	});

	/** Chip label: field-aware when a slot is selected; otherwise body budget. */
	const studioMaxWords = $derived.by(() => {
		const kind = selectedText;
		const isHeadlineKind =
			kind === 'headline' ||
			kind === 'blackTextHeadline' ||
			kind === 'videoStoryHeadline' ||
			kind === 'tweetTopText';
		if (newsCopyLength === 'short') return isHeadlineKind ? 10 : 18;
		if (newsCopyLength === 'standard') return isHeadlineKind ? 16 : 28;
		if (isHeadlineKind) {
			return studioHeadlineMaxWords;
		}
		return studioBodyMaxWords;
	});

	const studioDefaultWordBudgetLabel = $derived.by(() => {
		const kind = selectedText;
		const isHeadlineKind =
			kind === 'headline' ||
			kind === 'blackTextHeadline' ||
			kind === 'videoStoryHeadline' ||
			kind === 'tweetTopText';
		if (isHeadlineKind) return `Match placeholder — ${studioMaxWords} words`;
		const tpl = previewTemplate;
		if (tpl === 'textCarousel' || isWhitePostFamily(tpl)) {
			const paras = textCarouselBudgetFromMaxWords(studioBodyMaxWords).paragraphCount;
			const paraLabel =
				paras === 1 ? 'One paragraph' : paras === 2 ? 'Two paragraphs' : `${paras} paragraphs`;
			return `${paraLabel} · up to ${studioMaxWords} words`;
		}
		return `Match placeholder — ${studioMaxWords} words`;
	});

	function studioStockQuery(): string {
		// Match the prompt bar binding for the active mode — never prefer a stale
		// News keyword (`search`) when General/Fact/etc. is showing a different box.
		if (newsContentMode === 'general') {
			const t = String(generalTopicPrompt ?? '').trim();
			if (t) return t.slice(0, 80);
		} else if (newsContentMode === 'fact') {
			const t = String(factTopicPrompt ?? '').trim();
			if (t) return t.slice(0, 80);
		} else if (newsContentMode === 'story') {
			const t = String(storyTopicPrompt ?? '').trim();
			if (t) return t.slice(0, 80);
		} else if (newsContentMode === 'quote') {
			const t = String(quoteTopicPrompt ?? '').trim();
			if (t) return t.slice(0, 80);
		} else if (newsContentMode === 'steps') {
			const t = String(stepsTopicPrompt ?? '').trim();
			if (t) return t.slice(0, 80);
		} else if (newsContentMode === 'news') {
			const bar = String(search ?? '').trim();
			if (bar) return bar.slice(0, 80);
		}
		const title = String(articleTitle ?? '').trim();
		if (title) return title.slice(0, 80);
		return 'editorial photo';
	}

	/** Match applyStockUrlsToSlides — video templates always prefer Pexels video. */
	function preferStockVideoForTemplate(template: TemplateId): boolean {
		return (
			templateUsesStockVideo(template) ||
			((template === 'news' || template === 'blank' || template === 'tweet') &&
				stockMediaKind === 'video')
		);
	}

	/** Explicit kind last pushed into the assets sidebar (set on Generate). */
	let assetsSidebarSeedPexelsKind = $state<'photos' | 'videos'>('photos');

	function seedAssetsSidebarSearch(
		query = studioStockQuery(),
		opts?: { preferVideo?: boolean },
	) {
		const q = String(query ?? '').trim();
		if (!q) return;
		const preferVideo = opts?.preferVideo ?? preferStockVideoForTemplate(previewTemplate);
		assetsSidebarSeedQuery = q;
		assetsSidebarSeedPexelsKind = preferVideo ? 'videos' : 'photos';
		/* Bump so the sidebar re-fills even when the query string is unchanged. */
		assetsSidebarSeedNonce += 1;
		if (preferVideo && stockMediaKind !== 'video') {
			stockMediaKind = 'video';
		}
	}

	let stockPool: StockPick[] = [];
	let stockPoolKey = '';
	let stockPoolCursor = 0;
	/** Per refined search string — reused across slides with the same LLM query. */
	const stockPoolsByQuery = new Map<string, StockPick[]>();

	function stockBodyForSlide(template: TemplateId, slideIdx: number): string {
		if (template === 'news') return String(newsSubtextBySlide[slideIdx] ?? '').trim();
		if (template === 'blackText') return String(blackTextBodyBySlide[slideIdx] ?? '').trim();
		return '';
	}

	function pickFromStockPool(pool: StockPick[], preferVideo: boolean, offset = 0): StockPick | null {
		if (!pool.length) return null;
		const base = ((offset % pool.length) + pool.length) % pool.length;
		for (let k = 0; k < pool.length; k++) {
			const pick = pool[(base + k) % pool.length]!;
			if (preferVideo) {
				if (pick.kind === 'video') return pick;
			} else if (pick.kind === 'image') {
				return pick;
			}
		}
		return pool[base] ?? null;
	}

	async function applyStockUrlsToSlides(
		template: TemplateId,
		slideIdxs: number[],
		query: string,
	) {
		const preferVideo = preferStockVideoForTemplate(template);
		const topicHint = query.trim() || studioStockQuery();
		const plan = await resolveStockSearchQueries({
			topic: topicHint,
			kind: preferVideo ? 'video' : 'photo',
			slides: slideIdxs.map((slideIdx) => ({
				headline: stripHighlightMarkers(primarySlideTextForPrompt(template, slideIdx)),
				body: stockBodyForSlide(template, slideIdx),
			})),
		});
		const deckQuery = plan.query.trim() || topicHint || 'editorial photo';
		seedAssetsSidebarSearch(deckQuery, { preferVideo });

		const queryBySlide = slideIdxs.map(
			(_, i) => String(plan.queries[i] ?? plan.queries[0] ?? deckQuery).trim() || deckQuery,
		);
		const uniqueQueries = [...new Set(queryBySlide)];
		await Promise.all(
			uniqueQueries.map(async (q) => {
				const poolKey = `${q}::${preferVideo ? 'video' : 'photo'}`;
				if (stockPoolsByQuery.has(poolKey) && (stockPoolsByQuery.get(poolKey)?.length ?? 0) > 0) {
					return;
				}
				const pool = preferVideo
					? await fetchStockMediaPool(q, Math.max(24, slideIdxs.length))
					: await fetchStockImagePool(q, Math.max(24, slideIdxs.length));
				stockPoolsByQuery.set(poolKey, pool);
				if (q === deckQuery) {
					stockPool = pool;
					stockPoolKey = poolKey;
					if (slideIdxs.length !== 1) stockPoolCursor = 0;
				}
			}),
		);

		const start = slideIdxs.length === 1 ? stockPoolCursor : 0;
		const picks = slideIdxs.map((_, i) => {
			const q = queryBySlide[i]!;
			const poolKey = `${q}::${preferVideo ? 'video' : 'photo'}`;
			const pool = stockPoolsByQuery.get(poolKey) ?? stockPool;
			return pickFromStockPool(pool, preferVideo, start + i);
		});
		if (stockPool.length && slideIdxs.length === 1) {
			stockPoolCursor = (start + slideIdxs.length) % stockPool.length;
		}
		const imageFallback =
			picks.find((p) => p?.kind === 'image') ??
			stockPool.find((p) => p.kind === 'image') ??
			null;
		await Promise.all(
			slideIdxs.map(async (slideIdx, i) => {
				const pick = picks[i];
				if (!pick?.url) {
					setBgGeneratingFlag(template, slideIdx, false);
					return;
				}
				if (pick.kind === 'video' && preferVideo) {
					try {
						if (template === 'news' || template === 'blank') applyNewsSeedBackgroundLayout();
						const blobUrl = await fetchRemoteVideoAsBlobUrl(pick.url);
						setSlideVideo(slideIdx, blobUrl, template);
						const dur = Number(pick.duration ?? 0);
						if (Number.isFinite(dur) && dur > 0) {
							videoDurationBySlide = Array.from({ length: slides.length }, (_, idx) =>
								idx === slideIdx ? dur : (Number.isFinite(videoDurationBySlide[idx]) ? Math.max(0, videoDurationBySlide[idx]) : 0),
							);
							videoTrimEndSecBySlide = Array.from({ length: slides.length }, (_, idx) =>
								idx === slideIdx ? dur : (Number.isFinite(videoTrimEndSecBySlide[idx]) ? Math.max(0, videoTrimEndSecBySlide[idx]) : 0),
							);
							videoTrimStartSecBySlide = Array.from({ length: slides.length }, (_, idx) =>
								idx === slideIdx ? 0 : (Number.isFinite(videoTrimStartSecBySlide[idx]) ? Math.max(0, videoTrimStartSecBySlide[idx]) : 0),
							);
						}
						return;
					} catch {
						/* video proxy failed — fall through to a still */
					}
					const still = imageFallback;
					if (!still?.url) {
						setBgGeneratingFlag(template, slideIdx, false);
						return;
					}
					const safeVidFallback = await toExportSafeImageUrl(still.url);
					if (String(safeVidFallback ?? '').trim()) {
						setSlideImage(slideIdx, safeVidFallback, template);
					} else {
						setBgGeneratingFlag(template, slideIdx, false);
					}
					return;
				}
				const imagePick = pick.kind === 'image' ? pick : imageFallback;
				if (!imagePick?.url) {
					setBgGeneratingFlag(template, slideIdx, false);
					return;
				}
				if (imagePick.source === 'unsplash' && imagePick.downloadLocation) {
					void fetch('/api/unsplash/download', {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({ downloadLocation: imagePick.downloadLocation }),
					}).catch(() => {});
				}
				const safe = await toExportSafeImageUrl(imagePick.url);
				if (String(safe ?? '').trim()) {
					setSlideImage(slideIdx, safe, template);
				} else {
					setBgGeneratingFlag(template, slideIdx, false);
				}
			}),
		);
	}

	let circleStockPool: StockPick[] = [];
	let circleStockPoolKey = '';

	/** True when the circle URL is missing or still the finance placeholder badge. */
	function isUnsetCircleImage(url: string): boolean {
		const u = String(url ?? '').trim();
		if (!u) return true;
		if (u === NEWS_DEFAULT_CIRCLE_IMAGE) return true;
		if (u.includes('/placeholders/news/circle-default')) return true;
		return false;
	}

	/** Visual search string for the circle badge — headline + topic only (body can derail stock). */
	function circleSearchContext(slideIdx: number): { headline: string; topic: string; prompt: string } {
		const headline = stripHighlightMarkers(primarySlideTextForPrompt('news', slideIdx))
			.replace(/\s+/g, ' ')
			.trim();
		const topic = studioStockQuery().replace(/\s+/g, ' ').trim();
		const sub = String(newsSubtextBySlide[slideIdx] ?? '')
			.replace(/\s+/g, ' ')
			.trim()
			.slice(0, 120);
		const promptBits = [headline || topic, topic && topic.toLowerCase() !== headline.toLowerCase() ? topic : '']
			.filter(Boolean)
			.join(' — ');
		return {
			headline,
			topic,
			prompt:
				promptBits ||
				sub ||
				String(articleTitle ?? '').trim() ||
				'editorial close-up subject',
		};
	}

	async function applyStockCircleImage(slideIdx: number, query?: string): Promise<boolean> {
		const { headline, topic } = circleSearchContext(slideIdx);
		let q = String(query ?? '').trim();
		if (!q) {
			const plan = await resolveStockSearchQueries({
				topic: topic || studioStockQuery(),
				kind: 'circle',
				slides: [{ headline, body: '' }],
			});
			q = plan.queries[0] || plan.circleQuery || plan.query;
		}
		q =
			q.trim() ||
			stockQueryFromSlide(headline, '', topic || studioStockQuery()) ||
			'editorial portrait close up';
		const poolKey = `circle::${q}`;
		if (circleStockPoolKey !== poolKey || circleStockPool.length < 1) {
			circleStockPool = await fetchStockCircleImagePool(q, Math.max(8, slides.length));
			circleStockPoolKey = poolKey;
		}
		if (!circleStockPool.length) return false;
		const pick = circleStockPool[slideIdx % circleStockPool.length]!;
		if (pick.source === 'unsplash' && pick.downloadLocation) {
			void fetch('/api/unsplash/download', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ downloadLocation: pick.downloadLocation }),
			}).catch(() => {});
		}
		const safe = await toExportSafeImageUrl(pick.url);
		if (!String(safe ?? '').trim()) return false;
		const n = Math.max(slides.length, slideIdx + 1);
		circleImages = Array.from({ length: n }, (_, i) => (i === slideIdx ? safe : (circleImages[i] ?? '')));
		return true;
	}

	async function applyStockCircleImages(idxs: number[], query?: string) {
		if (!idxs.length) return;
		const topicHint = String(query ?? '').trim() || studioStockQuery();
		const plan = await resolveStockSearchQueries({
			topic: topicHint,
			kind: 'circle',
			slides: idxs.map((slideIdx) => {
				const { headline } = circleSearchContext(slideIdx);
				return { headline, body: '' };
			}),
		});
		for (let i = 0; i < idxs.length; i++) {
			const q =
				String(plan.queries[i] ?? '').trim() ||
				plan.circleQuery ||
				plan.query ||
				topicHint;
			const ok = await applyStockCircleImage(idxs[i]!, q);
			if (!ok) {
				await generateCircleImage(idxs[i]!, true);
			}
		}
	}

	async function fillNewsCircleImages(idxs: number[], skipVertexCache = false) {
		if (!idxs.length) return;
		if (newsImageSourceMode === 'assets') {
			await applyStockCircleImages(idxs);
			return;
		}
		await new Promise<void>((r) => setTimeout(r, 500));
		for (let k = 0; k < idxs.length; k++) {
			await generateCircleImage(idxs[k], skipVertexCache);
			if (k < idxs.length - 1) {
				await new Promise<void>((r) => setTimeout(r, 350));
			}
		}
	}

	let storyCategory = $state('health');
	/** Natural-language request for General mode — e.g. "Make me a carousel of beds". */
	let generalTopicPrompt = $state('');
	/** Sent to /api/news as syntheticHint when Random fact is selected. */
	let factTopicPrompt = $state('');
	let factTopicCategory = $state('any');
	/** Sent to /api/news as syntheticHint with the story theme when Random story is selected. */
	let storyTopicPrompt = $state('');
	/** Sent to /api/news as syntheticHint when Quote is selected. */
	let quoteTopicPrompt = $state('');
	let quoteTopicCategory = $state('any');
	/** Steps / listicle: topic prompt + how many numbered steps (deck = hook + N + CTA). */
	let stepsTopicPrompt = $state('');
	let stepsCount = $state(5);
	/** Recent Generate queries (local) — titles only, no images. */
	let promptHistory = $state<StudioPromptHistoryEntry[]>([]);
	let promptHistoryOpen = $state(false);
	let slideCount = $state(DEFAULT_STUDIO_SLIDE_COUNT); // 1–6

	function activeSyntheticQuery(): string {
		if (newsContentMode === 'general') return generalTopicPrompt.trim();
		if (newsContentMode === 'fact') {
			const label =
				factTopicCategory !== 'any'
					? factTopics.find((t) => t.id === factTopicCategory)?.label ?? ''
					: '';
			return [label, factTopicPrompt.trim()].filter(Boolean).join(': ');
		}
		if (newsContentMode === 'story') return storyTopicPrompt.trim();
		if (newsContentMode === 'quote') {
			const label =
				quoteTopicCategory !== 'any'
					? factTopics.find((t) => t.id === quoteTopicCategory)?.label ?? ''
					: '';
			return [label, quoteTopicPrompt.trim()].filter(Boolean).join(': ');
		}
		if (newsContentMode === 'steps') return stepsTopicPrompt.trim();
		if (newsContentMode === 'news') return search.trim();
		return '';
	}

	/** Typed prompt text for the active mode (chips alone don’t count). */
	const promptFieldText = $derived.by(() => {
		if (newsContentMode === 'general') return generalTopicPrompt.trim();
		if (newsContentMode === 'news') return search.trim();
		if (newsContentMode === 'fact') return factTopicPrompt.trim();
		if (newsContentMode === 'quote') return quoteTopicPrompt.trim();
		if (newsContentMode === 'steps') return stepsTopicPrompt.trim();
		if (newsContentMode === 'story') return storyTopicPrompt.trim();
		return '';
	});

	/** Generate needs a typed prompt before submit is enabled. */
	const promptReadyToGenerate = $derived(promptFieldText.length > 0);
	const promptBusy = $derived(fetchingNews || studioGenerating);
	/** Busy or empty prompt — usage limit stays clickable so it can open the upgrade popup. */
	const promptSubmitDisabled = $derived(promptBusy || (!usageBlocked && !promptReadyToGenerate));

	function submitPromptIfReady() {
		if (promptBusy) return;
		if (usageBlocked) {
			openUsageUpgrade();
			return;
		}
		if (!promptReadyToGenerate) return;
		void loadAndFill();
	}

	function refreshPromptHistory() {
		if (!userId) {
			promptHistory = [];
			return;
		}
		promptHistory = loadPromptHistory(userId);
	}

	function recordPromptHistoryRun(query: string, title: string) {
		if (!userId || !query.trim()) return;
		promptHistory = pushPromptHistory(userId, {
			query: query.trim().slice(0, 600),
			mode: newsContentMode,
			title: title.trim().slice(0, 160),
		});
	}

	function applyPromptHistoryEntry(entry: StudioPromptHistoryEntry) {
		newsContentMode = entry.mode;
		const q = entry.query;
		if (entry.mode === 'general') generalTopicPrompt = q;
		else if (entry.mode === 'news') search = q;
		else if (entry.mode === 'fact') factTopicPrompt = q;
		else if (entry.mode === 'story') storyTopicPrompt = q;
		else if (entry.mode === 'quote') quoteTopicPrompt = q;
		else if (entry.mode === 'steps') stepsTopicPrompt = q;
		promptHistoryOpen = false;
	}

	function parseStepsCountFromPrompt(prompt: string, fallback: number): number {
		const m = String(prompt ?? '').match(
			/(?:^|\b)(\d{1,2})\s*(?:steps?|ways|tips|habits|rules|things)\b/i,
		);
		if (m) {
			const n = Number(m[1]);
			if (Number.isFinite(n)) return Math.max(3, Math.min(8, Math.floor(n)));
		}
		return Math.max(3, Math.min(8, Math.floor(fallback) || 5));
	}
	function stepsDeckLength(stepCount: number): number {
		return Math.max(3, Math.min(MAX_STUDIO_SLIDE_COUNT, Math.max(3, Math.min(8, stepCount)) + 2));
	}

	// Preview/edit view toggle for the canvas area.
	let fetchingNews = $state(false);
	/** Stays true for the whole Generate / Load & Fill run so the canvas skeleton does not flicker between steps. */
	let studioGenerating = $state(false);

	/** Free-plan carousel quota — null until first refresh. */
	let usageCanGenerate = $state<boolean | null>(null);
	let usageRemaining = $state<number | null>(null);
	let usageUsed = $state(0);
	let usageLimit = $state<number | null>(5);
	let usageUpgradeOpen = $state(false);
	let usageUpgradeMessage = $state('');

	const usageBlocked = $derived(usageCanGenerate === false);

	async function refreshStudioUsage() {
		try {
			const s = await refreshUsageStatus();
			if (!s.signedIn) {
				usageCanGenerate = false;
				return;
			}
			usageCanGenerate = s.canGenerate !== false;
			usageRemaining = s.remaining ?? null;
			usageUsed = typeof s.used === 'number' ? s.used : usageUsed;
			usageLimit = s.limit === undefined ? usageLimit : s.limit;
		} catch {
			/* keep last known */
		}
	}

	function openUsageUpgrade(message?: string) {
		usageUpgradeMessage =
			message?.trim() ||
			(usageLimit != null
				? `You've used ${usageUsed}/${usageLimit} carousel${usageLimit === 1 ? '' : 's'} this month. Upgrade for more.`
				: `You've hit this month's carousel limit. Upgrade for more.`);
		usageUpgradeOpen = true;
		usageCanGenerate = false;
	}

	function closeUsageUpgrade() {
		usageUpgradeOpen = false;
	}

	/** Portaled to `document.body` so the dimmer sits above dock (z-200) + FloatingActions. */
	let usageUpgradeEl = $state<HTMLDivElement | null>(null);
	$effect(() => {
		const el = usageUpgradeEl;
		if (!el || typeof document === 'undefined') return;
		document.body.appendChild(el);
		return () => {
			el.remove();
		};
	});

	function isUsageLimitError(res: Response, data: { code?: string; error?: string } | null) {
		if (res.status === 402) return true;
		const code = String(data?.code ?? '');
		if (code === 'LIMIT_REACHED') return true;
		const err = String(data?.error ?? '');
		return /upgrade for more|used \d+\/\d+ carousel/i.test(err);
	}
	let generatingVariants = $state(false);
	/** Keeps the full-canvas loader up for one paint flush after Vertex flags drop (avoids a one-frame flash). */
	let studioImageGenPaintHold = $state(false);
	/** True while downloading / decoding a background video onto the canvas. */
	let backgroundMediaLoading = $state(false);
	/** >0 while `generateAllSlideImages` / `refreshNewsDeckImagesAfterFetch` run (skip per-slide paint hold). */
	let studioImageGenBatchDepth = 0;
	let newsError = $state('');

	// Multi-slide state
	let slides = $state<string[]>(emptySlides(() => ''));
	let activeSlide = $state(0);
	/** Optional brand follow slide — saved globally, appended as last slide when enabled. */
	let brandCta = $state<BrandCtaSettings>({ ...DEFAULT_BRAND_CTA });
	let brandCtaEnabled = $state(false);
	let editingBrandCta = $state(false);
	let exportingBrandCta = $state(false);
	let brandCtaSavedNote = $state('');
	let brandCtaImageInput = $state<HTMLInputElement | null>(null);
	/** When set, main canvas renders this slide for PNG capture without changing `activeSlide` (no UI “slide show”). */
	let canvasRasterSlide = $state<number | null>(null);
	let articleSnippet = $state(''); // full article text for variants call

	// ── Per-slide template selection (ids + labels live in `$lib/studio`) ──
	type TemplateDef = StudioTemplateDef;
	const TEMPLATES: TemplateDef[] = STUDIO_TEMPLATES;
	/** Options for the floating template dock (dropdown). Legacy templates omitted from `STUDIO_TEMPLATES` but injected when a slide still uses them. Saved templates appear under their base type (e.g. News). */
	const templateDockTabs = $derived.by(() => {
		const savedByBase = new Map<TemplateId, SavedStudioTemplateMeta[]>();
		for (const row of savedStudioTemplates) {
			const list = savedByBase.get(row.baseTemplate) ?? [];
			list.push(row);
			savedByBase.set(row.baseTemplate, list);
		}
		const curSavedId = String(savedTemplateIdBySlide[activeSlide] ?? '').trim();
		if (
			curSavedId &&
			!savedStudioTemplates.some((s) => s.id === curSavedId)
		) {
			const base = coerceTemplateId(slideTemplates[activeSlide]);
			const list = savedByBase.get(base) ?? [];
			list.push({
				id: curSavedId,
				name: String(savedTemplateNameBySlide[activeSlide] ?? '').trim() || 'Saved template',
				baseTemplate: base,
				updatedAt: '',
			});
			savedByBase.set(base, list);
		}

		const rows: { id: string; label: string; title: string; separatorBefore?: boolean }[] = [];
		for (const t of TEMPLATES) {
			rows.push({
				id: t.id,
				label: t.label,
				title: `${t.label} — all slides`,
			});
			const saved = savedByBase.get(t.id) ?? [];
			for (const s of saved) {
				rows.push({
					id: `saved:${s.id}`,
					label: s.name,
					title: `${s.name} — saved layout`,
					separatorBefore: saved.indexOf(s) === 0,
				});
			}
		}

		const cur = slideTemplates[activeSlide];
		const legacy: TemplateDef[] = [];
		if (cur === 'article' && !rows.some((r) => r.id === 'article')) {
			legacy.push({ id: 'article', label: 'Article' });
		}
		if (cur === 'photoTopic' && !rows.some((r) => r.id === 'photoTopic')) {
			legacy.push({ id: 'photoTopic', label: 'Topic card' });
		}
		if (cur === 'videoSplit' && !rows.some((r) => r.id === 'videoSplit')) {
			legacy.push({ id: 'videoSplit', label: 'Multi split' });
		}
		if (cur === 'brandStack' && !rows.some((r) => r.id === 'brandStack')) {
			legacy.push({ id: 'brandStack', label: 'Brand stack' });
		}
		if (cur === 'videoBlur' && !rows.some((r) => r.id === 'videoBlur')) {
			legacy.push({ id: 'videoBlur', label: 'Blur' });
		}
		if (cur === 'whiteMedia' && !rows.some((r) => r.id === 'whiteMedia')) {
			legacy.push({ id: 'whiteMedia', label: 'White media' });
		}
		if (cur === 'videoHook' && !rows.some((r) => r.id === 'videoHook')) {
			legacy.push({ id: 'videoHook', label: 'Hook video' });
		}
		if (cur === 'imageQuote' && !rows.some((r) => r.id === 'imageQuote')) {
			legacy.push({ id: 'imageQuote', label: 'Image quote' });
		}
		if (cur === 'whiteThread' && !rows.some((r) => r.id === 'whiteThread')) {
			legacy.push({ id: 'whiteThread', label: 'White thread' });
		}
		if (legacy.length) {
			return [
				...rows,
				...legacy.map((t) => ({
					id: t.id,
					label: t.label,
					title: `${t.label} — all slides`,
				})),
			];
		}
		return rows;
	});
	const templateDockSelectedId = $derived.by(() => {
		const savedId = String(savedTemplateIdBySlide[activeSlide] ?? '').trim();
		if (savedId) return `saved:${savedId}`;
		return activeTemplate;
	});
	let slideTemplates = $state<TemplateId[]>(emptySlides(() => 'blank'));
	let lastTemplateUsed = $state<TemplateId>('news');
	const activeTemplate = $derived(coerceTemplateId(slideTemplates[activeSlide]));

	function defaultDemoVideoForTemplate(t: TemplateId): string {
		switch (t) {
			case 'videoFeature':
				return VIDEO_FEATURE_DEFAULTS.videoUrl;
			case 'videoHook':
				return VIDEO_HOOK_DEFAULTS.videoUrl;
			case 'videoCreator':
				return VIDEO_CREATOR_DEFAULTS.videoUrl;
			case 'videoText':
				return VIDEO_TEXT_DEFAULTS.videoUrl;
			case 'videoSource':
				return VIDEO_SOURCE_DEFAULTS.videoUrl;
			case 'videoPost':
				return VIDEO_POST_DEFAULTS.videoUrl;
			case 'videoSplit':
				return VIDEO_SPLIT_DEFAULTS.videoUrl;
			case 'brandStack':
				return BRAND_STACK_DEFAULTS.topVideoUrl;
			default:
				return VIDEO_STORY_DEFAULTS.videoUrl;
		}
	}

	function defaultDemoPosterForTemplate(t: TemplateId): string {
		switch (t) {
			case 'videoFeature':
				return VIDEO_FEATURE_DEFAULTS.posterUrl;
			case 'videoHook':
				return VIDEO_HOOK_DEFAULTS.posterUrl;
			case 'videoCreator':
				return VIDEO_CREATOR_DEFAULTS.posterUrl;
			case 'videoText':
				return VIDEO_TEXT_DEFAULTS.posterUrl;
			case 'videoSource':
				return VIDEO_SOURCE_DEFAULTS.posterUrl;
			case 'videoPost':
				return VIDEO_POST_DEFAULTS.posterUrl;
			case 'videoSplit':
				return VIDEO_SPLIT_DEFAULTS.posterUrl;
			case 'brandStack':
				return BRAND_STACK_DEFAULTS.posterUrl;
			default:
				return VIDEO_STORY_DEFAULTS.posterUrl;
		}
	}

	/**
	 * Poster for video slides. Never use a demo poster when the slide has a real
	 * (non-demo) video — that painted the wrong still (e.g. coding demo over crypto clip).
	 */
	function resolveVideoPoster(img: string, vid: string, t: TemplateId): string {
		const image = String(img ?? '').trim();
		const video = String(vid ?? '').trim();
		if (image && !isStockOrDemoMediaUrl(image)) return image;
		if (video && isStockOrDemoMediaUrl(video)) return defaultDemoPosterForTemplate(t);
		// Real user video + stale demo poster left in bgImages — ignore the poster.
		if (image && isStockOrDemoMediaUrl(image) && video && !isStockOrDemoMediaUrl(video)) return '';
		if (image) return image;
		return '';
	}

	/** Drop demo posters that were left behind when a real video was applied. */
	function scrubStaleDemoPostersAgainstRealVideos() {
		const keys = Object.keys(bgImagesByTemplate) as TemplateId[];
		let nextImgs: Record<TemplateId, string[]> | null = null;
		for (const t of keys) {
			if (!isVideoStoryFamily(t) && t !== 'brandStack' && t !== 'tweet') continue;
			const imgs = [...(bgImagesByTemplate[t] ?? [])];
			const vids = bgVideosByTemplate[t] ?? [];
			let changed = false;
			for (let i = 0; i < Math.max(imgs.length, vids.length); i++) {
				const img = String(imgs[i] ?? '').trim();
				const vid = String(vids[i] ?? '').trim();
				if (img && isStockOrDemoMediaUrl(img) && vid && !isStockOrDemoMediaUrl(vid)) {
					imgs[i] = '';
					changed = true;
				}
			}
			if (changed) {
				if (!nextImgs) nextImgs = { ...bgImagesByTemplate };
				nextImgs[t] = imgs;
			}
		}
		if (nextImgs) bgImagesByTemplate = nextImgs;
	}

	function ensureTemplateDefaultsForSlide(t: TemplateId, idx: number) {
		// Seed template-specific copy so switching templates from a blank canvas doesn’t look “broken”.
		// Only fills when the target field is empty.
		if (t === 'news') {
			if (!String(slides[idx] ?? '').trim()) {
				const beat =
					fallbackStoryBeats(NEWS_PLACEHOLDER_HEADLINE, NEWS_DEFAULT_SUBTEXT, Math.max(idx + 1, slides.length))[
						idx
					] ?? NEWS_PLACEHOLDER_HEADLINE;
				slides = slides.map((x, i) => (i === idx ? beat : x));
			}
			while (newsSubtextBySlide.length <= idx) {
				newsSubtextBySlide = [...newsSubtextBySlide, ''];
			}
			if (!String(newsSubtextBySlide[idx] ?? '').trim()) {
				const subs = distributeNewsSubtextAcrossSlides(
					NEWS_DEFAULT_SUBTEXT,
					slides,
					Math.max(idx + 1, slides.length),
				);
				newsSubtextBySlide = newsSubtextBySlide.map((x, i) =>
					i === idx ? (subs[idx] ?? NEWS_DEFAULT_SUBTEXT) : x,
				);
			}
			if (isPlaceholderNewsSource(source)) source = defaultNewsSource();
			const newsVids = bgVideosByTemplate.news ?? [];
			const newsImgs = bgImagesByTemplate.news ?? [];
			const hasVid = String(newsVids[idx] ?? '').trim();
			const hasImg = String(newsImgs[idx] ?? '').trim();
			if (!hasVid && !hasImg) {
				const nextVids = Array.from(
					{ length: Math.max(newsVids.length, idx + 1, slides.length) },
					(_, i) =>
						String(newsVids[i] ?? '').trim()
							? String(newsVids[i])
							: i === idx
								? NEWS_DEMO_VIDEO
								: '',
				);
				const nextImgs = Array.from(
					{ length: Math.max(newsImgs.length, idx + 1, slides.length) },
					(_, i) => (i === idx ? '' : String(newsImgs[i] ?? '')),
				);
				bgVideosByTemplate = { ...bgVideosByTemplate, news: nextVids };
				bgImagesByTemplate = { ...bgImagesByTemplate, news: nextImgs };
			}
			while (circleImages.length <= idx) {
				circleImages = [...circleImages, ''];
			}
			while (showCircleBySlide.length <= idx) {
				showCircleBySlide = [...showCircleBySlide, false];
			}
			if (!String(circleImages[idx] ?? '').trim() && (showCircleBySlide[idx] || idx === 0)) {
				circleImages = circleImages.map((x, i) =>
					i === idx ? NEWS_DEFAULT_CIRCLE_IMAGE : x,
				);
			}
			return;
		}
		if (t === 'tweet') {
			ensureTweetSlideProfileDefaults(idx);
			if (!String(tweetTopTextBySlide[idx] ?? '').trim()) {
				tweetTopTextBySlide = tweetTopTextBySlide.map((x, i) => (i === idx ? TWEET_DEFAULTS.topText : x));
			}
			if (!String(tweetBottomTextBySlide[idx] ?? '').trim()) {
				tweetBottomTextBySlide = tweetBottomTextBySlide.map((x, i) =>
					i === idx ? TWEET_DEFAULTS.bottomText : x,
				);
			}
			return;
		}
		if (t === 'textCarousel') {
			const cur = String(textCarouselTextBySlide[idx] ?? '').trim();
			if (!cur) {
				textCarouselTextBySlide = textCarouselTextBySlide.map((x, i) =>
					i === idx ? TEXT_CAROUSEL_DEFAULTS.body : x,
				);
			} else if (newsCopyLength === 'default') {
				// Only pad to the airy default length when the word-count chip is Default.
				const ensured = ensureTextCarouselBodyMinLength(cur);
				if (ensured !== (textCarouselTextBySlide[idx] ?? '')) {
					textCarouselTextBySlide = textCarouselTextBySlide.map((x, i) => (i === idx ? ensured : x));
				}
			}
			if (isPlaceholderProfileName(textCarouselNameBySlide[idx] ?? '')) {
				textCarouselNameBySlide = textCarouselNameBySlide.map((x, i) =>
					i === idx ? brandDisplayName || TEXT_CAROUSEL_DEFAULTS.name : x,
				);
			}
			if (isPlaceholderProfileHandle(textCarouselHandleBySlide[idx] ?? '')) {
				textCarouselHandleBySlide = textCarouselHandleBySlide.map((x, i) =>
					i === idx ? brandHandle || TEXT_CAROUSEL_DEFAULTS.handle : x,
				);
			}
			return;
		}
		if (isWhitePostFamily(t)) {
			const defaults = t === 'whiteMedia' ? WHITE_MEDIA_DEFAULTS : WHITE_THREAD_DEFAULTS;
			if (!String(textCarouselTextBySlide[idx] ?? '').trim()) {
				textCarouselTextBySlide = textCarouselTextBySlide.map((x, i) =>
					i === idx ? defaults.body : x,
				);
			}
			if (isPlaceholderProfileName(textCarouselNameBySlide[idx] ?? '')) {
				textCarouselNameBySlide = textCarouselNameBySlide.map((x, i) =>
					i === idx ? brandDisplayName || defaults.name : x,
				);
			}
			if (isPlaceholderProfileHandle(textCarouselHandleBySlide[idx] ?? '')) {
				textCarouselHandleBySlide = textCarouselHandleBySlide.map((x, i) =>
					i === idx ? brandHandle || defaults.handle : x,
				);
			}
			if (!String(textCarouselAvatarImageBySlide[idx] ?? '').trim()) {
				textCarouselAvatarImageBySlide = textCarouselAvatarImageBySlide.map((x, i) =>
					i === idx ? defaults.avatarUrl : x,
				);
			}
			return;
		}
		if (t === 'article') {
			if (!String(articleTextBySlide[idx] ?? '').trim()) {
				articleTextBySlide = articleTextBySlide.map((x, i) => (i === idx ? ARTICLE_DEFAULT_BODY : x));
			}
			return;
		}
		if (isBrandStackFamily(t)) {
			if (!String(videoStoryHeadlineBySlide[idx] ?? '').trim()) {
				videoStoryHeadlineBySlide = videoStoryHeadlineBySlide.map((x, i) =>
					i === idx ? BRAND_STACK_DEFAULTS.headline : x,
				);
			}
			if (!String(videoStoryWatermarkBySlide[idx] ?? '').trim()) {
				videoStoryWatermarkBySlide = videoStoryWatermarkBySlide.map((x, i) =>
					i === idx
						? String(brandDisplayName ?? '').trim() || BRAND_STACK_DEFAULTS.watermark
						: x,
				);
			}
			if (!String(brandStackBrandBySlide[idx] ?? '').trim()) {
				brandStackBrandBySlide = brandStackBrandBySlide.map((x, i) =>
					i === idx
						? String(brandDisplayName ?? '').trim() || BRAND_STACK_DEFAULTS.brand
						: x,
				);
			}
			if (!String(brandStackBottomMediaBySlide[idx] ?? '').trim()) {
				brandStackBottomMediaBySlide = brandStackBottomMediaBySlide.map((x, i) =>
					i === idx ? BRAND_STACK_DEFAULTS.bottomMediaUrl : x,
				);
			}
			return;
		}
		if (isVideoStoryFamily(t)) {
			const defaultHeadline =
				t === 'videoFeature'
					? VIDEO_FEATURE_DEFAULTS.headline
					: t === 'videoPost'
						? VIDEO_POST_DEFAULTS.headline
					: t === 'videoSource'
						? VIDEO_SOURCE_DEFAULTS.headline
						: t === 'videoText'
							? VIDEO_TEXT_DEFAULTS.headline
							: t === 'videoCreator'
								? VIDEO_CREATOR_DEFAULTS.headline
								: t === 'videoHook'
									? VIDEO_HOOK_DEFAULTS.headline
									: VIDEO_STORY_DEFAULTS.headline;
			const defaultWatermark =
				t === 'videoSource'
					? VIDEO_SOURCE_DEFAULTS.watermark
					: t === 'videoHook' ||
						  t === 'videoCreator' ||
						  t === 'videoPost' ||
						  t === 'videoText' ||
						  t === 'videoFeature'
						? ''
						: VIDEO_STORY_DEFAULTS.watermark;
			const curHeadline = String(videoStoryHeadlineBySlide[idx] ?? '').trim();
			// `applyBlankCanvas` used to pre-seed the shared story headline — replace that
			// stale default when opening a template-specific starter.
			const staleSharedHeadline =
				curHeadline === VIDEO_STORY_DEFAULTS.headline && t !== 'videoStory' && t !== 'videoFit' && t !== 'videoBlur';
			if (!curHeadline || staleSharedHeadline) {
				videoStoryHeadlineBySlide = videoStoryHeadlineBySlide.map((x, i) =>
					i === idx ? defaultHeadline : x,
				);
			}
			// Highlight template no longer shows a Source: line — clear stale watermarks.
			if (t === 'videoSource') {
				const wm = String(videoStoryWatermarkBySlide[idx] ?? '').trim();
				if (!wm || /^source\s*:/i.test(wm)) {
					videoStoryWatermarkBySlide = videoStoryWatermarkBySlide.map((x, i) =>
						i === idx ? '' : x,
					);
				}
			} else if (defaultWatermark && !String(videoStoryWatermarkBySlide[idx] ?? '').trim()) {
				videoStoryWatermarkBySlide = videoStoryWatermarkBySlide.map((x, i) =>
					i === idx
						? String(brandDisplayName ?? '').trim() || defaultWatermark
						: x,
				);
			}
			if (t === 'videoCreator' || t === 'videoPost') {
				if (isPlaceholderProfileName(textCarouselNameBySlide[idx] ?? '')) {
					textCarouselNameBySlide = textCarouselNameBySlide.map((x, i) =>
						i === idx ? brandDisplayName || VIDEO_CREATOR_DEFAULTS.name : x,
					);
				}
				if (isPlaceholderProfileHandle(textCarouselHandleBySlide[idx] ?? '')) {
					textCarouselHandleBySlide = textCarouselHandleBySlide.map((x, i) =>
						i === idx ? brandHandle || VIDEO_CREATOR_DEFAULTS.handle : x,
					);
				}
				if (t === 'videoPost' && !String(textCarouselAvatarImageBySlide[idx] ?? '').trim()) {
					textCarouselAvatarImageBySlide = textCarouselAvatarImageBySlide.map((x, i) =>
						i === idx ? VIDEO_POST_DEFAULTS.avatarUrl : x,
					);
				}
			}
			if (t === 'videoFeature') {
				const curBody = String(blackTextBodyBySlide[idx] ?? '').trim();
				const staleBlackTextBody = curBody === BLACK_TEXT_CAROUSEL_DEFAULTS.body;
				if (!curBody || staleBlackTextBody) {
					blackTextBodyBySlide = blackTextBodyBySlide.map((x, i) =>
						i === idx ? VIDEO_FEATURE_DEFAULTS.body : x,
					);
				}
			}
			const imgs = bgImagesByTemplate[t] ?? [];
			const hasImg = !!String(imgs[idx] ?? '').trim();
			const vids = bgVideosByTemplate[t] ?? [];
			// Only seed demo video when the slide has neither video nor image —
			// otherwise photo backgrounds get overwritten by a demo clip.
			if (!String(vids[idx] ?? '').trim() && !hasImg) {
				const next = Array.from(
					{ length: Math.max(vids.length, idx + 1, slides.length) },
					(_, i) =>
						String(vids[i] ?? '').trim()
							? String(vids[i])
							: i === idx
								? defaultDemoVideoForTemplate(t)
								: '',
				);
				bgVideosByTemplate = { ...bgVideosByTemplate, [t]: next };
			}
			return;
		}
		if (t === 'imageQuote') {
			if (!String(imageQuoteTextBySlide[idx] ?? '').trim()) {
				imageQuoteTextBySlide = imageQuoteTextBySlide.map((x, i) =>
					i === idx ? IMAGE_QUOTE_DEFAULTS.body : x,
				);
			}
			if (!String(imageQuoteFooterLeftBySlide[idx] ?? '').trim()) {
				imageQuoteFooterLeftBySlide = imageQuoteFooterLeftBySlide.map((x, i) =>
					i === idx ? IMAGE_QUOTE_DEFAULTS.footerLeft : x,
				);
			}
			if (!String(imageQuoteFooterRightBySlide[idx] ?? '').trim()) {
				imageQuoteFooterRightBySlide = imageQuoteFooterRightBySlide.map((x, i) =>
					i === idx ? IMAGE_QUOTE_DEFAULTS.footerRight : x,
				);
			}
			return;
		}
		if (t === 'blackText' || isPhotoStoryFamily(t)) {
			const defaultHeadline =
				t === 'photoTopic'
					? PHOTO_TOPIC_DEFAULTS.headline
					: t === 'photoCaption'
						? PHOTO_CAPTION_DEFAULTS.headline
						: BLACK_TEXT_CAROUSEL_DEFAULTS.headline;
			const defaultBody =
				t === 'photoTopic'
					? PHOTO_TOPIC_DEFAULTS.body
					: t === 'photoCaption'
						? PHOTO_CAPTION_DEFAULTS.body
						: BLACK_TEXT_CAROUSEL_DEFAULTS.body;
			if (!String(blackTextHeadlineBySlide[idx] ?? '').trim()) {
				blackTextHeadlineBySlide = blackTextHeadlineBySlide.map((x, i) =>
					i === idx ? defaultHeadline : x,
				);
			}
			if (!String(blackTextBodyBySlide[idx] ?? '').trim()) {
				blackTextBodyBySlide = blackTextBodyBySlide.map((x, i) =>
					i === idx ? defaultBody : x,
				);
			}
		}
	}

	function isBlankCanvasSolidFill(color: string) {
		const c = String(color ?? '').trim().toLowerCase();
		return c === '#ffffff' || c === '#fff' || c === 'white';
	}

	/** Copy blank-canvas text box content into the target template’s primary text field when empty. */
	function migrateBlankOverlayTextToSlide(idx: number, to: TemplateId) {
		const overlays = (slideTextOverlaysByTemplate.blank ?? [])[idx] ?? [];
		const text = overlays
			.map((o) => String(o.text ?? '').trim())
			.filter(Boolean)
			.join('\n\n');
		if (!text) return;
		if (to === 'news' && !String(slides[idx] ?? '').trim()) {
			slides = slides.map((s, i) => (i === idx ? text : s));
		} else if (to === 'tweet' && !String(tweetTopTextBySlide[idx] ?? '').trim()) {
			tweetTopTextBySlide = tweetTopTextBySlide.map((s, i) => (i === idx ? text : s));
		} else if (to === 'textCarousel' && !String(textCarouselTextBySlide[idx] ?? '').trim()) {
			textCarouselTextBySlide = textCarouselTextBySlide.map((s, i) => (i === idx ? text : s));
		} else if (isWhitePostFamily(to) && !String(textCarouselTextBySlide[idx] ?? '').trim()) {
			textCarouselTextBySlide = textCarouselTextBySlide.map((s, i) => (i === idx ? text : s));
		} else if (to === 'article' && !String(articleTextBySlide[idx] ?? '').trim()) {
			articleTextBySlide = articleTextBySlide.map((s, i) => (i === idx ? text : s));
		} else if (to === 'brandStack' && !String(videoStoryHeadlineBySlide[idx] ?? '').trim()) {
			videoStoryHeadlineBySlide = videoStoryHeadlineBySlide.map((s, i) => (i === idx ? text : s));
		} else if (to === 'imageQuote' && !String(imageQuoteTextBySlide[idx] ?? '').trim()) {
			imageQuoteTextBySlide = imageQuoteTextBySlide.map((s, i) => (i === idx ? text : s));
		} else if (to === 'blackText' && !String(blackTextHeadlineBySlide[idx] ?? '').trim()) {
			blackTextHeadlineBySlide = blackTextHeadlineBySlide.map((s, i) => (i === idx ? text : s));
		}
	}

	/** Starter/demo copy — don’t treat as a story worth carrying across templates. */
	function isStockSlidePrimary(_template: TemplateId, text: string): boolean {
		const t = stripMarkup(String(text ?? '').trim()).replace(/\s+/g, ' ').trim().toLowerCase();
		if (!t) return true;
		const stock = [
			NEWS_PLACEHOLDER_HEADLINE,
			TEXT_CAROUSEL_DEFAULTS.body,
			WHITE_THREAD_DEFAULTS.body,
			WHITE_MEDIA_DEFAULTS.body,
			ARTICLE_DEFAULT_BODY,
			TWEET_DEFAULTS.topText,
			IMAGE_QUOTE_DEFAULTS.body,
			VIDEO_STORY_DEFAULTS.headline,
			VIDEO_HOOK_DEFAULTS.headline,
			VIDEO_CREATOR_DEFAULTS.headline,
			VIDEO_TEXT_DEFAULTS.headline,
			VIDEO_SOURCE_DEFAULTS.headline,
			VIDEO_FEATURE_DEFAULTS.headline,
			VIDEO_POST_DEFAULTS.headline,
			BRAND_STACK_DEFAULTS.headline,
			BLACK_TEXT_CAROUSEL_DEFAULTS.headline,
			PHOTO_TOPIC_DEFAULTS.headline,
			PHOTO_CAPTION_DEFAULTS.headline,
		]
			.map((s) => stripMarkup(String(s ?? '').trim()).replace(/\s+/g, ' ').trim().toLowerCase())
			.filter(Boolean);
		return stock.includes(t);
	}

	function isStockSlideBody(_template: TemplateId, text: string): boolean {
		const t = stripMarkup(String(text ?? '').trim()).replace(/\s+/g, ' ').trim().toLowerCase();
		if (!t) return true;
		const stock = [
			NEWS_DEFAULT_SUBTEXT,
			TWEET_DEFAULTS.bottomText,
			BLACK_TEXT_CAROUSEL_DEFAULTS.body,
			PHOTO_TOPIC_DEFAULTS.body,
			PHOTO_CAPTION_DEFAULTS.body,
			VIDEO_FEATURE_DEFAULTS.body,
		]
			.map((s) => stripMarkup(String(s ?? '').trim()).replace(/\s+/g, ' ').trim().toLowerCase())
			.filter(Boolean);
		return stock.includes(t);
	}

	function templateHasBodyField(template: TemplateId): boolean {
		return (
			template === 'news' ||
			template === 'tweet' ||
			template === 'blackText' ||
			isPhotoStoryFamily(template) ||
			template === 'videoFeature'
		);
	}

	/** Single text bucket — join/split headline+body when carrying across templates. */
	function templateIsLongFormPrimary(template: TemplateId): boolean {
		return (
			template === 'textCarousel' ||
			isWhitePostFamily(template) ||
			template === 'article' ||
			template === 'imageQuote'
		);
	}

	function readSlidePrimary(template: TemplateId, idx: number): string {
		if (template === 'blank') {
			const overlays = (slideTextOverlaysByTemplate.blank ?? [])[idx] ?? [];
			return overlays
				.map((o) => String(o.text ?? '').trim())
				.filter(Boolean)
				.join('\n\n');
		}
		if (template === 'tweet') return String(tweetTopTextBySlide[idx] ?? '').trim();
		if (template === 'article') return String(articleTextBySlide[idx] ?? '').trim();
		if (template === 'textCarousel' || isWhitePostFamily(template)) {
			return String(textCarouselTextBySlide[idx] ?? '').trim();
		}
		if (template === 'imageQuote') return String(imageQuoteTextBySlide[idx] ?? '').trim();
		if (isVideoStoryFamily(template) || template === 'brandStack' || isVideoSplitFamily(template)) {
			return String(videoStoryHeadlineBySlide[idx] ?? '').trim();
		}
		if (template === 'blackText' || isPhotoStoryFamily(template)) {
			return String(blackTextHeadlineBySlide[idx] ?? '').trim();
		}
		/* Prefer the in-edit News buffer so a mid-edit switch doesn't drop typed/highlighted copy. */
		if (
			template === 'news' &&
			idx === activeSlide &&
			newsHeadlineLive !== null
		) {
			return String(newsHeadlineLive ?? '').trim();
		}
		return String(slides[idx] ?? '').trim();
	}

	function readSlideBody(template: TemplateId, idx: number): string {
		if (template === 'news') return String(newsSubtextBySlide[idx] ?? '').trim();
		if (template === 'tweet') return String(tweetBottomTextBySlide[idx] ?? '').trim();
		if (template === 'blackText' || isPhotoStoryFamily(template)) {
			return String(blackTextBodyBySlide[idx] ?? '').trim();
		}
		if (template === 'videoFeature') {
			return String(blackTextBodyBySlide[idx] ?? '').trim();
		}
		return '';
	}

	/** First paragraph / sentence → headline; remainder → supporting body. */
	function splitLongFormIntoPrimaryAndBody(text: string): { primary: string; body: string } {
		const raw = String(text ?? '').trim();
		if (!raw) return { primary: '', body: '' };
		const paras = raw.split(/\n\n+/).map((p) => p.trim()).filter(Boolean);
		if (paras.length >= 2) {
			return { primary: paras[0]!, body: paras.slice(1).join('\n\n') };
		}
		const sentences =
			raw.match(/[^.!?]+[.!?]+(?:["')\]]+)?|[^.!?]+$/g)?.map((s) => s.trim()).filter(Boolean) ??
			[raw];
		if (sentences.length >= 2) {
			return { primary: sentences[0]!, body: sentences.slice(1).join(' ') };
		}
		return { primary: raw, body: '' };
	}

	function writeSlidePrimary(
		template: TemplateId,
		idx: number,
		raw: string,
		opts?: { preserveCarry?: boolean },
	) {
		/* Template switches must keep [[highlight]] markup; fetch clamps strip it for non-News. */
		const clipped = opts?.preserveCarry
			? String(raw ?? '').trim()
			: clampFetchedPrimaryForTemplate(template, raw);
		if (!clipped) return;
		/* Write only the target template’s bucket — don’t stomp News `slides` when filling Text/Highlight. */
		if (template === 'tweet') {
			tweetTopTextBySlide = tweetTopTextBySlide.map((s, i) => (i === idx ? clipped : s));
			ensureTweetSlideProfileDefaults(idx);
			return;
		}
		if (template === 'article') {
			articleTextBySlide = articleTextBySlide.map((s, i) => (i === idx ? clipped : s));
			return;
		}
		if (template === 'textCarousel' || isWhitePostFamily(template)) {
			textCarouselTextBySlide = textCarouselTextBySlide.map((s, i) => (i === idx ? clipped : s));
			return;
		}
		if (template === 'imageQuote') {
			imageQuoteTextBySlide = imageQuoteTextBySlide.map((s, i) => (i === idx ? clipped : s));
			return;
		}
		if (isVideoStoryFamily(template) || template === 'brandStack' || isVideoSplitFamily(template)) {
			videoStoryHeadlineBySlide = videoStoryHeadlineBySlide.map((s, i) => (i === idx ? clipped : s));
			return;
		}
		if (template === 'blackText' || isPhotoStoryFamily(template)) {
			blackTextHeadlineBySlide = blackTextHeadlineBySlide.map((s, i) => (i === idx ? clipped : s));
			return;
		}
		if (template === 'news') {
			slides = slides.map((s, i) => (i === idx ? clipped : s));
			newsHeadlineLive = null;
		}
	}

	function writeSlideBody(
		template: TemplateId,
		idx: number,
		raw: string,
		opts?: { preserveCarry?: boolean },
	) {
		const text = String(raw ?? '').trim();
		if (template === 'news') {
			while (newsSubtextBySlide.length <= idx) newsSubtextBySlide = [...newsSubtextBySlide, ''];
			const next = !text ? '' : opts?.preserveCarry ? text : clampNewsSubtext(text);
			newsSubtextBySlide = newsSubtextBySlide.map((x, i) => (i === idx ? next : x));
			return;
		}
		if (template === 'tweet') {
			const next = !text ? '' : opts?.preserveCarry ? text : clampTweetReplyFetched(text);
			tweetBottomTextBySlide = tweetBottomTextBySlide.map((x, i) => (i === idx ? next : x));
			return;
		}
		if (template === 'blackText' || isPhotoStoryFamily(template) || template === 'videoFeature') {
			const next = !text ? '' : opts?.preserveCarry ? text : clampFetchedBlackTextBody(text);
			blackTextBodyBySlide = blackTextBodyBySlide.map((x, i) => (i === idx ? next : x));
		}
	}

	/**
	 * Remap the active slide’s story into the target template’s copy fields (no LLM).
	 * Heading ↔ body when both exist; long-form (Text carousel / Quote) splits/joins as needed.
	 * Preserves `[[highlight]]` markup — fetch clamps must not run on this path.
	 * Round-trip safe: leaving a 2-field template for a 1-field one must not wipe the
	 * second field when you switch back.
	 */
	function carrySlideCopyAcrossTemplates(from: TemplateId, to: TemplateId, idx: number) {
		if (from === to || to === 'blank') return;

		let primary = readSlidePrimary(from, idx);
		let body = readSlideBody(from, idx);
		const primaryStock = isStockSlidePrimary(from, primary);
		const bodyStock = isStockSlideBody(from, body);

		if (primaryStock) primary = '';
		if (bodyStock) body = '';

		if (!primary && !body) return;

		/* Body-only source (e.g. News subtext kept, headline was stock): promote into a headline. */
		if (!primary && body) {
			if (!templateIsLongFormPrimary(to)) {
				const split = splitLongFormIntoPrimaryAndBody(body);
				primary = split.primary;
				body = split.body;
			}
		}

		if (templateIsLongFormPrimary(from) && primary && !body) {
			const split = splitLongFormIntoPrimaryAndBody(primary);
			if (templateHasBodyField(to) || !templateIsLongFormPrimary(to)) {
				primary = split.primary;
				body = split.body;
			}
		}

		const carryOpts = { preserveCarry: true as const };
		if (templateIsLongFormPrimary(to)) {
			const joined = [primary, body].filter(Boolean).join('\n\n');
			if (joined) writeSlidePrimary(to, idx, joined, carryOpts);
			return;
		}

		if (primary) writeSlidePrimary(to, idx, primary, carryOpts);

		if (!templateHasBodyField(to)) {
			/* One-field destination (video, etc.): keep source body storage untouched for round-trip. */
			return;
		}

		if (body) {
			writeSlideBody(to, idx, body, carryOpts);
			return;
		}

		/*
		 * No body to carry. If the source was also two-field (empty/stock body), clear only
		 * stock demos on the destination. If the source was one-field, leave the destination
		 * body alone so News/Photo subtext survives Video → News (etc.).
		 */
		if (templateHasBodyField(from)) {
			const existing = readSlideBody(to, idx);
			if (!existing || isStockSlideBody(to, existing)) {
				writeSlideBody(to, idx, '', carryOpts);
			}
		}
	}

	/** Built-in demo / starter media — safe to overwrite when remapping a real slide. */
	function isStockOrDemoMediaUrl(url: string): boolean {
		const u = String(url ?? '').trim();
		if (!u) return true;
		if (u.includes('/templates/demos/')) return true;
		const stock = [
			NEWS_DEMO_VIDEO,
			NEWS_DEMO_IMAGE,
			VIDEO_STORY_DEFAULTS.videoUrl,
			VIDEO_STORY_DEFAULTS.posterUrl,
			VIDEO_HOOK_DEFAULTS.videoUrl,
			VIDEO_HOOK_DEFAULTS.posterUrl,
			VIDEO_CREATOR_DEFAULTS.videoUrl,
			VIDEO_CREATOR_DEFAULTS.posterUrl,
			VIDEO_TEXT_DEFAULTS.videoUrl,
			VIDEO_TEXT_DEFAULTS.posterUrl,
			VIDEO_SOURCE_DEFAULTS.videoUrl,
			VIDEO_SOURCE_DEFAULTS.posterUrl,
			VIDEO_FEATURE_DEFAULTS.videoUrl,
			VIDEO_FEATURE_DEFAULTS.posterUrl,
			VIDEO_POST_DEFAULTS.videoUrl,
			VIDEO_POST_DEFAULTS.posterUrl,
			VIDEO_POST_DEFAULTS.avatarUrl,
			VIDEO_SPLIT_DEFAULTS.videoUrl,
			VIDEO_SPLIT_DEFAULTS.posterUrl,
			BRAND_STACK_DEFAULTS.topVideoUrl,
			BRAND_STACK_DEFAULTS.posterUrl,
			IMAGE_QUOTE_DEFAULTS.imageUrl,
			PHOTO_TOPIC_DEFAULTS.imageUrl,
			PHOTO_CAPTION_DEFAULTS.imageUrl,
			WHITE_MEDIA_DEFAULTS.imageUrl,
			WHITE_MEDIA_DEFAULTS.avatarUrl,
			WHITE_THREAD_DEFAULTS.avatarUrl,
		]
			.map((s) => String(s ?? '').trim())
			.filter(Boolean);
		if (stock.includes(u)) return true;
		return stock.some((s) => u === s || u.endsWith(s) || (s.startsWith('/') && u.includes(s)));
	}

	function readSlideBgVideo(template: TemplateId, idx: number): string {
		return String((bgVideosByTemplate[template] ?? [])[idx] ?? '').trim();
	}

	function readSlideBgImage(template: TemplateId, idx: number): string {
		return String((bgImagesByTemplate[template] ?? [])[idx] ?? '').trim();
	}

	function writeSlideBgMedia(
		template: TemplateId,
		idx: number,
		next: { video?: string; image?: string },
	) {
		const n = Math.max(slides.length, idx + 1);
		if (next.video !== undefined) {
			const row = Array.from({ length: n }, (_, i) =>
				i === idx ? next.video! : String((bgVideosByTemplate[template] ?? [])[i] ?? ''),
			);
			bgVideosByTemplate = { ...bgVideosByTemplate, [template]: row };
		}
		if (next.image !== undefined) {
			const row = Array.from({ length: n }, (_, i) =>
				i === idx ? next.image! : String((bgImagesByTemplate[template] ?? [])[i] ?? ''),
			);
			bgImagesByTemplate = { ...bgImagesByTemplate, [template]: row };
		}
	}

	/**
	 * Move background media into the target template, overwriting seeded demos.
	 * Video wins when present; otherwise still image (and clears a demo video so the still shows).
	 */
	function carrySlideMediaAcrossTemplates(from: TemplateId, to: TemplateId, idx: number) {
		if (from === to) return;
		let srcVideo = readSlideBgVideo(from, idx);
		let srcImage = readSlideBgImage(from, idx);
		/* Don't drag SoftBank/demo clips onto the next template — that reads as a "reset". */
		if (srcVideo && isStockOrDemoMediaUrl(srcVideo)) srcVideo = '';
		if (srcImage && isStockOrDemoMediaUrl(srcImage)) srcImage = '';
		if (!srcVideo && !srcImage) {
			if ((from === 'news' || from === 'blank') && (to === 'news' || to === 'blank')) {
				const solid = String(newsSolidBgBySlide[idx] ?? '').trim();
				if (solid && !isBlankCanvasSolidFill(solid)) {
					while (newsSolidBgBySlide.length <= idx) newsSolidBgBySlide = [...newsSolidBgBySlide, ''];
					newsSolidBgBySlide = newsSolidBgBySlide.map((c, i) => (i === idx ? solid : c));
				}
			}
			return;
		}

		if (srcVideo) {
			writeSlideBgMedia(to, idx, {
				video: srcVideo,
				image: srcImage || '',
			});
			if (to === 'news' || to === 'blank' || to === 'imageQuote') {
				while (newsSolidBgBySlide.length <= idx) newsSolidBgBySlide = [...newsSolidBgBySlide, ''];
				newsSolidBgBySlide = newsSolidBgBySlide.map((c, i) => (i === idx ? '' : c));
			}
			return;
		}

		/* Still only — clear any demo video seeded on the target so the image is visible. */
		writeSlideBgMedia(to, idx, { video: '', image: srcImage });
		if (to === 'news' || to === 'blank' || to === 'imageQuote') {
			while (newsSolidBgBySlide.length <= idx) newsSolidBgBySlide = [...newsSolidBgBySlide, ''];
			newsSolidBgBySlide = newsSolidBgBySlide.map((c, i) => (i === idx ? '' : c));
		}
	}

	function templateAcceptsWatermark(template: TemplateId): boolean {
		if (template === 'brandStack') return true;
		return (
			template === 'videoStory' ||
			template === 'videoFit' ||
			template === 'videoBlur'
		);
	}

	function templateAcceptsProfile(template: TemplateId): boolean {
		return (
			template === 'textCarousel' ||
			isWhitePostFamily(template) ||
			template === 'videoCreator' ||
			template === 'videoPost' ||
			template === 'tweet'
		);
	}

	/** Stickers, free text, profile, watermark — only when the target has a matching slot. */
	function carrySlideExtrasAcrossTemplates(from: TemplateId, to: TemplateId, idx: number) {
		if (from === to) return;

		const fromText = (slideTextOverlaysByTemplate[from] ?? [])[idx] ?? [];
		const fromImgs = (slideOverlaysByTemplate[from] ?? [])[idx] ?? [];
		if (fromText.length) {
			const rows = [...(slideTextOverlaysByTemplate[to] ?? [])];
			while (rows.length <= idx) rows.push([]);
			rows[idx] = fromText.map((o) => ({ ...o, style: o.style ? { ...o.style } : o.style }));
			slideTextOverlaysByTemplate = { ...slideTextOverlaysByTemplate, [to]: rows };
		}
		if (fromImgs.length) {
			const rows = [...(slideOverlaysByTemplate[to] ?? [])];
			while (rows.length <= idx) rows.push([]);
			rows[idx] = fromImgs.map((o) => ({ ...o }));
			slideOverlaysByTemplate = { ...slideOverlaysByTemplate, [to]: rows };
		}

		if (templateAcceptsWatermark(to)) {
			let wm = String(videoStoryWatermarkBySlide[idx] ?? '').trim();
			if (from === 'news') {
				const src = String(source ?? '').trim();
				if (src && !isPlaceholderNewsSource(src)) wm = src;
				else {
					const brand = String(brandDisplayName ?? '').trim();
					if (brand) wm = brand;
				}
			}
			if (wm) {
				videoStoryWatermarkBySlide = videoStoryWatermarkBySlide.map((x, i) =>
					i === idx ? wm : x,
				);
			}
		}

		if (!templateAcceptsProfile(to)) return;

		let name = '';
		let handle = '';
		let avatar = '';
		if (from === 'news') {
			name = String(source ?? '').trim() || String(brandDisplayName ?? '').trim();
			avatar = String(sourceLogoSrc ?? '').trim();
		} else if (from === 'tweet') {
			name = String(tweetTopNameBySlide[idx] ?? '').trim();
			handle = String(tweetTopHandleBySlide[idx] ?? '').trim();
			avatar = String(tweetTopAvatarImageBySlide[idx] ?? '').trim();
		} else if (
			from === 'textCarousel' ||
			isWhitePostFamily(from) ||
			from === 'videoCreator' ||
			from === 'videoPost'
		) {
			name = String(textCarouselNameBySlide[idx] ?? '').trim();
			handle = String(textCarouselHandleBySlide[idx] ?? '').trim();
			avatar = String(textCarouselAvatarImageBySlide[idx] ?? '').trim();
		}
		if (name && !isPlaceholderProfileName(name)) {
			if (to === 'tweet') {
				tweetTopNameBySlide = tweetTopNameBySlide.map((x, i) => (i === idx ? name : x));
			} else {
				textCarouselNameBySlide = textCarouselNameBySlide.map((x, i) => (i === idx ? name : x));
			}
		}
		if (handle && !isPlaceholderProfileHandle(handle)) {
			if (to === 'tweet') {
				tweetTopHandleBySlide = tweetTopHandleBySlide.map((x, i) => (i === idx ? handle : x));
			} else {
				textCarouselHandleBySlide = textCarouselHandleBySlide.map((x, i) =>
					i === idx ? handle : x,
				);
			}
		}
		if (avatar && !isStockOrDemoMediaUrl(avatar)) {
			if (to === 'tweet') {
				tweetTopAvatarImageBySlide = tweetTopAvatarImageBySlide.map((x, i) =>
					i === idx ? avatar : x,
				);
			} else {
				textCarouselAvatarImageBySlide = textCarouselAvatarImageBySlide.map((x, i) =>
					i === idx ? avatar : x,
				);
			}
		}
	}

	/** Blank canvas zeros News vignette/shadow and paints solid white — restore when leaving blank. */
	/** Brand mark (logo image and/or display name) onto whichever chrome the template exposes. */
	function reapplyBrandChromeForTemplate(
		t: TemplateId,
		idx: number,
		opts?: { preserveNewsLayout?: boolean },
	) {
		const brand = String(brandDisplayName ?? '').trim();
		const logo = String(sourceLogoSrc ?? '').trim();

		if (t === 'news') {
			if (userId) {
				try {
					const preserve =
						!!opts?.preserveNewsLayout || !!resolveTemplateOverride('news');
					applyNewsSourceChromeFromKit(loadBrandKit(userId), {
						preserveOffsets: preserve,
						preserveWidth: preserve,
						preservePlate: preserve,
					});
				} catch {
					/* ignore */
				}
			} else if (brand && (isPlaceholderNewsSource(source) || !String(source ?? '').trim())) {
				source = brand;
			}
			return;
		}

		if (templateAcceptsWatermark(t)) {
			const cur = String(videoStoryWatermarkBySlide[idx] ?? '').trim();
			const demoWm =
				!cur ||
				cur === VIDEO_STORY_DEFAULTS.watermark ||
				cur === BRAND_STACK_DEFAULTS.watermark;
			if (brand && demoWm) {
				videoStoryWatermarkBySlide = videoStoryWatermarkBySlide.map((x, i) =>
					i === idx ? brand : x,
				);
			}
		}

		if (isBrandStackFamily(t)) {
			const curBrand = String(brandStackBrandBySlide[idx] ?? '').trim();
			if (brand && (!curBrand || curBrand === BRAND_STACK_DEFAULTS.brand)) {
				brandStackBrandBySlide = brandStackBrandBySlide.map((x, i) =>
					i === idx ? brand : x,
				);
			}
		}

		if (!templateAcceptsProfile(t)) return;

		if (brand && isPlaceholderProfileName(textCarouselNameBySlide[idx] ?? '')) {
			textCarouselNameBySlide = textCarouselNameBySlide.map((x, i) =>
				i === idx ? brand : x,
			);
		}
		if (brandHandle && isPlaceholderProfileHandle(textCarouselHandleBySlide[idx] ?? '')) {
			textCarouselHandleBySlide = textCarouselHandleBySlide.map((x, i) =>
				i === idx ? brandHandle : x,
			);
		}
		if (logo) {
			const curAv = String(textCarouselAvatarImageBySlide[idx] ?? '').trim();
			if (!curAv || isStockOrDemoMediaUrl(curAv)) {
				textCarouselAvatarImageBySlide = textCarouselAvatarImageBySlide.map((x, i) =>
					i === idx ? logo : x,
				);
				textCarouselAvatarModeBySlide = textCarouselAvatarModeBySlide.map((x, i) =>
					i === idx ? 'image' : x,
				);
			}
		}
	}

	function bootstrapNewsSlideAfterSwitch(idx: number) {
		if (!String(slides[idx] ?? '').trim()) {
			slides = slides.map((x, i) => (i === idx ? NEWS_PLACEHOLDER_HEADLINE : x));
		}
		while (newsSubtextBySlide.length <= idx) {
			newsSubtextBySlide = [...newsSubtextBySlide, ''];
		}
		if (!String(newsSubtextBySlide[idx] ?? '').trim()) {
			newsSubtextBySlide = newsSubtextBySlide.map((x, i) =>
				i === idx ? NEWS_DEFAULT_SUBTEXT : x,
			);
		}
		if (isPlaceholderNewsSource(source) && idx === 0) source = defaultNewsSource();
		reapplyBrandChromeForTemplate('news', idx);
		while (newsSolidBgBySlide.length <= idx) newsSolidBgBySlide = [...newsSolidBgBySlide, ''];
		if (isBlankCanvasSolidFill(newsSolidBgBySlide[idx] ?? '')) {
			newsSolidBgBySlide = newsSolidBgBySlide.map((c, i) => (i === idx ? '' : c));
		}
		// Either value at 0 means the legibility shelf is invisible, so restore the whole News layout.
		if (shadowHeightAt(idx) === 0 || shadowStrengthAt(idx) === 0) {
			circleX = NEWS_DEFAULT_LAYOUT.circleX;
			circleY = NEWS_DEFAULT_LAYOUT.circleY;
			circleSize = NEWS_DEFAULT_LAYOUT.circleSize;
			circle2X = NEWS_DEFAULT_LAYOUT.circle2X;
			circle2Y = NEWS_DEFAULT_LAYOUT.circle2Y;
			circle2Size = NEWS_DEFAULT_LAYOUT.circle2Size;
			applyNewsSeedBackgroundLayout();
			textPanelOffsetY = NEWS_DEFAULT_LAYOUT.textPanelOffsetY;
			setSlideShadow(idx, {
				height: NEWS_DEFAULT_LAYOUT.shadowHeight,
				strength: NEWS_DEFAULT_LAYOUT.shadowStrength,
				curve: NEWS_DEFAULT_LAYOUT.shadowCurve,
				autoFit: true,
			});
		}
		showCircleBySlide = showCircleBySlide.map((v, i) => (i === idx ? true : v));
		while (circleImages.length <= idx) {
			circleImages = [...circleImages, ''];
		}
		if (!String(circleImages[idx] ?? '').trim()) {
			circleImages = circleImages.map((x, i) =>
				i === idx ? NEWS_DEFAULT_CIRCLE_IMAGE : x,
			);
		}
	}

	function finalizeTemplateSwitch(from: TemplateId, to: TemplateId, idx: number) {
		if (from === to) return;
		if (from === 'blank' && to !== 'blank') {
			if (forcedBlankFromQuery) forcedBlankFromQuery = false;
			migrateBlankOverlayTextToSlide(idx, to);
			while (newsSolidBgBySlide.length <= idx) newsSolidBgBySlide = [...newsSolidBgBySlide, ''];
			if (isBlankCanvasSolidFill(newsSolidBgBySlide[idx] ?? '')) {
				newsSolidBgBySlide = newsSolidBgBySlide.map((c, i) => (i === idx ? '' : c));
			}
		}
		if (to === 'news') bootstrapNewsSlideAfterSwitch(idx);
		/* After demos/bootstrap so the current story wins over starter copy. */
		carrySlideCopyAcrossTemplates(from, to, idx);
		carrySlideMediaAcrossTemplates(from, to, idx);
		carrySlideExtrasAcrossTemplates(from, to, idx);
		reapplyBrandChromeForTemplate(to, idx);
	}

	/**
	 * Starter deep-links (`?template=creator`) seed the deck once, then release so the user
	 * can mix templates per slide without the URL / draft hydrate stomping everything.
	 */
	function consumeForcedTemplateStarter() {
		forcedTemplateFromQuery = null;
		skipLatestWorkspaceDraftRestore = false;
		if (typeof window === 'undefined') return;
		try {
			const u = new URL(window.location.href);
			if (!u.searchParams.has('template') && !u.searchParams.has('blank')) return;
			u.searchParams.delete('template');
			u.searchParams.delete('blank');
			const qs = u.searchParams.toString();
			history.replaceState({}, '', u.pathname + (qs ? `?${qs}` : '') + u.hash);
		} catch {
			/* ignore */
		}
	}

	function setActiveTemplate(t: TemplateId) {
		commitInlineTextEditsBeforeSave();
		const idx = activeSlide;
		const from = coerceTemplateId(slideTemplates[idx]);
		lastTemplateUsed = t;
		slideTemplates = slideTemplates.map((x, i) => (i === idx ? t : x));
		if (t === 'blank') {
			slides = slides.map((s, i) => (i === idx ? '' : s));
		}
		if (t === 'news') newsHeadlineLive = null;
		ensureTemplateDefaultsForSlide(t, idx);
		/* Styles / empty starters first; finalize remaps the previous slide’s content on top. */
		applyTemplateDevOverride(t, { slides: 'active' });
		finalizeTemplateSwitch(from, t, idx);
		// Letterbox video layouts (Highlight, etc.) default to a black canvas fill.
		if (isVideoStoryFamily(t) && !isVideoStoryFamily(from)) {
			canvasBgDark = true;
			if (!textColorTouched) textColor = '#FFFFFF';
		}
		/* Only seed demos when carry left the slide with no usable media. */
		const hasVid = !!readSlideBgVideo(t, idx);
		const hasImg = !!readSlideBgImage(t, idx);
		if (isVideoStoryFamily(t) && !hasVid && !hasImg) {
			const row = [...(bgVideosByTemplate[t] ?? [])];
			while (row.length <= idx) row.push('');
			const sibling =
				(bgVideosByTemplate.videoStory ?? [])[idx] ||
				(bgVideosByTemplate.videoFit ?? [])[idx] ||
				(bgVideosByTemplate.videoSplit ?? [])[idx] ||
				(bgVideosByTemplate.videoBlur ?? [])[idx] ||
				(bgVideosByTemplate.videoHook ?? [])[idx] ||
				(bgVideosByTemplate.videoCreator ?? [])[idx] ||
				(bgVideosByTemplate.videoText ?? [])[idx] ||
				(bgVideosByTemplate.videoSource ?? [])[idx] ||
				(bgVideosByTemplate.videoFeature ?? [])[idx] ||
				(bgVideosByTemplate.videoPost ?? [])[idx] ||
				defaultDemoVideoForTemplate(t);
			row[idx] = sibling;
			bgVideosByTemplate = { ...bgVideosByTemplate, [t]: row };
		}
		if (isVideoSplitFamily(t)) {
			formatId = 'vertical';
			if (!readSlideBgVideo('videoSplit', idx) && !readSlideBgImage('videoSplit', idx)) {
				const row = [...(bgVideosByTemplate.videoSplit ?? [])];
				while (row.length <= idx) row.push('');
				row[idx] =
					(bgVideosByTemplate.videoFit ?? [])[idx] ||
					(bgVideosByTemplate.videoStory ?? [])[idx] ||
					(bgVideosByTemplate.brandStack ?? [])[idx] ||
					VIDEO_SPLIT_DEFAULTS.videoUrl;
				bgVideosByTemplate = { ...bgVideosByTemplate, videoSplit: row };
			}
		}
		if ((t === 'blackText' || isPhotoStoryFamily(t)) && !hasVid && !hasImg) {
			const row = [...(bgImagesByTemplate[t] ?? [])];
			while (row.length <= idx) row.push('');
			row[idx] =
				t === 'photoTopic'
					? PHOTO_TOPIC_DEFAULTS.imageUrl
					: t === 'photoCaption'
						? PHOTO_CAPTION_DEFAULTS.imageUrl
						: BLACK_TEXT_BG_DEFAULT;
			bgImagesByTemplate = { ...bgImagesByTemplate, [t]: row };
		} else if (isPhotoStoryFamily(t) && hasImg) {
			const curImg = readSlideBgImage(t, idx);
			const staleTopicPlaceholder =
				t === 'photoTopic' &&
				(curImg.includes('photo-topic-placeholder') ||
					curImg.endsWith('/placeholders/carousel/photo-topic-placeholder.png'));
			if (staleTopicPlaceholder && readSlideBgImage(from, idx)) {
				writeSlideBgMedia(t, idx, { image: readSlideBgImage(from, idx), video: '' });
			}
		}
		if (t === 'whiteMedia' && !hasVid && !hasImg) {
			const row = [...(bgImagesByTemplate.whiteMedia ?? [])];
			while (row.length <= idx) row.push('');
			row[idx] = WHITE_MEDIA_DEFAULTS.imageUrl;
			bgImagesByTemplate = { ...bgImagesByTemplate, whiteMedia: row };
		}
		if (t === 'imageQuote' && !hasVid && !hasImg) {
			const row = [...(bgImagesByTemplate.imageQuote ?? [])];
			while (row.length <= idx) row.push('');
			row[idx] = IMAGE_QUOTE_DEFAULTS.imageUrl;
			bgImagesByTemplate = { ...bgImagesByTemplate, imageQuote: row };
		}
	}
	function applyTemplateToAll(t: TemplateId, opts?: { skipNewsSeed?: boolean }) {
		commitInlineTextEditsBeforeSave();
		const prevPerSlide = slideTemplates.map((x) => coerceTemplateId(x));
		const wasAllBlank = prevPerSlide.every((x) => x === 'blank');
		const hadRealStory = prevPerSlide.some((from, i) => {
			const primary = readSlidePrimary(from, i);
			const body = readSlideBody(from, i);
			return (
				(!isStockSlidePrimary(from, primary) && !!String(primary ?? '').trim()) ||
				(!isStockSlideBody(from, body) && !!String(body ?? '').trim())
			);
		});
		lastTemplateUsed = t;
		slideTemplates = slideTemplates.map(() => t);
		applyTemplateDevOverride(t, { slides: 'all' });
		for (let i = 0; i < slides.length; i++) {
			const from = wasAllBlank ? 'blank' : prevPerSlide[i] ?? 'news';
			ensureTemplateDefaultsForSlide(t, i);
			finalizeTemplateSwitch(from, t, i);
			reapplyBrandChromeForTemplate(t, i);
		}
		/* After a generation/edit, never re-seed SoftBank demos — that stomps carried copy/media. */
		if (t === 'news' && !opts?.skipNewsSeed && !hadRealStory) seedNewsStarterPlaceholderLayout();
		if (t === 'news') {
			newsHeadlineLive = null;
			const n = slides.length;
			const prevVids = bgVideosByTemplate.news ?? [];
			const prevImgs = bgImagesByTemplate.news ?? [];
			const vidRow = Array.from({ length: n }, (_, i) => {
				const v = String(prevVids[i] ?? '').trim();
				if (v) return v;
				const img = String(prevImgs[i] ?? '').trim();
				// Keep an existing custom image; otherwise seed the demo video.
				return img ? '' : NEWS_DEMO_VIDEO;
			});
			const imgRow = Array.from({ length: n }, (_, i) => {
				if (String(vidRow[i] ?? '').trim()) return '';
				return String(prevImgs[i] ?? '').trim() || '';
			});
			bgVideosByTemplate = { ...bgVideosByTemplate, news: vidRow };
			bgImagesByTemplate = { ...bgImagesByTemplate, news: imgRow };
		}
		if (isVideoStoryFamily(t)) {
			const n = slides.length;
			const prev = bgVideosByTemplate[t] ?? [];
			const prevImgs = bgImagesByTemplate[t] ?? [];
			const row = Array.from({ length: n }, (_, i) => {
				const cur = String(prev[i] ?? '').trim();
				if (cur) return cur;
				/* Still carried from another template — don't bury it under a demo clip. */
				if (String(prevImgs[i] ?? '').trim()) return '';
				return (
					String((bgVideosByTemplate.videoStory ?? [])[i] ?? '').trim() ||
					String((bgVideosByTemplate.videoFit ?? [])[i] ?? '').trim() ||
					String((bgVideosByTemplate.videoFeature ?? [])[i] ?? '').trim() ||
					defaultDemoVideoForTemplate(t)
				);
			});
			bgVideosByTemplate = { ...bgVideosByTemplate, [t]: row };
		}
		if (isVideoSplitFamily(t)) {
			formatId = 'vertical';
			const n = slides.length;
			const prev = bgVideosByTemplate.videoSplit ?? [];
			const prevImgs = bgImagesByTemplate.videoSplit ?? [];
			const row = Array.from({ length: n }, (_, i) => {
				const cur = String(prev[i] ?? '').trim();
				if (cur) return cur;
				if (String(prevImgs[i] ?? '').trim()) return '';
				return (
					String((bgVideosByTemplate.videoFit ?? [])[i] ?? '').trim() ||
					String((bgVideosByTemplate.videoStory ?? [])[i] ?? '').trim() ||
					VIDEO_SPLIT_DEFAULTS.videoUrl
				);
			});
			bgVideosByTemplate = { ...bgVideosByTemplate, videoSplit: row };
		}
		if (t === 'blackText' || isPhotoStoryFamily(t)) {
			const n = slides.length;
			const prev = bgImagesByTemplate[t] ?? [];
			const prevVids = bgVideosByTemplate[t] ?? [];
			const fallback =
				t === 'photoTopic'
					? PHOTO_TOPIC_DEFAULTS.imageUrl
					: t === 'photoCaption'
						? PHOTO_CAPTION_DEFAULTS.imageUrl
						: BLACK_TEXT_BG_DEFAULT;
			const row = Array.from({ length: n }, (_, i) => {
				const cur = String(prev[i] ?? '').trim();
				if (cur) return String(prev[i]);
				/* Carried video counts as real media — don't paste a stock still over it. */
				if (String(prevVids[i] ?? '').trim()) return '';
				return fallback;
			});
			bgImagesByTemplate = { ...bgImagesByTemplate, [t]: row };
		}
		if (t === 'whiteMedia') {
			const n = slides.length;
			const prev = bgImagesByTemplate.whiteMedia ?? [];
			const prevVids = bgVideosByTemplate.whiteMedia ?? [];
			const row = Array.from({ length: n }, (_, i) => {
				const cur = String(prev[i] ?? '').trim();
				if (cur) return String(prev[i]);
				if (String(prevVids[i] ?? '').trim()) return '';
				return WHITE_MEDIA_DEFAULTS.imageUrl;
			});
			bgImagesByTemplate = { ...bgImagesByTemplate, whiteMedia: row };
		}
		if (t === 'imageQuote') {
			const n = slides.length;
			const prev = bgImagesByTemplate.imageQuote ?? [];
			const prevVids = bgVideosByTemplate.imageQuote ?? [];
			const row = Array.from({ length: n }, (_, i) => {
				const cur = String(prev[i] ?? '').trim();
				if (cur) return String(prev[i]);
				if (String(prevVids[i] ?? '').trim()) return '';
				return IMAGE_QUOTE_DEFAULTS.imageUrl;
			});
			bgImagesByTemplate = { ...bgImagesByTemplate, imageQuote: row };
		}
	}

	/** Apply video + headlines from Videos page "Edit in Studio". */
	function applyStudioClipImport(payload: StudioClipImport) {
		const videoUrl = String(payload.videoUrl ?? '').trim();
		const clipStart = Math.max(0, Number(payload.clipStart) || 0);
		const clipEnd = Math.max(clipStart + 0.5, Number(payload.clipEnd) || clipStart + 15);
		const hook =
			payload.newsHeadline?.trim() ||
			payload.storyHeadline?.trim() ||
			payload.tweetTop?.trim() ||
			'';

		const carouselRaw = Array.isArray(payload.carouselTemplates)
			? payload.carouselTemplates.map((t) => coerceTemplateId(t))
			: [];
		const templates: TemplateId[] =
			carouselRaw.length >= 2
				? carouselRaw.slice(0, 10)
				: [coerceTemplateId(payload.template)];
		const primary = templates[0]!;

		console.info('[studio] applying clip import', {
			templates,
			clipStart,
			clipEnd,
			hasVideo: !!videoUrl,
			videoUrlLen: videoUrl.length,
		});

		applyBlankCanvas();
		// Multi-template carousel: one slide per template, same clip on each.
		// Single-template: keep prior news-seed behavior for a full news starter.
		const multi = templates.length >= 2;
		if (multi) {
			slides = templates.map((t) =>
				t === 'news' ? hook || NEWS_PLACEHOLDER_HEADLINE : '',
			);
			slideTemplates = [...templates];
			slideCount = slides.length;
			activeSlide = 0;
			lastTemplateUsed = primary;
			for (let i = 0; i < templates.length; i++) {
				ensureTemplateDefaultsForSlide(templates[i]!, i);
			}
		} else {
			applyTemplateToAll(primary, { skipNewsSeed: true });
			activeSlide = 0;
		}

		const setAt = (arr: string[], value: string | undefined, len: number, idx: number) => {
			const next = Array.from({ length: len }, (_, i) => arr[i] ?? '');
			if (value?.trim()) next[idx] = value.trim();
			return next;
		};

		const n = Math.max(1, slides.length);

		for (let i = 0; i < templates.length; i++) {
			const template = templates[i]!;
			if (template === 'news' || template === 'imageQuote') {
				if (payload.newsSource?.trim()) source = payload.newsSource.trim();
				else if (isPlaceholderNewsSource(source)) source = defaultNewsSource();
				if (template === 'news' && !multi) {
					seedNewsStarterPlaceholderLayout({ force: true });
					if (hook) slides = slides.map((s, si) => (si === 0 ? hook : s));
				} else if (template === 'news' && multi) {
					slides = slides.map((s, si) =>
						si === i ? hook || NEWS_PLACEHOLDER_HEADLINE : s,
					);
				} else if (template === 'imageQuote') {
					imageQuoteTextBySlide = setAt(
						imageQuoteTextBySlide,
						hook || IMAGE_QUOTE_DEFAULTS.body,
						n,
						i,
					);
				}
			} else if (isVideoStoryFamily(template)) {
				const rawHook =
					template === 'videoHook' ||
					template === 'videoCreator' ||
					template === 'videoPost' ||
					template === 'videoText' ||
					template === 'videoSource' ||
					template === 'videoFeature'
						? payload.videoHook || payload.storyHeadline || hook
						: payload.storyHeadline || hook;
				const headline =
					template === 'videoSource' ? ensureFirstWordHighlight(rawHook || '') : rawHook;
				videoStoryHeadlineBySlide = setAt(videoStoryHeadlineBySlide, headline, n, i);
				videoStoryWatermarkBySlide = setAt(
					videoStoryWatermarkBySlide,
					template === 'videoSource' ||
						template === 'videoCreator' ||
						template === 'videoPost' ||
						template === 'videoText' ||
						template === 'videoFeature' ||
						template === 'videoHook'
						? ''
						: payload.storyWatermark,
					n,
					i,
				);
				if (template === 'videoCreator' || template === 'videoPost') {
					const defaults = template === 'videoPost' ? VIDEO_POST_DEFAULTS : VIDEO_CREATOR_DEFAULTS;
					textCarouselNameBySlide = setAt(
						textCarouselNameBySlide,
						payload.carouselName || defaults.name,
						n,
						i,
					);
					textCarouselHandleBySlide = setAt(
						textCarouselHandleBySlide,
						payload.carouselHandle || defaults.handle,
						n,
						i,
					);
					if (template === 'videoPost') {
						textCarouselAvatarImageBySlide = setAt(
							textCarouselAvatarImageBySlide,
							VIDEO_POST_DEFAULTS.avatarUrl,
							n,
							i,
						);
					}
				}
				if (template === 'videoFeature') {
					blackTextBodyBySlide = setAt(
						blackTextBodyBySlide,
						payload.carouselBody || payload.tweetBottom || VIDEO_FEATURE_DEFAULTS.body,
						n,
						i,
					);
				}
			} else if (isBrandStackFamily(template)) {
				videoStoryHeadlineBySlide = setAt(
					videoStoryHeadlineBySlide,
					payload.storyHeadline || hook || BRAND_STACK_DEFAULTS.headline,
					n,
					i,
				);
				videoStoryWatermarkBySlide = setAt(
					videoStoryWatermarkBySlide,
					payload.storyWatermark || BRAND_STACK_DEFAULTS.watermark,
					n,
					i,
				);
				brandStackBrandBySlide = setAt(brandStackBrandBySlide, BRAND_STACK_DEFAULTS.brand, n, i);
			} else if (template === 'tweet') {
				tweetTopTextBySlide = setAt(tweetTopTextBySlide, payload.tweetTop || hook, n, i);
				tweetBottomTextBySlide = setAt(tweetBottomTextBySlide, payload.tweetBottom, n, i);
			} else if (template === 'textCarousel') {
				textCarouselTextBySlide = setAt(
					textCarouselTextBySlide,
					payload.carouselBody || hook,
					n,
					i,
				);
				textCarouselNameBySlide = setAt(textCarouselNameBySlide, payload.carouselName, n, i);
				textCarouselHandleBySlide = setAt(
					textCarouselHandleBySlide,
					payload.carouselHandle,
					n,
					i,
				);
			} else if (template === 'blackText') {
				blackTextHeadlineBySlide = setAt(
					blackTextHeadlineBySlide,
					payload.storyHeadline || hook || BLACK_TEXT_CAROUSEL_DEFAULTS.headline,
					n,
					i,
				);
				blackTextBodyBySlide = setAt(
					blackTextBodyBySlide,
					payload.carouselBody || payload.tweetBottom || BLACK_TEXT_CAROUSEL_DEFAULTS.body,
					n,
					i,
				);
			} else if (template === 'article') {
				articleTextBySlide = setAt(
					articleTextBySlide,
					payload.carouselBody || hook || ARTICLE_DEFAULT_BODY,
					n,
					i,
				);
			}
		}

		const finalN = Math.max(1, slides.length);
		if (!multi) {
			slideTemplates = Array.from({ length: finalN }, () => primary);
			slideCount = finalN;
			activeSlide = 0;
		}

		if (videoUrl) {
			const videoCapable: TemplateId[] = [
				'blank',
				'news',
				'tweet',
				'videoStory',
				'videoFit',
			'videoSplit',
				'videoBlur',
				'imageQuote',
			];
			const nextVideos = { ...bgVideosByTemplate };
			const nextImages = { ...bgImagesByTemplate };
			for (const id of videoCapable) {
				// Same clip on every slide + every video-capable bag so template switches keep it
				nextVideos[id] = Array.from({ length: finalN }, () => videoUrl);
				nextImages[id] = Array.from({ length: finalN }, () => '');
			}
			bgVideosByTemplate = nextVideos;
			bgImagesByTemplate = nextImages;
			newsSolidBgBySlide = Array.from({ length: finalN }, () => '');
			videoTrimStartSecBySlide = Array.from({ length: finalN }, () => clipStart);
			videoTrimEndSecBySlide = Array.from({ length: finalN }, () => clipEnd);
			videoDurationBySlide = Array.from({ length: finalN }, () =>
				Math.max(0, clipEnd - clipStart),
			);
			videoMutedBySlide = Array.from({ length: finalN }, () => true);
			videoVolumeBySlide = Array.from({ length: finalN }, () => 0.8);
			videoSeekSec = clipStart;
			bgFitMode = 'cover';
			bgZoom = 100;
			bgOffsetX = 50;
			bgOffsetY = 50;
			bgContainMagnify = NEWS_DEFAULT_LAYOUT.bgContainMagnify;
			const preferredFormat = payload.formatId ?? 'vertical';
			formatId = normalizeStudioFormatId(preferredFormat);
			const saliencyComposited =
				!!payload.usedReframe &&
				String(payload.reframeSettingsKey ?? '').includes('|saliency|');
			videoSplitCompositedBySlide = Array.from({ length: finalN }, (_, i) => {
				const t = coerceTemplateId(slideTemplates[i] ?? primary);
				return saliencyComposited && isVideoSplitFamily(t);
			});
		}

		// Transfer CapCut captions from Videos page onto this canvas
		applyStudioCaptionsPayload(payload.captions);

		forcedTemplateFromQuery = primary;
		pendingClipImport = null;
	}

	function tryApplyPendingClipImport() {
		if (clipImportApplied) return false;
		const payload = pendingClipImport ?? peekStudioClipImport();
		if (!payload?.videoUrl?.trim()) return false;
		clipImportApplied = true;
		pendingClipImport = null;
		consumeStudioClipImport();
		applyStudioClipImport(payload);
		if (typeof window !== 'undefined') {
			const cleanUrl = new URL(window.location.href);
			cleanUrl.searchParams.delete('from');
			cleanUrl.searchParams.delete('template');
			cleanUrl.searchParams.delete('videoUrl');
			cleanUrl.searchParams.delete('clipStart');
			cleanUrl.searchParams.delete('clipEnd');
			cleanUrl.searchParams.delete('clipText');
			window.history.replaceState({}, '', cleanUrl);
		}
		return true;
	}

	function tickStudioClipCaptions() {
		const caps = studioClipCaptions;
		if (caps?.enabled && studioCaptionPhrasesRef.length) {
			const root =
				exportRef ??
				(typeof document !== 'undefined'
					? document.querySelector<HTMLElement>('[data-studio-canvas-root]')
					: null);
			const v = root?.querySelector?.('video') as HTMLVideoElement | null | undefined;
			if (v) {
				const t = v.currentTime;
				const phrase = getActivePhrase(studioCaptionPhrasesRef, t);
				const wordIdx = phrase ? getActiveWordIndex(phrase, t) : -1;
				const phraseKey = phrase ? `${phrase.startSec}|${phrase.text}` : '';
				if (phraseKey !== studioCaptionLastPhraseKey || wordIdx !== studioCaptionLastWordIdx) {
					studioCaptionLastPhraseKey = phraseKey;
					studioCaptionLastWordIdx = wordIdx;
					studioCaptionTime = t;
					studioCaptionPhrase = phrase;
					studioCaptionWordIndex = wordIdx;
				}
			}
		}
		studioCaptionRaf = requestAnimationFrame(tickStudioClipCaptions);
	}

	$effect(() => {
		const on = !!(studioClipCaptions?.enabled && studioCaptionPhrases.length);
		if (!on) {
			if (studioCaptionRaf != null) cancelAnimationFrame(studioCaptionRaf);
			studioCaptionRaf = null;
			studioCaptionPhrase = null;
			studioCaptionWordIndex = -1;
			studioCaptionLastPhraseKey = '';
			studioCaptionLastWordIdx = -1;
			return;
		}
		studioCaptionRaf = requestAnimationFrame(tickStudioClipCaptions);
		return () => {
			if (studioCaptionRaf != null) cancelAnimationFrame(studioCaptionRaf);
			studioCaptionRaf = null;
		};
	});

	/** When Bulk brings per-slide captions, swap them as the user changes slides. */
	$effect(() => {
		const idx = activeSlide;
		if (!bulkCaptionsBySlide.length) return;
		applyStudioCaptionsPayload(bulkCaptionsBySlide[idx] ?? null);
	});

	const studioCaptionTemplate = $derived(
		studioClipCaptions
			? getCaptionTemplate(studioClipCaptions.templateId)
			: getCaptionTemplate('capcut-pop'),
	);

	// ── Undo (scoped to current template + slide) ─────────────────────────
	type ScopedSnapshot =
		| {
				template: 'tweet';
				slide: number;
				data: {
					topName: string;
					topHandle: string;
					bottomName: string;
					bottomHandle: string;
					topText: string;
					bottomText: string;
					replyCount: string;
					repostCount: string;
					likeCount: string;
					topImage: string;
					topAvatarImage: string;
					topAvatarInnerBg: string;
					topAvatarLabel: string;
					topAvatarRingColor: string;
					topAvatarRingWidth: number;
					bottomAvatarImage: string;
					bottomAvatarInnerBg: string;
					bottomAvatarLabel: string;
					bottomAvatarRingColor: string;
					bottomAvatarRingWidth: number;
					styles: Partial<Record<TextElementKind, TextStyle>>;
					offsets: Record<string, { x: number; y: number }>;
				};
		  }
		| {
				template: 'textCarousel' | 'whiteThread' | 'whiteMedia';
				slide: number;
				data: {
					name: string;
					handle: string;
					text: string;
					avatarImage: string;
					avatarInnerBg: string;
					avatarLabel: string;
					avatarRingColor: string;
					avatarRingWidth: number;
					image: string;
					styles: Partial<Record<TextElementKind, TextStyle>>;
					offsets: Record<string, { x: number; y: number }>;
				};
		  }
		| { template: 'article'; slide: number; data: { text: string; swipeText: string; image: string; logo: string; styles: Partial<Record<TextElementKind, TextStyle>>; offsets: Record<string, { x: number; y: number }> } }
		| { template: 'news'; slide: number; data: { headline: string; source: string; image: string; video: string; styles: Partial<Record<TextElementKind, TextStyle>>; offsets: Record<string, { x: number; y: number }> } }
		| { template: 'videoStory' | 'videoFit' | 'videoBlur' | 'videoHook' | 'videoCreator' | 'videoText' | 'videoSource' | 'videoFeature' | 'videoPost'; slide: number; data: { headline: string; watermark: string; video: string; styles: Partial<Record<TextElementKind, TextStyle>>; offsets: Record<string, { x: number; y: number }> } }
		| { template: 'brandStack'; slide: number; data: { headline: string; watermark: string; brand: string; topVideo: string; topImage: string; bottomMedia: string; styles: Partial<Record<TextElementKind, TextStyle>>; offsets: Record<string, { x: number; y: number }> } }
		| { template: 'blackText' | 'photoTopic' | 'photoCaption'; slide: number; data: { headline: string; body: string; image: string; styles: Partial<Record<TextElementKind, TextStyle>>; offsets: Record<string, { x: number; y: number }> } }
		| { template: 'imageQuote'; slide: number; data: { text: string; image: string; styles: Partial<Record<TextElementKind, TextStyle>>; offsets: Record<string, { x: number; y: number }> } };

	type ScopedHistory = { undo: ScopedSnapshot[]; redo: ScopedSnapshot[]; lastSig?: string };
	let historyByTemplateBySlide = $state<Record<TemplateId, ScopedHistory[]>>({
		blank: [],
		news: [],
		tweet: [],
		article: [],
		textCarousel: [],
		imageQuote: [],
		videoStory: [],
		videoFit: [],
		videoSplit: [],
		videoBlur: [],
		videoHook: [],
		videoCreator: [],
		videoText: [],
		videoSource: [],
		videoFeature: [],
		videoPost: [],
		brandStack: [],
		blackText: [],
		photoTopic: [],
		photoCaption: [],
		whiteThread: [],
		whiteMedia: [],
	});

	function ensureHistorySized(n: number) {
		// IMPORTANT: Only assign when sizes mismatch (avoid reactive loops).
		let needsSync = false;
		for (const t of Object.keys(historyByTemplateBySlide) as TemplateId[]) {
			if ((historyByTemplateBySlide[t] ?? []).length !== n) { needsSync = true; break; }
		}
		if (!needsSync) return;

		historyByTemplateBySlide = (Object.fromEntries(
			(Object.entries(historyByTemplateBySlide) as [TemplateId, ScopedHistory[]][]).map(([k, arr]) => [
				k,
				Array.from({ length: n }, (_, i) => arr[i] ?? { undo: [], redo: [] }),
			]),
		) as unknown) as Record<TemplateId, ScopedHistory[]>;
	}

	$effect(() => {
		ensureHistorySized(slides.length);
	});

	function captureSnapshot(template: TemplateId, slide: number): ScopedSnapshot {
		const offsets = offsetsForTemplate(slide, template);
		const styles = (stylesByTemplateBySlide[template] ?? [])[slide] ?? {};
		if (template === 'tweet') {
			return {
				template,
				slide,
				data: {
					topName: tweetTopNameBySlide[slide] ?? 'Chef 👨‍🍳',
					topHandle: tweetTopHandleBySlide[slide] ?? '@chefsevenn',
					bottomName: tweetBottomNameBySlide[slide] ?? 'Mo Mohler',
					bottomHandle: tweetBottomHandleBySlide[slide] ?? '@MoMohler',
					topText: tweetTopTextBySlide[slide] ?? '',
					bottomText: tweetBottomTextBySlide[slide] ?? '',
					replyCount: tweetReplyCountBySlide[slide] ?? '4.2K',
					repostCount: tweetRepostCountBySlide[slide] ?? '12.8K',
					likeCount: tweetLikeCountBySlide[slide] ?? '89.4K',
					topImage: (bgImagesByTemplate.tweet ?? [])[slide] ?? '',
					topAvatarImage: tweetTopAvatarImageBySlide[slide] ?? '',
					topAvatarInnerBg: tweetTopAvatarInnerBgBySlide[slide] ?? '',
					topAvatarLabel: tweetTopAvatarLabelBySlide[slide] ?? '',
					topAvatarRingColor: tweetTopAvatarRingColorBySlide[slide] ?? defaultAvatarRingColor,
					topAvatarRingWidth: tweetTopAvatarRingWidthBySlide[slide] ?? defaultTweetAvatarRingWidth,
					bottomAvatarImage: tweetBottomAvatarImageBySlide[slide] ?? '',
					bottomAvatarInnerBg: tweetBottomAvatarInnerBgBySlide[slide] ?? '',
					bottomAvatarLabel: tweetBottomAvatarLabelBySlide[slide] ?? '',
					bottomAvatarRingColor: tweetBottomAvatarRingColorBySlide[slide] ?? defaultAvatarRingColor,
					bottomAvatarRingWidth: tweetBottomAvatarRingWidthBySlide[slide] ?? defaultTweetAvatarRingWidth,
					styles,
					offsets,
				},
			};
		}
		if (template === 'textCarousel' || template === 'whiteThread' || template === 'whiteMedia') {
			return {
				template,
				slide,
				data: {
					name: textCarouselNameBySlide[slide] ?? 'Captains of industry',
					handle: textCarouselHandleBySlide[slide] ?? '@captainsofindustryy',
					text: textCarouselTextBySlide[slide] ?? '',
					avatarImage: textCarouselAvatarImageBySlide[slide] ?? '',
					avatarInnerBg: textCarouselAvatarInnerBgBySlide[slide] ?? '',
					avatarLabel: textCarouselAvatarLabelBySlide[slide] ?? '',
					avatarRingColor: textCarouselAvatarRingColorBySlide[slide] ?? defaultAvatarRingColor,
					avatarRingWidth: textCarouselAvatarRingWidthBySlide[slide] ?? defaultTextCarouselRingWidth,
					image: (bgImagesByTemplate[template] ?? [])[slide] ?? '',
					styles,
					offsets,
				},
			};
		}
		if (template === 'article') {
			return {
				template,
				slide,
				data: {
					text: articleTextBySlide[slide] ?? '',
					swipeText: articleSwipeTextBySlide[slide] ?? '«« Swipe',
					image: (bgImagesByTemplate.article ?? [])[slide] ?? '',
					logo: articleLogoSrcBySlide[slide] ?? '',
					styles,
					offsets,
				},
			};
		}
		if (isVideoStoryFamily(template)) {
			return {
				template: template as
					| 'videoStory'
					| 'videoFit'
					| 'videoBlur'
					| 'videoHook'
					| 'videoCreator'
					| 'videoText'
					| 'videoSource'
					| 'videoFeature'
					| 'videoPost',
				slide,
				data: {
					headline: videoStoryHeadlineBySlide[slide] ?? '',
					watermark: videoStoryWatermarkBySlide[slide] ?? '',
					video: (bgVideosByTemplate[template] ?? [])[slide] ?? '',
					styles,
					offsets,
				},
			};
		}
		if (template === 'brandStack') {
			return {
				template,
				slide,
				data: {
					headline: videoStoryHeadlineBySlide[slide] ?? '',
					watermark: videoStoryWatermarkBySlide[slide] ?? '',
					brand: brandStackBrandBySlide[slide] ?? '',
					topVideo: (bgVideosByTemplate.brandStack ?? [])[slide] ?? '',
					topImage: (bgImagesByTemplate.brandStack ?? [])[slide] ?? '',
					bottomMedia: brandStackBottomMediaBySlide[slide] ?? '',
					styles,
					offsets,
				},
			};
		}
		if (template === 'blackText' || template === 'photoTopic' || template === 'photoCaption') {
			return {
				template,
				slide,
				data: {
					headline: blackTextHeadlineBySlide[slide] ?? '',
					body: blackTextBodyBySlide[slide] ?? '',
					image: (bgImagesByTemplate[template] ?? [])[slide] ?? '',
					styles,
					offsets,
				},
			};
		}
		// Fallback snapshots (keeps types happy; undo focuses on tweet/text/article).
		if (template === 'news') {
			return {
				template,
				slide,
				data: {
					headline: slides[slide] ?? '',
					source,
					image: (bgImagesByTemplate.news ?? [])[slide] ?? '',
					video: (bgVideosByTemplate.news ?? [])[slide] ?? '',
					styles,
					offsets,
				},
			};
		}
		return {
			template: 'imageQuote',
			slide,
			data: {
				text: imageQuoteTextBySlide[slide] ?? '',
				image: (bgImagesByTemplate.imageQuote ?? [])[slide] ?? '',
				styles: (stylesByTemplateBySlide.imageQuote ?? [])[slide] ?? {},
				offsets: offsetsForTemplate(slide, 'imageQuote'),
			},
		};
	}

	function replaceTemplateOffsets(slide: number, template: TemplateId, next: Record<string, { x: number; y: number }>) {
		const pref = `${template}:`;
		const row = { ...(textOffsetsBySlide[slide] ?? {}) };
		for (const k of Object.keys(row)) {
			if (k.startsWith(pref)) delete row[k];
		}
		for (const [k, v] of Object.entries(next ?? {})) {
			row[`${template}:${k}`] = { x: Number(v.x) || 0, y: Number(v.y) || 0 };
		}
		textOffsetsBySlide = textOffsetsBySlide.map((r, i) => (i === slide ? row : r));
	}

	function applySnapshot(snap: ScopedSnapshot) {
		const i = snap.slide;
		const t = snap.template;
		// Clear selection (prevents toolbar anchoring to stale nodes).
		closeToolbar();

		replaceTemplateOffsets(i, t, (snap as any).data.offsets ?? {});
		stylesByTemplateBySlide = {
			...stylesByTemplateBySlide,
			[t]: (stylesByTemplateBySlide[t] ?? []).map((m, idx) => (idx === i ? ((snap as any).data.styles ?? {}) : m)),
		};

		if (t === 'tweet') {
			const d = snap.data;
			tweetTopNameBySlide = tweetTopNameBySlide.map((x, idx) => (idx === i ? d.topName : x));
			tweetTopHandleBySlide = tweetTopHandleBySlide.map((x, idx) => (idx === i ? d.topHandle : x));
			tweetBottomNameBySlide = tweetBottomNameBySlide.map((x, idx) => (idx === i ? d.bottomName : x));
			tweetBottomHandleBySlide = tweetBottomHandleBySlide.map((x, idx) => (idx === i ? d.bottomHandle : x));
			tweetTopTextBySlide = tweetTopTextBySlide.map((x, idx) => (idx === i ? d.topText : x));
			tweetBottomTextBySlide = tweetBottomTextBySlide.map((x, idx) => (idx === i ? d.bottomText : x));
			tweetReplyCountBySlide = tweetReplyCountBySlide.map((x, idx) => (idx === i ? d.replyCount : x));
			tweetRepostCountBySlide = tweetRepostCountBySlide.map((x, idx) => (idx === i ? d.repostCount : x));
			tweetLikeCountBySlide = tweetLikeCountBySlide.map((x, idx) => (idx === i ? d.likeCount : x));
			// Media for Tweet
			bgImagesByTemplate = { ...bgImagesByTemplate, tweet: (bgImagesByTemplate.tweet ?? []).map((x, idx) => (idx === i ? d.topImage : x)) };
			tweetTopAvatarImageBySlide = tweetTopAvatarImageBySlide.map((x, idx) => (idx === i ? (d.topAvatarImage ?? '') : x));
			tweetTopAvatarInnerBgBySlide = tweetTopAvatarInnerBgBySlide.map((x, idx) => (idx === i ? (d.topAvatarInnerBg ?? '') : x));
			tweetTopAvatarLabelBySlide = tweetTopAvatarLabelBySlide.map((x, idx) => (idx === i ? (d.topAvatarLabel ?? '') : x));
			tweetTopAvatarRingColorBySlide = tweetTopAvatarRingColorBySlide.map((x, idx) => (idx === i ? (d.topAvatarRingColor ?? defaultAvatarRingColor) : x));
			tweetTopAvatarRingWidthBySlide = tweetTopAvatarRingWidthBySlide.map((x, idx) => (idx === i ? (d.topAvatarRingWidth ?? defaultTweetAvatarRingWidth) : x));
			tweetBottomAvatarImageBySlide = tweetBottomAvatarImageBySlide.map((x, idx) => (idx === i ? (d.bottomAvatarImage ?? '') : x));
			tweetBottomAvatarInnerBgBySlide = tweetBottomAvatarInnerBgBySlide.map((x, idx) => (idx === i ? (d.bottomAvatarInnerBg ?? '') : x));
			tweetBottomAvatarLabelBySlide = tweetBottomAvatarLabelBySlide.map((x, idx) => (idx === i ? (d.bottomAvatarLabel ?? '') : x));
			tweetBottomAvatarRingColorBySlide = tweetBottomAvatarRingColorBySlide.map((x, idx) => (idx === i ? (d.bottomAvatarRingColor ?? defaultAvatarRingColor) : x));
			tweetBottomAvatarRingWidthBySlide = tweetBottomAvatarRingWidthBySlide.map((x, idx) => (idx === i ? (d.bottomAvatarRingWidth ?? defaultTweetAvatarRingWidth) : x));
			return;
		}
		if (t === 'textCarousel' || t === 'whiteThread' || t === 'whiteMedia') {
			const d = snap.data;
			textCarouselNameBySlide = textCarouselNameBySlide.map((x, idx) => (idx === i ? d.name : x));
			textCarouselHandleBySlide = textCarouselHandleBySlide.map((x, idx) => (idx === i ? d.handle : x));
			textCarouselTextBySlide = textCarouselTextBySlide.map((x, idx) =>
				idx === i
					? t === 'textCarousel' && newsCopyLength === 'default'
						? ensureTextCarouselBodyMinLength(String(d.text ?? ''))
						: String(d.text ?? '')
					: x,
			);
			textCarouselAvatarImageBySlide = textCarouselAvatarImageBySlide.map((x, idx) =>
				idx === i ? (d.avatarImage ?? '') : x,
			);
			textCarouselAvatarInnerBgBySlide = textCarouselAvatarInnerBgBySlide.map((x, idx) =>
				idx === i ? (d.avatarInnerBg ?? '') : x,
			);
			textCarouselAvatarLabelBySlide = textCarouselAvatarLabelBySlide.map((x, idx) =>
				idx === i ? (d.avatarLabel ?? '') : x,
			);
			textCarouselAvatarRingColorBySlide = textCarouselAvatarRingColorBySlide.map((x, idx) =>
				idx === i ? (d.avatarRingColor ?? defaultAvatarRingColor) : x,
			);
			textCarouselAvatarRingWidthBySlide = textCarouselAvatarRingWidthBySlide.map((x, idx) =>
				idx === i ? (d.avatarRingWidth ?? defaultTextCarouselRingWidth) : x,
			);
			if (t === 'whiteMedia' || t === 'whiteThread') {
				bgImagesByTemplate = {
					...bgImagesByTemplate,
					[t]: (bgImagesByTemplate[t] ?? []).map((x, idx) => (idx === i ? (d.image ?? '') : x)),
				};
			}
			return;
		}
		if (t === 'article') {
			const d = snap.data;
			articleTextBySlide = articleTextBySlide.map((x, idx) => (idx === i ? d.text : x));
			articleSwipeTextBySlide = articleSwipeTextBySlide.map((x, idx) => (idx === i ? d.swipeText : x));
			bgImagesByTemplate = { ...bgImagesByTemplate, article: (bgImagesByTemplate.article ?? []).map((x, idx) => (idx === i ? d.image : x)) };
			articleLogoSrcBySlide = articleLogoSrcBySlide.map((x, idx) => (idx === i ? d.logo ?? '' : x));
			return;
		}
		if (t === 'news') {
			const d = snap.data;
			slides = slides.map((x, idx) => (idx === i ? d.headline : x));
			source = d.source;
			bgImagesByTemplate = {
				...bgImagesByTemplate,
				news: (bgImagesByTemplate.news ?? []).map((x, idx) => (idx === i ? d.image : x)),
			};
			bgVideosByTemplate = {
				...bgVideosByTemplate,
				news: (bgVideosByTemplate.news ?? []).map((x, idx) => (idx === i ? d.video : x)),
			};
			return;
		}
		if (
			snap.template === 'videoStory' ||
			snap.template === 'videoFit' ||
			snap.template === 'videoBlur' ||
			snap.template === 'videoHook' ||
			snap.template === 'videoCreator' ||
			snap.template === 'videoText' ||
			snap.template === 'videoSource' ||
			snap.template === 'videoFeature' ||
			snap.template === 'videoPost'
		) {
			const d = snap.data;
			videoStoryHeadlineBySlide = videoStoryHeadlineBySlide.map((x, idx) => (idx === i ? d.headline : x));
			videoStoryWatermarkBySlide = videoStoryWatermarkBySlide.map((x, idx) => (idx === i ? d.watermark : x));
			bgVideosByTemplate = {
				...bgVideosByTemplate,
				[snap.template]: (bgVideosByTemplate[snap.template] ?? []).map((x, idx) =>
					idx === i ? d.video : x,
				),
			};
			return;
		}
		if (snap.template === 'brandStack') {
			const d = snap.data;
			videoStoryHeadlineBySlide = videoStoryHeadlineBySlide.map((x, idx) => (idx === i ? d.headline : x));
			videoStoryWatermarkBySlide = videoStoryWatermarkBySlide.map((x, idx) => (idx === i ? d.watermark : x));
			brandStackBrandBySlide = brandStackBrandBySlide.map((x, idx) => (idx === i ? d.brand : x));
			brandStackBottomMediaBySlide = brandStackBottomMediaBySlide.map((x, idx) =>
				idx === i ? d.bottomMedia : x,
			);
			bgVideosByTemplate = {
				...bgVideosByTemplate,
				brandStack: (bgVideosByTemplate.brandStack ?? []).map((x, idx) =>
					idx === i ? d.topVideo : x,
				),
			};
			bgImagesByTemplate = {
				...bgImagesByTemplate,
				brandStack: (bgImagesByTemplate.brandStack ?? []).map((x, idx) =>
					idx === i ? d.topImage : x,
				),
			};
			return;
		}
		if (t === 'blackText' || t === 'photoTopic' || t === 'photoCaption') {
			const d = snap.data;
			blackTextHeadlineBySlide = blackTextHeadlineBySlide.map((x, idx) => (idx === i ? d.headline : x));
			blackTextBodyBySlide = blackTextBodyBySlide.map((x, idx) => (idx === i ? d.body : x));
			bgImagesByTemplate = {
				...bgImagesByTemplate,
				[t]: (bgImagesByTemplate[t] ?? []).map((x, idx) => (idx === i ? d.image : x)),
			};
			return;
		}
		if (t === 'imageQuote') {
			const d = snap.data;
			imageQuoteTextBySlide = imageQuoteTextBySlide.map((x, idx) => (idx === i ? d.text : x));
			bgImagesByTemplate = {
				...bgImagesByTemplate,
				imageQuote: (bgImagesByTemplate.imageQuote ?? []).map((x, idx) => (idx === i ? d.image : x)),
			};
			return;
		}
	}

	function pushUndo(template: TemplateId, slide: number) {
		const snap = captureSnapshot(template, slide);
		const sig = JSON.stringify(snap);
		const row = historyByTemplateBySlide[template]?.[slide];
		if (!row) return;
		if (row.lastSig === sig) return;
		row.undo = [...row.undo, snap].slice(-60);
		row.redo = [];
		row.lastSig = sig;
		studioHasUnsavedChanges = true;
		// Mutate in place — reassigning the whole `historyByTemplateBySlide` map invalidated
		// most of the studio tree on every keystroke (felt like a full rerender on Enter).
	}

	function canUndoActive() {
		const row = historyByTemplateBySlide[activeTemplate]?.[activeSlide];
		return !!row && row.undo.length > 0;
	}
	function canRedoActive() {
		const row = historyByTemplateBySlide[activeTemplate]?.[activeSlide];
		return !!row && row.redo.length > 0;
	}

	function undoActive() {
		const t = activeTemplate;
		const s = activeSlide;
		const row = historyByTemplateBySlide[t]?.[s];
		if (!row || row.undo.length === 0) return;
		const current = captureSnapshot(t, s);
		const prev = row.undo[row.undo.length - 1];
		row.undo = row.undo.slice(0, -1);
		row.redo = [...row.redo, current].slice(-60);
		row.lastSig = JSON.stringify(prev);
		applySnapshot(prev);
	}

	function redoActive() {
		const t = activeTemplate;
		const s = activeSlide;
		const row = historyByTemplateBySlide[t]?.[s];
		if (!row || row.redo.length === 0) return;
		const current = captureSnapshot(t, s);
		const next = row.redo[row.redo.length - 1];
		row.redo = row.redo.slice(0, -1);
		row.undo = [...row.undo, current].slice(-60);
		row.lastSig = JSON.stringify(next);
		applySnapshot(next);
	}

	function toggleTrim() {
		if (!effectiveBackgroundVideo) return;
		showVideoTrim = !showVideoTrim;
		if (!showVideoTrim) videoSeekSec = NaN;
	}

	function toggleMute() {
		if (!effectiveBackgroundVideo) return;
		const next = !activeVideoMuted;
		videoMutedBySlide = Array.from(
			{ length: slides.length },
			(_, i) => (i === activeSlide ? next : (videoMutedBySlide[i] ?? true))
		);
		// When unmuting, ensure there is a sane volume.
		if (!next) {
			const cur = videoVolumeBySlide[activeSlide];
			const vol = Number.isFinite(cur) ? cur : 0.8;
			videoVolumeBySlide = Array.from(
				{ length: slides.length },
				(_, i) => {
					if (i === activeSlide) return Math.max(0, Math.min(1, vol));
					const v = videoVolumeBySlide[i];
					return Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0.8;
				}
			);
		}
	}

	function uploadOverlayImage() {
		overlayQuickInput?.click();
	}

	/** Fixed slot count — never splice items in/out or the dock width jiggles on boot/template change. */
	const dockItems = $derived.by(() => {
		const newsOrBlank = activeTemplate === 'news' || activeTemplate === 'blank';
		const canBgTools =
			newsOrBlank ||
			isVideoStoryFamily(activeTemplate) ||
			isPhotoStoryFamily(activeTemplate) ||
			activeTemplate === 'imageQuote' ||
			activeTemplate === 'blackText' ||
			activeTemplate === 'brandStack' ||
			activeTemplate === 'whiteMedia' ||
			activeTemplate === 'article';
		return [
			{
				icon: Wallpaper,
				label: 'BG tools',
				onClick: canBgTools ? openNewsBgToolbarFromDock : undefined,
				disabled: !canBgTools,
			},
			// { icon: Scissors, label: 'Trim', onClick: toggleTrim, disabled: !effectiveBackgroundVideo },
			// { icon: VolumeX, label: 'Mute', onClick: toggleMute, disabled: !effectiveBackgroundVideo },
			// {
			// 	icon: Sparkles,
			// 	label: 'AI',
			// 	onClick: newsOrBlank
			// 		? undefined
			// 		: () => void generateBackground(activeSlide, undefined, activeTemplate),
			// 	disabled:
			// 		newsOrBlank || !!(generatingImagesByTemplate[activeTemplate] ?? [])[activeSlide],
			// },
			{
				icon: Circle,
				label: 'Shape',
				onClick:
					activeTemplate === 'news'
						? () => {
								showCircleBySlide = showCircleBySlide.map((v, i) =>
									i === activeSlide ? !v : v,
								);
							}
						: undefined,
				disabled: activeTemplate !== 'news',
			},
			{ icon: Type, label: 'Text', onClick: addTextOverlay },
		];
	});

	/** Restore the active slide to the single product default (`*_DEFAULTS` / generated-demo-posts). */
	function resetCurrentSlideToDefaults() {
		const i = activeSlide;
		const t = activeTemplate;
		pushUndo(t, i);

		const prevImg = (bgImagesByTemplate[t] ?? [])[i];
		if (prevImg?.startsWith('blob:')) URL.revokeObjectURL(prevImg);
		clearSlideBackground(i);
		generatingImagesByTemplate = {
			...generatingImagesByTemplate,
			[t]: Array.from({ length: slides.length }, (_, idx) =>
				idx === i ? false : (generatingImagesByTemplate[t]?.[idx] ?? false),
			),
		};
		subjectCutouts = Array.from({ length: slides.length }, (_, idx) =>
			idx === i ? '' : (subjectCutouts[idx] ?? ''),
		);
		showCutout = Array.from({ length: slides.length }, (_, idx) =>
			idx === i ? false : (showCutout[idx] ?? false),
		);
		setSlideOverlays(i, [], t);
		setSlideTextOverlays(i, [], t);
		replaceTemplateOffsets(i, t, {});

		forceApplyProductDefaultsForSlide(t, i);

		stylesByTemplateBySlide = {
			...stylesByTemplateBySlide,
			[t]: (stylesByTemplateBySlide[t] ?? []).map((m, idx) => (idx === i ? {} : m)),
		};
		slideMusic = slideMusic.map((m, idx) => (idx === i ? null : m));
		musicPickerForSlide = null;
		closeToolbar();
	}

	/**
	 * Force copy + media for one slide to the product default (same source as fresh `?template=`).
	 * Prefer brand name/handle when the template shows a profile.
	 */
	function forceApplyProductDefaultsForSlide(t: TemplateId, i: number) {
		const n = Math.max(1, slides.length);
		const padMap = <T,>(arr: T[] | undefined, value: T, fill: (idx: number) => T) =>
			Array.from({ length: n }, (_, idx) => (idx === i ? value : fill(idx)));

		if (t === 'news') {
			slides = slides.map((x, idx) => (idx === i ? NEWS_PLACEHOLDER_HEADLINE : x));
			newsSubtextBySlide = padMap(newsSubtextBySlide, NEWS_DEFAULT_SUBTEXT, (idx) => newsSubtextBySlide[idx] ?? '');
			source = defaultNewsSource();
			sourceLabelMode = 'logo';
			sourceBorderKind = 'none';
			circleImages = padMap(circleImages, NEWS_DEFAULT_CIRCLE_IMAGE, (idx) => circleImages[idx] ?? '');
			circle2Images = padMap(circle2Images, '', (idx) => circle2Images[idx] ?? '');
			showCircle2BySlide = padMap(showCircle2BySlide, false, (idx) => showCircle2BySlide[idx] ?? false);
			showCircleBySlide = padMap(showCircleBySlide, true, (idx) => showCircleBySlide[idx] ?? false);
			circleX = NEWS_DEFAULT_LAYOUT.circleX;
			circleY = NEWS_DEFAULT_LAYOUT.circleY;
			circleSize = NEWS_DEFAULT_LAYOUT.circleSize;
			circle2X = NEWS_DEFAULT_LAYOUT.circle2X;
			circle2Y = NEWS_DEFAULT_LAYOUT.circle2Y;
			circle2Size = NEWS_DEFAULT_LAYOUT.circle2Size;
			applyNewsSeedBackgroundLayout();
			textPanelOffsetY = NEWS_DEFAULT_LAYOUT.textPanelOffsetY;
			setSlideShadow(i, {
				height: NEWS_DEFAULT_LAYOUT.shadowHeight,
				strength: NEWS_DEFAULT_LAYOUT.shadowStrength,
				curve: NEWS_DEFAULT_LAYOUT.shadowCurve,
				autoFit: true,
			});
			cuttingOut = padMap(cuttingOut, false, (idx) => cuttingOut[idx] ?? false);
			cutoutError = '';
			newsSolidBgBySlide = padMap(newsSolidBgBySlide, '', (idx) => newsSolidBgBySlide[idx] ?? '');
			setSlideVideo(i, NEWS_DEMO_VIDEO, 'news');
			return;
		}

		if (t === 'tweet') {
			tweetTopNameBySlide = tweetTopNameBySlide.map((x, idx) => (idx === i ? TWEET_DEFAULTS.topName : x));
			tweetTopHandleBySlide = tweetTopHandleBySlide.map((x, idx) => (idx === i ? TWEET_DEFAULTS.topHandle : x));
			tweetBottomNameBySlide = tweetBottomNameBySlide.map((x, idx) => (idx === i ? TWEET_DEFAULTS.bottomName : x));
			tweetBottomHandleBySlide = tweetBottomHandleBySlide.map((x, idx) => (idx === i ? TWEET_DEFAULTS.bottomHandle : x));
			tweetTopTextBySlide = tweetTopTextBySlide.map((x, idx) => (idx === i ? TWEET_DEFAULTS.topText : x));
			tweetBottomTextBySlide = tweetBottomTextBySlide.map((x, idx) => (idx === i ? TWEET_DEFAULTS.bottomText : x));
			tweetReplyCountBySlide = tweetReplyCountBySlide.map((x, idx) => (idx === i ? TWEET_DEFAULTS.replyCount : x));
			tweetRepostCountBySlide = tweetRepostCountBySlide.map((x, idx) => (idx === i ? TWEET_DEFAULTS.repostCount : x));
			tweetLikeCountBySlide = tweetLikeCountBySlide.map((x, idx) => (idx === i ? TWEET_DEFAULTS.likeCount : x));
			tweetStylesBySlide = tweetStylesBySlide.map((s, idx) => (idx === i ? {} : s));
			tweetTopImageHeightBySlide = tweetTopImageHeightBySlide.map((x, idx) => (idx === i ? TWEET_DEFAULTS.topImageHeight : x));
			tweetTopImageWidthBySlide = tweetTopImageWidthBySlide.map((x, idx) => (idx === i ? TWEET_DEFAULTS.topImageWidth : x));
			tweetTopImageZoomBySlide = tweetTopImageZoomBySlide.map((x, idx) => (idx === i ? TWEET_DEFAULTS.topImageZoom : x));
			tweetTopImagePanXBySlide = tweetTopImagePanXBySlide.map((x, idx) => (idx === i ? TWEET_DEFAULTS.topImagePanX : x));
			tweetTopImagePanYBySlide = tweetTopImagePanYBySlide.map((x, idx) => (idx === i ? TWEET_DEFAULTS.topImagePanY : x));
			tweetTopAvatarImageBySlide = tweetTopAvatarImageBySlide.map((x, idx) => (idx === i ? '' : x));
			tweetTopAvatarInnerBgBySlide = tweetTopAvatarInnerBgBySlide.map((x, idx) => (idx === i ? '' : x));
			tweetTopAvatarLabelBySlide = tweetTopAvatarLabelBySlide.map((x, idx) => (idx === i ? '' : x));
			tweetTopAvatarRingColorBySlide = tweetTopAvatarRingColorBySlide.map((x, idx) => (idx === i ? '#c9b97a' : x));
			tweetTopAvatarRingWidthBySlide = tweetTopAvatarRingWidthBySlide.map((x, idx) => (idx === i ? 4 : x));
			tweetBottomAvatarImageBySlide = tweetBottomAvatarImageBySlide.map((x, idx) => (idx === i ? '' : x));
			tweetBottomAvatarInnerBgBySlide = tweetBottomAvatarInnerBgBySlide.map((x, idx) => (idx === i ? '' : x));
			tweetBottomAvatarLabelBySlide = tweetBottomAvatarLabelBySlide.map((x, idx) => (idx === i ? '' : x));
			tweetBottomAvatarRingColorBySlide = tweetBottomAvatarRingColorBySlide.map((x, idx) => (idx === i ? '#c9b97a' : x));
			tweetBottomAvatarRingWidthBySlide = tweetBottomAvatarRingWidthBySlide.map((x, idx) => (idx === i ? 4 : x));
			setSlideImage(i, TWEET_DEFAULTS.topImage, 'tweet');
			return;
		}

		if (t === 'article') {
			articleTextBySlide = articleTextBySlide.map((x, idx) => (idx === i ? ARTICLE_DEFAULT_BODY : x));
			articleSwipeTextBySlide = articleSwipeTextBySlide.map((x, idx) => (idx === i ? ARTICLE_DEFAULT_SWIPE : x));
			articleLogoSrcBySlide = articleLogoSrcBySlide.map((x, idx) => (idx === i ? '' : x));
			return;
		}

		if (t === 'textCarousel') {
			textCarouselNameBySlide = textCarouselNameBySlide.map((x, idx) =>
				idx === i ? brandDisplayName || TEXT_CAROUSEL_DEFAULTS.name : x,
			);
			textCarouselHandleBySlide = textCarouselHandleBySlide.map((x, idx) =>
				idx === i ? brandHandle || TEXT_CAROUSEL_DEFAULTS.handle : x,
			);
			textCarouselTextBySlide = textCarouselTextBySlide.map((x, idx) =>
				idx === i ? TEXT_CAROUSEL_DEFAULTS.body : x,
			);
			textCarouselAvatarImageBySlide = textCarouselAvatarImageBySlide.map((x, idx) => (idx === i ? '' : x));
			textCarouselAvatarInnerBgBySlide = textCarouselAvatarInnerBgBySlide.map((x, idx) => (idx === i ? '' : x));
			textCarouselAvatarLabelBySlide = textCarouselAvatarLabelBySlide.map((x, idx) => (idx === i ? '' : x));
			textCarouselAvatarRingColorBySlide = textCarouselAvatarRingColorBySlide.map((x, idx) =>
				idx === i ? '#c9b97a' : x,
			);
			textCarouselAvatarRingWidthBySlide = textCarouselAvatarRingWidthBySlide.map((x, idx) => (idx === i ? 5 : x));
			return;
		}

		if (isWhitePostFamily(t)) {
			const defaults = t === 'whiteMedia' ? WHITE_MEDIA_DEFAULTS : WHITE_THREAD_DEFAULTS;
			textCarouselNameBySlide = textCarouselNameBySlide.map((x, idx) =>
				idx === i ? brandDisplayName || defaults.name : x,
			);
			textCarouselHandleBySlide = textCarouselHandleBySlide.map((x, idx) =>
				idx === i ? brandHandle || defaults.handle : x,
			);
			textCarouselTextBySlide = textCarouselTextBySlide.map((x, idx) =>
				idx === i ? defaults.body : x,
			);
			textCarouselAvatarImageBySlide = textCarouselAvatarImageBySlide.map((x, idx) =>
				idx === i ? defaults.avatarUrl : x,
			);
			textCarouselAvatarInnerBgBySlide = textCarouselAvatarInnerBgBySlide.map((x, idx) =>
				idx === i ? '' : x,
			);
			textCarouselAvatarLabelBySlide = textCarouselAvatarLabelBySlide.map((x, idx) =>
				idx === i ? '' : x,
			);
			if (t === 'whiteMedia') setSlideImage(i, WHITE_MEDIA_DEFAULTS.imageUrl, 'whiteMedia');
			return;
		}

		if (isBrandStackFamily(t)) {
			videoStoryHeadlineBySlide = videoStoryHeadlineBySlide.map((x, idx) =>
				idx === i ? BRAND_STACK_DEFAULTS.headline : x,
			);
			videoStoryWatermarkBySlide = videoStoryWatermarkBySlide.map((x, idx) =>
				idx === i ? BRAND_STACK_DEFAULTS.watermark : x,
			);
			brandStackBrandBySlide = brandStackBrandBySlide.map((x, idx) =>
				idx === i ? BRAND_STACK_DEFAULTS.brand : x,
			);
			setBrandStackBottomMedia(i, BRAND_STACK_DEFAULTS.bottomMediaUrl);
			setSlideVideo(i, BRAND_STACK_DEFAULTS.topVideoUrl, 'brandStack');
			return;
		}

		if (isVideoSplitFamily(t)) {
			setSlideVideo(i, VIDEO_SPLIT_DEFAULTS.videoUrl, 'videoSplit');
			return;
		}

		if (isVideoStoryFamily(t)) {
			const defaultHeadline =
				t === 'videoFeature'
					? VIDEO_FEATURE_DEFAULTS.headline
					: t === 'videoPost'
						? VIDEO_POST_DEFAULTS.headline
						: t === 'videoSource'
							? VIDEO_SOURCE_DEFAULTS.headline
							: t === 'videoText'
								? VIDEO_TEXT_DEFAULTS.headline
								: t === 'videoCreator'
									? VIDEO_CREATOR_DEFAULTS.headline
									: t === 'videoHook'
										? VIDEO_HOOK_DEFAULTS.headline
										: VIDEO_STORY_DEFAULTS.headline;
			const defaultWatermark =
				t === 'videoSource'
					? VIDEO_SOURCE_DEFAULTS.watermark
					: t === 'videoHook' ||
						  t === 'videoCreator' ||
						  t === 'videoPost' ||
						  t === 'videoText' ||
						  t === 'videoFeature'
						? ''
						: VIDEO_STORY_DEFAULTS.watermark;
			videoStoryHeadlineBySlide = videoStoryHeadlineBySlide.map((x, idx) =>
				idx === i ? defaultHeadline : x,
			);
			videoStoryWatermarkBySlide = videoStoryWatermarkBySlide.map((x, idx) =>
				idx === i ? defaultWatermark : x,
			);
			if (t === 'videoCreator' || t === 'videoPost') {
				const profileDefaults = t === 'videoPost' ? VIDEO_POST_DEFAULTS : VIDEO_CREATOR_DEFAULTS;
				textCarouselNameBySlide = textCarouselNameBySlide.map((x, idx) =>
					idx === i ? brandDisplayName || profileDefaults.name : x,
				);
				textCarouselHandleBySlide = textCarouselHandleBySlide.map((x, idx) =>
					idx === i ? brandHandle || profileDefaults.handle : x,
				);
				if (t === 'videoPost') {
					textCarouselAvatarImageBySlide = textCarouselAvatarImageBySlide.map((x, idx) =>
						idx === i ? VIDEO_POST_DEFAULTS.avatarUrl : x,
					);
				}
			}
			if (t === 'videoFeature') {
				blackTextBodyBySlide = blackTextBodyBySlide.map((x, idx) =>
					idx === i ? VIDEO_FEATURE_DEFAULTS.body : x,
				);
			}
			if (supportsFilmStrip(t)) {
				const d = filmStripDefaultsFor(t);
				filmStripTopPctByTemplate = {
					...filmStripTopPctByTemplate,
					[t]: (filmStripTopPctByTemplate[t] ?? []).map((x, idx) =>
						idx === i ? d.topPct : x,
					),
				};
				filmStripBottomPctByTemplate = {
					...filmStripBottomPctByTemplate,
					[t]: (filmStripBottomPctByTemplate[t] ?? []).map((x, idx) =>
						idx === i ? d.bottomPct : x,
					),
				};
			}
			setSlideVideo(i, defaultDemoVideoForTemplate(t), t);
			return;
		}

		if (t === 'blackText' || t === 'photoTopic' || t === 'photoCaption') {
			const defaultHeadline =
				t === 'photoTopic'
					? PHOTO_TOPIC_DEFAULTS.headline
					: t === 'photoCaption'
						? PHOTO_CAPTION_DEFAULTS.headline
						: BLACK_TEXT_CAROUSEL_DEFAULTS.headline;
			const defaultBody =
				t === 'photoTopic'
					? PHOTO_TOPIC_DEFAULTS.body
					: t === 'photoCaption'
						? PHOTO_CAPTION_DEFAULTS.body
						: BLACK_TEXT_CAROUSEL_DEFAULTS.body;
			blackTextHeadlineBySlide = blackTextHeadlineBySlide.map((x, idx) =>
				idx === i ? defaultHeadline : x,
			);
			blackTextBodyBySlide = blackTextBodyBySlide.map((x, idx) =>
				idx === i ? defaultBody : x,
			);
			if (t === 'photoTopic') setSlideImage(i, PHOTO_TOPIC_DEFAULTS.imageUrl, 'photoTopic');
			else if (t === 'photoCaption') setSlideImage(i, PHOTO_CAPTION_DEFAULTS.imageUrl, 'photoCaption');
			else writeSlideBgMedia('blackText', i, { image: BLACK_TEXT_BG_DEFAULT, video: '' });
			return;
		}

		if (t === 'imageQuote') {
			imageQuoteTextBySlide = imageQuoteTextBySlide.map((x, idx) =>
				idx === i ? IMAGE_QUOTE_DEFAULTS.body : x,
			);
			imageQuoteFooterLeftBySlide = imageQuoteFooterLeftBySlide.map((x, idx) =>
				idx === i ? IMAGE_QUOTE_DEFAULTS.footerLeft : x,
			);
			imageQuoteFooterRightBySlide = imageQuoteFooterRightBySlide.map((x, idx) =>
				idx === i ? IMAGE_QUOTE_DEFAULTS.footerRight : x,
			);
			const d = FILM_STRIP_DEFAULTS.imageQuote;
			filmStripTopPctByTemplate = {
				...filmStripTopPctByTemplate,
				imageQuote: (filmStripTopPctByTemplate.imageQuote ?? []).map((x, idx) =>
					idx === i ? d.topPct : x,
				),
			};
			filmStripBottomPctByTemplate = {
				...filmStripBottomPctByTemplate,
				imageQuote: (filmStripBottomPctByTemplate.imageQuote ?? []).map((x, idx) =>
					idx === i ? d.bottomPct : x,
				),
			};
			setSlideImage(i, IMAGE_QUOTE_DEFAULTS.imageUrl, 'imageQuote');
		}
	}

	// Parse starter URL flags. Actual blank/template/clip application runs in the auth `onMount` `.finally`
	// so it wins over `loadLatestDraft()` (otherwise the last autosave overwrites “new from template”).
	onMount(() => {
		if (initialTemplateParamApplied) return;
		initialTemplateParamApplied = true;
		if (typeof window === 'undefined') return;
		const params = new URLSearchParams(window.location.search);
		const savedQ = params.get('saved');
		const hasSaved = !!(savedQ && /^[0-9a-f-]{36}$/i.test(savedQ));
		const draftQ = params.get('draft');
		const hasDraft = !!(draftQ && /^[0-9a-f-]{36}$/i.test(draftQ));
		const blankRaw = params.get('blank');
		const fromClip = params.get('from') === 'clip' || !!peekStudioClipImport();
		const fromBulk = params.get('from') === 'bulk' || !!peekBulkImport();

		if (fromBulk && !hasSaved && !hasDraft) {
			skipLatestWorkspaceDraftRestore = true;
			return;
		}

		if (fromClip && !hasSaved && !hasDraft) {
			const payload = peekStudioClipImport();
			const template =
				mapQueryParamToTemplateId(params.get('template')?.trim() ?? '') ??
				payload?.template ??
				'news';
			forcedTemplateFromQuery = template;
			skipLatestWorkspaceDraftRestore = true;
			pendingClipImport = payload;
			return;
		}

		if (!hasSaved && !hasDraft && (blankRaw === '1' || blankRaw === 'true' || blankRaw === 'yes')) {
			forcedBlankFromQuery = true;
			forcedTemplateFromQuery = 'blank';
			return;
		}
		const raw = params.get('template') ?? '';
		const next = mapQueryParamToTemplateId(raw) ?? (raw.trim() ? 'news' : undefined);
		if (!next) return;
		forcedTemplateFromQuery = next;
		if (!hasSaved && !hasDraft) {
			skipLatestWorkspaceDraftRestore = true;
		}
	});

	// Client-side navigations to `/dashboard/studio?template=…` don’t re-run `onMount`; sync from the URL.
	afterNavigate(({ from, to }) => {
		const url = to?.url;
		if (!url) return;
		const pathNoTrailing = url.pathname.replace(/\/+$/, '') || '/';
		if (!pathNoTrailing.endsWith('/studio') || pathNoTrailing.includes('burn-music')) return;

		const fromClip = url.searchParams.get('from') === 'clip' || !!peekStudioClipImport();
		if (fromClip) {
			const peeked = peekStudioClipImport();
			const template =
				mapQueryParamToTemplateId(url.searchParams.get('template')?.trim() ?? '') ??
				peeked?.template ??
				'news';
			forcedTemplateFromQuery = template;
			skipLatestWorkspaceDraftRestore = true;
			if (!clipImportApplied) {
				pendingClipImport = peeked ?? pendingClipImport;
			}
			// Apply now only if studio already finished auth boot (client-side re-entry).
			// On first load, auth `onMount` `.finally` applies — otherwise it wipes the clip.
			if (!clipImportApplied && userId && !draftRestoring) {
				tryApplyPendingClipImport();
			}
			return;
		}

		const savedQ = url.searchParams.get('saved');
		const hasSaved = !!(savedQ && /^[0-9a-f-]{36}$/i.test(savedQ));
		const draftQ = url.searchParams.get('draft');
		const hasDraft = !!(draftQ && /^[0-9a-f-]{36}$/i.test(draftQ));
		const blankRaw = url.searchParams.get('blank');
		if (!hasSaved && !hasDraft && (blankRaw === '1' || blankRaw === 'true' || blankRaw === 'yes')) {
			forcedBlankFromQuery = true;
			forcedTemplateFromQuery = 'blank';
			skipLatestWorkspaceDraftRestore = false;
			applyBlankCanvas();
			return;
		}
		const raw = url.searchParams.get('template')?.trim() ?? '';
		if (!raw) return;
		const next = mapQueryParamToTemplateId(raw) ?? 'news';
		const fromRaw = from?.url.searchParams.get('template')?.trim() ?? '';
		// Same ?template= on from + to (no sidebar re-entry) — keep per-slide template mixes.
		if (fromRaw && fromRaw.toLowerCase() === raw.toLowerCase()) return;
		forcedTemplateFromQuery = next;
		if (!hasSaved && !hasDraft) {
			skipLatestWorkspaceDraftRestore = true;
			// Re-cover with skeleton while filmstrip re-captures (avoids canvas slide-cycle flash).
			filmstripInitialPassPending = true;
			studioSizeTransitions = false;
			bootSkeletonShownAt = typeof performance !== 'undefined' ? performance.now() : 0;
			// Re-lock current display size — don't recompute from a shifting host (that shook the slide).
			if (bootShellW == null || bootShellH == null) {
				const s = fitScaleFor(previewHostW, previewHostH, CANVAS_W, CANVAS_H);
				bootShellW = CANVAS_W * s;
				bootShellH = CANVAS_H * s;
			}
			openFreshTemplateStarter(next);
		} else {
			applyTemplateToAll(next);
			consumeForcedTemplateStarter();
			if (isVideoStoryFamily(next)) {
				canvasBgDark = true;
				if (!textColorTouched) textColor = '#FFFFFF';
			}
		}
	});

	beforeNavigate(({ cancel, to, type }) => {
		if (allowStudioLeave || draftRestoring || !studioHasUnsavedChanges) return;
		if (type === 'leave' && !to) {
			/* full page unload handled by beforeunload */
			return;
		}
		const toPath = (to?.url.pathname ?? '').replace(/\/+$/, '') || '/';
		if (toPath.endsWith('/studio') && !toPath.includes('burn-music')) return;
		cancel();
		pendingLeaveHref = to
			? `${to.url.pathname}${to.url.search}${to.url.hash}`
			: '/dashboard/carousels';
		leaveSaveName = '';
		leaveSaveError = '';
		leavePromptOpen = true;
	});

	// Convenience derived for current active slide text
	const overlayText = $derived(slides[activeSlide] ?? '');
	function setActiveSlideText(val: string) {
		const next = previewTemplate === 'news' ? stripEmDashes(val) : val;
		if ((slides[activeSlide] ?? '') === next) return;
		slides = slides.map((s, i) => (i === activeSlide ? next : s));
	}

	// Post data
	let source = $state('');
	let sourceLogoSrc = $state('');
	/** Always logo for News branding (text byline removed from UI). */
	let sourceLabelMode = $state<'text' | 'logo'>('logo');
	/** Legacy chrome — kept for saved kits; branding UI no longer exposes these. */
	let sourceBorderKind = $state<'none' | 'rules' | 'box'>('none');
	let sourceBorderColor = $state('');
	/** Max width in px for source logo (News template). */
	let sourceLogoWidth = $state(140);
	/** Solid plate behind the News source logo (separate from text-chip bgColor). */
	let sourceLogoPlateColor = $state('');
	let articleUrl = $state('');
	let articleTitle = $state('');

	// Background media — per template, per slide (keep EVERYTHING independent).
	let bgImagesByTemplate = $state<Record<TemplateId, string[]>>(emptyTemplateMediaUrls());
	let bgVideosByTemplate = $state<Record<TemplateId, string[]>>(emptyTemplateMediaUrls()); // blob URLs — per template, per slide
	let generatingImagesByTemplate = $state<Record<TemplateId, boolean[]>>({
		blank: emptySlides(() => false),
		news: emptySlides(() => false),
		tweet: emptySlides(() => false),
		article: emptySlides(() => false),
		textCarousel: emptySlides(() => false),
		imageQuote: emptySlides(() => false),
		videoStory: emptySlides(() => false),
		videoFit: emptySlides(() => false),
		videoSplit: emptySlides(() => false),
		videoBlur: emptySlides(() => false),
		videoHook: emptySlides(() => false),
		videoCreator: emptySlides(() => false),
		videoText: emptySlides(() => false),
		videoSource: emptySlides(() => false),
		videoFeature: emptySlides(() => false),
		videoPost: emptySlides(() => false),
		brandStack: emptySlides(() => false),
		blackText: emptySlides(() => false),
		photoTopic: emptySlides(() => false),
		photoCaption: emptySlides(() => false),
		whiteThread: emptySlides(() => false),
		whiteMedia: emptySlides(() => false),
	}); // per template, per slide

	/** News template only: solid canvas fill when slide has no photo/video (hex or ''). */
	let newsSolidBgBySlide = $state<string[]>(emptySlides(() => ''));

	// Video trim (per slide, seconds) — used for preview and later export.
	let videoTrimStartSecBySlide = $state<number[]>([]);
	let videoTrimEndSecBySlide = $state<number[]>([]);
	let videoDurationBySlide = $state<number[]>([]);
	// Video audio (per slide) — preview only.
	let videoMutedBySlide = $state<boolean[]>([]);
	let videoVolumeBySlide = $state<number[]>([]);
	let showVideoTrim = $state(false);
	/** Quick action: solid News background color picker */
	let solidBgPopoverOpen = $state(false);
	let videoSeekSec = $state<number>(NaN);
	let trimDrag = $state<null | { start: number; end: number; startX: number; w: number }>(null);

	const activeVideoTrimStartSec = $derived(videoTrimStartSecBySlide[activeSlide] ?? 0);
	const activeVideoTrimEndSec = $derived(videoTrimEndSecBySlide[activeSlide] ?? 0);
	const activeVideoDurationSec = $derived(videoDurationBySlide[activeSlide] ?? 0);
	const activeVideoMuted = $derived(videoMutedBySlide[activeSlide] ?? true);
	const activeVideoVolume = $derived(videoVolumeBySlide[activeSlide] ?? 0.8);

	function fmtTime(sec: number) {
		const s = Math.max(0, Number(sec) || 0);
		const m = Math.floor(s / 60);
		const r = Math.floor(s % 60);
		const mm = String(m).padStart(2, '0');
		const rr = String(r).padStart(2, '0');
		return `${mm}:${rr}`;
	}

	function setActiveTrimWindow(start: number, end: number) {
		const dur = Math.max(0, activeVideoDurationSec || 0);
		const len = Math.max(0.05, end - start);
		const s = Math.max(0, Math.min(dur - len, start));
		const e = Math.max(s + 0.05, Math.min(dur, s + len));
		videoTrimStartSecBySlide = Array.from(
			{ length: slides.length },
			(_, i) => (i === activeSlide ? s : (Number.isFinite(videoTrimStartSecBySlide[i]) ? Math.max(0, videoTrimStartSecBySlide[i]) : 0))
		);
		videoTrimEndSecBySlide = Array.from(
			{ length: slides.length },
			(_, i) => (i === activeSlide ? e : (Number.isFinite(videoTrimEndSecBySlide[i]) ? Math.max(0, videoTrimEndSecBySlide[i]) : 0))
		);
	}

	// Keep per-slide video audio state arrays sized correctly.
	// (Important: many updates use `.map`, which is a no-op if the array is empty.)
	$effect(() => {
		const n = slides.length;
		if (textOffsetsBySlide.length !== n) {
			textOffsetsBySlide = Array.from({ length: n }, (_, i) => {
				const row = textOffsetsBySlide[i];
				return row && typeof row === 'object' ? row : {};
			});
		}
		if (videoTrimStartSecBySlide.length !== n) {
			videoTrimStartSecBySlide = Array.from({ length: n }, (_, i) => {
				const v = videoTrimStartSecBySlide[i];
				return Number.isFinite(v) ? Math.max(0, v) : 0;
			});
		}
		if (videoTrimEndSecBySlide.length !== n) {
			videoTrimEndSecBySlide = Array.from({ length: n }, (_, i) => {
				const v = videoTrimEndSecBySlide[i];
				return Number.isFinite(v) ? Math.max(0, v) : 0;
			});
		}
		if (videoDurationBySlide.length !== n) {
			videoDurationBySlide = Array.from({ length: n }, (_, i) => {
				const v = videoDurationBySlide[i];
				return Number.isFinite(v) ? Math.max(0, v) : 0;
			});
		}
		if (videoMutedBySlide.length !== n) {
			videoMutedBySlide = Array.from({ length: n }, (_, i) => videoMutedBySlide[i] ?? true);
		}
		if (videoVolumeBySlide.length !== n) {
			videoVolumeBySlide = Array.from({ length: n }, (_, i) => {
				const v = videoVolumeBySlide[i];
				return Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0.8;
			});
		}
	});

	// Per-slide music (persisted on drafts). Marks a slide as video-on-publish when set.
	type MusicTrack = { id: string; name: string; url?: string };
	let slideMusic = $state<(MusicTrack | null)[]>([]);
	let musicPickerForSlide = $state<number | null>(null);
	/** Filmstrip “+” menu: pick a template and reuse the current slide’s clip. */
	let addSlideMenuOpen = $state(false);
	/** Fixed coords so the menu isn’t clipped by filmstrip/overflow-hidden ancestors. */
	let addSlideMenuPos = $state<{ bottom: number; right: number } | null>(null);

	// Subject cutouts — transparent PNG of the foreground subject, per slide.
	// When set + `showCutout` true for a slide, we layer the cutout over the circle
	// so the subject appears to be in front (like editorial news graphics).
	let subjectCutouts = $state<string[]>([]);
	let showCutout = $state<boolean[]>([]); // per-slide toggle, default true when cutout exists
	let cuttingOut = $state<boolean[]>([]); // per-slide loading
	let cutoutProgress = $state<number>(0); // 0..1 for the active slide
	let cutoutMessage = $state<string>('');
	let cutoutError = $state<string>('');

	// ── R2 media refs (saved templates) ────────────────────────────────────
	// Saved templates can store media as `r2:<key>` instead of giant data URLs.
	// Resolution logic lives in `$lib/studio/r2-media-resolve.ts` (single source of truth).
	let r2ResolvedUrlByKey = $state<Record<string, string>>({});
	const r2Resolving = new Set<string>();
	const r2ResolvingPromises = new Map<string, Promise<void>>();

	async function ensureR2Resolved(refOrUrl: string) {
		await ensureR2RefLoaded(
			refOrUrl,
			r2ResolvedUrlByKey,
			r2Resolving,
			r2SignRead,
			(key, url) => {
				r2ResolvedUrlByKey = { ...r2ResolvedUrlByKey, [key]: url };
			},
			r2ResolvingPromises,
		);
	}

	function resolveMediaUrl(u: unknown): string {
		return resolveStoredMediaUrl(u, r2ResolvedUrlByKey);
	}

	const activeCutout = $derived(resolveMediaUrl(subjectCutouts[activeSlide] ?? ''));
	const activeShowCutout = $derived(showCutout[activeSlide] ?? false);
	const activeCutting = $derived(cuttingOut[activeSlide] ?? false);
	/** Primary news circle: per-slide visibility (slide 0 defaults on; add Shape on other slides if desired). */
	let showCircleBySlide = $state<boolean[]>(emptySlides(() => false));
	// Circle images are per-slide (so each slide can have its own badge photo).
	let circleImages = $state<string[]>(emptySlides(() => ''));
	let circleBorderColor = $state('#FFFFFF');
	let circleShadow = $state({ ...DEFAULT_CIRCLE_SHADOW });
	// Optional second circle is also per-slide.
	let showCircle2BySlide = $state<boolean[]>([]);
	let circle2Images = $state<string[]>([]);
	let circle2BorderColor = $state('#FFFFFF');
	let circle2Shadow = $state({ ...DEFAULT_CIRCLE_SHADOW });
	let generatingCircle = $state(false);
	let bgError = $state('');

	const activeCircleImage = $derived(resolveMediaUrl(circleImages[activeSlide] ?? ''));
	const activeCircle2Image = $derived(resolveMediaUrl(circle2Images[activeSlide] ?? ''));
	const activeShowCircle2 = $derived(showCircle2BySlide[activeSlide] ?? false);

	// Convenience: active template's image / video (News uses these; other templates can too)
	const backgroundImage = $derived(resolveMediaUrl((bgImagesByTemplate[activeTemplate] ?? [])[activeSlide] ?? ''));
	const backgroundVideo = $derived(
		resolveMediaUrl((bgVideosByTemplate[activeTemplate] ?? [])[activeSlide] ?? ''),
	);
	/** URL used for “is there a video on this slide?” (includes Video Story’s default template clip when none is set). */
	const effectiveBackgroundVideo = $derived.by(() => {
		const v = String(backgroundVideo ?? '').trim();
		if (v) return v;
		if (activeTemplate === 'videoStory') return VIDEO_STORY_DEFAULTS.videoUrl;
		if (activeTemplate === 'brandStack') return BRAND_STACK_DEFAULTS.topVideoUrl;
		if (activeTemplate === 'videoSplit') return VIDEO_SPLIT_DEFAULTS.videoUrl;
		return '';
	});

	/** Tweet/article/etc. media arrays start empty; `.map` on [] does nothing without padding first. */
	function templateMediaArraysPadded(template: TemplateId, slideIdx: number) {
		const needLen = Math.max(slides.length, slideIdx + 1);
		const padStr = (arr: string[] | undefined) => {
			const a = [...(arr ?? [])];
			while (a.length < needLen) a.push('');
			return a;
		};
		const padBool = (arr: boolean[] | undefined) => {
			const a = [...(arr ?? [])];
			while (a.length < needLen) a.push(false);
			return a;
		};
		return {
			images: padStr(bgImagesByTemplate[template]),
			videos: padStr(bgVideosByTemplate[template]),
			generating: padBool(generatingImagesByTemplate[template]),
		};
	}

	/** Reset News background fit/zoom/pan for a freshly loaded article/API image (full-bleed cover). */
	function applyNewsSeedBackgroundLayout() {
		bgOffsetX = NEWS_DEFAULT_LAYOUT.bgOffsetX;
		bgOffsetY = NEWS_DEFAULT_LAYOUT.bgOffsetY;
		bgZoom = NEWS_DEFAULT_LAYOUT.bgZoom;
		bgFitMode = NEWS_DEFAULT_LAYOUT.bgFitMode;
		bgContainMagnify = NEWS_DEFAULT_LAYOUT.bgContainMagnify;
	}

	function setSlideImage(i: number, url: string, template: TemplateId = 'news') {
		// If we’re replacing a blob URL, revoke it to keep memory stable.
		const prev = (bgImagesByTemplate[template] ?? [])[i];
		if (prev?.startsWith('blob:') && prev !== url) URL.revokeObjectURL(prev);

		const { images, videos, generating } = templateMediaArraysPadded(template, i);

		bgImagesByTemplate = {
			...bgImagesByTemplate,
			[template]: images.map((img, idx) => idx === i ? url : img),
		};
		bgVideosByTemplate = {
			...bgVideosByTemplate,
			[template]: videos.map((v, idx) => idx === i ? '' : v),
		};
		generatingImagesByTemplate = {
			...generatingImagesByTemplate,
			[template]: generating.map((v, idx) => idx === i ? false : v),
		};
		if ((template === 'news' || template === 'blank') && String(url ?? '').trim()) {
			newsSolidBgBySlide = Array.from({ length: slides.length }, (_, idx) =>
				idx === i ? '' : (newsSolidBgBySlide[idx] ?? '')
			);
		}
		// Invalidate any existing cutout since it was computed from the old image.
		if (template === 'news') {
			subjectCutouts = subjectCutouts.map((v, idx) => idx === i ? '' : v);
			showCutout    = showCutout.map((v, idx) => idx === i ? false : v);
		}
	}

	async function blobToDataUrl(blob: Blob): Promise<string> {
		return await new Promise((resolve, reject) => {
			const reader = new FileReader();
			reader.onload = () => resolve(String(reader.result ?? ''));
			reader.onerror = () => reject(new Error('Could not read image blob'));
			reader.readAsDataURL(blob);
		});
	}

	/** Convert remote / R2 images to data URLs so html-to-image can rasterize without CORS taint. */
	async function toExportSafeImageUrl(url: string) {
		let src = String(url ?? '').trim();
		if (!src) return '';
		if (src.startsWith('data:')) return src;
		if (isR2Ref(src)) {
			await ensureR2Resolved(src);
			src = resolveMediaUrl(src);
			if (!src) return '';
		}
		// blob: must become data: — html-to-image cacheBust / re-fetch can break blob URLs.
		if (src.startsWith('blob:')) {
			try {
				const res = await fetch(src, { signal: AbortSignal.timeout(30_000) });
				if (!res.ok) return src;
				return await blobToDataUrl(await res.blob());
			} catch {
				return src;
			}
		}

		// Same-origin path or absolute URL on this host — fetch locally (accepts WebP/PNG/JPEG).
		const origin = typeof window !== 'undefined' ? window.location.origin : '';
		const isSameOriginAbs = !!origin && src.startsWith(origin);
		const isRel = src.startsWith('/') && !src.startsWith('//');
		if (isRel || isSameOriginAbs) {
			try {
				const res = await fetch(isRel ? src : src, { signal: AbortSignal.timeout(30_000) });
				if (!res.ok) return src;
				const blob = await res.blob();
				if (!blob.type.startsWith('image/') && blob.size > 0) {
					// Some servers omit type; still try
				}
				return await blobToDataUrl(blob);
			} catch {
				return src;
			}
		}

		if (src.startsWith('http://') || src.startsWith('https://')) {
			try {
				const res = await fetch('/api/media/to-data-url', {
					method: 'POST',
					headers: { 'content-type': 'application/json' },
					body: JSON.stringify({ url: src }),
					signal: AbortSignal.timeout(45_000),
				});
				const data = await res.json();
				if (res.ok && data?.ok && typeof data.dataUrl === 'string') return data.dataUrl;
			} catch {
				// ignore
			}
		}
		return src;
	}

	/** Rewrite in-memory slide images that would taint canvas export (http(s) / r2). */
	async function materializeRemoteImagesForExport() {
		const mapRow = async (row: string[] | undefined): Promise<string[]> => {
			const arr = [...(row ?? [])];
			for (let i = 0; i < arr.length; i++) {
				const cur = String(arr[i] ?? '').trim();
				if (!cur) continue;
				if (cur.startsWith('data:')) continue;
				if (
					isR2Ref(cur) ||
					cur.startsWith('http://') ||
					cur.startsWith('https://') ||
					cur.startsWith('/') ||
					cur.startsWith('blob:')
				) {
					const safe = await toExportSafeImageUrl(cur);
					if (safe && safe !== cur) arr[i] = safe;
				}
			}
			return arr;
		};

		const nextBg: Record<TemplateId, string[]> = { ...bgImagesByTemplate } as Record<TemplateId, string[]>;
		for (const key of Object.keys(nextBg) as TemplateId[]) {
			nextBg[key] = await mapRow(nextBg[key]);
		}
		bgImagesByTemplate = nextBg;

		circleImages = await mapRow(circleImages);
		circle2Images = await mapRow(circle2Images);
		subjectCutouts = await mapRow(subjectCutouts);
		brandStackBottomMediaBySlide = await mapRow(brandStackBottomMediaBySlide);
		textCarouselAvatarImageBySlide = await mapRow(textCarouselAvatarImageBySlide);

		const logo = String(sourceLogoSrc ?? '').trim();
		if (logo && !logo.startsWith('data:')) {
			const safeLogo = await toExportSafeImageUrl(logo);
			if (safeLogo) sourceLogoSrc = safeLogo;
		}

		const ctaImg = String(brandCta?.image ?? '').trim();
		if (ctaImg && !ctaImg.startsWith('data:')) {
			const safeCta = await toExportSafeImageUrl(ctaImg);
			if (safeCta) brandCta = { ...brandCta, image: safeCta };
		}

		// Stickers / logos on the canvas — often still `r2:` or signed https.
		const nextOverlays: Record<TemplateId, Overlay[][]> = {
			...(slideOverlaysByTemplate as Record<TemplateId, Overlay[][]>),
		};
		for (const key of Object.keys(nextOverlays) as TemplateId[]) {
			const slidesRow = nextOverlays[key] ?? [];
			nextOverlays[key] = await Promise.all(
				slidesRow.map(async (row) => {
					if (!row?.length) return row ?? [];
					return Promise.all(
						row.map(async (o) => {
							const cur = String(o?.src ?? '').trim();
							if (!cur || cur.startsWith('data:')) return o;
							if (
								!(
									isR2Ref(cur) ||
									cur.startsWith('http://') ||
									cur.startsWith('https://') ||
									cur.startsWith('/') ||
									cur.startsWith('blob:')
								)
							) {
								return o;
							}
							const safe = await toExportSafeImageUrl(cur);
							return safe && safe !== cur ? { ...o, src: safe } : o;
						}),
					);
				}),
			);
		}
		slideOverlaysByTemplate = nextOverlays;

		await tick();
	}

	/** Rewrite remote / R2 video backgrounds to same-origin blob URLs for canvas export. */
	async function materializeRemoteVideosForExport() {
		const next: Record<TemplateId, string[]> = { ...bgVideosByTemplate } as Record<TemplateId, string[]>;
		for (const key of Object.keys(next) as TemplateId[]) {
			const row = [...(next[key] ?? [])];
			for (let i = 0; i < row.length; i++) {
				const cur = String(row[i] ?? '').trim();
				if (!cur) continue;
				if (cur.startsWith('blob:') || cur.startsWith('data:')) continue;
				let remote = cur;
				if (isR2Ref(cur)) {
					await ensureR2Resolved(cur);
					remote = resolveMediaUrl(cur);
				}
				if (!(remote.startsWith('http://') || remote.startsWith('https://'))) continue;
				try {
					const blobUrl = await fetchRemoteVideoAsBlobUrl(remote);
					row[i] = blobUrl;
				} catch (e) {
					console.warn('[studio] could not materialize video for export', remote, e);
					throw new Error(
						e instanceof Error
							? e.message
							: 'Could not download background video for export. Try re-applying the Pexels video.',
					);
				}
			}
			next[key] = row;
		}
		bgVideosByTemplate = next;
		await tick();
		// Give <video> elements a moment to attach the new blob src.
		await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
	}

	async function rasterizeExportNode(
		node: HTMLElement,
		opts: {
			width: number;
			height: number;
			pixelRatio?: number;
			backgroundColor?: string;
			/** Overlay letterbox for templates that don't bake bars into layout. */
			letterbox?: { topPct: number; bottomPct: number } | null;
		},
	): Promise<string> {
		// Wait for any background <video> to decode at least one frame.
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
						// Safety timeout so export never hangs on a broken src.
						setTimeout(done, 6000);
					}),
			),
		);
		const restoreVideos = await replaceVideosWithFrameImages(node);
		const restoreImgs = await materializeDomImagesForExport(node, toExportSafeImageUrl);
		const letterboxCleanup = (() => {
			const lb = opts.letterbox;
			if (!lb || (lb.topPct <= 0 && lb.bottomPct <= 0)) return () => {};
			const prevPos = node.style.position;
			if (!prevPos || prevPos === 'static') node.style.position = 'relative';
			const bars: HTMLElement[] = [];
			const addBar = (side: 'top' | 'bottom', pct: number) => {
				if (pct <= 0) return;
				const el = document.createElement('div');
				el.setAttribute('data-studio-export-letterbox', side);
				el.style.cssText = `position:absolute;left:0;right:0;${side}:0;height:${pct}%;background:#000;z-index:9999;pointer-events:none;`;
				node.appendChild(el);
				bars.push(el);
			};
			addBar('top', lb.topPct);
			addBar('bottom', lb.bottomPct);
			return () => {
				for (const el of bars) el.remove();
				node.style.position = prevPos;
			};
		})();
		try {
			try {
				await (document as any).fonts?.ready;
			} catch {
				/* ignore */
			}
			return await toPng(node, {
				width: opts.width,
				height: opts.height,
				pixelRatio: opts.pixelRatio ?? 1,
				backgroundColor: opts.backgroundColor,
				style: { transform: 'scale(1)', transformOrigin: 'top left' },
				filter: (n: HTMLElement) => n.tagName !== 'VIDEO',
				...SAFE_HTML_TO_IMAGE_OPTS,
			} as any);
		} finally {
			letterboxCleanup();
			restoreImgs();
			restoreVideos();
		}
	}

	function letterboxForExport(): { topPct: number; bottomPct: number } | null {
		if (usesStructuralFilmStrip(previewTemplate)) return null;
		const lb = paintFilmStrip;
		if (lb.topPct <= 0 && lb.bottomPct <= 0) return null;
		return lb;
	}

	function setSlideVideo(i: number, url: string, template: TemplateId = 'news') {
		const { images, videos, generating } = templateMediaArraysPadded(template, i);
		const prevVid = videos[i];
		if (prevVid?.startsWith('blob:') && prevVid !== url) URL.revokeObjectURL(prevVid);

		bgVideosByTemplate = {
			...bgVideosByTemplate,
			[template]: videos.map((v, idx) => idx === i ? url : v),
		};
		bgImagesByTemplate = {
			...bgImagesByTemplate,
			[template]: images.map((img, idx) => idx === i ? '' : img),
		};
		generatingImagesByTemplate = {
			...generatingImagesByTemplate,
			[template]: generating.map((v, idx) => idx === i ? false : v),
		};
		if ((template === 'news' || template === 'blank') && String(url ?? '').trim()) {
			newsSolidBgBySlide = Array.from({ length: slides.length }, (_, idx) =>
				idx === i ? '' : (newsSolidBgBySlide[idx] ?? '')
			);
		}
		// Cutout was derived from the photo — drop it when switching to video.
		if (template === 'news') {
			subjectCutouts = subjectCutouts.map((v, idx) => (idx === i ? '' : v));
			showCutout = showCutout.map((v, idx) => (idx === i ? false : v));
		}
		// Reset trim to "full" until duration is known.
		videoTrimStartSecBySlide = Array.from({ length: slides.length }, (_, idx) => (idx === i ? 0 : (Number.isFinite(videoTrimStartSecBySlide[idx]) ? Math.max(0, videoTrimStartSecBySlide[idx]) : 0)));
		videoTrimEndSecBySlide = Array.from({ length: slides.length }, (_, idx) => (idx === i ? 0 : (Number.isFinite(videoTrimEndSecBySlide[idx]) ? Math.max(0, videoTrimEndSecBySlide[idx]) : 0)));
		videoDurationBySlide = Array.from({ length: slides.length }, (_, idx) => (idx === i ? 0 : (Number.isFinite(videoDurationBySlide[idx]) ? Math.max(0, videoDurationBySlide[idx]) : 0)));
		// Default audio to muted (autoplay-safe). User can unmute via the speaker button.
		videoMutedBySlide = Array.from({ length: slides.length }, (_, idx) => (idx === i ? true : (videoMutedBySlide[idx] ?? true)));
		videoVolumeBySlide = Array.from({ length: slides.length }, (_, idx) => {
			if (idx !== i) return Number.isFinite(videoVolumeBySlide[idx]) ? Math.max(0, Math.min(1, videoVolumeBySlide[idx])) : 0.8;
			const cur = videoVolumeBySlide[idx];
			return Number.isFinite(cur) ? Math.max(0, Math.min(1, cur)) : 0.8;
		});
		videoSeekSec = NaN;
	}

	function setBrandStackBottomMedia(i: number, url: string) {
		const prev = brandStackBottomMediaBySlide[i];
		if (prev?.startsWith('blob:') && prev !== url) URL.revokeObjectURL(prev);
		brandStackBottomMediaBySlide = brandStackBottomMediaBySlide.map((x, idx) => (idx === i ? url : x));
	}

	function clearSlideBackground(i: number) {
		const template = coerceTemplateId(slideTemplates[i] ?? lastTemplateUsed);
		const { images, videos } = templateMediaArraysPadded(template, i);
		const old = videos[i];
		if (old?.startsWith('blob:')) URL.revokeObjectURL(old);
		bgVideosByTemplate = { ...bgVideosByTemplate, [template]: videos.map((v, idx) => idx === i ? '' : v) };
		bgImagesByTemplate = { ...bgImagesByTemplate, [template]: images.map((img, idx) => idx === i ? '' : img) };
		if (template === 'news' || template === 'blank') {
			newsSolidBgBySlide = Array.from({ length: slides.length }, (_, idx) =>
				idx === i ? '' : (newsSolidBgBySlide[idx] ?? '')
			);
		}
		if (template === 'news') {
			subjectCutouts = subjectCutouts.map((v, idx) => (idx === i ? '' : v));
			showCutout = showCutout.map((v, idx) => (idx === i ? false : v));
		}
		videoTrimStartSecBySlide = Array.from({ length: slides.length }, (_, idx) => (idx === i ? 0 : (Number.isFinite(videoTrimStartSecBySlide[idx]) ? Math.max(0, videoTrimStartSecBySlide[idx]) : 0)));
		videoTrimEndSecBySlide = Array.from({ length: slides.length }, (_, idx) => (idx === i ? 0 : (Number.isFinite(videoTrimEndSecBySlide[idx]) ? Math.max(0, videoTrimEndSecBySlide[idx]) : 0)));
		videoDurationBySlide = Array.from({ length: slides.length }, (_, idx) => (idx === i ? 0 : (Number.isFinite(videoDurationBySlide[idx]) ? Math.max(0, videoDurationBySlide[idx]) : 0)));
		videoMutedBySlide = Array.from({ length: slides.length }, (_, idx) => (idx === i ? true : (videoMutedBySlide[idx] ?? true)));
		videoVolumeBySlide = Array.from({ length: slides.length }, (_, idx) => (idx === i ? 0.8 : (Number.isFinite(videoVolumeBySlide[idx]) ? Math.max(0, Math.min(1, videoVolumeBySlide[idx])) : 0.8)));
		if (i === activeSlide) { showVideoTrim = false; videoSeekSec = NaN; }
	}

	// Style
	let highlightColor = $state('#F5A623');
	let brandTextBgColor = $state('');
	/** Default look for bare `[[phrase]]` from AI / Load & Fill. */
	let highlightStyleKind = $state<StudioHighlightStyleKind>('solid');
	let highlightGradientFrom = $state('#FFFFFF');
	let highlightGradientTo = $state('#F5A623');
	let highlightPattern = $state<string>(AVAILABLE_PATTERNS[0]?.name ?? 'light-blue');
	/** Sidebar + fetch: when false, no `[[…]]` markup from AI and no highlight swatches on the floating text toolbar. */
	let studioTextHighlightsEnabled = $state(true);

	const studioHighlightDefaults = $derived.by((): HighlightDefaults => {
		if (highlightStyleKind === 'gradient') {
			return {
				color: highlightColor,
				gradientFrom: highlightGradientFrom,
				gradientTo: highlightGradientTo,
			};
		}
		if (highlightStyleKind === 'pattern') {
			return { color: highlightColor, pattern: highlightPattern };
		}
		return { color: highlightColor };
	});
	// Default to light-mode friendly; updated onMount to match global theme.
	let textColor = $state('#0a0a0a');
	let textColorTouched = $state(false);
	let uiTheme = $state<'light' | 'dark'>('light');
	/** Studio canvas fill: white vs black (independent of dashboard chrome theme). */
	let canvasBgDark = $state(false);
	const canvasTheme = $derived<'light' | 'dark'>(canvasBgDark ? 'dark' : 'light');
	const canvasSolidHex = $derived(canvasBgDark ? '#000000' : '#ffffff');

	const textCarouselDefaultAvatarBg = $derived(canvasBgDark ? '#0a0a0a' : '#ffffff');
	const defaultAvatarRingColor = '#c9b97a';
	const defaultTweetAvatarRingWidth = 4;
	const defaultTextCarouselRingWidth = 5;

	function setCanvasBackgroundDark(dark: boolean) {
		if (canvasBgDark === dark) return;
		pushUndo(previewTemplate, paintSlide);
		canvasBgDark = dark;
		studioHasUnsavedChanges = true;
		if (!textColorTouched) {
			textColor = dark ? '#FFFFFF' : '#0a0a0a';
		}
		const hex = dark ? '#000000' : '#ffffff';
		// Persist solid fill for templates that paint from `newsSolidBgBySlide`.
		// Video / highlight / photo layouts read `canvasSolidHex` via `bgColor`.
		const t = previewTemplate;
		if (t === 'news' || t === 'blank') {
			newsSolidBgBySlide = Array.from({ length: slides.length }, (_, i) =>
				i === paintSlide ? hex : (newsSolidBgBySlide[i] ?? ''),
			);
		}
	}
	onMount(() => {
		const readTheme = (): 'light' | 'dark' => (document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light');
		uiTheme = readTheme();

		// If user hasn't manually set text color, keep it sensible per theme.
		if (!textColorTouched) {
			textColor = uiTheme === 'dark' ? '#FFFFFF' : '#0a0a0a';
		}

		const onBeforeUnload = (e: BeforeUnloadEvent) => {
			if (!studioHasUnsavedChanges || allowStudioLeave) return;
			e.preventDefault();
			e.returnValue = '';
		};
		window.addEventListener('beforeunload', onBeforeUnload);

		const obs = new MutationObserver(() => clearStuckBodyLockIfIdle());
		obs.observe(document.body, { attributes: true, attributeFilter: ['style'] });
		const bodyLockPoll = window.setInterval(clearStuckBodyLockIfIdle, 1500);
		forceUnlockStudioUI();

		const themeObs = new MutationObserver(() => {
			const next = readTheme();
			if (next === uiTheme) return;
			uiTheme = next;
			if (!textColorTouched) {
				textColor = uiTheme === 'dark' ? '#FFFFFF' : '#0a0a0a';
			}
		});
		themeObs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
		return () => {
			window.removeEventListener('beforeunload', onBeforeUnload);
			obs.disconnect();
			themeObs.disconnect();
			window.clearInterval(bodyLockPoll);
			clearDocumentBodyPointerLock();
		};
	});

	// ── Grid (global, applies to all slides/exports) ──────────────────────
	// Grid overlay removed from UI (kept out of the product for now).

	// Canvas editing — circle position + size (template coordinates)
	let circleX    = $state(772);
	let circleY    = $state(52);
	let circleSize = $state(300); // diameter in template px (studio + News badge)
	let circle2X    = $state(80);
	let circle2Y    = $state(80);
	let circle2Size = $state(220);

	// Background pan (extended range for extra drag headroom; template clamps)
	let bgOffsetX = $state(50); // horizontal focal point (≈0–100 typical; wider allowed)
	let bgOffsetY = $state(50); // vertical focal point
	let bgZoom    = $state(100); // background zoom %: <100 shrinks/letterboxes, >100 zooms in (cover mode only)
	let bgFitMode = $state<'cover' | 'contain'>('cover'); // cover = full-bleed (Videos preview); contain = letterbox + magnify
	let bgContainMagnify = $state(140); // 50–400%, only when bgFitMode === 'contain'

	// Text panel drag (template px)
	let textPanelOffsetY = $state(0);
	let assetsCollapsed = $state(true);
	const studioIsMobile = new IsMobile();
	let studioAssetsLayoutInit = false;
	$effect(() => {
		void studioIsMobile.current;
		if (studioAssetsLayoutInit) return;
		if (typeof window === 'undefined') return;
		studioAssetsLayoutInit = true;
		if (!studioIsMobile.current) assetsCollapsed = false;
	});
	/** Per-slide News bottom vignette — height tracks each slide’s text stack independently. */
	let shadowHeightBySlide = $state<number[]>(
		emptySlides(() => NEWS_DEFAULT_LAYOUT.shadowHeight),
	);
	let shadowStrengthBySlide = $state<number[]>(emptySlides(() => NEWS_DEFAULT_LAYOUT.shadowStrength));
	let shadowCurveBySlide = $state<BottomShadowCurve[]>(
		emptySlides(() => NEWS_DEFAULT_LAYOUT.shadowCurve),
	);
	let shadowColorBySlide = $state<string[]>(
		emptySlides(() => NEWS_DEFAULT_LAYOUT.shadowColor),
	);
	let shadowAutoFitBySlide = $state<boolean[]>(emptySlides(() => true));
	/** Live bindables for the painted slide (synced ↔ BySlide arrays). */
	let shadowHeight = $state(NEWS_DEFAULT_LAYOUT.shadowHeight);
	let shadowStrength = $state(NEWS_DEFAULT_LAYOUT.shadowStrength);
	let shadowCurve = $state<BottomShadowCurve>(NEWS_DEFAULT_LAYOUT.shadowCurve);
	let shadowColor = $state(NEWS_DEFAULT_LAYOUT.shadowColor);
	let shadowAutoFit = $state(true);
	/** Tracks which slide the live shadow bindables currently mirror. */
	let shadowPaintSlideSync = $state(-1);

	function padShadowBySlide(len = slides.length) {
		const n = Math.max(1, len);
		const padNum = (arr: number[], fallback: number) =>
			Array.from({ length: n }, (_, i) => {
				const v = Number(arr[i]);
				return Number.isFinite(v) ? v : fallback;
			});
		const padCurve = (arr: BottomShadowCurve[]) =>
			Array.from({ length: n }, (_, i) => normalizeBottomShadowCurve(arr[i]));
		const padBool = (arr: boolean[], fallback: boolean) =>
			Array.from({ length: n }, (_, i) => (typeof arr[i] === 'boolean' ? arr[i]! : fallback));
		if (shadowHeightBySlide.length !== n) {
			shadowHeightBySlide = padNum(shadowHeightBySlide, NEWS_DEFAULT_LAYOUT.shadowHeight);
		}
		if (shadowStrengthBySlide.length !== n) {
			shadowStrengthBySlide = padNum(shadowStrengthBySlide, NEWS_DEFAULT_LAYOUT.shadowStrength);
		}
		if (shadowCurveBySlide.length !== n) {
			shadowCurveBySlide = padCurve(shadowCurveBySlide);
		}
		if (shadowColorBySlide.length !== n) {
			shadowColorBySlide = Array.from({ length: n }, (_, i) =>
				normalizeBottomShadowColor(shadowColorBySlide[i] ?? NEWS_DEFAULT_LAYOUT.shadowColor),
			);
		}
		if (shadowAutoFitBySlide.length !== n) {
			shadowAutoFitBySlide = padBool(shadowAutoFitBySlide, true);
		}
	}

	function shadowHeightAt(i: number): number {
		const v = Number(shadowHeightBySlide[i]);
		return Number.isFinite(v) ? v : NEWS_DEFAULT_LAYOUT.shadowHeight;
	}

	function shadowStrengthAt(i: number): number {
		const v = Number(shadowStrengthBySlide[i]);
		return Number.isFinite(v) ? v : NEWS_DEFAULT_LAYOUT.shadowStrength;
	}

	function shadowCurveAt(i: number): BottomShadowCurve {
		return normalizeBottomShadowCurve(shadowCurveBySlide[i]);
	}

	function shadowColorAt(i: number): string {
		return normalizeBottomShadowColor(shadowColorBySlide[i] ?? NEWS_DEFAULT_LAYOUT.shadowColor);
	}

	function shadowAutoFitAt(i: number): boolean {
		return shadowAutoFitBySlide[i] !== false;
	}

	function setSlideShadow(
		i: number,
		next: {
			height?: number;
			strength?: number;
			curve?: BottomShadowCurve;
			color?: string;
			autoFit?: boolean;
		},
	) {
		padShadowBySlide();
		if (i < 0 || i >= shadowHeightBySlide.length) return;
		if (typeof next.height === 'number' && Number.isFinite(next.height)) {
			const h = Math.max(0, Math.min(100, next.height));
			if (Math.abs(shadowHeightAt(i) - h) > 0.05) {
				shadowHeightBySlide = shadowHeightBySlide.map((x, idx) => (idx === i ? h : x));
			}
		}
		if (typeof next.strength === 'number' && Number.isFinite(next.strength)) {
			const s = Math.max(0, Math.min(1, next.strength));
			if (Math.abs(shadowStrengthAt(i) - s) > 0.01) {
				shadowStrengthBySlide = shadowStrengthBySlide.map((x, idx) => (idx === i ? s : x));
			}
		}
		if (next.curve != null) {
			const c = normalizeBottomShadowCurve(next.curve);
			if (shadowCurveAt(i) !== c) {
				shadowCurveBySlide = shadowCurveBySlide.map((x, idx) => (idx === i ? c : x));
			}
		}
		if (next.color != null) {
			const col = normalizeBottomShadowColor(next.color);
			if (shadowColorAt(i) !== col) {
				shadowColorBySlide = shadowColorBySlide.map((x, idx) => (idx === i ? col : x));
			}
		}
		if (typeof next.autoFit === 'boolean' && shadowAutoFitAt(i) !== next.autoFit) {
			shadowAutoFitBySlide = shadowAutoFitBySlide.map((x, idx) => (idx === i ? next.autoFit! : x));
		}
		if (i === (canvasRasterSlide ?? activeSlide)) {
			if (typeof next.height === 'number' && Number.isFinite(next.height)) {
				shadowHeight = Math.max(0, Math.min(100, next.height));
			}
			if (typeof next.strength === 'number' && Number.isFinite(next.strength)) {
				shadowStrength = Math.max(0, Math.min(1, next.strength));
			}
			if (next.curve != null) shadowCurve = normalizeBottomShadowCurve(next.curve);
			if (next.color != null) shadowColor = normalizeBottomShadowColor(next.color);
			if (typeof next.autoFit === 'boolean') shadowAutoFit = next.autoFit;
		}
	}

	function resetAllShadowHeights(height = NEWS_DEFAULT_LAYOUT.shadowHeight) {
		padShadowBySlide();
		shadowHeightBySlide = shadowHeightBySlide.map(() => height);
		shadowHeight = height;
	}

	function resetAllShadows(opts?: {
		height?: number;
		strength?: number;
		curve?: BottomShadowCurve;
		color?: string;
		autoFit?: boolean;
	}) {
		const h = opts?.height ?? NEWS_DEFAULT_LAYOUT.shadowHeight;
		const s = opts?.strength ?? NEWS_DEFAULT_LAYOUT.shadowStrength;
		const c = normalizeBottomShadowCurve(opts?.curve ?? NEWS_DEFAULT_LAYOUT.shadowCurve);
		const col = normalizeBottomShadowColor(opts?.color ?? NEWS_DEFAULT_LAYOUT.shadowColor);
		const a = opts?.autoFit ?? true;
		padShadowBySlide();
		shadowHeightBySlide = shadowHeightBySlide.map(() => h);
		shadowStrengthBySlide = shadowStrengthBySlide.map(() => s);
		shadowCurveBySlide = shadowCurveBySlide.map(() => c);
		shadowColorBySlide = shadowColorBySlide.map(() => col);
		shadowAutoFitBySlide = shadowAutoFitBySlide.map(() => a);
		shadowHeight = h;
		shadowStrength = s;
		shadowCurve = c;
		shadowColor = col;
		shadowAutoFit = a;
	}

	/** Keep the News vignette at the default floor after generate / layout restore. */
	function ensureNewsShadowCoverage() {
		padShadowBySlide();
		let changed = false;
		const nextH = shadowHeightBySlide.map((h, i) => {
			const strength = shadowStrengthAt(i);
			if (strength <= 0 || h < NEWS_DEFAULT_LAYOUT.shadowHeight) {
				changed = true;
				return NEWS_DEFAULT_LAYOUT.shadowHeight;
			}
			return h;
		});
		const nextS = shadowStrengthBySlide.map((s, i) => {
			if (s <= 0 || shadowHeightAt(i) < NEWS_DEFAULT_LAYOUT.shadowHeight) {
				changed = true;
				return NEWS_DEFAULT_LAYOUT.shadowStrength;
			}
			return s;
		});
		const nextC = shadowCurveBySlide.map((c, i) => {
			if (shadowStrengthAt(i) <= 0 || shadowHeightAt(i) < NEWS_DEFAULT_LAYOUT.shadowHeight) {
				changed = true;
				return NEWS_DEFAULT_LAYOUT.shadowCurve;
			}
			return normalizeBottomShadowCurve(c);
		});
		if (changed) {
			shadowHeightBySlide = nextH;
			shadowStrengthBySlide = nextS;
			shadowCurveBySlide = nextC;
			const i = canvasRasterSlide ?? activeSlide;
			shadowHeight = shadowHeightAt(i);
			shadowStrength = shadowStrengthAt(i);
			shadowCurve = shadowCurveAt(i);
		}
	}

	function applyBottomShadowPreset(p: (typeof BOTTOM_SHADOW_PRESETS)[number]) {
		const i = canvasRasterSlide ?? activeSlide;
		setSlideShadow(i, {
			height: p.height,
			strength: p.strength,
			curve: p.curve,
			autoFit: false,
		});
	}

	function bottomShadowPresetActive(p: (typeof BOTTOM_SHADOW_PRESETS)[number]) {
		return (
			Math.abs(shadowHeight - p.height) < 2 &&
			Math.abs(shadowStrength - p.strength) < 0.04 &&
			normalizeBottomShadowCurve(shadowCurve) === p.curve
		);
	}

	// Image overlays — per slide, per template (so templates are independent)
	let slideOverlaysByTemplate = $state<Record<TemplateId, Overlay[][]>>({
		blank: emptySlides(() => []),
		news: emptySlides(() => []),
		tweet: emptySlides(() => []),
		article: emptySlides(() => []),
		textCarousel: emptySlides(() => []),
		imageQuote: emptySlides(() => []),
		videoStory: emptySlides(() => []),
		videoFit: emptySlides(() => []),
		videoSplit: emptySlides(() => []),
		videoBlur: emptySlides(() => []),
		videoHook: emptySlides(() => []),
		videoCreator: emptySlides(() => []),
		videoText: emptySlides(() => []),
		videoSource: emptySlides(() => []),
		videoFeature: emptySlides(() => []),
		videoPost: emptySlides(() => []),
		brandStack: emptySlides(() => []),
		blackText: emptySlides(() => []),
		photoTopic: emptySlides(() => []),
		photoCaption: emptySlides(() => []),
		whiteThread: emptySlides(() => []),
		whiteMedia: emptySlides(() => []),
	});
	const activeOverlays = $derived((slideOverlaysByTemplate[activeTemplate] ?? [])[activeSlide] ?? []);

	// Per-slide draggable offsets for template text elements (template px).
	type TextOffset = { x: number; y: number };
	let textOffsetsBySlide = $state<Record<string, TextOffset>[]>([]);
	let lastOffsetUndoAt = $state<Record<string, number>>({});

	function offsetKey(template: TemplateId, kind: string) {
		return `${template}:${kind}`;
	}
	function offsetsForTemplate(i: number, template: TemplateId): Record<string, TextOffset> {
		const row = textOffsetsBySlide[i] ?? {};
		const pref = `${template}:`;
		const out: Record<string, TextOffset> = {};
		for (const [k, v] of Object.entries(row)) {
			if (!k.startsWith(pref)) continue;
			if (!v || !Number.isFinite((v as any).x) || !Number.isFinite((v as any).y)) continue;
			out[k.slice(pref.length)] = v as TextOffset;
		}
		return out;
	}
	function setTemplateOffset(i: number, template: TemplateId, kind: string, next: TextOffset) {
		// Record undo sparingly (drag emits many onChange calls).
		const key = `${template}:${i}:${kind}`;
		(lastOffsetUndoAt as any)[key] = (lastOffsetUndoAt as any)[key] ?? 0;
		const now = Date.now();
		if (now - (lastOffsetUndoAt as any)[key] > 450) {
			(lastOffsetUndoAt as any)[key] = now;
			pushUndo(template, i);
		}
		setTextOffset(i, offsetKey(template, kind), next);
		// Follow the block while dragging so the bar stays on-screen with the text.
		// Font-size edits do not go through here, so the toolbar stays put then.
		if (selectedText && String(selectedText) === String(kind) && toolbarTarget) {
			requestAnimationFrame(() => {
				if (toolbarTarget) toolbarAnchor = toolbarTarget.getBoundingClientRect();
			});
		}
		// Remember News source position as the brand default for the next generate.
		if (template === 'news' && kind === 'source') {
			persistNewsSourceChrome({ sourceOffsetX: next.x, sourceOffsetY: next.y });
		}
	}

	function getTextOffset(i: number, kind: string): TextOffset {
		const row = textOffsetsBySlide[i] ?? {};
		const v = row[kind];
		return v && Number.isFinite(v.x) && Number.isFinite(v.y) ? v : { x: 0, y: 0 };
	}
	function setTextOffset(i: number, kind: string, next: TextOffset) {
		const cur = textOffsetsBySlide[i] ?? {};
		if (textOffsetsBySlide.length <= i) {
			const nextArr = textOffsetsBySlide.slice();
			while (nextArr.length <= i) nextArr.push({});
			nextArr[i] = { ...cur, [kind]: { x: next.x, y: next.y } };
			textOffsetsBySlide = nextArr;
			return;
		}
		textOffsetsBySlide = textOffsetsBySlide.map((r, idx) => {
			if (idx !== i) return r;
			return { ...cur, [kind]: { x: next.x, y: next.y } };
		});
	}

	function setSlideOverlays(i: number, next: Overlay[], template: TemplateId = activeTemplate) {
		const cur = [...(slideOverlaysByTemplate[template] ?? [])];
		// Ensure the per-template overlay array is long enough for this slide index.
		while (cur.length <= i) cur.push([]);
		cur[i] = next;
		slideOverlaysByTemplate = { ...slideOverlaysByTemplate, [template]: cur };
	}

	// Text overlays — per slide, per template (so templates are independent)
	let slideTextOverlaysByTemplate = $state<Record<TemplateId, TextOverlay[][]>>({
		blank: emptySlides(() => []),
		news: emptySlides(() => []),
		tweet: emptySlides(() => []),
		article: emptySlides(() => []),
		textCarousel: emptySlides(() => []),
		imageQuote: emptySlides(() => []),
		videoStory: emptySlides(() => []),
		videoFit: emptySlides(() => []),
		videoSplit: emptySlides(() => []),
		videoBlur: emptySlides(() => []),
		videoHook: emptySlides(() => []),
		videoCreator: emptySlides(() => []),
		videoText: emptySlides(() => []),
		videoSource: emptySlides(() => []),
		videoFeature: emptySlides(() => []),
		videoPost: emptySlides(() => []),
		brandStack: emptySlides(() => []),
		blackText: emptySlides(() => []),
		photoTopic: emptySlides(() => []),
		photoCaption: emptySlides(() => []),
		whiteThread: emptySlides(() => []),
		whiteMedia: emptySlides(() => []),
	});
	const activeTextOverlays = $derived((slideTextOverlaysByTemplate[activeTemplate] ?? [])[activeSlide] ?? []);

	function setSlideTextOverlays(i: number, next: TextOverlay[], template: TemplateId = activeTemplate) {
		const cur = [...(slideTextOverlaysByTemplate[template] ?? [])];
		// Ensure the per-template overlay array is long enough for this slide index.
		while (cur.length <= i) cur.push([]);
		cur[i] = next;
		slideTextOverlaysByTemplate = { ...slideTextOverlaysByTemplate, [template]: cur };
	}

	const VIDEO_CAPABLE_TEMPLATES: TemplateId[] = [
		'blank',
		'news',
		'tweet',
		'videoStory',
		'videoFit',
			'videoSplit',
		'videoBlur',
		'videoHook',
		'videoCreator',
		'videoText',
		'videoSource',
		'videoFeature',
		'videoPost',
		'brandStack',
		'imageQuote',
	];

	/** Find video URL + trim on a slide, checking every template bag. */
	function getSlideClipMedia(slideIdx: number): {
		url: string;
		start: number;
		end: number;
		duration: number;
	} | null {
		const i = Math.max(0, slideIdx);
		let url = '';
		for (const id of VIDEO_CAPABLE_TEMPLATES) {
			url = String((bgVideosByTemplate[id] ?? [])[i] ?? '').trim();
			if (url) break;
		}
		if (!url) return null;
		const start = Math.max(0, Number(videoTrimStartSecBySlide[i] ?? 0) || 0);
		const endRaw = Number(videoTrimEndSecBySlide[i] ?? 0) || 0;
		const end = endRaw > start ? endRaw : start;
		const duration =
			end > start
				? end - start
				: Math.max(0, Number(videoDurationBySlide[i] ?? 0) || 0);
		return { url, start, end, duration };
	}

	/** Put the same clip onto one slide across all video-capable templates. */
	function putClipOnSlide(
		slideIdx: number,
		clip: { url: string; start: number; end: number; duration: number },
	) {
		const i = Math.max(0, slideIdx);
		const nextVideos = { ...bgVideosByTemplate };
		const nextImages = { ...bgImagesByTemplate };
		for (const id of VIDEO_CAPABLE_TEMPLATES) {
			const vRow = [...(nextVideos[id] ?? [])];
			const iRow = [...(nextImages[id] ?? [])];
			while (vRow.length <= i) vRow.push('');
			while (iRow.length <= i) iRow.push('');
			vRow[i] = clip.url;
			iRow[i] = '';
			nextVideos[id] = vRow;
			nextImages[id] = iRow;
		}
		bgVideosByTemplate = nextVideos;
		bgImagesByTemplate = nextImages;

		const padNum = (arr: number[], fill: number) => {
			const next = [...arr];
			while (next.length <= i) next.push(0);
			next[i] = fill;
			return next;
		};
		const padBool = (arr: boolean[], fill: boolean) => {
			const next = [...arr];
			while (next.length <= i) next.push(fill);
			next[i] = fill;
			return next;
		};
		videoTrimStartSecBySlide = padNum(videoTrimStartSecBySlide, clip.start);
		videoTrimEndSecBySlide = padNum(videoTrimEndSecBySlide, clip.end);
		videoDurationBySlide = padNum(
			videoDurationBySlide,
			clip.duration || Math.max(0, clip.end - clip.start),
		);
		videoMutedBySlide = padBool(videoMutedBySlide, true);
		if (videoVolumeBySlide.length <= i) {
			videoVolumeBySlide = [
				...videoVolumeBySlide,
				...Array.from({ length: i + 1 - videoVolumeBySlide.length }, () => 0.8),
			];
		}
		while (newsSolidBgBySlide.length <= i) {
			newsSolidBgBySlide = [...newsSolidBgBySlide, ''];
		}
		newsSolidBgBySlide = newsSolidBgBySlide.map((c, idx) => (idx === i ? '' : c));
	}

	const activeSlideHasClip = $derived(!!getSlideClipMedia(activeSlide)?.url);

	function addSlide(opts?: {
		template?: TemplateId;
		copyClipFrom?: number | null;
		/** When false, grow the deck without stealing focus (Generate / setDeckSlideCount). */
		select?: boolean;
	}) {
		if (slides.length >= MAX_STUDIO_SLIDE_COUNT) return;
		const fromIdx = Math.max(
			0,
			Math.min(slides.length - 1, opts?.copyClipFrom ?? activeSlide),
		);
		// Capture clip BEFORE mutating video arrays. copyClipFrom: null = empty slide.
		const shouldCopyClip = opts?.copyClipFrom !== null;
		const clip = shouldCopyClip ? getSlideClipMedia(fromIdx) : null;
		const nextTemplate = coerceTemplateId(opts?.template ?? lastTemplateUsed);
		const nextText = nextTemplate === 'news' ? NEWS_PLACEHOLDER_HEADLINE : '';
		slides = [...slides, nextText];
		slideCount = slides.length;
		const newIdx = slides.length - 1;
		if (opts?.select !== false) {
			activeSlide = newIdx;
			editingBrandCta = false;
		}
		lastTemplateUsed = nextTemplate;
		bgImagesByTemplate = {
			blank: [...(bgImagesByTemplate.blank ?? []), ''],
			news: [...(bgImagesByTemplate.news ?? []), ''],
			tweet: [...(bgImagesByTemplate.tweet ?? []), ''],
			article: [...(bgImagesByTemplate.article ?? []), ''],
			textCarousel: [...(bgImagesByTemplate.textCarousel ?? []), ''],
			imageQuote: [...(bgImagesByTemplate.imageQuote ?? []), IMAGE_QUOTE_DEFAULTS.imageUrl],
			videoStory: [...(bgImagesByTemplate.videoStory ?? []), ''],
			videoFit: [...(bgImagesByTemplate.videoFit ?? []), ''],
			videoSplit: [...(bgImagesByTemplate.videoSplit ?? []), ''],
			videoBlur: [...(bgImagesByTemplate.videoBlur ?? []), ''],
			videoHook: [...(bgImagesByTemplate.videoHook ?? []), ''],
			videoCreator: [...(bgImagesByTemplate.videoCreator ?? []), ''],
			videoText: [...(bgImagesByTemplate.videoText ?? []), ''],
			videoSource: [...(bgImagesByTemplate.videoSource ?? []), ''],
			videoFeature: [...(bgImagesByTemplate.videoFeature ?? []), ''],
			videoPost: [...(bgImagesByTemplate.videoPost ?? []), ''],
			brandStack: [...(bgImagesByTemplate.brandStack ?? []), ''],
			photoTopic: [...(bgImagesByTemplate.photoTopic ?? []), PHOTO_TOPIC_DEFAULTS.imageUrl],
			photoCaption: [...(bgImagesByTemplate.photoCaption ?? []), PHOTO_CAPTION_DEFAULTS.imageUrl],
			whiteThread: [...(bgImagesByTemplate.whiteThread ?? []), ''],
			whiteMedia: [...(bgImagesByTemplate.whiteMedia ?? []), WHITE_MEDIA_DEFAULTS.imageUrl],
			blackText: [...(bgImagesByTemplate.blackText ?? []), BLACK_TEXT_BG_DEFAULT],
		};
		bgVideosByTemplate = {
			blank: [...(bgVideosByTemplate.blank ?? []), ''],
			news: [...(bgVideosByTemplate.news ?? []), ''],
			tweet: [...(bgVideosByTemplate.tweet ?? []), ''],
			article: [...(bgVideosByTemplate.article ?? []), ''],
			textCarousel: [...(bgVideosByTemplate.textCarousel ?? []), ''],
			imageQuote: [...(bgVideosByTemplate.imageQuote ?? []), ''],
			videoStory: [...(bgVideosByTemplate.videoStory ?? []), ''],
			videoFit: [...(bgVideosByTemplate.videoFit ?? []), ''],
			videoSplit: [...(bgVideosByTemplate.videoSplit ?? []), ''],
			videoBlur: [...(bgVideosByTemplate.videoBlur ?? []), ''],
			videoHook: [...(bgVideosByTemplate.videoHook ?? []), ''],
			videoCreator: [...(bgVideosByTemplate.videoCreator ?? []), ''],
			videoText: [...(bgVideosByTemplate.videoText ?? []), ''],
			videoSource: [...(bgVideosByTemplate.videoSource ?? []), ''],
			videoFeature: [...(bgVideosByTemplate.videoFeature ?? []), ''],
			videoPost: [...(bgVideosByTemplate.videoPost ?? []), ''],
			brandStack: [...(bgVideosByTemplate.brandStack ?? []), ''],
			photoTopic: [...(bgVideosByTemplate.photoTopic ?? []), ''],
			photoCaption: [...(bgVideosByTemplate.photoCaption ?? []), ''],
			whiteThread: [...(bgVideosByTemplate.whiteThread ?? []), ''],
			whiteMedia: [...(bgVideosByTemplate.whiteMedia ?? []), ''],
			blackText: [...(bgVideosByTemplate.blackText ?? []), ''],
		};
		generatingImagesByTemplate = {
			blank: [...(generatingImagesByTemplate.blank ?? []), false],
			news: [...(generatingImagesByTemplate.news ?? []), false],
			tweet: [...(generatingImagesByTemplate.tweet ?? []), false],
			article: [...(generatingImagesByTemplate.article ?? []), false],
			textCarousel: [...(generatingImagesByTemplate.textCarousel ?? []), false],
			imageQuote: [...(generatingImagesByTemplate.imageQuote ?? []), false],
			videoStory: [...(generatingImagesByTemplate.videoStory ?? []), false],
			videoFit: [...(generatingImagesByTemplate.videoFit ?? []), false],
			videoSplit: [...(generatingImagesByTemplate.videoSplit ?? []), false],
			videoBlur: [...(generatingImagesByTemplate.videoBlur ?? []), false],
			videoHook: [...(generatingImagesByTemplate.videoHook ?? []), false],
			videoCreator: [...(generatingImagesByTemplate.videoCreator ?? []), false],
			videoText: [...(generatingImagesByTemplate.videoText ?? []), false],
			videoSource: [...(generatingImagesByTemplate.videoSource ?? []), false],
			videoFeature: [...(generatingImagesByTemplate.videoFeature ?? []), false],
			videoPost: [...(generatingImagesByTemplate.videoPost ?? []), false],
			brandStack: [...(generatingImagesByTemplate.brandStack ?? []), false],
			blackText: [...(generatingImagesByTemplate.blackText ?? []), false],
			photoTopic: [...(generatingImagesByTemplate.photoTopic ?? []), false],
			photoCaption: [...(generatingImagesByTemplate.photoCaption ?? []), false],
			whiteThread: [...(generatingImagesByTemplate.whiteThread ?? []), false],
			whiteMedia: [...(generatingImagesByTemplate.whiteMedia ?? []), false],
		};
		slideOverlaysByTemplate = {
			blank: [...(slideOverlaysByTemplate.blank ?? []), []],
			news: [...(slideOverlaysByTemplate.news ?? []), []],
			tweet: [...(slideOverlaysByTemplate.tweet ?? []), []],
			article: [...(slideOverlaysByTemplate.article ?? []), []],
			textCarousel: [...(slideOverlaysByTemplate.textCarousel ?? []), []],
			imageQuote: [...(slideOverlaysByTemplate.imageQuote ?? []), []],
			videoStory: [...(slideOverlaysByTemplate.videoStory ?? []), []],
			videoFit: [...(slideOverlaysByTemplate.videoFit ?? []), []],
			videoSplit: [...(slideOverlaysByTemplate.videoSplit ?? []), []],
			videoBlur: [...(slideOverlaysByTemplate.videoBlur ?? []), []],
			videoHook: [...(slideOverlaysByTemplate.videoHook ?? []), []],
			videoCreator: [...(slideOverlaysByTemplate.videoCreator ?? []), []],
			videoText: [...(slideOverlaysByTemplate.videoText ?? []), []],
			videoSource: [...(slideOverlaysByTemplate.videoSource ?? []), []],
			videoFeature: [...(slideOverlaysByTemplate.videoFeature ?? []), []],
			videoPost: [...(slideOverlaysByTemplate.videoPost ?? []), []],
			brandStack: [...(slideOverlaysByTemplate.brandStack ?? []), []],
			blackText: [...(slideOverlaysByTemplate.blackText ?? []), []],
			photoTopic: [...(slideOverlaysByTemplate.photoTopic ?? []), []],
			photoCaption: [...(slideOverlaysByTemplate.photoCaption ?? []), []],
			whiteThread: [...(slideOverlaysByTemplate.whiteThread ?? []), []],
			whiteMedia: [...(slideOverlaysByTemplate.whiteMedia ?? []), []],
		};
		slideTextOverlaysByTemplate = {
			blank: [...(slideTextOverlaysByTemplate.blank ?? []), []],
			news: [...(slideTextOverlaysByTemplate.news ?? []), []],
			tweet: [...(slideTextOverlaysByTemplate.tweet ?? []), []],
			article: [...(slideTextOverlaysByTemplate.article ?? []), []],
			textCarousel: [...(slideTextOverlaysByTemplate.textCarousel ?? []), []],
			imageQuote: [...(slideTextOverlaysByTemplate.imageQuote ?? []), []],
			videoStory: [...(slideTextOverlaysByTemplate.videoStory ?? []), []],
			videoFit: [...(slideTextOverlaysByTemplate.videoFit ?? []), []],
			videoSplit: [...(slideTextOverlaysByTemplate.videoSplit ?? []), []],
			videoBlur: [...(slideTextOverlaysByTemplate.videoBlur ?? []), []],
			videoHook: [...(slideTextOverlaysByTemplate.videoHook ?? []), []],
			videoCreator: [...(slideTextOverlaysByTemplate.videoCreator ?? []), []],
			videoText: [...(slideTextOverlaysByTemplate.videoText ?? []), []],
			videoSource: [...(slideTextOverlaysByTemplate.videoSource ?? []), []],
			videoFeature: [...(slideTextOverlaysByTemplate.videoFeature ?? []), []],
			videoPost: [...(slideTextOverlaysByTemplate.videoPost ?? []), []],
			brandStack: [...(slideTextOverlaysByTemplate.brandStack ?? []), []],
			blackText: [...(slideTextOverlaysByTemplate.blackText ?? []), []],
			photoTopic: [...(slideTextOverlaysByTemplate.photoTopic ?? []), []],
			photoCaption: [...(slideTextOverlaysByTemplate.photoCaption ?? []), []],
			whiteThread: [...(slideTextOverlaysByTemplate.whiteThread ?? []), []],
			whiteMedia: [...(slideTextOverlaysByTemplate.whiteMedia ?? []), []],
		};
		tweetTopNameBySlide = [...tweetTopNameBySlide, tweetTopNameBySlide[tweetTopNameBySlide.length - 1] ?? 'Chef 👨‍🍳'];
		tweetTopHandleBySlide = [...tweetTopHandleBySlide, tweetTopHandleBySlide[tweetTopHandleBySlide.length - 1] ?? '@chefsevenn'];
		tweetBottomNameBySlide = [...tweetBottomNameBySlide, tweetBottomNameBySlide[tweetBottomNameBySlide.length - 1] ?? 'Mo Mohler'];
		tweetBottomHandleBySlide = [...tweetBottomHandleBySlide, tweetBottomHandleBySlide[tweetBottomHandleBySlide.length - 1] ?? '@MoMohler'];
		tweetTopTextBySlide = [...tweetTopTextBySlide, tweetTopTextBySlide[tweetTopTextBySlide.length - 1] ?? 'Ketchup or mayo or mustard?'];
		tweetBottomTextBySlide = [...tweetBottomTextBySlide, TWEET_DEFAULTS.bottomText];
		tweetReplyCountBySlide = [...tweetReplyCountBySlide, tweetReplyCountBySlide[tweetReplyCountBySlide.length - 1] ?? '4.2K'];
		tweetRepostCountBySlide = [...tweetRepostCountBySlide, tweetRepostCountBySlide[tweetRepostCountBySlide.length - 1] ?? '12.8K'];
		tweetLikeCountBySlide = [...tweetLikeCountBySlide, tweetLikeCountBySlide[tweetLikeCountBySlide.length - 1] ?? '89.4K'];
		tweetTopImageHeightBySlide = [...tweetTopImageHeightBySlide, tweetTopImageHeightBySlide[tweetTopImageHeightBySlide.length - 1] ?? 720];
		tweetTopImageWidthBySlide = [...tweetTopImageWidthBySlide, tweetTopImageWidthBySlide[tweetTopImageWidthBySlide.length - 1] ?? 920];
		tweetTopImageZoomBySlide = [...tweetTopImageZoomBySlide, tweetTopImageZoomBySlide[tweetTopImageZoomBySlide.length - 1] ?? 1];
		tweetTopImagePanXBySlide = [...tweetTopImagePanXBySlide, tweetTopImagePanXBySlide[tweetTopImagePanXBySlide.length - 1] ?? 50];
		tweetTopImagePanYBySlide = [...tweetTopImagePanYBySlide, tweetTopImagePanYBySlide[tweetTopImagePanYBySlide.length - 1] ?? 50];
		tweetTopAvatarImageBySlide = [...tweetTopAvatarImageBySlide, tweetTopAvatarImageBySlide[tweetTopAvatarImageBySlide.length - 1] ?? ''];
		tweetTopAvatarModeBySlide = [
			...tweetTopAvatarModeBySlide,
			tweetTopAvatarModeBySlide[tweetTopAvatarModeBySlide.length - 1] ?? 'text',
		];
		tweetTopAvatarInnerBgBySlide = [...tweetTopAvatarInnerBgBySlide, tweetTopAvatarInnerBgBySlide[tweetTopAvatarInnerBgBySlide.length - 1] ?? ''];
		tweetTopAvatarLabelBySlide = [...tweetTopAvatarLabelBySlide, tweetTopAvatarLabelBySlide[tweetTopAvatarLabelBySlide.length - 1] ?? ''];
		tweetTopAvatarRingColorBySlide = [...tweetTopAvatarRingColorBySlide, tweetTopAvatarRingColorBySlide[tweetTopAvatarRingColorBySlide.length - 1] ?? '#c9b97a'];
		tweetTopAvatarRingWidthBySlide = [...tweetTopAvatarRingWidthBySlide, tweetTopAvatarRingWidthBySlide[tweetTopAvatarRingWidthBySlide.length - 1] ?? 4];
		tweetBottomAvatarImageBySlide = [...tweetBottomAvatarImageBySlide, tweetBottomAvatarImageBySlide[tweetBottomAvatarImageBySlide.length - 1] ?? ''];
		tweetBottomAvatarModeBySlide = [
			...tweetBottomAvatarModeBySlide,
			tweetBottomAvatarModeBySlide[tweetBottomAvatarModeBySlide.length - 1] ?? 'text',
		];
		tweetBottomAvatarInnerBgBySlide = [...tweetBottomAvatarInnerBgBySlide, tweetBottomAvatarInnerBgBySlide[tweetBottomAvatarInnerBgBySlide.length - 1] ?? ''];
		tweetBottomAvatarLabelBySlide = [...tweetBottomAvatarLabelBySlide, tweetBottomAvatarLabelBySlide[tweetBottomAvatarLabelBySlide.length - 1] ?? ''];
		tweetBottomAvatarRingColorBySlide = [...tweetBottomAvatarRingColorBySlide, tweetBottomAvatarRingColorBySlide[tweetBottomAvatarRingColorBySlide.length - 1] ?? '#c9b97a'];
		tweetBottomAvatarRingWidthBySlide = [...tweetBottomAvatarRingWidthBySlide, tweetBottomAvatarRingWidthBySlide[tweetBottomAvatarRingWidthBySlide.length - 1] ?? 4];
		articleTextBySlide = [...articleTextBySlide, articleTextBySlide[articleTextBySlide.length - 1] ?? ''];
		newsSubtextBySlide = [...newsSubtextBySlide, ''];
		textCarouselTextBySlide = [...textCarouselTextBySlide, textCarouselTextBySlide[textCarouselTextBySlide.length - 1] ?? ''];
		imageQuoteTextBySlide = [...imageQuoteTextBySlide, imageQuoteTextBySlide[imageQuoteTextBySlide.length - 1] ?? ''];
		textCarouselNameBySlide = [...textCarouselNameBySlide, textCarouselNameBySlide[textCarouselNameBySlide.length - 1] ?? 'Captains of industry'];
		textCarouselHandleBySlide = [...textCarouselHandleBySlide, textCarouselHandleBySlide[textCarouselHandleBySlide.length - 1] ?? '@captainsofindustryy'];
		textCarouselAvatarImageBySlide = [
			...textCarouselAvatarImageBySlide,
			textCarouselAvatarImageBySlide[textCarouselAvatarImageBySlide.length - 1] ?? '',
		];
		textCarouselAvatarModeBySlide = [
			...textCarouselAvatarModeBySlide,
			textCarouselAvatarModeBySlide[textCarouselAvatarModeBySlide.length - 1] ?? 'text',
		];
		textCarouselAvatarInnerBgBySlide = [
			...textCarouselAvatarInnerBgBySlide,
			textCarouselAvatarInnerBgBySlide[textCarouselAvatarInnerBgBySlide.length - 1] ?? '',
		];
		textCarouselAvatarLabelBySlide = [
			...textCarouselAvatarLabelBySlide,
			textCarouselAvatarLabelBySlide[textCarouselAvatarLabelBySlide.length - 1] ?? '',
		];
		textCarouselAvatarRingColorBySlide = [
			...textCarouselAvatarRingColorBySlide,
			textCarouselAvatarRingColorBySlide[textCarouselAvatarRingColorBySlide.length - 1] ?? '#c9b97a',
		];
		textCarouselAvatarRingWidthBySlide = [
			...textCarouselAvatarRingWidthBySlide,
			textCarouselAvatarRingWidthBySlide[textCarouselAvatarRingWidthBySlide.length - 1] ?? 5,
		];
		imageQuoteFooterLeftBySlide = [...imageQuoteFooterLeftBySlide, imageQuoteFooterLeftBySlide[imageQuoteFooterLeftBySlide.length - 1] ?? IMAGE_QUOTE_DEFAULTS.footerLeft];
		imageQuoteFooterRightBySlide = [...imageQuoteFooterRightBySlide, imageQuoteFooterRightBySlide[imageQuoteFooterRightBySlide.length - 1] ?? IMAGE_QUOTE_DEFAULTS.footerRight];
		{
			const nextTop = { ...filmStripTopPctByTemplate };
			const nextBottom = { ...filmStripBottomPctByTemplate };
			for (const id of FILM_STRIP_TEMPLATE_IDS) {
				const d = filmStripDefaultsFor(id);
				nextTop[id] = [...(nextTop[id] ?? []), nextTop[id]?.[nextTop[id].length - 1] ?? d.topPct];
				nextBottom[id] = [...(nextBottom[id] ?? []), nextBottom[id]?.[nextBottom[id].length - 1] ?? d.bottomPct];
			}
			filmStripTopPctByTemplate = nextTop;
			filmStripBottomPctByTemplate = nextBottom;
		}
		articleSwipeTextBySlide = [...articleSwipeTextBySlide, articleSwipeTextBySlide[articleSwipeTextBySlide.length - 1] ?? '«« Swipe'];
		articleLogoSrcBySlide = [...articleLogoSrcBySlide, articleLogoSrcBySlide[articleLogoSrcBySlide.length - 1] ?? ''];
		videoStoryHeadlineBySlide = [
			...videoStoryHeadlineBySlide,
			videoStoryHeadlineBySlide[videoStoryHeadlineBySlide.length - 1] ?? VIDEO_STORY_DEFAULTS.headline,
		];
		videoStoryWatermarkBySlide = [
			...videoStoryWatermarkBySlide,
			videoStoryWatermarkBySlide[videoStoryWatermarkBySlide.length - 1] ?? VIDEO_STORY_DEFAULTS.watermark,
		];
		brandStackBrandBySlide = [
			...brandStackBrandBySlide,
			brandStackBrandBySlide[brandStackBrandBySlide.length - 1] ?? BRAND_STACK_DEFAULTS.brand,
		];
		brandStackBottomMediaBySlide = [
			...brandStackBottomMediaBySlide,
			brandStackBottomMediaBySlide[brandStackBottomMediaBySlide.length - 1] ??
				BRAND_STACK_DEFAULTS.bottomMediaUrl,
		];
		videoSplitCompositedBySlide = [
			...videoSplitCompositedBySlide,
			videoSplitCompositedBySlide[videoSplitCompositedBySlide.length - 1] ?? false,
		];
		blackTextHeadlineBySlide = [
			...blackTextHeadlineBySlide,
			blackTextHeadlineBySlide[blackTextHeadlineBySlide.length - 1] ?? BLACK_TEXT_CAROUSEL_DEFAULTS.headline,
		];
		blackTextBodyBySlide = [
			...blackTextBodyBySlide,
			blackTextBodyBySlide[blackTextBodyBySlide.length - 1] ?? BLACK_TEXT_CAROUSEL_DEFAULTS.body,
		];
		slideIds = [...slideIds, newSlideId()];
		slideMusic = [...slideMusic, null];
		videoTrimStartSecBySlide = [...videoTrimStartSecBySlide, 0];
		videoTrimEndSecBySlide = [...videoTrimEndSecBySlide, 0];
		videoDurationBySlide = [...videoDurationBySlide, 0];
		videoMutedBySlide = [...videoMutedBySlide, true];
		videoVolumeBySlide = [...videoVolumeBySlide, 0.8];
		newsSolidBgBySlide = [...newsSolidBgBySlide, ''];
		shadowHeightBySlide = [...shadowHeightBySlide, NEWS_DEFAULT_LAYOUT.shadowHeight];
		shadowStrengthBySlide = [...shadowStrengthBySlide, NEWS_DEFAULT_LAYOUT.shadowStrength];
		shadowCurveBySlide = [...shadowCurveBySlide, NEWS_DEFAULT_LAYOUT.shadowCurve];
		shadowColorBySlide = [...shadowColorBySlide, NEWS_DEFAULT_LAYOUT.shadowColor];
		shadowAutoFitBySlide = [...shadowAutoFitBySlide, true];
		shadowPaintSlideSync = -1;

		slideTemplates = Array.from({ length: slides.length }, (_, i) =>
			i === newIdx ? nextTemplate : coerceTemplateId(slideTemplates[i] ?? lastTemplateUsed),
		);
		ensureTemplateDefaultsForSlide(nextTemplate, newIdx);
		applyTemplateDevOverride(nextTemplate, { slides: [newIdx] });
		reapplyBrandChromeForTemplate(nextTemplate, newIdx);

		if (clip) {
			putClipOnSlide(newIdx, clip);
			if (clip.end > clip.start) videoSeekSec = clip.start;
		}
		addSlideMenuOpen = false;
		addSlideMenuPos = null;
	}

	/** One-tap: new slide + chosen template + same clip as the current slide. */
	function addSlideWithClipAs(template: TemplateId) {
		addSlide({ template, copyClipFrom: activeSlide });
	}

	function addEmptySlide() {
		addSlide({ template: activeTemplate, copyClipFrom: null });
	}

	function cloneSlideValue<T>(v: T): T {
		try {
			return structuredClone(v);
		} catch {
			return JSON.parse(JSON.stringify(v)) as T;
		}
	}

	/** Copy every per-slide field from `fromIdx` onto `toIdx` (same deck length). */
	function mirrorSlideState(fromIdx: number, toIdx: number) {
		if (fromIdx === toIdx) return;
		if (fromIdx < 0 || toIdx < 0 || fromIdx >= slides.length || toIdx >= slides.length) return;

		const copyStr = (arr: string[], fallback = '') => {
			const next = arr.slice();
			while (next.length <= toIdx) next.push(fallback);
			next[toIdx] = String(next[fromIdx] ?? fallback);
			return next;
		};
		const copyBool = (arr: boolean[], fallback = false) => {
			const next = arr.slice();
			while (next.length <= toIdx) next.push(fallback);
			next[toIdx] = !!(next[fromIdx] ?? fallback);
			return next;
		};
		const copyNum = (arr: number[], fallback = 0) => {
			const next = arr.slice();
			while (next.length <= toIdx) next.push(fallback);
			const n = Number(next[fromIdx]);
			next[toIdx] = Number.isFinite(n) ? n : fallback;
			return next;
		};
		const copyAny = <T,>(arr: T[], fallback: T, clone: (v: T) => T = (v) => v) => {
			const next = arr.slice();
			while (next.length <= toIdx) next.push(cloneSlideValue(fallback));
			const src = fromIdx < arr.length ? arr[fromIdx] : fallback;
			next[toIdx] = clone(src);
			return next;
		};

		slides = copyStr(slides, '');
		slideTemplates = (() => {
			const next = slideTemplates.slice();
			while (next.length <= toIdx) next.push('news' as TemplateId);
			next[toIdx] = coerceTemplateId(slideTemplates[fromIdx] ?? lastTemplateUsed);
			return next;
		})();

		const mapTemplateRows = <T,>(
			bag: Record<TemplateId, T[]>,
			fallback: T,
			clone: (v: T) => T = (v) => v,
		): Record<TemplateId, T[]> => {
			const out = { ...bag } as Record<TemplateId, T[]>;
			for (const key of Object.keys(out) as TemplateId[]) {
				out[key] = copyAny(out[key] ?? [], fallback, clone);
			}
			return out;
		};

		bgImagesByTemplate = mapTemplateRows(bgImagesByTemplate, '');
		bgVideosByTemplate = mapTemplateRows(bgVideosByTemplate, '');
		generatingImagesByTemplate = mapTemplateRows(generatingImagesByTemplate, false);
		slideOverlaysByTemplate = mapTemplateRows(slideOverlaysByTemplate, [] as Overlay[], (row) =>
			(row ?? []).map((o) => ({
				...cloneSlideValue(o),
				id: crypto.randomUUID(),
			})),
		);
		slideTextOverlaysByTemplate = mapTemplateRows(
			slideTextOverlaysByTemplate,
			[] as TextOverlay[],
			(row) =>
				(row ?? []).map((t) => ({
					...cloneSlideValue(t),
					id: crypto.randomUUID(),
					style: { ...(t?.style ?? {}) },
				})),
		);
		stylesByTemplateBySlide = mapTemplateRows(
			stylesByTemplateBySlide,
			{} as Partial<Record<TextElementKind, TextStyle>>,
			(m) => cloneSlideValue(m ?? {}),
		);
		filmStripTopPctByTemplate = Object.fromEntries(
			FILM_STRIP_TEMPLATE_IDS.map((id) => [
				id,
				copyNum(
					filmStripTopPctByTemplate[id] ?? [],
					filmStripDefaultsFor(id).topPct,
				),
			]),
		) as Record<TemplateId, number[]>;
		filmStripBottomPctByTemplate = Object.fromEntries(
			FILM_STRIP_TEMPLATE_IDS.map((id) => [
				id,
				copyNum(
					filmStripBottomPctByTemplate[id] ?? [],
					filmStripDefaultsFor(id).bottomPct,
				),
			]),
		) as Record<TemplateId, number[]>;

		tweetTopNameBySlide = copyStr(tweetTopNameBySlide);
		tweetTopHandleBySlide = copyStr(tweetTopHandleBySlide);
		tweetBottomNameBySlide = copyStr(tweetBottomNameBySlide);
		tweetBottomHandleBySlide = copyStr(tweetBottomHandleBySlide);
		tweetTopTextBySlide = copyStr(tweetTopTextBySlide);
		tweetBottomTextBySlide = copyStr(tweetBottomTextBySlide);
		tweetReplyCountBySlide = copyStr(tweetReplyCountBySlide, '4.2K');
		tweetRepostCountBySlide = copyStr(tweetRepostCountBySlide, '12.8K');
		tweetLikeCountBySlide = copyStr(tweetLikeCountBySlide, '89.4K');
		tweetTopImageHeightBySlide = copyNum(tweetTopImageHeightBySlide, 720);
		tweetTopImageWidthBySlide = copyNum(tweetTopImageWidthBySlide, 920);
		tweetTopImageZoomBySlide = copyNum(tweetTopImageZoomBySlide, 1);
		tweetTopImagePanXBySlide = copyNum(tweetTopImagePanXBySlide, 50);
		tweetTopImagePanYBySlide = copyNum(tweetTopImagePanYBySlide, 50);
		tweetTopAvatarImageBySlide = copyStr(tweetTopAvatarImageBySlide);
		tweetTopAvatarModeBySlide = copyAny(tweetTopAvatarModeBySlide, 'text' as const);
		tweetTopAvatarInnerBgBySlide = copyStr(tweetTopAvatarInnerBgBySlide);
		tweetTopAvatarLabelBySlide = copyStr(tweetTopAvatarLabelBySlide);
		tweetTopAvatarRingColorBySlide = copyStr(tweetTopAvatarRingColorBySlide, '#c9b97a');
		tweetTopAvatarRingWidthBySlide = copyNum(tweetTopAvatarRingWidthBySlide, 4);
		tweetBottomAvatarImageBySlide = copyStr(tweetBottomAvatarImageBySlide);
		tweetBottomAvatarModeBySlide = copyAny(tweetBottomAvatarModeBySlide, 'text' as const);
		tweetBottomAvatarInnerBgBySlide = copyStr(tweetBottomAvatarInnerBgBySlide);
		tweetBottomAvatarLabelBySlide = copyStr(tweetBottomAvatarLabelBySlide);
		tweetBottomAvatarRingColorBySlide = copyStr(tweetBottomAvatarRingColorBySlide, '#c9b97a');
		tweetBottomAvatarRingWidthBySlide = copyNum(tweetBottomAvatarRingWidthBySlide, 4);
		tweetStylesBySlide = copyAny(
			tweetStylesBySlide,
			{} as Partial<Record<string, TextStyle>>,
			(m) => cloneSlideValue(m ?? {}),
		);

		articleTextBySlide = copyStr(articleTextBySlide);
		newsSubtextBySlide = copyStr(newsSubtextBySlide);
		textCarouselTextBySlide = copyStr(textCarouselTextBySlide);
		imageQuoteTextBySlide = copyStr(imageQuoteTextBySlide);
		textCarouselNameBySlide = copyStr(textCarouselNameBySlide);
		textCarouselHandleBySlide = copyStr(textCarouselHandleBySlide);
		textCarouselAvatarImageBySlide = copyStr(textCarouselAvatarImageBySlide);
		textCarouselAvatarModeBySlide = copyAny(textCarouselAvatarModeBySlide, 'text' as const);
		textCarouselAvatarInnerBgBySlide = copyStr(textCarouselAvatarInnerBgBySlide);
		textCarouselAvatarLabelBySlide = copyStr(textCarouselAvatarLabelBySlide);
		textCarouselAvatarRingColorBySlide = copyStr(textCarouselAvatarRingColorBySlide, '#c9b97a');
		textCarouselAvatarRingWidthBySlide = copyNum(textCarouselAvatarRingWidthBySlide, 5);
		imageQuoteFooterLeftBySlide = copyStr(
			imageQuoteFooterLeftBySlide,
			IMAGE_QUOTE_DEFAULTS.footerLeft,
		);
		imageQuoteFooterRightBySlide = copyStr(
			imageQuoteFooterRightBySlide,
			IMAGE_QUOTE_DEFAULTS.footerRight,
		);
		articleSwipeTextBySlide = copyStr(articleSwipeTextBySlide, '«« Swipe');
		articleLogoSrcBySlide = copyStr(articleLogoSrcBySlide);
		videoStoryHeadlineBySlide = copyStr(videoStoryHeadlineBySlide, VIDEO_STORY_DEFAULTS.headline);
		videoStoryWatermarkBySlide = copyStr(videoStoryWatermarkBySlide, VIDEO_STORY_DEFAULTS.watermark);
		brandStackBrandBySlide = copyStr(brandStackBrandBySlide, BRAND_STACK_DEFAULTS.brand);
		brandStackBottomMediaBySlide = copyStr(
			brandStackBottomMediaBySlide,
			BRAND_STACK_DEFAULTS.bottomMediaUrl,
		);
		videoSplitCompositedBySlide = copyBool(videoSplitCompositedBySlide, false);
		blackTextHeadlineBySlide = copyStr(
			blackTextHeadlineBySlide,
			BLACK_TEXT_CAROUSEL_DEFAULTS.headline,
		);
		blackTextBodyBySlide = copyStr(blackTextBodyBySlide, BLACK_TEXT_CAROUSEL_DEFAULTS.body);

		subjectCutouts = copyStr(subjectCutouts);
		showCutout = copyBool(showCutout, false);
		cuttingOut = copyBool(cuttingOut, false);
		newsSolidBgBySlide = copyStr(newsSolidBgBySlide);
		circleImages = copyStr(circleImages);
		circle2Images = copyStr(circle2Images);
		showCircleBySlide = copyBool(showCircleBySlide, false);
		showCircle2BySlide = copyBool(showCircle2BySlide, false);
		shadowHeightBySlide = copyNum(shadowHeightBySlide, NEWS_DEFAULT_LAYOUT.shadowHeight);
		shadowStrengthBySlide = copyNum(shadowStrengthBySlide, NEWS_DEFAULT_LAYOUT.shadowStrength);
		shadowCurveBySlide = copyAny(
			shadowCurveBySlide,
			NEWS_DEFAULT_LAYOUT.shadowCurve,
			(c) => normalizeBottomShadowCurve(c),
		);
		shadowColorBySlide = copyStr(shadowColorBySlide, NEWS_DEFAULT_LAYOUT.shadowColor);
		shadowAutoFitBySlide = copyBool(shadowAutoFitBySlide, true);
		shadowPaintSlideSync = -1;

		videoTrimStartSecBySlide = copyNum(videoTrimStartSecBySlide, 0);
		videoTrimEndSecBySlide = copyNum(videoTrimEndSecBySlide, 0);
		videoDurationBySlide = copyNum(videoDurationBySlide, 0);
		videoMutedBySlide = copyBool(videoMutedBySlide, true);
		videoVolumeBySlide = copyNum(videoVolumeBySlide, 0.8);

		textOffsetsBySlide = copyAny(
			textOffsetsBySlide,
			{} as Record<string, TextOffset>,
			(r) => cloneSlideValue(r ?? {}),
		);
		slideMusic = copyAny(slideMusic, null as MusicTrack | null, (m) =>
			m ? cloneSlideValue(m) : null,
		);

		if (bulkCaptionsBySlide.length || fromIdx < bulkCaptionsBySlide.length) {
			bulkCaptionsBySlide = copyAny(bulkCaptionsBySlide, null, (c) =>
				c ? cloneSlideValue(c) : null,
			);
		}

		{
			const next = filmstripPreviewUrls.slice();
			while (next.length <= toIdx) next.push('');
			next[toIdx] = String(filmstripPreviewUrls[fromIdx] ?? '');
			filmstripPreviewUrls = next;
		}

		historyByTemplateBySlide = (Object.fromEntries(
			(Object.entries(historyByTemplateBySlide) as [TemplateId, ScopedHistory[]][]).map(
				([k, arr]) => {
					const next = arr.slice();
					while (next.length <= toIdx) next.push({ undo: [], redo: [] });
					next[toIdx] = { undo: [], redo: [] };
					return [k, next];
				},
			),
		) as unknown) as Record<TemplateId, ScopedHistory[]>;
	}

	/** Filmstrip +: clone the focused slide (media, copy, styles) instead of a blank default. */
	function duplicateActiveSlide() {
		if (slides.length >= MAX_STUDIO_SLIDE_COUNT) return;
		const fromIdx = Math.max(0, Math.min(slides.length - 1, activeSlide));
		const tpl = coerceTemplateId(slideTemplates[fromIdx] ?? lastTemplateUsed);
		const srcHeadline = String(slides[fromIdx] ?? '');
		const beforeLen = slides.length;
		addSlide({ template: tpl, copyClipFrom: fromIdx, select: true });
		if (slides.length === beforeLen) return;
		const newIdx = slides.length - 1;
		slides = slides.map((x, i) => (i === newIdx ? srcHeadline : x));
		mirrorSlideState(fromIdx, newIdx);
		studioHasUnsavedChanges = true;
		const clipStart = Number(videoTrimStartSecBySlide[newIdx] ?? 0);
		if (Number.isFinite(clipStart) && clipStart > 0) videoSeekSec = clipStart;
	}

	function addTextOverlay() {
		const idx = activeSlide;
		const tpl = activeTemplate;
		/* News paragraph slot: first Text tap adds the under-headline tag so generate can fill it. */
		if (tpl === 'news') {
			while (newsSubtextBySlide.length <= idx) {
				newsSubtextBySlide = [...newsSubtextBySlide, ''];
			}
			if (!String(newsSubtextBySlide[idx] ?? '').trim()) {
				pushUndo('news', idx);
				newsSubtextBySlide = newsSubtextBySlide.map((x, i) =>
					i === idx ? 'Add your text' : x,
				);
				selectedText = 'newsSubtext';
				selectedTextOverlayId = null;
				try {
					console.debug('[studio] addTextOverlay → newsSubtext tag', { slide: idx });
				} catch {}
				return;
			}
		}
		const current = (slideTextOverlaysByTemplate[tpl] ?? [])[idx] ?? [];
		const next: TextOverlay = {
			id: crypto.randomUUID(),
			text: 'Add your text',
			x: 72,
			y: 280,
			// Hug the placeholder on one line (Canva-style); drag side handles to wrap.
			w: 320,
			h: 76,
			style: {
				color: '#FFFFFF',
				fontFamily: FONT_TEMPLATE_DEFAULT,
				fontSize: 36,
				fontWeight: 600,
				align: 'left',
				lineHeight: 1.3,
				letterSpacing: -0.015,
				textShadow: '0 1px 3px rgba(0,0,0,0.45)',
			},
		};
		setSlideTextOverlays(idx, [...current, next], tpl);
		selectedTextOverlayId = next.id;
		selectedText = 'textOverlay';
		try {
			console.debug('[studio] addTextOverlay', { template: tpl, slide: idx, id: next.id });
		} catch {}
	}

	// ── Per-slide text styles (Canva-style toolbar) ──────────────────────
	let stylesByTemplateBySlide = $state<Record<TemplateId, Partial<Record<TextElementKind, TextStyle>>[]>>({
		blank: emptySlides(() => ({})),
		news: emptySlides(() => ({})),
		article: emptySlides(() => ({})),
		textCarousel: emptySlides(() => ({})),
		tweet: emptySlides(() => ({})),
		imageQuote: emptySlides(() => ({})),
		videoStory: emptySlides(() => ({})),
		videoFit: emptySlides(() => ({})),
		videoSplit: emptySlides(() => ({})),
		videoBlur: emptySlides(() => ({})),
		videoHook: emptySlides(() => ({})),
		videoCreator: emptySlides(() => ({})),
		videoText: emptySlides(() => ({
			videoStoryHeadline: { textShadow: VIDEO_TEXT_HEADLINE_STYLE.textShadow },
		})),
		videoSource: emptySlides(() => ({})),
		videoFeature: emptySlides(() => ({})),
		videoPost: emptySlides(() => ({})),
		brandStack: emptySlides(() => ({})),
		blackText: emptySlides(() => ({})),
		photoTopic: emptySlides(() => ({})),
		photoCaption: emptySlides(() => ({})),
		whiteThread: emptySlides(() => ({})),
		whiteMedia: emptySlides(() => ({})),
	});
	// Tweet has multiple independent text fields; keep their styles separate.
	type TweetKind =
		| 'tweetTopName'
		| 'tweetTopHandle'
		| 'tweetTopText'
		| 'tweetBottomName'
		| 'tweetBottomHandle'
		| 'tweetBottomText';
	let tweetStylesBySlide = $state<Partial<Record<TweetKind, TextStyle>>[]>(emptySlides(() => ({})));

	// ── Per-template extra text fields (per slide) ───────────────────────
	let tweetTopNameBySlide = $state<string[]>(emptySlides(() => 'Chef 👨‍🍳'));
	let tweetTopHandleBySlide = $state<string[]>(emptySlides(() => '@chefsevenn'));
	let tweetBottomNameBySlide = $state<string[]>(emptySlides(() => 'Mo Mohler'));
	let tweetBottomHandleBySlide = $state<string[]>(emptySlides(() => '@MoMohler'));
	let tweetTopTextBySlide = $state<string[]>(emptySlides(() => 'Ketchup or mayo or mustard?'));
	let tweetBottomTextBySlide = $state<string[]>(emptySlides(() => TWEET_DEFAULTS.bottomText));
	let tweetReplyCountBySlide = $state<string[]>(emptySlides(() => '4.2K'));
	let tweetRepostCountBySlide = $state<string[]>(emptySlides(() => '12.8K'));
	let tweetLikeCountBySlide = $state<string[]>(emptySlides(() => '89.4K'));
	// Tweet attached image frame controls (per slide)
	let tweetTopImageHeightBySlide = $state<number[]>(emptySlides(() => 720));
	let tweetTopImageWidthBySlide = $state<number[]>(emptySlides(() => 920));
	let tweetTopImageZoomBySlide = $state<number[]>(emptySlides(() => 1));
	let tweetTopImagePanXBySlide = $state<number[]>(emptySlides(() => 50));
	let tweetTopImagePanYBySlide = $state<number[]>(emptySlides(() => 50));
	/** Tweet profile circles — image URL / inner fill / optional label (else initials from name). */
	let tweetTopAvatarImageBySlide = $state<string[]>(emptySlides(() => ''));
	let tweetTopAvatarModeBySlide = $state<Array<'text' | 'image'>>(emptySlides(() => 'text'));
	let tweetTopAvatarInnerBgBySlide = $state<string[]>(emptySlides(() => ''));
	let tweetTopAvatarLabelBySlide = $state<string[]>(emptySlides(() => ''));
	let tweetTopAvatarRingColorBySlide = $state<string[]>(emptySlides(() => '#c9b97a'));
	let tweetTopAvatarRingWidthBySlide = $state<number[]>(emptySlides(() => 4));
	let tweetBottomAvatarImageBySlide = $state<string[]>(emptySlides(() => ''));
	let tweetBottomAvatarModeBySlide = $state<Array<'text' | 'image'>>(emptySlides(() => 'text'));
	let tweetBottomAvatarInnerBgBySlide = $state<string[]>(emptySlides(() => ''));
	let tweetBottomAvatarLabelBySlide = $state<string[]>(emptySlides(() => ''));
	let tweetBottomAvatarRingColorBySlide = $state<string[]>(emptySlides(() => '#c9b97a'));
	let tweetBottomAvatarRingWidthBySlide = $state<number[]>(emptySlides(() => 4));
	let articleTextBySlide = $state<string[]>(
		emptySlides(
			() =>
				"Here's the trillion-dollar problem everyone avoids.\n\nTo break it down:\n\nA *1-gigawatt AI data center* costs roughly *$80B* to build & operate.",
		),
	);
	let newsSubtextBySlide = $state<string[]>(emptySlides((i) => (i === 0 ? NEWS_DEFAULT_SUBTEXT : '')));
	let textCarouselTextBySlide = $state<string[]>(
		emptySlides(() => TEXT_CAROUSEL_DEFAULTS.body),
	);
	let imageQuoteTextBySlide = $state<string[]>(
		emptySlides(() => IMAGE_QUOTE_DEFAULTS.body),
	);
	let textCarouselNameBySlide = $state<string[]>(emptySlides(() => TEXT_CAROUSEL_DEFAULTS.name));
	let textCarouselHandleBySlide = $state<string[]>(emptySlides(() => TEXT_CAROUSEL_DEFAULTS.handle));
	/** Text carousel profile circle: image URL / inner fill / optional label (else initials from name). */
	let textCarouselAvatarImageBySlide = $state<string[]>(emptySlides(() => ''));
	let textCarouselAvatarModeBySlide = $state<Array<'text' | 'image'>>(emptySlides(() => 'text'));
	let textCarouselAvatarInnerBgBySlide = $state<string[]>(emptySlides(() => ''));
	let textCarouselAvatarLabelBySlide = $state<string[]>(emptySlides(() => ''));
	let textCarouselAvatarRingColorBySlide = $state<string[]>(emptySlides(() => '#c9b97a'));
	let textCarouselAvatarRingWidthBySlide = $state<number[]>(emptySlides(() => 5));
	let imageQuoteFooterLeftBySlide = $state<string[]>(emptySlides(() => IMAGE_QUOTE_DEFAULTS.footerLeft));
	let imageQuoteFooterRightBySlide = $state<string[]>(emptySlides(() => IMAGE_QUOTE_DEFAULTS.footerRight));

	/** Per-template letterbox / film-strip heights (% of canvas) — available on every template. */
	function emptyFilmStripTop(id: FilmStripTemplateId): number[] {
		return emptySlides(() => filmStripDefaultsFor(id).topPct);
	}
	function emptyFilmStripBottom(id: FilmStripTemplateId): number[] {
		return emptySlides(() => filmStripDefaultsFor(id).bottomPct);
	}
	function emptyFilmStripMap(kind: 'top' | 'bottom'): Record<TemplateId, number[]> {
		const out = {} as Record<TemplateId, number[]>;
		for (const id of FILM_STRIP_TEMPLATE_IDS) {
			out[id] = kind === 'top' ? emptyFilmStripTop(id) : emptyFilmStripBottom(id);
		}
		return out;
	}
	let filmStripTopPctByTemplate = $state<Record<TemplateId, number[]>>(emptyFilmStripMap('top'));
	let filmStripBottomPctByTemplate = $state<Record<TemplateId, number[]>>(emptyFilmStripMap('bottom'));
	let bottomShadowPopoverOpen = $state(false);
	let highlightPopoverOpen = $state(false);
	let brandProfilePopoverOpen = $state(false);

	let brandDisplayName = $state(DEFAULT_BRAND_KIT.displayName);
	let brandHandle = $state(DEFAULT_BRAND_KIT.handle);
	/* Opening Branding re-pushes identity once — do not re-run while open (apply writes
	   slide arrays which would re-trigger this effect → infinite_loop / frozen UI). */
	let prevBrandProfilePopoverOpen = false;
	$effect(() => {
		const open = brandProfilePopoverOpen;
		const justOpened = open && !prevBrandProfilePopoverOpen;
		prevBrandProfilePopoverOpen = open;
		if (!justOpened) return;
		const name = String(brandDisplayName ?? '').trim();
		const handle = String(brandHandle ?? '').trim();
		if (!name && !handle) return;
		untrack(() => applyBrandProfileToSlides(name, handle, { force: true }));
	});

	const activeFilmStrip = $derived.by(() => {
		const t = activeTemplate;
		const d = filmStripDefaultsFor(t);
		const top = filmStripTopPctByTemplate[t]?.[activeSlide] ?? d.topPct;
		const bottom = filmStripBottomPctByTemplate[t]?.[activeSlide] ?? d.bottomPct;
		return clampFilmStripPct(top, bottom);
	});

	function setActiveFilmStripTop(raw: number) {
		const t = activeTemplate;
		const d = filmStripDefaultsFor(t);
		const curBottom = filmStripBottomPctByTemplate[t]?.[activeSlide] ?? d.bottomPct;
		const next = clampFilmStripPct(raw, curBottom, 'top');
		const tops = [...(filmStripTopPctByTemplate[t] ?? emptyFilmStripTop(t))];
		const bottoms = [...(filmStripBottomPctByTemplate[t] ?? emptyFilmStripBottom(t))];
		while (tops.length <= activeSlide) tops.push(d.topPct);
		while (bottoms.length <= activeSlide) bottoms.push(d.bottomPct);
		tops[activeSlide] = next.topPct;
		bottoms[activeSlide] = next.bottomPct;
		filmStripTopPctByTemplate = { ...filmStripTopPctByTemplate, [t]: tops };
		filmStripBottomPctByTemplate = { ...filmStripBottomPctByTemplate, [t]: bottoms };
	}

	function setActiveFilmStripBottom(raw: number) {
		const t = activeTemplate;
		const d = filmStripDefaultsFor(t);
		const curTop = filmStripTopPctByTemplate[t]?.[activeSlide] ?? d.topPct;
		const next = clampFilmStripPct(curTop, raw, 'bottom');
		const tops = [...(filmStripTopPctByTemplate[t] ?? emptyFilmStripTop(t))];
		const bottoms = [...(filmStripBottomPctByTemplate[t] ?? emptyFilmStripBottom(t))];
		while (tops.length <= activeSlide) tops.push(d.topPct);
		while (bottoms.length <= activeSlide) bottoms.push(d.bottomPct);
		tops[activeSlide] = next.topPct;
		bottoms[activeSlide] = next.bottomPct;
		filmStripTopPctByTemplate = { ...filmStripTopPctByTemplate, [t]: tops };
		filmStripBottomPctByTemplate = { ...filmStripBottomPctByTemplate, [t]: bottoms };
	}

	function resetActiveFilmStrip() {
		const t = activeTemplate;
		const d = filmStripDefaultsFor(t);
		const tops = [...(filmStripTopPctByTemplate[t] ?? emptyFilmStripTop(t))];
		const bottoms = [...(filmStripBottomPctByTemplate[t] ?? emptyFilmStripBottom(t))];
		while (tops.length <= activeSlide) tops.push(d.topPct);
		while (bottoms.length <= activeSlide) bottoms.push(d.bottomPct);
		tops[activeSlide] = d.topPct;
		bottoms[activeSlide] = d.bottomPct;
		filmStripTopPctByTemplate = { ...filmStripTopPctByTemplate, [t]: tops };
		filmStripBottomPctByTemplate = { ...filmStripBottomPctByTemplate, [t]: bottoms };
	}

	let articleSwipeTextBySlide = $state<string[]>(emptySlides(() => '«« Swipe'));
	/** Article bottom-bar logo image per slide (empty = template default glyph). */
	let articleLogoSrcBySlide = $state<string[]>(emptySlides(() => ''));

	let videoStoryHeadlineBySlide = $state<string[]>(emptySlides(() => VIDEO_STORY_DEFAULTS.headline));
	let videoStoryWatermarkBySlide = $state<string[]>(emptySlides(() => VIDEO_STORY_DEFAULTS.watermark));
	let brandStackBrandBySlide = $state<string[]>(emptySlides(() => BRAND_STACK_DEFAULTS.brand));
	let brandStackBottomMediaBySlide = $state<string[]>(emptySlides(() => BRAND_STACK_DEFAULTS.bottomMediaUrl));
	/** True after a saliency (multi-face) reframe — show composited 9:16 full-bleed instead of CSS dual crop. */
	let videoSplitCompositedBySlide = $state<boolean[]>(emptySlides(() => false));
	let blackTextHeadlineBySlide = $state<string[]>(emptySlides(() => BLACK_TEXT_CAROUSEL_DEFAULTS.headline));
	let blackTextBodyBySlide = $state<string[]>(emptySlides(() => BLACK_TEXT_CAROUSEL_DEFAULTS.body));

	// Stable ids per slide, used as keys for filmstrip reordering.
	let _slideUid = 0;
	function newSlideId() { return `s_${++_slideUid}_${Date.now().toString(36)}`; }
	let slideIds = $state<string[]>(emptySlides(() => newSlideId()));
	$effect(() => {
		// Keep slideIds length in sync with the real deck (`slides`), not a lone slideCount.
		const n = Math.max(1, slides.length);
		if (slideIds.length < n) {
			const add: string[] = [];
			for (let i = slideIds.length; i < n; i++) add.push(newSlideId());
			slideIds = [...slideIds, ...add];
		} else if (slideIds.length > n) {
			slideIds = slideIds.slice(0, n);
		}
	});

	$effect(() => {
		if (slideMusic.length < slideCount) {
			slideMusic = [...slideMusic, ...Array(slideCount - slideMusic.length).fill(null)];
		} else if (slideMusic.length > slideCount) {
			slideMusic = slideMusic.slice(0, slideCount);
		}
	});

	// Close the music picker when the user clicks anywhere outside it. We scope
	// the "inside" check to known data-attributes on both the popover and the
	// flame toggles so toggling works naturally.
	$effect(() => {
		if (musicPickerForSlide === null) return;
		const onDocDown = (e: MouseEvent) => {
			const t = e.target as HTMLElement;
			if (t.closest('[data-music-popover]') || t.closest('[data-music-toggle]')) return;
			musicPickerForSlide = null;
		};
		document.addEventListener('mousedown', onDocDown);
		return () => document.removeEventListener('mousedown', onDocDown);
	});

	// Same for the filmstrip “Add slide” menu (menu was easy to leave open/clipped).
	$effect(() => {
		if (!addSlideMenuOpen) return;
		const onDocDown = (e: MouseEvent) => {
			const t = e.target as HTMLElement;
			if (t.closest('[data-add-slide-menu]')) return;
			addSlideMenuOpen = false;
			addSlideMenuPos = null;
		};
		document.addEventListener('mousedown', onDocDown);
		return () => document.removeEventListener('mousedown', onDocDown);
	});

	/**
	 * Reorder all per-slide arrays to match a new order of indices.
	 * `newOrder` is an array of old indices in their new positions.
	 * e.g. if slides were [A,B,C] and you dropped C before A, newOrder = [2,0,1].
	 */
	function reorderSlides(newOrder: number[]) {
		const pick = <T,>(arr: T[]): T[] => newOrder.map((oldIdx) => arr[oldIdx]);
		const pickOr = <T,>(arr: T[], fallback: T): T[] =>
			newOrder.map((oldIdx) => (oldIdx < arr.length ? arr[oldIdx] : fallback));

		slides          = pick(slides);
		slideTemplates  = pickOr(slideTemplates, 'news' as TemplateId);
		bgImagesByTemplate = (Object.fromEntries(
			(Object.entries(bgImagesByTemplate) as [TemplateId, string[]][]).map(([k, arr]) => [k, pickOr(arr, '')]),
		) as unknown) as Record<TemplateId, string[]>;
		bgVideosByTemplate = (Object.fromEntries(
			(Object.entries(bgVideosByTemplate) as [TemplateId, string[]][]).map(([k, arr]) => [k, pickOr(arr, '')]),
		) as unknown) as Record<TemplateId, string[]>;
		generatingImagesByTemplate = (Object.fromEntries(
			(Object.entries(generatingImagesByTemplate) as [TemplateId, boolean[]][]).map(([k, arr]) => [k, pickOr(arr, false)]),
		) as unknown) as Record<TemplateId, boolean[]>;
		subjectCutouts   = pickOr(subjectCutouts, '');
		newsSolidBgBySlide = pickOr(newsSolidBgBySlide, '');
		showCutout       = pickOr(showCutout, false);
		cuttingOut       = pickOr(cuttingOut, false);
		slideOverlaysByTemplate = (Object.fromEntries(
			(Object.entries(slideOverlaysByTemplate) as [TemplateId, Overlay[][]][]).map(([k, arr]) => [k, pickOr(arr, [] as Overlay[])]),
		) as unknown) as Record<TemplateId, Overlay[][]>;
		slideTextOverlaysByTemplate = (Object.fromEntries(
			(Object.entries(slideTextOverlaysByTemplate) as [TemplateId, TextOverlay[][]][]).map(([k, arr]) => [k, pickOr(arr, [] as TextOverlay[])]),
		) as unknown) as Record<TemplateId, TextOverlay[][]>;
		stylesByTemplateBySlide = (Object.fromEntries(
			(Object.entries(stylesByTemplateBySlide) as [TemplateId, Partial<Record<TextElementKind, TextStyle>>[]][]).map(([k, arr]) => [
				k,
				pickOr(arr, {} as Partial<Record<TextElementKind, TextStyle>>),
			]),
		) as unknown) as Record<TemplateId, Partial<Record<TextElementKind, TextStyle>>[]>;
		tweetTopNameBySlide = pickOr(tweetTopNameBySlide, 'Chef 👨‍🍳');
		tweetTopHandleBySlide = pickOr(tweetTopHandleBySlide, '@chefsevenn');
		tweetBottomNameBySlide = pickOr(tweetBottomNameBySlide, 'Mo Mohler');
		tweetBottomHandleBySlide = pickOr(tweetBottomHandleBySlide, '@MoMohler');
		tweetTopTextBySlide = pickOr(tweetTopTextBySlide, 'Ketchup or mayo or mustard?');
tweetBottomTextBySlide = pickOr(tweetBottomTextBySlide, TWEET_DEFAULTS.bottomText);
tweetTopImageHeightBySlide = pickOr(tweetTopImageHeightBySlide, 720);
tweetTopImageWidthBySlide = pickOr(tweetTopImageWidthBySlide, 920);
tweetTopImageZoomBySlide = pickOr(tweetTopImageZoomBySlide, 1);
tweetTopImagePanXBySlide = pickOr(tweetTopImagePanXBySlide, 50);
tweetTopImagePanYBySlide = pickOr(tweetTopImagePanYBySlide, 50);
		tweetTopAvatarImageBySlide = pickOr(tweetTopAvatarImageBySlide, '');
		tweetTopAvatarModeBySlide = pickOr(tweetTopAvatarModeBySlide, 'text');
		tweetTopAvatarInnerBgBySlide = pickOr(tweetTopAvatarInnerBgBySlide, '');
		tweetTopAvatarLabelBySlide = pickOr(tweetTopAvatarLabelBySlide, '');
		tweetTopAvatarRingColorBySlide = pickOr(tweetTopAvatarRingColorBySlide, '#c9b97a');
		tweetTopAvatarRingWidthBySlide = pickOr(tweetTopAvatarRingWidthBySlide, 4);
		tweetBottomAvatarImageBySlide = pickOr(tweetBottomAvatarImageBySlide, '');
		tweetBottomAvatarModeBySlide = pickOr(tweetBottomAvatarModeBySlide, 'text');
		tweetBottomAvatarInnerBgBySlide = pickOr(tweetBottomAvatarInnerBgBySlide, '');
		tweetBottomAvatarLabelBySlide = pickOr(tweetBottomAvatarLabelBySlide, '');
		tweetBottomAvatarRingColorBySlide = pickOr(tweetBottomAvatarRingColorBySlide, '#c9b97a');
		tweetBottomAvatarRingWidthBySlide = pickOr(tweetBottomAvatarRingWidthBySlide, 4);
		articleTextBySlide = pickOr(articleTextBySlide, '');
		newsSubtextBySlide = pickOr(newsSubtextBySlide, '');
		textCarouselTextBySlide = pickOr(textCarouselTextBySlide, '');
		imageQuoteTextBySlide = pickOr(imageQuoteTextBySlide, '');
		textCarouselNameBySlide = pickOr(textCarouselNameBySlide, 'Captains of industry');
		textCarouselHandleBySlide = pickOr(textCarouselHandleBySlide, '@captainsofindustryy');
		textCarouselAvatarImageBySlide = pickOr(textCarouselAvatarImageBySlide, '');
		textCarouselAvatarModeBySlide = pickOr(textCarouselAvatarModeBySlide, 'text');
		textCarouselAvatarInnerBgBySlide = pickOr(textCarouselAvatarInnerBgBySlide, '');
		textCarouselAvatarLabelBySlide = pickOr(textCarouselAvatarLabelBySlide, '');
		textCarouselAvatarRingColorBySlide = pickOr(textCarouselAvatarRingColorBySlide, '#c9b97a');
		textCarouselAvatarRingWidthBySlide = pickOr(textCarouselAvatarRingWidthBySlide, 5);
		imageQuoteFooterLeftBySlide = pickOr(imageQuoteFooterLeftBySlide, IMAGE_QUOTE_DEFAULTS.footerLeft);
		imageQuoteFooterRightBySlide = pickOr(imageQuoteFooterRightBySlide, IMAGE_QUOTE_DEFAULTS.footerRight);
		filmStripTopPctByTemplate = Object.fromEntries(
			FILM_STRIP_TEMPLATE_IDS.map((id) => [
				id,
				pickOr(filmStripTopPctByTemplate[id] ?? [], filmStripDefaultsFor(id).topPct),
			]),
		) as Record<TemplateId, number[]>;
		filmStripBottomPctByTemplate = Object.fromEntries(
			FILM_STRIP_TEMPLATE_IDS.map((id) => [
				id,
				pickOr(filmStripBottomPctByTemplate[id] ?? [], filmStripDefaultsFor(id).bottomPct),
			]),
		) as Record<TemplateId, number[]>;
		videoStoryHeadlineBySlide = pickOr(videoStoryHeadlineBySlide, VIDEO_STORY_DEFAULTS.headline);
		videoStoryWatermarkBySlide = pickOr(videoStoryWatermarkBySlide, VIDEO_STORY_DEFAULTS.watermark);
		brandStackBrandBySlide = pickOr(brandStackBrandBySlide, BRAND_STACK_DEFAULTS.brand);
		brandStackBottomMediaBySlide = pickOr(brandStackBottomMediaBySlide, BRAND_STACK_DEFAULTS.bottomMediaUrl);
		videoSplitCompositedBySlide = pickOr(videoSplitCompositedBySlide, false);
		blackTextHeadlineBySlide = pickOr(blackTextHeadlineBySlide, BLACK_TEXT_CAROUSEL_DEFAULTS.headline);
		blackTextBodyBySlide = pickOr(blackTextBodyBySlide, BLACK_TEXT_CAROUSEL_DEFAULTS.body);
		articleSwipeTextBySlide = pickOr(articleSwipeTextBySlide, '«« Swipe');
		articleLogoSrcBySlide = pickOr(articleLogoSrcBySlide, '');
		if (exportedSlides.length) exportedSlides = pickOr(exportedSlides, '');
		slideIds        = pickOr(slideIds, newSlideId());
		slideMusic      = pickOr(slideMusic, null);
		circleImages = pick(circleImages);
		circle2Images = pick(circle2Images);
		showCircle2BySlide = pick(showCircle2BySlide);
		showCircleBySlide = pick(showCircleBySlide);
		shadowHeightBySlide = pickOr(shadowHeightBySlide, NEWS_DEFAULT_LAYOUT.shadowHeight);
		shadowStrengthBySlide = pickOr(shadowStrengthBySlide, NEWS_DEFAULT_LAYOUT.shadowStrength);
		shadowCurveBySlide = pickOr(shadowCurveBySlide, NEWS_DEFAULT_LAYOUT.shadowCurve);
		shadowColorBySlide = pickOr(shadowColorBySlide, NEWS_DEFAULT_LAYOUT.shadowColor);
		shadowAutoFitBySlide = pickOr(shadowAutoFitBySlide, true);
		shadowPaintSlideSync = -1;

		// Keep the same logical slide focused after reorder.
		const newActive = newOrder.indexOf(activeSlide);
		if (newActive >= 0) activeSlide = newActive;
	}

	function reorderSlidesByIds(nextIds: string[]) {
		// Translate an id order into an index order, then reuse reorderSlides().
		const prevIds = slideIds;
		const idToOldIndex = new Map(prevIds.map((id, idx) => [id, idx]));
		const newOrder = nextIds
			.map((id) => idToOldIndex.get(id))
			.filter((v): v is number => typeof v === 'number');
		// If something went wrong, fall back to a safe no-op reorder rather than losing slides.
		if (newOrder.length !== prevIds.length) {
			const seen = new Set(newOrder);
			for (let i = 0; i < prevIds.length; i++) if (!seen.has(i)) newOrder.push(i);
		}
		reorderSlides(newOrder);
	}

	/** `reorderSlides` does not remap these; keep them aligned when removing a slide. */
	function pickPerSlideArraysForOldIndices<T>(oldIndices: number[], arr: T[], fallback: T): T[] {
		return oldIndices.map((i) => (i < arr.length ? arr[i] : fallback));
	}

	/** Remove a slide by index (filmstrip / dock). Minimum one slide remains. */
	function deleteSlideAt(del: number) {
		const n = slides.length;
		if (n <= 1) return;
		if (del < 0 || del >= n) return;
		const cur = activeSlide;
		const keep = slides.map((_, i) => i).filter((i) => i !== del);
		let nextActive = 0;
		if (cur < del) nextActive = cur;
		else if (cur > del) nextActive = cur - 1;
		else nextActive = Math.min(del, n - 2);

		reorderSlides(keep);

		activeSlide = Math.max(0, Math.min(slides.length - 1, nextActive));
		slideCount = slides.length;

		videoTrimStartSecBySlide = pickPerSlideArraysForOldIndices(keep, videoTrimStartSecBySlide, 0);
		videoTrimEndSecBySlide = pickPerSlideArraysForOldIndices(keep, videoTrimEndSecBySlide, 0);
		videoDurationBySlide = pickPerSlideArraysForOldIndices(keep, videoDurationBySlide, 0);
		videoMutedBySlide = pickPerSlideArraysForOldIndices(keep, videoMutedBySlide, true);
		videoVolumeBySlide = pickPerSlideArraysForOldIndices(keep, videoVolumeBySlide, 0.8);
		videoSplitCompositedBySlide = pickPerSlideArraysForOldIndices(keep, videoSplitCompositedBySlide, false);
		tweetReplyCountBySlide = pickPerSlideArraysForOldIndices(keep, tweetReplyCountBySlide, '4.2K');
		tweetRepostCountBySlide = pickPerSlideArraysForOldIndices(keep, tweetRepostCountBySlide, '12.8K');
		tweetLikeCountBySlide = pickPerSlideArraysForOldIndices(keep, tweetLikeCountBySlide, '89.4K');
		tweetStylesBySlide = pickPerSlideArraysForOldIndices(keep, tweetStylesBySlide, {} as Partial<Record<TweetKind, TextStyle>>);
		circleImages = pickPerSlideArraysForOldIndices(keep, circleImages, '');
		circle2Images = pickPerSlideArraysForOldIndices(keep, circle2Images, '');
		showCircle2BySlide = pickPerSlideArraysForOldIndices(keep, showCircle2BySlide, false);
		showCircleBySlide = pickPerSlideArraysForOldIndices(keep, showCircleBySlide, false);
		shadowHeightBySlide = pickPerSlideArraysForOldIndices(
			keep,
			shadowHeightBySlide,
			NEWS_DEFAULT_LAYOUT.shadowHeight,
		);
		shadowStrengthBySlide = pickPerSlideArraysForOldIndices(
			keep,
			shadowStrengthBySlide,
			NEWS_DEFAULT_LAYOUT.shadowStrength,
		);
		shadowCurveBySlide = pickPerSlideArraysForOldIndices(
			keep,
			shadowCurveBySlide,
			NEWS_DEFAULT_LAYOUT.shadowCurve,
		);
		shadowColorBySlide = pickPerSlideArraysForOldIndices(
			keep,
			shadowColorBySlide,
			NEWS_DEFAULT_LAYOUT.shadowColor,
		);
		shadowAutoFitBySlide = pickPerSlideArraysForOldIndices(keep, shadowAutoFitBySlide, true);
		shadowPaintSlideSync = -1;
		textOffsetsBySlide = pickPerSlideArraysForOldIndices(keep, textOffsetsBySlide, {} as Record<string, TextOffset>);
		historyByTemplateBySlide = (Object.fromEntries(
			(Object.entries(historyByTemplateBySlide) as [TemplateId, ScopedHistory[]][]).map(([k, arr]) => [
				k,
				pickPerSlideArraysForOldIndices(keep, arr, { undo: [], redo: [] } as ScopedHistory),
			]),
		) as unknown) as Record<TemplateId, ScopedHistory[]>;

		if (musicPickerForSlide === del) musicPickerForSlide = null;
		else if (musicPickerForSlide != null && musicPickerForSlide > del) {
			musicPickerForSlide = musicPickerForSlide - 1;
		}

		showVideoTrim = false;
		videoSeekSec = NaN;
		closeToolbar();
	}

	/** Remove the current slide (dock). */
	function deleteActiveSlide() {
		deleteSlideAt(activeSlide);
	}

	/**
	 * Resize the real deck to `n` slides (1–6). The prompt chip must call this —
	 * assigning `slideCount` alone only pads filmstrip ids and leaves `slides[]` stale,
	 * so Generate fills the old length and snaps the chip back.
	 */
	function setDeckSlideCount(n: number) {
		const target = Math.max(1, Math.min(MAX_STUDIO_SLIDE_COUNT, Math.floor(Number(n) || 1)));
		const prevActive = activeSlide;
		if (target === slides.length) {
			slideCount = target;
			if (slideIds.length < target) {
				const add: string[] = [];
				for (let i = slideIds.length; i < target; i++) add.push(newSlideId());
				slideIds = [...slideIds, ...add];
			} else if (slideIds.length > target) {
				slideIds = slideIds.slice(0, target);
			}
			return;
		}
		while (slides.length < target) {
			const prevTpl = coerceTemplateId(
				slideTemplates[slides.length - 1] ?? lastTemplateUsed ?? 'news',
			);
			addSlide({ template: prevTpl, copyClipFrom: null, select: false });
		}
		while (slides.length > target) {
			deleteSlideAt(slides.length - 1);
		}
		slideCount = slides.length;
		activeSlide = Math.max(0, Math.min(slides.length - 1, prevActive));
		if (slideIds.length > slides.length) slideIds = slideIds.slice(0, slides.length);
	}

	// Filmstrip DnD (dnd-kit). Keep a temporary visual order while dragging
	// so items animate smoothly out of the way (like the reference demo).
	let filmstripIds = $state<string[]>([]);
	let filmstripDraggingId = $state<string | null>(null);

	function filmstripOver(e: any) {
		// Live visual reordering while dragging.
		const base = filmstripIds.length ? filmstripIds : slideIds;
		const next = move(base, e);
		// `move()` returns the same array if nothing changes.
		if (next !== base) filmstripIds = next;
	}

	function endFilmstripDrag(e: any) {
		const canceled = !!e?.canceled;
		if (canceled) {
			filmstripDraggingId = null;
			filmstripIds = [];
			return;
		}
		const nextIds = move(slideIds, e);
		reorderSlidesByIds(nextIds);
		filmstripDraggingId = null;
		filmstripIds = [];
	}

	// dnd-kit-svelte's useSortable currently instantiates entities with register:false.
	// We register them when the DOM node mounts so they become draggable/droppable.
	function registerFilmstripSortable(node: HTMLElement, api: ReturnType<typeof useSortable>) {
		let dispose: any;
		queueMicrotask(() => {
			try {
				dispose = api?.sortable?.register?.();
			} catch {
				// If registration isn't available (or already registered), ignore.
			}
		});
		return {
			destroy() {
				try { dispose?.(); } catch {}
				try { api?.sortable?.unregister?.(); } catch {}
			}
		};
	}
	const activeStyleMap = $derived((stylesByTemplateBySlide[activeTemplate] ?? [])[activeSlide] ?? {});
	const activeHeadlineStyle = $derived(activeStyleMap.headline ?? {});
	const activeSourceStyle = $derived(activeStyleMap.source ?? {});
	const activeTweetStyles = $derived(tweetStylesBySlide[activeSlide] ?? {});

	function isTweetKind(k: TextElementKind | null): k is TweetKind {
		return (
			k === 'tweetTopName' ||
			k === 'tweetTopHandle' ||
			k === 'tweetTopText' ||
			k === 'tweetBottomName' ||
			k === 'tweetBottomHandle' ||
			k === 'tweetBottomText'
		);
	}

	function getActiveStyleForSelection(): TextStyle {
		if (selectedText === 'articleImage' || selectedText === 'articleLogo' || selectedText === 'videoStoryMedia')
			return {};
		if (selectedText === 'tweetTopMedia') return {};
		if (selectedText === 'tweetTopAvatar' || selectedText === 'tweetBottomAvatar') return {};
		if (isTweetKind(selectedText)) return (canvasTweetStyles?.[selectedText] ?? {});
		if (selectedText === 'textOverlay' && selectedTextOverlayId) {
			const current = (slideTextOverlaysByTemplate[previewTemplate] ?? [])[paintSlide] ?? [];
			return (current.find((o) => o.id === selectedTextOverlayId)?.style ?? {});
		}
		if (!selectedText) {
			return (
				canvasHeadlineStyle ??
				((stylesByTemplateBySlide[previewTemplate] ?? [])[paintSlide] ?? {}).headline ??
				{}
			);
		}
		// Never fall back to headline styles — that made the toolbar show 80px on a 24px paragraph.
		// Prefer live style map; fall back to stylesByTemplateBySlide so SSR never sees undefined
		// before canvasStyleMap deriveds are initialized.
		return (
			canvasStyleMap?.[selectedText] ??
			((stylesByTemplateBySlide[previewTemplate] ?? [])[paintSlide] ?? {})[selectedText] ??
			{}
		);
	}

	// Currently selected text element + DOM anchor for the floating toolbar.
	let selectedText = $state<TextElementKind | null>(null);
	let selectedTextOverlayId = $state<string | null>(null);
	let toolbarAnchor = $state<DOMRect | null>(null);
	let toolbarTarget = $state<HTMLElement | null>(null);
	let toolbarAutoFontSize = $state<number | undefined>(undefined);

	function newsAutoHeadlinePx(raw: string): number {
		const len = stripMarkup(raw).length;
		if (len < 60) return 80;
		if (len < 90) return 72;
		if (len < 120) return 64;
		return 56;
	}

	function defaultFontSizeForKind(kind: TextElementKind): number | undefined {
		const tpl = previewTemplate;
		const headlinePx =
			typeof canvasHeadlineStyle.fontSize === 'number' && canvasHeadlineStyle.fontSize > 0
				? canvasHeadlineStyle.fontSize
				: undefined;
		// These reflect the templates' visual defaults (used when no style override exists).
		switch (kind) {
			// News
			case 'source': return 34;
			case 'headline':
				if (tpl === 'news' || tpl === 'blank') return newsAutoHeadlinePx(slides[paintSlide] ?? '');
				if (tpl === 'imageQuote') {
					const n = stripMarkup(slides[paintSlide] ?? '').length;
					if (n <= 70) return 68;
					if (n <= 110) return 58;
					if (n <= 160) return 50;
					if (n <= 220) return 44;
					return 38;
				}
				return headlinePx;
			case 'newsSubtext':
				return NEWS_SUBTEXT_STYLE.fontSize;

			// Article
			case 'articleBody': return 46;
			case 'articleSwipeText': return 28;
			case 'articleImage':
			case 'articleLogo':
				return undefined;

			// Text carousel / white post (shared kinds)
			case 'textCarouselName':
				return tpl === 'whiteThread' || tpl === 'whiteMedia' ? 40 : 46;
			case 'textCarouselHandle':
				return tpl === 'whiteThread' || tpl === 'whiteMedia' ? 34 : 36;
			case 'textCarouselBody':
				if (tpl === 'whiteMedia') return 42;
				if (tpl === 'whiteThread') return 44;
				return 72;
			case 'textCarouselAvatar': return undefined;

			// Image quote
			case 'imageQuoteFooterLeft': return 44;
			case 'imageQuoteFooterRight': return 22;
			// headline kind is used for the quote body in that template; leave undefined here.

			// Tweet
			case 'tweetTopName': return 36;
			case 'tweetTopHandle': return 28;
			case 'tweetTopText': return 42;
			case 'tweetBottomName': return 34;
			case 'tweetBottomHandle': return 26;
			case 'tweetBottomText': return 40;
			case 'tweetReplyCount': return 32;
			case 'tweetRepostCount': return 32;
			case 'tweetLikeCount': return 32;

			case 'tweetTopMedia':
				return undefined;
			case 'tweetTopAvatar':
			case 'tweetBottomAvatar':
				return undefined;

			// Overlays
			case 'textOverlay': return 42;

			case 'videoStoryHeadline':
				if (tpl === 'brandStack') return BRAND_STACK_HEADLINE_STYLE.fontSize;
				if (tpl === 'videoHook') return 56;
				if (tpl === 'videoCreator') return 48;
				if (tpl === 'videoText') return 64;
				if (tpl === 'videoFeature') return 44;
				if (tpl === 'videoPost') return 44;
				return 46;
			case 'videoStoryWatermark': return tpl === 'brandStack' ? 30 : 32;
			case 'brandStackBrand': return 34;
			case 'blackTextHeadline':
				if (tpl === 'photoTopic') return PHOTO_TOPIC_HEADLINE_STYLE.fontSize;
				if (tpl === 'photoCaption') return 36;
				return 46;
			case 'blackTextBody':
				if (tpl === 'photoTopic') return PHOTO_TOPIC_BODY_STYLE.fontSize;
				if (tpl === 'photoCaption') return 36;
				if (tpl === 'videoFeature') return VIDEO_FEATURE_BODY_STYLE.fontSize;
				return 36;
		}
	}

	// Plain-text selection inside the headline (for applyHighlight).
	// null when no active word/range selection.
	let headlineRange = $state<{ start: number; end: number } | null>(null);
	/** Last good plain range (survives brief DOM selection collapse when opening toolbar pickers). */
	let lastCommittedPlainRange = $state<{ start: number; end: number } | null>(null);
	/** Bumped after inline headline markup changes so the canvas can re-select the same plain range. */
	let headlineSelectionRestoreNonce = $state(0);
	let textOverlayRange = $state<{ start: number; end: number } | null>(null);
	const hasRangeSelection = $derived(
		selectedText === 'textOverlay' ? textOverlayRange !== null : headlineRange !== null,
	);

	function toolbarHighlightableRaw(): string {
		const si = paintSlide;
		if (selectedText === 'headline') {
			if (newsHeadlineLive !== null) return newsHeadlineLive;
			return slides[si] ?? '';
		}
		if (selectedText === 'newsSubtext') return newsSubtextBySlide[si] ?? '';
		if (selectedText === 'articleBody') return articleTextBySlide[si] ?? '';
		if (selectedText === 'textCarouselBody') return textCarouselTextBySlide[si] ?? '';
		if (selectedText === 'tweetBottomText') return tweetBottomTextBySlide[si] ?? '';
		if (selectedText === 'tweetTopText') return tweetTopTextBySlide[si] ?? '';
		if (selectedText === 'textOverlay' && selectedTextOverlayId) {
			const arr = (slideTextOverlaysByTemplate[activeTemplate] ?? [])[si] ?? [];
			return arr.find((o) => o.id === selectedTextOverlayId)?.text ?? '';
		}
		if (selectedText === 'videoStoryHeadline') return videoStoryHeadlineBySlide[si] ?? '';
		if (selectedText === 'videoStoryWatermark') return videoStoryWatermarkBySlide[si] ?? '';
		if (selectedText === 'brandStackBrand') return brandStackBrandBySlide[si] ?? '';
		if (selectedText === 'blackTextHeadline') return blackTextHeadlineBySlide[si] ?? '';
		if (selectedText === 'blackTextBody') return blackTextBodyBySlide[si] ?? '';
		return '';
	}

	const toolbarTextColorMixed = $derived.by(() => {
		if (!hasRangeSelection) return false;
		const range = selectedText === 'textOverlay' ? textOverlayRange : headlineRange;
		if (!range) return false;
		if (!studioMarkupFieldActive()) return false;
		const raw = toolbarHighlightableRaw();
		if (!raw) return false;
		const base = getActiveStyleForSelection().color ?? textColor;
		return plainRangeHasMixedForegroundPaint(raw, range.start, range.end, highlightColor, base);
	});

	/** Text swatch + highlight pickers reflect the selected range’s actual paint. */
	const toolbarSelectionPaint = $derived.by(() => {
		if (!hasRangeSelection || !studioMarkupFieldActive()) return null;
		const raw = toolbarHighlightableRaw();
		const range = selectedText === 'textOverlay' ? textOverlayRange : headlineRange;
		if (!raw || !range || range.end <= range.start) return null;
		const blockInk = getActiveStyleForSelection().color ?? textColor;
		return inspectPlainRangePaint(raw, range.start, range.end, studioHighlightDefaults, blockInk);
	});

	const toolbarFloatingStyle = $derived.by(() => {
		let base = getActiveStyleForSelection() ?? {};
		/* Template defaults live on the canvas via `{...TEMPLATE_STYLE, ...saved}`.
		   Surface them in the toolbar so the font label matches what's painted
		   (empty style map used to show Plus Jakarta while News was Bebas). */
		if (previewTemplate === 'news' && (selectedText === 'headline' || selectedText === null)) {
			base = { ...NEWS_HEADLINE_STYLE, ...base };
		} else if (
			previewTemplate === 'photoTopic' &&
			(selectedText === 'blackTextHeadline' || selectedText === null)
		) {
			base = { ...PHOTO_TOPIC_HEADLINE_STYLE, ...base };
		} else if (
			previewTemplate === 'videoText' &&
			(selectedText === 'videoStoryHeadline' || selectedText === null)
		) {
			base = { ...VIDEO_TEXT_HEADLINE_STYLE, ...base };
		}
		if (hasRangeSelection && studioInlineMarkupFieldActive()) {
			const raw = toolbarHighlightableRaw();
			const range = selectedText === 'textOverlay' ? textOverlayRange : headlineRange;
			if (raw && range && range.end > range.start) {
				const w = inspectPlainRangeWeight(raw, range.start, range.end, studioHighlightDefaults);
				if (w != null) base = { ...base, fontWeight: w };
			}
		}
		const paint = toolbarSelectionPaint;
		if (paint?.markerBg) {
			return { ...base, bgColor: paint.markerBg };
		}
		const blockBg = String(base.bgColor ?? '').trim();
		if (blockBg && blockBg !== 'transparent' && blockBg !== 'none') return base;

		// No word selection: still surface a uniform full-field marker so the BG chip
		// matches what is painted (legacy content written before block-bg routing).
		if (!hasRangeSelection && studioMarkupFieldActive()) {
			const raw = toolbarHighlightableRaw();
			const len = stripMarkup(raw).length;
			if (raw && len > 0) {
				const blockInk = base.color ?? textColor;
				const full = inspectPlainRangePaint(raw, 0, len, studioHighlightDefaults, blockInk);
				if (full?.markerBg) return { ...base, bgColor: full.markerBg };
			}
		}

		if (!hasRangeSelection || toolbarTextColorMixed) return base;
		if (!studioMarkupFieldActive()) return base;
		if (paint?.styleKind === 'pattern' || paint?.styleKind === 'gradient') {
			// Solid swatch is misleading for pattern/gradient — keep block color; chip uses activeHighlight.
			return base;
		}
		const raw = toolbarHighlightableRaw();
		const range = selectedText === 'textOverlay' ? textOverlayRange : headlineRange;
		if (!raw || !range || range.end <= range.start) return base;
		const blockInk = getActiveStyleForSelection().color ?? textColor;
		const sw = rangeForegroundSwatchColor(
			raw,
			range.start,
			range.end,
			highlightColor,
			blockInk,
			textColor,
		);
		if (sw === undefined) return base;
		return { ...base, color: sw };
	});

	/** Prefer selection paint in the toolbar; fall back to brand default when nothing is selected. */
	const toolbarActiveHighlight = $derived.by(() => {
		const paint = toolbarSelectionPaint;
		if (paint?.styleKind === 'pattern' && paint.pattern) {
			return {
				styleKind: 'pattern' as const,
				color: paint.color || highlightColor,
				pattern: paint.pattern,
				gradientFrom: highlightGradientFrom,
				gradientTo: highlightGradientTo,
			};
		}
		if (paint?.styleKind === 'gradient' && paint.gradientFrom && paint.gradientTo) {
			return {
				styleKind: 'gradient' as const,
				color: paint.gradientFrom,
				pattern: highlightPattern,
				gradientFrom: paint.gradientFrom,
				gradientTo: paint.gradientTo,
			};
		}
		if (paint?.styleKind === 'solid' && paint.color) {
			return {
				styleKind: 'solid' as const,
				color: paint.color,
				pattern: highlightPattern,
				gradientFrom: highlightGradientFrom,
				gradientTo: highlightGradientTo,
			};
		}
		// Selection exists but paint is mixed / unmarked — don't pretend brand orange is "on".
		if (paint) {
			return {
				styleKind: 'solid' as const,
				color: paint.color || '',
				pattern: '',
				gradientFrom: '',
				gradientTo: '',
			};
		}
		return {
			styleKind: highlightStyleKind,
			color: highlightColor,
			pattern: highlightPattern,
			gradientFrom: highlightGradientFrom,
			gradientTo: highlightGradientTo,
		};
	});

	function onHeadlineRangeSelect(start: number, end: number) {
		if (start < 0 || end < 0 || start === end) {
			headlineRange = null;
			lastCommittedPlainRange = null;
		} else {
			headlineRange = { start, end };
			lastCommittedPlainRange = { start, end };
		}
	}

	// Ranges are plain offsets into the *current* slide's string — never reuse after changing slide.
	$effect(() => {
		void activeSlide;
		headlineRange = null;
		textOverlayRange = null;
		lastCommittedPlainRange = null;
	});

	function tryRestorePlainRangeFromLastCommit(raw: string): void {
		const r = lastCommittedPlainRange;
		if (!r || r.end <= r.start) return;
		const plainLen = stripMarkup(raw).length;
		if (r.start >= 0 && r.end <= plainLen && r.start < r.end) {
			headlineRange = r;
		} else {
			lastCommittedPlainRange = null;
		}
	}

	/** Prefer live DOM selection; then last committed range if the browser collapsed the highlight. */
	function ensurePlainRangeForMarkupTools(raw: string): void {
		if (!raw) return;
		syncHighlightRangeFromDomIfPossible();
		if (!headlineRange) tryRestorePlainRangeFromLastCommit(raw);
	}

	function onTextOverlayRangeSelect(start: number, end: number) {
		if (start < 0 || end < 0 || start === end) {
			textOverlayRange = null;
		} else {
			textOverlayRange = { start, end };
		}
	}

	/** Word range if the user dragged one; otherwise the whole clicked field. */
	function resolveMarkupRange(raw: string): { start: number; end: number } | null {
		if (selectedText === 'textOverlay') {
			if (textOverlayRange && textOverlayRange.end > textOverlayRange.start) return textOverlayRange;
			const len = stripMarkup(raw).length;
			return len > 0 ? { start: 0, end: len } : null;
		}
		ensurePlainRangeForMarkupTools(raw);
		if (headlineRange && headlineRange.end > headlineRange.start) return headlineRange;
		const len = stripMarkup(raw).length;
		if (len <= 0) return null;
		const full = { start: 0, end: len };
		headlineRange = full;
		lastCommittedPlainRange = full;
		return full;
	}

	/** Write raw markup into the active highlightable field (no undo — caller pushes). */
	function setToolbarHighlightableRaw(next: string) {
		if (selectedText === 'headline') {
			setActiveSlideText(next);
			if (newsHeadlineLive !== null) newsHeadlineLive = next;
		} else if (selectedText === 'newsSubtext') {
			newsSubtextBySlide = newsSubtextBySlide.map((x, i) => (i === activeSlide ? next : x));
		} else if (selectedText === 'articleBody') {
			articleTextBySlide = articleTextBySlide.map((x, i) => (i === activeSlide ? next : x));
		} else if (selectedText === 'textCarouselBody') {
			textCarouselTextBySlide = textCarouselTextBySlide.map((x, i) => (i === activeSlide ? next : x));
		} else if (selectedText === 'tweetBottomText') {
			tweetBottomTextBySlide = tweetBottomTextBySlide.map((x, i) => (i === activeSlide ? next : x));
		} else if (selectedText === 'tweetTopText') {
			tweetTopTextBySlide = tweetTopTextBySlide.map((x, i) => (i === activeSlide ? next : x));
		} else if (selectedText === 'videoStoryHeadline') {
			const i = paintSlide;
			videoStoryHeadlineBySlide = videoStoryHeadlineBySlide.map((x, j) => (j === i ? next : x));
		} else if (selectedText === 'videoStoryWatermark') {
			const i = paintSlide;
			videoStoryWatermarkBySlide = videoStoryWatermarkBySlide.map((x, j) => (j === i ? next : x));
		} else if (selectedText === 'brandStackBrand') {
			const i = paintSlide;
			brandStackBrandBySlide = brandStackBrandBySlide.map((x, j) => (j === i ? next : x));
		} else if (selectedText === 'blackTextHeadline') {
			const i = paintSlide;
			blackTextHeadlineBySlide = blackTextHeadlineBySlide.map((x, j) => (j === i ? next : x));
		} else if (selectedText === 'blackTextBody') {
			const i = paintSlide;
			blackTextBodyBySlide = blackTextBodyBySlide.map((x, j) => (j === i ? next : x));
		} else if (selectedText === 'textOverlay' && selectedTextOverlayId) {
			const current = (slideTextOverlaysByTemplate[activeTemplate] ?? [])[activeSlide] ?? [];
			setSlideTextOverlays(
				activeSlide,
				current.map((o) => (o.id === selectedTextOverlayId ? { ...o, text: next } : o)),
				activeTemplate,
			);
		}
	}

	function onHighlight(spec: HighlightSpec) {
		const boldMarkupField =
			selectedText === 'videoStoryHeadline' || selectedText === 'brandStackBrand';
		const isWeight = spec.kind === 'weight';
		if (!studioTextHighlightsEnabled && !boldMarkupField && !isWeight) return;
		// Update Branding / Settings highlight as soon as a swatch is picked
		// (even if the range apply below bails) so both UIs stay in sync.
		if (studioTextHighlightsEnabled && !isWeight) syncBrandHighlightFromToolbar(spec);
		const raw = toolbarHighlightableRaw();
		if (isWeight) {
			ensurePlainRangeForMarkupTools(raw);
			const live = selectedText === 'textOverlay' ? textOverlayRange : headlineRange;
			if (!live || live.end <= live.start) return;
		}
		const range = isWeight
			? (selectedText === 'textOverlay' ? textOverlayRange : headlineRange)
			: resolveMarkupRange(raw);
		if (!range) return;
		const start = range.start;
		const end = range.end;
		if (!(Number.isFinite(start) && Number.isFinite(end) && end > start)) return;

		const appliesMarkup = studioInlineMarkupFieldActive();
		if (!appliesMarkup) return;

		pushUndo(activeTemplate, activeSlide);

		if (selectedText === 'headline') {
			const current =
				newsHeadlineLive !== null ? newsHeadlineLive : (slides[activeSlide] ?? '');
			const next = applyHighlight(current, start, end, spec);
			setActiveSlideText(next);
			if (newsHeadlineLive !== null) newsHeadlineLive = next;
		} else if (selectedText === 'newsSubtext') {
			const current = newsSubtextBySlide[activeSlide] ?? '';
			newsSubtextBySlide = newsSubtextBySlide.map((x, i) =>
				i === activeSlide ? applyHighlight(current, start, end, spec) : x,
			);
		} else if (selectedText === 'articleBody') {
			const current = articleTextBySlide[activeSlide] ?? '';
			articleTextBySlide = articleTextBySlide.map((x, i) => i === activeSlide ? applyHighlight(current, start, end, spec) : x);
		} else if (selectedText === 'textCarouselBody') {
			const current = textCarouselTextBySlide[activeSlide] ?? '';
			textCarouselTextBySlide = textCarouselTextBySlide.map((x, i) => i === activeSlide ? applyHighlight(current, start, end, spec) : x);
		} else if (selectedText === 'tweetBottomText') {
			const current = tweetBottomTextBySlide[activeSlide] ?? '';
			tweetBottomTextBySlide = tweetBottomTextBySlide.map((x, i) => i === activeSlide ? applyHighlight(current, start, end, spec) : x);
		} else if (selectedText === 'tweetTopText') {
			const current = tweetTopTextBySlide[activeSlide] ?? '';
			tweetTopTextBySlide = tweetTopTextBySlide.map((x, i) => i === activeSlide ? applyHighlight(current, start, end, spec) : x);
		} else if (selectedText === 'videoStoryHeadline') {
			const i = paintSlide;
			const current = videoStoryHeadlineBySlide[i] ?? '';
			videoStoryHeadlineBySlide = videoStoryHeadlineBySlide.map((x, j) =>
				j === i ? applyHighlight(current, start, end, spec) : x,
			);
		} else if (selectedText === 'videoStoryWatermark') {
			const i = paintSlide;
			const current = videoStoryWatermarkBySlide[i] ?? '';
			videoStoryWatermarkBySlide = videoStoryWatermarkBySlide.map((x, j) =>
				j === i ? applyHighlight(current, start, end, spec) : x,
			);
		} else if (selectedText === 'brandStackBrand') {
			const i = paintSlide;
			const current = brandStackBrandBySlide[i] ?? '';
			brandStackBrandBySlide = brandStackBrandBySlide.map((x, j) =>
				j === i ? applyHighlight(current, start, end, spec) : x,
			);
		} else if (selectedText === 'blackTextHeadline') {
			const i = paintSlide;
			const current = blackTextHeadlineBySlide[i] ?? '';
			blackTextHeadlineBySlide = blackTextHeadlineBySlide.map((x, j) =>
				j === i ? applyHighlight(current, start, end, spec) : x,
			);
		} else if (selectedText === 'blackTextBody') {
			const i = paintSlide;
			const current = blackTextBodyBySlide[i] ?? '';
			blackTextBodyBySlide = blackTextBodyBySlide.map((x, j) =>
				j === i ? applyHighlight(current, start, end, spec) : x,
			);
		} else if (selectedText === 'textOverlay' && selectedTextOverlayId) {
			const current = (slideTextOverlaysByTemplate[activeTemplate] ?? [])[activeSlide] ?? [];
			setSlideTextOverlays(
				activeSlide,
				current.map((o) => (o.id === selectedTextOverlayId ? { ...o, text: applyHighlight(o.text ?? '', start, end, spec) } : o)),
				activeTemplate,
			);
		} else {
			return;
		}

		if (
			(selectedText === 'headline' ||
				selectedText === 'videoStoryHeadline' ||
				selectedText === 'blackTextHeadline') &&
			headlineRange
		)
			headlineSelectionRestoreNonce++;

		// After DOM updates (+ optional selection restore), sync plain offsets so the next
		// toolbar action applies to the same visible phrase without forcing a re-drag.
		void tick().then(() => {
			if (selectedText === 'textOverlay') return;
			syncHighlightRangeFromDomIfPossible();
		});
	}

	function resolveTypographyEl(el: HTMLElement): HTMLElement {
		// Ghost anchors from range selection have no layout/styles — keep the fallback path.
		if (!el.isConnected) return el;
		if (el.matches('[data-canvas-typography-root]')) return el;
		const marked = el.querySelector('[data-canvas-typography-root]') as HTMLElement | null;
		if (marked) return marked;
		// CanvasMarkupTextBlock wraps display text; font-size lives on the inner node, not the wrapper.
		const withInline = el.querySelector('[style*="font-size"]') as HTMLElement | null;
		if (withInline) return withInline;
		const child = el.firstElementChild as HTMLElement | null;
		return child ?? el;
	}

	function readDesignFontPx(el: HTMLElement): number | undefined {
		const fromAttr = (node: Element | null) => {
			if (!node) return undefined;
			const raw = node.getAttribute('data-design-font-px');
			if (raw == null || raw === '') return undefined;
			const n = Number(raw);
			return Number.isFinite(n) && n > 0 ? n : undefined;
		};
		const direct = fromAttr(el);
		if (direct != null) return direct;
		const marked =
			(el.matches('[data-canvas-typography-root]') ? el : null) ??
			(el.querySelector('[data-canvas-typography-root]') as HTMLElement | null);
		const fromMarked = fromAttr(marked);
		if (fromMarked != null) return fromMarked;
		const nested = el.querySelector('[data-design-font-px]') as HTMLElement | null;
		return fromAttr(nested);
	}

	/** Design-space px currently painted for the selected field (not a sibling field’s size). */
	function resolvePaintedFontSize(): number | undefined {
		const kind = selectedText;
		if (!kind) return undefined;
		const own = getActiveStyleForSelection().fontSize;
		if (typeof own === 'number' && Number.isFinite(own) && own > 0) return Math.round(own);
		const fromDom = toolbarTarget ? readDesignFontPx(toolbarTarget) : undefined;
		if (fromDom != null) return Math.round(fromDom);
		return defaultFontSizeForKind(kind);
	}

	const toolbarPaintedFontSize = $derived.by(() => {
		void selectedText;
		void selectedTextOverlayId;
		void toolbarTarget;
		void canvasStyleMap;
		void canvasTweetStyles;
		void previewTemplate;
		void paintSlide;
		return resolvePaintedFontSize();
	});

	function onTextSelect(kind: TextElementKind, el: HTMLElement) {
		selectedText = kind;
		selectedTextOverlayId = kind === 'textOverlay' ? (el.dataset.textOverlayId ?? null) : null;
		toolbarTarget = el;
		toolbarAnchor = el.getBoundingClientRect();
		// Prefer template defaults; then read the *typography* node (not the selectable wrapper).
		// Reading getComputedStyle on the wrapper inherited a page font (~16–48px) and made +/-
		// stamp a wrong design-size override — canvas text looked stuck or shrank.
		toolbarAutoFontSize = defaultFontSizeForKind(kind);
		requestAnimationFrame(() => {
			try {
				toolbarAutoFontSize = resolvePaintedFontSize() ?? defaultFontSizeForKind(kind);
			} catch {
				// keep fallback
			}
		});
		// Switching to a non-highlightable field drops any stale word-range selection.
		if (
			kind !== 'headline' &&
			kind !== 'newsSubtext' &&
			kind !== 'articleBody' &&
			kind !== 'textCarouselBody' &&
			kind !== 'videoStoryHeadline' &&
			kind !== 'videoStoryWatermark' &&
			kind !== 'blackTextHeadline' &&
			kind !== 'blackTextBody' &&
			!isTweetKind(kind)
		)
			headlineRange = null;
		if (kind !== 'textOverlay') textOverlayRange = null;
	}

	function closeToolbar() {
		selectedText = null;
		selectedTextOverlayId = null;
		toolbarAnchor = null;
		toolbarTarget = null;
		toolbarAutoFontSize = undefined;
		headlineRange = null;
		textOverlayRange = null;
		lastCommittedPlainRange = null;
	}

	/** Floating toolbar trash: remove overlay/media or clear the selected field’s text (all templates). */
	function handleFloatingToolbarDelete() {
		// Capture synchronously — toolbar unmount / blur must not clear selection mid-handler.
		const k = selectedText;
		const slide = paintSlide;
		const tpl = previewTemplate;
		if (!canvasInteractive || !k) return;

		if (k === 'textCarouselAvatar') return;
		if (k === 'tweetTopMedia') return;
		if (k === 'tweetTopAvatar' || k === 'tweetBottomAvatar') return;

		if (k === 'articleImage') {
			pushUndo(tpl, slide);
			setSlideImage(slide, '', tpl);
			closeToolbar();
			return;
		}
		if (k === 'articleLogo') {
			pushUndo(tpl, slide);
			articleLogoSrcBySlide = articleLogoSrcBySlide.map((x, i) => (i === slide ? '' : x));
			closeToolbar();
			return;
		}
		if (k === 'videoStoryMedia') {
			pushUndo(tpl, slide);
			setSlideImage(slide, '', tpl);
			closeToolbar();
			return;
		}

		if (k === 'textOverlay') {
			if (!selectedTextOverlayId) return;
			const overlayId = selectedTextOverlayId;
			pushUndo(tpl, slide);
			const cur = (slideTextOverlaysByTemplate[tpl] ?? [])[slide] ?? [];
			setSlideTextOverlays(
				slide,
				cur.filter((o) => o.id !== overlayId),
				tpl,
			);
			closeToolbar();
			return;
		}

		const clearTextKinds = new Set<TextElementKind>([
			'headline',
			'newsSubtext',
			'source',
			'articleBody',
			'articleSwipeText',
			'textCarouselBody',
			'textCarouselName',
			'textCarouselHandle',
			'tweetTopName',
			'tweetTopHandle',
			'tweetTopText',
			'tweetBottomName',
			'tweetBottomHandle',
			'tweetBottomText',
			'tweetReplyCount',
			'tweetRepostCount',
			'tweetLikeCount',
			'imageQuoteFooterLeft',
			'imageQuoteFooterRight',
			'videoStoryHeadline',
			'videoStoryWatermark',
			'brandStackBrand',
			'blackTextHeadline',
			'blackTextBody',
		]);
		if (!clearTextKinds.has(k)) return;

		pushUndo(tpl, slide);

		switch (k) {
			case 'headline':
				// Image quote reuses `headline` for body copy.
				if (tpl === 'imageQuote') {
					imageQuoteTextBySlide = imageQuoteTextBySlide.map((x, i) => (i === slide ? '' : x));
				} else {
					slides = slides.map((s, i) => (i === slide ? '' : s));
				}
				break;
			case 'newsSubtext':
				newsSubtextBySlide = newsSubtextBySlide.map((x, i) => (i === slide ? '' : x));
				break;
			case 'source':
				if (sourceLabelMode === 'logo') {
					sourceLogoSrc = '';
				} else {
					source = '';
				}
				break;
			case 'articleBody':
				articleTextBySlide = articleTextBySlide.map((x, i) => (i === slide ? '' : x));
				break;
			case 'articleSwipeText':
				articleSwipeTextBySlide = articleSwipeTextBySlide.map((x, i) => (i === slide ? '' : x));
				break;
			case 'textCarouselBody':
				textCarouselTextBySlide = textCarouselTextBySlide.map((x, i) => (i === slide ? '' : x));
				break;
			case 'textCarouselName':
				textCarouselNameBySlide = textCarouselNameBySlide.map((x, i) => (i === slide ? '' : x));
				break;
			case 'textCarouselHandle':
				textCarouselHandleBySlide = textCarouselHandleBySlide.map((x, i) => (i === slide ? '' : x));
				break;
			case 'tweetTopName':
				tweetTopNameBySlide = tweetTopNameBySlide.map((x, i) => (i === slide ? '' : x));
				break;
			case 'tweetTopHandle':
				tweetTopHandleBySlide = tweetTopHandleBySlide.map((x, i) => (i === slide ? '' : x));
				break;
			case 'tweetTopText':
				tweetTopTextBySlide = tweetTopTextBySlide.map((x, i) => (i === slide ? '' : x));
				break;
			case 'tweetBottomName':
				tweetBottomNameBySlide = tweetBottomNameBySlide.map((x, i) => (i === slide ? '' : x));
				break;
			case 'tweetBottomHandle':
				tweetBottomHandleBySlide = tweetBottomHandleBySlide.map((x, i) => (i === slide ? '' : x));
				break;
			case 'tweetBottomText':
				tweetBottomTextBySlide = tweetBottomTextBySlide.map((x, i) => (i === slide ? '' : x));
				break;
			case 'tweetReplyCount':
				tweetReplyCountBySlide = tweetReplyCountBySlide.map((x, i) => (i === slide ? '' : x));
				break;
			case 'tweetRepostCount':
				tweetRepostCountBySlide = tweetRepostCountBySlide.map((x, i) => (i === slide ? '' : x));
				break;
			case 'tweetLikeCount':
				tweetLikeCountBySlide = tweetLikeCountBySlide.map((x, i) => (i === slide ? '' : x));
				break;
			case 'imageQuoteFooterLeft':
				imageQuoteFooterLeftBySlide = imageQuoteFooterLeftBySlide.map((x, i) => (i === slide ? '' : x));
				break;
			case 'imageQuoteFooterRight':
				imageQuoteFooterRightBySlide = imageQuoteFooterRightBySlide.map((x, i) => (i === slide ? '' : x));
				break;
			case 'videoStoryHeadline':
				videoStoryHeadlineBySlide = videoStoryHeadlineBySlide.map((x, i) => (i === slide ? '' : x));
				break;
			case 'videoStoryWatermark':
				videoStoryWatermarkBySlide = videoStoryWatermarkBySlide.map((x, i) => (i === slide ? '' : x));
				break;
			case 'brandStackBrand':
				brandStackBrandBySlide = brandStackBrandBySlide.map((x, i) => (i === slide ? '' : x));
				break;
			case 'blackTextHeadline':
				blackTextHeadlineBySlide = blackTextHeadlineBySlide.map((x, i) => (i === slide ? '' : x));
				break;
			case 'blackTextBody':
				blackTextBodyBySlide = blackTextBodyBySlide.map((x, i) => (i === slide ? '' : x));
				break;
			default:
				break;
		}

		closeToolbar();
	}

	// Recompute toolbar anchor on scroll / resize so it stays glued to the text.
	$effect(() => {
		if (!toolbarTarget) return;
		const update = () => {
			if (toolbarTarget) toolbarAnchor = toolbarTarget.getBoundingClientRect();
		};
		window.addEventListener('scroll', update, true);
		window.addEventListener('resize', update);
		return () => {
			window.removeEventListener('scroll', update, true);
			window.removeEventListener('resize', update);
		};
	});

	function studioMarkupFieldRoot(kind: TextElementKind): HTMLElement | null {
		if (typeof document === 'undefined') return null;
		if (kind === 'headline') {
			return document.querySelector(
				'[data-studio-canvas-root] p[data-text-selectable="headline"]',
			);
		}
		return document.querySelector(
			`[data-studio-canvas-root] [data-text-selectable="${kind}"]`,
		);
	}

	function syncHighlightRangeFromDomIfPossible(): boolean {
		if (!selectedText || selectedText === 'textOverlay') return false;
		if (!toolbarHighlightableRaw()) return false;
		const root = studioMarkupFieldRoot(selectedText);
		if (!root) return false;
		const r = plainRangeFromSelection(root);
		if (!r || r.end <= r.start) return false;
		headlineRange = r;
		return true;
	}

	/** Routes text color to `[[…]]` markup when a phrase is selected; BG always paints the whole field. */
	function onFloatingToolbarChange(patch: Partial<TextStyle>) {
		const kindAtStart = selectedText;
		if (
			kindAtStart === 'articleImage' ||
			kindAtStart === 'articleLogo' ||
			kindAtStart === 'videoStoryMedia'
		)
			return;
		const raw = toolbarHighlightableRaw();
		if (studioInlineMarkupFieldActive() && raw && 'fontWeight' in patch) {
			ensurePlainRangeForMarkupTools(raw);
			const range = selectedText === 'textOverlay' ? textOverlayRange : headlineRange;
			if (range && range.end > range.start) {
				onHighlight({ kind: 'weight', weight: patch.fontWeight });
				const family =
					getActiveStyleForSelection().fontFamily ??
					(kindAtStart === 'textCarouselBody' ? 'Lexend' : FONT_TEMPLATE_DEFAULT);
				if (family && patch.fontWeight != null) {
					void tick().then(() => void loadGoogleFont(family, patch.fontWeight));
				}
				return;
			}
		}
		if (studioTextHighlightsEnabled && studioMarkupFieldActive() && raw && kindAtStart !== 'textOverlay') {
			if ('color' in patch && patch.color !== undefined) {
				ensurePlainRangeForMarkupTools(raw);
				if (headlineRange) {
					onHighlight({ kind: 'color', color: patch.color });
					return;
				}
			}
			if ('bgColor' in patch) {
				// Always whole-field block BG (Canva-style). Strip legacy word markers so the
				// chip / paint match — never apply [[marker]] to a partial selection from BG.
				const stripped = stripMarkerBackgrounds(raw, studioHighlightDefaults);
				pushUndo(previewTemplate, paintSlide);
				if (stripped !== raw) setToolbarHighlightableRaw(stripped);
				const nextPad =
					typeof getActiveStyleForSelection().padding === 'number'
						? undefined
						: TEXT_PAD_DEFAULT;
				const bg = patch.bgColor;
				const clear = bg === undefined || bg === 'transparent' || bg === 'none';
				patchActiveStyle(
					{
						...patch,
						...(clear ? { padding: undefined } : nextPad != null ? { padding: nextPad } : {}),
					},
					{ skipUndo: true, kind: kindAtStart },
				);
				return;
			}
		} else if (
			studioTextHighlightsEnabled &&
			kindAtStart === 'textOverlay' &&
			raw &&
			'bgColor' in patch
		) {
			const stripped = stripMarkerBackgrounds(raw, studioHighlightDefaults);
			pushUndo(previewTemplate, paintSlide);
			if (stripped !== raw) setToolbarHighlightableRaw(stripped);
			const ovStyle =
				((slideTextOverlaysByTemplate[previewTemplate] ?? [])[paintSlide] ?? []).find(
					(o) => o.id === selectedTextOverlayId,
				)?.style ?? {};
			const nextPad = typeof ovStyle.padding === 'number' ? undefined : TEXT_PAD_DEFAULT;
			const bg = patch.bgColor;
			const clear = bg === undefined || bg === 'transparent' || bg === 'none';
			patchActiveStyle(
				{
					...patch,
					...(clear ? { padding: undefined } : nextPad != null ? { padding: nextPad } : {}),
				},
				{ skipUndo: true, kind: kindAtStart },
			);
			return;
		}
		patchActiveStyle(patch, { kind: kindAtStart });
	}

	/** Patch News source-label styles from the settings panel (no canvas selection required). */
	function patchNewsSourceStyle(patch: Partial<TextStyle>) {
		const slide = activeSlide;
		pushUndo('news', slide);
		const prevRow = stylesByTemplateBySlide.news ?? [];
		const n = slides.length;
		const base = Array.from({ length: n }, (_, i) => prevRow[i] ?? {});
		stylesByTemplateBySlide = {
			...stylesByTemplateBySlide,
			news: base.map((m, i) => {
				if (i !== slide) return m;
				const cur = m ?? {};
				const nextSource = { ...(cur.source ?? {}), ...patch };
				if (patch.fontFamily === '') delete (nextSource as { fontFamily?: string }).fontFamily;
				return { ...cur, source: nextSource };
			}),
		};
		const family = patch.fontFamily || canvasSourceStyle.fontFamily;
		const weight = patch.fontWeight ?? canvasSourceStyle.fontWeight ?? 700;
		if (family) void tick().then(() => void loadGoogleFont(family, weight));
	}

	function patchActiveStyle(
		patch: Partial<TextStyle>,
		opts?: { skipUndo?: boolean; kind?: TextElementKind | null },
	) {
		const selected =
			opts && 'kind' in opts ? opts.kind : selectedText;
		if (
			selected === 'articleImage' ||
			selected === 'articleLogo' ||
			selected === 'videoStoryMedia'
		)
			return;
		if (
			selected === 'textCarouselAvatar' ||
			selected === 'tweetTopAvatar' ||
			selected === 'tweetBottomAvatar' ||
			selected === 'tweetTopMedia'
		)
			return;
		if (!opts?.skipUndo) pushUndo(previewTemplate, paintSlide);
		const kindPre =
			selected ??
			(previewTemplate === 'photoTopic'
				? 'blackTextHeadline'
				: previewTemplate === 'news' || previewTemplate === 'blank'
					? 'headline'
					: 'headline');
		const slotPre = canvasStyleMap[kindPre];

		/** Typography that should stay consistent across analogous fields / templates. */
		const TYPO_KEYS = [
			'fontSize',
			'fontFamily',
			'fontWeight',
			'lineHeight',
			'italic',
			'underline',
			'letterSpacing',
			'align',
			'textShadow',
		] as const satisfies readonly (keyof TextStyle)[];
		const typoPatch: Partial<TextStyle> = {};
		for (const k of TYPO_KEYS) {
			if (k in patch) (typoPatch as any)[k] = (patch as any)[k];
		}
		const hasTypo = Object.keys(typoPatch).length > 0;

		const BODY_KINDS = new Set<TextElementKind>([
			'newsSubtext',
			'articleBody',
			'textCarouselBody',
			'blackTextBody',
			'tweetTopText',
			'tweetBottomText',
		]);
		const HEADLINE_KINDS = new Set<TextElementKind>([
			'headline',
			'videoStoryHeadline',
			'blackTextHeadline',
		]);

		function mirrorGroupFor(kind: TextElementKind): TextElementKind[] | null {
			if (BODY_KINDS.has(kind)) return [...BODY_KINDS];
			if (HEADLINE_KINDS.has(kind)) return [...HEADLINE_KINDS];
			return null;
		}

		if (isTweetKind(kindPre)) {
			tweetStylesBySlide = tweetStylesBySlide.map((s, i) => {
				if (i !== paintSlide) return s;
				const cur = s ?? {};
				const k: TweetKind = kindPre as TweetKind;
				return { ...cur, [k]: { ...((cur as any)[k] ?? {}), ...patch } };
			});
		} else if (kindPre === 'textOverlay' && selectedTextOverlayId) {
			const current = (slideTextOverlaysByTemplate[previewTemplate] ?? [])[paintSlide] ?? [];
			setSlideTextOverlays(
				paintSlide,
				current.map((o) => (o.id === selectedTextOverlayId ? { ...o, style: { ...(o.style ?? {}), ...patch } } : o)),
				previewTemplate,
			);
		} else if (kindPre) {
			const k = kindPre as TextElementKind;
			const tpl = previewTemplate;
			const n = slides.length;
			const prevRow = stylesByTemplateBySlide[tpl] ?? [];
			// Pad to deck length so patches apply to the correct slide (restores missing/shorter rows,
			// e.g. older drafts without `videoStory` styles or partial arrays).
			const base = Array.from({ length: n }, (_, i) => prevRow[i] ?? {});
			stylesByTemplateBySlide = {
				...stylesByTemplateBySlide,
				[tpl]: base.map((m, i) => {
					if (i !== paintSlide) return m;
					const cur = m ?? {};
					return { ...cur, [k]: { ...(cur[k] ?? {}), ...patch } };
				}),
			};
			/* Source chip BG is also brand-kit textBgColor — keep them aligned. */
			if (k === 'source' && 'bgColor' in patch) {
				brandTextBgColor = normalizeTextBgHex(String(patch.bgColor ?? ''));
			}

			/* Keep paragraph / headline typography in sync across templates so a News toolbar
			   change isn’t stranded only on the News style map. Color/bg stay template-local. */
			const group = hasTypo ? mirrorGroupFor(k) : null;
			if (group) {
				const slide = paintSlide;
				const nextMap = { ...stylesByTemplateBySlide };
				for (const t of Object.keys(nextMap) as TemplateId[]) {
					const row = [...(nextMap[t] ?? [])];
					while (row.length <= slide) row.push({});
					const cur = { ...(row[slide] ?? {}) };
					for (const gk of group) {
						if (gk === 'tweetTopText' || gk === 'tweetBottomText') continue;
						cur[gk] = { ...(cur[gk] ?? {}), ...typoPatch };
					}
					row[slide] = cur;
					nextMap[t] = row;
				}
				stylesByTemplateBySlide = nextMap;

				if (group.includes('tweetTopText') || group.includes('tweetBottomText')) {
					tweetStylesBySlide = tweetStylesBySlide.map((s, i) => {
						if (i !== slide) return s;
						const cur = { ...(s ?? {}) };
						if (group.includes('tweetTopText')) {
							cur.tweetTopText = { ...(cur.tweetTopText ?? {}), ...typoPatch };
						}
						if (group.includes('tweetBottomText')) {
							cur.tweetBottomText = { ...(cur.tweetBottomText ?? {}), ...typoPatch };
						}
						return cur;
					});
				}
			}
		}

		/* Tweet selection: still mirror body typography into other templates’ body slots. */
		if (hasTypo && isTweetKind(kindPre) && BODY_KINDS.has(kindPre as TextElementKind)) {
			const slide = paintSlide;
			const nextMap = { ...stylesByTemplateBySlide };
			for (const t of Object.keys(nextMap) as TemplateId[]) {
				const row = [...(nextMap[t] ?? [])];
				while (row.length <= slide) row.push({});
				const cur = { ...(row[slide] ?? {}) };
				for (const gk of BODY_KINDS) {
					if (gk === 'tweetTopText' || gk === 'tweetBottomText') continue;
					cur[gk] = { ...(cur[gk] ?? {}), ...typoPatch };
				}
				row[slide] = cur;
				nextMap[t] = row;
			}
			stylesByTemplateBySlide = nextMap;
			tweetStylesBySlide = tweetStylesBySlide.map((s, i) => {
				if (i !== slide) return s;
				const cur = { ...(s ?? {}) };
				cur.tweetTopText = { ...(cur.tweetTopText ?? {}), ...typoPatch };
				cur.tweetBottomText = { ...(cur.tweetBottomText ?? {}), ...typoPatch };
				return cur;
			});
		}

		if (patch.fontFamily != null || patch.fontWeight != null) {
			const family =
				patch.fontFamily ??
				slotPre?.fontFamily ??
				(kindPre === 'textCarouselBody'
					? 'Lexend'
					: kindPre === 'headline'
						? 'Bebas Neue'
						: FONT_TEMPLATE_DEFAULT);
			const weight = patch.fontWeight ?? slotPre?.fontWeight ?? 400;
			/* Run font hints after Svelte flushes the new `font-weight` to the canvas so the change feels instant. */
			void tick().then(() => void loadGoogleFont(family, weight));
		}
		// Keep the toolbar where the user opened it — size / weight / LH
		// changes must not shove the bar as the text box grows.
	}

	// Export
	let exporting = $state(false);
	let exportingAll = $state(false);
	let exportRef: HTMLElement | null = $state(null);

	// ── Output format (canvas size) ───────────────────────────────────────
	type FormatId = 'feed' | 'vertical' | 'wide' | 'square';
	type Format = { id: FormatId; label: string; w: number; h: number; igType: 'post' | 'reel' | 'story' };
	const FORMATS: Format[] = [
		{ id: 'feed', label: 'Feed (4:5)', w: 1080, h: 1350, igType: 'post' },
		{ id: 'vertical', label: 'Vertical (9:16)', w: 1080, h: 1920, igType: 'reel' },
		{ id: 'wide', label: 'Wide (16:9)', w: 1920, h: 1080, igType: 'post' },
		{ id: 'square', label: 'Square (1:1)', w: 1080, h: 1080, igType: 'post' },
	];
	let formatId = $state<FormatId>('feed');

	function normalizeStudioFormatId(raw: unknown): FormatId {
		const s = String(raw ?? '').trim();
		const legacy: Record<string, FormatId> = {
			post: 'feed',
			reel: 'vertical',
			story: 'vertical',
			square: 'square',
			feed: 'feed',
			vertical: 'vertical',
			wide: 'wide',
		};
		return legacy[s] ?? 'feed';
	}
	const format = $derived(FORMATS.find((f) => f.id === formatId) ?? FORMATS[0]);
	const CANVAS_W = $derived(format.w);
	const CANVAS_H = $derived(format.h);

	const paintSlide = $derived(canvasRasterSlide ?? activeSlide);
	const previewTemplate = $derived(coerceTemplateId(slideTemplates[paintSlide]));

	/** Keep bindable shadow* aligned with the painted slide’s per-slide values. */
	$effect(() => {
		const i = paintSlide;
		padShadowBySlide();
		if (shadowPaintSlideSync !== i) {
			shadowPaintSlideSync = i;
			shadowHeight = shadowHeightAt(i);
			shadowStrength = shadowStrengthAt(i);
			shadowCurve = shadowCurveAt(i);
			shadowColor = shadowColorAt(i);
			shadowAutoFit = shadowAutoFitAt(i);
		}
	});
	$effect(() => {
		const i = paintSlide;
		const h = shadowHeight;
		const s = shadowStrength;
		const c = normalizeBottomShadowCurve(shadowCurve);
		const col = normalizeBottomShadowColor(shadowColor);
		const a = !!shadowAutoFit;
		padShadowBySlide();
		if (shadowPaintSlideSync !== i) return;
		let changed = false;
		const nextH = shadowHeightBySlide.map((x, idx) => {
			if (idx !== i) return x;
			if (Math.abs(x - h) > 0.05) {
				changed = true;
				return Math.max(0, Math.min(100, h));
			}
			return x;
		});
		const nextS = shadowStrengthBySlide.map((x, idx) => {
			if (idx !== i) return x;
			if (Math.abs(x - s) > 0.01) {
				changed = true;
				return Math.max(0, Math.min(1, s));
			}
			return x;
		});
		const nextC = shadowCurveBySlide.map((x, idx) => {
			if (idx !== i) return x;
			if (normalizeBottomShadowCurve(x) !== c) {
				changed = true;
				return c;
			}
			return x;
		});
		const nextCol = shadowColorBySlide.map((x, idx) => {
			if (idx !== i) return x;
			const next = normalizeBottomShadowColor(col);
			if (normalizeBottomShadowColor(x) !== next) {
				changed = true;
				return next;
			}
			return x;
		});
		const nextA = shadowAutoFitBySlide.map((x, idx) => {
			if (idx !== i) return x;
			if (!!x !== a) {
				changed = true;
				return a;
			}
			return x;
		});
		if (!changed) return;
		shadowHeightBySlide = nextH;
		shadowStrengthBySlide = nextS;
		shadowCurveBySlide = nextC;
		shadowColorBySlide = nextCol;
		shadowAutoFitBySlide = nextA;
	});
	const paintFilmStrip = $derived.by(() => {
		const t = previewTemplate;
		const d = filmStripDefaultsFor(t);
		const top = filmStripTopPctByTemplate[t]?.[paintSlide] ?? d.topPct;
		const bottom = filmStripBottomPctByTemplate[t]?.[paintSlide] ?? d.bottomPct;
		return clampFilmStripPct(top, bottom);
	});
	const previewCanvasOverflowClass = $derived(studioTemplateRuntime(previewTemplate).canvasOverflowClass);
	const canvasInteractive = $derived(canvasRasterSlide === null);

	/** Mirrors News headline markup during inline edit so `slides` isn't rewritten every keystroke (avoids full preview flicker). */
	let newsHeadlineLive = $state<string | null>(null);

	const canvasOverlayText = $derived.by(() => {
		const raw = newsHeadlineLive !== null ? newsHeadlineLive : (slides[paintSlide] ?? '');
		return studioTextHighlightsEnabled ? raw : stripMarkup(raw);
	});
	const canvasNewsSubtext = $derived.by(() => {
		const raw = previewTemplate === 'news' ? (newsSubtextBySlide[paintSlide] ?? '') : '';
		return studioTextHighlightsEnabled ? raw : stripMarkup(raw);
	});
	const canvasBackgroundImage = $derived(
		studioCanvasImageUrl(
			resolveMediaUrl((bgImagesByTemplate[previewTemplate] ?? [])[paintSlide] ?? ''),
		),
	);
	const canvasBackgroundVideo = $derived(
		resolveMediaUrl((bgVideosByTemplate[previewTemplate] ?? [])[paintSlide] ?? ''),
	);
	const canvasBrandStackBottomMedia = $derived(
		studioCanvasImageUrl(resolveMediaUrl(brandStackBottomMediaBySlide[paintSlide] ?? '')),
	);
	const canvasVideoTrimStart = $derived(videoTrimStartSecBySlide[paintSlide] ?? 0);
	const canvasVideoTrimEnd = $derived(videoTrimEndSecBySlide[paintSlide] ?? 0);
	const canvasVideoDuration = $derived(videoDurationBySlide[paintSlide] ?? 0);
	const canvasVideoMuted = $derived(videoMutedBySlide[paintSlide] ?? true);
	const canvasVideoVolume = $derived(videoVolumeBySlide[paintSlide] ?? 0.8);
	const canvasCutout = $derived(resolveMediaUrl(subjectCutouts[paintSlide] ?? ''));
	const canvasShowCutout = $derived(
		(showCutout[paintSlide] ?? false) &&
			!!canvasCutout &&
			!String(canvasBackgroundVideo ?? '').trim(),
	);
	const canvasCircleImg = $derived(
		studioCanvasImageUrl(resolveMediaUrl(circleImages[paintSlide] ?? '')),
	);
	const canvasCircle2Img = $derived(
		studioCanvasImageUrl(resolveMediaUrl(circle2Images[paintSlide] ?? '')),
	);
	const canvasShowCircle2 = $derived(showCircle2BySlide[paintSlide] ?? false);
	const canvasShowPrimaryCircle = $derived(showCircleBySlide[paintSlide] ?? false);
	const canvasOverlays = $derived((slideOverlaysByTemplate[previewTemplate] ?? [])[paintSlide] ?? []);
	const canvasTextOverlays = $derived((slideTextOverlaysByTemplate[previewTemplate] ?? [])[paintSlide] ?? []);
	const canvasStyleMap = $derived((stylesByTemplateBySlide[previewTemplate] ?? [])[paintSlide] ?? {});
	const canvasHeadlineStyle = $derived(canvasStyleMap.headline ?? {});
	const canvasNewsSubtextStyle = $derived(canvasStyleMap.newsSubtext ?? {});
	const canvasSourceStyle = $derived({ align: 'center' as const, ...(canvasStyleMap.source ?? {}) });
	const canvasVideoStoryHeadlineStyle = $derived(canvasStyleMap.videoStoryHeadline ?? {});
	const canvasVideoStoryWatermarkStyle = $derived(canvasStyleMap.videoStoryWatermark ?? {});
	const canvasBrandStackBrandStyle = $derived(canvasStyleMap.brandStackBrand ?? {});
	const canvasBlackTextHeadlineStyle = $derived(canvasStyleMap.blackTextHeadline ?? {});
	const canvasBlackTextBodyStyle = $derived(canvasStyleMap.blackTextBody ?? {});
	const canvasTweetStyles = $derived(tweetStylesBySlide[paintSlide] ?? {});

	/** News / dark-canvas templates — base ink is white so the toolbar doesn't default to near-black on black slides. */
	const canvasHeadlineInk = $derived(
		previewTemplate === 'news' ||
			previewTemplate === 'imageQuote' ||
			previewTemplate === 'blackText' ||
			isPhotoStoryFamily(previewTemplate) ||
			isVideoStoryFamily(previewTemplate)
			? '#FFFFFF'
			: textColor,
	);

	function studioInlineMarkupFieldActive(): boolean {
		const k = selectedText;
		if (!k) return false;
		if (k === 'textOverlay') return !!selectedTextOverlayId;
		return (
			k === 'headline' ||
			k === 'newsSubtext' ||
			k === 'articleBody' ||
			k === 'textCarouselBody' ||
			k === 'tweetTopText' ||
			k === 'tweetBottomText' ||
			k === 'videoStoryHeadline' ||
			k === 'videoStoryWatermark' ||
			k === 'brandStackBrand' ||
			k === 'blackTextHeadline' ||
			k === 'blackTextBody'
		);
	}

	function studioMarkupFieldActive(): boolean {
		const k = selectedText;
		if (!k) return false;
		// Creator / hook headlines use [[…]] as bold emphasis — keep markup tools
		// available even when Branding “Highlight” (color accents) is off.
		const boldMarkupField = k === 'videoStoryHeadline' || k === 'brandStackBrand';
		if (!studioTextHighlightsEnabled && !boldMarkupField) return false;
		return studioInlineMarkupFieldActive();
	}

	/** Full-canvas loading overlay: generate/fetch, variant pass, paint flush, bg gen, media apply/load, or export. */
	const studioCanvasBusyLoading = $derived(
		studioGenerating ||
			fetchingNews ||
			generatingVariants ||
			studioImageGenPaintHold ||
			backgroundMediaLoading ||
			exporting ||
			exportingAll ||
			!!(generatingImagesByTemplate[previewTemplate] ?? [])[paintSlide] ||
			!!(cuttingOut[paintSlide] ?? false),
	);

	// ── Draft persistence (Supabase) ──────────────────────────────────────
	type DraftRow = { id: string; kind: string; state: any; updated_at: string };
	/** Workspace draft rows — keep in sync with `STUDIO_WORKSPACE_DRAFT_KIND` on `carousels/+page.svelte`. */
	const DRAFT_KIND = 'news_studio';
	/** Named snapshots from Studio — listed on the dashboard; open with `?saved=<id>`. */
	const STUDIO_SAVED_TEMPLATE_KIND = 'studio_saved_template';
	const STUDIO_TEMPLATE_OVERRIDE_KIND = 'studio_template_override';
	const BUILTIN_TEMPLATE_OVERWRITE_ID = '__builtin__';
	let accountTemplateOverrides = $state<Partial<Record<TemplateId, TemplateDevOverrideSnapshot>>>({});
	let draftId = $state<string>('');
	let showSaveTemplatePanel = $state(false);
	let showImportJsonPanel = $state(false);
	let importJsonText = $state('');
	let importJsonError = $state('');
	let importJsonFeedback = $state('');
	let importMergeMode = $state<ExternalSlideMergeMode>('mix');
	let studioTemplateName = $state('');
	let studioTemplateSaving = $state(false);
	let studioTemplateFeedback = $state('');
	let savedStudioTemplates = $state<SavedStudioTemplateMeta[]>([]);
	let savedStudioTemplatesLoading = $state(false);
	/** Per-slide saved layout id from Save template (shown in template dropdown). */
	let savedTemplateIdBySlide = $state<string[]>(emptySlides(() => ''));
	let savedTemplateNameBySlide = $state<string[]>(emptySlides(() => ''));
	let savedTemplateStateCache = $state<Record<string, Record<string, unknown>>>({});
	let draftSaving = $state(false);
	let draftError = $state('');
	/** True after local edits until Save template (or intentional discard). */
	let studioHasUnsavedChanges = $state(false);
	/** Bypass leave guard after user confirms leave / successful save. */
	let allowStudioLeave = $state(false);
	/** Unsaved-changes leave dialog. */
	let leavePromptOpen = $state(false);
	let pendingLeaveHref = $state('');
	let leaveSaveName = $state('');
	let leaveSaveBusy = $state(false);
	let leaveSaveError = $state('');
	/** Last export failure message (html-to-image often rejects with an Event). */
	let lastExportError = $state('');
	/** Gate draft restore / starter seed (avoids mutating mid-hydrate). */
	let draftLoaded = $state(false);
	let sourceLogoInput = $state<HTMLInputElement | null>(null);
	/** Shown after a successful manual save from the sidebar button. */
	/** HTTPS preview URL when still on legacy storage/CDN — prefer `draftPreviewKey` + R2. */
	let draftPreviewUrl = $state('');
	/** Object key under R2 (`userId/draft.png` or templates path) — signed at read time. */
	let draftPreviewKey = $state('');
	let draftRestoring = $state(true);

	const studioBooting = $derived(!initialTemplateParamApplied || draftRestoring || !userId);

	function applyDraftState(s: Record<string, any>) {
		// Restore (best-effort) — shared by autosave draft + saved templates.
		studioDraftWasRestored = true;
		if (typeof s.formatId === 'string') formatId = normalizeStudioFormatId(s.formatId);
		if (typeof s.slideCount === 'number' && Number.isFinite(s.slideCount)) {
			slideCount = Math.max(1, Math.min(MAX_STUDIO_SLIDE_COUNT, Math.floor(s.slideCount)));
		}
		if (typeof s.lastTemplateUsed === 'string') lastTemplateUsed = coerceTemplateId(s.lastTemplateUsed);
		if (Array.isArray(s.slides)) slides = s.slides.map((x: unknown) => stripEmDashes(String(x ?? '')));
		if (typeof s.activeSlide === 'number') activeSlide = Math.max(0, Math.min((s.slides?.length ?? slides.length) - 1, s.activeSlide));
		if (typeof s.category === 'string') category = s.category;
		/* Prompt-bar chips use fixed Studio defaults — not restored from drafts. */
		if (typeof s.storyCategory === 'string') storyCategory = s.storyCategory;
		/* Prompt fields stay empty on draft restore — use History to refill. */
		if (typeof (s as any).factTopicCategory === 'string') factTopicCategory = String((s as any).factTopicCategory ?? 'any');
		if (typeof (s as any).quoteTopicCategory === 'string') quoteTopicCategory = String((s as any).quoteTopicCategory ?? 'any');
		{
			const sc = Number((s as any).stepsCount);
			if (Number.isFinite(sc)) stepsCount = Math.max(3, Math.min(8, Math.floor(sc)));
		}
		if (typeof s.source === 'string') {
			source = isPlaceholderNewsSource(s.source) ? defaultNewsSource() : s.source;
		}
		if (typeof (s as any).sourceLogoSrc === 'string') sourceLogoSrc = String((s as any).sourceLogoSrc ?? '').trim();
		if ((s as any).sourceLabelMode === 'text' || (s as any).sourceLabelMode === 'logo') {
			sourceLabelMode = 'logo';
		}
		if ((s as any).sourceBorderKind === 'none' || (s as any).sourceBorderKind === 'rules' || (s as any).sourceBorderKind === 'box') {
			sourceBorderKind = (s as any).sourceBorderKind;
		}
		if (typeof (s as any).sourceBorderColor === 'string') {
			sourceBorderColor = String((s as any).sourceBorderColor ?? '');
		}
		const slw = Number((s as any).sourceLogoWidth);
		if (Number.isFinite(slw)) sourceLogoWidth = Math.round(Math.max(80, Math.min(400, slw)));
		if (typeof (s as any).sourceLogoPlateColor === 'string') {
			sourceLogoPlateColor = String((s as any).sourceLogoPlateColor ?? '').trim();
		}
		if (typeof s.articleUrl === 'string') articleUrl = s.articleUrl;
		if (typeof s.articleTitle === 'string') articleTitle = s.articleTitle;
		if (typeof s.articleSnippet === 'string') articleSnippet = s.articleSnippet;
		if (typeof (s as any).draftPreviewUrl === 'string') {
			draftPreviewUrl = (s as any).draftPreviewUrl.trim();
		} else {
			draftPreviewUrl = '';
		}
		const keyFrom =
			typeof (s as any).draftPreviewKey === 'string'
				? String((s as any).draftPreviewKey).trim()
				: typeof (s as any).draftPreviewPath === 'string'
					? String((s as any).draftPreviewPath).trim()
					: '';
		draftPreviewKey = keyFrom;

		if (Array.isArray(s.slideTemplates)) {
			slideTemplates = (s.slideTemplates as unknown[]).map((t) => coerceTemplateId(t));
		}
		if (Array.isArray((s as any).savedTemplateIdBySlide)) {
			savedTemplateIdBySlide = (s as any).savedTemplateIdBySlide.map((x: unknown) => String(x ?? ''));
		}
		if (Array.isArray((s as any).savedTemplateNameBySlide)) {
			savedTemplateNameBySlide = (s as any).savedTemplateNameBySlide.map((x: unknown) =>
				String(x ?? ''),
			);
		}
		// Do not force `?template=` over a restored deck — that wiped per-slide mixes.
		// Starter deep links seed via `seedFreshTemplateSession` / onMount, then clear.
		// Back-compat: old drafts stored background media per slide (treat as News background).
		if (Array.isArray((s as any).backgroundImages)) {
			const imgs = (s as any).backgroundImages as string[];
			bgImagesByTemplate = { ...bgImagesByTemplate, news: imgs.map((x) => String(x ?? '')) };
		}
		if (Array.isArray((s as any).backgroundVideos)) {
			const vids = (s as any).backgroundVideos as string[];
			bgVideosByTemplate = { ...bgVideosByTemplate, news: vids.map((x) => String(x ?? '')) };
		}
		if ((s as any).bgImagesByTemplate && typeof (s as any).bgImagesByTemplate === 'object') {
			bgImagesByTemplate = { ...emptyTemplateMediaUrls(), ...(s as any).bgImagesByTemplate };
		}
		if ((s as any).bgVideosByTemplate && typeof (s as any).bgVideosByTemplate === 'object') {
			bgVideosByTemplate = { ...emptyTemplateMediaUrls(), ...(s as any).bgVideosByTemplate };
		}
		if (Array.isArray((s as any).newsSolidBgBySlide)) {
			newsSolidBgBySlide = (s as any).newsSolidBgBySlide.map((x: unknown) => String(x ?? ''));
		}
		if (s.slideOverlaysByTemplate && typeof s.slideOverlaysByTemplate === 'object') {
			// Deep-clone to avoid any accidental shared references across templates/slides.
			const raw = s.slideOverlaysByTemplate as Record<TemplateId, Overlay[][]>;
			slideOverlaysByTemplate = {
				blank: (raw.blank ?? []).map((row) => (row ?? []).map((o) => ({ ...(o as any) }))),
				news: (raw.news ?? []).map((row) => (row ?? []).map((o) => ({ ...(o as any) }))),
				tweet: (raw.tweet ?? []).map((row) => (row ?? []).map((o) => ({ ...(o as any) }))),
				article: (raw.article ?? []).map((row) => (row ?? []).map((o) => ({ ...(o as any) }))),
				textCarousel: (raw.textCarousel ?? []).map((row) => (row ?? []).map((o) => ({ ...(o as any) }))),
				imageQuote: (raw.imageQuote ?? []).map((row) => (row ?? []).map((o) => ({ ...(o as any) }))),
				videoStory: (raw.videoStory ?? []).map((row) => (row ?? []).map((o) => ({ ...(o as any) }))),
				videoFit: (raw.videoStory ?? []).map((row) => (row ?? []).map((o) => ({ ...(o as any) }))),
				videoSplit: (raw.videoSplit ?? raw.videoStory ?? []).map((row) => (row ?? []).map((o) => ({ ...(o as any) }))),
				videoBlur: (raw.videoStory ?? []).map((row) => (row ?? []).map((o) => ({ ...(o as any) }))),
				videoHook: (raw.videoStory ?? []).map((row) => (row ?? []).map((o) => ({ ...(o as any) }))),
				videoCreator: (raw.videoStory ?? []).map((row) => (row ?? []).map((o) => ({ ...(o as any) }))),
				videoText: (raw.videoStory ?? []).map((row) => (row ?? []).map((o) => ({ ...(o as any) }))),
				videoSource: (raw.videoStory ?? []).map((row) => (row ?? []).map((o) => ({ ...(o as any) }))),
				videoFeature: (raw.videoStory ?? []).map((row) => (row ?? []).map((o) => ({ ...(o as any) }))),
				videoPost: (raw.videoStory ?? []).map((row) => (row ?? []).map((o) => ({ ...(o as any) }))),
				brandStack: (raw.videoStory ?? []).map((row) => (row ?? []).map((o) => ({ ...(o as any) }))),
				blackText: (raw.blackText ?? []).map((row) => (row ?? []).map((o) => ({ ...(o as any) }))),
				photoTopic: (raw.photoTopic ?? []).map((row) => (row ?? []).map((o) => ({ ...(o as any) }))),
				photoCaption: (raw.photoCaption ?? []).map((row) => (row ?? []).map((o) => ({ ...(o as any) }))),
				whiteThread: (raw.whiteThread ?? []).map((row) => (row ?? []).map((o) => ({ ...(o as any) }))),
				whiteMedia: (raw.whiteMedia ?? []).map((row) => (row ?? []).map((o) => ({ ...(o as any) }))),
			};
		} else if (Array.isArray(s.slideOverlays)) {
			// Back-compat: old drafts stored overlays per slide (treat as News overlays).
			slideOverlaysByTemplate = { ...slideOverlaysByTemplate, news: s.slideOverlays as Overlay[][] };
		}
		if (s.slideTextOverlaysByTemplate && typeof s.slideTextOverlaysByTemplate === 'object') {
			// Deep-clone to avoid any accidental shared references across templates/slides.
			const raw = s.slideTextOverlaysByTemplate as Record<TemplateId, TextOverlay[][]>;
			slideTextOverlaysByTemplate = {
				blank: (raw.blank ?? []).map((row) => (row ?? []).map((t) => ({ ...(t as any), style: { ...(((t as any).style ?? {}) as any) } }))),
				news: (raw.news ?? []).map((row) => (row ?? []).map((t) => ({ ...(t as any), style: { ...(((t as any).style ?? {}) as any) } }))),
				tweet: (raw.tweet ?? []).map((row) => (row ?? []).map((t) => ({ ...(t as any), style: { ...(((t as any).style ?? {}) as any) } }))),
				article: (raw.article ?? []).map((row) => (row ?? []).map((t) => ({ ...(t as any), style: { ...(((t as any).style ?? {}) as any) } }))),
				textCarousel: (raw.textCarousel ?? []).map((row) => (row ?? []).map((t) => ({ ...(t as any), style: { ...(((t as any).style ?? {}) as any) } }))),
				imageQuote: (raw.imageQuote ?? []).map((row) => (row ?? []).map((t) => ({ ...(t as any), style: { ...(((t as any).style ?? {}) as any) } }))),
				videoStory: (raw.videoStory ?? []).map((row) => (row ?? []).map((t) => ({ ...(t as any), style: { ...(((t as any).style ?? {}) as any) } }))),
				videoFit: (raw.videoStory ?? []).map((row) => (row ?? []).map((t) => ({ ...(t as any), style: { ...(((t as any).style ?? {}) as any) } }))),
				videoSplit: (raw.videoSplit ?? raw.videoStory ?? []).map((row) => (row ?? []).map((t) => ({ ...(t as any), style: { ...(((t as any).style ?? {}) as any) } }))),
				videoBlur: (raw.videoStory ?? []).map((row) => (row ?? []).map((t) => ({ ...(t as any), style: { ...(((t as any).style ?? {}) as any) } }))),
				videoHook: (raw.videoStory ?? []).map((row) => (row ?? []).map((t) => ({ ...(t as any), style: { ...(((t as any).style ?? {}) as any) } }))),
				videoCreator: (raw.videoStory ?? []).map((row) => (row ?? []).map((t) => ({ ...(t as any), style: { ...(((t as any).style ?? {}) as any) } }))),
				videoText: (raw.videoStory ?? []).map((row) => (row ?? []).map((t) => ({ ...(t as any), style: { ...(((t as any).style ?? {}) as any) } }))),
				videoSource: (raw.videoStory ?? []).map((row) => (row ?? []).map((t) => ({ ...(t as any), style: { ...(((t as any).style ?? {}) as any) } }))),
				videoFeature: (raw.videoStory ?? []).map((row) => (row ?? []).map((t) => ({ ...(t as any), style: { ...(((t as any).style ?? {}) as any) } }))),
				videoPost: (raw.videoStory ?? []).map((row) => (row ?? []).map((t) => ({ ...(t as any), style: { ...(((t as any).style ?? {}) as any) } }))),
				brandStack: (raw.videoStory ?? []).map((row) => (row ?? []).map((t) => ({ ...(t as any), style: { ...(((t as any).style ?? {}) as any) } }))),
				blackText: (raw.blackText ?? []).map((row) => (row ?? []).map((t) => ({ ...(t as any), style: { ...(((t as any).style ?? {}) as any) } }))),
				photoTopic: (raw.photoTopic ?? []).map((row) => (row ?? []).map((t) => ({ ...(t as any), style: { ...(((t as any).style ?? {}) as any) } }))),
				photoCaption: (raw.photoCaption ?? []).map((row) => (row ?? []).map((t) => ({ ...(t as any), style: { ...(((t as any).style ?? {}) as any) } }))),
				whiteThread: (raw.whiteThread ?? []).map((row) => (row ?? []).map((t) => ({ ...(t as any), style: { ...(((t as any).style ?? {}) as any) } }))),
				whiteMedia: (raw.whiteMedia ?? []).map((row) => (row ?? []).map((t) => ({ ...(t as any), style: { ...(((t as any).style ?? {}) as any) } }))),
			};
		} else if (Array.isArray(s.slideTextOverlays)) {
			// Back-compat: old drafts stored text overlays per slide (treat as News overlays).
			slideTextOverlaysByTemplate = { ...slideTextOverlaysByTemplate, news: s.slideTextOverlays as TextOverlay[][] };
		}
		// Style persistence (per-template, per-layer). Back-compat: older drafts had
		// `headlineStyles`/`sourceStyles` arrays, which we treat as News styles.
		if (s.stylesByTemplateBySlide && typeof s.stylesByTemplateBySlide === 'object') {
			// Normalize: ensure all templates exist and each entry is an array of per-slide maps.
			const raw = s.stylesByTemplateBySlide as any;
			const n = Array.isArray(s.slides) ? s.slides.length : slides.length;
			const norm = (v: any) =>
				Array.from({ length: n }, (_, i) => {
					const m = Array.isArray(v) ? v[i] : null;
					return m && typeof m === 'object' ? m : {};
				});
			stylesByTemplateBySlide = {
				blank: norm(raw.blank),
				news: norm(raw.news),
				tweet: norm(raw.tweet),
				article: norm(raw.article),
				textCarousel: norm(raw.textCarousel),
				imageQuote: norm(raw.imageQuote),
				videoStory: norm(raw.videoStory),
				videoFit: norm(raw.videoStory),
				videoSplit: norm(raw.videoSplit ?? raw.videoStory),
				videoBlur: norm(raw.videoStory),
				videoHook: norm(raw.videoStory),
				videoCreator: norm(raw.videoStory),
				videoText: norm(raw.videoStory),
				videoSource: norm(raw.videoStory),
				videoFeature: norm(raw.videoStory),
				videoPost: norm(raw.videoStory),
				brandStack: norm(raw.videoStory),
				blackText: norm(raw.blackText),
				photoTopic: norm(raw.photoTopic),
				photoCaption: norm(raw.photoCaption),
				whiteThread: norm(raw.whiteThread),
				whiteMedia: norm(raw.whiteMedia),
			} as any;
		} else {
			if (Array.isArray((s as any).headlineStyles)) {
				const hs = (s as any).headlineStyles as TextStyle[];
				stylesByTemplateBySlide = {
					...stylesByTemplateBySlide,
					news: hs.map((st, i) => ({ ...((stylesByTemplateBySlide.news ?? [])[i] ?? {}), headline: st ?? {} })),
				};
			}
			if (Array.isArray((s as any).sourceStyles)) {
				const ss = (s as any).sourceStyles as TextStyle[];
				stylesByTemplateBySlide = {
					...stylesByTemplateBySlide,
					news: (stylesByTemplateBySlide.news ?? []).map((m, i) => ({ ...(m ?? {}), source: ss[i] ?? {} })),
				};
			}
		}
		if (Array.isArray(s.tweetStylesBySlide)) tweetStylesBySlide = s.tweetStylesBySlide;
		if (Array.isArray(s.tweetTopNameBySlide)) tweetTopNameBySlide = s.tweetTopNameBySlide;
		if (Array.isArray(s.tweetTopHandleBySlide)) tweetTopHandleBySlide = s.tweetTopHandleBySlide;
		if (Array.isArray(s.tweetBottomNameBySlide)) tweetBottomNameBySlide = s.tweetBottomNameBySlide;
		if (Array.isArray(s.tweetBottomHandleBySlide)) tweetBottomHandleBySlide = s.tweetBottomHandleBySlide;
		if (Array.isArray(s.tweetTopTextBySlide)) tweetTopTextBySlide = s.tweetTopTextBySlide;
		if (Array.isArray(s.tweetBottomTextBySlide)) tweetBottomTextBySlide = s.tweetBottomTextBySlide;
		if (Array.isArray((s as any).tweetTopImageHeightBySlide)) tweetTopImageHeightBySlide = (s as any).tweetTopImageHeightBySlide;
		if (Array.isArray((s as any).tweetTopImageWidthBySlide)) tweetTopImageWidthBySlide = (s as any).tweetTopImageWidthBySlide;
		if (Array.isArray((s as any).tweetTopImageZoomBySlide)) tweetTopImageZoomBySlide = (s as any).tweetTopImageZoomBySlide;
		if (Array.isArray((s as any).tweetTopImagePanXBySlide)) tweetTopImagePanXBySlide = (s as any).tweetTopImagePanXBySlide;
		if (Array.isArray((s as any).tweetTopImagePanYBySlide)) tweetTopImagePanYBySlide = (s as any).tweetTopImagePanYBySlide;
		if (Array.isArray((s as any).tweetTopAvatarImageBySlide)) {
			tweetTopAvatarImageBySlide = (s as any).tweetTopAvatarImageBySlide.map((x: unknown) => String(x ?? ''));
		}
		if (Array.isArray((s as any).tweetTopAvatarModeBySlide)) {
			tweetTopAvatarModeBySlide = (s as any).tweetTopAvatarModeBySlide.map((x: unknown) =>
				x === 'image' ? 'image' : 'text',
			);
		} else if (Array.isArray((s as any).tweetTopAvatarImageBySlide)) {
			tweetTopAvatarModeBySlide = tweetTopAvatarImageBySlide.map((u) =>
				String(u ?? '').trim() ? 'image' : 'text',
			);
		}
		if (Array.isArray((s as any).tweetTopAvatarInnerBgBySlide)) {
			tweetTopAvatarInnerBgBySlide = (s as any).tweetTopAvatarInnerBgBySlide.map((x: unknown) => String(x ?? ''));
		}
		if (Array.isArray((s as any).tweetTopAvatarLabelBySlide)) {
			tweetTopAvatarLabelBySlide = (s as any).tweetTopAvatarLabelBySlide.map((x: unknown) => String(x ?? ''));
		}
		if (Array.isArray((s as any).tweetTopAvatarRingColorBySlide)) {
			tweetTopAvatarRingColorBySlide = (s as any).tweetTopAvatarRingColorBySlide.map((x: unknown) => String(x ?? '#c9b97a'));
		}
		if (Array.isArray((s as any).tweetTopAvatarRingWidthBySlide)) {
			tweetTopAvatarRingWidthBySlide = (s as any).tweetTopAvatarRingWidthBySlide.map((x: unknown) => Number(x) || 4);
		}
		if (Array.isArray((s as any).tweetBottomAvatarImageBySlide)) {
			tweetBottomAvatarImageBySlide = (s as any).tweetBottomAvatarImageBySlide.map((x: unknown) => String(x ?? ''));
		}
		if (Array.isArray((s as any).tweetBottomAvatarModeBySlide)) {
			tweetBottomAvatarModeBySlide = (s as any).tweetBottomAvatarModeBySlide.map((x: unknown) =>
				x === 'image' ? 'image' : 'text',
			);
		} else if (Array.isArray((s as any).tweetBottomAvatarImageBySlide)) {
			tweetBottomAvatarModeBySlide = tweetBottomAvatarImageBySlide.map((u) =>
				String(u ?? '').trim() ? 'image' : 'text',
			);
		}
		if (Array.isArray((s as any).tweetBottomAvatarInnerBgBySlide)) {
			tweetBottomAvatarInnerBgBySlide = (s as any).tweetBottomAvatarInnerBgBySlide.map((x: unknown) => String(x ?? ''));
		}
		if (Array.isArray((s as any).tweetBottomAvatarLabelBySlide)) {
			tweetBottomAvatarLabelBySlide = (s as any).tweetBottomAvatarLabelBySlide.map((x: unknown) => String(x ?? ''));
		}
		if (Array.isArray((s as any).tweetBottomAvatarRingColorBySlide)) {
			tweetBottomAvatarRingColorBySlide = (s as any).tweetBottomAvatarRingColorBySlide.map((x: unknown) => String(x ?? '#c9b97a'));
		}
		if (Array.isArray((s as any).tweetBottomAvatarRingWidthBySlide)) {
			tweetBottomAvatarRingWidthBySlide = (s as any).tweetBottomAvatarRingWidthBySlide.map((x: unknown) => Number(x) || 4);
		}
		if (Array.isArray(s.articleTextBySlide)) articleTextBySlide = s.articleTextBySlide;
		if (Array.isArray((s as any).newsSubtextBySlide)) {
			newsSubtextBySlide = (s as any).newsSubtextBySlide.map((x: unknown) =>
				stripEmDashes(String(x ?? '')),
			);
		}
		if (Array.isArray(s.textCarouselTextBySlide)) {
			textCarouselTextBySlide = s.textCarouselTextBySlide.map((x: unknown) => {
				const raw = String(x ?? '');
				return newsCopyLength === 'default' ? ensureTextCarouselBodyMinLength(raw) : raw;
			});
		}
		if (Array.isArray((s as any).videoStoryHeadlineBySlide)) {
			videoStoryHeadlineBySlide = (s as any).videoStoryHeadlineBySlide.map((x: unknown) => String(x ?? ''));
		}
		if (Array.isArray((s as any).videoStoryWatermarkBySlide)) {
			videoStoryWatermarkBySlide = (s as any).videoStoryWatermarkBySlide.map((x: unknown) => String(x ?? ''));
		}
		if (Array.isArray((s as any).brandStackBrandBySlide)) {
			brandStackBrandBySlide = (s as any).brandStackBrandBySlide.map((x: unknown) => String(x ?? ''));
		}
		if (Array.isArray((s as any).brandStackBottomMediaBySlide)) {
			brandStackBottomMediaBySlide = (s as any).brandStackBottomMediaBySlide.map((x: unknown) =>
				String(x ?? ''),
			);
		}
		if (Array.isArray((s as any).blackTextHeadlineBySlide)) {
			blackTextHeadlineBySlide = (s as any).blackTextHeadlineBySlide.map((x: unknown) => String(x ?? ''));
		}
		if (Array.isArray((s as any).blackTextBodyBySlide)) {
			blackTextBodyBySlide = (s as any).blackTextBodyBySlide.map((x: unknown) => String(x ?? ''));
		}
		if (Array.isArray(s.imageQuoteTextBySlide)) imageQuoteTextBySlide = s.imageQuoteTextBySlide;
		if (Array.isArray(s.textCarouselNameBySlide)) textCarouselNameBySlide = s.textCarouselNameBySlide;
		if (Array.isArray(s.textCarouselHandleBySlide)) textCarouselHandleBySlide = s.textCarouselHandleBySlide;
		if (Array.isArray((s as any).textCarouselAvatarImageBySlide)) {
			textCarouselAvatarImageBySlide = (s as any).textCarouselAvatarImageBySlide.map((x: unknown) => String(x ?? ''));
		}
		if (Array.isArray((s as any).textCarouselAvatarModeBySlide)) {
			textCarouselAvatarModeBySlide = (s as any).textCarouselAvatarModeBySlide.map((x: unknown) =>
				x === 'image' ? 'image' : 'text',
			);
		} else if (Array.isArray((s as any).textCarouselAvatarImageBySlide)) {
			textCarouselAvatarModeBySlide = textCarouselAvatarImageBySlide.map((u) =>
				String(u ?? '').trim() ? 'image' : 'text',
			);
		}
		if (Array.isArray((s as any).textCarouselAvatarInnerBgBySlide)) {
			textCarouselAvatarInnerBgBySlide = (s as any).textCarouselAvatarInnerBgBySlide.map((x: unknown) => String(x ?? ''));
		}
		if (Array.isArray((s as any).textCarouselAvatarLabelBySlide)) {
			textCarouselAvatarLabelBySlide = (s as any).textCarouselAvatarLabelBySlide.map((x: unknown) => String(x ?? ''));
		}
		if (Array.isArray((s as any).textCarouselAvatarRingColorBySlide)) {
			textCarouselAvatarRingColorBySlide = (s as any).textCarouselAvatarRingColorBySlide.map((x: unknown) => String(x ?? '#c9b97a'));
		}
		if (Array.isArray((s as any).textCarouselAvatarRingWidthBySlide)) {
			textCarouselAvatarRingWidthBySlide = (s as any).textCarouselAvatarRingWidthBySlide.map((x: unknown) => Number(x) || 5);
		}
		if (Array.isArray(s.imageQuoteFooterLeftBySlide)) imageQuoteFooterLeftBySlide = s.imageQuoteFooterLeftBySlide;
		if (Array.isArray(s.imageQuoteFooterRightBySlide)) imageQuoteFooterRightBySlide = s.imageQuoteFooterRightBySlide;
		{
			const nSlides = Array.isArray(s.slides) ? s.slides.length : slides.length;
			const rawTop = (s as any).filmStripTopPctByTemplate;
			const rawBottom = (s as any).filmStripBottomPctByTemplate;
			if (rawTop && typeof rawTop === 'object') {
				const next = { ...filmStripTopPctByTemplate };
				for (const id of FILM_STRIP_TEMPLATE_IDS) {
					const row = Array.isArray(rawTop[id]) ? rawTop[id].map((x: unknown) => Number(x) || 0) : null;
					next[id] = Array.from(
						{ length: nSlides },
						(_, i) => row?.[i] ?? filmStripDefaultsFor(id).topPct,
					);
				}
				filmStripTopPctByTemplate = next;
			}
			if (rawBottom && typeof rawBottom === 'object') {
				const next = { ...filmStripBottomPctByTemplate };
				for (const id of FILM_STRIP_TEMPLATE_IDS) {
					const row = Array.isArray(rawBottom[id]) ? rawBottom[id].map((x: unknown) => Number(x) || 0) : null;
					next[id] = Array.from(
						{ length: nSlides },
						(_, i) => row?.[i] ?? filmStripDefaultsFor(id).bottomPct,
					);
				}
				filmStripBottomPctByTemplate = next;
			}
		}
		if (Array.isArray(s.articleSwipeTextBySlide)) articleSwipeTextBySlide = s.articleSwipeTextBySlide;
		if (Array.isArray((s as any).articleLogoSrcBySlide)) {
			articleLogoSrcBySlide = (s as any).articleLogoSrcBySlide.map((x: unknown) => String(x ?? ''));
		}
		if (Array.isArray(s.slideIds)) slideIds = s.slideIds;
		if (Array.isArray(s.subjectCutouts)) subjectCutouts = s.subjectCutouts;
		if (Array.isArray(s.showCutout)) showCutout = s.showCutout;
		if (Array.isArray(s.slideMusic)) slideMusic = s.slideMusic;
		if (Array.isArray(s.videoTrimStartSecBySlide)) videoTrimStartSecBySlide = s.videoTrimStartSecBySlide;
		if (Array.isArray(s.videoTrimEndSecBySlide)) videoTrimEndSecBySlide = s.videoTrimEndSecBySlide;
		if (Array.isArray(s.videoDurationBySlide)) videoDurationBySlide = s.videoDurationBySlide;
		if (Array.isArray(s.videoMutedBySlide)) videoMutedBySlide = s.videoMutedBySlide;
		if (Array.isArray(s.videoVolumeBySlide)) videoVolumeBySlide = s.videoVolumeBySlide;
		if (Array.isArray((s as any).videoSplitCompositedBySlide)) {
			videoSplitCompositedBySlide = (s as any).videoSplitCompositedBySlide.map((x: unknown) => !!x);
		}
		if (Array.isArray(s.textOffsetsBySlide)) textOffsetsBySlide = s.textOffsetsBySlide;

		{
			const nSlides = Array.isArray(s.slides) ? s.slides.length : slides.length;
			if (Array.isArray((s as any).showCircleBySlide)) {
				const a = (s as any).showCircleBySlide.map((x: unknown) => !!x);
				showCircleBySlide = Array.from({ length: nSlides }, (_, i) => a[i] ?? false);
			} else if (typeof s.showCircle === 'boolean') {
				const legacy = s.showCircle;
				const imgs = Array.isArray(s.circleImages)
					? s.circleImages.map((x: unknown) => String(x ?? '').trim())
					: [];
				showCircleBySlide = Array.from({ length: nSlides }, (_, i) => legacy && (i === 0 || imgs[i] !== ''));
			}
		}
		// Back-compat: older drafts stored a single circleImage; newer ones store per-slide arrays.
		if (Array.isArray(s.circleImages)) circleImages = s.circleImages;
		else if (typeof s.circleImage === 'string') {
			const first = s.circleImage;
			const n = Array.isArray(s.slides) ? s.slides.length : slides.length;
			circleImages = Array.from({ length: n }, (_, i) => (i === 0 ? first : ''));
		}
		if (typeof s.circleBorderColor === 'string') circleBorderColor = s.circleBorderColor;
		if (s.circleShadow) circleShadow = normalizeCircleShadow(s.circleShadow);
		if (Array.isArray(s.circle2Images)) circle2Images = s.circle2Images;
		else if (typeof s.circle2Image === 'string') {
			const first = s.circle2Image;
			const n = Array.isArray(s.slides) ? s.slides.length : slides.length;
			circle2Images = Array.from({ length: n }, (_, i) => (i === 0 ? first : ''));
		}
		if (Array.isArray(s.showCircle2BySlide)) showCircle2BySlide = s.showCircle2BySlide;
		else if (typeof s.showCircle2 === 'boolean') {
			const n = Array.isArray(s.slides) ? s.slides.length : slides.length;
			showCircle2BySlide = Array.from({ length: n }, (_, i) => (i === 0 ? s.showCircle2 : false));
		}
		if (typeof s.circle2BorderColor === 'string') circle2BorderColor = s.circle2BorderColor;
		if (s.circle2Shadow) circle2Shadow = normalizeCircleShadow(s.circle2Shadow);
		if (typeof s.circleX === 'number') circleX = s.circleX;
		if (typeof s.circleY === 'number') circleY = s.circleY;
		if (typeof s.circleSize === 'number') circleSize = s.circleSize;
		if (typeof s.circle2X === 'number') circle2X = s.circle2X;
		if (typeof s.circle2Y === 'number') circle2Y = s.circle2Y;
		if (typeof s.circle2Size === 'number') circle2Size = s.circle2Size;
		if (typeof s.bgOffsetX === 'number') bgOffsetX = s.bgOffsetX;
		if (typeof s.bgOffsetY === 'number') bgOffsetY = s.bgOffsetY;
		if (typeof s.bgZoom === 'number') bgZoom = s.bgZoom;
		if (s.bgFitMode === 'cover' || s.bgFitMode === 'contain') bgFitMode = s.bgFitMode;
		if (typeof s.bgContainMagnify === 'number') bgContainMagnify = s.bgContainMagnify;
		if (typeof s.textPanelOffsetY === 'number') textPanelOffsetY = s.textPanelOffsetY;
		{
			const nSlides = Math.max(1, slides.length);
			padShadowBySlide(nSlides);
			if (Array.isArray((s as any).shadowHeightBySlide)) {
				const raw = (s as any).shadowHeightBySlide as unknown[];
				shadowHeightBySlide = Array.from({ length: nSlides }, (_, i) => {
					const v = Number(raw[i]);
					return Number.isFinite(v) ? v : NEWS_DEFAULT_LAYOUT.shadowHeight;
				});
			} else if (typeof s.shadowHeight === 'number') {
				shadowHeightBySlide = Array.from({ length: nSlides }, () => s.shadowHeight as number);
			}
			if (Array.isArray((s as any).shadowStrengthBySlide)) {
				const raw = (s as any).shadowStrengthBySlide as unknown[];
				shadowStrengthBySlide = Array.from({ length: nSlides }, (_, i) => {
					const v = Number(raw[i]);
					return Number.isFinite(v) ? v : NEWS_DEFAULT_LAYOUT.shadowStrength;
				});
			} else if (typeof s.shadowStrength === 'number') {
				shadowStrengthBySlide = Array.from({ length: nSlides }, () => s.shadowStrength as number);
			}
			if (Array.isArray((s as any).shadowCurveBySlide)) {
				const raw = (s as any).shadowCurveBySlide as unknown[];
				shadowCurveBySlide = Array.from({ length: nSlides }, (_, i) =>
					normalizeBottomShadowCurve(raw[i]),
				);
			} else if (typeof (s as any).shadowCurve === 'string') {
				const c = normalizeBottomShadowCurve((s as any).shadowCurve);
				shadowCurveBySlide = Array.from({ length: nSlides }, () => c);
			}
			if (Array.isArray((s as any).shadowColorBySlide)) {
				const raw = (s as any).shadowColorBySlide as unknown[];
				shadowColorBySlide = Array.from({ length: nSlides }, (_, i) =>
					normalizeBottomShadowColor(raw[i] ?? NEWS_DEFAULT_LAYOUT.shadowColor),
				);
			} else if (typeof (s as any).shadowColor === 'string') {
				const col = normalizeBottomShadowColor((s as any).shadowColor);
				shadowColorBySlide = Array.from({ length: nSlides }, () => col);
			}
			if (Array.isArray((s as any).shadowAutoFitBySlide)) {
				const raw = (s as any).shadowAutoFitBySlide as unknown[];
				shadowAutoFitBySlide = Array.from({ length: nSlides }, (_, i) =>
					typeof raw[i] === 'boolean' ? (raw[i] as boolean) : true,
				);
			} else if (typeof (s as any).shadowAutoFit === 'boolean') {
				const a = !!(s as any).shadowAutoFit;
				shadowAutoFitBySlide = Array.from({ length: nSlides }, () => a);
			}
			shadowPaintSlideSync = -1;
			shadowHeight = shadowHeightAt(activeSlide);
			shadowStrength = shadowStrengthAt(activeSlide);
			shadowCurve = shadowCurveAt(activeSlide);
			shadowColor = shadowColorAt(activeSlide);
			shadowAutoFit = shadowAutoFitAt(activeSlide);
		}
		{
			const bySlide = Array.isArray((s as any).newsLayoutBySlide)
				? ((s as any).newsLayoutBySlide as unknown[])
				: null;
			if (bySlide?.length) {
				for (let i = 0; i < bySlide.length; i++) {
					const doc = parseNewsLayoutDocument(bySlide[i]);
					if (!doc) continue;
					applyNewsLayoutDocumentToStudio(doc, { slides: [i], overlays: true });
				}
			} else {
				const single = parseNewsLayoutDocument((s as any).newsLayoutDocument);
				if (single) applyNewsLayoutDocumentToStudio(single, { slides: 'all', overlays: true });
			}
		}
		if (typeof s.highlightColor === 'string') highlightColor = s.highlightColor;
		if (s.highlightStyleKind === 'solid' || s.highlightStyleKind === 'gradient' || s.highlightStyleKind === 'pattern') {
			highlightStyleKind = s.highlightStyleKind;
		}
		if (typeof s.highlightGradientFrom === 'string' && s.highlightGradientFrom.trim()) {
			highlightGradientFrom = s.highlightGradientFrom.trim();
		}
		if (typeof s.highlightGradientTo === 'string' && s.highlightGradientTo.trim()) {
			highlightGradientTo = s.highlightGradientTo.trim();
		}
		if (typeof s.highlightPattern === 'string' && s.highlightPattern.trim()) {
			highlightPattern = s.highlightPattern.trim().toLowerCase().replace(/\s+/g, '-');
		}
		// textHighlightsEnabled lives on the brand kit (Settings), not per-draft.
		if (typeof s.textColor === 'string') textColor = s.textColor;
		if (typeof s.canvasBgDark === 'boolean') {
			canvasBgDark = s.canvasBgDark;
		} else {
			// Older saves omitted the toggle — infer from solid fill or letterbox templates.
			const solid = String(
				(Array.isArray(s.newsSolidBgBySlide) ? s.newsSolidBgBySlide[s.activeSlide ?? 0] : '') ??
					(Array.isArray(newsSolidBgBySlide) ? newsSolidBgBySlide[activeSlide] : '') ??
					'',
			)
				.trim()
				.toLowerCase();
			if (solid === '#000000' || solid === '#000' || solid === '#0a0a0a') {
				canvasBgDark = true;
			} else if (solid === '#ffffff' || solid === '#fff' || solid === '#f8fafc') {
				canvasBgDark = false;
			} else {
				const templates = Array.isArray(s.slideTemplates)
					? (s.slideTemplates as unknown[]).map((t) => coerceTemplateId(t))
					: slideTemplates;
				if (
					templates.some(
						(t) => isVideoStoryFamily(t) || t === 'news' || t === 'blackText' || isPhotoStoryFamily(t),
					)
				) {
					canvasBgDark = true;
				}
			}
		}
		scrubStaleDemoPostersAgainstRealVideos();
		// Intentionally do NOT restore `exportedSlides` (huge data URLs) from drafts.

		// Empty News copy (common in partial saves) reads as a "broken" blank canvas / empty filmstrip.
		if (
			!forcedBlankFromQuery &&
			slides.length > 0 &&
			coerceTemplateId(slideTemplates[0]) === 'news' &&
			slides.some((row, i) => coerceTemplateId(slideTemplates[i] ?? 'news') === 'news' && !String(row ?? '').trim())
		) {
			const n = slides.length;
			const starterHeadlines = fallbackStoryBeats(
				NEWS_PLACEHOLDER_HEADLINE,
				NEWS_DEFAULT_SUBTEXT,
				n,
			);
			slides = slides.map((row, i) =>
				coerceTemplateId(slideTemplates[i] ?? 'news') === 'news' && !String(row ?? '').trim()
					? (starterHeadlines[i] ?? NEWS_PLACEHOLDER_HEADLINE)
					: row,
			);
			const starterSubs = distributeNewsSubtextAcrossSlides(
				NEWS_DEFAULT_SUBTEXT,
				slides,
				n,
			);
			newsSubtextBySlide = Array.from({ length: n }, (_, i) => {
				const cur = String(newsSubtextBySlide[i] ?? '').trim();
				if (cur) return cur;
				if (coerceTemplateId(slideTemplates[i] ?? 'news') !== 'news') return cur;
				return starterSubs[i] ?? NEWS_DEFAULT_SUBTEXT;
			});
		}

		// Generating flags are ephemeral UI state — never restore from drafts.
		generatingImagesByTemplate = (Object.fromEntries(
			(Object.keys(generatingImagesByTemplate) as TemplateId[]).map((k) => [
				k,
				new Array(slides.length).fill(false),
			]),
		) as unknown) as Record<TemplateId, boolean[]>;

		if (typeof (s as any).brandCtaEnabled === 'boolean') {
			/* Follow-slide chrome removed from Studio UI — keep decks content-only. */
			brandCtaEnabled = false;
			editingBrandCta = false;
		}

		if (brandDisplayName || brandHandle) {
			applyBrandProfileToSlides(
				brandDisplayName || DEFAULT_BRAND_KIT.displayName,
				brandHandle || DEFAULT_BRAND_KIT.handle,
			);
		}
	}

	function defaultNewsSource(): string {
		return String(brandDisplayName ?? '').trim() || NEWS_DEFAULT_SOURCE;
	}

	/** Prefer last byline the user set — never swap in category tags like “General” on generate. */
	function resolveNewsSourceAfterFetch(): string {
		const brand = String(brandDisplayName ?? '').trim();
		const cur = String(source ?? '').trim();
		if (cur && !isPlaceholderNewsSource(cur)) return cur;
		if (brand) return brand;
		return NEWS_DEFAULT_SOURCE;
	}

	function applyNewsSourceFromBrand(name: string, force = false) {
		const next = String(name ?? '').trim();
		if (!next) return;
		if (force || isPlaceholderNewsSource(source)) source = next;
	}

	/** Brand avatar (or logo fallback) → Text Carousel / white-post / video-post avatar disc. */
	function applyBrandLogoToProfileAvatars(logoRaw: string, force = false) {
		const logo = String(logoRaw ?? '').trim();
		if (!logo) return;
		const n = slides.length;
		const next = Array.from({ length: n }, (_, i) => {
			const cur = String(textCarouselAvatarImageBySlide[i] ?? '').trim();
			if (force || !cur) return logo;
			return cur;
		});
		const changed = next.some((v, i) => v !== (textCarouselAvatarImageBySlide[i] ?? ''));
		if (changed) {
			textCarouselAvatarImageBySlide = next;
			textCarouselAvatarModeBySlide = Array.from({ length: n }, (_, i) =>
				String(next[i] ?? '').trim() ? 'image' : (textCarouselAvatarModeBySlide[i] ?? 'text'),
			);
		}

		const nextTweet = Array.from({ length: n }, (_, i) => {
			const cur = String(tweetTopAvatarImageBySlide[i] ?? '').trim();
			if (force || !cur) return logo;
			return cur;
		});
		const tweetChanged = nextTweet.some((v, i) => v !== (tweetTopAvatarImageBySlide[i] ?? ''));
		if (tweetChanged) {
			tweetTopAvatarImageBySlide = nextTweet;
			tweetTopAvatarModeBySlide = Array.from({ length: n }, (_, i) =>
				String(nextTweet[i] ?? '').trim() ? 'image' : (tweetTopAvatarModeBySlide[i] ?? 'text'),
			);
		}
	}

	/** Push News logo chrome onto every slide from brand kit values. */
	function applyNewsSourceOffsetsFromBrand(ox?: number, oy?: number) {
		const x = Number.isFinite(ox) ? Math.round(ox!) : 0;
		const y = Number.isFinite(oy) ? Math.round(oy!) : 0;
		const key = offsetKey('news', 'source');
		const n = Math.max(1, slides.length);
		textOffsetsBySlide = Array.from({ length: n }, (_, i) => {
			const row = { ...(textOffsetsBySlide[i] ?? {}) };
			row[key] = { x, y };
			return row;
		});
	}

	function applyNewsSourceChromeFromKit(
		kit: {
			displayName?: string;
			logoUrl?: string;
			avatarUrl?: string;
			sourceLabelMode?: 'text' | 'logo';
			sourceLogoWidth?: number;
			sourceLogoPlateColor?: string;
			sourceBorderKind?: 'none' | 'rules' | 'box';
			sourceBorderColor?: string;
			sourceOffsetX?: number;
			sourceOffsetY?: number;
			textBgColor?: string;
		},
		opts?: { preserveOffsets?: boolean; preserveWidth?: boolean; preservePlate?: boolean },
	) {
		const name = String(kit.displayName ?? brandDisplayName ?? '').trim();
		if (name && (isPlaceholderNewsSource(source) || !String(source ?? '').trim())) {
			source = name;
		}
		if (kit.sourceLabelMode === 'logo' || kit.sourceLabelMode === 'text') {
			/* Default News should not auto-inherit the generic brand/profile logo. */
			sourceLabelMode = kit.sourceLabelMode;
		}
		const avatar = String(kit.avatarUrl ?? '').trim() || String(kit.logoUrl ?? '').trim();
		if (avatar) {
			applyBrandLogoToProfileAvatars(avatar, false);
			void ensureR2Resolved(avatar);
		}
		if (!opts?.preserveWidth) {
			const w = Number(kit.sourceLogoWidth);
			if (Number.isFinite(w) && w > 0) sourceLogoWidth = Math.round(Math.max(80, Math.min(400, w)));
		}
		if (!opts?.preservePlate && typeof kit.sourceLogoPlateColor === 'string') {
			sourceLogoPlateColor = String(kit.sourceLogoPlateColor ?? '').trim();
		}
		if (kit.sourceBorderKind === 'none' || kit.sourceBorderKind === 'rules' || kit.sourceBorderKind === 'box') {
			sourceBorderKind = kit.sourceBorderKind;
		}
		if (typeof kit.sourceBorderColor === 'string') sourceBorderColor = kit.sourceBorderColor;
		if (!opts?.preserveOffsets) {
			const ox = Number(kit.sourceOffsetX);
			const oy = Number(kit.sourceOffsetY);
			if (Number.isFinite(ox) || Number.isFinite(oy)) {
				applyNewsSourceOffsetsFromBrand(Number.isFinite(ox) ? ox : 0, Number.isFinite(oy) ? oy : 0);
			}
		}
		const bg = normalizeTextBgHex(String(kit.textBgColor ?? ''));
		/* Text-chip BG must not plate the logo — only apply in text byline mode. */
		if (bg && sourceLabelMode !== 'logo') patchNewsSourceStyle({ bgColor: bg });
	}

	function persistNewsSourceChrome(extra?: Partial<{
		sourceLabelMode: 'text' | 'logo';
		sourceLogoSrc: string;
		sourceLogoWidth: number;
		sourceLogoPlateColor: string;
		sourceBorderKind: 'none' | 'rules' | 'box';
		sourceBorderColor: string;
		sourceOffsetX: number;
		sourceOffsetY: number;
		displayName: string;
	}>) {
		if (!userId) return;
		try {
			const kit = loadBrandKit(userId);
			const mode = extra?.sourceLabelMode ?? sourceLabelMode;
			const logo =
				extra && Object.prototype.hasOwnProperty.call(extra, 'sourceLogoSrc')
					? String(extra.sourceLogoSrc ?? '').trim()
					: String(sourceLogoSrc ?? '').trim();
			const off = getTextOffset(activeSlide, offsetKey('news', 'source'));
			/* Text-chip lives on canvas source style in text mode only — never sync from logo plate. */
			if (sourceLabelMode !== 'logo') {
				const canvasBg = normalizeTextBgHex(String(canvasSourceStyle?.bgColor ?? ''));
				if (canvasBg) brandTextBgColor = canvasBg;
			}
			const plate =
				extra && Object.prototype.hasOwnProperty.call(extra, 'sourceLogoPlateColor')
					? String(extra.sourceLogoPlateColor ?? '').trim()
					: String(sourceLogoPlateColor ?? '').trim();
			saveBrandKit(userId, {
				...kit,
				displayName: String(extra?.displayName ?? brandDisplayName ?? kit.displayName).trim() || kit.displayName,
				logoUrl: logo,
				sourceLabelMode: mode,
				sourceLogoWidth: extra?.sourceLogoWidth ?? sourceLogoWidth,
				sourceLogoPlateColor: plate,
				sourceBorderKind: extra?.sourceBorderKind ?? sourceBorderKind,
				sourceBorderColor: extra?.sourceBorderColor ?? sourceBorderColor,
				sourceOffsetX: extra?.sourceOffsetX ?? off.x,
				sourceOffsetY: extra?.sourceOffsetY ?? off.y,
				textBgColor: brandTextBgColor,
			});
		} catch {
			/* ignore */
		}
	}

	/**
	 * Soft: only replace demo placeholders (draft restore / kit hydrate).
	 * Force: Branding panel is source of truth — overwrite canvas name/handle.
	 */
	function applyBrandProfileToSlides(name: string, handle: string, opts?: { force?: boolean }) {
		const force = !!opts?.force;
		const nextName = String(name ?? '').trim();
		const nextHandle = normalizeBrandHandle(String(handle ?? ''));
		const n = slides.length;
		if (nextName) {
			const nextLabels = Array.from({ length: n }, (_, i) => textCarouselAvatarLabelBySlide[i] ?? '');
			const nextNames = Array.from({ length: n }, (_, i) => {
				const cur = textCarouselNameBySlide[i] ?? '';
				const replace = force || isPlaceholderProfileName(cur);
				if (replace && force && cur.trim().toLowerCase() !== nextName.toLowerCase()) {
					nextLabels[i] = '';
				}
				return replace ? nextName : cur;
			});
			const namesChanged = nextNames.some((v, i) => v !== (textCarouselNameBySlide[i] ?? ''));
			if (namesChanged) textCarouselNameBySlide = nextNames;
			if (force) {
				const labelsChanged = nextLabels.some((v, i) => v !== (textCarouselAvatarLabelBySlide[i] ?? ''));
				if (labelsChanged) textCarouselAvatarLabelBySlide = nextLabels;
			}
		}
		if (nextHandle) {
			const nextHandles = Array.from({ length: n }, (_, i) => {
				const cur = textCarouselHandleBySlide[i] ?? '';
				return force || isPlaceholderProfileHandle(cur) ? nextHandle : cur;
			});
			const handlesChanged = nextHandles.some((v, i) => v !== (textCarouselHandleBySlide[i] ?? ''));
			if (handlesChanged) textCarouselHandleBySlide = nextHandles;
		}
		applyNewsSourceFromBrand(nextName, force);
		if (force) {
			const logo = String(sourceLogoSrc ?? '').trim();
			if (logo) applyBrandLogoToProfileAvatars(logo, true);
		}
	}

	function persistBrandProfile(nextName?: string, nextHandle?: string) {
		const name = String(nextName ?? brandDisplayName).trim();
		const handle = normalizeBrandHandle(String(nextHandle ?? brandHandle));
		if (name) brandDisplayName = name;
		if (handle) brandHandle = handle;
		applyBrandProfileToSlides(brandDisplayName, brandHandle, { force: true });
		if (!userId || !brandDisplayName.trim()) return;
		try {
			const kit = loadBrandKit(userId);
			saveBrandKit(userId, {
				...kit,
				displayName: brandDisplayName,
				handle: brandHandle,
				highlightColor,
				highlightStyleKind,
				highlightPattern,
				highlightGradientFrom,
				highlightGradientTo,
				textBgColor: brandTextBgColor,
				onboardingComplete: true,
			});
		} catch {
			/* ignore */
		}
	}

	function persistBrandHighlight(nextRaw: string) {
		highlightColor = normalizeHighlightHex(nextRaw, highlightColor);
		highlightStyleKind = 'solid';
		studioTextHighlightsEnabled = true;
		if (!userId) return;
		try {
			const kit = loadBrandKit(userId);
			saveBrandKit(userId, {
				...kit,
				highlightColor,
				highlightStyleKind: 'solid',
				textHighlightsEnabled: true,
			});
		} catch {
			/* ignore */
		}
	}

	function persistBrandHighlightPattern(name: string) {
		const next = String(name ?? '').trim().toLowerCase().replace(/\s+/g, '-');
		if (!AVAILABLE_PATTERNS.some((p) => p.name === next)) return;
		highlightPattern = next;
		highlightStyleKind = 'pattern';
		studioTextHighlightsEnabled = true;
		if (!userId) return;
		try {
			const kit = loadBrandKit(userId);
			saveBrandKit(userId, {
				...kit,
				highlightPattern: next,
				highlightStyleKind: 'pattern',
				textHighlightsEnabled: true,
			});
		} catch {
			/* ignore */
		}
	}

	function persistBrandHighlightGradient(from: string, to: string) {
		const a = normalizeHighlightHex(from, highlightGradientFrom);
		const b = normalizeHighlightHex(to, highlightGradientTo);
		highlightGradientFrom = a;
		highlightGradientTo = b;
		highlightStyleKind = 'gradient';
		studioTextHighlightsEnabled = true;
		if (!userId) return;
		try {
			const kit = loadBrandKit(userId);
			saveBrandKit(userId, {
				...kit,
				highlightColor: a,
				highlightStyleKind: 'gradient',
				highlightGradientFrom: a,
				highlightGradientTo: b,
				textHighlightsEnabled: true,
			});
		} catch {
			/* ignore */
		}
	}

	function persistBrandHighlightsEnabled(on: boolean) {
		studioTextHighlightsEnabled = on;
		if (!userId) return;
		try {
			const kit = loadBrandKit(userId);
			saveBrandKit(userId, { ...kit, textHighlightsEnabled: on });
		} catch {
			/* ignore */
		}
	}

	/** Keep Branding panel + Settings highlight in sync when the text toolbar paints. */
	function syncBrandHighlightFromToolbar(spec: HighlightSpec) {
		if (spec.kind === 'color') persistBrandHighlight(spec.color);
		else if (spec.kind === 'pattern') persistBrandHighlightPattern(spec.name);
		else if (spec.kind === 'gradient') persistBrandHighlightGradient(spec.from, spec.to);
	}

	function persistBrandCta() {
		if (!userId) return;
		if (saveBrandCta(userId, brandCta)) {
			try {
				const kit = loadBrandKit(userId);
				kit.cta = { ...brandCta };
				saveBrandKit(userId, kit);
			} catch {
				/* ignore */
			}
			brandCtaSavedNote = 'Saved to your brand';
			setTimeout(() => {
				brandCtaSavedNote = '';
			}, 2200);
		}
	}

	function selectBrandCtaSlide() {
		/* Follow-slide editor removed from the filmstrip UI. */
		editingBrandCta = false;
		brandCtaEnabled = false;
	}

	function selectContentSlide(i: number) {
		editingBrandCta = false;
		brandCtaEnabled = false;
		addSlideMenuOpen = false;
		addSlideMenuPos = null;
		activeSlide = i;
	}

	async function handleBrandCtaImageUpload(e: Event) {
		const file = (e.target as HTMLInputElement).files?.[0];
		if (!file) return;
		(e.target as HTMLInputElement).value = '';
		try {
			const dataUrl = await prepareImageAsDataUrl(file, {
				maxDim: 1600,
				maxBytes: 1_800_000,
				quality: 0.85,
			});
			brandCta = { ...brandCta, image: dataUrl };
			persistBrandCta();
		} catch (err) {
			alert(err instanceof Error ? err.message : 'Image upload failed');
		}
	}

	function clearBrandCtaImage() {
		brandCta = { ...brandCta, image: '' };
		persistBrandCta();
	}

	function applyBlankCanvas() {
		lastTemplateUsed = 'blank';
		applyTemplateToAll('blank');
		slideTemplates = ['blank'];
		slides = [''];
		activeSlide = 0;
		source = '';
		articleUrl = '';
		articleTitle = '';
		articleSnippet = '';

		const emptyMediaUrls = (): Record<TemplateId, string[]> => ({
			blank: [''],
			news: [''],
			tweet: [''],
			article: [''],
			textCarousel: [''],
			imageQuote: [''],
			videoStory: [''],
			videoFit: [''],
			videoSplit: [''],
			videoBlur: [''],
			videoHook: [''],
			videoCreator: [''],
			videoText: [''],
			videoSource: [''],
			videoFeature: [''],
			videoPost: [''],
			brandStack: [''],
			blackText: [''],
			photoTopic: [''],
			photoCaption: [''],
			whiteThread: [''],
			whiteMedia: [''],
		});
		bgImagesByTemplate = {
			...emptyMediaUrls(),
			blackText: [BLACK_TEXT_BG_DEFAULT],
			photoTopic: [PHOTO_TOPIC_DEFAULTS.imageUrl],
			photoCaption: [PHOTO_CAPTION_DEFAULTS.imageUrl],
			whiteThread: [''],
			whiteMedia: [WHITE_MEDIA_DEFAULTS.imageUrl],
			imageQuote: [IMAGE_QUOTE_DEFAULTS.imageUrl],
			news: [''],
			tweet: [TWEET_DEFAULTS.topImage],
		};
		bgVideosByTemplate = {
			...emptyMediaUrls(),
			news: [NEWS_DEMO_VIDEO],
			videoStory: [VIDEO_STORY_DEFAULTS.videoUrl],
			videoFit: [VIDEO_STORY_DEFAULTS.videoUrl],
			videoSplit: [VIDEO_SPLIT_DEFAULTS.videoUrl],
			videoBlur: [VIDEO_STORY_DEFAULTS.videoUrl],
			videoHook: [VIDEO_HOOK_DEFAULTS.videoUrl],
			videoCreator: [VIDEO_CREATOR_DEFAULTS.videoUrl],
			videoText: [VIDEO_TEXT_DEFAULTS.videoUrl],
			videoSource: [VIDEO_SOURCE_DEFAULTS.videoUrl],
			videoFeature: [VIDEO_FEATURE_DEFAULTS.videoUrl],
			videoPost: [VIDEO_POST_DEFAULTS.videoUrl],
			brandStack: [BRAND_STACK_DEFAULTS.topVideoUrl],
		};
		generatingImagesByTemplate = {
			blank: [false],
			news: [false],
			tweet: [false],
			article: [false],
			textCarousel: [false],
			imageQuote: [false],
			videoStory: [false],
			videoFit: [false],
			videoSplit: [false],
			videoBlur: [false],
			videoHook: [false],
			videoCreator: [false],
			videoText: [false],
			videoSource: [false],
			videoFeature: [false],
			videoPost: [false],
			brandStack: [false],
			blackText: [false],
			photoTopic: [false],
			photoCaption: [false],
			whiteThread: [false],
			whiteMedia: [false],
		};
		newsSolidBgBySlide = ['#ffffff'];

		const emptySticker = (): Record<TemplateId, Overlay[][]> => ({
			blank: [[]],
			news: [[]],
			tweet: [[]],
			article: [[]],
			textCarousel: [[]],
			imageQuote: [[]],
			videoStory: [[]],
			videoFit: [[]],
			videoSplit: [[]],
			videoBlur: [[]],
			videoHook: [[]],
			videoCreator: [[]],
			videoText: [[]],
			videoSource: [[]],
			videoFeature: [[]],
			videoPost: [[]],
			brandStack: [[]],
			blackText: [[]],
			photoTopic: [[]],
			photoCaption: [[]],
			whiteThread: [[]],
			whiteMedia: [[]],
		});
		slideOverlaysByTemplate = emptySticker();
		slideTextOverlaysByTemplate = {
			blank: [[]],
			news: [[]],
			tweet: [[]],
			article: [[]],
			textCarousel: [[]],
			imageQuote: [[]],
			videoStory: [[]],
			videoFit: [[]],
			videoSplit: [[]],
			videoBlur: [[]],
			videoHook: [[]],
			videoCreator: [[]],
			videoText: [[]],
			videoSource: [[]],
			videoFeature: [[]],
			videoPost: [[]],
			brandStack: [[]],
			blackText: [[]],
			photoTopic: [[]],
			photoCaption: [[]],
			whiteThread: [[]],
			whiteMedia: [[]],
		};

		stylesByTemplateBySlide = {
			blank: [{}],
			news: [{}],
			tweet: [{}],
			article: [{}],
			textCarousel: [{}],
			imageQuote: [{}],
			videoStory: [{}],
			videoFit: [{}],
			videoSplit: [{}],
			videoBlur: [{}],
			videoHook: [{}],
			videoCreator: [{}],
			videoText: [{}],
			videoSource: [{}],
			videoFeature: [{}],
			videoPost: [{}],
			brandStack: [{}],
			blackText: [{}],
			photoTopic: [{}],
			photoCaption: [{}],
			whiteThread: [{}],
			whiteMedia: [{}],
		};
		tweetStylesBySlide = [{}];

		tweetTopNameBySlide = [''];
		tweetTopHandleBySlide = [''];
		tweetBottomNameBySlide = [''];
		tweetBottomHandleBySlide = [''];
		tweetTopTextBySlide = [''];
		tweetBottomTextBySlide = [''];
		tweetReplyCountBySlide = [''];
		tweetRepostCountBySlide = [''];
		tweetLikeCountBySlide = [''];
		tweetTopImageHeightBySlide = [720];
		tweetTopImageWidthBySlide = [920];
		tweetTopImageZoomBySlide = [1];
		tweetTopImagePanXBySlide = [50];
		tweetTopImagePanYBySlide = [50];
		tweetTopAvatarImageBySlide = [''];
		tweetTopAvatarModeBySlide = ['text'];
		tweetTopAvatarInnerBgBySlide = [''];
		tweetTopAvatarLabelBySlide = [''];
		tweetTopAvatarRingColorBySlide = ['#c9b97a'];
		tweetTopAvatarRingWidthBySlide = [4];
		tweetBottomAvatarImageBySlide = [''];
		tweetBottomAvatarModeBySlide = ['text'];
		tweetBottomAvatarInnerBgBySlide = [''];
		tweetBottomAvatarLabelBySlide = [''];
		tweetBottomAvatarRingColorBySlide = ['#c9b97a'];
		tweetBottomAvatarRingWidthBySlide = [4];
		articleTextBySlide = [''];
		newsSubtextBySlide = [''];
		articleSwipeTextBySlide = [''];
		articleLogoSrcBySlide = [''];
		textCarouselTextBySlide = [''];
		textCarouselNameBySlide = [''];
		textCarouselHandleBySlide = [''];
		textCarouselAvatarImageBySlide = [''];
		textCarouselAvatarModeBySlide = ['text'];
		textCarouselAvatarInnerBgBySlide = [''];
		textCarouselAvatarLabelBySlide = [''];
		textCarouselAvatarRingColorBySlide = ['#c9b97a'];
		textCarouselAvatarRingWidthBySlide = [5];
		imageQuoteTextBySlide = [IMAGE_QUOTE_DEFAULTS.body];
		imageQuoteFooterLeftBySlide = [IMAGE_QUOTE_DEFAULTS.footerLeft];
		imageQuoteFooterRightBySlide = [IMAGE_QUOTE_DEFAULTS.footerRight];
		filmStripTopPctByTemplate = Object.fromEntries(
			FILM_STRIP_TEMPLATE_IDS.map((id) => [id, [filmStripDefaultsFor(id).topPct]]),
		) as Record<TemplateId, number[]>;
		filmStripBottomPctByTemplate = Object.fromEntries(
			FILM_STRIP_TEMPLATE_IDS.map((id) => [id, [filmStripDefaultsFor(id).bottomPct]]),
		) as Record<TemplateId, number[]>;
		videoStoryHeadlineBySlide = [''];
		videoStoryWatermarkBySlide = [''];
		blackTextHeadlineBySlide = [''];
		blackTextBodyBySlide = [''];
		videoSplitCompositedBySlide = [false];

		textOffsetsBySlide = [{}];
		slideIds = [newSlideId()];
		showCircleBySlide = [false];
		circleImages = [''];
		circle2Images = [''];
		showCircle2BySlide = [false];
		showCutout = [false];
		subjectCutouts = [''];
		cuttingOut = [false];
		slideMusic = [null];
		exportedSlides = [];

		circleX = NEWS_DEFAULT_LAYOUT.circleX;
		circleY = NEWS_DEFAULT_LAYOUT.circleY;
		circleSize = NEWS_DEFAULT_LAYOUT.circleSize;
		circle2X = NEWS_DEFAULT_LAYOUT.circle2X;
		circle2Y = NEWS_DEFAULT_LAYOUT.circle2Y;
		circle2Size = NEWS_DEFAULT_LAYOUT.circle2Size;
		applyNewsSeedBackgroundLayout();
		textPanelOffsetY = NEWS_DEFAULT_LAYOUT.textPanelOffsetY;
		shadowHeightBySlide = [0];
		shadowStrengthBySlide = [0];
		shadowCurveBySlide = [NEWS_DEFAULT_LAYOUT.shadowCurve];
		shadowColorBySlide = [NEWS_DEFAULT_LAYOUT.shadowColor];
		shadowAutoFitBySlide = [false];
		shadowPaintSlideSync = -1;
		shadowHeight = 0;
		shadowStrength = 0;
		shadowCurve = NEWS_DEFAULT_LAYOUT.shadowCurve;
		shadowColor = NEWS_DEFAULT_LAYOUT.shadowColor;
		shadowAutoFit = false;

		historyByTemplateBySlide = {
			blank: [{ undo: [], redo: [] }],
			news: [{ undo: [], redo: [] }],
			tweet: [{ undo: [], redo: [] }],
			article: [{ undo: [], redo: [] }],
			textCarousel: [{ undo: [], redo: [] }],
			imageQuote: [{ undo: [], redo: [] }],
			videoStory: [{ undo: [], redo: [] }],
			videoFit: [{ undo: [], redo: [] }],
			videoSplit: [{ undo: [], redo: [] }],
			videoBlur: [{ undo: [], redo: [] }],
			videoHook: [{ undo: [], redo: [] }],
			videoCreator: [{ undo: [], redo: [] }],
			videoText: [{ undo: [], redo: [] }],
			videoSource: [{ undo: [], redo: [] }],
			videoFeature: [{ undo: [], redo: [] }],
			videoPost: [{ undo: [], redo: [] }],
			brandStack: [{ undo: [], redo: [] }],
			blackText: [{ undo: [], redo: [] }],
			photoTopic: [{ undo: [], redo: [] }],
			photoCaption: [{ undo: [], redo: [] }],
			whiteThread: [{ undo: [], redo: [] }],
			whiteMedia: [{ undo: [], redo: [] }],
		};

		draftId = '';
		draftError = '';
		draftPreviewUrl = '';
		draftPreviewKey = '';
		newsHeadlineLive = null;
		closeToolbar();

		// Templates / blank canvas always open with the default deck length.
		while (slides.length < DEFAULT_STUDIO_SLIDE_COUNT) {
			addSlide({ template: 'blank', copyClipFrom: null, select: false });
		}
		activeSlide = 0;
		slideCount = slides.length;
	}

	/**
	 * `applyBlankCanvas()` resets headline/solid fills, kills shadow, and hides the circle chrome —
	 * restore readable News starters (gradient, hook circle ring, vignette, SoftBank placeholder copy).
	 * Pass `{ force: true }` for `?template=news` / Templates gallery opens so demo copy always shows
	 * (also clears a stuck `newsHeadlineLive` buffer that can hide `slides[0]`).
	 */
	function seedNewsStarterPlaceholderLayout(opts?: { force?: boolean }) {
		const force = opts?.force === true;
		if (coerceTemplateId(slideTemplates[0] ?? lastTemplateUsed ?? 'news') !== 'news') return;

		/* Single product default — `slide-content-defaults` / demo posts, not pinned overrides. */
		const demoHeadline = NEWS_PLACEHOLDER_HEADLINE;
		const demoSub = NEWS_DEFAULT_SUBTEXT;

		// Avoid addSlide() here — it moves activeSlide to the newest empty card.
		lastTemplateUsed = 'news';
		const targetLen = Math.max(slides.length, DEFAULT_STUDIO_SLIDE_COUNT);
		const padStr = (arr: string[] | undefined, fill = '') =>
			Array.from({ length: targetLen }, (_, i) => arr?.[i] ?? fill);
		const padBool = (arr: boolean[] | undefined, fill = false) =>
			Array.from({ length: targetLen }, (_, i) => arr?.[i] ?? fill);

		slideTemplates = Array.from({ length: targetLen }, () => 'news');
		slideCount = targetLen;

		/* Every filmstrip cell needs copy — Hook-only seeds left Slide 2+ looking blank. */
		const starterHeadlines = fallbackStoryBeats(demoHeadline, demoSub, targetLen);
		slides = Array.from({ length: targetLen }, (_, i) => {
			const cur = String(slides[i] ?? '').trim();
			if (!force && cur) return cur;
			return starterHeadlines[i] ?? demoHeadline;
		});
		const starterSubs = distributeNewsSubtextAcrossSlides(demoSub, slides, targetLen);
		newsSubtextBySlide = Array.from({ length: targetLen }, (_, i) => {
			const cur = String(newsSubtextBySlide[i] ?? '').trim();
			if (!force && cur) return cur;
			return starterSubs[i] ?? (i === 0 ? demoSub : starterSubs[0] ?? demoSub);
		});

		// Stuck inline-edit buffer wins over `slides[]` in the canvas derived — always clear on seed.
		newsHeadlineLive = null;
		activeSlide = 0;

		if (force || isPlaceholderNewsSource(source)) {
			source = defaultNewsSource();
		}
		if (force) {
			/* Brand kit decides logo vs text — don't force empty logo mode.
			   Account / DEV News overrides own position, size, and plate. */
			sourceBorderKind = 'none';
			if (userId) {
				try {
					const preserve = !!resolveTemplateOverride('news');
					applyNewsSourceChromeFromKit(loadBrandKit(userId), {
						preserveOffsets: preserve,
						preserveWidth: preserve,
						preservePlate: preserve,
					});
				} catch {
					/* ignore */
				}
			} else if (String(sourceLogoSrc ?? '').trim()) {
				sourceLabelMode = 'logo';
			} else if (String(source ?? '').trim()) {
				sourceLabelMode = 'text';
			}
		}
		newsSolidBgBySlide = Array.from({ length: targetLen }, (_, i) =>
			force ? '' : String(newsSolidBgBySlide[i] ?? ''),
		);
		showCircleBySlide = Array.from({ length: targetLen }, (_, i) => i === 0);
		{
			const prevCircles = circleImages;
			circleImages = Array.from({ length: targetLen }, (_, i) => {
				const cur = String(prevCircles[i] ?? '').trim();
				if (!force && cur) return cur;
				return showCircleBySlide[i] ? NEWS_DEFAULT_CIRCLE_IMAGE : '';
			});
		}
		circle2Images = padStr(circle2Images);
		showCircle2BySlide = padBool(showCircle2BySlide);
		{
			const n = Math.max(1, targetLen);
			shadowHeightBySlide = Array.from({ length: n }, () => NEWS_DEFAULT_LAYOUT.shadowHeight);
			shadowStrengthBySlide = Array.from({ length: n }, () => NEWS_DEFAULT_LAYOUT.shadowStrength);
			shadowCurveBySlide = Array.from({ length: n }, () => NEWS_DEFAULT_LAYOUT.shadowCurve);
			shadowColorBySlide = Array.from({ length: n }, () => NEWS_DEFAULT_LAYOUT.shadowColor);
			shadowAutoFitBySlide = Array.from({ length: n }, () => true);
			shadowPaintSlideSync = -1;
			shadowHeight = NEWS_DEFAULT_LAYOUT.shadowHeight;
			shadowStrength = NEWS_DEFAULT_LAYOUT.shadowStrength;
			shadowCurve = NEWS_DEFAULT_LAYOUT.shadowCurve;
			shadowColor = NEWS_DEFAULT_LAYOUT.shadowColor;
			shadowAutoFit = true;
		}
		circleX = NEWS_DEFAULT_LAYOUT.circleX;
		circleY = NEWS_DEFAULT_LAYOUT.circleY;
		circleSize = NEWS_DEFAULT_LAYOUT.circleSize;
		textPanelOffsetY = NEWS_DEFAULT_LAYOUT.textPanelOffsetY;

		const prevVids = bgVideosByTemplate.news ?? [];
		const prevImgs = bgImagesByTemplate.news ?? [];
		bgVideosByTemplate = {
			...bgVideosByTemplate,
			news: Array.from({ length: targetLen }, (_, i) => {
				const v = String(prevVids[i] ?? '').trim();
				if (v && !force) return v;
				const img = String(prevImgs[i] ?? '').trim();
				if (img && !force) return '';
				return NEWS_DEMO_VIDEO;
			}),
		};
		bgImagesByTemplate = {
			...bgImagesByTemplate,
			news: Array.from({ length: targetLen }, (_, i) => {
				if (String((bgVideosByTemplate.news ?? [])[i] ?? '').trim()) return '';
				const img = String(prevImgs[i] ?? '').trim();
				if (force) return '';
				return img;
			}),
		};
		applyNewsSeedBackgroundLayout();
	}

	function cloneDevJson<T>(value: T): T {
		return JSON.parse(JSON.stringify(value)) as T;
	}

	/**
	 * Live News structure for the given slide (Gamma-style document).
	 * Moves / add / delete update studio state; this re-reads it on every call
	 * so save-template, account-override, and generate all share one contract.
	 */
	function captureLiveNewsLayoutDocument(slideIndex: number = activeSlide): NewsLayoutDocument {
		const styles = (stylesByTemplateBySlide.news ?? [])[slideIndex] ?? {};
		const offsets = offsetsForTemplate(slideIndex, 'news');
		const textOverlays = (slideTextOverlaysByTemplate.news ?? [])[slideIndex] ?? [];
		const imageOverlays = (slideOverlaysByTemplate.news ?? [])[slideIndex] ?? [];
		const slideShadowH = shadowHeightAt(slideIndex);
		const slideShadowS = shadowStrengthAt(slideIndex);
		return captureNewsLayoutDocument({
			present: {
				headline: true,
				subtext: String(newsSubtextBySlide[slideIndex] ?? '').trim().length > 0,
				source: true,
				circle: !!(showCircleBySlide[slideIndex] ?? false),
				circle2: !!(showCircle2BySlide[slideIndex] ?? false),
				shadow: slideShadowH > 0 && slideShadowS > 0,
			},
			layout: {
				circleX,
				circleY,
				circleSize,
				circle2X,
				circle2Y,
				circle2Size,
				bgOffsetX,
				bgOffsetY,
				bgZoom,
				bgFitMode,
				bgContainMagnify,
				textPanelOffsetY,
				shadowHeight: slideShadowH,
				shadowStrength: slideShadowS,
				shadowCurve: shadowCurveAt(slideIndex),
				shadowColor: shadowColorAt(slideIndex),
				shadowAutoFit: shadowAutoFitAt(slideIndex),
				circleBorderColor,
				circle2BorderColor,
				circleShadow,
				circle2Shadow,
				sourceLabelMode,
				sourceLogoSrc,
				sourceLogoWidth,
				sourceLogoPlateColor,
				sourceBorderKind,
				sourceBorderColor,
			},
			offsets: {
				headline: offsets.headline,
				newsSubtext: offsets.newsSubtext,
				source: offsets.source,
			},
			styles,
			textOverlays,
			imageOverlays,
			textColor,
			canvasBgDark,
			highlights: {
				highlightColor,
				highlightStyleKind,
				highlightGradientFrom,
				highlightGradientTo,
				highlightPattern,
				studioTextHighlightsEnabled,
			},
		});
	}

	/** Apply a NewsLayoutDocument onto studio state (layout chrome + overlays + present). */
	function applyNewsLayoutDocumentToStudio(
		doc: NewsLayoutDocument,
		opts?: { slides?: 'all' | 'active' | number[]; overlays?: boolean },
	) {
		const patch = newsDocumentToApplyPatch(doc);
		const n = Math.max(1, slides.length);
		const idxs =
			opts?.slides === 'active'
				? [activeSlide]
				: Array.isArray(opts?.slides)
					? opts.slides
					: Array.from({ length: n }, (_, i) => i);
		const applyOverlays = opts?.overlays !== false;

		const layout = patch.layout;
		circleX = layout.circleX;
		circleY = layout.circleY;
		circleSize = layout.circleSize;
		circle2X = layout.circle2X;
		circle2Y = layout.circle2Y;
		circle2Size = layout.circle2Size;
		bgOffsetX = layout.bgOffsetX;
		bgOffsetY = layout.bgOffsetY;
		bgZoom = layout.bgZoom;
		bgFitMode = layout.bgFitMode;
		bgContainMagnify = layout.bgContainMagnify;
		textPanelOffsetY = layout.textPanelOffsetY;
		{
			padShadowBySlide(n);
			const rawLayout = layout as {
				shadowHeight?: number;
				shadowStrength?: number;
				shadowCurve?: unknown;
				shadowColor?: unknown;
				shadowAutoFit?: unknown;
			};
			for (const i of idxs) {
				if (i < 0 || i >= n) continue;
				const patch: {
					height?: number;
					strength?: number;
					curve?: BottomShadowCurve;
					color?: string;
					autoFit?: boolean;
				} = {};
				if (typeof rawLayout.shadowHeight === 'number') patch.height = rawLayout.shadowHeight;
				if (typeof rawLayout.shadowStrength === 'number') patch.strength = rawLayout.shadowStrength;
				if (rawLayout.shadowCurve != null) {
					patch.curve = normalizeBottomShadowCurve(rawLayout.shadowCurve);
				}
				if (rawLayout.shadowColor != null) {
					patch.color = normalizeBottomShadowColor(rawLayout.shadowColor);
				}
				if (typeof rawLayout.shadowAutoFit === 'boolean') {
					patch.autoFit = rawLayout.shadowAutoFit;
				}
				if (Object.keys(patch).length) setSlideShadow(i, patch);
			}
		}
		circleBorderColor = layout.circleBorderColor;
		circle2BorderColor = layout.circle2BorderColor;
		circleShadow = layout.circleShadow;
		circle2Shadow = layout.circle2Shadow;
		sourceLabelMode = layout.sourceLabelMode;
		if (layout.sourceLogoSrc) sourceLogoSrc = layout.sourceLogoSrc;
		sourceLogoWidth = layout.sourceLogoWidth;
		if (typeof (layout as { sourceLogoPlateColor?: unknown }).sourceLogoPlateColor === 'string') {
			sourceLogoPlateColor = String(
				(layout as { sourceLogoPlateColor: string }).sourceLogoPlateColor ?? '',
			).trim();
		}
		sourceBorderKind = layout.sourceBorderKind;
		sourceBorderColor = layout.sourceBorderColor;

		if (patch.textColor?.trim()) {
			textColor = patch.textColor;
			textColorTouched = true;
		}
		canvasBgDark = patch.canvasBgDark;
		highlightColor = patch.highlights.highlightColor;
		highlightStyleKind = patch.highlights.highlightStyleKind;
		highlightGradientFrom = patch.highlights.highlightGradientFrom;
		highlightGradientTo = patch.highlights.highlightGradientTo;
		highlightPattern = patch.highlights.highlightPattern;
		// Keep account brand-kit highlight on/off — layout docs don't own that setting.

		if (Object.keys(patch.styles).length) {
			const row = [...(stylesByTemplateBySlide.news ?? [])];
			while (row.length < n) row.push({});
			for (const i of idxs) {
				if (i < 0 || i >= n) continue;
				row[i] = cloneDevJson(patch.styles);
			}
			stylesByTemplateBySlide = { ...stylesByTemplateBySlide, news: row };
		}

		/* Only write slots present on the document — never wipe existing moves when
		   offsets were omitted (older pins / partial docs). */
		const offsetEntries = newsOffsetsForStudioRow(doc);
		if (Object.keys(offsetEntries).length) {
			const next = textOffsetsBySlide.slice();
			while (next.length < n) next.push({});
			for (const i of idxs) {
				if (i < 0 || i >= n) continue;
				const row = { ...(next[i] ?? {}) };
				for (const [kind, off] of Object.entries(offsetEntries)) {
					row[offsetKey('news', kind)] = { x: off.x, y: off.y };
				}
				next[i] = row;
			}
			textOffsetsBySlide = next;
		}

		let nextShow = showCircleBySlide.slice();
		let nextShow2 = showCircle2BySlide.slice();
		while (nextShow.length < n) nextShow.push(false);
		while (nextShow2.length < n) nextShow2.push(false);
		for (const i of idxs) {
			if (i < 0 || i >= n) continue;
			nextShow[i] = !!patch.present.circle;
			nextShow2[i] = !!patch.present.circle2;
		}
		showCircleBySlide = nextShow;
		showCircle2BySlide = nextShow2;

		if (applyOverlays) {
			const textRows = [...(slideTextOverlaysByTemplate.news ?? [])];
			const imgRows = [...(slideOverlaysByTemplate.news ?? [])];
			while (textRows.length < n) textRows.push([]);
			while (imgRows.length < n) imgRows.push([]);
			for (const i of idxs) {
				if (i < 0 || i >= n) continue;
				const locked = cloneDevJson(patch.textOverlays);
				const cur = textRows[i] ?? [];
				/* Keep generate-filled copy; restore box geometry / style from the layout lock. */
				if (locked.length && cur.length) {
					const byId = new Map(locked.map((o) => [o.id, o]));
					textRows[i] = cur.map((o) => {
						const prev = byId.get(o.id);
						if (!prev) return o;
						return {
							...o,
							x: prev.x,
							y: prev.y,
							w: prev.w,
							h: prev.h,
							style: prev.style ? cloneDevJson(prev.style) : o.style,
						};
					});
				} else if (locked.length && !cur.length) {
					textRows[i] = locked;
				}
				imgRows[i] = cloneDevJson(patch.imageOverlays);
			}
			slideTextOverlaysByTemplate = { ...slideTextOverlaysByTemplate, news: textRows };
			slideOverlaysByTemplate = { ...slideOverlaysByTemplate, news: imgRows };
		}
	}

	/** Commit inline headline buffer so save/pin captures what’s on canvas. */
	function commitInlineTextEditsBeforeSave() {
		if (newsHeadlineLive !== null) {
			const live = newsHeadlineLive;
			slides = slides.map((x, i) => (i === activeSlide ? live : x));
			newsHeadlineLive = null;
		}
	}

	/** Primary copy field(s) per template — stored in override `starter.slides`. */
	function starterSlidesForCapture(template: TemplateId): string[] {
		const len = Math.max(slides.length, DEFAULT_STUDIO_SLIDE_COUNT);
		const pad = (arr: string[]) => Array.from({ length: len }, (_, i) => String(arr[i] ?? ''));
		if (template === 'news') return pad(slides);
		if (isVideoStoryFamily(template) || isBrandStackFamily(template)) {
			return pad(videoStoryHeadlineBySlide);
		}
		if (template === 'textCarousel' || isWhitePostFamily(template)) {
			return pad(textCarouselTextBySlide);
		}
		if (template === 'tweet') return pad(tweetBottomTextBySlide);
		if (template === 'article') return pad(articleTextBySlide);
		if (template === 'imageQuote') return pad(imageQuoteTextBySlide);
		if (template === 'blackText' || isPhotoStoryFamily(template)) {
			return pad(blackTextHeadlineBySlide);
		}
		return pad(slides);
	}

	/** Snapshot design tokens for a built-in template (account override / DEV pin). */
	function captureTemplateDevSnapshot(
		template: TemplateId,
		slideIndex: number = activeSlide,
	): TemplateDevOverrideSnapshot {
		commitInlineTextEditsBeforeSave();
		const si = Math.max(0, Math.min(Math.max(0, slides.length - 1), Math.floor(slideIndex)));
		const styles = cloneDevJson((stylesByTemplateBySlide[template] ?? [])[si] ?? {});
		const tweetStyles =
			template === 'tweet' ? cloneDevJson(tweetStylesBySlide[si] ?? {}) : undefined;
		const film = clampFilmStripPct(
			filmStripTopPctByTemplate[template]?.[si] ?? filmStripDefaultsFor(template).topPct,
			filmStripBottomPctByTemplate[template]?.[si] ?? filmStripDefaultsFor(template).bottomPct,
		);
		const textOffsets = cloneDevJson(offsetsForTemplate(si, template));
		const pruneUrl = (u: unknown) => {
			const s = String(u ?? '').trim();
			if (!s || s.startsWith('blob:')) return '';
			return s;
		};
		const textOverlays = cloneDevJson(
			((slideTextOverlaysByTemplate[template] ?? [])[si] ?? []).filter(
				(o) => o && String(o.text ?? '').trim(),
			),
		);
		const imageOverlays = cloneDevJson(
			((slideOverlaysByTemplate[template] ?? [])[si] ?? [])
				.map((o) => {
					const src = pruneUrl(o?.src);
					return src ? { ...o, src } : null;
				})
				.filter((o): o is Overlay => !!o),
		);
		const canvasLayout = {
			bgOffsetX,
			bgOffsetY,
			bgZoom,
			bgFitMode,
			bgContainMagnify,
			textPanelOffsetY,
			circleX,
			circleY,
			circleSize,
			circle2X,
			circle2Y,
			circle2Size,
			circleBorderColor,
			circle2BorderColor,
			circleShadow: cloneDevJson(circleShadow),
			circle2Shadow: cloneDevJson(circle2Shadow),
		};
		return {
			v: 1,
			templateId: template,
			updatedAt: new Date().toISOString(),
			enabled: true,
			styles,
			tweetStyles,
			filmStrip: film,
			textOffsets,
			textOverlays,
			imageOverlays,
			canvasLayout,
			starter: {
				slides: cloneDevJson(starterSlidesForCapture(template)),
				newsSubtextBySlide: cloneDevJson(newsSubtextBySlide.map((x) => String(x ?? ''))),
				source,
				sourceLabelMode,
				sourceLogoSrc: pruneUrl(sourceLogoSrc),
				sourceLogoWidth,
				sourceLogoPlateColor,
				sourceBorderKind,
				sourceBorderColor,
				bgImages: cloneDevJson((bgImagesByTemplate[template] ?? []).map(pruneUrl)),
				bgVideos: cloneDevJson((bgVideosByTemplate[template] ?? []).map(pruneUrl)),
				newsSolidBgBySlide: cloneDevJson(newsSolidBgBySlide.map((x) => String(x ?? ''))),
				showCircleBySlide: cloneDevJson(showCircleBySlide.map(Boolean)),
				circleImages: cloneDevJson(circleImages.map(pruneUrl)),
				showCircle2BySlide: cloneDevJson(showCircle2BySlide.map(Boolean)),
				circle2Images: cloneDevJson(circle2Images.map(pruneUrl)),
			},
			textColor,
			canvasBgDark,
			highlightColor,
			highlightStyleKind,
			highlightGradientFrom,
			highlightGradientTo,
			highlightPattern,
			studioTextHighlightsEnabled,
			newsDocument: template === 'news' ? captureLiveNewsLayoutDocument(si) : undefined,
			newsLayout:
				template === 'news'
					? {
							circleX,
							circleY,
							circleSize,
							circle2X,
							circle2Y,
							circle2Size,
							bgOffsetX,
							bgOffsetY,
							bgZoom,
							bgFitMode,
							bgContainMagnify,
							textPanelOffsetY,
							shadowHeight: shadowHeightAt(si),
							shadowStrength: shadowStrengthAt(si),
							shadowCurve: shadowCurveAt(si),
							shadowAutoFit: shadowAutoFitAt(si),
							circleBorderColor,
							circle2BorderColor,
							circleShadow: cloneDevJson(circleShadow),
							circle2Shadow: cloneDevJson(circle2Shadow),
							sourceLabelMode,
							sourceLogoSrc: pruneUrl(sourceLogoSrc),
							sourceLogoWidth,
							sourceLogoPlateColor,
							sourceBorderKind,
							sourceBorderColor,
						}
					: undefined,
		};
	}

	function pinCurrentTemplateDesign() {
		if (!isTemplateDevToolsEnabled()) return;
		void persistActiveTemplateAsAccountDefault().catch((e) => {
			console.warn('[studio] pin / account template override save failed', e);
		});
	}

	function resolveTemplateOverride(template: TemplateId): TemplateDevOverrideSnapshot | null {
		return accountTemplateOverrides[template] ?? loadEnabledTemplateDevOverride(template);
	}

	async function loadAccountTemplateOverrides() {
		if (!userId) return;
		const { data, error } = await (supabase as any)
			.from('drafts')
			.select('state')
			.eq('user_id', userId)
			.eq('kind', STUDIO_TEMPLATE_OVERRIDE_KIND)
			.limit(40);
		if (error || !Array.isArray(data)) return;
		const next: Partial<Record<TemplateId, TemplateDevOverrideSnapshot>> = {};
		for (const row of data) {
			const snap = row?.state as TemplateDevOverrideSnapshot | undefined;
			if (!snap || snap.v !== 1 || !snap.templateId) continue;
			const id = coerceTemplateId(snap.templateId);
			next[id] = snap;
		}
		accountTemplateOverrides = next;
	}

	async function persistActiveTemplateAsAccountDefault() {
		await persistTemplateAsAccountDefault(activeTemplate, activeSlide);
	}

	/** Persist one built-in template’s chrome (styles, offsets, layout) as the account default. */
	async function persistTemplateAsAccountDefault(template: TemplateId, slideIndex: number) {
		commitInlineTextEditsBeforeSave();
		await materializeBlobUrlsForDraftSave();
		let snap = captureTemplateDevSnapshot(template, slideIndex);
		if (userId && snap.starter) {
			try {
				const uploaded = await uploadTemplateMediaToR2AndRewriteState(`default-${template}`, {
					bgImagesByTemplate: { [template]: snap.starter.bgImages ?? [] },
					circleImages: snap.starter.circleImages ?? [],
					circle2Images: snap.starter.circle2Images ?? [],
					sourceLogoSrc: snap.starter.sourceLogoSrc ?? '',
				});
				const logoUrl = String(uploaded.sourceLogoSrc ?? snap.starter.sourceLogoSrc ?? '').trim();
				snap = {
					...snap,
					starter: {
						...snap.starter,
						bgImages: uploaded.bgImagesByTemplate?.[template] ?? snap.starter.bgImages,
						circleImages: uploaded.circleImages ?? snap.starter.circleImages,
						circle2Images: uploaded.circle2Images ?? snap.starter.circle2Images,
						sourceLogoSrc: logoUrl,
						sourceLogoWidth: snap.starter.sourceLogoWidth ?? sourceLogoWidth,
						sourceLogoPlateColor:
							snap.starter.sourceLogoPlateColor ?? sourceLogoPlateColor,
					},
					newsLayout: snap.newsLayout
						? {
								...snap.newsLayout,
								sourceLogoSrc: logoUrl || snap.newsLayout.sourceLogoSrc,
								sourceLogoWidth: sourceLogoWidth,
								sourceLogoPlateColor,
							}
						: snap.newsLayout,
					newsDocument: snap.newsDocument
						? {
								...snap.newsDocument,
								layout: {
									...snap.newsDocument.layout,
									sourceLogoSrc: logoUrl || snap.newsDocument.layout.sourceLogoSrc,
									sourceLogoWidth,
									sourceLogoPlateColor,
								},
							}
						: snap.newsDocument,
				};
			} catch (e) {
				console.warn('[studio] starter media upload failed', e);
			}
		}
		/* Keep brand kit logo chrome in sync with the saved News default (position, size, plate). */
		if (template === 'news') {
			const off = getTextOffset(slideIndex, offsetKey('news', 'source'));
			const logoForKit =
				String(snap.newsDocument?.layout?.sourceLogoSrc ?? '').trim() ||
				String(snap.starter?.sourceLogoSrc ?? '').trim() ||
				String(sourceLogoSrc ?? '').trim();
			if (logoForKit && logoForKit !== sourceLogoSrc) sourceLogoSrc = logoForKit;
			persistNewsSourceChrome({
				sourceLabelMode,
				sourceLogoSrc: logoForKit,
				sourceLogoWidth,
				sourceLogoPlateColor,
				sourceBorderKind,
				sourceBorderColor,
				sourceOffsetX: off.x,
				sourceOffsetY: off.y,
			});
		}
		accountTemplateOverrides = { ...accountTemplateOverrides, [template]: snap };
		if (isTemplateDevToolsEnabled()) saveTemplateDevOverride(snap);
		if (!userId) return;
		const { data: existing } = await (supabase as any)
			.from('drafts')
			.select('id,state')
			.eq('user_id', userId)
			.eq('kind', STUDIO_TEMPLATE_OVERRIDE_KIND)
			.limit(40);
		const match = (existing ?? []).find(
			(row: { state?: { templateId?: string } }) =>
				coerceTemplateId(String(row?.state?.templateId ?? '')) === template,
		) as { id?: string } | undefined;
		if (match?.id) {
			const { error } = await (supabase as any)
				.from('drafts')
				.update({ state: snap })
				.eq('id', match.id)
				.eq('user_id', userId)
				.eq('kind', STUDIO_TEMPLATE_OVERRIDE_KIND);
			if (error) throw new Error(error.message ?? 'Could not update template default');
			return;
		}
		const { error } = await (supabase as any).from('drafts').insert({
			user_id: userId,
			kind: STUDIO_TEMPLATE_OVERRIDE_KIND,
			state: snap,
		});
		if (error) throw new Error(error.message ?? 'Could not save template default');
	}

	/** Save account defaults for every unique template currently in the deck. */
	async function persistDeckTemplatesAsAccountDefaults(opts?: { reapplyCanvas?: boolean }) {
		const seen = new Set<TemplateId>();
		const pairs: { template: TemplateId; slideIndex: number }[] = [];
		for (let i = 0; i < slideTemplates.length; i++) {
			const template = coerceTemplateId(slideTemplates[i] ?? activeTemplate);
			if (seen.has(template)) continue;
			seen.add(template);
			pairs.push({ template, slideIndex: i });
		}
		if (!pairs.length) {
			pairs.push({ template: activeTemplate, slideIndex: activeSlide });
		}
		for (const { template, slideIndex } of pairs) {
			await persistTemplateAsAccountDefault(template, slideIndex);
		}
		/* Re-applying starter chrome here used to wipe the open canvas right after Save. */
		if (opts?.reapplyCanvas) {
			applyTemplateDevOverride(activeTemplate, { slides: 'all', forceStarter: true });
			if (activeTemplate === 'news') {
				reapplyBrandChromeForTemplate('news', activeSlide, { preserveNewsLayout: true });
			} else if (resolveTemplateOverride(activeTemplate)) {
				reapplyBrandChromeForTemplate(activeTemplate, activeSlide);
			}
		}
	}

	function applyTemplateDevOverride(
		template: TemplateId,
		opts?: { slides?: 'all' | 'active' | number[]; forceStarter?: boolean },
	) {
		const ov = resolveTemplateOverride(template);
		if (!ov) return;
		const n = Math.max(1, slides.length);
		const idxs =
			opts?.slides === 'active'
				? [activeSlide]
				: Array.isArray(opts?.slides)
					? opts.slides
					: Array.from({ length: n }, (_, i) => i);

		if (ov.styles) {
			const row = [...(stylesByTemplateBySlide[template] ?? [])];
			while (row.length < n) row.push({});
			for (const i of idxs) {
				if (i < 0 || i >= n) continue;
				const cloned = cloneDevJson(ov.styles) as Partial<Record<TextElementKind, TextStyle>>;
				/* Account templates often bake brand textBgColor into source.bgColor.
				   That plates the logo; strip it when News is in logo mode. */
				if (
					template === 'news' &&
					sourceLabelMode === 'logo' &&
					cloned.source &&
					'bgColor' in cloned.source
				) {
					const { bgColor: _drop, ...restSource } = cloned.source;
					cloned.source = restSource;
				}
				row[i] = cloned;
			}
			stylesByTemplateBySlide = { ...stylesByTemplateBySlide, [template]: row };
		}

		if (template === 'tweet' && ov.tweetStyles) {
			const row = [...tweetStylesBySlide];
			while (row.length < n) row.push({});
			for (const i of idxs) {
				if (i < 0 || i >= n) continue;
				row[i] = cloneDevJson(ov.tweetStyles);
			}
			tweetStylesBySlide = row;
		}

		if (ov.filmStrip && supportsFilmStrip(template)) {
			const clamped = clampFilmStripPct(ov.filmStrip.topPct, ov.filmStrip.bottomPct);
			const top = [...(filmStripTopPctByTemplate[template] ?? [])];
			const bottom = [...(filmStripBottomPctByTemplate[template] ?? [])];
			while (top.length < n) top.push(clamped.topPct);
			while (bottom.length < n) bottom.push(clamped.bottomPct);
			for (const i of idxs) {
				if (i < 0 || i >= n) continue;
				top[i] = clamped.topPct;
				bottom[i] = clamped.bottomPct;
			}
			filmStripTopPctByTemplate = { ...filmStripTopPctByTemplate, [template]: top };
			filmStripBottomPctByTemplate = { ...filmStripBottomPctByTemplate, [template]: bottom };
		}

		if (ov.textOffsets && Object.keys(ov.textOffsets).length) {
			const next = textOffsetsBySlide.slice();
			while (next.length < n) next.push({});
			for (const i of idxs) {
				if (i < 0 || i >= n) continue;
				const row = { ...(next[i] ?? {}) };
				for (const [kind, off] of Object.entries(ov.textOffsets)) {
					if (!off) continue;
					row[offsetKey(template, kind)] = { x: Number(off.x) || 0, y: Number(off.y) || 0 };
				}
				next[i] = row;
			}
			textOffsetsBySlide = next;
		}

		if (typeof ov.textColor === 'string' && ov.textColor.trim()) {
			textColor = ov.textColor;
			textColorTouched = true;
		}
		if (typeof ov.canvasBgDark === 'boolean') canvasBgDark = ov.canvasBgDark;
		if (typeof ov.highlightColor === 'string') highlightColor = ov.highlightColor;
		if (ov.highlightStyleKind === 'solid' || ov.highlightStyleKind === 'gradient' || ov.highlightStyleKind === 'pattern') {
			highlightStyleKind = ov.highlightStyleKind;
		}
		if (typeof ov.highlightGradientFrom === 'string') highlightGradientFrom = ov.highlightGradientFrom;
		if (typeof ov.highlightGradientTo === 'string') highlightGradientTo = ov.highlightGradientTo;
		if (typeof ov.highlightPattern === 'string') highlightPattern = ov.highlightPattern;
		if (typeof ov.studioTextHighlightsEnabled === 'boolean') {
			studioTextHighlightsEnabled = ov.studioTextHighlightsEnabled;
		}

		const newsDoc = template === 'news' ? parseNewsLayoutDocument(ov.newsDocument) : null;
		if (newsDoc) {
			applyNewsLayoutDocumentToStudio(newsDoc, { slides: opts?.slides ?? 'all', overlays: true });
			/* Merge top-level textOffsets when the document omitted a slot (older pins). */
			if (ov.textOffsets && Object.keys(ov.textOffsets).length) {
				const next = textOffsetsBySlide.slice();
				while (next.length < n) next.push({});
				for (const i of idxs) {
					if (i < 0 || i >= n) continue;
					const row = { ...(next[i] ?? {}) };
					for (const [kind, off] of Object.entries(ov.textOffsets)) {
						if (!off) continue;
						const key = offsetKey(template, kind);
						if (row[key]) continue;
						row[key] = { x: Number(off.x) || 0, y: Number(off.y) || 0 };
					}
					next[i] = row;
				}
				textOffsetsBySlide = next;
			}
			/* Starter chrome fills gaps the layout doc left empty (logo URL, borders). */
			const starter = ov.starter;
			if (starter) {
				if (!String(sourceLogoSrc ?? '').trim() && starter.sourceLogoSrc) {
					sourceLogoSrc = String(starter.sourceLogoSrc).trim();
					if (sourceLogoSrc) sourceLabelMode = 'logo';
				}
				if (
					typeof starter.sourceLogoWidth === 'number' &&
					Number.isFinite(starter.sourceLogoWidth) &&
					!(Number(sourceLogoWidth) > 0)
				) {
					sourceLogoWidth = Math.round(
						Math.max(80, Math.min(400, starter.sourceLogoWidth)),
					);
				}
				if (
					typeof starter.sourceLogoPlateColor === 'string' &&
					!String(sourceLogoPlateColor ?? '').trim()
				) {
					sourceLogoPlateColor = String(starter.sourceLogoPlateColor).trim();
				}
				if (
					(starter.sourceBorderKind === 'none' ||
						starter.sourceBorderKind === 'rules' ||
						starter.sourceBorderKind === 'box') &&
					sourceBorderKind === 'none' &&
					starter.sourceBorderKind !== 'none'
				) {
					sourceBorderKind = starter.sourceBorderKind;
				}
				if (
					typeof starter.sourceBorderColor === 'string' &&
					starter.sourceBorderColor.trim() &&
					!String(sourceBorderColor ?? '').trim()
				) {
					sourceBorderColor = starter.sourceBorderColor;
				}
			}
			/* Starter copy/media come only from `*_DEFAULTS` / generated-demo-posts — not pins. */
			return;
		}

		if (Array.isArray(ov.textOverlays) || Array.isArray(ov.imageOverlays)) {
			const textRows = [...(slideTextOverlaysByTemplate[template] ?? [])];
			const imgRows = [...(slideOverlaysByTemplate[template] ?? [])];
			while (textRows.length < n) textRows.push([]);
			while (imgRows.length < n) imgRows.push([]);
			for (const i of idxs) {
				if (i < 0 || i >= n) continue;
				if (Array.isArray(ov.textOverlays)) textRows[i] = cloneDevJson(ov.textOverlays);
				if (Array.isArray(ov.imageOverlays)) imgRows[i] = cloneDevJson(ov.imageOverlays);
			}
			slideTextOverlaysByTemplate = { ...slideTextOverlaysByTemplate, [template]: textRows };
			slideOverlaysByTemplate = { ...slideOverlaysByTemplate, [template]: imgRows };
		}

		const layout = ov.newsLayout;
		if (template === 'news' && layout) {
			if (typeof layout.circleX === 'number') circleX = layout.circleX;
			if (typeof layout.circleY === 'number') circleY = layout.circleY;
			if (typeof layout.circleSize === 'number') circleSize = layout.circleSize;
			if (typeof layout.circle2X === 'number') circle2X = layout.circle2X;
			if (typeof layout.circle2Y === 'number') circle2Y = layout.circle2Y;
			if (typeof layout.circle2Size === 'number') circle2Size = layout.circle2Size;
			if (typeof layout.bgOffsetX === 'number') bgOffsetX = layout.bgOffsetX;
			if (typeof layout.bgOffsetY === 'number') bgOffsetY = layout.bgOffsetY;
			if (typeof layout.bgZoom === 'number') bgZoom = layout.bgZoom;
			if (layout.bgFitMode === 'cover' || layout.bgFitMode === 'contain') bgFitMode = layout.bgFitMode;
			if (typeof layout.bgContainMagnify === 'number') bgContainMagnify = layout.bgContainMagnify;
			if (typeof layout.textPanelOffsetY === 'number') textPanelOffsetY = layout.textPanelOffsetY;
			if (
				typeof layout.shadowHeight === 'number' ||
				typeof layout.shadowStrength === 'number' ||
				(layout as { shadowCurve?: unknown }).shadowCurve != null ||
				(layout as { shadowColor?: unknown }).shadowColor != null ||
				typeof (layout as { shadowAutoFit?: unknown }).shadowAutoFit === 'boolean'
			) {
				const idxs =
					opts?.slides === 'active'
						? [activeSlide]
						: Array.isArray(opts?.slides)
							? opts.slides
							: Array.from({ length: Math.max(1, slides.length) }, (_, i) => i);
				for (const i of idxs) {
					const patch: {
						height?: number;
						strength?: number;
						curve?: BottomShadowCurve;
						color?: string;
						autoFit?: boolean;
					} = {};
					if (typeof layout.shadowHeight === 'number') patch.height = layout.shadowHeight;
					if (typeof layout.shadowStrength === 'number') patch.strength = layout.shadowStrength;
					if ((layout as { shadowCurve?: unknown }).shadowCurve != null) {
						patch.curve = normalizeBottomShadowCurve(
							(layout as { shadowCurve?: unknown }).shadowCurve,
						);
					}
					if ((layout as { shadowColor?: unknown }).shadowColor != null) {
						patch.color = normalizeBottomShadowColor(
							(layout as { shadowColor?: unknown }).shadowColor,
						);
					}
					if (typeof (layout as { shadowAutoFit?: unknown }).shadowAutoFit === 'boolean') {
						patch.autoFit = !!(layout as { shadowAutoFit: boolean }).shadowAutoFit;
					}
					setSlideShadow(i, patch);
				}
			}
			if (typeof layout.circleBorderColor === 'string') circleBorderColor = layout.circleBorderColor;
			if (typeof layout.circle2BorderColor === 'string') circle2BorderColor = layout.circle2BorderColor;
			if (layout.circleShadow) circleShadow = normalizeCircleShadow(layout.circleShadow);
			if (layout.circle2Shadow) circle2Shadow = normalizeCircleShadow(layout.circle2Shadow);
			if (layout.sourceLabelMode === 'text' || layout.sourceLabelMode === 'logo') {
				sourceLabelMode = layout.sourceLabelMode;
			}
			if (typeof layout.sourceLogoSrc === 'string' && layout.sourceLogoSrc.trim()) {
				sourceLogoSrc = layout.sourceLogoSrc.trim();
			}
			if (typeof layout.sourceLogoWidth === 'number' && Number.isFinite(layout.sourceLogoWidth)) {
				sourceLogoWidth = Math.round(Math.max(80, Math.min(400, layout.sourceLogoWidth)));
			}
			if (typeof layout.sourceLogoPlateColor === 'string') {
				sourceLogoPlateColor = String(layout.sourceLogoPlateColor ?? '').trim();
			}
			if (
				layout.sourceBorderKind === 'none' ||
				layout.sourceBorderKind === 'rules' ||
				layout.sourceBorderKind === 'box'
			) {
				sourceBorderKind = layout.sourceBorderKind;
			}
			if (typeof layout.sourceBorderColor === 'string') {
				sourceBorderColor = layout.sourceBorderColor;
			}
		}

		const canvas = ov.canvasLayout;
		if (canvas && template !== 'news') {
			if (typeof canvas.bgOffsetX === 'number') bgOffsetX = canvas.bgOffsetX;
			if (typeof canvas.bgOffsetY === 'number') bgOffsetY = canvas.bgOffsetY;
			if (typeof canvas.bgZoom === 'number') bgZoom = canvas.bgZoom;
			if (canvas.bgFitMode === 'cover' || canvas.bgFitMode === 'contain') bgFitMode = canvas.bgFitMode;
			if (typeof canvas.bgContainMagnify === 'number') bgContainMagnify = canvas.bgContainMagnify;
			if (typeof canvas.textPanelOffsetY === 'number') textPanelOffsetY = canvas.textPanelOffsetY;
			if (typeof canvas.circleX === 'number') circleX = canvas.circleX;
			if (typeof canvas.circleY === 'number') circleY = canvas.circleY;
			if (typeof canvas.circleSize === 'number') circleSize = canvas.circleSize;
			if (typeof canvas.circle2X === 'number') circle2X = canvas.circle2X;
			if (typeof canvas.circle2Y === 'number') circle2Y = canvas.circle2Y;
			if (typeof canvas.circle2Size === 'number') circle2Size = canvas.circle2Size;
			if (typeof canvas.circleBorderColor === 'string') circleBorderColor = canvas.circleBorderColor;
			if (typeof canvas.circle2BorderColor === 'string') circle2BorderColor = canvas.circle2BorderColor;
			if (canvas.circleShadow) circleShadow = normalizeCircleShadow(canvas.circleShadow);
			if (canvas.circle2Shadow) circle2Shadow = normalizeCircleShadow(canvas.circle2Shadow);
		}

		/* Do not apply ov.starter — one product default for copy/media (`*_DEFAULTS`). */
	}

	/**
	 * Seed default copy/media after Templates gallery / `?template=` opens.
	 * Copy + media always come from `*_DEFAULTS` (generated-demo-posts) — one product default.
	 * Account overrides then restore styles / offsets / letterbox / canvas layout.
	 */
	function seedFreshTemplateSession(template: TemplateId) {
		newsHeadlineLive = null;
		activeSlide = 0;

		while (slides.length < DEFAULT_STUDIO_SLIDE_COUNT) {
			addSlide({ template, copyClipFrom: null, select: false });
		}
		activeSlide = 0;
		slideCount = slides.length;
		slideTemplates = Array.from({ length: slides.length }, () => template);

		if (template === 'news') {
			seedNewsStarterPlaceholderLayout({ force: true });
			canvasBgDark = true;
			if (!textColorTouched) textColor = '#FFFFFF';
			applyTemplateDevOverride(template, { slides: 'all', forceStarter: true });
			/* Account News override owns logo position / size / plate — only fill missing brand mark. */
			reapplyBrandChromeForTemplate('news', 0, { preserveNewsLayout: true });
			return;
		}
		if (template === 'blank') {
			applyTemplateDevOverride(template, { slides: 'all', forceStarter: true });
			return;
		}

		const n = Math.max(DEFAULT_STUDIO_SLIDE_COUNT, slides.length);
		/* Defaults first, then account override wins (styles, offsets, canvas layout). */
		for (let i = 0; i < n; i++) {
			ensureTemplateDefaultsForSlide(template, i);
		}
		if (template === 'tweet') {
			for (let i = 0; i < n; i++) ensureTweetSlideProfileDefaults(i);
		}
		if (isVideoStoryFamily(template)) {
			canvasBgDark = true;
			if (!textColorTouched) textColor = '#FFFFFF';
		}
		applyTemplateDevOverride(template, { slides: 'all', forceStarter: true });
		const hasOverride = !!resolveTemplateOverride(template);
		for (let i = 0; i < n; i++) {
			/* Only fill empty copy/media slots — never wipe override chrome. */
			ensureTemplateDefaultsForSlide(template, i);
			if (!hasOverride) reapplyBrandChromeForTemplate(template, i);
		}
		if (template === 'tweet') {
			for (let i = 0; i < n; i++) ensureTweetSlideProfileDefaults(i);
		}
	}

	async function loadLatestDraft() {
		draftError = '';
		const { data, error } = await (supabase as any)
			.from('drafts')
			.select('id,kind,state,updated_at')
			.eq('user_id', userId)
			.eq('kind', DRAFT_KIND)
			.order('updated_at', { ascending: false })
			.limit(1)
			.maybeSingle();
		if (error) {
			draftError = friendlySupabaseError(error.message ?? 'Failed to load draft');
			return;
		}
		if (!data) return;

		const row = data as DraftRow;
		draftId = row.id;
		const s = row.state ?? {};
		applyDraftState(s as Record<string, any>);
		try {
			await resolveAllR2RefsInStudioState();
		} catch {
			/* ignore */
		}
		scrubStaleDemoPostersAgainstRealVideos();
		queueDraftStateBloatCleanup(row.id, s as Record<string, unknown>);
	}

	function queueDraftStateBloatCleanup(rowId: string, s: Record<string, unknown>) {
		if (!draftStateHasEmbeddedMedia(s)) return;
		const cleaned = stripEmbeddedMediaFromDraftState({ ...s });
		queueMicrotask(() => {
			try {
				void (supabase as any).from('drafts').update({ state: cleaned }).eq('id', rowId);
			} catch {
				/* ignore */
			}
		});
	}

	/** Open a specific workspace draft from the dashboard (`?draft=uuid`). */
	async function loadDraftById(id: string) {
		draftError = '';
		const { data, error } = await (supabase as any)
			.from('drafts')
			.select('id,kind,state,updated_at')
			.eq('user_id', userId)
			.eq('id', id)
			.eq('kind', DRAFT_KIND)
			.maybeSingle();
		if (error) {
			draftError = friendlySupabaseError(error.message ?? 'Failed to load draft');
			draftId = '';
			return;
		}
		if (!data) {
			draftError = 'Draft not found or you do not have access.';
			draftId = '';
			return;
		}

		const row = data as DraftRow;
		draftId = row.id;
		const s = row.state ?? {};
		applyDraftState(s as Record<string, any>);
		try {
			await resolveAllR2RefsInStudioState();
		} catch {
			/* ignore */
		}
		scrubStaleDemoPostersAgainstRealVideos();
		queueDraftStateBloatCleanup(row.id, s as Record<string, unknown>);
	}

	async function loadSavedStudioTemplate(templateDraftId: string) {
		draftError = '';
		const { data, error } = await (supabase as any)
			.from('drafts')
			.select('id,kind,state,updated_at')
			.eq('user_id', userId)
			.eq('id', templateDraftId)
			.eq('kind', STUDIO_SAVED_TEMPLATE_KIND)
			.maybeSingle();
		if (error) {
			draftError = error.message ?? 'Failed to load template';
			return;
		}
		if (!data) {
			draftError = 'Saved template not found';
			return;
		}
		const raw = { ...(data.state ?? {}) } as Record<string, any>;
		delete raw._templateName;
		applyDraftState(raw);
		// Resolve saved-template R2 refs before reveal so canvas/filmstrip aren't blank.
		try {
			await resolveAllR2RefsInStudioState();
		} catch {
			/* ignore — unresolved refs stay blank until later retries */
		}
		scrubStaleDemoPostersAgainstRealVideos();
		studioHasUnsavedChanges = false;
		// Next autosave should target the workspace draft, not overwrite the named template row.
		draftId = '';
		// Don't reuse the template's preview object as this workspace draft's card thumb.
		draftPreviewUrl = '';
		draftPreviewKey = '';
		slideCount = slides.length;
		exportedSlides = [];
	}

	async function resolveAllR2RefsInStudioState() {
		await prefetchAllR2RefsInStudioMedia(ensureR2Resolved, {
			bgImagesByTemplate,
			bgVideosByTemplate,
			circleImages,
			circle2Images,
			subjectCutouts,
			slideOverlaysByTemplate,
			extraUrls: [
				sourceLogoSrc,
				brandCta?.image ?? '',
				...tweetTopAvatarImageBySlide,
				...tweetBottomAvatarImageBySlide,
				...textCarouselAvatarImageBySlide,
				...articleLogoSrcBySlide,
				...brandStackBottomMediaBySlide,
			],
		});
	}

	async function listSavedStudioTemplates(): Promise<
		{ id: string; name: string; updatedAt: string }[]
	> {
		if (!userId) return [];
		const data = await fetchDraftLibraryRows(supabase, {
			userId,
			kind: STUDIO_SAVED_TEMPLATE_KIND,
			limit: 40,
		});
		return data
			.map((row) => ({
				id: String(row.id ?? ''),
				name: String(row.state?._templateName ?? '').trim() || 'Untitled template',
				updatedAt: String(row.updated_at ?? ''),
			}))
			.filter((row) => row.id);
	}

	async function refreshSavedStudioTemplates() {
		if (!userId) {
			savedStudioTemplates = [];
			return;
		}
		savedStudioTemplatesLoading = true;
		try {
			const data = await fetchDraftLibraryRows(supabase, {
				userId,
				kind: STUDIO_SAVED_TEMPLATE_KIND,
				limit: 40,
			});
			savedStudioTemplates = data
				.map((row) =>
					savedStudioTemplateMetaFromRow({
						id: String(row.id ?? ''),
						state: row.state ?? null,
						updated_at: String(row.updated_at ?? ''),
					}),
				)
				.filter((row): row is SavedStudioTemplateMeta => !!row);
		} catch {
			savedStudioTemplates = [];
		} finally {
			savedStudioTemplatesLoading = false;
		}
	}

	async function loadSavedTemplateStateFull(savedId: string): Promise<Record<string, unknown> | null> {
		const id = String(savedId ?? '').trim();
		if (!id) return null;
		const cached = savedTemplateStateCache[id];
		if (cached) return cached;
		const { data, error } = await (supabase as any)
			.from('drafts')
			.select('state')
			.eq('user_id', userId)
			.eq('id', id)
			.eq('kind', STUDIO_SAVED_TEMPLATE_KIND)
			.maybeSingle();
		if (error || !data?.state) return null;
		const state = { ...(data.state ?? {}) } as Record<string, unknown>;
		delete state._templateName;
		savedTemplateStateCache = { ...savedTemplateStateCache, [id]: state };
		return state;
	}

	function copySavedNewsShadowFromSlide(
		state: Record<string, unknown>,
		srcIdx: number,
		targetIdxs: number[],
	) {
		padShadowBySlide();
		const patchAt = (i: number) => {
			const patch: {
				height?: number;
				strength?: number;
				curve?: BottomShadowCurve;
				color?: string;
				autoFit?: boolean;
			} = {};
			const hRow = state.shadowHeightBySlide as unknown[] | undefined;
			const sRow = state.shadowStrengthBySlide as unknown[] | undefined;
			const cRow = state.shadowCurveBySlide as unknown[] | undefined;
			const colRow = state.shadowColorBySlide as unknown[] | undefined;
			const aRow = state.shadowAutoFitBySlide as unknown[] | undefined;
			if (Array.isArray(hRow) && typeof hRow[srcIdx] === 'number') {
				patch.height = hRow[srcIdx] as number;
			} else if (typeof state.shadowHeight === 'number') {
				patch.height = state.shadowHeight;
			}
			if (Array.isArray(sRow) && typeof sRow[srcIdx] === 'number') {
				patch.strength = sRow[srcIdx] as number;
			} else if (typeof state.shadowStrength === 'number') {
				patch.strength = state.shadowStrength;
			}
			if (Array.isArray(cRow) && cRow[srcIdx] != null) {
				patch.curve = normalizeBottomShadowCurve(cRow[srcIdx]);
			} else if (state.shadowCurve != null) {
				patch.curve = normalizeBottomShadowCurve(state.shadowCurve);
			}
			if (Array.isArray(colRow) && typeof colRow[srcIdx] === 'string') {
				patch.color = normalizeBottomShadowColor(colRow[srcIdx]);
			} else if (typeof state.shadowColor === 'string') {
				patch.color = normalizeBottomShadowColor(state.shadowColor);
			}
			if (Array.isArray(aRow) && typeof aRow[srcIdx] === 'boolean') {
				patch.autoFit = aRow[srcIdx] as boolean;
			} else if (typeof state.shadowAutoFit === 'boolean') {
				patch.autoFit = state.shadowAutoFit;
			}
			if (Object.keys(patch).length) setSlideShadow(i, patch);
		};
		for (const i of targetIdxs) {
			if (i < 0 || i >= slides.length) continue;
			patchAt(i);
		}
	}

	async function applySavedStudioTemplateToSlides(savedId: string, idxs: number[]) {
		commitInlineTextEditsBeforeSave();
		const state = await loadSavedTemplateStateFull(savedId);
		if (!state) {
			setFlashToast('Could not load that saved template');
			return;
		}
		const savedName =
			savedStudioTemplates.find((s) => s.id === savedId)?.name ||
			String(savedTemplateNameBySlide[idxs[0] ?? activeSlide] ?? '').trim() ||
			'Saved template';
		const base = savedStudioTemplateMetaFromRow({
			id: savedId,
			state: { ...state, _templateName: savedName },
		})?.baseTemplate ?? 'news';
		const srcIdx = 0;
		const targets = idxs.filter((i) => i >= 0 && i < slides.length);
		if (!targets.length) return;

		if (base === 'news') {
			const bySlide = Array.isArray(state.newsLayoutBySlide)
				? (state.newsLayoutBySlide as unknown[])
				: null;
			const doc = parseNewsLayoutDocument(bySlide?.[srcIdx] ?? state.newsLayoutDocument);
			if (doc) {
				applyNewsLayoutDocumentToStudio(doc, { slides: targets, overlays: true });
			} else {
				const savedStyles = (
					(state.stylesByTemplateBySlide as Record<string, unknown[]> | undefined)?.news ?? []
				)[srcIdx];
				if (savedStyles && typeof savedStyles === 'object') {
					const row = [...(stylesByTemplateBySlide.news ?? [])];
					while (row.length < slides.length) row.push({});
					for (const i of targets) row[i] = cloneDevJson(savedStyles);
					stylesByTemplateBySlide = { ...stylesByTemplateBySlide, news: row };
				}
				const savedImgOverlays = (
					(state.slideOverlaysByTemplate as Record<string, unknown[][]> | undefined)?.news ?? []
				)[srcIdx];
				const savedTextOverlays = (
					(state.slideTextOverlaysByTemplate as Record<string, unknown[][]> | undefined)?.news ??
					[]
				)[srcIdx];
				if (Array.isArray(savedImgOverlays) || Array.isArray(savedTextOverlays)) {
					const imgRows = [...(slideOverlaysByTemplate.news ?? [])];
					const textRows = [...(slideTextOverlaysByTemplate.news ?? [])];
					while (imgRows.length < slides.length) imgRows.push([]);
					while (textRows.length < slides.length) textRows.push([]);
					for (const i of targets) {
						if (Array.isArray(savedImgOverlays)) imgRows[i] = cloneDevJson(savedImgOverlays);
						if (Array.isArray(savedTextOverlays)) textRows[i] = cloneDevJson(savedTextOverlays);
					}
					slideOverlaysByTemplate = { ...slideOverlaysByTemplate, news: imgRows };
					slideTextOverlaysByTemplate = { ...slideTextOverlaysByTemplate, news: textRows };
				}
			}
			copySavedNewsShadowFromSlide(state, srcIdx, targets);
		} else {
			const savedStyles = (
				(state.stylesByTemplateBySlide as Record<string, unknown[]> | undefined)?.[base] ?? []
			)[srcIdx];
			if (savedStyles && typeof savedStyles === 'object') {
				const row = [...(stylesByTemplateBySlide[base] ?? [])];
				while (row.length < slides.length) row.push({});
				for (const i of targets) row[i] = cloneDevJson(savedStyles);
				stylesByTemplateBySlide = { ...stylesByTemplateBySlide, [base]: row };
			}
		}

		let nextSavedIds = savedTemplateIdBySlide.slice();
		let nextSavedNames = savedTemplateNameBySlide.slice();
		while (nextSavedIds.length < slides.length) nextSavedIds.push('');
		while (nextSavedNames.length < slides.length) nextSavedNames.push('');
		let nextSlideTemplates = slideTemplates.slice();

		for (const i of targets) {
			const from = coerceTemplateId(nextSlideTemplates[i]);
			if (from !== base) {
				nextSlideTemplates[i] = base;
				ensureTemplateDefaultsForSlide(base, i);
				applyTemplateDevOverride(base, { slides: [i] });
				finalizeTemplateSwitch(from, base, i);
			} else if (base === 'news') {
				reapplyBrandChromeForTemplate('news', i);
			}
			nextSavedIds[i] = savedId;
			nextSavedNames[i] = savedName;
		}
		slideTemplates = nextSlideTemplates;
		savedTemplateIdBySlide = nextSavedIds;
		savedTemplateNameBySlide = nextSavedNames;
		lastTemplateUsed = base;
		studioHasUnsavedChanges = true;
		try {
			await resolveAllR2RefsInStudioState();
		} catch {
			/* ignore */
		}
	}

	function clearSavedTemplateForSlide(slideIdx: number) {
		if (slideIdx < 0 || slideIdx >= slides.length) return;
		if (!String(savedTemplateIdBySlide[slideIdx] ?? '').trim()) return;
		savedTemplateIdBySlide = savedTemplateIdBySlide.map((id, i) => (i === slideIdx ? '' : id));
		savedTemplateNameBySlide = savedTemplateNameBySlide.map((name, i) =>
			i === slideIdx ? '' : name,
		);
	}

	function selectTemplateFromDock(raw: string) {
		if (isSavedStudioTemplateSelectId(raw)) {
			void applySavedStudioTemplateToSlides(savedStudioTemplateIdFromSelectId(raw), [activeSlide]);
			return;
		}
		clearSavedTemplateForSlide(activeSlide);
		setActiveTemplate(raw as TemplateId);
	}

	function applyTemplateDockToAll() {
		const savedId = String(savedTemplateIdBySlide[activeSlide] ?? '').trim();
		if (savedId) {
			void applySavedStudioTemplateToSlides(
				savedId,
				Array.from({ length: slides.length }, (_, i) => i),
			);
			return;
		}
		applyTemplateToAll(activeTemplate, { skipNewsSeed: true });
	}

	async function saveStudioTemplateNamed(
		nameOverride?: string,
		opts?: { overwriteId?: string; leaveAfter?: boolean; leaveHref?: string },
	) {
		let uid = String(userId ?? '').trim();
		if (!uid) {
			uid = await ensureStudioAuthUserId();
		}
		const name =
			(nameOverride ?? studioTemplateName).trim() ||
			`Studio template ${new Date().toLocaleDateString()}`;
		const overwriteId = String(opts?.overwriteId ?? '').trim();
		// `__builtin__` was the old “replace starter” path — Save template is per-customer only.
		if (overwriteId === BUILTIN_TEMPLATE_OVERWRITE_ID) {
			throw new Error('Use the DEV chip to replace the product-wide template default.');
		}
		studioTemplateName = name;
		studioTemplateSaving = true;
		studioTemplateFeedback = '';

		// Use the exact same export pipeline as the bottom-right Export/Post button.
		// This avoids subtle races with the filmstrip capture and guarantees "what you see"
		// matches the stored preview.
		let previewPng: string | null = null;
		if (!exportRef) {
			studioTemplateSaving = false;
			throw new Error(
				'Canvas is not ready to export yet — wait for the preview to finish loading, then try again.',
			);
		}
		try {
			const n = await exportAllSlidesToDraft();
			previewPng = n > 0 ? (exportedSlides[0] ?? null) : null;
			if (!previewPng) {
				studioTemplateSaving = false;
				throw new Error(
					lastExportError
						? `Could not capture preview: ${lastExportError}`
						: 'Could not capture a preview image. Uploaded WebP/JPEG/PNG are supported — wait for slides to finish loading, then try again.',
				);
			}
		} catch (e: unknown) {
			studioTemplateSaving = false;
			if (e instanceof Error) throw e;
			throw new Error('Preview export failed — try again after the canvas finishes loading.');
		}

		// Export can take long enough for the JWT to go stale — refresh before RLS writes.
		try {
			uid = await ensureStudioAuthUserId();
		} catch (e: unknown) {
			studioTemplateSaving = false;
			throw e instanceof Error ? e : new Error('Your session expired — sign in again, then save.');
		}

		await materializeBlobUrlsForDraftSave();
		/* Keep data:/https media in this object until R2 rewrite — never write base64 to Postgres. */
		let state: Record<string, any> = { ...buildDraftState('template'), _templateName: name };
		let templateId = overwriteId;
		if (templateId) {
			const { data: existing, error: findErr } = await (supabase as any)
				.from('drafts')
				.select('id')
				.eq('id', templateId)
				.eq('user_id', uid)
				.eq('kind', STUDIO_SAVED_TEMPLATE_KIND)
				.maybeSingle();
			if (findErr) {
				studioTemplateSaving = false;
				throw new Error(findErr.message ?? 'Could not find that template');
			}
			if (!existing) {
				studioTemplateSaving = false;
				throw new Error('That template is gone — save a new one instead.');
			}
		} else {
			templateId = crypto.randomUUID();
			const { error } = await (supabase as any).from('drafts').insert({
				id: templateId,
				user_id: uid,
				kind: STUDIO_SAVED_TEMPLATE_KIND,
				state: {
					_templateName: name,
					formatId: state.formatId,
					slides: state.slides,
					slideTemplates: state.slideTemplates,
					_saving: true,
				},
			});
			if (error) {
				studioTemplateSaving = false;
				const msg = String(error.message ?? 'Save failed');
				if (/row-level security|rls/i.test(msg)) {
					throw new Error('Could not save — sign in again, then try Save template.');
				}
				throw new Error(msg);
			}
		}

		let r2Note = '';
		try {
			state = await uploadTemplateMediaToR2AndRewriteState(templateId, state);
			const mediaWarnings = Array.isArray(state._mediaUploadWarnings)
				? (state._mediaUploadWarnings as string[])
				: [];
			delete state._mediaUploadWarnings;
			state = stripEmbeddedMediaFromDraftState(state);
			state._templateName = name;
			const { error } = await (supabase as any)
				.from('drafts')
				.update({ state })
				.eq('id', templateId)
				.eq('user_id', uid)
				.eq('kind', STUDIO_SAVED_TEMPLATE_KIND);
			if (error) {
				studioTemplateSaving = false;
				throw new Error(error.message ?? 'Replace failed');
			}
			if (mediaWarnings.length) {
				r2Note = ` Some media could not be uploaded (${mediaWarnings[0]}).`;
			}
		} catch (e: unknown) {
			studioTemplateSaving = false;
			const msg = e instanceof Error ? e.message : String(e);
			throw new Error(
				`Could not upload template images to storage: ${msg}. Check R2 env keys and try again.`,
			);
		}

		// Upload preview via same-origin /api/r2/upload (server writes to R2 — no browser CORS to R2).
		if (templateId) {
			if (!previewPng) {
				r2Note =
					' Note: First-slide preview was not exported, so nothing was uploaded to R2. Try Export first or ensure slides render.';
			} else {
				try {
					const key = `${uid}/templates/${templateId}.png`;
					const blob = await (await fetch(previewPng)).blob();
					await r2UploadBlob({ key, blob, filename: 'slide-1.png' });
					await (supabase as any)
						.from('drafts')
						.update({
							state: {
								...state,
								draftPreviewUrl: '',
								draftPreviewKey: key,
								draftPreviewPath: key,
								templatePreviewUrl: '',
							},
						})
						.eq('id', templateId)
						.eq('user_id', uid)
						.eq('kind', STUDIO_SAVED_TEMPLATE_KIND);
				} catch (e: unknown) {
					const msg = e instanceof Error ? e.message : String(e);
					r2Note = ` Preview upload warning: ${msg}. Template media was saved — check R2 env if the card thumb is blank.`;
				}
			}
		}
		studioTemplateSaving = false;
		const savedLabel = overwriteId ? `Updated “${name}”` : `Saved “${name}”`;
		studioTemplateFeedback = r2Note ? `${savedLabel}.${r2Note}` : savedLabel;
		showSaveTemplatePanel = false;
		studioHasUnsavedChanges = false;
		/* Keep account defaults in sync — do not re-apply starter onto the open canvas. */
		try {
			await persistDeckTemplatesAsAccountDefaults({ reapplyCanvas: false });
		} catch (e) {
			console.warn('[studio] account template override after save failed', e);
		}
		setFlashToast(savedLabel);
		void refreshSavedStudioTemplates();
		if (templateId) {
			savedTemplateIdBySlide = savedTemplateIdBySlide.map((id, i) =>
				i === activeSlide ? templateId : id,
			);
			savedTemplateNameBySlide = savedTemplateNameBySlide.map((rowName, i) =>
				i === activeSlide ? name : rowName,
			);
		}

		if (opts?.leaveAfter) {
			allowStudioLeave = true;
			const href = String(opts.leaveHref ?? '').trim() || '/dashboard/carousels';
			await goto(href);
			return;
		}

		/* Stay in Studio — remember this saved id for overwrite next time. */
		allowStudioLeave = false;
		if (templateId && typeof window !== 'undefined') {
			try {
				const url = new URL(window.location.href);
				url.searchParams.set('saved', templateId);
				url.searchParams.delete('from');
				url.searchParams.delete('draft');
				history.replaceState(history.state, '', `${url.pathname}${url.search}`);
			} catch {
				/* ignore */
			}
		}
	}

	function extFromMime(mime: string): string {
		const m = String(mime ?? '').toLowerCase();
		if (m.includes('png')) return 'png';
		if (m.includes('jpeg') || m.includes('jpg')) return 'jpg';
		if (m.includes('webp')) return 'webp';
		if (m.includes('gif')) return 'gif';
		if (m.includes('mp4')) return 'mp4';
		if (m.includes('webm')) return 'webm';
		if (m.includes('quicktime') || m.includes('mov')) return 'mov';
		return 'bin';
	}

	async function uploadDataUrlToR2Key(dataUrl: string, key: string) {
		const blob = await (await fetch(dataUrl)).blob();
		const mime = String(blob.type || '').toLowerCase();
		if (mime.startsWith('video/')) {
			await r2UploadVideo({ key, blob, filename: `video.${extFromMime(mime)}` });
			return;
		}
		await r2UploadBlob({ key, blob, filename: `asset.${extFromMime(mime || 'image/png')}` });
	}

	function isImageDataUrl(u: unknown): u is string {
		return typeof u === 'string' && u.startsWith('data:image/');
	}

	function isVideoDataUrl(u: unknown): u is string {
		return typeof u === 'string' && u.startsWith('data:video/');
	}

	/** Bundled placeholders / demos — durable without R2; do not re-upload. */
	function isAppStaticMediaPath(u: string): boolean {
		const s = u.trim();
		if (!s.startsWith('/')) return false;
		if (s.startsWith('//')) return false;
		return (
			s.startsWith('/placeholders/') ||
			s.startsWith('/videos/') ||
			s.startsWith('/logo/') ||
			s.startsWith('/fonts/') ||
			s.startsWith('/music/')
		);
	}

	function isPersistableRemoteUrl(u: unknown): u is string {
		if (typeof u !== 'string') return false;
		const s = u.trim();
		if (!s || isR2Ref(s) || s.startsWith('blob:') || s.startsWith('data:')) return false;
		if (isAppStaticMediaPath(s)) return false;
		return s.startsWith('http://') || s.startsWith('https://');
	}

	function looksLikeVideoUrl(u: string): boolean {
		const s = u.trim().toLowerCase();
		if (!s) return false;
		if (s.startsWith('data:video/')) return true;
		if (/\.(mp4|webm|mov|m4v)(\?|#|$)/i.test(s)) return true;
		return false;
	}

	/** Upload any in-memory media (data URL, http(s)) to R2 → `r2:<key>`. Static app paths stay as-is. */
	async function persistMediaUrlToR2(raw: string, key: string): Promise<string> {
		const u = String(raw ?? '').trim();
		if (!u) return '';
		if (isR2Ref(u)) return u;
		if (isAppStaticMediaPath(u)) return u;

		if (isImageDataUrl(u) || isVideoDataUrl(u)) {
			await uploadDataUrlToR2Key(u, key);
			return `r2:${key}`;
		}
		if (u.startsWith('data:')) {
			/* Non-image/video data URLs (octet-stream, etc.) — try upload; may fail sniff. */
			await uploadDataUrlToR2Key(u, key);
			return `r2:${key}`;
		}
		if (u.startsWith('blob:')) {
			const dataUrl = await blobUrlToDataUrl(u);
			if (!dataUrl || dataUrl.startsWith('blob:')) {
				throw new Error('Could not read blob media for template save');
			}
			await uploadDataUrlToR2Key(dataUrl, key);
			return `r2:${key}`;
		}
		if (isPersistableRemoteUrl(u)) {
			if (looksLikeVideoUrl(u)) {
				const res = await fetch('/api/media/to-data-url', {
					method: 'POST',
					headers: { 'content-type': 'application/json' },
					body: JSON.stringify({ url: u }),
					signal: AbortSignal.timeout(60_000),
				});
				const data = await res.json();
				if (!res.ok || !data?.ok || typeof data.dataUrl !== 'string') {
					throw new Error(`Could not fetch remote video: ${u.slice(0, 80)}`);
				}
				await uploadDataUrlToR2Key(data.dataUrl, key);
				return `r2:${key}`;
			}
			const safe = await toExportSafeImageUrl(u);
			if (isImageDataUrl(safe) || (safe.startsWith('data:') && safe.includes('image/'))) {
				await uploadDataUrlToR2Key(safe, key);
				return `r2:${key}`;
			}
			throw new Error(`Could not persist remote media: ${u.slice(0, 80)}`);
		}
		return u;
	}

	async function uploadTemplateMediaToR2AndRewriteState(
		mediaId: string,
		state: Record<string, any>,
		opts?: { folder?: 'templates' | 'drafts' },
	) {
		const out = { ...(state ?? {}) } as Record<string, any>;
		const folder = opts?.folder === 'drafts' ? 'drafts' : 'templates';
		const base = `${userId}/${folder}/${mediaId}`;
		const warnings: string[] = [];

		const rewriteArr = async (arrIn: unknown, sub: string): Promise<string[]> => {
			const arr = Array.isArray(arrIn) ? [...arrIn] : [];
			for (let i = 0; i < arr.length; i++) {
				const u = String(arr[i] ?? '').trim();
				if (!u || isR2Ref(u) || isAppStaticMediaPath(u)) continue;
				if (
					isImageDataUrl(u) ||
					isVideoDataUrl(u) ||
					u.startsWith('data:') ||
					u.startsWith('blob:') ||
					isPersistableRemoteUrl(u)
				) {
					const ext = looksLikeVideoUrl(u)
						? 'mp4'
						: isImageDataUrl(u)
							? extFromMime(u.slice(5, u.indexOf(';')))
							: 'bin';
					const key = `${base}/${sub}/${i}.${ext}`;
					try {
						arr[i] = await persistMediaUrlToR2(u, key);
					} catch (e: unknown) {
						const msg = e instanceof Error ? e.message : String(e);
						warnings.push(`${sub}[${i}]: ${msg}`);
						/* Keep durable https; drop session-only data/blob so save still succeeds. */
						if (isPersistableRemoteUrl(u)) arr[i] = u;
						else if (isAppStaticMediaPath(u)) arr[i] = u;
						else arr[i] = '';
					}
				}
			}
			return arr.map((x) => String(x ?? ''));
		};

		// Background images (by template, by slide)
		if (out.bgImagesByTemplate && typeof out.bgImagesByTemplate === 'object') {
			const next: Record<string, string[]> = { ...(out.bgImagesByTemplate ?? {}) };
			for (const tpl of Object.keys(next)) {
				next[tpl] = await rewriteArr(next[tpl], `bg/${tpl}`);
			}
			out.bgImagesByTemplate = next;
		}

		// Background videos (stock / uploaded) — previously never persisted to R2.
		if (out.bgVideosByTemplate && typeof out.bgVideosByTemplate === 'object') {
			const next: Record<string, string[]> = { ...(out.bgVideosByTemplate ?? {}) };
			for (const tpl of Object.keys(next)) {
				next[tpl] = await rewriteArr(next[tpl], `bgvid/${tpl}`);
			}
			out.bgVideosByTemplate = next;
		}

		out.circleImages = await rewriteArr(out.circleImages, 'circle');
		out.circle2Images = await rewriteArr(out.circle2Images, 'circle2');
		out.subjectCutouts = await rewriteArr(out.subjectCutouts, 'cutout');

		// Image sticker overlays (per template/slide)
		if (out.slideOverlaysByTemplate && typeof out.slideOverlaysByTemplate === 'object') {
			const next: Record<string, any> = { ...(out.slideOverlaysByTemplate ?? {}) };
			for (const tpl of Object.keys(next)) {
				const slides = Array.isArray(next[tpl]) ? [...next[tpl]] : [];
				for (let s = 0; s < slides.length; s++) {
					const row = Array.isArray(slides[s]) ? [...slides[s]] : [];
					for (let j = 0; j < row.length; j++) {
						const o = { ...(row[j] ?? {}) };
						const src = String(o.src ?? '').trim();
						if (
							src &&
							!isR2Ref(src) &&
							!isAppStaticMediaPath(src) &&
							(isImageDataUrl(src) ||
								src.startsWith('data:') ||
								src.startsWith('blob:') ||
								isPersistableRemoteUrl(src))
						) {
							const key = `${base}/overlay/${tpl}/${s}-${j}.bin`;
							try {
								o.src = await persistMediaUrlToR2(src, key);
							} catch (e: unknown) {
								const msg = e instanceof Error ? e.message : String(e);
								warnings.push(`overlay/${tpl}/${s}-${j}: ${msg}`);
								o.src = isPersistableRemoteUrl(src) ? src : '';
							}
						}
						row[j] = o;
					}
					slides[s] = row;
				}
				next[tpl] = slides;
			}
			out.slideOverlaysByTemplate = next;
		}

		const logo = String(out.sourceLogoSrc ?? '').trim();
		if (
			logo &&
			!isR2Ref(logo) &&
			!isAppStaticMediaPath(logo) &&
			(isImageDataUrl(logo) ||
				logo.startsWith('data:') ||
				logo.startsWith('blob:') ||
				isPersistableRemoteUrl(logo))
		) {
			try {
				out.sourceLogoSrc = await persistMediaUrlToR2(logo, `${base}/asset/sourceLogo.bin`);
			} catch (e: unknown) {
				const msg = e instanceof Error ? e.message : String(e);
				warnings.push(`sourceLogo: ${msg}`);
				out.sourceLogoSrc = isPersistableRemoteUrl(logo) ? logo : '';
			}
		}

		for (const field of [
			'tweetTopAvatarImageBySlide',
			'tweetBottomAvatarImageBySlide',
			'textCarouselAvatarImageBySlide',
			'articleLogoSrcBySlide',
			'brandStackBottomMediaBySlide',
		] as const) {
			if (Array.isArray((out as any)[field])) {
				(out as any)[field] = await rewriteArr((out as any)[field], `asset/${field}`);
			}
		}

		if (warnings.length) {
			(out as any)._mediaUploadWarnings = warnings.slice(0, 8);
		}
		return out;
	}

	/** ~1.2M chars ≈ under 1MB base64 — full-bleed Vertex JPEGs often exceed the old 220k cap. */
	function buildDraftState(mode: 'draft' | 'template' = 'draft') {
		// Avoid saving huge/persistent-less URLs that can freeze restore.
		const pruneMediaUrl = (u: unknown) => {
			if (typeof u !== 'string') return '';
			const s = u.trim();
			if (!s) return '';
			// blob: URLs don’t survive reload and can get large in drafts.
			if (s.startsWith('blob:')) return '';
			// Workspace drafts: media belongs in R2 — never embed base64 in Postgres.
			if (mode === 'draft' && s.startsWith('data:')) return '';
			/* Template / upload path: keep data URLs so R2 rewrite can persist them.
			   Large stock/export data: URLs used to be size-pruned here — that wiped
			   backgrounds before upload and saved empty templates. Strip after R2. */
			return s;
		};
		const pruneMediaMap = (m: Record<string, unknown>) =>
			(Object.fromEntries(
				Object.entries(m ?? {}).map(([k, arr]) => [
					k,
					Array.isArray(arr) ? (arr as unknown[]).map(pruneMediaUrl) : [],
				]),
			) as unknown) as Record<TemplateId, string[]>;

		return {
			formatId,
			lastTemplateUsed,
			slideCount,
			category,
			newsContentMode,
			newsImageSourceMode,
			stockMediaKind,
			newsCopyLength,
			studioAudienceId,
			studioAudienceCustom,
			studioStyle,
			studioEmotion,
			storyCategory,
		generalTopicPrompt,
		factTopicPrompt,
		factTopicCategory,
		storyTopicPrompt,
		quoteTopicPrompt,
		quoteTopicCategory,
		stepsTopicPrompt,
		stepsCount,
			search,
			source,
			sourceLogoSrc,
			sourceLabelMode,
			sourceBorderKind,
			sourceBorderColor,
			sourceLogoWidth,
			sourceLogoPlateColor,
			articleUrl,
			articleTitle,
			articleSnippet,
			activeSlide,
			slides,
			slideTemplates,
			savedTemplateIdBySlide,
			savedTemplateNameBySlide,
			bgImagesByTemplate: pruneMediaMap(bgImagesByTemplate as any),
			bgVideosByTemplate: pruneMediaMap(bgVideosByTemplate as any),
			newsSolidBgBySlide,
			videoTrimStartSecBySlide,
			videoTrimEndSecBySlide,
			videoDurationBySlide,
			videoMutedBySlide,
			videoVolumeBySlide,
			videoSplitCompositedBySlide,
			textOffsetsBySlide,
			slideOverlaysByTemplate,
			slideTextOverlaysByTemplate,
			/** Canonical News structure (active slide + per-slide). Moves update via re-capture. */
			newsLayoutDocument:
				(slideTemplates[activeSlide] ?? lastTemplateUsed) === 'news'
					? captureLiveNewsLayoutDocument(activeSlide)
					: null,
			newsLayoutBySlide: slides.map((_, i) =>
				coerceTemplateId(slideTemplates[i] ?? '') === 'news'
					? captureLiveNewsLayoutDocument(i)
					: null,
			),
			stylesByTemplateBySlide,
			tweetStylesBySlide,
			tweetTopNameBySlide,
			tweetTopHandleBySlide,
			tweetBottomNameBySlide,
			tweetBottomHandleBySlide,
			tweetTopTextBySlide,
tweetBottomTextBySlide,
tweetTopImageHeightBySlide,
tweetTopImageWidthBySlide,
tweetTopImageZoomBySlide,
tweetTopImagePanXBySlide,
tweetTopImagePanYBySlide,
			tweetTopAvatarImageBySlide: tweetTopAvatarImageBySlide.map(pruneMediaUrl),
			tweetTopAvatarModeBySlide,
			tweetTopAvatarInnerBgBySlide,
			tweetTopAvatarLabelBySlide,
			tweetTopAvatarRingColorBySlide,
			tweetTopAvatarRingWidthBySlide,
			tweetBottomAvatarImageBySlide: tweetBottomAvatarImageBySlide.map(pruneMediaUrl),
			tweetBottomAvatarModeBySlide,
			tweetBottomAvatarInnerBgBySlide,
			tweetBottomAvatarLabelBySlide,
			tweetBottomAvatarRingColorBySlide,
			tweetBottomAvatarRingWidthBySlide,
			articleTextBySlide,
			newsSubtextBySlide,
			textCarouselTextBySlide,
			videoStoryHeadlineBySlide,
			videoStoryWatermarkBySlide,
			brandStackBrandBySlide,
			brandStackBottomMediaBySlide: brandStackBottomMediaBySlide.map(pruneMediaUrl),
			blackTextHeadlineBySlide,
			blackTextBodyBySlide,
			imageQuoteTextBySlide,
			textCarouselNameBySlide,
			textCarouselHandleBySlide,
			textCarouselAvatarImageBySlide: textCarouselAvatarImageBySlide.map(pruneMediaUrl),
			textCarouselAvatarModeBySlide,
			textCarouselAvatarInnerBgBySlide,
			textCarouselAvatarLabelBySlide,
			textCarouselAvatarRingColorBySlide,
			textCarouselAvatarRingWidthBySlide,
			imageQuoteFooterLeftBySlide,
			imageQuoteFooterRightBySlide,
			filmStripTopPctByTemplate,
			filmStripBottomPctByTemplate,
			articleSwipeTextBySlide,
			articleLogoSrcBySlide: articleLogoSrcBySlide.map(pruneMediaUrl),
			slideIds,
			subjectCutouts: subjectCutouts.map(pruneMediaUrl),
			showCutout,
			slideMusic,
			showCircleBySlide,
			circleImages: circleImages.map(pruneMediaUrl),
			circleBorderColor,
			circleShadow,
			showCircle2BySlide,
			circle2Images: circle2Images.map(pruneMediaUrl),
			circle2BorderColor,
			circle2Shadow,
			circleX,
			circleY,
			circleSize,
			circle2X,
			circle2Y,
			circle2Size,
			bgOffsetX,
			bgOffsetY,
			bgZoom,
			bgFitMode,
			bgContainMagnify,
			textPanelOffsetY,
			shadowHeight,
			shadowHeightBySlide,
			shadowStrength,
			shadowStrengthBySlide,
			shadowCurve,
			shadowCurveBySlide,
			shadowColor,
			shadowColorBySlide,
			shadowAutoFit,
			shadowAutoFitBySlide,
			highlightColor,
			highlightStyleKind,
			highlightGradientFrom,
			highlightGradientTo,
			highlightPattern,
			studioTextHighlightsEnabled,
			textColor,
			canvasBgDark,
			draftPreviewUrl,
			draftPreviewKey: draftPreviewKey.trim(),
			draftPreviewPath: draftPreviewKey.trim(),
			brandCtaEnabled,
			// Don’t persist `exportedSlides` (huge data URLs) in drafts — it makes restore slow.
			// We can always re-export when needed.
			exportedSlides: [],
		};
	}

	async function blobUrlToDataUrl(src: string): Promise<string> {
		const s = String(src ?? '').trim();
		if (!s.startsWith('blob:')) return s;
		try {
			const res = await fetch(s);
			const blob = await res.blob();
			return await new Promise<string>((resolve, reject) => {
				const fr = new FileReader();
				fr.onload = () => resolve(String(fr.result ?? ''));
				fr.onerror = () => reject(fr.error);
				fr.readAsDataURL(blob);
			});
		} catch {
			return '';
		}
	}

	function studioBlobMediaScan(): boolean {
		const blob = (s: unknown) => typeof s === 'string' && s.startsWith('blob:');
		for (const t of Object.keys(bgImagesByTemplate) as TemplateId[]) {
			for (const u of bgImagesByTemplate[t] ?? []) if (blob(u)) return true;
		}
		for (const t of Object.keys(bgVideosByTemplate) as TemplateId[]) {
			for (const u of bgVideosByTemplate[t] ?? []) if (blob(u)) return true;
		}
		for (const u of circleImages) if (blob(u)) return true;
		for (const u of circle2Images) if (blob(u)) return true;
		for (const u of subjectCutouts) if (blob(u)) return true;
		for (const u of tweetTopAvatarImageBySlide) if (blob(u)) return true;
		for (const u of tweetBottomAvatarImageBySlide) if (blob(u)) return true;
		for (const u of textCarouselAvatarImageBySlide) if (blob(u)) return true;
		for (const u of articleLogoSrcBySlide) if (blob(u)) return true;
		for (const key of Object.keys(slideOverlaysByTemplate) as TemplateId[]) {
			for (const slideRow of slideOverlaysByTemplate[key] ?? []) {
				for (const o of slideRow ?? []) if (blob(o?.src)) return true;
			}
		}
		return false;
	}

	/** Replace in-memory `blob:` media with data URLs so drafts survive reload (blobs are session-only). */
	async function materializeBlobUrlsForDraftSave() {
		if (!studioBlobMediaScan()) return;

		const mat = async (cur: string): Promise<string> => {
			if (!cur.startsWith('blob:')) return cur;
			const next = await blobUrlToDataUrl(cur);
			if (next && !next.startsWith('blob:')) {
				try {
					URL.revokeObjectURL(cur);
				} catch {
					// ignore
				}
				return next;
			}
			return cur;
		};

		const imgKeys = Object.keys(bgImagesByTemplate) as TemplateId[];
		const nextImg = { ...bgImagesByTemplate };
		for (const t of imgKeys) {
			const row = [...(nextImg[t] ?? [])];
			for (let i = 0; i < row.length; i++) {
				row[i] = await mat(row[i] ?? '');
			}
			nextImg[t] = row;
		}
		bgImagesByTemplate = nextImg;

		const vidKeys = Object.keys(bgVideosByTemplate) as TemplateId[];
		const nextVid = { ...bgVideosByTemplate };
		for (const t of vidKeys) {
			const row = [...(nextVid[t] ?? [])];
			for (let i = 0; i < row.length; i++) {
				row[i] = await mat(row[i] ?? '');
			}
			nextVid[t] = row;
		}
		bgVideosByTemplate = nextVid;

		let ci = [...circleImages];
		for (let i = 0; i < ci.length; i++) ci[i] = await mat(ci[i] ?? '');
		circleImages = ci;

		let c2 = [...circle2Images];
		for (let i = 0; i < c2.length; i++) c2[i] = await mat(c2[i] ?? '');
		circle2Images = c2;

		let sc = [...subjectCutouts];
		for (let i = 0; i < sc.length; i++) sc[i] = await mat(sc[i] ?? '');
		subjectCutouts = sc;

		let tTop = [...tweetTopAvatarImageBySlide];
		for (let i = 0; i < tTop.length; i++) tTop[i] = await mat(tTop[i] ?? '');
		tweetTopAvatarImageBySlide = tTop;

		let tBot = [...tweetBottomAvatarImageBySlide];
		for (let i = 0; i < tBot.length; i++) tBot[i] = await mat(tBot[i] ?? '');
		tweetBottomAvatarImageBySlide = tBot;

		let tcAv = [...textCarouselAvatarImageBySlide];
		for (let i = 0; i < tcAv.length; i++) tcAv[i] = await mat(tcAv[i] ?? '');
		textCarouselAvatarImageBySlide = tcAv;

		let logos = [...articleLogoSrcBySlide];
		for (let i = 0; i < logos.length; i++) logos[i] = await mat(logos[i] ?? '');
		articleLogoSrcBySlide = logos;

		const tplKeys = Object.keys(slideOverlaysByTemplate) as TemplateId[];
		const nextOver: Record<TemplateId, Overlay[][]> = { ...slideOverlaysByTemplate };
		for (const tpl of tplKeys) {
			const rows = slideOverlaysByTemplate[tpl] ?? [];
			const outRows: Overlay[][] = [];
			for (let s = 0; s < rows.length; s++) {
				const row = rows[s] ?? [];
				const out: Overlay[] = [];
				for (const o of row) {
					const src = o.src ?? '';
					if (src.startsWith('blob:')) {
						const nextSrc = await mat(src);
						out.push({ ...o, src: nextSrc });
					} else {
						out.push(o);
					}
				}
				outRows.push(out);
			}
			nextOver[tpl] = outRows;
		}
		slideOverlaysByTemplate = nextOver;
	}

	// Rendered PNGs (data URLs) of each slide's final template output
	let exportedSlides = $state<string[]>([]);

	type SaveDraftNowOpts = {
		captureThumbnail?: boolean;
		/** Prefer this PNG (e.g. just-exported slide 0) — avoids re-raster while `exportingAll` is true. */
		thumbnailDataUrl?: string;
	};

	/** Persist workspace draft (`news_studio`) — used by export / resume, not a manual Save draft button. */
	async function saveDraftNow(opts?: SaveDraftNowOpts) {
		let uid = String(userId ?? '').trim();
		try {
			if (!uid) uid = await ensureStudioAuthUserId();
		} catch {
			return;
		}
		const captureThumbnail = opts?.captureThumbnail === true;
		const providedThumb = String(opts?.thumbnailDataUrl ?? '').trim();
		draftSaving = true;
		draftError = '';
		try {
			await materializeBlobUrlsForDraftSave();

			const rowId = String(draftId ?? '').trim() || crypto.randomUUID();
			const isUpdate = !!String(draftId ?? '').trim();
			let nextPreviewUrl = draftPreviewUrl;
			let nextPreviewKey = draftPreviewKey;
			if (captureThumbnail) {
				try {
					const thumbDataUrl =
						providedThumb.startsWith('data:image/')
							? providedThumb
							: await captureDraftThumbnailDataUrl();
					if (thumbDataUrl) {
						const key = `${uid}/${rowId}.png`;
						const blob = await (await fetch(thumbDataUrl)).blob();
						await r2UploadBlob({ key, blob, filename: 'draft-thumb.png' });
						nextPreviewUrl = '';
						nextPreviewKey = key;
					} else if (!isUpdate) {
						// New workspace row — never inherit another draft/template's preview key.
						nextPreviewUrl = '';
						nextPreviewKey = '';
					}
				} catch {
					if (!isUpdate) {
						nextPreviewUrl = '';
						nextPreviewKey = '';
					}
					// Keep previous draftPreviewUrl / draftPreviewKey on update if capture/upload fails.
				}
			}
			draftPreviewUrl = nextPreviewUrl;
			draftPreviewKey = nextPreviewKey;

			// Keep media in state long enough to upload to R2 (draft prune would strip cutouts first).
			let state: Record<string, any> = { ...buildDraftState('template') };
			const touchedAt = new Date().toISOString();

			// Ensure a row exists before R2 rewrite (needs a stable id).
			if (!isUpdate) {
				const { data, error } = await (supabase as any)
					.from('drafts')
					.insert({
						id: rowId,
						user_id: uid,
						kind: DRAFT_KIND,
						state: {
							formatId: state.formatId,
							slides: state.slides,
							slideTemplates: state.slideTemplates,
							draftPreviewKey: nextPreviewKey,
							draftPreviewPath: nextPreviewKey,
							_saving: true,
						},
					})
					.select('id')
					.single();
				if (error) {
					draftError = error.message ?? 'Failed to save draft';
					return;
				}
				if (data?.id) draftId = String(data.id);
			}

			try {
				state = await uploadTemplateMediaToR2AndRewriteState(rowId, state, { folder: 'drafts' });
			} catch (e: unknown) {
				console.warn('Draft R2 media upload failed:', e);
				// Never fall back to embedding base64 in Postgres — keep text/layout only.
				state = stripEmbeddedMediaFromDraftState(buildDraftState('draft'));
			}

			state = stripEmbeddedMediaFromDraftState(state);

			const { error: writeErr } = await (supabase as any)
				.from('drafts')
				.update({ state, updated_at: touchedAt })
				.eq('id', rowId)
				.eq('user_id', uid)
				.eq('kind', DRAFT_KIND);
			if (writeErr) {
				draftError = writeErr.message ?? 'Failed to save draft';
				return;
			}

			if (!draftId) draftId = rowId;
		} catch (e: unknown) {
			draftError = e instanceof Error ? e.message : 'Failed to save draft';
		} finally {
			draftSaving = false;
		}
	}

	function closeLeavePrompt() {
		leavePromptOpen = false;
		pendingLeaveHref = '';
		leaveSaveError = '';
		leaveSaveBusy = false;
	}

	function stayOnStudio() {
		closeLeavePrompt();
	}

	function discardAndLeave() {
		const href = pendingLeaveHref || '/dashboard/carousels';
		allowStudioLeave = true;
		studioHasUnsavedChanges = false;
		leavePromptOpen = false;
		pendingLeaveHref = '';
		void goto(href);
	}

	async function saveTemplateAndLeave() {
		if (leaveSaveBusy) return;
		const name = leaveSaveName.trim();
		if (!name) {
			leaveSaveError = 'Enter a template name to save.';
			return;
		}
		leaveSaveBusy = true;
		leaveSaveError = '';
		try {
			const href = pendingLeaveHref || '/dashboard/carousels';
			await saveStudioTemplateNamed(name, { leaveAfter: true, leaveHref: href });
			closeLeavePrompt();
		} catch (e: unknown) {
			leaveSaveError = e instanceof Error ? e.message : 'Could not save template';
			leaveSaveBusy = false;
		}
	}

	// Prompt chips use fixed defaults on load — not persisted across reloads.
	// ── Auth ──────────────────────────────────────────────────────────────
	onMount(async () => {
		applyStudioComposePrefs(loadStudioComposePrefs());

		const { data: { user } } = await supabase.auth.getUser();
		if (!user) { goto('/login'); return; }
		userId = user.id;
		refreshPromptHistory();
		void refreshStudioUsage();
		void refreshSavedStudioTemplates();
		await loadAccountTemplateOverrides();
		const kit = await hydrateBrandKit(user.id);
		const profile = brandProfile(kit);
		brandDisplayName = profile.name;
		brandHandle = profile.handle;
		applyBrandProfileToSlides(profile.name, profile.handle);
		brandCta = kit.cta?.headline || kit.cta?.image ? kit.cta : loadBrandCta(user.id);
		applyNewsSourceChromeFromKit(kit);
		if (isPlaceholderNewsSource(source)) source = defaultNewsSource();
		if (kit.highlightColor) highlightColor = kit.highlightColor;
		highlightStyleKind = normalizeHighlightStyleKind(kit.highlightStyleKind);
		if (kit.highlightPattern) highlightPattern = kit.highlightPattern;
		if (kit.highlightGradientFrom) highlightGradientFrom = kit.highlightGradientFrom;
		if (kit.highlightGradientTo) highlightGradientTo = kit.highlightGradientTo;
		brandTextBgColor = kit.textBgColor ?? '';
		if (brandTextBgColor && sourceLabelMode !== 'logo') {
			patchNewsSourceStyle({ bgColor: brandTextBgColor });
		}
		studioTextHighlightsEnabled = kit.textHighlightsEnabled !== false;
		draftRestoring = true;
		const sp = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
		const savedParam = sp?.get('saved') ?? null;
		const draftParam = sp?.get('draft') ?? null;
		const fromBulkParam = sp?.get('from') === 'bulk' || !!peekBulkImport();
		const loadPromise =
			savedParam && /^[0-9a-f-]{36}$/i.test(savedParam)
				? loadSavedStudioTemplate(savedParam)
				: draftParam && /^[0-9a-f-]{36}$/i.test(draftParam)
					? loadDraftById(draftParam)
					: Promise.resolve();
		// Never restore the latest `news_studio` autosave — Studio only persists via Save template.
		void loadPromise
			.catch(() => {
				// loaders set draftError; swallow to keep UI responsive.
			})
			.finally(() => {
				void (async () => {
					await flushStudioLoadingPaint();
					try {
						const bulkState = takeBulkImport();
						if (bulkState) {
							applyBlankCanvas();
							applyDraftState(bulkState);
							slideCount = Math.max(1, slides.length);
							brandCtaEnabled = false;
							editingBrandCta = false;
							const capsList = Array.isArray(bulkState._studioCaptionsBySlide)
								? (bulkState._studioCaptionsBySlide as (StudioClipCaptionImport | null)[])
								: [];
							bulkCaptionsBySlide = capsList;
							applyStudioCaptionsPayload(capsList[activeSlide] ?? capsList[0] ?? null);
							// applyBlankCanvas() zeroes the News shadow; restore it for News decks.
							if (slideTemplates.some((t) => coerceTemplateId(t) === 'news')) {
								padShadowBySlide();
								let needs = false;
								for (let i = 0; i < slides.length; i++) {
									if (shadowHeightAt(i) === 0 || shadowStrengthAt(i) === 0) {
										needs = true;
										break;
									}
								}
								if (needs) {
									resetAllShadows({
										height: NEWS_DEFAULT_LAYOUT.shadowHeight,
										strength: NEWS_DEFAULT_LAYOUT.shadowStrength,
										curve: NEWS_DEFAULT_LAYOUT.shadowCurve,
										autoFit: true,
									});
								}
							}
							return;
						}
						const clipPending =
							!!pendingClipImport ||
							(typeof window !== 'undefined' &&
								new URLSearchParams(window.location.search).get('from') === 'clip') ||
							!!peekStudioClipImport();
						if (tryApplyPendingClipImport()) {
							// Video clip import from Videos page applied
						} else if (clipImportApplied || clipPending) {
							// Clip import in progress / already applied — never wipe with blank starter
						} else if (forcedBlankFromQuery) {
							applyBlankCanvas();
						} else if (skipLatestWorkspaceDraftRestore && forcedTemplateFromQuery) {
							// Fresh session from template carousel / `?template=` — never overlay last autosave.
							openFreshTemplateStarter(forcedTemplateFromQuery);
						} else if (!studioDraftWasRestored && !freshStarterApplied) {
							// No autosave / draft — seed the default News starter (not SSR pre-hydrate leftovers).
							openFreshTemplateStarter('news');
						}
						// Do not auto-generate the circle badge here — leave it empty until the user uploads or runs Circle AI.
					} finally {
						// Clear only after starter/draft mutations so the boot skeleton covers one continuous pass.
						// Brand kit owns highlight on/off — drafts must not leave it flipped.
						studioTextHighlightsEnabled = kit.textHighlightsEnabled !== false;
						/* Always reset prompt chips to fixed defaults (not last-session / draft chips). */
						{
							const deckLen = Math.max(1, slides.length);
							applyStudioComposePrefs(loadStudioComposePrefs());
							if (studioDraftWasRestored) {
								slideCount = Math.max(1, Math.min(MAX_STUDIO_SLIDE_COUNT, deckLen));
							}
						}
						draftRestoring = false;
						draftLoaded = true;
						studioHasUnsavedChanges = false;
						allowStudioLeave = false;
						forceUnlockStudioUI();
					}
				})();
			});
	});

	$effect(() => {
		if (typeof window === 'undefined') return;
		const onBrandKit = (ev: Event) => {
			const kit = (ev as CustomEvent).detail;
			const p = brandProfile(kit);
			if (p.name) {
				brandDisplayName = p.name;
				brandHandle = p.handle;
				applyBrandProfileToSlides(p.name, p.handle);
			}
			const nextHi = String(kit?.highlightColor ?? '').trim();
			if (nextHi) highlightColor = nextHi;
			if (kit?.highlightStyleKind) {
				highlightStyleKind = normalizeHighlightStyleKind(kit.highlightStyleKind);
			}
			if (kit?.highlightPattern) highlightPattern = String(kit.highlightPattern);
			if (kit?.highlightGradientFrom) highlightGradientFrom = String(kit.highlightGradientFrom);
			if (kit?.highlightGradientTo) highlightGradientTo = String(kit.highlightGradientTo);
			if ('textBgColor' in (kit ?? {})) {
				const nextBg = normalizeTextBgHex(String(kit?.textBgColor ?? ''));
				brandTextBgColor = nextBg;
				/* Only apply a concrete chip in text mode. Empty must not clear canvas — chrome/offset
				   saves can still fire this event with a stale empty brand textBgColor. */
				if (nextBg && sourceLabelMode !== 'logo') patchNewsSourceStyle({ bgColor: nextBg });
			}
			if (kit && typeof kit.textHighlightsEnabled === 'boolean') {
				studioTextHighlightsEnabled = kit.textHighlightsEnabled;
			}
			if (kit) {
				/* Don't clobber logo position / size from a saved News override or open deck. */
				const preserveNews =
					!!resolveTemplateOverride('news') || studioDraftWasRestored;
				applyNewsSourceChromeFromKit(kit, {
					preserveOffsets: preserveNews,
					preserveWidth: preserveNews,
					preservePlate: preserveNews,
				});
			}
		};
		window.addEventListener(BRAND_KIT_UPDATED_EVENT, onBrandKit);
		return () => window.removeEventListener(BRAND_KIT_UPDATED_EVENT, onBrandKit);
	});

	// ── Categories ────────────────────────────────────────────────────────
	const categories = [
		{ id: 'general', label: 'General' },
		{ id: 'business', label: 'Business' },
		{ id: 'tech', label: 'Tech' },
		{ id: 'finance', label: 'Finance' },
		{ id: 'politics', label: 'Politics' },
		{ id: 'health', label: 'Health' },
		{ id: 'science', label: 'Science' },
		{ id: 'sports', label: 'Sports' },
		{ id: 'entertainment', label: 'Entertainment' },
	];

	const sourceLabels: Record<string, string> = {
		business: 'Markets',
		tech: 'Tech',
		finance: 'Finance',
		politics: 'Politics',
		health: 'Health',
		science: 'Science',
		sports: 'Sports',
		entertainment: 'Culture',
		general: 'News',
	};

	const factTopics = [
		{ id: 'any',           label: 'Any' },
		{ id: 'business',      label: 'Business' },
		{ id: 'tech',          label: 'Technology' },
		{ id: 'science',       label: 'Science' },
		{ id: 'health',        label: 'Health' },
		{ id: 'history',       label: 'History' },
		{ id: 'nature',        label: 'Nature' },
		{ id: 'space',         label: 'Space' },
		{ id: 'finance',       label: 'Finance' },
		{ id: 'psychology',    label: 'Psychology' },
		{ id: 'culture',       label: 'Culture' },
		{ id: 'sports',        label: 'Sports' },
		{ id: 'food',          label: 'Food' },
		{ id: 'environment',   label: 'Environment' },
		{ id: 'education',     label: 'Education' },
	];

	const storyThemes = [
		{ id: 'health', label: 'Health' },
		{ id: 'wealth', label: 'Wealth' },
		{ id: 'relationships', label: 'Relationships' },
		{ id: 'career', label: 'Career' },
		{ id: 'mindset', label: 'Mindset' },
		{ id: 'productivity', label: 'Productivity' },
		{ id: 'fitness', label: 'Fitness' },
		{ id: 'money', label: 'Money' },
	] as const;

	/** Strip highlight markers for prompts / previews. */
	function stripHighlightMarkers(s: string) {
		return String(s ?? '').replace(/\[\[|\]\]/g, '').trim();
	}

	/** Top + bottom tweet identity rows (name, handle, avatar initials). */
	function ensureTweetSlideProfileDefaults(idx: number) {
		if (!String(tweetTopNameBySlide[idx] ?? '').trim()) {
			tweetTopNameBySlide = tweetTopNameBySlide.map((x, i) => (i === idx ? TWEET_DEFAULTS.topName : x));
		}
		if (!String(tweetTopHandleBySlide[idx] ?? '').trim()) {
			tweetTopHandleBySlide = tweetTopHandleBySlide.map((x, i) => (i === idx ? TWEET_DEFAULTS.topHandle : x));
		}
		if (!String(tweetBottomNameBySlide[idx] ?? '').trim()) {
			tweetBottomNameBySlide = tweetBottomNameBySlide.map((x, i) => (i === idx ? TWEET_DEFAULTS.bottomName : x));
		}
		if (!String(tweetBottomHandleBySlide[idx] ?? '').trim()) {
			tweetBottomHandleBySlide = tweetBottomHandleBySlide.map((x, i) => (i === idx ? TWEET_DEFAULTS.bottomHandle : x));
		}
		if (!String(tweetBottomTextBySlide[idx] ?? '').trim()) {
			tweetBottomTextBySlide = tweetBottomTextBySlide.map((x, i) =>
				i === idx ? TWEET_DEFAULTS.bottomText : x,
			);
		}
	}

	/** Primary on-slide copy per template (for Vertex prompts). */
	function primarySlideTextForPrompt(template: TemplateId, i: number): string {
		switch (template) {
			case 'tweet':
				return stripHighlightMarkers(tweetTopTextBySlide[i] ?? '');
			case 'article':
				return stripHighlightMarkers(articleTextBySlide[i] ?? '');
			case 'textCarousel':
				return stripHighlightMarkers(textCarouselTextBySlide[i] ?? '');
			case 'imageQuote':
				return stripHighlightMarkers(imageQuoteTextBySlide[i] ?? '');
			case 'videoStory':
				return stripHighlightMarkers(videoStoryHeadlineBySlide[i] ?? '');
			case 'blackText':
				return stripHighlightMarkers(blackTextHeadlineBySlide[i] ?? '');
			default:
				return stripHighlightMarkers(slides[i] ?? '');
		}
	}

	/** Plain-text length caps for API/mock “load story” fills (fixed-size templates). */
	const FETCH_TEXT_CLIP = {
		news: 420,
		/** Supporting paragraph under the News headline — full sentences only, no ellipsis. */
		newsSubtext: 220,
		/** Main tweet body above media (~3–4 lines at default size in a 9:16 card). */
		tweetTop: 230,
		/** Reply punchline under media (one tight beat). */
		tweetReply: 160,
		article: 520,
		/** Long-form carousel body from APIs (OpenRouter, etc.); paragraphs preserved in clamp. */
		textCarousel: 6000,
		imageQuote: 180,
		videoStory: 320,
		videoFit: 320,
		videoSplit: 48,
		videoBlur: 320,
		videoHook: 90,
		videoCreator: 320,
		videoText: 320,
		videoSource: 90,
		videoFeature: 320,
		videoPost: 320,
		brandStack: 320,
		blackText: 200,
		photoTopic: 200,
		photoCaption: 200,
		whiteThread: 200,
		whiteMedia: 200,
		/** Black text template: long body under the hook line (separate from hook clamp). */
		blackTextBody: 1100,
	} as const;

	/** Article hero image is only seeded for templates built around full-bleed / top media. */
	function templateAcceptsArticleHeroBackground(t: TemplateId): boolean {
		return t === 'news' || t === 'article' || t === 'imageQuote' || t === 'tweet';
	}

	/**
	 * Fit copy to a char budget without ellipsis.
	 * Prefer complete sentences; else cut on a word boundary. Never mid-word + "…".
	 * When `preserveMarkup` is set, keep `[[…]]` tokens whenever the plain length fits;
	 * if truncated, fall back to plain (markup offsets are no longer valid).
	 */
	function clampFetchedPlainLength(text: string, maxLen: number, preserveMarkup = false): string {
		const raw = stripEmDashes(String(text ?? '').trim());
		if (!maxLen) return '';
		const plain = stripHighlightMarkers(raw).replace(/\s+/g, ' ').trim();
		if (plain.length <= maxLen) return preserveMarkup ? raw : plain;
		const fitted = clampToCompleteSentences(plain, maxLen);
		return fitted;
	}

	/** Word/char budgets for the News body under the headline (respect Short/Standard/Default). */
	function newsSubtextBudget(previous?: string): {
		maxChars: number;
		maxWords: number;
		maxSentences: number;
	} {
		if (newsCopyLength === 'short') return { maxChars: 140, maxWords: 18, maxSentences: 1 };
		if (newsCopyLength === 'standard') return { maxChars: 160, maxWords: 26, maxSentences: 2 };
		/* Default = SoftBank paragraph length — do not inflate from a previous overlong generate. */
		const placeholderWords = countPlainWords(NEWS_DEFAULT_SUBTEXT) || 24;
		const w = Math.max(6, Math.min(80, studioBodyMaxWords || placeholderWords));
		const placeholderSentences = splitPlainSentences(NEWS_DEFAULT_SUBTEXT).length || 2;
		void previous;
		return {
			maxChars: Math.max(140, Math.min(320, w * 7)),
			maxWords: w,
			maxSentences: Math.max(1, Math.min(2, placeholderSentences)),
		};
	}

	/** News supporting paragraph under the headline — full sentences only, never ellipsis.
	 *  Paragraphs stay plain: auto-highlights belong on headlines only. */
	function clampNewsSubtext(text: string, maxLen?: number, previous?: string): string {
		const lenBudget = newsSubtextBudget(previous);
		const layoutCap = captureLiveNewsLayoutDocument(activeSlide).slotBudgets?.subtextMaxChars;
		const budget =
			maxLen ??
			(typeof layoutCap === 'number' && layoutCap > 0 ? layoutCap : lenBudget.maxChars);
		const plain = stripMarkup(stripEmDashes(String(text ?? '').trim()))
			.replace(/\u2026/g, '')
			.replace(/\.\.\.$/g, '')
			.replace(/\s+/g, ' ')
			.trim();
		if (!plain) return '';
		const charCap = Math.max(60, Math.min(budget, lenBudget.maxChars));
		const minWords = newsCopyLength === 'short' ? 8 : 10;

		const finish = (candidate: string): string => {
			let out = clampToCompleteSentences(candidate, charCap);
			out = clampToCompleteWords(out, lenBudget.maxWords);
			if (lenBudget.maxSentences <= 1) {
				const parts = splitIntoSentences(out);
				if (parts[0] && !isIncompleteOverlayCopy(parts[0], minWords)) out = parts[0]!;
				else if (parts.length >= 2) out = parts.slice(0, 2).join(' ').trim();
			} else {
				const parts = splitIntoSentences(out);
				if (parts.length) {
					out = parts.slice(0, lenBudget.maxSentences).join(' ').trim();
				}
			}
			return ensureCompleteThought(out);
		};

		let out = finish(plain);
		/* Stub ledes ("Domestic cats share 95.") — widen the window before shipping. */
		if (isIncompleteOverlayCopy(out, minWords)) {
			const sentences = splitIntoSentences(plain);
			for (let n = 2; n <= Math.min(3, sentences.length); n++) {
				const wider = finish(sentences.slice(0, n).join(' '));
				if (!isIncompleteOverlayCopy(wider, minWords)) {
					out = wider;
					break;
				}
			}
			if (isIncompleteOverlayCopy(out, minWords) && sentences.length) {
				const best = sentences.find((s) => !isIncompleteOverlayCopy(s, minWords));
				if (best) out = finish(best);
			}
		}
		return out;
	}

	function splitPlainSentences(text: string): string[] {
		return splitIntoSentences(text);
	}

	/**
	 * Pick an on-canvas News paragraph from the long context bible.
	 * Default mode matches the previous copy’s sentence/word length so regenerates
	 * don’t collapse a 2-sentence lede into a stub.
	 */
	function isNewsMetaSentence(s: string): boolean {
		const t = s.trim();
		if (!t) return true;
		if (/^you asked for:/i.test(t)) return true;
		if (/^slide \d+ hooks/i.test(t)) return true;
		if (/variation \d+/i.test(t)) return true;
		if (/later slides unpack/i.test(t)) return true;
		return false;
	}

	function pickNewsSubtext(opts: {
		body: string;
		headline?: string;
		previous?: string;
		slideIndex?: number;
	}): string {
		const body = stripMarkup(String(opts.body ?? '').trim());
		if (!body) return '';
		const sentences = splitPlainSentences(body).filter((s) => !isNewsMetaSentence(s));
		if (!sentences.length) return clampNewsSubtext(body, undefined, opts.previous);

		const prev = String(opts.previous ?? '').trim();
		const prevLow = prev.toLowerCase();
		const prevSentences = splitPlainSentences(prev);
		const budget = newsSubtextBudget(prev);
		const wantSentences =
			newsCopyLength === 'default' && prevSentences.length > 0
				? Math.min(budget.maxSentences, Math.max(1, prevSentences.length))
				: newsCopyLength === 'short'
					? 1
					: Math.min(budget.maxSentences, Math.max(1, Math.min(2, sentences.length)));

		const headline = stripHighlightMarkers(String(opts.headline ?? ''))
			.replace(/\s+/g, ' ')
			.trim()
			.toLowerCase();
		const slideIndex = Math.max(0, Math.floor(opts.slideIndex ?? 0));

		type Window = { text: string; score: number; start: number };
		const windows: Window[] = [];
		for (let start = 0; start < sentences.length; start++) {
			const end = Math.min(sentences.length, start + wantSentences);
			const chunk = sentences.slice(start, end).join(' ').trim();
			if (!chunk) continue;
			const clamped = clampNewsSubtext(chunk, undefined, prev);
			if (!clamped) continue;
			const low = clamped.toLowerCase();
			let score = start; // slight preference for earlier beats
			if (
				prevLow &&
				(low === prevLow ||
					prevLow.startsWith(low.slice(0, 36)) ||
					low.startsWith(prevLow.slice(0, 36)))
			) {
				score += 200;
			}
			if (headline) {
				const h = headline.slice(0, 28);
				if (h.length >= 8 && (low.includes(h) || headline.includes(low.slice(0, 28)))) score += 80;
			}
			/* Prefer windows whose word count is close to the previous lede. */
			if (newsCopyLength === 'default' && prevSentences.length > 0) {
				const prevW = countPlainWords(prev);
				const curW = countPlainWords(clamped);
				score += Math.abs(curW - prevW) * 2;
				const curS = splitPlainSentences(clamped).length;
				if (curS < wantSentences) score += 40;
			}
			score += Math.abs(start - Math.min(slideIndex, Math.max(0, sentences.length - wantSentences))) * 3;
			windows.push({ text: clamped, score, start });
		}
		if (!windows.length) return clampNewsSubtext(sentences[0]!, undefined, prev);

		windows.sort((a, b) => a.score - b.score || a.start - b.start);
		let chosen = windows[0]!.text;
		if (prevLow && chosen.toLowerCase() === prevLow) {
			const alt = windows.find((x) => x.text.toLowerCase() !== prevLow);
			if (alt) chosen = alt.text;
			else return '';
		}
		return chosen;
	}

	/**
	 * Split the article/body across N News slides so each slide gets its own beat —
	 * never dump the whole lede onto slide 0 only.
	 */
	function distributeNewsSubtextAcrossSlides(
		body: string,
		headlines: string[],
		count: number,
	): string[] {
		const n = Math.max(1, count);
		const source = stripMarkup(String(body ?? '').trim());
		if (!source) return Array.from({ length: n }, () => '');

		const sentences = splitPlainSentences(source).filter(
			(s) => !isNewsMetaSentence(s) && !isIncompleteOverlayCopy(s, 6),
		);
		if (!sentences.length) {
			const fallback = splitPlainSentences(source).filter((s) => !isNewsMetaSentence(s));
			const one = clampNewsSubtext(fallback.join(' ') || source, undefined, '');
			/* Never stamp the same lede on every slide — only slide 0 gets the stub. */
			return Array.from({ length: n }, (_, i) => (i === 0 ? one : ''));
		}

		if (n === 1) {
			return [
				pickNewsSubtext({
					body: source,
					headline: headlines[0] ?? '',
					previous: '',
					slideIndex: 0,
				}),
			];
		}

		const buckets: string[][] = Array.from({ length: n }, () => []);
		if (sentences.length >= n) {
			for (let i = 0; i < n; i++) {
				const start = Math.floor((i * sentences.length) / n);
				const end = Math.floor(((i + 1) * sentences.length) / n);
				buckets[i] = sentences.slice(start, Math.max(start + 1, end));
			}
		} else {
			for (let i = 0; i < sentences.length; i++) buckets[i] = [sentences[i]!];
		}

		const out: string[] = [];
		const used = new Set<string>();
		for (let i = 0; i < n; i++) {
			const chunk = buckets[i]!.join(' ').trim();
			if (chunk) {
				const clamped = clampNewsSubtext(chunk, undefined, chunk) || chunk;
				const key = clamped.toLowerCase();
				if (!used.has(key)) {
					used.add(key);
					out.push(clamped);
					continue;
				}
			}
			const picked = pickNewsSubtext({
				body: source,
				headline: headlines[i] ?? '',
				previous: out.filter(Boolean).join(' '),
				slideIndex: i,
			});
			const pickKey = picked.toLowerCase();
			if (picked && !used.has(pickKey)) {
				used.add(pickKey);
				out.push(picked);
			} else {
				out.push('');
			}
		}
		return out;
	}

	/** Write distributed News paragraphs onto `newsSubtextBySlide` for the given slide indexes. */
	function applyDistributedNewsSubtexts(body: string, newsSlideIndexes?: number[]) {
		const source = String(body ?? '').trim();
		const n = Math.max(1, slides.length);
		const idxs = (newsSlideIndexes?.length
			? [...newsSlideIndexes]
			: Array.from({ length: n }, (_, i) => i)
		)
			.filter((i) => i >= 0 && i < n)
			.sort((a, b) => a - b);
		if (!idxs.length) return;

		while (newsSubtextBySlide.length < n) {
			newsSubtextBySlide = [...newsSubtextBySlide, ''];
		}

		if (!source) {
			newsSubtextBySlide = newsSubtextBySlide.map((x, i) => (idxs.includes(i) ? '' : x));
			return;
		}

		const headlines = idxs.map((i) => String(slides[i] ?? '').trim());
		const parts = distributeNewsSubtextAcrossSlides(source, headlines, idxs.length);
		newsSubtextBySlide = Array.from({ length: Math.max(n, newsSubtextBySlide.length) }, (_, i) => {
			const j = idxs.indexOf(i);
			if (j >= 0) return parts[j] ?? '';
			return newsSubtextBySlide[i] ?? '';
		});
	}

	/** Text carousel: respect Studio Short/Standard/Default word budget. */
	function clampFetchedTextCarouselBody(text: string, _maxLen: number, opts?: { padToMin?: boolean }): string {
		const raw = stripEmDashes(String(text ?? '').trim());
		if (!raw) return opts?.padToMin && newsCopyLength === 'default' ? ensureTextCarouselBodyMinLength('') : '';
		const budget = textCarouselBudgetFromMaxWords(studioBodyMaxWords);
		const s = fitTextCarouselBodyToCanvas(stripHighlightMarkers(raw), {
			randomizeParagraphCount: false,
			maxParagraphs: budget.paragraphCount,
			maxWordsTotal: budget.maxWordsTotal,
		});
		// Never pad Short/Standard — min-length filler fights the word chip.
		const padToMin = (opts?.padToMin ?? false) && newsCopyLength === 'default';
		return padToMin ? ensureTextCarouselBodyMinLength(s) : s;
	}

	async function fetchTextCarouselBody(opts: {
		text: string;
		angle?: string;
		paragraphCount?: number;
		slideIndex?: number;
		slideCount?: number;
	}): Promise<string> {
		const budget = textCarouselBudgetFromMaxWords(studioBodyMaxWords);
		const paragraphCount =
			typeof opts.paragraphCount === 'number' && opts.paragraphCount >= 1 && opts.paragraphCount <= 3
				? opts.paragraphCount
				: budget.paragraphCount;
		const res = await fetch('/api/news/text-carousel-body', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				title: articleTitle,
				text: opts.text,
				sourceUrl: articleUrl,
				angle: opts.angle?.trim() || undefined,
				paragraphCount,
				maxWords: budget.maxWordsTotal,
				slideIndex: opts.slideIndex,
				slideCount: opts.slideCount,
				studioRegenAt: Date.now(),
			}),
		});
		const data = await res.json();
		if (!res.ok) throw new Error(data.error ?? 'Text carousel generation failed');
		return fitTextCarouselBodyToCanvas(String(data.body ?? ''), {
			randomizeParagraphCount: false,
			maxParagraphs: paragraphCount,
			maxWordsTotal: budget.maxWordsTotal,
		});
	}

	/**
	 * Fill long-body templates (text carousel / white posts) from Hook → content beats.
	 * Each slide gets its own beat — Short stays punchy (no paragraph expand); Default expands.
	 */
	async function fillTextCarouselDeck(
		hookText: string,
		rawText: string,
		count: number,
		template: TemplateId = 'textCarousel',
	) {
		const n = Math.max(1, count);
		const source = String(rawText || articleSnippet || articleTitle || '').trim();
		const budget = textCarouselBudgetFromMaxWords(studioBodyMaxWords);
		const { copyStrings: beats } = await fetchDeckStoryBeats(hookText, rawText, n, {
			autoHighlight: studioTextHighlightsEnabled,
			includeBodies: false,
		});
		const beatFor = (i: number) => String(beats[i] ?? (i === 0 ? hookText : source));
		// Short: put the beat on the card — expanding into "airy paragraphs" fights the word chip.
		if (newsCopyLength === 'short' || budget.paragraphCount <= 1) {
			const bodies = Array.from({ length: n }, (_, i) =>
				studioTextHighlightsEnabled
					? beatFor(i)
					: clampFetchedTextCarouselBody(beatFor(i), FETCH_TEXT_CLIP.textCarousel),
			);
			applyHeadlineStringsToTemplate(template, bodies);
			return;
		}
		const bodies = await Promise.all(
			Array.from({ length: n }, (_, i) =>
				fetchTextCarouselBody({
					text: source,
					angle: beats[i] ?? (i === 0 ? hookText : source),
					slideIndex: i,
					slideCount: n,
					paragraphCount: budget.paragraphCount,
				})
					.then((expanded) =>
						studioTextHighlightsEnabled
							? reapplyHighlightPhrases(expanded, beatFor(i))
							: expanded,
					)
					.catch(() =>
						studioTextHighlightsEnabled
							? beatFor(i)
							: clampFetchedTextCarouselBody(beatFor(i), FETCH_TEXT_CLIP.textCarousel),
					),
			),
		);
		applyHeadlineStringsToTemplate(template, bodies);
	}

	/** Tweet main post: keep short enough to sit above media without crowding the card. */
	function clampTweetTopFetched(text: string): string {
		return clampFetchedPlainLength(text, FETCH_TEXT_CLIP.tweetTop, studioTextHighlightsEnabled);
	}

	/** Reply under the media — slightly shorter punchline / reaction. */
	function clampTweetReplyFetched(text: string): string {
		return clampFetchedPlainLength(text, FETCH_TEXT_CLIP.tweetReply, studioTextHighlightsEnabled);
	}

	function normalizeTweetReplies(replies: string[], count: number): string[] {
		const n = Math.max(1, count);
		const fallback = TWEET_DEFAULTS.bottomText;
		const cleaned = (replies ?? [])
			.map((r) => clampTweetReplyFetched(String(r ?? '').trim()))
			.filter(Boolean);
		if (!cleaned.length) {
			return Array.from({ length: n }, () => fallback);
		}
		const out = [...cleaned];
		while (out.length < n) out.push(out[out.length - 1] ?? fallback);
		return out.slice(0, n);
	}

	function applyTweetReplyStrings(replies: string[]) {
		const n = Math.max(1, slides.length, replies.length);
		const next = normalizeTweetReplies(replies, n);
		tweetBottomTextBySlide = Array.from({ length: n }, (_, i) => next[i] ?? TWEET_DEFAULTS.bottomText);
	}

	function clampFetchedPrimaryForTemplate(template: TemplateId, text: string): string {
		const raw = String(text ?? '').trim();
		const preserveMarkup = studioTextHighlightsEnabled;
		if (isPhotoStoryFamily(template) || template === 'blackText') {
			return clampFetchedPlainLength(raw, FETCH_TEXT_CLIP.blackText, preserveMarkup);
		}
		if (isWhitePostFamily(template)) {
			if (preserveMarkup && raw.includes('[[')) {
				return clampFetchedPlainLength(raw, FETCH_TEXT_CLIP.textCarousel, true);
			}
			return clampFetchedTextCarouselBody(raw, FETCH_TEXT_CLIP.textCarousel);
		}
		if (isVideoStoryFamily(template)) {
			const key = template as keyof typeof FETCH_TEXT_CLIP;
			const cap =
				typeof FETCH_TEXT_CLIP[key] === 'number'
					? (FETCH_TEXT_CLIP[key] as number)
					: FETCH_TEXT_CLIP.videoStory;
			return clampFetchedPlainLength(raw, cap, preserveMarkup);
		}
		switch (template) {
			case 'tweet':
				return clampTweetTopFetched(raw);
			case 'article':
				return clampFetchedPlainLength(raw, FETCH_TEXT_CLIP.article, preserveMarkup);
			case 'textCarousel':
				if (preserveMarkup && raw.includes('[[')) {
					return clampFetchedPlainLength(raw, FETCH_TEXT_CLIP.textCarousel, true);
				}
				return clampFetchedTextCarouselBody(raw, FETCH_TEXT_CLIP.textCarousel);
			case 'imageQuote':
				return clampFetchedPlainLength(raw, FETCH_TEXT_CLIP.imageQuote, preserveMarkup);
			case 'brandStack':
				return clampFetchedPlainLength(raw, FETCH_TEXT_CLIP.brandStack, preserveMarkup);
			case 'news': {
				const byChars = clampFetchedPlainLength(raw, FETCH_TEXT_CLIP.news, preserveMarkup);
				/* Enforce Default/Short/Standard word chip — char clip alone was far too loose. */
				const plain = stripHighlightMarkers(byChars).replace(/\s+/g, ' ').trim();
				const wordClamped = clampToCompleteWords(plain, studioHeadlineMaxWords);
				if (preserveMarkup && byChars.includes('[[') && countPlainWords(plain) <= studioHeadlineMaxWords) {
					return byChars;
				}
				return preserveMarkup && wordClamped === plain ? byChars : wordClamped;
			}
			default:
				return fitCopyBudget(raw, { maxChars: FETCH_TEXT_CLIP.news });
		}
	}

	function clampFetchedBlackTextBody(text: string): string {
		return clampFetchedPlainLength(text, FETCH_TEXT_CLIP.blackTextBody, false)
			.replace(/\r\n/g, '\n')
			.replace(/\n{3,}/g, '\n\n')
			.trim();
	}

	/* Headline / beat helpers live in `$lib/studio/deck-story-beats` (shared with Bulk). */

	/**
	 * Shared Hook → content → content beats for the whole deck (any template mix).
	 * Slide 0 = strongest hook; later slides are distinct supporting beats.
	 * Same `/api/news/variants` path as Bulk (`$lib/studio/deck-story-beats`).
	 */
	async function fetchDeckStoryBeats(
		hookText: string,
		rawText: string,
		count: number,
		opts?: { includeReplies?: boolean; autoHighlight?: boolean; includeBodies?: boolean },
	): Promise<{ copyStrings: string[]; tweetReplies: string[]; bodies: string[] }> {
		const result = await fetchDeckStoryBeatsShared({
			hookText,
			rawText: String(rawText || articleSnippet || articleTitle || '').trim(),
			count,
			title: articleTitle,
			sourceUrl: articleUrl,
			contentMode: newsContentMode,
			userRequest: generalTopicPrompt.trim() || articleTitle,
			stepCount: newsContentMode === 'steps' ? stepsCount : undefined,
			autoHighlight: !!opts?.autoHighlight,
			includeReplies: !!opts?.includeReplies,
			includeBodies: opts?.includeBodies !== false,
			maxWords: studioHeadlineMaxWords,
			maxWordsSupport: studioBodyMaxWords,
			tone: studioGenerationTonePayload(),
			clampBody: (text) => clampNewsSubtext(text, undefined, ''),
		});
		return {
			copyStrings: result.copyStrings,
			tweetReplies: opts?.includeReplies
				? normalizeTweetReplies(result.tweetReplies, Math.max(1, count))
				: [],
			bodies: result.bodies,
		};
	}

	/** Clamp + pad supporting paragraphs so each slide has its own body. */
	function normalizeSupportBodies(bodies: string[], source: string, count: number): string[] {
		const n = Math.max(1, count);
		const cleaned = (bodies ?? [])
			.map((b) => clampNewsSubtext(String(b ?? '').trim(), undefined, ''))
			.filter(Boolean);
		if (cleaned.length >= n) {
			return dedupeSupportBodyList(cleaned.slice(0, n), source);
		}
		if (!cleaned.length) {
			return distributeNewsSubtextAcrossSlides(source, Array.from({ length: n }, () => ''), n);
		}
		const out = [...cleaned];
		const extras = distributeNewsSubtextAcrossSlides(source, out, n);
		while (out.length < n) {
			const next = extras[out.length] ?? '';
			out.push(next && !out.some((x) => x.toLowerCase() === next.toLowerCase()) ? next : '');
		}
		return dedupeSupportBodyList(out.slice(0, n), source);
	}

	function dedupeSupportBodyList(bodies: string[], source: string): string[] {
		const seen = new Set<string>();
		const sentences = splitPlainSentences(stripMarkup(source)).filter(
			(s) => !isNewsMetaSentence(s) && !isIncompleteOverlayCopy(s, 6),
		);
		let sentenceCursor = 0;
		return bodies.map((raw, i) => {
			let t = String(raw ?? '').trim();
			const key = t.toLowerCase().replace(/\s+/g, ' ');
			if (t && !seen.has(key)) {
				seen.add(key);
				return t;
			}
			while (sentenceCursor < sentences.length) {
				const candidate = clampNewsSubtext(sentences[sentenceCursor++]!, undefined, t);
				const cKey = candidate.toLowerCase().replace(/\s+/g, ' ');
				if (candidate && !seen.has(cKey)) {
					seen.add(cKey);
					return candidate;
				}
			}
			const filler = clampNewsSubtext(
				`This slide adds a separate beat on the same story (${i + 1}).`,
				undefined,
				'',
			);
			seen.add(filler.toLowerCase());
			return filler;
		});
	}

	/**
	 * Apply unique supporting paragraphs under headlines for templates that render a body.
	 * Prefer API `bodies` (one per slide). Fall back to distributing the article bible.
	 */
	function applyDeckSupportBodies(
		bodies: string[],
		source: string,
		opts?: { newsIndexes?: number[]; blackTextIndexes?: number[] },
	) {
		const n = Math.max(1, slides.length);
		const headlines = Array.from({ length: n }, (_, i) => String(slides[i] ?? '').trim());
		const sourceText = String(source || articleSnippet || '').trim();
		const parts =
			bodies.length >= n
				? normalizeSupportBodies(bodies, sourceText, n)
				: bodies.length > 0
					? normalizeSupportBodies(bodies, sourceText, n)
					: distributeNewsSubtextAcrossSlides(sourceText, headlines, n);

		const newsIdxs = (opts?.newsIndexes?.length
			? opts.newsIndexes
			: Array.from({ length: n }, (_, i) => i).filter(
					(i) => coerceTemplateId(slideTemplates[i] ?? lastTemplateUsed) === 'news',
				)
		).filter((i) => i >= 0 && i < n);

		const blackIdxs = (opts?.blackTextIndexes?.length
			? opts.blackTextIndexes
			: Array.from({ length: n }, (_, i) => i).filter((i) => {
					const t = coerceTemplateId(slideTemplates[i] ?? lastTemplateUsed);
					return t === 'blackText' || isPhotoStoryFamily(t);
				})
		).filter((i) => i >= 0 && i < n);

		if (newsIdxs.length) {
			while (newsSubtextBySlide.length < n) {
				newsSubtextBySlide = [...newsSubtextBySlide, ''];
			}
			newsSubtextBySlide = Array.from({ length: Math.max(n, newsSubtextBySlide.length) }, (_, i) => {
				if (!newsIdxs.includes(i)) return newsSubtextBySlide[i] ?? '';
				return parts[i] ?? '';
			});
		}

		if (blackIdxs.length) {
			while (blackTextBodyBySlide.length < n) {
				blackTextBodyBySlide = [
					...blackTextBodyBySlide,
					BLACK_TEXT_CAROUSEL_DEFAULTS.body,
				];
			}
			blackTextBodyBySlide = Array.from(
				{ length: Math.max(n, blackTextBodyBySlide.length) },
				(_, i) => {
					if (!blackIdxs.includes(i)) return blackTextBodyBySlide[i] ?? '';
					const raw = parts[i] ?? '';
					return raw ? clampFetchedBlackTextBody(raw) : '';
				},
			);
		}
	}

	function templateUsesLongBodyCopy(template: TemplateId): boolean {
		return template === 'textCarousel' || isWhitePostFamily(template);
	}

	/** Apply carousel headline strings to the template the user had selected (not always News). */
	function resetNewsSourceOffsets() {
		if (!textOffsetsBySlide.length) return;
		let changed = false;
		const next = textOffsetsBySlide.map((row) => {
			if (!row || !('news:source' in row)) return row;
			changed = true;
			const copy = { ...row };
			delete copy['news:source'];
			return copy;
		});
		if (changed) textOffsetsBySlide = next;
	}

	function fitNewsShadowFromStack(info: { topPct: number; heightPct: number }) {
		const i = paintSlide;
		if (!shadowAutoFitAt(i)) return;
		// Fit this slide only — Bulk uses the same NEWS_SHADOW_AUTOFIT numbers.
		const cover = bottomShadowHeightForTextStack(info, { ...NEWS_SHADOW_AUTOFIT });
		if (Math.abs(cover - shadowHeightAt(i)) > 0.5) {
			setSlideShadow(i, { height: cover });
		}
	}

	function applyHeadlineStringsToTemplate(template: TemplateId, strings: string[], replies?: string[]) {
		const clipped = strings.map((s) => clampFetchedPrimaryForTemplate(template, s));
		slides = [...clipped];
		if (template === 'news') resetNewsSourceOffsets();
		if (template === 'tweet') {
			tweetTopTextBySlide = [...clipped];
			applyTweetReplyStrings(replies ?? []);
			for (let i = 0; i < clipped.length; i++) ensureTweetSlideProfileDefaults(i);
		} else if (template === 'article') {
			articleTextBySlide = [...clipped];
		} else if (template === 'textCarousel' || isWhitePostFamily(template)) {
			textCarouselTextBySlide = [...clipped];
		} else if (template === 'imageQuote') {
			imageQuoteTextBySlide = [...clipped];
		} else if (isVideoStoryFamily(template)) {
			videoStoryHeadlineBySlide = [...clipped];
		} else if (template === 'blackText' || isPhotoStoryFamily(template)) {
			blackTextHeadlineBySlide = [...clipped];
		}
	}

	function applyPrimaryClampedToSlide(i: number, template: TemplateId, raw: string, reply?: string) {
		const clipped = clampFetchedPrimaryForTemplate(template, raw);
		slides = slides.map((s, idx) => (idx === i ? clipped : s));
		if (template === 'tweet') {
			tweetTopTextBySlide = tweetTopTextBySlide.map((s, idx) => (idx === i ? clipped : s));
			const btm = clampTweetReplyFetched(
				String(reply ?? '').trim() || TWEET_DEFAULTS.bottomText,
			);
			tweetBottomTextBySlide = tweetBottomTextBySlide.map((s, idx) => (idx === i ? btm : s));
			ensureTweetSlideProfileDefaults(i);
		} else if (template === 'article') {
			articleTextBySlide = articleTextBySlide.map((s, idx) => (idx === i ? clipped : s));
		} else if (template === 'textCarousel' || isWhitePostFamily(template)) {
			textCarouselTextBySlide = textCarouselTextBySlide.map((s, idx) => (idx === i ? clipped : s));
		} else if (template === 'imageQuote') {
			imageQuoteTextBySlide = imageQuoteTextBySlide.map((s, idx) => (idx === i ? clipped : s));
		} else if (isVideoStoryFamily(template)) {
			videoStoryHeadlineBySlide = videoStoryHeadlineBySlide.map((s, idx) => (idx === i ? clipped : s));
		} else if (template === 'blackText' || isPhotoStoryFamily(template)) {
			blackTextHeadlineBySlide = blackTextHeadlineBySlide.map((s, idx) => (idx === i ? clipped : s));
		}
	}

	/**
	 * Merge JSON from Claude, `/api/generate-slides`, or your own template into the current Studio template.
	 * Extend field mapping in `$lib/studio/external-slide-merge.ts` when you add new Claude shapes.
	 */
	function applyExternalSlideMergeFromPanelJson(mode: ExternalSlideMergeMode = importMergeMode) {
		importJsonError = '';
		importJsonFeedback = '';
		const parsed = parseExternalSlideBlocksJson(importJsonText.trim());
		if (!parsed.ok) {
			importJsonError = parsed.error;
			return;
		}
		const t = activeTemplate;
		const patches = computeStudioSlideMergePatches(t, parsed.blocks, slides.length, mode);
		if (!patches.length) {
			importJsonError =
				mode === 'mix'
					? 'Nothing to merge — add headline/body, https image, or source fields.'
					: 'Nothing to apply from this payload for the current deck length.';
			return;
		}
		for (const p of patches) {
			const i = p.slideIndex;
			pushUndo(t, i);
			if (p.primary !== undefined && p.primary !== '') {
				applyPrimaryClampedToSlide(i, t, p.primary);
			}
			if (p.tweetBottom !== undefined && p.tweetBottom !== '' && t === 'tweet') {
				const btm = clampTweetTopFetched(p.tweetBottom);
				tweetBottomTextBySlide = tweetBottomTextBySlide.map((s, idx) => (idx === i ? btm : s));
			}
			if (p.source !== undefined && p.source !== '' && t === 'news') {
				source = p.source;
			}
			if (p.imageUrl) {
				setSlideImage(i, p.imageUrl, t);
			}
			if (p.body !== undefined && p.body !== '' && t === 'blackText') {
				const bodyClamped = clampFetchedBlackTextBody(p.body);
				blackTextBodyBySlide = blackTextBodyBySlide.map((s, idx) => (idx === i ? bodyClamped : s));
			}
		}
		closeToolbar();
		importJsonFeedback = `Applied ${patches.length} slide update(s).`;
	}

	// ── Fetch news ────────────────────────────────────────────────────────
	/** After heavy async work, flush Svelte DOM and wait one frame so images/layout paint before hiding loading overlays. */
	/**
	 * Snapshot per-slide layout chrome before Load & Fill so copy replace cannot
	 * wipe moves, styles, or overlay frames (News has a richer document lock too).
	 */
	type SlideStructureLock = {
		slide: number;
		template: TemplateId;
		styles: Partial<Record<TextElementKind, TextStyle>>;
		tweetStyles: Record<string, TextStyle>;
		textOffsets: Record<string, TextOffset>;
		textOverlays: TextOverlay[];
		imageOverlays: Overlay[];
	};

	function cloneStructureJson<T>(v: T): T {
		try {
			return structuredClone(v);
		} catch {
			return JSON.parse(JSON.stringify(v)) as T;
		}
	}

	function captureDeckStructureLocks(): SlideStructureLock[] {
		const n = Math.max(1, slides.length);
		const out: SlideStructureLock[] = [];
		for (let i = 0; i < n; i++) {
			const template = coerceTemplateId(slideTemplates[i] ?? lastTemplateUsed);
			const pref = `${template}:`;
			const row = textOffsetsBySlide[i] ?? {};
			const textOffsets: Record<string, TextOffset> = {};
			for (const [k, v] of Object.entries(row)) {
				if (!k.startsWith(pref) || !v) continue;
				textOffsets[k] = { x: Number(v.x) || 0, y: Number(v.y) || 0 };
			}
			out.push({
				slide: i,
				template,
				styles: cloneStructureJson((stylesByTemplateBySlide[template] ?? [])[i] ?? {}),
				tweetStyles: cloneStructureJson((tweetStylesBySlide[i] ?? {}) as Record<string, TextStyle>),
				textOffsets,
				textOverlays: cloneStructureJson((slideTextOverlaysByTemplate[template] ?? [])[i] ?? []),
				imageOverlays: cloneStructureJson((slideOverlaysByTemplate[template] ?? [])[i] ?? []),
			});
		}
		return out;
	}

	/** Re-apply geometry/styles after copy fill. Keeps new overlay/primary text; restores frames. */
	function restoreDeckStructureLocks(locks: SlideStructureLock[]) {
		if (!locks.length) return;
		const n = Math.max(1, slides.length);

		const nextStyles = { ...stylesByTemplateBySlide };
		const nextTextOverlays = { ...slideTextOverlaysByTemplate };
		const nextImageOverlays = { ...slideOverlaysByTemplate };
		let nextTweetStyles = tweetStylesBySlide.slice();
		let nextOffsets = textOffsetsBySlide.slice();
		while (nextOffsets.length < n) nextOffsets.push({});
		while (nextTweetStyles.length < n) nextTweetStyles.push({});

		for (const lock of locks) {
			const i = lock.slide;
			if (i < 0 || i >= n) continue;
			const template = lock.template;

			const styleRow = [...(nextStyles[template] ?? [])];
			while (styleRow.length <= i) styleRow.push({});
			if (Object.keys(lock.styles).length) styleRow[i] = cloneStructureJson(lock.styles);
			nextStyles[template] = styleRow;

			if (template === 'tweet' && Object.keys(lock.tweetStyles).length) {
				nextTweetStyles[i] = cloneStructureJson(lock.tweetStyles);
			}

			const offRow = { ...(nextOffsets[i] ?? {}) };
			const pref = `${template}:`;
			for (const k of Object.keys(offRow)) {
				if (k.startsWith(pref)) delete offRow[k];
			}
			for (const [k, v] of Object.entries(lock.textOffsets)) {
				offRow[k] = { x: v.x, y: v.y };
			}
			nextOffsets[i] = offRow;

			// Text overlays: keep filled copy, restore box geometry + style by id order.
			const curOverlays = [...((nextTextOverlays[template] ?? [])[i] ?? [])];
			const locked = lock.textOverlays;
			if (locked.length && curOverlays.length) {
				const byId = new Map(locked.map((o) => [o.id, o]));
				const merged = curOverlays.map((o) => {
					const prev = byId.get(o.id);
					if (!prev) return o;
					return {
						...o,
						x: prev.x,
						y: prev.y,
						w: prev.w,
						h: prev.h,
						style: prev.style ? cloneStructureJson(prev.style) : o.style,
					};
				});
				const tRows = [...(nextTextOverlays[template] ?? [])];
				while (tRows.length <= i) tRows.push([]);
				tRows[i] = merged;
				nextTextOverlays[template] = tRows;
			}

			if (lock.imageOverlays.length) {
				const iRows = [...(nextImageOverlays[template] ?? [])];
				while (iRows.length <= i) iRows.push([]);
				iRows[i] = cloneStructureJson(lock.imageOverlays);
				nextImageOverlays[template] = iRows;
			}
		}

		stylesByTemplateBySlide = nextStyles;
		slideTextOverlaysByTemplate = nextTextOverlays;
		slideOverlaysByTemplate = nextImageOverlays;
		tweetStylesBySlide = nextTweetStyles;
		textOffsetsBySlide = nextOffsets;
	}

	async function flushStudioLoadingPaint() {
		await tick();
		await new Promise<void>((resolve) => {
			requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
		});
	}

	async function fetchNews(opts: { fillOnly?: boolean; preferExistingDeck?: boolean } = {}) {
		fetchingNews = true;
		await tick();
		newsError = '';
		activeSlide = 0;
		const contentTemplate: TemplateId = slideTemplates[0] ?? lastTemplateUsed ?? 'news';
		// If the user is on a custom/blank canvas, "Load Test Article" should fill copy without
		// wiping their layout, media, and mixed templates.
		const hasAnyOverlays =
			Object.values(slideOverlaysByTemplate).some((rows) => (rows as any[])?.some((r) => (r?.length ?? 0) > 0)) ||
			Object.values(slideTextOverlaysByTemplate).some((rows) => (rows as any[])?.some((r) => (r?.length ?? 0) > 0));
		const hasAnyStyleOverrides =
			Object.values(stylesByTemplateBySlide).some((rows) =>
				(rows as any[])?.some((m) => m && Object.keys(m).length > 0),
			);
		const hasAnyMedia =
			Object.values(bgImagesByTemplate).some((row) => (row as any[])?.some((u) => String(u ?? '').trim())) ||
			Object.values(bgVideosByTemplate).some((row) => (row as any[])?.some((u) => String(u ?? '').trim()));
		const hasMixedTemplates = new Set(slideTemplates.map((t) => coerceTemplateId(t))).size > 1;
		const hasNewsSlidesInDeck =
			slideTemplates.length > 0 &&
			slideTemplates.some((t) => coerceTemplateId(t) === 'news');
		const fillExistingDeck =
			!!opts.fillOnly ||
			!!opts.preferExistingDeck ||
			forcedBlankFromQuery ||
			hasMixedTemplates ||
			hasAnyOverlays ||
			hasAnyStyleOverrides ||
			hasAnyMedia;
		/** Lock News structure before generate so copy fill cannot reset moves / present / overlays. */
		const newsLayoutLockBySlide: (NewsLayoutDocument | null)[] = hasNewsSlidesInDeck
			? slides.map((_, i) =>
					coerceTemplateId(slideTemplates[i] ?? '') === 'news'
						? captureLiveNewsLayoutDocument(i)
						: null,
				)
			: [];
		const accountNewsLock =
			!fillExistingDeck && contentTemplate === 'news'
				? parseNewsLayoutDocument(resolveTemplateOverride('news')?.newsDocument)
				: null;
		/** All templates: freeze offsets / styles / overlay frames across copy replace. */
		const deckStructureLock = fillExistingDeck ? captureDeckStructureLocks() : [];
		// Only clear starter deep-link when we are loading into News (News flow “owns” the deck).
		if (contentTemplate === 'news') consumeForcedTemplateStarter();
		if (!fillExistingDeck) {
			// Reset circle + background to defaults (only when the News flow owns the deck)
			circleX    = 772;
			circleY    = 52;
			circleSize = 300;
			// Reset per-slide circle images for the new story.
			circleImages = [];
			circle2Images = [];
			showCircle2BySlide = [];
			applyNewsSeedBackgroundLayout();
		}

		try {
			let hookText = '';
			let rawText  = '';
			let articleImageUrl = ''; // article's own image (used as seed for slide 0)
			let nextSource = '';
			let nextArticleUrl = '';
		let nextArticleTitle = '';

		const factTopicLabel = factTopicCategory !== 'any'
			? factTopics.find(t => t.id === factTopicCategory)?.label ?? ''
			: '';
		const factFullPrompt = [factTopicLabel, factTopicPrompt.trim()].filter(Boolean).join(': ');
		const quoteTopicLabel = quoteTopicCategory !== 'any'
			? factTopics.find((t) => t.id === quoteTopicCategory)?.label ?? ''
			: '';
		const quoteFullPrompt = [quoteTopicLabel, quoteTopicPrompt.trim()].filter(Boolean).join(': ');
		const resolvedStepsCount =
			newsContentMode === 'steps'
				? parseStepsCountFromPrompt(stepsTopicPrompt, stepsCount)
				: stepsCount;
		if (newsContentMode === 'steps') stepsCount = resolvedStepsCount;

		if (newsContentMode === 'general' && !generalTopicPrompt.trim()) {
			throw new Error('Describe what you want — e.g. “Make me a carousel of beds”.');
		}

		const syntheticHintStr =
			newsContentMode === 'general'
				? generalTopicPrompt.trim().slice(0, 600)
				: newsContentMode === 'fact'
					? factFullPrompt.slice(0, 600)
					: newsContentMode === 'story'
						? storyTopicPrompt.trim().slice(0, 600)
						: newsContentMode === 'quote'
							? quoteFullPrompt.slice(0, 600)
							: newsContentMode === 'steps'
								? stepsTopicPrompt.trim().slice(0, 600)
								: '';

		{
			const topicSafety = assessUserTopicSafety(
				newsContentMode === 'news' ? search : '',
				syntheticHintStr,
				newsContentMode === 'story' ? storyCategory : '',
			);
			if (!topicSafety.ok) {
				throw new Error(topicSafety.error);
			}
		}

			const avoidHooks =
				newsContentMode === 'news'
					? []
					: userId && syntheticHintStr
						? recentTitlesForQuery(userId, syntheticHintStr, 8)
						: [];

			const res = await fetch('/api/news', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					mode: newsContentMode,
					storyCategory,
					search: newsContentMode === 'news' ? search || undefined : undefined,
					categories: newsContentMode === 'news' ? category : undefined,
					limit: 15,
					autoHighlight: studioTextHighlightsEnabled,
					pick: newsContentMode === 'news' ? 'random' : 'first',
					syntheticHint: syntheticHintStr || undefined,
					stepCount: newsContentMode === 'steps' ? resolvedStepsCount : undefined,
					slideCount: newsContentMode === 'news' ? undefined : slideCount,
					studioRegenAt: Date.now(),
					maxWords: studioHeadlineMaxWords,
					maxWordsSupport: studioBodyMaxWords,
					avoidHooks: avoidHooks.length ? avoidHooks : undefined,
					...studioGenerationTonePayload(),
				}),
			});
			const data = await res.json();
			if (isUsageLimitError(res, data)) {
				openUsageUpgrade(typeof data.error === 'string' ? data.error : undefined);
				await refreshStudioUsage();
				throw new Error(data.error ?? 'Carousel limit reached');
			}
			if (!res.ok) throw new Error(data.error ?? 'Failed to fetch news');

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
			} else {
				void refreshStudioUsage();
			}

			if (data.demo === true) {
				const demoMsg =
					typeof data.warning === 'string' && data.warning.trim()
						? data.warning.trim()
						: 'Using offline demo copy — add OPENROUTER_API_KEY for real AI text.';
				setFlashToast(demoMsg);
			}

			hookText = clampFetchedPrimaryForTemplate(
				fillExistingDeck ? 'news' : contentTemplate,
				String(data.text ?? ''),
			);
			/* Keep full description as the slide bible; per-slide clamps enforce Default length. */
			rawText = String(data.description ?? data.title ?? '');
			if (newsContentMode !== 'news') {
				const histQuery = syntheticHintStr || activeSyntheticQuery();
				recordPromptHistoryRun(
					histQuery,
					String(data.title ?? data.text ?? '').replace(/\[\[|\]\]/g, ''),
				);
			} else if (search.trim()) {
				recordPromptHistoryRun(search.trim(), String(data.title ?? data.text ?? ''));
			}
			nextSource =
				newsContentMode === 'news'
					? sourceLabels[category] ?? data.source ?? 'News'
					: typeof data.source === 'string' && data.source
						? data.source
						: newsContentMode === 'general'
							? 'General'
							: newsContentMode === 'fact'
								? 'Did you know'
								: newsContentMode === 'quote'
									? 'Quotes'
									: newsContentMode === 'steps'
										? 'Steps'
										: storyThemes.find((t) => t.id === storyCategory)?.label ?? 'Story';
			nextArticleUrl = data.url ?? '';
			nextArticleTitle = data.title ?? '';
			articleImageUrl = data.imageUrl ?? '';

			// Only write metadata into the workspace when we are *owning the deck* (not filling a custom template).
			if (!fillExistingDeck) {
				source = resolveNewsSourceAfterFetch();
				articleUrl = nextArticleUrl;
				articleTitle = nextArticleTitle;
				articleSnippet = rawText;
			}

			if (!fillExistingDeck && newsContentMode === 'steps') {
				slideCount = stepsDeckLength(resolvedStepsCount);
			}
			// Grow/shrink the real deck to the chip count before filling (including fillExistingDeck).
			setDeckSlideCount(slideCount);
			const n = Math.max(1, slides.length);
			slideCount = n;
			lastTemplateUsed = contentTemplate;

		if (fillExistingDeck) {
			const allNewsSlidesDeck =
				slideTemplates.length > 0 &&
				slideTemplates.every((t) => coerceTemplateId(t) === 'news') &&
				!hasMixedTemplates;
			// True when at least one slide uses the news template (covers mixed decks too).
			// Sync article metadata so variants / Vertex / circle prompts are not stuck on the previous run.
			if (hasNewsSlidesInDeck) {
				// Always sync for any deck that has news slides, regardless of content mode.
				articleUrl = nextArticleUrl;
				articleTitle = nextArticleTitle;
				articleSnippet = rawText;
				source = resolveNewsSourceAfterFetch();
			} else if (
				newsContentMode === 'general' ||
				newsContentMode === 'news' ||
				newsContentMode === 'fact' ||
				newsContentMode === 'story' ||
				newsContentMode === 'quote' ||
				newsContentMode === 'steps'
			) {
				articleUrl = nextArticleUrl;
				articleTitle = nextArticleTitle;
				articleSnippet = rawText;
			}
				// If the user is mid-inline-edit on News, clear the live buffer so the replacement is visible immediately.
				if (newsHeadlineLive !== null) newsHeadlineLive = null;
				// Preserve layout/media; refresh copy on every slide for its template.
				const targets: { slide: number; template: TemplateId }[] = [];
				for (let i = 0; i < n; i++) {
					targets.push({
						slide: i,
						template: coerceTemplateId(slideTemplates[i] ?? lastTemplateUsed),
					});
				}

				const longBodyTargets = targets.filter((t) => templateUsesLongBodyCopy(t.template));
				// Blank uses free-form overlays — copy is applied via fillBlankTextFromFetch after fetch.
				const shortCopyTargets = targets.filter(
					(t) => !templateUsesLongBodyCopy(t.template) && t.template !== 'blank',
				);
				const wantsTweetReplies = shortCopyTargets.some((t) => t.template === 'tweet');

				// One Hook → content → content arc for the whole deck (works with mixed templates).
				const { copyStrings, tweetReplies, bodies } = await fetchDeckStoryBeats(hookText, rawText, n, {
					includeReplies: wantsTweetReplies,
					autoHighlight: studioTextHighlightsEnabled,
					includeBodies: true,
				});

				const sourceForCarousel = String(rawText || articleSnippet || articleTitle || '').trim();
				const longBodyBySlide = new Map<number, string>();
				if (longBodyTargets.length) {
					try {
						const carouselBudget = textCarouselBudgetFromMaxWords(studioBodyMaxWords);
						if (newsCopyLength === 'short' || carouselBudget.paragraphCount <= 1) {
							for (const t of longBodyTargets) {
								const beat = String(
									copyStrings[t.slide] ?? (t.slide === 0 ? hookText : sourceForCarousel),
								);
								longBodyBySlide.set(
									t.slide,
									studioTextHighlightsEnabled
										? beat
										: clampFetchedTextCarouselBody(beat, FETCH_TEXT_CLIP.textCarousel),
								);
							}
						} else {
							const carouselBodies = await Promise.all(
								longBodyTargets.map((t) => {
									const beat = String(
										copyStrings[t.slide] ?? (t.slide === 0 ? hookText : sourceForCarousel),
									);
									return fetchTextCarouselBody({
										text: sourceForCarousel,
										angle: beat,
										slideIndex: t.slide,
										slideCount: n,
										paragraphCount: carouselBudget.paragraphCount,
									})
										.then((expanded) =>
											studioTextHighlightsEnabled
												? reapplyHighlightPhrases(expanded, beat)
												: expanded,
										)
										.catch(() =>
											studioTextHighlightsEnabled
												? beat
												: clampFetchedTextCarouselBody(
														beat,
														FETCH_TEXT_CLIP.textCarousel,
													),
										);
								}),
							);
							longBodyTargets.forEach((t, i) => {
								longBodyBySlide.set(t.slide, carouselBodies[i] ?? '');
							});
						}
					} catch (e: any) {
						newsError = `Text carousel: ${e?.message ?? String(e)}`;
						for (const t of longBodyTargets) {
							longBodyBySlide.set(
								t.slide,
								clampFetchedTextCarouselBody(
									String(copyStrings[t.slide] ?? (t.slide === 0 ? hookText : sourceForCarousel)),
									FETCH_TEXT_CLIP.textCarousel,
								),
							);
						}
					}
				}

				for (const t of targets) {
					pushUndo(t.template, t.slide);
					let primaryForPlaceholders = hookText;
					if (templateUsesLongBodyCopy(t.template)) {
						const bodyCopy = longBodyBySlide.get(t.slide) ?? '';
						primaryForPlaceholders = bodyCopy;
						applyPrimaryClampedToSlide(t.slide, t.template, bodyCopy);
					} else if (t.template !== 'blank') {
						const primary = copyStrings[t.slide] ?? hookText;
						primaryForPlaceholders = primary;
						const reply =
							t.template === 'tweet'
								? tweetReplies[t.slide] ?? TWEET_DEFAULTS.bottomText
								: undefined;
						applyPrimaryClampedToSlide(t.slide, t.template, primary, reply);
					}
					if (t.template === 'tweet') ensureTweetSlideProfileDefaults(t.slide);
					// Replace starter text boxes / clear News overlay stacks — never leave “SLIDE 2” etc.
					// Skip News subtext here; applyDeckSupportBodies assigns unique paragraphs next.
					syncFetchedPlaceholdersForSlide(
						t.template,
						t.slide,
						primaryForPlaceholders,
						String(rawText || articleSnippet || '').trim(),
						{ skipNewsSubtext: t.template === 'news' },
					);
				}
				// Unique supporting paragraph under each headline (News / Black text / Photo story).
				applyDeckSupportBodies(bodies, String(rawText || articleSnippet || '').trim());
				// Blank never renders `slides[]` — drop stale News headline strings after fetch.
				for (let i = 0; i < n; i++) {
					if (coerceTemplateId(slideTemplates[i] ?? lastTemplateUsed) === 'blank') {
						slides = slides.map((s, idx) => (idx === i ? '' : s));
					}
				}
				// Blank canvas: push fetched hook/body into existing text boxes (Quote/Fact/Story/News).
				if (targets.some((t) => t.template === 'blank')) {
					articleSnippet = rawText;
					articleTitle = nextArticleTitle || articleTitle;
					source = resolveNewsSourceAfterFetch();
					fillBlankTextFromFetch(hookText, rawText, copyStrings);
				}
			// Deck has news slides → regenerate their backgrounds on every Load & Fill.
			const refreshNewsDeckOnFetch =
				!opts.fillOnly &&
				hasNewsSlidesInDeck &&
				(newsContentMode === 'general' ||
					newsContentMode === 'news' ||
					newsContentMode === 'fact' ||
					newsContentMode === 'story' ||
					newsContentMode === 'quote' ||
					newsContentMode === 'steps');
			if (refreshNewsDeckOnFetch) {
				await refreshNewsDeckImagesAfterFetch(String(articleImageUrl ?? '').trim());
			}
			// Every other media template (Highlight, tweet, article, imageQuote, …) — same Pexels/stock/AI swap as News.
			if (!opts.fillOnly) {
				await refreshNonNewsDeckMediaAfterFetch(String(articleImageUrl ?? '').trim());
			}
			} else {
				slideTemplates = Array.from({ length: n }, () => contentTemplate);

				if (contentTemplate === 'news') {
					bgImagesByTemplate = {
						...bgImagesByTemplate,
						news: Array.from({ length: n }, (_, i) =>
							i === 0 && newsImageSourceMode === 'pull' && newsGenerateImages ? articleImageUrl : '',
						),
					};
					bgVideosByTemplate = { ...bgVideosByTemplate, news: Array(n).fill('') };
					generatingImagesByTemplate = { ...generatingImagesByTemplate, news: Array(n).fill(false) };
					slideOverlaysByTemplate = {
						...slideOverlaysByTemplate,
						news: Array.from({ length: n }, () => []),
					};
					slideTextOverlaysByTemplate = {
						...slideTextOverlaysByTemplate,
						news: Array.from({ length: n }, () => []),
					};
					showCircleBySlide = Array.from({ length: n }, (_, i) => i === 0);
					/* Subtexts filled after headlines/variants so each of N slides gets its own beat. */
					newsSubtextBySlide = Array.from({ length: n }, () => '');
				} else {
					const heroBgRow =
						templateAcceptsArticleHeroBackground(contentTemplate) && newsImageSourceMode === 'pull' && newsGenerateImages
						? Array.from({ length: n }, (_, i) => (i === 0 ? articleImageUrl : ''))
						: Array.from({ length: n }, (_, i) =>
								contentTemplate === 'blackText' ? BLACK_TEXT_BG_DEFAULT : '',
							);
					bgImagesByTemplate = {
						...bgImagesByTemplate,
						[contentTemplate]: heroBgRow,
					};
					bgVideosByTemplate = {
						...bgVideosByTemplate,
						[contentTemplate]: Array(n).fill(''),
					};
					generatingImagesByTemplate = {
						...generatingImagesByTemplate,
						[contentTemplate]: Array(n).fill(false),
					};
					slideOverlaysByTemplate = {
						...slideOverlaysByTemplate,
						[contentTemplate]: Array.from({ length: n }, () => []),
					};
					slideTextOverlaysByTemplate = {
						...slideTextOverlaysByTemplate,
						[contentTemplate]: Array.from({ length: n }, () => []),
					};
				}

				// Prime every slide’s copy (template-specific clamps) so UI never briefly shows unclamped hooks.
				if (templateUsesLongBodyCopy(contentTemplate)) {
					await fillTextCarouselDeck(hookText, rawText, n, contentTemplate);
				} else {
					applyHeadlineStringsToTemplate(contentTemplate, normalizeHeadlineVariants([], hookText, n));
					// Generate supporting slide variants (refines slide 2+ when slideCount > 1)
					if (slideCount > 1) {
						generatingVariants = true;
						try {
							await generateVariants(hookText, rawText, contentTemplate);
						} finally {
							generatingVariants = false;
						}
					} else {
						// Single slide: use the article lede under the hook.
						applyDeckSupportBodies(
							[String(rawText || articleSnippet || '').trim()],
							String(rawText || articleSnippet || '').trim(),
						);
					}
				}

				// Generate unique Vertex image per slide in parallel
				// Slide 0: keep article image if available; otherwise generate from title
				// Slides 1+: generate from their own text copy
				const imagePromise = generateAllSlideImages(articleImageUrl, contentTemplate);

				await imagePromise;

				// Badge circle: fill every News slide that has the circle on (or first News if none). Brief
				// pause after parallel Vertex slide gens reduces 429s; stagger per-slide circle calls.
				if (contentTemplate === 'news') {
					const circleIdxs = newsSlidesWithPrimaryCircle(n);
					if (circleIdxs.length) {
						showCircleBySlide = Array.from({ length: n }, (_, i) =>
							circleIdxs.includes(i) ? true : (showCircleBySlide[i] ?? false),
						);
					}
					await new Promise<void>((r) => setTimeout(r, 500));
					await fillNewsCircleImages(circleIdxs);
				}
			}

		// Keep source logo/byline + last drag position after generate (don't reset to category tags).
		source = resolveNewsSourceAfterFetch();
		if (userId) {
			try {
				const preserveNews =
					contentTemplate === 'news' &&
					(!!resolveTemplateOverride('news') || !!accountNewsLock);
				applyNewsSourceChromeFromKit(loadBrandKit(userId), {
					preserveOffsets: preserveNews,
					preserveWidth: preserveNews,
					preservePlate: preserveNews,
				});
				source = resolveNewsSourceAfterFetch();
			} catch {
				/* ignore */
			}
		}

		// Restore moves / styles / overlay frames for every template after copy fill.
		if (deckStructureLock.length) restoreDeckStructureLocks(deckStructureLock);

		// Re-apply locked News structure so generate only filled copy — moves/present/overlays stay.
		if (newsLayoutLockBySlide.length) {
			for (let i = 0; i < newsLayoutLockBySlide.length; i++) {
				const doc = newsLayoutLockBySlide[i];
				if (!doc) continue;
				applyNewsLayoutDocumentToStudio(doc, { slides: [i], overlays: true });
			}
		} else if (accountNewsLock && contentTemplate === 'news') {
			applyNewsLayoutDocumentToStudio(accountNewsLock, { slides: 'all', overlays: true });
		} else if (!fillExistingDeck && resolveTemplateOverride(contentTemplate)) {
			// Fresh deck for tweet / carousel / video / etc. — restore saved default chrome
			// (offsets, styles, overlays) after copy + media fill, same idea as News.
			applyTemplateDevOverride(contentTemplate, { slides: 'all' });
		}

		// Layout locks can restore a pre-generate autofit shrink — pin Hook-depth coverage.
		if (contentTemplate === 'news' || hasNewsSlidesInDeck) {
			ensureNewsShadowCoverage();
			if (!fillExistingDeck) {
				resetAllShadows({
					height: NEWS_DEFAULT_LAYOUT.shadowHeight,
					strength: NEWS_DEFAULT_LAYOUT.shadowStrength,
					curve: NEWS_DEFAULT_LAYOUT.shadowCurve,
					autoFit: true,
				});
			}
		}

		await flushStudioLoadingPaint();
		// Always land on Hook after Generate / Load & Fill — never leave a mid-deck focus.
		editingBrandCta = false;
		newsHeadlineLive = null;
		activeSlide = 0;
		} catch (e: unknown) {
			if (!usageUpgradeOpen) {
				newsError = e instanceof Error ? e.message : String(e);
			}
			editingBrandCta = false;
			newsHeadlineLive = null;
			activeSlide = 0;
		} finally {
			fetchingNews = false;
			generatingVariants = false;
		}
	}

	type FillSlot =
		| { kind: 'textOverlay'; template: TemplateId; slide: number; overlayId: string }
		| { kind: 'primary'; template: TemplateId; slide: number }
		| { kind: 'newsSubtext'; template: 'news'; slide: number };

	/** Decorative “SLIDE 2” labels from starter decks — drop on Load & Fill, never treat as content. */
	function isSlideNumberPlaceholder(text: string): boolean {
		return /^slide\s*\d+$/i.test(String(text ?? '').replace(/\s+/g, ' ').trim());
	}

	function splitBodyIntoPlaceholderLines(hookText: string, rawText: string): string[] {
		/* Hook may keep [[highlights]]; paragraph lines are always plain. */
		const hook = String(hookText ?? '').trim();
		const body = stripMarkup(String(rawText ?? '').trim());
		const extraLines = body
			.split(/(?<=[.!?])\s+/)
			.map((s) => s.trim())
			.filter(Boolean)
			.slice(0, 7);
		return [hook, ...extraLines.filter((l) => l !== stripMarkup(hook))].filter(Boolean);
	}

	function setTextOverlayText(template: TemplateId, slide: number, overlayId: string, text: string) {
		const rows = slideTextOverlaysByTemplate[template] ?? [];
		const nextRows = rows.map((r) => [...r]);
		while (nextRows.length <= slide) nextRows.push([]);
		/* Free-form text tags are paragraph-role: never inherit headline [[highlights]]. */
		const plain =
			template === 'blank'
				? plainBlankOverlayCopy(String(text ?? '').trim())
				: stripMarkup(String(text ?? '').trim());
		nextRows[slide] = (nextRows[slide] ?? []).map((o) =>
			o.id === overlayId ? { ...o, text: plain } : o,
		);
		slideTextOverlaysByTemplate = { ...slideTextOverlaysByTemplate, [template]: nextRows };
	}

	/**
	 * Blank free-form boxes are not News headlines: strip `[[…]]` and soften ALL CAPS
	 * from the news/generate pipeline so brackets/size-y shouty copy don't land on Blank.
	 */
	function plainBlankOverlayCopy(text: string): string {
		const plain = stripMarkup(String(text ?? '').trim());
		if (!plain) return '';
		const letters = plain.replace(/[^A-Za-z]/g, '');
		if (letters.length < 4) return plain;
		const upperRatio = letters.replace(/[^A-Z]/g, '').length / letters.length;
		if (upperRatio < 0.75) return plain;
		const lower = plain.toLowerCase();
		return lower.replace(/(^|[.!?]\s+)([a-z])/g, (_, lead: string, ch: string) => lead + ch.toUpperCase());
	}

	/**
	 * Treat free-form text boxes as placeholders: drop “SLIDE N” labels, replace remaining
	 * copy in one write (avoids mid-loop $state races leaving old layers visible).
	 */
	function replaceTextOverlaysAsPlaceholders(
		template: TemplateId,
		slide: number,
		lines: string[],
	) {
		const rows = [...(slideTextOverlaysByTemplate[template] ?? [])];
		while (rows.length <= slide) rows.push([]);
		const prev = rows[slide] ?? [];
		if (!prev.length) return;
		const content = lines
			.map((l) =>
				template === 'blank'
					? plainBlankOverlayCopy(String(l ?? ''))
					: String(l ?? '').trim(),
			)
			.filter(Boolean);
		if (!content.length) {
			rows[slide] = prev.filter((o) => !isSlideNumberPlaceholder(o.text));
			slideTextOverlaysByTemplate = { ...slideTextOverlaysByTemplate, [template]: rows };
			return;
		}
		let lineIdx = 0;
		const next: TextOverlay[] = [];
		for (const o of prev) {
			if (isSlideNumberPlaceholder(o.text)) continue;
			next.push({ ...o, text: content[lineIdx % content.length]! });
			lineIdx++;
		}
		rows[slide] = next;
		slideTextOverlaysByTemplate = { ...slideTextOverlaysByTemplate, [template]: rows };
	}

	/**
	 * After primary copy is applied: sync placeholder overlays + News subtext so Load & Fill
	 * replaces (never stacks) starter/demo text. User-added text tags stay and get filled.
	 */
	function syncFetchedPlaceholdersForSlide(
		template: TemplateId,
		slide: number,
		primaryText: string,
		bodyText: string,
		opts?: { skipNewsSubtext?: boolean },
	) {
		const primary = String(primaryText ?? '').trim();
		const body = String(bodyText ?? '').trim();
		const lines = splitBodyIntoPlaceholderLines(primary, body);

		if (template === 'news') {
			while (newsSubtextBySlide.length <= slide) {
				newsSubtextBySlide = [...newsSubtextBySlide, ''];
			}
			/* When skipNewsSubtext, applyDeckSupportBodies owns unique per-slide paragraphs. */
			if (!opts?.skipNewsSubtext) {
				const hadSubtext = String(newsSubtextBySlide[slide] ?? '').trim().length > 0;
				const shouldFillSubtext = !!body || hadSubtext;
				const sub = shouldFillSubtext && body
					? pickNewsSubtext({
							body,
							headline: primary,
							previous: newsSubtextBySlide[slide] ?? '',
							slideIndex: slide,
						})
					: shouldFillSubtext && !body
						? String(newsSubtextBySlide[slide] ?? '')
						: '';
				newsSubtextBySlide = newsSubtextBySlide.map((x, i) => (i === slide ? sub : x));
			}
			/* Fill any free-form text tags on this News slide — do not wipe them. */
			replaceTextOverlaysAsPlaceholders(
				'news',
				slide,
				lines.length ? lines : [primary].filter(Boolean),
			);
			return;
		}

		if (template === 'blank') {
			replaceTextOverlaysAsPlaceholders('blank', slide, lines.length ? lines : [primary]);
			return;
		}

		// Other templates: keep layout boxes, swap copy, drop slide-number labels.
		replaceTextOverlaysAsPlaceholders(template, slide, lines.length ? lines : [primary]);
	}

	/** Apply fetched hook/body copy onto existing blank-canvas text boxes (Quote/Fact/Story/News). */
	function fillBlankTextFromFetch(hookText: string, rawText: string, storyBeats?: string[]) {
		const lines = splitBodyIntoPlaceholderLines(hookText, rawText);
		const beats = (storyBeats ?? [])
			.map((s) => String(s ?? '').trim())
			.filter(Boolean);
		if (!lines.length && !beats.length) return;

		const n = Math.max(1, slides.length);
		const blankRows = [...(slideTextOverlaysByTemplate.blank ?? [])];
		let changed = false;
		let lineIdx = 0;
		for (let i = 0; i < n; i++) {
			if (coerceTemplateId(slideTemplates[i] ?? lastTemplateUsed) !== 'blank') continue;
			while (blankRows.length <= i) blankRows.push([]);
			const prev = blankRows[i] ?? [];
			if (!prev.length) continue;
			pushUndo('blank', i);
			const slideBeat = plainBlankOverlayCopy(
				beats[i] ?? lines[Math.min(i, Math.max(0, lines.length - 1))] ?? hookText,
			);
			const next: TextOverlay[] = [];
			let boxIdx = 0;
			for (const o of prev) {
				if (isSlideNumberPlaceholder(o.text)) continue;
				// First text box on the slide gets this slide's unique beat; extras cycle supporting lines.
				const text =
					boxIdx === 0
						? slideBeat
						: plainBlankOverlayCopy(
								lines[(lineIdx + boxIdx) % Math.max(1, lines.length)] ?? slideBeat,
							);
				next.push({ ...o, text });
				boxIdx++;
			}
			lineIdx += Math.max(1, boxIdx);
			blankRows[i] = next;
			changed = true;
		}
		if (changed) {
			slideTextOverlaysByTemplate = { ...slideTextOverlaysByTemplate, blank: blankRows };
		}
	}

	function collectFillSlots(
		skipPrimary = false,
		opts?: { skipBlankOverlays?: boolean; skipNewsOverlays?: boolean; skipNewsSubtext?: boolean },
	): FillSlot[] {
		// Collect fill targets across ALL slides so every template gets populated correctly.
		const out: FillSlot[] = [];
		const n = Math.max(1, slides.length);
		for (let i = 0; i < n; i++) {
			const tpl = coerceTemplateId(slideTemplates[i] ?? lastTemplateUsed);
			// Primary template text (e.g. News headline). Blank canvas only uses text overlays.
			if (!skipPrimary && tpl !== 'blank') {
				out.push({ kind: 'primary', template: tpl, slide: i });
			}
			/* Built-in News paragraph under the headline — skip after fetchNews (`skipPrimary`),
			 * which already applied unique per-slide bodies via applyDeckSupportBodies. Re-picking
			 * from the shared articleSnippet lede stamped the same sentence on every slide. */
			if (
				tpl === 'news' &&
				!opts?.skipNewsOverlays &&
				!opts?.skipNewsSubtext &&
				!skipPrimary
			) {
				const sub = String(newsSubtextBySlide[i] ?? '').trim();
				if (sub) out.push({ kind: 'newsSubtext', template: 'news', slide: i });
			}
			// All text overlays on this slide (blank canvas / custom text boxes / News tags).
			if (opts?.skipBlankOverlays && tpl === 'blank') continue;
			if (opts?.skipNewsOverlays && tpl === 'news') continue;
			const overlays = (slideTextOverlaysByTemplate[tpl] ?? [])[i] ?? [];
			for (const o of overlays) {
				if (isSlideNumberPlaceholder(o.text)) continue;
				out.push({ kind: 'textOverlay', template: tpl, slide: i, overlayId: o.id });
			}
		}
		return out;
	}

	type ImageFillSlot =
		| { kind: 'background'; template: 'blank'; slide: number }
		| { kind: 'overlay'; template: 'blank'; slide: number; overlayId: string };

	/** Existing photo/video layers on blank slides — topic fill replaces these in place. */
	function collectBlankImageFillSlots(): ImageFillSlot[] {
		const out: ImageFillSlot[] = [];
		const n = Math.max(1, slides.length);
		for (let i = 0; i < n; i++) {
			if (coerceTemplateId(slideTemplates[i] ?? lastTemplateUsed) !== 'blank') continue;
			const bg = String(resolveMediaUrl((bgImagesByTemplate.blank ?? [])[i] ?? '')).trim();
			const vid = String((bgVideosByTemplate.blank ?? [])[i] ?? '').trim();
			if (bg || vid) out.push({ kind: 'background', template: 'blank', slide: i });
			for (const o of (slideOverlaysByTemplate.blank ?? [])[i] ?? []) {
				if (String(o.src ?? '').trim()) {
					out.push({ kind: 'overlay', template: 'blank', slide: i, overlayId: o.id });
				}
			}
		}
		return out;
	}

	function setStickerOverlaySrc(template: TemplateId, slide: number, overlayId: string, src: string) {
		const rows = slideOverlaysByTemplate[template] ?? [];
		const nextRows = rows.map((r) => [...r]);
		while (nextRows.length <= slide) nextRows.push([]);
		nextRows[slide] = (nextRows[slide] ?? []).map((o) => (o.id === overlayId ? { ...o, src } : o));
		slideOverlaysByTemplate = { ...slideOverlaysByTemplate, [template]: nextRows };
	}

	/** Replace existing blank-canvas photos (background + image stickers) from topic lines. */
	async function fillBlankImagesFromTopic(topic: string, lines: string[]) {
		const slots = collectBlankImageFillSlots();
		if (!slots.length) return;
		const topicTrim = topic.trim();
		for (let i = 0; i < slots.length; i++) {
			const slot = slots[i];
			const line = lines[i % lines.length] ?? topicTrim;
			const prompt = `${topicTrim}. ${line}`.trim().slice(0, 480) || topicTrim || 'editorial photo';
			pushUndo('blank', slot.slide);
			if (slot.kind === 'background') {
				await generateBackground(slot.slide, prompt, 'blank', i > 0);
			} else {
				await generateStickerOverlayImage(slot.slide, slot.overlayId, prompt, 'blank', i > 0);
			}
			if (i < slots.length - 1) {
				await new Promise<void>((r) => setTimeout(r, 350));
			}
		}
	}

	/** Fill all template text slots with AI copy derived from `topic`.
	 *  When called without arguments it uses the current `search` input value.
	 *  Pass an explicit topic (e.g. article content) to drive the fill from loaded article data.
	 *  `skipPrimary`: only fill text overlays — use after `fetchNews` so headlines stay article/variant copy. */
	async function fillInTextFromTopic(
		explicitTopic?: string,
		opts?: {
			skipPrimary?: boolean;
			skipBlankOverlays?: boolean;
			skipNewsOverlays?: boolean;
			skipNewsSubtext?: boolean;
		},
	) {
		fetchingNews = true;
		await tick();
		newsError = '';
		try {
			const topic = (explicitTopic ?? String(search || '')).trim();
			if (!topic) {
				newsError = 'Add a topic to fill in text.';
				return;
			}
			const topicSafety = assessUserTopicSafety(topic);
			if (!topicSafety.ok) {
				newsError = topicSafety.error;
				return;
			}

			const slots = collectFillSlots(!!opts?.skipPrimary, {
				skipBlankOverlays: !!opts?.skipBlankOverlays,
				skipNewsOverlays: !!opts?.skipNewsOverlays,
				skipNewsSubtext: opts?.skipNewsSubtext ?? !!opts?.skipPrimary,
			});
			if (!slots.length) {
				const onBlank = slideTemplates.some((t) => coerceTemplateId(t) === 'blank');
				if (onBlank && !opts?.skipBlankOverlays) {
					newsError =
						'Add text boxes or images to the blank canvas, then Load & Fill (or enter a topic and submit).';
				}
				return;
			}
			// One generated slide can provide multiple lines (headline/subheadline/body).
			const count = Math.max(1, Math.min(MAX_STUDIO_SLIDE_COUNT, slots.length));
			const res = await fetch('/api/generate-slides', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					topic,
					style: studioStyle,
					slideCount: Math.max(3, count),
					imageCount: 0,
					audience: studioAudiencePrompt || 'general audience',
					emotion: studioEmotion || undefined,
					autoHighlight: studioTextHighlightsEnabled,
				}),
			});
			const data = await res.json();
			if (isUsageLimitError(res, data)) {
				openUsageUpgrade(typeof data.error === 'string' ? data.error : undefined);
				await refreshStudioUsage();
				return;
			}
			if (!res.ok) throw new Error(data.error ?? 'Fill failed');
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
			} else {
				void refreshStudioUsage();
			}
			const gen = (data.slides ?? []) as any[];
			const lines = gen
				.flatMap((s) =>
					[s.headline, s.subheadline, s.body]
						.map((x) => (typeof x === 'string' ? x.trim() : ''))
						.filter(Boolean),
				)
				.map((s) => String(s ?? '').trim())
				.filter(Boolean);
			if (!lines.length) throw new Error('No generated text returned');

			// If the user is mid-inline-edit on News, clear the live buffer so replacements show immediately.
			if (newsHeadlineLive !== null) newsHeadlineLive = null;

			// Drop leftover “SLIDE N” labels on any template touched by this fill.
			{
				const nextOverlays = { ...slideTextOverlaysByTemplate };
				let overlaysChanged = false;
				for (let i = 0; i < slides.length; i++) {
					const tpl = coerceTemplateId(slideTemplates[i] ?? lastTemplateUsed);
					if (opts?.skipBlankOverlays && tpl === 'blank') continue;
					if (opts?.skipNewsOverlays && tpl === 'news') continue;
					const row = [...(nextOverlays[tpl] ?? [])];
					while (row.length <= i) row.push([]);
					const prev = row[i] ?? [];
					const filtered = prev.filter((o) => !isSlideNumberPlaceholder(o.text));
					if (filtered.length !== prev.length) {
						row[i] = filtered;
						nextOverlays[tpl] = row;
						overlaysChanged = true;
					}
				}
				if (overlaysChanged) slideTextOverlaysByTemplate = nextOverlays;
			}

			for (let i = 0; i < slots.length; i++) {
				const slot = slots[i];
				const text = lines[i % lines.length];
				if (slot.kind === 'textOverlay') {
					pushUndo(slot.template, slot.slide);
					setTextOverlayText(slot.template, slot.slide, slot.overlayId, text);
				} else if (slot.kind === 'newsSubtext') {
					pushUndo('news', slot.slide);
					while (newsSubtextBySlide.length <= slot.slide) {
						newsSubtextBySlide = [...newsSubtextBySlide, ''];
					}
					const previous = String(newsSubtextBySlide[slot.slide] ?? '').trim();
					/* Prefer a multi-sentence body when Default so we don’t collapse to one short line. */
					const bodyPool = [
						String(articleSnippet ?? '').trim(),
						lines.slice(i, i + 3).join(' ').trim(),
						text,
					]
						.filter(Boolean)
						.join(' ');
					const next = pickNewsSubtext({
						body: bodyPool || text,
						headline: String(slides[slot.slide] ?? '').trim(),
						previous,
						slideIndex: slot.slide,
					});
					newsSubtextBySlide = newsSubtextBySlide.map((x, idx) =>
						idx === slot.slide ? next : x,
					);
				} else {
					pushUndo(slot.template, slot.slide);
					applyPrimaryClampedToSlide(slot.slide, slot.template, text);
				}
			}

			const hasBlankSlides = slideTemplates.some((t) => coerceTemplateId(t) === 'blank');
			// Standalone topic-fill refreshes blank photos here. Load & Fill does it separately
			// after fetchNews so we don't double-hit Vertex when skipBlankOverlays is set.
			if (hasBlankSlides && !opts?.skipBlankOverlays) {
				await fillBlankImagesFromTopic(topic, lines);
			}
		} catch (e: any) {
			newsError = e?.message ?? String(e);
		} finally {
			await flushStudioLoadingPaint();
			fetchingNews = false;
		}
	}

	/**
	 * Bits UI ScrollLock sets body { pointer-events: none; overflow: hidden } while a
	 * popover/select is open. Stale locks or remounts mid-generate can freeze the UI.
	 */
	function studioOverlayChromeOpen(): boolean {
		return (
			bottomShadowPopoverOpen ||
			highlightPopoverOpen ||
			brandProfilePopoverOpen ||
			promptHistoryOpen ||
			showVideoTrim
		);
	}

	function clearDocumentBodyPointerLock() {
		if (typeof document === 'undefined') return;
		document.body.style.pointerEvents = '';
		document.body.style.overflow = '';
		document.body.style.removeProperty('--scrollbar-width');
		document.body.style.paddingRight = '';
		document.body.style.marginRight = '';
	}

	function bitsFloatingLayerOpenInDom(): boolean {
		if (typeof document === 'undefined') return false;
		return !!document.querySelector(
			'[data-slot="popover-content"][data-state="open"], [data-slot="select-content"][data-state="open"], [data-slot="dropdown-menu-content"][data-state="open"]',
		);
	}

	function releaseStudioPointerBlockers() {
		bottomShadowPopoverOpen = false;
		highlightPopoverOpen = false;
		brandProfilePopoverOpen = false;
		promptHistoryOpen = false;
		showVideoTrim = false;
		videoSeekSec = NaN;
		if (!filmstripPreviewInFlight && canvasRasterSlide !== null) {
			canvasRasterSlide = null;
		}
		clearDocumentBodyPointerLock();
	}

	/** Hard reset after Generate — clears stuck filmstrip raster + body lock. */
	function forceUnlockStudioUI() {
		releaseStudioPointerBlockers();
		if (!exporting && !exportingAll) {
			filmstripPreviewInFlight = false;
			filmstripBulkCapturing = false;
			canvasRasterSlide = null;
		}
		filmstripRecaptureNonce++;
		if (typeof document === 'undefined') return;
		clearDocumentBodyPointerLock();
		requestAnimationFrame(() => {
			clearDocumentBodyPointerLock();
			requestAnimationFrame(clearDocumentBodyPointerLock);
		});
	}

	function clearStuckBodyLockIfIdle() {
		if (typeof document === 'undefined') return;
		if (studioOverlayChromeOpen() || bitsFloatingLayerOpenInDom()) return;
		if (
			document.body.style.pointerEvents === 'none' ||
			document.body.style.overflow === 'hidden'
		) {
			clearDocumentBodyPointerLock();
		}
	}

	/** Generate / fetch can leave filmstrip raster state or body lock stuck. */
	let wasStudioGenerateBusy = $state(false);
	$effect(() => {
		const busy = studioGenerating || fetchingNews || generatingVariants;
		if (wasStudioGenerateBusy && !busy) {
			queueMicrotask(() => forceUnlockStudioUI());
		}
		wasStudioGenerateBusy = busy;
	});

	/** Never leave the main canvas non-interactive after filmstrip capture finishes. */
	$effect(() => {
		if (
			filmstripPreviewInFlight ||
			filmstripBulkCapturing ||
			exporting ||
			exportingAll
		) {
			return;
		}
		if (canvasRasterSlide !== null) canvasRasterSlide = null;
	});

	/** Abort a stuck filmstrip raster pass so Generate doesn't leave the UI frozen. */
	$effect(() => {
		if (!filmstripPreviewInFlight) return;
		const t = window.setTimeout(() => {
			if (!filmstripPreviewInFlight) return;
			filmstripPreviewInFlight = false;
			filmstripBulkCapturing = false;
			canvasRasterSlide = null;
			forceUnlockStudioUI();
		}, 20_000);
		return () => window.clearTimeout(t);
	});

	/** Load an article (or generate content) then immediately fill every template text slot.
	 *  This combines the old two-step workflow into one action. */
	async function loadAndFill() {
		if (usageBlocked) {
			openUsageUpgrade();
			return;
		}
		forceUnlockStudioUI();
		studioGenerating = true;
		fetchingNews = true;
		editingBrandCta = false;
		newsHeadlineLive = null;
		activeSlide = 0;
		await tick();
		// Load & Fill must always refresh media with live article/AI assets — never keep demo/test bgs.
		const prevGenerateImages = newsGenerateImages;
		newsGenerateImages = true;
		try {
			await fetchNews({ preferExistingDeck: true });
			if (usageUpgradeOpen) return;
			// After the article is loaded, also fill remaining non-News / non-blank text slots.
			// News + blank placeholders are already replaced inside fetchNews — do not stack a second
			// /api/generate-slides pass on those layers (that caused overlapping headlines).
			const syntheticTopic =
				newsContentMode === 'general'
					? generalTopicPrompt.trim()
					: newsContentMode === 'quote'
					? [quoteTopicCategory !== 'any' ? factTopics.find((t) => t.id === quoteTopicCategory)?.label ?? '' : '', quoteTopicPrompt.trim()]
							.filter(Boolean)
							.join(': ')
					: newsContentMode === 'fact'
						? [factTopicCategory !== 'any' ? factTopics.find((t) => t.id === factTopicCategory)?.label ?? '' : '', factTopicPrompt.trim()]
								.filter(Boolean)
								.join(': ')
						: newsContentMode === 'story'
							? storyTopicPrompt.trim()
							: newsContentMode === 'steps'
								? stepsTopicPrompt.trim()
								: '';
			const fillTopic = (articleSnippet || articleTitle || syntheticTopic || search || '').trim();
			if (fillTopic) {
				await fillInTextFromTopic(fillTopic, {
					skipPrimary: true,
					skipBlankOverlays: true,
					/* Free-form News text boxes only — built-in paragraphs already unique from fetchNews. */
					skipNewsOverlays: false,
					skipNewsSubtext: true,
				});
			}

			// Blank decks skip overlay fill above — still force live background/sticker regeneration.
			const hasBlankSlides = slideTemplates.some((t) => coerceTemplateId(t) === 'blank');
			if (hasBlankSlides) {
				const lines = splitBodyIntoPlaceholderLines(
					slides.find((s) => String(s ?? '').trim()) || articleTitle || fillTopic,
					articleSnippet || fillTopic,
				);
				await fillBlankImagesFromTopic(fillTopic || search || 'editorial photo', lines.length ? lines : [fillTopic || search || 'editorial photo']);
			}

			// Second pass: parallel slide Vertex calls can 429 the circle; overlay fill can also shift
			// scheduling. If any News badge is still empty, retry those slides after everything settles.
			const n = Math.max(1, slides.length);
			if (
				newsContentMode === 'general' ||
				newsContentMode === 'news' ||
				newsContentMode === 'fact' ||
				newsContentMode === 'story' ||
				newsContentMode === 'quote' ||
				newsContentMode === 'steps'
			) {
				await tick();
				const needCircle: number[] = [];
				for (let i = 0; i < n; i++) {
					if (coerceTemplateId(slideTemplates[i] ?? lastTemplateUsed) !== 'news') continue;
					if (!(showCircleBySlide[i] ?? false)) continue;
					if (isUnsetCircleImage(resolveMediaUrl(circleImages[i] ?? ''))) needCircle.push(i);
				}
				if (needCircle.length && newsImageSourceMode === 'assets') {
					await applyStockCircleImages(needCircle);
				} else {
					for (let k = 0; k < needCircle.length; k++) {
						await new Promise<void>((r) => setTimeout(r, 400));
						await generateCircleImage(needCircle[k], true);
						if (k < needCircle.length - 1) {
							await new Promise<void>((r) => setTimeout(r, 350));
						}
					}
				}
			}
		} finally {
			newsGenerateImages = prevGenerateImages;
			studioGenerating = false;
			fetchingNews = false;
			editingBrandCta = false;
			newsHeadlineLive = null;
			activeSlide = 0;
			forceUnlockStudioUI();
		}
	}

	// ── Generate supporting slide variants ────────────────────────────────
	async function generateVariants(hookText: string, rawText: string, template: TemplateId = 'news') {
		if (templateUsesLongBodyCopy(template)) {
			await fillTextCarouselDeck(hookText, rawText, slideCount, template);
			return;
		}
		try {
			const { copyStrings, tweetReplies, bodies } = await fetchDeckStoryBeats(
				hookText,
				rawText,
				slideCount,
				{
					includeReplies: template === 'tweet',
					autoHighlight: studioTextHighlightsEnabled,
					includeBodies: true,
				},
			);
			applyHeadlineStringsToTemplate(
				template,
				copyStrings,
				template === 'tweet' ? tweetReplies : undefined,
			);
			applyDeckSupportBodies(bodies, String(rawText || articleSnippet || '').trim());
		} catch (e: any) {
			console.error('[variants]', e.message);
			newsError = `Slide variants: ${e.message}`;
			// Still align slide text arrays to slideCount so imaging / filmstrip stay consistent.
			applyHeadlineStringsToTemplate(
				template,
				fallbackStoryBeats(hookText, rawText, slideCount),
			);
			applyDeckSupportBodies([], String(rawText || articleSnippet || '').trim());
		}
	}

	// ── Generate background image for a single slide ─────────────────────
	function setBgGeneratingFlag(template: TemplateId, slideIdx: number, value: boolean) {
		const { generating } = templateMediaArraysPadded(template, slideIdx);
		generatingImagesByTemplate = {
			...generatingImagesByTemplate,
			[template]: generating.map((v, i) => (i === slideIdx ? value : v)),
		};
	}

	function clearTemplateGeneratingFlags(template: TemplateId, len = slides.length) {
		const n = Math.max(1, len);
		generatingImagesByTemplate = {
			...generatingImagesByTemplate,
			[template]: new Array(n).fill(false),
		};
	}

	async function generateBackground(
		slideIdx: number,
		promptOverride?: string,
		template: TemplateId = 'news',
		skipVertexCache = false,
	) {
		setBgGeneratingFlag(template, slideIdx, true);
		bgError = '';

		try {
			// Solid fill paints above “no image” — clear it before Vertex so AI results show.
			if (template === 'news' || template === 'blank') {
				newsSolidBgBySlide = Array.from({ length: slides.length }, (_, idx) =>
					idx === slideIdx ? '' : (newsSolidBgBySlide[idx] ?? ''),
				);
			}
			const slideText = primarySlideTextForPrompt(template, slideIdx);
			const title = String(articleTitle ?? '').trim();
			// `??` skips only null/undefined — an empty headline must still fall back, or /api/vertex returns 400 "Missing prompt".
			const prompt =
				String(promptOverride ?? '').trim() ||
				slideText ||
				title ||
				'editorial news photo';
			if (newsImageSourceMode === 'assets') {
				await applyStockUrlsToSlides(template, [slideIdx], studioStockQuery() || prompt);
				return;
			}
			const res = await fetch('/api/vertex', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ prompt, aspect: '3:4', context: title || undefined, skipCache: skipVertexCache }),
				signal: AbortSignal.timeout(120_000),
			});

			const data = await res.json();
			if (data.dataUrl) {
				setSlideImage(slideIdx, data.dataUrl, template);
				if (studioImageGenBatchDepth === 0) {
					studioImageGenPaintHold = true;
					await flushStudioLoadingPaint();
					studioImageGenPaintHold = false;
				}
			} else if (data.demo) {
				bgError = data.message ?? 'Configure FAL_AI_API_KEY to enable AI images.';
				setBgGeneratingFlag(template, slideIdx, false);
			} else {
				bgError = data.error ?? (res.ok ? 'Image generation failed' : `Request failed (${res.status})`);
				setBgGeneratingFlag(template, slideIdx, false);
			}
		} catch (e: any) {
			const name = String(e?.name ?? '');
			bgError =
				name === 'TimeoutError' || name === 'AbortError'
					? 'Image generation timed out — try again.'
					: (e?.message ?? 'Image generation failed');
		} finally {
			setBgGeneratingFlag(template, slideIdx, false);
		}
	}

	async function generateStickerOverlayImage(
		slideIdx: number,
		overlayId: string,
		promptOverride?: string,
		template: TemplateId = 'blank',
		skipVertexCache = false,
	) {
		setBgGeneratingFlag(template, slideIdx, true);
		bgError = '';
		try {
			const slideText = primarySlideTextForPrompt(template, slideIdx);
			const title = String(articleTitle ?? '').trim();
			const prompt =
				String(promptOverride ?? '').trim() ||
				slideText ||
				title ||
				'editorial news photo';
			const res = await fetch('/api/vertex', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ prompt, aspect: '3:4', context: title || undefined, skipCache: skipVertexCache }),
				signal: AbortSignal.timeout(120_000),
			});
			const data = await res.json();
			if (data.dataUrl) {
				setStickerOverlaySrc(template, slideIdx, overlayId, data.dataUrl);
				if (studioImageGenBatchDepth === 0) {
					studioImageGenPaintHold = true;
					await flushStudioLoadingPaint();
					studioImageGenPaintHold = false;
				}
			} else if (data.demo) {
				bgError = data.message ?? 'Configure FAL_AI_API_KEY to enable AI images.';
			} else {
				bgError = data.error ?? (res.ok ? 'Image generation failed' : `Request failed (${res.status})`);
			}
		} catch (e: any) {
			const name = String(e?.name ?? '');
			bgError =
				name === 'TimeoutError' || name === 'AbortError'
					? 'Image generation timed out — try again.'
					: (e?.message ?? 'Image generation failed');
		} finally {
			setBgGeneratingFlag(template, slideIdx, false);
		}
	}

	/**
	 * News slides that have the primary circle badge on (per-slide “Shape” / circle toggle).
	 * If none are on but the deck has at least one News slide, use the first News slide so hook
	 * decks still get a default badge (matches prior single-slide behavior).
	 */
	function newsSlidesWithPrimaryCircle(n: number): number[] {
		const out: number[] = [];
		for (let i = 0; i < n; i++) {
			if (coerceTemplateId(slideTemplates[i] ?? lastTemplateUsed) !== 'news') continue;
			if (showCircleBySlide[i] ?? false) out.push(i);
		}
		if (!out.length) {
			const first = slideTemplates.findIndex((t) => coerceTemplateId(t) === 'news');
			if (first >= 0) out.push(first);
		}
		return out;
	}

	/**
	 * Like `generateAllSlideImages` but does not wipe overlays — used when "Fetch Live News"
	 * runs again on a deck that already had backgrounds (fillExistingDeck).
	 */
	async function refreshNewsDeckImagesAfterFetch(articleImageUrl?: string) {
		// Skip image generation if toggle is off
		if (!newsGenerateImages) {
			return;
		}
		
		studioImageGenBatchDepth++;
		const template: TemplateId = 'news';
		const n = Math.max(1, slides.length);
		try {
		const circleIdxs = newsSlidesWithPrimaryCircle(n);
		if (circleIdxs.length) {
			showCircleBySlide = Array.from({ length: n }, (_, i) =>
				circleIdxs.includes(i) ? true : (showCircleBySlide[i] ?? false),
			);
		}

		const blankBgRow = new Array(n).fill('');
		bgImagesByTemplate = { ...bgImagesByTemplate, [template]: blankBgRow };
		bgVideosByTemplate = { ...bgVideosByTemplate, [template]: new Array(n).fill('') };
		newsSolidBgBySlide = Array.from({ length: n }, () => '');
		generatingImagesByTemplate = {
			...generatingImagesByTemplate,
			[template]: new Array(n).fill(true),
		};

		// Clear badge images for every News slide that shows a circle so Load & Fill can refill all of them.
		// Also wipe the finance placeholder so it never survives a generate pass.
		const clearIdx = new Set(circleIdxs);
		circleImages = Array.from({ length: n }, (_, i) => {
			if (clearIdx.has(i)) return '';
			const cur = circleImages[i] ?? '';
			return isUnsetCircleImage(cur) ? '' : cur;
		});
		await tick();

		const articleSrc = String(articleImageUrl ?? '').trim();
		if (newsImageSourceMode === 'assets') {
			await applyStockUrlsToSlides(
				template,
				Array.from({ length: n }, (_, i) => i),
				studioStockQuery(),
			);
		} else {
		const skipSlide0Gen =
			newsImageSourceMode === 'pull' &&
			!!articleSrc &&
			templateAcceptsArticleHeroBackground(template);
		if (skipSlide0Gen) {
			applyNewsSeedBackgroundLayout();
			const safe = await toExportSafeImageUrl(articleSrc);
			if (String(safe ?? '').trim()) {
				applyNewsSeedBackgroundLayout();
				setSlideImage(0, safe, template);
			} else {
				setBgGeneratingFlag(template, 0, false);
			}
		}

		const promises = Array.from({ length: n }, (_, i) => {
			if (i === 0 && skipSlide0Gen) return Promise.resolve();
			const cleanText = primarySlideTextForPrompt(template, i);
			const prompt = i === 0 ? (articleTitle || cleanText) : cleanText;
			return generateBackground(i, prompt, template, true);
		});
	await Promise.all(promises);
		}

	// Space out circle vs N parallel slide requests so Vertex quota is less likely to 429 the badge.
	await new Promise<void>((r) => setTimeout(r, 1200));
	await fillNewsCircleImages(circleIdxs, true);

		studioImageGenPaintHold = true;
		await flushStudioLoadingPaint();
		studioImageGenPaintHold = false;
		} finally {
			clearTemplateGeneratingFlags(template, n);
			studioImageGenBatchDepth--;
		}
	}

	/**
	 * Replace backgrounds on every non-News media template in the current deck.
	 * Highlight / video layouts / tweet / article / imageQuote / whiteMedia / brandStack / etc.
	 * Stock mode prefers Pexels videos (same waterfall as News).
	 */
	async function refreshNonNewsDeckMediaAfterFetch(articleImageUrl?: string) {
		if (!newsGenerateImages) return;

		const groups = new Map<TemplateId, number[]>();
		for (let i = 0; i < slides.length; i++) {
			const t = coerceTemplateId(slideTemplates[i] ?? lastTemplateUsed);
			if (t === 'news' || t === 'blank' || t === 'blackText') continue;
			if (t === 'textCarousel' || t === 'whiteThread') continue;
			if (t !== 'tweet' && !templateUsesStockMedia(t)) continue;
			const list = groups.get(t) ?? [];
			list.push(i);
			groups.set(t, list);
		}
		if (!groups.size) return;

		await Promise.all(
			[...groups.entries()].map(([template, idxs]) =>
				refreshSlidesMediaForTemplate(template, idxs, articleImageUrl),
			),
		);
	}

	/** Refresh media for specific slides of one template (keeps overlays / layout). */
	async function refreshSlidesMediaForTemplate(
		template: TemplateId,
		slideIdxs: number[],
		articleImageUrl?: string,
	) {
		if (!newsGenerateImages || !slideIdxs.length) return;

		studioImageGenBatchDepth++;
		try {
			const genRow = [...(generatingImagesByTemplate[template] ?? [])];
			while (genRow.length < slides.length) genRow.push(false);
			for (const i of slideIdxs) genRow[i] = true;
			generatingImagesByTemplate = { ...generatingImagesByTemplate, [template]: genRow };

			const articleSrc = String(articleImageUrl ?? '').trim();
			if (newsImageSourceMode === 'assets') {
				await applyStockUrlsToSlides(template, slideIdxs, studioStockQuery());
			} else {
				const primarySlide = slideIdxs[0]!;
				const skipPrimaryGen =
					newsImageSourceMode === 'pull' &&
					!!articleSrc &&
					templateAcceptsArticleHeroBackground(template);
				if (skipPrimaryGen) {
					const safe = await toExportSafeImageUrl(articleSrc);
					if (String(safe ?? '').trim()) {
						setSlideImage(primarySlide, safe, template);
					} else {
						setBgGeneratingFlag(template, primarySlide, false);
					}
				}

				await Promise.all(
					slideIdxs.map((slideIdx) => {
						if (slideIdx === primarySlide && skipPrimaryGen) return Promise.resolve();
						const cleanText = primarySlideTextForPrompt(template, slideIdx);
						const prompt =
							slideIdx === primarySlide ? (articleTitle || cleanText) : cleanText;
						return generateBackground(slideIdx, prompt, template, true);
					}),
				);
			}

			studioImageGenPaintHold = true;
			await flushStudioLoadingPaint();
			studioImageGenPaintHold = false;
		} finally {
			clearTemplateGeneratingFlags(template);
			studioImageGenBatchDepth--;
		}
	}

// ── Generate unique images for all slides in parallel ─────────────────
	async function generateAllSlideImages(articleImageUrl?: string, template: TemplateId = 'news') {
		// Skip image generation if toggle is off
		if (!newsGenerateImages) {
			return;
		}
		
		studioImageGenBatchDepth++;
		try {
		const blankBgRow =
			template === 'blackText'
				? new Array(slides.length).fill(BLACK_TEXT_BG_DEFAULT)
				: new Array(slides.length).fill('');
		bgImagesByTemplate = { ...bgImagesByTemplate, [template]: blankBgRow };
		bgVideosByTemplate = { ...bgVideosByTemplate, [template]: new Array(slides.length).fill('') };
		if (template === 'news') {
			newsSolidBgBySlide = new Array(slides.length).fill('');
		}
		videoTrimStartSecBySlide = new Array(slides.length).fill(0);
		videoTrimEndSecBySlide = new Array(slides.length).fill(0);
		videoDurationBySlide = new Array(slides.length).fill(0);
		videoMutedBySlide = new Array(slides.length).fill(true);
		videoVolumeBySlide = new Array(slides.length).fill(0.8);
		generatingImagesByTemplate = {
			...generatingImagesByTemplate,
			[template]: new Array(slides.length).fill(true),
		};
		if (template === 'news') {
			slideOverlaysByTemplate = (Object.fromEntries(
				(Object.entries(slideOverlaysByTemplate) as [TemplateId, Overlay[][]][]).map(([k]) => [
					k,
					new Array(slides.length).fill(null).map(() => []),
				]),
			) as unknown) as Record<TemplateId, Overlay[][]>;
			slideTextOverlaysByTemplate = (Object.fromEntries(
				(Object.entries(slideTextOverlaysByTemplate) as [TemplateId, TextOverlay[][]][]).map(([k]) => [
					k,
					new Array(slides.length).fill(null).map(() => []),
				]),
			) as unknown) as Record<TemplateId, TextOverlay[][]>;
		} else {
			slideOverlaysByTemplate = {
				...slideOverlaysByTemplate,
				[template]: new Array(slides.length).fill(null).map(() => []),
			};
			slideTextOverlaysByTemplate = {
				...slideTextOverlaysByTemplate,
				[template]: new Array(slides.length).fill(null).map(() => []),
			};
		}
		slideTemplates = Array.from({ length: slides.length }, (_, i) => slideTemplates[i] ?? lastTemplateUsed);

		// Slide 0: use article image when "Pull first image from news"; assets = Unsplash+Pexels; else AI
		const articleSrc = String(articleImageUrl ?? '').trim();
		if (newsImageSourceMode === 'assets' && template !== 'blackText') {
			await applyStockUrlsToSlides(
				template,
				slides.map((_, i) => i),
				studioStockQuery(),
			);
		} else {
		const usePulledHero =
			newsImageSourceMode === 'pull' &&
			!!articleSrc &&
			templateAcceptsArticleHeroBackground(template);
		if (usePulledHero) {
			if (template === 'news') applyNewsSeedBackgroundLayout();
			const safe = await toExportSafeImageUrl(articleSrc);
			if (template === 'news' && String(safe ?? '').trim()) {
				applyNewsSeedBackgroundLayout();
			}
			setSlideImage(0, safe, template);
		}

		// Fire all Fal/AI requests in parallel (skip slide 0 when using pulled news image)
		const promises = slides.map((_, i) => {
			if (template === 'blackText') return Promise.resolve();
			if (i === 0 && usePulledHero) return Promise.resolve();
			const cleanText = primarySlideTextForPrompt(template, i);
			const prompt = i === 0
				? (articleTitle || cleanText)
				: cleanText; // supporting slides use their own copy as the image prompt
			return generateBackground(i, prompt, template);
		});

		await Promise.all(promises);
		}

		studioImageGenPaintHold = true;
		await flushStudioLoadingPaint();
		studioImageGenPaintHold = false;
		} finally {
			clearTemplateGeneratingFlags(template);
			studioImageGenBatchDepth--;
		}
	}

	// ── Subject cutout (AI background removal) ────────────────────────────
	async function cutOutSubject(slideIdx: number = activeSlide) {
		const t = coerceTemplateId(slideTemplates[slideIdx] ?? lastTemplateUsed);
		const raw = String((bgImagesByTemplate[t] ?? [])[slideIdx] ?? '').trim();
		if (!raw) {
			cutoutError = 'No background image on this slide to cut out.';
			alert(cutoutError);
			return;
		}
		if (String((bgVideosByTemplate[t] ?? [])[slideIdx] ?? '').trim()) {
			cutoutError = 'Cut out works on photo backgrounds — remove the video first.';
			alert(cutoutError);
			return;
		}
		await ensureR2Resolved(raw);
		const resolved = resolveMediaUrl(raw);
		if (!resolved || resolved.startsWith('r2:')) {
			cutoutError = 'Background is still loading — try again in a moment.';
			alert(cutoutError);
			return;
		}
		cutoutError = '';
		const n = Math.max(slides.length, slideIdx + 1, subjectCutouts.length, showCutout.length, cuttingOut.length, showCircleBySlide.length);
		const padStr = (arr: string[]) => Array.from({ length: n }, (_, i) => arr[i] ?? '');
		const padBool = (arr: boolean[]) => Array.from({ length: n }, (_, i) => arr[i] ?? false);
		cuttingOut = padBool(cuttingOut).map((v, i) => (i === slideIdx ? true : v));
		cutoutProgress = 0;
		cutoutMessage = 'Preparing image…';
		try {
			/* Remote CDN photos fail CORS inside onnx — proxy to a data URL first. */
			cutoutMessage = 'Loading photo…';
			const safeSrc = await toExportSafeImageUrl(resolved);
			if (!safeSrc || (!safeSrc.startsWith('data:') && !safeSrc.startsWith('blob:'))) {
				throw new Error(
					'Could not load this photo for cutout. Try a different image or upload one.',
				);
			}
			const dataUrl = await removeBackground(safeSrc, (p) => {
				cutoutProgress = p.progress ?? cutoutProgress;
				cutoutMessage = p.message ?? cutoutMessage;
			});
			if (!dataUrl.startsWith('data:image/')) {
				throw new Error('Cutout returned an empty result — try another photo.');
			}
			subjectCutouts = padStr(subjectCutouts).map((v, i) => (i === slideIdx ? dataUrl : v));
			// Auto-enable the toggle on first cutout so the user immediately sees the effect.
			showCutout = padBool(showCutout).map((v, i) => (i === slideIdx ? true : v));
			/* Editorial look: cutout overlaps the circle — turn the badge on if it was hidden. */
			if (!(showCircleBySlide[slideIdx] ?? false)) {
				showCircleBySlide = padBool(showCircleBySlide).map((v, i) =>
					i === slideIdx ? true : v,
				);
			}
		} catch (e: any) {
			cutoutError = e?.message ?? 'Background removal failed';
			alert(cutoutError);
		} finally {
			cuttingOut = padBool(cuttingOut).map((v, i) => (i === slideIdx ? false : v));
			cutoutMessage = '';
		}
	}

	function clearCutout(slideIdx: number = activeSlide) {
		subjectCutouts = subjectCutouts.map((v, i) => (i === slideIdx ? '' : v));
		showCutout    = showCutout.map((v, i) => (i === slideIdx ? false : v));
	}

	function toggleCutoutVisibility(slideIdx: number = activeSlide) {
		showCutout = showCutout.map((v, i) => (i === slideIdx ? !v : v));
	}

	// Keep slideTemplates aligned with slide count when slide text array changes (variants, etc.)
	$effect(() => {
		const n = slides.length;
		if (slideTemplates.length !== n) {
			slideTemplates = Array.from({ length: n }, (_, i) => slideTemplates[i] ?? lastTemplateUsed);
		}
		if (savedTemplateIdBySlide.length !== n) {
			savedTemplateIdBySlide = Array.from({ length: n }, (_, i) => savedTemplateIdBySlide[i] ?? '');
		}
		if (savedTemplateNameBySlide.length !== n) {
			savedTemplateNameBySlide = Array.from(
				{ length: n },
				(_, i) => savedTemplateNameBySlide[i] ?? '',
			);
		}
		// Ensure style maps have entries for each slide per template.
		// IMPORTANT: only assign when a length mismatch exists (avoid infinite $effect loop).
		let stylesNeedSync = false;
		for (const [, arr] of Object.entries(stylesByTemplateBySlide) as [TemplateId, Partial<Record<TextElementKind, TextStyle>>[]][]) {
			if (arr.length !== n) { stylesNeedSync = true; break; }
		}
		if (stylesNeedSync) {
			stylesByTemplateBySlide = (Object.fromEntries(
				(Object.entries(stylesByTemplateBySlide) as [TemplateId, Partial<Record<TextElementKind, TextStyle>>[]][]).map(([k, arr]) => [
					k,
					Array.from({ length: n }, (_, i) => arr[i] ?? {}),
				]),
			) as unknown) as Record<TemplateId, Partial<Record<TextElementKind, TextStyle>>[]>;
		}
		if (tweetStylesBySlide.length !== n) {
			tweetStylesBySlide = Array.from({ length: n }, (_, i) => tweetStylesBySlide[i] ?? {});
		}
		if (subjectCutouts.length !== n) {
			subjectCutouts = Array.from({ length: n }, (_, i) => subjectCutouts[i] ?? '');
		}
		if (newsSolidBgBySlide.length !== n) {
			newsSolidBgBySlide = Array.from({ length: n }, (_, i) => newsSolidBgBySlide[i] ?? '');
		}
		if (showCutout.length !== n) {
			showCutout = Array.from({ length: n }, (_, i) => showCutout[i] ?? false);
		}
		if (cuttingOut.length !== n) {
			cuttingOut = Array.from({ length: n }, (_, i) => cuttingOut[i] ?? false);
		}
		if (circleImages.length !== n) {
			circleImages = Array.from({ length: n }, (_, i) => circleImages[i] ?? '');
		}
		if (circle2Images.length !== n) {
			circle2Images = Array.from({ length: n }, (_, i) => circle2Images[i] ?? '');
		}
		if (showCircle2BySlide.length !== n) {
			showCircle2BySlide = Array.from({ length: n }, (_, i) => showCircle2BySlide[i] ?? false);
		}
		if (showCircleBySlide.length !== n) {
			showCircleBySlide = Array.from({ length: n }, (_, i) =>
				i < showCircleBySlide.length ? showCircleBySlide[i] ?? false : false,
			);
		}
		if (tweetTopNameBySlide.length !== n) {
			tweetTopNameBySlide = Array.from({ length: n }, (_, i) => tweetTopNameBySlide[i] ?? 'Chef 👨‍🍳');
		}
		if (tweetTopHandleBySlide.length !== n) {
			tweetTopHandleBySlide = Array.from({ length: n }, (_, i) => tweetTopHandleBySlide[i] ?? '@chefsevenn');
		}
		if (tweetTopTextBySlide.length !== n) {
			tweetTopTextBySlide = Array.from({ length: n }, (_, i) => tweetTopTextBySlide[i] ?? 'Ketchup or mayo or mustard?');
		}
		if (tweetBottomNameBySlide.length !== n) {
			tweetBottomNameBySlide = Array.from({ length: n }, (_, i) => tweetBottomNameBySlide[i] ?? 'Mo Mohler');
		}
		if (tweetBottomHandleBySlide.length !== n) {
			tweetBottomHandleBySlide = Array.from({ length: n }, (_, i) => tweetBottomHandleBySlide[i] ?? '@MoMohler');
		}
		if (tweetBottomTextBySlide.length !== n) {
			tweetBottomTextBySlide = Array.from({ length: n }, (_, i) => tweetBottomTextBySlide[i] ?? '');
		}
if (tweetTopImageHeightBySlide.length !== n) {
			tweetTopImageHeightBySlide = Array.from({ length: n }, (_, i) => tweetTopImageHeightBySlide[i] ?? 720);
		}
		if (tweetTopImageWidthBySlide.length !== n) {
			tweetTopImageWidthBySlide = Array.from({ length: n }, (_, i) => tweetTopImageWidthBySlide[i] ?? 920);
		}
		if (tweetTopImageZoomBySlide.length !== n) {
			tweetTopImageZoomBySlide = Array.from({ length: n }, (_, i) => tweetTopImageZoomBySlide[i] ?? 1);
		}
		if (tweetTopImagePanXBySlide.length !== n) {
			tweetTopImagePanXBySlide = Array.from({ length: n }, (_, i) => tweetTopImagePanXBySlide[i] ?? 50);
		}
		if (tweetTopImagePanYBySlide.length !== n) {
			tweetTopImagePanYBySlide = Array.from({ length: n }, (_, i) => tweetTopImagePanYBySlide[i] ?? 50);
		}
		if (tweetTopAvatarImageBySlide.length !== n) {
			tweetTopAvatarImageBySlide = Array.from({ length: n }, (_, i) => tweetTopAvatarImageBySlide[i] ?? '');
		}
		if (tweetTopAvatarModeBySlide.length !== n) {
			tweetTopAvatarModeBySlide = Array.from({ length: n }, (_, i) =>
				tweetTopAvatarModeBySlide[i] === 'image' || tweetTopAvatarModeBySlide[i] === 'text'
					? tweetTopAvatarModeBySlide[i]
					: String(tweetTopAvatarImageBySlide[i] ?? '').trim()
						? 'image'
						: 'text',
			);
		}
		if (tweetTopAvatarInnerBgBySlide.length !== n) {
			tweetTopAvatarInnerBgBySlide = Array.from({ length: n }, (_, i) => tweetTopAvatarInnerBgBySlide[i] ?? '');
		}
		if (tweetTopAvatarLabelBySlide.length !== n) {
			tweetTopAvatarLabelBySlide = Array.from({ length: n }, (_, i) => tweetTopAvatarLabelBySlide[i] ?? '');
		}
		if (tweetTopAvatarRingColorBySlide.length !== n) {
			tweetTopAvatarRingColorBySlide = Array.from({ length: n }, (_, i) => tweetTopAvatarRingColorBySlide[i] ?? '#c9b97a');
		}
		if (tweetTopAvatarRingWidthBySlide.length !== n) {
			tweetTopAvatarRingWidthBySlide = Array.from({ length: n }, (_, i) => tweetTopAvatarRingWidthBySlide[i] ?? 4);
		}
		if (tweetBottomAvatarImageBySlide.length !== n) {
			tweetBottomAvatarImageBySlide = Array.from({ length: n }, (_, i) => tweetBottomAvatarImageBySlide[i] ?? '');
		}
		if (tweetBottomAvatarModeBySlide.length !== n) {
			tweetBottomAvatarModeBySlide = Array.from({ length: n }, (_, i) =>
				tweetBottomAvatarModeBySlide[i] === 'image' || tweetBottomAvatarModeBySlide[i] === 'text'
					? tweetBottomAvatarModeBySlide[i]
					: String(tweetBottomAvatarImageBySlide[i] ?? '').trim()
						? 'image'
						: 'text',
			);
		}
		if (tweetBottomAvatarInnerBgBySlide.length !== n) {
			tweetBottomAvatarInnerBgBySlide = Array.from({ length: n }, (_, i) => tweetBottomAvatarInnerBgBySlide[i] ?? '');
		}
		if (tweetBottomAvatarLabelBySlide.length !== n) {
			tweetBottomAvatarLabelBySlide = Array.from({ length: n }, (_, i) => tweetBottomAvatarLabelBySlide[i] ?? '');
		}
		if (tweetBottomAvatarRingColorBySlide.length !== n) {
			tweetBottomAvatarRingColorBySlide = Array.from({ length: n }, (_, i) => tweetBottomAvatarRingColorBySlide[i] ?? '#c9b97a');
		}
		if (tweetBottomAvatarRingWidthBySlide.length !== n) {
			tweetBottomAvatarRingWidthBySlide = Array.from({ length: n }, (_, i) => tweetBottomAvatarRingWidthBySlide[i] ?? 4);
		}
		if (articleTextBySlide.length !== n) {
			articleTextBySlide = Array.from({ length: n }, (_, i) => articleTextBySlide[i] ?? '');
		}
		if (newsSubtextBySlide.length !== n) {
			newsSubtextBySlide = Array.from({ length: n }, (_, i) => newsSubtextBySlide[i] ?? '');
		}
		if (textCarouselTextBySlide.length !== n) {
			textCarouselTextBySlide = Array.from({ length: n }, (_, i) => textCarouselTextBySlide[i] ?? '');
		}
		if (imageQuoteTextBySlide.length !== n) {
			imageQuoteTextBySlide = Array.from({ length: n }, (_, i) => imageQuoteTextBySlide[i] ?? '');
		}
		if (textCarouselNameBySlide.length !== n) {
			textCarouselNameBySlide = Array.from({ length: n }, (_, i) => textCarouselNameBySlide[i] ?? 'Captains of industry');
		}
		if (textCarouselHandleBySlide.length !== n) {
			textCarouselHandleBySlide = Array.from({ length: n }, (_, i) => textCarouselHandleBySlide[i] ?? '@captainsofindustryy');
		}
		if (textCarouselAvatarImageBySlide.length !== n) {
			textCarouselAvatarImageBySlide = Array.from({ length: n }, (_, i) => textCarouselAvatarImageBySlide[i] ?? '');
		}
		if (textCarouselAvatarModeBySlide.length !== n) {
			textCarouselAvatarModeBySlide = Array.from({ length: n }, (_, i) =>
				textCarouselAvatarModeBySlide[i] === 'image' || textCarouselAvatarModeBySlide[i] === 'text'
					? textCarouselAvatarModeBySlide[i]
					: String(textCarouselAvatarImageBySlide[i] ?? '').trim()
						? 'image'
						: 'text',
			);
		}
		if (textCarouselAvatarInnerBgBySlide.length !== n) {
			textCarouselAvatarInnerBgBySlide = Array.from({ length: n }, (_, i) => textCarouselAvatarInnerBgBySlide[i] ?? '');
		}
		if (textCarouselAvatarLabelBySlide.length !== n) {
			textCarouselAvatarLabelBySlide = Array.from({ length: n }, (_, i) => textCarouselAvatarLabelBySlide[i] ?? '');
		}
		if (textCarouselAvatarRingColorBySlide.length !== n) {
			textCarouselAvatarRingColorBySlide = Array.from({ length: n }, (_, i) => textCarouselAvatarRingColorBySlide[i] ?? '#c9b97a');
		}
		if (textCarouselAvatarRingWidthBySlide.length !== n) {
			textCarouselAvatarRingWidthBySlide = Array.from({ length: n }, (_, i) => textCarouselAvatarRingWidthBySlide[i] ?? 5);
		}
		if (imageQuoteFooterLeftBySlide.length !== n) {
			imageQuoteFooterLeftBySlide = Array.from({ length: n }, (_, i) => imageQuoteFooterLeftBySlide[i] ?? IMAGE_QUOTE_DEFAULTS.footerLeft);
		}
		if (imageQuoteFooterRightBySlide.length !== n) {
			imageQuoteFooterRightBySlide = Array.from({ length: n }, (_, i) => imageQuoteFooterRightBySlide[i] ?? IMAGE_QUOTE_DEFAULTS.footerRight);
		}
		{
			const nextTop = { ...filmStripTopPctByTemplate };
			const nextBottom = { ...filmStripBottomPctByTemplate };
			let changed = false;
			for (const id of FILM_STRIP_TEMPLATE_IDS) {
				const tops = nextTop[id] ?? [];
				const bottoms = nextBottom[id] ?? [];
				if (tops.length !== n) {
					nextTop[id] = Array.from(
						{ length: n },
						(_, i) => tops[i] ?? filmStripDefaultsFor(id).topPct,
					);
					changed = true;
				}
				if (bottoms.length !== n) {
					nextBottom[id] = Array.from(
						{ length: n },
						(_, i) => bottoms[i] ?? filmStripDefaultsFor(id).bottomPct,
					);
					changed = true;
				}
			}
			if (changed) {
				filmStripTopPctByTemplate = nextTop;
				filmStripBottomPctByTemplate = nextBottom;
			}
		}
		if (videoStoryHeadlineBySlide.length !== n) {
			videoStoryHeadlineBySlide = Array.from(
				{ length: n },
				(_, i) => videoStoryHeadlineBySlide[i] ?? VIDEO_STORY_DEFAULTS.headline,
			);
		}
		if (videoStoryWatermarkBySlide.length !== n) {
			videoStoryWatermarkBySlide = Array.from(
				{ length: n },
				(_, i) => videoStoryWatermarkBySlide[i] ?? VIDEO_STORY_DEFAULTS.watermark,
			);
		}
		if (brandStackBrandBySlide.length !== n) {
			brandStackBrandBySlide = Array.from(
				{ length: n },
				(_, i) => brandStackBrandBySlide[i] ?? BRAND_STACK_DEFAULTS.brand,
			);
		}
		if (brandStackBottomMediaBySlide.length !== n) {
			brandStackBottomMediaBySlide = Array.from(
				{ length: n },
				(_, i) => brandStackBottomMediaBySlide[i] ?? BRAND_STACK_DEFAULTS.bottomMediaUrl,
			);
		}
		if (videoSplitCompositedBySlide.length !== n) {
			videoSplitCompositedBySlide = Array.from(
				{ length: n },
				(_, i) => videoSplitCompositedBySlide[i] ?? false,
			);
		}
		if (blackTextHeadlineBySlide.length !== n) {
			blackTextHeadlineBySlide = Array.from(
				{ length: n },
				(_, i) => blackTextHeadlineBySlide[i] ?? BLACK_TEXT_CAROUSEL_DEFAULTS.headline,
			);
		}
		if (blackTextBodyBySlide.length !== n) {
			blackTextBodyBySlide = Array.from(
				{ length: n },
				(_, i) => blackTextBodyBySlide[i] ?? BLACK_TEXT_CAROUSEL_DEFAULTS.body,
			);
		}
		if (articleSwipeTextBySlide.length !== n) {
			articleSwipeTextBySlide = Array.from({ length: n }, (_, i) => articleSwipeTextBySlide[i] ?? '«« Swipe');
		}
		if (articleLogoSrcBySlide.length !== n) {
			articleLogoSrcBySlide = Array.from({ length: n }, (_, i) => articleLogoSrcBySlide[i] ?? '');
		}
	});

	// Seed dummy content the first time slides render (don’t overwrite real content).
	let didSeedSlideDefaults = $state(false);
	$effect(() => {
		if (didSeedSlideDefaults) return;
		if (draftRestoring) return;
		if (!slides.length) return;

		let changed = false;
		const DEFAULT_ARTICLE =
			"Here's the trillion-dollar problem everyone avoids.\n\nTo break it down:\n\nA *1-gigawatt AI data center* costs roughly *$80B* to build & operate.";

		const nextArticleText = articleTextBySlide.map((v, i) => {
			if (slideTemplates[i] !== 'article') return v;
			const cur = (v ?? '').trim();
			if (cur) return v;
			changed = true;
			return DEFAULT_ARTICLE;
		});
		if (changed) articleTextBySlide = nextArticleText;

		didSeedSlideDefaults = true;
	});

	// Clear toolbar selection when user switches slides or template.
	$effect(() => {
		activeSlide;
		activeTemplate;
		closeToolbar();
	});

	// ── Generate circle image via Vertex ─────────────────────────────────
	/** Returns true when a `dataUrl` was applied to `circleImages[slideIdx]`. */
	async function generateCircleImage(slideIdx: number = activeSlide, skipVertexCache = false): Promise<boolean> {
		generatingCircle = true;
		let ok = false;
		try {
			const { headline, topic, prompt: subject } = circleSearchContext(slideIdx);
			const basePrompt =
				`Square editorial close-up for an Instagram news badge. ` +
				`Subject must match THIS slide: "${subject}". ` +
				(headline ? `Slide headline: "${headline}". ` : '') +
				(topic ? `Deck topic: "${topic}". ` : '') +
				`Single strong real-world subject (place, object, person-in-context, landmark detail). ` +
				`No text, no logos, no UI screens, no stock-market charts, no candlesticks, no dashboards. ` +
				`Dramatic lighting, tight crop that reads in a small circle.`;

			const maxAttempts = 4;
			for (let attempt = 0; attempt < maxAttempts; attempt++) {
				const prompt =
					attempt === 0 ? basePrompt : `${basePrompt} (unique render ${Date.now()}-${attempt})`;
				const res = await fetch('/api/vertex', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						prompt,
						aspect: '1:1',
						context: topic || headline || undefined,
						skipCache: skipVertexCache || attempt > 0,
					}),
				});
				let data: { dataUrl?: string; demo?: boolean; message?: string; error?: string } = {};
				try {
					data = await res.json();
				} catch {
					data = {};
				}
				if (data.dataUrl) {
					const url = data.dataUrl;
					const n = Math.max(slides.length, slideIdx + 1);
					const padded = Array.from({ length: n }, (_, i) => circleImages[i] ?? '');
					circleImages = padded.map((v, i) => (i === slideIdx ? url : v));
					ok = true;
					break;
				}
				if (data.demo) {
					bgError = data.message ?? 'Configure FAL_AI_API_KEY to enable AI images.';
					break;
				}
				const errStr = String(data.error ?? (res.ok ? '' : `Request failed (${res.status})`));
				if (data.error) bgError = errStr;
				const retryable =
					attempt < maxAttempts - 1 &&
					(res.status === 429 ||
						res.status === 503 ||
						res.status === 502 ||
						/429|503|502|rate|quota/i.test(errStr));
				if (retryable) {
					const backoff = Math.min(10_000, 450 * 2 ** attempt);
					await new Promise<void>((r) => setTimeout(r, backoff));
					continue;
				}
				break;
			}
		} catch {
			/* ignore */
		}
		generatingCircle = false;
		return ok;
	}

	async function generateCircleFromPrompt(which: 1 | 2) {
		// Open Tailwind prompt modal instead of window.prompt()
		openCircleAIModal(which);
	}

	// ── Circle AI modal state ─────────────────────────────────────────────
	let circleAIModalFor = $state<1 | 2 | null>(null);
	let circleAIPrompt = $state('');
	let circleAIGenerating = $state(false);

	function openCircleAIModal(which: 1 | 2) {
		circleAIModalFor = which;
		circleAIPrompt = '';
	}
	function closeCircleAIModal() {
		circleAIModalFor = null;
		circleAIPrompt = '';
		circleAIGenerating = false;
	}

	// ── Background AI modal ───────────────────────────────────────────────
	let bgAIModalOpen = $state(false);
	let bgAIPrompt = $state('');
	let bgAIRecommended = $state('');
	let bgAIGenerating = $state(false);

	function recommendedBgPrompt(
		template: TemplateId = previewTemplate,
		slideIdx: number = paintSlide,
	): string {
		const slideText = primarySlideTextForPrompt(template, slideIdx);
		const title = String(articleTitle ?? '').trim();
		return slideText || title || 'editorial news photo';
	}

	function openBgAIModal() {
		closeNewsBgToolbar();
		bgAIRecommended = recommendedBgPrompt();
		bgAIPrompt = '';
		bgAIModalOpen = true;
	}

	function closeBgAIModal() {
		bgAIModalOpen = false;
		bgAIPrompt = '';
		bgAIGenerating = false;
	}

	async function submitBgAIModal() {
		const prompt = bgAIPrompt.trim() || bgAIRecommended;
		if (!prompt) return;
		bgAIGenerating = true;
		try {
			await generateBackground(paintSlide, prompt, previewTemplate);
			closeBgAIModal();
		} finally {
			bgAIGenerating = false;
		}
	}

	async function submitCircleAIModal() {
		if (!circleAIModalFor) return;
		const which = circleAIModalFor;
		const userPrompt = circleAIPrompt.trim();
		if (!userPrompt) return;
		circleAIGenerating = true;
		if (which === 1) generatingCircle = true;
		try {
			const prompt = `Bold editorial close-up photo. ${userPrompt}. Square crop, single strong subject, dramatic lighting, no text.`;
			const res = await fetch('/api/vertex', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ prompt, aspect: '1:1' }),
			});
			const data = await res.json();
			if (data.dataUrl) {
				if (which === 1) {
					circleImages = circleImages.map((v, i) => (i === activeSlide ? data.dataUrl : v));
					showCircleBySlide = showCircleBySlide.map((v, i) => (i === activeSlide ? true : v));
				} else {
					circle2Images = circle2Images.map((v, i) => (i === activeSlide ? data.dataUrl : v));
					showCircle2BySlide = showCircle2BySlide.map((v, i) => (i === activeSlide ? true : v));
				}
			}
		} catch {
			/* ignore */
		} finally {
			if (which === 1) generatingCircle = false;
			circleAIGenerating = false;
			closeCircleAIModal();
		}
	}

	const NEWS_SOLID_PRESETS = [
		'#0a0a0a',
		'#111827',
		'#1e1b4b',
		'#0c4a6e',
		'#134e4a',
		'#4c1d95',
		'#831843',
		'#ffffff',
		'#f8fafc',
	] as const;

	function normalizeSolidHex(v: string): string {
		const t = v.trim();
		if (/^#[0-9a-fA-F]{6}$/.test(t)) return t;
		if (/^#[0-9a-fA-F]{3}$/.test(t)) {
			const h = t.slice(1);
			return (
				'#' +
				h
					.split('')
					.map((ch) => ch + ch)
					.join('')
			);
		}
		return '#0a0a0a';
	}

	function applyTemplateSolidBg(hex: string, slideIdx = activeSlide, template?: TemplateId) {
		const t = template ?? coerceTemplateId(slideTemplates[slideIdx] ?? 'news');
		if (t !== 'news' && t !== 'blank') return;
		const c = normalizeSolidHex(hex);
		clearSlideBackground(slideIdx);
		newsSolidBgBySlide = Array.from({ length: slides.length }, (_, i) =>
			i === slideIdx ? c : (newsSolidBgBySlide[i] ?? '')
		);
		const low = c.toLowerCase();
		if (low === '#000000' || low === '#000' || low === '#0a0a0a') canvasBgDark = true;
		else if (low === '#ffffff' || low === '#fff' || low === '#f8fafc') canvasBgDark = false;
		solidBgPopoverOpen = false;
	}

	function resetNewsSolidToGradient(slideIdx = activeSlide) {
		const t = coerceTemplateId(slideTemplates[slideIdx] ?? 'news');
		if (t !== 'news' && t !== 'blank') return;
		newsSolidBgBySlide = Array.from({ length: slides.length }, (_, i) =>
			i === slideIdx ? '' : (newsSolidBgBySlide[i] ?? '')
		);
		solidBgPopoverOpen = false;
	}

	// ── Handle image uploads ──────────────────────────────────────────────
	async function handleBgUpload(e: Event) {
		const input = e.target as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;
		input.value = '';
		const idx = activeSlide;
		const t = activeTemplate;
		try {
			const dataUrl = await prepareImageAsDataUrl(file, {
				maxDim: 1600,
				maxBytes: 1_800_000,
				quality: 0.85,
			});
			setSlideImage(idx, dataUrl, t);
		} catch (err) {
			console.warn('[studio] bg upload failed', err);
			alert(err instanceof Error ? err.message : 'Image upload failed');
		}
	}

	/** Apply a saved library asset (`r2:…`) as the active slide background. */
	async function applyAssetAsBackground(r2Ref: string) {
		const ref = String(r2Ref ?? '').trim();
		if (!ref) return;
		try {
			await ensureR2Resolved(ref);
			const resolved = resolveMediaUrl(ref);
			if (!resolved) {
				alert('Could not load this asset — try again or re-upload it.');
				return;
			}
			const t = activeTemplate;
			const i = activeSlide;
			if (looksLikeVideoUrl(resolved) || looksLikeVideoUrl(ref)) {
				backgroundMediaLoading = true;
				freezePreviewShell();
				try {
					if (t === 'news' || t === 'blank') applyNewsSeedBackgroundLayout();
					const blobUrl = resolved.startsWith('blob:') || resolved.startsWith('data:')
						? resolved
						: await fetchRemoteVideoAsBlobUrl(resolved);
					setSlideVideo(i, blobUrl, t);
					await waitForCanvasVideoReady();
				} finally {
					backgroundMediaLoading = false;
					releasePreviewShellSoon();
					studioSizeTransitions = false;
					window.setTimeout(() => {
						if (!backgroundMediaLoading) studioSizeTransitions = true;
					}, 280);
				}
				return;
			}
			// Prefer a data URL so Save template / Export aren't blocked by R2 CORS.
			const safe = await toExportSafeImageUrl(ref.startsWith('r2:') ? ref : resolved);
			const finalUrl = String(safe ?? '').trim() || resolved;
			// Clear video without wiping the image slot (setSlideVideo blanks images).
			const vids = templateMediaArraysPadded(t, i).videos;
			bgVideosByTemplate = {
				...bgVideosByTemplate,
				[t]: vids.map((v, idx) => (idx === i ? '' : v)),
			};
			if (t === 'news' || t === 'blank') applyNewsSeedBackgroundLayout();
			setSlideImage(i, finalUrl, t);
		} catch (e: unknown) {
			alert(e instanceof Error ? e.message : 'Could not apply asset');
		}
	}

	/** Brand stack: apply a library asset to the bottom media slot. */
	async function applyAssetAsBottomBackground(r2Ref: string) {
		const ref = String(r2Ref ?? '').trim();
		if (!ref) return;
		await ensureR2Resolved(ref);
		setBrandStackBottomMedia(activeSlide, ref);
	}

	/** Apply an Unsplash photo as the active slide background (CORS-safe data URL for export). */
	async function applyUnsplashAsBackground(photo: {
		url: string;
		downloadLocation: string;
		photographer: string;
	}) {
		const src = String(photo?.url ?? '').trim();
		if (!src) return;
		backgroundMediaLoading = true;
		freezePreviewShell();
		try {
			// Guideline: ping download endpoint when a photo is used
			if (photo.downloadLocation) {
				void fetch('/api/unsplash/download', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ downloadLocation: photo.downloadLocation }),
				}).catch(() => {});
			}
			const safe = await toExportSafeImageUrl(src);
			const finalUrl = String(safe ?? '').trim() || src;
			if (activeTemplate === 'news') applyNewsSeedBackgroundLayout();
			setSlideImage(activeSlide, finalUrl, activeTemplate);
			if (photo.photographer) {
				console.info(`[unsplash] Photo by ${photo.photographer} on Unsplash`);
			}
		} finally {
			backgroundMediaLoading = false;
			releasePreviewShellSoon();
			studioSizeTransitions = false;
			window.setTimeout(() => {
				if (!backgroundMediaLoading) studioSizeTransitions = true;
			}, 280);
		}
	}

	/** Freeze the preview shell so loading media can't resize the canvas mid-apply. */
	function freezePreviewShell() {
		const w = previewDisplayW;
		const h = previewDisplayH;
		if (Number.isFinite(w) && Number.isFinite(h) && w > 0 && h > 0) {
			bootShellW = w;
			bootShellH = h;
		}
	}

	function releasePreviewShellSoon() {
		requestAnimationFrame(() => {
			bootShellW = null;
			bootShellH = null;
		});
	}

	/** Wait until the canvas `<video>` has a decoded frame (or timeout), then play. */
	async function waitForCanvasVideoReady(timeoutMs = 8000): Promise<void> {
		await tick();
		await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
		const node = exportRef;
		const videos = Array.from(node?.querySelectorAll?.('video') ?? []) as HTMLVideoElement[];
		if (!videos.length) return;
		await Promise.all(
			videos.map(
				(video) =>
					new Promise<void>((resolve) => {
						const done = () => {
							video.removeEventListener('loadeddata', done);
							video.removeEventListener('canplay', done);
							video.removeEventListener('error', done);
							resolve();
						};
						if (video.readyState >= 2 && video.videoWidth > 0) {
							resolve();
							return;
						}
						video.addEventListener('loadeddata', done);
						video.addEventListener('canplay', done);
						video.addEventListener('error', done);
						setTimeout(done, timeoutMs);
					}),
			),
		);
		for (const video of videos) playMediaVideo(video);
	}

	/** Apply a Pexels stock video as the active slide background (blob URL so export isn't CORS-blocked). */
	async function applyPexelsVideoAsBackground(video: {
		url: string;
		thumb?: string;
		photographer?: string;
		duration?: number;
	}) {
		const src = String(video?.url ?? '').trim();
		if (!src) throw new Error('Video URL missing');
		backgroundMediaLoading = true;
		freezePreviewShell();
		try {
			const blobUrl = await fetchRemoteVideoAsBlobUrl(src);
			if (activeTemplate === 'news' || activeTemplate === 'blank') applyNewsSeedBackgroundLayout();
			setSlideVideo(activeSlide, blobUrl, activeTemplate);
			const dur = Number(video?.duration ?? 0);
			if (Number.isFinite(dur) && dur > 0) {
				videoDurationBySlide = Array.from({ length: slides.length }, (_, idx) =>
					idx === activeSlide ? dur : (Number.isFinite(videoDurationBySlide[idx]) ? Math.max(0, videoDurationBySlide[idx]) : 0),
				);
				videoTrimEndSecBySlide = Array.from({ length: slides.length }, (_, idx) =>
					idx === activeSlide ? dur : (Number.isFinite(videoTrimEndSecBySlide[idx]) ? Math.max(0, videoTrimEndSecBySlide[idx]) : 0),
				);
				videoTrimStartSecBySlide = Array.from({ length: slides.length }, (_, idx) =>
					idx === activeSlide ? 0 : (Number.isFinite(videoTrimStartSecBySlide[idx]) ? Math.max(0, videoTrimStartSecBySlide[idx]) : 0),
				);
			}
			await waitForCanvasVideoReady();
			if (video.photographer) {
				console.info(`[pexels] Video by ${video.photographer} on Pexels`);
			}
		} finally {
			backgroundMediaLoading = false;
			releasePreviewShellSoon();
			// Avoid a width/height tween right as the video appears.
			studioSizeTransitions = false;
			window.setTimeout(() => {
				if (!backgroundMediaLoading) studioSizeTransitions = true;
			}, 280);
		}
	}

	/** Add a saved library asset as an image sticker on the active slide. */
	async function applyAssetAsSticker(r2Ref: string) {
		const ref = String(r2Ref ?? '').trim();
		if (!ref) return;
		await ensureR2Resolved(ref);
		const resolved = resolveMediaUrl(ref);
		if (!resolved) {
			alert('Could not load this asset — try again or re-upload it.');
			return;
		}
		const measureSrc = resolved;
		const placeOverlay = (naturalW: number, naturalH: number) => {
			const aspect = naturalW / Math.max(1, naturalH);
			const w = Math.min(300, naturalW || 300);
			const h = w / aspect;
			const idx = activeSlide;
			const newOverlay: Overlay = {
				id: crypto.randomUUID(),
				src: ref,
				x: Math.round((CANVAS_W - w) / 2),
				y: Math.round((CANVAS_H - h) / 2),
				w: Math.round(w),
				h: Math.round(h),
			};
			const current = (slideOverlaysByTemplate[activeTemplate] ?? [])[idx] ?? [];
			setSlideOverlays(idx, [...current, newOverlay], activeTemplate);
		};
		if (looksLikeVideoUrl(resolved) || looksLikeVideoUrl(ref)) {
			const video = document.createElement('video');
			video.preload = 'metadata';
			video.onloadedmetadata = () => {
				placeOverlay(video.videoWidth || 300, video.videoHeight || 300);
			};
			video.onerror = () => {
				alert('Could not load this asset video.');
			};
			video.src = measureSrc;
			return;
		}
		const img = new window.Image();
		img.onload = () => {
			placeOverlay(img.naturalWidth || 300, img.naturalHeight || 300);
		};
		img.onerror = () => {
			alert('Could not load this asset image.');
		};
		img.src = measureSrc;
	}

	async function handleVideoUpload(e: Event) {
		const file = (e.target as HTMLInputElement).files?.[0];
		if (!file) return;
		const t = activeTemplate;
		backgroundMediaLoading = true;
		freezePreviewShell();
		try {
			if (t === 'news' || t === 'blank') applyNewsSeedBackgroundLayout();
			const url = URL.createObjectURL(file);
			setSlideVideo(activeSlide, url, t);
			await waitForCanvasVideoReady();
		} finally {
			backgroundMediaLoading = false;
			releasePreviewShellSoon();
			studioSizeTransitions = false;
			window.setTimeout(() => {
				if (!backgroundMediaLoading) studioSizeTransitions = true;
			}, 280);
			(e.target as HTMLInputElement).value = '';
		}
	}

	async function handleCircleUpload(e: Event) {
		const file = (e.target as HTMLInputElement).files?.[0];
		if (!file) return;
		(e.target as HTMLInputElement).value = '';
		const idx = activeSlide;
		if (isVideoFile(file)) {
			const url = objectUrlForVideoFile(file);
			circleImages = circleImages.map((v, i) => (i === idx ? url : v));
			void waitForCanvasVideoReady();
			return;
		}
		try {
			const dataUrl = await prepareImageAsDataUrl(file, {
				maxDim: 900,
				maxBytes: 900_000,
				quality: 0.85,
			});
			circleImages = circleImages.map((v, i) => (i === idx ? dataUrl : v));
		} catch (err) {
			alert(err instanceof Error ? err.message : 'Image upload failed');
		}
	}

	async function handleCircle2Upload(e: Event) {
		const file = (e.target as HTMLInputElement).files?.[0];
		if (!file) return;
		(e.target as HTMLInputElement).value = '';
		const idx = activeSlide;
		if (isVideoFile(file)) {
			const url = objectUrlForVideoFile(file);
			circle2Images = circle2Images.map((v, i) => (i === idx ? url : v));
			showCircle2BySlide = showCircle2BySlide.map((v, i) => (i === idx ? true : v));
			void waitForCanvasVideoReady();
			return;
		}
		try {
			const dataUrl = await prepareImageAsDataUrl(file, {
				maxDim: 900,
				maxBytes: 900_000,
				quality: 0.85,
			});
			circle2Images = circle2Images.map((v, i) => (i === idx ? dataUrl : v));
			showCircle2BySlide = showCircle2BySlide.map((v, i) => (i === idx ? true : v));
		} catch (err) {
			alert(err instanceof Error ? err.message : 'Image upload failed');
		}
	}

	let circle2QuickInput = $state<HTMLInputElement | null>(null);
	function openCircle2QuickPicker() {
		circle2QuickInput?.click();
	}

	let overlayQuickInput = $state<HTMLInputElement | null>(null);
	function openOverlayQuickPicker() {
		overlayQuickInput?.click();
	}

	let newsBgToolbarAnchorRect = $state<DOMRect | null>(null);
	let newsBgToolbarMediaInput = $state<HTMLInputElement | null>(null);

	const newsBgToolbarAnchor = $derived(newsBgToolbarAnchorRect);

	function closeNewsBgToolbar() {
		newsBgToolbarAnchorRect = null;
	}

	/** Open Cut out / Replace toolbar at a canvas point (click) or dock “BG tools”. */
	function openBgToolbarAt(clientX: number, clientY: number) {
		closeToolbar();
		newsBgToolbarAnchorRect = new DOMRect(clientX - 1, clientY - 1, 2, 2);
	}

	function openNewsBgToolbarFromDock(e?: MouseEvent) {
		closeToolbar();
		const btn =
			e?.currentTarget instanceof HTMLElement
				? e.currentTarget
				: typeof document !== 'undefined'
					? document.querySelector<HTMLElement>('button[aria-label="BG tools"]')
					: null;
		const r = btn?.getBoundingClientRect();
		if (r && r.width > 2 && r.height > 2) {
			newsBgToolbarAnchorRect = new DOMRect(r.x, r.y, r.width, r.height);
			return;
		}
		const root =
			typeof document !== 'undefined'
				? document.querySelector<HTMLElement>('[data-studio-canvas-root]')
				: null;
		const canvas = root?.getBoundingClientRect();
		if (canvas && canvas.width > 4 && canvas.height > 4) {
			openBgToolbarAt(canvas.left + canvas.width * 0.5, canvas.top + Math.min(canvas.height * 0.28, 220));
		} else if (typeof window !== 'undefined') {
			openBgToolbarAt(window.innerWidth * 0.55, 200);
		}
	}

	async function handleNewsBgToolbarMediaChange(e: Event) {
		const input = e.target as HTMLInputElement;
		const file = input.files?.[0];
		input.value = '';
		if (!file) return;
		const idx = paintSlide;
		const t = coerceTemplateId(slideTemplates[idx] ?? lastTemplateUsed);
		const extOk = /\.(mp4|mov|webm|m4v|mkv|avi)$/i.test(file.name ?? '');
		const isVideo =
			file.type.startsWith('video/') ||
			file.type === 'application/mp4' ||
			(file.type === 'application/octet-stream' && extOk) ||
			extOk;
		if (isVideo) {
			const url = URL.createObjectURL(file);
			setSlideVideo(idx, url, t);
			void waitForCanvasVideoReady();
		} else {
			try {
				const dataUrl = await prepareImageAsDataUrl(file, {
					maxDim: 1600,
					maxBytes: 1_800_000,
					quality: 0.85,
				});
				setSlideImage(idx, dataUrl, t);
			} catch (err) {
				alert(err instanceof Error ? err.message : 'Image upload failed');
			}
		}
	}

	$effect(() => {
		void activeSlide;
		closeNewsBgToolbar();
	});

	function addOverlayAtSize(src: string, naturalW: number, naturalH: number) {
		const aspect = Math.max(1, naturalW) / Math.max(1, naturalH);
		const w = Math.min(300, Math.max(80, naturalW));
		const h = w / aspect;
		const idx = activeSlide;
		const newOverlay: Overlay = {
			id: crypto.randomUUID(),
			src,
			x: Math.round((CANVAS_W - w) / 2),
			y: Math.round((CANVAS_H - h) / 2),
			w: Math.round(w),
			h: Math.round(h),
		};
		const current = (slideOverlaysByTemplate[activeTemplate] ?? [])[idx] ?? [];
		setSlideOverlays(idx, [...current, newOverlay], activeTemplate);
	}

	async function handleOverlayUpload(e: Event) {
		const file = (e.target as HTMLInputElement).files?.[0];
		if (!file) return;
		// Reset input so same file can be re-uploaded
		(e.target as HTMLInputElement).value = '';
		if (isVideoFile(file)) {
			const src = objectUrlForVideoFile(file);
			const video = document.createElement('video');
			video.preload = 'metadata';
			video.muted = true;
			video.playsInline = true;
			video.onloadedmetadata = () => {
				addOverlayAtSize(src, video.videoWidth || 300, video.videoHeight || 300);
				void waitForCanvasVideoReady();
			};
			video.onerror = () => addOverlayAtSize(src, 300, 300);
			video.src = src;
			return;
		}
		try {
			const src = await prepareImageAsDataUrl(file, {
				maxDim: 1600,
				maxBytes: 1_800_000,
				quality: 0.85,
			});
			const img = new window.Image();
			img.onload = () => addOverlayAtSize(src, img.naturalWidth, img.naturalHeight);
			img.src = src;
		} catch (err) {
			alert(err instanceof Error ? err.message : 'Image upload failed');
		}
	}

	// ── Export (PNG for stills, MP4 for video slides) ─────────────────────
	async function exportPng() {
		if (!exportRef) return;
		if (!slides.length) return;
		exporting = true;
		try {
			await materializeRemoteImagesForExport();
			await materializeRemoteVideosForExport();
			const zip = new JSZip();
			const folder = zip.folder(`slides-${formatId}`) ?? zip;

			for (let i = 0; i < slides.length; i++) {
				canvasRasterSlide = i;
				await tick();
				await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));

				const node = exportRef;
				if (!node) throw new Error('Preview not ready for export');

				const clip = getSlideClipMedia(i);
				const videoEl =
					node.querySelector<HTMLVideoElement>('video[data-studio-bg-video]') ??
					node.querySelector('video');
				const clipLen = clip
					? slideExportDurationSec({
							start: clip.start,
							end: clip.end,
							duration: clip.duration,
							videoElDuration: videoEl?.duration,
						})
					: 0;
				const hasVideo = !!(clip?.url && videoEl && clipLen >= 0.2);

				if (hasVideo && clip && videoEl) {
					let start = Math.max(0, clip.start || 0);
					let end = clip.end > start ? clip.end : start + clipLen;
					if (!(end > start)) {
						const dur = Number(videoEl.duration);
						end = Number.isFinite(dur) && dur > start ? dur : start + Math.max(clipLen, 3);
					}
					const bg = filmstripPngBackgroundForSlide(i);
					const webm = await recordSlideAsVideo({
						root: node,
						video: videoEl,
						width: CANVAS_W,
						height: CANVAS_H,
						startSec: start,
						endSec: end,
						backgroundColor: bg,
						includeAudio: !(videoMutedBySlide[i] ?? true),
						toSafeImageUrl: toExportSafeImageUrl,
						onProgress: (pct) => {
							console.info(`[export] slide ${i + 1} video ${Math.round(pct)}%`);
						},
					});
					let out = webm;
					let ext = 'webm';
					try {
						out = await transcodeSlideVideoToMp4(webm);
						ext = 'mp4';
					} catch (e) {
						console.warn('[export] MP4 encode failed, keeping WebM', e);
					}
					folder.file(`slide-${i + 1}.${ext}`, out);
				} else {
					const dataUrl = await rasterizeExportNode(node, {
						width: CANVAS_W,
						height: CANVAS_H,
						pixelRatio: 1,
						backgroundColor: filmstripPngBackgroundForSlide(i),
					letterbox: letterboxForExport(),
				});
					const base64 = dataUrl.split(',')[1] ?? '';
					folder.file(`slide-${i + 1}.png`, base64, { base64: true });
				}
			}

			const blob = await zip.generateAsync({ type: 'blob' });
			const url = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = `slides-${formatId}.zip`;
			a.click();
			setTimeout(() => URL.revokeObjectURL(url), 30_000);
		} catch (e: any) {
			console.error('Export zip failed:', e);
			alert('Export failed: ' + formatExportError(e));
		} finally {
			canvasRasterSlide = null;
			exporting = false;
		}
	}

	async function exportAllSlidesToDraft() {
		if (!exportRef) return 0;
		if (!slides.length) return 0;
		exportingAll = true;
		lastExportError = '';
		let count = 0;
		try {
			await materializeRemoteImagesForExport();
			await materializeRemoteVideosForExport();
			const out: string[] = [];
			for (let i = 0; i < slides.length; i++) {
				canvasRasterSlide = i;
				// Let the DOM update before rasterizing (Svelte + next paint)
				await tick();
				await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));

				const node = exportRef;
				if (!node) throw new Error('Preview not ready for export');

				const dataUrl = await rasterizeExportNode(node, {
					width: CANVAS_W,
					height: CANVAS_H,
					pixelRatio: 1,
					backgroundColor: filmstripPngBackgroundForSlide(i),
					letterbox: letterboxForExport(),
				});
				out.push(dataUrl);
			}

			if (brandCtaEnabled) {
				exportingBrandCta = true;
				editingBrandCta = true;
				canvasRasterSlide = null;
				await tick();
				await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));

				const ctaNode = exportRef;
				if (!ctaNode) throw new Error('Follow slide preview not ready for export');

				const ctaUrl = await rasterizeExportNode(ctaNode, {
					width: CANVAS_W,
					height: CANVAS_H,
					pixelRatio: 1,
					backgroundColor: '#0a0a0a',
				});
				out.push(ctaUrl);
			}
			exportedSlides = out;
			count = out.length;
		} catch (e: any) {
			lastExportError = formatExportError(e);
			console.error('Export all failed:', e);
			count = 0;
		} finally {
			canvasRasterSlide = null;
			exportingBrandCta = false;
			exportingAll = false;
		}

		// Do not autosave `news_studio` drafts — only Save template persists Studio work.
		return count;
	}

	// Preview scale — fit the live viewport. Tall formats (9:16) stay capped so they
	// don't swamp the docks; short/wide formats grow to fill host height toward the filmstrip.
	const PREVIEW_COMFORT_MAX_W = 720;
	const PREVIEW_COMFORT_MAX_H = 900;
	let studioPreviewHostEl = $state<HTMLElement | null>(null);
	let previewHostW = $state(720);
	let previewHostH = $state(600);
	/** False until the host is measured — the canvas stays behind the skeleton so the first resize isn't visible. */
	let previewMeasured = $state(false);
	/** True until the first post-boot filmstrip pass finishes (blocks canvas reveal — capture cycles the main preview). */
	let filmstripInitialPassPending = $state(true);
	/** Size transitions stay off until after the first stable reveal. */
	let studioSizeTransitions = $state(false);
	/** Locked shell size until reveal — frozen after first post-boot measure (avoids load shake). */
	let bootShellW = $state<number | null>(null);
	let bootShellH = $state<number | null>(null);
	/** Ensures the boot skeleton is on-screen long enough to read (avoids instant pop). */
	let bootSkeletonShownAt = $state(
		typeof performance !== 'undefined' ? performance.now() : 0,
	);

	function fitScaleFor(hostW: number, hostH: number, canvasW: number, canvasH: number) {
		const aspect = canvasW / Math.max(1, canvasH);
		// Landscape / square: use the full host so height grows toward the filmstrip.
		// Portrait (e.g. 9:16): keep comfort caps so the canvas doesn't crush the docks.
		const comfortW =
			aspect >= 0.95 ? Math.max(PREVIEW_COMFORT_MAX_W, hostW) : PREVIEW_COMFORT_MAX_W;
		const comfortH =
			aspect <= 0.72 ? PREVIEW_COMFORT_MAX_H : Math.max(PREVIEW_COMFORT_MAX_H, hostH);
		return Math.min(
			comfortW / canvasW,
			comfortH / canvasH,
			hostW / canvasW,
			hostH / canvasH,
		);
	}

	$effect(() => {
		const el = studioPreviewHostEl;
		const booting = studioBooting;
		void CANVAS_W;
		void CANVAS_H;
		// Wait until draft/format restore finishes so the first lock matches the real canvas size.
		if (booting) return;

		const padX = 24;
		const padY = 24;
		const applyHostSize = (w: number, h: number, lockShell: boolean) => {
			previewHostW = w;
			previewHostH = h;
			if (lockShell || bootShellW == null || bootShellH == null) {
				const s = fitScaleFor(w, h, CANVAS_W, CANVAS_H);
				bootShellW = CANVAS_W * s;
				bootShellH = CANVAS_H * s;
			}
			previewMeasured = true;
		};

		if (typeof ResizeObserver === 'undefined') {
			if (typeof window !== 'undefined' && !previewMeasured) {
				applyHostSize(
					Math.max(240, window.innerWidth - 280),
					Math.max(240, window.innerHeight - 220),
					true,
				);
			}
			return;
		}
		if (!el) return;

		const measure = () => {
			const w = Math.max(200, el.clientWidth - padX);
			const h = Math.max(200, el.clientHeight - padY);
			if (!previewMeasured) {
				applyHostSize(w, h, true);
				return;
			}
			// Frozen shell until reveal — do not chase format/host churn (that was the load shake).
			if (bootShellW != null && bootShellH != null) return;
			// Ignore sub-pixel / scrollbar flicker so the chosen slide doesn't keep resizing.
			if (Math.abs(w - previewHostW) < 4 && Math.abs(h - previewHostH) < 4) return;
			previewHostW = w;
			previewHostH = h;
		};
		const ro = new ResizeObserver(measure);
		ro.observe(el);
		measure();
		return () => ro.disconnect();
	});

	/** Canvas host measured + draft/auth boot finished. Filmstrip thumbs may still be capturing. */
	const studioCanvasReady = $derived(previewMeasured && !studioBooting);
	/**
	 * First paint the user should see: wait for the initial filmstrip pass too.
	 * Capture temporarily cycles `canvasRasterSlide` on the main export node — keep the
	 * skeleton up so that doesn’t read as a shake/flicker on `?template=` boot.
	 */
	const studioRevealReady = $derived(studioCanvasReady && !filmstripInitialPassPending);

	/**
	 * While the shell is locked, scale from the locked box so format changes can't
	 * resize the on-screen slide. After unlock, fit the live host.
	 */
	const previewScale = $derived(
		bootShellW != null && bootShellH != null && CANVAS_W > 0 && CANVAS_H > 0
			? Math.min(bootShellW / CANVAS_W, bootShellH / CANVAS_H)
			: fitScaleFor(previewHostW, previewHostH, CANVAS_W, CANVAS_H),
	);
	const previewDisplayW = $derived(bootShellW ?? CANVAS_W * previewScale);
	const previewDisplayH = $derived(bootShellH ?? CANVAS_H * previewScale);

	$effect(() => {
		if (!studioRevealReady) {
			studioSizeTransitions = false;
			if (!bootSkeletonShownAt && typeof performance !== 'undefined') {
				bootSkeletonShownAt = performance.now();
			}
			return;
		}
		// Unlock at the same pixel size (no tween), then allow size transitions only
		// for later intentional resizes (format dock / window).
		let cancelled = false;
		let enableTimer = 0;
		const id = requestAnimationFrame(() => {
			if (cancelled) return;
			bootShellW = null;
			bootShellH = null;
			enableTimer = window.setTimeout(() => {
				if (!cancelled) studioSizeTransitions = true;
			}, 320);
		});
		return () => {
			cancelled = true;
			cancelAnimationFrame(id);
			window.clearTimeout(enableTimer);
		};
	});

	async function finishFilmstripInitialPass() {
		if (!filmstripInitialPassPending) return;
		const MIN_VISIBLE_MS = 450;
		const shownAt = bootSkeletonShownAt || (typeof performance !== 'undefined' ? performance.now() : 0);
		const elapsed = typeof performance !== 'undefined' ? performance.now() - shownAt : MIN_VISIBLE_MS;
		if (elapsed < MIN_VISIBLE_MS) {
			await new Promise((r) => setTimeout(r, MIN_VISIBLE_MS - elapsed));
		}
		if (filmstripInitialPassPending) filmstripInitialPassPending = false;
	}

	/** Don't leave canvas boot / filmstrip thumbs locked forever if capture stalls. */
	$effect(() => {
		if (!studioCanvasReady || !filmstripInitialPassPending) return;
		const t = setTimeout(() => void finishFilmstripInitialPass(), 2500);
		return () => clearTimeout(t);
	});

	/** Raster snapshots for filmstrip (same pipeline as ZIP export, low pixel ratio). */
	let filmstripPreviewUrls = $state<string[]>([]);
	let filmstripPreviewInFlight = $state(false);
	/** True only while capturing every slide for the filmstrip (hides rapid canvas switching). */
	let filmstripBulkCapturing = $state(false);

	/** Last signatures we successfully rasterized to the filmstrip (avoids full-deck capture on single-slide edits). */
	let prevFilmstripSigs: string[] = [];

	/** Same starter copy the canvas templates fall back to when state is empty. */
	function defaultPrimaryForTemplate(t: TemplateId): string {
		if (t === 'textCarousel') return TEXT_CAROUSEL_DEFAULTS.body;
		if (t === 'whiteThread') return WHITE_THREAD_DEFAULTS.body;
		if (t === 'whiteMedia') return WHITE_MEDIA_DEFAULTS.body;
		if (t === 'tweet') return TWEET_DEFAULTS.topText;
		if (t === 'article') return ARTICLE_DEFAULT_BODY;
		if (t === 'imageQuote') return IMAGE_QUOTE_DEFAULTS.body;
		if (t === 'blackText') return BLACK_TEXT_CAROUSEL_DEFAULTS.headline;
		if (t === 'photoTopic') return PHOTO_TOPIC_DEFAULTS.headline;
		if (t === 'photoCaption') return PHOTO_CAPTION_DEFAULTS.headline;
		if (t === 'brandStack') return BRAND_STACK_DEFAULTS.headline;
		if (t === 'videoHook') return VIDEO_HOOK_DEFAULTS.headline;
		if (t === 'videoCreator') return VIDEO_CREATOR_DEFAULTS.headline;
		if (t === 'videoText') return VIDEO_TEXT_DEFAULTS.headline;
		if (t === 'videoSource') return VIDEO_SOURCE_DEFAULTS.headline;
		if (t === 'videoFeature') return VIDEO_FEATURE_DEFAULTS.headline;
		if (t === 'videoPost') return VIDEO_POST_DEFAULTS.headline;
		if (isVideoStoryFamily(t)) return VIDEO_STORY_DEFAULTS.headline;
		if (t === 'news') return NEWS_PLACEHOLDER_HEADLINE;
		return '';
	}

	/** Primary label for filmstrip fallback (blank uses text overlays, not `slides[]`). */
	function thumbTextForSlide(i: number): string {
		const t = coerceTemplateId(slideTemplates[i] ?? lastTemplateUsed);
		if (t === 'blank') {
			const overlays = (slideTextOverlaysByTemplate.blank ?? [])[i] ?? [];
			return overlays
				.map((o) => String(o.text ?? '').trim())
				.filter(Boolean)
				.join(' ');
		}
		const raw =
			t === 'news' && i === activeSlide && newsHeadlineLive !== null
				? newsHeadlineLive
				: t === 'tweet'
					? (tweetTopTextBySlide[i] ?? '').trim()
					: t === 'article'
						? (articleTextBySlide[i] ?? '')
						: t === 'textCarousel' || isWhitePostFamily(t)
							? (textCarouselTextBySlide[i] ?? '')
							: isVideoStoryFamily(t)
								? (videoStoryHeadlineBySlide[i] ?? '')
								: t === 'blackText' || isPhotoStoryFamily(t)
									? (blackTextHeadlineBySlide[i] ?? '')
									: t === 'imageQuote'
										? (imageQuoteTextBySlide[i] ?? '')
										: (slides[i] ?? '');
		// Match canvas: empty state still renders template defaults — don't treat as empty filmstrip cells.
		return String(raw || slides[i] || defaultPrimaryForTemplate(t) || '')
			.replace(/\[\[|\]\]/g, '')
			.replace(/\s+/g, ' ')
			.trim();
	}

	/** One filmstrip cell: template + media + primary copy lengths (used for invalidation + diff). */
	function slideThumbSignature(i: number): string {
		const t = coerceTemplateId(slideTemplates[i] ?? 'news');
		const imgLen = ((bgImagesByTemplate[t] ?? [])[i] ?? '').length;
		const vidLen = ((bgVideosByTemplate[t] ?? [])[i] ?? '').length;
		if (t === 'blank') {
			const textOs = (slideTextOverlaysByTemplate.blank ?? [])[i] ?? [];
			const imgOs = (slideOverlaysByTemplate.blank ?? [])[i] ?? [];
			const textSig = textOs.map((o) => `${o.id}:${String(o.text ?? '').length}`).join('|');
			const imgSig = imgOs.map((o) => `${o.id}:${String(o.src ?? '').length}`).join('|');
			const solidLen = String(newsSolidBgBySlide[i] ?? '').length;
			return `${t}:${imgLen}:${vidLen}:${textSig}:${imgSig}:${solidLen}:${thumbTextForSlide(i).length}`;
		}
		const newsLiveLen =
			t === 'news' && i === activeSlide && newsHeadlineLive !== null
				? newsHeadlineLive.length
				: (slides[i] ?? '').length;
		const newsSubLen = t === 'news' ? String(newsSubtextBySlide[i] ?? '').length : 0;
		const shadowH =
			t === 'news' ? Math.round(shadowHeightAt(i)) : 0;
		const shadowS = t === 'news' ? Math.round(shadowStrengthAt(i) * 100) : 0;
		return `${t}:${imgLen}:${vidLen}:${newsLiveLen}:${newsSubLen}:${shadowH}:${shadowS}:${(tweetTopTextBySlide[i] ?? '').length}:${(tweetTopAvatarImageBySlide[i] ?? '').length}:${(tweetBottomAvatarImageBySlide[i] ?? '').length}:${(articleTextBySlide[i] ?? '').length}:${(textCarouselTextBySlide[i] ?? '').length}:${(imageQuoteTextBySlide[i] ?? '').length}:${(videoStoryHeadlineBySlide[i] ?? '').length}:${(blackTextHeadlineBySlide[i] ?? '').length}:${(blackTextBodyBySlide[i] ?? '').length}:${filmStripTopPctByTemplate[t]?.[i] ?? filmStripDefaultsFor(t).topPct}:${filmStripBottomPctByTemplate[t]?.[i] ?? filmStripDefaultsFor(t).bottomPct}`;
	}

	function syncFilmstripSigCacheAfterCapture() {
		prevFilmstripSigs = slides.map((_, i) => slideThumbSignature(i));
	}

	/** True while focus is in an inline canvas editor — filmstrip PNG capture must wait (it swaps `canvasRasterSlide` / covers the canvas and kills the caret). */
	function editingInsideStudioCanvas(): boolean {
		if (typeof document === 'undefined') return false;
		const root = document.querySelector('[data-studio-canvas-root]');
		const ae = document.activeElement;
		if (!root || !ae || !(ae instanceof Node)) return false;
		if (!root.contains(ae)) return false;
		if (ae instanceof HTMLElement && ae.isContentEditable) return true;
		return ae instanceof Element && !!ae.closest('[contenteditable="true"]');
	}

	/** Letterboxing for filmstrip / burn-music PNGs — align with each template’s real canvas fill. */
	function filmstripPngBackgroundForSlide(slideIdx: number): string {
		const t = coerceTemplateId(slideTemplates[slideIdx] ?? 'news');
		const solid = String(newsSolidBgBySlide[slideIdx] ?? '').trim();
		if ((t === 'blank' || t === 'news') && solid) return solid;
		if (t === 'blank') return canvasSolidHex;
		if (t === 'blackText' || isPhotoStoryFamily(t) || t === 'imageQuote') return canvasSolidHex;
		if (t === 'tweet' || t === 'article' || t === 'textCarousel' || isWhitePostFamily(t)) {
			return canvasBgDark ? '#0a0a0a' : '#ffffff';
		}
		if (isVideoStoryFamily(t)) return canvasSolidHex;
		return canvasBgDark ? '#0a0a0a' : '#ffffff';
	}

	/**
	 * Captures slide 0 as a PNG using the EXACT same pipeline as the Export button
	 * (`exportAllSlidesToDraft`). Prefer passing `thumbnailDataUrl` into `saveDraftNow`
	 * when export already produced slide 0 — this path returns null while `exportingAll`
	 * is true so it doesn't race the filmstrip / export loop.
	 */
	async function captureSlide0PngDataUrl(pixelRatio = 1): Promise<string | null> {
		if (!exportRef || studioBooting || slides.length === 0) return null;
		if (exporting || exportingAll) return null; // already exporting, skip

		exportingAll = true;
		const prevRaster = canvasRasterSlide;
		try {
			canvasRasterSlide = 0;
			await tick();
			await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
			const node = exportRef;
			if (!node) return null;
			try {
				return await rasterizeExportNode(node, {
					width: CANVAS_W,
					height: CANVAS_H,
					pixelRatio,
					backgroundColor: filmstripPngBackgroundForSlide(0),
					letterbox: letterboxForExport(),
				});
			} catch {
				return null;
			}
		} catch {
			return null;
		} finally {
			canvasRasterSlide = prevRaster ?? null;
			exportingAll = false;
			await tick();
		}
	}

	async function captureDraftThumbnailDataUrl(): Promise<string | null> {
		const film0 = String(filmstripPreviewUrls[0] ?? '').trim();
		if (film0.startsWith('data:image/')) return film0;
		return captureSlide0PngDataUrl(1);
	}

	async function captureTemplatePreviewPngDataUrl(): Promise<string | null> {
		return captureSlide0PngDataUrl(1);
	}

	/** Filmstrip thumbs are small; 0.2 looked nothing like the canvas — keep file size sane vs legibility. */
	const FILMSTRIP_THUMB_PIXEL_RATIO = 0.52;

	/** Content fingerprint only — omit format/canvas size so Feed/Vertical/Wide toggles don’t re-raster filmstrip thumbs. */
	const filmstripThumbDeps = $derived.by(() => {
		let s = `${slides.length}|${uiTheme}`;
		for (let i = 0; i < slides.length; i++) s += `;${slideThumbSignature(i)}`;
		return s;
	});

	async function refreshFilmstripPreviews() {
		if (!exportRef || studioBooting || slides.length === 0) return;
		if (exporting || exportingAll || filmstripPreviewInFlight) return;
		filmstripPreviewInFlight = true;
		filmstripBulkCapturing = true;
		const urls: string[] = [];
		try {
			for (let i = 0; i < slides.length; i++) {
				canvasRasterSlide = i;
				await tick();
				await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
				const node = exportRef;
				if (!node) {
					urls.push('');
					continue;
				}
				try {
					await (document as any).fonts?.ready;
				} catch {
					/* ignore */
				}
				try {
					const dataUrl = await rasterizeExportNode(node, {
						width: CANVAS_W,
						height: CANVAS_H,
						pixelRatio: FILMSTRIP_THUMB_PIXEL_RATIO,
						backgroundColor: filmstripPngBackgroundForSlide(i),
					letterbox: letterboxForExport(),
				});
					urls.push(dataUrl);
				} catch {
					urls.push('');
				}
			}
			filmstripPreviewUrls = urls;
		} finally {
			filmstripBulkCapturing = false;
			canvasRasterSlide = null;
			filmstripPreviewInFlight = false;
			syncFilmstripSigCacheAfterCapture();
			await tick();
		}
	}

	/** Re-raster only the given slide indices under one overlay (no “cycle every slide” on the main canvas). */
	async function refreshFilmstripPreviewSlices(indices: number[]) {
		const uniq = [...new Set(indices)]
			.filter((i) => Number.isInteger(i) && i >= 0 && i < slides.length)
			.sort((a, b) => a - b);
		if (!uniq.length || !exportRef || studioBooting || slides.length < 1) return;
		if (exporting || exportingAll || filmstripPreviewInFlight) return;

		filmstripPreviewInFlight = true;
		filmstripBulkCapturing = true;
		const prevRaster = canvasRasterSlide;
		let base =
			filmstripPreviewUrls.length === slides.length
				? [...filmstripPreviewUrls]
				: Array.from({ length: slides.length }, (_, i) => filmstripPreviewUrls[i] ?? '');
		try {
			for (const i of uniq) {
				canvasRasterSlide = i;
				await tick();
				await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
				const node = exportRef;
				if (!node) continue;
				try {
					const dataUrl = await rasterizeExportNode(node, {
						width: CANVAS_W,
						height: CANVAS_H,
						pixelRatio: FILMSTRIP_THUMB_PIXEL_RATIO,
						backgroundColor: filmstripPngBackgroundForSlide(i),
					letterbox: letterboxForExport(),
				});
					base[i] = dataUrl;
				} catch {
					base[i] = '';
				}
			}
			filmstripPreviewUrls = base;
		} finally {
			canvasRasterSlide = prevRaster ?? null;
			filmstripBulkCapturing = false;
			filmstripPreviewInFlight = false;
			syncFilmstripSigCacheAfterCapture();
			await tick();
		}
	}

	/** Update one filmstrip thumbnail without iterating all slides (avoids “flickity” on template change). */
	async function refreshFilmstripPreviewSlice(slideIdx: number) {
		if (!exportRef || studioBooting || slides.length < 1) return;
		if (exporting || exportingAll || filmstripPreviewInFlight) return;
		if (slideIdx < 0 || slideIdx >= slides.length) return;

		const prevRaster = canvasRasterSlide;
		filmstripPreviewInFlight = true;
		filmstripBulkCapturing = true;
		try {
			canvasRasterSlide = slideIdx;
			await tick();
			await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
			const node = exportRef;
			if (node) {
				try {
					const dataUrl = await rasterizeExportNode(node, {
						width: CANVAS_W,
						height: CANVAS_H,
						pixelRatio: FILMSTRIP_THUMB_PIXEL_RATIO,
						backgroundColor: filmstripPngBackgroundForSlide(slideIdx),
					letterbox: letterboxForExport(),
				});
					const base =
						filmstripPreviewUrls.length === slides.length
							? [...filmstripPreviewUrls]
							: Array.from({ length: slides.length }, (_, i) => filmstripPreviewUrls[i] ?? '');
					base[slideIdx] = dataUrl;
					filmstripPreviewUrls = base;
				} catch {
					/* ignore */
				}
			}
		} finally {
			canvasRasterSlide = prevRaster ?? null;
			filmstripBulkCapturing = false;
			filmstripPreviewInFlight = false;
			syncFilmstripSigCacheAfterCapture();
			await tick();
		}
	}

	const BURN_MUSIC_STORAGE_KEY = 'burn-music-v1';

	async function navigateToBurnMusicPage() {
		const labels = slides.map((_, i) => `Slide ${i + 1}`);
		const previews: string[] = [];
		const node = exportRef;
		if (node && slides.length > 0) {
			const prevRaster = canvasRasterSlide;
			filmstripBulkCapturing = true;
			try {
				for (let i = 0; i < slides.length; i++) {
					canvasRasterSlide = i;
					await tick();
					await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
					try {
						const dataUrl = await rasterizeExportNode(node, {
							width: CANVAS_W,
							height: CANVAS_H,
							pixelRatio: FILMSTRIP_THUMB_PIXEL_RATIO,
							backgroundColor: filmstripPngBackgroundForSlide(i),
					letterbox: letterboxForExport(),
				});
						previews.push(dataUrl);
					} catch {
						previews.push('');
					}
				}
			} finally {
				filmstripBulkCapturing = false;
				canvasRasterSlide = prevRaster ?? null;
				await tick();
			}
		}
		try {
			sessionStorage.setItem(
				BURN_MUSIC_STORAGE_KEY,
				JSON.stringify({ labels, previews, capturedAt: Date.now() }),
			);
		} catch {
			/* quota / private mode */
		}
		await goto('/dashboard/studio/burn-music');
	}

	let filmstripThumbTimer: ReturnType<typeof setTimeout> | null = null;
	/** Bumps when a new filmstrip pass is requested; stale passes must not clear the initial skeleton. */
	let filmstripPassId = 0;
	/** Bumped after Generate so one capture runs when the deck settles. */
	let filmstripRecaptureNonce = $state(0);

	$effect(() => {
		void filmstripThumbDeps;
		void filmstripRecaptureNonce;
		void studioBooting;
		if (studioBooting) return;
		// Don't rasterize while Generate is filling slides — it pegs the CPU and locks the canvas.
		if (studioGenerating || fetchingNews || generatingVariants) return;
		if (filmstripThumbTimer) clearTimeout(filmstripThumbTimer);

		const n = slides.length;
		const nextSigs = n > 0 ? Array.from({ length: n }, (_, i) => slideThumbSignature(i)) : [];
		const isInitialReveal = filmstripInitialPassPending;

		if (n === 0) {
			prevFilmstripSigs = [];
			filmstripPreviewUrls = [];
			void finishFilmstripInitialPass();
			return;
		}

		let changed: number[] = [];
		if (prevFilmstripSigs.length !== n) {
			changed = Array.from({ length: n }, (_, i) => i);
		} else {
			for (let i = 0; i < n; i++) {
				if (prevFilmstripSigs[i] !== nextSigs[i]) changed.push(i);
			}
		}

		if (!changed.length) {
			void finishFilmstripInitialPass();
			return;
		}

		const useFullDeckCapture =
			changed.length === n || changed.length > Math.max(3, Math.ceil(n * 0.55));
		// First reveal: brief settle then capture under the boot skeleton (no long debounce / second flash).
		const delayMs = isInitialReveal ? 80 : useFullDeckCapture ? 900 : 400;
		const passId = ++filmstripPassId;

		function runFilmstripCapture(attempt: number) {
			if (passId !== filmstripPassId) return;
			if (editingInsideStudioCanvas() && attempt < 80) {
				filmstripThumbTimer = setTimeout(() => {
					filmstripThumbTimer = null;
					runFilmstripCapture(attempt + 1);
				}, 220);
				return;
			}
			if (isInitialReveal && !exportRef && attempt < 40) {
				filmstripThumbTimer = setTimeout(() => {
					filmstripThumbTimer = null;
					runFilmstripCapture(attempt + 1);
				}, 50);
				return;
			}
			if (filmstripPreviewInFlight && attempt < 40) {
				filmstripThumbTimer = setTimeout(() => {
					filmstripThumbTimer = null;
					runFilmstripCapture(attempt + 1);
				}, 100);
				return;
			}
			const run = useFullDeckCapture
				? refreshFilmstripPreviews()
				: refreshFilmstripPreviewSlices(changed);
			void Promise.resolve(run).finally(() => {
				if (passId !== filmstripPassId) return;
				if (isInitialReveal) void finishFilmstripInitialPass();
			});
		}

		filmstripThumbTimer = setTimeout(() => {
			filmstripThumbTimer = null;
			runFilmstripCapture(0);
		}, delayMs);

		return () => {
			if (filmstripThumbTimer) clearTimeout(filmstripThumbTimer);
			// Invalidate in-flight capture for this pass only. Do NOT clear
			// filmstripInitialPassPending here — rapid dep changes during generate
			// would unlock the canvas mid-capture. The 2.5s watchdog + capture
			// finally handle unlock; the dock stays clickable regardless.
			filmstripPassId++;
		};
	});
</script>

<div class="studio-root flex h-full min-w-0 overflow-hidden">

	<!-- ── Main canvas column ─────────────────────────────────────────────── -->
	<div
		class="studio-right flex-1 flex flex-col min-h-0 min-w-0 overflow-hidden p-3 gap-2 md:p-6 md:gap-3"
		style="background: var(--app-bg);"
	>
	{#if draftError}
		<div class="relative z-40 flex w-full max-w-full shrink-0 flex-wrap items-center justify-end gap-2 gap-y-1 px-1 pb-1">
			<p class="max-w-[min(22rem,70vw)] min-w-0 text-right text-[10px] font-body leading-snug text-red-400/90">
				{draftError}
			</p>
		</div>
	{/if}

		<!-- Editor dock — sticky + high z so canvas Bits layers can't steal clicks. -->
		<div
			class="studio-dock-row sticky top-0 z-[200] flex w-full max-w-full shrink-0 flex-nowrap items-center justify-center gap-3 px-1 py-1"
			role="toolbar"
			aria-label="Editor dock"
		>
			<!-- Hidden picker for dock “Image” (image stickers / logos) — must stay in DOM for bind:this -->
			<input
				type="file"
				accept="image/*,video/mp4,video/webm,video/quicktime,video/x-m4v"
				class="sr-only"
				tabindex={-1}
				aria-hidden="true"
				bind:this={overlayQuickInput}
				onchange={handleOverlayUpload}
			/>
			<input
				type="file"
				accept="image/*,video/mp4,video/webm,video/quicktime,video/x-m4v"
				class="sr-only"
				tabindex={-1}
				aria-hidden="true"
				bind:this={newsBgToolbarMediaInput}
				onchange={handleNewsBgToolbarMediaChange}
			/>
			<!-- Dock stays interactive even while the canvas boot skeleton is up.
			     Hiding it with pointer-events:none froze the whole chrome when filmstrip reveal stalled. -->
			<div class="studio-dock-inner">
			<ButtonGroup.Root>
			{#if assetsCollapsed}
				<Button
					type="button"
					variant="outline"
					class="studio-assets-open-btn studio-dock-tool-btn"
					title="Show assets"
					aria-label="Show assets"
					onclick={() => (assetsCollapsed = false)}
				>
					<ImagePlus />
					<span class="studio-dock-tool-label">Assets</span>
				</Button>
			{/if}
			<DockToolbar items={dockItems} inline />
			<TemplateDockToolbar
				templates={templateDockTabs}
				selectedId={templateDockSelectedId}
				selectedLabelOverride={forcedBlankFromQuery &&
				slides.length === 1 &&
				!String(slides[0] ?? '').trim() &&
				!String(backgroundImage ?? '').trim() &&
				!String(backgroundVideo ?? '').trim()
					? 'Blank'
					: ''}
				onSelect={selectTemplateFromDock}
				onApplyAll={applyTemplateDockToAll}
			/>
			<ButtonGroup.Root title="Canvas background">
				<ButtonGroup.Text class="studio-canvas-bg-toggle">
					<span class="studio-dock-tool-label text-muted-foreground">White</span>
					<Switch
						id="studio-canvas-bg-toggle"
						checked={canvasBgDark}
						onCheckedChange={(v) => setCanvasBackgroundDark(!!v)}
						aria-label="Toggle canvas background black or white"
					/>
					<span class="studio-dock-tool-label text-muted-foreground">Black</span>
				</ButtonGroup.Text>
			</ButtonGroup.Root>
			<ButtonGroup.Root class="studio-dock-tool-group">
			<Popover bind:open={bottomShadowPopoverOpen}>
				<PopoverTrigger>
					{#snippet child({ props })}
						<Button
							{...props}
							variant="outline"
							class="studio-dock-tool-btn"
							title="Bottom shadow height and darkness"
							aria-label="Bottom shadow"
						>
							<PanelBottom />
							<span class="studio-dock-tool-label">Shadow</span>
						</Button>
					{/snippet}
				</PopoverTrigger>
				<PopoverContent
					side="bottom"
					sideOffset={8}
					align="start"
					avoidCollisions={false}
					trapFocus={false}
					portalProps={{ to: 'body' }}
					class="studio-dock-popover studio-shadow-popover w-[312px]"
				>
					<div class="mb-2.5 flex items-center justify-between gap-2">
						<p class="text-[12px] font-semibold tracking-tight">Bottom shadow</p>
						<button
							type="button"
							class="text-[10px] font-medium text-[#888] hover:text-[#111]"
							onclick={() => {
								shadowHeight = NEWS_DEFAULT_LAYOUT.shadowHeight;
								shadowStrength = NEWS_DEFAULT_LAYOUT.shadowStrength;
								shadowCurve = NEWS_DEFAULT_LAYOUT.shadowCurve;
								shadowColor = NEWS_DEFAULT_LAYOUT.shadowColor;
								shadowAutoFit = true;
							}}
						>
							Reset
						</button>
					</div>
					<div
						class="relative mb-2.5 h-10 overflow-hidden rounded-xl border border-black/10"
						style="background-image: linear-gradient(135deg, #c9c4b8 0%, #9a958c 48%, #7a756c 100%);"
						aria-hidden="true"
					>
						<div
							class="absolute inset-0"
							style="background-image: {buildBottomShadowGradient(
								Math.max(shadowHeight, 36),
								Math.max(shadowStrength, 0.55),
								normalizeBottomShadowCurve(shadowCurve),
								normalizeBottomShadowColor(shadowColor),
							)};"
						></div>
						<div class="absolute inset-x-0 bottom-2 px-3">
							<div class="h-1.5 rounded-full bg-white/85" style="width: 60%"></div>
							<div class="mt-1.5 h-1 rounded-full bg-white/55" style="width: 40%"></div>
						</div>
					</div>
					<label class="mb-3 flex cursor-pointer items-center justify-between gap-2 rounded-lg border border-[#ebebeb] bg-[#fafafa] px-2.5 py-2">
						<span class="text-[11px] font-medium text-[#444]">Auto-fit to text</span>
						<Switch
							checked={shadowAutoFit}
							onCheckedChange={(on) => {
								shadowAutoFit = !!on;
							}}
						/>
					</label>
					<p class="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-[#888]">Color</p>
					<div class="mb-3 grid grid-cols-4 gap-1.5">
						{#each BOTTOM_SHADOW_COLORS as swatch (swatch.id)}
							{@const on = normalizeBottomShadowColor(shadowColor) === swatch.hex}
							<button
								type="button"
								title={swatch.label}
								aria-label="Shadow color {swatch.label}"
								aria-pressed={on}
								onclick={() => {
									shadowColor = swatch.hex;
								}}
								class="group flex flex-col items-center gap-1 rounded-xl border p-1 transition-all
									{on
										? 'border-[#1a1a1a] bg-[#f3f3f4] shadow-[0_1px_0_rgba(0,0,0,0.04)]'
										: 'border-[#ebebeb] hover:border-[#d8d8d8] hover:bg-[#fafafa]'}"
							>
								<span
									class="relative h-9 w-full overflow-hidden rounded-lg border border-black/10"
									style="background-image: {buildBottomShadowGradient(72, 0.95, 'natural', swatch.hex)}, linear-gradient(160deg, #d9d4c8, #b8b3a8);"
								>
									{#if on}
										<span
											class="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-white shadow-[0_0_0_1px_rgba(0,0,0,0.35)]"
										></span>
									{/if}
								</span>
								<span class="text-[8px] font-semibold uppercase tracking-wide {on ? 'text-[#111]' : 'text-[#777]'}">
									{swatch.label}
								</span>
							</button>
						{/each}
					</div>
					<label
						class="mb-3 flex cursor-pointer items-center gap-2.5 rounded-xl border border-dashed border-[#d8d8d8] bg-[#fbfbfb] px-2.5 py-2 transition-colors hover:border-[#bbb] hover:bg-[#f7f7f7]"
					>
						<span
							class="relative h-9 w-9 shrink-0 overflow-hidden rounded-lg border border-black/10 shadow-inner"
							style="background-image: {buildBottomShadowGradient(80, 1, 'natural', shadowColor)}, linear-gradient(#cfcabf, #a8a398);"
						>
							<input
								type="color"
								value={normalizeBottomShadowColor(shadowColor)}
								oninput={(e) => {
									shadowColor = normalizeBottomShadowColor(
										(e.currentTarget as HTMLInputElement).value,
									);
								}}
								class="absolute inset-0 h-full w-full cursor-pointer opacity-0"
								aria-label="Custom shadow color"
							/>
						</span>
						<span class="min-w-0 flex-1">
							<span class="block text-[11px] font-semibold text-[#333]">Custom tint</span>
							<span class="block truncate font-mono text-[10px] tabular-nums text-[#888]">
								{normalizeBottomShadowColor(shadowColor).toUpperCase()}
							</span>
						</span>
					</label>
					<p class="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-[#888]">Presets</p>
					<div class="mb-3 grid max-h-[168px] grid-cols-3 gap-1.5 overflow-y-auto pr-0.5">
						{#each BOTTOM_SHADOW_PRESETS as preset (preset.id)}
							{@const on = bottomShadowPresetActive(preset)}
							<button
								type="button"
								onclick={() => applyBottomShadowPreset(preset)}
								class="flex flex-col items-center gap-1 rounded-lg border px-1 pb-1.5 pt-1.5 transition-colors
									{on ? 'border-[#1a1a1a] bg-[#f3f3f4]' : 'border-[#ebebeb] hover:bg-[#fafafa]'}"
								aria-pressed={on}
							>
								<span
									class="h-8 w-full rounded-md border border-black/5"
									style="background-image: {buildBottomShadowGradient(preset.height, preset.strength, preset.curve, shadowColor)}, linear-gradient(#d7d2c8, #c8c3b8);"
								></span>
								<span class="text-[8px] font-semibold uppercase tracking-wide {on ? 'text-[#111]' : 'text-[#666]'}">
									{preset.label}
								</span>
							</button>
						{/each}
					</div>
					<p class="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-[#888]">Fade curve</p>
					<div class="mb-3 grid grid-cols-2 gap-1">
						{#each BOTTOM_SHADOW_CURVES as curve (curve.id)}
							<button
								type="button"
								title={curve.hint}
								onclick={() => {
									shadowAutoFit = false;
									shadowCurve = curve.id;
								}}
								class="rounded-lg border px-2 py-1.5 text-left text-[10px] font-semibold transition-colors
									{shadowCurve === curve.id
										? 'border-[#1a1a1a] bg-[#f3f3f4] text-[#111]'
										: 'border-[#ebebeb] text-[#666] hover:bg-[#fafafa]'}"
							>
								{curve.label}
							</button>
						{/each}
					</div>
					<label class="mb-1 flex items-center justify-between text-[11px] font-medium text-[#555]">
						<span>Height</span>
						<span class="tabular-nums text-[#111]">
							{Math.round(shadowHeight)}%{shadowAutoFit ? ' · auto' : ''}
						</span>
					</label>
					<Slider
						type="single"
						value={shadowHeight}
						onValueChange={(v) => {
							shadowAutoFit = false;
							shadowHeight = typeof v === 'number' ? v : shadowHeight;
						}}
						min={0}
						max={100}
						step={1}
						class="mb-3.5 min-w-0"
					/>
					<label class="mb-1 flex items-center justify-between text-[11px] font-medium text-[#555]">
						<span>Darkness</span>
						<span class="tabular-nums text-[#111]">{Math.round(shadowStrength * 100)}%</span>
					</label>
					<Slider
						type="single"
						value={shadowStrength}
						onValueChange={(v) => {
							shadowAutoFit = false;
							shadowStrength = typeof v === 'number' ? v : shadowStrength;
						}}
						min={0}
						max={1}
						step={0.05}
						class="min-w-0"
					/>
					<p class="mt-3 text-[10px] leading-snug text-[#999]">
						Pick a letterbox tint, then tune height and darkness. Natural and Editorial curves give the smoothest fade.
					</p>
				</PopoverContent>
			</Popover>
			<Popover bind:open={highlightPopoverOpen}>
				<PopoverTrigger>
					{#snippet child({ props })}
						{@const hlOn = studioTextHighlightsEnabled}
						{@const hlSwatchStyle =
							!hlOn
								? ''
								: highlightStyleKind === 'gradient'
									? `background: linear-gradient(90deg, ${highlightGradientFrom}, ${highlightGradientTo});`
									: highlightStyleKind === 'pattern'
										? `background-image: url('${AVAILABLE_PATTERNS.find((p) => p.name === highlightPattern)?.url ?? ''}'); background-size: cover; background-position: center;`
										: `background: ${highlightColor};`}
						<Button
							{...props}
							variant="outline"
							class="studio-dock-tool-btn {hlOn ? 'studio-dock-tool-btn--hl-on' : 'studio-dock-tool-btn--hl-off'}"
							title={hlOn
								? `Highlights on — ${highlightStyleKind === 'solid' ? highlightColor : highlightStyleKind}`
								: 'Highlights off — tap to turn on'}
							aria-label="Highlights"
							aria-pressed={hlOn}
						>
							<span
								class="studio-hl-swatch"
								class:studio-hl-swatch--off={!hlOn}
								style={hlSwatchStyle}
								aria-hidden="true"
							></span>
							<Highlighter />
							<span class="studio-dock-tool-label">Highlights</span>
							{#if hlOn}
								<span class="studio-hl-on-dot" aria-hidden="true"></span>
							{/if}
						</Button>
					{/snippet}
				</PopoverTrigger>
				<PopoverContent
					side="bottom"
					sideOffset={10}
					align="center"
					trapFocus={false}
					portalProps={{ to: 'body' }}
					class="studio-dock-popover w-[280px]"
				>
					<div class="mb-3 flex items-center justify-between gap-2">
						<p class="text-[12px] font-semibold tracking-tight">Highlights</p>
						<div class="flex items-center gap-0.5 rounded-lg bg-[#ececec] p-0.5">
							<button
								type="button"
								aria-pressed={studioTextHighlightsEnabled}
								class="h-6 rounded-md px-2.5 text-[10px] font-semibold transition-all
									{studioTextHighlightsEnabled
										? 'bg-white text-[#111] ring-1 ring-black/10'
										: 'bg-transparent text-[#888] hover:text-[#333]'}"
								onclick={() => persistBrandHighlightsEnabled(true)}
							>On</button>
							<button
								type="button"
								aria-pressed={!studioTextHighlightsEnabled}
								class="h-6 rounded-md px-2.5 text-[10px] font-semibold transition-all
									{!studioTextHighlightsEnabled
										? 'bg-white text-[#111] ring-1 ring-black/10'
										: 'bg-transparent text-[#888] hover:text-[#333]'}"
								onclick={() => persistBrandHighlightsEnabled(false)}
							>Off</button>
						</div>
					</div>
					{#if studioTextHighlightsEnabled}
						<p class="mb-2 text-[10px] leading-snug text-[#999]">
							Accent color for highlighted words in generated copy.
						</p>
						<div class="flex flex-wrap items-center gap-1.5">
							{#each HIGHLIGHT_SOLID_PRESETS as c (c)}
								<button
									type="button"
									title={c}
									aria-label="Highlight {c}"
									aria-pressed={highlightStyleKind === 'solid' && highlightColor.toUpperCase() === c.toUpperCase()}
									onclick={() => persistBrandHighlight(c)}
									class="h-7 w-7 shrink-0 rounded-full transition-transform hover:scale-105
										{highlightStyleKind === 'solid' && highlightColor.toUpperCase() === c.toUpperCase()
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
									oninput={(e) => persistBrandHighlight((e.currentTarget as HTMLInputElement).value)}
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
			<Popover bind:open={brandProfilePopoverOpen}>
				<PopoverTrigger>
					{#snippet child({ props })}
						<Button
							{...props}
							variant="outline"
							class="studio-dock-tool-btn"
							title="Branding — name, logo, and colors"
							aria-label="Branding"
						>
							<User />
							<span class="studio-dock-tool-label">Branding</span>
						</Button>
					{/snippet}
				</PopoverTrigger>
				<PopoverContent
					side="bottom"
					sideOffset={10}
					align="center"
					trapFocus={false}
					portalProps={{ to: 'body' }}
					class="studio-dock-popover max-h-[min(70vh,640px)] w-[320px] overflow-y-auto"
				>
					<p class="mb-3 text-[12px] font-semibold tracking-tight">Branding</p>

					<div class="grid grid-cols-2 gap-2">
						<div class="min-w-0">
							<label class="mb-1 block text-[10px] font-medium text-[#888]" for="studio-brand-name">Username</label>
							<input
								id="studio-brand-name"
								class="w-full rounded-lg border border-[#ebebeb] bg-[#fafafa] px-2.5 py-1.5 text-[12px] text-[#111] outline-none focus:border-[#ccc]"
								value={brandDisplayName}
								placeholder="MEME ACCOUNTS"
								oninput={(e) => {
									brandDisplayName = (e.currentTarget as HTMLInputElement).value;
									applyBrandProfileToSlides(brandDisplayName, brandHandle, { force: true });
								}}
								onchange={() => persistBrandProfile()}
							/>
						</div>
						<div class="min-w-0">
							<label class="mb-1 block text-[10px] font-medium text-[#888]" for="studio-brand-handle">Handle</label>
							<input
								id="studio-brand-handle"
								class="w-full rounded-lg border border-[#ebebeb] bg-[#fafafa] px-2.5 py-1.5 text-[12px] text-[#111] outline-none focus:border-[#ccc]"
								value={brandHandle}
								placeholder="@memeaccounts"
								oninput={(e) => {
									brandHandle = (e.currentTarget as HTMLInputElement).value;
									applyBrandProfileToSlides(brandDisplayName, brandHandle, { force: true });
								}}
								onchange={() => persistBrandProfile()}
							/>
						</div>
					</div>

					<div class="mt-3.5 space-y-2.5 border-t border-[#f2f2f2] pt-3">
						<Label class="text-[10px] font-semibold uppercase tracking-widest text-[#b0b0b0]">Logo</Label>
						<p class="text-[11px] leading-snug text-[#888]">Shows on News slides and profile avatars.</p>
						<div class="flex items-center gap-2">
							<input type="file" accept="image/*" class="sr-only" tabindex={-1} aria-hidden="true" bind:this={sourceLogoInput}
								onchange={async (e) => {
									const file = (e.currentTarget as HTMLInputElement).files?.[0];
									if (!file) return;
									try {
										sourceLogoSrc = await prepareImageAsDataUrl(file, {
											maxDim: 800,
											maxBytes: 600_000,
											quality: 0.88,
										});
									} catch (err) {
										alert(err instanceof Error ? err.message : 'Logo upload failed');
										(e.currentTarget as HTMLInputElement).value = '';
										return;
									}
									(e.currentTarget as HTMLInputElement).value = '';
									sourceLabelMode = 'logo';
									/* First upload often still has the old 260 default — snap to byline-sized mark. */
									if (sourceLogoWidth >= 220) sourceLogoWidth = 140;
									applyBrandLogoToProfileAvatars(sourceLogoSrc, true);
									persistNewsSourceChrome({
										sourceLogoSrc,
										sourceLabelMode: 'logo',
										sourceLogoWidth,
									});
								}}
							/>
							<Button type="button" variant="outline" size="sm" class="h-8 rounded-lg text-[11px] font-semibold border-[#ebebeb]" onclick={() => sourceLogoInput?.click()}>
								{sourceLogoSrc ? 'Replace' : 'Add logo'}
							</Button>
							{#if sourceLogoSrc}
								<Button type="button" variant="ghost" size="sm" class="h-8 rounded-lg text-[11px]" onclick={() => {
									sourceLogoSrc = '';
									persistNewsSourceChrome({ sourceLogoSrc: '' });
								}}>Remove</Button>
								<div class="ml-auto h-8 w-8 rounded-lg border border-[#ebebeb] overflow-hidden grid place-items-center">
									<img src={sourceLogoSrc} alt="" class="h-full w-full object-contain p-1" draggable="false" />
								</div>
							{/if}
						</div>
						{#if sourceLogoSrc}
							<div class="flex min-w-0 items-center gap-2">
								<Label class="w-10 shrink-0 text-[9px] text-[#b0b0b0]">Size</Label>
								<Slider
									type="single"
									value={sourceLogoWidth}
									min={80}
									max={400}
									step={4}
									onValueChange={(v) => {
										const n = Array.isArray(v) ? v[0] : v;
										if (typeof n === 'number' && Number.isFinite(n)) {
											sourceLogoWidth = Math.round(n);
											persistNewsSourceChrome({ sourceLogoWidth });
										}
									}}
									class="min-w-0 flex-1"
								/>
								<span class="w-9 shrink-0 text-right text-[9px] text-[#b0b0b0]">{sourceLogoWidth}</span>
							</div>
						{/if}
					</div>
				</PopoverContent>
			</Popover>
			</ButtonGroup.Root>
			<ButtonGroup.Root class="studio-dock-tool-group" title="Slide actions">
				<Button
					type="button"
					variant="outline"
					size="icon"
					class="studio-dock-tool-btn text-red-600 hover:text-red-600"
					title="Delete slide"
					aria-label="Delete slide"
					disabled={slides.length <= 1}
					onclick={() => deleteActiveSlide()}
				>
					<Trash2 class="text-red-600" />
				</Button>
				<Button
					type="button"
					variant="outline"
					size="icon"
					class="studio-dock-tool-btn"
					title="Reset slide"
					aria-label="Reset slide"
					onclick={() => resetCurrentSlideToDefaults()}
				>
					<RotateCcw />
				</Button>
			</ButtonGroup.Root>
			</ButtonGroup.Root>
			</div>
		</div>

		<!-- Slide indicator + nav arrows -->
		<!-- Slide switcher removed (filmstrip below is the navigator) -->

		<div class="flex min-h-0 flex-1 flex-col overflow-hidden">
		<!-- Main preview + quick actions (next to canvas) -->
		<div
			class="flex min-h-0 w-full min-w-0 flex-1 items-center justify-center overflow-hidden"
			bind:this={studioPreviewHostEl}
		>
		<div class="flex shrink-0 justify-center py-1 px-1">
			<div
				style="width: {previewDisplayW}px;"
				class="studio-canvas-shell relative z-10 max-w-full shrink-0"
				class:is-measured={studioSizeTransitions}
				class:is-ready={studioRevealReady}
			>
				<!-- Clip any absolutely-positioned template layers so they don't sit over the toolbar -->
				<div
					style="height: {previewDisplayH}px; background: var(--app-surface-2); border: 1px solid var(--app-border);"
					class="studio-canvas-frame relative rounded-2xl {previewCanvasOverflowClass}"
					class:is-measured={studioSizeTransitions}
					class:is-ready={studioRevealReady}
				>

		{#if !studioRevealReady || studioCanvasBusyLoading}
			<div
				class="studio-boot-overlay absolute inset-0 z-[40] overflow-hidden rounded-2xl"
				class:studio-boot-veil={!studioRevealReady}
				transition:fade={{
					duration: studioRevealReady && studioCanvasBusyLoading ? 160 : 0,
				}}
				aria-live="polite"
				aria-busy="true"
			>
				<StudioCanvasSkeleton
					label={!studioRevealReady
						? skipLatestWorkspaceDraftRestore || forcedBlankFromQuery || forcedTemplateFromQuery
							? 'Preparing template'
							: 'Restoring your last edit'
						: exporting || exportingAll
							? 'Exporting slides'
							: studioGenerating || fetchingNews
								? newsContentMode === 'news'
									? 'Fetching news'
									: 'Generating'
								: (cuttingOut[paintSlide] ?? false)
									? (cutoutMessage || 'Cutting out subject')
									: backgroundMediaLoading
										? 'Loading video'
										: ''}
				/>
			</div>
		{/if}
		<div
			class="studio-canvas-live"
			class:is-live={studioRevealReady}
			aria-hidden={!studioRevealReady}
		>
			{#if editingBrandCta || exportingBrandCta}
				<BrandCtaTemplate
					bind:exportRef
					image={studioCanvasImageUrl(brandCta.image)}
					headline={brandCta.headline}
					subline={brandCta.subline}
					canvasW={CANVAS_W}
					canvasH={CANVAS_H}
					scale={previewScale}
				/>
			{:else if previewTemplate === 'blank'}
				<!-- Export root must include background + stickers + text overlays (not just BlankTemplate). -->
				<div
					bind:this={exportRef}
					class="relative overflow-hidden rounded-2xl"
					style="
						width: {CANVAS_W}px;
						height: {CANVAS_H}px;
						transform: scale({previewScale});
						transform-origin: top left;
						background: {newsSolidBgBySlide[paintSlide] || '#ffffff'};
					"
					data-studio-canvas-root
				>
					<BlankTemplate
						backgroundImage={canvasBackgroundImage}
						backgroundVideo={canvasBackgroundVideo}
						solidBackgroundColor={newsSolidBgBySlide[paintSlide] || canvasSolidHex}
						w={CANVAS_W}
						h={CANVAS_H}
						scale={1}
						interactive={canvasInteractive}
						overlays={canvasOverlays}
						resolveSrc={resolveMediaUrl}
						onBackgroundDblClick={(d) => {
							if (!canvasInteractive) return;
							openBgToolbarAt(d.clientX, d.clientY);
						}}
						onOverlaysChange={(o) => {
							if (!canvasInteractive) return;
							setSlideOverlays(paintSlide, o, 'blank');
						}}
					/>
					<StudioTextOverlays
						w={CANVAS_W}
						h={CANVAS_H}
						scale={1}
						pointerScale={previewScale}
						interactive={canvasInteractive}
						highlightColor={highlightColor}
						textOverlays={canvasTextOverlays}
						snapToCanvasCenter={true}
						activeTextKind={selectedText}
						activeTextOverlayId={selectedTextOverlayId}
						onRangeSelect={onTextOverlayRangeSelect}
						onTextOverlaysChange={(o: any) => {
							if (!canvasInteractive) return;
							setSlideTextOverlays(paintSlide, o, 'blank');
						}}
						onTextSelect={(kind: any, el: any) => onTextSelect(kind as any, el)}
						parseHighlightMarkup={true}
					/>
				</div>
			{:else if previewTemplate === 'news'}
				<NewsTemplate
					templateTheme={canvasTheme}
					bind:exportRef
					bind:circleX
					bind:circleY
					bind:circleSize
					bind:circleBorderColor
					bind:circleShadow
					bind:circle2X
					bind:circle2Y
					bind:circle2Size
					bind:circle2BorderColor
					bind:circle2Shadow
					bind:bgOffsetX
					bind:bgOffsetY
					bind:bgZoom
					bind:bgFitMode
					bind:bgContainMagnify
					bind:textPanelOffsetY
					bind:shadowHeight
					bind:shadowStrength
					bind:shadowCurve
					bind:shadowColor
					onTextStackLayout={fitNewsShadowFromStack}
					backgroundImage={canvasBackgroundImage}
					backgroundVideo={canvasBackgroundVideo}
					solidBackgroundColor={newsSolidBgBySlide[paintSlide] ?? ''}
					videoTrimStartSec={canvasVideoTrimStart}
					videoTrimEndSec={canvasVideoTrimEnd || canvasVideoDuration || 0}
					videoSeekSec={videoSeekSec}
					videoMuted={canvasVideoMuted}
					videoVolume={canvasVideoVolume}
					onVideoDuration={(d) => {
							const dur = Number(d);
							if (!Number.isFinite(dur) || dur <= 0) return;
							videoDurationBySlide = Array.from(
								{ length: slides.length },
								(_, i) => (i === paintSlide ? dur : (Number.isFinite(videoDurationBySlide[i]) ? Math.max(0, videoDurationBySlide[i]) : 0))
							);
							// If end is unset, default it to full duration.
							const curEnd = videoTrimEndSecBySlide[paintSlide] ?? 0;
							if (!curEnd) {
								videoTrimEndSecBySlide = Array.from(
									{ length: slides.length },
									(_, i) => (i === paintSlide ? dur : (Number.isFinite(videoTrimEndSecBySlide[i]) ? Math.max(0, videoTrimEndSecBySlide[i]) : 0))
								);
							}
						}}
					subjectCutout={canvasCutout}
showSubjectCutout={canvasShowCutout}
					allowCircle={canvasShowPrimaryCircle}
					allowCircle2={true}
					circleImage={canvasShowPrimaryCircle ? canvasCircleImg : ''}
					showCircle2={canvasShowCircle2}
					circle2Image={canvasShowCircle2 ? canvasCircle2Img : ''}
					text={canvasOverlayText}
					subtext={canvasNewsSubtext}
					source={source}
					sourceLogoSrc={sourceLogoSrc}
					sourceLabelMode={sourceLabelMode}
					sourceBorderKind={sourceBorderKind}
					sourceBorderColor={sourceBorderColor}
					sourceLogoWidth={sourceLogoWidth}
					sourceLogoPlateColor={sourceLogoPlateColor}
					onSourceLogoChange={(src) => {
						if (!canvasInteractive) return;
						sourceLogoSrc = src;
						if (src) sourceLabelMode = 'logo';
						persistNewsSourceChrome({
							sourceLogoSrc: src,
							sourceLabelMode: src ? 'logo' : sourceLabelMode,
						});
					}}
					onSourceLogoWidthChange={(w) => {
						if (!canvasInteractive) return;
						sourceLogoWidth = w;
						persistNewsSourceChrome({ sourceLogoWidth: w });
					}}
					onSourceLogoPlateChange={(hex) => {
						if (!canvasInteractive) return;
						sourceLogoPlateColor = String(hex ?? '').trim();
						persistNewsSourceChrome({ sourceLogoPlateColor });
					}}
					onSourceStyleChange={(patch) => {
						if (!canvasInteractive) return;
						patchNewsSourceStyle(patch);
					}}
					highlightColor={highlightColor}
					highlightDefaults={studioHighlightDefaults}
					textColor={canvasHeadlineInk}
					w={CANVAS_W}
					h={CANVAS_H}
					scale={previewScale}
					interactive={canvasInteractive}
					overlays={canvasOverlays}
					resolveSrc={resolveMediaUrl}
					/* Live preview: StudioTextOverlays paints free text (Canva chrome).
					   Export/filmstrip rasterize NewsTemplate alone, so feed overlays then. */
					textOverlays={
						exporting || exportingAll || filmstripBulkCapturing ? canvasTextOverlays : []
					}
					headlineStyle={{ ...NEWS_HEADLINE_STYLE, ...canvasHeadlineStyle }}
					subtextStyle={{ ...NEWS_SUBTEXT_STYLE, ...canvasNewsSubtextStyle }}
					sourceStyle={canvasSourceStyle}
					textOffsets={offsetsForTemplate(paintSlide, 'news')}
					onTextOffsetChange={(kind, next) => {
						if (!canvasInteractive) return;
						setTemplateOffset(paintSlide, 'news', String(kind), next);
					}}
					selectedText={selectedText}
					onHeadlineEditStart={() => {
						if (!canvasInteractive) return;
						newsHeadlineLive = slides[paintSlide] ?? '';
					}}
					onHeadlineLive={(s) => {
						if (!canvasInteractive) return;
						newsHeadlineLive = s;
					}}
					onHeadlineEditEnd={() => {
						newsHeadlineLive = null;
					}}
					onTextChange={(t) => { if (!canvasInteractive) return; setActiveSlideText(t); }}
					onSubtextChange={(t) => {
						if (!canvasInteractive) return;
						pushUndo('news', paintSlide);
						newsSubtextBySlide = newsSubtextBySlide.map((x, i) =>
							i === paintSlide ? stripEmDashes(t) : x,
						);
					}}
					onTextOverlaysChange={(o) => {
						if (!canvasInteractive) return;
						setSlideTextOverlays(paintSlide, o, 'news');
					}}
					onCircleMove={(x, y) => { if (!canvasInteractive) return; circleX = x; circleY = y; }}
					onCircleImageChange={(src) => {
						if (!canvasInteractive) return;
						circleImages = circleImages.map((v, i) => (i === paintSlide ? src : v));
						if (String(src ?? '').trim()) {
							showCircleBySlide = showCircleBySlide.map((v, i) => (i === paintSlide ? true : v));
						}
					}}
					onCircleRemove={() => {
						if (!canvasInteractive) return;
						circleImages = circleImages.map((v, i) => (i === paintSlide ? '' : v));
						showCircleBySlide = showCircleBySlide.map((v, i) => (i === paintSlide ? false : v));
					}}
					onCircleAIClick={() => { if (!canvasInteractive) return; void generateCircleFromPrompt(1); }}
					onCircle2Move={(x, y) => { if (!canvasInteractive) return; circle2X = x; circle2Y = y; }}
					onCircle2ImageChange={(src) => {
						if (!canvasInteractive) return;
						circle2Images = circle2Images.map((v, i) => (i === paintSlide ? src : v));
						showCircle2BySlide = showCircle2BySlide.map((v, i) => (i === paintSlide ? !!src : v));
					}}
					onCircle2AIClick={() => { if (!canvasInteractive) return; void generateCircleFromPrompt(2); }}
					onOverlaysChange={(o) => { if (!canvasInteractive) return; setSlideOverlays(paintSlide, o, previewTemplate); }}
					onTextSelect={onTextSelect}
					onHeadlineRangeSelect={onHeadlineRangeSelect}
					headlineSelectionRestoreNonce={headlineSelectionRestoreNonce}
					headlineSelectionRestoreRange={headlineRange}
					onBackgroundDblClick={(d) => {
						if (!canvasInteractive) return;
						openBgToolbarAt(d.clientX, d.clientY);
					}}
				/>
				<!-- Shared text overlay layer (sits above the template) -->
				<StudioTextOverlays
					w={CANVAS_W}
					h={CANVAS_H}
					scale={previewScale}
					interactive={canvasInteractive}
					highlightColor={highlightColor}
					textOverlays={canvasTextOverlays}
					snapToCanvasCenter={true}
					activeTextKind={selectedText}
					activeTextOverlayId={selectedTextOverlayId}
					onRangeSelect={onTextOverlayRangeSelect}
					onTextOverlaysChange={(o: any) => { if (!canvasInteractive) return; setSlideTextOverlays(paintSlide, o, previewTemplate); }}
					onTextSelect={(kind: any, el: any) => onTextSelect(kind as any, el)}
					parseHighlightMarkup={true}
				/>
			{:else if previewTemplate === 'article'}
				<ArticleTemplate
					templateTheme={canvasTheme}
					bind:exportRef
					canvasW={CANVAS_W}
					canvasH={CANVAS_H}
					text={articleTextBySlide[paintSlide] ?? ''}
					image={canvasBackgroundImage}
					logoSrc={articleLogoSrcBySlide[paintSlide] ?? ''}
					onLogoSrcChange={(v) => {
						if (!canvasInteractive) return;
						pushUndo('article', paintSlide);
						articleLogoSrcBySlide = articleLogoSrcBySlide.map((x, i) => (i === paintSlide ? v : x));
					}}
					swipeText={articleSwipeTextBySlide[paintSlide] ?? '«« Swipe'}
					onSwipeTextChange={(v) => { if (!canvasInteractive) return; pushUndo('article', paintSlide); articleSwipeTextBySlide = articleSwipeTextBySlide.map((x, i) => i === paintSlide ? v : x); }}
					textOffsets={offsetsForTemplate(paintSlide, 'article')}
					onTextOffsetChange={(kind, next) => { if (!canvasInteractive) return; setTemplateOffset(paintSlide, 'article', String(kind), next); }}
					scale={previewScale}
					interactive={canvasInteractive}
					headlineStyle={canvasStyleMap.articleBody ?? canvasHeadlineStyle}
					articleStyles={{
						articleBody: canvasStyleMap.articleBody ?? {},
						articleSwipeText: canvasStyleMap.articleSwipeText ?? {},
					}}
					selectedText={selectedText}
					onTextChange={(t) => { if (!canvasInteractive) return; pushUndo('article', paintSlide); articleTextBySlide = articleTextBySlide.map((x, i) => i === paintSlide ? t : x); }}
					onTextSelect={onTextSelect}
					onHeadlineRangeSelect={onHeadlineRangeSelect}
				/>
				<StudioImageStickers
					w={CANVAS_W}
					h={CANVAS_H}
					scale={previewScale}
					interactive={canvasInteractive}
					overlays={canvasOverlays}
					resolveSrc={resolveMediaUrl}
					onOverlaysChange={(o) => { if (!canvasInteractive) return; setSlideOverlays(paintSlide, o, previewTemplate); }}
				/>
				<!-- Shared text overlay layer (sits above the template) -->
				<StudioTextOverlays
					w={CANVAS_W}
					h={CANVAS_H}
					scale={previewScale}
					interactive={canvasInteractive}
					highlightColor={highlightColor}
					textOverlays={canvasTextOverlays}
					snapToCanvasCenter={true}
					activeTextKind={selectedText}
					activeTextOverlayId={selectedTextOverlayId}
					onRangeSelect={onTextOverlayRangeSelect}
					onTextOverlaysChange={(o: any) => { if (!canvasInteractive) return; setSlideTextOverlays(paintSlide, o, previewTemplate); }}
					onTextSelect={(kind: any, el: any) => onTextSelect(kind as any, el)}
					parseHighlightMarkup={true}
				/>
			{:else if previewTemplate === 'tweet'}
				<!-- Tweet: minimal integration for now (top tweet text = slide text). -->
				<TweetTemplate
					templateTheme={canvasTheme}
					bind:exportRef
					canvasW={CANVAS_W}
					canvasH={CANVAS_H}
					topText={tweetTopTextBySlide[paintSlide] ?? ''}
					onTopTextChange={(v) => { if (!canvasInteractive) return; pushUndo('tweet', paintSlide); tweetTopTextBySlide = tweetTopTextBySlide.map((x, i) => i === paintSlide ? v : x); }}
					/* Editable per-slide tweet fields */
					topName={tweetTopNameBySlide[paintSlide] ?? 'Chef 👨‍🍳'}
					topHandle={tweetTopHandleBySlide[paintSlide] ?? '@chefsevenn'}
					bottomName={tweetBottomNameBySlide[paintSlide] ?? 'Mo Mohler'}
					bottomHandle={tweetBottomHandleBySlide[paintSlide] ?? '@MoMohler'}
					onTopNameChange={(v) => { if (!canvasInteractive) return; pushUndo('tweet', paintSlide); tweetTopNameBySlide = tweetTopNameBySlide.map((x, i) => i === paintSlide ? v : x); }}
					onTopHandleChange={(v) => { if (!canvasInteractive) return; pushUndo('tweet', paintSlide); tweetTopHandleBySlide = tweetTopHandleBySlide.map((x, i) => i === paintSlide ? v : x); }}
					onBottomNameChange={(v) => { if (!canvasInteractive) return; pushUndo('tweet', paintSlide); tweetBottomNameBySlide = tweetBottomNameBySlide.map((x, i) => i === paintSlide ? v : x); }}
					onBottomHandleChange={(v) => { if (!canvasInteractive) return; pushUndo('tweet', paintSlide); tweetBottomHandleBySlide = tweetBottomHandleBySlide.map((x, i) => i === paintSlide ? v : x); }}
					bottomText={tweetBottomTextBySlide[paintSlide] ?? ''}
					onBottomTextChange={(v) => { if (!canvasInteractive) return; pushUndo('tweet', paintSlide); tweetBottomTextBySlide = tweetBottomTextBySlide.map((x, i) => i === paintSlide ? v : x); }}
					replyCount={tweetReplyCountBySlide[paintSlide] ?? '4.2K'}
					repostCount={tweetRepostCountBySlide[paintSlide] ?? '12.8K'}
					likeCount={tweetLikeCountBySlide[paintSlide] ?? '89.4K'}
					onReplyCountChange={(v) => { if (!canvasInteractive) return; pushUndo('tweet', paintSlide); tweetReplyCountBySlide = tweetReplyCountBySlide.map((x, i) => i === paintSlide ? v : x); }}
					onRepostCountChange={(v) => { if (!canvasInteractive) return; pushUndo('tweet', paintSlide); tweetRepostCountBySlide = tweetRepostCountBySlide.map((x, i) => i === paintSlide ? v : x); }}
					onLikeCountChange={(v) => { if (!canvasInteractive) return; pushUndo('tweet', paintSlide); tweetLikeCountBySlide = tweetLikeCountBySlide.map((x, i) => i === paintSlide ? v : x); }}
					topAvatar={tweetTopAvatarImageBySlide[paintSlide] ?? ''}
					topAvatarMode={tweetTopAvatarModeBySlide[paintSlide] ?? 'text'}
					topAvatarInnerBg={tweetTopAvatarInnerBgBySlide[paintSlide] ?? ''}
					topAvatarLabel={tweetTopAvatarLabelBySlide[paintSlide] ?? ''}
					topAvatarRingColor={tweetTopAvatarRingColorBySlide[paintSlide] ?? defaultAvatarRingColor}
					topAvatarRingWidth={tweetTopAvatarRingWidthBySlide[paintSlide] ?? defaultTweetAvatarRingWidth}
					bottomAvatar={tweetBottomAvatarImageBySlide[paintSlide] ?? ''}
					bottomAvatarMode={tweetBottomAvatarModeBySlide[paintSlide] ?? 'text'}
					bottomAvatarInnerBg={tweetBottomAvatarInnerBgBySlide[paintSlide] ?? ''}
					bottomAvatarLabel={tweetBottomAvatarLabelBySlide[paintSlide] ?? ''}
					bottomAvatarRingColor={tweetBottomAvatarRingColorBySlide[paintSlide] ?? defaultAvatarRingColor}
					bottomAvatarRingWidth={tweetBottomAvatarRingWidthBySlide[paintSlide] ?? defaultTweetAvatarRingWidth}
topImage={studioCanvasImageUrl(
						(bgImagesByTemplate.tweet ?? [])[paintSlide] || '/templates/tweet/demo-bg.jpg',
					)}
onTopImageChange={(v) => { if (!canvasInteractive) return; pushUndo('tweet', paintSlide); setSlideImage(paintSlide, v, 'tweet'); }}
topVideo={(bgVideosByTemplate.tweet ?? [])[paintSlide] ?? ''}
onTopVideoChange={(v) => { if (!canvasInteractive) return; pushUndo('tweet', paintSlide); setSlideVideo(paintSlide, v, 'tweet'); }}
topImageHeight={tweetTopImageHeightBySlide[paintSlide] ?? 720}
onTopImageHeightChange={(v) => { if (!canvasInteractive) return; pushUndo('tweet', paintSlide); tweetTopImageHeightBySlide = tweetTopImageHeightBySlide.map((x, i) => i === paintSlide ? v : x); }}
topImageWidth={tweetTopImageWidthBySlide[paintSlide] ?? 920}
onTopImageWidthChange={(v) => { if (!canvasInteractive) return; pushUndo('tweet', paintSlide); tweetTopImageWidthBySlide = tweetTopImageWidthBySlide.map((x, i) => i === paintSlide ? v : x); }}
topImageZoom={tweetTopImageZoomBySlide[paintSlide] ?? 1}
onTopImageZoomChange={(v) => { if (!canvasInteractive) return; pushUndo('tweet', paintSlide); tweetTopImageZoomBySlide = tweetTopImageZoomBySlide.map((x, i) => i === paintSlide ? v : x); }}
topImagePanX={tweetTopImagePanXBySlide[paintSlide] ?? 50}
topImagePanY={tweetTopImagePanYBySlide[paintSlide] ?? 50}
onTopImagePanChange={(x, y) => { if (!canvasInteractive) return; pushUndo('tweet', paintSlide); tweetTopImagePanXBySlide = tweetTopImagePanXBySlide.map((v, i) => i === paintSlide ? x : v); tweetTopImagePanYBySlide = tweetTopImagePanYBySlide.map((v, i) => i === paintSlide ? y : v); }}
					textOffsets={offsetsForTemplate(paintSlide, 'tweet')}
					onTextOffsetChange={(kind, next) => { if (!canvasInteractive) return; setTemplateOffset(paintSlide, 'tweet', String(kind), next); }}
					scale={previewScale}
					interactive={canvasInteractive}
					tweetStyles={canvasTweetStyles}
					{...({
						headlineStyle: canvasHeadlineStyle,
						selectedText,
						onTextSelect,
						onHeadlineRangeSelect,
						showToolbar: false,
					} as any)}
				/>
				<StudioImageStickers
					w={CANVAS_W}
					h={CANVAS_H}
					scale={previewScale}
					interactive={canvasInteractive}
					overlays={canvasOverlays}
					resolveSrc={resolveMediaUrl}
					onOverlaysChange={(o) => { if (!canvasInteractive) return; setSlideOverlays(paintSlide, o, previewTemplate); }}
				/>
				<!-- Shared text overlay layer (sits above the template) -->
				<StudioTextOverlays
					w={CANVAS_W}
					h={CANVAS_H}
					scale={previewScale}
					interactive={canvasInteractive}
					highlightColor={highlightColor}
					textOverlays={canvasTextOverlays}
					snapToCanvasCenter={true}
					activeTextKind={selectedText}
					activeTextOverlayId={selectedTextOverlayId}
					onRangeSelect={onTextOverlayRangeSelect}
					onTextOverlaysChange={(o: any) => { if (!canvasInteractive) return; setSlideTextOverlays(paintSlide, o, previewTemplate); }}
					onTextSelect={(kind: any, el: any) => onTextSelect(kind as any, el)}
					parseHighlightMarkup={true}
				/>
			{:else if previewTemplate === 'textCarousel'}
				<TextCarouselTemplate
					templateTheme={canvasTheme}
					bind:exportRef
					canvasW={CANVAS_W}
					canvasH={CANVAS_H}
					text={textCarouselTextBySlide[paintSlide] ?? ''}
					name={textCarouselNameBySlide[paintSlide] ?? brandDisplayName}
					handle={textCarouselHandleBySlide[paintSlide] ?? brandHandle}
					avatar={textCarouselAvatarImageBySlide[paintSlide] ?? ''}
					avatarMode={textCarouselAvatarModeBySlide[paintSlide] ?? 'text'}
					avatarInnerBg={textCarouselAvatarInnerBgBySlide[paintSlide] ?? ''}
					avatarLabel={textCarouselAvatarLabelBySlide[paintSlide] ?? ''}
					ringColor={textCarouselAvatarRingColorBySlide[paintSlide] ?? defaultAvatarRingColor}
					ringWidth={textCarouselAvatarRingWidthBySlide[paintSlide] ?? defaultTextCarouselRingWidth}
					highlightColor={highlightColor}
					highlightDefaults={studioHighlightDefaults}
					onNameChange={(v) => { if (!canvasInteractive) return; pushUndo('textCarousel', paintSlide); textCarouselNameBySlide = textCarouselNameBySlide.map((x, i) => i === paintSlide ? v : x); }}
					onHandleChange={(v) => { if (!canvasInteractive) return; pushUndo('textCarousel', paintSlide); textCarouselHandleBySlide = textCarouselHandleBySlide.map((x, i) => i === paintSlide ? v : x); }}
					scale={previewScale}
					interactive={canvasInteractive}
					showToolbar={false}
					textOffsets={offsetsForTemplate(paintSlide, 'textCarousel')}
					onTextOffsetChange={(kind, next) => { if (!canvasInteractive) return; setTemplateOffset(paintSlide, 'textCarousel', String(kind), next); }}
					headlineStyle={canvasStyleMap.textCarouselBody ?? {}}
					textCarouselStyles={{
						textCarouselName: canvasStyleMap.textCarouselName ?? {},
						textCarouselHandle: canvasStyleMap.textCarouselHandle ?? {},
						textCarouselBody: canvasStyleMap.textCarouselBody ?? {},
					}}
					selectedText={selectedText}
					onTextChange={(t) => { if (!canvasInteractive) return; pushUndo('textCarousel', paintSlide); textCarouselTextBySlide = textCarouselTextBySlide.map((x, i) => i === paintSlide ? t : x); }}
					onTextSelect={onTextSelect}
					onHeadlineRangeSelect={onHeadlineRangeSelect}
				/>
				<StudioImageStickers
					w={CANVAS_W}
					h={CANVAS_H}
					scale={previewScale}
					interactive={canvasInteractive}
					overlays={canvasOverlays}
					resolveSrc={resolveMediaUrl}
					onOverlaysChange={(o) => { if (!canvasInteractive) return; setSlideOverlays(paintSlide, o, previewTemplate); }}
				/>
				<!-- Shared text overlay layer (sits above the template) -->
				<StudioTextOverlays
					w={CANVAS_W}
					h={CANVAS_H}
					scale={previewScale}
					interactive={canvasInteractive}
					highlightColor={highlightColor}
					textOverlays={canvasTextOverlays}
					snapToCanvasCenter={true}
					activeTextKind={selectedText}
					activeTextOverlayId={selectedTextOverlayId}
					onRangeSelect={onTextOverlayRangeSelect}
					onTextOverlaysChange={(o: any) => { if (!canvasInteractive) return; setSlideTextOverlays(paintSlide, o, previewTemplate); }}
					onTextSelect={(kind: any, el: any) => onTextSelect(kind as any, el)}
					parseHighlightMarkup={true}
				/>
			{:else if isWhitePostFamily(previewTemplate)}
				<WhitePostTemplate
					bind:exportRef
					layout={previewTemplate === 'whiteMedia' ? 'media' : 'thread'}
					name={textCarouselNameBySlide[paintSlide] ?? brandDisplayName}
					handle={textCarouselHandleBySlide[paintSlide] ?? brandHandle}
					avatar={textCarouselAvatarImageBySlide[paintSlide] ??
						(previewTemplate === 'whiteMedia'
							? WHITE_MEDIA_DEFAULTS.avatarUrl
							: WHITE_THREAD_DEFAULTS.avatarUrl)}
					text={textCarouselTextBySlide[paintSlide] ??
						(previewTemplate === 'whiteMedia'
							? WHITE_MEDIA_DEFAULTS.body
							: WHITE_THREAD_DEFAULTS.body)}
					mediaImage={
						previewTemplate === 'whiteMedia' ? canvasBackgroundImage : WHITE_MEDIA_DEFAULTS.imageUrl
					}
					w={CANVAS_W}
					h={CANVAS_H}
					scale={previewScale}
					interactive={canvasInteractive}
					selectedText={selectedText}
					nameStyle={canvasStyleMap.textCarouselName ?? {}}
					handleStyle={canvasStyleMap.textCarouselHandle ?? {}}
					bodyStyle={canvasStyleMap.textCarouselBody ?? {}}
					textOffsets={offsetsForTemplate(paintSlide, previewTemplate)}
					onTextOffsetChange={(kind, next) => {
						if (!canvasInteractive) return;
						setTemplateOffset(paintSlide, previewTemplate, String(kind), next);
					}}
					onNameChange={(v) => {
						if (!canvasInteractive) return;
						pushUndo(previewTemplate, paintSlide);
						textCarouselNameBySlide = textCarouselNameBySlide.map((x, i) =>
							i === paintSlide ? v : x,
						);
					}}
					onHandleChange={(v) => {
						if (!canvasInteractive) return;
						pushUndo(previewTemplate, paintSlide);
						textCarouselHandleBySlide = textCarouselHandleBySlide.map((x, i) =>
							i === paintSlide ? v : x,
						);
					}}
					onTextChange={(v) => {
						if (!canvasInteractive) return;
						pushUndo(previewTemplate, paintSlide);
						textCarouselTextBySlide = textCarouselTextBySlide.map((x, i) =>
							i === paintSlide ? v : x,
						);
					}}
					onTextSelect={onTextSelect}
					onHeadlineRangeSelect={onHeadlineRangeSelect}
					showToolbar={false}
				/>
				<StudioImageStickers
					w={CANVAS_W}
					h={CANVAS_H}
					scale={previewScale}
					interactive={canvasInteractive}
					overlays={canvasOverlays}
					resolveSrc={resolveMediaUrl}
					onOverlaysChange={(o) => {
						if (!canvasInteractive) return;
						setSlideOverlays(paintSlide, o, previewTemplate);
					}}
				/>
				<StudioTextOverlays
					w={CANVAS_W}
					h={CANVAS_H}
					scale={previewScale}
					interactive={canvasInteractive}
					highlightColor={highlightColor}
					textOverlays={canvasTextOverlays}
					snapToCanvasCenter={true}
					activeTextKind={selectedText}
					activeTextOverlayId={selectedTextOverlayId}
					onRangeSelect={onTextOverlayRangeSelect}
					onTextOverlaysChange={(o: any) => {
						if (!canvasInteractive) return;
						setSlideTextOverlays(paintSlide, o, previewTemplate);
					}}
					onTextSelect={(kind: any, el: any) => onTextSelect(kind as any, el)}
				/>
			{:else if previewTemplate === 'videoSplit'}
				<VideoSplitTemplate
					bind:exportRef
					videoSrc={canvasBackgroundVideo.trim()
						? canvasBackgroundVideo
						: VIDEO_SPLIT_DEFAULTS.videoUrl}
					autoflipComposited={!!videoSplitCompositedBySlide[paintSlide]}
					badgeLabel={VIDEO_SPLIT_DEFAULTS.badgeLabel}
					videoMuted={canvasVideoMuted}
					videoVolume={canvasVideoVolume}
					videoSeekSec={videoSeekSec}
					videoTrimStartSec={canvasVideoTrimStart}
					videoTrimEndSec={canvasVideoTrimEnd || canvasVideoDuration || 0}
					onVideoDuration={(d) => {
						const dur = Number(d);
						if (!Number.isFinite(dur) || dur <= 0) return;
						videoDurationBySlide = Array.from(
							{ length: slides.length },
							(_, i) =>
								i === paintSlide
									? dur
									: Number.isFinite(videoDurationBySlide[i])
										? Math.max(0, videoDurationBySlide[i])
										: 0,
						);
						const curEnd = videoTrimEndSecBySlide[paintSlide] ?? 0;
						if (!curEnd) {
							videoTrimEndSecBySlide = Array.from(
								{ length: slides.length },
								(_, i) =>
									i === paintSlide
										? dur
										: Number.isFinite(videoTrimEndSecBySlide[i])
											? Math.max(0, videoTrimEndSecBySlide[i])
											: 0,
							);
						}
					}}
					w={CANVAS_W}
					h={CANVAS_H}
					scale={previewScale}
					interactive={canvasInteractive}
				/>
				<StudioImageStickers
					w={CANVAS_W}
					h={CANVAS_H}
					scale={previewScale}
					interactive={canvasInteractive}
					overlays={canvasOverlays}
					resolveSrc={resolveMediaUrl}
					onOverlaysChange={(o) => {
						if (!canvasInteractive) return;
						setSlideOverlays(paintSlide, o, previewTemplate);
					}}
				/>
				<StudioTextOverlays
					w={CANVAS_W}
					h={CANVAS_H}
					scale={previewScale}
					interactive={canvasInteractive}
					highlightColor={highlightColor}
					textOverlays={canvasTextOverlays}
					snapToCanvasCenter={true}
					activeTextKind={selectedText}
					activeTextOverlayId={selectedTextOverlayId}
					onRangeSelect={onTextOverlayRangeSelect}
					onTextOverlaysChange={(o: any) => {
						if (!canvasInteractive) return;
						setSlideTextOverlays(paintSlide, o, previewTemplate);
					}}
					onTextSelect={(kind: any, el: any) => onTextSelect(kind as any, el)}
					parseHighlightMarkup={false}
				/>
			{:else if previewTemplate === 'brandStack'}
				<BrandStackTemplate
					bind:exportRef
					headline={videoStoryHeadlineBySlide[paintSlide] ?? BRAND_STACK_DEFAULTS.headline}
					watermark={videoStoryWatermarkBySlide[paintSlide] ?? BRAND_STACK_DEFAULTS.watermark}
					brand={brandStackBrandBySlide[paintSlide] ?? BRAND_STACK_DEFAULTS.brand}
					topVideoSrc={canvasBackgroundVideo}
					topImageSrc={canvasBackgroundImage}
					bottomMediaSrc={canvasBrandStackBottomMedia}
					videoMuted={canvasVideoMuted}
					videoVolume={canvasVideoVolume}
					videoSeekSec={videoSeekSec}
					videoTrimStartSec={canvasVideoTrimStart}
					videoTrimEndSec={canvasVideoTrimEnd || canvasVideoDuration || 0}
					onVideoDuration={(d) => {
						const dur = Number(d);
						if (!Number.isFinite(dur) || dur <= 0) return;
						videoDurationBySlide = Array.from(
							{ length: slides.length },
							(_, i) =>
								i === paintSlide ? dur : Number.isFinite(videoDurationBySlide[i]) ? Math.max(0, videoDurationBySlide[i]) : 0,
						);
						const curEnd = videoTrimEndSecBySlide[paintSlide] ?? 0;
						if (!curEnd) {
							videoTrimEndSecBySlide = Array.from(
								{ length: slides.length },
								(_, i) =>
									i === paintSlide
										? dur
										: Number.isFinite(videoTrimEndSecBySlide[i])
											? Math.max(0, videoTrimEndSecBySlide[i])
											: 0,
							);
						}
					}}
					w={CANVAS_W}
					h={CANVAS_H}
					scale={previewScale}
					interactive={canvasInteractive}
					headlineStyle={{ ...BRAND_STACK_HEADLINE_STYLE, ...canvasVideoStoryHeadlineStyle }}
					watermarkStyle={canvasVideoStoryWatermarkStyle}
					brandStyle={canvasBrandStackBrandStyle}
					selectedText={selectedText}
					textOffsets={offsetsForTemplate(paintSlide, previewTemplate)}
					onTextOffsetChange={(kind, next) => {
						if (!canvasInteractive) return;
						setTemplateOffset(paintSlide, previewTemplate, String(kind), next);
					}}
					onHeadlineChange={(v) => {
						if (!canvasInteractive) return;
						pushUndo(previewTemplate, paintSlide);
						videoStoryHeadlineBySlide = videoStoryHeadlineBySlide.map((x, i) => (i === paintSlide ? v : x));
					}}
					onWatermarkChange={(v) => {
						if (!canvasInteractive) return;
						pushUndo(previewTemplate, paintSlide);
						videoStoryWatermarkBySlide = videoStoryWatermarkBySlide.map((x, i) => (i === paintSlide ? v : x));
					}}
					onBrandChange={(v) => {
						if (!canvasInteractive) return;
						pushUndo(previewTemplate, paintSlide);
						brandStackBrandBySlide = brandStackBrandBySlide.map((x, i) => (i === paintSlide ? v : x));
					}}
					onTextSelect={onTextSelect}
					onHeadlineRangeSelect={onHeadlineRangeSelect}
					showToolbar={false}
				/>
				<StudioImageStickers
					w={CANVAS_W}
					h={CANVAS_H}
					scale={previewScale}
					interactive={canvasInteractive}
					overlays={canvasOverlays}
					resolveSrc={resolveMediaUrl}
					onOverlaysChange={(o) => {
						if (!canvasInteractive) return;
						setSlideOverlays(paintSlide, o, previewTemplate);
					}}
				/>
				<StudioTextOverlays
					w={CANVAS_W}
					h={CANVAS_H}
					scale={previewScale}
					interactive={canvasInteractive}
					highlightColor={highlightColor}
					textOverlays={canvasTextOverlays}
					snapToCanvasCenter={true}
					activeTextKind={selectedText}
					activeTextOverlayId={selectedTextOverlayId}
					onRangeSelect={onTextOverlayRangeSelect}
					onTextOverlaysChange={(o: any) => {
						if (!canvasInteractive) return;
						setSlideTextOverlays(paintSlide, o, previewTemplate);
					}}
					onTextSelect={(kind: any, el: any) => onTextSelect(kind as any, el)}
				/>
			{:else if isVideoStoryFamily(previewTemplate)}
				<VideoStoryTemplate
					bind:exportRef
					layout={videoLayoutForTemplate(previewTemplate)}
					headline={videoStoryHeadlineBySlide[paintSlide] ??
						(previewTemplate === 'videoFeature'
							? VIDEO_FEATURE_DEFAULTS.headline
							: previewTemplate === 'videoPost'
								? VIDEO_POST_DEFAULTS.headline
							: previewTemplate === 'videoSource'
								? VIDEO_SOURCE_DEFAULTS.headline
								: previewTemplate === 'videoText'
									? VIDEO_TEXT_DEFAULTS.headline
									: previewTemplate === 'videoCreator'
										? VIDEO_CREATOR_DEFAULTS.headline
										: previewTemplate === 'videoHook'
											? VIDEO_HOOK_DEFAULTS.headline
											: VIDEO_STORY_DEFAULTS.headline)}
					body={blackTextBodyBySlide[paintSlide] ?? VIDEO_FEATURE_DEFAULTS.body}
					watermark={videoStoryWatermarkBySlide[paintSlide] ??
						(previewTemplate === 'videoSource' ||
						previewTemplate === 'videoHook' ||
								  previewTemplate === 'videoCreator' ||
								  previewTemplate === 'videoPost' ||
								  previewTemplate === 'videoText' ||
								  previewTemplate === 'videoFeature'
								? ''
								: VIDEO_STORY_DEFAULTS.watermark)}
					profileName={textCarouselNameBySlide[paintSlide] ?? brandDisplayName}
					profileHandle={textCarouselHandleBySlide[paintSlide] ?? brandHandle}
					profileAvatar={textCarouselAvatarImageBySlide[paintSlide] ??
						(previewTemplate === 'videoPost' ? VIDEO_POST_DEFAULTS.avatarUrl : '')}
					profileAvatarMode={textCarouselAvatarModeBySlide[paintSlide] ?? 'text'}
					profileAvatarInnerBg={textCarouselAvatarInnerBgBySlide[paintSlide] ?? ''}
					profileAvatarRingColor={textCarouselAvatarRingColorBySlide[paintSlide] ?? defaultAvatarRingColor}
					profileAvatarRingWidth={textCarouselAvatarRingWidthBySlide[paintSlide] ?? defaultTextCarouselRingWidth}
					videoSrc={canvasBackgroundVideo}
					videoPoster={resolveVideoPoster(
						canvasBackgroundImage,
						canvasBackgroundVideo,
						previewTemplate,
					)}
					videoMuted={canvasVideoMuted}
					videoVolume={canvasVideoVolume}
					videoSeekSec={videoSeekSec}
					videoTrimStartSec={canvasVideoTrimStart}
					videoTrimEndSec={canvasVideoTrimEnd || canvasVideoDuration || 0}
					onVideoDuration={(d) => {
						const dur = Number(d);
						if (!Number.isFinite(dur) || dur <= 0) return;
						videoDurationBySlide = Array.from(
							{ length: slides.length },
							(_, i) =>
								i === paintSlide ? dur : Number.isFinite(videoDurationBySlide[i]) ? Math.max(0, videoDurationBySlide[i]) : 0,
						);
						const curEnd = videoTrimEndSecBySlide[paintSlide] ?? 0;
						if (!curEnd) {
							videoTrimEndSecBySlide = Array.from(
								{ length: slides.length },
								(_, i) =>
									i === paintSlide
										? dur
										: Number.isFinite(videoTrimEndSecBySlide[i])
											? Math.max(0, videoTrimEndSecBySlide[i])
											: 0,
							);
						}
					}}
					w={CANVAS_W}
					h={CANVAS_H}
					scale={previewScale}
					interactive={canvasInteractive}
					highlightColor={highlightColor}
					highlightDefaults={studioHighlightDefaults}
					headlineStyle={previewTemplate === 'videoFeature'
						? { ...VIDEO_FEATURE_HEADLINE_STYLE, ...canvasVideoStoryHeadlineStyle }
						: previewTemplate === 'videoPost'
							? { ...VIDEO_POST_HEADLINE_STYLE, ...canvasVideoStoryHeadlineStyle }
						: previewTemplate === 'videoSource'
							? {
									...VIDEO_SOURCE_HEADLINE_STYLE,
									...canvasVideoStoryHeadlineStyle,
									color:
										canvasVideoStoryHeadlineStyle.color ??
										(canvasBgDark ? '#ffffff' : '#0a0a0a'),
								}
							: previewTemplate === 'videoText'
								? { ...VIDEO_TEXT_HEADLINE_STYLE, ...canvasVideoStoryHeadlineStyle }
								: previewTemplate === 'videoCreator'
									? {
											...VIDEO_CREATOR_HEADLINE_STYLE,
											...canvasVideoStoryHeadlineStyle,
											color:
												canvasVideoStoryHeadlineStyle.color ??
												(canvasBgDark ? '#ffffff' : '#0a0a0a'),
										}
									: previewTemplate === 'videoHook'
										? {
												...VIDEO_HOOK_HEADLINE_STYLE,
												...canvasVideoStoryHeadlineStyle,
												color:
													canvasVideoStoryHeadlineStyle.color ??
													(canvasBgDark ? '#ffffff' : '#0a0a0a'),
											}
										: canvasVideoStoryHeadlineStyle}
					bodyStyle={previewTemplate === 'videoFeature'
						? { ...VIDEO_FEATURE_BODY_STYLE, ...canvasBlackTextBodyStyle }
						: canvasBlackTextBodyStyle}
					watermarkStyle={canvasVideoStoryWatermarkStyle}
					selectedText={selectedText}
					textOffsets={offsetsForTemplate(paintSlide, previewTemplate)}
					onTextOffsetChange={(kind, next) => {
						if (!canvasInteractive) return;
						setTemplateOffset(paintSlide, previewTemplate, String(kind), next);
					}}
					onHeadlineChange={(v) => {
						if (!canvasInteractive) return;
						pushUndo(previewTemplate, paintSlide);
						videoStoryHeadlineBySlide = videoStoryHeadlineBySlide.map((x, i) => (i === paintSlide ? v : x));
					}}
					onBodyChange={(v) => {
						if (!canvasInteractive) return;
						pushUndo(previewTemplate, paintSlide);
						blackTextBodyBySlide = blackTextBodyBySlide.map((x, i) => (i === paintSlide ? v : x));
					}}
					onWatermarkChange={(v) => {
						if (!canvasInteractive) return;
						pushUndo(previewTemplate, paintSlide);
						videoStoryWatermarkBySlide = videoStoryWatermarkBySlide.map((x, i) => (i === paintSlide ? v : x));
					}}
					onProfileNameChange={(v) => {
						if (!canvasInteractive) return;
						pushUndo(previewTemplate, paintSlide);
						textCarouselNameBySlide = textCarouselNameBySlide.map((x, i) => (i === paintSlide ? v : x));
					}}
					onProfileHandleChange={(v) => {
						if (!canvasInteractive) return;
						pushUndo(previewTemplate, paintSlide);
						textCarouselHandleBySlide = textCarouselHandleBySlide.map((x, i) => (i === paintSlide ? v : x));
					}}
					onTextSelect={onTextSelect}
					onHeadlineRangeSelect={onHeadlineRangeSelect}
					onBackgroundDblClick={(d) => {
						if (!canvasInteractive) return;
						openBgToolbarAt(d.clientX, d.clientY);
					}}
					filmStripTopPct={
						filmStripTopPctByTemplate[previewTemplate]?.[paintSlide] ??
						filmStripDefaultsFor(previewTemplate).topPct
					}
					filmStripBottomPct={
						filmStripBottomPctByTemplate[previewTemplate]?.[paintSlide] ??
						filmStripDefaultsFor(previewTemplate).bottomPct
					}
					showToolbar={false}
					bgColor={canvasSolidHex}
				/>
				<StudioImageStickers
					w={CANVAS_W}
					h={CANVAS_H}
					scale={previewScale}
					interactive={canvasInteractive}
					overlays={canvasOverlays}
					resolveSrc={resolveMediaUrl}
					onOverlaysChange={(o) => {
						if (!canvasInteractive) return;
						setSlideOverlays(paintSlide, o, previewTemplate);
					}}
				/>
				<StudioTextOverlays
					w={CANVAS_W}
					h={CANVAS_H}
					scale={previewScale}
					interactive={canvasInteractive}
					highlightColor={highlightColor}
					textOverlays={canvasTextOverlays}
					snapToCanvasCenter={true}
					activeTextKind={selectedText}
					activeTextOverlayId={selectedTextOverlayId}
					onRangeSelect={onTextOverlayRangeSelect}
					onTextOverlaysChange={(o: any) => {
						if (!canvasInteractive) return;
						setSlideTextOverlays(paintSlide, o, previewTemplate);
					}}
					onTextSelect={(kind: any, el: any) => onTextSelect(kind as any, el)}
					parseHighlightMarkup={true}
				/>
			{:else if isPhotoStoryFamily(previewTemplate)}
				<PhotoStoryTemplate
					bind:exportRef
					layout={previewTemplate === 'photoCaption' ? 'caption' : 'topic'}
					backgroundImage={canvasBackgroundImage.trim()
						? canvasBackgroundImage
						: previewTemplate === 'photoCaption'
							? PHOTO_CAPTION_DEFAULTS.imageUrl
							: PHOTO_TOPIC_DEFAULTS.imageUrl}
					headline={blackTextHeadlineBySlide[paintSlide] ??
						(previewTemplate === 'photoCaption'
							? PHOTO_CAPTION_DEFAULTS.headline
							: PHOTO_TOPIC_DEFAULTS.headline)}
					body={blackTextBodyBySlide[paintSlide] ??
						(previewTemplate === 'photoCaption'
							? PHOTO_CAPTION_DEFAULTS.body
							: PHOTO_TOPIC_DEFAULTS.body)}
					headlineColor={PHOTO_TOPIC_DEFAULTS.headlineColor}
					w={CANVAS_W}
					h={CANVAS_H}
					scale={previewScale}
					interactive={canvasInteractive}
					selectedText={selectedText}
					highlightColor={highlightColor}
					headlineStyle={previewTemplate === 'photoTopic'
						? { ...PHOTO_TOPIC_HEADLINE_STYLE, ...canvasBlackTextHeadlineStyle }
						: canvasBlackTextHeadlineStyle}
					bodyStyle={previewTemplate === 'photoTopic'
						? { ...PHOTO_TOPIC_BODY_STYLE, ...canvasBlackTextBodyStyle }
						: canvasBlackTextBodyStyle}
					textOffsets={offsetsForTemplate(paintSlide, previewTemplate)}
					onTextOffsetChange={(kind, next) => {
						if (!canvasInteractive) return;
						setTemplateOffset(paintSlide, previewTemplate, String(kind), next);
					}}
					onHeadlineChange={(v) => {
						if (!canvasInteractive) return;
						pushUndo(previewTemplate, paintSlide);
						blackTextHeadlineBySlide = blackTextHeadlineBySlide.map((x, i) => (i === paintSlide ? v : x));
					}}
					onBodyChange={(v) => {
						if (!canvasInteractive) return;
						pushUndo(previewTemplate, paintSlide);
						blackTextBodyBySlide = blackTextBodyBySlide.map((x, i) => (i === paintSlide ? v : x));
					}}
					onTextSelect={onTextSelect}
					onHeadlineRangeSelect={onHeadlineRangeSelect}
					showToolbar={false}
				/>
				<StudioImageStickers
					w={CANVAS_W}
					h={CANVAS_H}
					scale={previewScale}
					interactive={canvasInteractive}
					overlays={canvasOverlays}
					resolveSrc={resolveMediaUrl}
					onOverlaysChange={(o) => {
						if (!canvasInteractive) return;
						setSlideOverlays(paintSlide, o, previewTemplate);
					}}
				/>
				<StudioTextOverlays
					w={CANVAS_W}
					h={CANVAS_H}
					scale={previewScale}
					interactive={canvasInteractive}
					highlightColor={highlightColor}
					textOverlays={canvasTextOverlays}
					snapToCanvasCenter={true}
					activeTextKind={selectedText}
					activeTextOverlayId={selectedTextOverlayId}
					onRangeSelect={onTextOverlayRangeSelect}
					onTextOverlaysChange={(o: any) => {
						if (!canvasInteractive) return;
						setSlideTextOverlays(paintSlide, o, previewTemplate);
					}}
					onTextSelect={(kind: any, el: any) => onTextSelect(kind as any, el)}
				/>
			{:else if previewTemplate === 'blackText'}
				<BlackTextCarouselTemplate
					bind:exportRef
					backgroundImage={canvasBackgroundImage.trim() ? canvasBackgroundImage : BLACK_TEXT_BG_DEFAULT}
					name={textCarouselNameBySlide[paintSlide] ?? brandDisplayName}
					handle={textCarouselHandleBySlide[paintSlide] ?? brandHandle}
					avatar={textCarouselAvatarImageBySlide[paintSlide] ?? ''}
					avatarMode={textCarouselAvatarModeBySlide[paintSlide] ?? 'text'}
					avatarInnerBg={textCarouselAvatarInnerBgBySlide[paintSlide] ?? ''}
					avatarLabel={textCarouselAvatarLabelBySlide[paintSlide] ?? ''}
					headline={blackTextHeadlineBySlide[paintSlide] ?? BLACK_TEXT_CAROUSEL_DEFAULTS.headline}
					body={blackTextBodyBySlide[paintSlide] ?? BLACK_TEXT_CAROUSEL_DEFAULTS.body}
					headlineColor={BLACK_TEXT_CAROUSEL_DEFAULTS.headlineColor}
					highlightColor={highlightColor}
					highlightDefaults={studioHighlightDefaults}
					canvasW={CANVAS_W}
					canvasH={CANVAS_H}
					scale={previewScale}
					interactive={canvasInteractive}
					headlineStyle={canvasBlackTextHeadlineStyle}
					bodyStyle={canvasBlackTextBodyStyle}
					selectedText={selectedText}
					textOffsets={offsetsForTemplate(paintSlide, 'blackText')}
					onTextOffsetChange={(kind, next) => {
						if (!canvasInteractive) return;
						setTemplateOffset(paintSlide, 'blackText', String(kind), next);
					}}
					onHeadlineChange={(v) => {
						if (!canvasInteractive) return;
						pushUndo('blackText', paintSlide);
						blackTextHeadlineBySlide = blackTextHeadlineBySlide.map((x, i) => (i === paintSlide ? v : x));
					}}
					onBodyChange={(v) => {
						if (!canvasInteractive) return;
						pushUndo('blackText', paintSlide);
						blackTextBodyBySlide = blackTextBodyBySlide.map((x, i) => (i === paintSlide ? v : x));
					}}
					onTextSelect={onTextSelect}
					onHeadlineRangeSelect={onHeadlineRangeSelect}
					showToolbar={false}
				/>
				<StudioImageStickers
					w={CANVAS_W}
					h={CANVAS_H}
					scale={previewScale}
					interactive={canvasInteractive}
					overlays={canvasOverlays}
					resolveSrc={resolveMediaUrl}
					onOverlaysChange={(o) => {
						if (!canvasInteractive) return;
						setSlideOverlays(paintSlide, o, previewTemplate);
					}}
				/>
				<StudioTextOverlays
					w={CANVAS_W}
					h={CANVAS_H}
					scale={previewScale}
					interactive={canvasInteractive}
					highlightColor={highlightColor}
					textOverlays={canvasTextOverlays}
					snapToCanvasCenter={true}
					activeTextKind={selectedText}
					activeTextOverlayId={selectedTextOverlayId}
					onRangeSelect={onTextOverlayRangeSelect}
					onTextOverlaysChange={(o: any) => {
						if (!canvasInteractive) return;
						setSlideTextOverlays(paintSlide, o, previewTemplate);
					}}
					onTextSelect={(kind: any, el: any) => onTextSelect(kind as any, el)}
					parseHighlightMarkup={true}
				/>
			{:else if previewTemplate === 'imageQuote'}
				<ImageQuoteTemplate
					templateTheme={canvasTheme}
					bind:exportRef
					canvasW={CANVAS_W}
					canvasH={CANVAS_H}
					image={canvasBackgroundImage}
					text={imageQuoteTextBySlide[paintSlide] ?? ''}
					footerLeft={imageQuoteFooterLeftBySlide[paintSlide] ?? ''}
					footerRight={imageQuoteFooterRightBySlide[paintSlide] ?? ''}
					topRatio={IMAGE_QUOTE_DEFAULTS.topRatio}
					filmStripTopPct={filmStripTopPctByTemplate.imageQuote?.[paintSlide] ?? filmStripDefaultsFor('imageQuote').topPct}
					filmStripBottomPct={filmStripBottomPctByTemplate.imageQuote?.[paintSlide] ?? filmStripDefaultsFor('imageQuote').bottomPct}
					highlightColor={highlightColor}
					bgColor={canvasSolidHex}
					textColor={canvasBgDark ? '#ffffff' : '#0a0a0a'}
					scale={previewScale}
					interactive={canvasInteractive}
					headlineStyle={canvasHeadlineStyle}
					selectedText={selectedText}
					textOffsets={offsetsForTemplate(paintSlide, 'imageQuote')}
					onTextOffsetChange={(kind, next) => {
						if (!canvasInteractive) return;
						setTemplateOffset(paintSlide, 'imageQuote', String(kind), next);
					}}
					onTextChange={(t) => {
						if (!canvasInteractive) return;
						pushUndo('imageQuote', paintSlide);
						imageQuoteTextBySlide = imageQuoteTextBySlide.map((x, i) => (i === paintSlide ? t : x));
					}}
					onFooterLeftChange={(v) => {
						if (!canvasInteractive) return;
						pushUndo('imageQuote', paintSlide);
						imageQuoteFooterLeftBySlide = imageQuoteFooterLeftBySlide.map((x, i) => (i === paintSlide ? v : x));
					}}
					onFooterRightChange={(v) => {
						if (!canvasInteractive) return;
						pushUndo('imageQuote', paintSlide);
						imageQuoteFooterRightBySlide = imageQuoteFooterRightBySlide.map((x, i) => (i === paintSlide ? v : x));
					}}
					onTextSelect={onTextSelect}
					onHeadlineRangeSelect={onHeadlineRangeSelect}
					showToolbar={false}
				/>
				<StudioImageStickers
					w={CANVAS_W}
					h={CANVAS_H}
					scale={previewScale}
					interactive={canvasInteractive}
					overlays={canvasOverlays}
					resolveSrc={resolveMediaUrl}
					onOverlaysChange={(o) => {
						if (!canvasInteractive) return;
						setSlideOverlays(paintSlide, o, previewTemplate);
					}}
				/>
				<StudioTextOverlays
					w={CANVAS_W}
					h={CANVAS_H}
					scale={previewScale}
					interactive={canvasInteractive}
					highlightColor={highlightColor}
					textOverlays={canvasTextOverlays}
					snapToCanvasCenter={true}
					activeTextKind={selectedText}
					activeTextOverlayId={selectedTextOverlayId}
					onRangeSelect={onTextOverlayRangeSelect}
					onTextOverlaysChange={(o: any) => {
						if (!canvasInteractive) return;
						setSlideTextOverlays(paintSlide, o, previewTemplate);
					}}
					onTextSelect={(kind: any, el: any) => onTextSelect(kind as any, el)}
					parseHighlightMarkup={false}
				/>
			{/if}
			{#if studioClipCaptions?.enabled && studioCaptionPhrases.length && canvasBackgroundVideo}
				<div
					class="absolute left-0 top-0 z-[14] origin-top-left"
					style="width: {CANVAS_W}px; height: {CANVAS_H}px; transform: scale({previewScale}); pointer-events: none;"
				>
					<VideoCaptionOverlay
						phrase={studioCaptionPhrase}
						currentTime={studioCaptionTime}
						activeWordIndex={studioCaptionWordIndex}
						template={studioCaptionTemplate}
						enabled={true}
						position={studioClipCaptions.position}
						customColor={studioClipCaptions.customColor}
						customBgColor={studioClipCaptions.customBgColor}
						customFontSize={studioClipCaptions.fontSize}
						customHighlightColor={studioClipCaptions.customHighlightColor}
						animationOverride={studioClipCaptions.animationOverride}
						strokeEnabled={studioClipCaptions.strokeEnabled}
						draggable={canvasInteractive}
						customX={studioClipCaptions.customX}
						customY={studioClipCaptions.customY}
						oncustomposition={(x, y) => {
							if (!studioClipCaptions) return;
							studioClipCaptions = { ...studioClipCaptions, customX: x, customY: y };
							if (bulkCaptionsBySlide.length) {
								const next = [...bulkCaptionsBySlide];
								next[activeSlide] = studioClipCaptions;
								bulkCaptionsBySlide = next;
							}
						}}
					/>
				</div>
			{/if}
			{#if !usesStructuralFilmStrip(previewTemplate) && (paintFilmStrip.topPct > 0 || paintFilmStrip.bottomPct > 0)}
				<div
					class="pointer-events-none absolute left-0 top-0 z-[28] overflow-hidden rounded-2xl"
					style="width: {previewDisplayW}px; height: {previewDisplayH}px;"
					aria-hidden="true"
					data-studio-letterbox-overlay
				>
					{#if paintFilmStrip.topPct > 0}
						<div class="absolute left-0 right-0 top-0 bg-black" style="height: {paintFilmStrip.topPct}%"></div>
					{/if}
					{#if paintFilmStrip.bottomPct > 0}
						<div class="absolute bottom-0 left-0 right-0 bg-black" style="height: {paintFilmStrip.bottomPct}%"></div>
					{/if}
				</div>
			{/if}
				</div><!-- /.studio-canvas-live -->
				</div>
			</div>
		</div>
		</div>
		<!-- /Canvas scroll area -->


		</div>
		<!-- /Prompt bar + filmstrip wrapper -->

		<!-- Slide filmstrip: drag to reorder (show for single-slide decks so Hook + Add stay visible) -->
		{#if slides.length >= 1}
			{@const filmstripGenerateBusy =
				studioGenerating || fetchingNews || generatingVariants}
			{@const filmstripLoading =
				studioBooting ||
				filmstripInitialPassPending ||
				filmstripBulkCapturing ||
				exporting ||
				exportingAll}
			{@const orderIds = filmstripIds.length ? filmstripIds : slideIds}
			{@const idToIndex = new Map(slideIds.map((id, i) => [id, i]))}
			{@const dndItems = orderIds.map((id) => {
				const i = idToIndex.get(id) ?? 0;
				const t = coerceTemplateId(slideTemplates[i] ?? lastTemplateUsed);
				const thumbText = thumbTextForSlide(i);
				const blankTextOverlays = (slideTextOverlaysByTemplate.blank ?? [])[i] ?? [];
				const blankImageOverlays = (slideOverlaysByTemplate.blank ?? [])[i] ?? [];
				const hasBlankContent =
					t === 'blank' &&
					(!!thumbText ||
						!!String((bgImagesByTemplate.blank ?? [])[i] ?? '').trim() ||
						!!String((bgVideosByTemplate.blank ?? [])[i] ?? '').trim() ||
						blankTextOverlays.length > 0 ||
						blankImageOverlays.length > 0 ||
						!!String(newsSolidBgBySlide[i] ?? '').trim());
				const vidRaw = String((bgVideosByTemplate[t] ?? [])[i] ?? '').trim();
				const imgRaw = String((bgImagesByTemplate[t] ?? [])[i] ?? '').trim();
				const vid = resolveMediaUrl(vidRaw) || vidRaw;
				const img = resolveMediaUrl(imgRaw) || imgRaw;
				const poster = resolveVideoPoster(img, vid, t) || img || '';
				return {
					id,
					slideIndex: i,
					text: thumbText,
					img,
					vid,
					poster,
					music: slideMusic[i] ?? null,
					loading:
						!!((generatingImagesByTemplate[t] ?? [])[i]) ||
						!!(cuttingOut[i] ?? false),
					hasBlankContent,
				};
			})}
			<DragDropProvider
				modifiers={[RestrictToHorizontalAxis]}
				sensors={[
					PointerSensor.configure({
						activationConstraints: [new PointerActivationConstraints.Delay({ value: 180, tolerance: { x: 6, y: 6 } })],
					}),
				]}
				onDragStart={(e) => { filmstripDraggingId = String(e?.operation?.source?.id ?? ''); if (!filmstripDraggingId) filmstripDraggingId = null; }}
				onDragOver={filmstripOver}
				onDragEnd={endFilmstripDrag}
			>
				<div class="filmstrip-row relative z-20 mx-auto flex max-w-full items-end gap-2 px-1 pb-1">
				<div class="filmstrip-scroll no-scrollbar flex min-w-0 flex-1 items-end gap-2 overflow-x-auto">
				{#each dndItems as item, i (item.id)}
					{@const tplate = coerceTemplateId(slideTemplates[item.slideIndex] ?? lastTemplateUsed)}
					{@const isPlaceholder =
						tplate === 'blank' ? !item.hasBlankContent : !item.text}
					{@const hasMusic = !!item.music}
					{@const isVideo = !!item.vid || hasMusic}
					{@const thumbFontFamily =
						tplate === 'news'
							? `'Bebas Neue', ui-sans-serif, sans-serif`
							: FONT_UI_STACK}
					{@const thumbFontSize = tplate === 'news' ? '8px' : '7.5px'}
					{@const thumbImgOpacity = tplate === 'tweet' && item.img ? '0.92' : '0.78'}
					{@const rasterThumb = filmstripPreviewUrls[item.slideIndex] ?? ''}
					{@const showThumbSkeleton =
						!studioRevealReady ||
						filmstripLoading ||
						filmstripGenerateBusy ||
						item.loading ||
						(!isPlaceholder && !rasterThumb && filmstripPreviewInFlight)}
					{@const sortable = useSortable({
						id: item.id,
						get index() { return i; },
						transition: { duration: 300, easing: 'cubic-bezier(0.25, 1, 0.5, 1)', idle: true },
					})}
					<div
						{@attach sortable.ref}
						use:registerFilmstripSortable={sortable}
						class="filmstrip-cell relative flex-shrink-0 flex flex-col items-center gap-1 group"
						style="
							opacity: {sortable.isDragging.current ? 0.65 : 1};
							z-index: {sortable.isDragging.current ? 5 : 1};
						"
					>
						<button
							type="button"
							{@attach sortable.handleRef}
							onclick={() => selectContentSlide(item.slideIndex)}
							class="filmstrip-thumb w-16 h-20 rounded-lg overflow-hidden border-2 transition-colors relative
								{showThumbSkeleton
									? 'border-transparent cursor-default'
									: `cursor-grab active:cursor-grabbing ${!editingBrandCta && activeSlide === item.slideIndex ? 'border-white/70 shadow-[0_0_0_1px_rgba(255,255,255,0.15)]' : (isPlaceholder ? 'border-white/[0.08] border-dashed' : 'border-white/[0.06] group-hover:border-white/25')}`}"
							aria-label={`Focus slide ${i + 1}`}
							style="touch-action: none; background: var(--app-surface-3);"
							disabled={showThumbSkeleton}
						>
								{#if showThumbSkeleton}
									<div class="filmstrip-skel absolute inset-0" aria-hidden="true"></div>
								{:else if rasterThumb}
									<img
										src={rasterThumb}
										alt=""
										class="w-full h-full object-cover"
										draggable="false"
									/>
								{:else if isPlaceholder}
									<div class="absolute inset-0 flex items-center justify-center text-white/15">
										<span class="text-[10px] font-mono">#{i + 1}</span>
									</div>
								{:else if item.poster}
									<img
										src={item.poster}
										alt=""
										class="w-full h-full object-cover"
										draggable="false"
									/>
								{:else if item.img}
									<img
										src={item.img}
										alt=""
										class="w-full h-full object-cover"
										style="opacity: {thumbImgOpacity};"
										draggable="false"
									/>
								{:else if item.vid}
									<!-- Still frame only — never autoplay demo clips in the filmstrip. -->
									<video
										src={item.vid}
										class="absolute inset-0 h-full w-full object-cover pointer-events-none"
										muted
										playsinline
										preload="metadata"
										disablepictureinpicture
										aria-hidden="true"
										onloadeddata={(e) => {
											const el = e.currentTarget as HTMLVideoElement;
											try {
												el.pause();
												el.currentTime = 0.05;
											} catch {
												/* ignore */
											}
										}}
									></video>
								{:else}
									<div
										class="absolute inset-0"
										style="background: linear-gradient(135deg,
											color-mix(in oklab, var(--app-text) 6%, transparent),
											color-mix(in oklab, var(--color-violet) 12%, transparent)
										);"
									></div>
								{/if}

								{#if !showThumbSkeleton && !isPlaceholder && !rasterThumb && !item.vid && !item.poster}
									<div
										class="absolute inset-0 flex items-end p-1.5 bg-gradient-to-t to-transparent {tplate === 'tweet' && item.img
											? 'from-black/55 via-black/20'
											: 'from-black/75'}"
									>
										<p
											class="text-white leading-snug line-clamp-3 [overflow-wrap:anywhere] drop-shadow-[0_1px_2px_rgba(0,0,0,0.85)]"
											style="font-family: {thumbFontFamily}; font-size: {thumbFontSize}; font-weight: {tplate === 'news' ? 700 : 600};"
										>
											{item.text.replace(/\[\[|\]\]/g, '')}
										</p>
									</div>
								{/if}

								{#if isVideo && !showThumbSkeleton}
									<div
										class="absolute top-0.5 left-0.5 flex items-center gap-0.5 px-1 py-0.5 rounded-md bg-black/70 backdrop-blur-sm border border-cyan-400/30"
										title={hasMusic ? `Video · ${item.music?.name}` : 'Video'}
									>
										<Play size={7} class="text-cyan-400" fill="currentColor" />
										{#if hasMusic}
											<Music size={7} class="text-cyan-400" />
										{/if}
									</div>
								{/if}
								{#if !showThumbSkeleton}
									<div
										class="pointer-events-none absolute inset-x-0 top-0 h-7 bg-gradient-to-b from-black/45 to-transparent"
										aria-hidden="true"
									></div>
								{/if}
						</button>

							{#if !showThumbSkeleton && slides.length > 1}
								<button
									type="button"
									data-filmstrip-delete
									onclick={(e) => {
										e.stopPropagation();
										e.preventDefault();
										musicPickerForSlide = null;
										deleteSlideAt(item.slideIndex);
									}}
									title="Delete slide"
									aria-label={`Delete slide ${i + 1}`}
									class="filmstrip-corner-btn filmstrip-delete-btn absolute top-1 right-1 z-20 flex h-5 w-5 items-center justify-center rounded-full"
									style="background:#ffffff;color:#dc2626;border:1px solid rgba(220,38,38,0.35);box-shadow:0 1px 4px rgba(0,0,0,0.28);"
								>
									<Trash2 size={10} strokeWidth={2.4} />
								</button>
							{/if}
						<span class="filmstrip-label flex items-center justify-center gap-1 font-mono text-[9px] {!showThumbSkeleton && !editingBrandCta && activeSlide === item.slideIndex ? 'is-active' : ''}">
							{#if showThumbSkeleton}
								<span class="filmstrip-label-skel" aria-hidden="true"></span>
							{:else}
								{i === 0 ? 'Hook' : `Slide ${i + 1}`}
								{#if isVideo}
									<Play size={7} class="text-cyan-400/60" fill="currentColor" />
								{/if}
							{/if}
						</span>
					</div>
				{/each}
				</div>

				<!-- Add slide — duplicates the focused slide -->
				<div class="filmstrip-cell relative flex-shrink-0 flex flex-col items-center gap-1">
					<button
						type="button"
						onclick={() => {
							musicPickerForSlide = null;
							duplicateActiveSlide();
						}}
						class="filmstrip-thumb w-16 h-20 rounded-lg border-2 border-dashed transition-colors flex flex-col items-center justify-center gap-0.5
							border-white/[0.10] hover:border-violet-500/50 bg-white/[0.02] hover:bg-white/[0.04] text-white/35 hover:text-white"
						aria-label="Duplicate slide"
						title="Duplicate current slide"
					>
						{#if filmstripLoading}
							<div class="filmstrip-skel absolute inset-0 rounded-[6px]" aria-hidden="true"></div>
						{:else}
							<span class="text-2xl leading-none">+</span>
						{/if}
					</button>
					<span class="filmstrip-label text-[9px] font-mono text-transparent select-none" aria-hidden="true">
						{#if filmstripLoading}
							<span class="filmstrip-label-skel"></span>
						{:else}
							Add
						{/if}
					</span>
				</div>
				</div>

				<!-- Drag overlay: makes the dragged item feel smooth & "attached" -->
				<DragOverlay>
					{#if filmstripDraggingId}
						{@const di = dndItems.find((x) => x.id === filmstripDraggingId)}
						{#if di}
							{@const tDrag = slideTemplates[di.slideIndex] ?? 'news'}
							{@const dragFont =
								tDrag === 'news'
									? `'Bebas Neue', ui-sans-serif, sans-serif`
									: FONT_UI_STACK}
							{@const dragFs = tDrag === 'news' ? '8px' : '7.5px'}
							{@const dragImgOp = tDrag === 'tweet' && di.img ? '0.92' : '0.78'}
							{@const dragRaster = filmstripPreviewUrls[di.slideIndex] ?? ''}
							<div class="flex flex-col items-center gap-1">
								<div class="relative">
									<div
										class="w-16 h-20 rounded-lg overflow-hidden border-2 border-white/15 bg-[#111] relative"
										style="box-shadow: 0 20px 60px rgba(0,0,0,0.55);"
									>
										{#if di.loading}
											<div class="absolute inset-0 flex items-center justify-center bg-[#111]">
												<Loader size={12} class="animate-spin text-white/40" />
											</div>
										{:else if tDrag === 'blank' ? !di.hasBlankContent : !di.text}
											<div class="absolute inset-0 flex items-center justify-center text-white/15">
												<span class="text-[10px] font-mono">…</span>
											</div>
										{:else if di.vid}
											<video
												src={di.vid}
												class="absolute inset-0 h-full w-full object-cover pointer-events-none"
												autoplay
												muted
												loop
												playsinline
												aria-hidden="true"
											></video>
										{:else if dragRaster}
											<img src={dragRaster} alt="" class="w-full h-full object-cover" draggable="false" />
										{:else if filmstripPreviewInFlight}
											<div class="absolute inset-0 flex items-center justify-center bg-[#111]">
												<Loader size={12} class="animate-spin text-violet-400 opacity-50" />
											</div>
										{:else if di.img}
											<img
												src={di.img}
												alt=""
												class="w-full h-full object-cover"
												style="opacity: {dragImgOp};"
												draggable="false"
											/>
										{/if}

										{#if di.text && !dragRaster}
											<div
												class="absolute inset-0 flex items-end p-1.5 bg-gradient-to-t to-transparent {tDrag === 'tweet' && di.img
													? 'from-black/55 via-black/20'
													: 'from-black/75'}"
											>
												<p
													class="text-white leading-snug line-clamp-3 [overflow-wrap:anywhere] drop-shadow-[0_1px_2px_rgba(0,0,0,0.85)]"
													style="font-family: {dragFont}; font-size: {dragFs}; font-weight: {tDrag === 'news' ? 700 : 600};"
												>
													{di.text.replace(/\[\[|\]\]/g, '')}
												</p>
											</div>
										{/if}
									</div>
								</div>
							</div>
						{/if}
					{/if}
				</DragOverlay>

				<!-- ── Video trimmer (YouTube-style bottom timeline) ───────────── -->
				{#if effectiveBackgroundVideo && showVideoTrim}
					<!-- Click-off backdrop: scoped to studio column so sidebar Settings stays clickable -->
					<div
						class="absolute inset-0 z-[45]"
						onpointerdown={() => { showVideoTrim = false; videoSeekSec = NaN; }}
						aria-hidden="true"
					></div>

					<div
						class="mt-3 w-full relative z-50 pointer-events-auto"
						onpointerdown={(e) => e.stopPropagation()}
					>
						<div class="rounded-2xl bg-white/[0.03] border border-white/[0.08] px-3 py-2.5">
							<div class="flex items-center justify-between gap-2 mb-2">
								<div class="flex items-center gap-2">
									<Scissors size={14} class="text-cyan-300" />
									<span class="text-[10px] font-mono text-white/35 uppercase tracking-wider">Trim clip</span>
									{#if activeVideoDurationSec > 0}
										<span class="text-[10px] font-mono text-white/25">
											{fmtTime(activeVideoTrimStartSec)} – {fmtTime(activeVideoTrimEndSec || activeVideoDurationSec)}
										</span>
									{/if}
								</div>
								<button
									type="button"
									onclick={() => { showVideoTrim = false; videoSeekSec = NaN; }}
									class="w-7 h-7 rounded-xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.06] text-white/50 hover:text-white flex items-center justify-center transition-colors"
									title="Close"
								>✕</button>
							</div>

							{#if activeVideoDurationSec > 0}
								<!-- Selected region track -->
								{@const endVal = activeVideoTrimEndSec || activeVideoDurationSec}
								{@const startPct = Math.max(0, Math.min(100, (activeVideoTrimStartSec / activeVideoDurationSec) * 100))}
								{@const endPct = Math.max(0, Math.min(100, (endVal / activeVideoDurationSec) * 100))}
								<div class="relative h-10">
									<div class="absolute inset-x-0 top-1/2 -translate-y-1/2 h-2 rounded-full bg-black/35 border border-white/10"></div>
									<div
										class="absolute top-1/2 -translate-y-1/2 h-2 rounded-full bg-cyan-400/35 border border-cyan-400/30"
										style="left:{startPct}%; width:{Math.max(0, endPct - startPct)}%;"
										onpointerdown={(e) => {
											const el = e.currentTarget as HTMLElement;
											const r = el.parentElement?.getBoundingClientRect();
											if (!r) return;
											const start = activeVideoTrimStartSec;
											const end = endVal;
											trimDrag = { start, end, startX: e.clientX, w: Math.max(1, r.width) };
											el.setPointerCapture(e.pointerId);
											e.preventDefault();
											e.stopPropagation();
										}}
										onpointermove={(e) => {
											if (!trimDrag) return;
											const dx = e.clientX - trimDrag.startX;
											const dur = Math.max(0, activeVideoDurationSec || 0);
											if (!dur) return;
											const deltaSec = (dx / trimDrag.w) * dur;
											setActiveTrimWindow(trimDrag.start + deltaSec, trimDrag.end + deltaSec);
											// keep preview synced to the new start while dragging
											videoSeekSec = trimDrag.start + deltaSec;
											e.preventDefault();
										}}
										onpointerup={(e) => {
											if (!trimDrag) return;
											trimDrag = null;
											(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
										}}
										onpointercancel={() => { trimDrag = null; }}
									></div>

									<!-- Start handle -->
									<div
										class="absolute top-1/2 -translate-y-1/2 w-3 h-6 rounded-md bg-white/80 border border-white/20 shadow"
										style="left: calc({startPct}% - 6px);"
									></div>
									<!-- End handle -->
									<div
										class="absolute top-1/2 -translate-y-1/2 w-3 h-6 rounded-md bg-white/80 border border-white/20 shadow"
										style="left: calc({endPct}% - 6px);"
									></div>

									<!-- Timecode labels near handles -->
									<div
										class="absolute -top-1 translate-y-[-100%] px-2 py-0.5 rounded-md bg-black/70 border border-white/10 text-[10px] font-mono text-white/80"
										style="left: calc({startPct}% - 16px);"
									>
										{fmtTime(activeVideoTrimStartSec)}
									</div>
									<div
										class="absolute -top-1 translate-y-[-100%] px-2 py-0.5 rounded-md bg-black/70 border border-white/10 text-[10px] font-mono text-white/80"
										style="left: calc({endPct}% - 16px);"
									>
										{fmtTime(endVal)}
									</div>

									<!-- Two hidden range inputs drive the handles -->
									<input
										class="video-range video-range-start"
										type="range"
										min="0"
										max={Math.max(0, activeVideoDurationSec - 0.05)}
										step="0.05"
										value={activeVideoTrimStartSec}
										oninput={(e) => {
											const v = Number((e.target as HTMLInputElement).value);
											videoTrimStartSecBySlide = Array.from(
												{ length: slides.length },
												(_, i) => (i === activeSlide ? v : (Number.isFinite(videoTrimStartSecBySlide[i]) ? Math.max(0, videoTrimStartSecBySlide[i]) : 0))
											);
											const end = videoTrimEndSecBySlide[activeSlide] ?? 0;
											if (end && end < v + 0.05) {
												videoTrimEndSecBySlide = Array.from(
													{ length: slides.length },
													(_, i) => (i === activeSlide ? Math.min(activeVideoDurationSec, v + 0.5) : (Number.isFinite(videoTrimEndSecBySlide[i]) ? Math.max(0, videoTrimEndSecBySlide[i]) : 0))
												);
											}
											videoSeekSec = v;
										}}
										aria-label="Trim start"
									/>
									<input
										class="video-range video-range-end"
										type="range"
										min="0"
										max={activeVideoDurationSec}
										step="0.05"
										value={endVal}
										oninput={(e) => {
											const v = Number((e.target as HTMLInputElement).value);
											const start = videoTrimStartSecBySlide[activeSlide] ?? 0;
											const next = Math.max(start + 0.05, v);
											videoTrimEndSecBySlide = Array.from(
												{ length: slides.length },
												(_, i) => (i === activeSlide ? Math.min(activeVideoDurationSec, next) : (Number.isFinite(videoTrimEndSecBySlide[i]) ? Math.max(0, videoTrimEndSecBySlide[i]) : 0))
											);
											videoSeekSec = Math.min(activeVideoDurationSec, next);
										}}
										aria-label="Trim end"
									/>
								</div>

								<!-- Ruler -->
								{@const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => t * activeVideoDurationSec)}
								<div class="mt-1 flex items-center justify-between text-[10px] font-mono text-white/25">
									{#each ticks as t (t)}
										<span>{fmtTime(t)}</span>
									{/each}
								</div>

								<!-- Scrub bar -->
								<div class="flex items-center gap-2 mt-2">
									<span class="text-[10px] font-mono text-white/35 w-10">Scrub</span>
									<input
										type="range"
										min={activeVideoTrimStartSec}
										max={endVal}
										step="0.05"
										value={Number.isFinite(videoSeekSec) ? videoSeekSec : activeVideoTrimStartSec}
										oninput={(e) => { videoSeekSec = Number((e.target as HTMLInputElement).value); }}
										class="flex-1 h-1 rounded-full accent-violet-400 cursor-pointer"
										aria-label="Scrub preview"
									/>
									<span class="text-[10px] font-mono text-white/35 w-12 text-right">
										{(Number.isFinite(videoSeekSec) ? videoSeekSec : activeVideoTrimStartSec).toFixed(2)}s
									</span>
								</div>

								<!-- Volume -->
								<div class="flex items-center gap-2 mt-2">
									<span class="text-[10px] font-mono text-white/35 w-10">Vol</span>
									<button
										type="button"
										onclick={() => {
											videoMutedBySlide = Array.from(
												{ length: slides.length },
												(_, i) => (i === activeSlide ? !activeVideoMuted : (videoMutedBySlide[i] ?? true))
											);
											if (activeVideoMuted) {
												const cur = videoVolumeBySlide[activeSlide];
												const vol = Number.isFinite(cur) ? cur : 0.8;
												videoVolumeBySlide = Array.from(
													{ length: slides.length },
													(_, i) => {
														if (i === activeSlide) return Math.max(0, Math.min(1, vol));
														const v = videoVolumeBySlide[i];
														return Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0.8;
													}
												);
											}
										}}
										class="w-7 h-7 rounded-xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.06] text-white/60 hover:text-white flex items-center justify-center transition-colors"
										title={activeVideoMuted ? 'Unmute' : 'Mute'}
									>
										{#if activeVideoMuted}
											<VolumeX size={14} />
										{:else}
											<Volume2 size={14} />
										{/if}
									</button>
									<input
										type="range"
										min="0"
										max="1"
										step="0.01"
										value={activeVideoVolume}
										disabled={activeVideoMuted}
										oninput={(e) => {
											const v = Number((e.target as HTMLInputElement).value);
											videoVolumeBySlide = Array.from(
												{ length: slides.length },
												(_, i) => (i === activeSlide ? Math.max(0, Math.min(1, v)) : (Number.isFinite(videoVolumeBySlide[i]) ? Math.max(0, Math.min(1, videoVolumeBySlide[i])) : 0.8))
											);
										}}
										class="flex-1 h-1 rounded-full accent-cyan-400 cursor-pointer disabled:opacity-40"
										aria-label="Volume"
									/>
									<span class="text-[10px] font-mono text-white/35 w-12 text-right">{Math.round(activeVideoVolume * 100)}%</span>
								</div>
							{:else}
								<p class="text-[10px] font-body text-white/25">Loading video…</p>
							{/if}
						</div>
					</div>
				{/if}
			</DragDropProvider>
		{/if}

		<!-- Format dock — under filmstrip, above prompt bar -->
		<div class="studio-format-dock relative z-[35] flex w-full min-w-0 shrink-0 justify-center px-1 pt-1.5 pb-0.5 md:px-4">
			<FormatDockToolbar
				formats={FORMATS.map((f) => ({ id: f.id, label: f.label, title: `${f.w}×${f.h}` }))}
				selectedId={formatId}
				onSelect={(id) => (formatId = id as FormatId)}
			/>
		</div>

		<!-- ── Prompt bar ── below the filmstrip ───────────────────── -->
		<div class="studio-prompt-chrome relative z-[40] shrink-0 overflow-visible px-2 pt-1.5 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:px-4 md:pb-3">
			<div class="mx-auto w-full max-w-2xl overflow-visible">
				<div class="prompt-bar">

				<!-- Message input row -->
				<div class="prompt-bar-input">
					{#if userId}
						<Popover
							bind:open={promptHistoryOpen}
							onOpenChange={(o) => {
								if (o) refreshPromptHistory();
							}}
						>
							<PopoverTrigger
								class="prompt-bar-icon-btn"
								title="Prompt history"
								aria-label="Prompt history"
							>
								<History size={18} />
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
										Your Generate queries show up here. Titles only — no images yet.
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
					{#if newsContentMode === 'general'}
						<input
							bind:value={generalTopicPrompt}
							placeholder="Message…"
							onkeydown={(e) => { if (e.key === 'Enter') submitPromptIfReady(); }}
							class="prompt-bar-field"
						/>
					{:else if newsContentMode === 'news'}
						<input
							bind:value={search}
							placeholder="Search keyword…"
							onkeydown={(e) => { if (e.key === 'Enter') submitPromptIfReady(); }}
							class="prompt-bar-field"
						/>
					{:else if newsContentMode === 'fact'}
						<input
							bind:value={factTopicPrompt}
							placeholder="Specific angle or context…"
							onkeydown={(e) => { if (e.key === 'Enter') submitPromptIfReady(); }}
							class="prompt-bar-field"
						/>
					{:else if newsContentMode === 'quote'}
						<input
							bind:value={quoteTopicPrompt}
							placeholder="Topic for the quote (e.g. discipline, leadership)…"
							onkeydown={(e) => { if (e.key === 'Enter') submitPromptIfReady(); }}
							class="prompt-bar-field"
						/>
					{:else if newsContentMode === 'steps'}
						<input
							bind:value={stepsTopicPrompt}
							placeholder="e.g. 5 steps to get a better gut…"
							onkeydown={(e) => { if (e.key === 'Enter') submitPromptIfReady(); }}
							class="prompt-bar-field"
						/>
					{:else}
						<input
							bind:value={storyTopicPrompt}
							placeholder="Story direction or angle…"
							onkeydown={(e) => { if (e.key === 'Enter') submitPromptIfReady(); }}
							class="prompt-bar-field"
						/>
					{/if}
					{#if newsError}
						<div class="flex items-center gap-1 shrink-0 pt-1">
							<AlertCircle size={11} class="text-red-500 shrink-0" />
							<span class="text-[11px] font-body text-red-500 max-w-[180px] truncate">{newsError}</span>
						</div>
					{/if}
				</div>

				<!-- Controls row -->
				<div class="prompt-bar-tools">

					<!-- ── Type selector ──────────────────────────────── -->
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
							{:else if newsContentMode === 'steps'}
								<ListOrdered size={11} class="shrink-0" />
								Steps
							{:else}
								<Quote size={11} class="shrink-0" />
								Quote
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
							{#each ([
								{ id: 'general', icon: MessageSquare, label: 'General' },
								{ id: 'news',  icon: Newspaper, label: 'News' },
								{ id: 'fact',  icon: Sparkles,  label: 'Random fact' },
								{ id: 'story', icon: Type,      label: 'Random story' },
								{ id: 'quote', icon: Quote,     label: 'Quote' },
								{ id: 'steps', icon: ListOrdered, label: 'Steps' },
							] as const) as opt}
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

					<!-- ── Topic selector ─────────────────────────────── -->
					{#if newsContentMode !== 'general'}
					<Popover>
						<PopoverTrigger class="prompt-chip">
							{#if newsContentMode === 'news'}
								{categories.find((c) => c.id === category)?.label ?? 'Topic'}
							{:else if newsContentMode === 'story'}
								{storyThemes.find((t) => t.id === storyCategory)?.label ?? 'Theme'}
							{:else if newsContentMode === 'quote'}
								{factTopics.find((t) => t.id === quoteTopicCategory)?.label ?? 'Any'}
							{:else if newsContentMode === 'steps'}
								{stepsCount} steps
							{:else}
								{factTopics.find((t) => t.id === factTopicCategory)?.label ?? 'Any'}
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
								<p class="mb-2 px-1 text-[10px] font-semibold uppercase tracking-widest text-[#b0b0b0]">News Category</p>
								<div class="grid grid-cols-2 gap-1.5">
									{#each categories as cat}
										<button
											type="button"
											onclick={() => (category = cat.id)}
											class="rounded-xl px-3 py-2 text-[12px] font-medium text-left transition-colors duration-100
												{category === cat.id
													? 'bg-[#7bf1a8] text-[#080808] font-semibold shadow-[inset_0_0_0_1px_rgba(8,8,8,0.06)]'
													: 'bg-[#f5f5f5] text-[#555] hover:bg-[#ececec]'}"
										>
											{cat.label}
										</button>
									{/each}
								</div>
							{:else if newsContentMode === 'story'}
								<p class="mb-2 px-1 text-[10px] font-semibold uppercase tracking-widest text-[#b0b0b0]">Story Theme</p>
								<div class="grid grid-cols-2 gap-1.5">
									{#each storyThemes as th}
										<button
											type="button"
											onclick={() => (storyCategory = th.id)}
											class="rounded-xl px-3 py-2 text-[12px] font-medium text-left transition-colors duration-100
												{storyCategory === th.id
													? 'bg-[#7bf1a8] text-[#080808] font-semibold shadow-[inset_0_0_0_1px_rgba(8,8,8,0.06)]'
													: 'bg-[#f5f5f5] text-[#555] hover:bg-[#ececec]'}"
										>
											{th.label}
										</button>
									{/each}
								</div>
							{:else if newsContentMode === 'quote'}
								<p class="mb-2 px-1 text-[10px] font-semibold uppercase tracking-widest text-[#b0b0b0]">Quote Topic</p>
								<div class="grid grid-cols-2 gap-1.5">
									{#each factTopics as topic}
										<button
											type="button"
											onclick={() => (quoteTopicCategory = topic.id)}
											class="rounded-xl px-3 py-2 text-[12px] font-medium text-left transition-colors duration-100
												{quoteTopicCategory === topic.id
													? 'bg-[#7bf1a8] text-[#080808] font-semibold shadow-[inset_0_0_0_1px_rgba(8,8,8,0.06)]'
													: 'bg-[#f5f5f5] text-[#555] hover:bg-[#ececec]'}"
										>
											{topic.label}
										</button>
									{/each}
								</div>
							{:else if newsContentMode === 'steps'}
								<p class="mb-2 px-1 text-[10px] font-semibold uppercase tracking-widest text-[#b0b0b0]">Step count</p>
								<p class="mb-2 px-1 text-[10.5px] leading-snug text-[#888]">Deck becomes hook + steps + CTA (max 10 slides). Typing “5 steps…” in the prompt also sets this.</p>
								<div class="grid grid-cols-3 gap-1.5">
									{#each [3, 4, 5, 6, 7, 8] as n}
										<button
											type="button"
											onclick={() => (stepsCount = n)}
											class="rounded-xl px-3 py-2 text-[12px] font-medium text-center transition-colors duration-100
												{stepsCount === n
													? 'bg-[#7bf1a8] text-[#080808] font-semibold shadow-[inset_0_0_0_1px_rgba(8,8,8,0.06)]'
													: 'bg-[#f5f5f5] text-[#555] hover:bg-[#ececec]'}"
										>
											{n}
										</button>
									{/each}
								</div>
							{:else}
								<p class="mb-2 px-1 text-[10px] font-semibold uppercase tracking-widest text-[#b0b0b0]">Fact Topic</p>
								<div class="grid grid-cols-2 gap-1.5">
									{#each factTopics as topic}
										<button
											type="button"
											onclick={() => (factTopicCategory = topic.id)}
											class="rounded-xl px-3 py-2 text-[12px] font-medium text-left transition-colors duration-100
												{factTopicCategory === topic.id
													? 'bg-[#7bf1a8] text-[#080808] font-semibold shadow-[inset_0_0_0_1px_rgba(8,8,8,0.06)]'
													: 'bg-[#f5f5f5] text-[#555] hover:bg-[#ececec]'}"
										>
											{topic.label}
										</button>
									{/each}
								</div>
							{/if}
						</PopoverContent>
					</Popover>
					{/if}

					<!-- Image source — all News studio modes (News / fact / story / quote / steps) -->
					<Popover>
						<PopoverTrigger
							class="prompt-chip max-w-[11.5rem]"
							title="Where slide media comes from"
						>
							{#if newsImageSourceMode === 'assets'}
								{#if stockMediaKind === 'video'}
									<Play size={11} class="shrink-0" />
									<span class="truncate">Stock videos</span>
								{:else}
									<Wallpaper size={11} class="shrink-0" />
									<span class="truncate">Stock photos</span>
								{/if}
							{:else if newsImageSourceMode === 'pull'}
								<Image size={11} class="shrink-0" />
								<span class="truncate">Article photo</span>
							{:else}
								<Sparkles size={11} class="shrink-0" />
								<span class="truncate">AI images</span>
							{/if}
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
							<p class="mb-1.5 px-2 pt-1 text-[10px] font-semibold uppercase tracking-widest text-[#b0b0b0]">Media source</p>
							<button
								type="button"
								onclick={() => (newsImageSourceMode = 'assets')}
								class="flex w-full items-start gap-2.5 rounded-xl px-3 py-2.5 text-left transition-colors duration-100
									{newsImageSourceMode === 'assets'
										? 'bg-[#f0f0f0] text-[#111]'
										: 'text-[#555] hover:bg-[#f7f7f7]'}"
							>
								<Wallpaper size={13} class="mt-0.5 shrink-0" />
								<span class="min-w-0">
									<span class="block text-[12.5px] font-semibold">Stock</span>
									<span class="mt-0.5 block text-[10.5px] font-medium leading-snug text-[#888]">Free Pexels media that match your topic</span>
								</span>
								{#if newsImageSourceMode === 'assets'}
									<span class="ml-auto shrink-0 text-[#111]">✓</span>
								{/if}
							</button>
							{#if newsImageSourceMode === 'assets'}
								<div class="mx-1 mb-1.5 mt-0.5 grid grid-cols-2 gap-1.5 rounded-xl bg-[#f5f5f5] p-1.5">
									<button
										type="button"
										aria-pressed={stockMediaKind === 'photo'}
										onclick={() => (stockMediaKind = 'photo')}
										class="flex items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-[11px] font-semibold transition-all
											{stockMediaKind === 'photo'
												? 'bg-white text-[#111] shadow-sm ring-1 ring-black/10'
												: 'bg-transparent text-[#888] hover:text-[#333]'}"
									>
										<Image size={11} class="shrink-0" />
										Photo
									</button>
									<button
										type="button"
										aria-pressed={stockMediaKind === 'video'}
										onclick={() => (stockMediaKind = 'video')}
										class="flex items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-[11px] font-semibold transition-all
											{stockMediaKind === 'video'
												? 'bg-white text-[#111] shadow-sm ring-1 ring-black/10'
												: 'bg-transparent text-[#888] hover:text-[#333]'}"
									>
										<Play size={11} class="shrink-0" />
										Video
									</button>
								</div>
							{/if}
							<button
								type="button"
								onclick={() => (newsImageSourceMode = 'pull')}
								class="flex w-full items-start gap-2.5 rounded-xl px-3 py-2.5 text-left transition-colors duration-100
									{newsImageSourceMode === 'pull'
										? 'bg-[#f0f0f0] text-[#111]'
										: 'text-[#555] hover:bg-[#f7f7f7]'}"
							>
								<Image size={13} class="mt-0.5 shrink-0" />
								<span class="min-w-0">
									<span class="block text-[12.5px] font-semibold">Article photo</span>
									<span class="mt-0.5 block text-[10.5px] font-medium leading-snug text-[#888]">Use the story’s photo on the first slide</span>
								</span>
								{#if newsImageSourceMode === 'pull'}
									<span class="ml-auto shrink-0 text-[#111]">✓</span>
								{/if}
							</button>
							<button
								type="button"
								onclick={() => (newsImageSourceMode = 'ai')}
								class="flex w-full items-start gap-2.5 rounded-xl px-3 py-2.5 text-left transition-colors duration-100
									{newsImageSourceMode === 'ai'
										? 'bg-[#f0f0f0] text-[#111]'
										: 'text-[#555] hover:bg-[#f7f7f7]'}"
							>
								<Sparkles size={13} class="mt-0.5 shrink-0" />
								<span class="min-w-0">
									<span class="block text-[12.5px] font-semibold">AI images</span>
									<span class="mt-0.5 block text-[10.5px] font-medium leading-snug text-[#888]">Create a unique image for every slide</span>
								</span>
								{#if newsImageSourceMode === 'ai'}
									<span class="ml-auto shrink-0 text-[#111]">✓</span>
								{/if}
							</button>
						</PopoverContent>
					</Popover>

					<Popover>
						<PopoverTrigger class="prompt-chip" title="How long each slide’s overlay copy should be">
							<Type size={11} class="shrink-0" />
							<span class="truncate">{newsCopyLength === 'short' ? 'Short' : newsCopyLength === 'standard' ? 'Standard' : 'Default'}</span>
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
							<p class="mb-1.5 px-2 pt-1 text-[10px] font-semibold uppercase tracking-widest text-[#b0b0b0]">Word count</p>
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
									<span class="mt-0.5 block text-[10.5px] font-medium leading-snug text-[#888]">{studioDefaultWordBudgetLabel}</span>
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
									<span class="mt-0.5 block text-[10.5px] font-medium leading-snug text-[#888]">Up to 28 words</span>
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
									<span class="mt-0.5 block text-[10.5px] font-medium leading-snug text-[#888]">≤12-word hook + 1 short body sentence</span>
								</span>
								{#if newsCopyLength === 'short'}
									<span class="ml-auto shrink-0 text-[#111]">✓</span>
								{/if}
							</button>
						</PopoverContent>
					</Popover>

					<Popover>
						<PopoverTrigger class="prompt-chip max-w-[9.5rem]" title="Who this copy is written for">
							<Users size={11} class="shrink-0" />
							<span class="truncate">{studioAudienceChipLabel}</span>
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
							<p class="mb-1.5 px-2 pt-1 text-[10px] font-semibold uppercase tracking-widest text-[#b0b0b0]">Audience</p>
							{#each BULK_AUDIENCES as aud}
								<button
									type="button"
									onclick={() => (studioAudienceId = aud.id)}
									class="flex w-full items-start gap-2.5 rounded-xl px-3 py-2.5 text-left transition-colors duration-100
										{studioAudienceId === aud.id
											? 'bg-[#f0f0f0] text-[#111]'
											: 'text-[#555] hover:bg-[#f7f7f7]'}"
								>
									<span class="min-w-0 text-[12.5px] font-semibold">{aud.label}</span>
									{#if studioAudienceId === aud.id}
										<span class="ml-auto shrink-0 text-[#111]">✓</span>
									{/if}
								</button>
							{/each}
							{#if studioAudienceId === 'custom'}
								<div class="px-2 pb-1">
									<input
										bind:value={studioAudienceCustom}
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
							<span class="truncate">{studioStyleLabel}</span>
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
									onclick={() => (studioStyle = st.id)}
									class="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left transition-colors duration-100
										{studioStyle === st.id
											? 'bg-[#f0f0f0] text-[#111]'
											: 'text-[#555] hover:bg-[#f7f7f7]'}"
								>
									<span class="text-[12.5px] font-semibold">{st.label}</span>
									{#if studioStyle === st.id}
										<span class="ml-auto shrink-0 text-[#111]">✓</span>
									{/if}
								</button>
							{/each}
						</PopoverContent>
					</Popover>

					<Popover>
						<PopoverTrigger class="prompt-chip max-w-[8.5rem]" title="Emotional tone">
							<Heart size={11} class="shrink-0" />
							<span class="truncate">{studioEmotionLabel}</span>
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
							<p class="mb-1.5 px-2 pt-1 text-[10px] font-semibold uppercase tracking-widest text-[#b0b0b0]">Emotion</p>
							{#each BULK_EMOTIONS as em}
								<button
									type="button"
									onclick={() => (studioEmotion = em.id)}
									class="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left transition-colors duration-100
										{studioEmotion === em.id
											? 'bg-[#f0f0f0] text-[#111]'
											: 'text-[#555] hover:bg-[#f7f7f7]'}"
								>
									<span class="text-[12.5px] font-semibold">{em.label}</span>
									{#if studioEmotion === em.id}
										<span class="ml-auto shrink-0 text-[#111]">✓</span>
									{/if}
								</button>
							{/each}
						</PopoverContent>
					</Popover>

					<Popover>
						<PopoverTrigger class="prompt-chip" title="Slides in this deck">
							<Layers size={11} class="shrink-0" />
							<span class="truncate">{slideCount} slides</span>
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
							<p class="mb-2 px-1 text-[10px] font-semibold uppercase tracking-widest text-[#b0b0b0]">Slides / show</p>
							<div class="grid grid-cols-4 gap-1.5">
								{#each STUDIO_SLIDE_COUNT_OPTIONS as n}
									<button
										type="button"
										onclick={() => setDeckSlideCount(n)}
										class="rounded-xl px-3 py-2 text-[12px] font-medium text-center transition-colors duration-100
											{slideCount === n
												? 'bg-[#7bf1a8] text-[#080808] font-semibold shadow-[inset_0_0_0_1px_rgba(8,8,8,0.06)]'
												: 'bg-[#f5f5f5] text-[#555] hover:bg-[#ececec]'}"
									>
										{n}
									</button>
								{/each}
							</div>
						</PopoverContent>
					</Popover>

					<div class="flex-1"></div>

					<!-- Submit — disabled until the prompt has text -->
					<Button
						type="button"
						size="icon"
						onclick={() => submitPromptIfReady()}
						disabled={promptSubmitDisabled}
						title={usageBlocked
							? usageUpgradeMessage || 'Carousel limit reached — upgrade for more'
							: fetchingNews || studioGenerating
							? newsContentMode === 'news'
								? 'Fetching…'
								: 'Generating…'
							: !promptReadyToGenerate
								? 'Type a prompt to generate'
								: 'Load & Fill'}
						aria-disabled={promptSubmitDisabled}
						class="prompt-bar-submit size-8 shrink-0 rounded-full border-0 bg-[#7bf1a8] text-[#080808] hover:bg-[#8ff5b6] disabled:bg-black/20 disabled:text-white {usageBlocked ? 'opacity-50' : ''}"
					>
						{#if fetchingNews || studioGenerating}
							<Loader class="animate-spin" />
						{:else}
							<ArrowUp strokeWidth={2.5} />
						{/if}
					</Button>
				</div>
							</div>
				<!-- {#if articleUrl}
					<a
						href={articleUrl}
						target="_blank"
						rel="noopener noreferrer"
						class="mt-2 block text-center text-[11px] font-body text-[#c0c0c0] transition-colors hover:text-violet-400"
					>View source article ↗</a>
				{/if} -->
			</div>
			<!-- /Prompt bar (below filmstrip) -->
		</div>
	</div>

	<!-- ── Right rail: assets panel ─────────────────────────────────────────── -->
	{#if !assetsCollapsed}
		<button
			type="button"
			class="studio-assets-scrim"
			aria-label="Close assets"
			onclick={() => (assetsCollapsed = true)}
		></button>
	{/if}
	<div class="studio-right-rail flex min-h-0 shrink-0 flex-col" class:is-collapsed={assetsCollapsed}>
		<StudioAssetsSidebar
			{userId}
			seedQuery={assetsSidebarSeedQuery}
			seedNonce={assetsSidebarSeedNonce}
			seedPexelsKind={assetsSidebarSeedPexelsKind}
			bind:collapsed={assetsCollapsed}
			onUseAsBackground={(ref) => void applyAssetAsBackground(ref)}
			onUseAsBottomBackground={
				activeTemplate === 'brandStack'
					? (ref) => void applyAssetAsBottomBackground(ref)
					: undefined
			}
			onAddAsSticker={(ref) => void applyAssetAsSticker(ref)}
			onUseUnsplashBackground={(photo) => applyUnsplashAsBackground(photo)}
			onUsePexelsVideo={(video) => applyPexelsVideoAsBackground(video)}
		/>
	</div>

	<!-- Save / Post / Burn / Export — viewport-fixed bottom-right (portaled in component) -->
	<FloatingActions
		{...({
			slideLabels: slides.map((_, i) => `Slide ${i + 1}`),
			inline: false,
			rightOffsetPx: 16,
			bottomOffsetPx: 20,
			zIndex: 200,
			posting: exportingAll,
			exportingZip: exporting,
			onExportZip: () => void exportPng(),
			onBurnMusicClick: () => void navigateToBurnMusicPage(),
			onSaveTemplate: (name: string, opts?: { overwriteId?: string }) =>
				saveStudioTemplateNamed(name, opts),
			onListSavedTemplates: () => listSavedStudioTemplates(),
			defaultTemplateName: `Template · ${TEMPLATES.find((t) => t.id === activeTemplate)?.label ?? 'Studio'}`,
			onPost: async () => {
				const n = await exportAllSlidesToDraft();
				if (!n) {
					alert(
						'Could not export slides to PNG, so nothing was sent to the scheduler.\n\n' +
							(lastExportError || 'Wait for images/videos to finish loading and try again.'),
					);
					return;
				}
				await goto('/dashboard/post-scheduler?from=studio&exported=1');
			},
		} as any)}
	/>

	{#if leavePromptOpen}
		<StudioLeavePrompt
			open={leavePromptOpen}
			bind:name={leaveSaveName}
			busy={leaveSaveBusy}
			error={leaveSaveError}
			onStay={stayOnStudio}
			onDiscard={discardAndLeave}
			onSave={saveTemplateAndLeave}
		/>
	{/if}

</div>

{#if usageUpgradeOpen}
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		bind:this={usageUpgradeEl}
		class="fixed inset-0 z-[500] flex items-center justify-center p-4"
		onclick={closeUsageUpgrade}
		role="presentation"
	>
		<div class="absolute inset-0 bg-black/50"></div>
		<div
			role="dialog"
			aria-modal="true"
			aria-labelledby="usage-upgrade-title"
			class="relative w-full max-w-md rounded-lg border border-border bg-background p-6 shadow-lg"
			onclick={(e) => e.stopPropagation()}
		>
			<Button
				variant="ghost"
				size="icon-sm"
				class="absolute top-3 right-3 text-muted-foreground"
				onclick={closeUsageUpgrade}
				aria-label="Close"
			>
				<X size={16} />
			</Button>
			<div class="flex flex-col gap-1.5 pr-8">
				<h2 id="usage-upgrade-title" class="text-lg leading-none font-semibold tracking-tight">
					Carousel limit reached
				</h2>
				<p class="text-muted-foreground text-sm leading-relaxed">
					{usageUpgradeMessage}
				</p>
			</div>
			<div class="mt-6 flex justify-end gap-2">
				<Button variant="outline" onclick={closeUsageUpgrade}>Not now</Button>
				<Button
					onclick={() => {
						closeUsageUpgrade();
						void goto('/pricing');
					}}
				>
					View plans
				</Button>
			</div>
		</div>
	</div>
{/if}

<StudioAiPromptModal
	open={circleAIModalFor !== null}
	title="Circle AI"
	description="Describe a subject and vibe. Keep it short — no text in the image."
	bind:prompt={circleAIPrompt}
	placeholder="Describe an image and click generate…"
	busy={circleAIGenerating}
	canSubmit={!!circleAIPrompt.trim()}
	inputId="circle-ai-prompt-input"
	onClose={closeCircleAIModal}
	onSubmit={submitCircleAIModal}
/>

<StudioAiPromptModal
	open={bgAIModalOpen}
	title="AI background"
	description="Describe the scene, or leave empty to use the suggested prompt from this slide."
	bind:prompt={bgAIPrompt}
	placeholder={bgAIRecommended || 'Describe a background and click generate…'}
	recommended={bgAIRecommended}
	busy={bgAIGenerating}
	canSubmit={!!(bgAIPrompt.trim() || bgAIRecommended)}
	inputId="bg-ai-prompt-input"
	onClose={closeBgAIModal}
	onSubmit={() => void submitBgAIModal()}
/>

<!-- Double-click canvas/video or dock “BG tools” to open -->
<NewsBackgroundToolbar
	anchor={newsBgToolbarAnchor}
	showCutout={previewTemplate === 'news' &&
		!!String(canvasBackgroundImage ?? '').trim() &&
		!String(canvasBackgroundVideo ?? '').trim()}
	showDelete={!!String(canvasBackgroundImage ?? '').trim() ||
		!!String(canvasBackgroundVideo ?? '').trim()}
	onAi={openBgAIModal}
	aiDisabled={!!(generatingImagesByTemplate[previewTemplate] ?? [])[paintSlide]}
	onCutOut={() => void cutOutSubject(paintSlide)}
	onReplace={() => newsBgToolbarMediaInput?.click()}
	onDelete={() => {
		if (!canvasInteractive) return;
		pushUndo(previewTemplate, paintSlide);
		setSlideImage(paintSlide, '', previewTemplate);
	}}
	onApplySolid={
		previewTemplate === 'news' || previewTemplate === 'blank'
			? (hex) => {
					pushUndo(previewTemplate, paintSlide);
					applyTemplateSolidBg(hex, paintSlide, previewTemplate);
					closeNewsBgToolbar();
				}
			: undefined
	}
	solidPresets={NEWS_SOLID_PRESETS}
	onClose={closeNewsBgToolbar}
/>

<!-- Profile circle (Text Carousel, Creator hook, White posts, …) -->
<TextCarouselAvatarToolbar
	anchor={selectedText === 'textCarouselAvatar' ? toolbarAnchor : null}
	avatarSrc={textCarouselAvatarImageBySlide[paintSlide] ?? ''}
	mode={textCarouselAvatarModeBySlide[paintSlide] ?? 'text'}
	innerBg={textCarouselAvatarInnerBgBySlide[paintSlide] ?? ''}
	defaultInnerBg={textCarouselDefaultAvatarBg}
	ringColor={textCarouselAvatarRingColorBySlide[paintSlide] ?? defaultAvatarRingColor}
	ringWidth={textCarouselAvatarRingWidthBySlide[paintSlide] ?? defaultTextCarouselRingWidth}
	defaultRingColor={defaultAvatarRingColor}
	onModeChange={(next) => {
		if (!canvasInteractive) return;
		pushUndo(previewTemplate, paintSlide);
		textCarouselAvatarModeBySlide = textCarouselAvatarModeBySlide.map((x, i) =>
			i === paintSlide ? next : x,
		);
		requestAnimationFrame(() => {
			if (toolbarTarget) toolbarAnchor = toolbarTarget.getBoundingClientRect();
		});
	}}
	onImageFile={(dataUrl) => {
		if (!canvasInteractive) return;
		pushUndo(previewTemplate, paintSlide);
		textCarouselAvatarImageBySlide = textCarouselAvatarImageBySlide.map((x, i) =>
			i === paintSlide ? dataUrl : x,
		);
		textCarouselAvatarModeBySlide = textCarouselAvatarModeBySlide.map((x, i) =>
			i === paintSlide ? 'image' : x,
		);
		requestAnimationFrame(() => {
			if (toolbarTarget) toolbarAnchor = toolbarTarget.getBoundingClientRect();
		});
	}}
	onClearImage={() => {
		if (!canvasInteractive) return;
		pushUndo(previewTemplate, paintSlide);
		textCarouselAvatarImageBySlide = textCarouselAvatarImageBySlide.map((x, i) => (i === paintSlide ? '' : x));
		textCarouselAvatarModeBySlide = textCarouselAvatarModeBySlide.map((x, i) =>
			i === paintSlide ? 'text' : x,
		);
		requestAnimationFrame(() => {
			if (toolbarTarget) toolbarAnchor = toolbarTarget.getBoundingClientRect();
		});
	}}
	onInnerBg={(hex) => {
		if (!canvasInteractive) return;
		pushUndo(previewTemplate, paintSlide);
		textCarouselAvatarInnerBgBySlide = textCarouselAvatarInnerBgBySlide.map((x, i) => (i === paintSlide ? hex : x));
	}}
	onClearInnerBg={() => {
		if (!canvasInteractive) return;
		pushUndo(previewTemplate, paintSlide);
		textCarouselAvatarInnerBgBySlide = textCarouselAvatarInnerBgBySlide.map((x, i) => (i === paintSlide ? '' : x));
	}}
	onRingColor={(hex) => {
		if (!canvasInteractive) return;
		pushUndo(previewTemplate, paintSlide);
		textCarouselAvatarRingColorBySlide = textCarouselAvatarRingColorBySlide.map((x, i) => (i === paintSlide ? hex : x));
	}}
	onRingWidth={(px) => {
		if (!canvasInteractive) return;
		pushUndo(previewTemplate, paintSlide);
		textCarouselAvatarRingWidthBySlide = textCarouselAvatarRingWidthBySlide.map((x, i) => (i === paintSlide ? px : x));
	}}
	onClose={closeToolbar}
/>

<!-- Tweet profile circles (same chrome as text carousel) -->
<TextCarouselAvatarToolbar
	anchor={selectedText === 'tweetTopAvatar' ? toolbarAnchor : null}
	avatarSrc={tweetTopAvatarImageBySlide[paintSlide] ?? ''}
	mode={tweetTopAvatarModeBySlide[paintSlide] ?? 'text'}
	innerBg={tweetTopAvatarInnerBgBySlide[paintSlide] ?? ''}
	defaultInnerBg={textCarouselDefaultAvatarBg}
	ringColor={tweetTopAvatarRingColorBySlide[paintSlide] ?? defaultAvatarRingColor}
	ringWidth={tweetTopAvatarRingWidthBySlide[paintSlide] ?? defaultTweetAvatarRingWidth}
	defaultRingColor={defaultAvatarRingColor}
	onModeChange={(next) => {
		if (!canvasInteractive) return;
		pushUndo('tweet', paintSlide);
		tweetTopAvatarModeBySlide = tweetTopAvatarModeBySlide.map((x, i) =>
			i === paintSlide ? next : x,
		);
		requestAnimationFrame(() => {
			if (toolbarTarget) toolbarAnchor = toolbarTarget.getBoundingClientRect();
		});
	}}
	onImageFile={(dataUrl) => {
		if (!canvasInteractive) return;
		pushUndo('tweet', paintSlide);
		tweetTopAvatarImageBySlide = tweetTopAvatarImageBySlide.map((x, i) => (i === paintSlide ? dataUrl : x));
		tweetTopAvatarModeBySlide = tweetTopAvatarModeBySlide.map((x, i) =>
			i === paintSlide ? 'image' : x,
		);
		requestAnimationFrame(() => {
			if (toolbarTarget) toolbarAnchor = toolbarTarget.getBoundingClientRect();
		});
	}}
	onClearImage={() => {
		if (!canvasInteractive) return;
		pushUndo('tweet', paintSlide);
		tweetTopAvatarImageBySlide = tweetTopAvatarImageBySlide.map((x, i) => (i === paintSlide ? '' : x));
		tweetTopAvatarModeBySlide = tweetTopAvatarModeBySlide.map((x, i) =>
			i === paintSlide ? 'text' : x,
		);
		requestAnimationFrame(() => {
			if (toolbarTarget) toolbarAnchor = toolbarTarget.getBoundingClientRect();
		});
	}}
	onInnerBg={(hex) => {
		if (!canvasInteractive) return;
		pushUndo('tweet', paintSlide);
		tweetTopAvatarInnerBgBySlide = tweetTopAvatarInnerBgBySlide.map((x, i) => (i === paintSlide ? hex : x));
	}}
	onClearInnerBg={() => {
		if (!canvasInteractive) return;
		pushUndo('tweet', paintSlide);
		tweetTopAvatarInnerBgBySlide = tweetTopAvatarInnerBgBySlide.map((x, i) => (i === paintSlide ? '' : x));
	}}
	onRingColor={(hex) => {
		if (!canvasInteractive) return;
		pushUndo('tweet', paintSlide);
		tweetTopAvatarRingColorBySlide = tweetTopAvatarRingColorBySlide.map((x, i) => (i === paintSlide ? hex : x));
	}}
	onRingWidth={(px) => {
		if (!canvasInteractive) return;
		pushUndo('tweet', paintSlide);
		tweetTopAvatarRingWidthBySlide = tweetTopAvatarRingWidthBySlide.map((x, i) => (i === paintSlide ? px : x));
	}}
	onClose={closeToolbar}
/>
<TextCarouselAvatarToolbar
	anchor={selectedText === 'tweetBottomAvatar' ? toolbarAnchor : null}
	avatarSrc={tweetBottomAvatarImageBySlide[paintSlide] ?? ''}
	mode={tweetBottomAvatarModeBySlide[paintSlide] ?? 'text'}
	innerBg={tweetBottomAvatarInnerBgBySlide[paintSlide] ?? ''}
	defaultInnerBg={textCarouselDefaultAvatarBg}
	ringColor={tweetBottomAvatarRingColorBySlide[paintSlide] ?? defaultAvatarRingColor}
	ringWidth={tweetBottomAvatarRingWidthBySlide[paintSlide] ?? defaultTweetAvatarRingWidth}
	defaultRingColor={defaultAvatarRingColor}
	onModeChange={(next) => {
		if (!canvasInteractive) return;
		pushUndo('tweet', paintSlide);
		tweetBottomAvatarModeBySlide = tweetBottomAvatarModeBySlide.map((x, i) =>
			i === paintSlide ? next : x,
		);
		requestAnimationFrame(() => {
			if (toolbarTarget) toolbarAnchor = toolbarTarget.getBoundingClientRect();
		});
	}}
	onImageFile={(dataUrl) => {
		if (!canvasInteractive) return;
		pushUndo('tweet', paintSlide);
		tweetBottomAvatarImageBySlide = tweetBottomAvatarImageBySlide.map((x, i) => (i === paintSlide ? dataUrl : x));
		tweetBottomAvatarModeBySlide = tweetBottomAvatarModeBySlide.map((x, i) =>
			i === paintSlide ? 'image' : x,
		);
		requestAnimationFrame(() => {
			if (toolbarTarget) toolbarAnchor = toolbarTarget.getBoundingClientRect();
		});
	}}
	onClearImage={() => {
		if (!canvasInteractive) return;
		pushUndo('tweet', paintSlide);
		tweetBottomAvatarImageBySlide = tweetBottomAvatarImageBySlide.map((x, i) => (i === paintSlide ? '' : x));
		tweetBottomAvatarModeBySlide = tweetBottomAvatarModeBySlide.map((x, i) =>
			i === paintSlide ? 'text' : x,
		);
		requestAnimationFrame(() => {
			if (toolbarTarget) toolbarAnchor = toolbarTarget.getBoundingClientRect();
		});
	}}
	onInnerBg={(hex) => {
		if (!canvasInteractive) return;
		pushUndo('tweet', paintSlide);
		tweetBottomAvatarInnerBgBySlide = tweetBottomAvatarInnerBgBySlide.map((x, i) => (i === paintSlide ? hex : x));
	}}
	onClearInnerBg={() => {
		if (!canvasInteractive) return;
		pushUndo('tweet', paintSlide);
		tweetBottomAvatarInnerBgBySlide = tweetBottomAvatarInnerBgBySlide.map((x, i) => (i === paintSlide ? '' : x));
	}}
	onRingColor={(hex) => {
		if (!canvasInteractive) return;
		pushUndo('tweet', paintSlide);
		tweetBottomAvatarRingColorBySlide = tweetBottomAvatarRingColorBySlide.map((x, i) => (i === paintSlide ? hex : x));
	}}
	onRingWidth={(px) => {
		if (!canvasInteractive) return;
		pushUndo('tweet', paintSlide);
		tweetBottomAvatarRingWidthBySlide = tweetBottomAvatarRingWidthBySlide.map((x, i) => (i === paintSlide ? px : x));
	}}
	onClose={closeToolbar}
/>

<TweetMediaToolbar
	anchor={selectedText === 'tweetTopMedia' ? toolbarAnchor : null}
	hasAttachment={!!(
		String((bgImagesByTemplate.tweet ?? [])[paintSlide] ?? '').trim() ||
		String((bgVideosByTemplate.tweet ?? [])[paintSlide] ?? '').trim()
	)}
	zoom={tweetTopImageZoomBySlide[paintSlide] ?? 1}
	onZoomIn={() => {
		if (!canvasInteractive) return;
		pushUndo('tweet', paintSlide);
		const cur = Number(tweetTopImageZoomBySlide[paintSlide]) || 1;
		const next = Math.min(5, Math.max(1, cur + 0.12));
		tweetTopImageZoomBySlide = tweetTopImageZoomBySlide.map((z, i) => (i === paintSlide ? next : z));
	}}
	onZoomOut={() => {
		if (!canvasInteractive) return;
		pushUndo('tweet', paintSlide);
		const cur = Number(tweetTopImageZoomBySlide[paintSlide]) || 1;
		const next = Math.min(5, Math.max(1, cur - 0.12));
		tweetTopImageZoomBySlide = tweetTopImageZoomBySlide.map((z, i) => (i === paintSlide ? next : z));
	}}
	onReplaceFile={(file) => {
		if (!canvasInteractive) return;
		pushUndo('tweet', paintSlide);
		const extOk = /\.(mp4|mov|webm|m4v|mkv|avi)$/i.test(file.name ?? '');
		const isVideo =
			file.type.startsWith('video/') ||
			file.type === 'application/mp4' ||
			(file.type === 'application/octet-stream' && extOk) ||
			extOk;
		const url = URL.createObjectURL(file);
		if (isVideo) setSlideVideo(paintSlide, url, 'tweet');
		else setSlideImage(paintSlide, url, 'tweet');
	}}
	onRemove={() => {
		if (!canvasInteractive) return;
		pushUndo('tweet', paintSlide);
		setSlideImage(paintSlide, '', 'tweet');
	}}
	onClose={closeToolbar}
/>

<!-- Canva-style floating toolbar for text formatting -->
<FloatingTextToolbar
	anchor={selectedText === 'textCarouselAvatar' ||
		selectedText === 'tweetTopAvatar' ||
		selectedText === 'tweetBottomAvatar' ||
		selectedText === 'tweetTopMedia' ||
		(selectedText === 'source' && sourceLabelMode === 'logo')
		? null
		: toolbarAnchor}
	style={toolbarFloatingStyle}
	autoFontSize={toolbarPaintedFontSize ?? toolbarAutoFontSize ?? (selectedText === 'source' ? 34 : selectedText === 'textOverlay' ? 42 : undefined)}
	deleteOnly={selectedText === 'articleImage' ||
		selectedText === 'articleLogo' ||
		selectedText === 'videoStoryMedia'}
	supportsHighlights={studioMarkupFieldActive()}
	hasRangeSelection={hasRangeSelection}
	textColorMixed={toolbarTextColorMixed}
	activeHighlight={toolbarActiveHighlight}
	onChange={onFloatingToolbarChange}
	onHighlight={studioMarkupFieldActive() ? onHighlight : undefined}
	onClose={closeToolbar}
	onDelete={handleFloatingToolbarDelete}
/>

<style>
	/* Highlighter-style selection — keep the text’s own color (white on dark slides, etc.). */
	:global([data-studio-canvas-root] ::selection) {
		background: rgba(255, 235, 59, 0.55);
		color: inherit;
	}
	:global([data-studio-canvas-root] ::-moz-selection) {
		background: rgba(255, 235, 59, 0.55);
		color: inherit;
	}
	/* Canvas uses purple selection rings — kill the global lime :focus-visible double box. */
	:global([data-studio-canvas-root] :focus-visible) {
		outline: none !important;
		box-shadow: none;
	}
	:global([data-studio-canvas-root] [contenteditable='true']:focus),
	:global([data-studio-canvas-root] [contenteditable='true']:focus-visible) {
		outline: none !important;
		box-shadow: none;
	}

	/* ─── Studio left panel — light theme makeover ──────────────────
	   Forces a soft #fafafa surface and flips every dark utility
	   class inside the panel to a matching light counterpart.
	   The studio HTML uses Tailwind utilities like `bg-black`,
	   `bg-neutral-950`, `text-neutral-200`, etc. — these overrides
	   neutralize them so the layout reads as a polished light panel
	   without touching the JSX. */
	:root:not([data-theme="dark"]) .studio-left {
		/* Local design tokens that mirror the home / dashboard palette */
		--sl-bg: #fafafa;
		--sl-surface: #ffffff;
		--sl-surface-2: #f3f3f4;
		--sl-text: #0a0a0a;
		--sl-text-2: rgba(10, 10, 10, 0.65);
		--sl-text-3: rgba(10, 10, 10, 0.45);
		--sl-text-4: rgba(10, 10, 10, 0.32);
		--sl-border: rgba(10, 10, 10, 0.10);
		--sl-border-2: rgba(10, 10, 10, 0.06);
		--sl-shadow: 0 1px 2px rgba(10, 10, 10, 0.04);

		background: var(--sl-bg) !important;
		color: var(--sl-text) !important;
		border-right-color: var(--sl-border) !important;
		font-family: var(--font-body);
	}
	:root:not([data-theme="dark"]) .studio-right {
		background: var(--app-bg) !important;
		pointer-events: auto;
	}

	/* — Backgrounds: black/neutral-950/900/etc → white surfaces — */
	:root:not([data-theme="dark"]) .studio-left :global(.bg-black),
	:root:not([data-theme="dark"]) .studio-left :global(.bg-neutral-950),
	:root:not([data-theme="dark"]) .studio-left :global(.bg-neutral-900),
	:root:not([data-theme="dark"]) .studio-left :global(.bg-neutral-950\/80),
	:root:not([data-theme="dark"]) .studio-left :global(.bg-neutral-950\/90) {
		background-color: var(--sl-surface) !important;
	}
	:root:not([data-theme="dark"]) .studio-left :global(.bg-neutral-800) {
		background-color: var(--sl-surface-2) !important;
	}

	/* — Borders: dark → light — */
	:root:not([data-theme="dark"]) .studio-left :global(.border-neutral-950),
	:root:not([data-theme="dark"]) .studio-left :global(.border-neutral-900),
	:root:not([data-theme="dark"]) .studio-left :global(.border-neutral-800),
	:root:not([data-theme="dark"]) .studio-left :global(.border-neutral-700),
	:root:not([data-theme="dark"]) .studio-left :global([class*="border-violet-900"]) {
		border-color: var(--sl-border) !important;
	}

	/* — Text: neutral-50/100/200/300 → primary, 400/500/600 → muted — */
	:root:not([data-theme="dark"]) .studio-left :global(.text-neutral-50),
	:root:not([data-theme="dark"]) .studio-left :global(.text-neutral-100),
	:root:not([data-theme="dark"]) .studio-left :global(.text-neutral-200),
	:root:not([data-theme="dark"]) .studio-left :global(.\!text-neutral-50) {
		color: var(--sl-text) !important;
	}
	:root:not([data-theme="dark"]) .studio-left :global(.text-neutral-300),
	:root:not([data-theme="dark"]) .studio-left :global(.text-neutral-400) {
		color: var(--sl-text-2) !important;
	}
	:root:not([data-theme="dark"]) .studio-left :global(.text-neutral-500),
	:root:not([data-theme="dark"]) .studio-left :global(.text-neutral-600) {
		color: var(--sl-text-3) !important;
	}

	/* — Placeholders — */
	:root:not([data-theme="dark"]) .studio-left :global(.placeholder\:text-neutral-500)::placeholder,
	:root:not([data-theme="dark"]) .studio-left :global(.placeholder\:text-neutral-600)::placeholder,
	:root:not([data-theme="dark"]) .studio-left :global(input)::placeholder,
	:root:not([data-theme="dark"]) .studio-left :global(textarea)::placeholder {
		color: var(--sl-text-4) !important;
	}

	/* — Hover states for buttons inside the panel — */
	:root:not([data-theme="dark"]) .studio-left :global(.hover\:bg-neutral-900):hover,
	:root:not([data-theme="dark"]) .studio-left :global(.hover\:bg-neutral-800):hover,
	:root:not([data-theme="dark"]) .studio-left :global(.hover\:text-neutral-100):hover {
		background-color: var(--sl-surface-2) !important;
		color: var(--sl-text) !important;
	}

	/* — Data-state for tab triggers (active state) — */
	:root:not([data-theme="dark"]) .studio-left :global([data-state="active"].data-\[state\=active\]\:bg-neutral-800),
	:root:not([data-theme="dark"]) .studio-left :global([data-state="active"]) {
		background-color: var(--sl-text) !important;
		color: #ffffff !important;
	}

	/* — Inputs & textareas — */
	:root:not([data-theme="dark"]) .studio-left :global(input),
	:root:not([data-theme="dark"]) .studio-left :global(textarea),
	:root:not([data-theme="dark"]) .studio-left :global(select) {
		color: var(--sl-text) !important;
		background-color: var(--sl-surface) !important;
		border-color: var(--sl-border) !important;
	}

	/* Prompt bar styles live in `$lib/styles/prompt-bar.css` (ChatGPT-style shell). */

	/* — Headings / chips that use header label styling — */
	:root:not([data-theme="dark"]) .studio-left :global(label) {
		color: var(--sl-text-3) !important;
	}

	/* — Surface card panels (Save template, JSON paste, content card,
	     SOURCE LABEL, Word highlights, etc.) get a clean white look
	     with a subtle shadow rather than pure dark — */
	:root:not([data-theme="dark"]) .studio-left :global(.rounded-xl),
	:root:not([data-theme="dark"]) .studio-left :global(.rounded-2xl) {
		box-shadow: var(--sl-shadow);
	}

	/* — Keep saturated brand pills (violet, yellow, emerald, red) but
	     gently restyle the muted variants used inside dark UI — */
	:root:not([data-theme="dark"]) .studio-left :global(.bg-violet-500\/10) {
		background-color: rgba(139, 92, 246, 0.10) !important;
	}
	:root:not([data-theme="dark"]) .studio-left :global(.text-violet-300),
	:root:not([data-theme="dark"]) .studio-left :global(.text-violet-400) {
		color: #6d28d9 !important;
	}
	:root:not([data-theme="dark"]) .studio-left :global(.text-emerald-400\/90) { color: #047857 !important; }
	:root:not([data-theme="dark"]) .studio-left :global(.text-red-400\/90)     { color: #b91c1c !important; }

	/* — Inherit prior light-mode overrides for white-alpha utilities — */
	:root:not([data-theme="dark"]) .studio-left :global(.text-white) { color: var(--sl-text) !important; }
	:root:not([data-theme="dark"]) .studio-left :global(.text-white\/95),
	:root:not([data-theme="dark"]) .studio-left :global(.text-white\/90),
	:root:not([data-theme="dark"]) .studio-left :global(.text-white\/80),
	:root:not([data-theme="dark"]) .studio-left :global(.text-white\/70),
	:root:not([data-theme="dark"]) .studio-left :global(.text-white\/60),
	:root:not([data-theme="dark"]) .studio-left :global(.text-white\/55),
	:root:not([data-theme="dark"]) .studio-left :global(.text-white\/50),
	:root:not([data-theme="dark"]) .studio-left :global(.text-white\/45),
	:root:not([data-theme="dark"]) .studio-left :global(.text-white\/40),
	:root:not([data-theme="dark"]) .studio-left :global(.text-white\/35),
	:root:not([data-theme="dark"]) .studio-left :global(.text-white\/30),
	:root:not([data-theme="dark"]) .studio-left :global(.text-white\/25),
	:root:not([data-theme="dark"]) .studio-left :global(.text-white\/20),
	:root:not([data-theme="dark"]) .studio-left :global(.text-white\/15) { color: var(--sl-text-3) !important; }

	:root:not([data-theme="dark"]) .studio-left :global(.bg-white\/\[0\.04\]),
	:root:not([data-theme="dark"]) .studio-left :global(.bg-white\/\[0\.03\]),
	:root:not([data-theme="dark"]) .studio-left :global(.bg-white\/\[0\.02\]),
	:root:not([data-theme="dark"]) .studio-left :global(.bg-white\/3),
	:root:not([data-theme="dark"]) .studio-left :global(.bg-white\/2) { background: var(--sl-surface-2) !important; }

	:root:not([data-theme="dark"]) .studio-left :global(.border-white\/\[0\.10\]),
	:root:not([data-theme="dark"]) .studio-left :global(.border-white\/\[0\.08\]),
	:root:not([data-theme="dark"]) .studio-left :global(.border-white\/\[0\.06\]),
	:root:not([data-theme="dark"]) .studio-left :global(.border-white\/\[0\.05\]),
	:root:not([data-theme="dark"]) .studio-left :global(.border-white\/\[0\.04\]),
	:root:not([data-theme="dark"]) .studio-left :global(.border-white\/10),
	:root:not([data-theme="dark"]) .studio-left :global(.border-white\/6) { border-color: var(--sl-border) !important; }

	:root:not([data-theme="dark"]) .studio-left :global(.placeholder-white\/20)::placeholder { color: var(--sl-text-4) !important; opacity: 0.85; }

	/* Hide scrollbars (keep scroll) for the bottom filmstrip */
	.studio-right-rail {
		width: 272px;
		transition: width 200ms cubic-bezier(0.22, 1, 0.36, 1);
	}
	.studio-right-rail.is-collapsed {
		width: 52px;
	}

	.studio-dock-row {
		min-height: 56px;
		box-sizing: border-box;
		pointer-events: auto;
		isolation: isolate;
	}

	.studio-dock-inner,
	.studio-dock-inner :global(button),
	.studio-dock-inner :global([data-slot='popover-trigger']),
	.studio-dock-inner :global([data-slot='select-trigger']) {
		pointer-events: auto;
	}

	.studio-prompt-chrome,
	.studio-prompt-chrome :global(button),
	.studio-prompt-chrome :global(input),
	.studio-prompt-chrome :global(textarea),
	.studio-prompt-chrome :global([data-slot='popover-trigger']),
	.studio-prompt-chrome :global([data-slot='select-trigger']),
	.filmstrip-row,
	.filmstrip-row :global(button) {
		pointer-events: auto;
	}

	.filmstrip-row {
		min-height: calc(5rem + 0.25rem + 14px + 0.25rem + 0.5rem);
		flex-shrink: 0;
		box-sizing: border-box;
		/* Stay above the prompt chrome / canvas overflow so corner hits register */
		isolation: isolate;
	}

	.filmstrip-scroll {
		padding-top: 0.25rem;
		/* Corner controls sit inset on the thumb so overflow-x won't clip them */
	}

	/* Filmstrip: fixed thumb + label rows so Hook / Follow / Add bottoms align */
	.filmstrip-cell {
		width: 4rem; /* w-16 */
		overflow: visible;
		position: relative;
	}
	.filmstrip-corner-btn {
		pointer-events: auto;
		background: #ffffff !important;
		color: #111111 !important;
		border: 1px solid rgba(0, 0, 0, 0.16) !important;
		box-shadow: 0 1px 4px rgba(0, 0, 0, 0.28);
	}
	.filmstrip-corner-btn :global(svg) {
		color: inherit !important;
		stroke: currentColor !important;
	}
	.filmstrip-delete-btn:hover {
		background: #ef4444 !important;
		border-color: #ef4444 !important;
		color: #ffffff !important;
	}
	.filmstrip-label {
		color: rgba(10, 10, 10, 0.48);
	}
	.filmstrip-label.is-active {
		color: #6d28d9;
	}
	.filmstrip-thumb {
		width: 4rem;
		height: 5rem; /* h-20 */
		flex-shrink: 0;
		box-sizing: border-box;
		position: relative;
	}
	.filmstrip-label {
		height: 14px;
		line-height: 14px;
		width: 100%;
		overflow: hidden;
		white-space: nowrap;
		text-overflow: ellipsis;
	}
	.filmstrip-skel {
		background-image: linear-gradient(110deg, #ececec 8%, #f8f8f8 18%, #ececec 33%);
		background-size: 200% 100%;
		animation: sk-shimmer 1.4s ease-in-out infinite;
		overflow: hidden;
	}
	.filmstrip-skel::after {
		display: none;
	}
	.filmstrip-label-skel {
		display: block;
		width: 2.25rem;
		height: 8px;
		margin: 3px auto 0;
		border-radius: 999px;
		background-image: linear-gradient(110deg, #ececec 8%, #f8f8f8 18%, #ececec 33%);
		background-size: 200% 100%;
		animation: sk-shimmer 1.4s ease-in-out infinite;
	}
	@keyframes filmstrip-skel-sweep {
		to {
			transform: translateX(100%);
		}
	}
	@keyframes filmstrip-label-pulse {
		0%,
		100% {
			opacity: 0.45;
		}
		50% {
			opacity: 0.9;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.filmstrip-skel,
		.filmstrip-label-skel {
			animation: none;
			background-image: none;
			background-color: #ececec;
		}
	}

	.studio-canvas-shell.is-measured {
		transition: width 200ms cubic-bezier(0.22, 1, 0.36, 1);
	}
	.studio-canvas-frame.is-measured {
		transition: height 200ms cubic-bezier(0.22, 1, 0.36, 1);
	}
	/* Frame stays opaque so the boot skeleton (child) is visible. */
	.studio-canvas-frame {
		opacity: 1;
		isolation: isolate;
	}
	/* Keep live canvas painted during boot — filmstrip toPng needs real pixels.
	   The opaque .studio-boot-overlay covers it for the user. */
	.studio-canvas-live {
		position: relative;
		min-height: 100%;
	}
	.studio-canvas-live:not(.is-live) {
		pointer-events: none;
	}
	.studio-boot-overlay {
		pointer-events: none;
	}
	.studio-boot-veil {
		background: var(--app-surface, #f4f4f5);
	}
	:global(:root[data-theme='dark']) .studio-boot-veil {
		background: var(--app-surface-2, #131316);
	}
	.studio-dock-inner {
		display: flex;
		flex-wrap: nowrap;
		align-items: center;
		justify-content: center;
		gap: 0;
		width: auto;
		max-width: 100%;
		min-width: 0;
	}

	/* Shared dock popover panel + segmented tool buttons (Shadow / Highlights / Branding) */
	:global(.studio-dock-popover) {
		z-index: 400;
		gap: 0;
		border-radius: 16px;
		border: 1px solid #ebebeb;
		background: #ffffff;
		padding: 0.875rem;
		color: #1a1a1a;
		box-shadow:
			0 12px 40px rgba(0, 0, 0, 0.12),
			0 2px 8px rgba(0, 0, 0, 0.06);
	}

	/* Stay parked under the dock so the canvas letterbox stays visible while editing. */
	:global(.studio-shadow-popover) {
		max-height: min(46vh, 26rem);
		overflow-y: auto;
		overscroll-behavior: contain;
		scrollbar-width: thin;
	}

	.studio-dock-inner :global(.studio-dock-tool-group [data-slot='button']) {
		border-radius: 0;
		transform: none;
		box-shadow: none;
	}

	.studio-dock-inner :global(.studio-dock-tool-group > :first-child [data-slot='button']),
	.studio-dock-inner :global(.studio-dock-tool-group > :first-child[data-slot='button']) {
		border-top-left-radius: var(--radius-md, 0.375rem);
		border-bottom-left-radius: var(--radius-md, 0.375rem);
	}

	.studio-dock-inner :global(.studio-dock-tool-group > :last-child [data-slot='button']),
	.studio-dock-inner :global(.studio-dock-tool-group > :last-child[data-slot='button']) {
		border-top-right-radius: var(--radius-md, 0.375rem);
		border-bottom-right-radius: var(--radius-md, 0.375rem);
	}

	.studio-dock-inner :global(.studio-dock-tool-group > :not(:first-child) [data-slot='button']),
	.studio-dock-inner :global(.studio-dock-tool-group > :not(:first-child)[data-slot='button']) {
		border-left-width: 0;
	}

	.studio-dock-inner :global(.studio-dock-tool-group [data-slot='button']:hover),
	.studio-dock-inner :global(.studio-dock-tool-group [data-slot='button'][aria-expanded='true']) {
		z-index: 1;
		border-color: rgba(15, 15, 16, 0.22);
		background: var(--mk-soft, #f6f7f9);
		transform: none;
	}

	.studio-dock-inner :global(.studio-dock-tool-group > :not(:first-child) [data-slot='button']:hover),
	.studio-dock-inner :global(.studio-dock-tool-group > :not(:first-child) [data-slot='button'][aria-expanded='true']),
	.studio-dock-inner :global(.studio-dock-tool-group > :not(:first-child)[data-slot='button']:hover),
	.studio-dock-inner :global(.studio-dock-tool-group > :not(:first-child)[data-slot='button'][aria-expanded='true']) {
		border-left-width: 0;
	}

	.studio-dock-inner :global(.studio-dock-tool-btn--hl-on) {
		color: #111;
	}

	.studio-dock-inner :global(.studio-dock-tool-btn--hl-off) {
		color: #8a8a8a;
	}

	.studio-assets-open-btn {
		display: none;
	}
	.studio-assets-scrim {
		display: none;
	}

	@media (max-width: 767px) {
		.studio-root {
			position: relative;
		}
		.studio-dock-row {
			min-height: 48px;
			justify-content: flex-start;
			overflow-x: auto;
			-webkit-overflow-scrolling: touch;
			scrollbar-width: none;
			padding-bottom: 2px;
		}
		.studio-dock-row::-webkit-scrollbar {
			display: none;
		}
		.studio-dock-inner {
			justify-content: flex-start;
			width: max-content;
			max-width: none;
		}
		.studio-dock-tool-label {
			display: none;
		}
		.studio-canvas-bg-toggle {
			padding-inline: 0.45rem;
			gap: 0.35rem;
		}
		.studio-assets-open-btn {
			display: inline-flex;
		}
		.studio-assets-scrim {
			display: block;
			position: fixed;
			top: calc(3.5rem + env(safe-area-inset-top, 0px));
			right: 0;
			bottom: 0;
			left: 0;
			z-index: 280;
			border: 0;
			background: rgba(8, 8, 8, 0.45);
			cursor: pointer;
		}
		.studio-right-rail {
			position: fixed;
			top: calc(3.5rem + env(safe-area-inset-top, 0px));
			right: 0;
			bottom: 0;
			z-index: 300;
			width: min(100vw, 22rem);
			max-width: 100%;
			background: var(--app-surface, #fff);
			box-shadow: -16px 0 40px rgba(0, 0, 0, 0.18);
			transition: transform 220ms cubic-bezier(0.22, 1, 0.36, 1), width 0ms;
		}
		.studio-right-rail.is-collapsed {
			width: min(100vw, 22rem);
			transform: translateX(110%);
			pointer-events: none;
		}
		.studio-format-dock {
			overflow-x: auto;
			-webkit-overflow-scrolling: touch;
			scrollbar-width: none;
			justify-content: flex-start;
		}
		.studio-format-dock::-webkit-scrollbar {
			display: none;
		}
		.studio-prompt-chrome :global(.prompt-bar) {
			max-width: 100%;
		}
		:global(.studio-dock-popover) {
			width: min(92vw, 320px) !important;
			max-height: min(70vh, 520px);
		}
		:global(.studio-shadow-popover) {
			max-height: min(38vh, 20rem) !important;
		}
	}

	@media (pointer: coarse) {
		.studio-dock-inner :global([data-slot='button']) {
			min-height: 40px;
			min-width: 40px;
		}
	}

	.studio-hl-swatch {
		width: 11px;
		height: 11px;
		border-radius: 999px;
		flex-shrink: 0;
		box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.16);
	}

	.studio-hl-swatch--off {
		background: transparent !important;
		background-image: none !important;
		box-shadow: inset 0 0 0 1.5px rgba(0, 0, 0, 0.28);
		position: relative;
	}

	.studio-hl-swatch--off::after {
		content: '';
		position: absolute;
		left: 50%;
		top: 50%;
		width: 12px;
		height: 1.5px;
		background: rgba(0, 0, 0, 0.35);
		transform: translate(-50%, -50%) rotate(-45deg);
		border-radius: 1px;
	}

	.studio-hl-on-dot {
		width: 6px;
		height: 6px;
		border-radius: 999px;
		flex-shrink: 0;
		background: #22c55e;
		box-shadow: 0 0 0 1.5px rgba(34, 197, 94, 0.25);
	}
	@media (prefers-reduced-motion: reduce) {
		.studio-canvas-shell.is-measured,
		.studio-canvas-frame.is-measured {
			transition: none;
		}
	}

	.no-scrollbar {
		scrollbar-width: none; /* Firefox */
		-ms-overflow-style: none; /* IE/Edge legacy */
	}
	.no-scrollbar::-webkit-scrollbar {
		display: none; /* Chrome/Safari */
	}

	/* Video trimmer ranges (bottom timeline) */
	.video-range {
		position: absolute;
		left: 0;
		right: 0;
		top: 0;
		bottom: 0;
		width: 100%;
		height: 100%;
		opacity: 0;
		/* Critical: don't let the invisible track steal clicks. We'll re-enable
		   pointer events on the thumb only so each handle is draggable. */
		pointer-events: none;
		cursor: ew-resize;
		-webkit-appearance: none;
		appearance: none;
		background: transparent;
	}
	.video-range::-webkit-slider-thumb { pointer-events: auto; }
	.video-range::-moz-range-thumb { pointer-events: auto; }
	.video-range::-ms-thumb { pointer-events: auto; }
	.video-range-start {
		z-index: 2;
	}
	.video-range-end {
		z-index: 3;
	}

	/* Circle AI modal — placeholder + focus ring follow theme tokens */
	.circle-ai-prompt-input::placeholder {
		color: var(--app-text-3);
		opacity: 0.9;
	}
	.circle-ai-prompt-input:focus {
		border-color: color-mix(in oklab, var(--app-focus) 50%, var(--app-border)) !important;
		box-shadow: 0 0 0 3px color-mix(in oklab, var(--app-focus) 20%, transparent);
	}
</style>
