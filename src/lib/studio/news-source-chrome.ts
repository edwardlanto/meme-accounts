/**
 * Resolve News source logo chrome (URL, size, plate, drag offsets)
 * from brand kit + optional Studio account template override.
 * Shared by Studio restore helpers and Bulk previews.
 */
import { r2SignRead } from '$lib/r2Client';
import type { BrandKitSettings } from './brand-kit';
import {
	parseNewsLayoutDocument,
	type NewsLayoutDocument,
} from './news-layout-document';
import { isR2Ref, r2KeyFromRef } from './r2-media-resolve';
import type { TemplateDevOverride } from './template-dev-override';

export type NewsSourceChrome = {
	sourceLogoSrc: string;
	sourceLogoWidth: number;
	sourceLogoPlateColor: string;
	sourceOffsetX: number;
	sourceOffsetY: number;
	sourceLabel: string;
	sourceBorderKind: 'none' | 'rules' | 'box';
	sourceBorderColor: string;
};

function clampLogoWidth(raw: unknown, fallback = 140): number {
	const w = Number(raw);
	if (!Number.isFinite(w) || w <= 0) return fallback;
	return Math.round(Math.max(80, Math.min(400, w)));
}

function clampOffset(raw: unknown): number {
	const n = Number(raw);
	return Number.isFinite(n) ? Math.round(n) : 0;
}

/** True when the browser can paint the URL without an R2 sign step. */
function isDisplayableMediaUrl(u: string): boolean {
	const s = String(u ?? '').trim();
	return (
		s.startsWith('data:') ||
		s.startsWith('blob:') ||
		s.startsWith('http://') ||
		s.startsWith('https://') ||
		s.startsWith('/')
	);
}

export function newsSourceChromeFromBrandKit(kit: BrandKitSettings): NewsSourceChrome {
	return {
		/* Default News is logoless — brand `logoUrl` is for avatars / explicit Add logo. */
		sourceLogoSrc: '',
		sourceLogoWidth: clampLogoWidth(kit.sourceLogoWidth, 140),
		sourceLogoPlateColor: String(
			(kit as { sourceLogoPlateColor?: string }).sourceLogoPlateColor ?? '',
		).trim(),
		sourceOffsetX: clampOffset(kit.sourceOffsetX),
		sourceOffsetY: clampOffset(kit.sourceOffsetY),
		sourceLabel: String(kit.displayName ?? '').trim(),
		sourceBorderKind:
			kit.sourceBorderKind === 'rules' || kit.sourceBorderKind === 'box'
				? kit.sourceBorderKind
				: 'none',
		sourceBorderColor: String(kit.sourceBorderColor ?? '').trim() || '#ffffff',
	};
}

function chromeFromNewsDocument(
	doc: NewsLayoutDocument,
	fallback: NewsSourceChrome,
): NewsSourceChrome {
	const layout = doc.layout;
	const off = doc.offsets?.source;
	return {
		sourceLogoSrc: pickLogoSrc(layout.sourceLogoSrc, fallback.sourceLogoSrc),
		sourceLogoWidth: clampLogoWidth(layout.sourceLogoWidth, fallback.sourceLogoWidth),
		sourceLogoPlateColor:
			String(layout.sourceLogoPlateColor ?? '').trim() || fallback.sourceLogoPlateColor,
		sourceOffsetX: off ? clampOffset(off.x) : fallback.sourceOffsetX,
		sourceOffsetY: off ? clampOffset(off.y) : fallback.sourceOffsetY,
		sourceLabel: fallback.sourceLabel,
		sourceBorderKind:
			layout.sourceBorderKind === 'rules' || layout.sourceBorderKind === 'box'
				? layout.sourceBorderKind
				: layout.sourceBorderKind === 'none'
					? 'none'
					: fallback.sourceBorderKind,
		sourceBorderColor:
			String(layout.sourceBorderColor ?? '').trim() || fallback.sourceBorderColor,
	};
}

/**
 * Prefer a paint-ready URL over an unresolved `r2:` ref so Bulk doesn’t wipe a
 * hydrated brand-kit logo with an account-override key that still needs signing.
 */
