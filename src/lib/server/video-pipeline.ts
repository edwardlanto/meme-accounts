import { spawn } from 'node:child_process';
import { mkdir, readFile, rm, stat } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { env } from '$env/dynamic/private';

export type ToolCheck = {
	ffmpeg: boolean;
	ytDlp: boolean;
	ffmpegPath: string;
	ytDlpPath: string;
};

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

export async function checkVideoTools(): Promise<ToolCheck> {
	const ffmpegPath = getFfmpegPath();
	const ytDlpPath = getYtDlpPath();
	const [ffmpeg, ytDlp] = await Promise.all([
		commandExists(ffmpegPath),
		commandExists(ytDlpPath),
	]);
	return { ffmpeg, ytDlp, ffmpegPath, ytDlpPath };
}

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

export type YoutubeDownloadResult = {
	dir: string;
	videoPath: string;
	title: string;
	durationSec: number;
	transcript: string;
	thumbnailUrl: string;
};

/** Download YouTube video + auto-captions into a temp directory (caller must rm dir). */
export async function downloadYoutubeToDir(videoUrl: string, workDir: string): Promise<YoutubeDownloadResult> {
	const tools = await checkVideoTools();
	if (!tools.ytDlp) {
		throw new Error(
			'yt-dlp is not installed. Install with: brew install yt-dlp (or set YT_DLP_PATH in .env)',
		);
	}

	await mkdir(workDir, { recursive: true });
	const outTemplate = join(workDir, 'video.%(ext)s');

	await runProcess(
		tools.ytDlpPath,
		[
			'--no-playlist',
			'--no-warnings',
			'--write-auto-sub',
			'--write-sub',
			'--sub-langs',
			'en.*,en',
			'--convert-subs',
			'vtt',
			'-f',
			'bv*[height<=1080]+ba/b[height<=1080]/best[height<=1080]',
			'--merge-output-format',
			'mp4',
			'-o',
			outTemplate,
			videoUrl,
		],
		{ cwd: workDir, timeoutMs: 600_000 },
	);

	const { readdir } = await import('node:fs/promises');
	const files = await readdir(workDir);
	const videoFile = files.find((f) => /\.(mp4|webm|mkv)$/i.test(f));
	if (!videoFile) throw new Error('yt-dlp did not produce a video file');

	const videoPath = join(workDir, videoFile);
	const durationSec = await probeDurationSec(videoPath);

	let transcript = '';
	const subFile = files.find((f) => /\.vtt$/i.test(f) || /\.srt$/i.test(f));
	if (subFile) {
		const raw = await readFile(join(workDir, subFile), 'utf8');
		transcript = vttToTranscript(raw);
	}

	let title = 'YouTube video';
	try {
		const { stdout } = await runProcess(tools.ytDlpPath, ['--print', 'title', '--no-warnings', videoUrl], {
			timeoutMs: 60_000,
		});
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
		durationSec: durationSec || 600,
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
