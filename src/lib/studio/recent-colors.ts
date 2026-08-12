/** Recently used colors for Studio pickers. Local only — no database. */

const STORAGE_KEY = 'studio_recent_colors_v1';
const MAX_RECENT = 8;

function normalizeHex(raw: string): string | null {
	const s = String(raw ?? '').trim();
	const m = s.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
	if (!m) return null;
	let h = m[1];
	if (h.length === 3) h = h.split('').map((c) => c + c).join('');
	return `#${h.toLowerCase()}`;
}

export function loadRecentColors(): string[] {
	if (typeof localStorage === 'undefined') return [];
	try {
		const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
		if (!Array.isArray(raw)) return [];
		const out: string[] = [];
		for (const item of raw) {
			const hex = normalizeHex(String(item));
			if (hex && !out.includes(hex)) out.push(hex);
			if (out.length >= MAX_RECENT) break;
		}
		return out;
	} catch {
		return [];
	}
}

export function rememberColor(raw: string): string[] {
	const hex = normalizeHex(raw);
	if (!hex) return loadRecentColors();
	const next = [hex, ...loadRecentColors().filter((c) => c !== hex)].slice(0, MAX_RECENT);
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
	} catch {
		// quota / private mode
	}
	return next;
}

export const CIRCLE_BORDER_PRESETS = [
	'#7bf1a8',
	'#FFFFFF',
	'#000000',
	'#F5A623',
	'#08EBFF',
	'#FF3B5C',
	'#A855F7',
	'#111827',
] as const;
