/**
 * Shared Hook → support beats for multi-slide decks (Studio + Bulk).
 * Calls `/api/news/variants` and normalizes/pads so N slides get distinct copy.
 */
import { stripMarkup } from '$lib/highlight';
import { splitIntoSentences } from '$lib/studio/fit-copy';
import { looksLikeModelJsonLeak, sanitizeOverlayLine } from '$lib/studio/overlay-copy';
import { stripEmDashes } from '$lib/strip-em-dashes';
import { MAX_STUDIO_SLIDE_COUNT, type NewsStudioContentMode } from '$lib/studio/compose-prefs';

export type DeckStoryBeatsResult = {
	copyStrings: string[];
	tweetReplies: string[];
	bodies: string[];
};

export type FetchDeckStoryBeatsOpts = {
	hookText: string;
	rawText: string;
	count: number;
	title?: string;
	sourceUrl?: string;
	contentMode: NewsStudioContentMode;
	/** Original user prompt — used for general-mode variant bible. */
	userRequest?: string;
	stepCount?: number;
	autoHighlight?: boolean;
	includeReplies?: boolean;
	includeBodies?: boolean;
	maxWords?: number;
	maxWordsSupport?: number;
	tone?: Record<string, string | undefined>;
	/** Optional body clamp (Studio News subtext / Bulk body chip). */
	clampBody?: (text: string) => string;
};

/** Build the bible string variants API expects for each content mode. */
export function buildVariantBodyText(opts: {
	mode: NewsStudioContentMode;
	hook: string;
	body: string;
	userRequest?: string;
	title?: string;
	/** When set, reminds the model to pace across exactly this many slides. */
	slideCount?: number;
}): string {
	const hook = String(opts.hook ?? '').trim();
	const body = String(opts.body ?? '').trim();
	const title = String(opts.title ?? '').trim();
	const request = String(opts.userRequest ?? '').trim();
	const n = Math.max(1, Math.min(MAX_STUDIO_SLIDE_COUNT, Math.floor(Number(opts.slideCount)) || 0));
	if (opts.mode === 'story') {
		return `HOOK (slide 1 overlay):\n${hook}\n\nNARRATIVE CONTEXT (continue this story across slides; do not turn it into a news explainer):\n${body}`;
	}
	if (opts.mode === 'steps') {
		return `HOOK (slide 1 overlay):\n${hook}\n\nSTEPS BIBLE (use numbered steps; slide 1 = hook, middle = STEP k, last = CTA):\n${body}`;
	}
	if (opts.mode === 'general') {
		const pace =
			n > 1
				? `\n\nSLIDE COUNT: exactly ${n} panels. Pace the bible so each slide gets a distinct beat ` +
					`(hook → evidence/example → implication` +
					(n > 3 ? ` → more facets` : '') +
					` → landing). Stay on ONE topic the whole way — the user request.`
				: '';
		return (
			`USER REQUEST:\n${request || title}\n\nHOOK (slide 1 overlay):\n${hook}\n\n` +
			`CONTEXT BIBLE (fulfill the request across slides — same subject every slide):\n${body}` +
			pace
		);
	}
	return body || title || hook;
}

/** Deterministic Hook → support beats when the variants API is unavailable. */
export function fallbackStoryBeats(hookText: string, rawText: string, count: number): string[] {
	const n = Math.max(1, count);
	const hook = sanitizeOverlayLine(String(hookText ?? '').trim());
	const body = sanitizeOverlayLine(String(rawText ?? '').trim());
	const sentences = `${hook}${hook && body ? ' ' : ''}${body}`
		.replace(/\s+/g, ' ')
		.split(/(?<=[.!?])\s+/)
		.map((s) => s.trim())
		.filter(Boolean);
	if (!sentences.length) {
		return Array.from({ length: n }, (_, i) => (i === 0 ? hook : ''));
	}
	if (n === 1) return [sentences.slice(0, 2).join(' ') || hook];

	const out: string[] = [];
	out.push(sentences[0] ?? hook);
	const rest = sentences.slice(1);
	if (!rest.length) {
		while (out.length < n) out.push(out[0]!);
		return out.slice(0, n);
	}
	const supportCount = n - 1;
	const per = Math.max(1, Math.ceil(rest.length / supportCount));
	for (let i = 0; i < supportCount; i++) {
		const chunk = rest.slice(i * per, (i + 1) * per).join(' ');
		out.push(chunk || rest[Math.min(i, rest.length - 1)]!);
	}
	return out.slice(0, n);
}

