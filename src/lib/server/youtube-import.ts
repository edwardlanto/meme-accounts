/** Parse YouTube watch / shorts / youtu.be URLs → video id */
export function parseYoutubeVideoId(raw: string): string | null {
	const s = String(raw ?? '').trim();
	if (!s) return null;
	try {
		const u = new URL(s.startsWith('http') ? s : `https://${s}`);
		if (u.hostname === 'youtu.be') {
			const id = u.pathname.replace(/^\//, '').split('/')[0];
			return id && /^[\w-]{6,}$/.test(id) ? id : null;
		}
		if (u.hostname.includes('youtube.com') || u.hostname.includes('youtube-nocookie.com')) {
			if (u.pathname.startsWith('/shorts/')) {
				const id = u.pathname.split('/')[2];
				return id && /^[\w-]{11,}$/.test(id) ? id : null;
			}
			const v = u.searchParams.get('v');
			return v && /^[\w-]{6,}$/.test(v) ? v : null;
		}
	} catch {
		/* ignore */
	}
	return null;
}

type CaptionTrack = { baseUrl?: string; languageCode?: string };

function decodeTranscriptXml(xml: string): { text: string; start: number; dur: number }[] {
	const lines: { text: string; start: number; dur: number }[] = [];
	const re = /<text start="([^"]+)" dur="([^"]+)"[^>]*>([\s\S]*?)<\/text>/g;
	let m: RegExpExecArray | null;
	while ((m = re.exec(xml))) {
		const start = Number(m[1]);
		const dur = Number(m[2]);
		const text = m[3]
			.replace(/<[^>]+>/g, '')
			.replace(/&amp;/g, '&')
			.replace(/&lt;/g, '<')
			.replace(/&gt;/g, '>')
			.replace(/&quot;/g, '"')
			.replace(/&#39;/g, "'")
			.replace(/\n/g, ' ')
			.trim();
		if (text) lines.push({ text, start, dur });
	}
	return lines;
}

function linesToTranscript(lines: { text: string; start: number; dur: number }[]): string {
	return lines
		.map((l) => `[${formatTs(l.start)}] ${l.text}`)
		.join('\n');
}

function formatTs(sec: number): string {
	const s = Math.max(0, Math.floor(sec));
	const h = Math.floor(s / 3600);
	const m = Math.floor((s % 3600) / 60);
	const ss = s % 60;
	if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
	return `${m}:${String(ss).padStart(2, '0')}`;
}

export type YoutubeImportResult = {
	videoId: string;
	title: string;
	durationSec: number;
	thumbnailUrl: string;
	transcript: string;
	playbackUrl: string;
};

export async function importYoutubeVideo(url: string): Promise<YoutubeImportResult> {
	const videoId = parseYoutubeVideoId(url);
	if (!videoId) throw new Error('Invalid YouTube URL');

	const watchRes = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
		headers: {
			'User-Agent':
				'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
			'Accept-Language': 'en-US,en;q=0.9',
		},
	});
	if (!watchRes.ok) throw new Error('Could not load YouTube video page');
	const html = await watchRes.text();

	let title = 'YouTube video';
	const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
	if (titleMatch?.[1]) title = titleMatch[1].replace(/\s*-\s*YouTube\s*$/i, '').trim();

	let durationSec = 0;
	const lenMatch = html.match(/"lengthSeconds"\s*:\s*"(\d+)"/);
	if (lenMatch?.[1]) durationSec = Number(lenMatch[1]) || 0;

	let transcript = '';
	const captionMatch = html.match(/"captionTracks"\s*:\s*(\[[\s\S]*?\])\s*,\s*"/);
	if (captionMatch?.[1]) {
		try {
			const tracks = JSON.parse(captionMatch[1]) as CaptionTrack[];
			const en =
				tracks.find((t) => t.languageCode === 'en') ??
				tracks.find((t) => (t.languageCode ?? '').startsWith('en')) ??
				tracks[0];
			if (en?.baseUrl) {
				const capUrl = en.baseUrl.replace(/\\u0026/g, '&');
				const capRes = await fetch(capUrl);
				if (capRes.ok) {
					const xml = await capRes.text();
					transcript = linesToTranscript(decodeTranscriptXml(xml));
				}
			}
		} catch {
			/* fall through */
		}
	}

	if (!transcript.trim()) {
		transcript = `[No captions available for this video. Duration: ${formatTs(durationSec)}. Analyze using title and estimated pacing.]`;
	}

	return {
		videoId,
		title,
		durationSec: durationSec || 1,
		thumbnailUrl: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
		transcript,
		playbackUrl: `https://www.youtube.com/embed/${videoId}?enablejsapi=1`,
	};
}
