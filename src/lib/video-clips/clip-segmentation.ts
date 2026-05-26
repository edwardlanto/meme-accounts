import type { VideoClip } from '$lib/video-clips/types';
import { excerptFromTimedTranscript } from '$lib/video-clips/transcript-segments';

/** Split the full timeline into back-to-back clips (~target length). */
export function buildFullVideoClips(opts: {
	durationSec: number;
	clipMinSec: number;
	clipMaxSec: number;
	fullTranscript: string;
	videoTitle: string;
}): VideoClip[] {
	const dur = Math.max(1, opts.durationSec);
	const minLen = Math.max(10, opts.clipMinSec);
	const maxLen = Math.max(minLen, opts.clipMaxSec);
	const targetLen = Math.round((minLen + maxLen) / 2);

	const clips: VideoClip[] = [];
	let start = 0;
	let i = 1;

	while (start < dur - 5) {
		const end = Math.min(dur, start + targetLen);
		const excerpt = excerptFromTimedTranscript(opts.fullTranscript, start, end);
		const quote =
			excerpt ||
			`${opts.videoTitle} — ${formatPartLabel(start, end)}`.slice(0, 280);

		clips.push({
			id: String(i),
			title: excerpt
				? quote.split(/\s+/).slice(0, 6).join(' ').replace(/[.!?]+$/, '')
				: `Part ${i}`,
			startSec: Math.round(start * 10) / 10,
			endSec: Math.round(end * 10) / 10,
			viralityScore: 75,
			hook: quote.slice(0, 280),
			reason: '',
			transcript: quote.slice(0, 800),
		});

		start = end;
		i++;
		if (clips.length >= 40) break;
	}

	return clips;
}

function formatPartLabel(start: number, end: number): string {
	const fmt = (s: number) => {
		const m = Math.floor(s / 60);
		const sec = Math.floor(s % 60);
		return `${m}:${String(sec).padStart(2, '0')}`;
	};
	return `${fmt(start)}–${fmt(end)}`;
}
