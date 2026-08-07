/**
 * Export a Studio slide that has a video background as a real WebM clip
 * (trim length), compositing the designed overlays on top of the playing video.
 */
import { toPng } from 'html-to-image';
import { SAFE_HTML_TO_IMAGE_OPTS, TRANSPARENT_PIXEL } from '$lib/studio/export-capture';

const CHROMA = { r: 255, g: 0, b: 255 };

function pickRecorderMime(): string {
	const types = [
		'video/webm;codecs=vp9,opus',
		'video/webm;codecs=vp8,opus',
		'video/webm;codecs=vp9',
		'video/webm;codecs=vp8',
		'video/webm',
	];
	return types.find((t) => MediaRecorder.isTypeSupported(t)) ?? 'video/webm';
}

function loadImage(src: string): Promise<HTMLImageElement> {
	return new Promise((resolve, reject) => {
		const img = new Image();
		img.onload = () => resolve(img);
		img.onerror = () => reject(new Error('Could not load overlay image'));
		img.src = src;
	});
}

/** Punch near-magenta pixels to transparent (video hole). */
function punchChromaToAlpha(
	ctx: CanvasRenderingContext2D,
	w: number,
	h: number,
	tolerance = 48,
): void {
	const id = ctx.getImageData(0, 0, w, h);
	const d = id.data;
	for (let i = 0; i < d.length; i += 4) {
		const dr = Math.abs(d[i] - CHROMA.r);
		const dg = Math.abs(d[i + 1] - CHROMA.g);
		const db = Math.abs(d[i + 2] - CHROMA.b);
		if (dr <= tolerance && dg <= tolerance && db <= tolerance) {
			d[i + 3] = 0;
		}
	}
	ctx.putImageData(id, 0, 0);
}

/**
 * Draw the video into the export canvas using the element's on-screen box
 * relative to the slide root (matches cover / contain / pan / zoom layout).
 */
function drawVideoInSlideBox(
	ctx: CanvasRenderingContext2D,
	root: HTMLElement,
	video: HTMLVideoElement,
	canvasW: number,
	canvasH: number,
): void {
	const rootRect = root.getBoundingClientRect();
	const vidRect = video.getBoundingClientRect();
	if (rootRect.width <= 0 || rootRect.height <= 0) return;
	const scaleX = canvasW / rootRect.width;
	const scaleY = canvasH / rootRect.height;
	const x = (vidRect.left - rootRect.left) * scaleX;
	const y = (vidRect.top - rootRect.top) * scaleY;
	const w = Math.max(1, vidRect.width * scaleX);
	const h = Math.max(1, vidRect.height * scaleY);
	if (video.videoWidth <= 0 || video.videoHeight <= 0) return;
	ctx.drawImage(video, x, y, w, h);
}

async function waitSeeked(video: HTMLVideoElement, t: number): Promise<void> {
	const target = Math.max(0, Math.min(video.duration || t, t));
	if (Math.abs((video.currentTime || 0) - target) < 0.04 && video.readyState >= 2) return;
	await new Promise<void>((resolve) => {
		const done = () => {
			video.removeEventListener('seeked', done);
			resolve();
		};
		video.addEventListener('seeked', done);
		try {
			video.currentTime = target;
		} catch {
			done();
		}
		setTimeout(done, 2500);
	});
}

/**
 * Capture slide chrome (text, stickers, gradients) with a magenta hole where
 * the video sits, then punch that hole to alpha for compositing.
 */
export async function captureSlideOverlayWithVideoHole(opts: {
	root: HTMLElement;
	video: HTMLVideoElement;
	width: number;
	height: number;
	backgroundColor?: string;
}): Promise<HTMLCanvasElement> {
	const { root, video, width, height, backgroundColor } = opts;
	const host = video.parentElement;
	if (!host) throw new Error('Video has no parent');

	const placeholder = document.createElement('div');
	placeholder.setAttribute('data-export-chroma', '1');
	placeholder.style.cssText =
		'position:absolute;inset:0;width:100%;height:100%;background:#FF00FF;pointer-events:none;z-index:2;';
	const prevVisibility = video.style.visibility;
	video.style.visibility = 'hidden';
	host.appendChild(placeholder);

	let dataUrl = TRANSPARENT_PIXEL;
	try {
		try {
			await (document as Document & { fonts?: { ready?: Promise<unknown> } }).fonts?.ready;
		} catch {
			/* ignore */
		}
		dataUrl = await toPng(root, {
			width,
			height,
			pixelRatio: 1,
			backgroundColor,
			style: { transform: 'scale(1)', transformOrigin: 'top left' },
			...SAFE_HTML_TO_IMAGE_OPTS,
		} as Parameters<typeof toPng>[1]);
	} finally {
		placeholder.remove();
		video.style.visibility = prevVisibility;
	}

	const img = await loadImage(dataUrl);
	const canvas = document.createElement('canvas');
	canvas.width = width;
	canvas.height = height;
	const ctx = canvas.getContext('2d');
	if (!ctx) throw new Error('Could not create overlay canvas');
	ctx.drawImage(img, 0, 0, width, height);
	punchChromaToAlpha(ctx, width, height);
	return canvas;
}

