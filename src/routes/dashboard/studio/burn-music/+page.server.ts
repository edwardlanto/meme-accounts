import type { PageServerLoad } from './$types';
import { readdir } from 'node:fs/promises';
import path from 'node:path';

const AUDIO_EXT = /\.(mp3|wav|ogg|m4a|aac|flac)$/i;

function formatLabel(filename: string): string {
	const base = filename.replace(/\.[^.]+$/, '');
	const spaced = base.replace(/[-_]+/g, ' ').trim();
	if (!spaced) return filename;
	return spaced.replace(/\b\w/g, (c) => c.toUpperCase());
}

export const load: PageServerLoad = async () => {
	const musicDir = path.join(process.cwd(), 'static', 'music');
	let filenames: string[] = [];
	try {
		const entries = await readdir(musicDir, { withFileTypes: true });
		filenames = entries
			.filter((e) => e.isFile() && AUDIO_EXT.test(e.name))
			.map((e) => e.name)
			.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
	} catch {
		filenames = [];
	}

	const tracks = filenames.map((filename) => ({
		filename,
		label: formatLabel(filename),
		url: `/music/${encodeURIComponent(filename)}`,
	}));

	return { tracks };
};
