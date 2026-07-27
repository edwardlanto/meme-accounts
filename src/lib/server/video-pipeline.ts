import { spawn } from 'node:child_process';
import { access } from 'node:fs/promises';
import { mkdir, readFile, rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { tmpdir, homedir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { env } from '$env/dynamic/private';
import { timedTranscriptFromSubtitles } from '$lib/video-clips/transcript-segments';

export type ToolCheck = {
	ffmpeg: boolean;
	ytDlp: boolean;
	whisper: boolean;
	pyautoflip: boolean;
	ffmpegPath: string;
	ytDlpPath: string;
	whisperPath: string;
	pyautoflipPath: string;
	/** Path to cookies.txt when YT_DLP_COOKIES is set and readable */
	ytDlpCookiesFile?: string;
	ytDlpCookiesBrowser?: string;
	ytDlpDeno?: boolean;
};

export const YOUTUBE_403_HELP =
	'YouTube blocked the download (HTTP 403). Log into YouTube in Chrome, add YT_DLP_COOKIES_BROWSER=chrome to .env, restart the dev server, and try again. Or export cookies: yt-dlp --cookies-from-browser chrome --cookies ./youtube-cookies.txt then set YT_DLP_COOKIES to that path. Also run: brew upgrade yt-dlp && brew install deno';

function binFromEnv(name: 'FFMPEG_PATH' | 'YT_DLP_PATH', fallback: string): string {
	const v = env[name]?.trim();
	return v || fallback;
}

const FFMPEG_FALLBACKS = ['/opt/homebrew/bin/ffmpeg', '/usr/local/bin/ffmpeg'];
const FFPROBE_FALLBACKS = ['/opt/homebrew/bin/ffprobe', '/usr/local/bin/ffprobe'];
const YTDLP_FALLBACKS = ['/opt/homebrew/bin/yt-dlp', '/usr/local/bin/yt-dlp'];

let cachedFfmpegPath: string | null = null;
let cachedFfprobePath: string | null = null;
let cachedYtDlpPath: string | null = null;

async function resolveExecutable(
	configured: string,
	fallbacks: string[],
): Promise<{ path: string; ok: boolean }> {
	if (await commandExists(configured)) return { path: configured, ok: true };
	for (const fb of fallbacks) {
		if (await commandExists(fb)) return { path: fb, ok: true };
	}
	return { path: configured, ok: false };
}

export function getFfmpegPath(): string {
	return cachedFfmpegPath ?? binFromEnv('FFMPEG_PATH', 'ffmpeg');
}

export function getFfprobePath(): string {
	return cachedFfprobePath ?? (env.FFPROBE_PATH?.trim() || 'ffprobe');
}

export function getYtDlpPath(): string {
	return cachedYtDlpPath ?? binFromEnv('YT_DLP_PATH', 'yt-dlp');
}

export function getWhisperPath(): string {
	return env.WHISPER_PATH?.trim() || 'whisper-cli';
}

async function commandExists(cmd: string): Promise<boolean> {
	const base = cmd.split('/').pop() ?? cmd;
	// ffmpeg 8+ uses -version, not --version
	const versionArgs = /^(ffmpeg|ffprobe)$/i.test(base) ? ['-version'] : ['--version'];
	return new Promise((resolve) => {
		const child = spawn(cmd, versionArgs, { stdio: 'ignore' });
		child.on('error', () => resolve(false));
		child.on('close', (code) => resolve(code === 0));
	});
}

async function pathReadable(p: string): Promise<boolean> {
	try {
		await access(p);
		return true;
	} catch {
		return false;
	}
}

export async function checkVideoTools(): Promise<ToolCheck> {
	const { resolvePyautoflipPath } = await import('$lib/server/pyautoflip');
	const ffmpeg = await resolveExecutable(binFromEnv('FFMPEG_PATH', 'ffmpeg'), FFMPEG_FALLBACKS);
	const ytDlp = await resolveExecutable(binFromEnv('YT_DLP_PATH', 'yt-dlp'), YTDLP_FALLBACKS);
	const ffprobe = await resolveExecutable(getFfprobePath(), FFPROBE_FALLBACKS);
	const whisper = await resolveExecutable(getWhisperPath(), ['/opt/homebrew/bin/whisper-cli']);
	const pyautoflip = await resolvePyautoflipPath();
	cachedFfmpegPath = ffmpeg.path;
	cachedYtDlpPath = ytDlp.path;
	cachedFfprobePath = ffprobe.path;

	const cookiesPath = env.YT_DLP_COOKIES?.trim() ?? '';
	const cookiesBrowser = env.YT_DLP_COOKIES_BROWSER?.trim() ?? '';
	const [ytDlpDeno, cookiesOk] = await Promise.all([
		commandExists('deno'),
		cookiesPath ? pathReadable(cookiesPath) : Promise.resolve(false),
	]);
	return {
		ffmpeg: ffmpeg.ok,
		ytDlp: ytDlp.ok,
		whisper: whisper.ok,
		pyautoflip: pyautoflip.ok,
		ffmpegPath: ffmpeg.path,
		ytDlpPath: ytDlp.path,
		whisperPath: whisper.path,
		pyautoflipPath: pyautoflip.path,
		ytDlpCookiesFile: cookiesOk ? cookiesPath : undefined,
		ytDlpCookiesBrowser: cookiesBrowser || undefined,
		ytDlpDeno,
	};
}

export function isYoutubeDownloadBlockedError(message: string): boolean {
	const m = message.toLowerCase();
	return m.includes('403') || m.includes('forbidden') || m.includes('sign in to confirm');
}

/** Auth + JS runtime flags for YouTube (403 mitigation). */
function ytDlpYoutubeBaseArgs(): string[] {
	const args: string[] = [
		'--no-playlist',
		'--no-warnings',
		'--retries',
		'3', // Reduced from 5 to avoid hammering YouTube
		'--fragment-retries',
		'5', // Reduced from 10
		'--sleep-requests',
		'2', // Increased from 1 to be more polite to YouTube
	];

	const cookies = env.YT_DLP_COOKIES?.trim();
	if (cookies) {
		args.push('--cookies', cookies);
	} else {
		const browser = env.YT_DLP_COOKIES_BROWSER?.trim();
		if (browser) args.push('--cookies-from-browser', browser);
	}

	const jsRuntimes = env.YT_DLP_JS_RUNTIMES?.trim();
	if (jsRuntimes) {
		args.push('--js-runtimes', jsRuntimes);
	} else {
		args.push('--js-runtimes', 'deno');
	}

	return args;
}

function youtubeExtractorArgs(strategyPart?: string): string[] {
	const parts: string[] = [];
	const custom = env.YT_DLP_EXTRACTOR_ARGS?.trim();
	if (custom) parts.push(custom);
	if (strategyPart) parts.push(strategyPart);
	const poToken = env.YT_DLP_PO_TOKEN?.trim();
	let joined = parts.join(';');
	if (poToken && !joined.includes('po_token')) {
		joined = joined ? `${joined};po_token=${poToken}` : `po_token=${poToken}`;
	}
	return joined ? ['--extractor-args', `youtube:${joined}`] : [];
}

type YtStrategy = { label: string; extractor?: string; format: string };

const YOUTUBE_DOWNLOAD_STRATEGIES: YtStrategy[] = [
	{
		label: '720p',
		format: 'b[height<=720]/best[height<=720]/b[height<=1080]/best',
	},
	{
		label: 'default',
		format: 'b[height<=1080]/best[height<=1080]/best',
	},
	{
		label: 'no-android-sdkless',
		extractor: 'player_client=default,-android_sdkless',
		format: 'b[height<=1080]/best[height<=1080]/best',
	},
	{
		label: 'player-js-actual',
		extractor: 'player_js_version=actual',
		format: 'b[height<=1080]/best[height<=1080]/best',
	},
	{
		label: 'web-embedded',
		extractor: 'player_client=web_embedded',
		format: 'b[height<=1080]/best[height<=1080]/best',
	},
	{
		label: 'm3u8',
		extractor: 'player_client=default,-android_sdkless',
		format: 'b[protocol*=m3u8][height<=1080]+ba[protocol*=m3u8]/b[protocol*=m3u8]/best',
	},
];

function runProcess(
	cmd: string,
	args: string[],
	opts?: { cwd?: string; timeoutMs?: number; signal?: AbortSignal },
): Promise<{ stdout: string; stderr: string }> {
	return new Promise((resolve, reject) => {
		if (opts?.signal?.aborted) {
			reject(new DOMException('Aborted', 'AbortError'));
			return;
		}

		const child = spawn(cmd, args, { cwd: opts?.cwd, stdio: ['ignore', 'pipe', 'pipe'] });
		let stdout = '';
		let stderr = '';
		let settled = false;

		const settle = (fn: () => void) => {
			if (settled) return;
			settled = true;
			if (timer) clearTimeout(timer);
			opts?.signal?.removeEventListener('abort', onAbort);
			fn();
		};

		const onAbort = () => {
			try {
				child.kill('SIGKILL');
			} catch {
				/* ignore */
			}
			settle(() => reject(new DOMException('Aborted', 'AbortError')));
		};

		const timer =
			opts?.timeoutMs != null
				? setTimeout(() => {
						try {
							child.kill('SIGKILL');
						} catch {
							/* ignore */
						}
						settle(() => reject(new Error(`${cmd} timed out after ${opts.timeoutMs}ms`)));
					}, opts.timeoutMs)
				: null;

		opts?.signal?.addEventListener('abort', onAbort, { once: true });

		child.stdout?.on('data', (d) => (stdout += String(d)));
		child.stderr?.on('data', (d) => (stderr += String(d)));
		child.on('error', (e) => {
			settle(() => reject(e));
		});
		child.on('close', (code) => {
			if (opts?.signal?.aborted) {
				settle(() => reject(new DOMException('Aborted', 'AbortError')));
				return;
			}
			if (code === 0) settle(() => resolve({ stdout, stderr }));
			else
				settle(() =>
					reject(new Error(`${cmd} exited ${code}: ${stderr.slice(-2000) || stdout.slice(-500)}`)),
				);
		});
	});
}

export async function probeDurationSec(filePath: string): Promise<number> {
	const ffprobe = getFfprobePath();
	const { stdout } = await runProcess(ffprobe, [
		'-v',
		'error',
		'-show_entries',
		'format=duration',
		'-of',
		'default=noprint_wrappers=1:nokey=1',
		filePath,
	]);
	const n = Number(stdout.trim());
	return Number.isFinite(n) && n > 0 ? n : 0;
}

/** yt-dlp metadata when ffprobe cannot read the file. */
export async function ytDlpPrintDuration(videoUrl: string): Promise<number> {
	const tools = await checkVideoTools();
	if (!tools.ytDlp) return 0;
	try {
		const { stdout } = await runProcess(
			tools.ytDlpPath,
			[...ytDlpYoutubeBaseArgs(), '--print', 'duration', videoUrl],
			{ timeoutMs: 60_000 },
		);
		const n = Number(stdout.trim().split('\n')[0]);
		return Number.isFinite(n) && n > 0 ? n : 0;
	} catch {
		return 0;
	}
}

export type YoutubeDownloadResult = {
	dir: string;
	videoPath: string;
	title: string;
	durationSec: number;
	transcript: string;
	thumbnailUrl: string;
	description?: string;
	channel?: string;
};

async function runYtDlpDownload(
	ytDlpPath: string,
	videoUrl: string,
	workDir: string,
	strategy: YtStrategy,
	skipSubs: boolean = false,
): Promise<void> {
	const outTemplate = join(workDir, 'video.%(ext)s');

	const args = [
		...ytDlpYoutubeBaseArgs(),
		...youtubeExtractorArgs(strategy.extractor),
		'-f',
		strategy.format,
		'--merge-output-format',
		'mp4',
		'-o',
		outTemplate,
		videoUrl,
	];

	// Check if user wants to skip subtitles via env var (YT_DLP_SKIP_SUBS=1)
	const envSkipSubs = env.YT_DLP_SKIP_SUBS?.trim() === '1' || env.YT_DLP_SKIP_SUBS?.toLowerCase() === 'true';
	
	// Only download subtitles if not skipped (more conservative to avoid rate limits)
	if (!skipSubs && !envSkipSubs) {
		args.push(
			'--write-auto-sub',
			'--write-sub',
			'--sub-langs',
			'en', // Only request plain 'en', not 'en.*' to avoid rate limits
			'--convert-subs',
			'vtt',
		);
	}

	await runProcess(
		ytDlpPath,
		args,
		{ cwd: workDir, timeoutMs: 300_000 },
	);
}

/** Download YouTube video + auto-captions into a temp directory (caller must rm dir). */
export async function downloadYoutubeToDir(videoUrl: string, workDir: string): Promise<YoutubeDownloadResult> {
	const tools = await checkVideoTools();
	if (!tools.ytDlp) {
		throw new Error(
			'yt-dlp is not installed. Install with: brew install yt-dlp (or set YT_DLP_PATH in .env)',
		);
	}

	await mkdir(workDir, { recursive: true });

	const errors: string[] = [];
	let lastError429 = false;
	
	for (const strategy of YOUTUBE_DOWNLOAD_STRATEGIES) {
		try {
			console.info(`[video-pipeline] yt-dlp download (${strategy.label})…`);
			// Try with subtitles first
			await runYtDlpDownload(tools.ytDlpPath, videoUrl, workDir, strategy, false);
			console.info(`[video-pipeline] yt-dlp download ok (${strategy.label})`);
			errors.length = 0;
			break;
		} catch (e: unknown) {
			const msg = e instanceof Error ? e.message : String(e);
			const is429 = msg.includes('429') || msg.toLowerCase().includes('too many requests');
			
			// If it's a 429 rate limit on subtitles, retry without subtitles
			if (is429 && msg.toLowerCase().includes('subtitle')) {
				console.warn(`[video-pipeline] Subtitle rate limit hit, retrying without subs (${strategy.label})…`);
				try {
					await runYtDlpDownload(tools.ytDlpPath, videoUrl, workDir, strategy, true);
					console.info(`[video-pipeline] yt-dlp download ok without subs (${strategy.label})`);
					errors.length = 0;
					lastError429 = true;
					break;
				} catch (e2: unknown) {
					const msg2 = e2 instanceof Error ? e2.message : String(e2);
					errors.push(`[${strategy.label}] ${msg2.slice(-400)}`);
				}
			} else {
				errors.push(`[${strategy.label}] ${msg.slice(-400)}`);
			}
			
			const { readdir } = await import('node:fs/promises');
			for (const f of await readdir(workDir).catch(() => [])) {
				await rm(join(workDir, f), { force: true }).catch(() => {});
			}
		}
	}

	if (errors.length > 0) {
		const last = errors[errors.length - 1] ?? '';
		if (isYoutubeDownloadBlockedError(last)) {
			throw new Error(`${YOUTUBE_403_HELP}\n\n${last}`);
		}
		throw new Error(`yt-dlp failed after ${errors.length} attempts:\n${errors.join('\n')}`);
	}

	const { readdir } = await import('node:fs/promises');
	const files = await readdir(workDir);
	const videoFile = files.find((f) => /\.(mp4|webm|mkv)$/i.test(f));
	if (!videoFile) throw new Error('yt-dlp did not produce a video file');

	const videoPath = join(workDir, videoFile);
	let durationSec = await probeDurationSec(videoPath);
	if (!durationSec) durationSec = await ytDlpPrintDuration(videoUrl);

	let transcript = '';
	const subFile = files.find((f) => /\.vtt$/i.test(f) || /\.srt$/i.test(f));
	if (subFile) {
		const raw = await readFile(join(workDir, subFile), 'utf8');
		transcript = timedTranscriptFromSubtitles(raw);
	} else if (lastError429) {
		// Subtitle download was skipped due to rate limiting
		console.warn('[video-pipeline] Subtitles unavailable due to YouTube rate limit (HTTP 429)');
	}

	// Prefer Whisper word-level timestamps when available.
	// YouTube auto-captions are phrase-level — karaoke highlights will always drift
	// if we guess per-word timing inside those phrases.
	if (tools.whisper) {
		try {
			console.info('[video-pipeline] Transcribing with Whisper (word-level timestamps)...');
			const audioPath = join(workDir, 'audio.wav');
			await extractAudioForWhisper(videoPath, audioPath);
			const srtContent = await transcribeWithWhisper(audioPath, workDir);
			if (srtContent.trim()) {
				transcript = timedTranscriptFromSubtitles(srtContent);
			}
		} catch (e) {
			console.error('[video-pipeline] Whisper transcription failed:', e);
			if (!transcript.trim()) {
				console.warn('[video-pipeline] Falling back to YouTube/subtitle transcript');
			}
		}
	}

	let title = 'YouTube video';
	let description = '';
	let channel = '';
	try {
		const { stdout } = await runProcess(
			tools.ytDlpPath,
			[...ytDlpYoutubeBaseArgs(), '--print', 'title', videoUrl],
			{ timeoutMs: 60_000 },
		);
		const t = stdout.trim().split('\n')[0]?.trim();
		if (t) title = t;
	} catch {
		/* ignore */
	}
	try {
		const { stdout } = await runProcess(
			tools.ytDlpPath,
			[...ytDlpYoutubeBaseArgs(), '--print', 'description', videoUrl],
			{ timeoutMs: 60_000 },
		);
		description = stdout.trim().slice(0, 4000);
	} catch {
		/* ignore */
	}
	try {
		const { stdout } = await runProcess(
			tools.ytDlpPath,
			[...ytDlpYoutubeBaseArgs(), '--print', 'channel', videoUrl],
			{ timeoutMs: 60_000 },
		);
		channel = stdout.trim().split('\n')[0]?.trim().slice(0, 200) ?? '';
	} catch {
		/* ignore */
	}

	const idMatch = videoUrl.match(/(?:v=|youtu\.be\/|shorts\/)([\w-]{6,})/);
	const videoId = idMatch?.[1] ?? '';

	return {
		dir: workDir,
		videoPath,
		title,
		durationSec: durationSec || 1,
		transcript,
		thumbnailUrl: videoId ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : '',
		description: description || undefined,
		channel: channel || undefined,
	};
}

/** Extract audio from video as WAV for Whisper transcription. */
export async function extractAudioForWhisper(videoPath: string, outputPath: string): Promise<void> {
	const tools = await checkVideoTools();
	if (!tools.ffmpeg) throw new Error('ffmpeg is not available');
	
	await runProcess(
		tools.ffmpegPath,
		[
			'-nostdin',
			'-y',
			'-i',
			videoPath,
			'-vn', // No video
			'-acodec',
			'pcm_s16le', // 16-bit PCM
			'-ar',
			'16000', // 16kHz sample rate
			'-ac',
			'1', // Mono
			outputPath,
		],
		{ timeoutMs: 180_000 },
	);
}

/** Transcribe audio using whisper-cli and return SRT content. */
export async function transcribeWithWhisper(audioPath: string, workDir: string): Promise<string> {
	const tools = await checkVideoTools();
	if (!tools.whisper) {
		console.warn('[video-pipeline] whisper-cli not available, skipping transcription');
		return '';
	}

	const modelName = env.WHISPER_MODEL?.trim() || 'base.en';
	const modelsDir = env.WHISPER_MODELS_DIR?.trim() || join(homedir(), '.cache', 'whisper-cpp');
	const modelPath = join(modelsDir, `ggml-${modelName}.bin`);

	// Check if model exists
	try {
		await access(modelPath);
	} catch {
		console.error(`[video-pipeline] Whisper model not found: ${modelPath}`);
		console.error('[video-pipeline] Run: npm run whisper:download');
		return '';
	}
	
	try {
		console.info('[video-pipeline] transcribing with whisper-cli...');
		const outBase = join(workDir, 'whisper-out');
		await runProcess(
			tools.whisperPath,
			[
				'-m', modelPath,
				'-f', audioPath,
				'-osrt',
				'-of', outBase,
				'-l', 'en',
				// Short phrases (~3–5 words) — much faster than -ml 1, still tight for CapCut chunking
				'-ml', '18',
				'--split-on-word',
				'--suppress-nst',
			],
			{ cwd: workDir, timeoutMs: 600_000 },
		);

		const srtPath = `${outBase}.srt`;
		const srtContent = await readFile(srtPath, 'utf8');
		console.info('[video-pipeline] transcription complete (word-level SRT)');
		return srtContent;
	} catch (e) {
		console.error('[video-pipeline] whisper transcription failed:', e);
		return '';
	}
}

/** Re-encode to 720p H.264 MP4 for smaller R2 storage. */
export async function compressVideoForStorage(inputPath: string, outputPath: string): Promise<void> {
	const tools = await checkVideoTools();
	if (!tools.ffmpeg) {
		throw new Error('ffmpeg is not available');
	}
	const maxH = Number(env.VIDEO_MAX_HEIGHT) || 720;
	const crf = Number(env.VIDEO_CRF) || 28;
	await mkdir(dirname(outputPath), { recursive: true });
	await runProcess(
		tools.ffmpegPath,
		[
			'-nostdin',
			'-y',
			'-i',
			inputPath,
			'-vf',
			`scale=-2:${maxH}`,
			'-c:v',
			'libx264',
			'-preset',
			'veryfast',
			'-crf',
			String(crf),
			'-c:a',
			'aac',
			'-b:a',
			'96k',
			'-movflags',
			'+faststart',
			outputPath,
		],
		{ timeoutMs: 300_000 },
	);
}

const COMPRESS_SKIP_BYTES = 80 * 1024 * 1024;

/** Compress for R2 when worthwhile; never blocks upload on compress failure. */
export async function bytesForR2Storage(sourcePath: string, workDir: string): Promise<Uint8Array> {
	const { stat } = await import('node:fs/promises');
	const rawSize = (await stat(sourcePath)).size;
	const skipCompress =
		env.VIDEO_COMPRESS?.trim() === '0' || rawSize <= COMPRESS_SKIP_BYTES;

	if (skipCompress) {
		console.info(`[video-pipeline] skipping compress (${(rawSize / 1e6).toFixed(1)}MB)`);
		return readFile(sourcePath);
	}

	const tools = await checkVideoTools();
	if (!tools.ffmpeg) {
		console.warn('[video-pipeline] ffmpeg not found — uploading as-is');
		return readFile(sourcePath);
	}

	const out = join(workDir, 'compressed.mp4');
	try {
		console.info(`[video-pipeline] compressing ${(rawSize / 1e6).toFixed(1)}MB…`);
		await compressVideoForStorage(sourcePath, out);
		const compressed = await readFile(out);
		console.info(
			`[video-pipeline] compressed ${(rawSize / 1e6).toFixed(1)}MB → ${(compressed.byteLength / 1e6).toFixed(1)}MB`,
		);
		return compressed;
	} catch (e) {
		const msg = e instanceof Error ? e.message : String(e);
		console.warn(`[video-pipeline] compress failed, uploading original: ${msg.slice(0, 200)}`);
		return readFile(sourcePath);
	}
}

export async function extractClipWithFfmpeg(params: {
	inputPath: string;
	outputPath: string;
	startSec: number;
	endSec: number;
	/** Optional keep-windows (relative to source timeline) — concatenates speech, drops silence */
	speechWindows?: Array<{ startSec: number; endSec: number }>;
	signal?: AbortSignal;
}): Promise<void> {
	const tools = await checkVideoTools();
	if (!tools.ffmpeg) {
		throw new Error('ffmpeg is not installed. Install with: brew install ffmpeg (or set FFMPEG_PATH)');
	}
	await mkdir(dirname(params.outputPath), { recursive: true });

	const windows = (params.speechWindows ?? []).filter((w) => w.endSec > w.startSec + 0.05);
	if (windows.length >= 2) {
		// Cut each window then concat (silence removal)
		const parts: string[] = [];
		for (let i = 0; i < windows.length; i++) {
			if (params.signal?.aborted) throw new DOMException('Aborted', 'AbortError');
			const w = windows[i]!;
			const part = join(dirname(params.outputPath), `part-${i}.mp4`);
			const dur = Math.max(0.05, w.endSec - w.startSec);
			await runProcess(
				tools.ffmpegPath,
				[
					'-nostdin',
					'-y',
					'-ss',
					String(w.startSec),
					'-i',
					params.inputPath,
					'-t',
					String(dur),
					'-c:v',
					'libx264',
					'-preset',
					'fast',
					'-crf',
					'23',
					'-c:a',
					'aac',
					'-b:a',
					'128k',
					'-movflags',
					'+faststart',
					part,
				],
				{ timeoutMs: 600_000, signal: params.signal },
			);
			parts.push(part);
		}
		const listPath = join(dirname(params.outputPath), 'concat.txt');
		const { writeFile } = await import('node:fs/promises');
		await writeFile(
			listPath,
			parts.map((p) => `file '${p.replace(/'/g, "'\\''")}'`).join('\n'),
		);
		await runProcess(
			tools.ffmpegPath,
			[
				'-nostdin',
				'-y',
				'-f',
				'concat',
				'-safe',
				'0',
				'-i',
				listPath,
				'-c',
				'copy',
				params.outputPath,
			],
			{ timeoutMs: 600_000, signal: params.signal },
		);
		return;
	}

	const duration = Math.max(0.5, params.endSec - params.startSec);
	await runProcess(
		tools.ffmpegPath,
		[
			'-nostdin',
			'-y',
			'-ss',
			String(params.startSec),
			'-i',
			params.inputPath,
			'-t',
			String(duration),
			'-c:v',
			'libx264',
			'-preset',
			'fast',
			'-crf',
			'23',
			'-c:a',
			'aac',
			'-b:a',
			'128k',
			'-movflags',
			'+faststart',
			params.outputPath,
		],
		{ timeoutMs: 600_000, signal: params.signal },
	);
}

export async function withTempDir<T>(fn: (dir: string) => Promise<T>): Promise<T> {
	const dir = join(tmpdir(), `vsp-video-${randomUUID()}`);
	await mkdir(dir, { recursive: true });
	try {
		return await fn(dir);
	} finally {
		await rm(dir, { recursive: true, force: true }).catch(() => {});
	}
}

export function bytesToBase64(buf: Uint8Array): string {
	return Buffer.from(buf).toString('base64');
}
