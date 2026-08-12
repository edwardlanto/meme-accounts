import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import {
	HOME_MARQUEE_SLIDE_META,
	type HomeMarqueeSlide,
} from './home-marquee-slides';

const MARQUEE_DIR = join(process.cwd(), 'static/placeholders/marquee');

const VIDEO_EXT = /\.(mp4|webm|mov)$/i;
const IMAGE_EXT = /\.(png|jpe?g|webp|gif|avif)$/i;
const SLIDE_FILE = /^slide-(\d+)\.[^.]+$/i;

function metaForIndex(index: number): { tint: string; tag: string } {
	return HOME_MARQUEE_SLIDE_META[index % HOME_MARQUEE_SLIDE_META.length]!;
}

/**
 * Scan `static/placeholders/marquee` for `slide-{n}.*`.
 * For each index, prefer video over image; use a matching still as poster when present.
 */
export function resolveHomeMarqueeSlides(): HomeMarqueeSlide[] {
	let files: string[] = [];
	try {
		files = readdirSync(MARQUEE_DIR);
	} catch {
		return [];
	}

	type Slot = { video?: string; image?: string };
	const byIndex = new Map<number, Slot>();

	for (const name of files) {
		const match = SLIDE_FILE.exec(name);
		if (!match) continue;
		const index = Number(match[1]);
		if (!Number.isFinite(index) || index < 1) continue;

		const slot = byIndex.get(index) ?? {};
		if (VIDEO_EXT.test(name)) slot.video = name;
		else if (IMAGE_EXT.test(name)) slot.image = name;
		byIndex.set(index, slot);
	}

	return [...byIndex.entries()]
		.sort(([a], [b]) => a - b)
		.flatMap(([_, slot], i) => {
			const file = slot.video ?? slot.image;
			if (!file) return [];
			const meta = metaForIndex(i);
			const poster =
				slot.video && slot.image && slot.image !== file ? slot.image : undefined;
			return [{ file, poster, tint: meta.tint, tag: meta.tag }];
		});
}
