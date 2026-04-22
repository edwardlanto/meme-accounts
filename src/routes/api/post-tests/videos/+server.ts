import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/private';
import { readdir, stat } from 'node:fs/promises';
import path from 'node:path';

export const GET: RequestHandler = async () => {
	try {
		const root = process.cwd();
		const dir = path.join(root, 'static', 'post-tests', 'video');
		const files = (await readdir(dir)).filter((f) => /\.(mp4|mov|m4v|webm)$/i.test(f));
		files.sort();

		const base = (env.PUBLIC_APP_URL ?? '').replace(/\/+$/, '');

		const items = await Promise.all(
			files.map(async (f) => {
				const abs = path.join(dir, f);
				const s = await stat(abs);
				const publicPath = `/post-tests/video/${f}`;
				return {
					name: f,
					publicPath,
					publicUrl: base ? `${base}${publicPath}` : '',
					serverPath: `post-tests/video/${f}`, // relative, used by /api/publish/facebook
					sizeBytes: s.size,
				};
			})
		);

		return json({
			ok: true,
			items,
			publicBaseUrl: base,
			publicBaseReady: Boolean(base && /^https:\/\//i.test(base)),
		});
	} catch (e: any) {
		return json({ ok: false, error: e?.message ?? 'Failed to load test videos' }, { status: 500 });
	}
};
