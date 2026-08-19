/**
 * Client-side file size guard. Pass `maxBytes` from your plan entitlement to get a friendly
 * error before the file is even sent. Falls back to a 500 MB hard cap if not specified.
 */
function assertFileSize(blob: Blob, maxBytes = 500 * 1024 * 1024) {
	if (blob.size > maxBytes) {
		const limitMb = Math.round(maxBytes / (1024 * 1024));
		const sizeMb = (blob.size / (1024 * 1024)).toFixed(1);
		throw new Error(`File is ${sizeMb} MB — your plan allows uploads up to ${limitMb} MB.`);
	}
}

/** Upload video via /api/videos/upload (MP4/WebM/MOV). */
export async function r2UploadVideo(params: {
	key: string;
	blob: Blob;
	filename?: string;
	/** Pass `maxUploadBytesForPlan(plan)` from plan-entitlements for an instant client-side check. */
	maxBytes?: number;
}): Promise<{ ok: boolean; key: string; playbackUrl: string; sizeBytes: number }> {
	assertFileSize(params.blob, params.maxBytes);
	const fd = new FormData();
	fd.set('key', params.key);
	fd.set('file', params.blob, params.filename ?? 'video.mp4');
	const res = await fetch('/api/videos/upload', { method: 'POST', body: fd });
	const data = await res.json().catch(() => ({}));
	if (!res.ok) throw new Error(data?.error ?? 'Video upload failed');
	return data;
}

/** Upload via your app server (no R2 CORS needed). Prefer this from the browser. */
export async function r2UploadBlob(params: {
	key: string;
	blob: Blob;
	filename?: string;
	/** Pass `maxUploadBytesForPlan(plan)` from plan-entitlements for an instant client-side check. */
	maxBytes?: number;
}): Promise<{ ok: boolean; key: string }> {
	assertFileSize(params.blob, params.maxBytes);
	const fd = new FormData();
	fd.set('key', params.key);
	fd.set('file', params.blob, params.filename ?? 'upload.bin');
	const res = await fetch('/api/r2/upload', { method: 'POST', body: fd });
	const data = await res.json().catch(() => ({}));
	if (!res.ok) throw new Error(data?.error ?? 'Upload failed');
	return data;
}

export async function r2SignUpload(params: { key: string; contentType: string }): Promise<{ url: string; key: string }> {
	const res = await fetch('/api/r2/sign-upload', {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify(params),
	});
	const data = await res.json();
	if (!res.ok) throw new Error(data?.error ?? 'Could not sign upload');
	return data;
}

export async function r2SignRead(params: { key: string }): Promise<{ url: string; key: string }> {
	const res = await fetch('/api/r2/sign-read', {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify(params),
	});
	const data = await res.json();
	if (!res.ok) throw new Error(data?.error ?? 'Could not sign read');
	return data;
}

export async function r2DeleteObject(params: { key: string }): Promise<void> {
	const res = await fetch('/api/r2/delete', {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify(params),
	});
	const data = await res.json().catch(() => ({}));
	if (!res.ok) throw new Error(data?.error ?? 'Could not delete');
}

