import { env } from '$env/dynamic/private';
import { S3Client, DeleteObjectCommand, HeadObjectCommand, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
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

export async function r2Exists(key: string): Promise<boolean> {
	const { s3, bucket } = r2Client();
	try {
		await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
		return true;
	} catch {
		return false;
	}
}

