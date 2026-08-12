import { env } from '$env/dynamic/private';
import type { VideoClip } from '$lib/video-clips/types';
import { cleanClipSpeechText } from '$lib/video-clips/transcript-segments';
import {
	clampNewsHeadline,
	demoNewsHeadlineFromClip,
	headlineEchoesVideoTitle,
	looksLikeRawSpeechHeadline,
	needsNewsHeadlineRewrite,
	newsHeadlineDedupeKey,
} from '$lib/video-clips/news-headline';

export {
	demoNewsHeadlineFromClip,
	looksLikeRawSpeechHeadline,
	needsNewsHeadlineRewrite,
	headlineEchoesVideoTitle,
	newsHeadlineDedupeKey,
	clampNewsHeadline,
} from '$lib/video-clips/news-headline';

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

const REWRITE_PROMPT = `You write viral Instagram NEWS overlay headlines in Slash / FutureTech style.

Use the VIDEO TITLE, CHANNEL, DESCRIPTION, and CLIP TRANSCRIPT together so you understand:
- WHO is in the video / who the clip is about
- WHAT THIS SPECIFIC MOMENT is about (not the whole episode)
- WHY it is interesting (hype / stakes)

Your job is to INVENT a specific news title for THIS clip — not fill a template, and not restate the episode title.

Rules:
- ALL CAPS
- 12–28 words, ONE complete thought that could stand alone as a news chyron
- NEVER cut mid-sentence. The LAST word must be a content word (noun, proper name, verb, or adjective).
- NEVER end on: THE, A, AN, TO, OF, AND, OR, BUT, IN, FOR, MY, IS, ARE, WAS, WHICH, THAT, WITH, FROM, ABOUT, INTO, BEFORE, AFTER, HIS, HER, THEIR, THIS, THESE, HAVE, WILL, CAN, I, I'M, WE, OKAY
- Third-person news voice — never first-person transcript ("I'M NOT GOING TO…", "OKAY BEFORE I…", "BUT NOW THANKS TO…")
- Ground ONLY in facts from title + description + channel + this clip's speech — do not invent names, numbers, or events
- Prefer naming people/roles from the title or description when present
- The headline MUST reflect what is SAID in this clip's transcript — a viewer should tell clips apart by title alone
- Prefer conflict, confession, money, career stakes, contrast, or a twist when present
- Wrap 1–3 impact phrases in [[...]] (plain phrases only — never grad(, marker(, pattern(, or #hex:)
- No hashtags, no emojis, no quotes around the whole line
- FORBIDDEN phrases (never use): "STOPS THE SCROLL", "SKIP THE SCROLL", "DON'T SKIP", "IMPOSSIBLE TO IGNORE", "THE MOMENT THAT STOPS", "INSIDE [[…]] — THE MOMENT"
- Do NOT copy or lightly rephrase the video title for every clip
- Do NOT paste or lightly edit the transcript — invent a title ABOUT the moment
- NEVER return a word-truncated slice of the transcript (bad: "TO ALULOSE WHICH IS A TRUE" / "OKAY BEFORE I GET INTO MY")
- Each headline must be unique to this clip's facts — no generic hype slogans
- Return ONLY the headline line`;

function acceptsHeadline(
	cleaned: string,
	speech: string,
	videoTitle: string,
	avoid: string[],
): boolean {
	if (looksLikeRawSpeechHeadline(cleaned, speech)) return false;
	if (headlineEchoesVideoTitle(cleaned, videoTitle) && speech.length >= 24) return false;
	const key = newsHeadlineDedupeKey(cleaned);
	if (avoid.some((h) => newsHeadlineDedupeKey(h) === key)) return false;
	return true;
}

