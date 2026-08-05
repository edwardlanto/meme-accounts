/** Resize + compress images in the browser before upload. */

const DEFAULT_MAX_DIM = 2048;
const DEFAULT_MAX_BYTES = 2_500_000;
const DEFAULT_QUALITY = 0.86;

export type PreparedImageUpload = {
	blob: Blob;
	filename: string;
	mime: string;
};

export async function prepareImageForUpload(
	file: File,
	opts?: { maxDim?: number; maxBytes?: number; quality?: number },
): Promise<PreparedImageUpload> {
	if (!file.type.startsWith('image/')) {
		throw new Error('Choose an image file (JPEG, PNG, WebP, or GIF)');
	}

	const maxDim = opts?.maxDim ?? DEFAULT_MAX_DIM;
	const maxBytes = opts?.maxBytes ?? DEFAULT_MAX_BYTES;
	const startQuality = opts?.quality ?? DEFAULT_QUALITY;

	// Keep small GIFs as-is (animation).
	if (file.type === 'image/gif' && file.size <= maxBytes) {
		return { blob: file, filename: file.name, mime: 'image/gif' };
	}

	let bitmap: ImageBitmap;
	try {
		bitmap = await createImageBitmap(file);
	} catch {
		throw new Error('Could not read this image — try JPEG or PNG');
	}

	const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height, 1));
	const w = Math.max(1, Math.round(bitmap.width * scale));
	const h = Math.max(1, Math.round(bitmap.height * scale));

	const canvas = document.createElement('canvas');
	canvas.width = w;
	canvas.height = h;
	const ctx = canvas.getContext('2d');
	if (!ctx) {
		bitmap.close();
		throw new Error('Could not process image');
	}
	ctx.drawImage(bitmap, 0, 0, w, h);
	bitmap.close();

	const base = file.name.replace(/\.[^.]+$/, '').trim() || 'asset';
	let quality = startQuality;
	let blob: Blob | null = null;

	for (let i = 0; i < 8; i++) {
		blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', quality));
		if (!blob) break;
		if (blob.size <= maxBytes) break;
		quality = Math.max(0.52, quality - 0.08);
	}

	if (!blob) throw new Error('Could not encode image');

	return {
		blob,
		filename: `${base}.webp`,
		mime: 'image/webp',
	};
}

/** Resize/compress then return a data URL (for brand kit / localStorage). */
export async function prepareImageAsDataUrl(
	file: File,
	opts?: { maxDim?: number; maxBytes?: number; quality?: number },
): Promise<string> {
	const prepared = await prepareImageForUpload(file, opts);
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => resolve(String(reader.result ?? ''));
		reader.onerror = () => reject(new Error('Could not read optimized image'));
		reader.readAsDataURL(prepared.blob);
	});
}