export function normalizeHeadlineVariants(
	variants: string[],
	hookText: string,
	count: number,
	opts?: { preferHookAsFirst?: boolean },
): string[] {
	const n = Math.max(1, count);
	const hook = sanitizeOverlayLine(String(hookText ?? '').trim());
	const cleaned = (variants ?? [])
		.map((v) => sanitizeOverlayLine(String(v ?? '').trim()))
		.filter((v) => v && !looksLikeModelJsonLeak(v));
	const normKey = (s: string) =>
		stripMarkup(s)
			.toLowerCase()
			.replace(/[^a-z0-9\s]/g, ' ')
			.replace(/\s+/g, ' ')
			.trim();

	let out: string[];
	if (!cleaned.length) {
		out = fallbackStoryBeats(hook, '', n);
	} else if (cleaned.length >= n) {
		out = cleaned.slice(0, n);
	} else {
		out = cleaned.filter(Boolean);
		if (!out.length) {
			out = fallbackStoryBeats(hook, '', n);
		} else {
			const filler = fallbackStoryBeats(hook || out[0]!, out.join(' '), n);
			while (out.length < n) {
				const next = filler[out.length] ?? out[out.length - 1]!;
				out.push(next);
			}
			out = out.slice(0, n);
		}
	}

	/* Keep slide 1 locked to the generated hook when the model drifted. */
	if (opts?.preferHookAsFirst && hook) {
		out = [hook, ...out.slice(1)];
	}

	/* Replace near-duplicate later slides with fallback beats so the deck advances. */
	const seen = new Set<string>();
	const filler = fallbackStoryBeats(hook || out[0] || '', out.join(' '), n);
	const BEAT_STUBS = [
		'THE DETAIL MOST PEOPLE MISS',
		'HERE IS WHAT CHANGES NEXT',
		'THE PART THAT ACTUALLY MATTERS',
		'WHY THIS STICKS WITH YOU',
		'THE TAKEAWAY TO KEEP',
	];
	out = out.map((line, i) => {
		let t = sanitizeOverlayLine(String(line ?? '').trim()) || filler[i] || hook;
		let key = normKey(t);
		if (key && seen.has(key) && i > 0) {
			const alt = filler[i] || '';
			const altKey = normKey(alt);
			if (alt && altKey && !seen.has(altKey) && altKey !== key) {
				t = alt;
			} else {
				t = BEAT_STUBS[(i - 1) % BEAT_STUBS.length]!;
			}
		}
		key = normKey(t);
		if (key) seen.add(key);
		return t;
	});

	return out.slice(0, n);
}

/** Split a bible/lede into distinct per-slide paragraphs (no duplicate stamp). */
export function distributeBodyAcrossSlides(
	body: string,
	count: number,
	clamp?: (text: string) => string,
): string[] {
	const n = Math.max(1, count);
	const source = stripMarkup(stripEmDashes(String(body ?? '').trim())).replace(/\s+/g, ' ').trim();
	if (!source) return Array.from({ length: n }, () => '');
	const apply = (s: string) => {
		const t = String(s ?? '').trim();
		if (!t) return '';
		return clamp ? clamp(t) || t : t;
	};
	const sentences = splitIntoSentences(source).filter(Boolean);
	if (!sentences.length) {
		const one = apply(source);
		return Array.from({ length: n }, (_, i) => (i === 0 ? one : ''));
	}
	if (n === 1) return [apply(sentences.slice(0, 2).join(' ') || source)];

	const buckets: string[][] = Array.from({ length: n }, () => []);
	if (sentences.length >= n) {
		for (let i = 0; i < n; i++) {
			const start = Math.floor((i * sentences.length) / n);
			const end = Math.floor(((i + 1) * sentences.length) / n);
			buckets[i] = sentences.slice(start, Math.max(start + 1, end));
		}
	} else {
		for (let i = 0; i < sentences.length; i++) buckets[i] = [sentences[i]!];
	}

	const out: string[] = [];
	const used = new Set<string>();
	for (let i = 0; i < n; i++) {
		const chunk = apply(buckets[i]!.join(' ').trim());
		const key = chunk.toLowerCase();
		if (chunk && !used.has(key)) {
			used.add(key);
			out.push(chunk);
			continue;
		}
		const leftover = sentences.find((s) => {
			const c = apply(s);
			return c && !used.has(c.toLowerCase());
		});
		if (leftover) {
			const c = apply(leftover);
			used.add(c.toLowerCase());
			out.push(c);
		} else {
			out.push(i === 0 ? apply(source) : '');
		}
	}
	return out;
}

