/**
 * Keep Supabase draft JSON small: store media in R2 (`r2:…` refs), not base64 blobs in Postgres.
 */

function isEmbeddedMediaUrl(u: unknown): boolean {
	if (typeof u !== 'string') return false;
	const s = u.trim();
	return s.startsWith('data:') || s.startsWith('blob:');
}

function stripMediaUrl(u: unknown): string {
	if (typeof u !== 'string') return '';
	const s = u.trim();
	if (!s || isEmbeddedMediaUrl(s)) return '';
	return s;
}

function stripStringArray(arr: unknown): string[] {
	if (!Array.isArray(arr)) return [];
	return arr.map(stripMediaUrl);
}

function stripMediaMap(m: unknown): Record<string, string[]> {
	if (!m || typeof m !== 'object') return {};
	return Object.fromEntries(
		Object.entries(m as Record<string, unknown>).map(([k, arr]) => [
			k,
			Array.isArray(arr) ? stripStringArray(arr) : [],
		]),
	);
}

function stripOverlayRows(rows: unknown): unknown[] {
	if (!Array.isArray(rows)) return [];
	return rows.map((slideRow) => {
		if (!Array.isArray(slideRow)) return slideRow;
		return slideRow.map((overlay) => {
			if (!overlay || typeof overlay !== 'object') return overlay;
			const o = { ...(overlay as Record<string, unknown>) };
			if ('src' in o) o.src = stripMediaUrl(o.src);
			return o;
		});
	});
}

function stripOverlayMap(m: unknown): Record<string, unknown> {
	if (!m || typeof m !== 'object') return {};
	return Object.fromEntries(
		Object.entries(m as Record<string, unknown>).map(([k, rows]) => [k, stripOverlayRows(rows)]),
	);
}

/** Remove embedded image blobs from a draft/template state object before Postgres write. */
export function stripEmbeddedMediaFromDraftState<T extends Record<string, unknown>>(state: T): T {
	const out = { ...state } as Record<string, unknown>;

	if ('bgImagesByTemplate' in out) out.bgImagesByTemplate = stripMediaMap(out.bgImagesByTemplate);
	if ('bgVideosByTemplate' in out) out.bgVideosByTemplate = stripMediaMap(out.bgVideosByTemplate);
	if ('circleImages' in out) out.circleImages = stripStringArray(out.circleImages);
	if ('circle2Images' in out) out.circle2Images = stripStringArray(out.circle2Images);
	if ('subjectCutouts' in out) out.subjectCutouts = stripStringArray(out.subjectCutouts);
	if ('tweetTopAvatarImageBySlide' in out) {
		out.tweetTopAvatarImageBySlide = stripStringArray(out.tweetTopAvatarImageBySlide);
	}
	if ('tweetBottomAvatarImageBySlide' in out) {
		out.tweetBottomAvatarImageBySlide = stripStringArray(out.tweetBottomAvatarImageBySlide);
	}
	if ('textCarouselAvatarImageBySlide' in out) {
		out.textCarouselAvatarImageBySlide = stripStringArray(out.textCarouselAvatarImageBySlide);
	}
	if ('articleLogoSrcBySlide' in out) out.articleLogoSrcBySlide = stripStringArray(out.articleLogoSrcBySlide);
	if ('brandStackBottomMediaBySlide' in out) {
		out.brandStackBottomMediaBySlide = stripStringArray(out.brandStackBottomMediaBySlide);
	}
	if ('sourceLogoSrc' in out) out.sourceLogoSrc = stripMediaUrl(out.sourceLogoSrc);
	if ('slideOverlaysByTemplate' in out) {
		out.slideOverlaysByTemplate = stripOverlayMap(out.slideOverlaysByTemplate);
	}

	// Legacy export blobs — never persist (re-export when needed).
	out.exportedSlides = [];

	return out as T;
}

/** Rough JSON byte size for diagnostics. */
export function draftStateByteSize(state: unknown): number {
	try {
		return new TextEncoder().encode(JSON.stringify(state ?? {})).length;
	} catch {
		return 0;
	}
}

/** True when state still embeds base64 media (Postgres bloat risk). */
export function draftStateHasEmbeddedMedia(state: unknown): boolean {
	try {
		const json = JSON.stringify(state ?? {});
		return json.includes('"data:image') || json.includes('"data:video');
	} catch {
		return false;
	}
}
