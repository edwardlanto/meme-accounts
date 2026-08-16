/**
 * Export a Studio slide that has a video background as a real clip
 * (trim length), compositing the designed overlays on top of the playing video.
 * Browser capture is WebM; `transcodeSlideVideoToMp4` turns it into H.264 MP4.
 */
import { toPng } from 'html-to-image';
import {
	SAFE_HTML_TO_IMAGE_OPTS,
	TRANSPARENT_PIXEL,
	materializeDomImagesForExport,
} from '$lib/studio/export-capture';

/** Dual-pass hole colors — never flatten semi-transparent overlays onto a single chroma. */
const HOLE_A = { css: '#FF00FF', r: 255, g: 0, b: 255 };
const HOLE_B = { css: '#00FF00', r: 0, g: 255, b: 0 };

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

function clampByte(n: number): number {
	return Math.max(0, Math.min(255, Math.round(n)));
}

/**
 * Recover overlay RGBA from two flattened captures (hole A vs hole B).
 * Opaque pixels match in both passes; video-hole / glass pixels differ and
 * solve to the real foreground + alpha (keeps shadows and circle borders).
 */
function matteFromDualHoles(
	imgA: HTMLImageElement,
	imgB: HTMLImageElement,
	w: number,
	h: number,
): HTMLCanvasElement {
	const canvas = document.createElement('canvas');
	canvas.width = w;
	canvas.height = h;
	const ctx = canvas.getContext('2d', { willReadFrequently: true });
	if (!ctx) throw new Error('Could not create overlay canvas');

	ctx.drawImage(imgA, 0, 0, w, h);
	const aData = ctx.getImageData(0, 0, w, h);
	ctx.clearRect(0, 0, w, h);
	ctx.drawImage(imgB, 0, 0, w, h);
	const bData = ctx.getImageData(0, 0, w, h);

	const a = aData.data;
	const b = bData.data;
	for (let i = 0; i < a.length; i += 4) {
		const tR = (a[i] - b[i]) / 255;
		const tG = (b[i + 1] - a[i + 1]) / 255;
		const tB = (a[i + 2] - b[i + 2]) / 255;
		const t = Math.max(0, Math.min(1, (tR + tG + tB) / 3));
		const alpha = 1 - t;
		if (alpha <= 0.012) {
			a[i] = 0;
			a[i + 1] = 0;
			a[i + 2] = 0;
			a[i + 3] = 0;
			continue;
		}
		const inv = 1 - alpha;
		a[i] = clampByte((a[i] - HOLE_A.r * inv) / alpha);
		a[i + 1] = clampByte((a[i + 1] - HOLE_A.g * inv) / alpha);
		a[i + 2] = clampByte((a[i + 2] - HOLE_A.b * inv) / alpha);
		a[i + 3] = clampByte(alpha * 255);
	}
	ctx.putImageData(aData, 0, 0);
	return canvas;
}

function collectSlideVideos(root: HTMLElement, primary?: HTMLVideoElement | null): HTMLVideoElement[] {
	const found = Array.from(root.querySelectorAll('video'));
	if (primary && !found.includes(primary)) found.unshift(primary);
	return found;
}

