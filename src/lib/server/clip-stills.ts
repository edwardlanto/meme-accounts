/** Extract Gemini-picked scene stills for each clip and upload to R2. */

import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { VideoClip } from '$lib/video-clips/types';
import { r2PutObject, r2SignGet } from '$lib/server/r2';
import { extractFrameWithFfmpeg, withTempDir, checkVideoTools } from '$lib/server/video-pipeline';

/** Default still ~35% into the clip when Gemini omits bestFrameSec. */
export function resolveBestFrameSec(clip: VideoClip): number {
	const start = Math.max(0, Number(clip.startSec) || 0);
	const end = Math.max(start + 0.2, Number(clip.endSec) || start + 1);
	const hinted = Number(clip.bestFrameSec);
	if (Number.isFinite(hinted) && hinted >= start && hinted <= end) return hinted;
	return start + (end - start) * 0.35;
}

/**
 * For each clip, grab a JPEG at bestFrameSec and attach `thumbnailUrl` (+ r2 key).
 * No-ops quietly when ffmpeg / source is unavailable.
 */
export async function attachClipSceneStills(
	userId: string,
	clips: VideoClip[],
	opts: { sourceR2Key: string },
): Promise<VideoClip[]> {
	const key = String(opts.sourceR2Key ?? '').trim();
	if (!key || !clips.length) return clips;

	const tools = await checkVideoTools();
	if (!tools.ffmpeg) {
		console.warn('[clip-stills] ffmpeg missing — skipping scene stills');
		return clips;
	}

	try {
		const sourceUrl = await r2SignGet(key, 3600);
		return await withTempDir(async (dir) => {
			const res = await fetch(sourceUrl);
			if (!res.ok) throw new Error(`Could not fetch source video (${res.status})`);
			const inputPath = join(dir, 'source.mp4');
			await writeFile(inputPath, new Uint8Array(await res.arrayBuffer()));

			const out: VideoClip[] = [];
			for (let i = 0; i < clips.length; i++) {
				const clip = clips[i]!;
				const atSec = resolveBestFrameSec(clip);
				const framePath = join(dir, `still-${i}.jpg`);
				try {
					await extractFrameWithFfmpeg({
						inputPath,
						outputPath: framePath,
						atSec,
						maxWidth: 1280,
					});
					const bytes = await readFile(framePath);
					const stillKey = `${userId}/clip-stills/${crypto.randomUUID()}.jpg`;
					await r2PutObject(stillKey, new Uint8Array(bytes), 'image/jpeg');
					const thumbnailUrl = await r2SignGet(stillKey, 60 * 60 * 24 * 7);
					out.push({
						...clip,
						bestFrameSec: atSec,
						thumbnailR2Key: stillKey,
						thumbnailUrl,
					});
				} catch (e) {
					console.warn(
						`[clip-stills] frame failed for clip ${clip.id}`,
						e instanceof Error ? e.message : e,
					);
					out.push(clip);
				}
			}
			return out;
		});
	} catch (e) {
		console.warn('[clip-stills] aborted', e instanceof Error ? e.message : e);
		return clips;
	}
}
