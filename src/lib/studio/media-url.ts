/** Detect image/video URLs used on the studio canvas (data, blob, http). */

export function isVideoMediaUrl(url: string): boolean {
	const u = String(url ?? '').trim();
	if (!u) return false;
	const low = u.toLowerCase();
	if (low.startsWith('data:video/')) return true;
	if (low.startsWith('blob:') && /[?#].*\b(video|mp4|webm|mov|m4v|vid)\b/i.test(u)) return true;
	return /\.(mp4|webm|mov|m4v)(\?|#|$)/i.test(low);
}

export function isVideoFile(file: File): boolean {
	const type = String(file.type ?? '').toLowerCase();
	const name = String(file.name ?? '');
	const extOk = /\.(mp4|mov|webm|m4v|mkv|avi)$/i.test(name);
	return (
		type.startsWith('video/') ||
		type === 'application/mp4' ||
		(type === 'application/octet-stream' && extOk) ||
		extOk
	);
}

/** Object URL with a hash so `isVideoMediaUrl` still matches (blob URLs have no extension). */
export function objectUrlForVideoFile(file: File): string {
	return `${URL.createObjectURL(file)}#vid.mp4`;
}

const VIDEO_FILE_ACCEPT = 'image/*,video/mp4,video/webm,video/quicktime,video/x-m4v';

export { VIDEO_FILE_ACCEPT };

export function playMediaVideo(el: HTMLVideoElement | null | undefined): void {
	if (!el) return;
	el.loop = true;
	el.playsInline = true;
	el.setAttribute('playsinline', '');
	el.setAttribute('webkit-playsinline', '');
	void el.play().catch(() => {});
}
