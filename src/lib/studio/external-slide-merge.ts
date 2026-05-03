import type { TemplateId } from './template-ids';

/**
 * Normalized slide payload from Claude, `/api/generate-slides`, or any JSON that
 * roughly follows { headline, body, bullets, imageUrl, … }.
 * Add fields here + `coerceExternalSlideBlock` when you introduce new Claude templates.
 */
export type ExternalSlideBlock = {
	headline?: string;
	subheadline?: string;
	body?: string;
	bullets?: string[];
	source?: string;
	/** http(s) only — caller may map uploaded images to URLs separately */
	imageUrl?: string | null;
};

export type ExternalSlideMergeMode = 'mix' | 'replace';

/** One slide worth of text/media updates for the Studio page to apply. */
export type StudioSlideMergePatch = {
	slideIndex: number;
	primary?: string;
	/** Black-text template: long copy under the headline. */
	body?: string;
	tweetBottom?: string;
	source?: string;
	imageUrl?: string;
};

function pickStr(v: unknown): string | undefined {
	if (typeof v !== 'string') return undefined;
	const t = v.trim();
	return t.length ? t : undefined;
}

/** Accepts raw JSON root: array, `{ slides: [...] }`, or a single slide object. */
export function normalizeExternalSlideRoot(raw: unknown): unknown[] {
	if (Array.isArray(raw)) return raw;
	if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
		const o = raw as Record<string, unknown>;
		if (Array.isArray(o.slides)) return o.slides;
		if (
			'headline' in o ||
			'body' in o ||
			'title' in o ||
			'text' in o ||
			'bullets' in o
		) {
			return [raw];
		}
	}
	return [];
}

export function coerceExternalSlideBlock(row: unknown): ExternalSlideBlock {
	if (!row || typeof row !== 'object' || Array.isArray(row)) return {};
	const o = row as Record<string, unknown>;
	const bulletsRaw = o.bullets;
	const bullets = Array.isArray(bulletsRaw)
		? bulletsRaw.map((b) => (typeof b === 'string' ? b : String(b))).filter((s) => s.trim())
		: undefined;
	const imageUrl =
		pickStr(o.imageUrl) ?? pickStr(o.image_url) ?? pickStr(o.topImage) ?? pickStr(o.backgroundImage);
	return {
		headline:
			pickStr(o.headline) ??
			pickStr(o.title) ??
			pickStr(typeof o.hook === 'string' ? o.hook : undefined),
		subheadline: pickStr(o.subheadline) ?? pickStr(o.subtitle),
		body: pickStr(o.body) ?? pickStr(o.text) ?? pickStr(o.copy),
		bullets: bullets?.length ? bullets : undefined,
		source: pickStr(o.source) ?? pickStr(o.badge) ?? pickStr(o.channel),
		imageUrl: imageUrl ?? undefined,
	};
}

/** Main body line for templates that use a single primary string per slide. */
export function primaryTextFromBlock(block: ExternalSlideBlock): string {
	const parts: string[] = [];
	if (block.headline) parts.push(block.headline);
	if (block.subheadline) parts.push(block.subheadline);
	if (block.body) parts.push(block.body);
	if (block.bullets?.length) parts.push(block.bullets.join('\n'));
	return parts.join('\n\n').trim();
}

/** Tweet-style secondary: body distinct from headline, or bullets-only support. */
export function tweetBottomFromBlock(block: ExternalSlideBlock): string {
	if (block.headline && block.body && block.body.trim() !== block.headline.trim()) return block.body.trim();
	if (block.bullets?.length) return block.bullets.join('\n');
	if (block.subheadline && block.headline) return block.subheadline;
	return '';
}

function httpImageUrl(block: ExternalSlideBlock): string | undefined {
	const s = block.imageUrl;
	if (!s || typeof s !== 'string') return undefined;
	const t = s.trim();
	if (t.startsWith('http://') || t.startsWith('https://')) return t;
	return undefined;
}

/**
 * Turn external blocks into concrete patches for the active Studio template.
 * - `mix`: only include fields that are present (skip empty primary unless image/source).
 * - `replace`: same patches but caller may treat empty primary as “clear” if desired.
 */
export function computeStudioSlideMergePatches(
	template: TemplateId,
	blocks: ExternalSlideBlock[],
	slideCount: number,
	mode: ExternalSlideMergeMode,
): StudioSlideMergePatch[] {
	const n = Math.min(Math.max(0, slideCount), blocks.length);
	const out: StudioSlideMergePatch[] = [];
	for (let i = 0; i < n; i++) {
		const b = blocks[i];
		let primary = primaryTextFromBlock(b);
		let blackBody: string | undefined;
		if (template === 'blackText') {
			const hl = pickStr(b.headline);
			const bd = pickStr(b.body);
			if (hl) primary = hl;
			else if (bd) primary = (bd.split('\n')[0] ?? bd).trim().slice(0, 240);
			if (bd) blackBody = bd;
		}
		const tweetBottom = template === 'tweet' ? tweetBottomFromBlock(b) : '';
		const imageUrl = httpImageUrl(b);
		const source = b.source?.trim();

		const hasPrimary = !!primary;
		const hasBlackBody = template === 'blackText' && !!blackBody;
		const hasBottom = !!tweetBottom;
		const hasImg = !!imageUrl;
		const hasSource = !!source;

		if (mode === 'mix' && !hasPrimary && !hasBlackBody && !hasBottom && !hasImg && !hasSource) continue;

		const patch: StudioSlideMergePatch = { slideIndex: i };
		if (hasPrimary) patch.primary = primary;
		if (hasBlackBody) patch.body = blackBody;
		if (template === 'tweet' && hasBottom) patch.tweetBottom = tweetBottom;
		if (hasImg) patch.imageUrl = imageUrl;
		if (hasSource) patch.source = source;
		out.push(patch);
	}
	return out;
}

export function parseExternalSlideBlocksJson(json: string): { ok: true; blocks: ExternalSlideBlock[] } | { ok: false; error: string } {
	let raw: unknown;
	try {
		raw = JSON.parse(json);
	} catch {
		return { ok: false, error: 'Invalid JSON' };
	}
	const rows = normalizeExternalSlideRoot(raw);
	if (!rows.length) return { ok: false, error: 'No slides in payload (expected an array or { slides: [...] })' };
	return { ok: true, blocks: rows.map(coerceExternalSlideBlock) };
}
