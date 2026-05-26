/** Upload video via /api/videos/upload (MP4/WebM/MOV, up to 200MB). */
export async function r2UploadVideo(params: {
	key: string;
	blob: Blob;
	filename?: string;
}): Promise<{ ok: boolean; key: string; playbackUrl: string; sizeBytes: number }> {
	const fd = new FormData();
	fd.set('key', params.key);
	fd.set('file', params.blob, params.filename ?? 'video.mp4');
	const res = await fetch('/api/videos/upload', { method: 'POST', body: fd });
	const data = await res.json().catch(() => ({}));
	if (!res.ok) throw new Error(data?.error ?? 'Video upload failed');
	return data;
}

/** Upload via your app server (no R2 CORS needed). Prefer this from the browser. */
export async function r2UploadBlob(params: { key: string; blob: Blob; filename?: string }): Promise<{ ok: boolean; key: string }> {
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