export function normalizeSupportBodies(
	bodies: string[],
	source: string,
	count: number,
	clamp?: (text: string) => string,
): string[] {
	const n = Math.max(1, count);
	const apply = (s: string) => {
		const t = sanitizeOverlayLine(stripEmDashes(String(s ?? '').trim()));
		if (!t) return '';
		return clamp ? clamp(t) || t : t;
	};
	const cleaned = (bodies ?? []).map(apply).filter(Boolean);
	if (cleaned.length >= n) {
		return dedupeBodies(cleaned.slice(0, n), source, apply);
	}
	if (!cleaned.length) {
		return distributeBodyAcrossSlides(source, n, clamp);
	}
	const out = [...cleaned];
	const extras = distributeBodyAcrossSlides(source, n, clamp);
	while (out.length < n) {
		const next = extras[out.length] ?? '';
		out.push(next && !out.some((x) => x.toLowerCase() === next.toLowerCase()) ? next : '');
	}
	return dedupeBodies(out.slice(0, n), source, apply);
}

function dedupeBodies(
	bodies: string[],
	source: string,
	apply: (s: string) => string,
): string[] {
	const seen = new Set<string>();
	const sentences = splitIntoSentences(stripMarkup(source)).filter(Boolean);
	let cursor = 0;
	return bodies.map((raw, i) => {
		let t = String(raw ?? '').trim();
		const key = t.toLowerCase().replace(/\s+/g, ' ');
		if (t && !seen.has(key)) {
			seen.add(key);
			return t;
		}
		while (cursor < sentences.length) {
			const candidate = apply(sentences[cursor++]!);
			const cKey = candidate.toLowerCase().replace(/\s+/g, ' ');
			if (candidate && !seen.has(cKey)) {
				seen.add(cKey);
				return candidate;
			}
		}
		const filler = apply(`This slide adds a separate beat on the same story (${i + 1}).`);
		seen.add(filler.toLowerCase());
		return filler;
	});
}

/**
 * One Hook → content arc for the whole deck (Studio + Bulk).
 * Slide 0 = strongest hook; later slides are distinct supporting beats.
 */
export async function fetchDeckStoryBeats(
	opts: FetchDeckStoryBeatsOpts,
): Promise<DeckStoryBeatsResult> {
	const n = Math.max(1, Math.min(MAX_STUDIO_SLIDE_COUNT, Math.floor(Number(opts.count)) || 1));
	const hook = sanitizeOverlayLine(stripEmDashes(String(opts.hookText ?? '').trim()));
	const body = sanitizeOverlayLine(stripEmDashes(String(opts.rawText ?? '').trim()));
	const title = stripEmDashes(String(opts.title ?? '').trim());
	const wantBodies = opts.includeBodies !== false;
	const clamp = opts.clampBody;

	if (n <= 1) {
		const oneBody = wantBodies
			? clamp
				? clamp(body) || body
				: body
			: '';
		return {
			copyStrings: [hook || body || title],
			tweetReplies: opts.includeReplies ? [''] : [],
			bodies: wantBodies ? [oneBody] : [],
		};
	}

	const variantBodyText = buildVariantBodyText({
		mode: opts.contentMode,
		hook,
		body: body || title || hook,
		userRequest: opts.userRequest,
		title,
		slideCount: n,
	});

	try {
		const res = await fetch('/api/news/variants', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				count: n,
				title: title || hook.slice(0, 80),
				text: variantBodyText,
				sourceUrl: opts.sourceUrl || undefined,
				autoHighlight: !!opts.autoHighlight,
				contentMode: opts.contentMode,
				stepCount: opts.contentMode === 'steps' ? opts.stepCount : undefined,
				includeReplies: !!opts.includeReplies,
				includeBodies: wantBodies,
				maxWords: opts.maxWords,
				maxWordsSupport: opts.maxWordsSupport,
				...(opts.tone ?? {}),
			}),
		});
		const data = await res.json();
		if (!res.ok) throw new Error(data?.error ?? 'Variant generation failed');
		const variants: string[] = Array.isArray(data.variants) ? data.variants : [];
		const rawBodies: string[] = Array.isArray(data.bodies) ? data.bodies : [];
		const replies: string[] = Array.isArray(data.replies) ? data.replies : [];
		return {
			copyStrings: normalizeHeadlineVariants(
				variants.map((h) => stripEmDashes(String(h ?? ''))),
				hook,
				n,
				{ preferHookAsFirst: opts.contentMode === 'general' || opts.contentMode === 'story' },
			),
			tweetReplies: opts.includeReplies
				? Array.from({ length: n }, (_, i) =>
						sanitizeOverlayLine(stripEmDashes(String(replies[i] ?? ''))),
					)
				: [],
			bodies: wantBodies
				? normalizeSupportBodies(
						rawBodies.map((b) => stripEmDashes(String(b ?? ''))),
						body || title || hook,
						n,
						clamp,
					)
				: [],
		};
	} catch {
		const fallback = fallbackStoryBeats(hook, body || title, n);
		return {
			copyStrings: fallback,
			tweetReplies: opts.includeReplies ? Array.from({ length: n }, () => '') : [],
			bodies: wantBodies
				? distributeBodyAcrossSlides(body || title || hook, n, clamp)
				: [],
		};
	}
}
