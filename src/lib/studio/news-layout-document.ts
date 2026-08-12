/**
 * Canonical News canvas structure (Gamma-style).
 *
 * Roles + present flags + recipe + geometry + overlays.
 * Content (headline/subtext copy) fills slots; moving/adding/deleting
 * updates this document and generate must not wipe it.
 */
import type { Overlay, TextElementKind, TextOverlay, TextStyle } from '$lib/types';
import type { CircleShadow } from './circle-shadow';
import { DEFAULT_CIRCLE_SHADOW, normalizeCircleShadow } from './circle-shadow';
import { NEWS_DEFAULT_LAYOUT } from './slide-content-defaults';

export const NEWS_LAYOUT_DOCUMENT_KIND = 'news_layout' as const;

export type NewsLayoutRecipe =
	| 'default'
	| 'tight-stack'
	| 'airy'
	| 'logo-above'
	| 'custom';

/** Which News chrome slots exist on this slide. */
export type NewsPresent = {
	headline: boolean;
	subtext: boolean;
	source: boolean;
	circle: boolean;
	circle2: boolean;
	shadow: boolean;
};

export type NewsSlotOffset = { x: number; y: number };

export type NewsSlotOffsets = Partial<
	Record<'headline' | 'newsSubtext' | 'source', NewsSlotOffset>
>;

export type NewsLayoutGeometry = {
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
	sourceLabelMode: 'text' | 'logo';
	sourceLogoSrc: string;
	sourceLogoWidth: number;
	sourceBorderKind: 'none' | 'rules' | 'box';
	sourceBorderColor: string;
};

export type NewsHighlightChrome = {
	highlightColor: string;
	highlightStyleKind: 'solid' | 'gradient' | 'pattern';
	highlightGradientFrom: string;
	highlightGradientTo: string;
	highlightPattern: string;
	studioTextHighlightsEnabled: boolean;
};

/** Soft capacity for generate-to-fit (not pixel-perfect DOM measure yet). */
export type NewsSlotBudgets = {
	headlineMaxWords: number;
	subtextMaxChars: number;
};

export type NewsLayoutDocument = {
	v: 1;
	kind: typeof NEWS_LAYOUT_DOCUMENT_KIND;
	recipe: NewsLayoutRecipe;
	present: NewsPresent;
	layout: NewsLayoutGeometry;
	/** Draggable slot offsets in template px (updates when user moves elements). */
	offsets: NewsSlotOffsets;
	styles: Partial<Record<TextElementKind, TextStyle>>;
	textOverlays: TextOverlay[];
	imageOverlays: Overlay[];
	textColor: string;
	canvasBgDark: boolean;
	highlights: NewsHighlightChrome;
	/** Copy budgets for slot fill — generate should respect these. */
	slotBudgets: NewsSlotBudgets;
	updatedAt: string;
};

export type NewsLayoutCaptureInput = {
	present?: Partial<NewsPresent>;
	layout: Partial<NewsLayoutGeometry> & {
		circleBorderColor?: string;
		circle2BorderColor?: string;
	};
	offsets?: NewsSlotOffsets;
	styles?: Partial<Record<TextElementKind, TextStyle>>;
	textOverlays?: TextOverlay[];
	imageOverlays?: Overlay[];
	textColor?: string;
	canvasBgDark?: boolean;
	highlights?: Partial<NewsHighlightChrome>;
	slotBudgets?: Partial<NewsSlotBudgets>;
	recipe?: NewsLayoutRecipe;
	/** When set, forces recipe detection off and uses this. */
	forceRecipe?: NewsLayoutRecipe;
};

const NEWS_STYLE_KINDS: TextElementKind[] = ['headline', 'newsSubtext', 'source'];

export function defaultNewsPresent(): NewsPresent {
	return {
		headline: true,
		subtext: true,
		source: true,
		circle: true,
		circle2: false,
		shadow: true,
	};
}

export function defaultNewsLayoutGeometry(): NewsLayoutGeometry {
	return {
		...NEWS_DEFAULT_LAYOUT,
		circleBorderColor: '#ffffff',
		circle2BorderColor: '#ffffff',
		circleShadow: { ...DEFAULT_CIRCLE_SHADOW },
		circle2Shadow: { ...DEFAULT_CIRCLE_SHADOW },
		sourceLabelMode: 'logo',
		sourceLogoSrc: '',
		sourceLogoWidth: 160,
		sourceBorderKind: 'none',
		sourceBorderColor: '#ffffff',
	};
}

