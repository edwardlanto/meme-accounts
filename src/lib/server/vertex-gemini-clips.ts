import { env } from '$env/dynamic/private';
import { getGoogleAccessToken, hasGoogleCredentials } from '$lib/server/google-access-token';
import { sandboxUserPlaintext } from '$lib/server/request-security';
import { buildFullVideoClips } from '$lib/video-clips/clip-segmentation';
import { excerptFromTimedTranscript } from '$lib/video-clips/transcript-segments';
import type { VideoClip } from '$lib/video-clips/types';
import { normalizeVideoClips } from '$lib/video-clips/normalize-clips';
import {
	demoNewsHeadlineFromClip,
	ensureNewsHeadlinesForClips,
	needsNewsHeadlineRewrite,
} from '$lib/server/news-headline-from-clip';
import { ensureVideoHooksForClips } from '$lib/server/video-hook-from-clip';
import {
	demoVideoHookFromClip,
	looksLikeRawVideoHook,
} from '$lib/video-clips/video-hook';

const CLIPS_SCHEMA = `{
  "clips": [
    {
      "id": "1",
      "title": "3-6 word topic headline (not meta like 'peak insight')",
      "startSec": 12.5,
      "endSec": 52.0,
      "viralityScore": 85,
      "hook": "Optional short label — prefer putting spoken words in transcript",
      "reason": "Internal note for editors only (not shown on posts)",
      "transcript": "Verbatim 1-3 sentences actually spoken in this segment",
      "newsHeadline": "ALL CAPS Slash/FutureTech news hook with [[highlighted]] impact phrases",
      "videoHook": "Casual sentence-case TikTok hook above the letterboxed clip"
    }
  ],
  "summary": "One paragraph overview of the best angles to clip from this video"
}`;

