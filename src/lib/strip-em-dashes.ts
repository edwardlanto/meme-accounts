/** Replace em/en dashes with plain ASCII punctuation for on-canvas copy. */
export function stripEmDashes(text: string): string {
	return String(text ?? '')
		.replace(/\u2014/g, ' - ') // em dash —
		.replace(/\u2013/g, '-') // en dash –
		.replace(/\u2212/g, '-') // minus −
		.replace(/\s+-\s+/g, ' - ')
		.replace(/ {2,}/g, ' ')
		.trim();
}