function pickLogoSrc(candidate: unknown, fallback: string): string {
	if (candidate === undefined || candidate === null) return fallback;
	const next = String(candidate).trim();
	/* Explicit empty means the logo was removed — do not fall back to the brand kit. */
	if (!next) return '';
	if (isR2Ref(next) && isDisplayableMediaUrl(fallback)) return fallback;
	return next;
}

/**
 * Prefer account News override (logo move / size / plate), else brand kit.
 * Also reads top-level `textOffsets.source` and `starter` from older pins.
 */
export function resolveNewsSourceChrome(
	kit: BrandKitSettings,
	override?: TemplateDevOverride | null,
): NewsSourceChrome {
	const base = newsSourceChromeFromBrandKit(kit);
	if (!override || coerceNewsOverride(override) === null) return base;

	const ov = override;
	const doc = parseNewsLayoutDocument(ov.newsDocument);
	let next = doc ? chromeFromNewsDocument(doc, base) : { ...base };

	const starter = ov.starter;
	if (starter) {
		const logo = String(starter.sourceLogoSrc ?? '').trim();
		if (logo) next.sourceLogoSrc = pickLogoSrc(logo, next.sourceLogoSrc);
		if (typeof starter.sourceLogoWidth === 'number') {
			next.sourceLogoWidth = clampLogoWidth(starter.sourceLogoWidth, next.sourceLogoWidth);
		}
		if (typeof starter.sourceLogoPlateColor === 'string') {
			const plate = starter.sourceLogoPlateColor.trim();
			if (plate) next.sourceLogoPlateColor = plate;
		}
		if (
			starter.sourceBorderKind === 'none' ||
			starter.sourceBorderKind === 'rules' ||
			starter.sourceBorderKind === 'box'
		) {
			next.sourceBorderKind = starter.sourceBorderKind;
		}
		if (typeof starter.sourceBorderColor === 'string' && starter.sourceBorderColor.trim()) {
			next.sourceBorderColor = starter.sourceBorderColor.trim();
		}
	}

	const layout = ov.newsLayout;
	if (layout) {
		const logo = String(layout.sourceLogoSrc ?? '').trim();
		if (logo) next.sourceLogoSrc = pickLogoSrc(logo, next.sourceLogoSrc);
		if (typeof layout.sourceLogoWidth === 'number') {
			next.sourceLogoWidth = clampLogoWidth(layout.sourceLogoWidth, next.sourceLogoWidth);
		}
		if (typeof layout.sourceLogoPlateColor === 'string') {
			const plate = layout.sourceLogoPlateColor.trim();
			if (plate) next.sourceLogoPlateColor = plate;
		}
	}

	const textOff = ov.textOffsets?.source;
	if (textOff && (Number.isFinite(textOff.x) || Number.isFinite(textOff.y))) {
		next.sourceOffsetX = clampOffset(textOff.x);
		next.sourceOffsetY = clampOffset(textOff.y);
	}

	return next;
}

function coerceNewsOverride(ov: TemplateDevOverride): TemplateDevOverride | null {
	if (!ov || ov.v !== 1) return null;
	if (String(ov.templateId ?? '') !== 'news') return null;
	if (ov.enabled === false) return null;
	return ov;
}

/** Flat textOffsets map for NewsTemplate (`source` key, not `news:source`). */
export function newsSourceTextOffsets(chrome: NewsSourceChrome): Record<string, { x: number; y: number }> {
	return {
		source: { x: chrome.sourceOffsetX, y: chrome.sourceOffsetY },
	};
}

/** Sign any `r2:` logo so Bulk / Studio previews can paint it. */
export async function resolveNewsSourceChromeMedia(
	chrome: NewsSourceChrome,
): Promise<NewsSourceChrome> {
	const src = String(chrome.sourceLogoSrc ?? '').trim();
	if (!isR2Ref(src)) return chrome;
	const key = r2KeyFromRef(src);
	if (!key) return { ...chrome, sourceLogoSrc: '' };
	try {
		const { url } = await r2SignRead({ key });
		const signed = String(url ?? '').trim();
		return signed ? { ...chrome, sourceLogoSrc: signed } : chrome;
	} catch {
		return chrome;
	}
}
