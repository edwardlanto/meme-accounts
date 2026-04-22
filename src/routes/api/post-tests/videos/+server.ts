import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { readdir, stat } from 'node:fs/promises';
import path from 'node:path';

export const GET: RequestHandler = async () => {
	try {
		const root = process.cwd();
		const dir = path.join(root, 'static', 'post-tests', 'video');
		const files = (await readdir(dir)).filter((f) => /\.(mp4|mov|m4v|webm)$/i.test(f));
		files.sort();

		const items = await Promise.all(
			files.map(async (f) => {
				const abs = path.join(dir, f);
				const s = await stat(abs);
				return {
					name: f,
					publicPath: `/post-tests/video/${f}`,
					serverPath: `post-tests/video/${f}`, // relative, used by /api/publish/facebook
					sizeBytes: s.size,
				};
			})
		);

		return json({ ok: true, items });
	} catch (e: any) {
		return json({ ok: false, error: e?.message ?? 'Failed to load test videos' }, { status: 500 });
	}
};
