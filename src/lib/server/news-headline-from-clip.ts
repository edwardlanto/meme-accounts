import { env } from '$env/dynamic/private';
import type { VideoClip } from '$lib/video-clips/types';
import { cleanClipSpeechText } from '$lib/video-clips/transcript-segments';
import {
	demoNewsHeadlineFromClip,
	looksLikeRawSpeechHeadline,
} from '$lib/video-clips/news-headline';

export { demoNewsHeadlineFromClip, looksLikeRawSpeechHeadline } from '$lib/video-clips/news-headline';

export type NewsHeadlineContext = {
	videoTitle?: string;
	description?: string;
	channel?: string;
};

async function openRouterComplete(
	messages: { role: string; content: string }[],
	temperature: number,
	max_tokens: number,
): Promise<string | null> {
	if (!env.OPENROUTER_API_KEY) return null;
	try {
		const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
				'Content-Type': 'application/json',
				'HTTP-Referer': 'https://carouselstudio.app',
				'X-Title': 'Carousel Studio',
			},
			body: JSON.stringify({
				model: 'anthropic/claude-sonnet-4.5',
				messages,
				temperature,
				max_tokens,
			}),
		});
		if (!r.ok) return null;
		const c = (await r.json()) as {
			choices?: { message?: { content?: string } }[];
		};
		return c.choices?.[0]?.message?.content?.trim() ?? null;
	} catch {
		return null;
	}
}

const REWRITE_PROMPT = `You write viral Instagram NEWS overlay headlines in Slash / FutureTech style.

Use the VIDEO TITLE, CHANNEL, DESCRIPTION, and CLIP TRANSCRIPT together so you understand:
- WHO is in the video / who the clip is about
- WHAT the video and this moment are about
- WHY it is interesting (hype / stakes)

Your job is NOT to quote the speaker. Write a third-person news hook.

Rules:
- ALL CAPS
- 12–28 words, ONE complete thought (never cut mid-sentence)
- Third-person news voice — never first-person transcript ("I'M NOT GOING TO…")
- Ground ONLY in facts from title + description + channel + this clip's speech — do not invent names, numbers, or events
- Prefer naming people/roles from the title or description when present
- Prefer conflict, confession, money, career stakes, contrast, or a twist when present
- Wrap 1–3 impact phrases in [[...]] (plain phrases only — never grad(, marker(, pattern(, or #hex:)
- No hashtags, no emojis, no quotes around the whole line
- Return ONLY the headline line`;

export async function rewriteNewsHeadlineForClip(
	clip: VideoClip,
	ctx: NewsHeadlineContext = {},
): Promise<string | null> {
	const speech = cleanClipSpeechText(
		clip.transcript?.trim() || clip.hook?.trim() || clip.title?.trim() || '',
	);
	const videoTitle = String(ctx.videoTitle ?? '').trim();
	const description = String(ctx.description ?? '').trim().slice(0, 1800);
	const channel = String(ctx.channel ?? '').trim().slice(0, 200);
	if (speech.length < 12 && !videoTitle && !description) return null;

	const prompt = `${REWRITE_PROMPT}

Channel: ${channel || '(unknown)'}
Video title: ${videoTitle || '(unknown)'}
Video description:
"""
${description || '(none)'}
"""

Editor clip label: ${clip.title.slice(0, 80)}

Clip transcript (this moment only — do NOT paste; rewrite into a headline):
"""
${(speech || '(no transcript)').slice(0, 900)}
"""

Style examples (cadence only — invent nothing from these):
- [[PATRICK MAHOMES]] BREAKS DOWN THE PLAY THAT [[ALMOST COST]] THE CHIEFS THE SEASON
- THIS FOUNDER WON'T [[CONFIRM OR DENY]] THE ACCUSATIONS — BUT ADMITS THERE WAS [[PRE-MEDITATION]]
- [[YC STARTUP SCHOOL]]: A BUILDER WAS TALKING TO AN [[AI VERSION]] OF A PARTNER. THEN THE REAL ONE WALKED BY`;

	const out = await openRouterComplete([{ role: 'user', content: prompt }], 0.7, 140);
	if (!out) return null;
	const line = out
		.replace(/^["'`]+|["'`]+$/g, '')
		.replace(/^```.*\n?/g, '')
		.replace(/\n```$/g, '')
		.split('\n')
		.map((l) => l.trim())
		.find((l) => l.length >= 16);
	if (!line) return null;
	const cleaned = line.slice(0, 320);
	if (looksLikeRawSpeechHeadline(cleaned, speech)) return null;
	return cleaned;
}

/** Ensure every clip has a real news hook — rewrite speech dumps via OpenRouter when needed. */
export async function ensureNewsHeadlinesForClips(
	clips: VideoClip[],
	ctx: NewsHeadlineContext | string = {},
): Promise<VideoClip[]> {
	const context: NewsHeadlineContext =
		typeof ctx === 'string' ? { videoTitle: ctx } : (ctx ?? {});
	const out: VideoClip[] = [];
	for (const clip of clips) {
		const speech = clip.transcript || clip.hook;
		if (!looksLikeRawSpeechHeadline(clip.newsHeadline, speech)) {
			out.push(clip);
			continue;
		}
		const rewritten = await rewriteNewsHeadlineForClip(clip, context);
		if (rewritten) {
			out.push({ ...clip, newsHeadline: rewritten });
		} else {
			out.push({
				...clip,
				newsHeadline: demoNewsHeadlineFromClip(clip, context.videoTitle),
			});
		}
	}
	return out;
}
