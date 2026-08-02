import type { VideoClip } from '$lib/video-clips/types';
import { cleanClipSpeechText } from '$lib/video-clips/transcript-segments';
import { looksLikeRawSpeechHeadline } from '$lib/video-clips/news-headline';

/** Reject ALL-CAPS news titles for the casual Hook video template. */
function looksLikeAllCapsNewsHook(text: string): boolean {
	const letters = text.replace(/[^a-zA-Z]/g, '');
	if (letters.length < 12) return false;
	const upper = letters.replace(/[^A-Z]/g, '').length;
	return upper / letters.length >= 0.85;
}

/** True when the hook is empty, speech dump, slogan, or news-style ALL CAPS. */
export function looksLikeRawVideoHook(
	hook: string | undefined | null,
	transcript?: string | null,
): boolean {
	const raw = String(hook ?? '').trim();
	if (!raw) return true;
	// Allow [[phrase]] for Creator-hook bold emphasis — strip before quality checks
	const plain = raw.replace(/\[\[([^\]]*)\]\]/g, '$1').replace(/\s+/g, ' ').trim();
	if (looksLikeAllCapsNewsHook(plain)) return true;
	return looksLikeRawSpeechHeadline(plain, transcript);
}

/**
 * Wrap the first word in `[[...]]` for Source-hook neon highlight when none exists.
 */
export function ensureFirstWordHighlight(text: string): string {
	const raw = String(text ?? '').trim();
	if (!raw) return raw;
	if (/\[\[/.test(raw)) return raw;
	const m = raw.match(/^([^\s\[\].,:;!?]+)([\s\S]*)$/);
	if (!m) return raw;
	const word = m[1]!;
	const rest = m[2] ?? '';
	if (word.length < 2) return raw;
	return `[[${word}]]${rest}`;
}

/**
 * Last-resort sentence-case hook when the LLM path fails.
 * Prefer video/clip title over raw speech.
 */
export function demoVideoHookFromClip(
	clip: Pick<VideoClip, 'title' | 'hook' | 'transcript'>,
	videoTitle?: string,
): string {
	const fromVideo = cleanClipSpeechText(videoTitle ?? '');
	const fromClip = cleanClipSpeechText(clip.title || '');
	const topic =
		(fromVideo.length >= 8 ? fromVideo : '') ||
		(fromClip.length >= 6 && !/^(segment|part|clip)\s*\d+$/i.test(fromClip) ? fromClip : '') ||
		cleanClipSpeechText(clip.hook || '').slice(0, 80) ||
		'This moment is hard to watch';

	const words = topic
		.replace(/\s+/g, ' ')
		.trim()
		.split(/\s+/)
		.filter(Boolean)
		.slice(0, 12);

	if (!words.length) return 'This moment is hard to watch';

	const line = words.join(' ').replace(/[.!?]+$/, '');
	// Sentence case
	const casual = line.charAt(0).toUpperCase() + line.slice(1).toLowerCase();
	return casual.slice(0, 120);
}
