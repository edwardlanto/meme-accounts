import type { VideoClip, VideoImportMeta } from '$lib/video-clips/types';
import { cleanClipSpeechText } from '$lib/video-clips/transcript-segments';
import { clipNarrative } from '$lib/video-clips/clip-speech';
import {
	demoNewsHeadlineFromClip,
	needsNewsHeadlineRewrite,
} from '$lib/video-clips/news-headline';
import {
	demoVideoHookFromClip,
	looksLikeRawVideoHook,
} from '$lib/video-clips/video-hook';
import {
	fitTextCarouselBodyToCanvas,
	joinTextCarouselParagraphs,
	takeParagraphCount,
} from '$lib/studio/text-carousel-body';

export type ClipTemplateCopy = {
	newsHeadline: string;
	newsSource: string;
	storyHeadline: string;
	/** Casual sentence-case line for the Hook video template. */
	videoHook: string;
	storyWatermark: string;
	tweetTop: string;
	tweetBottom: string;
	carouselName: string;
	carouselHandle: string;
	carouselBody: string;
};

const META_PHRASES = [
	/demo clip/i,
	/connect vertex/i,
	/configure vertex/i,
	/pull real quotes/i,
	/vertex ai/i,
	/gemini/i,
	/the moment that stops the scroll/i,
	/clearest explanation in the whole video/i,
	/why this moment will perform/i,
	/opening hook line/i,
	/relatable story beat/i,
	/unexpected angle viewers/i,
	/what to do next — concrete takeaway/i,
	/strong cold open/i,
	/peak insight/i,
	/emotional beat/i,
	/contrarian take/i,
	/actionable payoff/i,
	/segment \d+$/i,
	/^\[.+\] segment/i,
];

function clampText(s: string, max: number): string {
	const t = s.trim();
	if (t.length <= max) return t;
	return `${t.slice(0, Math.max(0, max - 1)).trimEnd()}…`;
}

function isMetaCopy(s: string): boolean {
	const t = s.trim();
	if (!t) return true;
	if (t.length < 12 && /^(part|clip|segment)\s*\d*$/i.test(t)) return true;
	return META_PHRASES.some((re) => re.test(t));
}

/** Best on-screen quote from clip fields (spoken words, not editor notes). */
export function clipDisplayQuote(clip: VideoClip, source?: VideoImportMeta): string {
	const narrative = clipNarrative(clip, source);
	const candidates = [narrative.hook, narrative.headline, cleanClipSpeechText(clip.title ?? '')].filter(
		Boolean,
	);

	for (const c of candidates) {
		if (!isMetaCopy(c) && c.length >= 8) return c;
	}

	const title = clip.title.trim() || source?.title?.trim() || '';
	return title && !isMetaCopy(title) ? cleanClipSpeechText(title) : '';
}

/** Short line for list UI and small previews. */
export function clipPreviewQuote(clip: VideoClip, source?: VideoImportMeta): string {
	const { hook, headline } = clipNarrative(clip, source);
	return clampText(hook || headline, 160);
}

function handleFromTitle(title: string): string {
	const slug = title
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '')
		.slice(0, 18);
	return slug ? `@${slug}` : '@clips';
}

function carouselBodyFromSentences(sentences: string[]): string {
	const paras = takeParagraphCount(
		sentences.slice(0, 3).map((s) => clampText(s, 320)),
		Math.min(3, Math.max(1, sentences.length)),
	);
	if (!paras.length) return '';
	return fitTextCarouselBodyToCanvas(joinTextCarouselParagraphs(paras), {
		randomizeParagraphCount: false,
	});
}

/** Ensure carousel body always has meaningful content, even with poor clip data. */
function ensureCarouselBody(narrative: ReturnType<typeof clipNarrative>, sourceLabel: string): string {
	// Try sentences first (best quality)
	let body = carouselBodyFromSentences(narrative.sentences);
	if (body) return body;
	
	// Try hook as single paragraph
	if (narrative.hook) {
		body = carouselBodyFromSentences([narrative.hook]);
		if (body) return body;
	}
	
	// Try headline as single paragraph
	if (narrative.headline && !isMetaCopy(narrative.headline)) {
		body = carouselBodyFromSentences([narrative.headline]);
		if (body) return body;
	}
	
	// Last resort: use source label
	return carouselBodyFromSentences([sourceLabel]) || sourceLabel;
}

