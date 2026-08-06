/**
 * Helpers for html-to-image / canvas export from Studio.
 * Videos and cross-origin images commonly produce opaque Event rejects (`{"isTrusted":true}`).
 */

/** Human-readable message from html-to-image / canvas failures (often an Event, not Error). */
export function formatExportError(err: unknown): string {
	if (err instanceof Error && err.message.trim()) return err.message.trim();
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
			const w = video.videoWidth;
			const h = video.videoHeight;
			if (w > 0 && h > 0) {
				const canvas = document.createElement('canvas');
				canvas.width = w;
				canvas.height = h;
				const ctx = canvas.getContext('2d');
				if (ctx) {
					ctx.drawImage(video, 0, 0, w, h);
					dataUrl = canvas.toDataURL('image/jpeg', 0.92);
				}
			}
		} catch {
			// Cross-origin / tainted video — fall through to transparent placeholder.
		}

		const img = document.createElement('img');
		img.alt = '';
		img.decoding = 'sync';
		img.src =
			dataUrl ||
			'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
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
