/**
 * Shared topic refuse patterns for Studio prompts (client + server).
 * Keep narrow so normal news / edgy marketing still works.
 */

export type TopicSafetyResult =
	| { ok: true }
	| { ok: false; error: string; code: 'unsafe_topic' };

const SELF_HARM_REFUSE_MESSAGE =
	'That topic isn’t allowed. If you’re in crisis, call or text 988 (US). Try a different idea.';

const REFUSE_PATTERNS: { re: RegExp; message: string }[] = [
	{
		re: /\b(child\s*porn|csam|underage\s*sex|sexualiz(?:e|ing)\s*(?:a\s*)?(?:child|minor|kid)|kids?\s*(?:porn|nude|naked))\b/i,
		message: 'That topic isn’t allowed. Try a different idea.',
	},
	{
		re: /\b(how\s+to\s+(?:make|build|assemble)\s+(?:a\s+)?(?:bomb|explosive|pipe\s*bomb|molotov)|build\s+a\s+bomb)\b/i,
		message: 'That topic isn’t allowed. Try a different idea.',
	},
	{
		re: /\b(phish(?:ing)?|credential\s*harvest|steal\s+(?:passwords?|logins?)|write\s+(?:a\s+)?malware|ransomware\s+note)\b/i,
		message: 'That topic isn’t allowed. Try a different idea.',
	},
	{
		re: /\b(kill\s+(?:list|all\s+\w+)|how\s+to\s+(?:murder|assassinate)\b)/i,
		message: 'That topic isn’t allowed. Try a different idea.',
	},
	{
		re: /\b(suicid(?:e|al|es|ing)?|self[-\s]?harm(?:ing)?|self[-\s]?injur(?:y|ies|e|ing)?|kill\s+(?:my|your)?self|end\s+(?:my|your)\s+life|take\s+(?:my|your)\s+own\s+life|want\s+to\s+die|how\s+to\s+die)\b/i,
		message: SELF_HARM_REFUSE_MESSAGE,
	},
	{
		re: /\b(how\s+to\s+(?:cut|hang|overdose|poison)\s+(?:my|your)?self|ways\s+to\s+(?:kill|harm)\s+(?:my|your)?self)\b/i,
		message: SELF_HARM_REFUSE_MESSAGE,
	},
];

export const OUTPUT_UNSAFE_RE =
	/\b(child\s*porn|csam|underage\s*sex|pipe\s*bomb|how\s+to\s+make\s+a\s+bomb|credential\s*harvest|suicid(?:e|al)|self[-\s]?harm|kill\s+(?:my|your)?self)\b/i;

export function assessUserTopicSafety(...parts: Array<string | null | undefined>): TopicSafetyResult {
	const text = parts
		.map((p) => String(p ?? '').trim())
		.filter(Boolean)
		.join('\n')
		.slice(0, 20_000);
	if (!text) return { ok: true };
	for (const { re, message } of REFUSE_PATTERNS) {
		if (re.test(text)) return { ok: false, error: message, code: 'unsafe_topic' };
	}
	return { ok: true };
}

export function isUnsafeGeneratedCopy(text: string): boolean {
	return OUTPUT_UNSAFE_RE.test(String(text ?? ''));
}

/** Drop clearly unsafe strings from a generated list (keep order). */
export function filterUnsafeGeneratedStrings(items: string[]): string[] {
	return items
		.map((s) => String(s ?? '').trim())
		.filter((s) => s.length > 0 && !isUnsafeGeneratedCopy(s));
}

/**
 * Soft-scrub a single generated line. Returns '' if the whole line is unsafe.
 * Does not invent replacement copy — callers should retry or fall back.
 */
export function scrubGeneratedCopy(text: string): string {
	const t = String(text ?? '').trim();
	if (!t) return '';
	if (isUnsafeGeneratedCopy(t)) return '';
	return t;
}
