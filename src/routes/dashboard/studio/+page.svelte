<script lang="ts">
	import { supabase } from '$lib/supabase';
	import { onMount, tick } from 'svelte';
	import { goto } from '$app/navigation';
import { toPng } from 'html-to-image';
import JSZip from 'jszip';
	import NewsTemplate from '$lib/components/templates/NewsTemplate.svelte';
	import TweetTemplate from '$lib/components/templates/TweetTemplate.svelte';
	import ArticleTemplate from '$lib/components/templates/ArticleTemplate.svelte';
	import TextCarouselTemplate from '$lib/components/templates/TextCarouselTemplate.svelte';
	import ImageQuoteTemplate from '$lib/components/templates/ImageQuoteTemplate.svelte';
	import TextOverlayLayer from '$lib/components/TextOverlayLayer.svelte';
	import FloatingActions from '$lib/components/FloatingActions.svelte';
	import FloatingTextToolbar from '$lib/components/FloatingTextToolbar.svelte';
	import HighlightEditor from '$lib/components/HighlightEditor.svelte';
	import { DragDropProvider, DragOverlay } from '@dnd-kit-svelte/svelte';
	import { PointerSensor } from '@dnd-kit-svelte/svelte';
	import { PointerActivationConstraints } from '@dnd-kit/dom';
	import { useSortable, isSortable } from '@dnd-kit-svelte/svelte/sortable';
	import { RestrictToHorizontalAxis } from '@dnd-kit-svelte/svelte/modifiers';
	import { move } from '@dnd-kit/helpers';
	import { applyHighlight, type HighlightSpec } from '$lib/highlight';
	import type { Overlay, TextOverlay, TextStyle, TextElementKind } from '$lib/types';
	import { removeBackground } from '$lib/backgroundRemoval';
	import {
		Newspaper, Sparkles, RefreshCw, Download, Loader, AlertCircle,
		Image, Type, ChevronDown, Search, FlaskConical, Wifi, Layers,
		Scissors, Volume2, VolumeX, Eye, EyeOff, Flame, Music, Play, X, Undo2
	} from 'lucide-svelte';

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

	// News controls
	let search = $state('');
	let category = $state('business');
	/** Sidebar mode for the News template generator: live articles vs synthetic fact/story. */
	type NewsStudioContentMode = 'news' | 'fact' | 'story';
	let newsContentMode = $state<NewsStudioContentMode>('news');
	let storyCategory = $state('health');
	let slideCount = $state(3); // 1–10

	// Preview/edit view toggle for the canvas area.
	let fetchingNews = $state(false);
	let generatingVariants = $state(false);
	let newsError = $state('');

	// Multi-slide state
	let slides = $state<string[]>(['YOUR HEADLINE WILL APPEAR HERE ONCE YOU FETCH A NEWS STORY']);
	let activeSlide = $state(0);
	let articleSnippet = $state(''); // full article text for variants call

	// ── Per-slide template selection ──────────────────────────────────────
	type TemplateId = 'news' | 'tweet' | 'article' | 'textCarousel' | 'imageQuote';
	type TemplateDef = { id: TemplateId; label: string };
	const TEMPLATES: TemplateDef[] = [
		{ id: 'news', label: 'News' },
		{ id: 'tweet', label: 'Tweet' },
		{ id: 'article', label: 'Article' },
		{ id: 'textCarousel', label: 'Text carousel' },
		{ id: 'imageQuote', label: 'Image quote' },
	];
	let slideTemplates = $state<TemplateId[]>(['news']);
	let lastTemplateUsed = $state<TemplateId>('news');
	const activeTemplate = $derived(slideTemplates[activeSlide] ?? 'news');
	function setActiveTemplate(t: TemplateId) {
		lastTemplateUsed = t;
		slideTemplates = slideTemplates.map((x, i) => (i === activeSlide ? t : x));
	}
	function applyTemplateToAll(t: TemplateId) {
		lastTemplateUsed = t;
		slideTemplates = slideTemplates.map(() => t);
	}

	// ── Undo (scoped to current template + slide) ─────────────────────────
	type ScopedSnapshot =
		| { template: 'tweet'; slide: number; data: { topName: string; topHandle: string; bottomName: string; bottomHandle: string; topText: string; bottomText: string; replyCount: string; repostCount: string; likeCount: string; topImage: string; styles: Partial<Record<TextElementKind, TextStyle>>; offsets: Record<string, { x: number; y: number }> } }
		| { template: 'textCarousel'; slide: number; data: { name: string; handle: string; text: string; styles: Partial<Record<TextElementKind, TextStyle>>; offsets: Record<string, { x: number; y: number }> } }
		| { template: 'article'; slide: number; data: { text: string; swipeText: string; image: string; styles: Partial<Record<TextElementKind, TextStyle>>; offsets: Record<string, { x: number; y: number }> } }
		| { template: 'news'; slide: number; data: { headline: string; source: string; image: string; video: string; styles: Partial<Record<TextElementKind, TextStyle>>; offsets: Record<string, { x: number; y: number }> } }
		| { template: 'imageQuote'; slide: number; data: { text: string; image: string; styles: Partial<Record<TextElementKind, TextStyle>>; offsets: Record<string, { x: number; y: number }> } };

	type ScopedHistory = { undo: ScopedSnapshot[]; redo: ScopedSnapshot[]; lastSig?: string };
	let historyByTemplateBySlide = $state<Record<TemplateId, ScopedHistory[]>>({
		news: [],
		tweet: [],
		article: [],
		textCarousel: [],
		imageQuote: [],
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
			return;
		}
		if (t === 'textCarousel') {
			const d = snap.data;
			textCarouselNameBySlide = textCarouselNameBySlide.map((x, idx) => (idx === i ? d.name : x));
			textCarouselHandleBySlide = textCarouselHandleBySlide.map((x, idx) => (idx === i ? d.handle : x));
			textCarouselTextBySlide = textCarouselTextBySlide.map((x, idx) => (idx === i ? d.text : x));
			return;
		}
		if (t === 'article') {
			const d = snap.data;
			articleTextBySlide = articleTextBySlide.map((x, idx) => (idx === i ? d.text : x));
			articleSwipeTextBySlide = articleSwipeTextBySlide.map((x, idx) => (idx === i ? d.swipeText : x));
			bgImagesByTemplate = { ...bgImagesByTemplate, article: (bgImagesByTemplate.article ?? []).map((x, idx) => (idx === i ? d.image : x)) };
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
		historyByTemplateBySlide = { ...historyByTemplateBySlide, [template]: historyByTemplateBySlide[template].map((r, i) => (i === slide ? row : r)) };
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
		historyByTemplateBySlide = { ...historyByTemplateBySlide, [t]: historyByTemplateBySlide[t].map((r, i) => (i === s ? row : r)) };
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
		historyByTemplateBySlide = { ...historyByTemplateBySlide, [t]: historyByTemplateBySlide[t].map((r, i) => (i === s ? row : r)) };
		applySnapshot(next);
	}

	function resetActiveTemplateContent() {
		const i = activeSlide;
		pushUndo(activeTemplate, i);
		// Reset content (demo defaults) + clear style overrides for this template+slide.
		if (activeTemplate === 'news') {
			// Headline text for News lives in `slides` / `overlayText`.
			const base = 'YOUR HEADLINE WILL APPEAR HERE ONCE YOU FETCH A NEWS STORY';
			slides = slides.map((x, idx) => (idx === i ? base : x));
			setActiveSlideText(base);
			source = 'Markets';
		} else if (activeTemplate === 'tweet') {
			tweetTopNameBySlide = tweetTopNameBySlide.map((x, idx) => (idx === i ? 'Chef 👨‍🍳' : x));
			tweetTopHandleBySlide = tweetTopHandleBySlide.map((x, idx) => (idx === i ? '@chefsevenn' : x));
			tweetBottomNameBySlide = tweetBottomNameBySlide.map((x, idx) => (idx === i ? 'Mo Mohler' : x));
			tweetBottomHandleBySlide = tweetBottomHandleBySlide.map((x, idx) => (idx === i ? '@MoMohler' : x));
			tweetTopTextBySlide = tweetTopTextBySlide.map((x, idx) => (idx === i ? 'Ketchup or mayo or mustard?' : x));
			tweetBottomTextBySlide = tweetBottomTextBySlide.map((x, idx) => (idx === i ? '' : x));
			tweetReplyCountBySlide = tweetReplyCountBySlide.map((x, idx) => (idx === i ? '4.2K' : x));
			tweetRepostCountBySlide = tweetRepostCountBySlide.map((x, idx) => (idx === i ? '12.8K' : x));
			tweetLikeCountBySlide = tweetLikeCountBySlide.map((x, idx) => (idx === i ? '89.4K' : x));
			tweetStylesBySlide = tweetStylesBySlide.map((s, idx) => (idx === i ? {} : s));
		} else if (activeTemplate === 'article') {
			articleTextBySlide = articleTextBySlide.map((x, idx) =>
				idx === i
					? "Here's the trillion-dollar problem everyone avoids.\n\nTo break it down:\n\nA *1-gigawatt AI data center* costs roughly *$80B* to build & operate."
					: x,
			);
			articleSwipeTextBySlide = articleSwipeTextBySlide.map((x, idx) => (idx === i ? '«« Swipe' : x));
		} else if (activeTemplate === 'textCarousel') {
			textCarouselNameBySlide = textCarouselNameBySlide.map((x, idx) => (idx === i ? 'Captains of industry' : x));
			textCarouselHandleBySlide = textCarouselHandleBySlide.map((x, idx) => (idx === i ? '@captainsofindustryy' : x));
			textCarouselTextBySlide = textCarouselTextBySlide.map((x, idx) =>
				idx === i
					? 'Lead with a sharp hook on the first line.\n\nUse the second beat for proof, tone, or a CTA — keep it scannable.'
					: x,
			);
		}

		// Clear style overrides for this template+slide.
		stylesByTemplateBySlide = {
			...stylesByTemplateBySlide,
			[activeTemplate]: (stylesByTemplateBySlide[activeTemplate] ?? []).map((m, idx) => (idx === i ? {} : m)),
		};
		// Close any floating toolbar selection.
		closeToolbar();
	}

	// Allow starter-template cards to deep-link into Studio with a template preselected.
	onMount(() => {
		if (initialTemplateParamApplied) return;
		initialTemplateParamApplied = true;
		if (typeof window === 'undefined') return;
		const raw = new URLSearchParams(window.location.search).get('template') ?? '';
		const map: Record<string, TemplateId> = {
			news: 'news',
			tweet: 'tweet',
			article: 'article',
			text: 'textCarousel',
			textCarousel: 'textCarousel',
			'image-quote': 'imageQuote',
			imageQuote: 'imageQuote',
		};
		// Unknown / removed templates should fall back safely to News.
		const next = map[raw] ?? (raw ? 'news' : undefined);
		if (!next) return;
		forcedTemplateFromQuery = next;
		applyTemplateToAll(next);
	});

	// Convenience derived for current active slide text
	const overlayText = $derived(slides[activeSlide] ?? '');
	function setActiveSlideText(val: string) {
		slides = slides.map((s, i) => i === activeSlide ? val : s);
	}

	// Post data
	let source = $state('Markets');
	let articleUrl = $state('');
	let articleTitle = $state('');

	// Background media — per template, per slide (keep EVERYTHING independent).
	let bgImagesByTemplate = $state<Record<TemplateId, string[]>>({
		news: [],
		tweet: [],
		article: [],
		textCarousel: [],
		imageQuote: [],
	});
	let bgVideosByTemplate = $state<Record<TemplateId, string[]>>({
		news: [],
		tweet: [],
		article: [],
		textCarousel: [],
		imageQuote: [],
	}); // blob URLs — per template, per slide
	let generatingImagesByTemplate = $state<Record<TemplateId, boolean[]>>({
		news: [],
		tweet: [],
		article: [],
		textCarousel: [],
		imageQuote: [],
	}); // per template, per slide

	// Video trim (per slide, seconds) — used for preview and later export.
	let videoTrimStartSecBySlide = $state<number[]>([]);
	let videoTrimEndSecBySlide = $state<number[]>([]);
	let videoDurationBySlide = $state<number[]>([]);
	// Video audio (per slide) — preview only.
	let videoMutedBySlide = $state<boolean[]>([]);
	let videoVolumeBySlide = $state<number[]>([]);
	let showVideoTrim = $state(false);
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

	const activeCutout = $derived(subjectCutouts[activeSlide] ?? '');
	const activeShowCutout = $derived(showCutout[activeSlide] ?? false);
	const activeCutting = $derived(cuttingOut[activeSlide] ?? false);
	let showCircle = $state(true);       // toggle — default ON
	// Circle images are per-slide (so each slide can have its own badge photo).
	let circleImages = $state<string[]>([]);
	let circleBorderColor = $state('#FFFFFF');
	// Optional second circle is also per-slide.
	let showCircle2BySlide = $state<boolean[]>([]);
	let circle2Images = $state<string[]>([]);
	let circle2BorderColor = $state('#FFFFFF');
	let generatingCircle = $state(false);
	let bgError = $state('');

	const activeCircleImage = $derived(circleImages[activeSlide] ?? '');
	const activeCircle2Image = $derived(circle2Images[activeSlide] ?? '');
	const activeShowCircle2 = $derived(showCircle2BySlide[activeSlide] ?? false);

	// Convenience: active template's image / video (News uses these; other templates can too)
	const backgroundImage = $derived((bgImagesByTemplate[activeTemplate] ?? [])[activeSlide] ?? '');
	const backgroundVideo = $derived((bgVideosByTemplate[activeTemplate] ?? [])[activeSlide] ?? '');

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
		const template = activeTemplate;
		const { images, videos } = templateMediaArraysPadded(template, i);
		const old = videos[i];
		if (old?.startsWith('blob:')) URL.revokeObjectURL(old);
		bgVideosByTemplate = { ...bgVideosByTemplate, [template]: videos.map((v, idx) => idx === i ? '' : v) };
		bgImagesByTemplate = { ...bgImagesByTemplate, [template]: images.map((img, idx) => idx === i ? '' : img) };
		videoTrimStartSecBySlide = Array.from({ length: slides.length }, (_, idx) => (idx === i ? 0 : (Number.isFinite(videoTrimStartSecBySlide[idx]) ? Math.max(0, videoTrimStartSecBySlide[idx]) : 0)));
		videoTrimEndSecBySlide = Array.from({ length: slides.length }, (_, idx) => (idx === i ? 0 : (Number.isFinite(videoTrimEndSecBySlide[idx]) ? Math.max(0, videoTrimEndSecBySlide[idx]) : 0)));
		videoDurationBySlide = Array.from({ length: slides.length }, (_, idx) => (idx === i ? 0 : (Number.isFinite(videoDurationBySlide[idx]) ? Math.max(0, videoDurationBySlide[idx]) : 0)));
		videoMutedBySlide = Array.from({ length: slides.length }, (_, idx) => (idx === i ? true : (videoMutedBySlide[idx] ?? true)));
		videoVolumeBySlide = Array.from({ length: slides.length }, (_, idx) => (idx === i ? 0.8 : (Number.isFinite(videoVolumeBySlide[idx]) ? Math.max(0, Math.min(1, videoVolumeBySlide[idx])) : 0.8)));
		if (i === activeSlide) { showVideoTrim = false; videoSeekSec = NaN; }
	}

	// Style
	let highlightColor = $state('#F5A623');
	// Default to light-mode friendly; updated onMount to match global theme.
	let textColor = $state('#0a0a0a');
	let textColorTouched = $state(false);
	let uiTheme = $state<'light' | 'dark'>('light');

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

	// Background pan (0–100 %)
	let bgOffsetX = $state(50); // horizontal: 0=left, 100=right
	let bgOffsetY = $state(50); // vertical:   0=top,  100=bottom
	let bgZoom    = $state(100); // background zoom %: <100 shrinks/letterboxes, >100 zooms in

	// Text panel drag (template px)
	let textPanelOffsetY = $state(0);
	let shadowHeight = $state(75);   // % of canvas covered by bottom shadow
	let shadowStrength = $state(1);  // 0–1 opacity multiplier

	// Image overlays — per slide, per template (so templates are independent)
	let slideOverlaysByTemplate = $state<Record<TemplateId, Overlay[][]>>({
		news: [[]],
		tweet: [[]],
		article: [[]],
		textCarousel: [[]],
		imageQuote: [[]],
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
		news: [[]],
		tweet: [[]],
		article: [[]],
		textCarousel: [[]],
		imageQuote: [[]],
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
		slides = [...slides, ''];
		slideCount = slides.length;
		activeSlide = slides.length - 1;
		// Keep background media per-template, per-slide.
		bgImagesByTemplate = {
			news: [...(bgImagesByTemplate.news ?? []), ''],
			tweet: [...(bgImagesByTemplate.tweet ?? []), ''],
			article: [...(bgImagesByTemplate.article ?? []), ''],
			textCarousel: [...(bgImagesByTemplate.textCarousel ?? []), ''],
			imageQuote: [...(bgImagesByTemplate.imageQuote ?? []), ''],
		};
		bgVideosByTemplate = {
			news: [...(bgVideosByTemplate.news ?? []), ''],
			tweet: [...(bgVideosByTemplate.tweet ?? []), ''],
			article: [...(bgVideosByTemplate.article ?? []), ''],
			textCarousel: [...(bgVideosByTemplate.textCarousel ?? []), ''],
			imageQuote: [...(bgVideosByTemplate.imageQuote ?? []), ''],
		};
		generatingImagesByTemplate = {
			news: [...(generatingImagesByTemplate.news ?? []), false],
			tweet: [...(generatingImagesByTemplate.tweet ?? []), false],
			article: [...(generatingImagesByTemplate.article ?? []), false],
			textCarousel: [...(generatingImagesByTemplate.textCarousel ?? []), false],
			imageQuote: [...(generatingImagesByTemplate.imageQuote ?? []), false],
		};
		// Keep overlays strictly template-scoped (avoid any accidental shared references).
		slideOverlaysByTemplate = {
			news: [...(slideOverlaysByTemplate.news ?? []), []],
			tweet: [...(slideOverlaysByTemplate.tweet ?? []), []],
			article: [...(slideOverlaysByTemplate.article ?? []), []],
			textCarousel: [...(slideOverlaysByTemplate.textCarousel ?? []), []],
			imageQuote: [...(slideOverlaysByTemplate.imageQuote ?? []), []],
		};
		slideTextOverlaysByTemplate = {
			news: [...(slideTextOverlaysByTemplate.news ?? []), []],
			tweet: [...(slideTextOverlaysByTemplate.tweet ?? []), []],
			article: [...(slideTextOverlaysByTemplate.article ?? []), []],
			textCarousel: [...(slideTextOverlaysByTemplate.textCarousel ?? []), []],
			imageQuote: [...(slideTextOverlaysByTemplate.imageQuote ?? []), []],
		};
		tweetTopNameBySlide = [...tweetTopNameBySlide, tweetTopNameBySlide[tweetTopNameBySlide.length - 1] ?? 'Chef 👨‍🍳'];
		tweetTopHandleBySlide = [...tweetTopHandleBySlide, tweetTopHandleBySlide[tweetTopHandleBySlide.length - 1] ?? '@chefsevenn'];
		tweetBottomNameBySlide = [...tweetBottomNameBySlide, tweetBottomNameBySlide[tweetBottomNameBySlide.length - 1] ?? 'Mo Mohler'];
		tweetBottomHandleBySlide = [...tweetBottomHandleBySlide, tweetBottomHandleBySlide[tweetBottomHandleBySlide.length - 1] ?? '@MoMohler'];
		tweetTopTextBySlide = [...tweetTopTextBySlide, tweetTopTextBySlide[tweetTopTextBySlide.length - 1] ?? 'Ketchup or mayo or mustard?'];
		tweetBottomTextBySlide = [...tweetBottomTextBySlide, ''];
		tweetReplyCountBySlide = [...tweetReplyCountBySlide, tweetReplyCountBySlide[tweetReplyCountBySlide.length - 1] ?? '4.2K'];
		tweetRepostCountBySlide = [...tweetRepostCountBySlide, tweetRepostCountBySlide[tweetRepostCountBySlide.length - 1] ?? '12.8K'];
tweetLikeCountBySlide = [...tweetLikeCountBySlide, tweetLikeCountBySlide[tweetLikeCountBySlide.length - 1] ?? '89.4K'];
tweetTopImageHeightBySlide = [...tweetTopImageHeightBySlide, tweetTopImageHeightBySlide[tweetTopImageHeightBySlide.length - 1] ?? 360];
tweetTopImageWidthBySlide = [...tweetTopImageWidthBySlide, tweetTopImageWidthBySlide[tweetTopImageWidthBySlide.length - 1] ?? 920];
tweetTopImageZoomBySlide = [...tweetTopImageZoomBySlide, tweetTopImageZoomBySlide[tweetTopImageZoomBySlide.length - 1] ?? 1];
tweetTopImagePanXBySlide = [...tweetTopImagePanXBySlide, tweetTopImagePanXBySlide[tweetTopImagePanXBySlide.length - 1] ?? 50];
tweetTopImagePanYBySlide = [...tweetTopImagePanYBySlide, tweetTopImagePanYBySlide[tweetTopImagePanYBySlide.length - 1] ?? 50];
		articleTextBySlide = [...articleTextBySlide, articleTextBySlide[articleTextBySlide.length - 1] ?? ''];
		textCarouselTextBySlide = [...textCarouselTextBySlide, textCarouselTextBySlide[textCarouselTextBySlide.length - 1] ?? ''];
		imageQuoteTextBySlide = [...imageQuoteTextBySlide, imageQuoteTextBySlide[imageQuoteTextBySlide.length - 1] ?? ''];
		textCarouselNameBySlide = [...textCarouselNameBySlide, textCarouselNameBySlide[textCarouselNameBySlide.length - 1] ?? 'Captains of industry'];
		textCarouselHandleBySlide = [...textCarouselHandleBySlide, textCarouselHandleBySlide[textCarouselHandleBySlide.length - 1] ?? '@captainsofindustryy'];
		imageQuoteFooterLeftBySlide = [...imageQuoteFooterLeftBySlide, imageQuoteFooterLeftBySlide[imageQuoteFooterLeftBySlide.length - 1] ?? '$'];
		imageQuoteFooterRightBySlide = [...imageQuoteFooterRightBySlide, imageQuoteFooterRightBySlide[imageQuoteFooterRightBySlide.length - 1] ?? 'BRAND'];
		articleSwipeTextBySlide = [...articleSwipeTextBySlide, articleSwipeTextBySlide[articleSwipeTextBySlide.length - 1] ?? '«« Swipe'];
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
		news: [{}],
		article: [{}],
		textCarousel: [{}],
		tweet: [{}],
		imageQuote: [{}],
	});
	// Tweet has multiple independent text fields; keep their styles separate.
	type TweetKind =
		| 'tweetTopName'
		| 'tweetTopHandle'
		| 'tweetTopText'
		| 'tweetBottomName'
		| 'tweetBottomHandle'
		| 'tweetBottomText';
	let tweetStylesBySlide = $state<Partial<Record<TweetKind, TextStyle>>[]>([{}]);

	// ── Per-template extra text fields (per slide) ───────────────────────
	let tweetTopNameBySlide = $state<string[]>(['Chef 👨‍🍳']);
	let tweetTopHandleBySlide = $state<string[]>(['@chefsevenn']);
	let tweetBottomNameBySlide = $state<string[]>(['Mo Mohler']);
	let tweetBottomHandleBySlide = $state<string[]>(['@MoMohler']);
	let tweetTopTextBySlide = $state<string[]>(['Ketchup or mayo or mustard?']);
	let tweetBottomTextBySlide = $state<string[]>(['']);
	let tweetReplyCountBySlide = $state<string[]>(['4.2K']);
	let tweetRepostCountBySlide = $state<string[]>(['12.8K']);
	let tweetLikeCountBySlide = $state<string[]>(['89.4K']);
	// Tweet attached image frame controls (per slide)
	let tweetTopImageHeightBySlide = $state<number[]>([360]);
	let tweetTopImageWidthBySlide = $state<number[]>([920]);
	let tweetTopImageZoomBySlide = $state<number[]>([1]);
	let tweetTopImagePanXBySlide = $state<number[]>([50]);
	let tweetTopImagePanYBySlide = $state<number[]>([50]);
	let articleTextBySlide = $state<string[]>([
		"Here's the trillion-dollar problem everyone avoids.\n\nTo break it down:\n\nA *1-gigawatt AI data center* costs roughly *$80B* to build & operate.",
	]);
	let textCarouselTextBySlide = $state<string[]>([
		'Lead with a sharp hook on the first line.\n\nUse the second beat for proof, tone, or a CTA — keep it scannable.',
	]);
	let imageQuoteTextBySlide = $state<string[]>([
		'YOUR BIG STATEMENT GOES HERE.\nMAKE IT SHORT, PUNCHY, AND ALL CAPS.',
	]);
	let textCarouselNameBySlide = $state<string[]>(['Captains of industry']);
	let textCarouselHandleBySlide = $state<string[]>(['@captainsofindustryy']);
	let imageQuoteFooterLeftBySlide = $state<string[]>(['$']);
	let imageQuoteFooterRightBySlide = $state<string[]>(['BRAND']);
	let articleSwipeTextBySlide = $state<string[]>(['«« Swipe']);

	// Stable ids per slide, used as keys for filmstrip reordering.
	let _slideUid = 0;
	function newSlideId() { return `s_${++_slideUid}_${Date.now().toString(36)}`; }
	let slideIds = $state<string[]>([newSlideId()]);
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
tweetBottomTextBySlide = pickOr(tweetBottomTextBySlide, '');
tweetTopImageHeightBySlide = pickOr(tweetTopImageHeightBySlide, 360);
tweetTopImageWidthBySlide = pickOr(tweetTopImageWidthBySlide, 920);
tweetTopImageZoomBySlide = pickOr(tweetTopImageZoomBySlide, 1);
tweetTopImagePanXBySlide = pickOr(tweetTopImagePanXBySlide, 50);
tweetTopImagePanYBySlide = pickOr(tweetTopImagePanYBySlide, 50);
		articleTextBySlide = pickOr(articleTextBySlide, '');
		textCarouselTextBySlide = pickOr(textCarouselTextBySlide, '');
		imageQuoteTextBySlide = pickOr(imageQuoteTextBySlide, '');
		textCarouselNameBySlide = pickOr(textCarouselNameBySlide, 'Captains of industry');
		textCarouselHandleBySlide = pickOr(textCarouselHandleBySlide, '@captainsofindustryy');
		imageQuoteFooterLeftBySlide = pickOr(imageQuoteFooterLeftBySlide, '$');
		imageQuoteFooterRightBySlide = pickOr(imageQuoteFooterRightBySlide, 'BRAND');
		articleSwipeTextBySlide = pickOr(articleSwipeTextBySlide, '«« Swipe');
		if (exportedSlides.length) exportedSlides = pickOr(exportedSlides, '');
		slideIds        = pickOr(slideIds, newSlideId());
		slideMusic      = pickOr(slideMusic, null);

		// Keep the same logical slide focused after reorder.
		const newActive = newOrder.indexOf(activeSlide);
		if (newActive >= 0) activeSlide = newActive;
		void saveDraftNow?.();
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
	const activeSourceStyle   = $derived(activeStyleMap.source ?? {});
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
		if (isTweetKind(selectedText)) return (activeTweetStyles[selectedText] ?? {});
		if (selectedText === 'textOverlay' && selectedTextOverlayId) {
			const current = (slideTextOverlaysByTemplate[activeTemplate] ?? [])[activeSlide] ?? [];
			return (current.find((o) => o.id === selectedTextOverlayId)?.style ?? {});
		}
		if (!selectedText) return activeHeadlineStyle;
		return activeStyleMap[selectedText] ?? (selectedText === 'source' ? activeSourceStyle : activeHeadlineStyle);
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

			// Text carousel
			case 'textCarouselName': return 46;
			case 'textCarouselHandle': return 36;
			case 'textCarouselBody': return 72;

			// Image quote
			case 'imageQuoteFooterLeft': return 44;
			case 'imageQuoteFooterRight': return 26;
			// headline kind is used for the quote body in that template; leave undefined here.

			// Tweet
			case 'tweetTopName': return 44;
			case 'tweetTopHandle': return 36;
			case 'tweetTopText': return 58;
			case 'tweetBottomName': return 42;
			case 'tweetBottomHandle': return 34;
			case 'tweetBottomText': return 56;
			case 'tweetReplyCount': return 32;
			case 'tweetRepostCount': return 32;
			case 'tweetLikeCount': return 32;

			// Overlays
			case 'textOverlay': return 42;
		}
	}

	// Plain-text selection inside the headline (for applyHighlight).
	// null when no active word/range selection.
	let headlineRange = $state<{ start: number; end: number } | null>(null);
	let textOverlayRange = $state<{ start: number; end: number } | null>(null);
	const hasRangeSelection = $derived(
		selectedText === 'textOverlay' ? textOverlayRange !== null : headlineRange !== null,
	);

	function onHeadlineRangeSelect(start: number, end: number) {
		if (start < 0 || end < 0 || start === end) {
			headlineRange = null;
		} else {
			headlineRange = { start, end };
		}
	}

	function onTextOverlayRangeSelect(start: number, end: number) {
		if (start < 0 || end < 0 || start === end) {
			textOverlayRange = null;
		} else {
			textOverlayRange = { start, end };
		}
	}

	function onHighlight(spec: HighlightSpec) {
		const range = selectedText === 'textOverlay' ? textOverlayRange : headlineRange;
		if (!range) return;
		pushUndo(activeTemplate, activeSlide);
		// Apply highlight to the currently-selected editable text field (not always News headline).
		const start = range.start;
		const end = range.end;
		if (!(Number.isFinite(start) && Number.isFinite(end) && end > start)) return;

		// Highlightable fields
		if (selectedText === 'headline') {
			const current = slides[activeSlide] ?? '';
			setActiveSlideText(applyHighlight(current, start, end, spec));
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
		} else if (selectedText === 'textOverlay' && selectedTextOverlayId) {
			const current = (slideTextOverlaysByTemplate[activeTemplate] ?? [])[activeSlide] ?? [];
			setSlideTextOverlays(
				activeSlide,
				current.map((o) => (o.id === selectedTextOverlayId ? { ...o, text: applyHighlight(o.text ?? '', start, end, spec) } : o)),
				activeTemplate,
			);
		}
		// Keep the range so the user can try a different highlight without reselecting.
		// Clear any native selection since the DOM just rerendered.
		window.getSelection()?.removeAllRanges();
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

	function patchActiveStyle(patch: Partial<TextStyle>) {
		if (isTweetKind(selectedText)) {
			tweetStylesBySlide = tweetStylesBySlide.map((s, i) => {
				if (i !== activeSlide) return s;
				const cur = s ?? {};
				const k: TweetKind = selectedText as TweetKind;
				return { ...cur, [k]: { ...((cur as any)[k] ?? {}), ...patch } };
			});
		} else if (selectedText === 'textOverlay' && selectedTextOverlayId) {
			const current = (slideTextOverlaysByTemplate[activeTemplate] ?? [])[activeSlide] ?? [];
			setSlideTextOverlays(
				activeSlide,
				current.map((o) => (o.id === selectedTextOverlayId ? { ...o, style: { ...(o.style ?? {}), ...patch } } : o)),
				activeTemplate,
			);
		} else if (selectedText) {
			const k = selectedText as TextElementKind;
			stylesByTemplateBySlide = {
				...stylesByTemplateBySlide,
				[activeTemplate]: (stylesByTemplateBySlide[activeTemplate] ?? []).map((m, i) => {
					if (i !== activeSlide) return m;
					const cur = m ?? {};
					return { ...cur, [k]: { ...(cur[k] ?? {}), ...patch } };
				}),
			};
		}
		// Re-anchor on next frame so the toolbar follows size changes.
		requestAnimationFrame(() => {
			if (toolbarTarget) toolbarAnchor = toolbarTarget.getBoundingClientRect();
		});
	}

	function resetActiveStyle() {
		if (isTweetKind(selectedText)) {
			tweetStylesBySlide = tweetStylesBySlide.map((s, i) => {
				if (i !== activeSlide) return s;
				const cur = s ?? {};
				const k: TweetKind = selectedText as TweetKind;
				return { ...cur, [k]: {} };
			});
		} else if (selectedText === 'textOverlay' && selectedTextOverlayId) {
			const current = (slideTextOverlaysByTemplate[activeTemplate] ?? [])[activeSlide] ?? [];
			setSlideTextOverlays(
				activeSlide,
				current.map((o) => (o.id === selectedTextOverlayId ? { ...o, style: {} } : o)),
				activeTemplate,
			);
		} else if (selectedText) {
			const k = selectedText as TextElementKind;
			stylesByTemplateBySlide = {
				...stylesByTemplateBySlide,
				[activeTemplate]: (stylesByTemplateBySlide[activeTemplate] ?? []).map((m, i) => {
					if (i !== activeSlide) return m;
					const cur = m ?? {};
					return { ...cur, [k]: {} };
				}),
			};
		}
	}

	// Export
	let exporting = $state(false);
	let exportingAll = $state(false);
	let exportRef: HTMLElement | null = $state(null);

	// ── Output format (canvas size) ───────────────────────────────────────
	type FormatId = 'post' | 'reel' | 'story' | 'square';
	type Format = { id: FormatId; label: string; w: number; h: number; igType: 'post' | 'reel' | 'story' };
	const FORMATS: Format[] = [
		{ id: 'post', label: 'Post', w: 1080, h: 1350, igType: 'post' },     // 4:5
		{ id: 'reel', label: 'Reel', w: 1080, h: 1920, igType: 'reel' },     // 9:16
		{ id: 'story', label: 'Story', w: 1080, h: 1920, igType: 'story' },  // 9:16
		{ id: 'square', label: 'Square', w: 1080, h: 1080, igType: 'post' }, // 1:1
	];
	let formatId = $state<FormatId>('post');
	const format = $derived(FORMATS.find((f) => f.id === formatId) ?? FORMATS[0]);
	const CANVAS_W = $derived(format.w);
	const CANVAS_H = $derived(format.h);

	// ── Draft persistence (Supabase) ──────────────────────────────────────
	type DraftRow = { id: string; kind: string; state: any; updated_at: string };
	const DRAFT_KIND = 'news_studio';
	let draftId = $state<string>('');
	let draftLoaded = $state(false);
	let draftSaving = $state(false);
	let draftError = $state('');
	let draftRestoring = $state(true);
	let saveTimer: any = null;

	const studioBooting = $derived(!initialTemplateParamApplied || draftRestoring || !userId);

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

		// Restore (best-effort)
		if (typeof s.formatId === 'string') formatId = s.formatId as FormatId;
		if (typeof s.lastTemplateUsed === 'string') lastTemplateUsed = s.lastTemplateUsed as TemplateId;
		if (Array.isArray(s.slides)) slides = s.slides;
		if (typeof s.activeSlide === 'number') activeSlide = Math.max(0, Math.min((s.slides?.length ?? slides.length) - 1, s.activeSlide));
		if (typeof s.category === 'string') category = s.category;
		if (s.newsContentMode === 'news' || s.newsContentMode === 'fact' || s.newsContentMode === 'story') {
			newsContentMode = s.newsContentMode;
		}
		if (typeof s.storyCategory === 'string') storyCategory = s.storyCategory;
		if (typeof s.search === 'string') search = s.search;
		if (typeof s.source === 'string') source = s.source;
		if (typeof s.articleUrl === 'string') articleUrl = s.articleUrl;
		if (typeof s.articleTitle === 'string') articleTitle = s.articleTitle;
		if (typeof s.articleSnippet === 'string') articleSnippet = s.articleSnippet;

		if (Array.isArray(s.slideTemplates)) slideTemplates = s.slideTemplates;
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
		if (s.slideOverlaysByTemplate && typeof s.slideOverlaysByTemplate === 'object') {
			// Deep-clone to avoid any accidental shared references across templates/slides.
			const raw = s.slideOverlaysByTemplate as Record<TemplateId, Overlay[][]>;
			slideOverlaysByTemplate = {
				news: (raw.news ?? []).map((row) => (row ?? []).map((o) => ({ ...(o as any) }))),
				tweet: (raw.tweet ?? []).map((row) => (row ?? []).map((o) => ({ ...(o as any) }))),
				article: (raw.article ?? []).map((row) => (row ?? []).map((o) => ({ ...(o as any) }))),
				textCarousel: (raw.textCarousel ?? []).map((row) => (row ?? []).map((o) => ({ ...(o as any) }))),
				imageQuote: (raw.imageQuote ?? []).map((row) => (row ?? []).map((o) => ({ ...(o as any) }))),
			};
		} else if (Array.isArray(s.slideOverlays)) {
			// Back-compat: old drafts stored overlays per slide (treat as News overlays).
			slideOverlaysByTemplate = { ...slideOverlaysByTemplate, news: s.slideOverlays as Overlay[][] };
		}
		if (s.slideTextOverlaysByTemplate && typeof s.slideTextOverlaysByTemplate === 'object') {
			// Deep-clone to avoid any accidental shared references across templates/slides.
			const raw = s.slideTextOverlaysByTemplate as Record<TemplateId, TextOverlay[][]>;
			slideTextOverlaysByTemplate = {
				news: (raw.news ?? []).map((row) => (row ?? []).map((t) => ({ ...(t as any), style: { ...(((t as any).style ?? {}) as any) } }))),
				tweet: (raw.tweet ?? []).map((row) => (row ?? []).map((t) => ({ ...(t as any), style: { ...(((t as any).style ?? {}) as any) } }))),
				article: (raw.article ?? []).map((row) => (row ?? []).map((t) => ({ ...(t as any), style: { ...(((t as any).style ?? {}) as any) } }))),
				textCarousel: (raw.textCarousel ?? []).map((row) => (row ?? []).map((t) => ({ ...(t as any), style: { ...(((t as any).style ?? {}) as any) } }))),
				imageQuote: (raw.imageQuote ?? []).map((row) => (row ?? []).map((t) => ({ ...(t as any), style: { ...(((t as any).style ?? {}) as any) } }))),
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
		if (Array.isArray(s.articleTextBySlide)) articleTextBySlide = s.articleTextBySlide;
		if (Array.isArray(s.textCarouselTextBySlide)) textCarouselTextBySlide = s.textCarouselTextBySlide;
		if (Array.isArray(s.imageQuoteTextBySlide)) imageQuoteTextBySlide = s.imageQuoteTextBySlide;
		if (Array.isArray(s.textCarouselNameBySlide)) textCarouselNameBySlide = s.textCarouselNameBySlide;
		if (Array.isArray(s.textCarouselHandleBySlide)) textCarouselHandleBySlide = s.textCarouselHandleBySlide;
		if (Array.isArray(s.imageQuoteFooterLeftBySlide)) imageQuoteFooterLeftBySlide = s.imageQuoteFooterLeftBySlide;
		if (Array.isArray(s.imageQuoteFooterRightBySlide)) imageQuoteFooterRightBySlide = s.imageQuoteFooterRightBySlide;
		if (Array.isArray(s.articleSwipeTextBySlide)) articleSwipeTextBySlide = s.articleSwipeTextBySlide;
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

		if (typeof s.showCircle === 'boolean') showCircle = s.showCircle;
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
		if (typeof s.textPanelOffsetY === 'number') textPanelOffsetY = s.textPanelOffsetY;
		if (typeof s.shadowHeight === 'number') shadowHeight = s.shadowHeight;
		if (typeof s.shadowStrength === 'number') shadowStrength = s.shadowStrength;
		if (typeof s.highlightColor === 'string') highlightColor = s.highlightColor;
		if (typeof s.textColor === 'string') textColor = s.textColor;
		// Intentionally do NOT restore `exportedSlides` (huge data URLs) from drafts.
		// slideCount is derived from slides.length; do not restore it directly.
	}

	function buildDraftState() {
		// Avoid saving huge/persistent-less URLs that can freeze restore.
		const pruneMediaUrl = (u: unknown) => {
			if (typeof u !== 'string') return '';
			const s = u.trim();
			if (!s) return '';
			// blob: URLs don’t survive reload and can get large in drafts.
			if (s.startsWith('blob:')) return '';
			// Very large data URLs make draft JSON huge and slow to restore.
			if (s.startsWith('data:') && s.length > 220_000) return '';
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
			search,
			source,
			articleUrl,
			articleTitle,
			articleSnippet,
			activeSlide,
			slides,
			slideTemplates,
			bgImagesByTemplate: pruneMediaMap(bgImagesByTemplate as any),
			bgVideosByTemplate: pruneMediaMap(bgVideosByTemplate as any),
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
			articleTextBySlide,
			textCarouselTextBySlide,
			imageQuoteTextBySlide,
			textCarouselNameBySlide,
			textCarouselHandleBySlide,
			imageQuoteFooterLeftBySlide,
			imageQuoteFooterRightBySlide,
			articleSwipeTextBySlide,
			slideIds,
			subjectCutouts,
			showCutout,
			slideMusic,
			showCircle,
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
			textPanelOffsetY,
			shadowHeight,
			shadowStrength,
			highlightColor,
			textColor,
			// Don’t persist `exportedSlides` (huge data URLs) in drafts — it makes restore slow.
			// We can always re-export when needed.
			exportedSlides: [],
		};
	}

	// Rendered PNGs (data URLs) of each slide's final template output
	let exportedSlides = $state<string[]>([]);

	async function saveDraftNow() {
		if (!userId) return;
		draftSaving = true;
		draftError = '';
		const payload = {
			user_id: userId,
			kind: DRAFT_KIND,
			state: buildDraftState(),
			...(draftId ? { id: draftId } : {}),
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

	function scheduleDraftSave() {
		if (!draftLoaded) return;
		if (saveTimer) clearTimeout(saveTimer);
		saveTimer = setTimeout(() => void saveDraftNow(), 900);
	}

	// ── Auth ──────────────────────────────────────────────────────────────
	onMount(async () => {
		const { data: { user } } = await supabase.auth.getUser();
		if (!user) { goto('/login'); return; }
		userId = user.id;
		draftRestoring = true;
		void loadLatestDraft()
			.catch(() => {
				// loadLatestDraft already sets draftError; swallow to keep UI responsive.
			})
			.finally(() => {
				draftLoaded = true;
				draftRestoring = false;
			});

		// Ensure the primary circle badge starts AI-generated.
		if (showCircle && !activeCircleImage) void generateCircleImage(activeSlide);
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

	// ── Fetch news ────────────────────────────────────────────────────────
	async function fetchNews() {
		fetchingNews = true;
		newsError = '';
		activeSlide = 0;
		// If we previously deep-linked into a non-news template (e.g. ?template=tweet),
		// fetching news should always “take over” and show the News template.
		forcedTemplateFromQuery = null;
		// Reset circle + background to defaults
		circleX    = 772;
		circleY    = 52;
		circleSize = 300;
		// Reset per-slide circle images for the new story.
		circleImages = [];
		circle2Images = [];
		showCircle2BySlide = [];
		bgOffsetX  = 50;
		bgOffsetY  = 0;

		try {
			let hookText = '';
			let rawText  = '';
			let articleImageUrl = ''; // article's own image (used as seed for slide 0)

			if (useTestData) {
				// ── Mock mode ────────────────────────────────────────────────
				await new Promise((r) => setTimeout(r, 400));
				if (newsContentMode === 'fact') {
					const pick = MOCK_FACTS[Math.floor(Math.random() * MOCK_FACTS.length)] ?? MOCK_FACTS[0];
					hookText = pick.hookText;
					rawText = pick.rawText;
					source = pick.source;
					articleUrl = '';
					articleTitle = pick.hookText.replace(/\[\[|\]\]/g, '').slice(0, 120);
					articleImageUrl = '';
				} else if (newsContentMode === 'story') {
					const pool = MOCK_STORIES[storyCategory] ?? MOCK_STORIES.health;
					const pick = pool[Math.floor(Math.random() * pool.length)] ?? pool[0];
					hookText = pick.hookText;
					rawText = pick.rawText;
					source = pick.source;
					articleUrl = '';
					articleTitle = pick.hookText.replace(/\[\[|\]\]/g, '').slice(0, 120);
					articleImageUrl = '';
				} else {
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
					source = sourceLabels[category] ?? article.source ?? 'News';
					articleUrl = article.url;
					articleTitle = article.title;
					articleImageUrl = article.image_url;
				}
			} else {
				// ── Live mode ────────────────────────────────────────────────
				const res = await fetch('/api/news', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						mode: newsContentMode,
						storyCategory,
						search: newsContentMode === 'news' ? search || undefined : undefined,
						categories: newsContentMode === 'news' ? category : undefined,
						autoHighlight: true,
						pick: 'first',
					}),
				});
				const data = await res.json();
				if (!res.ok) throw new Error(data.error ?? 'Failed to fetch news');

				hookText = data.text ?? '';
				rawText = data.description ?? data.title ?? '';
				source =
					newsContentMode === 'news'
						? sourceLabels[category] ?? data.source ?? 'News'
						: typeof data.source === 'string' && data.source
							? data.source
							: newsContentMode === 'fact'
								? 'Did you know'
								: storyThemes.find((t) => t.id === storyCategory)?.label ?? 'Story';
				articleUrl = data.url ?? '';
				articleTitle = data.title ?? '';
				articleImageUrl = data.imageUrl ?? '';
			}

			articleSnippet = rawText;

			// Show slide 1 immediately
			slides = [hookText];
			// News generator should always start from the News template.
			// (Otherwise if your last template was Tweet/Article, fetching news “looks like” it routed wrong.)
			lastTemplateUsed = 'news';
			// Force ALL slides to News right away (and keep it stable as slides expand).
			slideTemplates = Array.from({ length: Math.max(1, slideCount) }, () => 'news');
			bgImagesByTemplate = { ...bgImagesByTemplate, news: [articleImageUrl] }; // slide 0 gets article image right away
			bgVideosByTemplate = { ...bgVideosByTemplate, news: [''] }; // reset video
			generatingImagesByTemplate = { ...generatingImagesByTemplate, news: [false] };
			slideOverlaysByTemplate = { ...slideOverlaysByTemplate, news: [[]] };
			slideTextOverlaysByTemplate = { ...slideTextOverlaysByTemplate, news: [[]] };

			// Generate supporting slide variants first (so we know all slide texts before imaging)
			if (slideCount > 1) {
				fetchingNews = false;
				generatingVariants = true;
				await generateVariants(hookText, rawText);
				generatingVariants = false;
			}

			// Generate unique Vertex image per slide in parallel
			// Slide 0: keep article image if available; otherwise generate from title
			// Slides 1+: generate from their own text copy
			const imagePromise = generateAllSlideImages(articleImageUrl);

			// Auto-generate circle badge if toggle is on
			if (showCircle) generateCircleImage();

			await imagePromise;

		} catch (e: any) {
			newsError = e.message;
		}

		fetchingNews = false;
		generatingVariants = false;
	}

	// ── Generate supporting slide variants ────────────────────────────────
	async function generateVariants(hookText: string, rawText: string) {
		try {
			const res = await fetch('/api/news/variants', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					count: slideCount,
					title: articleTitle,
					text: rawText || articleTitle,
					sourceUrl: articleUrl,
					autoHighlight: true,
				}),
			});
			const data = await res.json();
			if (!res.ok) throw new Error(data.error ?? 'Variant generation failed');

			// Use hook as slide 1 if API returned generic; otherwise use all returned variants
			const variants: string[] = data.variants ?? [];
			if (variants.length > 0) {
				// Replace slide 1 only if API returned something different AND hook already has content
				slides = variants.length >= slideCount
					? variants.slice(0, slideCount)
					: [...variants, ...Array(slideCount - variants.length).fill(variants[variants.length - 1])];
			}
		} catch (e: any) {
			// Don't overwrite the hook slide on variant error
			console.error('[variants]', e.message);
			newsError = `Slide variants: ${e.message}`;
		}
	}

	// ── Generate background image for a single slide ─────────────────────
	async function generateBackground(slideIdx: number, promptOverride?: string) {
		// Mark this slide as generating
		generatingImagesByTemplate = {
			...generatingImagesByTemplate,
			news: (generatingImagesByTemplate.news ?? []).map((v, i) => i === slideIdx ? true : v),
		};
		bgError = '';

		try {
			const slideText = (slides[slideIdx] ?? '').replace(/\[\[|\]\]/g, '').trim();
			const prompt = promptOverride ?? slideText ?? articleTitle ?? 'editorial news photo';
			const res = await fetch('/api/vertex', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ prompt, aspect: '3:4', context: articleTitle }),
			});

			const data = await res.json();
			if (data.dataUrl) {
				setSlideImage(slideIdx, data.dataUrl);
			} else if (data.demo) {
				bgError = data.message ?? 'Configure Google credentials to enable AI images.';
				generatingImagesByTemplate = {
					...generatingImagesByTemplate,
					news: (generatingImagesByTemplate.news ?? []).map((v, i) => i === slideIdx ? false : v),
				};
			} else {
				bgError = data.error ?? 'Image generation failed';
				generatingImagesByTemplate = {
					...generatingImagesByTemplate,
					news: (generatingImagesByTemplate.news ?? []).map((v, i) => i === slideIdx ? false : v),
				};
			}
		} catch (e: any) {
			bgError = e.message;
			generatingImagesByTemplate = {
				...generatingImagesByTemplate,
				news: (generatingImagesByTemplate.news ?? []).map((v, i) => i === slideIdx ? false : v),
			};
		}
	}

	// ── Generate unique images for all slides in parallel ─────────────────
	async function generateAllSlideImages(articleImageUrl?: string) {
		// Reset image arrays to match current slide count
		bgImagesByTemplate = { ...bgImagesByTemplate, news: new Array(slides.length).fill('') };
		bgVideosByTemplate = { ...bgVideosByTemplate, news: new Array(slides.length).fill('') };
		videoTrimStartSecBySlide = new Array(slides.length).fill(0);
		videoTrimEndSecBySlide = new Array(slides.length).fill(0);
		videoDurationBySlide = new Array(slides.length).fill(0);
		videoMutedBySlide = new Array(slides.length).fill(true);
		videoVolumeBySlide = new Array(slides.length).fill(0.8);
		generatingImagesByTemplate = { ...generatingImagesByTemplate, news: new Array(slides.length).fill(true) };
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
		slideTemplates   = Array.from({ length: slides.length }, (_, i) => slideTemplates[i] ?? lastTemplateUsed);

		// Slide 0: use article image directly if available, otherwise Vertex
		if (articleImageUrl) {
			const safe = await toExportSafeImageUrl(articleImageUrl);
			setSlideImage(0, safe);
		}

		// Fire all Vertex requests in parallel (skip slide 0 if we have article image)
		const promises = slides.map((slideText, i) => {
			if (i === 0 && articleImageUrl) return Promise.resolve(); // already set
			const cleanText = slideText.replace(/\[\[|\]\]/g, '').trim();
			const prompt = i === 0
				? (articleTitle || cleanText)
				: cleanText; // supporting slides use their own copy as the image prompt
			return generateBackground(i, prompt);
		});

		await Promise.all(promises);
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
			tweetTopImageHeightBySlide = Array.from({ length: n }, (_, i) => tweetTopImageHeightBySlide[i] ?? 360);
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
		if (imageQuoteFooterLeftBySlide.length !== n) {
			imageQuoteFooterLeftBySlide = Array.from({ length: n }, (_, i) => imageQuoteFooterLeftBySlide[i] ?? '$');
		}
		if (imageQuoteFooterRightBySlide.length !== n) {
			imageQuoteFooterRightBySlide = Array.from({ length: n }, (_, i) => imageQuoteFooterRightBySlide[i] ?? 'BRAND');
		}
		if (articleSwipeTextBySlide.length !== n) {
			articleSwipeTextBySlide = Array.from({ length: n }, (_, i) => articleSwipeTextBySlide[i] ?? '«« Swipe');
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

	// Auto-save draft (debounced). This will persist editor state across reloads.
	$effect(() => {
		// Reading the state here makes it reactive without TS comma-operator issues.
		buildDraftState();
		scheduleDraftSave();
	});

	// ── Generate circle image via Vertex ─────────────────────────────────
	async function generateCircleImage(slideIdx: number = activeSlide) {
		generatingCircle = true;
		try {
			const context = articleTitle || overlayText.replace(/\[\[|\]\]/g, '');
			const prompt = `Bold editorial close-up photo representing: "${context}". Square crop, single strong subject, dramatic lighting, no text.`;
			const res = await fetch('/api/vertex', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ prompt, aspect: '1:1' }),
			});
			const data = await res.json();
			if (data.dataUrl) {
				circleImages = circleImages.map((v, i) => (i === slideIdx ? data.dataUrl : v));
			}
		} catch { /* ignore */ }
		generatingCircle = false;
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
					showCircle = true;
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
		const prev = activeSlide;
		try {
			const zip = new JSZip();
			const folder = zip.folder(`slides-${formatId}`) ?? zip;

			for (let i = 0; i < slides.length; i++) {
				activeSlide = i;
				await tick();
				await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));

				const node = exportRef;
				if (!node) throw new Error('Preview not ready for export');
				try { await (document as any).fonts?.ready; } catch { /* ignore */ }

				const dataUrl = await toPng(node, {
					width: CANVAS_W,
					height: CANVAS_H,
					pixelRatio: 1,
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
			activeSlide = prev;
			exporting = false;
		}
	}

	async function exportAllSlidesToDraft() {
		if (!exportRef) return 0;
		if (!slides.length) return 0;
		exportingAll = true;
		const prev = activeSlide;
		try {
			const out: string[] = [];
			for (let i = 0; i < slides.length; i++) {
				activeSlide = i;
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
					style: { transform: 'scale(1)', transformOrigin: 'top left' },
					cacheBust: true,
					// Let html-to-image inline @font-face rules so custom fonts render in the PNG.
				} as any);
				out.push(dataUrl);
			}
			exportedSlides = out;
			await saveDraftNow();
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
			activeSlide = prev;
			exportingAll = false;
		}
	}

	// Preview scale — fit within container
	const PREVIEW_WIDTH = 520;
	const previewScale = $derived(PREVIEW_WIDTH / CANVAS_W);
