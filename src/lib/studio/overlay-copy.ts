/**
 * Keep model JSON / markup from landing on slide overlays.
 * Variants and rewrite prompts ask for JSON; failed parses used to stamp that
 * payload onto headlines (e.g. `{ "VARIANTS": [ "ONLY IN LA…`).
 */

const STRUCTURAL_KEYS = new Set([
	'variants',
	'bodies',
	'replies',
	'hook',
	'context',
	'slides',
	'headline',
	'subheadline',
	'text',
	'description',
]);

export function looksLikeModelJsonLeak(text: string): boolean {
	const t = String(text ?? '').trim();
	if (!t) return false;
	if (/^\[object object\]$/i.test(t)) return true;
	if (/^\s*\{/.test(t)) return true;
	if (/^\s*\[\s*[\{\"]/.test(t)) return true;
	if (/"variants"\s*:/i.test(t) || /"bodies"\s*:/i.test(t) || /"replies"\s*:/i.test(t)) {
		return true;
	}
	if (/^\s*```/.test(t)) return true;
	if (/<\/?(?:span|div|p|br|script|style)\b/i.test(t)) return true;
	return false;
}

function decodeJsonString(raw: string): string {
	return raw
		.replace(/\\n/g, ' ')
		.replace(/\\"/g, '"')
		.replace(/\\\\/g, '\\')
		.replace(/\s+/g, ' ')
		.trim();
}

function acceptOverlayFragment(s: string, out: string[]) {
	if (!s) return;
	if (STRUCTURAL_KEYS.has(s.toLowerCase())) return;
	if (looksLikeModelJsonLeak(s)) return;
	if (out.includes(s)) return;
	out.push(s);
}

/** Pull overlay-worthy quoted strings out of truncated / messy model JSON. */
export function extractQuotedOverlayStrings(raw: string): string[] {
	const src = String(raw ?? '');
	const out: string[] = [];
	const re = /"((?:\\.|[^"\\])*)"/g;
	let m: RegExpExecArray | null;
	while ((m = re.exec(src))) {
		acceptOverlayFragment(decodeJsonString(m[1] ?? ''), out);
	}
	/* Truncated JSON often ends mid-string: `{ "variants": [ "ONLY IN LA…` */
	const unclosed = src.match(/"((?:\\.|[^"\\])*)$/);
	if (unclosed) acceptOverlayFragment(decodeJsonString(unclosed[1] ?? ''), out);
	return out;
}

function asStringArray(value: unknown): string[] {
	if (!Array.isArray(value)) return [];
	return value
		.map((x) => String(x ?? '').trim())
		.filter((s) => s && !looksLikeModelJsonLeak(s));
}

function pickIgnoreCase(rec: Record<string, unknown>, key: string): unknown {
	if (key in rec) return rec[key];
	const hit = Object.keys(rec).find((k) => k.toLowerCase() === key.toLowerCase());
	return hit ? rec[hit] : undefined;
}

function tryJsonParse(s: string): unknown | null {
	try {
		return JSON.parse(s);
	} catch {
		return null;
	}
}

export function parseModelOverlayJson(raw: string): {
	variants: string[];
	bodies: string[];
	replies: string[];
} | null {
	const stripped = String(raw ?? '')
		.replace(/^```(?:json)?\s*/i, '')
		.replace(/\s*```\s*$/i, '')
		.trim();
	if (!stripped) return null;

	let parsed = tryJsonParse(stripped);
	if (parsed == null) {
		const obj = stripped.match(/\{[\s\S]*\}/);
		const arr = stripped.match(/\[[\s\S]*\]/);
		parsed = (obj && tryJsonParse(obj[0]!)) || (arr && tryJsonParse(arr[0]!)) || null;
	}

	let variants: string[] = [];
	let bodies: string[] = [];
	let replies: string[] = [];

	if (Array.isArray(parsed)) {
		variants = asStringArray(parsed);
	} else if (parsed && typeof parsed === 'object') {
		const rec = parsed as Record<string, unknown>;
		variants = asStringArray(pickIgnoreCase(rec, 'variants'));
		bodies = asStringArray(pickIgnoreCase(rec, 'bodies'));
		replies = asStringArray(pickIgnoreCase(rec, 'replies'));
		const hook = pickIgnoreCase(rec, 'hook');
		if (!variants.length && typeof hook === 'string' && hook.trim()) {
			variants = [hook.trim()].filter((s) => !looksLikeModelJsonLeak(s));
		}
	}

	if (!variants.length) {
		variants = extractQuotedOverlayStrings(stripped);
	}

	if (!variants.length && !bodies.length && !replies.length) return null;
	return { variants, bodies, replies };
}

/** Words that take a bare NOT / BUT without a contrast comma. */
const NO_COMMA_BEFORE_NOT = new Set([
	'is',
	'are',
	'was',
	'were',
	'be',
	'been',
	'being',
	'am',
	'do',
	'does',
	'did',
	'don\'t',
	'doesn\'t',
	'didn\'t',
	'can',
	'could',
	'can\'t',
	'cannot',
	'will',
	'would',
	'won\'t',
	'wouldn\'t',
	'should',
	'shouldn\'t',
	'may',
	'might',
	'must',
	'shall',
	'need',
	'had',
	'has',
	'have',
	'hasn\'t',
	'haven\'t',
	'hadn\'t',
	'why',
	'how',
	'who',
	'what',
	'when',
	'where',
	'whether',
	'if',
	'or',
	'nor',
	'though',
	'although',
	'maybe',
	'perhaps',
	'just',
]);

const NO_COMMA_BEFORE_BUT = new Set(['all', 'anything', 'nothing', 'cannot', 'can\'t']);

/**
 * Instagram overlay models often drop commas in contrast lines
 * ("FAST NOT EVERYTHING" → "FAST, NOT EVERYTHING").
 */
export function repairOverlayGrammar(text: string): string {
	let t = String(text ?? '').replace(/\s+/g, ' ').trim();
	if (!t) return t;

	const insertContrastComma = (word: string, closer: string, conj: string) =>
		`${word}${closer}, ${conj}`;

	t = t.replace(
		/\b([A-Za-z']+)((?:\]\])?)\s+(NOT)\b/gi,
		(full, word: string, closer: string, conj: string) => {
			const key = word.replace(/'/g, '').toLowerCase();
			if (NO_COMMA_BEFORE_NOT.has(word.toLowerCase()) || NO_COMMA_BEFORE_NOT.has(key)) {
				return full;
			}
			return insertContrastComma(word, closer ?? '', conj);
		},
	);

	t = t.replace(
		/\b([A-Za-z']+)((?:\]\])?)\s+(BUT)\b/gi,
		(full, word: string, closer: string, conj: string) => {
			if (NO_COMMA_BEFORE_BUT.has(word.toLowerCase())) return full;
			return insertContrastComma(word, closer ?? '', conj);
		},
	);

	return t.replace(/\s+,/g, ',').replace(/,\s+/g, ', ').replace(/\s+/g, ' ').trim();
}

/**
 * Models often wrap overlay sentences in "…" / “…” even when the prompt forbids it.
 * Strip wrappers on the whole line; leave mid-sentence quotes alone.
 */
export function stripWrappingQuotes(text: string): string {
	let t = String(text ?? '').trim();
	if (!t) return t;
	const wrap = /^[\u201C\u00AB"]+\s*([\s\S]*?)\s*[\u201D\u00BB"]+([.!?…]*)\s*$/u;
	for (let i = 0; i < 4; i++) {
		const m = t.match(wrap);
		if (!m?.[1]) break;
		t = `${m[1]}${m[2] ?? ''}`.trim();
	}
	return t;
}

/** Display / persist a line of overlay copy; recover from leaked JSON when possible. */
export function sanitizeOverlayLine(text: string, fallback = ''): string {
	let t = stripWrappingQuotes(String(text ?? '').trim());
	if (!t) return fallback;
	if (looksLikeModelJsonLeak(t)) {
		const parsed = parseModelOverlayJson(t);
		const recovered = parsed?.variants[0] ?? extractQuotedOverlayStrings(t)[0] ?? '';
		if (!recovered || looksLikeModelJsonLeak(recovered)) return fallback;
		t = stripWrappingQuotes(recovered);
	}
	return repairOverlayGrammar(stripWrappingQuotes(t)) || fallback;
}
