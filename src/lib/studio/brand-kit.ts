/** Persistent Studio / Bulk brand defaults — fonts, colors, captions, CTA. */

import {
	DEFAULT_BRAND_CTA,
	loadBrandCta,
	saveBrandCta,
	type BrandCtaSettings,
} from './brand-cta';

export type BrandKitSettings = {
	logoUrl: string;
	primaryColor: string;
	accentColor: string;
	textColor: string;
	headlineFont: string;
	bodyFont: string;
	/** Default Studio template for new bulk rows */
	defaultTemplateId: string;
	captionTemplateId: string;
	captionPosition: 'top' | 'center' | 'bottom';
	captionFontSize: number;
	captionColor: string;
	/** New rows start with captions off unless true */
	captionEnabledDefault: boolean;
	cta: BrandCtaSettings;
};

export const DEFAULT_BRAND_KIT: BrandKitSettings = {
	logoUrl: '',
	primaryColor: '#E8C547',
	accentColor: '#95B8F6',
	textColor: '#ffffff',
	headlineFont: 'Bebas Neue',
	bodyFont: 'Montserrat',
	defaultTemplateId: 'news',
	captionTemplateId: 'capcut-pop',
	captionPosition: 'bottom',
	/** Compact default so captions don’t dominate the frame */
	captionFontSize: 28,
	captionColor: '#ffffff',
	/** Captions off unless the user opts in (per slide / brand) */
	captionEnabledDefault: false,
	cta: { ...DEFAULT_BRAND_CTA },
};

const STORAGE_PREFIX = 'studio_brand_kit_v1';

export function brandKitStorageKey(userId: string): string {
	return `${STORAGE_PREFIX}_${userId}`;
}

function normalizeKit(parsed: Partial<BrandKitSettings> | null | undefined, ctaFallback: BrandCtaSettings): BrandKitSettings {
	const pos = parsed?.captionPosition;
	const captionPosition: BrandKitSettings['captionPosition'] =
		pos === 'top' || pos === 'center' || pos === 'bottom' ? pos : DEFAULT_BRAND_KIT.captionPosition;
	const fontSize = Number(parsed?.captionFontSize);
	return {
		logoUrl: String(parsed?.logoUrl ?? ''),
		primaryColor: String(parsed?.primaryColor ?? DEFAULT_BRAND_KIT.primaryColor),
		accentColor: String(parsed?.accentColor ?? DEFAULT_BRAND_KIT.accentColor),
		textColor: String(parsed?.textColor ?? DEFAULT_BRAND_KIT.textColor),
		headlineFont: String(parsed?.headlineFont ?? DEFAULT_BRAND_KIT.headlineFont),
		bodyFont: String(parsed?.bodyFont ?? DEFAULT_BRAND_KIT.bodyFont),
		defaultTemplateId: String(parsed?.defaultTemplateId ?? DEFAULT_BRAND_KIT.defaultTemplateId),
		captionTemplateId: String(parsed?.captionTemplateId ?? DEFAULT_BRAND_KIT.captionTemplateId),
		captionPosition,
		captionFontSize: Number.isFinite(fontSize) && fontSize > 0 ? Math.round(fontSize) : DEFAULT_BRAND_KIT.captionFontSize,
		captionColor: String(parsed?.captionColor ?? DEFAULT_BRAND_KIT.captionColor),
		captionEnabledDefault: parsed?.captionEnabledDefault === true,
		cta: {
			image: String(parsed?.cta?.image ?? ctaFallback.image),
			headline: String(parsed?.cta?.headline ?? ctaFallback.headline),
			subline: String(parsed?.cta?.subline ?? ctaFallback.subline),
		},
	};
}

export function loadBrandKit(userId: string): BrandKitSettings {
	const ctaFallback = loadBrandCta(userId);
	if (typeof localStorage === 'undefined' || !userId) {
		return normalizeKit(null, ctaFallback);
	}
	try {
		const raw = localStorage.getItem(brandKitStorageKey(userId));
		if (!raw) {
			return normalizeKit(null, ctaFallback);
		}
		const parsed = JSON.parse(raw) as Partial<BrandKitSettings>;
		return normalizeKit(parsed, ctaFallback);
	} catch {
		return normalizeKit(null, ctaFallback);
	}
}

export function saveBrandKit(userId: string, settings: BrandKitSettings): boolean {
	if (typeof localStorage === 'undefined' || !userId) return false;
	try {
		const normalized = normalizeKit(settings, settings.cta ?? DEFAULT_BRAND_CTA);
		localStorage.setItem(brandKitStorageKey(userId), JSON.stringify(normalized));
		// Keep legacy CTA key in sync for Studio Brand CTA panel
		saveBrandCta(userId, normalized.cta);
		return true;
	} catch {
		return false;
	}
}

/** Patch caption fields onto an existing kit (Bulk “Save as brand caption defaults”). */
export function mergeCaptionDefaultsIntoKit(
	kit: BrandKitSettings,
	patch: Partial<Pick<BrandKitSettings, 'captionTemplateId' | 'captionPosition' | 'captionFontSize' | 'captionColor'>>,
): BrandKitSettings {
	return normalizeKit({ ...kit, ...patch }, kit.cta);
}
