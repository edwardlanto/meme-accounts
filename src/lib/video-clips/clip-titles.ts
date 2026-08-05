import type { VideoClip } from '$lib/video-clips/types';
import { collapseRepeatedPhrases } from '$lib/video-clips/transcript-segments';
import {
	cleanClipSpeechText,
	excerptFromTimedTranscript,
	hasTimedTranscript,
} from '$lib/video-clips/transcript-segments';

function titleFromExcerpt(excerpt: string, maxWords = 6): string {
	const cleaned = cleanClipSpeechText(excerpt);
	const sentence = cleaned.split(/(?<=[.!?])\s+/)[0]?.trim() || cleaned;
	const words = sentence
		.replace(/[.!?,;:]+$/, '')
		.split(/\s+/)
		.filter((w) => w.length > 0 && !/^[\[\],.]+$/.test(w));
	if (words.length === 0) return '';
	if (words.length <= maxWords) return words.join(' ');
	return words.slice(0, maxWords).join(' ');
}

function looksLikeVideoTitle(text: string, videoTitle: string): boolean {
	const t = text.trim().toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
	const v = videoTitle.trim().toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
	if (!t || !v) return false;
	if (t === v || v.startsWith(t) || t.startsWith(v.slice(0, Math.min(t.length, v.length)))) return true;
	const tw = t.split(/\s+/).filter((w) => w.length > 2);
	const vw = new Set(v.split(/\s+/).filter((w) => w.length > 2));
	if (tw.length >= 4) {
		const overlap = tw.filter((w) => vw.has(w)).length / tw.length;
		if (overlap >= 0.7) return true;
	}
	return false;
}

/** Fill each clip with segment-specific title, hook, and transcript from timed captions. */
export function enrichClipTitles(
	clips: VideoClip[],
	transcript: string,
	videoTitle = '',
): VideoClip[] {
	if (!clips.length) return clips;

	const timed = hasTimedTranscript(transcript);
	const usedTitles = new Map<string, number>();

	return clips.map((clip, index) => {
		const excerpt = timed
			? excerptFromTimedTranscript(transcript, clip.startSec, clip.endSec)
			: '';

		if (excerpt.length >= 12) {
			const cleaned = collapseRepeatedPhrases(cleanClipSpeechText(excerpt));
			let title = titleFromExcerpt(cleaned) || clip.title;
			const prev = usedTitles.get(title.toLowerCase()) ?? 0;
			usedTitles.set(title.toLowerCase(), prev + 1);
			if (prev > 0) {
				const words = cleaned.split(/\s+/).filter(Boolean);
				title = words.slice(0, Math.min(8 + prev, words.length)).join(' ');
			}

			return {
				...clip,
				title: cleanClipSpeechText(title).slice(0, 120),
				hook: cleaned.slice(0, 280),
				transcript: cleaned.slice(0, 800),
			};
		}

		const generic =
			!clip.title.trim() ||
			looksLikeVideoTitle(clip.title, videoTitle) ||
			looksLikeVideoTitle(clip.hook ?? '', videoTitle) ||
			looksLikeVideoTitle(clip.transcript ?? '', videoTitle);

		if (generic) {
			const part = `Segment ${index + 1}`;
			return {
				...clip,
				title: part,
				hook: clip.hook && !looksLikeVideoTitle(clip.hook, videoTitle)
					? clip.hook
					: `${videoTitle || 'Clip'} (${formatRange(clip.startSec, clip.endSec)})`.slice(0, 280),
			};
		}

		return clip;
	});
}

function formatRange(start: number, end: number): string {
	const fmt = (s: number) => {
		const m = Math.floor(s / 60);
		const sec = Math.floor(s % 60);
		return `${m}:${String(sec).padStart(2, '0')}`;
	};
	return `${fmt(start)}–${fmt(end)}`;
}
