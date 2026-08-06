/**
 * Capture Studio-accurate starter covers for the Carousels template grid.
 *
 * Requires the Vite/SvelteKit dev server (auth-free /dev/template-capture page).
 *
 * Usage:
 *   node scripts/capture-template-previews.mjs
 *   STUDIO_BASE=http://localhost:3000 node scripts/capture-template-previews.mjs
 *   node scripts/capture-template-previews.mjs news image-quote tweet
 */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const BASE = process.env.STUDIO_BASE || 'http://localhost:3000';
const OUT = path.resolve('static/placeholders/carousel');

/** Starter template ids → cover filenames under static/placeholders/carousel */
const ALL_JOBS = [
	{ id: 'news', file: 'news-cover.png' },
	{ id: 'image-quote', file: 'image-quote-cover.png' },
	{ id: 'tweet', file: 'tweet-cover.png' },
	{ id: 'text', file: 'text-cover.png' },
	{ id: 'black-text', file: 'black-text-cover.png' },
	{ id: 'video-feature', file: 'feature-card-cover.png' },
	{ id: 'video-source', file: 'highlight-cover.png' },
	{ id: 'video-text', file: 'text-on-video-cover.png' },
	{ id: 'video-creator', file: 'creator-hook-cover.png' },
	{ id: 'video-hook', file: 'hook-video-cover.png' },
	{ id: 'video-fit', file: 'fit-video-cover.png' },
	{ id: 'video-split', file: 'split-video-cover.png' },
	{ id: 'video-blur', file: 'blur-video-cover.png' },
	{ id: 'video-story', file: 'video-story-cover.png' },
	{ id: 'video-post', file: 'clip-post-cover.png' },
	{ id: 'brand-stack', file: 'brand-stack-cover.png' },
	{ id: 'photo-caption', file: 'photo-caption-cover.png' },
	{ id: 'white-thread', file: 'white-thread-cover.png' },
	{ id: 'white-media', file: 'white-media-cover.png' },
];

const filter = process.argv.slice(2).map((s) => s.trim()).filter(Boolean);
const JOBS = filter.length
	? ALL_JOBS.filter((j) => filter.includes(j.id) || filter.includes(j.file))
	: ALL_JOBS;

async function waitForMedia(page, root) {
	// Let images decode + muted videos paint a frame.
	await page.waitForTimeout(900);
	await page.evaluate(async (el) => {
		const imgs = [...el.querySelectorAll('img')];
		await Promise.all(
			imgs.map(
				(img) =>
					img.complete
						? Promise.resolve()
						: new Promise((res) => {
								img.addEventListener('load', () => res(), { once: true });
								img.addEventListener('error', () => res(), { once: true });
							}),
			),
		);
		const videos = [...el.querySelectorAll('video')];
		await Promise.all(
			videos.map(
				(v) =>
					new Promise((res) => {
						const done = () => res();
						if (v.readyState >= 2) {
							try {
								v.currentTime = Math.min(0.35, (v.duration || 1) * 0.1);
							} catch {
								/* ignore */
							}
							done();
							return;
						}
						v.addEventListener('loadeddata', done, { once: true });
						v.addEventListener('error', done, { once: true });
						setTimeout(done, 2500);
					}),
			),
		);
	}, root);
	await page.waitForTimeout(500);
}

async function capture(page, job) {
	const url = `${BASE}/dev/template-capture?id=${encodeURIComponent(job.id)}`;
	await page.goto(url, { waitUntil: 'networkidle', timeout: 90000 });
	const root = await page.waitForSelector(`[data-capture-id="${job.id}"]`, { timeout: 45000 });
	if (!root) throw new Error(`No capture root for ${job.id}`);
	await waitForMedia(page, root);
	const out = path.join(OUT, job.file);
	const buf = await root.screenshot({ type: 'png' });
	await writeFile(out, buf);
	console.log('wrote', out, `(${buf.length} bytes)`);
	return out;
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({
	viewport: { width: 720, height: 960 },
	deviceScaleFactor: 2,
});

let failed = 0;
try {
	await mkdir(OUT, { recursive: true });
	// Warm the capture page once so Vite compiles components.
	await page.goto(`${BASE}/dev/template-capture?id=news`, {
		waitUntil: 'domcontentloaded',
		timeout: 90000,
	});
	await page.waitForTimeout(1500);

	for (const job of JOBS) {
		try {
			await capture(page, job);
		} catch (err) {
			failed += 1;
			console.error('FAILED', job.id, err?.message || err);
		}
	}
} finally {
	await browser.close();
}

if (failed) {
	console.error(`\n${failed} capture(s) failed`);
	process.exit(1);
}
console.log(`\nDone — ${JOBS.length} cover(s) in ${OUT}`);
