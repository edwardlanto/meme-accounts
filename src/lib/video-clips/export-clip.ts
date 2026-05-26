/** Record a segment from a same-origin or blob video URL into a WebM download. */
export async function exportVideoClip(params: {
	videoUrl: string;
	startSec: number;
	endSec: number;
	filename?: string;
	onProgress?: (pct: number) => void;
}): Promise<void> {
	const { videoUrl, startSec, endSec, filename = 'clip.webm' } = params;
	const duration = Math.max(1, endSec - startSec);

	const video = document.createElement('video');
	video.crossOrigin = 'anonymous';
	video.muted = false;
	video.playsInline = true;
	video.src = videoUrl;

	await new Promise<void>((resolve, reject) => {
		video.onloadedmetadata = () => resolve();
		video.onerror = () => reject(new Error('Could not load video for export'));
	});

	const stream = (video as HTMLVideoElement & { captureStream?: () => MediaStream }).captureStream?.();
	if (!stream) throw new Error('captureStream not supported in this browser');

	const mimeTypes = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];
	const mime = mimeTypes.find((m) => MediaRecorder.isTypeSupported(m)) ?? 'video/webm';
	const recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 4_000_000 });
	const chunks: Blob[] = [];

	recorder.ondataavailable = (e) => {
		if (e.data.size > 0) chunks.push(e.data);
	};

	const done = new Promise<Blob>((resolve, reject) => {
		recorder.onstop = () => resolve(new Blob(chunks, { type: mime.split(';')[0] }));
		recorder.onerror = () => reject(new Error('Recording failed'));
	});

	recorder.start(200);
	video.currentTime = startSec;
	await new Promise<void>((r) => {
		video.onseeked = () => r();
	});

	await video.play();
	const start = performance.now();
	const tick = () => {
		const elapsed = (performance.now() - start) / 1000;
		params.onProgress?.(Math.min(100, (elapsed / duration) * 100));
		if (elapsed >= duration) {
			video.pause();
			recorder.stop();
			return;
		}
		requestAnimationFrame(tick);
	};
	requestAnimationFrame(tick);

	const blob = await done;
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = filename.replace(/\.[^.]+$/, '') + '.webm';
	a.click();
	URL.revokeObjectURL(url);
}

export function formatClipDuration(startSec: number, endSec: number): string {
	const d = Math.max(0, endSec - startSec);
	const m = Math.floor(d / 60);
	const s = Math.floor(d % 60);
	return m > 0 ? `${m}:${String(s).padStart(2, '0')}` : `${s}s`;
}

export function formatTimestamp(sec: number): string {
	const s = Math.max(0, Math.floor(sec));
	const h = Math.floor(s / 3600);
	const m = Math.floor((s % 3600) / 60);
	const ss = s % 60;
	if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
	return `${m}:${String(ss).padStart(2, '0')}`;
}
