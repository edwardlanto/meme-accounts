import { json } from '@sveltejs/kit';
import { z } from 'zod';
import type { RequestHandler } from './$types';
import { adminClient } from '$lib/server/auth';
import { r2PutObject, r2SignGet, r2Delete } from '$lib/server/r2';
import { isValidOwnerR2Key, sniffStrictImageMime, parseJsonBody } from '$lib/server/request-security';

const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

async function ensurePublicUser(userId: string, email?: string | null) {
	const admin = adminClient();
	const { data } = await admin.from('users').select('id').eq('id', userId).maybeSingle();
	if (data) return;
	await admin.from('users').insert({
		id: userId,
		email: email?.trim() || '',
		full_name: '',
	});
}

function extForMime(mime: string): string {
	if (mime === 'image/jpeg') return 'jpg';
	if (mime === 'image/png') return 'png';
	if (mime === 'image/webp') return 'webp';
	if (mime === 'image/gif') return 'gif';
	return 'bin';
}

export const GET: RequestHandler = async ({ locals }) => {
	const { user } = await locals.safeGetSession();
	if (!user) return json({ error: 'Unauthorized' }, { status: 401 });

	try {
		const admin = adminClient();
		const { data, error } = await admin
			.from('studio_assets')
			.select('id, name, r2_key, created_at, updated_at')
			.eq('user_id', user.id)
			.order('updated_at', { ascending: false });
		if (error) throw error;

		const rows = data ?? [];
		const assets = await Promise.all(
			rows.map(async (row) => {
				try {
					const thumbUrl = await r2SignGet(row.r2_key, 7200);
					return { ...row, thumbUrl };
				} catch {
					return { ...row, thumbUrl: '' };
				}
			}),
		);
		return json({ assets });
	} catch (e: unknown) {
		const message = e instanceof Error ? e.message : 'Failed to load assets';
		console.error('[api/studio/assets] GET', message);
		return json({ error: message }, { status: 500 });
	}
};

export const POST: RequestHandler = async ({ request, locals }) => {
	const { user } = await locals.safeGetSession();
	if (!user) return json({ error: 'Unauthorized' }, { status: 401 });

	const form = await request.formData().catch(() => null);
	if (!form) return json({ error: 'Expected multipart form' }, { status: 400 });

	const file = form.get('file');
	const nameRaw = String(form.get('name') ?? '').trim();

	if (!file || !(file instanceof File)) return json({ error: 'Missing image file' }, { status: 400 });

	const buf = new Uint8Array(await file.arrayBuffer());
	if (buf.byteLength > MAX_UPLOAD_BYTES) {
		return json({ error: 'Image too large (max 8MB after compression)' }, { status: 413 });
	}

	const mime = sniffStrictImageMime(buf);
	if (!mime) {
		return json({ error: 'Invalid image — use JPEG, PNG, WebP, or GIF' }, { status: 400 });
	}

	const id = crypto.randomUUID();
	const key = `${user.id}/studio-assets/${id}.${extForMime(mime)}`;
	if (!isValidOwnerR2Key(user.id, key)) {
		return json({ error: 'Invalid storage path' }, { status: 400 });
	}

	const name =
		nameRaw.slice(0, 80) ||
		file.name.replace(/\.[^.]+$/, '').trim().slice(0, 80) ||
		'Untitled asset';

	try {
		await ensurePublicUser(user.id, user.email);
		await r2PutObject(key, buf, mime);

		const admin = adminClient();
		const { data, error } = await admin
			.from('studio_assets')
			.insert({ id, user_id: user.id, name, r2_key: key })
			.select('id, name, r2_key, created_at, updated_at')
			.single();

		if (error) throw error;

		const thumbUrl = await r2SignGet(key, 7200);
		return json({ asset: { ...data, thumbUrl } });
	} catch (e: unknown) {
		const message = e instanceof Error ? e.message : 'Upload failed';
		console.error('[api/studio/assets] POST', message);
		return json({ error: message }, { status: 500 });
	}
};

const patchSchema = z.object({
	id: z.string().uuid(),
	name: z.string().min(1).max(80),
});

export const PATCH: RequestHandler = async ({ request, locals }) => {
	const { user } = await locals.safeGetSession();
	if (!user) return json({ error: 'Unauthorized' }, { status: 401 });

	const parsed = await parseJsonBody(request, patchSchema, 4096);
	if (!parsed.ok) return json({ error: parsed.error }, { status: parsed.status });

	const name = parsed.data.name.trim().slice(0, 80);
	if (!name) return json({ error: 'Name required' }, { status: 400 });

	try {
		const admin = adminClient();
		const { data, error } = await admin
			.from('studio_assets')
			.update({ name })
			.eq('id', parsed.data.id)
			.eq('user_id', user.id)
			.select('id, name, r2_key, created_at, updated_at')
			.single();
		if (error) throw error;
		return json({ asset: data });
	} catch (e: unknown) {
		const message = e instanceof Error ? e.message : 'Rename failed';
		return json({ error: message }, { status: 500 });
	}
};

const deleteSchema = z.object({ id: z.string().uuid() });

export const DELETE: RequestHandler = async ({ request, locals }) => {
	const { user } = await locals.safeGetSession();
	if (!user) return json({ error: 'Unauthorized' }, { status: 401 });

	const parsed = await parseJsonBody(request, deleteSchema, 4096);
	if (!parsed.ok) return json({ error: parsed.error }, { status: parsed.status });

	try {
		const admin = adminClient();
		const { data: row, error: fetchErr } = await admin
			.from('studio_assets')
			.select('id, r2_key')
			.eq('id', parsed.data.id)
			.eq('user_id', user.id)
			.maybeSingle();
		if (fetchErr) throw fetchErr;
		if (!row) return json({ error: 'Not found' }, { status: 404 });

		if (isValidOwnerR2Key(user.id, row.r2_key)) {
			try {
				await r2Delete(row.r2_key);
			} catch {
				/* metadata delete still proceeds */
			}
		}

		const { error: delErr } = await admin
			.from('studio_assets')
			.delete()
			.eq('id', parsed.data.id)
			.eq('user_id', user.id);
		if (delErr) throw delErr;

		return json({ ok: true });
	} catch (e: unknown) {
		const message = e instanceof Error ? e.message : 'Delete failed';
		console.error('[api/studio/assets] DELETE', message);
		return json({ error: message }, { status: 500 });
	}
};
