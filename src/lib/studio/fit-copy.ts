/**
 * Fit overlay/body copy to a budget without ellipsis or mid-word cuts.
 * Prefer complete sentences, then word boundaries.
 */

export function clampToCompleteSentences(text: string, maxLen: number): string {
	const plain = String(text ?? '')
		.replace(/\u2026/g, '')
		.replace(/\s+/g, ' ')
		.trim();
	if (!plain || maxLen <= 0) return '';
	if (plain.length <= maxLen) return plain;

	const sentences =
		plain.match(/[^.!?]+[.!?]+(?:["')\]]+)?|[^.!?]+$/g)?.map((s) => s.trim()).filter(Boolean) ??
		[plain];
	let out = '';
	for (const s of sentences) {
		const next = out ? `${out} ${s}` : s;
		if (next.length <= maxLen) out = next;
		else break;
	}
	if (out) return out;

	const slice = plain.slice(0, maxLen).trimEnd();
	const sp = slice.lastIndexOf(' ');
	const minKeep = Math.floor(maxLen * 0.45);
	return (sp >= minKeep ? slice.slice(0, sp) : slice).trim();
}

/** Word-budget trim that never appends "…" and prefers ending on a finished sentence. */
export function clampToCompleteWords(text: string, maxWords: number): string {
	const plain = String(text ?? '')
		.replace(/\u2026/g, '')
		.replace(/\s+/g, ' ')
		.trim();
	if (!plain || maxWords <= 0) return '';
	const words = plain.split(/\s+/).filter(Boolean);
	if (words.length <= maxWords) return plain;

	const sliced = words.slice(0, maxWords).join(' ');
	// If we landed mid-sentence, try backing up to the last sentence end within the slice.
	const end = Math.max(sliced.lastIndexOf('. '), sliced.lastIndexOf('! '), sliced.lastIndexOf('? '));
	if (end >= Math.floor(sliced.length * 0.4)) {
		return sliced.slice(0, end + 1).trim();
	}
	return sliced.trim();
}

export function fitCopyBudget(
	text: string,
	opts: { maxWords?: number; maxChars?: number },
): string {
	let out = String(text ?? '')
		.replace(/\u2026/g, '')
		.replace(/\s+/g, ' ')
		.trim();
	if (!out) return '';
	if (opts.maxWords != null && opts.maxWords > 0) {
		out = clampToCompleteWords(out, opts.maxWords);
	}
	if (opts.maxChars != null && opts.maxChars > 0) {
		out = clampToCompleteSentences(out, opts.maxChars);
	}
	return out.replace(/[,;:\s]+$/g, '').trim();
}
