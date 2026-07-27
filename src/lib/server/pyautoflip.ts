import { spawn } from 'node:child_process';
import { access, constants } from 'node:fs/promises';
import { join } from 'node:path';
import { cwd } from 'node:process';
import { env } from '$env/dynamic/private';
import type {
	ReframeAspectRatio,
	ReframeMethod,
	ReframePadding,
} from '$lib/video-clips/reframe';

export type PyautoflipReframeParams = {
	inputPath: string;
	outputPath: string;
	aspectRatio?: ReframeAspectRatio;
	method?: ReframeMethod;
	motionThreshold?: number;
	paddingMethod?: ReframePadding;
	debug?: boolean;
	/** Default 10 minutes — detection is usually faster; saliency can be slow. */
	timeoutMs?: number;
	signal?: AbortSignal;
};

let cachedPyautoflipPath: string | null = null;

async function pathExecutable(p: string): Promise<boolean> {
	try {
		await access(p, constants.X_OK);
		return true;
	} catch {
		try {
			await access(p, constants.F_OK);
			return true;
		} catch {
			return false;
		}
	}
}

function projectVenvBin(): string {
	return join(cwd(), '.venv-pyautoflip', 'bin', 'pyautoflip');
}

/** Resolve pyautoflip without running it (first import is slow). */
export async function resolvePyautoflipPath(): Promise<{ path: string; ok: boolean }> {
	if (cachedPyautoflipPath && (await pathExecutable(cachedPyautoflipPath))) {
		return { path: cachedPyautoflipPath, ok: true };
	}

	const configured = env.PYAUTOFLIP_PATH?.trim() ?? '';
	const candidates = [configured, projectVenvBin(), 'pyautoflip'].filter(Boolean);

	for (const candidate of candidates) {
		if (candidate.includes('/') || candidate.startsWith('.')) {
			if (await pathExecutable(candidate)) {
				cachedPyautoflipPath = candidate;
				return { path: candidate, ok: true };
			}
			continue;
		}
		// Bare name on PATH — probe --version (may be slow once)
		const ok = await new Promise<boolean>((resolve) => {
			const child = spawn(candidate, ['--version'], { stdio: 'ignore' });
			child.on('error', () => resolve(false));
			child.on('close', (code) => resolve(code === 0));
		});
		if (ok) {
			cachedPyautoflipPath = candidate;
			return { path: candidate, ok: true };
		}
	}

	return { path: configured || projectVenvBin(), ok: false };
}

function runProcess(
	cmd: string,
	args: string[],
	opts?: { timeoutMs?: number; signal?: AbortSignal },
): Promise<{ stdout: string; stderr: string }> {
	return new Promise((resolve, reject) => {
		if (opts?.signal?.aborted) {
			reject(new DOMException('Aborted', 'AbortError'));
			return;
		}

		const child = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] });
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
					reject(
						new Error(
							`pyautoflip exited ${code}: ${stderr.slice(-2000) || stdout.slice(-500)}`,
						),
					),
				);
		});
	});
}

export async function reframeWithPyautoflip(params: PyautoflipReframeParams): Promise<void> {
	const resolved = await resolvePyautoflipPath();
	if (!resolved.ok) {
		throw new Error(
			'pyautoflip is not installed. Run: npm run pyautoflip:install (or set PYAUTOFLIP_PATH)',
		);
	}

	const aspect = params.aspectRatio ?? '9:16';
	const method = params.method ?? 'detection';
	const motion = Math.min(1, Math.max(0, params.motionThreshold ?? 0.5));
	const padding = params.paddingMethod ?? 'blur';
	const timeoutMs = params.timeoutMs ?? 10 * 60_000;

	const args = [
		'reframe',
		'-i',
		params.inputPath,
		'-o',
		params.outputPath,
		'-a',
		aspect,
		'-m',
		String(motion),
		'-p',
		padding,
		'--method',
		method,
	];
	if (params.debug) args.push('-d');

	console.info(
		`[pyautoflip] reframe ${aspect} method=${method} padding=${padding} motion=${motion}`,
	);
	await runProcess(resolved.path, args, { timeoutMs, signal: params.signal });
}