function parseClipsJson(raw: string): { clips: VideoClip[]; summary: string } {
	const cleaned = raw
		.replace(/^```json\s*/i, '')
		.replace(/^```\s*/i, '')
		.replace(/\s*```$/i, '')
		.trim();
	const data = JSON.parse(cleaned) as {
		clips?: unknown[];
		summary?: string;
	};
	const clips: VideoClip[] = [];
	for (const row of data.clips ?? []) {
		if (!row || typeof row !== 'object') continue;
		const o = row as Record<string, unknown>;
		const startSec = Number(o.startSec);
		const endSec = Number(o.endSec);
		if (!Number.isFinite(startSec) || !Number.isFinite(endSec) || endSec <= startSec) continue;
		const newsRaw = o.newsHeadline != null ? String(o.newsHeadline).trim() : '';
		const hookRaw = o.videoHook != null ? String(o.videoHook).trim() : '';
		const speechForCheck = o.transcript != null ? String(o.transcript) : '';
		clips.push({
			id: String(o.id ?? clips.length + 1),
			title: String(o.title ?? 'Clip').slice(0, 120),
			startSec: Math.max(0, startSec),
			endSec: endSec,
			viralityScore: Math.max(0, Math.min(100, Number(o.viralityScore) || 70)),
			hook: String(o.hook ?? '').slice(0, 280),
			reason: String(o.reason ?? '').slice(0, 500),
			transcript: o.transcript != null ? String(o.transcript).slice(0, 800) : undefined,
			newsHeadline:
				newsRaw &&
				!needsNewsHeadlineRewrite(newsRaw, {
					transcript: speechForCheck,
					videoTitle: undefined,
				})
					? newsRaw.slice(0, 320)
					: undefined,
			videoHook:
				hookRaw && !looksLikeRawVideoHook(hookRaw, speechForCheck)
					? hookRaw.slice(0, 140)
					: undefined,
		});
	}
	clips.sort((a, b) => b.viralityScore - a.viralityScore);
	return {
		clips,
		summary: String(data.summary ?? '').slice(0, 1200),
	};
}

function demoClips(
	durationSec: number,
	title: string,
	transcript: string,
	opts: { clipMinSec: number; clipMaxSec: number; clipCount: number; segmentAll: boolean },
): { clips: VideoClip[]; summary: string } {
	const dur = Math.max(1, Number(durationSec) || 1);
	if (opts.segmentAll) {
		const clips = buildFullVideoClips({
			durationSec: dur,
			clipMinSec: opts.clipMinSec,
			clipMaxSec: opts.clipMaxSec,
			fullTranscript: transcript,
			videoTitle: title,
		});
		return {
			clips,
			summary:
				'Demo mode: full-video segments. Add Vertex credentials for AI highlight detection.',
		};
	}

	const targetLen = Math.round((opts.clipMinSec + opts.clipMaxSec) / 2);
	const count = Math.max(1, Math.min(opts.clipCount, 40));
	const clips: VideoClip[] = [];

	for (let i = 0; i < count; i++) {
		const startSec = Math.round((dur / count) * i);
		let endSec = Math.min(dur, startSec + targetLen);
		endSec = Math.max(startSec + opts.clipMinSec, endSec);
		endSec = Math.min(dur, endSec);
		const excerpt = excerptFromTimedTranscript(transcript, startSec, endSec);
		const quote = excerpt || title || 'Clip from your video';
		const shortTitle = excerpt
			? quote.split(/\s+/).slice(0, 6).join(' ').replace(/[.!?]+$/, '')
			: `Segment ${i + 1}`;
		const demoHook = quote.slice(0, 200);
		clips.push({
			id: String(i + 1),
			title: shortTitle,
			startSec,
			endSec,
			viralityScore: 88 - i * 5,
			hook: demoHook,
			reason: '',
			transcript: quote.slice(0, 800),
			newsHeadline: demoNewsHeadlineFromClip(
				{
					title: shortTitle,
					hook: demoHook,
					transcript: quote.slice(0, 800),
				},
				title,
			),
			videoHook: demoVideoHookFromClip(
				{
					title: shortTitle,
					hook: demoHook,
					transcript: quote.slice(0, 800),
				},
				title,
			),
		});
	}

	return {
		clips: normalizeVideoClips(clips, dur, opts.clipMinSec, opts.clipMaxSec),
		summary:
			'Demo mode: configure GOOGLE_SERVICE_ACCOUNT_JSON and VERTEX_PROJECT_ID for AI clip detection.',
	};
}

async function geminiGenerate(params: {
	parts: Record<string, unknown>[];
	accessToken: string;
}): Promise<string> {
	const projectId = env.VERTEX_PROJECT_ID;
	if (!projectId) throw new Error('Missing VERTEX_PROJECT_ID');
	const location = env.VERTEX_LOCATION ?? 'us-central1';
	const model = env.VERTEX_GEMINI_MODEL ?? 'gemini-2.0-flash-001';

	const endpoint = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/${model}:generateContent`;

	const res = await fetch(endpoint, {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${params.accessToken}`,
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({
			contents: [{ role: 'user', parts: params.parts }],
			generationConfig: {
				temperature: 0.35,
				maxOutputTokens: 8192,
				responseMimeType: 'application/json',
			},
		}),
	});

	if (!res.ok) {
		const body = await res.text();
		throw new Error(`Vertex Gemini error ${res.status}: ${body.slice(0, 500)}`);
	}

	const data = (await res.json()) as {
		candidates?: { content?: { parts?: { text?: string }[] } }[];
	};
	const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';
	if (!text.trim()) throw new Error('Empty response from Gemini');
	return text;
}

export async function analyzeVideoForClips(opts: {
	title: string;
	/** YouTube / source description for WHO/WHAT context */
	description?: string;
	channel?: string;
	durationSec: number;
	transcript: string;
	topicHint?: string;
	clipCount?: number;
	clipMinSec?: number;
	clipMaxSec?: number;
	segmentAll?: boolean;
	/** Optional inline video for multimodal (keep under ~18MB) */
	videoBytes?: Uint8Array;
	videoMime?: string;
}): Promise<{ clips: VideoClip[]; summary: string; demo: boolean; model?: string }> {
	const clipMinSec = Math.max(10, Math.min(180, opts.clipMinSec ?? 10));
	const clipMaxSec = Math.max(clipMinSec, Math.min(180, opts.clipMaxSec ?? 90));
	const segmentAll = !!opts.segmentAll;
	const want = segmentAll
		? 40
		: Math.max(1, Math.min(40, opts.clipCount ?? 8));
	const durationSec = Math.max(1, Number(opts.durationSec) || 1);
	const newsHeadlineCtx = {
		videoTitle: opts.title,
		description: opts.description,
		channel: opts.channel,
	};

	if (segmentAll) {
		const clips = normalizeVideoClips(
			buildFullVideoClips({
				durationSec,
				clipMinSec,
				clipMaxSec,
				fullTranscript: opts.transcript,
				videoTitle: opts.title,
			}),
			durationSec,
			clipMinSec,
			clipMaxSec,
		);
		return {
			clips,
			summary: `Split the full video into ${clips.length} clips (~${Math.round((clipMinSec + clipMaxSec) / 2)}s each).`,
			demo: !hasGoogleCredentials(),
		};
	}

	if (!hasGoogleCredentials()) {
		const demo = demoClips(durationSec, opts.title, opts.transcript, {
			clipMinSec,
			clipMaxSec,
			clipCount: want,
			segmentAll: false,
		});
		const withNews = await ensureNewsHeadlinesForClips(demo.clips, newsHeadlineCtx);
		const withHooks = await ensureVideoHooksForClips(withNews, newsHeadlineCtx);
		return { ...demo, clips: withHooks, demo: true };
	}

	const transcriptBlock = sandboxUserPlaintext('TRANSCRIPT', opts.transcript.slice(0, 120_000), 120_000);
	const hint = opts.topicHint?.trim()
		? sandboxUserPlaintext('HINT', opts.topicHint, 600)
		: '';

	const prompt = `You are Opus Clip — an expert short-form video editor. Find the ${want} best vertical clips from this long-form video.

Rules:
- Each clip must be ${clipMinSec}–${clipMaxSec} seconds long (endSec - startSec).
- Each clip must be self-contained; transcript must be VERBATIM spoken words from that segment (quote what they say).
- Do NOT write meta slogans like "the clearest explanation", "stops the scroll", "don't skip", or "impossible to ignore" — only real dialogue/narration in transcript; newsHeadline must be a specific invented title for THIS clip.
- title is a short topic headline (3-6 words), not a label about virality.
- Each clip MUST have a unique title and transcript based on what is actually said in that time range — never repeat the full video title for every clip.
- reason is for editors only (optional); transcript is what appears on social posts.
- newsHeadline is a separate News-template overlay hook. NEVER paste or lightly edit the transcript — invent a Slash / FutureTech viral-news TITLE for this moment:
  - ALL CAPS, third-person news voice (not first-person speech)
  - 12–28 words, one complete thought (never cut mid-sentence)
  - MUST cover WHO (person/role from video title, channel, or description), WHAT the clip is about, and a HYPE / stakes angle
  - Ground ONLY in facts/claims in the video title + description + channel + this segment — do not invent names, numbers, or events
  - Prefer conflict, confession, money, career stakes, contrast, or a twist when present
  - Wrap 1–3 impact phrases in [[...]] for highlight (plain phrases only — never grad(, marker(, pattern(, or #hex: inside brackets)
  - No hashtags, no emojis, no quotation marks around the whole line
  - FORBIDDEN: "STOPS THE SCROLL", "SKIP THE SCROLL", "DON'T SKIP", "IMPOSSIBLE TO IGNORE", "INSIDE [[x]] — THE MOMENT THAT…"
  - Invent a unique title per clip — never reuse a slogan template
  - Examples of the STYLE (do not copy these facts — invent nothing; mirror the cadence from THIS clip):
    - [[PATRICK MAHOMES]] BREAKS DOWN THE PLAY THAT [[ALMOST COST]] THE CHIEFS THE SEASON
    - THIS FOUNDER WON'T [[CONFIRM OR DENY]] THE ACCUSATIONS — BUT ADMITS THERE WAS [[PRE-MEDITATION]]
    - A 20-YEAR-OLD SPENT [[$20 ON CLAUDE]], BUILT AN AI SPEED RADAR IN 9 DAYS, AND [[SOLD IT FOR $317K]]
- videoHook is a SEPARATE casual line for Hook / Creator / Highlight video templates (white text above a clip on black):
  - Sentence case — NEVER ALL CAPS
  - 6–14 words (~2 short lines max), curiosity / discomfort / irony (sounds like a TikTok comment)
  - Do NOT paste the transcript; invent a short hook ABOUT the moment
  - Optional single emoji at the end
  - For Highlight template cadence, wrap ONE impact word/phrase in [[...]] (renders neon + bold), e.g. "[[Entrepreneur]] reveals the secret…"
  - Examples of cadence: "One of the most uncomfortable live interviews ever 💀", "[[Entrepreneur]] reveals the secret to finding billion-dollar ideas:"
- startSec/endSec must be within 0 and ${durationSec} seconds.
- Clips must not overlap heavily.
- viralityScore is 0–100 (higher = more likely to go viral on TikTok/Reels/Shorts).
- Return ONLY valid JSON matching this schema (no markdown):
${CLIPS_SCHEMA}

Video title: ${opts.title}
Channel: ${opts.channel?.trim() || '(unknown)'}
Duration seconds: ${durationSec}
${opts.description?.trim() ? sandboxUserPlaintext('DESCRIPTION', opts.description.trim().slice(0, 3500), 3500) : ''}
${hint}
${transcriptBlock}

When writing newsHeadline and videoHook, use TITLE + CHANNEL + DESCRIPTION for who/what the video is about, and the CLIP transcript for what happens in this moment.`;

	try {
		const accessToken = await getGoogleAccessToken();
		const parts: Record<string, unknown>[] = [];

		if (opts.videoBytes && opts.videoMime && opts.videoBytes.byteLength > 0) {
			const maxInline = 18 * 1024 * 1024;
			const slice =
				opts.videoBytes.byteLength > maxInline ? opts.videoBytes.slice(0, maxInline) : opts.videoBytes;
			const { bytesToBase64 } = await import('$lib/server/video-pipeline');
			parts.push({
				inlineData: {
					mimeType: opts.videoMime,
					data: bytesToBase64(slice),
				},
			});
		}

		parts.push({ text: prompt });

		const model = env.VERTEX_GEMINI_MODEL ?? 'gemini-2.0-flash-001';
		const text = await geminiGenerate({ parts, accessToken });
		const parsed = parseClipsJson(text);
		// Clamp clip ranges to duration
		const clips = normalizeVideoClips(
			parsed.clips.map((c) => {
				const excerpt = excerptFromTimedTranscript(
					opts.transcript,
					c.startSec,
					c.endSec,
				);
				const transcript =
					(c.transcript?.trim() && c.transcript.length > 12
						? c.transcript
						: excerpt) || c.transcript;
				return { ...c, transcript };
			}),
			durationSec,
			clipMinSec,
			clipMaxSec,
		);

		const withNews = await ensureNewsHeadlinesForClips(clips.slice(0, want), newsHeadlineCtx);
		const withHooks = await ensureVideoHooksForClips(withNews, newsHeadlineCtx);
		return {
			clips: withHooks,
			summary: parsed.summary,
			demo: false,
			model,
		};
	} catch (e) {
		console.error('[vertex-gemini-clips]', e);
		const demo = demoClips(durationSec, opts.title, opts.transcript, {
			clipMinSec,
			clipMaxSec,
			clipCount: want,
			segmentAll: false,
		});
		const withNews = await ensureNewsHeadlinesForClips(demo.clips, newsHeadlineCtx);
		const withHooks = await ensureVideoHooksForClips(withNews, newsHeadlineCtx);
		return { ...demo, clips: withHooks, demo: true };
	}
}
