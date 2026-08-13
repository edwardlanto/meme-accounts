import { env } from '$env/dynamic/private';
import {
	S3Client,
	DeleteObjectCommand,
	DeleteObjectsCommand,
	HeadObjectCommand,
	PutObjectCommand,
	GetObjectCommand,
	ListObjectsV2Command,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

function must(name: string): string {
	const v = env[name];
	if (!v) throw new Error(`Missing env ${name}`);
	return v;
}

export function r2Client(): { s3: S3Client; bucket: string } {
	const accountId = must('R2_ACCOUNT_ID');
	const accessKeyId = must('R2_ACCESS_KEY_ID');
	const secretAccessKey = must('R2_SECRET_ACCESS_KEY');
	const bucket = must('R2_BUCKET');

	const s3 = new S3Client({
		region: 'auto',
		endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
		credentials: { accessKeyId, secretAccessKey },
		// Virtual-hosted URLs (`bucket.account.r2...`) often fail in browsers; path-style works reliably for R2.
		forcePathStyle: true,
	});
	return { s3, bucket };
}

export async function r2SignPut(key: string, contentType: string, expiresSec = 300): Promise<string> {
	const { s3, bucket } = r2Client();
	const cmd = new PutObjectCommand({
		Bucket: bucket,
		Key: key,
		ContentType: contentType,
	});
	return await getSignedUrl(s3, cmd, { expiresIn: expiresSec });
}

export async function r2SignGet(key: string, expiresSec = 3600): Promise<string> {
	const { s3, bucket } = r2Client();
	const cmd = new GetObjectCommand({
		Bucket: bucket,
		Key: key,
	});
	return await getSignedUrl(s3, cmd, { expiresIn: expiresSec });
}

export async function r2PutObject(key: string, body: Uint8Array, contentType: string): Promise<void> {
	const { s3, bucket } = r2Client();
	await s3.send(
		new PutObjectCommand({
			Bucket: bucket,
			Key: key,
			Body: body,
			ContentType: contentType,
		}),
	);
}

export async function r2Delete(key: string): Promise<void> {
	const { s3, bucket } = r2Client();
	await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
}

/**
 * Delete every object under `{ownerId}/` (uploads, drafts media, templates, videos).
 * Best-effort — logs and continues on partial failures.
 */
export async function r2DeleteOwnerPrefix(ownerId: string): Promise<{ deleted: number }> {
	const id = String(ownerId ?? '').trim();
	if (!id || id.includes('/') || id.includes('..')) {
		throw new Error('Invalid owner id for R2 purge');
	}
	const prefix = `${id}/`;
	const { s3, bucket } = r2Client();
	let deleted = 0;
	let token: string | undefined;
	do {
		const listed = await s3.send(
			new ListObjectsV2Command({
				Bucket: bucket,
				Prefix: prefix,
				ContinuationToken: token,
				MaxKeys: 1000,
			}),
		);
		const keys = (listed.Contents ?? [])
			.map((o) => o.Key)
			.filter((k): k is string => typeof k === 'string' && k.startsWith(prefix));
		for (let i = 0; i < keys.length; i += 1000) {
			const chunk = keys.slice(i, i + 1000);
			if (!chunk.length) continue;
			const res = await s3.send(
				new DeleteObjectsCommand({
					Bucket: bucket,
					Delete: {
						Objects: chunk.map((Key) => ({ Key })),
						Quiet: true,
					},
				}),
			);
			deleted += chunk.length - (res.Errors?.length ?? 0);
			if (res.Errors?.length) {
				console.warn('[r2DeleteOwnerPrefix] partial errors', res.Errors.slice(0, 5));
			}
		}
		token = listed.IsTruncated ? listed.NextContinuationToken : undefined;
	} while (token);
	return { deleted };
}

export async function r2Exists(key: string): Promise<boolean> {
	const { s3, bucket } = r2Client();
	try {
		await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
		return true;
	} catch {
		return false;
	}
}
