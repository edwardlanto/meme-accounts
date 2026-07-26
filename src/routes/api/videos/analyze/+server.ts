import { json } from '@sveltejs/kit';
import { z } from 'zod';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { RequestHandler } from './$types';
import { parseJsonBody, isValidOwnerR2Key } from '$lib/server/request-security';
import { importYoutubeVideo, parseYoutubeVideoId } from '$lib/server/youtube-import';
import { analyzeVideoForClips } from '$lib/server/vertex-gemini-clips';
import { r2PutObject, r2SignGet } from '$lib/server/r2';
import {
	downloadYoutubeToDir,
	withTempDir,
	checkVideoTools,
	isYoutubeDownloadBlockedError,
	YOUTUBE_403_HELP,
	probeDurationSec,
	ytDlpPrintDuration,
	bytesForR2Storage,
} from '$lib/server/video-pipeline';
import { normalizeVideoClips } from '$lib/video-clips/normalize-clips';
import { enrichClipTitles } from '$lib/video-clips/clip-titles';
import {
	snapRangeToTranscriptCues,
	transcriptCueStartsSec,
} from '$lib/video-clips/transcript-segments';

const analyzeSchema = z.object({
	source: z.enum(['youtube', 'upload']),
	youtubeUrl: z.string().max(2000).optional(),
	r2Key: z.string().max(600).optional(),
	title: z.string().max(500).optional(),
	durationSec: z.number().min(1).max(86_400).optional(),
	topicHint: z.string().max(600).optional(),
	clipCount: z.number().int().min(1).max(40).optional(),
	clipMinSec: z.number().min(10).max(300).optional(),
	clipMaxSec: z.number().min(10).max(300).optional(),
	segmentAll: z.boolean().optional(),
});

function clipAnalyzeOpts(data: z.infer<typeof analyzeSchema>) {
	const clipMinSec = data.clipMinSec ?? 10;
	const clipMaxSec = Math.max(clipMinSec, data.clipMaxSec ?? 90);
	return {
		clipCount: data.clipCount,
		clipMinSec,
		clipMaxSec,
		segmentAll: !!data.segmentAll,
	};
}

const MAX_MULTIMODAL_BYTES = 18 * 1024 * 1024;

