/**
 * Image sticker overlays for Bulk News previews — pulled from account News
 * override and/or a saved Studio template draft, with R2 refs signed for display.
 */
import { r2SignRead } from '$lib/r2Client';
import type { Overlay } from '$lib/types';
import { parseNewsLayoutDocument } from './news-layout-document';
import { isR2Ref, r2KeyFromRef } from './r2-media-resolve';
import type { TemplateDevOverride } from './template-dev-override';

function clampNum(raw: unknown, fallback: number): number {
	const n = Number(raw);
	return Number.isFinite(n) ? n : fallback;
}

export function normalizeImageOverlay(raw: unknown): Overlay | null {
	if (!raw || typeof raw !== 'object') return null;
	const o = raw as Record<string, unknown>;
	const src = String(o.src ?? '').trim();
	const id = String(o.id ?? '').trim();
	if (!src || !id) return null;
	const kind = o.kind === 'grid' ? 'grid' : 'image';
	return {
		id,
		src,
		kind,
		x: clampNum(o.x, 0),
		y: clampNum(o.y, 0),
		w: clampNum(o.w, 120),
		h: clampNum(o.h, 120),
		...(typeof o.tile === 'number' ? { tile: o.tile } : {}),
		...(typeof o.opacity === 'number' ? { opacity: o.opacity } : {}),
		...(typeof o.borderRadius === 'number' ? { borderRadius: o.borderRadius } : {}),
		...(typeof o.bgColor === 'string' ? { bgColor: o.bgColor } : {}),
		...(typeof o.padding === 'number' ? { padding: o.padding } : {}),
	};
}

export function normalizeImageOverlays(raw: unknown): Overlay[] {
	if (!Array.isArray(raw)) return [];
	return raw.map(normalizeImageOverlay).filter((o): o is Overlay => !!o);
}

/** Stickers pinned on the account News default (single slide chrome). */
export function imageOverlaysFromNewsOverride(override?: TemplateDevOverride | null): Overlay[] {
	if (!override || override.v !== 1) return [];
	if (String(override.templateId ?? '') !== 'news') return [];
	if (override.enabled === false) return [];

	const fromTop = normalizeImageOverlays(override.imageOverlays);
	if (fromTop.length) return fromTop;

	const doc = parseNewsLayoutDocument(override.newsDocument);
	if (doc?.imageOverlays?.length) return normalizeImageOverlays(doc.imageOverlays);

	return [];
}

/**
 * Per-slide stickers from a saved Studio draft (`slideOverlaysByTemplate.news`).
 * Falls back to top-level / newsDocument overlays as a single shared row.
 */
export function imageOverlaysBySlideFromSavedDraft(
	state: Record<string, unknown> | null | undefined,
): Overlay[][] {
	if (!state || typeof state !== 'object') return [];

	const byTpl = state.slideOverlaysByTemplate as Record<string, unknown> | undefined;
	const newsRows = byTpl?.news;
	if (Array.isArray(newsRows) && newsRows.length) {
		return newsRows.map((row) => normalizeImageOverlays(row));
	}

	const top = normalizeImageOverlays(state.imageOverlays);
	if (top.length) return [top];

	const docOverlays = normalizeImageOverlays(
		(state.newsDocument as { imageOverlays?: unknown } | undefined)?.imageOverlays,
	);
	return docOverlays.length ? [docOverlays] : [];
}

async function resolveOverlaySrc(src: string): Promise<string> {
	const s = String(src ?? '').trim();
	if (!isR2Ref(s)) return s;
	const key = r2KeyFromRef(s);
	if (!key) return '';
	try {
		const { url } = await r2SignRead({ key });
		return String(url ?? '').trim() || '';
	} catch {
		return '';
	}
}

/** Sign every overlay `r2:` src (mutates copies). */
export async function resolveImageOverlaysMedia(overlays: Overlay[]): Promise<Overlay[]> {
	if (!overlays.length) return [];
	const out: Overlay[] = [];
	for (const o of overlays) {
		const src = await resolveOverlaySrc(o.src);
		if (!src) continue;
		out.push({ ...o, src });
	}
	return out;
}

export async function resolveImageOverlaysBySlideMedia(
	rows: Overlay[][],
): Promise<Overlay[][]> {
	const out: Overlay[][] = [];
	for (const row of rows) {
		out.push(await resolveImageOverlaysMedia(row));
	}
	return out;
}

/** Pick stickers for slide index — reuse slide 0 when later rows are empty. */
export function imageOverlaysForSlide(rows: Overlay[][], slideIndex: number): Overlay[] {
	if (!rows.length) return [];
	const i = Math.max(0, Math.floor(slideIndex));
	const row = rows[i] ?? [];
	if (row.length) return row;
	return rows[0] ?? [];
}
