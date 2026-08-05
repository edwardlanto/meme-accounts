import type { VideoClip } from '$lib/video-clips/types';

/** Clamp and validate clip ranges so they never exceed the real video duration. */
export function normalizeVideoClips(
	clips: VideoClip[],
	durationSec: number,
	clipMinSec: number,
	clipMaxSec: number,
): VideoClip[] {
	const dur = Math.max(0.5, Number(durationSec) || 0);
	const minLen = Math.max(1, clipMinSec);
	const maxLen = Math.max(minLen, clipMaxSec);

	const out: VideoClip[] = [];

	for (const c of clips) {
		let start = Math.max(0, Number(c.startSec) || 0);
		let end = Number(c.endSec);

		if (!Number.isFinite(end) || end <= start) {
			end = Math.min(dur, start + minLen);
		}

		end = Math.min(dur, end);
		start = Math.min(start, Math.max(0, dur - 0.5));

		if (end - start < minLen) {
			start = Math.max(0, end - minLen);
		}
		if (end - start > maxLen) {
			end = Math.min(dur, start + maxLen);
		}

		if (end - start < 1 || start >= dur) continue;

		let bestFrameSec = Number(c.bestFrameSec);
		if (!Number.isFinite(bestFrameSec) || bestFrameSec < start || bestFrameSec > end) {
			bestFrameSec = start + (end - start) * 0.35;
		}

		out.push({
			...c,
			startSec: Math.round(start * 10) / 10,
			endSec: Math.round(end * 10) / 10,
			bestFrameSec: Math.round(bestFrameSec * 10) / 10,
		});
	}

	out.sort((a, b) => a.startSec - b.startSec);
	return out;
}
