/** Decode common HTML entities from YouTube VTT/SRT (`&gt;` → `>`). */
export function decodeHtmlEntities(s: string): string {
	return s
		.replace(/&nbsp;/gi, ' ')
		.replace(/&amp;/gi, '&')
		.replace(/&lt;/gi, '<')
		.replace(/&gt;/gi, '>')
		.replace(/&quot;/gi, '"')
		.replace(/&#39;/gi, "'")
		.replace(/&apos;/gi, "'")
		.replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
		.replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)));
}

/** Remove VTT/ caption speaker tags like [Dr. Hromas] (not [m:ss] timestamps). */
export function stripSpeakerLabels(s: string): string {
	return decodeHtmlEntities(s)
		.replace(/\[(?!\d{1,2}:\d{2}(?::\d{2})?\])[^\]]*\]/g, '')
		.replace(/\s+/g, ' ')
		.trim();
}

/** Plain spoken text: no timestamps, speaker labels, HTML entities, or extra whitespace. */
export function cleanClipSpeechText(s: string): string {
	return stripSpeakerLabels(
		s
			.replace(/^\[\d{1,2}:\d{2}(?::\d{2})?(?:->[^\]]+)?\]\s*/gm, '')
			.replace(/\s+/g, ' ')
			.trim(),
	);
}

/** Collapse back-to-back repeated word runs from rolling auto-captions. */
export function collapseRepeatedPhrases(text: string): string {
	let words = cleanClipSpeechText(text).split(/\s+/).filter(Boolean);
	if (words.length < 8) return words.join(' ');

	for (let pass = 0; pass < 4; pass++) {
		let changed = false;
		const maxLen = Math.min(14, Math.floor(words.length / 2));
		for (let len = maxLen; len >= 4; len--) {
			for (let i = 0; i <= words.length - len * 2; i++) {
				const a = words.slice(i, i + len).join(' ').toLowerCase();
				const b = words.slice(i + len, i + len * 2).join(' ').toLowerCase();
				if (a === b) {
					words.splice(i + len, len);
					changed = true;
					break;
				}
			}
			if (changed) break;
		}
		if (!changed) break;
	}

	return words.join(' ').replace(/\s+/g, ' ').trim();
}

/** Parse [m:ss] or [h:mm:ss] timestamp from caption lines. Handles optional [start->end] ranges and ms. */
export function parseTranscriptLineSec(line: string): number | null {
	const range = parseTranscriptLineRange(line);
	return range?.startSec ?? null;
}

/** Parse both start and end times from a `[start->end]` line. Returns null end if only start provided. */
export function parseTranscriptLineRange(line: string): { startSec: number; endSec: number | null } | null {
	const rangeMatch = line.match(
		/^\[(\d+):(\d{2})(?::(\d{2}))?(?:\.(\d+))?->(\d+):(\d{2})(?::(\d{2}))?(?:\.(\d+))?\]\s*/,
	);
	if (rangeMatch) {
		const [, sh, sm, ss, sms, eh, em, es, ems] = rangeMatch;
		const startSec =
			ss != null
				? Number(sh) * 3600 + Number(sm) * 60 + Number(ss)
				: Number(sh) * 60 + Number(sm);
		const endSec =
			es != null
				? Number(eh) * 3600 + Number(em) * 60 + Number(es)
				: Number(eh) * 60 + Number(em);
		const startMs = sms ? Number(`0.${sms}`) : 0;
		const endMs = ems ? Number(`0.${ems}`) : 0;
		return { startSec: startSec + startMs, endSec: endSec + endMs };
	}

	const startOnly = line.match(/^\[(\d+):(\d{2})(?::(\d{2}))?(?:\.(\d+))?\]\s*/);
	if (!startOnly) return null;
	const [, sh, sm, ss, sms] = startOnly;
	const startSec =
		ss != null
			? Number(sh) * 3600 + Number(sm) * 60 + Number(ss)
			: Number(sh) * 60 + Number(sm);
	const startMs = sms ? Number(`0.${sms}`) : 0;
	return { startSec: startSec + startMs, endSec: null };
}

