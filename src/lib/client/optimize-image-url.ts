/** Studio canvas is ≤1080 CSS px — fetch ~1.5× for retina, never multi‑thousand originals. */
export const STUDIO_CANVAS_IMAGE_W = 1620;
/** Library / Carousels card thumbs (CSS ~200–280px). */
export const LIBRARY_CARD_IMAGE_W = 640;

/**
 * Rewrite common stock CDN URLs to a target display width (saves bandwidth on
 * filmstrip thumbs and bulk previews). Unknown hosts are returned unchanged.
 */
export function optimizeImageUrl(url: string, widthPx: number): string {
	const raw = String(url ?? '').trim();
	if (!raw || !Number.isFinite(widthPx) || widthPx <= 0) return raw;
	if (raw.startsWith('data:') || raw.startsWith('blob:')) return raw;
	// Local static / relative paths can't be resized via query params.
	if (raw.startsWith('/') && !raw.startsWith('//')) return raw;

	const w = Math.max(64, Math.min(2048, Math.round(widthPx)));

	try {
		const u = new URL(raw);
		const host = u.hostname.toLowerCase();

		if (host.includes('images.unsplash.com') || host.includes('plus.unsplash.com')) {
			u.searchParams.set('w', String(w));
			u.searchParams.set('q', '78');
			u.searchParams.set('auto', 'format');
			u.searchParams.set('fit', 'crop');
			return u.toString();
		}

		if (host.includes('images.pexels.com')) {
			u.searchParams.set('auto', 'compress');
			u.searchParams.set('cs', 'tinysrgb');
			u.searchParams.set('w', String(w));
			return u.toString();
		}

		// Cloudflare Images delivery / imgix-style (safe to resize via query)
		if (host.includes('imagedelivery.net') || host.includes('imgix.net')) {
			u.searchParams.set('w', String(w));
			u.searchParams.set('fit', 'max');
			return u.toString();
		}

		// Already sized via w=/width= (e.g. some proxies) — clamp to target.
		// Skip signed object stores (R2/S3) where mutating the query breaks the signature.
		const looksSigned =
			u.searchParams.has('X-Amz-Signature') ||
			u.searchParams.has('X-Amz-Credential') ||
			u.searchParams.has('Signature') ||
			u.searchParams.has('X-Amz-Algorithm');
		if (!looksSigned && (u.searchParams.has('w') || u.searchParams.has('width'))) {
			if (u.searchParams.has('w')) u.searchParams.set('w', String(w));
			if (u.searchParams.has('width')) u.searchParams.set('width', String(w));
			return u.toString();
		}
	} catch {
		/* keep original */
	}

	return raw;
}

/** Cap remote images for the live Studio canvas (export still rasterizes at canvas size). */
export function studioCanvasImageUrl(url: string): string {
	return optimizeImageUrl(url, STUDIO_CANVAS_IMAGE_W);
}

/** Cap remote images for Carousels / library card previews. */
export function libraryCardImageUrl(url: string): string {
	return optimizeImageUrl(url, LIBRARY_CARD_IMAGE_W);
}

/** Preload an image URL; resolves when decoded (or on error). */
export function preloadImage(url: string): Promise<'ok' | 'error' | 'empty'> {
	const src = String(url ?? '').trim();
	if (!src) return Promise.resolve('empty');

	return new Promise((resolve) => {
		const img = new Image();
		img.decoding = 'async';
		img.onload = () => resolve('ok');
		img.onerror = () => resolve('error');
		img.src = src;
		if (img.complete && img.naturalWidth > 0) resolve('ok');
	});
}