function withVideoHoles<T>(
	videos: HTMLVideoElement[],
	holeCss: string,
	fn: () => Promise<T>,
): Promise<T> {
	const placeholders: HTMLElement[] = [];
	const prevVis: string[] = [];
	const prevPoster: Array<string | null> = [];
	for (const video of videos) {
		const host = video.parentElement;
		if (!host) continue;
		prevVis.push(video.style.visibility);
		prevPoster.push(video.getAttribute('poster'));
		// Poster URLs are often remote CDN — leave them on and html-to-image taints the canvas.
		video.removeAttribute('poster');
		video.style.visibility = 'hidden';
		const placeholder = document.createElement('div');
		placeholder.setAttribute('data-export-chroma', '1');
		placeholder.style.cssText =
			`position:absolute;inset:0;width:100%;height:100%;background:${holeCss};pointer-events:none;z-index:2;`;
		host.appendChild(placeholder);
		placeholders.push(placeholder);
	}
	return fn().finally(() => {
		for (const ph of placeholders) ph.remove();
		videos.forEach((video, i) => {
			if (prevVis[i] !== undefined) video.style.visibility = prevVis[i]!;
			const poster = prevPoster[i];
			if (poster != null && poster !== '') video.setAttribute('poster', poster);
			else video.removeAttribute('poster');
		});
	});
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
	if (video.videoWidth <= 0 || video.videoHeight <= 0) return;
	const scaleX = canvasW / rootRect.width;
	const scaleY = canvasH / rootRect.height;
	const x = (vidRect.left - rootRect.left) * scaleX;
	const y = (vidRect.top - rootRect.top) * scaleY;
	const w = Math.max(1, vidRect.width * scaleX);
	const h = Math.max(1, vidRect.height * scaleY);

	const vw = video.videoWidth;
	const vh = video.videoHeight;
	const fit = (getComputedStyle(video).objectFit || 'cover').toLowerCase();
	// `drawImage(video, x, y, w, h)` stretches — match CSS object-fit instead.
	let sx = 0;
	let sy = 0;
	let sw = vw;
	let sh = vh;
	let dx = x;
	let dy = y;
	let dw = w;
	let dh = h;
	if (fit === 'contain') {
		const scale = Math.min(w / vw, h / vh);
		dw = vw * scale;
		dh = vh * scale;
		dx = x + (w - dw) / 2;
		dy = y + (h - dh) / 2;
	} else if (fit !== 'fill') {
		// cover (default) — crop source to destination aspect
		const scale = Math.max(w / vw, h / vh);
		const cw = w / scale;
		const ch = h / scale;
		sx = (vw - cw) / 2;
		sy = (vh - ch) / 2;
		sw = cw;
		sh = ch;
	}

	ctx.save();
	const clipEl = video.parentElement;
	if (clipEl) {
		const cs = getComputedStyle(clipEl);
		const overflowHidden = cs.overflow === 'hidden' || cs.overflow === 'clip';
		if (overflowHidden) {
			const cr = clipEl.getBoundingClientRect();
			const cx = (cr.left - rootRect.left) * scaleX;
			const cy = (cr.top - rootRect.top) * scaleY;
			const cw = Math.max(1, cr.width * scaleX);
			const ch = Math.max(1, cr.height * scaleY);
			const radiusRaw = String(cs.borderRadius || '').split(/\s+/)[0] ?? '0';
			ctx.beginPath();
			if (radiusRaw.includes('%') && parseFloat(radiusRaw) >= 49) {
				ctx.ellipse(cx + cw / 2, cy + ch / 2, cw / 2, ch / 2, 0, 0, Math.PI * 2);
			} else {
				const br = parseFloat(radiusRaw) || 0;
				const r = Math.min(br * ((scaleX + scaleY) / 2), cw / 2, ch / 2);
				if (r > 0.5 && typeof ctx.roundRect === 'function') {
					ctx.roundRect(cx, cy, cw, ch, r);
				} else {
					ctx.rect(cx, cy, cw, ch);
				}
			}
			ctx.clip();
		}
	}
	ctx.drawImage(video, sx, sy, sw, sh, dx, dy, dw, dh);
	ctx.restore();
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
	/** Rewrite remote/blob imgs to data URLs so html-to-image doesn't taint the canvas. */
	toSafeImageUrl?: (url: string) => Promise<string>;
}): Promise<HTMLCanvasElement> {
	const { root, video, width, height, backgroundColor, toSafeImageUrl } = opts;
	const videos = collectSlideVideos(root, video);
	if (!videos.length) throw new Error('Video has no parent');

	try {
		await (document as Document & { fonts?: { ready?: Promise<unknown> } }).fonts?.ready;
	} catch {
		/* ignore */
	}

	const restoreImgs = toSafeImageUrl
		? await materializeDomImagesForExport(root, toSafeImageUrl)
		: () => {};

	const pngOpts = {
		width,
		height,
		pixelRatio: 1,
		backgroundColor,
		style: { transform: 'scale(1)', transformOrigin: 'top left' },
		...SAFE_HTML_TO_IMAGE_OPTS,
	} as Parameters<typeof toPng>[1];

	const capture = (holeCss: string) =>
		withVideoHoles(videos, holeCss, async () => {
			try {
				const dataUrl = await toPng(root, pngOpts);
				return loadImage(dataUrl || TRANSPARENT_PIXEL);
			} catch (e) {
				const msg = e instanceof Error ? e.message : String(e ?? '');
				if (/taint|toDataURL|SecurityError/i.test(msg)) {
					throw new Error(
						'Export hit a blocked image (CORS). Wait for media to finish loading, then try again.',
					);
				}
				throw e;
			}
		});

	try {
		const imgA = await capture(HOLE_A.css);
		const imgB = await capture(HOLE_B.css);
		return matteFromDualHoles(imgA, imgB, width, height);
	} finally {
		restoreImgs();
	}
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
	/** Rewrite remote/blob imgs before overlay capture (avoids tainted canvas). */
	toSafeImageUrl?: (url: string) => Promise<string>;
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
		toSafeImageUrl,
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

	const videos = collectSlideVideos(root, video);

	const overlay = await captureSlideOverlayWithVideoHole({
		root,
		video,
		width,
		height,
		backgroundColor,
		toSafeImageUrl,
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
	for (const v of videos) {
		if (v === video) continue;
		v.loop = true;
		v.muted = true;
		v.playsInline = true;
		void v.play().catch(() => {});
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
				for (const v of videos) {
					drawVideoInSlideBox(ctx, root, v, width, height);
				}
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

/** Server ffmpeg: WebM → compressed H.264 MP4 (Instagram-ready). */
export async function transcodeSlideVideoToMp4(webm: Blob): Promise<Blob> {
	const fd = new FormData();
	fd.set('file', webm, 'slide.webm');
	const res = await fetch('/api/studio/export-mp4', { method: 'POST', body: fd });
	if (!res.ok) {
		const err = (await res.json().catch(() => null)) as { error?: string } | null;
		throw new Error(err?.error || `MP4 encode failed (${res.status})`);
	}
	return await res.blob();
}
