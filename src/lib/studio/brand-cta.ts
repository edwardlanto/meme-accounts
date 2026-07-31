/** Saved follow / CTA slide — reused across Studio carousels. */

export type BrandCtaSettings = {
	/** Background image (data URL, https, or r2: ref resolved client-side). */
	image: string;
	headline: string;
	subline: string;
};

export const DEFAULT_BRAND_CTA: BrandCtaSettings = {
	image: '',
	headline: 'If you like this content',
	subline: 'Follow for more',
};

const STORAGE_PREFIX = 'studio_brand_cta_v1';

export function brandCtaStorageKey(userId: string): string {
	return `${STORAGE_PREFIX}_${userId}`;
}

export function loadBrandCta(userId: string): BrandCtaSettings {
	if (typeof localStorage === 'undefined' || !userId) {
		return { ...DEFAULT_BRAND_CTA };
	}
	try {
		const raw = localStorage.getItem(brandCtaStorageKey(userId));
		if (!raw) return { ...DEFAULT_BRAND_CTA };
		const parsed = JSON.parse(raw) as Partial<BrandCtaSettings>;
		return {
			image: String(parsed.image ?? ''),
			headline: String(parsed.headline ?? DEFAULT_BRAND_CTA.headline),
			subline: String(parsed.subline ?? DEFAULT_BRAND_CTA.subline),
		};
	} catch {
		return { ...DEFAULT_BRAND_CTA };
	}
}

export function saveBrandCta(userId: string, settings: BrandCtaSettings): boolean {
	if (typeof localStorage === 'undefined' || !userId) return false;
	try {
		localStorage.setItem(brandCtaStorageKey(userId), JSON.stringify(settings));
		return true;
	} catch {
		return false;
	}
}