export type RecordSlideVideoProgress = (pct: number) => void;

/**
 * Record `startSec..endSec` of the slide video with overlays composited on top.
 * Returns a WebM blob. Recording runs in (approx) real time.
 */
export async function recordSlideAsVideo(opts: {
	root: HTMLElement;
	video: HTMLVideoElement;
	width: number;
	height: number;
	startSec: number;
	endSec: number;
	backgroundColor?: string;
	fps?: number;
	includeAudio?: boolean;
	onProgress?: RecordSlideVideoProgress;
}): Promise<Blob> {
	const {
		root,
		video,
		width,
		height,
		startSec,
		backgroundColor = '#0a0a0a',
		fps = 30,
		includeAudio = true,
		onProgress,
	} = opts;

	const mediaDur = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 0;
	let endSec = opts.endSec;
	if (!(endSec > startSec)) {
		endSec = mediaDur > startSec ? mediaDur : startSec + 3;
	}
	// Cap runaway lengths (stock clips can be long).
	const maxLen = 90;
	endSec = Math.min(endSec, startSec + maxLen);
	const duration = Math.max(0.25, endSec - startSec);

	const wasMuted = video.muted;
	const wasLoop = video.loop;
	const prevPreload = video.preload;
	const prevTime = video.currentTime;

	video.loop = false;
	video.preload = 'auto';
	if (!includeAudio) video.muted = true;

	await waitSeeked(video, startSec);
	if (video.readyState < 2) {
		await new Promise<void>((resolve) => {
			const done = () => resolve();
			video.addEventListener('loadeddata', done, { once: true });
			setTimeout(done, 4000);
		});
	}

	const overlay = await captureSlideOverlayWithVideoHole({
		root,
		video,
		width,
		height,
		backgroundColor,
	});

	const canvas = document.createElement('canvas');
	canvas.width = width;
	canvas.height = height;
	const ctx = canvas.getContext('2d');
	if (!ctx) throw new Error('Could not create recording canvas');

	const canvasStream = canvas.captureStream(fps);
	if (includeAudio) {
		try {
			const vStream = (
				video as HTMLVideoElement & { captureStream?: (fps?: number) => MediaStream }
			).captureStream?.(fps);
			vStream?.getAudioTracks().forEach((track) => {
				canvasStream.addTrack(track);
			});
		} catch {
			/* audio optional */
		}
	}

	const mime = pickRecorderMime();
	const recorder = new MediaRecorder(canvasStream, {
		mimeType: mime,
		videoBitsPerSecond: 6_000_000,
	});
	const chunks: Blob[] = [];
	recorder.ondataavailable = (e) => {
		if (e.data?.size) chunks.push(e.data);
	};

	const stopped = new Promise<Blob>((resolve, reject) => {
		recorder.onstop = () => {
			resolve(new Blob(chunks, { type: mime.split(';')[0] || 'video/webm' }));
		};
		recorder.onerror = () => reject(new Error('Video recording failed'));
	});

	await waitSeeked(video, startSec);
	recorder.start(250);

	try {
		await video.play();
	} catch {
		video.muted = true;
		await video.play();
	}

	const wallStart = performance.now();
	await new Promise<void>((resolve) => {
		let raf = 0;
		const tick = () => {
			const elapsed = (performance.now() - wallStart) / 1000;
			const t = startSec + elapsed;
			onProgress?.(Math.min(100, (elapsed / duration) * 100));

			ctx.fillStyle = backgroundColor;
			ctx.fillRect(0, 0, width, height);
			try {
				drawVideoInSlideBox(ctx, root, video, width, height);
			} catch {
				/* frame skip */
			}
			ctx.drawImage(overlay, 0, 0);

			const ended =
				elapsed >= duration ||
				video.ended ||
				(mediaDur > 0 && video.currentTime >= endSec - 0.05);
			if (ended) {
				cancelAnimationFrame(raf);
				try {
					video.pause();
				} catch {
					/* ignore */
				}
				resolve();
				return;
			}
			raf = requestAnimationFrame(tick);
		};
		raf = requestAnimationFrame(tick);
		// Hard stop so we never hang if play stalls.
		setTimeout(() => {
			cancelAnimationFrame(raf);
			resolve();
		}, (duration + 2) * 1000);
	});

	if (recorder.state !== 'inactive') recorder.stop();
	const blob = await stopped;

	video.muted = wasMuted;
	video.loop = wasLoop;
	video.preload = prevPreload;
	try {
		video.currentTime = prevTime;
	} catch {
		/* ignore */
	}
	onProgress?.(100);

	if (!blob.size) throw new Error('Recorded video was empty');
	return blob;
}

/** True when a slide should export as video instead of a still PNG. */
export function slideExportDurationSec(clip: {
	start: number;
	end: number;
	duration: number;
	videoElDuration?: number;
}): number {
	const start = Math.max(0, clip.start || 0);
	let end = clip.end > start ? clip.end : 0;
	if (!(end > start)) {
		const d = clip.duration > 0 ? clip.duration : clip.videoElDuration || 0;
		end = start + d;
	}
	if (!(end > start) && (clip.videoElDuration || 0) > start) {
		end = clip.videoElDuration!;
	}
	return Math.max(0, end - start);
}
