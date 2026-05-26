import { env } from '$env/dynamic/private';
import { getGoogleAccessToken, hasGoogleCredentials } from '$lib/server/google-access-token';
import { sandboxUserPlaintext } from '$lib/server/request-security';
import { buildFullVideoClips } from '$lib/video-clips/clip-segmentation';
import { excerptFromTimedTranscript } from '$lib/video-clips/transcript-segments';
import type { VideoClip } from '$lib/video-clips/types';
import { normalizeVideoClips } from '$lib/video-clips/normalize-clips';

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
      "transcript": "Verbatim 1-3 sentences actually spoken in this segment"
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
		clips.push({
			id: String(o.id ?? clips.length + 1),
			title: String(o.title ?? 'Clip').slice(0, 120),
			startSec: Math.max(0, startSec),
			endSec: endSec,
			viralityScore: Math.max(0, Math.min(100, Number(o.viralityScore) || 70)),
			hook: String(o.hook ?? '').slice(0, 280),
			reason: String(o.reason ?? '').slice(0, 500),
			transcript: o.transcript != null ? String(o.transcript).slice(0, 800) : undefined,
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
		clips.push({
			id: String(i + 1),
			title: quote.split(/\s+/).slice(0, 5).join(' '),
			startSec,
			endSec,
			viralityScore: 88 - i * 5,
			hook: quote.slice(0, 200),
			reason: '',
			transcript: quote.slice(0, 800),
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
		return { ...demo, demo: true };
	}

	const transcriptBlock = sandboxUserPlaintext('TRANSCRIPT', opts.transcript.slice(0, 120_000), 120_000);
	const hint = opts.topicHint?.trim()
		? sandboxUserPlaintext('HINT', opts.topicHint, 600)
		: '';

	const prompt = `You are Opus Clip — an expert short-form video editor. Find the ${want} best vertical clips from this long-form video.

Rules:
- Each clip must be ${clipMinSec}–${clipMaxSec} seconds long (endSec - startSec).
- Each clip must be self-contained; transcript must be VERBATIM spoken words from that segment (quote what they say).
- Do NOT write meta descriptions like "the clearest explanation" or "moment that stops the scroll" — only real dialogue/narration.
- title is a short topic headline (3-6 words), not a label about virality.
- reason is for editors only (optional); transcript is what appears on social posts.
- startSec/endSec must be within 0 and ${durationSec} seconds.
- Clips must not overlap heavily.
- viralityScore is 0–100 (higher = more likely to go viral on TikTok/Reels/Shorts).
- Return ONLY valid JSON matching this schema (no markdown):
${CLIPS_SCHEMA}

Video title: ${opts.title}
Duration seconds: ${durationSec}
${hint}
${transcriptBlock}`;

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

		return {
			clips: clips.slice(0, want),
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
		return { ...demo, demo: true };
	}
}