export const POST: RequestHandler = async ({ request, locals }) => {
	const { user } = await locals.safeGetSession();
	if (!user) return json({ error: 'Unauthorized' }, { status: 401 });

	const parsed = await parseJsonBody(request, analyzeSchema, 32_768);
	if (!parsed.ok) return json({ error: parsed.error }, { status: parsed.status });

	const { source, youtubeUrl, r2Key, title, durationSec, topicHint } = parsed.data;
	const clipOpts = clipAnalyzeOpts(parsed.data);

	try {
		if (source === 'youtube') {
			const url = String(youtubeUrl ?? '').trim();
			const videoId = parseYoutubeVideoId(url);
			if (!videoId) return json({ error: 'Invalid YouTube URL' }, { status: 400 });

			const tools = await checkVideoTools();
			let ytTitle = 'YouTube video';
			let ytDuration = 0;
			let ytTranscript = '';
			let ytDescription = '';
			let ytChannel = '';
			let ytThumb = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
			let storageKey = '';
			let playbackUrl = '';

			if (tools.ytDlp) {
				let downloadWarning = '';
				let videoBytes: Uint8Array | undefined;

				try {
					const result = await withTempDir(async (dir) => {
						console.info('[api/videos/analyze] downloading…');
						const dl = await downloadYoutubeToDir(url, dir);
						console.info('[api/videos/analyze] compressing / uploading…');
						const bytes = await bytesForR2Storage(dl.videoPath, dir);
						const key = `${user.id}/videos/yt-${videoId}-${crypto.randomUUID()}.mp4`;
						await r2PutObject(key, bytes, 'video/mp4');
						const signed = await r2SignGet(key, 7200);
						console.info('[api/videos/analyze] stored on R2');
						return { dl, key, signed, bytes };
					});
					ytTitle = result.dl.title;
					ytDuration = result.dl.durationSec;
					ytTranscript = result.dl.transcript;
					ytDescription = result.dl.description ?? '';
					ytChannel = result.dl.channel ?? '';
					ytThumb = result.dl.thumbnailUrl || ytThumb;
					storageKey = result.key;
					playbackUrl = result.signed;
					videoBytes =
						result.bytes.byteLength <= MAX_MULTIMODAL_BYTES ? result.bytes : undefined;
				} catch (dlErr: unknown) {
					const msg = dlErr instanceof Error ? dlErr.message : String(dlErr);
					if (!isYoutubeDownloadBlockedError(msg)) throw dlErr;

					downloadWarning = YOUTUBE_403_HELP;
					const yt = await importYoutubeVideo(url);
					ytTitle = yt.title;
					ytDuration = yt.durationSec;
					ytTranscript = yt.transcript;
					ytDescription = yt.description ?? '';
					ytChannel = yt.channel ?? '';
					ytThumb = yt.thumbnailUrl;
					playbackUrl = yt.playbackUrl;
				}

				if (!ytTranscript.trim()) {
					try {
						const fallback = await importYoutubeVideo(url);
						ytTranscript = fallback.transcript;
						if (!ytTitle || ytTitle === 'YouTube video') ytTitle = fallback.title;
						if (!ytDuration || ytDuration <= 1) ytDuration = fallback.durationSec;
						if (!ytDescription.trim()) ytDescription = fallback.description ?? '';
						if (!ytChannel.trim()) ytChannel = fallback.channel ?? '';
					} catch {
						ytTranscript = '[No captions — analysis uses video content only.]';
					}
				}

				if (!ytDuration || ytDuration <= 1) {
					ytDuration = (await ytDlpPrintDuration(url)) || ytDuration || 1;
				}

				console.info('[api/videos/analyze] running clip AI…');
				const analyzed = await analyzeVideoForClips({
					title: ytTitle,
					description: ytDescription,
					channel: ytChannel,
					durationSec: ytDuration,
					transcript: ytTranscript,
					topicHint,
					...clipOpts,
					videoBytes,
					videoMime: videoBytes ? 'video/mp4' : undefined,
				});

				const cueStarts = transcriptCueStartsSec(ytTranscript);
				const normalized = normalizeVideoClips(
					analyzed.clips,
					ytDuration,
					clipOpts.clipMinSec,
					clipOpts.clipMaxSec,
				);
				const snapped = cueStarts.length
					? normalized.map((c) => ({
							...c,
							...snapRangeToTranscriptCues({
								startSec: c.startSec,
								endSec: c.endSec,
								durationSec: ytDuration,
								minLenSec: clipOpts.clipMinSec,
								maxLenSec: clipOpts.clipMaxSec,
								cueStartsSec: cueStarts,
								startPadSec: 0.15,
								endPadSec: 0.35,
							}),
						}))
					: normalized;

				const clips = enrichClipTitles(snapped, ytTranscript, ytTitle);

				return json({
					source: {
						kind: 'youtube',
						title: ytTitle,
						durationSec: ytDuration,
						playbackUrl,
						r2Key: storageKey || undefined,
						youtubeId: videoId,
						thumbnailUrl: ytThumb,
						transcript: ytTranscript,
						description: ytDescription || undefined,
						channel: ytChannel || undefined,
					},
					clips,
					summary: analyzed.summary,
					demo: analyzed.demo,
					model: analyzed.model,
					...(downloadWarning ? { warning: downloadWarning } : {}),
				});
			}

			// Fallback without yt-dlp: captions-only analysis (no full download)
			const yt = await importYoutubeVideo(url);
			const analyzed = await analyzeVideoForClips({
				title: yt.title,
				description: yt.description,
				channel: yt.channel,
				durationSec: yt.durationSec,
				transcript: yt.transcript,
				topicHint,
				...clipOpts,
			});
			const cueStarts = transcriptCueStartsSec(yt.transcript);
			const normalized = normalizeVideoClips(
				analyzed.clips,
				yt.durationSec,
				clipOpts.clipMinSec,
				clipOpts.clipMaxSec,
			);
			const snapped = cueStarts.length
				? normalized.map((c) => ({
						...c,
						...snapRangeToTranscriptCues({
							startSec: c.startSec,
							endSec: c.endSec,
							durationSec: yt.durationSec,
							minLenSec: clipOpts.clipMinSec,
							maxLenSec: clipOpts.clipMaxSec,
							cueStartsSec: cueStarts,
							startPadSec: 0.15,
							endPadSec: 0.35,
						}),
					}))
				: normalized;

			const clips = enrichClipTitles(snapped, yt.transcript, yt.title);
			return json({
				source: {
					kind: 'youtube',
					title: yt.title,
					durationSec: yt.durationSec,
					playbackUrl: yt.playbackUrl,
					youtubeId: yt.videoId,
					thumbnailUrl: yt.thumbnailUrl,
					transcript: yt.transcript,
					description: yt.description || undefined,
					channel: yt.channel || undefined,
				},
				clips,
				summary: analyzed.summary,
				demo: analyzed.demo,
				model: analyzed.model,
				warning:
					'Install yt-dlp for full video download and MP4 export (brew install yt-dlp).',
			});
		}

		const key = String(r2Key ?? '').trim();
		if (!key || !isValidOwnerR2Key(user.id, key)) {
			return json({ error: 'Invalid upload key' }, { status: 400 });
		}

		const playbackUrl = await r2SignGet(key, 7200);
		let videoBytes: Uint8Array | undefined;
		try {
			const res = await fetch(playbackUrl);
			if (res.ok) {
				const buf = new Uint8Array(await res.arrayBuffer());
				if (buf.byteLength <= MAX_MULTIMODAL_BYTES) videoBytes = buf;
			}
		} catch {
			/* transcript-only fallback */
		}

		let effectiveDuration = durationSec ?? 0;
		if (videoBytes) {
			await withTempDir(async (dir) => {
				const p = join(dir, 'upload.mp4');
				await writeFile(p, videoBytes);
				const probed = await probeDurationSec(p);
				if (probed > 0) effectiveDuration = probed;
			});
		}
		if (!effectiveDuration || effectiveDuration <= 1) effectiveDuration = durationSec ?? 1;

		const uploadTitle = title?.trim() || 'Uploaded video';
		const uploadTranscript =
			videoBytes != null
				? '[Multimodal analysis from uploaded video.]'
				: '[Uploaded video — analyze from stored file metadata.]';

		const analyzed = await analyzeVideoForClips({
			title: uploadTitle,
			durationSec: effectiveDuration,
			transcript: uploadTranscript,
			topicHint,
			...clipOpts,
			videoBytes,
			videoMime: videoBytes ? 'video/mp4' : undefined,
		});

		const clips = enrichClipTitles(
			normalizeVideoClips(
				analyzed.clips,
				effectiveDuration,
				clipOpts.clipMinSec,
				clipOpts.clipMaxSec,
			),
			uploadTranscript,
			uploadTitle,
		);

		return json({
			source: {
				kind: 'upload',
				title: title?.trim() || 'Uploaded video',
				durationSec: effectiveDuration,
				playbackUrl,
				r2Key: key,
				transcript: uploadTranscript,
			},
			clips,
			summary: analyzed.summary,
			demo: analyzed.demo,
			model: analyzed.model,
		});
	} catch (e: unknown) {
		const message = e instanceof Error ? e.message : String(e);
		console.error('[api/videos/analyze]', message);
		return json({ error: message }, { status: 500 });
	}
};