export function defaultNewsHighlights(): NewsHighlightChrome {
	return {
		highlightColor: '#7bf1a8',
		highlightStyleKind: 'solid',
		highlightGradientFrom: '#7bf1a8',
		highlightGradientTo: '#38bdf8',
		highlightPattern: '',
		studioTextHighlightsEnabled: true,
	};
}

export function defaultNewsSlotBudgets(): NewsSlotBudgets {
	return {
		headlineMaxWords: 28,
		subtextMaxChars: 300,
	};
}

export function isNewsLayoutDocument(value: unknown): value is NewsLayoutDocument {
	if (!value || typeof value !== 'object') return false;
	const d = value as NewsLayoutDocument;
	return d.v === 1 && d.kind === NEWS_LAYOUT_DOCUMENT_KIND && !!d.layout && !!d.present;
}

function cloneJson<T>(value: T): T {
	return JSON.parse(JSON.stringify(value)) as T;
}

function normalizeOffset(raw: unknown): NewsSlotOffset | null {
	if (!raw || typeof raw !== 'object') return null;
	const x = Number((raw as NewsSlotOffset).x);
	const y = Number((raw as NewsSlotOffset).y);
	if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
	return { x, y };
}

function normalizeOffsets(raw: unknown): NewsSlotOffsets {
	const out: NewsSlotOffsets = {};
	if (!raw || typeof raw !== 'object') return out;
	for (const key of ['headline', 'newsSubtext', 'source'] as const) {
		const off = normalizeOffset((raw as NewsSlotOffsets)[key]);
		if (off) out[key] = off;
	}
	return out;
}

function offsetsAreDefault(offsets: NewsSlotOffsets): boolean {
	for (const off of Object.values(offsets)) {
		if (!off) continue;
		if (Math.abs(off.x) > 1 || Math.abs(off.y) > 1) return false;
	}
	return true;
}

/** Infer recipe from geometry + offsets (custom once the user has nudged slots). */
export function inferNewsRecipe(
	layout: NewsLayoutGeometry,
	offsets: NewsSlotOffsets,
): NewsLayoutRecipe {
	if (!offsetsAreDefault(offsets)) return 'custom';
	const base = NEWS_DEFAULT_LAYOUT;
	const tightShadow = layout.shadowHeight > 0 && layout.shadowHeight <= 48;
	const airyShadow = layout.shadowHeight >= 100;
	const panelUp = layout.textPanelOffsetY < -20;
	if (layout.sourceLabelMode === 'logo' && panelUp) return 'logo-above';
	if (tightShadow) return 'tight-stack';
	if (airyShadow) return 'airy';
	if (
		Math.abs(layout.circleX - base.circleX) < 8 &&
		Math.abs(layout.circleY - base.circleY) < 8 &&
		Math.abs(layout.shadowHeight - base.shadowHeight) < 8
	) {
		return 'default';
	}
	return 'custom';
}

export function normalizeNewsLayoutGeometry(
	partial?: Partial<NewsLayoutGeometry> | null,
): NewsLayoutGeometry {
	const base = defaultNewsLayoutGeometry();
	if (!partial) return base;
	const fit = partial.bgFitMode === 'contain' ? 'contain' : 'cover';
	const sourceLabelMode = partial.sourceLabelMode === 'logo' ? 'logo' : 'text';
	const sourceBorderKind =
		partial.sourceBorderKind === 'rules' || partial.sourceBorderKind === 'box'
			? partial.sourceBorderKind
			: 'none';
	return {
		circleX: Number(partial.circleX) || base.circleX,
		circleY: Number(partial.circleY) || base.circleY,
		circleSize: Number(partial.circleSize) || base.circleSize,
		circle2X: Number(partial.circle2X) || base.circle2X,
		circle2Y: Number(partial.circle2Y) || base.circle2Y,
		circle2Size: Number(partial.circle2Size) || base.circle2Size,
		bgOffsetX: Number(partial.bgOffsetX) || base.bgOffsetX,
		bgOffsetY: Number(partial.bgOffsetY) || base.bgOffsetY,
		bgZoom: Number(partial.bgZoom) || base.bgZoom,
		bgFitMode: fit,
		bgContainMagnify: Number(partial.bgContainMagnify) || base.bgContainMagnify,
		textPanelOffsetY: Number(partial.textPanelOffsetY) || 0,
		shadowHeight: Math.max(0, Number(partial.shadowHeight) || 0),
		shadowStrength: Math.max(0, Number(partial.shadowStrength) || 0),
		circleBorderColor: String(partial.circleBorderColor ?? base.circleBorderColor),
		circle2BorderColor: String(partial.circle2BorderColor ?? base.circle2BorderColor),
		circleShadow: normalizeCircleShadow(partial.circleShadow ?? base.circleShadow),
		circle2Shadow: normalizeCircleShadow(partial.circle2Shadow ?? base.circle2Shadow),
		sourceLabelMode,
		sourceLogoSrc: String(partial.sourceLogoSrc ?? ''),
		sourceLogoWidth: Number(partial.sourceLogoWidth) || base.sourceLogoWidth,
		sourceBorderKind,
		sourceBorderColor: String(partial.sourceBorderColor ?? base.sourceBorderColor),
	};
}

