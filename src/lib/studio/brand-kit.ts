/** Persistent Studio / Bulk brand defaults — fonts, colors, captions, CTA. */

import {
	normalizeHighlightPatternName,
	type StudioHighlightStyleKind,
} from '$lib/highlight';
import {
	DEFAULT_BRAND_CTA,
	loadBrandCta,
	saveBrandCta,
	type BrandCtaSettings,
} from './brand-cta';
import { supabase } from '$lib/supabase';

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
	/**
	 * When true, Bulk previews show `[[…]]` word highlights on News headlines
	 * (and other layouts that parse markup). Default on.
	 */
	textHighlightsEnabled: boolean;
	/** Default `[[word]]` highlight paint used in Studio. */
	highlightColor: string;
	/** Solid color vs image fill for bare `[[word]]` marks. */
	highlightStyleKind: StudioHighlightStyleKind;
	/** Pattern name from `AVAILABLE_PATTERNS` when `highlightStyleKind` is `pattern`. */
	highlightPattern: string;
	/** Gradient endpoints when `highlightStyleKind` is `gradient`. */
	highlightGradientFrom: string;
	highlightGradientTo: string;
	/** Default chip / block fill behind brand text. Empty = none. */
	textBgColor: string;
	/** On-slide display name (Text Carousel, Creator hook, …). */
	displayName: string;
	/** On-slide handle, with or without `@`. */
	handle: string;
	/** News branding uses logo only; kept for older saved kits. */
	sourceLabelMode: 'text' | 'logo';
	sourceLogoWidth: number;
	sourceBorderKind: 'none' | 'rules' | 'box';
	sourceBorderColor: string;
	/** Last drag position for the News logo (template px). */
	sourceOffsetX: number;
	sourceOffsetY: number;
	/** True after the user finishes the identity onboarding sheet. */
	onboardingComplete: boolean;
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
	/** Word highlights on for News-style big text by default */
	textHighlightsEnabled: true,
	highlightColor: '#F5A623',
	highlightStyleKind: 'solid',
	highlightPattern: 'light-blue',
	highlightGradientFrom: '#FFFFFF',
	highlightGradientTo: '#F5A623',
	textBgColor: '',
	displayName: '',
	handle: '',
	sourceLabelMode: 'logo',
	sourceLogoWidth: 260,
	sourceBorderKind: 'none',
	sourceBorderColor: '',
	sourceOffsetX: 0,
	sourceOffsetY: 0,
	onboardingComplete: false,
	cta: { ...DEFAULT_BRAND_CTA },
};

export const BRAND_KIT_UPDATED_EVENT = 'ssp:brand-kit-updated';

/** `drafts.kind` row that stores the account brand kit (survives reload / devices). */
export const STUDIO_BRAND_KIT_KIND = 'studio_brand_kit';

export function emitBrandKitUpdated(kit: BrandKitSettings) {
	if (typeof window === 'undefined') return;
	window.dispatchEvent(new CustomEvent(BRAND_KIT_UPDATED_EVENT, { detail: kit }));
}

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
		textHighlightsEnabled: parsed?.textHighlightsEnabled !== false,
		highlightColor: normalizeHighlightHex(
			String(parsed?.highlightColor ?? DEFAULT_BRAND_KIT.highlightColor),
			DEFAULT_BRAND_KIT.highlightColor,
		),
		highlightStyleKind: normalizeHighlightStyleKind(parsed?.highlightStyleKind),
		highlightPattern: normalizeHighlightPatternName(
			String(parsed?.highlightPattern ?? DEFAULT_BRAND_KIT.highlightPattern),
			DEFAULT_BRAND_KIT.highlightPattern,
		),
		highlightGradientFrom: normalizeHighlightHex(
			String(parsed?.highlightGradientFrom ?? DEFAULT_BRAND_KIT.highlightGradientFrom),
			DEFAULT_BRAND_KIT.highlightGradientFrom,
		),
		highlightGradientTo: normalizeHighlightHex(
			String(parsed?.highlightGradientTo ?? DEFAULT_BRAND_KIT.highlightGradientTo),
			DEFAULT_BRAND_KIT.highlightGradientTo,
		),
		textBgColor: normalizeTextBgHex(String(parsed?.textBgColor ?? DEFAULT_BRAND_KIT.textBgColor)),
		displayName: String(parsed?.displayName ?? DEFAULT_BRAND_KIT.displayName),
		handle: normalizeBrandHandle(String(parsed?.handle ?? DEFAULT_BRAND_KIT.handle)),
		sourceLabelMode: parsed?.sourceLabelMode === 'text' && !String(parsed?.logoUrl ?? '').trim()
			? 'text'
			: 'logo',
		sourceLogoWidth: (() => {
			const w = Number(parsed?.sourceLogoWidth);
			return Number.isFinite(w) ? Math.round(Math.max(80, Math.min(400, w))) : DEFAULT_BRAND_KIT.sourceLogoWidth;
		})(),
		sourceBorderKind:
			parsed?.sourceBorderKind === 'rules' || parsed?.sourceBorderKind === 'box'
				? parsed.sourceBorderKind
				: 'none',
		sourceBorderColor: String(parsed?.sourceBorderColor ?? ''),
		sourceOffsetX: (() => {
			const x = Number(parsed?.sourceOffsetX);
			return Number.isFinite(x) ? Math.round(x) : 0;
		})(),
		sourceOffsetY: (() => {
			const y = Number(parsed?.sourceOffsetY);
			return Number.isFinite(y) ? Math.round(y) : 0;
		})(),
		onboardingComplete: parsed?.onboardingComplete === true,
		cta: {
			image: String(parsed?.cta?.image ?? ctaFallback.image),
			headline: String(parsed?.cta?.headline ?? ctaFallback.headline),
			subline: String(parsed?.cta?.subline ?? ctaFallback.subline),
		},
	};
}

