/**
 * Local developer overrides for built-in Studio templates (styles / layout / letterbox).
 * Starter copy + media always come from product defaults (`generated-demo-posts` /
 * `*_DEFAULTS`) — pins must not invent a second content default.
 * Production builds ignore these (UI + apply are DEV-only).
 */
import type { TextElementKind, TextStyle, Overlay, TextOverlay } from '$lib/types';
import type { CircleShadow } from './circle-shadow';
import { coerceTemplateId, type TemplateId } from './template-ids';
import type { NewsLayoutDocument } from './news-layout-document';

export type TemplateDevFilmStrip = { topPct: number; bottomPct: number };

export const TEMPLATE_DEV_OVERRIDE_EVENT = 'ssp:template-dev-override';
export const TEMPLATE_DEV_OVERRIDE_STORAGE_PREFIX = 'ssp:template-dev-override:v1:';

export type TemplateDevTextOffset = { x: number; y: number };

export type TemplateDevNewsLayout = {
	circleX: number;
	circleY: number;
	circleSize: number;
	circle2X: number;
	circle2Y: number;
	circle2Size: number;
	bgOffsetX: number;
	bgOffsetY: number;
	bgZoom: number;
	bgFitMode: 'cover' | 'contain';
	bgContainMagnify: number;
	textPanelOffsetY: number;
	shadowHeight: number;
	shadowStrength: number;
	circleBorderColor: string;
	circle2BorderColor: string;
	circleShadow: CircleShadow;
	circle2Shadow: CircleShadow;
	sourceLabelMode?: 'text' | 'logo';
	sourceLogoSrc?: string;
	sourceLogoWidth?: number;
	sourceBorderKind?: 'none' | 'rules' | 'box';
	sourceBorderColor?: string;
};

/** Copy + media used when opening a fresh deck of this template (replaces built-in demo). */
export type TemplateDevStarterContent = {
	slides?: string[];
	newsSubtextBySlide?: string[];
	source?: string;
	sourceLabelMode?: 'text' | 'logo';
	sourceLogoSrc?: string;
	sourceLogoWidth?: number;
	sourceBorderKind?: 'none' | 'rules' | 'box';
	sourceBorderColor?: string;
	bgImages?: string[];
	bgVideos?: string[];
	newsSolidBgBySlide?: string[];
	showCircleBySlide?: boolean[];
	circleImages?: string[];
	showCircle2BySlide?: boolean[];
	circle2Images?: string[];
};

export type TemplateDevOverride = {
	v: 1;
	templateId: TemplateId;
	updatedAt: string;
	enabled: boolean;
	styles?: Partial<Record<TextElementKind, TextStyle>>;
	tweetStyles?: Partial<Record<string, TextStyle>>;
	filmStrip?: TemplateDevFilmStrip;
	textOffsets?: Record<string, TemplateDevTextOffset>;
	textColor?: string;
	canvasBgDark?: boolean;
	highlightColor?: string;
	highlightStyleKind?: 'solid' | 'gradient' | 'pattern';
	highlightGradientFrom?: string;
	highlightGradientTo?: string;
	highlightPattern?: string;
	studioTextHighlightsEnabled?: boolean;
	/** @deprecated Prefer `newsDocument` — kept for older pins. */
	newsLayout?: Partial<TemplateDevNewsLayout>;
	/**
	 * Canonical News structure (roles, present flags, geometry, overlays).
	 * Save-template / account default / generate all read/write this.
	 */
	newsDocument?: NewsLayoutDocument;
	/** Free overlays for any template (Gamma-style: keep stickers when regenerating into a default). */
	textOverlays?: TextOverlay[];
	imageOverlays?: Overlay[];
	starter?: TemplateDevStarterContent;
};

export function isTemplateDevToolsEnabled(): boolean {
	return Boolean(import.meta.env.DEV);
}

function storageKey(id: TemplateId): string {
	return `${TEMPLATE_DEV_OVERRIDE_STORAGE_PREFIX}${id}`;
}

function emitChange(id: TemplateId) {
	if (typeof window === 'undefined') return;
	window.dispatchEvent(new CustomEvent(TEMPLATE_DEV_OVERRIDE_EVENT, { detail: { id } }));
}

export function loadTemplateDevOverride(id: TemplateId): TemplateDevOverride | null {
	if (typeof localStorage === 'undefined') return null;
	try {
		const raw = localStorage.getItem(storageKey(id));
		if (!raw) return null;
		const parsed = JSON.parse(raw) as TemplateDevOverride;
		if (!parsed || parsed.v !== 1) return null;
		if (coerceTemplateId(parsed.templateId) !== id) return null;
		return parsed;
	} catch {
		return null;
	}
}

/** Enabled pin for this template, or null. */
export function loadEnabledTemplateDevOverride(id: TemplateId): TemplateDevOverride | null {
	if (!isTemplateDevToolsEnabled()) return null;
	const ov = loadTemplateDevOverride(id);
	return ov?.enabled ? ov : null;
}

export function saveTemplateDevOverride(next: TemplateDevOverride): void {
	if (typeof localStorage === 'undefined') return;
	const id = coerceTemplateId(next.templateId);
	// Starter media can be multi-MB data URLs — keep that on the account row, not localStorage.
	const { starter: _starter, ...rest } = next;
	const payload: TemplateDevOverride = {
		...rest,
		v: 1,
		templateId: id,
		updatedAt: new Date().toISOString(),
	};
	localStorage.setItem(storageKey(id), JSON.stringify(payload));
	emitChange(id);
}

export function setTemplateDevOverrideEnabled(id: TemplateId, enabled: boolean): void {
	const cur = loadTemplateDevOverride(id);
	if (!cur) return;
	saveTemplateDevOverride({ ...cur, enabled });
}

export function clearTemplateDevOverride(id: TemplateId): void {
	if (typeof localStorage === 'undefined') return;
	localStorage.removeItem(storageKey(id));
	emitChange(id);
}

export function filmStripOverrideFor(id: TemplateId): TemplateDevFilmStrip | null {
	const ov = loadEnabledTemplateDevOverride(id);
	const fs = ov?.filmStrip;
	if (!fs) return null;
	const top = Number(fs.topPct);
	const bottom = Number(fs.bottomPct);
	if (!Number.isFinite(top) || !Number.isFinite(bottom)) return null;
	return { topPct: top, bottomPct: bottom };
}

export function formatTemplateDevOverrideTime(iso: string | undefined): string {
	if (!iso) return '';
	const d = new Date(iso);
	if (Number.isNaN(d.getTime())) return '';
	return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}
