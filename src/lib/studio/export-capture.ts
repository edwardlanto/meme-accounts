/**
 * Helpers for html-to-image / canvas export from Studio.
 * Videos and cross-origin images commonly produce opaque Event rejects (`{"isTrusted":true}`).
 */

/** Human-readable message from html-to-image / canvas failures (often an Event, not Error). */
export function formatExportError(err: unknown): string {
	if (err instanceof Error && err.message.trim()) {
		const m = err.message.trim();
		if (/taint|toDataURL|SecurityError/i.test(m)) {
			return 'Export hit a blocked image or video (CORS). Wait for media to finish loading, then try again.';
		}
		return m;
	}
	if (typeof err === 'string' && err.trim()) return err.trim();
	if (err && typeof err === 'object') {
		const anyErr = err as { message?: unknown; type?: unknown; isTrusted?: unknown; name?: unknown };
		if (typeof anyErr.message === 'string' && anyErr.message.trim()) return anyErr.message.trim();
		if (anyErr.isTrusted === true || typeof anyErr.type === 'string') {
			return 'Could not rasterize the canvas (image/video security or load error).';
		}
		try {
			const s = JSON.stringify(err);
			if (s && s !== '{}' && !s.includes('"isTrusted"')) return s;
		} catch {
			/* ignore */
		}
	}
	return 'Unknown export error';
}

export const TRANSPARENT_PIXEL =
	'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

/** Reject if `promise` has not settled — does not cancel the underlying work. */
export function raceTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
	return new Promise<T>((resolve, reject) => {
		const t = setTimeout(() => reject(new Error(message)), Math.max(1, ms));
		promise.then(
			(v) => {
				clearTimeout(t);
				resolve(v);
			},
			(e) => {
				clearTimeout(t);
				reject(e);
			},
		);
	});
}

/** `document.fonts.ready` can hang forever if a face never loads. */
export async function waitForDocumentFonts(ms = 2000): Promise<void> {
	if (typeof document === 'undefined') return;
	const ready = document.fonts?.ready;
	if (!ready) return;
	try {
		await raceTimeout(Promise.resolve(ready), ms, 'fonts');
	} catch {
		/* use whatever is already available */
	}
}

/**
 * Safe defaults for html-to-image.
 * - `cacheBust: true` appends `?t=` which breaks `blob:` and some signed URLs.
 * - Empty failed embeds reject with a trusted Event — placeholder + error handler avoid that.
 * - `skipFonts: true` — Google Fonts sheets throw SecurityError on cssRules (CORS).
 *   Faces are already loaded in the document; embedding them is unnecessary and can hang.
 */
export const SAFE_HTML_TO_IMAGE_OPTS = {
	cacheBust: false,
	skipFonts: true,
	imagePlaceholder: TRANSPARENT_PIXEL,
	onImageErrorHandler: () => {
		/* keep export going if one asset fails to paint */
	},
} as const;

/** Remote https video → same-origin blob URL (via /api/media/fetch-video). */
export async function fetchRemoteVideoAsBlobUrl(remoteUrl: string): Promise<string> {
	const src = String(remoteUrl ?? '').trim();
	if (!src) throw new Error('Missing video URL');
	if (src.startsWith('blob:') || src.startsWith('data:')) return src;

	const res = await fetch('/api/media/fetch-video', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ url: src }),
		signal: AbortSignal.timeout(60_000),
	});
	const ct = res.headers.get('content-type') ?? '';
	if (!res.ok) {
		let msg = `Video proxy failed (${res.status})`;
		if (ct.includes('application/json')) {
			const data = (await res.json().catch(() => null)) as { error?: string } | null;
			if (data?.error) msg = data.error;
		}
		throw new Error(msg);
	}
	const blob = await res.blob();
	if (!blob.size) throw new Error('Empty video from proxy');
	return URL.createObjectURL(blob);
}

function frameFromVideoEl(video: HTMLVideoElement): string {
	const w = video.videoWidth;
	const h = video.videoHeight;
	if (w <= 0 || h <= 0) return '';
	const canvas = document.createElement('canvas');
	canvas.width = w;
	canvas.height = h;
	const ctx = canvas.getContext('2d');
	if (!ctx) return '';
	ctx.drawImage(video, 0, 0, w, h);
	try {
		return canvas.toDataURL('image/jpeg', 0.92);
	} catch {
		/* tainted */
		return '';
	}
}