export function captureNewsLayoutDocument(input: NewsLayoutCaptureInput): NewsLayoutDocument {
	const layout = normalizeNewsLayoutGeometry(input.layout);
	const offsets = normalizeOffsets(input.offsets);
	const present: NewsPresent = {
		...defaultNewsPresent(),
		...input.present,
		shadow: (input.present?.shadow ?? layout.shadowHeight > 0) && layout.shadowStrength > 0,
	};
	const styles: Partial<Record<TextElementKind, TextStyle>> = {};
	for (const kind of NEWS_STYLE_KINDS) {
		const s = input.styles?.[kind];
		if (s && Object.keys(s).length) styles[kind] = cloneJson(s);
	}
	const highlights: NewsHighlightChrome = {
		...defaultNewsHighlights(),
		...input.highlights,
	};
	const slotBudgets: NewsSlotBudgets = {
		...defaultNewsSlotBudgets(),
		...input.slotBudgets,
	};
	const recipe =
		input.forceRecipe ??
		input.recipe ??
		inferNewsRecipe(layout, offsets);

	return {
		v: 1,
		kind: NEWS_LAYOUT_DOCUMENT_KIND,
		recipe,
		present,
		layout,
		offsets,
		styles,
		textOverlays: cloneJson(input.textOverlays ?? []),
		imageOverlays: cloneJson(input.imageOverlays ?? []),
		textColor: String(input.textColor ?? '#FFFFFF'),
		canvasBgDark: input.canvasBgDark !== false,
		highlights,
		slotBudgets,
		updatedAt: new Date().toISOString(),
	};
}

/** Parse unknown JSON into a document (draft / override restore). */
export function parseNewsLayoutDocument(raw: unknown): NewsLayoutDocument | null {
	if (!isNewsLayoutDocument(raw)) return null;
	return captureNewsLayoutDocument({
		present: raw.present,
		layout: raw.layout,
		offsets: raw.offsets,
		styles: raw.styles,
		textOverlays: raw.textOverlays,
		imageOverlays: raw.imageOverlays,
		textColor: raw.textColor,
		canvasBgDark: raw.canvasBgDark,
		highlights: raw.highlights,
		slotBudgets: (raw as NewsLayoutDocument).slotBudgets,
		forceRecipe: raw.recipe,
	});
}

/** Patch slot offset after a drag — returns a new document. */
export function withNewsSlotOffset(
	doc: NewsLayoutDocument,
	slot: keyof NewsSlotOffsets,
	next: NewsSlotOffset,
): NewsLayoutDocument {
	const offsets = { ...doc.offsets, [slot]: { x: next.x, y: next.y } };
	return {
		...doc,
		offsets,
		recipe: inferNewsRecipe(doc.layout, offsets),
		updatedAt: new Date().toISOString(),
	};
}

/** Toggle / set present flags (add/delete chrome). */
export function withNewsPresent(
	doc: NewsLayoutDocument,
	patch: Partial<NewsPresent>,
): NewsLayoutDocument {
	const present = { ...doc.present, ...patch };
	const layout = { ...doc.layout };
	if (patch.shadow === false) {
		layout.shadowHeight = 0;
		layout.shadowStrength = 0;
	}
	return {
		...doc,
		present,
		layout,
		updatedAt: new Date().toISOString(),
	};
}