export function hasTimedTranscript(transcript: string): boolean {
	return /^\[\d+:\d{2}/m.test(transcript);
}

export function formatTranscriptTimestamp(sec: number): string {
	const s = Math.max(0, Math.floor(sec));
	const h = Math.floor(s / 3600);
	const m = Math.floor((s % 3600) / 60);
	const ss = s % 60;
	if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
	return `${m}:${String(ss).padStart(2, '0')}`;
}

function parseCueTimestamp(ts: string): number {
	const t = ts.trim().replace(',', '.');
	const bits = t.split(':');
	if (bits.length === 3) {
		return Number(bits[0]) * 3600 + Number(bits[1]) * 60 + parseFloat(bits[2]);
	}
	if (bits.length === 2) {
		return Number(bits[0]) * 60 + parseFloat(bits[1]);
	}
	return parseFloat(t) || 0;
}

/** Format seconds as m:ss.ms with millisecond precision (for range end times). */
function formatTimestampWithMs(sec: number): string {
	const s = Math.max(0, sec);
	const whole = Math.floor(s);
	const ms = Math.round((s - whole) * 1000);
	const h = Math.floor(whole / 3600);
	const m = Math.floor((whole % 3600) / 60);
	const ss = whole % 60;
	const base =
		h > 0
			? `${h}:${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}`
			: `${m}:${String(ss).padStart(2, '0')}`;
	return ms > 0 ? `${base}.${String(ms).padStart(3, '0')}` : base;
}

/**
 * Convert VTT/SRT subtitle files to `[start->end] line` transcript.
 * Preserving end times lets captions display exactly during their cue window
 * instead of stretching across silent gaps between segments.
 */
export function timedTranscriptFromSubtitles(raw: string): string {
	const lines: string[] = [];
	const seen = new Set<string>();

	for (const block of raw.split(/\n\n+/)) {
		const blockLines = block
			.split('\n')
			.map((l) => l.trim())
			.filter(Boolean);
		let cueStart: number | null = null;
		let cueEnd: number | null = null;
		const textParts: string[] = [];

		for (const line of blockLines) {
			if (
				line.startsWith('WEBVTT') ||
				line.startsWith('NOTE') ||
				line.startsWith('Kind:') ||
				line.startsWith('Language:') ||
				/^\d+$/.test(line)
			) {
				continue;
			}
			const timeMatch = line.match(/^([\d:,.\-]+)\s+-->\s+([\d:,.\-]+)/);
			if (timeMatch) {
				cueStart = parseCueTimestamp(timeMatch[1]!);
				cueEnd = parseCueTimestamp(timeMatch[2]!);
				continue;
			}
			if (cueStart != null && !line.includes('-->')) {
				textParts.push(
					line
						.replace(/<[^>]+>/g, '')
						.replace(/\{[^}]+\}/g, '')
						.trim(),
				);
			}
		}

		const text = textParts.join(' ').replace(/\s+/g, ' ').trim();
		if (text && cueStart != null) {
			const spoken = stripSpeakerLabels(text);
			if (!spoken) continue;
			const key = `${Math.floor(cueStart * 100)}|${spoken.slice(0, 80)}`;
			if (!seen.has(key)) {
				seen.add(key);
				const startFmt = formatTimestampWithMs(cueStart);
				if (cueEnd != null && cueEnd > cueStart) {
					const endFmt = formatTimestampWithMs(cueEnd);
					lines.push(`[${startFmt}->${endFmt}] ${spoken}`);
				} else {
					lines.push(`[${startFmt}] ${spoken}`);
				}
			}
		}
	}

	if (lines.length > 0) return lines.join('\n');

	// Fallback: plain text without timestamps (legacy / malformed subs)
	const plain: string[] = [];
	const plainSeen = new Set<string>();
	for (const block of raw.split(/\n\n+/)) {
		const text = block
			.split('\n')
			.filter((l) => l && !l.startsWith('WEBVTT') && !/^\d+$/.test(l) && !/-->/.test(l))
			.join(' ')
			.replace(/<[^>]+>/g, '')
			.trim();
		if (text && !plainSeen.has(text)) {
			plainSeen.add(text);
			plain.push(text);
		}
	}
	return plain.join('\n');
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
		const text = cleanClipSpeechText(line.replace(/^\[[^\]]+\]\s*/, '').trim());
		if (!text) continue;
		const prev = parts[parts.length - 1];
		if (prev && prev.toLowerCase() === text.toLowerCase()) continue;
		parts.push(text);
	}
	return collapseRepeatedPhrases(parts.join(' '));
}