async function waitForVideoFrame(video: HTMLVideoElement, timeoutMs = 6000): Promise<void> {
	if (video.readyState >= 2 && video.videoWidth > 0) return;
	await new Promise<void>((resolve) => {
		let settled = false;
		const done = () => {
			if (settled) return;
			settled = true;
			cleanup();
			resolve();
		};
		const cleanup = () => {
			video.removeEventListener('loadeddata', done);
			video.removeEventListener('canplay', done);
			video.removeEventListener('error', done);
		};
		video.addEventListener('loadeddata', done);
		video.addEventListener('canplay', done);
		video.addEventListener('error', done);
		try {
			if (video.preload === 'none') video.preload = 'auto';
			void video.load();
		} catch {
			/* ignore */
		}
		setTimeout(done, timeoutMs);
	});
}

async function loadVideoForFrame(src: string): Promise<HTMLVideoElement> {
	const video = document.createElement('video');
	video.muted = true;
	video.playsInline = true;
	video.preload = 'auto';
	video.crossOrigin = 'anonymous';
	video.src = src;
	await waitForVideoFrame(video, 8000);
	try {
		const t = Math.min(0.12, Math.max(0, (video.duration || 1) * 0.05));
		if (Number.isFinite(t) && t > 0 && video.readyState >= 1) {
			video.currentTime = t;
			await new Promise<void>((resolve) => {
				const done = () => resolve();
				video.addEventListener('seeked', done, { once: true });
				setTimeout(done, 2000);
			});
		}
	} catch {
		/* use first decoded frame */
	}
	return video;
}

async function captureFrameDataUrl(video: HTMLVideoElement): Promise<string> {
	await waitForVideoFrame(video);

	try {
		const direct = frameFromVideoEl(video);
		if (direct) return direct;
	} catch {
		/* tainted canvas — try same-origin blob proxy */
	}

	const src = String(video.currentSrc || video.src || '').trim();
	if (!src) return '';

	// Same-origin blob / data: re-decode in a fresh element (often recovers a late frame).
	if (src.startsWith('blob:') || src.startsWith('data:')) {
		try {
			const tmp = await loadVideoForFrame(src);
			try {
				return frameFromVideoEl(tmp);
			} finally {
				tmp.removeAttribute('src');
				tmp.load();
			}
		} catch {
			return '';
		}
	}

	try {
		const blobUrl = await fetchRemoteVideoAsBlobUrl(src);
		const tmp = await loadVideoForFrame(blobUrl);
		try {
			return frameFromVideoEl(tmp);
		} finally {
			tmp.removeAttribute('src');
			tmp.load();
			URL.revokeObjectURL(blobUrl);
		}
	} catch {
		return '';
	}
}

async function blobUrlToDataUrl(blobUrl: string): Promise<string> {
	const res = await fetch(blobUrl);
	const blob = await res.blob();
	return await new Promise<string>((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => resolve(String(reader.result ?? ''));
		reader.onerror = () => reject(reader.error ?? new Error('read failed'));
		reader.readAsDataURL(blob);
	});
}

/**
 * Rewrite every `<img>` (and inline `background-image` urls) under `root` to a
 * data URL so html-to-image never hits cross-origin / cacheBust / blob fetch
 * failures. Returns a restore function.
 */
