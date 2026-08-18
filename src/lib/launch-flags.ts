/**
 * Launch gates. Flip these to ship a feature without restoring deleted code.
 * Clips + Videos (YouTube clip finder) stay in the repo but are hidden until launch.
 */
export const CLIP_FINDER_ENABLED = false;

export function isClipFinderPagePath(pathname: string): boolean {
	const p = String(pathname ?? '').split('?')[0]!.replace(/\/+$/, '') || '/';
	return p === '/dashboard/clips' || p.startsWith('/dashboard/clips/')
		|| p === '/dashboard/videos' || p.startsWith('/dashboard/videos/');
}

/** Clip-finder APIs only — not Studio/Bulk video upload (`/api/videos/upload`). */
export function isClipFinderApiPath(pathname: string): boolean {
	const p = String(pathname ?? '').split('?')[0]!.replace(/\/+$/, '') || '/';
	return (
		p === '/api/videos/analyze'
		|| p.startsWith('/api/videos/analyze/')
		|| p === '/api/videos/clip-projects'
		|| p.startsWith('/api/videos/clip-projects/')
		|| p === '/api/videos/export-clip'
		|| p === '/api/videos/tools'
	);
}
