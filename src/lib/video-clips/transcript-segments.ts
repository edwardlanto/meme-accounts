/** Parse [m:ss] or [h:mm:ss] timestamp from caption lines. */
export function parseTranscriptLineSec(line: string): number | null {
	const m = line.match(/^\[(\d+):(\d{2})(?::(\d{2}))?\]\s*/);
	if (!m) return null;
	const a = Number(m[1]);
	const b = Number(m[2]);
	const c = m[3] != null ? Number(m[3]) : null;
	if (c != null) return a * 3600 + b * 60 + c;
	return a * 60 + b;
}

/** Pull spoken lines that fall within [startSec, endSec]. */
export function excerptFromTimedTranscript(
	transcript: string,
	startSec: number,
	endSec: number,
): string {
	const parts: string[] = [];
	for (const line of transcript.split('\n')) {
		const t = parseTranscriptLineSec(line);
		if (t == null) continue;
		if (t < startSec - 0.5 || t > endSec + 0.5) continue;
		const text = line.replace(/^\[[^\]]+\]\s*/, '').trim();
		if (text) parts.push(text);
	}
	return parts.join(' ').replace(/\s+/g, ' ').trim();
}