export async function materializeDomImagesForExport(
	root: HTMLElement,
	toSafeUrl: (url: string) => Promise<string>,
): Promise<() => void> {
	const imgs = Array.from(root.querySelectorAll('img'));
	const restores: Array<() => void> = [];

	const rewriteUrl = async (src: string): Promise<string> => {
		const raw = String(src ?? '').trim();
		if (!raw || raw.startsWith('data:')) return raw;
		try {
			if (raw.startsWith('blob:')) return (await blobUrlToDataUrl(raw)) || '';
			return (await toSafeUrl(raw)) || '';
		} catch {
			return '';
		}
	};

	for (const img of imgs) {
		const prevAttr = img.getAttribute('src');
		const src = String(img.currentSrc || img.src || prevAttr || '').trim();
		if (!src || src.startsWith('data:')) continue;

		let safe = await rewriteUrl(src);
		if (!safe || safe === src) {
			// Still remote / unresolved — force a paint-safe pixel so embedImages won't reject.
			if (/^https?:/i.test(src) || src.startsWith('blob:') || isLikelyRemoteMediaUrl(src)) {
				img.setAttribute('src', TRANSPARENT_PIXEL);
				img.removeAttribute('srcset');
				restores.push(() => {
					if (prevAttr != null) img.setAttribute('src', prevAttr);
					else img.removeAttribute('src');
				});
			}
			continue;
		}

		img.setAttribute('src', safe);
		img.removeAttribute('srcset');
		restores.push(() => {
			if (prevAttr != null) img.setAttribute('src', prevAttr);
			else img.removeAttribute('src');
		});
	}

	// CSS background-image: url(...) — same CORS taint risk as <img>.
	const bgEls = Array.from(root.querySelectorAll<HTMLElement>('*')).filter((el) => {
		const bg = el.style?.backgroundImage || '';
		return /url\(/i.test(bg);
	});
	for (const el of bgEls) {
		const prev = el.style.backgroundImage;
		const urls = [...prev.matchAll(/url\((['"]?)([^'")]+)\1\)/gi)].map((m) => m[2]?.trim() ?? '');
		if (!urls.length) continue;
		let next = prev;
		let changed = false;
		for (const u of urls) {
			if (!u || u.startsWith('data:') || u.startsWith('linear-gradient')) continue;
			const safe = await rewriteUrl(u);
			const replacement =
				safe && safe !== u
					? safe
					: /^https?:/i.test(u) || u.startsWith('blob:')
						? TRANSPARENT_PIXEL
						: '';
			if (!replacement) continue;
			next = next.replace(u, replacement);
			changed = true;
		}
		if (!changed) continue;
		el.style.backgroundImage = next;
		restores.push(() => {
			el.style.backgroundImage = prev;
		});
	}

	await Promise.all(
		imgs.map(
			(img) =>
				new Promise<void>((resolve) => {
					if (img.complete) {
						resolve();
						return;
					}
					img.addEventListener('load', () => resolve(), { once: true });
					img.addEventListener('error', () => resolve(), { once: true });
					setTimeout(() => resolve(), 3000);
				}),
		),
	);

	return () => {
		for (const restore of restores.reverse()) restore();
	};
}

function isLikelyRemoteMediaUrl(src: string): boolean {
	return (
		src.startsWith('r2:') ||
		src.startsWith('//') ||
		/^https?:/i.test(src) ||
		src.includes('X-Amz-Signature')
	);
}

/**
 * Replace `<video>` nodes under `root` with a still `<img>` of the current frame so
 * html-to-image can export. Returns a restore function.
 */
export async function replaceVideosWithFrameImages(root: HTMLElement): Promise<() => void> {
	const videos = Array.from(root.querySelectorAll('video'));
	const restores: Array<() => void> = [];

	for (const video of videos) {
		let dataUrl = '';
		try {
			dataUrl = await captureFrameDataUrl(video);
		} catch {
			dataUrl = '';
		}

		const img = document.createElement('img');
		img.alt = '';
		img.decoding = 'sync';
		img.src = dataUrl || TRANSPARENT_PIXEL;
		const style = video.getAttribute('style');
		if (style) img.setAttribute('style', style);
		if (video.className) img.className = video.className;

		const parent = video.parentNode;
		if (!parent) continue;
		parent.replaceChild(img, video);
		restores.push(() => {
			try {
				parent.replaceChild(video, img);
			} catch {
				/* node may already be gone */
			}
		});
	}

	// Let replacement images decode before rasterize.
	await Promise.all(
		Array.from(root.querySelectorAll('img')).map(
			(img) =>
				new Promise<void>((resolve) => {
					if (img.complete) {
						resolve();
						return;
					}
					img.addEventListener('load', () => resolve(), { once: true });
					img.addEventListener('error', () => resolve(), { once: true });
				}),
		),
	);

	return () => {
		for (const restore of restores.reverse()) restore();
	};
}
