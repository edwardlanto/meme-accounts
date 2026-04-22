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
 * Cut the foreground out of `source`. Returns a transparent PNG data URL.
 * `source` may be a public URL, data URL, or Blob.
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
		const blob = await rembg(source as any, {
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
		onProgress?.({ phase: 'done' });
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
