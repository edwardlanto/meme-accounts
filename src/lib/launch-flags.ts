/**
 * Launch gates. Flip these to ship a feature without restoring deleted code.
 * Clips + Videos (YouTube clip finder) stay in the repo but are hidden in production.
 * Enabled only on localhost so local/dev can exercise the full flow.
 */

/** Hostnames where clip finder is allowed (local only). */
export function isLocalClipFinderHost(hostname?: string | null): boolean {
	const h = String(hostname ?? '')
		.trim()
		.toLowerCase()
		.split(':')[0]!;
	return h === 'localhost' || h === '127.0.0.1' || h === '[::1]';
}

/**
 * Clip finder (Clips + Videos pages + analyze APIs).
 * Pass the request hostname on the server; on the client, pass `window.location.hostname`
 * or use layout data from `+layout.server.ts`.
 */
export function isClipFinderEnabled(hostname?: string | null): boolean {
	return isLocalClipFinderHost(hostname);
}

/**
 * @deprecated Prefer `isClipFinderEnabled(hostname)` or layout `clipFinderEnabled`.
 * Always false at module eval on the server in production builds — do not use for gating.
 */
export const CLIP_FINDER_ENABLED = false;

export function isClipFinderPagePath(pathname: string): boolean {
	const p = String(pathname ?? '').split('?')[0]!.replace(/\/+$/, '') || '/';
	return (
		p === '/dashboard/clips' ||
		p.startsWith('/dashboard/clips/') ||
		p === '/dashboard/videos' ||
		p.startsWith('/dashboard/videos/')
	);
}

/** Clip-finder APIs only — not Studio/Bulk video upload (`/api/videos/upload`). */
export function isClipFinderApiPath(pathname: string): boolean {
	const p = String(pathname ?? '').split('?')[0]!.replace(/\/+$/, '') || '/';
	return (
		p === '/api/videos/analyze' ||
		p.startsWith('/api/videos/analyze/') ||
		p === '/api/videos/clip-projects' ||
		p.startsWith('/api/videos/clip-projects/') ||
		p === '/api/videos/export-clip' ||
		p === '/api/videos/tools'
	);
}
