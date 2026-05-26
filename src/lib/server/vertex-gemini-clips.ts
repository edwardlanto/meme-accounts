import { env } from '$env/dynamic/private';
import { getGoogleAccessToken, hasGoogleCredentials } from '$lib/server/google-access-token';
import { sandboxUserPlaintext } from '$lib/server/request-security';
import type { VideoClip } from '$lib/video-clips/types';

const CLIPS_SCHEMA = `{
  "clips": [
    {
      "id": "1",
      "title": "Short punchy title for the clip",
      "startSec": 12.5,
      "endSec": 52.0,
      "viralityScore": 85,
      "hook": "Opening hook line",
      "reason": "Why this moment will perform on Shorts/Reels/TikTok",
      "transcript": "Key quote from this segment"
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

function demoClips(durationSec: number, title: string): { clips: VideoClip[]; summary: string } {
	const dur = Math.max(60, durationSec || 600);
	const segments = [
		{ t: 0.02, len: 0.08, title: 'Strong cold open', hook: 'The moment that stops the scroll' },
		{ t: 0.18, len: 0.1, title: 'Peak insight', hook: 'The clearest explanation in the whole video' },
		{ t: 0.38, len: 0.09, title: 'Emotional beat', hook: 'Relatable story beat' },
		{ t: 0.55, len: 0.11, title: 'Contrarian take', hook: 'Unexpected angle viewers will debate' },
		{ t: 0.72, len: 0.1, title: 'Actionable payoff', hook: 'What to do next — concrete takeaway' },
	];
	const clips: VideoClip[] = segments.map((s, i) => {
		const startSec = Math.round(dur * s.t);
		const endSec = Math.min(dur, Math.round(startSec + dur * s.len));
		return {
			id: String(i + 1),
			title: s.title,
			startSec,
			endSec: Math.max(startSec + 15, endSec),
			viralityScore: 92 - i * 7,
			hook: s.hook,
			reason: 'Demo clip — connect Vertex AI (Gemini) for transcript + multimodal analysis.',
			transcript: `[${title}] segment ${i + 1}`,
		};
	});
	return {
		clips,
		summary:
			'Demo mode: configure GOOGLE_SERVICE_ACCOUNT_JSON and VERTEX_PROJECT_ID for AI clip detection like Opus Clip.',
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
	/** Optional inline video for multimodal (keep under ~18MB) */
	videoBytes?: Uint8Array;
	videoMime?: string;
}): Promise<{ clips: VideoClip[]; summary: string; demo: boolean; model?: string }> {
	const want = Math.max(3, Math.min(12, opts.clipCount ?? 8));
	const durationSec = Math.max(1, opts.durationSec || 600);

	if (!hasGoogleCredentials()) {
		const demo = demoClips(durationSec, opts.title);
		return { ...demo, demo: true };
	}

	const transcriptBlock = sandboxUserPlaintext('TRANSCRIPT', opts.transcript.slice(0, 120_000), 120_000);
	const hint = opts.topicHint?.trim()
		? sandboxUserPlaintext('HINT', opts.topicHint, 600)
		: '';

	const prompt = `You are Opus Clip — an expert short-form video editor. Find the ${want} best vertical clips (15–90 seconds each) from this long-form video.

Rules:
- Each clip must be self-contained with a strong hook in the first 2 seconds.
- Prefer moments with surprise, emotion, clear insight, controversy, or actionable advice.
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
		const clips = parsed.clips
			.map((c) => ({
				...c,
				startSec: Math.max(0, Math.min(c.startSec, durationSec - 5)),
				endSec: Math.min(durationSec, Math.max(c.endSec, c.startSec + 10)),
			}))
			.filter((c) => c.endSec - c.startSec >= 10 && c.endSec - c.startSec <= 120);

		return {
			clips: clips.slice(0, want),
			summary: parsed.summary,
			demo: false,
			model,
		};
	} catch (e) {
		console.error('[vertex-gemini-clips]', e);
		const demo = demoClips(durationSec, opts.title);
		return { ...demo, demo: true };
	}
}
