/**
 * Generate interesting demo posts for every Studio template.
 * Pulls Unsplash photos + Pexels videos, downloads them locally,
 * and writes `src/lib/studio/generated-demo-posts.ts`.
 *
 * Usage (dev server not required):
 *   node scripts/generate-template-demos.mjs
 *   node scripts/generate-template-demos.mjs --photos-only
 *   node scripts/generate-template-demos.mjs --skip-download   # rewrite TS from cache
 *   node scripts/generate-template-demos.mjs --only=video-source
 *
 * Then refresh covers:
 *   node scripts/capture-template-previews.mjs
 */
import { readFileSync } from 'node:fs';
import { mkdir, writeFile, access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUT_IMG = path.join(ROOT, 'static/templates/demos');
const OUT_VID = path.join(ROOT, 'static/videos/demos');
const OUT_TS = path.join(ROOT, 'src/lib/studio/generated-demo-posts.ts');
const CREDITS = path.join(OUT_IMG, 'CREDITS.md');

const args = new Set(process.argv.slice(2));
const PHOTOS_ONLY = args.has('--photos-only');
const SKIP_DOWNLOAD = args.has('--skip-download');
/** Regenerate copy via Claude; keep existing media files. */
const IDEAS_ONLY = args.has('--ideas') || args.has('--ideas-only');
const ONLY_ID = (() => {
	const raw = process.argv.find((a) => a.startsWith('--only='));
	return raw ? raw.slice('--only='.length).trim() : '';
})();

function loadEnv() {
	const env = { ...process.env };
	try {
		const raw = readFileSync(path.join(ROOT, '.env'), 'utf8');
		for (const line of raw.split('\n')) {
			const t = line.trim();
			if (!t || t.startsWith('#')) continue;
			const i = t.indexOf('=');
			if (i < 0) continue;
			const k = t.slice(0, i).trim();
			let v = t.slice(i + 1).trim();
			if (
				(v.startsWith('"') && v.endsWith('"')) ||
				(v.startsWith("'") && v.endsWith("'"))
			) {
				v = v.slice(1, -1);
			}
			if (!(k in env) || !env[k]) env[k] = v;
		}
	} catch {
		/* no .env */
	}
	try {
		const raw = readFileSync(path.join(ROOT, '.env.local'), 'utf8');
		for (const line of raw.split('\n')) {
			const t = line.trim();
			if (!t || t.startsWith('#')) continue;
			const i = t.indexOf('=');
			if (i < 0) continue;
			const k = t.slice(0, i).trim();
			let v = t.slice(i + 1).trim();
			if (
				(v.startsWith('"') && v.endsWith('"')) ||
				(v.startsWith("'") && v.endsWith("'"))
			) {
				v = v.slice(1, -1);
			}
			env[k] = v;
		}
	} catch {
		/* no .env.local */
	}
	return env;
}

const env = loadEnv();
const UNSPLASH = String(env.UNSPLASH_ACCESS_KEY || '').trim();
const PEXELS = String(env.PEXELS_API_KEY || '').trim();
const OPENROUTER = String(env.OPENROUTER_API_KEY || '').trim();
const CLAUDE_KEY = String(env.CLAUDE_API_KEY || '').trim();

if (!IDEAS_ONLY && !UNSPLASH) {
	console.error('Missing UNSPLASH_ACCESS_KEY in .env');
	process.exit(1);
}
if (!PHOTOS_ONLY && !PEXELS && !IDEAS_ONLY) {
	console.warn('No PEXELS_API_KEY — photo stills only for video templates');
}

/** Sleep to respect free-tier rate limits. */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Curated posts — one interesting concept per template.
 * Media queries are tuned for Unsplash / Pexels search.
 */
const POSTS = [
	{
		id: 'news',
		kind: 'photo',
		query: 'tokyo night city skyline neon rain',
		orientation: 'portrait',
		fields: {
			headline: 'SOFTBANK JUST PUT 2 $40B INTO OPENAI — WALL STREET BARELY FLINCHED',
			body:
				'The largest AI check ever written — and the market treated it like a Tuesday. SoftBank is all-in on the next decade of compute.',
			source: 'Markets',
			imageUrl: '/templates/demos/news.jpg',
		},
	},
	{
		id: 'image-quote',
		kind: 'photo',
		query: 'dramatic desert highway storm clouds cinematic',
		orientation: 'landscape',
		fields: {
			body:
				"THE COMPANIES WINNING THE NEXT DECADE AREN'T THE ONES WITH THE MOST DATA.\n\n" +
				"THEY'RE THE ONES THAT SHIP WHILE EVERYONE ELSE IS STILL IN A MEETING.",
			footerLeft: '$',
			footerRight: 'OPERATOR\nNOTES',
			imageUrl: '/templates/demos/image-quote.jpg',
			topRatio: 0.63,
		},
	},
	{
		id: 'tweet',
		kind: 'photo',
		query: 'artisanal coffee latte art close up',
		orientation: 'landscape',
		fields: {
			topName: 'Priya · Ops',
			topHandle: '@priyaops',
			bottomName: 'Jordan Lee',
			bottomHandle: '@jordanbuilds',
			topText: 'Hot take: your "AI strategy" is just ChatGPT with a Notion page.',
			bottomText: 'Correct. And that Notion page has 14 stakeholders and zero shipped features.',
			imageUrl: '/templates/demos/tweet.jpg',
		},
	},
	{
		id: 'text',
		kind: 'none',
		fields: {
			name: 'Signal Over Noise',
			handle: '@signalovernoise',
			body:
				'Most founders optimize for looking busy.\n\n' +
				'The dangerous ones optimize for one metric customers actually feel.',
		},
	},
	{
		id: 'black-text',
		kind: 'none',
		fields: {
			name: 'Lena Ortiz',
			handle: '@lenabuilds',
			headline: 'Charge more. Talk less. Ship weekly.',
			body:
				'Underpricing is a confidence problem dressed up as a pricing strategy.\n\n' +
				'Raise the price until the wrong customers leave.\n\n' +
				'Then build for the ones who stayed.',
		},
	},
	{
		id: 'video-feature',
		kind: 'video',
		query: 'startup office laptop coding night',
		photoQuery: 'modern workspace desk monitor ambient',
		orientation: 'landscape',
		fields: {
			headline: 'Claude just became the [[co-founder]] most teams were afraid to hire',
			body:
				'Brief it once. It remembers the codebase, the brand voice, and the deadlines. [[Ship tonight]]. Argue about process tomorrow.',
			highlightColor: '#2EE6C5',
			videoUrl: '/videos/demos/workspace.mp4',
			posterUrl: '/templates/demos/video-feature-poster.jpg',
		},
	},
	{
		id: 'video-source',
		kind: 'video',
		query: 'laptop coding neon desk night productivity',
		photoQuery: 'neon desk workspace code screen',
		orientation: 'portrait',
		fields: {
			headline:
				'[[Stop]] building features2 nobody asked for — the first dollar teaches you more than another month of "polish."',
			highlightColor: '#39FF14',
			videoUrl: '/videos/demos/highlight-hook.mp4',
			posterUrl: '/templates/demos/highlight-hook-poster.jpg',
		},
	},
	{
		id: 'video-text',
		kind: 'video',
		query: 'city night drive neon lights bokeh',
		photoQuery: 'neon tokyo street night rain',
		orientation: 'portrait',
		fields: {
			headline: 'POV: you finally deleted the roadmap and asked one customer what hurts',
			videoUrl: '/templates/demos/video-text-poster.mp4',
			posterUrl: '/templates/demos/video-text-poster.jpg',
		},
	},
	{
		id: 'video-creator',
		kind: 'video',
		query: 'young creator filming phone cafe',
		photoQuery: 'creator filming smartphone cafe',
		orientation: 'portrait',
		fields: {
			name: 'Revenue Lab',
			handle: '@revenuelab',
			headline: 'She turned a 12-person waitlist into [[$28k MRR]] without a single ad',
			videoUrl: '/videos/demos/creator-cafe.mp4',
			posterUrl: '/templates/demos/video-creator-poster.jpg',
		},
	},
	{
		id: 'video-hook',
		kind: 'video',
		query: 'intense interview conversation two people',
		photoQuery: 'serious interview conversation dark room',
		orientation: 'portrait',
		fields: {
			headline: 'The investor asked one question that ended the whole pitch',
			videoUrl: '/videos/demos/interview.mp4',
			posterUrl: '/templates/demos/video-hook-poster.jpg',
		},
	},
	{
		id: 'video-fit',
		kind: 'video',
		query: 'portrait person walking city street cinematic',
		photoQuery: 'cinematic portrait person city street',
		orientation: 'portrait',
		fields: {
			headline: '',
			videoUrl: '/videos/demos/street-portrait.mp4',
			posterUrl: '/templates/demos/video-fit-poster.jpg',
		},
	},
	{
		id: 'video-split',
		kind: 'video',
		query: 'two people conversation facing camera',
		photoQuery: 'two friends talking outdoor cafe',
		orientation: 'portrait',
		fields: {
			videoUrl: '/videos/demos/duo-talk.mp4',
			posterUrl: '/templates/demos/video-split-poster.jpg',
		},
	},
	{
		id: 'video-blur',
		kind: 'video',
		query: 'product unboxing hands close up',
		photoQuery: 'hands holding product packaging',
		orientation: 'portrait',
		fields: {
			headline: 'This $29 tool replaced a $400/mo subscription stack',
			videoUrl: '/videos/demos/product-hands.mp4',
			posterUrl: '/templates/demos/video-blur-poster.jpg',
		},
	},
	{
		id: 'video-story',
		kind: 'video',
		query: 'mentor teaching young employee office',
		photoQuery: 'mentor teaching colleague office window',
		orientation: 'portrait',
		fields: {
			watermark: 'OPERATOR LOG',
			headline:
				'She almost quit on a Tuesday.\n\nBy Friday the same manager who ignored her had to ask how she fixed the funnel.',
			videoUrl: '/videos/demos/mentor.mp4',
			posterUrl: '/templates/demos/video-story-poster.jpg',
		},
	},
	{
		id: 'video-post',
		kind: 'video',
		query: 'sports locker room celebration team',
		photoQuery: 'athletes celebrating locker room',
		orientation: 'landscape',
		fields: {
			name: 'Late Night Ops',
			handle: '@latenightops',
			headline: "The intern's 'dumb' idea just beat the entire growth team's A/B test 💀",
			videoUrl: '/videos/demos/team-win.mp4',
			posterUrl: '/templates/demos/video-post-poster.jpg',
			avatarUrl: '/templates/demos/video-post-avatar.jpg',
			avatarQuery: 'professional headshot young man smiling',
		},
	},
	{
		id: 'brand-stack',
		kind: 'video',
		query: 'security guard event crowd night',
		photoQuery: 'concert security crowd night lights',
		orientation: 'landscape',
		fields: {
			watermark: 'Clip Desk',
			headline:
				"This founder got escorted out of his own launch for arguing with the venue about accessibility 👀",
			brand: 'clipdesk.co/stories',
			videoUrl: '/videos/demos/crowd-night.mp4',
			posterUrl: '/templates/demos/brand-stack-poster.jpg',
			bottomMediaUrl: '/templates/demos/brand-stack-bottom.jpg',
			bottomQuery: 'stadium lights crowd abstract',
		},
	},
	{
		id: 'photo-caption',
		kind: 'photo',
		query: 'parent working laptop late night kitchen warm light',
		orientation: 'portrait',
		fields: {
			headline: 'No CS degree. No co-founder. No seed round.',
			body: 'Just a kitchen table, a sleeping toddler, and a product that hit $12k MRR before anyone knew her name.',
			imageUrl: '/templates/demos/photo-caption.jpg',
		},
	},
	{
		id: 'white-thread',
		kind: 'none',
		avatarQuery: 'couple portrait outdoor soft light',
		fields: {
			name: 'Ava & Marcus Chen',
			handle: '@avaandmarcus',
			avatarUrl: '/templates/demos/white-thread-avatar.jpg',
			body:
				"Eighteen months ago I couldn't climb our stairs.\n\n" +
				"Today I ran them twice — because Marcus cancelled his life to rebuild mine.\n\n" +
				"He learned every medication.\n\n" +
				"He sat through every silent hour.\n\n" +
				"He never made me feel like a burden.\n\n" +
				'If you have someone like that: tell them tonight.',
		},
	},
	{
		id: 'white-media',
		kind: 'photo',
		query: 'ancient manuscript illuminated art close up texture',
		orientation: 'portrait',
		avatarQuery: 'creative woman portrait studio neutral',
		fields: {
			name: 'archive hours',
			handle: '@archivehours',
			avatarUrl: '/templates/demos/white-media-avatar.jpg',
			imageUrl: '/templates/demos/white-media-attachment.jpg',
			body:
				"This illustration is 400 years old.\n\n" +
				"It was sitting in a museum basement until a 19-year-old posted a crop of it.\n\n" +
				"Now every brand is stealing the palette.",
		},
	},
];

const credits = [];

async function exists(p) {
	try {
		await access(p);
		return true;
	} catch {
		return false;
	}
}

async function download(url, dest) {
	const res = await fetch(url, {
		headers: { 'User-Agent': 'svelte-social-poster-demo-gen/1.0' },
		redirect: 'follow',
	});
	if (!res.ok) throw new Error(`Download ${res.status} ${url.slice(0, 80)}`);
	const buf = Buffer.from(await res.arrayBuffer());
	await mkdir(path.dirname(dest), { recursive: true });
	await writeFile(dest, buf);
	return buf.length;
}

async function unsplashSearch(query, orientation = 'portrait') {
	const endpoint = new URL('https://api.unsplash.com/search/photos');
	endpoint.searchParams.set('query', query);
	endpoint.searchParams.set('per_page', '8');
	endpoint.searchParams.set('orientation', orientation);
	endpoint.searchParams.set('content_filter', 'high');
	const res = await fetch(endpoint, {
		headers: {
			Authorization: `Client-ID ${UNSPLASH}`,
			'Accept-Version': 'v1',
		},
	});
	const data = await res.json().catch(() => ({}));
	if (!res.ok) {
		throw new Error(data?.errors?.[0] || `Unsplash ${res.status}`);
	}
	const results = Array.isArray(data.results) ? data.results : [];
	const hit = results.find((p) => p?.urls?.regular || p?.urls?.full) || results[0];
	if (!hit) throw new Error(`No Unsplash results for "${query}"`);
	const raw = String(hit.urls.raw || hit.urls.full || hit.urls.regular);
	const downloadUrl = `${raw}&w=1600&q=85&fm=jpg&fit=crop`;
	return {
		id: hit.id,
		downloadUrl,
		photographer: hit.user?.name || 'Unknown',
		username: hit.user?.username || '',
		link: hit.links?.html || '',
		downloadLocation: hit.links?.download_location || '',
	};
}

async function triggerUnsplashDownload(downloadLocation) {
	if (!downloadLocation) return;
	try {
		await fetch(downloadLocation, {
			headers: { Authorization: `Client-ID ${UNSPLASH}` },
		});
	} catch {
		/* best-effort Hotlink compliance ping */
	}
}

async function pexelsVideoSearch(query, orientation = 'portrait') {
	if (!PEXELS) return null;
	const endpoint = new URL('https://api.pexels.com/videos/search');
	endpoint.searchParams.set('query', query);
	endpoint.searchParams.set('per_page', '6');
	endpoint.searchParams.set('orientation', orientation);
	const res = await fetch(endpoint, { headers: { Authorization: PEXELS } });
	const data = await res.json().catch(() => ({}));
	if (!res.ok) throw new Error(data?.error || `Pexels ${res.status}`);
	const videos = Array.isArray(data.videos) ? data.videos : [];
	for (const v of videos) {
		const files = Array.isArray(v.video_files) ? v.video_files : [];
		const mp4s = files.filter(
			(f) => String(f.file_type || '').includes('mp4') && f.link,
		);
		if (!mp4s.length) continue;
		mp4s.sort((a, b) => Math.abs((a.width || 0) - 720) - Math.abs((b.width || 0) - 720));
		const file = mp4s[0];
		const thumb = v.image || v.video_pictures?.[0]?.picture || '';
		return {
			id: v.id,
			url: file.link,
			thumb,
			photographer: v.user?.name || 'Unknown',
			duration: v.duration || 0,
		};
	}
	return null;
}

async function fetchPhotoTo(query, destRel, orientation) {
	const abs = path.join(ROOT, 'static', destRel.replace(/^\//, ''));
	if (await exists(abs)) {
		console.log('  reuse photo', destRel);
		return destRel;
	}
	let lastErr;
	for (let attempt = 0; attempt < 4; attempt++) {
		try {
			const photo = await unsplashSearch(query, orientation);
			await triggerUnsplashDownload(photo.downloadLocation);
			const bytes = await download(photo.downloadUrl, abs);
			credits.push(
				`- ${destRel} — Photo by [${photo.photographer}](https://unsplash.com/@${photo.username}) on [Unsplash](${photo.link || 'https://unsplash.com'})`,
			);
			console.log(`  photo ${destRel} (${Math.round(bytes / 1024)}KB) ← ${photo.photographer}`);
			await sleep(600);
			return destRel;
		} catch (err) {
			lastErr = err;
			const msg = String(err?.message || err);
			if (msg.includes('403') || msg.includes('429') || msg.includes('Rate')) {
				console.warn(`  Unsplash throttle (${msg}) — waiting…`);
				await sleep(2500 * (attempt + 1));
				continue;
			}
			break;
		}
	}
	if (PEXELS) {
		try {
			const p = await pexelsPhotoSearch(query, orientation);
			if (p) {
				const bytes = await download(p.url, abs);
				credits.push(`- ${destRel} — Photo by ${p.photographer} on Pexels`);
				console.log(`  photo ${destRel} (${Math.round(bytes / 1024)}KB) ← Pexels/${p.photographer}`);
				await sleep(400);
				return destRel;
			}
		} catch (err) {
			console.warn('  Pexels photo fallback failed', err?.message || err);
		}
	}
	throw lastErr || new Error(`No photo for "${query}"`);
}

async function pexelsPhotoSearch(query, orientation = 'portrait') {
	if (!PEXELS) return null;
	const endpoint = new URL('https://api.pexels.com/v1/search');
	endpoint.searchParams.set('query', query);
	endpoint.searchParams.set('per_page', '8');
	endpoint.searchParams.set('orientation', orientation === 'squarish' ? 'square' : orientation);
	const res = await fetch(endpoint, { headers: { Authorization: PEXELS } });
	const data = await res.json().catch(() => ({}));
	if (!res.ok) throw new Error(data?.error || `Pexels photo ${res.status}`);
	const photos = Array.isArray(data.photos) ? data.photos : [];
	const hit = photos[0];
	if (!hit) return null;
	return {
		url: hit.src?.large2x || hit.src?.large || hit.src?.original,
		photographer: hit.photographer || 'Unknown',
	};
}

async function fetchVideoTo(query, destRel, posterRel, orientation) {
	const abs = path.join(ROOT, 'static', destRel.replace(/^\//, ''));
	const posterAbs = path.join(ROOT, 'static', posterRel.replace(/^\//, ''));

	if ((await exists(abs)) && (await exists(posterAbs))) {
		console.log('  reuse video', destRel);
		return { videoUrl: destRel, posterUrl: posterRel };
	}

	if (PHOTOS_ONLY || !PEXELS) {
		await fetchPhotoTo(query, posterRel, orientation === 'landscape' ? 'landscape' : 'portrait');
		return { videoUrl: (await exists(abs)) ? destRel : '', posterUrl: posterRel };
	}

	if (!(await exists(abs))) {
		const vid = await pexelsVideoSearch(query, orientation);
		if (!vid) {
			console.warn(`  no Pexels video for "${query}" — poster only`);
			await fetchPhotoTo(query, posterRel, orientation === 'landscape' ? 'landscape' : 'portrait');
			return { videoUrl: '', posterUrl: posterRel };
		}

		const bytes = await download(vid.url, abs);
		credits.push(
			`- ${destRel} — Video by ${vid.photographer} on Pexels (id ${vid.id})`,
		);
		console.log(`  video ${destRel} (${Math.round(bytes / 1024)}KB) ← ${vid.photographer}`);

		if (!(await exists(posterAbs))) {
			if (vid.thumb) {
				try {
					await download(vid.thumb, posterAbs);
					credits.push(`- ${posterRel} — Pexels poster frame`);
				} catch {
					await fetchPhotoTo(query, posterRel, orientation === 'landscape' ? 'landscape' : 'portrait');
				}
			} else {
				await fetchPhotoTo(query, posterRel, orientation === 'landscape' ? 'landscape' : 'portrait');
			}
		}
		await sleep(500);
	} else if (!(await exists(posterAbs))) {
		await fetchPhotoTo(query, posterRel, orientation === 'landscape' ? 'landscape' : 'portrait');
	}

	return { videoUrl: destRel, posterUrl: posterRel };
}

function tsString(s) {
	return JSON.stringify(s ?? '');
}

function buildTs(resolved) {
	const lines = [
		'/**',
		' * Auto-generated by `scripts/generate-template-demos.mjs`.',
		' * Do not edit by hand — re-run the script to refresh media + copy.',
		' */',
		'',
		'export const GENERATED_DEMO_POSTS = {',
	];

	for (const post of resolved) {
		lines.push(`\t${JSON.stringify(post.id)}: {`);
		for (const [k, v] of Object.entries(post.fields)) {
			if (v === undefined || v === null) continue;
			if (k === 'bottomQuery' || k === 'avatarQuery' || k === 'photoQuery') continue;
			if (typeof v === 'number') {
				lines.push(`\t\t${k}: ${v},`);
			} else {
				lines.push(`\t\t${k}: ${tsString(String(v))},`);
			}
		}
		lines.push('\t},');
	}

	lines.push('} as const;');
	lines.push('');
	lines.push('export type GeneratedDemoId = keyof typeof GENERATED_DEMO_POSTS;');
	lines.push('');
	return lines.join('\n');
}

/** Shared fallback video path used when a slot has no download. */
const FALLBACK_VIDEO = '/videos/demos/founder-talk.mp4';
const FALLBACK_POSTER = '/templates/demos/video-source-poster.jpg';

async function main() {
	await mkdir(OUT_IMG, { recursive: true });
	await mkdir(OUT_VID, { recursive: true });

	const resolved = [];

	for (const post of POSTS) {
		const skipMedia = ONLY_ID && post.id !== ONLY_ID;
		if (!skipMedia) console.log(`\n[${post.id}]`);
		else if (ONLY_ID) {
			/* keep catalog entry without re-fetching media */
		}
		const fields = { ...post.fields };

		if (!skipMedia && !SKIP_DOWNLOAD) {
			if (post.kind === 'photo' && fields.imageUrl) {
				await fetchPhotoTo(
					post.query,
					fields.imageUrl.replace(/^\//, ''),
					post.orientation || 'portrait',
				);
			} else if (post.kind === 'video') {
				const videoRel = fields.videoUrl.replace(/^\//, '');
				const posterRel = fields.posterUrl.replace(/^\//, '');
				const got = await fetchVideoTo(
					post.query,
					videoRel,
					posterRel,
					post.orientation || 'portrait',
				);
				fields.videoUrl = got.videoUrl ? `/${got.videoUrl}` : '';
				fields.posterUrl = `/${got.posterUrl}`;
				if (fields.bottomMediaUrl && post.fields.bottomQuery) {
					await fetchPhotoTo(
						post.fields.bottomQuery,
						fields.bottomMediaUrl.replace(/^\//, ''),
						'landscape',
					);
				}
				if (fields.avatarUrl && (post.avatarQuery || post.fields.avatarQuery)) {
					await fetchPhotoTo(
						post.avatarQuery || post.fields.avatarQuery,
						fields.avatarUrl.replace(/^\//, ''),
						'squarish',
					);
				}
			}

			if (fields.avatarUrl && post.avatarQuery && post.kind !== 'video') {
				await fetchPhotoTo(post.avatarQuery, fields.avatarUrl.replace(/^\//, ''), 'squarish');
			}
		}

		resolved.push({ id: post.id, fields });
	}

	// Fill empty video URLs with first successful video
	const anyVideo = resolved.find((p) => p.fields.videoUrl)?.fields.videoUrl || FALLBACK_VIDEO;
	const anyPoster =
		resolved.find((p) => p.fields.posterUrl)?.fields.posterUrl || FALLBACK_POSTER;
	for (const p of resolved) {
		if ('videoUrl' in p.fields && !p.fields.videoUrl) {
			p.fields.videoUrl = anyVideo;
			console.log(`  fallback video for ${p.id} → ${anyVideo}`);
		}
		if ('posterUrl' in p.fields && !p.fields.posterUrl) {
			p.fields.posterUrl = anyPoster;
		}
	}

	await writeFile(OUT_TS, buildTs(resolved));
	await writeFile(
		CREDITS,
		`# Demo media credits\n\nGenerated ${new Date().toISOString()}\n\n${credits.join('\n')}\n`,
	);
	console.log(`\nWrote ${OUT_TS}`);
	console.log(`Credits → ${CREDITS}`);
	console.log('\nNext: defaults are wired to GENERATED_DEMO_POSTS — run cover capture:');
	console.log('  node scripts/capture-template-previews.mjs');
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