/**
 * Extract timed caption lines for a clip range, preserving `[start->end]` stamps.
 * Used for CapCut-style caption sync (word timing needs real cue times).
 */
export function excerptTimedLinesFromTranscript(
	transcript: string,
	startSec: number,
	endSec: number,
): string {
	const lines: string[] = [];
	const seen = new Set<string>();
	for (const line of transcript.split('\n')) {
		const range = parseTranscriptLineRange(line);
		if (!range) continue;
		const { startSec: t, endSec: lineEnd } = range;
		// Include if cue overlaps the clip window
		const cueEnd = lineEnd ?? t + 2;
		if (cueEnd < startSec - 0.25 || t > endSec + 0.25) continue;
		const rawText = line.replace(/^\[[^\]]+\]\s*/, '').trim();
		const text = collapseRepeatedPhrases(cleanClipSpeechText(rawText));
		if (!text) continue;
		// Skip punctuation-only noise (>>, …, etc.)
		if (!/[\p{L}\p{N}]/u.test(text)) continue;
		const key = `${Math.floor(t * 10)}|${text.slice(0, 60)}`;
		if (seen.has(key)) continue;
		seen.add(key);
		const stamp = line.match(/^\[[^\]]+\]/)?.[0] ?? `[${formatTranscriptTimestamp(t)}]`;
		lines.push(`${stamp} ${text}`);
	}
	return lines.join('\n');
}

export function transcriptCueStartsSec(transcript: string): number[] {
	const out: number[] = [];
	const seen = new Set<number>();
	for (const line of transcript.split('\n')) {
		const t = parseTranscriptLineSec(line);
		if (t == null) continue;
		const tt = Math.max(0, Math.round(t * 10) / 10);
		if (seen.has(tt)) continue;
		seen.add(tt);
		out.push(tt);
	}
	out.sort((a, b) => a - b);
	return out;
}

function lowerBound(arr: number[], x: number): number {
	let lo = 0;
	let hi = arr.length;
	while (lo < hi) {
		const mid = (lo + hi) >> 1;
		if (arr[mid]! < x) lo = mid + 1;
		else hi = mid;
	}
	return lo;
}

/**
 * Snap a [startSec, endSec] range to subtitle cue boundaries so exports don't cut mid-word.
 * If no cue data exists, returns the input range unchanged.
 */
export function snapRangeToTranscriptCues(params: {
	startSec: number;
	endSec: number;
	durationSec: number;
	minLenSec: number;
	maxLenSec: number;
	cueStartsSec: number[];
	startPadSec?: number;
	endPadSec?: number;
}): { startSec: number; endSec: number } {
	const dur = Math.max(0.5, Number(params.durationSec) || 0.5);
	const minLen = Math.max(0.5, Number(params.minLenSec) || 0.5);
	const maxLen = Math.max(minLen, Number(params.maxLenSec) || minLen);

	let start = Math.max(0, Number(params.startSec) || 0);
	let end = Math.max(start + 0.5, Number(params.endSec) || start + minLen);

	const cues = params.cueStartsSec;
	if (!cues.length) return { startSec: start, endSec: Math.min(dur, end) };

	const startPad = Math.max(0, Number(params.startPadSec) || 0);
	const endPad = Math.max(0, Number(params.endPadSec) || 0);

	// Prefer snapping to previous cue for start, next cue for end.
	const startIdx = Math.max(0, lowerBound(cues, start + startPad) - 1);
	start = cues[startIdx] ?? start;

	const endIdx = lowerBound(cues, end + endPad);
	end = cues[Math.min(cues.length - 1, endIdx)] ?? end;

	// Clamp to duration and length bounds.
	start = Math.max(0, Math.min(start, dur - 0.5));
	end = Math.max(start + minLen, Math.min(end, dur));
	if (end - start > maxLen) end = Math.min(dur, start + maxLen);

	return {
		startSec: Math.round(start * 10) / 10,
		endSec: Math.round(end * 10) / 10,
	};
}
