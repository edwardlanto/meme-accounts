import { spawn } from 'node:child_process';
import { access } from 'node:fs/promises';
import { mkdir, readFile, rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { env } from '$env/dynamic/private';

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

export function getFfmpegPath(): string {
	return binFromEnv('FFMPEG_PATH', 'ffmpeg');
}

export function getFfprobePath(): string {
	return binFromEnv('FFPROBE_PATH', 'ffprobe');
}

export function getYtDlpPath(): string {
	return binFromEnv('YT_DLP_PATH', 'yt-dlp');
}

async function commandExists(cmd: string): Promise<boolean> {
	return new Promise((resolve) => {
		const child = spawn(cmd, ['--version'], { stdio: 'ignore' });
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
	const ffmpegPath = getFfmpegPath();
	const ytDlpPath = getYtDlpPath();
	const cookiesPath = env.YT_DLP_COOKIES?.trim() ?? '';
	const cookiesBrowser = env.YT_DLP_COOKIES_BROWSER?.trim() ?? '';
	const [ffmpeg, ytDlp, ytDlpDeno, cookiesOk] = await Promise.all([
		commandExists(ffmpegPath),
		commandExists(ytDlpPath),
		commandExists('deno'),
		cookiesPath ? pathReadable(cookiesPath) : Promise.resolve(false),
	]);
	return {
		ffmpeg,
		ytDlp,
		ffmpegPath,
		ytDlpPath,
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
		{ cwd: workDir, timeoutMs: 600_000 },
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
			await runYtDlpDownload(tools.ytDlpPath, videoUrl, workDir, strategy);
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
		transcript = vttToTranscript(raw);
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

function vttToTranscript(vtt: string): string {
	const lines: string[] = [];
	const seen = new Set<string>();
	for (const block of vtt.split(/\n\n+/)) {
		const text = block
			.split('\n')
			.filter((l) => l && !l.startsWith('WEBVTT') && !/^\d+$/.test(l) && !/-->/.test(l))
			.join(' ')
			.replace(/<[^>]+>/g, '')
			.trim();
		if (text && !seen.has(text)) {
			seen.add(text);
			lines.push(text);
		}
	}
	return lines.join('\n');
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
