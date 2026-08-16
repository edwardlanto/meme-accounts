import { env } from '$env/dynamic/private';
import type { VideoClip } from '$lib/video-clips/types';
import { cleanClipSpeechText } from '$lib/video-clips/transcript-segments';
import {
	demoVideoHookFromClip,
	looksLikeRawVideoHook,
} from '$lib/video-clips/video-hook';

export type VideoHookContext = {
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
				'HTTP-Referer': 'https://memeaccounts.com',
				'X-Title': 'Meme Accounts',
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

const REWRITE_PROMPT = `You write short TikTok/Reels HOOK lines that sit above a letterboxed video on a black background.

These are casual, curiosity-driving one-liners — NOT news headlines.

Rules:
- Sentence case (NOT ALL CAPS)
- 6–14 words, one complete thought — must fit on TWO short lines above a 16:9 clip
- Sound like a real person hyping a clip in the comments: intrigue, discomfort, irony, or a twist
- Ground ONLY in facts from title + description + channel + this clip's speech — do not invent names or events
- Do NOT quote the speaker verbatim or paste the transcript
- Optionally wrap ONE punchy word or short phrase in [[...]] for emphasis (e.g. [[Entrepreneur]] reveals… or that [[broke the internet]]) — plain phrases only, no colors
- No hashtags, no quotation marks around the whole line
- One emoji is optional at the end (💀 😭 🔥 👀) — max one; omit if unsure
- FORBIDDEN: "stops the scroll", "don't skip", "you won't believe", "watch till the end", "the moment that"
- Return ONLY the hook line`;

export async function rewriteVideoHookForClip(
	clip: VideoClip,
	ctx: VideoHookContext = {},
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

Clip transcript (this moment — invent a casual hook ABOUT it, do not paste):
"""
${(speech || '(no transcript)').slice(0, 900)}
"""

Style examples (cadence only — invent nothing from these):
- One of the most uncomfortable live interviews ever 💀
- He gave a 10 second pitch that [[broke the internet]]
- He thought this was a compliment
- The part where the whole room goes silent
- She answered a question nobody expected`;

	for (const temperature of [0.9, 1.0]) {
		const out = await openRouterComplete([{ role: 'user', content: prompt }], temperature, 80);
		if (!out) continue;
		const line = out
			.replace(/^["'`]+|["'`]+$/g, '')
			.replace(/^```.*\n?/g, '')
			.replace(/\n```$/g, '')
			.split('\n')
			.map((l) => l.trim())
			.find((l) => l.length >= 12);
		if (!line) continue;
		const cleaned = line.slice(0, 140);
		if (looksLikeRawVideoHook(cleaned, speech)) continue;
		return cleaned;
	}
	return null;
}

/** Ensure every clip has a casual Hook-video title. */
export async function ensureVideoHooksForClips(
	clips: VideoClip[],
	ctx: VideoHookContext | string = {},
): Promise<VideoClip[]> {
	const context: VideoHookContext =
		typeof ctx === 'string' ? { videoTitle: ctx } : (ctx ?? {});
	const out: VideoClip[] = [];
	for (const clip of clips) {
		const speech = clip.transcript || clip.hook;
		if (!looksLikeRawVideoHook(clip.videoHook, speech)) {
			out.push(clip);
			continue;
		}
		const rewritten = await rewriteVideoHookForClip(clip, context);
		if (rewritten) {
			out.push({ ...clip, videoHook: rewritten });
		} else {
			out.push({
				...clip,
				videoHook: demoVideoHookFromClip(clip, context.videoTitle),
			});
		}
	}
	return out;
}