export function withNewsOverlays(
	doc: NewsLayoutDocument,
	next: { textOverlays?: TextOverlay[]; imageOverlays?: Overlay[] },
): NewsLayoutDocument {
	return {
		...doc,
		textOverlays: next.textOverlays !== undefined ? cloneJson(next.textOverlays) : doc.textOverlays,
		imageOverlays:
			next.imageOverlays !== undefined ? cloneJson(next.imageOverlays) : doc.imageOverlays,
		updatedAt: new Date().toISOString(),
	};
}

/**
 * Apply named recipes onto geometry/offsets (deterministic — not LLM).
 * Custom is a no-op keep.
 */
export function applyNewsRecipe(
	doc: NewsLayoutDocument,
	recipe: NewsLayoutRecipe,
): NewsLayoutDocument {
	if (recipe === 'custom') return { ...doc, recipe, updatedAt: new Date().toISOString() };
	const layout = { ...doc.layout };
	let offsets = { ...doc.offsets };
	const base = NEWS_DEFAULT_LAYOUT;
	switch (recipe) {
		case 'default':
			layout.circleX = base.circleX;
			layout.circleY = base.circleY;
			layout.circleSize = base.circleSize;
			layout.textPanelOffsetY = base.textPanelOffsetY;
			layout.shadowHeight = base.shadowHeight;
			layout.shadowStrength = base.shadowStrength;
			offsets = {};
			break;
		case 'tight-stack':
			layout.textPanelOffsetY = 0;
			layout.shadowHeight = 40;
			layout.shadowStrength = 0.85;
			offsets = {
				headline: { x: 0, y: 24 },
				newsSubtext: { x: 0, y: 12 },
				source: { x: 0, y: 8 },
			};
			break;
		case 'airy':
			layout.textPanelOffsetY = -36;
			layout.shadowHeight = 110;
			layout.shadowStrength = 1;
			offsets = {
				headline: { x: 0, y: -20 },
				newsSubtext: { x: 0, y: 8 },
				source: { x: 0, y: 16 },
			};
			break;
		case 'logo-above':
			layout.sourceLabelMode = 'logo';
			layout.textPanelOffsetY = -12;
			layout.shadowHeight = base.shadowHeight;
			layout.shadowStrength = base.shadowStrength;
			offsets = {
				headline: { x: 0, y: 20 },
				source: { x: 0, y: -28 },
			};
			break;
		default:
			break;
	}
	return {
		...doc,
		recipe,
		layout: normalizeNewsLayoutGeometry(layout),
		offsets,
		present: {
			...doc.present,
			shadow: layout.shadowHeight > 0 && layout.shadowStrength > 0,
			source: true,
		},
		updatedAt: new Date().toISOString(),
	};
}

/** Flatten offsets for studio `textOffsetsBySlide` keys (`headline`, not `news:headline`). */
export function newsOffsetsForStudioRow(doc: NewsLayoutDocument): Record<string, NewsSlotOffset> {
	const out: Record<string, NewsSlotOffset> = {};
	for (const [k, v] of Object.entries(doc.offsets)) {
		if (!v) continue;
		out[k] = { x: v.x, y: v.y };
	}
	return out;
}

/** Build a TemplateDevOverride-compatible newsLayout slice. */
export function newsDocumentToLegacyLayout(doc: NewsLayoutDocument): NewsLayoutGeometry {
	return cloneJson(doc.layout);
}

/**
 * What generate should respect when filling an existing News deck:
 * keep structure; only content strings change.
 */
export type NewsLayoutApplyMode = 'full' | 'layout-only';

export type NewsLayoutApplyPatch = {
	layout: NewsLayoutGeometry;
	offsets: NewsSlotOffsets;
	styles: Partial<Record<TextElementKind, TextStyle>>;
	textOverlays: TextOverlay[];
	imageOverlays: Overlay[];
	present: NewsPresent;
	textColor: string;
	canvasBgDark: boolean;
	highlights: NewsHighlightChrome;
	recipe: NewsLayoutRecipe;
};

export function newsDocumentToApplyPatch(doc: NewsLayoutDocument): NewsLayoutApplyPatch {
	return {
		layout: cloneJson(doc.layout),
		offsets: cloneJson(doc.offsets),
		styles: cloneJson(doc.styles),
		textOverlays: cloneJson(doc.textOverlays),
		imageOverlays: cloneJson(doc.imageOverlays),
		present: { ...doc.present },
		textColor: doc.textColor,
		canvasBgDark: doc.canvasBgDark,
		highlights: cloneJson(doc.highlights),
		recipe: doc.recipe,
	};
}
