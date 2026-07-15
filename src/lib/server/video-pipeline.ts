import { spawn } from 'node:child_process';
import { access } from 'node:fs/promises';
import { mkdir, readFile, rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { env } from '$env/dynamic/private';
import { timedTranscriptFromSubtitles } from '$lib/video-clips/transcript-segments';

export type ToolCheck = {
	ffmpeg: boolean;
	ytDlp: boolean;
	ffmpegPath: string;
	ytDlpPath: string;
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
	const ffmpeg = await resolveExecutable(binFromEnv('FFMPEG_PATH', 'ffmpeg'), FFMPEG_FALLBACKS);
	const ytDlp = await resolveExecutable(binFromEnv('YT_DLP_PATH', 'yt-dlp'), YTDLP_FALLBACKS);
	const ffprobe = await resolveExecutable(getFfprobePath(), FFPROBE_FALLBACKS);
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
		ffmpegPath: ffmpeg.path,
		ytDlpPath: ytDlp.path,
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
		'5',
		'--fragment-retries',
		'10',
		'--sleep-requests',
		'1',
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
	opts?: { cwd?: string; timeoutMs?: number },
): Promise<{ stdout: string; stderr: string }> {
	return new Promise((resolve, reject) => {
		const child = spawn(cmd, args, { cwd: opts?.cwd, stdio: ['ignore', 'pipe', 'pipe'] });
		let stdout = '';
		let stderr = '';
		const timer =
			opts?.timeoutMs != null
				? setTimeout(() => {
						child.kill('SIGKILL');
						reject(new Error(`${cmd} timed out after ${opts.timeoutMs}ms`));
					}, opts.timeoutMs)
				: null;

		child.stdout?.on('data', (d) => (stdout += String(d)));
		child.stderr?.on('data', (d) => (stderr += String(d)));
		child.on('error', (e) => {
			if (timer) clearTimeout(timer);
			reject(e);
		});
		child.on('close', (code) => {
			if (timer) clearTimeout(timer);
			if (code === 0) resolve({ stdout, stderr });
			else reject(new Error(`${cmd} exited ${code}: ${stderr.slice(-2000) || stdout.slice(-500)}`));
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
};

async function runYtDlpDownload(
	ytDlpPath: string,
	videoUrl: string,
	workDir: string,
	strategy: YtStrategy,
): Promise<void> {
	const outTemplate = join(workDir, 'video.%(ext)s');

	await runProcess(
		ytDlpPath,
		[
			...ytDlpYoutubeBaseArgs(),
			...youtubeExtractorArgs(strategy.extractor),
			'--write-auto-sub',
			'--write-sub',
			'--sub-langs',
			'en.*,en',
			'--convert-subs',
			'vtt',
			'-f',
			strategy.format,
			'--merge-output-format',
			'mp4',
			'-o',
			outTemplate,
			videoUrl,
		],
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
	for (const strategy of YOUTUBE_DOWNLOAD_STRATEGIES) {
		try {
			console.info(`[video-pipeline] yt-dlp download (${strategy.label})…`);
			await runYtDlpDownload(tools.ytDlpPath, videoUrl, workDir, strategy);
			console.info(`[video-pipeline] yt-dlp download ok (${strategy.label})`);
			errors.length = 0;
			break;
		} catch (e: unknown) {
			const msg = e instanceof Error ? e.message : String(e);
			errors.push(`[${strategy.label}] ${msg.slice(-400)}`);
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
	}

	let title = 'YouTube video';
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

	const idMatch = videoUrl.match(/(?:v=|youtu\.be\/|shorts\/)([\w-]{6,})/);
	const videoId = idMatch?.[1] ?? '';

	return {
		dir: workDir,
		videoPath,
		title,
		durationSec: durationSec || 1,
		transcript,
		thumbnailUrl: videoId ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : '',
	};
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
}): Promise<void> {
	const tools = await checkVideoTools();
	if (!tools.ffmpeg) {
		throw new Error('ffmpeg is not installed. Install with: brew install ffmpeg (or set FFMPEG_PATH)');
	}
	const duration = Math.max(0.5, params.endSec - params.startSec);
	await mkdir(dirname(params.outputPath), { recursive: true });
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
		{ timeoutMs: 600_000 },
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
