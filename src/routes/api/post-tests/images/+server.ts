import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

function mimeFromExt(p: string) {
	const ext = path.extname(p).toLowerCase();
	if (ext === '.png') return 'image/png';
	if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
	if (ext === '.webp') return 'image/webp';
	if (ext === '.gif') return 'image/gif';
	return 'application/octet-stream';
}

export const GET: RequestHandler = async () => {
	try {
		const root = process.cwd();
		const dir = path.join(root, 'static', 'post-tests', 'pictures');
		const files = (await readdir(dir)).filter((f) => /\.(png|jpe?g|webp|gif)$/i.test(f));
		files.sort();

		const items = await Promise.all(
			files.map(async (f) => {
				const abs = path.join(dir, f);
				const buf = await readFile(abs);
				const mime = mimeFromExt(f);
				const dataUrl = `data:${mime};base64,${buf.toString('base64')}`;
				return {
					name: f,
					publicPath: `/post-tests/pictures/${f}`,
					dataUrl,
				};
			})
		);

		return json({ ok: true, items });
	} catch (e: any) {
		return json({ ok: false, error: e?.message ?? 'Failed to load test images' }, { status: 500 });
	}
};

