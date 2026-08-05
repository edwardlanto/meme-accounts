/**
 * Shared R2 reference parsing + URL resolution for Studio.
 * Keeps one implementation so template changes don’t diverge on media loading.
 */

export function isR2Ref(u: unknown): u is string {
	return typeof u === 'string' && u.startsWith('r2:');
}

export function r2KeyFromRef(ref: string): string {
	return ref.slice(3).trim();
}

/** Resolve a stored media string using an R2 key→signed-URL cache (`http(s)`, `blob:`, `data:` passthrough). */
export function resolveStoredMediaUrl(u: unknown, r2UrlByKey: Record<string, string>): string {
	if (typeof u !== 'string') return '';
	const s = u.trim();
	if (!s) return '';
	if (!isR2Ref(s)) return s;
	const key = r2KeyFromRef(s);
	return r2UrlByKey[key] ?? '';
}

/** In-flight sign promises keyed by R2 object key (module-level per call site via Map arg). */
export async function ensureR2RefLoaded(
	refOrUrl: string,
	r2UrlByKey: Record<string, string>,
	inFlight: Set<string>,
	signRead: (p: { key: string }) => Promise<{ url: string }>,
	onResolved: (key: string, url: string) => void,
	inFlightPromises?: Map<string, Promise<void>>,
): Promise<void> {
	if (!isR2Ref(refOrUrl)) return;
	const key = r2KeyFromRef(refOrUrl);
	if (!key) return;
	if (r2UrlByKey[key]) return;

	const pending = inFlightPromises?.get(key);
	if (pending) {
		await pending;
		return;
	}

	if (inFlight.has(key) && !inFlightPromises) {
		const started = Date.now();
		while (inFlight.has(key) && Date.now() - started < 15_000) {
			await new Promise((r) => setTimeout(r, 40));
			if (r2UrlByKey[key]) return;
		}
		return;
	}

	const run = (async () => {
		inFlight.add(key);
		try {
			const { url } = await signRead({ key });
			if (!url) return;
			onResolved(key, url);
		} catch {
			// keep unresolved (renders blank) — callers can check resolveStoredMediaUrl
		} finally {
			inFlight.delete(key);
			inFlightPromises?.delete(key);
		}
	})();

	inFlightPromises?.set(key, run);
	await run;
}

export type StudioR2PrefetchMedia = {
	bgImagesByTemplate: Record<string, string[] | undefined>;
	circleImages: string[];
	circle2Images: string[];
	subjectCutouts: string[];
	/** Per-template per-slide rows of sticker overlays — only `.src` is inspected. */
	slideOverlaysByTemplate: Record<string, Array<Array<{ src?: unknown }>> | undefined>;
};

/**
 * Walk all Studio slide media that may contain `r2:` refs and prefetch signed URLs.
 * One code path so adding a new media array doesn’t require copying loops in `+page.svelte`.
 */
export async function prefetchAllR2RefsInStudioMedia(
	ensureR2Resolved: (ref: string) => Promise<void>,
	media: StudioR2PrefetchMedia,
): Promise<void> {
	for (const t of Object.keys(media.bgImagesByTemplate)) {
		for (const u of media.bgImagesByTemplate[t] ?? []) {
			if (isR2Ref(u)) await ensureR2Resolved(u);
		}
	}
	for (const u of media.circleImages ?? []) {
		if (isR2Ref(u)) await ensureR2Resolved(u);
	}
	for (const u of media.circle2Images ?? []) {
		if (isR2Ref(u)) await ensureR2Resolved(u);
	}
	for (const u of media.subjectCutouts ?? []) {
		if (isR2Ref(u)) await ensureR2Resolved(u);
	}
	for (const templateKey of Object.keys(media.slideOverlaysByTemplate)) {
		for (const slideRow of media.slideOverlaysByTemplate[templateKey] ?? []) {
			for (const o of slideRow ?? []) {
				const src = String(o?.src ?? '').trim();
				if (isR2Ref(src)) await ensureR2Resolved(src);
			}
		}
	}
}
