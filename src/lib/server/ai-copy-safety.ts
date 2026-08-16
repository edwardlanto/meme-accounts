/**
 * Lightweight copy safety for Studio AI generate routes.
 * Input refuse + prompt rules + output scrub — not a full moderation stack.
 */

export {
	assessUserTopicSafety,
	filterUnsafeGeneratedStrings,
	isUnsafeGeneratedCopy,
	scrubGeneratedCopy,
	type TopicSafetyResult,
} from '$lib/topic-safety';

/** Append to system / user prompts for every copy-generation call. */
export const AI_COPY_SAFETY_RULES = `
COPY SAFETY (hard rules — never violate):
- Never create sexual content involving anyone 17 or under, or that sexualizes minors.
- Never write instructions for weapons, explosives, or violent crime.
- Never write phishing, credential theft, malware, or scam scripts.
- Never produce hate speech that attacks people for race, religion, ethnicity, gender, orientation, or disability.
- Never write about suicide, self-harm, or methods to hurt yourself or others — redirect to a safe, non-harmful public topic instead.
- Do not invent quotes from real named people or fake citations.
- Do not present medical, legal, or financial claims as guaranteed fact — use cautious, general language.
- If the topic is disallowed, write a short safe alternative about a related public, non-harmful angle instead of refusing mid-JSON.
`.trim();

export function withCopySafetyRules(prompt: string): string {
	const base = String(prompt ?? '').trimEnd();
	if (!base) return AI_COPY_SAFETY_RULES;
	if (base.includes('COPY SAFETY (hard rules')) return base;
	return `${base}\n\n${AI_COPY_SAFETY_RULES}`;
}
