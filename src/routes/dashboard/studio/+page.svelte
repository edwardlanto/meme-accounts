<script lang="ts">
	import { supabase } from '$lib/supabase';
	import { onMount, tick } from 'svelte';
	import { goto, afterNavigate } from '$app/navigation';
import { toPng } from 'html-to-image';
import JSZip from 'jszip';
	import NewsTemplate from '$lib/components/templates/NewsTemplate.svelte';
	import BlankTemplate from '$lib/components/templates/BlankTemplate.svelte';
	import TweetTemplate from '$lib/components/templates/TweetTemplate.svelte';
	import ArticleTemplate from '$lib/components/templates/ArticleTemplate.svelte';
	import TextCarouselTemplate from '$lib/components/templates/TextCarouselTemplate.svelte';
	import ImageQuoteTemplate from '$lib/components/templates/ImageQuoteTemplate.svelte';
	import VideoStoryTemplate from '$lib/components/templates/VideoStoryTemplate.svelte';
	import BlackTextCarouselTemplate from '$lib/components/templates/BlackTextCarouselTemplate.svelte';
	import StudioTextOverlays from '$lib/components/studio/StudioTextOverlays.svelte';
	import StudioImageStickers from '$lib/components/studio/StudioImageStickers.svelte';
	import FloatingActions from '$lib/components/FloatingActions.svelte';
	import LoadingLines from '$lib/components/LoadingLines.svelte';
	import FloatingTextToolbar from '$lib/components/FloatingTextToolbar.svelte';
	import TextCarouselAvatarToolbar from '$lib/components/TextCarouselAvatarToolbar.svelte';
	import TweetMediaToolbar from '$lib/components/TweetMediaToolbar.svelte';
	import NewsBackgroundToolbar from '$lib/components/NewsBackgroundToolbar.svelte';
	import HighlightEditor from '$lib/components/HighlightEditor.svelte';
	import DockToolbar from '$lib/components/DockToolbar.svelte';
	import FormatDockToolbar from '$lib/components/FormatDockToolbar.svelte';
	import TemplateDockToolbar from '$lib/components/TemplateDockToolbar.svelte';
	import { Button, buttonVariants } from '$lib/components/ui/button';
	import { cn } from '$lib/utils.js';
	import { loadGoogleFont } from '$lib/fonts';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { r2UploadBlob } from '$lib/r2Client';
	import { r2SignRead } from '$lib/r2Client';
	import { resolveStoredMediaUrl, ensureR2RefLoaded, prefetchAllR2RefsInStudioMedia } from '$lib/studio/r2-media-resolve';
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
		type HighlightSpec,
		plainRangeFromSelection,
		plainRangeHasMixedForegroundPaint,
		rangeForegroundSwatchColor,
		stripMarkup,
	} from '$lib/highlight';
	import type { Overlay, TextOverlay, TextStyle, TextElementKind } from '$lib/types';
	import { removeBackground } from '$lib/backgroundRemoval';
	import {
		STUDIO_TEMPLATES,
		mapQueryParamToTemplateId,
		coerceTemplateId,
		type TemplateId,
		type StudioTemplateDef,
	} from '$lib/studio/template-ids';
	import {
		NEWS_PLACEHOLDER_HEADLINE,
		NEWS_DEFAULT_SOURCE,
		NEWS_DEFAULT_LAYOUT,
		TWEET_DEFAULTS,
		ARTICLE_DEFAULT_BODY,
		ARTICLE_DEFAULT_SWIPE,
		TEXT_CAROUSEL_DEFAULTS,
		ensureTextCarouselBodyMinLength,
		IMAGE_QUOTE_DEFAULTS,
		VIDEO_STORY_DEFAULTS,
		BLACK_TEXT_CAROUSEL_DEFAULTS,
	} from '$lib/studio/slide-content-defaults';
	import {
		parseExternalSlideBlocksJson,
		computeStudioSlideMergePatches,
		type ExternalSlideMergeMode,
	} from '$lib/studio/external-slide-merge';
	import {
		Newspaper, Sparkles, RefreshCw, Download, Loader, AlertCircle,
		Image, Type, Search, FlaskConical, Wifi, Layers,
		Scissors, Volume2, VolumeX, Eye, EyeOff, Flame, Music, Play, X, Undo2, Redo2, Circle, Palette, Trash2, RotateCcw, Wallpaper, SlidersHorizontal, ArrowUp
	} from 'lucide-svelte';

	/** Default full-bleed asset for the Black text carousel template. */
	/** Empty: solid `#000` from the template. Avoid a JPEG that already contains the sample copy — it would stack under live text and look doubled. */
	const BLACK_TEXT_BG_DEFAULT = '';

	/** Fresh `/dashboard/studio` sessions start with this many slides (filmstrip + News fetch deck). */
	const DEFAULT_STUDIO_SLIDE_COUNT = 3;

	const emptySlides = <T,>(factory: (i: number) => T): T[] =>
		Array.from({ length: DEFAULT_STUDIO_SLIDE_COUNT }, (_, i) => factory(i));

	// ── Mock data ─────────────────────────────────────────────────────────
	const MOCK_NEWS = [
		{
			uuid: "8d906cbc-8d65-43d0-93ff-f67842145d66",
			title: "The top 5 startup buyers in Silicon Valley",
			description: "Silicon Valley giants made up 33% of total startup acquisition deals since 2000, an analysis found",
			snippet: "Silicon Valley is known for nurturing some of the world's most successful tech startups and companies, making it not so surprising that it's also home to so...",
			url: "https://qz.com/google-apple-meta-startup-acquisitions-silicon-valley-1851681629",
			image_url: "https://i.kinja-img.com/image/upload/c_fill,h_675,pg_1,q_80,w_1200/0c461b0f4587d274f2cc0a13ac4c1e1a.jpg",
			source: "qz.com",
			categories: ["general", "business", "tech"],
		},
		{
			uuid: "2a304e6c-774a-4820-8128-0e19d6121934",
			title: "Mental-Health Startup Cerebral Investigated by FTC",
			description: "Regulators focus on whether online provider engaged in deceptive or unfair marketing practices",
			snippet: "Mental health startup Cerebral was subpoenaed last month by federal prosecutors as part of an investigation into possible violations of the Controlled Substance...",
			url: "https://www.wsj.com/articles/ftc-launches-probe-of-cerebrals-business-practices-11655241983",
			image_url: "https://images.wsj.net/im-563603/social",
			source: "online.wsj.com",
			categories: ["business"],
		},
		{
			uuid: "b619002a-76ab-4223-8703-648ee7a17175",
			title: "Top Startup Crowdfunding Campaigns To Invest In",
			description: "If you're looking for startups to invest in, here's Benzinga's list of the top startup investments for August 2022.",
			snippet: "If you're looking for startups to invest in, here's Benzinga's list of the top startup investments for August 2022. Gryphon is recognized as one of th...",
			url: "https://www.benzinga.com/markets/22/08/28639261/top-startup-crowdfunding-campaigns-to-invest-in",
			image_url: "https://cdn.benzinga.com/files/images/story/2022/08/25/shutterstock_1532955209.jpg?width=1200&height=800&fit=crop",
			source: "benzinga.com",
			categories: ["business"],
		},
	] as const;

	// ── State ──────────────────────────────────────────────────────────────
	let userId = $state('');
	let useTestData = $state(true); // default to mock data
	let initialTemplateParamApplied = $state(false);
	let forcedTemplateFromQuery = $state<TemplateId | null>(null);
	/** `?blank=1` — skip draft restore and open a minimal News canvas (users can switch templates per slide). */
	let forcedBlankFromQuery = $state(false);
	/** `?template=…` starter links (template carousel / nav) — don’t restore last autosave workspace on top of a “new” session. */
	let skipLatestWorkspaceDraftRestore = $state(false);

	// News controls
	let search = $state('');
	// Fill-in-text uses the same topic input (`search`) as Generate/Fetch.
	let category = $state('business');
	/** Sidebar mode for the News template generator: live articles vs synthetic fact/story. */
	type NewsStudioContentMode = 'news' | 'fact' | 'story';
	let newsContentMode = $state<NewsStudioContentMode>('news');
	let storyCategory = $state('health');
	/** Sent to /api/news as syntheticHint when Random fact is selected. */
	let factTopicPrompt = $state('');
	/** Sent to /api/news as syntheticHint with the story theme when Random story is selected. */
	let storyTopicPrompt = $state('');
	let slideCount = $state(DEFAULT_STUDIO_SLIDE_COUNT); // 1–10

	// Preview/edit view toggle for the canvas area.
	let fetchingNews = $state(false);
	let generatingVariants = $state(false);
	/** Keeps the full-canvas loader up for one paint flush after Vertex flags drop (avoids a one-frame flash). */
	let studioImageGenPaintHold = $state(false);
	/** >0 while `generateAllSlideImages` / `refreshNewsDeckImagesAfterFetch` run (skip per-slide paint hold). */
	let studioImageGenBatchDepth = 0;
	let newsError = $state('');

	// Multi-slide state
	let slides = $state<string[]>(emptySlides(() => NEWS_PLACEHOLDER_HEADLINE));
	let activeSlide = $state(0);
	/** When set, main canvas renders this slide for PNG capture without changing `activeSlide` (no UI “slide show”). */
	let canvasRasterSlide = $state<number | null>(null);
	let articleSnippet = $state(''); // full article text for variants call

	// ── Per-slide template selection (ids + labels live in `$lib/studio`) ──
	type TemplateDef = StudioTemplateDef;
	const TEMPLATES: TemplateDef[] = STUDIO_TEMPLATES;
	/** Options for the floating template dock (dropdown). Article omitted from `STUDIO_TEMPLATES` but injected here when a slide still uses it. */
	const templateDockTabs = $derived.by(() => {
		const rows = TEMPLATES.map((t) => ({
			id: t.id,
			label: t.label,
			title: `${t.label} — this slide only`,
		}));
		const cur = slideTemplates[activeSlide];
		if (cur === 'article' && !rows.some((r) => r.id === 'article')) {
			return [
				...rows,
				{ id: 'article', label: 'Article', title: 'Article — this slide only' },
			];
		}
		return rows;
	});
	let slideTemplates = $state<TemplateId[]>(emptySlides(() => 'news'));
	let lastTemplateUsed = $state<TemplateId>('news');
	const activeTemplate = $derived(coerceTemplateId(slideTemplates[activeSlide]));

	function ensureTemplateDefaultsForSlide(t: TemplateId, idx: number) {
		// Seed template-specific copy so switching templates from a blank canvas doesn’t look “broken”.
		// Only fills when the target field is empty.
		if (t === 'news') {
			if (!String(slides[idx] ?? '').trim()) {
				slides = slides.map((x, i) => (i === idx ? NEWS_PLACEHOLDER_HEADLINE : x));
			}
			return;
		}
		if (t === 'tweet') {
			if (!String(tweetTopTextBySlide[idx] ?? '').trim()) {
				tweetTopTextBySlide = tweetTopTextBySlide.map((x, i) => (i === idx ? TWEET_DEFAULTS.topText : x));
			}
			if (!String(tweetBottomTextBySlide[idx] ?? '').trim()) {
				tweetBottomTextBySlide = tweetBottomTextBySlide.map((x, i) => (i === idx ? TWEET_DEFAULTS.bottomText : x));
			}
			return;
		}
		if (t === 'textCarousel') {
			const cur = String(textCarouselTextBySlide[idx] ?? '').trim();
			if (!cur) {
				textCarouselTextBySlide = textCarouselTextBySlide.map((x, i) =>
					i === idx ? TEXT_CAROUSEL_DEFAULTS.body : x,
				);
			} else {
				const ensured = ensureTextCarouselBodyMinLength(cur);
				if (ensured !== (textCarouselTextBySlide[idx] ?? '')) {
					textCarouselTextBySlide = textCarouselTextBySlide.map((x, i) => (i === idx ? ensured : x));
				}
			}
			if (!String(textCarouselNameBySlide[idx] ?? '').trim()) {
				textCarouselNameBySlide = textCarouselNameBySlide.map((x, i) =>
					i === idx ? TEXT_CAROUSEL_DEFAULTS.name : x,
				);
			}
			if (!String(textCarouselHandleBySlide[idx] ?? '').trim()) {
				textCarouselHandleBySlide = textCarouselHandleBySlide.map((x, i) =>
					i === idx ? TEXT_CAROUSEL_DEFAULTS.handle : x,
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
		if (t === 'videoStory') {
			if (!String(videoStoryHeadlineBySlide[idx] ?? '').trim()) {
				videoStoryHeadlineBySlide = videoStoryHeadlineBySlide.map((x, i) =>
					i === idx ? VIDEO_STORY_DEFAULTS.headline : x,
				);
			}
			if (!String(videoStoryWatermarkBySlide[idx] ?? '').trim()) {
				videoStoryWatermarkBySlide = videoStoryWatermarkBySlide.map((x, i) =>
					i === idx ? VIDEO_STORY_DEFAULTS.watermark : x,
				);
			}
			return;
		}
		if (t === 'imageQuote') {
			if (!String(imageQuoteTextBySlide[idx] ?? '').trim()) {
				imageQuoteTextBySlide = imageQuoteTextBySlide.map((x, i) =>
					i === idx ? IMAGE_QUOTE_DEFAULTS.body : x,
				);
			}
			return;
		}
		if (t === 'blackText') {
			if (!String(blackTextHeadlineBySlide[idx] ?? '').trim()) {
				blackTextHeadlineBySlide = blackTextHeadlineBySlide.map((x, i) =>
					i === idx ? BLACK_TEXT_CAROUSEL_DEFAULTS.headline : x,
				);
			}
			if (!String(blackTextBodyBySlide[idx] ?? '').trim()) {
				blackTextBodyBySlide = blackTextBodyBySlide.map((x, i) =>
					i === idx ? BLACK_TEXT_CAROUSEL_DEFAULTS.body : x,
				);
			}
		}
	}

	function setActiveTemplate(t: TemplateId) {
		lastTemplateUsed = t;
		const idx = activeSlide;
		slideTemplates = slideTemplates.map((x, i) => (i === idx ? t : x));
		ensureTemplateDefaultsForSlide(t, idx);
		if (t === 'videoStory') {
			const row = [...(bgVideosByTemplate.videoStory ?? [])];
			while (row.length <= idx) row.push('');
			if (!(row[idx] ?? '').trim()) {
				row[idx] = VIDEO_STORY_DEFAULTS.videoUrl;
				bgVideosByTemplate = { ...bgVideosByTemplate, videoStory: row };
			}
		}
		if (t === 'blackText') {
			const row = [...(bgImagesByTemplate.blackText ?? [])];
			while (row.length <= idx) row.push('');
			if (!(row[idx] ?? '').trim()) {
				row[idx] = BLACK_TEXT_BG_DEFAULT;
				bgImagesByTemplate = { ...bgImagesByTemplate, blackText: row };
			}
		}
	}
	function applyTemplateToAll(t: TemplateId) {
		lastTemplateUsed = t;
		slideTemplates = slideTemplates.map(() => t);
		for (let i = 0; i < slides.length; i++) ensureTemplateDefaultsForSlide(t, i);
		if (t === 'blackText') {
			const n = slides.length;
			const prev = bgImagesByTemplate.blackText ?? [];
			const row = Array.from({ length: n }, (_, i) =>
				String(prev[i] ?? '').trim() ? String(prev[i]) : BLACK_TEXT_BG_DEFAULT,
			);
			bgImagesByTemplate = { ...bgImagesByTemplate, blackText: row };
		}
	}

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
					bottomAvatarImage: string;
					bottomAvatarInnerBg: string;
					bottomAvatarLabel: string;
					styles: Partial<Record<TextElementKind, TextStyle>>;
					offsets: Record<string, { x: number; y: number }>;
				};
		  }
		| {
				template: 'textCarousel';
				slide: number;
				data: {
					name: string;
					handle: string;
					text: string;
					avatarImage: string;
					avatarInnerBg: string;
					avatarLabel: string;
					styles: Partial<Record<TextElementKind, TextStyle>>;
					offsets: Record<string, { x: number; y: number }>;
				};
		  }
		| { template: 'article'; slide: number; data: { text: string; swipeText: string; image: string; logo: string; styles: Partial<Record<TextElementKind, TextStyle>>; offsets: Record<string, { x: number; y: number }> } }
		| { template: 'news'; slide: number; data: { headline: string; source: string; image: string; video: string; styles: Partial<Record<TextElementKind, TextStyle>>; offsets: Record<string, { x: number; y: number }> } }
		| { template: 'videoStory'; slide: number; data: { headline: string; watermark: string; video: string; styles: Partial<Record<TextElementKind, TextStyle>>; offsets: Record<string, { x: number; y: number }> } }
		| { template: 'blackText'; slide: number; data: { headline: string; body: string; image: string; styles: Partial<Record<TextElementKind, TextStyle>>; offsets: Record<string, { x: number; y: number }> } }
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
		blackText: [],
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
					bottomAvatarImage: tweetBottomAvatarImageBySlide[slide] ?? '',
					bottomAvatarInnerBg: tweetBottomAvatarInnerBgBySlide[slide] ?? '',
					bottomAvatarLabel: tweetBottomAvatarLabelBySlide[slide] ?? '',
					styles,
					offsets,
				},
			};
		}
		if (template === 'textCarousel') {
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
		if (template === 'videoStory') {
			return {
				template: 'videoStory',
				slide,
				data: {
					headline: videoStoryHeadlineBySlide[slide] ?? '',
					watermark: videoStoryWatermarkBySlide[slide] ?? '',
					video: (bgVideosByTemplate.videoStory ?? [])[slide] ?? '',
					styles,
					offsets,
				},
			};
		}
		if (template === 'blackText') {
			return {
				template: 'blackText',
				slide,
				data: {
					headline: blackTextHeadlineBySlide[slide] ?? '',
					body: blackTextBodyBySlide[slide] ?? '',
					image: (bgImagesByTemplate.blackText ?? [])[slide] ?? '',
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
			tweetBottomAvatarImageBySlide = tweetBottomAvatarImageBySlide.map((x, idx) => (idx === i ? (d.bottomAvatarImage ?? '') : x));
			tweetBottomAvatarInnerBgBySlide = tweetBottomAvatarInnerBgBySlide.map((x, idx) => (idx === i ? (d.bottomAvatarInnerBg ?? '') : x));
			tweetBottomAvatarLabelBySlide = tweetBottomAvatarLabelBySlide.map((x, idx) => (idx === i ? (d.bottomAvatarLabel ?? '') : x));
			return;
		}
		if (t === 'textCarousel') {
			const d = snap.data;
			textCarouselNameBySlide = textCarouselNameBySlide.map((x, idx) => (idx === i ? d.name : x));
			textCarouselHandleBySlide = textCarouselHandleBySlide.map((x, idx) => (idx === i ? d.handle : x));
			textCarouselTextBySlide = textCarouselTextBySlide.map((x, idx) =>
				idx === i ? ensureTextCarouselBodyMinLength(String(d.text ?? '')) : x,
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
		if (t === 'videoStory') {
			const d = snap.data;
			videoStoryHeadlineBySlide = videoStoryHeadlineBySlide.map((x, idx) => (idx === i ? d.headline : x));
			videoStoryWatermarkBySlide = videoStoryWatermarkBySlide.map((x, idx) => (idx === i ? d.watermark : x));
			bgVideosByTemplate = {
				...bgVideosByTemplate,
				videoStory: (bgVideosByTemplate.videoStory ?? []).map((x, idx) => (idx === i ? d.video : x)),
			};
			return;
		}
		if (t === 'blackText') {
			const d = snap.data;
			blackTextHeadlineBySlide = blackTextHeadlineBySlide.map((x, idx) => (idx === i ? d.headline : x));
			blackTextBodyBySlide = blackTextBodyBySlide.map((x, idx) => (idx === i ? d.body : x));
			bgImagesByTemplate = {
				...bgImagesByTemplate,
				blackText: (bgImagesByTemplate.blackText ?? []).map((x, idx) => (idx === i ? d.image : x)),
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

	const dockItems = $derived.by(() => ([
		...(activeTemplate === 'news'
			? [{ icon: Wallpaper, label: 'BG tools', onClick: openNewsBgToolbarFromDock }]
			: []),
		{ icon: Scissors, label: 'Trim', onClick: toggleTrim, disabled: !effectiveBackgroundVideo },
		{ icon: VolumeX, label: 'Mute', onClick: toggleMute, disabled: !effectiveBackgroundVideo },
		// News background AI lives inside the BG tools popover to keep all background actions together.
		...(activeTemplate === 'news'
			? []
			: [{
				icon: Sparkles,
				label: 'AI',
				onClick: () => void generateBackground(activeSlide, undefined, activeTemplate),
				disabled: !!(generatingImagesByTemplate[activeTemplate] ?? [])[activeSlide],
			}]),
		{
			icon: Circle,
			label: 'Shape',
			onClick: activeTemplate === 'news'
				? () => {
						showCircleBySlide = showCircleBySlide.map((v, i) => (i === activeSlide ? !v : v));
					}
				: undefined,
			disabled: activeTemplate !== 'news',
		},
		{ icon: Type, label: 'Text', onClick: addTextOverlay },
		{ icon: Image, label: 'Image', onClick: uploadOverlayImage },
		{ icon: Palette, label: 'Colors', disabled: true },
		{ icon: Trash2, label: 'Delete slide', onClick: deleteActiveSlide, disabled: slides.length <= 1 },
		{ icon: RotateCcw, label: 'Reset slide', onClick: resetCurrentSlideToDefaults },
		{ icon: Undo2, label: 'Undo', onClick: undoActive, disabled: !canUndoActive() },
		{ icon: Redo2, label: 'Redo', onClick: redoActive, disabled: !canRedoActive() },
	]));

	/** Restore the active slide’s starter copy, layout offsets, overlays, and background media for the current template. */
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

		if (t === 'news') {
			slides = slides.map((x, idx) => (idx === i ? NEWS_PLACEHOLDER_HEADLINE : x));
			source = NEWS_DEFAULT_SOURCE;
			circleImages = Array.from({ length: slides.length }, (_, idx) =>
				idx === i ? '' : (circleImages[idx] ?? ''),
			);
			circle2Images = Array.from({ length: slides.length }, (_, idx) =>
				idx === i ? '' : (circle2Images[idx] ?? ''),
			);
			showCircle2BySlide = Array.from({ length: slides.length }, (_, idx) =>
				idx === i ? false : (showCircle2BySlide[idx] ?? false),
			);
			showCircleBySlide = Array.from({ length: slides.length }, (_, idx) =>
				idx === i ? true : (showCircleBySlide[idx] ?? false),
			);
			circleX = NEWS_DEFAULT_LAYOUT.circleX;
			circleY = NEWS_DEFAULT_LAYOUT.circleY;
			circleSize = NEWS_DEFAULT_LAYOUT.circleSize;
			circle2X = NEWS_DEFAULT_LAYOUT.circle2X;
			circle2Y = NEWS_DEFAULT_LAYOUT.circle2Y;
			circle2Size = NEWS_DEFAULT_LAYOUT.circle2Size;
			applyNewsSeedBackgroundLayout();
			textPanelOffsetY = NEWS_DEFAULT_LAYOUT.textPanelOffsetY;
			shadowHeight = NEWS_DEFAULT_LAYOUT.shadowHeight;
			shadowStrength = NEWS_DEFAULT_LAYOUT.shadowStrength;
			cuttingOut = Array.from({ length: slides.length }, (_, idx) =>
				idx === i ? false : (cuttingOut[idx] ?? false),
			);
			cutoutError = '';
		} else if (t === 'tweet') {
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
			tweetBottomAvatarImageBySlide = tweetBottomAvatarImageBySlide.map((x, idx) => (idx === i ? '' : x));
			tweetBottomAvatarInnerBgBySlide = tweetBottomAvatarInnerBgBySlide.map((x, idx) => (idx === i ? '' : x));
			tweetBottomAvatarLabelBySlide = tweetBottomAvatarLabelBySlide.map((x, idx) => (idx === i ? '' : x));
		} else if (t === 'article') {
			articleTextBySlide = articleTextBySlide.map((x, idx) => (idx === i ? ARTICLE_DEFAULT_BODY : x));
			articleSwipeTextBySlide = articleSwipeTextBySlide.map((x, idx) => (idx === i ? ARTICLE_DEFAULT_SWIPE : x));
			articleLogoSrcBySlide = articleLogoSrcBySlide.map((x, idx) => (idx === i ? '' : x));
		} else if (t === 'textCarousel') {
			textCarouselNameBySlide = textCarouselNameBySlide.map((x, idx) => (idx === i ? TEXT_CAROUSEL_DEFAULTS.name : x));
			textCarouselHandleBySlide = textCarouselHandleBySlide.map((x, idx) => (idx === i ? TEXT_CAROUSEL_DEFAULTS.handle : x));
			textCarouselTextBySlide = textCarouselTextBySlide.map((x, idx) => (idx === i ? TEXT_CAROUSEL_DEFAULTS.body : x));
			textCarouselAvatarImageBySlide = textCarouselAvatarImageBySlide.map((x, idx) => (idx === i ? '' : x));
			textCarouselAvatarInnerBgBySlide = textCarouselAvatarInnerBgBySlide.map((x, idx) => (idx === i ? '' : x));
			textCarouselAvatarLabelBySlide = textCarouselAvatarLabelBySlide.map((x, idx) => (idx === i ? '' : x));
		} else if (t === 'videoStory') {
			videoStoryHeadlineBySlide = videoStoryHeadlineBySlide.map((x, idx) =>
				idx === i ? VIDEO_STORY_DEFAULTS.headline : x,
			);
			videoStoryWatermarkBySlide = videoStoryWatermarkBySlide.map((x, idx) =>
				idx === i ? VIDEO_STORY_DEFAULTS.watermark : x,
			);
			bgVideosByTemplate = {
				...bgVideosByTemplate,
				videoStory: (bgVideosByTemplate.videoStory ?? []).map((x, idx) =>
					idx === i ? VIDEO_STORY_DEFAULTS.videoUrl : x,
				),
			};
		} else if (t === 'blackText') {
			blackTextHeadlineBySlide = blackTextHeadlineBySlide.map((x, idx) =>
				idx === i ? BLACK_TEXT_CAROUSEL_DEFAULTS.headline : x,
			);
			blackTextBodyBySlide = blackTextBodyBySlide.map((x, idx) =>
				idx === i ? BLACK_TEXT_CAROUSEL_DEFAULTS.body : x,
			);
			bgImagesByTemplate = {
				...bgImagesByTemplate,
				blackText: (bgImagesByTemplate.blackText ?? []).map((x, idx) =>
					idx === i ? BLACK_TEXT_BG_DEFAULT : x,
				),
			};
		} else if (t === 'imageQuote') {
			imageQuoteTextBySlide = imageQuoteTextBySlide.map((x, idx) => (idx === i ? IMAGE_QUOTE_DEFAULTS.body : x));
			imageQuoteFooterLeftBySlide = imageQuoteFooterLeftBySlide.map((x, idx) => (idx === i ? IMAGE_QUOTE_DEFAULTS.footerLeft : x));
			imageQuoteFooterRightBySlide = imageQuoteFooterRightBySlide.map((x, idx) => (idx === i ? IMAGE_QUOTE_DEFAULTS.footerRight : x));
		}

		stylesByTemplateBySlide = {
			...stylesByTemplateBySlide,
			[t]: (stylesByTemplateBySlide[t] ?? []).map((m, idx) => (idx === i ? {} : m)),
		};
		slideMusic = slideMusic.map((m, idx) => (idx === i ? null : m));
		musicPickerForSlide = null;
		closeToolbar();
	}

	// Parse starter URL flags. Actual blank/template application runs in the auth `onMount` `.finally`
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
	afterNavigate(({ to }) => {
		const url = to?.url;
		if (!url) return;
		const pathNoTrailing = url.pathname.replace(/\/+$/, '') || '/';
		if (!pathNoTrailing.endsWith('/studio') || pathNoTrailing.includes('burn-music')) return;
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
		forcedTemplateFromQuery = next;
		if (!hasSaved && !hasDraft) {
			skipLatestWorkspaceDraftRestore = true;
			applyBlankCanvas();
			applyTemplateToAll(next);
			seedNewsStarterPlaceholderLayout();
		} else {
			applyTemplateToAll(next);
		}
	});

	// Convenience derived for current active slide text
	const overlayText = $derived(slides[activeSlide] ?? '');
	function setActiveSlideText(val: string) {
		if ((slides[activeSlide] ?? '') === val) return;
		slides = slides.map((s, i) => i === activeSlide ? val : s);
	}

	// Post data
	let source = $state('Markets');
	let sourceLogoSrc = $state(''); // optional logo for News "source label"
	let sourceLabelMode = $state<'text' | 'logo'>('text');
	/** Max width in px for source logo (News template). */
	let sourceLogoWidth = $state(260);
	let articleUrl = $state('');
	let articleTitle = $state('');

	// Background media — per template, per slide (keep EVERYTHING independent).
	let bgImagesByTemplate = $state<Record<TemplateId, string[]>>({
		blank: emptySlides(() => ''),
		news: emptySlides(() => ''),
		tweet: emptySlides(() => ''),
		article: emptySlides(() => ''),
		textCarousel: emptySlides(() => ''),
		imageQuote: emptySlides(() => ''),
		videoStory: emptySlides(() => ''),
		blackText: emptySlides(() => BLACK_TEXT_BG_DEFAULT),
	});
	let bgVideosByTemplate = $state<Record<TemplateId, string[]>>({
		blank: emptySlides(() => ''),
		news: emptySlides(() => ''),
		tweet: emptySlides(() => ''),
		article: emptySlides(() => ''),
		textCarousel: emptySlides(() => ''),
		imageQuote: emptySlides(() => ''),
		videoStory: emptySlides(() => ''),
		blackText: emptySlides(() => ''),
	}); // blob URLs — per template, per slide
	let generatingImagesByTemplate = $state<Record<TemplateId, boolean[]>>({
		blank: emptySlides(() => false),
		news: emptySlides(() => false),
		tweet: emptySlides(() => false),
		article: emptySlides(() => false),
		textCarousel: emptySlides(() => false),
		imageQuote: emptySlides(() => false),
		videoStory: emptySlides(() => false),
		blackText: emptySlides(() => false),
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

	// Per-slide music. Picking any track other than "No music" marks the slide
	// as a video (we burn the selected track onto the still image at publish
	// time). Users get a visual flame/▶ badge so they know this slide will be
	// posted as a video rather than a static image.
	type MusicTrack = { id: string; name: string; url?: string };
	const MUSIC_LIBRARY: MusicTrack[] = [
		{ id: 'lofi-chill',        name: 'Lo-fi Chill' },
		{ id: 'upbeat-corporate',  name: 'Upbeat Corporate' },
		{ id: 'cinematic-rise',    name: 'Cinematic Rise' },
		{ id: 'acoustic-mood',     name: 'Acoustic Mood' },
		{ id: 'electronic-pulse',  name: 'Electronic Pulse' },
		{ id: 'inspirational',     name: 'Inspirational Piano' },
		{ id: 'trap-beat',         name: 'Trap Beat' },
		{ id: 'jazz-cafe',         name: 'Jazz Cafe' },
	];
	let slideMusic = $state<(MusicTrack | null)[]>([]);
	let musicPickerForSlide = $state<number | null>(null); // which slide's picker is open
	const activeMusic = $derived(slideMusic[activeSlide] ?? null);

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

	async function ensureR2Resolved(refOrUrl: string) {
		await ensureR2RefLoaded(refOrUrl, r2ResolvedUrlByKey, r2Resolving, r2SignRead, (key, url) => {
			r2ResolvedUrlByKey = { ...r2ResolvedUrlByKey, [key]: url };
		});
	}

	function resolveMediaUrl(u: unknown): string {
		return resolveStoredMediaUrl(u, r2ResolvedUrlByKey);
	}

	const activeCutout = $derived(resolveMediaUrl(subjectCutouts[activeSlide] ?? ''));
	const activeShowCutout = $derived(showCutout[activeSlide] ?? false);
	const activeCutting = $derived(cuttingOut[activeSlide] ?? false);
	/** Primary news circle: per-slide visibility (slide 0 defaults on; add Shape on other slides if desired). */
	let showCircleBySlide = $state<boolean[]>(emptySlides((i) => i === 0));
	// Circle images are per-slide (so each slide can have its own badge photo).
	let circleImages = $state<string[]>([]);
	let circleBorderColor = $state('#FFFFFF');
	// Optional second circle is also per-slide.
	let showCircle2BySlide = $state<boolean[]>([]);
	let circle2Images = $state<string[]>([]);
	let circle2BorderColor = $state('#FFFFFF');
	let generatingCircle = $state(false);
	let bgError = $state('');

	const activeCircleImage = $derived(resolveMediaUrl(circleImages[activeSlide] ?? ''));
	const activeCircle2Image = $derived(resolveMediaUrl(circle2Images[activeSlide] ?? ''));
	const activeShowCircle2 = $derived(showCircle2BySlide[activeSlide] ?? false);

	// Convenience: active template's image / video (News uses these; other templates can too)
	const backgroundImage = $derived(resolveMediaUrl((bgImagesByTemplate[activeTemplate] ?? [])[activeSlide] ?? ''));
	const backgroundVideo = $derived((bgVideosByTemplate[activeTemplate] ?? [])[activeSlide] ?? '');
	/** URL used for “is there a video on this slide?” (includes Video Story’s default template clip when none is set). */
	const effectiveBackgroundVideo = $derived.by(() => {
		const v = String(backgroundVideo ?? '').trim();
		if (v) return v;
		if (activeTemplate === 'videoStory') return VIDEO_STORY_DEFAULTS.videoUrl;
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
		if (template === 'news' && String(url ?? '').trim()) {
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

	async function toExportSafeImageUrl(url: string) {
		const src = String(url ?? '').trim();
		if (!src) return '';
		if (src.startsWith('data:')) return src;
		if (src.startsWith('http://') || src.startsWith('https://')) {
			try {
				const res = await fetch('/api/media/to-data-url', {
					method: 'POST',
					headers: { 'content-type': 'application/json' },
					body: JSON.stringify({ url: src }),
				});
				const data = await res.json();
				if (res.ok && data?.ok && typeof data.dataUrl === 'string') return data.dataUrl;
			} catch {
				// ignore
			}
		}
		return src;
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
		if (template === 'news' && String(url ?? '').trim()) {
			newsSolidBgBySlide = Array.from({ length: slides.length }, (_, idx) =>
				idx === i ? '' : (newsSolidBgBySlide[idx] ?? '')
			);
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

	function clearSlideBackground(i: number) {
		const template = coerceTemplateId(slideTemplates[i] ?? lastTemplateUsed);
		const { images, videos } = templateMediaArraysPadded(template, i);
		const old = videos[i];
		if (old?.startsWith('blob:')) URL.revokeObjectURL(old);
		bgVideosByTemplate = { ...bgVideosByTemplate, [template]: videos.map((v, idx) => idx === i ? '' : v) };
		bgImagesByTemplate = { ...bgImagesByTemplate, [template]: images.map((img, idx) => idx === i ? '' : img) };
		if (template === 'news') {
			newsSolidBgBySlide = Array.from({ length: slides.length }, (_, idx) =>
				idx === i ? '' : (newsSolidBgBySlide[idx] ?? '')
			);
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
	/** Sidebar + fetch: when false, no `[[…]]` markup from AI and no highlight swatches on the floating text toolbar. */
	let studioTextHighlightsEnabled = $state(true);
	// Default to light-mode friendly; updated onMount to match global theme.
	let textColor = $state('#0a0a0a');
	let textColorTouched = $state(false);
	let uiTheme = $state<'light' | 'dark'>('light');

	const textCarouselDefaultAvatarBg = $derived(uiTheme === 'dark' ? '#0a0a0a' : '#ffffff');

	onMount(() => {
		// Track global theme changes (dashboard toggle updates <html data-theme="...">).
		const readTheme = (): 'light' | 'dark' => (document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light');
		uiTheme = readTheme();

		// If user hasn't manually set text color, keep it sensible per theme.
		if (!textColorTouched) {
			textColor = uiTheme === 'dark' ? '#FFFFFF' : '#0a0a0a';
		}

		const obs = new MutationObserver(() => {
			const next = readTheme();
			if (next === uiTheme) return;
			uiTheme = next;
			if (!textColorTouched) {
				textColor = uiTheme === 'dark' ? '#FFFFFF' : '#0a0a0a';
			}
		});
		obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
		return () => obs.disconnect();
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
	let bgOffsetX = $state(0); // horizontal focal point (≈0–100 typical; wider allowed)
	let bgOffsetY = $state(50); // vertical focal point
	let bgZoom    = $state(100); // background zoom %: <100 shrinks/letterboxes, >100 zooms in (cover mode only)
	let bgFitMode = $state<'cover' | 'contain'>('cover'); // contain = full image visible + optional magnify
	let bgContainMagnify = $state(100); // 50–200%, only when bgFitMode === 'contain'

	// Text panel drag (template px)
	let textPanelOffsetY = $state(0);
	let shadowHeight = $state(75);   // % of canvas covered by bottom shadow
	let shadowStrength = $state(1);  // 0–1 opacity multiplier

	// Image overlays — per slide, per template (so templates are independent)
	let slideOverlaysByTemplate = $state<Record<TemplateId, Overlay[][]>>({
		blank: emptySlides(() => []),
		news: emptySlides(() => []),
		tweet: emptySlides(() => []),
		article: emptySlides(() => []),
		textCarousel: emptySlides(() => []),
		imageQuote: emptySlides(() => []),
		videoStory: emptySlides(() => []),
		blackText: emptySlides(() => []),
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
	}

	function getTextOffset(i: number, kind: string): TextOffset {
		const row = textOffsetsBySlide[i] ?? {};
		const v = row[kind];
		return v && Number.isFinite(v.x) && Number.isFinite(v.y) ? v : { x: 0, y: 0 };
	}
	function setTextOffset(i: number, kind: string, next: TextOffset) {
		const cur = textOffsetsBySlide[i] ?? {};
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
		blackText: emptySlides(() => []),
	});
	const activeTextOverlays = $derived((slideTextOverlaysByTemplate[activeTemplate] ?? [])[activeSlide] ?? []);

	function setSlideTextOverlays(i: number, next: TextOverlay[], template: TemplateId = activeTemplate) {
		const cur = [...(slideTextOverlaysByTemplate[template] ?? [])];
		// Ensure the per-template overlay array is long enough for this slide index.
		while (cur.length <= i) cur.push([]);
		cur[i] = next;
		slideTextOverlaysByTemplate = { ...slideTextOverlaysByTemplate, [template]: cur };
	}

	function addSlide() {
		if (slides.length >= 10) return;
		// New slides should start with sensible defaults so the canvas doesn't look "broken".
		// For News, use the placeholder headline; for other templates keep it empty.
		const nextText = coerceTemplateId(lastTemplateUsed) === 'news' ? NEWS_PLACEHOLDER_HEADLINE : '';
		slides = [...slides, nextText];
		slideCount = slides.length;
		activeSlide = slides.length - 1;
		// Keep background media per-template, per-slide.
		bgImagesByTemplate = {
			blank: [...(bgImagesByTemplate.blank ?? []), ''],
			news: [...(bgImagesByTemplate.news ?? []), ''],
			tweet: [...(bgImagesByTemplate.tweet ?? []), ''],
			article: [...(bgImagesByTemplate.article ?? []), ''],
			textCarousel: [...(bgImagesByTemplate.textCarousel ?? []), ''],
			imageQuote: [...(bgImagesByTemplate.imageQuote ?? []), ''],
			videoStory: [...(bgImagesByTemplate.videoStory ?? []), ''],
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
			blackText: [...(generatingImagesByTemplate.blackText ?? []), false],
		};
		// Keep overlays strictly template-scoped (avoid any accidental shared references).
		slideOverlaysByTemplate = {
			blank: [...(slideOverlaysByTemplate.blank ?? []), []],
			news: [...(slideOverlaysByTemplate.news ?? []), []],
			tweet: [...(slideOverlaysByTemplate.tweet ?? []), []],
			article: [...(slideOverlaysByTemplate.article ?? []), []],
			textCarousel: [...(slideOverlaysByTemplate.textCarousel ?? []), []],
			imageQuote: [...(slideOverlaysByTemplate.imageQuote ?? []), []],
			videoStory: [...(slideOverlaysByTemplate.videoStory ?? []), []],
			blackText: [...(slideOverlaysByTemplate.blackText ?? []), []],
		};
		slideTextOverlaysByTemplate = {
			blank: [...(slideTextOverlaysByTemplate.blank ?? []), []],
			news: [...(slideTextOverlaysByTemplate.news ?? []), []],
			tweet: [...(slideTextOverlaysByTemplate.tweet ?? []), []],
			article: [...(slideTextOverlaysByTemplate.article ?? []), []],
			textCarousel: [...(slideTextOverlaysByTemplate.textCarousel ?? []), []],
			imageQuote: [...(slideTextOverlaysByTemplate.imageQuote ?? []), []],
			videoStory: [...(slideTextOverlaysByTemplate.videoStory ?? []), []],
			blackText: [...(slideTextOverlaysByTemplate.blackText ?? []), []],
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
		tweetTopAvatarInnerBgBySlide = [...tweetTopAvatarInnerBgBySlide, tweetTopAvatarInnerBgBySlide[tweetTopAvatarInnerBgBySlide.length - 1] ?? ''];
		tweetTopAvatarLabelBySlide = [...tweetTopAvatarLabelBySlide, tweetTopAvatarLabelBySlide[tweetTopAvatarLabelBySlide.length - 1] ?? ''];
		tweetBottomAvatarImageBySlide = [...tweetBottomAvatarImageBySlide, tweetBottomAvatarImageBySlide[tweetBottomAvatarImageBySlide.length - 1] ?? ''];
		tweetBottomAvatarInnerBgBySlide = [...tweetBottomAvatarInnerBgBySlide, tweetBottomAvatarInnerBgBySlide[tweetBottomAvatarInnerBgBySlide.length - 1] ?? ''];
		tweetBottomAvatarLabelBySlide = [...tweetBottomAvatarLabelBySlide, tweetBottomAvatarLabelBySlide[tweetBottomAvatarLabelBySlide.length - 1] ?? ''];
		articleTextBySlide = [...articleTextBySlide, articleTextBySlide[articleTextBySlide.length - 1] ?? ''];
		textCarouselTextBySlide = [...textCarouselTextBySlide, textCarouselTextBySlide[textCarouselTextBySlide.length - 1] ?? ''];
		imageQuoteTextBySlide = [...imageQuoteTextBySlide, imageQuoteTextBySlide[imageQuoteTextBySlide.length - 1] ?? ''];
		textCarouselNameBySlide = [...textCarouselNameBySlide, textCarouselNameBySlide[textCarouselNameBySlide.length - 1] ?? 'Captains of industry'];
		textCarouselHandleBySlide = [...textCarouselHandleBySlide, textCarouselHandleBySlide[textCarouselHandleBySlide.length - 1] ?? '@captainsofindustryy'];
		textCarouselAvatarImageBySlide = [
			...textCarouselAvatarImageBySlide,
			textCarouselAvatarImageBySlide[textCarouselAvatarImageBySlide.length - 1] ?? '',
		];
		textCarouselAvatarInnerBgBySlide = [
			...textCarouselAvatarInnerBgBySlide,
			textCarouselAvatarInnerBgBySlide[textCarouselAvatarInnerBgBySlide.length - 1] ?? '',
		];
		textCarouselAvatarLabelBySlide = [
			...textCarouselAvatarLabelBySlide,
			textCarouselAvatarLabelBySlide[textCarouselAvatarLabelBySlide.length - 1] ?? '',
		];
		imageQuoteFooterLeftBySlide = [...imageQuoteFooterLeftBySlide, imageQuoteFooterLeftBySlide[imageQuoteFooterLeftBySlide.length - 1] ?? '$'];
		imageQuoteFooterRightBySlide = [...imageQuoteFooterRightBySlide, imageQuoteFooterRightBySlide[imageQuoteFooterRightBySlide.length - 1] ?? 'BRAND'];
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
	}

	function addTextOverlay() {
		const idx = activeSlide;
		const current = (slideTextOverlaysByTemplate[activeTemplate] ?? [])[idx] ?? [];
		const next: TextOverlay = {
			id: crypto.randomUUID(),
			text: 'New text',
			x: 80,
			y: 260,
			w: 520,
			h: 64,
			style: { color: '#FFFFFF', fontSize: 42, fontWeight: 800, align: 'left', lineHeight: 1.1 },
		};
		setSlideTextOverlays(idx, [...current, next], activeTemplate);
		// Keep selection context so the toolbar can immediately target the overlay after it appears.
		selectedTextOverlayId = next.id;
		selectedText = 'textOverlay';
		try { console.debug('[studio] addTextOverlay', { template: activeTemplate, slide: idx, id: next.id }); } catch {}
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
		blackText: emptySlides(() => ({})),
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
	let tweetTopAvatarInnerBgBySlide = $state<string[]>(emptySlides(() => ''));
	let tweetTopAvatarLabelBySlide = $state<string[]>(emptySlides(() => ''));
	let tweetBottomAvatarImageBySlide = $state<string[]>(emptySlides(() => ''));
	let tweetBottomAvatarInnerBgBySlide = $state<string[]>(emptySlides(() => ''));
	let tweetBottomAvatarLabelBySlide = $state<string[]>(emptySlides(() => ''));
	let articleTextBySlide = $state<string[]>(
		emptySlides(
			() =>
				"Here's the trillion-dollar problem everyone avoids.\n\nTo break it down:\n\nA *1-gigawatt AI data center* costs roughly *$80B* to build & operate.",
		),
	);
	let textCarouselTextBySlide = $state<string[]>(
		emptySlides(
			() =>
				'Lead with a sharp hook on the first line.\n\nUse the second beat for proof, tone, or a CTA — keep it scannable.\n\nEnd with momentum — a reason to engage, click, or remember you.\n',
		),
	);
	let imageQuoteTextBySlide = $state<string[]>(
		emptySlides(() => 'YOUR BIG STATEMENT GOES HERE.\nMAKE IT SHORT, PUNCHY, AND ALL CAPS.'),
	);
	let textCarouselNameBySlide = $state<string[]>(emptySlides(() => 'Captains of industry'));
	let textCarouselHandleBySlide = $state<string[]>(emptySlides(() => '@captainsofindustryy'));
	/** Text carousel profile circle: image URL / inner fill / optional label (else initials from name). */
	let textCarouselAvatarImageBySlide = $state<string[]>(emptySlides(() => ''));
	let textCarouselAvatarInnerBgBySlide = $state<string[]>(emptySlides(() => ''));
	let textCarouselAvatarLabelBySlide = $state<string[]>(emptySlides(() => ''));
	let imageQuoteFooterLeftBySlide = $state<string[]>(emptySlides(() => '$'));
	let imageQuoteFooterRightBySlide = $state<string[]>(emptySlides(() => 'BRAND'));
	let articleSwipeTextBySlide = $state<string[]>(emptySlides(() => '«« Swipe'));
	/** Article bottom-bar logo image per slide (empty = template default glyph). */
	let articleLogoSrcBySlide = $state<string[]>(emptySlides(() => ''));

	let videoStoryHeadlineBySlide = $state<string[]>(emptySlides(() => VIDEO_STORY_DEFAULTS.headline));
	let videoStoryWatermarkBySlide = $state<string[]>(emptySlides(() => VIDEO_STORY_DEFAULTS.watermark));
	let blackTextHeadlineBySlide = $state<string[]>(emptySlides(() => BLACK_TEXT_CAROUSEL_DEFAULTS.headline));
	let blackTextBodyBySlide = $state<string[]>(emptySlides(() => BLACK_TEXT_CAROUSEL_DEFAULTS.body));

	// Stable ids per slide, used as keys for filmstrip reordering.
	let _slideUid = 0;
	function newSlideId() { return `s_${++_slideUid}_${Date.now().toString(36)}`; }
	let slideIds = $state<string[]>(emptySlides(() => newSlideId()));
	$effect(() => {
		// Keep slideIds length in sync with slideCount (pad only).
		// We intentionally avoid trimming here because it can make a slide
		// "disappear" if slideCount is temporarily out of sync during drag/drop.
		if (slideIds.length < slideCount) {
			const add: string[] = [];
			for (let i = slideIds.length; i < slideCount; i++) add.push(newSlideId());
			slideIds = [...slideIds, ...add];
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
		tweetTopAvatarInnerBgBySlide = pickOr(tweetTopAvatarInnerBgBySlide, '');
		tweetTopAvatarLabelBySlide = pickOr(tweetTopAvatarLabelBySlide, '');
		tweetBottomAvatarImageBySlide = pickOr(tweetBottomAvatarImageBySlide, '');
		tweetBottomAvatarInnerBgBySlide = pickOr(tweetBottomAvatarInnerBgBySlide, '');
		tweetBottomAvatarLabelBySlide = pickOr(tweetBottomAvatarLabelBySlide, '');
		articleTextBySlide = pickOr(articleTextBySlide, '');
		textCarouselTextBySlide = pickOr(textCarouselTextBySlide, '');
		imageQuoteTextBySlide = pickOr(imageQuoteTextBySlide, '');
		textCarouselNameBySlide = pickOr(textCarouselNameBySlide, 'Captains of industry');
		textCarouselHandleBySlide = pickOr(textCarouselHandleBySlide, '@captainsofindustryy');
		textCarouselAvatarImageBySlide = pickOr(textCarouselAvatarImageBySlide, '');
		textCarouselAvatarInnerBgBySlide = pickOr(textCarouselAvatarInnerBgBySlide, '');
		textCarouselAvatarLabelBySlide = pickOr(textCarouselAvatarLabelBySlide, '');
		imageQuoteFooterLeftBySlide = pickOr(imageQuoteFooterLeftBySlide, '$');
		imageQuoteFooterRightBySlide = pickOr(imageQuoteFooterRightBySlide, 'BRAND');
		videoStoryHeadlineBySlide = pickOr(videoStoryHeadlineBySlide, VIDEO_STORY_DEFAULTS.headline);
		videoStoryWatermarkBySlide = pickOr(videoStoryWatermarkBySlide, VIDEO_STORY_DEFAULTS.watermark);
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

	/** Remove the current slide (dock). Minimum one slide remains. */
	function deleteActiveSlide() {
		const n = slides.length;
		if (n <= 1) return;
		const del = activeSlide;
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
		tweetReplyCountBySlide = pickPerSlideArraysForOldIndices(keep, tweetReplyCountBySlide, '4.2K');
		tweetRepostCountBySlide = pickPerSlideArraysForOldIndices(keep, tweetRepostCountBySlide, '12.8K');
		tweetLikeCountBySlide = pickPerSlideArraysForOldIndices(keep, tweetLikeCountBySlide, '89.4K');
		tweetStylesBySlide = pickPerSlideArraysForOldIndices(keep, tweetStylesBySlide, {} as Partial<Record<TweetKind, TextStyle>>);
		circleImages = pickPerSlideArraysForOldIndices(keep, circleImages, '');
		circle2Images = pickPerSlideArraysForOldIndices(keep, circle2Images, '');
		showCircle2BySlide = pickPerSlideArraysForOldIndices(keep, showCircle2BySlide, false);
		showCircleBySlide = pickPerSlideArraysForOldIndices(keep, showCircleBySlide, false);
		textOffsetsBySlide = pickPerSlideArraysForOldIndices(keep, textOffsetsBySlide, {} as Record<string, TextOffset>);
		historyByTemplateBySlide = (Object.fromEntries(
			(Object.entries(historyByTemplateBySlide) as [TemplateId, ScopedHistory[]][]).map(([k, arr]) => [
				k,
				pickPerSlideArraysForOldIndices(keep, arr, { undo: [], redo: [] } as ScopedHistory),
			]),
		) as unknown) as Record<TemplateId, ScopedHistory[]>;

		showVideoTrim = false;
		videoSeekSec = NaN;
		closeToolbar();
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
		if (selectedText === 'articleImage' || selectedText === 'articleLogo') return {};
		if (selectedText === 'tweetTopMedia') return {};
		if (selectedText === 'tweetTopAvatar' || selectedText === 'tweetBottomAvatar') return {};
		if (isTweetKind(selectedText)) return (canvasTweetStyles[selectedText] ?? {});
		if (selectedText === 'textOverlay' && selectedTextOverlayId) {
			const current = (slideTextOverlaysByTemplate[previewTemplate] ?? [])[paintSlide] ?? [];
			return (current.find((o) => o.id === selectedTextOverlayId)?.style ?? {});
		}
		if (!selectedText) return canvasHeadlineStyle;
		return (
			canvasStyleMap[selectedText] ??
			(selectedText === 'source' ? canvasSourceStyle : canvasHeadlineStyle)
		);
	}

	// Currently selected text element + DOM anchor for the floating toolbar.
	let selectedText = $state<TextElementKind | null>(null);
	let selectedTextOverlayId = $state<string | null>(null);
	let toolbarAnchor = $state<DOMRect | null>(null);
	let toolbarTarget = $state<HTMLElement | null>(null);
	let toolbarAutoFontSize = $state<number | undefined>(undefined);

	function defaultFontSizeForKind(kind: TextElementKind): number | undefined {
		// These reflect the templates' visual defaults (used when no style override exists).
		switch (kind) {
			// News
			case 'source': return 34;
			case 'headline': return undefined; // News headline auto-sizes based on length

			// Article
			case 'articleBody': return 46;
			case 'articleSwipeText': return 28;
			case 'articleImage':
			case 'articleLogo':
				return undefined;

			// Text carousel
			case 'textCarouselName': return 46;
			case 'textCarouselHandle': return 36;
			case 'textCarouselBody': return 72;
			case 'textCarouselAvatar': return undefined;

			// Image quote
			case 'imageQuoteFooterLeft': return 44;
			case 'imageQuoteFooterRight': return 26;
			// headline kind is used for the quote body in that template; leave undefined here.

			// Tweet
			case 'tweetTopName': return 44;
			case 'tweetTopHandle': return 32;
			case 'tweetTopText': return 44;
			case 'tweetBottomName': return 44;
			case 'tweetBottomHandle': return 32;
			case 'tweetBottomText': return 44;
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

			case 'videoStoryHeadline': return 52;
			case 'videoStoryWatermark': return 22;
			case 'blackTextHeadline': return 52;
			case 'blackTextBody': return 34;
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
		if (selectedText === 'blackTextHeadline') return blackTextHeadlineBySlide[si] ?? '';
		if (selectedText === 'blackTextBody') return blackTextBodyBySlide[si] ?? '';
		return '';
	}

	const toolbarTextColorMixed = $derived.by(() => {
		if (!hasRangeSelection) return false;
		const range = selectedText === 'textOverlay' ? textOverlayRange : headlineRange;
		if (!range) return false;
		if (previewTemplate !== 'news') return false;
		if (selectedText !== 'headline' && selectedText !== 'textOverlay') return false;
		const raw = toolbarHighlightableRaw();
		if (!raw) return false;
		const base = getActiveStyleForSelection().color ?? textColor;
		return plainRangeHasMixedForegroundPaint(raw, range.start, range.end, highlightColor, base);
	});

	/** Text swatch reflects the selected range’s actual ink (not stale block `headlineStyle.color`, often #F5A623). */
	const toolbarFloatingStyle = $derived.by(() => {
		const base = getActiveStyleForSelection();
		if (!hasRangeSelection || toolbarTextColorMixed) return base;
		if (previewTemplate !== 'news' || (selectedText !== 'headline' && selectedText !== 'textOverlay')) return base;
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

	function onHighlight(spec: HighlightSpec) {
		if (!studioTextHighlightsEnabled) return;
		if (selectedText !== 'textOverlay') {
			const raw = toolbarHighlightableRaw();
			ensurePlainRangeForMarkupTools(raw);
		}
		const range = selectedText === 'textOverlay' ? textOverlayRange : headlineRange;
		if (!range) return;
		const start = range.start;
		const end = range.end;
		if (!(Number.isFinite(start) && Number.isFinite(end) && end > start)) return;

		const appliesMarkup =
			previewTemplate === 'news' &&
			(selectedText === 'headline' ||
				(selectedText === 'textOverlay' && !!selectedTextOverlayId));
		if (!appliesMarkup) return;

		pushUndo(activeTemplate, activeSlide);

		if (selectedText === 'headline') {
			const current =
				newsHeadlineLive !== null ? newsHeadlineLive : (slides[activeSlide] ?? '');
			const next = applyHighlight(current, start, end, spec);
			setActiveSlideText(next);
			if (newsHeadlineLive !== null) newsHeadlineLive = next;
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

	function onTextSelect(kind: TextElementKind, el: HTMLElement) {
		selectedText = kind;
		selectedTextOverlayId = kind === 'textOverlay' ? (el.dataset.textOverlayId ?? null) : null;
		toolbarTarget = el;
		toolbarAnchor = el.getBoundingClientRect();
		// Try to read the element's computed font-size. Some selections pass a wrapper/ghost
		// anchor, so also fall back to per-kind template defaults.
		toolbarAutoFontSize = defaultFontSizeForKind(kind);
		requestAnimationFrame(() => {
			try {
				const fs = getComputedStyle(el).fontSize;
				const n = parseFloat(fs);
				if (Number.isFinite(n) && n > 0) toolbarAutoFontSize = n;
			} catch {
				// keep fallback
			}
		});
		// Switching to a non-highlightable field drops any stale word-range selection.
		if (
			kind !== 'headline' &&
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

	/** Floating toolbar trash: remove overlay or clear the selected field’s text (all templates). */
	function handleFloatingToolbarDelete() {
		if (!canvasInteractive || !selectedText) return;
		const slide = paintSlide;
		const k = selectedText;

		if (k === 'textCarouselAvatar') return;
		if (k === 'tweetTopMedia') return;
		if (k === 'tweetTopAvatar' || k === 'tweetBottomAvatar') return;

		if (k === 'articleImage') {
			pushUndo(previewTemplate, slide);
			setSlideImage(slide, '', 'article');
			closeToolbar();
			return;
		}
		if (k === 'articleLogo') {
			pushUndo(previewTemplate, slide);
			articleLogoSrcBySlide = articleLogoSrcBySlide.map((x, i) => (i === slide ? '' : x));
			closeToolbar();
			return;
		}

		if (k === 'textOverlay') {
			if (!selectedTextOverlayId) return;
			pushUndo(previewTemplate, slide);
			const cur = (slideTextOverlaysByTemplate[previewTemplate] ?? [])[slide] ?? [];
			setSlideTextOverlays(
				slide,
				cur.filter((o) => o.id !== selectedTextOverlayId),
				previewTemplate,
			);
			closeToolbar();
			return;
		}

		const clearTextKinds = new Set<TextElementKind>([
			'headline',
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
			'blackTextHeadline',
			'blackTextBody',
		]);
		if (!clearTextKinds.has(k)) return;

		pushUndo(previewTemplate, slide);

		switch (k) {
			case 'headline':
				setActiveSlideText('');
				break;
			case 'source':
				source = '';
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

	/** Routes text/BG color to `[[…]]` markup when a phrase is selected in the DOM (even if state lost the range). */
	function onFloatingToolbarChange(patch: Partial<TextStyle>) {
		if (selectedText === 'articleImage' || selectedText === 'articleLogo') return;
		const raw = toolbarHighlightableRaw();
		if (
			studioTextHighlightsEnabled &&
			previewTemplate === 'news' &&
			selectedText === 'headline' &&
			raw &&
			selectedText !== 'textOverlay'
		) {
			if ('color' in patch && patch.color !== undefined) {
				ensurePlainRangeForMarkupTools(raw);
				if (headlineRange) {
					onHighlight({ kind: 'color', color: patch.color });
					return;
				}
			}
			if ('bgColor' in patch) {
				ensurePlainRangeForMarkupTools(raw);
				if (headlineRange) {
					const bg = patch.bgColor;
					if (bg === undefined || bg === 'transparent') onHighlight({ kind: 'clear' });
					else onHighlight({ kind: 'marker', color: bg });
					return;
				}
			}
		}
		patchActiveStyle(patch);
	}

	function patchActiveStyle(patch: Partial<TextStyle>) {
		if (selectedText === 'articleImage' || selectedText === 'articleLogo') return;
		if (
			selectedText === 'textCarouselAvatar' ||
			selectedText === 'tweetTopAvatar' ||
			selectedText === 'tweetBottomAvatar' ||
			selectedText === 'tweetTopMedia'
		)
			return;
		pushUndo(previewTemplate, paintSlide);
		const kindPre = selectedText;
		const slotPre = kindPre ? canvasStyleMap[kindPre] : undefined;

		if (isTweetKind(selectedText)) {
			tweetStylesBySlide = tweetStylesBySlide.map((s, i) => {
				if (i !== paintSlide) return s;
				const cur = s ?? {};
				const k: TweetKind = selectedText as TweetKind;
				return { ...cur, [k]: { ...((cur as any)[k] ?? {}), ...patch } };
			});
		} else if (selectedText === 'textOverlay' && selectedTextOverlayId) {
			const current = (slideTextOverlaysByTemplate[previewTemplate] ?? [])[paintSlide] ?? [];
			setSlideTextOverlays(
				paintSlide,
				current.map((o) => (o.id === selectedTextOverlayId ? { ...o, style: { ...(o.style ?? {}), ...patch } } : o)),
				previewTemplate,
			);
		} else if (selectedText) {
			const k = selectedText as TextElementKind;
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
		}
		if (patch.fontFamily != null || patch.fontWeight != null) {
			const family =
				patch.fontFamily ??
				slotPre?.fontFamily ??
				(kindPre === 'textCarouselBody' ? 'Lexend' : undefined);
			const weight = patch.fontWeight ?? slotPre?.fontWeight ?? 400;
			/* Run font hints after Svelte flushes the new `font-weight` to the canvas so the change feels instant. */
			if (family) void tick().then(() => void loadGoogleFont(family, weight));
		}
		// Re-anchor on next frame so the toolbar follows size changes.
		requestAnimationFrame(() => {
			if (toolbarTarget) toolbarAnchor = toolbarTarget.getBoundingClientRect();
		});
	}

	// Export
	let exporting = $state(false);
	let exportingAll = $state(false);
	let exportRef: HTMLElement | null = $state(null);

	// ── Output format (canvas size) ───────────────────────────────────────
	type FormatId = 'feed' | 'vertical' | 'wide' | 'square';
	type Format = { id: FormatId; label: string; w: number; h: number; igType: 'post' | 'reel' | 'story' };
	const FORMATS: Format[] = [
		{ id: 'feed', label: 'FEED (4:5)', w: 1080, h: 1350, igType: 'post' },
		{ id: 'vertical', label: 'VERTICAL (9:16)', w: 1080, h: 1920, igType: 'reel' },
		{ id: 'wide', label: 'WIDE (16:9)', w: 1920, h: 1080, igType: 'post' },
		{ id: 'square', label: 'SQUARE (1:1)', w: 1080, h: 1080, igType: 'post' },
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
	const previewCanvasOverflowClass = $derived(studioTemplateRuntime(previewTemplate).canvasOverflowClass);
	const canvasInteractive = $derived(canvasRasterSlide === null);

	/** Mirrors News headline markup during inline edit so `slides` isn't rewritten every keystroke (avoids full preview flicker). */
	let newsHeadlineLive = $state<string | null>(null);

	const canvasOverlayText = $derived(
		newsHeadlineLive !== null ? newsHeadlineLive : (slides[paintSlide] ?? ''),
	);
	const canvasBackgroundImage = $derived(resolveMediaUrl((bgImagesByTemplate[previewTemplate] ?? [])[paintSlide] ?? ''));
	const canvasBackgroundVideo = $derived((bgVideosByTemplate[previewTemplate] ?? [])[paintSlide] ?? '');
	const canvasVideoTrimStart = $derived(videoTrimStartSecBySlide[paintSlide] ?? 0);
	const canvasVideoTrimEnd = $derived(videoTrimEndSecBySlide[paintSlide] ?? 0);
	const canvasVideoDuration = $derived(videoDurationBySlide[paintSlide] ?? 0);
	const canvasVideoMuted = $derived(videoMutedBySlide[paintSlide] ?? true);
	const canvasVideoVolume = $derived(videoVolumeBySlide[paintSlide] ?? 0.8);
	const canvasCutout = $derived(resolveMediaUrl(subjectCutouts[paintSlide] ?? ''));
	const canvasShowCutout = $derived(showCutout[paintSlide] ?? false);
	const canvasCircleImg = $derived(resolveMediaUrl(circleImages[paintSlide] ?? ''));
	const canvasCircle2Img = $derived(resolveMediaUrl(circle2Images[paintSlide] ?? ''));
	const canvasShowCircle2 = $derived(showCircle2BySlide[paintSlide] ?? false);
	const canvasShowPrimaryCircle = $derived(showCircleBySlide[paintSlide] ?? false);
	const canvasOverlays = $derived((slideOverlaysByTemplate[previewTemplate] ?? [])[paintSlide] ?? []);
	const canvasTextOverlays = $derived((slideTextOverlaysByTemplate[previewTemplate] ?? [])[paintSlide] ?? []);
	const canvasStyleMap = $derived((stylesByTemplateBySlide[previewTemplate] ?? [])[paintSlide] ?? {});
	const canvasHeadlineStyle = $derived(canvasStyleMap.headline ?? {});
	const canvasSourceStyle = $derived(canvasStyleMap.source ?? {});
	const canvasVideoStoryHeadlineStyle = $derived(canvasStyleMap.videoStoryHeadline ?? {});
	const canvasVideoStoryWatermarkStyle = $derived(canvasStyleMap.videoStoryWatermark ?? {});
	const canvasBlackTextHeadlineStyle = $derived(canvasStyleMap.blackTextHeadline ?? {});
	const canvasBlackTextBodyStyle = $derived(canvasStyleMap.blackTextBody ?? {});
	const canvasTweetStyles = $derived(tweetStylesBySlide[paintSlide] ?? {});

	/** News / image-quote headlines sit on dark or busy photos — base ink is white. Per-headline `headlineStyle.color` from the toolbar still overrides in `NewsTemplate`. */
	const canvasHeadlineInk = $derived(
		previewTemplate === 'news' || previewTemplate === 'imageQuote' || previewTemplate === 'blackText'
			? '#FFFFFF'
			: textColor,
	);

	/** Full-canvas loading overlay: article fetch/fill/variants or any slide still generating for the previewed template. */
	const studioCanvasBusyLoading = $derived(
		fetchingNews ||
			generatingVariants ||
			studioImageGenPaintHold ||
			(generatingImagesByTemplate[previewTemplate] ?? []).some((g) => !!g),
	);

	// ── Draft persistence (Supabase) ──────────────────────────────────────
	type DraftRow = { id: string; kind: string; state: any; updated_at: string };
	/** Workspace draft rows — keep in sync with `STUDIO_WORKSPACE_DRAFT_KIND` on `carousels/+page.svelte`. */
	const DRAFT_KIND = 'news_studio';
	/** Named snapshots from Studio — listed on the dashboard; open with `?saved=<id>`. */
	const STUDIO_SAVED_TEMPLATE_KIND = 'studio_saved_template';
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
	let draftSaving = $state(false);
	let draftError = $state('');
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
		if (typeof s.formatId === 'string') formatId = normalizeStudioFormatId(s.formatId);
		if (typeof s.lastTemplateUsed === 'string') lastTemplateUsed = coerceTemplateId(s.lastTemplateUsed);
		if (Array.isArray(s.slides)) slides = s.slides;
		if (typeof s.activeSlide === 'number') activeSlide = Math.max(0, Math.min((s.slides?.length ?? slides.length) - 1, s.activeSlide));
		if (typeof s.category === 'string') category = s.category;
		if (s.newsContentMode === 'news' || s.newsContentMode === 'fact' || s.newsContentMode === 'story') {
			newsContentMode = s.newsContentMode;
		}
		if (typeof s.storyCategory === 'string') storyCategory = s.storyCategory;
		if (typeof (s as any).factTopicPrompt === 'string') factTopicPrompt = String((s as any).factTopicPrompt ?? '');
		if (typeof (s as any).storyTopicPrompt === 'string') storyTopicPrompt = String((s as any).storyTopicPrompt ?? '');
		if (typeof s.search === 'string') search = s.search;
		if (typeof s.source === 'string') source = s.source;
		if (typeof (s as any).sourceLogoSrc === 'string') sourceLogoSrc = String((s as any).sourceLogoSrc ?? '').trim();
		if ((s as any).sourceLabelMode === 'text' || (s as any).sourceLabelMode === 'logo') {
			sourceLabelMode = (s as any).sourceLabelMode;
		}
		const slw = Number((s as any).sourceLogoWidth);
		if (Number.isFinite(slw)) sourceLogoWidth = Math.round(Math.max(80, Math.min(400, slw)));
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
		// If user came from a starter-template deep link, override any saved draft template.
		if (forcedTemplateFromQuery) applyTemplateToAll(forcedTemplateFromQuery);
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
			bgImagesByTemplate = (s as any).bgImagesByTemplate;
		}
		if ((s as any).bgVideosByTemplate && typeof (s as any).bgVideosByTemplate === 'object') {
			bgVideosByTemplate = (s as any).bgVideosByTemplate;
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
				blackText: (raw.blackText ?? []).map((row) => (row ?? []).map((o) => ({ ...(o as any) }))),
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
				blackText: (raw.blackText ?? []).map((row) => (row ?? []).map((t) => ({ ...(t as any), style: { ...(((t as any).style ?? {}) as any) } }))),
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
				news: norm(raw.news),
				tweet: norm(raw.tweet),
				article: norm(raw.article),
				textCarousel: norm(raw.textCarousel),
				imageQuote: norm(raw.imageQuote),
				videoStory: norm(raw.videoStory),
				blackText: norm(raw.blackText),
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
		if (Array.isArray((s as any).tweetTopAvatarInnerBgBySlide)) {
			tweetTopAvatarInnerBgBySlide = (s as any).tweetTopAvatarInnerBgBySlide.map((x: unknown) => String(x ?? ''));
		}
		if (Array.isArray((s as any).tweetTopAvatarLabelBySlide)) {
			tweetTopAvatarLabelBySlide = (s as any).tweetTopAvatarLabelBySlide.map((x: unknown) => String(x ?? ''));
		}
		if (Array.isArray((s as any).tweetBottomAvatarImageBySlide)) {
			tweetBottomAvatarImageBySlide = (s as any).tweetBottomAvatarImageBySlide.map((x: unknown) => String(x ?? ''));
		}
		if (Array.isArray((s as any).tweetBottomAvatarInnerBgBySlide)) {
			tweetBottomAvatarInnerBgBySlide = (s as any).tweetBottomAvatarInnerBgBySlide.map((x: unknown) => String(x ?? ''));
		}
		if (Array.isArray((s as any).tweetBottomAvatarLabelBySlide)) {
			tweetBottomAvatarLabelBySlide = (s as any).tweetBottomAvatarLabelBySlide.map((x: unknown) => String(x ?? ''));
		}
		if (Array.isArray(s.articleTextBySlide)) articleTextBySlide = s.articleTextBySlide;
		if (Array.isArray(s.textCarouselTextBySlide)) {
			textCarouselTextBySlide = s.textCarouselTextBySlide.map((x: unknown) =>
				ensureTextCarouselBodyMinLength(String(x ?? '')),
			);
		}
		if (Array.isArray((s as any).videoStoryHeadlineBySlide)) {
			videoStoryHeadlineBySlide = (s as any).videoStoryHeadlineBySlide.map((x: unknown) => String(x ?? ''));
		}
		if (Array.isArray((s as any).videoStoryWatermarkBySlide)) {
			videoStoryWatermarkBySlide = (s as any).videoStoryWatermarkBySlide.map((x: unknown) => String(x ?? ''));
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
		if (Array.isArray((s as any).textCarouselAvatarInnerBgBySlide)) {
			textCarouselAvatarInnerBgBySlide = (s as any).textCarouselAvatarInnerBgBySlide.map((x: unknown) => String(x ?? ''));
		}
		if (Array.isArray((s as any).textCarouselAvatarLabelBySlide)) {
			textCarouselAvatarLabelBySlide = (s as any).textCarouselAvatarLabelBySlide.map((x: unknown) => String(x ?? ''));
		}
		if (Array.isArray(s.imageQuoteFooterLeftBySlide)) imageQuoteFooterLeftBySlide = s.imageQuoteFooterLeftBySlide;
		if (Array.isArray(s.imageQuoteFooterRightBySlide)) imageQuoteFooterRightBySlide = s.imageQuoteFooterRightBySlide;
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
		if (typeof s.shadowHeight === 'number') shadowHeight = s.shadowHeight;
		if (typeof s.shadowStrength === 'number') shadowStrength = s.shadowStrength;
		if (typeof s.highlightColor === 'string') highlightColor = s.highlightColor;
		if (typeof s.studioTextHighlightsEnabled === 'boolean') studioTextHighlightsEnabled = s.studioTextHighlightsEnabled;
		if (typeof s.textColor === 'string') textColor = s.textColor;
		// Intentionally do NOT restore `exportedSlides` (huge data URLs) from drafts.
		// slideCount is derived from slides.length; do not restore it directly.

		// Empty hook copy + white solid fill (common in partial saves) reads as a "broken" blank canvas.
		if (
			!forcedBlankFromQuery &&
			slides.length > 0 &&
			coerceTemplateId(slideTemplates[0]) === 'news' &&
			!String(slides[0] ?? '').trim()
		) {
			slides = slides.map((row, i) => (i === 0 ? NEWS_PLACEHOLDER_HEADLINE : row));
		}
	}

	function applyBlankCanvas() {
		lastTemplateUsed = 'blank';
		applyTemplateToAll('blank');
		slideTemplates = ['blank'];
		slides = [''];
		activeSlide = 0;
		slideCount = 1;
		source = '';
		search = '';
		articleUrl = '';
		articleTitle = '';
		articleSnippet = '';
		newsContentMode = 'news';

		const emptyMediaUrls = (): Record<TemplateId, string[]> => ({
			blank: [''],
			news: [''],
			tweet: [''],
			article: [''],
			textCarousel: [''],
			imageQuote: [''],
			videoStory: [''],
			blackText: [''],
		});
		bgImagesByTemplate = { ...emptyMediaUrls(), blackText: [BLACK_TEXT_BG_DEFAULT] };
		bgVideosByTemplate = emptyMediaUrls();
		generatingImagesByTemplate = {
			blank: [false],
			news: [false],
			tweet: [false],
			article: [false],
			textCarousel: [false],
			imageQuote: [false],
			videoStory: [false],
			blackText: [false],
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
			blackText: [[]],
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
			blackText: [[]],
		};

		stylesByTemplateBySlide = {
			blank: [{}],
			news: [{}],
			tweet: [{}],
			article: [{}],
			textCarousel: [{}],
			imageQuote: [{}],
			videoStory: [{}],
			blackText: [{}],
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
		tweetTopAvatarInnerBgBySlide = [''];
		tweetTopAvatarLabelBySlide = [''];
		tweetBottomAvatarImageBySlide = [''];
		tweetBottomAvatarInnerBgBySlide = [''];
		tweetBottomAvatarLabelBySlide = [''];
		articleTextBySlide = [''];
		articleSwipeTextBySlide = [''];
		articleLogoSrcBySlide = [''];
		textCarouselTextBySlide = [''];
		textCarouselNameBySlide = [''];
		textCarouselHandleBySlide = [''];
		textCarouselAvatarImageBySlide = [''];
		textCarouselAvatarInnerBgBySlide = [''];
		textCarouselAvatarLabelBySlide = [''];
		imageQuoteTextBySlide = [''];
		imageQuoteFooterLeftBySlide = [''];
		imageQuoteFooterRightBySlide = [''];
		videoStoryHeadlineBySlide = [VIDEO_STORY_DEFAULTS.headline];
		videoStoryWatermarkBySlide = [VIDEO_STORY_DEFAULTS.watermark];
		blackTextHeadlineBySlide = [BLACK_TEXT_CAROUSEL_DEFAULTS.headline];
		blackTextBodyBySlide = [BLACK_TEXT_CAROUSEL_DEFAULTS.body];

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
		shadowHeight = 0;
		shadowStrength = 0;

		historyByTemplateBySlide = {
			blank: [{ undo: [], redo: [] }],
			news: [{ undo: [], redo: [] }],
			tweet: [{ undo: [], redo: [] }],
			article: [{ undo: [], redo: [] }],
			textCarousel: [{ undo: [], redo: [] }],
			imageQuote: [{ undo: [], redo: [] }],
			videoStory: [{ undo: [], redo: [] }],
			blackText: [{ undo: [], redo: [] }],
		};

		draftId = '';
		draftError = '';
		draftPreviewUrl = '';
		draftPreviewKey = '';
		closeToolbar();
	}

	/** `applyBlankCanvas()` resets headline/solid fills, kills shadow, and hides the circle chrome — restore readable News starters (gradient, hook circle ring, vignette). */
	function seedNewsStarterPlaceholderLayout() {
		if (coerceTemplateId(slideTemplates[0] ?? 'news') !== 'news') return;
		while (slides.length < DEFAULT_STUDIO_SLIDE_COUNT) addSlide();
		const n = Math.max(1, slides.length);
		slides = slides.map((row, i) =>
			String(row ?? '').trim() ? row : i === 0 ? NEWS_PLACEHOLDER_HEADLINE : row
		);
		if (!String(source ?? '').trim()) source = NEWS_DEFAULT_SOURCE;
		newsSolidBgBySlide = Array.from({ length: n }, () => '');
		// Match default hook behaviour: badge on slide 1 only until user adds elsewhere.
		showCircleBySlide = Array.from({ length: n }, (_, i) => i === 0);
		shadowHeight = NEWS_DEFAULT_LAYOUT.shadowHeight;
		shadowStrength = NEWS_DEFAULT_LAYOUT.shadowStrength;
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
			draftError = error.message ?? 'Failed to load draft';
			return;
		}
		if (!data) return;

		const row = data as DraftRow;
		draftId = row.id;
		const s = row.state ?? {};
		// If an older draft contains huge `exportedSlides` data URLs, prune it ASAP so
		// subsequent loads are fast (don’t block initial render on this).
		if (Array.isArray((s as any).exportedSlides) && (s as any).exportedSlides.length) {
			const ex = (s as any).exportedSlides as unknown[];
			const looksHuge = ex.some((v) => typeof v === 'string' && v.startsWith('data:') && v.length > 220_000);
			if (looksHuge) {
				queueMicrotask(() => {
					try {
						void (supabase as any)
							.from('drafts')
							.update({ state: { ...(s as any), exportedSlides: [] } })
							.eq('id', row.id);
					} catch {
						// ignore
					}
				});
			}
		}

		applyDraftState(s as Record<string, any>);
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
			draftError = error.message ?? 'Failed to load draft';
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
		if (Array.isArray((s as any).exportedSlides) && (s as any).exportedSlides.length) {
			const ex = (s as any).exportedSlides as unknown[];
			const looksHuge = ex.some((v) => typeof v === 'string' && v.startsWith('data:') && v.length > 220_000);
			if (looksHuge) {
				queueMicrotask(() => {
					try {
						void (supabase as any)
							.from('drafts')
							.update({ state: { ...(s as any), exportedSlides: [] } })
							.eq('id', row.id);
					} catch {
						// ignore
					}
				});
			}
		}

		applyDraftState(s as Record<string, any>);
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
		// Resolve any saved-template R2 refs needed for rendering.
		queueMicrotask(() => {
			try {
				void resolveAllR2RefsInStudioState();
			} catch {
				// ignore
			}
		});
		// Next autosave should target the workspace draft, not overwrite the named template row.
		draftId = '';
		slideCount = slides.length;
		exportedSlides = [];
	}

	async function resolveAllR2RefsInStudioState() {
		await prefetchAllR2RefsInStudioMedia(ensureR2Resolved, {
			bgImagesByTemplate,
			circleImages,
			circle2Images,
			subjectCutouts,
			slideOverlaysByTemplate,
		});
	}

	async function saveStudioTemplateNamed() {
		if (!userId) return;
		const name = studioTemplateName.trim() || `Studio template ${new Date().toLocaleDateString()}`;
		studioTemplateSaving = true;
		studioTemplateFeedback = '';

		// Use the exact same export pipeline as the bottom-right Export/Post button.
		// This avoids subtle races with the filmstrip capture and guarantees "what you see"
		// matches the stored preview.
		let previewPng: string | null = null;
		try {
			const n = await exportAllSlidesToDraft();
			previewPng = n > 0 ? (exportedSlides[0] ?? null) : null;
		} catch {
			previewPng = null;
		}

		await materializeBlobUrlsForDraftSave();
		let state: Record<string, any> = { ...buildDraftState('template'), _templateName: name };
		const { data, error } = await (supabase as any).from('drafts').insert({
			user_id: userId,
			kind: STUDIO_SAVED_TEMPLATE_KIND,
			state,
		}).select('id').single();
		if (error) {
			studioTemplateSaving = false;
			studioTemplateFeedback = error.message ?? 'Save failed';
			return;
		}
		const templateId = String(data?.id ?? '').trim();

		let r2Note = '';
		// Upload all embedded images to R2 and rewrite template state to `r2:<key>` refs.
		if (templateId) {
			try {
				state = await uploadTemplateMediaToR2AndRewriteState(templateId, state);
				await (supabase as any)
					.from('drafts')
					.update({ state })
					.eq('id', templateId)
					.eq('user_id', userId)
					.eq('kind', STUDIO_SAVED_TEMPLATE_KIND);
			} catch (e: unknown) {
				const msg = e instanceof Error ? e.message : String(e);
				r2Note = ` R2 media upload warning: ${msg}`;
			}
		}

		// Upload preview via same-origin /api/r2/upload (server writes to R2 — no browser CORS to R2).
		if (templateId) {
			if (!previewPng) {
				r2Note =
					' Note: First-slide preview was not exported, so nothing was uploaded to R2. Try Export first or ensure slides render.';
			} else {
				try {
					const key = `${userId}/templates/${templateId}.png`;
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
						.eq('user_id', userId)
						.eq('kind', STUDIO_SAVED_TEMPLATE_KIND);
				} catch (e: unknown) {
					const msg = e instanceof Error ? e.message : String(e);
					r2Note = ` R2 error: ${msg}. Check .env R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET — restart dev after changes.`;
				}
			}
		}
		studioTemplateSaving = false;
		studioTemplateFeedback =
			`Saved. Find it under Carousels → “Saved Studio templates”.${r2Note}`;
		// Keep the panel open so the user can see the success message (and any errors).
		// showSaveTemplatePanel = false;
		// studioTemplateName = '';
	}

	function extFromMime(mime: string): string {
		const m = String(mime ?? '').toLowerCase();
		if (m.includes('png')) return 'png';
		if (m.includes('jpeg') || m.includes('jpg')) return 'jpg';
		if (m.includes('webp')) return 'webp';
		return 'bin';
	}

	async function uploadDataUrlToR2Key(dataUrl: string, key: string) {
		const blob = await (await fetch(dataUrl)).blob();
		await r2UploadBlob({ key, blob, filename: `asset.${extFromMime(blob.type)}` });
	}

	function isImageDataUrl(u: unknown): u is string {
		return typeof u === 'string' && u.startsWith('data:image/');
	}

	async function uploadTemplateMediaToR2AndRewriteState(templateId: string, state: Record<string, any>) {
		const out = { ...(state ?? {}) } as Record<string, any>;
		const base = `${userId}/templates/${templateId}`;

		// Background images (by template, by slide)
		if (out.bgImagesByTemplate && typeof out.bgImagesByTemplate === 'object') {
			const next: Record<string, string[]> = { ...(out.bgImagesByTemplate ?? {}) };
			for (const tpl of Object.keys(next)) {
				const arr = Array.isArray(next[tpl]) ? [...next[tpl]] : [];
				for (let i = 0; i < arr.length; i++) {
					const u = arr[i];
					if (isImageDataUrl(u)) {
						const mime = u.slice(5, u.indexOf(';'));
						const key = `${base}/bg/${tpl}/${i}.${extFromMime(mime)}`;
						await uploadDataUrlToR2Key(u, key);
						arr[i] = `r2:${key}`;
					}
				}
				next[tpl] = arr;
			}
			out.bgImagesByTemplate = next;
		}

		// Circle images
		if (Array.isArray(out.circleImages)) {
			const arr = [...out.circleImages];
			for (let i = 0; i < arr.length; i++) {
				const u = arr[i];
				if (isImageDataUrl(u)) {
					const mime = u.slice(5, u.indexOf(';'));
					const key = `${base}/circle/${i}.${extFromMime(mime)}`;
					await uploadDataUrlToR2Key(u, key);
					arr[i] = `r2:${key}`;
				}
			}
			out.circleImages = arr;
		}
		if (Array.isArray(out.circle2Images)) {
			const arr = [...out.circle2Images];
			for (let i = 0; i < arr.length; i++) {
				const u = arr[i];
				if (isImageDataUrl(u)) {
					const mime = u.slice(5, u.indexOf(';'));
					const key = `${base}/circle2/${i}.${extFromMime(mime)}`;
					await uploadDataUrlToR2Key(u, key);
					arr[i] = `r2:${key}`;
				}
			}
			out.circle2Images = arr;
		}

		// Subject cutouts (PNG data URLs)
		if (Array.isArray(out.subjectCutouts)) {
			const arr = [...out.subjectCutouts];
			for (let i = 0; i < arr.length; i++) {
				const u = arr[i];
				if (isImageDataUrl(u)) {
					const mime = u.slice(5, u.indexOf(';'));
					const key = `${base}/cutout/${i}.${extFromMime(mime)}`;
					await uploadDataUrlToR2Key(u, key);
					arr[i] = `r2:${key}`;
				}
			}
			out.subjectCutouts = arr;
		}

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
						if (isImageDataUrl(src)) {
							const mime = src.slice(5, src.indexOf(';'));
							const key = `${base}/overlay/${tpl}/${s}-${j}.${extFromMime(mime)}`;
							await uploadDataUrlToR2Key(src, key);
							o.src = `r2:${key}`;
						}
						row[j] = o;
					}
					slides[s] = row;
				}
				next[tpl] = slides;
			}
			out.slideOverlaysByTemplate = next;
		}

		// Avatar / logo images used by templates (best effort)
		for (const field of [
			'tweetTopAvatarImageBySlide',
			'tweetBottomAvatarImageBySlide',
			'textCarouselAvatarImageBySlide',
			'articleLogoSrcBySlide',
		] as const) {
			if (Array.isArray((out as any)[field])) {
				const arr = [...((out as any)[field] as string[])];
				for (let i = 0; i < arr.length; i++) {
					const u = arr[i];
					if (isImageDataUrl(u)) {
						const mime = u.slice(5, u.indexOf(';'));
						const key = `${base}/asset/${field}/${i}.${extFromMime(mime)}`;
						await uploadDataUrlToR2Key(u, key);
						arr[i] = `r2:${key}`;
					}
				}
				(out as any)[field] = arr;
			}
		}

		return out;
	}

	/** ~1.2M chars ≈ under 1MB base64 — full-bleed Vertex JPEGs often exceed the old 220k cap. */
	const DRAFT_MAX_DATA_URL_CHARS = 1_200_000;
	/** Templates should preserve backgrounds across slides; allow much larger embedded media. */
	const TEMPLATE_MAX_DATA_URL_CHARS = 8_000_000;

	function buildDraftState(mode: 'draft' | 'template' = 'draft') {
		const maxDataUrlChars = mode === 'template' ? TEMPLATE_MAX_DATA_URL_CHARS : DRAFT_MAX_DATA_URL_CHARS;
		// Avoid saving huge/persistent-less URLs that can freeze restore.
		const pruneMediaUrl = (u: unknown) => {
			if (typeof u !== 'string') return '';
			const s = u.trim();
			if (!s) return '';
			// blob: URLs don’t survive reload and can get large in drafts.
			if (s.startsWith('blob:')) return '';
			// Very large data URLs make draft JSON huge and slow to restore.
			if (s.startsWith('data:') && s.length > maxDataUrlChars) return '';
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
			storyCategory,
			factTopicPrompt,
			storyTopicPrompt,
			search,
			source,
			sourceLogoSrc,
			sourceLabelMode,
			sourceLogoWidth,
			articleUrl,
			articleTitle,
			articleSnippet,
			activeSlide,
			slides,
			slideTemplates,
			bgImagesByTemplate: pruneMediaMap(bgImagesByTemplate as any),
			bgVideosByTemplate: pruneMediaMap(bgVideosByTemplate as any),
			newsSolidBgBySlide,
			generatingImagesByTemplate,
			videoTrimStartSecBySlide,
			videoTrimEndSecBySlide,
			videoDurationBySlide,
			videoMutedBySlide,
			videoVolumeBySlide,
			textOffsetsBySlide,
			slideOverlaysByTemplate,
			slideTextOverlaysByTemplate,
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
			tweetTopAvatarInnerBgBySlide,
			tweetTopAvatarLabelBySlide,
			tweetBottomAvatarImageBySlide: tweetBottomAvatarImageBySlide.map(pruneMediaUrl),
			tweetBottomAvatarInnerBgBySlide,
			tweetBottomAvatarLabelBySlide,
			articleTextBySlide,
			textCarouselTextBySlide,
			videoStoryHeadlineBySlide,
			videoStoryWatermarkBySlide,
			blackTextHeadlineBySlide,
			blackTextBodyBySlide,
			imageQuoteTextBySlide,
			textCarouselNameBySlide,
			textCarouselHandleBySlide,
			textCarouselAvatarImageBySlide: textCarouselAvatarImageBySlide.map(pruneMediaUrl),
			textCarouselAvatarInnerBgBySlide,
			textCarouselAvatarLabelBySlide,
			imageQuoteFooterLeftBySlide,
			imageQuoteFooterRightBySlide,
			articleSwipeTextBySlide,
			articleLogoSrcBySlide: articleLogoSrcBySlide.map(pruneMediaUrl),
			slideIds,
			subjectCutouts,
			showCutout,
			slideMusic,
			showCircleBySlide,
			circleImages,
			circleBorderColor,
			showCircle2BySlide,
			circle2Images,
			circle2BorderColor,
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
			shadowStrength,
			highlightColor,
			studioTextHighlightsEnabled,
			textColor,
			draftPreviewUrl,
			draftPreviewKey: draftPreviewKey.trim(),
			draftPreviewPath: draftPreviewKey.trim(),
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

	type SaveDraftNowOpts = { captureThumbnail?: boolean };

	/** Persist workspace draft (invoked when saving templates or other explicit flows). */
	async function saveDraftNow(opts?: SaveDraftNowOpts) {
		if (!userId) return;
		const captureThumbnail = opts?.captureThumbnail === true;
		draftSaving = true;
		draftError = '';
		await materializeBlobUrlsForDraftSave();

		const rowId = draftId || crypto.randomUUID();
		let nextPreviewUrl = draftPreviewUrl;
		let nextPreviewKey = draftPreviewKey;
		if (captureThumbnail) {
			try {
				const thumbDataUrl = await captureDraftThumbnailDataUrl();
				if (thumbDataUrl) {
					const key = `${userId}/${rowId}.png`;
					const blob = await (await fetch(thumbDataUrl)).blob();
					await r2UploadBlob({ key, blob, filename: 'draft-thumb.png' });
					nextPreviewUrl = '';
					nextPreviewKey = key;
				}
			} catch {
				// Keep previous draftPreviewUrl / draftPreviewKey if capture/upload fails.
			}
		}
		draftPreviewUrl = nextPreviewUrl;
		draftPreviewKey = nextPreviewKey;

		const payload = {
			user_id: userId,
			kind: DRAFT_KIND,
			state: buildDraftState(),
			id: rowId,
		};
		const { data, error } = await (supabase as any)
			.from('drafts')
			.upsert(payload, { onConflict: 'id' })
			.select('id')
			.single();
		draftSaving = false;
		if (error) {
			draftError = error.message ?? 'Failed to save draft';
			return;
		}
		if (data?.id) draftId = data.id;
	}

	// ── Auth ──────────────────────────────────────────────────────────────
	onMount(async () => {
		const { data: { user } } = await supabase.auth.getUser();
		if (!user) { goto('/login'); return; }
		userId = user.id;
		draftRestoring = true;
		const sp = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
		const savedParam = sp?.get('saved') ?? null;
		const draftParam = sp?.get('draft') ?? null;
		const loadPromise =
			savedParam && /^[0-9a-f-]{36}$/i.test(savedParam)
				? loadSavedStudioTemplate(savedParam)
				: draftParam && /^[0-9a-f-]{36}$/i.test(draftParam)
					? loadDraftById(draftParam)
					: forcedBlankFromQuery
						? Promise.resolve()
						: skipLatestWorkspaceDraftRestore
							? Promise.resolve()
							: loadLatestDraft();
		void loadPromise
			.catch(() => {
				// loaders set draftError; swallow to keep UI responsive.
			})
			.finally(() => {
				void (async () => {
					await flushStudioLoadingPaint();
					draftRestoring = false;
					if (forcedBlankFromQuery) {
						applyBlankCanvas();
					} else if (skipLatestWorkspaceDraftRestore && forcedTemplateFromQuery) {
						// Fresh session from template carousel / `?template=` — never overlay last autosave.
						applyBlankCanvas();
						applyTemplateToAll(forcedTemplateFromQuery);
						seedNewsStarterPlaceholderLayout();
					}
					// Do not auto-generate the circle badge here — leave it empty until the user uploads or runs Circle AI.
				})();
			});
	});

	// ── Categories ────────────────────────────────────────────────────────
	const categories = [
		{ id: 'business', label: 'Business' },
		{ id: 'tech', label: 'Tech' },
		{ id: 'finance', label: 'Finance' },
		{ id: 'politics', label: 'Politics' },
		{ id: 'health', label: 'Health' },
		{ id: 'science', label: 'Science' },
		{ id: 'sports', label: 'Sports' },
		{ id: 'entertainment', label: 'Entertainment' },
		{ id: 'general', label: 'General' },
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

	const MOCK_FACTS = [
		{
			hookText: 'OCTOPUSES HAVE [[THREE HEARTS]] — TWO STOP WHEN THEY SWIM',
			rawText:
				'Two branchial hearts pump blood to the gills while a systemic heart circulates blood to the rest of the body. When an octopus swims, the systemic heart actually pauses, which is one reason they prefer crawling. This unusual cardiovascular design supports their active, short-lived lives in complex reef environments.',
			source: 'Did you know',
		},
		{
			hookText: 'BANANAS ARE [[BERRIES]] — BUT STRAWBERRIES ARE NOT',
			rawText:
				'Botanically, a berry develops from a single ovary and typically contains seeds inside the flesh. Bananas fit that definition. Strawberries aggregate from multiple ovaries and wear their seeds on the outside. The everyday fruit names we use often diverge sharply from botanical taxonomy.',
			source: 'Did you know',
		},
	] as const;

	const MOCK_STORIES: Record<string, { hookText: string; rawText: string; source: string }[]> = {
		health: [
			{
				hookText: 'SHE SWAPPED [[MIDNIGHT SNACKS]] FOR [[MAGNESIUM]] — SLEEP CHANGED FAST',
				rawText:
					'Her nights were restless from screens and sugar spikes. She moved protein earlier, dimmed lights, and tried magnesium glycinate on doctor advice. Week one felt placebo. By week four, wake-ups were fewer. It was not magic—just stacking small levers until the nervous system calmed.',
				source: 'Health',
			},
		],
		wealth: [
			{
				hookText: 'AT 28 HE HAD [[NO INHERITANCE]] — AT 35 HE HAD [[OPTIONALITY]]',
				rawText:
					'He avoided debt that did not build skills. Side income funded an emergency runway first, then index funds on autopilot. Raises were invisible to lifestyle. Friends bought cars; he bought time. Optionality meant saying no to bad jobs without panic.',
				source: 'Wealth',
			},
		],
		relationships: [
			{
				hookText: 'THEY AGREED TO [[ONE HARD CONVERSATION]] A WEEK — RESENTMENT [[SHRUNK]]',
				rawText:
					'Small irritations had become a background hum. They scheduled a protected hour: phones off, notes allowed, no winners. Topics rotated: money, family, intimacy. Some weeks were brutal. Others were boring. The habit mattered more than the perfect script.',
				source: 'Relationships',
			},
		],
		career: [
			{
				hookText: 'HER PORTFOLIO WAS [[MESSY]] — SO SHE SHIPPED [[ONE PUBLIC CASE STUDY]]',
				rawText:
					'Recruiters skim. She reframed one project with metrics, screenshots, and lessons learned. LinkedIn posts followed the same narrative arc. Interviews shifted from trivia to depth. One artifact did more than fifty bullet points on a resume.',
				source: 'Career',
			},
		],
		mindset: [
			{
				hookText: 'HE STOPPED CHASING [[CONFIDENCE]] AND STARTED COLLECTING [[PROOF]]',
				rawText:
					'Confidence felt like a mood he could not control. Proof was receipts: shipped work, saved messages, logged reps. He built a brag doc not for arrogance but for bad brain days. The inner critic lost a few debates on evidence.',
				source: 'Mindset',
			},
		],
		productivity: [
			{
				hookText: 'SHE TIME-BOXED [[SLACK]] TO 30 MINUTES — TEAM OUTPUT [[ROSE]]',
				rawText:
					'Constant pings fractured design work. She proposed office hours for questions. Leadership feared bottlenecks; instead, answers got documented. Async improved. Meetings shrank. The policy spread to two other teams after a quarter.',
				source: 'Productivity',
			},
		],
		fitness: [
			{
				hookText: 'HE COULD NOT DO [[ONE PULL-UP]] — SIX MONTHS LATER HE DID [[TWELVE]]',
				rawText:
					'Negatives and band-assisted reps built tendon patience. He tracked range of motion, not ego weight. Sleep and protein were boring pillars. Progress was invisible for weeks, then sudden. The lesson was patience with progressive overload.',
				source: 'Fitness',
			},
		],
		money: [
			{
				hookText: 'THEY FOUND [[$340]] A MONTH IN [[GHOST SUBSCRIPTIONS]]',
				rawText:
					'Old trials, duplicate streaming tiers, forgotten SaaS seats. They canceled ruthlessly for thirty days, then re-added only what they missed. Automated weekly account reviews kept drift low. The win was attention, not austerity.',
				source: 'Money',
			},
		],
	};

	/** Strip highlight markers for prompts / previews. */
	function stripHighlightMarkers(s: string) {
		return String(s ?? '').replace(/\[\[|\]\]/g, '').trim();
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
		/** Main tweet body above media (~3–4 lines at default size in a 9:16 card). */
		tweetTop: 230,
		article: 520,
		/** Long-form carousel body from APIs (OpenRouter, etc.); paragraphs preserved in clamp. */
		textCarousel: 6000,
		imageQuote: 130,
		videoStory: 320,
		blackText: 200,
		/** Black text template: long body under the hook line (separate from hook clamp). */
		blackTextBody: 1100,
	} as const;

	/** Article hero image is only seeded for templates built around full-bleed / top media. */
	function templateAcceptsArticleHeroBackground(t: TemplateId): boolean {
		return t === 'news' || t === 'article' || t === 'imageQuote' || t === 'tweet';
	}

	function clampFetchedPlainLength(text: string, maxLen: number): string {
		const raw = String(text ?? '').trim();
		if (!maxLen) return '';
		const plain = stripHighlightMarkers(raw).replace(/\s+/g, ' ').trim();
		if (plain.length <= maxLen) return raw;
		return `${plain.slice(0, Math.max(0, maxLen - 1)).trimEnd()}…`;
	}

	/** Text carousel: keep \\n\\n paragraph breaks (plain clamp collapses whitespace). */
	function clampFetchedTextCarouselBody(text: string, maxLen: number): string {
		const raw = String(text ?? '').trim();
		if (!maxLen) return '';
		let s = stripHighlightMarkers(raw);
		s = s.replace(/\r\n/g, '\n').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
		if (s.length <= maxLen) return ensureTextCarouselBodyMinLength(s);
		const budget = Math.max(1, maxLen - 1);
		let cut = budget;
		while (cut > 0 && s[cut] !== ' ' && s[cut] !== '\n') cut--;
		if (cut < Math.floor(budget * 0.45)) cut = budget;
		s = `${s.slice(0, Math.max(1, cut)).trimEnd()}…`;
		return ensureTextCarouselBodyMinLength(s);
	}

	/** Tweet main post: keep short enough to sit above media without crowding the card. */
	function clampTweetTopFetched(text: string): string {
		return clampFetchedPlainLength(text, FETCH_TEXT_CLIP.tweetTop);
	}

	function clampFetchedPrimaryForTemplate(template: TemplateId, text: string): string {
		const raw = String(text ?? '').trim();
		switch (template) {
			case 'tweet':
				return clampTweetTopFetched(raw);
			case 'article':
				return clampFetchedPlainLength(raw, FETCH_TEXT_CLIP.article);
			case 'textCarousel':
				return clampFetchedTextCarouselBody(raw, FETCH_TEXT_CLIP.textCarousel);
			case 'imageQuote':
				return clampFetchedPlainLength(raw, FETCH_TEXT_CLIP.imageQuote);
			case 'videoStory':
				return clampFetchedPlainLength(raw, FETCH_TEXT_CLIP.videoStory);
			case 'blackText':
				return clampFetchedPlainLength(raw, FETCH_TEXT_CLIP.blackText);
			default:
				return clampFetchedPlainLength(raw, FETCH_TEXT_CLIP.news);
		}
	}

	function normalizeHeadlineVariants(variants: string[], hookText: string, count: number): string[] {
		const n = Math.max(1, count);
		if (!variants.length) {
			return Array.from({ length: n }, (_, i) => (i === 0 ? hookText : ''));
		}
		if (variants.length >= n) return variants.slice(0, n);
		const last = variants[variants.length - 1] ?? hookText;
		const out = [...variants];
		while (out.length < n) out.push(last);
		return out.slice(0, n);
	}

	/** Apply carousel headline strings to the template the user had selected (not always News). */
	function applyHeadlineStringsToTemplate(template: TemplateId, strings: string[]) {
		const clipped = strings.map((s) => clampFetchedPrimaryForTemplate(template, s));
		slides = [...clipped];
		if (template === 'tweet') {
			tweetTopTextBySlide = [...clipped];
			// Bottom block is a tight “reply” slot under the image — full article blurbs overflow the card.
			tweetBottomTextBySlide = Array.from({ length: clipped.length }, () => '');
		} else if (template === 'article') {
			articleTextBySlide = [...clipped];
		} else if (template === 'textCarousel') {
			textCarouselTextBySlide = [...clipped];
		} else if (template === 'imageQuote') {
			imageQuoteTextBySlide = [...clipped];
		} else if (template === 'videoStory') {
			videoStoryHeadlineBySlide = [...clipped];
		} else if (template === 'blackText') {
			blackTextHeadlineBySlide = [...clipped];
		}
	}

	function applyPrimaryClampedToSlide(i: number, template: TemplateId, raw: string) {
		const clipped = clampFetchedPrimaryForTemplate(template, raw);
		slides = slides.map((s, idx) => (idx === i ? clipped : s));
		if (template === 'tweet') {
			tweetTopTextBySlide = tweetTopTextBySlide.map((s, idx) => (idx === i ? clipped : s));
		} else if (template === 'article') {
			articleTextBySlide = articleTextBySlide.map((s, idx) => (idx === i ? clipped : s));
		} else if (template === 'textCarousel') {
			textCarouselTextBySlide = textCarouselTextBySlide.map((s, idx) => (idx === i ? clipped : s));
		} else if (template === 'imageQuote') {
			imageQuoteTextBySlide = imageQuoteTextBySlide.map((s, idx) => (idx === i ? clipped : s));
		} else if (template === 'videoStory') {
			videoStoryHeadlineBySlide = videoStoryHeadlineBySlide.map((s, idx) => (idx === i ? clipped : s));
		} else if (template === 'blackText') {
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
				const bodyClamped = clampFetchedPlainLength(p.body, FETCH_TEXT_CLIP.blackTextBody);
				blackTextBodyBySlide = blackTextBodyBySlide.map((s, idx) => (idx === i ? bodyClamped : s));
			}
		}
		closeToolbar();
		importJsonFeedback = `Applied ${patches.length} slide update(s).`;
	}

	// ── Fetch news ────────────────────────────────────────────────────────
	/** After heavy async work, flush Svelte DOM and wait one frame so images/layout paint before hiding loading overlays. */
	async function flushStudioLoadingPaint() {
		await tick();
		await new Promise<void>((resolve) => {
			requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
		});
	}

	async function fetchNews(opts: { fillOnly?: boolean; preferExistingDeck?: boolean } = {}) {
		fetchingNews = true;
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
		const fillExistingDeck =
			!!opts.fillOnly ||
			!!opts.preferExistingDeck ||
			forcedBlankFromQuery ||
			hasMixedTemplates ||
			hasAnyOverlays ||
			hasAnyStyleOverrides ||
			hasAnyMedia;
		// Only clear starter deep-link when we are loading into News (News flow “owns” the deck).
		if (contentTemplate === 'news') forcedTemplateFromQuery = null;
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

			const syntheticHintStr =
				newsContentMode === 'fact'
					? factTopicPrompt.trim().slice(0, 600)
					: newsContentMode === 'story'
						? storyTopicPrompt.trim().slice(0, 600)
						: '';

			/** Random fact/story without a topic still use bundled mocks; any topic hits /api/news. */
			const useBundledFactStoryMock =
				useTestData &&
				(newsContentMode === 'fact' || newsContentMode === 'story') &&
				!syntheticHintStr;

			if (useTestData && newsContentMode === 'news') {
				// ── Mock mode: news articles only ───────────────────────────
				await new Promise((r) => setTimeout(r, 400));
				const pool = search
					? MOCK_NEWS.filter(
							(a) =>
								a.title.toLowerCase().includes(search.toLowerCase()) ||
								a.description.toLowerCase().includes(search.toLowerCase()),
						)
					: MOCK_NEWS;
				const article = pool[Math.floor(Math.random() * pool.length)] ?? MOCK_NEWS[0];

				hookText = article.title;
				rawText = `${article.title}. ${article.description}. ${article.snippet}`;
				nextSource = sourceLabels[category] ?? article.source ?? 'News';
				nextArticleUrl = article.url;
				nextArticleTitle = article.title;
				articleImageUrl = article.image_url;
			} else if (useBundledFactStoryMock) {
				// ── Mock mode: canned fact/story when no custom topic ─────────
				await new Promise((r) => setTimeout(r, 400));
				if (newsContentMode === 'fact') {
					const pick = MOCK_FACTS[Math.floor(Math.random() * MOCK_FACTS.length)] ?? MOCK_FACTS[0];
					hookText = pick.hookText;
					rawText = pick.rawText;
					nextSource = pick.source;
					nextArticleUrl = '';
					nextArticleTitle = pick.hookText.replace(/\[\[|\]\]/g, '').slice(0, 120);
					articleImageUrl = '';
				} else {
					const pool = MOCK_STORIES[storyCategory] ?? MOCK_STORIES.health;
					const pick = pool[Math.floor(Math.random() * pool.length)] ?? pool[0];
					hookText = pick.hookText;
					rawText = pick.rawText;
					nextSource = pick.source;
					nextArticleUrl = '';
					nextArticleTitle = pick.hookText.replace(/\[\[|\]\]/g, '').slice(0, 120);
					articleImageUrl = '';
				}
			} else {
				// ── API: live news, or fact/story (including with Test data + topic) ─
				const res = await fetch('/api/news', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						mode: newsContentMode,
						storyCategory,
						search: newsContentMode === 'news' ? search || undefined : undefined,
						categories: newsContentMode === 'news' ? category : undefined,
						autoHighlight: studioTextHighlightsEnabled,
						pick: newsContentMode === 'news' ? 'random' : 'first',
						syntheticHint: syntheticHintStr || undefined,
						studioRegenAt: Date.now(),
					}),
				});
				const data = await res.json();
				if (!res.ok) throw new Error(data.error ?? 'Failed to fetch news');

				hookText = data.text ?? '';
				rawText = data.description ?? data.title ?? '';
				nextSource =
					newsContentMode === 'news'
						? sourceLabels[category] ?? data.source ?? 'News'
						: typeof data.source === 'string' && data.source
							? data.source
							: newsContentMode === 'fact'
								? 'Did you know'
								: storyThemes.find((t) => t.id === storyCategory)?.label ?? 'Story';
				nextArticleUrl = data.url ?? '';
				nextArticleTitle = data.title ?? '';
				articleImageUrl = data.imageUrl ?? '';
			}

			// Only write metadata into the workspace when we are *owning the deck* (not filling a custom template).
			if (!fillExistingDeck) {
				source = nextSource;
				articleUrl = nextArticleUrl;
				articleTitle = nextArticleTitle;
				articleSnippet = rawText;
			}

			const n = fillExistingDeck ? Math.max(1, slides.length) : Math.max(1, slideCount);
			slideCount = n;
			lastTemplateUsed = contentTemplate;

		if (fillExistingDeck) {
			const allNewsSlidesDeck =
				slideTemplates.length > 0 &&
				slideTemplates.every((t) => coerceTemplateId(t) === 'news') &&
				!hasMixedTemplates;
			// True when at least one slide uses the news template (covers mixed decks too).
			const hasNewsSlides =
				slideTemplates.length > 0 &&
				slideTemplates.some((t) => coerceTemplateId(t) === 'news');

			// Sync article metadata so variants / Vertex / circle prompts are not stuck on the previous run.
			if (hasNewsSlides) {
				// Always sync for any deck that has news slides, regardless of content mode.
				articleUrl = nextArticleUrl;
				articleTitle = nextArticleTitle;
				articleSnippet = rawText;
				source = nextSource;
			} else if (newsContentMode === 'news') {
				articleUrl = nextArticleUrl;
				articleTitle = nextArticleTitle;
				articleSnippet = rawText;
			}
				// If the user is mid-inline-edit on News, clear the live buffer so the replacement is visible immediately.
				if (newsHeadlineLive !== null) newsHeadlineLive = null;
				// Preserve current slideTemplates, media, overlays. Only write copy to *existing* fields.
				// This enables "Load Test Article" on a blank/custom canvas without nuking layout.
				const targets: { slide: number; template: TemplateId }[] = [];
				for (let i = 0; i < n; i++) {
					const tpl = coerceTemplateId(slideTemplates[i] ?? lastTemplateUsed);
					const existing =
						tpl === 'news' && i === activeSlide && newsHeadlineLive !== null
							? String(stripHighlightMarkers(newsHeadlineLive) ?? '').trim()
							: String(primarySlideTextForPrompt(tpl, i) ?? '').trim();
					if (existing) targets.push({ slide: i, template: tpl });
				}
				if (!targets.length) {
					targets.push({ slide: 0, template: coerceTemplateId(slideTemplates[0] ?? lastTemplateUsed) });
				}

				const want = targets.length;
				const strings = await (async () => {
					if (want <= 1) return [hookText];
					try {
						const variantBodyText =
							newsContentMode === 'story'
								? `HOOK (slide 1 overlay):\n${hookText}\n\nNARRATIVE CONTEXT (continue this story across slides; do not turn it into a news explainer):\n${rawText || articleTitle}`
								: rawText || articleTitle;
						const res = await fetch('/api/news/variants', {
							method: 'POST',
							headers: { 'Content-Type': 'application/json' },
							body: JSON.stringify({
								count: want,
								title: articleTitle,
								text: variantBodyText,
								sourceUrl: articleUrl,
								autoHighlight: studioTextHighlightsEnabled,
								contentMode: newsContentMode,
							}),
						});
						const data = await res.json();
						if (!res.ok) throw new Error(data.error ?? 'Variant generation failed');
						const variants: string[] = data.variants ?? [];
						return normalizeHeadlineVariants(variants, hookText, want);
					} catch (e: any) {
						newsError = `Slide variants: ${e?.message ?? String(e)}`;
						return normalizeHeadlineVariants([], hookText, want);
					}
				})();

				for (let k = 0; k < targets.length; k++) {
					const t = targets[k];
					pushUndo(t.template, t.slide);
					applyPrimaryClampedToSlide(t.slide, t.template, strings[k] ?? (k === 0 ? hookText : ''));
				}
			// Deck has news slides → regenerate their backgrounds on every Load & Fill.
			// Text-only templates (tweet, blackText, etc.) only get text updates (handled above).
			const refreshNewsDeckOnFetch =
				!opts.fillOnly &&
				hasNewsSlides &&
				(newsContentMode === 'news' || newsContentMode === 'fact' || newsContentMode === 'story');
			if (refreshNewsDeckOnFetch) {
				await refreshNewsDeckImagesAfterFetch(String(articleImageUrl ?? '').trim());
			}
			} else {
				slideTemplates = Array.from({ length: n }, () => contentTemplate);

				if (contentTemplate === 'news') {
					bgImagesByTemplate = {
						...bgImagesByTemplate,
						news: Array.from({ length: n }, (_, i) => (i === 0 ? articleImageUrl : '')),
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
				} else {
					const heroBgRow = templateAcceptsArticleHeroBackground(contentTemplate)
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
				applyHeadlineStringsToTemplate(contentTemplate, normalizeHeadlineVariants([], hookText, n));

				// Generate supporting slide variants (refines slide 2+ when slideCount > 1)
				// Keep `fetchingNews` true through variants + imaging so the canvas overlay never drops early.
				if (slideCount > 1) {
					generatingVariants = true;
					await generateVariants(hookText, rawText, contentTemplate);
					generatingVariants = false;
				}

				// Black text: hook lines come from variants above; body must follow the same article (not stale template defaults).
				if (contentTemplate === 'blackText') {
					const body0 = clampFetchedPlainLength(
						String(articleSnippet || rawText || '').trim(),
						FETCH_TEXT_CLIP.blackTextBody,
					);
					blackTextBodyBySlide = Array.from({ length: n }, (_, i) => (i === 0 ? body0 : ''));
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
					for (let k = 0; k < circleIdxs.length; k++) {
						await generateCircleImage(circleIdxs[k]);
						if (k < circleIdxs.length - 1) {
							await new Promise<void>((r) => setTimeout(r, 350));
						}
					}
				}
			}

		} catch (e: any) {
			newsError = e.message;
		}

		await flushStudioLoadingPaint();
		fetchingNews = false;
		generatingVariants = false;
	}

	type FillSlot =
		| { kind: 'textOverlay'; template: TemplateId; slide: number; overlayId: string }
		| { kind: 'primary'; template: TemplateId; slide: number };

	function setTextOverlayText(template: TemplateId, slide: number, overlayId: string, text: string) {
		const rows = slideTextOverlaysByTemplate[template] ?? [];
		const nextRows = rows.map((r) => [...r]);
		while (nextRows.length <= slide) nextRows.push([]);
		nextRows[slide] = (nextRows[slide] ?? []).map((o) => (o.id === overlayId ? { ...o, text } : o));
		slideTextOverlaysByTemplate = { ...slideTextOverlaysByTemplate, [template]: nextRows };
	}

	function collectFillSlots(skipPrimary = false): FillSlot[] {
		// Collect fill targets across ALL slides so every template gets populated correctly.
		const out: FillSlot[] = [];
		const n = Math.max(1, slides.length);
		for (let i = 0; i < n; i++) {
			const tpl = coerceTemplateId(slideTemplates[i] ?? lastTemplateUsed);
			// Primary template text (e.g. News headline / main text field) counts as a fill target.
			if (!skipPrimary) out.push({ kind: 'primary', template: tpl, slide: i });
			// All text overlays on this slide (blank canvas / custom text boxes).
			const overlays = (slideTextOverlaysByTemplate[tpl] ?? [])[i] ?? [];
			for (const o of overlays) {
				out.push({ kind: 'textOverlay', template: tpl, slide: i, overlayId: o.id });
			}
		}
		return out;
	}

	/** Fill all template text slots with AI copy derived from `topic`.
	 *  When called without arguments it uses the current `search` input value.
	 *  Pass an explicit topic (e.g. article content) to drive the fill from loaded article data.
	 *  `skipPrimary`: only fill text overlays — use after `fetchNews` so headlines stay article/variant copy. */
	async function fillInTextFromTopic(
		explicitTopic?: string,
		opts?: { skipPrimary?: boolean },
	) {
		fetchingNews = true;
		newsError = '';
		try {
			const topic = (explicitTopic ?? String(search || '')).trim();
			if (!topic) {
				newsError = 'Add a topic to fill in text.';
				return;
			}

			const slots = collectFillSlots(!!opts?.skipPrimary);
			if (!slots.length) return;
			// One generated slide can provide multiple lines (headline/subheadline/body).
			const count = Math.max(1, Math.min(8, slots.length));
			const res = await fetch('/api/generate-slides', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					topic,
					style: 'minimal',
					slideCount: Math.max(3, count),
					imageCount: 0,
					audience: '',
				}),
			});
			const data = await res.json();
			if (!res.ok) throw new Error(data.error ?? 'Fill failed');
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

			for (let i = 0; i < slots.length; i++) {
				const slot = slots[i];
				const text = lines[i % lines.length];
				if (slot.kind === 'textOverlay') {
					pushUndo(slot.template, slot.slide);
					setTextOverlayText(slot.template, slot.slide, slot.overlayId, text);
				} else {
					pushUndo(slot.template, slot.slide);
					applyPrimaryClampedToSlide(slot.slide, slot.template, text);
				}
			}
		} catch (e: any) {
			newsError = e?.message ?? String(e);
		} finally {
			await flushStudioLoadingPaint();
			fetchingNews = false;
		}
	}

	/** Load an article (or generate content) then immediately fill every template text slot.
	 *  This combines the old two-step workflow into one action. */
	async function loadAndFill() {
		await fetchNews({ preferExistingDeck: true });
		// After the article is loaded, also fill all template slots using the article content
		// so every slide (including custom text overlays) gets populated in one click.
		const fillTopic = (articleSnippet || articleTitle || search || '').trim();
		if (fillTopic) {
			await fillInTextFromTopic(fillTopic, { skipPrimary: true });
		}
		// Second pass: parallel slide Vertex calls can 429 the circle; overlay fill can also shift
		// scheduling. If any News badge is still empty, retry those slides after everything settles.
		const n = Math.max(1, slides.length);
		if (newsContentMode === 'news' || newsContentMode === 'fact' || newsContentMode === 'story') {
			await tick();
			const needCircle: number[] = [];
			for (let i = 0; i < n; i++) {
				if (coerceTemplateId(slideTemplates[i] ?? lastTemplateUsed) !== 'news') continue;
				if (!(showCircleBySlide[i] ?? false)) continue;
				const hasCircleMedia = String(resolveMediaUrl(circleImages[i] ?? '')).trim().length > 0;
				if (!hasCircleMedia) needCircle.push(i);
			}
			for (let k = 0; k < needCircle.length; k++) {
				await new Promise<void>((r) => setTimeout(r, 400));
				await generateCircleImage(needCircle[k], true);
				if (k < needCircle.length - 1) {
					await new Promise<void>((r) => setTimeout(r, 350));
				}
			}
		}
	}

	// ── Generate supporting slide variants ────────────────────────────────
	async function generateVariants(hookText: string, rawText: string, template: TemplateId = 'news') {
		try {
			const variantBodyText =
				newsContentMode === 'story'
					? `HOOK (slide 1 overlay):\n${hookText}\n\nNARRATIVE CONTEXT (continue this story across slides; do not turn it into a news explainer):\n${rawText || articleTitle}`
					: rawText || articleTitle;
			const res = await fetch('/api/news/variants', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					count: slideCount,
					title: articleTitle,
					text: variantBodyText,
					sourceUrl: articleUrl,
					autoHighlight: studioTextHighlightsEnabled,
					contentMode: newsContentMode,
				}),
			});
			const data = await res.json();
			if (!res.ok) throw new Error(data.error ?? 'Variant generation failed');

			const variants: string[] = data.variants ?? [];
			const strings = normalizeHeadlineVariants(variants, hookText, slideCount);
			applyHeadlineStringsToTemplate(template, strings);
		} catch (e: any) {
			console.error('[variants]', e.message);
			newsError = `Slide variants: ${e.message}`;
			// Still align slide text arrays to slideCount so imaging / filmstrip stay consistent.
			applyHeadlineStringsToTemplate(template, normalizeHeadlineVariants([], hookText, slideCount));
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

	async function generateBackground(
		slideIdx: number,
		promptOverride?: string,
		template: TemplateId = 'news',
		skipVertexCache = false,
	) {
		setBgGeneratingFlag(template, slideIdx, true);
		bgError = '';

		try {
			// Solid fill paints above “no image” in NewsTemplate — clear it before Vertex so AI results show.
			if (template === 'news') {
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
			const res = await fetch('/api/vertex', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ prompt, aspect: '3:4', context: title || undefined, skipCache: skipVertexCache }),
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
				bgError = data.message ?? 'Configure Google credentials to enable AI images.';
				setBgGeneratingFlag(template, slideIdx, false);
			} else {
				bgError = data.error ?? (res.ok ? 'Image generation failed' : `Request failed (${res.status})`);
				setBgGeneratingFlag(template, slideIdx, false);
			}
		} catch (e: any) {
			bgError = e.message;
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
		studioImageGenBatchDepth++;
		try {
		const template: TemplateId = 'news';
		const n = Math.max(1, slides.length);
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
		const clearIdx = new Set(circleIdxs);
		circleImages = Array.from({ length: n }, (_, i) => (clearIdx.has(i) ? '' : (circleImages[i] ?? '')));
		await tick();

		const articleSrc = String(articleImageUrl ?? '').trim();
		if (articleSrc && templateAcceptsArticleHeroBackground(template)) {
			applyNewsSeedBackgroundLayout();
			const safe = await toExportSafeImageUrl(articleSrc);
			if (String(safe ?? '').trim()) {
				applyNewsSeedBackgroundLayout();
				setSlideImage(0, safe, template);
			}
		}

		const promises = Array.from({ length: n }, (_, i) => {
			if (i === 0 && articleSrc && templateAcceptsArticleHeroBackground(template)) return Promise.resolve();
			const cleanText = primarySlideTextForPrompt(template, i);
			const prompt = i === 0 ? (articleTitle || cleanText) : cleanText;
			return generateBackground(i, prompt, template, true);
		});
	await Promise.all(promises);

	// Space out circle vs N parallel slide requests so Vertex quota is less likely to 429 the badge.
	await new Promise<void>((r) => setTimeout(r, 1200));
	for (let k = 0; k < circleIdxs.length; k++) {
		await generateCircleImage(circleIdxs[k], true);
		if (k < circleIdxs.length - 1) {
			await new Promise<void>((r) => setTimeout(r, 350));
		}
	}

	studioImageGenPaintHold = true;
	await flushStudioLoadingPaint();
	studioImageGenPaintHold = false;
	} finally {
		studioImageGenBatchDepth--;
	}
}

// ── Generate unique images for all slides in parallel ─────────────────
	async function generateAllSlideImages(articleImageUrl?: string, template: TemplateId = 'news') {
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

		// Slide 0: use article image directly if available (templates with hero media only), otherwise Vertex
		const articleSrc = String(articleImageUrl ?? '').trim();
		if (articleSrc && templateAcceptsArticleHeroBackground(template)) {
			if (template === 'news') applyNewsSeedBackgroundLayout();
			const safe = await toExportSafeImageUrl(articleSrc);
			if (template === 'news' && String(safe ?? '').trim()) {
				applyNewsSeedBackgroundLayout();
			}
			setSlideImage(0, safe, template);
		}

		// Fire all Vertex requests in parallel (skip slide 0 if we have article image)
		const promises = slides.map((_, i) => {
			if (template === 'blackText') return Promise.resolve();
			if (i === 0 && articleImageUrl && templateAcceptsArticleHeroBackground(template)) return Promise.resolve(); // hero already set from article
			const cleanText = primarySlideTextForPrompt(template, i);
			const prompt = i === 0
				? (articleTitle || cleanText)
				: cleanText; // supporting slides use their own copy as the image prompt
			return generateBackground(i, prompt, template);
		});

		await Promise.all(promises);

		if (template === 'blackText') {
			generatingImagesByTemplate = {
				...generatingImagesByTemplate,
				[template]: new Array(slides.length).fill(false),
			};
		}

		studioImageGenPaintHold = true;
		await flushStudioLoadingPaint();
		studioImageGenPaintHold = false;
		} finally {
			studioImageGenBatchDepth--;
		}
	}

	// ── Subject cutout (AI background removal) ────────────────────────────
	async function cutOutSubject(slideIdx: number = activeSlide) {
		const src = (bgImagesByTemplate.news ?? [])[slideIdx];
		if (!src) {
			cutoutError = 'No background image on this slide to cut out.';
			return;
		}
		cutoutError = '';
		cuttingOut = cuttingOut.map((v, i) => (i === slideIdx ? true : v));
		cutoutProgress = 0;
		cutoutMessage = 'Starting…';
		try {
			const dataUrl = await removeBackground(src, (p) => {
				cutoutProgress = p.progress ?? cutoutProgress;
				cutoutMessage = p.message ?? cutoutMessage;
			});
			subjectCutouts = subjectCutouts.map((v, i) => (i === slideIdx ? dataUrl : v));
			// Auto-enable the toggle on first cutout so the user immediately sees the effect.
			showCutout = showCutout.map((v, i) => (i === slideIdx ? true : v));
		} catch (e: any) {
			cutoutError = e?.message ?? 'Background removal failed';
		} finally {
			cuttingOut = cuttingOut.map((v, i) => (i === slideIdx ? false : v));
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
		if (tweetTopAvatarInnerBgBySlide.length !== n) {
			tweetTopAvatarInnerBgBySlide = Array.from({ length: n }, (_, i) => tweetTopAvatarInnerBgBySlide[i] ?? '');
		}
		if (tweetTopAvatarLabelBySlide.length !== n) {
			tweetTopAvatarLabelBySlide = Array.from({ length: n }, (_, i) => tweetTopAvatarLabelBySlide[i] ?? '');
		}
		if (tweetBottomAvatarImageBySlide.length !== n) {
			tweetBottomAvatarImageBySlide = Array.from({ length: n }, (_, i) => tweetBottomAvatarImageBySlide[i] ?? '');
		}
		if (tweetBottomAvatarInnerBgBySlide.length !== n) {
			tweetBottomAvatarInnerBgBySlide = Array.from({ length: n }, (_, i) => tweetBottomAvatarInnerBgBySlide[i] ?? '');
		}
		if (tweetBottomAvatarLabelBySlide.length !== n) {
			tweetBottomAvatarLabelBySlide = Array.from({ length: n }, (_, i) => tweetBottomAvatarLabelBySlide[i] ?? '');
		}
		if (articleTextBySlide.length !== n) {
			articleTextBySlide = Array.from({ length: n }, (_, i) => articleTextBySlide[i] ?? '');
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
		if (textCarouselAvatarInnerBgBySlide.length !== n) {
			textCarouselAvatarInnerBgBySlide = Array.from({ length: n }, (_, i) => textCarouselAvatarInnerBgBySlide[i] ?? '');
		}
		if (textCarouselAvatarLabelBySlide.length !== n) {
			textCarouselAvatarLabelBySlide = Array.from({ length: n }, (_, i) => textCarouselAvatarLabelBySlide[i] ?? '');
		}
		if (imageQuoteFooterLeftBySlide.length !== n) {
			imageQuoteFooterLeftBySlide = Array.from({ length: n }, (_, i) => imageQuoteFooterLeftBySlide[i] ?? '$');
		}
		if (imageQuoteFooterRightBySlide.length !== n) {
			imageQuoteFooterRightBySlide = Array.from({ length: n }, (_, i) => imageQuoteFooterRightBySlide[i] ?? 'BRAND');
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
			const headline = stripHighlightMarkers(primarySlideTextForPrompt('news', slideIdx));
			const snippet = String(articleSnippet ?? '')
				.trim()
				.replace(/\s+/g, ' ')
				.slice(0, 280);
			const context =
				String(articleTitle ?? '').trim() ||
				headline ||
				snippet ||
				stripHighlightMarkers(slides[slideIdx] ?? '') ||
				'editorial subject';
			const basePrompt = `Bold editorial close-up photo representing: "${context}". Square crop, single strong subject, dramatic lighting, no text.`;

			const maxAttempts = 4;
			for (let attempt = 0; attempt < maxAttempts; attempt++) {
				const prompt =
					attempt === 0 ? basePrompt : `${basePrompt} (unique render ${Date.now()}-${attempt})`;
				const res = await fetch('/api/vertex', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ prompt, aspect: '1:1', skipCache: skipVertexCache }),
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
					bgError = data.message ?? 'Configure Google credentials to enable AI images.';
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

	function applyNewsSolidBg(hex: string, slideIdx = activeSlide) {
		if (coerceTemplateId(slideTemplates[slideIdx] ?? 'news') !== 'news') return;
		const c = normalizeSolidHex(hex);
		clearSlideBackground(slideIdx);
		newsSolidBgBySlide = Array.from({ length: slides.length }, (_, i) =>
			i === slideIdx ? c : (newsSolidBgBySlide[i] ?? '')
		);
		solidBgPopoverOpen = false;
	}

	function resetNewsSolidToGradient(slideIdx = activeSlide) {
		if (coerceTemplateId(slideTemplates[slideIdx] ?? 'news') !== 'news') return;
		newsSolidBgBySlide = Array.from({ length: slides.length }, (_, i) =>
			i === slideIdx ? '' : (newsSolidBgBySlide[i] ?? '')
		);
		solidBgPopoverOpen = false;
	}

	// ── Handle image uploads ──────────────────────────────────────────────
	function handleBgUpload(e: Event) {
		const file = (e.target as HTMLInputElement).files?.[0];
		if (!file) return;
		const reader = new FileReader();
		const idx = activeSlide;
		const t = activeTemplate;
		reader.onload = () => {
			setSlideImage(idx, reader.result as string, t);
		};
		reader.readAsDataURL(file);
	}

	function handleVideoUpload(e: Event) {
		const file = (e.target as HTMLInputElement).files?.[0];
		if (!file) return;
		const t = activeTemplate;
		const url = URL.createObjectURL(file);
		setSlideVideo(activeSlide, url, t);
	}

	function handleCircleUpload(e: Event) {
		const file = (e.target as HTMLInputElement).files?.[0];
		if (!file) return;
		const reader = new FileReader();
		const idx = activeSlide;
		reader.onload = () => { circleImages = circleImages.map((v, i) => (i === idx ? (reader.result as string) : v)); };
		reader.readAsDataURL(file);
	}

	function handleCircle2Upload(e: Event) {
		const file = (e.target as HTMLInputElement).files?.[0];
		if (!file) return;
		const reader = new FileReader();
		const idx = activeSlide;
		reader.onload = () => {
			circle2Images = circle2Images.map((v, i) => (i === idx ? (reader.result as string) : v));
			showCircle2BySlide = showCircle2BySlide.map((v, i) => (i === idx ? true : v));
		};
		reader.readAsDataURL(file);
	}

	let circle2QuickInput = $state<HTMLInputElement | null>(null);
	function openCircle2QuickPicker() {
		circle2QuickInput?.click();
	}

	let overlayQuickInput = $state<HTMLInputElement | null>(null);
	function openOverlayQuickPicker() {
		overlayQuickInput?.click();
	}

	let newsBgToolbarPoint = $state<{ x: number; y: number } | null>(null);
	let newsBgToolbarMediaInput = $state<HTMLInputElement | null>(null);

	const newsBgToolbarAnchor = $derived(
		newsBgToolbarPoint ? new DOMRect(newsBgToolbarPoint.x - 1, newsBgToolbarPoint.y - 1, 2, 2) : null,
	);

	function closeNewsBgToolbar() {
		newsBgToolbarPoint = null;
	}

	/** Open Cut out / Replace toolbar — use dock “BG” instead of tapping the canvas (tap would fight drag-pan). */
	function openNewsBgToolbarFromDock() {
		closeToolbar();
		const root =
			typeof document !== 'undefined'
				? document.querySelector<HTMLElement>('[data-studio-canvas-root]')
				: null;
		const r = root?.getBoundingClientRect();
		if (r && r.width > 4 && r.height > 4) {
			newsBgToolbarPoint = { x: r.left + r.width * 0.5, y: r.top + Math.min(r.height * 0.28, 220) };
		} else if (typeof window !== 'undefined') {
			newsBgToolbarPoint = { x: window.innerWidth * 0.55, y: 200 };
		}
	}

	function handleNewsBgToolbarMediaChange(e: Event) {
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
		} else {
			const reader = new FileReader();
			reader.onload = () => {
				setSlideImage(idx, reader.result as string, t);
			};
			reader.readAsDataURL(file);
		}
	}

	$effect(() => {
		void activeSlide;
		closeNewsBgToolbar();
	});

	function handleOverlayUpload(e: Event) {
		const file = (e.target as HTMLInputElement).files?.[0];
		if (!file) return;
		// Reset input so same file can be re-uploaded
		(e.target as HTMLInputElement).value = '';
		const reader = new FileReader();
		reader.onload = () => {
			const src = reader.result as string;
			// Measure natural dimensions to lock aspect ratio
			const img = new window.Image();
			img.onload = () => {
				const aspect = img.naturalWidth / img.naturalHeight;
				const w = Math.min(300, img.naturalWidth);
				const h = w / aspect;
				const idx = activeSlide;
				const newOverlay: Overlay = {
					id: crypto.randomUUID(),
					src,
					// Centre on canvas
					x: Math.round((CANVAS_W - w) / 2),
					y: Math.round((CANVAS_H - h) / 2),
					w: Math.round(w),
					h: Math.round(h),
				};
				const current = (slideOverlaysByTemplate[activeTemplate] ?? [])[idx] ?? [];
				setSlideOverlays(idx, [...current, newOverlay], activeTemplate);
			};
			img.src = src;
		};
		reader.readAsDataURL(file);
	}

	// ── Export PNGs (zip all slides) ──────────────────────────────────────
	async function exportPng() {
		if (!exportRef) return;
		if (!slides.length) return;
		exporting = true;
		try {
			const zip = new JSZip();
			const folder = zip.folder(`slides-${formatId}`) ?? zip;

			for (let i = 0; i < slides.length; i++) {
				canvasRasterSlide = i;
				await tick();
				await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));

				const node = exportRef;
				if (!node) throw new Error('Preview not ready for export');
				try { await (document as any).fonts?.ready; } catch { /* ignore */ }

				const dataUrl = await toPng(node, {
					width: CANVAS_W,
					height: CANVAS_H,
					pixelRatio: 1,
					// Match News canvas gutter so antialiasing gaps aren’t pure black
					backgroundColor: uiTheme === 'light' ? '#ffffff' : '#0a0a0a',
					style: { transform: 'scale(1)', transformOrigin: 'top left' },
					cacheBust: true,
				} as any);
				const base64 = dataUrl.split(',')[1] ?? '';
				folder.file(`slide-${String(i + 1).padStart(2, '0')}.png`, base64, { base64: true });
			}

			const blob = await zip.generateAsync({ type: 'blob' });
			const url = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = `slides-${formatId}-${Date.now()}.zip`;
			a.click();
			setTimeout(() => URL.revokeObjectURL(url), 30_000);
		} catch (e: any) {
			console.error('Export zip failed:', e);
			alert('Export failed: ' + (e?.message ?? String(e)));
		} finally {
			canvasRasterSlide = null;
			exporting = false;
		}
	}

	async function exportAllSlidesToDraft() {
		if (!exportRef) return 0;
		if (!slides.length) return 0;
		exportingAll = true;
		try {
			const out: string[] = [];
			for (let i = 0; i < slides.length; i++) {
				canvasRasterSlide = i;
				// Let the DOM update before rasterizing (Svelte + next paint)
				await tick();
				await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));

				const node = exportRef;
				if (!node) throw new Error('Preview not ready for export');

				try { await (document as any).fonts?.ready; } catch { /* ignore */ }
				const dataUrl = await toPng(node, {
					width: CANVAS_W,
					height: CANVAS_H,
					pixelRatio: 1,
					backgroundColor: uiTheme === 'light' ? '#ffffff' : '#0a0a0a',
					style: { transform: 'scale(1)', transformOrigin: 'top left' },
					cacheBust: true,
					// Let html-to-image inline @font-face rules so custom fonts render in the PNG.
				} as any);
				out.push(dataUrl);
			}
			exportedSlides = out;
			return out.length;
		} catch (e: any) {
			const msg =
				typeof e?.message === 'string' && e.message.trim()
					? e.message
					: (() => {
							try { return JSON.stringify(e); } catch { return String(e); }
						})();
			console.error('Export all failed:', e);
			alert(
				'Export all failed: ' +
					(msg || 'unknown error') +
					'\n\nMost common cause: a background image/video from another site blocks canvas export (CORS).'
			);
			return 0;
		} finally {
			canvasRasterSlide = null;
			exportingAll = false;
		}
	}

	// Preview scale — fit the live viewport and cap so tall formats (9:16) never swamp the docks
	const PREVIEW_COMFORT_MAX_W = 580;
	const PREVIEW_COMFORT_MAX_H = 640;
	let studioPreviewHostEl = $state<HTMLElement | null>(null);
	let previewHostW = $state(720);
	let previewHostH = $state(600);

	$effect(() => {
		const el = studioPreviewHostEl;
		if (typeof ResizeObserver === 'undefined') {
			if (typeof window !== 'undefined') {
				previewHostW = Math.max(240, window.innerWidth - 280);
				previewHostH = Math.max(240, window.innerHeight - 220);
			}
			return;
		}
		if (!el) return;
		const padX = 40;
		const padY = 56;
		const ro = new ResizeObserver(() => {
			previewHostW = Math.max(200, el.clientWidth - padX);
			previewHostH = Math.max(200, el.clientHeight - padY);
		});
		ro.observe(el);
		previewHostW = Math.max(200, el.clientWidth - padX);
		previewHostH = Math.max(200, el.clientHeight - padY);
		return () => ro.disconnect();
	});

	const previewScale = $derived(
		Math.min(
			PREVIEW_COMFORT_MAX_W / CANVAS_W,
			PREVIEW_COMFORT_MAX_H / CANVAS_H,
			previewHostW / CANVAS_W,
			previewHostH / CANVAS_H,
		),
	);
	const previewDisplayW = $derived(CANVAS_W * previewScale);
	const previewDisplayH = $derived(CANVAS_H * previewScale);

	/** Raster snapshots for filmstrip (same pipeline as ZIP export, low pixel ratio). */
	let filmstripPreviewUrls = $state<string[]>([]);
	let filmstripPreviewInFlight = $state(false);
	/** True only while capturing every slide for the filmstrip (hides rapid canvas switching). */
	let filmstripBulkCapturing = $state(false);

	/** Last signatures we successfully rasterized to the filmstrip (avoids full-deck capture on single-slide edits). */
	let prevFilmstripSigs: string[] = [];

	/** One filmstrip cell: template + media + primary copy lengths (used for invalidation + diff). */
	function slideThumbSignature(i: number): string {
		const t = slideTemplates[i] ?? 'news';
		const imgLen = ((bgImagesByTemplate[t] ?? [])[i] ?? '').length;
		const vidLen = ((bgVideosByTemplate[t] ?? [])[i] ?? '').length;
		// News uses `newsHeadlineLive` during inline editing to avoid full-canvas flicker; the filmstrip
		// should reflect live edits for the active slide and re-raster accordingly.
		const newsLiveLen =
			t === 'news' && i === activeSlide && newsHeadlineLive !== null
				? newsHeadlineLive.length
				: (slides[i] ?? '').length;
		return `${t}:${imgLen}:${vidLen}:${newsLiveLen}:${(tweetTopTextBySlide[i] ?? '').length}:${(tweetTopAvatarImageBySlide[i] ?? '').length}:${(tweetBottomAvatarImageBySlide[i] ?? '').length}:${(articleTextBySlide[i] ?? '').length}:${(textCarouselTextBySlide[i] ?? '').length}:${(imageQuoteTextBySlide[i] ?? '').length}:${(videoStoryHeadlineBySlide[i] ?? '').length}:${(blackTextHeadlineBySlide[i] ?? '').length}:${(blackTextBodyBySlide[i] ?? '').length}`;
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
		const t = slideTemplates[slideIdx] ?? 'news';
		if (t === 'blackText') return '#000000';
		if (t === 'tweet') return '#000000';
		if (t === 'textCarousel') return uiTheme === 'light' ? '#ffffff' : '#0a0a0a';
		if (t === 'videoStory') return '#000000';
		return uiTheme === 'light' ? '#ffffff' : '#0a0a0a';
	}

	/**
	 * Captures slide 0 as a PNG using the EXACT same pipeline as the Export button
	 * (`exportAllSlidesToDraft`): sets `exportingAll = true` so the filmstrip can't
	 * compete for `canvasRasterSlide` during the `toPng` call.
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
			try { await (document as any).fonts?.ready; } catch { /* ignore */ }
			const dataUrl = await toPng(node, {
				width: CANVAS_W,
				height: CANVAS_H,
				pixelRatio,
				backgroundColor: uiTheme === 'light' ? '#ffffff' : '#0a0a0a',
				style: { transform: 'scale(1)', transformOrigin: 'top left' },
				cacheBust: true,
			} as any);
			return dataUrl || null;
		} catch {
			return null;
		} finally {
			canvasRasterSlide = prevRaster ?? null;
			exportingAll = false;
			await tick();
		}
	}

	async function captureDraftThumbnailDataUrl(): Promise<string | null> {
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
					const dataUrl = await toPng(node, {
						width: CANVAS_W,
						height: CANVAS_H,
						pixelRatio: FILMSTRIP_THUMB_PIXEL_RATIO,
						backgroundColor: filmstripPngBackgroundForSlide(i),
						style: { transform: 'scale(1)', transformOrigin: 'top left' },
						cacheBust: true,
					} as any);
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
					await (document as any).fonts?.ready;
				} catch {
					/* ignore */
				}
				try {
					const dataUrl = await toPng(node, {
						width: CANVAS_W,
						height: CANVAS_H,
						pixelRatio: FILMSTRIP_THUMB_PIXEL_RATIO,
						backgroundColor: filmstripPngBackgroundForSlide(i),
						style: { transform: 'scale(1)', transformOrigin: 'top left' },
						cacheBust: true,
					} as any);
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
					await (document as any).fonts?.ready;
				} catch {
					/* ignore */
				}
				try {
					const dataUrl = await toPng(node, {
						width: CANVAS_W,
						height: CANVAS_H,
						pixelRatio: FILMSTRIP_THUMB_PIXEL_RATIO,
						backgroundColor: filmstripPngBackgroundForSlide(slideIdx),
						style: { transform: 'scale(1)', transformOrigin: 'top left' },
						cacheBust: true,
					} as any);
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
			try {
				for (let i = 0; i < slides.length; i++) {
					canvasRasterSlide = i;
					await tick();
					await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
					try {
						await (document as any).fonts?.ready;
					} catch {
						/* ignore */
					}
					try {
						const dataUrl = await toPng(node, {
							width: CANVAS_W,
							height: CANVAS_H,
							pixelRatio: FILMSTRIP_THUMB_PIXEL_RATIO,
							backgroundColor: filmstripPngBackgroundForSlide(i),
							style: { transform: 'scale(1)', transformOrigin: 'top left' },
							cacheBust: true,
						} as any);
						previews.push(dataUrl);
					} catch {
						previews.push('');
					}
				}
			} finally {
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
	$effect(() => {
		void filmstripThumbDeps;
		void studioBooting;
		if (studioBooting) return;
		if (filmstripThumbTimer) clearTimeout(filmstripThumbTimer);

		const n = slides.length;
		const nextSigs = n > 0 ? Array.from({ length: n }, (_, i) => slideThumbSignature(i)) : [];

		if (n === 0) {
			prevFilmstripSigs = [];
			filmstripPreviewUrls = [];
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

		if (!changed.length) return;

		const useFullDeckCapture =
			changed.length === n || changed.length > Math.max(3, Math.ceil(n * 0.55));
		const delayMs = useFullDeckCapture ? 900 : 400;

		function runFilmstripCapture(attempt: number) {
			if (editingInsideStudioCanvas() && attempt < 80) {
				filmstripThumbTimer = setTimeout(() => {
					filmstripThumbTimer = null;
					runFilmstripCapture(attempt + 1);
				}, 220);
				return;
			}
			const run = useFullDeckCapture ? refreshFilmstripPreviews() : refreshFilmstripPreviewSlices(changed);
			void run;
		}

		filmstripThumbTimer = setTimeout(() => {
			filmstripThumbTimer = null;
			runFilmstripCapture(0);
		}, delayMs);

		return () => {
			if (filmstripThumbTimer) clearTimeout(filmstripThumbTimer);
		};
	});
</script>

<FloatingActions
	{...({
		slideLabels: slides.map((_, i) => `Slide ${i + 1}`),
		posting: exportingAll,
		exportingZip: exporting,
		onExportZip: () => void exportPng(),
		onBurnMusicClick: () => void navigateToBurnMusicPage(),
		onSaveTemplate: () => {
			showSaveTemplatePanel = true;
			studioTemplateFeedback = '';
			if (!studioTemplateName.trim()) {
				studioTemplateName = `Template · ${TEMPLATES.find((t) => t.id === activeTemplate)?.label ?? 'Studio'}`;
			}
		},
		onPost: async () => {
			const n = await exportAllSlidesToDraft();
			if (!n) {
				alert('Could not export slides to PNG, so nothing was sent to the scheduler.\n\nFix the background media (CORS/video) and try Post again.');
				return;
			}
			await goto('/dashboard/post-scheduler?from=studio&exported=1');
		},
	} as any)}
/>

<div class="flex h-full overflow-hidden">

	<!-- ── Right panel: preview ──────────────────────────────────────────── -->
	<div
		class="flex-1 flex flex-col min-h-0 overflow-hidden bg-[#080808] p-6 gap-3 studio-right"
		style="background: var(--app-bg);"
	>
	{#if draftError}
		<div class="relative z-40 flex w-full max-w-full shrink-0 flex-wrap items-center justify-end gap-2 gap-y-1 px-1 pb-1">
			<p class="max-w-[min(22rem,70vw)] min-w-0 text-right text-[10px] font-body leading-snug text-red-400/90">
				{draftError}
			</p>
		</div>
	{/if}

		<!-- Editor dock + format dock — in document flow so the canvas never stacks over them -->
		<div class="relative z-30 flex w-full max-w-full shrink-0 flex-wrap items-center justify-center gap-3 px-1 py-1">
			<!-- Hidden picker for dock “Image” (image stickers / logos) — must stay in DOM for bind:this -->
			<input
				type="file"
				accept="image/*"
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
			<DockToolbar items={dockItems} inline />
			<TemplateDockToolbar
				templates={templateDockTabs}
				selectedId={activeTemplate}
				selectedLabelOverride={forcedBlankFromQuery &&
				slides.length === 1 &&
				!String(slides[0] ?? '').trim() &&
				!String(backgroundImage ?? '').trim() &&
				!String(backgroundVideo ?? '').trim()
					? 'Blank'
					: ''}
				onSelect={(id) => setActiveTemplate(id as TemplateId)}
				onApplyAll={() => applyTemplateToAll(activeTemplate)}
			/>
			<FormatDockToolbar
				formats={FORMATS.map((f) => ({ id: f.id, label: f.label, title: `${f.w}×${f.h}` }))}
				selectedId={formatId}
				onSelect={(id) => (formatId = id as FormatId)}
			/>
		</div>

		<!-- Slide indicator + nav arrows -->
		<!-- Slide switcher removed (filmstrip below is the navigator) -->

		<div class="flex min-h-0 flex-1 flex-col overflow-hidden">
		<!-- Main preview + quick actions (next to canvas) -->
		<div
			class="flex min-h-0 w-full min-w-0 flex-1 items-start justify-center overflow-auto"
			bind:this={studioPreviewHostEl}
		>
		<div class="flex shrink-0 justify-center py-2 px-1">
			<div style="width: {previewDisplayW}px;" class="relative z-10 max-w-full shrink-0">
				<!-- Clip any absolutely-positioned template layers so they don't sit over the toolbar -->
				<div
					data-studio-canvas-root
					style="height: {previewDisplayH}px; background: var(--app-surface-2); border: 1px solid var(--app-border);"
					class="relative rounded-2xl {previewCanvasOverflowClass}"
				>

		{#if studioCanvasBusyLoading}
			<!-- Full-canvas loading overlay — fetch/fill, variants, per-slide image gen (all templates) -->
			<div
				class="absolute inset-0 z-[22] flex flex-col items-center justify-center rounded-2xl"
				style="background: rgba(0,0,0,0.82); backdrop-filter: blur(6px);"
				aria-live="polite"
				aria-busy="true"
			>
				<LoadingLines />
			</div>
		{/if}
	{#if filmstripBulkCapturing && slides.length >= 1}
		<div
			class="absolute inset-0 z-[19] flex flex-col items-center justify-center rounded-2xl"
			style="background: rgba(0,0,0,0.82); backdrop-filter: blur(6px);"
			aria-live="polite"
			aria-busy="true"
		>
			<LoadingLines />
		</div>
	{/if}
			{#if studioBooting}
				<!-- Initial boot overlay — same loader as fetch / image gen -->
				<div
					class="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 rounded-2xl px-4"
					style="background: rgba(0,0,0,0.82); backdrop-filter: blur(6px);"
					aria-live="polite"
					aria-busy="true"
				>
					<LoadingLines />
					<p class="max-w-[min(22rem,85%)] text-center text-[10px] font-body leading-relaxed text-white/55">
						Restoring your last edit so nothing gets lost.
					</p>
				</div>
			{/if}
			{#if previewTemplate === 'blank'}
				<BlankTemplate
					bind:exportRef
					backgroundImage={canvasBackgroundImage}
					backgroundVideo={canvasBackgroundVideo}
					solidBackgroundColor={'#ffffff'}
					w={CANVAS_W}
					h={CANVAS_H}
					scale={previewScale}
					interactive={canvasInteractive}
					overlays={canvasOverlays}
				/>
				<StudioTextOverlays
					w={CANVAS_W}
					h={CANVAS_H}
					scale={previewScale}
					interactive={canvasInteractive}
					highlightColor={highlightColor}
					textOverlays={canvasTextOverlays}
					activeTextKind={selectedText}
					activeTextOverlayId={selectedTextOverlayId}
					onRangeSelect={onTextOverlayRangeSelect}
					onTextOverlaysChange={(o: any) => { if (!canvasInteractive) return; setSlideTextOverlays(paintSlide, o, previewTemplate); }}
					onTextSelect={(kind: any, el: any) => onTextSelect(kind as any, el)}
					parseHighlightMarkup={previewTemplate === 'news'}
				/>
			{:else if previewTemplate === 'news'}
				<NewsTemplate
					templateTheme={uiTheme}
					bind:exportRef
					bind:circleX
					bind:circleY
					bind:circleSize
					bind:circleBorderColor
					bind:circle2X
					bind:circle2Y
					bind:circle2Size
					bind:circle2BorderColor
					bind:bgOffsetX
					bind:bgOffsetY
					bind:bgZoom
					bind:bgFitMode
					bind:bgContainMagnify
					bind:textPanelOffsetY
					bind:shadowHeight
					bind:shadowStrength
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
					source={source}
					sourceLogoSrc={sourceLogoSrc}
					sourceLabelMode={sourceLabelMode}
					sourceLogoWidth={sourceLogoWidth}
					highlightColor={highlightColor}
					textColor={canvasHeadlineInk}
					w={CANVAS_W}
					h={CANVAS_H}
					scale={previewScale}
					interactive={canvasInteractive}
					overlays={canvasOverlays}
					textOverlays={[]}
					headlineStyle={canvasHeadlineStyle}
					sourceStyle={canvasSourceStyle}
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
				/>
				<!-- Shared text overlay layer (sits above the template) -->
				<StudioTextOverlays
					w={CANVAS_W}
					h={CANVAS_H}
					scale={previewScale}
					interactive={canvasInteractive}
					highlightColor={highlightColor}
					textOverlays={canvasTextOverlays}
					activeTextKind={selectedText}
					activeTextOverlayId={selectedTextOverlayId}
					onRangeSelect={onTextOverlayRangeSelect}
					onTextOverlaysChange={(o: any) => { if (!canvasInteractive) return; setSlideTextOverlays(paintSlide, o, previewTemplate); }}
					onTextSelect={(kind: any, el: any) => onTextSelect(kind as any, el)}
					parseHighlightMarkup={previewTemplate === 'news'}
				/>
			{:else if previewTemplate === 'article'}
				<ArticleTemplate
					templateTheme={uiTheme}
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
					activeTextKind={selectedText}
					activeTextOverlayId={selectedTextOverlayId}
					onRangeSelect={onTextOverlayRangeSelect}
					onTextOverlaysChange={(o: any) => { if (!canvasInteractive) return; setSlideTextOverlays(paintSlide, o, previewTemplate); }}
					onTextSelect={(kind: any, el: any) => onTextSelect(kind as any, el)}
					parseHighlightMarkup={previewTemplate === 'news'}
				/>
			{:else if previewTemplate === 'tweet'}
				<!-- Tweet: minimal integration for now (top tweet text = slide text). -->
				<TweetTemplate
					templateTheme={uiTheme}
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
					topAvatarInnerBg={tweetTopAvatarInnerBgBySlide[paintSlide] ?? ''}
					topAvatarLabel={tweetTopAvatarLabelBySlide[paintSlide] ?? ''}
					bottomAvatar={tweetBottomAvatarImageBySlide[paintSlide] ?? ''}
					bottomAvatarInnerBg={tweetBottomAvatarInnerBgBySlide[paintSlide] ?? ''}
					bottomAvatarLabel={tweetBottomAvatarLabelBySlide[paintSlide] ?? ''}
topImage={(bgImagesByTemplate.tweet ?? [])[paintSlide] || '/templates/tweet/demo-bg.jpg'}
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
					activeTextKind={selectedText}
					activeTextOverlayId={selectedTextOverlayId}
					onRangeSelect={onTextOverlayRangeSelect}
					onTextOverlaysChange={(o: any) => { if (!canvasInteractive) return; setSlideTextOverlays(paintSlide, o, previewTemplate); }}
					onTextSelect={(kind: any, el: any) => onTextSelect(kind as any, el)}
					parseHighlightMarkup={previewTemplate === 'news'}
				/>
			{:else if previewTemplate === 'textCarousel'}
				<TextCarouselTemplate
					templateTheme={uiTheme}
					bind:exportRef
					canvasW={CANVAS_W}
					canvasH={CANVAS_H}
					text={textCarouselTextBySlide[paintSlide] ?? ''}
					name={textCarouselNameBySlide[paintSlide] ?? 'Captains of industry'}
					handle={textCarouselHandleBySlide[paintSlide] ?? '@captainsofindustryy'}
					avatar={textCarouselAvatarImageBySlide[paintSlide] ?? ''}
					avatarInnerBg={textCarouselAvatarInnerBgBySlide[paintSlide] ?? ''}
					avatarLabel={textCarouselAvatarLabelBySlide[paintSlide] ?? ''}
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
					activeTextKind={selectedText}
					activeTextOverlayId={selectedTextOverlayId}
					onRangeSelect={onTextOverlayRangeSelect}
					onTextOverlaysChange={(o: any) => { if (!canvasInteractive) return; setSlideTextOverlays(paintSlide, o, previewTemplate); }}
					onTextSelect={(kind: any, el: any) => onTextSelect(kind as any, el)}
					parseHighlightMarkup={previewTemplate === 'news'}
				/>
			{:else if previewTemplate === 'videoStory'}
				<VideoStoryTemplate
					bind:exportRef
					headline={videoStoryHeadlineBySlide[paintSlide] ?? VIDEO_STORY_DEFAULTS.headline}
					watermark={videoStoryWatermarkBySlide[paintSlide] ?? VIDEO_STORY_DEFAULTS.watermark}
					videoSrc={canvasBackgroundVideo}
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
					headlineStyle={canvasVideoStoryHeadlineStyle}
					watermarkStyle={canvasVideoStoryWatermarkStyle}
					selectedText={selectedText}
					textOffsets={offsetsForTemplate(paintSlide, 'videoStory')}
					onTextOffsetChange={(kind, next) => {
						if (!canvasInteractive) return;
						setTemplateOffset(paintSlide, 'videoStory', String(kind), next);
					}}
					onHeadlineChange={(v) => {
						if (!canvasInteractive) return;
						pushUndo('videoStory', paintSlide);
						videoStoryHeadlineBySlide = videoStoryHeadlineBySlide.map((x, i) => (i === paintSlide ? v : x));
					}}
					onWatermarkChange={(v) => {
						if (!canvasInteractive) return;
						pushUndo('videoStory', paintSlide);
						videoStoryWatermarkBySlide = videoStoryWatermarkBySlide.map((x, i) => (i === paintSlide ? v : x));
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
					activeTextKind={selectedText}
					activeTextOverlayId={selectedTextOverlayId}
					onRangeSelect={onTextOverlayRangeSelect}
					onTextOverlaysChange={(o: any) => {
						if (!canvasInteractive) return;
						setSlideTextOverlays(paintSlide, o, previewTemplate);
					}}
					onTextSelect={(kind: any, el: any) => onTextSelect(kind as any, el)}
					parseHighlightMarkup={previewTemplate === 'news'}
				/>
			{:else if previewTemplate === 'blackText'}
				<BlackTextCarouselTemplate
					bind:exportRef
					backgroundImage={canvasBackgroundImage.trim() ? canvasBackgroundImage : BLACK_TEXT_BG_DEFAULT}
					headline={blackTextHeadlineBySlide[paintSlide] ?? BLACK_TEXT_CAROUSEL_DEFAULTS.headline}
					body={blackTextBodyBySlide[paintSlide] ?? BLACK_TEXT_CAROUSEL_DEFAULTS.body}
					canvasW={CANVAS_W}
					canvasH={CANVAS_H}
					scale={previewScale}
					interactive={canvasInteractive}
					highlightColor={highlightColor}
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
					activeTextKind={selectedText}
					activeTextOverlayId={selectedTextOverlayId}
					onRangeSelect={onTextOverlayRangeSelect}
					onTextOverlaysChange={(o: any) => {
						if (!canvasInteractive) return;
						setSlideTextOverlays(paintSlide, o, previewTemplate);
					}}
					onTextSelect={(kind: any, el: any) => onTextSelect(kind as any, el)}
					parseHighlightMarkup={previewTemplate === 'news'}
				/>
			{:else if previewTemplate === 'imageQuote'}
				<!-- Image Quote template removed from public UI. Keep a safe fallback. -->
				<NewsTemplate
					templateTheme={uiTheme}
					bind:exportRef
					backgroundImage={canvasBackgroundImage}
					backgroundVideo={canvasBackgroundVideo}
					videoTrimStartSec={canvasVideoTrimStart}
					videoTrimEndSec={canvasVideoTrimEnd || canvasVideoDuration || 0}
					videoSeekSec={videoSeekSec}
					videoMuted={canvasVideoMuted}
					videoVolume={canvasVideoVolume}
					text={canvasOverlayText}
					source={source}
					sourceLogoSrc={sourceLogoSrc}
					sourceLabelMode={sourceLabelMode}
					sourceLogoWidth={sourceLogoWidth}
					highlightColor={highlightColor}
					textColor={canvasHeadlineInk}
					w={CANVAS_W}
					h={CANVAS_H}
					scale={previewScale}
					interactive={canvasInteractive}
					overlays={canvasOverlays}
					textOverlays={[]}
					headlineStyle={canvasHeadlineStyle}
					sourceStyle={canvasSourceStyle}
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
					onOverlaysChange={(o) => { if (!canvasInteractive) return; setSlideOverlays(paintSlide, o, previewTemplate); }}
					onTextSelect={onTextSelect}
					onHeadlineRangeSelect={onHeadlineRangeSelect}
					headlineSelectionRestoreNonce={headlineSelectionRestoreNonce}
					headlineSelectionRestoreRange={headlineRange}
				/>
				<!-- Shared text overlay layer (sits above the template) -->
				<StudioTextOverlays
					w={CANVAS_W}
					h={CANVAS_H}
					scale={previewScale}
					interactive={canvasInteractive}
					highlightColor={highlightColor}
					textOverlays={canvasTextOverlays}
					activeTextKind={selectedText}
					activeTextOverlayId={selectedTextOverlayId}
					onRangeSelect={onTextOverlayRangeSelect}
					onTextOverlaysChange={(o: any) => { if (!canvasInteractive) return; setSlideTextOverlays(paintSlide, o, previewTemplate); }}
					onTextSelect={(kind: any, el: any) => onTextSelect(kind as any, el)}
					parseHighlightMarkup={previewTemplate === 'news'}
				/>
			{/if}
				</div>
			</div>
		</div>
		</div>
		<!-- /Canvas scroll area -->


		</div>
		<!-- /Prompt bar + filmstrip wrapper -->

		<!-- Slide filmstrip: drag to reorder (show for single-slide decks so Hook + Add stay visible) -->
		{#if slides.length >= 1}
			{@const orderIds = filmstripIds.length ? filmstripIds : slideIds}
			{@const idToIndex = new Map(slideIds.map((id, i) => [id, i]))}
			{@const dndItems = orderIds.map((id) => {
				const i = idToIndex.get(id) ?? 0;
				const t = slideTemplates[i] ?? 'news';
				const rawThumbText =
					t === 'news' && i === activeSlide && newsHeadlineLive !== null
						? newsHeadlineLive
						: t === 'tweet'
						? (tweetTopTextBySlide[i] ?? '').trim()
						: t === 'article'
							? (articleTextBySlide[i] ?? '')
							: t === 'textCarousel'
								? (textCarouselTextBySlide[i] ?? '')
								: t === 'videoStory'
									? (videoStoryHeadlineBySlide[i] ?? '')
								: t === 'blackText'
									? (blackTextHeadlineBySlide[i] ?? '')
								: t === 'imageQuote'
									? (imageQuoteTextBySlide[i] ?? '')
									: (slides[i] ?? '');
				const thumbText = String(rawThumbText || slides[i] || '')
					.replace(/\[\[|\]\]/g, '')
					.replace(/\s+/g, ' ')
					.trim();
				return {
					id,
					slideIndex: i,
					// Derive thumbnail data by id→index lookup (stable during drag).
					text: thumbText,
					img: (bgImagesByTemplate[t] ?? [])[i] ?? '',
					vid: (bgVideosByTemplate[t] ?? [])[i] ?? '',
					music: slideMusic[i] ?? null,
					loading: !!((generatingImagesByTemplate[t] ?? [])[i]),
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
				<div class="no-scrollbar flex gap-2 overflow-x-auto max-w-full pb-1 px-1 mx-auto">
				{#each dndItems as item, i (item.id)}
					{@const tplate = slideTemplates[item.slideIndex] ?? 'news'}
					{@const isPlaceholder = !item.text}
					{@const hasMusic = !!item.music}
					{@const isVideo = !!item.vid || hasMusic}
					{@const thumbFontFamily =
						tplate === 'news'
							? `'Bebas Neue', Impact, ui-sans-serif, sans-serif`
							: `'Satoshi', ui-sans-serif, system-ui, sans-serif`}
					{@const thumbFontSize = tplate === 'news' ? '8px' : '7.5px'}
					{@const thumbImgOpacity = tplate === 'tweet' && item.img ? '0.92' : '0.78'}
					{@const rasterThumb = filmstripPreviewUrls[item.slideIndex] ?? ''}
					{@const sortable = useSortable({
						id: item.id,
						get index() { return i; },
						transition: { duration: 300, easing: 'cubic-bezier(0.25, 1, 0.5, 1)', idle: true },
					})}
					<div
						{@attach sortable.ref}
						{@attach sortable.handleRef}
						use:registerFilmstripSortable={sortable}
						class="flex-shrink-0 flex flex-col items-center gap-1 group cursor-grab active:cursor-grabbing"
						style="
							opacity: {sortable.isDragging.current ? 0.65 : 1};
							touch-action: none;
						"
					>
						<button
							type="button"
							onclick={() => activeSlide = item.slideIndex}
							class="w-16 h-20 rounded-lg overflow-hidden border-2 transition-all relative
								{activeSlide === item.slideIndex ? 'border-violet-500' : (isPlaceholder ? 'border-white/[0.08] border-dashed' : 'border-white/[0.06] group-hover:border-white/20')}"
							aria-label={`Focus slide ${i + 1}`}
							style="touch-action: none; background: var(--app-surface-3);"
						>
								{#if item.loading}
									<div class="absolute inset-0 flex items-center justify-center" style="background: var(--app-surface-3);">
										<Loader size={12} class="animate-spin text-violet-400 opacity-60" />
									</div>
								{:else if isPlaceholder}
									<div class="absolute inset-0 flex items-center justify-center text-white/15">
										<span class="text-[10px] font-mono">#{i + 1}</span>
									</div>
								{:else if rasterThumb}
									<img
										src={rasterThumb}
										alt=""
										class="w-full h-full object-cover"
										draggable="false"
									/>
								{:else if filmstripPreviewInFlight && !isPlaceholder}
									<div class="absolute inset-0 flex items-center justify-center" style="background: var(--app-surface-3);">
										<Loader size={12} class="animate-spin text-violet-400 opacity-50" />
									</div>
								{:else if item.vid}
									<div class="absolute inset-0 bg-cyan-950/60 flex items-center justify-center">
										<Play size={14} class="text-cyan-400 opacity-80" fill="currentColor" />
									</div>
								{:else if item.img}
									<img
										src={item.img}
										alt=""
										class="w-full h-full object-cover"
										style="opacity: {thumbImgOpacity};"
										draggable="false"
									/>
								{:else}
									<div
										class="absolute inset-0"
										style="background: linear-gradient(135deg,
											color-mix(in oklab, var(--app-text) 6%, transparent),
											color-mix(in oklab, var(--color-violet) 12%, transparent)
										);"
									></div>
								{/if}

								{#if !isPlaceholder && !rasterThumb}
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

								<!-- Video/music badge: pinned top-left so users know at a
								     glance this slide publishes as a video (with optional audio). -->
								{#if isVideo && !item.loading}
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
						</button>

							<!-- Flame (burn-to-video) button. Adds/changes music and
							     marks the slide as a video on publish. Hidden until
							     hover for empty slides; always visible when active. -->
							{#if !isPlaceholder}
								<button
									type="button"
									data-music-toggle
									onclick={(e) => { e.stopPropagation(); musicPickerForSlide = musicPickerForSlide === item.slideIndex ? null : item.slideIndex; }}
									title={hasMusic ? `Change music: ${item.music?.name}` : 'Add music — publishes as video'}
									aria-label={`Choose music for slide ${i + 1}`}
									class="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full flex items-center justify-center border transition-all
										{hasMusic
											? 'bg-orange-500/90 border-orange-400 text-white shadow-lg shadow-orange-500/30'
											: 'bg-[#1a1a1a] border-white/10 text-white/40 hover:text-orange-400 hover:border-orange-400/50 opacity-0 group-hover:opacity-100 focus:opacity-100'}"
								>
									<Flame size={10} fill={hasMusic ? 'currentColor' : 'none'} />
								</button>
							{/if}

							<!-- Music picker popover -->
							{#if musicPickerForSlide === item.slideIndex}
								<!-- svelte-ignore a11y_no_static_element_interactions -->
								<!-- svelte-ignore a11y_click_events_have_key_events -->
								<div
									data-music-popover
									class="absolute top-[92px] left-1/2 -translate-x-1/2 z-40 w-52 p-2 rounded-xl bg-[#1a1a1a] border border-white/10 shadow-2xl"
									onclick={(e) => e.stopPropagation()}
								>
									<div class="flex items-center justify-between mb-1.5">
										<span class="text-[10px] font-mono text-white/40 uppercase tracking-wider">
											Music · Slide {i + 1}
										</span>
										<button
											onclick={() => musicPickerForSlide = null}
											class="text-white/30 hover:text-white/70 transition-colors"
											aria-label="Close music picker"
										>
											<X size={11} />
										</button>
									</div>
									<p class="text-[9px] font-body text-cyan-400/70 mb-2 leading-snug">
										Picking a track turns this slide into a video on publish.
									</p>

									<button
									onclick={() => { slideMusic = slideMusic.map((m, idx) => idx === item.slideIndex ? null : m); musicPickerForSlide = null; }}
										class="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left transition-colors
											{hasMusic ? 'hover:bg-white/[0.05] text-white/50' : 'bg-white/[0.05] text-white'}"
									>
										<span class="w-4 h-4 rounded-full bg-white/[0.05] border border-white/10 flex items-center justify-center">
											{#if !hasMusic}<span class="w-1.5 h-1.5 rounded-full bg-violet-400"></span>{/if}
										</span>
										<span class="text-[11px] font-body">No music (image)</span>
									</button>

									<div class="max-h-44 overflow-y-auto mt-1 flex flex-col gap-0.5">
										{#each MUSIC_LIBRARY as track (track.id)}
											{@const selected = item.music?.id === track.id}
											<button
												onclick={() => { slideMusic = slideMusic.map((m, idx) => idx === item.slideIndex ? track : m); musicPickerForSlide = null; }}
												class="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left transition-colors
													{selected ? 'bg-orange-500/15 text-orange-300 border border-orange-500/30' : 'hover:bg-white/[0.05] text-white/70 border border-transparent'}"
											>
												<span class="w-4 h-4 rounded-full bg-white/[0.05] border border-white/10 flex items-center justify-center shrink-0">
													<Music size={8} class={selected ? 'text-orange-400' : 'text-white/30'} />
												</span>
												<span class="text-[11px] font-body flex-1 truncate">{track.name}</span>
											</button>
										{/each}
									</div>
								</div>
							{/if}
						<span class="text-[9px] font-mono flex items-center gap-1 {activeSlide === item.slideIndex ? 'text-violet-400' : 'text-white/20'}">
							{i === 0 ? 'Hook' : `Slide ${i + 1}`}
							{#if isVideo}
								<Play size={7} class="text-cyan-400/60" fill="currentColor" />
							{/if}
						</span>
					</div>
				{/each}

				<!-- Add slide -->
				<button
					type="button"
					onclick={addSlide}
					class="flex-shrink-0 w-16 h-20 rounded-lg border-2 border-dashed border-white/[0.10] hover:border-violet-500/50 bg-white/[0.02] hover:bg-white/[0.04] transition-all flex items-center justify-center text-white/35 hover:text-white"
					aria-label="Add slide"
					title="Add slide"
				>
					<span class="text-2xl leading-none">+</span>
				</button>
				</div>

				<!-- Drag overlay: makes the dragged item feel smooth & "attached" -->
				<DragOverlay>
					{#if filmstripDraggingId}
						{@const di = dndItems.find((x) => x.id === filmstripDraggingId)}
						{#if di}
							{@const tDrag = slideTemplates[di.slideIndex] ?? 'news'}
							{@const dragFont =
								tDrag === 'news'
									? `'Bebas Neue', Impact, ui-sans-serif, sans-serif`
									: `'Satoshi', ui-sans-serif, system-ui, sans-serif`}
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
												<Loader size={12} class="animate-spin text-violet-400 opacity-60" />
											</div>
										{:else if !di.text}
											<div class="absolute inset-0 flex items-center justify-center text-white/15">
												<span class="text-[10px] font-mono">…</span>
											</div>
										{:else if dragRaster}
											<img src={dragRaster} alt="" class="w-full h-full object-cover" draggable="false" />
										{:else if filmstripPreviewInFlight}
											<div class="absolute inset-0 flex items-center justify-center bg-[#111]">
												<Loader size={12} class="animate-spin text-violet-400 opacity-50" />
											</div>
										{:else if di.vid}
											<div class="absolute inset-0 bg-cyan-950/60 flex items-center justify-center">
												<Play size={14} class="text-cyan-400 opacity-80" fill="currentColor" />
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
					<!-- Click-off backdrop: closes the trimmer -->
					<div
						class="fixed inset-0 z-40"
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
			<p class="font-mono text-[9px] text-white/20 -mt-1">Drag thumbnails to reorder · Click <Flame size={9} class="inline text-orange-400/70" /> to burn music and publish as video</p>
		{/if}

		<!-- ── Prompt bar ── below the filmstrip ───────────────────── -->
		<div class="shrink-0 px-4 pt-0 pb-2">
			<div class="mx-auto w-full max-w-2xl">
				<div class="prompt-bar overflow-hidden rounded-[20px] bg-[#f5f5f5] shadow-[0_4px_24px_rgba(0,0,0,0.07),0_1px_3px_rgba(0,0,0,0.04)]">

					<!-- Search input row -->
					<div class="flex items-center gap-2.5 px-4 pt-4 pb-3">
						<Search size={14} class="shrink-0 text-[#b0b0b0]" />
						{#if newsContentMode === 'news'}
							<input
								bind:value={search}
								placeholder="Search topic (optional)…"
								onkeydown={(e) => { if (e.key === 'Enter') void loadAndFill(); }}
								class="flex-1 min-w-0 bg-transparent text-[13px] text-[#1a1a1a] placeholder:text-[#b8b8b8] outline-none ring-0 border-none font-body"
							/>
						{:else if newsContentMode === 'fact'}
							<input
								bind:value={factTopicPrompt}
								placeholder="Fact topic or angle (optional)…"
								onkeydown={(e) => { if (e.key === 'Enter') void loadAndFill(); }}
								class="flex-1 min-w-0 bg-transparent text-[13px] text-[#1a1a1a] placeholder:text-[#b8b8b8] outline-none ring-0 border-none font-body"
							/>
						{:else}
							<input
								bind:value={storyTopicPrompt}
								placeholder="Story direction (optional)…"
								onkeydown={(e) => { if (e.key === 'Enter') void loadAndFill(); }}
								class="flex-1 min-w-0 bg-transparent text-[13px] text-[#1a1a1a] placeholder:text-[#b8b8b8] outline-none ring-0 border-none font-body"
							/>
						{/if}
						{#if newsError}
							<div class="flex items-center gap-1 shrink-0">
								<AlertCircle size={11} class="text-red-500 shrink-0" />
								<span class="text-[11px] font-body text-red-500 max-w-[180px] truncate">{newsError}</span>
							</div>
						{/if}
					</div>

					<!-- Divider -->
					<div class="mx-4 h-px bg-[#e8e8e8]"></div>

					<!-- Pills + CTA row -->
					<div class="flex items-center gap-1.5 px-3 pt-2.5 pb-3">

						<!-- News pill -->
						<Popover>
							<PopoverTrigger
								onclick={() => (newsContentMode = 'news')}
								class="flex items-center gap-1.5 rounded-full border px-3 py-[7px] text-[11.5px] font-body transition-all duration-150 select-none {newsContentMode === 'news' ? 'border-[#c8c8c8] bg-white text-[#111] font-semibold' : 'border-[#e2e2e2] bg-white text-[#888] font-medium hover:border-[#c8c8c8] hover:text-[#333]'}"
							>
								<Newspaper size={11} />
								News{#if newsContentMode === 'news'}&thinsp;·&thinsp;{categories.find((c) => c.id === category)?.label ?? 'Category'}{/if}
							</PopoverTrigger>
							<PopoverContent side="top" sideOffset={12} class="w-64 gap-0 rounded-[20px] border-[#ebebeb] bg-white p-0 shadow-[0_12px_40px_rgba(0,0,0,0.12),0_2px_8px_rgba(0,0,0,0.06)] text-[#1a1a1a]">
								<div class="p-4 flex flex-col gap-3.5">
									<div>
										<p class="text-[10px] font-semibold uppercase tracking-widest text-[#b0b0b0] mb-2">Category</p>
										<Select type="single" bind:value={category}>
											<SelectTrigger class="w-full rounded-xl py-2.5 text-sm font-body border-[#ebebeb] bg-[#fafafa] hover:bg-[#f5f5f5]">
												{categories.find((c) => c.id === category)?.label ?? 'Category'}
											</SelectTrigger>
											<SelectContent>
												{#each categories as cat}
													<SelectItem value={cat.id} label={cat.label}>{cat.label}</SelectItem>
												{/each}
											</SelectContent>
										</Select>
									</div>
									<div>
										<p class="text-[10px] font-semibold uppercase tracking-widest text-[#b0b0b0] mb-2">Search (optional)</p>
										<Input bind:value={search} placeholder="e.g. interest rates, Tesla…" class="rounded-xl py-2.5 text-sm font-body border-[#ebebeb] bg-[#fafafa]" />
									</div>
								</div>
							</PopoverContent>
						</Popover>

						<!-- Random fact pill -->
						<Popover>
							<PopoverTrigger
								onclick={() => (newsContentMode = 'fact')}
								class="flex items-center gap-1.5 rounded-full border px-3 py-[7px] text-[11.5px] font-body transition-all duration-150 select-none {newsContentMode === 'fact' ? 'border-[#c8c8c8] bg-white text-[#111] font-semibold' : 'border-[#e2e2e2] bg-white text-[#888] font-medium hover:border-[#c8c8c8] hover:text-[#333]'}"
							>
								<Sparkles size={11} />
								Random fact
							</PopoverTrigger>
							<PopoverContent side="top" sideOffset={12} class="w-64 gap-0 rounded-[20px] border-[#ebebeb] bg-white p-0 shadow-[0_12px_40px_rgba(0,0,0,0.12),0_2px_8px_rgba(0,0,0,0.06)] text-[#1a1a1a]">
								<div class="p-4 flex flex-col gap-3.5">
									<p class="text-[11px] font-body text-[#999] leading-relaxed">A surprising fact-style hook + context. No news API needed.</p>
									<div>
										<p class="text-[10px] font-semibold uppercase tracking-widest text-[#b0b0b0] mb-2">Topic (optional)</p>
										<textarea
											id="pb-fact-topic"
											bind:value={factTopicPrompt}
											rows={3}
											placeholder="e.g. deep-sea creatures, Roman roads…"
											class="min-h-[4.5rem] w-full resize-y rounded-xl border border-[#ebebeb] bg-[#fafafa] px-3 py-2.5 text-sm font-body text-[#1a1a1a] placeholder:text-[#bbb] focus:outline-none focus:border-[#c4b5fd] transition-colors"
										></textarea>
									</div>
								</div>
							</PopoverContent>
						</Popover>

						<!-- Random story pill -->
						<Popover>
							<PopoverTrigger
								onclick={() => (newsContentMode = 'story')}
								class="flex items-center gap-1.5 rounded-full border px-3 py-[7px] text-[11.5px] font-body transition-all duration-150 select-none {newsContentMode === 'story' ? 'border-[#c8c8c8] bg-white text-[#111] font-semibold' : 'border-[#e2e2e2] bg-white text-[#888] font-medium hover:border-[#c8c8c8] hover:text-[#333]'}"
							>
								<Type size={11} />
								Random story{#if newsContentMode === 'story'}&thinsp;·&thinsp;{storyThemes.find((t) => t.id === storyCategory)?.label ?? 'Theme'}{/if}
							</PopoverTrigger>
							<PopoverContent side="top" sideOffset={12} class="w-72 gap-0 rounded-[20px] border-[#ebebeb] bg-white p-0 shadow-[0_12px_40px_rgba(0,0,0,0.12),0_2px_8px_rgba(0,0,0,0.06)] text-[#1a1a1a]">
								<div class="p-4 flex flex-col gap-3.5">
									<div>
										<p class="text-[10px] font-semibold uppercase tracking-widest text-[#b0b0b0] mb-2">Story theme</p>
										<Select type="single" bind:value={storyCategory}>
											<SelectTrigger class="w-full rounded-xl py-2.5 text-sm font-body border-[#ebebeb] bg-[#fafafa] hover:bg-[#f5f5f5]">
												{storyThemes.find((t) => t.id === storyCategory)?.label ?? 'Theme'}
											</SelectTrigger>
											<SelectContent>
												{#each storyThemes as th}
													<SelectItem value={th.id} label={th.label}>{th.label}</SelectItem>
												{/each}
											</SelectContent>
										</Select>
									</div>
									<div>
										<p class="text-[10px] font-semibold uppercase tracking-widest text-[#b0b0b0] mb-2">Direction (optional)</p>
										<textarea
											id="pb-story-dir"
											bind:value={storyTopicPrompt}
											rows={3}
											placeholder="e.g. two friends launch a podcast, betrayal at a wedding…"
											class="min-h-[4.5rem] w-full resize-y rounded-xl border border-[#ebebeb] bg-[#fafafa] px-3 py-2.5 text-sm font-body text-[#1a1a1a] placeholder:text-[#bbb] focus:outline-none focus:border-[#c4b5fd] transition-colors"
										></textarea>
									</div>
								</div>
							</PopoverContent>
						</Popover>

						<!-- Settings popover -->
						<Popover>
							<PopoverTrigger
								class="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full border border-[#e2e2e2] bg-white text-[#999] transition-all duration-150 hover:border-[#c8c8c8] hover:text-[#444]"
								title="Settings"
							>
								<SlidersHorizontal size={12} />
							</PopoverTrigger>
							<PopoverContent side="top" sideOffset={12} align="start" class="w-80 gap-0 rounded-[20px] border-[#ebebeb] bg-white p-0 shadow-[0_12px_40px_rgba(0,0,0,0.12),0_2px_8px_rgba(0,0,0,0.06)] text-[#1a1a1a]">
								<div class="p-4 flex flex-col gap-4">
									<!-- Data source -->
									<div class="flex items-center justify-between gap-3 rounded-xl bg-[#fafafa] border border-[#ebebeb] px-3 py-2.5">
										<div class="flex items-center gap-2">
											{#if useTestData}
												<FlaskConical size={12} class="text-amber-500" />
												<span class="text-xs font-medium text-amber-600">Test data</span>
											{:else}
												<Wifi size={12} class="text-emerald-500" />
												<span class="text-xs font-medium text-emerald-600">Live API</span>
											{/if}
										</div>
										<Switch bind:checked={useTestData} title={useTestData ? 'Switch to Live API' : 'Switch to Test Data'} class="shrink-0" />
									</div>

									{#if activeTemplate === 'news'}
										<!-- Source label -->
										<div class="space-y-2.5 pt-3.5 border-t border-[#f2f2f2]">
											<div class="flex items-center justify-between gap-2">
												<Label class="text-[10px] font-semibold uppercase tracking-widest text-[#b0b0b0]">Source Label</Label>
												<div class="flex items-center gap-0.5 rounded-lg border border-[#ebebeb] bg-[#f5f5f5] p-0.5">
													<Button type="button" variant={sourceLabelMode === 'text' ? 'secondary' : 'ghost'} size="sm" class="h-6 rounded-md px-2.5 text-[10px] font-semibold" onclick={() => (sourceLabelMode = 'text')}>Text</Button>
													<Button type="button" variant={sourceLabelMode === 'logo' ? 'secondary' : 'ghost'} size="sm" class="h-6 rounded-md px-2.5 text-[10px] font-semibold" onclick={() => (sourceLabelMode = 'logo')}>Logo</Button>
												</div>
											</div>
											{#if sourceLabelMode === 'text'}
												<Input bind:value={source} placeholder="Markets" class="rounded-xl py-2.5 text-sm font-body border-[#ebebeb] bg-[#fafafa]" />
											{:else}
												<div class="flex items-center gap-2">
													<input type="file" accept="image/*" class="sr-only" tabindex={-1} aria-hidden="true" bind:this={sourceLogoInput}
														onchange={async (e) => {
															const file = (e.currentTarget as HTMLInputElement).files?.[0];
															if (!file) return;
															sourceLogoSrc = await new Promise<string>((res, rej) => {
																const fr = new FileReader();
																fr.onload = () => res(String(fr.result ?? ''));
																fr.onerror = () => rej(fr.error);
																fr.readAsDataURL(file);
															});
															(e.currentTarget as HTMLInputElement).value = '';
														}}
													/>
													<Button type="button" variant="outline" size="sm" class="h-8 rounded-lg text-[11px] font-semibold border-[#ebebeb]" onclick={() => sourceLogoInput?.click()}>
														{sourceLogoSrc ? 'Replace logo' : 'Add logo'}
													</Button>
													{#if sourceLogoSrc}
														<Button type="button" variant="ghost" size="sm" class="h-8 rounded-lg text-[11px]" onclick={() => (sourceLogoSrc = '')}>Remove</Button>
														<div class="ml-auto h-8 w-8 rounded-lg border border-[#ebebeb] overflow-hidden grid place-items-center">
															<img src={sourceLogoSrc} alt="" class="h-full w-full object-contain p-1" draggable="false" />
														</div>
													{/if}
												</div>
												<div class="flex min-w-0 items-center gap-2 pt-1">
													<Label class="w-12 shrink-0 text-[9px] text-[#b0b0b0]">Width</Label>
													<Slider type="single" bind:value={sourceLogoWidth} min={80} max={400} step={4} class="min-w-0 flex-1" />
													<span class="w-10 shrink-0 text-right text-[9px] text-[#b0b0b0]">{sourceLogoWidth}px</span>
												</div>
											{/if}
										</div>
										<!-- Word highlights -->
										<div class="flex items-center justify-between gap-3 rounded-xl border border-[#ebebeb] bg-[#fafafa] px-3 py-2.5">
											<div class="min-w-0">
												<Label for="settings-highlights-toggle" class="text-xs font-semibold text-[#333] block">Word highlights</Label>
												<p class="text-[10px] text-[#aaa] leading-snug mt-0.5">[[markup]] for coloured words in News.</p>
											</div>
											<Switch id="settings-highlights-toggle" bind:checked={studioTextHighlightsEnabled} class="shrink-0" />
										</div>
									{/if}

									<!-- Bottom shadow -->
									<div class="pt-3.5 border-t border-[#f2f2f2]">
										<div class="mb-2.5 flex items-center justify-between">
											<Label class="text-[10px] font-semibold uppercase tracking-widest text-[#b0b0b0]">Bottom Shadow</Label>
											<Button type="button" variant="ghost" size="sm" class="h-auto p-0 text-[9px] text-[#bbb] hover:text-[#555]" onclick={() => { shadowHeight = 75; shadowStrength = 1; }}>Reset</Button>
										</div>
										<div class="mb-2 flex min-w-0 items-center gap-2">
											<span class="w-10 shrink-0 text-[9px] text-[#b0b0b0]">Height</span>
											<Slider type="single" bind:value={shadowHeight} min={0} max={100} step={1} class="min-w-0 flex-1" />
											<span class="w-8 shrink-0 text-right text-[9px] text-[#b0b0b0]">{shadowHeight}%</span>
										</div>
										<div class="flex min-w-0 items-center gap-2">
											<span class="w-10 shrink-0 text-[9px] text-[#b0b0b0]">Darkness</span>
											<Slider type="single" bind:value={shadowStrength} min={0} max={1} step={0.05} class="min-w-0 flex-1" />
											<span class="w-8 shrink-0 text-right text-[9px] text-[#b0b0b0]">{Math.round(shadowStrength * 100)}%</span>
										</div>
									</div>

									<!-- Background (non-news) -->
									{#if activeTemplate !== 'news'}
										<div class="pt-3.5 border-t border-[#f2f2f2] flex flex-col gap-2">
											<p class="text-[10px] font-semibold uppercase tracking-widest text-[#b0b0b0]">Background — Slide {activeSlide + 1}</p>
											<div class="grid grid-cols-2 gap-2">
												<label class={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'h-auto w-full cursor-pointer gap-1.5 py-2 font-body text-xs font-semibold text-muted-foreground rounded-xl border-[#ebebeb]')}>
													<Image size={11} /> Photo
													<input type="file" accept="image/*" class="sr-only" onchange={handleBgUpload} />
												</label>
												<label class={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'h-auto w-full cursor-pointer gap-1.5 py-2 font-body text-xs font-semibold text-muted-foreground rounded-xl border-[#ebebeb]')}>
													<Play size={11} class="shrink-0" /> Video
													<input type="file" accept="video/mp4,video/webm,video/quicktime" class="sr-only" onchange={handleVideoUpload} />
												</label>
											</div>
											{#if effectiveBackgroundVideo}
												<div class="flex items-center gap-2 px-2.5 py-2 rounded-xl bg-cyan-50 border border-cyan-100">
													<span class="text-cyan-500 text-[11px]">▶</span>
													<span class="text-[11px] text-cyan-600 flex-1 truncate">Video active</span>
													<Button type="button" variant="ghost" size="icon-xs" class="text-[#bbb] hover:text-red-500" onclick={() => clearSlideBackground(activeSlide)}>✕</Button>
												</div>
											{/if}
											{#if backgroundImage || backgroundVideo}
												<div class="flex flex-col gap-1.5 pt-1">
													<p class="text-[10px] font-semibold uppercase tracking-widest text-[#b0b0b0] mb-0.5">Position</p>
													<div class="flex min-w-0 items-center gap-2.5">
														<span class="w-3 shrink-0 text-[10px] text-[#c0c0c0]">←</span>
														<Slider type="single" bind:value={bgOffsetX} min={-55} max={155} step={0.5} class="min-w-0 flex-1" />
														<span class="w-3 text-right text-[10px] text-[#c0c0c0]">→</span>
													</div>
													<div class="flex min-w-0 items-center gap-2.5">
														<span class="w-3 shrink-0 text-[10px] text-[#c0c0c0]">↑</span>
														<Slider type="single" bind:value={bgOffsetY} min={-55} max={155} step={0.5} class="min-w-0 flex-1" />
														<span class="w-3 text-right text-[10px] text-[#c0c0c0]">↓</span>
													</div>
													<div class="flex min-w-0 items-center gap-2.5">
														<span class="w-3 shrink-0 text-[10px] text-[#c0c0c0]">−</span>
														<Slider type="single" bind:value={bgZoom} min={30} max={300} step={1} class="min-w-0 flex-1" />
														<span class="w-3 text-right text-[10px] text-[#c0c0c0]">+</span>
													</div>
												</div>
											{/if}
										</div>
									{/if}
								</div>
							</PopoverContent>
						</Popover>

						<div class="flex-1"></div>

						<!-- Submit button — dark circle with arrow -->
						<button
							type="button"
							onclick={() => void loadAndFill()}
							disabled={fetchingNews}
							title={fetchingNews ? (useTestData ? 'Loading…' : newsContentMode === 'news' ? 'Fetching…' : 'Generating…') : 'Load & Fill'}
							class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#1a1a1a] text-white transition-all duration-150 hover:bg-[#333] hover:shadow-[0_4px_14px_rgba(0,0,0,0.25)] active:scale-[0.93] disabled:opacity-40 disabled:cursor-not-allowed"
						>
							{#if fetchingNews}
								<Loader size={15} class="animate-spin" />
							{:else}
								<ArrowUp size={15} strokeWidth={2.5} />
							{/if}
						</button>
					</div>
				</div>
				{#if articleUrl}
					<a
						href={articleUrl}
						target="_blank"
						rel="noopener noreferrer"
						class="mt-2 block text-center text-[11px] font-body text-[#c0c0c0] transition-colors hover:text-violet-400"
					>View source article ↗</a>
				{/if}
			</div>
			<!-- /Prompt bar (below filmstrip) -->
		</div>
	</div>

</div>

{#if circleAIModalFor !== null}
	<!-- Circle AI prompt modal — Krea-style floating bar -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="fixed inset-0 z-[100] flex items-end justify-center pb-8"
		onclick={closeCircleAIModal}
	>
		<div
			class="absolute inset-0 backdrop-blur-[2px]"
			style="background: color-mix(in oklab, var(--app-text) {uiTheme === 'light' ? '18%' : '40%'}, transparent);"
		></div>
		<div
			class="relative w-[580px] max-w-[94vw] rounded-[24px] border border-[#e8e8e8] bg-white p-0 overflow-hidden"
			style="box-shadow: 0 24px 64px rgba(0,0,0,0.14), 0 2px 8px rgba(0,0,0,0.06);"
			onclick={(e) => e.stopPropagation()}
		>
			<!-- Input area -->
			<div class="px-4 pt-4 pb-3">
				<div class="flex items-start gap-3">
					<Sparkles size={15} class="mt-0.5 shrink-0 text-[#c0c0c0]" />
					<input
						id="circle-ai-prompt-input"
						bind:value={circleAIPrompt}
						placeholder="Describe an image and click generate…"
						class="flex-1 min-w-0 bg-transparent text-[13px] font-body text-[#1a1a1a] placeholder:text-[#b8b8b8] outline-none"
						onkeydown={(e) => { if (e.key === 'Enter') submitCircleAIModal(); if (e.key === 'Escape') closeCircleAIModal(); }}
						autofocus
					/>
					<button
						type="button"
						onclick={closeCircleAIModal}
						class="w-7 h-7 rounded-full border border-[#e8e8e8] bg-[#f5f5f5] text-[#aaa] flex items-center justify-center transition-colors hover:bg-[#ebebeb] hover:text-[#555] shrink-0"
						aria-label="Close"
					>
						<X size={12} />
					</button>
				</div>
				<p class="text-[10.5px] font-body mt-2.5 ml-6 text-[#c0c0c0] leading-relaxed">
					Describe a subject &amp; vibe — keep it short, no text in image.
				</p>
			</div>

			<!-- Divider -->
			<div class="mx-4 h-px bg-[#f0f0f0]"></div>

			<!-- Bottom action bar -->
			<div class="flex items-center gap-1.5 px-3 py-2.5">
				<!-- Decorative info pill -->
				<div class="flex items-center gap-1.5 rounded-full border border-[#e8e8e8] bg-[#fafafa] px-3 py-[6px] text-[11px] font-medium text-[#888]">
					<Sparkles size={10} class="text-violet-400" />
					Circle AI
				</div>

				<div class="flex-1"></div>

				<!-- Cancel -->
				<button
					type="button"
					onclick={closeCircleAIModal}
					class="flex items-center gap-1.5 rounded-full border border-[#e8e8e8] bg-white px-3.5 py-[7px] text-[11.5px] font-medium text-[#888] transition-all duration-150 hover:border-[#d0d0d0] hover:text-[#444] hover:bg-[#fafafa]"
				>
					Cancel
				</button>

				<!-- Generate -->
				<button
					type="button"
					onclick={submitCircleAIModal}
					disabled={circleAIGenerating || !circleAIPrompt.trim()}
					class="flex items-center gap-1.5 rounded-full bg-[#c8f050] px-4 py-[7px] text-[12px] font-semibold font-body text-[#1a1a1a] transition-all duration-150 hover:bg-[#d4f565] hover:shadow-[0_4px_16px_rgba(160,220,30,0.35)] active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed"
				>
					{#if circleAIGenerating}
						<Loader size={11} class="animate-spin" /> Generating…
					{:else}
						Generate
					{/if}
				</button>
			</div>
		</div>
	</div>
{/if}

<!-- News: use dock “BG tools” to open; canvas is for drag-pan only -->
<NewsBackgroundToolbar
	anchor={newsBgToolbarAnchor}
	showCutout={!!String(canvasBackgroundImage ?? '').trim() && !String(canvasBackgroundVideo ?? '').trim()}
	onAi={() => void generateBackground(paintSlide, undefined, 'news')}
	aiDisabled={!!(generatingImagesByTemplate.news ?? [])[paintSlide]}
	onCutOut={() => void cutOutSubject(paintSlide)}
	onReplace={() => newsBgToolbarMediaInput?.click()}
	onApplySolid={(hex) => {
		pushUndo('news', paintSlide);
		applyNewsSolidBg(hex, paintSlide);
		closeNewsBgToolbar();
	}}
	solidPresets={NEWS_SOLID_PRESETS}
	onClose={closeNewsBgToolbar}
/>

<!-- Text carousel profile circle -->
<TextCarouselAvatarToolbar
	anchor={selectedText === 'textCarouselAvatar' ? toolbarAnchor : null}
	avatarSrc={textCarouselAvatarImageBySlide[paintSlide] ?? ''}
	innerBg={textCarouselAvatarInnerBgBySlide[paintSlide] ?? ''}
	label={textCarouselAvatarLabelBySlide[paintSlide] ?? ''}
	nameFallback={textCarouselNameBySlide[paintSlide] ?? ''}
	defaultInnerBg={textCarouselDefaultAvatarBg}
	onImageFile={(dataUrl) => {
		if (!canvasInteractive) return;
		pushUndo('textCarousel', paintSlide);
		textCarouselAvatarImageBySlide = textCarouselAvatarImageBySlide.map((x, i) =>
			i === paintSlide ? dataUrl : x,
		);
		requestAnimationFrame(() => {
			if (toolbarTarget) toolbarAnchor = toolbarTarget.getBoundingClientRect();
		});
	}}
	onClearImage={() => {
		if (!canvasInteractive) return;
		pushUndo('textCarousel', paintSlide);
		textCarouselAvatarImageBySlide = textCarouselAvatarImageBySlide.map((x, i) => (i === paintSlide ? '' : x));
		requestAnimationFrame(() => {
			if (toolbarTarget) toolbarAnchor = toolbarTarget.getBoundingClientRect();
		});
	}}
	onInnerBg={(hex) => {
		if (!canvasInteractive) return;
		pushUndo('textCarousel', paintSlide);
		textCarouselAvatarInnerBgBySlide = textCarouselAvatarInnerBgBySlide.map((x, i) => (i === paintSlide ? hex : x));
	}}
	onClearInnerBg={() => {
		if (!canvasInteractive) return;
		pushUndo('textCarousel', paintSlide);
		textCarouselAvatarInnerBgBySlide = textCarouselAvatarInnerBgBySlide.map((x, i) => (i === paintSlide ? '' : x));
	}}
	onLabel={(value) => {
		if (!canvasInteractive) return;
		pushUndo('textCarousel', paintSlide);
		textCarouselAvatarLabelBySlide = textCarouselAvatarLabelBySlide.map((x, i) => (i === paintSlide ? value : x));
	}}
	onClose={closeToolbar}
/>

<!-- Tweet profile circles (same chrome as text carousel) -->
<TextCarouselAvatarToolbar
	anchor={selectedText === 'tweetTopAvatar' ? toolbarAnchor : null}
	avatarSrc={tweetTopAvatarImageBySlide[paintSlide] ?? ''}
	innerBg={tweetTopAvatarInnerBgBySlide[paintSlide] ?? ''}
	label={tweetTopAvatarLabelBySlide[paintSlide] ?? ''}
	nameFallback={tweetTopNameBySlide[paintSlide] ?? ''}
	defaultInnerBg={textCarouselDefaultAvatarBg}
	onImageFile={(dataUrl) => {
		if (!canvasInteractive) return;
		pushUndo('tweet', paintSlide);
		tweetTopAvatarImageBySlide = tweetTopAvatarImageBySlide.map((x, i) => (i === paintSlide ? dataUrl : x));
		requestAnimationFrame(() => {
			if (toolbarTarget) toolbarAnchor = toolbarTarget.getBoundingClientRect();
		});
	}}
	onClearImage={() => {
		if (!canvasInteractive) return;
		pushUndo('tweet', paintSlide);
		tweetTopAvatarImageBySlide = tweetTopAvatarImageBySlide.map((x, i) => (i === paintSlide ? '' : x));
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
	onLabel={(value) => {
		if (!canvasInteractive) return;
		pushUndo('tweet', paintSlide);
		tweetTopAvatarLabelBySlide = tweetTopAvatarLabelBySlide.map((x, i) => (i === paintSlide ? value : x));
	}}
	onClose={closeToolbar}
/>
<TextCarouselAvatarToolbar
	anchor={selectedText === 'tweetBottomAvatar' ? toolbarAnchor : null}
	avatarSrc={tweetBottomAvatarImageBySlide[paintSlide] ?? ''}
	innerBg={tweetBottomAvatarInnerBgBySlide[paintSlide] ?? ''}
	label={tweetBottomAvatarLabelBySlide[paintSlide] ?? ''}
	nameFallback={tweetBottomNameBySlide[paintSlide] ?? ''}
	defaultInnerBg={textCarouselDefaultAvatarBg}
	onImageFile={(dataUrl) => {
		if (!canvasInteractive) return;
		pushUndo('tweet', paintSlide);
		tweetBottomAvatarImageBySlide = tweetBottomAvatarImageBySlide.map((x, i) => (i === paintSlide ? dataUrl : x));
		requestAnimationFrame(() => {
			if (toolbarTarget) toolbarAnchor = toolbarTarget.getBoundingClientRect();
		});
	}}
	onClearImage={() => {
		if (!canvasInteractive) return;
		pushUndo('tweet', paintSlide);
		tweetBottomAvatarImageBySlide = tweetBottomAvatarImageBySlide.map((x, i) => (i === paintSlide ? '' : x));
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
	onLabel={(value) => {
		if (!canvasInteractive) return;
		pushUndo('tweet', paintSlide);
		tweetBottomAvatarLabelBySlide = tweetBottomAvatarLabelBySlide.map((x, i) => (i === paintSlide ? value : x));
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
		selectedText === 'tweetTopMedia'
		? null
		: toolbarAnchor}
	style={toolbarFloatingStyle}
	autoFontSize={toolbarAutoFontSize ?? (selectedText === 'source' ? 34 : selectedText === 'textOverlay' ? 42 : undefined)}
	deleteOnly={selectedText === 'articleImage' || selectedText === 'articleLogo'}
	supportsHighlights={studioTextHighlightsEnabled &&
		previewTemplate === 'news' &&
		(selectedText === 'headline' || (selectedText === 'textOverlay' && !!selectedTextOverlayId))}
	hasRangeSelection={hasRangeSelection}
	textColorMixed={toolbarTextColorMixed}
	onChange={onFloatingToolbarChange}
	onHighlight={studioTextHighlightsEnabled && previewTemplate === 'news' ? onHighlight : undefined}
	onClose={closeToolbar}
	onDelete={
		selectedText &&
			selectedText !== 'textCarouselAvatar' &&
			selectedText !== 'tweetTopAvatar' &&
			selectedText !== 'tweetBottomAvatar' &&
			selectedText !== 'tweetTopMedia' &&
			(selectedText !== 'textOverlay' || !!selectedTextOverlayId)
			? handleFloatingToolbarDelete
			: undefined
	}
/>

<style>
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
		font-family: 'Satoshi', -apple-system, BlinkMacSystemFont, sans-serif;
	}
	:root:not([data-theme="dark"]) .studio-right {
		background: var(--app-bg) !important;
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

	/* — Prompt bar: kill ALL focus rings/outlines on the bare inputs — */
	:global(.prompt-bar input),
	:global(.prompt-bar input:focus),
	:global(.prompt-bar input:focus-visible) {
		outline: none !important;
		box-shadow: none !important;
		border: none !important;
		background-color: transparent !important;
		accent-color: transparent;
	}

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
