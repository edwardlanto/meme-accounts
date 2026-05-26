import type { VideoClip, VideoImportMeta } from '$lib/video-clips/types';

export type ClipTemplateCopy = {
	newsHeadline: string;
	newsSource: string;
	storyHeadline: string;
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

function stripTimestampMarkup(s: string): string {
	return s
		.replace(/^\[[^\]]+\]\s*/gm, '')
		.replace(/\s+/g, ' ')
		.trim();
}

function isMetaCopy(s: string): boolean {
	const t = s.trim();
	if (!t) return true;
	if (t.length < 12 && /^(part|clip|segment)\s*\d*$/i.test(t)) return true;
	return META_PHRASES.some((re) => re.test(t));
}

/** Best on-screen quote from clip fields (spoken words, not editor notes). */
export function clipDisplayQuote(clip: VideoClip, source?: VideoImportMeta): string {
	const candidates = [
		stripTimestampMarkup(clip.transcript ?? ''),
		stripTimestampMarkup(clip.hook ?? ''),
		stripTimestampMarkup(clip.title ?? ''),
		source?.title?.trim() ?? '',
	].filter(Boolean);

	for (const c of candidates) {
		if (!isMetaCopy(c) && c.length >= 8) return c;
	}

	const title = clip.title.trim() || source?.title?.trim() || '';
	return title && !isMetaCopy(title) ? title : '';
}

/** Short line for small template previews (avoids clipping huge demo strings). */
export function clipPreviewQuote(clip: VideoClip, source?: VideoImportMeta): string {
	const raw = clipDisplayQuote(clip, source);
	if (!raw) return 'Your clip';
	const first = raw.split(/(?<=[.!?])\s+/)[0]?.trim() || raw;
	return clampText(first, 160);
}

function handleFromTitle(title: string): string {
	const slug = title
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '')
		.slice(0, 18);
	return slug ? `@${slug}` : '@clips';
}

function splitQuoteForStory(quote: string): { lead: string; rest: string } {
	const q = quote.trim();
	if (q.length <= 100) return { lead: q, rest: '' };
	const cut = q.slice(0, 100).lastIndexOf(' ');
	const lead = (cut > 40 ? q.slice(0, cut) : q.slice(0, 100)).trim();
	const rest = q.slice(lead.length).trim();
	return { lead, rest };
}

/** Plain-text fields for template previews from an analyzed clip. */
export function buildClipTemplateCopy(
	clip: VideoClip,
	source: VideoImportMeta,
	opts?: { watermark?: string; topicHint?: string },
): ClipTemplateCopy {
	const quote = clipPreviewQuote(clip, source);
	const topic = opts?.topicHint?.trim() ?? '';
	const watermark = opts?.watermark?.trim() || topic || source.title.slice(0, 32) || 'CLIPS';

	const { lead, rest } = splitQuoteForStory(quote);
	const storyHeadline = rest ? `${lead}\n\n${rest}` : lead;

	const newsHeadline = quote;

	const tweetTop = quote;
	const sentences = quote.split(/(?<=[.!?])\s+/).filter(Boolean);
	const tweetBottom =
		sentences.length > 1
			? clampText(sentences.slice(1).join(' '), 200)
			: clampText(source.title, 200);

	const carouselName = clampText(source.title || 'Highlights', 48);
	const carouselHandle = handleFromTitle(carouselName);
	let carouselBody = stripTimestampMarkup(clip.transcript ?? '');
	if (!carouselBody || isMetaCopy(carouselBody)) {
		carouselBody = quote;
	}
	if (!carouselBody.trim()) carouselBody = source.title;
	carouselBody = clampText(carouselBody, 900);

	return {
		newsHeadline: clampText(newsHeadline, 420),
		newsSource: watermark,
		storyHeadline: clampText(storyHeadline, 320),
		storyWatermark: watermark,
		tweetTop: clampText(tweetTop, 230),
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
	if (/youtube\.com\/embed|youtube-nocookie\.com\/embed/i.test(url)) return '';
	if (!source.r2Key && !/\.(mp4|webm|mov|m4v)(\?|#|$)/i.test(url)) return '';
	return url;
}

export function clipVideoMediaFragment(url: string, startSec: number, endSec: number): string {
	if (!url || !Number.isFinite(startSec)) return url;
	const base = url.split('#')[0] ?? url;
	const start = Math.max(0, Math.floor(startSec));
	const end = Number.isFinite(endSec) && endSec > start ? Math.floor(endSec) : undefined;
	return end != null ? `${base}#t=${start},${end}` : `${base}#t=${start}`;
}
