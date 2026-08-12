/** Audience / emotion / style directives shared by Studio, Bulk, and generation APIs. */

const STYLE_PROMPTS: Record<string, string> = {
	bold: 'High-energy bold: short punchy bursts, strong verbs, strategic emojis. Action-first.',
	editorial:
		'Magazine-quality editorial: elegant rhythm, thoughtful pacing. Reads like a great article.',
	minimal:
		'Clean and professional: structured, credible, business-appropriate. Clear hierarchy.',
};

const EMOTION_PROMPTS: Record<string, string> = {
	curious: 'Lean into curiosity gaps and open loops. Make them need the next slide.',
	urgent: 'Time pressure and stakes. Short sentences. Immediate action.',
	hopeful: 'Optimistic, forward-looking, possibility without fluff.',
	shocking: 'Surprising claims backed by concrete specifics. Stop the scroll.',
	calm: 'Steady, reassuring, clear. No hype. Trust over drama.',
	witty: 'Smart humor, light wordplay. Never mean-spirited.',
	inspiring: 'Uplifting, agency, "you can do this" energy with specific proof.',
};

export function generationStylePrompt(style: string | undefined): string {
	const key = String(style ?? '').trim().toLowerCase();
	return STYLE_PROMPTS[key] ?? STYLE_PROMPTS.bold!;
}

export function generationTonePromptSuffix(opts: {
	audience?: string;
	emotion?: string;
	style?: string;
}): string {
	let out = '';
	const audience = String(opts.audience ?? '').trim();
	if (audience) {
		out += `\nAUDIENCE: Write for ${audience.replace(/"/g, "'")}. Use language, examples, and stakes they care about.\n`;
	}
	const emotion = String(opts.emotion ?? '').trim().toLowerCase();
	if (emotion && EMOTION_PROMPTS[emotion]) {
		out += `\nEMOTION: ${EMOTION_PROMPTS[emotion]}\n`;
	}
	const style = String(opts.style ?? '').trim().toLowerCase();
	if (style && STYLE_PROMPTS[style]) {
		out += `\nSTYLE: ${STYLE_PROMPTS[style]}\n`;
	}
	return out;
}