export async function rewriteNewsHeadlineForClip(
	clip: VideoClip,
	ctx: NewsHeadlineContext = {},
	opts?: { avoidHeadlines?: string[]; extraInstruction?: string },
): Promise<string | null> {
	const speech = cleanClipSpeechText(
		clip.transcript?.trim() || clip.hook?.trim() || clip.title?.trim() || '',
	);
	const videoTitle = String(ctx.videoTitle ?? '').trim();
	const description = String(ctx.description ?? '').trim().slice(0, 1800);
	const channel = String(ctx.channel ?? '').trim().slice(0, 200);
	if (speech.length < 12 && !videoTitle && !description) return null;

	const avoid = (opts?.avoidHeadlines ?? [])
		.map((h) => h.trim())
		.filter(Boolean)
		.slice(0, 12);
	const avoidBlock =
		avoid.length > 0
			? `\nAlready used for OTHER clips in this batch — write something DIFFERENT (do not paraphrase these):\n${avoid
					.map((h, i) => `${i + 1}. ${h}`)
					.join('\n')}\n`
			: '';
	const extra = opts?.extraInstruction?.trim()
		? `\n\nIMPORTANT RETRY: ${opts.extraInstruction.trim()}`
		: '';

	const prompt = `${REWRITE_PROMPT}

Channel: ${channel || '(unknown)'}
Video title: ${videoTitle || '(unknown)'}
Video description:
"""
${description || '(none)'}
"""

Editor clip label: ${clip.title.slice(0, 80)}
Clip time: ${Math.round(clip.startSec)}s–${Math.round(clip.endSec)}s
${avoidBlock}
Clip transcript (this moment only — do NOT paste; invent a news title about THIS moment):
"""
${(speech || '(no transcript)').slice(0, 900)}
"""

Style examples (cadence only — invent nothing from these; write a NEW title for the clip above):
- [[PATRICK MAHOMES]] BREAKS DOWN THE PLAY THAT [[ALMOST COST]] THE CHIEFS THE SEASON
- THIS FOUNDER WON'T [[CONFIRM OR DENY]] THE ACCUSATIONS — BUT ADMITS THERE WAS [[PRE-MEDITATION]]
- [[YC STARTUP SCHOOL]]: A BUILDER WAS TALKING TO AN [[AI VERSION]] OF A PARTNER. THEN THE REAL ONE WALKED BY
- [[3 MEN]] FOUND DEAD AFTER A [[PRIVATE FLIGHT]] — INVESTIGATORS ARE NOW ASKING ABOUT THE PILOT${extra}`;

	for (const temperature of [0.75, 0.9, 1.05]) {
		const out = await openRouterComplete([{ role: 'user', content: prompt }], temperature, 160);
		if (!out) continue;
		const line = out
			.replace(/^["'`]+|["'`]+$/g, '')
			.replace(/^```.*\n?/g, '')
			.replace(/\n```$/g, '')
			.split('\n')
			.map((l) => l.trim())
			.find((l) => l.length >= 16);
		if (!line) continue;
		const cleaned = clampNewsHeadline(line, 320);
		if (!acceptsHeadline(cleaned, speech, videoTitle, avoid)) continue;
		return cleaned;
	}
	return null;
}

/** Ensure every clip has a unique AI news title grounded in that moment.
 * Always invent via rewrite — never trust Gemini/`titleFromExcerpt` speech slices. */
export async function ensureNewsHeadlinesForClips(
	clips: VideoClip[],
	ctx: NewsHeadlineContext | string = {},
): Promise<VideoClip[]> {
	const context: NewsHeadlineContext =
		typeof ctx === 'string' ? { videoTitle: ctx } : (ctx ?? {});
	const out: VideoClip[] = [];
	const usedKeys = new Set<string>();
	const usedPlain: string[] = [];

	for (const clip of clips) {
		const speech = clip.transcript || clip.hook;

		// Keep an existing headline only if it already passes every guard (incl. transcript-slice)
		const keepExisting =
			!!clip.newsHeadline?.trim() &&
			!needsNewsHeadlineRewrite(clip.newsHeadline, {
				transcript: speech,
				videoTitle: context.videoTitle,
				usedKeys,
			});

		if (keepExisting) {
			const key = newsHeadlineDedupeKey(clip.newsHeadline);
			usedKeys.add(key);
			usedPlain.push(clip.newsHeadline!);
			out.push(clip);
			continue;
		}

		let nextHeadline =
			(await rewriteNewsHeadlineForClip(clip, context, {
				avoidHeadlines: usedPlain,
			})) ?? '';

		// Post-check failed → force a second rewrite with an explicit completeness nudge
		if (
			!nextHeadline ||
			needsNewsHeadlineRewrite(nextHeadline, {
				transcript: speech,
				videoTitle: context.videoTitle,
				usedKeys,
			})
		) {
			nextHeadline =
				(await rewriteNewsHeadlineForClip(clip, context, {
					avoidHeadlines: usedPlain,
					extraInstruction:
						'Previous draft was a transcript fragment or incomplete. Invent a finished third-person news chyron (12–28 words). Do NOT paste spoken words. Never start with TO/AND/BUT/WHICH. Never end mid-phrase (MY, IS, TRUE, THE, TO…).',
				})) ?? '';
		}

		// Last resort: complete invented fallback — never word-truncated transcript
		if (
			!nextHeadline ||
			needsNewsHeadlineRewrite(nextHeadline, {
				transcript: speech,
				videoTitle: context.videoTitle,
				usedKeys,
			})
		) {
			nextHeadline = demoNewsHeadlineFromClip(clip, context.videoTitle);
		}

		const key = newsHeadlineDedupeKey(nextHeadline);
		if (key) usedKeys.add(key);
		usedPlain.push(nextHeadline);
		out.push({ ...clip, newsHeadline: nextHeadline });
	}
	return out;
}