</script>

<FloatingActions
	{...({
		slideLabels: slides.map((_, i) => `Slide ${i + 1}`),
		posting: exportingAll,
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

	<!-- ── Left panel: controls ──────────────────────────────────────────── -->
	<div class="w-80 flex-shrink-0 border-r flex flex-col overflow-y-auto studio-left" style="background: var(--app-surface-2); border-color: var(--app-border);">
		<div class="px-5 py-4 border-b" style="border-color: var(--app-border);">
			<h1 class="font-display font-bold text-base" style="color: var(--app-text);">News Studio</h1>
			<p class="font-body text-xs mt-0.5" style="color: var(--app-text-muted);">AI-powered Instagram news posts</p>
		</div>

		<div class="flex flex-col gap-1 p-4">

			<!-- Content type (News template generator) -->
			<div class="mb-2">
				<label class="text-[10px] font-mono text-white/30 uppercase tracking-wider block mb-2">Content</label>
				<div class="flex rounded-xl p-0.5 bg-white/[0.04] border border-white/[0.08] gap-0.5">
					<button
						type="button"
						onclick={() => (newsContentMode = 'news')}
						class="flex-1 py-2 px-1 rounded-lg text-[10px] font-semibold font-body transition-all
							{newsContentMode === 'news'
								? 'bg-violet-500/25 text-violet-200 border border-violet-500/30'
								: 'text-white/45 hover:text-white/70 border border-transparent'}"
					>News</button>
					<button
						type="button"
						onclick={() => (newsContentMode = 'fact')}
						class="flex-1 py-2 px-1 rounded-lg text-[10px] font-semibold font-body transition-all
							{newsContentMode === 'fact'
								? 'bg-violet-500/25 text-violet-200 border border-violet-500/30'
								: 'text-white/45 hover:text-white/70 border border-transparent'}"
					>Random fact</button>
					<button
						type="button"
						onclick={() => (newsContentMode = 'story')}
						class="flex-1 py-2 px-1 rounded-lg text-[10px] font-semibold font-body transition-all
							{newsContentMode === 'story'
								? 'bg-violet-500/25 text-violet-200 border border-violet-500/30'
								: 'text-white/45 hover:text-white/70 border border-transparent'}"
					>Random story</button>
				</div>
			</div>

			{#if newsContentMode === 'news'}
				<!-- News category -->
				<div class="mb-1">
					<label class="text-[10px] font-mono text-white/30 uppercase tracking-wider block mb-2">Category</label>
					<div class="relative">
						<select bind:value={category}
							class="w-full appearance-none bg-white/[0.04] border border-white/[0.08] rounded-xl py-2.5 pl-3 pr-8 text-sm font-body text-white focus:outline-none focus:border-violet-500/50 transition-colors">
							{#each categories as cat}
								<option value={cat.id}>{cat.label}</option>
							{/each}
						</select>
						<ChevronDown size={13} class="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none" />
					</div>
				</div>

				<!-- Search -->
				<div class="mb-3">
					<label class="text-[10px] font-mono text-white/30 uppercase tracking-wider block mb-2">Search (optional)</label>
					<div class="relative">
						<Search size={13} class="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
						<input bind:value={search} placeholder="e.g. interest rates, Tesla..."
							class="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl py-2.5 pl-8 pr-3 text-sm font-body text-white placeholder-white/20 focus:outline-none focus:border-violet-500/50 transition-colors" />
					</div>
				</div>
			{:else if newsContentMode === 'story'}
				<div class="mb-3">
					<label class="text-[10px] font-mono text-white/30 uppercase tracking-wider block mb-2">Story theme</label>
					<div class="relative">
						<select bind:value={storyCategory}
							class="w-full appearance-none bg-white/[0.04] border border-white/[0.08] rounded-xl py-2.5 pl-3 pr-8 text-sm font-body text-white focus:outline-none focus:border-violet-500/50 transition-colors">
							{#each storyThemes as th}
								<option value={th.id}>{th.label}</option>
							{/each}
						</select>
						<ChevronDown size={13} class="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none" />
					</div>
					<p class="text-[10px] font-body text-white/25 mt-1.5 leading-relaxed">Generate uses this theme for the micro-story hook and carousel context.</p>
				</div>
			{:else}
				<p class="text-[10px] font-body text-white/25 mb-3 leading-relaxed">
					One surprising fact-style line plus context for follow-up slides. No news API required.
				</p>
			{/if}

			<!-- Slide count -->
			<div class="mb-1">
				<label class="text-[10px] font-mono text-white/30 uppercase tracking-wider block mb-2">Number of slides</label>
				<div class="flex items-center gap-2">
					<button
						onclick={() => slideCount = Math.max(1, slideCount - 1)}
						class="w-8 h-8 rounded-lg bg-white/[0.04] border border-white/[0.08] text-white/50 hover:text-white hover:bg-white/[0.08] transition-all flex items-center justify-center text-base font-bold">−</button>
					<span class="flex-1 text-center text-sm font-mono text-white">{slideCount} slide{slideCount !== 1 ? 's' : ''}</span>
					<button
						onclick={() => slideCount = Math.min(10, slideCount + 1)}
						class="w-8 h-8 rounded-lg bg-white/[0.04] border border-white/[0.08] text-white/50 hover:text-white hover:bg-white/[0.08] transition-all flex items-center justify-center text-base font-bold">+</button>
				</div>
				<div class="flex gap-1 mt-2">
					{#each [1,2,3,4,5,6,8,10] as n}
						<button
							onclick={() => slideCount = n}
							class="flex-1 py-1 rounded-lg text-[10px] font-mono transition-all
								{slideCount === n ? 'bg-amber-500/20 text-amber-300 border border-amber-500/25' : 'bg-white/[0.03] text-white/25 border border-white/[0.05] hover:text-white/50'}">
							{n}
						</button>
					{/each}
				</div>
			</div>

			<!-- Data source toggle -->
			<div class="flex items-center justify-between p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] mb-1">
				<div class="flex items-center gap-2">
					{#if useTestData}
						<FlaskConical size={12} class="text-amber-400" />
						<span class="text-xs font-mono text-amber-400">Test data</span>
					{:else}
						<Wifi size={12} class="text-emerald-400" />
						<span class="text-xs font-mono text-emerald-400">Live API</span>
					{/if}
				</div>
				<!-- Toggle switch -->
				<button
					onclick={() => useTestData = !useTestData}
					class="relative w-10 h-5 rounded-full transition-colors duration-200 focus:outline-none flex-shrink-0
						{useTestData ? 'bg-amber-500/30' : 'bg-emerald-500/40'}"
					title="{useTestData ? 'Switch to Live API' : 'Switch to Test Data'}"
				>
					<span class="absolute top-0.5 left-0.5 w-4 h-4 rounded-full shadow transition-transform duration-200
						{useTestData ? 'translate-x-0 bg-amber-400' : 'translate-x-5 bg-emerald-400'}">
					</span>
				</button>
			</div>

			<!-- Fetch / Generate button -->
			<button onclick={fetchNews} disabled={fetchingNews}
				class="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold font-body text-[#0a0a0a] bg-[#E8FF48] hover:bg-[#f0ff70] hover:shadow-[0_4px_16px_rgba(232,255,72,0.25)] transition-all disabled:opacity-50">
				{#if fetchingNews}
					<Loader size={13} class="animate-spin" />
					{#if useTestData}
						Loading mock…
					{:else if newsContentMode === 'news'}
						Fetching + Rewriting…
					{:else}
						Generating…
					{/if}
				{:else}
					{#if useTestData}
						<FlaskConical size={13} />
						{#if newsContentMode === 'news'}
							Load Test Article
						{:else}
							Generate (test)
						{/if}
					{:else if newsContentMode === 'news'}
						<Newspaper size={13} /> Fetch Live News
					{:else}
						<Sparkles size={13} /> Generate
					{/if}
				{/if}
			</button>

			{#if newsError}
				<div class="flex items-start gap-2 p-2.5 rounded-xl bg-red-500/10 border border-red-500/20 mt-1">
					<AlertCircle size={12} class="text-red-400 shrink-0 mt-0.5" />
					<p class="text-[11px] font-body text-red-400 leading-relaxed">{newsError}</p>
				</div>
			{/if}

			<!-- Divider -->
			<div class="border-t border-white/[0.05] my-3"></div>

			<!-- Slide tabs + overlay text -->
			<div>
				<div class="flex items-center justify-between mb-2">
					<label class="text-[10px] font-mono text-white/30 uppercase tracking-wider">
						<Type size={9} class="inline mr-1" />Slide Text
					</label>
					{#if generatingVariants}
						<span class="flex items-center gap-1 text-[10px] font-mono text-amber-400">
							<Loader size={9} class="animate-spin" /> Writing slides…
						</span>
					{/if}
				</div>

				<!-- Per-slide template selector -->
				<div class="flex items-center gap-2 mb-2">
					<div class="flex-1">
						<p class="text-[9px] font-mono text-white/30 uppercase tracking-widest mb-1.5">Template (this slide)</p>
						<select
							value={activeTemplate}
							onchange={(e) => setActiveTemplate((e.target as HTMLSelectElement).value as TemplateId)}
							class="w-full bg-white/3 border border-white/10 rounded-xl py-2 px-3 text-xs font-mono text-white/60 focus:outline-none focus:border-violet-500/40 transition-colors scheme-dark cursor-pointer"
						>
							{#each TEMPLATES as t (t.id)}
								<option value={t.id}>{t.label}</option>
							{/each}
						</select>
					</div>
					<div class="pt-6">
						<button
							onclick={() => applyTemplateToAll(activeTemplate)}
							class="px-3 py-2 rounded-xl bg-white/2 border border-white/6 text-[10px] font-mono text-white/55 hover:bg-white/4 transition-colors"
							title="Apply this template to all slides"
						>
							Apply all
						</button>
					</div>
					<div class="pt-6">
						<button
							type="button"
							onclick={resetActiveTemplateContent}
							class="px-3 py-2 rounded-xl bg-white/2 border border-white/6 text-[10px] font-mono text-white/55 hover:bg-white/4 transition-colors"
							title="Reset this template to its default demo content"
						>
							Reset
						</button>
					</div>
				</div>

				<!-- Slide tabs -->
				{#if slides.length > 1}
					<div class="flex gap-1 mb-2 flex-wrap">
						{#each slides as _, i}
							<button
								onclick={() => activeSlide = i}
								class="px-2.5 py-1 rounded-lg text-[10px] font-mono transition-all
									{activeSlide === i
										? 'bg-violet-500/20 text-violet-300 border border-violet-500/25'
										: 'bg-white/[0.03] text-white/30 border border-white/[0.05] hover:text-white/50'}">
								{i === 0 ? '① Hook' : `${['②','③','④','⑤','⑥','⑦','⑧','⑨','⑩'][i-1] ?? i+1} Slide ${i+1}`}
							</button>
						{/each}
					</div>
				{/if}

				<!-- Headline/highlight editor removed from sidebar (use inline editing on canvas) -->

				<!-- Word count warning -->
				{#if overlayText.split(/\s+/).filter(Boolean).length > 28}
					<p class="text-[10px] font-mono text-amber-400 mt-1">
						⚠ {overlayText.split(/\s+/).filter(Boolean).length} words — keep under 28 for best results
					</p>
				{/if}
			</div>

			<!-- Source label -->
			<div>
				<label class="text-[10px] font-mono text-white/30 uppercase tracking-wider block mb-2">Source Label</label>
				<input bind:value={source} placeholder="Markets"
					class="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl py-2.5 px-3 text-sm font-body text-white placeholder-white/20 focus:outline-none focus:border-violet-500/50 transition-colors" />
			</div>

			<!-- Bottom shadow controls -->
			<div>
				<div class="flex items-center justify-between mb-2">
					<label for="shadow-h" class="text-[10px] font-mono text-white/30 uppercase tracking-wider">
						Bottom Shadow
					</label>
					<button
						type="button"
						onclick={() => { shadowHeight = 75; shadowStrength = 1; }}
						class="text-[9px] font-mono text-white/30 hover:text-white/60 transition-colors"
						title="Reset shadow"
					>Reset</button>
				</div>
				<div class="flex items-center gap-2 mb-2">
					<span class="text-[9px] font-mono text-white/40 w-10">Height</span>
					<input
						id="shadow-h"
						type="range"
						min="0"
						max="100"
						step="1"
						bind:value={shadowHeight}
						class="flex-1 accent-violet-500"
					/>
					<span class="text-[9px] font-mono text-white/40 w-8 text-right">{shadowHeight}%</span>
				</div>
				<div class="flex items-center gap-2">
					<span class="text-[9px] font-mono text-white/40 w-10">Darkness</span>
					<input
						type="range"
						min="0"
						max="1"
						step="0.05"
						bind:value={shadowStrength}
						class="flex-1 accent-violet-500"
					/>
					<span class="text-[9px] font-mono text-white/40 w-8 text-right">{Math.round(shadowStrength * 100)}%</span>
				</div>
			</div>

			<!-- Divider -->
			<div class="border-t border-white/[0.05] my-3"></div>

			<!-- Text color control removed (use floating text toolbar instead) -->

			<!-- Background image -->
			<div>
				<label class="text-[10px] font-mono text-white/30 uppercase tracking-wider block mb-2">
					<Image size={9} class="inline mr-1" />Background — Slide {activeSlide + 1}
				</label>
				<div class="flex flex-col gap-2">
					<button onclick={() => generateBackground(activeSlide)}
						disabled={(generatingImagesByTemplate.news ?? [])[activeSlide]}
						class="flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold font-body text-violet-300 bg-violet-500/10 hover:bg-violet-500/20 border border-violet-500/15 transition-all disabled:opacity-50">
						{#if (generatingImagesByTemplate.news ?? [])[activeSlide]}
							<Loader size={11} class="animate-spin" /> Generating...
						{:else}
							<Sparkles size={11} /> Regenerate with AI
						{/if}
					</button>
					<button onclick={() => generateAllSlideImages()}
						disabled={(generatingImagesByTemplate.news ?? []).some(Boolean)}
						class="flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold font-body text-cyan-300 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/15 transition-all disabled:opacity-50">
						{#if (generatingImagesByTemplate.news ?? []).some(Boolean)}
							<Loader size={11} class="animate-spin" /> Generating all…
						{:else}
							<Sparkles size={11} /> Regenerate all slides
						{/if}
					</button>
					<!-- Upload row: image + video side by side -->
					<div class="grid grid-cols-2 gap-2">
						<label class="flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold font-body text-white/40 glass glass-hover border border-white/[0.06] transition-all cursor-pointer">
							<Image size={11} /> Photo
							<input type="file" accept="image/*" class="sr-only" onchange={handleBgUpload} />
						</label>
						<label class="flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold font-body text-white/40 glass glass-hover border border-white/[0.06] transition-all cursor-pointer">
							<span class="text-base leading-none" style="font-size:11px;">▶</span> Video
							<input type="file" accept="video/mp4,video/webm,video/quicktime" class="sr-only" onchange={handleVideoUpload} />
						</label>
					</div>

					<!-- ── Subject cutout (AI background removal) ──────────────── -->
					{#if backgroundImage && !backgroundVideo}
						<div class="flex flex-col gap-1.5 pt-1 border-t border-white/[0.05] mt-1">
							<div class="flex items-center justify-between">
								<p class="text-[10px] font-mono text-white/25 uppercase tracking-wider">
									<Scissors size={9} class="inline mr-1" />Subject Cutout
								</p>
								{#if activeCutout}
									<button
										onclick={() => toggleCutoutVisibility()}
										class="flex items-center gap-1 text-[10px] font-mono transition-colors
											{activeShowCutout ? 'text-emerald-400' : 'text-white/30 hover:text-white/60'}"
										title="{activeShowCutout ? 'Hide cutout' : 'Show cutout'}"
									>
										{#if activeShowCutout}
											<Eye size={10} /> ON
										{:else}
											<EyeOff size={10} /> OFF
										{/if}
									</button>
								{/if}
							</div>

							{#if activeCutting}
								<!-- Progress state -->
								<div class="flex flex-col gap-1.5 p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
									<div class="flex items-center gap-2">
										<Loader size={11} class="animate-spin text-emerald-400 flex-shrink-0" />
										<span class="text-[11px] font-mono text-emerald-300 flex-1 truncate">
											{cutoutMessage || 'Cutting subject…'}
										</span>
									</div>
									{#if cutoutProgress > 0}
										<div class="h-1 rounded-full bg-white/[0.06] overflow-hidden">
											<div
												class="h-full bg-emerald-400 transition-all"
												style="width: {Math.round(cutoutProgress * 100)}%;"
											></div>
										</div>
									{/if}
								</div>
							{:else if activeCutout}
								<!-- Cutout exists: preview + actions -->
								<div class="flex items-center gap-2 p-2 rounded-xl bg-white/[0.03] border border-white/[0.06]">
									<div class="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0" style="background: repeating-conic-gradient(#222 0% 25%, #333 0% 50%) 50% / 12px 12px;">
										<img src={activeCutout} alt="cutout" class="w-full h-full object-contain" />
									</div>
									<span class="text-[11px] font-mono text-emerald-300 flex-1">Subject isolated</span>
									<button
										onclick={() => cutOutSubject()}
										title="Regenerate cutout"
										class="text-white/20 hover:text-emerald-400 transition-colors"
									>
										<RefreshCw size={11} />
									</button>
									<button
										onclick={() => clearCutout()}
										title="Remove cutout"
										class="text-white/20 hover:text-red-400 transition-colors text-xs"
									>✕</button>
								</div>
								<p class="text-[10px] font-body text-white/25 leading-relaxed">
									Cutout sits in <b class="text-white/50">front</b> of the circle — so the subject overlaps it like the reference image.
								</p>
							{:else}
								<!-- No cutout yet: CTA -->
								<button
									onclick={() => cutOutSubject()}
									class="flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold font-body text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/15 transition-all"
								>
									<Scissors size={11} /> Cut out subject
								</button>
								<p class="text-[10px] font-body text-white/25 leading-relaxed">
									Removes the background so the subject sits <b class="text-white/50">in front</b> of the circle. First run downloads a ~40MB AI model.
								</p>
							{/if}

							{#if cutoutError}
								<p class="text-[10px] font-body text-red-400/80 leading-relaxed">{cutoutError}</p>
							{/if}
						</div>
					{/if}

					<!-- Active video indicator -->
					{#if backgroundVideo}
						<div class="flex items-center gap-2 px-2.5 py-2 rounded-xl bg-cyan-500/10 border border-cyan-500/20">
							<span class="text-cyan-400 text-[11px]">▶</span>
							<span class="text-[11px] font-mono text-cyan-300 flex-1 truncate">Video background active</span>
							<button onclick={() => clearSlideBackground(activeSlide)} class="text-white/20 hover:text-red-400 transition-colors text-xs">✕</button>
						</div>
					{/if}

					<!-- Video trim UI is rendered under the preview (YouTube-style) -->

					{#if bgError}
						<p class="text-[10px] font-body text-amber-400/70 leading-relaxed">{bgError}</p>
					{/if}

					<!-- Position + zoom sliders (shown when a background is loaded) -->
					{#if backgroundImage || backgroundVideo}
						<div class="flex flex-col gap-1.5 pt-1">
							<p class="text-[10px] font-mono text-white/25 uppercase tracking-wider mb-0.5">
								Position <span class="normal-case text-white/15 font-body">(or drag in preview)</span>
							</p>
							<!-- Horizontal -->
							<div class="flex items-center gap-2.5">
								<span class="text-[10px] font-mono text-white/30 w-3 flex-shrink-0">←</span>
								<input
									type="range" min="0" max="100" step="1"
									bind:value={bgOffsetX}
									class="flex-1 h-1 rounded-full accent-violet-400 cursor-pointer"
								/>
								<span class="text-[10px] font-mono text-white/30 w-3 flex-shrink-0 text-right">→</span>
							</div>
							<!-- Vertical -->
							<div class="flex items-center gap-2.5">
								<span class="text-[10px] font-mono text-white/30 w-3 flex-shrink-0">↑</span>
								<input
									type="range" min="0" max="100" step="1"
									bind:value={bgOffsetY}
									class="flex-1 h-1 rounded-full accent-violet-400 cursor-pointer"
								/>
								<span class="text-[10px] font-mono text-white/30 w-3 flex-shrink-0 text-right">↓</span>
							</div>

							<!-- Zoom: <100% shrinks (letterboxed on dark bg),
							     >100% zooms in. Double-click the label to reset. -->
							<div class="flex items-center justify-between mt-1 mb-0.5">
								<button
									type="button"
									onclick={() => bgZoom = 100}
									class="text-[10px] font-mono text-white/25 uppercase tracking-wider hover:text-violet-400 transition-colors"
									title="Reset zoom to 100%"
								>
									Zoom
								</button>
								<span class="text-[9px] font-mono text-white/40">{bgZoom}%</span>
							</div>
							<div class="flex items-center gap-2.5">
								<span class="text-[10px] font-mono text-white/30 w-3 flex-shrink-0">−</span>
								<input
									type="range" min="30" max="200" step="1"
									bind:value={bgZoom}
									class="flex-1 h-1 rounded-full accent-violet-400 cursor-pointer"
								/>
								<span class="text-[10px] font-mono text-white/30 w-3 flex-shrink-0 text-right">+</span>
							</div>
						</div>
					{/if}
				</div>
			</div>

			<!-- Circle badge controls removed from sidebar (managed on-canvas) -->

			<!-- Export -->
			<button onclick={exportPng} disabled={exporting || exportingAll}
				class="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold font-body text-[#0a0a0a] bg-[#E8FF48] hover:bg-[#f0ff70] hover:shadow-[0_6px_24px_rgba(232,255,72,0.25)] transition-all disabled:opacity-50">
				{#if exporting}
					<Loader size={13} class="animate-spin" /> Exporting...
				{:else}
					<Download size={13} /> Export {CANVAS_W}×{CANVAS_H} PNG
				{/if}
			</button>

			<!-- Posting now automatically exports slides; no separate export button -->

			{#if articleUrl}
				<a href={articleUrl} target="_blank" rel="noopener noreferrer"
					class="text-center text-[10px] font-body text-violet-400/60 hover:text-violet-400 transition-colors underline underline-offset-2">
					View source article ↗
				</a>
			{/if}
		</div>
	</div>

	<!-- ── Right panel: preview ──────────────────────────────────────────── -->
	<div class="flex-1 flex flex-col items-center justify-center bg-[#080808] overflow-hidden p-6 gap-4 studio-right" style="background: var(--app-bg);">

		<!-- Format tabs + view mode -->
		<div class="flex items-center gap-3">
			<div class="flex items-center rounded-2xl bg-white/2 border border-white/6 overflow-hidden">
				{#each FORMATS as f (f.id)}
					<button
						onclick={() => (formatId = f.id)}
						class="px-3 py-2 text-[10px] font-mono transition-colors
							{formatId === f.id ? 'bg-violet-500/20 text-violet-200' : 'text-white/45 hover:text-white/80'}"
						title={`${f.w}×${f.h}`}
					>
						{f.label}
					</button>
				{/each}
			</div>

		</div>

		<!-- Slide indicator + nav arrows -->
		<!-- Slide switcher removed (filmstrip below is the navigator) -->

		<!-- Main preview + quick actions (next to canvas) -->
		<div class="flex items-start gap-3 relative">
			<div style="width: {PREVIEW_WIDTH}px;" class="relative z-10">
				<!-- Clip any absolutely-positioned template layers so they don't sit over the toolbar -->
				<div style="height: {CANVAS_H * previewScale}px; background: var(--app-surface-2); border: 1px solid var(--app-border);" class="relative overflow-hidden rounded-2xl">
			{#if studioBooting}
				<!-- Initial boot overlay: avoid template "jump" while restoring draft -->
				<div class="absolute inset-0 rounded-2xl z-20 flex items-center justify-center" style="background: var(--app-surface-2); border: 1px solid var(--app-border);">
					<div class="w-[78%] max-w-[420px]">
						<div class="flex items-center gap-2 mb-3">
							<Loader size={16} class="animate-spin text-violet-400" />
							<p class="text-xs font-mono" style="color: var(--app-text-muted);">
								Loading Studio…
							</p>
						</div>
						<div class="boot-skel rounded-2xl p-4">
							<div class="h-3 w-2/3 rounded-lg bg-white/10 mb-3"></div>
							<div class="h-3 w-5/6 rounded-lg bg-white/10 mb-2"></div>
							<div class="h-3 w-3/4 rounded-lg bg-white/10 mb-6"></div>
							<div class="h-24 rounded-2xl bg-white/8 mb-4"></div>
							<div class="flex items-center justify-between">
								<div class="h-2 w-24 rounded bg-white/10"></div>
								<div class="h-2 w-16 rounded bg-white/10"></div>
							</div>
						</div>
						<p class="text-[10px] font-body mt-3 leading-relaxed" style="color: var(--app-text-muted);">
							Restoring your last edit so nothing gets lost.
						</p>
					</div>
				</div>
			{/if}
			{#if (generatingImagesByTemplate[activeTemplate] ?? [])[activeSlide]}
				<!-- Image loading overlay -->
				<div class="absolute inset-0 rounded-2xl flex flex-col items-center justify-center gap-3 z-10" style="background: var(--app-surface-3); border: 1px solid var(--app-border);">
					<Loader size={20} class="animate-spin text-violet-400" />
					<p class="text-xs font-mono" style="color: var(--app-text-muted);">Generating image…</p>
				</div>
			{:else if generatingVariants && activeSlide > 0 && !slides[activeSlide]}
				<div class="absolute inset-0 rounded-2xl flex flex-col items-center justify-center gap-3 z-10" style="background: var(--app-surface-3); border: 1px solid var(--app-border);">
					<Loader size={20} class="animate-spin text-amber-400" />
					<p class="text-xs font-mono" style="color: var(--app-text-muted);">Writing slide {activeSlide + 1}…</p>
				</div>
			{/if}
			{#if activeTemplate === 'news'}
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
					bind:textPanelOffsetY
					bind:shadowHeight
					bind:shadowStrength
					backgroundImage={backgroundImage}
					backgroundVideo={backgroundVideo}
					videoTrimStartSec={activeVideoTrimStartSec}
					videoTrimEndSec={activeVideoTrimEndSec || activeVideoDurationSec || 0}
					videoSeekSec={videoSeekSec}
					videoMuted={activeVideoMuted}
					videoVolume={activeVideoVolume}
					onVideoDuration={(d) => {
							const dur = Number(d);
							if (!Number.isFinite(dur) || dur <= 0) return;
							videoDurationBySlide = Array.from(
								{ length: slides.length },
								(_, i) => (i === activeSlide ? dur : (Number.isFinite(videoDurationBySlide[i]) ? Math.max(0, videoDurationBySlide[i]) : 0))
							);
							// If end is unset, default it to full duration.
							const curEnd = videoTrimEndSecBySlide[activeSlide] ?? 0;
							if (!curEnd) {
								videoTrimEndSecBySlide = Array.from(
									{ length: slides.length },
									(_, i) => (i === activeSlide ? dur : (Number.isFinite(videoTrimEndSecBySlide[i]) ? Math.max(0, videoTrimEndSecBySlide[i]) : 0))
								);
							}
						}}
					subjectCutout={activeCutout}
showSubjectCutout={activeShowCutout}
					allowCircle={showCircle}
					allowCircle2={true}
					circleImage={showCircle ? activeCircleImage : ''}
					showCircle2={activeShowCircle2}
					circle2Image={activeShowCircle2 ? activeCircle2Image : ''}
					text={overlayText}
					source={source}
					highlightColor={highlightColor}
					textColor={textColor}
					w={CANVAS_W}
					h={CANVAS_H}
					scale={previewScale}
					interactive={true}
					overlays={activeOverlays}
					textOverlays={[]}
					headlineStyle={activeHeadlineStyle}
					sourceStyle={activeSourceStyle}
					selectedText={selectedText}
					onTextChange={(t) => setActiveSlideText(t)}
					onCircleMove={(x, y) => { circleX = x; circleY = y; }}
					onCircleImageChange={(src) => {
						circleImages = circleImages.map((v, i) => (i === activeSlide ? src : v));
						if (String(src ?? '').trim()) showCircle = true;
					}}
					onCircleRemove={() => {
						circleImages = circleImages.map((v, i) => (i === activeSlide ? '' : v));
						showCircle = false;
					}}
					onCircleAIClick={() => generateCircleFromPrompt(1)}
					onCircle2Move={(x, y) => { circle2X = x; circle2Y = y; }}
					onCircle2ImageChange={(src) => {
						circle2Images = circle2Images.map((v, i) => (i === activeSlide ? src : v));
						showCircle2BySlide = showCircle2BySlide.map((v, i) => (i === activeSlide ? !!src : v));
					}}
					onCircle2AIClick={() => generateCircleFromPrompt(2)}
					onOverlaysChange={(o) => setSlideOverlays(activeSlide, o)}
					onTextSelect={onTextSelect}
					onHeadlineRangeSelect={onHeadlineRangeSelect}
				/>
				<!-- Shared text overlay layer (sits above the template) -->
				<TextOverlayLayer
					w={CANVAS_W}
					h={CANVAS_H}
					scale={previewScale}
					interactive={true}
					highlightColor={highlightColor}
					textOverlays={activeTextOverlays}
					selectedId={selectedText === 'textOverlay' ? selectedTextOverlayId : null}
					onRangeSelect={onTextOverlayRangeSelect}
					onTextOverlaysChange={(o: any) => setSlideTextOverlays(activeSlide, o)}
					onTextSelect={(kind: any, el: any) => onTextSelect(kind as any, el)}
				/>
			{:else if activeTemplate === 'article'}
				<!-- Shared text overlay layer for non-News templates -->
				<TextOverlayLayer
					w={CANVAS_W}
					h={CANVAS_H}
					scale={previewScale}
					interactive={true}
					highlightColor={highlightColor}
					textOverlays={activeTextOverlays}
					selectedId={selectedText === 'textOverlay' ? selectedTextOverlayId : null}
					onRangeSelect={onTextOverlayRangeSelect}
					onTextOverlaysChange={(o: any) => setSlideTextOverlays(activeSlide, o)}
					onTextSelect={(kind: any, el: any) => onTextSelect(kind as any, el)}
				/>
				<ArticleTemplate
					templateTheme={uiTheme}
					bind:exportRef
					text={articleTextBySlide[activeSlide] ?? ''}
					image={backgroundImage}
					swipeText={articleSwipeTextBySlide[activeSlide] ?? '«« Swipe'}
					onSwipeTextChange={(v) => { pushUndo('article', activeSlide); articleSwipeTextBySlide = articleSwipeTextBySlide.map((x, i) => i === activeSlide ? v : x); }}
					textOffsets={offsetsForTemplate(activeSlide, 'article')}
					onTextOffsetChange={(kind, next) => setTemplateOffset(activeSlide, 'article', String(kind), next)}
					scale={previewScale}
					interactive={true}
					headlineStyle={activeStyleMap.articleBody ?? activeHeadlineStyle}
					articleStyles={{
						articleBody: activeStyleMap.articleBody ?? {},
						articleSwipeText: activeStyleMap.articleSwipeText ?? {},
					}}
					selectedText={selectedText}
					onTextChange={(t) => { pushUndo('article', activeSlide); articleTextBySlide = articleTextBySlide.map((x, i) => i === activeSlide ? t : x); }}
					onTextSelect={onTextSelect}
					onHeadlineRangeSelect={onHeadlineRangeSelect}
				/>
			{:else if activeTemplate === 'tweet'}
				<TextOverlayLayer
					w={CANVAS_W}
					h={CANVAS_H}
					scale={previewScale}
					interactive={true}
					highlightColor={highlightColor}
					textOverlays={activeTextOverlays}
					selectedId={selectedText === 'textOverlay' ? selectedTextOverlayId : null}
					onRangeSelect={onTextOverlayRangeSelect}
					onTextOverlaysChange={(o: any) => setSlideTextOverlays(activeSlide, o)}
					onTextSelect={(kind: any, el: any) => onTextSelect(kind as any, el)}
				/>
				<!-- Tweet: minimal integration for now (top tweet text = slide text). -->
				<TweetTemplate
					templateTheme={uiTheme}
					bind:exportRef
					topText={tweetTopTextBySlide[activeSlide] ?? ''}
					onTopTextChange={(v) => { pushUndo('tweet', activeSlide); tweetTopTextBySlide = tweetTopTextBySlide.map((x, i) => i === activeSlide ? v : x); }}
					/* Editable per-slide tweet fields */
					topName={tweetTopNameBySlide[activeSlide] ?? 'Chef 👨‍🍳'}
					topHandle={tweetTopHandleBySlide[activeSlide] ?? '@chefsevenn'}
					bottomName={tweetBottomNameBySlide[activeSlide] ?? 'Mo Mohler'}
					bottomHandle={tweetBottomHandleBySlide[activeSlide] ?? '@MoMohler'}
					onTopNameChange={(v) => { pushUndo('tweet', activeSlide); tweetTopNameBySlide = tweetTopNameBySlide.map((x, i) => i === activeSlide ? v : x); }}
					onTopHandleChange={(v) => { pushUndo('tweet', activeSlide); tweetTopHandleBySlide = tweetTopHandleBySlide.map((x, i) => i === activeSlide ? v : x); }}
					onBottomNameChange={(v) => { pushUndo('tweet', activeSlide); tweetBottomNameBySlide = tweetBottomNameBySlide.map((x, i) => i === activeSlide ? v : x); }}
					onBottomHandleChange={(v) => { pushUndo('tweet', activeSlide); tweetBottomHandleBySlide = tweetBottomHandleBySlide.map((x, i) => i === activeSlide ? v : x); }}
					bottomText={tweetBottomTextBySlide[activeSlide] ?? ''}
					onBottomTextChange={(v) => { pushUndo('tweet', activeSlide); tweetBottomTextBySlide = tweetBottomTextBySlide.map((x, i) => i === activeSlide ? v : x); }}
					replyCount={tweetReplyCountBySlide[activeSlide] ?? '4.2K'}
					repostCount={tweetRepostCountBySlide[activeSlide] ?? '12.8K'}
					likeCount={tweetLikeCountBySlide[activeSlide] ?? '89.4K'}
					onReplyCountChange={(v) => { pushUndo('tweet', activeSlide); tweetReplyCountBySlide = tweetReplyCountBySlide.map((x, i) => i === activeSlide ? v : x); }}
					onRepostCountChange={(v) => { pushUndo('tweet', activeSlide); tweetRepostCountBySlide = tweetRepostCountBySlide.map((x, i) => i === activeSlide ? v : x); }}
					onLikeCountChange={(v) => { pushUndo('tweet', activeSlide); tweetLikeCountBySlide = tweetLikeCountBySlide.map((x, i) => i === activeSlide ? v : x); }}
topImage={(bgImagesByTemplate.tweet ?? [])[activeSlide] || '/templates/tweet/demo-bg.jpg'}
onTopImageChange={(v) => { pushUndo('tweet', activeSlide); setSlideImage(activeSlide, v, 'tweet'); }}
topVideo={(bgVideosByTemplate.tweet ?? [])[activeSlide] ?? ''}
onTopVideoChange={(v) => { pushUndo('tweet', activeSlide); setSlideVideo(activeSlide, v, 'tweet'); }}
topImageHeight={tweetTopImageHeightBySlide[activeSlide] ?? 360}
onTopImageHeightChange={(v) => { pushUndo('tweet', activeSlide); tweetTopImageHeightBySlide = tweetTopImageHeightBySlide.map((x, i) => i === activeSlide ? v : x); }}
topImageWidth={tweetTopImageWidthBySlide[activeSlide] ?? 920}
onTopImageWidthChange={(v) => { pushUndo('tweet', activeSlide); tweetTopImageWidthBySlide = tweetTopImageWidthBySlide.map((x, i) => i === activeSlide ? v : x); }}
topImageZoom={tweetTopImageZoomBySlide[activeSlide] ?? 1}
onTopImageZoomChange={(v) => { pushUndo('tweet', activeSlide); tweetTopImageZoomBySlide = tweetTopImageZoomBySlide.map((x, i) => i === activeSlide ? v : x); }}
topImagePanX={tweetTopImagePanXBySlide[activeSlide] ?? 50}
topImagePanY={tweetTopImagePanYBySlide[activeSlide] ?? 50}
onTopImagePanChange={(x, y) => { pushUndo('tweet', activeSlide); tweetTopImagePanXBySlide = tweetTopImagePanXBySlide.map((v, i) => i === activeSlide ? x : v); tweetTopImagePanYBySlide = tweetTopImagePanYBySlide.map((v, i) => i === activeSlide ? y : v); }}
					textOffsets={offsetsForTemplate(activeSlide, 'tweet')}
					onTextOffsetChange={(kind, next) => setTemplateOffset(activeSlide, 'tweet', String(kind), next)}
					scale={previewScale}
					interactive={true}
					tweetStyles={activeTweetStyles}
					{...({
						headlineStyle: activeHeadlineStyle,
						selectedText,
						onTextSelect,
						onHeadlineRangeSelect,
						showToolbar: false,
					} as any)}
				/>
			{:else if activeTemplate === 'textCarousel'}
				<TextOverlayLayer
					w={CANVAS_W}
					h={CANVAS_H}
					scale={previewScale}
					interactive={true}
					highlightColor={highlightColor}
					textOverlays={activeTextOverlays}
					selectedId={selectedText === 'textOverlay' ? selectedTextOverlayId : null}
					onRangeSelect={onTextOverlayRangeSelect}
					onTextOverlaysChange={(o: any) => setSlideTextOverlays(activeSlide, o)}
					onTextSelect={(kind: any, el: any) => onTextSelect(kind as any, el)}
				/>
				<TextCarouselTemplate
					templateTheme={uiTheme}
					bind:exportRef
					text={textCarouselTextBySlide[activeSlide] ?? ''}
					name={textCarouselNameBySlide[activeSlide] ?? 'Captains of industry'}
					handle={textCarouselHandleBySlide[activeSlide] ?? '@captainsofindustryy'}
					onNameChange={(v) => { pushUndo('textCarousel', activeSlide); textCarouselNameBySlide = textCarouselNameBySlide.map((x, i) => i === activeSlide ? v : x); }}
					onHandleChange={(v) => { pushUndo('textCarousel', activeSlide); textCarouselHandleBySlide = textCarouselHandleBySlide.map((x, i) => i === activeSlide ? v : x); }}
					scale={previewScale}
					interactive={true}
					showToolbar={false}
					textOffsets={offsetsForTemplate(activeSlide, 'textCarousel')}
					onTextOffsetChange={(kind, next) => setTemplateOffset(activeSlide, 'textCarousel', String(kind), next)}
					headlineStyle={activeStyleMap.textCarouselBody ?? activeHeadlineStyle}
					textCarouselStyles={{
						textCarouselName: activeStyleMap.textCarouselName ?? {},
						textCarouselHandle: activeStyleMap.textCarouselHandle ?? {},
						textCarouselBody: activeStyleMap.textCarouselBody ?? {},
					}}
					selectedText={selectedText}
					onTextChange={(t) => { pushUndo('textCarousel', activeSlide); textCarouselTextBySlide = textCarouselTextBySlide.map((x, i) => i === activeSlide ? t : x); }}
					onTextSelect={onTextSelect}
					onHeadlineRangeSelect={onHeadlineRangeSelect}
				/>
			{:else}
				<!-- Image Quote template removed from public UI. Keep a safe fallback. -->
				<TextOverlayLayer
					w={CANVAS_W}
					h={CANVAS_H}
					scale={previewScale}
					interactive={true}
					highlightColor={highlightColor}
					textOverlays={activeTextOverlays}
					selectedId={selectedText === 'textOverlay' ? selectedTextOverlayId : null}
					onRangeSelect={onTextOverlayRangeSelect}
					onTextOverlaysChange={(o: any) => setSlideTextOverlays(activeSlide, o)}
					onTextSelect={(kind: any, el: any) => onTextSelect(kind as any, el)}
				/>
				<NewsTemplate
					templateTheme={uiTheme}
					bind:exportRef
					backgroundImage={backgroundImage}
					backgroundVideo={backgroundVideo}
					videoTrimStartSec={activeVideoTrimStartSec}
					videoTrimEndSec={activeVideoTrimEndSec || activeVideoDurationSec || 0}
					videoSeekSec={videoSeekSec}
					videoMuted={activeVideoMuted}
					videoVolume={activeVideoVolume}
					text={overlayText}
					source={source}
					highlightColor={highlightColor}
					textColor={textColor}
					w={CANVAS_W}
					h={CANVAS_H}
					scale={previewScale}
					interactive={true}
					overlays={activeOverlays}
					textOverlays={[]}
					headlineStyle={activeHeadlineStyle}
					sourceStyle={activeSourceStyle}
					selectedText={selectedText}
					onTextChange={(t) => setActiveSlideText(t)}
					onOverlaysChange={(o) => setSlideOverlays(activeSlide, o)}
					onTextSelect={onTextSelect}
					onHeadlineRangeSelect={onHeadlineRangeSelect}
				/>
			{/if}
				</div>
			</div>

			<!-- Quick actions column -->
			<div class="flex flex-col gap-2 pt-1 relative z-50 pointer-events-auto">
					<input
						bind:this={circle2QuickInput}
						type="file"
						accept="image/*"
						class="sr-only"
						onchange={handleCircle2Upload}
					/>
					<input
						bind:this={overlayQuickInput}
						type="file"
						accept="image/*"
						class="sr-only"
						onchange={handleOverlayUpload}
					/>

					<button
						type="button"
						onclick={() => { showVideoTrim = !showVideoTrim; if (!showVideoTrim) videoSeekSec = NaN; }}
						disabled={!backgroundVideo}
						class="w-11 h-11 rounded-2xl border border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.06] text-white/70 hover:text-white flex items-center justify-center transition-all disabled:opacity-30 disabled:hover:bg-white/[0.03] disabled:hover:text-white/70"
						title={backgroundVideo ? 'Trim video' : 'Trim (add a video background first)'}
					>
						<Scissors size={16} />
					</button>

					<button
						type="button"
						onclick={() => {
							if (!backgroundVideo) return;
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
						}}
						disabled={!backgroundVideo}
						class="w-11 h-11 rounded-2xl border border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.06] text-white/70 hover:text-white flex items-center justify-center transition-all disabled:opacity-30 disabled:hover:bg-white/[0.03] disabled:hover:text-white/70"
						title={backgroundVideo ? (activeVideoMuted ? 'Unmute video' : 'Mute video') : 'Volume (add a video background first)'}
					>
						{#if activeVideoMuted}
							<VolumeX size={16} />
						{:else}
							<Volume2 size={16} />
						{/if}
					</button>

					{#if activeTemplate === 'news'}
						<button
							type="button"
							onclick={openCircle2QuickPicker}
							class="w-11 h-11 rounded-2xl border border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.06] text-white/70 hover:text-white flex items-center justify-center transition-all"
							title="Add another circle"
						>
							<span class="text-lg leading-none">◯</span>
						</button>
					{/if}

					<button
						type="button"
						onclick={addTextOverlay}
						class="w-11 h-11 rounded-2xl border border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.06] text-white/70 hover:text-white flex items-center justify-center transition-all"
						title="Add text layer"
					>
						<Type size={16} />
					</button>

					<button
						type="button"
						onclick={openOverlayQuickPicker}
						class="w-11 h-11 rounded-2xl border border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.06] text-white/70 hover:text-white flex items-center justify-center transition-all"
						title="Add image overlay"
					>
						<Image size={16} />
					</button>

					<button
						type="button"
						onclick={undoActive}
						disabled={!canUndoActive()}
						class="w-11 h-11 rounded-2xl border border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.06] text-white/70 hover:text-white flex items-center justify-center transition-all mt-2 disabled:opacity-30 disabled:hover:bg-white/[0.03] disabled:hover:text-white/70"
						title={canUndoActive() ? 'Undo last change' : 'Nothing to undo'}
						aria-label="Undo last change"
					>
						<Undo2 size={16} />
					</button>

					<button
						type="button"
						onclick={resetActiveTemplateContent}
						class="w-11 h-11 rounded-2xl border border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.06] text-white/70 hover:text-white flex items-center justify-center transition-all"
						title="Reset this template"
						aria-label="Reset this template"
					>
						<RefreshCw size={16} />
					</button>
				</div>
		</div>
		<!-- Slide filmstrip: drag to reorder -->
		{#if slideCount > 1}
			{@const orderIds = filmstripIds.length ? filmstripIds : slideIds}
			{@const idToIndex = new Map(slideIds.map((id, i) => [id, i]))}
			{@const dndItems = orderIds.map((id) => {
				const i = idToIndex.get(id) ?? 0;
				const t = slideTemplates[i] ?? 'news';
				const rawThumbText =
					t === 'tweet'
						? `${tweetTopNameBySlide[i] ?? ''}\n${tweetTopTextBySlide[i] ?? ''}`.trim()
						: t === 'article'
							? (articleTextBySlide[i] ?? '')
							: t === 'textCarousel'
								? (textCarouselTextBySlide[i] ?? '')
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
				<div class="no-scrollbar flex gap-2 overflow-x-auto max-w-full pb-1 px-1">
				{#each dndItems as item, i (item.id)}
					{@const isPlaceholder = !item.text}
					{@const hasMusic = !!item.music}
					{@const isVideo = !!item.vid || hasMusic}
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
							class="w-14 h-[70px] rounded-lg overflow-hidden border-2 transition-all relative
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
								{:else if item.vid}
									<div class="absolute inset-0 bg-cyan-950/60 flex items-center justify-center">
										<Play size={14} class="text-cyan-400 opacity-80" fill="currentColor" />
									</div>
								{:else if item.img}
									<img src={item.img} alt="" class="w-full h-full object-cover opacity-70" draggable="false" />
								{:else}
									<div
										class="absolute inset-0"
										style="background: linear-gradient(135deg,
											color-mix(in oklab, var(--app-text) 6%, transparent),
											color-mix(in oklab, var(--color-violet) 12%, transparent)
										);"
									></div>
								{/if}

								{#if !isPlaceholder}
									<div class="absolute inset-0 flex items-end p-1 bg-gradient-to-t from-black/70 to-transparent">
										<p class="text-white leading-tight line-clamp-3"
											style="font-family: 'Bebas Neue', sans-serif; font-size: 6px;">
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
									class="absolute top-[74px] left-1/2 -translate-x-1/2 z-40 w-52 p-2 rounded-xl bg-[#1a1a1a] border border-white/10 shadow-2xl"
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
					class="flex-shrink-0 w-14 h-[70px] rounded-lg border-2 border-dashed border-white/[0.10] hover:border-violet-500/50 bg-white/[0.02] hover:bg-white/[0.04] transition-all flex items-center justify-center text-white/35 hover:text-white"
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
							<div class="flex flex-col items-center gap-1">
								<div class="relative">
									<div
										class="w-14 h-[70px] rounded-lg overflow-hidden border-2 border-white/15 bg-[#111] relative"
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
										{:else if di.vid}
											<div class="absolute inset-0 bg-cyan-950/60 flex items-center justify-center">
												<Play size={14} class="text-cyan-400 opacity-80" fill="currentColor" />
											</div>
										{:else if di.img}
											<img src={di.img} alt="" class="w-full h-full object-cover opacity-80" draggable="false" />
										{/if}

										{#if di.text}
											<div class="absolute inset-0 flex items-end p-1 bg-gradient-to-t from-black/70 to-transparent">
												<p class="text-white leading-tight line-clamp-3"
													style="font-family: 'Bebas Neue', sans-serif; font-size: 6px;">
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
				{#if activeTemplate === 'news' && backgroundVideo && showVideoTrim}
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
	</div>

</div>

{#if circleAIModalFor !== null}
	<!-- Circle AI prompt modal (uses global --app-* tokens for light/dark) -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="fixed inset-0 z-[100] flex items-center justify-center"
		onclick={closeCircleAIModal}
	>
		<div
			class="absolute inset-0 backdrop-blur-sm"
			style="background: color-mix(in oklab, var(--app-text) {uiTheme === 'light' ? '28%' : '52%'}, transparent);"
		></div>
		<div
			class="relative w-[520px] max-w-[92vw] rounded-2xl border p-4 shadow-2xl"
			style="
				background: var(--app-surface-2);
				border-color: var(--app-border);
				color: var(--app-text);
				box-shadow: 0 25px 50px -12px color-mix(in oklab, var(--app-text) 18%, transparent);
			"
			onclick={(e) => e.stopPropagation()}
		>
			<div class="flex items-center justify-between mb-3">
				<div>
					<p class="text-[10px] font-mono uppercase tracking-wider" style="color: var(--app-text-3);">Circle AI</p>
					<p class="text-sm font-body -mt-0.5" style="color: var(--app-text-2);">Generate an image for circle {circleAIModalFor}</p>
				</div>
				<button
					type="button"
					onclick={closeCircleAIModal}
					class="w-8 h-8 rounded-xl border flex items-center justify-center transition-colors"
					style="
						border-color: var(--app-border);
						background: var(--app-surface-3);
						color: var(--app-text-2);
					"
					aria-label="Close"
				>
					<X size={14} />
				</button>
			</div>

			<label
				class="block text-[10px] font-mono uppercase tracking-wider mb-1.5"
				style="color: var(--app-text-3);"
				for="circle-ai-prompt-input"
			>Prompt</label>
			<input
				id="circle-ai-prompt-input"
				bind:value={circleAIPrompt}
				placeholder="e.g. A smiling founder portrait, studio lighting…"
				class="w-full rounded-xl py-2.5 px-3 text-sm font-body focus:outline-none transition-colors circle-ai-prompt-input"
				style="
					background: var(--app-surface-3);
					border: 1px solid var(--app-border);
					color: var(--app-text);
				"
				onkeydown={(e) => { if (e.key === 'Enter') submitCircleAIModal(); if (e.key === 'Escape') closeCircleAIModal(); }}
				autofocus
			/>
			<p class="text-[10px] font-body mt-2 leading-relaxed" style="color: var(--app-text-3);">
				Tip: describe a subject and vibe. Keep it short—no text in the image.
			</p>

			<div class="flex items-center justify-end gap-2 mt-4">
				<button
					type="button"
					onclick={closeCircleAIModal}
					class="px-3 py-2 rounded-xl border text-xs font-mono transition-colors"
					style="
						border-color: var(--app-border);
						background: var(--app-surface-3);
						color: var(--app-text-2);
					"
				>
					Cancel
				</button>
				<button
					type="button"
					onclick={submitCircleAIModal}
					disabled={circleAIGenerating || !circleAIPrompt.trim()}
					class="px-3 py-2 rounded-xl text-xs font-semibold font-body text-[#0a0a0a] bg-[#E8FF48] hover:bg-[#f0ff70] disabled:opacity-50"
				>
					{#if circleAIGenerating}
						<span class="inline-flex items-center gap-2"><Loader size={12} class="animate-spin text-[#0a0a0a]" /> Generating…</span>
					{:else}
						Generate
					{/if}
				</button>
			</div>
		</div>
	</div>
{/if}

<!-- Canva-style floating toolbar for text formatting -->
<FloatingTextToolbar
	anchor={toolbarAnchor}
	style={getActiveStyleForSelection()}
	autoFontSize={toolbarAutoFontSize ?? (selectedText === 'source' ? 34 : selectedText === 'textOverlay' ? 42 : undefined)}
	supportsHighlights={(selectedText === 'headline' ||
		selectedText === 'articleBody' ||
		selectedText === 'textCarouselBody' ||
		selectedText === 'tweetTopName' ||
		selectedText === 'tweetTopHandle' ||
		selectedText === 'tweetTopText' ||
		selectedText === 'tweetBottomName' ||
		selectedText === 'tweetBottomHandle' ||
		selectedText === 'tweetBottomText') || selectedText === 'textOverlay'}
	hasRangeSelection={hasRangeSelection}
	onChange={patchActiveStyle}
	onHighlight={onHighlight}
	onReset={resetActiveStyle}
	onClose={closeToolbar}
/>

<style>
	.boot-skel {
		background:
			linear-gradient(90deg, rgba(255,255,255,0.05), rgba(255,255,255,0.10), rgba(255,255,255,0.05));
		background-size: 220% 100%;
		animation: bootShimmer 1.1s ease-in-out infinite;
		border: 1px solid color-mix(in oklab, var(--app-border) 70%, transparent);
	}
	@keyframes bootShimmer {
		0% { background-position: 0% 0%; }
		100% { background-position: 100% 0%; }
	}
	:root:not([data-theme="dark"]) .studio-left {
		background: var(--app-surface-2) !important;
		border-right-color: var(--app-border) !important;
	}
	:root:not([data-theme="dark"]) .studio-right {
		background: var(--app-bg) !important;
	}
	/* Light theme: override “dark UI” utility classes inside studio-left */
	:root:not([data-theme="dark"]) .studio-left :global(.text-white) { color: var(--app-text) !important; }
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
	:root:not([data-theme="dark"]) .studio-left :global(.text-white\/15) { color: var(--app-text-muted) !important; }

	:root:not([data-theme="dark"]) .studio-left :global(.bg-white\/\[0\.04\]),
	:root:not([data-theme="dark"]) .studio-left :global(.bg-white\/\[0\.03\]),
	:root:not([data-theme="dark"]) .studio-left :global(.bg-white\/\[0\.02\]),
	:root:not([data-theme="dark"]) .studio-left :global(.bg-white\/3),
	:root:not([data-theme="dark"]) .studio-left :global(.bg-white\/2) { background: var(--app-surface-3) !important; }

	:root:not([data-theme="dark"]) .studio-left :global(.border-white\/\[0\.10\]),
	:root:not([data-theme="dark"]) .studio-left :global(.border-white\/\[0\.08\]),
	:root:not([data-theme="dark"]) .studio-left :global(.border-white\/\[0\.06\]),
	:root:not([data-theme="dark"]) .studio-left :global(.border-white\/\[0\.05\]),
	:root:not([data-theme="dark"]) .studio-left :global(.border-white\/\[0\.04\]),
	:root:not([data-theme="dark"]) .studio-left :global(.border-white\/10),
	:root:not([data-theme="dark"]) .studio-left :global(.border-white\/6) { border-color: var(--app-border) !important; }

	:root:not([data-theme="dark"]) .studio-left :global(.placeholder-white\/20)::placeholder { color: var(--app-text-muted) !important; opacity: 0.65; }
	:root:not([data-theme="dark"]) .studio-left :global(input),
	:root:not([data-theme="dark"]) .studio-left :global(select),
	:root:not([data-theme="dark"]) .studio-left :global(textarea) {
		color: var(--app-text) !important;
	}

	select option {
		background: var(--app-surface-2);
		color: var(--app-text);
	}

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
