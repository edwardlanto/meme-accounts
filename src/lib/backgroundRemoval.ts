/**
 * Thin wrapper around @imgly/background-removal.
 *
 * Runs entirely in the browser via WebAssembly + ONNX. First invocation
 * downloads the model (~40MB) then caches it in IndexedDB for future runs.
 *
 * Produces a transparent PNG (data URL) from any image source (URL / data URL / Blob).
 */

export type BgRemovalProgress = {
	phase: 'loading-model' | 'processing' | 'done' | 'error';
	// 0..1 when available (downloads); undefined while processing
	progress?: number;
	message?: string;
};

type ProgressCb = (p: BgRemovalProgress) => void;

// Cache by source URL/data URL so we never redo the same image twice.
const cutoutCache = new Map<string, string>();

/** Convert a Blob to a data URL on the main thread. */
function blobToDataUrl(blob: Blob): Promise<string> {
	return new Promise((resolve, reject) => {
		const r = new FileReader();
		r.onload = () => resolve(r.result as string);
		r.onerror = () => reject(r.error ?? new Error('FileReader failed'));
		r.readAsDataURL(blob);
	});
}

/**
 * Materialize a remote/same-origin image into a Blob so onnxruntime never
 * hits a CORS-tainted canvas fetch. Data URLs and Blobs pass through.
 */
async function sourceToBlob(source: string | Blob): Promise<Blob> {
	if (typeof source !== 'string') return source;
	const src = source.trim();
	if (!src) throw new Error('No image to cut out');

	if (src.startsWith('data:')) {
		const res = await fetch(src);
		if (!res.ok) throw new Error('Could not read image data');
		return res.blob();
	}
	if (src.startsWith('blob:')) {
		const res = await fetch(src);
		if (!res.ok) throw new Error('Could not read blob image');
		return res.blob();
	}

	// Relative / absolute URL — prefer same-origin fetch; CORS may block third-party hosts.
	try {
		const res = await fetch(src, {
			mode: 'cors',
			credentials: 'omit',
			signal: AbortSignal.timeout(45_000),
		});
		if (!res.ok) throw new Error(`Image fetch failed (${res.status})`);
		const blob = await res.blob();
		if (!blob.size) throw new Error('Empty image');
		return blob;
	} catch (e: unknown) {
		const msg = e instanceof Error ? e.message : String(e);
		if (/Failed to fetch|NetworkError|CORS|blocked/i.test(msg) || e instanceof TypeError) {
			throw new Error(
				'Could not load this image for cutout (CORS). Try again — Studio will proxy remote photos first.',
			);
		}
		throw e instanceof Error ? e : new Error(msg || 'Image fetch failed');
	}
}

/**
 * Cut the foreground out of `source`. Returns a transparent PNG data URL.
 * `source` may be a public URL, data URL, or Blob.
 * Prefer passing a data URL / Blob for remote CDN images (CORS).
 */
export async function removeBackground(
	source: string | Blob,
	onProgress?: ProgressCb,
): Promise<string> {
	const cacheKey = typeof source === 'string' ? source : '';
	if (cacheKey && cutoutCache.has(cacheKey)) return cutoutCache.get(cacheKey)!;

	onProgress?.({ phase: 'loading-model', message: 'Preparing AI model…' });

	// Dynamic import so the ~40MB model + wasm only loads when the user actually
	// invokes this feature (studio page stays fast to open).
	const { removeBackground: rembg } = await import('@imgly/background-removal');

	try {
		onProgress?.({ phase: 'processing', message: 'Loading image…', progress: 0.05 });
		const inputBlob = await sourceToBlob(source);

		const blob = await rembg(inputBlob, {
			// Downloads model from @imgly's CDN on first call, then caches in the browser.
			progress: (key: string, current: number, total: number) => {
				const pct = total > 0 ? current / total : undefined;
				if (key.startsWith('fetch')) {
					onProgress?.({
						phase: 'loading-model',
						progress: pct,
						message: `Downloading model… ${Math.round((pct ?? 0) * 100)}%`,
					});
				} else {
					onProgress?.({ phase: 'processing', progress: pct, message: 'Cutting subject…' });
				}
			},
			// Balanced default — quality vs. speed. 'isnet' gives slightly better edges but is 2x slower.
			model: 'isnet_fp16',
			output: { format: 'image/png', quality: 0.9 },
		});

		const dataUrl = await blobToDataUrl(blob);
		onProgress?.({ phase: 'done', progress: 1, message: 'Done' });
		if (cacheKey) cutoutCache.set(cacheKey, dataUrl);
		return dataUrl;
	} catch (e: any) {
		onProgress?.({ phase: 'error', message: e?.message ?? 'Background removal failed' });
		throw e;
	}
}

/** Clear the in-memory cache (useful when regenerating). */
export function clearCutoutCache() {
	cutoutCache.clear();
}