function writeLocalBrandKit(userId: string, kit: BrandKitSettings): void {
	if (typeof localStorage === 'undefined' || !userId) return;
	localStorage.setItem(brandKitStorageKey(userId), JSON.stringify(kit));
	saveBrandCta(userId, kit.cta);
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

const remotePersistTimers = new Map<string, ReturnType<typeof setTimeout>>();
const remotePersistInFlight = new Map<string, Promise<void>>();

/** Upsert brand kit into `drafts` (kind = studio_brand_kit). */
export async function persistBrandKitRemote(userId: string, settings: BrandKitSettings): Promise<void> {
	if (!userId) return;
	const kit = normalizeKit(settings, settings.cta ?? DEFAULT_BRAND_CTA);
	const pending = remotePersistInFlight.get(userId);
	if (pending) await pending.catch(() => {});

	const run = (async () => {
		const { data: existing, error: findErr } = await (supabase as any)
			.from('drafts')
			.select('id')
			.eq('user_id', userId)
			.eq('kind', STUDIO_BRAND_KIT_KIND)
			.limit(1)
			.maybeSingle();
		if (findErr) {
			console.warn('[brand-kit] remote find failed', findErr.message);
			return;
		}
		if (existing?.id) {
			const { error } = await (supabase as any)
				.from('drafts')
				.update({ state: kit })
				.eq('id', existing.id)
				.eq('user_id', userId)
				.eq('kind', STUDIO_BRAND_KIT_KIND);
			if (error) console.warn('[brand-kit] remote update failed', error.message);
			return;
		}
		const { error } = await (supabase as any).from('drafts').insert({
			user_id: userId,
			kind: STUDIO_BRAND_KIT_KIND,
			state: kit,
		});
		if (error) console.warn('[brand-kit] remote insert failed', error.message);
	})();

	remotePersistInFlight.set(userId, run);
	try {
		await run;
	} finally {
		if (remotePersistInFlight.get(userId) === run) remotePersistInFlight.delete(userId);
	}
}

function scheduleBrandKitRemotePersist(userId: string, settings: BrandKitSettings) {
	const prev = remotePersistTimers.get(userId);
	if (prev) clearTimeout(prev);
	remotePersistTimers.set(
		userId,
		setTimeout(() => {
			remotePersistTimers.delete(userId);
			void persistBrandKitRemote(userId, settings);
		}, 400),
	);
}

/**
 * Write brand kit to localStorage immediately and debounce a DB upsert
 * so highlights / name / colors survive reload and other devices.
 */
export function saveBrandKit(userId: string, settings: BrandKitSettings): boolean {
	if (typeof localStorage === 'undefined' || !userId) return false;
	try {
		const normalized = normalizeKit(settings, settings.cta ?? DEFAULT_BRAND_CTA);
		writeLocalBrandKit(userId, normalized);
		emitBrandKitUpdated(normalized);
		scheduleBrandKitRemotePersist(userId, normalized);
		return true;
	} catch {
		return false;
	}
}

/**
 * Load brand kit from DB (source of truth), refresh localStorage, emit update.
 * If no remote row yet, uploads the current local kit once.
 */
export async function hydrateBrandKit(userId: string): Promise<BrandKitSettings> {
	const local = loadBrandKit(userId);
	if (!userId) return local;
	try {
		const { data, error } = await (supabase as any)
			.from('drafts')
			.select('state')
			.eq('user_id', userId)
			.eq('kind', STUDIO_BRAND_KIT_KIND)
			.limit(1)
			.maybeSingle();
		if (error) {
			console.warn('[brand-kit] hydrate failed', error.message);
			return local;
		}
		const raw = data?.state as Partial<BrandKitSettings> | null | undefined;
		if (raw && typeof raw === 'object') {
			const remote = normalizeKit(raw, {
				image: String(raw.cta?.image ?? local.cta.image),
				headline: String(raw.cta?.headline ?? local.cta.headline),
				subline: String(raw.cta?.subline ?? local.cta.subline),
			});
			writeLocalBrandKit(userId, remote);
			emitBrandKitUpdated(remote);
			return remote;
		}
		// First time: seed DB from whatever is already in localStorage.
		await persistBrandKitRemote(userId, local);
		return local;
	} catch (e) {
		console.warn('[brand-kit] hydrate error', e);
		return local;
	}
}

/** Empty / transparent clears the brand text background. */
export function normalizeTextBgHex(raw: string): string {
	const s = String(raw ?? '').trim();
	if (!s || s === 'transparent' || s === 'none') return '';
	return normalizeHighlightHex(s, '');
}

export function normalizeHighlightStyleKind(raw: unknown): StudioHighlightStyleKind {
	return raw === 'pattern' || raw === 'gradient' ? raw : 'solid';
}

/** Build Studio/News `[[…]]` defaults from the saved brand kit. */
export function highlightDefaultsFromBrandKit(kit: BrandKitSettings): {
	color: string;
	gradientFrom?: string;
	gradientTo?: string;
	pattern?: string;
} {
	const color = normalizeHighlightHex(kit.highlightColor, DEFAULT_BRAND_KIT.highlightColor);
	const kind = normalizeHighlightStyleKind(kit.highlightStyleKind);
	if (kind === 'gradient') {
		const from = normalizeHighlightHex(
			kit.highlightGradientFrom,
			DEFAULT_BRAND_KIT.highlightGradientFrom,
		);
		const to = normalizeHighlightHex(
			kit.highlightGradientTo,
			DEFAULT_BRAND_KIT.highlightGradientTo,
		);
		return { color: from, gradientFrom: from, gradientTo: to };
	}
	if (kind === 'pattern') {
		const pattern =
			normalizeHighlightPatternName(kit.highlightPattern) ||
			DEFAULT_BRAND_KIT.highlightPattern;
		return { color, pattern };
	}
	return { color };
}

export function normalizeHighlightHex(raw: string, fallback = DEFAULT_BRAND_KIT.highlightColor): string {
	const s = String(raw ?? '').trim();
	if (/^#[0-9A-Fa-f]{6}$/.test(s)) return s.toUpperCase();
	if (/^#[0-9A-Fa-f]{3}$/.test(s)) {
		const r = s[1];
		const g = s[2];
		const b = s[3];
		return `#${r}${r}${g}${g}${b}${b}`.toUpperCase();
	}
	return fallback;
}

export function normalizeBrandHandle(raw: string): string {
	const s = String(raw ?? '').trim();
	if (!s) return '';
	return s.startsWith('@') ? s : `@${s.replace(/^@+/, '')}`;
}

/** Resolved name + handle for templates that show a profile row. */
export function brandProfile(kit: BrandKitSettings | null | undefined): { name: string; handle: string } {
	const name = String(kit?.displayName ?? '').trim();
	const handle = normalizeBrandHandle(String(kit?.handle ?? ''));
	return { name, handle };
}

/** News source-line label — username, never the old “Markets” stock tag. */
export function newsSourceFromBrand(kit: BrandKitSettings | null | undefined): string {
	return brandProfile(kit).name;
}

export function isPlaceholderNewsSource(source: string): boolean {
	const s = String(source ?? '').trim().toLowerCase();
	if (!s || s === 'markets' || s === 'news' || s === 'your name') return true;
	// Category / mode tags that used to leak into the byline on generate.
	return (
		s === 'tech' ||
		s === 'finance' ||
		s === 'politics' ||
		s === 'health' ||
		s === 'science' ||
		s === 'sports' ||
		s === 'culture' ||
		s === 'did you know' ||
		s === 'quotes' ||
		s === 'steps' ||
		s === 'story' ||
		s === 'general'
	);
}

const DEMO_PROFILE_NAMES = new Set(
	[
		'Signal Over Noise',
		'Lena Ortiz',
		'Revenue Lab',
		'Late Night Ops',
		'Ava & Marcus Chen',
		'archive hours',
		'Captains of industry',
	].map((s) => s.toLowerCase()),
);

const DEMO_PROFILE_HANDLES = new Set(
	[
		'@signalovernoise',
		'@lenabuilds',
		'@revenuelab',
		'@latenightops',
		'@avaandmarcus',
		'@archivehours',
		'@captainsofindustryy',
	].map((s) => s.toLowerCase()),
);

/** True when the slide still has a stock demo name (safe to replace with brand identity). */
export function isPlaceholderProfileName(name: string): boolean {
	const n = String(name ?? '').trim();
	return !n || DEMO_PROFILE_NAMES.has(n.toLowerCase());
}

export function isPlaceholderProfileHandle(handle: string): boolean {
	const h = normalizeBrandHandle(handle);
	return !h || DEMO_PROFILE_HANDLES.has(h.toLowerCase());
}

/** Patch caption fields onto an existing kit (Bulk “Save as brand caption defaults”). */
export function mergeCaptionDefaultsIntoKit(
	kit: BrandKitSettings,
	patch: Partial<Pick<BrandKitSettings, 'captionTemplateId' | 'captionPosition' | 'captionFontSize' | 'captionColor'>>,
): BrandKitSettings {
	return normalizeKit({ ...kit, ...patch }, kit.cta);
}
