import { json } from '@sveltejs/kit';
import { z } from 'zod';
import { readFile } from 'node:fs/promises';
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
} from '$lib/server/video-pipeline';

const analyzeSchema = z.object({
	source: z.enum(['youtube', 'upload']),
	youtubeUrl: z.string().max(2000).optional(),
	r2Key: z.string().max(600).optional(),
	title: z.string().max(500).optional(),
	durationSec: z.number().min(1).max(86_400).optional(),
	topicHint: z.string().max(600).optional(),
	clipCount: z.number().int().min(1).max(40).optional(),
	clipMinSec: z.number().min(10).max(180).optional(),
	clipMaxSec: z.number().min(10).max(180).optional(),
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
			let ytDuration = 600;
			let ytTranscript = '';
			let ytThumb = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
			let storageKey = '';
			let playbackUrl = '';

			if (tools.ytDlp) {
				let downloadWarning = '';
				let videoBytes: Uint8Array | undefined;

				try {
					const result = await withTempDir(async (dir) => {
						const dl = await downloadYoutubeToDir(url, dir);
						const bytes = await readFile(dl.videoPath);
						const key = `${user.id}/videos/yt-${videoId}-${crypto.randomUUID()}.mp4`;
						await r2PutObject(key, bytes, 'video/mp4');
						const signed = await r2SignGet(key, 7200);
						return { dl, key, signed, bytes };
					});
					ytTitle = result.dl.title;
					ytDuration = result.dl.durationSec;
					ytTranscript = result.dl.transcript;
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
					ytThumb = yt.thumbnailUrl;
					playbackUrl = yt.playbackUrl;
				}

				if (!ytTranscript.trim()) {
					try {
						const fallback = await importYoutubeVideo(url);
						ytTranscript = fallback.transcript;
						if (!ytTitle || ytTitle === 'YouTube video') ytTitle = fallback.title;
						if (!ytDuration) ytDuration = fallback.durationSec;
					} catch {
						ytTranscript = '[No captions — analysis uses video content only.]';
					}
				}

				const analyzed = await analyzeVideoForClips({
					title: ytTitle,
					durationSec: ytDuration,
					transcript: ytTranscript,
					topicHint,
					...clipOpts,
					videoBytes,
					videoMime: videoBytes ? 'video/mp4' : undefined,
				});

				return json({
					source: {
						kind: 'youtube',
						title: ytTitle,
						durationSec: ytDuration,
						playbackUrl,
						r2Key: storageKey || undefined,
						youtubeId: videoId,
						thumbnailUrl: ytThumb,
					},
					clips: analyzed.clips,
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
				durationSec: yt.durationSec,
				transcript: yt.transcript,
				topicHint,
				...clipOpts,
			});
			return json({
				source: {
					kind: 'youtube',
					title: yt.title,
					durationSec: yt.durationSec,
					playbackUrl: yt.playbackUrl,
					youtubeId: yt.videoId,
					thumbnailUrl: yt.thumbnailUrl,
				},
				clips: analyzed.clips,
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

		const analyzed = await analyzeVideoForClips({
			title: title?.trim() || 'Uploaded video',
			durationSec: durationSec ?? 600,
			transcript:
				videoBytes != null
					? '[Multimodal analysis from uploaded video.]'
					: '[Uploaded video — analyze from stored file metadata.]',
			topicHint,
			...clipOpts,
			videoBytes,
			videoMime: videoBytes ? 'video/mp4' : undefined,
		});

		return json({
			source: {
				kind: 'upload',
				title: title?.trim() || 'Uploaded video',
				durationSec: durationSec ?? 600,
				playbackUrl,
				r2Key: key,
			},
			clips: analyzed.clips,
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
