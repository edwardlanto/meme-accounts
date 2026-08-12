/** Studio Generate query history (localStorage). Queries + titles only — no media. */

import type { NewsStudioContentMode } from './compose-prefs';

export const STUDIO_PROMPT_HISTORY_KEY = 'studio_prompt_history_v1';
export const STUDIO_PROMPT_HISTORY_MAX = 40;

export type StudioPromptHistoryEntry = {
	id: string;
	savedAt: number;
	query: string;
	mode: NewsStudioContentMode;
	/** Plain hook/title from the run (for variety + list subtitle). No images. */
	title?: string;
};

export type StudioPromptHistoryLibrary = {
	v: 1;
	entries: StudioPromptHistoryEntry[];
};

function storageKey(userId: string): string {
	return `${STUDIO_PROMPT_HISTORY_KEY}_${userId || 'anon'}`;
}

function normalizeQuery(q: string): string {
	return String(q ?? '')
		.trim()
		.toLowerCase()
		.replace(/\s+/g, ' ');
}

export function loadPromptHistory(userId: string): StudioPromptHistoryEntry[] {
	if (typeof localStorage === 'undefined') return [];
	try {
		const raw = localStorage.getItem(storageKey(userId));
		if (!raw) return [];
		const parsed = JSON.parse(raw) as StudioPromptHistoryLibrary;
		if (!parsed || parsed.v !== 1 || !Array.isArray(parsed.entries)) return [];
		return parsed.entries
			.filter((e) => e && typeof e.query === 'string' && e.query.trim())
			.slice(0, STUDIO_PROMPT_HISTORY_MAX);
	} catch {
		return [];
	}
}

function savePromptHistory(userId: string, entries: StudioPromptHistoryEntry[]) {
	if (typeof localStorage === 'undefined') return;
	try {
		const lib: StudioPromptHistoryLibrary = {
			v: 1,
			entries: entries.slice(0, STUDIO_PROMPT_HISTORY_MAX),
		};
		localStorage.setItem(storageKey(userId), JSON.stringify(lib));
	} catch {
		/* quota / private mode */
	}
}

export function pushPromptHistory(
	userId: string,
	entry: Omit<StudioPromptHistoryEntry, 'id' | 'savedAt'> & { id?: string; savedAt?: number },
): StudioPromptHistoryEntry[] {
	const query = String(entry.query ?? '').trim();
	if (!query) return loadPromptHistory(userId);

	const next: StudioPromptHistoryEntry = {
		id: entry.id ?? `ph_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
		savedAt: entry.savedAt ?? Date.now(),
		query,
		mode: entry.mode,
		title: String(entry.title ?? '')
			.replace(/\[\[|\]\]/g, '')
			.trim()
			.slice(0, 160) || undefined,
	};

	const prev = loadPromptHistory(userId);
	/* Dedupe identical query+title at the top so spam regenerates don’t flood the list. */
	const filtered = prev.filter(
		(e) =>
			!(
				normalizeQuery(e.query) === normalizeQuery(next.query) &&
				String(e.title ?? '').toLowerCase() === String(next.title ?? '').toLowerCase()
			),
	);
	const entries = [next, ...filtered].slice(0, STUDIO_PROMPT_HISTORY_MAX);
	savePromptHistory(userId, entries);
	return entries;
}

export function removePromptHistoryEntry(userId: string, id: string): StudioPromptHistoryEntry[] {
	const entries = loadPromptHistory(userId).filter((e) => e.id !== id);
	savePromptHistory(userId, entries);
	return entries;
}

export function clearPromptHistory(userId: string): void {
	if (typeof localStorage === 'undefined') return;
	try {
		localStorage.removeItem(storageKey(userId));
	} catch {
		/* ignore */
	}
}

/** Recent titles/hooks for the same query — used to ask the model for a fresh angle. */
export function recentTitlesForQuery(
	userId: string,
	query: string,
	limit = 8,
): string[] {
	const key = normalizeQuery(query);
	if (!key) return [];
	const seen = new Set<string>();
	const out: string[] = [];
	for (const e of loadPromptHistory(userId)) {
		if (normalizeQuery(e.query) !== key) continue;
		const t = String(e.title ?? '').trim();
		if (!t) continue;
		const k = t.toLowerCase();
		if (seen.has(k)) continue;
		seen.add(k);
		out.push(t.slice(0, 120));
		if (out.length >= limit) break;
	}
	return out;
}