/** Template-specific copy — headlines and hooks, not raw caption dumps. */
export function buildClipTemplateCopy(
	clip: VideoClip,
	source: VideoImportMeta,
	opts?: { watermark?: string; topicHint?: string },
): ClipTemplateCopy {
	const narrative = clipNarrative(clip, source);
	const topic = opts?.topicHint?.trim() ?? '';
	const watermark = opts?.watermark?.trim() || topic || source.title.slice(0, 32) || 'CLIPS';
	const sourceLabel = clampText(cleanClipSpeechText(source.title), 200);

	// News: Slash/FutureTech hook only — never dump the transcript onto the template
	const speech = clip.transcript || clip.hook || narrative.hook;
	const aiNews = clip.newsHeadline?.trim() ?? '';
	const newsHeadline = clampText(
		!needsNewsHeadlineRewrite(aiNews, {
			transcript: speech,
			videoTitle: source.title,
		})
			? aiNews
			: demoNewsHeadlineFromClip(clip, source.title || source.description?.slice(0, 80)),
		160,
	);

	// Video story: one punchy overlay line
	const storyHeadline = clampText(narrative.hook, 100);

	// Hook video: casual AI sentence-case line above letterboxed clip
	const aiHook = clip.videoHook?.trim() ?? '';
	const videoHook = clampText(
		!looksLikeRawVideoHook(aiHook, speech)
			? aiHook
			: demoVideoHookFromClip(clip, source.title || source.description?.slice(0, 80)),
		90,
	);

	// Tweet: hook on top, source video as quoted reply context below
	const tweetTop = clampText(narrative.hook, 220);
	const tweetBottom =
		narrative.sentences.length > 1 && !isMetaCopy(narrative.sentences[1]!)
			? clampText(narrative.sentences[1]!, 200)
			: sourceLabel;

	// Carousel: profile = clip topic, body = 2–3 clean sentences
	const carouselName = clampText(narrative.headline, 48);
	const carouselHandle = handleFromTitle(carouselName);
	const carouselBody = ensureCarouselBody(narrative, sourceLabel);

	return {
		newsHeadline,
		newsSource: watermark,
		storyHeadline,
		videoHook,
		storyWatermark: watermark,
		tweetTop,
		tweetBottom,
		carouselName,
		carouselHandle,
		carouselBody,
	};
}

/** Direct MP4/WebM URL suitable for &lt;video src&gt; (not YouTube embed pages). */
export function clipDirectVideoUrl(source: VideoImportMeta): string {
	const url = String(source.playbackUrl ?? '').trim();
	if (!url) return '';
	if (/youtube\.com\/embed|youtube-nocookie\.com\/embed|youtu\.be\//i.test(url)) return '';
	if (source.r2Key) return url;
	if (/\.(mp4|webm|mov|m4v)(\?|#|$)/i.test(url)) return url;
	// Signed R2/S3 URLs often omit a file extension in the path
	if (/^https?:\/\//i.test(url)) return url;
	return '';
}

/**
 * Studio import media for a clip. Prefers a cut+reframed standalone MP4 when present
 * (timeline starts at 0). Otherwise uses the full source + absolute trim window.
 */
export function studioImportMediaForClip(
	clip: VideoClip,
	source: VideoImportMeta,
	opts?: { reframedUrlOverride?: string },
): {
	videoUrl: string;
	clipStart: number;
	clipEnd: number;
	usedReframe: boolean;
	/** Subtract from caption segment times when `usedReframe` is true. */
	captionTimeOffsetSec: number;
} {
	const override = String(opts?.reframedUrlOverride ?? '').trim();
	const reframed = override || String(clip.reframedPlaybackUrl ?? '').trim();
	const duration = Math.max(0.5, (Number(clip.endSec) || 0) - (Number(clip.startSec) || 0));

	if (reframed && !/youtube\.com\/embed|youtu\.be\//i.test(reframed)) {
		return {
			videoUrl: reframed,
			clipStart: 0,
			clipEnd: duration,
			usedReframe: true,
			captionTimeOffsetSec: Math.max(0, Number(clip.startSec) || 0),
		};
	}

	const direct = clipDirectVideoUrl(source);
	const fallback = direct || String(source.playbackUrl ?? '').trim();
	return {
		videoUrl: fallback,
		clipStart: Math.max(0, Number(clip.startSec) || 0),
		clipEnd: Math.max(
			Math.max(0, Number(clip.startSec) || 0) + 0.5,
			Number(clip.endSec) || 0,
		),
		usedReframe: false,
		captionTimeOffsetSec: 0,
	};
}

/** Shift caption cues so they match a standalone reframed clip (t=0 at clip start). */
export function shiftCaptionImportTimes<T extends { segments: { startSec: number; endSec: number | null; text: string }[] }>(
	captions: T | null | undefined,
	offsetSec: number,
): T | null {
	if (!captions) return null;
	const offset = Number(offsetSec) || 0;
	if (!(offset > 0)) return captions;
	return {
		...captions,
		segments: captions.segments.map((s) => ({
			...s,
			startSec: Math.max(0, s.startSec - offset),
			endSec: s.endSec != null ? Math.max(0, s.endSec - offset) : null,
		})),
	};
}

export function clipVideoMediaFragment(url: string, startSec: number, endSec: number): string {
	if (!url || !Number.isFinite(startSec)) return url;
	const base = url.split('#')[0] ?? url;
	const start = Math.max(0, Math.floor(startSec));
	const end = Number.isFinite(endSec) && endSec > start ? Math.floor(endSec) : undefined;
	return end != null ? `${base}#t=${start},${end}` : `${base}#t=${start}`;
}
