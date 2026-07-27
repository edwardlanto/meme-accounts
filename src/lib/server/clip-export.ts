import { readFile, writeFile } from 'node:fs/promises';
import { r2SignGet } from '$lib/server/r2';
import { extractClipWithFfmpeg, withTempDir } from '$lib/server/video-pipeline';
import { reframeWithPyautoflip } from '$lib/server/pyautoflip';
import type {
	ReframeAspectRatio,
	ReframeMethod,
	ReframePadding,
} from '$lib/video-clips/reframe';
import { reframeSettingsKey } from '$lib/video-clips/reframe';

export type ClipReframeParams = {
	aspectRatio: ReframeAspectRatio;
	method: ReframeMethod;
	motionThreshold: number;
	paddingMethod: ReframePadding;
	debug: boolean;
};

export { reframeSettingsKey };

export type BuildClipMp4Params = {
	sourceR2Key: string;
	startSec: number;
	endSec: number;
	speechWindows?: Array<{ startSec: number; endSec: number }>;
	/** When set, run pyautoflip after the time cut. */
	reframe?: ClipReframeParams;
	signal?: AbortSignal;
};

function assertNotAborted(signal?: AbortSignal) {
	if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
}

/** Cut (and optionally reframe) a source video from R2 into MP4 bytes. */
export async function buildClipMp4Bytes(params: BuildClipMp4Params): Promise<Uint8Array> {
	const sourceUrl = await r2SignGet(params.sourceR2Key, 3600);
	assertNotAborted(params.signal);

	return withTempDir(async (dir) => {
		console.info('[clip-export] fetching source from R2…');
		const res = await fetch(sourceUrl, { signal: params.signal });
		if (!res.ok) throw new Error('Could not read source video from storage');
		const buf = new Uint8Array(await res.arrayBuffer());
		assertNotAborted(params.signal);
		const inputPath = `${dir}/source.mp4`;
		const cutPath = `${dir}/clip.mp4`;
		const reframedPath = `${dir}/clip-reframed.mp4`;
		await writeFile(inputPath, buf);

		console.info(
			`[clip-export] cutting ${params.startSec.toFixed(1)}s–${params.endSec.toFixed(1)}s…`,
		);
		await extractClipWithFfmpeg({
			inputPath,
			outputPath: cutPath,
			startSec: params.startSec,
			endSec: params.endSec,
			speechWindows: params.speechWindows,
			signal: params.signal,
		});

		if (params.reframe) {
			assertNotAborted(params.signal);
			console.info('[clip-export] reframing with pyautoflip…');
			await reframeWithPyautoflip({
				inputPath: cutPath,
				outputPath: reframedPath,
				aspectRatio: params.reframe.aspectRatio,
				method: params.reframe.method,
				motionThreshold: params.reframe.motionThreshold,
				paddingMethod: params.reframe.paddingMethod,
				debug: params.reframe.debug,
				signal: params.signal,
			});
			return readFile(reframedPath);
		}

		return readFile(cutPath);
	});
}
