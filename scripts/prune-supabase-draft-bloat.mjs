#!/usr/bin/env node
/**
 * One-off: strip embedded base64 media from Supabase draft JSON (keeps r2:/https refs).
 *
 * Usage (after restoring a paused Supabase project):
 *   node scripts/prune-supabase-draft-bloat.mjs
 *   node scripts/prune-supabase-draft-bloat.mjs --dry-run
 */
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

function parseEnv() {
	const env = {};
	for (const line of readFileSync('.env', 'utf8').split('\n')) {
		if (!line || line.startsWith('#')) continue;
		const i = line.indexOf('=');
		if (i < 0) continue;
		let val = line.slice(i + 1).trim();
		if (
			(val.startsWith('"') && val.endsWith('"')) ||
			(val.startsWith("'") && val.endsWith("'"))
		) {
			val = val.slice(1, -1);
		}
		env[line.slice(0, i).trim()] = val;
	}
	return env;
}

function hasEmbeddedMedia(state) {
	try {
		const j = JSON.stringify(state ?? {});
		return j.includes('"data:image') || j.includes('"data:video');
	} catch {
		return false;
	}
}

function byteSize(state) {
	return new TextEncoder().encode(JSON.stringify(state ?? {})).length;
}

function stripEmbeddedMediaFromState(state) {
	if (!state || typeof state !== 'object') return state;
	const out = { ...state, exportedSlides: [] };

	const strip = (u) => {
		if (typeof u !== 'string') return '';
		const s = u.trim();
		if (!s || s.startsWith('data:') || s.startsWith('blob:')) return '';
		return s;
	};

	const stripArr = (arr) => (Array.isArray(arr) ? arr.map(strip) : []);
	const stripMap = (m) => {
		if (!m || typeof m !== 'object') return {};
		return Object.fromEntries(Object.entries(m).map(([k, arr]) => [k, stripArr(arr)]));
	};

	if (out.bgImagesByTemplate) out.bgImagesByTemplate = stripMap(out.bgImagesByTemplate);
	if (out.bgVideosByTemplate) out.bgVideosByTemplate = stripMap(out.bgVideosByTemplate);
	if (out.circleImages) out.circleImages = stripArr(out.circleImages);
	if (out.circle2Images) out.circle2Images = stripArr(out.circle2Images);
	if (out.subjectCutouts) out.subjectCutouts = stripArr(out.subjectCutouts);
	if (out.tweetTopAvatarImageBySlide) out.tweetTopAvatarImageBySlide = stripArr(out.tweetTopAvatarImageBySlide);
	if (out.tweetBottomAvatarImageBySlide) out.tweetBottomAvatarImageBySlide = stripArr(out.tweetBottomAvatarImageBySlide);
	if (out.textCarouselAvatarImageBySlide) out.textCarouselAvatarImageBySlide = stripArr(out.textCarouselAvatarImageBySlide);
	if (out.articleLogoSrcBySlide) out.articleLogoSrcBySlide = stripArr(out.articleLogoSrcBySlide);
	if (out.brandStackBottomMediaBySlide) out.brandStackBottomMediaBySlide = stripArr(out.brandStackBottomMediaBySlide);
	if (out.sourceLogoSrc) out.sourceLogoSrc = strip(out.sourceLogoSrc);
	if (out.logoUrl) out.logoUrl = strip(out.logoUrl);

	if (out.slideOverlaysByTemplate && typeof out.slideOverlaysByTemplate === 'object') {
		out.slideOverlaysByTemplate = Object.fromEntries(
			Object.entries(out.slideOverlaysByTemplate).map(([tpl, rows]) => [
				tpl,
				Array.isArray(rows)
					? rows.map((slideRow) =>
							Array.isArray(slideRow)
								? slideRow.map((o) => {
										if (!o || typeof o !== 'object') return o;
										const next = { ...o };
										if ('src' in next) next.src = strip(next.src);
										return next;
									})
								: slideRow,
						)
					: rows,
			]),
		);
	}

	return out;
}

const dryRun = process.argv.includes('--dry-run');
const env = parseEnv();
const url = env.SUPABASE_URL || env.PUBLIC_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_KEY;
if (!url || !key) {
	console.error('Missing SUPABASE_URL and SUPABASE_SERVICE_KEY in .env');
	process.exit(1);
}

const admin = createClient(url, key);
const { data: rows, error } = await admin.from('drafts').select('id, kind, state, user_id');
if (error) {
	console.error('Failed to list drafts:', error.message);
	process.exit(1);
}

let scanned = 0;
let cleaned = 0;
let savedBytes = 0;

for (const row of rows ?? []) {
	scanned++;
	const before = row.state ?? {};
	if (!hasEmbeddedMedia(before)) continue;

	const after = stripEmbeddedMediaFromState(before);
	const delta = byteSize(before) - byteSize(after);
	cleaned++;
	savedBytes += delta;

	console.log(
		`${dryRun ? '[dry-run] ' : ''}${row.kind} ${row.id.slice(0, 8)}… −${(delta / 1024).toFixed(0)} KB`,
	);

	if (!dryRun) {
		const { error: upErr } = await admin.from('drafts').update({ state: after }).eq('id', row.id);
		if (upErr) console.error('  update failed:', upErr.message);
	}
}

console.log(
	`\nScanned ${scanned} draft rows. ${cleaned} had embedded media.` +
		(cleaned ? ` Freed ~${(savedBytes / 1024 / 1024).toFixed(2)} MB.` : '') +
		(dryRun ? ' (dry run — no writes)' : ''),
);
