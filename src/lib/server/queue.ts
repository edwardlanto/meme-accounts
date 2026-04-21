import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import { env } from '$env/dynamic/private';

export const SCHEDULED_POSTS_QUEUE_NAME = 'scheduled-posts';

function redisConnection() {
	const url = env.REDIS_URL ?? '';
	if (!url) throw new Error('Missing REDIS_URL');
	return new IORedis(url, { maxRetriesPerRequest: null });
}

export function scheduledPostsQueue() {
	// Note: bullmq will create its own Redis client for pub/sub, etc.
	return new Queue(SCHEDULED_POSTS_QUEUE_NAME, { connection: redisConnection() });
}

